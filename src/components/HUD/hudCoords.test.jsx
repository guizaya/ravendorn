import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";

/**
 * A POSICAO NO MAPA, no canto esquerdo em fonte vermelha.
 *
 * O pedido tem duas partes que nao aparecem em nenhum outro lugar do
 * HUD: que o numero esteja na COLUNA DA ESQUERDA, e que a fonte seja
 * VERMELHA. Nenhum outro teste do HUD mede cor nem posicao de um texto
 *
 * Sem este arquivo, trocar a cor para o branco ou mover o mostrador para
 * a barra da direita deixaria os outros 162 testes verdes
 */

const CSS = readFileSync("src/styles.css", "utf8");

function montar(playerExtra = {}) {
  return renderToStaticMarkup(
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
          ...playerExtra,
        },
      }}
      engineRef={{ current: null }}
    />,
  );
}

/** a regra que declara o estilo do mostrador, e nao qualquer outra */
function regraCoords() {
  const Encontradas = [
    ...CSS.matchAll(/\.hud-coords[^{}]*\{([^}]*)\}/g),
  ].map((m) => m[1]);

  return Encontradas[0];
}

describe("o mostrador de posicao", () => {
  it("mostra o X e o Y do jogador", () => {
    const html = montar({ x: 3000, y: 2100 });

    expect(html).toContain("hud-coords");
    expect(html).toContain("X 3000");
    expect(html).toContain("Y 2100");
  });

  it("some quando o painel nao tem coordenada", () => {
    /**
     * O painel pode chegar antes do primeiro `snapshot` com posicao.
     * Mostrar "X undefined" e pior do que nao mostrar nada
     */
    expect(montar()).not.toContain("hud-coords");
    expect(montar({ x: NaN, y: 2100 })).not.toContain("hud-coords");
    expect(montar({ x: 3000, y: Infinity })).not.toContain(
      "hud-coords",
    );
  });

  it("fica na coluna da esquerda", () => {
    /**
     * "Ao lado do mapa" e sobre a ORDEM das duas caixas: o mostrador vem
     * DENTRO do `<section class="hud-vitals">`, que e o bloco ancorado
     * em `left: 12px`
     *
     * Um mostrador visualmente identico fora do bloco passaria em um
     * teste que so procurasse a classe — e ele passaria a depender de um
     * `top` com numero magico para nao cobrir o card
     */
    const vitals = montar({ x: 3000, y: 2100 });

    const abre = vitals.indexOf('<section class="hud-vitals">');
    const fecha = vitals.indexOf("</section>", abre);
    const coords = vitals.indexOf("hud-coords");

    expect(abre, "o bloco de vida sumiu").toBeGreaterThan(-1);
    expect(coords, "o mostrador sumiu").toBeGreaterThan(-1);

    expect(
      coords,
      "o mostrador saiu da coluna da esquerda",
    ).toBeGreaterThan(abre);

    expect(coords).toBeLessThan(fecha);
  });

  it("nao esta na barra de abas da direita", () => {
    const html = montar({ x: 3000, y: 2100 });

    const menu = html.indexOf('<nav class="hud-menu">');
    const coords = html.indexOf("hud-coords");

    expect(menu).toBeGreaterThan(-1);
    expect(coords).toBeLessThan(menu);
  });

  it("a fonte e vermelha", () => {
    const regra = regraCoords();

    expect(regra, "a regra .hud-coords sumiu").toBeTruthy();

    const cor = regra.match(/color:\s*([^;]+);/);

    expect(cor, "a regra nao declara cor").toBeTruthy();

    const r = parseInt(cor[1].trim().slice(1, 3), 16);
    const g = parseInt(cor[1].trim().slice(3, 5), 16);
    const b = parseInt(cor[1].trim().slice(5, 7), 16);

    /**
     * Vermelho de verdade, e nao uma cor quente qualquer.
     *
     * O canal do vermelho precisa dominating os outros dois. Uma cor
     * como #ffc857, que o jogo usa para o ouro, passa em "e quente" e
     * reprova aqui
     */
    expect(r, `cor ${cor[1].trim()} nao e vermelha`).toBeGreaterThan(
      g + 30,
    );
    expect(r).toBeGreaterThan(b + 30);
  });

  it("a regra nao esta presa numa media query", () => {
    /**
     * Um detalhe que aconteceu de verdade: a regra foi escrita ao lado
     * de um `display: none` que era de uma media query de tela estreita,
     * e ficou dentro dela. O mostrador aparecia so embaixo de 560px e
     * sumia no resto
     */
    const pos = CSS.indexOf(".hud-coords {");

    expect(pos, "a regra sumiu").toBeGreaterThan(-1);

    const re = /@media[^{]*\{/g;
    let dentro = null;
    let m;

    while ((m = re.exec(CSS)) !== null) {
      let nivel = 1;
      let k = m.index + m[0].length;

      for (; k < CSS.length; k += 1) {
        if (CSS[k] === "{") nivel += 1;
        else if (CSS[k] === "}") {
          nivel -= 1;
          if (nivel === 0) break;
        }
      }

      if (pos > m.index && pos < k) {
        dentro = m[0].trim().replace(/\s+/g, " ");
      }
    }

    expect(
      dentro,
      `a regra esta dentro de ${dentro}`,
    ).toBe(null);
  });

  it("os digitos tem largura fixa, para o numero nao tremer", () => {
    /**
     * A posicao muda varias vezes por segundo. Com a fonte de largura
     * variavel, `X 3001` virando `X 3012` troca o `1` por `2` e a linha
     * inteira anda para o lado a cada quadro
     */
    const regra = regraCoords();

    expect(regra).toMatch(
      /font-variant-numeric:\s*tabular-nums/,
    );
  });

  it("acompanha o tamanho das outras linhas de numero do HUD", () => {
    /**
     * O escudo e a linha de vida usam 9px com peso 800. Se o
     * mostrador usasse outro tamanho, ele nao pareceria parte do card
     */
    const regra = regraCoords();

    expect(regra).toMatch(/font-size:\s*9px/);
    expect(regra).toMatch(/font-weight:\s*800/);
  });

  it("e um `output`, que e o elemento de um valor", () => {
    /**
     * `output` e o elemento semantico de um valor que a tela mostra, e
     * e o que faz um leitor de tela anunciar a mudanca sem interromper
     * quem esta jogando
     */
    expect(montar({ x: 3000, y: 2100 })).toContain(
      "<output",
    );
  });

  it("usa o separador de ponto, e nao virgula", () => {
    const html = montar({ x: 3000, y: 2100 });

    expect(html).toContain("·");
    expect(html).toContain("X 3000 · Y 2100");
  });
});