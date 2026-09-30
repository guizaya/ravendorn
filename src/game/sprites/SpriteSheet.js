import {
  resolveAnimation,
  resolveCreatureAnimation,
  resolveDrawRect,
  resolveFrameRect,
  resolveWalkOffset,
} from "./animation.js";

export class SpriteSheet {
  constructor(definition) {
    this.definition = definition;
    this.loaded = false;
    this.failed = false;
    this.scratch = null;

    this.image = null;

    if (typeof Image === "undefined") {
      this.failed = true;
      return;
    }

    this.image = this.createImage(definition.src);

    if (!this.image) {
      this.failed = true;
    }
  }

  createImage(src) {
    if (typeof Image === "undefined") return null;

    const image = new Image();

    image.onload = () => {
      this.loaded = true;
    };

    image.onerror = () => {
      this.failed = true;
    };

    image.src = src;

    return image;
  }

  get ready() {
    return this.loaded && this.image !== null;
  }

  createScratch() {
    if (this.scratch) return this.scratch;

    try {
      if (
        typeof document !== "undefined" &&
        typeof document.createElement === "function"
      ) {
        const canvas = document.createElement("canvas");

        if (canvas && typeof canvas.getContext === "function") {
          this.scratch = canvas;
          return canvas;
        }
      }
    } catch {
      this.scratch = null;
    }

    try {
      if (typeof OffscreenCanvas !== "undefined") {
        this.scratch = new OffscreenCanvas(1, 1);
        return this.scratch;
      }
    } catch {
      this.scratch = null;
    }

    return null;
  }

  getScratch(width, height) {
    const scratch = this.createScratch();

    if (!scratch) return null;

    if (
      scratch.width !== width ||
      scratch.height !== height
    ) {
      scratch.width = width;
      scratch.height = height;
    }

    return scratch;
  }

  draw(context, player, elapsed) {
    return this.drawEntity(
      context,
      player,
      elapsed,
      resolveAnimation(player, this.definition),
    );
  }

  drawCreature(context, enemy, elapsed) {
    return this.drawEntity(
      context,
      enemy,
      elapsed,
      resolveCreatureAnimation(enemy),
    );
  }

  drawEntity(context, entity, elapsed, animationName) {
    if (!this.ready) return false;

    const definition = this.definition;

    const source = resolveFrameRect(
      definition,
      animationName,
      elapsed,
      entity.facing,
    );

    const target = resolveDrawRect(definition, entity);
    const offset = resolveWalkOffset(definition, entity);

    target.x += offset.x;
    target.y += offset.y;

    context.save();

    if (source.flip) {
      context.translate(
        target.x + target.width,
        target.y,
      );
      context.scale(-1, 1);
    }

    if (entity.hitFlash > 0) {
      this.drawFlash(
        context,
        source,
        target,
        entity.hitFlash,
      );
    } else {
      context.drawImage(
        this.image,
        source.x,
        source.y,
        source.width,
        source.height,
        target.x,
        target.y,
        target.width,
        target.height,
      );
    }

    context.restore();

    return true;
  }

  drawFlash(context, source, target, amount) {
    const scratch = this.getScratch(
      target.width,
      target.height,
    );

    if (!scratch) return;

    const scratchContext = scratch.getContext("2d");

    scratchContext.clearRect(
      0,
      0,
      target.width,
      target.height,
    );

    scratchContext.imageSmoothingEnabled = false;

    scratchContext.drawImage(
      this.image,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      target.width,
      target.height,
    );

    scratchContext.globalCompositeOperation =
      "source-atop";

    scratchContext.fillStyle = `rgba(255, 255, 255, ${Math.min(
      1,
      amount * 4,
    )})`;

    scratchContext.fillRect(
      0,
      0,
      target.width,
      target.height,
    );

    scratchContext.globalCompositeOperation =
      "source-over";

    context.drawImage(
      scratch,
      0,
      0,
      target.width,
      target.height,
      target.x,
      target.y,
      target.width,
      target.height,
    );
  }

  destroy() {
    if (this.image) {
      this.image.onload = null;
      this.image.onerror = null;
      this.image.src = "";
    }

    this.image = null;
    this.scratch = null;
    this.loaded = false;
  }
}
