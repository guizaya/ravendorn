import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HUD from "./HUD.jsx";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { getCharacterDefinition } from "../../data/characters/index.js";
import { Bestiary } from "../../game/bestiary/Bestiary.js";
import { getBestiaryEntry } from "../../data/bestiary/index.js";
import { Craft } from "../../game/craft/Craft.js";
import { Inventory } from "../../game/inventory/Inventory.js";

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
      {...props}
    />,
  );
}

/**
 * O markup do MENU de botoes, do `<nav>` ate o `</nav>`.
 *
 * Estes testes usavam uma janela FIXA de `hud-menu` + 900 caracteres,
 * e ela media o tamanho do HTML vizinho e nao o do menu: cada botao com
 * icone desenhado traz uma `img` com uma URL de ~60 caracteres dentro
 * de si, e com seis icones a janela parou de alcancar o craft — o
 * teste falhou sem o craft ter mudado
 *
 * O `</nav>` e o fim REAL do menu, entao a recorte cresce com ele
 */
function menu(html) {
  const inicio = html.indexOf('class="hud-menu"');

  return html.slice(inicio, html.indexOf("</nav>", inicio));
}

/**
 * O markup de UM botao, do class dele ate o `</button>`.
 *
 * O mesmo problema da janela, em menor: as checagens de badge eram
 * feitas sobre o menu INTEIRO, entao um badge no bestiario ou na
 * colecao faria a checagem do craft passar sem o craft ter badge
 * nenhum. Recortar pelo `</button>` amarra a verificacao ao botao que
 * o teste nomeia
 */
function botao(html, seletor) {
  const inicio = html.indexOf(`class="hud-btn ${seletor}`);

  if (inicio < 0) return "";

  return html.slice(inicio, html.indexOf("</button>", inicio));
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

  /**
   * O mercado e a vitrine COLADA no bestiario.
   *
   * bestiary > market > collection, sem nada entre o par. A ordem
   * importa na mao do jogador: o par que se consulta e o que ele caçou
   * e o que ele tem a venda, e um botao no meio deles custaria um
   * clique extra toda vez que o jogador fosse vender
   */
  it("o mercado fica colado no bestiario", () => {
    const markup = render({ snapshot: snapshot() });

    const ordem = [...markup.matchAll(/hud-btn--([a-z-]+)/g)].map(
      (m) => m[1],
    );

    const bestiary = ordem.indexOf("bestiary");
    const market = ordem.indexOf("market");
    const collection = ordem.indexOf("collection");

    expect(bestiary, "o botao do bestiario sumiu").toBeGreaterThanOrEqual(0);

    expect(
      market,
      "o mercado precisa ser o botao DEPOIS do bestiario, sem nada entre",
    ).toBe(bestiary + 1);

    expect(
      collection,
      "a colecao vem depois do par bestiario + market",
    ).toBeGreaterThan(market);
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
    /**
     * O estado do auto NAO E MAIS TEXTO.
     *
     * O botao escreve so "auto", e quem diz se ele esta ligado e a
     * classe: `is-on` pinta a borda e o fundo de verde e liga o pulso,
     * `is-engaged` pinta de dourado. A cor e o pulso dizem "ligado" de
     * relance, sem focar a tela — o que o texto fazia mal
     *
     * Estas afirmacoes foram o TEXTO porque ele era o unico sinal que
     * existia. A CLASS e o sinal que sobrou, e o que continua valendo
     */
    const off = render({ snapshot: snapshot() });

    expect(off).toContain(">auto<");
    expect(off).not.toContain("hud-ability is-on");
    expect(off).not.toContain("hud-ability is-engaged");

    expect(
      render({ snapshot: snapshot({ engaged: true }) }),
    ).toContain("hud-ability is-engaged");

    const on = render({
      snapshot: snapshot({ autoPlay: true }),
    });

    expect(on).toContain(">auto<");
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

    /**
     * A QUANTIDADE VEM DO CATALOGO, e nao um numero escrito aqui.
     *
     * A primeira cacada de limo e `2x` a base da missao principal, e a
     * base sobe com o nivel do degrau. Escrever `5` aqui travava o
     * teste no numero antigo: quando a conta mudou para 20, o teste
     * matava 5 limos, nao fechava nada e falhava — parecendo que o
     * badge tinha quebrado, quando o que tinha mudado era a cacada
     *
     * Ler do catalogo faz o teste valer para a conta que existir
     */
    const primeira = getBestiaryEntry("slime").hunts[0];

    bestiary.onKill("slime", primeira.count);

    const html = render({
      snapshot: snapshot({ bestiary: bestiary.snapshot() }),
    });

    expect(html).toContain("hud-btn__badge");
    expect(html).toContain("1");
  });

  /**
 * O menu da barra, e o que NAO esta mais nele.
 *
 * O botao de voltar para as classes e o de restaurar alvos sairam: o
 * primeiro levava para fora do jogo em um clique, e o segundo era um
 * atalho para um estado que o auto play desfaz sozinho. Este teste
 * trava a ausencia, porque um botao que volta a aparecer por um
 * `git merge` nao quebraria nada nos outros testes — eles so conferem
 * o que ainda existe
 */
it("keeps the bestiary in the hud-menu, sem os botoes que sairam", () => {
  const html = render({ snapshot: snapshot() });

  const botoes = menu(html);

  expect(botoes).toContain("hud-btn--bestiary");

  expect(botoes).not.toContain("Voltar para as classes");
  expect(botoes).not.toContain("Restaurar alvos");
  expect(botoes).not.toContain("hud-btn--reset");
});
});

describe("craft menu", () => {
  function craftSnapshot(stock = {}) {
    const craft = new Craft();
    const inventory = new Inventory();

    for (const [itemId, count] of Object.entries(stock)) {
      inventory.add(itemId, count);
    }

    return craft.snapshot(inventory);
  }

  it("tem um botao de craft ao lado do bestiario", () => {
    const html = render({ snapshot: snapshot() });

    const botoes = menu(html);

    expect(botoes).toContain("hud-btn--craft");
    expect(botoes).toContain("hud-btn--bestiary");
    expect(botoes).toContain("Craft (C)");

    // o craft tem de vir logo depois do bestiario
    expect(botoes.indexOf("hud-btn--craft")).toBeGreaterThan(
      botoes.indexOf("hud-btn--bestiary"),
    );
  });

  it("nao mostra badge quando nada esta pronto", () => {
    const html = render({
      snapshot: snapshot({ craft: craftSnapshot() }),
    });

    expect(craftSnapshot().ready).toBe(0);

    // o recorte e o BOTAO do craft, e nao o menu: um badge no bestiario
    // ou na colecao faria esta checagem passar sem o craft ter badge
    expect(botao(html, "hud-btn--craft")).not.toContain(
      "hud-btn__badge",
    );
  });

  it("mostra quantas receitas estao prontas", () => {
    // os ingredientes de `craft_ghoul_rot`, que e gratuita. O
    // par antigo (pele + gele) era de `craft_tracker_boots`, recipe
    // que saiu do catalogo, e nenhuma receita fechava
    const data = craftSnapshot({
      slime_gel: 3,
      goblin_cloth: 1,
    });

    expect(data.ready).toBeGreaterThan(0);

    const html = render({
      snapshot: snapshot({ craft: data }),
    });

    expect(botao(html, "hud-btn--craft")).toContain(
      "hud-btn__badge",
    );
  });

  it("aguenta o HUD sem craft no snapshot", () => {
    const html = render({ snapshot: snapshot() });

    expect(html).toContain("hud-btn--craft");
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
