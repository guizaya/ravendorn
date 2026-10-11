import { statsForLevel } from "../progression/Levels.js";

/**
 * O PAINEL DE STATS: a folha do personagem.
 *
 * Esta e a UNICA coisa que sabe o que e um stat do jogo. Nem a
 * classe, nem o equipamento, nem o painel: eles so leem daqui. A
 * razao e a que apareceu quando os dois lados foram escritos
 * separados: o painel mostrava "ATQ 82" com uma conta e a HUD
 * mostrava "ATK 82" com outra, e o jogador nao sabia qual das duas
 * era o numero que o golpe realmente usava
 *
 * A folha tem TRES colunas, e a soma e sempre exata:
 *
 * - `base`: o que a classe entrega nua, no nivel 1
 * - `bonus`: tudo que veio de JOGAR — nivel, equipamento e cacadas
 * - `total`: a soma, que e o numero que o personagem tem hoje
 *
 * O bonus nao e lido de uma tabela solta: e `total - base`, com os
 * dois lados calculados pela MESMA formula. Assim `base + bonus`
 * fecha na tela sem ninguem ter de caringar dois numeros, e o painel
 * nao consegue mostrar um bonus que nao existe
 */

/**
 * Os cinco ATRIBUTOS.
 *
 * Sao os unicos cinco stats que o jogador aumenta por nivel sem
 * equipamento no meio. Os outros vinte sao consequences de atributos,
 * de classe ou de item — e por isso que eles aparecem como total e o
 * atributo que os move aparece logo acima
 */
export const ATTRIBUTE_IDS = Object.freeze([
  "str",
  "int",
  "dex",
  "vit",
  "wis",
]);

/** O stat e um dos cinco atributos? */
const isAttribute = (id) => ATTRIBUTE_IDS.includes(id);

/**
 * Os grupos do painel, na ordem em que o jogador le.
 *
 * A ordem e de leitura, nao de importancia: primeiro o que o
 * personagem E, depois o que ele DERA, depois quanto ele aguenta, e
 * por ultimo quanto ele GANHA por estar vivo. Botar as taxas no topo
 * faria o jogador comecar pelo que ele ainda nem tem
 */
export const STAT_GROUPS = Object.freeze([
  { id: "atributos", label: "Atributos" },
  { id: "combate", label: "Combate" },
  { id: "recursos", label: "Recursos" },
  { id: "progresso", label: "Progresso" },
]);

/**
 * Os 25 STATS, com o rotulo, a unidade e o grupo.
 *
 * O `id` de sete dos vinte eCinco e o MESMO campo que o motor ja
 * usa: `attack`, `defense`, `maxHp`, `maxResource`, `speed`,
 * `attackSpeed`, `critRate`, `critDamage` e `resourceRegen`. Isso e
 * deliberado: o bonus do equipamento ja vem escrito nesses nomes, e
 * um painel que usasse outros exigiria traduzir de um lado para o
 * outro — o lugar onde um stat vira "quase o mesmo numero" e o
 * jogador nunca descobre por que
 *
 * `unit` e o que decide a formatacao do numero na tela:
 *
 * - `integer`: um numero solto
 * - `percent`: fracao, mostrada como `12,5%`
 * - `perSecond`: ataques por segundo, mostrado como `1,42/s`
 * - `multiplier`: multiplicador, mostrado como `2,00x`
 */
