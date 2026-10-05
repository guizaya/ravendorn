import { describe, expect, it } from "vitest";
import {
  BEHAVIOR,
  CREATURE_GROWTH,
  CREATURE_TYPES,
  createCreature,
  createCreatureRoster,
  createTrainingDummies,
  LEVEL_TIERS,
  resolveLevel,
  scaleForLevel,
  ZONE_ROSTER,
} from "../../data/enemies/index.js";
import { MAP_1, MAP_1_ZONES } from "../../data/maps/index.js";
import { BESTIARY, zoneOf } from "../../data/bestiary/index.js";
import { xpForKill } from "../../game/progression/Levels.js";

function at(typeId, level) {
  return createCreature(
    typeId,
    { x: 0, y: 0 },
    0,
    level,
  );
}

/**
 * Os DEGRAUS de limo, do mais facil ao mais dificil.
 *
 * Uma lista, e nao uma repetida em cada teste deste arquivo. A ordem
 * e de NIVEL e nao de posicao no mapa: a Toca fica no canto superior
 * esquerdo e o Brejo no meio da linha de cima, entao a ordem
 * geografica seria outra
 *
 * E uma constante de TESTE, nao do jogo: o `ZONE_ROSTER` declara as
 * faixas uma a uma, e este arquivo e que amarra a sequencia
 */
const DEGRAUS_DE_LIMO = [
  "pantano",
  "pedreira",
  "dunas",
  "cinzas",
  "toca",
  "brejo",
];

/**
 * Os spawns que caem DENTRO de uma zona.
 *
 * Uma semente fixa por padrao, porque a maioria destes testes quer o
 * mesmo mapa e nao quer que o resultado mude a cada execucao. E o
 * `semente` e um parametro para os testes que precisam variar
 */
function criarDoRoster(zoneId, semente = 42) {
  const zona = MAP_1_ZONES.find((z) => z.id === zoneId);

  if (!zona) {
    throw new Error(`zona desconhecida: ${zoneId}`);
  }

  return createCreatureRoster(MAP_1, semente).filter(
    (enemy) =>
      enemy.x >= zona.x &&
      enemy.x <= zona.x + zona.width &&
      enemy.y >= zona.y &&
      enemy.y <= zona.y + zona.height,
  );
}

describe("base level das criaturas", () => {
  it("da um nivel base para cada criatura", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      expect(type.level, type.id).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(type.level), type.id).toBe(true);
    }
  });

  it("separa os niveis base das criaturas", () => {
    // o rat e mais rapido e mais fraco que o limo de proposito, e o
    // slime ainda ganha do esqueleto. nivel e um eixo proprio: o que
    // vale e que a escala por nivel e coerente, testada abaixo.
    const levels = Object.values(CREATURE_TYPES).map(
      (type) => type.level,
    );

    expect(levels).toContain(1);
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(10);

    // todo nivel base tem que ser positivo e inteiro
    for (const type of Object.values(CREATURE_TYPES)) {
      expect(Number.isInteger(type.level), type.id).toBe(true);
      expect(type.level, type.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("mantem o limo como a criatura mais fraca", () => {
    expect(CREATURE_TYPES.slime.level).toBe(1);

    for (const type of Object.values(CREATURE_TYPES)) {
      if (type.id === "slime") continue;

      expect(
        type.level,
        type.id,
      ).toBeGreaterThan(CREATURE_TYPES.slime.level);
    }
  });
});

describe("escala por nivel", () => {
  it("nao mexe nada no nivel base", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      const scaled = scaleForLevel(type, type.level);

      expect(scaled.maxHp, type.id).toBe(type.maxHp);
      expect(scaled.damage, type.id).toBe(type.damage);
      expect(scaled.defense, type.id).toBe(type.defense);
    }
  });

  it("da mais vida e mais dano quanto maior o nivel", () => {
    for (const type of Object.values(CREATURE_TYPES)) {
      const base = at(type.id, type.level);
      const up = at(type.id, type.level + 1);
      const down = at(type.id, type.level - 1);

      expect(up.maxHp, `${type.id} hp`).toBeGreaterThan(base.maxHp);
      expect(up.damage, `${type.id} dano`).toBeGreaterThan(base.damage);

      expect(
        down.maxHp ?? base.maxHp,
        `${type.id} hp baixo`,
      ).toBeLessThanOrEqual(base.maxHp);
    }
  });

  it("cresce de forma monotona", () => {
    const type = CREATURE_TYPES.ogre;

    let previousHp = 0;
    let previousDamage = 0;

    for (
      let level = type.level - 1;
      level <= type.level + 5;
      level += 1
    ) {
      const scaled = scaleForLevel(type, level);

      expect(scaled.maxHp, `hp nv ${level}`).toBeGreaterThan(
        previousHp,
      );
      expect(scaled.damage, `dano nv ${level}`).toBeGreaterThan(
        previousDamage,
      );

      previousHp = scaled.maxHp;
      previousDamage = scaled.damage;
    }
  });

  it("mantem vida positiva mesmo muito abaixo do base", () => {
    const scaled = scaleForLevel(CREATURE_TYPES.ogre, 1);

    expect(scaled.maxHp).toBeGreaterThanOrEqual(1);
    expect(scaled.damage).toBeGreaterThanOrEqual(1);
    expect(scaled.defense).toBeGreaterThanOrEqual(0);
  });

  it("engorda mais rapido do que machuca, senao nao da pra matar", () => {
    // hp tem de acompanhar o dano, ou um mob forte fica imortal
    expect(
      CREATURE_GROWTH.hpPerLevel,
    ).toBeGreaterThanOrEqual(
      CREATURE_GROWTH.damagePerLevel,
    );

    expect(
      CREATURE_GROWTH.damagePerLevel,
    ).toBeGreaterThan(
      CREATURE_GROWTH.defensePerLevel,
    );
  });

  it("resolve nivel invalido para 1", () => {
    const type = CREATURE_TYPES.slime;

    expect(resolveLevel(type, 0)).toBe(1);
    expect(resolveLevel(type, -5)).toBe(1);
    expect(resolveLevel(type, undefined)).toBe(type.level);
    expect(resolveLevel(type, 7.4)).toBe(7);
  });
});

