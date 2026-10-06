/**
 * O ENCANTAMENTO: um stat sorteado, colado numa peca.
 *
 * A ideia e a de um jogo de RPG comum — voce pega um item, rola um
 * afixo, e o item passa a valer um pouco mais. O que este modulo
 * decide e o que o resto do jogo obedece:
 *
 * 1. **QUAL stat** pode sair. A lista e curta e NAO e a lista toda de
 *    stat do jogo: e so a lista que o `applyEquipment` do motor sabe
 *    aplicar. Um `critRate` aqui apareceria no painel de status e nao
 *    mudaria nada no combate, porque o motor nunca escreve esse campo
 *    no jogador. A lista e validada por teste contra o que o motor le
 *
 * 2. **QUANTO** cada raridade vale. O valor e uma FRACAO do stat base
 *    do personagem, nao um numero absoluto: um `+2%` de velocidade
 *    precisa continuar sendo 2% quando o personagem subir de nivel, e
 *    um `+2` absoluto viraria irrelevante num nivel alto
 *
 * 3. **QUANTO CUSTA**. Encantar de graca seria um sorteio infinito,
 *    e um stat rolado quantas vezes quisesse nao tem balanceamento.
 *    O custo escala com a raridade do ITEM pela mesma escala que o
 *    craft usa — ver `RARITY_COST`, que e a copia local dessa escala
 *
 * A FRACAO e guardada, e o absoluto e derivado na hora de aplicar. E o
 * que permite o mesmo `enchant` valer para duas classes com stats
 * base diferentes — e o que impede um save de 2019 travar num valor
 * absoluto que nao existe mais
 */
import {
  ITEM_TYPE,
  RARITY,
  RARITY_ORDER,
  RARITY_STYLE,
  getItem,
} from "../items/index.js";

/**
 * Os stats que um encantamento pode dar.
 *
 * E a EXATA lista que o `applyEquipment` do motor le: `maxHp`,
 * `resource`, `attack`, `defense`, `speed`, `attackSpeed` e
 * `resourceRegen`. Um stat fora daqui nao quebraria nada — ele
 * simplesmente passaria batido, aparecendo no painel e nao fazendo
 * nada, que e o pior defeito que um bonus pode ter
 *
 * `critRate` e `critDamage` estao fora de proposito: os dois existem
 * no personagem, mas o motor so os escreve UMA vez, na criacao, e o
 * `applyEquipment` nunca os toca. Um encantamento de crit apareceria
 * como `+5%` no painel e o golpe continuaria critando igual
 */
export const ENCHANT_STATS = [
  "attack",
  "defense",
  "maxHp",
  "resource",
  "speed",
  "attackSpeed",
  "resourceRegen",
];

/**
 * Os stats que ja sao FRACAO, e nao numero absoluto.
 *
 * `attackSpeed` e um multiplicador (`1.4` e 140% do ataque) e
 * `resourceRegen` e um tanto por segundo. Multiplicar uma fracao pela
 * base do personagem daria um numero sem sentido: `0.02 * 1.4` para um
 * `attackSpeed` de 1.4 daria 0.028 de ataque extra, e nao 2%
 *
 * Todos os outros da lista sao absolutos — vida, ataque, defesa,
 * velocidade — e a fracao do encantamento e multiplicada pela base
 */
const ENCHANT_FRACTION_STATS = new Set([
  "attackSpeed",
  "resourceRegen",
]);

/** O nome de cada stat, para o painel e para o item */
export const ENCHANT_STAT_LABEL = {
  attack: "Ataque",
  defense: "Defesa",
  maxHp: "Vida",
  resource: "Recurso",
  speed: "Velocidade",
  attackSpeed: "Velocidade de ataque",
  resourceRegen: "Regeneração de recurso",
};

/**
 * O quanto cada raridade vale, em fracao do stat.
 *
 * Raro 2% e epico 4%, que e o exemplo que motivou o painel. A
 * progressao nao e linear de proposito: a curva de chance do
 * `RARITY_STYLE` ja e-ravesca, e um valor linear aqui entregaria um
 * lendario que quase nao difere de um epico
 */
export const ENCHANT_POWER = {
  [RARITY.COMMON]: 0.01,
  [RARITY.UNCOMMON]: 0.015,
  [RARITY.RARE]: 0.02,
  [RARITY.EPIC]: 0.04,
  [RARITY.LEGENDARY]: 0.06,
};

/**
 * O preco de encantar, em ouro.
 *
 * Sai do valor do item E da escala de custo por raridade, e nao de uma
 * tabela solta: um arco lendario sendo encantar por um colete
 * comum quebraria a leitura de "encantar e caro". O mesmo item, na
 * mesma raridade, custa sempre o mesmo — o preco depende do que esta
 * sendo encantado, nao da sorte do sorteio
 */
