import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/styles.css", "utf8");

const SCROLLABLE = [
  ".qst-panel__body",
  ".inv-main",
  ".bst-panel__body",
];
const MODALS = [".qst-panel", ".inv-panel", ".bst-panel"];

function declarationsFor(selector) {
  const escaped = selector.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const pattern = new RegExp(
    `${escaped}\\s*\\{([^}]*)\\}`,
    "g",
  );

  return [...CSS.matchAll(pattern)]
    .map((match) => match[1])
    .join("\n");
}

describe("hud pointer events", () => {
  it("keeps the overlay transparent by default", () => {
    expect(CSS).toMatch(
      /\.hud\s*\{[^}]*pointer-events:\s*none/,
    );
  });

  it("re-enables pointer events on buttons", () => {
    expect(CSS).toMatch(
      /\.hud button\s*\{[^}]*pointer-events:\s*auto/,
    );
  });
});

describe("scrollable panels", () => {
  it("re-enables pointer events on every scrollable region", () => {
    for (const selector of SCROLLABLE) {
      expect(
        declarationsFor(selector),
        `${selector} precisa de pointer-events: auto para rolar`,
      ).toMatch(/pointer-events:\s*auto/);
    }
  });

  it("declares overflow on every scrollable region", () => {
    for (const selector of SCROLLABLE) {
      expect(
        declarationsFor(selector),
        selector,
      ).toMatch(/overflow-y:\s*auto/);
    }
  });

  it("flexes the body so the panel does not grow past the viewport", () => {
    for (const selector of SCROLLABLE) {
      const body = declarationsFor(selector);

      expect(body, selector).toMatch(/flex:\s*1/);
      expect(body, selector).toMatch(/min-height:\s*0/);
    }
  });

  it("constrains the modal height and clips overflow", () => {
    for (const selector of MODALS) {
      const body = declarationsFor(selector);

      expect(body, selector).toMatch(/max-height:/);
      expect(body, selector).toMatch(/overflow:\s*hidden/);
    }
  });

  it("re-enables pointer events on every modal", () => {
    for (const selector of MODALS) {
      expect(
        declarationsFor(selector),
        `${selector} precisa de pointer-events: auto`,
      ).toMatch(/pointer-events:\s*auto/);
    }
  });

  it("keeps panels above the overlay", () => {
    for (const selector of MODALS) {
      expect(
        declarationsFor(selector),
        selector,
      ).toMatch(/z-index:\s*30/);
    }
  });
});