describe("criaturas com nivel", () => {
  it("guarda o nivel e o nivel base", () => {
    const enemy = at("goblin", 7);

    expect(enemy.level).toBe(7);
    expect(enemy.baseLevel).toBe(CREATURE_TYPES.goblin.level);
  });

  it("comeca com a vida cheia do nivel escalado", () => {
    const enemy = at("goblin", 8);

    expect(enemy.hp).toBe(enemy.maxHp);
  });

  it("usa o nivel base quando nenhum e informado", () => {
    const enemy = createCreature(
      "ghoul",
      { x: 0, y: 0 },
      0,
    );

    expect(enemy.level).toBe(CREATURE_TYPES.ghoul.level);
    expect(enemy.damage).toBe(CREATURE_TYPES.ghoul.damage);
  });

  /**
 * A LINHA DO ROSTER de uma criatura, pelo lugar onde ela nasceu.
 *
 * O que importa aqui e o `niveis`, e ele vive no `ZONE_ROSTER`, nao na
 * zona: a faixa de nivel e uma declaracao do roster de spawn, e a zona
 * em `MAP_1_ZONES` so sabe do retangulo. Uma versao deste helper que
 * lesse a zona devolveria `niveis` sempre indefinido, e o teste cairia
 * no ramo do `LEVEL_TIERS` — passando pelo motivo errado
 */
function rosterDe(enemy) {
  const zona = MAP_1_ZONES.find(
    (z) =>
      enemy.x >= z.x &&
      enemy.x <= z.x + z.width &&
      enemy.y >= z.y &&
      enemy.y <= z.y + z.height,
  );

  if (!zona) return null;

  return ZONE_ROSTER.find((r) => r.zone === zona.id) ?? null;
}

  it("sobe de nivel no roster", () => {
    const roster = createCreatureRoster();

    for (const enemy of roster) {
      const type = CREATURE_TYPES[
        enemy.id.replace(/_\d+$/, "")
      ];

      const linhaDoRoster = rosterDe(enemy);

      const linha =
        `${enemy.id} @ ${linhaDoRoster?.zone ?? "?"}`;

      /**
       * Uma linha com `niveisPorTipo` tem o nivel ESCRITO por tipo.
       *
       * O campo de provas tem dois niveis no mesmo campo — limo 6 e
       * ogre 7 — e o `niveis` da zona e um intervalo so, entao ele nao
       * da para expressar os dois. E o que o `niveisPorTipo` faz
       */
      if (linhaDoRoster?.niveisPorTipo) {
        const nivel = linhaDoRoster.niveisPorTipo[enemy.typeId];

        if (nivel !== undefined) {
          expect(enemy.level, linha).toBe(nivel);

          continue;
        }
      }

      /**
       * Uma linha com `niveis` tem a FAIXA DELA, e a do `LEVEL_TIERS`
       * nao se aplica.
       *
       * A regra original era "todo spawn fica entre a base do tipo e a
       * base mais o maior tier". Ela valia quando nenhuma zona declarava
       * nivel proprio, e as seis zonas de limo da progressao
       * declaram. Um limo de nivel 4 nas Cinzas esta dentro do `[4, 4]`
       * que a zona pediu e fora do `1..3` que este teste assumia
       *
       * Declarar a faixa no roster e o que permite um degrau de nivel 4
       * num jogo de criaturas de nivel 1: sem esta ressalva, a progressao
       * seria impossivel de escrever
       */
      if (linhaDoRoster?.niveis) {
        const [min, max] = linhaDoRoster.niveis;

        expect(enemy.level, linha).toBeGreaterThanOrEqual(min);

        expect(enemy.level, linha).toBeLessThanOrEqual(max);

        continue;
      }

      expect(enemy.level, linha).toBeGreaterThanOrEqual(
        type.level,
      );

      expect(enemy.level, linha).toBeLessThanOrEqual(
        type.level + Math.max(...LEVEL_TIERS),
      );
    }
  });

  it("mantem o roster deterministico", () => {
    const first = createCreatureRoster().map(
      (enemy) => enemy.level,
    );
    const second = createCreatureRoster().map(
      (enemy) => enemy.level,
    );

    expect(first).toEqual(second);
  });

  it("produz criaturas de niveis diferentes para voce escolher alvo", () => {
    const levels = new Set(
      createCreatureRoster().map((enemy) => enemy.level),
    );

    // nivel alto tem que ser uma excecao, nao a regra
    expect(LEVEL_TIERS.filter((tier) => tier === 0).length)
      .toBeGreaterThan(LEVEL_TIERS.length / 2);

    expect(levels.size).toBeGreaterThan(1);
  });

  it("da mais xp para o nivel mais alto do mesmo tipo", () => {
    const low = at("skeleton", 11);
    const high = at("skeleton", 13);

    expect(
      xpForKill(high),
      high.level,
    ).toBeGreaterThan(xpForKill(low));
  });
});

