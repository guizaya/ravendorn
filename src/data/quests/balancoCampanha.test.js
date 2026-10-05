import { describe, expect, it } from "vitest";
import {
  MAIN_QUESTS,
  SIDE_QUESTS,
  ALL_QUESTS,
  getSideFor,
} from "../../data/quests/index.js";
import {
  CREATURE_TYPES,
  scaleForLevel,
  createCreatureRoster,
} from "../../data/enemies/index.js";
import { MAP_1_ZONES, MAP_2_ZONES, getMap } from "../../data/maps/index.js";
import { xpForKill } from "../../game/progression/Levels.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";

/**
 * O BALANCEAMENTO DA CAMPANHA DO MAPA 1.
 *
 * ## A REGRA DO JOGADOR
 *
 * O ouro e o XP que um mob do campo dropa nao podem ser maiores que os
 * da missao daquele campo. E o que mantem a missao valendo mais que o
 * farm: se limpar a zona rendesse mais do que a missao, o jogador
 * ignoraria a missao e o painel viraria enfeite
 *
 * O piso e por UM MOB, e nao pela zona inteira. A zona tem 7 a 14
 * criaturas, e o total delas sempre passa da missao — foi assim que a
 * primeira versao deste balanceamento ficou com 1.100 de ouro na Cripta
 * contra 96 da missao
 *
 * ## O NIVEL BASE DE CADA TIPO
 *
 * `level` no tipo e o ponto de partida da escala, e nao o nivel de um
 * bicho "de verdade": o `scaleForLevel` faz `steps = nivel_da_zona -
 * level`. Com o `ogre` base 15 e as zonas nos niveis 8 a 12, o HP
 * caia no piso de 1 e o mob morria de um golpe
 */

const classe = CHARACTER_CLASSES.find((c) => c.id === "warrior");

/**
 * a criatura da zona que a missao pede, NO NIVEL DELA.
 *
 * O `level` no filtro importa: o Pantano tem `niveis: [1, 2]`, entao as
 * duas primeiras missoes apontam para a MESMA zona. Sem o filtro de
 * nivel, as duas comparavam com o mesmo bicho e o teste "o HP sobe com o
 * nivel" reprovava com 183 contra 183
 */
/**
 * A CRIATURA DA ZONA QUE A MISSAO PEDE, NO NIVEL DELA.
 *
 * ## POR QUE ESTE HELPER PRECISA DO MAPA
 *
 * A campanha e uma escada so, do mapa 1 para o mapa 2, e as zonas do
 * mapa 2 tem o prefixo `m2_`. O helper recebia so a missao e ia buscar a
 * criatura no roster do mapa 1 e o retangulo em `MAP_1_ZONES` — o
 * `zona` saia `undefined` para toda missao do mapa 2, o `find` devolvia
 * `null`, e tres testes rebentavam com "cannot read maxHp of null"
 *
 * E o `roster` tambem: o elenco do mapa 1 nao tem nem sentinela nem
 * arqueiro zumbi, que sao as duas criaturas do mapa 2
 */
const mapaDaMissao = (location) =>
  String(location ?? "").startsWith("m2_") ? "map_2" : "map_1";

const roster = createCreatureRoster();

const rosterPorMapa = new Map([["map_1", roster]]);

for (const id of ["map_2"]) {
  rosterPorMapa.set(id, createCreatureRoster(getMap(id)));
}

const zonasPorMapa = {
  map_1: MAP_1_ZONES,
  map_2: MAP_2_ZONES,
};

const mobDaMissao = (quest) => {
  const mapa = mapaDaMissao(quest.location);

  const zona = zonasPorMapa[mapa].find(
    (z) => z.id === quest.location,
  );

  if (!zona) {
    throw new Error(`zona desconhecida: ${quest.location}`);
  }

  return rosterPorMapa.get(mapa).find(
    (e) =>
      e.typeId === quest.target &&
      e.level === quest.minLevel &&
      e.x >= zona.x &&
      e.x <= zona.x + zona.width &&
      e.y >= zona.y &&
      e.y <= zona.y + zona.height,
  );
};

/** o PIOR caso do drop: o maximo do sorteio */
const goldMaximoDoMob = (quest) =>
  CREATURE_TYPES[quest.target].loot.coins.max;

describe("a recompensa da missao vale mais que o drop do campo", () => {
  it.each(MAIN_QUESTS.map((q) => [q.id, q]))(
    "principal %s paga mais ouro que um mob do campo",
    (_id, quest) => {
      expect(goldMaximoDoMob(quest)).toBeLessThanOrEqual(
        quest.rewards.coins,
      );
    },
  );

  it.each(MAIN_QUESTS.map((q) => [q.id, q]))(
    "principal %s paga mais xp que um mob do campo",
    (_id, quest) => {
      const mob = mobDaMissao(quest);

      expect(xpForKill(mob)).toBeLessThanOrEqual(quest.rewards.xp);
    },
  );

  it.each(SIDE_QUESTS.map((q) => [q.id, q]))(
    "secundaria %s paga mais ouro que um mob do campo",
    (_id, quest) => {
      expect(goldMaximoDoMob(quest)).toBeLessThanOrEqual(
        quest.rewards.coins,
      );
    },
  );

  it.each(SIDE_QUESTS.map((q) => [q.id, q]))(
    "secundaria %s paga mais xp que um mob do campo",
    (_id, quest) => {
      const mob = mobDaMissao(quest);

      expect(xpForKill(mob)).toBeLessThanOrEqual(quest.rewards.xp);
    },
  );
});

