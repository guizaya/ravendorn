import { createAction, SKILL_PACKS } from "../skills/index.js";

function basicAttack({
  classId,
  damage,
  type = "cone",
  range,
  cooldown,
  damageType = "physical",
  resourceCost = 0,
  projectileSpeed = 0,
  projectileStyle,
  lifesteal = 0,
  effects = [],
}) {
  return createAction("Basic Attack", type, {
    id: `${classId}_basic_attack`,
    name: "Ataque Básico",
    icon: "ATK",
    description: "Ataque básico da classe.",
    damage,
    damageType,
    cooldown,
    range,
    radius: type === "line" ? 45 : 0,
    angle: 1.65,
    resourceCost,
    projectileSpeed,
    projectileStyle,
    lifesteal,
    effects,
    impactRadius: type === "projectile" ? 60 : 0,
    color: "#ffffff",
  });
}

const warrior = {
  id: "warrior",
  name: "Warrior",
  icon: "⚔️",
  accent: "#ef5350",
  tagline: "Linha de frente, controle e resistência",
  description:
    "Combatente pesado que permanece na linha de frente, protege aliados e usa força física para controlar grupos.",
  role: "Tank / Frontline / Controle",
  combatType: "Corpo a corpo e controle de área",
  rangeLabel: "Curto",
  damageType: "Físico",
  playstyle:
    "Avançar primeiro, encaixar habilidades de área, manter postura defensiva e contra-atacar.",
  mechanic: {
    name: "Postura de ferro",
    description:
      "Combina resistência, escudos, controle de posicionamento e contra-ataques.",
  },
  characteristics: [
    "Vida e defesa elevadas",
    "Alta resistência a controle",
    "Dano físico médio",
    "Baixa mobilidade",
    "Forte controle de grupo",
  ],
  strengths: [
    "Sobrevive à frente",
    "Excelente AoE",
    "Stun, pull e knockback",
    "Boa proteção contra grupos",
  ],
  weaknesses: [
    "Pouca velocidade",
    "Alcance curto",
    "Depende de posicionamento",
  ],
  stats: {
    hp: 1400,
    resource: 100,
    attack: 82,
    defense: 42,
    speed: 165,
    attackSpeed: 0.85,
    critRate: 0.1,
    critDamage: 1.5,
    range: 105,
    resourceRegen: 9,
  },
  /**
   * Os CINCO atributos do Guerreiro, e o quanto cada um sobe por
   * nivel.
   *
   * O Guerreiro e o tanque: VIT e STR sao os dois maiores e sao os que
   * mais sobem. E o que faz a folha dele nao ser a do Lancer com
   * numeros trocados — os dois comecam perto, mas aos 30 o Guerreiro
   * aguenta o triplo e o Lancer nao
   *
   * E o que a folha de stats le: `game/stats/StatSheet.js`. O
   * atributo nao entra direto em combate ainda, ele move MATK, MDEF,
   * PEN, ACC, EVA e as taxas — e por isso que ele aparece na tela
   */
  attributes: {
    str: 18,
    int: 7,
    dex: 11,
    vit: 20,
    wis: 8,
  },
  attributeGrowth: { str: 2, int: 1, dex: 1, vit: 3, wis: 1 },
  resource: {
    name: "Chi",
    color: "#ff6b57",
  },
  basicAttack: basicAttack({
    classId: "warrior",
    damage: 82,
    range: 115,
    cooldown: 1 / 0.85,
  }),
  ...SKILL_PACKS.warrior,
};

const lancer = {
  id: "lancer",
  name: "Lancer",
  icon: "🔱",
  accent: "#52c7ff",
  tagline: "Entrar, controlar e reposicionar",
  description:
    "Bruiser móvel que combina estocadas longas, investidas e ataques de área para entrar e sair do combate.",
  role: "Bruiser / DPS / Controle / Mobilidade",
  combatType: "Corpo a corpo alongado e investidas",
  rangeLabel: "Curto a médio",
  damageType: "Físico",
  playstyle:
    "Usar alcance para golpear, dash para entrar, controlar o alvo e reposicionar antes do contra-ataque.",
  mechanic: {
    name: "Fluxo de combate",
    description:
      "A) Atacar com média distância  B) Controlar  C) Recuperar espaço com dash.",
  },
  characteristics: [
    "Alcance maior que Warrior",
    "Boa velocidade",
    "Dano físico consistente",
    "Defesa média",
    "Dash perfurante",
  ],
  strengths: [
    "Mobilidade",
    "Alcance médio",
    "Combo de três golpes",
    "Roubo de vida",
  ],
  weaknesses: [
    "Menos resistente que Warrior",
    "Depende de acertar investidas",
    "Sem proteção extrema",
  ],
  stats: {
    hp: 1050,
    resource: 110,
    attack: 90,
    defense: 30,
    speed: 220,
    attackSpeed: 1.15,
    critRate: 0.14,
    critDamage: 1.65,
    range: 180,
    resourceRegen: 12,
  },
  /**
   * O Lancer e o bruiser movel: DEX e o atributo maior e o que mais
   * sobe, com VIT logo atras por causa do dash atravessa o grupo.
   * Menos VIT que o Guerreiro e mais DEX e STR, que e o que faz ele
   * entrar e sair sem dying
   */
  attributes: {
    str: 16,
    int: 9,
    dex: 15,
    vit: 13,
    wis: 9,
  },
  attributeGrowth: { str: 2, int: 1, dex: 3, vit: 2, wis: 1 },
  resource: {
    name: "Foco",
    color: "#66d8ff",
  },
  basicAttack: basicAttack({
    classId: "lancer",
    damage: 90,
    type: "line",
    range: 180,
    cooldown: 1 / 1.15,
  }),
  ...SKILL_PACKS.lancer,
};

