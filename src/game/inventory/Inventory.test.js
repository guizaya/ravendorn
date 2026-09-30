import { beforeEach, describe, expect, it } from "vitest";
import { Inventory } from "./Inventory.js";
import { getItem } from "../../data/items/index.js";

describe("coins", () => {
  it("starts empty", () => {
    expect(new Inventory().coins).toBe(0);
  });

  it("adds and accumulates", () => {
    const inventory = new Inventory();

    inventory.addCoins(10);
    inventory.addCoins(5);

    expect(inventory.coins).toBe(15);
  });

  it("ignores non-positive amounts", () => {
    const inventory = new Inventory();

    inventory.addCoins(0);
    inventory.addCoins(-50);

    expect(inventory.coins).toBe(0);
  });

  it("floors fractional coins", () => {
    const inventory = new Inventory();

    inventory.addCoins(10.9);

    expect(inventory.coins).toBe(10);
  });

  it("spends only what it has", () => {
    const inventory = new Inventory();

    inventory.addCoins(30);

    expect(inventory.spendCoins(10)).toBe(true);
    expect(inventory.coins).toBe(20);

    expect(inventory.spendCoins(50)).toBe(false);
    expect(inventory.coins).toBe(20);
  });
});

describe("capacity", () => {
  it("respects the slot limit", () => {
    const inventory = new Inventory(3);

    expect(inventory.add("skeleton_bone").added).toBe(1);
    expect(inventory.add("ghoul_claw").added).toBe(1);
    expect(inventory.add("ogre_pebble").added).toBe(1);

    expect(inventory.isFull).toBe(true);

    const result = inventory.add("ogre_hide");

    expect(result.added).toBe(0);
    expect(result.dropped).toBe(1);
  });

  it("reports free slots", () => {
    const inventory = new Inventory(4);

    expect(inventory.freeSlots).toBe(4);

    inventory.add("skeleton_bone");

    expect(inventory.freeSlots).toBe(3);
    expect(inventory.usedSlots).toBe(1);
  });

  it("never returns negative free slots", () => {
    const inventory = new Inventory(1);

    inventory.add("skeleton_bone", 1);
    inventory.add("ogre_pebble", 1);
    inventory.add("ogre_hide", 1);

    expect(inventory.usedSlots).toBe(1);
    expect(inventory.freeSlots).toBe(0);
  });
});

describe("stacking", () => {
  it("stacks materials into one slot", () => {
    const inventory = new Inventory();

    const first = inventory.add("dummy_wood", 5);
    const second = inventory.add("dummy_wood", 8);

    expect(first.added).toBe(5);
    expect(second.added).toBe(8);
    expect(inventory.usedSlots).toBe(1);
    expect(inventory.count("dummy_wood")).toBe(13);
  });

  it("splits stacks at the max stack size", () => {
    const inventory = new Inventory();

    const result = inventory.add("dummy_wood", 230);

    expect(result.added).toBe(230);
    expect(inventory.count("dummy_wood")).toBe(230);
    expect(inventory.usedSlots).toBe(3);
  });

  it("fills partial stacks before opening a new one", () => {
    const inventory = new Inventory();

    const item = getItem("dummy_wood");

    inventory.add("dummy_wood", item.maxStack - 5);

    const result = inventory.add("dummy_wood", 10);

    expect(result.added).toBe(10);
    expect(inventory.usedSlots).toBe(2);
  });

  it("keeps non-stackable items in separate slots", () => {
    const inventory = new Inventory();

    inventory.add("skeleton_blade", 3);

    expect(inventory.usedSlots).toBe(3);
    expect(inventory.count("skeleton_blade")).toBe(3);
  });
});

describe("removal", () => {
  it("removes across stacks", () => {
    const inventory = new Inventory();

    inventory.add("dummy_wood", 230);

    const removed = inventory.remove("dummy_wood", 150);

    expect(removed).toBe(150);
    expect(inventory.count("dummy_wood")).toBe(80);
    expect(inventory.usedSlots).toBe(1);
  });

  it("frees a slot when a stack empties", () => {
    const inventory = new Inventory();

    inventory.add("skeleton_bone", 2);
    inventory.remove("skeleton_bone", 1);

    expect(inventory.usedSlots).toBe(1);

    inventory.remove("skeleton_bone", 1);

    expect(inventory.usedSlots).toBe(0);
  });

  it("removes nothing it does not have", () => {
    const inventory = new Inventory();

    inventory.add("skeleton_bone", 1);

    expect(inventory.remove("ogre_hide", 5)).toBe(0);
    expect(inventory.count("skeleton_bone")).toBe(1);
  });

  it("ignores non-positive removals", () => {
    const inventory = new Inventory();

    inventory.add("skeleton_bone", 1);

    expect(inventory.remove("skeleton_bone", 0)).toBe(0);
    expect(inventory.remove("skeleton_bone", -5)).toBe(0);
  });
});

describe("invalid input", () => {
  it("rejects unknown items", () => {
    const inventory = new Inventory();

    const result = inventory.add("item_inexistente", 1);

    expect(result.added).toBe(0);
    expect(inventory.usedSlots).toBe(0);
  });

  it("rejects non-positive counts", () => {
    const inventory = new Inventory();

    expect(inventory.add("skeleton_bone", 0).added).toBe(0);
    expect(inventory.add("skeleton_bone", -3).added).toBe(0);
    expect(inventory.usedSlots).toBe(0);
  });
});

describe("summary", () => {
  it("reports coins, usage and items", () => {
    const inventory = new Inventory(5);

    inventory.addCoins(120);
    inventory.add("ogre_hammer", 1);
    inventory.add("dummy_wood", 3);

    const summary = inventory.summary();

    expect(summary.coins).toBe(120);
    expect(summary.used).toBe(2);
    expect(summary.capacity).toBe(5);
    expect(summary.isFull).toBe(false);
    expect(summary.items).toHaveLength(2);

    expect(
      summary.items.map((entry) => entry.itemId),
    ).toEqual(["ogre_hammer", "dummy_wood"]);

    expect(summary.items[1].count).toBe(3);
  });

  it("gives every stack a unique uid", () => {
    const inventory = new Inventory();

    inventory.add("skeleton_bone", 2);
    inventory.add("ogre_hide", 1);
    inventory.add("skeleton_bone", 3);

    const uids = inventory.stacks.map(
      (stack) => stack.uid,
    );

    expect(new Set(uids).size).toBe(uids.length);
  });

  it("marks equipped items through the equipment reference", () => {
    const inventory = new Inventory();

    inventory.add("skeleton_blade", 1);
    inventory.add("ghoul_claw", 1);

    const summary = inventory.summary({
      isEquipped: (itemId) =>
        itemId === "skeleton_blade",
    });

    const byItem = Object.fromEntries(
      summary.items.map((entry) => [
        entry.itemId,
        entry.equipped,
      ]),
    );

    expect(byItem.skeleton_blade).toBe(true);
    expect(byItem.ghoul_claw).toBe(false);
  });

  it("resets everything on clear", () => {
    const inventory = new Inventory();

    inventory.addCoins(50);
    inventory.add("ogre_hide", 1);

    inventory.clear();

    expect(inventory.coins).toBe(0);
    expect(inventory.stacks).toHaveLength(0);
  });
});