describe("o nivel base de cada tipo esta na escada", () => {
  it("nenhum tipo nasce com HP de 1", () => {
    /**
     * O sintoma do `steps` negativo: HP no piso, mob morre de um golpe e
     * da 1 de XP. Se algum tipo voltar a ter base acima da sua zona, o
     * `maxHp` de 1 aparece aqui
     */
    for (const quest of ALL_QUESTS) {
      const mob = mobDaMissao(quest);

      expect(
        mob.maxHp,
        `${quest.target} no nivel ${quest.minLevel} esta com HP de ${mob.maxHp}`,
      ).toBeGreaterThan(100);
    }
  });

  it("o HP sobe com o nivel dentro de um mesmo tipo", () => {
    const lances = MAIN_QUESTS.map((quest) => ({
      target: quest.target,
      level: quest.minLevel,
      maxHp: mobDaMissao(quest).maxHp,
    }));

    for (const tipo of new Set(lances.map((l) => l.target))) {
      const doTipo = lances.filter((l) => l.target === tipo);

      for (let i = 1; i < doTipo.length; i += 1) {
        expect(
          doTipo[i].maxHp,
          `${tipo} no nivel ${doTipo[i].level}`,
        ).toBeGreaterThan(doTipo[i - 1].maxHp);
      }
    }
  });
});

describe("a campanha sobe de nivel e de preco", () => {
  it("a quantidade cresce uma a uma", () => {
    for (let i = 1; i < MAIN_QUESTS.length; i += 1) {
      expect(MAIN_QUESTS[i].count).toBeGreaterThan(
        MAIN_QUESTS[i - 1].count,
      );
    }
  });

  it("a recompensa cresce com o nivel", () => {
    for (let i = 1; i < MAIN_QUESTS.length; i += 1) {
      expect(MAIN_QUESTS[i].rewards.coins).toBeGreaterThan(
        MAIN_QUESTS[i - 1].rewards.coins,
      );

      expect(MAIN_QUESTS[i].rewards.xp).toBeGreaterThanOrEqual(
        MAIN_QUESTS[i - 1].rewards.xp,
      );
    }
  });

  it("o nivel 1 cai em dozens de golpes, e nao em centenas", () => {
    /**
     * A DIFICULDADE de verdade.
     *
     * Com o dano antigo o limo tirava 7 e o lvl 1 vivia 297 golpes: nao
     * havia criatura perigosa no mapa, e a campanha era so volume. O
     * piso e o lvl 1 morrer em menos de 100 golpes na zona mais fraca e
     * em menos de 30 na mais forte
     */
    const mit = (dano, defesa) => dano * (100 / (100 + defesa));

    const hpNivel1 = classe.stats.hp + 26;
    const defNivel1 = classe.stats.defense + 2;

    const fraco = mobDaMissao(MAIN_QUESTS[0]);
    const forte = mobDaMissao(MAIN_QUESTS.at(-1));

    const golpesFraco = Math.ceil(
      hpNivel1 / mit(fraco.damage, defNivel1),
    );
    const golpesForte = Math.ceil(
      hpNivel1 / mit(forte.damage, defNivel1),
    );

    expect(golpesFraco).toBeLessThan(100);
    expect(golpesForte).toBeLessThan(30);

    // e a escalada e monotona: o topo e o degrau mais perigoso
    expect(golpesForte).toBeLessThan(golpesFraco);
  });

  it("o degrau 1 ainda cai rapido para o nivel 1", () => {
    /**
     * A DIFICULDADE nao pode virar PAREDE no comeco.
     *
     * Com 150 de HP e 2 de defesa, o limo do degrau 1 cai em 2 golpes do
     * ataque base da classe. Se isso subir, o primeiro degrau da campanha
     * vira um muro antes do jogador ter qualquer equipamento
     */
    const mob = mobDaMissao(MAIN_QUESTS[0]);

    const ataque = classe.stats.attack;

    const golpes = Math.ceil(
      mob.maxHp / (ataque * (100 / (100 + mob.defense))),
    );

    expect(golpes).toBeLessThanOrEqual(3);
  });
});

describe("a secundaria e metade da principal", () => {
  it("todo par tem a metade dos inimigos, na mesma zona e no mesmo nivel", () => {
    for (const main of MAIN_QUESTS) {
      const side = getSideFor(main.id);

      expect(side.count * 2, main.id).toBe(main.count);
      expect(side.location, main.id).toBe(main.location);
      expect(side.minLevel, main.id).toBe(main.minLevel);
      expect(side.target, main.id).toBe(main.target);
    }
  });

  it("ninguem quebra a regra do par", () => {
    for (const main of MAIN_QUESTS) {
      const side = getSideFor(main.id);

      expect(goldMaximoDoMob(side)).toBeLessThanOrEqual(
        side.rewards.coins,
      );
    }
  });
});

describe("o drop de um mob NAO passa da missao de nenhum jeito", () => {
  it("nem pelo maximo do sorteio, em nenhuma das 24 missoes", () => {
    /**
     * A varredura crua, sem o `it.each`.
     *
     * O `it.each` acima ja falha no primeiro caso; este aqui mostra
     * QUANTOS quebram de uma vez, que e o que facilita achar a linha
     * culpada quando um numero novo entrar na escada
     */
    const quebradas = ALL_QUESTS.filter((quest) => {
      const mob = mobDaMissao(quest);

      return (
        goldMaximoDoMob(quest) > quest.rewards.coins ||
        xpForKill(mob) > quest.rewards.xp
      );
    }).map((q) => q.id);

    expect(quebradas).toEqual([]);
  });
});