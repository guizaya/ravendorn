import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ARBALIST_DIRECTIONS,
  ARBALIST_SPRITE,
} from "../../data/sprites/index.js";
import { DIRECTION_KEYS } from "./animation.js";

const SHEET = fileURLToPath(
  new URL(
    "../../assets/sprites/arbalist-sheet.png",
    import.meta.url,
  ),
);

const CELL = 64;
const IDLE_ROW = ARBALIST_SPRITE.animations.idle.row;
const SHOOT_ROW = ARBALIST_SPRITE.animations.attack.rowOffset;
const COLUMNS = Math.max(
  ...Object.values(ARBALIST_SPRITE.animations).map(
    (animation) => animation.length,
  ),
);
const ROWS = SHOOT_ROW + DIRECTION_KEYS.length;

function decodePng(file) {
  const buffer = readFileSync(file);

  expect(
    [...buffer.subarray(0, 8)],
    "assinatura png",
  ).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  let width = 0;
  let height = 0;
  const idat = [];

  let i = 8;

  while (i < buffer.length) {
    const length = buffer.readUInt32BE(i);
    const type = buffer.toString("ascii", i + 4, i + 8);
    const data = buffer.subarray(i + 8, i + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8], "bit depth").toBe(8);
      expect(data[9], "color type").toBe(6);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }

    i += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = new Uint8Array(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(
      y * (stride + 1) + 1,
      y * (stride + 1) + 1 + stride,
    );

    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? out[y * stride + x - 4] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const upLeft =
        x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;

      let value = line[x];

      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const dl = Math.abs(p - left);
        const du = Math.abs(p - up);
        const dul = Math.abs(p - upLeft);

        value +=
          dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      }

      out[y * stride + x] = value & 0xff;
    }
  }

  return { width, height, data: out };
}

const sheet = decodePng(SHEET);

function cellAt(column, row) {
  const pixels = [];

  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const targetX = column * CELL + x;
      const targetY = row * CELL + y;
      const index = (targetY * sheet.width + targetX) * 4;

      pixels.push(
        sheet.data[index],
        sheet.data[index + 1],
        sheet.data[index + 2],
        sheet.data[index + 3],
      );
    }
  }

  return pixels;
}

function boxOf(pixels) {
  let minX = CELL;
  let maxX = -1;
  let minY = CELL;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      if (pixels[(y * CELL + x) * 4 + 3] === 0) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count += 1;
    }
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    count,
  };
}

const rowOf = (key) => ARBALIST_DIRECTIONS[key];

function lanes() {
  const list = [];

  for (const key of DIRECTION_KEYS) {
    const row = ARBALIST_DIRECTIONS[key];

    list.push({
      name: `walk ${key}`,
      row,
      length: ARBALIST_SPRITE.animations.walk.length,
    });

    list.push({
      name: `shoot ${key}`,
      row: SHOOT_ROW + row,
      length: ARBALIST_SPRITE.animations.attack.length,
    });
  }

  list.push({
    name: "idle",
    row: IDLE_ROW,
    length: ARBALIST_SPRITE.animations.idle.length,
  });

  return list;
}

const cells = lanes().flatMap((lane) =>
  Array.from({ length: lane.length }, (_, column) => ({
    label: `${lane.name} frame ${column}`,
    lane,
    box: boxOf(cellAt(column, lane.row)),
  })),
);

describe("arbalist sheet asset", () => {
  it("tem uma linha por direcao de andar, mais idle e tiro", () => {
    expect(sheet.width).toBe(CELL * COLUMNS);
    expect(sheet.height).toBe(CELL * ROWS);
    expect(COLUMNS).toBe(9);
    expect(IDLE_ROW).toBe(8);
    expect(SHOOT_ROW).toBe(9);
    expect(ROWS).toBe(17);
  });

  it("tem uma linha para cada direcao", () => {
    expect(Object.keys(ARBALIST_DIRECTIONS).sort()).toEqual(
      DIRECTION_KEYS.slice().sort(),
    );

    for (const key of DIRECTION_KEYS) {
      expect(rowOf(key), key).toBeGreaterThanOrEqual(0);
      expect(rowOf(key), key).toBeLessThan(IDLE_ROW);
    }
  });

  it("separa walk, idle e shoot em blocos de linha proprios", () => {
    const walkRows = DIRECTION_KEYS.map(rowOf);
    const shootRows = DIRECTION_KEYS.map(
      (key) => SHOOT_ROW + ARBALIST_DIRECTIONS[key],
    );

    expect(new Set(walkRows).size).toBe(8);
    expect(new Set(shootRows).size).toBe(8);

    for (const row of shootRows) {
      expect(walkRows, `tiro ${row}`).not.toContain(row);
      expect(row, `tiro ${row}`).not.toBe(IDLE_ROW);
    }
  });

  it("draws a whole character in every used cell", () => {
    for (const { label, box } of cells) {
      expect(box.count, `${label} vazia`).toBeGreaterThan(200);
      expect(box.height, `${label} baixa demais`).toBeGreaterThan(
        30,
      );
      expect(box.width, `${label} estreita demais`).toBeGreaterThan(
        16,
      );
    }
  });

  it("keeps the character inside its own cell", () => {
    for (const { label, box } of cells) {
      expect(box.minX, `${label} encosta na esquerda`).toBeGreaterThan(0);
      expect(box.maxX, `${label} encosta na direita`).toBeLessThan(CELL - 1);
      expect(box.minY, `${label} encosta no topo`).toBeGreaterThan(0);
      expect(box.maxY, `${label} encosta na base`).toBeLessThan(CELL - 1);
    }
  });

  it("nao tem frame corrompido em nenhuma linha", () => {
    for (const lane of lanes()) {
      const laneBoxes = [];

      for (let column = 0; column < lane.length; column += 1) {
        laneBoxes.push(boxOf(cellAt(column, lane.row)));
      }

      const unionWidth = Math.max(...laneBoxes.map((b) => b.width));
      const unionHeight = Math.max(...laneBoxes.map((b) => b.height));
      const unionArea = unionWidth * unionHeight;

      laneBoxes.forEach((box, index) => {
        // a assinatura de frame truncado e perder ALTURA: o
        // stream LZW para nas primeiras linhas da celula. a
        // largura varia de legitimamente no tiro, com o arco
        // sendo puxado e depois estendido.
        expect(
          box.height,
          `${lane.name} frame ${index} baixo`,
        ).toBeGreaterThanOrEqual(unionHeight * 0.5);

        expect(
          box.width * box.height,
          `${lane.name} frame ${index} ralo`,
        ).toBeGreaterThanOrEqual(unionArea * 0.3);
      });
    }
  });

/**
   * Quantos pixels OPACOS a celula tem.
   *
   * O `cellAt` devolve um array CHATO de RGBA, e nao um array de
   * pixels: o alfa de um pixel esta em `[(y * CELL + x) * 4 + 3]`.
   * Ler `p[3]` de cada elemento — a primeira versao deste teste — le
   * um numero solto, dá `undefined`, e devolve zero para sempre. O
   * teste passava sem nunca ter medido nada, que e o pior jeito de um
   * teste falhar
   */
function opacosEm(column, row) {
  const pixels = cellAt(column, row);

  let total = 0;

  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) total += 1;
  }

  return total;
}

