import {
  resolveAnimation,
  resolveCreatureAnimation,
  resolveDirection,
  resolveDrawRect,
  resolveFrameRect,
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

    this.image = new Image();

    this.image.onload = () => {
      this.loaded = true;
    };

    this.image.onerror = () => {
      this.failed = true;
    };

    this.image.src = definition.src;
  }

  get ready() {
    return this.loaded && this.image !== null;
  }

  getScratch(width, height) {
    if (
      this.scratch &&
      (this.scratch.width !== width ||
        this.scratch.height !== height)
    ) {
      this.scratch.width = width;
      this.scratch.height = height;
    }

    return this.scratch;
  }

  draw(context, player, elapsed) {
    return this.drawEntity(
      context,
      player,
      elapsed,
      resolveAnimation(player),
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

    context.save();

    if (target.flip) {
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

    this.scratch = null;
    this.loaded = false;
  }
}
