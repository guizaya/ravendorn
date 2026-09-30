import {
  createSurface,
  fillEllipse,
  fillRect,
  drawLine,
  setPixel,
} from "./raster.mjs";

export const FRAME = 32;

export const DIRECTIONS = ["down", "up", "side"];

export const ORDER = [
  "idle0",
  "idle1",
  "walk0",
  "walk1",
  "walk2",
  "walk3",
  "atk0",
  "atk1",
  "atk2",
];

export const POSES = {
  idle0: { bob: 0, legA: 0, legB: 0, arm: 0, flash: false },
  idle1: { bob: 1, legA: 0, legB: 0, arm: 0, flash: false },
  walk0: { bob: 0, legA: -1, legB: 1, arm: 0, flash: false },
  walk1: { bob: -1, legA: 0, legB: 0, arm: 0, flash: false },
  walk2: { bob: 0, legA: 1, legB: -1, arm: 0, flash: false },
  walk3: { bob: -1, legA: 0, legB: 0, arm: 0, flash: false },
  atk0: { bob: 0, legA: -1, legB: 1, arm: -1, flash: false },
  atk1: { bob: 1, legA: 1, legB: -1, arm: 2, flash: true },
  atk2: { bob: 0, legA: 0, legB: 0, arm: 0, flash: false },
};

export function addOutline(surface, color) {
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

      if (near) {
        setPixel(surface, x, y, outline);
      }
    }
  }
}

function drawLegs(surface, look, pose) {
  const p = look.palette;
  const width = 3 + (look.bulk >= 2 ? 1 : 0);

  const left = 16 - width - 1 + pose.legA;
  const right = 17 + pose.legB;
  const y = 21 + pose.bob;

  fillRect(surface, left, y, width, 5, p.boot);
  fillRect(surface, right, y, width, 5, p.boot);

  fillRect(surface, left, y, 1, 5, p.tunicDk);
  fillRect(surface, right, y, 1, 5, p.tunicDk);
}

function drawTorso(surface, look, pose) {
  const p = look.palette;
  const y = pose.bob;
  const rx = 5 + look.bulk;

  fillEllipse(surface, 16, 18 + y, rx, 5, p.cloak);
  fillEllipse(surface, 16, 16 + y, rx - 2, 3, p.cloakLit);
  fillEllipse(surface, 16, 19 + y, 2 + Math.min(1, look.bulk), 3, p.tunic);

  if (look.trim) {
    fillRect(surface, 16 - rx, 17 + y, rx * 2, 1, look.trim);
  }

  if (look.belt) {
    fillRect(surface, 16 - rx, 19 + y, rx * 2, 1, p.tunicDk);
  }
}

function drawHeadHelm(surface, look, pose, back) {
  const p = look.palette;
  const y = pose.bob;

  if (!back) {
    fillEllipse(surface, 16, 10 + y, 3, 3, p.skin);
  }

  fillEllipse(surface, 16, 9 + y, 4, 4, p.head);
  fillEllipse(surface, 16, 7 + y, 4, 3, p.head);
  fillEllipse(surface, 16, 6 + y, 3, 1, p.headLit);

  fillRect(surface, 15, 4 + y, 3, 2, p.accent);

  if (back) {
    fillRect(surface, 12, 12 + y, 9, 1, p.headDk);
    return;
  }

  fillRect(surface, 12, 10 + y, 9, 1, p.headDk);
  fillRect(surface, 14, 11 + y, 1, 1, p.accent);
  fillRect(surface, 17, 11 + y, 1, 1, p.accent);
}

function drawHeadHood(surface, look, pose, back) {
  const p = look.palette;
  const y = pose.bob;

  fillEllipse(surface, 16, 9 + y, 4, 4, p.head);

  if (!back) {
    fillEllipse(surface, 16, 11 + y, 3, 2, p.skin);
    fillRect(surface, 12, 10 + y, 9, 1, p.headDk);
    fillRect(surface, 14, 11 + y, 1, 1, p.eye);
    fillRect(surface, 17, 11 + y, 1, 1, p.eye);
  } else {
    fillEllipse(surface, 16, 11 + y, 3, 2, p.headDk);
    fillRect(surface, 13, 13 + y, 7, 1, p.head);
  }

  fillEllipse(surface, 16, 8 + y, 4, 3, p.head);
}

