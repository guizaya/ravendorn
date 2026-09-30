import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { TEST_MAP } from "../../data/maps/index.js";
import { DIRECTION_KEYS, resolveDirectionKey } from "../sprites/animation.js";
import { ARBALIST_SPRITE } from "../../data/sprites/index.js";
import {
  installDomStubs,
} from "./testHarness.js";

installDomStubs();

const ARBALIST = CHARACTER_CLASSES.find(
  (definition) => definition.id === "arbalist",
);

const loadedImages = [];
const scratchContexts = new Map();
const consumedCalls = new Map();
let scratchSequentialId = 0;

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

function installStubs() {
  loadedImages.length = 0;
  scratchContexts.clear();
  consumedCalls.clear();
  scratchSequentialId = 0;

  globalThis.Image = class {
    constructor() {
      this.width = 64;
      this.height = 64;
      this.complete = true;
      this.onload = null;
      this.onerror = null;
      this.src = "";
      loadedImages.push(this);
    }

    set src(value) {
      this.source = value;
      this.onload?.();
    }

    get src() {
      return this.source ?? "";
    }
  };

  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") return {};

      scratchSequentialId += 1;

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

function createEngine() {
  const listeners = {};
  const context = makeContext();

  const element = {
    width: 1280,
    height: 720,

    getContext: () => context,

    addEventListener(type, handler) {
      (listeners[type] ??= []).push(handler);
    },

    removeEventListener(type, handler) {
      listeners[type] = (listeners[type] ?? []).filter(
        (item) => item !== handler,
      );
    },

    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    }),
  };

  const engine = new GameEngine(
    element,
    ARBALIST,
    () => {},
  );

  engine.setMap(TEST_MAP);
  engine.currentContext = context;

  return engine;
}

function drawPlayerFrame(engine) {
  engine.render();

  const contexts = [engine.currentContext];

  for (const sheet of allSheets(engine)) {
    if (sheet.scratch && scratchContexts.has(sheet.scratch)) {
      contexts.push(scratchContexts.get(sheet.scratch));
    }
  }

  const calls = contexts.flatMap(collectNew);
  return calls;
}

function collectNew(context) {
  const start = consumedCalls.get(context) ?? 0;
  const slice = context.calls.slice(start);

  consumedCalls.set(context, context.calls.length);

  return slice;
}

function allSheets(engine) {
  return [
    engine.spriteSheet,
    ...engine.enemySprites.values(),
  ];
}

function clearCombat(engine) {
  engine.world.enemies.length = 0;
  engine.world.projectiles.length = 0;
  engine.world.pendingPulses.length = 0;
  engine.world.delayedEffects.length = 0;
  engine.world.drops.length = 0;
}

function sheetDraws(engine, calls) {
  const image = engine.spriteSheet.image;

  return calls.filter(
    ([name, source]) =>
      name === "drawImage" && source === image,
  );
}

function keyOfRow(row) {
  return DIRECTION_KEYS.find(
    (key) => ARBALIST_SPRITE.directions[key] === row,
  );
}

function expectDrawMatchesFacing(engine, calls, player, label) {
  const drawn = sheetDraws(engine, calls);

  expect(drawn.length, label).toBeGreaterThan(0);

  const idleRow = ARBALIST_SPRITE.animations.idle.row;

  for (const [, , , row] of drawn) {
    if (!player.isMoving) {
      expect(row / 64, `${label} parado`).toBe(idleRow);
      continue;
    }

    expect(
      keyOfRow(row / 64),
      `${label} andando`,
    ).toBe(
      resolveDirectionKey(
        player.facing,
        ARBALIST_SPRITE.fallbackDirection,
      ),
    );
  }

  return drawn;
}

function resetPlayer(player) {
  player.hp = player.maxHp;
  player.attackAnimation = 0;
  player.hitFlash = 0;
  player.x = 1200;
  player.y = 800;
}

function holdKeys(engine, codes) {
  engine.input.keys.clear();

  for (const code of codes) {
    engine.input.keys.add(code);
  }
}

function drawDestY(engine, calls) {
  for (const call of calls) {
    const [name, source, , , , , , dy] = call;

    if (
      name === "drawImage" &&
      source === engine.spriteSheet.image
    ) {
      return dy;
    }
  }

  return null;
}

