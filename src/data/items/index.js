/**
 * OS MATERIAIS de drop sao gerados, e nao escritos aqui.
 *
 * A tabela esta em `data/materiais`, porque os 55 itens seguem uma regra
 * (quatro graus de cinco em cinco) e escrever os 55 a mao daria um
 * catalogo em que um id errado so apareceria quando o jogador tentasse
 * fabricar
 *
 * Este import e de uma pasta que importa ESTE arquivo — o `RARITY` da
 * tabela de materiais — e nao ha ciclo: o `data/materiais` so le o `RARITY`
 * no topo, e nao chama nada deste modulo
 */
import { FAMILIAS, todosOsMateriais } from "../materiais/index.js";

/**
 * As CINCO RARIDADES moram em `./raridade.js`.
 *
 * Sao importadas E reexportadas: o `import` e o que deixa o nome
 * disponivel para os `createItem` deste arquivo, e o `export` e o que
 * mantem os quase cem `import { RARITY } from "data/items/index.js"` do
 * jogo funcionando sem que nenhum deles precise saber que o arquivo
 * mudou de lugar
 *
 * Sao dois passos e nao um so porque `export { X } from "..."` NAO cria o
 *vinculo local: o `RARITY` chegaria reexportado e continuaria
 * indefinido dentro deste arquivo
 *
 * O motivo de elas terem saido daqui esta no comentario do `raridade.js`:
 * a tabela de materiais precisa da `RARITY` e este modulo precisa da
 * tabela, entao deixar as duas no mesmo arquivo fechava um ciclo
 */
import {
  RARITY,
  RARITY_ORDER,
  RARITY_STYLE,
} from "./raridade.js";

export { RARITY, RARITY_ORDER, RARITY_STYLE };

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

/**
 * OS ITEMS QUE VIERAM DA TABELA DE MATERIAIS.
 *
 * Sao 55 itens — 12 materiais base e os quatro graus de cada um — e eles
 * estao em `data/materiais` porque seguem uma REGRA, nao porque sejam
 * casos avulsos. O `id`, o nome e a raridade sao derivados da tabela la,
 * e o que fica aqui e so o que o catalogo precisa saber: o tipo, o valor e
 * que empilham
 *
 * O `icon` e um glifo de reserva, e ele nunca aparece: as 14 artes de
 * `assets/Items/drops` estao todas em `ITEM_ICON_SIMPLES`, e o `ItemIcon`
 * prefere a imagem. O glifo e o plano B para quando o arquivo faltar
 *
 * Todos os graus compartilham o arte do material base, e o `ItemIcon`
 * recebe o id do GRAU para achar a arte. Por isso a entrada e `[baseId]`
 * e nao `[id]`: o arquivo e um so por familia de material
 */
const ITENS_DE_MATERIAL = Object.fromEntries(
  todosOsMateriais().map((entrada) => [
    entrada.id,
    createItem({
      id: entrada.id,
      name: entrada.nome,
      icon: "◆",
      rarity: entrada.raridade,
      type: ITEM_TYPE.MATERIAL,
      value: entrada.valor,

      /**
       * A FAMILIA do material, e ela e o que agrupa os 60 materiais em 4.
       *
       * ## POR QUE ISTO VIVE AQUI
       *
       * Porque `createItem` termina em `...config`: o que entra passa. Sem os
       * dois campos abaixo, a UI so veria `id`, nome, icone, raridade, tipo e
       * valor — e a familia do material nao existiria fora deste arquivo, que
       * e justamente onde a lista de craft e montada
       *
       * ## E POR QUE OS DOIS, E NAO SO O ID
       *
       * `familia` e o `mob` da tabela de materiais, e serve para agrupar. E
       * uma chave: mudar o rotulo do grupo entao e uma linha aqui, e nao o
       * painel procurando o nome da criatura em outro catalogo
       */
      familia: entrada.base.mob,
      familiaNome:
        FAMILIAS.find((f) => f.mob === entrada.base.mob)?.nome ??
        entrada.base.mob,
    }),
  ]),
);

