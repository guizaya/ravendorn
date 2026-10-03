import { describe, expect, it } from "vitest";
import {
  LootSystem,
  MAX_GROUND_DROPS,
  PICKUP_RADIUS,
} from "./LootSystem.js";
import { Inventory } from "../inventory/Inventory.js";
import {
  CREATURE_TYPES,
  DUMMY_LOOT,
  TRAINING_DUMMY_BLUEPRINTS,
  createTrainingDummy,
} from "../../data/enemies/index.js";
import {
  getItem,
  ITEM_LIST,
  RARITY,
} from "../../data/items/index.js";

function createHarness(capacity = 20) {
  const world = {
    player: { x: 0, y: 0, radius: 22 },
    drops: [],
    inventory: new Inventory(capacity),
  };

  return { world, loot: new LootSystem(world) };
}

function creature(typeId) {
  return {
    id: `${typeId}_test`,
    x: 0,
    y: 0,
    ...CREATURE_TYPES[typeId],
  };
}

describe("loot tables", () => {
  it("gives every creature a table", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      expect(type.loot, type.id).toBeDefined();
      expect(type.loot.coins.max).toBeGreaterThan(
        type.loot.coins.min,
      );
      expect(type.loot.items.length).toBeGreaterThan(0);
    }
  });

  it("only references real items", () => {
    const tables = [
      ...Object.values(CREATURE_TYPES).map(
        (type) => type.loot,
      ),
      DUMMY_LOOT,
    ];

    for (const table of tables) {
      for (const entry of table.items) {
        expect(
          getItem(entry.id),
          entry.id,
        ).not.toBe(null);

        expect(entry.weight).toBeGreaterThan(0);
      }
    }
  });

  it("makes stronger creatures more valuable", () => {
    const slime = CREATURE_TYPES.slime.loot.coins.max;
    const ogre = CREATURE_TYPES.ogre.loot.coins.max;

    expect(ogre).toBeGreaterThan(slime);
  });

  it("raises item chance with creature tier", () => {
    // pelo NIVEL, e nao pela ordem em que as criaturas foram
    // declaradas no arquivo. "tier" e poder, e poder e nivel: um
    // bicho de nivel 12 nao pode dropar pior que um de nivel 11 so
    // porque foi escrito depois
    const criaturas = Object.values(CREATURE_TYPES).sort(
      (a, b) => a.level - b.level,
    );

    const chances = criaturas.map(
      (type) => type.loot.itemChance,
    );

    for (let i = 1; i < chances.length; i += 1) {
      expect(
        chances[i],
        `${criaturas[i].id} (nivel ${criaturas[i].level}) ` +
          `drota menos que ${criaturas[i - 1].id} ` +
          `(nivel ${criaturas[i - 1].level})`,
      ).toBeGreaterThanOrEqual(chances[i - 1]);
    }
  });

  it("gives the training dummies a table", () => {
    for (const blueprint of TRAINING_DUMMY_BLUEPRINTS) {
      const dummy = createTrainingDummy(blueprint);

      expect(dummy.loot).toBeDefined();
      expect(dummy.loot.items.length).toBeGreaterThan(0);
    }
  });
});

