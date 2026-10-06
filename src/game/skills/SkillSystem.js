import {
  angleDifference,
  distance,
  distanceSquared,
  normalize,
  randomBetween,
  segmentDistanceSquared,
} from "../math.js";

const MAX_PENDING_PULSES = 512;
const MAX_PROJECTILES = 256;

export class SkillSystem {
  constructor(world, onMessage) {
    this.world = world;
    this.onMessage = onMessage;
  }

  get player() {
    return this.world.player;
  }

  get enemies() {
    return this.world.enemies;
  }

  request(action, pointer, selectedTargetId = null) {
    if (!action || this.player.hp <= 0) return false;

    if (this.player.cast) {
      this.onMessage("Aguarde o término da habilidade atual.");
      return false;
    }

    if (!this.world.statuses.canCastSkill(this.player)) {
      this.onMessage("Você está impedido de usar habilidades.");
      return false;
    }

    const remainingCooldown = this.player.cooldowns[action.id] ?? 0;

    if (remainingCooldown > 0) {
      this.onMessage(
        `${action.name} está em cooldown: ${remainingCooldown.toFixed(1)}s`,
      );
      return false;
    }

    if (this.player.resource < action.resourceCost) {
      this.onMessage(
        `${this.player.definition.resource.name} insuficiente.`,
      );
      return false;
    }

    const aim = this.createAim(action, pointer, selectedTargetId);

    this.player.resource -= action.resourceCost;
    this.player.cooldowns[action.id] = action.cooldown;
    this.player.attackAnimation = 0.22;

    // a arte de tiro e direcional: so vale com alvo de verdade.
    // um buff proprio aciona attackAnimation tambem, e nesse caso
    // o arqueiro tem de continuar na pose de idle. guarda o id,
    // e nao um booleano, porque o engine usa isso para virar o
    // arqueiro para o alvo durante o tiro.
    this.player.firingTargetId = aim.targetId ?? null;

    if (action.castTime > 0) {
      this.player.cast = {
        action,
        aim,
        selectedTargetId,
        remaining: action.castTime,
      };

      return true;
    }

    this.execute(action, aim, selectedTargetId);
    return true;
  }

  createAim(action, pointer, selectedTargetId) {
    if (action.targetType === "self") {
      return {
        point: { x: this.player.x, y: this.player.y },
        direction: {
          x: this.player.aimDirection.x,
          y: this.player.aimDirection.y,
        },
        targetId: null,
      };
    }

    let target = selectedTargetId
      ? this.enemies.find(
          (enemy) =>
            enemy.id === selectedTargetId && enemy.alive,
        )
      : null;

    if (!target && action.targetType === "enemy") {
      const candidates = this.enemies.filter((enemy) => enemy.alive);

      target = candidates.sort(
        (a, b) =>
          distanceSquared(a, pointer) -
          distanceSquared(b, pointer),
      )[0];
    }

    const targetPoint = target
      ? { x: target.x, y: target.y }
      : { x: pointer.x, y: pointer.y };

    const direction = normalize(
      targetPoint.x - this.player.x,
      targetPoint.y - this.player.y,
    );

    let point = targetPoint;

    if (action.targetType === "ground" && action.range > 0) {
      const rawDistance = distance(this.player, targetPoint);

      if (rawDistance > action.range) {
        point = {
          x: this.player.x + direction.x * action.range,
          y: this.player.y + direction.y * action.range,
        };
      }
    }

    return {
      point,
      direction,
      targetId: target?.id ?? null,
    };
  }

  update(deltaTime) {
    this.updatePendingCasts(deltaTime);
    this.updateDelayedPulses(deltaTime);
    this.updatePendingHits(deltaTime);

    // `updateProjectiles` NAO e chamada aqui de proposito.
    //
    // O `world.projectiles` e do mundo COMPARTILHADO, e o motor
    // roda este `update` dentro do laco POR JOGADOR. Com duas
    // pessoas online cada flecha andava duas vezes mais rapido,
    // porque o mesmo `updateProjectiles` passava duas vezes pela
    // lista. O motor chama `updateProjectiles` uma vez por tick, na
    // parte compartilhada do tick.
  }

