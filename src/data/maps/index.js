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

export const MAP_WIDTH = 4000;
export const MAP_HEIGHT = 2800;
export const MAP_BOUNDS = {
  x: 40,
  y: 40,
  width: MAP_WIDTH - 80,
  height: MAP_HEIGHT - 80,
};

export const SPAWN = { x: 2000, y: 1400 };

export const ZONES = [
  {
    id: "training",
    name: "Campo de Provas",
    kind: "training",
    x: 1620,
    y: 1040,
    width: 760,
    height: 720,
    color: "rgba(91, 143, 113, 0.14)",
    mapColor: "rgba(91, 143, 113, 0.5)",
  },
  {
    id: "brejo",
    name: "Brejo Lento",
    kind: "passive",
    x: 260,
    y: 1740,
    width: 860,
    height: 780,
    color: "rgba(94, 150, 120, 0.13)",
    mapColor: "rgba(94, 150, 120, 0.5)",
  },
  {
    id: "toca",
    name: "Toca dos Ratos",
    kind: "passive",
    x: 220,
    y: 480,
    width: 800,
    height: 760,
    color: "rgba(140, 122, 92, 0.13)",
    mapColor: "rgba(140, 122, 92, 0.5)",
  },
  {
    id: "acampamento",
    name: "Acampamento Goblin",
    kind: "semi",
    x: 380,
    y: 140,
    width: 820,
    height: 320,
    color: "rgba(168, 122, 78, 0.13)",
    mapColor: "rgba(168, 122, 78, 0.5)",
  },
  {
    id: "ruinas",
    name: "Ruínas dos Ghouls",
    kind: "semi",
    x: 2880,
    y: 380,
    width: 860,
    height: 780,
    color: "rgba(122, 96, 140, 0.13)",
    mapColor: "rgba(122, 96, 140, 0.5)",
  },
  {
    id: "cripta",
    name: "Cripta Esquelética",
    kind: "active",
    x: 2980,
    y: 1420,
    width: 840,
    height: 780,
    color: "rgba(150, 150, 162, 0.13)",
    mapColor: "rgba(150, 150, 162, 0.5)",
  },
  {
    id: "pedreira",
    name: "Pedreira do Ogro",
    kind: "active",
    x: 2900,
    y: 2280,
    width: 880,
    height: 440,
    color: "rgba(150, 96, 72, 0.13)",
    mapColor: "rgba(150, 96, 72, 0.5)",
  },
];

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

export function createObstacles(seed = MAP_SEED) {
  const random = createRandom(seed);
  const walls = [];
  const obstacles = [];

  const place = (target, count, min, max) => {
    let placed = 0;
    let attempts = 0;

    while (placed < count && attempts < count * 60) {
      attempts += 1;

      const width = Math.round(
        min + random() * (max - min),
      );
      const height = Math.round(
        min + random() * (max - min),
      );

      const half = Math.max(width, height) / 2;

      const x = Math.round(
        MAP_BOUNDS.x +
          60 +
          random() * (MAP_BOUNDS.width - width - 120),
      );

      const y = Math.round(
        MAP_BOUNDS.y +
          60 +
          random() * (MAP_BOUNDS.height - height - 120),
      );

      if (!isClear(x + width / 2, y + height / 2, half)) {
        continue;
      }

      let blocked = false;

      for (const other of [...walls, ...obstacles]) {
        const overlapX =
          x < other.x + other.width + 46 &&
          x + width + 46 > other.x;

        const overlapY =
          y < other.y + other.height + 46 &&
          y + height + 46 > other.y;

        if (overlapX && overlapY) {
          blocked = true;
          break;
        }
      }

      if (blocked) continue;

      target.push({
        x,
        y,
        width,
        height,
        kind: target === walls ? "stone" : "crate",
      });

      placed += 1;
    }
  };

  place(walls, 34, 55, 190);
  place(obstacles, 26, 40, 90);

  return { walls, obstacles };
}

const { walls, obstacles } = createObstacles();

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
    label: zone.name.toUpperCase(),
  })),

  walls,
  obstacles,
};

export const MAP_META = {
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  bounds: MAP_BOUNDS,
  spawn: SPAWN,
  zones: ZONES,
};