function bobOffset(engine, calls) {
  const y = drawDestY(engine, calls);

  if (y === null) return null;

  const player = engine.world.player;

  const base =
    player.y +
    ARBALIST_SPRITE.footOffset -
    ARBALIST_SPRITE.anchorY * ARBALIST_SPRITE.scale;

  return y - base;
}

beforeEach(() => {
  installStubs();
});

afterEach(() => {
  removeStubs();
});

describe("arbalist directional sheet in game", () => {
  it("loads the generated sheet instead of one gif per direction", () => {
    const engine = createEngine();

    const playerImages = loadedImages.filter(
      (image) => image.source === ARBALIST_SPRITE.src,
    );

    expect(playerImages).toHaveLength(1);
    expect(engine.spriteSheet.ready).toBe(true);
    expect(engine.spriteSheet.image).toBe(
      playerImages[0],
    );

    expect(
      loadedImages.some((image) =>
        image.source?.endsWith(".gif"),
      ),
    ).toBe(false);

    expect(ARBALIST_SPRITE.src.endsWith(".png")).toBe(true);

    engine.destroy();
  });

  it("draws the row matching the walk direction", () => {
    const engine = createEngine();
    const player = engine.world.player;

    const cases = [
      [["KeyD"], "east"],
      [["KeyD", "KeyS"], "south-east"],
      [["KeyS"], "south"],
      [["KeyA", "KeyS"], "south-west"],
      [["KeyA"], "west"],
      [["KeyA", "KeyW"], "north-west"],
      [["KeyW"], "north"],
      [["KeyW", "KeyD"], "north-east"],
    ];

    for (const [codes, key] of cases) {
      resetPlayer(player);
      holdKeys(engine, codes);

      engine.update(1 / 60);

      expectDrawMatchesFacing(
        engine,
        drawPlayerFrame(engine),
        player,
        key,
      );

      expect(
        player.facing.x !== 0 || player.facing.y !== 0,
        key,
      ).toBe(true);
    }

    engine.destroy();
  });

  it("ignores the pointer and follows the walk direction", () => {
    const engine = createEngine();
    const player = engine.world.player;

    const cases = [
      [["KeyD"], { x: 0, y: 300 }, "east"],
      [["KeyS"], { x: -300, y: 0 }, "south"],
      [["KeyW"], { x: 300, y: 300 }, "north"],
      [["KeyA"], { x: 300, y: -300 }, "west"],
    ];

    for (const [codes, pointer, key] of cases) {
      resetPlayer(player);
      holdKeys(engine, codes);

      engine.input.pointer = {
        x: player.x + pointer.x,
        y: player.y + pointer.y,
        inside: true,
      };

      engine.update(1 / 60);

      expect(
        resolveDirectionKey(player.facing),
        `${codes.join("+")} com mouse em ${pointer.x},${pointer.y}`,
      ).toBe(key);

      expectDrawMatchesFacing(
        engine,
        drawPlayerFrame(engine),
        player,
        key,
      );
    }

    engine.destroy();
  });

  it("never mirrors because every direction has its own row", () => {
    const engine = createEngine();
    const player = engine.world.player;

    const cases = [
      [["KeyD"]],
      [["KeyD", "KeyS"]],
      [["KeyS"]],
      [["KeyA", "KeyS"]],
      [["KeyA"]],
      [["KeyA", "KeyW"]],
      [["KeyW"]],
      [["KeyW", "KeyD"]],
    ];

    for (const [codes] of cases) {
      resetPlayer(player);
      holdKeys(engine, codes);

      engine.update(1 / 60);

      const calls = drawPlayerFrame(engine);

      expect(
        calls.some(([name]) => name === "scale"),
        codes.join("+"),
      ).toBe(false);

      expect(
        sheetDraws(engine, calls).length,
        codes.join("+"),
      ).toBeGreaterThan(0);
    }

    engine.destroy();
  });

  it("keeps the last walk direction while standing still", () => {
    const engine = createEngine();
    const player = engine.world.player;

    resetPlayer(player);
    holdKeys(engine, ["KeyS"]);

    engine.update(1 / 60);

    const before = { ...player.facing };

    expect(resolveDirectionKey(before)).toBe("south");

    holdKeys(engine, []);

    engine.input.pointer = {
      x: player.x + 300,
      y: player.y - 300,
      inside: true,
    };

    for (let frame = 0; frame < 5; frame += 1) {
      engine.update(1 / 60);

      expect(player.facing).toEqual(before);
      expect(player.isMoving).toBe(false);
    }

    const calls = drawPlayerFrame(engine);

    expectDrawMatchesFacing(engine, calls, player, "south");

    const northEastRow =
      ARBALIST_SPRITE.directions["north-east"] * 64;

    expect(
      sheetDraws(engine, calls).some(
        ([, , , row]) => row === northEastRow,
      ),
      "o mouse nao pode virar o sprite",
    ).toBe(false);

    engine.destroy();
  });

  it("bobs the sprite while walking instead of sliding on one frame", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);
    holdKeys(engine, ["KeyS"]);

    const amplitude =
      ARBALIST_SPRITE.walkBob.amplitude;

    const samples = [];

    for (let frame = 0; frame < 70; frame += 1) {
      engine.update(1 / 60);

      const offset = bobOffset(
        engine,
        drawPlayerFrame(engine),
      );

      expect(offset, `frame ${frame}`).not.toBe(null);

      samples.push(offset);
    }

    const min = Math.min(...samples);
    const max = Math.max(...samples);

    expect(
      max,
      `o bob nunca pode levantar o sprite: ${min}..${max}`,
    ).toBeLessThanOrEqual(0.01);

    expect(
      min,
      `amplitude real: ${min}..${max}`,
    ).toBeLessThanOrEqual(-amplitude + 0.5);

    expect(
      max - min,
      `amplitude real: ${min}..${max}`,
    ).toBeGreaterThanOrEqual(amplitude - 1);

    expect(
      new Set(samples).size,
      "cada frame precisa de um offset proprio",
    ).toBeGreaterThan(20);

    expect(player.walkBlend).toBeGreaterThan(0.99);

    engine.destroy();
  });

  it("settles back to rest when the walk stops", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);
    holdKeys(engine, ["KeyS"]);

    for (let frame = 0; frame < 40; frame += 1) {
      engine.update(1 / 60);
    }

    expect(player.walkBlend).toBeGreaterThan(0.9);

    const amplitude =
      ARBALIST_SPRITE.walkBob.amplitude;

    holdKeys(engine, []);

    const tail = [];

    for (let frame = 0; frame < 60; frame += 1) {
      engine.update(1 / 60);

      const offset = bobOffset(
        engine,
        drawPlayerFrame(engine),
      );

      if (player.walkBlend < 0.01) {
        tail.push(offset);
      }
    }

    expect(player.isMoving).toBe(false);
    expect(player.walkBlend).toBeLessThan(0.01);
    expect(tail.length).toBeGreaterThan(10);

    for (const offset of tail) {
      expect(
        Math.abs(offset),
        `repouso em ${offset}`,
      ).toBeLessThanOrEqual(amplitude * 0.01);
    }

    engine.destroy();
  });

  it("keeps the bob continuous instead of popping on start", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);
    holdKeys(engine, ["KeyS"]);

    const samples = [];

    for (let frame = 0; frame < 14; frame += 1) {
      engine.update(1 / 60);

      samples.push(
        bobOffset(engine, drawPlayerFrame(engine)),
      );
    }

    expect(
      Math.abs(samples[0]),
      `primeiro frame de caminhada: ${samples[0]}`,
    ).toBeLessThan(0.5);

    for (let i = 1; i < samples.length; i += 1) {
      expect(
        Math.abs(samples[i] - samples[i - 1]),
        `salto no frame ${i}: ${samples[i - 1]} -> ${samples[i]}`,
      ).toBeLessThanOrEqual(1);
    }

    engine.destroy();
  });

  it("switches to the idle row the moment the archer stops", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);

    const idleRow = ARBALIST_SPRITE.animations.idle.row;
    const southRow = ARBALIST_SPRITE.directions.south;

    holdKeys(engine, ["KeyS"]);

    for (let frame = 0; frame < 10; frame += 1) {
      engine.update(1 / 60);

      const [draw] = sheetDraws(engine, drawPlayerFrame(engine));

      expect(draw[3], `frame ${frame} andando`).toBe(
        southRow * 64,
      );
    }

    holdKeys(engine, []);

    engine.update(1 / 60);

    let [draw] = sheetDraws(
      engine,
      drawPlayerFrame(engine),
    );

    expect(player.isMoving).toBe(false);
    expect(draw[3], "parou").toBe(idleRow * 64);

    for (let frame = 0; frame < 60; frame += 1) {
      engine.update(1 / 60);

      [draw] = sheetDraws(engine, drawPlayerFrame(engine));

      expect(draw[3], `frame ${frame} parado`).toBe(
        idleRow * 64,
      );
    }

    engine.destroy();
  });

  it("shows the idle row whatever direction it stopped in", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);

    const idleRow = ARBALIST_SPRITE.animations.idle.row;

    const cases = [
      [["KeyD"], "east"],
      [["KeyS"], "south"],
      [["KeyW"], "north"],
      [["KeyA"], "west"],
      [["KeyW", "KeyD"], "north-east"],
      [["KeyA", "KeyS"], "south-west"],
    ];

    for (const [codes, key] of cases) {
      resetPlayer(player);
      holdKeys(engine, codes);

      for (let frame = 0; frame < 6; frame += 1) {
        engine.update(1 / 60);
      }

      holdKeys(engine, []);

      engine.update(1 / 60);

      const [draw] = sheetDraws(
        engine,
        drawPlayerFrame(engine),
      );

      expect(draw[3], `parou olhando ${key}`).toBe(
        idleRow * 64,
      );
    }

    engine.destroy();
  });

  it("keeps the idle row while attacking on the spot", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);
    holdKeys(engine, []);

    player.attackAnimation = 0.2;

    engine.update(1 / 60);

    const [draw] = sheetDraws(
      engine,
      drawPlayerFrame(engine),
    );

    expect(draw[3]).toBe(
      ARBALIST_SPRITE.animations.idle.row * 64,
    );

    engine.destroy();
  });

  it("follows the target direction while auto play runs", () => {
    const engine = createEngine();
    const player = engine.world.player;

    engine.setAutoPlay(true);

    for (const skill of engine.classDefinition.skills) {
      engine.setSkillAuto(skill.id, true);
    }

    player.maxHp = 1e9;
    player.hp = 1e9;

    const used = new Set();
    const moving = new Set();
    const columns = new Set();

    let movingFrames = 0;
    let bobbingFrames = 0;

    for (let frame = 0; frame < 900; frame += 1) {
      engine.update(1 / 60);

      const calls = drawPlayerFrame(engine);
      const drawn = expectDrawMatchesFacing(
        engine,
        calls,
        player,
        `frame ${frame}`,
      );

      for (const [, , column] of drawn) {
        columns.add(column);
      }

      if (player.isMoving) {
        expect(
          player.facing,
          `frame ${frame}`,
        ).toEqual(player.moveDirection);

        movingFrames += 1;

        const [first] = sheetDraws(engine, calls);

        used.add(keyOfRow(first[3] / 64));
        moving.add(first[2] / 64);

        const offset = bobOffset(engine, calls);

        if (offset !== null && offset < -0.5) {
          bobbingFrames += 1;
        }
      }
    }

    expect(movingFrames).toBeGreaterThan(100);
    expect(bobbingFrames).toBeGreaterThan(20);
    expect(moving.size).toBeGreaterThanOrEqual(2);
    expect(used.size).toBeGreaterThanOrEqual(2);
    expect(columns.size).toBe(8);

    for (const key of used) {
      expect(DIRECTION_KEYS, key).toContain(key);
    }

    engine.destroy();
  });

  it("survives the vector fallback body when the sheet is missing", () => {
    globalThis.Image = class {
      constructor() {
        this.width = 0;
        this.height = 0;
        this.complete = false;
        this.onload = null;
        this.onerror = null;
        this.src = "";
      }
    };

    const engine = createEngine();

    engine.setAutoPlay(true);

    for (let frame = 0; frame < 120; frame += 1) {
      engine.world.player.hp = engine.world.player.maxHp;
      engine.update(1 / 60);

      expect(
        () => engine.render(),
        `frame ${frame}`,
      ).not.toThrow();
    }

    expect(engine.spriteSheet.ready).toBe(false);

    engine.destroy();
  });

  it("keeps the hit flash working on top of the sheet", () => {
    const engine = createEngine();
    const player = engine.world.player;

    player.hp = player.maxHp;
    player.hitFlash = 0.18;

    engine.input.pointer = {
      x: player.x - 300,
      y: player.y - 300,
      inside: true,
    };

    engine.update(1 / 60);

    const calls = drawPlayerFrame(engine);

    expect(
      calls.some(
        ([name, source]) =>
          name === "drawImage" && source === engine.spriteSheet.scratch,
      ),
    ).toBe(true);

    engine.destroy();
  });
});
