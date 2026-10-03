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

    inventory.add("willow_bow", 3);

    expect(inventory.usedSlots).toBe(3);
    expect(inventory.count("willow_bow")).toBe(3);
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
    inventory.add("willow_bow", 1);
    inventory.add("dummy_wood", 3);

    const summary = inventory.summary();

    expect(summary.coins).toBe(120);
    expect(summary.used).toBe(2);
    expect(summary.capacity).toBe(5);
    expect(summary.isFull).toBe(false);
    expect(summary.items).toHaveLength(2);

    expect(
      summary.items.map((entry) => entry.itemId),
    ).toEqual(["willow_bow", "dummy_wood"]);

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

    inventory.add("willow_bow", 1);
    inventory.add("ghoul_claw", 1);

    const summary = inventory.summary({
      isEquipped: (itemId) =>
        itemId === "willow_bow",
    });

    const byItem = Object.fromEntries(
      summary.items.map((entry) => [
        entry.itemId,
        entry.equipped,
      ]),
    );

    expect(byItem.willow_bow).toBe(true);
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

describe("variantes de raridade", () => {
  const BOW = "willow_bow";
  const WOOD = "dummy_wood";

  it("sem raridade usa a do catalogo", () => {
    const inventory = new Inventory();

    inventory.add(BOW, 1);

    // willow_bow e incomum no catalogo
    expect(inventory.stacks[0].rarity).toBe("uncommon");
    expect(inventory.countAt(BOW, "uncommon")).toBe(1);
  });

  it("guarda a raridade pedida", () => {
    const inventory = new Inventory();

    inventory.add(BOW, 1, "legendary");

    expect(inventory.countAt(BOW, "legendary")).toBe(1);
    expect(inventory.countAt(BOW, "uncommon")).toBe(0);
  });

  it("o mesmo item em duas raridades sao dois slots", () => {
    const inventory = new Inventory();

    inventory.add(BOW, 1, "common");
    inventory.add(BOW, 1, "legendary");

    expect(inventory.stacks).toHaveLength(2);
    expect(inventory.count(BOW)).toBe(2);
  });

  it("count soma todas as raridades", () => {
    // e o que a receita olha: "tenho o material", e nao
    // "tenho o material naquela cor"
    const inventory = new Inventory();

    inventory.add(WOOD, 5, "common");
    inventory.add(WOOD, 7, "legendary");

    expect(inventory.count(WOOD)).toBe(12);
    expect(inventory.countAt(WOOD, "common")).toBe(5);
    expect(inventory.countAt(WOOD, "legendary")).toBe(7);
  });

  it("empilha material dentro da mesma raridade", () => {
    const inventory = new Inventory();

    inventory.add(WOOD, 10, "rare");
    inventory.add(WOOD, 10, "rare");

    expect(inventory.stacks).toHaveLength(1);
    expect(inventory.countAt(WOOD, "rare")).toBe(20);
  });

  it("nao mistura pilhas de raridades diferentes", () => {
    const inventory = new Inventory();

    inventory.add(WOOD, 10, "rare");
    inventory.add(WOOD, 10, "epic");

    expect(inventory.stacks).toHaveLength(2);
  });

  it("findStack acha a variante pedida", () => {
    const inventory = new Inventory();

    inventory.add(BOW, 1, "epic");

    expect(
      inventory.findStack(BOW, "epic")?.rarity,
    ).toBe("epic");
    expect(inventory.findStack(BOW, "common")).toBe(null);
  });

  it("remove sem raridade varre qualquer variante", () => {
    const inventory = new Inventory();

    inventory.add(WOOD, 5, "common");
    inventory.add(WOOD, 5, "legendary");

    expect(inventory.remove(WOOD, 7)).toBe(7);
    expect(inventory.count(WOOD)).toBe(3);
  });

  it("remove com raridade gasta so aquela pilha", () => {
    const inventory = new Inventory();

    inventory.add(WOOD, 5, "common");
    inventory.add(WOOD, 5, "legendary");

    inventory.remove(WOOD, 5, "legendary");

    expect(inventory.countAt(WOOD, "legendary")).toBe(0);
    expect(inventory.countAt(WOOD, "common")).toBe(5);
  });

  it("takeUid devolve a raridade da pilha", () => {
    const inventory = new Inventory();

    inventory.add(BOW, 1, "legendary");

    const taken = inventory.take(
      BOW,
      1,
      "legendary",
    );

    expect(taken.rarity).toBe("legendary");
    expect(inventory.count(BOW)).toBe(0);
  });

  it("summary expoe a raridade de cada pilha", () => {
    const inventory = new Inventory();

    inventory.add(BOW, 1, "epic");
    inventory.add(WOOD, 3, "common");

    const items = inventory.summary().items;

    expect(items[0].rarity).toBe("epic");
    expect(items[1].rarity).toBe("common");
  });

  it("os uids de variantes diferentes nao colidem", () => {
    const inventory = new Inventory();

    inventory.add(BOW, 1, "common");
    inventory.add(BOW, 1, "legendary");

    const uids = inventory.stacks.map((stack) => stack.uid);

    expect(new Set(uids).size).toBe(2);
  });
});
