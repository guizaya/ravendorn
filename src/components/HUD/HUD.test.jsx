import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HUD from "./HUD.jsx";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { getCharacterDefinition } from "../../data/characters/index.js";

const CLASS = CHARACTER_CLASSES[0];

const ENGINE_REF = { current: null };

function snapshot(overrides = {}) {
  return {
    time: 0,
    autoPlay: false,
    engaged: false,
    player: {
      id: "player_warrior",
      name: "Warrior",
      className: "Warrior",
      level: 1,
      hp: 980,
      maxHp: 1400,
      resource: 40,
      maxResource: 100,
      resourceName: "Chi",
      shield: 0,
      attack: 82,
      defense: 42,
      speed: 165,
      casting: false,
      castingName: null,
      statusEffects: [],
    },
    cooldowns: {},
    selectedTarget: null,
    message: null,
    ...overrides,
  };
}

function render(props = {}) {
  return renderToStaticMarkup(
    <HUD
      classDefinition={CLASS}
      engineRef={ENGINE_REF}
      onBack={() => {}}
      {...props}
    />,
  );
}

describe("HUD render", () => {
  it("renders with no snapshot yet", () => {
    expect(() => render()).not.toThrow();
  });

  it("renders with a full snapshot", () => {
    expect(() =>
      render({ snapshot: snapshot() }),
    ).not.toThrow();
  });

  it("renders every auto and engaged combination", () => {
    for (const autoPlay of [false, true]) {
      for (const engaged of [false, true]) {
        expect(() =>
          render({
            snapshot: snapshot({ autoPlay, engaged }),
          }),
        ).not.toThrow();
      }
    }
  });

  it("renders every class", () => {
    for (const definition of CHARACTER_CLASSES) {
      expect(() =>
        render({
          classDefinition: definition,
          snapshot: snapshot(),
        }),
        definition.id,
      ).not.toThrow();
    }
  });

  it("shows the class level and vitals", () => {
    const markup = render({ snapshot: snapshot() });

    expect(markup).toContain("Lv.1");
    expect(markup).toContain("Warrior");
    expect(markup).toContain("Chi");
    expect(markup).toContain("980");
  });

  it("clamp-free: renders zero hp without NaN", () => {
    const markup = render({
      snapshot: snapshot({
        player: {
          ...snapshot().player,
          hp: 0,
          resource: 0,
        },
      }),
    });

    expect(markup).not.toContain("NaN");
  });

  it("shows the shield badge only when shield is active", () => {
    expect(render({ snapshot: snapshot() })).not.toContain(
      "hud-vitals__shield",
    );

    const markup = render({
      snapshot: snapshot({
        player: {
          ...snapshot().player,
          shield: 120,
        },
      }),
    });

    expect(markup).toContain("hud-vitals__shield");
    expect(markup).toContain("120");
  });

  it("renders the buff strip only with active effects", () => {
    expect(
      render({ snapshot: snapshot() }),
    ).not.toContain("hud-buffs");

    const markup = render({
      snapshot: snapshot({
        player: {
          ...snapshot().player,
          statusEffects: [
            { type: "burning", remaining: 3.4, value: 12 },
            { type: "poison", remaining: 1.1, value: 9 },
          ],
        },
      }),
    });

    expect(markup).toContain("hud-buffs");
    expect(markup).toContain("hud-buff--burning");
    expect(markup).toContain("hud-buff--poison");
  });

  it("caps the buff strip", () => {
    const statusEffects = Array.from(
      { length: 40 },
      (_, index) => ({
        type: `effect${index}`,
        remaining: index + 1,
        value: 0,
      }),
    );

    const markup = render({
      snapshot: snapshot({
        player: {
          ...snapshot().player,
          statusEffects,
        },
      }),
    });

    const rendered = markup.match(/hud-buff /g) ?? [];

    expect(rendered.length).toBeLessThanOrEqual(10);
  });

  it("reflects the auto play state on the big button", () => {
    expect(
      render({ snapshot: snapshot() }),
    ).toContain(">OFF<");

    expect(
      render({
        snapshot: snapshot({ engaged: true }),
      }),
    ).toContain(">ALVO<");

    const on = render({
      snapshot: snapshot({ autoPlay: true }),
    });

    expect(on).toContain(">AUTO<");
    expect(on).toContain("hud-ability is-on");
  });

  it("renders the target panel only with a target", () => {
    expect(
      render({ snapshot: snapshot() }),
    ).not.toContain("target-panel");

    const markup = render({
      snapshot: snapshot({
        selectedTarget: {
          id: "dummy_warrior",
          name: "Boneco de Madeira",
          hp: 700,
          maxHp: 1500,
          statusEffects: [],
        },
      }),
    });

    expect(markup).toContain("target-panel");
    expect(markup).toContain("Boneco de Madeira");
    expect(markup).not.toContain("NaN");
  });

  it("renders the message with an error modifier", () => {
    const markup = render({
      snapshot: snapshot({
        message: { text: "Aguarde", bad: true },
      }),
    });

    expect(markup).toContain("game-message is-error");
    expect(markup).toContain("Aguarde");
  });

  it("renders a page button per skill page", () => {
    const markup = render({ snapshot: snapshot() });

    const expected = Math.ceil(
      CLASS.skills.length / 8,
    );

    const pages = markup.match(/hud-btn--sm/g) ?? [];

    expect(pages.length).toBe(Math.max(1, expected));
  });

  it("keeps the drag hint out of the initial markup", () => {
    const markup = render({ snapshot: snapshot() });

    expect(markup).not.toContain("skill-slot__drag-hint");
  });
});

describe("HUD resilience", () => {
  it("survives a malformed snapshot", () => {
    expect(() =>
      render({
        snapshot: {
          player: null,
          cooldowns: null,
        },
      }),
    ).not.toThrow();
  });

  it("survives a class with no skills", () => {
    const empty = {
      ...getCharacterDefinition("warrior"),
      skills: [],
    };

    expect(() =>
      render({
        classDefinition: empty,
        snapshot: snapshot(),
      }),
    ).not.toThrow();
  });

  it("survives a missing engine ref", () => {
    expect(() =>
      render({
        engineRef: { current: null },
        snapshot: snapshot(),
      }),
    ).not.toThrow();
  });
});
