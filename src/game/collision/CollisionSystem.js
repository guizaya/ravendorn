import {
  circleIntersectsRect,
  circleRectPenetration,
  distanceSquared,
} from "../math.js";

const CELL_SIZE = 220;

const CORNER_ESCAPE_TURN = 0.5;

export class CollisionSystem {
  /**
   * @param {object} map    o mapa, com os seus solidos
   * @param {object[]} [extraSolids]  retangulos solidos de OUTRA
   *   origem — no jogo, a pegada dos NPCs
   *
   * Os NPCs viram solidos por parametro e nao por `map.solids` porque a
   * pegada e DEDUZIDA da arte e da posicao: ela sai da escala e da
   * ancora, que so o motor tem. Escrever o retangulo a mao no dado do
   * mapa faria a barreira e a arte poderem divergir sem ninguem ver
   */
  constructor(map, extraSolids = []) {
    this.map = map;

    this.solids = [
      ...(map.solids ?? []),
      ...(map.walls ?? []),
      ...(map.obstacles ?? []),
      ...extraSolids,
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

  clampToBounds(entity, radius) {
    const bounds = this.map.bounds;

    const minX = bounds.x + radius;
    const maxX = bounds.x + bounds.width - radius;
    const minY = bounds.y + radius;
    const maxY = bounds.y + bounds.height - radius;

    const x = Math.max(minX, Math.min(maxX, entity.x));
    const y = Math.max(minY, Math.min(maxY, entity.y));

    const clamped = x !== entity.x || y !== entity.y;

    entity.x = x;
    entity.y = y;

    return clamped;
  }

  /**
   * tira a entidade de dentro de qualquer solido (e de fora dos
   * limites do mapa). sem isso, entrar 1px num obstaculo trava o
   * movimento para sempre, porque isPositionFree so responde
   * sim ou nao e nenhuma posicao vizinha seria valida.
   *
   * devolve true quando teve que mover algo.
   */
  resolveOverlap(entity, radius, passes = 3) {
    let corrected = false;

    for (let pass = 0; pass < passes; pass += 1) {
      let movedThisPass = false;

      const candidates = [
        ...this.nearbySolids(
          entity.x,
          entity.y,
          radius,
        ),
      ];

      for (const rect of candidates) {
        if (rect.passable) continue;

        const push = circleRectPenetration(
          { x: entity.x, y: entity.y, radius },
          rect,
        );

        if (!push) continue;

        entity.x += push.x;
        entity.y += push.y;

        movedThisPass = true;
        corrected = true;
      }

      if (this.clampToBounds(entity, radius)) {
        movedThisPass = true;
        corrected = true;
      }

      if (!movedThisPass) break;
    }

    return corrected;
  }

  moveEntity(entity, deltaX, deltaY, entities = []) {
    const startX = entity.x;
    const startY = entity.y;

    if (deltaX !== 0) {
      const nextX = entity.x + deltaX;

      if (
        this.isPositionFree(
          { x: nextX, y: entity.y },
          entity.radius,
          entities,
          entity.id,
        )
      ) {
        entity.x = nextX;
      }
    }

    if (deltaY !== 0) {
      const nextY = entity.y + deltaY;

      if (
        this.isPositionFree(
          { x: entity.x, y: nextY },
          entity.radius,
          entities,
          entity.id,
        )
      ) {
        entity.y = nextY;
      }
    }

    const movedX = entity.x - startX;
    const movedY = entity.y - startY;

    // preso num canto: os dois eixos bloqueados nao tem diagonal
    // livre, entao a entidade fica sem escorregar. tenta girar o
    // passo para sair pela diagonal.
    if (
      movedX === 0 &&
      movedY === 0 &&
      (deltaX !== 0 || deltaY !== 0)
    ) {
      this.escapeCorner(
        entity,
        startX,
        startY,
        deltaX,
        deltaY,
        entities,
      );
    }

    return Math.hypot(entity.x - startX, entity.y - startY);
  }

  escapeCorner(
    entity,
    startX,
    startY,
    deltaX,
    deltaY,
    entities,
  ) {
    const length = Math.hypot(deltaX, deltaY);
    const angle = Math.atan2(deltaY, deltaX);

    for (const turn of [
      CORNER_ESCAPE_TURN,
      -CORNER_ESCAPE_TURN,
    ]) {
      const turned = angle + turn;

      const testX = startX + Math.cos(turned) * length;
      const testY = startY + Math.sin(turned) * length;

      if (
        !this.isPositionFree(
          { x: testX, y: testY },
          entity.radius,
          entities,
          entity.id,
        )
      ) {
        continue;
      }

      entity.x = testX;
      entity.y = testY;

      return true;
    }

    return false;
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
