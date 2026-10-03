import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  HUD_ICON_FILE,
  HUD_ICON_IDS,
  HUD_ICON_URL,
  hasHudIcon,
  hudIconGlyph,
  hudIconUrl,
} from "./hudIcons.js";

/**
 * Os icones desenhados dos botoes da HUD.
 *
 * Este mapa e o tipo de coisa que falha SEM ERRO. Um `typo` no nome do
 * arquivo nao estoura nada: vira uma URL que da 404 no navegador, e o
 * botao simplesmente aparece sem imagem — ou, pior, com o glifo de
 * reserva, que e o que funcionava antes. O icone "some" e ninguem sabe
 * se foi o asset ou o codigo
 *
 * Por isso o teste central deste arquivo nao verifica o que o
 * resolvedor DEVOLVE, e sim se o arquivo que ele aponta EXISTE no
 * disco. E e por isso que os caminhos sao literais no modulo e nao
 * montados com template: um caminho variavel da 404 em producao e
 * funciona no `dev`, e nenhum teste de URL revelaria isso
 */

/** `file:///C:/...` -> caminho que o `fs` entende */
function arquivoDa(url) {
  return fileURLToPath(url);
}

const ASSINATURA_PNG = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
];

describe.each(HUD_ICON_IDS)("o icone de %s", (iconId) => {
  it("aponta para um arquivo que EXISTE", () => {
    const url = hudIconUrl(iconId);

    expect(url, iconId).toBeTruthy();

    expect(
      existsSync(arquivoDa(url)),
      `falta o arquivo do icone ${iconId}: ${url}`,
    ).toBe(true);
  });

  it("o arquivo e um PNG de verdade", () => {
    // Um `.png` renomeado de outra coisa quebra no build, e o
    // `Image` do navegador falha em silencio: o botao fica sem imagem
    const buffer = readFileSync(arquivoDa(hudIconUrl(iconId)));

    expect([...buffer.subarray(0, 8)]).toEqual(ASSINATURA_PNG);
  });

  it("a URL termina no arquivo deste icone, nao o de outro", () => {
    // O `src` do `<img>` tem que ser o arquivo deste icone. Um
    // `copy/paste` trocando o caminho faria os botoes mostrarem a mesma
    // arte, e o teste de existencia passaria: o arquivo existe, e so
    // nao e o do botao
    //
    // O nome vem de `HUD_ICON_FILE`, e nao do id: o id da colecao e
    // `collection` e o arquivo e `colecao.png`, e comparar com o id
    // reprovaria o icone certo
    expect(
      hudIconUrl(iconId).endsWith(`/${HUD_ICON_FILE[iconId]}.png`),
      `${iconId} -> ${hudIconUrl(iconId)}`,
    ).toBe(true);
  });

  it("o arquivo do mapa e um nome de arquivo, e nao um id", () => {
    // A separacao entre id e arquivo so funciona se os dois lados
    // existirem. Sem o `HUD_ICON_FILE`, o `URL termina no id` acima
    // seria um teste que so passa para os icones cujo id e igual ao
    // arquivo, e a excecao ficaria sem cobertura
    expect(HUD_ICON_FILE[iconId], iconId).toBeTruthy();

    expect(
      hudIconUrl(iconId),
      iconId,
    ).toContain(`/${HUD_ICON_FILE[iconId]}.png`);
  });

  it("tem glifo de reserva", () => {
    // Sem o glifo, um icone que nao carregasse deixaria o botao
    // vazio, e um circulo vazio na barra e pior que o caractere feio
    // que ele substitui
    expect(hudIconGlyph(iconId), iconId).toBeTruthy();
  });
});

