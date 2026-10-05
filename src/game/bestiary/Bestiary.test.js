import { describe, expect, it } from "vitest";
import { Bestiary } from "./Bestiary.js";
import {
  BESTIARY,
  BESTIARY_STAT,
  describeBonus,
  getBestiaryEntry,
  TOTAL_HUNTS,
} from "../../data/bestiary/index.js";
import {
  CREATURE_TYPES,
  MAP_2_ROSTER,
  ZONE_ROSTER,
} from "../../data/enemies/index.js";

/**
 * AS CACADAS DE UMA CRIATURA, e as duas primeiras contagens.
 *
 * ## POR QUE O NUMERO VEM DO CATALOGO
 *
 * A cacada e a missao principal da zona repetida em `2x`, `4x` e `6x`, e
 * a base sobe com o nivel do degrau. Escrever `5`, `15` e `40` nos
 * testes travava o numero antigo: quando a conta passou a ser derivada,
 * `onKill("slime", 5)` nao fechava mais nada e quinze testes caíam de
 * uma vez, com a mensagem de "nenhum bonus"
 *
 * Ler do catalogo faz o teste valer para a conta que existir, e ainda
 * trava a coisa que importa: que a cacada fecha no numero que o catalogo
 * diz
 */
const cacadas = (typeId) => getBestiaryEntry(typeId).hunts;

/** A PRIMEIRA cacada, a de `2x`. E a que os testes usam para fechar 1. */
const meta = (typeId, indice = 0) => cacadas(typeId)[indice].count;

/**
 * A SEGUNDA criatura do teste.
 *
 * Era o `rat`, e ele saiu do mapa 1 quando as cinco zonas do meio
 * passaram a ser so de ogre: um bestiary de `rat` testando um bestiario
 * que nao tem `rat` nao testa nada
 */
const OUTRO = "ogre";

