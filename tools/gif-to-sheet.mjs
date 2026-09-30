import {
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { inflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "./png.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(
  HERE,
  "../src/assets/sprites/arbalist",
);
const OUTPUT = resolve(
  HERE,
  "../src/assets/sprites/arbalist-sheet.png",
);

export const ROWS = [
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east",
];

export const IDLE_FILE = "idle.gif";
export const IDLE_ROW = ROWS.length;

const FRAMES = 8;
const FRAME_SIZE = 64;

function lzwDecode(minCodeSize, data, pixelCount) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;

  let codeSize = minCodeSize + 1;
  let next = eoi + 1;

  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4096);

  for (let i = 0; i < clear; i += 1) {
    prefix[i] = -1;
    suffix[i] = i;
  }

  const out = new Uint8Array(pixelCount);

  let written = 0;
  let bitBuffer = 0;
  let bitCount = 0;
  let pos = 0;
  let old = -1;
  let truncated = false;

  const readCode = () => {
    while (bitCount < codeSize) {
      if (pos >= data.length) return -1;
      bitBuffer |= data[pos] << bitCount;
      pos += 1;
      bitCount += 8;
    }

    const code = bitBuffer & ((1 << codeSize) - 1);

    bitBuffer >>= codeSize;
    bitCount -= codeSize;

    return code;
  };

  while (written < pixelCount) {
    const code = readCode();

    if (code === -1) {
      truncated = true;
      break;
    }

    if (code === eoi) {
      if (written < pixelCount) truncated = true;
      break;
    }

    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = eoi + 1;
      old = -1;
      continue;
    }

    let current = code;
    let sp = 0;

    if (code >= next) {
      if (old === -1) {
        truncated = true;
        break;
      }
      stack[sp] = suffix[old];
      sp += 1;
      current = old;
    }

    while (current >= clear) {
      stack[sp] = suffix[current];
      sp += 1;
      current = prefix[current];
      if (sp >= 4096) break;
    }

    stack[sp] = suffix[current];
    sp += 1;

    for (let i = sp - 1; i >= 0 && written < pixelCount; i -= 1) {
      out[written] = stack[i];
      written += 1;
    }

    if (old !== -1 && next < 4096) {
      prefix[next] = old;
      suffix[next] = stack[sp - 1];
      next += 1;

      if (next === 1 << codeSize && codeSize < 12) {
        codeSize += 1;
      }
    }

    old = code;
  }

  return { out, written, truncated };
}

export function decodeGif(buffer) {
  const signature = buffer
    .subarray(0, 6)
    .toString("latin1");

  if (!signature.startsWith("GIF8")) {
    throw new Error(`nao e um gif: ${signature}`);
  }

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const packed = buffer[10];

  const globalTableSize = 3 * 2 ** ((packed & 7) + 1);

  let i = 13 + globalTableSize;

  const frames = [];

  let transparent = null;
  let loop = null;
  let delay = null;
  let disposal = null;

  while (i < buffer.length) {
    const block = buffer[i];

    if (block === 0x21) {
      const label = buffer[i + 1];

      if (label === 0xf9) {
        const gcePacked = buffer[i + 3];

        delay = buffer.readUInt16LE(i + 4);

        if (gcePacked & 1) {
          transparent = buffer[i + 6];
        }

        disposal = (gcePacked >> 2) & 7;
        i += 8;
      } else {
        if (label === 0xff) {
          const size = buffer[i + 2];
          const app = buffer
            .subarray(i + 3, i + 3 + size)
            .toString("latin1");

          if (app.startsWith("NETSCAPE")) {
            loop = buffer.readUInt16LE(i + 3 + size + 2);
          }
        }

        i += 2;

        while (buffer[i] !== 0) i += buffer[i] + 1;
        i += 1;
      }

      continue;
    }

    if (block === 0x2c) {
      const imgPacked = buffer[i + 9];

      let j = i + 10;
      let tableOffset = 13;
      let tableSize = globalTableSize;

      if (imgPacked & 0x80) {
        tableOffset = j;
        tableSize = 3 * 2 ** ((imgPacked & 7) + 1);
        j += tableSize;
      }

      const minCodeSize = buffer[j];
      j += 1;

      const chunks = [];

      while (buffer[j] !== 0) {
        const length = buffer[j];
        chunks.push(buffer.subarray(j + 1, j + 1 + length));
        j += length + 1;
      }

      const pixelCount = width * height;
      const { out: indices, written, truncated } = lzwDecode(
        minCodeSize,
        Buffer.concat(chunks),
        pixelCount,
      );

      const rgba = new Uint8Array(pixelCount * 4);

      for (let p = 0; p < pixelCount; p += 1) {
        const value = indices[p];

        if (value === transparent) continue;

        const base = tableOffset + value * 3;
        const target = p * 4;

        rgba[target] = buffer[base];
        rgba[target + 1] = buffer[base + 1];
        rgba[target + 2] = buffer[base + 2];
        rgba[target + 3] = 255;
      }

      frames.push({
        rgba,
        delay,
        disposal,
        complete: !truncated && written === pixelCount,
        written,
      });

      i = j + 1;
      continue;
    }

    if (block === 0x3b) break;
    i += 1;
  }

  return { width, height, frames, loop, transparent };
}

