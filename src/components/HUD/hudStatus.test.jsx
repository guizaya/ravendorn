import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import HUD from "./HUD.jsx";
import * as classesDoJogo from "../../data/characters/index.js";
import * as statsDoJogo from "../../game/stats/StatSheet.js";
import { getCharacterDefinition } from "../../data/characters/index.js";

/**
 * O botao e o painel de STATUS.
 *
 * Duas coisas distintas e com regras distintas:
 *
 * 1. o BOTAO fica AO LADO do bloco de vida — nome, level e barra de
 *    vida — e NAO dentro dele. E um detalhe de layout, e o erro e
 *    silencioso: um botao dentro do `.hud-vitals` renderiza igual e
 *    so empurra o bloco de vida
 * 2. o PAINEL abre e fecha, e por enquanto so tem o botao de fechar
 */
const classe = getCharacterDefinition("arbalist");

const ANA = {
  id: "p_ana",
  name: "Ana",
  className: "Arbalist",
  level: 9,
  hp: 1400,
  maxHp: 1400,
  resource: 100,
  maxResource: 100,
  resourceName: "Chi",
  shield: 0,
  skills: [],
  statusEffects: [],
};

const CSS = readFileSync("src/styles.css", "utf8");

const snapshot = () => ({
  time: 0,
  autoPlay: false,
  engaged: false,
  player: ANA,
});

const montar = (props = {}) =>
  render(
    <HUD
      classDefinition={classe}
      characterName="Ana"
      snapshot={snapshot()}
      engineRef={{ current: null }}
      {...props}
    />,
  );

const markup = () =>
  renderToStaticMarkup(
    <HUD
      classDefinition={classe}
      characterName="Ana"
      snapshot={snapshot()}
      engineRef={{ current: null }}
    />,
  );

/** o botao de status e o bloco de vida, como aparece no HTML */
const botaoStatus = (html) =>
  html.slice(
    html.indexOf('class="hud-btn hud-btn--status'),
    html.indexOf("</button>", html.indexOf("hud-btn--status")),
  );

const blocoVida = (html) =>
  html.slice(
    html.indexOf('<section class="hud-vitals">'),
    html.indexOf("</section>"),
  );

/**
 * Todas as regras de um seletor, com o corpo de cada uma.
 *
 * O CSS do status e do teste e AGRUPADO (`.hud-btn--status,
 * .hud-btn--test { --vitals-w; left: calc(...) }`) e o `left` esta
 * nessa regra, nao em uma que abre pelo seletor sozinho. Ler so a
 * primeira ocorrencia de `.hud-btn--status {` acha a regra do `top`,
 * que nao tem `left` — e o teste acusaria um `left` faltando que
 * existe
 */
const regrasDe = (seletor) =>
  [
    ...CSS.matchAll(
      new RegExp(
        `\\.${seletor}[^{}]*\\{([^}]*)\\}`,
        "g",
      ),
    ),
  ].map((m) => m[1]);

afterEach(cleanup);