describe("dados do bestiario", () => {
  it("tem uma entrada por criatura DELE, de qualquer mapa", () => {
    /**
     * A vitrine lista o que MORA, e nao tudo que existe como tipo.
     *
     * `CREATURE_TYPES` tem oito tipos e o JOGO tem cinco: limo, ogre da
     * predeira e ogre da pedreira no mapa 1, mais a sentinela e o arqueiro
     * zumbi no mapa 2. Listar os tres que nao moram em lugar nenhum dava
     * uma vitrine que nao se fecha — sem zona, sem "ir matar", e sem
     * nenhum aviso de que era impossivel
     *
     * O teste compara com os DOIS rosters, que sao a mesma fonte que a
     * vitrine usa: se uma zona trocar de criatura, os dois acompanham
     */
    const doRoster = new Set(
      [...ZONE_ROSTER, ...MAP_2_ROSTER].flatMap((row) =>
        Object.keys(row.mix ?? {}),
      ),
    );

    expect(BESTIARY.length).toBe(doRoster.size);

    for (const entry of BESTIARY) {
      expect(CREATURE_TYPES[entry.creatureId], entry.id).toBeDefined();
      expect(doRoster.has(entry.creatureId), entry.id).toBe(true);

      // e toda entrada tem zona, que e o que faz o "ir matar" existir
      expect(entry.zoneId, entry.id).toBeTruthy();
    }
  });

  it("a zona de cada criatura fica no MAPO dela", () => {
    /**
     * O `zoneId` da sentinela e `m2_floresta`, e nao `floresta`.
     *
     * Os dois ids existem e os dois nomes tambem — as zonas do mapa 2 sao
     * copia das do mapa 1. Um `floresta` aqui seria o "ir matar" da
     * criatura do mapa 2 levando o jogador para o mapa 1, onde ela nem
     * aparece
     */
    const mapaDe = (zoneId) =>
      zoneId?.startsWith("m2_") ? "map_2" : "map_1";

    const noMapa1 = ZONE_ROSTER.flatMap((row) =>
      Object.keys(row.mix ?? {}),
    );
    const noMapa2 = MAP_2_ROSTER.flatMap((row) =>
      Object.keys(row.mix ?? {}),
    );

    for (const tipo of new Set(noMapa1)) {
      const entry = getBestiaryEntry(tipo);

      expect(mapaDe(entry.zoneId), `${tipo} -> ${entry.zoneId}`).toBe(
        "map_1",
      );
    }

    for (const tipo of new Set(noMapa2)) {
      const entry = getBestiaryEntry(tipo);

      expect(mapaDe(entry.zoneId), `${tipo} -> ${entry.zoneId}`).toBe(
        "map_2",
      );
    }
  });

  it("daria tres cacadas por criatura", () => {
    for (const entry of BESTIARY) {
      expect(entry.hunts, entry.id).toHaveLength(3);
    }

    expect(TOTAL_HUNTS).toBe(BESTIARY.length * 3);
  });

  it("usa ids unicos em todas as cacadas", () => {
    const ids = BESTIARY.flatMap((entry) =>
      entry.hunts.map((hunt) => hunt.id),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("escala o numero de abates por cacada", () => {
    for (const entry of BESTIARY) {
      const counts = entry.hunts.map((hunt) => hunt.count);

      for (let i = 1; i < counts.length; i += 1) {
        expect(counts[i], entry.id).toBeGreaterThan(counts[i - 1]);
      }
    }
  });

  it("so concede stats que o jogador entende", () => {
    for (const entry of BESTIARY) {
      for (const hunt of entry.hunts) {
        for (const stat of Object.keys(hunt.reward)) {
          expect(BESTIARY_STAT[stat], hunt.id).toBeDefined();
        }
      }
    }
  });

  it("cresce o bonus dentro da mesma criatura", () => {
    for (const entry of BESTIARY) {
      const power = (hunt) =>
        Object.values(hunt.reward).reduce(
          (sum, value) => sum + Math.abs(value),
          0,
        );

      expect(power(entry.hunts[2]), entry.id).toBeGreaterThan(
        power(entry.hunts[0]),
      );
    }
  });

  it("aponta a criatura para a zona tematica", () => {
    const slime = getBestiaryEntry("slime");
    const ogre = getBestiaryEntry("ogre");

    /**
     * O LIMO aponta para o PANTANO, o degrau mais facil.
     *
     * O `zoneOf` escolhe a zona de MENOR nivel medio onde a criatura
     * aparece, com o peso do mix como desempate. As tres zonas de limo
     * estao empatadas em `slime: 100`, entao o peso nao separava: o
     * destino era decidido pela ordem do array e apontava para as Dunas
     * (nivel 3), o degrau mais avancado da progressao
     */
    expect(slime.zoneName).toBe("Pântano Profundo");

    /**
     * O OGRE mudou de zona: Vale das Cinzas -> Cripta Esquelética.
     *
     * As Cinzas eram o lugar de maior peso dele (60). Com a zona virando
     * o quarto degrau de limo, o que sobra e a Cripta (18), e o Ogre
     * passa a dividir a zona do Esqueleto — as duas tem la, e o peso
     * maior do esqueleto (62 contra 18) mantem os dois pontos uteis
     *
     * E a unica criatura que mudou de zona. As outras sete seguem na
     * mesma, e a verificacao e uma a uma para que um "ninguem se mexeu"
     * generico nao esconda uma troca
     */
    expect(ogre.zoneName).toBe("Cripta Esquelética");

    /**
     * O RATO mudou de zona DUAS vezes: Toca -> Brejo -> Acampamento.
     *
     * A Toca era o lugar de maior peso do rato (70). Virando degrau de
     * limo, o que sobrou foi o Brejo (20) contra 18 do Acampamento. E
     * quando o Brejo tambem virou degrau, restaram so DUAS zonas: o
     * Acampamento (18) e a Floresta (12)
     *
     * ## O PRECO DE FICAR SEM CASA
     *
     * O mapa 1 perdeu cinco criaturas: o rato, o goblin, o ghoul, o
     * esqueleto e o arqueiro zumbi saíram do roster quando as cinco zonas
     * do meio passaram a ser so de ogre. O que resta divide oAcampamento
     * entre o limo e o ogre, e o `zoneOf` escolhe pelo MENOR nivel medio
     *
     * Uma a uma, para que um "ninguem se mexeu" generico nao esconda
     * uma troca
     */
    expect(getBestiaryEntry("slime").zoneName).toBe("Pântano Profundo");

    expect(getBestiaryEntry(OUTRO).zoneName).toBe("Cripta Esquelética");

    /**
     * O OGRE DA PREDEIRA mudou de zona: Floresta -> Campo de Provas.
     *
     * Nao e accidento: o campo de provas ganhou um ogre de nivel 7, e o
     * `zoneOf` escolhe a zona de MENOR nivel medio. Como 7 e menor que
     * os 16 da Floresta, o "ir matar ogre da pedreira" passou a levar o
     * jogador ao campo de provas, que e onde o ogre de nivel 7 esta
     *
     * E a unica criatura que mudou de zona nesta rodada. As outras sete
     * seguem na mesma, e a verificacao e uma a uma para que um "ninguem
     * se mexeu" generico nao esconda uma troca
     */
    expect(getBestiaryEntry("ogre_da_predeira").zoneName).toBe(
      "Campo de Provas",
    );
  });

  it("encontra entrada por id e devolve null no resto", () => {
    expect(getBestiaryEntry(OUTRO)?.name).toBe(
      CREATURE_TYPES[OUTRO].name,
    );

    expect(getBestiaryEntry("nao_existe")).toBe(null);
  });

  it("formata bonus em texto legivel", () => {
    expect(describeBonus({ maxHp: 12 })).toBe("+12 Vida");

    expect(describeBonus({ attackSpeed: 0.06 })).toBe(
      "+6% Vel. Atq",
    );

    // regen e absoluto, nao porcentagem
    expect(describeBonus({ resourceRegen: 2 })).toBe("+2 Regen");
  });
});

describe("progresso das cacadas", () => {
  it("conta abates por criatura", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", 3);

    expect(bestiary.progressOf("slime_cacada_1")).toBe(3);
  });

  it("fecha a cacada no numero certo", () => {
    const bestiary = new Bestiary();

    const finished = bestiary.onKill("slime", meta("slime"));

    expect(finished).toHaveLength(1);
    expect(finished[0].id).toBe("slime_cacada_1");
    expect(bestiary.isDone("slime_cacada_1")).toBe(true);
  });

  it("nao fecha antes do numero", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", 4);

    expect(bestiary.isDone("slime_cacada_1")).toBe(false);
    expect(bestiary.completedCount).toBe(0);
  });

  it("anda em sequencia: nao pula a primeira", () => {
    const bestiary = new Bestiary();

    // 15 abates de uma vez: a 1 e a 2 fecham, a 3 nao
    const finished = bestiary.onKill("slime", meta("slime", 1));

    expect(finished.map((hunt) => hunt.tier)).toEqual([1, 2]);
    expect(bestiary.isDone("slime_cacada_3")).toBe(false);
  });

  it("nao conta duas vezes a mesma cacada", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", meta("slime"));
    const again = bestiary.onKill("slime", 100);

    expect(again.map((hunt) => hunt.tier)).toEqual([2, 3]);
    expect(bestiary.completedCount).toBe(3);
  });

  it("ignora abate de criatura fora do bestiario", () => {
    const bestiary = new Bestiary();

    expect(bestiary.onKill("nao_existe", 99)).toEqual([]);
    expect(bestiary.completedCount).toBe(0);
  });

  it("ignora abate de boneco de treino", () => {
    const bestiary = new Bestiary();

    expect(bestiary.onKill("dummy_warrior", 50)).toEqual([]);
  });

  it("ignora contagem zero ou negativa", () => {
    const bestiary = new Bestiary();

    expect(bestiary.onKill("slime", 0)).toEqual([]);
    expect(bestiary.onKill("slime", -5)).toEqual([]);
  });

  it("mantem as cacadas separadas por criatura", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", meta("slime", 2));
    bestiary.onKill(OUTRO, meta(OUTRO));

    // o id da cacada leva o TIPO, e nao um indice: fechar a 3 do limo
    // nao pode marcar a 1 do ogre
    expect(bestiary.isDone("slime_cacada_3")).toBe(true);
    expect(bestiary.isDone(`${OUTRO}_cacada_1`)).toBe(true);
    expect(bestiary.isDone(`${OUTRO}_cacada_2`)).toBe(false);
    expect(bestiary.completedCount).toBe(4);
  });
});

