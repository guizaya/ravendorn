import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

/**
 * O icone da GUILDA.
 *
 * Os outros sete icones sao arte de 1600x1600 (o `rank` e 1254). Este
 * nasce em 1600 para ficar com a mesma familia: o `HudIcon` desenha em
 * um quadrado fixo, e um icone de tamanho diferente entraria na barra
 * com a borda desalinhada
 *
 * E desenhado AQUI, e nao importado de uma pasta de arte, por uma razao
 * pratica: os outros sete existem como arquivo feito fora, e nao ha arte
 * de guilda no projeto. Um PNG de 1600px com uma forma desenhada por
 * codigo e o mesmo formato que os outros — mesmo tamanho, mesma
 * familia, e um arquivo de verdade no disco
 *
 * A forma e um ESCUDO com um ramo de arvore dentro: grupo que protege,
 * e a arvore de talento que da o bonus. Ler "pessoas juntas" seria
 * lista de amigos, que nao e o que o painel faz
 */

const LADO = 1600;

/** RGBA com canal alpha de verdade, e nao RGB chapado */
const px = Buffer.alloc(LADO * LADO * 4);

const definir = (x, y, r, g, b, a) => {
  if (x < 0 || y < 0 || x >= LADO || y >= LADO) return;

  const i = (y * LADO + x) * 4;

  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
};

const fundido = (x, y, r, g, b, cobertura) => {
  if (cobertura <= 0) return;

  const i = (y * LADO + x) * 4;
  const a = px[i + 3];

  const nova = Math.min(255, a + cobertura);

  if (nova === 0) return;

  px[i] = Math.round((px[i] * a + r * (nova - a)) / nova);
  px[i + 1] = Math.round((px[i + 1] * a + g * (nova - a)) / nova);
  px[i + 2] = Math.round((px[i + 2] * a + b * (nova - a)) / nova);
  px[i + 3] = nova;
};

/** o escudo: um `|` largo com a base arredondada */
const dentroDoEscudo = (x, y) => {
  const cx = LADO / 2;
  const topo = 250;
  const base = 1240;
  const meia = 470;

  const dy = y - topo;

  if (y < topo || y > base) return false;

  // afina conforme desce: a largura de escudo e a de um escudo
  const afino = 1 - (dy / (base - topo)) * 0.42;

  const limite = meia * afino;

  const dx = Math.abs(x - cx);

  if (y <= base - 220) return dx <= limite;

  // a ponta arredondada
  const centroY = base - 220;

  return (
    (x - cx) ** 2 + (y - centroY) ** 2 <= limite ** 2
  );
};

const borda = 26;

/** o centro do escudo, para o ramo ficar em cima dele */
const cx = LADO / 2;

/** o miolo do escudo, com a borda mais clara */
for (let y = 0; y < LADO; y += 1) {
  for (let x = 0; x < LADO; x += 1) {
    if (!dentroDoEscudo(x, y)) continue;

    const naBorda =
      !dentroDoEscudo(x - borda, y) ||
      !dentroDoEscudo(x + borda, y) ||
      !dentroDoEscudo(x, y - borda) ||
      !dentroDoEscudo(x, y + borda);

    // o metal: dourado na borda, verde-escuro no miolo
    if (naBorda) {
      definir(x, y, 214, 176, 96, 255);
    } else {
      definir(x, y, 38, 62, 52, 255);
    }
  }
}

/**
 * O ramo, desenhado DEPOIS e POR CIMA do escudo.
 *
 * A primeira versao desenhava o ramo com `definir` e as folhas com
 * `fundido`, e o resultado foi invisivel: o tronco aparecia como um
 * risco fino e as folhas sumiam. Duas razoes, e as duas corrigidas
 * aqui:
 *
 * 1. as folhas eram elipses de 210x108 — largas e baixinhas, com o
 *    miolo cortado pela "nervura". Resultado: dois arcos finos nas
 *    bordas, que e o que se via
 * 2. o verde era escuro demais sobre o verde-escuro do escudo. O
 *    contraste precisa ser alto porque o icone e desenhado com 40px na
 *    barra: detalhe fino some, massa clara nao
 *
 * Agora o ramo e uma silhueta cheia: tronco grosso, tres folhas
 * grandes e cheias, e uma cor muito mais clara que o miolo do escudo
 */

/** o tronco, grosso e claro */
for (let y = 600; y <= 950; y += 1) {
  const curva = Math.sin(((y - 600) / 350) * Math.PI) * 30;

  const x = cx + curva;

  for (let dx = -20; dx <= 20; dx += 1) {
    // afina na ponta de baixo, para parecer tronco e nao pilar
    const afino = 1 - ((y - 860) / 90) * 0.6;

    if (afino <= 0.15) continue;

    const espessura = 20 * afino;

    if (Math.abs(dx) > espessura) continue;

    definir(Math.round(x + dx), y, 168, 226, 164, 255);
  }
}

/** uma folha cheia, oval e levemente inclinada */
const folhaCheia = (bx, by, rx, ry, inclinacao) => {
  const cos = Math.cos(inclinacao);
  const sen = Math.sin(inclinacao);

  for (let y = by - ry; y <= by + ry; y += 1) {
    for (let x = bx - rx; x <= bx + rx; x += 1) {
      // rotaciona em torno do centro da folha
      const dx = x - bx;
      const dy = y - by;

      const nx = (dx * cos + dy * sen) / rx;
      const ny = (-dx * sen + dy * cos) / ry;

      if (nx * nx + ny * ny > 1) continue;

      definir(x, y, 168, 226, 164, 255);
    }
  }
};

folhaCheia(cx - 150, 720, 140, 82, -0.34);
folhaCheia(cx + 150, 690, 140, 82, 0.34);
folhaCheia(cx, 620, 70, 105, 0);

/* ------------------------------------------------------------------ PNG */

const crc = (buf) => {
  let c = 0xffffffff;

  for (const b of buf) {
    c ^= b;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }

  return (c ^ 0xffffffff) >>> 0;
};

const pedaco = (tipo, dados) => {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);

  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc(corpo));

  return Buffer.concat([tamanho, corpo, crcBuf]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(LADO, 0);
ihdr.writeUInt32BE(LADO, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

/** cada linha da imagem com o byte de filtro 0 */
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

const destino =
  "src/assets/icons/guild.png";

writeFileSync(destino, png);

console.log(
  `${destino}: ${LADO}x${LADO}, ${(png.length / 1024).toFixed(1)} KB`,
);
