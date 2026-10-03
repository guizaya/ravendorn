import { distance, normalize, randomBetween } from "../math.js";
import { BEHAVIOR } from "../../data/enemies/index.js";

const STUCK_THRESHOLD = 0.45;
const STUCK_SIDESTEP = 0.55;
const STUCK_COOLDOWN = 0.8;
const ARRIVE_EPSILON = 14;
const RETURN_ARRIVE = 20;
const RETURN_MARGIN = 20;
const RETARGET_INTERVAL = 0.35;

export class EnemyAI {
  constructor(world, { onDamagePlayer, onShootPlayer } = {}) {
    this.world = world;
    this.onDamagePlayer = onDamagePlayer ?? (() => {});

    // atirador: quem cria a flecha e o motor, nao a IA. aqui so
    // chega o "agora atira neste alvo"
    this.onShootPlayer = onShootPlayer ?? (() => {});
  }

  get player() {
    return this.world.player;
  }

  /**
   * Todos os jogadores online.
   *
   * No single player tem um so e a lista tem um elemento, entao
   * o comportamento nao muda. Online, um inimigo compartilhado
   * precisa saber que ha varias pessoas no mesmo mapa.
   */
  get players() {
    if (this.world.players?.size) {
      return [...this.world.players.values()].map(
        (session) => session.player,
      );
    }

    return this.world.player ? [this.world.player] : [];
  }

  /**
   * O jogador que este inimigo esta perseguindo: o mais proximo.
   *
   * Devolve `null` quando nao ha ninguem no mapa. Isso acontece
   * de verdade: e o instante entre o ultimo jogador sair e o
   * proximo entrar. Sem o `null` explicito, `distance(enemy,
   * null)` leria `x` de `null` e derrubaria o laco do servidor
   * inteiro, nao so este mob.
   *
   * No single player nunca e `null`, entao o comportamento nao
   * muda. Online, o inimigo so persegue o mais proximo: senao ele
   * ignoraria o resto da partida e pareceria travado de costas.
   */
  nearestPlayer(enemy) {
    let best = null;
    let bestDistance = Infinity;

    for (const player of this.players) {
      const d = distance(enemy, player);

      if (d < bestDistance) {
        bestDistance = d;
        best = player;
      }
    }

    return best;
  }

  update(enemy, deltaTime) {
    if (!enemy.isCreature && !enemy.duelo) return;

    enemy.attackAnimation = Math.max(
      0,
      enemy.attackAnimation - deltaTime,
    );

    enemy.attackCooldownRemaining = Math.max(
      0,
      enemy.attackCooldownRemaining - deltaTime,
    );

    if (!enemy.alive) {
      enemy.aiState = "dead";
      return;
    }

    // O boneco de duelo tem a regra DELA, e nao a de mob: trava no
    // primeiro agressor, nao vagueia e nao volta para casa. Sem
    // este desvio antes do `updateAlert`, ele usaria o alerta por
    // `aggroRange` e trocaria de alvo pelo mais proximo
    if (enemy.duelo) {
      this.updateDuel(enemy, deltaTime);
      return;
    }

    this.updateAlert(enemy, deltaTime);
    this.updateBehavior(enemy, deltaTime);
  }

  /**
   * A regra do boneco de duelo.
   *
   * Fica em duelo ate um dos dois morrer: ele trava em quem bateu
   * primeiro, vai ate la, bate, e NAO troca de alvo nem se um
   * jogador mais perto aparecer na frente. So quando o alvo morre
   * (ou sai) o agro passa para quem estiver batendo nele naquele
   * instante; sem ninguem batendo, o boneco volta a ficar parado.
   *
   * Quem trava e o `provoke`, e nao aqui: e no golpe que se sabe
   * QUEM bateu. Aqui so se resolve o que fazer com essa informacao.
   */
  updateDuel(enemy, deltaTime) {
    if (!enemy.targetId) {
      enemy.aiState = "idle";
      return;
    }

    const alvo = this.playerById(enemy.targetId);

    // O alvo morreu ou saiu. O agro vai para quem esta batendo
    // AGORA, e e a unica troca de alvo da regra
    if (!alvo || !this.estaDePe(alvo)) {
      const proximo = enemy.lastHitById
        ? this.playerById(enemy.lastHitById)
        : null;

      if (
        proximo &&
        this.estaDePe(proximo) &&
        proximo.id !== enemy.targetId
      ) {
        enemy.targetId = proximo.id;
      } else {
        // ninguem para bater: o boneco destrava e volta a ser alvo
        // fixo, do jeito que estava antes do primeiro golpe
        enemy.targetId = null;
        enemy.aiState = "idle";
        return;
      }
    }

    const alvoAtual = this.playerById(enemy.targetId);

    if (!alvoAtual) {
      enemy.targetId = null;
      enemy.aiState = "idle";
      return;
    }

    const distancia = distance(enemy, alvoAtual);

    enemy.facing = normalize(
      alvoAtual.x - enemy.x,
      alvoAtual.y - enemy.y,
    );

    if (distancia <= enemy.duelo.attackRange) {
      enemy.aiState = "attack";
      this.tryAttack(
        enemy,
        distancia,
        alvoAtual,
        enemy.duelo,
      );

      return;
    }

    // SEM recuo e SEM `leash`: o boneco vai ate o fim. A regra
    // pedida e ir ate o outro, e um boneco que desistisse no meio do
    // campo por causa da `leash` do mob estaria se comportando como
    // mob
    enemy.aiState = "chase";

    this.moveToward(
      enemy,
      alvoAtual,
      deltaTime,
      enemy.duelo.speed,
    );
  }

