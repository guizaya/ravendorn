import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { PortalRenderer } from "./PortalRenderer.js";
import {
  BASE_PORTALS,
  PORTALS,
  PORTAL_SHEETS,
  PORTAL_SIZE,
  portalsOf,
  sheetFor,
} from "../../data/portais/index.js";
import { MAP_1_META, MAP_1 } from "../../data/maps/index.js";
import { BASE_MAP } from "../../data/maps/base.js";
import { inflatePng } from "../../../tools/gif-to-sheet.mjs";

/**
 * O PORTAL DO PANTANO.
 *
 * Um portal decorativo em (5618, 3837), desenhado com a arte reduzida de
 * 1600px para 192px
 *
 * O que este arquivo trava, e nada disso aparece no codigo:
 *
 * 1. **A posicao e a que foi pedida, ao centavo.** O ponto cai dentro do
 *    Pantano Profundo, que e zona de mob — ver o aviso
 * 2. **A arte do bundle tem 192px e few KB.** O `portal_1.png` de
 *    origem tem 2,3MB e 1451px, que cobriria o viewport inteiro
 * 3. **O portal e ancorado pelo CENTRO.** O aro e redondo e deitado no
 *    chao; ancorar pela base o empurraria metade do tamanho para cima
 * 4. **E decorativo de verdade**: nao vira solido de colisao
 */

class ImagemFalsa {
  constructor() {
    this.complete = true;
    this.width = PORTAL_SIZE;
    this.height = PORTAL_SIZE;
  }

  set src(valor) {
    this.carregada = valor;
  }

  get src() {
    return this.carregada;
  }
}

const ImageOriginal = globalThis.Image;

globalThis.Image = ImagemFalsa;

function contextQueConta() {
  const chamadas = [];

  return {
    chamadas,
    fillStyle: null,
    drawImage(...args) {
      chamadas.push(args);
    },
    fillRect() {},
    save() {},
    restore() {},
    beginPath() {},
    ellipse() {},
  };
}

function renderer() {
  return new PortalRenderer();
}

function caixaDaArte(png) {
  let minX = png.width;
  let maxX = -1;
  let minY = png.height;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (png.data[(y * png.width + x) * 4 + 3] === 0) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return { minX, maxX, minY, maxY };
}

