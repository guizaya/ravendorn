import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PropRenderer } from "./PropRenderer.js";
import {
  BLOCKING_PROP_IDS,
  DECORATIVE_PROP_IDS,
  getPropType,
  isBlockingProp,
  PROP_ORDER,
  PROP_SHEET,
  PROP_TYPES,
  PROP_VARIANTS,
  propVariantCount,
} from "../../data/props/index.js";
import { inflatePng } from "../../../tools/gif-to-sheet.mjs";
import {
  MAP_1_BOUNDS,
  MAP_1_META,
  MAP_1_SEED,
  MAP_1_PROPS_LIGADAS,
  MAP_1_SPAWN,
  MAP_1,
  buildPropSolids,
  createProps,
} from "../../data/maps/index.js";
import { CollisionSystem } from "../collision/CollisionSystem.js";

/**
 * As props foram TIRADAS do mapa, mas o sistema continua inteiro.
 *
 * Entao este arquivo fala de dois mapas diferentes, e a distincao e o
 * ponto inteiro dele:
 *
 *   - `MAP_1` e o vale de cinzas que o jogo abre. Nao tem prop
 *   - `COM_PROPS` e o mesmo mapa com `createProps(MAP_1_SEED, true)`, que
 *     e o mecanismo de posicionamento rodando
 *
 * Os testes de sorteio usam o `COM_PROPS`, para o `placeProps` continuar
 * coberto mesmo com a flag desligada. E o bloco do fim trava que o mapa
 * de verdade segue vazio, para ninguem religar a flag sem perceber
 *
 * Os `solids` vem do `buildPropSolids` exportado pelo mapa, e nao de
 * uma conta escrita aqui: o teste precisa colidir com o MESMO obstaculo
 * que o jogo monta
 */
const POSICIONADAS = createProps(MAP_1_SEED, true);

const COM_PROPS = {
  ...MAP_1,
  ...POSICIONADAS,
  solids: buildPropSolids(POSICIONADAS.blocking),
};

const VIEW = {
  x: 1600,
  y: 1000,
  width: 1280,
  height: 720,
};

function createRenderer() {
  const renderer = new PropRenderer();

  renderer.image = {
    width: 128,
    height: 160,
    complete: true,
  };

  return renderer;
}

function countingContext() {
  const calls = { drawImage: 0, fill: 0 };

  return {
    calls,

    drawImage() {
      calls.drawImage += 1;
    },

    beginPath() {},
    ellipse() {},
    fill() {
      calls.fill += 1;
    },
    save() {},
    restore() {},
  };
}

describe("prop catalog", () => {
  it("has trees, rocks and bushes", () => {
    expect(PROP_ORDER).toContain("arvore");
    expect(PROP_ORDER).toContain("treeSmall");
    expect(PROP_ORDER).toContain("treeMedium");
    expect(PROP_ORDER).toContain("treeLarge");
    expect(PROP_ORDER).toContain("rock");
    expect(PROP_ORDER).toContain("bush");
  });

  it("dá uma linha distinta por tipo, DENTRO da folha de cada um", () => {
    /**
     * A linha so precisa ser unica DENTRO da folha.
     *
     * A arvore usa a linha 0, e a `treeSmall` tambem, porque estao em
     * arquivos diferentes: `arvore.png` e `props.png`. Exigir linhas
     * unicas no catalogo inteiro obrigaria a arvore a ocupar uma linha
     * da folha antiga que ela nao usa
     */
    const porFolha = new Map();

    for (const id of PROP_ORDER) {
      const type = PROP_TYPES[id];

      const folha = type.sheet ?? PROP_SHEET;

      if (!porFolha.has(folha)) porFolha.set(folha, []);

      porFolha.get(folha).push([id, type.row]);
    }

    for (const [folha, tipos] of porFolha) {
      const linhas = tipos.map(([, row]) => row);

      expect(
        new Set(linhas).size,
        `${tipos.map(([id]) => id).join(",")} na mesma folha`,
      ).toBe(tipos.length);
    }
  });

  it("da um raio positivo e uma cor para todo tipo", () => {
    for (const id of PROP_ORDER) {
      expect(PROP_TYPES[id].radius).toBeGreaterThan(0);
      expect(PROP_TYPES[id].tint.length).toBeGreaterThan(0);
    }
  });

  it("splits blocking and decorative props", () => {
    expect(BLOCKING_PROP_IDS.length).toBeGreaterThan(0);
    expect(DECORATIVE_PROP_IDS.length).toBeGreaterThan(0);

    for (const id of BLOCKING_PROP_IDS) {
      expect(isBlockingProp(id)).toBe(true);
    }

    for (const id of DECORATIVE_PROP_IDS) {
      expect(isBlockingProp(id)).toBe(false);
    }
  });

  it("keeps trees collider smaller than the canopy", () => {
    for (const id of BLOCKING_PROP_IDS) {
      const type = getPropType(id);

      expect(type.collider).toBeLessThan(type.radius);
      expect(type.collider).toBeGreaterThan(0);
    }
  });

  it("gives decorative props no collider", () => {
    for (const id of DECORATIVE_PROP_IDS) {
      expect(getPropType(id).collider).toBe(0);
    }
  });

  it("returns null for unknown props", () => {
    expect(getPropType("castle")).toBe(null);
    expect(isBlockingProp("castle")).toBe(false);
  });
});

