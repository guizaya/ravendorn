import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getEnemySprite } from "../../data/sprites/enemies.js";
import { inflatePng } from "../../../tools/gif-to-sheet.mjs";
import { DIRECTION_KEYS } from "../sprites/animation.js";

/**
 * A folha do RATO DA TOCA no disco.
 *
 * A geracao ja e conferida em `tools/ratoDaTocaSheet.test.js`. Este
 * arquivo olha para o PNG JA ESCRETO, que e uma coisa diferente: o
 * outro confere o que a ferramenta decidiu, e este confere o que foi
 * gravado. Um `alignAnchors` que funciona em memoria e falha ao
 * escrever o arquivo passaria no primeiro e falharia aqui
 *
 * A definicao vem por `getEnemySprite("rat")`, e nao importada direta
 * do `enemyLayout`: e assim que o `GameEngine` pede, e por isso o
 * teste passa pelo mesmo caminho. Pedir direto pegaria uma definicao
 * sem `src`, e o arquivo PNG nem seria conferido
 *
 * O caso que este arquivo precisa cobrir de verdade e a linha do SUL.
 * Ela vem da arte de PARADO, e nao da caminhada: e a unica linha da
 * folha que nao e arte de caminhada, e a que o jogador mais ve
 */

const RATO_DA_TOCA_SPRITE = getEnemySprite("rat");

const SHEET = fileURLToPath(
  new URL(
    "../../assets/sprites/rato_da_toca-sheet.png",
    import.meta.url,
  ),
);

const CELL = RATO_DA_TOCA_SPRITE.frameWidth;
const IDLE_ROW = RATO_DA_TOCA_SPRITE.animations.idle.row;
const COLUMNS = Math.max(
  ...Object.values(RATO_DA_TOCA_SPRITE.animations).map(
    (animation) => animation.length,
  ),
);

const sheet = inflatePng(readFileSync(SHEET));

function cellAt(column, row) {
  const pixels = [];

  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const targetX = column * CELL + x;
      const targetY = row * CELL + y;
      const index = (targetY * sheet.width + targetX) * 4;

      pixels.push(
        sheet.data[index],
        sheet.data[index + 1],
        sheet.data[index + 2],
        sheet.data[index + 3],
      );
    }
  }

  return pixels;
}

function boxOf(pixels) {
  let minX = CELL;
  let maxX = -1;
  let minY = CELL;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      if (pixels[(y * CELL + x) * 4 + 3] === 0) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count += 1;
    }
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    count,
  };
}

/** uma linha por direcao, mais a de idle */
const lanes = () => [
  ...DIRECTION_KEYS.map((key) => ({
    name: `walk ${key}`,
    row: RATO_DA_TOCA_SPRITE.directions[key],
    length: RATO_DA_TOCA_SPRITE.animations.walk.length,
  })),
  {
    name: "idle",
    row: IDLE_ROW,
    length: RATO_DA_TOCA_SPRITE.animations.idle.length,
  },
];

const cells = lanes().flatMap((lane) =>
  Array.from({ length: lane.length }, (_, column) => ({
    label: `${lane.name} frame ${column}`,
    box: boxOf(cellAt(column, lane.row)),
  })),
);

/** a linha do sul, que vem da arte de parado */
const SUL = RATO_DA_TOCA_SPRITE.directions.south;

