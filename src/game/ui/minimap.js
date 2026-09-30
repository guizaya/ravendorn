export const MINIMAP_WIDTH = 210;
export const MINIMAP_HEIGHT = 146;
export const MINIMAP_TOP = 190;
export const MINIMAP_RIGHT = 20;

const PANEL_BG = "rgba(7, 11, 15, 0.82)";
const PANEL_BORDER = "rgba(255, 255, 255, 0.14)";

export function computeMinimapTransform(
  map,
  width = MINIMAP_WIDTH,
  height = MINIMAP_HEIGHT,
) {
  const scale = Math.min(
    width / map.width,
    height / map.height,
  );

  const drawnWidth = map.width * scale;
  const drawnHeight = map.height * scale;

  return {
    scale,
    offsetX: (width - drawnWidth) / 2,
    offsetY: (height - drawnHeight) / 2,
    width: drawnWidth,
    height: drawnHeight,
  };
}

export function worldToMinimap(transform, x, y) {
  return {
    x: transform.offsetX + x * transform.scale,
    y: transform.offsetY + y * transform.scale,
  };
}

function drawMinimapPanel(
  context,
  originX,
  originY,
  width,
  height,
) {
  context.save();

  context.fillStyle = PANEL_BG;
  context.strokeStyle = PANEL_BORDER;
  context.lineWidth = 1;

  context.beginPath();

  if (context.roundRect) {
    context.roundRect(
      originX,
      originY,
      width,
      height,
      10,
    );
  } else {
    context.rect(
      originX,
      originY,
      width,
      height,
    );
  }

  context.fill();
  context.stroke();

  context.restore();
}

export function drawMinimap(
  context,
  {
    map,
    zones,
    player,
    enemies,
    viewport,
    width,
    height,
    originX,
    originY,
    transform,
  },
) {
  drawMinimapPanel(
    context,
    originX,
    originY,
    width,
    height,
  );

  context.save();

  context.beginPath();
  context.rect(originX, originY, width, height);
  context.clip();

  context.translate(originX, originY);

  const scale = transform.scale;
  const baseX = transform.offsetX;
  const baseY = transform.offsetY;

  context.fillStyle = "#141d1a";
  context.fillRect(0, 0, transform.width, transform.height);

  for (const zone of zones) {
    context.fillStyle = zone.mapColor;

    context.fillRect(
      baseX + zone.x * scale,
      baseY + zone.y * scale,
      zone.width * scale,
      zone.height * scale,
    );
  }

  context.fillStyle = "rgba(255, 255, 255, 0.1)";

  for (const wall of map.walls) {
    context.fillRect(
      baseX + wall.x * scale,
      baseY + wall.y * scale,
      Math.max(1, wall.width * scale),
      Math.max(1, wall.height * scale),
    );
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.55)";
  context.lineWidth = 1;

  context.strokeRect(
    baseX +
      Math.max(0, player.x - viewport.width / 2) * scale,
    baseY +
      Math.max(0, player.y - viewport.height / 2) * scale,
    viewport.width * scale,
    viewport.height * scale,
  );

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const size = Math.max(
      2,
      enemy.radius * scale * 0.8,
    );

    context.fillStyle = enemy.color;

    context.fillRect(
      baseX + enemy.x * scale - size / 2,
      baseY + enemy.y * scale - size / 2,
      size,
      size,
    );
  }

  const playerX = baseX + player.x * scale;
  const playerY = baseY + player.y * scale;

  context.fillStyle = "#ffffff";
  context.strokeStyle = "#0b1118";
  context.lineWidth = 1;

  context.beginPath();
  context.arc(
    playerX,
    playerY,
    3.5,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.stroke();

  context.restore();
}
