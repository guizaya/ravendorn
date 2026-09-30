import {
  circleIntersectsRect,
  distanceSquared,
} from "../math.js";

const CELL_SIZE = 220;

export class CollisionSystem {
  constructor(map) {
    this.map = map;

    this.solids = [
      ...(map.solids ?? []),
      ...(map.walls ?? []),
      ...(map.obstacles ?? []),
    ];

    this.cellSize = CELL_SIZE;

    const bounds = map.bounds;

    const extentWidth =
      map.width ?? bounds.x + bounds.width;

    const extentHeight =
      map.height ?? bounds.y + bounds.height;

    this.columns = Math.max(
      1,
      Math.ceil(extentWidth / this.cellSize) + 1,
    );

    this.rows = Math.max(
      1,
      Math.ceil(extentHeight / this.cellSize) + 1,
    );

    this.cells = new Array(
      this.columns * this.rows,
    );

    for (let index = 0; index < this.cells.length; index += 1) {
      this.cells[index] = [];
    }

    this.seen = new Set();

    for (const rect of this.solids) {
      this.insertSolid(rect);
    }

    this.scratch = [];
  }

  cellIndex(cellX, cellY) {
    return cellY * this.columns + cellX;
  }

  cellBounds(x, y, radius) {
    return {
      minX: Math.max(
        0,
        Math.floor((x - radius) / this.cellSize),
      ),
      maxX: Math.min(
        this.columns - 1,
        Math.floor((x + radius) / this.cellSize),
      ),
      minY: Math.max(
        0,
        Math.floor((y - radius) / this.cellSize),
      ),
      maxY: Math.min(
        this.rows - 1,
        Math.floor((y + radius) / this.cellSize),
      ),
    };
  }

  insertSolid(rect) {
    const bounds = this.cellBounds(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      Math.max(rect.width, rect.height) / 2,
    );

    for (let cellY = bounds.minY; cellY <= bounds.maxY; cellY += 1) {
      for (
        let cellX = bounds.minX;
        cellX <= bounds.maxX;
        cellX += 1
      ) {
        this.cells[this.cellIndex(cellX, cellY)].push(rect);
      }
    }
  }

  nearbySolids(x, y, radius) {
    const bounds = this.cellBounds(x, y, radius);
    const scratch = this.scratch;

    scratch.length = 0;

    const seen = this.seen;

    seen.clear();

    for (let cellY = bounds.minY; cellY <= bounds.maxY; cellY += 1) {
      for (
        let cellX = bounds.minX;
        cellX <= bounds.maxX;
        cellX += 1
      ) {
        const bucket = this.cells[this.cellIndex(cellX, cellY)];

        for (const rect of bucket) {
          if (seen.has(rect)) continue;

          seen.add(rect);
          scratch.push(rect);
        }
      }
    }

    return scratch;
  }

  isInsideBounds(position, radius) {
    const bounds = this.map.bounds;

    return (
      position.x - radius >= bounds.x &&
      position.y - radius >= bounds.y &&
      position.x + radius <= bounds.x + bounds.width &&
      position.y + radius <= bounds.y + bounds.height
    );
  }

  isPositionFree(
    position,
    radius,
    entities = [],
    ignoredEntityId = null,
  ) {
    if (!this.isInsideBounds(position, radius)) {
      return false;
    }

    const candidates = this.nearbySolids(
      position.x,
      position.y,
      radius,
    );

    for (const rect of candidates) {
      if (rect.passable) continue;

      if (
        circleIntersectsRect(
          { x: position.x, y: position.y, radius },
          rect,
        )
      ) {
        return false;
      }
    }

    for (const entity of entities) {
      if (entity.id === ignoredEntityId || entity.alive === false) {
        continue;
      }

      const minimumDistance = radius + entity.radius;

      if (
        distanceSquared(position, entity) <
        minimumDistance * minimumDistance
      ) {
        return false;
      }
    }

    return true;
  }

  circleHitsSolid(position, radius) {
    if (!this.isInsideBounds(position, radius)) {
      return true;
    }

    const candidates = this.nearbySolids(
      position.x,
      position.y,
      radius,
    );

    for (const rect of candidates) {
      if (rect.passable) continue;

      if (
        circleIntersectsRect(
          { x: position.x, y: position.y, radius },
          rect,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  moveEntity(entity, deltaX, deltaY, entities = []) {
    const startX = entity.x;
    const startY = entity.y;

    const nextX = {
      x: entity.x + deltaX,
      y: entity.y,
    };

    if (
      this.isPositionFree(
        nextX,
        entity.radius,
        entities,
        entity.id,
      )
    ) {
      entity.x = nextX.x;
    }

    const nextY = {
      x: entity.x,
      y: entity.y + deltaY,
    };

    if (
      this.isPositionFree(
        nextY,
        entity.radius,
        entities,
        entity.id,
      )
    ) {
      entity.y = nextY.y;
    }

    return Math.hypot(entity.x - startX, entity.y - startY);
  }

  moveBySteps(entity, deltaX, deltaY, entities = []) {
    const distance = Math.hypot(deltaX, deltaY);

    if (distance === 0) return 0;

    const steps = Math.max(1, Math.ceil(distance / 10));

    let moved = 0;

    for (let i = 0; i < steps; i += 1) {
      moved += this.moveEntity(
        entity,
        deltaX / steps,
        deltaY / steps,
        entities,
      );
    }

    return moved;
  }
}
