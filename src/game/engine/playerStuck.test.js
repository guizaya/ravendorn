import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { getZoneById } from "../../data/maps/index.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

installDomStubs();

const WARRIOR = CHARACTER_CLASSES[0];

function createEngine(mapa = MAP_1) {
  const canvas = createTestCanvas();

  const engine = new GameEngine(
    canvas.element,
    WARRIOR,
    () => {},
  );

  engine.setMap(mapa);

  return engine;
}

/**
 * Um mapa com UM obstaculo, escrito a mao.
 *
 * As props foram tiradas do vale, entao `MAP_1.solids` esta vazio e
 * nao ha mais arvore nenhuma para o jogador cair dentro
 *
 * O que estes testes medem nao e a arvore: e o `GameEngine` devolvendo
 * o jogador para fora de um solido qualquer, e o tipo do solido nao
 * importa. Um mapa remontado com props resolveria, mas acoplaria este
 * arquivo as props — que e justamente o que deixou de ser conteudo do
 * mapa
 *
 * 60x60 com o raio do jogador em 22: o centro do jogador cabe inteiro
 * dentro do obstaculo, que e a situacao que o motor precisa desfazer
 */
function mapaComSolido() {
  const spawn = MAP_1.spawn;

  return {
    ...MAP_1,
    solids: [
      {
        x: spawn.x - 30,
        y: spawn.y - 230,
        width: 60,
        height: 60,
        kind: "obstaculoDeTeste",
      },
    ],
  };
}

function creatures(engine) {
  return engine.world.enemies.filter(
    (enemy) => enemy.isCreature,
  );
}

function holdKeys(engine, codes) {
  engine.input.keys.clear();

  for (const code of codes) engine.input.keys.add(code);
}

function openSpot(engine, x, y) {
  engine.world.collision.resolveOverlap(
    { x, y, radius: 22 },
    22,
  );

  return engine.world.collision.isPositionFree(
    { x, y },
    22,
  );
}

function parkEnemiesInRing(engine, center, count, spacing) {
  for (const enemy of creatures(engine)) {
    enemy.alive = false;
    enemy.respawnTimer = 9999;
  }

  const spawned = creatures(engine);

  for (let index = 0; index < Math.min(count, spawned.length); index += 1) {
    const angle = (index / count) * Math.PI * 2;

    const enemy = spawned[index];

    enemy.alive = true;
    enemy.hp = enemy.maxHp;
    enemy.aiState = "idle";
    enemy.alerted = false;
    enemy.provoked = false;
    enemy.wanderTarget = null;
    enemy.pushVelocity = { x: 0, y: 0 };

    enemy.x = center.x + Math.cos(angle) * spacing;
    enemy.y = center.y + Math.sin(angle) * spacing;

    enemy.spawnX = enemy.x;
    enemy.spawnY = enemy.y;
  }

  return spawned;
}

describe("jogador nao trava em inimigos", () => {
  it("atravessa uma turba que cerca o personagem", () => {
    const engine = createEngine();
    const player = engine.world.player;

    expect(
      openSpot(engine, 3000, 2100),
      "precisa de um ponto livre para o teste",
    ).toBe(true);

    player.x = 3000;
    player.y = 2100;
    player.hp = player.maxHp;

    parkEnemiesInRing(engine, player, 10, 40);

    const startX = player.x;

    holdKeys(engine, ["KeyD"]);

    for (let frame = 0; frame < 120; frame += 1) {
      player.hp = player.maxHp;

      engine.update(1 / 60);
    }

    expect(
      player.x - startX,
      "o jogador tem de conseguir sair da turba",
    ).toBeGreaterThan(120);

    engine.destroy();
  });

  it("sai de uma turba pelos quatro lados", () => {
    const directions = [
      ["KeyD"],
      ["KeyA"],
      ["KeyS"],
      ["KeyW"],
    ];

    for (const [code] of directions) {
      const engine = createEngine();
      const player = engine.world.player;

      player.x = 3000;
      player.y = 2100;
      player.hp = player.maxHp;

      parkEnemiesInRing(engine, player, 10, 40);

      const startX = player.x;
      const startY = player.y;

      holdKeys(engine, [code]);

      for (let frame = 0; frame < 90; frame += 1) {
        player.hp = player.maxHp;

        engine.update(1 / 60);
      }

      const moved =
        Math.hypot(player.x - startX, player.y - startY);

      expect(moved, `saida por ${code}`).toBeGreaterThan(80);

      engine.destroy();
    }
  });

  it("nenhum inimigo fica dentro do jogador", () => {
    const engine = createEngine();
    const player = engine.world.player;

    player.x = 3000;
    player.y = 2100;
    player.hp = player.maxHp;

    // comeca com o anel todo dentro: 30 de raio contra 22+21 = 43
    parkEnemiesInRing(engine, player, 12, 30);

    // deixa assentar: o que interessa e o regime, nao o
    // instante em que o anel foi montado dentro do jogador
    for (let frame = 0; frame < 90; frame += 1) {
      player.hp = player.maxHp;

      engine.update(1 / 60);
    }

    let worst = 0;

    for (let frame = 0; frame < 180; frame += 1) {
      player.hp = player.maxHp;

      engine.update(1 / 60);

      for (const enemy of creatures(engine)) {
        if (!enemy.alive) continue;

        const minimum = player.radius + enemy.radius;

        const overlap =
          minimum -
          Math.hypot(enemy.x - player.x, enemy.y - player.y);

        worst = Math.max(worst, overlap);
      }
    }

    expect(
      worst,
      `maior invasao de corpo em regime: ${worst.toFixed(1)}px`,
    ).toBeLessThan(6);

    engine.destroy();
  });

  it("continua andando mesmo com a horda em cima", () => {
    const engine = createEngine();
    const player = engine.world.player;

    player.x = 3000;
    player.y = 2100;
    player.hp = player.maxHp;

    parkEnemiesInRing(engine, player, 14, 34);

    holdKeys(engine, ["KeyW"]);

    let movingFrames = 0;
    let frames = 0;

    for (let frame = 0; frame < 240; frame += 1) {
      player.hp = player.maxHp;

      const before = { x: player.x, y: player.y };

      engine.update(1 / 60);

      if (player.isMoving) {
        frames += 1;

        if (
          Math.hypot(
            player.x - before.x,
            player.y - before.y,
          ) > 0.1
        ) {
          movingFrames += 1;
        }
      }
    }

    expect(
      movingFrames / frames,
      "frames com movimento real de um total em movimento",
    ).toBeGreaterThan(0.9);

    engine.destroy();
  });
});

