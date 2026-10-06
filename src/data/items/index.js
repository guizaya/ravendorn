export const RARITY = {
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
};

export const RARITY_ORDER = [
  RARITY.COMMON,
  RARITY.UNCOMMON,
  RARITY.RARE,
  RARITY.EPIC,
  RARITY.LEGENDARY,
];

export const RARITY_STYLE = {
  [RARITY.COMMON]: {
    label: "Comum",
    color: "#c3ccd6",
    weight: 62,
  },
  [RARITY.UNCOMMON]: {
    label: "Incomum",
    color: "#7fd88f",
    weight: 24,
  },
  [RARITY.RARE]: {
    label: "Raro",
    color: "#6fb6ff",
    weight: 10,
  },
  [RARITY.EPIC]: {
    label: "Épico",
    color: "#c489ff",
    weight: 3.4,
  },
  [RARITY.LEGENDARY]: {
    label: "Lendário",
    color: "#ffc857",
    weight: 0.6,
  },
};

export const ITEM_TYPE = {
  MATERIAL: "material",
  WEAPON: "weapon",
  ARMOR: "armor",
  TRINKET: "trinket",

  /**
   * O que se USA e deixa de existir.
   *
   * E o primeiro tipo com essa propriedade, e ele existe porque o
   * mercador do hub vende pocao: sem um tipo que se consuma, a pocao
   * seria um material comum que ocupa um slot inteiro por unidade e
   * nunca faz nada
   *
   * A distinguishing e o campo `use`, e nao o type: e ele que diz o
   * que acontece quando o jogador usa. Um item com `use: null` e um
   * consumivel sem efeito nenhum, que e so um item que se perde
   */
  POTION: "potion",

  /**
   * O que se USA para APRENDER, e nao para recuperar.
   *
   * Um `BOOK` tem `use: { teachSkill: "..." }`. O efeito e diferente da
   * pocao, e e por isso que ele e um `type`: o inventario trata o livro
   * como consumo comum, e o motor olha o `use` para saber que o
   * resultado nao e um numero de vida
   */
  BOOK: "book",
};

export const ITEM_TYPE_LABEL = {
  [ITEM_TYPE.MATERIAL]: "Material",
  [ITEM_TYPE.WEAPON]: "Arma",
  [ITEM_TYPE.ARMOR]: "Armadura",
  [ITEM_TYPE.TRINKET]: "Relíquia",
  [ITEM_TYPE.POTION]: "Poção",

  /**
   * O LIVRO DE HABILIDADE, que se usa e ensina.
   *
   * Separate do `POTION` porque o efeito e completely diferente: a pocao
   * cura, e o livro muda o repertorio do personagem para sempre. O
   * inventario e o mesmo
   *
   * Ele EMPILHA, e por um motivo que e o mesmo da pocao: e um item de
   * consumo, e um jogador com tres livros do mesmo tipo nao deve gastar
   * tres slots da mochila
   */
  [ITEM_TYPE.BOOK]: "Livro",
};

/**
 * Os tipos que EMPILHAM, e ate quanto.
 *
 * Material e pocao empilham porque os dois sao de consumo: um jogador
 * com dez pocoes e duas receitas de craft nao pode gastar vinte slots
 * da mochila em coisas que ele so vai usar
 *
 * Os outros nao empilham porque sao de equipar: duas espadas iguais
 * no mesmo slot e um bug de inventario, nao uma economia
 */
const EMPILHAVEL = new Set([
  ITEM_TYPE.MATERIAL,
  ITEM_TYPE.POTION,
  ITEM_TYPE.BOOK,
]);

/**
 * ONDE a peca vai no corpo.
 *
 * O `type` sozinho nao diz a posicao: `head`, `chest` e `legs`
 * aceitam todos `ARMOR`, entao um capuz cabia no peito e uma bota
 * na cabeca. Qualquer peca de armadura era aceita nos tres slots, e
 * o slot escolhido era o primeiro que coubesse, o que dependia da
 * ORDEM do boneco e nao do item: equipar uma bota com o slot da
 * cabeca vazio vestia a bota na cabeca
 *
 * A posicao e o nome do slot que a peca realmente ocupa. Um item sem
 * `slot` nao declara posicao nenhuma, e ai o `type` manda: e o caso
 * das armas, que todas vao no mesmo slot, e dos relatorios, que
 * tanto servem de anel quanto de amuleto
 */
