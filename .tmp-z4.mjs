import { createCreatureRoster } from "./src/data/enemies/index.js";
import { getMap, getZoneById } from "./src/data/maps/index.js";

const mapa = getMap("map_2");
const roster = createCreatureRoster(mapa);
console.log("campos de uma criatura:", Object.keys(roster[0]).join(", "));
const c = roster.find(x => x.level === 20);
console.log("\namostra nv20:", JSON.stringify({ id: c.id, typeId: c.typeId, level: c.level, x: Math.round(c.x), y: Math.round(c.y) }));
const zonas = new Set(roster.map(x => x.id));
console.log("\nids por zona (prefixo m2_应该):", [...zonas].slice(0,3).join(", "));