export const STAT_DEFS = Object.freeze([
  // --- atributos ---
  /**
   * Os cinco atributos carregam `attribute: true`, e os outros vinte e
   * um nao. A marca e o que faz o painel(realce a linha) e o que faz
   * o `buildStatSheet` saber que a linha e o atributo e nao um
   * derivado — sem ela, "e atributo" viraria uma comparacao com a
   * lista em dois lugares, e um atributo novo entraria em um e nao no
   * outro
   */
  {
    id: "str",
    label: "STR",
    name: "Força",
    group: "atributos",
    unit: "integer",
    attribute: true,
  },
  {
    id: "int",
    label: "INT",
    name: "Inteligência",
    group: "atributos",
    unit: "integer",
    attribute: true,
  },
  {
    id: "dex",
    label: "DEX",
    name: "Destreza",
    group: "atributos",
    unit: "integer",
    attribute: true,
  },
  {
    id: "vit",
    label: "VIT",
    name: "Vigor",
    group: "atributos",
    unit: "integer",
    attribute: true,
  },
  {
    id: "wis",
    label: "WIS",
    name: "Sabedoria",
    group: "atributos",
    unit: "integer",
    attribute: true,
  },

  // --- combate ---
  {
    id: "attack",
    label: "ATK",
    name: "Ataque Físico",
    group: "combate",
    unit: "integer",
  },
  {
    id: "magicAttack",
    label: "MATK",
    name: "Ataque Mágico",
    group: "combate",
    unit: "integer",
  },
  {
    id: "defense",
    label: "DEF",
    name: "Defesa Física",
    group: "combate",
    unit: "integer",
  },
  {
    id: "magicDefense",
    label: "MDEF",
    name: "Defesa Mágica",
    group: "combate",
    unit: "integer",
  },
  {
    id: "accuracy",
    label: "ACC",
    name: "Precisão",
    group: "combate",
    unit: "integer",
  },
  {
    id: "evasion",
    label: "EVA",
    name: "Esquiva",
    group: "combate",
    unit: "percent",
  },
  {
    id: "critRate",
    label: "CRIT",
    name: "Chance de Crítico",
    group: "combate",
    unit: "percent",
  },
  {
    id: "critDamage",
    label: "CRIT DMG",
    name: "Dano de Crítico",
    group: "combate",
    unit: "multiplier",
  },
  {
    id: "penetration",
    label: "PEN",
    name: "Penetração",
    group: "combate",
    unit: "integer",
  },
  {
    id: "attackSpeed",
    label: "ASPD",
    name: "Velocidade de Ataque",
    group: "combate",
    unit: "perSecond",
  },
  {
    id: "movementSpeed",
    label: "MSPD",
    name: "Velocidade de Movimento",
    group: "combate",
    unit: "integer",
  },

  // --- recursos ---
  {
    id: "maxHp",
    label: "HP",
    name: "Pontos de Vida",
    group: "recursos",
    unit: "integer",
  },
  {
    id: "maxResource",
    label: "MP",
    name: "Pontos de Mana",
    group: "recursos",
    unit: "integer",
  },
  {
    id: "hpRegen",
    label: "HP Regen",
    name: "Regeneração de Vida",
    group: "recursos",
    unit: "integer",
  },
  {
    id: "resourceRegen",
    label: "MP Regen",
    name: "Regeneração de Mana",
    group: "recursos",
    unit: "integer",
  },

  // --- progresso ---
  {
    id: "xpGain",
    label: "EXP Gain",
    name: "Ganho de Experiência",
    group: "progresso",
    unit: "percent",
  },
  {
    id: "dropRate",
    label: "Drop Rate",
    name: "Chance de Drop",
    group: "progresso",
    unit: "percent",
  },
  {
    id: "goldGain",
    label: "Gold Gain",
    name: "Ganho de Ouro",
    group: "progresso",
    unit: "percent",
  },
  /*
    ## AS SIGLAS DESTES TRES

    Os de cima do grupo ja cabiam: "EXP Gain", "Drop Rate" e "Gold Gain" sao
    duas palavras curtas e a coluna do rotulo aguentava.

    Estes tres nao aguentavam. "Rare Drop Rate", "Equipment Drop Rate" e
    "Enhancement Success" sao tres palavras cada, e o mais longo deles —
    "Equipment Drop Rate" — era exatamente o que media onde a coluna parava de
    caber e comecava a cortar o texto com reticencias

    A sigla e o que resolve, e e o mesmo papel que a sigla cumpre em
    `STR`, `ATK` e `MATK`: o `name` continua com o texto inteiro para quem
    precisa dele, no `title` da linha e no tooltip

    ## POR QUE NAO ESCOLHI AS MESMAS PALAVRAS

    Porque "Raro", "Equip" e "Aprim." iam obrigar o jogador a traduzir a sigla
    de volta toda vez que lesse. Estas sao as palavras que o jogador JA USA
    quando fala do jogo: um drop raro e "raro", a peca que cai e "equip", e o
    +5 da aba e "aprimoramento". A sigla e o atalho para a palavra que ele ja
    diz em voz alta
  */
  {
    id: "rareDropRate",
    label: "Raro",
    name: "Chance de Drop Raro",
    group: "progresso",
    unit: "percent",
  },
  {
    id: "equipmentDropRate",
    label: "Equip",
    name: "Chance de Drop de Equipamento",
    group: "progresso",
    unit: "percent",
  },
  {
    id: "enhanceSuccess",
    label: "Aprim.",
    name: "Sucesso de Aprimoramento",
    group: "progresso",
    unit: "percent",
  },
]);