describe("map props", () => {
  it("replaces the old rectangle obstacles", () => {
    expect(COM_PROPS.props.length).toBeGreaterThan(100);
    expect(MAP_1.walls).toBeUndefined();
    expect(MAP_1.obstacles).toBeUndefined();
  });

  it("gives every prop a unique id and valid type", () => {
    const ids = new Set();

    for (const prop of COM_PROPS.props) {
      expect(ids.has(prop.id)).toBe(false);
      ids.add(prop.id);

      expect(getPropType(prop.type)).not.toBe(null);
      expect(prop.variant).toBeGreaterThanOrEqual(0);
      expect(prop.variant).toBeLessThan(PROP_VARIANTS);
    }
  });

  it("keeps every prop inside the map bounds", () => {
    for (const prop of COM_PROPS.props) {
      expect(prop.x).toBeGreaterThan(MAP_1_BOUNDS.x);
      expect(prop.y).toBeGreaterThan(MAP_1_BOUNDS.y);
      expect(prop.x).toBeLessThan(
        MAP_1_BOUNDS.x + MAP_1_BOUNDS.width,
      );
      expect(prop.y).toBeLessThan(
        MAP_1_BOUNDS.y + MAP_1_BOUNDS.height,
      );
    }
  });

  it("leaves the player spawn clear", () => {
    for (const prop of COM_PROPS.blocking) {
      expect(
        Math.hypot(
          prop.x - MAP_1_SPAWN.x,
          prop.y - MAP_1_SPAWN.y,
        ),
      ).toBeGreaterThan(prop.radius + 300);
    }
  });

  it("keeps blocking props out of the creature zones", () => {
    for (const prop of COM_PROPS.blocking) {
      for (const zone of MAP_1_META.zones) {
        const inside =
          prop.x > zone.x - 46 &&
          prop.x < zone.x + zone.width + 46 &&
          prop.y > zone.y - 46 &&
          prop.y < zone.y + zone.height + 46;

        expect(inside, `${prop.id} dentro de ${zone.id}`).toBe(
          false,
        );
      }
    }
  });

  it("o vale nao tem decorativo, por escolha", () => {
    /**
     * Este teste falava de arbustos decorando as zonas, e nao ha mais
     * nenhum: `QUANTIDADE_DECORATIVA` e zero
     *
     * Os arbustos sao pixel art de 32px, e o vale ficou com uma unica
     * prop ilustrada. Encher o cenario de dois estilos e o que estava
     * feio antes. Se quiser os arbustos de volta, e acrescentar
     * `{ type: "bush" }` no `DECORATIVE_PLAN` e subir o numero
     */
    expect(COM_PROPS.decorative).toEqual([]);

    for (const prop of COM_PROPS.props) {
      expect(isBlockingProp(prop.type), prop.id).toBe(true);
    }
  });

  it("separates blocking props from each other", () => {
    const placed = COM_PROPS.blocking;

    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i];
        const b = placed[j];

        const gap = a.radius + b.radius + 34;

        expect(
          Math.hypot(a.x - b.x, a.y - b.y) >= gap,
          `${a.id} sobrepoe ${b.id}`,
        ).toBe(true);
      }
    }
  });

  it("keeps decoration off blocking props", () => {
    for (const deco of COM_PROPS.decorative) {
      for (const solid of COM_PROPS.blocking) {
        const gap = deco.radius + solid.radius + 34;

        expect(
          Math.hypot(
            deco.x - solid.x,
            deco.y - solid.y,
          ) >= gap,
          `${deco.id} sobrepoe ${solid.id}`,
        ).toBe(true);
      }
    }
  });

  it("is deterministic for the same seed", () => {
    const first = JSON.stringify(
      COM_PROPS.props.map((p) => [p.type, p.x, p.y]),
    );

    const second = JSON.stringify(
      COM_PROPS.props.map((p) => [p.type, p.x, p.y]),
    );

    expect(first).toBe(second);
  });
});