function drawHeadHair(surface, look, pose, back) {
  const p = look.palette;
  const y = pose.bob;

  fillEllipse(surface, 16, 10 + y, 3, 3, back ? p.head : p.skin);
  fillEllipse(surface, 16, 8 + y, 4, 3, p.head);
  fillEllipse(surface, 12, 10 + y, 1, 3, p.head);
  fillEllipse(surface, 20, 10 + y, 1, 3, p.head);
  fillEllipse(surface, 16, 12 + y, 4, 2, p.head);

  if (back) return;

  fillRect(surface, 12, 9 + y, 9, 1, p.accent);
  fillRect(surface, 14, 11 + y, 1, 1, p.eye);
  fillRect(surface, 17, 11 + y, 1, 1, p.eye);
  fillRect(surface, 15, 12 + y, 2, 1, p.skinDk);
}

function drawHeadHat(surface, look, pose, back) {
  const p = look.palette;
  const y = pose.bob;

  fillEllipse(surface, 16, 10 + y, 3, 3, p.skin);

  fillRect(surface, 10, 9 + y, 13, 1, p.head);
  fillRect(surface, 11, 10 + y, 11, 1, p.headDk);

  fillEllipse(surface, 16, 8 + y, 3, 2, p.head);
  fillRect(surface, 16, 6 + y, 1, 2, p.accent);

  if (back) return;

  fillRect(surface, 14, 11 + y, 1, 1, p.eye);
  fillRect(surface, 17, 11 + y, 1, 1, p.eye);
}

function drawHeadMask(surface, look, pose, back) {
  const p = look.palette;
  const y = pose.bob;

  fillEllipse(surface, 16, 9 + y, 4, 4, p.head);
  fillEllipse(surface, 16, 8 + y, 4, 3, p.head);
  fillRect(surface, 13, 6 + y, 7, 1, p.accent);

  if (back) {
    fillEllipse(surface, 16, 11 + y, 3, 3, p.headDk);
    return;
  }

  fillRect(surface, 13, 10 + y, 7, 2, p.headDk);
  fillRect(surface, 14, 10 + y, 1, 1, p.accent);
  fillRect(surface, 17, 10 + y, 1, 1, p.accent);
}

function drawHeadMane(surface, look, pose, back) {
  const p = look.palette;
  const y = pose.bob;

  fillEllipse(surface, 16, 10 + y, 3, 3, back ? p.head : p.skin);

  fillEllipse(surface, 16, 7 + y, 5, 3, p.head);
  fillEllipse(surface, 12, 10 + y, 2, 3, p.head);
  fillEllipse(surface, 20, 10 + y, 2, 3, p.head);
  fillEllipse(surface, 16, 13 + y, 4, 2, p.head);

  fillEllipse(surface, 16, 6 + y, 3, 1, p.headLit);

  if (back) return;

  fillRect(surface, 14, 10 + y, 1, 1, p.eye);
  fillRect(surface, 17, 10 + y, 1, 1, p.eye);
}

const HEADS = {
  helm: drawHeadHelm,
  hood: drawHeadHood,
  hair: drawHeadHair,
  hat: drawHeadHat,
  mask: drawHeadMask,
  mane: drawHeadMane,
};

const REQUIRED_COLORS = [
  "outline",
  "cloak",
  "cloakLit",
  "tunic",
  "tunicDk",
  "skin",
  "skinDk",
  "eye",
  "boot",
  "head",
  "headLit",
  "headDk",
  "accent",
  "metal",
  "metalDk",
  "metalLit",
  "wood",
  "woodDk",
];

export function validateLook(look) {
  const errors = [];

  if (!look?.id) errors.push("look sem id");

  if (!look?.palette) {
    errors.push(`${look?.id}: sem palette`);
    return errors;
  }

  for (const key of REQUIRED_COLORS) {
    const color = look.palette[key];

    if (!Array.isArray(color) || color.length !== 3) {
      errors.push(`${look.id}: cor ausente "${key}"`);
      continue;
    }

    for (const channel of color) {
      if (
        !Number.isInteger(channel) ||
        channel < 0 ||
        channel > 255
      ) {
        errors.push(
          `${look.id}: cor invalida "${key}" = ${JSON.stringify(color)}`,
        );
      }
    }
  }

  if (look.trim !== undefined) {
    if (!Array.isArray(look.trim)) {
      errors.push(`${look.id}: trim invalido`);
    }
  }

  if (look.custom) {
    for (const direction of ["down", "up", "side"]) {
      if (typeof look.custom[direction] !== "function") {
        errors.push(
          `${look.id}: custom sem "${direction}"`,
        );
      }
    }
  } else {
    if (!HEADS[look.head]) {
      errors.push(`${look.id}: head desconhecida "${look.head}"`);
    }

    if (!look.custom && look.weapon !== "crossbow") {
      if (!WEAPONS[look.weapon]) {
        errors.push(
          `${look.id}: weapon desconhecida "${look.weapon}"`,
        );
      }
    }
  }

  if (![0, 1, 2].includes(look.bulk)) {
    errors.push(`${look.id}: bulk invalido "${look.bulk}"`);
  }

  return errors;
}