export const ITEM_SLOT = {
  HEAD: "head",
  GLOVES: "gloves",
  CHEST: "chest",
  LEGS: "legs",
  BOOTS: "boots",
};

/** A posicao que o item ocupa, ou `null` quando ele nao declara uma. */
export function itemSlotOf(item) {
  return item?.slot ?? null;
}

/**
 * Familia de arma.
 *
 * Uma arma pertence a uma familia, e cada familia pertence a um
 * conjunto de classes: arqueiro cria arco, guerreiro cria espada.
 * Armadura e reliquia nao tem familia, servem a qualquer classe.
 */
/**
 * As familias de arma do jogo.
 *
 * Uma por classe, e cada uma com a sua: arco, espada, lanca e cajado.
 * `dagger` e `mace` sairam daqui junto com o `darkist` e o
 * `lionheart`, que eram os unicos a usa-las. Nenhum item dessas
 * familias existia no catalogo, entao as duas entradas eram enum sem
 * ninguem atras: um item de adaga ou maca, se voltasse, seria
 * inWearavel por qualquer classe.
 */
export const WEAPON_KIND = {
  BOW: "bow",
  SWORD: "sword",
  LANCE: "lance",
  STAFF: "staff",
};

export const WEAPON_KIND_LABEL = {
  [WEAPON_KIND.BOW]: "Arco",
  [WEAPON_KIND.SWORD]: "Espada",
  [WEAPON_KIND.LANCE]: "Lança",
  [WEAPON_KIND.STAFF]: "Cajado",
};

/**
 * Uma familia por classe, e o contrario tambem: cada familia do
 * `WEAPON_KIND` pertence a exatamente uma. Sao as mesmas quatro
 * classes de `data/characters/index.js`.
 *
 * O cajado sobrou para a `sorcerer` sozinha, porque `taoist` e
 * `summoner` — as outras classes de magia — sairam do jogo e
 * levaram o compartilhamento junto.
 */
export const CLASS_WEAPON_KINDS = {
  warrior: [WEAPON_KIND.SWORD],
  lancer: [WEAPON_KIND.LANCE],
  sorcerer: [WEAPON_KIND.STAFF],
  arbalist: [WEAPON_KIND.BOW],
};

/**
 * Os ids de classe do jogo, por extenso.
 *
 * Existe para o `classes` de cada peca de armadura nao repetir o
 * mesmo array em dez lugares. Nao e a fonte da verdade — a lista de
 * verdade e `CHARACTER_CLASSES` em `data/characters/index.js`, e o
 * `itemClass.test.js` confere que todo id aqui e uma classe que
 * existe. Importar a lista de la criaria ciclo entre os dois modulos
 */
export const CLASS_IDS = {
  WARRIOR: "warrior",
  LANCER: "lancer",
  SORCERER: "sorcerer",
  ARBALIST: "arbalist",
};

export function weaponKindsOfClass(classId) {
  return CLASS_WEAPON_KINDS[classId] ?? [];
}

/** as classes que podem criar uma arma desta familia */
export function classesOfWeaponKind(kind) {
  return Object.entries(CLASS_WEAPON_KINDS)
    .filter(([, kinds]) => kinds.includes(kind))
    .map(([classId]) => classId);
}

/**
 * Se a classe pode criar/usar o item.
 *
 * A trava e do item, em duas camadas, e a primeira tem prioridade:
 *
 * 1. `item.classes`: as classes donas da peca. E o que segura a
 *    ARMADURA de uma classe longe da outra. A calca de couro do
 *    arqueiro nao e a calca de couro do guerreiro, e o guerreiro
 *    precisa da DELE
 * 2. `item.kind`, so para arma: a familia do arma e o que amarra o
 *    arco ao arqueiro e a espada ao guerreiro
 *
 * Material libera sempre, e e material e nao uma excecao: o
 * ingrediente precisa estar disponivel para todo mundo, senao a
 * cadeia que leva ate a arma de uma classe comeca em material de
 * outra e ninguem consegue craftar
 *
 * Antes o `kind` era a unica trava, e a armadura passava reto para
 * qualquer classe — o guerreiro via no craft a bota, a calca, o
 * capuz, a luva e o peito do arqueiro
 */
