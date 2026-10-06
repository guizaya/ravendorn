import {
  baseRarityOf,
  getItem,
  isStackable,
} from "../../data/items/index.js";

export const INVENTORY_CAPACITY = 20;

let instanceSequence = 0;

function nextInstanceId(itemId, rarity) {
  instanceSequence += 1;

  return `${itemId}#${rarity}#${instanceSequence}`;
}

/**
 * QUANTOS SLOTS UM ITEM PRECISA, sem colocar nada.
 *
 * E a MESMA conta que o `add` faz — funde nas pilhas que ja existem e
 * sobe o numero de pilhas novas — so que respondendo "quantas" em vez
 * de "quantas couberam". Sem isto, a unica forma de saber se o item
 * cabe e tentar, e o Tentar ja custou a moeda
 *
 * Considera a MESMA raridade que o `add` consideraria, porque funde so
 * com pilhas de raridade igual. E por isso que 200 unidades de um
 * material que voce nao tem precisam de 3 slots (99 por pilha) e as
 * mesmas 200 de um material que voce ja tem cabem em 0
 *
 * E uma funcao PURA, e nao um metodo, porque os dois lados precisam da
 * mesma conta: o servidor para recusar a compra e o painel para
 * desabilitar o botao. Duas copias desta conta divergem na primeira
 * regra que alguem afrouxar
 */
