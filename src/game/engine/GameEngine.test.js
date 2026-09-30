import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import {
  isSkillAuto,
  setSkillAuto,
} from "./autoSkills.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { TEST_MAP } from "../../data/maps/index.js";

const windowListeners = new Map();

globalThis.window = {
  devicePixelRatio: 1,
  addEventListener(type, handler) {
    if (!windowListeners.has(type)) {
      windowListeners.set(type, new Set());
    }

    windowListeners.get(type).add(handler);
  },
  removeEventListener(type, handler) {
    windowListeners.get(type)?.delete(handler);
  },
};

globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

function pressKey(code) {
  for (const handler of windowListeners.get("keydown") ?? []) {
    handler({ code, repeat: false, preventDefault() {} });
  }
}

function createEngine(classDefinition) {
  const listeners = {};
  let snapshot = null;

  const canvas = {
    getContext: () => ({
      setTransform() {},
      clearRect() {},
      fillRect() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      ellipse() {},
      closePath() {},
      fill() {},
      stroke() {},
      fillText() {},
      setLineDash() {},
    }),
    addEventListener(type, handler) {
      (listeners[type] ??= []).push(handler);
    },
    removeEventListener(type, handler) {
      listeners[type] = (listeners[type] ?? []).filter(
        (item) => item !== handler,
      );
    },
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    }),
  };

  const engine = new GameEngine(
    canvas,
    classDefinition,
    (next) => {
      snapshot = next;
    },
  );

  engine.setMap(TEST_MAP);
  engine.world.collision.map = TEST_MAP;

  return {
    engine,
    listeners,
    getSnapshot: () => snapshot,
  };
}

function click(engine, listener, clientX, clientY) {
  listener({
    button: 0,
    clientX,
    clientY,
  });
}

function screenTo(engine, worldX, worldY) {
  return {
    x:
      worldX +
      engine.viewport.width / 2 -
      engine.world.player.x,
    y:
      worldY +
      engine.viewport.height / 2 -
      engine.world.player.y,
  };
}

const ALL_CLASSES = CHARACTER_CLASSES;

