/**
 * As COLECOES do jogo.
 *
 * Uma colecao e uma MISSAO de entrega: o jogador entrega material e
 * equipamento do inventario e recebe a recompensa. A diferenca para
 * as missoes de `data/quests` e o verbo — la o jogo conta o que voce
 * fez, aqui o jogo conta o que voce TEM e tira da mochila
 *
 * A RECOMPENSA e SO STATS. Nao ha moeda, nem xp, nem item.
 *
 * A escolha tem tres motivos, e o primeiro e o que faz sentido:
 *
 * 1. E o que falta no jogo. `data/quests` paga ouro, xp e item; a
 *    cacada do bestiario paga bonus de stat PERMANENTE; a colecao nao
 *    pagava nada disso. Entrega e cacada sao as duas coisas que o
 *    jogador faz por conta propria, e as duas mereciam virar stats
 *
 * 2. Ouro e xp de entrega inflavam a economia sem dar nada que o
 *    jogador pudesse olhar. +40 de vida e +2 de VIT aparecem no
 *    painel de status para sempre, e o jogador ve de onde veio
 *
 * 3. E a colecao CONSOME o material do jogador. Devolver item seria
 *    trocar material por material, e o jogador acabaria no menu sem
 *    nada — que e a sensacao de "entreguei e perdi"
 *
 * Como o bonus e permanente, ele entra no MESMO pipeline do
 * equipamento e do bestiario: e a coluna `Bonus` do painel de status
 * que mostra a colecao
 *
 * Um REQUISITO e uma de duas coisas, e nunca as duas:
 *
 * - `itemId` + `count`: N unidades de UM material especifico
 * - `rarity` + `count`: N equipamentos de EXATAMENTE aquela raridade
 *
 * "Exatamente" e uma decisao, e nao um esquecimento. A entrega
 * CONSOME o item, e consumir um lendario para cumprir um pedido de
 * raro seria o pior resultado possivel do painel. A missao de
 * equipamento de `data/quests` aceita "raro ou melhor" porque o
 * jogador fica com o item; aqui ele perde
 *
 * O equipamento tem de estar NA MOCHILA. Peca equipada nao esta no
 * inventario — `equipItem` tira a pilha e `unequipItem` devolve — e
 * uma colecao que puxasse a armadura das costas do jogador seria
 * pior do que uma que obriga ele a tirar
 */
import {
  ITEM_TYPE,
  RARITY,
  RARITY_ORDER,
  getItem,
} from "../items/index.js";
import { STAT_BY_ID } from "../../game/stats/StatSheet.js";

/**
 * Os dois tipos de requisito.
 *
 * Sao nomes e nao strings soltas no meio dos dados: o requisito
 * carrega o tipo, e nao da para confundir "material" com "equipamento"
 * trocando um campo
 */
export const REQUIREMENT_TYPE = {
  MATERIAL: "material",
  EQUIPMENT: "equipment",
};

export const REQUIREMENT_TYPE_LABEL = {
  [REQUIREMENT_TYPE.MATERIAL]: "Material",
  [REQUIREMENT_TYPE.EQUIPMENT]: "Equipamento",
};

/**
 * O texto de um requisito, para o painel.
 *
 * Fica aqui, e nao no componente, porque o mesmo texto aparece no
 * painel, no save e no log do servidor. Duas copias divergem
 */
export function describeRequirement(requirement) {
  if (!requirement) return "";

  const { type, count } = requirement;

  const unidade =
    count === 1 ? "unidade" : `${count} unidades`;

  if (type === REQUIREMENT_TYPE.EQUIPMENT) {
    const rotulo =
      RARITY_RARITY_LABEL[requirement.rarity] ??
      requirement.rarity;

    /**
     * O "EXATAMENTE" esta escrito no rotulo, e nao so nas regras.
     *
     * A entrega CONSOME a peca, entao ela aceita so a raridade pedida
     * — um lendario nao conta como raro. Sem isso na tela, o jogador
     * que tem um lendario na mochila le "faltam 1 (0/1) de equipamento
     * raro" com o lendario na frente dos olhos, e conclui que a entrega
     * esta quebrada. A regra continua a mesma; ela so fica escrita onde
     * o jogador decide
     */
    return `${unidade} de equipamento ${rotulo} exato`;
  }

  const item = getItem(requirement.itemId);

  return `${unidade} de ${item?.name ?? requirement.itemId}`;
}