describe("os icones da HUD", () => {
  it("sao os sete que a barra usa", () => {
    // A lista e escrita, e o mapa tambem. Um icone novo na pasta que
    // nao entrasse na lista ficaria fora do teste, e um nome na lista
    // sem arte quebraria o `for` acima com um arquivo ausente
    expect(Object.keys(HUD_ICON_URL).sort()).toEqual(
      [...HUD_ICON_IDS].sort(),
    );

    // e o mapa de arquivos cobre a mesma lista, sem sobra e sem falta
    expect(Object.keys(HUD_ICON_FILE).sort()).toEqual(
      [...HUD_ICON_IDS].sort(),
    );
  });

  it("so o botao de teste ficou sem arte", () => {
    /**
     * A lista de icones e o que decide isto, e nao a contagem de
     * arquivos na pasta: sobrar arquivo sem botao nao e problema, e e o
     * que acontece com o `gear_pixel_icon.png` antes dele entrar — a
     * arte do botao de teste nao foi feita
     */
    expect(HUD_ICON_IDS).not.toContain("test");
    expect(HUD_ICON_IDS).toContain("collection");
    expect(HUD_ICON_IDS).toContain("rank");
    expect(HUD_ICON_IDS).toContain("settings");
  });

  it("o icone de configuracao aponta para a arte da engrenagem", () => {
    /**
     * O id e `settings` e o arquivo e `gear_pixel_icon.png`: o id segue
     * o botao e o arquivo segue a arte. E a unica verificacao que pega
     * uma troca entre os dois nomes, porque um `typo` em qualquer lado
     * ainda deixa um arquivo que existe — e o `existsSync` acima passa
     */
    expect(HUD_ICON_FILE.settings).toBe("gear_pixel_icon");

    expect(hudIconUrl("settings")).toContain(
      "/gear_pixel_icon.png",
    );

    // e nao e o icone de outra coisa com o nome parecido
    expect(hudIconUrl("settings")).not.toBe(
      hudIconUrl("rank"),
    );
  });

  it("cada icone tem uma URL diferente", () => {
    // Dois botoes com a mesma arte nao sao um bug de tela, mas sao um
    // `copy/paste` que passou: o jogador ve dois circulos iguais e nao
    // sabe qual painel cada um abre
    const urls = HUD_ICON_IDS.map((id) => hudIconUrl(id));

    expect(new Set(urls).size).toBe(HUD_ICON_IDS.length);
  });

  it("cada icone tem um glifo diferente dos outros", () => {
    const glyphs = HUD_ICON_IDS.map((id) => hudIconGlyph(id));

    expect(new Set(glyphs).size).toBe(HUD_ICON_IDS.length);
  });

  it("nome desconhecido devolve null nos dois, e nao uma URL quebrada", () => {
    // O `HudIcon` le este `null` para cair no glifo. Se devolvesse uma
    // string qualquer, o `<img>` sairia com `src` invalido e o botao
    // ficaria sem imagem E sem glifo
    expect(hudIconUrl("nao_existe")).toBe(null);
    expect(hudIconGlyph("nao_existe")).toBe(null);
    expect(hasHudIcon("nao_existe")).toBe(false);
    expect(hasHudIcon("stats")).toBe(true);
  });

  it("os caminhos sao literais, e nao montados com template", () => {
    /**
     * A regra do Vite so cobre o `new URL` de caminho LITERAL.
     *
     * Com `new URL(\`../../assets/icons/${id}.png\`, import.meta.url)`
     * o build passa sem reclamar e imprime `✓ built`, mas o PNG nao
     * entra no `dist`: no `dev` a URL `file://` funciona e o icone
     * aparece, e so em producao que ele some. Nenhum teste de URL
     * revelaria — a URL esta certa nos dois lados, o que falta e o
     * arquivo no pacote
     *
     * Ler o proprio modulo e o que pega: e a forma de o teste saber
     * que a lista nao esta sendo gerada
     */
    const fonte = readFileSync(
      fileURLToPath(new URL("./hudIcons.js", import.meta.url)),
      "utf8",
    );

    // nenhum `new URL(` com crase dentro do caminho
    expect(
      /new URL\(\s*`/.test(fonte),
      "o `new URL` de um icone esta com template literal",
    ).toBe(false);
  });
});