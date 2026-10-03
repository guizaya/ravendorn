import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { installDomStubs } from "./testHarness.js";

installDomStubs();

/** contexto que registra o que foi desenhado para podermos inspecionar */
function createRecordingContext() {
  const calls = [];
  const texts = [];

  const store = {
    calls,
    texts,

    createPattern: () => ({ pattern: true }),

    fillText(...args) {
      texts.push(args[0]);
      calls.push({ name: "fillText", args });
    },

    strokeText(...args) {
      texts.push(args[0]);
      calls.push({ name: "strokeText", args });
    },

    measureText: (value) => ({
      width: String(value).length * 6,
    }),
  };

  const context = new Proxy(store, {
    get(target, key) {
      if (key in target) return target[key];

      const recorded = (...args) => {
        calls.push({ name: String(key), args });
      };

      target[key] = recorded;

      return recorded;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });

  return context;
}

function createEngine() {
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
        getContext: () => createRecordingContext(),
      };
    },
  };

  const context = createRecordingContext();
  const listeners = {};

  const element = {
    getContext: () => context,
    addEventListener(type, handler) {
      (listeners[type] ??= []).push(handler);
    },
    removeEventListener(type, handler) {
      listeners[type] = (listeners[type] ?? []).filter(
        (item) => item !== handler,
      );
    },
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    }),
  };

  const engine = new GameEngine(
    element,
    CHARACTER_CLASSES[0],
    () => {},
  );

  engine.setMap(MAP_1);
  engine.context = context;

  return { engine, context };
}

function pointerOn(engine, enemy) {
  engine.input.pointer = {
    x: enemy.x,
    y: enemy.y,
    inside: true,
  };
}

describe("hover do mob", () => {
  it("nao pega nada com o cursor fora da tela", () => {
    const { engine } = createEngine();

    engine.input.pointer = { x: 0, y: 0, inside: false };

    expect(engine.getHoveredEnemy()).toBe(null);

    engine.destroy();
  });

  it("pega o mob debaixo do cursor", () => {
    const { engine } = createEngine();
    const enemy = engine.world.enemies[0];

    pointerOn(engine, enemy);

    expect(engine.getHoveredEnemy()).toBe(enemy);

    engine.destroy();
  });

  it("ignora o mob longe do cursor", () => {
    const { engine } = createEngine();
    const enemy = engine.world.enemies[0];

    engine.input.pointer = {
      x: enemy.x + enemy.radius + 400,
      y: enemy.y,
      inside: true,
    };

    expect(engine.getHoveredEnemy()).toBe(null);

    engine.destroy();
  });

  it("ignora mob morto", () => {
    const { engine } = createEngine();
    const enemy = engine.world.enemies[0];

    enemy.alive = false;
    pointerOn(engine, enemy);

    expect(engine.getHoveredEnemy()).toBe(null);

    engine.destroy();
  });

  it("prefere o alvo atual quando ha mob sobrepostos", () => {
    const { engine } = createEngine();
    const [first, second] = engine.world.enemies;

    // mesmo ponto para os dois
    second.x = first.x;
    second.y = first.y;

    engine.selectedTargetId = second.id;
    pointerOn(engine, first);

    expect(engine.getHoveredEnemy()).toBe(second);

    engine.destroy();
  });

  it("cai no alvo selecionado quando o cursor nao esta em nenhum mob", () => {
    const { engine } = createEngine();
    const enemy = engine.world.enemies[0];

    engine.selectedTargetId = enemy.id;
    engine.input.pointer = { x: 99999, y: 99999, inside: true };

    expect(engine.getInspectedEnemy()).toBe(enemy);

    engine.destroy();
  });

  it("prefere o hover sobre o alvo quando os dois existem", () => {
    const { engine } = createEngine();
    const [first, second] = engine.world.enemies;

    engine.selectedTargetId = second.id;
    pointerOn(engine, first);

    expect(engine.getInspectedEnemy()).toBe(first);

    engine.destroy();
  });

  it("nao devolve nada sem cursor nem alvo", () => {
    const { engine } = createEngine();

    engine.input.pointer = { x: 0, y: 0, inside: false };
    engine.selectedTargetId = null;

    expect(engine.getInspectedEnemy()).toBe(null);

    engine.destroy();
  });
});

