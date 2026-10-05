import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inflatePng } from "./gif-to-sheet.mjs";
import { encodePng } from "./png.mjs";

/**
 * O ARBUSTO DA SEBE.
 *
 * ## POR QUE UM SEGUNDO GERADOR
 *
 * A arvore do vale tem `tools/gerar-arvore-prop.mjs`, que recorta a moldura
 * transparente e reduz. O arbusto precisa do EXATO mesmo recorte e da
 * EXATA mesma reamostragem — a arte e uma folha de 1254x1254 como a da
 * arvore, e o.visual so fica igual se as duas contas forem a mesma
 *
 * A unica diferenca e o arquivo: `arvore.png` para a arvore,
 * `arbusto.png` para o arbusto. Duplicar o gerador e o que mantem os dois
 * numeros compativeis quando um deles mudar; importar um gerador que
 * recebe o caminho forcaria cada chamada a repetir o destino
 *
 * ## POR QUE 96 E NAO 32
 *
 * A folha antiga de `props.png` e pixel art de 32px e o arbusto de la
 * serve para AREIA no chao. Esta sebe e uma BARREIRA: e grande o bastante
 * para o olho ler "isto e uma cerca" e pequeno o bastante para 96px de
 * largura ainda entrarem hundreds de vezes numa linha de 4756px
 */
const HERE = dirname(fileURLToPath(import.meta.url));

const ORIGEM = resolve(HERE, "../src/assets/props/arbusto.png");
const DESTINO = resolve(HERE, "../src/assets/props/arbusto_prop.png");

const LARGURA_PADRAO = 96;

/**
 * A caixa do que e realmente visivel.
 *
 * A origem e 1254x1254 com a arte no meio e o resto transparente. Sem o
 * corte, a reducao encolheria a arte para um terco do tamanho e o arbusto
 * sairia do tamanho de uma pedra
 */
function caixaOpaca(png) {
  const W = png.width;
  const H = png.height;

  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const alpha = png.data[(y * W + x) * 4 + 3];

      if (alpha <= 8) continue;

      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }

  return {
    x: x0,
    y: y0,
    width: x1 - x0 + 1,
    height: y1 - y0 + 1,
  };
}

/**
 * A arte reduzida para `larguraAlvo` de largura.
 *
 * A media e ponderada pelo ALPHA, e nao uma media crua. O pixel de fora da
 * borda tem alpha 0 e uma cor qualquer: numa media simples ele entraria
 * com o mesmo peso dos pixels de dentro e puxaria a borda para o preto.
 * O arbusto ficaria com um contorno escuro em volta de cada folha
 */
function reduzir(png, caixa, larguraAlvo) {
  const escala = larguraAlvo / caixa.width;
  const alturaAlvo = Math.max(
    1,
    Math.round(caixa.height * escala),
  );

  const saida = {
    width: larguraAlvo,
    height: alturaAlvo,
    data: new Uint8Array(larguraAlvo * alturaAlvo * 4),
  };

  for (let dy = 0; dy < alturaAlvo; dy += 1) {
    // a faixa da origem que este pixel de destino representa
    const y0 = caixa.y + (dy * caixa.height) / alturaAlvo;
    const y1 = caixa.y + ((dy + 1) * caixa.height) / alturaAlvo;

    for (let dx = 0; dx < larguraAlvo; dx += 1) {
      const xa = caixa.x + (dx * caixa.width) / larguraAlvo;
      const xb = caixa.x + ((dx + 1) * caixa.width) / larguraAlvo;

      let somaR = 0;
      let somaG = 0;
      let somaB = 0;
      let somaA = 0;
      let n = 0;

      const sy0 = Math.floor(y0);
      const sy1 = Math.max(sy0 + 1, Math.ceil(y1));
      const sx0 = Math.floor(xa);
      const sx1 = Math.max(sx0 + 1, Math.ceil(xb));

      for (let sy = sy0; sy < sy1; sy += 1) {
        for (let sx = sx0; sx < sx1; sx += 1) {
          const i = (sy * png.width + sx) * 4;
          const a = png.data[i + 3];

          // a COBERTURA parcial do pixel de destino. Sem isto a borda da
          // imagem ganha uma linha mais clara ou mais escura
          const pesoY = Math.min(y1, sy + 1) - Math.max(y0, sy);
          const pesoX = Math.min(xb, sx + 1) - Math.max(xa, sx);

          /**
           * O `a` NA MULTIPLICACAO DO RGB, e nao so no alfa.
           *
           * E o que faz a divisao ao final dar a media ponderada pelo
           * ALPHA. As duas somas precisam estar na mesma unidade:
           *
           *   somaR = soma(rgb * a * peso)     <- premultiplicado
           *   somaA = soma(     a * peso)
           *   rgb   = somaR / somaA            <- a media ponderada
           *
           * Sem o `a` no RGB, a divisao vira `soma(r * peso) / soma(a *
           * peso)`, que NAO e media nenhuma: com alfa alto e uniforme
           * (arbusto opaco, alfa 250) o resultado da 46/250, arredonda
           * para 0, e a imagem inteira sai PRETA com o alfa perfeito
           *
           * A arvore faz a mesma conta e por isso aparece certa: as duas
           * somas tem que pesado igual
           */
          const peso = pesoX * pesoY;

          somaR += png.data[i] * a * peso;
          somaG += png.data[i + 1] * a * peso;
          somaB += png.data[i + 2] * a * peso;
          somaA += a * peso;
          n += peso;
        }
      }

      const destino = (dy * larguraAlvo + dx) * 4;

      /**
       * O `somaA === 0` e separado do `n === 0` porque sao coisas
       * diferentes: `n` e o peso total da faixa e `somaA` e o alfa
       * acumulado. Uma faixa pode ter peso e nenhum alfa — uma borda
       * totalmente transparente — e nela a divisao daria `0/0`
       */
      if (n === 0 || somaA === 0) {
        saida.data[destino + 3] = 0;
        continue;
      }

      // e o canal so fica transparente se a cobertura toda for opaca; uma
      // cobertura parcial mantem o alpha proporcional
      const alpha = somaA / n;

      saida.data[destino] = Math.round(somaR / somaA);
      saida.data[destino + 1] = Math.round(somaG / somaA);
      saida.data[destino + 2] = Math.round(somaB / somaA);
      saida.data[destino + 3] = Math.round(alpha);
    }
  }

  return saida;
}

function main() {
  const largura = Number(process.argv[2]) || LARGURA_PADRAO;

  const original = readFileSync(ORIGEM);
  const png = inflatePng(original);

  const caixa = caixaOpaca(png);
  const reduzida = reduzir(png, caixa, largura);

  writeFileSync(
    DESTINO,
    encodePng(reduzida.data, reduzida.width, reduzida.height),
  );

  const antes = original.length;
  const depois = readFileSync(DESTINO).length;

  console.log(`arbusto gerado: ${reduzida.width}x${reduzida.height}\n`);
  console.log(
    `  origem   ${png.width}x${png.height} (${(antes / 1024).toFixed(1)} KB)`,
  );
  console.log(
    `  recorte  ${caixa.width}x${caixa.height} em ${caixa.x},${caixa.y} (a moldura transparente foi fora)`,
  );
  console.log(
    `  destino  ${reduzida.width}x${reduzida.height} (${(depois / 1024).toFixed(1)} KB)`,
  );
  console.log(`  reducao  ${(antes / depois).toFixed(0)}x mais leve`);
  console.log(`\n-> ${DESTINO}`);
}

main();