import { ITEM_LIST, RARITY_STAT_SCALE, RARITY_COST_SCALE, RARITY_ORDER } from "./src/data/items/index.js";

console.log("escala stat:", JSON.stringify(RARITY_STAT_SCALE));
console.log("escala custo:", JSON.stringify(RARITY_COST_SCALE));
console.log("\nitemId | tipo | raridadeBase | tier | value");
for (const it of ITEM_LIST) {
  console.log([it.id, it.type, it.rarity, it.tier, it.value].join(" | "));
}
