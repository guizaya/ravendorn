import { describe, expect, it } from "vitest";
import {
  BALANCE,
  applyDropScaling,
  levelRequirement,
  totalXpForLevel,
} from "./balance.js";
import { xpForKill, xpToNext } from "./progression/Levels.js";
import {
  CREATURE_TYPES,
  DUMMY_LOOT,
} from "../data/enemies/index.js";
import {
  getItem,
  isQuestItem,
  QUEST_ITEM_IDS,
  RARITY,
  RARITY_ORDER,
} from "../data/items/index.js";
import { LootSystem } from "./loot/LootSystem.js";

describe("balance knobs", () => {
  it("scales the level curve ten times over the old base", () => {
    expect(BALANCE.levelCurve.base).toBe(550);
  });

  it("keeps drop chance at a sane half of the authored table", () => {
    expect(BALANCE.dropChance).toBeCloseTo(0.5, 5);
  });

  it("lets a kill drop up to two items", () => {
    expect(BALANCE.maxItemsPerKill).toBe(2);
  });

  it("weights commons far above legendaries", () => {
    expect(
      BALANCE.rarityDropWeight[RARITY.COMMON],
    ).toBeGreaterThan(
      BALANCE.rarityDropWeight[RARITY.LEGENDARY] * 20,
    );

    for (const rarity of RARITY_ORDER) {
      expect(
        BALANCE.rarityDropWeight[rarity],
        rarity,
      ).toBeGreaterThan(0);
    }
  });

  it("boosts quest items above the table average", () => {
    expect(BALANCE.questItemBonus).toBeGreaterThan(1.5);
  });

  it("drops stackable materials in piles", () => {
    expect(BALANCE.stackableDropMax).toBeGreaterThan(1);
  });
});

describe("level curve difficulty", () => {
  it("is far steeper than the original 55 * level^1.55", () => {
    for (const level of [1, 5, 10, 20, 30]) {
      const before = Math.round(55 * Math.pow(level, 1.55));

      expect(levelRequirement(level)).toBeGreaterThan(
        before * 9,
      );
    }
  });

  it("grows faster than the original curve", () => {
    for (const level of [2, 5, 10, 20]) {
      const before = Math.pow(level, 1.55);
      const now = Math.pow(level, BALANCE.levelCurve.exponent);

      expect(now).toBeGreaterThan(before);
    }
  });

  it("makes level 10 a real grind", () => {
    const ogreXp = xpForKill({
      maxHp: 1250,
      isCreature: true,
    });

    const needed = totalXpForLevel(10);
    const kills = Math.ceil(needed / ogreXp);

    expect(kills, "ogros necessarios").toBeGreaterThan(40);
  });

  it("makes level 20 a marathon", () => {
    const ogreXp = xpForKill({
      maxHp: 1250,
      isCreature: true,
    });

    const kills = Math.ceil(
      totalXpForLevel(20) / ogreXp,
    );

    expect(kills, "ogros necessarios").toBeGreaterThan(250);
  });

  it("keeps the first level reachable", () => {
    const needed = xpToNext(1);
    const ogreXp = xpForKill({
      maxHp: 1250,
      isCreature: true,
    });

    expect(Math.ceil(needed / ogreXp)).toBeLessThan(3);
  });
});

describe("drop scaling", () => {
  it("halves every authored chance and caps it at one", () => {
    const authored = {
      coins: { min: 1, max: 2 },
      itemChance: 0.5,
      maxItems: 3,
      items: [],
    };

    expect(
      applyDropScaling(authored).itemChance,
    ).toBeCloseTo(0.25, 5);

    expect(
      applyDropScaling({ itemChance: 4 }).itemChance,
    ).toBe(1);
  });

  it("never leaves more than maxItemsPerKill per kill", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      expect(
        type.loot.maxItems,
        type.id,
      ).toBeLessThanOrEqual(BALANCE.maxItemsPerKill);
    }
  });

  it("leaves every creature table droppable but not certain", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      expect(
        type.loot.itemChance,
        type.id,
      ).toBeLessThanOrEqual(0.4);

      expect(
        type.loot.itemChance,
        type.id,
      ).toBeGreaterThan(0.1);
    }
  });

  it("scales the training dummy table too", () => {
    expect(DUMMY_LOOT.itemChance).toBeCloseTo(0.15, 5);
  });
});

