import { describe, expect, it } from "vitest";
import {
  grantXp,
  MAX_LEVEL,
  statsForLevel,
  xpForKill,
  xpToNext,
} from "./Levels.js";

function makePlayer() {
  return { level: 1, xp: 0 };
}

describe("xp curve", () => {
  it("grows with level", () => {
    let previous = 0;

    for (let level = 1; level < 20; level += 1) {
      const needed = xpToNext(level);

      expect(needed).toBeGreaterThan(previous);
      previous = needed;
    }
  });

  it("caps at the max level", () => {
    expect(xpToNext(MAX_LEVEL)).toBe(Infinity);
  });
});

describe("xp for kills", () => {
  it("scales with enemy health", () => {
    const slime = { maxHp: 140, isCreature: true };
    const ogre = { maxHp: 1250, isCreature: true };

    expect(xpForKill(ogre)).toBeGreaterThan(
      xpForKill(slime),
    );
  });

  it("gives less xp for training dummies", () => {
    const creature = {
      maxHp: 1000,
      isCreature: true,
    };
    const dummy = {
      maxHp: 1000,
      isCreature: false,
    };

    expect(xpForKill(dummy)).toBeLessThan(
      xpForKill(creature),
    );
  });

  it("never returns zero or negative", () => {
    expect(xpForKill({ maxHp: 1, isCreature: true })).toBeGreaterThan(0);
    expect(xpForKill(null)).toBe(0);
    expect(xpForKill({})).toBe(0);
  });
});

describe("granting xp", () => {
  it("accumulates without leveling", () => {
    const player = makePlayer();
    const needed = xpToNext(1);

    const levels = grantXp(player, needed - 10);

    expect(levels).toHaveLength(0);
    expect(player.level).toBe(1);
    expect(player.xp).toBe(needed - 10);
  });

  it("levels up and carries the remainder", () => {
    const player = makePlayer();
    const needed = xpToNext(1);

    const levels = grantXp(player, needed + 25);

    expect(levels).toEqual([2]);
    expect(player.level).toBe(2);
    expect(player.xp).toBe(25);
  });

  it("levels several times in one grant", () => {
    const player = makePlayer();

    const levels = grantXp(player, 100000);

    expect(levels.length).toBeGreaterThan(2);
    expect(levels[0]).toBe(2);
    expect(levels).toContain(5);
  });

  it("never exceeds the max level", () => {
    const player = makePlayer();

    grantXp(player, 1e9);

    expect(player.level).toBe(MAX_LEVEL);
    expect(player.xp).toBe(0);
  });

  it("ignores non-positive amounts", () => {
    const player = makePlayer();

    expect(grantXp(player, 0)).toHaveLength(0);
    expect(grantXp(player, -50)).toHaveLength(0);
    expect(player.xp).toBe(0);
  });
});

describe("level growth", () => {
  it("increases every stat", () => {
    const first = statsForLevel(1);
    const later = statsForLevel(10);

    expect(later.maxHp).toBeGreaterThan(first.maxHp);
    expect(later.attack).toBeGreaterThan(first.attack);
    expect(later.defense).toBeGreaterThan(first.defense);
  });

  it("stays positive at level one", () => {
    const stats = statsForLevel(1);

    expect(stats.maxHp).toBeGreaterThan(0);
    expect(stats.attack).toBeGreaterThan(0);
  });
});
