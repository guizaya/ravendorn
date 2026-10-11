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
 * A folha do KAELEN no disco, e o que o motor faz com ele.
 *
 * A geracao ja e conferida pelo proprio log da ferramenta. Este arquivo
 * olha para o PNG ja escrito, que e outra coisa: o log confere o que a
 * ferramenta decidiu, e este o que foi gravado
 *
 * A definicao vem por `getEnemySprite("skeleton")`, e nao importada
 * direto do `enemyLayout`: e assim que o `GameEngine` pede, e por isso
 * o teste passa pelo mesmo caminho
 *
 * ## POR QUE O ID CONTINUA `skeleton`
 *
 * Porque ele e a chave do save, das tres cacadas de bestiario e das duas
 * entregas de colecao. O nome na tela virou Kaelen; o id nao
 */

const KAELEN = getEnemySprite("skeleton");

const CELL = KAELEN.frameWidth;

/**
 * O idle e POR DIRECAO, entao o que este teste le e o INICIO DO BLOCO.
 *
 * A folha do Kaelen tem 25 linhas — 8 de walk, 8 de idle, 8 de attack e 1
 * de morte — e o idle ocupa as linhas 8 a 15, uma por angulo. O
 * `rowOffset` do layout e 8, e a linha real sai de somar a direcao
 */
const IDLE_ROW = KAELEN.animations.idle.rowOffset;

const ATTACK_ROW = KAELEN.animations.attack.rowOffset;

const DEATH_ROW = KAELEN.animations.death.row;

/**
 * A LINHA REAL DE UM ANGULO, dentro de um bloco de 8.
 *
 * E o mesmo calculo que o `resolveFrameRect` faz: `rowOffset` mais a
 * posicao do angulo no `directions`. Usar a conta aqui evita o teste
 * reimplementar a regra do motor e passar enquanto o motor le outra coisa
 */
const linhaDe = (rowOffset, key) => rowOffset + KAELEN.directions[key];

const COLUMNS = Math.max(
  ...Object.values(KAELEN.animations).map(
    (animation) => animation.length,
  ),
);

const SHEET = fileURLToPath(
  new URL(
    "../../assets/sprites/kaelen-sheet.png",
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
    row: KAELEN.directions[key],
    length: KAELEN.animations.walk.length,
  })),
  ...DIRECTION_KEYS.map((key) => ({
    name: `idle ${key}`,
    row: linhaDe(IDLE_ROW, key),
    length: KAELEN.animations.idle.length,
  })),
];

/**
 * A LANE DA MORTE, e ela e uma SO.
 *
 * A arte veio so do sul, entao a morte ocupa a linha 24 e nao tem
 * direcao. Ela fica de fora de `lanes()` porque o `alinha os pes` nao
 * pode ser aplicado nela: o cadaver termina DEITADO, e o pe dele e o
 * chao — nao o mesmo pe de quem esta em pe
 */
const laneMorte = () => ({
  name: "death",
  row: DEATH_ROW,
  length: KAELEN.animations.death.length,
});

const cells = lanes().flatMap((lane) =>
  Array.from({ length: lane.length }, (_, column) => ({
    label: `${lane.name} frame ${column}`,
    box: boxOf(cellAt(column, lane.row)),
  })),
);

/** o retangulo que o desenho mostraria para esta criatura */
function retangulo(animacao, elapsed, facing) {
  return resolveFrameRect(
    KAELEN,
    animacao,
    elapsed,
    facing,
  );
}

/**
 * A folha do KAELEN no disco, e o que o motor faz com uma criatura que
 * ataca sem ter arte de golpe.
 *
 * A geracao ja e conferida em `tools/goblinSaqueadorSheet.test.js` e no
 * proprio log da ferramenta. Este arquivo olha para o PNG ja escrito, que e
 * outra coisa: o primeiro confere o que a ferramenta decidiu, e este o que
 * foi gravado
 *
 * A definicao vem por `getEnemySprite("skeleton")`, e nao importada direto
 * do `enemyLayout`: e assim que o `GameEngine` pede, e por isso o teste
 * passa pelo mesmo caminho
 *
 * ## POR QUE O ID CONTINUA `skeleton`
 *
 * Porque ele e a chave do save, das tres cacadas de bestiario e das duas
 * entregas de colecao. O nome na tela virou Kaelen, o id nao
 */
