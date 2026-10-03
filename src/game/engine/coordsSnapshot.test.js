import { describe, expect, it } from "vitest";

import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

installDomStubs();

/**
 * A COORDENADA CHEGANDO AO HUD.
 *
 * O mostrador da coluna esquerda so mostra algo se o `snapshot` trouxer
 * `x` e `y` do jogador. Este arquivo mede essa ponte, do mundo ate o
 * objeto que o `HUD` recebe
 *
 * E mede o ARREDONDAMENTO, que e o detalhe: sem ele o mostrador
 * piscaria `1283.7291` varias vezes por segundo
 */

const classe = CHARACTER_CLASSES.find(
  (c) => c.id === "warbalist" || c.id === "warrior",
);

/**
 * O engine nao tem `getSnapshot()` publico: o snapshot e montado dentro
 * do `sendSnapshot` e entregue pelo callback `onSnapshot`, que e o
 * mesmo caminho que o `useGameClient` usa para alimentar o HUD
 */
function criar() {
  const canvas = createTestCanvas();

  const recebidos = [];

  const engine = new GameEngine(
    canvas.element,
    classe,
    (snapshot) => {
      recebidos.push(snapshot);
    },
  );

  engine.setMap(MAP_1);

  return { engine, recebidos, ultimo: () => recebidos.at(-1) };
}

describe("a posicao no snapshot", () => {
  it("o snapshot traz x e y do jogador", () => {
    const { engine, ultimo } = criar();

    engine.sendSnapshot();

    const snapshot = ultimo();

    expect(snapshot, "nenhum snapshot chegou").toBeTruthy();
    expect(snapshot.player.x).toBeTypeOf("number");
    expect(snapshot.player.y).toBeTypeOf("number");

    engine.destroy();
  });

  it("a posicao bate com a do mundo", () => {
    const { engine, ultimo } = criar();

    const player = engine.world.player;

    engine.sendSnapshot();

    const snapshot = ultimo();

    expect(snapshot.player.x).toBe(Math.round(player.x));
    expect(snapshot.player.y).toBe(Math.round(player.y));

    engine.destroy();
  });

  it("e numero INTEIRO, para nao piscar casas decimais", () => {
    const { engine, ultimo } = criar();

    const player = engine.world.player;

    // valores fracionados de proposito
    player.x = 1283.7291;
    player.y = 799.5;

    engine.sendSnapshot();

    const snapshot = ultimo();

    expect(snapshot.player.x).toBe(1284);
    expect(snapshot.player.y).toBe(800);

    expect(Number.isInteger(snapshot.player.x)).toBe(true);
    expect(Number.isInteger(snapshot.player.y)).toBe(true);

    engine.destroy();
  });

  it("acompanha o jogador andando", () => {
    const { engine, ultimo } = criar();

    const player = engine.world.player;

    engine.sendSnapshot();

    const antes = ultimo().player.x;

    engine.input.keys.clear();
    engine.input.keys.add("KeyD");

    for (let i = 0; i < 60; i += 1) {
      engine.update(1 / 60);
    }

    engine.sendSnapshot();

    const depois = ultimo().player.x;

    expect(depois).toBeGreaterThan(antes);

    expect(depois).toBe(Math.round(player.x));

    engine.destroy();
  });

  it("a posicao do jogador nao e a de um inimigo", () => {
    const { engine, ultimo } = criar();

    const player = engine.world.player;

    // tira todos os inimigos do mapa
    engine.world.enemies.length = 0;

    engine.sendSnapshot();

    expect(ultimo().player.x).toBe(Math.round(player.x));

    engine.destroy();
  });
});