import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import {
  createCreature,
  CREATURE_TYPES,
} from "../../data/enemies/index.js";
import { getEnemySprite } from "../../data/sprites/enemyLayout.js";
import {
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
 * O ogre da predeira: o segundo direcional, e o primeiro que e
 * CORPO A CORPO.
 *
 * O arquiro zumbi brought arte de tiro de oito direcoes, e ele
 * atira de longe. O ogre tem a mesma folha de oito direcoes e a
 * mesma pasta de origem chamada `shoot`, mas o que esta la dentro e
 * um porrete: entao a EXPECTATIVA e oposta. Ele tem de andar ate o
 * jogador.
 *
 * Os testes abaixo travam essa distincao, porque ela e invisivel
 * no codigo: uma criatura sem `ranged` e uma com `ranged: false`
 * sao a mesma coisa, e um `keepDistance` esquecido transformaria o
 * ogre num(atirador) parado sem dar erro nenhum.
 */
const TIPO = "ogre_da_predeira";

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

/** Um ogre do tipo novo, a `distancia` do jogador. */
function spawnar(engine, distancia = 420, lado = "west") {
  const player = engine.world.player;

  const offset = {
    west: { x: -distancia, y: 0 },
    east: { x: distancia, y: 0 },
    north: { x: 0, y: -distancia },
    south: { x: 0, y: distancia },
  }[lado];

  const ogre = createCreature(
    TIPO,
    { x: player.x + offset.x, y: player.y + offset.y },
    999,
    CREATURE_TYPES[TIPO].level,
  );

  engine.world.enemies.push(ogre);

  return ogre;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe("ogre da predeira: corpo a corpo", () => {
  it("e uma criatura melee: sem `ranged` e sem distancia de recuo", () => {
    const tipo = CREATURE_TYPES[TIPO];

    // `ranged` ausente e o mesmo que `false`. e este campo, e nao o
    // `keepDistance`, que faz a EnemyAI escolher entre
    // `onShootPlayer` e `onDamagePlayer`
    expect(tipo.ranged ?? false).toBe(false);

    // sem `keepDistance` nao ha recuo, e sem ele o `attackRange` e
    // a distancia de golpe: 84, o alcance de um porrete
    expect(tipo.keepDistance ?? null).toBeNull();
    expect(tipo.attackRange).toBeLessThan(120);

    // e nao ha projétil configurado, que e o que a EnemyAI usa para
    // atirar
    expect(tipo.projectileSpeed ?? null).toBeNull();
    expect(tipo.projectileStyle ?? null).toBeNull();
  });

  it("e mais rapido que o ogre da pedreira, para alcancar o jogador", () => {
    // o guerreiro anda a 165 e nao ha mob que o alcance em linha
    // reta, entao "andar ate o jogador" aqui quer dizer a arrancada
    // inicial e a persistencia, nao a perseguicao infinita
    const ogre = CREATURE_TYPES[TIPO];

    expect(ogre.speed).toBeGreaterThan(
      CREATURE_TYPES.ogre.speed,
    );
  });

  it("caminha na direcao do jogador em vez de ficar parado", () => {
    const engine = criar();

    // a oeste do jogador: e o lado limpo do mapa de teste. A leste
    // ha um obstaculo a uns 200px, e la o ogre trava depois de
    // aggroar. Nao e bug da criatura: o ogre da pedreira, no mesmo
    // ponto, nem chega a aggroar
    const ogre = spawnar(engine, 420, "west");

    expect(ogre.aiState).not.toBe("chase");

    const inicio = ogre.x;

    for (let i = 0; i < 30; i += 1) {
      engine.update(1 / 60);
    }

    // andou 30 frames na direcao do jogador, que esta a LESTE do
    // ogre neste teste: o `x` tem que CRESCER
    expect(ogre.aiState).toBe("chase");
    expect(ogre.x).toBeGreaterThan(inicio);

    // e a arte de caminhada e a que estava sendo usada
    expect(resolveCreatureAnimation(ogre)).toBe("walk");

    engine.destroy();
  });

  it("chega no alcance do porrete e para de avancar", () => {
    const engine = criar();

    const ogre = spawnar(engine, 420, "west");

    // 5 segundos: 420px a 118 de velocidade dao 590px de caminho,
    // entao sobra tempo de sobra
    for (let i = 0; i < 300; i += 1) {
      engine.update(1 / 60);
    }

    const distance = dist(ogre, engine.world.player);

    // parou NO alcance de golpe, e nao passou por cima do jogador:
    // um melee que ignorasse o `attackRange` atravessaria o
    // personagem e ficaria do outro lado
    expect(distance).toBeLessThanOrEqual(ogre.attackRange + 8);
    expect(distance).toBeGreaterThan(0);

    // e o estado e o de golpe, que e a prova de que a IA escolheu
    // `onDamagePlayer` e nao `onShootPlayer`
    expect(ogre.aiState).toBe("attack");

    engine.destroy();
  });

  it("chega em todas as direcoes limpas do mapa", () => {
    // o alcance de golpe e o mesmo nos quatro lados. Um lado travado
    // e um obstaculo do mapa; tres lados batendo e a IA funcionando
    const lados = ["west", "north", "south"];

    for (const lado of lados) {
      const engine = criar();
      const ogre = spawnar(engine, 420, lado);

      for (let i = 0; i < 300; i += 1) {
        engine.update(1 / 60);
      }

      expect(
        dist(ogre, engine.world.player),
        `lado ${lado}`,
      ).toBeLessThanOrEqual(ogre.attackRange + 8);

      engine.destroy();
    }
  });

  it("bate de perto, sem criar projétil", () => {
    const engine = criar();

    const ogre = spawnar(engine, 60, "west");

    const antes = engine.world.projectiles.length;
    const hpAntes = engine.world.player.hp;

    for (let i = 0; i < 120; i += 1) {
      engine.update(1 / 60);
    }

    // o dano de um melee e direto no hp do jogador...
    expect(engine.world.player.hp).toBeLessThan(hpAntes);

    // ... e nada de flecha pelo caminho. e o que diferencia este
    // golpe do do arqueiro zumbi, que cria um projétil
    expect(engine.world.projectiles.length).toBe(antes);

    engine.destroy();
  });
});

describe("ogre da predeira: sprite direcional sem idle", () => {
  it("tem sprite directional registrado pelo id da criatura", () => {
    const sprite = getEnemySprite(TIPO);

    expect(sprite).toBeTruthy();
    expect(sprite.id).toBe(TIPO);
    expect(sprite.frameWidth).toBe(68);
  });

  it("TODO ogre usa a folha da predeira, o da pedreira incluso", () => {
    // O que motivou isto: no jogo apareciam os dois ogres lado a
    // lado com artes diferentes. O `ogre` da pedreira usava
    // `enemies/ogre.png`, uma folha de 32px, e o da predeira a
    // direcional de 68px. A regra e que todo ogre usa a folha da
    // predeira
    const daPedreira = getEnemySprite("ogre");

    expect(daPedreira).toBeTruthy();
    expect(daPedreira.format).toBe("directional");
    expect(daPedreira.frameWidth).toBe(68);

    // e as DUAS criaturas compartilham a mesma definicao, e nao duas
    // copias que podem divergir com o tempo
    expect(daPedreira).toBe(getEnemySprite(TIPO));
  });

  it("o ogre da pedreira virou direcional de verdade, e nao so no nome", () => {
    // O `ogre` tem 16 ogres em quatro zonas (pedreira, cinzas,
    // dunas, pantano). Se o registro voltasse para a folha de 32px,
    // seriam 16 inimigos com a arte antiga de volta no mapa
    const engine = criar();

    const ogres = [...engine.world.enemies].filter(
      (enemy) => /^ogre_\d+$/.test(enemy.id),
    );

    expect(ogres.length).toBeGreaterThan(0);

    for (const ogre of ogres) {
      const definicao = engine.enemySprites.get(ogre.id)
        ?.definition;

      expect(definicao?.format, ogre.id).toBe("directional");
      expect(definicao?.frameWidth, ogre.id).toBe(68);
    }

    engine.destroy();
  });

  it("usa a linha 8 para o golpe, e a da direcao para o andar", () => {
    const sprite = getEnemySprite(TIPO);

    const { attack, walk, idle } = sprite.animations;

    // a folha tem 8 linhas de caminhada e 8 de golpe, sem a de idle
    // no meio: por isso o `rowOffset` do golpe e 8, e nao 9 como no
    // arqueiro zumbi
    expect(attack.rowOffset).toBe(8);

    // o andar e por direcao, sem deslocamento
    expect(walk.rowOffset ?? 0).toBe(0);

    // o idle e UM frame, sem `row`: e o primeiro frame da
    // caminhada da propria direcao
    expect(idle.length).toBe(1);
    expect(idle.row).toBeUndefined();
    expect(idle.rowOffset).toBeUndefined();
  });

  it("congela o idle na direcao certa, em vez de marchar parado", () => {
    const sprite = getEnemySprite(TIPO);

    // virado para o norte: a linha de walk do norte e a 6
    const norte = resolveFrameRect(
      sprite,
      "idle",
      0.37,
      { x: 0, y: -1 },
    );

    const sul = resolveFrameRect(
      sprite,
      "idle",
      0.37,
      { x: 0, y: 1 },
    );

    // linhas diferentes por direcao, e sempre na faixa da
    // caminhada (0 a 7): nunca na linha 8, que e o golpe
    expect(norte.y).not.toBe(sul.y);
    expect(norte.y).toBeLessThan(8 * sprite.frameHeight);

    // e o MESMO frame, com o tempo parado: um idle que anda no
    // tempo viraria uma marcha no lugar
    const norteDepois = resolveFrameRect(
      sprite,
      "idle",
      2.9,
      { x: 0, y: -1 },
    );

    expect(norteDepois.x).toBe(norte.x);
    expect(norteDepois.y).toBe(norte.y);
  });

  it("declara que o golpe precisa de alvo, e o Motor nao e quem decide", () => {
    const sprite = getEnemySprite(TIPO);

    expect(sprite.animations.attack.needsTarget).toBe(true);

    const engine = criar();
    const ogre = spawnar(engine, 60, "west");

    ogre.attackAnimation = 0.1;

    // O `resolveCreatureAnimation` da criatura olha SO o
    // `attackAnimation`: nao ha `needsTarget` aqui. Quem respeita o
    // sinal e a camada de REDE, que so liga o `attackAnimation`
    // quando o inimigo esta de fato atacando alguem. Por isso o que
    // se prova aqui e a declaracao, e o comportamento esta no
    // `zumbiAnimacao.test.js`, que passa por TODOS os inimigos do
    // pacote
    expect(resolveCreatureAnimation(ogre)).toBe("attack");

    // e a arte de golpe sai da linha 8, nao da caminhada
    const rect = resolveFrameRect(
      sprite,
      "attack",
      0.05,
      { x: 1, y: 0 },
    );

    // virado para o leste: a linha 0 do bloco de golpe
    expect(rect.y).toBe(8 * sprite.frameHeight);

    engine.destroy();
  });

  it("tem uma linha de golpe para cada uma das oito direcoes", () => {
    const sprite = getEnemySprite(TIPO);

    const lados = [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
    ];

    const linhas = lados.map(
      (lado) =>
        resolveFrameRect(sprite, "attack", 0.05, lado).y /
        sprite.frameHeight,
    );

    // Oito linhas DISTINTAS, de 8 a 15. A duplicacao da arte esta
    // nos PIXELS dessas linhas, e nao no indice: a folha tem oito
    // slots de golpe, tres deles com a arte copiada de outro lado.
    // O `ogreSheet.test.js` e quem trava essa copia
    expect(linhas).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);

    // e nenhuma delas cai na faixa da caminhada (0 a 7)
    for (const linha of linhas) {
      expect(linha).toBeGreaterThanOrEqual(8);
      expect(linha).toBeLessThan(16);
    }
  });
});