export const ENCHANT_BASE_COST = 45;

export function enchantCost(itemId, rarity = null) {
  const item = getItem(itemId);

  if (!item) return 0;

  const base = ENCHANT_BASE_COST + (item.value ?? 0) * 2;

  return Math.round(base * (RARITY_COST[item.rarity] ?? 1));
}

/**
 * A escala de custo por raridade do ITEM, nao a do encantamento.
 *
 * `RARITY_COST_SCALE` do catalogo, copiado para ca com o nome
 * proprio. O original nao e exportado por `data/items/index.js`, e
 * exportar la mexeria nos testes de craft e de icone por causa de um
 * numero — entao a copia mora aqui, e ela e EXPORTADA para o
 * `enchant.test.js` poder conferir que os cinco valores nao mudaram
 */
export const RARITY_COST = {
  [RARITY.COMMON]: 0.5,
  [RARITY.UNCOMMON]: 0.75,
  [RARITY.RARE]: 1,
  [RARITY.EPIC]: 1.7,
  [RARITY.LEGENDARY]: 2.8,
};

/**
 * Os tipos de item que aceitam encantamento.
 *
 * O pedido foi arma, arma secundaria e armadura, e sao os tres. Os
 * MATERIAIS ficam de fora por um motivo que nao e balanceamento: eles
 * sao empilhaveis, e uma pilha de 99 lulas de esqueleto nao
 * tem como carregar um afixo por peca
 */
export const ENCHANTABLE_TYPES = [
  ITEM_TYPE.WEAPON,
  ITEM_TYPE.ARMOR,
];

/** O item aceita encantamento? */
export function canEnchantItem(itemId) {
  const item = getItem(itemId);

  return Boolean(item) && ENCHANTABLE_TYPES.includes(item.type);
}

/**
 * Sorteia a RARIDADE do encantamento.
 *
 * Reaproveita o peso do `RARITY_STYLE` do catalogo — 62 / 24 / 10 /
 * 3.4 / 0.6 — em vez de uma tabela nova. Raro e epico sao raros de
 * proposito: se o epico saisse 1 em cada 3 o painel seria um PLACE de
 * sorteio e nao uma escolha
 *
 * O `random` entra por parametro para o teste poder escolher a
 * raridade sem reescrever a funcao. Sem ele o teste so conseguiria
 * testar a distribuicao estatistica, que e lenta e ainda deixa o
 * teste passar por sorte
 */
export function rollRarity(random = Math.random) {
  const total = RARITY_ORDER.reduce(
    (sum, raridade) =>
      sum + (RARITY_STYLE[raridade]?.weight ?? 0),
    0,
  );

  let alvo = random() * total;

  for (const raridade of RARITY_ORDER) {
    alvo -= RARITY_STYLE[raridade]?.weight ?? 0;

    if (alvo <= 0) return raridade;
  }

  // o resto do `for` e o caso da ponta: uma soma de ponto flutuante
  // pode deixar `alvo` positivo depois do ultimo subtrair, e sem este
  // `return` a funcao devolveria `undefined`
  return RARITY_ORDER[RARITY_ORDER.length - 1];
}

/**
 * Sorteia um encantamento INTEIRO: o stat e a raridade.
 *
 * O valor nao sai daqui. Ele e a fracao do `ENCHANT_POWER`, e quem
 * converte para numero absoluto e `resolveEnchant`, no momento de
 * aplicar — porque so ali existe a base do personagem
 *
 * Devolve `null` quando o item nao aceita, e nao um encantamento
 * invalido: um item fora do tipo certo tem que ser RECUSADO, e nao
 * receber um afixo que o `applyEquipment` vai ignorar
 */
export function rollEnchant(itemId, random = Math.random) {
  if (!canEnchantItem(itemId)) return null;

  const stat =
    ENCHANT_STATS[
      Math.min(
        ENCHANT_STATS.length - 1,
        Math.floor(random() * ENCHANT_STATS.length),
      )
    ];

  const rarity = rollRarity(random);

  return {
    stat,
    rarity,
    power: ENCHANT_POWER[rarity],
  };
}

/** O encantamento tem o formato certo? */
export function isEnchant(bruto) {
  if (!bruto || typeof bruto !== "object") return false;

  if (!ENCHANT_STATS.includes(bruto.stat)) return false;

  if (!Object.hasOwn(ENCHANT_POWER, bruto.rarity)) return false;

  const power = ENCHANT_POWER[bruto.rarity];

  // o valor precisa ser a fracao DAQUELA raridade, e nao um numero
  // qualquer. Um save alterado com `power: 999` colocaria um
  // multiplicador de mil no stat do jogador, e a tela mostraria um
  // numero absurdo sem explicar de onde veio
  return Number(bruto.power) === power;
}

