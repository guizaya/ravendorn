import { describe, expect, it } from "vitest";
import {
  Equipment,
  EQUIPMENT_SLOTS,
} from "./Equipment.js";
import { ITEM_TYPE } from "../../data/items/index.js";

describe("equipment slots", () => {
  it("exposes the expected slot layout", () => {
    const equipment = new Equipment();

    expect(equipment.getSlots()).toHaveLength(
      EQUIPMENT_SLOTS.length,
    );

    for (const slot of equipment.getSlots()) {
      expect(slot.itemId).toBe(null);
      expect(slot.enhance).toBe(0);
      expect(slot.accepts.length).toBeGreaterThan(0);
    }
  });

  it("starts empty", () => {
    const equipment = new Equipment();

    expect(equipment.getEquippedItems()).toHaveLength(0);
    expect(equipment.bonuses()).toEqual({});
  });
});

describe("equipping", () => {
  it("accepts only matching types", () => {
    const equipment = new Equipment();

    expect(
      equipment.canEquip("skeleton_blade", "weapon"),
    ).toBe(true);

    expect(
      equipment.canEquip("skeleton_crown", "head"),
    ).toBe(true);

    expect(
      equipment.canEquip("skeleton_blade", "head"),
    ).toBe(false);

    expect(
      equipment.canEquip("slime_gel", "weapon"),
    ).toBe(false);
  });

  it("rejects unknown slots and items", () => {
    const equipment = new Equipment();

    expect(
      equipment.canEquip("skeleton_blade", "anel"),
    ).toBe(false);

    expect(
      equipment.canEquip("item_fantasma", "weapon"),
    ).toBe(false);
  });

  it("fills a slot and tracks it", () => {
    const equipment = new Equipment();

    // retorna null quando o slot estava vazio
    expect(
      equipment.equip("skeleton_blade", "weapon"),
    ).toBe(null);

    equipment.equip("skeleton_blade", "weapon");

    expect(equipment.isEquipped("skeleton_blade")).toBe(
      true,
    );

    expect(
      equipment.getEquipped("weapon").name,
    ).toBe("Lâmina Espectral");

    expect(equipment.getEquipped("weapon").tier).toBe(2);
  });

  it("keeps the item name instead of the slot name", () => {
    const equipment = new Equipment();

    equipment.equip("ashen_band", "trinket1");

    const equipped = equipment.getEquipped("trinket1");

    expect(equipped.name).toBe("Anel de Cinzas");
    expect(equipped.slotId).toBe("trinket1");
  });

  it("returns the previous item when swapping", () => {
    const equipment = new Equipment();

    equipment.equip("skeleton_blade", "weapon");

    const previous = equipment.equip(
      "ember_blade",
      "weapon",
    );

    expect(previous).toBe("skeleton_blade");
    expect(equipment.isEquipped("ember_blade")).toBe(true);
    expect(equipment.isEquipped("skeleton_blade")).toBe(
      false,
    );
  });

  it("refuses to equip the same item twice", () => {
    const equipment = new Equipment();

    equipment.equip("skeleton_blade", "weapon");

    expect(equipment.equip("skeleton_blade", "weapon")).toBe(
      false,
    );
  });

  it("unequips back to empty", () => {
    const equipment = new Equipment();

    equipment.equip("frost_ward", "trinket1");

    expect(equipment.unequip("trinket1")).toBe("frost_ward");

    expect(equipment.getEquipped("trinket1")).toBe(null);
    expect(equipment.bonuses()).toEqual({});
  });

  it("ignores unequipping an empty slot", () => {
    expect(new Equipment().unequip("chest")).toBe(null);
  });
});

describe("bonuses", () => {
  it("aggregates stats from every slot", () => {
    const equipment = new Equipment();

    equipment.equip("ember_blade", "weapon");
    equipment.equip("scout_jerkin", "chest");
    equipment.equip("ashen_band", "trinket1");

    const bonuses = equipment.bonuses();

    // ember_blade 22 atk, scout_jerkin 7 def, ashen_band 6 atq + 40 hp
    expect(bonuses.attack).toBe(28);
    expect(bonuses.defense).toBe(7);
    expect(bonuses.maxHp).toBe(40);
  });

  it("scales bonuses with enhancement", () => {
    const equipment = new Equipment();

    equipment.equip("ember_blade", "weapon");

    const base = equipment.bonuses().attack;

    equipment.enhanceSlot("weapon");
    equipment.enhanceSlot("weapon");

    expect(equipment.getSlot("weapon").enhance).toBe(2);
    expect(equipment.bonuses().attack).toBeGreaterThan(base);
  });

  it("handles negative stats", () => {
    const equipment = new Equipment();

    equipment.equip("ogre_hammer", "weapon");

    expect(equipment.bonuses().attackSpeed).toBeLessThan(0);
  });

  it("never enhances an empty slot", () => {
    expect(new Equipment().enhanceSlot("legs")).toBe(
      false,
    );
  });
});

describe("summary", () => {
  it("exposes slots, bonuses and power", () => {
    const equipment = new Equipment();

    equipment.equip("ember_blade", "weapon");

    const summary = equipment.summary();

    expect(summary.slots).toHaveLength(
      EQUIPMENT_SLOTS.length,
    );

    expect(summary.bonuses.attack).toBe(22);
    expect(summary.power).toBeGreaterThan(0);
  });

  it("reports zero power when empty", () => {
    expect(new Equipment().summary().power).toBe(0);
  });

  it("lists equipped items", () => {
    const equipment = new Equipment();

    equipment.equip("ember_blade", "weapon");
    equipment.equip("tracker_boots", "legs");

    const items = equipment.getEquippedItems();

    expect(items).toHaveLength(2);
    expect(
      items.some((item) => item.type === ITEM_TYPE.WEAPON),
    ).toBe(true);
  });
});
