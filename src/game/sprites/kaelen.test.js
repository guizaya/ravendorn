import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getEnemySprite } from "../../data/sprites/enemies.js";
import { inflatePng } from "../../../tools/gif-to-sheet.mjs";
import {
  DIRECTION_KEYS,
  resolveCreatureAnimation,
  resolveFrameRect,
} from "../sprites/animation.js";

/**
 * A folha da SENTINELA ESQUELETICA no disco, e o que o motor faz com
 * uma criatura que ATACA sem ter arte de golpe.
 *
 * A geracao ja e conferida em `tools/sentinelaEsqueleticaSheet.test.js`.
 * Este arquivo olha para o PNG ja escrito, que e outra coisa: o
 * primeiro confere o que a ferramenta decidiu, e este confere o que foi
 * gravado
 *
 * A definicao vem por `getEnemySprite("skeleton")`, e nao importada
 * direto do `enemyLayout`: e assim que o `GameEngine` pede, e por isso
 * o teste passa pelo mesmo caminho
 */

const SENTINELA = getEnemySprite("skeleton");

const CELL = SENTINELA.frameWidth;
const IDLE_ROW = SENTINELA.animations.idle.row;
const SHOOT_ROW = SENTINELA.animations.attack.row;
const COLUMNS = Math.max(
  ...Object.values(SENTINELA.animations).map(
    (animation) => animation.length,
  ),
);

const SHEET = fileURLToPath(
  new URL(
    "../../assets/sprites/sentinela_esqueletica-sheet.png",
    import.meta.url,
  ),
);

const sheet = inflatePng(readFileSync(SHEET));

