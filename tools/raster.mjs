export function createSurface(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

export function hexToRgb(hex) {
  const value = String(hex).replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`hex invalido: ${hex}`);
  }

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

export function blend(target, color, alpha) {
  const [r, g, b] = color;

  return [
    Math.round(r * alpha),
    Math.round(g * alpha),
    Math.round(b * alpha),
  ];
}

export function setPixel(surface, x, y, color) {
  if (!color) {
    throw new Error(
      `setPixel sem cor valida em (${x}, ${y})`,
    );
  }

  const px = Math.round(x);
  const py = Math.round(y);

  if (px < 0 || py < 0) return;
  if (px >= surface.width || py >= surface.height) return;

  const index = (py * surface.width + px) * 4;

  surface.data[index] = color[0];
  surface.data[index + 1] = color[1];
  surface.data[index + 2] = color[2];
  surface.data[index + 3] = 255;
}

export function fillRect(surface, x, y, w, h, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      setPixel(surface, px, py, color);
    }
  }
}

export function fillEllipse(
  surface,
  cx,
  cy,
  rx,
  ry,
  color,
) {
  if (
    !Number.isFinite(cx) ||
    !Number.isFinite(cy) ||
    !Number.isFinite(rx) ||
    !Number.isFinite(ry) ||
    rx <= 0 ||
    ry <= 0
  ) {
    throw new Error(
      `fillEllipse com geometria invalida: c=(${cx},${cy}) r=(${rx},${ry})`,
    );
  }

  for (let py = Math.floor(cy - ry); py <= Math.ceil(cy + ry); py += 1) {
    for (
      let px = Math.floor(cx - rx);
      px <= Math.ceil(cx + rx);
      px += 1
    ) {
      const nx = (px + 0.5 - cx) / (rx + 0.001);
      const ny = (py + 0.5 - cy) / (ry + 0.001);

      if (nx * nx + ny * ny <= 1) {
        setPixel(surface, px, py, color);
      }
    }
  }
}

export function drawLine(surface, x0, y0, x1, y1, color) {
  const steps = Math.max(
    Math.abs(x1 - x0),
    Math.abs(y1 - y0),
  );

  if (steps === 0) {
    setPixel(surface, x0, y0, color);
    return;
  }

  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;

    setPixel(
      surface,
      x0 + (x1 - x0) * t,
      y0 + (y1 - y0) * t,
      color,
    );
  }
}

export function mix(a, b, t) {
  const amount = Math.max(0, Math.min(1, t));

  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount),
  ];
}

export function fillAll(surface, color) {
  for (let i = 0; i < surface.data.length; i += 4) {
    surface.data[i] = color[0];
    surface.data[i + 1] = color[1];
    surface.data[i + 2] = color[2];
    surface.data[i + 3] = 255;
  }
}

export function speckle(surface, color, density, seed = 1) {
  let state = seed | 0 || 1;

  const random = () => {
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      if (random() >= density) continue;

      const index = (y * surface.width + x) * 4;

      if (surface.data[index + 3] === 0) continue;

      surface.data[index] = color[0];
      surface.data[index + 1] = color[1];
      surface.data[index + 2] = color[2];
    }
  }
}

export function pick(palette, noise, amount = 1) {
  const scaled = Math.max(
    0,
    Math.min(0.9999, noise) * (palette.length - 1),
  );

  const index = Math.floor(scaled);
  const blend = scaled - index;

  if (index >= palette.length - 1) {
    return palette[palette.length - 1];
  }

  return mix(
    palette[index],
    palette[index + 1],
    blend * amount,
  );
}

export function valueNoise(random) {
  const size = 8;
  const lattice = new Float32Array(size * size);

  for (let i = 0; i < lattice.length; i += 1) {
    lattice[i] = random();
  }

  const smooth = (t) => t * t * (3 - 2 * t);

  const at = (x, y) => {
    const wrappedX = ((x % size) + size) % size;
    const wrappedY = ((y % size) + size) % size;

    return lattice[wrappedY * size + wrappedX];
  };

  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);

    const tx = smooth(x - xi);
    const ty = smooth(y - yi);

    const top =
      at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * tx;

    const bottom =
      at(xi, yi + 1) +
      (at(xi + 1, yi + 1) - at(xi, yi + 1)) * tx;

    return top + (bottom - top) * ty;
  };
}

export function fbm(noise, x, y, octaves = 3) {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total +=
      noise(x * frequency, y * frequency) * amplitude;

    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / norm;
}