  /**
   * O jogador ainda esta de pe.
   *
   * A entidade do jogador NAO tem `alive`: a morte dele e `hp <= 0`.
   * Usar `alive` aqui dava `undefined`, que e falso, e o boneco
   * soltava o alvo no primeiro tick e voltava a ficar parado com o
   * agro apontado para o jogador
   */
  estaDePe(player) {
    return player.hp > 0;
  }

  /** O jogador online com este id, ou `null`. */
  playerById(id) {
    if (!id) return null;

    for (const player of this.players) {
      if (player.id === id) return player;
    }

    return null;
  }

  provoke(enemy, attacker = null) {
    // o boneco de duelo e provoke por qualquer golpe, mesmo sem o
    // `behavior` de mob, e o `attacker` e o que define o alvo
    if (enemy.duelo) {
      this.provocarDuelo(enemy, attacker);
      return;
    }

    if (!enemy.isCreature) return;

    if (enemy.behavior === BEHAVIOR.PASSIVE) return;

    if (!enemy.provoked) {
      enemy.provoked = true;
      enemy.alerted = true;
    }
  }

  /**
   * O primeiro golpe trava o alvo, e nao o primeiro a estar perto.
   *
   * E a diferenca entre "vai ate quem bateu" e "vai ate o mais
   * proximo": o boneco tem `aggroRange: Infinity`, entao ele
   * reagiria a qualquer um no mapa. Quem trava e o primeiro a
   * encostar.
   */
  provocarDuelo(enemy, attacker) {
    if (!attacker?.isPlayer) return;

    // o ultimo a bater e sempre lembrado: e o proximo alvo quando o
    // atual morrer
    enemy.lastHitById = attacker.id;

    // JA TRAVADO: nao troca. E o que o jogador pediu, e o que
    // diferencia o boneco de todo mob do jogo
    if (enemy.targetId) return;

    enemy.targetId = attacker.id;
    enemy.provoked = true;
    enemy.alerted = true;
  }

  updateAlert(enemy, deltaTime) {
    if (enemy.behavior === BEHAVIOR.PASSIVE) {
      enemy.alerted = false;
      return;
    }

    if (enemy.behavior === BEHAVIOR.SEMI_PASSIVE) {
      return;
    }

    if (enemy.alerted) {
      enemy.aiTimer += deltaTime;

      const leash = enemy.leash;
      const alvo = this.nearestPlayer(enemy);

      // sem alvo nao ha para onde esticar a corda. o mob volta a
      // ficar calmo em vez de comparar a distancia com `null`
      if (!alvo) {
        enemy.alerted = false;
        enemy.provoked = false;
        return;
      }

      if (
        distance(enemy, alvo) >
        Math.max(leash, enemy.aggroRange) * 1.6
      ) {
        enemy.alerted = false;
        enemy.provoked = false;
      }
    }
  }

  isAggressive(enemy) {
    if (enemy.behavior === BEHAVIOR.PASSIVE) {
      return false;
    }

    if (enemy.behavior === BEHAVIOR.SEMI_PASSIVE) {
      return enemy.provoked;
    }

    if (enemy.alerted || enemy.provoked) {
      return true;
    }

    const alvo = this.nearestPlayer(enemy);

    // ninguem no mapa: ninguem para provocar
    if (!alvo) return false;

    if (
      distance(enemy, alvo) <= enemy.aggroRange
    ) {
      enemy.alerted = true;
      enemy.aiTimer = 0;
      return true;
    }

    return false;
  }