describe("per-skill auto flag", () => {
  beforeEach(() => {
    for (const definition of ALL_CLASSES) {
      for (const skill of definition.skills) {
        setSkillAuto(skill.id, false);
      }
    }
  });

  it("defaults every skill to manual", () => {
    for (const definition of ALL_CLASSES) {
      for (const skill of definition.skills) {
        expect(
          isSkillAuto(skill.id),
          `${skill.name} deveria iniciar manual`,
        ).toBe(false);
      }
    }
  });

  it("uses only basic attack when no skill is auto", () => {
    const definition = ALL_CLASSES[0];
    const { engine } = createEngine(definition);

    for (const skill of definition.skills) {
      setSkillAuto(skill.id, false);
    }

    engine.setAutoPlay(true);

    const used = new Set();

    const originalRequest = engine.skillSystem.request.bind(
      engine.skillSystem,
    );

    engine.skillSystem.request = (action, ...rest) => {
      used.add(action.id);
      return originalRequest(action, ...rest);
    };

    for (let frame = 0; frame < 900; frame += 1) {
      engine.update(1 / 60);

      for (const enemy of engine.world.enemies) {
        if (enemy.hp <= 0) enemy.hp = enemy.maxHp;
      }
    }

    expect([...used]).toEqual([
      definition.basicAttack.id,
    ]);

    engine.destroy();
  });

  it("never auto-casts the ultimate", () => {
    for (const definition of ALL_CLASSES) {
      for (const skill of definition.skills) {
        setSkillAuto(skill.id, true);
      }

      const { engine } = createEngine(definition);

      engine.setAutoPlay(true);

      const used = new Set();

      const originalRequest = engine.skillSystem.request.bind(
        engine.skillSystem,
      );

      engine.skillSystem.request = (action, ...rest) => {
        used.add(action.id);
        return originalRequest(action, ...rest);
      };

      for (let frame = 0; frame < 1500; frame += 1) {
        engine.update(1 / 60);

        for (const enemy of engine.world.enemies) {
          if (enemy.hp <= 0) enemy.hp = enemy.maxHp;
        }
      }

      expect(
        used.has(definition.ultimate.id),
        `${definition.name} usou a ultimate automaticamente`,
      ).toBe(false);

      engine.destroy();
    }
  });

  it("only auto-casts skills flagged as auto", () => {
    for (const definition of ALL_CLASSES) {
      for (const skill of definition.skills) {
        setSkillAuto(skill.id, false);
      }

      const target = definition.skills[0];

      setSkillAuto(target.id, true);

      const { engine } = createEngine(definition);

      engine.setAutoPlay(true);

      const used = new Set();

      const originalRequest = engine.skillSystem.request.bind(
        engine.skillSystem,
      );

      engine.skillSystem.request = (action, ...rest) => {
        used.add(action.id);
        return originalRequest(action, ...rest);
      };

      for (let frame = 0; frame < 1500; frame += 1) {
        engine.update(1 / 60);

        for (const enemy of engine.world.enemies) {
          if (enemy.hp <= 0) enemy.hp = enemy.maxHp;
        }
      }

      for (const skill of definition.skills) {
        if (skill.id === target.id) continue;

        expect(
          used.has(skill.id),
          `${definition.name} usou ${skill.name} fora do auto`,
        ).toBe(false);
      }

      expect(
        used.size,
        `${definition.name} não usou a skill marcada como auto`,
      ).toBeGreaterThan(0);

      engine.destroy();
    }
  });

  it("honours the flag in click-to-engage mode too", () => {
    const definition = ALL_CLASSES[0];
    const { engine, listeners } = createEngine(definition);

    for (const skill of definition.skills) {
      setSkillAuto(skill.id, false);
    }

    const target = engine.world.enemies[0];
    const point = screenTo(engine, target.x, target.y);

    click(
      engine,
      listeners.pointerdown[0],
      point.x,
      point.y,
    );

    const used = new Set();

    const originalRequest = engine.skillSystem.request.bind(
      engine.skillSystem,
    );

    engine.skillSystem.request = (action, ...rest) => {
      used.add(action.id);
      return originalRequest(action, ...rest);
    };

    for (let frame = 0; frame < 900; frame += 1) {
      engine.update(1 / 60);

      for (const enemy of engine.world.enemies) {
        if (enemy.hp <= 0) enemy.hp = enemy.maxHp;
      }
    }

    expect([...used]).toEqual([
      definition.basicAttack.id,
    ]);

    engine.destroy();
  });

  it("persists the flag through engine recreation", () => {
    const definition = ALL_CLASSES[0];
    const skill = definition.skills[2];

    setSkillAuto(skill.id, true);

    const first = createEngine(definition);
    first.engine.destroy();

    const second = createEngine(definition);

    expect(second.engine.getSkillAuto(skill.id)).toBe(true);

    second.engine.destroy();
  });
});