  updatePendingCasts(deltaTime) {
    if (!this.player.cast) return;

    const cast = this.player.cast;
    cast.remaining -= deltaTime;

    if (!this.world.statuses.canAct(this.player)) {
      this.player.cast = null;
      this.onMessage("Sua habilidade foi interrompida.");
      return;
    }

    if (cast.remaining <= 0) {
      this.player.cast = null;

      this.execute(
        cast.action,
        cast.aim,
        cast.selectedTargetId,
      );
    }
  }

  updateDelayedPulses(deltaTime) {
    for (let index = this.world.delayedEffects.length - 1; index >= 0; index -= 1) {
      const delayed = this.world.delayedEffects[index];

      delayed.remaining -= deltaTime;

      if (delayed.remaining > 0) continue;

      this.world.delayedEffects.splice(index, 1);

      /**
       * O PULSO ADIADO TAMBEM CARREGA O DONO.
       *
       * A detonação diferida pode durar segundos — e o tempo suficiente
       * para o jogador em foco do motor ser outro quando ela estoura.
       * Sem repassar o `ownerId`, o abate voltava a ser creditado a quem
       * por acaso estivesse em foco
       */
      this.applyArea(
        delayed.action,
        {
          point: delayed.center,
          direction: { x: 1, y: 0 },
        },
        delayed.center,
        true,
        this.donoDoProjetil(delayed),
      );

      this.world.effects.circle(
        delayed.center.x,
        delayed.center.y,
        delayed.action.impactRadius ??
          delayed.action.radius ??
          100,
        delayed.action.color ?? this.player.definition.accent,
        0.45,
      );

      this.world.effects.burst(
        delayed.center.x,
        delayed.center.y,
        delayed.action.color ?? this.player.definition.accent,
      );
    }
  }

  updatePendingHits(deltaTime) {
    for (let index = this.world.pendingPulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.world.pendingPulses[index];

      pulse.remaining -= deltaTime;

      if (pulse.remaining > 0) continue;

      this.world.pendingPulses.splice(index, 1);

      this.applyArea(
        pulse.action,
        pulse.aim,
        pulse.origin,
        false,
      );
    }
  }

  execute(action, aim, selectedTargetId = null) {
    this.applySelfPayload(action);
    this.createCastVisual(action, aim);

    switch (action.type) {
      case "self":
        return;

      case "line":
      case "cone":
      case "circle":
      case "ground":
        this.applyArea(action, aim);
        return;

      case "chain":
        this.applyChain(action, aim);
        return;

      case "dash":
        this.applyDash(action, aim);
        return;

      case "projectile":
        this.spawnProjectiles(action, aim, selectedTargetId);
        return;

      default:
        return;
    }
  }

  applySelfPayload(action) {
    if (action.healing) {
      this.world.damage.heal(this.player, action.healing);
    }

    if (action.restoreResource) {
      this.world.damage.restoreResource(
        this.player,
        action.restoreResource,
      );
    }

    if (action.shield) {
      this.player.shield += action.shield;
    }

    if (action.shieldResourceCost) {
      this.player.resource = Math.max(
        0,
        this.player.resource - action.shieldResourceCost,
      );
    }

    for (const effect of action.selfEffects ?? []) {
      this.world.statuses.apply(this.player, effect, this.player);
    }
  }

