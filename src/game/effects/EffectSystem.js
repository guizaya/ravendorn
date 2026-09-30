import { TAU } from "../math.js";

const MAX_EFFECTS = 400;

export class EffectSystem {
  constructor() {
    this.effects = [];
  }

  add(kind, properties, duration = 0.35) {
    if (this.effects.length >= MAX_EFFECTS) {
      this.effects.shift();
    }

    this.effects.push({
      kind,
      ...properties,
      ttl: duration,
      maxTtl: duration,
    });
  }

  line(x, y, angle, length, width, color, duration = 0.25) {
    this.add(
      "line",
      { x, y, angle, length, width, color },
      duration,
    );
  }

  circle(x, y, radius, color, duration = 0.35, filled = false) {
    this.add(
      "circle",
      { x, y, radius, color, filled },
      duration,
    );
  }

  cone(x, y, angle, radius, color, duration = 0.3) {
    this.add(
      "cone",
      { x, y, angle, radius, color },
      duration,
    );
  }

  burst(x, y, color, duration = 0.45) {
    this.add("burst", { x, y, color }, duration);
  }

  addText(x, y, text, color, critical = false) {
    this.add(
      "text",
      {
        x,
        y,
        text,
        color,
        critical,
        velocityY: critical ? -52 : -38,
      },
      0.9,
    );
  }

  update(deltaTime) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];

      effect.ttl -= deltaTime;

      if (effect.kind === "text") {
        effect.x += Math.sin(effect.ttl * 12) * 12 * deltaTime;
        effect.y += effect.velocityY * deltaTime;
      }

      if (effect.ttl <= 0) {
        this.effects.splice(index, 1);
      }
    }
  }

  draw(context) {
    for (const effect of this.effects) {
      const progress = 1 - effect.ttl / effect.maxTtl;
      const fade = 1 - progress;

      context.save();
      context.globalAlpha = Math.max(0, fade);
      context.strokeStyle = effect.color;
      context.fillStyle = effect.color;
      context.lineWidth = effect.width ?? 4;
      context.shadowColor = effect.color;
      context.shadowBlur = 14;

      switch (effect.kind) {
        case "line": {
          const startX = effect.x;
          const startY = effect.y;

          const endX =
            startX + Math.cos(effect.angle) * effect.length;

          const endY =
            startY + Math.sin(effect.angle) * effect.length;

          context.lineCap = "round";
          context.beginPath();
          context.moveTo(startX, startY);
          context.lineTo(endX, endY);
          context.stroke();
          break;
        }

        case "circle": {
          context.beginPath();
          context.arc(
            effect.x,
            effect.y,
            Math.max(1, effect.radius * (0.75 + progress * 0.25)),
            0,
            TAU,
          );

          if (effect.filled) {
            context.globalAlpha *= 0.2;
            context.fill();
          }

          context.stroke();
          break;
        }

        case "cone": {
          context.beginPath();
          context.moveTo(effect.x, effect.y);
          context.arc(
            effect.x,
            effect.y,
            effect.radius,
            effect.angle - effect.angle / 2,
            effect.angle + effect.angle / 2,
          );
          context.closePath();
          context.globalAlpha *= 0.25;
          context.fill();
          context.globalAlpha = fade;
          context.stroke();
          break;
        }

        case "burst": {
          context.translate(effect.x, effect.y);
          context.rotate(progress * Math.PI);

          for (let index = 0; index < 8; index += 1) {
            const angle = (index / 8) * TAU;
            const length = effect.radius
              ? effect.radius * progress
              : 35 + progress * 35;

            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(
              Math.cos(angle) * length,
              Math.sin(angle) * length,
            );
            context.stroke();
          }
          break;
        }

        case "text": {
          context.shadowBlur = 4;
          context.font = effect.critical
            ? "800 20px Inter, sans-serif"
            : "700 15px Inter, sans-serif";
          context.textAlign = "center";
          context.fillText(
            effect.text,
            effect.x,
            effect.y,
          );
          break;
        }

        default:
          break;
      }

      context.restore();
    }
  }
}