describe("inventory hover label", () => {
  it("ancora o rotulo dentro do container de scroll", () => {
    const name = declarationsFor(".inv-cell__name");

    expect(name).toMatch(/position:\s*absolute/);
    expect(name).toMatch(/white-space:\s*nowrap/);
    expect(name).toMatch(/pointer-events:\s*none/);
  });

  it("inverte a primeira linha para baixo para nao ser recortado", () => {
    expect(CSS).toMatch(
      /\.inv-grid\s*>\s*\.inv-cell:nth-child\(-n\+7\)\s+\.inv-cell__name\s*\{[^}]*top:\s*calc\(100%/,
    );

    // abrir para baixo so funciona se o bottom for limpo
    expect(CSS).toMatch(
      /\.inv-grid\s*>\s*\.inv-cell:nth-child\(-n\+7\)\s+\.inv-cell__name\s*\{[^}]*bottom:\s*auto/,
    );
  });

  it("prende o rotulo nas colunas das pontas", () => {
    expect(CSS).toMatch(
      /\.inv-cell:nth-child\(7n\+1\)\s+\.inv-cell__name\s*\{[^}]*left:\s*0/,
    );

    expect(CSS).toMatch(
      /\.inv-cell:nth-child\(7n\)\s+\.inv-cell__name\s*\{[^}]*right:\s*0/,
    );
  });

  it("mantem a grade em 7 colunas em todos os breakpoints", () => {
    const columns = [
      ...CSS.matchAll(
        /\.inv-grid\s*\{[^}]*grid-template-columns:\s*repeat\(\s*(\d+)/g,
      ),
    ].map((match) => Number(match[1]));

    expect(columns).toEqual([7]);
  });

  it("so posiciona o rotulo no eixo X para nao competir com o vertical", () => {
    const translations = [
      ...CSS.matchAll(/\.inv-cell__name[^{]*\{[^}]*transform:\s*([^;]+);/g),
    ].map((match) => match[1].trim());

    expect(translations.length).toBeGreaterThan(0);

    for (const value of translations) {
      expect(value, value).toMatch(/^translateX\(/);
    }
  });
});

describe("inventory popovers", () => {
  it("ancora a barra de abas para o popover do filtro nao escapar", () => {
    const tabs = declarationsFor(".inv-tabs");

    // sem isto o top do popover resolve contra o .inv-panel e ele
    // nasce la fora, cortado pelo overflow: hidden do painel
    expect(tabs).toMatch(/position:\s*relative/);
  });

  it("mantem o popover e o menu dentro do painel", () => {
    for (const selector of [".inv-filter", ".inv-menu"]) {
      const body = declarationsFor(selector);

      expect(body, selector).toMatch(/position:\s*absolute/);
      expect(body, selector).toMatch(/top:\s*calc\(100%/);
    }
  });

  it("mantem a barra de abas acima do backdrop do menu", () => {
    const tabs = declarationsFor(".inv-tabs");
    const backdrop = declarationsFor(".inv-menu__backdrop");

    const z = (body) =>
      Number(
        body.match(/z-index:\s*(\d+)/)?.[1] ?? "0",
      );

    expect(z(backdrop)).toBeGreaterThan(0);
    // senao o primeiro clique na engrenagem so fecharia o menu
    expect(z(tabs)).toBeGreaterThan(z(backdrop));
  });

  it("mantem o popover do filtro acima do menu de slot", () => {
    const filter = declarationsFor(".inv-filter");
    const menu = declarationsFor(".inv-menu");

    const z = (body) =>
      Number(
        body.match(/z-index:\s*(\d+)/)?.[1] ?? "0",
      );

    expect(z(filter)).toBeGreaterThan(0);
    expect(z(menu)).toBeGreaterThan(0);
  });

  it("desenha o backdrop cobrindo o painel inteiro", () => {
    const backdrop = declarationsFor(".inv-menu__backdrop");

    expect(backdrop).toMatch(/position:\s*absolute/);
    expect(backdrop).toMatch(/inset:\s*0/);
  });
});

describe("bestiary panel", () => {
  it("draws a monster button in the top-right menu", () => {
    expect(CSS).toMatch(/\.hud-btn--bestiary\s*\{/);
    expect(CSS).toMatch(/\.hud-menu\s*\{/);
  });

  it("anchors the closed-hunt badge on the button corner", () => {
    const badge = declarationsFor(".hud-btn__badge");

    expect(badge).toMatch(/position:\s*absolute/);
    expect(badge).toMatch(/top:\s*-3px/);
    expect(badge).toMatch(/right:\s*-3px/);
  });

  it("lays each hunt as title, bar, count and reward", () => {
    const hunt = declarationsFor(".bst-hunt");

    expect(hunt).toMatch(/display:\s*grid/);
    expect(hunt).toMatch(/grid-template-columns:/);
  });

  it("paints finished hunts in gold and pending in purple", () => {
    const fill = declarationsFor(".bst-hunt__fill");

    expect(fill).toMatch(/background:\s*linear-gradient/);
    expect(fill).toMatch(/#c489ff/);

    const done = declarationsFor(
      ".bst-hunt.is-done .bst-hunt__fill",
    );

    expect(done).toMatch(/#e5bb68/);
  });

  it("gives the list room to breathe between cards", () => {
    const list = declarationsFor(".bst-list");

    expect(list).toMatch(/display:\s*grid/);
    expect(list).toMatch(/gap:\s*8px/);
    expect(list).toMatch(/list-style:\s*none/);
  });
});

describe("bestiary auto box", () => {
  it("stacks the box under the quest tracker", () => {
    const stack = declarationsFor(".hud-stack");

    expect(stack).toMatch(/position:\s*absolute/);
    expect(stack).toMatch(/display:\s*grid/);
    expect(stack).toMatch(/gap:\s*8px/);

    // o tracker deixa de ser absoluto para nao brigar com o pai
    expect(declarationsFor(".qst-tracker")).toMatch(
      /position:\s*relative/,
    );
  });

  it("paints the box as a clickable button with a live border", () => {
    const box = declarationsFor(".bst-auto");

    expect(box).toMatch(/display:\s*flex/);
    expect(box).toMatch(/width:\s*100%/);
    expect(box).toMatch(/cursor:\s*pointer/);
    expect(box).toMatch(/border:\s*1px solid rgba\(126,/);
  });

  it("pulses so the player can tell the hunt is running", () => {
    expect(declarationsFor(".bst-auto")).toMatch(
      /animation:\s*bst-auto-pulse/,
    );

    expect(CSS).toMatch(/@keyframes bst-auto-pulse/);
  });

  it("labels the box as auto and offers a stop", () => {
    expect(CSS).toMatch(/\.bst-auto__tag\b/);
    expect(CSS).toMatch(/\.bst-auto__stop\b/);
  });

  it("keeps the zone name on one line", () => {
    const zone = declarationsFor(".bst-auto__zone");

    expect(zone).toMatch(/overflow:\s*hidden/);
    expect(zone).toMatch(/text-overflow:\s*ellipsis/);
    expect(zone).toMatch(/white-space:\s*nowrap/);
  });

  it("highlights the entry being hunted in the panel", () => {
    const hunting = declarationsFor(".bst-entry.is-hunting");

    expect(hunting).toMatch(/border-color:\s*rgba\(126,/);

    const stop = declarationsFor(
      ".bst-entry.is-hunting .bst-entry__go",
    );

    expect(stop).toMatch(/background:\s*#7ef0b0/);
  });

  it("disables the go button for a creature with no zone", () => {
    expect(declarationsFor(".bst-entry__go:disabled")).toMatch(
      /cursor:\s*not-allowed/,
    );
  });
});

describe("stylesheet integrity", () => {
  it("has balanced braces", () => {
    expect((CSS.match(/\{/g) ?? []).length).toBe(
      (CSS.match(/\}/g) ?? []).length,
    );
  });

  it("has no replacement characters from bad encoding", () => {
    expect(CSS).not.toMatch(/\uFFFD/);
  });

  it("has no comment glued to a selector", () => {
    expect(CSS).not.toMatch(/\*\/\./);
  });

  it("has no collapsed single-line rules", () => {
    // um bloco inteiro numa linha costuma ser sinal de edicao quebrada
    const lines = CSS.split("\n").filter(
      (line) => !line.trim().startsWith("@import"),
    );

    const longest = lines.reduce(
      (max, line) => Math.max(max, line.length),
      0,
    );

    expect(longest).toBeLessThan(130);
  });
});
