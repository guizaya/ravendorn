import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { PropRenderer } from "./PropRenderer.js";
import { getPropType } from "../../data/props/index.js";
import { MAP_1 } from "../../data/maps/index.js";

/**
 * O Arvore DO VALE CHEGANDO NA TELA.
 *
 * O resto do `PropRenderer.test.js` prova que o catalogo e a arte estao
 * certos. Aqui o que importa e a ultima etapa: o `drawImage` receber a
 * folha certa, no tamanho certo, com o pe do tronco no lugar
 *
 * Um `drawImage` com origem errada nao dá erro nenhum — ele desenha
 * silenciosamente fora da imagem e o prop fica invisivel, ou pior,
 * desenha a linha errada da folha
 */

const ARVORE = getPropType("arvore");

/**
 * Um `Image` de mentira.
 *
 * O `PropRenderer` so desenha quando `loadImage` devolve alguma coisa,
 * e em Node nao existe `Image` — o `loadImage` devolve `null` e o
 * `drawProp` sai sem desenhar. Sem este stub, todos os testes deste
 * arquivo mediriam uma arvore que nao aparece, que e o oposto do que
 * eles devem provar
 */
class ImagemFalsa {
  constructor() {
    this.complete = true;
    this.width = ARVORE.frameWidth;
    this.height = ARVORE.frameHeight;
  }

  set src(valor) {
    this.carregada = valor;
  }

  get src() {
    return this.carregada;
  }
}

const ImageOriginal = globalThis.Image;

beforeAll(() => {
  globalThis.Image = ImagemFalsa;
});

afterAll(() => {
  globalThis.Image = ImageOriginal;
});

/**
 * Um canvas falso que guarda as chamadas.
 *
 * O `drawImage` do real e assíncrono e nao da para cravar o valor aqui;
 * e a arvore so e desenhada depois que a folha carrega, o que num teste
 * de Node nunca acontece
 */
function canvas() {
  const chamadas = [];

  return {
    chamadas,
    save() {},
    restore() {},
    fill() {},
    fillRect() {},
    beginPath() {},
    ellipse() {},
    drawImage(...args) {
      chamadas.push(args);
    },
  };
}

/** uma arvore no meio da tela, do jeito que o mapa a cria */
function propNoMapa() {
  const arvore = MAP_1.blocking[0];

  expect(arvore, "o mapa nao tem arvore").toBeTruthy();

  return arvore;
}

/**
 * Os nove argumentos do `drawImage`, nomeados.
 *
 * A assinatura e `drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth,
 * dHeight)`: a origem e o tamanho da FONTE, e depois o destino. Ler
 * esses nove posicionalmente e um convite a errar a conta — e foi
 * assim que a primeira versao destes testes comparou a altura da fonte
 * com a largura
 */
function leitura(chamada) {
  const [
    imagem,
    origemX,
    origemY,
    larguraOrigem,
    alturaOrigem,
    destinoX,
    destinoY,
    larguraDestino,
    alturaDestino,
  ] = chamada;

  return {
    imagem,
    origemX,
    origemY,
    larguraOrigem,
    alturaOrigem,
    destinoX,
    destinoY,
    larguraDestino,
    alturaDestino,
  };
}

describe("a arvore na tela", () => {
  it("busca a folha da arvore, e nao a props.png", () => {
    const renderer = new PropRenderer();
    const ctx = canvas();

    renderer.drawProp(ctx, propNoMapa());

    expect(ctx.chamadas).toHaveLength(1);

    const { imagem } = leitura(ctx.chamadas[0]);

    expect(imagem).toBeTruthy();
    expect(imagem).not.toBe(renderer.image);

    // e o `imageFor` guardou a folha, para nao recarregar a cada arvore
    expect(renderer.images.has(ARVORE.sheet)).toBe(true);
  });

  it("desenha o arquivo inteiro", () => {
    const renderer = new PropRenderer();
    const ctx = canvas();

    renderer.drawProp(ctx, propNoMapa());

    const { larguraOrigem, alturaOrigem } = leitura(ctx.chamadas[0]);

    expect(larguraOrigem).toBe(ARVORE.frameWidth);
    expect(alturaOrigem).toBe(ARVORE.frameHeight);
  });

  it("pega a origem dentro da folha, e nao fora", () => {
    /**
     * A origem e `(variant * frameWidth, row * frameHeight)`.
     *
     * Com `variants: 1`, o indice 0 e a unica opcao valida. Um indice
     * de 0 a 3 buscaria em x=96, x=192 e x=288 — fora de um arquivo de
     * 96px de largura — e a arvore sairia vazia em tres de cada quatro
     */
    const renderer = new PropRenderer();
    const ctx = canvas();

    renderer.drawProp(ctx, propNoMapa());

    const {
      origemX,
      origemY,
      larguraOrigem,
      alturaOrigem,
    } = leitura(ctx.chamadas[0]);

    expect(origemX).toBeGreaterThanOrEqual(0);
    expect(origemY).toBeGreaterThanOrEqual(0);

    expect(origemX + larguraOrigem).toBeLessThanOrEqual(
      ARVORE.frameWidth,
    );
    expect(origemY + alturaOrigem).toBeLessThanOrEqual(
      ARVORE.frameHeight,
    );
  });

  it("desenha do tamanho do catalogo", () => {
    const renderer = new PropRenderer();
    const ctx = canvas();

    renderer.drawProp(ctx, propNoMapa());

    const { larguraDestino, alturaDestino } =
      leitura(ctx.chamadas[0]);

    expect(larguraDestino).toBe(ARVORE.drawWidth);
    expect(alturaDestino).toBe(ARVORE.drawHeight);
  });

  it("poe o pe do tronco na posicao do prop", () => {
    /**
     * Com `base: 1`, a base da arte fica EM `y`. Os tipos antigos usam
     * 0.78 porque a folha de 32px tem folga abaixo do desenho
     *
     * Se o `base` ficasse em 0.78, o tronco terminaria 26px acima do
     * ponto de colisao e a arvore pareceria flutuar sobre o chao
     */
    const renderer = new PropRenderer();
    const ctx = canvas();

    const prop = propNoMapa();

    renderer.drawProp(ctx, prop);

    const { destinoY, alturaDestino } = leitura(ctx.chamadas[0]);

    expect(destinoY + alturaDestino).toBe(prop.y);
  });

  it("centra a copa no prop", () => {
    const renderer = new PropRenderer();
    const ctx = canvas();

    const prop = propNoMapa();

    renderer.drawProp(ctx, prop);

    const { destinoX, larguraDestino } = leitura(ctx.chamadas[0]);

    expect(destinoX + larguraDestino / 2).toBeCloseTo(prop.x, 0);
  });

  it("desenha a sombra junto com a arvore", () => {
    const renderer = new PropRenderer();
    const ctx = canvas();

    const prop = propNoMapa();

    renderer.draw(ctx, [prop], {
      x: prop.x - 100,
      y: prop.y - 100,
      width: 400,
      height: 400,
    });

    // a sombra e um `ellipse`, e a arvore um `drawImage`
    expect(ctx.chamadas).toHaveLength(1);
  });

  it("nao desenha prop de tipo desconhecido", () => {
    const renderer = new PropRenderer();
    const ctx = canvas();

    renderer.drawProp(ctx, {
      x: 100,
      y: 100,
      type: "castelo",
      radius: 20,
      variant: 0,
    });

    expect(ctx.chamadas).toHaveLength(0);
  });
});