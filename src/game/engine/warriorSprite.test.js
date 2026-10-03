import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import {
  DIRECTION_KEYS,
  resolveDirectionKey,
} from "../sprites/animation.js";
import { WARRIOR_SPRITE } from "../../data/sprites/index.js";
import { WARRIOR_SPRITE as WARRIOR_LAYOUT_SPRITE } from "../../data/sprites/layout.js";
import { createCreature } from "../../data/enemies/index.js";
import { installDomStubs } from "./testHarness.js";

/**
 * O sprite do guerreiro em jogo, e o GOLPE dele.
 *
 * A arte entra em `src/assets/sprites/warrior/`, convertida pela
 * `tools/gif-to-sheet.mjs` em `warrior-sheet.png`: 17 linhas de 68px,
 * sendo 8 de caminhada, 1 de idle e 8 de golpe de 9 quadros.
 *
 * O que este arquivo prova e o que o motor faz com essa folha:
 *
 * - carrega o PNG gerado, e nao um GIF por direcao
 * - a geometria da folha bate com o que o layout declara
 * - o golpe toca nas OITO direcoes, e visita os 9 quadros
 * - o golpe NAO depende de alvo, que e a diferenca dele para o
 *   arqueiro: e um `./target`, entao basta apertar o ataque
 *
 * Este e o complemento do `arbalistSprite.test.js`, que cobre o
 * mesmo motor para a outra classe direcional. Onde os dois se
 * sobrepoem, o comportamento e o mesmo por construcao: o motor le
 * `animations` e `directions` da definicao e nao conhece classe
 */
installDomStubs();

const WARRIOR = CHARACTER_CLASSES.find(
  (definition) => definition.id === "warrior",
);

const CELULA = WARRIOR_SPRITE.frameWidth;

const loadedImages = [];
const scratchContexts = new Map();
const consumedCalls = new Map();
let scratchSequentialId = 0;

function makeContext() {
  const calls = [];
  const store = {};

  const context = new Proxy(store, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        calls.push([key, ...args]);
      };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });

  context.calls = calls;

  return context;
}

function installStubs() {
  loadedImages.length = 0;
  scratchContexts.clear();
  consumedCalls.clear();
  scratchSequentialId = 0;

  globalThis.Image = class {
    constructor() {
      this.width = 612;
      this.height = 1156;
      this.complete = true;
      this.onload = null;
      this.onerror = null;
      this.src = "";
      loadedImages.push(this);
    }

    set src(value) {
      this.source = value;
      this.onload?.();
    }

    get src() {
      return this.source ?? "";
    }
  };

  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") return {};

      scratchSequentialId += 1;

      const scratchContext = makeContext();

      const canvas = {
        width: 0,
        height: 0,
        getContext: () => scratchContext,
      };

      scratchContexts.set(canvas, scratchContext);

      return canvas;
    },
  };
}

function removeStubs() {
  delete globalThis.Image;
  delete globalThis.document;
}

function createEngine() {
  const listeners = {};
  const context = makeContext();

  const element = {
    width: 1280,
    height: 720,

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
    WARRIOR,
    () => {},
  );

  engine.setMap(MAP_1);
  engine.currentContext = context;

  return engine;
}

function collectNew(context) {
  const start = consumedCalls.get(context) ?? 0;
  const slice = context.calls.slice(start);

  consumedCalls.set(context, context.calls.length);

  return slice;
}

function drawPlayerFrame(engine) {
  engine.render();

  const contexts = [engine.currentContext];

  for (const sheet of [
    engine.spriteSheet,
    ...engine.enemySprites.values(),
  ]) {
    if (sheet.scratch && scratchContexts.has(sheet.scratch)) {
      contexts.push(scratchContexts.get(sheet.scratch));
    }
  }

  return contexts.flatMap(collectNew);
}

/** as chamadas de `drawImage` da folha do JOGADOR, e nao dos inimigos */
function sheetDraws(engine, calls) {
  const image = engine.spriteSheet.image;

  return calls.filter(
    ([name, source]) =>
      name === "drawImage" && source === image,
  );
}

function resetPlayer(player) {
  player.hp = player.maxHp;
  player.attackAnimation = 0;
  player.hitFlash = 0;
  player.firingTargetId = null;
  player.x = 1200;
  player.y = 800;
}

function holdKeys(engine, codes) {
  engine.input.keys.clear();

  for (const code of codes) {
    engine.input.keys.add(code);
  }
}

