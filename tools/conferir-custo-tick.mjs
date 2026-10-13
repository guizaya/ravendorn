/**
 * ONDE A CPU DO MOTOR VAI, POR TICK.
 *
 * ## POR QUE MEDIR E NAO ADIVINHAR
 *
 * Porque "este laço parece lento" e um palpite, e trocar um laço por outro
 * com base em palpite costuma trocar um problema pequeno por um grande. O
 * que interessa e o numero: quanto de 50ms cada parte do tick gasta
 *
 * ## E POR QUE ISTO NAO E O ITEM 3 INTEIRO
 *
 * Porque o motor roda UMA vez por tick, e so o que ele faz antes da rede
 * conta. O resto do item 3 mede a serializacao e a difusao, que e onde o
 * multiplayer costuma pesar de verdade
 */

import { GameEngine } from "../src/game/engine/GameEngine.js";
import { registrarTilesDoDisco } from "../server/src/maps/tilesDoDisco.js";
import { CHARACTER_CLASSES } from "../src/data/characters/index.js";
import { getMap } from "../src/data/maps/index.js";

registrarTilesDoDisco();

const motor = new GameEngine(null, CHARACTER_CLASSES[0], null, { playerId: "p" });
motor.setMap(getMap("map_1"));

const ORCAMENTO_MS = 50;
const DELTA = 1 / 20;

function medir(nome, voltas, fn) {
  fn();

  const t0 = process.hrtime.bigint();

  for (let i = 0; i < voltas; i++) fn();

  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / voltas;

  console.log("  " + nome.padEnd(36) + ms.toFixed(4) + "ms");

  return ms;
}

const inimigos = motor.world.enemies.length;

console.log("\n  O MUNDO QUE ESTA RODANDO\n");
console.log("  inimigos: " + inimigos);
console.log("  props:    " + (motor.world.props?.length ?? 0));
console.log("  drops:    " + motor.world.drops.length);
console.log("  portais:  " + (motor.world.portals?.length ?? 0));

console.log("\n  O CUSTO DE UM TICK\n");

const tUpdate = medir("engine.update(1/20)", 400, () => motor.update(DELTA));

console.log("\n  QUANTO DO ORCAMENTO DE " + ORCAMENTO_MS + "ms CADA TICK USA\n");
console.log("  motor:            " + (tUpdate / ORCAMENTO_MS * 100).toFixed(2) + "%");
console.log("  por segundo (20x):" + (tUpdate * 20).toFixed(2) + "ms de CPU");

console.log("\n  QUANTOS JOGADORES ENCHERIAM A MAQUINA (so o motor, sem rede)\n");

for (const n of [1, 5, 10, 25, 50, 100, 200]) {
  const ms = tUpdate * n;

  console.log(
    "  " + String(n).padStart(4) + " jogadores:  " +
    ms.toFixed(2).padStart(7) + "ms por tick   " +
    (ms <= ORCAMENTO_MS ? "cabe" : "ESTOURA"),
  );
}

console.log("");