export function canClassUseItem(item, classId) {
  if (!item) return false;

  if (item.type === ITEM_TYPE.MATERIAL) return true;

  if (Array.isArray(item.classes)) {
    return item.classes.includes(classId);
  }

  if (item.type !== ITEM_TYPE.WEAPON) return true;
  if (!item.kind) return true;

  return weaponKindsOfClass(classId).includes(item.kind);
}

/** as classes donas declaradas no proprio item */
export function classesOfItemClasses(item) {
  return Array.isArray(item?.classes) ? item.classes : null;
}

function createItem(config) {
  const type = config.type ?? ITEM_TYPE.MATERIAL;

  return {
    // material empilha por padrao: ele e ingrediente de craft e
    // ocuparia um slot inteiro por unidade, o que inviabiliza
    // qualquer receita com quantidade. pocao empilha pelo mesmo motivo
    stackable: EMPILHAVEL.has(type),
    maxStack: EMPILHAVEL.has(type) ? 99 : 1,
    type,
    rarity: RARITY.COMMON,
    value: 10,
    tier: 0,
    quest: false,
    kind: null,

    /**
     * O que acontece quando o jogador USA o item, ou `null`.
     *
     * E o que separa um consumivel de um material: um material se
     * guarda, um consumivel se gasta. O campo e `null` por padrao, e
     * nao `{}`, porque um item sem efeito nao tem efeito — e um `{}`
     * vazio diria que ele usa e nao acontece nada, que e pior
     *
     * Hoje so o `heal` existe. Quando aparecer pocao de recurso, de
     * escudo ou de buff, entra um campo novo AQUI e o motor le o
     * que achar — e nao um `if` por tipo de item
     */
    use: config.use ?? null,

    /**
     * As classes donas da peca, ou `null` quando ela e de todo mundo.
     *
     * E a trava da ARMADURA e da RELIQUIA, que nao tem `kind`: o
     * `kind` e familia de ARMA, e nao faz sentido inventar uma familia
     * "calca" so para prender a peca numa classe. Um item de armadura
     * que aqui fica `null` e usavel por qualquer uma, que e o
     * comportamento de material
     */
    classes: null,
    // a peca nao ocupa posicao nenhuma ate declarar uma. o padrao e
    // `null`, e nao o slot do tipo, para o catalogo nao mentir: um
    // item novo sem `slot` e aceito por qualquer slot do mesmo tipo,
    // que e o comportamento antigo
    slot: null,
    stats: {},
    ...config,
  };
}

