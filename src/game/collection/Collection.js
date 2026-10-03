import {
  RARITY_ORDER,
  ITEM_TYPE,
  getItem,
} from "../../data/items/index.js";
import {
  COLLECTIONS,
  COLLECTION_IDS,
  REQUIREMENT_TYPE,
  describeRequirement,
  getCollection,
} from "../../data/collection/index.js";
import { STAT_BY_ID } from "../stats/StatSheet.js";

/**
 * O motivo de uma entrega recusada.
 *
 * O mesmo formato do `CRAFT_RESULT`: um enum de motivo, e nao um
 * booleano. O painel precisa dizer QUAL coisa faltou, e "nao deu" sem
 * motivo obriga o jogador a contar os requisitos de cabeca
 */
export const DELIVER_RESULT = {
  OK: "ok",
  UNKNOWN: "unknown",
  DONE: "done",

  /** falta material ou equipamento */
  MISSING: "missing",
};

/**
 * As COLECOES do jogador.
 *
 * O estado e minusculo: quais colecoes foram entregues e o bonus de
 * stat que elas deram. Todo o resto e dado estatico de
 * `data/collection/index.js`
 *
 * A recompensa e SO STATS, e e PERMANENTE: uma colecao entregue nao
 * se repete, entao o bonus nao precisa de fila, de espaco na mochila
 * nem de resgate. Ele soma direto no pipeline do equipamento e do
 * bestiario e aparece na coluna `Bonus` do painel de status
 *
 * Antes a recompensa tinha item, e o `pending` existia para o item
 * que nao coubesse na mochila. Sem item nao ha o que nao couber, e a
 * fila sumiu junto com o aviso de "recompensa esperando espaco"
 *
 * A diferenca para o `QuestLog` continua sendo o verbo: a missao conta
 * o que o jogador FEZ e o sistema tira o item sozinho, a colecao conta
 * o que o jogador TEM e o jogador precisa apertar o botao
 */
export class Collection {
  constructor() {
    this.done = new Set();

    /**
     * O bonus de stat acumulado, entrega por entrega.
     *
     * Fica guardado e nao e relido do catalogo no painel porque o
     * catalogo diz o que a colecao DARIA e isto e o que ela DEU. Sao a
     * mesma coisa enquanto nada muda, e sao coisas diferentes no dia em
     * que uma colecao for rebalanceada: quem entregou a versao antiga
     * continua com o bonus antigo, e nao perde o que ganhou
     */
    this.bonus = {};
  }

  /**
   * O bonus permanente que as colecoes ja deram.
   *
   * E o MESMO formato que o `Equipment.bonuses` e o
   * `Bestiary.bonuses` devolvem, e e o que o `applyEquipment` soma
   * junto com eles. Um bonus que nao passasse por aqui entraria no
   * personagem por um caminho so dele, e o painel de status nao
   * mostraria de onde veio
   */
  bonuses() {
    return { ...this.bonus };
  }

  /** quantas colecoes foram entregues */
  get completedCount() {
    return this.done.size;
  }

  /** quantas colecoes existem */
  get total() {
    return COLLECTIONS.length;
  }

  get isComplete() {
    return this.done.size >= COLLECTIONS.length;
  }

  isDone(collectionId) {
    return this.done.has(collectionId);
  }

  /** o que falta de um requisito, contando a mochila e o equipado */
  haveOf(requirement, inventory, equipment) {
    if (requirement.type === REQUIREMENT_TYPE.EQUIPMENT) {
      return countEquipmentAt(
        inventory,
        equipment,
        requirement.rarity,
      );
    }

    return inventory.countAt(requirement.itemId);
  }

  /**
   * O que falta de uma colecao: `null` quando esta inteira.
   *
   * Devolve uma LISTA de faltantes, e nao um total, porque e ela que o
   * painel mostra: "faltam 2 de Gelo de Limo" e informacao que o
   * jogador usa, e "faltam 5 coisas" nao e
   */
  missingOf(collection, inventory, equipment) {
    const faltam = [];

    /**
     * O que cada requisito JA RESERVOU do mesmo item.
     *
     * Dois requisitos do mesmo item sao checados contra o MESMO
     * estoque, e nao contra copias dele: "3 de gel de limo" e "3 de
     * gelo de limo" precisam de 6 na mochila, nao de 3. Conferir cada
     * um contra o `countAt` completo faria 5 unidades satisfazerem dois
     * requisitos de 3, e o jogador entregaria 3 de uma vez e
     * receberia as duas recompensas
     *
     * O mapa e por ID e nao por indice porque e o ID que identifica a
     * unidade: dois requisitos de itens diferentes nao competem pelo
     * mesmo estoque
     */
    const reservado = new Map();

    for (const requirement of collection.requirements) {
      const chave = reservaDe(requirement);

      const bruto = this.haveOf(
        requirement,
        inventory,
        equipment,
      );

      const have = bruto - (reservado.get(chave) ?? 0);

      if (have < requirement.count) {
        faltam.push({
          type: requirement.type,
          itemId: requirement.itemId ?? null,
          rarity: requirement.rarity ?? null,
          need: requirement.count,
          have: Math.max(0, have),
          falta: requirement.count - Math.max(0, have),
          label: describeRequirement(requirement),
        });
      }

      reservado.set(
        chave,
        (reservado.get(chave) ?? 0) + requirement.count,
      );
    }

    return faltam.length > 0 ? faltam : null;
  }