  createCastVisual(action, aim) {
    const color = action.color ?? this.player.definition.accent;

    switch (action.type) {
      case "line":
        this.world.effects.line(
          this.player.x,
          this.player.y,
          Math.atan2(aim.direction.y, aim.direction.x),
          action.range,
          action.radius,
          color,
          0.28,
        );
        break;

      case "cone":
        this.world.effects.cone(
          this.player.x,
          this.player.y,
          Math.atan2(aim.direction.y, aim.direction.x),
          action.range,
          color,
          0.3,
        );
        break;

      case "circle":
        this.world.effects.circle(
          this.player.x,
          this.player.y,
          action.radius,
          color,
          0.35,
        );
        break;

      case "ground":
        this.world.effects.circle(
          aim.point.x,
          aim.point.y,
          action.radius,
          color,
          0.4,
        );
        break;

      case "self":
        if (action.radius) {
          this.world.effects.circle(
            this.player.x,
            this.player.y,
            action.radius,
            color,
            0.4,
          );
        }
        break;

      case "dash":
        this.world.effects.line(
          this.player.x,
          this.player.y,
          Math.atan2(aim.direction.y, aim.direction.x),
          action.distance,
          action.width,
          color,
          0.3,
        );
        break;

      default:
        break;
    }
  }

  scheduleRemainingHits(action, aim, origin) {
    for (let hit = 1; hit < (action.hits ?? 1); hit += 1) {
      if (
        this.world.pendingPulses.length >= MAX_PENDING_PULSES
      ) {
        return;
      }

      this.world.pendingPulses.push({
        action,
        aim,
        origin: { ...origin },
        remaining: action.hitInterval * hit,
      });
    }
  }

  applyArea(
    action,
    aim,
    customOrigin = null,
    scheduleHits = true,
    owner = null,
  ) {
    const origin = customOrigin ?? {
      x: this.player.x,
      y: this.player.y,
    };

    const targets = this.getTargetsInArea(
      action,
      aim.point,
      origin,
      aim.direction,
    );

    for (const target of targets) {
      this.applyHit(action, target, aim, owner);
    }

    if (scheduleHits && action.hits > 1) {
      this.scheduleRemainingHits(action, aim, origin);
    }
  }

  getTargetsInArea(action, point, origin, direction) {
    const candidates = this.enemies.filter((enemy) => enemy.alive);

    const targets = candidates.filter((enemy) => {
      const enemyDistance = distance(origin, enemy);

      switch (action.type) {
        case "line": {
          const end = {
            x: origin.x + direction.x * action.range,
            y: origin.y + direction.y * action.range,
          };

          const halfWidth = (action.radius ?? 40) / 2;

          return (
            segmentDistanceSquared(enemy, origin, end) <=
            (halfWidth + enemy.radius) ** 2
          );
        }

        case "cone": {
          const targetAngle = Math.atan2(
            enemy.y - origin.y,
            enemy.x - origin.x,
          );

          const facingAngle = Math.atan2(
            direction.y,
            direction.x,
          );

          return (
            enemyDistance <= action.range + enemy.radius &&
            Math.abs(
              angleDifference(targetAngle, facingAngle),
            ) <= action.angle / 2
          );
        }

        case "circle":
          return (
            distance(origin, enemy) <=
            action.radius + enemy.radius
          );

        case "ground":
          return (
            distance(point, enemy) <=
            action.radius + enemy.radius
          );

        default:
          return false;
      }
    });

    if (action.maxTargets) {
      return targets
        .sort(
          (a, b) =>
            distanceSquared(a, point) -
            distanceSquared(b, point),
        )
        .slice(0, action.maxTargets);
    }

    return targets;
  }

  applyHit(action, target, aim, owner = null) {
    if (!target.alive || target.hp <= 0) return;

    /**
     * QUEM LEVA A CULPA DO GOLPE.
     *
     * O `owner` e quem disparou o projétil, e ele chega nulo quando o
     * golpe e do jogador em foco — o caso normal, de um golpe corpo a
     * corpo ou de uma area que o jogador disparou agora
     *
     * Sem esta distinção, um projétil que explodisse longe creditava o
     * abate ao jogador em foco do motor, e no online esse jogador era
     * outro: o dono do projétil carrega o `owner`, e e ele que leva
     */
    const atacante =
      owner ?? this.player;

    this.world.damage.applyDamage(
      atacante,
      target,
      action,
    );

    const effects = [
      ...(action.effects ?? []),
      ...(action.statusEffects ?? []),
    ];

    for (const effect of effects) {
      this.applyEffect(effect, target, aim);
    }
  }

