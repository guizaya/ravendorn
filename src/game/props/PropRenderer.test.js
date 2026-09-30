import { describe, expect, it } from "vitest";
import { PropRenderer } from "./PropRenderer.js";
import {
  BLOCKING_PROP_IDS,
  DECORATIVE_PROP_IDS,
  getPropType,
  isBlockingProp,
  PROP_ORDER,
  PROP_TYPES,
  PROP_VARIANTS,
} from "../../data/props/index.js";
import { MAP_BOUNDS, MAP_META, SPAWN, TEST_MAP } from "../../data/maps/index.js";
import { CollisionSystem } from "../collision/CollisionSystem.js";

const VIEW = {
  x: 1600,
  y: 1000,
  width: 1280,
  height: 720,
};

function createRenderer() {
  const renderer = new PropRenderer();

  renderer.image = {
    width: 128,
    height: 160,
    complete: true,
  };

  return renderer;
}

function countingContext() {
  const calls = { drawImage: 0, fill: 0 };

  return {
    calls,

    drawImage() {
      calls.drawImage += 1;
    },

    beginPath() {},
    ellipse() {},
    fill() {
      calls.fill += 1;
    },
    save() {},
    restore() {},
  };
}

describe("prop catalog", () => {
  it("has trees, rocks and bushes", () => {
    expect(PROP_ORDER).toContain("treeSmall");
    expect(PROP_ORDER).toContain("treeMedium");
    expect(PROP_ORDER).toContain("treeLarge");
    expect(PROP_ORDER).toContain("rock");
    expect(PROP_ORDER).toContain("bush");
  });

  it("gives every prop a distinct row and a positive radius", () => {
    const rows = PROP_ORDER.map((id) => PROP_TYPES[id].row);

    expect(new Set(rows).size).toBe(PROP_ORDER.length);

    for (const id of PROP_ORDER) {
      expect(PROP_TYPES[id].radius).toBeGreaterThan(0);
      expect(PROP_TYPES[id].tint.length).toBeGreaterThan(0);
    }
  });

  it("splits blocking and decorative props", () => {
    expect(BLOCKING_PROP_IDS.length).toBeGreaterThan(0);
    expect(DECORATIVE_PROP_IDS.length).toBeGreaterThan(0);

    for (const id of BLOCKING_PROP_IDS) {
      expect(isBlockingProp(id)).toBe(true);
    }

    for (const id of DECORATIVE_PROP_IDS) {
      expect(isBlockingProp(id)).toBe(false);
    }
  });

  it("keeps trees collider smaller than the canopy", () => {
    for (const id of BLOCKING_PROP_IDS) {
      const type = getPropType(id);

      expect(type.collider).toBeLessThan(type.radius);
      expect(type.collider).toBeGreaterThan(0);
    }
  });

  it("gives decorative props no collider", () => {
    for (const id of DECORATIVE_PROP_IDS) {
      expect(getPropType(id).collider).toBe(0);
    }
  });

  it("returns null for unknown props", () => {
    expect(getPropType("castle")).toBe(null);
    expect(isBlockingProp("castle")).toBe(false);
  });
});

describe("map props", () => {
  it("replaces the old rectangle obstacles", () => {
    expect(TEST_MAP.props.length).toBeGreaterThan(100);
    expect(TEST_MAP.walls).toBeUndefined();
    expect(TEST_MAP.obstacles).toBeUndefined();
  });

  it("gives every prop a unique id and valid type", () => {
    const ids = new Set();

    for (const prop of TEST_MAP.props) {
      expect(ids.has(prop.id)).toBe(false);
      ids.add(prop.id);

      expect(getPropType(prop.type)).not.toBe(null);
      expect(prop.variant).toBeGreaterThanOrEqual(0);
      expect(prop.variant).toBeLessThan(PROP_VARIANTS);
    }
  });

  it("keeps every prop inside the map bounds", () => {
    for (const prop of TEST_MAP.props) {
      expect(prop.x).toBeGreaterThan(MAP_BOUNDS.x);
      expect(prop.y).toBeGreaterThan(MAP_BOUNDS.y);
      expect(prop.x).toBeLessThan(
        MAP_BOUNDS.x + MAP_BOUNDS.width,
      );
      expect(prop.y).toBeLessThan(
        MAP_BOUNDS.y + MAP_BOUNDS.height,
      );
    }
  });

  it("leaves the player spawn clear", () => {
    for (const prop of TEST_MAP.blocking) {
      expect(
        Math.hypot(
          prop.x - SPAWN.x,
          prop.y - SPAWN.y,
        ),
      ).toBeGreaterThan(prop.radius + 300);
    }
  });

  it("keeps blocking props out of the creature zones", () => {
    for (const prop of TEST_MAP.blocking) {
      for (const zone of MAP_META.zones) {
        const inside =
          prop.x > zone.x - 46 &&
          prop.x < zone.x + zone.width + 46 &&
          prop.y > zone.y - 46 &&
          prop.y < zone.y + zone.height + 46;

        expect(inside, `${prop.id} dentro de ${zone.id}`).toBe(
          false,
        );
      }
    }
  });

  it("decorates the zones with non-blocking props", () => {
    let inside = 0;

    for (const prop of TEST_MAP.decorative) {
      for (const zone of MAP_META.zones) {
        if (
          prop.x > zone.x &&
          prop.x < zone.x + zone.width &&
          prop.y > zone.y &&
          prop.y < zone.y + zone.height
        ) {
          inside += 1;
          break;
        }
      }
    }

    expect(inside).toBeGreaterThan(10);
  });

  it("separates blocking props from each other", () => {
    const placed = TEST_MAP.blocking;

    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i];
        const b = placed[j];

        const gap = a.radius + b.radius + 34;

        expect(
          Math.hypot(a.x - b.x, a.y - b.y) >= gap,
          `${a.id} sobrepoe ${b.id}`,
        ).toBe(true);
      }
    }
  });

  it("keeps decoration off blocking props", () => {
    for (const deco of TEST_MAP.decorative) {
      for (const solid of TEST_MAP.blocking) {
        const gap = deco.radius + solid.radius + 34;

        expect(
          Math.hypot(
            deco.x - solid.x,
            deco.y - solid.y,
          ) >= gap,
          `${deco.id} sobrepoe ${solid.id}`,
        ).toBe(true);
      }
    }
  });

  it("is deterministic for the same seed", () => {
    const first = JSON.stringify(
      TEST_MAP.props.map((p) => [p.type, p.x, p.y]),
    );

    const second = JSON.stringify(
      TEST_MAP.props.map((p) => [p.type, p.x, p.y]),
    );

    expect(first).toBe(second);
  });
});

