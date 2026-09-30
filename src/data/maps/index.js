import {
  PROP_TYPES,
  PROP_VARIANTS,
} from "../props/index.js";
import {
  minimapColorFor,
  terrainLabelColor,
} from "../terrain/index.js";

export const MAP_SEED = 20260929;

export function createRandom(seed = MAP_SEED) {
  let state = seed | 0;

  return function random() {
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAP_WIDTH = 6000;
export const MAP_HEIGHT = 4200;
export const MAP_BOUNDS = {
  x: 40,
  y: 40,
  width: MAP_WIDTH - 80,
  height: MAP_HEIGHT - 80,
};

export const SPAWN = { x: 3000, y: 2100 };

export const ZONES = [
  {
    id: "treino",
    name: "Campo de Provas",
    kind: "training",
    terrain: "grass",
    terrainAlt: "dirt",
    altBias: 0.22,
    x: 2560,
    y: 1700,
    width: 1000,
    height: 900,
  },

  {
    id: "floresta",
    name: "Floresta Sombria",
    kind: "semi",
    terrain: "forest",
    terrainAlt: "grass",
    altBias: 0.3,
    x: 80,
    y: 80,
    width: 1300,
    height: 1250,
  },

  {
    id: "acampamento",
    name: "Acampamento Goblin",
    kind: "semi",
    terrain: "dirt",
    terrainAlt: "forest",
    altBias: 0.28,
    x: 1520,
    y: 100,
    width: 1300,
    height: 1150,
  },

  {
    id: "campina",
    name: "Campina Gelada",
    kind: "active",
    terrain: "ice",
    terrainAlt: "stone",
    altBias: 0.26,
    x: 3080,
    y: 80,
    width: 1300,
    height: 1250,
  },

  {
    id: "ruinas",
    name: "Ruínas dos Ghouls",
    kind: "semi",
    terrain: "stone",
    terrainAlt: "ash",
    altBias: 0.24,
    x: 4560,
    y: 100,
    width: 1320,
    height: 1180,
  },

  {
    id: "toca",
    name: "Toca dos Ratos",
    kind: "passive",
    terrain: "dirt",
    terrainAlt: "swamp",
    altBias: 0.26,
    x: 100,
    y: 1480,
    width: 1300,
    height: 1200,
  },

  {
    id: "brejo",
    name: "Brejo Lento",
    kind: "passive",
    terrain: "swamp",
    terrainAlt: "forest",
    altBias: 0.3,
    x: 1520,
    y: 1420,
    width: 900,
    height: 1240,
  },

  {
    id: "cripta",
    name: "Cripta Esquelética",
    kind: "active",
    terrain: "stone",
    terrainAlt: "ice",
    altBias: 0.22,
    x: 4620,
    y: 1460,
    width: 1280,
    height: 1200,
  },

  {
    id: "cinzas",
    name: "Vale das Cinzas",
    kind: "active",
    terrain: "ash",
    terrainAlt: "stone",
    altBias: 0.28,
    x: 80,
    y: 2880,
    width: 1360,
    height: 1200,
  },

  {
    id: "dunas",
    name: "Dunas Perdidas",
    kind: "semi",
    terrain: "sand",
    terrainAlt: "ash",
    altBias: 0.24,
    x: 1560,
    y: 2860,
    width: 1300,
    height: 1220,
  },

  {
    id: "pedreira",
    name: "Pedreira do Ogro",
    kind: "active",
    terrain: "sand",
    terrainAlt: "stone",
    altBias: 0.3,
    x: 3080,
    y: 2880,
    width: 1300,
    height: 1200,
  },

  {
    id: "pantano",
    name: "Pântano Profundo",
    kind: "active",
    terrain: "swamp",
    terrainAlt: "ash",
    altBias: 0.26,
    x: 4560,
    y: 2860,
    width: 1340,
    height: 1220,
  },
];

for (const zone of ZONES) {
  zone.mapColor = minimapColorFor(zone.terrain);
  zone.color = terrainLabelColor(zone.terrain);
}

export function getZoneById(id) {
  return ZONES.find((zone) => zone.id === id) ?? null;
}

const KEEP_CLEAR = [
  { x: SPAWN.x - 220, y: SPAWN.y - 220, r: 440 },
  ...ZONES.map((zone) => ({
    x: zone.x + zone.width / 2,
    y: zone.y + zone.height / 2,
    r: Math.min(zone.width, zone.height) / 2,
  })),
];

function isClear(x, y, half) {
  for (const area of KEEP_CLEAR) {
    const dx = x - area.x;
    const dy = y - area.y;

    if (Math.hypot(dx, dy) < area.r + half) {
      return false;
    }
  }

  return (
    x - half > MAP_BOUNDS.x + 40 &&
    y - half > MAP_BOUNDS.y + 40 &&
    x + half < MAP_BOUNDS.x + MAP_BOUNDS.width - 40 &&
    y + half < MAP_BOUNDS.y + MAP_BOUNDS.height - 40
  );
}

const ZONE_MARGIN = 46;

function insideAnyZone(x, y, margin = 0) {
  for (const zone of ZONES) {
    if (
      x > zone.x - margin &&
      x < zone.x + zone.width + margin &&
      y > zone.y - margin &&
      y < zone.y + zone.height + margin
    ) {
      return true;
    }
  }

  return false;
}

const BLOCKING_PLAN = [
  { type: "treeLarge", weight: 18 },
  { type: "treeMedium", weight: 34 },
  { type: "treeSmall", weight: 30 },
  { type: "rock", weight: 18 },
];

const DECORATIVE_PLAN = [
  { type: "bush", weight: 72 },
  { type: "rock", weight: 18 },
  { type: "treeSmall", weight: 10 },
];

function pickPlanEntry(plan, roll) {
  let total = 0;

  for (const entry of plan) {
    total += entry.weight;
  }

  let cursor = roll * total;

  for (const entry of plan) {
    cursor -= entry.weight;

    if (cursor <= 0) return entry;
  }

  return plan[plan.length - 1];
}

function placeProps(
  plan,
  count,
  random,
  accept,
  others = [],
  prefix = "prop",
) {
  const placed = [];
  const minimumGap = 34;

  for (let index = 0; index < count; index += 1) {
    let attempts = 0;
    let accepted = false;

    while (attempts < 40 && !accepted) {
      attempts += 1;

      const x = MAP_BOUNDS.x + 70 + random() * (
        MAP_BOUNDS.width - 140
      );
      const y = MAP_BOUNDS.y + 70 + random() * (
        MAP_BOUNDS.height - 140
      );

      const entry = pickPlanEntry(plan, random());
      const type = PROP_TYPES[entry.type];

      if (!accept(x, y, type.radius)) continue;

      let blocked = false;

      for (const other of [...placed, ...others]) {
        const gap = type.radius + other.radius;

        if (
          Math.hypot(x - other.x, y - other.y) <
          gap + minimumGap
        ) {
          blocked = true;
          break;
        }
      }

      if (blocked) continue;

      placed.push({
        id: `${prefix}_${entry.type}_${index}`,
        type: entry.type,
        isTree: entry.type.startsWith("tree"),
        x: Math.round(x),
        y: Math.round(y),
        radius: type.radius,
        colliderRadius: type.collider,
        blocking: type.blocking,
        variant: Math.floor(random() * PROP_VARIANTS),
      });

      accepted = true;
    }
  }

  return placed;
}

export function createProps(seed = MAP_SEED) {
  const random = createRandom(seed ^ 0x5f3a);

  const blocking = placeProps(
    BLOCKING_PLAN,
    132,
    random,
    (x, y, radius) =>
      isClear(x, y, radius) &&
      !insideAnyZone(x, y, ZONE_MARGIN),
    [],
    "solid",
  );

  const decorative = placeProps(
    DECORATIVE_PLAN,
    620,
    random,
    (x, y, radius) => {
      if (
        x - radius < MAP_BOUNDS.x + 30 ||
        y - radius < MAP_BOUNDS.y + 30 ||
        x + radius > MAP_BOUNDS.x + MAP_BOUNDS.width - 30 ||
        y + radius > MAP_BOUNDS.y + MAP_BOUNDS.height - 30
      ) {
        return false;
      }

      return (
        Math.hypot(x - SPAWN.x, y - SPAWN.y) > 190
      );
    },
    blocking,
    "bush",
  );

  return {
    props: [...blocking, ...decorative],
    blocking,
    decorative,
  };
}


const { props, blocking, decorative } = createProps();

const solids = blocking.map((prop) => {
  const half = prop.colliderRadius;

  return {
    x: prop.x - half,
    y: prop.y - half,
    width: half * 2,
    height: half * 2,
    kind: prop.type,
  };
});

export const TEST_MAP = {
  id: "ashen-valley",
  name: "Vale de Cinzas",

  width: MAP_WIDTH,
  height: MAP_HEIGHT,

  bounds: MAP_BOUNDS,

  background: "#17221f",

  spawn: SPAWN,

  zones: ZONES.map((zone) => ({
    x: zone.x,
    y: zone.y,
    width: zone.width,
    height: zone.height,
    color: zone.color,
    terrain: zone.terrain,
    mapColor: zone.mapColor,
    name: zone.name,
  })),

  props,
  blocking,
  decorative,
  solids,
};

export const MAP_META = {
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  bounds: MAP_BOUNDS,
  spawn: SPAWN,
  zones: ZONES,
};
