import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import {
  isSkillAuto,
  setSkillAuto,
} from "./autoSkills.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { TEST_MAP, MAP_META } from "../../data/maps/index.js";
import {
  isAutoCompletable,
  QUEST_TYPE,
} from "../../data/quests/index.js";

function advanceMainTo(quests, predicate) {
  let guard = 0;

  while (!predicate(quests.currentMain) && guard < 20) {
    guard += 1;

    const quest = quests.currentMain;

    if (isAutoCompletable(quest)) {
      quests.onKill(quest.target, quest.count);
    } else if (quest.type === QUEST_TYPE.EQUIP) {
      quests.onEquipRarity(quest.rarity);
    } else {
      quests.onLevelUp(quest.count);
    }
  }
}
import {
  MINIMAP_TOP_IDLE,
  MINIMAP_TOP_TARGETED,
} from "../ui/minimap.js";

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

  const context = new Proxy(
    { createPattern: () => ({ pattern: true }) },
    {
      get(target, key) {
        if (key in target) return target[key];
        return () => {};
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );

  const canvas = {
    getContext: () => context,
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

describe("minimap target awareness", () => {
  it("rests in the target slot with no target", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.update(1 / 60);
    engine.render();

    expect(engine.selectedTargetId).toBe(null);
    expect(engine.hasLiveTarget()).toBe(false);
    expect(engine.minimapY).toBe(MINIMAP_TOP_IDLE);

    engine.destroy();
  });

  it("drops below the target panel once a target is picked", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies[0];

    engine.selectedTargetId = target.id;

    expect(engine.hasLiveTarget()).toBe(true);

    for (let frame = 0; frame < 240; frame += 1) {
      engine.update(1 / 60);
      engine.render();
    }

    expect(engine.minimapY).toBe(MINIMAP_TOP_TARGETED);
    expect(engine.minimapY).toBeGreaterThan(
      MINIMAP_TOP_IDLE,
    );

    engine.destroy();
  });

  it("returns to the target slot when the target dies", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies[0];

    engine.selectedTargetId = target.id;

    for (let frame = 0; frame < 60; frame += 1) {
      engine.update(1 / 60);
    }

    target.alive = false;
    target.hp = 0;
    target.respawnTimer = 9999;

    expect(engine.hasLiveTarget()).toBe(false);

    for (let frame = 0; frame < 240; frame += 1) {
      engine.update(1 / 60);
      engine.render();
    }

    expect(engine.minimapY).toBe(MINIMAP_TOP_IDLE);

    engine.destroy();
  });

  it("never overlaps the target panel in either state", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    for (const targeted of [false, true]) {
      engine.selectedTargetId = targeted
        ? engine.world.enemies[0].id
        : null;

      for (let frame = 0; frame < 240; frame += 1) {
        engine.update(1 / 60);
        engine.render();
      }

      const panelBottom = 84 + 86;

      if (engine.hasLiveTarget()) {
        expect(engine.minimapY).toBeGreaterThanOrEqual(
          panelBottom,
        );
      } else {
        expect(engine.minimapY).toBe(84);
      }
    }

    engine.destroy();
  });

  it("slides instead of teleporting", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.selectedTargetId = engine.world.enemies[0].id;

    const seen = new Set();

    for (let frame = 0; frame < 120; frame += 1) {
      engine.update(1 / 60);
      engine.render();

      seen.add(Math.round(engine.minimapY));
    }

    // deve passar por posições intermediárias
    expect(seen.size).toBeGreaterThan(3);

    engine.destroy();
  });
});

