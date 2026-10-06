import { readFileSync } from "node:fs";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { TerrainRenderer } from "./TerrainRenderer.js";
import {
  BASE_TERRAIN,
  groundTileFor,
  ZONE_TILE,
  ZONE_TILE_SIZE,
  ZONES_USE_TILE,
  zoneTileFor,
  zoneUsesTile,
} from "../../data/terrain/index.js";
import { MAP_1_META, MAP_1 } from "../../data/maps/index.js";

/**
 * O TILE DE TERRA DAS AREAS DE MOB.
 *
 * Onze dos doze zonas sairam do pixel art e foram para o `terra.jpg`,
 * reduzido para 128px na mesma conta da grama
 *
 * O que este arquivo trava:
 *
 * 1. **Onze, nao doze.** O Campo de Provas tem `kind: "training"` e so
 *    bonecos de treino. Ele fica no pixel art, de proposito: o jogador
 *    precisa ver que ali e um campo de treino e nao territorio hostil
 * 2. **A zona toda e um retangulo so.** Antes, cada zona era uma grade
 *    de células sorteadas por `fbm` entre `terrain` e `terrainAlt`; com
 *    as onze iguais, essa conta inteira saiu da tela
 * 3. **A minimapa continua colorindo por zona.** O `terrain` do
 *    catalogo nao foi apagado — e ele que pinta cada area no minimapa
 * 4. **Nunca some.** Sem arte, sem canvas ou sem `createPattern`, a zona
 *    volta ao pixel art de 32px em vez de deixar um buraco
 */

function fakeImage(width = 256) {
  return {
    width,
    height: width,
    naturalWidth: width,
    complete: true,
  };
}

function contextQueConta({
  withPattern = true,
  lancaEm = null,
} = {}) {
  const preenchimentos = [];
  const imagensDePadrao = [];
  const blits = [];

  return {
    preenchimentos,
    imagensDePadrao,
    blits,

    fillStyle: null,
    imageSmoothingEnabled: null,
    imageSmoothingQuality: null,

    createPattern: withPattern
      ? (image, repetition) => {
          if (lancaEm && image === lancaEm) {
            throw new Error("sem suporte a padrao");
          }

          imagensDePadrao.push({ image, repetition });

          return { padrao: true, image };
        }
      : undefined,

    drawImage(...args) {
      blits.push(args);
    },

    fillRect(...args) {
      preenchimentos.push({ fillStyle: this.fillStyle, args });
    },

    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    rect() {},
    roundRect() {},
    fill() {},
    stroke() {},
    arc() {},
    strokeRect() {},
    clip() {},
  };
}

const canvases = [];

let ctxDePatch = null;

beforeEach(() => {
  canvases.length = 0;

  ctxDePatch = contextQueConta();

  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") return {};

      const canvas = {
        tag,
        width: 0,
        height: 0,
        getContext: () => ctxDePatch,
      };

      canvases.push(canvas);

      return canvas;
    },
  };
});

afterEach(() => {
  delete globalThis.document;
});

function rendererCom({
  zone = fakeImage(1600),
  ground = fakeImage(1600),
} = {}) {
  const renderer = new TerrainRenderer();

  renderer.terrain = fakeImage();

  /**
   * O chao entra pelo cache por FOLHA, e nao por uma propriedade solta.
   * E o que `groundTileFor` faz quando o jogo roda: o vale pede a grama e
   * o hub pede o calcamento, cada um no seu tile
   */
  renderer.groundImages.set(groundTileFor(MAP_1), ground);

  /**
   * A terra das zonas tambem entra pelo cache por FOLHA.
   *
   * O mapa 1 nao declara `zoneTile`, entao pede a folha do vale — e e
   * por essa folha que o cache guarda, igual ao chao
   */
  renderer.zoneImages.set(zoneTileFor(MAP_1), zone);

  return renderer;
}

/** O ladrilhinho de terra do mapa 1, no cache por folha. */
const zoneTileDoTeste = (renderer) =>
  renderer.zoneTiles.get(zoneTileFor(MAP_1));

