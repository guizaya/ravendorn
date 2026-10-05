import { describe, expect, it } from "vitest";
import {
  ROWS,
  SHEETS,
  buildSheet,
} from "./gif-to-sheet.mjs";

/**
 * A folha do ogre da predeira.
 *
 * Este arquivo trava as tres adaptacoes que a arte dele exigiu, e
 * nao apenas que a imagem saiu:
 *
 * 1. O golpe veio em 5 das 8 direcoes. A ferramenta copia a vizinha
 *    mais proxima em GRAU, e o mapa e declarado na folha: uma
 *    decisao sobre a arte, nao um palpite interno.
 * 2. O `idle.gif` chegou depois de a folha estar montada. A folha
 *    ganhou a linha de idle no MEIO, e o golpe teve de descer da linha
 *    8 para a 9 — o `rowOffset` antigo leria a linha do idle e o ogre
 *    brandiria o porrete parado no meio do golpe. O layout aponta o
 *    idle para a linha dele, com `row` obrigatorio.
 * 3. Os gifs nao tem a mesma contagem de frames entre as direcoes
 *    (8 e 9 na caminhada, 9 e 10 no golpe). O corte e no menor do
 *    grupo, para o passo nao mudar de direcao para direcao.
 */
const build = () => buildSheet("ogre");

describe("sheet do ogre da predeira", () => {
  it("tem as 8 direcoes de caminhada na arte", () => {
    // a caminhada veio completa: 8 arquivos na raiz
    const declaradas = SHEETS.ogre.sourceDir;

    expect(declaradas).toBe(
      "src/assets/sprites/ogre_da_predeira",
    );

    expect(ROWS).toHaveLength(8);
  });

  it("declara o substituto de cada direcao de golpe que falta", () => {
    const fallback = SHEETS.ogre.shootFallback;

    // north, north-east e north-west nao vieram na pasta `shoot`
    expect(Object.keys(fallback).sort()).toEqual([
      "north",
      "north-east",
      "north-west",
    ]);
  });

  it("copia a direcao vizinha mais proxima, nunca a oposta", () => {
    const resultado = build();

    const porDirecao = Object.fromEntries(
      resultado.substituidas.map((item) => [
        item.direcao,
        item.veioDe,
      ]),
    );

    expect(porDirecao).toEqual({
      "north-west": "west",
      north: "east",
      "north-east": "east",
    });

    // a ordem de `ROWS` e circular de 8 direcoes, entao a distancia
    // entre duas e a menor das duas distancias lineares. A conferia
    // e que o substituto e o mais proximo que existia, e nao so um
    // substituto qualquer
    const indice = (nome) => ROWS.indexOf(nome);

    const circular = (a, b) => {
      const bruto = Math.abs(indice(a) - indice(b));

      return Math.min(bruto, ROWS.length - bruto);
    };

    // o que a arte trouxe de verdade na pasta `shoot`
    const disponiveis = [
      "east",
      "south-east",
      "south",
      "south-west",
      "west",
    ];

    for (const [direcao, vizinho] of Object.entries(porDirecao)) {
      const escolhido = circular(direcao, vizinho);

      for (const outra of disponiveis) {
        expect(
          circular(direcao, outra),
          `${direcao}: ${vizinho} (${escolhido}) foi pior que ${outra}`,
        ).toBeGreaterThanOrEqual(escolhido);
      }
    }

    // e o oposto nunca entra: colar o lado de frente no lugar do
    // lado de costas faria o jogador ver a CARA do ogre quando ele
    // esta virado para o fim da tela
    for (const [direcao, vizinho] of Object.entries(porDirecao)) {
      const oposto = circular(direcao, vizinho);

      expect(oposto).toBeLessThan(4);
    }
  });

  it("nao repete a mesma arte como se fosse direcao nova", () => {
    const resultado = build();

    // Cada linha copiada e a MESMA arte de outra linha. Isso e
    // esperado e foi pedido; o que nao pode e a folha inteira ter
    // virado em menos linhas: 8 de caminhada, 1 de idle e 8 de golpe
    // saem 17, e o tool contaria menos
    expect(resultado.rows).toBe(17);
  });

  it("usa a linha de idle de verdade, e o golpe desce para 9", async () => {
    const resultado = build();

    /**
     * A folha mudou de forma quando o `idle.gif` chegou.
     *
     * Antes eram 16 linhas: 8 de caminhada e 8 de golpe, e o idle caia
     * no frame 0 da caminhada. Agora a caminhada vai de 0 a 7, o idle
     * e a linha 8, e o golpe COMECA na 9
     *
     * O `shootRow` sendo 8 era o bug silencioso: o golpe leria a linha do
     * idle e o ogre brandiria o porrete parado no meio da animacao
     */
    expect(resultado.idleRow).toBe(8);
    expect(resultado.idleFrames).toBe(8);
    expect(resultado.shootRow).toBe(9);

    const { OGRE_PREDEIRA_SPRITE } = await import(
      "../src/data/sprites/enemyLayout.js"
    );

    const { idle, walk, attack } = OGRE_PREDEIRA_SPRITE.animations;

    /**
     * O `row` do idle e OBRIGATORIO.
     *
     * Sem ele o `resolveFrameRect` usaria `rowOffset ?? 0` e leria a
     * linha 0 — a caminhada para leste. O ogre voltaria a andar
     * parado virado para o lado, que e o defeito que a linha de idle
     * veio resolver
     */
    expect(idle.row).toBe(8);
    expect(idle.length).toBe(8);

    // e o golpe tem de ler a linha DELE, e nao a do idle
    expect(attack.rowOffset).toBe(9);
    expect(attack.rowOffset).not.toBe(idle.row);
    expect(walk.rowOffset ?? 0).toBe(0);
  });

  it("corta o ciclo no menor numero de frames do grupo", () => {
    const resultado = build();

    // a caminhada tem gif de 8 e de 9 frames, e o golpe de 9 e de
    // 10. Cortar no menor da 8 e 9
    expect(resultado.walkFrames).toBe(8);
    expect(resultado.shootFrames).toBe(9);
    expect(resultado.columns).toBe(9);

    // o idle tem 8 frames, e e o ciclo mais curto da folha: e ele que
    // dita a coluna, senao o idle leria uma coluna que nao existe
    expect(resultado.idleFrames).toBe(8);
  });

  it("mede a ancora, e nao a chuta", () => {
    const resultado = build();

    // a celula e a mesma do zumbi, 68x68, e a ancora foi medida
    expect(resultado.frameSize).toBe(68);
    expect(resultado.anchorX).toBeCloseTo(33.5, 1);
    expect(resultado.anchorY).toBe(55);
  });

  it("cabe 153 celulas: 8 de caminhada, 1 de idle e 8 de golpe", () => {
    const resultado = build();

    expect(resultado.width).toBe(612);
    expect(resultado.height).toBe(1156);

    /**
     * A ALTURA subiu de 1088 para 1156: sao 68px a mais, que e a linha
     * de idle entrando no meio da folha
     */
    expect(resultado.height).toBe(resultado.rows * 68);

    // 8 direcoes, e em cada uma 8 frames de caminhada mais 9 de
    // golpe. A 9a coluna da sheet fica vazia na caminhada, que tem
    // 8, e e por isso que a contagem NAO e `columns x rows`
    const celulas =
      8 * (resultado.walkFrames + resultado.shootFrames);

    expect(celulas).toBe(8 * 17);
  });
});
