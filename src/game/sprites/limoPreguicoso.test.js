import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getEnemySprite } from "../../data/sprites/enemies.js";
import {
  CREATURE_TYPES,
} from "../../data/enemies/index.js";
import { getItem } from "../../data/items/index.js";
import { inflatePng } from "../../../tools/gif-to-sheet.mjs";
import {
  DIRECTION_KEYS,
  resolveCreatureAnimation,
  resolveFrameRect,
} from "../sprites/animation.js";

/**
 * A folha do LIMO PREGUICOSO no disco, e o que muda para o bicho mais
 * comum do jogo.
 *
 * A geracao ja e conferida em `tools/limoPreguicosoSheet.test.js`.
 * Este arquivo olha para o PNG ja escrito e, mais importante, para o
 * que a conversao NAO pode ter quebrado: o `slime` e a origem do
 * `slime_gel` e do `slime_core`, que o craft e as missoes pedem
 */

const LIMO = getEnemySprite("slime");

const CELL = LIMO.frameWidth;
const IDLE_ROW = LIMO.animations.idle.row;
const COLUMNS = Math.max(
  ...Object.values(LIMO.animations).map(
    (animation) => animation.length,
  ),
);

const SHEET = fileURLToPath(
  new URL(
    "../../assets/sprites/limo_preguicoso-sheet.png",
    import.meta.url,
  ),
);

const sheet = inflatePng(readFileSync(SHEET));

function cellAt(column, row) {
  const pixels = [];

  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const index =
        ((row * CELL + y) * sheet.width + column * CELL + x) * 4;

      pixels.push(
        sheet.data[index],
        sheet.data[index + 1],
        sheet.data[index + 2],
        sheet.data[index + 3],
      );
    }
  }

  return pixels;
}

function boxOf(pixels) {
  let minX = CELL;
  let maxX = -1;
  let minY = CELL;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      if (pixels[(y * CELL + x) * 4 + 3] === 0) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count += 1;
    }
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    count,
  };
}

const lanes = () => [
  ...DIRECTION_KEYS.map((key) => ({
    name: `walk ${key}`,
    row: LIMO.directions[key],
    length: LIMO.animations.walk.length,
  })),
  {
    name: "idle",
    row: IDLE_ROW,
    length: LIMO.animations.idle.length,
  },
];

const cells = lanes().flatMap((lane) =>
  Array.from({ length: lane.length }, (_, column) => ({
    label: `${lane.name} frame ${column}`,
    box: boxOf(cellAt(column, lane.row)),
  })),
);

const retangulo = (animacao, elapsed, facing) =>
  resolveFrameRect(LIMO, animacao, elapsed, facing);