describe("o catalogo de portais", () => {
  it("sao DOIS portais, cada um com sua arte", () => {
    expect(PORTALS).toHaveLength(2);

    const folhas = PORTALS.map((p) => p.sheet);

    // dois portais com a MESMA arte seriam um so portal desenhado duas
    // vezes — e o vortice de fogo existe justamente para nao ser assim
    expect(new Set(folhas).size).toBe(2);
  });

  it("o portal do Pantano esta na coordenada pedida", () => {
    const pantano = PORTALS.find(
      (p) => p.id === "portal_pantano",
    );

    // posicoes editadas a mao: 5799, 3981
    expect(pantano.x).toBe(5799);
    expect(pantano.y).toBe(3981);
    expect(pantano.sheet).toBe("pantano");
  });

  it("o portal da Floresta esta na coordenada pedida", () => {
    const floresta = PORTALS.find(
      (p) => p.id === "portal_floresta",
    );

    // posicoes editadas a mao: 178, 180
    expect(floresta.x).toBe(178);
    expect(floresta.y).toBe(180);
    expect(floresta.sheet).toBe("floresta");
  });

  it("cada portal aponta para uma folha que existe", () => {
    for (const portal of PORTALS) {
      expect(
        sheetFor(portal),
        `${portal.id} sem folha`,
      ).toBeTruthy();

      expect(sheetFor(portal)).toContain(".png");
    }
  });

  it("sao TRES folhas diferentes no bundle", () => {
    const folhas = Object.values(PORTAL_SHEETS);

    // tres agora: o vortice do Pantano, o de fogo da Floresta e o aro
    // de pedra do hub. Cada arte tem seu arquivo reduzido, porque
    // juntar duas encolheria uma delas
    expect(folhas).toHaveLength(3);
    expect(new Set(folhas).size).toBe(3);

    expect(PORTAL_SHEETS.pantano).toContain("portal_base.png");
    expect(PORTAL_SHEETS.floresta).toContain(
      "portal_2_base.png",
    );
    expect(PORTAL_SHEETS.hub).toContain("portal_hub_base.png");
  });

  it("medem 192px", () => {
    expect(PORTAL_SIZE).toBe(192);

    for (const portal of PORTALS) {
      expect(portal.size).toBe(192);
    }

    for (const portal of BASE_PORTALS) {
      expect(portal.size).toBe(192);
    }
  });

  it("o id e unico", () => {
    const ids = new Set(PORTALS.map((p) => p.id));

    expect(ids.size).toBe(PORTALS.length);
  });

  it("o CENTRO de cada portal esta dentro dos limites", () => {
    const limites = MAP_1_META.bounds;

    for (const portal of PORTALS) {
      expect(
        portal.x,
        `${portal.id} fora pela direita`,
      ).toBeLessThan(limites.x + limites.width);

      expect(
        portal.x,
        `${portal.id} fora pela esquerda`,
      ).toBeGreaterThan(limites.x);

      expect(
        portal.y,
        `${portal.id} fora por baixo`,
      ).toBeLessThan(limites.y + limites.height);

      expect(
        portal.y,
        `${portal.id} fora por cima`,
      ).toBeGreaterThan(limites.y);
    }
  });

  it("o portal da Floresta cabe INTEIRO no mapa", () => {
    /**
     * Este teste ja foi o contrario: ele media o PENDURAMENTO de
     * (111, 125), 25px pela esquerda e 11px por cima. A posicao mudou
     * para (178, 180) e o penduramento sumiu
     *
     * A regra e a mesma dos outros dois portais — nenhum desenho pode
     * passar da borda do mundo. Aqui ela virou uma afirmacao em vez de
     * uma excecao medida
     */
    const floresta = PORTALS.find(
      (p) => p.id === "portal_floresta",
    );

    const limites = MAP_1_META.bounds;
    const meia = floresta.size / 2;

    expect(floresta.x - meia).toBe(82);
    expect(floresta.y - meia).toBe(84);

    // folga de verdade nas quatro bordas
    expect(floresta.x - meia - limites.x).toBe(42);
    expect(floresta.y - meia - limites.y).toBe(44);

    expect(
      floresta.x - meia,
    ).toBeGreaterThanOrEqual(limites.x);

    expect(
      floresta.x + meia,
    ).toBeLessThanOrEqual(limites.x + limites.width);

    expect(
      floresta.y - meia,
    ).toBeGreaterThanOrEqual(limites.y);

    expect(
      floresta.y + meia,
    ).toBeLessThanOrEqual(limites.y + limites.height);
  });

  it("NENHUM portal pendura para fora do mapa", () => {
    /**
     * A regra geral, agora que os dois cabem
     *
     * Se alguem voltar a colocar um portal perto de um canto, este
     * teste reprova com o nome do portal e o quanto pendura — em vez de
     * o penduramento passar despercebido ate alguem olhar o jogo
     */
    const limites = MAP_1_META.bounds;

    for (const portal of PORTALS) {
      const meia = portal.size / 2;

      const pendura = {
        esquerda: Math.max(
          0,
          limites.x - (portal.x - meia),
        ),
        cima: Math.max(0, limites.y - (portal.y - meia)),
        direita: Math.max(
          0,
          portal.x + meia - (limites.x + limites.width),
        ),
        baixo: Math.max(
          0,
          portal.y + meia - (limites.y + limites.height),
        ),
      };

      expect(
        Object.values(pendura).reduce((a, b) => a + b, 0),
        `${portal.id} pendura ${JSON.stringify(pendura)}`,
      ).toBe(0);
    }
  });

  it("o portal do Pantano cabe inteiro no mapa", () => {
    const pantano = PORTALS.find(
      (p) => p.id === "portal_pantano",
    );

    const limites = MAP_1_META.bounds;
    const meia = pantano.size / 2;

    expect(
      pantano.x - meia,
    ).toBeGreaterThanOrEqual(limites.x);

    expect(
      pantano.x + meia,
    ).toBeLessThanOrEqual(limites.x + limites.width);

    expect(
      pantano.y - meia,
    ).toBeGreaterThanOrEqual(limites.y);

    expect(
      pantano.y + meia,
    ).toBeLessThanOrEqual(limites.y + limites.height);
  });

  it("o jogador consegue chegar perto do portal da Floresta", () => {
    /**
     * O penduramento aparece na tela porque o jogador alcanca o canto
     */
    const floresta = PORTALS.find(
      (p) => p.id === "portal_floresta",
    );

    const limites = MAP_1_META.bounds;
    const RAIO = 22;

    // o centro do jogador chega no limite do mundo mais o raio dele
    const alcancaX = limites.x + RAIO;
    const alcancaY = limites.y + RAIO;

    expect(floresta.x).toBeGreaterThan(alcancaX);
    expect(floresta.y).toBeGreaterThan(alcancaY);
  });

  it("o portal do Pantano esta DENTRO do Pantano Profundo, como pedido", () => {
    /**
     * Este nao e um defeito que o teste esconde: e o aviso. O ponto
     * pedido cai no meio de uma zona de mob, entao criaturas daquela
     * zona andam em volta do portal
     *
     * O teste existe para que, se alguem mover o portal depois, a
     * mudanca de lugar apareca como diferenca neste arquivo e nao como
     * surpresa no jogo
     *
     * O `kind` passou de `active` para `passive`: a zona virou o lugar
     * de entrada, com so limo de nivel 1 e 2 dentro. Verificar o `kind`
     * aqui e o que amarra a mudanca da zona a mudanca do portal — sem
     * esta linha, trocar o pantano de `passive` para `active` de novo
     * nao apareceria em nenhum teste
     */
    const pantano = PORTALS.find((p) => p.id === "portal_pantano");

    const dentro = MAP_1_META.zones.filter(
      (zone) =>
        pantano.x >= zone.x &&
        pantano.x < zone.x + zone.width &&
        pantano.y >= zone.y &&
        pantano.y < zone.y + zone.height,
    );

    expect(dentro.map((z) => z.id)).toEqual(["pantano"]);
    expect(dentro[0].kind).toBe("passive");
  });

  it("o portal da Floresta esta DENTRO da Floresta Sombria", () => {
    const floresta = PORTALS.find(
      (p) => p.id === "portal_floresta",
    );

    const dentro = MAP_1_META.zones.filter(
      (zone) =>
        floresta.x >= zone.x &&
        floresta.x < zone.x + zone.width &&
        floresta.y >= zone.y &&
        floresta.y < zone.y + zone.height,
    );

    expect(dentro.map((z) => z.id)).toEqual(["floresta"]);
    expect(dentro[0].kind).toBe("semi");
  });

  it("o mapa entrega o portal e NAO um solido de colisao", () => {
    expect(MAP_1.portals).toEqual(PORTALS);

    /**
     * Decorativo de verdade: sem `solids`, o jogador e os monstros
     * atravessam o desenho
     */
    expect(
      MAP_1.solids.some((s) =>
        String(s.kind).includes("portal"),
      ),
    ).toBe(false);
  });

  it("um mapa sem portais entrega lista vazia", () => {
    /**
     * O renderer percorre com `for` e conta `.length`, entao lista
     * vazia e o estado que ele ja sabe tratar — e nao `undefined`
     */
    expect(portalsOf({})).toEqual([]);
    expect(portalsOf(null)).toEqual([]);
    expect(portalsOf({ portals: [] })).toEqual([]);
  });
});