describe("quests and progression", () => {
  it("grants xp when a creature dies", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies.find(
      (enemy) => enemy.isCreature,
    );

    engine.world.inventory.clear();

    const before = engine.world.player.xp ?? 0;

    target.hp = 1;

    engine.damage.applyDamage(
      engine.world.player,
      target,
      { damage: 9999, damageType: "physical" },
    );

    expect(
      engine.world.player.xp ?? 0,
    ).toBeGreaterThanOrEqual(before);

    engine.destroy();
  });

  it("grows the player on level up", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;

    const baseHp = player.maxHp;
    const baseAttack = player.attack;

    const victim = engine.world.enemies.find(
      (enemy) => enemy.isCreature,
    );

    // matarMany criaturas de uma vez empurra varios niveis
    for (let round = 0; round < 40; round += 1) {
      for (const enemy of engine.world.enemies) {
        if (!enemy.isCreature) continue;

        enemy.alive = true;
        enemy.hp = 1;

        engine.damage.applyDamage(
          engine.world.player,
          enemy,
          { damage: 9999, damageType: "physical" },
        );
      }
    }

    expect(player.level).toBeGreaterThan(1);
    expect(player.maxHp).toBeGreaterThan(baseHp);
    expect(player.attack).toBeGreaterThan(baseAttack);

    engine.destroy();
  });

  it("advances the main quest from kills", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quest = engine.world.quests.currentMain;

    expect(isAutoCompletable(quest)).toBe(true);

    for (const enemy of engine.world.enemies) {
      if (!enemy.isCreature) continue;
      if (!enemy.id.startsWith(`${quest.target}_`)) {
        continue;
      }

      enemy.alive = true;
      enemy.hp = 1;

      engine.damage.applyDamage(
        engine.world.player,
        enemy,
        { damage: 9999, damageType: "physical" },
      );
    }

    expect(
      engine.world.quests.currentMain.id,
    ).not.toBe(quest.id);

    engine.destroy();
  });

  it("keeps side quests exclusive", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const available =
      engine.world.quests.snapshot().side.available;

    expect(engine.acceptSideQuest(available[0].id)).toBe(
      true,
    );

    expect(
      engine.acceptSideQuest(available[1].id),
    ).toBe(false);

    expect(
      engine.abandonSideQuest(),
    ).toBe(true);

    expect(engine.acceptSideQuest(available[1].id)).toBe(
      true,
    );

    engine.destroy();
  });

  it("reports quests and xp in the snapshot", () => {
    const { engine, getSnapshot } = createEngine(
      ALL_CLASSES[0],
    );

    engine.update(1 / 60);
    engine.sendSnapshot();

    const snapshot = getSnapshot();

    expect(snapshot.quests.main.total).toBeGreaterThan(0);
    expect(snapshot.quests.main.current).not.toBe(null);
    expect(
      snapshot.quests.side.available.length,
    ).toBeGreaterThan(0);
    expect(snapshot.player.xpToNext).toBeGreaterThan(0);

    engine.destroy();
  });

  it("pays quest rewards on completion", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const quest = quests.currentMain;

    engine.world.inventory.clear();

    for (const enemy of engine.world.enemies) {
      if (!enemy.isCreature) continue;
      if (!enemy.id.startsWith(`${quest.target}_`)) {
        continue;
      }

      enemy.alive = true;
      enemy.hp = 1;

      engine.damage.applyDamage(
        engine.world.player,
        enemy,
        { damage: 9999, damageType: "physical" },
      );
    }

    expect(
      engine.world.inventory.coins,
    ).toBeGreaterThanOrEqual(quest.rewards.coins);

    engine.destroy();
  });
  it("walks toward the quest zone when auto is on", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;
    const quest = engine.world.quests.currentMain;
    const zone = MAP_META.zones.find(
      (entry) => entry.id === quest.location,
    );

    expect(zone).toBeDefined();

    player.x = TEST_MAP.spawn.x;
    player.y = TEST_MAP.spawn.y;

    engine.focusQuest(quest.id);

    expect(engine.world.quests.autoEnabled).toBe(true);
    expect(engine.autoPlay).toBe(true);

    const before = Math.hypot(
      player.x - (zone.x + zone.width / 2),
      player.y - (zone.y + zone.height / 2),
    );

    for (let frame = 0; frame < 600; frame += 1) {
      engine.update(1 / 60);
    }

    const after = Math.hypot(
      player.x - (zone.x + zone.width / 2),
      player.y - (zone.y + zone.height / 2),
    );

    expect(after).toBeLessThan(before);

    engine.destroy();
  });

  it("hunts only the quest target creature", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quest = engine.world.quests.currentMain;

    engine.focusQuest(quest.id);

    const player = engine.world.player;
    const zone = MAP_META.zones.find(
      (entry) => entry.id === quest.location,
    );

    player.x = zone.x + zone.width / 2;
    player.y = zone.y + zone.height / 2;

    for (let frame = 0; frame < 120; frame += 1) {
      engine.update(1 / 60);
    }

    const target = engine.selectedTargetId;

    if (target) {
      expect(target.replace(/_\d+$/, "")).toBe(
        quest.target,
      );
    }

    engine.destroy();
  });

  it("refuses auto for a manual quest", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;

    advanceMainTo(quests, (quest) =>
      ["equip", "level"].includes(quest.type),
    );

    const manual = quests.currentMain;

    expect(isAutoCompletable(manual)).toBe(false);

    engine.focusQuest(manual.id);

    expect(quests.autoEnabled).toBe(false);
    expect(quests.objective()).toBe(null);

    engine.destroy();
  });

  it("toggles quest auto from the engine", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    expect(engine.toggleQuestAuto()).toBe(true);
    expect(engine.world.quests.autoEnabled).toBe(true);
    expect(engine.toggleQuestAuto()).toBe(false);
    expect(engine.world.quests.autoEnabled).toBe(false);

    engine.destroy();
  });

  it("clicking a quest turns auto on, clicking again turns it off", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const quest = quests.currentMain;

    expect(quests.autoEnabled).toBe(false);

    engine.focusQuest(quest.id);

    expect(quests.autoEnabled).toBe(true);
    expect(quests.objectiveId).toBe(quest.id);
    expect(engine.autoPlay).toBe(true);

    engine.focusQuest(quest.id);

    expect(quests.autoEnabled).toBe(false);
    expect(quests.objectiveId).toBe(null);
    expect(engine.autoPlay).toBe(false);

    engine.destroy();
  });

  it("toggles auto for an accepted side quest", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const available = quests.snapshot().side.available;

    engine.acceptSideQuest(available[0].id);

    const side = quests.currentSide;

    expect(side).not.toBe(null);

    engine.focusQuest(side.id);

    expect(quests.autoEnabled).toBe(true);
    expect(quests.objectiveId).toBe(side.id);

    engine.focusQuest(side.id);

    expect(quests.autoEnabled).toBe(false);
    expect(quests.objectiveId).toBe(null);

    engine.destroy();
  });

  it("switches auto between quests instead of toggling off", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const main = quests.currentMain;
    const available = quests.snapshot().side.available;

    engine.focusQuest(main.id);
    expect(quests.objectiveId).toBe(main.id);

    engine.acceptSideQuest(available[0].id);

    const side = quests.currentSide;

    engine.focusQuest(side.id);

    expect(quests.autoEnabled).toBe(true);
    expect(quests.objectiveId).toBe(side.id);

    engine.destroy();
  });

  it("keeps the side quest accepted after toggling its auto", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const available = quests.snapshot().side.available;

    engine.acceptSideQuest(available[0].id);

    const sideId = quests.sideId;

    engine.focusQuest(sideId);
    engine.focusQuest(sideId);

    expect(quests.sideId).toBe(sideId);
    expect(quests.currentSide).not.toBe(null);

    engine.destroy();
  });
});

