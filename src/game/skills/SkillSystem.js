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

/**
 * QUANTO TEMPO O PERSONAGEM FICA NA POSE DE ATAQUE.
 *
 * ## POR QUE ESTE NUMERO VIVE AQUI, E EM DOIS LUGARES SO
 *
 * Porque e o mesmo valor em dois lugares: o que LIGA a pose e o que segura a
 * flecha. Se os dois fossem numeros soltos, bastaria um deles mudar para a
 * flecha sair antes ou depois da animacao — e ninguem veria a causa
 *
 * ## E POR QUE A FLECHA ESPERA ISTO
 *
 * ## O QUE O JOGADOR RELATOU
 *
 * "A flecha sai e a animacao e atrasada": a flecha nascia no mesmo instante
 * em que a pose comecava, entao o boneco ainda estava puxando o arco quando a
 * seta ja estava no ar. O corte de tempo aparecia como "atraso", sendo que o
 * tiro e que estava adiantado
 *
 * ## E POR QUE 0,22 E O MOMENTO CERTO, E NAO UM QUALQUER
 *
 * A arte de tiro do Arbalista tem 9 quadros a 20 quadros por segundo. O
 * `0,22` cai entre o quarto e o quinto quadro — que e onde o arco esta
 * soltando. O valor nao foi escolhido para bater com o desenho: ele ja era o
 * tempo da pose, e o desenho ja foi feito para caber nela. O que mudou foi so
 * que a flecha passou a respeitar esse tempo
 */
const TEMPO_DA_ANIMACAO_DE_ATAQUE = 0.22;

