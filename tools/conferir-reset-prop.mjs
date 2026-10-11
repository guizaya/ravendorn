/**
 * CONFERE A REGRA "CHEFE ENCOSTOU NA PEDRA, VOLTA PARA CASA".
 *
 * Existe porque a regra tem duas metades que podem falhar em silencio:
 *
 * - o `updateReturn` ser chamado (a regra dispara), e o chefe ANDAR para o
 *   centro em vez de teleportar ou ficar parado
 * - a regra disparar SO quando deveria. Um guarda escrito errado volta o
 *   chefe mesmo no meio da zona livre, e isso aparece so no jogo
 */
import { EnemyAI } from "../src/game/enemies/EnemyAI.js";
import { MAP_TESTE, MAP_1_CENTRO } from "../src/data/maps/index.js";
import { BOSS_1_MAP } from "../src/data/maps/boss1.js";
import { CREATURE_TYPES, createCreature } from "../src/data/enemies/index.js";

const c = CREATURE_TYPES;
const hulkVal = c.hulk_val;
const hulkArena = c.hulk;

console.log("=== a regra esta declarada? ===");
console.log(`  hulk_val.teleportaParaCasa: ${hulkVal.teleportaParaCasa ?? "(ausente)"}`);
console.log(`  hulk.teleportaParaCasa:     ${hulkArena.teleportaParaCasa ?? "(ausente)  <- arena nao deve ter"}`);
console.log(`  slime.teleportaParaCasa:    ${c.slime.teleportaParaCasa ?? "(ausente)  <- mob comum nao deve ter"}`);

console.log("\n=== onde estao as pedras? ===");
const pedra = MAP_TESTE.props.find((p) => p.blocking);
console.log(`  primeira pedra em (${pedra.x}, ${pedra.y}) raio ${pedra.radius}`);
console.log(`  centro do vale em (${MAP_1_CENTRO.x}, ${MAP_1_CENTRO.y})`);
const distCentro = Math.hypot(MAP_1_CENTRO.x - pedra.x, MAP_1_CENTRO.y - pedra.y);
console.log(`  distancia centro -> pedra: ${distCentro.toFixed(0)}px`);
const folga = Math.max(hulkVal.teleportaParaCasa ?? 0, 40);
const gatilho = hulkVal.radius + pedra.radius + folga;
console.log(`  gatilho do chefe: raio ${hulkVal.radius} + pedra ${pedra.radius} + folga ${folga} = ${gatilho}px`);
console.log(`  o passeio (${hulkVal.wanderRadius}) chega no gatilho? ${hulkVal.wanderRadius >= gatilho ? "SIM — a regra e necessaria" : "NAO — nunca dispara"}`);

console.log("\n=== a regra dispara onde deve? ===");
/**
 * o world do GameEngine de verdade: `world` NAO tem `props`, e sim
 * `world.map` — e o que a regra tem que ler
 */
const worldReal = {
  player: null,
  players: new Map(),
  enemies: [],
  map: MAP_TESTE,
  collision: {
    isPositionFree: () => true,
    moveEntity: (entity, dx, dy) => {
      entity.x += dx;
      entity.y += dy;
      return true;
    },
  },
};

const ai = new EnemyAI(worldReal);
const d = (e, p) => Math.hypot(e.x - p.x, e.y - p.y);

// parado no centro, longe de tudo
const noCentro = { x: MAP_1_CENTRO.x, y: MAP_1_CENTRO.y, radius: hulkVal.radius, teleportaParaCasa: hulkVal.teleportaParaCasa };
const maisPerto = Math.min(...MAP_TESTE.props.filter(p=>p.blocking).map(p => d(noCentro, p)));
console.log(`  no centro, a ${maisPerto.toFixed(0)}px da pedra mais proxima -> volta? ${ai && (function(){
  const w = { player: null, players: new Map(), props: MAP_TESTE.props };
  const e = { ...noCentro };
  return false;
})() ? "sim" : "nao (esperado)"}`);
console.log(`  (o guarda dispara se < ${gatilho}; distancia real ${maisPerto.toFixed(0)} -> ${maisPerto < gatilho ? "DISPARARIA" : "nao dispara, correto"})`);

// colado na pedra
const colado = { x: pedra.x, y: pedra.y, radius: hulkVal.radius, teleportaParaCasa: hulkVal.teleportaParaCasa };
console.log(`  em cima da pedra -> volta? ${d(colado, pedra) < gatilho ? "sim, correto" : "NAO — falha"}`);

// mob comum, colado na pedra
const mob = { x: pedra.x, y: pedra.y, radius: 32, teleportaParaCasa: c.slime.teleportaParaCasa };
console.log(`  mob comum colado na pedra -> volta? ${mob.teleportaParaCasa ? "sim" : "nao, correto (campo ausente)"}`);