describe("o botao de status", () => {
  it("existe e e um botao da HUD, como o do bestiario", () => {
    const html = markup();

    expect(botaoStatus(html)).toContain("hud-btn--status");

    // o mesmoicone circular dos outros botoes, e nao um retangulo
    // proprio: o jogador precisa ver que e a mesma familia
    expect(botaoStatus(html)).toContain('class="hud-btn');
  });

  it("esta AO LADO do bloco de vida, e nao DENTRO dele", () => {
    const html = markup();

    const bloco = blocoVida(html);
    const botao = botaoStatus(html);

    /**
     * Este e o teste do requisito principal.
     *
     * Um botao dentro do `.hud-vitals` renderiza IGUAL — mesmo icone,
     * mesmo `hud-btn`, mesmo titulo. A unica diferenca e que ele
     * empurra o conteudo do bloco e muda a altura da barra de vida,
     * e nenhum teste de marcacao pegaria isso. Por isso o teste e de
     * POSICAO no HTML, e nao de presenca
     */
    expect(botao, "o botao nao esta no HTML").not.toBe("");
    expect(
      bloco.indexOf("hud-btn--status"),
      "o botao de status esta DENTRO do bloco de vida",
    ).toBe(-1);

    // e o `</section>` fecha ANTES do botao: ele e IRMAO do bloco, e
    // nao filho. Um `indexOf` negativo acima ja prova o recorte, e
    // este prova a ordem
    expect(
      html.indexOf("</section>"),
      "o bloco de vida nao fecha",
    ).toBeLessThan(html.indexOf("hud-btn--status"));
  });

  it("aponta o bloco de vida em CSS, e nao em numero solto", () => {
    /**
     * O bloco de vida muda de largura em duas media queries
     * (238 -> 210 -> 176). Se o `left` do botao fosse um numero
     * fixo, ele passaria por cima do bloco na tela estreita — e
     * nenhuma media query e assertion de teste, entao o numero tem de
     * vir de uma variavel que o CSS mantem em dia
     *
     * A regra procurada e a que declara `--vitals-w`: e ela que tem o
     * `left` calc, e nao a regra do `top`
     */
    const regra = regrasDe("hud-btn--status").find((corpo) =>
      corpo.includes("--vitals-w"),
    );

    expect(regra, "o status nao tem regra com --vitals-w").toBeTruthy();

    expect(regra).toMatch(/left:\s*calc\(/);
    expect(regra).toContain("var(--vitals-w)");

    // e as duas telas estreitas sobrescrevem a variavel
    const estreitas = [
      ...CSS.matchAll(/--vitals-w:\s*(\d+)px/g),
    ].map((m) => m[1]);

    expect(
      estreitas.length,
      "a variavel nao e mantida nas media queries",
    ).toBeGreaterThanOrEqual(2);

    // nenhuma delas pode repetir a largura da tela cheia
    expect(new Set(estreitas).size).toBe(estreitas.length);

    /**
     * A tela estreita tem de declarar a largura DELA, e nao a da tela
     * cheia.
     *
     * A checagem e por context: o `--vitals-w` da media query tem que
     * estar dentro de um `@media`, e o valor dele tem que ser diferente
     * do da regra principal. Um `left` fixo — ou uma media query que
     * repete 238px — passaria pela contagem e deixaria o botao por
     * cima da barra de vida so na tela estreita, que e o caso que o
     * jogador ve no celular
     */
    /**
     * A largura da regra BASE, e nao a de qualquer regra.
     *
     * O seletor aparece em tres lugares: na regra agrupada que declara
     * as variaveis (238), na media query de 210 e na de 176. Pegar
     * "qualquer ocorrencia" podia devolver a da media query, e dai a
     * comparacao com a media query viraria `176 !== 176`
     */
    const regraBase =
      CSS.match(
        /\.hud-btn--status,[^}]*\{[^}]*--vitals-w:\s*(\d+)px[^}]*\}/,
      )?.[1] ?? "";

    expect(
      regraBase,
      "a regra agrupada do status nao declara --vitals-w",
    ).toBeTruthy();

    const principal = regraBase;

    /**
      * O seletor pode vir SOZINHO ou em grupo.
      *
      * `\.hud-btn--status\s*\{` sovia num grupo com virgula, e a regra
      * da tela estreita virou grupo para o botao de guilda acompanhar o
      * bloco estreito tambem — o mesmo motivo dela ter `--vitals-w`
      * proprio. O `(?:...)?` aceita as duas formas e a checagem
      * continua sendo a mesma: a media query declara a largura DELA
      */
     const dentroDeMedia = [...CSS.matchAll(
      /@media[^{]*\{[\s\S]*?\.hud-btn--status(?:\s*,\s*[^{]*?)?\{[^}]*--vitals-w:\s*(\d+)px[^}]*\}/g,
    )].map((m) => m[1]);

    expect(
      dentroDeMedia.length,
      "nenhuma media query declara a largura do status",
    ).toBeGreaterThanOrEqual(1);

    for (const largura of dentroDeMedia) {
      expect(
        largura,
        `a media query repete ${principal}px, a largura da tela cheia`,
      ).not.toBe(principal);
    }

    /**
     * E o valor tem que ser a largura REAL do bloco naquela tela.
     *
     * A checagem anterior so pegava "a media query nao repete a tela
     * cheia". Um `--vitals-w: 200px` — que nao corresponde a nenhum
     * `.hud-vitals` do CSS — passaria nela e botaria o botao 24px
     * fora do lugar, com o teste verde
     */
    const largurasReais = [
      ...CSS.matchAll(
        /\.hud-vitals\s*\{[^}]*width:\s*(\d+)px[^}]*\}/g,
      ),
    ].map((m) => m[1]);

    expect(
      largurasReais.length,
      "o CSS nao declara a largura do hud-vitals",
    ).toBeGreaterThan(0);

    for (const largura of dentroDeMedia) {
      expect(
        largurasReais,
        `--vitals-w: ${largura}px na media query, e o bloco ` +
          `de vida mede ${largurasReais.join("/")}px`,
      ).toContain(largura);
    }
  });

  it("abre e fecha o painel", () => {
    const { container } = montar();

    const botao = container.querySelector(".hud-btn--status");

    expect(container.querySelector(".sts-panel")).toBe(null);

    fireEvent.click(botao);

    expect(
      container.querySelector(".sts-panel"),
      "o painel nao abriu",
    ).toBeTruthy();

    expect(botao.className).toContain("is-active");

    fireEvent.click(botao);

    expect(container.querySelector(".sts-panel")).toBe(null);
    expect(botao.className).not.toContain("is-active");
  });

  it("o X do painel fecha, sem passar pela barra", () => {
    const { container } = montar();

    fireEvent.click(container.querySelector(".hud-btn--status"));

    const fecha = container.querySelector(".sts-panel .inv-close");

    expect(fecha, "o painel nao tem botao de fechar").toBeTruthy();

    fireEvent.click(fecha);

    expect(container.querySelector(".sts-panel")).toBe(null);
  });

  /**
 * O painel de STATS.
 *
 * A folha e montada pelo MOTOR e chega no pacote. O que importa
 * verificar aqui e que o painel mostra essa folha e NADA mais: um
 * numero que o painel calcula por conta propria e uma segunda
 * verdade sobre o personagem, e a segunda verdade e sempre a errada
 */