export const STAT_BY_ID = Object.freeze(
  Object.fromEntries(STAT_DEFS.map((def) => [def.id, def])),
);

const ZERO = Object.freeze({});

/**
 * O bonus com so numeros, e so numeros que finitos.
 *
 * O bonus vem de uma soma de dicionarios — equipamento e cacada — e
 * uma das fontes pode trazer texto: `attack: "dez"` de um item velho,
 * ou `Infinity` de uma conta malfeita. Sem esta limpeza o `NaN`
 * entrava na conta (`107 + "dez"` e `"107dez"`, e `"107dez" - 107`
 * e `NaN`) e as 26 linhas da folha viravam `NaN`. Uma linha ruim
 * derruba o painel inteiro, e nao so ela
 */
function bonusLimpo(bonus) {
  if (!bonus || typeof bonus !== "object") return ZERO;

  const saida = {};

  for (const [stat, valor] of Object.entries(bonus)) {
    const numero = Number(valor);

    if (Number.isFinite(numero) && numero !== 0) {
      saida[stat] = numero;
    }
  }

  return saida;
}

/**
 * O bonus de ATRIBUTOS dentro de um objeto de bonus qualquer.
 *
 * Equipamento e cacada falam a mesma língua: um objeto de
 * `{ stat: valor }`. Os cinco atributos sao stats como os outros, e
 * nao tinham motivo para ficar de fora
 */
function bonusDosAtributos(bonus) {
  const pontos = {};

  for (const id of ATTRIBUTE_IDS) {
    const valor = Number(bonus?.[id]);

    if (Number.isFinite(valor) && valor !== 0) {
      pontos[id] = valor;
    }
  }

  return pontos;
}

const attr = (atributos, id) => atributos?.[id] ?? 0;

/**
 * Os atributos de uma classe no NIVEL 1.
 *
 * E o que o painel chama de `base` de um atributo: a classe nua,
 * sem um ponto de nivel e sem uma peca vestida. Todo o resto do que
 * o atributo tem veio jogando
 */
export function baseAttributes(classDef) {
  const atributos = classDef?.attributes ?? ZERO;

  const saida = {};

  for (const id of ATTRIBUTE_IDS) {
    const valor = Number(attr(atributos, id));

    // `Number.isFinite` e nao `Math.max(0, ...)`: um `NaN` de um save
    // editado passaria pelo `Math.max` e viraria `NaN` na folha
    saida[id] = Number.isFinite(valor)
      ? Math.max(0, Math.round(valor))
      : 0;
  }

  return saida;
}

/**
 * Os atributos de uma classe no nivel `level`.
 *
 * O crescimento e por classe e nao uniforme de proposito: e o que
 * faz o Guerreiro virar tanque e o Sorcerer virar caster conforme
 * o nivel sobe, e nao so no nivel 1. Um jogador que compara duas
 * classes no nivel 30 precisa ver essa diferenca na folha
 */
export function attributesForLevel(classDef, level = 1) {
  const base = baseAttributes(classDef);
  const passos = nivelSeguro(level) - 1;
  const crescimento = classDef?.attributeGrowth ?? ZERO;

  const saida = {};

  for (const id of ATTRIBUTE_IDS) {
    const porNivel = Number(attr(crescimento, id));
    const passo = Number.isFinite(porNivel)
      ? Math.max(0, Math.round(porNivel))
      : 0;

    saida[id] = base[id] + passos * passo;
  }

  return saida;
}

/**
 * Os stats que o MOTOR calcula, e o campo onde ele grava.
 *
 * A folha nao refaz a conta desses cinco: ela recebe o numero que o
 * `applyEquipment` ja escreveu no jogador e mostra esse. Sao duas
 * contas no mesmo projeto, e so uma pode estar certa
 *
 * O caso que isso cobre e real: o servidor nao roda `applyEquipment`
 * ao entrar, entao o `player.attack` de quem acabou de logar e o valor
 * cru da classe, enquanto no offline ele ja passou pelo crescimento
 * do nivel 1. Uma folha que recalculasse mostraria 107 para quem o
 * motor esta usando como 104 — e o jogador nao teria como descobrir
 * qual dos dois e o que o golpe usa
 */
export const ENGINE_STAT_FIELD = Object.freeze({
  attack: "attack",
  defense: "defense",
  maxHp: "maxHp",
  maxResource: "maxResource",
  movementSpeed: "speed",
});

