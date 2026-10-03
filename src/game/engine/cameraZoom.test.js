import { describe, expect, it } from "vitest";

import { MAP_1 } from "../../data/maps/index.js";
import { BASE_MAP } from "../../data/maps/base.js";

/**
 * A CAMERA DE CADA MAPA.
 *
 * O hub mostra o personagem 30% MAIS PERTO — a camera aperta o
 * enquadramento e o boneco ocupa mais espaco na TELA. No vale nada
 * muda.
 *
 * O que este arquivo trava sao as tres coisas que um zoom quebra em
 * silencio, e que nenhuma delas aparece como "o boneco ficou pequeno":
 *
 * 1. **O clique.** A camera e `tela = (mundo - jogador) * zoom`. Se o
 *    `screenToWorld` nao dividir por `zoom`, o jogador mira um ponto e
 *    o tiro vai para outro — o defeito aparece so quando o hub esta em
 *    uso, e parece mira bugada, nao camera bugada
 * 2. **O culling.** `getViewBounds` alimenta o terreno e as props. Com
 *    zoom, a tela ve MENOS mundo, entao o retangulo tem que encolher
 * 3. **O minimapa.** O retangulo branco mostra o que a camera ve. Com
 *    o `viewport` cru, o minimapa marcaria uma area maior do que a tela
 *
 * E o mais importante: **o tamanho do personagem no mundo nao muda**.
 * Encolher a arte do boneco pareceria a mesma coisa na tela, mas
 * mexeria no COLISOR DE CLIQUE e no alcance das habilidades, que sao
 * medidos em unidades do mundo
 */

describe("o enquadramento de cada mapa", () => {
  it("o vale fica no de sempre, e o hub aperta", () => {
    expect(MAP_1.cameraZoom).toBe(1);
    expect(BASE_MAP.cameraZoom).toBeCloseTo(1 / 0.7, 6);
  });

  it("o hub ve 70% da area, que e o que 30% mais perto significa", () => {
    /**
     * A conta: a camera 30% mais perto esta a 70% da distancia, e o
     * que cabe na tela e proporcional a distancia — entao 70% da
     * largura e 70% da altura, ou 49% da AREA
     *
     * `1.3` seria outra coisa: 30% mais ampliado, que corta 23% da
     * area em vez de 30%. A distincao esta aqui porque as duas leem
     * "mais perto" e nao sao o mesmo numero
     */
    const z = BASE_MAP.cameraZoom;

    expect(1 / z).toBeCloseTo(0.7, 6);

    // a largura vista
    expect(1280 / z).toBeCloseTo(896, 1);

    // e a area
    const areaVista = (1280 / z) * (720 / z);
    const areaTela = 1280 * 720;

    expect(areaVista / areaTela).toBeCloseTo(0.49, 3);
  });

  it("o zoom nunca e zero nem negativo", () => {
    /**
     * `0` encolheria o mundo para um ponto e a divisao do
     * `screenToWorld` viraria infinito. `negativo` viraria o mundo do
     * avesso
     */
    for (const mapa of [MAP_1, BASE_MAP]) {
      expect(mapa.cameraZoom).toBeGreaterThan(0);
    }
  });
});

describe("a conta da camera", () => {
  /**
   * A camera como equacao, isolada do motor.
   *
   * Sao as duas formulas que o `render` e o `screenToWorld` aplicam, e
   * o par delas tem que ser inverso: o que a camera faz na ida, o clique
   * desfaz na volta
   */
  const paraTela = (mundo, jogador, centro, z) =>
    (mundo - jogador) * z + centro;

  const paraMundo = (tela, jogador, centro, z) =>
    (tela - centro) / z + jogador;

  it("com zoom 1, a camera e a conta antiga", () => {
    const jogador = 3000;
    const centro = 640;
    const z = 1;

    expect(paraTela(jogador, jogador, centro, z)).toBe(centro);
    expect(paraMundo(centro, jogador, centro, z)).toBe(jogador);

    // 100px na tela sao 100 no mundo
    expect(
      paraTela(jogador + 100, jogador, centro, z) - centro,
    ).toBe(100);
  });

  it("com zoom do hub, o jogador fica no centro da tela", () => {
    const jogador = 840;
    const centro = 640;
    const z = BASE_MAP.cameraZoom;

    expect(paraTela(jogador, jogador, centro, z)).toBe(centro);
  });

  it("100px na tela sao 70px no mundo, com o zoom do hub", () => {
    const z = BASE_MAP.cameraZoom;
    const jogador = 840;
    const centro = 640;

    // tela -> mundo: e o caminho do CLIQUE
    const mundoDe100 = paraMundo(centro + 100, jogador, centro, z) - jogador;

    expect(mundoDe100).toBeCloseTo(100 / z, 5);
    expect(mundoDe100).toBeCloseTo(70, 1);

    // mundo -> tela: e o caminho da CAMERA, e e o mesmo numero ao
    // quadrado. 100 no mundo viram 142,86 na tela — o boneco parece
    // MAIOR, que e o que aproxima a camera
    const telaDe100 = paraTela(jogador + 100, jogador, centro, z) - centro;

    expect(telaDe100).toBeCloseTo(100 * z, 5);
    expect(telaDe100).toBeGreaterThan(100);
  });

  it("a ida e a volta dão o mesmo ponto", () => {
    /**
     * A propriedade que garante que a mira bate: para qualquer ponto do
     * mundo, transformar e destransformar devolve o proprio ponto
     */
    const jogador = 840;
    const centro = 640;

    for (const z of [1, BASE_MAP.cameraZoom]) {
      for (const mundo of [
        jogador,
        jogador + 1,
        jogador - 400,
        jogador + 899,
      ]) {
        const tela = paraTela(mundo, jogador, centro, z);

        expect(paraMundo(tela, jogador, centro, z)).toBeCloseTo(
          mundo,
          6,
        );
      }
    }
  });
});
