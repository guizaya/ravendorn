import {
  baseRarityOf,
  getItem,
  ITEM_TYPE,
  statsAt,
} from "../../data/items/index.js";
import {
  isEnchant,
  resolveEnchant,
} from "../../data/enchant/index.js";
import { pecaServeParaClasse } from "../rules/regrasDoItem.js";

/**
 * Os slots do personagem, na ordem em que o boneco desenha.
 *
 * O `id` e o que o save grava, entao `legs` continua `legs` mesmo
 * depois de virar "Calças" no texto: um arquivo antigo que tenha
 * `legs` continua restaurando no lugar certo. O NOME e o que o
 * jogador le
 *
 * `weapon2` e a arma secundaria. Ela aceita qualquer arma, do
 * mesmo jeito que a principal: a regra de familia por classe
 * continua sendo do item, e nao do slot. Se um dia existir uma arma
 * que so pode ir na mao esquerda, e um filtro de slot que precisa
 * nascer — hoje nenhum item do catalogo tem essa restricao
 *
 * ## POR QUE TODOS OS `icon` SAO DO MESMO TIPO
 *
 * Sao nove glifos de TEXTO, e nenhum emoji. A versao anterior misturava as
 * duas coisas: `🧤`, `👢` e `🗡` eram emoji, e o resto era caractere. O
 * navegador desenha um emoji na sua propria cor e no seu proprio tamanho,
 * ignorando o `color` e o `font-size` do slot — entao o boneco tinha uma
 * luva colorida e um escudo cinza lado a lado, ambos do mesmo tamanho de
 * caixa e com pesos visuais completamente diferentes. Isso e o que fez os
 * slots vazios parecerem quebrados, e nao a escolha dos simbolos
 *
 * O `grayscale` do `.inv-slot--empty` resolvia so metade do problema:
 * ele trava a COR, mas o emoji continua do tamanho que a fonte dele quiser,
 * e um emoji e sempre maior que um caractere de texto
 *
 * ## POR QUE DOIS SLOTS COMPARTILHAM O MESMO GLIFO
 *
 * `⚔` nas duas armas e `◈`/`❖` nos dois adornos. Sao pares de slots que
 * nao se distinguem pelo desenho: a principal e a secundaria sao as duas
 * "arma", e o anel e o amuleto sao as duas "joia". O que separa os dois e
 * o TEXTO — "Arma Secundária", "Amuleto" — e o texto ja estava la antes
 * desta troca. Um glifo inventado para cada um dos quatro seria quatro
 * desenhos novos que o jogador teria que aprender sem dizer nada
 *
 * ## POR QUE `⌖` NA CABECA E `⇱` NAS BOTAS
 *
 * Porque sao os dois glifos de texto que ja existiam no jogo e que o
 * jogador ja viu em outra tela: `⌖` e a mira que o jogo usa na HUD, e
 * `⇱` e a seta de descida do boneco. Reaproveitar o desenho que o jogador
 * ja conhece e melhor que inventar um terceiro parente do capacete de obra
 *
 * O `⛊` do peito e o mesmo glifo da guild na prateleira — eles nao
 * aparecem juntos, e um escudo so no jogo inteiro vale mais que um escudo
 * novo so no boneco
 */
