import { describe, expect, it } from "vitest";

import { EnemyAI, AI_CONSTANTS } from "./EnemyAI.js";
import {
  BEHAVIOR,
  CREATURE_TYPES,
  createCreature,
} from "../../data/enemies/index.js";
import { resolveCreatureAnimation } from "../sprites/animation.js";
import { CollisionSystem } from "../collision/CollisionSystem.js";

/**
 * O PISCAR DO PASSEIO: o defeito que fazia bicho "tremer" parado.
 *
 * Nao era tremor de corpo. O bicho alternava entre a linha de
 * caminhada de uma direcao e a da direcao OPOSTA, uma vez por quadro,
 * e o olho le isso como um tremor de 60Hz
 *
 * A causa era uma briga entre dois estados pelo mesmo quadro:
 *
 *   - `updateBehavior` manda `updateReturn` quando o bicho passa do
 *     `restRadius`
 *   - `updateReturn` so limpava o `wanderTarget` quando chegava a MENOS
 *     de `RETURN_ARRIVE` de casa
 *
 * Entao o bicho voltava para dentro do `restRadius` ainda segurando o
 * alvo de passeio, que aponta para fora. No quadro seguinte o
 * `updateIdle` retomava a caminhada para fora e o `updateBehavior`
 * puxava de novo. Para sempre, na borda
 *
 * E nao era um bicho so: o alvo de passeio e sorteado POR EIXO, e o
 * canto mais longe e `wanderRadius * 1.41`, contra um `restRadius` de
 * `wanderRadius + 20`. Qualquer criatura com raio acima de ~48
 * sorteava um alvo diagonal fora da area. O rato era o mais comum de
 * ver porque e o mais Numerous no mapa
 *
 * Estes testes montam o cenario na mao, sem depender da sorte do
 * sorteio, para o defeito nao voltar por acaso
 */

const MAPA = {
  width: 4000,
  height: 2800,
  bounds: { x: 40, y: 40, width: 3920, height: 2720 },
  walls: [],
  obstacles: [],
};

function criarHarness() {
  const world = {
    time: 0,
    player: {
      id: "player",
      // longe o bastante para nenhum bicho sem agressao engatar
      x: 200,
      y: 200,
      radius: 22,
      hp: 10000,
      maxHp: 10000,
      alive: true,
      resource: 0,
      maxResource: 100,
      shield: 0,
      statusEffects: [],
      cast: null,
      cooldowns: {},
      facing: { x: 0, y: 1 },
    },
    enemies: [],
    collision: new CollisionSystem(MAPA),
  };

  const ai = new EnemyAI(world, {});

  return { world, ai };
}

/**
 * um bicho em casa, parado.
 *
 * `espera` e o `wanderWait`: 0 faz ele passeio na hora, que e o que os
 * testes de movimento querem. O valor alto segura o bicho parado e e
 * usado onde o teste mede a PARADA
 */
function emCasa(tipo, espera = 0) {
  const bicho = createCreature(
    tipo,
    { x: 2000, y: 1400 },
    0,
    CREATURE_TYPES[tipo].level,
  );

  bicho.wanderWait = espera;
  bicho.wanderTarget = null;

  return bicho;
}

function passos(ai, bicho, quadros) {
  for (let i = 0; i < quadros; i += 1) {
    ai.update(bicho, 1 / 60);
  }
}