describe("rolling", () => {
  it("always returns coins inside the range", () => {
    const { loot } = createHarness();

    for (let roll = 0; roll < 300; roll += 1) {
      const result = loot.roll(creature("ogre"));
      const range = CREATURE_TYPES.ogre.loot.coins;

      expect(result.coins).toBeGreaterThanOrEqual(
        range.min,
      );
      expect(result.coins).toBeLessThanOrEqual(
        range.max,
      );
    }
  });

  it("respects the item chance", () => {
    const { loot } = createHarness();
    const range = CREATURE_TYPES.slime.loot;

    let withItems = 0;
    const runs = 2000;

    for (let roll = 0; roll < runs; roll += 1) {
      if (loot.roll(creature("slime")).items.length > 0) {
        withItems += 1;
      }
    }

    const rate = withItems / runs;

    expect(rate).toBeGreaterThan(
      range.itemChance * 0.7,
    );
    expect(rate).toBeLessThan(
      range.itemChance * 1.3,
    );
  });

  it("never returns more items than maxItems", () => {
    const { loot } = createHarness();

    for (let roll = 0; roll < 800; roll += 1) {
      const result = loot.roll(creature("ogre"));

      expect(result.items.length).toBeLessThanOrEqual(
        CREATURE_TYPES.ogre.loot.maxItems,
      );
    }
  });

  it("only rolls defined items", () => {
    const { loot } = createHarness();

    for (let roll = 0; roll < 800; roll += 1) {
      for (const entry of loot.roll(creature("ogre")).items) {
        expect(getItem(entry.itemId)).not.toBe(null);
      }
    }
  });

  it("returns nothing for a table-less creature", () => {
    const { loot } = createHarness();

    const result = loot.roll({
      id: "nope",
      x: 0,
      y: 0,
    });

    expect(result.coins).toBe(0);
    expect(result.items).toHaveLength(0);
  });
});

describe("loot filter", () => {
  const epicOnly = {
    equipment: RARITY.EPIC,
    material: RARITY.EPIC,
  };

  const noMaterials = {
    equipment: null,
    material: RARITY.LEGENDARY,
  };

  it("keeps every item when no filter is set", () => {
    const { loot } = createHarness();

    for (let roll = 0; roll < 3000; roll += 1) {
      for (const entry of loot.rollItems(
        CREATURE_TYPES.slime.loot,
      )) {
        expect(
          getItem(entry.itemId),
          entry.itemId,
        ).not.toBe(null);
      }
    }
  });

  it("never rolls an item the filter rejects", () => {
    const { loot } = createHarness();

    loot.setFilter(epicOnly);

    for (let roll = 0; roll < 4000; roll += 1) {
      for (const entry of loot.rollItems(
        CREATURE_TYPES.ghoul.loot,
      )) {
        expect(
          [
            RARITY.EPIC,
            RARITY.LEGENDARY,
          ],
          `${entry.itemId} nao deveria sair`,
        ).toContain(getItem(entry.itemId).rarity);
      }
    }
  });

  it("drops nothing at all when the whole pool is rejected", () => {
    const { loot } = createHarness();

    loot.setFilter(noMaterials);

    for (let roll = 0; roll < 500; roll += 1) {
      expect(
        loot.rollItems(CREATURE_TYPES.slime.loot),
      ).toHaveLength(0);
    }
  });

  it("still pays coins when every item is rejected", () => {
    const { loot } = createHarness();

    loot.setFilter(noMaterials);

    let coins = 0;

    for (let roll = 0; roll < 200; roll += 1) {
      coins += loot.roll(creature("slime")).coins;
    }

    expect(coins).toBeGreaterThan(0);
  });

  it("never spawns a rejected item on the ground", () => {
    const { world, loot } = createHarness();

    loot.setFilter(noMaterials);

    for (let kill = 0; kill < 300; kill += 1) {
      loot.dropFrom(creature("skeleton"));
    }

    for (const drop of world.drops) {
      if (drop.kind !== "item") continue;

      expect(
        getItem(drop.itemId).rarity,
        drop.itemId,
      ).not.toBe(RARITY.COMMON);
    }
  });

  it("never puts a rejected item in the inventory", () => {
    const { world, loot } = createHarness();

    loot.setFilter(epicOnly);

    for (let kill = 0; kill < 400; kill += 1) {
      loot.collectFrom(creature("skeleton"));
    }

    for (const stack of world.inventory.stacks) {
      expect(
        [
          RARITY.EPIC,
          RARITY.LEGENDARY,
        ],
        stack.itemId,
      ).toContain(getItem(stack.itemId).rarity);
    }
  });

  it("clears rejected items already lying on the ground", () => {
    const { world, loot } = createHarness();

    loot.spawnGroundDrop({
      kind: "item",
      itemId: "skeleton_bone",
      count: 3,
      x: 0,
      y: 0,
    });

    loot.spawnGroundDrop({
      kind: "coins",
      coins: 50,
      x: 0,
      y: 0,
    });

    loot.spawnGroundDrop({
      kind: "item",
      itemId: "willow_bow",
      count: 1,
      x: 0,
      y: 0,
    });

    const removed = loot.setFilter(noMaterials);

    expect(removed).toBe(3);
    expect(world.drops).toHaveLength(2);
    expect(
      world.drops.some((drop) => drop.kind === "item"),
    ).toBe(true);
    expect(
      world.drops.some((drop) => drop.kind === "coins"),
    ).toBe(true);
  });

  it("keeps the ground untouched when clearing the filter", () => {
    const { world, loot } = createHarness();

    loot.spawnGroundDrop({
      kind: "item",
      itemId: "skeleton_bone",
      count: 2,
      x: 0,
      y: 0,
    });

    loot.setFilter(null);

    expect(world.drops).toHaveLength(1);
  });

  it("favours what the player asked to keep", () => {
    const { loot } = createHarness();

    /**
     * A contagem por raridade do que o ogre solta.
     *
     * O teste media `rare` e `epic` de EQUIPAMENTO, e o ogre soltava
     * marreta (rara) e coracao (epico). Nenhum dos dois existe mais:
     * o drop do ogre hoje e so `ogre_pebble` (comum) e `ogre_hide`
     * (incomum). A tabela virou outra, entao a contagem precisa
     * acompanhar a tabela real em vez de raridades que sairam
     */
    const sample = () => {
      const tally = { comum: 0, incomum: 0, total: 0 };

      for (let roll = 0; roll < 6000; roll += 1) {
        for (const entry of loot.rollItems(
          CREATURE_TYPES.ogre.loot,
        )) {
          tally.total += 1;

          const rarity = getItem(entry.itemId).rarity;

          if (rarity === RARITY.COMMON) tally.comum += 1;
          if (rarity === RARITY.UNCOMMON) {
            tally.incomum += 1;
          }
        }
      }

      return tally;
    };

    // sem filtro o ogre solta seixo (comum) e couro (incomum)
    const before = sample();

    expect(before.total).toBeGreaterThan(0);
    expect(before.comum / before.total).toBeGreaterThan(
      0.01,
    );
    expect(before.incomum / before.total).toBeGreaterThan(
      0.01,
    );

    loot.setFilter({
      equipment: RARITY.EPIC,
      // o drop do ogre tem so `common` e `uncommon`. Um filtro em
      // `uncommon` remove o seixo e mantem o couro: e a prova de
      // que o filtro age de verdade numa tabela tao curta
      material: RARITY.UNCOMMON,
    });

    const after = sample();

    expect(after.total).toBeGreaterThan(0);

    // barrando o comum, ele some de vez
    expect(after.comum).toBe(0);

    // e o que foi pedido realmente passa a sair
    expect(after.incomum).toBeGreaterThan(0);
  });
});