describe("a folha do Kaelen", () => {
  it("o motor acha a folha pelo id `skeleton`", () => {
    expect(KAELEN, "o Kaelen nao tem sprite").toBeTruthy();
    expect(KAELEN.id).toBe("skeleton");
    expect(KAELEN.format).toBe("directional");

    // A celula subiu de 68 para 88: a arte veio misturada, com quatro
    // angulos em 88x88 e quatro em 84x84, e a celula tem que ser a
    // MAIOR para nao cortar pixel
    expect(KAELEN.frameWidth).toBe(88);
    expect(KAELEN.frameHeight).toBe(88);

    // a imagem e a folha nova. uma URL quebrada aqui daria 404 no
    // navegador e o Kaelen sumiria sem erro no console
    expect(KAELEN.src).toContain("kaelen-sheet.png");
  });

  it("tem 25 linhas: 8 walk, 8 idle, 8 attack e 1 death", () => {
    expect(sheet.width).toBe(CELL * COLUMNS);

    /**
     * A ALTURA E `direcoes * 3 + 1`.
     *
     * Tres ciclos de oito direcoes — walk, idle e attack — mais a linha
     * unica da morte. A folha da Sentinela antiga era `direcoes * 2 + 1`
     * porque o idle dela era uma linha so
     */
    expect(sheet.height).toBe(
      CELL * (DIRECTION_KEYS.length * 3 + 1),
    );

    expect(COLUMNS).toBe(9);
    expect(IDLE_ROW).toBe(8);
    expect(ATTACK_ROW).toBe(16);
    expect(DEATH_ROW).toBe(24);

    // e o mapeamento das direcoes tem as oito entradas distintas
    expect(
      new Set(Object.values(KAELEN.directions)).size,
    ).toBe(DIRECTION_KEYS.length);
  });

  it("casa com a definicao que o motor desenha", () => {
    // a ancora veio do log da folha: pe em y=71, corpo centrado em 42.5
    expect(KAELEN.anchorX).toBe(42.5);
    expect(KAELEN.anchorY).toBe(71);

    for (const animation of Object.values(KAELEN.animations)) {
      expect(animation.start).toBe(0);
      expect(animation.fps).toBeGreaterThan(0);
      expect(animation.length).toBeGreaterThan(0);
      expect(animation.length).toBeLessThanOrEqual(COLUMNS);
    }
  });

  it("o idle e POR DIRECAO, e a morte e por `row`", () => {
    // o idle tem oito linhas de verdade, uma por angulo. Com `row` fixo
    // o Kaelen parado viraria de lado em qualquer posicao do mapa
    expect(KAELEN.animations.idle.rowOffset).toBe(8);
    expect(KAELEN.animations.idle.row).toBeUndefined();

    // e a morte e o oposto: uma linha so, apontada por `row`, porque a
    // arte veio so do sul. Um `rowOffset` leria a linha 25 ou 26, que nao
    // existem, e o cadaver viraria um retangulo vazio
    expect(KAELEN.animations.death.row).toBe(24);
    expect(KAELEN.animations.death.rowOffset).toBeUndefined();

    // e o `holdLast` e o que segura o cadaver no ultimo quadro durante o
    // esmaecimento
    expect(KAELEN.animations.death.holdLast).toBe(true);
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

describe("o Kaelen: o desenho", () => {
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
      ).toBe(KAELEN.directions[direcao] * CELL);
    }
  });

  it("nunca espelha, porque cada direcao tem a linha dela", () => {
    // antes a Sentinela usava a folha de 3 linhas e ESPELHAVA ao
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

  it("o idle tambem e por direcao, e nao uma linha so", () => {
    // Este e o que mudou em relacao a Sentinela: o idle dela era uma
    // linha unica e valia para as oito direcoes. O do Kaelen tem uma
    // linha por angulo, entao o parado olhando para o norte e o parado
    // olhando para o sul sao desenhos DIFERENTES
    const norte = retangulo("idle", 0, { x: 0, y: -1 });
    const sul = retangulo("idle", 0, { x: 0, y: 1 });

    expect(norte.y).not.toBe(sul.y);
    expect(norte.y).toBe(
      linhaDe(IDLE_ROW, "north") * CELL,
    );
    expect(sul.y).toBe(linhaDe(IDLE_ROW, "south") * CELL);
  });

  it("andar e parado usam linhas diferentes", () => {
    const parado = retangulo("idle", 0, { x: 0, y: 1 });
    const andando = retangulo("walk", 0, { x: 0, y: 1 });

    expect(parado.y).toBe(
      linhaDe(IDLE_ROW, "south") * CELL,
    );
    expect(andando.y).toBe(KAELEN.directions.south * CELL);
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
    // `chase` esta na lista de estados que contam como andando. O Kaelen e
    // `ACTIVE` e persegue o jogador, entao a caminhada e o estado normal
    // dele durante a briga
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

describe("o Kaelen: o golpe", () => {
  it("declara o golpe no BLOCO dele, e SEM `needsTarget`", () => {
    /**
     * O `attack` aponta para o bloco que comeca na 16, e por
     * `rowOffset` — sao oito linhas, uma por angulo
     *
     * O `needsTarget` SAIU, e e a mudanca de comportamento do Kaelen: a
     * Sentinela era atiradora, e o `needsTarget: true` existia para que a
     * arte de arco so aparecesse com alvo de verdade. Ele virou corpo a
     * corpo, entao a arte do golpe e o golpe de perto e o
     * `attackAnimation` ja garante que ele bate so quando esta atacando
     */
    expect(
      KAELEN.animations.attack,
      "o Kaelen precisa declarar o golpe",
    ).toBeDefined();

    expect(KAELEN.animations.attack.rowOffset).toBe(16);
    expect(KAELEN.animations.attack.row).toBeUndefined();

    expect(KAELEN.animations.attack.needsTarget).toBeUndefined();
  });

  it("a pasta tem arte de golpe nas oito direcoes", () => {
    /**
     * O QUE O TESTE DE CIMA ESTA DESCARTANDO.
     *
     * Se a arte de golpe sumisse, o `resolveFrameRect` cairia no reserva
     * e o golpe viraria o idle em silencio. A folha ter as 25 linhas e o
     * que prova que os tres blocos de oito e a linha de morte existem
     */
    expect(sheet.height).toBe(CELL * 25);

    // e cada angulo do golpe tem linha propria, dentro do bloco 16..23
    for (const key of DIRECTION_KEYS) {
      const linha = linhaDe(ATTACK_ROW, key);

      expect(linha, key).toBeGreaterThanOrEqual(16);
      expect(linha, key).toBeLessThan(24);
    }
  });

  it("pedir golpe cai na arte de golpe, e nao numa caminhada", () => {
    /**
     * A ordem do reserva do `resolveFrameRect` e `idle` antes de
     * `walk`. Um pedido de golpe que caísse no `walk` poria o Kaelen
     * andando no meio da pancada, com as pernas mexendo
     */
    const kaelen = {
      aiState: "attack",
      attackAnimation: 0.2,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(kaelen)).toBe("attack");

    const pedido = retangulo(
      resolveCreatureAnimation(kaelen),
      0,
      kaelen.facing,
    );

    const parado = retangulo("idle", 0, kaelen.facing);
    const andando = retangulo("walk", 0, kaelen.facing);

    expect(pedido).not.toEqual(parado);
    expect(pedido).not.toEqual(andando);
    expect(pedido.y).toBe(linhaDe(ATTACK_ROW, "east") * CELL);
  });

  it("o golpe segue a direcao, e a caminhada tambem", () => {
    /**
     * O golpe e por `rowOffset`, entao ele tambem vira com o bicho — que e
     * o que o Kaelen corpo a corpo precisa: o golpe sai na direcao que
     * ele esta olhando, e nao numa arte de frente fixa
     */
    const paraLeste = { x: 1, y: 0 };
    const paraNorte = { x: 0, y: -1 };

    const noGolpeLeste = retangulo("attack", 0, paraLeste);
    const noGolpeNorte = retangulo("attack", 0, paraNorte);
    const andando = retangulo("walk", 0, paraLeste);

    expect(noGolpeLeste.y).toBe(linhaDe(ATTACK_ROW, "east") * CELL);
    expect(noGolpeNorte.y).toBe(
      linhaDe(ATTACK_ROW, "north") * CELL,
    );
    expect(noGolpeLeste.y).not.toBe(noGolpeNorte.y);

    // e o golpe nunca cai na caminhada
    expect(noGolpeLeste.y).not.toBe(andando.y);
  });

  it("o golpe para nos 0.22s, e a arte volta a andar depois", () => {
    // a janela de animacao e um relogio do mob: ele SOME na mesma medida
    // para qualquer criatura. O que muda e so o que se desenha dentro
    // da janela
    const kaelen = {
      aiState: "chase",
      attackAnimation: 0.22,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(kaelen)).toBe("attack");

    // e depois da janela, a caminhada volta
    kaelen.attackAnimation = 0;

    expect(resolveCreatureAnimation(kaelen)).toBe("walk");
  });

  it("levar dano tambem cai no idle, e nao numa caminhada", () => {
    // o `hurt` nao existe nesta arte nem na de nenhuma outra criatura.
    // O pedido cai no mesmo reserva, e um Kaelen andando enquanto leva
    // um golpe pareceria que ele nao sentiu nada
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

describe("o Kaelen: a morte", () => {
  it("a linha da morte tem desenho em todos os quadros", () => {
    const lane = laneMorte();

    for (let column = 0; column < lane.length; column += 1) {
      const box = boxOf(cellAt(column, lane.row));

      // o cadaver e DEITADO no ultimo quadro, entao o `count` e o piso
      // justo: o que ele nao pode e sumir
      expect(box.count, `death frame ${column} vazia`).toBeGreaterThan(
        400,
      );
    }
  });

  it("a morte e a MESMA linha nas oito direcoes", () => {
    // a arte veio so do sul. Com `rowOffset` a linha 24 viraria 25 ou 26
    // conforme o angulo, e o desenho leria a parte transparente de baixo
    // da folha — o cadaver viraria um retangulo vazio
    for (const facing of [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
    ]) {
      expect(
        retangulo("death", 0, facing).y,
        `${facing.x},${facing.y}`,
      ).toBe(DEATH_ROW * CELL);
    }
  });

  it("o cadaver chega NO ULTIMO QUADRO e fica la", () => {
    // e o `holdLast` fazendo o trabalho: passados os 9 quadros, o tempo
    // continua crescendo e sem o trava o ciclo recomecaria no quadro 0
    const lane = laneMorte();
    const ultimo = lane.length - 1;

    const antes = retangulo("death", 0.3, { x: 0, y: 1 });
    expect(antes.x).toBeGreaterThan(0);

    // bem depois do fim do ciclo
    const depois = retangulo("death", 5, { x: 0, y: 1 });
    expect(depois.x).toBe(ultimo * CELL);
  });
});