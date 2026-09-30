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
};

export const ITEM_TYPE_LABEL = {
  [ITEM_TYPE.MATERIAL]: "Material",
  [ITEM_TYPE.WEAPON]: "Arma",
  [ITEM_TYPE.ARMOR]: "Armadura",
  [ITEM_TYPE.TRINKET]: "Relíquia",
};

function createItem(config) {
  return {
    stackable: false,
    maxStack: 1,
    type: ITEM_TYPE.MATERIAL,
    rarity: RARITY.COMMON,
    value: 10,
    tier: 0,
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
  }),

  goblin_dagger: createItem({
    id: "goblin_dagger",
    name: "Adaga Goblin",
    icon: "†",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.WEAPON,
    tier: 1,
    value: 40,
    stats: { attack: 6 },
  }),

  goblin_cloth: createItem({
    id: "goblin_cloth",
    name: "Trapo Goblin",
    icon: "▦",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 8,
  }),

  goblin_totem: createItem({
    id: "goblin_totem",
    name: "Totem Saqueador",
    icon: "☗",
    rarity: RARITY.RARE,
    type: ITEM_TYPE.TRINKET,
    tier: 2,
    value: 95,
    stats: { attack: 4, resourceRegen: 1 },
  }),

  ghoul_claw: createItem({
    id: "ghoul_claw",
    name: "Garra de Ghoul",
    icon: "⋀",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 22,
  }),

  ghoul_relic: createItem({
    id: "ghoul_relic",
    name: "Relíquia Profana",
    icon: "☠",
    rarity: RARITY.EPIC,
    type: ITEM_TYPE.TRINKET,
    tier: 3,
    value: 260,
    stats: { attack: 9, attackSpeed: 0.05 },
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

  skeleton_blade: createItem({
    id: "skeleton_blade",
    name: "Lâmina Espectral",
    icon: "⚔",
    rarity: RARITY.RARE,
    type: ITEM_TYPE.WEAPON,
    tier: 2,
    value: 130,
    stats: { attack: 12 },
  }),

  skeleton_bone: createItem({
    id: "skeleton_bone",
    name: "Osso Amaldiçoado",
    icon: "⌇",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.MATERIAL,
    value: 9,
  }),

  skeleton_crown: createItem({
    id: "skeleton_crown",
    name: "Coroa da Cripta",
    icon: "♕",
    rarity: RARITY.LEGENDARY,
    type: ITEM_TYPE.ARMOR,
    tier: 5,
    value: 720,
    stats: { defense: 18, maxHp: 120 },
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
  }),

  ogre_hammer: createItem({
    id: "ogre_hammer",
    name: "Marreta de Pedra",
    icon: "⌁",
    rarity: RARITY.RARE,
    type: ITEM_TYPE.WEAPON,
    value: 150,
    stats: { attack: 18, attackSpeed: -0.08 },
  }),

  ogre_heart: createItem({
    id: "ogre_heart",
    name: "Coração de Basalto",
    icon: "♥",
    rarity: RARITY.EPIC,
    type: ITEM_TYPE.TRINKET,
    tier: 3,
    value: 300,
    stats: { maxHp: 180, defense: 8 },
  }),

  hunter_hood: createItem({
    id: "hunter_hood",
    name: "Capuz de Caçador",
    icon: "⛑",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.ARMOR,
    tier: 1,
    value: 55,
    stats: { defense: 5, resourceRegen: 1 },
  }),

  scout_jerkin: createItem({
    id: "scout_jerkin",
    name: "Gibão de Batedor",
    icon: "⛊",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.ARMOR,
    tier: 1,
    value: 62,
    stats: { defense: 7 },
  }),

  tracker_boots: createItem({
    id: "tracker_boots",
    name: "Botas de Rastreio",
    icon: "⛉",
    rarity: RARITY.COMMON,
    type: ITEM_TYPE.ARMOR,
    tier: 1,
    value: 34,
    stats: { defense: 3, speed: 6 },
  }),

  ashen_band: createItem({
    id: "ashen_band",
    name: "Anel de Cinzas",
    icon: "◈",
    rarity: RARITY.RARE,
    type: ITEM_TYPE.TRINKET,
    tier: 2,
    value: 88,
    stats: { attack: 6, maxHp: 40 },
  }),

  wolf_charm: createItem({
    id: "wolf_charm",
    name: "Feitiço de Lobo",
    icon: "❖",
    rarity: RARITY.UNCOMMON,
    type: ITEM_TYPE.TRINKET,
    tier: 1,
    value: 48,
    stats: { attackSpeed: 0.06, resourceRegen: 2 },
  }),

  frost_ward: createItem({
    id: "frost_ward",
    name: "Guarda de Gelo",
    icon: "❄",
    rarity: RARITY.RARE,
    type: ITEM_TYPE.TRINKET,
    tier: 2,
    value: 92,
    stats: { defense: 9, maxHp: 60 },
  }),

  ember_blade: createItem({
    id: "ember_blade",
    name: "Lâmina de Brasa",
    icon: "⚒",
    rarity: RARITY.EPIC,
    type: ITEM_TYPE.WEAPON,
    tier: 3,
    value: 280,
    stats: { attack: 22, attackSpeed: 0.04 },
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
