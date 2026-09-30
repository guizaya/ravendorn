import { describe, expect, it } from "vitest";
import { StatusSystem } from "./StatusSystem.js";

function createEntity() {
  return {
    hp: 100,
    resource: 100,
    controlResistance: 0,
    statusEffects: [],
  };
}

describe("StatusSystem", () => {
  it("aplica dano contínuo de veneno", () => {
    const statuses = new StatusSystem();
    const entity = createEntity();

    statuses.apply(entity, {
      type: "poison",
      duration: 3,
      value: 8,
      tickInterval: 1,
      chance: 1,
    });

    statuses.update(entity, 1);

    expect(entity.hp).toBe(92);
  });

  it("aplica slow ao movimento", () => {
    const statuses = new StatusSystem();
    const entity = createEntity();

    statuses.apply(entity, {
      type: "slow",
      duration: 3,
      value: 0.5,
      chance: 1,
    });

    expect(
      statuses.getMultiplier(entity, "movementSpeed"),
    ).toBeCloseTo(0.5);
  });
});
