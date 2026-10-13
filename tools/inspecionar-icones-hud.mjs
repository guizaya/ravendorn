/**
 * OS ICONES DA HUD TEM A MESMA CAIXA?
 *
 * ## POR QUE ISTO E UM PROBLEMA DE CENTRALIZACAO
 *
 * Porque `object-fit: contain` CENTRA o desenho dentro da caixa dele — a
 * centralizacao esta certa. O que ele nao faz e dar a mesma caixa a todos:
 * uma arte de 48x48 e uma de 32x24 desenhadas em 30x30 produzem areas
 * pintadas diferentes, e o olho le a diferenca como "o icone esta torto"
 *
 * ## E POR QUE ISTO E UM CONTEUDO, E NAO UM CSS
 *
 * Porque nenhuma regra de CSS conserta uma arte desenhada num retangulo
 * errado. O `contain` respeita a proporcao original, entao um icone largo
 * fica mais baixo e um alto fica mais estreito — centralizado, mas de
 * tamanho diferente dos vizinhos
 */

import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const mod = readFileSync(join(RAIZ, "src/data/hudIcons.js"), "utf8");

const relatorios = [...mod.matchAll(/["'`]([^"'`]+\.png)["'`]/g)].map((m) => m[1]);

const unicos = [...new Set(relatorios)];

console.log("\n  A ARTE DE CADA ICONE DA HUD\n");

const achados = [];

for (const rel of unicos) {
  const nome = rel.split("/").pop();
  const candidatos = [
    join(RAIZ, "src/assets/icons", nome),
    join(RAIZ, "src/assets", rel),
  ];

  for (const caminho of candidatos) {
    try {
      const buf = readFileSync(caminho);

      // o IHDR do PNG comeca no byte 16: largura e altura, big-endian
      achados.push({
        rel,
        nome,
        w: buf.readUInt32BE(16),
        h: buf.readUInt32BE(20),
        bytes: buf.length,
      });

      break;
    } catch {
      // tenta o proximo caminho
    }
  }
}

console.log("  arquivo".padEnd(34) + "px".padEnd(14) + "formato");
console.log("");

for (const a of achados.sort((x, y) => x.nome.localeCompare(y.nome))) {
  const razao = a.w / a.h;

  const formato = a.w === a.h
    ? "quadrada"
    : razao > 1.15
      ? "LARGA  <- encolhe na vertical"
      : razao < 0.87
        ? "ALTA   <- encolhe na horizontal"
        : "quase quadrada";

  console.log(
    "  " + a.nome.padEnd(32) +
    (String(a.w) + "x" + a.h).padEnd(14) +
    formato,
  );
}

const retangulares = achados.filter((a) => a.w !== a.h);
const grandes = achados.filter((a) => a.w > 64);

console.log("\n  " + achados.length + " icones lidos");
console.log("  " + retangulares.length + " nao sao quadrados");
console.log("  " + grandes.length + " tem resolucao maior que 64px\n");

if (grandes.length) {
  console.log("  ARTE GRANDE DENTRO DE 30px E SUAVIZADA.\n");
  console.log("  O `.hud-icon img` usa `image-rendering: auto`, e o navegador");
  console.log("  amostra a arte para a caixa final. Uma imagem de 96px reduzida");
  console.log("  para 30 fica borrosa, e a borrao faz o desenho parecer menor e");
  console.log("  deslocado — mesmo com o `object-fit` correto.\n");

  for (const a of grandes) {
    const reducao = (a.w / 30).toFixed(1);
    console.log("  " + a.nome.padEnd(32) + String(a.w) + "px -> 30px  reduz " + reducao + "x");
  }
  console.log("");
}