/**
   * O `length` declarado tem que COBRIR a arte.
   *
   * Todos os testes deste arquivo medem a folha pelo `length` que a
   * propria constante declara, entao um `length` curto demais passa
   * despercebido: ele so leria os primeiros 7 quadros de uma lane com
   * 8 e nao veria nada de errado. Foi assim que a troca de arte
   * aumentou o idle de 7 para 8 sem que nenhuma checagem reclamasse
   *
   * Aqui a contagem e feita pela arte, e o `length` e que precisa
   * chegar nela
   */
  it("nenhuma lane tem quadro alem do length declarado", () => {
    for (const lane of lanes()) {
      let ultimo = -1;

      for (let column = 0; column < COLUMNS; column += 1) {
        if (opacosEm(column, lane.row) > 0) ultimo = column;
      }

      const naArte = ultimo + 1;

      expect(naArte, `${lane.name}: a arte tem ${naArte} quadros`).toBeGreaterThan(0);

      expect(
        lane.length,
        `${lane.name}: o layout declara ${lane.length} e a arte tem ` +
          `${naArte} — falta quadro na animacao`,
      ).toBeGreaterThanOrEqual(naArte);
    }
  });

  it("animates: every row has several distinct frames", () => {

    for (const lane of lanes()) {
      const prints = new Set();

      for (let column = 0; column < lane.length; column += 1) {
        prints.add(cellAt(column, lane.row).join(","));
      }

      expect(
        prints.size,
        `${lane.name} tem ${prints.size} frames distintos de ${lane.length}`,
      ).toBeGreaterThanOrEqual(6);
    }
  });

  it("aligns the feet across every row so turns and stops do not jump", () => {
    const medians = lanes().map((lane) => {
      const bottoms = [];

      for (let column = 0; column < lane.length; column += 1) {
        bottoms.push(boxOf(cellAt(column, lane.row)).maxY);
      }

      bottoms.sort((a, b) => a - b);

      return bottoms[Math.floor(bottoms.length / 2)];
    });

    const spread = Math.max(...medians) - Math.min(...medians);

    expect(
      spread,
      `medianas de pe: ${medians.join(",")}`,
    ).toBeLessThanOrEqual(1);
  });

  it("aligns the body horizontally across every row", () => {
    const medians = lanes().map((lane) => {
      const centers = [];

      for (let column = 0; column < lane.length; column += 1) {
        const box = boxOf(cellAt(column, lane.row));
        centers.push((box.minX + box.maxX) / 2);
      }

      centers.sort((a, b) => a - b);

      return centers[Math.floor(centers.length / 2)];
    });

    const spread = Math.max(...medians) - Math.min(...medians);

    expect(
      spread,
      `centros: ${medians.join(",")}`,
    ).toBeLessThanOrEqual(2);
  });

  it("matches the frame layout the engine draws", () => {
    expect(ARBALIST_SPRITE.frameWidth).toBe(CELL);
    expect(ARBALIST_SPRITE.frameHeight).toBe(CELL);

    for (const animation of Object.values(
      ARBALIST_SPRITE.animations,
    )) {
      expect(animation.start).toBe(0);
      expect(animation.fps).toBeGreaterThan(0);
      expect(animation.length).toBeGreaterThan(0);
      expect(animation.length).toBeLessThanOrEqual(COLUMNS);
    }

    // o tiro e o unico que usa todas as colunas
    expect(ARBALIST_SPRITE.animations.attack.length).toBe(COLUMNS);
    expect(
      ARBALIST_SPRITE.animations.walk.length,
    ).toBeLessThan(COLUMNS);
  });
});
