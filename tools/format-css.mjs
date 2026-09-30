import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2];
const css = readFileSync(path, "utf8");

let out = "";
let buffer = "";
let quote = null;
let line = "";
let parens = 0;

for (const char of css) {
  if (quote) {
    buffer += char;

    if (char === quote) quote = null;

    continue;
  }

  if (char === '"' || char === "'") {
    quote = char;
    buffer += char;
    continue;
  }

  if (char === "(") parens += 1;
  if (char === ")") parens = Math.max(0, parens - 1);

  if (char === "{") {
    buffer += char;
    out += `${buffer.trim()}\n`;
    buffer = "";
    line = "  ";
    continue;
  }

  if (char === "}") {
    if (buffer.trim()) {
      out += `${line}${buffer.trim()}\n`;
    }

    out += "}\n";
    buffer = "";
    line = "";
    parens = 0;
    continue;
  }

  if (char === ";") {
    buffer += char;
    out += `${line}${buffer.trim()}\n`;
    buffer = "";
    continue;
  }

  if (char === "," && parens > 0) {
    buffer += char;
    out += `${line}${buffer.trim()}\n`;
    buffer = "";
    line = `${"  ".repeat(Math.min(parens, 4) + 1)}`;
    continue;
  }

  buffer += char;
}

if (buffer.trim()) {
  out += buffer.trim();
}

writeFileSync(path, out, "utf8");

console.log(
  `formatado: ${css.length} chars -> ${out.split("\n").length} linhas`,
);
