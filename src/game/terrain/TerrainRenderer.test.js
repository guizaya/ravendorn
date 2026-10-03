import { describe, expect, it } from "vitest";
import * as terrainData from "../../data/terrain/index.js";
import { TerrainRenderer } from "./TerrainRenderer.js";
import {
  BASE_TERRAIN,
  minimapColorFor,
  TERRAIN_ROW,
  TERRAIN_SHEETS,
  TERRAIN_TYPES,
  TILE_SIZE,
  TILE_VARIANTS,
} from "../../data/terrain/index.js";
import { MAP_1_META, MAP_1 } from "../../data/maps/index.js";

/**
 * `getTransition` e `TRANSITION_LIST` nao existem mais: as faixas de
 * mistura saíram do mapa. Eles sao lidos do namespace do modulo para o
 * teste poder afirmar a AUSENCIA, sem importar um nome que nao existe
 */
const getTransition = terrainData.getTransition;
const TRANSITION_LIST = terrainData.TRANSITION_LIST;

function fakeImage(width = 256) {
  return { width, height: width, complete: true };
}

function countingContext({ withPattern = true } = {}) {
  const calls = { drawImage: 0, fillRect: 0 };

  return {
    calls,

    drawImage() {
      calls.drawImage += 1;
    },

    fillRect() {
      calls.fillRect += 1;
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

    createPattern: withPattern
      ? () => ({ pattern: true })
      : undefined,
  };
}

function installDocumentStub() {
  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") return {};

      return {
        width: 0,
        height: 0,
        getContext: () => countingContext(),
      };
    },
  };
}

function removeDocumentStub() {
  delete globalThis.document;
}

function createRenderer() {
  const renderer = new TerrainRenderer();

  renderer.terrain = fakeImage();

  /**
   * O chaoladrilhado e o `grama.jpg`.
   *
   * Sem esta linha, `this.ground` fica `null` em Node — nao existe
   * `Image` — e TODOS os testes deste arquivo passariam a medir a
   * queda para o pixel art, sem nunca tocar no caminho novo
   */
  renderer.ground = fakeImage(1600);

  return renderer;
}

const VIEW = {
  x: 1600,
  y: 1000,
  width: 1280,
  height: 720,
};

describe("terrain manifest", () => {
  it("uses 32px tiles with 4 variants", () => {
    expect(TILE_SIZE).toBe(32);
    expect(TILE_VARIANTS).toBe(4);
  });

  it("maps every type to a distinct row", () => {
    const rows = TERRAIN_TYPES.map(
      (id) => TERRAIN_ROW[id],
    );

    expect(rows).toHaveLength(TERRAIN_TYPES.length);
    expect(new Set(rows).size).toBe(rows.length);
  });

  it("nao tem mais folha de transicao", () => {
    /**
     * As faixas de mistura sairam do mapa: o chao virou o
     * `grama.jpg`, pintado, e a faixa era pixel art de 32px. Este teste
     * trava que a folha nao volta a ser exigida — nem pelo catalogo,
     * nem pelo `isReady`, que antes dependia dela para desenhar o mundo
     */
    expect(TERRAIN_SHEETS.transitions).toBeUndefined();

    const renderer = createRenderer();

    // pronta so com a folha de terreno
    expect(renderer.isReady()).toBe(true);

    // e ninguem carrega mais a imagem
    expect(renderer.transitions).toBeUndefined();
  });

  it("nao resta nenhum par de transicao no catalogo", () => {
    /**
     * `getTransition` e `TRANSITION_LIST` sairam junto com a folha
     */
    expect(getTransition).toBeUndefined();
    expect(TRANSITION_LIST).toBeUndefined();
  });

  it("da um terreno a cada zona", () => {
    for (const zone of MAP_1_META.zones) {
      expect(
        TERRAIN_TYPES.includes(zone.terrain),
        zone.id,
      ).toBe(true);
    }
  });

  it("uses more than one terrain across zones", () => {
    const used = new Set(
      MAP_1_META.zones.map((zone) => zone.terrain),
    );

    expect(used.size).toBeGreaterThanOrEqual(4);
  });

  it("gives every terrain a distinct minimap color", () => {
    const colors = TERRAIN_TYPES.map((id) =>
      minimapColorFor(id),
    );

    expect(new Set(colors).size).toBe(
      TERRAIN_TYPES.length,
    );
  });
});

