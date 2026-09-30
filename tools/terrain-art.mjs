import {
  createSurface,
  fillAll,
  fbm,
  fillRect,
  pick,
  setPixel,
  speckle,
  valueNoise,
} from "./raster.mjs";
import {
  FEATURES,
  TILE,
  TERRAIN,
  TERRAIN_ORDER,
  TRANSITIONS,
  TRANSITION_PALETTES,
} from "./terrain-looks.mjs";
import { hexToRgb } from "./raster.mjs";

export { TILE, TERRAIN, TERRAIN_ORDER, TRANSITIONS };

const VARIANTS = 4;

function makeRandom(seed) {
  let state = seed | 0 || 1;

  return () => {
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paletteOf(id) {
  return TERRAIN[id].palette.map(hexToRgb);
}

function drawFeature(surface, kind, seed) {
  const random = makeRandom(seed);
  const colors = FEATURES[kind].map(hexToRgb);

  if (!colors) return;

  switch (kind) {
    case "tufts": {
      for (let i = 0; i < 7; i += 1) {
        const x = Math.floor(random() * (TILE - 4)) + 2;
        const y = Math.floor(random() * (TILE - 6)) + 3;

        for (let b = 0; b < 3; b += 1) {
          setPixel(
            surface,
            x + b - 1,
            y - b,
            colors[b % colors.length],
          );
        }
      }
      break;
    }

    case "pebbles": {
      for (let i = 0; i < 6; i += 1) {
        const x = Math.floor(random() * (TILE - 3)) + 1;
        const y = Math.floor(random() * (TILE - 3)) + 1;
        const size = random() > 0.7 ? 2 : 1;

        for (
          let dy = 0;
          dy < size;
          dy += 1
        ) {
          for (
            let dx = 0;
            dx < size;
            dx += 1
          ) {
            setPixel(
              surface,
              x + dx,
              y + dy,
              colors[0],
            );
          }
        }
      }
      break;
    }

    case "ripples": {
      for (let i = 0; i < 4; i += 1) {
        const y = Math.floor(random() * TILE);
        const x = Math.floor(random() * (TILE - 10));

        for (let dx = 0; dx < 8; dx += 1) {
          setPixel(
            surface,
            x + dx,
            y + (dx % 3 === 0 ? 1 : 0),
            colors[0],
          );
        }
      }
      break;
    }

    case "cracks": {
      let x = Math.floor(random() * TILE);
      let y = 0;

      while (y < TILE) {
        setPixel(surface, x, y, colors[0]);
        y += 1;
        x += random() > 0.5 ? 1 : random() > 0.3 ? 0 : -1;
        x = Math.max(1, Math.min(TILE - 2, x));
      }
      break;
    }

    case "puddles": {
      for (let i = 0; i < 3; i += 1) {
        const cx = Math.floor(random() * TILE);
        const cy = Math.floor(random() * TILE);
        const r = 2 + Math.floor(random() * 3);

        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            if (dx * dx + dy * dy > r * r) continue;

            setPixel(
              surface,
              cx + dx,
              cy + dy,
              colors[0],
            );
          }
        }
      }
      break;
    }

    case "needles": {
      for (let i = 0; i < 8; i += 1) {
        const x = Math.floor(random() * TILE);
        const y = Math.floor(random() * TILE);
        const length = 2 + Math.floor(random() * 3);

        for (let k = 0; k < length; k += 1) {
          setPixel(
            surface,
            x + (k % 2),
            y + k,
            colors[k % colors.length],
          );
        }
      }
      break;
    }

    case "frost": {
      for (let i = 0; i < 3; i += 1) {
        const cx = Math.floor(random() * TILE);
        const cy = Math.floor(random() * TILE);
        const r = 1 + Math.floor(random() * 2);

        for (let a = 0; a < 4; a += 1) {
          const angle = (a / 4) * Math.PI * 2;

          for (let k = 0; k <= r; k += 1) {
            setPixel(
              surface,
              cx + Math.cos(angle) * k,
              cy + Math.sin(angle) * k,
              colors[0],
            );
          }
        }

        setPixel(surface, cx, cy, colors[1]);
      }
      break;
    }

    case "embers": {
      for (let i = 0; i < 5; i += 1) {
        const x = Math.floor(random() * TILE);
        const y = Math.floor(random() * TILE);

        setPixel(surface, x, y, colors[1]);
        setPixel(surface, x + 1, y, colors[0]);
        setPixel(
          surface,
          x,
          y + 1,
          random() > 0.5 ? colors[0] : colors[1],
        );
      }
      break;
    }

    default:
      break;
  }
}