describe("equipment integration", () => {
  it("moves an item out of the bag and into the slot", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("ember_blade", 1);

    const stack = inventory.stacks[0];

    expect(inventory.usedSlots).toBe(1);

    expect(
      engine.equipItem(stack.uid, "weapon"),
    ).toBe(true);

    expect(inventory.usedSlots).toBe(0);
    expect(
      engine.world.equipment.isEquipped("ember_blade"),
    ).toBe(true);

    engine.destroy();
  });

  it("applies the stat bonus to the player", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;
    const inventory = engine.world.inventory;

    const baseAttack = player.attack;
    const baseMaxHp = player.maxHp;

    inventory.clear();
    inventory.add("ember_blade", 1);
    inventory.add("ogre_heart", 1);

    const blade = inventory.stacks[0];
    const heart = inventory.stacks[1];

    engine.equipItem(blade.uid, "weapon");
    engine.equipItem(heart.uid, "trinket1");

    expect(player.attack).toBe(baseAttack + 22);
    expect(player.maxHp).toBe(baseMaxHp + 180);

    engine.destroy();
  });

  it("recomputes stats after unequipping", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;

    const baseAttack = player.attack;

    engine.world.inventory.clear();
    engine.world.inventory.add("ember_blade", 1);

    const stack = engine.world.inventory.stacks[0];

    engine.equipItem(stack.uid, "weapon");

    expect(player.attack).toBeGreaterThan(baseAttack);

    expect(engine.unequipItem("weapon")).toBe(true);

    expect(player.attack).toBe(baseAttack);
    expect(
      engine.world.inventory.count("ember_blade"),
    ).toBe(1);

    engine.destroy();
  });

  it("rejects equipping into the wrong slot", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("ember_blade", 1);

    const stack = inventory.stacks[0];

    expect(engine.equipItem(stack.uid, "chest")).toBe(
      false,
    );

    expect(inventory.usedSlots).toBe(1);

    engine.destroy();
  });

  it("rejects an unknown uid", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    expect(
      engine.equipItem("nao-existe", "weapon"),
    ).toBe(false);

    engine.destroy();
  });

  it("returns the swapped item to the bag", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("ember_blade", 1);
    inventory.add("skeleton_blade", 1);

    const [blade, dagger] = inventory.stacks;

    engine.equipItem(blade.uid, "weapon");
    engine.equipItem(dagger.uid, "weapon");

    expect(
      engine.world.equipment.isEquipped("skeleton_blade"),
    ).toBe(true);

    expect(
      inventory.count("ember_blade"),
    ).toBe(1);

    engine.destroy();
  });

  it("auto-equips the best item in every slot", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();

    inventory.add("skeleton_blade", 1);
    inventory.add("ember_blade", 1);
    inventory.add("scout_jerkin", 1);
    inventory.add("ashen_band", 1);

    expect(engine.autoEquipBest()).toBe(true);

    const equipment = engine.world.equipment;

    expect(
      equipment.isEquipped("ember_blade"),
    ).toBe(true);

    expect(
      equipment.isEquipped("scout_jerkin"),
    ).toBe(true);

    expect(
      equipment.isEquipped("ashen_band"),
    ).toBe(true);

    engine.destroy();
  });

  it("reports equipment in the snapshot", () => {
    const { engine, getSnapshot } = createEngine(
      ALL_CLASSES[0],
    );

    engine.world.inventory.clear();
    engine.world.inventory.add("ember_blade", 1);

    engine.equipItem(
      engine.world.inventory.stacks[0].uid,
      "weapon",
    );

    engine.sendSnapshot();

    const equipment = getSnapshot().equipment;

    expect(equipment.slots).toHaveLength(6);
    expect(equipment.bonuses.attack).toBe(22);
    expect(equipment.power).toBeGreaterThan(0);

    engine.destroy();
  });
});

