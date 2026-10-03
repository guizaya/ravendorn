import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getEnemySprite } from "../../data/sprites/enemies.js";
import {
  BEHAVIOR,
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
 * A folha do GOBLIN SAQUEADOR no disco, e o que a conversao NAO pode ter
 * quebrado
 *
 * A geracao ja e conferida em `tools/goblinSaqueadorSheet.test.js`. O
 * que importa aqui e o `id`: a pasta de arte se chama `hulk`, e se o
 * `id` tivesse mudado junto, o goblin mais as missoes que o pedem
 * teriam sumido sem erro nenhum
 */

const GOBLIN = getEnemySprite("goblin");

const CELL = GOBLIN.frameWidth;
const IDLE_ROW = GOBLIN.animations.idle.row;
const COLUMNS = Math.max(
  ...Object.values(GOBLIN.animations).map(
    (animation) => animation.length,
  ),
);

const SHEET = fileURLToPath(
  new URL(
    "../../assets/sprites/goblin_saqueador-sheet.png",
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
    row: GOBLIN.directions[key],
    length: GOBLIN.animations.walk.length,
  })),
  {
    name: "idle",
    row: IDLE_ROW,
    length: GOBLIN.animations.idle.length,
  },
];

const cells = lanes().flatMap((lane) =>
  Array.from({ length: lane.length }, (_, column) => ({
    label: `${lane.name} frame ${column}`,
    box: boxOf(cellAt(column, lane.row)),
  })),
);

const retangulo = (animacao, elapsed, facing) =>
  resolveFrameRect(GOBLIN, animacao, elapsed, facing);

describe("a folha do goblin saqueador", () => {
  it("o motor acha a folha pelo id `goblin`", () => {
    expect(GOBLIN, "o goblin nao tem sprite").toBeTruthy();
    expect(GOBLIN.id).toBe("goblin");
    expect(GOBLIN.format).toBe("directional");
    expect(GOBLIN.frameWidth).toBe(68);
    expect(GOBLIN.frameHeight).toBe(68);

    /**
     * E a folha nova, e nao a `enemies/goblin.png` de 32px de tres
     * linhas. Uma URL quebrada aqui daria 404 e o goblin cairia no
     * corpo vetorial sem erro no console
     */
    expect(GOBLIN.src).toContain("goblin_saqueador-sheet.png");
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
        GOBLIN.directions[key],
        key,
      ).toBeGreaterThanOrEqual(0);

      expect(
        GOBLIN.directions[key],
        key,
      ).toBeLessThan(IDLE_ROW);
    }

    expect(
      new Set(Object.values(GOBLIN.directions)).size,
    ).toBe(DIRECTION_KEYS.length);
  });

  it("casa com a definicao que o motor desenha", () => {
    expect(GOBLIN.anchorX).toBe(33.5);
    expect(GOBLIN.anchorY).toBe(55);

    for (const animation of Object.values(GOBLIN.animations)) {
      expect(animation.start).toBe(0);
      expect(animation.fps).toBeGreaterThan(0);
      expect(animation.length).toBeGreaterThan(0);
      expect(animation.length).toBeLessThanOrEqual(COLUMNS);
    }
  });

  it("o idle tem `row`, e nao `rowOffset`", () => {
    // sem o `row` o `resolveFrameRect` usaria `rowOffset ?? 0`, leria
    // a linha 0, que e a caminhada para leste, e o goblin parado
    // viraria de lado
    expect(GOBLIN.animations.idle.row).toBe(IDLE_ROW);
    expect(GOBLIN.animations.idle.rowOffset).toBeUndefined();
  });

  it("desenha o goblin inteiro em cada celula usada", () => {
    for (const { label, box } of cells) {
      expect(box.count, `${label} vazia`).toBeGreaterThan(200);
      expect(box.height, `${label} baixa demais`).toBeGreaterThan(30);
      expect(box.width, `${label} estreita demais`).toBeGreaterThan(16);
    }
  });

  it("mantem o goblin dentro da propria celula", () => {
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
    /**
     * A arte tem uma dispersao de 4px entre as linhas — as duas linhas
     * de norte ficaram com o pe em 59 e as demais em 57, com o idle em
     * 55.
     *
     * A comparacao e pela MEDIANA, e nao pelo maximo: e o que o
     * `alignAnchors` alinha, e o limite de 2px cobre a diferenca real
     * entre pe no chao e pe no ar no meio do passo
     */
    const medians = lanes().map((lane) => {
      const bottoms = [];

      for (let column = 0; column < lane.length; column += 1) {
        bottoms.push(boxOf(cellAt(column, lane.row)).maxY);
      }

      bottoms.sort((a, b) => a - b);

      return bottoms[Math.floor(bottoms.length / 2)];
    });

    const spread = Math.max(...medians) - Math.min(...medians);

    expect(
      spread,
      `medianas de pe: ${medians.join(",")}`,
    ).toBeLessThanOrEqual(2);
  });
});

