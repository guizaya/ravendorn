import { readFileSync } from "node:fs";
import { inflatePng } from "./gif-to-sheet.mjs";

/**
 * MEDE A ARTE DA FLECHA: onde o desenho realmente esta dentro do quadro.
 *
 * ## POR QUE MEDIR E NAO CHUTAR
 *
 * O `hit.gif` tem 256x120, e a celula tem margem TRANSPARENTE em volta da
 * arte. Se eu dimensionar pelo tamanho da celula, a flecha aparece menor do
 * que a arte e a folga vira tamanho morto. Se eu dimensionar pela arte, a
 * margem some e a flecha bate com o tiro antigo
 *
 * E o que este script responde: a caixa de pixels visiveis de cada quadro,
 * e a escala que leva o comprimento visivel ate o do tiro vetorial
 */

const FOLHA = "src/assets/sprites/arbalist-flecha-sheet.png";

const png = inflatePng(readFileSync(FOLHA));

const { width, height, data } = png;

const LARGURA_CELULA = 256;
const ALTURA_CELULA = 120;
const QUADROS = 8;

console.log("folha: " + width + "x" + height + "  (" + QUADROS + " quadros)");

for (let q = 0; q < QUADROS; q++) {
  const origemX = q * LARGURA_CELULA;

  let minX = LARGURA_CELULA;
  let maxX = -1;
  let minY = ALTURA_CELULA;
  let maxY = -1;

  for (let y = 0; y < ALTURA_CELULA; y++) {
    for (let x = 0; x < LARGURA_CELULA; x++) {
      const a = data[(y * width + origemX + x) * 4 + 3];

      if (a < 8) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  console.log(
    "  quadro " + q +
    "  visivel=" + w + "x" + h +
    "  x=[" + minX + ".." + maxX + "]" +
    "  y=[" + minY + ".." + maxY + "]" +
    "  centro=(" + ((minX + maxX) / 2).toFixed(1) + ", " + ((minY + maxY) / 2).toFixed(1) + ")",
  );
}

/**
 * O TIRO VETORIAL, medido pelo codigo que o desenha.
 *
 * A haste vai de x=-13 ate x=+9 (`fillRect(-13, ..., 22, 4)`), e a ponta vai
 * de x=1 ate x=10. O extent total e de -13 ate +10, ou seja, **23px** de
 * comprimento, centrado no ponto do projetil
 */
const COMPRIMENTO_ANTIGO = 23;

const larguraVisivelMaxima = 256;

console.log("");
console.log("comprimento do tiro vetorial: " + COMPRIMENTO_ANTIGO + "px");
console.log("largura visivel da arte:      " + larguraVisivelMaxima + "px");
console.log("escala necessaria:           " + (COMPRIMENTO_ANTIGO / larguraVisivelMaxima).toFixed(4));