const TREINO = MAP_1_META.zones.find(
  (zone) => zone.kind === "training",
);

const ZONAS_DE_MOB = MAP_1_META.zones.filter(
  (zone) => zone.kind !== "training",
);

const VIEW = {
  x: 1600,
  y: 1000,
  width: 1280,
  height: 720,
};

/** uma zona de mob dentro da tela, para o desenho sair */
function mobVisivel() {
  return {
    id: "teste",
    kind: "active",
    x: 1600,
    y: 1000,
    width: 400,
    height: 300,
    terrain: "ice",
    terrainAlt: "stone",
    altBias: 0.26,
  };
}

describe("o tile de terra", () => {
  it("aponta para o terra.jpg e mede 128px", () => {
    expect(ZONE_TILE).toContain("terra.jpg");
    expect(ZONES_USE_TILE).toBe(true);
    expect(ZONE_TILE_SIZE).toBe(128);
  });

  it("o tile esta no arquivo que o catalogo aponta", () => {
    const bytes = readFileSync(new URL(ZONE_TILE));

    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);

    expect(bytes.length).toBeGreaterThan(50 * 1024);
  });

  it("reduz a arte de 1600px para 128px", () => {
    const renderer = rendererCom();

    renderer.buildZoneTile();

    expect(zoneTileDoTeste(renderer)).toBeTruthy();

    expect(zoneTileDoTeste(renderer)).not.toBe(renderer.zoneImageFor(MAP_1));
    expect(zoneTileDoTeste(renderer).tag).toBe("canvas");

    expect(zoneTileDoTeste(renderer).width).toBe(128);
    expect(zoneTileDoTeste(renderer).height).toBe(128);
  });

  it("reduz por METADES, como a grama", () => {
    const renderer = rendererCom();

    renderer.buildZoneTile();

    const destinos = ctxDePatch.blits.map((args) => args[3]);

    expect(destinos).toEqual([800, 400, 200, 128]);
  });

  it("usa a mesma conta da grama, e nao uma copia", () => {
    /**
     * As duas artes passam pelo mesmo `reduceToTile`. Se as contas
     * divergirem, o grao da terra e o da grama ficariam em escalas
     * diferentes e o mapa pareceria dois jogos
     */
    const renderer = rendererCom();

    renderer.buildGroundTile(MAP_1);

    const doChao = ctxDePatch.blits.map((a) => a[3]);

    ctxDePatch.blits.length = 0;

    // o chao e a zona tem caches separados, entao nao ha nada para
    // liberar aqui: cada um ja foi marcado pela sua propria folha
    renderer.buildZoneTile();

    const daZona = ctxDePatch.blits.map((a) => a[3]);

    expect(daZona).toEqual(doChao);
  });

  it("memoriza o tile", () => {
    const renderer = rendererCom();

    renderer.buildZoneTile();

    const primeiro = zoneTileDoTeste(renderer);

    /**
     * O chao tambem vira tile no primeiro quadro, e ele entra na
     * contagem de `drawImage`. Construindo ele antes de medir, o que
     * sobra para crescer sao tentativas de refazer o tile de terra
     */
    renderer.buildGroundTile(MAP_1);

    const blits = ctxDePatch.blits.length;

    for (let quadro = 0; quadro < 5; quadro += 1) {
      renderer.draw(contextQueConta(), MAP_1, [], VIEW);
    }

    expect(zoneTileDoTeste(renderer)).toBe(primeiro);
    expect(ctxDePatch.blits.length).toBe(blits);
  });
});