export const EQUIPMENT_SLOTS = [
  {
    id: "weapon",
    name: "Arma",
    icon: "⚔",
    accepts: [ITEM_TYPE.WEAPON],
  },
  {
    id: "weapon2",
    name: "Arma Secundária",
    icon: "⚔",
    accepts: [ITEM_TYPE.WEAPON],
  },
  {
    id: "head",
    name: "Cabeça",

/**
     * A MIRA, que o jogador ja conhece da HUD.
     *
     * `⛑` e o capacete de obra, e nao o elmo medieval — e o triangulo dele
     * era o que mais destoava dos outros oito. Nao ha glifo de texto de
     * elmo no padrao Unicode que renda: `⛑` e obra, `⌂` e telhado, `⛏` e
     * picareta
     *
     * `⌖` resolve sem ensinar nada: e a mira que ja aparece na HUD quando
     * o jogador mira. O jogador ve o mesmo desenho em dois lugares e o
     * brain dele liga sozinho
     */
    icon: "⌖",
    accepts: [ITEM_TYPE.ARMOR],
  },
  {
    id: "gloves",
    name: "Luvas",
    icon: "✋",
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
    name: "Calças",
    icon: "⛉",
    accepts: [ITEM_TYPE.ARMOR],
  },
  {
    id: "boots",
    name: "Botas",
    icon: "⇱",
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

/**
   * O item tem pelo menos um slot onde pode entrar, E e da classe do jogador?
   *
   * ## O QUE MUDOU AQUI
   *
   * O `classId` e novo, e e a regra que o jogador vai sentir: o monstro
   * solta a armadura do guerreiro para qualquer um, mas so o guerreiro a
   * veste. As duas metades se encontram aqui — o drop e de todo mundo, o
   * equipamento e da sua classe
   *
   * ## POR QUE `classId` AUSENTE NAO BLOQUEIA
   *
   * Porque quem chama daqui e o painel, e o painel so tem a classe quando o
   * jogador esta logado. Sem `classId` a funcao volta ao comportamento de
   * antes em vez de trancar o inventario inteiro — e o `equip` do motor, que
   * valida com a sessao, continua sendo a ultima linha
   */
  export function isEquippable(item, classId = null) {
    if (!item) return false;

    if (!EQUIPABLE_TYPES.includes(item.type)) return false;

    /**
     * A PECA E DE OUTRA CLASSE: nao e equipavel.
     *
     * A lista de tipos vem ANTES desta porque um material sem `classes` nao
     * seria barrado por classe — seria barrado por tipo. A ordem mantem a
     * mensagem certa para cada caso
     */
    if (classId && !pecaServeParaClasse(item, classId)) {
      return false;
    }

    if (item.slot) {
      return EQUIPMENT_SLOTS.some((slot) => slot.id === item.slot);
    }

    return EQUIPMENT_SLOTS.some((slot) =>
      slot.accepts.includes(item.type),
    );
  }

/**
 * O nome do slot onde o item entra, para o painel dizer onde ele vai.
 *
 * Com a regra da posicao, "Equipar" deixa de ser um botao sem
 * destino: o jogador ve que o capuz vai para a cabeca, e nao para o
 * primeiro slot livre
 */
export function slotNameFor(item) {
  if (!item) return null;

  const slot =
    (item.slot &&
      EQUIPMENT_SLOTS.find((candidate) => candidate.id === item.slot)) ??
    EQUIPMENT_SLOTS.find((candidate) =>
      candidate.accepts.includes(item.type),
    );

  return slot?.name ?? null;
}

export class Equipment {
  constructor(slots = EQUIPMENT_SLOTS) {
    this.slots = slots.map((slot) => ({
      ...slot,
      itemId: null,
      rarity: null,
      tier: 0,
      enhance: 0,

      /**
       * O ENCANTAMENTO da peca vestida neste slot, ou `null`.
       *
       * O slot e o unico lugar onde o afixo de uma peca VESTIDA pode
       * existir, porque o motor tira a peca da mochila no `equip` e
       * devolve a anterior no `unequip`. Sem este campo, um arco
       * encantado perderia o afixo toda vez que o jogador trocasse de
       * lugar na mochila
       *
       * Diferente do `enhance`, que e um multiplicador de item e
       * RESETA ao trocar de peca: o afixo pertence a peca, e nao ao
       * slot. Por isso ele nao e zerado junto do `enhance` — ver
       * `equip`
       */
      enchant: null,
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

    const rarity =
      slot.rarity ?? baseRarityOf(slot.itemId);

    return {
      ...item,
      // os stats do slot sao os da raridade vestida, e nao os do
      // catalogo: um arco lendario precisa valer mais que o comum
      rarity,
      stats: statsAt(slot.itemId, rarity),
      slotId: slot.id,
      tier: slot.tier,
      enhance: slot.enhance,

      // o afixo vai junto para o painel mostrar a peca encantada no
      // boneco. Ele NAO entra em `stats`: e uma fracao do stat base do
      // personagem, e nao um valor fixo da peca, entao quem converte
      // para numero e `enchantBonuses`, com a base na mao
      enchant: slot.enchant ?? null,
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

  /**
   * O slot aceita ESTE item?
   *
   * Sao duas regras, e a segunda e a que faltava:
   *
   * 1. O TIPO precisa estar entre os que o slot aceita. E o que
   *    impede uma espada de ir na cabeca
   *
   * 2. Se o item declara uma POSICAO, ela precisa ser a do slot.
   *    `head`, `chest` e `legs` aceitam todos `ARMOR`, entao sem
   *    esta regra um capuz ia para o peito e uma bota para a
   *    cabeca. O slot escolhido virava o primeiro que coubesse, o
   *    que depende da ordem do boneco e nao do item
   *
   * Um item sem `slot` declarado para na segunda regra, e o tipo
   * decide: e o caso das armas, que todas vao no mesmo lugar, e dos
   * relatorios, que servem tanto de anel quanto de amuleto
   */
  slotAccepts(slotId, itemId) {
    const slot = this.getSlot(slotId);

    if (!slot) return false;

    const item = getItem(itemId);

    if (!item) return false;

    if (!slot.accepts.includes(item.type)) {
      return false;
    }

    if (item.slot && item.slot !== slot.id) {
      return false;
    }

    return true;
  }

  /**
   * O slot onde este item tem que entrar, ou `null`.
   *
   * Devolve o ID do slot, e nao o objeto: quem chama e o
   * `equipItem`, que ja recebe um id. E o auto-equip, que percorre os
   * slots e nao deveria receber de volta um deles
   */
  slotForItem(itemId) {
    const item = getItem(itemId);

    if (!item) return null;

    // o proprio item manda na posicao, quando declara
    if (item.slot) {
      return this.slots.find(
        (slot) => slot.id === item.slot,
      )?.id ?? null;
    }

    // sem posicao declarada, serve qualquer slot do mesmo tipo. o
    // primeiro VAGO e o melhor destino: em um slot ocupado o item
    // trocaria de lugar com o que ja estava vestido
    return (
      this.slots.find(
        (slot) => !slot.itemId && slot.accepts.includes(item.type),
      )?.id ??
      this.slots.find((slot) =>
        slot.accepts.includes(item.type),
      )?.id ??
      null
    );
  }

  canEquip(itemId, slotId) {
    return this.slotAccepts(slotId, itemId);
  }

  /**
   * Devolve a peca ao slot, sem conferir a posicao.
   *
   * E o par de `unequip`, e existe para desfazer um desequipar que
   * nao coube na mochila. `equip` nao pode ser usado nessa hora: ele
   * recusa pela MESMA regra que apontou a peca como errada, e o
   * item sumiria entre o slot vazio e a mochila cheia
   *
   * E a unica forma de por peca no slot errado, e por isso e metodo
   * de correcao, e nao de acao do jogador: o `equip`, que vem do
   * clique, continua passando pela checagem de posicao
   */
  restore({ itemId, rarity, enchant = null }, slotId) {
    const slot = this.getSlot(slotId);

    if (!slot) return false;

    slot.itemId = itemId;
    slot.rarity = rarity;
    slot.tier = getItem(itemId)?.tier ?? 1;
    slot.enhance = 0;
    slot.enchant = isEnchant(enchant) ? enchant : null;

    return true;
  }

  /**
   * O primeiro slot com peca na posicao ERRADA, ou `null`.
   *
   * E o inverso de `canEquip`: em vez de perguntar "esta peca cabe
   * aqui", pergunta "esta peca que esta aqui devia estar em outro
   * lugar"
   *
   * Existe porque um save antigo pode ter peca no slot errado. Antes
   * de a peca declarar posicao, `head`, `chest` e `legs` aceitavam
   * qualquer `ARMOR`, e o jogo gravava o que o jogador vestiu. Ler
   * esse save hoje mostra um capuz no peito, e o `equip` jamais
   * corrigiria sozinho: ele so roda quando o jogador veste algo
   */
  misplacedSlot() {
    for (const slot of this.slots) {
      if (!slot.itemId) continue;

      if (!this.slotAccepts(slot.id, slot.itemId)) {
        return slot.id;
      }
    }

    return null;
  }

  /**
   * Todos os slots com peca na posicao errada, de uma vez.
   *
   * A correcao e por jogador e nao por peca: um save pode ter a
   * cabeca com um gibao e o peito com um capuz, e corrigir um de
   * cada vez deixaria o jogador no meio do arranjo
   */
  misplacedSlots() {
    return this.slots
      .filter(
        (slot) =>
          slot.itemId && !this.slotAccepts(slot.id, slot.itemId),
      )
      .map((slot) => slot.id);
  }

/**
   * Equipa o item naquela raridade.
   *
   * Devolve `false` se recusou, `null` se o slot estava vazio e
   * `{ itemId, rarity, enchant, enhance }` se trocou. A variante, o AFIXO
   * e o APRIMORAMENTO voltam juntos para que a peca anterior volte para
   * a mochila inteira: perder o encantamento so por trocar de lugar seria
   * o defeito mais irritante que a feature inteira tem
   */
equip(itemId, slotId, rarity = null, enchant = null, enhance = 0) {
    if (!this.canEquip(itemId, slotId)) {
      return false;
    }

    const slot = this.getSlot(slotId);
    const target = rarity ?? baseRarityOf(itemId);

    if (
      slot.itemId === itemId &&
      (slot.rarity ?? baseRarityOf(itemId)) === target
    ) {
      return false;
    }

    const previous = slot.itemId
      ? {
          itemId: slot.itemId,
          rarity:
            slot.rarity ?? baseRarityOf(slot.itemId),
          enchant: slot.enchant ?? null,

          /**
           * O APRIMORAMENTO volta com a peca que sai.
           *
           * E o mesmo motivo do afixo acima, e o motivo pelo qual o
           * `enhance` nao pode continuar sendo um numero do SLOT. Com ele
           * morando aqui, trocar de lugar nao custava nada ao jogador:
           * ele pagava por tres niveis, trocava de braco e os tres sumiam
           */
          enhance: slot.enhance ?? 0,
        }
      : null;

    slot.itemId = itemId;
    slot.rarity = target;
    slot.tier = getItem(itemId)?.tier ?? 1;

    /**
     * O APRIMORAMENTO ENTRA JUNTO COM A PECA.
     *
     * Antes esta linha era `slot.enhance = 0`, e o comentario dizia que
     * o numero "nao significa nada numa peca nua". Isso era verdade
     * enquanto o numero vivia so aqui — e foi exatamente o que fez o
     * aprimoramento evaporar a cada troca de lugar
     */
    slot.enhance = Math.max(0, Number(enhance) || 0);

    /**
     * O AFIXO E O APRIMORAMENTO sao coisas diferentes, e por isso o
     * comentario antigo falava em "nao podem ser tratados igual": o afixo
     * e um afixo sorteado e o aprimoramento e uma contagem de niveis
     * pagos. Os dois viajam com a peca, cada um no seu campo
     */
    slot.enchant = isEnchant(enchant) ? enchant : null;

    return previous;
  }

  /** tira a peca e devolve a variante, para ela voltar inteira */
  unequip(slotId) {
    const slot = this.getSlot(slotId);

    if (!slot?.itemId) return null;

    const previous = {
      itemId: slot.itemId,
      rarity: slot.rarity ?? baseRarityOf(slot.itemId),
      enchant: slot.enchant ?? null,

      /**
       * O APRIMORAMENTO SAI JUNTO, para a mochila gravar nele.
       *
       * Sem esta linha o `unequip` zerava o numero e o jogador perdia o
       * que pagou no instante em que tirava a armadura das costas — que e
       * a forma mais facil de ele descobrir que a feature esta errada
       */
      enhance: slot.enhance ?? 0,
    };

    slot.itemId = null;
    slot.rarity = null;
    slot.tier = 0;
    slot.enhance = 0;

    /**
     * O afixo e APAGADO do slot aqui, mas ja foi devolvido no
     * `previous`. Sem esta linha, a peca voltaria para a mochila com o
     * afixo no slot vazado e o proximo `equip` de outra peca nessa
     * posicao encontraria um afixo que nao e dela
     */
    slot.enchant = null;

    return previous;
  }

  enhanceSlot(slotId) {
    const slot = this.getSlot(slotId);

    if (!slot?.itemId) return false;

    slot.enhance += 1;

    return true;
  }

  /**
   * DESTROI a peca vestida deste slot, sem devolver nada.
   *
   * ## POR QUE NAO E O `unequip`
   *
   * Porque o `unequip` DEVOLVE a peca, e uma peca quebrada nao volta
   * para lugar nenhum. Se a quebra passasse por ele, o jogador veria o
   * item reaparecer na mochila depois de perder — que e o oposto de
   * quebrar, e o jeito mais facil de o jogador achar que o risco e falso
   *
   * ## POR QUE UM METODO E NAO APAGAR OS CAMPOS NA CHAMADA
   *
   * Porque sao cinco campos, e o `unequip` acima ja mostrou que esquecer
   * um deles vaza estado para a proxima peca vestida. `enchant` e o
   * perigoso: um afixo que sobra num slot vazio seria encontrado pela
   * peca seguinte, e ela apareceria encantada sem ter sido
   *
   * Devolve a peca destruida para o motor poder nomear a perda na
   * mensagem, e `false` para slot vazio — igual ao `enhanceSlot`
   */
  breakSlot(slotId) {
    const slot = this.getSlot(slotId);

    if (!slot?.itemId) return false;

    const destruida = {
      itemId: slot.itemId,
      rarity: slot.rarity ?? baseRarityOf(slot.itemId),
      enhance: slot.enhance ?? 0,
      enchant: slot.enchant ?? null,
    };

    slot.itemId = null;
    slot.rarity = null;
    slot.tier = 0;
    slot.enhance = 0;
    slot.enchant = null;

    return destruida;
  }

  /**
   * POE um afixo na peca VESTIDA deste slot.
   *
   * E o equivalente do que o `Inventory` faz com a pilha, para o outro
   * lado: o painel de encantar mostra a mochila E o que esta no corpo,
   * e o jogador espera poder encantar as duas coisas sem antes tirar a
   * armadura das costas
   *
   * Passar pelo `isEnchant` e obrigatorio, e nao por defensividade: o
   * afixo vem do sorteio do motor, mas o `restore` do save tambem
   * escreve neste campo, e um arquivo editado nao passa pelo sorteio
   *
   * Devolve `false` para slot vazio. O `enhanceSlot` faz o mesmo pelo
   * mesmo motivo: um slot sem peca nao tem o que encantar, e dizer que
   * deu certo seria um afixo em lugar nenhum
   */
  setSlotEnchant(slotId, enchant) {
    const slot = this.getSlot(slotId);

    if (!slot?.itemId) return false;

    slot.enchant = isEnchant(enchant) ? enchant : null;

    return true;
  }

  /**
   * A peca do slot, com o que o painel precisa mostrar.
   *
   * `getEquipped` ja devolve a peca inteira com os stats escalados
   * pela raridade; aqui o que se acrescenta e o `slotId`, que e o
   * endereco que o painel manda no pedido. Sem ele o painel nao
   * saberia qual slot encantar
   *
   * Devolve `null` para slot vazio, e nao um objeto de mentira: um
   * slot vazio tem que sumir da lista do painel, e nao aparecer com
   * nome em branco
   */
  enchantTarget(slotId) {
    const entry = this.getEquipped(slotId);

    if (!entry) return null;

    return {
      slotId,
      itemId: entry.id,
      rarity: entry.rarity,
      enchant: entry.enchant ?? null,
    };
  }

  bonuses() {
    const total = {};

    for (const entry of this.getEquippedItems()) {
      const multiplier = 1 + entry.enhance * 0.12;

      // entry.stats ja vem escalado pela raridade em getEquipped
      for (const [key, value] of Object.entries(
        entry.stats ?? {},
      )) {
        total[key] = (total[key] ?? 0) + value * multiplier;
      }
    }

    return total;
  }

  /**
   * O afixo das pecas vestidas, em NUMERO ABSOLUTO.
   *
   * Fica separado do `bonuses` de proposito. O `bonuses` e a soma dos
   * stats que a peca JA tem — um colete com 8 de defesa, e um numero
   * que mora na peca. O afixo e uma FRACAO do stat base do
   * personagem, e so vira numero com a base na mao. Sao coisas
   * diferentes, com unidades diferentes, e somar as duas no mesmo
   * objeto esconderia de onde veio cada numero
   *
   * `baseStats` e o `stats` da classe no nivel 1, que e o que o
   * `applyEquipment` ja le. Passar o jogador inteiro aqui daria um
   * afixo que cresce com o proprio bonus, e o `speed` viraria uma
   * corrida: 2%, 2.04%, 2.08%...
   *
   * O retorno tem o MESMO formato do `bonuses`, e e por isso que o
   * `mergeBonuses` do motor soma os dois sem saber a diferenca
   */
  enchantBonuses(baseStats = null) {
    const total = {};

    for (const entry of this.getEquippedItems()) {
      if (!entry.enchant) continue;

      const valor = resolveEnchant(
        entry.enchant,
        baseStats?.[entry.enchant.stat] ?? 0,
      );

      if (!valor) continue;

      total[entry.enchant.stat] =
        (total[entry.enchant.stat] ?? 0) + valor;
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
        rarity: slot.itemId
          ? slot.rarity ?? baseRarityOf(slot.itemId)
          : null,
        tier: slot.tier,
        enhance: slot.enhance,
        enchant: slot.enchant ?? null,
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
