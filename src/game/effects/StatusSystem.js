const CONTROL_EFFECTS = new Set([
  "stun",
  "freeze",
  "root",
  "silence",
]);

export class StatusSystem {
  apply(target, sourceEffect, source = null) {
    const effect = {
      chance: 1,
      duration: 3,
      ...sourceEffect,
    };

    if (effect.chance < 1 && Math.random() > effect.chance) {
      return false;
    }

    if (
      CONTROL_EFFECTS.has(effect.type) &&
      this.getControlResistance(target) > 0
    ) {
      const resistance = this.getControlResistance(target);

      if (Math.random() < resistance) {
        return false;
      }
    }

    const tickInterval = effect.tickInterval ?? 1;

    const normalized = {
      ...effect,
      sourceId: source?.id ?? null,
      // a entidade alem do id: o loot do last hit precisa saber
      // QUEM aplicou o efeito, e o id sozinho nao localiza o
      // dono no servidor
      source: source ?? null,
      remaining: effect.duration,
      tickTimer: tickInterval,
      damagePerTick:
        effect.damagePerTick ??
        (effect.type === "poison" || effect.type === "burning"
          ? effect.value ?? 0
          : 0),
      tickInterval,
    };

    const existingIndex = target.statusEffects.findIndex(
      (current) => current.type === normalized.type,
    );

    if (existingIndex === -1) {
      target.statusEffects.push(normalized);
      return true;
    }

    const existing = target.statusEffects[existingIndex];

    existing.remaining = Math.max(
      existing.remaining,
      normalized.remaining,
    );

    existing.duration = Math.max(
      existing.duration,
      normalized.duration,
    );

    existing.value = Math.max(
      Math.abs(existing.value ?? 0),
      Math.abs(normalized.value ?? 0),
    );

    existing.damagePerTick = Math.max(
      existing.damagePerTick ?? 0,
      normalized.damagePerTick ?? 0,
    );

    return true;
  }

  update(entity, deltaTime) {
    if (entity.hp <= 0) return;

    for (let index = entity.statusEffects.length - 1; index >= 0; index -= 1) {
      const effect = entity.statusEffects[index];

      effect.remaining -= deltaTime;

      if (
        effect.damagePerTick > 0 &&
        (effect.type === "poison" || effect.type === "burning")
      ) {
        effect.tickTimer -= deltaTime;

        while (effect.tickTimer <= 0) {
          entity.hp = Math.max(
            0,
            entity.hp - effect.damagePerTick,
          );

          // O DoT tira vida direto, sem passar pelo DamageSystem,
          // entao o `lastHitBy` nao era gravado e o abate por
          // veneno ficava sem dono. Como o loot e do ultimo a
          // dar dano, o autor do tick precisa ser registrado
          // aqui tambem, senao o last hit so funciona no dano
          // direto.
          if (effect.source) {
            entity.lastHitBy = effect.source;
          }

          effect.tickTimer += effect.tickInterval;
        }
      }

      if (
        effect.type === "resourceDrain" &&
        effect.value > 0
      ) {
        entity.resource = Math.max(
          0,
          entity.resource - effect.value * deltaTime,
        );
      }

      if (effect.remaining <= 0 || entity.hp <= 0) {
        entity.statusEffects.splice(index, 1);
      }
    }
  }

  has(entity, type) {
    return entity.statusEffects.some((effect) => effect.type === type);
  }

  getMultiplier(entity, stat, context = {}) {
    let multiplier = 1;

    for (const effect of entity.statusEffects) {
      const value = effect.value ?? 0;

      switch (stat) {
        case "movementSpeed":
          if (effect.type === "slow") {
            multiplier *= 1 - value;
          }

          if (effect.type === "speedBoost") {
            multiplier *= 1 + value;
          }
          break;

        case "attackSpeed":
          if (effect.type === "attackSpeed") {
            multiplier *= 1 + value;
          }
          break;

        case "damageDealt":
          if (
            effect.type === "power" ||
            effect.type === "asura" ||
            effect.type === "elementalAffinity"
          ) {
            multiplier *= 1 + value;
          }

          if (effect.type === "weaken") {
            multiplier *= 1 - value;
          }
          break;

        case "damageTaken":
          if (
            effect.type === "curse" ||
            effect.type === "vulnerability"
          ) {
            multiplier *= 1 + value;
          }

          if (effect.type === "damageReduction") {
            multiplier *= 1 - value;
          }

          if (
            effect.type === "resistance" &&
            (!effect.damageType ||
              effect.damageType === "all" ||
              effect.damageType === context.damageType)
          ) {
            multiplier *= 1 - value;
          }

          if (
            effect.type === "magicResistance" &&
            (context.damageType === "magic" ||
              context.damageType === "holy")
          ) {
            multiplier *= 1 - value;
          }
          break;

        case "defense":
          if (effect.type === "defenseBoost") {
            multiplier *= 1 + value;
          }
          break;

        case "resourceRegen":
          if (effect.type === "shieldMaintenance") {
            multiplier *= 1 + value;
          }
          break;

        default:
          break;
      }
    }

    return Math.max(0, multiplier);
  }

  canMove(entity) {
    return !["stun", "freeze", "root"].some((type) =>
      this.has(entity, type),
    );
  }

  canAct(entity) {
    return !["stun", "freeze"].some((type) =>
      this.has(entity, type),
    );
  }

  canCastSkill(entity) {
    return !["stun", "freeze", "silence"].some((type) =>
      this.has(entity, type),
    );
  }

  isInvulnerable(entity) {
    return this.has(entity, "invulnerability");
  }

  getReflect(entity) {
    const effect = entity.statusEffects.find(
      (current) => current.type === "reflect",
    );

    if (effect) return effect.value ?? 0;
    return entity.reflect ?? 0;
  }

  getControlResistance(entity) {
    let resistance = entity.controlResistance ?? 0;

    for (const effect of entity.statusEffects) {
      if (effect.type === "controlResistance") {
        resistance = Math.max(resistance, effect.value ?? 0);
      }
    }

    return Math.min(0.95, resistance);
  }

  snapshot(entity) {
    return entity.statusEffects.map((effect) => ({
      type: effect.type,
      remaining: effect.remaining,
      value: effect.value,
    }));
  }
}
