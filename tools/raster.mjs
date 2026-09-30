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
