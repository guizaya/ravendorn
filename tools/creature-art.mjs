import {
  createSurface,
  fillEllipse,
  fillRect,
  drawLine,
  setPixel,
} from "./raster.mjs";

export const CREATURE_FRAME = 32;

export const CREATURE_DIRECTIONS = ["down", "up", "side"];

export const CREATURE_ORDER = [
  "idle0",
  "idle1",
  "walk0",
  "walk1",
  "walk2",
  "walk3",
  "atk0",
  "atk1",
  "atk2",
  "hurt0",
  "hurt1",
];

const REST = {
  legA: 0,
  legB: 0,
  arm: 0,
  flash: false,
  hurt: false,
  dx: 0,
  squash: 0,
};

export const CREATURE_POSES = {
  idle0: { ...REST },
  idle1: { ...REST, bob: 1, squash: 1 },
  walk0: { ...REST, bob: 0, legA: -1, legB: 1, squash: 2 },
  walk1: { ...REST, bob: -1, legA: 0, legB: 0, squash: -1 },
  walk2: { ...REST, bob: 0, legA: 1, legB: -1, squash: 2 },
  walk3: { ...REST, bob: -1, legA: 0, legB: 0, squash: -1 },
  atk0: { ...REST, bob: 0, arm: -1, legA: -1, legB: 1, squash: -2 },
  atk1: {
    ...REST,
    bob: 1,
    arm: 2,
    legA: 1,
    legB: -1,
    flash: true,
    squash: 3,
  },
  atk2: { ...REST, bob: 0, arm: 0 },
  hurt0: { ...REST, bob: -1, dx: -2, hurt: true },
  hurt1: { ...REST, bob: 0, dx: 1, hurt: true },
};

export function addCreatureOutline(surface, color) {
  const { width, height, data } = surface;
  const copy = Uint8Array.from(data);
  const outline = [...color, 255];

  const opaqueAt = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return false;
    }

    return copy[(y * width + x) * 4 + 3] !== 0;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (opaqueAt(x, y)) continue;

      const near =
        opaqueAt(x - 1, y) ||
        opaqueAt(x + 1, y) ||
        opaqueAt(x, y - 1) ||
        opaqueAt(x, y + 1) ||
        opaqueAt(x - 1, y - 1) ||
        opaqueAt(x + 1, y - 1) ||
        opaqueAt(x - 1, y + 1) ||
        opaqueAt(x + 1, y + 1);

      if (near) setPixel(surface, x, y, outline);
    }
  }
}

function tintHurt(surface, amount) {
  const { data } = surface;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    const blend = amount;

    data[i] = Math.round(
      data[i] + (255 - data[i]) * blend,
    );
    data[i + 1] = Math.round(
      data[i + 1] + (255 - data[i + 1]) * blend,
    );
    data[i + 2] = Math.round(
      data[i + 2] + (255 - data[i + 2]) * blend,
    );
  }
}

function drawEyes(surface, look, pose, left, right, y) {
  const p = look.palette;

  fillRect(surface, left, y, 1, 1, p.eye);
  fillRect(surface, right, y, 1, 1, p.eye);
}

function drawBlob(surface, look, pose, back) {
  const p = look.palette;

  const cx = 16 + pose.dx;
  const y = pose.bob;

  const squash = pose.squash;
  const rx = 8 + squash * 0.35;
  const ry = 7 - squash * 0.4 + look.bulk * 0.02;

  fillEllipse(surface, cx, 20 + y, rx, ry, p.body);
  fillEllipse(surface, cx, 19 + y, rx - 2, ry - 2, p.bodyLit);

  fillRect(
    surface,
    cx - rx + 1,
    20 + y + ry - 2,
    rx * 2 - 2,
    1,
    p.bodyDk,
  );

  if (!back) {
    fillEllipse(surface, cx - 3, 16 + y, 2, 2, p.accent);
    fillEllipse(surface, cx + 3, 16 + y, 2, 2, p.accent);

    drawEyes(surface, look, pose, cx - 3, cx + 3, 16 + y);
  } else {
    fillEllipse(surface, cx, 16 + y, 2, 2, p.bodyDk);
  }

  if (pose.flash) {
    fillEllipse(surface, cx, 14 + y, 2, 2, p.accent);
  }
}

function drawQuadrupedDown(surface, look, pose, back) {
  const p = look.palette;

  const cx = 16 + pose.dx;
  const y = pose.bob;

  fillEllipse(surface, cx, 16 + y, 5, 6, p.body);
  fillEllipse(surface, cx, 15 + y, 3, 4, p.bodyLit);

  drawLine(
    surface,
    cx,
    11 + y,
    cx + 1,
    8 + y - pose.legB,
    p.bodyDk,
  );

  fillEllipse(surface, cx, 24 + y, 4, 3, p.head);
  fillEllipse(surface, cx, 23 + y, 2, 2, p.headLit);

  fillEllipse(surface, cx - 4, 21 + y, 1, 2, p.head);
  fillEllipse(surface, cx + 4, 21 + y, 1, 2, p.head);

  if (back) {
    fillRect(surface, cx - 1, 25 + y, 3, 1, p.bodyDk);
    return;
  }

  drawEyes(surface, look, pose, cx - 2, cx + 2, 23 + y);

  fillRect(surface, cx - 1, 26 + y, 3, 1, p.snout ?? p.bodyLit);
}

