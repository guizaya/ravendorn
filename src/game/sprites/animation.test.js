import { describe, expect, it } from "vitest";
import {
  DIRECTION_KEYS,
  isDirectionalFormat,
  resolveAnimation,
  resolveDirection,
  resolveDirectionKey,
  resolveDrawRect,
  resolveFrame,
  resolveFrameRect,
  resolveWalkOffset,
} from "./animation.js";
import {
  ARBALIST_DIRECTIONS,
  ARBALIST_SPRITE,
  SPRITE_FORMAT,
  getClassSprite,
} from "../../data/sprites/index.js";
import { createSpriteDefinition } from "../../data/sprites/layout.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";

/**
 * O fixture do formato ANTIGO: 3 linhas e espelhamento.
 *
 * Nenhuma classe do jogo usa mais este formato: com o `lancer`
 * convertido, as quatro jogaveis sao direcionais. O `createSpriteDefinition`
 * continua exportado e o motor continua tratando o caso — e sao os
 * ramos de `resolveDirection`, do `flip` e do `walkBob` nulo que ainda
 * precisam de cobertura.
 *
 * O fixture e MONTADO aqui, e nao pego de uma classe: buscar
 * `getClassSprite(<id>)` num formato que nenhuma classe tem mais seria
 * um teste que so passa enquanto sobrar alguem no formato velho, e
 * passaria a testar `undefined` no dia em que a conversao terminasse
 */
const SHEET_SPRITE = createSpriteDefinition(
  "fixture_folha_3_linhas",
  null,
);
const DIRECTIONS = SHEET_SPRITE.directions;

// as quatro classes do jogo. Vem da lista de verdade, e nao escrita
// aqui: quando uma classe sai, este teste passa a rodar so nas que
// existem em vez de quebrar num id apagado
const ALL_CLASSES = CHARACTER_CLASSES.map(
  (definition) => definition.id,
);

function normalize(x, y) {
  const length = Math.hypot(x, y);

  if (length === 0) return { x: 0, y: 0 };

  return { x: x / length, y: y / length };
}

describe("sprite direction", () => {
  it("maps each quadrant to a sprite row", () => {
    const cases = [
      [{ x: 0, y: 1 }, DIRECTIONS.down, false],
      [{ x: 0, y: -1 }, DIRECTIONS.up, false],
      [{ x: 1, y: 0 }, DIRECTIONS.side, false],
      [{ x: -1, y: 0 }, DIRECTIONS.side, true],
    ];

    for (const [facing, row, flip] of cases) {
      expect(resolveDirection(facing, DIRECTIONS)).toEqual({
        row,
        flip,
      });
    }
  });

  it("prefers the vertical axis when it dominates", () => {
    expect(
      resolveDirection({ x: 0.3, y: 0.9 }, DIRECTIONS).row,
    ).toBe(DIRECTIONS.down);

    expect(
      resolveDirection({ x: 0.9, y: 0.3 }, DIRECTIONS).row,
    ).toBe(DIRECTIONS.side);
  });
});

