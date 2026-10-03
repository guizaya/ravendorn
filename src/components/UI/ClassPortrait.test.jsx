import { afterAll, afterEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ClassPortrait from "./ClassPortrait.jsx";

/**
 * O retrato grande dos detalhes, e a GEOMETRIA do canvas.
 *
 * A arte transbordava o card pela direita, e ja foi tentada uma
 * correcao que piorou. As duas tentativas e o porque:
 *
 * 1. `inset: 6% 10% 8%` com o `width: 100%` herdado do canvas.
 *    Com `left`, `right` e `width` definidos, o navegador IGNORA o
 *    `right`: obedece ao `left` e ao `width`. O canvas comecava 10%
 *    a direita da borda e media a largura toda — 10% para fora
 *
 * 2. `inset` com `width: auto`. Piorou, porque o `<canvas>` e um
 *    elemento SUBSTITUIDO. O preenchimento "entre os offsets" so vale
 *    para elemento nao substituido; num canvas, `width: auto` e a
 *    largura INTRINSECA — o atributo `width`, que o HTML define como
 *    300px. O canvas virou 300px de largo comecando 8% a direita
 *
 * A saida e falar as quatro medidas com `right`/`bottom` em `auto`,
 * e e o que este arquivo verifica
 */
const CSS = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "styles.css",
  ),
  "utf8",
);

/** o corpo de uma regra CSS pelo seletor exato */
const corpo = (seletor) => {
  const achado = CSS.match(
    new RegExp(
      `(?:^|[},])\\s*${seletor.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      )}\\s*\\{([^}]*)`,
      "m",
    ),
  );

  return achado?.[1] ?? "";
};

/** le uma declaracao numerica em % do corpo de uma regra */
const medida = (corpoRegra, propriedade) => {
  const achado = corpoRegra.match(
    new RegExp(`${propriedade}\\s*:\\s*([\\d.]+)%`),
  );

  return achado ? Number(achado[1]) : null;
};

const ARBALIST = {
  id: "arbalist",
  name: "Arbalist",
  accent: "#8fd66b",
  role: "Dano a distancia",
  stats: { hp: 700, attack: 80, defense: 20 },
  tagline: "t",
  description: "d",
};

let quadro = null;

globalThis.requestAnimationFrame = (fn) => {
  quadro = fn;

  return 1;
};

globalThis.cancelAnimationFrame = () => {
  quadro = null;
};

const desenho = [];

const contexto = () => ({
  imageSmoothingEnabled: false,
  drawImage: (...args) => desenho.push(args),
  clearRect() {},
});

const protoCanvas =
  globalThis.HTMLCanvasElement.prototype;
const getContextOriginal = protoCanvas.getContext;

protoCanvas.getContext = function getContext(tipo) {
  return tipo === "2d" ? contexto() : null;
};

class ImageFalso {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._src = "";
  }

  set src(valor) {
    this._src = valor;
    queueMicrotask(() => this.onload?.());
  }
}

const ImageOriginal = globalThis.Image;

globalThis.Image = ImageFalso;

afterAll(() => {
  protoCanvas.getContext = getContextOriginal;
  globalThis.Image = ImageOriginal;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
});

afterEach(() => {
  desenho.length = 0;
  quadro = null;
});

/** renderiza o retrato grande e devolve o canvas com a caixa do CSS */
async function montarDetalhe(largura = 203, altura = 290) {
  const { container } = render(
    <ClassPortrait definition={ARBALIST} large />,
  );

  const canvas = container.querySelector("canvas");

  Object.defineProperty(canvas, "clientWidth", {
    value: largura,
    configurable: true,
  });
  Object.defineProperty(canvas, "clientHeight", {
    value: altura,
    configurable: true,
  });

  for (let i = 0; i < 3; i += 1) {
    if (!quadro) break;

    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
      if (quadro) quadro(1000 + i * 100);
    });
  }

  return canvas;
}