/**
 * O rotulo de raridade em portugues.
 *
 * `RARITY_STYLE` tem o rotulo com a inicial maiuscula ("Epico"), e o
 * requisito de uma colecao aparece no meio de uma frase: "3
 * unidades de equipamento Epico" fica com o E maiusculo no meio. Os
 * rotulos do requisito sao lower case por causa disso
 */
const RARITY_RARITY_LABEL = {
  [RARITY.COMMON]: "comum",
  [RARITY.UNCOMMON]: "incomum",
  [RARITY.RARE]: "raro",
  [RARITY.EPIC]: "epico",
  [RARITY.LEGENDARY]: "lendario",
};

/**
 * O catalogo de colecoes.
 *
 * Os numeros sao balanceamento, e a escalada entre elas e proposital:
 * cada colecao pede material de um nivel mais alto que a anterior,
 * entao a ultima nao se completa no primeiro minuto de jogo
 *
 * A recompensa tambem escala, e no MESMO eixo: a primeira entrega
 * rende pouco e mexe so em VIT e HP, e a ultima mexe em seis stats ao
 * mesmo tempo. A soma das seis entregas e o bonus permanente maximo
 * que a colecao da — e ele aparece inteiro na coluna `Bonus` do
 * painel de status
 *
 * Nenhuma peca de EQUIPAMENTO de outra classe entra aqui como
 * requisito com `rarity`: o requisito por raridade olha para a
 * mochila inteira, e nao para "uma espada rara". Isso e de proposito
 * tambem — a colecao existe para dar um destino ao material acumulado,
 * nao para ser mais uma trava de classe
 */
export const COLLECTIONS = [
  {
    id: "col_cacos",
    name: "Restos do Brejo",
    icon: "◍",
    summary: "Junte os restos do primeiro slime.",
    requirements: [
      {
        type: REQUIREMENT_TYPE.MATERIAL,
        itemId: "slime_gel",
        count: 5,
      },
    ],
    rewards: { vit: 2, maxHp: 40 },
  },

  {
    id: "col_ninho",
    name: "Ninho de Rato",
    icon: "◔",
    summary: "O rato tambem deixa coisa para tras.",
    requirements: [
      {
        type: REQUIREMENT_TYPE.MATERIAL,
        itemId: "rat_tail",
        count: 5,
      },
      {
        type: REQUIREMENT_TYPE.MATERIAL,
        itemId: "rat_pelt",
        count: 3,
      },
    ],
    rewards: {
      dex: 3,
      movementSpeed: 20,
      evasion: 0.02,
      critRate: 0.01,
      attackSpeed: 0.05,
    },
  },

  {
    id: "col_ossada",
    name: "Ossada Antiga",
    icon: "☠",
    summary: "O que sobra de um esqueleto nao serve para o craft.",
    requirements: [
      {
        type: REQUIREMENT_TYPE.MATERIAL,
        itemId: "skeleton_bone",
        count: 5,
      },
      {
        type: REQUIREMENT_TYPE.MATERIAL,
        itemId: "skeleton_skull",
        count: 2,
      },
    ],
    rewards: {
      vit: 4,
      defense: 8,
      magicDefense: 5,
      hpRegen: 2,
    },
  },

  {
    id: "col_primeira_ferra",
    name: "Primeira Ferramenta",
    icon: "⚒",
    summary: "Um equipamento raro na mochila, e materia para remendo.",
    requirements: [
      {
        type: REQUIREMENT_TYPE.EQUIPMENT,
        rarity: RARITY.RARE,
        count: 1,
      },
      {
        type: REQUIREMENT_TYPE.MATERIAL,
        itemId: "goblin_cloth",
        count: 5,
      },
    ],
    rewards: {
      str: 5,
      attack: 14,
      attackSpeed: 0.06,
      accuracy: 10,
    },
  },

  {
    id: "col_couro_ogro",
    name: "Couro de Ogro",
    icon: "◪",
    summary: "A ultima penca do material mais pesado do jogo.",
    requirements: [
      {
        type: REQUIREMENT_TYPE.MATERIAL,
        itemId: "ogre_hide",
        count: 5,
      },
      {
        type: REQUIREMENT_TYPE.MATERIAL,
        itemId: "ogre_pebble",
        count: 8,
      },
    ],
    rewards: {
      vit: 6,
      wis: 3,
      maxHp: 180,
      defense: 18,
    },
  },

  {
    id: "col_besta_do_ossario",
    name: "Cacador do Ossario",
    icon: "★",
    summary: "A ultima entrega: um lendario e o que sobrou do ghoul.",
    requirements: [
      {
        type: REQUIREMENT_TYPE.EQUIPMENT,
        rarity: RARITY.LEGENDARY,
        count: 1,
      },
      {
        type: REQUIREMENT_TYPE.MATERIAL,
        itemId: "ghoul_claw",
        count: 5,
      },
    ],
    rewards: {
      str: 7,
      dex: 6,
      int: 3,
      attack: 26,
      critRate: 0.06,
      critDamage: 0.25,
      enhanceSuccess: 0.03,
      dropRate: 0.02,
    },
  },
];