describe("eight way direction", () => {
  it("exposes the eight compass keys once each", () => {
    expect(DIRECTION_KEYS).toHaveLength(8);
    expect(new Set(DIRECTION_KEYS).size).toBe(8);
  });

  it("maps each cardinal to its own key", () => {
    const cases = [
      [{ x: 1, y: 0 }, "east"],
      [{ x: 0, y: 1 }, "south"],
      [{ x: -1, y: 0 }, "west"],
      [{ x: 0, y: -1 }, "north"],
    ];

    for (const [facing, key] of cases) {
      expect(resolveDirectionKey(facing)).toBe(key);
    }
  });

  it("maps each diagonal to its own key", () => {
    const cases = [
      [{ x: 1, y: 1 }, "south-east"],
      [{ x: -1, y: 1 }, "south-west"],
      [{ x: -1, y: -1 }, "north-west"],
      [{ x: 1, y: -1 }, "north-east"],
    ];

    for (const [facing, key] of cases) {
      expect(resolveDirectionKey(facing)).toBe(key);
    }
  });

  it("reads the diagonals from the screen y axis", () => {
    expect(resolveDirectionKey({ x: 1, y: 0.01 })).toBe(
      "east",
    );

    expect(
      resolveDirectionKey({ x: 0.01, y: 1 }),
    ).toBe("south");

    expect(resolveDirectionKey({ x: -1, y: 0.01 })).toBe(
      "west",
    );

    expect(
      resolveDirectionKey({ x: 0.01, y: -1 }),
    ).toBe("north");
  });

  it("snaps the whole circle onto the eight sectors", () => {
    const seen = new Set();

    for (let degree = 0; degree < 360; degree += 1) {
      const radians = (degree * Math.PI) / 180;
      const key = resolveDirectionKey({
        x: Math.cos(radians),
        y: Math.sin(radians),
      });

      expect(DIRECTION_KEYS).toContain(key);

      seen.add(key);
    }

    expect(seen.size).toBe(8);
  });

  it("splits every quadrant at the 45 degree diagonals", () => {
    for (let degree = 0; degree < 90; degree += 1) {
      const radians = (degree * Math.PI) / 180;
      const facing = {
        x: Math.cos(radians),
        y: Math.sin(radians),
      };

      const expected =
        degree <= 22
          ? "east"
          : degree <= 67
            ? "south-east"
            : "south";

      expect(
        resolveDirectionKey(facing),
        `${degree} graus`,
      ).toBe(expected);
    }
  });

  it("rounds a 45 degree vector onto the diagonal", () => {
    const diagonal = normalize(1, 1);

    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(resolveDirectionKey(diagonal)).toBe("south-east");
    expect(resolveDirectionKey({ x: 1, y: 0.9999 })).toBe(
      "south-east",
    );
    expect(resolveDirectionKey({ x: 1, y: 0.0001 })).toBe(
      "east",
    );
  });

  it("keeps the previous direction on a zero vector", () => {
    expect(resolveDirectionKey({ x: 0, y: 0 })).toBe(
      "south",
    );

    expect(
      resolveDirectionKey({ x: 0, y: 0 }, "north-west"),
    ).toBe("north-west");

    expect(resolveDirectionKey(undefined, "west")).toBe(
      "west",
    );
  });

  it("ignores a non normalized magnitude", () => {
    expect(resolveDirectionKey({ x: 400, y: 0 })).toBe(
      "east",
    );

    expect(resolveDirectionKey({ x: 0, y: -12 })).toBe(
      "north",
    );
  });
});

describe("sprite animation selection", () => {
  it("picks attack over walk and idle", () => {
    expect(
      resolveAnimation({
        attackAnimation: 0.1,
        isMoving: true,
      }),
    ).toBe("attack");

    expect(
      resolveAnimation({
        attackAnimation: 0,
        isMoving: true,
      }),
    ).toBe("walk");

    expect(
      resolveAnimation({
        attackAnimation: 0,
        isMoving: false,
      }),
    ).toBe("idle");
  });
});

describe("sprite frame cycling", () => {
  it("loops inside the declared range", () => {
    const animation = {
      start: 2,
      length: 4,
      fps: 10,
    };

    const frames = new Set();

    for (let step = 0; step < 200; step += 1) {
      const frame = resolveFrame(
        animation,
        step / 60,
      );

      expect(frame).toBeGreaterThanOrEqual(2);
      expect(frame).toBeLessThanOrEqual(5);

      frames.add(frame);
    }

    expect([...frames].sort()).toEqual([2, 3, 4, 5]);
  });

  it("never returns the same frame forever", () => {
    const animation = {
      start: 0,
      length: 2,
      fps: 4,
    };

    const frames = new Set();

    for (let step = 0; step < 120; step += 1) {
      frames.add(
        resolveFrame(animation, step / 60),
      );
    }

    expect(frames.size).toBe(2);
  });

  it("handles a zero-length animation without dividing by zero", () => {
    expect(
      resolveFrame({ start: 0, length: 0, fps: 10 }, 1),
    ).toBe(0);
  });
});