describe("bonecos de treino", () => {
  it("ficam no nivel 1 e sem escala", () => {
    for (const dummy of createTrainingDummies()) {
      expect(dummy.level).toBe(1);
      expect(dummy.hp).toBe(dummy.maxHp);
    }
  });
});

/**
 * O PANTANO PROFUNDO, que e a zona de ENTRADA do vale.
 *
 * E o primeiro lugar que o jogador ve depois de atravessar o portal que
 * vem do hub. O pedido: apenas Limo Preguiçoso, nivel 1 a 2
 *
 * ## POR QUE VARIAS SEMENTES
 *
 * O sorteio do roster e `Math.random` no jogo, e o `LEVEL_TIERS` global
 * tem tres zeros em cinco. Uma unica semente teria 3/5 de chance de dar
 * so limos de nivel 1 — e passaria mesmo sem o `niveis` da zona existir.
 * A travacao precisa de varias sementes para provar que o numero e
 * ESTAVEISVEL e nao sorteado
 */
describe("o pantano profundo", () => {
  const dentroDoPantano = (roster) => {
    const zona = MAP_1_ZONES.find((z) => z.id === "pantano");

    return roster.filter(
      (enemy) =>
        enemy.x >= zona.x &&
        enemy.x <= zona.x + zona.width &&
        enemy.y >= zona.y &&
        enemy.y <= zona.y + zona.height,
    );
  };

  it("so tem Limo Preguisoso", () => {
    const tipos = new Set(
      dentroDoPantano(createCreatureRoster()).map((enemy) =>
        enemy.id.replace(/_\d+$/, ""),
      ),
    );

    /**
     * `toEqual` com um conjunto de um elemento, e nao `toContain`.
     *
     * `toContain("slime")` passaria com o ogre de nivel 15 na zona —
     * que e exatamente o defeito que este teste existe para travar
     */
    expect([...tipos]).toEqual(["slime"]);
  });

  it("spawna alguma coisa", () => {
    expect(
      dentroDoPantano(createCreatureRoster()).length,
    ).toBeGreaterThan(0);
  });

  it("todo mundo esta entre o nivel 1 e o 2", () => {
    for (const inimigo of dentroDoPantano(createCreatureRoster())) {
      expect(inimigo.level, inimigo.id).toBeGreaterThanOrEqual(1);
      expect(inimigo.level, inimigo.id).toBeLessThanOrEqual(2);
    }
  });

  it("o nivel 1 a 2 vale para QUALQUER semente", () => {
    for (const semente of [1, 2, 3, 7, 11, 42, 99, 1234, 99999]) {
      const dentro = dentroDoPantano(
        createCreatureRoster(MAP_1, semente),
      );

      expect(dentro.length, `semente ${semente}`).toBeGreaterThan(0);

      for (const inimigo of dentro) {
        expect(inimigo.id, `semente ${semente}`).toMatch(/^slime_\d+$/);

        expect(
          inimigo.level,
          `semente ${semente}, ${inimigo.id}`,
        ).toBeGreaterThanOrEqual(1);

        expect(
          inimigo.level,
          `semente ${semente}, ${inimigo.id}`,
        ).toBeLessThanOrEqual(2);
      }
    }
  });

  it("o nivel 3 do limo NAO aparece aqui", () => {
    /**
     * O `LEVEL_TIERS` global sobe 2 acima da base, e a base do limo e 1.
     *
     * Sem o `niveis: [1, 2]` da zona, um limo de nivel 3 apareceria
     * aqui. Este e o numero exato que o campo segura, e nao um detalhe
     * de frase
     */
    const niveis = new Set();

    for (const semente of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      for (const inimigo of dentroDoPantano(
        createCreatureRoster(MAP_1, semente),
      )) {
        niveis.add(inimigo.level);
      }
    }

    expect([...niveis].sort()).toEqual([1, 2]);
  });

  it("a zona e `passive`, porque so tem limo", () => {
    /**
     * O `kind` acompanha o que mora na zona.
     *
     * O limo e PASSIVE. Deixar a zona como `active` era o dado mentindo
     * sobre o Pantano, e nenhum jogo le `kind` alem da checagem de
     * `training` — entao a mentira nao custava nada em tela, e por isso
     * ela precisa de teste
     */
    const zona = MAP_1_ZONES.find((z) => z.id === "pantano");

    expect(zona.kind).toBe("passive");

    for (const inimigo of dentroDoPantano(createCreatureRoster())) {
      expect(inimigo.behavior).toBe(BEHAVIOR.PASSIVE);
    }
  });

  it("o resto do vale continua com as criaturas dele", () => {
    /**
     * A mudanca e LOCAL do Pantano.
     *
     * Sem esta asercao, um `mix` quebrado que esvaziasse todas as
     * zonas passaria no teste do Pantano — o jogador entraria por uma
     * zona vazia e o vale inteiro estaria limpo
     */
    const roster = createCreatureRoster(MAP_1, 42);

    const dentro = new Set(dentroDoPantano(roster));

    const foraDoPantano = roster.filter(
      (enemy) => !dentro.has(enemy),
    );

    expect(foraDoPantano.length).toBeGreaterThan(0);

    const tipos = new Set(
      foraDoPantano.map((e) => e.id.replace(/_\d+$/, "")),
    );

    // o resto do vale mantem a variedade: ogre, ghoul, esqueleto, goblin
    expect(tipos.size).toBeGreaterThan(3);
  });
});

