import { createRandom, getZoneById, MAP_SEED } from "../maps/index.js";
import { applyDropScaling } from "../../game/balance.js";

export const BEHAVIOR = {
  PASSIVE: "passive",
  SEMI_PASSIVE: "semiPassive",
  ACTIVE: "active",
};

export const CREATURE_TYPES = {
  slime: {
    id: "slime",
    name: "Limo Preguiçoso",
    behavior: BEHAVIOR.PASSIVE,
    maxHp: 140,
    defense: 2,
    radius: 21,
    speed: 48,
    damage: 7,
    attackRange: 44,
    aggroRange: 0,
    leash: 260,
    attackCooldown: 1.6,
    spriteScale: 1.5,
    wanderRadius: 150,
    wanderSpeed: 30,
    color: "#6fbf8a",
    loot: applyDropScaling({
      coins: { min: 3, max: 9 },
      itemChance: 0.34,
      maxItems: 1,
      items: [
        { id: "slime_gel", weight: 84 },
        { id: "slime_core", weight: 15 },
        { id: "skeleton_bone", weight: 1 },
      ],
    }),
  },

  rat: {
    id: "rat",
    name: "Rato da Toca",
    behavior: BEHAVIOR.PASSIVE,
    maxHp: 90,
    defense: 1,
    radius: 15,
    speed: 96,
    damage: 6,
    attackRange: 36,
    aggroRange: 0,
    leash: 220,
    attackCooldown: 1.1,
    spriteScale: 1.15,
    wanderRadius: 190,
    wanderSpeed: 72,
    color: "#a08a63",
    loot: applyDropScaling({
      coins: { min: 5, max: 14 },
      itemChance: 0.4,
      maxItems: 1,
      items: [
        { id: "rat_tail", weight: 80 },
        { id: "rat_pelt", weight: 18 },
        { id: "goblin_cloth", weight: 2 },
      ],
    }),
  },

  goblin: {
    id: "goblin",
    name: "Goblin Saqueador",
    behavior: BEHAVIOR.SEMI_PASSIVE,
    maxHp: 260,
    defense: 8,
    radius: 20,
    speed: 118,
    damage: 22,
    attackRange: 52,
    aggroRange: 0,
    leash: 620,
    attackCooldown: 1.5,
    spriteScale: 1.25,
    wanderRadius: 90,
    wanderSpeed: 40,
    color: "#8faf5a",
    loot: applyDropScaling({
      coins: { min: 12, max: 30 },
      itemChance: 0.5,
      maxItems: 2,
      items: [
        { id: "goblin_cloth", weight: 70 },
        { id: "goblin_dagger", weight: 26 },
        { id: "goblin_totem", weight: 3.2 },
        { id: "skeleton_blade", weight: 0.8 },
      ],
    }),
  },

  ghoul: {
    id: "ghoul",
    name: "Ghoul Faminto",
    behavior: BEHAVIOR.SEMI_PASSIVE,
    maxHp: 420,
    defense: 14,
    radius: 23,
    speed: 104,
    damage: 34,
    attackRange: 50,
    aggroRange: 0,
    leash: 700,
    attackCooldown: 1.8,
    spriteScale: 1.4,
    wanderRadius: 70,
    wanderSpeed: 34,
    color: "#9a7fae",
    loot: applyDropScaling({
      coins: { min: 22, max: 52 },
      itemChance: 0.56,
      maxItems: 2,
      items: [
        { id: "ghoul_claw", weight: 66 },
        { id: "ghoul_rib", weight: 30 },
        { id: "ghoul_relic", weight: 3.5 },
        { id: "skeleton_crown", weight: 0.5 },
      ],
    }),
  },

  skeleton: {
    id: "skeleton",
    name: "Sentinela Esquelética",
    behavior: BEHAVIOR.ACTIVE,
    maxHp: 520,
    defense: 22,
    radius: 22,
    speed: 126,
    damage: 42,
    attackRange: 58,
    aggroRange: 330,
    leash: 900,
    attackCooldown: 1.6,
    spriteScale: 1.35,
    wanderRadius: 60,
    wanderSpeed: 30,
    color: "#cfd3d6",
    loot: applyDropScaling({
      coins: { min: 30, max: 68 },
      itemChance: 0.62,
      maxItems: 2,
      items: [
        { id: "skeleton_bone", weight: 58 },
        { id: "skeleton_skull", weight: 30 },
        { id: "skeleton_blade", weight: 11 },
        { id: "skeleton_crown", weight: 0.6 },
      ],
    }),
  },

  ogre: {
    id: "ogre",
    name: "Ogre da Pedreira",
    behavior: BEHAVIOR.ACTIVE,
    maxHp: 1250,
    defense: 34,
    radius: 32,
    speed: 92,
    damage: 78,
    attackRange: 78,
    aggroRange: 400,
    leash: 1000,
    attackCooldown: 2.4,
    spriteScale: 1.9,
    wanderRadius: 50,
    wanderSpeed: 24,
    color: "#b07a52",
    loot: applyDropScaling({
      coins: { min: 85, max: 190 },
      itemChance: 0.78,
      maxItems: 3,
      items: [
        { id: "ogre_pebble", weight: 46 },
        { id: "ogre_hide", weight: 38 },
        { id: "ogre_hammer", weight: 13 },
        { id: "ogre_heart", weight: 2.6 },
        { id: "skeleton_crown", weight: 0.4 },
      ],
    }),
  },
};

