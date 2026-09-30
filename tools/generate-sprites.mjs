import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "./png.mjs";
import {
  DIRECTIONS,
  FRAME,
  ORDER,
  buildSheet,
  renderLook,
  scaleSheet,
  validateLook,
} from "./character-art.mjs";
import { LOOKS, LOOK_ORDER } from "./looks.mjs";
import {
  CREATURE_DIRECTIONS,
  CREATURE_FRAME,
  CREATURE_ORDER,
  buildCreatureSheet,
  renderCreature,
  scaleCreatureSheet,
} from "./creature-art.mjs";
import {
  CREATURE_LOOKS,
  CREATURE_ORDER as CREATURE_IDS,
} from "./creature-looks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(HERE, "../src/assets/sprites");

const PREVIEW_CHARS = {
  "#0b1218": ".",
  "#4c5763": "g",
  "#616e7c": "G",
  "#31506b": "b",
  "#42698a": "B",
  "#3f4a6d": "n",
  "#525e85": "N",
  "#3b2c52": "p",
  "#4f3c6b": "P",
  "#33523f": "c",
  "#426b51": "C",
  "#2c2033": "v",
  "#3f2f49": "V",
  "#6d4a2b": "o",
  "#8a6136": "O",
  "#215050": "t",
  "#2e6b6b": "T",
  "#5b4830": "u",
  "#3a2c52": "u",
  "#eac69f": "S",
  "#bd8c63": "s",
  "#94a1ae": "H",
  "#8496ab": "I",
  "#33264a": "M",
  "#241a2b": "m",
  "#c97c2c": "L",
  "#2c6b6b": "K",
  "#3a5847": "h",
  "#f2d46d": "Y",
  "#c8d3de": "E",
  "#78848f": "e",
  "#f2f7fb": "W",
  "#a8763f": "w",
  "#6d4826": "W",
  "#ef5350": "1",
  "#52c7ff": "2",
  "#f2d46d": "3",
  "#ad70ff": "4",
  "#8ed081": "5",
  "#ec4e75": "6",
  "#ffb84d": "7",
  "#70e6cf": "8",
  "#131d24": "e",
  "#3b2c1e": "b",
};

function preview(look, direction, frameName) {
  const surface = renderLook(look, direction, frameName);
  const lines = [];

  for (let y = 3; y < 29; y += 1) {
    let line = "";

    for (let x = 3; x < 29; x += 1) {
      const index = (y * FRAME + x) * 4;

      if (surface.data[index + 3] === 0) {
        line += " ";
        continue;
      }

      const key = `#${[0, 1, 2]
        .map((c) =>
          surface.data[index + c].toString(16).padStart(2, "0"),
        )
        .join("")}`;

      line += PREVIEW_CHARS[key] ?? "?";
    }

    lines.push(line);
  }

  console.log(`\n--- ${look.id} / ${direction} / ${frameName} ---`);
  console.log(lines.join("\n"));
}

function solidity(look) {
  let filled = 0;
  let total = 0;

  for (const direction of DIRECTIONS) {
    const surface = renderLook(
      look,
      direction,
      ORDER[ORDER.length - 1],
    );

    for (let i = 3; i < surface.data.length; i += 4) {
      total += 1;

      if (surface.data[i] !== 0) filled += 1;
    }
  }

  return filled / total;
}

