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
      /**
       * O NOME DA PECA VEM DO CATALOGO, e nao e escrito aqui.
       *
       * E o mesmo `getItem` que a mochila, o craft e o tooltip usam. Um
       * nome escrito nesta linha seria a segunda versao do mesmo dado, e
       * as duas divergiriam no dia em que o item fosse renomeado
       *
       * O `+5` aparece no texto porque e a parte que o jogador esquece: ele
       * ve a peca na mochila com +3, e sem o "+5" escrito na tela so
       * descobriria que a peca esta errada depois de clicar e ler o aviso
       */
      if (requirement.itemId) {
        const item = getItem(requirement.itemId);

        const alvo =
          requirement.enhance > 0
            ? `${item?.name ?? requirement.itemId} +${requirement.enhance}`
            : (item?.name ?? requirement.itemId);

        return `${unidade} de ${alvo}`;
      }

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
 * Cripta medem base diferente, e e por isso que o parametro existe. O nome
 * entra no requisito e nao se vira campo: e o que a `degrauDaCriatura`
 * le, e o card nao usa esse dado
 */
function entrega(criatura, itemId, indice = 0, rewards = null) {
  const base = baseDoDegrau(degrauDaCriatura(criatura));

  const fator = FATORES[indice % FATORES.length];

  return {
    type: REQUIREMENT_TYPE.MATERIAL,
    itemId,
    count: base * fator,
    baseDaMissao: base,
    fator,

    /**
     * O BONUS DESTA PARCELA.
     *
     * E o que faz a entrega ser por item: o jogador paga por parcela, e o
     * bonus e dado na hora. Sem ele, a primeira parcela seria trabalho sem
     * recompensa e o card mostraria "Vai receber" sobre material que ele ja
     * tem na mao
     */
    rewards,
  };
}

/**
   * A EXIGENCIA DE UM ITEM DE EQUIPAMENTO, com aprimoramento opcional.
   *
   * E o `itemId` que diz QUAL peca, e nao a raridade: a entrega e do arco do
   * arqueiro, e um arco de outro tipo nao serviria — seria uma entrega de arco
   * que aceita qualquer arco, e o nome do card mentiria
   *
   * `enhance` e o MINIMO por padrao, e nao o valor exato: um arco +8 satisfaz
   * um "+5 ou mais", e o jogador nao deve perder a entrega por ter investido
   * demais
   *
   * Nao usa `entrega()` porque aquela conta material pelo degrau da criatura,
   * e uma peca de equipamento nao vem de caçar bicho nenhum
   *
   * ## POR QUE EXISTE O TERCEIRO ARGUMENTO
   *
   * Porque duas colecoes podem pedir a MESMA peca com aprimoramentos
   * diferentes, e ai o minimo deixa de funcionar
   *
   * A "Aljava do Arqueiro" pede `enhance: 0` e a "Aljava Aprimorada" pede
   * `enhance: 5`. Com o minimo, as duas eram satisfeitas pela mesma peca: o
   * jogador com uma aljava +5 via a primeira entrega como pronta — sem nunca
   * ter entregado nada — e as duas colecoes cobram a mesma coisa
   *
   * Com `exato`, a primeira so aceita +0 e a segunda so aceita +5. E o que
   * faz as duas serem "duas COISAS diferentes de pedir", que e o que o
   * comentario delas promete
   */
  function peca(itemId, enhance, rewards, { exato = false } = {}) {
    return {
      type: REQUIREMENT_TYPE.EQUIPMENT,
      itemId,
      enhance,

      /**
       * `true` quando o `enhance` e o VALOR, e nao o piso.
       *
       * Fica no requisito em vez de virar parametro solto porque ele
       * viaja com o requisito para a contagem e para o consumo — e os dois
       * precisam do mesmo criterio, senao o `deliver` announces uma peca e
       * nao tira nenhuma
       */
      enhanceExato: exato,

      count: 1,
      rewards,
    };
  }