describe("bonus permanentes", () => {
  it("comeca zerado", () => {
    expect(new Bestiary().bonuses()).toEqual({});
  });

  it("soma o bonus de cada cacada fechada", () => {
    const bestiary = new Bestiary();

    // 5 limos = +12 vida
    bestiary.onKill("slime", meta("slime"));

    expect(bestiary.bonuses()).toEqual({ maxHp: 12 });
  });

  it("acumula varias criaturas", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", meta("slime"));
    bestiary.onKill(OUTRO, meta(OUTRO));

    /**
     * O QUE CADA CACADA CONCEDE vem do catalogo.
     *
     * A segunda criatura era o rato, com `speed: 6` na primeira cacada.
     * Trocada pelo ogre, que concede `maxHp` — e o numero escrito aqui
     * passaria a verificar um bonus que nenhuma cacada da, o que e o
     * pior jeito de testar: o teste verde e o jogo errado
     *
     * E as DUAS concedem `maxHp`, entao o esperado e a SOMA: um
     * spread sobrescreveria a primeira pela segunda e o teste passaria
     * com o valor errado
     */
    expect(bestiary.bonuses().maxHp).toBe(
      cacadas("slime")[0].reward.maxHp +
        cacadas(OUTRO)[0].reward.maxHp,
    );
  });

  it("acumula varias cacadas da mesma criatura", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", meta("slime", 1)); // +12 vida, +4 velocidade

    expect(bestiary.bonuses()).toEqual({
      maxHp: 12,
      speed: 4,
    });
  });

  it("soma stats repetidos sem sobrescrever", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", meta("slime"));
    bestiary.onKill(OUTRO, meta(OUTRO));

    // as DUAS primeiras cacadas concedem `maxHp`, e a soma tem de ser as
    // duas — nao o valor da segunda sobrescrevendo o da primeira
    const esperado =
      cacadas("slime")[0].reward.maxHp + cacadas(OUTRO)[0].reward.maxHp;

    expect(bestiary.bonuses().maxHp).toBe(esperado);
  });

  it("nao concede bonus de cacada em andamento", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", 4);

    expect(bestiary.bonuses()).toEqual({});
  });

  it("descreve o total em texto", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", meta("slime"));

    expect(bestiary.describeTotal()).toBe("+12 Vida");
  });
});

