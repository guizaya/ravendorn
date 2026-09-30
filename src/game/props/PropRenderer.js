import {
  PROP_FRAME,
  PROP_SHEET,
  PROP_SCALE,
  PROP_TYPES,
  PROP_VARIANTS,
} from "../../data/props/index.js";

const MARGIN = 80;

function loadImage(src) {
  if (typeof Image === "undefined") return null;

  const image = new Image();

  image.src = src;

  return image;
}

export class PropRenderer {
  constructor() {
    this.image = loadImage(PROP_SHEET);
  }

  isReady() {
    return (
      this.image !== null &&
      this.image.complete === true
    );
  }

  drawShadow(context, prop) {
    const scale = prop.radius / 26;

    context.save();

    context.fillStyle = "rgba(0, 0, 0, 0.26)";
    context.beginPath();
    context.ellipse(
      prop.x,
      prop.y + 6,
      prop.radius * 0.72,
      prop.radius * 0.3,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.restore();
  }

  drawProp(context, prop) {
    const type = PROP_TYPES[prop.type];

    if (!type) return;

    const size = PROP_FRAME * PROP_SCALE;

    const scale = type.radius / 26;

    const width = size * scale;
    const height = size * scale;

    context.drawImage(
      this.image,
      prop.variant * PROP_FRAME,
      type.row * PROP_FRAME,
      PROP_FRAME,
      PROP_FRAME,
      Math.round(prop.x - width / 2),
      Math.round(prop.y - height * 0.78),
      Math.round(width),
      Math.round(height),
    );
  }

  collectVisible(props, view) {
    const visible = [];

    const startX = view.x - MARGIN;
    const startY = view.y - MARGIN;
    const endX = view.x + view.width + MARGIN;
    const endY = view.y + view.height + MARGIN;

    for (const prop of props) {
      if (
        prop.x < startX ||
        prop.x > endX ||
        prop.y < startY ||
        prop.y > endY
      ) {
        continue;
      }

      visible.push(prop);
    }

    return visible;
  }

  draw(context, props, view) {
    for (const prop of this.collectVisible(props, view)) {
      this.drawShadow(context, prop);
      this.drawProp(context, prop);
    }
  }

  visibleCount(props, view) {
    return this.collectVisible(props, view).length;
  }
}

export { PROP_VARIANTS };