describe("o vale tem arvore", () => {
  /**
   * Este bloco era o inverso: ele travava que o mapa NAO tinha prop,
   * depois que as props antigas foram retiradas. Agora o vale tem
   * arvore de novo, e ele trava a forma dessa volta
   */
  it("a flag do mapa esta ligada", () => {
    expect(MAP_1_PROPS_LIGADAS).toBe(true);
  });

  it("o vale tem arvore espalhada", () => {
    expect(MAP_1.props.length).toBeGreaterThan(100);
    expect(MAP_1.blocking.length).toBe(
      MAP_1.props.length,
    );
  });

  it("sao todas do tipo novo", () => {
    /**
     * A arvore e a unica prop posicionada. Os tipos antigos continuam no
     * catalogo, mas misturar pixel art de 32px com a arvore pintada no
     * mesmo cenario fica com duas estilas
     */
    const tipos = new Set(MAP_1.props.map((p) => p.type));

    expect([...tipos]).toEqual(["arvore"]);
  });

  it("cada arvore barra o tronco", () => {
    expect(MAP_1.solids.length).toBe(
      MAP_1.blocking.length,
    );

    // o tronco, e nao a copa
    for (const solid of MAP_1.solids) {
      expect(solid.width).toBe(22);
      expect(solid.height).toBe(22);
    }
  });

  it("o tronco barra e a copa deixa passar", () => {
    const collision = new CollisionSystem(MAP_1);
    const arvore = MAP_1.blocking[0];

    // no tronco e solido
    expect(
      collision.isPositionFree({ x: arvore.x, y: arvore.y }, 10),
    ).toBe(false);

    /**
     * E na borda da copa o jogador passa.
     *
     * A copa tem 96px e o tronco 22. Se a arvore barra pela copa, o
     * jogador para a um metro da arvore, do lado de dentro da sombra,
     * sem ver o que barra
     */
    const naCopa = arvore.radius + 30;

    expect(
      collision.isPositionFree(
        { x: arvore.x + naCopa, y: arvore.y },
        22,
      ),
    ).toBe(true);
  });

  it("nenhuma arvore nasce dentro de zona de criatura", () => {
    /**
     * As 12 zonas ocupam 73% da area util, e e por isso que o pedido
     * de 180 rende 137. E o que segura e o `insideAnyZone`, que impede
     * a arvore de nascer em cima de onde o jogo acontece
     */
    for (const prop of MAP_1.blocking) {
      for (const zone of MAP_1_META.zones) {
        const dentro =
          prop.x > zone.x - 46 &&
          prop.x < zone.x + zone.width + 46 &&
          prop.y > zone.y - 46 &&
          prop.y < zone.y + zone.height + 46;

        expect(dentro, `${prop.id} dentro de ${zone.id}`).toBe(
          false,
        );
      }
    }
  });

  it("as arvores se apartam o bastante para virar bosque", () => {
    // 46 + 46 + 34: com a copa de 96px sobra uma folga de 30px
    const minima = 126;

    for (let i = 0; i < MAP_1.blocking.length; i += 1) {
      for (let j = i + 1; j < MAP_1.blocking.length; j += 1) {
        const a = MAP_1.blocking[i];
        const b = MAP_1.blocking[j];

        expect(
          Math.hypot(a.x - b.x, a.y - b.y),
          `${a.id} em cima de ${b.id}`,
        ).toBeGreaterThanOrEqual(minima);
      }
    }
  });

  it("o vale ainda barra a borda do mundo", () => {
    /**
     * Ter prop de volta nao pode ter quebrado o limite: e o `bounds` que
     * segura o jogador longe da beira do mapa
     */
    const collision = new CollisionSystem(MAP_1);

    expect(
      collision.isPositionFree({ x: 5, y: 2100 }, 22),
    ).toBe(false);

    expect(
      collision.isPositionFree({ x: 3000, y: 5 }, 22),
    ).toBe(false);
  });

  it("createProps ainda sabe desligar", () => {
    /**
     * A flag desliga o MAPA, nao o mecanismo. Este e o caminho de
     * volta, e ele precisa continuar funcionando
     */
    expect(createProps(MAP_1_SEED, false)).toEqual({
      props: [],
      blocking: [],
      decorative: [],
    });
  });
});

