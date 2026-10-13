export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

/**
 * menor vetor que tira o circulo de dentro do retangulo.
 * devolve null quando nao ha sobreposicao.
 *
 * e o que impede uma entidade de ficar presa dentro de um solido
 * para sempre: isPositionFree e booleano puro, entao se o centro
 * esta 1px dentro do obstaculo TODA posicao candidata continua
 * invalida e o movimento e bloqueado em todas as direcoes.
 */
export function circleRectPenetration(
  circle,
  rect,
  skin = 0.5,
) {
  const closestX = Math.max(
    rect.x,
    Math.min(circle.x, rect.x + rect.width),
  );

  const closestY = Math.max(
    rect.y,
    Math.min(circle.y, rect.y + rect.height),
  );

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const squared = dx * dx + dy * dy;

  if (squared >= circle.radius * circle.radius) {
    return null;
  }

  if (squared > 0) {
    const distance = Math.sqrt(squared);

    // o skin entra aqui tambem: empurrar ate a tangencia exata
    // nao resolve, porque <= ainda conta como intersecao
    const scale = (circle.radius + skin - distance) / distance;

    return { x: dx * scale, y: dy * scale };
  }

  // centro dentro do retangulo: sai pelo eixo de menor penetracao.
  // o skin vai para FORA de proposito: circleIntersectsRect usa <=,
  // entao um circulo exatamente tangente ainda conta como
  // colidindo e a entidade ficaria travada no lugar.
  const left = circle.x - rect.x;
  const right = rect.x + rect.width - circle.x;
  const top = circle.y - rect.y;
  const bottom = rect.y + rect.height - circle.y;

  const shallowest = Math.min(left, right, top, bottom);

  if (shallowest === left) {
    return { x: -(left + circle.radius) - skin, y: 0 };
  }

  if (shallowest === right) {
    return { x: right + circle.radius + skin, y: 0 };
  }

  if (shallowest === top) {
    return { x: 0, y: -(top + circle.radius) - skin };
  }

  return { x: 0, y: bottom + circle.radius + skin };
}
