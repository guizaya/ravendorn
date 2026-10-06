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

  /**
   * O filtro PADRAO deste sistema de loot.
   *
   * Ele nao e mais o filtro do mundo: online cada jogador tem o seu,
   * e o sorteio recebe o filtro de quem vai receber o drop. Este
   * campo sobra para o single player e para os testes, que chamam
   * `roll` e `setFilter` sem sessao no meio.
   *
   * Deixar um filtro so no motor era o jeito de um jogador mudar o
   * loot de todo mundo no mesmo mapa.
   */
  setFilter(filter) {
    this.filter = filter;

    return this.pruneDrops(filter);
  }

  /**
   * itens barrados pelo filtro saem do pool antes do sorteio: assim
   * nunca viram drop, nunca vao para o chao e nunca entram na mochila.
   */
  allowedPool(pool, filter = this.filter) {
    if (!filter) return pool;

    return pool.filter((entry) =>
      isCollected(getItem(entry.id), filter),
    );
  }

  /**
   * limpa do chao o loot que parou de passar no filtro.
   *
   * Com `ownerId`, limpa SO o drop daquele dono. Sem ele, limpa
   * tudo, que e o comportamento do single player e dos testes.
   */
  pruneDrops(filter = this.filter, ownerId = null) {
    if (!filter) return 0;

    const drops = this.world.drops;
    let removed = 0;

    for (
      let index = drops.length - 1;
      index >= 0;
      index -= 1
    ) {
      const drop = drops[index];

      if (drop.kind !== "item") continue;

      // So o drop do dono conta. Um drop SEM dono tambem conta: e o
      // do single player e o drop antigo de antes desta regra, e no
      // servidor ele pertence a ninguem, entao ninguem o recolhe e
      // ele ficaria no chao para sempre
      if (
        ownerId !== null &&
        drop.ownerId &&
        drop.ownerId !== ownerId
      ) {
        continue;
      }

      if (isCollectedId(drop.itemId, filter)) {
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

  /**
   * Sorteia o loot de uma criatura.
   *
   * O `filter` e o de QUEM vai receber. Sem ele, usa o filtro padrao
   * do sistema, que e o caso do single player e dos testes. Online
   * o filtro chega pela sessao do matador, e e por isso que dois
   * jogadores no mesmo mapa podem ter filtros opostos: o drop e
   * sorteado para o dono, nao para o mundo
   */
  roll(creature, filter = this.filter) {
    const table = creature.loot;

    if (!table) {
      return { coins: 0, items: [] };
    }

    const coins = this.rollCoins(table.coins);
    const items = this.rollItems(table, filter);

    return { coins, items };
  }

  rollCoins(range) {
    if (!range) return 0;

    const min = range.min ?? 0;
    const max = range.max ?? min;

    return Math.floor(randomBetween(min, max + 1));
  }

  rollItems(table, filter = this.filter) {
    const pool = this.allowedPool(table.items ?? [], filter);

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

  /**
   * O inventario que recebe o loot.
   *
   * `owner` e a SESSAO de quem matou, e nao a entidade do jogador: o
   * `inventory` mora na sessao. Passar a entidade do jogador aqui
   * fazia o `owner?.inventory` dar `undefined` e cair no do mundo,
   * que no servidor e o do jogador em foco no fim do tick. O
   * fallback existe para o single player e para os testes, que
   * chamam sem dono.
   */
  inventoryOf(owner) {
    return owner?.inventory ?? this.world.inventory;
  }

  /**
   * Sorteia o loot e entrega no inventario de quem matou.
   *
   * `owner` e a SESSAO de quem deu o ultimo golpe (ver
   * `inventoryOf`). No single player ela e sempre a do jogador local
   * e nada muda. Online, o drop transbordado leva o id do dono para
   * que ninguem mais encaixe a mao.
   */
  collectFrom(creature, owner = null) {
    const inventory = this.inventoryOf(owner);

    // o filtro e o do DONO. `owner` e a sessao de quem matou, e e
    // ela que tem o `lootFilter`; sem este argumento o sorteio usaria
    // o filtro padrao do sistema e o filtro de um jogador mudaria o
    // loot de todo mundo
    const { coins, items } = this.roll(
      creature,
      owner?.lootFilter ?? this.filter,
    );

    const collected = {
      coins: 0,
      items: [],
      dropped: 0,
      ownerId: owner?.id ?? null,
    };

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
          // o transbordo pertence a quem matou. sem isso, o
          // primeiro jogador que passar pelo chao pegaria o item
          // de outro
          ownerId: owner?.id ?? null,
        });

        collected.dropped += result.dropped;
      }
    }

    return collected;
  }

  /**
   * Entrega itens JA SORTREADOS na mochila de um jogador.
   *
   * Existe separado do `collectFrom` porque a divisao por party sorteia
   * UMA vez e depois distribui: quem chama o `collectFrom` de novo
   * sorteia de novo, e ai um abate vira tres itens em tres gente
   *
   * O transbordo de inventario vai para o chao com o `ownerId` de quem
   * recebeu, nunca sem dono
   */
  grantItems(creature, owner = null, items = []) {
    const inventory = this.inventoryOf(owner);
    const given = { items: [], dropped: 0 };

    for (const entry of items) {
      const result = inventory.add(
        entry.itemId,
        entry.count,
      );

      if (result.added > 0) {
        given.items.push({
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
          ownerId: owner?.id ?? null,
        });

        given.dropped += result.dropped;
      }
    }

    return given;
  }

  dropFrom(creature, owner = null) {
    const { coins, items } = this.roll(
      creature,
      owner?.lootFilter ?? this.filter,
    );
    const ownerId = owner?.id ?? null;

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
        ownerId,
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
        ownerId,
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

  /**
   * Recolhe o que esta no chao perto do jogador.
   *
   * `player` e a ENTIDADE (precisa de `x`, `y` e `id` para a
   * distancia e para a checagem de dono), mas o `inventory` mora na
   * SESSAO. Por isso o inventario pode ser passado explicitamente:
   * sem isso ele sairia do `inventoryOf`, que cai no do jogador em
   * foco. Passando, a recolha nao depende de quem o motor tem em foco
   * no momento, que e a mesma armadilha que fazia o loot do abate
   * ir para a pessoa errada.
   */
  collectNear(
    player,
    radius = PICKUP_RADIUS,
    inventory = null,
  ) {
    const drops = this.world.drops;
    const destino = inventory ?? this.inventoryOf(player);
    const collected = { coins: 0, items: [], rejected: 0 };

    for (
      let index = drops.length - 1;
      index >= 0;
      index -= 1
    ) {
      const drop = drops[index];

      // Loot de mob tem dono. Sem esta checagem, um jogador que
      // passasse em cima do chao de um abate alheio pegaria o
      // item, e o "last hit" nao valeria nada. `ownerId` nulo e
      // loot sem dono (o do proprio jogador no single player, ou
      // o drop antigo de antes desta regra): sempre recolhivel.
      if (
        drop.ownerId !== undefined &&
        drop.ownerId !== null &&
        drop.ownerId !== player.id
      ) {
        continue;
      }

      const dx = drop.x - player.x;
      const dy = drop.y - player.y;

      if (dx * dx + dy * dy > radius * radius) {
        continue;
      }

      if (drop.kind === "coins") {
        destino.addCoins(drop.coins);

        collected.coins += drop.coins;
        drops.splice(index, 1);
        continue;
      }

      if (drop.kind === "item") {
        const result = destino.add(
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
