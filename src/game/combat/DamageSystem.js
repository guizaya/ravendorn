export class DamageSystem {
  constructor({
    statuses,
    effects,
    onDamaged = null,
    onDeath = null,
  }) {
    this.statuses = statuses;
    this.effects = effects;
    this.onDamaged = onDamaged;
    this.onDeath = onDeath;
  }

  applyDamage(attacker, target, action, options = {}) {
    if (!target || target.hp <= 0 || target.alive === false) {
      return 0;
    }

    if (this.statuses.isInvulnerable(target)) {
      this.effects.addText(
        target.x,
        target.y - target.radius,
        "IMUNE",
        "#8ed081",
      );
      return 0;
    }

    const baseDamage = (action.damage ?? 0) * (options.scale ?? 1);

    const outgoingMultiplier = this.statuses.getMultiplier(
      attacker,
      "damageDealt",
    );

    const incomingMultiplier = this.statuses.getMultiplier(
      target,
      "damageTaken",
      {
        damageType: action.damageType,
      },
    );

    const defenseMultiplier = this.statuses.getMultiplier(
      target,
      "defense",
    );

    const defense = (target.defense ?? 0) * defenseMultiplier;

    const defenseFactor =
      100 / (100 + defense * (action.damageType === "physical" ? 1 : 0.65));

    const critical =
      Math.random() < (attacker.critRate ?? 0);

    const criticalMultiplier = critical
      ? attacker.critDamage ?? 1.5
      : 1;

    const amount = Math.max(
      1,
      Math.round(
        baseDamage *
          outgoingMultiplier *
          incomingMultiplier *
          defenseFactor *
          criticalMultiplier,
      ),
    );

    const absorbed = Math.min(target.shield ?? 0, amount);

    target.shield = Math.max(0, (target.shield ?? 0) - absorbed);

    const healthDamage = amount - absorbed;

    target.hp = Math.max(0, target.hp - healthDamage);
    target.hitFlash = 0.18;

    this.onDamaged?.(attacker, target, amount, action);

    this.effects.addText(
      target.x,
      target.y - target.radius - 8,
      String(amount),
      critical ? "#ffe66d" : action.damageType === "magic" ? "#bba0ff" : "#ffffff",
      critical,
    );

    if (attacker !== target) {
      const lifesteal =
        (action.lifesteal ?? 0) +
        this.statuses.getMultiplier(attacker, "lifesteal") - 1;

      if (lifesteal > 0) {
        this.heal(attacker, Math.round(healthDamage * lifesteal));
      }

      const reflected = Math.round(
        healthDamage * this.statuses.getReflect(target),
      );

      if (reflected > 0) {
        attacker.hp = Math.max(0, attacker.hp - reflected);

        this.effects.addText(
          attacker.x,
          attacker.y - attacker.radius,
          `-${reflected}`,
          "#ff8b64",
        );
      }
    }

    if (target.hp <= 0) {
      const died = target.alive !== false;

      target.alive = false;
      target.statusEffects = [];
      target.respawnTimer = 5;

      if (died) {
        this.onDeath?.(attacker, target, action);
      }
    }

    return amount;
  }

  heal(target, amount) {
    if (!target || target.hp <= 0 || amount <= 0) return;

    const healed = Math.min(amount, target.maxHp - target.hp);
    target.hp += healed;

    if (healed > 0) {
      this.effects.addText(
        target.x,
        target.y - target.radius - 12,
        `+${healed}`,
        "#83ef9b",
      );
    }
  }

  restoreResource(target, amount) {
    if (!target || amount <= 0) return;

    const restored = Math.min(
      amount,
      target.maxResource - target.resource,
    );

    target.resource += restored;

    if (restored > 0) {
      this.effects.addText(
        target.x + 12,
        target.y - target.radius,
        `+${restored} ${target.definition.resource.name}`,
        "#75d9ff",
      );
    }
  }
}
