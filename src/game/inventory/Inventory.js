import {
  getItem,
  isStackable,
} from "../../data/items/index.js";

export const INVENTORY_CAPACITY = 20;

let instanceSequence = 0;

function nextInstanceId(itemId) {
  instanceSequence += 1;

  return `${itemId}#${instanceSequence}`;
}

export class Inventory {
  constructor(capacity = INVENTORY_CAPACITY) {
    this.capacity = capacity;
    this.stacks = [];
    this.coins = 0;
    this.overflow = 0;
  }

  get usedSlots() {
    return this.stacks.length;
  }

  get isFull() {
    return this.stacks.length >= this.capacity;
  }

  get freeSlots() {
    return Math.max(0, this.capacity - this.stacks.length);
  }

  addCoins(amount) {
    if (amount <= 0) return 0;

    this.coins += Math.floor(amount);

    return this.coins;
  }

  spendCoins(amount) {
    if (amount <= 0) return true;
    if (this.coins < amount) return false;

    this.coins -= Math.floor(amount);

    return true;
  }

  count(itemId) {
    let total = 0;

    for (const stack of this.stacks) {
      if (stack.itemId === itemId) {
        total += stack.count;
      }
    }

    return total;
  }

  has(itemId, count = 1) {
    return this.count(itemId) >= count;
  }

  findStack(itemId) {
    return (
      this.stacks.find(
        (stack) => stack.itemId === itemId,
      ) ?? null
    );
  }

  findByUid(uid) {
    return (
      this.stacks.find((stack) => stack.uid === uid) ??
      null
    );
  }

  takeUid(uid, count = 1) {
    const stack = this.findByUid(uid);

    if (!stack) return null;

    const taken = Math.min(stack.count, Math.max(1, count));

    stack.count -= taken;

    const result = {
      uid: stack.uid,
      itemId: stack.itemId,
      count: taken,
      equipped: stack.equipped,
    };

    if (stack.count <= 0) {
      this.stacks.splice(
        this.stacks.indexOf(stack),
        1,
      );
    }

    return result;
  }

  take(itemId, count = 1) {
    return this.takeUid(
      this.findStack(itemId)?.uid,
      count,
    );
  }

  add(itemId, count = 1) {
    const item = getItem(itemId);

    if (!item || count <= 0) {
      return { added: 0, dropped: count };
    }

    const stackable = isStackable(item);
    const maxStack = item.maxStack ?? 1;

    let remaining = Math.floor(count);
    let added = 0;

    if (stackable) {
      for (const stack of this.stacks) {
        if (stack.itemId !== itemId) continue;

        const room = maxStack - stack.count;

        if (room <= 0) continue;

        const moved = Math.min(room, remaining);

        stack.count += moved;
        remaining -= moved;
        added += moved;
      }
    }

    while (remaining > 0) {
      if (this.stacks.length >= this.capacity) {
        break;
      }

      const moved = stackable
        ? Math.min(maxStack, remaining)
        : 1;

      this.stacks.push({
        uid: nextInstanceId(itemId),
        itemId,
        count: moved,
        equipped: false,
      });

      remaining -= moved;
      added += moved;
    }

    this.overflow = remaining;

    return { added, dropped: remaining };
  }

  remove(itemId, count = 1) {
    const target = Math.floor(count);

    if (target <= 0) return 0;

    let remaining = target;

    for (
      let index = this.stacks.length - 1;
      index >= 0;
      index -= 1
    ) {
      const stack = this.stacks[index];

      if (stack.itemId !== itemId) continue;

      const taken = Math.min(stack.count, remaining);

      stack.count -= taken;
      remaining -= taken;

      if (stack.count <= 0) {
        this.stacks.splice(index, 1);
      }

      if (remaining <= 0) break;
    }

    return target - remaining;
  }

  clear() {
    this.stacks = [];
    this.coins = 0;
    this.overflow = 0;
  }

  summary(equipment = null) {
    return {
      coins: this.coins,
      used: this.usedSlots,
      capacity: this.capacity,
      isFull: this.isFull,
      items: this.stacks.map((stack) => ({
        uid: stack.uid,
        itemId: stack.itemId,
        count: stack.count,
        equipped: equipment
          ? equipment.isEquipped(stack.itemId)
          : false,
      })),
    };
  }
}