describe("ground drops", () => {
  it("spawns coins and items on death", () => {
    const { world, loot } = createHarness();
    const target = creature("skeleton");

    for (let kill = 0; kill < 40; kill += 1) {
      loot.dropFrom(target);
    }

    expect(world.drops.length).toBeGreaterThan(0);

    const kinds = new Set(
      world.drops.map((drop) => drop.kind),
    );

    expect(kinds.has("coins")).toBe(true);
  });

  it("scatters drops around the death point", () => {
    const { world, loot } = createHarness();
    const target = { ...creature("ogre"), x: 500, y: 500 };

    for (let kill = 0; kill < 30; kill += 1) {
      loot.dropFrom(target);
    }

    for (const drop of world.drops) {
      expect(
        Math.hypot(drop.x - 500, drop.y - 500),
      ).toBeLessThanOrEqual(40);
    }
  });

  it("caps the number of ground drops", () => {
    const { world, loot } = createHarness();
    const target = creature("ogre");

    for (let kill = 0; kill < 400; kill += 1) {
      loot.dropFrom(target);
    }

    expect(world.drops.length).toBeLessThanOrEqual(
      MAX_GROUND_DROPS,
    );
  });

  it("ages drops over time", () => {
    const { world, loot } = createHarness();

    loot.spawnGroundDrop({
      kind: "coins",
      coins: 5,
      x: 0,
      y: 0,
    });

    loot.update(1.5);

    expect(world.drops[0].age).toBeCloseTo(1.5, 5);
  });
});

