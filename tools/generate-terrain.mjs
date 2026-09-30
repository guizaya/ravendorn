import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "./png.mjs";
import {
  buildFeatureSheet,
  buildTerrainSheet,
  buildTransitionSheet,
  renderTerrainTile,
  TILE,
} from "./terrain-art.mjs";
import {
  FEATURE_IDS,
  TERRAIN,
  TERRAIN_ORDER,
  TRANSITIONS,
} from "./terrain-looks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(HERE, "../src/assets/terrain");

const VARIANTS = 4;

function save(sheet, name) {
  const png = encodePng(sheet.data, sheet.width, sheet.height);

  writeFileSync(resolve(OUTPUT_DIR, name), png);

  return png.length;
}

function previewTile(surface, label) {
  const lines = [];

  for (let y = 0; y < TILE; y += 1) {
    let line = "";

    for (let x = 0; x < TILE; x += 1) {
      const index = (y * TILE + x) * 4;

      const [r, g, b] = [
        surface.data[index],
        surface.data[index + 1],
        surface.data[index + 2],
      ];

      const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;

      line += " .:-=+*#%@"[Math.min(
        9,
        Math.floor(lum * 10),
      )];
    }

    lines.push(line);
  }

  console.log(`\n--- ${label} ---`);
  console.log(lines.join("\n"));
}

function run() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const terrainBytes = save(
    buildTerrainSheet(),
    "terrain.png",
  );

  const transitionBytes = save(
    buildTransitionSheet(),
    "transitions.png",
  );

  const featureBytes = save(
    buildFeatureSheet(),
    "features.png",
  );

  const total =
    terrainBytes + transitionBytes + featureBytes;

  console.log(
    `\nterreno gerado (${TILE}x${TILE}, ${VARIANTS} variantes por tipo)\n`,
  );

  for (const id of TERRAIN_ORDER) {
    console.log(
      `  ${id.padEnd(7)} ${TERRAIN[id].name.padEnd(6)} ${String(
        terrainBytes,
      ).padStart(6)} bytes (compartilhado)`,
    );
  }

  console.log(
    `\n  transicoes: ${TRANSITIONS.length} pares x ${VARIANTS} variantes`,
  );
  console.log(
    `  features:   ${FEATURE_IDS.length} tipos x ${VARIANTS} variantes`,
  );

  console.log(
    `\n  terrain.png      ${String(terrainBytes).padStart(6)} bytes`,
  );
  console.log(
    `  transitions.png  ${String(transitionBytes).padStart(6)} bytes`,
  );
  console.log(
    `  features.png     ${String(featureBytes).padStart(6)} bytes`,
  );
  console.log(`\n  total: ${total} bytes`);
  console.log(`\n-> ${OUTPUT_DIR}`);

  if (process.argv.includes("--preview")) {
    for (const id of TERRAIN_ORDER) {
      previewTile(
        renderTerrainTile(id, 0),
        id,
      );
    }
  }
}

run();
