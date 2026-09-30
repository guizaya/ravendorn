import { describe, expect, it } from "vitest";
import {
  resolveAnimation,
  resolveDirection,
  resolveDrawRect,
  resolveFrame,
  resolveFrameRect,
} from "./animation.js";
import {
  ARBALIST_SPRITE,
  getClassSprite,
} from "../../data/sprites/index.js";

const DIRECTIONS = ARBALIST_SPRITE.directions;

describe("sprite direction", () => {
  it("maps each quadrant to a sprite row", () => {
    const cases = [
      [{ x: 0, y: 1 }, DIRECTIONS.down, false],
      [{ x: 0, y: -1 }, DIRECTIONS.up, false],
      [{ x: 1, y: 0 }, DIRECTIONS.side, false],
      [{ x: -1, y: 0 }, DIRECTIONS.side, true],
    ];

    for (const [facing, row, flip] of cases) {
      expect(resolveDirection(facing, DIRECTIONS)).toEqual({
        row,
        flip,
      });
    }
  });

  it("prefers the vertical axis when it dominates", () => {
    expect(
      resolveDirection({ x: 0.3, y: 0.9 }, DIRECTIONS).row,
    ).toBe(DIRECTIONS.down);

    expect(
      resolveDirection({ x: 0.9, y: 0.3 }, DIRECTIONS).row,
    ).toBe(DIRECTIONS.side);
  });
});

describe("sprite animation selection", () => {
  it("picks attack over walk and idle", () => {
    expect(
      resolveAnimation({
        attackAnimation: 0.1,
        isMoving: true,
      }),
    ).toBe("attack");

    expect(
      resolveAnimation({
        attackAnimation: 0,
        isMoving: true,
      }),
    ).toBe("walk");

    expect(
      resolveAnimation({
        attackAnimation: 0,
        isMoving: false,
      }),
    ).toBe("idle");
  });
});

describe("sprite frame cycling", () => {
  it("loops inside the declared range", () => {
    const animation = {
      start: 2,
      length: 4,
      fps: 10,
    };

    const frames = new Set();

    for (let step = 0; step < 200; step += 1) {
      const frame = resolveFrame(
        animation,
        step / 60,
      );

      expect(frame).toBeGreaterThanOrEqual(2);
      expect(frame).toBeLessThanOrEqual(5);

      frames.add(frame);
    }

    expect([...frames].sort()).toEqual([2, 3, 4, 5]);
  });

  it("never returns the same frame forever", () => {
    const animation = {
      start: 0,
      length: 2,
      fps: 4,
    };

    const frames = new Set();

    for (let step = 0; step < 120; step += 1) {
      frames.add(
        resolveFrame(animation, step / 60),
      );
    }

    expect(frames.size).toBe(2);
  });

  it("handles a zero-length animation without dividing by zero", () => {
    expect(
      resolveFrame({ start: 0, length: 0, fps: 10 }, 1),
    ).toBe(0);
  });
});

describe("sprite frame rect", () => {
  it("reads the correct cell of the sheet", () => {
    const definition = ARBALIST_SPRITE;

    const rect = resolveFrameRect(
      definition,
      "walk",
      0,
      { x: 0, y: 1 },
    );

    expect(rect).toEqual({
      x: 2 * definition.frameWidth,
      y: DIRECTIONS.down * definition.frameHeight,
      width: definition.frameWidth,
      height: definition.frameHeight,
      flip: false,
    });
  });

  it("flags left facing for mirroring", () => {
    const rect = resolveFrameRect(
      ARBALIST_SPRITE,
      "idle",
      0,
      { x: -1, y: 0 },
    );

    expect(rect.flip).toBe(true);
  });
});

describe("sprite draw rect", () => {
  it("anchors the feet near the entity position", () => {
    const definition = ARBALIST_SPRITE;

    const rect = resolveDrawRect(definition, {
      x: 500,
      y: 400,
    });

    expect(rect.x + rect.width / 2).toBe(500);

    const feet = rect.y + definition.anchorY * definition.scale;

    expect(feet).toBe(400 + definition.footOffset);
  });

  it("scales the frame by the declared factor", () => {
    const rect = resolveDrawRect(ARBALIST_SPRITE, {
      x: 0,
      y: 0,
    });

    expect(rect.width).toBe(
      ARBALIST_SPRITE.frameWidth * ARBALIST_SPRITE.scale,
    );
    expect(rect.height).toBe(
      ARBALIST_SPRITE.frameHeight * ARBALIST_SPRITE.scale,
    );
  });
});

describe("sprite manifest", () => {
  const ALL_CLASSES = [
    "warrior",
    "lancer",
    "taoist",
    "sorcerer",
    "arbalist",
    "darkist",
    "lionheart",
    "summoner",
  ];

  it("assigns a sprite to every playable class", () => {
    for (const id of ALL_CLASSES) {
      expect(getClassSprite(id), id).not.toBe(null);
    }
  });

  it("keeps the arbalist definition exported by id", () => {
    expect(getClassSprite("arbalist")).toBe(ARBALIST_SPRITE);
    expect(ARBALIST_SPRITE.id).toBe("arbalist");
  });

  it("falls back to null for unknown ids", () => {
    for (const id of [
      "inexistente",
      "",
      "ARBALIST",
      "warrior ",
    ]) {
      expect(getClassSprite(id)).toBe(null);
    }
  });

  it("gives every class an identical frame layout", () => {
    for (const id of ALL_CLASSES) {
      const sprite = getClassSprite(id);

      expect(sprite.frameWidth).toBe(32);
      expect(sprite.frameHeight).toBe(32);
      expect(sprite.scale).toBe(2);
      expect(sprite.anchorX).toBe(16);
      expect(sprite.anchorY).toBe(27);
      expect(sprite.footOffset).toBe(12);
    }
  });

  it("gives every class a distinct image source", () => {
    const sources = ALL_CLASSES.map(
      (id) => getClassSprite(id).src,
    );

    expect(new Set(sources).size).toBe(
      ALL_CLASSES.length,
    );
  });

  it("keeps every animation inside the sheet", () => {
    for (const id of ALL_CLASSES) {
      const definition = getClassSprite(id);

      for (const animation of Object.values(
        definition.animations,
      )) {
        const last = animation.start + animation.length;

        expect(last).toBeLessThanOrEqual(9);
        expect(animation.length).toBeGreaterThan(0);
        expect(animation.fps).toBeGreaterThan(0);
      }
    }
  });

  it("has a distinct row per direction", () => {
    for (const id of ALL_CLASSES) {
      const rows = Object.values(
        getClassSprite(id).directions,
      );

      expect(new Set(rows).size).toBe(rows.length);
      expect(rows.length).toBe(3);
    }
  });

  it("exposes an image source for every class", () => {
    for (const id of ALL_CLASSES) {
      const src = getClassSprite(id).src;

      expect(typeof src).toBe("string");
      expect(src.length).toBeGreaterThan(0);
    }
  });
});
