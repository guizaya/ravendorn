import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { decodeGif } from "./gif-to-sheet.mjs";
import { encodePng } from "./png.mjs";

/**
 * GERA A FOLHA DO PROJETIL BASICO DO SORCERER.
 *
 * ## O QUE ESTE GIF E
 *
 * Uma faixa de VFX de voo em laco, nao um sprite de personagem. Sao 122x25 por
 * quadro, com a esfera e o rastro de faiscas atravessando o quadro da esquerda
 * para a direita: a cabeca vai de x=30,5 no primeiro quadro a x=109,5 no
 * ultimo, em passos de ~11,3px — uma reta quase perfeita
 *
 * ## POR QUE UM SCRIPT NOVO E NAO O `gif-to-sheet.mjs`
 *
 * Porque aquela ferramenta monta folha DIRECIONAL: oito pastas, uma por
 * direcao, na grade quadrada de 96px do boneco. O tiro nao e direcional — e uma
 * faixa so, apontando para a direita, e quem gira e o `atan2` do projetil
 *
 * ## POR QUE A FOLHA E UM PNG E NAO O GIF
 *
 * Porque o jogo desenha em `<canvas>` com `drawImage`. Um GIF animado dentro de
 * uma textura do canvas tocaria sozinho, fora do relogio do jogo e fora do
 * `projectile.age` que decide qual quadro existe
 */

const ORIGEM = "src/assets/sprites/sorcerer/attack_animations/basic_attack.gif";
const DESTINO = "src/assets/sprites/sorcerer-projetil-sheet.png";

const gif = decodeGif(readFileSync(ORIGEM));

console.log(
  "gif: " + gif.width + "x" + gif.height + "  quadros: " + gif.frames.length,
);

/* um quadro truncado entraria na folha e deixaria lixo na celula */
const quebrados = gif.frames.filter((frame) => !frame.complete);

if (quebrados.length > 0) {
  throw new Error(quebrados.length + " quadro(s) truncado(s) no gif");
}

const LARGURA = gif.width;
const ALTURA = gif.height;

/* a folha e uma linha: o eixo X e o TEMPO nesta animacao */
const larguraFolha = LARGURA * gif.frames.length;

console.log("folha: " + larguraFolha + "x" + ALTURA);

/* quantos quadros distintos existem, para o log dizer a verdade */
const distintos = new Set(
  gif.frames.map((f) => createHash("md5").update(f.rgba).digest("hex")),
).size;

console.log("quadros distintos: " + distintos + " de " + gif.frames.length);

/**
 * A CABECA EM CADA QUADRO.
 *
 * E o que o motor usa para prender a esfera no ponto do projetil enquanto o
 * rastro pulsa atras. Sem isso a esfera passearia de um lado a outro do
 * projetil — ela ocupa de x=30,5 a x=109,5 dentro de uma celula de 122, e
 * ancorar no centro da celula a faria andar ~45px para um lado e para o outro
 *
 * A deteccao e por ALTURA de coluna: a cabeca e alta (~16px) e o rastro e fino
 * (~5px), entao as colunas "gordas" sao a cabeca
 */
const ancoras = [];

for (const frame of gif.frames) {
  const altura = new Array(LARGURA).fill(0);

  for (let x = 0; x < LARGURA; x++) {
    let cima = -1;
    let baixo = -1;

    for (let y = 0; y < ALTURA; y++) {
      if (frame.rgba[(y * LARGURA + x) * 4 + 3] > 20) {
        if (cima < 0) cima = y;
        baixo = y;
      }
    }

    altura[x] = cima < 0 ? 0 : baixo - cima + 1;
  }

  const gordas = [];

  for (let x = 0; x < LARGURA; x++) {
    if (altura[x] >= 10) gordas.push(x);
  }

  if (gordas.length === 0) {
    throw new Error("nenhuma coluna alta o bastante para achar a cabeca");
  }

  const cabecaX0 = gordas[0];
  const cabecaX1 = gordas[gordas.length - 1];

  let y0 = Number.POSITIVE_INFINITY;
  let y1 = -1;

  for (let x = cabecaX0; x <= cabecaX1; x++) {
    for (let y = 0; y < ALTURA; y++) {
      if (frame.rgba[(y * LARGURA + x) * 4 + 3] > 20) {
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  ancoras.push([
    Number(((cabecaX0 + cabecaX1) / 2).toFixed(2)),
    Number(((y0 + y1) / 2).toFixed(2)),
  ]);

  console.log(
    "  quadro " +
      (ancoras.length - 1) +
      ": cabeca x " +
      cabecaX0 +
      ".." +
      cabecaX1 +
      "  y " +
      y0 +
      ".." +
      y1,
  );
}

const pixels = Buffer.alloc(larguraFolha * ALTURA * 4, 0);

gif.frames.forEach((frame, indice) => {
  const origemX = indice * LARGURA;

  /* `rgba` e o campo do decodeGif, e `data` nao existe */
  for (let y = 0; y < ALTURA; y++) {
    for (let x = 0; x < LARGURA; x++) {
      const de = (y * LARGURA + x) * 4;
      const para = y * larguraFolha * 4 + origemX * 4 + x * 4;

      pixels[para] = frame.rgba[de];
      pixels[para + 1] = frame.rgba[de + 1];
      pixels[para + 2] = frame.rgba[de + 2];
      pixels[para + 3] = frame.rgba[de + 3];
    }
  }
});

writeFileSync(DESTINO, encodePng(pixels, larguraFolha, ALTURA), "utf8");

const duracao = gif.frames.reduce((t, f) => t + (f.delay ?? 0), 0) / 100;

console.log("");
console.log("gerada: " + DESTINO);
console.log("  " + gif.frames.length + " quadros de " + LARGURA + "x" + ALTURA);
console.log("  duracao: " + duracao.toFixed(2) + "s");
console.log("  fps natural: " + (gif.frames.length / duracao).toFixed(2));
console.log("  ancoras: " + JSON.stringify(ancoras));