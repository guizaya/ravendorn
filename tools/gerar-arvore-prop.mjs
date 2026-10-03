import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inflatePng } from "./gif-to-sheet.mjs";
import { encodePng } from "./png.mjs";

/**
 * A ARVORE DO VALE.
 *
 * A arte de origem e um `tree.png` de 1600x1600 com 1,6MB: uma unica
 * arvore pintada, com 67% da moldura transparente em volta. O jogo
 * nao pode usar esse arquivo direto, por tres motivos:
 *
 * 1. **Escala.** O viewport e 1280x720 e as criaturas sao de 68px. Uma
 *    arvore de 1128px de largura cobriria a tela toda
 * 2. **Peso.** 1,6MB para um enfeite que ocupa 96px e um desperdicio
 *    que aparece no carregamento
 * 3. **Formato.** O `PropRenderer` le celulas de uma folha; esse
 *    arquivo e uma imagem solta, sem celula nenhuma
 *
 * Entao este script corta a moldura transparente e reduz. E o mesmo
 * caminho das folhas de sprite: o original nunca e sobrescrito, e o
 * jogo consome um arquivo derivado
 *
 *   node tools/gerar-arvore-prop.mjs [largura]
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const ORIGEM = resolve(HERE, "../src/assets/props/tree.png");
const DESTINO = resolve(HERE, "../src/assets/props/arvore.png");

const LARGURA_PADRAO = 96;

/** a caixa opaca da imagem, para cortar a moldura vazia */
function caixaOpaca(png) {
  const W = png.width;
  const H = png.height;

  let minX = W;
  let maxX = -1;
  let minY = H;
  let maxY = -1;

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const alpha = png.data[(y * W + x) * 4 + 3];

      if (alpha === 0) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Reduz por MEDIA DE AREA, em alpha pre-multiplicado.
 *
 * A media simples de RGBA separados da um halo escuro em volta da
 * copa: o pixel de borda e verde com alpha 255 e o de fora e
 * transparente, e a media "escurece" o verde ao vez de transparency-lo.
 * Pre-multiplicando antes, o pixel de fora entra como (0,0,0,0) e a
 * borda sai limpa
 *
 * E a media e de AREA, e nao um pixel sorteado: reduzir 1128 para 96
 * e um fator de 11,75, e amostrar em um unico ponto por pixel
 * destino perderia folha e criaria buracos na copa
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
    // a faixa da origem que este pixel destino representa
    const y0 = caixa.y + (dy * caixa.height) / alturaAlvo;
    const y1 = caixa.y + ((dy + 1) * caixa.height) / alturaAlvo;

    for (let dx = 0; dx < larguraAlvo; dx += 1) {
      const x0 = caixa.x + (dx * caixa.width) / larguraAlvo;
      const x1 = caixa.x + ((dx + 1) * caixa.width) / larguraAlvo;

      let somaR = 0;
      let somaG = 0;
      let somaB = 0;
      let somaA = 0;
      let n = 0;

      for (let sy = Math.floor(y0); sy < y1; sy += 1) {
        if (sy < 0 || sy >= png.height) continue;

        // a cobertura parcial do ultimo pixel da faixa: sem isso a
        // borda da imagem ganha uma linha mais clara ou mais escura
        const pesoY = Math.min(y1, sy + 1) - Math.max(y0, sy);

        if (pesoY <= 0) continue;

        for (let sx = Math.floor(x0); sx < x1; sx += 1) {
          if (sx < 0 || sx >= png.width) continue;

          const pesoX = Math.min(x1, sx + 1) - Math.max(x0, sx);

          if (pesoX <= 0) continue;

          const i = (sy * png.width + sx) * 4;
          const a = png.data[i + 3];
          const peso = pesoX * pesoY;

          somaR += png.data[i] * a * peso;
          somaG += png.data[i + 1] * a * peso;
          somaB += png.data[i + 2] * a * peso;
          somaA += a * peso;
          n += peso;
        }
      }

      const destino = (dy * larguraAlvo + dx) * 4;

      if (n === 0 || somaA === 0) {
        saida.data[destino + 3] = 0;
        continue;
      }

      // o canal so e transparente se a cobertura toda for opaca; uma
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

  console.log(
    `arvore gerada: ${reduzida.width}x${reduzida.height}\n`,
  );
  console.log(`  origem   ${png.width}x${png.height} (${(antes / 1024).toFixed(1)} KB)`);
  console.log(`  recorte  ${caixa.width}x${caixa.height} em ${caixa.x},${caixa.y} (a moldura transparente foi fora)`);
  console.log(`  destino  ${reduzida.width}x${reduzida.height} (${(depois / 1024).toFixed(1)} KB)`);
  console.log(`  reducao  ${(antes / depois).toFixed(0)}x mais leve`);
  console.log(`\n-> ${DESTINO}`);
}

main();