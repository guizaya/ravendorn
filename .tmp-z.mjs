import { MAP_1_ZONES } from "./src/data/maps/index.js";
for (const z of MAP_1_ZONES) console.log(String(z.id).padEnd(14), "x", z.x, "y", z.y, "| nome:", z.name);
console.log("\n(178,180) cai em:", MAP_1_ZONES.find(z => 178>=z.x && 178<=z.x+z.width && 180>=z.y && 180<=z.y+z.height)?.id);
