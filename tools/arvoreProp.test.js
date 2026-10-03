import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { inflatePng } from "./gif-to-sheet.mjs";
import { getPropType } from "../src/data/props/index.js";

/**
 * A arte da arvore do vale, reduzida de 1600x1600 para 96x119.
 *
 * O `tools/gerar-arvore-prop.mjs` faz a conta, e estes testes medem o
 * RESULTADO. Sao as tres coisas que dariam errado sem aparecer na
 * imagem: um halo escuro na borda da copa, um tronco que nao bate com o
 * collider, e a moldura transparente que sobraria se o recorte falhasse
 *
 * O halo merece um teste proprio porque e o erro classico de reduzir
 * PNG. A media de RGBA separados mistura o verde com o "nao ha nada
 * aqui" e escurece a borda. A Eye nao pega numa miniatura, mas na tela
 * a arvore ganha um contorno preto
 */
const ORIGEM = fileURLToPath(
  new URL("../src/assets/props/tree.png", import.meta.url),
);

const ARVORE = getPropType("arvore");

const destino = inflatePng(
  readFileSync(fileURLToPath(new URL(ARVORE.sheet))),
);

const origem = inflatePng(readFileSync(ORIGEM));

function caixa(png) {
  let minX = png.width;
  let maxX = -1;
  let minY = png.height;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (png.data[(y * png.width + x) * 4 + 3] === 0) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return { minX, maxX, minY, maxY };
}

/**
 * A largura VISUAL de uma linha: de onde a onde o desenho chega.
 *
 * Nao e a contagem de pixels opacos. A base do tronco tem pixels de
 * antialiasing com alpha baixo entre os cheios, e contar so os
 * opacos daria 18 em vez de 22 — e o collider do catalogo esta em 22
 * porque e o tronco que o olho ve que tem 22
 */
function vao(png, y) {
  let min = -1;
  let max = -1;

  for (let x = 0; x < png.width; x += 1) {
    if (png.data[(y * png.width + x) * 4 + 3] === 0) continue;

    if (min < 0) min = x;

    max = x;
  }

  return { min, max, largura: max < 0 ? 0 : max - min + 1 };
}

describe("a arvore do vale", () => {
  it("reduzida, e nao em 1600px", () => {
    expect(origem.width).toBe(1600);
    expect(origem.height).toBe(1600);

    expect(destino.width).toBe(ARVORE.frameWidth);
    expect(destino.height).toBe(ARVORE.frameHeight);

    expect(origem.width / destino.width).toBeGreaterThan(10);
  });

  it("cabe em uma tela, do tamanho que o catalogo manda", () => {
    // o motivo de ter reduzido: a arte original cobriria a viewport
    expect(ARVORE.drawWidth).toBeLessThan(1280);
    expect(ARVORE.drawHeight).toBeLessThan(720);
  });

  it("manda na tela no tamanho do arquivo", () => {
    /**
     * A arte ja foi reduzida para o tamanho do jogo, entao nao existe
     * o esticamento de 32px para 2x que os tipos antigos fazem. Se
     * alguém encolher a arte sem mexer aqui, a arvore entraria menor
     * que o arquivo
     */
    expect(ARVORE.drawWidth).toBe(destino.width);
    expect(ARVORE.drawHeight).toBe(destino.height);
  });

  it("guarda a proporcao do desenho original", () => {
    // o original e 1128x1400 dentro da moldura de 1600
    const razaoOriginal = 1400 / 1128;
    const razaoDerivada = destino.height / destino.width;

    expect(razaoDerivada).toBeCloseTo(razaoOriginal, 1);
  });

  it("nao sobrou moldura transparente", () => {
    /**
     * O recorte tem que ter comido a borda vazia. Se sobrar, a arvore
     * e desenhada com uma margem invisivel e o `radius: 46` nao
     * corresponde a copa — e a sombra sai no lugar errado
     *
     * E a CAIXA INTEIRA que tem de encostar nas quatro bordas, e nao a
     * primeira linha: o topo da copa e estreito e centrado, entao a
     * linha 0 comeca pelo meio da imagem e isso e o desenho, nao uma
     * sobra de margem
     */
    const c = caixa(destino);

    expect(c.minX).toBe(0);
    expect(c.maxX).toBe(destino.width - 1);
    expect(c.minY).toBe(0);
    expect(c.maxY).toBe(destino.height - 1);
  });

  it("a borda da copa nao escureceu", () => {
    /**
     * O teste do halo.
     *
     * A media de area com alpha pre-multiplicado mantem a cor ate a
     * ultima coluna. Sem o pre-multiplicar, a cor da borda cairia para
     * perto de zero — um contorno preto em volta de cada arvore
     */
    for (let y = 0; y < destino.height; y += 1) {
      for (const x of [0, destino.width - 1]) {
        const i = (y * destino.width + x) * 4;
        const alpha = destino.data[i + 3];

        // so importa onde tem pixel: a borda vazia e transparente por
        // definicao e a cor la e zero sem ser halo
        if (alpha === 0) continue;

        const brilho =
          destino.data[i] +
          destino.data[i + 1] +
          destino.data[i + 2];

        expect(
          brilho,
          `halo escuro em ${x},${y} (soma ${brilho})`,
        ).toBeGreaterThan(90);
      }
    }
  });

  it("o tronco bate com o collider", () => {
    /**
     * O collider do catalogo nao pode ser chute: tem que ser a largura
     * do tronco na arte que o jogo desenha
     *
     * A medida e a maior largura na base. O tronco afunila subindo, e
     * a ultima linha do arquivo e a mais irregular, entao pegar so a
     * ultima linha daria um numero instavel
     */
    let base = 0;

    for (let y = destino.height - 4; y < destino.height; y += 1) {
      base = Math.max(base, vao(destino, y).largura);
    }

    expect(base).toBe(ARVORE.collider * 2);

    // e o tronco fica no meio, senao a arvore pareceria torta
    const ultimo = vao(destino, destino.height - 1);
    const meio = destino.width / 2;

    expect(
      Math.abs((ultimo.min + ultimo.max) / 2 - meio),
    ).toBeLessThan(4);
  });

  it("a copa e bem mais larga que o tronco", () => {
    const copa = vao(destino, Math.round(destino.height * 0.37));

    expect(copa.largura).toBeGreaterThan(ARVORE.collider * 2 * 3);
  });

  it("o arquivo e leve", () => {
    /**
     * O original tem 1,6MB. Uma arvore de 96px nao pode pesar isso, ou
     * o carregamento do jogo paga por um enfeite
     */
    const bytes = readFileSync(
      fileURLToPath(new URL(ARVORE.sheet)),
    ).length;

    const original = readFileSync(ORIGEM).length;

    expect(bytes).toBeLessThan(60 * 1024);
    expect(bytes).toBeLessThan(original / 10);
  });

  it("o original continua intacto", () => {
    /**
     * O `tree.png` de 1600x1600 e a arte de quem desenhou. A
     * ferramenta escreve um arquivo derivado e nunca deve tocar no
     * original — se sobrescrevesse, a proxima rodada reduziria uma arte
     * ja reduzida
     */
    const derivado = fileURLToPath(new URL(ARVORE.sheet));

    expect(derivado).not.toBe(ORIGEM);
    expect(origem.width).toBe(1600);
  });
});