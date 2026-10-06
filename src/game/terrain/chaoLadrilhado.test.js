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
  GROUND_TILES,
  GROUND_TILE_SIZE,
  GROUND_USES_TILE,
  groundTileFor,
  zoneTileFor,
} from "../../data/terrain/index.js";
import { BASE_MAP, MAP_1_META, MAP_1 } from "../../data/maps/index.js";

/**
 * O CHAO LADRILHADO DE 128px, POR MAPA.
 *
 * Sao dois chaos no projeto: o `grama.jpg` do vale e o `chao_cidade.jpg`
 * do hub, ambos reduzidos de 1600x1600 para um tile de 128px no
 * carregamento. As 12 zonas de criatura do vale continuam com os tiles de
 * 32px da `terrain.png`
 *
 * O que importa, e nada disso aparece no codigo:
 *
 * 1. **A reducao e por METADES, e nao em um salto.** Cair de 1600 para
 *    128 de uma vez e um fator de 12,5: o navegador amostra poucos
 *    pontos de cada grupo e o grao vira xadrez
 * 2. **O ladrilho e preso ao mundo.** `createPattern` desenhado com a
 *    camera aplicada gruda na tela, e a grama andaria com o jogador
 * 3. **O chao nunca some.** Sao 450KB: se a arte nao carregar, se o
 *    canvas nao der, ou se o navegador nao criar padrao, o mapa
 *    continua em pixel art
 * 4. **Cada mapa tem a SUA folha.** Um tile e um padrao unicos
 *    compartilhados entre os dois maps serviriam a grama do vale como
 *    calcamento do hub
 *
 * Um detalhe que ja custou um teste inteiro: o chao E as zonas usam
 * `createPattern` as duas. A unica forma de dizer "o chao veio do
 * `grama.jpg`" e olhar a IMAGEM de cada padrao
 *
 * Daqui em diante TODO acesso ao chao passa por MAPA: `buildGroundTile`
 * e `isGroundReady` recebem o mapa, e os caches sao `Map`/`Set` por
 * FOLHA — a chave e a URL que `groundTileFor` devolve
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

  const ctx = {
    preenchimentos,
    imagensDePadrao,
    blits,

    fillStyle: null,
    imageSmoothingEnabled: null,
    imageSmoothingQuality: null,

    createPattern: withPattern
      ? (image, repetition) => {
          // so o padrao do CHAO lanca; o das zonas e caminho antigo e
          // nao esta no que este arquivo mede
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
      preenchimentos.push({
        fillStyle: this.fillStyle,
        args,
      });
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

  return ctx;
}

/**
 * O `document` entra por `beforeEach` e sai por `afterEach` de
 * proposito. Instalado dentro de cada teste, uma falha no meio deixava o
 * stub valendo para o teste seguinte — e o teste seguinte media o
 * caminho errado sem ninguem perceber
 */
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

/**
 * Um renderer com a folha do mapa trocada por uma imagem falsa.
 *
 * A chave do cache e a URL, entao e por ela que a folha entra: e o mesmo
 * caminho que `groundTileFor` percorre quando o jogo roda de verdade
 */
function rendererCom(ground = fakeImage(1600), mapa = MAP_1) {
  const renderer = new TerrainRenderer();

  renderer.terrain = fakeImage();
  renderer.groundImages.set(groundTileFor(mapa), ground);

  /**
   * A FOLHA DA ZONA TAMBEM ENTRA PRONTA.
   *
   * O `createPattern` do contexto falso aceita qualquer coisa e
   * devolve um padrao valido — inclusive `null`. Sem esta folha injetada,
   * o renderer recebia `null` no primeiro quadro e o teste confirmava
   * que "existia um ladrilho" sem nunca ter havido imagem nenhuma
   */
  renderer.zoneImages.set(zoneTileFor(mapa), fakeImage(1600));

  return renderer;
}

const VIEW = {
  x: 1600,
  y: 1000,
  width: 1280,
  height: 720,
};

/**
 * O tile de chao que o renderer vai usar: o canvas de 128px.
 *
 * Sai do `Map` pela FOLHA do mapa, e nao de uma propriedade solta. E o
 * que garante que o vale e o hub nao se emprestem o ladrilho
 */