function drawQuadrupedUp(surface, look, pose) {
  const p = look.palette;

  const cx = 16 + pose.dx;
  const y = pose.bob;

  fillEllipse(surface, cx, 16 + y, 5, 6, p.body);
  fillEllipse(surface, cx, 15 + y, 3, 4, p.bodyLit);

  drawLine(
    surface,
    cx,
    22 + y,
    cx + 1,
    25 + y + pose.legB,
    p.bodyDk,
  );

  fillEllipse(surface, cx, 11 + y, 4, 3, p.head);
  fillEllipse(surface, cx - 4, 13 + y, 1, 2, p.head);
  fillEllipse(surface, cx + 4, 13 + y, 1, 2, p.head);

  fillRect(surface, cx - 2, 10 + y, 5, 1, p.headDk);
}

function drawQuadrupedSide(surface, look, pose) {
  const p = look.palette;

  const cx = 15 + pose.dx;
  const y = pose.bob;

  fillEllipse(surface, cx, 19 + y, 7, 4, p.body);
  fillEllipse(surface, cx, 18 + y, 5, 2, p.bodyLit);

  const legY = 22 + y;

  fillRect(
    surface,
    cx - 5 + pose.legA,
    legY,
    2,
    4,
    p.bodyDk,
  );
  fillRect(
    surface,
    cx + 3 + pose.legB,
    legY,
    2,
    4,
    p.bodyDk,
  );
  fillRect(surface, cx - 2, legY, 2, 3, p.bodyDk);
  fillRect(surface, cx + 1, legY, 2, 3, p.bodyDk);

  drawLine(
    surface,
    cx - 7,
    18 + y,
    cx - 11 - pose.legB,
    15 + y,
    p.bodyDk,
  );

  fillEllipse(surface, cx + 7, 17 + y, 4, 4, p.head);
  fillEllipse(surface, cx + 9, 15 + y, 1, 2, p.head);
  fillEllipse(surface, cx + 5, 15 + y, 1, 2, p.head);

  fillRect(surface, cx + 10, 17 + y, 2, 2, p.snout ?? p.bodyLit);
  fillRect(surface, cx + 7, 16 + y, 1, 1, p.eye);

  if (pose.flash) {
    fillEllipse(surface, cx + 12, 17 + y, 2, 2, p.accent);
  }
}

function drawBipedDown(surface, look, pose, back) {
  const p = look.palette;

  const cx = 16 + pose.dx;
  const y = pose.bob;

  const bulk = look.bulk;
  const legW = 2 + (bulk >= 2 ? 1 : 0);
  const legY = 22 + y;

  fillRect(surface, cx - legW - 1 + pose.legA, legY, legW, 4, p.bodyDk);
  fillRect(surface, cx + 1 + pose.legB, legY, legW, 4, p.bodyDk);

  fillEllipse(surface, cx, 18 + y, 4 + bulk, 5, p.body);
  fillEllipse(surface, cx, 17 + y, 2 + bulk, 3, p.bodyLit);
  fillEllipse(surface, cx, 19 + y, 2 + bulk - 1, 3, p.belly);

  const armY = 17 + y + pose.arm;

  fillRect(surface, cx - 5 - bulk, armY, 2, 4, p.body);
  fillRect(surface, cx + 4 + bulk - 1, armY, 2, 4, p.body);

  if (!back) {
    drawCreatureHeadDown(surface, look, pose, cx, y);
  } else {
    fillEllipse(surface, cx, 12 + y, 3 + bulk, 3, p.head);
    fillEllipse(surface, cx, 13 + y, 2 + bulk, 2, p.headDk);
  }

  if (pose.flash) {
    fillEllipse(surface, cx, 11 + y, 2, 2, p.accent);
  }
}

function drawBipedSide(surface, look, pose) {
  const p = look.palette;

  const cx = 15 + pose.dx;
  const y = pose.bob;
  const bulk = look.bulk;

  const legW = 2 + (bulk >= 2 ? 1 : 0);
  const legY = 22 + y;

  fillRect(surface, cx - legW + pose.legA, legY, legW, 4, p.bodyDk);
  fillRect(surface, cx + 1 + pose.legB, legY, legW, 4, p.bodyDk);

  fillEllipse(surface, cx, 18 + y, 4 + bulk, 5, p.body);
  fillEllipse(surface, cx, 17 + y, 3 + bulk, 3, p.bodyLit);
  fillEllipse(surface, cx + 1, 19 + y, 2 + bulk, 3, p.belly);

  const armY = 17 + y + pose.arm;

  fillRect(surface, cx + 3 + bulk, armY, 2, 4, p.body);
  fillRect(surface, cx - 5, armY, 2, 3, p.body);

  drawCreatureHeadSide(surface, look, pose, cx, y);

  if (pose.flash) {
    fillEllipse(
      surface,
      cx + 7 + bulk,
      armY + 1,
      2,
      2,
      p.accent,
    );
  }
}