/**
 * A PEDREIRA DO OGRO, o degrau DEPOIS do Pantano.
 *
 * O pedido: apenas Limo Preguiçoso, nivel 2. E 2 e nao "1 a 2" porque a
 * zona vem logo depois do Pantano na progressao — o jogador que
 * sobreviveu aos limos de nivel 1 e 2 do Pantano encontra aqui os de
 * nivel 2
 *
 * ## NINGUEM SAI DO JOGO
 *
 * A zona tinha ogre, esqueleto e goblin. As tres vivem em outras zonas,
 * e o bestiario continua com as tres — o que muda e para ONDE o "ir
 * matar" leva. O teste fecha isso, porque uma bestiaria sem zona e um
 * botao que nao sabe para onde ir
 */
describe("a pedreira do ogro", () => {
  const dentroDaPedreira = (roster) => {
    const zona = MAP_1_ZONES.find((z) => z.id === "pedreira");

    return roster.filter(
      (enemy) =>
        enemy.x >= zona.x &&
        enemy.x <= zona.x + zona.width &&
        enemy.y >= zona.y &&
        enemy.y <= zona.y + zona.height,
    );
  };

  it("so tem Limo Preguisoso", () => {
    const tipos = new Set(
      dentroDaPedreira(createCreatureRoster()).map((enemy) =>
        enemy.id.replace(/_\d+$/, ""),
      ),
    );

    expect([...tipos]).toEqual(["slime"]);
  });

  it("todo mundo e do nivel 2, sem excecao", () => {
    /**
     * `[2, 2]`, e nao "2 ou mais".
     *
     * A distincao importa porque `niveis: [1, 2]` e `niveis: [2, 2]`
     * produzem zonas quase iguais, e um `toBeGreaterThanOrEqual(1)`
     * passaria nas duas. E o `2` exato e o que separa o degrau do
     * Pantano do degrau seguinte
     */
    for (const inimigo of dentroDaPedreira(createCreatureRoster())) {
      expect(inimigo.level, inimigo.id).toBe(2);
    }
  });

  it("o nivel 2 vale para QUALQUER semente", () => {
    for (const semente of [1, 2, 3, 7, 42, 99, 1234, 99999]) {
      const dentro = dentroDaPedreira(
        createCreatureRoster(MAP_1, semente),
      );

      expect(dentro.length, `semente ${semente}`).toBeGreaterThan(0);

      for (const inimigo of dentro) {
        expect(inimigo.id, `semente ${semente}`).toMatch(/^slime_\d+$/);

        expect(inimigo.level, `semente ${semente}, ${inimigo.id}`)
          .toBe(2);
      }
    }
  });

  it("a zona e `passive`, porque so tem limo", () => {
    const zona = MAP_1_ZONES.find((z) => z.id === "pedreira");

    expect(zona.kind).toBe("passive");

    for (const inimigo of dentroDaPedreira(createCreatureRoster())) {
      expect(inimigo.behavior).toBe(BEHAVIOR.PASSIVE);
    }
  });

  it("ninguem PERDEU a zona no bestiario", () => {
    /**
     * As tres criaturas que sairam da pedreira.
     *
     * Sem esta asercao, esvaziar a zona por acidente apagaria o
     * "ir matar" do ogre — o botao ficaria ativo e nao levaria a lugar
     * nenhum, sem erro nenhum na tela
     */
    const bestiario = BESTIARY;

    for (const creatureId of ["ogre", "skeleton", "goblin"]) {
      const entrada = bestiario.find(
        (e) => e.creatureId === creatureId,
      );

      expect(entrada, creatureId).toBeTruthy();

      expect(entrada.zoneId, `${creatureId} ficou sem zona`)
        .toBeTruthy();

      expect(entrada.zoneName, `${creatureId} ficou sem zona`)
        .toBeTruthy();
    }
  });

  it("a bestiaria do limo aponta para o degrau mais FACIL", () => {
    /**
     * As tres zonas de limo estao empatadas em `slime: 100`.
     *
     * O `zoneOf` foi mudado para escolher a de MENOR nivel medio, com o
     * peso do mix como desempate. Sem isso, o desempate era a ordem do
     * array e o "ir matar limo" apontava para as Dunas (nivel 3) — o
     * degrau mais avancado, que e o contrario do que um bestiario deve
     * fazer
     *
     * Este teste trava o RESULTADO e nao a ordem: ele passaria com
     * qualquer declaracao do `ZONE_ROSTER`, e e por isso que o teste de
     * "ninguem perdeu a zona" acima ainda importa
     */
    const limo = BESTIARY.find((e) => e.creatureId === "slime");

    expect(limo.zoneId).toBe("pantano");
  });

  it("a escolha da zona NAO depende da ordem do array", () => {
    /**
     * O teste que pega o defeito de verdade.
     *
     * Um teste que so conferisse o resultado do `BESTIARY` passaria com
     * o `zoneOf` antigo: o array antigo produzia aquele numero por
     * coincidencia de ordem. Aqui o array e INVERTIDO e a `zoneOf` e
     * chamada de novo — e o `zoneOf` le o `ZONE_ROSTER` a cada chamada,
     * entao a inversao vale
     *
     * E por isso que `zoneOf` e exportada: o `BESTIARY` ja foi
     * construido no load do modulo e nao responderia a nada
     */
    const original = [...ZONE_ROSTER];

    try {
      const antes = {};

      for (const typeId of Object.keys(CREATURE_TYPES)) {
        antes[typeId] = zoneOf(typeId)?.id ?? null;
      }

      ZONE_ROSTER.length = 0;
      ZONE_ROSTER.push(...[...original].reverse());

      for (const typeId of Object.keys(CREATURE_TYPES)) {
        expect(
          zoneOf(typeId)?.id ?? null,
          `${typeId} mudou com o roster invertido`,
        ).toBe(antes[typeId]);
      }

      // o limo continua no Pantano: e o mais facil dos tres
      expect(zoneOf("slime")?.id).toBe("pantano");
    } finally {
      ZONE_ROSTER.length = 0;
      ZONE_ROSTER.push(...original);
    }
  });
});