/**
 * AS ENTREGAS DA COLECAO.
 *
 * ## A PRIMEIRA, DO MESMO ESQUELETO DA PRIMEIRA MISSAO
 *
 * A colecao e a missao principal da zona repetida: as duas cobram material
 * do mesmo bicho. A missao paga 10 esqueletos de nivel 1, e esta entrega
 * cobra o DOBRO — os dois primeiros fatores da `FATORES`, o mesmo 2 que
 * a missao usava
 *
 * ## POR QUE DUAS EXIGENCIAS DO MESMO MATERIAL
 *
 * Porque as tres exigencias dentro de uma entrega sao doses crescentes do
 * MESMO item, e e a soma delas que fecha a barra. Com uma exigencia so, a
 * entrega seria a missao de novo so que maior — e o jogador teria duas
 * telas fazendo o mesmo trabalho
 *
 * ## POR QUE 20 E 40, E NAO OS 10 DA MISSAO
 *
 * E a conta do `entrega()`: base do degrau 1, que sao 10, multiplicada
 * pelos fatores 2 e 4. A soma das duas e 60 materiais, e a missao paga 10
 * unidades de material — o jogador tem que voltar a cacar para fechar a
 * entrega, e e esse o proposito
 *
 * ## POR QUE OSSO QUEBRADO E NAO OUTRO GRAU
 *
 * Porque o esqueleto solta osso base. Uma entrega de "Osso Quebrado
 * Reforcado" aqui seria uma entrega que so fecha depois de cinco caadas —
 * e uma colecao e o destino do material ACUMULADO, nao do material rarity
 * raro
 */
