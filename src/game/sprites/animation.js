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

export function resolveAnimation(player) {
  if (player.attackAnimation > 0) {
    return "attack";
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