describe("o portal do hub", () => {
  it("esta em (1475, 588), que foi a posicao pedida", () => {
    expect(BASE_PORTALS).toHaveLength(1);

    const [portal] = BASE_PORTALS;

    expect(portal.x).toBe(1475);
    expect(portal.y).toBe(588);
    expect(portal.sheet).toBe("hub");
  });

  it("o hub entrega o portal dele para quem entra", () => {
    expect(portalsOf(BASE_MAP)).toEqual(BASE_PORTALS);
  });

  it("o desenho inteiro cai dentro da base", () => {
    /**
     * O portal e ancorado pelo CENTRO e mede 192px, entao em (1475, 588)
     * ele vai de x=1379 a 1571 e de y=492 a 684
     *
     * A base e pequena — 1680x1176 — e um portal pendurado para fora
     * aparece cortado na beira, que foi exatamente o que aconteceu com
     * o portal da Floresta quando estava em (111, 125)
     */
    const [portal] = BASE_PORTALS;
    const meia = portal.size / 2;
    const b = BASE_MAP.bounds;

    expect(portal.x - meia).toBeGreaterThanOrEqual(b.x);
    expect(portal.x + meia).toBeLessThanOrEqual(b.x + b.width);
    expect(portal.y - meia).toBeGreaterThanOrEqual(b.y);
    expect(portal.y + meia).toBeLessThanOrEqual(b.y + b.height);
  });

  it("fica na mesma altura do nascimento, e a direita dele", () => {
    const [portal] = BASE_PORTALS;

    // y igual ao centro: o jogador ve o portal sem sair do lugar
    expect(portal.y).toBe(BASE_MAP.spawn.y);

    // e longe o bastante para nao nascer em cima dele
    expect(portal.x).toBeGreaterThan(BASE_MAP.spawn.x);
  });

  it("aponta para uma folha que existe", () => {
    expect(sheetFor(BASE_PORTALS[0])).toContain(
      "portal_hub_base.png",
    );
  });

  it("nao entra na colisao, igual aos outros", () => {
    /**
     * Decorativo de verdade: o jogador atravessa o desenho
     */
    const [portal] = BASE_PORTALS;

    expect(
      BASE_MAP.solids.some(
        (s) =>
          portal.x >= (s.x ?? 0) - portal.size / 2 &&
          portal.x <= (s.x ?? 0) + portal.size / 2,
      ),
      "o portal entrou como solido",
    ).toBe(false);
  });
});