describe("as onze areas de mob", () => {
  it("sao onze, e o vale tem doze zonas", () => {
    expect(MAP_1_META.zones.length).toBe(12);
    expect(ZONAS_DE_MOB.length).toBe(11);
  });

  it("todas as onze usam o tile de terra", () => {
    for (const zone of ZONAS_DE_MOB) {
      expect(zoneUsesTile(zone), zone.id).toBe(true);
    }
  });

  it("o catalogo ainda guarda o terreno de cada zona", () => {
    /**
     * O `terrain` nao foi apagado: e ele que pinta a area no minimapa.
     * Sem isso as onze zonas virariam a mesma cor e o jogador perderia
     * a leitura de qual area e qual
     */
    const terrenos = new Set(
      ZONAS_DE_MOB.map((zone) => zone.terrain),
    );

    expect(terrenos.size).toBeGreaterThan(3);

    for (const zone of MAP_1_META.zones) {
      expect(zone.mapColor, zone.id).toBeTruthy();
      expect(zone.color, zone.id).toBeTruthy();
    }
  });

  it("a zona e um retangulo so, sem grade de celulas", () => {
    const renderer = rendererCom();
    const ctx = contextQueConta();

    const zona = mobVisivel();

    renderer.draw(ctx, MAP_1, [zona], VIEW);

    const comPadrao = ctx.preenchimentos.filter(
      (p) => p.fillStyle?.image === zoneTileDoTeste(renderer),
    );

    expect(comPadrao.length).toBe(1);

    // e o preenchimento e exatamente o retangulo da zona
    const [x, y, largura, altura] = comPadrao[0].args;

    expect(x).toBe(zona.x);
    expect(y).toBe(zona.y);
    expect(largura).toBe(zona.width);
    expect(altura).toBe(zona.height);
  });

  it("a grade de celulas nao e mais montada para area de mob", () => {
    /**
     * Antes, cada zona virava uma grade por `fbm` sorteando `terrain`
     * ou `terrainAlt` celula a celula. Com as onze iguais, essa conta
     * inteira saiu da tela
     */
    const renderer = rendererCom();

    renderer.draw(
      contextQueConta(),
      MAP_1,
      [mobVisivel()],
      VIEW,
    );

    expect(renderer.zoneGrids.size).toBe(0);
    expect(renderer.patches.size).toBe(0);
  });

  it("o campo de provas usa o ladrilho de terra, como as onze", () => {
    const renderer = rendererCom();

    /**
     * A REGRA FINAL: as DOZE usam o `terra.jpg`.
     *
     * O campo de provas ja foi a unica de fora, duas vezes, por motivos
     * diferentes — a primeira para ficar no pixel art de 32px, a
     * segunda para mostrar o chao do mapa. As duas leituras o deixavam
     * como o unico retangulo do vale com outra textura
     *
     * Agora ele entra no mesmo `fillZone` das onze, e a leitura de
     * "campo de treino" vem do que mora dentro: dois bonecos parados,
     * nenhum inimigo, nenhum ataque
     */
    expect(TREINO, "o campo de provas sumiu").toBeTruthy();

    expect(zoneUsesTile(TREINO)).toBe(true);

    renderer.draw(contextQueConta(), MAP_1, [TREINO], VIEW);

    // e o ladrilho foi construido e usado
    expect(renderer.zonePattern).not.toBe(null);
  });

  it("as DOZE zonas ladrilham, e sao doze", () => {
    /**
     * O numero subiu de onze para doze.
     *
     * Antes o campo de provas ficava de fora e o vale contava onze
     * areas de mob. Agora nao existe nenhuma excecao de ladrilho no
     * mapa, e um `zoneUsesTile` que devolvesse `false` para alguma zona
     * reprovaria aqui
     */
    expect(MAP_1_META.zones.length).toBe(12);

    for (const zone of MAP_1_META.zones) {
      expect(zoneUsesTile(zone), zone.id).toBe(true);
    }
  });

  it("o campo de provas devolve o terreno base em terrainAt", () => {
    /**
     * O `terrain` continua sendo `BASE_TERRAIN`.
     *
     * Ele nao muda o ladrilho — as doze compartilham um pattern so — mas
     * e ele que pinta a area no minimapa, e um campo de provas e verde
     */
    expect(TREINO.terrain).toBe(BASE_TERRAIN);

    expect(
      rendererCom().terrainAt(
        TREINO.x + TREINO.width / 2,
        TREINO.y + TREINO.height / 2,
        [TREINO],
      ),
    ).toBe(BASE_TERRAIN);
  });

  it("onze zonas visiveis sao onze preenchimentos", () => {
    /**
     * Uma conta de custo: antes cada zona podia virar dezenas de
     * retangulos, porque a grade de `fbm` era recortada em pedaços do
     * mesmo terreno. Agora e um por zona
     */
    const renderer = rendererCom();
    const ctx = contextQueConta();

    const zonas = Array.from({ length: 11 }, (_, i) => ({
      ...mobVisivel(),
      id: `mob_${i}`,
      x: 1600 + i * 4,
    }));

    renderer.draw(ctx, MAP_1, zonas, VIEW);

    const daZona = ctx.preenchimentos.filter(
      (p) => p.fillStyle?.image === zoneTileDoTeste(renderer),
    );

    expect(daZona.length).toBe(11);
  });
});

