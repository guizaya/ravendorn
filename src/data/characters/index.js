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

const taoist = {
  id: "taoist",
  name: "Taoist",
  icon: "☯️",
  accent: "#f2d46d",
  tagline: "Dano, controle e suporte",
  description:
    "Classe equilibrada que alterna cura, campos protetores, controle posicional e dano mágico.",
  role: "Suporte / Healer / Controle / DPS híbrido",
  combatType: "Mágico, campos e projéteis",
  rangeLabel: "Médio a longo",
  damageType: "Mágico / Holy",
  playstyle:
    "Alternar entre dano, controle, campos de proteção e cura conforme a situação.",
  mechanic: {
    name: "Equilíbrio Yin-Yang",
    description:
      "Campos podem ser expandidos futuramente para aliados, inimigos e zonas persistentes.",
  },
  characteristics: [
    "Cura a si mesmo e em grupo",
    "Buffs e defesas",
    "Controle por pull",
    "Dano mágico médio",
    "Mobilidade moderada",
  ],
  strengths: [
    "Sustain",
    "Controle de grupo",
    "Versatilidade",
    "Proteção de área",
  ],
  weaknesses: [
    "Dano inicial menor",
    "Precisa gerenciar Qi",
    "Menos resistente que um tank",
  ],
  stats: {
    hp: 820,
    resource: 150,
    attack: 72,
    defense: 24,
    speed: 205,
    attackSpeed: 1,
    critRate: 0.1,
    critDamage: 1.5,
    range: 320,
    resourceRegen: 11,
  },
  resource: {
    name: "Qi",
    color: "#f8dc75",
  },
  basicAttack: basicAttack({
    classId: "taoist",
    damage: 72,
    type: "projectile",
    range: 350,
    projectileSpeed: 430,
    damageType: "magic",
    projectileStyle: "orb",
    cooldown: 1,
  }),
  ...SKILL_PACKS.taoist,
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

const darkist = {
  id: "darkist",
  name: "Darkist",
  icon: "🩸",
  accent: "#ec4e75",
  tagline: "Veneno, maldição e pressão contínua",
  description:
    "Debuffer que combina DoT, veneno, maldições, controle e roubo de vida para vencer pela pressão progressiva.",
  role: "Debuffer / DoT / Poison / Controle",
  combatType: "Projéteis, campos e maldições",
  rangeLabel: "Médio a longo",
  damageType: "Sombrio / Venenoso",
  playstyle:
    "Aplicar veneno, reduzir resistência, manter o alvo amaldiçoado e recuperar sustain com Chain of Blood.",
  mechanic: {
    name: "Pressão progressiva",
    description:
      "Poison + Curse + DoT + Debuff causam dano e reduzem a capacidade de resposta do alvo.",
  },
  characteristics: [
    "Poison e DoT",
    "Aumenta dano recebido",
    "Roubo de vida",
    "Controle de grupo",
    "Transformação Asura",
  ],
  strengths: [
    "Dano ao longo do tempo",
    "Debuffs empilháveis",
    "Sustain por Chain of Blood",
    "Transformação",
  ],
  weaknesses: [
    "Dano instantâneo moderado",
    "Precisa aplicar efeitos",
    "Frágil em combate direto",
  ],
  stats: {
    hp: 780,
    resource: 160,
    attack: 78,
    defense: 20,
    speed: 210,
    attackSpeed: 1.05,
    critRate: 0.12,
    critDamage: 1.6,
    range: 360,
    resourceRegen: 9,
  },
  resource: {
    name: "Essência Sombria",
    color: "#ef5f7f",
  },
  basicAttack: basicAttack({
    classId: "darkist",
    damage: 78,
    type: "projectile",
    range: 390,
    projectileSpeed: 480,
    damageType: "magic",
    projectileStyle: "poison",
    cooldown: 1 / 1.05,
    effects: [
      {
        type: "poison",
        duration: 4,
        value: 6,
        tickInterval: 1,
      },
    ],
  }),
  ...SKILL_PACKS.darkist,
};

const lionheart = {
  id: "lionheart",
  name: "Lionheart",
  icon: "🦁",
  accent: "#ffb84d",
  tagline: "Combate próximo com sustain e reflexão",
  description:
    "Fighter estável e bruiser que permanece no combate através de cura, escudos, combos e reflexão de dano.",
  role: "Fighter / Bruiser / Sustain",
  combatType: "Corpo a corpo e reflexão",
  rangeLabel: "Curto",
  damageType: "Físico / Lightning",
  playstyle:
    "Entrar com dash, encadear combos, manter pressão e usar barreiras para absorver o contra-ataque.",
  mechanic: {
    name: "Coração de predador",
    description:
      "Cura, escudo e reflexão permitem sustentação longa durante o combate.",
  },
  characteristics: [
    "Alto sustain",
    "Bom dano físico",
    "Defesa média-alta",
    "Reflexão",
    "Combos rápidos",
  ],
  strengths: [
    "Curar em combate",
    "Reflexão",
    "Combo de quatro golpes",
    "Pressão alta",
  ],
  weaknesses: [
    "Alcance curto",
    "Gasto de Vigor",
    "Menos controle de grupo que Warrior",
  ],
  stats: {
    hp: 1250,
    resource: 120,
    attack: 96,
    defense: 38,
    speed: 205,
    attackSpeed: 1.1,
    critRate: 0.15,
    critDamage: 1.7,
    range: 100,
    resourceRegen: 8,
  },
  resource: {
    name: "Vigor",
    color: "#ffbb59",
  },
  basicAttack: basicAttack({
    classId: "lionheart",
    damage: 96,
    range: 110,
    cooldown: 1 / 1.1,
    lifesteal: 0.08,
  }),
  ...SKILL_PACKS.lionheart,
};

const summoner = {
  id: "summoner",
  name: "Spirit Summoner",
  icon: "🐉",
  accent: "#70e6cf",
  tagline: "Espíritos elementais e controle",
  description:
    "Invocador que utiliza espíritos de Luz, Água, Terra, Vento, Fogo, Floresta e Trevas para atacar e controlar.",
  role: "Summoner / Mage / Support / Control",
  combatType: "Espíritos, projéteis e campos",
  rangeLabel: "Médio a longo",
  damageType: "Mágico elemental",
  playstyle:
    "Alternar espíritos, controlar grupos, proteger-se com deslocamento e usar ataques concentrados.",
  mechanic: {
    name: "Vínculo espiritual",
    description:
      "A estrutura permite que um único espiritual ativo evolua para gerenciamento de múltiplas invocações.",
  },
  characteristics: [
    "Controle por espíritos",
    "Dano mágico médio",
    "Mobilidade",
    "Suporte",
    "Recurso de MP",
  ],
  strengths: [
    "Controle",
    "Dash",
    "Cura e recuperação",
    "Projéteis perseguidores",
    "Futuro gerenciável de invocações",
  ],
  weaknesses: [
    "Dano inicial moderado",
    "Depende de trocar elementos",
    "Defesa baixa",
  ],
  stats: {
    hp: 820,
    resource: 190,
    attack: 88,
    defense: 22,
    speed: 215,
    attackSpeed: 1,
    critRate: 0.1,
    critDamage: 1.55,
    range: 340,
    resourceRegen: 12,
  },
  resource: {
    name: "MP",
    color: "#70e6cf",
  },
  basicAttack: basicAttack({
    classId: "summoner",
    damage: 88,
    type: "projectile",
    range: 380,
    projectileSpeed: 470,
    damageType: "magic",
    projectileStyle: "spirit",
    cooldown: 1,
  }),
  ...SKILL_PACKS.summoner,
};

export const CHARACTER_CLASSES = Object.freeze([
  warrior,
  lancer,
  taoist,
  sorcerer,
  arbalist,
  darkist,
  lionheart,
  summoner,
]);

export function getCharacterDefinition(id) {
  return CHARACTER_CLASSES.find((character) => character.id === id) ?? null;
}
