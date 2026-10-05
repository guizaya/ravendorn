import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

/**
 * O icone da POCAO DE CURA, nas cinco raridades.
 *
 * Mesma forma do `gerar-icone-guild.mjs`: um PNG desenhado por codigo,
 * com encoder proprio de `zlib`. A razao e a mesma — os icones de item
 * existentes (arco, capuz, bota) foram feitos fora do projeto e nao ha
 * arte de pocao; um arquivo gerado tem o mesmo formato e o mesmo
 * tamanho dos outros, entao o slot do inventario nao fica com a borda
 * torta
 *
 * ## O TAMANHO
 *
 * 1254x1254, e nao os 1600 dos icones da HUD. E o tamanho dos ITENS,
 * e o `icons.test.js` trava que as cinco artes de um item tem a mesma
 * dimensao entre si — nao que casem com os icones da barra
 *
 * ## A ORDEM DE DESENHO
 *
 * A ordem importa mais do que a forma, e ela e:
 *
 *   vidro -> liquido -> superficie -> contorno -> tampa -> brilho
 *
 * O`tampa` vem DEPOIS do contorno de proposito: desenhada antes, o
 * contorno do gargalo passava por cima dela e rabiscava um X escuro
 * no gargalo. O brilho vem por ultimo porque e a unica coisa que
 * Should estar acima do vidro E do liquido
 *
 * ## A FORMA
 *
 * Um frasco com gargalo, ombro largo e base arredondada. E a silhueta
 * que se le a 68px dentro de um slot de inventario: um escudo ou uma
 * espada pequena demais se perde na mochila, e um frasco tem o contorno
 * mais largo que cabe na leitura
 */

const LADO = 1254;

const AQUI = dirname(fileURLToPath(import.meta.url));

/** RGBA com canal alpha de verdade, e nao RGB chapado */
const px = Buffer.alloc(LADO * LADO * 4);

const definir = (x, y, r, g, b, a) => {
  if (x < 0 || y < 0 || x >= LADO || y >= LADO) return;

  const i = (y * LADO + x) * 4;

  px[i] = Math.max(0, Math.min(255, Math.round(r)));
  px[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
  px[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  px[i + 3] = Math.max(0, Math.min(255, Math.round(a)));
};

const pegar = (x, y) => {
  if (x < 0 || y < 0 || x >= LADO || y >= LADO) return [0, 0, 0, 0];

  const i = (y * LADO + x) * 4;

  return [px[i], px[i + 1], px[i + 2], px[i + 3]];
};

/**
 * Pinta por cima, com o canal alpha de verdade.
 *
 * A composicao e `resultado = novo * a_novo + velho * (1 - a_novo)`.
 * A primeira versao deste gerador pesava o vidro em 92% e a cor nova
 * em 8%, e o liquido vermelho da pocao saia quase branco — um vidro
 * rosa palido, que e o oposto de pocao
 */
const sobrepor = (x, y, r, g, b, a) => {
  if (a <= 0) return;

  const [dr, dg, db, da] = pegar(x, y);

  const ka = a / 255;

  const restante = 1 - ka;

  definir(
    x,
    y,
    r * ka + dr * restante,
    g * ka + dg * restante,
    b * ka + db * restante,
    Math.max(da, a),
  );
};

/** o mesmo CRC32 do formato PNG */
const CRC_TABELA = (() => {
  const tabela = new Int32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    tabela[n] = c;
  }

  return tabela;
})();

const crc32 = (buffer) => {
  let c = 0xffffffff;

  for (const byte of buffer) {
    c = CRC_TABELA[(c ^ byte) & 0xff] ^ (c >>> 8);
  }

  return (c ^ 0xffffffff) >>> 0;
};

function pedaco(tipo, dados) {
  const comprimento = Buffer.alloc(4);
  comprimento.writeUInt32BE(dados.length, 0);

  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo), 0);

  return Buffer.concat([comprimento, corpo, crc]);
}

function escreverPng(destino) {
  const ihdr = Buffer.alloc(13);

  ihdr.writeUInt32BE(LADO, 0);
  ihdr.writeUInt32BE(LADO, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const cru = Buffer.alloc(LADO * (LADO * 4 + 1));

  for (let y = 0; y < LADO; y += 1) {
    const base = y * (LADO * 4 + 1);

    cru[base] = 0;

    px.copy(cru, base + 1, y * LADO * 4, (y + 1) * LADO * 4);
  }

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco("IHDR", ihdr),
    pedaco("IDAT", deflateSync(cru, { level: 9 })),
    pedaco("IEND", Buffer.alloc(0)),
  ]);

  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, png);

  return png.length;
}

/**
 * A geometria do frasco, em fracao do lado.
 *
 * Fica no modulo e nao dentro da funcao porque e a MESMA nas cinco
 * raridades, e porque o desenho precisa dela em quatro momentos
 * diferentes — vidro, liquido, contorno e tampa
 */
