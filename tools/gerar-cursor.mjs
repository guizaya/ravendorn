import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { crc32 } from "./png.mjs";

/**
 * O CURSOR DO JOGO.
 *
 * ## POR QUE ESTE SCRIPT EXISTE
 *
 * O PNG de origem e um RGBA de 1254x1254, e um cursor de 1254px nao e um
 * cursor: ele cobriria a tela inteira e o arquivo de origem passaria de
 * 800KB para dentro do bundle
 *
 * O navegador aceita no maximo 128x128 num cursor de URL, e o quente e
 * 32 ou 64. O cursor foi reduzido para 64x64 e o hotspot foi calculado
 * pela caixa da arte, e nao chutado no canto
 *
 * ## A COR DE BAIXO ALFA
 *
 * O cursor precisa de alpha de verdade: um retangulo opaco em volta da
 * mao esconderia o bicho embaixo do ponteiro. Por isso o redutor
 * JOGA o pixel de fundo quase transparente em vez de so reamostrar
 */
const ORIGEM = "src/assets/cursor/cursor_armadura_final.png";
const DESTINO = "src/assets/cursor/cursor_armadura.png";
const LADO = 64;

/**
 * O ponto que fica NA PONTA do cursor.
 *
 * Medido pela caixa opaca da arte reduzida: na original ela ocupa de
 * x 421 a 846 e de y 393 a 899, que na escala de 64 vira x 21 a 43 e y
 * 20 a 45. A ponta do dedo e o canto superior ESQUERDO dessa caixa, e e
 * la que o hotspot tem de ficar — um hotspot chutado no centro faria o
 * jogador mirar 20px ao lado do que ele esta apontando
 */
const HOTSPOT = { x: 21, y: 20 };

/**
 * Lê um PNG e devolve os pixels em RGBA solto.
 *
 * Só o que o jogo usa: 8 bits, cor verdadeira, sem entrelacamento.
 * Um PNG indexado ou de 16 bits aqui daria pixels errados sem erro
 * nenhum, entao o formato e verificado em vez de assumido
 */
function lerPng(buf) {
  if (
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    throw new Error("nao e um PNG");
  }

  let i = 8;
  let largura = 0;
  let altura = 0;
  let profundidade = 0;
  let cor = 0;
  const idat = [];

  while (i < buf.length) {
    const tamanho =
      (buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3];

    const tipo = buf.toString("ascii", i + 4, i + 8);

    const dados = buf.subarray(i + 8, i + 8 + tamanho);

    if (tipo === "IHDR") {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      profundidade = dados[8];
      cor = dados[9];

      if (dados[12] !== 0) {
        throw new Error("PNG entrelacado: nao supportado");
      }
    } else if (tipo === "IDAT") {
      idat.push(dados);
    } else if (tipo === "IEND") {
      break;
    }

    i += 12 + tamanho;
  }

  if (profundidade !== 8) {
    throw new Error(`PNG de ${profundidade} bits: so 8 e suportado`);
  }

  // A cor 6 e RGBA, a 2 e RGB. A 3 e indexado, que tem paleta.
  const canais = cor === 6 ? 4 : cor === 2 ? 3 : 0;

  if (canais === 0) {
    throw new Error(`PNG de cor ${cor}: so RGB e RGBA sao suportados`);
  }

  const bruto = inflateSync(Buffer.concat(idat));

  const pixels = Buffer.alloc(largura * altura * 4);
  const passo = largura * canais;

  /**
   * O DESFILTRO de cada linha.
   *
   * PNG nao e um bitmap cru: cada linha comeca com um byte de filtro, e o
   * valor escolhe como a linha se refere a anterior. Sem desfazer isso, a
   * imagem sai com listras — e um cursor com listras parece um cursor
   * quebrado, nao um bug de leitura
   */
  for (let y = 0; y < altura; y += 1) {
    const filtro = bruto[y * (passo + 1)];
    const inicio = y * (passo + 1) + 1;

    for (let x = 0; x < passo; x += 1) {
      const valor = bruto[inicio + x];

      const a = x >= canais ? bruto[y * (passo + 1) + 1 + x - canais] : 0;
      const b = y > 0 ? bruto[(y - 1) * (passo + 1) + 1 + x] : 0;
      const c =
        x >= canais && y > 0
          ? bruto[(y - 1) * (passo + 1) + 1 + x - canais]
          : 0;

      let saida;

      if (filtro === 0) {
        saida = valor;
      } else if (filtro === 1) {
        saida = valor + a;
      } else if (filtro === 2) {
        saida = valor + b;
      } else if (filtro === 3) {
        saida = valor + ((a + b) >> 1);
      } else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);

        saida =
          valor + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else {
        throw new Error(`filtro de PNG desconhecido: ${filtro}`);
      }

      bruto[y * (passo + 1) + 1 + x] = saida & 0xff;
    }
  }

  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const de = (y * largura + x) * canais;
      const para = (y * largura + x) * 4;

      pixels[para] = bruto[y * (passo + 1) + 1 + x * canais];
      pixels[para + 1] = bruto[y * (passo + 1) + 1 + x * canais + 1];
      pixels[para + 2] = bruto[y * (passo + 1) + 1 + x * canais + 2];
      pixels[para + 3] =
        canais === 4 ? bruto[y * (passo + 1) + 1 + x * canais + 3] : 255;
    }
  }

  return { largura, altura, pixels };
}