  updateBehavior(enemy, deltaTime) {
    if (!this.isAggressive(enemy)) {
      const home = {
        x: enemy.spawnX,
        y: enemy.spawnY,
      };

      const restRadius =
        (enemy.wanderRadius ?? 60) + RETURN_MARGIN;

      if (distance(enemy, home) > restRadius) {
        this.updateReturn(enemy, deltaTime);
        return;
      }

      this.updateIdle(enemy, deltaTime, restRadius);
      return;
    }

    this.updateCombat(enemy, deltaTime);
  }

  updateCombat(enemy, deltaTime) {
    const player = this.nearestPlayer(enemy);

    // o jogador desconectou entre o `isAggressive` e aqui. sem
    // este retorno o `distance` abriria o `null`
    if (!player) return;

    const toPlayer = distance(enemy, player);

    // O atirador NAO encosta. Se o jogador chega perto demais, ele
    // da um passo para tras em vez de ficar parado no lugar levando
    // pancada de perto: a arte dele e um arco, e um arco a 40px nao
    // faz sentido nenhum.
    //
    // O `updateBehavior` ja so chega aqui com o bicho engatado
    // (`isAggressive`), entao nao ha como um atirador de passagem
    // andar para tras de quem passou perto sem ter notado.
    if (enemy.ranged && toPlayer < enemy.keepDistance) {
      enemy.aiState = "retreat";
      enemy.facing = normalize(
        enemy.x - player.x,
        enemy.y - player.y,
      );

      this.moveToward(
        enemy,
        { x: enemy.x * 2 - player.x, y: enemy.y * 2 - player.y },
        deltaTime,
        enemy.speed,
      );

      return;
    }

    if (toPlayer <= enemy.attackRange) {
      enemy.aiState = "attack";
      enemy.facing = normalize(
        player.x - enemy.x,
        player.y - enemy.y,
      );

      this.tryAttack(enemy, toPlayer, player);

      return;
    }

    const homeDistance = distance(
      { x: enemy.spawnX, y: enemy.spawnY },
      player,
    );

    if (
      enemy.behavior === BEHAVIOR.ACTIVE &&
      !enemy.provoked &&
      homeDistance > enemy.leash
    ) {
      enemy.alerted = false;
      this.updateReturn(enemy, deltaTime);

      return;
    }

    enemy.aiState = "chase";
    enemy.facing = normalize(
      player.x - enemy.x,
      player.y - enemy.y,
    );

    this.moveToward(enemy, player, deltaTime, enemy.speed);
  }

  updateReturn(enemy, deltaTime) {
    const home = {
      x: enemy.spawnX,
      y: enemy.spawnY,
    };

    if (distance(enemy, home) < RETURN_ARRIVE) {
      enemy.aiState = "idle";
      enemy.wanderTarget = null;
      return;
    }

    /**
     * O PASSEIO E INTERROMPIDO AQUI, e nao so quando o bicho chega.
     *
     * Sem esta linha o bicho fica segurando o alvo de passeio antigo,
     * que aponta para FORA da area, enquanto ele volta para casa. No
     * quadro seguinte, ja dentro do `restRadius`, o `updateIdle`
     * encontra esse alvo velho e continua a caminhada para fora — e o
     * `updateBehavior` puxa de volta no quadro seguinte. Os dois
     * estados brigam pelo mesmo quadro, para sempre
     *
     * O sintoma era um piscar, e nao um tremor de corpo: a cada quadro
     * o bicho saltava entre a linha de caminhada de uma direcao e a da
     * direcao OPOSTA, 60 vezes por segundo. Como o `wanderRadius` e
     * maior que o `restRadius` na diagonal, isso atingia qualquer bicho
     * que passeasse — o rato era so o mais comum de ver
     *
     * Zerar o alvo aqui ainda deixa a pausa natural: o `wanderWait`
     * congelou em 1.2 a 3.4s no momento em que o passeio comecou, e
     * ele so volta a andar quando esse tempo passa
     */
    enemy.wanderTarget = null;

    enemy.aiState = "return";
    enemy.facing = normalize(
      home.x - enemy.x,
      home.y - enemy.y,
    );

    this.moveToward(enemy, home, deltaTime, enemy.speed);
  }