/**
 * As DUNAS PERDIDAS, o terceiro degrau de limo.
 *
 * A sequencia que o jogador percorre atravessando o portal do hub:
 * Pantano (1 e 2), Pedreira (2), Dunas (3). As tres tem um tipo so, e o
 * nivel sobe de uma em uma
 */
describe("as dunas perdidas", () => {
  const dentroDasDunas = (roster) => {
    const zona = MAP_1_ZONES.find((z) => z.id === "dunas");

    return roster.filter(
      (enemy) =>
        enemy.x >= zona.x &&
        enemy.x <= zona.x + zona.width &&
        enemy.y >= zona.y &&
        enemy.y <= zona.y + zona.height,
    );
  };

  it("so tem Limo Preguisoso", () => {
    const tipos = new Set(
      dentroDasDunas(createCreatureRoster()).map((enemy) =>
        enemy.id.replace(/_\d+$/, ""),
      ),
    );

    expect([...tipos]).toEqual(["slime"]);
  });

  it("todo mundo e do nivel 3, sem excecao", () => {
    for (const inimigo of dentroDasDunas(createCreatureRoster())) {
      expect(inimigo.level, inimigo.id).toBe(3);
    }
  });

  it("o nivel 3 vale para QUALQUER semente", () => {
    for (const semente of [1, 2, 3, 7, 42, 99, 1234, 99999]) {
      const dentro = dentroDasDunas(
        createCreatureRoster(MAP_1, semente),
      );

      expect(dentro.length, `semente ${semente}`).toBeGreaterThan(0);

      for (const inimigo of dentro) {
        expect(inimigo.id, `semente ${semente}`).toMatch(/^slime_\d+$/);

        expect(inimigo.level, `semente ${semente}, ${inimigo.id}`)
          .toBe(3);
      }
    }
  });

  it("a zona e `passive`, porque so tem limo", () => {
    const zona = MAP_1_ZONES.find((z) => z.id === "dunas");

    expect(zona.kind).toBe("passive");

    for (const inimigo of dentroDasDunas(createCreatureRoster())) {
      expect(inimigo.behavior).toBe(BEHAVIOR.PASSIVE);
    }
  });

  it("ninguem PERDEU a zona no bestiario", () => {
    /**
     * As tres criaturas que sairam das Dunas.
     *
     * Goblin, rat e ogre vivem em outras zonas com peso maior, entao
     * continuam no bestiario. Sem esta asercao, esvaziar a zona por
     * acidente apagaria o "ir matar" de alguma delas — e o botao ficaria
     * ativo sem levar a lugar nenhum
     */
    for (const creatureId of ["goblin", "rat", "ogre"]) {
      const entrada = BESTIARY.find(
        (e) => e.creatureId === creatureId,
      );

      expect(entrada, creatureId).toBeTruthy();

      expect(entrada.zoneId, `${creatureId} ficou sem zona`)
        .toBeTruthy();
    }
  });

it("os tres degraus de limo estao em ordem crescente de nivel", () => {
    /**
     * A PROGRESSAO, e nao tres zonas soltas.
     *
     * Este teste e o que amarra as tres: o Pantano e o degrau 1, a
     * Pedreira e o 2 e as Dunas sao o 3. Sem ele, cada zona passando
     * isolada e a sequencia podia virar 3, 1, 2 sem nenhuma quebra
     */
    const nivelDe = (zoneId) => {
      const dentro = criarDoRoster(zoneId);

      const total = dentro.reduce((acc, e) => acc + e.level, 0);

      return total / dentro.length;
    };

    const pantano = nivelDe("pantano");
    const pedreira = nivelDe("pedreira");
    const dunas = nivelDe("dunas");

    expect(pantano, `pantano em ${pantano}`).toBeLessThan(pedreira);

    expect(pedreira, `pedreira em ${pedreira}`).toBeLessThan(dunas);

    expect(dunas, `dunas em ${dunas}`).toBe(3);
  });
});

