import { randomBetween } from "../math.js";
import { BALANCE } from "../balance.js";
import { isCollected, isCollectedId } from "./lootFilter.js";
import {
  getItem,
  isStackable,
  RARITY,
} from "../../data/items/index.js";

export const MAX_GROUND_DROPS = 60;
export const PICKUP_RADIUS = 46;

export class LootSystem {
  constructor(world) {
    this.world = world;
    this.sequence = 0;
    this.filter = null;
  }

  setFilter(filter) {
    this.filter = filter;

    return this.pruneDrops();
  }

  /**
   * itens barrados pelo filtro saem do pool antes do sorteio: assim
   * nunca viram drop, nunca vao para o chao e nunca entram na mochila.
   */
  allowedPool(pool) {
    if (!this.filter) return pool;

    return pool.filter((entry) =>
      isCollected(getItem(entry.id), this.filter),
    );
  }

  /** limpa do chao o loot que parou de passar no filtro */
  pruneDrops() {
    if (!this.filter) return 0;

    const drops = this.world.drops;
    let removed = 0;

    for (
      let index = drops.length - 1;
      index >= 0;
      index -= 1
    ) {
      const drop = drops[index];

      if (drop.kind !== "item") continue;

      if (isCollectedId(drop.itemId, this.filter)) {
        continue;
      }

      removed += drop.count ?? 1;
      drops.splice(index, 1);
    }

    return removed;
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
    const pool = this.allowedPool(table.items ?? []);

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
        count: this.rollCount(item),
      });
    }

    return picked;
  }

  rollQuantity(table) {
    const max = table.maxItems ?? 1;

    if (max <= 1) return 1;

    return 1 + Math.floor(Math.random() * max);
  }

  /** materiais empilhavel chegam em pilhas, nunca em unidade solitaria */
  rollCount(item) {
    const max = BALANCE.stackableDropMax ?? 1;

    if (!isStackable(item) || max <= 1) return 1;

    return 1 + Math.floor(Math.random() * max);
  }

  /**
   * peso autoral corrigido pelos biais de balance: comum pesa muito mais
   * que lendario e item de missao ganha um empurrao extra.
   */
  effectiveWeight(entry) {
    const item = getItem(entry.id);

    if (!item) return entry.weight ?? 1;

    const rarityWeight =
      BALANCE.rarityDropWeight?.[item.rarity] ?? 1;

    const questWeight = item.quest
      ? (BALANCE.questItemBonus ?? 1)
      : 1;

    return (entry.weight ?? 1) * rarityWeight * questWeight;
  }

  pickWeighted(pool) {
    let total = 0;

    for (const entry of pool) {
      total += this.effectiveWeight(entry);
    }

    if (total <= 0) return null;

    let roll = Math.random() * total;

    for (const entry of pool) {
      roll -= this.effectiveWeight(entry);

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
  rarityDropWeight: BALANCE.rarityDropWeight,
  questItemBonus: BALANCE.questItemBonus,
  stackableDropMax: BALANCE.stackableDropMax,
};
