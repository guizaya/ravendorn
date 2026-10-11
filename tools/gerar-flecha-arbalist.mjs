import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { decodeGif } from "./gif-to-sheet.mjs";
import { encodePng } from "./png.mjs";

/**
 * GERA A FOLHA DA FLECHA DO ARBALIST.
 *
 * ## POR QUE UM SCRIPT NOVO E NAO O `gif-to-sheet.mjs`
 *
 * Porque aquela ferramenta monta folha DIRECIONAL: oito pastas, uma por
 * direcao, com a grade quadrada de 84px que o arquiro usa. A flecha do
 * `hit_basic` nao e direcional nenhuma — e uma imagem so, apontando para a
 * direita, que o motor espelha quando o tiro vai para a esquerda
 *
 * ## POR QUE A FOLHA E UM PNG E NAO O GIF
 *
 * Porque o jogo desenha em `<canvas>` com `drawImage`, e nao em `<img>`. Um
 * GIF animado dentro de uma textura do canvas tocaria sozinho, fora do relogio
 * do jogo e fora do `attackAnimation` que decide quando a seta existe.
 * Convertido em folha, cada quadro sai pelo mesmo `resolveFrame` que ja rege
 * o resto da arte do jogo
 *
 * ## OS 8 QUADROS, E NAO 4
 *
 * A primeira versao deste script leu os quadros com um parser proprio e contou
 * **4**. O `decodeGif` deste mesmo projeto conta **8**, todos com `complete:
 * true` e todos com hash diferente. O parser proprio estava errado e foi
 * descartado — `decodeGif` e a ferramenta testada do projeto, e nao vale a pena
 * manter duas leituras de GIF
 */

const ORIGEM = "src/assets/sprites/new_arbalist_2/hit_basic/hit.gif";
const DESTINO = "src/assets/sprites/arbalist-flecha-sheet.png";

const gif = decodeGif(readFileSync(ORIGEM));

console.log("gif: " + gif.width + "x" + gif.height + "  quadros: " + gif.frames.length);

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