export const TRAINING_DUMMY_BLUEPRINTS = [
  {
    id: "dummy_warrior",
    name: "Boneco de Madeira",
    maxHp: 1500,
    defense: 10,
    radius: 25,
    color: "#b78555",
    position: { x: 2820, y: 1900 },
  },
  {
    id: "dummy_mage",
    name: "Boneco Arcano",
    maxHp: 1100,
    defense: 5,
    radius: 25,
    color: "#8d76bf",
    position: { x: 3160, y: 2080 },
  },
  {
    id: "dummy_heavy",
    name: "Boneco Reforçado",
    maxHp: 2400,
    defense: 25,
    radius: 30,
    color: "#8e6849",
    position: { x: 2880, y: 2320 },
  },
  {
    id: "dummy_light",
    name: "Boneco Leve",
    maxHp: 900,
    defense: 2,
    radius: 22,
    color: "#c79c66",
    position: { x: 3260, y: 1860 },
  },
  {
    id: "dummy_control",
    name: "Boneco de Controle",
    maxHp: 1300,
    defense: 8,
    radius: 26,
    color: "#5b9b8e",
    position: { x: 2760, y: 2180 },
  },
  {
    id: "dummy_ranged",
    name: "Boneco de Longo Alcance",
    maxHp: 1000,
    defense: 4,
    radius: 24,
    color: "#7095b7",
    position: { x: 3380, y: 2200 },
  },
  {
    id: "dummy_poison",
    name: "Boneco de Ensaio",
    maxHp: 1200,
    defense: 6,
    radius: 25,
    color: "#a95774",
    position: { x: 3060, y: 2420 },
  },
];

const ZONE_ROSTER = [
  {
    zone: "floresta",
    count: 7,
    mix: { goblin: 62, rat: 16, ghoul: 14, slime: 8 },
  },
  {
    zone: "acampamento",
    count: 6,
    mix: { goblin: 66, rat: 18, ghoul: 16 },
  },
  {
    zone: "campina",
    count: 7,
    mix: { skeleton: 60, slime: 24, ogre: 16 },
  },
  {
    zone: "ruinas",
    count: 7,
    mix: { ghoul: 62, skeleton: 24, goblin: 14 },
  },
  {
    zone: "toca",
    count: 7,
    mix: { rat: 70, goblin: 18, slime: 12 },
  },
  {
    zone: "brejo",
    count: 7,
    mix: { slime: 66, rat: 20, ghoul: 14 },
  },
  {
    zone: "cripta",
    count: 8,
    mix: { skeleton: 68, ogre: 20, ghoul: 12 },
  },
  {
    zone: "cinzas",
    count: 7,
    mix: { ogre: 60, ghoul: 24, skeleton: 16 },
  },
  {
    zone: "dunas",
    count: 6,
    mix: { goblin: 60, rat: 24, ogre: 16 },
  },
  {
    zone: "pedreira",
    count: 7,
    mix: { ogre: 68, skeleton: 20, goblin: 12 },
  },
  {
    zone: "pantano",
    count: 7,
    mix: { ogre: 62, ghoul: 22, slime: 16 },
  },
];