describe("o goblin saqueador: o desenho", () => {
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
      ).toBe(GOBLIN.directions[direcao] * CELL);
    }
  });

  it("nunca espelha, porque cada direcao tem a linha dela", () => {
    // antes o goblin usava a folha de 3 linhas e ESPELHAVA ao virar
    // para oeste. No formato direcional o oeste e uma LINHA da folha
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
      GOBLIN.directions.south * CELL,
    );
  });

  it("vagar e o estado normal dele, e nao a excecao", () => {
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

  it("o balanco e o do ghoul, e nao o do limo", () => {
    /**
     * O goblin e um bicho de pe medio com `radius: 20`, que aguenta os
     * 3px de amplitude. O que o separou do limo foi o oposto: a arte e
     * grande e ele anda a `speed: 118`, bem mais rapido que a gosma
     */
    expect(CREATURE_TYPES.goblin.radius).toBe(20);
    expect(CREATURE_TYPES.goblin.speed).toBe(118);

    expect(GOBLIN.walkBob.amplitude).toBe(3);
    expect(GOBLIN.animations.walk.fps).toBe(12);
    expect(GOBLIN.animations.idle.fps).toBe(6);
  });
});

describe("o que a conversao do goblin NAO pode ter quebrado", () => {
  it("o id continua sendo `goblin`, e nao o nome da arte", () => {
    /**
     * O mais importante deste arquivo.
     *
     * A pasta de origem se chama `hulk`. Se o `id` tivesse mudado
     * junto, `getEnemySprite("goblin")` devolveria `null` e o goblin
     * cairia no corpo vetorial — sem erro nenhum, so o bicho que para
     * de andar de lado
     */
    expect(CREATURE_TYPES.goblin.id).toBe("goblin");
    expect(CREATURE_TYPES.goblin.name).toBe("Goblin Saqueador");
    expect(GOBLIN.id).toBe("goblin");
  });

  it("o `goblin_cloth` continua no catalogo e no loot", () => {
    /**
     * O `goblin_cloth` e o que o goblin dropa, e entra em craft e
     * recompensa de missao. Ele depende do `id` `goblin` para aparecer
     * no loot, mas nao da arte
     */
    expect(getItem("goblin_cloth")).toBeTruthy();

    const itens = CREATURE_TYPES.goblin.loot.items.map(
      (entrada) => entrada.id,
    );

    expect(itens).toContain("goblin_cloth");
  });

  it("semi-passivo sem golpe: ele e ATACADO, e nao persegue", () => {
    /**
     * O goblin e `SEMI_PASSIVE` com `aggroRange: 0`: passeia e nao
     * persegue. E o mesmo caso do ghoul faminto
     *
     * Reparo por aqui porque o goblin tem `damage: 22` e
     * `attackRange: 52` no catalogo. Isso faz ele parecer um inimigo
     * que ataca, e foi o que quase fez a conversao declarar uma pasta
     * de golpe que nao existe. O `aggroRange: 0` e o que diz a
     * verdade: ele nao persegue
     */
    expect(CREATURE_TYPES.goblin.behavior).toBe(
      BEHAVIOR.SEMI_PASSIVE,
    );
    expect(CREATURE_TYPES.goblin.aggroRange).toBe(0);

    expect(GOBLIN.animations.attack).toBeUndefined();

    const goblin = {
      aiState: "attack",
      attackAnimation: 0.2,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(goblin)).toBe("attack");

    const pedido = retangulo(
      resolveCreatureAnimation(goblin),
      0,
      goblin.facing,
    );

    expect(pedido).toEqual(retangulo("idle", 0, goblin.facing));

    expect(pedido).not.toEqual(retangulo("walk", 0, goblin.facing));
  });

  it("NAO deixa porta de volta para a arte antiga", () => {
    /**
     * O `folha()` que resolvia `enemies/<nome>.png` foi removido do
     * `./enemies.js` junto com esta conversao. Ele nao dava erro ao ser
     * chamado — o arquivo existiria e o goblin voltaria a andar
     * sempre de frente, o oposto do que a conversao fez
     */
    const fonte = readFileSync(
      fileURLToPath(
        new URL("../../data/sprites/enemies.js", import.meta.url),
      ),
      "utf8",
    );

    // so o comentario que explica a remocao pode citar o caminho
    const linhasDeCodigo = fonte
      .split("\n")
      .filter((linha) => !linha.trim().startsWith("*"))
      .filter((linha) => !linha.trim().startsWith("//"))
      .join("\n");

    expect(linhasDeCodigo).not.toContain(
      "assets/sprites/enemies/",
    );

    expect(linhasDeCodigo).not.toContain("createEnemySpriteDefinition");
  });
});