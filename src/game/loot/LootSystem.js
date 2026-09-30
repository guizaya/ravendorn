import { randomBetween } from "../math.js";
import { getItem, RARITY } from "../../data/items/index.js";

export const MAX_GROUND_DROPS = 60;
export const PICKUP_RADIUS = 46;

export class LootSystem {
  constructor(world) {
    this.world = world;
    this.sequence = 0;
  }

  spawnGroundDrop(drop) {
    const list = this.world.drops;

    if (list.length >= MAX_GROUND_DROPS) {
      list.shift();
    }

    this.sequence += 1;

    list.push({
      uid: `drop_${this.sequence}`,
      ...drop,
      age: 0,
    });
  }

  scatter(x, y, amount, spread = 26) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * spread;

    return {
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
    };
  }

  roll(creature) {
    const table = creature.loot;

    if (!table) {
      return { coins: 0, items: [] };
    }

    const coins = this.rollCoins(table.coins);
    const items = this.rollItems(table);

    return { coins, items };
  }

  rollCoins(range) {
    if (!range) return 0;

    const min = range.min ?? 0;
    const max = range.max ?? min;

    return Math.floor(randomBetween(min, max + 1));
  }

  rollItems(table) {
    const pool = table.items ?? [];

    if (pool.length === 0) return [];

    const roll = Math.random();
    let chance = table.itemChance ?? 0;

    for (const boost of table.luck ?? []) {
      if (roll < boost.bonus) {
        chance += boost.bonus;
        break;
      }
    }

    if (Math.random() > chance) return [];

    const quantity = this.rollQuantity(table);
    const picked = [];

    for (let index = 0; index < quantity; index += 1) {
      const item = this.pickWeighted(pool);

      if (!item) continue;

      picked.push({
        itemId: item.id,
        count: 1,
      });
    }

    return picked;
  }

  rollQuantity(table) {
    const max = table.maxItems ?? 1;

    if (max <= 1) return 1;

    return 1 + Math.floor(Math.random() * max);
  }

  pickWeighted(pool) {
    let total = 0;

    for (const entry of pool) {
      total += entry.weight ?? 1;
    }

    if (total <= 0) return null;

    let roll = Math.random() * total;

    for (const entry of pool) {
      roll -= entry.weight ?? 1;

      if (roll <= 0) {
        return getItem(entry.id);
      }
    }

    return getItem(pool[pool.length - 1]?.id);
  }

  collectFrom(creature) {
    const inventory = this.world.inventory;
    const { coins, items } = this.roll(creature);

    const collected = { coins: 0, items: [], dropped: 0 };

    if (coins > 0) {
      inventory.addCoins(coins);
      collected.coins = coins;
    }

    for (const entry of items) {
      const result = inventory.add(
        entry.itemId,
        entry.count,
      );

      if (result.added > 0) {
        collected.items.push({
          itemId: entry.itemId,
          count: result.added,
        });
      }

      if (result.dropped > 0) {
        const position = this.scatter(
          creature.x,
          creature.y,
          result.dropped,
        );

        this.spawnGroundDrop({
          kind: "item",
          itemId: entry.itemId,
          count: result.dropped,
          x: position.x,
          y: position.y,
        });

        collected.dropped += result.dropped;
      }
    }

    return collected;
  }

  dropFrom(creature) {
    const { coins, items } = this.roll(creature);

    for (const entry of items) {
      const position = this.scatter(
        creature.x,
        creature.y,
        entry.count,
      );

      this.spawnGroundDrop({
        kind: "item",
        itemId: entry.itemId,
        count: entry.count,
        x: position.x,
        y: position.y,
      });
    }

    if (coins > 0) {
      const position = this.scatter(
        creature.x,
        creature.y,
        coins,
        34,
      );

      this.spawnGroundDrop({
        kind: "coins",
        coins,
        x: position.x,
        y: position.y,
      });
    }

    return { coins, items };
  }

  update(deltaTime) {
    const drops = this.world.drops;

    for (
      let index = drops.length - 1;
      index >= 0;
      index -= 1
    ) {
      drops[index].age += deltaTime;
    }
  }

  collectNear(player, radius = PICKUP_RADIUS) {
    const drops = this.world.drops;
    const collected = { coins: 0, items: [], rejected: 0 };

    for (
      let index = drops.length - 1;
      index >= 0;
      index -= 1
    ) {
      const drop = drops[index];

      const dx = drop.x - player.x;
      const dy = drop.y - player.y;

      if (dx * dx + dy * dy > radius * radius) {
        continue;
      }

      if (drop.kind === "coins") {
        this.world.inventory.addCoins(drop.coins);

        collected.coins += drop.coins;
        drops.splice(index, 1);
        continue;
      }

      if (drop.kind === "item") {
        const result = this.world.inventory.add(
          drop.itemId,
          drop.count,
        );

        if (result.added > 0) {
          collected.items.push({
            itemId: drop.itemId,
            count: result.added,
          });
        }

        collected.rejected += result.dropped;

        if (result.dropped <= 0) {
          drops.splice(index, 1);
        } else {
          drop.count = result.dropped;
        }
      }
    }

    return collected;
  }
}

export const LOOT_CONSTANTS = {
  MAX_GROUND_DROPS,
  PICKUP_RADIUS,
  RARITY,
};
