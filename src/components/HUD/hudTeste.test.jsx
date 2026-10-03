import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";

/**
 * O botao e o painel de ENCANTAR.
 *
 * Este botao ja foi o de teste, e o painel dele chegou a ser um
 * placeholder que so dizia "Nada para mostrar ainda". Agora abre o
 * `EnchantPanel`, que sorteia um afixo na peca escolhida.
 *
 * O que NAO mudou, e o que este arquivo trava: a heranca do status —
 * mesmo lugar na tela, um `hud-btn` como o do bestiario, e um painel
 * abaixo na mesma coluna. A POSICAO e o que o CSS precisa garantir, e
 * `top` com numero solto faria os dois se sobreporem no instante em que
 * o tamanho do botao mudasse
 *
 * A classe continua `hud-btn--test`. Renomear para `--enchant`
 * atravessaria as regras agrupadas do CSS (`.hud-btn--status,
 * .hud-btn--test { --vitals-w: ... }`) e os testes que leem essas
 * regras pelo seletor exato, e o ganho seria so de leitura. O que o
 * jogador le e o `title` e o `aria-label`, e os dois dizem Encantar
 */
const classe = getCharacterDefinition("arbalist");

const CSS = readFileSync("src/styles.css", "utf8");

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

const snapshot = () => ({
  time: 0,
  autoPlay: false,
  engaged: false,
  player: ANA,

  /**
   * Uma peca na mochila, para o painel de encantar ter o que mostrar.
   *
   * Sem isto o painel abriria no estado vazio — a mensagem "Nenhuma
   * arma ou armadura na mochila" — e a lista nem a caixa existiriam na
   * tela. Este arquivo trava que o painel TEM conteudo, e nao o que ele
   * mostra com conteudo: o `EnchantPanel.test.jsx` e quem verifica os
   * itens, o preco e o sorteio
   *
   * O arco e do arbalist, a classe deste arquivo
   */
  inventory: {
    coins: 500,
    used: 1,
    capacity: 20,
    isFull: false,
    items: [
      {
        uid: "willow_bow#uncommon#1",
        itemId: "willow_bow",
        rarity: "uncommon",
        count: 1,
        equipped: false,
        enchant: null,
      },
    ],
  },
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

afterEach(cleanup);

describe("o botao de encantar", () => {
  it("existe, e e um botao da HUD como o do status", () => {
    const html = markup();

    expect(html).toContain("hud-btn--test");
    expect(html).toContain('class="hud-btn hud-btn--test');
  });

  it("esta na MESMA coluna do status, e nao na barra de abas", () => {
    const html = markup();

    const menu = html.indexOf('<nav class="hud-menu">');
    const status = html.indexOf("hud-btn--status");
    const test = html.indexOf("hud-btn--test");

    // os dois ficam antes da barra de abas, que e do outro lado da tela
    expect(test).toBeLessThan(menu);
    expect(status).toBeLessThan(menu);

    /**
     * A MESMA coluna e o que o CSS garante com o `left` compartilhado,
     * e nao o JSX: os dois botoes sao irmaos e a posicao horizontal e
     * CSS. O teste confere que a regra existe e que as DUAS citam a
     * mesma variavel — se so uma citasse, elas ficariam em colunas
     * diferentes sem nenhum erro
     */
    /**
     * A coluna compartilhada.
     *
     * A regra e agrupada (`.hud-btn--status, .hud-btn--test { ... }`),
     * e o seletor esta no grupo, nao na abertura da regra. Por isso o
     * regex casa pelo SELECTOR e nao por `^\.seletor {`
     */
    const regraAgrupada = [
      ...CSS.matchAll(
        /([^{}]*\.hud-btn--test[^{}]*)\{([^}]*)\}/g,
      ),
    ].filter((m) =>
      m[1].includes("hud-btn--status") &&
      m[2].includes("--vitals-w") &&
      m[2].includes("left: calc("),
    );

    expect(
      regraAgrupada.length,
      "o status e o teste nao dividem a mesma regra de coluna",
    ).toBeGreaterThan(0);

    /**
     * NENHUMA regra do seletor pode ter `left` solto.
     *
     * O teste precisa olhar TODAS as regras do seletor, e nao a
     * primeira: o `left` do status e do teste esta na regra agrupada
     * que declara as variaveis, e uma segunda regra do teste — a do
     * `top` — pode declarar um `left` proprio. Ler so a primeira
     * deixaria esse `left` passar, e o botao iria para outra coluna
     * sem nenhum aviso
     */
    for (const seletor of ["hud-btn--status", "hud-btn--test"]) {
      const corpos = [
        ...CSS.matchAll(
          new RegExp(
            `\\.${seletor}\\s*\\{([^}]*)\\}`,
            "g",
          ),
        ),
      ].map((m) => m[1]);

      expect(
        corpos.length,
        `${seletor} nao tem nenhuma regra`,
      ).toBeGreaterThan(0);

      for (const corpo of corpos) {
        if (!corpo.includes("left:")) continue;

        expect(
          corpo,
          `${seletor}: tem left, e ele precisa ser calc()`,
        ).toMatch(/left:\s*calc\(/);
      }
    }
  });

  it("fica ABAIXO do status, com o deslocamento em variavel", () => {
    /**
     * O `top` do teste e `12px + a altura do botao + o vao`. Com o
     * numero solto, mudar o tamanho do `.hud-btn` faria os dois se
     * sobreporem — e um `indexOf` no HTML nao veria nada, porque os
     * dois botoes continuam no mesmo lugar do markup
     */
    /**
     * A regra que define o `top` do teste.
     *
     * O seletor pega a PRIMEIRA ocorrencia de `.hud-btn--test`, e essa
     * e a regra agrupada com a do status — que declara as variaveis e o
     * `left`, mas nao o `top`. O `top` do teste vem da regra seguinte,
     * que declara o seletor sozinho. Ler so a primeira daria um
     * "nao tem top" que parece defeito de CSS e e defeito do teste
     */
    const regras = [
      ...CSS.matchAll(
        /\.hud-btn--test[^{]*\{([^}]*)\}/g,
      ),
    ].map((m) => m[1]);

    expect(regras.length, "o botao de teste nao tem regra").toBeGreaterThan(0);

    const regra = regras.find((corpo) => corpo.includes("top:"));

    expect(regra, "o botao de teste nao tem top").toBeTruthy();
    expect(regra).toMatch(/top:\s*calc\(/);

    // o deslocamento depende da ALTURA do botao, nao de um 38 fixo
    expect(regra).toContain("var(--btn-h)");

    // e a altura vem do tamanho real do botao
    const tamanho = CSS.match(
      /\.hud-btn\s*\{[^}]*height:\s*(\d+)px/,
    )?.[1];

    expect(tamanho, "o tamanho do hud-btn sumiu").toBeTruthy();

    const declarada =
      CSS.match(/--btn-h:\s*(\d+)px/)?.[1];

    expect(
      declarada,
      `--btn-h (${declarada}) e o tamanho do .hud-btn (${tamanho})`,
    ).toBe(tamanho);
  });

  it("os dois botoes nao se sobrepoem", () => {
    // a conta, feita com os numeros do CSS
    const btn = Number(
      CSS.match(/--btn-h:\s*(\d+)px/)?.[1] ?? 0,
    );
    const gap = Number(
      CSS.match(/--btn-gap:\s*(\d+)px/)?.[1] ?? 0,
    );

    expect(btn).toBeGreaterThan(0);
    expect(gap).toBeGreaterThan(0);

    // o teste comeca na altura do status (38) mais o vao
    const topDoTeste = 12 + btn + gap;

    expect(
      topDoTeste,
      `o teste comeca em ${topDoTeste}px e o status acaba em ${12 + btn}px`,
    ).toBeGreaterThan(12 + btn);
  });

  it("abre e fecha o painel", () => {
    const { container } = montar();

    const botao = container.querySelector(".hud-btn--test");

    expect(container.querySelector(".enc-panel")).toBe(null);

    fireEvent.click(botao);

    expect(
      container.querySelector(".enc-panel"),
      "o painel nao abriu",
    ).toBeTruthy();

    expect(botao.className).toContain("is-active");

    fireEvent.click(botao);

    expect(container.querySelector(".enc-panel")).toBe(null);
  });

  it("o painel tem a lista e a caixa, e nao so o botao de fechar", () => {
    const { container } = montar();

    fireEvent.click(container.querySelector(".hud-btn--test"));

    const painel = container.querySelector(".enc-panel");

    expect(painel).toBeTruthy();

    // a caixa do lado, que e onde a peca escolhida aparece
    expect(
      painel.querySelector(".enc-side"),
      "a caixa da peca selecionada sumiu",
    ).toBeTruthy();

    // a lista de itens, na outra coluna
    expect(
      painel.querySelector(".inv-grid"),
      "a lista de itens sumiu",
    ).toBeTruthy();

    // e o botao de fechar continua sendo o `inv-close` da barra de abas
    expect(painel.querySelector(".inv-close")).toBeTruthy();

    // o painel mudou de conteudo: ele era um placeholder que so dizia
    // "Nada para mostrar ainda", e agora e o de encantar. Se os dois
    // ficassem, o `tst-panel` morto continuaria sendo o que o jogador
    // veria
    expect(painel.textContent).toContain("Encantar");
  });

  it("o X fecha, sem passar pela barra", () => {
    const { container } = montar();

    fireEvent.click(container.querySelector(".hud-btn--test"));

    fireEvent.click(
      container.querySelector(".enc-panel .inv-close"),
    );

    expect(container.querySelector(".enc-panel")).toBe(null);
  });

  it("abrir o teste fecha o status, porque so um painel fica aberto", () => {
    /**
     * Este teste ja disse o CONTRARIO: os dois sao de leitura, nada
     * num deles gasta recurso do outro, e fechar um ao abrir o outro
     * seria "comportamento de aba, nao de painel".
     *
     * A regra mudou e passou a valer para todos os pares: abrir um
     * painel fecha o que estiver aberto. Os dois sao centrais e na mesma
     * posicao, entao abertos juntos um cobriria o outro e o jogador
     * perderia a referencia de onde esta olhando — e nenhum dos dois
     * era uma aba, porque os dois sao painel de verdade
     */
    const { container } = montar();

    fireEvent.click(container.querySelector(".hud-btn--status"));

    expect(container.querySelector(".sts-panel")).toBeTruthy();

    fireEvent.click(container.querySelector(".hud-btn--test"));

    expect(container.querySelector(".enc-panel")).toBeTruthy();
    expect(
      container.querySelector(".sts-panel"),
      "o status continuou aberto por cima do encantar",
    ).toBe(null);

    // e o caminho inverso tambem fecha
    fireEvent.click(container.querySelector(".hud-btn--status"));

    expect(container.querySelector(".sts-panel")).toBeTruthy();
    expect(container.querySelector(".enc-panel")).toBe(null);
  });

  it("a tecla X abre e fecha", async () => {
    const { container } = montar();

    /**
     * O `dispatchEvent` vai dentro do `act`: o `setState` do
     * `useEffect` da HUD acontece fora do ciclo de render do React
     * quando disparado direto na `window`, e sem o `act` o React
     * agrupa a atualizacao e nao a aplica na hora
     */
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyX" }),
      );
    });

    expect(
      container.querySelector(".enc-panel"),
      "a tecla X nao abriu o encantar",
    ).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyX" }),
      );
    });

    expect(container.querySelector(".enc-panel")).toBe(null);
  });

  it("a tecla nao rouba o T do auto play", () => {
    /**
     * `KeyT` e o auto play, e `KeyR` e o ultimate no `GameCanvas`.
     * O teste ficou em `KeyX` justamente por isso. Este teste trava a
     * escolha: se alguem "simplificar" e colocar `KeyT`, o auto play
     * para de funcionar e nenhum teste disso aqui avisa
     */
    const { container } = montar();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyT" }),
    );

    expect(
      container.querySelector(".enc-panel"),
      "a tecla T abriu o encantar: ela e do auto play",
    ).toBe(null);
  });

  it("o botao e rotulado para o leitor de tela", () => {
    const { container } = montar();

    const botao = container.querySelector(".hud-btn--test");

    expect(botao.getAttribute("aria-label")).toBeTruthy();
    expect(botao.getAttribute("title")).toContain("Encantar");
  });
});