describe("a arte dos portais", () => {
  /**
   * As DUAS folhas, medidas em conjunto.
   *
   * O portal do Pantano e o da Floresta sao artes diferentes, e cada
   * uma tem o seu arquivo reduzido. O teste roda nas duas porque a
   * falha que importa — fundo branco opaco, moldura sobrando, halo
   * escuro na borda do aro — pode estar em uma e nao na outra
   */
  const ARTES = Object.entries(PORTAL_SHEETS).map(
    ([chave, url]) => {
      const bytes = readFileSync(fileURLToPath(url));

      return {
        chave,
        url,
        bytes,
        png: inflatePng(bytes),
      };
    },
  );

  for (const arte of ARTES) {
    describe(arte.chave, () => {
      it("esta no tamanho que o catalogo declara", () => {
        expect(arte.png.width).toBe(PORTAL_SIZE);
        expect(arte.png.height).toBe(PORTAL_SIZE);
      });

      it("e leve", () => {
        // o original passa de 2MB
        expect(arte.bytes.length).toBeLessThan(300 * 1024);
      });

      it("o fundo e TRANSPARENTE, e nao branco", () => {
        /**
         * Se a arte viesse com fundo opaco, o portal apareceria como
         * um quadrado branco no meio da grama
         */
        expect(arte.png.data[3]).toBe(0);

        const ultimo =
          ((arte.png.height - 1) * arte.png.width +
            (arte.png.width - 1)) *
          4;

        expect(arte.png.data[ultimo + 3]).toBe(0);
      });

      it("a arte ocupa a imagem toda, sem moldura sobrando", () => {
        const caixa = caixaDaArte(arte.png);

        // o aro de pedra e redondo: encosta nas quatro bordas
        expect(caixa.minX).toBeLessThan(2);
        expect(caixa.minY).toBeLessThan(2);
        expect(caixa.maxX).toBeGreaterThan(PORTAL_SIZE - 3);
        expect(caixa.maxY).toBeGreaterThan(PORTAL_SIZE - 3);
      });

      it("o aro tem detalhe, e nao e um borrão", () => {
        const caixa = caixaDaArte(arte.png);

        const largura = caixa.maxX - caixa.minX + 1;

        /**
         * Se a reducao tivesse virado um borrão, a faixa do aro nao
         * teria o gradiente de cor da pedra
         */
        expect(largura).toBeGreaterThan(PORTAL_SIZE * 0.95);

        let comPixel = 0;

        for (let y = 2; y < 2 + PORTAL_SIZE * 0.12; y += 1) {
          for (let x = 0; x < arte.png.width; x += 1) {
            if (
              arte.png.data[(y * arte.png.width + x) * 4 + 3] > 0
            ) {
              comPixel += 1;
            }
          }
        }

        expect(comPixel, "a faixa do aro sumiu").toBeGreaterThan(
          100,
        );
      });

      it("a borda do aro nao escureceu", () => {
        /**
         * O halo. A media de RGBA separados mistura a cor do aro com
         * o "nao ha nada aqui" e escurece a borda; a reducao
         * pre-multiplica o alpha para nao fazer isso
         */
        for (let y = 0; y < arte.png.height; y += 1) {
          for (const x of [0, arte.png.width - 1]) {
            const i = (y * arte.png.width + x) * 4;

            /*
             * So pixel REALMENTE visivel.
             *
             * A primeira versao media a soma dos canais sem olhar o
             * alpha, e reprovava no portal do fogo com um pixel de
             * alpha 5 — 2% opaco. A cor de um pixel quase transparente
             * e ruido: a divisao pre-multiplicada amplifica o que era
             * quase zero, e o resultado nao aparece na tela
             */
            if (arte.png.data[i + 3] < 128) continue;

            const brilho =
              arte.png.data[i] +
              arte.png.data[i + 1] +
              arte.png.data[i + 2];

            expect(brilho, `halo em ${x},${y}`).toBeGreaterThan(
              90,
            );
          }
        }
      });
    });
  }

  it("o catalogo aponta para os DERIVADOS, e nao para os originais", () => {
    for (const url of Object.values(PORTAL_SHEETS)) {
      expect(url).toContain("base.png");

      expect(url).not.toContain("portal_1.png");
      expect(url).not.toContain("portal_2.png");
    }
  });

  it("cabe numa tela", () => {
    expect(PORTAL_SIZE).toBeLessThan(1280);
    expect(PORTAL_SIZE).toBeLessThan(720);
  });

  it("os ORIGINAIS continuam intactos", () => {
    /**
     * A ferramenta escreve um arquivo derivado por arte e nunca toca
     * nos arquivos de 1600px — se sobrescrevesse, a proxima rodada
     * reduziria uma arte ja reduzida
     */
    for (const arquivo of ["portal_1.png", "portal_2.png"]) {
      const bytes = readFileSync(
        fileURLToPath(
          new URL(
            `../../assets/portais/${arquivo}`,
            import.meta.url,
          ),
        ),
      );

      expect(inflatePng(bytes).width, arquivo).toBe(1600);

      expect(bytes.length, arquivo).toBeGreaterThan(
        1024 * 1024,
      );
    }
  });
});