describe("o piscar do passeio", () => {
  it("o retorno descarta o alvo de passeio velho", () => {
    const { ai } = criarHarness();

    const bicho = emCasa("rat");

    const restRadius =
      (bicho.wanderRadius ?? 60) + AI_CONSTANTS.RETURN_MARGIN;

    // um quadro ACIMA do limite, ja com um alvo longe demais
    bicho.x = 2000 + restRadius + 1;
    bicho.wanderTarget = { x: 2000 + restRadius + 80, y: 1400 };
    bicho.aiState = "wander";

    ai.update(bicho, 1 / 60);

    /**
     * Este e o teste que reprova o defeito.
     *
     * Sem o `wanderTarget = null` no inicio do retorno, o alvo sobrevive
     * e o proximo `updateIdle` continua andando para fora
     */
    expect(bicho.aiState).toBe("return");
    expect(
      bicho.wanderTarget,
      "o alvo de passeio velho sobreviveu ao retorno",
    ).toBe(null);
  });

  it("nao pisca quando o bicho e puxado de volta", () => {
    const { ai } = criarHarness();

    const bicho = emCasa("rat");

    const restRadius =
      (bicho.wanderRadius ?? 60) + AI_CONSTANTS.RETURN_MARGIN;

    // exatamente o estado que produzia o piscar: na borda, com o alvo
    // de passeio apontando para fora
    bicho.x = 2000 + restRadius + 2;
    bicho.wanderTarget = { x: 2000 + restRadius + 90, y: 1400 };
    bicho.aiState = "wander";

    /**
     * O que o jogador ve e a LINHA desenhada. A chave e
     * `estado:animacao`, porque o que o olho pega e o bicho mudando de
     * pose, e nao o nome interno do estado
     */
    const linhas = [];

    for (let i = 0; i < 300; i += 1) {
      ai.update(bicho, 1 / 60);

      linhas.push(`${bicho.aiState}:${resolveCreatureAnimation(bicho)}`);
    }

    let maiorRajada = 0;

    for (let i = 0; i < linhas.length - 30; i += 1) {
      let mudancas = 0;

      for (let k = i + 1; k < i + 30; k += 1) {
        if (linhas[k] !== linhas[k - 1]) mudancas += 1;
      }

      maiorRajada = Math.max(maiorRajada, mudancas);
    }

    /**
     * Meio segundo e o limite da perception. Com o defeito, este
     * numero era 15: o bicho trocava de pose em quase todo quadro.
     * Sem ele, o bicho faz uma transicao e fica parado
     */
    expect(
      maiorRajada,
      `o bicho trocou de pose ${maiorRajada} vezes em 0.5s`,
    ).toBeLessThanOrEqual(3);

    expect(new Set(linhas).size, "deve andar e parar").toBeGreaterThan(
      1,
    );
  });

  it("o alvo de passeio cabe dentro da area", () => {
    /**
     * A segunda metade do conserto.
     *
     * Mesmo com o alvo velho descartado, um alvo sorteado para fora da
     * area ainda faria o bicho andar para fora e ser puxado de volta:
     * dois a quatro segundos de vaivem na borda a cada passeio. Sem
     * tremor, mas sem sentido
     *
     * Aqui o sorteio e o alvo sao varridos: qualquer bicho, em
     * qualquer ponto, nunca pode receber um alvo fora do `restRadius`
     */
    for (const tipo of Object.keys(CREATURE_TYPES)) {
      const { ai } = criarHarness();

      const bicho = emCasa(tipo);

      const restRadius =
        (bicho.wanderRadius ?? 60) + AI_CONSTANTS.RETURN_MARGIN;

      for (let i = 0; i < 400; i += 1) {
        bicho.wanderTarget = null;
        bicho.wanderWait = 0;

        // sorteia um ponto de partida novo, para o alvo cair em todas
        // as direcoes a partir de lugares diferentes
        bicho.x = 2000;
        bicho.y = 1400;
        bicho.spawnX = 2000;
        bicho.spawnY = 1400;

        ai.update(bicho, 1 / 60);

        const alvo = bicho.wanderTarget;

        if (!alvo) continue;

        const longe = Math.hypot(
          alvo.x - bicho.spawnX,
          alvo.y - bicho.spawnY,
        );

        expect(
          longe,
          `${tipo}: alvo a ${longe.toFixed(1)}px, limite ${restRadius}`,
        ).toBeLessThanOrEqual(restRadius + 0.001);
      }
    }
  });

  it("nenhum bicho pisca: mede todas as criaturas", () => {
    /**
     * A rede de seguranca. Os tres testes acima montagem o cenario na
     * mao; este roda o passeio de verdade, com o sorteio aleatorio,
     * e exige que nenhuma criatura passe do limite em meio segundo
     */
    for (const tipo of Object.keys(CREATURE_TYPES)) {
      const { ai } = criarHarness();

      const bicho = createCreature(
        tipo,
        { x: 2000, y: 1400 },
        0,
        CREATURE_TYPES[tipo].level,
      );

      const linhas = [];

      // 90 segundos de passeio, bem mais que o ciclo de 1.2 a 3.4s
      for (let i = 0; i < 60 * 90; i += 1) {
        ai.update(bicho, 1 / 60);

        linhas.push(
          `${bicho.aiState}:${resolveCreatureAnimation(bicho)}`,
        );
      }

      let maiorRajada = 0;
      let onde = -1;

      for (let i = 0; i < linhas.length - 30; i += 1) {
        let mudancas = 0;

        for (let k = i + 1; k < i + 30; k += 1) {
          if (linhas[k] !== linhas[k - 1]) mudancas += 1;
        }

        if (mudancas > maiorRajada) {
          maiorRajada = mudancas;
          onde = i;
        }
      }

      /**
       * O teto e 4 e nao 3: o arqueiro e o ogre alternam a linha de
       * golpe com a de parado a cada tiro, e isso e o desenho de
       * puxar a arma, nao um piscar. O que o defeito fazia era de 15
       */
      expect(
        maiorRajada,
        `${tipo}: ${maiorRajada} trocas em 0.5s, perto de ${linhas[onde]}`,
      ).toBeLessThanOrEqual(4);
    }
  });

  it("o comportamento do bicho nao mudou", () => {
    /**
     * O conserto mexeu em duas linhas de decisao. Estas verificam que a
     * passersia continua sendo o que era: parar, esperar, andar
     *
     * O ciclo e medido como um CONJUNTO de estados visitados em 90
     * segundos, e nao como "no quadro 121 ele esta em wander". O alvo
     * de passeio e sorteado, e um alvo quase em cima do bicho e
     * alcancavel em dois quadros: um teste que crava o quadro em que o
     * passeante esta andando passa num sorteio e reprova no seguinte
     */
    const { ai } = criarHarness();

    const bicho = emCasa("rat");

    expect(bicho.aiState).toBe("idle");

    const estados = new Set();

    for (let i = 0; i < 60 * 90; i += 1) {
      ai.update(bicho, 1 / 60);

      estados.add(bicho.aiState);
    }

    // ele para e ele anda: os dois tem de aparecer
    expect(estados, "nunca andou").toContain("wander");
    expect(estados, "nunca parou").toContain("idle");

    /**
     * E `return` nao pode aparecer.
     *
     * Com o alvo de passeio cortado para dentro da area, um bicho que
     * passeia nunca passa do `restRadius`, entao nunca e puxado de
     * volta. Um `return` aqui seria o vaivem na borda
     */
    expect(
      estados,
      "foi puxado de volta durante o passeio",
    ).not.toContain("return");
  });

  it("chegando no alvo ele para de novo", () => {
    /**
     * A transicao exata, montada na mao para nao depender do sorteio
     */
    const { ai } = criarHarness();

    const bicho = emCasa("rat");

    bicho.wanderWait = 0;

    passos(ai, bicho, 1);

    expect(bicho.wanderTarget).toBeTruthy();

    // planta o alvo em cima do bicho: ele chega na hora
    bicho.wanderTarget = { x: bicho.x, y: bicho.y };

    passos(ai, bicho, 1);

    expect(bicho.aiState).toBe("idle");
    expect(bicho.wanderTarget).toBe(null);
  });

  it("o bicho continua sendo puxado quando e ATRACADO para longe", () => {
    /**
     * O alvo de passeio e cortado para dentro da area, mas um bicho
     * atropelado e puxado pelo jogador tem de voltar mesmo de fora. O
     * corte e so do passeio, nao do limite
     */
    const { ai } = criarHarness();

    const bicho = emCasa("goblin");

    const restRadius =
      (bicho.wanderRadius ?? 60) + AI_CONSTANTS.RETURN_MARGIN;

    bicho.x = 2000 + restRadius + 120;
    bicho.wanderTarget = null;

    passos(ai, bicho, 240);

    const longe = Math.hypot(bicho.x - 2000, bicho.y - 1400);

    expect(longe, "o goblin ficou la fora").toBeLessThanOrEqual(
      restRadius,
    );
  });

  it("o limite e o mesmo de antes, e o passeante ainda passeia", () => {
    /**
     * O corte do alvo pode encolher o passeio, mas nao pode virar o
     * bicho numa pedra. Ele ainda tem de se mover, e para longe do
     * lugar onde nasceu
     */
    const { ai } = criarHarness();

    const bicho = emCasa("rat");

    const inicio = { x: bicho.x, y: bicho.y };

    let andou = 0;
    let ultimo = { ...inicio };

    // a maior distancia JA ALCANCADA, e nao a posicao final
    let maiorDistancia = 0;

    for (let i = 0; i < 60 * 90; i += 1) {
      ai.update(bicho, 1 / 60);

      andou += Math.hypot(
        bicho.x - ultimo.x,
        bicho.y - ultimo.y,
      );

      maiorDistancia = Math.max(
        maiorDistancia,
        Math.hypot(
          bicho.x - inicio.x,
          bicho.y - inicio.y,
        ),
      );

      ultimo = { x: bicho.x, y: bicho.y };
    }

    // 90 segundos a `wanderSpeed`: mesmo na media, e muito mais que o
    // suficiente para provar que ele sai do lugar
    expect(andou).toBeGreaterThan(200);

    /**
     * E ele se AFasta de casa, que e o que "passeia" quer dizer.
     *
     * A posicao final nao serve para nada aqui: o passeio sorteia o
     * destino a cada 1.2 a 3.4 segundos, e o bicho pode passar o fim
     * dos 90 segundos em qualquer lugar. O que tem de ser grande e o
     * ponto mais longe que ele chegou
     */
    expect(
      maiorDistancia,
      "o rato nunca saiu de perto de casa",
    ).toBeGreaterThan(30);
  });

  it("o behaviour do rato continua passivo, sem agressao", () => {
    /**
     * O rato e `PASSIVE` com `aggroRange: 0`, entao ele nunca sai pelo
     * `updateCombat` e nao pode virar `chase` por causa do conserto
     */
    expect(CREATURE_TYPES.rat.behavior).toBe(BEHAVIOR.PASSIVE);
    expect(CREATURE_TYPES.rat.aggroRange).toBe(0);

    const { ai } = criarHarness();

    const bicho = emCasa("rat");

    passos(ai, bicho, 60 * 30);

    expect(bicho.aiState).not.toBe("chase");
    expect(bicho.aiState).not.toBe("attack");
  });
});