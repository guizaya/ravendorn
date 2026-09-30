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
import { getItem, RARITY } from "../data/items/index.js";

describe("balance knobs", () => {
  it("scales the level curve ten times over the old base", () => {
    expect(BALANCE.levelCurve.base).toBe(550);
  });

  it("scales drop chance down to a tenth", () => {
    expect(BALANCE.dropChance).toBeCloseTo(0.1, 5);
  });

  it("caps items per kill at one", () => {
    expect(BALANCE.maxItemsPerKill).toBe(1);
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
  it("divides every chance by ten", () => {
    const authored = {
      coins: { min: 1, max: 2 },
      itemChance: 0.5,
      maxItems: 3,
      items: [],
    };

    expect(
      applyDropScaling(authored).itemChance,
    ).toBeCloseTo(0.05, 5);
  });

  it("never leaves more than one item per kill", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      expect(
        type.loot.maxItems,
        type.id,
      ).toBeLessThanOrEqual(BALANCE.maxItemsPerKill);
    }
  });

  it("leaves every creature table properly scaled", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      expect(
        type.loot.itemChance,
        type.id,
      ).toBeLessThanOrEqual(0.08);

      expect(type.loot.itemChance, type.id).toBeGreaterThan(0);
    }
  });

  it("scales the training dummy table too", () => {
    expect(DUMMY_LOOT.itemChance).toBeCloseTo(0.03, 5);
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