/**
 * O VALOR de um stat, num nivel, com uns atributos e um bonus.
 *
 * A funcao tem tres metades, e a divisao e o que garante que a coluna
 * `base` da tela seja verdade:
 *
 * 1. Os stats que o MOTOR USA sao calculados exatamente como o
 *    `applyEquipment` calcula. Quando o chamador passa `atuais`, o
 *    numero do motor tem a precedencia
 *
 * 2. Os stats que o motor guarda mas NINGUEM CONSOME ainda —
 *    `attackSpeed`, `critRate`, `critDamage` e `resourceRegen` — sao
 *    a soma da classe com o bonus. Sao a folha de personagem, e nao
 *    uma promessa de combate
 *
 * 3. Os stats que o motor ainda NAO USA sao calculados aqui a partir
 *    dos atributos
 *
 * Chamar com `level` e `bonus` de quem jogou e o caminho do `total`;
 * chamar com nivel 1 e sem bonus da o `base`
 */
function statValue(def, { classDef, level, atributos, bonus }) {
  const stats = classDef?.stats ?? ZERO;
  const growth = statsForLevel(level);
  const b = bonus ?? ZERO;

  // 1. os stats que o motor usa
  switch (def.id) {
    case "attack":
      return (
        (stats.attack ?? 0) +
        (growth.attack ?? 0) +
        (b.attack ?? 0)
      );

    case "defense":
      return (
        (stats.defense ?? 0) +
        (growth.defense ?? 0) +
        (b.defense ?? 0)
      );

    case "maxHp":
      return (
        (stats.hp ?? 0) +
        (growth.maxHp ?? 0) +
        (b.maxHp ?? 0)
      );

    /**
     * O motor le `bonus.resource`, e nao `bonus.maxResource`. Os dois
     * nomes sao aceitos aqui porque o item pode declarar qualquer um
     * dos dois e o jogador nao pode ver o stat dele mudar de nome
     */
    case "maxResource":
      return (
        (stats.resource ?? 0) +
        (b.maxResource ?? b.resource ?? 0)
      );

    case "movementSpeed":
      return (stats.speed ?? 0) + (b.speed ?? 0);

    case "attackSpeed":
      return (stats.attackSpeed ?? 0) + (b.attackSpeed ?? 0);

    case "critRate":
      return (stats.critRate ?? 0) + (b.critRate ?? 0);

    case "critDamage":
      return (stats.critDamage ?? 0) + (b.critDamage ?? 0);

    case "resourceRegen":
      return (stats.resourceRegen ?? 0) + (b.resourceRegen ?? 0);

    default:
      break;
  }

  // 2. os atributos
  //
  // O `atributos` que chega aqui JA tem os pontos de item e de cacada
  // somados (e o `buildStatSheet` que fez isso). Somar `b[def.id]`
  // aqui de novo contaria o mesmo ponto duas vezes, e o VIT do
  // jogador subia 10 quando a peca dava 5
  if (isAttribute(def.id)) {
    return attr(atributos, def.id);
  }

  // 3. os derivados dos atributos
  switch (def.id) {
    case "magicAttack":
      return (
        Math.round(attr(atributos, "int") * 2.6 + attr(atributos, "wis") * 0.9) +
        Math.round(level * 2.2) +
        (b.magicAttack ?? 0)
      );

    case "magicDefense":
      return (
        Math.round(
          attr(atributos, "wis") * 1.7 +
            attr(atributos, "int") * 0.8 +
            attr(atributos, "vit") * 0.4,
        ) +
        Math.round(level * 1.1) +
        (b.magicDefense ?? 0)
      );

    case "accuracy":
      return (
        Math.round(attr(atributos, "dex") * 3.2 + 40) +
        Math.round(level * 2.5) +
        (b.accuracy ?? 0)
      );

    case "evasion":
      return (
        0.02 +
        attr(atributos, "dex") * 0.0035 +
        (b.evasion ?? 0)
      );

    case "penetration":
      return (
        Math.round(
          attr(atributos, "str") * 1.4 + attr(atributos, "dex") * 0.5,
        ) +
        Math.round(level * 0.8) +
        (b.penetration ?? 0)
      );

    case "hpRegen":
      return (
        Math.round(1 + attr(atributos, "vit") * 0.35) +
        Math.round(level * 0.25) +
        (b.hpRegen ?? 0)
      );

    case "xpGain":
      return Math.round(level * 0.15) / 100 + (b.xpGain ?? 0);

    case "dropRate":
      return (
        attr(atributos, "dex") * 0.0025 + (b.dropRate ?? 0)
      );

    case "goldGain":
      return (
        attr(atributos, "wis") * 0.0022 + (b.goldGain ?? 0)
      );

    case "rareDropRate":
      return (
        attr(atributos, "wis") * 0.0012 +
        (b.rareDropRate ?? 0)
      );

    case "equipmentDropRate":
      return (
        attr(atributos, "int") * 0.001 +
        (b.equipmentDropRate ?? 0)
      );

    case "enhanceSuccess":
      return (
        0.05 + attr(atributos, "wis") * 0.0025 + (b.enhanceSuccess ?? 0)
      );

    default:
      return 0;
  }
}