describe("auto play", () => {
  it("does nothing while disabled", () => {
    for (const definition of ALL_CLASSES) {
      const { engine } = createEngine(definition);
      const startX = engine.world.player.x;
      const totalHp = engine.world.enemies.reduce(
        (sum, enemy) => sum + enemy.hp,
        0,
      );

      for (let frame = 0; frame < 600; frame += 1) {
        engine.update(1 / 60);
      }

      expect(engine.world.player.x).toBe(startX);
      expect(
        engine.world.enemies.reduce(
          (sum, enemy) => sum + enemy.hp,
          0,
        ),
      ).toBe(totalHp);
    }
  });

  it("kills every dummy when enabled", () => {
    for (const definition of ALL_CLASSES) {
      const { engine } = createEngine(definition);

      let damageDealt = 0;

      const originalApply = engine.damage.applyDamage.bind(
        engine.damage,
      );

      engine.damage.applyDamage = (
        attacker,
        target,
        action,
        options,
      ) => {
        const dealt = originalApply(
          attacker,
          target,
          action,
          options,
        );

        damageDealt += dealt;

        return dealt;
      };

      engine.setAutoPlay(true);

      for (let frame = 0; frame < 3000; frame += 1) {
        engine.update(1 / 60);

        for (const enemy of engine.world.enemies) {
          if (enemy.hp <= 0) {
            enemy.hp = enemy.maxHp;
          }
        }
      }

      expect(
        damageDealt,
        `${definition.name} não causeu dano`,
      ).toBeGreaterThan(0);

      expect(
        engine.world.pendingPulses.length,
        `${definition.name} deixou pulsos acumulados`,
      ).toBeLessThan(64);

      expect(
        engine.world.projectiles.length,
        `${definition.name} deixou projéteis acumulados`,
      ).toBeLessThan(300);

      engine.destroy();
    }
  });

  it("stops moving when disabled again", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.setAutoPlay(true);

    for (let frame = 0; frame < 300; frame += 1) {
      engine.update(1 / 60);
    }

    engine.setAutoPlay(false);

    const position = {
      x: engine.world.player.x,
      y: engine.world.player.y,
    };

    for (let frame = 0; frame < 300; frame += 1) {
      engine.update(1 / 60);
    }

    expect(engine.world.player.x).toBe(position.x);
    expect(engine.world.player.y).toBe(position.y);
    expect(engine.selectedTargetId).toBe(null);
    expect(engine.engagedTargetId).toBe(null);
  });

  it("toggles auto play with the T key", () => {
    const { engine, getSnapshot } = createEngine(
      ALL_CLASSES[0],
    );

    expect(engine.autoPlay).toBe(false);

    pressKey("KeyT");
    engine.update(1 / 60);

    expect(engine.autoPlay).toBe(true);
    expect(getSnapshot().autoPlay).toBe(true);

    pressKey("KeyT");
    engine.update(1 / 60);

    expect(engine.autoPlay).toBe(false);
    expect(getSnapshot().autoPlay).toBe(false);
  });

  it("moves on to the next dummy after killing one", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.setAutoPlay(true);

    const seen = new Set();

    for (let frame = 0; frame < 5000; frame += 1) {
      engine.update(1 / 60);

      for (const enemy of engine.world.enemies) {
        if (enemy.hp <= 0) {
          enemy.hp = enemy.maxHp;
        }

        if (engine.selectedTargetId) {
          seen.add(engine.selectedTargetId);
        }
      }
    }

    expect(seen.size).toBeGreaterThan(1);
    expect(
      engine.world.pendingPulses.length,
    ).toBeLessThan(64);

    engine.destroy();
  });

  it("keeps attacking a clicked enemy until it dies, then stops", () => {
    const { engine, listeners } = createEngine(ALL_CLASSES[0]);

    const target = engine.world.enemies[0];
    const point = screenTo(engine, target.x, target.y);

    click(
      engine,
      listeners.pointerdown[0],
      point.x,
      point.y,
    );

    expect(engine.engagedTargetId).toBe(target.id);
    expect(engine.autoPlay).toBe(false);

    let guard = 0;

    while (target.alive && guard < 36000) {
      engine.update(1 / 60);
      guard += 1;

      if (!target.alive) {
        engine.update(1 / 60);
        break;
      }
    }

    expect(target.hp).toBe(0);
    expect(target.alive).toBe(false);

    engine.update(1 / 60);

    expect(engine.engagedTargetId).toBe(null);
    expect(engine.selectedTargetId).toBe(null);

    const frozen = {
      x: engine.world.player.x,
      y: engine.world.player.y,
    };
    const untouched = engine.world.enemies[1].hp;

    for (let frame = 0; frame < 600; frame += 1) {
      engine.update(1 / 60);
    }

    expect(engine.world.player.x).toBe(frozen.x);
    expect(engine.world.player.y).toBe(frozen.y);
    expect(engine.world.enemies[1].hp).toBe(untouched);
  });
});
