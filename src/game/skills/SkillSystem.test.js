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

    // O motor chama isto uma vez por tick, na parte compartilhada:
    // `world.projectiles` e do mundo, e deixar a atualizacao dentro
    // do `update` fazia a flecha voar duas vezes mais rapida com
    // dois jogadores online
    system.updateProjectiles(1 / 60);
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

    // a contagem e das skills de MULTI HIT que sobraram, e nao um
    // numero solto: ela sai da propria lista de packs. O piso era 10
    // porque eram oito classes; com quatro, oito STILL passam por
    // aqui, e o que este teste quer dizer e "as multi hit de todas as
    // classes foram conferidas"
    let esperadas = 0;

    for (const pack of Object.values(SKILL_PACKS)) {
      for (const action of [...pack.skills, pack.ultimate]) {
        if ((action.hits ?? 1) > 1) esperadas += 1;
      }
    }

    expect(checked, "skills de multi hit conferidas").toBe(esperadas);
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

describe("SkillSystem alvo de tiro", () => {
  const ENEMY_ACTION = {
    id: "tiro",
    name: "Tiro",
    type: "projectile",
    damage: 10,
    resourceCost: 0,
    cooldown: 0,
    range: 200,
    speed: 400,
    count: 1,
    hits: 1,
    effects: [],
    statusEffects: [],
  };

  const SELF_ACTION = {
    ...ENEMY_ACTION,
    id: "buff",
    name: "Buff",
    type: "self",
    targetType: "self",
  };

  it("guarda o id do alvo para o sprite virar para o inimigo", () => {
    const { world, system } = createHarness();

    expect(world.player.firingTargetId).toBe(null);

    system.request(
      ENEMY_ACTION,
      { x: 50, y: 0 },
      "dummy_0",
    );

    // o id, e nao um booleano: o engine usa isso para achar o
    // alvo e virar o arqueiro durante a animacao de tiro
    expect(world.player.firingTargetId).toBe("dummy_0");
    expect(world.player.attackAnimation).toBeGreaterThan(0);
  });

  it("nao marca alvo quando o tiro vai para o chao", () => {
    const { world, system } = createHarness();

    system.request(ENEMY_ACTION, { x: 0, y: 300 }, null);

    expect(world.player.firingTargetId).toBe(null);
    expect(world.player.attackAnimation).toBeGreaterThan(0);
  });

  it("nao marca alvo num buff proprio", () => {
    const { world, system } = createHarness();

    system.request(
      SELF_ACTION,
      { x: 0, y: 0 },
      "dummy_0",
    );

    expect(world.player.firingTargetId).toBe(null);
    expect(world.player.attackAnimation).toBeGreaterThan(0);
  });

  it("o alvo_do_arquiro_aceita_o_id_do_inimigo", () => {
    const { world } = createHarness();

    // o que o engine le para achar o inimigo
    expect(
      world.enemies.some((enemy) => enemy.id === "dummy_0"),
    ).toBe(true);
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