function drawCreatureHeadDown(surface, look, pose, cx, y) {
  const p = look.palette;
  const size = look.headSize ?? 3;

  fillEllipse(surface, cx, 12 + y, size, size, p.head);
  fillEllipse(surface, cx, 11 + y, size - 1, size - 1, p.headLit);

  if (look.ears === "pointed") {
    fillEllipse(surface, cx - size, 9 + y, 1, 2, p.head);
    fillEllipse(surface, cx + size, 9 + y, 1, 2, p.head);
  }

  if (look.eyes === "glow") {
    drawEyes(surface, look, pose, cx - 1, cx + 1, 12 + y);
  } else if (look.eyes === "hollow") {
    fillRect(surface, cx - 2, 12 + y, 2, 2, p.eye);
    fillRect(surface, cx + 1, 12 + y, 2, 2, p.eye);
  } else {
    drawEyes(surface, look, pose, cx - 1, cx + 1, 12 + y);
  }

  if (look.teeth) {
    fillRect(surface, cx - 2, 14 + y, 4, 1, p.headLit);
  }
}

function drawCreatureHeadSide(surface, look, pose, cx, y) {
  const p = look.palette;
  const size = look.headSize ?? 3;

  fillEllipse(surface, cx + 1, 12 + y, size, size, p.head);
  fillEllipse(surface, cx + 2, 14 + y, size - 1, 1, p.skin);

  if (look.ears === "pointed") {
    fillEllipse(surface, cx, 9 + y, 1, 2, p.head);
  }

  if (look.eyes === "hollow") {
    fillRect(surface, cx + 2, 12 + y, 2, 1, p.eye);
  } else {
    fillRect(surface, cx + 2, 12 + y, 1, 1, p.eye);
  }
}

const BODIES = {
  blob: {
    down: drawBlob,
    up: drawBlob,
    side: drawBlob,
  },
  quadruped: {
    down: drawQuadrupedDown,
    up: drawQuadrupedUp,
    side: drawQuadrupedSide,
  },
  biped: {
    down: drawBipedDown,
    up: drawBipedDown,
    side: drawBipedSide,
  },
};

export function renderCreature(look, direction, frameName) {
  const surface = createSurface(CREATURE_FRAME, CREATURE_FRAME);

  const pose = CREATURE_POSES[frameName];
  const body = BODIES[look.body];

  body[direction](surface, look, pose, direction !== "down");

  addCreatureOutline(surface, look.palette.outline);

  if (pose.hurt) {
    tintHurt(surface, 0.55);
  }

  return surface;
}

export function buildCreatureSheet(look) {
  const sheet = createSurface(
    CREATURE_FRAME * CREATURE_ORDER.length,
    CREATURE_FRAME * CREATURE_DIRECTIONS.length,
  );

  for (
    let row = 0;
    row < CREATURE_DIRECTIONS.length;
    row += 1
  ) {
    for (
      let column = 0;
      column < CREATURE_ORDER.length;
      column += 1
    ) {
      const frame = renderCreature(
        look,
        CREATURE_DIRECTIONS[row],
        CREATURE_ORDER[column],
      );

      for (let y = 0; y < CREATURE_FRAME; y += 1) {
        for (let x = 0; x < CREATURE_FRAME; x += 1) {
          const source = (y * CREATURE_FRAME + x) * 4;
          const targetX = column * CREATURE_FRAME + x;
          const targetY = row * CREATURE_FRAME + y;
          const target = (targetY * sheet.width + targetX) * 4;

          sheet.data[target] = frame.data[source];
          sheet.data[target + 1] = frame.data[source + 1];
          sheet.data[target + 2] = frame.data[source + 2];
          sheet.data[target + 3] = frame.data[source + 3];
        }
      }
    }
  }

  return sheet;
}

export function scaleCreatureSheet(sheet, factor) {
  const scaled = createSurface(
    sheet.width * factor,
    sheet.height * factor,
  );

  for (let y = 0; y < scaled.height; y += 1) {
    for (let x = 0; x < scaled.width; x += 1) {
      const source =
        (Math.floor(y / factor) * sheet.width +
          Math.floor(x / factor)) *
        4;

      const target = (y * scaled.width + x) * 4;

      scaled.data[target] = sheet.data[source];
      scaled.data[target + 1] = sheet.data[source + 1];
      scaled.data[target + 2] = sheet.data[source + 2];
      scaled.data[target + 3] = sheet.data[source + 3];
    }
  }

  return scaled;
}