export const ITEMS = {
  /**
   * OS MATERIAIS DE DROP, spreads por cima do resto.
   *
   * O spread vem DEPOIS das pecas escritas a mao, e antes delas nao faria
   * diferenca nenhuma: nenhum id colide. Ele fica aqui para que a leitura
   * do arquivo mostre de imediato que os materiais nao estao espalhados
   * pelas 600 linhas do catalogo
   */
  ...ITENS_DE_MATERIAL,

  /**
   * A POCAO DE CURA, a primeira do mercador do hub.
   *
   * E o item que da sentido ao `ITEM_TYPE.POTION`: ele empilha, tem
   * `use`, e some do slot quando o jogador a bebe. Sem os tres, ela
   * seria um material que ocupa a mochila para sempre
   *
   * ## POR QUE REGENERACAO E NAO `heal: 120`
   *
   * Porque a cura instantanea e um numero que so importa no primeiro
   * segundo. Um `+120` de uma vez volta o jogador ao hp cheio ANTES do
   * proximo golpe e nao muda mais nada — o combate voltava a ser uma
   * corrida de golpe, e o item virava so um numero de uso unico
   *
   * ## OS NUMEROS
   *
   * `duration: 10` com `tickInterval: 2` sao cinco tiques de `healPerTick`
   * — 25 x 5 = 125 no total, quase o 120 que a cura dava de uma vez. O
   * total-preservado e de proposito: a pocao continua valendo o que valia,
   * e o que mudou foi QUANDO ela devolve
   *
   * A cura por tique vai pelo `DamageSystem.heal`, que respeita o teto de
   * vida e escreve o `+25` flutuante. Sem isso o tick passaria direto no
   * `hp` e o jogador veria a barra subir sem nenhum feedback
   *
   * `value: 25` e o que o mercado entre jogadores paga por ela, e
   * NAO o preco da loja. O preco de NPC fica no catalogo da loja
   * (`data/potions`), porque ele e uma decisao do mercador e nao do
   * item: mudando o preco da loja, o valor de mercado continua
   * sendo o mesmo numero
   */
  pocao_cura: createItem({
    id: "pocao_cura",
    name: "Poção Pequena",
    icon: "!",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.POTION,
    value: 25,
    use: {
      regeneration: {
        type: "regeneration",
        duration: 10,
        healPerTick: 25,
        tickInterval: 2,
        label: "Poção Pequena",
      },
    },
  }),

  /**
   * A POCAO MEDIA.
   *
   * ## O QUE MUDA EM RELACAO A PEQUENA
   *
   * O `healPerTick` dobra e o `value` dobra. O `duration` e o
   * `tickInterval` ficam iguais de proposito: sao as duas dimensoes que o
   * jogador le DEPOIS de usar — o relogio embaixo da barra e o intervalo
   * entre as passadas. Se a media tivesse 20 segundos, ela viraria "a
   * pequena que dura mais", e nao "a que cura mais"
   *
   * O que o jogador compra com a media e PASSOS de cura a mais, e nao
   * tempo a mais
   *
   * ## POR QUE O ID NAO SEGUE O NOME
   *
   * O id continua sendo `pocao_cura` na Pequena, e o nome e "Poção
   * Pequena". Trocar o id quebraria o save de quem ja tem uma na
   * mochila, a loja do mercador e as receitas. As duas novas nascem
   * com id novo porque nao tem save nenhum para quebrar
   */
  pocao_media: createItem({
    id: "pocao_media",
    name: "Poção Média",
    icon: "!",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.POTION,
    value: 50,
    use: {
      regeneration: {
        type: "regeneration",
        duration: 10,
        healPerTick: 50,
        tickInterval: 2,
        label: "Poção Média",
      },
    },
  }),

  /**
   * A POCAO GRANDE.
   *
   * O quadruplo da Pequena por ciclo, e o `value` tambem em quatro: e a
   * pocao cara, a que o jogador guarda para o chefe e para o trecho em
   * que ele sabe que vai apanhar
   *
   * ## POR QUE ELA NAO TEM NINGUUM EFEITO DE PROTEÇÃO
   *
   * Poderia ter, e seria tentador casar "grande" com escudo. Mas a
   * classe que faz isso ja tem habilidade propria para isso, e um item
   * que acumula cura e defesa vira obrigatorio e tira a decisao do
   * jogador. As tres sao a mesma receita em tres doses
   */
  pocao_grande: createItem({
    id: "pocao_grande",
    name: "Poção Grande",
    icon: "!",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.POTION,
    value: 100,
    use: {
      regeneration: {
        type: "regeneration",
        duration: 10,
        healPerTick: 100,
        tickInterval: 2,
        label: "Poção Grande",
      },
    },
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
   * `use: { regeneration: ... }` e o que a pocao faz quando o jogador
   * clica em "usar" na mochila. O pergaminho NAO se usa assim: ele e lido
   * pela box de teleporte que aparece durante o deslocamento automatico,
   * e e o motor que decide se ele pode ser gasto
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










  /* ---- os acessorios ----
     Os dois primeiros TRINKET do catalogo. Antes deles nao existia
     nenhuma reliquia: o tipo existia e nenhum item o usava, entao a aba
     de Reliquia do craft aparecia vazia e os dois slots `trinket1` e
     `trinket2` ficavam sem nada que ocupasse. */

  /**
   * O ANEL, e a reliquia de qualquer classe.
   *
   * ## POR QUE ELE NAO TEM `classes`
   *
   * Porque a trava de classe do craft e a FAMILIA da arma, e reliquia nao
   * tem familia: um anel que so o arqueiro pudesse usar seria uma restricao
   * sem motivo, e o desenho do texto de criacao pede ele "para qualquer
   * classe"
   *
   * ## POR QUE ELE NAO TEM `slot`
   *
   * Porque sao DOIS slots de reliquia (`trinket1` e `trinket2`) e o
   * `slotForItem` entrega o primeiro que aceita o tipo. Com `slot: null`
   * o jogador escolhe em qual dos dois equipar, e com um `slot` fixo o
   * segundo ficaria sempre vazio
   */
  anel: createItem({
    id: "anel",
    name: "Anel",
    icon: "?",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.TRINKET,
    value: 90,
    stats: { attack: 2, defense: 1 },
  }),

  /**
   * O AMULETO do arqueiro.
   *
   * E a peca mais cara do conjunto: a receita dele e a unica que gasta
   * Essencia Necrotica desde o grau raro, e e a unica em que a pedra
   * verde entra nas cinco raridades
   *
   * Diferente do anel, este NAO trava a classe pelo `classes`: como
   * reliquia ele nao tem familia, e o campo so existe para pecas que
   * precisam de um dono. Um amuleto declarado "do arqueiro" e desenhado
   * como generico seria contradicao na tela
   */
  amuleto_arqueiro: createItem({
    id: "amuleto_arqueiro",
    name: "Amuleto do Arqueiro",
    icon: "?",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.TRINKET,
    value: 120,
    stats: { attack: 3, defense: 2, accuracy: 2 },
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

  /**
   * A ESPADA DO GUERREIRO, que e a arma principal dele.
   *
   * ## POR QUE ELA NAO DECLARA `classes`
   *
   * Porque o `kind` ja faz isso: `canClassUseItem` cai em
   * `weaponKindsOfClass(classe).includes(item.kind)`, e o `CLASS_WEAPON_KINDS`
   * do guerreiro e so `[SWORD]`. E o mesmo mecanismo do arco do arqueiro, que
   * tambem nao declara `classes` e mesmo assim so aparece para o arbalist
   *
   * Declarar `classes` aqui daria o mesmo resultado com uma segunda fonte de
   * verdade — e o dia que o guerreiro ganhasse uma segunda familia de arma,
   * o `classes` continuaria trancando a espada antiga
   */
  espada_warrior: createItem({
    id: "espada_warrior",
    name: "Espada de Guerreiro",
    icon: "⚔",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.WEAPON,
    kind: WEAPON_KIND.SWORD,

    // sem `slot`: a espada e a arma principal, e o `slotNameFor` acha o
    // primeiro slot livre que aceita `WEAPON` — que e o `weapon`
    tier: 1,
    value: 52,
    stats: { attack: 9, attackSpeed: 0.02 },
  }),

  /**
   * O ESCUDO DO GUERREIRO, e a `arma_secundaria.png` da pasta.
   *
   * ## ELE NAO TEM `kind`, E ISSO E DE PROPONITO
   *
   * Nenhuma das quatro familias de `WEAPON_KIND` e "escudo", e adicionar uma
   * quinta so por causa de uma peca seria um `WEAPON_KIND_LABEL` a mais no
   * catalogo para um item so
   *
   * O que segura a restricao de classe e o `classes`, e ele e checado
   * ANTES do `kind` no `canClassUseItem`: um item com `classes` resolvido
   * nunca chega a olhar familia. Sem `kind` o `kindLabel` do craft ja cai em
   * `null` sozinho, que e o display correto para um escudo
   *
   * ## E O `slot` ESTA EXPLICITO, AO CONTRARIO DA ESPADA
   *
   * Porque sem ele o `slotNameFor` devolveria o primeiro slot livre que aceita
   * `WEAPON` — e se o jogador ja estiver com a espada equipada, o escudo
   * entraria no `weapon` e o painel diria "Arma" para as duas
   */
  escudo_warrior: createItem({
    id: "escudo_warrior",
    classes: [CLASS_IDS.WARRIOR],
    name: "Escudo de Guerreiro",
    icon: "🛡",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.WEAPON,
    slot: "weapon2",
    tier: 1,
    value: 46,
    stats: { defense: 8, maxHp: 20 },
  }),

  /* ------------------------------------------------------------------
     SORCERER: as sete pecas da pasta `sorcerer_armadura_1`.
     Nao existia NENHUM item do Sorcerer no catalogo antes deste bloco: a
     classe tinha `CLASS_WEAPON_KINDS` e o slot `weapon2`, e nada mais
     ------------------------------------------------------------------ */

  /**
   * As BOOTAS do sorcerer.
   *
   * DEF mais baixo que o das botas do Guerreiro (4 contra 6) e `speed` no
   * lugar do `maxHp` dele. E o par inverso ao do Guerreiro de proposito: o
   * Guerreiro troca `speed` por `maxHp` para segurar o golpe de frente, e o
   * Sorcerer troca `maxHp` por `speed` para nao estar no mesmo lugar do
   * golpe. As duas classes pesam o mesmo numero de pecas e mesmo assim nao
   * jogam igual
   */
  botas_sorcerer: createItem({
    id: "botas_sorcerer",
    classes: [CLASS_IDS.SORCERER],
    name: "Botas de Sorcerer",
    icon: "🥾",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "boots",
    tier: 1,
    value: 36,
    stats: { defense: 4, speed: 5 },
  }),

  /**
   * As CALCAS do sorcerer.
   *
   * `maxHp` abaixo do das calcas do Guerreiro (20 contra 30) pelo mesmo
   * motivo das botas: o Sorcerer nao e feito para o corpo a corpo
   */
  calca_sorcerer: createItem({
    id: "calca_sorcerer",
    classes: [CLASS_IDS.SORCERER],
    name: "Calças de Sorcerer",
    icon: "👖",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "legs",
    tier: 1,
    value: 40,
    stats: { defense: 5, maxHp: 20 },
  }),

  /**
   * O CAPUZ do sorcerer.
   *
   * O `attackSpeed` mais alto do catalogo (0,05): e a peca que define a
   * identidade do conjureiro, que troca o golpe bruto pela frequencia
   */
  capuz_sorcerer: createItem({
    id: "capuz_sorcerer",
    classes: [CLASS_IDS.SORCERER],
    name: "Capuz de Sorcerer",
    icon: "🎩",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "head",
    tier: 1,
    value: 38,
    stats: { defense: 4, attackSpeed: 0.05 },
  }),

  /**
   * As LUVAS do sorcerer.
   *
   * O `attack` mais alto das duas classes de mao (5 contra as 4 do Guerreiro):
   * a mao e por onde o conjureiro canaliza
   */
  luvas_sorcerer: createItem({
    id: "luvas_sorcerer",
    classes: [CLASS_IDS.SORCERER],
    name: "Luvas de Sorcerer",
    icon: "🧤",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "gloves",
    tier: 1,
    value: 34,
    stats: { defense: 3, attack: 5 },
  }),

  /**
   * O PEITO do sorcerer.
   *
   * O menor DEF do catalogo (7 contra 8 do Arqueiro e 11 do Guerreiro). A
   * peca mais cara em DEF do guerreiro e a mais barata aqui, e e o que faz
   * as duas Classes nao terem o mesmo teto de sobrevivencia
   */
  peito_sorcerer: createItem({
    id: "peito_sorcerer",
    classes: [CLASS_IDS.SORCERER],
    name: "Peito de Sorcerer",
    icon: "⛊",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    slot: "chest",
    tier: 1,
    value: 52,
    stats: { defense: 7, maxHp: 28 },
  }),

  /**
   * O CAJADO, a arma principal do sorcerer.
   *
   * ## POR QUE ELE NAO DECLARA `classes`
   *
   * Pelo mesmo motivo da espada do Guerreiro: o `kind` resolve. O
   * `CLASS_WEAPON_KINDS.sorcerer` e so `[STAFF]`, entao `canClassUseItem` cai
   * em `weaponKindsOfClass(classe).includes(item.kind)` e so o Sorcerer
   * passa. Declarar `classes` aqui seria uma segunda fonte de verdade para
   * a mesma regra
   */
  cajado_sorcerer: createItem({
    id: "cajado_sorcerer",
    name: "Cajado de Sorcerer",
    icon: "🔮",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.WEAPON,
    kind: WEAPON_KIND.STAFF,

    // sem `slot`: e a arma principal, e o `slotNameFor` acha o primeiro
    // slot livre que aceita `WEAPON`
    tier: 1,
    value: 60,
    stats: { attack: 11, attackSpeed: 0.03 },
  }),

  /**
   * O LIVRO DE HABILIDADE, a arma SECUNDARIA do sorcerer.
   *
   * ## O NOME NAO SEGUE O PADRAO `<PECA> de <CLASSE>`
   *
   * "Botas de Guerreiro" e "Aljava de Arqueiro" tiram o nome da classe de
   * tras da peca. Aqui seria "Livro de Habilidade de Sorcerer", que e longo
   * demais para o painel de inventario. O item ja e exclusivo do Sorcerer
   * pelo `classes`, entao o nome nao precisa carregar esse fardo
   *
   * ## E O `slot` ESTA EXPLICITO
   *
   * Pelo mesmo motivo do escudo: sem ele o `slotNameFor` devolveria o
   * primeiro slot livre que aceita `WEAPON`, e com o cajado equipado o livro
   * entraria no `weapon`
   */
  livro_habilidade_sorcerer: createItem({
    id: "livro_habilidade_sorcerer",
    classes: [CLASS_IDS.SORCERER],
    name: "Livro de Habilidade",
    icon: "📖",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.WEAPON,
    slot: "weapon2",
    tier: 1,
    value: 48,
    stats: { attack: 4, defense: 2, maxHp: 15 },
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
 * COMO LER UM STAT: o rotulo e o texto do numero.
 *
 * Isto morava dentro do `describeStats` do `Craft.js`, e o painel do craft
 * nao conseguia montar a lista de atributos sem ele: receber o
 * `statsLine` pronto e nao basta, porque a linha e uma frase joined com
 * dois pontos, e a lista precisa de um item por atributo com rotulo e
 * valor separados
 *
 * A tabela saiu de la e veio para ca, ao lado do `statsAt` que produz os
 * numeros, porque e o mesmo assunto: e aqui que mora `RARITY_STAT_SCALE`
 * e o `scaleStat`. Duas copias da tabela de rotulos garantiam que uma
 * delas ia envelhecer sem a outra
 *
 * ## POR QUE CADA STAT TEM DOIS NOMES
 *
 * `short` e o que cabe na frase do `statsLine`, que junta tudo com `·` e
 * tem que caber numa linha. `long` e o que cabe na lista do painel do
 * craft, que empilha um atributo por linha
 *
 * Sao os mesmos sete stats em `ENCHANT_STAT_LABEL`, com os mesmos nomes
 * por extenso. Nao ha import entre os dois modulos: e `items` que nao
 * sabe que o encantamento existe, e se a lista de stats crescer, quem
 * escreve em `items` e quem ajusta as duas
 */
const STAT_LABELS = {
  attack: { short: "ATQ", long: "Ataque" },
  defense: { short: "DEF", long: "Defesa" },
  maxHp: { short: "HP", long: "Vida" },
  speed: { short: "VEL", long: "Velocidade" },
  attackSpeed: {
    short: "VEL. ATQ",
    long: "Velocidade de ataque",
  },
  resourceRegen: {
    short: "REG",
    long: "Regeneração de recurso",
  },
  resource: { short: "REC", long: "Recurso" },
};

/**
 * UM STAT, JA COM OS DOIS ROTULOS E O NUMERO.
 *
 * O `stat` vai junto porque o painel precisa da CHAVE e nao so do texto:
 * a lista usa a chave para o `key` do React e para saber que
 * `attackSpeed` negativo e pior, e nao "menos 30 de alguma coisa"
 *
 * O `FRACTION_STATS` reusado aqui e o mesmo do `scaleStat` acima, e nao
 * uma segunda copia: os dois precisam concordar sobre quais stats sao
 * proporcionais, e o `scaleStat` ja o mantem sem arredondar justamente
 * porque o `describeStat` vai multiplicar por 100
 */
export function describeStat(stat, value) {
  const nome = STAT_LABELS[stat] ?? { short: stat, long: stat };
  const sign = value > 0 ? "+" : "";

  return {
    stat,
    short: nome.short,
    long: nome.long,
    value,
    text: FRACTION_STATS.has(stat)
      ? `${sign}${Math.round(value * 100)}%`
      : `${sign}${Math.round(value)}`,
  };
}

/** todos os stats de um objeto, na ordem em que o catalogo escreve */
export function describeStats(stats) {
  return Object.entries(stats ?? {}).map(([stat, value]) =>
    describeStat(stat, value),
  );
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
