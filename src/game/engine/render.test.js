import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

installDomStubs();

function installRenderStubs() {
  globalThis.Image = class {
    constructor() {
      this.width = 128;
      this.height = 160;
      this.complete = true;
    }
  };

  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") return {};

      return {
        width: 0,
        height: 0,
        getContext: () => makeContext(),
      };
    },
  };
}

function removeRenderStubs() {
  delete globalThis.Image;
  delete globalThis.document;
}

function makeContext() {
  return new Proxy(
    {
      createPattern: () => ({ pattern: true }),
    },
    {
      get(target, key) {
        if (key in target) return target[key];
        return () => {};
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );
}

function createEngine() {
  const canvas = createTestCanvas();

  const engine = new GameEngine(
    canvas.element,
    CHARACTER_CLASSES[0],
    () => {},
  );

  engine.setMap(MAP_1);

  return engine;
}

describe("render smoke", () => {
  it("renders the real map without throwing", () => {
    installRenderStubs();

    const engine = createEngine();

    expect(() => engine.render()).not.toThrow();

    engine.destroy();
    removeRenderStubs();
  });

  it("renders while moving, fighting and looting", () => {
    installRenderStubs();

    const engine = createEngine();

    engine.setAutoPlay(true);

    for (const skill of engine.classDefinition.skills) {
      engine.setSkillAuto(skill.id, true);
    }

    for (let frame = 0; frame < 240; frame += 1) {
      engine.update(1 / 60);

      expect(
        () => engine.render(),
        `frame ${frame}`,
      ).not.toThrow();
    }

    engine.destroy();
    removeRenderStubs();
  });

  it("renders every zone biome without throwing", () => {
    installRenderStubs();

    for (const zone of MAP_1.zones) {
      const engine = createEngine();

      engine.world.player.x = zone.x + zone.width / 2;
      engine.world.player.y = zone.y + zone.height / 2;
      engine.update(1 / 60);

      expect(
        () => engine.render(),
        `zona ${zone.name}`,
      ).not.toThrow();

      engine.destroy();
    }

    removeRenderStubs();
  });

  it("renders with a dead player", () => {
    installRenderStubs();

    const engine = createEngine();

    engine.world.player.hp = 0;
    engine.update(1 / 60);

    expect(() => engine.render()).not.toThrow();

    engine.destroy();
    removeRenderStubs();
  });

  it("renders with an empty map", () => {
    installRenderStubs();

    const engine = createEngine();

    engine.setMap({
      width: 1000,
      height: 800,
      bounds: { x: 0, y: 0, width: 1000, height: 800 },
      background: "#17221f",
      spawn: { x: 500, y: 400 },
      zones: [],
      props: [],
      blocking: [],
    });

    expect(() => engine.render()).not.toThrow();

    engine.destroy();
    removeRenderStubs();
  });
});

describe("frame loop resilience", () => {
  it("keeps scheduling frames after a render error", () => {
    const engine = createEngine();

    let scheduled = 0;

    globalThis.requestAnimationFrame = () => {
      scheduled += 1;
      return scheduled;
    };

    engine.render = () => {
      throw new Error("boom");
    };

    engine.boundLoop(performance.now());
    engine.boundLoop(performance.now());
    engine.boundLoop(performance.now());

    expect(scheduled).toBe(3);
    expect(engine.frameErrors).toBe(3);
    expect(engine.animationFrame).toBe(scheduled);

    engine.destroy();
  });

  it("keeps updating the world after a render error", () => {
    const engine = createEngine();

    const startX = engine.world.player.x;

    engine.render = () => {
      throw new Error("boom");
    };

    engine.setAutoPlay(true);

    engine.boundLoop(performance.now());

    engine.update(1 / 60);
    engine.update(1 / 60);

    expect(engine.world.time).toBeGreaterThan(0);
    expect(engine.frameErrors).toBeGreaterThan(0);

    engine.destroy();
  });

  it("does not log the same error forever", () => {
    const engine = createEngine();

    const original = console.error;
    let logged = 0;

    console.error = () => {
      logged += 1;
    };

    engine.render = () => {
      throw new Error("boom");
    };

    for (let frame = 0; frame < 50; frame += 1) {
      engine.boundLoop(performance.now());
    }

    console.error = original;

    expect(logged).toBeLessThanOrEqual(4);
    expect(engine.frameErrors).toBe(50);

    engine.destroy();
  });
});