  updateIdle(enemy, deltaTime, restRadius = null) {
    if (!enemy.wanderTarget) {
      enemy.wanderWait -= deltaTime;

      if (enemy.wanderWait > 0) return;

      enemy.wanderWait = randomBetween(1.2, 3.4);

      const raio = enemy.wanderRadius ?? 0;

      const alvo = {
        x: enemy.spawnX + randomBetween(-1, 1) * raio,
        y: enemy.spawnY + randomBetween(-1, 1) * raio,
      };

      /**
       * O alvo NUNCA pode pedir para o bicho sair da area.
       *
       * O alvo e sorteado por eixo, entao o canto mais longe e
       * `wanderRadius * 1.41`. Com o `restRadius` sendo
       * `wanderRadius + 20`, qualquer bicho com raio acima de ~48
       * sorteava um alvo diagonal que estava FORA do limite: ele
       * andava para fora, era puxado de volta no meio do caminho, e
       * ainda segurava o alvo velho — e o `updateReturn` agora limpa o
       * alvo, o que impede o piscar, mas deixaria o bicho fazendo
       * vaivem de ida e volta na borda
       *
       * Encolher o alvo ate caber no limite mantem o passeio inteiro
       * dentro da area. O bicho continua andando pelo mesmo tamanho de
       * terreno; ele so nunca mais sai e e puxado de volta
       */
      if (restRadius !== null) {
        const dx = alvo.x - enemy.spawnX;
        const dy = alvo.y - enemy.spawnY;
        const longe = Math.hypot(dx, dy);

        if (longe > restRadius && longe > 0) {
          alvo.x = enemy.spawnX + (dx / longe) * restRadius;
          alvo.y = enemy.spawnY + (dy / longe) * restRadius;
        }
      }

      enemy.wanderTarget = alvo;

      return;
    }

    if (distance(enemy, enemy.wanderTarget) < ARRIVE_EPSILON) {
      enemy.wanderTarget = null;
      enemy.aiState = "idle";
      return;
    }

    enemy.aiState = "wander";
    enemy.facing = normalize(
      enemy.wanderTarget.x - enemy.x,
      enemy.wanderTarget.y - enemy.y,
    );

    this.moveToward(
      enemy,
      enemy.wanderTarget,
      deltaTime,
      enemy.wanderSpeed ?? enemy.speed * 0.35,
    );
  }

  tryAttack(enemy, targetDistance, target, tuning = enemy) {
    if (enemy.attackCooldownRemaining > 0) return;

    if (targetDistance > tuning.attackRange) return;

    enemy.attackCooldownRemaining = tuning.attackCooldown;

    // O boneco de duelo nao tem arte de golpe, e o `resolveFrameRect`
    // cai no walk quando pedem "attack". O tempo de animacao ainda
    // conta, para o boneco nao recarregar no ar
    enemy.attackAnimation = 0.28;

    // O atirador dispara; todo mundo else encosta.
    //
    // A arte de tiro dele so entra com alvo de verdade
    // (`needsTarget`), e o alvo existe: o `facing` acabou de ser
    // virado para o jogador. O `onShootPlayer` e o motor montando a
    // flecha: a IA nao cria projetel, porque quem decide o dano e
    // o servidor, e no single player o motor da tela e o mesmo
    // caminho
    if (enemy.ranged) {
      this.onShootPlayer(enemy, target);
      return;
    }

    this.onDamagePlayer(enemy, tuning.damage, target);
  }

  moveToward(enemy, target, deltaTime, speed) {
    const direction = normalize(
      target.x - enemy.x,
      target.y - enemy.y,
    );

    if (direction.x === 0 && direction.y === 0) {
      return;
    }

    const stepX = direction.x * speed * deltaTime;
    const stepY = direction.y * speed * deltaTime;

    const before = { x: enemy.x, y: enemy.y };

    this.world.collision.moveEntity(
      enemy,
      stepX,
      stepY,
      this.world.enemies,
    );

    const moved = Math.hypot(
      enemy.x - before.x,
      enemy.y - before.y,
    );

    if (moved < STUCK_THRESHOLD) {
      enemy.stuckTimer += deltaTime;
    } else {
      enemy.stuckTimer = 0;
      enemy.sidestepTimer = 0;
    }

    if (enemy.stuckTimer > STUCK_THRESHOLD * 4) {
      if (enemy.sidestepTimer <= 0) {
        enemy.sidestepSign = Math.random() < 0.5 ? -1 : 1;
        enemy.sidestepTimer = STUCK_SIDESTEP;
      }
    }

    if (enemy.sidestepTimer > 0) {
      const perpendicular = {
        x: -direction.y * enemy.sidestepSign,
        y: direction.x * enemy.sidestepSign,
      };

      const sidestepSpeed = speed * 0.85;

      this.world.collision.moveEntity(
        enemy,
        perpendicular.x * sidestepSpeed * deltaTime,
        perpendicular.y * sidestepSpeed * deltaTime,
        this.world.enemies,
      );
    }
  }
}

export const AI_CONSTANTS = {
  STUCK_THRESHOLD,
  STUCK_SIDESTEP,
  STUCK_COOLDOWN,
  ARRIVE_EPSILON,
  RETURN_ARRIVE,
  RETURN_MARGIN,
  RETARGET_INTERVAL,
};