export function renderTerrainTile(typeId, variant) {
  const terrain = TERRAIN[typeId];
  const palette = paletteOf(typeId);
  const seed = 1000 + variant * 97 + typeId.length * 13;

  const surface = createSurface(TILE, TILE);

  const noise = valueNoise(makeRandom(seed));
  const detail = valueNoise(makeRandom(seed + 31));

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const u = x / TILE;
      const v = y / TILE;

      const broad = fbm(noise, u * 3, v * 3, 3);
      const fine = fbm(detail, u * 11, v * 11, 2);

      const amount = broad * 0.72 + fine * 0.28;

      setPixel(surface, x, y, pick(palette, amount));
    }
  }

  speckle(
    surface,
    hexToRgb(terrain.grainColor),
    terrain.grain,
    seed + 7,
  );

  if (variant % 2 === 0) {
    drawFeature(surface, terrain.features, seed + 53);
  }

  return surface;
}

export function renderTransitionTile(transitionId, index) {
  const [from, to] = TRANSITION_PALETTES[transitionId];

  const surface = createSurface(TILE, TILE);

  const seed =
    5000 +
    index * 211 +
    transitionId
      .split("")
      .reduce((sum, c) => sum + c.charCodeAt(0), 0) *
      7;

  const noiseA = valueNoise(makeRandom(seed));
  const noiseB = valueNoise(makeRandom(seed + 17));

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const u = x / TILE;

      const warp = fbm(noiseA, u * 4, y / TILE * 4, 2) - 0.5;
      const edge = 0.48 + warp * 0.22;

      const fine = fbm(noiseB, u * 9, y / TILE * 9, 2);

      const t = Math.max(
        0,
        Math.min(1, (u + (fine - 0.5) * 0.18 - edge) * 3.4),
      );

      setPixel(surface, x, y, pick(from, t));
    }
  }

  speckle(
    surface,
    hexToRgb(TERRAIN[TRANSITIONS[index].to].grainColor),
    0.03,
    seed + 5,
  );

  return surface;
}

function compose(surfaces) {
  const columns = surfaces[0].length;
  const rows = surfaces.length;

  const sheet = createSurface(
    TILE * columns,
    TILE * rows,
  );

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const source = surfaces[row][column];

      for (let y = 0; y < TILE; y += 1) {
        for (let x = 0; x < TILE; x += 1) {
          const from = (y * TILE + x) * 4;
          const to =
            ((row * TILE + y) * sheet.width +
              column * TILE +
              x) *
            4;

          sheet.data[to] = source.data[from];
          sheet.data[to + 1] = source.data[from + 1];
          sheet.data[to + 2] = source.data[from + 2];
          sheet.data[to + 3] = source.data[from + 3];
        }
      }
    }
  }

  return sheet;
}

export function buildTerrainSheet() {
  return compose(
    TERRAIN_ORDER.map((id) =>
      Array.from({ length: VARIANTS }, (_, variant) =>
        renderTerrainTile(id, variant),
      ),
    ),
  );
}

export function buildTransitionSheet() {
  return compose(
    TRANSITIONS.map((transition, index) =>
      Array.from({ length: VARIANTS }, (_, variant) =>
        renderTransitionTile(transition.id, index, variant),
      ),
    ),
  );
}

export function buildFeatureSheet() {
  return compose(
    Object.keys(FEATURES).map((kind) =>
      Array.from({ length: VARIANTS }, (_, variant) =>
        renderFeatureTile(kind, variant),
      ),
    ),
  );
}

export function renderFeatureTile(kind, variant) {
  const surface = createSurface(TILE, TILE);
  const seed = 9000 + variant * 313 + kind.length * 29;

  drawFeature(surface, kind, seed);

  return surface;
}

export { VARIANTS, fillAll, fillRect };
