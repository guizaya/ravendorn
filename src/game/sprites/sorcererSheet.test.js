import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SORCERER_DIRECTIONS,
  SORCERER_SPRITE,
} from "../../data/sprites/index.js";
import { inflatePng } from "../../../tools/gif-to-sheet.mjs";
import { DIRECTION_KEYS } from "./animation.js";

const SHEET = fileURLToPath(
  new URL(
    "../../assets/sprites/sorcerer-sheet.png",
    import.meta.url,
  ),
);

const CELL = 68;
const IDLE_ROW = SORCERER_SPRITE.animations.idle.row;
const ROWS = DIRECTION_KEYS.length + 1;
const COLUMNS = Math.max(
  ...Object.values(SORCERER_SPRITE.animations).map(
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

const rowOf = (key) => SORCERER_DIRECTIONS[key];

function lanes() {
  const list = DIRECTION_KEYS.map((key) => ({
    name: `walk ${key}`,
    row: SORCERER_DIRECTIONS[key],
    length: SORCERER_SPRITE.animations.walk.length,
  }));

  list.push({
    name: "idle",
    row: IDLE_ROW,
    length: SORCERER_SPRITE.animations.idle.length,
  });

  return list;
}

const cells = lanes().flatMap((lane) =>
  Array.from({ length: lane.length }, (_, column) => ({
    label: `${lane.name} frame ${column}`,
    box: boxOf(cellAt(column, lane.row)),
  })),
);

function unionOfIdle() {
  const boxes = lanes()
    .filter((lane) => lane.name === "idle")
    .flatMap((lane) =>
      Array.from({ length: lane.length }, (_, column) =>
        boxOf(cellAt(column, lane.row)),
      ),
    );

  return {
    x: Math.min(...boxes.map((box) => box.minX)),
    y: Math.min(...boxes.map((box) => box.minY)),
    width:
      Math.max(...boxes.map((box) => box.maxX)) -
      Math.min(...boxes.map((box) => box.minX)) +
      1,
    height:
      Math.max(...boxes.map((box) => box.maxY)) -
      Math.min(...boxes.map((box) => box.minY)) +
      1,
  };
}

describe("sorcerer sheet asset", () => {
  it("tem uma linha por direcao de andar, mais o idle, e nada de golpe", () => {
    // 8 linhas de direcao + 1 de idle. Sao 9, e nao as 17 do
    // arquiro/guerreiro: as 8 de golpe nao existem, porque a arte de
    // origem nao tem
    expect(sheet.width).toBe(CELL * COLUMNS);
    expect(sheet.height).toBe(CELL * ROWS);
    expect(COLUMNS).toBe(8);
    expect(IDLE_ROW).toBe(8);
    expect(ROWS).toBe(9);
  });

  it("tem uma linha para cada direcao", () => {
    expect(Object.keys(SORCERER_DIRECTIONS).sort()).toEqual(
      DIRECTION_KEYS.slice().sort(),
    );

    for (const key of DIRECTION_KEYS) {
      expect(rowOf(key), key).toBeGreaterThanOrEqual(0);
      expect(rowOf(key), key).toBeLessThan(IDLE_ROW);
    }
  });

  it("tem 8 linhas de direcao distintas", () => {
    const walkRows = DIRECTION_KEYS.map(rowOf);

    expect(new Set(walkRows).size).toBe(8);

    for (const row of walkRows) {
      expect(row, `linha ${row}`).not.toBe(IDLE_ROW);
    }
  });

  it("declara o golpe como o proprio idle, ate existir arte de ataque", () => {
    // O que o usuario pediu enquanto o sorcerer nao tem arte de
    // ataque: parado em idle enquanto ataca. O `attack` NAO e um bloco
    // novo com linha de golpe — ele e o idle, linha e quadros
    // iguais. E o que trava essa decisao aqui: se um dia o `attack`
    // apontar para outra linha, o game engine tem que ganhar arte de
    // golpe antes
    expect(SORCERER_SPRITE.animations.attack).toEqual(
      SORCERER_SPRITE.animations.idle,
    );

    // e a linha precisa ser a do idle de verdade, a 8, e nao a 0 (que
    // e a caminhada para leste)
    expect(SORCERER_SPRITE.animations.attack.row).toBe(IDLE_ROW);

    // sem `rowOffset`: com ele, o desenho leria `rowOffset + direcao`
    // e o "golpe" viraria caminhada virada para o lado
    expect(
      SORCERER_SPRITE.animations.attack.rowOffset,
    ).toBe(undefined);
  });

  it("casa com a definicao que o motor desenha", () => {
    expect(SORCERER_SPRITE.frameWidth).toBe(CELL);
    expect(SORCERER_SPRITE.frameHeight).toBe(CELL);

    // a ancora medida pela folha: (33, 56). Um `anchorY` de 54, o do
    // arquiro, colocaria o sorcerer 2px fora do chao
    expect(SORCERER_SPRITE.anchorX).toBe(33);
    expect(SORCERER_SPRITE.anchorY).toBe(56);

    for (const animation of Object.values(
      SORCERER_SPRITE.animations,
    )) {
      expect(animation.start).toBe(0);
      expect(animation.fps).toBeGreaterThan(0);
      expect(animation.length).toBeGreaterThan(0);
      expect(animation.length).toBeLessThanOrEqual(COLUMNS);
    }
  });

  it("desenha um personagem inteiro em cada celula usada", () => {
    for (const { label, box } of cells) {
      expect(box.count, `${label} vazia`).toBeGreaterThan(200);
      expect(box.height, `${label} baixa demais`).toBeGreaterThan(30);
      expect(box.width, `${label} estreita demais`).toBeGreaterThan(16);
    }
  });

  it("mantem o personagem dentro da propria celula", () => {
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
        // para nas primeiras linhas da celula
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

      // todos os oito quadros sao distintos: o idle do sorcerer e uma
      // arte desenhada, nao um frame congelado
      expect(
        prints.size,
        `${lane.name} tem ${prints.size} quadros distintos de ${lane.length}`,
      ).toBe(8);
    }
  });

  it("alinha os pes entre as linhas para virar e parar nao pular", () => {
    const medians = lanes().map((lane) => {
      const bottoms = [];

      for (let column = 0; column < lane.length; column += 1) {
        bottoms.push(boxOf(cellAt(column, lane.row)).maxY);
      }

      bottoms.sort((a, b) => a - b);

      return bottoms[Math.floor(bottoms.length / 2)];
    });

    const spread = Math.max(...medians) - Math.min(...medians);

    expect(
      spread,
      `medianas de pe: ${medians.join(",")}`,
    ).toBeLessThanOrEqual(2);
  });

  it("alinha o corpo na horizontal entre as linhas", () => {
    const medians = lanes().map((lane) => {
      const centers = [];

      for (let column = 0; column < lane.length; column += 1) {
        const box = boxOf(cellAt(column, lane.row));

        centers.push((box.minX + box.maxX) / 2);
      }

      centers.sort((a, b) => a - b);

      return centers[Math.floor(centers.length / 2)];
    });

    const spread = Math.max(...medians) - Math.min(...medians);

    expect(
      spread,
      `centros: ${medians.join(",")}`,
    ).toBeLessThanOrEqual(2);
  });

  it("declara a contentBox como a uniao do idle inteiro", () => {
    // O `contentBox` e o que faz o retrato da tela de selecao
    // preencher o quadrado com o PERSONAGEM, e nao com a margem
    // transparente. Ele tem de cobrir o idle INTEIRO, os oito
    // quadros: o cajado entra e sai de lado a lado, e uma caixa
    // medida num quadro estreito cortaria o cajado pela metade
    expect(SORCERER_SPRITE.contentBox).toEqual(unionOfIdle());
  });
});