import { groundTileSizeFor, ZONE_TILE_SIZE, GROUND_TILE_SIZE } from "../src/data/terrain/index.js";
import { MAP_1, MAP_2, MAP_TESTE } from "../src/data/maps/index.js";

console.log("  GROUND_TILE_SIZE (padrao):", GROUND_TILE_SIZE);
console.log("  ZONE_TILE_SIZE           :", ZONE_TILE_SIZE);
console.log("");

console.log("  por chave de groundTile:");
for (const k of ["grama", "cidade", "neve", "dark", "boss"]) {
  console.log(`    ${k.padEnd(8)} -> ${groundTileSizeFor({ groundTile: k })}px`);
}

console.log("");
console.log("  por mapa:");
for (const [nome, m] of [["MAP_1", MAP_1], ["MAP_2", MAP_2], ["MAP_TESTE", MAP_TESTE]]) {
  console.log(`    ${nome.padEnd(10)} groundTile=${String(m.groundTile).padEnd(8)} -> ${groundTileSizeFor(m)}px`);
}