describe("prop collision", () => {
  it("registers only blocking props as solids", () => {
    const collision = new CollisionSystem(TEST_MAP);

    expect(collision.solids).toHaveLength(
      TEST_MAP.blocking.length,
    );
  });

  it("builds one collider per blocking prop", () => {
    expect(TEST_MAP.solids).toHaveLength(
      TEST_MAP.blocking.length,
    );

    for (const solid of TEST_MAP.solids) {
      expect(solid.width).toBeGreaterThan(0);
      expect(solid.height).toBe(solid.width);
    }
  });

  it("blocks movement into a tree trunk", () => {
    const collision = new CollisionSystem(TEST_MAP);
    const tree = TEST_MAP.blocking.find(
      (prop) => prop.type === "treeLarge",
    );

    expect(tree).toBeDefined();

    expect(
      collision.isPositionFree(
        { x: tree.x, y: tree.y },
        10,
      ),
    ).toBe(false);
  });

  it("allows standing next to a tree", () => {
    const collision = new CollisionSystem(TEST_MAP);
    const tree = TEST_MAP.blocking.find(
      (prop) => prop.type === "treeLarge",
    );

    const outside = tree.colliderRadius + 40;

    expect(
      collision.isPositionFree(
        { x: tree.x + outside, y: tree.y },
        10,
      ),
    ).toBe(true);
  });

  it("ignores decorative props entirely", () => {
    const collision = new CollisionSystem(TEST_MAP);

    for (const prop of TEST_MAP.decorative) {
      expect(
        collision.isPositionFree(
          { x: prop.x, y: prop.y },
          5,
        ),
      ).toBe(true);
    }
  });

  it("still supports legacy walls and obstacles", () => {
    const legacy = {
      width: 1000,
      height: 1000,
      bounds: { x: 0, y: 0, width: 1000, height: 1000 },
      walls: [
        { x: 100, y: 100, width: 40, height: 40 },
      ],
      obstacles: [
        { x: 300, y: 300, width: 40, height: 40 },
      ],
    };

    const collision = new CollisionSystem(legacy);

    expect(collision.solids).toHaveLength(2);
  });
});

describe("prop rendering", () => {
  it("is not ready without an image", () => {
    expect(new PropRenderer().isReady()).toBe(false);
  });

  it("is ready once the sheet loads", () => {
    expect(createRenderer().isReady()).toBe(true);
  });

  it("culls props outside the viewport", () => {
    const renderer = createRenderer();

    const props = [
      { x: 2000, y: 1300, type: "treeMedium", radius: 26, variant: 0 },
      { x: 3900, y: 300, type: "bush", radius: 12, variant: 1 },
    ];

    const visible = renderer.collectVisible(props, VIEW);

    expect(visible).toHaveLength(1);
    expect(visible[0].x).toBe(2000);
  });

  it("draws one sprite and one shadow per visible prop", () => {
    const renderer = createRenderer();
    const context = countingContext();

    renderer.draw(
      context,
      [
        {
          x: 2000,
          y: 1300,
          type: "treeLarge",
          radius: 34,
          variant: 2,
        },
      ],
      VIEW,
    );

    expect(context.calls.drawImage).toBe(1);
    expect(context.calls.fill).toBe(1);
  });

  it("scales the sprite with the prop radius", () => {
    const renderer = createRenderer();

    const sizes = [];

    const context = {
      ...countingContext(),
      drawImage(_img, _sx, _sy, _sw, _sh, _dx, _dy, dw, dh) {
        sizes.push([dw, dh]);
      },
    };

    renderer.drawProp(context, {
      x: 0,
      y: 0,
      type: "treeSmall",
      radius: 20,
      variant: 0,
    });

    renderer.drawProp(context, {
      x: 0,
      y: 0,
      type: "treeLarge",
      radius: 34,
      variant: 0,
    });

    expect(sizes[0][0]).toBeLessThan(sizes[1][0]);
    expect(sizes[0][1]).toBe(sizes[0][0]);
  });

  it("ignores unknown prop types", () => {
    const renderer = createRenderer();
    const context = countingContext();

    expect(() =>
      renderer.drawProp(context, {
        x: 0,
        y: 0,
        type: "castle",
        radius: 20,
        variant: 0,
      }),
    ).not.toThrow();

    expect(context.calls.drawImage).toBe(0);
  });
});
