import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inflatePng } from "./gif-to-sheet.mjs";
import { encodePng } from "./png.mjs";

/**
 * Os ARQUIVOS DERIVADOS DOS PORTAIS.
 *
 * Os dois portais do vale sao PNG de 1600x1600 e quase 2,5MB cada. O
 * jogo nao pode usar nenhum dos dois direto, por dois motivos:
 *
 * 1. **Peso.** Sao quase 5MB juntos, e sao DOIS objetos
 * 2. **Escala.** Com o viewport em 1280x720, um portal de 1451px
 *    cobriria a tela inteira
 *
 * Entao este script corta a moldura transparente e reduz. Como as duas
 * artes sao PNG, a conta roda aqui, no build, e os arquivos de 1600px NAO
 * entram no bundle
 *
 * Diferente da grama e da arvore — que sao JPEG, e o projeto nao tem
 * decodificador de JPEG — aqui nao ha por que reduzir em tempo de
 * carregamento
 *
 *   node tools/gerar-portal.mjs [origem] [saida] [lado]
 *
 * Sem argumento, reduz `portal_1.png` para `portal_base.png`
 */
const HERE = dirname(fileURLToPath(import.meta.url));

const PASTA = resolve(HERE, "../src/assets/portais");

const LADO_PADRAO = 192;

/**
 * O `portal_base.png` nao e um nome qualquer: e a arte BASE, a que foi
 * reduzida do `portal_1.png`. O segundo portal tem arte propria e
 * precisa do seu proprio arquivo reduzido
 */
const PARES = [
  {
    origem: "portal_1.png",
    destino: "portal_base.png",
  },
  {
    origem: "portal_2.png",
    destino: "portal_2_base.png",
  },
];

/**
 * CORTA O FUNDO PINTADO, POR INUNDACAO A PARTIR DA BORDA.
 *
 * O `base.png` e RGB sem canal alpha: o "fundo" da arte nao e
 * transparencia, e pixels de verdade. Um quase branco com ruido, do
 * tipo que sai de gerador de imagem
 *
 * Um LIMIAR POR BRILHO nao serviria. O portal e cinza-claro e o
 * vortice tem nuvens brancas dentro do aro, entao qualquer corte por
 * "quanto e claro" abriria buracos na arte — o defeito mais feio que
 * existe nesse arquivo, porque o buraco fica no meio da imagem
 *
 * O que separa o fundo do desenho e a CONECTIVIDADE, e nao o brilho: o
 * fundo esta em volta do aro e encostado nas bordas da imagem, e o aro
 * de pedra e um anel fechado. Entao a inundacao comeca nas bordas e so
 * alcanca o que estiver ligado a elas
 *
 * O branco dentro do anel nao e alcançado: ele nao tem caminho ate a
 * borda. E por isso que a diferenca entre "contorno a partir da borda" e
 * "contorno por brilho" nao e preciosismo — e o que segura a arte
 *
 *   floodFill(   png,          // a imagem, mutada no lugar
 *                brilhoMin,    // descarta o que e escuro demais
 *                tolerancia,    // quanto de ruido se aceita
 *              )
 */
function floodFill(
  png,
  brilhoMin = 218,
  tolerancia = 26,
) {
  const { width: W, height: H, data } = png;

  const alpha = (x, y) => (y * W + x) * 4 + 3;

  /** o pixel e claro E quase cinza? */
  const eFundo = (x, y) => {
    const i = (y * W + x) * 4;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // o ruido do fundo e pequeno: os canais ficam juntos
    const dif = Math.max(r, g, b) - Math.min(r, g, b);

    if (dif > tolerancia) return false;

    return (r + g + b) / 3 >= brilhoMin;
  };

  const visita = new Uint8Array(W * H);

  // uma pilha explicita: 1254x1254 de recursao estoura a call stack
  const pilha = [];

  const semear = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;

    const p = y * W + x;

    if (visita[p]) return;

    visita[p] = 1;

    if (!eFundo(x, y)) return;

    data[alpha(x, y)] = 0;
    pilha.push(p);
  };

  for (let x = 0; x < W; x += 1) {
    semear(x, 0);
    semear(x, H - 1);
  }

  for (let y = 0; y < H; y += 1) {
    semear(0, y);
    semear(W - 1, y);
  }

  let removidos = 0;

  while (pilha.length > 0) {
    const p = pilha.pop();

    const x = p % W;
    const y = (p - x) / W;

    removidos += 1;

    semear(x + 1, y);
    semear(x - 1, y);
    semear(x, y + 1);
    semear(x, y - 1);
  }

  return removidos;
}

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
      if (png.data[(y * W + x) * 4 + 3] === 0) continue;

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
 * Reduz por MEDIA DE AREA, em alpha pre-multiplicado, e POR METADES.
 *
 * Sao tres coisas que aparecem no resultado:
 *
 * - **alpha pre-multiplicado.** A media de RGBA separados mistura o azul
 *   do vortice com o "nao ha nada aqui" e escurece a borda. Um portal
 *   tem um halo preto na borda do aro, que e o defeito classico de
 *   reduzir PNG com alpha
 * - **media de AREA, e nao amostragem.** Cair de 1451 para 192 e um
 *   fator de 7,5: pegar um ponto por pixel de destino perderia o
 *   desenho do aro e abriria buracos
 * - **Por METADES.** Em vez de um salto de 7,5, o caminho e
 *   1600 -> 800 -> 400 -> 200 -> 192. Cada degrau e um fator de 2, que
 *   a media de area resolve bem, e so o ultimo passo e de 200 para 192
 */
