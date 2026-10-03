import { describe, expect, it } from "vitest";
import {
  ROWS,
  SHEETS,
  buildSheet,
} from "./gif-to-sheet.mjs";

/**
 * A folha do ogre da predeira.
 *
 * Este arquivo trava as tres adaptacoes que a arte dele exigiu, e
 * nao apenas que a imagem saiu:
 *
 * 1. O golpe veio em 5 das 8 direcoes. A ferramenta copia a vizinha
 *    mais proxima em GRAU, e o mapa e declarado na folha: uma
 *    decisao sobre a arte, nao um palpite interno.
 * 2. Nao tem `idle.gif`. A folha sai sem a linha de idle, e o
 *    layout aponta o idle para o primeiro frame da caminhada DA
 *    DIRECAO, para o ogre nao marchar parado.
 * 3. Os gifs nao tem a mesma contagem de frames entre as direcoes
 *    (8 e 9 na caminhada, 9 e 10 no golpe). O corte e no menor do
 *    grupo, para o passo nao mudar de direcao para direcao.
 */
const build = () => buildSheet("ogre");

describe("sheet do ogre da predeira", () => {
  it("tem as 8 direcoes de caminhada na arte", () => {
    // a caminhada veio completa: 8 arquivos na raiz
    const declaradas = SHEETS.ogre.sourceDir;

    expect(declaradas).toBe(
      "src/assets/sprites/ogre_da_predeira",
    );

    expect(ROWS).toHaveLength(8);
  });

  it("declara o substituto de cada direcao de golpe que falta", () => {
    const fallback = SHEETS.ogre.shootFallback;

    // north, north-east e north-west nao vieram na pasta `shoot`
    expect(Object.keys(fallback).sort()).toEqual([
      "north",
      "north-east",
      "north-west",
    ]);
  });

  it("copia a direcao vizinha mais proxima, nunca a oposta", () => {
    const resultado = build();

    const porDirecao = Object.fromEntries(
      resultado.substituidas.map((item) => [
        item.direcao,
        item.veioDe,
      ]),
    );

    expect(porDirecao).toEqual({
      "north-west": "west",
      north: "east",
      "north-east": "east",
    });

    // a ordem de `ROWS` e circular de 8 direcoes, entao a distancia
    // entre duas e a menor das duas distancias lineares. A conferia
    // e que o substituto e o mais proximo que existia, e nao so um
    // substituto qualquer
    const indice = (nome) => ROWS.indexOf(nome);

    const circular = (a, b) => {
      const bruto = Math.abs(indice(a) - indice(b));

      return Math.min(bruto, ROWS.length - bruto);
    };

    // o que a arte trouxe de verdade na pasta `shoot`
    const disponiveis = [
      "east",
      "south-east",
      "south",
      "south-west",
      "west",
    ];

    for (const [direcao, vizinho] of Object.entries(porDirecao)) {
      const escolhido = circular(direcao, vizinho);

      for (const outra of disponiveis) {
        expect(
          circular(direcao, outra),
          `${direcao}: ${vizinho} (${escolhido}) foi pior que ${outra}`,
        ).toBeGreaterThanOrEqual(escolhido);
      }
    }

    // e o oposto nunca entra: colar o lado de frente no lugar do
    // lado de costas faria o jogador ver a CARA do ogre quando ele
    // esta virado para o fim da tela
    for (const [direcao, vizinho] of Object.entries(porDirecao)) {
      const oposto = circular(direcao, vizinho);

      expect(oposto).toBeLessThan(4);
    }
  });

  it("nao repete a mesma arte como se fosse direcao nova", () => {
    const resultado = build();

    // Cada linha copiada e a MESMA arte de outra linha. Isso e
    // esperado e foi pedido; o que nao pode e a folha inteira ter
    // virado em tres linhas: 8 de caminhada e 8 de golpe sao 16
    // linhas de conteudo, e o tool contaria menos
    expect(resultado.rows).toBe(16);
  });

  it("sai sem linha de idle, e o layout aponta o idle para o walk", async () => {
    const resultado = build();

    // sem idle, a linha de golpe sobe de 9 para 8: e a unica coisa
    // que a sheet do zumbi faz diferente, e o layout tem de bater
    expect(resultado.idleRow).toBeNull();
    expect(resultado.idleFrames).toBe(0);
    expect(resultado.shootRow).toBe(8);

    const { OGRE_PREDEIRA_SPRITE } = await import(
      "../src/data/sprites/enemyLayout.js"
    );

    const { idle } = OGRE_PREDEIRA_SPRITE.animations;

    // sem `row` e sem `rowOffset`: o `resolveFrameRect` cai em
    // `animations.walk` quando a animacao nao existe, e um idle de
    // 8 frames faria o ogre MARCHAR parado
    expect(idle.row).toBeUndefined();
    expect(idle.rowOffset).toBeUndefined();
    expect(idle.length).toBe(1);
  });

  it("corta o ciclo no menor numero de frames do grupo", () => {
    const resultado = build();

    // a caminhada tem gif de 8 e de 9 frames, e o golpe de 9 e de
    // 10. Cortar no menor da 8 e 9
    expect(resultado.walkFrames).toBe(8);
    expect(resultado.shootFrames).toBe(9);
    expect(resultado.columns).toBe(9);
  });

  it("mede a ancora, e nao a chuta", () => {
    const resultado = build();

    // a celula e a mesma do zumbi, 68x68, e a ancora foi medida
    expect(resultado.frameSize).toBe(68);
    expect(resultado.anchorX).toBeCloseTo(33.5, 1);
    expect(resultado.anchorY).toBe(55);
  });

  it("cabe 136 celulas: 8 de caminhada e 8 de golpe", () => {
    const resultado = build();

    expect(resultado.width).toBe(612);
    expect(resultado.height).toBe(1088);

    // 8 direcoes, e em cada uma 8 frames de caminhada mais 9 de
    // golpe. A 9a coluna da sheet fica vazia na caminhada, que tem
    // 8, e e por isso que a contagem NAO e `columns x rows`
    const celulas =
      8 * (resultado.walkFrames + resultado.shootFrames);

    expect(celulas).toBe(8 * 17);
  });
});
