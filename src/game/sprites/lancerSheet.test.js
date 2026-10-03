import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LANCER_DIRECTIONS,
  LANCER_SPRITE,
} from "../../data/sprites/index.js";
import { inflatePng } from "../../../tools/gif-to-sheet.mjs";
import { DIRECTION_KEYS } from "./animation.js";

const SHEET = fileURLToPath(
  new URL(
    "../../assets/sprites/lancer-sheet.png",
    import.meta.url,
  ),
);

const CELL = 68;
const IDLE_ROW = LANCER_SPRITE.animations.idle.row;
const ROWS = DIRECTION_KEYS.length + 1;
const COLUMNS = Math.max(
  ...Object.values(LANCER_SPRITE.animations).map(
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

const rowOf = (key) => LANCER_DIRECTIONS[key];

function lanes() {
  const list = DIRECTION_KEYS.map((key) => ({
    name: `walk ${key}`,
    row: LANCER_DIRECTIONS[key],
    length: LANCER_SPRITE.animations.walk.length,
  }));

  list.push({
    name: "idle",
    row: IDLE_ROW,
    length: LANCER_SPRITE.animations.idle.length,
  });

  return list;
}

const cells = lanes().flatMap((lane) =>
  Array.from({ length: lane.length }, (_, column) => ({
    label: `${lane.name} frame ${column}`,
    box: boxOf(cellAt(column, lane.row)),
  })),
);

function idleUnion() {
  const boxes = Array.from(
    { length: LANCER_SPRITE.animations.idle.length },
    (_, column) => boxOf(cellAt(column, IDLE_ROW)),
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

describe("lancer sheet asset", () => {
  it("tem uma linha por direcao de andar, mais o idle, e nada de golpe", () => {
    expect(sheet.width).toBe(CELL * COLUMNS);
    expect(sheet.height).toBe(CELL * ROWS);
    expect(COLUMNS).toBe(8);
    expect(IDLE_ROW).toBe(8);
    expect(ROWS).toBe(9);
  });

  it("tem uma linha para cada direcao", () => {
    expect(Object.keys(LANCER_DIRECTIONS).sort()).toEqual(
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
    // Enquanto o lancer nao tiver arte de golpe, o `attack` NAO e um
    // bloco com linha nova: ele e o idle, linha e quadros iguais. E o
    // que trava a decisao — se um dia o `attack` apontar para outra
    // linha, o game engine tem que ganhar a arte antes
    expect(LANCER_SPRITE.animations.attack).toEqual(
      LANCER_SPRITE.animations.idle,
    );

    expect(LANCER_SPRITE.animations.attack.row).toBe(IDLE_ROW);

    // sem `rowOffset`: com ele, o desenho leria `rowOffset + direcao`
    // e o "golpe" viraria caminhada virada para o lado
    expect(LANCER_SPRITE.animations.attack.rowOffset).toBe(undefined);
  });

  it("casa com a definicao que o motor desenha", () => {
    expect(LANCER_SPRITE.frameWidth).toBe(CELL);
    expect(LANCER_SPRITE.frameHeight).toBe(CELL);

    // a ancora medida pela folha: (33.5, 53). O `anchorY` do sorcerer
    // e 56, e copiar o dele colocaria o lancer 3px fora do chao em
    // relacao as outras classes
    expect(LANCER_SPRITE.anchorX).toBe(33.5);
    expect(LANCER_SPRITE.anchorY).toBe(53);

    for (const animation of Object.values(
      LANCER_SPRITE.animations,
    )) {
      expect(animation.start).toBe(0);
      expect(animation.fps).toBeGreaterThan(0);
      expect(animation.length).toBeGreaterThan(0);
      expect(animation.length).toBeLessThanOrEqual(COLUMNS);
    }
  });

  it("desenha um personagem inteiro em cada celula usada", () => {
    // o lancer e mais MAGRO que o sorcerer: a lanca entra de lado a
    // lado, e o corpo ocupa menos pixels. O minimo e 400, e nao os
    // 200 do arquiro, porque a arte dele tem menos area opaca
    for (const { label, box } of cells) {
      expect(box.count, `${label} vazia`).toBeGreaterThan(400);
      expect(box.height, `${label} baixa demais`).toBeGreaterThan(30);
      expect(box.width, `${label} estreita demais`).toBeGreaterThan(16);
    }
  });

  it("mantem o personagem dentro da propria celula", () => {
    for (const { label, box } of cells) {
      expect(box.minX, `${label} encosta na esquerda`).toBeGreaterThan(0);
      expect(box.maxX, `${label} encosta na direita`).toBeLessThan(CELL - 1);
      expect(box.minY, `${label} encosta no topo`).toBeGreaterThan(0);
      expect(box.maxY, `${label} encosta na base`).toBeLessThan(CELL - 1);
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

      // todos os oito quadros sao distintos: o idle do lancer e uma
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

    // a arte do lancer alinha melhor que a do sorcerer, que ficou em
    // 2px: aqui a dispersao real e de 1px
    expect(
      spread,
      `medianas de pe: ${medians.join(",")}`,
    ).toBeLessThanOrEqual(1);
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

    // a lanca muda de lado entre as direcoes e o desenho fica 3px
    // mais largo; o limite e o que a propria folha mediu
    expect(
      spread,
      `centros: ${medians.join(",")}`,
    ).toBeLessThanOrEqual(3);
  });

  it("declara a contentBox como a uniao do idle inteiro", () => {
    // O `contentBox` e o que faz o retrato da tela de selecao
    // preencher o quadrado com o PERSONAGEM, e nao com a margem
    // transparente. Ele cobre o idle INTEIRO: o quadro 1 chega em
    // x=57 e o 6 para em x=55, e uma caixa medida num unico quadro
    // cortaria a lanca pela metade
    expect(LANCER_SPRITE.contentBox).toEqual(idleUnion());
  });
});