describe("sprite frame rect", () => {
  it("reads the correct cell of the sheet", () => {
    const rect = resolveFrameRect(
      SHEET_SPRITE,
      "walk",
      0,
      { x: 0, y: 1 },
    );

    expect(rect).toEqual({
      x: 2 * SHEET_SPRITE.frameWidth,
      y: DIRECTIONS.down * SHEET_SPRITE.frameHeight,
      width: SHEET_SPRITE.frameWidth,
      height: SHEET_SPRITE.frameHeight,
      flip: false,
    });
  });

  it("flags left facing for mirroring", () => {
    const rect = resolveFrameRect(
      SHEET_SPRITE,
      "idle",
      0,
      { x: -1, y: 0 },
    );

    expect(rect.flip).toBe(true);
  });

  it("covers one directional cell without mirroring", () => {
    const rect = resolveFrameRect(
      ARBALIST_SPRITE,
      "walk",
      3,
      { x: 1, y: 0 },
    );

    expect(rect.x).toBe(4 * 64);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(64);
    expect(rect.height).toBe(64);
    expect(rect.flip).toBe(false);
  });
});

describe("directional frame rect", () => {
  it("picks the directional row for every facing", () => {
    const cases = [
      [{ x: 1, y: 0 }, "east"],
      [{ x: 1, y: 1 }, "south-east"],
      [{ x: 0, y: 1 }, "south"],
      [{ x: -1, y: 1 }, "south-west"],
      [{ x: -1, y: 0 }, "west"],
      [{ x: -1, y: -1 }, "north-west"],
      [{ x: 0, y: -1 }, "north"],
      [{ x: 1, y: -1 }, "north-east"],
    ];

    for (const [facing, key] of cases) {
      const rect = resolveFrameRect(
        ARBALIST_SPRITE,
        "walk",
        0,
        facing,
      );

      expect(
        rect.y,
        key,
      ).toBe(ARBALIST_DIRECTIONS[key] * 64);

      expect(rect.flip, key).toBe(false);
      expect(rect.width, key).toBe(64);
      expect(rect.height, key).toBe(64);
    }
  });

  it("gives every direction its own row", () => {
    const rows = Object.values(ARBALIST_DIRECTIONS);

    expect(new Set(rows).size).toBe(rows.length);
    expect(rows.length).toBe(8);
    expect([...rows].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it("cycles the column while walking", () => {
    const seen = new Set();

    for (let step = 0; step < 60; step += 1) {
      const rect = resolveFrameRect(
        ARBALIST_SPRITE,
        "walk",
        step / 60,
        { x: 0, y: 1 },
      );

      seen.add(rect.x);
    }

    const animation = ARBALIST_SPRITE.animations.walk;

    expect(seen.size).toBe(animation.length);
  });

  it("keeps the column inside the sheet", () => {
    const columns = Math.max(
      ...Object.values(ARBALIST_SPRITE.animations).map(
        (animation) => animation.length,
      ),
    );

    for (const name of Object.keys(ARBALIST_SPRITE.animations)) {
      for (let step = 0; step < 120; step += 1) {
        const rect = resolveFrameRect(
          ARBALIST_SPRITE,
          name,
          step / 60,
          { x: 1, y: 0 },
        );

        expect(rect.x, name).toBeGreaterThanOrEqual(0);
        expect(
          rect.x + rect.width,
          name,
        ).toBeLessThanOrEqual(columns * 64);
      }
    }
  });

  it("walks faster than it idles", () => {
    expect(
      ARBALIST_SPRITE.animations.walk.fps,
    ).toBeGreaterThan(
      ARBALIST_SPRITE.animations.idle.fps,
    );
  });

  it("resolves the direction a target sits in", () => {
    const player = { x: 100, y: 100 };

    for (const [dx, dy, key] of [
      [50, 0, "east"],
      [50, 50, "south-east"],
      [0, 50, "south"],
      [-50, 50, "south-west"],
      [-50, 0, "west"],
      [-50, -50, "north-west"],
      [0, -50, "north"],
      [50, -50, "north-east"],
    ]) {
      const rect = resolveFrameRect(
        ARBALIST_SPRITE,
        "walk",
        0,
        normalize(dx, dy),
      );

      expect(
        rect.y,
        `${dx},${dy}`,
      ).toBe(ARBALIST_DIRECTIONS[key] * 64);

      expect(player.x).toBe(100);
    }
  });
});

describe("sprite draw rect", () => {
  it("anchors the feet near the entity position", () => {
    const rect = resolveDrawRect(SHEET_SPRITE, {
      x: 500,
      y: 400,
    });

    expect(rect.x + rect.width / 2).toBe(500);

    const feet = rect.y + SHEET_SPRITE.anchorY * SHEET_SPRITE.scale;

    expect(feet).toBe(400 + SHEET_SPRITE.footOffset);
  });

  it("scales the frame by the declared factor", () => {
    const rect = resolveDrawRect(SHEET_SPRITE, {
      x: 0,
      y: 0,
    });

    expect(rect.width).toBe(
      SHEET_SPRITE.frameWidth * SHEET_SPRITE.scale,
    );
    expect(rect.height).toBe(
      SHEET_SPRITE.frameHeight * SHEET_SPRITE.scale,
    );
  });

  it("draws the directional gifs at the sheet size", () => {
    /**
     * O TAMANHO da caixa, e nao a posicao dela.
     *
     * A igualdade de retangulo inteiro valia enquanto o arquiro usava
     * a ancora compartilhada (32/54). A arte nova foi remedida e o
     * arquiro tem 31.5/51 — o que e CORRETO, porque sem isso ele
     * andava 3px dentro do chao. Comparar a posicao com um fixture de
     * ancora diferente mede a arte de um personagem contra a de outro
     *
     * O que precisa continuar igual e o tamanho: a conversao para
     * folha direcional nao pode mudar o tamanho do desenho
     */
    const sheetRect = resolveDrawRect(SHEET_SPRITE, {
      x: 300,
      y: 300,
    });

    const gifRect = resolveDrawRect(ARBALIST_SPRITE, {
      x: 300,
      y: 300,
    });

    expect([gifRect.width, gifRect.height]).toEqual([
      sheetRect.width,
      sheetRect.height,
    ]);

    // e o arquiro continua no tamanho da celula da folha
    expect([
      gifRect.width,
      gifRect.height,
    ]).toEqual([
      ARBALIST_SPRITE.frameWidth,
      ARBALIST_SPRITE.frameHeight,
    ]);
  });
});

describe("walk bob", () => {
  const BOB = ARBALIST_SPRITE.walkBob;

  it("declares a bob only for the directional gifs", () => {
    expect(BOB.amplitude).toBeGreaterThan(0);
    expect(BOB.frequency).toBeGreaterThan(0);

    for (const id of ALL_CLASSES) {
      const definition = getClassSprite(id);

      if (isDirectionalFormat(definition)) continue;

      expect(definition.walkBob, id).toBe(undefined);
    }
  });

  it("stays flat while standing still", () => {
    for (let step = 0; step < 30; step += 1) {
      const offset = resolveWalkOffset(ARBALIST_SPRITE, {
        walkPhase: step / 60,
        walkBlend: 0,
      });

      expect(offset).toEqual({ x: 0, y: 0 });
    }
  });

  it("only ever lifts the sprite, never sinks it", () => {
    for (let step = 0; step < 240; step += 1) {
      const offset = resolveWalkOffset(ARBALIST_SPRITE, {
        walkPhase: step / 60,
        walkBlend: 1,
      });

      expect(offset.x).toBe(0);
      expect(offset.y).toBeLessThanOrEqual(0);
      expect(offset.y).toBeGreaterThanOrEqual(-BOB.amplitude);
    }
  });

  it("reaches the full amplitude at the top of a step", () => {
    const peak = 0.25 / BOB.frequency;

    expect(
      resolveWalkOffset(ARBALIST_SPRITE, {
        walkPhase: peak,
        walkBlend: 1,
      }).y,
    ).toBeCloseTo(-BOB.amplitude, 6);

    for (const cycle of [1, 2, 3]) {
      expect(
        resolveWalkOffset(ARBALIST_SPRITE, {
          walkPhase: peak + cycle / BOB.frequency,
          walkBlend: 1,
        }).y,
      ).toBeCloseTo(-BOB.amplitude, 6);
    }
  });

  it("plants both feet between steps", () => {
    for (const step of [0, 0.5, 1, 1.5]) {
      expect(
        resolveWalkOffset(ARBALIST_SPRITE, {
          walkPhase: step / BOB.frequency,
          walkBlend: 1,
        }).y,
      ).toBeCloseTo(0, 6);
    }
  });

  it("scales with the blend so the stride eases in", () => {
    const half = resolveWalkOffset(ARBALIST_SPRITE, {
      walkPhase: 0.25 / BOB.frequency,
      walkBlend: 0.5,
    });

    expect(half.y).toBeCloseTo(-BOB.amplitude * 0.5, 6);
  });

  it("leaves sheet sprites untouched", () => {
    for (let step = 0; step < 60; step += 1) {
      expect(
        resolveWalkOffset(SHEET_SPRITE, {
          walkPhase: step / 60,
          walkBlend: 1,
        }),
      ).toEqual({ x: 0, y: 0 });
    }
  });

  it("tolerates a missing walk state", () => {
    expect(resolveWalkOffset(ARBALIST_SPRITE, {})).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("sprite manifest", () => {
  it("assigns a sprite to every playable class", () => {
    for (const id of ALL_CLASSES) {
      expect(getClassSprite(id), id).not.toBe(null);
    }
  });

  it("keeps the arbalist definition exported by id", () => {
    expect(getClassSprite("arbalist")).toBe(ARBALIST_SPRITE);
    expect(ARBALIST_SPRITE.id).toBe("arbalist");
  });

  it("falls back to null for unknown ids", () => {
    for (const id of [
      "inexistente",
      "",
      "ARBALIST",
      "warrior ",
    ]) {
      expect(getClassSprite(id)).toBe(null);
    }
  });

  it("draws each class at the size its own cell declares", () => {
    // O retangulo saiu de ser IGUAL para todas as classes. A celula
    // do arquiro tem 64px e a do guerreiro 68px, porque sao artes de
    // origem de dimensoes diferentes: encolher uma para a outra
    // perderia pixel da arte nova
    //
    // O que continua valendo e o chao: todo mundo tem de pisar na
    // mesma linha do mapa
    const PONTO = { x: 640, y: 360 };
    const bases = [];

    for (const id of ALL_CLASSES) {
      const definition = getClassSprite(id);
      const rect = resolveDrawRect(definition, PONTO);

      // o retangulo sai da propria definicao, sem deslocamento
      // escondido: a ancora e o que amarra a celula ao personagem
      expect(rect.width, id).toBe(
        definition.frameWidth * definition.scale,
      );
      expect(rect.height, id).toBe(
        definition.frameHeight * definition.scale,
      );
      expect(rect.x, id).toBe(
        PONTO.x - definition.anchorX * definition.scale,
      );
      expect(rect.y, id).toBe(
        PONTO.y +
          definition.footOffset -
          definition.anchorY * definition.scale,
      );

      bases.push(rect.y + rect.height);
    }

    /**
     * A base da celula e o chao, e ela e o que `footOffset` e
     * `anchorY` determinam.
     *
     * Nao sai exatamente igual porque sobra uma margem transparente
     * entre o pe e a base da celula, e ela e uma propriedade de cada
     * arte: o `gif-to-sheet` alinha o pe DENTRO de uma folha, e o
     * que sobra embaixo do pe depende de quanto a arte de origem
     * ocupa a celula. Entre estas folhas a diferenca e de poucos
     * pixels
     *
     * A margem de 6px pega erro de ancora de verdade — um digito
     * trocado na ancora joga a celula dezenas de pixels — e deixa
     * passar a diferenca de arte entre as classes
     */
    const chao = Math.max(...bases) - Math.min(...bases);

    expect(chao, `bases ${bases.join(", ")}`).toBeLessThanOrEqual(6);
  });

  it("gives every class a distinct image source", () => {
    const sources = ALL_CLASSES.map(
      (id) => getClassSprite(id).src,
    );

    expect(new Set(sources).size).toBe(
      ALL_CLASSES.length,
    );
  });

  it("keeps every sheet animation inside the sheet", () => {
    // Toda animacao precisa caber na largura da folha, senao o
    // `drawImage` recorta a coluna seguinte e o personagem sai com um
    // pedaco de outro quadro — em silencio, sem erro no console
    //
    // O fixture entra na lista porque nenhuma classe do jogo usa mais
    // o formato antigo: sem ele, o ramo de 3 linhas ficaria sem
    // cobertura nenhuma
    const definitions = ALL_CLASSES.map((id) =>
      getClassSprite(id),
    );

    definitions.push(SHEET_SPRITE);

    for (const definition of definitions) {
      const animations = Object.values(definition.animations);

      /**
       * A largura da folha, por formato.
       *
       * Na folha de 3 linhas as animacoes DIVIDEM a mesma linha com
       * deslocamento: idle nas colunas 0 e 1, caminhada de 2 a 5 e
       * golpe de 6 a 8. E a largura e um numero fixo do formato, 9.
       *
       * Na direcional cada animacao comeca na coluna 0 e tem o seu
       * proprio bloco de linhas, entao a largura e a maior que a
       * propria folha ocupa
       */
      const colunas = isDirectionalFormat(definition)
        ? Math.max(
            ...animations.map(
              (animation) => animation.start + animation.length,
            ),
          )
        : 9;

      for (const animation of animations) {
        const last = animation.start + animation.length;

        expect(
          last,
          `${definition.id}: a animacao passa da folha de ${colunas}`,
        ).toBeLessThanOrEqual(colunas);

        expect(animation.length, definition.id).toBeGreaterThan(0);
        expect(animation.fps, definition.id).toBeGreaterThan(0);
      }
    }
  });

  it("declares one distinct row per facing", () => {
    for (const id of ALL_CLASSES) {
      const definition = getClassSprite(id);
      const rows = Object.values(definition.directions);

      expect(new Set(rows).size, id).toBe(rows.length);
      expect(rows.length, id).toBe(
        isDirectionalFormat(definition) ? 8 : 3,
      );
    }
  });

  it("exposes an image source for every class", () => {
    for (const id of ALL_CLASSES) {
      const src = getClassSprite(id).src;

      expect(typeof src).toBe("string");
      expect(src.length).toBeGreaterThan(0);
    }
  });

  it("marks the converted classes as directional", () => {
    // `warrior` entrou na lista quando a arte dele deixou de ser a
    // folha de 3 linhas com espelhamento e passou a ser a folha
    // direcional de 8 direcoes gerada pelo `gif-to-sheet.mjs`.
    // `sorcerer` entrou do mesmo jeito, e sem arte de golpe: a folha
    // dele tem as 8 direcoes e a linha de idle, e o `attack` aponta
    // para o idle. `lancer` foi o ultimo: com ele, as quatro classes
    // jogaveis sao direcionais e nenhuma ficou na folha de 3 linhas
    const DIRECIONAIS = [
      "arbalist",
      "warrior",
      "sorcerer",
      "lancer",
    ];

    for (const id of ALL_CLASSES) {
      const definition = getClassSprite(id);

      expect(
        isDirectionalFormat(definition),
        id,
      ).toBe(DIRECIONAIS.includes(id));
    }

    // e nenhuma classe nova entra sem ser declarada aqui: uma classe
    // direcional que esquecesse esta lista passaria no teste acima
    for (const id of ALL_CLASSES) {
      if (!isDirectionalFormat(getClassSprite(id))) continue;

      expect(DIRECIONAIS, id).toContain(id);
    }
  });
});

describe("arbalist directional sprite", () => {
  it("uses the directional format", () => {
    expect(ARBALIST_SPRITE.format).toBe(
      SPRITE_FORMAT.DIRECTIONAL,
    );
    expect(ARBALIST_SPRITE.fallbackDirection).toBe(
      "south",
    );
  });

  it("has one row per compass direction", () => {
    expect(
      Object.keys(ARBALIST_DIRECTIONS).sort(),
    ).toEqual(DIRECTION_KEYS.slice().sort());
  });

  it("reads a single generated sheet instead of one file per direction", () => {
    expect(typeof ARBALIST_SPRITE.src).toBe("string");
    expect(ARBALIST_SPRITE.src.length).toBeGreaterThan(0);
    expect(ARBALIST_SPRITE.src.endsWith(".png")).toBe(true);
    expect(ARBALIST_SPRITE.sources).toBe(undefined);
  });

  it("declares real frame ranges because the engine drives them", () => {
    const animations = ARBALIST_SPRITE.animations;

    expect(Object.keys(animations).sort()).toEqual([
      "attack",
      "idle",
      "walk",
    ]);

    for (const animation of Object.values(animations)) {
      expect(animation.start).toBe(0);
      expect(animation.fps).toBeGreaterThan(0);
      expect(animation.length).toBeGreaterThan(1);
    }
  });

  it("usa a arte de tiro so quando ha inimigo no foco", () => {
    const attack = ARBALIST_SPRITE.animations.attack;

    expect(attack.needsTarget).toBe(true);

    // atirando com alvo: arte de tiro
    expect(
      resolveAnimation(
        {
          attackAnimation: 0.2,
          isMoving: false,
          firingTargetId: "ogro_0",
        },
        ARBALIST_SPRITE,
      ),
    ).toBe("attack");

    // buff proprio tambem dispara attackAnimation, mas nao tem
    // alvo: o arqueiro tem de continuar na pose de idle
    expect(
      resolveAnimation(
        {
          attackAnimation: 0.2,
          isMoving: false,
          firingTargetId: null,
        },
        ARBALIST_SPRITE,
      ),
    ).toBe("idle");

    // parado, sem atirar
    expect(
      resolveAnimation(
        {
          attackAnimation: 0,
          isMoving: false,
          firingTargetId: null,
        },
        ARBALIST_SPRITE,
      ),
    ).toBe("idle");

    // andando e atirando: a arte de tiro tem prioridade
    expect(
      resolveAnimation(
        {
          attackAnimation: 0.2,
          isMoving: true,
          firingTargetId: "ogro_0",
        },
        ARBALIST_SPRITE,
      ),
    ).toBe("attack");

    // andando sem atirar
    expect(
      resolveAnimation(
        {
          attackAnimation: 0,
          isMoving: true,
          firingTargetId: null,
        },
        ARBALIST_SPRITE,
      ),
    ).toBe("walk");
  });

  it("a arte de tiro tem um bloco de linhas por direcao", () => {
    const attack = ARBALIST_SPRITE.animations.attack;
    const walk = ARBALIST_SPRITE.animations.walk;

    expect(attack.rowOffset).toBeGreaterThanOrEqual(
      Object.keys(ARBALIST_DIRECTIONS).length + 1,
    );
    expect(walk.rowOffset).toBe(undefined);
    expect(walk.row).toBe(undefined);

    for (const [facing, key] of [
      [{ x: 1, y: 0 }, "east"],
      [{ x: 1, y: 1 }, "south-east"],
      [{ x: 0, y: 1 }, "south"],
      [{ x: -1, y: 1 }, "south-west"],
      [{ x: -1, y: 0 }, "west"],
      [{ x: -1, y: -1 }, "north-west"],
      [{ x: 0, y: -1 }, "north"],
      [{ x: 1, y: -1 }, "north-east"],
    ]) {
      const shoot = resolveFrameRect(
        ARBALIST_SPRITE,
        "attack",
        0,
        facing,
      );

      const walking = resolveFrameRect(
        ARBALIST_SPRITE,
        "walk",
        0,
        facing,
      );

      expect(
        shoot.y / 64,
        `tiro para ${key}`,
      ).toBe(attack.rowOffset + ARBALIST_DIRECTIONS[key]);

      expect(
        walking.y / 64,
        `andar para ${key}`,
      ).toBe(ARBALIST_DIRECTIONS[key]);

      expect(
        shoot.y,
        `${key} nao pode usar a linha de andar`,
      ).not.toBe(walking.y);
    }
  });

  it("as linhas de tiro nao colidem com walk nem com idle", () => {
    const facings = [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
    ];

    const rows = new Set();

    for (const name of ["walk", "idle", "attack"]) {
      for (const facing of facings) {
        rows.add(
          resolveFrameRect(ARBALIST_SPRITE, name, 0, facing)
            .y / 64,
        );
      }
    }

    expect(facings.length).toBe(DIRECTION_KEYS.length);
    expect(rows.size).toBe(8 + 1 + 8);
  });

  it("a arte de tiro tem fps de disparo, nao de caminhada", () => {
    expect(
      ARBALIST_SPRITE.animations.attack.fps,
    ).toBeGreaterThan(
      ARBALIST_SPRITE.animations.walk.fps,
    );
  });

  it("still uses the attack art when the definition has one", () => {
    const withAttack = {
      animations: {
        idle: { start: 0, length: 1, fps: 2 },
        walk: { start: 0, length: 4, fps: 9 },
        attack: { start: 6, length: 3, fps: 14 },
      },
    };

    expect(
      resolveAnimation(
        { attackAnimation: 0.2, isMoving: false },
        withAttack,
      ),
    ).toBe("attack");

    expect(
      resolveAnimation(
        { attackAnimation: 0, isMoving: true },
        withAttack,
      ),
    ).toBe("walk");
  });

  it("pins the idle to its own row and walks on the facing row", () => {
    const idleRow =
      ARBALIST_SPRITE.animations.idle.row;

    expect(idleRow).toBe(8);
    expect(
      Object.values(ARBALIST_DIRECTIONS),
    ).not.toContain(idleRow);

    for (const [facing, key] of [
      [{ x: 1, y: 0 }, "east"],
      [{ x: 0, y: 1 }, "south"],
      [{ x: 0, y: -1 }, "north"],
    ]) {
      const idle = resolveFrameRect(
        ARBALIST_SPRITE,
        "idle",
        0,
        facing,
      );

      const walk = resolveFrameRect(
        ARBALIST_SPRITE,
        "walk",
        0,
        facing,
      );

      expect(idle.y, key).toBe(idleRow * 64);
      expect(walk.y, key).toBe(
        ARBALIST_DIRECTIONS[key] * 64,
      );
    }
  });

  it("covers 64x64 frames drawn at scale one", () => {
    expect(ARBALIST_SPRITE.frameWidth).toBe(64);
    expect(ARBALIST_SPRITE.frameHeight).toBe(64);
    expect(ARBALIST_SPRITE.scale).toBe(1);
  });
});