const FORMA = {
  gargaloA: 0.072, // meia largura do gargalo
  gargaloL: 0.105, // meia LARGURA da tampa
  gargaloTopo: 0.255, // onde o gargalo comeca
  ombro: 0.46, // onde a bochecha chega na largura maxima
  bochechaA: 0.25, // meia largura maxima do corpo
  base: 0.86, // onde o corpo acaba
  curvaBase: 0.26, // altura do arredondamento de baixo
  linha: 0.017, // espessura do contorno
};

/** a transicao que comeca e termina com derivada zero */
const suave = (t) => t * t * (3 - 2 * t);

/**
 * A MEIA LARGURA do corpo nesta altura.
 *
 * Tres trechos, e a emenda entre eles e o que decide se a peca parece
 * pocao ou lampada:
 *
 * - o gargalo e reto;
 * - a abertura usa `suave`, que entra e sai com derivada zero. Com
 *   interpolacao linear a curva chegava no ombro com angulo, e a
 *   silhueta ganhava um "voo" horizontal — as asas de uma lampada;
 * - o fundo e um arco verdadeiro, fechando em `sqrt(0)`
 *
 * Nao ha barra de base desenhada a parte. A versao anterior tinha uma,
 * e ela ficava mais larga que o corpo e criava um degrau embaixo; o
 * arco ja fecha a peca sozinho
 */
function meiaEm(fy) {
  if (fy < FORMA.ombro) {
    const t = (fy - FORMA.gargaloTopo) / (FORMA.ombro - FORMA.gargaloTopo);

    return FORMA.gargaloA + (FORMA.bochechaA - FORMA.gargaloA) * suave(t);
  }

  const t = (fy - (FORMA.base - FORMA.curvaBase)) / FORMA.curvaBase;

  return FORMA.bochechaA * Math.sqrt(Math.max(0, 1 - t * t));
}

/**
 * QUANTO o frasco enche, por raridade.
 *
 * E a unica diferenca de "quanto" entre as cinco, e o olho le "esta e
 * mais forte" antes de qualquer numero. O lendario enche mais; a base
 * deixa um palmo de vidro vazio no gargalo, que e o que diz que ainda
 * ha pocao a caminho
 */
const ENCHIMENTO = {
  comum: 0.5,
  incomun: 0.57,
  rare: 0.64,
  epic: 0.71,
  legendary: 0.78,
};

/**
 * As cores de cada raridade: vidro, liquido e tampa.
 *
 * O liquido e vermelho em todas, porque a pocao FAZ a mesma coisa em
 * todas as raridades — e o que muda e o quanto. O vidro e a tampa ficam
 * mais ricos com a raridade, e e o que faz o olho notar que o icone e
 * outro antes de o jogador ler o texto
 */
const CORES = {
  comum: {
    vidro: [206, 214, 222, 200],
    liquido: [214, 62, 58, 255],
    tampa: [168, 178, 188, 255],
  },
  incomun: {
    vidro: [198, 224, 210, 210],
    liquido: [222, 68, 88, 255],
    tampa: [110, 190, 150, 255],
  },
  rare: {
    vidro: [192, 210, 244, 216],
    liquido: [96, 162, 244, 255],
    tampa: [88, 146, 240, 255],
  },
  epic: {
    vidro: [222, 194, 246, 218],
    liquido: [180, 100, 244, 255],
    tampa: [162, 86, 232, 255],
  },
  legendary: {
    vidro: [250, 224, 156, 226],
    liquido: [252, 198, 56, 255],
    tampa: [255, 212, 98, 255],
  },
};

const centro = LADO / 2;