function clearCombat(engine) {
  engine.world.enemies.length = 0;
  engine.world.projectiles.length = 0;
  engine.world.pendingPulses.length = 0;
  engine.world.delayedEffects.length = 0;
  engine.world.drops.length = 0;
}

function spawnDummy(engine, dx, dy) {
  const player = engine.world.player;
  const dummy = createCreature(
    "ogre",
    { x: player.x + dx, y: player.y + dy },
    0,
  );

  engine.world.projectiles.length = 0;
  engine.world.enemies.push(dummy);

  return dummy;
}

const NORTE = {
  east: [300, 0],
  "south-east": [300, 300],
  south: [0, 300],
  "south-west": [-300, 300],
  west: [-300, 0],
  "north-west": [-300, -300],
  north: [0, -300],
  "north-east": [300, -300],
};

beforeEach(() => {
  installStubs();
});

afterEach(() => {
  removeStubs();
});

describe("warrior directional sheet in game", () => {
  it("loads the generated sheet instead of one gif per direction", () => {
    const engine = createEngine();

    const doJogador = loadedImages.filter(
      (image) => image.source === WARRIOR_SPRITE.src,
    );

    expect(doJogador).toHaveLength(1);
    expect(engine.spriteSheet.ready).toBe(true);
    expect(engine.spriteSheet.image).toBe(doJogador[0]);

    // NENHUM gif pode ser carregado em jogo. Um GIF animado dentro de
    // um `Image` desenhado com `drawImage` mostraria sempre o quadro
    // que estivesse em exibicao no momento da chamada, e isso muda a
    // cada redesenho: a animacao viraria uma tremida
    expect(
      loadedImages.some((image) =>
        image.source?.endsWith(".gif"),
      ),
    ).toBe(false);

    expect(WARRIOR_SPRITE.src.endsWith(".png")).toBe(true);
    expect(WARRIOR_SPRITE.src).toContain("warrior-sheet");

    engine.destroy();
  });

  it("o layout do servidor e o do cliente concordam", () => {
    // A definicao do guerreiro existe em DOIS arquivos: `layout.js`,
    // sem `src`, que e o que o servidor importa para rodar a
    // simulacao sem DOM, e `index.js`, com a URL, que e o que o
    // cliente desenha
    //
    // Se a celula ou a ancora divergirem entre os dois, o cliente
    // recorta a folha no lugar errado e o boneco aparece torto, sem
    // nenhum erro: os dois lados sao "validos" isoladamente
    const doServidor = WARRIOR_LAYOUT_SPRITE;

    for (const campo of [
      "frameWidth",
      "frameHeight",
      "anchorX",
      "anchorY",
      "scale",
      "footOffset",
      "format",
      "fallbackDirection",
    ]) {
      expect(
        WARRIOR_SPRITE[campo],
        `${campo}: cliente tem ` +
          `${WARRIOR_SPRITE[campo]}, servidor tem ` +
          `${doServidor[campo]}`,
      ).toBe(doServidor[campo]);
    }

    // as animacoes tambem: o motor do servidor escolhe a animacao
    // para a simulacao, e o cliente escolhe para o desenho
    expect(WARRIOR_SPRITE.animations).toEqual(
      doServidor.animations,
    );

    expect(WARRIOR_SPRITE.directions).toEqual(
      doServidor.directions,
    );

    // o servidor nao tem pixels: e o que o faz cair no corpo vetorial
    expect(doServidor.src).toBe(null);
    expect(typeof WARRIOR_SPRITE.src).toBe("string");
  });

  it("a celula da folha bate com a do layout", () => {
    // O cruzamento que impede o jogo de desenhar a arte errada em
    // silencio: se a celula do layout e 68 e o PNG foi gerado com 64,
    // cada `drawImage` recorta um pedaco do personagem e desloca a
    // linha — e nada no console reclama, o boneco so aparece torto
    const engine = createEngine();

    const imagem = engine.spriteSheet.image;

    expect(CELULA).toBe(68);
    expect(imagem.width).toBe(9 * CELULA);
    expect(imagem.height).toBe(17 * CELULA);

    // a maior linha lida pelo layout tem de caber na folha: a linha do
    // golpe na ultima direcao
    const ultimaLinha =
      WARRIOR_SPRITE.animations.attack.rowOffset +
      Math.max(...Object.values(WARRIOR_SPRITE.directions));

    expect((ultimaLinha + 1) * CELULA).toBeLessThanOrEqual(
      imagem.height,
    );

    // e a maior coluna tambem
    const maiorCiclo = Math.max(
      ...Object.values(WARRIOR_SPRITE.animations).map(
        (animacao) => animacao.length,
      ),
    );

    expect(maiorCiclo * CELULA).toBeLessThanOrEqual(imagem.width);

    engine.destroy();
  });

  it("declara o golpe sem depender de alvo", () => {
    // A diferenca do guerreiro para o arqueiro. O arco do arqueiro so
    // existe apontado para alguma coisa, entao `needsTarget` mantem ele
    // no idle sem alvo. O golpe do guerreiro e um `./target`: apertar
    // o ataque tem que mostrar a animacao
    expect(
      WARRIOR_SPRITE.animations.attack.needsTarget,
    ).toBe(undefined);
  });

  it("golpa sem alvo nenhum, sem cair no idle", () => {
    // O `needsTarget` do arqueiro existe porque o arco dele so existe
    // apontado para alguma coisa: sem alvo no foco, ele continua no
    // idle. O golpe do guerreiro e um `./target`, e nao tem essa
    // reserva
    //
    // O caminho do `useBasicAttack` acima faz isso com alvo. Aqui e o
    // caso que o `needsTarget` esconderia se estivesse ligado: um
    // golpe sem `firingTargetId`, que e o que acontece quando o
    // jogador ataca no vazio ou usa uma habilidade sem alvo
    const engine = createEngine();
    const player = engine.world.player;

    resetPlayer(player);
    clearCombat(engine);
    holdKeys(engine, []);

    player.facing = { x: 0, y: 1 };
    player.attackAnimation = 0.2;
    player.firingTargetId = null;

    engine.update(1 / 60);

    const [draw] = sheetDraws(engine, drawPlayerFrame(engine));

    expect(
      draw[3] / CELULA,
      "o golpe sem alvo caiu no idle em vez de mostrar o ataque",
    ).toBe(
      WARRIOR_SPRITE.animations.attack.rowOffset +
        WARRIOR_SPRITE.directions.south,
    );

    engine.destroy();
  });

  it("a linha de idle e a 8, e a de golpe a 9", () => {
    // A ordem das linhas na folha foi montada pela ferramenta: 8 de
    // caminhada, 1 de idle, 8 de golpe
    expect(WARRIOR_SPRITE.animations.idle.row).toBe(8);
    expect(WARRIOR_SPRITE.animations.attack.rowOffset).toBe(9);
  });

  it("toca o golpe nas oito direcoes, com 9 quadros cada", () => {
    const engine = createEngine();
    const player = engine.world.player;

    const golpeRow = WARRIOR_SPRITE.animations.attack.rowOffset;

    for (const key of DIRECTION_KEYS) {
      const [dx, dy] = NORTE[key];

      const colunas = new Set();

      resetPlayer(player);
      clearCombat(engine);
      holdKeys(engine, []);

      /**
       * O personagem e virado para a direcao, e nao recebe um alvo.
       *
       * O giro para o alvo depende de `firingTargetId`: e ele que o
       * `updatePlayer` usa para virar o `facing` durante o golpe. Sem
       * alvo — o golpe de um golpe sem nada na frente — o guerreiro
       * bate para onde ja esta virado, que e o certo para corpo a
       * corpo. O giro por alvo e testado a parte, no caminho de
       * verdade do `useBasicAttack`
       */
      player.facing = { x: dx / 300, y: dy / 300 };

      for (let frame = 0; frame < 34; frame += 1) {
        player.attackAnimation = 0.2;
        player.hp = player.maxHp;

        engine.update(1 / 60);

        const [draw] = sheetDraws(
          engine,
          drawPlayerFrame(engine),
        );

        expect(draw, `${key} frame ${frame}`).toBeDefined();

        expect(
          draw[3] / CELULA,
          `${key} frame ${frame}`,
        ).toBe(golpeRow + WARRIOR_SPRITE.directions[key]);

        colunas.add(draw[2] / CELULA);
      }

      // os 9 quadros do golpe, todos visitados
      expect(
        colunas.size,
        `${key} viu ${[...colunas].join(",")}`,
      ).toBe(WARRIOR_SPRITE.animations.attack.length);
    }

    engine.destroy();
  });

  it("o ataque basico do jogo dispara a animacao de golpe", () => {
    // O caminho de verdade: `useBasicAttack`, e nao um
    // `attackAnimation` escrito a mao. E o que o espaco e o clique
    // chamam
    const engine = createEngine();
    const player = engine.world.player;

    resetPlayer(player);
    clearCombat(engine);

    spawnDummy(engine, 120, 0);

    holdKeys(engine, []);

    engine.useBasicAttack();

    expect(
      player.attackAnimation,
      "o ataque basico nao abriu a janela de golpe",
    ).toBeGreaterThan(0);

    engine.update(1 / 60);

    const [draw] = sheetDraws(engine, drawPlayerFrame(engine));

    expect(
      draw[3] / CELULA,
      "o guerreiro nao virou para o alvo para golpear",
    ).toBe(
      WARRIOR_SPRITE.animations.attack.rowOffset +
        WARRIOR_SPRITE.directions.east,
    );

    engine.destroy();
  });

  it("volta ao idle quando o golpe acaba", () => {
    const engine = createEngine();
    const player = engine.world.player;

    resetPlayer(player);
    clearCombat(engine);
    holdKeys(engine, []);

    const alvo = spawnDummy(engine, 120, 0);

    player.attackAnimation = 0.2;
    player.firingTargetId = alvo.id;

    engine.update(1 / 60);

    const [noGolpe] = sheetDraws(engine, drawPlayerFrame(engine));

    expect(noGolpe[3] / CELULA).toBeGreaterThanOrEqual(9);

    // a janela do golpe fecha, e sem andar o personagem fica no idle
    player.attackAnimation = 0;
    player.firingTargetId = null;

    for (let frame = 0; frame < 8; frame += 1) {
      engine.update(1 / 60);

      const [draw] = sheetDraws(
        engine,
        drawPlayerFrame(engine),
      );

      expect(
        draw[3] / CELULA,
        `frame ${frame} apos o golpe`,
      ).toBe(WARRIOR_SPRITE.animations.idle.row);
    }

    engine.destroy();
  });

  it("anda na linha da direcao e para no idle", () => {
    const engine = createEngine();
    const player = engine.world.player;

    clearCombat(engine);
    resetPlayer(player);

    holdKeys(engine, ["KeyS"]);

    for (let frame = 0; frame < 8; frame += 1) {
      engine.update(1 / 60);

      const [draw] = sheetDraws(
        engine,
        drawPlayerFrame(engine),
      );

      expect(
        draw[3] / CELULA,
        `andando frame ${frame}`,
      ).toBe(WARRIOR_SPRITE.directions.south);
    }

    holdKeys(engine, []);

    engine.update(1 / 60);

    const [parado] = sheetDraws(engine, drawPlayerFrame(engine));

    expect(player.isMoving).toBe(false);
    expect(parado[3] / CELULA).toBe(
      WARRIOR_SPRITE.animations.idle.row,
    );

    engine.destroy();
  });

  it("nao espelha, porque o oeste e uma linha da folha", () => {
    const engine = createEngine();
    const player = engine.world.player;

    // esvaziar o mapa deixa qualquer `scale` no frame ser do jogador
    engine.world.enemies.length = 0;

    resetPlayer(player);

    holdKeys(engine, ["KeyA"]);

    for (let frame = 0; frame < 6; frame += 1) {
      engine.update(1 / 60);
    }

    expect(resolveDirectionKey(player.facing)).toBe("west");

    const calls = drawPlayerFrame(engine);

    // no formato direcional o oeste e arte propria: espelhar o leste
    // mostraria o guerreiro de frente olhando para tras
    expect(
      calls.some(([name]) => name === "scale"),
      "o sprite do guerreiro foi espelhado",
    ).toBe(false);

    const [draw] = sheetDraws(engine, calls);

    expect(draw[3] / CELULA).toBe(WARRIOR_SPRITE.directions.west);

    engine.destroy();
  });

  it("cai no corpo vetorial quando a folha nao carrega", () => {
    globalThis.Image = class {
      constructor() {
        this.width = 0;
        this.height = 0;
        this.complete = false;
        this.onload = null;
        this.onerror = null;
        this.src = "";
      }
    };

    const engine = createEngine();

    engine.setAutoPlay(true);

    for (let frame = 0; frame < 90; frame += 1) {
      engine.world.player.hp = engine.world.player.maxHp;
      engine.update(1 / 60);

      expect(
        () => engine.render(),
        `frame ${frame}`,
      ).not.toThrow();
    }

    expect(engine.spriteSheet.ready).toBe(false);

    engine.destroy();
  });
});
