export const DIRECTION_KEYS = [
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east",
];

const DIRECTION_SECTOR =
  (Math.PI * 2) / DIRECTION_KEYS.length;

const DEFAULT_DIRECTION = "south";

export function isDirectionalFormat(definition) {
  return definition?.format === "directional";
}

export function resolveDirectionKey(
  facing,
  fallback = DEFAULT_DIRECTION,
) {
  const x = Number(facing?.x) || 0;
  const y = Number(facing?.y) || 0;

  if (x === 0 && y === 0) {
    return fallback;
  }

  const steps = Math.round(
    Math.atan2(y, x) / DIRECTION_SECTOR,
  );

  const index =
    ((steps % DIRECTION_KEYS.length) +
      DIRECTION_KEYS.length) %
    DIRECTION_KEYS.length;

  return DIRECTION_KEYS[index];
}

export function resolveDirection(facing, directions) {
  const absX = Math.abs(facing.x);
  const absY = Math.abs(facing.y);

  if (absY > absX) {
    return {
      row: facing.y > 0 ? directions.down : directions.up,
      flip: false,
    };
  }

  return {
    row: directions.side,
    flip: facing.x < 0,
  };
}

export function resolveAnimation(player, definition) {
  if (player.attackAnimation > 0) {
    const animations = definition?.animations;

    if (!animations || animations.attack) {
      return "attack";
    }
  }

  return player.isMoving ? "walk" : "idle";
}

const MOVING_STATES = new Set([
  "chase",
  "wander",
  "return",
]);

export function isCreatureMoving(enemy) {
  return MOVING_STATES.has(enemy.aiState);
}

export function resolveCreatureAnimation(enemy) {
  if (enemy.hitFlash > 0) {
    return "hurt";
  }

  if (enemy.attackAnimation > 0) {
    return "attack";
  }

  return isCreatureMoving(enemy) ? "walk" : "idle";
}

export function resolveFrame(animation, elapsed) {
  const length = animation.length;

  if (!Number.isFinite(length) || length <= 0) {
    return animation.start;
  }

  const fps = animation.fps > 0 ? animation.fps : 1;
  const cycle = length / fps;
  const time = elapsed % cycle;

  const frame = Math.floor(time * fps);

  return animation.start + (frame % length);
}

export function resolveFrameRect(
  definition,
  animationName,
  elapsed,
  facing,
) {
  if (isDirectionalFormat(definition)) {
    const key = resolveDirectionKey(
      facing,
      definition.fallbackDirection,
    );

    const animation =
      definition.animations[animationName] ??
      definition.animations.walk;

    const row = animation.row ??
      definition.directions[key] ??
      0;

    const column = resolveFrame(animation, elapsed);

    return {
      x: column * definition.frameWidth,
      y: row * definition.frameHeight,
      width: definition.frameWidth,
      height: definition.frameHeight,
      flip: false,
    };
  }

  const animation = definition.animations[animationName];
  const direction = resolveDirection(
    facing,
    definition.directions,
  );

  const column = resolveFrame(animation, elapsed);

  return {
    x: column * definition.frameWidth,
    y: direction.row * definition.frameHeight,
    width: definition.frameWidth,
    height: definition.frameHeight,
    flip: direction.flip,
  };
}

export function resolveWalkOffset(definition, entity) {
  const bob = definition.walkBob;
  const blend = entity.walkBlend ?? 0;

  if (!bob || bob.amplitude <= 0 || blend <= 0) {
    return { x: 0, y: 0 };
  }

  const phase =
    (entity.walkPhase ?? 0) *
    bob.frequency *
    Math.PI *
    2;

  return {
    x: 0,
    y: -Math.abs(Math.sin(phase)) * bob.amplitude * blend,
  };
}

export function resolveDrawRect(
  definition,
  player,
) {
  const scale = definition.scale;

  const width = definition.frameWidth * scale;
  const height = definition.frameHeight * scale;

  return {
    x: player.x - definition.anchorX * scale,
    y:
      player.y +
      definition.footOffset -
      definition.anchorY * scale,
    width,
    height,
  };
}