describe("common item flow", () => {
  it("raises every common material above the old tenth-of-a-tenth", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      expect(
        type.loot.itemChance,
        type.id,
      ).toBeGreaterThan(0.34 * 0.1);
    }
  });

  it("keeps commons the bulk of every effective table", () => {
    const system = new LootSystem({ drops: [] });

    for (const type of Object.values(CREATURE_TYPES)) {
      let total = 0;
      let commons = 0;

      for (const entry of type.loot.items) {
        const weight = system.effectiveWeight(entry);

        total += weight;

        if (
          getItem(entry.id)?.rarity === RARITY.COMMON
        ) {
          commons += weight;
        }
      }

      expect(commons / total, type.id).toBeGreaterThan(0.5);
    }
  });
});

describe("quest item flow", () => {
  it("weights every quest item above its authored weight", () => {
    const system = new LootSystem({ drops: [] });

    for (const type of Object.values(CREATURE_TYPES)) {
      for (const entry of type.loot.items) {
        const item = getItem(entry.id);

        if (!item?.quest) continue;

        expect(
          system.effectiveWeight(entry),
          `${type.id} / ${entry.id}`,
        ).toBeGreaterThan(entry.weight);
      }
    }
  });

  it("rolls quest materials more often than the table average", () => {
    const system = new LootSystem({ drops: [] });
    const table = CREATURE_TYPES.skeleton.loot;

    let quest = 0;
    let total = 0;

    for (const entry of table.items) {
      total += system.effectiveWeight(entry);

      if (getItem(entry.id)?.quest) {
        quest += system.effectiveWeight(entry);
      }
    }

    expect(quest / total).toBeGreaterThan(
      BALANCE.questItemBonus > 1 ? 0.5 : 0,
    );
  });

  it("marks the items quests hand out", () => {
    expect(QUEST_ITEM_IDS.length).toBeGreaterThan(0);

    for (const id of QUEST_ITEM_IDS) {
      expect(getItem(id)?.quest, id).toBe(true);
    }

    expect(isQuestItem("skeleton_bone")).toBe(true);
    expect(isQuestItem("slime_gel")).toBe(false);
  });
});

describe("rarity scarcity", () => {
  it("makes legendary drops a fraction of a percent", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      const total = type.loot.items.reduce(
        (sum, entry) => sum + entry.weight,
        0,
      );

      const legendary = type.loot.items
        .filter(
          (entry) =>
            getItem(entry.id)?.rarity ===
            RARITY.LEGENDARY,
        )
        .reduce(
          (sum, entry) => sum + entry.weight,
          0,
        );

      const share = legendary / total;

      expect(share, type.id).toBeLessThan(0.02);
    }
  });

  it("makes epic drops scarce", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      const total = type.loot.items.reduce(
        (sum, entry) => sum + entry.weight,
        0,
      );

      const epic = type.loot.items
        .filter(
          (entry) =>
            getItem(entry.id)?.rarity === RARITY.EPIC,
        )
        .reduce(
          (sum, entry) => sum + entry.weight,
          0,
        );

      expect(epic / total, type.id).toBeLessThan(0.1);
    }
  });

  it("keeps the common filler dominant in every pool", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      const total = type.loot.items.reduce(
        (sum, entry) => sum + entry.weight,
        0,
      );

      const best = Math.max(
        ...type.loot.items.map((entry) => entry.weight),
      );

      expect(best / total, type.id).toBeGreaterThan(0.3);
    }
  });
});

describe("xp per kill", () => {
  it("rewards tougher creatures more", () => {
    const slime = xpForKill({
      maxHp: 140,
      isCreature: true,
    });
    const ogre = xpForKill({
      maxHp: 1250,
      isCreature: true,
    });

    expect(ogre).toBeGreaterThan(slime * 5);
  });

  it("rewards dummies less than creatures", () => {
    const creature = xpForKill({
      maxHp: 1000,
      isCreature: true,
    });
    const dummy = xpForKill({
      maxHp: 1000,
      isCreature: false,
    });

    expect(dummy).toBeLessThan(creature);
  });
});