  applyEffect(effect, target, aim) {
    if (effect.type === "knockback") {
      this.world.enemiesPush(
        target,
        aim.direction.x * effect.value,
        aim.direction.y * effect.value,
      );
      return;
    }

    if (effect.type === "pull") {
      const direction = normalize(
        this.player.x - target.x,
        this.player.y - target.y,
      );

      this.world.enemiesPush(
        target,
        direction.x * effect.value,
        direction.y * effect.value,
      );
      return;
    }

    if (effect.type === "knockdown") {
      this.world.statuses.apply(
        target,
        {
          type: "stun",
          duration: effect.duration,
        },
        this.player,
      );

      const direction = normalize(
        aim.direction.x,
        aim.direction.y,
      );

      this.world.enemiesPush(
        target,
        direction.x * effect.value,
        direction.y * effect.value,
      );
      return;
    }

    this.world.statuses.apply(
      target,
      effect,
      this.player,
    );
  }

  applyChain(action, aim) {
    const selected = this.enemies.find(
      (enemy) =>
        enemy.id === aim.targetId && enemy.alive,
    );

    const firstTarget =
      selected ??
      this.enemies
        .filter((enemy) => enemy.alive)
        .sort(
          (a, b) =>
            distanceSquared(a, aim.point) -
            distanceSquared(b, aim.point),
        )[0];

    if (!firstTarget) return;

    const hitTargets = [firstTarget];
    let current = firstTarget;

    while (hitTargets.length < (action.maxTargets ?? 4)) {
      const next = this.enemies
        .filter(
          (enemy) =>
            enemy.alive &&
            !hitTargets.includes(enemy) &&
            distance(current, enemy) <= action.jumpRange,
        )
        .sort(
          (a, b) =>
            distanceSquared(current, a) -
            distanceSquared(current, b),
        )[0];

      if (!next) break;

      hitTargets.push(next);
      current = next;
    }

    for (const target of hitTargets) {
      this.applyHit(action, target, aim);

      this.world.effects.line(
        current.x,
        current.y,
        Math.atan2(
          target.y - current.y,
          target.x - current.x,
        ),
        distance(current, target),
        4,
        action.color ?? this.player.definition.accent,
        0.35,
      );

      current = target;
    }
  }

  applyDash(action, aim) {
    const origin = {
      x: this.player.x,
      y: this.player.y,
    };

    const direction =
      action.targetType === "ground"
        ? normalize(
            aim.point.x - this.player.x,
            aim.point.y - this.player.y,
          )
        : aim.direction;

    const distanceMoved = this.world.collision.moveBySteps(
      this.player,
      direction.x * action.distance,
      direction.y * action.distance,
      this.enemies,
    );

    const dashAim = {
      point: {
        x: this.player.x,
        y: this.player.y,
      },
      direction,
    };

    this.applyArea(
      {
        ...action,
        type: "line",
        range: Math.max(1, distanceMoved),
        radius: action.width ?? action.radius ?? 55,
      },
      dashAim,
      origin,
    );
  }