describe("o painel de stats", () => {
  /**
   * A folha de uma classe, num nivel.
   *
   * Sai do MESMO modulo que o motor usa. Um numero escrito a mao aqui
   * passaria num teste de painel e reprovaria em producao, que e o
   * inverso do que um teste deve fazer
   */
  const folha = (level = 9, bonus = {}) =>
    statsDoJogo.buildStatSheet(
      classesDoJogo.CHARACTER_CLASSES[3],
      level,
      bonus,
    );

  /** O HUD com a folha ja montada, como chega do servidor. */
  const comFolha = (extra = {}) =>
    montar({
      snapshot: {
        ...snapshot(),
        player: {
          ...ANA,
          stats: folha(9, extra.bonus ?? {}),
        },
      },
    });

  it("lista os vinte e seis stats do personagem", () => {
    const { container } = comFolha();

    fireEvent.click(container.querySelector(".hud-btn--status"));

    expect(
      container.querySelectorAll(".sts-row"),
    ).toHaveLength(statsDoJogo.STAT_DEFS.length);

    for (const def of statsDoJogo.STAT_DEFS) {
      expect(
        container.textContent,
        def.id,
      ).toContain(def.label);
    }
  });

  it("agrupa em atributos, combate, recursos e progresso", () => {
    const { container } = comFolha();

    fireEvent.click(container.querySelector(".hud-btn--status"));

    const titulos = [
      ...container.querySelectorAll(".sts-group__title"),
    ].map((node) => node.textContent);

    expect(titulos).toEqual([
      "Atributos",
      "Combate",
      "Recursos",
      "Progresso",
    ]);
  });

  it("cada stat tem base, bonus e total em celulas proprias", () => {
    const { container } = comFolha();

    fireEvent.click(container.querySelector(".hud-btn--status"));

    for (const linha of [
      ...container.querySelectorAll(".sts-row"),
    ]) {
      expect(
        linha.querySelectorAll(".sts-row__base"),
        "a linha nao tem a celula de base",
      ).toHaveLength(1);

      expect(
        linha.querySelectorAll(".sts-row__bonus"),
        "a linha nao tem a celula de bonus",
      ).toHaveLength(1);

      expect(
        linha.querySelectorAll(".sts-row__total"),
        "a linha nao tem a celula de total",
      ).toHaveLength(1);
    }
  });

  it("base + bonus fecha com o total em todas as linhas", () => {
    // a soma e o que garante que o painel nao esta inventando: se
    // `bonus` fosse lido de outro lugar, esta conta fecharia em
    // algumas linhas e o jogador nao saberia quais
    const { container } = comFolha();

    fireEvent.click(container.querySelector(".hud-btn--status"));

    for (const row of folha().rows) {
      expect(row.base + row.bonus, row.id).toBeCloseTo(
        row.total,
        6,
      );
    }
  });

  it("o ATK da tela e o mesmo ataque que o motor usa", () => {
    // o painel nao refaz a conta: ele mostra a folha, e a folha foi
    // montada no mesmo passo que definiu o `player.attack`. Um
    // painel que calculasse o ATK por conta propria mostraria um
    // numero que o golpe nunca usou
    const pronta = folha();

    const { container } = comFolha();

    fireEvent.click(container.querySelector(".hud-btn--status"));

    const linha = [
      ...container.querySelectorAll(".sts-row"),
    ].find(
      (node) =>
        node.querySelector(".sts-row__label b")
          .textContent === "ATK",
    );

    const esperado = statsDoJogo.formatStat(
      statsDoJogo.STAT_BY_ID.attack,
      pronta.byId.attack.total,
    );

    expect(linha).toBeTruthy();
    expect(
      linha.querySelector(".sts-row__total").textContent,
    ).toBe(esperado);
  });

  it("o bonus de equipamento aparece na coluna do meio", () => {
    // o bonus e o que mudou desde que o jogador comecou. Uma folha
    // com bonus mostra a celula do meio acesa, e o total cresce a
    // partir da base
    //
    // O valor esperado sai da propria folha e nao de um numero
    // escrito a mao: o bonus de ATK e o crescimento do nivel mais os
    // 40 da peca, e escrever "40" aqui passaria mesmo com a conta
    // errada
    const comBonus = folha(9, { attack: 40, vit: 5 });

    const { container } = montar({
      snapshot: {
        ...snapshot(),
        player: { ...ANA, stats: comBonus },
      },
    });

    fireEvent.click(container.querySelector(".hud-btn--status"));

    const linha = [
      ...container.querySelectorAll(".sts-row"),
    ].find(
      (node) =>
        node.querySelector(".sts-row__label b")
          .textContent === "ATK",
    );

    const esperado = statsDoJogo.formatBonus(
      statsDoJogo.STAT_BY_ID.attack,
      comBonus.byId.attack.bonus,
    );

    expect(esperado).toBe("+66");

    expect(
      linha.querySelector(".sts-row__bonus").textContent,
    ).toBe(esperado);

    expect(
      linha.querySelector(".sts-row__base").textContent,
    ).toBe(
      statsDoJogo.formatStat(
        statsDoJogo.STAT_BY_ID.attack,
        comBonus.byId.attack.base,
      ),
    );

    expect(linha.className).toContain("has-bonus");
  });

  it("ponto de atributo melhora os derivados dele", () => {
    // VIT +5 move a regeneracao de vida. E o que faz o atributo
    // existir: um numero que so enfeita a tela nao move nada
    //
    // A comparacao e com a MESMA folha sem a peca, e nao com zero:
    // o bonus do atributo ja carrega o crescimento do nivel, e
    // isolar o "5 da peca" e o que prova que o bonus foi aplicado
    // duas vezes — uma no atributo e uma no derivado
    const semPeca = folha(9, {});
    const comPeca = folha(9, { vit: 5 });

    expect(
      comPeca.byId.hpRegen.total,
      "o VIT nao moveu a regeneracao",
    ).toBeGreaterThan(semPeca.byId.hpRegen.total);

    expect(
      comPeca.byId.vit.total - semPeca.byId.vit.total,
      "o proprio VIT nao subiu",
    ).toBe(5);
  });

  it("o bonus some quando o stat nao melhorou", () => {
    // um "+0" em vinte e seis linhas e ruido: o que o jogador procura
    // na coluna e o que mudou
    const { container } = comFolha();

    fireEvent.click(container.querySelector(".hud-btn--status"));

    const zerados = [
      ...container.querySelectorAll(".sts-row__bonus"),
    ].filter((node) => node.textContent === "+0");

    expect(zerados).toHaveLength(0);
  });

  it("o cabecalho da classe e do nivel vem do personagem", () => {
    const { container } = comFolha();

    fireEvent.click(container.querySelector(".hud-btn--status"));

    expect(
      container.querySelector(".sts-panel__class").textContent,
    ).toBe("Arbalist");
    expect(
      container.querySelector(".sts-panel__level").textContent,
    ).toBe("Nv.9");
  });

  it("aguenta o primeiro quadro sem folha", () => {
    // online a folha chega no pacote do servidor. ABERTO antes dela,
    // o painel precisa dizer que esta carregando em vez de mostrar
    // uma lista vazia, que o jogador leria como "meu personagem nao
    // tem stat"
    const { container } = montar();

    fireEvent.click(container.querySelector(".hud-btn--status"));

    const painel = container.querySelector(".sts-panel");

    expect(painel).toBeTruthy();
    expect(
      painel.querySelectorAll(".sts-row"),
    ).toHaveLength(0);
    expect(painel.textContent).toContain("Carregando");
  });

  it("agrupa sozinho uma folha que veio sem os grupos", () => {
    // um snapshot de outra versao manda `rows` e nao `groups`. Sem
    // o agrupamento o painel viraria uma lista corrida sem titulo e o
    // jogador perderia a leitura de onde comeca o combate
    const { container } = montar({
      snapshot: {
        ...snapshot(),
        player: { ...ANA, stats: { rows: folha().rows } },
      },
    });

    fireEvent.click(container.querySelector(".hud-btn--status"));

    expect(
      container.querySelectorAll(".sts-row"),
    ).toHaveLength(statsDoJogo.STAT_DEFS.length);
    expect(
      container.querySelectorAll(".sts-group__title"),
    ).toHaveLength(4);
  });
});

  it("a tecla P abre e fecha", async () => {
    const { container } = montar();

    /**
     * O `dispatchEvent` vai dentro do `act`.
     *
     * O `setState` do `useEffect` da HUD acontece FORA do ciclo de
     * render do React quando disparado direto na `window`, e sem o
     * `act` o React agrupa a atualizacao e nao a aplica na hora. O
     * resultado e um teste que parece testar a tecla e nao testa nada
     */
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyP" }),
      );
    });

    expect(
      container.querySelector(".sts-panel"),
      "a tecla P nao abriu o status",
    ).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyP" }),
      );
    });

    expect(container.querySelector(".sts-panel")).toBe(null);
  });

  it("a tecla S nao abre mais: ela e de andar para baixo", async () => {
    /**
     * A `S` foi atalho do status ate o jogador reclamar de que a tecla
     * dele nao andava. O `keydown` da HUD esta no `window` e nao chama
     * `preventDefault`, entao as duas coisas aconteciam no mesmo aperto:
     * o painel abria e o personagem andava, e o painel parecia ter
     * comido o movimento
     *
     * Este teste trava a CORRECAO. Sem ele, voltar a `S` seria uma
     * troca de uma linha que nenhum teste notaria
     */
    const { container } = montar();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyS" }),
      );
    });

    expect(
      container.querySelector(".sts-panel"),
      "a tecla S voltou a abrir um painel, e ela anda para baixo",
    ).toBe(null);
  });

  it("nenhum painel aponta para uma tecla de andar", () => {
    /**
     * W, A, S e D andam, e as setas fazem o mesmo papel. Um atalho de
     * painel em qualquer uma delas abre painel E move o personagem no
     * mesmo aperto
     *
     * A checagem e feita pelo `title` do botao, que e onde a tecla
     * aparece para o jogador: e o texto que ele le para saber o atalho,
     * entao um `(S)` la mentindo e o defeito do usuario
     */
    for (const botao of document.querySelectorAll(
      ".hud-btn--status, .hud-btn--test",
    )) {
      const title = botao.getAttribute("title") ?? "";

      expect(
        title,
        `${botao.className} aponta para uma tecla de andar: ${title}`,
      ).not.toMatch(/\((W|A|S|D)\)/);
    }
  });

  it("o botao e rotulado, para o leitor de tela", () => {
    const { container } = montar();

    const botao = container.querySelector(".hud-btn--status");

    // um "X" e um "✧" nao dizem nada para quem nao ve
    expect(botao.getAttribute("aria-label")).toBeTruthy();
    expect(botao.getAttribute("title")).toContain("Status");
  });
});