describe("a arte da arvore", () => {
  it("vem de uma folha propria, e nao da props.png", () => {
    const arvore = getPropType("arvore");

    expect(arvore.sheet).toBeTruthy();
    expect(arvore.sheet).not.toBe(PROP_SHEET);
    expect(arvore.sheet).toContain("arvore.png");
  });

  it("a celula e do tamanho do arquivo, e o desenho tambem", () => {
    const arvore = getPropType("arvore");

    // a arte ja foi reduzida para o tamanho do jogo, entao os dois
    // coincidem. Nos tipos antigos eles divergem, porque a celula de
    // 32px e esticada na hora de desenhar
    expect(arvore.frameWidth).toBe(96);
    expect(arvore.frameHeight).toBe(119);
    expect(arvore.drawWidth).toBe(96);
    expect(arvore.drawHeight).toBe(119);
  });

  it("tem uma variante so", () => {
    /**
     * A arte e uma arvore unica. Se o sorteio pegasse um indice de 0 a
     * 3, tres de cada quatro arvores buscariam fora do arquivo e
     * sumiriam
     */
    expect(getPropType("arvore").variants).toBe(1);
    expect(propVariantCount(getPropType("arvore"))).toBe(1);

    // e o sorteio realmente so usa o indice 0
    const variantes = new Set(
      MAP_1.props.map((prop) => prop.variant),
    );

    expect([...variantes]).toEqual([0]);
  });

  it("os tipos antigos seguem com quatro variantes", () => {
    for (const id of ["treeSmall", "rock", "bush"]) {
      expect(propVariantCount(getPropType(id)), id).toBe(4);
    }
  });

  it("o collider e o tronco medido, nao a copa", () => {
    const arvore = getPropType("arvore");

    // o tronco tem 22px de largura na arte reduzida
    expect(arvore.collider).toBe(11);
    expect(arvore.collider * 2).toBe(22);

    // e e bem menor que a copa, como em toda arvore
    expect(arvore.collider).toBeLessThan(arvore.radius);
  });

  it("a base da arte fica no pe do tronco", () => {
    /**
     * Com o 0.78 dos tipos antigos, o tronco terminaria 26px acima do
     * ponto de colisao e a arvore pareceria flutuar
     */
    expect(getPropType("arvore").base).toBe(1);
  });

  it("o minimapa sabe que e arvore", () => {
    /**
     * A cor do minimapa vinha de `tipo.startsWith("tree")`, que nao
     * encontra "arvore": ela sairia com a cor da pedra
     */
    expect(getPropType("arvore").isTree).toBe(true);

    for (const prop of MAP_1.props) {
      expect(prop.isTree, prop.id).toBe(true);
    }
  });

  it("o arquivo existe com o tamanho que o catalogo declara", () => {
    const arvore = getPropType("arvore");

    const png = inflatePng(
      readFileSync(
        fileURLToPath(new URL(arvore.sheet)),
      ),
    );

    expect(png.width).toBe(arvore.frameWidth);
    expect(png.height).toBe(arvore.frameHeight);
  });

  it("a arte encolhe para caber em uma tela", () => {
    /**
     * A arte de origem e um `tree.png` de 1600x1600, com 1,6MB. Draw a
     * 96px ela cabe em uma viewport de 1280x720; draw a 1600px ela
     * cobriria a tela inteira
     */
    const arvore = getPropType("arvore");

    expect(arvore.drawWidth).toBeLessThan(1280);
    expect(arvore.drawHeight).toBeLessThan(720);
  });
});