function gerar(raridade, destino) {
  px.fill(0);

  const cor = CORES[raridade];

  const contorno = LADO * FORMA.linha;

  const topoCorpo = FORMA.gargaloTopo * LADO;
  const baseCorpo = FORMA.base * LADO;

  /** a faixa horizontal ocupada pelo corpo, linha a linha */
  const faixa = (y) => {
    const meia = meiaEm(y / LADO) * LADO;

    return {
      esquerda: Math.round(centro - meia),
      direita: Math.round(centro + meia),
    };
  };

  // 1. o VIDRO, translucido
  for (let y = Math.floor(topoCorpo); y < baseCorpo; y += 1) {
    const { esquerda, direita } = faixa(y);

    for (let x = esquerda; x <= direita; x += 1) {
      sobrepor(x, y, cor.vidro[0], cor.vidro[1], cor.vidro[2], cor.vidro[3]);
    }
  }

  // 2. o LIQUIDO, com o nivel desta raridade
  const nivel = baseCorpo - (baseCorpo - topoCorpo) * (1 - ENCHIMENTO[raridade]);

  const nivelArredondado = Math.round(
    baseCorpo - (baseCorpo - topoCorpo) * (1 - ENCHIMENTO[raridade]),
  );

  void nivel;

  for (let y = nivelArredondado; y < baseCorpo; y += 1) {
    const { esquerda, direita } = faixa(y);

    // um pouquinho para dentro da parede, para nao vazar pela borda
    const margem = Math.round(contorno);

    for (let x = esquerda + margem; x <= direita - margem; x += 1) {
      sobrepor(x, y, cor.liquido[0], cor.liquido[1], cor.liquido[2], cor.liquido[3]);
    }
  }

  // 3. a SUPERFICIE do liquido, uma linha mais clara
  {
    const { esquerda, direita } = faixa(nivelArredondado);

    const margem = Math.round(contorno);

    for (let x = esquerda + margem; x <= direita - margem; x += 1) {
      sobrepor(x, nivelArredondado, 255, 255, 255, 110);
    }
  }

  // 4. o CONTORNO, uma faixa escura sobre a borda da silhueta
  const borda = [46, 40, 34];

  for (let y = Math.floor(topoCorpo); y <= Math.ceil(baseCorpo); y += 1) {
    const meia = meiaEm(y / LADO) * LADO;

    for (
      let x = Math.round(centro - meia - contorno);
      x <= Math.round(centro + meia + contorno);
      x += 1
    ) {
      const fx = Math.abs(x - centro);

      // dentro, na borda ou logo fora
      if (fx > meia + contorno) continue;

      if (fx > meia - contorno) {
        sobrepor(x, y, borda[0], borda[1], borda[2], 255);
      }
    }
  }

  // o gargalo fecha a silhueta por cima
  for (let x = Math.round(centro - FORMA.gargaloL * LADO); x <= Math.round(centro + FORMA.gargaloL * LADO); x += 1) {
    for (let k = 0; k <= contorno; k += 1) {
      sobrepor(x, Math.floor(topoCorpo - contorno) + k, borda[0], borda[1], borda[2], 255);
    }
  }

  /**
   * A base NAO e desenhada a parte.
   *
   * O arco de `meiaEm` ja fecha a peca em `sqrt(0)`, entao uma barra
   * extra embaixo e sempre mais larga que a ultima linha util — e
   * aparecia como um degrau, com a peca montada num apoio
   */

  /**
   * 5. a TAMPA, DEPOIS do contorno.
   *
   * Antes, o contorno do gargalo passava por cima dela e rabiscava um
   * X escuro no pescoço. Desenhada por ultimo, ela cobre o rabisco e
   * fica limpa — e e a unica peca da arte que nao precisa de borda
   * propria, porque ela e a borda
   */
  const tampaAlto = Math.round(topoCorpo - 0.052 * LADO);
  const tampaBaixo = Math.round(topoCorpo + 0.014 * LADO);

  for (
    let x = Math.round(centro - FORMA.gargaloL * LADO);
    x <= Math.round(centro + FORMA.gargaloL * LADO);
    x += 1
  ) {
    for (let y = tampaAlto; y < tampaBaixo; y += 1) {
      sobrepor(x, y, cor.tampa[0], cor.tampa[1], cor.tampa[2], cor.tampa[3]);
    }
  }

  // a sombra da tampa, uma faixa escura na parte de baixo dela
  for (
    let x = Math.round(centro - FORMA.gargaloL * LADO);
    x <= Math.round(centro + FORMA.gargaloL * LADO);
    x += 1
  ) {
    for (let k = 0; k <= Math.round(LADO * 0.008); k += 1) {
      sobrepor(x, tampaBaixo - 1 + k, borda[0], borda[1], borda[2], 200);
    }
  }

  /**
   * 6. o BRILHO do vidro, no fim de tudo.
   *
   * E o que faz o icone parecer vidro e nao "um retangulo colorido".
   * Sem ela o frasco vira uma mancha, e nao da para ler como pocao.
   *
   * A faixa e uma curva que acompanha a ombro, e nao um retangulo
   * solto: um retangulo aparecia como um pingo branco no meio da
   * bochecha
   */
  for (let y = Math.round(LADO * 0.46); y < Math.round(LADO * 0.72); y += 1) {
    const t = (y / LADO - 0.46) / 0.26;

    const meia = meiaEm(y / LADO) * LADO;

    const x0 = Math.round(centro - meia * 0.62);
    const x1 = Math.round(centro - meia * 0.44);

    for (let x = x0; x <= x1; x += 1) {
      // as pontas somem, para a faixa ter forma de meia lua
      const ponta = Math.sin(t * Math.PI);

      sobrepor(x, y, 255, 255, 255, Math.round(150 * ponta));
    }
  }

  const bytes = escreverPng(destino);

  console.log(
    `  ${raridade.padEnd(10)} ${LADO}x${LADO}  ` +
      `${(bytes / 1024).toFixed(0)} KB  ` +
      `enchimento ${(ENCHIMENTO[raridade] * 100).toFixed(0)}%`,
  );
}

console.log("\nicones da pocao de cura:");

for (const raridade of Object.keys(CORES)) {
  gerar(
    raridade,
    `${AQUI}/../src/assets/Items/pocao_cura/${raridade}.png`,
  );
}

console.log(
  `\n-> src/assets/Items/pocao_cura/` +
    `(${Object.keys(CORES).length} arquivos)\n`,
);