export const ITEMS = {
  slime_gel: createItem({
    id: "slime_gel",
    name: "Gelo de Limo",
    icon: "◍",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 4,
  }),

  slime_core: createItem({
    id: "slime_core",
    name: "Núcleo de Limo",
    icon: "◉",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 18,
    quest: true,
  }),

  rat_tail: createItem({
    id: "rat_tail",
    name: "Cauda de Rato",
    icon: "⌇",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 5,
  }),

  rat_pelt: createItem({
    id: "rat_pelt",
    name: "Pele Estropiada",
    icon: "▧",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 16,
    quest: true,
  }),

  /**
   * A POCAO DE CURA, a primeira do mercador do hub.
   *
   * E o item que da sentido ao `ITEM_TYPE.POTION`: ela empilha, tem
   * `use`, e some do slot quando o jogador a bebe. Sem os tres, ela
   * seria um material que ocupa a mochila para sempre
   *
   * `heal: 120` e um quarto da vida de um jogador de nivel 1, e o
   * suficiente para apagar dois golpes de slime. A `use` vai pelo
   * `DamageSystem.heal`, que ja respeita o teto de vida e ja escreve o
   * `+120` flutuante — a pocao reaproveita o feedback que a cura ja
   * tinha, em vez de inventar um
   *
   * `value: 25` e o que o mercado entre jogadores paga por ela, e
   * NAO o preco da loja. O preco de NPC fica no catalogo da loja
   * (`data/potions`), porque ele e uma decisao do mercador e nao do
   * item: mudando o preco da loja, o valor de mercado continua
   * sendo o mesmo numero
   */
  pocao_cura: createItem({
    id: "pocao_cura",
    name: "Poção de Cura",
    icon: "!",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.POTION,
    value: 25,
    use: { heal: 120 },
  }),

  /**
   * O PERGAMINHO DE TELEPORTE.
   *
   * ## POR QUE ELE E DO TIPO DA POCAO, E NAO UM MATERIAL
   *
   * O tipo `POTION` aqui quer dizer "consumivel que empilha", e nao
   * "liquido". E o que faz o pergaminho ocupar UM slot com qualquer
   * quantidade dentro, e nao um slot por unidade. Um material comum
   * ocuparia um slot inteiro por pergaminho: um jogador na caça longa
   * carregaria dez pergaminhos em dez slots, e a mochila lotaria antes
   * da bolsa
   *
   * ## POR QUE `use` E `null`
   *
   * `use: { heal: 120 }` e o que a poçao faz quando o jogador clica em
   * "usar" na mochila. O pergaminho NAO se usa assim: ele e lido pela
   * box de teleporte que aparece durante o deslocamento automatico, e
   * e o motor que decide se ele pode ser gasto
   *
   * Deixar `use` como `null` e o que impede o item de virar um
   * consumivel sem efeito. Se fosse `{}`, o `USAR_ITEM` aceitaria o
   * pedido e o pergaminho sumiria da mochila sem teleportar ninguem —
   * um item que se perde sozinho e o pior resultado possivel
   */
  pergaminho_teleporte: createItem({
    id: "pergaminho_teleporte",
    name: "Pergaminho de Teleporte",
    icon: "✦",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.POTION,
    value: 40,
  }),

  /**
   * O LIVRO DE HABILIDADE, e o primeiro: o do Arbalist.
   *
   * ## O QUE ELE FAZ
   *
   * `use: { teachSkill: "arbalist_quick_shot" }` ensina a Quick Shot
   * para sempre. E o unico item do catalogo com este efeito, e o motor
   * trata a chave `teachSkill` em `GameEngine.usarItem`
   *
   * ## POR QUE O ID DA SKILL ESTA AQUI E NAO SO NO CATALOGO DE LIVROS
   *
   * Porque e este objeto que o jogador USA. O `usarItem` recebe o item
   * da mochila e nao sabe de catalogo nenhum: ele precisa do efeito em
   * maos quando o jogador clica em "usar"
   *
   * E o catalogo de livros (`data/skills/books.js`) tem o mesmo par, mas
   * do outro lado: ali e para o PRECO e para a loja. Sao dois lugares
   * porque sao duas perguntas — "o que o livro faz" mora no item, e
   * "quanto custa" mora no Mestre
   *
   * Se os dois divergirem, o motor ensina o que o ITEM diz e a loja
   * vende o que o CATALOGO diz. Por isso `validarLivros`, no catalogo,
   * confere que os dois ids batem ao carregar o arquivo
   *
   * ## POR QUE `value` E 0
   *
   * Um livro nao tem valor de mercado: ele nao deveria estar no mercado
   * entre jogadores. O preco do Mestre fica no catalogo de livros, e o
   * `value` existe so porque `createItem` exige o campo
   */
  livro_quick_shot: createItem({
    id: "livro_quick_shot",
    name: "Livro: Quick Shot",
    description:
      "Ensina a habilidade Quick Shot. Use o livro para aprender.",
    icon: "§",
    rarity: RARITY.RARE,
    type: ITEM_TYPE.BOOK,
    value: 0,
    use: { teachSkill: "arbalist_quick_shot" },
  }),

  goblin_cloth: createItem({
    id: "goblin_cloth",
    name: "Trapo Goblin",
    icon: "▦",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 8,
    quest: true,
  }),


  ghoul_rot: createItem({
    id: "ghoul_rot",
    name: "Creme do Ghoul",
    icon: "◌",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 6,
  }),

  ghoul_claw: createItem({
    id: "ghoul_claw",
    name: "Garra de Ghoul",
    icon: "⋀",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 22,
    quest: true,
  }),


  ghoul_rib: createItem({
    id: "ghoul_rib",
    name: "Costela Faminta",
    icon: "⌇",
    rarity: RARITY.RARE,
    type: ITEM_TYPE.MATERIAL,
    value: 60,
  }),

  skeleton_skull: createItem({
    id: "skeleton_skull",
    name: "Crânio Antigo",
    icon: "☗",
    rarity: RARITY.RARE,
    type: ITEM_TYPE.MATERIAL,
    value: 70,
  }),


  skeleton_bone: createItem({
    id: "skeleton_bone",
    name: "Osso Amaldiçoado",
    icon: "⌇",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 9,
    quest: true,
  }),


  ogre_pebble: createItem({
    id: "ogre_pebble",
    name: "Seixo de Pedreira",
    icon: "●",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 7,
  }),

  ogre_hide: createItem({
    id: "ogre_hide",
    name: "Couro de Ogre",
    icon: "▩",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 30,
    quest: true,
  }),










  /* ---- armas por classe ----
     Cada familia de arma pertence a um grupo de classes. Sao os
     unicos itens do catalogo com `kind`, e por isso os unicos que
     o craft trava para quem nao e da classe. */

  willow_bow: createItem({
    id: "willow_bow",
    name: "Arco de Galho",
    icon: "🏹",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.WEAPON,
    kind: WEAPON_KIND.BOW,
    tier: 1,
    value: 58,
    stats: { attack: 8, attackSpeed: 0.02 },
  }),

  /* A arma secundaria do arbalist: a aljava.
   *
   * O `slot` e `weapon2` e nao `null` porque a aljava e a peça que
   * fica nas costas, ao lado do arco na mao. Sem o `slot`, o
   * `slotNameFor` cairia no primeiro slot livre do tipo e a aljava
   * seria aceita na mao principal, trocando de lugar com o arco
   *
   * O `kind` continua sendo arco, e e o que trava a classe: as duas
   * pecas do arbalist sao da familia `bow`. Uma familia nova so
   * nasceria se existisse uma classe que NAO usa arco e precisasse
   * da aljava — o que nao acontece
   *
   * O ATQ e menor que o do arco e o `attackSpeed` maior, porque e a
   * segunda peca: os dois bonuses somam (`applyEquipment` junta
   * por stat), e a aljava nao pode valer um arco inteiro sozinha
   */
  aljava_arbalist: createItem({
    id: "aljava_arbalist",
    name: "Aljava de Arqueiro",
    icon: "🎯",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.WEAPON,
    kind: WEAPON_KIND.BOW,
    slot: "weapon2",
    tier: 1,
    value: 44,
    stats: { attack: 4, attackSpeed: 0.05 },
  }),

  /* As botas do arbalist: as grevas.
   *
   * Primeira peca de ARMADURA do catalogo, e a primeira que nao e
   * arma. Duas diferencas em relacao ao arco e a aljava:
   *
   * 1. NAO tem `kind`. A trava de classe e a familia da ARMA, e
   *    armadura nao tem familia: `canClassUseItem` solta qualquer
   *    armadura para qualquer classe. Para as botas serem do
   *    arbalist mesmo, a trava precisaria de outro campo, e ele nao
   *    existe — entao sao livres, como a armadura sempre foi
   *
   * 2. O `slot` e `boots`, e nao `null`. Sem ele a peca entraria em
   *    qualquer slot do mesmo tipo, e `slotNameFor` cairia no
   *    primeiro: o jogador veria "Cabeça" num par de botas
   *
   * DEF e VEL, e nao ATQ: e a peca que se pisa no chao, e o que
   * importa nela e nao morrer e chegar longe. A armadura soma por
   * stat em `applyEquipment`, entao as DEF dos outros slots se
   * juntam a esta
   */
  botas_arbalist: createItem({
    id: "botas_arbalist",
    classes: [CLASS_IDS.ARBALIST],
    name: "Botas de Arqueiro",
    icon: "🥾",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "boots",
    tier: 1,
    value: 36,
    stats: { defense: 5, speed: 4 },
  }),

  /* As calcas do arbalist: as calcas de couro.
   *
   * Terceira peca de ARMADURA, e a que explica o `legs`.
   *
   * O `slot` e `legs` e nao `legs` escrito em qualquer lugar: o id
   * do slot e `legs` mesmo com a peca virando "Calcas" no texto, e
   * o save grava o id. Um arquivo antigo que tenha `legs` continua
   * restaurando no lugar certo. O NOME do slot e o que o jogador le
   *
   * DEF e HP, e nao VEL como nas botas: a peca e do corpo, e o que
   * ela faz e aguentar dano em vez de correr. As duas somam por stat
   * em `applyEquipment`, entao a DEF do peito se junta a esta
   */
  calca_arbalist: createItem({
    id: "calca_arbalist",
    classes: [CLASS_IDS.ARBALIST],
    name: "Calças de Arqueiro",
    icon: "👖",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "legs",
    tier: 1,
    value: 40,
    stats: { defense: 6, maxHp: 24 },
  }),

  /* O capuz do arbalist.
   *
   * Quarta armadura e a que fecha o torso com a cabeca. O capuz tem
   * a pena na lateral, e por isso ganha `attackSpeed` e nao so DEF:
   * e a peca que mira. A arte escala de aco no comum para ouro no
   * lendario, como as outras
   *
   * O `critRate` foi tentado aqui e NAO cabe: `applyEquipment` le
   * DEF, ATQ, VEL, HP, REC, `attackSpeed` e `resourceRegen`, e
   * qualquer outro stat do item eBonus que o motor ignora. O
   * `itemClass.test.js` trava essa lista de sete, entao um stat novo
   * aqui aparece como falha em vez de sumir em silencio
   *
   * Sem `kind` como as outras armaduras: a trava de classe e a
   * familia da ARMA, e armadura nao tem. O `slot` e `head`, e nao
   * `null` — sem ele `slotNameFor` cairia no primeiro slot de
   * armadura, que ja e a cabeca, e o item entraria em qualquer uma
   */
  capuz_arbalist: createItem({
    id: "capuz_arbalist",
    classes: [CLASS_IDS.ARBALIST],
    name: "Capuz de Arqueiro",
    icon: "🎩",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "head",
    tier: 1,
    value: 38,
    stats: { defense: 4, attackSpeed: 0.04 },
  }),

  /* As luvas do arbalist: as manoplas.
   *
   * Quinta armadura e a ultima antes do peito. Fecha a mao que
   * segura o arco, entao DEF e ATQ juntos: e a peca que protege o
   * golpe E a mao que o da. Nenhuma outra peca do arbalist junta os
   * dois — o arco e so ATQ, o capuz e DEF mais velocidade
   *
   * O `slot` e `gloves`. Sem ele a peca entraria em qualquer slot de
   * armadura, e o jogador veria "Cabeca" num par de luvas
   */
  luvas_arbalist: createItem({
    id: "luvas_arbalist",
    classes: [CLASS_IDS.ARBALIST],
    name: "Luvas de Arqueiro",
    icon: "🧤",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "gloves",
    tier: 1,
    value: 34,
    stats: { defense: 3, attack: 2 },
  }),

  /* O peito do arbalist: a couraça.
   *
   * Sexta armadura e a que FECHA o conjunto: com ela o arbalist tem
   * as duas armas e os cinco slots de armadura. E a peca mais cara
   * em DEF e HP do catalogo, que e o que faz sentido — o peito e o
   * lugar onde o golpe chega
   *
   * DEF e HP sao os dois porque e a peca de defesa do corpo inteiro.
   * Nenhuma outra peca do arbalist junta DEF alto com HP: as calcas
   * dao DEF 6 com 24 de HP, e aqui o DEF sobe com o HP junto
   */
  peito_arbalist: createItem({
    id: "peito_arbalist",
    classes: [CLASS_IDS.ARBALIST],
    name: "Peito de Arqueiro",
    icon: "⛊",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "chest",
    tier: 1,
    value: 52,
    stats: { defense: 8, maxHp: 30 },
  }),

  /* ---- armadura do guerreiro ----
   *
   * O guerreiro entrou com arte propria e, com ela, a primeira
   * armadura que NAO e do arqueiro: antes these pecas eram livres e
   * apareciam no craft de qualquer classe, o que deixava o guerreiro
   * com a bota, a calca, o capuz, a luva e o peito do arqueiro.
   *
   * A `classes` e o que fecha isso. E o mesmo campo nos dois lados:
   * o do arqueiro declara `CLASS_IDS.ARBALIST` e o deste declara
   * `CLASS_IDS.WARRIOR`, entao as duas Series sao exclusivas na
   * pratica sem nenhuma lista paralela de "quem pode ver o que"
   *
   * Os STATS sao o que separa as duas classes, e nao um ajuste
   * qualquer:
   *
   * - o arqueiro e de ALCANCE, e por isso o capuz dele da
   *   `attackSpeed` e a bota da `speed`: e a peca que mira e a peca
   *   que foge
   * - o guerreiro e de CORPO A CORPO, e por isso nao ganha
   *   `speed` em lugar nenhum: ele nao corre de ninguem, ele
   *   aguenta. A troca e DEF e HP por peca, e `attack` na luva, que
   *   e a mao que segura a espada
   *
   * As pecas sem arte hoje caem no glifo de texto do `ItemIcon`, que
   * e um caminho suportado e testado. A arte entra em
   * `data/items/icons.js` quando existir, sem mexer em nada aqui
   */

  /**
   * As botas do guerreiro: as sabatonas.
   *
   * O slot e `boots` e nao `null`: sem ele a peca entraria em
   * qualquer slot do mesmo tipo e `slotNameFor` cairia no primeiro,
   * e o jogador veria "Cabeca" num par de botas
   *
   * DEF e HP, e nao `speed` como as botas do arqueiro. O guerreiro
   * nao esta fugindo: a bota dele e para pisar firme, e a troca de
   * `speed` por `maxHp` e o que faz as duas classes se sentirem
   * diferentes com o MESMO numero de pecas
   */
  botas_warrior: createItem({
    id: "botas_warrior",
    classes: [CLASS_IDS.WARRIOR],
    name: "Botas de Guerreiro",
    icon: "🥾",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "boots",
    tier: 1,
    value: 40,
    stats: { defense: 6, maxHp: 12 },
  }),

  /**
   * As calcas do guerreiro.
   *
   * O `slot` e `legs`, que e o id do slot mesmo com a peca virando
   * "Calcas" no texto, e o save grava o id
   *
   * DEF e HP como as do arqueiro, e um ponto acima: e a peca que
   * segura o golpe de frente, e o guerreiro nao tem onde recuar
   */
  calca_warrior: createItem({
    id: "calca_warrior",
    classes: [CLASS_IDS.WARRIOR],
    name: "Calças de Guerreiro",
    icon: "👖",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "legs",
    tier: 1,
    value: 44,
    stats: { defense: 7, maxHp: 30 },
  }),

  /**
   * O elmo do guerreiro.
   *
   * O `slot` e `head`, e nao `null`: sem ele a peca entraria em
   * qualquer slot de armadura e o jogador veria "Cabeca" numa luva
   *
   * DEF e `maxHp`, e nao `attackSpeed` como o capuz do arqueiro: o
   * elmo nao ajuda a mirar, ele segura a cabeca
   */
  elmo_warrior: createItem({
    id: "elmo_warrior",
    classes: [CLASS_IDS.WARRIOR],
    name: "Elmo de Guerreiro",
    icon: "🪖",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "head",
    tier: 1,
    value: 42,
    stats: { defense: 6, maxHp: 10 },
  }),

  /**
   * As manoplas do guerreiro.
   *
   * DEF e ATQ juntos, e o mesmo par do capuz e da luva do arqueiro
   * porem com o ATQ dobrado: e a mao que segura a espada, e o golpe
   * do guerreiro e a unica coisa que ele tem
   */
  luvas_warrior: createItem({
    id: "luvas_warrior",
    classes: [CLASS_IDS.WARRIOR],
    name: "Luvas de Guerreiro",
    icon: "🧤",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "gloves",
    tier: 1,
    value: 36,
    stats: { defense: 4, attack: 4 },
  }),

  /**
   * O peitoral do guerreiro.
   *
   * FECHA o conjunto: com ele o guerreiro tem a espada e os cinco
   * slots de armadura. E a peca mais cara em DEF e HP do catalogo,
   * acima do peito do arqueiro (8/30), que e o que faz sentido: o
   * arqueiro morre longe e o guerreiro morre perto
   */
  peito_warrior: createItem({
    id: "peito_warrior",
    classes: [CLASS_IDS.WARRIOR],
    name: "Peito de Guerreiro",
    icon: "⛊",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "chest",
    tier: 1,
    value: 58,
    stats: { defense: 11, maxHp: 45 },
  }),












  dummy_wood: createItem({
    id: "dummy_wood",
    name: "Madeira de Treino",
    icon: "▬",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 3,
    stackable: true,
    maxStack: 99,
  }),
};

