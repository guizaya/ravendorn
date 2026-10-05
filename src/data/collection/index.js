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
import { ESCADA_MAPA_1, ESCADA_MAPA_2 } from "../quests/index.js";

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
/**
 * A COLECAO E A MISSAO PRINCIPAL DA ZONA, REPETIDA.
 *
 * O jogador junta material do mesmo bicho que a missao cobra, e a
 * quantidade e a da missao em doses maiores — a mesma conta do
 * bestiario, com os mesmos multiplicadores
 *
 * ## POR QUE A COLECAO NAO TEM TIER
 *
 * A missao e a cacada tem degraus porque a recompensa cresce. A entrega
 * e uma so por colecao, entao o que muda dentro dela e o material: a
 * primeira exigencia e o dobro da base, a segunda o quadruplo, a
 * terceira o sextuplo, na ordem em que aparecem
 */
const FATORES = [2, 4, 6];

/**
 * O DEGRAU da escada que pede esta criatura.
 *
 * O degrau da MISSAO, e nao o nivel do mob: o limo do campo e de nivel
 * 6 e o da pedreira e de nivel 1, e as duas entregas saem com o mesmo
 * total
 *
 * ## POR QUE AS DUAS ESCADAS
 *
 * A sentinela e o arqueiro zumbi so aparecem na escada do mapa 2. Ler so
 * a do mapa 1 as faria cair no degrau 1 por falta de correspondencia, e
 * uma entrega de material do bicho mais duro do jogo sairia com a meta
 * do primeiro degrau do vale
 */
function degrauDaCriatura(criatura) {
  const achado = [...ESCADA_MAPA_1, ...ESCADA_MAPA_2].find(
    (degrau) => degrau.target === criatura,
  );

  return achado?.nivel ?? 1;
}

/** A MESMA CONTA da missao: 10 no primeiro degrau, mais 2 por nivel. */
function baseDoDegrau(nivel) {
  return 10 + (nivel - 1) * 2;
}

/**
 * A EXIGENCIA de material, com a conta feita aqui.
 *
 * `criatura` e de quem vem o material — o limo daPantano e o ogre da
 * Cripta medem base diferente, e e por isso que o parametro existe
 */
function entrega(criatura, itemId, indice = 0) {
  const base = baseDoDegrau(degrauDaCriatura(criatura));

  const fator = FATORES[indice % FATORES.length];

  return {
    type: REQUIREMENT_TYPE.MATERIAL,
    itemId,
    count: base * fator,
    baseDaMissao: base,
    fator,
  };
}

export const COLLECTIONS = [
  {
    id: "col_cacos",
    name: "Restos do Brejo",
    icon: "◍",
    summary: "Junte os restos do primeiro slime.",
    requirements: [
      // 2x os 10 do degrau 1
      entrega("slime", "slime_gel"),
    ],
    rewards: { vit: 2, maxHp: 40 },
  },

  /**
   * A COLECAO DO RATO E DO ESQUELETO SAIRAM.
   *
   * As duas eram de material que o mapa 1 nao dropa mais: o rato e o
   * esqueleto foram removidos do `ZONE_ROSTER` quando as cinco zonas do
   * meio passaram a ser so de ogre
   *
   * Um material que ninguem dropa e uma entrega que nunca fecha. A
   * colecao ficava na tela com a barra parada em zero e nenhuma
   * explicacao — o jogador nao tinha como saber que aquilo era
   * impossivel, so que nao estava="_indo"
   *
   * O `skeleton_bone` ainda aparece no loot do SLIME, com peso 1, entao
   * sobrou material de osso no mundo. Ele virou materia de remendo na
   * colecao do limo, abaixo, em vez de uma entrega impossivel
   */

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

      /**
       * O `goblin_cloth` era o segundo material, e o goblin saiu do
       * mapa. Trocado pelo `slime_core`, que o limo ainda dropa com
       * peso 15
       */
      entrega("slime", "slime_core", 1),
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
      // o ogre so entra no degrau 8, onde a missao pede 24: 2x e 4x
      entrega("ogre", "ogre_hide", 0),
      entrega("ogre", "ogre_pebble", 1),
    ],
    rewards: {
      vit: 6,
      wis: 3,
      maxHp: 180,
      defense: 18,
    },
  },

  /**
   * AS ENTREGAS DO MAPA 2.
   *
   * A sentinela e o arqueiro zumbi dropam osso, cranio, podre e garra.
   * O cranio vem so dos dois: o limo e o ogre nao tem, entao e a entrega
   * que so fecha no mapa 2
   */
  {
    id: "col_ossario",
    name: "Ossario Antigo",
    icon: "☠",
    summary: "O que sobra de um esqueleto nao serve para o craft.",
    requirements: [
      // a sentinela entra no degrau 13, onde a missao pede 34
      entrega("skeleton", "skeleton_bone", 0),
      entrega("skeleton", "skeleton_skull", 1),
    ],
    rewards: {
      vit: 4,
      defense: 8,
      magicDefense: 5,
      hpRegen: 2,
    },
  },

  {
    id: "col_flecha_podre",
    name: "Flecha Podre",
    icon: "➶",
    summary: "O arqueiro zumbi atira coisa que nao se reutiliza.",
    requirements: [
      // o arqueiro so entra no degrau 18, onde a missao pede 44
      entrega("zumbi_arbalist", "ghoul_rot", 0),
      entrega("zumbi_arbalist", "ghoul_claw", 1),
    ],
    rewards: {
      dex: 4,
      attackSpeed: 0.06,
      critRate: 0.02,
      critDamage: 0.1,
    },
  },

  {
    id: "col_cacador_ocre",
    name: "Cacador do Ocre",
    icon: "🗡",
    summary: "A ultima entrega: um lendario e couro da predeira.",
    requirements: [
      {
        type: REQUIREMENT_TYPE.EQUIPMENT,
        rarity: RARITY.LEGENDARY,
        count: 1,
      },

      /**
       * O `ghoul_claw` era o material de ca here, e o ghoul saiu do mapa 1
       * quando as cinco zonas do meio passaram a ser so de ogre.
       *
       * Trocado pelo couro do ogre da PREDEIRA, que e o bicho mais duro
       * do topo da campanha — o que mantem a entrega como a mais cara do
       * jogo, que e o que a recompensa pedia
       */
      entrega("ogre_da_predeira", "ogre_hide", 1),
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
