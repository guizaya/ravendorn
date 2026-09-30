import { describe, expect, it } from "vitest";
import {
  computeMinimapTransform,
  MINIMAP_HEIGHT,
  MINIMAP_RIGHT,
  MINIMAP_TOP,
  MINIMAP_WIDTH,
  worldToMinimap,
} from "./minimap.js";
import { MAP_META, TEST_MAP } from "../../data/maps/index.js";

const HUD_TOPBAR_HEIGHT = 68;
const HUD_RIGHT_GAP = 20;

const TARGET_PANEL = {
  top: 84,
  right: 20,
  width: 240,
  height: 86,
};

describe("minimap layout", () => {
  it("sits below the topbar and the target panel", () => {
    expect(MINIMAP_TOP).toBeGreaterThan(
      HUD_TOPBAR_HEIGHT,
    );

    expect(MINIMAP_TOP).toBeGreaterThan(
      TARGET_PANEL.top + TARGET_PANEL.height,
    );
  });

  it("keeps clear of the controls hint", () => {
    const bottom = MINIMAP_TOP + MINIMAP_HEIGHT;

    // o hint fica a 150px do rodape com ~110px de altura
    const hintTop = 720 - 150 - 110;

    expect(bottom).toBeLessThan(hintTop);
  });

  it("stays inside a 1280x720 viewport", () => {
    const left = 1280 - MINIMAP_RIGHT - MINIMAP_WIDTH;
    const right = 1280 - MINIMAP_RIGHT;

    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(1280);
    expect(MINIMAP_TOP + MINIMAP_HEIGHT).toBeLessThanOrEqual(
      720,
    );
  });

  it("aligns its right edge with the target panel", () => {
    const right = 1280 - MINIMAP_RIGHT;

    expect(right).toBe(1280 - TARGET_PANEL.right);
  });
});

describe("minimap transform", () => {
  it("fits the whole map inside the panel", () => {
    const transform = computeMinimapTransform(TEST_MAP);

    expect(transform.width).toBeLessThanOrEqual(
      MINIMAP_WIDTH + 0.01,
    );
    expect(transform.height).toBeLessThanOrEqual(
      MINIMAP_HEIGHT + 0.01,
    );
  });

  it("centers the map inside the panel", () => {
    const transform = computeMinimapTransform(TEST_MAP);

    expect(transform.offsetX).toBeCloseTo(
      (MINIMAP_WIDTH - transform.width) / 2,
      5,
    );

    expect(transform.offsetY).toBeCloseTo(
      (MINIMAP_HEIGHT - transform.height) / 2,
      5,
    );
  });

  it("maps the map origin to inside the panel", () => {
    const transform = computeMinimapTransform(TEST_MAP);
    const point = worldToMinimap(transform, 0, 0);

    expect(point.x).toBeCloseTo(transform.offsetX, 5);
    expect(point.y).toBeCloseTo(transform.offsetY, 5);
  });

  it("maps the far corner to inside the panel", () => {
    const transform = computeMinimapTransform(TEST_MAP);

    const point = worldToMinimap(
      transform,
      TEST_MAP.width,
      TEST_MAP.height,
    );

    expect(
      point.x,
    ).toBeLessThanOrEqual(MINIMAP_WIDTH + 0.01);
    expect(
      point.y,
    ).toBeLessThanOrEqual(MINIMAP_HEIGHT + 0.01);
  });

  it("preserves the aspect ratio of the map", () => {
    const transform = computeMinimapTransform(TEST_MAP);

    expect(
      transform.width / transform.height,
    ).toBeCloseTo(
      TEST_MAP.width / TEST_MAP.height,
      2,
    );
  });
});

describe("minimap zones", () => {
  it("exposes a color for every zone", () => {
    for (const zone of MAP_META.zones) {
      expect(typeof zone.mapColor).toBe("string");
      expect(zone.mapColor.length).toBeGreaterThan(0);
    }
  });

  it("places every zone inside the map", () => {
    for (const zone of MAP_META.zones) {
      expect(zone.x).toBeGreaterThanOrEqual(0);
      expect(zone.y).toBeGreaterThanOrEqual(0);
      expect(zone.x + zone.width).toBeLessThanOrEqual(
        TEST_MAP.width,
      );
      expect(zone.y + zone.height).toBeLessThanOrEqual(
        TEST_MAP.height,
      );
    }
  });

  it("does not overlap zones", () => {
    const zones = MAP_META.zones;

    for (let i = 0; i < zones.length; i += 1) {
      for (let j = i + 1; j < zones.length; j += 1) {
        const a = zones[i];
        const b = zones[j];

        const overlapX =
          a.x < b.x + b.width && a.x + a.width > b.x;

        const overlapY =
          a.y < b.y + b.height && a.y + a.height > b.y;

        expect(
          overlapX && overlapY,
          `${a.id} sobrepoe ${b.id}`,
        ).toBe(false);
      }
    }
  });
});
