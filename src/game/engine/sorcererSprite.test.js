import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import {
  DIRECTION_KEYS,
  resolveDirectionKey,
  resolveFrameRect,
} from "../sprites/animation.js";
import { SORCERER_SPRITE } from "../../data/sprites/index.js";
import { installDomStubs } from "./testHarness.js";

installDomStubs();

const SORCERER = CHARACTER_CLASSES.find(
  (definition) => definition.id === "sorcerer",
);

const CELL = SORCERER_SPRITE.frameWidth;
const IDLE_ROW = SORCERER_SPRITE.animations.idle.row;

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
      this.width = CELL;
      this.height = CELL;
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
      (listeners[type] = listeners[type] ?? []).filter(
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

  const engine = new GameEngine(element, SORCERER, () => {});

  engine.setMap(MAP_1);
  engine.currentContext = context;

  return engine;
}

function collectNew(context) {
  const start = consumedCalls.get(context) ?? 0;
  const slice = context.calls.slice(start);

  consumedCalls.set(context, context.calls.length);

  return slice;
}

function drawPlayerFrame(engine) {
  engine.render();

  const contexts = [engine.currentContext];

  if (
    engine.spriteSheet.scratch &&
    scratchContexts.has(engine.spriteSheet.scratch)
  ) {
    contexts.push(scratchContexts.get(engine.spriteSheet.scratch));
  }

  return contexts.flatMap(collectNew);
}

function sheetDraws(engine, calls) {
  const image = engine.spriteSheet.image;

  return calls.filter(
    ([name, source]) =>
      name === "drawImage" && source === image,
  );
}

/**
 * A linha que o desenho do jogador deveria estar usando.
 *
 * O esperado sai da DEFINICAO, e nao de uma copia dos numeros: e a
 * definicao que o motor le, e um numero repetido aqui passaria junto
 * com qualquer erro dela
 */
function expectedRow(player) {
  if (player.hitFlash > 0) {
    return IDLE_ROW;
  }

  if (player.attackAnimation > 0) {
    // o sorcerer declara `attack` apontando para a linha de idle: e o
    // que o usuario pediu enquanto nao houver arte de golpe
    return SORCERER_SPRITE.animations.attack.row;
  }

  return player.isMoving
    ? SORCERER_SPRITE.directions[
        resolveDirectionKey(
          player.facing,
          SORCERER_SPRITE.fallbackDirection,
        )
      ]
    : IDLE_ROW;
}

