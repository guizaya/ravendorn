const CONTROL_EFFECTS = new Set([
  "stun",
  "freeze",
  "root",
  "silence",
]);

/**
 * OS EFEITOS QUE IMPEDEM CADA COISA.
 *
 * Sao conjuntos fixos, entao vivem no modulo. Antes cada chamada de
 * `canMove`/`canAct`/`canCastSkill` alocava um array de strings
 * literais, e `canMove` e chamada duas vezes por tique por jogador — no
 * `updatePlayer` e no `walkToward`
 *
 * O `.some` continua, mas sobre uma constante. O ganho nao e o `.some`:
 * e nao existir array novo por chamada
 */
const TRAVAM_MOVIMENTO = ["stun", "freeze", "root"];
const TRAVAM_ACAO = ["stun", "freeze"];
const TRAVAM_SKILL = ["stun", "freeze", "silence"];

export class StatusSystem {
  /**
   * @param {{ onHeal?: (entity: object, amount: number) => void }} opcoes
   *
   * ## POR QUE O `onHeal` ENTRA POR CONSTRUTOR
   *
   * Porque este arquivo nao conhece o `DamageSystem`, e o `DamageSystem`
   * precisa deste arquivo para os multiplicadores. Um `import` do
   * `DamageSystem` aqui viraria um ciclo entre os dois
   *
   * E e injetado pelo motor, que e o unico lugar que conhece os dois. O
   * `DamageSystem.heal` respeita o teto de vida e escreve o `+25`
   * flutuante, e sao as duas coisas que o tick nao pode fazer sozinho
   */
  constructor({ onHeal = null } = {}) {
    this.onHeal = onHeal;
  }

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

      /**
       * A CURA POR TIQUE, que e o LADO BOM do `damagePerTick`.
       *
       * E o que faz a pocao render 25 a cada 2 segundos em vez de 120 de
       * uma vez. O esqueleto e o mesmo do DoT abaixo — o `tickTimer`
       * acumulado e o `while` que dispara os ticks perdidos quando o
       * delta foi grande — e a unica diferenca e o sinal, porque aqui o
       * numero SOBE
       *
       * ## POR QUE PASSO PELO `onHeal` E NAO `entity.hp +=`
       *
       * Porque `entity.hp` direto furaria o TETO de vida: um jogador em
       * 95 de 100 receberia 25 e ficaria em 120, e a barra mostraria mais
       * do que o maxHp. E porque sem o `onHeal` nao haveria o `+25`
       * flutuante, que e o unico aviso de que a pocao funcionou
       *
       * O `onHeal` e o `DamageSystem.heal` injetado pelo motor. Aqui fica
       * so a REGUA do tick — quem sabe o que e curar vida e quem tem o
       * teto e o flutuante
       */
      if (
        effect.healPerTick > 0 &&
        this.onHeal &&
        entity.hp > 0
      ) {
        effect.tickTimer -= deltaTime;

        while (effect.tickTimer <= 0) {
          this.onHeal(entity, effect.healPerTick);

          effect.tickTimer += effect.tickInterval;
        }
      }

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

            /**
             * O DoT tambem tem HORA, e nao so autor.
             *
             * Sem isto, o `lastHitBy` de um veneno fica no mob ate a
             * poisoning acabar, e um abate que acontece muito depois
             * ainda paga para quem aplicou. Com a hora, o abate so
             * reconhece o veneno enquanto ele esta realmente burnsando
             */
            entity.lastHitAt = Date.now();

            /**
             * E A MARCA DE QUE FOI O VENENO, e nao um golpe.
             *
             * O motor usa isso para tratar o abate por DoT diferente
             * do abate por golpe direto: quem envenenou e o dono mesmo
             * que tenha ido embora, e nao um jogador "parado" que
             * precisa estar atacando para ser creditado
             *
             * A flag e necessaria porque o efeito sai do
             * `statusEffects` assim que o HP zera, dentro deste
             * `update` e antes do `killEnemy`: no abate, o array ja
             * estaria limpo e a autoria do veneno seria ilegivel
             */
            entity.lastHitPorDoT = true;
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

  /**
   * OS EFEITOS QUE IMPEDEM CADA COISA.
   *
   * Sao conjuntos fixos, entao vivem no modulo. Antes cada chamada de
   * `canMove`/`canAct`/`canCastSkill` alocava um array de strings
   * literais — e `canMove` e chamada duas vezes por tique por jogador, no
   * `updatePlayer` e no `walkToward`
   *
   * O `.some` sobre esse array continua, mas agora sobre uma constante. O
   * ganho nao e o `.some`: e nao existir array novo por chamada
   */
  canMove(entity) {
  return !TRAVAM_MOVIMENTO.some((type) =>
    this.has(entity, type),
  );
}

canAct(entity) {
  return !TRAVAM_ACAO.some((type) =>
    this.has(entity, type),
  );
}

canCastSkill(entity) {
  return !TRAVAM_SKILL.some((type) =>
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

  /**
   * O QUE O CLIENTE VEMINHA.
   *
   * E a MESMA Lista que o servidor manda, entao o nome do efeito e o
   * rotulo que o jogador le. `regeneracaoCura` e o que o tooltip da HUD
   * mostra ("+25 a cada 2s"), e ele vem do item e nao de um `if` por
   * tipo aqui: a proxima pocao que precisar de outro valor nao passa
   * pelo motor
   *
   * ## POR QUE SO O `healPerTick` ENTRA
   *
   * Porque e o unico numero de que o texto precisa. Mandar `tickInterval`
   * e `label` custaria bytes em TODOS os efeitos de TODOS os inimigos a
   * cada pacote, e o unico que os usa e a cura por tique
   */
  snapshot(entity) {
    return entity.statusEffects.map((effect) => {
      const dado = {
        type: effect.type,
        remaining: effect.remaining,
        value: effect.value,
      };

      if (effect.healPerTick > 0) {
        dado.regeneracaoCura = {
          porTick: effect.healPerTick,
          intervalo: effect.tickInterval,
          rotulo: effect.label ?? "Regeneração",
        };
      }

      return dado;
    });
  }
}