function ladrilho(renderer, mapa = MAP_1) {
  return renderer.groundTiles.get(groundTileFor(mapa)) ?? null;
}

describe("o tile de grama", () => {
  it("o tile aponta para o grama.jpg e mede 128px", () => {
    expect(GROUND_TILES.grama).toContain("grama.jpg");
    expect(GROUND_USES_TILE).toBe(true);

    expect(GROUND_TILE_SIZE).toBe(128);
  });

  it("a arte esta no arquivo que o catalogo aponta", () => {
    const bytes = readFileSync(new URL(GROUND_TILES.grama));

    // assinatura JPEG: FFD8
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);

    expect(bytes.length).toBeGreaterThan(50 * 1024);
  });

  it("reduz a arte de 1600px para um canvas de 128px", () => {
    const renderer = rendererCom();

    renderer.buildGroundTile(MAP_1);

    const tile = ladrilho(renderer);

    expect(tile).toBeTruthy();

    // e o CANVAS, nao a imagem original
    expect(tile).not.toBe(renderer.groundImageFor(MAP_1));
    expect(tile.tag).toBe("canvas");

    expect(tile.width).toBe(128);
    expect(tile.height).toBe(128);
  });

  it("reduz por METADES, nao em um salto so", () => {
    /**
     * O passo que evita o xadrez.
     *
     * Cada `drawImage` da cadeia destino mede um lado. A sequencia
     * 1600 -> 800 -> 400 -> 200 -> 128 e o que prova que o caminho foi
     * aos poucos: um salto unico de 1600 para 128 seria um array de
     * dois numeros, com 12,5 de fator
     */
    const renderer = rendererCom();

    renderer.buildGroundTile(MAP_1);

    const destinos = ctxDePatch.blits.map(
      (args) => args[3],
    );

    expect(destinos).toEqual([800, 400, 200, 128]);
  });

  it("cada degrau da reducao e um fator de dois", () => {
    const renderer = rendererCom();

    renderer.buildGroundTile(MAP_1);

    const destinos = ctxDePatch.blits.map((args) => args[3]);

    for (let i = 1; i < destinos.length - 1; i += 1) {
      expect(
        destinos[i - 1] / destinos[i],
        `${destinos[i - 1]} para ${destinos[i]}`,
      ).toBeCloseTo(2, 0);
    }
  });

  it("liga o suavizamento em cada degrau", () => {
    /**
     * Sem `imageSmoothingEnabled` a queda de 1600 para 128 fica com
     * serrilhado: o navegador pega o vizinho mais proximo em vez de
     * fazer a media
     */
    const renderer = rendererCom();

    renderer.buildGroundTile(MAP_1);

    expect(ctxDePatch.imageSmoothingEnabled).toBe(true);
    expect(ctxDePatch.imageSmoothingQuality).toBe("high");
  });

  it("memoriza o tile e nao refaz a cada quadro", () => {
    /**
     * Construir a cadeia de canvas toda vez seria trabalho jogado fora
     */
    const renderer = rendererCom();

    renderer.buildGroundTile(MAP_1);

    const primeiro = ladrilho(renderer);

    const blitsAposPrimeiro = ctxDePatch.blits.length;

    for (let quadro = 0; quadro < 5; quadro += 1) {
      renderer.draw(contextQueConta(), MAP_1, [], VIEW);
    }

    expect(ladrilho(renderer)).toBe(primeiro);

    expect(ctxDePatch.blits.length).toBe(blitsAposPrimeiro);
  });

  it("usa a arte direto quando ela ja tem o tamanho do tile", () => {
    /**
     * Sem degrau nenhum: se a arte vier em 128px, nao ha o que reduzir e
     * ela e usada como esta
     */
    const renderer = rendererCom(fakeImage(128));

    renderer.buildGroundTile(MAP_1);

    const tile = ladrilho(renderer);

    expect(tile).toBe(renderer.groundImageFor(MAP_1));
    expect(ctxDePatch.blits.length).toBe(0);
  });
});