describe("estado do bestiario", () => {
  it("nao comeca completo", () => {
    const bestiary = new Bestiary();

    expect(bestiary.isComplete).toBe(false);
    expect(bestiary.completedCount).toBe(0);
    expect(bestiary.totalCount).toBe(TOTAL_HUNTS);
  });

  it("fica completo quando tudo fecha", () => {
    const bestiary = new Bestiary();

    for (const entry of BESTIARY) {
      bestiary.onKill(entry.creatureId, 999);
    }

    expect(bestiary.isComplete).toBe(true);
    expect(bestiary.completedCount).toBe(TOTAL_HUNTS);
  });

  it("acha a cacada ativa de cada criatura", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", meta("slime"));

    const active = bestiary.activeHunts;

    expect(active).toHaveLength(BESTIARY.length);

    const slime = active.find(
      (item) => item.entry.id === "slime",
    );

    // a 1 fechou, entao a ativa agora e a 2
    expect(slime.hunt.tier).toBe(2);

    // o Bestiary conta o abate CONTRA a cacada ativa, e nao sobra do
    // total: matar a meta da 1 inteira deixa a 2 com os 20 no visor
    expect(slime.progress).toBe(meta("slime"));
  });
});

describe("snapshot do bestiario", () => {
  it("publica todas as entradas com as cacadas", () => {
    const snapshot = new Bestiary().snapshot();

    expect(snapshot.entries).toHaveLength(BESTIARY.length);
    expect(snapshot.total).toBe(TOTAL_HUNTS);
    expect(snapshot.bonuses).toEqual({});

    for (const entry of snapshot.entries) {
      expect(entry.hunts, entry.id).toHaveLength(3);
      expect(entry.done).toBe(false);
      expect(entry.kills).toBe(0);

      for (const hunt of entry.hunts) {
        expect(hunt.done, hunt.id).toBe(false);
        expect(hunt.progress, hunt.id).toBe(0);
        expect(hunt.rewardLabel, hunt.id).not.toBe("");
      }
    }
  });

  it("marca a cacada concluida e trava o progresso na meta", () => {
    const bestiary = new Bestiary();

    /**
     * O BESTIARIO CONTA O TOTAL contra cada cacada, e nao consome uma
     * por vez: uma cacada fecha quando o abate acumulado passa da meta
     * dela. Por isso o total precisa ficar ENTRE a meta da 2 e a da 3 —
     * 45 fecha a 1 e a 2 e deixa a 3 em andamento
     */
    const total = 45;

    bestiary.onKill("slime", total);

    const entry = bestiary
      .snapshot()
      .entries.find((item) => item.id === "slime");

    const [first, second, third] = entry.hunts;

    expect(first.done).toBe(true);
    expect(first.progress).toBe(meta("slime"));
    expect(second.done).toBe(true);
    expect(second.progress).toBe(meta("slime", 1));
    expect(third.done).toBe(false);
    // mostra o abate real enquanto a meta nao fecha
    expect(third.progress).toBe(total);
  });

  it("trava o progresso no numero da meta", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", 999);

    const entry = bestiary
      .snapshot()
      .entries.find((item) => item.id === "slime");

    for (const hunt of entry.hunts) {
      expect(hunt.progress).toBe(hunt.count);
      expect(hunt.done).toBe(true);
    }
  });

  it("leva o bonus total no snapshot", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", meta("slime", 1));

    const snapshot = bestiary.snapshot();

    expect(snapshot.bonuses).toEqual({ maxHp: 12, speed: 4 });
    expect(snapshot.bonusesLabel).toContain("Vida");
    expect(snapshot.completed).toBe(2);
  });
});
