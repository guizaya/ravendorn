import { RARITY_ORDER } from "../items/index.js";

export const QUEST_TYPE = {
  HUNT: "hunt",
  KILL: "kill",
  EQUIP: "equip",
  LEVEL: "level",
};

export const QUEST_SCOPE = {
  MAIN: "main",
  SIDE: "side",
};

export const AUTO_TYPES = new Set([
  QUEST_TYPE.HUNT,
  QUEST_TYPE.KILL,
]);

export function isAutoCompletable(quest) {
  return Boolean(quest) && AUTO_TYPES.has(quest.type);
}

export const MAIN_QUESTS = [
  {
    id: "main_brejo",
    name: "Primeiros Passos",
    type: QUEST_TYPE.HUNT,
    location: "brejo",
    target: "slime",
    count: 4,
    summary: "Vá ao Brejo Lento e mate 4 limos",
    rewards: { coins: 40, xp: 30, items: [] },
  },
  {
    id: "main_toca",
    name: "Cacos do Brejo",
    type: QUEST_TYPE.KILL,
    target: "rat",
    count: 6,
    summary: "Elimine 6 ratos",
    rewards: { coins: 80, xp: 70, items: [] },
  },
  {
    id: "main_equip_raro",
    name: "Ferramenta Boa",
    type: QUEST_TYPE.EQUIP,
    rarity: "rare",
    summary: "Equipe um item raro ou melhor",
    rewards: {
      coins: 120,
      xp: 110,
      items: [{ itemId: "ashen_band", count: 1 }],
    },
  },
  {
    id: "main_nivel_5",
    name: "Ganho de Postura",
    type: QUEST_TYPE.LEVEL,
    count: 5,
    summary: "Alcance o nível 5",
    rewards: { coins: 150, xp: 0, items: [] },
  },
  {
    id: "main_goblins",
    name: "Caçada aos Goblins",
    type: QUEST_TYPE.HUNT,
    location: "acampamento",
    target: "goblin",
    count: 8,
    summary: "Vá ao Acampamento Goblin e mate 8 goblins",
    rewards: {
      coins: 260,
      xp: 240,
      items: [{ itemId: "goblin_dagger", count: 1 }],
    },
  },
  {
    id: "main_equip_epico",
    name: "Relíquia Profana",
    type: QUEST_TYPE.EQUIP,
    rarity: "epic",
    summary: "Equipe um item épico ou melhor",
    rewards: { coins: 420, xp: 0, items: [] },
  },
  {
    id: "main_nivel_10",
    name: "Veterano do Vale",
    type: QUEST_TYPE.LEVEL,
    count: 10,
    summary: "Alcance o nível 10",
    rewards: { coins: 600, xp: 0, items: [] },
  },
  {
    id: "main_cripta",
    name: "Cripta Esquelética",
    type: QUEST_TYPE.HUNT,
    location: "cripta",
    target: "skeleton",
    count: 10,
    summary: "Vá à Cripta e mate 10 esqueletos",
    rewards: {
      coins: 900,
      xp: 800,
      items: [{ itemId: "skeleton_blade", count: 1 }],
    },
  },
];

export const SIDE_QUESTS = [
  {
    id: "side_brejo",
    name: "Limpeza no Brejo",
    type: QUEST_TYPE.HUNT,
    location: "brejo",
    target: "slime",
    count: 10,
    summary: "Vá ao Brejo e abata 10 limos",
    rewards: {
      coins: 90,
      xp: 80,
      items: [{ itemId: "slime_core", count: 3 }],
    },
  },
  {
    id: "side_ratos",
    name: "Praga de Ratos",
    type: QUEST_TYPE.HUNT,
    location: "toca",
    target: "rat",
    count: 12,
    summary: "Vá à Toca e abata 12 ratos",
    rewards: {
      coins: 120,
      xp: 110,
      items: [{ itemId: "rat_pelt", count: 4 }],
    },
  },
  {
    id: "side_goblins",
    name: "Saqueadores",
    type: QUEST_TYPE.HUNT,
    location: "acampamento",
    target: "goblin",
    count: 8,
    summary: "Vá ao Acampamento e abata 8 goblins",
    rewards: {
      coins: 200,
      xp: 190,
      items: [{ itemId: "goblin_cloth", count: 6 }],
    },
  },
  {
    id: "side_ghouls",
    name: "Fome Antiga",
    type: QUEST_TYPE.HUNT,
    location: "ruinas",
    target: "ghoul",
    count: 8,
    summary: "Vá às Ruínas e abata 8 ghouls",
    rewards: {
      coins: 280,
      xp: 260,
      items: [{ itemId: "ghoul_claw", count: 5 }],
    },
  },
  {
    id: "side_esqueletos",
    name: "Ossos na Cripta",
    type: QUEST_TYPE.HUNT,
    location: "cripta",
    target: "skeleton",
    count: 10,
    summary: "Vá à Cripta e abata 10 esqueletos",
    rewards: {
      coins: 380,
      xp: 350,
      items: [{ itemId: "skeleton_bone", count: 8 }],
    },
  },
  {
    id: "side_ogres",
    name: "Derrubando Ogros",
    type: QUEST_TYPE.HUNT,
    location: "pedreira",
    target: "ogre",
    count: 5,
    summary: "Vá à Pedreira e abata 5 ogros",
    rewards: {
      coins: 650,
      xp: 600,
      items: [{ itemId: "ogre_hide", count: 3 }],
    },
  },
];

export const ALL_QUESTS = [
  ...MAIN_QUESTS,
  ...SIDE_QUESTS,
];

export function getQuest(id) {
  return (
    ALL_QUESTS.find((quest) => quest.id === id) ?? null
  );
}

export function getMainQuest(index) {
  return MAIN_QUESTS[index] ?? null;
}

export function getSideQuest(id) {
  return (
    SIDE_QUESTS.find((quest) => quest.id === id) ??
    null
  );
}

export function rarityRank(rarity) {
  const index = RARITY_ORDER.indexOf(rarity);

  return index < 0 ? -1 : index;
}

export function meetsRarity(have, want) {
  const rank = rarityRank(have);
  const required = rarityRank(want);

  if (rank < 0 || required < 0) return false;

  return rank >= required;
}
