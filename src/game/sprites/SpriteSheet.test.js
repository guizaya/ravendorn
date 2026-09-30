import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SpriteSheet } from "./SpriteSheet.js";
import { ARBALIST_SPRITE, getClassSprite } from "../../data/sprites/index.js";
import { ENEMY_SPRITES } from "../../data/sprites/enemies.js";

const created = [];
const scratchContexts = new Map();
const consumedCalls = new Map();

function makeContext() {
  const calls = [];
  const store = {};

  const context = new Proxy(store, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        calls.push([key, ...args]);
      };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });

  context.calls = calls;

  return context;
}

function loadAll() {
  for (const image of created.splice(0, created.length)) {
    image.onload?.();
  }
}

function installImageStub() {
  created.length = 0;

  globalThis.Image = class {
    constructor() {
      this.width = 512;
      this.height = 512;
      this.complete = false;
      this.onload = null;
      this.onerror = null;
      this.src = "";
      created.push(this);
    }
  };
}

function installCanvasStub() {
  scratchContexts.clear();
  consumedCalls.clear();

  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") return {};

      const scratchContext = makeContext();

      const canvas = {
        width: 0,
        height: 0,
        getContext: () => scratchContext,
      };

      scratchContexts.set(canvas, scratchContext);

      return canvas;
    },
  };
}

function removeStubs() {
  delete globalThis.Image;
  delete globalThis.document;
}

function makeSheet(definition) {
  const sheet = new SpriteSheet(definition);
  loadAll();
  return sheet;
}

function collectNew(context) {
  const start = consumedCalls.get(context) ?? 0;
  const slice = context.calls.slice(start);

  consumedCalls.set(context, context.calls.length);

  return slice;
}

function sheetCalls(sheet) {
  const contexts = [makeContext()];

  contexts[0].calls = [];

  sheet.draw(
    contexts[0],
    {
      x: 0,
      y: 0,
      facing: { x: 0, y: 1 },
      isMoving: false,
      attackAnimation: 0,
      hitFlash: 0,
    },
    0,
  );

  return contexts[0].calls;
}

function drawOf(sheet, entity, elapsed) {
  const context = makeContext();

  sheet.draw(context, entity, elapsed);

  return context.calls.find(([name]) => name === "drawImage");
}

const IDLE_ENTITY = {
  x: 100,
  y: 100,
  facing: { x: 0, y: 1 },
  isMoving: false,
  attackAnimation: 0,
  hitFlash: 0,
};

function entity(overrides) {
  return { ...IDLE_ENTITY, ...overrides };
}

beforeEach(() => {
  installImageStub();
  installCanvasStub();
});

afterEach(() => {
  removeStubs();
});

describe("sprite loading", () => {
  it("requests a single image for the arbalist sheet", () => {
    const sheet = new SpriteSheet(ARBALIST_SPRITE);

    expect(created).toHaveLength(1);
    expect(created[0].src).toBe(ARBALIST_SPRITE.src);

    loadAll();
    sheet.destroy();
  });

  it("reports ready only after the image loads", () => {
    const sheet = new SpriteSheet(ARBALIST_SPRITE);

    expect(sheet.ready).toBe(false);

    loadAll();

    expect(sheet.ready).toBe(true);

    sheet.destroy();
  });

  it("fails cleanly when there is no image support", () => {
    const saved = globalThis.Image;
    delete globalThis.Image;

    const sheet = new SpriteSheet(ARBALIST_SPRITE);

    expect(sheet.failed).toBe(true);
    expect(sheet.ready).toBe(false);

    globalThis.Image = saved;
  });

  it("releases the image on destroy", () => {
    const sheet = makeSheet(ARBALIST_SPRITE);
    const image = sheet.image;

    sheet.destroy();

    expect(image.onload).toBe(null);
    expect(image.onerror).toBe(null);
    expect(image.src).toBe("");
    expect(sheet.ready).toBe(false);
  });
});