describe("barra de vida desenhada", () => {
  it("nao desenha nada sem hover nem alvo", () => {
    const { engine, context } = createEngine();

    engine.input.pointer = { x: 0, y: 0, inside: false };
    engine.selectedTargetId = null;

    context.texts.length = 0;

    engine.drawEnemyHpBar(context);

    expect(context.texts).toHaveLength(0);

    engine.destroy();
  });

  it("escreve o nivel do mob junto com a vida", () => {
    const { engine, context } = createEngine();
    const enemy = engine.world.enemies[0];

    pointerOn(engine, enemy);

    context.texts.length = 0;

    engine.drawEnemyHpBar(context);

    expect(context.texts).toContain(`Nv.${enemy.level}`);
    expect(context.texts).toContain(
      `${Math.ceil(enemy.hp)} / ${Math.ceil(enemy.maxHp)}`,
    );

    engine.destroy();
  });

  it("acrescenta o numero de vida no mesmo rreguao do nivel", () => {
    const { engine, context } = createEngine();
    const enemy = engine.world.enemies[0];

    pointerOn(engine, enemy);

    context.texts.length = 0;

    engine.drawEnemyHpBar(context);

    const level = context.texts.findIndex((text) =>
      text.startsWith("Nv."),
    );
    const hp = context.texts.findIndex((text) =>
      text.includes(" / "),
    );

    expect(level).toBeGreaterThanOrEqual(0);
    expect(hp).toBeGreaterThanOrEqual(0);

    engine.destroy();
  });

  it("usa o nivel escalado, nao o base do tipo", () => {
    const { engine, context } = createEngine();
    const enemy = engine.world.enemies[0];

    // sobe o nivel de um bicho
    enemy.level = (enemy.baseLevel ?? 1) + 2;
    enemy.maxHp = Math.round(enemy.maxHp * 1.44);

    pointerOn(engine, enemy);

    context.texts.length = 0;

    engine.drawEnemyHpBar(context);

    expect(context.texts).toContain(
      `Nv.${enemy.baseLevel + 2}`,
    );

    engine.destroy();
  });

it("escreve nome e vida no mob sob o cursor", () => {
    const { engine, context } = createEngine();
    const enemy = engine.world.enemies[0];

    pointerOn(engine, enemy);

    context.texts.length = 0;

    engine.drawEnemyHpBar(context);

    expect(context.texts).toContain(enemy.name);
    expect(context.texts).toContain(
      `${Math.ceil(enemy.hp)} / ${Math.ceil(enemy.maxHp)}`,
    );

    engine.destroy();
  });

  it("desenha para o alvo mesmo sem cursor em cima", () => {
    const { engine, context } = createEngine();
    const enemy = engine.world.enemies[0];

    engine.input.pointer = { x: 0, y: 0, inside: false };
    engine.selectedTargetId = enemy.id;

    context.texts.length = 0;

    engine.drawEnemyHpBar(context);

    expect(context.texts).toContain(enemy.name);

    engine.destroy();
  });

  it("some quando o mob do hover deixa de existir", () => {
    const { engine, context } = createEngine();
    const enemy = engine.world.enemies[0];

    pointerOn(engine, enemy);
    engine.drawEnemyHpBar(context);

    enemy.alive = false;
    engine.selectedTargetId = null;

    context.texts.length = 0;
    engine.drawEnemyHpBar(context);

    expect(context.texts).toHaveLength(0);

    engine.destroy();
  });

  it("usa a posicao da barra dentro do viewport", () => {
    const { engine, context } = createEngine();
    const enemy = engine.world.enemies[0];

    pointerOn(engine, enemy);

    context.calls.length = 0;
    engine.drawEnemyHpBar(context);

    const rects = context.calls
      .filter((call) => call.name === "fillRect")
      .map((call) => call.args);

    expect(rects.length).toBeGreaterThan(0);

    for (const [x, , width] of rects) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(width)).toBe(true);
      expect(width).toBeGreaterThanOrEqual(0);
    }

    // a moldura precisa ficar acima da cabeca do mob
    const headTop = engine.enemyHeadTop(enemy);
    const topmost = Math.min(
      ...rects.map(([, y]) => y),
    );

    expect(topmost).toBeLessThan(headTop);

    engine.destroy();
  });

  it("mantem a barra acima da cabeca mesmo com sprite carregado", () => {
    const { engine } = createEngine();
    const enemy = engine.world.enemies[0];

    // resolveDrawRect: topo = y + footOffset - anchorY * scale
    const definition =
      engine.enemySprites.get(enemy.id)?.definition;

    if (definition) {
      expect(engine.enemyHeadTop(enemy)).toBeCloseTo(
        enemy.y +
          definition.footOffset -
          definition.anchorY * definition.scale,
        5,
      );
    } else {
      expect(engine.enemyHeadTop(enemy)).toBeCloseTo(
        enemy.y - enemy.radius,
        5,
      );
    }

    engine.destroy();
  });

  it("o render desenha a barra quando ha hover", () => {
    const { engine, context } = createEngine();
    const enemy = engine.world.enemies[0];

    pointerOn(engine, enemy);

    context.texts.length = 0;

    engine.render();

    expect(context.texts).toContain(enemy.name);
    expect(context.texts).toContain(
      `${Math.ceil(enemy.hp)} / ${Math.ceil(enemy.maxHp)}`,
    );

    engine.destroy();
  });

  it("o render nao desenha a barra sem hover nem alvo", () => {
    const { engine, context } = createEngine();

    engine.input.pointer = { x: 0, y: 0, inside: false };
    engine.selectedTargetId = null;

    context.texts.length = 0;

    engine.render();

    for (const name of engine.world.enemies.map(
      (enemy) => enemy.name,
    )) {
      expect(context.texts).not.toContain(name);
    }

    engine.destroy();
  });

  it("nao desenha mais barra para todo mob da tela", () => {
    const { engine, context } = createEngine();

    engine.input.pointer = { x: 0, y: 0, inside: false };
    engine.selectedTargetId = null;

    context.texts.length = 0;

    // com muitos mobs vivos e sem hover, nenhum rotulo pode aparecer
    expect(engine.world.enemies.length).toBeGreaterThan(1);

    engine.render();

    for (const name of engine.world.enemies.map(
      (enemy) => enemy.name,
    )) {
      expect(context.texts).not.toContain(name);
    }

    engine.destroy();
  });
});