import { COLLECTIONS } from "./src/data/collection/index.js";
import { CREATURE_TYPES } from "./src/data/enemies/index.js";

const dropadores = new Set();
for (const t of Object.keys(CREATURE_TYPES)) {
  for (const i of CREATURE_TYPES[t].loot?.items ?? []) dropadores.add(i.id);
}

console.log("=== COLECOES ===");
for (const c of COLLECTIONS) {
  console.log(c.id, "|", c.name);
  for (const r of c.requirements) {
    if (r.type === "MATERIAL") {
      const ok = dropadores.has(r.itemId);
      console.log("   ", r.itemId.padEnd(15), "x" + String(r.count).padEnd(4),
        `(${r.fator}x de ${r.baseDaMissao})`, ok ? "" : "  <<< NAO EXISTE NO MAPA");
    } else {
      console.log("   ", "equipmento".padEnd(15), "x" + r.count);
    }
  }
}
console.log("\ntotal de colecoes:", COLLECTIONS.length);