  /** a colecao esta pronta para entrega? */
  canDeliver(collectionId, inventory, equipment) {
    const collection = getCollection(collectionId);

    if (!collection) return false;
    if (this.isDone(collectionId)) return false;

    return (
      this.missingOf(collection, inventory, equipment) === null
    );
  }

  /**
   * Entrega uma colecao.
   *
   * A checagem vem INTEIRA antes de qualquer remocao, pelo mesmo motivo
   * do craft: uma entrega pela metade e o pior resultado possivel
   * aqui, porque o jogador perderia material sem receber nada
   */
  deliver(collectionId, inventory, equipment) {
    const collection = getCollection(collectionId);

    if (!collection) {
      return { ok: false, reason: DELIVER_RESULT.UNKNOWN };
    }

    if (this.isDone(collectionId)) {
      return { ok: false, reason: DELIVER_RESULT.DONE };
    }

    const faltam = this.missingOf(
      collection,
      inventory,
      equipment,
    );

    if (faltam) {
      return {
        ok: false,
        reason: DELIVER_RESULT.MISSING,
        collection,
        faltam,
      };
    }

    /**
     * O MATERIAL sai ANTES do bonus entrar.
     *
     * A ordem e o inverso do que o `pending` fazia: antes, o jogador
     * perdia o material e a recompensa podia ficar esperando espaco na
     * mochila. Como a recompensa agora e um numero que nao ocupa
     * lugar nenhum, nao existe mais o caso de perder algo — mas a
     * ordem continua sendo consumo primeiro, porque e o que garante
     * que um `throw` no meio nao deixe o bonusapplied sem o material
     * ter saído
     */
    for (const requirement of collection.requirements) {
      this.consume(requirement, inventory, equipment);
    }

    this.done.add(collectionId);

    const reward = this.grantBonus(collection);

    return { ok: true, collection, reward };
  }

  /**
   * Soma a recompensa de uma colecao no bonus permanente.
   *
   * Devolve o DELTA — o que ESTA entrega deu — e nao o acumulado. O
   * aviso da entrega usa o valor devolvido para dizer "voce ganhou X",
   * e devolver o acumulado faria a segunda entrega anunciar tambem os
   * bonus da primeira. O jogador leria "+12 VIT" ao entregar o
   * primeiro resto, e "+12 VIT" de novo a cada entrega seguinte, e
   * acharia que o bonus nao estava subindo
   */
  grantBonus(collection) {
    const delta = {};

    for (const [stat, valor] of Object.entries(
      collection.rewards ?? {},
    )) {
      const numero = Number(valor);

      if (!Number.isFinite(numero) || numero === 0) continue;

      /**
       * A chave e SOMADA e nao substituida: duas colecoes diferentes
       * que derem `vit` somam, e uma `vit: 0` no meio nao apaga o
       * que as outras deram
       */
      this.bonus[stat] = (this.bonus[stat] ?? 0) + numero;
      delta[stat] = numero;
    }

    return delta;
  }

  /**
   * Tira o requisito da mochila.
   *
   * Equipamento sai da mochila E de um slot, e nao so de um: peca
   * equipada nao esta no inventario, e sem o `unequip` o jogador
   * teria que tirar a mao do equipamento para completa a colecao
   */
  consume(requirement, inventory, equipment) {
    if (requirement.type === REQUIREMENT_TYPE.EQUIPMENT) {
      return this.consumeEquipment(
        requirement,
        inventory,
        equipment,
      );
    }

    return inventory.remove(
      requirement.itemId,
      requirement.count,
    );
  }