  spawnProjectiles(action, aim, selectedTargetId) {
    const selectedTarget = this.enemies.find(
      (enemy) =>
        enemy.id === selectedTargetId && enemy.alive,
    );

    const count = action.count ?? 1;
    const baseAngle = Math.atan2(
      aim.direction.y,
      aim.direction.x,
    );

    for (let index = 0; index < count; index += 1) {
      if (this.world.projectiles.length >= MAX_PROJECTILES) {
        return;
      }

      const offset =
        count === 1
          ? 0
          : (index / (count - 1) - 0.5) * (action.spread ?? 0.3);

      const angle = baseAngle + offset;

      let x = this.player.x;
      let y = this.player.y;
      let velocityX;
      let velocityY;
      let destination = null;

      if (action.rain) {
        destination = {
          x: aim.point.x + randomBetween(-action.radius * 0.65, action.radius * 0.65),
          y: aim.point.y + randomBetween(-action.radius * 0.65, action.radius * 0.65),
        };

        x = destination.x + randomBetween(-80, 80);
        y = destination.y - randomBetween(430, 560);

        velocityX = 0;
        velocityY = action.projectileSpeed;
      } else {
        velocityX = Math.cos(angle) * action.projectileSpeed;
        velocityY = Math.sin(angle) * action.projectileSpeed;

        if (selectedTarget) {
          destination = {
            x: selectedTarget.x,
            y: selectedTarget.y,
          };
        }
      }

      this.world.projectiles.push({
        id: `${action.id}_${this.world.time}_${index}`,
        x,
        y,
        radius: action.rain ? 7 : 10,
        velocityX,
        velocityY,
        speed: action.projectileSpeed,
        directionX: Math.cos(angle),
        directionY: Math.sin(angle),
        action,
        targetId: selectedTarget?.id ?? aim.targetId,
        destination,
        remaining: 3,
        homing: action.homing,
        impactMode: action.rain ? "ground" : "collision",

        /**
         * QUEM ATIROU, e nao quem explode.
         *
         * Este campo e a correcao de um bug que so aparecia no online.
         *
         * O projétil vivia no `world.projectiles`, que e COMPARTILHADO
         * por todos os jogadores, e nao guardava de quem era. Quando
         * ele explodia, o `applyArea` chamava o `applyHit`, que passa
         * `this.player` como atacante — e `this.player` e o jogador em
         * FOCO do motor, nao o dono do projétil
         *
         * O efeito no loot era grande: o teste2 atirava, o projétil
         * viajava pelo mapa e explodia a seis mil pixels de distancia,
         * e o abate do mob era creditado ao `teste`, que estava PARADO
         * em cima de um portal sem atirar em nada. No rastro:
         *
         *     killer=teste | explicito=SIM | auto=0 | dist=5763
         *     pilha=killEnemy > onDeath > applyDamage > applyHit
         *          > applyArea > explodeProjectile
         *
         * A pilha foi o que nomeou o culpado. Sem ela, o sintoma era
         * "o jogador parado recebe loot", e a unica pista era a
         * distancia
         *
         * Guardar o atirador e o que faz o last hit voltar a ser do
         * dono do golpe. Um projétil parado no ar e um projétil de
         * quem disparou, e o abate e de quem disparou
         */
        ownerId: this.player?.id ?? null,
      });
    }
  }

  /**
   * O INDICE DE INIMIGOS POR ID.
   *
   * As flechas faziam `this.enemies.find(...)` duas vezes por projétil
   * por tique: uma para o alvo do homing, outra para a colisão. Com 256
   * projéteis e 93 inimigos, sao 47.712 buscas lineares por tique
   *
   * O indice e montado uma vez por tique e vale para todas as flechas
   * dele. A colisão continua percorrendo a lista — ela e espacial, e
   * qualquer projétil pode tocar qualquer inimigo, entao nao ha chave
   * para isso. O que o indice resolve e o `find` por `targetId`, que e
   * uma busca por chave disfarçada
   */
  #indiceDeInimigos() {
    const indice = new Map();

    for (const enemy of this.enemies) {
      indice.set(enemy.id, enemy);
    }