/**
 * O VALE DAS CINZAS, o quarto degrau de limo.
 *
 * Fecha a sequencia: Pantano (1 e 2), Pedreira (2), Dunas (3), Cinzas
 * (4). Cada zona tem um tipo so, e o nivel sobe de uma em uma
 */
describe("o vale das cinzas", () => {
  it("so tem Limo Preguisoso", () => {
    const tipos = new Set(
      criarDoRoster("cinzas").map((enemy) =>
        enemy.id.replace(/_\d+$/, ""),
      ),
    );

    expect([...tipos]).toEqual(["slime"]);
  });

  it("todo mundo e do nivel 4, sem excecao", () => {
    for (const inimigo of criarDoRoster("cinzas")) {
      expect(inimigo.level, inimigo.id).toBe(4);
    }
  });

  it("o nivel 4 vale para QUALQUER semente", () => {
    for (const semente of [1, 2, 3, 7, 42, 99, 1234, 99999]) {
      const dentro = criarDoRoster("cinzas", semente);

      expect(dentro.length, `semente ${semente}`).toBeGreaterThan(0);

      for (const inimigo of dentro) {
        expect(inimigo.id, `semente ${semente}`).toMatch(/^slime_\d+$/);

        expect(inimigo.level, `semente ${semente}, ${inimigo.id}`)
          .toBe(4);
      }
    }
  });

  it("a zona e `passive`, porque so tem limo", () => {
    const zona = MAP_1_ZONES.find((z) => z.id === "cinzas");

    expect(zona.kind).toBe("passive");

    for (const inimigo of criarDoRoster("cinzas")) {
      expect(inimigo.behavior).toBe(BEHAVIOR.PASSIVE);
    }
  });

  it("ninguem PERDEU a zona no bestiario", () => {
    /**
     * As tres criaturas que sairam das Cinzas.
     *
     * Ogre, ghoul e esqueleto vivem em outras zonas. Sem esta asercao,
     * esvaziar a zona por acidente apagaria o "ir matar" de alguma delas
     * — e o botao ficaria ativo sem levar a lugar nenhum
     */
    for (const creatureId of ["ogre", "ghoul", "skeleton"]) {
      const entrada = BESTIARY.find(
        (e) => e.creatureId === creatureId,
      );

      expect(entrada, creatureId).toBeTruthy();

      expect(entrada.zoneId, `${creatureId} ficou sem zona`)
        .toBeTruthy();
    }
  });

it("as SEIS zonas de limo estao em ordem crescente de nivel", () => {
    /**
     * A PROGRESSAO INTEIRA, e nao seis zonas soltas.
     *
     * Este e o teste que amarra a sequencia. Cada zona passa sozinha em
     * outros testes deste arquivo, e sem este a ordem podia virar
     * 6, 1, 5, 2, 4, 3 sem nenhuma quebra — com o jogador encontrando um
     * limo de nivel 6 na primeira zona que cruzasse
     *
     * ## POR QUE AS FAIXAS DECLARADAS, E NAO A MEDIA AMOSTRADA
     *
     * A media do que foi sorteado depende da semente: o Pantano declara
     * `[1, 2]`, e com a semente 42 ele sorteia quatro de nivel 2 e tres
     * de nivel 1, dando media 1.5714 em vez de 1.5. Um `toBe(1.5)`
     * sobre a media passaria ou falharia conforme a sorte, sem que nada
     * do jogo tivesse mudado
     *
     * O contrato e das faixas: o maximo de um degrau tem de caber no
     * minimo do seguinte. E o que nao depende de sorte
     */
    const faixaDe = (zoneId) => {
      const linha = ZONE_ROSTER.find((r) => r.zone === zoneId);

      expect(linha, zoneId).toBeTruthy();

      expect(linha.niveis, `${zoneId} sem niveis`).toBeTruthy();

      return linha.niveis;
    };

    /**
     * A ordem e de NIVEL, e nao de onde a zona esta no mapa.
     *
     * A Toca fica no canto superior esquerdo do vale e o Pantano no
     * inferior direito: a progressao atravessa o vale em zigue-zague.
     * A lista esta em ordem de dificuldade, e nao de posicao — que e o
     * que faz o "ir matar limo" poder comecar no degrau 1
     */
    const degraus = DEGRAUS_DE_LIMO;

    for (let i = 1; i < degraus.length; i += 1) {
      const anterior = faixaDe(degraus[i - 1]);
      const atual = faixaDe(degraus[i]);

      expect(
        atual[0],
        `${degraus[i]} comeca em ${atual[0]}, ` +
          `abaixo do fim de ${degraus[i - 1]} (${anterior[1]})`,
      ).toBeGreaterThanOrEqual(anterior[1]);
    }

    expect(faixaDe("pantano")).toEqual([1, 2]);
    expect(faixaDe("pedreira")).toEqual([2, 2]);
    expect(faixaDe("dunas")).toEqual([3, 3]);
    expect(faixaDe("cinzas")).toEqual([4, 4]);
    expect(faixaDe("toca")).toEqual([5, 5]);
    expect(faixaDe("brejo")).toEqual([6, 6]);
  });

  it("cada degrau spawna NA SUA faixa, e nao na do vizinho", () => {
    /**
     * A faixa declarada e o que o motor honra.
     *
     * A progressao acima prova que as faixas se encostam em ordem. Esta
     * prova que o spawn respeita cada uma: um `[3, 3]` honrado por um
     * `[1, 2]` na Dunas faria o teste da ordem passar e o jogador
     * encontrar limos de nivel 1 no quarto degrau
     */
    const esperado = {
      pantano: [1, 2],
      pedreira: [2, 2],
      dunas: [3, 3],
      cinzas: [4, 4],
      toca: [5, 5],
      brejo: [6, 6],
    };

    for (const [zoneId, [min, max]] of Object.entries(esperado)) {
      const dentro = criarDoRoster(zoneId);

      expect(dentro.length, zoneId).toBeGreaterThan(0);

      for (const inimigo of dentro) {
        expect(inimigo.level, `${zoneId}: ${inimigo.id}`)
          .toBeGreaterThanOrEqual(min);

        expect(inimigo.level, `${zoneId}: ${inimigo.id}`)
          .toBeLessThanOrEqual(max);
      }
    }
  });

  it("a bestiaria do limo continua no degrau mais FACIL", () => {
    /**
     * Seis zonas empatadas em `slime: 100`, e o destino nao pode ser
     * a ultima nem a que estiver primeiro no array. E o degrau 1
     */
    const limo = BESTIARY.find((e) => e.creatureId === "slime");

    expect(limo.zoneId).toBe("pantano");

expect(zoneOf("slime")?.id).toBe("pantano");
  });
});