describe("jogador nao trava em obstaculos", () => {
  it("e devolvido para fora quando cai dentro de um solido", () => {
    const engine = createEngine(mapaComSolido());
    const player = engine.world.player;

    const wall = (engine.world.map.solids ?? [])[0];

    expect(wall, "o mapa precisa ter solidos").toBeDefined();

    player.x = wall.x + wall.width / 2;
    player.y = wall.y + wall.height / 2;
    player.hp = player.maxHp;

    engine.update(1 / 60);

    expect(
      engine.world.collision.circleHitsSolid(
        player,
        player.radius,
      ),
      "continua dentro do obstaculo",
    ).toBe(false);

    engine.destroy();
  });

  it("nao fica preso depois de ser devolvido para fora", () => {
    const engine = createEngine(mapaComSolido());
    const player = engine.world.player;

    const wall = (engine.world.map.solids ?? [])[0];

    expect(wall, "o mapa precisa ter solidos").toBeDefined();

    player.x = wall.x + wall.width / 2;
    player.y = wall.y + wall.height / 2;
    player.hp = player.maxHp;

    engine.update(1 / 60);

    // nao faz sentido exigir movimento para dentro do obstaculo:
    // o que importa e que o jogador tenha direcoes livres
    const attempts = [
      ["KeyD"],
      ["KeyA"],
      ["KeyS"],
      ["KeyW"],
    ];

    const freed = [];

    for (const [code] of attempts) {
      const startX = player.x;
      const startY = player.y;

      holdKeys(engine, [code]);

      for (let frame = 0; frame < 90; frame += 1) {
        player.hp = player.maxHp;

        engine.update(1 / 60);
      }

      if (
        Math.hypot(player.x - startX, player.y - startY) > 30
      ) {
        freed.push(code);
      }
    }

    expect(
      freed.length,
      `direcoes livres: ${freed.join(",") || "nenhuma"}`,
    ).toBeGreaterThanOrEqual(2);

    engine.destroy();
  });

  it("nao sai dos limites do mapa", () => {
    const engine = createEngine();
    const player = engine.world.player;
    const bounds = engine.world.map.bounds;

    player.x = bounds.x - 400;
    player.y = bounds.y - 400;
    player.hp = player.maxHp;

    for (let frame = 0; frame < 120; frame += 1) {
      engine.update(1 / 60);
    }

    expect(player.x).toBeGreaterThanOrEqual(bounds.x);
    expect(player.y).toBeGreaterThanOrEqual(bounds.y);
    expect(player.x).toBeLessThanOrEqual(
      bounds.x + bounds.width,
    );
    expect(player.y).toBeLessThanOrEqual(
      bounds.y + bounds.height,
    );

    engine.destroy();
  });

  it("anda por um corredor estreito sem travar", () => {
    const engine = createEngine();
    const player = engine.world.player;

    const zone = getZoneById("brejo");

    expect(zone).not.toBe(null);

    player.x = zone.x + zone.width / 2;
    player.y = zone.y + zone.height / 2;
    player.hp = player.maxHp;

    engine.world.collision.resolveOverlap(
      player,
      player.radius,
    );

    const startX = player.x;

    holdKeys(engine, ["KeyD"]);

    let stuckFrames = 0;

    for (let frame = 0; frame < 300; frame += 1) {
      player.hp = player.maxHp;

      const before = player.x;

      engine.update(1 / 60);

      if (player.isMoving && player.x === before) {
        stuckFrames += 1;
      }
    }

    expect(
      player.x - startX,
      "corredor nao deve travar o jogador",
    ).toBeGreaterThan(60);

    engine.destroy();
  });
});
