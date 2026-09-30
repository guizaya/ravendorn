import { createRandom, getZoneById, MAP_SEED } from "../maps/index.js";

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
    position: { x: 2000, y: 1180 },
  },
  {
    id: "dummy_mage",
    name: "Boneco Arcano",
    maxHp: 1100,
    defense: 5,
    radius: 25,
    color: "#8d76bf",
    position: { x: 2150, y: 1330 },
  },
  {
    id: "dummy_heavy",
    name: "Boneco Reforçado",
    maxHp: 2400,
    defense: 25,
    radius: 30,
    color: "#8e6849",
    position: { x: 1880, y: 1520 },
  },
  {
    id: "dummy_light",
    name: "Boneco Leve",
    maxHp: 900,
    defense: 2,
    radius: 22,
    color: "#c79c66",
    position: { x: 2210, y: 1600 },
  },
  {
    id: "dummy_control",
    name: "Boneco de Controle",
    maxHp: 1300,
    defense: 8,
    radius: 26,
    color: "#5b9b8e",
    position: { x: 1720, y: 1380 },
  },
  {
    id: "dummy_ranged",
    name: "Boneco de Longo Alcance",
    maxHp: 1000,
    defense: 4,
    radius: 24,
    color: "#7095b7",
    position: { x: 2320, y: 1180 },
  },
  {
    id: "dummy_poison",
    name: "Boneco de Ensaio",
    maxHp: 1200,
    defense: 6,
    radius: 25,
    color: "#a95774",
    position: { x: 1980, y: 1680 },
  },
];

const ZONE_ROSTER = [
  { zone: "brejo", types: ["slime", "rat"], count: 5 },
  { zone: "toca", types: ["rat", "rat"], count: 5 },
  { zone: "acampamento", types: ["goblin", "goblin"], count: 5 },
  { zone: "ruinas", types: ["ghoul", "ghoul"], count: 5 },
  { zone: "cripta", types: ["skeleton"], count: 5 },
  { zone: "pedreira", types: ["ogre"], count: 5 },
];

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

    for (let slot = 0; slot < entry.count; slot += 1) {
      const column = slot % columns;
      const row = Math.floor(slot / columns);

      const cellWidth = zone.width / (columns + 1);
      const cellHeight = zone.height / (rows + 1);

      const jitterX = (random() - 0.5) * cellWidth * 0.5;
      const jitterY = (random() - 0.5) * cellHeight * 0.5;

      const position = {
        x: Math.round(
          zone.x + cellWidth * (column + 1) + jitterX,
        ),
        y: Math.round(
          zone.y + cellHeight * (row + 1) + jitterY,
        ),
      };

      const typeId =
        entry.types[slot % entry.types.length];

      roster.push(
        createCreature(typeId, position, index),
      );

      index += 1;
    }
  }

  return roster;
}

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
