/**
 * O CUSTO DA REDE, que e onde o multiplayer pesa de verdade.
 *
 * ## POR QUE ISTO E O ITEM 3 E NAO O `conferir-custo-tick`
 *
 * Porque o motor roda uma vez por tick e gasta 0.57ms — medido, cabe para
 * ~87 jogadores na mesma maquina. O que multiplica por numero de jogador e
 * o que vem DEPOIS: montar o estado e serializar, uma vez por jogador que
 * esta online, a 20Hz
 *
 * E o custo cresce em DUAS direcoes, e as duas importam:
 *
 *   1. mais jogadores online, mais vezes o pacote e montado e serializado
 *   2. mais criaturas no mapa, mais bytes dentro de CADA pacote
 *
 * ## POR QUE MEDIR O `JSON.stringify` E NAO O `send`
 *
 * Porque `send` depende de um socket de verdade. O `JSON.stringify` e a
 * parte que o codigo controla, e e ela que cresce com o numero de
 * criaturas — o resto e a maquina de socket, que nao esta no nosso codigo
 */

import { GameEngine } from "../src/game/engine/GameEngine.js";
import { registrarTilesDoDisco } from "../server/src/maps/tilesDoDisco.js";
import { CHARACTER_CLASSES } from "../src/data/characters/index.js";
import { getMap } from "../src/data/maps/index.js";
import { MAX_SNAPSHOT_BYTES } from "../src/shared/protocol.js";

registrarTilesDoDisco();

const motor = new GameEngine(null, CHARACTER_CLASSES[0], null, { playerId: "p" });
motor.setMap(getMap("map_1"));

const INTERESSE_QUADRADO = 1600 * 1600;

/** O MESMO QUE `GameServer.estadoInimigos`, sem o socket */
function estadoInimigos(client) {
  const lista = [];
  const px = client?.session?.player?.x ?? 0;
  const py = client?.session?.player?.y ?? 0;

  for (const inimigo of motor.world.enemies) {
    const dx = inimigo.x - px;
    const dy = inimigo.y - py;

    if (dx * dx + dy * dy > INTERESSE_QUADRADO) continue;

    lista.push({
      id: inimigo.id,
      kind: inimigo.kind,
      x: Math.round(inimigo.x),
      y: Math.round(inimigo.y),
      level: inimigo.level,
      hp: Math.round(inimigo.hp),
      maxHp: inimigo.maxHp,
      alive: inimigo.alive,
    });
  }

  return lista;
}

function estadoJogadores() {
  return motor.world.enemies.length ? [{ id: "p", x: 0, y: 0, life: 100 }] : [];
}

function pacote() {
  return {
    seq: 1,
    time: motor.world.time,
    mapa: "map_1",
    players: estadoJogadores(),
    enemies: estadoInimigos({ session: { player: motor.world.player } }),
    drops: motor.world.drops.map((d) => ({ uid: d.uid, x: Math.round(d.x), y: Math.round(d.y) })),
    projectiles: motor.world.projectiles.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y) })),
  };
}

function medir(nome, voltas, fn) {
  fn();

  const t0 = process.hrtime.bigint();

  for (let i = 0; i < voltas; i++) fn();

  return { nome, ms: Number(process.hrtime.bigint() - t0) / 1e6 / voltas };
}

console.log("\n  O PACOTE DE UM JOGADOR\n");

const exemplo = pacote();

const serializado = JSON.stringify(exemplo);

console.log("  inimigos no pacote: " + exemplo.enemies.length + " de " + motor.world.enemies.length + " no mapa");
console.log("  tamanho do pacote:   " + (serializado.length / 1024).toFixed(2) + " KB");
console.log("  teto do protocolo:   " + (MAX_SNAPSHOT_BYTES / 1024).toFixed(0) + " KB");
console.log("  uso do teto:         " + (serializado.length / MAX_SNAPSHOT_BYTES * 100).toFixed(2) + "%");

console.log("\n  O CUSTO DE MONTAR E SERIALIZAR UM PACOTE\n");

const tUm = medir("1 pacote", 3000, () => JSON.stringify(pacote()));

console.log("  " + tUm.nome.padEnd(20) + tUm.ms.toFixed(4) + "ms");
console.log("  " + "x 20 ticks/seg".padEnd(20) + (tUm.ms * 20).toFixed(3) + "ms por segundo, por jogador");

console.log("\n  QUANTOS JOGADORES ENCHERIAM O ORCAMENTO DE 50ms SÓ NA REDE\n");

for (const n of [1, 10, 50, 100, 250, 500, 1000]) {
  const ms = tUm.ms * n;

  console.log(
    "  " + String(n).padStart(5) + " jogadores: " +
    ms.toFixed(2).padStart(8) + "ms por tick   " +
    (ms <= 50 ? "cabe" : "ESTOURA"),
  );
}

console.log("\n  E QUANDO O MAPA CRESCE\n");

console.log("  inimigos   tempo por pacote   tempo x 100 jogadores   bandwidth x 100");

const base = motor.world.enemies.length;

for (const mult of [1, 4, 10]) {
  const original = motor.world.enemies;

  const clones = [];

  for (let i = 0; i < original.length * mult; i++) clones.push({ ...original[i % original.length], id: "e" + i });

  motor.world.enemies = clones;

  const t = medir(String(clones.length) + " inimigos", 800, () => JSON.stringify(pacote()));
  const ms100 = t.ms * 100;

  console.log(
    "  " + String(clones.length).padStart(8) + "   " +
    t.ms.toFixed(4).padStart(12) + "ms   " +
    (ms100 > 50 ? "ESTOURA" : ms100.toFixed(1).padStart(6) + "ms").padStart(22) + "   " +
    (t.ms * 100 * 20 / 1000).toFixed(1).padStart(9) + " MB/s",
  );

  motor.world.enemies = original;
}

console.log("");
console.log("  o mapa base tem " + base + " inimigos\n");