export class SkillSystem {
  constructor(world, onMessage) {
    this.world = world;
    this.onMessage = onMessage;

    /**
     * OS TIROS QUE ESPERAM A POSE TERMINAR.
     *
     * ## POR QUE ISTO VIVE AQUI, E NAO NO `world`
     *
     * Porque o `world.projectiles` e do mundo COMPARTILHADO: com dois
     * jogadores online, um tiro guardado ali passaria por `spawnProjectiles`
     * duas vezes no mesmo tick, e o jogador veria duas flechas de um aperto
     *
     * O `SkillSystem` e UM POR JOGADOR, entao a lista tambem. Cada um guarda
     * o seu, e o `update` deste `SkillSystem` so processa o dele
     */
    this.tirosPendentes = [];
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

    /**
     * O COOLDOWN REAL, COM A VELOCIDADE DE ATAQUE POR CIMA.
     *
     * ## POR QUE ISTO AQUI E NAO NO DADO
     *
     * Porque `action.cooldown` e o valor de um jogador sem nenhum bonus. Ele
     * e estatico, e o jogo inteiro le o mesmo numero para o primeiro e para
     * o centesimo golpe
     *
     * ## POR QUE O DENOMINADOR E MULTIPLICATIVO
     *
     * Porque e assim que a velocidade ja funciona em `movementSpeed`, e
     * assim que o `Berserk` foi escrito (`+0.35 attackSpeed`). Um `+35%` de
     * velocidade significa 35% MENOS espera: o cooldown divide por 1.35
     *
     * ## POR QUE O MINIMO
     *
     * Porque um afixo de velocidade em outro item pode empilhar e chegar
     * perto de 1. Sem o piso, o cooldown vira negativo e o jogador passa a
     * atacar sem parar nenhum
     *
     * ## E O QUE ESTAVA MORTO ANTES
     *
     * `player.attackSpeedBonus` era escrito pelo `applyEquipment` e nunca
     * lido; `getMultiplier(entity, "attackSpeed")` existia e nao tinha
     * nenhum chamador. Entao "VEL. ATQ" subia no painel, o `Berserk` era
     * ativado, e nada no DPS mudava
     */
    const attackSpeed =
      this.world.statuses.getMultiplier(this.player, "attackSpeed");

    const bonusDeAtaque = this.player.attackSpeedBonus ?? 0;

    const totalAttackSpeed = Math.max(
      0,
      (attackSpeed - 1) + bonusDeAtaque,
    );

    this.player.cooldowns[action.id] =
      action.cooldown / Math.max(0.25, 1 + totalAttackSpeed);

    /**
     * A POSE COMECA AQUI, E A FLECHA ESPERA ELA TERMINAR.
     *
     * O `0,22` da linha de baixo era o mesmo numero solto que decide o atraso
     * do tiro, em `spawnProjectilesWhenReady`. Sao a mesma constante agora: se
     * um deles mudar sozinho, a flecha volta a sair no meio da animacao, e o
     * sintoma volta sem nenhuma mudanca visivel no codigo
     */
    this.player.attackAnimation = TEMPO_DA_ANIMACAO_DE_ATAQUE;

// a arte de tiro e direcional: so vale com alvo de verdade.
// um buff proprio aciona attackAnimation tambem, e nesse caso
// o arqueiro tem de continuar na pose de idle. guarda o id,
// e nao um booleano, porque o engine usa isso para virar o
// arqueiro para o alvo durante o tiro.
this.player.firingTargetId = aim.targetId ?? null;

    /**
     * ESTA POSE E DE BUFF, e nao de golpe no ar.
     *
     * ## POR QUE O `firingTargetId` NAO DAVA PARA SABER
     *
     * Porque os dois casos devolvem `null`. O `createAim` monta um
     * `targetId: null` explicito quando a acao e `targetType: "self"`, e
     * devolve `target?.id ?? null` quando nao achou inimigo sob o ponteiro —
     * que e o que acontece ao clicar no chao
     *
     * O motor so via os dois como a MESMA coisa, e a arte de tiro, que tem
     * `needsTarget`, ficava de fora. O sintoma era o conjurador lancar a esfera
     * no chao com o boneco parado em idle: o tiro saia, a pose nao
     *
     * ## POR QUE A ACAO E QUE RESPONDE
     *
     * Porque ela e a unica que sabe o que o jogador pediu. O `targetType` e o
     * contrato da acao: `"self"` e um buff, e qualquer outra coisa e um golpe
     * que sai na direcao da mira, tenha ou nao inimigo no fim dela
     *
     * E `=== "self"` em vez de truthy: um `targetType` ausente num acao mal
     * formada nao pode virar buff e apagar a pose de novo
     */
    this.player.poseDeBuff = action.targetType === "self";

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
    this.updatePendingShots(deltaTime);
    this.updateDelayedPulses(deltaTime);
    this.updatePendingHits(deltaTime);

    /**
     * OS DOIS LAÇOS DE PERIGO, E SO OS DO JOGADOR EM FOCO.
     *
     * Pelo mesmo motivo do `updateProjectiles` que o comentario logo abaixo
     * explica: este `update` roda DENTRO do laco por jogador do motor, e
     * `world.perigos` e a lista COMPARTILHADA
     *
     * Sem o filtro, a armadilha do jogador A seria avancada duas vezes num tick
     * de duas pessoas online — os 15s virariam 7,5s e a nuvem pingaria em
     * duplicidade. O dono e a chave, e ele ja viaja em cada perigo
     */
    this.updateAtrasados(deltaTime);
    this.updatePerigos(deltaTime);

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

      /**
       * O DONO VOLTA DO ID.
       *
       * Sem esta linha o golpe do segundo jogador do laco era credited ao
       * primeiro, porque `applyHit` cai em `owner ?? this.player` — e
       * `this.player` e quem o motor esta movendo, nao quem conjurou
       */
      this.applyArea(
        pulse.action,
        pulse.aim,
        pulse.origin,
        false,
        this.donoDoProjetil(pulse),
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

      /**
       * A ARMADILHA E A CHUVA: as duas NAO sao um golpe, e sim uma COISA QUE
       * FICA NO CHAO.
       *
       * Todo o resto deste `switch` resolve na hora e some. Estas duas criam uma
       * entrada em `world.perigos` que o `updatePerigos` tira do caminho depois
       * de alguns segundos — a armadilha esperando o inimigo, a nuvem pingando
       * veneno
       *
       * E por isso que elas SCSam do `applyArea`: um `ground` resolveria o
       * instante e esqueceria, e nao e o que o jogador pediu nestas duas
       */
      case "armadilha":
        this.colocarArmadilha(action, aim);
        return;

      case "chuva":
        this.marcarChuva(action, aim);
        return;

      /**
       * A NOVA E A SINGULARIDADE, e as duas nao EXPLODEM: elas ficam.
       *
       * Same do motivo da armadilha e da chuva — um `applyArea` resolveria no
       * instante da conjure e nao haveria nada esperando no chao. A diferenca
       * para aquelas duas e que estas NAO tem `delay`: nascem prontas
       */
      case "nova":
      case "singularidade":
        this.colocarCirculoDeControle(action, aim);
        return;

      case "dash":
        this.applyDash(action, aim);
        return;

      case "projectile":
        /**
         * A FLECHA ESPERA A ANIMACAO, E SO A FLECHA.
         *
         * ## POR QUE SO O PROJETIL
         *
         * Porque o pedido do jogador foi sobre o TIRO. As outras acoes
         * aplicam dano no mesmo instante por decisao de jogo: um golpe de
         * espada que so acertasse no fim da animacao deixaria o combatente
         * apanhando de um golpe que ele ja achou que passou
         *
         * E o tiro do Arbalista nao tem esse problema: o dano vem da
         * explosao da flecha, entao adiar o PROJETIL adia o dano junto, sem
         * precisar mexer em mais nada
         *
* ## E POR QUE O TEMPO VEM DO `attackAnimation`, E NAO DA CONSTANTE
         *
         * Porque o que importa e o que SOBRA da pose, e nao os 0,22 de uma
         * vez. Uma habilidade com `castTime` chega aqui ja com a pose
         * terminada, e nesse caso a flecha sai na hora, como sempre. Usar a
         * constante aqui atrasaria essas habilidades sem motivo
         */
        this.spawnProjectilesWhenReady(action, aim, selectedTargetId);

        return;

      default:
        return;
    }
  }

