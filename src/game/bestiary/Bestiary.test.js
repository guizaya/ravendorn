import { describe, expect, it } from "vitest";
import { Bestiary } from "./Bestiary.js";
import {
  BESTIARY,
  BESTIARY_STAT,
  describeBonus,
  getBestiaryEntry,
  TOTAL_HUNTS,
} from "../../data/bestiary/index.js";
import { CREATURE_TYPES } from "../../data/enemies/index.js";

describe("dados do bestiario", () => {
  it("tem uma entrada por criatura", () => {
    expect(BESTIARY.length).toBe(
      Object.keys(CREATURE_TYPES).length,
    );

    for (const entry of BESTIARY) {
      expect(CREATURE_TYPES[entry.creatureId], entry.id).toBeDefined();
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

    expect(slime.zoneName).toBe("Brejo Lento");
    expect(ogre.zoneName).toBe("Pedreira do Ogro");
  });

  it("encontra entrada por id e devolve null no resto", () => {
    expect(getBestiaryEntry("ghoul")?.name).toBe(
      CREATURE_TYPES.ghoul.name,
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

    const finished = bestiary.onKill("slime", 5);

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
    const finished = bestiary.onKill("slime", 15);

    expect(finished.map((hunt) => hunt.tier)).toEqual([1, 2]);
    expect(bestiary.isDone("slime_cacada_3")).toBe(false);
  });

  it("nao conta duas vezes a mesma cacada", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", 5);
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

    bestiary.onKill("slime", 40);
    bestiary.onKill("rat", 5);

    expect(bestiary.isDone("slime_cacada_3")).toBe(true);
    expect(bestiary.isDone("rat_cacada_1")).toBe(true);
    expect(bestiary.isDone("rat_cacada_2")).toBe(false);
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
    bestiary.onKill("slime", 5);

    expect(bestiary.bonuses()).toEqual({ maxHp: 12 });
  });

  it("acumula varias criaturas", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", 5); // +12 vida
    bestiary.onKill("rat", 5); // +6 velocidade

    expect(bestiary.bonuses()).toEqual({
      maxHp: 12,
      speed: 6,
    });
  });

  it("acumula varias cacadas da mesma criatura", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", 15); // +12 vida, +4 velocidade

    expect(bestiary.bonuses()).toEqual({
      maxHp: 12,
      speed: 4,
    });
  });

  it("soma stats repetidos sem sobrescrever", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", 5); // +12 vida
    bestiary.onKill("ghoul", 5); // +45 vida

    expect(bestiary.bonuses().maxHp).toBe(57);
  });

  it("nao concede bonus de cacada em andamento", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", 4);

    expect(bestiary.bonuses()).toEqual({});
  });

  it("descreve o total em texto", () => {
    const bestiary = new Bestiary();

    bestiary.onKill("slime", 5);

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

    bestiary.onKill("slime", 5);

    const active = bestiary.activeHunts;

    expect(active).toHaveLength(BESTIARY.length);

    const slime = active.find(
      (item) => item.entry.id === "slime",
    );

    // a 1 fechou, entao a ativa agora e a 2
    expect(slime.hunt.tier).toBe(2);
    expect(slime.progress).toBe(5);
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

    bestiary.onKill("slime", 20);

    const entry = bestiary
      .snapshot()
      .entries.find((item) => item.id === "slime");

    const [first, second, third] = entry.hunts;

    expect(first.done).toBe(true);
    expect(first.progress).toBe(5);
    expect(second.done).toBe(true);
    expect(second.progress).toBe(15);
    expect(third.done).toBe(false);
    // mostra o abate real enquanto a meta nao fecha
    expect(third.progress).toBe(20);
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

    bestiary.onKill("slime", 15);

    const snapshot = bestiary.snapshot();

    expect(snapshot.bonuses).toEqual({ maxHp: 12, speed: 4 });
    expect(snapshot.bonusesLabel).toContain("Vida");
    expect(snapshot.completed).toBe(2);
  });
});
