import { beforeEach, describe, expect, it } from "vitest";
import { EnemyAI } from "./EnemyAI.js";
import {
  BEHAVIOR,
  CREATURE_TYPES,
  createCreature,
  createCreatureRoster,
  TRAINING_DUMMY_BLUEPRINTS,
} from "../../data/enemies/index.js";
import { TEST_MAP, ZONES } from "../../data/maps/index.js";
import { CollisionSystem } from "../collision/CollisionSystem.js";
import { StatusSystem } from "../effects/StatusSystem.js";

const FLAT_MAP = {
  width: 4000,
  height: 2800,
  bounds: { x: 40, y: 40, width: 3920, height: 2720 },
  walls: [],
  obstacles: [],
};

function createHarness(playerX = 2000, playerY = 1400) {
  const world = {
    time: 0,
    player: {
      id: "player",
      x: playerX,
      y: playerY,
      radius: 22,
      hp: 10000,
      maxHp: 10000,
      alive: true,
      resource: 0,
      maxResource: 100,
      shield: 0,
      statusEffects: [],
      cast: null,
      cooldowns: {},
      facing: { x: 0, y: 1 },
    },
    enemies: [],
    collision: new CollisionSystem(FLAT_MAP),
  };

  const hits = [];

  const ai = new EnemyAI(world, {
    onDamagePlayer: (enemy, amount) => {
      hits.push({ id: enemy.id, amount });
    },
  });

  return { world, ai, hits };
}

function spawn(typeId, offset = 0) {
  return createCreature(
    typeId,
    { x: 2000 + offset, y: 1400 },
    0,
  );
}

function run(ai, enemy, seconds, playerX) {
  const steps = Math.round(seconds * 60);

  for (let step = 0; step < steps; step += 1) {
    if (playerX !== undefined) {
      ai.world.player.x = playerX;
    }

    ai.update(enemy, 1 / 60);
  }
}

describe("roster", () => {
  it("creates 30 creatures", () => {
    expect(createCreatureRoster()).toHaveLength(30);
  });

  it("spreads them evenly across the three behaviors", () => {
    const counts = { passive: 0, semi: 0, active: 0 };

    for (const enemy of createCreatureRoster()) {
      counts[
        enemy.behavior === BEHAVIOR.PASSIVE
          ? "passive"
          : enemy.behavior === BEHAVIOR.SEMI_PASSIVE
            ? "semi"
            : "active"
      ] += 1;
    }

    expect(counts).toEqual({
      passive: 10,
      semi: 10,
      active: 10,
    });
  });

  it("gives every creature a unique id and a valid spawn", () => {
    const roster = createCreatureRoster();
    const ids = new Set();

    for (const enemy of roster) {
      expect(ids.has(enemy.id)).toBe(false);
      ids.add(enemy.id);

      expect(enemy.isCreature).toBe(true);
      expect(enemy.hp).toBe(enemy.maxHp);
      expect(enemy.spawnX).toBe(enemy.x);
      expect(enemy.spawnY).toBe(enemy.y);

      expect(enemy.behavior).toBeDefined();
      expect(enemy.aggroRange).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps every creature inside the map bounds", () => {
    const bounds = TEST_MAP.bounds;

    for (const enemy of createCreatureRoster()) {
      expect(enemy.x).toBeGreaterThan(bounds.x);
      expect(enemy.y).toBeGreaterThan(bounds.y);
      expect(enemy.x).toBeLessThan(
        bounds.x + bounds.width,
      );
      expect(enemy.y).toBeLessThan(
        bounds.y + bounds.height,
      );
    }
  });

  it("places each creature type inside a matching zone", () => {
    const roster = createCreatureRoster();

    for (const enemy of roster) {
      const zone = ZONES.find(
        (candidate) =>
          enemy.x >= candidate.x &&
          enemy.x <= candidate.x + candidate.width &&
          enemy.y >= candidate.y &&
          enemy.y <= candidate.y + candidate.height,
      );

      expect(zone, enemy.id).toBeDefined();

      const expected = CREATURE_TYPES[enemy.id.replace(
        /_\d+$/,
        "",
      )].behavior;

      const kind =
        expected === BEHAVIOR.PASSIVE
          ? "passive"
          : expected === BEHAVIOR.SEMI_PASSIVE
            ? "semi"
            : "active";

      expect(zone.kind, enemy.id).toBe(kind);
    }
  });

  it("keeps the training dummies out of the creature roster", () => {
    const roster = createCreatureRoster();

    for (const enemy of roster) {
      for (const dummy of TRAINING_DUMMY_BLUEPRINTS) {
        expect(enemy.id).not.toBe(dummy.id);
      }
    }
  });
});

describe("passive behavior", () => {
  it("never attacks, even standing on the player", () => {
    for (const typeId of ["slime", "rat"]) {
      const { ai, hits } = createHarness();
      const enemy = spawn(typeId, 10);

      ai.world.enemies.push(enemy);

      run(ai, enemy, 8);

      expect(hits, typeId).toHaveLength(0);
      expect(enemy.provoked).toBe(false);
      expect(enemy.alerted).toBe(false);
    }
  });

  it("ignores provocation", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("slime", 10);

    ai.provoke(enemy);
    run(ai, enemy, 5);

    expect(hits).toHaveLength(0);
    expect(enemy.provoked).toBe(false);
  });

  it("only wanders inside its wander radius", () => {
    const { ai } = createHarness();
    const enemy = spawn("slime");

    const home = { x: enemy.x, y: enemy.y };

    run(ai, enemy, 25);

    expect(
      Math.hypot(
        enemy.x - home.x,
        enemy.y - home.y,
      ),
    ).toBeLessThanOrEqual(
      CREATURE_TYPES.slime.wanderRadius + 80,
    );
  });
});