describe("loot and inventory", () => {
  it("sends loot straight to the inventory", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies[0];

    target.hp = 1;

    engine.world.inventory.clear();

    engine.damage.applyDamage(
      engine.world.player,
      target,
      { damage: 9999, damageType: "physical" },
    );

    expect(target.alive).toBe(false);

    expect(engine.world.inventory.coins).toBeGreaterThan(0);
    expect(
      engine.world.drops.length,
      "nao deveria haver drop no chao",
    ).toBe(0);
  });

  it("collects coins and items in a single death", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies[0];

    target.hp = 1;

    engine.world.inventory.clear();

    const action = {
      damage: 9999,
      damageType: "physical",
    };

    for (let hit = 0; hit < 5; hit += 1) {
      engine.damage.applyDamage(
        engine.world.player,
        target,
        action,
      );
    }

    expect(engine.world.inventory.coins).toBeGreaterThan(0);
    expect(
      engine.world.drops.length,
      "loot rolado mais de uma vez",
    ).toBe(0);
  });

  it("spills the overflow to the ground when full", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies[0];
    const inventory = engine.world.inventory;

    inventory.clear();

    while (!inventory.isFull) {
      inventory.add("skeleton_bone", 1);
    }

    const coinsBefore = inventory.coins;

    target.hp = 1;

    engine.damage.applyDamage(
      engine.world.player,
      target,
      { damage: 9999, damageType: "physical" },
    );

    // moedas nunca bloqueiam
    expect(inventory.coins).toBeGreaterThan(coinsBefore);

    // itens que nao couberam ficam no chao
    for (const drop of engine.world.drops) {
      expect(drop.kind).toBe("item");
      expect(
        Math.hypot(
          drop.x - target.x,
          drop.y - target.y,
        ),
      ).toBeLessThanOrEqual(40);
    }
  });

  it("still collects a ground drop by walking over it", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;

    engine.world.inventory.clear();

    engine.loot.spawnGroundDrop({
      kind: "item",
      itemId: "ogre_heart",
      count: 1,
      x: player.x + 20,
      y: player.y,
    });

    engine.update(1 / 60);

    expect(
      engine.world.inventory.count("ogre_heart"),
    ).toBe(1);
    expect(engine.world.drops).toHaveLength(0);

    engine.destroy();
  });

  it("picks up loot by walking over it", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;

    engine.world.inventory.clear();

    engine.loot.spawnGroundDrop({
      kind: "coins",
      coins: 40,
      x: player.x + 20,
      y: player.y,
    });

    engine.loot.spawnGroundDrop({
      kind: "item",
      itemId: "ogre_hammer",
      count: 1,
      x: player.x,
      y: player.y + 20,
    });

    engine.update(1 / 60);

    expect(engine.world.drops).toHaveLength(0);
    expect(engine.world.inventory.coins).toBe(40);
    expect(
      engine.world.inventory.count("ogre_hammer"),
    ).toBe(1);

    engine.destroy();
  });

  it("keeps the drop when the inventory is full", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;
    const inventory = engine.world.inventory;

    inventory.clear();

    while (!inventory.isFull) {
      inventory.add("skeleton_bone", 1);
    }

    const usedBefore = inventory.usedSlots;

    engine.loot.spawnGroundDrop({
      kind: "item",
      itemId: "ogre_heart",
      count: 1,
      x: player.x,
      y: player.y,
    });

    engine.update(1 / 60);

    expect(inventory.usedSlots).toBe(usedBefore);
    expect(
      engine.world.drops.some(
        (drop) => drop.itemId === "ogre_heart",
      ),
    ).toBe(true);

    engine.destroy();
  });

  it("reports the inventory in the snapshot", () => {
    const { engine, getSnapshot } = createEngine(
      ALL_CLASSES[0],
    );

    engine.world.inventory.clear();
    engine.world.inventory.addCoins(123);
    engine.world.inventory.add("skeleton_skull", 1);

    engine.update(1 / 60);
    engine.sendSnapshot();

    const summary = getSnapshot().inventory;

    expect(summary.coins).toBe(123);
    expect(summary.used).toBe(1);
    expect(summary.capacity).toBeGreaterThan(0);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].itemId).toBe(
      "skeleton_skull",
    );
    expect(summary.items[0].uid).toBeTruthy();

    engine.destroy();
  });

  it("keeps coins growing and drops empty during normal farming", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.world.inventory.clear();

    for (let round = 0; round < 120; round += 1) {
      const target = engine.world.enemies[round % 7];

      target.hp = 1;
      target.alive = true;

      engine.damage.applyDamage(
        engine.world.player,
        target,
        { damage: 9999, damageType: "physical" },
      );

      for (const enemy of engine.world.enemies) {
        if (!engine.world.inventory.isFull) break;
        if (enemy.alive) continue;
        engine.world.inventory.remove("__none__", 0);
      }
    }

    // sem transbordo, nada deve ir para o chão
    expect(engine.world.drops).toHaveLength(0);
    expect(
      engine.world.inventory.coins,
    ).toBeGreaterThan(0);

    engine.destroy();
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