export const COLLECTION_IDS = COLLECTIONS.map(
  (collection) => collection.id,
);

export const TOTAL_COLLECTIONS = COLLECTIONS.length;

export function getCollection(id) {
  return (
    COLLECTIONS.find((collection) => collection.id === id) ??
    null
  );
}

/**
 * O erro de uma recompensa malformada, ou `null` se ela esta inteira.
 *
 * A recompensa e um dicionario de STATS e nada mais. Um `coins` ou um
 * `items` aqui nao e "um stat a mais": e o formato antigo, e passaria
 * silenciosamente pelo `deliver` para nunca virar nada na mochila — o
 * jogador entregaria o material e nao receberia nem moeda nem item.
 * Por isso a regra proibe em vez de ignorar
 */
export function rewardError(rewards) {
  if (!rewards || typeof rewards !== "object") {
    return "rewards tem de ser um objeto de stats";
  }

  const chaves = Object.keys(rewards);

  if (chaves.length === 0) {
    return "rewards nao pode ser vazio: a entrega custa material";
  }

  for (const stat of chaves) {
    if (!STAT_BY_ID[stat]) {
      return `stat inexistente: ${stat}`;
    }

    const valor = rewards[stat];

    if (
      typeof valor !== "number" ||
      !Number.isFinite(valor) ||
      valor <= 0
    ) {
      return `${stat} precisa ser um numero maior que zero`;
    }
  }

  // a colecao paga SO stat. estas chaves eram o formato antigo e
  // passariam pelo teste de "o stat existe" sem serem stat
  for (const proibido of ["coins", "xp", "items", "itemId"]) {
    if (proibido in rewards) {
      return `a colecao paga so stats: ${proibido} nao e uma recompensa valida`;
    }
  }

  return null;
}

/**
 * O erro de um requisito malformado, ou `null` se ele esta inteiro.
 *
 * Existe como funcao e nao como um `throw` na construcao porque a
 * lista de colecoes e dado, e dado errado tem de aparecer como uma
 * falha de teste nomeada, e nao derrubar o jogo no import
 */
export function requirementError(requirement) {
  if (!requirement || typeof requirement !== "object") {
    return "requisito invalido";
  }

  const { type, itemId, rarity, count } = requirement;

  if (count === undefined || !Number.isInteger(count) || count <= 0) {
    return "count precisa ser um inteiro maior que zero";
  }

  if (type === REQUIREMENT_TYPE.MATERIAL) {
    if (rarity !== undefined) {
      return "material nao pode declarar rarity";
    }

    if (!itemId) return "material precisa de itemId";

    const item = getItem(itemId);

    if (!item) return `item inexistente: ${itemId}`;

    if (item.type !== ITEM_TYPE.MATERIAL) {
      return `${itemId} e ${item.type}, nao material`;
    }

    return null;
  }

  if (type === REQUIREMENT_TYPE.EQUIPMENT) {
    if (itemId !== undefined) {
      return "equipamento nao pode declarar itemId";
    }

    if (!RARITY_ORDER.includes(rarity)) {
      return `rarity invalida: ${rarity}`;
    }

    return null;
  }

  return `tipo invalido: ${type}`;
}
