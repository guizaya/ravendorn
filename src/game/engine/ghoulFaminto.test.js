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
 * O ghoul faminto: o quarto direcional, e o primeiro que tem idle DE
 * VERDADE e nenhum golpe.
 *
 * A arte veio em `assets/sprites/guerreiro`: oito direcoes de
 * caminhada e um `idle.gif`, sem pasta de golpe. Isso muda duas
 * coisas em relacao aos outros direcionais, e os testes abaixo
 * travam as duas porque nenhuma delas aparece no codigo:
 *
 * 1. o `idle` aponta para a LINHA 8, uma arte desenhada. O ogre e o
 *    boneco congelam o primeiro frame da caminhada da direcao
 *    porque nao tinham arte de parado
 *
 * 2. nao ha `attack` na definicao. O ghoul e corpo a corpo, e o
 *    golpe dele esta no mesmo arquivo da caminhada, entao pedir
 *    "attack" tem de cair no walk e nao em um golpe inventado
 */
const TIPO = "ghoul";

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

/** Um ghoul a `distancia` do jogador, para o lado pedido. */
function spawnar(engine, distancia = 420, lado = "west") {
  const player = engine.world.player;

  const offset = {
    west: { x: -distancia, y: 0 },
    east: { x: distancia, y: 0 },
    north: { x: 0, y: -distancia },
    south: { x: 0, y: distancia },
  }[lado];

  const ghoul = createCreature(
    TIPO,
    { x: player.x + offset.x, y: player.y + offset.y },
    777,
    CREATURE_TYPES[TIPO].level,
  );

  engine.world.enemies.push(ghoul);

  return ghoul;
}

const sprite = () => getEnemySprite(TIPO);

describe("ghoul faminto: a arte", () => {
  it("usa a folha direcional de 68px, e nao a antiga de 32", () => {
    const def = sprite();

    // a arte antiga era `enemies/ghoul.png`: 32px, tres linhas
    // (baixo, frente, lado) e sempre virado para o jogador
    expect(def.format).toBe("directional");
    expect(def.frameWidth).toBe(68);
    expect(def.frameHeight).toBe(68);
  });

  it("a imagem aponta para a folha nova", () => {
    // caminho escrito por extenso de proposito: um `new URL` com
    // template literal nao e empacotado pelo Vite, e o sprite
    // some so em producao
    expect(sprite().src).toContain("ghoul_faminto-sheet");
  });

  it("tem caminhada nas oito direcoes", () => {
    const def = sprite();
    const walk = def.animations.walk;

    expect(walk.length).toBe(8);

    for (const direcao of DIRECTION_KEYS) {
      expect(def.directions[direcao], direcao).toBeGreaterThanOrEqual(
        0,
      );
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

    // o `row` e obrigatorio aqui: sem ele o `resolveFrameRect`
    // usaria `rowOffset ?? 0` e leria a linha 0, que e a
    // caminhada para leste, e o ghoul parado viraria de lado
    expect(idle.rowOffset).toBeUndefined();
  });

  it("NAO declara golpe, porque a arte nao tem", () => {
    const def = sprite();

    // o ghoul e corpo a corpo e o ataque dele esta no mesmo gif da
    // caminhada. Sem `attack`, o pedido cai no walk
    expect(def.animations.attack).toBeUndefined();
  });

  it("cada direcao sai de uma linha diferente", () => {
    const def = sprite();

    const linhas = new Set(
      DIRECTION_KEYS.map(
        (direcao) => def.directions[direcao],
      ),
    );

    // sem isto, o ghoul viraria para o norte e para o sul com a
    // mesma arte, e o jogador perderia a nocao de para onde ele vem
    expect(linhas.size).toBe(DIRECTION_KEYS.length);
  });
});

describe("ghoul faminto: o desenho", () => {
  it("anda virado para a direcao do movimento", () => {
    const def = sprite();

    const casos = [
      [{ x: 0, y: 1 }, "south"],
      [{ x: 1, y: 0 }, "east"],
      [{ x: 0, y: -1 }, "north"],
      [{ x: -1, y: 0 }, "west"],
    ];

    for (const [facing, esperado] of casos) {
      const rect = resolveFrameRect(
        def,
        "walk",
        0,
        facing,
      );

      const linha = rect.y / def.frameHeight;

      // o id da direcao esta na posicao da linha da folha
      expect(linha, esperado).toBe(
        DIRECTION_KEYS.indexOf(esperado),
      );
    }
  });

  it("parado usa a linha do idle, nao a da caminhada", () => {
    const def = sprite();

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

    // 8 x 68 = a linha do idle; a caminhada para o sul e a linha 2
    expect(parado.y).toBe(8 * 68);
    expect(andando.y).toBe(2 * 68);
  });

  it("pedir golpe cai no idle, e nao num golpe inventado", () => {
    const def = sprite();

    // a `resolveCreatureAnimation` devolve "attack" quando o mob
    // esta atacando. Sem arte de golpe, o `resolveFrameRect` tem de
    // cair no RESERVA, que e o `idle` e nao o `walk`
    //
    // essa distincao e o que separa um ghoul parado de um ghoul
    // andando: o reserva de `resolveFrameRect` prefere o idle, e se
    // fosse o walk o ghoul sairia andando no meio do golpe, com as
    // pernas mexendo em pose de ataque
    const ghoul = {
      aiState: "attack",
      attackAnimation: 0.2,
      hitFlash: 0,
      facing: { x: 1, y: 0 },
    };

    expect(resolveCreatureAnimation(ghoul)).toBe("attack");

    const pedido = resolveFrameRect(
      def,
      resolveCreatureAnimation(ghoul),
      0,
      ghoul.facing,
    );
    const parado = resolveFrameRect(
      def,
      "idle",
      0,
      ghoul.facing,
    );
    const andando = resolveFrameRect(
      def,
      "walk",
      0,
      ghoul.facing,
    );

    // o pedido de golpe vira a pose parada
    expect(pedido).toEqual(parado);

    // e NAO vira caminhada
    expect(pedido).not.toEqual(andando);
  });

  it("o idle tem varios quadros, e nao um congelado", () => {
    // o ogre e o boneco usam `length: 1` para segurar o pose. O
    // ghoul tem arte de parado de verdade, entao um unico quadro
    // seria perder o que veio pronto
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
});

describe("ghoul faminto: no jogo", () => {
  it("e uma criatura melee", () => {
    const tipo = CREATURE_TYPES[TIPO];

    // `ranged` ausente e o mesmo que `false`, e e este campo que a
    // EnemyAI usa para escolher entre atirar e chegar perto
    expect(tipo.ranged ?? false).toBe(false);
    expect(tipo.projectileSpeed ?? null).toBe(null);
  });

  it("anda com o corpo virado para o movimento", () => {
    const engine = criar();
    const ghoul = spawnar(engine, 300, "west");

    // O ghoul e `semiPassive` com `aggroRange: 0`: ele passeia e nao
    // persegue, entao o tempo de andar depende da IA. O que o sprite
    // precisa e que o quadro acompanhe o RELOGIO GLOBAL — criaturas
    // nao tem `animationTime` proprio, o `drawCreature` recebe o
    // `spriteTime` do motor
    //
    // um segundo de caminhada. O ciclo tem 8 quadros a 12fps, ou
    // seja 0,67s: menos que isso o ciclo nao fecha e contar as
    // colunas nao diz nada
    const def = sprite();
    const colunas = new Set();
    const linhas = new Set();

    for (let passo = 0; passo < 60; passo += 1) {
      const rect = resolveFrameRect(
        def,
        "walk",
        passo / 60,
        ghoul.facing,
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