const sorcerer = {
  id: "sorcerer",
  name: "Sorcerer",
  icon: "🔮",
  accent: "#ad70ff",
  tagline: "Dano elemental à distância",
  description:
    "Mage de alto dano mágico, áreas elementais e controle, especialmente perigosa quando mantém distância.",
  role: "Mage / Ranged DPS / AoE / Controle",
  combatType: "Projéteis elementais e tempestades",
  rangeLabel: "Longo",
  damageType: "Mágico elemental",
  playstyle:
    "Manter distância, aplicar elementos em sequência e usar campos de área antes de ser cercada.",
  mechanic: {
    name: "Reação elemental",
    description:
      "Fogo, gelo, tempestade, trevas e veneno podem receber sinergias futuras.",
  },
  characteristics: [
    "Maior dano mágico",
    "Longo alcance",
    "Excelente AoE",
    "Baixa defesa",
    "Mana como recurso",
  ],
  strengths: [
    "Dano à distância",
    "Controle em área",
    "Slow e pull",
    "Esquiva de projéteis",
  ],
  weaknesses: [
    "Frágil em corpo a corpo",
    "Consumo elevado de Mana",
    "Precisa manter distância",
  ],
  stats: {
    hp: 680,
    resource: 210,
    attack: 112,
    defense: 16,
    speed: 195,
    attackSpeed: 0.9,
    critRate: 0.12,
    critDamage: 1.6,
    range: 400,
    resourceRegen: 13,
  },
  /**
   * O Sorcerer e o caster: INT e WIS lideram de longe e sao os que
   * mais sobem. E o unico da lista com INT no topo, e e por isso que
   * o MATK dele e o maior do jogo enquanto a DEF e a menor
   */
  attributes: {
    str: 8,
    int: 21,
    dex: 11,
    vit: 9,
    wis: 17,
  },
  attributeGrowth: { str: 1, int: 3, dex: 2, vit: 1, wis: 2 },
  resource: {
    name: "Mana",
    color: "#b87aff",
  },
  basicAttack: basicAttack({
    classId: "sorcerer",
    damage: 112,
    type: "projectile",
    range: 430,
    projectileSpeed: 430,
    damageType: "magic",
    projectileStyle: "fire",
    cooldown: 1 / 0.9,
  }),
  ...SKILL_PACKS.sorcerer,
};

const arbalist = {
  id: "arbalist",
  name: "Arbalist",
  icon: "🏹",
  accent: "#8ed081",
  tagline: "Dano físico, crítico e mobilidade",
  description:
    "Especialista em manter distância, disparos rápidos, crítico, veneno e reposicionamento ofensivo.",
  role: "Ranged DPS / Crit / Mobilidade",
  combatType: "Disparos de longa distância",
  rangeLabel: "Muito longo",
  damageType: "Físico",
  playstyle:
    "Atacar, reposicionar, dashar para longe ou entrar para burst e voltar à distância.",
  mechanic: {
    name: "Cycle de distância",
    description:
      "A) Atacar  B) Reposicionar  C) Dash  D) Atacar novamente.",
  },
  characteristics: [
    "Alto dano físico",
    "Crítico elevado",
    "Disparo rápido",
    "Longo alcance",
    "Baixa resistência",
  ],
  strengths: [
    "Crítico",
    "Alcance",
    "Cloaking",
    "Veneno",
    "Dash ofensivo",
  ],
  weaknesses: [
    "Pouca resistência",
    "Vulnerável se cercada",
    "Depende de reposicionar",
  ],
  stats: {
    hp: 700,
    resource: 125,
    attack: 104,
    defense: 18,
    speed: 230,
    attackSpeed: 1.4,
    critRate: 0.25,
    critDamage: 2,
    range: 520,
    resourceRegen: 10,
  },
  /**
   * A Arbalist e a critista: DEX e o maior atributo e o que mais sobe,
   * com WIS em segundo porque veneno e dash dependem de saber a hora.
   * STR e VIT sao os mais baixos das quatro classes, e e por isso que
   * ela morre primeiro se alguem chegar perto
   */
  attributes: {
    str: 13,
    int: 11,
    dex: 18,
    vit: 11,
    wis: 12,
  },
  attributeGrowth: { str: 2, int: 1, dex: 3, vit: 2, wis: 2 },
  resource: {
    name: "Foco",
    color: "#95e489",
  },
  basicAttack: basicAttack({
    classId: "arbalist",
    damage: 104,
    type: "projectile",
    range: 550,
    projectileSpeed: 720,
    projectileStyle: "arrow",
    cooldown: 1 / 1.4,
  }),
  ...SKILL_PACKS.arbalist,
};

/**
 * As quatro classes do jogo.
 *
 * Sao estas, e nao mais: `taoist`, `darkist`, `lionheart` e
 * `summoner` saíram, e sairam junto com o skill pack, o sprite e a
 * arte de cada uma. A ordem e a de aparicao na tela de selecao.
 */
export const CHARACTER_CLASSES = Object.freeze([
  warrior,
  lancer,
  sorcerer,
  arbalist,
]);

export function getCharacterDefinition(id) {
  return CHARACTER_CLASSES.find((character) => character.id === id) ?? null;
}