function measure(frame, width, height) {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (frame[(y * width + x) * 4 + 3] === 0) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count += 1;
    }
  }

  return { minX, maxX, minY, maxY, count };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[middle];

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function shiftFrame(frame, width, height, dx, dy) {
  if (dx === 0 && dy === 0) return frame;

  const out = new Uint8Array(frame.length);

  for (let y = 0; y < height; y += 1) {
    const sourceY = y - dy;

    if (sourceY < 0 || sourceY >= height) continue;

    for (let x = 0; x < width; x += 1) {
      const sourceX = x - dx;

      if (sourceX < 0 || sourceX >= width) continue;

      const source = (sourceY * width + sourceX) * 4;
      const target = (y * width + x) * 4;

      out[target] = frame[source];
      out[target + 1] = frame[source + 1];
      out[target + 2] = frame[source + 2];
      out[target + 3] = frame[source + 3];
    }
  }

  return out;
}

function inflatePng(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[i] !== signature[i]) {
      throw new Error("png invalido");
    }
  }

  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;

  const idat = [];

  let i = 8;

  while (i < buffer.length) {
    const length = buffer.readUInt32BE(i);
    const type = buffer.toString("ascii", i + 4, i + 8);
    const data = buffer.subarray(i + 8, i + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }

    i += 12 + length;
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(
      `png inesperado: depth ${bitDepth}, color ${colorType}`,
    );
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

function repairTruncatedFrames(directions) {
  const repairs = [];

  for (const direction of directions) {
    const { frames } = direction.gif;
    const total = frames.length;

    const valid = frames
      .map((frame, index) => (frame.complete ? index : null))
      .filter((index) => index !== null);

    if (valid.length === 0) {
      throw new Error(
        `${direction.name}.gif nao tem nenhum frame decodificavel`,
      );
    }

    frames.forEach((frame, index) => {
      if (frame.complete) return;

      let best = null;
      let bestDistance = Infinity;

      for (const candidate of valid) {
        const raw = Math.abs(candidate - index);
        const distance = Math.min(raw, total - raw);

        const prefersEarlier =
          distance === bestDistance && candidate < index;

        if (distance < bestDistance || prefersEarlier) {
          best = candidate;
          bestDistance = distance;
        }
      }

      repairs.push({
        name: direction.name,
        index,
        from: best,
        written: frame.written,
      });

      frame.rgba = Uint8Array.from(frames[best].rgba);
      frame.complete = true;
    });

    direction.frames = frames.map((frame) => frame.rgba);
  }

  return repairs;
}

function dropTruncatedFrames(source) {
  const dropped = [];
  const kept = [];

  source.gif.frames.forEach((frame, index) => {
    if (frame.complete) {
      kept.push(frame.rgba);
      return;
    }

    dropped.push({
      name: source.name,
      index,
      written: frame.written,
    });
  });

  if (kept.length === 0) {
    throw new Error(
      `${source.name}.gif nao tem nenhum frame decodificavel`,
    );
  }

  source.frames = kept;

  return dropped;
}

function alignAnchors(lanes, target) {
  const anchors = lanes.map((lane) => {
    const measured = lane.frames.map((frame) =>
      measure(frame, FRAME_SIZE, FRAME_SIZE),
    );

    return {
      foot: median(measured.map((box) => box.maxY)),
      center: median(
        measured.map((box) => box.minX + box.maxX),
      ),
    };
  });

  const targetFoot = target?.foot ??
    median(anchors.map((anchor) => anchor.foot));

  const targetCenter = target?.center ??
    median(anchors.map((anchor) => anchor.center));

  const offsets = anchors.map((anchor) => ({
    dx: Math.round((targetCenter - anchor.center) / 2),
    dy: targetFoot - anchor.foot,
  }));

  lanes.forEach((lane, index) => {
    const { dx, dy } = offsets[index];

    if (dx === 0 && dy === 0) return;

    lane.frames = lane.frames.map((frame) =>
      shiftFrame(frame, FRAME_SIZE, FRAME_SIZE, dx, dy),
    );
  });

  return { offsets, targetFoot, targetCenter };
}

function audit(directions) {
  const perRow = [];
  const squashed = [];
  let touching = 0;
  let empty = 0;

  for (const [row, direction] of directions.entries()) {
    const boxes = direction.frames.map((frame) =>
      measure(frame, FRAME_SIZE, FRAME_SIZE),
    );

    const unionWidth =
      Math.max(...boxes.map((box) => box.maxX)) -
      Math.min(...boxes.map((box) => box.minX)) +
      1;

    const unionHeight =
      Math.max(...boxes.map((box) => box.maxY)) -
      Math.min(...boxes.map((box) => box.minY)) +
      1;

    let minX = FRAME_SIZE;
    let maxX = -1;
    let minY = FRAME_SIZE;
    let maxY = -1;
    let opaque = 0;

    boxes.forEach((box, index) => {
      if (box.count === 0) {
        empty += 1;
        return;
      }

      const width = box.maxX - box.minX + 1;
      const height = box.maxY - box.minY + 1;

      if (
        width < unionWidth * 0.5 ||
        height < unionHeight * 0.5
      ) {
        squashed.push(
          `${direction.name} frame ${index} ` +
            `(${width}x${height} contra ${unionWidth}x${unionHeight})`,
        );
      }

      if (
        box.minX === 0 ||
        box.maxX === FRAME_SIZE - 1 ||
        box.minY === 0 ||
        box.maxY === FRAME_SIZE - 1
      ) {
        touching += 1;
      }

      minX = Math.min(minX, box.minX);
      maxX = Math.max(maxX, box.maxX);
      minY = Math.min(minY, box.minY);
      maxY = Math.max(maxY, box.maxY);
      opaque += box.count;
    });

    perRow[row] = {
      minX,
      maxX,
      minY,
      maxY,
      foot: maxY,
      opaque,
    };
  }

  return {
    perRow,
    touching,
    empty,
    squashed,
    foot: median(perRow.map((info) => info.foot)),
  };
}

function verifySheet(png, data, sheetWidth, lanes) {
  const decoded = inflatePng(png);

  if (
    decoded.width !== sheetWidth ||
    decoded.height !== FRAME_SIZE * lanes.length
  ) {
    throw new Error("png gerado com dimensao errada");
  }

  let mismatched = 0;
  let opaquePixels = 0;

  for (const [row, lane] of lanes.entries()) {
    for (const [column, frame] of lane.frames.entries()) {
      for (let y = 0; y < FRAME_SIZE; y += 1) {
        for (let x = 0; x < FRAME_SIZE; x += 1) {
          const source = (y * FRAME_SIZE + x) * 4;
          const targetX = column * FRAME_SIZE + x;
          const targetY = row * FRAME_SIZE + y;
          const target = (targetY * sheetWidth + targetX) * 4;

          if (frame[source + 3] > 0) opaquePixels += 1;

          for (let channel = 0; channel < 4; channel += 1) {
            if (
              frame[source + channel] !==
              decoded.data[target + channel]
            ) {
              mismatched += 1;
            }
          }
        }
      }
    }
  }

  if (mismatched > 0) {
    throw new Error(
      `png divergiu da sheet montada em ${mismatched} canais`,
    );
  }

  return {
    opaquePixels,
    cells: lanes.reduce(
      (total, lane) => total + lane.frames.length,
      0,
    ),
  };
}

function run() {
  const available = new Set(readdirSync(SOURCE_DIR));

  const problems = ROWS.filter(
    (row) => !available.has(`${row}.gif`),
  );

  if (problems.length > 0) {
    console.error("\ngifs ausentes:\n");

    for (const problem of problems) {
      console.error(`  - ${problem}.gif`);
    }

    process.exit(1);
  }

  const directions = ROWS.map((name) => {
    const gif = decodeGif(
      readFileSync(resolve(SOURCE_DIR, `${name}.gif`)),
    );

    if (gif.width !== FRAME_SIZE || gif.height !== FRAME_SIZE) {
      throw new Error(
        `${name}.gif tem ${gif.width}x${gif.height}, esperado ${FRAME_SIZE}x${FRAME_SIZE}`,
      );
    }

    if (gif.frames.length !== FRAMES) {
      throw new Error(
        `${name}.gif tem ${gif.frames.length} frames, esperado ${FRAMES}`,
      );
    }

    return { name, gif };
  });

  const idle = {
    name: "idle",
    gif: decodeGif(
      readFileSync(resolve(SOURCE_DIR, IDLE_FILE)),
    ),
  };

  if (
    idle.gif.width !== FRAME_SIZE ||
    idle.gif.height !== FRAME_SIZE
  ) {
    throw new Error(
      `${IDLE_FILE} tem ${idle.gif.width}x${idle.gif.height}, ` +
        `esperado ${FRAME_SIZE}x${FRAME_SIZE}`,
    );
  }

  const repairs = repairTruncatedFrames(directions);
  const drops = dropTruncatedFrames(idle);

  if (idle.frames.length > FRAMES) {
    throw new Error(
      `${IDLE_FILE} tem ${idle.frames.length} frames validos, ` +
        `a grade comporta ${FRAMES}`,
    );
  }

  if (idle.frames.length < 2) {
    throw new Error(
      `${IDLE_FILE} ficou com ${idle.frames.length} frame valido`,
    );
  }

  const walkAnchor = alignAnchors(directions);
  const idleAnchor = alignAnchors([idle], {
    foot: walkAnchor.targetFoot,
    center: walkAnchor.targetCenter,
  });

  const lanes = [...directions, idle];
  const report = audit(lanes);

  if (report.touching > 0) {
    throw new Error(
      `${report.touching} celulas tocam a borda da celula; ` +
        "a arte esta encostando e pode vazar para a vizinha",
    );
  }

  if (report.empty > 0) {
    throw new Error(
      `${report.empty} celulas ficaram vazias apos o reparo`,
    );
  }

  if (report.squashed.length > 0) {
    throw new Error(
      `celulas com o personagem incompleto:\n` +
        report.squashed.map((entry) => `  - ${entry}`).join("\n"),
    );
  }

  const sheetWidth = FRAME_SIZE * FRAMES;
  const sheetHeight = FRAME_SIZE * lanes.length;
  const data = new Uint8Array(sheetWidth * sheetHeight * 4);

  for (const [row, lane] of lanes.entries()) {
    for (const [column, frame] of lane.frames.entries()) {
      for (let y = 0; y < FRAME_SIZE; y += 1) {
        for (let x = 0; x < FRAME_SIZE; x += 1) {
          const source = (y * FRAME_SIZE + x) * 4;
          const targetX = column * FRAME_SIZE + x;
          const targetY = row * FRAME_SIZE + y;
          const target = (targetY * sheetWidth + targetX) * 4;

          data[target] = frame[source];
          data[target + 1] = frame[source + 1];
          data[target + 2] = frame[source + 2];
          data[target + 3] = frame[source + 3];
        }
      }
    }
  }

  const png = encodePng(data, sheetWidth, sheetHeight);

  const verified = verifySheet(
    png,
    data,
    sheetWidth,
    lanes,
  );

  writeFileSync(OUTPUT, png);

  console.log(
    `\nsheet gerada: ${sheetWidth}x${sheetHeight} ` +
      `(${FRAMES} colunas x ${lanes.length} linhas: ` +
      `${ROWS.length} direcoes + 1 idle)\n`,
  );

  const allOffsets = [
    ...walkAnchor.offsets,
    ...idleAnchor.offsets,
  ];

  for (const [row, lane] of lanes.entries()) {
    const info = report.perRow[row];
    const { dx, dy } = allOffsets[row];

    console.log(
      `  ${lane.name.padEnd(12)} ` +
        `linha ${String(row).padStart(2)}   ` +
        `frames ${String(lane.frames.length).padStart(2)}   ` +
        `offset ${dx >= 0 ? "+" : ""}${dx},${dy >= 0 ? "+" : ""}${dy}   ` +
        `pes y=${String(info.foot).padStart(2)}   ` +
        `bbox ${info.minX}..${info.maxX} x ${info.minY}..${info.maxY}   ` +
        `opacos ${info.opaque}`,
    );
  }

  if (repairs.length > 0) {
    console.log("\nframes reparados (stream LZW truncado no gif):");

    for (const repair of repairs) {
      console.log(
        `  ${repair.name}.gif frame ${repair.index} ` +
          `-> copiado do frame ${repair.from} ` +
          `(${repair.written}/${FRAME_SIZE * FRAME_SIZE} pixels)`,
      );
    }
  }

  if (drops.length > 0) {
    console.log("\nframes descartados (stream LZW truncado no gif):");

    for (const drop of drops) {
      console.log(
        `  ${drop.name}.gif frame ${drop.index} ` +
          `(${drop.written}/${FRAME_SIZE * FRAME_SIZE} pixels)`,
      );
    }
  }

  console.log(
    `\nconstantes para src/data/sprites/index.js:` +
      `\n  ARBALIST_IDLE_ROW = ${IDLE_ROW}` +
      `\n  ARBALIST_IDLE_FRAMES = ${idle.frames.length}` +
      `\n  ARBALIST_FRAMES = ${FRAMES}`,
  );

  console.log(
    `\nvalidacao: ${verified.cells} celulas, ` +
      `${verified.opaquePixels} pixels opacos, ` +
      "0 divergencia com o png gerado",
  );

  console.log(
    `            ${report.touching} celulas encostando na borda, ` +
      `${report.empty} vazias, ` +
      `${report.squashed.length} com personagem incompleto, ` +
      `ancora comum em x=${walkAnchor.targetCenter / 2} ` +
      `y=${walkAnchor.targetFoot}`,
  );

  const spread = {
    foot: Math.max(...report.perRow.map((i) => i.foot)) -
      Math.min(...report.perRow.map((i) => i.foot)),
    center: Math.max(
      ...report.perRow.map((i) => (i.minX + i.maxX) / 2),
    ) - Math.min(
      ...report.perRow.map((i) => (i.minX + i.maxX) / 2),
    ),
  };

  console.log(
    `            dispersao entre linhas: ` +
      `${spread.foot}px vertical, ${spread.center}px horizontal`,
  );

  console.log(`\n-> ${OUTPUT} (${png.length} bytes)`);
}

run();