    return indice;
  }

  updateProjectiles(deltaTime) {
    const indice = this.#indiceDeInimigos();

    for (
      let index = this.world.projectiles.length - 1;
      index >= 0;
      index -= 1
    ) {
      const projectile = this.world.projectiles[index];

      projectile.remaining -= deltaTime;

      if (projectile.homing) {
        const alvo = indice.get(projectile.targetId);

        const target =
          alvo && alvo.alive ? alvo : undefined;

        if (target) {
          const direction = normalize(
            target.x - projectile.x,
            target.y - projectile.y,
          );

          projectile.directionX = direction.x;
          projectile.directionY = direction.y;
          projectile.velocityX = direction.x * projectile.speed;
          projectile.velocityY = direction.y * projectile.speed;
        }
      }

      projectile.x += projectile.velocityX * deltaTime;
      projectile.y += projectile.velocityY * deltaTime;

      let exploded = false;

      if (projectile.remaining <= 0) {
        exploded = true;
      }

      if (
        !exploded &&
        projectile.impactMode === "collision" &&
        this.world.collision.circleHitsSolid(
          projectile,
          projectile.radius,
        )
      ) {
        exploded = true;
      }

      if (
        !exploded &&
        projectile.impactMode === "collision"
      ) {
        /**
         * A COLISAO E ESPACIAL, entao nao ha indice que a evite.
         *
         * Uma flecha pode tocar qualquer inimigo, e qualquer inimigo
         * pode estar no raio. O laco termina cedo: 93 inimigos a 600px
         * de distancia somam 28 comparacoes de `>=` e sao mais barato
         * que um `Map` com 93 entradas montado por tique
         *
         * O que mudou e que o teste e do quadrado ANTES do `** 2`, que
         * era recalculado por inimigo dentro do comparador
         */
        const raio = projectile.radius;

        for (const enemy of this.enemies) {
          if (enemy.alive === false) continue;

          const soma = raio + enemy.radius;

          if (
            distanceSquared(projectile, enemy) <= soma * soma
          ) {
            exploded = true;
            break;
          }
        }
      }

      if (
        !exploded &&
        projectile.impactMode === "ground" &&
        projectile.destination &&
        projectile.y >= projectile.destination.y
      ) {
        exploded = true;
      }

      if (
        !exploded &&
        projectile.destination &&
        distanceSquared(projectile, projectile.destination) <=
          (projectile.speed * deltaTime + 15) ** 2
      ) {
        exploded = true;
      }

      if (exploded) {
        this.world.projectiles.splice(index, 1);
        this.explodeProjectile(projectile);
      }
    }
  }

  /**
   * A ENTIDADE DE QUEM ATIROU O PROJETIL.
   *
   * O `ownerId` do projétil e o id da SESSAO de quem disparou. Aqui ele
   * vira de novo a entidade do jogador, que e o que o `applyDamage`
   * quer como atacante.
   *
   * Devolve `null` quando o atirador saiu do mundo entre o disparo e a
   * explosão — e o honesto: um projétil órfão não tem dono, e o
   * `applyDamage` com `null` não grava `lastHitBy` em ninguém
   */
  donoDoProjetil(projectile) {
    const id = projectile?.ownerId;

    if (!id) return null;

    /**
     * O `players` pode nao existir: os testes de skill montam um `world`
     * minimo, so com o que a area precisa. Ler `.get` de `undefined`
     * derrubava o teste de multi-hit
     *
     * E o `players` ser opcional nao e um accidento: o single player
     * tambem roda sem multiplayer, e o fallback `this.player` abaixo
     * e quem resolve o caso de sempre
     */
    const sessao = this.world.players?.get?.(id);

    return sessao?.player ?? null;
  }

  explodeProjectile(projectile) {
    const action = projectile.action;
    const center = {
      x: projectile.x,
      y: projectile.y,
    };

    const color = action.color ?? this.player.definition.accent;

    this.world.effects.burst(center.x, center.y, color);

    if (action.rain && projectile.destination) {
      center.x = projectile.destination.x;
      center.y = projectile.destination.y;
    }

    if (action.delayedDetonation) {
      this.world.delayedEffects.push({
        action,
        center,
        remaining: action.delayedDetonation,
        ownerId: projectile.ownerId ?? null,
      });
      return;
    }

    this.applyArea(
      {
        ...action,
        type: action.impactShape ?? "circle",
        radius: action.impactRadius ?? action.radius ?? 70,
      },
      {
        point: center,
        direction: {
          x: projectile.directionX,
          y: projectile.directionY,
        },
      },
      center,
      true,
      this.donoDoProjetil(projectile),
    );

    this.world.effects.circle(
      center.x,
      center.y,
      action.impactRadius ?? action.radius ?? 70,
      color,
      0.28,
      true,
    );
  }
}