export const ITEM_LIST = Object.values(ITEMS);

export function getItem(id) {
  return ITEMS[id] ?? null;
}

export function rarityOf(item) {
  return RARITY_STYLE[item?.rarity] ?? RARITY_STYLE[RARITY.COMMON];
}

export function isStackable(item) {
  return Boolean(item?.stackable) && (item?.maxStack ?? 1) > 1;
}

/**
 * Quanto cada raridade escala stats e custo.
 *
 * A raridade de um item NAO e fixa: o craft entrega o mesmo item em
 * qualquer uma das cinco. O indice 1 e a raridade "natural" do item,
 * entao criar na raridade base sai pelo mesmo preco da receita.
 * As escalas sao proporcionais a base, o que mantem o preco e o
 * poder sempre ligados.
 */
export const RARITY_STAT_SCALE = {
  [RARITY.COMMON]: 0.7,
  [RARITY.UNCOMMON]: 0.85,
  [RARITY.RARE]: 1,
  [RARITY.EPIC]: 1.2,
  [RARITY.LEGENDARY]: 1.45,
};

export const RARITY_COST_SCALE = {
  [RARITY.COMMON]: 0.5,
  [RARITY.UNCOMMON]: 0.75,
  [RARITY.RARE]: 1,
  [RARITY.EPIC]: 1.7,
  [RARITY.LEGENDARY]: 2.8,
};

