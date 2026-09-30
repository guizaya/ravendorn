import { describe, expect, it } from "vitest";
import { SkillSystem } from "./SkillSystem.js";
import { SKILL_PACKS } from "../../data/skills/index.js";
import { createPlayer } from "../entities/Player.js";
import { createTrainingDummies } from "../entities/TrainingDummy.js";
import { CollisionSystem } from "../collision/CollisionSystem.js";
import { StatusSystem } from "../effects/StatusSystem.js";
import { EffectSystem } from "../effects/EffectSystem.js";
import { DamageSystem } from "../combat/DamageSystem.js";

const TEST_MAP = {
  bounds: {
    x: -2000,
    y: -2000,
    width: 6000,
    height: 6000,
  },
  walls: [],
  obstacles: [],
};

const TEST_CLASS = {
  id: "test",
  name: "Teste",
  icon: "TT",
  accent: "#ffffff",
  role: "test",
  skills: [],
  ultimate: null,
  stats: {
    hp: 1000,
    resource: 1000,
    resourceRegen: 0,
    attack: 10,
    defense: 0,
    speed: 100,
    attackSpeed: 1,
    critRate: 0,
    critDamage: 1.5,
    range: 100,
  },
  resource: {
    name: "Teste",
    color: "#fff",
  },
};

function createHarness() {
  const statuses = new StatusSystem();
  const effects = new EffectSystem();
  const damage = new DamageSystem({ statuses, effects });

  const world = {
    time: 0,
    player: createPlayer(TEST_CLASS, { x: 0, y: 0 }),
    enemies: [],
    projectiles: [],
    pendingPulses: [],
    delayedEffects: [],
    map: TEST_MAP,
    collision: new CollisionSystem(TEST_MAP),
    statuses,
    effects,
    damage,
    enemiesPush(target, vx, vy) {
      target.pushVelocity.x += vx;
      target.pushVelocity.y += vy;
    },
  };

  const dummies = createTrainingDummies();

  world.enemies = [
    {
      ...dummies[0],
      id: "dummy_0",
      x: 50,
      y: 0,
      maxHp: 1e9,
      hp: 1e9,
    },
  ];

  const system = new SkillSystem(world, () => {});

  return { world, system };
}

function countHits(system, action, ticks = 900) {
  let hits = 0;

  system.applyHit = () => {
    hits += 1;
  };

  system.execute(action, {
    point: { x: 50, y: 0 },
    direction: { x: 1, y: 0 },
  });

  for (let step = 0; step < ticks; step += 1) {
    system.update(1 / 60);
  }

  return hits;
}

function expectedHits(action) {
  return action.hits * (action.count ?? 1);
}

describe("SkillSystem pulse scheduling", () => {
  it("never exceeds the declared hit count for multi-hit actions", () => {
    let checked = 0;

    for (const pack of Object.values(SKILL_PACKS)) {
      for (const action of [...pack.skills, pack.ultimate]) {
        if ((action.hits ?? 1) <= 1) continue;

        const { world, system } = createHarness();

        const hits = countHits(system, action);
        const ceiling = expectedHits(action);

        expect(
          hits,
          `${action.name} aplicou ${hits} acertos, teto ${ceiling}`,
        ).toBeLessThanOrEqual(ceiling);

        expect(
          hits % action.hits,
          `${action.name} aplicou acertos fora de múltiplos de ${action.hits}`,
        ).toBe(0);

        expect(world.pendingPulses.length).toBe(0);
        expect(world.projectiles.length).toBe(0);

        checked += 1;
      }
    }

    expect(checked).toBeGreaterThan(10);
  });

  it("applies the full hit count to a target in range", () => {
    for (const pack of Object.values(SKILL_PACKS)) {
      for (const action of [...pack.skills, pack.ultimate]) {
        if ((action.hits ?? 1) <= 1) continue;
        if (action.type === "projectile") continue;

        const { system } = createHarness();

        expect(
          countHits(system, action),
          `${action.name} deveria aplicar ${action.hits} acertos`,
        ).toBe(action.hits);
      }
    }
  });

  it("drains pendingPulses to empty instead of multiplying", () => {
    const { world, system } = createHarness();

    const action = {
      id: "test",
      name: "Test",
      type: "circle",
      damage: 1,
      hits: 5,
      hitInterval: 0.1,
      radius: 200,
      effects: [],
      statusEffects: [],
    };

    countHits(system, action, 3000);

    expect(world.pendingPulses.length).toBe(0);
  });

  it("keeps a long spam session bounded", () => {
    const { world, system } = createHarness();

    const action = {
      id: "test",
      name: "Test",
      type: "circle",
      damage: 1,
      hits: 5,
      hitInterval: 0.1,
      radius: 200,
      effects: [],
      statusEffects: [],
    };

    let peakPulses = 0;
    let peakEffects = 0;

    for (let cycle = 0; cycle < 200; cycle += 1) {
      system.applyArea(action, {
        point: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
      });

      for (let step = 0; step < 60; step += 1) {
        system.update(1 / 60);

        peakPulses = Math.max(
          peakPulses,
          world.pendingPulses.length,
        );

        peakEffects = Math.max(
          peakEffects,
          world.effects.effects.length,
        );
      }
    }

    expect(world.pendingPulses.length).toBe(0);
    expect(peakPulses).toBeLessThanOrEqual(8);
    expect(peakEffects).toBeLessThanOrEqual(400);
  });
});

describe("CollisionSystem", () => {
  it("reuses a cached solids array instead of rebuilding it", () => {
    const map = {
      bounds: {
        x: -1000,
        y: -1000,
        width: 3000,
        height: 3000,
      },
      walls: [{ x: 100, y: 100, width: 50, height: 50 }],
      obstacles: [
        { x: 200, y: 200, width: 50, height: 50 },
      ],
    };

    const collision = new CollisionSystem(map);

    expect(collision.solids).toHaveLength(2);
    expect(collision.isPositionFree({ x: 0, y: 0 }, 10)).toBe(true);
    expect(collision.isPositionFree({ x: 125, y: 125 }, 5)).toBe(false);
    expect(collision.isPositionFree({ x: 225, y: 225 }, 5)).toBe(false);
    expect(collision.isPositionFree({ x: 0, y: 0 }, 5000)).toBe(false);
  });
});

describe("EffectSystem", () => {
  it("caps stored effects", () => {
    const effects = new EffectSystem();

    for (let index = 0; index < 1000; index += 1) {
      effects.addText(0, 0, "1", "#fff");
    }

    expect(effects.effects.length).toBeLessThanOrEqual(400);
  });
});

describe("createTrainingDummies", () => {
  it("creates independent instances", () => {
    const first = createTrainingDummies();
    const second = createTrainingDummies();

    first[0].statusEffects.push({ type: "poison" });
    first[0].pushVelocity.x = 99;

    expect(second[0].statusEffects).toHaveLength(0);
    expect(second[0].pushVelocity.x).toBe(0);
  });
});