describe("a folha do rato da toca", () => {
  it("tem uma linha por direcao de andar, mais o idle", () => {
    expect(sheet.width).toBe(CELL * COLUMNS);
    expect(sheet.height).toBe(CELL * (DIRECTION_KEYS.length + 1));
    expect(COLUMNS).toBe(8);
    expect(IDLE_ROW).toBe(8);
  });

  it("tem uma linha para cada direcao", () => {
    for (const key of DIRECTION_KEYS) {
      expect(
        RATO_DA_TOCA_SPRITE.directions[key],
        key,
      ).toBeGreaterThanOrEqual(0);

      expect(
        RATO_DA_TOCA_SPRITE.directions[key],
        key,
      ).toBeLessThan(IDLE_ROW);
    }

    expect(
      new Set(
        Object.values(RATO_DA_TOCA_SPRITE.directions),
      ).size,
    ).toBe(DIRECTION_KEYS.length);
  });

  it("casa com a definicao que o motor desenha", () => {
    expect(RATO_DA_TOCA_SPRITE, "o rat nao tem sprite").toBeTruthy();
    expect(RATO_DA_TOCA_SPRITE.id).toBe("rat");
    expect(RATO_DA_TOCA_SPRITE.format).toBe("directional");
    expect(RATO_DA_TOCA_SPRITE.frameWidth).toBe(CELL);
    expect(RATO_DA_TOCA_SPRITE.frameHeight).toBe(CELL);
    expect(RATO_DA_TOCA_SPRITE.anchorX).toBe(33.5);
    expect(RATO_DA_TOCA_SPRITE.anchorY).toBe(51);

    // a imagem e a folha nova, e nao a `enemies/rat.png` de 32px de
    // tres linhas. Uma URL quebrada aqui daria 404 no navegador e o
    // bicho sumiria sem erro no console
    expect(RATO_DA_TOCA_SPRITE.src).toContain(
      "rato_da_toca-sheet.png",
    );

    for (const animation of Object.values(
      RATO_DA_TOCA_SPRITE.animations,
    )) {
      expect(animation.start, "animacao").toBe(0);
      expect(animation.fps, "animacao").toBeGreaterThan(0);
      expect(animation.length, "animacao").toBeGreaterThan(0);
      expect(animation.length, "animacao").toBeLessThanOrEqual(
        COLUMNS,
      );
    }
  });

  it("nao tem bloco de golpe, porque o rato e PASSIVO", () => {
    /**
     * O rato tem `aggroRange: 0` e foge do jogador. Um bloco `attack`
     * aqui apontaria para uma linha de golpe que a folha nao tem, e o
     * `resolveFrameRect` cairia no reserva — que procura o `idle`
     * antes do `walk`, entando o bicho parado em vez de andando
     * durante um golpe que ele nunca deu
     */
    expect(
      RATO_DA_TOCA_SPRITE.animations.attack,
      "o rato nao ataca: nao deveria ter linha de golpe",
    ).toBe(undefined);

    // e o idle tem `row`, e nao `rowOffset`: sem ele o desenho leria
    // a linha 0, que e a caminhada para leste
    expect(RATO_DA_TOCA_SPRITE.animations.idle.row).toBe(IDLE_ROW);
    expect(RATO_DA_TOCA_SPRITE.animations.idle.rowOffset).toBe(
      undefined,
    );
  });

  it("o balanco e menor que o do ghoul", () => {
    /**
     * O `amplitude` e a altura que o sprite sobe a cada passo. Um
     * bicho de 43px nao pode pular 4px: ele sairia do chao mais do
     * que andaria em cima dele
     */
    expect(RATO_DA_TOCA_SPRITE.walkBob.amplitude).toBeLessThanOrEqual(2);
  });

  it("desenha um rato inteiro em cada celula usada", () => {
    for (const { label, box } of cells) {
      expect(box.count, `${label} vazia`).toBeGreaterThan(200);
      expect(box.height, `${label} baixa demais`).toBeGreaterThan(28);
      expect(box.width, `${label} estreita demais`).toBeGreaterThan(16);
    }
  });

  it("mantem o rato dentro da propria celula", () => {
    for (const { label, box } of cells) {
      expect(
        box.minX,
        `${label} encosta na esquerda`,
      ).toBeGreaterThan(0);
      expect(
        box.maxX,
        `${label} encosta na direita`,
      ).toBeLessThan(CELL - 1);
      expect(
        box.minY,
        `${label} encosta no topo`,
      ).toBeGreaterThan(0);
      expect(
        box.maxY,
        `${label} encosta na base`,
      ).toBeLessThan(CELL - 1);
    }
  });

  it("nao tem frame corrompido em nenhuma linha", () => {
    for (const lane of lanes()) {
      const laneBoxes = [];

      for (let column = 0; column < lane.length; column += 1) {
        laneBoxes.push(boxOf(cellAt(column, lane.row)));
      }

      const unionWidth = Math.max(...laneBoxes.map((b) => b.width));
      const unionHeight = Math.max(...laneBoxes.map((b) => b.height));
      const unionArea = unionWidth * unionHeight;

      laneBoxes.forEach((box, index) => {
        // a assinatura de frame truncado e perder ALTURA: o stream LZW
        // para nas primeiras linhas da celula. As duas diagonais de
        // baixo vieram assim da arte de origem
        expect(
          box.height,
          `${lane.name} frame ${index} baixo`,
        ).toBeGreaterThanOrEqual(unionHeight * 0.5);

        expect(
          box.width * box.height,
          `${lane.name} frame ${index} ralo`,
        ).toBeGreaterThanOrEqual(unionArea * 0.3);
      });
    }
  });

  it("anima: cada linha tem quadros distintos", () => {
    for (const lane of lanes()) {
      const prints = new Set();

      for (let column = 0; column < lane.length; column += 1) {
        prints.add(cellAt(column, lane.row).join(","));
      }

      expect(
        prints.size,
        `${lane.name} tem ${prints.size} quadros distintos de ${lane.length}`,
      ).toBeGreaterThanOrEqual(6);
    }
  });

  it("alinha os pes entre as linhas", () => {
    const medians = lanes().map((lane) => {
      const bottoms = [];

      for (let column = 0; column < lane.length; column += 1) {
        bottoms.push(boxOf(cellAt(column, lane.row)).maxY);
      }

      bottoms.sort((a, b) => a - b);

      return bottoms[Math.floor(bottoms.length / 2)];
    });

    const spread = Math.max(...medians) - Math.min(...medians);

    /**
     * A MEDIANA do pe, e nao o maximo.
     *
     * E o que o `alignAnchors` alinha de verdade. O maximo diverge
     * entre as linhas porque o desenho de frente e o de costas tem
     * alturas diferentes entre os quadros, e o pe "anda" dentro do
     * quadro. Comparar o maximo reprovaria uma folha alinhada
     */
    expect(
      spread,
      `medianas de pe: ${medians.join(",")}`,
    ).toBeLessThanOrEqual(2);
  });

  it("a linha do sul e a arte de frente, e nao a de lado", () => {
    /**
     * O que a escolha do `walkFallback` comprou, e o que ela custou.
     *
     * A arte de PARADO de frente e ESTREITA — o rato olhando para a
     * camera mostra so o corpo — enquanto as direcoes de lado mostram
     * o comprimento inteiro. Este teste trava que a linha do sul e a
     * estreita: e ela que mantem o rato olhando na direcao do jogador
     * ao descer, ao custo das patas nao mexerem
     *
     * Se o sul virar arte de lado, o rato anda na diagonal descendo, e
     * essa e a direcao mais vista do jogo
     */
    const larguraDoSul = Math.max(
      ...Array.from(
        { length: RATO_DA_TOCA_SPRITE.animations.walk.length },
        (_, column) =>
          boxOf(cellAt(column, SUL)).width,
      ),
    );

    const larguraDoLeste = Math.max(
      ...Array.from(
        { length: RATO_DA_TOCA_SPRITE.animations.walk.length },
        (_, column) =>
          boxOf(
            cellAt(column, RATO_DA_TOCA_SPRITE.directions.east),
          ).width,
      ),
    );

    // de frente e visivelmente mais estreito que de lado
    expect(
      larguraDoSul,
      `sul ${larguraDoSul} contra leste ${larguraDoLeste}`,
    ).toBeLessThan(larguraDoLeste);

    // e o sul e a MESMA arte do idle, quadro a quadro: a substituicao
    // veio do `idle.gif`, e nao de uma vizinha qualquer
    for (let column = 0; column < COLUMNS; column += 1) {
      expect(
        cellAt(column, SUL).join(","),
        `sul quadro ${column} nao e a arte do idle`,
      ).toBe(cellAt(column, IDLE_ROW).join(","));
    }
  });
});