describe("cada mapa com a sua folha", () => {
  it("o vale pede a grama e o hub pede o calcamento", () => {
    expect(groundTileFor(MAP_1)).toBe(GROUND_TILES.grama);
    expect(groundTileFor(BASE_MAP)).toBe(GROUND_TILES.cidade);

    expect(GROUND_TILES.cidade).toContain("chao_cidade.jpg");
  });

  it("a arte do hub esta no arquivo que o catalogo aponta", () => {
    const bytes = readFileSync(new URL(GROUND_TILES.cidade));

    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
  });

  it("cada folha ganha o seu tile, sem emprestar o da outra", () => {
    /**
     * O defeito que a chave por URL evita: com um `groundTile` so, o
     * hub-bornaria o tile do vale — e o padrao da grama apareceria no
     * calcamento, ou o contrario
     */
    const renderer = rendererCom(fakeImage(1600), MAP_1);

    renderer.groundImages.set(
      groundTileFor(BASE_MAP),
      fakeImage(1600),
    );

    const grama = renderer.buildGroundTile(MAP_1);
    const cidade = renderer.buildGroundTile(BASE_MAP);

    expect(grama).toBeTruthy();
    expect(cidade).toBeTruthy();

    expect(grama).not.toBe(cidade);

    expect(ladrilho(renderer, MAP_1)).toBe(grama);
    expect(ladrilho(renderer, BASE_MAP)).toBe(cidade);
  });

  it("cada mapa tem o seu padrao", () => {
    const renderer = rendererCom(fakeImage(1600), MAP_1);

    renderer.groundImages.set(
      groundTileFor(BASE_MAP),
      fakeImage(1600),
    );

    const ctx = contextQueConta();

    renderer.draw(ctx, MAP_1, [], VIEW);

    renderer.draw(
      ctx,
      BASE_MAP,
      [],
      { x: 200, y: 200, width: 1280, height: 720 },
    );

    const grama = ladrilho(renderer, MAP_1);
    const cidade = ladrilho(renderer, BASE_MAP);

    expect(
      ctx.imagensDePadrao.filter((p) => p.image === grama).length,
    ).toBe(1);

    expect(
      ctx.imagensDePadrao.filter((p) => p.image === cidade).length,
    ).toBe(1);
  });

  it("uma folha que falhou nao leva a outra junto", () => {
    /**
     * `groundTentados` e por folha justamente por isso: uma arte
     * quebrada marca so a dela, e o outro mapa continua com o chao
     */
    const renderer = rendererCom(
      Object.assign(fakeImage(1600), { complete: false }),
      MAP_1,
    );

    renderer.groundImages.set(
      groundTileFor(BASE_MAP),
      fakeImage(1600),
    );

    expect(renderer.buildGroundTile(MAP_1)).toBe(null);
    expect(renderer.buildGroundTile(BASE_MAP)).toBeTruthy();
  });
});

describe("o chao desenhado", () => {
  it("desenha o chao com um unico preenchimento", () => {
    const renderer = rendererCom();
    const ctx = contextQueConta();

    renderer.draw(ctx, MAP_1, [], VIEW);

    expect(ctx.preenchimentos.length).toBe(1);

    expect(ctx.preenchimentos[0].fillStyle).toEqual({
      padrao: true,
      image: ladrilho(renderer),
    });
  });

  it("o padrao do chao vem do tile de 128px", () => {
    const renderer = rendererCom();
    const ctx = contextQueConta();

    renderer.draw(ctx, MAP_1, [], VIEW);

    const doChao = ctx.imagensDePadrao.filter(
      (p) => p.image === ladrilho(renderer),
    );

    expect(doChao.length).toBe(1);

    expect(doChao[0].repetition).toBe("repeat");
    expect(doChao[0].image.width).toBe(128);
  });

  it("o padrao e criado uma vez e reaproveitado", () => {
    const renderer = rendererCom();
    const ctx = contextQueConta();

    for (let quadro = 0; quadro < 5; quadro += 1) {
      renderer.draw(ctx, MAP_1, [], VIEW);
    }

    expect(
      ctx.imagensDePadrao.filter(
        (p) => p.image === ladrilho(renderer),
      ).length,
    ).toBe(1);
  });

  it("preenche a tela visivel, com uma tile de folga", () => {
    const renderer = rendererCom();
    const ctx = contextQueConta();

    renderer.draw(ctx, MAP_1, [], VIEW);

    // `fillRect(x, y, largura, altura)`: os quatro, sem pular nenhum
    const [x, y, largura, altura] =
      ctx.preenchimentos[0].args;

    expect(x).toBe(VIEW.x - 32);
    expect(y).toBe(VIEW.y - 32);
    expect(largura).toBe(VIEW.width + 64);
    expect(altura).toBe(VIEW.height + 64);
  });

  it("o tile cabe dez vezes na largura da tela", () => {
    /**
     * A consequencia de 128px que vale registrar: a 1600px o tile nao
     * aparecia nem uma vez na tela. Agora a repeticao e visivel, e a
     * troca foi feita por causa disso
     */
    expect(VIEW.width / GROUND_TILE_SIZE).toBe(10);
    expect(VIEW.height / GROUND_TILE_SIZE).toBeCloseTo(5.6, 1);
  });
});

