import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import {
  createCreature,
  CREATURE_TYPES,
} from "../../data/enemies/index.js";
import { getEnemySprite } from "../../data/sprites/enemies.js";
import {
  DIRECTION_KEYS,
  resolveCreatureAnimation,
  resolveFrameRect,
} from "../sprites/animation.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

installDomStubs();

/**
 * O RATO DA TOCA: o quinto direcional, e o primeiro PASSIVO com arte.
 *
 * A arte veio em `assets/sprites/urso` — o nome e da arte. As tres
 * coisas que este arquivo trava sao as que a arte dele impôs, e
 * nenhuma delas aparece no codigo:
 *
 * 1. **A linha do SUL e arte de parado.** Sao sete direcoes de
 *    caminhada na pasta e nenhuma `south`. A folha usa o `idle.gif` —
 *    o rato de frente — como a linha do sul, para o bicho olhar na
 *    direcao do jogador ao descer, ao custo das patas nao mexerem
 *
 * 2. **Nao ha `attack` na definicao.** O rato e PASSIVO, com
 *    `aggroRange: 0`: ele foge e nao ataca. Um pedido de "attack" tem
 *    de cair no `idle` e nao na caminhada
 *
 * 3. **O balanco e menor que o do ghoul.** O `amplitude` e a altura
 *    que o sprite sobe a cada passo, e um bicho de 43px nao pode pular
 *    4px: ele sairia do chao mais do que andaria em cima dele
 */
const TIPO = "rat";

const classe = CHARACTER_CLASSES.find(
  (definition) => definition.id === "warrior",
);

function criar() {
  const canvas = createTestCanvas();

  const engine = new GameEngine(
    canvas.element,
    classe,
    () => {},
  );

  engine.setMap(MAP_1);

  return engine;
}

/** um rato a `distancia` do jogador, para o lado pedido */
function spawnar(engine, distancia = 420, lado = "west") {
  const player = engine.world.player;

  const offset = {
    west: { x: -distancia, y: 0 },
    east: { x: distancia, y: 0 },
    north: { x: 0, y: -distancia },
    south: { x: 0, y: distancia },
  }[lado];

  const rato = createCreature(
    TIPO,
    { x: player.x + offset.x, y: player.y + offset.y },
    777,
    CREATURE_TYPES[TIPO].level,
  );

  engine.world.enemies.push(rato);

  return rato;
}

const sprite = () => getEnemySprite(TIPO);

describe("rato da toca: a arte", () => {
  it("usa a folha direcional de 68px, e nao a antiga de 32", () => {
    const def = sprite();

    // a arte antiga era `enemies/rat.png`: 32px, tres linhas (baixo,
    // frente, lado) e sempre virado para o jogador
    expect(def, "o rat nao tem sprite").toBeTruthy();
    expect(def.format).toBe("directional");
    expect(def.frameWidth).toBe(68);
    expect(def.frameHeight).toBe(68);
  });

  it("a imagem aponta para a folha nova", () => {
    // caminho escrito por extenso de proposito: um `new URL` com
    // template literal nao e empacotado pelo Vite, e o sprite some so
    // em producao
    expect(sprite().src).toContain("rato_da_toca-sheet");
  });

  it("tem caminhada nas oito direcoes", () => {
    const def = sprite();
    const walk = def.animations.walk;

    expect(walk.length).toBe(8);

    for (const direcao of DIRECTION_KEYS) {
      expect(
        def.directions[direcao],
        direcao,
      ).toBeGreaterThanOrEqual(0);
    }

    // 8 linhas de caminhada, linhas 0 a 7
    expect(def.directions.east).toBe(0);
    expect(def.directions["north-east"]).toBe(7);
  });

  it("o idle e a LINHA 8, a arte desenhada", () => {
    const def = sprite();
    const idle = def.animations.idle;

    expect(idle.row).toBe(8);
    expect(idle.length).toBe(8);

    // o `row` e obrigatorio: sem ele o `resolveFrameRect` usaria
    // `rowOffset ?? 0` e leria a linha 0, que e a caminhada para
    // leste, e o rato parado viraria de lado
    expect(idle.rowOffset).toBeUndefined();
  });

  it("NAO declara golpe, porque o rato e PASSIVO", () => {
    // o catalogo tem `attackRange` e `damage` no rato, e ele nao ataca:
    // sao os mesmos campos dos outros, e nao porque ele golpeie
    expect(CREATURE_TYPES[TIPO].behavior).toBe("passive");
    expect(CREATURE_TYPES[TIPO].aggroRange).toBe(0);

    expect(sprite().animations.attack).toBeUndefined();
  });

  it("o balanco e pequeno, porque o bicho e pequeno", () => {
    const bob = sprite().walkBob;

    // 4px de amplitude num rato de 43px tiraria ele do chao
    expect(bob.amplitude).toBeLessThanOrEqual(2);
    expect(bob.amplitude).toBeGreaterThan(0);
  });
});