function reduzir(png, caixa, lado) {
  const saida = {
    width: lado,
    height: lado,
    data: new Uint8Array(lado * lado * 4),
  };

  let fonte = png;
  let origem = caixa;

  const total = lado * lado;

  // cada degrau intermediario: metade do lado, pela media de area
  let atual = lado;

  while (atual > lado * 2) {
    const proximo = Math.max(lado, Math.round(atual / 2));

    const degrau = {
      width: proximo,
      height: proximo,
      data: new Uint8Array(proximo * proximo * 4),
    };

    mediaArea(fonte, origem, degrau, 0, 0, proximo);

    fonte = degrau;
    origem = { x: 0, y: 0, width: proximo, height: proximo };
    atual = proximo;
  }

  // o degrau final e pequeno: um salto so, com area
  mediaArea(fonte, origem, saida, 0, 0, lado);

  if (saida.data.length !== total * 4) {
    throw new Error("saida com tamanho errado");
  }

  return saida;
}

/** um degrau: media de area com cobertura parcial nas bordas */
function mediaArea(fonte, caixa, destino, destinoX, destinoY, lado) {
  const escalaX = caixa.width / lado;
  const escalaY = caixa.height / lado;

  for (let dy = 0; dy < lado; dy += 1) {
    const y0 = caixa.y + dy * escalaY;
    const y1 = caixa.y + (dy + 1) * escalaY;

    for (let dx = 0; dx < lado; dx += 1) {
      const x0 = caixa.x + dx * escalaX;
      const x1 = caixa.x + (dx + 1) * escalaX;

      let somaR = 0;
      let somaG = 0;
      let somaB = 0;
      let somaA = 0;
      let peso = 0;

      for (let sy = Math.floor(y0); sy < y1; sy += 1) {
        if (sy < 0 || sy >= fonte.height) continue;

        // a cobertura parcial da ultima linha da faixa: sem isso a
        // borda ganha uma linha mais clara ou mais escura
        const pesoY = Math.min(y1, sy + 1) - Math.max(y0, sy);

        if (pesoY <= 0) continue;

        for (let sx = Math.floor(x0); sx < x1; sx += 1) {
          if (sx < 0 || sx >= fonte.width) continue;

          const pesoX = Math.min(x1, sx + 1) - Math.max(x0, sx);

          if (pesoX <= 0) continue;

          const i = (sy * fonte.width + sx) * 4;
          const a = fonte.data[i + 3];
          const w = pesoX * pesoY;

          // pre-multiplicado: o pixel transparente entra como (0,0,0,0)
          somaR += fonte.data[i] * a * w;
          somaG += fonte.data[i + 1] * a * w;
          somaB += fonte.data[i + 2] * a * w;
          somaA += a * w;
          peso += w;
        }
      }

      const destinoIndex =
        ((destinoY + dy) * destino.width +
          (destinoX + dx)) *
        4;

      if (peso === 0 || somaA === 0) {
        destino.data[destinoIndex + 3] = 0;
        continue;
      }

      destino.data[destinoIndex] = Math.round(somaR / somaA);
      destino.data[destinoIndex + 1] = Math.round(
        somaG / somaA,
      );
      destino.data[destinoIndex + 2] = Math.round(
        somaB / somaA,
      );
      destino.data[destinoIndex + 3] = Math.round(somaA / peso);
    }
  }
}

function gerar(origem, destino, lado, cortaFundo = false) {
  const bytesOriginais = readFileSync(origem);

  const png = inflatePng(bytesOriginais);

  let cortados = 0;

  if (cortaFundo) {
    cortados = floodFill(png);
  }

  const caixa = caixaOpaca(png);

  const reduzida = reduzir(png, caixa, lado);

  writeFileSync(
    destino,
    encodePng(reduzida.data, reduzida.width, reduzida.height),
  );

  const depois = readFileSync(destino);

  console.log(
    `${destino.replace(`${HERE}\\..\\`, "")}: ${reduzida.width}x${reduzida.height}\n`,
  );
  console.log(
    `  origem   ${png.width}x${png.height} (${(bytesOriginais.length / 1024).toFixed(1)} KB)`,
  );

  if (cortaFundo) {
    console.log(
      `  fundo    ${cortados} px viraram transparente (inundacao a partir da borda)`,
    );
  }

  console.log(
    `  recorte  ${caixa.width}x${caixa.height} em ${caixa.x},${caixa.y}`,
  );
  console.log(
    `  destino  ${reduzida.width}x${reduzida.height} (${(depois.length / 1024).toFixed(1)} KB)`,
  );
  console.log(
    `  reducao  ${(bytesOriginais.length / depois.length).toFixed(0)}x mais leve\n`,
  );

  return depois.length;
}

function main() {
  const [argOrigem, argDestino, argLado] =
    process.argv.slice(2);

  const lado = Number(argLado) || LADO_PADRAO;

  // um par especifico, ou todos os declarados
  if (argOrigem && argDestino) {
    gerar(
      resolve(PASTA, argOrigem),
      resolve(PASTA, argDestino),
      lado,
      argOrigem === "base.png",
    );

    return;
  }

  for (const par of PARES) {
    const origem = resolve(PASTA, par.origem);

    if (!existsSync(origem)) {
      console.log(
        `${par.origem}: nao existe, pulando\n`,
      );
      continue;
    }

    gerar(origem, resolve(PASTA, par.destino), lado);
  }
}

main();