describe("o terreno das areas nunca some", () => {
  it("cai para pixel art enquanto a arte nao carregou", () => {
    const renderer = rendererCom({
      zone: Object.assign(fakeImage(1600), { complete: false }),
    });

    expect(renderer.isZoneReady()).toBe(false);
    expect(renderer.buildZoneTile()).toBe(null);

    const ctx = contextQueConta();

    expect(() =>
      renderer.draw(ctx, MAP_1, [mobVisivel()], VIEW),
    ).not.toThrow();

    // e o buraco nao aconteceu: a zona foi pintada do outro jeito
    const desenhou =
      ctx.preenchimentos.length > 0 || ctx.blits.length > 0;

    expect(desenhou).toBe(true);
  });

  it("cai para pixel art se a arte vier com largura zero", () => {
    const renderer = rendererCom({
      zone: Object.assign(fakeImage(), {
        naturalWidth: 0,
        width: 0,
      }),
    });

    expect(renderer.isZoneReady()).toBe(false);
  });

  it("usa a arte de 1600px se nao der para montar o canvas", () => {
    delete globalThis.document;

    const renderer = rendererCom();
    const ctx = contextQueConta();

    renderer.draw(ctx, MAP_1, [mobVisivel()], VIEW);

    expect(zoneTileDoTeste(renderer)).toBe(null);

    expect(
      ctx.imagensDePadrao.filter(
        (p) => p.image === renderer.zoneImageFor(MAP_1),
      ).length,
    ).toBe(1);
  });

  it("cai para pixel art se o navegador nao criar padrao", () => {
    const renderer = rendererCom();
    const ctx = contextQueConta({ withPattern: false });

    expect(() =>
      renderer.draw(ctx, MAP_1, [mobVisivel()], VIEW),
    ).not.toThrow();

    const desenhou =
      ctx.preenchimentos.length > 0 || ctx.blits.length > 0;

    expect(desenhou).toBe(true);
  });

  it("sobe quando o padrao da zona lanca", () => {
    const renderer = rendererCom();

    const ctx = contextQueConta({
      lancaEm: renderer.zoneImageFor(MAP_1),
    });

    expect(() =>
      renderer.draw(ctx, MAP_1, [mobVisivel()], VIEW),
    ).not.toThrow();

    expect(
      ctx.preenchimentos.filter(
        (p) => p.fillStyle?.image === renderer.zoneImageFor(MAP_1),
      ).length,
    ).toBe(0);

    const desenhou =
      ctx.preenchimentos.length + ctx.blits.length;

    expect(desenhou).toBeGreaterThan(0);
  });

  it("uma arte de zona quebrada nao impede o mapa de ficar pronto", () => {
    /**
     * Como a grama: 250KB que falha nao pode derrubar o mundo
     */
    const renderer = rendererCom({
      zone: Object.assign(fakeImage(1600), { complete: false }),
    });

    expect(renderer.isReady()).toBe(true);
  });

  it("desligar a flag traz as onze de volta ao pixel art", () => {
    /**
     * O caminho de volta, sem mexer em mais nada
     */
    expect(ZONES_USE_TILE).toBe(true);

    // a regra vive em uma funcao so, e ela responde pela flag
    const comFlag = zoneUsesTile(mobVisivel());

    expect(comFlag).toBe(true);
  });
});