import {
  BASE_TERRAIN,
  getTransition,
  TILE_SIZE,
  TILE_VARIANTS,
  TERRAIN_ROW,
  TERRAIN_SHEETS,
} from "../../data/terrain/index.js";
const BAND = TILE_SIZE;
const PATCH_TILES = 8;
const PATCH_SIZE = TILE_SIZE * PATCH_TILES;
const PATCH_CELL = 96;

function hash2(x, y, seed) {
  let h = seed | 0;

  h = Math.imul(h ^ (x * 374761393), 0x27d4eb2d);
  h = Math.imul(h ^ (y * 668265263), 0x85ebca6b);

  h ^= h >>> 13;

  h = Math.imul(h, 0xc2b2ae35);

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(seed, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);

  const tx = smooth(x - xi);
  const ty = smooth(y - yi);

  const top =
    hash2(xi, yi, seed) +
    (hash2(xi + 1, yi, seed) - hash2(xi, yi, seed)) * tx;

  const bottom =
    hash2(xi, yi + 1, seed) +
    (hash2(xi + 1, yi + 1, seed) - hash2(xi, yi + 1, seed)) *
      tx;

  return top + (bottom - top) * ty;
}

function fbm(seed, x, y, octaves = 2) {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total +=
      valueNoise(seed + octave, x * frequency, y * frequency) *
      amplitude;

    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / norm;
}

function loadImage(src) {
  if (typeof Image === "undefined") return null;

  const image = new Image();

  image.src = src;

  return image;
}

function variantAt(column, row, salt = 0) {
  const value =
    (column * 73856093) ^
    (row * 19349663) ^
    (salt * 83492791);

  return Math.abs(value) % TILE_VARIANTS;
}

export class TerrainRenderer {
  constructor() {
    this.terrain = loadImage(TERRAIN_SHEETS.terrain);
    this.transitions = loadImage(
      TERRAIN_SHEETS.transitions,
    );
    this.features = loadImage(TERRAIN_SHEETS.features);

    this.patches = new Map();
    this.zoneGrids = new Map();

    this.ready = false;
  }

  isReady() {
    return (
      this.terrain !== null &&
      this.transitions !== null &&
      this.terrain.complete === true &&
      this.transitions.complete === true
    );
  }

  buildPatch(typeId) {
    const cached = this.patches.get(typeId);

    if (cached) return cached;

    if (typeof document === "undefined") {
      return null;
    }

    const canvas = document.createElement("canvas");

    canvas.width = PATCH_SIZE;
    canvas.height = PATCH_SIZE;

    const patchContext = canvas.getContext("2d");

    if (!patchContext) return null;

    patchContext.imageSmoothingEnabled = false;

    const row = TERRAIN_ROW[typeId] ?? 0;

    for (let y = 0; y < PATCH_TILES; y += 1) {
      for (let x = 0; x < PATCH_TILES; x += 1) {
        patchContext.drawImage(
          this.terrain,
          (x % TILE_VARIANTS) * TILE_SIZE,
          row * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
          x * TILE_SIZE,
          y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
      }
    }

    const entry = { canvas, pattern: null };

    this.patches.set(typeId, entry);

    return entry;
  }

  getPattern(context, typeId) {
    const entry = this.patches.get(typeId);

    if (!entry) return null;

    if (entry.pattern !== null) {
      return entry.pattern;
    }

    entry.pattern =
      context.createPattern?.(entry.canvas, "repeat") ??
      null;

    return entry.pattern;
  }

  blitPatch(context, entry, rect) {
    const startX =
      Math.floor(rect.x / PATCH_SIZE) * PATCH_SIZE;
    const startY =
      Math.floor(rect.y / PATCH_SIZE) * PATCH_SIZE;

    const endX = rect.x + rect.width;
    const endY = rect.y + rect.height;

    for (let y = startY; y < endY; y += PATCH_SIZE) {
      for (
        let x = startX;
        x < endX;
        x += PATCH_SIZE
      ) {
        context.drawImage(
          entry.canvas,
          x,
          y,
        );
      }
    }
  }

  fillTerrain(context, typeId, rect) {
    const entry = this.buildPatch(typeId);

    if (entry) {
      const pattern = this.getPattern(
        context,
        typeId,
      );

      if (pattern) {
        context.fillStyle = pattern;
        context.fillRect(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
        );

        return;
      }

      this.blitPatch(context, entry, rect);
      return;
    }

    const startX = Math.floor(rect.x / TILE_SIZE);
    const endX = Math.ceil(
      (rect.x + rect.width) / TILE_SIZE,
    );
    const startY = Math.floor(rect.y / TILE_SIZE);
    const endY = Math.ceil(
      (rect.y + rect.height) / TILE_SIZE,
    );

    for (let row = startY; row < endY; row += 1) {
      for (
        let column = startX;
        column < endX;
        column += 1
      ) {
        this.drawTerrain(
          context,
          typeId,
          column * TILE_SIZE,
          row * TILE_SIZE,
        );
      }
    }
  }

  drawTerrain(
    context,
    typeId,
    x,
    y,
    salt = 0,
  ) {
    const row = TERRAIN_ROW[typeId] ?? 0;

    const column = variantAt(
      Math.floor(x / TILE_SIZE),
      Math.floor(y / TILE_SIZE),
      salt,
    );

    context.drawImage(
      this.terrain,
      column * TILE_SIZE,
      row * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      x,
      y,
      TILE_SIZE,
      TILE_SIZE,
    );
  }

  fillTerrainLegacy(
    context,
    typeId,
    rect,
    salt = 0,
  ) {
    const startX = Math.floor(rect.x / TILE_SIZE);
    const endX = Math.ceil(
      (rect.x + rect.width) / TILE_SIZE,
    );
    const startY = Math.floor(rect.y / TILE_SIZE);
    const endY = Math.ceil(
      (rect.y + rect.height) / TILE_SIZE,
    );

    for (let row = startY; row < endY; row += 1) {
      for (
        let column = startX;
        column < endX;
        column += 1
      ) {
        this.drawTerrain(
          context,
          typeId,
          column * TILE_SIZE,
          row * TILE_SIZE,
          salt,
        );
      }
    }
  }

  drawTransitionBand(
    context,
    from,
    to,
    x,
    y,
    width,
    height,
    rotation,
  ) {
    const row = getTransition(from, to);

    if (row === null) return;

    const column = variantAt(
      Math.floor(x / TILE_SIZE),
      Math.floor(y / TILE_SIZE),
      from.length + to.length,
    );

    context.save();

    context.translate(x, y);

    if (rotation !== 0) {
      context.rotate(rotation);
    }

    context.drawImage(
      this.transitions,
      column * TILE_SIZE,
      row * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
      width,
      height,
    );

    context.restore();
  }

  zoneGrid(zone) {
    const cached = this.zoneGrids.get(zone.id);

    if (cached) return cached;

    const alt = zone.terrainAlt ?? zone.terrain;

    if (!zone.terrainAlt) {
      this.zoneGrids.set(zone.id, null);
      return null;
    }

    const columns = Math.max(
      1,
      Math.ceil(zone.width / PATCH_CELL),
    );
    const rows = Math.max(
      1,
      Math.ceil(zone.height / PATCH_CELL),
    );

    const bias = zone.altBias ?? 0.25;

    const seed = zone.id
      .split("")
      .reduce((sum, c) => sum + c.charCodeAt(0), 0);

    const cells = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const value = fbm(
          seed,
          (column / columns) * 3.4,
          (row / rows) * 3.4,
          2,
        );

        cells.push(
          value > bias ? alt : zone.terrain,
        );
      }
    }