  consumeEquipment(requirement, inventory, equipment) {
    let restante = requirement.count;

    /**
     * A mochila primeiro.
     *
     * Equipamento nao empilha (`maxStack: 1`), entao cada peca de
     * equipamento tem a sua propria pilha e o `takeUid` de uma unidade
     * remove a pilha inteira. A lista e percorrida por indice porque
     * `takeUid` REMOVE a pilha da lista e um `for...of` andando sobre
     * o mesmo array pularia a peca seguinte
     */
    for (let i = 0; i < inventory.stacks.length; i += 1) {
      if (restante <= 0) break;

      const stack = inventory.stacks[i];

      if (stack.rarity !== requirement.rarity) continue;

      if (!ehEquipamento(stack.itemId)) continue;

      const retirado = inventory.takeUid(stack.uid, 1);

      if (!retirado) continue;

      restante -= 1;
    }

    /**
     * E o que esta vestido.
     *
     * `unequip` esvazia o slot e DEVOLVE a peca; nao devolve para a
     * mochila, isso e do `GameEngine.unequipItem`. Aqui o item e
     * justamente para ser entregue, entao ele sai do slot e nao volta
     * para a mochila — que e o que faz a entrega consumir mesmo a
     * peca que estava no corpo do jogador
     */
    for (const entry of equipment.getEquippedItems()) {
      if (restante <= 0) break;
      if (entry.rarity !== requirement.rarity) continue;

      // `getEquipped` devolve o item ESPALHADO, entao o campo e `id`
      // e nao `itemId`. Usar `itemId` aqui daria `undefined`, o
      // `slotForItem(undefined)` devolveria `null` e a peca vestida
      // nunca sairia do corpo — o requisito contaria ela e a entrega
      // nao a consumiria
      const slotId = equipment.slotForItem(entry.id);

      if (!slotId) continue;

      equipment.unequip(slotId);

      restante -= 1;
    }

    return restante === 0;
  }


  snapshot(inventory, equipment) {
    const entradas = COLLECTIONS.map((collection) => {
      const done = this.isDone(collection.id);
      const faltam = done
        ? null
        : this.missingOf(collection, inventory, equipment);

      return {
        ...collection,
        done,
        pronta: !done && faltam === null,

        /**
         * A lista de requisitos JA NORMALIZADA, com `have` e `falta`
         * preenchidos — a mesma nas colecoes prontas e nas entregues.
         *
         * Sem isto o painel receberia, na mesma posicao, o `faltam`
         * (com `have` e `falta`) e o `requirements` cru (so com
         * `count`), e ele leria `need.need` — `undefined` — numa
         * colecao ja entregue. A linha mostraria "undefined/undefined"
         * bem no instante em que o jogador entregou, que e quando ele
         * mais olha
         */
        needs: this.needsOf(
          collection,
          inventory,
          equipment,
        ),
        faltam,
      };
    });

    return {
      entries: entradas,
      completed: this.completedCount,
      total: this.total,
      isComplete: this.isComplete,

      /**
       * O bonus JA DADO, em separado do bonus de cada cartao.
       *
       * O cartao mostra o que a colecao DARIA; este campo mostra o que
       * o jogador tem. Sao iguais enquanto ele nao entregou nada, e
       * quando o total some do valor de uma colecao — se ele for
       * rebalanceado, `done` continua marcando as entregues
       */
      bonuses: this.bonuses(),
    };
  }

  /**
   * Os requisitos com a contagem do jogador, pronta ou nao.
   *
   * Os TRES estados nao podem devolver a mesma coisa:
   *
   * - entregue: `have` zero e `falta` o total. O jogador entregou, e o
   *   que ele tem agora nao interessa mais
   * - pronta: `missingOf` devolve `null` porque nao falta nada, e um
   *   `null` aqui derrubaria o painel em `needs.map` no exato instante
   *   em que o jogador pode apertar o botao
   * - incompleta: a lista do que falta
   */
  needsOf(collection, inventory, equipment) {
    const bruto = (requirement, have, falta) => ({
      type: requirement.type,
      itemId: requirement.itemId ?? null,
      rarity: requirement.rarity ?? null,
      need: requirement.count,
      have,
      falta,
      label: describeRequirement(requirement),
    });

    if (this.isDone(collection.id)) {
      return collection.requirements.map((requirement) =>
        bruto(requirement, 0, requirement.count),
      );
    }

    const faltam = this.missingOf(
      collection,
      inventory,
      equipment,
    );

    if (faltam) return faltam;

    return collection.requirements.map((requirement) =>
      bruto(requirement, requirement.count, 0),
    );
  }