describe("directional sprite drawing", () => {
  it("reads the row that matches the facing while walking", () => {
    const sheet = makeSheet(ARBALIST_SPRITE);

    const cases = [
      [{ x: 1, y: 0 }, "east"],
      [{ x: 1, y: 1 }, "south-east"],
      [{ x: 0, y: 1 }, "south"],
      [{ x: -1, y: 1 }, "south-west"],
      [{ x: -1, y: 0 }, "west"],
      [{ x: -1, y: -1 }, "north-west"],
      [{ x: 0, y: -1 }, "north"],
      [{ x: 1, y: -1 }, "north-east"],
    ];

    for (const [facing, key] of cases) {
      const [, , sx, sy] = drawOf(
        sheet,
        entity({ facing, isMoving: true }),
        0,
      );

      expect(sy, key).toBe(
        ARBALIST_SPRITE.directions[key] * 64,
      );

      expect(sx, key).toBe(0);
    }

    sheet.destroy();
  });

  it("reads the idle row no matter the facing", () => {
    const sheet = makeSheet(ARBALIST_SPRITE);

    const idleRow = ARBALIST_SPRITE.animations.idle.row;

    for (const facing of [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
    ]) {
      const [, , , sy] = drawOf(
        sheet,
        entity({ facing, isMoving: false }),
        0,
      );

      expect(sy, JSON.stringify(facing)).toBe(idleRow * 64);
    }

    sheet.destroy();
  });

  it("keeps the idle row while attacking on the spot", () => {
    const sheet = makeSheet(ARBALIST_SPRITE);
    const idleRow = ARBALIST_SPRITE.animations.idle.row;

    const [, , , sy] = drawOf(
      sheet,
      entity({
        facing: { x: 0, y: 1 },
        isMoving: false,
        attackAnimation: 0.2,
      }),
      0,
    );

    expect(sy).toBe(idleRow * 64);

    const [, , , walkSy] = drawOf(
      sheet,
      entity({
        facing: { x: 0, y: 1 },
        isMoving: true,
        attackAnimation: 0.2,
      }),
      0,
    );

    expect(walkSy).toBe(
      ARBALIST_SPRITE.directions.south * 64,
    );

    sheet.destroy();
  });

  it("advances the column over time instead of freezing", () => {
    const sheet = makeSheet(ARBALIST_SPRITE);

    const columns = new Set();

    for (let step = 0; step < 60; step += 1) {
      const [, , sx] = drawOf(
        sheet,
        entity({ isMoving: true }),
        step / 60,
      );

      columns.add(sx);
    }

    expect(columns.size).toBe(8);

    for (const column of columns) {
      expect(Number.isInteger(column / 64)).toBe(true);
      expect(column).toBeLessThan(8 * 64);
    }

    sheet.destroy();
  });

  it("advances faster while walking than while idling", () => {
    const sheet = makeSheet(ARBALIST_SPRITE);

    const walkFrames = ARBALIST_SPRITE.animations.walk.length;
    const idleFrames = ARBALIST_SPRITE.animations.idle.length;

    const steps = 3 * 60;

    const walkChanges = new Set();
    const idleChanges = new Set();

    let walkSwitches = 0;
    let idleSwitches = 0;

    let previousWalk = null;
    let previousIdle = null;

    for (let step = 0; step < steps; step += 1) {
      const [, , walkX] = drawOf(
        sheet,
        entity({ isMoving: true }),
        step / 60,
      );

      const [, , idleX] = drawOf(
        sheet,
        entity({ isMoving: false }),
        step / 60,
      );

      if (previousWalk !== null && walkX !== previousWalk) {
        walkSwitches += 1;
      }

      if (previousIdle !== null && idleX !== previousIdle) {
        idleSwitches += 1;
      }

      previousWalk = walkX;
      previousIdle = idleX;

      walkChanges.add(walkX);
      idleChanges.add(idleX);
    }

    expect(walkChanges.size).toBe(walkFrames);
    expect(idleChanges.size).toBe(idleFrames);

    expect(walkSwitches).toBeGreaterThan(idleSwitches * 2);

    expect(
      ARBALIST_SPRITE.animations.walk.fps,
    ).toBeGreaterThan(
      ARBALIST_SPRITE.animations.idle.fps,
    );

    sheet.destroy();
  });

  it("blits the cell into the 64x64 draw box", () => {
    const sheet = makeSheet(ARBALIST_SPRITE);

    const [, , sx, sy, sw, sh, dx, dy, dw, dh] = drawOf(
      sheet,
      entity({
        x: 200,
        y: 300,
        facing: { x: 0, y: 1 },
        isMoving: true,
      }),
      0,
    );

    expect([sx, sy, sw, sh]).toEqual([0, 128, 64, 64]);
    expect([dx, dy]).toEqual([168, 258]);
    expect([dw, dh]).toEqual([64, 64]);

    sheet.destroy();
  });

  it("never mirrors because every direction has its own row", () => {
    const sheet = makeSheet(ARBALIST_SPRITE);

    for (let degree = 0; degree < 360; degree += 15) {
      const radians = (degree * Math.PI) / 180;
      const context = makeContext();

      sheet.draw(
        context,
        entity({
          facing: {
            x: Math.cos(radians),
            y: Math.sin(radians),
          },
          isMoving: true,
        }),
        0,
      );

      expect(
        context.calls.some(([name]) => name === "scale"),
        `${degree} graus`,
      ).toBe(false);
    }

    sheet.destroy();
  });

  it("draws nothing before the sheet loads", () => {
    const sheet = new SpriteSheet(ARBALIST_SPRITE);
    const context = makeContext();

    expect(sheet.draw(context, IDLE_ENTITY, 0)).toBe(false);
    expect(context.calls).toHaveLength(0);

    loadAll();
    sheet.destroy();
  });

  it("bobs a directional gif with the walk state", () => {
    const sheet = makeSheet(ARBALIST_SPRITE);
    const amplitude = ARBALIST_SPRITE.walkBob.amplitude;

    const ys = [];

    for (let step = 0; step < 60; step += 1) {
      const [, , , , , , , dy] = drawOf(
        sheet,
        entity({
          isMoving: true,
          walkPhase: step / 60,
          walkBlend: 1,
        }),
        step / 60,
      );

      ys.push(dy);
    }

    expect(ys.length).toBe(60);
    expect(new Set(ys).size).toBeGreaterThan(10);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(
      amplitude,
      6,
    );

    sheet.destroy();
  });

  it("never bobs a sheet sprite", () => {
    const sheet = makeSheet(getClassSprite("warrior"));

    const ys = new Set();

    for (let step = 0; step < 60; step += 1) {
      const [, , , , , , , dy] = drawOf(
        sheet,
        entity({
          facing: { x: 1, y: 0 },
          isMoving: true,
          walkPhase: step / 60,
          walkBlend: 1,
        }),
        step / 60,
      );

      ys.add(dy);
    }

    expect(ys.size).toBe(1);

    sheet.destroy();
  });

  it("flashes white from the cell the player faces", () => {
    const sheet = makeSheet(ARBALIST_SPRITE);
    const context = makeContext();

    const drawn = sheet.draw(
      context,
      entity({
        facing: { x: -1, y: -1 },
        isMoving: true,
        hitFlash: 0.18,
      }),
      0,
    );

    expect(drawn).toBe(true);

    const scratchContext = scratchContexts.get(sheet.scratch);
    const scratchDraw = scratchContext.calls.find(
      ([name, source]) =>
        name === "drawImage" && source === sheet.image,
    );

    expect(scratchDraw).toBeDefined();
    expect(scratchDraw[2]).toBe(0);
    expect(scratchDraw[3]).toBe(5 * 64);
    expect(
      context.calls.some(
        ([name, source]) =>
          name === "drawImage" && source === sheet.scratch,
      ),
    ).toBe(true);
    expect(scratchContext.fillStyle).toBe(
      "rgba(255, 255, 255, 0.72)",
    );

    sheet.destroy();
  });
});

