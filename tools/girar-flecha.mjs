import { readFileSync, writeFileSync } from "node:fs";
import { inflatePng } from "./gif-to-sheet.mjs";
import { encodePng } from "./png.mjs";

/**
 * A FLECHA ISOLADA, DEITADA PARA A DIREITA.
 *
 * ## POR QUE GIRAR
 *
 * A `flecha_isolada.png` vem deitada de pe: 70x295, com a ponta em cima e as
 * penas embaixo. O motor gira o projetil com `atan2(vy, vx)`, o que so
 * funciona se a arte ja aponta para a DIREITA — sem o giro, a flecha voaria
 * de cabeca para baixo quando o tiro fosse para a direita
 *
 * ## POR QUE UM QUADRO SO
 *
 * Porque e um PNG. A animacao de 8 quadros vivia no GIF, com o rastro
 * crescendo; este arquivo e a flecha limpa, sem rastro. Ela substitui a arte
 * e NAO a animacao — ver a nota sobre `frames` em `data/sprites/index.js`
 */

const ORIGEM = "src/assets/sprites/new_arbalist_2/hit_basic/flecha_isolada.png";
const DESTINO = "src/assets/sprites/arbalist-flecha.png";

const png = inflatePng(readFileSync(ORIGEM));

console.log("origem: " + png.width + "x" + png.height);

/**
 * 90 GRAUS NO SENTIDO HORARIO.
 *
 * Com a arte de pe, a ponta fica em cima. Girando no sentido horario, o topo
 * vai para a direita — que e onde o motor espera a direcao do tiro
 */
const largura = png.height;
const altura = png.width;

const pixels = Buffer.alloc(largura * altura * 4, 0);

for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const de = (y * png.width + x) * 4;

    /**
     * HORARIO: o topo vai para a direita.
     *
     * `dest_x = png.height - 1 - src_y` e `dest_y = src_x`.
     *
     * A primeira versao deste script usou a `altura` de SAIDA no lugar da
     * `png.height` de ENTRADA, e girou ao contrario: com a arte de 70x295,
     * `70 - 1 - y` nunca passava de 69 e a ponta da flecha — que esta em
     * `y = 0` — caia na esquerda em vez da direita. O motor aponta a arte
     * para a direita, entao a seta apontaria para tras
     */
    const para = (x * largura + (png.height - 1 - y)) * 4;

    pixels[para] = png.data[de];
    pixels[para + 1] = png.data[de + 1];
    pixels[para + 2] = png.data[de + 2];
    pixels[para + 3] = png.data[de + 3];
  }
}

writeFileSync(DESTINO, encodePng(pixels, largura, altura), "utf8");

/* a mesma medicao do `medir-flecha.mjs`, agora na arte girada */
let minX = largura;
let maxX = -1;
let minY = altura;
let maxY = -1;

for (let y = 0; y < altura; y++) {
  for (let x = 0; x < largura; x++) {
    if (pixels[(y * largura + x) * 4 + 3] < 8) continue;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

console.log("destino: " + largura + "x" + altura);
console.log("  visivel: " + (maxX - minX + 1) + " x " + (maxY - minY + 1));
console.log("  x=[" + minX + ".." + maxX + "]  y=[" + minY + ".." + maxY + "]");
console.log("  centro visivel: (" + ((minX + maxX) / 2).toFixed(1) + ", " + ((minY + maxY) / 2).toFixed(1) + ")");

/** o tiro vetorial media 23px; a arte visivel agora mede isto */
const visivel = maxX - minX + 1;

console.log("");
console.log("escala para o tiro de 23px: " + (23 / visivel).toFixed(4));