describe("as areas dos mobs continuam como estavam", () => {
  it("as 12 zonas continuam com o terreno proprio", () => {
    expect(MAP_1_META.zones.length).toBe(12);

    for (const zone of MAP_1_META.zones) {
      expect(zone.terrain, zone.id).toBeTruthy();
    }

    const terrenos = new Set(
      MAP_1_META.zones.map((zone) => zone.terrain),
    );

    expect(terrenos.size).toBeGreaterThan(3);
  });

  it("a zona e desenhada por cima do chao", () => {
    const renderer = rendererCom();
    const ctx = contextQueConta();

    const zona = {
      x: 1600,
      y: 1000,
      width: 400,
      height: 300,
      terrain: "ice",
    };

    renderer.draw(ctx, MAP_1, [zona], VIEW);

    expect(ctx.preenchimentos.length).toBeGreaterThanOrEqual(2);

    // o primeiro e o chao
    expect(ctx.preenchimentos[0].fillStyle).toEqual({
      padrao: true,
      image: ladrilho(renderer),
    });
  });
  it("o campo de provas ladrilha COMO as onze areas de mob", () => {
    /**
     * A REGRA FINAL: as doze usam o `terra.jpg`.
     *
     * Este teste ja afirmou o contrario duas vezes — primeiro que o
     * campo nao podia se parecer com o chao, para o jogador saber onde
     * comeca o combate; depois que ele devia usar o chao padrao do
     * mapa. As duas deixavam o campo como o unico retangulo do vale com
     * outra textura, o que aparecia como um degrau de estilo na borda
     *
     * O que este teste trava agora e o ponto que importa: o campo de
     * provas usa o MESMO padrao de ladrilho que as areas de mob, e nao
     * uma grade de patches nem o chao de fora
     */
    const renderer = rendererCom();

    const ctx = contextQueConta();

    const treino = MAP_1_META.zones.find(
      (zone) => zone.kind === "training",
    );

    expect(treino, "o campo de provas sumiu").toBeTruthy();

    renderer.draw(ctx, MAP_1, [treino], VIEW);

    // o ladrilho de terra foi construido
    expect(renderer.zonePatterns.get(zoneTileFor(MAP_1))).toBeTruthy();

    // e ele foi o que preencheu a zona
    expect(
      ctx.preenchimentos.some(
        (p) =>
          p.fillStyle ===
          renderer.zonePatterns.get(zoneTileFor(MAP_1)),
      ),
      "o campo de provas nao ladrilhou com o terra.jpg",
    ).toBe(true);

    // nenhuma grade de patches, que era o caminho antigo dele
    expect(renderer.zoneGrids.size).toBe(0);

    expect(renderer.patches.size).toBe(0);
  });

  it("o ladrilho do campo e o MESMO das onze areas de mob", () => {
    /**
     * O `terra.jpg` e um so, e as doze usam.
     *
     * `zonePattern` e um unico padrao compartilhado: se o campo de
     * provas tivesse o seu, seriam dois ladrilhos para a mesma arte, e
     * a diferenca de escala apareceria na borda entre as duas zonas
     */
    const renderer = rendererCom();

    const ctx = contextQueConta();

    const treino = MAP_1_META.zones.find(
      (zone) => zone.kind === "training",
    );

    const mobs = MAP_1_META.zones.filter(
      (zone) => zone.kind !== "training",
    );

    renderer.draw(ctx, MAP_1, [treino, ...mobs], VIEW);

    const ladrilhos = new Set(
      ctx.preenchimentos
        .map((p) => p.fillStyle)
        .filter((f) => f && f.padrao),
    );

    // o chao do mapa e o ladrilho de terra: dois, e nao tres
    expect(ladrilhos.size).toBe(2);
  });
});

