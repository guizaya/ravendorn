/**
 * Mede os gifs do arquiro antes de regerar a folha.
 *
 * A ferramenta ja recusa celula pequena demais, mas so DEPOIS de
 * escrever nada: ela le, monta em memoria e so entao chama o
 * `writeFileSync`. Este script e o relatorio que diz o tamanho e a
 * contagem de cada lane, para dar o numero ANTES da geracao
 *
 * Uso: node tools/inspect-arbalist.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeGif } from "./gif-to-sheet.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(HERE, "..");
const PASTA = resolve(RAIZ, "src/assets/sprites/new_arbalist_2");

const CICLOS = ["walk", "idle", "shoot", "mining"];
const CELULA = 96;

const medidas = [];
const avisos = [];

for (const ciclo of CICLOS) {
  const dir = join(PASTA, ciclo);

  let arquivos;

  try {
    arquivos = readdirSync(dir).filter((f) => f.endsWith(".gif")).sort();
  } catch {
    avisos.push(`${ciclo}: pasta ausente`);
    continue;
  }

  for (const arquivo of arquivos) {
    const nome = arquivo.replace(/\.gif$/, "");
    const gif = decodeGif(readFileSync(join(dir, arquivo)));

    const maiorQueACelula =
      gif.width > CELULA || gif.height > CELULA;

    medidas.push({
      ciclo,
      nome,
      tamanho: `${gif.width}x${gif.height}`,
      frames: gif.frames.length,
      transparentes: gif.frames.filter((f) => !f.complete).length,
    });

    if (maiorQueACelula) {
      avisos.push(
        `${ciclo}/${nome}: ${gif.width}x${gif.height} maior que a ` +
          `celula de ${CELULA} — a ferramenta vai recusar`,
      );
    }

    if (gif.frames.some((f) => !f.complete)) {
      avisos.push(
        `${ciclo}/${nome}: tem frame truncado (LZW incompleto)`,
      );
    }
  }
}

for (const m of medidas) {
  console.log(
    `  ${m.ciclo.padEnd(7)} ${m.nome.padEnd(12)} ` +
      `${m.tamanho.padEnd(9)} ${String(m.frames).padStart(2)} quadros`,
  );
}

/**
 * A contagem por ciclo, que e o que decide o `length` do layout.
 *
 * O `normalizarFrames` corta no MENOR do grupo. Divergencia aqui nao e
 * erro — a ferramenta resolve cortando — mas e bom saber que numero vai
 * sobrar antes de rodar, porque o `length` do `layout.js` foi escrito
 * para o menor
 */
console.log("");

for (const ciclo of CICLOS) {
  const doCiclo = medidas.filter((m) => m.ciclo === ciclo);

  if (doCiclo.length === 0) continue;

  const counts = [
    ...new Set(doCiclo.map((m) => m.frames)),
  ].sort((a, b) => a - b);

  console.log(
    `  ${ciclo.padEnd(7)} ${doCiclo.length} lanes, ` +
      (counts.length === 1
        ? `${counts[0]} quadros em todas`
        : `quadros ${counts.join("/")} -> corta em ${counts[0]}`),
  );
}

if (avisos.length > 0) {
  console.log("");

  for (const aviso of avisos) {
    console.log(`  AVISO ${aviso}`);
  }
}