/** A caixa opaca da arte, e o que define onde esta a ponta do cursor. */
function caixaOpaca({ largura, altura, pixels }, limite = 24) {
  let x0 = largura;
  let y0 = altura;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      if (pixels[(y * largura + x) * 4 + 3] <= limite) continue;

      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }

  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * A media de uma caixa, com o alpha pesado.
 *
 * A media simples borra a arte numa borda de meio pixel: o pixel de fora
 * tem alpha 0 e cor qualquer, e puxaria a cor para o preto. Pesar pelo
 * alpha so deixa as bordas de fora entrarem pouco
 */
function reduzir(para, { largura, altura, pixels }) {
  const saida = Buffer.alloc(LADO * LADO * 4);

  const passoX = largura / LADO;
  const passoY = altura / LADO;

  for (let dy = 0; dy < LADO; dy += 1) {
    for (let dx = 0; dx < LADO; dx += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let peso = 0;

      const xa = Math.floor(dx * passoX);
      const xb = Math.max(xa + 1, Math.floor((dx + 1) * passoX));
      const ya = Math.floor(dy * passoY);
      const yb = Math.max(ya + 1, Math.floor((dy + 1) * passoY));

      for (let y = ya; y < yb && y < altura; y += 1) {
        for (let x = xa; x < xb && x < largura; x += 1) {
          const i = (y * largura + x) * 4;

          const alpha = pixels[i + 3] / 255;

          r += pixels[i] * alpha;
          g += pixels[i + 1] * alpha;
          b += pixels[i + 2] * alpha;
          a += pixels[i + 3];
          peso += alpha;
        }
      }

      const o = (dy * LADO + dx) * 4;

      if (peso === 0) {
        saida[o] = 0;
        saida[o + 1] = 0;
        saida[o + 2] = 0;
        saida[o + 3] = 0;
        continue;
      }

      saida[o] = Math.round(r / peso);
      saida[o + 1] = Math.round(g / peso);
      saida[o + 2] = Math.round(b / peso);
      saida[o + 3] = Math.round(a / ((xb - xa) * (yb - ya)));
    }
  }

  return saida;
}

/** O PNG minimo: um IHDR e um IDAT com filtro zero. */
function escreverPng(pixels, largura, altura) {
  const passo = largura * 4 + 1;
  const bruto = Buffer.alloc(passo * altura);

  for (let y = 0; y < altura; y += 1) {
    bruto[y * passo] = 0;

    pixels.copy(
      bruto,
      y * passo + 1,
      y * largura * 4,
      (y + 1) * largura * 4,
    );
  }

  const idat = deflateSync(bruto, { level: 9 });

  const tipo = (nome) => Buffer.from(nome, "ascii");

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const bloco = (nome, dados) => {
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(dados.length, 0);

    const comNome = Buffer.concat([tipo(nome), dados]);

    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(comNome), 0);

    return Buffer.concat([tamanho, comNome, crc]);
  };

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", idat),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

const origem = lerPng(readFileSync(ORIGEM));

console.log(
  `origem: ${ORIGEM} ${origem.largura}x${origem.altura}`,
);

const caixa = caixaOpaca(origem);

if (caixa) {
  console.log(
    `caixa opaca: x ${caixa.x0}..${caixa.x1} | y ${caixa.y0}..${caixa.y1}`,
  );
}

const reduzido = reduzir(null, origem);

writeFileSync(DESTINO, escreverPng(reduzido, LADO, LADO));

console.log(
  `-> ${DESTINO} ${LADO}x${LADO} (hotspot ${HOTSPOT.x},${HOTSPOT.y})`,
);