describe("rato da toca: o desenho", () => {
  it("cada direcao pega a linha dela", () => {
    const def = sprite();

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
      const rect = resolveFrameRect(
        def,
        "walk",
        0,
        facing,
      );

      expect(
        rect.y,
        direcao,
      ).toBe(def.directions[direcao] * 68);
    }
  });

  it("andando mostra a caminhada e parado mostra o idle", () => {
    const def = sprite();

    // 8 x 68 = a linha do idle; a caminhada para o sul e a linha 2
    const parado = resolveFrameRect(
      def,
      "idle",
      0,
      { x: 0, y: 1 },
    );

    const andando = resolveFrameRect(
      def,
      "walk",
      0,
      { x: 0, y: 1 },
    );

    expect(parado.y).toBe(8 * 68);
    expect(andando.y).toBe(2 * 68);
  });

  it("pedir golpe cai no idle, e nao numa caminhada", () => {
    /**
     * A `resolveCreatureAnimation` devolve "attack" quando o mob esta
     * atacando. Sem arte de golpe, o `resolveFrameRect` tem de cair no
     * RESERVA, que e o `idle` e nao o `walk`
     *
     * O rato nunca ataca, mas o caminho existe: o `DamageSystem` e
     * compartilhado, e um pedido de golpe que caísse no walk poria o
     * bicho andando no meio de um golpe
     */
    const def = sprite();

    const rato = {
      aiState: "attack",
      attackAnimation: 0.2,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(rato)).toBe("attack");

    const pedido = resolveFrameRect(
      def,
      resolveCreatureAnimation(rato),
      0,
      rato.facing,
    );

    const parado = resolveFrameRect(
      def,
      "idle",
      0,
      rato.facing,
    );

    const andando = resolveFrameRect(
      def,
      "walk",
      0,
      rato.facing,
    );

    expect(pedido).toEqual(parado);
    expect(pedido).not.toEqual(andando);
  });

  it("vagar e andar, e o repouso e o idle", () => {
    /**
     * `wander` esta na lista de estados que contam como andando. Sem
     * ele o rato ficaria no idle durante a passe whole: ele e
     * PASSIVO e passeia o mapa, entao a caminhada e o estado normal
     * dele, nao a excecao
     */
    const def = sprite();

    const vagando = {
      aiState: "wander",
      attackAnimation: 0,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(vagando)).toBe("walk");

    const parado = {
      ...vagando,
      aiState: "idle",
    };

    expect(resolveCreatureAnimation(parado)).toBe("idle");
  });

  it("o idle tem varios quadros, e nao um congelado", () => {
    const def = sprite();
    const colunas = new Set();

    for (let passo = 0; passo < 40; passo += 1) {
      colunas.add(
        resolveFrameRect(
          def,
          "idle",
          passo / 8,
          { x: 0, y: 1 },
        ).x,
      );
    }

    expect(def.animations.idle.length).toBeGreaterThan(1);
    expect(colunas.size).toBeGreaterThan(1);
  });

  it("a caminhada tambem anima nas oito direcoes", () => {
    const def = sprite();

    for (const direcao of DIRECTION_KEYS) {
      const colunas = new Set();

      for (let passo = 0; passo < 40; passo += 1) {
        colunas.add(
          resolveFrameRect(
            def,
            "walk",
            passo / 8,
            { x: 0, y: 1 },
          ).x,
        );
      }

      expect(
        colunas.size,
        `${direcao} com ${colunas.size} quadros`,
      ).toBeGreaterThan(1);
    }
  });

  it("nunca espelha, porque cada direcao tem a linha dela", () => {
    // antes o rato usava a folha de 3 linhas e ESPELHAVA ao virar para
    // oeste: a arte era de um lado so. No formato direcional o oeste e
    // uma LINHA da folha, e o `resolveFrameRect` nunca devolve
    // `flip: true`
    const def = sprite();

    for (const facing of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      expect(
        resolveFrameRect(def, "walk", 0, facing).flip,
        `${facing.x},${facing.y}`,
      ).toBe(false);
    }
  });
});

describe("rato da toca: no jogo", () => {
  it("o motor acha a folha pelo TIPO da criatura", () => {
    const engine = criar();

    const rato = spawnar(engine);

    /**
     * A busca e por `typeId`, e nao por `enemy.id`: o id da criatura
     * tem o indice (`rat_7`) e o registro de sprite usa o tipo (`rat`).
     * E o que o `GameEngine` faz ao montar as folhas, e um teste que
     * procurasse pelo `id` inteiro passaria com o registro errado
     *porque nunca casaria
     */
    expect(rato.typeId).toBe("rat");

    const def = getEnemySprite(rato.typeId);

    expect(def).toBeTruthy();
    expect(def.id).toBe("rat");
    expect(def.src).toContain("rato_da_toca-sheet");
  });

  it("o id continua sendo `rat`, e nao o nome da arte", () => {
    /**
     * A pasta de origem se chama `urso`. Se o `id` da criatura tivesse
     * mudado junto, todo mundo que ja matou um rato perderia o
     * registro no save e no bestiario — o nome e da ARTE, e o id e da
     * CRIATURA
     */
    expect(CREATURE_TYPES[TIPO].name).toBe("Rato da Toca");
    expect(TIPO).toBe("rat");
  });

  it("anda com o corpo virado para o movimento", () => {
    const engine = criar();
    const rato = spawnar(engine, 300, "west");

    // um segundo de caminhada: o ciclo tem 8 quadros a 12fps, ou
    // seja 0.67s, e menos que isso o ciclo nao fecha
    const def = sprite();
    const colunas = new Set();
    const linhas = new Set();

    for (let passo = 0; passo < 60; passo += 1) {
      const rect = resolveFrameRect(
        def,
        "walk",
        passo / 60,
        rato.facing,
      );

      colunas.add(rect.x);
      linhas.add(rect.y);
    }

    // o ciclo de 8 quadros realmente roda
    expect(colunas.size).toBe(8);

    // e o corpo fica na MESMA linha enquanto ele anda para o oeste:
    // um mob virando o corpo durante a caminhada parece trotear de
    // lado
    expect(linhas.size).toBe(1);

    engine.destroy();
  });
});