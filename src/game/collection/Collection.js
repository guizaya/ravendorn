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
     * QUAIS EXIGENCIAS JA FORAM PAGAS, por colecao.
     *
     * ## POR QUE ISTO EXISTE AO LADO DO `done`
     *
     * Porque `done` responde "a colecao inteira foi entregue", e a entrega
     * e POR PARCELA: o jogador entrega a primeira e so recebe o bonus
     * dela. Com o modelo antigo — tudo ou nada — o primeiro bonus so
     * aparecia depois do segundo item, e o cartao mostrava "Falta
     * material" sobre material que ele ja tinha na mao
     */
    this.entregues = new Map();

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

  /**
 * OS INDICES DAS EXIGENCIAS JA PAGAS de uma colecao.
 *
 * ## POR QUE UM CONJUNTO POR COLECAO
 *
 * Porque os indices so querem dizer alguma coisa dentro da colecao a que
 * pertencem. Um `Set` global guardando `0` e `1` seria ambiguo: a mesma
 * posicao na colecao seguinte seria lida como a primeira
 */
entreguesDe(collectionId) {
    return this.entregues.get(collectionId) ?? new Set();
  }

  /** esta exigencia especifica ja foi paga? */
  isEntregue(collectionId, indice) {
    return this.entreguesDe(collectionId).has(indice);
  }

  /** quantas exigencias desta colecao ainda dao para entregar */
  pendingOf(collectionId) {
    const collection = getCollection(collectionId);

    if (!collection) return 0;

    return (
      collection.requirements.length - this.entreguesDe(collectionId).size
    );
  }

  /**
   * A COLECAO INTEIRA foi entregue?
   *
   * E so quando NAO sobra nenhuma exigencia. Uma colecao com a primeira
   * parcela paga e a segunda faltando nao esta pronta: e um card em
   * andamento
   */
  isDone(collectionId) {
    return this.pendingOf(collectionId) === 0;
  }

  /** o que falta de um requisito, contando a mochila e o equipado */
  haveOf(requirement, inventory, equipment) {
    if (requirement.type === REQUIREMENT_TYPE.EQUIPMENT) {
      /**
       * A PECA E CONTADA PELO ID, E NAO PELA RARIDADE.
       *
       * A entrega e de uma peca especifica, e a raridade nao a identifica:
       * a aljava e `uncommon`, e a regra por raridade aceitaria qualquer
       * `uncommon` do inventario — o jogador entregaria um colete e
       * receberia o bonus do arco
       *
       * E o `enhance` e o MINIMO: um +8 satisfaz um "+5 ou mais", e um +3
       * nao. E o que faz sentido para uma entrega que paga mais por uma
       * peca mais trabalhada
       */
      if (requirement.itemId) {
        return countEquipmentById(
          inventory,
          equipment,
          requirement.itemId,
          requirement.enhance ?? 0,
          requirement.enhanceExato === true,
        );
      }

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
    const reservados = new Map();
    const pagas = this.entreguesDe(collection.id);

    for (const [indice, requirement] of collection.requirements.entries()) {
      /**
       * A EXIGENCIA JA PAGA NAO CONTA COMO FALTANDO.
       *
       * O material dela ja saiu da mochila na entrega passada, entao
       * conferir de novo faria a colecao inteira parecer incompleta — e o
       * `deliver` recusaria a segunda parcela com "falta material" num
       * card que o jogador ja pagou pela metade
       */
      if (pagas.has(indice)) continue;

      const chave = reservaDe(requirement);

      const bruto = this.haveOf(
        requirement,
        inventory,
        equipment,
      );

      const have = bruto - (reservados.get(chave) ?? 0);

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

      reservados.set(
        chave,
        (reservados.get(chave) ?? 0) + requirement.count,
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
   * UMA EXIGENCIA esta pronta para entrega?
   *
   * E a exigencia SOZINHA que e conferida, e nao a colecao: cada parcela
   * paga o seu bonus assim que o material dela chega, e o jogador nao
   * precisa fechar a colecao para receber a primeira parte
   */
  canDeliverRequirement(collectionId, indice, inventory, equipment) {
    const collection = getCollection(collectionId);
    const requirement = collection?.requirements?.[indice];

    if (!requirement) return false;
    if (this.isEntregue(collectionId, indice)) return false;

    return (
      this.haveOf(requirement, inventory, equipment) >=
      requirement.count
    );
  }

  /**
   * Entrega UMA exigencia da colecao.
   *
   * ## POR QUE O `indice` EXISTE
   *
   * Porque a entrega e por parcela. Sem indice, o `deliver` ainda entrega
   * a colecao inteira — e e o que uma colecao sem bonus por parcela usa
   *
   * ## A CHEGADA INTEIRA antes de qualquer remocao, e SO DESTE REQUISITO
   *
   * E a mesma razao pela qual a entrega antiga conferia tudo antes de mexer
   * em qualquer coisa: entregar pela metade e o pior resultado possivel
   * aqui, porque o jogador perderia material sem receber nada
   */
  deliver(collectionId, indice, inventory, equipment) {
    const collection = getCollection(collectionId);

    if (!collection) {
      return { ok: false, reason: DELIVER_RESULT.UNKNOWN };
    }

    /* sem indice, a entrega e a colecao inteira */
    const alvo = indice ?? null;

    const requirement =
      alvo === null ? null : (collection.requirements?.[alvo] ?? null);

    if (alvo !== null && !requirement) {
      return { ok: false, reason: DELIVER_RESULT.UNKNOWN };
    }

    if (this.isDone(collectionId)) {
      return { ok: false, reason: DELIVER_RESULT.DONE };
    }

    if (requirement && this.isEntregue(collectionId, alvo)) {
      return { ok: false, reason: DELIVER_RESULT.DONE };
    }

    /**
     * A FALTA DESTA PARCELA.
     *
     * A exigencia e conferida contra o estoque do dia, e nao contra a
     * reserva das outras: as parcelas sao entregues em momentos diferentes,
     * entao cada uma encontra a mochila como ela esta no seu momento
     */
    const tem = requirement
      ? this.haveOf(requirement, inventory, equipment)
      : 0;

    if (requirement && tem < requirement.count) {
      return {
        ok: false,
        reason: DELIVER_RESULT.MISSING,
        collection,
        faltam: [
          {
            type: requirement.type,
            itemId: requirement.itemId ?? null,
            rarity: requirement.rarity ?? null,
            need: requirement.count,
            have: tem,
            falta: requirement.count - tem,
            label: describeRequirement(requirement),
          },
        ],
      };
    }

    /* sem indice, a colecao INTEIRA tem de estar pronta */
    if (requirement === null) {
      const faltam = this.missingOf(collection, inventory, equipment);

      if (faltam) {
        return {
          ok: false,
          reason: DELIVER_RESULT.MISSING,
          collection,
          faltam,
        };
      }
    }

    /**
     * O MATERIAL sai ANTES do bonus entrar.
     *
     * A ordem e o inverso do que o `pending` fazia: antes, o jogador
     * perdia o material e a recompensa podia ficar esperando espaco na
     * mochila. Como a recompensa agora e um numero que nao ocupa
     * lugar nenhum, nao existe mais o caso de perder algo — mas a
     * ordem continua sendo consumo primeiro, porque e o que garante
     * que um `throw` no meio nao deixe o bonus aplicado sem o material
     * ter saido
     */
    const paraEntregar =
      requirement === null ? collection.requirements : [requirement];

    for (const item of paraEntregar) {
      this.consume(item, inventory, equipment);
    }

    if (requirement === null) {
      this.done.add(collectionId);
    } else {
      const lista = this.entreguesDe(collectionId);

      lista.add(alvo);

      this.entregues.set(collectionId, lista);

      if (this.pendingOf(collectionId) === 0) {
        this.done.add(collectionId);
      }
    }

    /**
     * O BONUS E DO QUE FOI ENTREGUE AGORA.
     *
     * Com parcela, e o DA EXIGENCIA. Sem parcela, e o da colecao inteira —
     * o caminho antigo, que continua valendo para uma colecao sem bonus
     * por parcela
     */
    const reward =
      requirement === null
        ? this.grantBonus(collection)
        : this.grantBonusDe(requirement);

    return {
      ok: true,
      collection,
      reward,
      indice: alvo,

      /**
       * O NOME DO ITEM ENTREGUE, para o aviso.
       *
       * Sem ele o motor so teria o nome da colecao, e o aviso diria
       * "Colecao entregue" quando so uma das parcelas tinha saido
       */
      itemLabel: requirement
        ? describeRequirement(requirement)
        : null,
    };
  }

  /**
   * Soma o bonus de UMA exigencia no bonus permanente.
   *
   * ## POR QUE O BONUS DA COLECAO NAO ENTRA AQUI
   *
   * Porque ele seria dado duas vezes: uma na primeira parcela e outra na
   * segunda. O bonus da colecao e o QUE SOBRA depois das parcelas, e e
   * concedido pela entrega inteira, no `deliver` sem indice
   */
  grantBonusDe(requirement) {
    const delta = {};

    for (const [stat, valor] of Object.entries(
      requirement?.rewards ?? {},
    )) {
      const numero = Number(valor);

      if (!Number.isFinite(numero) || numero === 0) continue;

      this.bonus[stat] = (this.bonus[stat] ?? 0) + numero;
      delta[stat] = numero;
    }

    return delta;
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
     * A REGRA QUE UMA PILHA PRECISA CUMPRIR.
     *
     * E a MESMA do `countEquipmentOfKind` e do `countEquipmentAt`, e o
     * motivo dela ser uma funcao e nao duas linhas repetidas e o
     * resultado: se a contagem e o consumo usassem criterios diferentes, o
     * `deliver` diria que havia arco e nao tiraria nenhum. O pior caso
     * seria o inverso — tirar o arco errado de um requisito de +5
     *
     * Com `kind`, o criterio e o tipo mais o aprimoramento MINIMO; sem ele,
     * e a raridade exata
     */
    const serve = (itemId, rarity, enhance) => {
      if (requirement.itemId) {
        if (itemId !== requirement.itemId) return false;

        /**
         * O APRIMORAMENTO, DO MESMO JEITO QUE A CONTAGEM DECIDE.
         *
         * E o `enhanceExato` que vem junto, e ele tem de ser lido aqui
         * tambem: a contagem e o consumo sao os dois lugares que decidem se a
         * peca serve, e se so este respeitasse o valor exato, o `deliver`
         * tiraria a aljava errada ao entregar a colecao da peca simples
         */
        const valor = enhance ?? 0;
        const pedido = requirement.enhance ?? 0;

        return requirement.enhanceExato === true
          ? valor === pedido
          : valor >= pedido;
      }

      if (!ehEquipamento(itemId)) return false;

      return rarity === requirement.rarity;
    };

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

      if (!serve(stack.itemId, stack.rarity, stack.enhance)) continue;

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

      /**
       * O MESMO CRITERIO da mochila, com o aprimoramento do SLOT.
       *
       * `getEquipped` devolve o item espalhado, entao o campo e `id` e nao
       * `itemId`, e o aprimoramento mora no slot — nao ha `stack` aqui
       */
      if (!serve(entry.id, entry.rarity, entry.enhance)) continue;

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

      const needs = this.needsOf(collection, inventory, equipment);

      /**
       * `pronta` e ALGUMA PARCELA com material, e nao a colecao inteira.
       *
       * A entrega e por parcela, entao o card fica "pronto" no instante em
       * que o jogador pode pagar a primeira — e o que o `missingOf` diria
       * aqui e "so quando as duas fecharem", que e o instante em que nao ha
       * mais nada para entregar
       *
       * Sem esta mudanca, o icone da parcela 1 continuaria cinza com 20 de
       * osso na mochila, e o jogador teria que descobrir sozinho que o
       * clique ali entrega so aquele item
       */
      const algumaPronta = needs.some(
        (need) => !need.entregue && need.falta === 0,
      );

      return {
        ...collection,
        done,
        pronta: !done && algumaPronta,

        /**
         * A lista de parcelas JA NORMALIZADA, com `have`, `falta`,
         * `entregue` e `rewards` preenchidos — a mesma nas colecoas
         * prontas e nas entregues.
         *
         * Sem isto o painel receberia, na mesma posicao, o `faltam` (com
         * `have` e `falta`) e o `requirements` cru (so com `count`), e ele
         * leria `need.need` — `undefined` — numa parcela ja entregue. A
         * linha mostraria "undefined/undefined" bem no instante em que o
         * jogador entregou, que e quando ele mais olha
         */
        needs,
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
   * ## POR QUE CADA LINHA TEM `indice`, `entregue` E `rewards`
   *
   * Porque a entrega e POR PARCELA. O painel precisa do indice para mandar
   * "entrega o item 1", precisa saber se a linha ja foi paga para riscar
   * o icone em vez de mostrar "0/20", e precisa do bonus DA LINHA para o
   * jogador ver o que aquele item sozinho paga
   *
   * Sem o `rewards` na linha, o card so mostraria o total — e o jogador
   * veria "Vai receber +2 VIT" sem saber que a primeira parcela ja pagou
   * metade disso
   *
   * ## A RESERVA ENTRE EXIGENCIAS DO MESMO ITEM
   *
   * A reserva soma o quanto a exigencia anterior REALMENTE consumiu, e o
   * `have` e limitado ao `count` dela. Com 45 de osso e exigencias 20 e
   * 40, a conta da 45: a primeira consome 20, sobram 25, a segunda usa 25.
   * Uma reserva que somasse `count` daria 45/20 e 25/40 — 70 de 60
   *
   * A exigencia JA PAGA nao consome nada: o material dela ja saiu da
   * mochila, e a linha continua na lista para o jogador ver o que entregou
   */
  needsOf(collection, inventory, equipment) {
    const pagas = this.entreguesDe(collection.id);

    const consumido = new Map();

    return collection.requirements.map((requirement, indice) => {
      const chave = reservaDe(requirement);

      const bruto = this.haveOf(
        requirement,
        inventory,
        equipment,
      );

      const jaConsumido = consumido.get(chave) ?? 0;

      const sobra = Math.max(0, bruto - jaConsumido);

      const entregue = pagas.has(indice);

      /* o quanto DESTA exigencia esta pago, sem passar do que ela pede */
      const tem = entregue
        ? 0
        : Math.min(sobra, requirement.count);

      consumido.set(chave, jaConsumido + tem);

      return {
        indice,
        type: requirement.type,
        itemId: requirement.itemId ?? null,
        rarity: requirement.rarity ?? null,
        need: requirement.count,
        have: tem,
        falta: entregue ? requirement.count : requirement.count - tem,
        label: describeRequirement(requirement),

        /**
         * O APRIMORAMENTO MINIMO, para o card mostrar um badge.
         *
         * O card precisa saber o numero e nao so o texto: "Aljava de
         * Arqueiro +5" numa linha de 11px e curto para o jogador ver de
         * relance, e o badge existe para o numero ficar grande
         *
         * E `null` quando a peca nao tem exigencia de aprimoramento, e nao
         * zero: o zero e "qualquer aprimoramento", que e um requisito
         * diferente de "sem exigencia"
         */
        enhance:
          requirement.type === REQUIREMENT_TYPE.EQUIPMENT &&
          (requirement.enhance ?? 0) > 0
            ? requirement.enhance
            : null,

        /** esta parcela ja foi paga, e o bonus dela ja e do jogador */
        entregue,

        /** o bonus DESTE item, e nao o da colecao inteira */
        rewards: requirement.rewards ?? null,
      };
    });
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
    /**
     * AS PARCELAS JA PAGAS vao para o arquivo.
     *
     * Sem este campo o save perderia o meio caminho: o jogador entregaria
     * a primeira parcela, fecharia o jogo, e ao voltar encontraria o icone
     * como nao entregue — com o bonus ja SOMADO no personagem. Ele
     * receberia o mesmo material de novo
     */
    const entregues = {};

    for (const [id, lista] of this.entregues) {
      if (lista.size === 0) continue;

      entregues[id] = [...lista].sort((a, b) => a - b);
    }

    return {
      done: [...this.done],
      bonus: { ...this.bonus },
      entregues,
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
     * AS PARCELAS JA PAGAS de cada colecao.
     *
     * O campo e novo, entao um save antigo nao o tem — e um save antigo
     * tambem nao tinha entrega parcial para guardar
     *
     * O indice e validado contra o catalogo: um indice grande ou negativo
     * viraria `undefined` em `deliver`, e um `Set` com ele dentro faria
     * `pendingOf` contar uma exigencia que nao existe
     */
    this.entregues = new Map();

    for (const [id, lista] of Object.entries(
      objeto(data.entregues),
    )) {
      const collection = getCollection(id);

      if (!collection) continue;

      const total = collection.requirements.length;

      const indices = (Array.isArray(lista) ? lista : [])
        .map((valor) => Number(valor))
        .filter(
          (valor) =>
            Number.isInteger(valor) && valor >= 0 && valor < total,
        );

      if (indices.length === 0) continue;

      this.entregues.set(id, new Set(indices));
    }

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

    for (const [id, lista] of this.entregues) {
      const collection = getCollection(id);

      if (!collection) continue;

      collection.requirements.forEach((requirement, indice) => {
        if (!lista.has(indice)) return;

        for (const [stat, valor] of Object.entries(
          requirement.rewards ?? {},
        )) {
          if (!STAT_BY_ID[stat]) continue;

          const numero = Number(valor);

          if (!Number.isFinite(numero) || numero <= 0) continue;

          bonus[stat] = (bonus[stat] ?? 0) + numero;
        }
      });
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
/**
 * Conta as pecas de UM ITEM, com um aprimoramento MINIMO.
 *
 * E o que a entrega de peca especifica usa: so a aljava conta, e o `+5` e
 * o piso, nao o valor exato
 *
 * ## POR QUE O APRIMORAMENTO E `>=` E NAO `===`
 *
 * Porque o jogador que investiu +8 na peca nao deve perder a entrega por
 * ter reinvestido. Ele fez MAIS trabalho do que a entrega pedia, e a
 * recompensa dele nao pode ser menor por isso
 *
 * ## POR QUE A PILHA PRECISA DO APRIMORAMENTO
 *
 * Porque o aprimoramento mora na PILHA, e nao no item: sao duas pilhas da
 * mesma aljava, uma +0 e outra +7. Ler o aprimoramento do catalogo
 * devolveria sempre 0, e a entrega da peca aprimorada nunca fecharia
 */
export function countEquipmentById(
    inventory,
    equipment,
    itemId,
    enhanceMin = 0,
    exato = false,
  ) {
    let total = 0;

    /**
     * O CRITERIO DE APRIMORAMENTO, e ele e o MESMO do `consumeEquipment`.
     *
     * Sao dois lugares que decidem se uma peca serve, e eles precisam falar
     * a mesma lingua: `haveOf` diz que ha peca, e `consumeEquipment` tira a
     * peca. Se a contagem aceitasse e o consumo recusasse, o card ficaria
     * pronto para sempre sem entrega nenhuma
     *
     * `exato` inverte a comparacao: com ele, "+0" quer dizer LITERALMENTE
     * zero. E o que separa a colecao da aljava simples da colecao da aljava
     * aprimorada — sem isso as duas aceitavam a mesma peca
     */
    const serve = (valor) =>
      exato ? (valor ?? 0) === enhanceMin : (valor ?? 0) >= enhanceMin;

    for (const stack of inventory.stacks) {
      if (stack.itemId !== itemId) continue;

      if (!serve(stack.enhance)) continue;

      total += 1;
    }

  /**
   * O QUE ESTA VESTIDO.
   *
   * A peca equipada sai do corpo do jogador, e uma colecao que puxasse a
   * armadura das costas seria pior do que uma que obriga ele a tirar. E o
   * aprimoramento do slot vem do proprio slot — nao da mochila
   */
  const equipados = equipment.getEquippedItems?.() ?? [];

for (const entry of equipados) {
      if (entry.id !== itemId) continue;

      if (!serve(entry.enhance)) continue;

      total += 1;
    }

  return total;
}

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