describe("o chao nunca some", () => {
  it("cai para pixel art enquanto a arte nao carregou", () => {
    const renderer = rendererCom(
      Object.assign(fakeImage(1600), { complete: false }),
    );

    expect(renderer.isGroundReady(MAP_1)).toBe(false);
    expect(ladrilho(renderer)).toBe(null);

    const ctx = contextQueConta();

    expect(() =>
      renderer.draw(ctx, MAP_1, [], VIEW),
    ).not.toThrow();

    expect(
      ctx.imagensDePadrao.filter(
        (p) => p.image?.width === 128,
      ).length,
    ).toBe(0);
  });

  it("cai para pixel art se a arte vier com largura zero", () => {
    const renderer = rendererCom(
      Object.assign(fakeImage(), {
        naturalWidth: 0,
        width: 0,
      }),
    );

    expect(renderer.isGroundReady(MAP_1)).toBe(false);
  });

  it("usa a arte de 1600px se nao der para montar o canvas", () => {
    /**
     * Sem `document` o tile de 128px nao pode existir, mas a arte crua
     * ainda serve de padrao — e e o que havia antes da reducao
     */
    delete globalThis.document;

    const renderer = rendererCom();
    const ctx = contextQueConta();

    renderer.draw(ctx, MAP_1, [], VIEW);

    expect(ladrilho(renderer)).toBe(null);

    expect(
      ctx.imagensDePadrao.filter(
        (p) => p.image === renderer.groundImageFor(MAP_1),
      ).length,
    ).toBe(1);
  });

  it("nao tenta montar o canvas todo quadro quando ele falha", () => {
    delete globalThis.document;

    const renderer = rendererCom();

    renderer.buildGroundTile(MAP_1);

    renderer.draw(contextQueConta(), MAP_1, [], VIEW);
    renderer.draw(contextQueConta(), MAP_1, [], VIEW);

    // a tentativa e marcada, e nao refeita
    expect(
      renderer.groundTentados.has(groundTileFor(MAP_1)),
    ).toBe(true);
  });

  it("cai para pixel art se o navegador nao criar padrao", () => {
    const renderer = rendererCom();
    const ctx = contextQueConta({ withPattern: false });

    expect(() =>
      renderer.draw(ctx, MAP_1, [], VIEW),
    ).not.toThrow();

    expect(ctx.imagensDePadrao.length).toBe(0);

    const desenhou =
      ctx.preenchimentos.length > 0 || ctx.blits.length > 0;

    expect(desenhou).toBe(true);
  });

  it("sobe quando o padrao do chao lanca", () => {
    const renderer = rendererCom();

    // o tile ainda nem foi montado quando o padrao e criado, entao o
    // alvo do lanco e a arte crua
    const ctx = contextQueConta({
      lancaEm: renderer.groundImageFor(MAP_1),
    });

    expect(() =>
      renderer.draw(ctx, MAP_1, [], VIEW),
    ).not.toThrow();

    expect(
      ctx.preenchimentos.filter(
        (p) =>
          p.fillStyle?.image === renderer.groundImageFor(MAP_1),
      ).length,
    ).toBe(0);

    expect(
      ctx.preenchimentos.length + ctx.blits.length,
    ).toBeGreaterThan(0);
  });

  it("uma arte quebrada nao impede o mapa de ficar pronto", () => {
    /**
     * O `isReady()` nao olha o chao de proposito: sao 450KB, e uma
     * imagem lenta nao pode derrubar o mundo inteiro
     */
    const renderer = rendererCom(
      Object.assign(fakeImage(1600), { complete: false }),
    );

    expect(renderer.isReady()).toBe(true);
  });

  it("sem arte nenhuma, o vale continua em pixel art de 32px", () => {
    const renderer = rendererCom(null);

    const ctx = contextQueConta();

    renderer.draw(ctx, MAP_1, [], VIEW);

    const daGrama = ctx.imagensDePadrao.filter(
      (p) => p.image?.width === 128,
    );

    expect(daGrama.length).toBe(0);

    const desenhou =
      ctx.preenchimentos.length > 0 || ctx.blits.length > 0;

    expect(desenhou).toBe(true);
  });
});