describe("semi-passive behavior", () => {
  it("stays idle until provoked", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("goblin", 200);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 4);

    expect(hits).toHaveLength(0);
    expect(enemy.aiState).not.toBe("chase");
  });

  it("does not aggro on proximity alone", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("goblin", 30);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 6);

    expect(hits).toHaveLength(0);
    expect(enemy.alerted).toBe(false);
  });

  it("chases and attacks after being hit", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("goblin", 420);

    ai.world.enemies.push(enemy);

    ai.provoke(enemy);

    expect(enemy.provoked).toBe(true);

    run(ai, enemy, 12);

    expect(hits.length).toBeGreaterThan(0);
  });

  it("deals the configured damage per hit", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("ghoul", 60);

    ai.world.enemies.push(enemy);
    ai.provoke(enemy);

    run(ai, enemy, 10);

    expect(hits.length).toBeGreaterThan(0);

    for (const hit of hits) {
      expect(hit.amount).toBe(
        CREATURE_TYPES.ghoul.damage,
      );
    }
  });
});

describe("active behavior", () => {
  it("aggrons when the player enters its range", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("skeleton", 100);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 10);

    expect(enemy.alerted).toBe(true);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("ignores a player outside its range", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("skeleton", 900);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 4);

    expect(hits).toHaveLength(0);
    expect(enemy.alerted).toBe(false);
  });

  it("respects the per-type aggro range", () => {
    for (const typeId of ["skeleton", "ogre"]) {
      const type = CREATURE_TYPES[typeId];

      const { ai, hits } = createHarness();
      const enemy = spawn(typeId, type.aggroRange + 160);

      ai.world.enemies.push(enemy);

      run(ai, enemy, 3);

      expect(hits, typeId).toHaveLength(0);
    }
  });

  it("walks toward the player once aggroed", () => {
    const { ai } = createHarness();
    const enemy = spawn("ogre", 350);

    ai.world.enemies.push(enemy);

    const before = Math.hypot(
      enemy.x - ai.world.player.x,
      enemy.y - ai.world.player.y,
    );

    run(ai, enemy, 1.5);

    const after = Math.hypot(
      enemy.x - ai.world.player.x,
      enemy.y - ai.world.player.y,
    );

    expect(after).toBeLessThan(before);
    expect(enemy.aiState).toBe("chase");
  });

  it("gives up and walks home when the player escapes the leash", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("skeleton", 600);

    ai.world.enemies.push(enemy);

    const home = { x: enemy.spawnX, y: enemy.spawnY };

    // o jogador fica longe para o inimigo sair do leash do spawn
    ai.world.player.x = 1200;
    ai.world.player.y = 1400;

    ai.provoke(enemy);
    run(ai, enemy, 14);

    expect(
      Math.hypot(
        enemy.x - home.x,
        enemy.y - home.y,
      ),
    ).toBeGreaterThan(
      CREATURE_TYPES.skeleton.leash,
    );

    const hitsBeforeEscape = hits.length;

    ai.world.player.x = 3800;
    ai.world.player.y = 2600;

    run(ai, enemy, 0.4);

    expect(enemy.provoked).toBe(false);
    expect(enemy.aiState).toBe("return");

    run(ai, enemy, 20);

    expect(
      Math.hypot(
        enemy.x - home.x,
        enemy.y - home.y,
      ),
    ).toBeLessThan(60);

    expect(hits.length).toBe(hitsBeforeEscape);
  });
});

describe("combat", () => {
  it("respects the attack cooldown", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("skeleton", 30);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 3);

    const minimumGap =
      CREATURE_TYPES.skeleton.attackCooldown * 0.85;

    for (let i = 1; i < hits.length; i += 1) {
      expect(hits[i].id).toBe(hits[i - 1].id);
    }

    expect(
      hits.length,
      `cooldown ${minimumGap}`,
    ).toBeLessThanOrEqual(
      Math.ceil(3 / minimumGap) + 1,
    );
  });

  it("stops attacking a dead creature", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("skeleton", 30);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 2);

    const before = hits.length;

    enemy.alive = false;
    enemy.hp = 0;

    run(ai, enemy, 4);

    expect(hits.length).toBe(before);
    expect(enemy.aiState).toBe("dead");
  });

  it("does nothing for entities without the creature flag", () => {
    const { ai, hits } = createHarness();
    const dummy = {
      id: "dummy_x",
      x: 2000,
      y: 1400,
      radius: 20,
      hp: 100,
      maxHp: 100,
      alive: true,
      isCreature: false,
      hitFlash: 0,
      attackAnimation: 0,
      aiState: "idle",
    };

    run(ai, dummy, 5);

    expect(hits).toHaveLength(0);
  });
});
