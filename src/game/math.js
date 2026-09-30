export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return dx * dx + dy * dy;
}

export function distance(a, b) {
  return Math.sqrt(distanceSquared(a, b));
}

export function normalize(x, y) {
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / length,
    y: y / length,
  };
}

export function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export function segmentDistanceSquared(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distanceSquared(point, start);
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) /
      lengthSquared,
    0,
    1,
  );

  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return distanceSquared(point, projection);
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function circleIntersectsRect(circle, rect) {
  const closestX = Math.max(
    rect.x,
    Math.min(circle.x, rect.x + rect.width),
  );

  const closestY = Math.max(
    rect.y,
    Math.min(circle.y, rect.y + rect.height),
  );

  return distanceSquared(circle, {
    x: closestX,
    y: closestY,
  }) <= circle.radius * circle.radius;
}
