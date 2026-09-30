import { addCreatureOutline } from "./creature-art.mjs";
import {
  createSurface,
  fillEllipse,
  fillRect,
  setPixel,
} from "./raster.mjs";
import {
  PROP_FRAME,
  PROP_ORDER,
  PROP_TYPES,
  PROP_VARIANTS,
} from "./prop-looks.mjs";

export {
  PROP_FRAME,
  PROP_ORDER,
  PROP_TYPES,
  PROP_VARIANTS,
  addCreatureOutline,
};

function makeRandom(seed) {
  let state = seed | 0 || 1;

  return () => {
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawCanopy(surface, spec, cx, cy, random) {
  const blobs = spec.blobs;

  const offsets = [
    [0, 0, 1],
    [-0.55, 0.3, 0.72],
    [0.58, 0.24, 0.68],
    [-0.2, -0.6, 0.62],
    [0.3, -0.5, 0.6],
  ];

  for (let i = 0; i < blobs; i += 1) {
    const [ox, oy, scale] = offsets[i % offsets.length];

    fillEllipse(
      surface,
      cx + ox * spec.radius + (random() - 0.5),
      cy + oy * spec.radius + (random() - 0.5),
      spec.radius * scale,
      spec.radius * scale * 0.88,
      spec.mid,
    );
  }

  fillEllipse(
    surface,
    cx - spec.radius * 0.28,
    cy - spec.radius * 0.34,
    spec.radius * 0.58,
    spec.radius * 0.48,
    spec.light,
  );

  fillEllipse(
    surface,
    cx - spec.radius * 0.36,
    cy - spec.radius * 0.44,
    spec.radius * 0.3,
    spec.radius * 0.24,
    spec.rim,
  );

  const speckles = 5 + Math.floor(random() * 4);

  for (let i = 0; i < speckles; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = random() * spec.radius * 0.7;

    setPixel(
      surface,
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius * 0.8,
      spec.dark,
    );
  }
}

function drawTrunk(surface, spec, cx, groundY) {
  if (!spec.trunk) return;

  const width = spec.trunk.width;
  const height = spec.trunk.height;

  const x = Math.round(cx - width / 2);
  const y = Math.round(groundY - height);

  fillRect(
    surface,
    x,
    y,
    width,
    height,
    spec.trunk.mid,
  );

  fillRect(
    surface,
    x,
    y,
    1,
    height,
    spec.trunk.light,
  );

  fillRect(
    surface,
    x + width - 1,
    y,
    1,
    height,
    spec.trunk.dark,
  );
}

function drawRock(surface, spec, cx, groundY, random) {
  const r = spec.radius;

  fillEllipse(surface, cx, groundY - r * 0.6, r, r * 0.78, spec.mid);

  fillEllipse(
    surface,
    cx - r * 0.5,
    groundY - r * 0.9,
    r * 0.55,
    r * 0.45,
    spec.light,
  );

  fillEllipse(
    surface,
    cx + r * 0.45,
    groundY - r * 0.35,
    r * 0.5,
    r * 0.4,
    spec.dark,
  );

  fillEllipse(
    surface,
    cx - r * 0.55,
    groundY - r * 1.05,
    r * 0.28,
    r * 0.2,
    spec.rim,
  );

  const chips = 2 + Math.floor(random() * 3);

  for (let i = 0; i < chips; i += 1) {
    setPixel(
      surface,
      cx + (random() - 0.5) * r * 1.2,
      groundY - r * 0.6 + (random() - 0.5) * r * 0.9,
      spec.dark,
    );
  }
}

export function renderProp(typeId, variant) {
  const spec = PROP_TYPES[typeId];

  const surface = createSurface(PROP_FRAME, PROP_FRAME);

  const random = makeRandom(
    400 + variant * 313 + typeId.length * 71,
  );

  const cx = PROP_FRAME / 2;
  const groundY = PROP_FRAME - 4;

  if (typeId === "rock") {
    drawRock(surface, spec.canopy, cx, groundY, random);
  } else {
    if (spec.trunk) {
      drawTrunk(surface, spec, cx, groundY);
    }

    const canopyY = groundY - (spec.trunk?.height ?? 0) -
      spec.canopy.radius * 0.5;

    drawCanopy(
      surface,
      spec.canopy,
      cx,
      canopyY,
      random,
    );
  }

  addCreatureOutline(surface, spec.canopy.dark);

  return surface;
}

export function buildPropSheet() {
  const sheet = createSurface(
    PROP_FRAME * PROP_VARIANTS,
    PROP_FRAME * PROP_ORDER.length,
  );

  for (let row = 0; row < PROP_ORDER.length; row += 1) {
    for (
      let column = 0;
      column < PROP_VARIANTS;
      column += 1
    ) {
      const frame = renderProp(
        PROP_ORDER[row],
        column,
      );

      for (let y = 0; y < PROP_FRAME; y += 1) {
        for (let x = 0; x < PROP_FRAME; x += 1) {
          const from = (y * PROP_FRAME + x) * 4;
          const to =
            ((row * PROP_FRAME + y) * sheet.width +
              column * PROP_FRAME +
              x) *
            4;

          sheet.data[to] = frame.data[from];
          sheet.data[to + 1] = frame.data[from + 1];
          sheet.data[to + 2] = frame.data[from + 2];
          sheet.data[to + 3] = frame.data[from + 3];
        }
      }
    }
  }

  return sheet;
}
