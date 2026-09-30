import {
  fillEllipse,
  fillRect,
  drawLine,
} from "./raster.mjs";

function drawLegs(surface, pose, look) {
  const p = look.palette;
  const y = 21 + pose.bob;

  fillRect(surface, 13 + pose.legA, y, 3, 5, p.boot);
  fillRect(surface, 17 + pose.legB, y, 3, 5, p.boot);

  fillRect(surface, 13 + pose.legA, y, 1, 5, p.tunicDk);
  fillRect(surface, 17 + pose.legB, y, 1, 5, p.tunicDk);
}

function drawBolt(surface, x, y, look) {
  drawLine(surface, x, y - 3, x, y, look.palette.metalDk);
}

function drawBow(surface, cx, cy, span, look) {
  const p = look.palette;

  fillRect(surface, cx - span, cy, span - 2, 2, p.wood);
  fillRect(surface, cx + 2, cy, span - 2, 2, p.wood);

  fillRect(surface, cx - span, cy + 1, 2, 2, p.woodDk);
  fillRect(surface, cx + span - 2, cy + 1, 2, 2, p.woodDk);

  fillRect(surface, cx - 2, cy - 1, 4, 3, p.metal);
  drawBolt(surface, cx, cy, look);

  fillRect(surface, cx - 1, cy + 2, 2, 3, p.woodDk);
}

export function drawDown(surface, pose, look) {
  const p = look.palette;

  drawLegs(surface, pose, look);

  const y = pose.bob;

  fillEllipse(surface, 16, 18 + y, 6, 5, p.cloak);
  fillEllipse(surface, 16, 16 + y, 4, 3, p.cloakLit);
  fillEllipse(surface, 16, 19 + y, 3, 3, p.tunic);
  fillRect(surface, 12, 18 + y, 9, 1, p.tunicDk);

  const open = pose.arm >= 2 ? 10 : 8;

  drawBow(surface, 16, 17 + y + pose.arm, open, look);

  fillEllipse(surface, 16, 9 + y, 4, 4, p.head);
  fillEllipse(surface, 16, 11 + y, 3, 2, p.skin);
  fillEllipse(surface, 16, 8 + y, 4, 3, p.head);

  fillRect(surface, 12, 10 + y, 9, 1, p.headDk);

  fillRect(surface, 14, 11 + y, 1, 1, p.eye);
  fillRect(surface, 17, 11 + y, 1, 1, p.eye);

  fillRect(surface, 15, 12 + y, 2, 1, p.skinDk);

  if (pose.flash) {
    fillEllipse(surface, 16, 24 + y, 3, 2, p.accent);
  }
}

export function drawUp(surface, pose, look) {
  const p = look.palette;

  drawLegs(surface, pose, look);

  const y = pose.bob;

  fillEllipse(surface, 16, 18 + y, 6, 5, p.cloak);
  fillEllipse(surface, 16, 17 + y, 4, 3, p.cloakLit);

  fillRect(surface, 14, 15 + y, 5, 1, p.accent);

  fillRect(surface, 20, 13 + y, 3, 6, p.woodDk);
  fillRect(surface, 20, 13 + y, 1, 6, p.wood);

  fillEllipse(surface, 16, 9 + y, 4, 4, p.head);
  fillEllipse(surface, 16, 8 + y, 3, 3, p.headDk);
  fillRect(surface, 13, 13 + y, 7, 1, p.cloak);
}

export function drawSide(surface, pose, look) {
  const p = look.palette;

  const y = pose.bob;
  const kick = pose.arm >= 2 ? 1 : 0;

  fillRect(surface, 13 + pose.legA, 21 + y, 3, 5, p.boot);
  fillRect(surface, 17 + pose.legB, 21 + y, 3, 5, p.boot);

  fillRect(surface, 13 + pose.legA, 21 + y, 1, 5, p.tunicDk);
  fillRect(surface, 17 + pose.legB, 21 + y, 1, 5, p.tunicDk);

  fillEllipse(surface, 15, 18 + y, 5, 5, p.cloak);
  fillEllipse(surface, 16, 17 + y, 3, 2, p.cloakLit);
  fillEllipse(surface, 16, 19 + y, 2, 3, p.tunic);

  const bowX = 21 + kick;
  const bowY = 17 + y + (pose.arm === -1 ? -1 : 0);

  drawBow(surface, bowX, bowY, 6, look);

  fillRect(surface, 18, bowY - 1, 2, 3, p.skin);

  fillEllipse(surface, 15, 9 + y, 4, 4, p.head);
  fillEllipse(surface, 18, 11 + y, 2, 1, p.skin);

  fillEllipse(surface, 15, 8 + y, 4, 3, p.head);
  fillRect(surface, 17, 13 + y, 4, 1, p.headDk);
  fillRect(surface, 19, 10 + y, 1, 1, p.eye);

  if (pose.flash) {
    fillEllipse(surface, bowX + 5, bowY, 2, 2, p.accent);
  }
}
