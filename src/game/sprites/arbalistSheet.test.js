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
const COLUMNS = 8;
const IDLE_ROW = ARBALIST_SPRITE.animations.idle.row;
const ROWS = IDLE_ROW + 1;

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
  return [
    ...DIRECTION_KEYS.map((key) => ({
      name: key,
      row: ARBALIST_DIRECTIONS[key],
      length: ARBALIST_SPRITE.animations.walk.length,
    })),
    {
      name: "idle",
      row: IDLE_ROW,
      length: ARBALIST_SPRITE.animations.idle.length,
    },
  ];
}

const cells = lanes().flatMap((lane) =>
  Array.from({ length: lane.length }, (_, column) => ({
    label: `${lane.name} frame ${column}`,
    lane,
    box: boxOf(cellAt(column, lane.row)),
  })),
);

describe("arbalist sheet asset", () => {
  it("is a 512x576 grid with a row per direction plus idle", () => {
    expect(sheet.width).toBe(CELL * COLUMNS);
    expect(sheet.height).toBe(CELL * ROWS);
    expect(ROWS).toBe(9);
  });

  it("has a row for every compass direction", () => {
    expect(Object.keys(ARBALIST_DIRECTIONS).sort()).toEqual(
      DIRECTION_KEYS.slice().sort(),
    );

    for (const key of DIRECTION_KEYS) {
      expect(rowOf(key), key).toBeGreaterThanOrEqual(0);
      expect(rowOf(key), key).toBeLessThan(IDLE_ROW);
    }
  });

  it("keeps the idle on a row of its own", () => {
    expect(IDLE_ROW).toBe(8);
    expect(
      Object.values(ARBALIST_DIRECTIONS),
    ).not.toContain(IDLE_ROW);
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

  it("has no frame smaller than half of its row", () => {
    for (const lane of lanes()) {
      const laneBoxes = [];

      for (let column = 0; column < lane.length; column += 1) {
        laneBoxes.push(boxOf(cellAt(column, lane.row)));
      }

      const unionWidth = Math.max(...laneBoxes.map((b) => b.width));
      const unionHeight = Math.max(...laneBoxes.map((b) => b.height));

      laneBoxes.forEach((box, index) => {
        expect(
          box.width,
          `${lane.name} frame ${index} estreito`,
        ).toBeGreaterThanOrEqual(unionWidth * 0.5);

        expect(
          box.height,
          `${lane.name} frame ${index} baixo`,
        ).toBeGreaterThanOrEqual(unionHeight * 0.5);
      });
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

    expect(ARBALIST_SPRITE.animations.walk.length).toBe(COLUMNS);
  });
});