function drawSword(surface, look, pose, horizontal) {
  const p = look.palette;
  const reach = pose.arm >= 2 ? 10 : 8;
  const guard = look.trim ?? p.metalDk;

  if (horizontal) {
    fillRect(surface, 21 + pose.arm, 17, reach - 4, 2, p.metal);
    fillRect(surface, 21 + pose.arm, 18, reach - 4, 1, p.metalDk);
    fillRect(surface, 17, 16, 3, 4, guard);
    fillRect(surface, 14, 17, 3, 2, p.woodDk);
  } else {
    fillRect(surface, 16 - reach, 17, reach - 3, 2, p.metal);
    fillRect(surface, 16 - reach, 18, reach - 3, 1, p.metalDk);
    fillRect(surface, 14, 15, 3, 4, guard);
    fillRect(surface, 15, 19, 3, 2, p.woodDk);
  }
}

function drawSpear(surface, look, pose, horizontal) {
  const p = look.palette;
  const y = 17 + pose.bob;
  const kick = pose.arm >= 2 ? 1 : 0;

  if (horizontal) {
    fillRect(surface, 14, y, 10, 2, p.wood);
    fillRect(surface, 23, y - 1, 4, 4, p.metal);
    fillRect(surface, 26 + kick, y, 2, 2, p.metalLit);
  } else {
    fillRect(surface, 15, 13, 2, 12, p.wood);
    fillRect(surface, 14, 10, 4, 4, p.metal);
    fillRect(surface, 15, 8 - kick, 2, 3, p.metalLit);
  }
}

function drawStaff(surface, look, pose, horizontal) {
  const p = look.palette;
  const y = 17 + pose.bob;
  const kick = pose.arm >= 2 ? 1 : 0;

  if (horizontal) {
    fillRect(surface, 13, y, 11, 2, p.wood);
    fillEllipse(surface, 25, y, 3, 3, p.accent);
    fillEllipse(surface, 25, y, 1, 1, p.metalLit);
  } else {
    fillRect(surface, 15, 13, 2, 12, p.wood);
    fillEllipse(surface, 16, 10 - kick, 3, 3, p.accent);
    fillEllipse(surface, 16, 10 - kick, 1, 1, p.metalLit);
  }
}

function drawOrb(surface, look, pose, horizontal) {
  const p = look.palette;
  const kick = pose.arm >= 2 ? 1 : 0;

  const x = horizontal ? 22 + kick : 21 + kick;
  const y = 15 + pose.bob - kick;

  fillEllipse(surface, x, y, 3, 3, p.accent);
  fillEllipse(surface, x, y, 1, 1, p.metalLit);
}

function drawScythe(surface, look, pose, horizontal) {
  const p = look.palette;
  const y = 17 + pose.bob;
  const kick = pose.arm >= 2 ? 1 : 0;

  if (horizontal) {
    fillRect(surface, 13, y, 9, 2, p.wood);
    fillRect(surface, 20, y - 5, 2, 6, p.woodDk);

    fillRect(surface, 21, y - 6, 4, 2, p.metal);
    fillRect(surface, 23, y - 4, 3, 2, p.metal);
    fillRect(surface, 25 + kick, y - 3, 2, 2, p.metalDk);
  } else {
    fillRect(surface, 15, 12, 2, 13, p.wood);
    fillRect(surface, 14, 11, 5, 2, p.metal);
    fillRect(surface, 17, 9 - kick, 2, 3, p.metalDk);
  }
}

function drawCrossbowWeapon(surface, look, pose) {
  const p = look.palette;
  const y = 17 + pose.bob + pose.arm;
  const open = pose.arm >= 2 ? 10 : 8;

  fillRect(surface, 16 - open, y, open - 3, 2, p.wood);
  fillRect(surface, 19, y, open - 3, 2, p.wood);

  fillRect(surface, 16 - open, y + 1, 2, 2, p.woodDk);
  fillRect(surface, 16 + open - 2, y + 1, 2, 2, p.woodDk);

  fillRect(surface, 14, y - 1, 5, 3, p.metal);

  drawLine(surface, 16, y - 3, 16, y, p.metalDk);
  fillRect(surface, 15, y + 2, 3, 3, p.woodDk);
}

