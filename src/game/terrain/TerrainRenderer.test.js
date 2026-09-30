import { describe, expect, it } from "vitest";
import { TerrainRenderer } from "./TerrainRenderer.js";
import {
  BASE_TERRAIN,
  getTransition,
  minimapColorFor,
  TERRAIN_ROW,
  TERRAIN_TYPES,
  TILE_SIZE,
  TILE_VARIANTS,
  TRANSITION_LIST,
} from "../../data/terrain/index.js";
import { MAP_META, TEST_MAP } from "../../data/maps/index.js";

function fakeImage(width = 256) {
  return { width, height: width, complete: true };
}

function countingContext({ withPattern = true } = {}) {
  const calls = { drawImage: 0, fillRect: 0 };

  return {
    calls,

    drawImage() {
      calls.drawImage += 1;
    },

    fillRect() {
      calls.fillRect += 1;
    },

    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    rect() {},
    roundRect() {},
    fill() {},
    stroke() {},
    arc() {},
    strokeRect() {},
    clip() {},

    createPattern: withPattern
      ? () => ({ pattern: true })
      : undefined,
  };
}

function installDocumentStub() {
  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") return {};

      return {
        width: 0,
        height: 0,
        getContext: () => countingContext(),
      };
    },
  };
}

function removeDocumentStub() {
  delete globalThis.document;
}

function createRenderer() {
  const renderer = new TerrainRenderer();

  renderer.terrain = fakeImage();
  renderer.transitions = fakeImage();

  return renderer;
}

const VIEW = {
  x: 1600,
  y: 1000,
  width: 1280,
  height: 720,
};

describe("terrain manifest", () => {
  it("uses 32px tiles with 4 variants", () => {
    expect(TILE_SIZE).toBe(32);
    expect(TILE_VARIANTS).toBe(4);
  });

  it("maps every type to a distinct row", () => {
    const rows = TERRAIN_TYPES.map(
      (id) => TERRAIN_ROW[id],
    );

    expect(rows).toHaveLength(TERRAIN_TYPES.length);
    expect(new Set(rows).size).toBe(rows.length);
  });

  it("resolves transitions between every base pair", () => {
    for (const type of TERRAIN_TYPES) {
      if (type === BASE_TERRAIN) continue;

      expect(
        getTransition(BASE_TERRAIN, type),
        `${BASE_TERRAIN} -> ${type}`,
      ).not.toBe(null);
    }
  });

  it("returns null for identical terrain and unknown pairs", () => {
    expect(getTransition("grass", "grass")).toBe(null);
    expect(getTransition("swamp", "sand")).toBe(null);
  });

  it("keeps transition ids unique", () => {
    expect(new Set(TRANSITION_LIST).size).toBe(
      TRANSITION_LIST.length,
    );
  });

  it("gives every zone a terrain", () => {
    for (const zone of MAP_META.zones) {
      expect(
        TERRAIN_TYPES.includes(zone.terrain),
        zone.id,
      ).toBe(true);
    }
  });

  it("uses more than one terrain across zones", () => {
    const used = new Set(
      MAP_META.zones.map((zone) => zone.terrain),
    );

    expect(used.size).toBeGreaterThanOrEqual(4);
  });

  it("gives every terrain a distinct minimap color", () => {
    const colors = TERRAIN_TYPES.map((id) =>
      minimapColorFor(id),
    );

    expect(new Set(colors).size).toBe(
      TERRAIN_TYPES.length,
    );
  });
});

describe("terrain rendering cost", () => {
  it("fills the base with a single pattern op", () => {
    installDocumentStub();

    const renderer = createRenderer();
    const context = countingContext();

    renderer.draw(context, TEST_MAP, [], VIEW);

    expect(context.calls.fillRect).toBe(1);

    removeDocumentStub();
  });

  it("blits a small grid when patterns are unavailable", () => {
    installDocumentStub();

    const renderer = createRenderer();
    const context = countingContext({
      withPattern: false,
    });

    renderer.draw(context, TEST_MAP, [], VIEW);

    // 1344x784 com patch de 256px => 6x4 = 24 blits
    expect(context.calls.drawImage).toBeLessThanOrEqual(30);
    expect(context.calls.fillRect).toBe(0);

    removeDocumentStub();
  });

  it("keeps drawImage calls bounded per frame", () => {
    installDocumentStub();

    const renderer = createRenderer();
    const context = countingContext();

    renderer.draw(
      context,
      TEST_MAP,
      MAP_META.zones,
      VIEW,
    );

    console.log(
      `drawImage por frame: ${context.calls.drawImage}`,
    );

    // antes do pattern seriam ~2400 tiles por frame
    expect(context.calls.drawImage).toBeLessThan(300);

    removeDocumentStub();
  });

  it("reuses the patch across frames", () => {
    installDocumentStub();

    const renderer = createRenderer();

    const first = countingContext();
    const second = countingContext();

    renderer.draw(first, TEST_MAP, [], VIEW);
    renderer.draw(second, TEST_MAP, [], VIEW);

    expect(renderer.patches.size).toBe(1);
    expect(second.calls.fillRect).toBe(1);

    removeDocumentStub();
  });

  it("skips zones outside the viewport", () => {
    installDocumentStub();

    const renderer = createRenderer();

    const far = {
      x: 3000,
      y: 200,
      width: 400,
      height: 300,
      terrain: "stone",
    };

    const context = countingContext();

    renderer.draw(context, TEST_MAP, [far], VIEW);

    expect(context.calls.drawImage).toBe(0);
    expect(context.calls.fillRect).toBe(1);

    removeDocumentStub();
  });

  it("draws bands only for a visible zone", () => {
    installDocumentStub();

    const renderer = createRenderer();

    const near = {
      x: 1620,
      y: 1040,
      width: 300,
      height: 300,
      terrain: "swamp",
    };

    const context = countingContext();

    renderer.draw(context, TEST_MAP, [near], VIEW);

    expect(context.calls.drawImage).toBeGreaterThan(0);

    removeDocumentStub();
  });

  it("skips edges for base-terrain zones", () => {
    installDocumentStub();

    const renderer = createRenderer();
    const context = countingContext();

    renderer.drawZoneEdges(context, {
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      terrain: BASE_TERRAIN,
    });

    expect(context.calls.drawImage).toBe(0);

    removeDocumentStub();
  });

  it("still draws per tile without a DOM", () => {
    removeDocumentStub();

    const renderer = createRenderer();
    const context = countingContext();

    expect(() =>
      renderer.draw(context, TEST_MAP, [], VIEW),
    ).not.toThrow();

    expect(context.calls.drawImage).toBeGreaterThan(0);
  });
});

describe("terrain fallback", () => {
  it("is not ready without images", () => {
    const renderer = new TerrainRenderer();

    expect(renderer.isReady()).toBe(false);
  });

  it("is ready once the sheets load", () => {
    expect(createRenderer().isReady()).toBe(true);
  });

  it("draws without throwing when a patch cannot be built", () => {
    removeDocumentStub();

    const renderer = createRenderer();
    const context = countingContext();

    expect(() =>
      renderer.draw(context, TEST_MAP, [], VIEW),
    ).not.toThrow();
  });
});