describe("sheet sprite drawing", () => {
  it("still mirrors a left facing sheet", () => {
    const sheet = makeSheet(getClassSprite("warrior"));
    const context = makeContext();

    const drawn = sheet.draw(
      context,
      entity({ facing: { x: -1, y: 0 }, isMoving: true }),
      0,
    );

    expect(drawn).toBe(true);
    expect(
      context.calls.some(([name]) => name === "scale"),
    ).toBe(true);

    sheet.destroy();
  });

  it("keeps the attack animation for creatures", () => {
    const sheet = makeSheet(ENEMY_SPRITES.slime);
    const context = makeContext();

    const drawn = sheet.drawCreature(
      context,
      {
        x: 0,
        y: 0,
        facing: { x: 0, y: 1 },
        aiState: "idle",
        attackAnimation: 0.2,
        hitFlash: 0,
      },
      0,
    );

    expect(drawn).toBe(true);

    const [, , sx] = context.calls.find(
      ([key]) => key === "drawImage",
    );

    expect(sx).toBe(6 * ENEMY_SPRITES.slime.frameWidth);

    sheet.destroy();
  });

  it("keeps the fallback body when the sheet never loads", () => {
    const sheet = new SpriteSheet(getClassSprite("warrior"));

    expect(sheet.draw(makeContext(), IDLE_ENTITY, 0)).toBe(
      false,
    );

    loadAll();
    sheet.destroy();
  });
});