describe("pickup", () => {
  it("collects drops within the radius", () => {
    const { world, loot } = createHarness();

    world.drops.push(
      {
        uid: "a",
        kind: "coins",
        coins: 25,
        x: 10,
        y: 0,
        age: 0,
      },
      {
        uid: "b",
        kind: "item",
        itemId: "willow_bow",
        count: 1,
        x: 0,
        y: 20,
        age: 0,
      },
    );

    const collected = loot.collectNear(world.player);

    expect(collected.coins).toBe(25);
    expect(collected.items).toHaveLength(1);
    expect(world.drops).toHaveLength(0);
    expect(world.inventory.coins).toBe(25);
    expect(world.inventory.count("willow_bow")).toBe(1);
  });

  it("ignores drops outside the radius", () => {
    const { world, loot } = createHarness();

    world.drops.push({
      uid: "a",
      kind: "coins",
      coins: 25,
      x: PICKUP_RADIUS + 30,
      y: 0,
      age: 0,
    });

    const collected = loot.collectNear(world.player);

    expect(collected.coins).toBe(0);
    expect(world.drops).toHaveLength(1);
  });

  it("keeps the drop when the inventory is full", () => {
    const { world, loot } = createHarness(1);

    world.inventory.add("skeleton_bone", 1);
    expect(world.inventory.isFull).toBe(true);

    world.drops.push(
      {
        uid: "a",
        kind: "item",
        itemId: "willow_bow",
        count: 1,
        x: 0,
        y: 0,
        age: 0,
      },
      {
        uid: "b",
        kind: "coins",
        coins: 40,
        x: 5,
        y: 0,
        age: 0,
      },
    );

    const collected = loot.collectNear(world.player);

    expect(collected.items).toHaveLength(0);
    expect(collected.rejected).toBe(1);

    // moedas nunca são bloqueadas
    expect(collected.coins).toBe(40);
    expect(world.inventory.coins).toBe(40);

    const remaining = world.drops.filter(
      (drop) => drop.kind === "item",
    );

    expect(remaining).toHaveLength(1);
    expect(remaining[0].itemId).toBe("willow_bow");
  });

  it("partially collects into a full stack", () => {
    const { world, loot } = createHarness(1);
    const maxStack = getItem("dummy_wood").maxStack;

    world.inventory.add("dummy_wood", maxStack - 3);
    expect(world.inventory.isFull).toBe(true);

    world.drops.push({
      uid: "a",
      kind: "item",
      itemId: "dummy_wood",
      count: 10,
      x: 0,
      y: 0,
      age: 0,
    });

    const collected = loot.collectNear(world.player);

    expect(collected.items[0].count).toBe(3);
    expect(collected.rejected).toBe(7);

    const remaining = world.drops[0];

    expect(remaining.count).toBe(7);
  });

  it("collects nothing when there is nothing nearby", () => {
    const { world, loot } = createHarness();

    const collected = loot.collectNear(world.player);

    expect(collected.coins).toBe(0);
    expect(collected.items).toHaveLength(0);
  });
});

describe("item catalog", () => {
  it("has unique ids and valid definitions", () => {
    const ids = new Set();

    for (const item of ITEM_LIST) {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);

      expect(item.name.length).toBeGreaterThan(0);
      expect(item.icon.length).toBeGreaterThan(0);
      expect(item.value).toBeGreaterThan(0);
      expect(item.rarity).toBeDefined();
    }
  });

  it("marks stackables with a sane max", () => {
    for (const item of ITEM_LIST) {
      if (!item.stackable) continue;

      expect(item.maxStack).toBeGreaterThan(1);
    }
  });
});