/** stats que sao proporcionais e nao podem ser arredondados a inteiro */
const FRACTION_STATS = new Set(["attackSpeed"]);

function scaleStat(stat, value, factor) {
  if (FRACTION_STATS.has(stat)) {
    // preserva o sinal: attackSpeed negativo e penalidade
    return Number((value * factor).toFixed(3));
  }

  return Math.round(value * factor);
}

/** a raridade que o item tem no catalogo, sem craft por cima */
export function baseRarityOf(itemId) {
  return getItem(itemId)?.rarity ?? RARITY.COMMON;
}

/**
 * Os stats do item naquela raridade.
 *
 * Sem `rarity`, devolve os stats do catalogo, entao loot e missao
 * continuam usando a definicao crua.
 */
export function statsAt(itemId, rarity = null) {
  const item = getItem(itemId);

  if (!item) return {};

  const base = RARITY_STAT_SCALE[item.rarity] ?? 1;
  const target =
    rarity === null || rarity === undefined
      ? base
      : (RARITY_STAT_SCALE[rarity] ?? base);

  if (target === base) return { ...item.stats };

  const factor = target / base;
  const scaled = {};

  for (const [stat, value] of Object.entries(item.stats)) {
    scaled[stat] = scaleStat(stat, value, factor);
  }

  return scaled;
}

/** o valor de mercado acompanha o que se pagou pela raridade */
export function valueAt(itemId, rarity = null) {
  const item = getItem(itemId);

  if (!item) return 0;

  const base = RARITY_COST_SCALE[item.rarity] ?? 1;
  const target =
    rarity === null || rarity === undefined
      ? base
      : (RARITY_COST_SCALE[rarity] ?? base);

  return Math.max(1, Math.round(item.value * (target / base)));
}

/** identificador de variante, usado em logs e nos testes */
export function variantId(itemId, rarity = null) {
  const resolved = rarity ?? baseRarityOf(itemId);

  return `${itemId}@${resolved}`;
}

export function isQuestItem(id) {
  return Boolean(ITEMS[id]?.quest);
}

/** itens que alguma missao entrega como recompensa */
export const QUEST_ITEM_IDS = ITEM_LIST.filter(
  (item) => item.quest,
).map((item) => item.id);