/**
 * A TOCA DOS RATOS, o quinto e ultimo degrau de limo.
 *
 * Fecha a sequencia: Pantano (1 e 2), Pedreira (2), Dunas (3), Cinzas
 * (4), Toca (5). Cada zona tem um tipo so, e o nivel sobe de uma em uma
 *
 * ## O RATO E O CASO DIFICIL DESTA ZONA
 *
 * A Toca era o lugar de MAIOR peso do rato (70), e o nome da zona era
 * dele. O que sobra e o Brejo com 20, contra 18 do Acampamento e 12 da
 * Floresta — uma margem de dois pontos, a menor de todo o bestiario. E
 * por isso que a mudanca de zona do rato e testada pelo nome: uma
 * regra de desempate mal escrita devolveria o Acampamento
 */
describe("a toca dos ratos", () => {
  it("so tem Limo Preguisoso", () => {
    const tipos = new Set(
      criarDoRoster("toca").map((enemy) =>
        enemy.id.replace(/_\d+$/, ""),
      ),
    );

    expect([...tipos]).toEqual(["slime"]);
  });

  it("todo mundo e do nivel 5, sem excecao", () => {
    for (const inimigo of criarDoRoster("toca")) {
      expect(inimigo.level, inimigo.id).toBe(5);
    }
  });

  it("o nivel 5 vale para QUALQUER semente", () => {
    for (const semente of [1, 2, 3, 7, 42, 99, 1234, 99999]) {
      const dentro = criarDoRoster("toca", semente);

      expect(dentro.length, `semente ${semente}`).toBeGreaterThan(0);

      for (const inimigo of dentro) {
        expect(inimigo.id, `semente ${semente}`).toMatch(/^slime_\d+$/);

        expect(inimigo.level, `semente ${semente}, ${inimigo.id}`)
          .toBe(5);
      }
    }
  });

  it("a zona continua `passive`", () => {
    /**
     * A Toca JA era `passive`, com os ratos dentro — o rat e
     * PASSIVE. Encher a zona de limo, que tambem e, nao mudou nada
     *
     * O teste esta aqui porque as outras quatro zonas da progressao
     * precisaram de `kind` mudado, e essa ser a unica que ja estava
     * certa. Sem ele, ninguem conferiria
     */
    const zona = MAP_1_ZONES.find((z) => z.id === "toca");

    expect(zona.kind).toBe("passive");

    for (const inimigo of criarDoRoster("toca")) {
      expect(inimigo.behavior).toBe(BEHAVIOR.PASSIVE);
    }
  });

  it("o rato perdeu a casa duas vezes: Toca, Brejo, Acampamento", () => {
    /**
     * A ONDA DE MUDANCAS que o rato tomou.
     *
     * Ele comecou na Toca com peso 70, que era o lugar de maior peso dele
     * e o nome da zona. Cada degrau de limo que engoliu uma zona onde ele
     * vivia jogou o rato para a seguinte, e a margem foi encolhendo: 20
     * contra 18 no Brejo, e agora 18 contra 12 no Acampamento
     *
     * Este teste conta a historia em vez de so travar o numero, porque o
     * proximo degrau de limo vai mexer aqui de novo e o padrao e o que
     * precisa continuar valendo
     */
    const pesos = ZONE_ROSTER.filter((r) => r.mix.rat)
      .map((r) => [r.zone, r.mix.rat])
      .sort((a, b) => b[1] - a[1]);

    expect(pesos[0][0]).toBe("acampamento");

    /**
     * A ZONA ONDE ELE VIVE TEM QUE EXISTIR PARA O RATO.
     *
     * Com seis das onze zonas virarem degrau de limo, o rato ficou com
     * duas. E o que impede que a proxima vez o deixe sem nenhuma: o
     * `zoneId` do bestiario viraria `null`, o botao "ir matar" ficaria
     * ativo sem levar a lugar nenhum, e o jogador veria um rato que nao
     * se acha em lugar nenhum do mapa
     */
    expect(pesos.length, "o rato nao tem mais nenhuma zona").toBeGreaterThan(
      1,
    );

    const rato = BESTIARY.find((e) => e.creatureId === "rat");

    expect(rato.zoneId).toBe("acampamento");

    // e nenhuma das zonas de degrau ainda tem rato
    for (const degrau of DEGRAUS_DE_LIMO) {
      expect(
        ZONE_ROSTER.find((r) => r.zone === degrau).mix.rat,
        `a zona de degrau ${degrau} tem rato no mix`,
      ).toBeUndefined();
    }
  });

  it("ninguem PERDEU a zona no bestiario", () => {
    for (const creatureId of ["rat", "goblin"]) {
      const entrada = BESTIARY.find(
        (e) => e.creatureId === creatureId,
      );

      expect(entrada, creatureId).toBeTruthy();

      expect(entrada.zoneId, `${creatureId} ficou sem zona`)
        .toBeTruthy();
    }
  });
});