function expectPlayerRow(engine, player, label) {
  const drawn = sheetDraws(engine, drawPlayerFrame(engine));

  expect(drawn.length, label).toBeGreaterThan(0);

  for (const [, , , row] of drawn) {
    expect(row / CELL, label).toBe(expectedRow(player));
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

function clearCombat(engine) {
  engine.world.enemies.length = 0;
  engine.world.projectiles.length = 0;
  engine.world.pendingPulses.length = 0;
  engine.world.delayedEffects.length = 0;
  engine.world.drops.length = 0;
}

function holdKeys(engine, codes) {
  engine.input.keys.clear();

  for (const code of codes) {
    engine.input.keys.add(code);
  }
}

beforeEach(() => {
  installStubs();
});

afterEach(() => {
  removeStubs();
});

describe("sorcerer directional sheet in game", () => {
  it("loads the generated sheet instead of one gif per direction", () => {
    const engine = createEngine();

    const playerImages = loadedImages.filter(
      (image) => image.source === SORCERER_SPRITE.src,
    );

    expect(playerImages).toHaveLength(1);
    expect(engine.spriteSheet.ready).toBe(true);
    expect(engine.spriteSheet.image).toBe(playerImages[0]);

    expect(
      loadedImages.some((image) =>
        image.source?.endsWith(".gif"),
      ),
    ).toBe(false);

    expect(SORCERER_SPRITE.src.endsWith(".png")).toBe(true);
    expect(SORCERER_SPRITE.src).toContain("sorcerer-sheet.png");

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
      clearCombat(engine);
      resetPlayer(player);
      holdKeys(engine, codes);

      engine.update(1 / 60);

      expect(player.isMoving, key).toBe(true);
      expect(resolveDirectionKey(player.facing), key).toBe(key);

      expectPlayerRow(engine, player, key);
    }

    engine.destroy();
  });

  it("never mirrors because every direction has its own row", () => {
    const engine = createEngine();
    const player = engine.world.player;

    // este teste e sobre o JOGADOR: esvaziar o mapa deixa o `scale`
    // do frame ser do sorcerer e so dele
    clearCombat(engine);

    const cases = [
      ["east", ["KeyD"]],
      ["south-east", ["KeyD", "KeyS"]],
      ["south", ["KeyS"]],
      ["south-west", ["KeyA", "KeyS"]],
      ["west", ["KeyA"]],
      ["north-west", ["KeyA", "KeyW"]],
      ["north", ["KeyW"]],
      ["north-east", ["KeyW", "KeyD"]],
    ];

    for (const [key, codes] of cases) {
      resetPlayer(player);
      holdKeys(engine, codes);

      engine.update(1 / 60);

      const calls = drawPlayerFrame(engine);

      expect(
        calls.some(([name]) => name === "scale"),
        key,
      ).toBe(false);

      expect(sheetDraws(engine, calls).length, key).toBeGreaterThan(0);
    }

    engine.destroy();
  });

  it("switches to the idle row the moment the sorcerer stops", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);

    holdKeys(engine, ["KeyS"]);

    for (let frame = 0; frame < 10; frame += 1) {
      engine.update(1 / 60);

      const [draw] = sheetDraws(
        engine,
        drawPlayerFrame(engine),
      );

      expect(draw[3], `frame ${frame} andando`).toBe(
        SORCERER_SPRITE.directions.south * CELL,
      );
    }

    holdKeys(engine, []);

    engine.update(1 / 60);

    expect(player.isMoving).toBe(false);

    for (let frame = 0; frame < 60; frame += 1) {
      engine.update(1 / 60);

      const [draw] = sheetDraws(
        engine,
        drawPlayerFrame(engine),
      );

      expect(draw[3], `frame ${frame} parado`).toBe(
        IDLE_ROW * CELL,
      );
    }

    engine.destroy();
  });

  /**
   * O pedido: enquanto nao existir arte de golpe, o sorcerer fica no
   * idle durante o ataque
   */
  it("shows the idle row while attacking", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);
    holdKeys(engine, []);

    // parado, com a janela de golpe ligada
    for (let frame = 0; frame < 12; frame += 1) {
      player.attackAnimation = 0.2;

      engine.update(1 / 60);

      expect(player.attackAnimation, `frame ${frame}`).toBeGreaterThan(0);

      expectPlayerRow(engine, player, `parado, frame ${frame}`);

      const [draw] = sheetDraws(
        engine,
        drawPlayerFrame(engine),
      );

      expect(draw[3] / CELL, `linha, frame ${frame}`).toBe(IDLE_ROW);
    }

    engine.destroy();
  });

  it("shows the idle row while attacking even if it is walking", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);

    // andando para o norte enquanto ataca
    holdKeys(engine, ["KeyW"]);

    for (let frame = 0; frame < 12; frame += 1) {
      player.attackAnimation = 0.2;

      engine.update(1 / 60);

      expect(player.isMoving, `frame ${frame}`).toBe(true);

      // a caminhada para o norte e a linha 6. Se o desenho pegasse a
      // caminhada, o jogador veria o sorcerer mexendo as pernas no
      // meio do golpe — e o que o `attack` declarado evita, ao
      // contrário do reserva do motor, que cairia no `walk`
      const drawn = expectPlayerRow(
        engine,
        player,
        `andando, frame ${frame}`,
      );

      expect(
        drawn.some(
          ([, , , row]) =>
            row === SORCERER_SPRITE.directions.north * CELL,
        ),
        `frame ${frame} nao pode ser a caminhada`,
      ).toBe(false);
    }

    engine.destroy();
  });

  it("keeps the idle row while attacking in every direction", () => {
    const engine = createEngine();
    const player = engine.world.player;

    for (const codes of [
      ["KeyD"],
      ["KeyD", "KeyS"],
      ["KeyS"],
      ["KeyA", "KeyS"],
      ["KeyA"],
      ["KeyA", "KeyW"],
      ["KeyW"],
      ["KeyW", "KeyD"],
    ]) {
      clearCombat(engine);
      resetPlayer(player);

      holdKeys(engine, codes);

      engine.update(1 / 60);

      const andando = resolveDirectionKey(player.facing);

      player.attackAnimation = 0.2;

      engine.update(1 / 60);

      const [draw] = sheetDraws(engine, drawPlayerFrame(engine));

      expect(
        draw[3] / CELL,
        `atacando virado para ${andando}`,
      ).toBe(IDLE_ROW);
    }

    engine.destroy();
  });

  it("returns to walk and idle when the attack window ends", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);

    holdKeys(engine, ["KeyS"]);

    player.attackAnimation = 0.2;

    engine.update(1 / 60);

    const [atacando] = sheetDraws(engine, drawPlayerFrame(engine));

    expect(atacando[3] / CELL).toBe(IDLE_ROW);

    // a janela acabou: volta a ser caminhada, nao fica preso no idle
    player.attackAnimation = 0;

    engine.update(1 / 60);

    expect(player.isMoving).toBe(true);

    const [andando] = sheetDraws(engine, drawPlayerFrame(engine));

    expect(andando[3]).toBe(
      SORCERER_SPRITE.directions.south * CELL,
    );

    engine.destroy();
  });

  it("plays the whole idle cycle as the attack window", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);
    holdKeys(engine, []);

    const columns = new Set();

    // 0.22s e a janela que o `SkillSystem` liga, e o idle a 5fps
    // dura 1.6s: dentro do golpe o ciclo do idle NAO fecha. O que
    // este teste trava e que as colunas ANDAM — um golpe parado em
    // um quadro so seria o idle congelado, e nao o idle
    for (let frame = 0; frame < 13; frame += 1) {
      player.attackAnimation = 0.2;

      engine.update(1 / 60);

      const [draw] = sheetDraws(engine, drawPlayerFrame(engine));

      expect(draw[3] / CELL, `linha no frame ${frame}`).toBe(
        IDLE_ROW,
      );

      columns.add(draw[2] / CELL);
    }

    expect(
      columns.size,
      `o golpe visitou ${columns.size} quadros do idle`,
    ).toBeGreaterThan(1);

    engine.destroy();
  });

  it("animates the idle on the character select portrait", () => {
    // O retrato desenha `resolveFrameRect(definition, "idle", ...)`
    // com `facing` fixo em sul, e usa o `contentBox` para preencher o
    // quadrado com o personagem
    const origem = resolveFrameRect(
      SORCERER_SPRITE,
      "idle",
      0,
      { x: 0, y: 1 },
    );

    expect(origem.y / CELL).toBe(IDLE_ROW);
    expect(origem.x).toBeLessThan(SORCERER_SPRITE.contentBox.width);

    const outros = resolveFrameRect(
      SORCERER_SPRITE,
      "idle",
      0.4,
      { x: 0, y: 1 },
    );

    // o retrato tem de andar: `idle` com 8 quadros a 5fps muda de
    // coluna a cada 0.2s
    expect(outros.x).not.toBe(origem.x);
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

    clearCombat(engine);
    resetPlayer(player);

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

  it("maps every direction the layout declares to a distinct row", () => {
    // Guarda de integridade do registro: `walk` e `idle` nao podem
    // apontar para a mesma linha, senao "parar" e "andar" viram a
    // mesma imagem
    expect(
      new Set(Object.values(SORCERER_SPRITE.directions)).size,
    ).toBe(DIRECTION_KEYS.length);

    for (const key of DIRECTION_KEYS) {
      expect(
        SORCERER_SPRITE.directions[key],
        key,
      ).not.toBe(IDLE_ROW);
    }
  });
});