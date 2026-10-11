/**
 * CONFERE O CHEFE DO CENTRO DO VALE.
 *
 * Existe porque o chefe do vale foi DERIVADO do `hulk` em runtime, e uma
 * derivacao pode sair errada de tres jeitos que o build nao pega:
 *
 * - o `createCreature` escalando o nivel DUAS vezes (o comentario da arena
 *   avisa disso: passar `boss.level` no mapa reescala o que ja foi escalado)
 * - o sprite devolvendo `null` por falta do `typeId` no `ENEMY_SPRITES`, e o
 *   chefe aparecer sem arte nenhuma
 * - a criatura herdando `id: "hulk"` do `hulk` e colidindo com o chefe da
 *   arena no bestiario e no `onKill`
 */
import { MAP_TESTE, MAP_1_CENTRO, MAP_1_SPAWN_COM_CHEFE } from "../src/data/maps/index.js";
import { BOSS_1_MAP } from "../src/data/maps/boss1.js";
import { CREATURE_TYPES, createCreature } from "../src/data/enemies/index.js";
import { getEnemySprite } from "../src/data/sprites/enemyLayout.js";

console.log("=== mapa ===");
console.log(`  spawn do vale:  (${MAP_TESTE.spawn.x}, ${MAP_TESTE.spawn.y})`);
console.log(`  centro do vale: (${MAP_1_CENTRO.x}, ${MAP_1_CENTRO.y})`);
console.log(`  bosses: ${MAP_TESTE.bosses?.length ?? 0}`);

const b = MAP_TESTE.bosses?.[0];
console.log(`  chefe: ${b?.creature} em (${b?.x}, ${b?.y})`);

console.log("\n=== o chefe nasce no ponto pedido? ===");
const noCentro = b && b.x === MAP_1_CENTRO.x && b.y === MAP_1_CENTRO.y;
console.log(`  no centro exato: ${noCentro ? "SIM" : "NAO"}`);

const dist = Math.hypot(MAP_TESTE.spawn.x - b.x, MAP_TESTE.spawn.y - b.y);
console.log(`  distancia spawn -> chefe: ${dist.toFixed(0)}px`);
console.log(`  fora do aggro (${CREATURE_TYPES.hulk_val.aggroRange}): ${dist > CREATURE_TYPES.hulk_val.aggroRange ? "SIM" : "NAO — o jogador ja nasce na briga"}`);

console.log("\n=== a criatura, ja escalada pelo createCreature ===");
const c = createCreature("hulk_val", { x: b.x, y: b.y }, 9000, null);
for (const k of ["typeId", "level", "hp", "damage", "defense", "radius", "speed", "aggroRange", "attackRange", "leash"]) {
  console.log(`  ${k.padEnd(12)} ${c[k]}`);
}

console.log("\n=== o desenho resolve? ===");
const sprite = getEnemySprite(c.typeId);
console.log(`  getEnemySprite("${c.typeId}"): ${sprite ? "achou" : "NULL — chefe sem arte"}`);
console.log(`  scale desenhado: ${sprite?.scale}`);
const hulkArena = getEnemySprite("hulk");
console.log(`  scale do hulk da arena: ${hulkArena?.scale}  (nao pode ter mudado)`);

console.log("\n=== a colisao com a arte? ===");
const px = 68 * (sprite?.scale ?? 0);
console.log(`  arte: 68 x ${sprite?.scale} = ${px}px de largura`);
console.log(`  raio do colisor: ${c.radius}`);
console.log(`  o colisor cobre a arte? ${c.radius >= px / 2 - 10 ? "SIM" : "NAO — raio " + c.radius + " para arte de " + px}`);

console.log("\n=== o golpe chega alem do corpo? ===");
const sobraGolpe = c.attackRange - c.radius;
console.log(`  attackRange ${c.attackRange} - radius ${c.radius} = ${sobraGolpe}px de golpe alem do colisor`);
const sobraArena = (() => {
  const a = createCreature("hulk", { x: 0, y: 0 }, 1, null);
  return a.attackRange - a.radius;
})();
console.log(`  a arena deixa ${sobraArena}px  (o chefe do vale nao pode dar MENOS que isso)`);
console.log(`  veredito: ${sobraGolpe >= sobraArena ? "ok" : "golpe curto demais"}`);

console.log("\n=== os numeros escalaram de verdade? ===");
const arena = BOSS_1_MAP.bosses?.[0];
const ca = createCreature("hulk", { x: arena.x, y: arena.y }, 9000, null);
console.log(`  arena:  nivel ${ca.level}  hp ${ca.hp}  dano ${ca.damage}`);
console.log(`  vale:   nivel ${c.level}  hp ${c.hp}  dano ${c.damage}`);
console.log(`  hp do vale > arena? ${c.hp > ca.hp ? "SIM" : "NAO — o chefe grande tem o mesmo HP"}`);
console.log(`  dano do vale > arena? ${c.damage > ca.damage ? "SIM" : "NAO — o chefe grande tem o mesmo dano"}`);

console.log("\n=== o chefe da arena foi preservado? ===");
console.log(`  arena: ${arena?.creature} em (${arena?.x}, ${arena?.y})`);
console.log(`  escala ${getEnemySprite("hulk")?.scale}`);

console.log("\n=== os ids colidem? ===");
console.log(`  id do vale:   ${c.id}`);
console.log(`  id da arena: ${ca.id}`);
console.log(`  typeId igual? ${c.typeId === ca.typeId ? "SIM — COLISAO" : "nao, sao criaturas distintas"}`);

console.log("\n=== o loot pagou mais? ===");
console.log(`  arena coins: ${JSON.stringify(ca.loot?.coins)}  maxItems ${ca.loot?.maxItems}`);
console.log(`  vale  coins: ${JSON.stringify(c.loot?.coins)}  maxItems ${c.loot?.maxItems}`);
const pagou = (c.loot?.coins?.min ?? 0) > (ca.loot?.coins?.min ?? 0);
console.log(`  paga mais que a arena? ${pagou ? "SIM" : "NAO"}`);

console.log("\n=== o spawn ainda esta longe do chefe? ===");
console.log(`  distancia: ${dist.toFixed(0)}px  |  aggro ${c.aggroRange}`);
console.log(`  jogador nasce fora do aggro? ${dist > c.aggroRange ? "SIM" : "NAO"}`);

console.log("\n=== a arena nao foi encostada? ===");
console.log(`  ${ca.typeId}: nivel ${ca.level}, hp ${ca.hp}, dano ${ca.damage}, raio ${ca.radius}, escala ${getEnemySprite("hulk")?.scale}`);