export const COLLECTIONS = [
  {
    id: "col_restos_do_esqueleto",
    name: "Restos do Esqueleto",
    icon: "☠",
    summary:
      "Junte osso de esqueleto para o esqueleto da campanha.",
requirements: [
        // 2x os 10 do degrau 1
        entrega("slime", "osso_quebrado", 0, { vit: 2, maxHp: 40 }),
        // 4x os 10 do degrau 1
        entrega("slime", "osso_quebrado", 1, { attack: 3, defense: 2 }),
      ],
      rewards: {},
    },

    /**
     * A SEGUNDA COLECAO, DO LIMOS E DO ESQUELETO.
     *
     * ## POR QUE OUTRA COLECAO E NAO MAIS UMA ENTREGA DA PRIMEIRA
     *
     * Porque a primeira cobra duas doses do MESMO material: ela e a
     * missao principal da zona repetida. Uma segunda colecao com material
     * diferente e de outra criatura faz o painel mostrar para que ele
     * existe — que e ter mais de um destino para o mesmo material
     *
     * ## POR QUE O LIMOS E O ESQUELETO
     *
     * Porque sao as duas criaturas com loot de material BASE: o limo e o
     * degrau 1 e o esqueleto e o primeiro de ferro. Um material de grau
     * alto aqui viraria uma entrega de cinco caadas, e a segunda colecao
     * e justamente a que o jogador deve conseguir fechar cedo
     *
     * E o esqueleto que a primeira colecao NAO usa: ela pede osso do
     * limo. Assim os dois cards puxam de creatures diferentes, e o jogador
     * ve que caçar uma coisa ajuda uma entrega e nao as duas
     */
    {
      id: "col_lodo_e_ferro",
      name: "Lodo e Ferro",
      icon: "⚗",
      summary:
        "Tendao do lodo e ferro do esqueleto: o que sobra de quem cai na fronteira.",
      requirements: [
        // 2x os 10 do degrau 1
        entrega("slime", "tendao_ressecado", 0, { defense: 3 }),
        // 4x os 10 do degrau 1
        entrega("slime", "tendao_ressecado", 1, { maxHp: 60, vit: 1 }),
      ],
      rewards: {},
    },

    /**
     * A TERCEIRA COLECAO, DE UMA PARCELA SO.
     *
     * ## POR QUE ELA EXISTE
     *
     * Porque as duas primeiras tem duas parcelas, e o card nunca aparece
     * com um icone so. Uma entrega unica mostra o card mais curto que ele
     * pode ser — e mostra que o icone e a entrega, sem a segunda dose
     *
     * ## POR QUE O GOBLIN
     *
     * Porque e material BASE de uma criatura de nivel 5, e e um material
     * que nenhuma das outras duas colecoes pede. As duas primeiras usam
     * osso e tendao, ambos do limo; esta e a que puxa de fora da zona de
     * inicio
     *
     * E `couro_goblin`, e nao `fragmento_de_ferro`: o goblin solta couro de
     * goblin, e uma entrega que o jogador preenche com o drop de outro bicho
     * seria uma entrega que o nome do card nao descreve
     */
    {
      id: "col_couro_goblin",
      name: "Pele de Goblin",
      icon: "◑",
      summary: "Couro de goblin saqueador, pelado e esticado.",
      requirements: [
        entrega("goblin", "couro_goblin", 0, { attack: 4, critRate: 5 }),
      ],
      rewards: {},
    },

    /**
     * A ENTREGA DO ARCO DO ARQUEIRO, E A DO MESMO ARCO APRIMORADO.
     *
     * ## POR QUE DUAS COLECOES E NAO UMA SO
     *
     * Porque sao duas COISAS diferentes de pedir. A aljava e um item comum,
     * que o jogador cria no craft; a mesma aljava com +5 e trabalho, porque
     * ele tem que aprimorar antes de entregar. Uma entrega so seria as duas
     * metades amarradas — o jogador teria que ter a peca E o +5 para ganhar
     * a recompensa da peca, e o card mostraria uma coisa so
     *
     * ## POR QUE O `itemId` E NAO A RARIDADE
     *
     * Porque a entrega e desta peca. A aljava e `uncommon`, e a regra antiga
     * de equipamento por raridade aceitaria QUALQUER `uncommon` do
     * inventario — o jogador entregaria um colete e receberia o bonus do
     * arco. O `itemId` diz a peca, e o texto do card sai do catalogo, entao
     * ele nunca mente sobre o que esta sendo pedido
     *
     * E a `aljava_arbalist` e a peca do arqueiro: ela e feita de madeira
     * de lanca, que e o drop do arqueiro zumbi, e e o arco que o craft faz
     */
    {
      id: "col_aljava_arqueiro",
      name: "Aljava do Arqueiro",
      icon: "🎯",
      summary: "A aljava que o arqueiro carrega: uma peca, uma entrega.",
      requirements: [
        peca("aljava_arbalist", 0, { attack: 5, accuracy: 5 }, { exato: true }),
      ],
      rewards: {},
    },

    {
      id: "col_aljava_aprimorada",
      name: "Aljava Aprimorada",
      icon: "➶",
      summary: "A mesma aljava, com +5 de aprimoramento.",
      requirements: [
        peca("aljava_arbalist", 5, { attack: 8, critDamage: 10 }, { exato: true }),
      ],
      rewards: {},
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

  /**
   * RECOMPENSA VAZIA E VALIDA.
   *
   * A entrega e por parcela, entao o bonus vive no requisito e o bonus da
   * colecao fica vazio de proposito — ele e o que sobra depois das
   * parcelas, e numa colecao que nao tem "depois" ele nao existe
   *
   * Rejeitar o objeto vazio obrigaria a colecao a pagar um bonus duplicado
   * no fim, senao o `rewardError` acusaria o dado legitimo
   */
  if (chaves.length === 0) {
    return null;
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

  const { type, itemId, rarity, enhance, count } = requirement;

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
      /**
       * A PECA PELO ID, e nao pela raridade.
       *
       * A regra antiga aceitava QUALQUER equipamento da raridade pedida, e
       * isso e um problema quando a entrega e de uma peca especifica: o
       * jogador entregaria um colete `uncommon` e receberia o bonus do arco
       *
       * O `enhance` e o mesmo campo em ambos os caminhos, e o `rarity`
       * continua valendo para quem nao declara `itemId` — assim uma entrega
       * por raridade exata continua existindo para o que ela serve
       */
      if (itemId !== undefined) {
        const item = getItem(itemId);

        if (!item) return `item inexistente: ${itemId}`;

        if (item.type !== ITEM_TYPE.WEAPON) {
          return `${itemId} e ${item.type}, nao equipamento`;
        }

        if (
          enhance !== undefined &&
          (!Number.isInteger(enhance) || enhance < 0)
        ) {
          return `aprimoramento invalido: ${enhance}`;
        }

        return null;
      }

      if (!RARITY_ORDER.includes(rarity)) {
        return `rarity invalida: ${rarity}`;
      }

      return null;
    }

    return `tipo invalido: ${type}`;
  }