    const entry = { columns, rows, cells };

    this.zoneGrids.set(zone.id, entry);

    return entry;
  }

  fillZone(context, zone) {
    const grid = this.zoneGrid(zone);

    if (!grid) {
      this.fillTerrain(
        context,
        zone.terrain,
        zone,
      );

      return;
    }

    const { columns, rows, cells } = grid;

    const originX = Math.floor(zone.x / PATCH_CELL);
    const originY = Math.floor(zone.y / PATCH_CELL);

    const used = new Uint8Array(columns * rows);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;

        if (used[index]) continue;

        const terrain = cells[index];

        let span = 1;

        while (
          column + span < columns &&
          used[index + span] === 0 &&
          cells[index + span] === terrain
        ) {
          span += 1;
        }

        let height = 1;

        let fits = true;

        while (row + height < rows) {
          for (let step = 0; step < span; step += 1) {
            const next =
              (row + height) * columns + column + step;

            if (
              used[next] !== 0 ||
              cells[next] !== terrain
            ) {
              fits = false;
              break;
            }
          }

          if (!fits) break;

          height += 1;
        }

        for (let dr = 0; dr < height; dr += 1) {
          for (let dc = 0; dc < span; dc += 1) {
            used[(row + dr) * columns + column + dc] = 1;
          }
        }

        const x = (originX + column) * PATCH_CELL;
        const y = (originY + row) * PATCH_CELL;

        this.fillTerrain(
          context,
          terrain,
          {
            x,
            y,
            width: span * PATCH_CELL,
            height: height * PATCH_CELL,
          },
        );
      }
    }
  }

  drawZoneEdges(context, zone) {
    const terrain = zone.terrain ?? BASE_TERRAIN;

    if (terrain === BASE_TERRAIN) return;

    const { x, y, width, height } = zone;

    const step = TILE_SIZE;

    for (
      let offset = 0;
      offset < width;
      offset += step
    ) {
      this.drawTransitionBand(
        context,
        BASE_TERRAIN,
        terrain,
        x + offset,
        y - BAND,
        step,
        BAND,
        Math.PI / 2,
      );

      this.drawTransitionBand(
        context,
        terrain,
        BASE_TERRAIN,
        x + offset,
        y + height,
        step,
        BAND,
        -Math.PI / 2,
      );
    }

    for (let offset = 0; offset < height; offset += step) {
      this.drawTransitionBand(
        context,
        BASE_TERRAIN,
        terrain,
        x - BAND,
        y + offset,
        step,
        BAND,
        Math.PI,
      );

      this.drawTransitionBand(
        context,
        terrain,
        BASE_TERRAIN,
        x + width,
        y + offset,
        step,
        BAND,
        0,
      );
    }
  }

  draw(context, map, zones, view) {
    this.fillTerrain(context, BASE_TERRAIN, {
      x: view.x - TILE_SIZE,
      y: view.y - TILE_SIZE,
      width: view.width + TILE_SIZE * 2,
      height: view.height + TILE_SIZE * 2,
    });

    for (const zone of zones) {
      if (
        zone.x > view.x + view.width + BAND ||
        zone.y > view.y + view.height + BAND ||
        zone.x + zone.width < view.x - BAND ||
        zone.y + zone.height < view.y - BAND
      ) {
        continue;
      }

      this.fillZone(context, zone);
      this.drawZoneEdges(context, zone);
    }
  }

  terrainAt(x, y, zones) {
    for (const zone of zones) {
      if (
        x >= zone.x &&
        x < zone.x + zone.width &&
        y >= zone.y &&
        y < zone.y + zone.height
      ) {
        return zone.terrain ?? BASE_TERRAIN;
      }
    }

    return BASE_TERRAIN;
  }
}