function cellAt(column, row) {
  const pixels = [];

  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const index =
        ((row * CELL + y) * sheet.width + column * CELL + x) * 4;

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

const lanes = () => [
  ...DIRECTION_KEYS.map((key) => ({
    name: `walk ${key}`,
    row: SENTINELA.directions[key],
    length: SENTINELA.animations.walk.length,
  })),
  {
    name: "idle",
    row: IDLE_ROW,
    length: SENTINELA.animations.idle.length,
  },
];

const cells = lanes().flatMap((lane) =>
  Array.from({ length: lane.length }, (_, column) => ({
    label: `${lane.name} frame ${column}`,
    box: boxOf(cellAt(column, lane.row)),
  })),
);

/** o retangulo que o desenho mostraria para esta criatura */
function retangulo(animacao, elapsed, facing) {
  return resolveFrameRect(
    SENTINELA,
    animacao,
    elapsed,
    facing,
  );
}

describe("a folha da sentinela esqueletica", () => {
  it("o motor acha a folha pelo id `skeleton`", () => {
    expect(SENTINELA, "a sentinela nao tem sprite").toBeTruthy();
    expect(SENTINELA.id).toBe("skeleton");
    expect(SENTINELA.format).toBe("directional");
    expect(SENTINELA.frameWidth).toBe(68);
    expect(SENTINELA.frameHeight).toBe(68);

    // a imagem e a folha nova, e nao a `enemies/skeleton.png` de 32px.
    // Uma URL quebrada aqui daria 404 no navegador e a sentinela
    // sumiria sem erro no console
    expect(SENTINELA.src).toContain(
      "sentinela_esqueletica-sheet.png",
    );
  });

  it("tem uma linha por direcao, o idle na 8 e o golpe na 9", () => {
    expect(sheet.width).toBe(CELL * COLUMNS);

    /**
     * A FOLHA tem 17 linhas: 8 de caminhada, 1 de idle e 8 de golpe.
     *
     * A altura vinha sendo `direcoes + 1`, que e o que a folha tinha
     * quando o `shoot/` ainda nao existia. Com a arte de arco em todas
     * as direcoes, a conta e `direcoes + 1 + direcoes`
     */
    expect(sheet.height).toBe(CELL * (DIRECTION_KEYS.length * 2 + 1));
    expect(COLUMNS).toBe(9);
    expect(IDLE_ROW).toBe(8);
    expect(SHOOT_ROW).toBe(9);

    for (const key of DIRECTION_KEYS) {
      expect(
        SENTINELA.directions[key],
        key,
      ).toBeGreaterThanOrEqual(0);

      expect(
        SENTINELA.directions[key],
        key,
      ).toBeLessThan(IDLE_ROW);
    }

    expect(
      new Set(Object.values(SENTINELA.directions)).size,
    ).toBe(DIRECTION_KEYS.length);
  });

  it("casa com a definicao que o motor desenha", () => {
    expect(SENTINELA.anchorX).toBe(33.5);
    expect(SENTINELA.anchorY).toBe(54);

    for (const animation of Object.values(SENTINELA.animations)) {
      expect(animation.start).toBe(0);
      expect(animation.fps).toBeGreaterThan(0);
      expect(animation.length).toBeGreaterThan(0);
      expect(animation.length).toBeLessThanOrEqual(COLUMNS);
    }
  });

  it("o idle tem `row`, e nao `rowOffset`", () => {
    // sem o `row` o `resolveFrameRect` usaria `rowOffset ?? 0` e leria
    // a linha 0, que e a caminhada para leste, e a sentinela parada
    // viraria de lado
    expect(SENTINELA.animations.idle.row).toBe(IDLE_ROW);
    expect(SENTINELA.animations.idle.rowOffset).toBeUndefined();
  });

  it("desenha um esqueleto inteiro em cada celula usada", () => {
    for (const { label, box } of cells) {
      expect(box.count, `${label} vazia`).toBeGreaterThan(200);
      expect(box.height, `${label} baixa demais`).toBeGreaterThan(30);
      expect(box.width, `${label} estreita demais`).toBeGreaterThan(16);
    }
  });

  it("mantem o esqueleto dentro da propria celula", () => {
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

    // a MEDIANA, e nao o maximo: e o que o `alignAnchors` alinha de
    // verdade. O maximo diverge porque o desenho de frente e o de
    // costas tem alturas diferentes entre os quadros
    expect(
      spread,
      `medianas de pe: ${medians.join(",")}`,
    ).toBeLessThanOrEqual(2);
  });
});

describe("a sentinela esqueletica: o desenho", () => {
  it("cada direcao pega a linha dela", () => {
    const para = {
      east: { x: 1, y: 0 },
      "south-east": { x: 1, y: 1 },
      south: { x: 0, y: 1 },
      "south-west": { x: -1, y: 1 },
      west: { x: -1, y: 0 },
      "north-west": { x: -1, y: -1 },
      north: { x: 0, y: -1 },
      "north-east": { x: 1, y: -1 },
    };

    for (const [direcao, facing] of Object.entries(para)) {
      expect(
        retangulo("walk", 0, facing).y,
        direcao,
      ).toBe(SENTINELA.directions[direcao] * CELL);
    }
  });

  it("nunca espelha, porque cada direcao tem a linha dela", () => {
    // antes a sentinela usava a folha de 3 linhas e ESPELHAVA ao
    // virar para oeste. No formato direcional o oeste e uma LINHA
    for (const facing of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      expect(
        retangulo("walk", 0, facing).flip,
        `${facing.x},${facing.y}`,
      ).toBe(false);
    }
  });

  it("andar e parado usam linhas diferentes", () => {
    const parado = retangulo("idle", 0, { x: 0, y: 1 });
    const andando = retangulo("walk", 0, { x: 0, y: 1 });

    expect(parado.y).toBe(IDLE_ROW * CELL);
    expect(andando.y).toBe(
      SENTINELA.directions.south * CELL,
    );
  });

  it("o idle e a caminhada animam", () => {
    const colunas = (animacao) => {
      const vistas = new Set();

      for (let passo = 0; passo < 40; passo += 1) {
        vistas.add(
          retangulo(animacao, passo / 8, { x: 0, y: 1 }).x,
        );
      }

      return vistas.size;
    };

    expect(colunas("idle")).toBeGreaterThan(1);
    expect(colunas("walk")).toBeGreaterThan(1);
  });

  it("caminhar, perseguir e o repouso", () => {
    // `chase` esta na lista de estados que contam como andando. A
    // sentinela e `ACTIVE` e persegue o jogador, entao a caminhada e o
    // estado normal dela durante a briga
    for (const aiState of ["chase", "wander", "retreat"]) {
      const mob = {
        aiState,
        attackAnimation: 0,
        hitFlash: 0,
        facing: { x: 1, y: 0 },
      };

      expect(resolveCreatureAnimation(mob), aiState).toBe("walk");
    }

    const parado = {
      aiState: "idle",
      attackAnimation: 0,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(parado)).toBe("idle");
  });
});

describe("a sentinela esqueletica: o golpe", () => {
  it("declara o golpe na LINHA DELE, e nao na do idle", () => {
    /**
     * O `attack` aponta para a linha 9, a do `shoot/`.
     *
     * Antes ele apontava para a linha 8 — o idle — porque a pasta nao
     * tinha arte de arco e o golpe caia no reserva do `resolveFrameRect`.
     * A sentinela atirava na pose de parado
     *
     * O `needsTarget` continua valendo, e e o que faz o esqueleto virar
     * para o alvo no instante do arco: sem alvo declarado o
     * `resolveFrameRect` aceitaria a arte virada para o lado
     */
    expect(
      SENTINELA.animations.attack,
      "a sentinela atiradora precisa declarar a linha do golpe",
    ).toBeDefined();

    expect(SENTINELA.animations.attack.row).toBe(SHOOT_ROW);

    // e a linha e DELE: reusar a do idle faria a animacao nunca aparecer
    expect(SENTINELA.animations.attack.row).not.toBe(IDLE_ROW);

    expect(SENTINELA.animations.attack.needsTarget).toBe(true);
  });

  it("a pasta tem arte de arco nas oito direcoes", () => {
    /**
     * O QUE O TESTE DE CIMA ESTA DESCARTANDO.
     *
     * Se a arte de arco sumisse de novo, a linha do `attack` iria para 8
     * e este teste avisa. Sem ele, apontar a animacao para a linha errada
     * nao daria erro nenhum — a folha geraria do mesmo jeito e o golpe
     * voltaria a ser o idle em silencio
     */
    expect(
      SENTINELA.animations.attack.row,
      "a linha do golpe voltou a ser a do idle: a arte de arco sumiu?",
    ).toBe(SHOOT_ROW);

    // e a folha tem de ter as 17 linhas, e nao 9
    expect(sheet.height).toBe(CELL * 17);
  });

  it("pedir golpe cai na arte de arco, e nao numa caminhada", () => {
    /**
     * A ordem do reserva do `resolveFrameRect` e `idle` antes de
     * `walk`. Um pedido de golpe que caísse no `walk` poria o
     * esqueleto andando no meio da pancada, com as pernas mexendo
     *
     * Este e o mesmo teste do ghoul, e ele continua valendo para a
     * sentinela — so que aqui a diferenca e VISIVEL, porque a
     * sentinela ataca o tempo todo
     */
    const sentinela = {
      aiState: "attack",
      attackAnimation: 0.2,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(sentinela)).toBe("attack");

    const pedido = retangulo(
      resolveCreatureAnimation(sentinela),
      0,
      sentinela.facing,
    );

    const parado = retangulo("idle", 0, sentinela.facing);
    const andando = retangulo("walk", 0, sentinela.facing);

    /**
     * O GOLPE E A ARTE DE ARCO, e nao o idle nem a caminhada.
     *
     * Este teste afirmava `pedido === parado`, e era o defeito travado
     * em forma de teste: sem arte de arco, o golpe caia no reserva do
     * `resolveFrameRect` e sair igual ao idle era o comportamento
     * "correto". Com a arte de `shoot/` na linha 9, acertar o golpe
     * com o idle seria a REGRESSAO
     */
    expect(pedido).not.toEqual(parado);
    expect(pedido).not.toEqual(andando);
    expect(pedido.y).toBe(SHOOT_ROW * CELL);
  });

  it("o golpe usa a linha de arco, e a caminhada e a da direcao", () => {
    /**
     * A consequencia de cair no idle: a linha do golpe e sempre a 8,
     * a arte de frente, e nao a linha da direcao que a criatura esta
     * olhando. Este teste deixa isso EXPLICITO em vez de escondido
     * atras do "cai no idle"
     *
     * E o custo conhecido desta decisao, e nao um acidente. Quando a
     * arte de golpe chegar, e so declarar `attack` com a linha e a
     * contagem, e este teste passa a valer para o golpe de verdade
     */
    const paraLeste = { x: 1, y: 0 };

    const noGolpe = retangulo("attack", 0, paraLeste);
    const andando = retangulo("walk", 0, paraLeste);

    // andando para o leste, a caminhada e a linha 0
    expect(andando.y).toBe(SENTINELA.directions.east * CELL);

    // no golpe, e a linha do `shoot/`, que tambem nao depende da direcao
    expect(noGolpe.y).toBe(SHOOT_ROW * CELL);
    expect(noGolpe.y).not.toBe(andando.y);
  });

  it("o golpe para nos 0.22s, e a arte volta a andar depois", () => {
    // sem arte de golpe a janela de animacao continua valendo: o
    // `attackAnimation` do mob e um relogio, e ele SOME na mesma medida
    // para qualquer criatura. O que muda e so o que se desenha dentro
    // da janela
    const sentinela = {
      aiState: "chase",
      attackAnimation: 0.22,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(sentinela)).toBe("attack");

    // e depois da janela, a caminhada volta
    sentinela.attackAnimation = 0;

    expect(resolveCreatureAnimation(sentinela)).toBe("walk");
  });

  it("levar dano tambem cai no idle, e nao numa caminhada", () => {
    // o `hurt` nao existe nesta arte nem na de nenhuma outra criatura.
    // O pedido cai no mesmo reserva, e um esqueleto andando enquanto
    // leva um golpe pareceria que ele nao sentiu nada
    const machucado = {
      aiState: "chase",
      attackAnimation: 0,
      hitFlash: 0.18,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(machucado)).toBe("hurt");

    const pedido = retangulo(
      resolveCreatureAnimation(machucado),
      0,
      machucado.facing,
    );

    expect(pedido).toEqual(
      retangulo("idle", 0, machucado.facing),
    );

    expect(pedido).not.toEqual(
      retangulo("walk", 0, machucado.facing),
    );
  });
});