export function slotsNecessarios(
  stacks,
  itemId,
  count = 1,
  rarity = null,
) {
  const item = getItem(itemId);

  if (!item || count <= 0) return 0;

  const target = rarity ?? baseRarityOf(itemId);
  const stackable = isStackable(item);
  const maxStack = item.maxStack ?? 1;

  let remaining = Math.floor(count);

  if (stackable) {
    for (const stack of stacks) {
      if (remaining <= 0) break;

      if (stack.itemId !== itemId) continue;
      if ((stack.rarity ?? baseRarityOf(itemId)) !== target) {
        continue;
      }

      const room = maxStack - stack.count;

      if (room <= 0) continue;

      remaining -= Math.min(room, remaining);
    }
  }

  let slots = 0;

  while (remaining > 0) {
    remaining -= stackable ? Math.min(maxStack, remaining) : 1;
    slots += 1;
  }

  return slots;
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

  /**
   * QUANTOS SLOTS UM ITEM PRECISA, sem colocar nada na mochila.
   *
   * E a MESMA conta que o `add` faz — funde nas pilhas que ja tem e
   * sobe o numero de pilhas novas — so que respondendo "quantas" em vez
   * de "quantas couberam". Sem isto, a unica forma de saber se o item
   * cabe e tentar: o dinheiro ja tinha sido gasto, o `add` tinha
   * devolvido metade no `overflow`, e o jogador recebia um "mochila
   * cheia" sem nunca ter visto o numero que explicaria
   *
   * Considera a MESMA raridade que o `add` consideraria, porque funde
   * so com pilhas de raridade igual. E por isso que 5 unidades de um
   * material novo podem precisar de 1 slot e as mesmas 5 de um material
   * que voce ja tem cabem em 0
   */
  slotsNeeded(itemId, count = 1, rarity = null) {
    return slotsNecessarios(this.stacks, itemId, count, rarity);
  }

  /**
   * ESTE ITEM CABE NA MOCHILA AGORA?
   *
   * O `slotsNeeded` e o `freeSlots` juntos. E o que a compra do mercado
   * pergunta ANTES de gastar a moeda, para o "mochila cheia" chegar
   * com o numero que explica em vez de uma negativa seca
   */
  cabe(itemId, count = 1, rarity = null) {
    return this.slotsNeeded(itemId, count, rarity) <= this.freeSlots;
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

  /**
   * Total do item em TODAS as raridades. E o que a receita olha:
   * o jogador tem os materiais, e a raridade deles nao entra na
   * conta.
   */
  count(itemId) {
    let total = 0;

    for (const stack of this.stacks) {
      if (stack.itemId === itemId) {
        total += stack.count;
      }
    }

    return total;
  }

  /** total do item naquela raridade exata */
  countAt(itemId, rarity) {
    const target =
      rarity ?? baseRarityOf(itemId);

    let total = 0;

    for (const stack of this.stacks) {
      if (stack.itemId !== itemId) continue;
      if ((stack.rarity ?? baseRarityOf(itemId)) !== target) {
        continue;
      }

      total += stack.count;
    }

    return total;
  }

  has(itemId, count = 1) {
    return this.count(itemId) >= count;
  }

  hasAt(itemId, count, rarity) {
    return this.countAt(itemId, rarity) >= count;
  }

  findStack(itemId, rarity = null) {
    if (rarity !== null) {
      const target =
        rarity ?? baseRarityOf(itemId);

      return (
        this.stacks.find(
          (stack) =>
            stack.itemId === itemId &&
            (stack.rarity ?? baseRarityOf(itemId)) === target,
        ) ?? null
      );
    }

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
      rarity: stack.rarity ?? baseRarityOf(stack.itemId),
      count: taken,
      equipped: stack.equipped,

      /**
       * O afixo viaja com a peca que saiu.
       *
       * O `equipItem` do motor tira a peca da mochila, veste no slot e
       * devolve a que estava vestida com `inventory.add`. Se o
       * enchantamento nao estivesse aqui, ele morreria nessa ida: a
       * peca voltaria da mochila sem afixo, e o jogador veria um arco
       * encantado perder o afixo so por trocar de lugar
       */
      enchant: stack.enchant ?? null,
    };

    if (stack.count <= 0) {
      this.stacks.splice(
        this.stacks.indexOf(stack),
        1,
      );
    }

    return result;
  }

  take(itemId, count = 1, rarity = null) {
    return this.takeUid(
      this.findStack(itemId, rarity)?.uid,
      count,
    );
  }

  /**
   * `rarity` nulo significa a raridade de catalogo do item, entao
   * loot, missao e os testes antigos continuam produzindo o item
   * cru. O craft e o unico que passa raridade explicita.
   */
  add(itemId, count = 1, rarity = null) {
    const item = getItem(itemId);

    if (!item || count <= 0) {
      return { added: 0, dropped: count };
    }

    const target = rarity ?? baseRarityOf(itemId);
    const stackable = isStackable(item);
    const maxStack = item.maxStack ?? 1;

    let remaining = Math.floor(count);
    let added = 0;

    if (stackable) {
      for (const stack of this.stacks) {
        if (stack.itemId !== itemId) continue;
        if ((stack.rarity ?? baseRarityOf(itemId)) !== target) {
          continue;
        }

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
        uid: nextInstanceId(itemId, target),
        itemId,
        rarity: target,
        count: moved,
        equipped: false,

        /**
         * O ENCANTAMENTO, ou `null`.
         *
         * E `null` no nascimento, e nao `undefined`: o painel e o save
         * leem este campo, e a diferenca entre "sem afixo" e "afixo
         * desconhecido" precisa ser uma so coisa
         *
         * Material nunca recebe um, porque material e empilhavel e uma
         * pilha de 99 nao tem um afixo por peca. Nao e por Luck: e que
         * `add` funde duas pilhas do MESMO item e MESMA raridade, e as
         * duas nao poderiam ter afixos diferentes
         */
        enchant: null,
      });

      remaining -= moved;
      added += moved;
    }

    this.overflow = remaining;

    return { added, dropped: remaining };
  }

  /**
   * Sem `rarity`, varre qualquer variante do item. A receita usa
   * esta forma: o ingrediente e "o item", nao "aquele item
   * naquela raridade".
   */
  remove(itemId, count = 1, rarity = null) {
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

      if (rarity !== null) {
        const wanted = rarity ?? baseRarityOf(itemId);

        if ((stack.rarity ?? baseRarityOf(itemId)) !== wanted) {
          continue;
        }
      }

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
        rarity:
          stack.rarity ?? baseRarityOf(stack.itemId),
        count: stack.count,
        equipped: equipment
          ? equipment.isEquipped(stack.itemId)
          : false,

        /**
         * O afixo, para o painel de encantar e para o inventario
         * mostrar a peca ja encantada
         *
         * Vai no `summary` e nao no `stack` cru porque o `summary` e
         * o que o painel consome, e e ele que e serializado no
         * snapshot de rede. O objeto vai como `null` quando a peca nao
         * tem afixo, e o painel trata os dois do mesmo jeito
         */
        enchant: stack.enchant ?? null,
      })),
    };
  }
}