describe("o desenho do portal", () => {
  it("desenha um retangulo do tamanho do catalogo", () => {
    const r = renderer();
    const ctx = contextQueConta();

    r.drawPortal(ctx, PORTALS[0]);

    expect(ctx.chamadas).toHaveLength(1);

    const [, x, y, largura, altura] = ctx.chamadas[0];

    expect(largura).toBe(PORTAL_SIZE);
    expect(altura).toBe(PORTAL_SIZE);
  });

  it("ancora pelo CENTRO, e nao pela base", () => {
    const r = renderer();
    const ctx = contextQueConta();

    const portal = PORTALS[0];

    r.drawPortal(ctx, portal);

    const [, x, y, largura] = ctx.chamadas[0];

    // o centro do desenho cai exatamente no ponto pedido
    expect(x + largura / 2).toBe(portal.x);
    expect(y + largura / 2).toBe(portal.y);

    /**
     * E o pixels de onde sai o desenho: `portal.x - 96`. Com a base
     * ancorando, sairia `portal.y - 192`, e o portal pareceria meio
     * tamanho acima do lugar
     */
    expect(x).toBe(portal.x - PORTAL_SIZE / 2);
    expect(y).toBe(portal.y - PORTAL_SIZE / 2);
  });

  it("desenha a arte inteira, sem recorte", () => {
    const r = renderer();
    const ctx = contextQueConta();

    r.drawPortal(ctx, PORTALS[0]);

    const [imagem, , , largura, altura] = ctx.chamadas[0];

    // o `drawImage` de 5 argumentos desenha a imagem inteira
    expect(ctx.chamadas[0]).toHaveLength(5);
    expect(imagem).toBe(r.image);
    expect(largura).toBe(PORTAL_SIZE);
    expect(altura).toBe(PORTAL_SIZE);
  });

  it("descarta o portal que esta fora da tela", () => {
    const r = renderer();

    const visivel = {
      x: PORTALS[0].x,
      y: PORTALS[0].y,
      width: 1280,
      height: 720,
    };

    const dentro = r.collectVisible([PORTALS[0]], visivel);

    expect(dentro).toHaveLength(1);

    const longe = {
      x: PORTALS[0].x + 3000,
      y: PORTALS[0].y,
      width: 1280,
      height: 720,
    };

    expect(r.collectVisible([PORTALS[0]], longe)).toEqual([]);
  });

  it("o cull considera o LADO do portal, e nao so o ponto", () => {
    /**
     * O portal tem 192px. Se o cull olhasse so o ponto, um portal com o
     * centro 100px fora da tela ainda entraria na lista e gastaria um
     * `drawImage` a cada quadro sem aparecer
     */
    const r = renderer();

    const view = {
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    };

    // o centro esta 50px a esquerda da tela, mas metade do portal
    // (96px) ainda cabe dentro
    const naBorda = { x: 50, y: 300, size: PORTAL_SIZE };

    expect(r.visible(naBorda, view)).toBe(true);

    // agora o centro esta 150px fora: nada do portal aparece
    const fora = { x: -150, y: 300, size: PORTAL_SIZE };

    expect(r.visible(fora, view)).toBe(false);
  });

  it("nao desenha sem imagem", () => {
    const r = renderer();

    // a folha deste portal some do cache
    r.images.set(sheetFor(PORTALS[0]), null);

    const ctx = contextQueConta();

    expect(r.drawPortal(ctx, PORTALS[0])).toBe(false);
    expect(ctx.chamadas).toEqual([]);
  });

  it("so esta pronto quando TODAS as folhas carregaram", () => {
    const r = renderer();

    expect(r.isReady()).toBe(true);

    /**
     * Uma folha quebrada tira o mapa inteiro do `drawMap`
     *
     * Com dois portais, `isReady` exige as DUAS folhas. O contrario
     * deixaria o portal da Floresta invisivel enquanto o do Pantano
     * aparecia, sem erro nenhum
     */
    r.images.set(PORTAL_SHEETS.floresta, null);

    expect(r.isReady()).toBe(false);
  });

  it("cada portal usa a SUA folha", () => {
    const r = renderer();
    const ctx = contextQueConta();

    r.drawPortal(ctx, PORTALS[0]);
    r.drawPortal(ctx, PORTALS[1]);

    expect(ctx.chamadas).toHaveLength(2);

    const [primeira, segunda] = ctx.chamadas;

    expect(primeira[0]).not.toBe(segunda[0]);

    expect(primeira[0]).toBe(r.imageFor(PORTALS[0]));
    expect(segunda[0]).toBe(r.imageFor(PORTALS[1]));
  });
});

/**
 * O Image falso vale para o arquivo INTEIRO, e nao por teste
 *
 * Com fterEach o primeiro teste restaurava o Image global e todos os
 * seguintes recebiam loadImage devolvendo 
ull — o drawPortal saia
 * sem desenhar e o teste media um portal invisivel, que e o oposto do
 * que ele deve provar
 */
afterAll(() => {
  globalThis.Image = ImageOriginal;
});