/**
 * O texto do afixo, como o jogador le no item.
 *
 * `+2%` e um round de leitura, nao do valor: a fracao 0.02 e
 * exibida com uma casa, e o resto vem do `RARITY_STYLE`
 */
export function describeEnchant(enchant) {
  if (!enchant) return "";

  const percent = Number((enchant.power * 100).toFixed(1));

  return `+${percent}% ${ENCHANT_STAT_LABEL[enchant.stat] ?? enchant.stat}`;
}

/**
 * O valor ABSOLUTO que o encantamento dá, para uma base.
 *
 * `base` e o stat do personagem no nivel 1 da classe, e e o que o
 * `applyEquipment` ja le. A fracao do encantamento e multiplicada por
 * ele para os stats absolutos, e somada direto para os que ja sao
 * fracao
 *
 * A conversao mora AQUI e nao no motor porque e regra do encantamento,
 * e nao do motor: o motor so precisa do numero pronto
 */
export function resolveEnchant(enchant, base = 0) {
  if (!enchant) return 0;

  if (ENCHANT_FRACTION_STATS.has(enchant.stat)) {
    return enchant.power;
  }

  const numero = Number(base);

  if (!Number.isFinite(numero)) return 0;

  /**
   * O arredondamento nao e cosmetico.
   *
   * `165 * 0.04` em ponto flutuante da `6.6000000000000005`. Isso
   * entraria no stat do jogador como um float com ruido, e o painel de
   * status, que compara o total com o base, mostraria um bonus de
   * `6.6000000000000005` arredondado para 7 — um numero que nao
   * corresponde a nada que o jogador comprou
   *
   * Tres casas porque e o mesmo arredondamento que o `scaleStat` do
   * catalogo usa nos stats proporcionais
   */
  return Number((numero * enchant.power).toFixed(3));
}

/** Os possiveis resultados, para o painel mostrar as chances */
/**
 * A TABELA DE CHANCES do painel de encantar.
 *
 * ## `chance` E O QUE O JOGADOR QUER SABER
 *
 * Antes esta funcao devolvia `percent: ENCHANT_POWER * 100`, que e o
 * QUANTO o afixo vale — 1%, 1.5%, 2%, 4%, 6% — e o painel rotulava essa
 * coluna de "Chances". O jogador lia "Lendário 6%" e podia crer que tem
 * 6% de chance de sair lendário, quando o sorteio real leva bem menos
 *
 * A chance de verdade e o `weight` do `RARITY_STYLE`, e normalizada pelo
 * total dos pesos. O `rollRarity` e exatamente esse sorteio ponderado,
 * entao o numero da tela e o numero que sai: um `weight` de 62 sobre um
 * total de 200 e 31%, e 31% e a chance
 *
 * ## POR QUE NORMALIZAR, E NAO LER O `weight` DIRETO
 *
 * Os pesos sao numeros de balanceamento (62, 24, 9...) e nao somam 100.
 * Se o painel mostrasse o peso cru, a coluna seria de "62%" para o
 * comum e a soma passaria de 100 sem que ninguem percebesse — e um
 * jogador que somasse as cinco linhas veria que o jogo mente
 *
 * A soma e calculada a partir do mesmo `RARITY_ORDER` que o `rollRarity`
 * percorre, entao os dois nunca podem cair em ordens diferentes
 *
 * ## `power` CONTINUA AQUI, PARA O QUE PRECISA DELE
 *
 * O valor do afixo continua no retorno. Quem quiser mostrar "1% de
 * ataque" em vez da chance tem o numero sem refazer a conta
 */
export function enchantOdds() {
  const total = RARITY_ORDER.reduce(
    (sum, raridade) =>
      sum + (RARITY_STYLE[raridade]?.weight ?? 0),
    0,
  );

  return RARITY_ORDER.map((raridade) => ({
    rarity: raridade,
    label: RARITY_STYLE[raridade].label,
    color: RARITY_STYLE[raridade].color,

    /**
     * A CHANCE, em porcento, e com uma casa.
     *
     * Uma casa porque a soma das cinco linhas precisa fechar em 100 de
     * olhos: com zero casa, 30.5 viraria 31 e o painel marcaria 101
     */
    chance: total > 0
      ? Number(
          (((RARITY_STYLE[raridade]?.weight ?? 0) / total) * 100)
            .toFixed(1),
        )
      : 0,

    /**
     * O QUANTO o afixo desta raridade vale, em porcento.
     *
     * Fica no retorno com outro nome para nao se confundir com a chance.
     * Antes as duas coisas se chamavam `percent`, e era o que fazia o
     * painel mostrar uma no lugar da outra
     */
    power: Number((ENCHANT_POWER[raridade] * 100).toFixed(1)),
  }));
}