  /**
   * SOLTA O PROJETIL AGORA, OU QUANDO A POSE TERMINAR.
   *
   * ## POR QUE LER O `attackAnimation`, E NAO USAR A CONSTANTE
   *
   * Porque o `attackAnimation` e o que resta da pose NESTE instante. Um tiro
   * sem `castTime` chega aqui com os 0,22 ainda inteiros; uma habilidade com
   * tempo de conjuracao chega com a pose ja terminada, e sai na hora
   *
   * Ler o relogio em vez da constante e o que mantem as duas metades do
   * acordo: qualquer mudanca no tempo da pose muda a flecha junto, sem
   * ninguem editar dois numeros
   */
  spawnProjectilesWhenReady(action, aim, selectedTargetId) {
    const restante = this.player.attackAnimation ?? 0;

    if (restante <= 0) {
      this.spawnProjectiles(action, aim, selectedTargetId);

      return;
    }

    this.tirosPendentes.push({
      action,
      aim,
      selectedTargetId,
      restante,
    });
  }

  /**
   * CONTA O TEMPO DOS TIROS GUARDADOS, e solta os que chegou a hora.
   *
   * ## POR QUE ESTE METODO NAO E O `updateProjectiles`
   *
   * Porque o `updateProjectiles` e do MUNDO COMPARTILHADO e roda uma vez por
   * tick. Este roda uma vez por JOGADOR, dentro do laco de cada um — que e o
   * que a lista de tiros guardados exige: cada jogador so tem os tiros dele
   *
   * ## E A ORDEM DO `splice`
   *
   * E de tras para frente, pelo mesmo motivo do `updateDelayedPulses`: um
   * tiro solto pode gerar outro tiro, e andar para frente visitaria o
   * recem-criado no mesmo tick
   */
  updatePendingShots(deltaTime) {
    for (let i = this.tirosPendentes.length - 1; i >= 0; i -= 1) {
      const tiro = this.tirosPendentes[i];

      tiro.restante -= deltaTime;

      if (tiro.restante > 0) continue;

      this.tirosPendentes.splice(i, 1);

      /**
       * MORREU NO MEIO DO PUXAO: O TIRO SE PERDE.
       *
       * E o unico jeito de desfazer um tiro ja gasto. Quem apertou em cima da
       * hora morre, e a seta que sairia do corpo seria pior do que a seta
       * que nao saiu: o jogador veria dano vindo de um boneco que ja estava
       * no chao
       *
       * O preco e 0,22 e o recurso e o cooldown, e nao ha como devolver os
       * dois: devolver o cooldown deixaria o jogador recarregando o tiro de
       * novo, e devolver o recurso nao existe. Perder um tiro ao morrer e o
       * preco honesto de ter apertado em cima da hora
       */
      if (this.player.hp <= 0) continue;

      this.spawnProjectiles(tiro.action, tiro.aim, tiro.selectedTargetId);
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

  /**
   * AGENDA OS GOLPES RESTANTES DE UM MULTI-HIT.
   *
   * ## POR QUE O PULSO GUARDA O DONO
   *
   * Porque `world.pendingPulses` e uma lista POR MAPA, e ela e drenada em
   * `updatePendingHits`, que roda uma vez por jogador. Sem o `ownerId`, o
   * primeiro jogador do laco puxava os pulsos de todo mundo e os abates
   * iam para ele — que e o que `DamageSystem` grava em `lastHitBy`, de onde
   * sai o loot
   *
   * O projétil ja faz isso desde o comeco (`ownerId` em `spawnProjectiles`,
   * resolvido por `donoDoProjetil`), e a detonacao adiada tambem. Esta era a
   * terceira via do mesmo cuidado, e a unica que ficou de fora
   */
  scheduleRemainingHits(action, aim, origin, owner = null) {
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

        /**
         * O DONO DO GOLPE, em id.
         *
         * E id e nao a referencia porque o pulso sobrevive a varios
         * `update`: guardar o objeto congelaria um `PlayerSession` que o
         * servidor pode ter trocado no meio
         */
        ownerId: owner?.id ?? null,
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
      this.scheduleRemainingHits(action, aim, origin, owner);
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

        /**
         * O TEMPO DE VIDA, e a acao pode encurtar.
         *
         * O `3` e o padrao de todo tiro do jogo. A `Mana Lance` declara 0,75s,
         * que e o tempo dela de percorrer os 8 tiles da linha a 980px/s — sem
         * isso ela viveria tres vezes o necessario e atravessaria o mapa
         * inteiro depois de ja ter saido da mira
         */
        remaining: action.remaining ?? 3,

        /**
         * OS INIMIGOS QUE ESTE TIRO JA TOCOU.
         *
         * E o que impede a Lanca de Mana de raspar o MESMO mob a cada tique
         * enquanto passa por cima dele: sem esta lista, um tiro rapido que
         * gasta 20px por quadro ficaria dentro do raio de um mob grande por
         * varios quadros e o acerto sairia multiplicado
         *
         * E um ARRAY, e nao um `Set`, porque o objeto inteiro vai pelo
         * `JSON.stringify` do pacote de estado no online — um `Set` viraria
         * `{}` do outro lado e o cliente perderia o rastro
         */
        atingidos: [],

        /** este tiro ATRAVESSA inimigos em vez de explodir no primeiro */
        perfura: action.pierce === true,

        /** o quanto o dano multiplica a cada alvo ja tocado */
        pierceQueda: action.pierceQueda ?? 0.72,

    /**
     * A IDADE DO PROJETIL, contando PARA CIMA.
     *
     * E o tempo que a arte do tiro usa para escolher o quadro. O `remaining`
     * ja contava para baixo a partir de 3, e `3 - remaining` funcionaria —
     * mas isso amarra a arte a um numero magico do gameplay: mudar o tempo de
     * vida da flecha mudaria a animacao sem ninguem perceber
     *
     * Com o `age` proprio, a arte tem o tempo dela e o tiro tem o tempo dele
     */
    age: 0,
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

    /**
     * A IDADE SOMA, e o tempo da arte do tiro.
     *
     * Fica aqui e nao no desenho porque o `drawProjectiles` pode rodar mais de
     * uma vez por tick em modo rede, e um quadro que anda a cada desenho
     * passaria mais rapido na tela do que o tempo do jogo
     */
    projectile.age = (projectile.age ?? 0) + deltaTime;

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

      /**
 * * O ANTERIOR, guardado antes do passo.
 *
 * * E o que fecha o teste varrido abaixo: sem ele so sobraria a posicao de
 * * destino do quadro, e o inimigo que ficou no meio do caminho seria
 * * perdido
 */
      const anteriorX = projectile.x;
      const anteriorY = projectile.y;

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
         *
         * ## E O TESTE VARRE O CAMINHO, E NAO SO O DESTINO
         *
         * Porque o projétil anda o passo inteiro e so DEPOIS testava a
         * colisao, na posicao nova. A flecha do Arbalist anda a 720px/s: a
         * 20fps sao 36px num passo, e a janela de acerto de um mob e
         * `10 + raio`, uns 30 a 50px. Num quadro perdido o tiro passava por
         * dentro do mob e saia do outro lado — o acerto sumia sem erro
         * nenhum, e pior num FPS baixo, que e exatamente quando o jogador
         * mais precisa que a flecha acerte
         *
         * O teste passa a medir a distancia do inimigo ao SEGMENTO
         * percorrido, e nao a um ponto. E o mesmo `segmentDistanceSquared`
         * que a hitbox em linha do melee usa, entao nao ha uma segunda
         * geometria no codigo
         */
        const raio = projectile.radius;

        const inicio = { x: anteriorX, y: anteriorY };
        const fim = { x: projectile.x, y: projectile.y };

        /**
         * A CENA INTEIRA: PASSAR POR DENTRO, MAS NAO VOLTAR A TOCAR.
         *
         * ## POR QUE O PERFURANTE NAO SAI AQUI
         *
         * Porque todo o resto deste metodo assume que um tiro que tocou em
         * alguem JA ACABOU — ele vira `exploded` e sai da lista no fim do
         * tique. A `Mana Lance` e o tiro que nao pode acabar ai: ela cruza a
         * linha inteira e leva todo mundo
         *
         * ## POR QUE O `atingidos` E POR INIMIGO
         *
         * Porque o teste varre o SEGMENTO do passo, e o tiro anda 49px por
         * tique a 980px/s. Um mob de raio 30 ficaria dentro da janela por dois
         * ou tres tiques seguidos, e o mesmo inimigo levaria o dano varias
         * vezes de uma vez so
         *
         * E o `includes` em vez de um `Set` porque o array e pequeno — uma
         * Lanca atravessa oito tiles e leva meia duzia de mobs no maximo — e
         * porque o objeto inteiro e serializado no pacote de estado
         */
        for (const enemy of this.enemies) {
          if (enemy.alive === false) continue;

          /* ja levou dano deste tiro: e o mesmo mob, nao um novo */
          if (projectile.atingidos.includes(enemy.id)) continue;

          const soma = raio + enemy.radius;

          if (
            segmentDistanceSquared(enemy, inicio, fim) <= soma * soma
          ) {
            /**
             * O DANO CAI A CADA ALVO, e e a MESMA REGRA do alcance da Fan Volley
             * — porem medindo por ACERTOS e nao por distancia.
             *
             * A `Fan Volley` perde força com a distancia do arqueiro; a Lanca
             * perde com quantos ja passaram por ela. E a leitura certa das duas:
             * uma mede onde o inimigo esta, a outra mede quantos vem antes
             *
             * Por isso o dano NAO vem do `applyArea`: aqui o alvo e UM inimigo
             * especifico, e o `applyHit` e o caminho que sabe aplicar efeito em
             * uma entidade so
             */
            const queda = Math.pow(
              projectile.pierceQueda,
              projectile.atingidos.length,
            );

            this.applyHit(
              {
                ...projectile.action,
                damage: (projectile.action.damage ?? 0) * queda,
                impactShape: null,
                radius: 0,
              },
              enemy,
              {
                point: { x: enemy.x, y: enemy.y },
                direction: {
                  x: projectile.directionX,
                  y: projectile.directionY,
                },
              },
              this.donoDoProjetil(projectile),
            );

            projectile.atingidos.push(enemy.id);

            /**
             * E AQUI QUE O PERFURANTE CONTINUA.
             *
             * Sem o `perfura`, a proxima linha marcaria `exploded` e o tiro
             * morreria no primeiro inimigo — que e o comportamento de toda as
             * outras flechas do jogo, e o certo para elas
             */
            if (!projectile.perfura) {
              exploded = true;
              break;
            }
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

  /**
   * A ARMADILHA DE ESPINHOS, postada na mira.
   *
   * ## POR QUE UM PERIGO E NAO UM GOLPE
   *
   * Porque ela tem que SOBREVIVER ao tique: o jogador anda ate o ponto, o inimigo
   * entra nela 3 segundos depois. Um `applyArea` resolveria no instante da
   * conjure e nao haveria nada esperando no chao
   *
   * ## O LIMITE DE DUAS, E O QUE ELE FAZ
   *
   * E o `limite` da acao. Com mais de duas no mapa, a armadilha vira um campo
   * minado onde o jogador pode simplesmente marcar o chao e sair — e o limite
   * e o que devolve a essa habilidade o que ela tem de￥ bom: escolher ONDE
   *
   * A que sai e a MAIS ANTIGA, e nao uma qualquer. As duas mais velhas sao as
   * que o jogador ja esqueceu, e a terceira marca chao novo
   *
   * ## POR QUE O DONO VIAJA COM ELA
   *
   * Porque o abate vai para quem a ARMOU, e nao para quem estiver em foco
   * quando o inimigo pisar nela — que em online quase nunca e a mesma pessoa
   */
  /**
   * A NOVA DE CRISTAL E A SINGULARIDADE, as duas como um circulo de controle.
   *
   * ## POR QUE A SINGULARIDADE NAO E A ARMADILHA COM OUTRO NOME
   *
   * Porque elas se confundem em `updatePerigos` quando o `kind` e o que decide
   * o que acontece dentro do tique. Duas entradas com o mesmo `kind` e
   * comportamentos diferentes exigiriam um segundo `if` dentro do laco, e o
   * proximoAdded skill do conjure nao teria onde entrar
   *
   * ## POR QUE A NOVA GUARDA TEMPO POR INIMIGO
   *
   * Porque a regra dela e "FICOU 3 SEGUNDOS dentro", e o tempo e de cada um.
   * Tres mobs entram no mesmo circulo em tres momentos diferentes, e cada um
   * tem de cumprir os 3s dele — um contador unico do circulo daria o atordoamento
   * aos tres ao mesmo tempo, quando o segundo nem tinha chegado perto
   *
   * ## POR QUE A SINGULARIDADE GUARDA NADA
   *
   * Porque a regra dela e "esta dentro agora": o puxao e o dano valem a cada
   * tique enquanto o inimigo estiver la. Nao ha tempo a acumular
   */
  colocarCirculoDeControle(action, aim) {
    this.world.perigos.push({
      id: `${action.id}_${this.world.time}`,
      kind: action.type,
      action,
      x: aim.point.x,
      y: aim.point.y,
      raio: action.radius ?? 150,
      vida: action.duracao ?? 3,
      proximoTick: 0,

      /* so a Nova usa isto: segundos que CADA inimigo já acumulou aqui dentro */
      tempoDentro: new Map(),

      ownerId: this.player?.id ?? null,
    });
  }

  /**
   * O TIQUE DA NOVA E DA SINGULARIDADE, e o que cada uma faz com quem entrou.
   *
   * Estao separadas do laco de `updatePerigos` pelo mesmo motivo que os outros
   * casos estao: o laco cuida da VIDA (contar para baixo e apagar) e este metodo
   * cuida do EFEITO. Misturar os dois deixaria o `switch` do laco com a regra
   * de cada skill dentro dele
   */
  tiqueDoCirculo(perigo, dono) {
    const { action } = perigo;

    const area = {
      ...action,
      type: "circle",
      radius: perigo.raio,
    };

    const mira = {
      point: { x: perigo.x, y: perigo.y },
      direction: { x: 1, y: 0 },
    };

    const dentro = this.enemies.filter(
      (inimigo) =>
        inimigo.alive &&
        Math.hypot(inimigo.x - perigo.x, inimigo.y - perigo.y) <=
          perigo.raio + inimigo.radius,
    );

    if (perigo.kind === "singularidade") {
      /**
       * A SINGULARIDADE PUXA E DANO, e nao EM RAIO.
       *
       * O `pull` entra como efeito de area, que o `applyEffect` ja sabe
       * aplicar em toda entidade dentro do raio. E ele e FRACO de proposito:
       * um empurrao forte passaria por cima do colisor e atravessaria o mob
       */
      this.applyArea(area, mira, { x: perigo.x, y: perigo.y }, false, dono);

      return;
    }

    /* ---- a NOVA ---- */

    for (const inimigo of dentro) {
      const jaTeve = perigo.tempoDentro.get(inimigo.id) ?? 0;

      const acumulado = jaTeve + (action.tickInterval ?? 0.2);

      if (acumulado < (action.tempoParaStun ?? 3)) {
        perigo.tempoDentro.set(inimigo.id, acumulado);

        /**
         * A LENTIDAO E A RECUSA DELE, e nao um efeito solto.
         *
         * A lentidao nao se acumula: a cada tique o inimigo recebe os mesmos
         * 45%. E por isso que ela esta aqui e nao na lista `effects` da acao —
         * aquela lista aplicaria uma vez, no primeiro tique, e o efeito
         * DURACAO de meio segundo acabaria antes do segundo tique
         */
        this.applyEffect(
          {
            type: "slow",
            duration: action.lentidao?.duration ?? 0.5,
            value: action.lentidao?.value ?? 0.45,
          },
          inimigo,
          mira,
        );

        continue;
      }

      /**
       * CUMPRIU OS 3 SEGUNDOS.
       *
       * O atordoamento e aplicado UMA vez e o contador volta a zero, para que o
       * mesmo inimigo possa tomar outro se ficar mais 3s. Sem o `delete`, o
       * `>=` continuaria verdadeiro para sempre e ele ficaria preso em stun
       */
      this.applyEffect(
        { type: "stun", duration: action.stun ?? 1 },
        inimigo,
        mira,
      );

      perigo.tempoDentro.delete(inimigo.id);
    }

    /* quem saiu do circulo perde a contagem — foi embora antes do tempo */
    for (const [id, tempo] of perigo.tempoDentro) {
      const aindaDentro = dentro.some((inimigo) => inimigo.id === id);

      if (!aindaDentro) perigo.tempoDentro.delete(id);
    }
  }

  colocarArmadilha(action, aim) {
    const limite = action.limite ?? 2;
    const daClasse = this.world.perigos.filter(
      (p) => p.kind === "armadilha" && p.ownerId === (this.player?.id ?? null),
    );

    /* enquanto couber, nao sai nenhuma */
    while (daClasse.length >= limite) {
      const maisAntiga = daClasse[0];

      this.world.perigos.splice(
        this.world.perigos.indexOf(maisAntiga),
        1,
      );

      daClasse.shift();
    }

    this.world.perigos.push({
      id: `${action.id}_${this.world.time}`,
      kind: "armadilha",
      action,
      x: aim.point.x,
      y: aim.point.y,
      raio: action.radius ?? 46,
      vida: action.duracao ?? 15,
      armaEm: action.armaEm ?? 0.5,
      armada: false,
      ownerId: this.player?.id ?? null,
    });
  }

  /**
   * A CHUVA DE VIROTES: marca o chao, espera, e so entao cai.
   *
   * ## POR QUE UM ATRASO E NAO UM EFEITO IMEDIATO
   *
   * Porque o segundo do jogo e o aviso. Marcar o chao e so isso: o jogador le
   * "ali vai chover", sai da area se quiser, e quem nao sair leva
   *
   * E o atraso usa a fila de `atrasados`, que e a mesma ideia do
   * `delayedEffects` com um payload diferente — ali a espera explode uma area,
   * aqui a espera coloca uma nuvem no chao
   */
  marcarChuva(action, aim) {
    this.world.atrasados.push({
      restante: action.delay ?? 1,
      action,
      point: { x: aim.point.x, y: aim.point.y },
      ownerId: this.player?.id ?? null,
    });

    this.world.effects.circle(
      aim.point.x,
      aim.point.y,
      action.radius ?? 160,
      action.color ?? "#7bd45a",
      0.9,
    );
  }

  /**
   * O QUE ESPERA NA FILA DE ATRASADOS: o primeiro tique em que o relogio
   * vence, a marca vira a coisa de verdade.
   *
   * A diferenca para `updateDelayedPulses` e o destino: ali explode uma area
   * com dano, aqui nasce um perigo que fica pingando
   */
  updateAtrasados(deltaTime) {
    const meuId = this.player?.id ?? null;

    for (let i = this.world.atrasados.length - 1; i >= 0; i -= 1) {
      const atrasado = this.world.atrasados[i];

      /* so o dono conta o tempo do seu proprio atraso */
      if (atrasado.ownerId !== meuId) continue;

      atrasado.restante -= deltaTime;

      if (atrasado.restante > 0) continue;

      this.world.atrasados.splice(i, 1);

      const { action } = atrasado;

      this.world.perigos.push({
        id: `${action.id}_${this.world.time}`,
        kind: "chuva",
        action,
        x: atrasado.point.x,
        y: atrasado.point.y,
        raio: action.radius ?? 160,
        vida: (action.chuvaDuracao ?? 3) + (action.nuvemDuracao ?? 4),
        chuvaRestante: action.chuvaDuracao ?? 3,
        proximoTick: 0,
        ownerId: atrasado.ownerId,
      });
    }
  }

  /**
   * OS PERIGOS DO CHAO, um por quadro.
   *
   * ## POR QUE UM LACO SO PARA OS DOIS TIPOS
   *
   * Porque eles dividem a mesma lista, a mesma contagem de vida e o mesmo
   * desenho do chao. Separa-los em duas listas daria dois lacos com a mesma
   * forma, e o `kind` e o que diferencia o que acontece dentro
   *
   * ## POR QUE A ARMADILHA SAI DEPOIS DE MORDER
   *
   * Porque ela e de uso unico. Uma armadilha que prende duas vezes faria o
   * `root` de 2s virar um controle infinito, e o jogador perderia o controle
   * da propria build
   */
  updatePerigos(deltaTime) {
    const meuId = this.player?.id ?? null;

    for (let i = this.world.perigos.length - 1; i >= 0; i -= 1) {
      const perigo = this.world.perigos[i];

      /**
       * O TEMPO DE CADA PERIGO CORRE UMA VEZ SO.
       *
       * E o filtro que o `update` documenta: o laco passa por este metodo uma
       * vez por jogador, e a lista e compartilhada. Sem esta linha a armadilha
       * do jogador A perderia a vida duas vezes num tick com duas pessoas
       */
      if (perigo.ownerId !== meuId) continue;

      perigo.vida -= deltaTime;

      if (perigo.vida <= 0) {
        this.world.perigos.splice(i, 1);
        continue;
      }

      const { action } = perigo;

      const dono =
        perigo.ownerId === null
          ? this.player
          : this.world.players.get(perigo.ownerId)?.player ?? this.player;

      const mira = {
        point: { x: perigo.x, y: perigo.y },
        direction: { x: 1, y: 0 },
      };

      if (perigo.kind === "armadilha") {
        if (!perigo.armada) {
          perigo.armaEm -= deltaTime;

          if (perigo.armaEm <= 0) perigo.armada = true;

          continue;
        }

        const pegou = this.enemies.find(
          (inimigo) =>
            inimigo.alive &&
            Math.hypot(inimigo.x - perigo.x, inimigo.y - perigo.y) <=
              perigo.raio + inimigo.radius,
        );

        if (!pegou) continue;

        this.applyHit(action, pegou, mira, dono);

        this.world.perigos.splice(i, 1);
        continue;
      }

      /**
       * A NOVA E A SINGULARIDADE, e elas nao tem `chuvaRestante` nem `armaEm`.
       *
       * O `kind` decide qual das duas regras roda dentro do tique, e por isso o
       * metodo `tiqueDoCirculo` existe separado: e o que mantem este laco
       * responsável so pela VIDA (contar para baixo e apagar) e nao pelos
       * efeitos de cada skill
       */
      if (perigo.kind === "nova" || perigo.kind === "singularidade") {
        perigo.proximoTick -= deltaTime;

        if (perigo.proximoTick > 0) continue;

        perigo.proximoTick = action.tickInterval ?? 0.2;

        this.tiqueDoCirculo(perigo, dono);
        continue;
      }

      /**
       * A CHUVA VIRA NUVEM, E A NUVEM CONTINUA.
       *
       * Os primeiros segundos sao virotes caindo — o `chuvaRestante` e o que o
       * desenho usa para saber se ainda cai raio. Depois disso sobra so a nuvem
       * de veneno, que e a parte que dura os 4 segundos do fim
       */
      if (perigo.chuvaRestante > 0) {
        perigo.chuvaRestante -= deltaTime;
      }

      perigo.proximoTick -= deltaTime;

      if (perigo.proximoTick > 0) continue;

      perigo.proximoTick = action.tickInterval ?? 0.5;

      const area = {
        ...action,
        type: "circle",
        radius: perigo.raio,
      };

      this.applyArea(area, mira, { x: perigo.x, y: perigo.y }, false, dono);
    }
  }

  /**
   * A SALVA EM LEQUE: cinco virotes, e o dano cai com a distancia do ARQUEIRO.
   *
   * E so a leitura de `falloffAlcance` no `explodeProjectile`, que mede do dono
   * do tiro ate o ponto do impacto. Nada aqui: os cinco virotes saem pelo
   * `spawnProjectiles` de sempre, que ja le `count` e `spread`
   */
  /**
   * A QUEDA DE DANO DA SALVA, e ela volta o `damage` original quando a skill
   * nao tem queda.
   *
   * ## POR QUE A DISTANCIA E DO DONO, E NAO DO VIROTE
   *
   * Porque um virote sempre nasce na mao do arqueiro. Se a conta usasse o
   * caminho que ele percorreu, os cincoCOOLETOS sairiam com distancias
   * diferentes e o leque nao valeria mais nada — o dano dependeria de qual
   * angulo acertou primeiro
   *
   * O que o jogador controla e a distancia DELE ate o alvo, entao e essa a
   * medida. Perto a salva bate forte; longe os cinco batem no minimo e nao ha
   * com o que compensar
   */
  danoComQueda(action, projectile, center) {
    const alcance = action.falloffAlcance ?? 0;

    if (!alcance) return action.damage ?? 0;

    const dono =
      projectile.ownerId === null
        ? this.player
        : this.world.players.get(projectile.ownerId)?.player ?? this.player;

    const distancia = Math.hypot(center.x - dono.x, center.y - dono.y);

    const fracao = Math.max(0, Math.min(1, 1 - distancia / alcance));
    const piso = action.falloffMinimo ?? 0.35;

    /* interpola entre o piso e 1: perto e o dano cheio, longe e o piso */
    const escala = piso + (1 - piso) * fracao;

    return (action.damage ?? 0) * escala;
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
        damage: this.danoComQueda(action, projectile, center),
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
