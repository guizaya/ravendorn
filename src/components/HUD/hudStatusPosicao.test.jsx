import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";

/**
 * Onde o botao de STATUS fica na tela.
 *
 * Este arquivo existe por uma razao especifica: a posicao do botao e
 * o requisito que o jogador pediu, e ela nao aparece em nenhum outro
 * lugar. Os demais testes de status provam que ele abre e fecha; este
 * prova ONDE ele esta
 *
 * Sem ele, mover o botao para dentro do `.hud-vitals` — o erro mais
 * obvio, e o que happenedaria em uma edicao futura de layout — deixaria
 * todos os outros testes verdes
 */
const CSS = readFileSync("src/styles.css", "utf8");

const html = renderToStaticMarkup(
  <HUD
    classDefinition={getCharacterDefinition("arbalist")}
    characterName="Ana"
    snapshot={{
      time: 0,
      autoPlay: false,
      engaged: false,
      player: {
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
      },
    }}
    engineRef={{ current: null }}
  />,
);

describe("a posicao do botao de status", () => {
  it("o botao nao esta dentro do bloco de vida", () => {
    const vitals = html.indexOf('<section class="hud-vitals">');
    const fechaVitals = html.indexOf("</section>", vitals);
    const status = html.indexOf("hud-btn--status");

    expect(vitals, "o bloco de vida sumiu").toBeGreaterThan(-1);
    expect(status, "o botao de status sumiu").toBeGreaterThan(-1);

    /**
     * O requisito, escrito.
     *
     * "Ao lado, e nao dentro" e sobre a ORDEM das duas caixas: o
     * botao vem DEPOIS do `<section>` que fecha o bloco de vida. Um
     * botao dentro renderiza igual — mesmo icone, mesma classe, mesmo
     * `title` — e so empurra o conteudo do bloco
     */
    expect(
      status,
      "o botao de status esta DENTRO do bloco de vida",
    ).toBeGreaterThan(fechaVitals);
  });

  it("o botao fica no canto superior esquerdo, perto do jogador", () => {
    /**
     * As regras do status sao DUAS, e o `top` esta em uma e o `left`
     * na outra — a que agrupa o status com o botao de teste.
     *
     * Ler so a primeira ocorrencia de `.hud-btn--status {` acha a do
     * `top`, que nao tem `left`, e o teste acusaria um `left` faltando
     * que existe. Por isso cada medida e procurada na regra que a
     * declara
     */
    const regras = [
      ...CSS.matchAll(
        /\.hud-btn--status[^{}]*\{([^}]*)\}/g,
      ),
    ].map((m) => m[1]);

    const doTop = regras.find((corpo) => corpo.includes("top:"));
    const doLeft = regras.find((corpo) => corpo.includes("left:"));

    // `top: 12px` e o mesmo do bloco de vida: ele se alinha com o
    // topo do nome e do level, e nao no meio da tela
    expect(doTop, "o status nao tem top").toBeTruthy();
    expect(doTop).toMatch(/top:\s*12px/);

    // e a esquerda e a do bloco mais a largura dele mais o vao
    expect(doLeft, "o status nao tem left").toBeTruthy();
    expect(doLeft).toMatch(/left:\s*calc\(/);
  });

  it("o botao nao esta na barra de abas da direita", () => {
    const menu = html.indexOf('<nav class="hud-menu">');
    const fechaMenu = html.indexOf("</nav>", menu);
    const status = html.indexOf("hud-btn--status");

    /**
     * O botao visualmente e identico ao do bestiario, entao a unica
     * diferenca entre "ao lado da vida" e "na barra" e ONDE o JSX
     * esta. Ele podia estar na barra e estar certo na aparencia
     */
    expect(
      status,
      "o botao de status foi parar na barra de abas",
    ).toBeLessThan(menu);

    expect(status).toBeGreaterThan(-1);
    expect(fechaMenu).toBeGreaterThan(menu);
  });
});