/**
 * Um nivel que da para usar.
 *
 * O nivel vem do save e de um `Math.floor` no caminho do level-up, e
 * um arquivo editado a mao pode trazer `null`, `NaN` ou negativo.
 * `Math.max(1, Math.floor(NaN))` devolve `NaN` — e `NaN` passa
 * direto para as 26 linhas da folha, o que faria o painel inteiro
 * mostrar "NaN" por causa de um so numero quebrado
 */
function nivelSeguro(level) {
  const numero = Math.floor(Number(level));

  if (!Number.isFinite(numero) || numero < 1) return 1;

  return Math.floor(numero);
}

/**
 * A folha completa do personagem.
 *
 * `rows` sai na ordem do painel, ja com `base`, `bonus` e `total`
 * resolvidos e com a soma fechando. E o que o painel desenha e o que
 * o motor guarda no `player.stats`
 *
 * `atuais` sao os numeros que o motor ja gravou no jogador. Passa-los
 * e o que impede a folha de ser uma segunda conta: sem isso, o
 * painel mostraria um ATK calculado aqui e o golpe usaria outro
 */
export function buildStatSheet(
  classDef,
  level = 1,
  bonus = ZERO,
  atuais = null,
) {
  const nivel = nivelSeguro(level);

  const bonusNum = bonusLimpo(bonus);

  const atributosBase = baseAttributes(classDef);
  const atributosFinais = attributesForLevel(classDef, nivel);

  // pontos de atributo dados por item ou cacada
  const pontos = bonusDosAtributos(bonusNum);

  for (const id of ATTRIBUTE_IDS) {
    /**
     * Soma SO o atributo que tem ponto.
     *
     * `atributos[id] += pontos[id]` sem este `if` somaria
     * `undefined` nos outros quatro: uma peca de +5 VIT viraria
     * `undefined` no STR e o stat inteiro daquele personagem viraria
     * `NaN` na tela — o painel inteiro quebrado por causa de um
     * item so
     */
    if (typeof pontos[id] === "number") {
      atributosFinais[id] += pontos[id];
    }
  }

  const ctxBase = {
    classDef,
    level: 1,
    atributos: atributosBase,
    bonus: ZERO,
  };

  const ctxTotal = {
    classDef,
    level: nivel,
    atributos: atributosFinais,
    bonus: bonusNum,
  };

const rows = STAT_DEFS.map((def) => {
    const base = statValue(def, ctxBase);

    const campo = ENGINE_STAT_FIELD[def.id];
    const bruto = campo ? atuais?.[campo] : undefined;

    /**
     * O numero do motor quando ele e um numero, e a conta da folha
     * quando nao e.
     *
     * O teste e `typeof === "number"`, e nao `Number.isFinite(Number(x))`:
     * `Number("104")` da 104, e aceitar isso deixaria um campo que
     * virou texto em algum lugar virar um stat silenciosamente. O
     * motor escreve numero; o que vier de outro tipo e um dado
     * estranho, e a folha prefere calcular por conta propria a
     * mostrar um valor que ninguem rastreou
     */
    const total =
      typeof bruto === "number" && Number.isFinite(bruto)
        ? bruto
        : statValue(def, ctxTotal);

    return {
      id: def.id,
      label: def.label,
      name: def.name,
      group: def.group,
      unit: def.unit,
      attribute: Boolean(def.attribute),
      base,
      bonus: total - base,
      total,
    };
  });

  const porId = Object.fromEntries(
    rows.map((row) => [row.id, row]),
  );

  return {
    level: nivel,
    attributes: atributosFinais,
    rows,
    byId: porId,

    /**
     * O mesmo objeto, agrupado, na ordem do painel.
     *
     * Calcular a ordem no componente faria cada painel ter a sua
     * versao da ordem, e o dia que um deles precisar de uma coluna a
     * mais as duas tabelas divergem sem nenhum teste avisar
     */
    groups: STAT_GROUPS.map((group) => ({
      ...group,
      rows: rows.filter((row) => row.group === group.id),
    })).filter((group) => group.rows.length > 0),
  };
}

