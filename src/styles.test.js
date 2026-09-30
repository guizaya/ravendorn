import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/styles.css", "utf8");

const SCROLLABLE = [".qst-panel__body", ".inv-main"];
const MODALS = [".qst-panel", ".inv-panel"];

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
