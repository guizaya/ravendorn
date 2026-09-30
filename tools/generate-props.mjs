import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "./png.mjs";
import {
  buildPropSheet,
  PROP_FRAME,
  PROP_ORDER,
  PROP_TYPES,
  PROP_VARIANTS,
} from "./prop-art.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(HERE, "../src/assets/props");

function run() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const sheet = buildPropSheet();

  const png = encodePng(sheet.data, sheet.width, sheet.height);

  writeFileSync(
    resolve(OUTPUT_DIR, "props.png"),
    png,
  );

  console.log(
    `\nprops gerados (${PROP_FRAME}x${PROP_FRAME}, ${PROP_VARIANTS} variantes)\n`,
  );

  for (const id of PROP_ORDER) {
    const type = PROP_TYPES[id];

    console.log(
      `  ${id.padEnd(11)} ${type.name.padEnd(16)} ${
        type.blocking ? "bloqueia" : "decorativo"
      }`,
    );
  }

  console.log(
    `\n  sheet: ${sheet.width}x${sheet.height}`,
  );
  console.log(`  bytes: ${png.length}`);
  console.log(`\n-> ${OUTPUT_DIR}`);
}

run();