  /**
   * O estado que vai para o save.
   *
   * O `pending` foi embora com a recompensa em item: ele so existia
   * para guardar o item que nao coubesse na mochila. Quem tem um save
   * antigo com esse campo le o arquivo sem erro — o `fromSave` ignora
   * o que nao reconhece — e o bonus das colecoes ja entregues e
   * RE-SOMADO a partir do `done`, entao ninguem perde o que ganhou
   *
   * O `bonus` e gravado em vez de rederivado por dois motivos: um
   * save antigo nao tem o campo, e o bonus nao e reproduzivel a
   * partir do `done` no dia em que uma colecao for rebalanceada
   */
  toSave() {
    return {
      done: [...this.done],
      bonus: { ...this.bonus },
    };
  }

  fromSave(data) {
    if (!data || typeof data !== "object") return;

    this.done = new Set(
      (Array.isArray(data.done) ? data.done : []).filter(
        (id) => COLLECTION_IDS.includes(id),
      ),
    );

    /**
     * O bonus volta do arquivo, ou e RECONSTRUIDO do `done`.
     *
     * O campo `bonus` e novo: um save gravado antes da recompensa
     * virar stat tem `done` cheio e nenhum bonus. Sem esta reconstrucao
     * quem entregou as seis colecoes perderia o bonus permanente
     * inteiro so por ter jogado antes da mudanca — que e o pior
     * resultado possivel de uma migracao
     *
     * E as duas defesas que importam: a chave tem de ser um stat do
     * jogo, e o valor tem de ser numero. Um `bonus` forjado no arquivo
     * colocaria VIT 9999 no personagem de quem sabe editar o save
     */
    const salvo = objeto(data.bonus);

    const bonus = {};

    for (const [stat, valor] of Object.entries(salvo)) {
      if (!STAT_BY_ID[stat]) continue;

      const numero = Number(valor);

      if (!Number.isFinite(numero) || numero <= 0) continue;

      bonus[stat] = numero;
    }

    if (Object.keys(bonus).length > 0) {
      this.bonus = bonus;
      return;
    }

    for (const id of this.done) {
      const collection = getCollection(id);

      if (!collection) continue;

      for (const [stat, valor] of Object.entries(
        collection.rewards ?? {},
      )) {
        if (!STAT_BY_ID[stat]) continue;

        const numero = Number(valor);

        if (!Number.isFinite(numero) || numero <= 0) continue;

        bonus[stat] = (bonus[stat] ?? 0) + numero;
      }
    }

    this.bonus = bonus;
  }
}

const objeto = (valor) =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? valor
    : {};

/**
 * A chave que agrupa dois requisitos que disputam o mesmo estoque.
 *
 * E sempre o POOL de onde a unidade sai, e os dois tipos tem pool:
 *
 * - material: o `itemId`. "3 de gelo" e "3 de gelo" precisam de 6 na
 *   mochila
 * - equipamento: a `rarity`. Equipamento nao empilha, entao o pool de
 *   "1 epico" e "1 epico" e o conjunto de pecas epicas que existe, e
 *   duas unidades pedidas sao duas pecas DISTINTAS. Sao as mesmas
 *   pecas, entao tambem disputam: um epico na mochila nao pode
 *   satisfacer dois requisitos de 1 epico
 */
function reservaDe(requirement) {
  if (requirement.type === REQUIREMENT_TYPE.EQUIPMENT) {
    return `equip:${requirement.rarity}`;
  }

  return `mat:${requirement.itemId}`;
}

/**
 * O item e alguma coisa que se veste, e nao material?
 *
 * "Material" e o unico tipo que empilha, entao e o unico que o
 * requisito por RARIDADE nunca pode aceitar: um "epico" de material
 * contaria com a raridade e nao como peca de equipamento
 */
export function ehEquipamento(itemId) {
  const item = getItem(itemId);

  return Boolean(item) && item.type !== ITEM_TYPE.MATERIAL;
}

/**
 * Quantos equipamentos de EXATAMENTE uma raridade existem.
 *
 * Conta a mochila e o que esta vestido, porque o jogador nao deve
 * ver o requisito como faltando enquanto a peca esta no corpo dele
 *
 * "Exatamente" e o que a decisao do jogador pediu: a entrega consome
 * o item, e consumir um lendario para cumprir um pedido de raro seria
 * o pior resultado possivel do painel
 */
export function countEquipmentAt(
  inventory,
  equipment,
  rarity,
) {
  if (!RARITY_ORDER.includes(rarity)) return 0;

  let total = 0;

  for (const stack of inventory.stacks) {
    if (stack.rarity !== rarity) continue;
    if (!ehEquipamento(stack.itemId)) continue;

    total += 1;
  }

  const equipados = equipment.getEquippedItems?.() ?? [];

  for (const entry of equipados) {
    if (entry.rarity !== rarity) continue;

    total += 1;
  }

  return total;
}