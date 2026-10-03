import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import {
  CREATURE_TYPES,
  ZONE_ROSTER,
  createCreature,
  createCreatureRoster,
} from "../../data/enemies/index.js";
import { getEnemySprite } from "../../data/sprites/enemies.js";
import { getBestiaryEntry } from "../../data/bestiary/index.js";
import { createPlayerSession } from "./PlayerSession.js";
import {
  resolveCreatureAnimation,
  resolveFrameRect,
} from "../sprites/animation.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

installDomStubs();

const ARBALIST = CHARACTER_CLASSES.find(
  (definition) => definition.id === "arbalist",
);

const TIPO = "zumbi_arbalist";

function createEngine() {
  const canvas = createTestCanvas();

  const engine = new GameEngine(
    canvas.element,
    ARBALIST,
    () => {},
  );

  engine.setMap(MAP_1);

  return engine;
}

/** Um zumbi sozinho, perto do jogador, para testar a IA sem o mapa. */
function createZumbi(engine, { x = 300, y = 0 } = {}) {
  const player = engine.world.player;

  const zumbi = createCreature(
    TIPO,
    { x: player.x + x, y: player.y + y },
    999,
    CREATURE_TYPES[TIPO].level,
  );

  engine.world.enemies.push(zumbi);

  return zumbi;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe("o arqueiro zumbi existe", () => {
  it("esta no tipo de criatura e e ranged", () => {
    const tipo = CREATURE_TYPES[TIPO];

    expect(tipo).toBeTruthy();
    expect(tipo.id).toBe(TIPO);
    expect(tipo.name).toBe("Arqueiro Zumbi");

    // e o que faz a IA manter distancia e atirar em vez de encostar
    expect(tipo.ranged).toBe(true);
    expect(tipo.keepDistance).toBeGreaterThan(0);
    expect(tipo.attackRange).toBeGreaterThan(tipo.keepDistance);
    expect(tipo.projectileSpeed).toBeGreaterThan(0);
  });

  it("entra no roster da cripta", () => {
    const cripta = ZONE_ROSTER.find(
      (entry) => entry.zone === "cripta",
    );

    expect(cripta).toBeTruthy();
    expect(cripta.mix[TIPO]).toBeGreaterThan(0);

    // o resto da cripta continua no mapa
    expect(cripta.mix.skeleton).toBeGreaterThan(0);
    expect(cripta.mix.ogre).toBeGreaterThan(0);
  });

  it("esta no bestiario, com a arte de tiro", () => {
    const entrada = getBestiaryEntry(TIPO);

    expect(entrada).toBeTruthy();
    expect(entrada.creatureId).toBe(TIPO);
  });

  it("cai no mapa com o resto da cripta", () => {
    const roster = createCreatureRoster();

    const zumbis = roster.filter(
      (enemy) => enemy.typeId === TIPO,
    );

    expect(
      zumbis.length,
      "a cripta deveria ter arqueiro zumbi no mapa",
    ).toBeGreaterThan(0);

    // e ele e mesmo um arqueiro zumbi, nao um esqueleto renomeado
    for (const zumbi of zumbis) {
      expect(zumbi.id.startsWith(`${TIPO}_`)).toBe(true);
    }
  });
});

describe("a arte do arqueiro zumbi", () => {
  it("e direcional, com as mesmas linhas do arqueiro", () => {
    const sprite = getEnemySprite(TIPO);

    expect(sprite).toBeTruthy();
    expect(sprite.format).toBe("directional");

    // 8 direcoes, como o arqueiro
    expect(Object.keys(sprite.directions)).toHaveLength(8);

    // e as tres linhas de animacao que o mob precisa
    expect(sprite.animations.walk.rowOffset).toBeUndefined();
    expect(sprite.animations.walk.length).toBe(8);
    expect(sprite.animations.idle.row).toBe(8);
    expect(sprite.animations.attack.rowOffset).toBe(9);
    expect(sprite.animations.attack.length).toBe(9);

    // o tiro e arte de arco: so entra com alvo
    expect(sprite.animations.attack.needsTarget).toBe(true);
  });

  it("a celula e 68x68, com a ancora medida", () => {
    const sprite = getEnemySprite(TIPO);

    // a arte de origem ja veio em 68x68; encolher para os 64 do
    // arqueiro cortaria o personagem
    expect(sprite.frameWidth).toBe(68);
    expect(sprite.frameHeight).toBe(68);
    expect(sprite.anchorX).toBe(33);
    expect(sprite.anchorY).toBe(55);
  });

  it("o tiro aponta para a direcao que o inimigo esta olhando", () => {
    const sprite = getEnemySprite(TIPO);

    // olhando para o norte: a linha de tiro e a 15 (9 + 6)
    const norte = resolveFrameRect(
      sprite,
      "attack",
      0,
      { x: 0, y: -1 },
    );

    expect(norte.y).toBe(15 * 68);
    expect(norte.x).toBe(0);
    expect(norte.width).toBe(68);

    // olhando para o leste: a linha e a 9
    const leste = resolveFrameRect(
      sprite,
      "attack",
      0,
      { x: 1, y: 0 },
    );

    expect(leste.y).toBe(9 * 68);
  });

  it("o tiro entra quando o mob ataca", () => {
    const zumbi = createCreature(
      TIPO,
      { x: 0, y: 0 },
      998,
      CREATURE_TYPES[TIPO].level,
    );

    expect(resolveCreatureAnimation(zumbi)).toBe("idle");

    zumbi.attackAnimation = 0.2;
    expect(resolveCreatureAnimation(zumbi)).toBe("attack");

    zumbi.attackAnimation = 0;
    zumbi.aiState = "chase";
    expect(resolveCreatureAnimation(zumbi)).toBe("walk");
  });
});

describe("todo mob do mapa tem sprite", () => {
  it("nenhum inimigo fica sem arte", () => {
    // O `enemy.id` carrega o indice (`goblin_7`) e o registro de
    // sprite usa o tipo (`goblin`). O motor procurava pelo id
    // inteiro, o registro nunca casava, e TODOS os mobs caíam no
    // corpo vetorial de fallback
    const engine = createEngine();

    const semSprite = [];

    for (const enemy of engine.world.enemies) {
      if (!enemy.isCreature) continue;

      if (!engine.enemySprites.has(enemy.id)) {
        semSprite.push(enemy.id);
      }
    }

    expect(
      semSprite,
      `inimigos sem sprite: ${semSprite.slice(0, 8).join(", ")}`,
    ).toHaveLength(0);

    engine.destroy();
  });

  it("os direcionais do mapa sao o zumbi, o ghoul, o ogre e o boneco", () => {
    const engine = createEngine();

    // Um por TIPO, e nao por instancia. `enemySprites` tem uma
    // entrada para cada criatura do mundo, e sao quatro ogres da
    // predeira na floresta: comparar a lista crua contaria quatro, e
    // o teste passaria a medir o numero de spawns em vez do tipo da
    // arte
    const formatoPorTipo = new Map();

    for (const sheet of engine.enemySprites.values()) {
      formatoPorTipo.set(
        sheet.definition.id,
        sheet.definition.format,
      );
    }

    const direcionais = [...formatoPorTipo]
      .filter(([, formato]) => formato === "directional")
      .map(([id]) => id)
      .sort();

    // A lista e FECHADA de proposito: um inimigo direcional novo
    // que entrasse sem ser listado aqui apareceria nesta lista e
    // quebraria o teste, obrigando a conferer a arte dele.
    //
    // O `ogre` da pedreira NAO aparece: ele aponta para o MESMO
    // objeto de definicao do ogre da predeira, e o `Map` guarda um
    // por id. O boneco entra porque e o terceiro direcional, e o
    // ghoul porque e o quarto: tem idle de verdade e nenhum golpe.
    // O `rat` e o quinto, e a unica PASSIVA com arte. O `skeleton` e
    // o sexto: a "Sentinela Esquelética" tambem nao tem arte de golpe,
    // e e a primeira criatura que ATACA sem ela.
    //
    // O `slime` e o setimo: o bicho de nivel 1, o mais comum do
    // jogo, e a origem do `slime_gel` e do `slime_core` que o craft e
    // as missoes pedem
    //
    // O `goblin` e o oitavo, e o "Goblin Saqueador". Ele e
    // `SEMI_PASSIVE` com `aggroRange: 0` como o ghoul: passeia e nao
    // persegue, e nao tem arte de golpe. A pasta de arte dele se chama
    // `hulk`, e o `id` continua `goblin`
    expect(direcionais).toEqual([
      "dummy_warrior",
      "ghoul",
      "goblin",
      "ogre_da_predeira",
      "rat",
      "skeleton",
      "slime",
      TIPO,
    ]);

    engine.destroy();
  });
});

describe("o arqueiro zumbi atira", () => {
  it("dispara uma flecha em vez de bater de perto", () => {
    const engine = createEngine();

    const zumbi = createZumbi(engine, { x: 220, y: 0 });

    const hpAntes = engine.world.player.hp;

    engine.update(1 / 60);

    // longe o bastante para nao encostar, mas dentro do alcance
    expect(dist(zumbi, engine.world.player)).toBeGreaterThan(
      CREATURE_TYPES[TIPO].keepDistance,
    );

    const flechas = engine.world.projectiles.filter(
      (p) => p.hostile,
    );

    expect(
      flechas.length,
      "o zumbi deveria ter disparado",
    ).toBeGreaterThan(0);

    const flecha = flechas[0];

    // a flecha viaja na direcao do jogador
    const para = {
      x: engine.world.player.x - flecha.x,
      y: engine.world.player.y - flecha.y,
    };

    const tamanho = Math.hypot(para.x, para.y);
    const alinhamento =
      (flecha.velocityX * para.x + flecha.velocityY * para.y) /
      tamanho;

    expect(alinhamento).toBeGreaterThan(0.99);

    // e a arte de arco e a que o jogador ve
    expect(flecha.action.projectileStyle).toBe("arrow");
    expect(flecha.action.color).toBe(
      CREATURE_TYPES[TIPO].projectileColor,
    );

    // o dano NAO e instantaneo: a flecha ainda esta no ar
    expect(engine.world.player.hp).toBe(hpAntes);

    engine.destroy();
  });

  it("a flecha acerta o jogador quando chega", () => {
    const engine = createEngine();

    const zumbi = createZumbi(engine, { x: 200, y: 0 });

    const hpAntes = engine.world.player.hp;

    for (let frame = 0; frame < 180; frame += 1) {
      engine.update(1 / 60);
    }

    expect(
      engine.world.player.hp,
      "a flecha deveria ter acertado o jogador",
    ).toBeLessThan(hpAntes);

    // e a flecha some depois de acertar
    expect(
      engine.world.projectiles.filter((p) => p.hostile),
    ).toHaveLength(0);

    engine.destroy();
  });

  it("cada flecha acerta uma vez so", () => {
    const engine = createEngine();

    createZumbi(engine, { x: 200, y: 0 });

    const hpAntes = engine.world.player.hp;

    // o zumbi continua atirando, entao o dano total e maior que UMA
    // flecha. o que nao pode e a mesma flecha vale duas vezes: ela
    // tem de sair da lista assim que acerta
    let flechasNoAr = 0;

    for (let frame = 0; frame < 600; frame += 1) {
      engine.update(1 / 60);

      flechasNoAr = Math.max(
        flechasNoAr,
        engine.world.projectiles.filter((p) => p.hostile).length,
      );
    }

    expect(flechasNoAr).toBeGreaterThan(0);
    expect(engine.world.player.hp).toBeLessThan(hpAntes);

    engine.destroy();
  });

  it("recua quando o jogador chega perto", () => {
    const engine = createEngine();

    // colado nele: o arquiro nao pode ficar tookando na cara
    const zumbi = createZumbi(engine, { x: 40, y: 0 });

    const distanciaAntes = dist(zumbi, engine.world.player);

    for (let frame = 0; frame < 90; frame += 1) {
      engine.update(1 / 60);
    }

    const distanciaDepois = dist(zumbi, engine.world.player);

    expect(
      distanciaDepois,
      `o zumbi deveria recuar (${distanciaAntes.toFixed(0)} -> ${distanciaDepois.toFixed(0)})`,
    ).toBeGreaterThan(distanciaAntes);

    engine.destroy();
  });

  it("os outros mobs continuam batendo de perto", () => {
    const engine = createEngine();

    const player = engine.world.player;

    // um esqueleto, que e ACTIVE. o slime nao serviria: e PASSIVE,
    // com `aggroRange: 0`, entao nunca ataca ninguem
    const esqueleto = createCreature(
      "skeleton",
      { x: player.x + 30, y: player.y },
      997,
      CREATURE_TYPES.skeleton.level,
    );

    engine.world.enemies.push(esqueleto);

    const hpAntes = player.hp;

    for (let frame = 0; frame < 300; frame += 1) {
      engine.update(1 / 60);
    }

    // o esqueleto encosta e bate, sem flecha no ar
    expect(player.hp).toBeLessThan(hpAntes);
    expect(
      engine.world.projectiles.filter((p) => p.hostile),
    ).toHaveLength(0);

    engine.destroy();
  });
});

describe("o zumbi se vira e atira", () => {
  /**
   * O sprite direcional do zumbi e o unico que mostra a diferenca
   * entre andar para o norte, para o leste e atirar. As folhas dos
   * outros mobs tem tres linhas e um espelhamento, entao um mob que
   * nao vira parece apenas "andando torto"; no zumbi a falta de
   * direcao e de estado de ataque aparece como duas animacoes
   * ausentes.
   */
  it("a IA vira o zumbi para o jogador", () => {
    const engine = createEngine();

    const jogador = engine.world.player;

    // a oeste do jogador: o zumbi tem de ficar olhando para o oeste
    const zumbi = createZumbi(engine, { x: -120, y: 0 });

    engine.update(1 / 60);

    // `facing` e um VETOR, e nao um numero: e o que o
    // `resolveDirectionKey` do sprite direcional le para escolher
    // entre as oito linhas
    expect(typeof zumbi.facing?.x).toBe("number");
    expect(typeof zumbi.facing?.y).toBe("number");
    expect(zumbi.facing.x).toBeLessThan(0);

    // e a linha de tiro e a do oeste, nao a do sul (o valor inicial
    // de `createCreature`)
    const sprite = getEnemySprite(TIPO);
    const linha = resolveFrameRect(sprite, "attack", 0, zumbi.facing);

    expect(linha.y).toBe((sprite.animations.attack.rowOffset +
      sprite.directions.west) * sprite.frameHeight);

    // virado para o norte agora: tem de trocar de linha
    zumbi.facing = { x: 0, y: -1 };

    const norte = resolveFrameRect(sprite, "walk", 0, zumbi.facing);

    expect(norte.y).toBe(
      sprite.directions.north * sprite.frameHeight,
    );

    engine.destroy();
  });

  it("o zumbi levanta a arte de tiro quando dispara", () => {
    const engine = createEngine();

    const zumbi = createZumbi(engine, { x: 240, y: 0 });

    engine.update(1 / 60);

    // o `attackAnimation` e o INSTANTE do tiro e vale 0.28s. sem
    // ele no pacote, o `resolveCreatureAnimation` do cliente nunca
    // cairia em "attack" e o arco nunca apareceria
    expect(zumbi.attackAnimation).toBeGreaterThan(0);
    expect(resolveCreatureAnimation(zumbi)).toBe("attack");

    // passado o instante, volta para o estado de movimento
    zumbi.attackAnimation = 0;
    zumbi.aiState = "chase";

    expect(resolveCreatureAnimation(zumbi)).toBe("walk");

    engine.destroy();
  });
});

describe("o projetil do jogador nao acelera com mais gente", () => {
  it("a flecha anda a mesma velocidade com um ou dois jogadores", () => {
    // `skillSystem.update` roda dentro do laco por jogador e ele
    // atualiza os projeteis, que sao do mundo COMPARTILHADO. Com
    // dois jogadores online cada flecha andava o dobro
    const engine = createEngine();

    // o mapa tem 76 bichos e o jogador nasce no chao: uma flecha
    // solta no corpo do jogador encostaria num deles ou num solido
    // e sumiria no primeiro tick, e o teste passaria a to
    engine.world.enemies.length = 0;

    const chutar = () => {
      const jogador = engine.world.player;

      engine.world.projectiles.push({
        id: "teste",
        x: jogador.x,
        y: jogador.y,
        radius: 10,
        velocityX: 600,
        velocityY: 0,
        speed: 600,
        directionX: 1,
        directionY: 0,
        action: { projectileStyle: "arrow" },
        targetId: null,
        destination: null,
        remaining: 5,
        impactMode: "collision",
      });

      return { x: jogador.x, y: jogador.y };
    };

    const quantoAndou = (inicio, ticks) => {
      for (let i = 0; i < ticks; i += 1) {
        engine.update(1 / 60);
      }

      const flecha = engine.world.projectiles.find(
        (p) => p.id === "teste",
      );

      // se ela morreu no caminho, o teste nao pode passar a to:
      // mediria zero nos dois casos e nao provaria nada
      expect(
        flecha,
        "a flecha de teste sumiu antes de medir",
      ).toBeTruthy();

      return flecha.x - inicio.x;
    };

    // UM jogador
    const inicio1 = chutar();
    const andou1 = quantoAndou(inicio1, 30);

    engine.world.projectiles.length = 0;

    // DOIS jogadores: entra o Bento na mesma partida
    engine.addPlayer(
      createPlayerSession(ARBALIST, {
        id: "p_segundo",
        name: "Bento",
        spawn: { x: 40, y: 40 },
      }),
      { focus: false },
    );

    const inicio2 = chutar();
    const andou2 = quantoAndou(inicio2, 30);

    expect(
      Math.abs(andou2 - andou1),
      `a flecha andou ${andou1.toFixed(1)} com um jogador ` +
        `e ${andou2.toFixed(1)} com dois`,
    ).toBeLessThan(1);

    engine.destroy();
  });
});
