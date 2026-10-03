import { afterAll, afterEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import ClassSprite from "./ClassSprite.jsx";
import { ARBALIST_SPRITE } from "../../data/sprites/index.js";

/**
 * O desenho dentro do canvas, com o canvas de mentira.
 *
 * Este arquivo existe por um defeito que o navegador mostrava e
 * nenhuma assercao de HTML pegava: a arte saia DESLOCADA para a
 * esquerda dentro do botao.
 *
 * A causa era a superficie de desenho. Um `<canvas>` sem `width` e
 * `height` nos atributos tem uma superficie de 300x150, que e o padrao
 * do HTML e nao o tamanho dele na tela. O codigo desenhava usando
 * `clientWidth`/`clientHeight` — 150x150 — e o navegador espremia a
 * superficie de 300x150 para caber na caixa de 150x150. A arte saia
 * achatada, menor e fora do centro
 *
 * Um teste que so olha o HTML nao alcança isso: o `<canvas>` sai
 * vazio no caso quebrado e no certo. Por isso o canvas aqui e um
 * duble que registra as chamadas de `drawImage`
 */

/** as chamadas de desenho que o duble registrou */
const desenho = [];

/**
 * O quadro agendado, e nao uma fila.
 *
 * A primeira versao deste teste enfileirava os quadros e o
 * scheduler do React consumia a fila junto, e o laço do componente
 * nunca rodava. Guardar so o ULTIMO callback e chamar ele na mao
 * tira o React do meio
 */
let quadro = null;
let pendentes = 0;

const rAFOriginal = globalThis.requestAnimationFrame;
const cancelOriginal = globalThis.cancelAnimationFrame;

globalThis.requestAnimationFrame = (fn) => {
  quadro = fn;
  pendentes += 1;

  return pendentes;
};

globalThis.cancelAnimationFrame = () => {
  quadro = null;
};

/** o `Image` que finge carregar */
class ImageFalso {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._src = "";
    this.naturalWidth = 576;
    this.naturalHeight = 1088;
  }

  set src(valor) {
    this._src = valor;

    // o `onload` dispara no proximo microtask: o `SpriteSheet` o
    // registra ANTES de atribuir o `src`, entao ele ja existe aqui
    queueMicrotask(() => this.onload?.());
  }

  get src() {
    return this._src;
  }
}

const criarContexto = () => ({
  imageSmoothingEnabled: false,
  drawImage: (...args) => desenho.push(args),
  clearRect() {},
});

/**
 * O `getContext` e patcheado no PROTOTIPO, e nao no construtor.
 *
 * Trocar `globalThis.HTMLCanvasElement` por uma subclasse nao
 * funciona: o jsdom ja tem o registro de elementos e cria o canvas
 * pela classe interna dele, entao o `getContext("2d")` continuava
 * sendo o de verdade — que devolve `null` sem o pacote `canvas`. O
 * componente entao saia no `if (!context)` e o laco nunca comecava
 *
 * No prototipo o patch pega os canvas que JÁ existem, porque eles
 * compartilham a mesma cadeia
 */
const protoCanvas =
  globalThis.HTMLCanvasElement.prototype;

const getContextOriginal = protoCanvas.getContext;

protoCanvas.getContext = function getContext(tipo) {
  if (tipo !== "2d") {
    return getContextOriginal.call(this, tipo);
  }

  return criarContexto();
};

const ImageOriginal = globalThis.Image;

globalThis.Image = ImageFalso;

afterAll(() => {
  protoCanvas.getContext = getContextOriginal;
  globalThis.Image = ImageOriginal;
  globalThis.requestAnimationFrame = rAFOriginal;
  globalThis.cancelAnimationFrame = cancelOriginal;
});

/** monta o componente e devolve o canvas com tamanho de tela definido */
function montarCaixa(lado = 150) {
  const { container } = render(
    <ClassSprite classId="arbalist" />,
  );

  const canvas = container.querySelector("canvas");

  // o jsdom nao faz laid out: `clientWidth` e 0 e o laco sai antes
  // de desenhar
  Object.defineProperty(canvas, "clientWidth", {
    value: lado,
    configurable: true,
  });
  Object.defineProperty(canvas, "clientHeight", {
    value: lado,
    configurable: true,
  });

  return canvas;
}

/**
 * Roda o quadro agendado ate a folha carregar.
 *
 * O `act` e ASSINCRONO de proposito. O `onload` da imagem chega por
 * microtask, e o `act` sincrono nao dispara microtask: a folha
 * ficava `ready: false` para sempre, o laco retornava sem desenhar e
 * o teste falhava com zero chamadas de `drawImage` — um defeito do
 * teste, e nao do componente
 */
async function desenhar(vezes = 3) {
  for (let i = 0; i < vezes; i += 1) {
    if (!quadro) break;

    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();

      if (quadro) quadro(1000 + i * 100);
    });
  }
}