describe("a folha do limo preguiçoso", () => {
  it("o motor acha a folha pelo id `slime`", () => {
    expect(LIMO, "o limo nao tem sprite").toBeTruthy();
    expect(LIMO.id).toBe("slime");
    expect(LIMO.format).toBe("directional");
    expect(LIMO.frameWidth).toBe(68);
    expect(LIMO.frameHeight).toBe(68);

    // e a folha nova, e nao a `enemies/slime.png` de 32px de tres
    // linhas. Uma URL quebrada aqui daria 404 e o bicho mais comum do
    // jogo sumiria sem erro no console
    expect(LIMO.src).toContain("limo_preguicoso-sheet.png");
  });

  it("tem uma linha por direcao, mais o idle na linha 8", () => {
    expect(sheet.width).toBe(CELL * COLUMNS);
    expect(sheet.height).toBe(CELL * (DIRECTION_KEYS.length + 1));
    expect(COLUMNS).toBe(8);
    expect(IDLE_ROW).toBe(8);

    for (const key of DIRECTION_KEYS) {
      // `>= 0` e nao `> 0`: o `east` e a LINHA 0, a primeira de
      // caminhada. Um `> 0` reprovaria a direcao mais usada
      expect(
        LIMO.directions[key],
        key,
      ).toBeGreaterThanOrEqual(0);

      expect(
        LIMO.directions[key],
        key,
      ).toBeLessThan(IDLE_ROW);
    }

    expect(
      new Set(Object.values(LIMO.directions)).size,
    ).toBe(DIRECTION_KEYS.length);
  });

  it("casa com a definicao que o motor desenha", () => {
    expect(LIMO.anchorX).toBe(33.5);
    expect(LIMO.anchorY).toBe(54);

    for (const animation of Object.values(LIMO.animations)) {
      expect(animation.start).toBe(0);
      expect(animation.fps).toBeGreaterThan(0);
      expect(animation.length).toBeGreaterThan(0);
      expect(animation.length).toBeLessThanOrEqual(COLUMNS);
    }
  });

  it("o idle tem `row`, e nao `rowOffset`", () => {
    // sem o `row` o `resolveFrameRect` leria a linha 0, que e a
    // caminhada para leste, e o limo parado viraria de lado
    expect(LIMO.animations.idle.row).toBe(IDLE_ROW);
    expect(LIMO.animations.idle.rowOffset).toBeUndefined();
  });

  it("desenha o limo inteiro em cada celula usada", () => {
    for (const { label, box } of cells) {
      expect(box.count, `${label} vazia`).toBeGreaterThan(200);
      expect(box.height, `${label} baixa demais`).toBeGreaterThan(30);
      expect(box.width, `${label} estreita demais`).toBeGreaterThan(16);
    }
  });

  it("mantem o limo dentro da propria celula", () => {
    for (const { label, box } of cells) {
      expect(
        box.minX,
        `${label} encosta na esquerda`,
      ).toBeGreaterThan(0);
      expect(
        box.maxX,
        `${label} encosta na direita`,
      ).toBeLessThan(CELL - 1);
      expect(
        box.minY,
        `${label} encosta no topo`,
      ).toBeGreaterThan(0);
      expect(
        box.maxY,
        `${label} encosta na base`,
      ).toBeLessThan(CELL - 1);
    }
  });

  it("anima: cada linha tem quadros distintos", () => {
    for (const lane of lanes()) {
      const prints = new Set();

      for (let column = 0; column < lane.length; column += 1) {
        prints.add(cellAt(column, lane.row).join(","));
      }

      expect(
        prints.size,
        `${lane.name} tem ${prints.size} de ${lane.length}`,
      ).toBeGreaterThanOrEqual(6);
    }
  });

  it("alinha os pes entre as linhas", () => {
    const medians = lanes().map((lane) => {
      const bottoms = [];

      for (let column = 0; column < lane.length; column += 1) {
        bottoms.push(boxOf(cellAt(column, lane.row)).maxY);
      }

      bottoms.sort((a, b) => a - b);

      return bottoms[Math.floor(bottoms.length / 2)];
    });

    const spread = Math.max(...medians) - Math.min(...medians);

    // a MEDIANA, e nao o maximo: e o que o `alignAnchors` alinha
    expect(
      spread,
      `medianas de pe: ${medians.join(",")}`,
    ).toBeLessThanOrEqual(2);
  });
});