describe("o retrato grande dos detalhes", () => {
  it("o canvas nao pode resolver a largura pelo atributo", () => {
    // O defeito da 2a tentativa. `width: auto` num canvas e a largura
    // INTRINSECA (o atributo `width`, 300px por padrao), e nao o
    // preenchimento entre `left` e `right`
    const grande = corpo(".class-portrait--large .class-sprite");

    expect(grande, "a regra do retrato grande sumiu").not.toBe("");

    expect(grande).not.toMatch(/width:\s*auto/);
    expect(grande).not.toMatch(/height:\s*auto/);
  });

  it("o `right` fica em auto para nao competir com o `width`", () => {
    // Com `left`, `right` e `width` definidos, o navegador ignora o
    // `right`. Fala-lo em `auto` deixa `left` e `width` como as
    // medidas autoritativas
    const grande = corpo(".class-portrait--large .class-sprite");

    expect(grande).toMatch(/right:\s*auto/);
    expect(grande).toMatch(/bottom:\s*auto/);
  });

  it("a arte fica dentro do card nas duas direcoes", () => {
    // O invariante real do transbordo: a posicao somada ao tamanho
    // nao pode passar da caixa. Em % do bloco, o limite e 100%
    const grande = corpo(".class-portrait--large .class-sprite");

    const esquerda = medida(grande, "left");
    const largura = medida(grande, "width");
    const topo = medida(grande, "top");
    const altura = medida(grande, "height");

    expect(esquerda).not.toBeNull();
    expect(largura).not.toBeNull();
    expect(topo).not.toBeNull();
    expect(altura).not.toBeNull();

    // sobra espaco: nem encosta na borda, nem passa
    expect(esquerda + largura, "vaza pela direita").toBeLessThan(100);
    expect(topo + altura, "vaza por baixo").toBeLessThan(100);

    // e a folga lateral e simetrica, senao a arte nao fica no meio
    const folgaDireita = 100 - (esquerda + largura);
    expect(folgaDireita).toBeCloseTo(esquerda, 1);
  });

  it("o botao de escolher a classe nao foi tocado", () => {
    // O botao usa `inset: 0`, e ai o `right` ser ignorado nao muda
    // nada: ele e zero, e `left: 0` com `width: 100%` preenche a
    // caixa. Se ganhasse `width: auto` junto, a largura resolvida
    // seria a intrinseca de 300px
    const base = corpo(".class-sprite");

    expect(base).toMatch(/inset:\s*0/);
    expect(base).toMatch(/width:\s*100%/);
    expect(base).toMatch(/height:\s*100%/);

    expect(corpo(".class-card .class-sprite")).not.toMatch(
      /width:\s*auto/,
    );
  });

  it("o desenho fica dentro da superficie e no meio dela", () => {
    // O `drawImage` desenha o destino DENTRO do canvas, entao aqui a
    // arte nao pode vazar: o problema era o canvas transbordando do
    // card, e nao o desenho saindo do canvas
    return montarDetalhe().then((canvas) => {
      expect(desenho.length).toBeGreaterThan(0);

      const [, , , , , dx, dy, dw, dh] = desenho.at(-1);

      expect(dx, "a arte vaza a esquerda").toBeGreaterThanOrEqual(0);
      expect(dy, "a arte vaza em cima").toBeGreaterThanOrEqual(0);
      expect(dx + dw, "a arte vaza a direita").toBeLessThanOrEqual(
        canvas.width,
      );
      expect(dy + dh, "a arte vaza embaixo").toBeLessThanOrEqual(
        canvas.height,
      );

      // centralizado
      expect((dx + dx + dw) / 2).toBeCloseTo(canvas.width / 2, 0);
      expect((dy + dy + dh) / 2).toBeCloseTo(canvas.height / 2, 0);
    });
  });

  it("a arte usa a area sem encostar na borda", () => {
    // Encolher demais e o mesmo defeito pelo outro lado: sobra
    // espaco vazio no meio do card
    return montarDetalhe().then((canvas) => {
      const [, , , , , , , dw, dh] = desenho.at(-1);

      expect(dw).toBeGreaterThan(canvas.width * 0.7);
      expect(dh).toBeGreaterThan(canvas.height * 0.7);
    });
  });
});