function drawClaw(surface, look, pose, horizontal) {
  const p = look.palette;
  const kick = pose.arm >= 2 ? 1 : 0;

  const x = horizontal ? 20 + kick : 20 + kick;
  const y = 17 + pose.bob;

  for (let i = 0; i < 3; i += 1) {
    fillRect(
      surface,
      x + i,
      y - 2 + i,
      2,
      1,
      p.metalLit,
    );
  }

  fillRect(surface, x, y - 1, 2, 3, p.skin);
}

const WEAPONS = {
  sword: drawSword,
  spear: drawSpear,
  staff: drawStaff,
  orb: drawOrb,
  scythe: drawScythe,
  crossbow: (surface, look, pose) =>
    drawCrossbowWeapon(surface, look, pose),
  claw: drawClaw,
};

function drawFlash(surface, look, pose, horizontal) {
  if (!pose.flash) return;

  if (horizontal) {
    fillEllipse(surface, 27, 17 + pose.bob, 2, 2, look.palette.accent);
  } else {
    fillEllipse(surface, 16, 24 + pose.bob, 3, 2, look.palette.accent);
  }
}

function drawBackWeapon(surface, look, pose) {
  const p = look.palette;
  const y = pose.bob;

  if (
    look.weapon === "spear" ||
    look.weapon === "staff" ||
    look.weapon === "scythe"
  ) {
    drawLine(surface, 19, 13 + y, 22, 21 + y, p.wood);
    drawLine(surface, 20, 13 + y, 23, 21 + y, p.woodDk);
  }
}

function drawGenericDown(surface, pose, look) {
  const p = look.palette;

  drawLegs(surface, look, pose);
  drawTorso(surface, look, pose);

  if (look.weapon !== "crossbow") {
    WEAPONS[look.weapon]?.(surface, look, pose, false);
  }

  fillRect(surface, 18, 17 + pose.bob, 2, 3, p.skin);

  HEADS[look.head](surface, look, pose, false);

  drawFlash(surface, look, pose, false);
}

function drawGenericUp(surface, pose, look) {
  const p = look.palette;

  drawLegs(surface, look, pose);
  drawTorso(surface, look, pose);

  fillRect(surface, 16, 13 + pose.bob, 1, 7, p.headDk);

  HEADS[look.head](surface, look, pose, true);

  drawBackWeapon(surface, look, pose);
}

function drawGenericSide(surface, pose, look) {
  const p = look.palette;

  drawLegs(surface, look, pose);
  drawTorso(surface, look, pose);

  if (look.weapon !== "crossbow") {
    WEAPONS[look.weapon]?.(surface, look, pose, true);
  }

  fillRect(surface, 18, 17 + pose.bob, 2, 3, p.skin);

  if (look.head !== "mask") {
    fillEllipse(surface, 18, 11 + pose.bob, 2, 1, p.skin);
    fillRect(surface, 19, 10 + pose.bob, 1, 1, p.eye);
  }

  fillEllipse(surface, 16, 9 + pose.bob, 4, 4, p.head);
  fillEllipse(surface, 16, 7 + pose.bob, 4, 3, p.head);

  drawFlash(surface, look, pose, true);
}

const GENERIC = {
  down: drawGenericDown,
  up: drawGenericUp,
  side: drawGenericSide,
};

export function renderLook(look, direction, frameName) {
  const surface = createSurface(FRAME, FRAME);

  const draw = look.custom?.[direction] ?? GENERIC[direction];

  draw(surface, POSES[frameName], look);

  addOutline(surface, look.palette.outline);

  return surface;
}

export function buildSheet(look) {
  const sheet = createSurface(
    FRAME * ORDER.length,
    FRAME * DIRECTIONS.length,
  );

  for (let row = 0; row < DIRECTIONS.length; row += 1) {
    for (let column = 0; column < ORDER.length; column += 1) {
      const frame = renderLook(
        look,
        DIRECTIONS[row],
        ORDER[column],
      );

      for (let y = 0; y < FRAME; y += 1) {
        for (let x = 0; x < FRAME; x += 1) {
          const source = (y * FRAME + x) * 4;
          const targetX = column * FRAME + x;
          const targetY = row * FRAME + y;
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

export function scaleSheet(sheet, factor) {
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