/**
 * O BREJO LENTO, o sexto e ULTIMO degrau de limo.
 *
 * Fecha a sequencia: Pantano (1 e 2), Pedreira (2), Dunas (3), Cinzas
 * (4), Toca (5), Brejo (6). O Brejo e onde a progressao volta para a
 * direita, no meio da linha de cima
 *
 * ## ESTE E O DEGRAU QUE AVISA
 *
 * Com seis das onze zonas virarem degrau de limo, sobraram cinco zonas
 * com criaturas de verdade. O rato ficou com DUAS, o goblin com uma
 * dominante, e o resto se divide entre Ruinas e Cripta. O teste de
 * "ninguem perdeu a zona" e o que avisa quando a proxima conversao
 * deixar uma criatura sem para onde o bestiario mandar o jogador
 */
describe("o brejo lento", () => {
  it("so tem Limo Preguisoso", () => {
    const tipos = new Set(
      criarDoRoster("brejo").map((enemy) =>
        enemy.id.replace(/_\d+$/, ""),
      ),
    );

    expect([...tipos]).toEqual(["slime"]);
  });

  it("todo mundo e do nivel 6, sem excecao", () => {
    for (const inimigo of criarDoRoster("brejo")) {
      expect(inimigo.level, inimigo.id).toBe(6);
    }
  });

  it("o nivel 6 vale para QUALQUER semente", () => {
    for (const semente of [1, 2, 3, 7, 42, 99, 1234, 99999]) {
      const dentro = criarDoRoster("brejo", semente);

      expect(dentro.length, `semente ${semente}`).toBeGreaterThan(0);

      for (const inimigo of dentro) {
        expect(inimigo.id, `semente ${semente}`).toMatch(/^slime_\d+$/);

        expect(inimigo.level, `semente ${semente}, ${inimigo.id}`)
          .toBe(6);
      }
    }
  });

  it("a zona continua `passive`", () => {
    /**
     * O Brejo JA era `passive`, com o rato dentro — o rat e PASSIVE.
     * Encher a zona de limo, que tambem e, nao mudou nada
     */
    const zona = MAP_1_ZONES.find((z) => z.id === "brejo");

    expect(zona.kind).toBe("passive");

    for (const inimigo of criarDoRoster("brejo")) {
      expect(inimigo.behavior).toBe(BEHAVIOR.PASSIVE);
    }
  });

  it("ninguem PERDEU a zona no bestiario", () => {
    /**
     * As DUAS criaturas que sairam do Brejo.
     *
     * Rato e ghoul. O ghoul continua nas Ruinas (62, o maior peso de
     * todos). O rato ficou com o Acampamento (18) contra a Floresta (12)
     *
     * A asercao importante aqui e que TODA criatura do bestiario ainda
     * tem zona — o `zoneId: null` que apareceria se a proxima conversao
     * esvaziasse a ultima zona de alguma criatura
     */
    for (const entrada of BESTIARY) {
      expect(entrada.zoneId, `${entrada.creatureId} ficou sem zona`)
        .toBeTruthy();
    }
  });

  it("so restam SEIS zonas com criaturas de verdade", () => {
    /**
     * O BALANCO da conversao, medido.
     *
     * Doze zonas, seis viraram degrau de limo, e o campo de provas
     * ganhou um par. Este numero e o que explica por que o rato e o
     * goblin dividem o Acampamento: as zonas que sobraram se dividem
     * entre si
     */
    const comCriaturas = ZONE_ROSTER.filter(
      (r) => !DEGRAUS_DE_LIMO.includes(r.zone),
    );

    expect(comCriaturas.map((r) => r.zone).sort()).toEqual([
      "acampamento",
      "campina",
      "cripta",
      "floresta",
      "ruinas",
      "treino",
    ]);
  });
});