/** O valor de UM stat da folha, ou `null` se o id nao existe. */
export function statValueOf(sheet, id) {
  return sheet?.byId?.[id]?.total ?? null;
}

/**
 * As STATS de um dicionario de bonus, ja com rotulo e texto.
 *
 * E o que o painel de colecao desenha e o que o aviso de entrega
 * escreve. A ordem sai do CATALOGO e nao do objeto: um `{ zzz: 1,
 * atk: 2 }` escrito a mao viraria a lista na ordem em que as
 * chaves foram digitadas, e o jogador leria a recompensa em ordem
 * alfabetica em uma colecao
 *
 * As entradas com valor zero saem. Um `+0 ATK` numa entrega e o
 * jogador procurando por que ele nao subiu de nivel
 */
export function statBonusEntries(bonus, { todos = false } = {}) {
  if (!bonus || typeof bonus !== "object") return [];

  const entradas = [];

  for (const def of STAT_DEFS) {
    const valor = Number(bonus[def.id]);

    /**
     * `todos` E O MODO DA TABELA COMPLETA.
     *
     * Sem ele, um stat que o jogador nao tem fica de fora da lista, e a
     * lista cresce so com o que ele ja ganhou. E o certo no card da
     * entrega, onde o que importa e o que DA para receber
     *
     * No painel do bonus permanente e o contrario: o jogador quer ver a
     * ficha inteira, os 26 stats, para saber o que ainda nao tem. Sem o
     * modo, ele veria uma lista de duas linhas e nao teria como saber se
     * aquilo era tudo ou so o que ele achou
     */
    const semValor = !Number.isFinite(valor) || valor === 0;

    if (semValor && !todos) continue;

    const texto = semValor ? "—" : formatBonus(def, valor);

    if (!texto) continue;

    entradas.push({
      id: def.id,
      label: def.label,
      name: def.name,
      unit: def.unit,
      value: Number.isFinite(valor) ? valor : 0,
      zero: semValor,
      text: texto,
      /** `+2 VIT` — o texto curto do aviso */
      short: semValor ? `— ${def.label}` : `${texto} ${def.label}`,
    });
  }

  return entradas;
}

/** Uma frase com todas as stats de um bonus, para o aviso de entrega. */
export function describeStatBonus(bonus) {
  const entradas = statBonusEntries(bonus);

  if (entradas.length === 0) return "";

  return entradas.map((entrada) => entrada.short).join(" · ");
}

/**
 * Um numero de stat na tela.
 *
 * A unidade decide o formato, e o numero so e arredondado no fim: os
 * bonuses de drop e de esquiva sao fracoes de fracao, e arredondar no
 * meio do caminho faria dois bonuses de 0,4% virarem "0%"
 */
export function formatStat(def, value) {
  const numero = Number.isFinite(value) ? value : 0;

  switch (def?.unit) {
    case "percent":
      return `${formatPercent(numero)}%`;

    case "multiplier":
      return `${numero.toFixed(2).replace(".", ",")}x`;

    case "perSecond":
      return `${numero.toFixed(2).replace(".", ",")}/s`;

    default:
      return String(Math.round(numero));
  }
}

/** O bonus de um stat, ja com o `+` e o zero escondido. */
export function formatBonus(def, value) {
  const numero = Number.isFinite(value) ? value : 0;

  if (Math.abs(numero) < 0.0001) return "";

  const sinal = numero > 0 ? "+" : "";

  switch (def?.unit) {
    case "percent":
      return `${sinal}${formatPercent(numero)}%`;

    case "multiplier":
      return `${sinal}${numero.toFixed(2).replace(".", ",")}`;

    case "perSecond":
      return `${sinal}${numero.toFixed(2).replace(".", ",")}/s`;

    default:
      return `${sinal}${Math.round(numero)}`;
  }
}

const formatPercent = (fracao) =>
  (fracao * 100)
    .toFixed(1)
    .replace(".", ",")
    .replace(/,0$/, "");