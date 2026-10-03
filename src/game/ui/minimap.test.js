import { describe, expect, it } from "vitest";
import {
  computeMinimapTransform,
  MINIMAP_HEIGHT,
  MINIMAP_RIGHT,
  MINIMAP_TOP_IDLE,
  MINIMAP_TOP_TARGETED,
  MINIMAP_WIDTH,
  worldToMinimap,
} from "./minimap.js";
import { MAP_1_META, MAP_1 } from "../../data/maps/index.js";

const HUD_TOPBAR_HEIGHT = 68;
const HUD_RIGHT_GAP = 20;

const TARGET_PANEL = {
  top: 84,
  right: 20,
  width: 240,
  height: 86,
};

describe("minimap layout", () => {
  it("sits below the topbar in both states", () => {
    expect(MINIMAP_TOP_IDLE).toBeGreaterThan(
      HUD_TOPBAR_HEIGHT,
    );
    expect(MINIMAP_TOP_TARGETED).toBeGreaterThan(
      HUD_TOPBAR_HEIGHT,
    );
  });

  it("takes the target panel slot when idle", () => {
    expect(MINIMAP_TOP_IDLE).toBe(TARGET_PANEL.top);
    expect(MINIMAP_WIDTH).toBe(TARGET_PANEL.width);
  });

  it("drops below the target panel when targeted", () => {
    expect(MINIMAP_TOP_TARGETED).toBeGreaterThan(
      TARGET_PANEL.top + TARGET_PANEL.height,
    );
  });

  it("moves down when a target appears", () => {
    expect(MINIMAP_TOP_TARGETED).toBeGreaterThan(
      MINIMAP_TOP_IDLE,
    );
  });

  it("keeps clear of the controls hint", () => {
    const bottom =
      MINIMAP_TOP_TARGETED + MINIMAP_HEIGHT;

    // o hint fica a 150px do rodape com ~110px de altura
    const hintTop = 720 - 150 - 110;

    expect(bottom).toBeLessThan(hintTop);
  });

  it("stays inside a 1280x720 viewport in both states", () => {
    for (const top of [
      MINIMAP_TOP_IDLE,
      MINIMAP_TOP_TARGETED,
    ]) {
      const left = 1280 - MINIMAP_RIGHT - MINIMAP_WIDTH;
      const right = 1280 - MINIMAP_RIGHT;

      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(1280);
      expect(top + MINIMAP_HEIGHT).toBeLessThanOrEqual(720);
    }
  });

  it("aligns its right edge with the target panel", () => {
    const right = 1280 - MINIMAP_RIGHT;

    expect(right).toBe(1280 - TARGET_PANEL.right);
  });
});

describe("minimap transform", () => {
  it("fits the whole map inside the panel", () => {
    const transform = computeMinimapTransform(MAP_1);

    expect(transform.width).toBeLessThanOrEqual(
      MINIMAP_WIDTH + 0.01,
    );
    expect(transform.height).toBeLessThanOrEqual(
      MINIMAP_HEIGHT + 0.01,
    );
  });

  it("centers the map inside the panel", () => {
    const transform = computeMinimapTransform(MAP_1);

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
    const transform = computeMinimapTransform(MAP_1);
    const point = worldToMinimap(transform, 0, 0);

    expect(point.x).toBeCloseTo(transform.offsetX, 5);
    expect(point.y).toBeCloseTo(transform.offsetY, 5);
  });

  it("maps the far corner to inside the panel", () => {
    const transform = computeMinimapTransform(MAP_1);

    const point = worldToMinimap(
      transform,
      MAP_1.width,
      MAP_1.height,
    );

    expect(
      point.x,
    ).toBeLessThanOrEqual(MINIMAP_WIDTH + 0.01);
    expect(
      point.y,
    ).toBeLessThanOrEqual(MINIMAP_HEIGHT + 0.01);
  });

  it("preserves the aspect ratio of the map", () => {
    const transform = computeMinimapTransform(MAP_1);

    expect(
      transform.width / transform.height,
    ).toBeCloseTo(
      MAP_1.width / MAP_1.height,
      2,
    );
  });
});

describe("minimap zones", () => {
  it("exposes a color for every zone", () => {
    for (const zone of MAP_1_META.zones) {
      expect(typeof zone.mapColor).toBe("string");
      expect(zone.mapColor.length).toBeGreaterThan(0);
    }
  });

  it("places every zone inside the map", () => {
    for (const zone of MAP_1_META.zones) {
      expect(zone.x).toBeGreaterThanOrEqual(0);
      expect(zone.y).toBeGreaterThanOrEqual(0);
      expect(zone.x + zone.width).toBeLessThanOrEqual(
        MAP_1.width,
      );
      expect(zone.y + zone.height).toBeLessThanOrEqual(
        MAP_1.height,
      );
    }
  });

  it("does not overlap zones", () => {
    const zones = MAP_1_META.zones;

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