afterEach(() => {
  desenho.length = 0;
  quadro = null;
});

describe("ClassSprite o desenho no canvas", () => {
  it("a superficie de desenho tem o tamanho da caixa", async () => {
    // Este e o teste do defeito da superficie de 300x150. Sem o
    // `canvas.width` batendo com a caixa, o navegador espreme o
    // desenho e ele sai deslocado
    const canvas = montarCaixa(150);

    // antes de qualquer quadro, a superficie e o padrao do HTML
    expect(canvas.width).toBe(300);

    await desenhar();

    expect(
      canvas.width,
      "a superficie de largura nao e a da caixa",
    ).toBe(150);
    expect(
      canvas.height,
      "a superficie de altura nao e a da caixa",
    ).toBe(150);
  });

  it("o desenho e centralizado na superficie", async () => {
    // Com a superficie do tamanho certo, o desenho tem de cair no
    // meio. O que se compara e o CENTRO do destino com o centro da
    // superficie, e nao a coordenada: um `x` pequeno demais passaria
    // numa comparacao de igualdade
    const canvas = montarCaixa(150);

    await desenhar();

    expect(desenho.length).toBeGreaterThan(0);

    // drawImage(imagem, sx, sy, sw, sh, dx, dy, dw, dh)
    const [, , , , , dx, dy, dw, dh] = desenho.at(-1);

    expect(dx + dw / 2).toBeCloseTo(canvas.width / 2, 0);
    expect(dy + dh / 2).toBeCloseTo(canvas.height / 2, 0);
  });

  it("o desenho e recortado pela caixa do personagem", async () => {
    // A celula do arquiro e 64x64 e o desenho ocupa 30x44 dela. Sem
    // o recorte a arte sai pequena com 17px de vao transparente de
    // cada lado
    montarCaixa(150);

    await desenhar();

    // drawImage(imagem, sx, sy, sw, sh, ...)
    const [, , , sw, sh] = desenho.at(-1);
    const { contentBox } = ARBALIST_SPRITE;

    expect(sw).toBe(contentBox.width);
    expect(sh).toBe(contentBox.height);

    // o recorte e menor que a celula: se cobrisse tudo, nao estaria
    // recortando nada
    expect(sw).toBeLessThan(ARBALIST_SPRITE.frameWidth);
    expect(sh).toBeLessThan(ARBALIST_SPRITE.frameHeight);
  });

  it("a arte e ampliada para preencher a caixa", async () => {
    // o desenho tem 30px e a caixa tem 150: a escala tem de ser
    // MAIOR que 1. Uma escala menor significaria a arte pequena com
    // margem transparente, que e o defeito do recorte ausente
    montarCaixa(150);

    await desenhar();

    const [, , , , , , , dw, dh] = desenho.at(-1);

    expect(dw).toBeGreaterThan(ARBALIST_SPRITE.contentBox.width);
    expect(dh).toBeGreaterThan(ARBALIST_SPRITE.contentBox.height);

    // e nao passa da caixa
    expect(dw).toBeLessThanOrEqual(150);
    expect(dh).toBeLessThanOrEqual(150);
  });

  it("o desenho acompanha o tamanho da caixa, e nao um fixo", async () => {
    // o retrato grande tem outro tamanho, e a superficie tem de
    // acompanhar. Uma superficie travada em 150 deixaria a arte
    // achatada no retrato grande
    const canvas = montarCaixa(300);

    await desenhar();

    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(300);

    const [, , , , , , , dw, dh] = desenho.at(-1);

    expect(dxCentro(desenho.at(-1))).toBeCloseTo(150, 0);
    expect(dyCentro(desenho.at(-1))).toBeCloseTo(150, 0);
    expect(dw).toBeLessThanOrEqual(300);
    expect(dh).toBeLessThanOrEqual(300);
  });

  it("o laco para quando o componente sai da tela", async () => {
    // sem o `cancelAnimationFrame`, trocar de classe deixaria um laco
    // antigo rodando e desenhando em um canvas que nao esta mais no
    // documento
    const { unmount } = render(
      <ClassSprite classId="arbalist" />,
    );

    await desenhar(2);

    await act(async () => {
      unmount();
    });

    // o cleanup cancelou o quadro agendado
    expect(quadro).toBe(null);
  });

  it("nao desenha nada sem browser", () => {
    // o `renderToStaticMarkup` e o caminho do servidor: sem `Image` o
    // componente tem de sair sem quebrar
    const original = globalThis.Image;
    globalThis.Image = undefined;

    try {
      const html = renderToStaticMarkup(
        <ClassSprite classId="arbalist" />,
      );

      expect(html).toContain("<canvas");
    } finally {
      globalThis.Image = original;
    }
  });
});

const dxCentro = (args) => args[5] + args[7] / 2;
const dyCentro = (args) => args[6] + args[8] / 2;