describe("o limo preguiçoso: o desenho", () => {
  it("cada direcao pega a linha dela", () => {
    const para = {
      east: { x: 1, y: 0 },
      "south-east": { x: 1, y: 1 },
      south: { x: 0, y: 1 },
      "south-west": { x: -1, y: 1 },
      west: { x: -1, y: 0 },
      "north-west": { x: -1, y: -1 },
      north: { x: 0, y: -1 },
      "north-east": { x: 1, y: -1 },
    };

    for (const [direcao, facing] of Object.entries(para)) {
      expect(
        retangulo("walk", 0, facing).y,
        direcao,
      ).toBe(LIMO.directions[direcao] * CELL);
    }
  });

  it("nunca espelha, porque cada direcao tem a linha dela", () => {
    // antes o limo usava a folha de 3 linhas e ESPELHAVA ao virar para
    // oeste. No formato direcional o oeste e uma LINHA da folha
    for (const facing of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      expect(
        retangulo("walk", 0, facing).flip,
        `${facing.x},${facing.y}`,
      ).toBe(false);
    }
  });

  it("andar e parado usam linhas diferentes", () => {
    expect(retangulo("idle", 0, { x: 0, y: 1 }).y).toBe(
      IDLE_ROW * CELL,
    );

    expect(retangulo("walk", 0, { x: 0, y: 1 }).y).toBe(
      LIMO.directions.south * CELL,
    );
  });

  it("vagar e o estado normal dele, e nao a excecao", () => {
    /**
     * O limo e PASSIVO com `aggroRange: 0`: ele passeia o mapa e foge.
     * `wander` esta na lista de estados que contam como andando, e sem
     * isso o bicho mais comum do jogo ficaria parado no idle mesmo
     * andando pelo cenario
     */
    const vagando = {
      aiState: "wander",
      attackAnimation: 0,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(vagando)).toBe("walk");

    expect(
      resolveCreatureAnimation({
        ...vagando,
        aiState: "idle",
      }),
    ).toBe("idle");
  });

  it("o balanco e o menor do jogo, porque o limo e lento", () => {
    /**
     * O limo anda a `speed: 48` e passeia a `wanderSpeed: 30`. Um
     * `amplitude` de 3px faria uma gosma de 45px pular mais do que
     * anda, e o ciclo a 10fps duraria 0.8s — num bicho lento isso
     * fica com aspecto de escorregar
     */
    const tipo = CREATURE_TYPES.slime;

    expect(tipo.speed).toBeLessThan(80);
    expect(tipo.wanderSpeed).toBeLessThan(40);

    expect(LIMO.walkBob.amplitude).toBeLessThanOrEqual(2);

    // e mais lento que o ghoul, que e o outro direcional de bicho
    // grande
    expect(LIMO.animations.walk.fps).toBeLessThanOrEqual(12);
    expect(LIMO.animations.walk.fps).toBe(10);
  });
});

describe("o que a conversao do limo NAO pode ter quebrado", () => {
  it("o id continua sendo `slime`, e nao o nome da arte", () => {
    /**
     * O mais importante deste arquivo.
     *
     * A pasta de origem se chama `guerreiro_2`. Se o `id` tivesse
     * mudado junto, `getEnemySprite("slime")` devolveria `null` e o
     * bicho mais comum do jogo cairia no corpo vetorial — sem erro
     * nenhum, so o limo que deixa de andar
     */
    expect(CREATURE_TYPES.slime.id).toBe("slime");
    expect(CREATURE_TYPES.slime.name).toBe("Limo Preguiçoso");
    expect(LIMO.id).toBe("slime");
  });

  it("o `slime_gel` e o `slime_core` continuam no catalogo", () => {
    /**
     * O `slime_gel` e `slime_core` sao o que o limo dropa, e sao
     * ingrediente de craft e recompensa de missao. Eles dependem do
     * `id` `slime` para aparecerem no loot, mas nao da arte — e este
     * teste trava que a conversao nao encostou neles
     */
    for (const id of ["slime_gel", "slime_core"]) {
      expect(getItem(id), id).toBeTruthy();
    }

    // e o loot do limo continua citando os dois
    const itens = CREATURE_TYPES.slime.loot.items.map(
      (entrada) => entrada.id,
    );

    expect(itens).toContain("slime_gel");
    expect(itens).toContain("slime_core");
  });

  it("sem golpe: o limo e PASSIVO e nao ataca", () => {
    expect(CREATURE_TYPES.slime.behavior).toBe("passive");
    expect(CREATURE_TYPES.slime.aggroRange).toBe(0);

    expect(LIMO.animations.attack).toBeUndefined();

    // e um pedido de golpe cai no idle, nao na caminhada
    const limo = {
      aiState: "attack",
      attackAnimation: 0.2,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(limo)).toBe("attack");

    const pedido = retangulo(
      resolveCreatureAnimation(limo),
      0,
      limo.facing,
    );

    expect(pedido).toEqual(
      retangulo("idle", 0, limo.facing),
    );

    expect(pedido).not.toEqual(
      retangulo("walk", 0, limo.facing),
    );
  });
});