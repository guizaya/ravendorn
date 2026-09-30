import { getItem, ITEM_TYPE } from "../../data/items/index.js";

export const EQUIPMENT_SLOTS = [
  {
    id: "weapon",
    name: "Arma",
    icon: "⚔",
    accepts: [ITEM_TYPE.WEAPON],
  },
  {
    id: "head",
    name: "Cabeça",
    icon: "⛑",
    accepts: [ITEM_TYPE.ARMOR],
  },
  {
    id: "chest",
    name: "Peito",
    icon: "⛊",
    accepts: [ITEM_TYPE.ARMOR],
  },
  {
    id: "legs",
    name: "Pernas",
    icon: "⛉",
    accepts: [ITEM_TYPE.ARMOR],
  },
  {
    id: "trinket1",
    name: "Anel",
    icon: "◈",
    accepts: [ITEM_TYPE.TRINKET],
  },
  {
    id: "trinket2",
    name: "Amuleto",
    icon: "❖",
    accepts: [ITEM_TYPE.TRINKET],
  },
];

export const EQUIPABLE_TYPES = [
  ITEM_TYPE.WEAPON,
  ITEM_TYPE.ARMOR,
  ITEM_TYPE.TRINKET,
];

export class Equipment {
  constructor(slots = EQUIPMENT_SLOTS) {
    this.slots = slots.map((slot) => ({
      ...slot,
      itemId: null,
      tier: 0,
      enhance: 0,
    }));
  }

  getSlots() {
    return this.slots;
  }

  getSlot(slotId) {
    return (
      this.slots.find((slot) => slot.id === slotId) ??
      null
    );
  }

  getEquipped(slotId) {
    const slot = this.getSlot(slotId);

    if (!slot?.itemId) return null;

    const item = getItem(slot.itemId);

    if (!item) return null;

    return {
      ...item,
      slotId: slot.id,
      tier: slot.tier,
      enhance: slot.enhance,
    };
  }

  getEquippedItems() {
    return this.slots
      .map((slot) => this.getEquipped(slot.id))
      .filter(Boolean);
  }

  isEquipped(itemId) {
    return this.slots.some(
      (slot) => slot.itemId === itemId,
    );
  }

  slotAccepts(slotId, itemId) {
    const slot = this.getSlot(slotId);

    if (!slot) return false;

    const item = getItem(itemId);

    if (!item) return false;

    return slot.accepts.includes(item.type);
  }

  canEquip(itemId, slotId) {
    return this.slotAccepts(slotId, itemId);
  }

  equip(itemId, slotId) {
    if (!this.canEquip(itemId, slotId)) {
      return false;
    }

    const slot = this.getSlot(slotId);

    if (slot.itemId === itemId) return false;

    const previous = slot.itemId;

    slot.itemId = itemId;
    slot.tier = getItem(itemId)?.tier ?? 1;
    slot.enhance = 0;

    return previous;
  }

  unequip(slotId) {
    const slot = this.getSlot(slotId);

    if (!slot?.itemId) return null;

    const previous = slot.itemId;

    slot.itemId = null;
    slot.tier = 0;
    slot.enhance = 0;

    return previous;
  }

  enhanceSlot(slotId) {
    const slot = this.getSlot(slotId);

    if (!slot?.itemId) return false;

    slot.enhance += 1;

    return true;
  }

  bonuses() {
    const total = {};

    for (const entry of this.getEquippedItems()) {
      const multiplier = 1 + entry.enhance * 0.12;

      for (const [key, value] of Object.entries(
        entry.stats ?? {},
      )) {
        const scaled =
          key === "attackSpeed" || key === "resourceRegen"
            ? value * multiplier
            : value * multiplier;

        total[key] = (total[key] ?? 0) + scaled;
      }
    }

    return total;
  }

  summary() {
    return {
      slots: this.slots.map((slot) => ({
        id: slot.id,
        name: slot.name,
        icon: slot.icon,
        itemId: slot.itemId,
        tier: slot.tier,
        enhance: slot.enhance,
        accepts: slot.accepts,
      })),
      bonuses: this.bonuses(),
      power: Math.round(
        Object.values(this.bonuses()).reduce(
          (sum, value) =>
            sum + Math.abs(Math.round(value)),
          0,
        ) * 10,
      ),
    };
  }
}