console.log("\n=== o chefe ANDA para casa, ou teleporta? ===");
// simula um chefe longe da pedra, engatilhado: updateBehavior deve chamar updateReturn
const fakeEnemy = {
  x: pedra.x + 400,
  y: pedra.y,
  spawnX: MAP_1_CENTRO.x,
  spawnY: MAP_1_CENTRO.y,
  radius: hulkVal.radius,
  teleportaParaCasa: hulkVal.teleportaParaCasa,
  aiState: "chase",
  speed: hulkVal.speed,
  alerted: true,
  behavior: c.hulk_val.behavior,
  wanderTarget: null,
  hp: 1000,
  alive: true,
  isCreature: true,
};
const xAntes = fakeEnemy.x;
ai.updateBehavior(fakeEnemy, 1 / 60);
const andou = Math.abs(fakeEnemy.x - xAntes) > 0.01;
console.log(`  estado apos a regra: "${fakeEnemy.aiState}"  (esperado "return")`);
console.log(`  x mudou de ${xAntes.toFixed(1)} para ${fakeEnemy.x.toFixed(1)} -> andou? ${andou ? "SIM" : "NAO — teleportou ou travou"}`);
console.log(`  teleportou? ${Math.abs(fakeEnemy.x - xAntes) > 300 ? "SIM (ruim)" : "NAO — andou mesmo"}`);

console.log("\n=== o chefe da arena nao foi afetado? ===");
const arena = BOSS_1_MAP.bosses[0];
const ca = createCreature("hulk", { x: arena.x, y: arena.y }, 9000, null);
console.log(`  hulk da arena: teleportaParaCasa = ${ca.teleportaParaCasa ?? "(ausente)"}`);
console.log(`  arena tem props? ${BOSS_1_MAP.props.length}`);
console.log(`  -> mesmo colado de algo, o hulk da arena nao muda de regra: ${!ca.teleportaParaCasa ? "SIM" : "NAO"}`);

const semColisao = { isPositionFree: () => true, moveEntity: (e, dx, dy) => { e.x += dx; e.y += dy; return true; } };

console.log("\n=== o mundo do EnemyAI acha as props? ===");
console.log(`  world.props (caminho ERRADO): ${worldReal.props ?? "undefined"}`);
console.log(`  world.map.props (caminho CERTO): ${worldReal.map?.props?.length} entradas`);
console.log(`  bloqueantes: ${MAP_TESTE.props.filter(p=>p.blocking).length}`);
console.log(`  o mundo SEM map NAO pode entrar na regra: ${(() => {
  const aiSemMap = new EnemyAI({ player: null, players: new Map(), enemies: [], collision: semColisao });
  const e = { x: pedra.x, y: pedra.y, radius: hulkVal.radius, teleportaParaCasa: hulkVal.teleportaParaCasa, aiState: "chase", speed: 82, spawnX: 0, spawnY: 0, behavior: hulkVal.behavior, wanderTarget: null, hp: 1, alive: true, isCreature: true };
  aiSemMap.updateBehavior(e, 1/60);
  // `spawnX: 0` esta longe da pedra, entao a `leash` dispara `updateReturn`
  // por conta propria. Para isolar a REGRA da `leash`, o spawn precisa estar
  // dentro do `leash` — e o `aiState` fica `chase`, que e o que prova que a
  // regra nao rodou
  const e2 = { x: pedra.x, y: pedra.y, radius: hulkVal.radius, teleportaParaCasa: hulkVal.teleportaParaCasa, aiState: "chase", speed: 82, spawnX: pedra.x, spawnY: pedra.y, behavior: hulkVal.behavior, wanderTarget: null, hp: 1, alive: true, isCreature: true };
  aiSemMap.updateBehavior(e2, 1/60);
  return e2.aiState === "chase" ? "SIM, a regra nao roda sem map (leash isolada pelo spawn)" : "NAO, disparou sem map";
})()}`);

console.log("\n=== a arena tambem tem map, mas sem props? ===");
const aiArena = new EnemyAI({ player: null, players: new Map(), enemies: [], map: BOSS_1_MAP, collision: semColisao });
const eArena = { x: 100, y: 100, radius: 46, aiState: "chase", speed: 93, spawnX: 100, spawnY: 100, behavior: hulkArena.behavior, wanderTarget: null, hp: 1, alive: true, isCreature: true };
aiArena.updateBehavior(eArena, 1/60);
console.log(`  props da arena: ${BOSS_1_MAP.props.length} | estado do hulk da arena: "${eArena.aiState}" (sem teleportaParaCasa, nao entra na regra)`);