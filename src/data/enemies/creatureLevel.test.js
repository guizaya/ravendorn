import { describe, expect, it } from "vitest";
import {
  CREATURE_GROWTH,
  CREATURE_TYPES,
  createCreature,
  createCreatureRoster,
  createTrainingDummies,
  LEVEL_TIERS,
  resolveLevel,
  scaleForLevel,
} from "../../data/enemies/index.js";
import { xpForKill } from "../../game/progression/Levels.js";

function at(typeId, level) {
  return createCreature(
    typeId,
    { x: 0, y: 0 },
    0,
    level,
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

  it("sobe de nivel no roster", () => {
    const roster = createCreatureRoster();

    for (const enemy of roster) {
      const type = CREATURE_TYPES[
        enemy.id.replace(/_\d+$/, "")
      ];

      expect(
        enemy.level,
        enemy.id,
      ).toBeGreaterThanOrEqual(type.level);

      expect(
        enemy.level,
        enemy.id,
      ).toBeLessThanOrEqual(
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