describe("prop collision", () => {
  it("registers only blocking props as solids", () => {
    const collision = new CollisionSystem(COM_PROPS);

    expect(collision.solids).toHaveLength(
      COM_PROPS.blocking.length,
    );
  });

  it("builds one collider per blocking prop", () => {
    expect(COM_PROPS.solids).toHaveLength(
      COM_PROPS.blocking.length,
    );

    for (const solid of COM_PROPS.solids) {
      expect(solid.width).toBeGreaterThan(0);
      expect(solid.height).toBe(solid.width);
    }
  });

  it("blocks movement into a tree trunk", () => {
    const collision = new CollisionSystem(COM_PROPS);
    const tree = COM_PROPS.blocking[0];

    expect(tree).toBeDefined();

    expect(
      collision.isPositionFree(
        { x: tree.x, y: tree.y },
        10,
      ),
    ).toBe(false);
  });

  it("allows standing next to a tree", () => {
    const collision = new CollisionSystem(COM_PROPS);
    const tree = COM_PROPS.blocking[0];

    const outside = tree.colliderRadius + 40;

    expect(
      collision.isPositionFree(
        { x: tree.x + outside, y: tree.y },
        10,
      ),
    ).toBe(true);
  });

  it("ignores decorative props entirely", () => {
    const collision = new CollisionSystem(COM_PROPS);

    for (const prop of COM_PROPS.decorative) {
      expect(
        collision.isPositionFree(
          { x: prop.x, y: prop.y },
          5,
        ),
      ).toBe(true);
    }
  });

  it("still supports legacy walls and obstacles", () => {
    const legacy = {
      width: 1000,
      height: 1000,
      bounds: { x: 0, y: 0, width: 1000, height: 1000 },
      walls: [
        { x: 100, y: 100, width: 40, height: 40 },
      ],
      obstacles: [
        { x: 300, y: 300, width: 40, height: 40 },
      ],
    };

    const collision = new CollisionSystem(legacy);

    expect(collision.solids).toHaveLength(2);
  });
});

describe("prop rendering", () => {
  it("is not ready without an image", () => {
    expect(new PropRenderer().isReady()).toBe(false);
  });

  it("is ready once the sheet loads", () => {
    expect(createRenderer().isReady()).toBe(true);
  });

  it("culls props outside the viewport", () => {
    const renderer = createRenderer();

    const props = [
      { x: 2000, y: 1300, type: "treeMedium", radius: 26, variant: 0 },
      { x: 3900, y: 300, type: "bush", radius: 12, variant: 1 },
    ];

    const visible = renderer.collectVisible(props, VIEW);

    expect(visible).toHaveLength(1);
    expect(visible[0].x).toBe(2000);
  });

  it("draws one sprite and one shadow per visible prop", () => {
    const renderer = createRenderer();
    const context = countingContext();

    renderer.draw(
      context,
      [
        {
          x: 2000,
          y: 1300,
          type: "treeLarge",
          radius: 34,
          variant: 2,
        },
      ],
      VIEW,
    );

    expect(context.calls.drawImage).toBe(1);
    expect(context.calls.fill).toBe(1);
  });

  it("scales the sprite with the prop radius", () => {
    const renderer = createRenderer();

    const sizes = [];

    const context = {
      ...countingContext(),
      drawImage(_img, _sx, _sy, _sw, _sh, _dx, _dy, dw, dh) {
        sizes.push([dw, dh]);
      },
    };

    renderer.drawProp(context, {
      x: 0,
      y: 0,
      type: "treeSmall",
      radius: 20,
      variant: 0,
    });

    renderer.drawProp(context, {
      x: 0,
      y: 0,
      type: "treeLarge",
      radius: 34,
      variant: 0,
    });

    expect(sizes[0][0]).toBeLessThan(sizes[1][0]);
    expect(sizes[0][1]).toBe(sizes[0][0]);
  });

  it("ignores unknown prop types", () => {
    const renderer = createRenderer();
    const context = countingContext();

    expect(() =>
      renderer.drawProp(context, {
        x: 0,
        y: 0,
        type: "castle",
        radius: 20,
        variant: 0,
      }),
    ).not.toThrow();

    expect(context.calls.drawImage).toBe(0);
  });
});