describe("terrain rendering cost", () => {
  it("fills the base with a single pattern op", () => {
    installDocumentStub();

    const renderer = createRenderer();
    const context = countingContext();

    renderer.draw(context, MAP_1, [], VIEW);

    expect(context.calls.fillRect).toBe(1);

    removeDocumentStub();
  });

  it("blits a small grid when patterns are unavailable", () => {
    installDocumentStub();

    const renderer = createRenderer();
    const context = countingContext({
      withPattern: false,
    });

    renderer.draw(context, MAP_1, [], VIEW);

    // 1344x784 com patch de 256px => 6x4 = 24 blits
    expect(context.calls.drawImage).toBeLessThanOrEqual(30);
    expect(context.calls.fillRect).toBe(0);

    removeDocumentStub();
  });

  it("keeps drawImage calls bounded per frame", () => {
    installDocumentStub();

    const renderer = createRenderer();
    const context = countingContext();

    renderer.draw(
      context,
      MAP_1,
      MAP_1_META.zones,
      VIEW,
    );

    console.log(
      `drawImage por frame: ${context.calls.drawImage}`,
    );

    // antes do pattern seriam ~2400 tiles por frame
    expect(context.calls.drawImage).toBeLessThan(300);

    removeDocumentStub();
  });

it("reuses the patch across frames", () => {
    installDocumentStub();

    const renderer = createRenderer();

    const first = countingContext();
    const second = countingContext();

    /**
     * O CAMPO DE PROVAS, e nao uma zona qualquer.
     *
     * As onze areas de mob sairam do pixel art e foram para o
     * `terra.jpg`. O unico lugar que ainda monta patch e a grade de
     * tiles de 32px e o campo de treino, que tem `kind: "training"` e
     * ficou de fora de proposito — e o caminho de reserva do
     * `fillZone` continua ele
     *
     * Medir o patch numa zona de mob nao mediria nada: ela nem chega a
     * montar grade
     */
    const treino = MAP_1_META.zones.find(
      (zone) => zone.kind === "training",
    );

    expect(treino, "o campo de provas sumiu").toBeTruthy();

    renderer.draw(first, MAP_1, [treino], VIEW);

    const depoisDoPrimeiro = renderer.patches.size;

    /**
     * O segundo quadro nao cria patch novo.
     *
     * A quantidade em si depende da zona: o Campo de Provas tem
     * `terrain: "grass"` e `terrainAlt: "dirt"`, entao a grade dele tem
     * os dois e sao dois patches. O que este teste trava e o cache — o
     * `buildPatch` refaz o canvas na hora, e refazer por quadro custaria
     * um canvas de 256px por area de mob por quadro
     */
    expect(depoisDoPrimeiro).toBeGreaterThan(0);

    renderer.draw(second, MAP_1, [treino], VIEW);

    expect(renderer.patches.size).toBe(depoisDoPrimeiro);
    expect(second.calls.fillRect).toBeGreaterThan(0);

    removeDocumentStub();
  });

  it("skips zones outside the viewport", () => {
    installDocumentStub();

    const renderer = createRenderer();

    const far = {
      x: 3000,
      y: 200,
      width: 400,
      height: 300,
      terrain: "stone",
    };

    const context = countingContext();

    renderer.draw(context, MAP_1, [far], VIEW);

    expect(context.calls.drawImage).toBe(0);
    expect(context.calls.fillRect).toBe(1);

    removeDocumentStub();
  });

  it("desenha a zona visivel, sem faixa de borda", () => {
    installDocumentStub();

    const renderer = createRenderer();

    const near = {
      x: 1620,
      y: 1040,
      width: 300,
      height: 300,
      terrain: "swamp",
    };

    const context = countingContext();

    renderer.draw(context, MAP_1, [near], VIEW);

    /**
     * A zona entra com um PADRAO, e nao com blits
     *
     * Com `document` instalado o `buildPatch` monta o canvas de 256px e
     * o `fillTerrain` preenche por `createPattern`. Este teste antes
     * media `drawImage > 0`, e o unico `drawImage` que existia era o da
     * FAIXA DE BORDA — ele media a coisa que foi removida, nao a zona
     */
    expect(context.calls.fillRect).toBeGreaterThan(1);

    // e nenhum blit: sobroupixels de faixa?
    expect(context.calls.drawImage).toBe(0);

    expect(renderer.drawZoneEdges).toBeUndefined();

    expect(renderer.drawTransitionBand).toBeUndefined();

    removeDocumentStub();
  });

  it("a zona nao escreve fora de si", () => {
    /**
     * A borda seca: uma zona de pixel art dentro de um chao pintado se
     * mostra pelo corte de estilo, sem precisar de mistura
     */
    installDocumentStub();

    const renderer = createRenderer();

    // so o chao: o unico preenchimento e o tile de grama
    const soChao = countingContext();

    renderer.draw(soChao, MAP_1, [], VIEW);

    expect(soChao.calls.fillRect).toBe(1);

    // com a zona visivel, um preenchimento a mais
    const comZona = countingContext();

    renderer.draw(
      comZona,
      MAP_1,
      [
        {
          x: 1620,
          y: 1040,
          width: 300,
          height: 300,
          terrain: "swamp",
        },
      ],
      VIEW,
    );

    expect(comZona.calls.fillRect).toBeGreaterThan(
      soChao.calls.fillRect,
    );

    removeDocumentStub();
  });

  it("still draws per tile without a DOM", () => {
    removeDocumentStub();

    const renderer = createRenderer();
    const context = countingContext();

    /**
     * Do lado do pixel art o que sobrou: o campo de provas.
     *
     * Sem `document` o `buildPatch` devolve null e o terreno cai no
     * `drawTerrain` quadro a quadro. O chao e as onze areas de mob nao
     * entram mais nessa conta: os dois vao por `createPattern`, um
     * `fillRect` sem nenhum `drawImage`
     */
    const treino = MAP_1_META.zones.find(
      (zone) => zone.kind === "training",
    );

    expect(treino).toBeTruthy();

    expect(() =>
      renderer.draw(context, MAP_1, [treino], VIEW),
    ).not.toThrow();

    expect(context.calls.drawImage).toBeGreaterThan(0);
  });
});

describe("terrain fallback", () => {
  it("is not ready without images", () => {
    const renderer = new TerrainRenderer();

    expect(renderer.isReady()).toBe(false);
  });

  it("is ready once the sheets load", () => {
    expect(createRenderer().isReady()).toBe(true);
  });

  it("draws without throwing when a patch cannot be built", () => {
    removeDocumentStub();

    const renderer = createRenderer();
    const context = countingContext();

    expect(() =>
      renderer.draw(context, MAP_1, [], VIEW),
    ).not.toThrow();
  });
});
