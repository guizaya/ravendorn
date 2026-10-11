/**
 * CONFERE OS DOIS COMPORTAMENTOS DO CHEFE DO VALE:
 *
 *   1. chegando no limite (leash), ele volta ANDANDO para o ponto de origem
 *   2. sem alvo dentro da aggroRange, ele volta RAPIDO
 *
 * O `moveToward` e substituido por um stub que registra a VELOCIDADE
 * recebida, sem mover ninguem. E o que permite medir a diferenca entre
 * "andou no passo" e "andou rapido" sem rodar 60 segundos de simulacao.
 */
import { EnemyAI } from "../src/game/enemies/EnemyAI.js";
import { MAP_TESTE, MAP_1_CENTRO } from "../src/data/maps/index.js";
import { CREATURE_TYPES, createCreature } from "../src/data/enemies/index.js";

const h = CREATURE_TYPES.hulk_val;
const HOME = MAP_1_CENTRO;

/** o ai com moveToward que so registra a velocidade */
function aiDeTeste(jogadores = []) {
  const registros = [];
  const ai = new EnemyAI({
    player: null,
    players: new Map(),
    enemies: [],
    map: MAP_TESTE,
    collision: { isPositionFree: () => true, moveEntity: () => true },
  });
  // o mundo precisa enxergar o jogador para o nearestPlayer achar
  ai.nearestPlayer = () => jogadores[0] ?? null;
  ai.moveToward = (enemy, target, dt, speed) => {
    registros.push(speed);
    return true;
  };
  return { ai, registros };
}

/**
 * O CHEFE COMO O MOTOR CONSTRUIRIA, e nao um objeto escrito a mao.
 *
 * A primeira versao deste script montava o inimigo na mao e esqueceu o
 * `velocidadeDeRetorno` â€” e o resultado foi "a regra nao funciona" quando o
 * defeito era do teste. Passar por `createCreature` garante que o objeto tem
 * todos os campos que o catalogo declara, que e o que o motor faz
 *
 * O `casa` e o ponto de origem: o `createCreature` grava `spawnX/spawnY` na
 * posicao que recebe, entao para simular um chefe ARRASTADO para longe de
 * casa e preciso criar ele em `casa` e so entao mover o `x/y`
 */
function chefeArrastadoPara(px, py, casa = HOME) {
  const c = createCreature("hulk_val", { x: casa.x, y: casa.y }, 9000, null);
  c.x = px;
  c.y = py;
  return c;
}

console.log("=== os numeros declarados ===");
console.log(`  speed normal do chefe:      ${h.speed}`);
console.log(`  velocidadeDeRetorno:        ${h.velocidadeDeRetorno}`);
console.log(`  aggroRange:                 ${h.aggroRange}`);
console.log(`  leash:                      ${h.leash}`);

console.log("\n=== 1. no limite, volta andando para o spawn? ===");
// longe do spawn, dentro do leash, mas o jogador arrastou para ca
{
  const longe = chefeArrastadoPara(HOME.x + 700, HOME.y);
  const { ai, registros } = aiDeTeste([]);
  ai.updateBehavior(longe, 1 / 60);
  console.log(`  pos: (${longe.x},${longe.y})  distancia do spawn: ${Math.hypot(longe.x - HOME.x, longe.y - HOME.y)}`);
  console.log(`  estado: "${longe.aiState}"`);
  console.log(`  andou? ${registros.length > 0 ? "SIM, velocidade " + registros[0] : "NAO"}`);
  console.log(`  -> o alvo do movimento e o spawn? ${longe.aiState === "return" ? "SIM (estado return)" : "confere"}`);
}

console.log("\n=== 2. sem alvo na range: volta rapido? ===");
// o jogador sumiu: ninguem dentro da aggroRange
{
  const longe = chefeArrastadoPara(HOME.x + 700, HOME.y);
  const { ai, registros } = aiDeTeste([]);
  ai.updateBehavior(longe, 1 / 60);
  console.log(`  SEM ninguem por perto -> velocidade usada: ${registros[0]}`);
  console.log(`  e a de retorno (${h.velocidadeDeRetorno})? ${registros[0] === h.velocidadeDeRetorno ? "SIM" : "NAO, usou " + registros[0]}`);
  console.log(`  e mais rapido que o passo normal (${h.speed})? ${registros[0] > h.speed ? "SIM, " + (registros[0] / h.speed).toFixed(1) + "x" : "NAO"}`);
}

console.log("\n=== 3. COM alvo na range: nao e retorno, e combate ===");
// jogador perto o bastante para contar como alvo, mas longe do spawn
{
  const longe = chefeArrastadoPara(HOME.x + 700, HOME.y);
  const jogadorPerto = { x: longe.x + 100, y: longe.y, hp: 100 };
  const { ai, registros } = aiDeTeste([jogadorPerto]);
  ai.updateBehavior(longe, 1 / 60);
  console.log(`  jogador a ${Math.hypot(jogadorPerto.x - longe.x, jogadorPerto.y - longe.y)}px (aggro ${h.aggroRange})`);
  console.log(`  estado: "${longe.aiState}"  <- com alvo perto ele vai para combate/chase, nao para o retorno`);
  console.log(`  velocidade de retorno aplicada? ${registros.length === 0 ? "NAO, ele nao esta retornando" : "SIM"}`);
  console.log(`  -> e o comportamento esperado: com alguem na range o chefe briga, e so volta quando o alvo sai`);
}

console.log("\n=== 4. o jogador LONGE (fora da aggro) tambem e rapido? ===");
// jogador longe demais: nao conta como alvo, retorno tem que ser rapido
{
  const longe = chefeArrastadoPara(HOME.x + 700, HOME.y);
  const jogadorLonge = { x: HOME.x, y: HOME.y, hp: 100 };
  const { ai, registros } = aiDeTeste([jogadorLonge]);
  ai.updateBehavior(longe, 1 / 60);
  console.log(`  jogador a ${Math.hypot(jogadorLonge.x - longe.x, jogadorLonge.y - longe.y)}px do chefe (aggro ${h.aggroRange})`);
  console.log(`  velocidade usada: ${registros[0]} -> rapido? ${registros[0] === h.velocidadeDeRetorno ? "SIM" : "NAO"}`);
}

console.log("\n=== 5. a arena nao foi encostada? ===");
{
  const arenaHulk = CREATURE_TYPES.hulk;
  const e = createCreature("hulk", { x: 100, y: 100 }, 9000, null);
  e.x = 900;
  e.y = 100;
  const { ai, registros } = aiDeTeste([]);
  ai.updateBehavior(e, 1 / 60);
  console.log(`  hulk da arena velocidadeDeRetorno: ${arenaHulk.velocidadeDeRetorno ?? "(ausente)"}`);
  console.log(`  arrastado para 900px de casa, sem alvo:`);
  console.log(`  velocidade usada: ${registros[0]}`);
  console.log(`  sem o campo, cai no speed normal (${arenaHulk.speed})? ${registros[0] === arenaHulk.speed ? "SIM" : "NAO, usou " + registros[0]}`);
}

console.log("\n=== 6. mob comum nao ganhou o campo? ===");
for (const nome of ["slime", "goblin", "ogre", "skeleton"]) {
  const c = CREATURE_TYPES[nome];
  console.log(`  ${nome.padEnd(9)} velocidadeDeRetorno: ${c?.velocidadeDeRetorno ?? "(ausente)"}`);
}