function allocateTypes(count, mix) {
  const entries = Object.entries(mix);

  const total = entries.reduce(
    (sum, [, weight]) => sum + weight,
    0,
  );

  const exact = entries.map(([id, weight]) => ({
    id,
    value: (count * weight) / total,
  }));

  for (const entry of exact) {
    entry.count = Math.floor(entry.value);
    entry.rest = entry.value - entry.count;
  }

  let assigned = exact.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );

  const byRest = [...exact].sort(
    (a, b) => b.rest - a.rest,
  );

  let cursor = 0;

  while (assigned < count) {
    byRest[cursor % byRest.length].count += 1;
    assigned += 1;
    cursor += 1;
  }

  return exact
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ id: entry.id, count: entry.count }));
}

function buildZoneTypes(entry) {
  const allocated = allocateTypes(
    entry.count,
    entry.mix,
  );

  const types = [];

  for (const item of allocated) {
    for (let n = 0; n < item.count; n += 1) {
      types.push(item.id);
    }
  }

  return types;
}

export function createCreature(typeId, position, index) {
  const type = CREATURE_TYPES[typeId];

  if (!type) {
    throw new Error(`tipo de criatura desconhecido: ${typeId}`);
  }

  return {
    ...type,
    id: `${typeId}_${index}`,

    x: position.x,
    y: position.y,

    spawnX: position.x,
    spawnY: position.y,

    hp: type.maxHp,
    alive: true,

    isCreature: true,
    isDummy: false,

    facing: { x: 0, y: 1 },

    hitFlash: 0,
    attackAnimation: 0,

    pushVelocity: { x: 0, y: 0 },
    statusEffects: [],

    respawnTimer: 0,

    aiState: "idle",
    aiTimer: 0,
    provoked: false,
    alerted: false,
    attackCooldownRemaining: 0,

    wanderTarget: null,
    wanderWait: 0,

    stuckTimer: 0,
    sidestepTimer: 0,
    sidestepSign: 1,

    spriteOffset: (index % 7) * 0.37,
  };
}

export function createCreatureRoster(seed = MAP_SEED) {
  const random = createRandom(seed);
  const roster = [];

  let index = 0;

  for (const entry of ZONE_ROSTER) {
    const zone = getZoneById(entry.zone);

    if (!zone) {
      throw new Error(`zona desconhecida: ${entry.zone}`);
    }

    const columns = Math.ceil(Math.sqrt(entry.count));
    const rows = Math.ceil(entry.count / columns);

    const types = buildZoneTypes(entry);

    for (let slot = 0; slot < entry.count; slot += 1) {
      const column = slot % columns;
      const row = Math.floor(slot / columns);

      const cellWidth = zone.width / (columns + 1);
      const cellHeight = zone.height / (rows + 1);

      const jitterX = (random() - 0.5) * cellWidth * 0.55;
      const jitterY = (random() - 0.5) * cellHeight * 0.55;

      const position = {
        x: Math.round(
          zone.x + cellWidth * (column + 1) + jitterX,
        ),
        y: Math.round(
          zone.y + cellHeight * (row + 1) + jitterY,
        ),
      };

      roster.push(
        createCreature(
          types[slot],
          position,
          index,
        ),
      );

      index += 1;
    }
  }

  return roster;
}

export const DUMMY_LOOT = applyDropScaling({
  coins: { min: 6, max: 18 },
  itemChance: 0.3,
  maxItems: 1,
  items: [
    { id: "dummy_wood", weight: 88 },
    { id: "goblin_cloth", weight: 9 },
    { id: "slime_gel", weight: 3 },
  ],
});

export function createTrainingDummy(blueprint) {
  return {
    ...blueprint,

    x: blueprint.position.x,
    y: blueprint.position.y,

    spawnX: blueprint.position.x,
    spawnY: blueprint.position.y,

    hp: blueprint.maxHp,
    alive: true,

    isCreature: false,
    isDummy: true,

    facing: { x: 0, y: 1 },

    hitFlash: 0,
    attackAnimation: 0,

    pushVelocity: { x: 0, y: 0 },
    statusEffects: [],
    statusTickTimer: 0,

    loot: DUMMY_LOOT,

    respawnTimer: 0,

    aiState: "idle",
    aiTimer: 0,
    provoked: false,
    alerted: false,
    attackCooldownRemaining: 0,
  };
}

export function createTrainingDummies() {
  return TRAINING_DUMMY_BLUEPRINTS.map(createTrainingDummy);
}