function run() {
  const problems = LOOK_ORDER.flatMap((id) =>
    LOOKS[id] ? [] : [`look ausente: ${id}`],
  );

  for (const id of LOOK_ORDER) {
    if (!LOOKS[id]) continue;
    problems.push(...validateLook(LOOKS[id]));
  }

  if (problems.length > 0) {
    console.error("\nlooks invalidos:\n");

    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }

    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const rows = [];

  for (const id of LOOK_ORDER) {
    const look = LOOKS[id];

    if (!look) {
      throw new Error(`look ausente: ${id}`);
    }

    const sheet = buildSheet(look);

    const png = encodePng(
      sheet.data,
      sheet.width,
      sheet.height,
    );

    writeFileSync(
      resolve(OUTPUT_DIR, `${id}.png`),
      png,
    );

    rows.push({
      id,
      bytes: png.length,
      fill: solidity(look),
    });
  }

  console.log(
    `\n${LOOK_ORDER.length} sheets gerados (${FRAME}px, ${ORDER.length} frames x ${DIRECTIONS.length} direcoes)\n`,
  );

  for (const row of rows) {
    console.log(
      `  ${row.id.padEnd(11)} ${String(row.bytes).padStart(6)} bytes   preenchimento ${(row.fill * 100).toFixed(1)}%`,
    );
  }

  console.log(`\n-> ${OUTPUT_DIR}`);

  generateCreatures();

  if (process.argv.includes("--preview")) {
    for (const id of LOOK_ORDER) {
      preview(LOOKS[id], "down", "idle0");
      preview(LOOKS[id], "side", "atk1");
    }
  }

  if (process.argv.includes("--scaled")) {
    const previewDir = resolve(HERE, "../.preview");

    mkdirSync(previewDir, { recursive: true });

    for (const id of LOOK_ORDER) {
      const scaled = scaleSheet(buildSheet(LOOKS[id]), 2);

      writeFileSync(
        resolve(previewDir, `${id}-x2.png`),
        encodePng(
          scaled.data,
          scaled.width,
          scaled.height,
        ),
      );
    }

    console.log(`\nprevia x2 -> ${previewDir}`);
  }
}

function creaturePreview(look, direction, frameName) {
  const surface = renderCreature(
    look,
    direction,
    frameName,
  );

  const lines = [];

  for (let y = 3; y < 29; y += 1) {
    let line = "";

    for (let x = 3; x < 29; x += 1) {
      const index = (y * CREATURE_FRAME + x) * 4;

      line +=
        surface.data[index + 3] === 0 ? " " : "#";
    }

    lines.push(line);
  }

  console.log(
    `\n--- ${look.id} / ${direction} / ${frameName} ---`,
  );
  console.log(lines.join("\n"));
}

function generateCreatures() {
  const enemyDir = resolve(OUTPUT_DIR, "enemies");

  mkdirSync(enemyDir, { recursive: true });

  const rows = [];

  for (const id of CREATURE_IDS) {
    const look = CREATURE_LOOKS[id];

    if (!look) {
      throw new Error(`creature look ausente: ${id}`);
    }

    const sheet = buildCreatureSheet(look);

    const png = encodePng(
      sheet.data,
      sheet.width,
      sheet.height,
    );

    writeFileSync(resolve(enemyDir, `${id}.png`), png);

    rows.push({ id, bytes: png.length });
  }

  console.log(
    `\n${rows.length} criaturas geradas (${CREATURE_FRAME}px, ${CREATURE_ORDER.length} frames x ${CREATURE_DIRECTIONS.length} direcoes)\n`,
  );

  for (const row of rows) {
    console.log(
      `  ${row.id.padEnd(11)} ${String(row.bytes).padStart(6)} bytes`,
    );
  }

  console.log(`\n-> ${enemyDir}`);

  if (process.argv.includes("--preview")) {
    for (const id of CREATURE_IDS) {
      creaturePreview(CREATURE_LOOKS[id], "down", "idle0");
      creaturePreview(CREATURE_LOOKS[id], "side", "walk1");
      creaturePreview(CREATURE_LOOKS[id], "side", "atk1");
      creaturePreview(CREATURE_LOOKS[id], "down", "hurt0");
    }
  }

  if (process.argv.includes("--scaled")) {
    const previewDir = resolve(HERE, "../.preview");

    mkdirSync(previewDir, { recursive: true });

    for (const id of CREATURE_IDS) {
      const scaled = scaleCreatureSheet(
        buildCreatureSheet(CREATURE_LOOKS[id]),
        2,
      );

      writeFileSync(
        resolve(previewDir, `${id}-x2.png`),
        encodePng(
          scaled.data,
          scaled.width,
          scaled.height,
        ),
      );
    }

    console.log(`\nprevia criaturas x2 -> ${previewDir}`);
  }
}

run();
