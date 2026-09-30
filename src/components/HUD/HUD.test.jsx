import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HUD from "./HUD.jsx";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { getCharacterDefinition } from "../../data/characters/index.js";
import { Bestiary } from "../../game/bestiary/Bestiary.js";

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

describe("bestiary menu", () => {
  it("has a monster button next to the back button", () => {
    const html = render({ snapshot: snapshot() });

    expect(html).toContain("hud-btn--bestiary");
    expect(html).toContain("Bestiario (B)");
  });

  it("shows no badge while nothing is done", () => {
    const html = render({ snapshot: snapshot() });

    expect(html).not.toContain("hud-btn__badge");
  });

  it("shows the closed hunt count as a badge", () => {
    const bestiary = new Bestiary();
    bestiary.onKill("slime", 5);

    const html = render({
      snapshot: snapshot({ bestiary: bestiary.snapshot() }),
    });

    expect(html).toContain("hud-btn__badge");
    expect(html).toContain("1");
  });

  it("keeps the bestiary in the hud-menu with the back button", () => {
    const html = render({ snapshot: snapshot() });

    const menu = html.slice(
      html.indexOf("hud-menu"),
      html.indexOf("hud-menu") + 900,
    );

    expect(menu).toContain("Voltar para as classes");
    expect(menu).toContain("hud-btn--bestiary");
  });
});

describe("bestiary auto box", () => {
  const hunt = {
    creatureId: "ogre",
    name: "Ogre da Pedreira",
    icon: "⛊",
    color: "#d98b5f",
    zoneId: "pedreira",
    zoneName: "Pedreira do Ogro",
    kills: 7,
  };

  it("stays hidden while no hunt is running", () => {
    const html = render({ snapshot: snapshot() });

    expect(html).not.toContain("bst-auto");
  });

  it("appears below the missions box with the hunt details", () => {
    const html = render({
      snapshot: snapshot({ bestiaryAuto: hunt }),
    });

    expect(html).toContain("bst-auto");
    expect(html).toContain("Ogre da Pedreira");
    expect(html).toContain("Pedreira do Ogro");
    expect(html).toContain("AUTO");
  });

  it("is a clickable button that offers to stop", () => {
    const html = render({
      snapshot: snapshot({ bestiaryAuto: hunt }),
    });

    const tag = html.match(
      /<button[^>]*class="bst-auto"[^>]*>/,
    );

    expect(tag, "a box precisa ser um button").not.toBe(null);
    expect(html).toContain("Parar");
  });

  it("renders after the quest tracker, not before it", () => {
    const withQuests = {
      snapshot: snapshot({
        bestiaryAuto: hunt,
        quests: {
          main: {
            current: {
              id: "principal_1",
              name: "Abrir caminho",
              summary: "Mate 3 slimes",
              progress: 1,
              total: 3,
              autoCompletable: true,
            },
          },
        },
      }),
    };

    const html = render(withQuests);

    const tracker = html.indexOf("qst-tracker");
    const box = html.indexOf("bst-auto");

    expect(tracker).toBeGreaterThan(-1);
    expect(box).toBeGreaterThan(-1);
    expect(box).toBeGreaterThan(tracker);
  });

  it("renders even with no quest to track", () => {
    const html = render({
      snapshot: snapshot({
        bestiaryAuto: hunt,
        quests: { main: { current: null } },
      }),
    });

    expect(html).toContain("bst-auto");
    expect(html).not.toContain("qst-tracker__row");
  });

  it("survives a hunt without a zone", () => {
    const html = render({
      snapshot: snapshot({
        bestiaryAuto: { ...hunt, zoneName: null },
      }),
    });

    expect(html).toContain("bst-auto");
    expect(html).toContain("Procurando");
  });
});

describe("target level", () => {
  it("shows the enemy level next to its health", () => {
    const html = render({
      snapshot: snapshot({
        selectedTarget: {
          id: "ogre_3",
          name: "Ogre da Pedreira",
          level: 17,
          hp: 900,
          maxHp: 1250,
          statusEffects: [],
        },
      }),
    });

    expect(html).toContain("Ogre da Pedreira");
    expect(html).toContain("Nv.17");
    expect(html).toContain("900");
    expect(html).toContain("1250");
  });

  it("falls back to level 1 when the target has no level", () => {
    const html = render({
      snapshot: snapshot({
        selectedTarget: {
          id: "slime_1",
          name: "Limo Preguicoso",
          hp: 100,
          maxHp: 140,
          statusEffects: [],
        },
      }),
    });

    expect(html).toContain("Nv.1");
  });

  it("shows no level badge without a target", () => {
    const html = render({ snapshot: snapshot() });

    expect(html).not.toContain("target-panel__level");
  });
});
