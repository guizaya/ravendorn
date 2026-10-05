import { distance, normalize, randomBetween } from "../math.js";
import { BEHAVIOR } from "../../data/enemies/index.js";

const STUCK_THRESHOLD = 0.45;
const STUCK_SIDESTEP = 0.55;
const STUCK_COOLDOWN = 0.8;
const ARRIVE_EPSILON = 14;
const RETURN_ARRIVE = 20;
const RETURN_MARGIN = 20;
const RETARGET_INTERVAL = 0.35;

/**
 * O VAO QUE UM MOB DEIXA PARA O OUTRO.
 *
 * ## O QUE ISTO RESOLVE
 *
 * O `isPositionFree` do colisor e uma parede DURA: o passo e bloqueado se
 * a nova posicao cair dentro de `radius + radius` de outro mob. Com sete
 * ogres correndo para o mesmo jogador, os seis de tras ficam presos no
 * primeiro, empilham, e o desenho mostra a animacao de andar com o
 * personagem parado
 *
 * O espaco extra de 34% abaixo da soma dos raios e o que vira a parede
 * em "todos cabem". Nao deixa sobrepor, entao continua parecendo solido,
 * mas da para um bicho contornar o outro em vez de ficar parado esperando
 * ele morrer
 *
 * ## POR QUE 1.34 E NAO MAIS
 *
 * Acima de ~1.5 os mobes param de se encostar e a arena vira roda de
 * bicho. Abaixo de ~1.2 eles voltam a empilhar. A janela e estreita de
 * proposito: e o minimo que faz a multidao andar
 */
const SEPARATION_FACTOR = 1.34;

/**
 * ATE ONDE A SEPARACAO EMPURRA.
 *
 * Alem disso o mob ate o alvo empurra a multidao inteira na direcao
 * errada: um ogre no fundo da sala giraria o grupo em vez de chegar
 */
const SEPARATION_RANGE = 120;

/**
 * O quanto a separacao pesa contra a direcao do alvo.
 *
 * O valor e grande de proposito. Com 0.4 o mob vencia a multidao e
 * atravessava os outros; a separacao precisa ganhar do alvo, senao o
 * primeiro da fila e o unico que chega
 */
const SEPARATION_WEIGHT = 1.15;

/**
 * O SETOR DE CADA MOB AO REDOR DO ALVO.
 *
 * ## POR QUE EXISTE
 *
 * Todo mundo mira no PONTO do jogador, entao sete ogres tentam ocupar a
 * mesma circunferencia de raio `attackRange`. Seis ficam fora do alcance
 * e ficam empurrando para sempre
 *
 * Cada mob recebe um angulo proprio, derivado do id, e persegue um ponto
 * girado em torno do alvo. Com angulos diferentes, todos entram no
 * alcance ao mesmo tempo e todos batem — o que e o que o jogador espera
 * de uma briga contra um grupo
 *
 * O angulo nao e sorteado: e o hash do id. Dois ogres nunca pegam o
 * mesmo setor, e a distribuicao nao muda entre quadros nem entre sessoes
 */
const SLOT_COUNT = 8;
const SLOT_SWEEP = Math.PI * 2;

/**
 * A TOLERANCIA DE GOLPE NA MULTIDAO.
 *
 * ## A GEOMETRIA NAO DEIXA
 *
 * N criaturas de raio `r` em volta de um ponto ficam todas na mesma
 * distancia `r_eq = 2r / (2 * sin(pi/N))`. Para oito ogres de raio 32 isso
 * da 84px — e o alcance de golpe deles e 78. Nao ha posicao em que os
 * oito alcancem: e area de circunferencia, nao opcao de tuning
 *
 * ## O QUE A TOLERANCIA FAZ
 *
 * Um mob que chegou na borda da multidao, travado pelos sete vizinhos e
 * a 6px do alcance, bate em vez de esperar. A folga e metade do proprio
 * raio: o bastante para o anel de oito caber, e pequenao ponto de um
 * mob BATENDO de fora do alcance dele ficar absurdo
 *
 * E por isso que a tolerancia e do RAAIO e nao um numero solto: ela
 * cresce com o bicho. Um ogre grande tolera mais que um limo, que e o que
 * a leitura visual espera
 */
const TOLERANCIA_MULTIDAO = 0.5;

/** o alcance de golpe, com a folga da multidao */
function alcanceEfetivo(enemy) {
  return (
    (enemy.attackRange ?? 44) +
    (enemy.radius ?? 20) * TOLERANCIA_MULTIDAO
  );
}

/** o angulo de um mob em torno do alvo, derivado do id */
function anguloDoSlot(enemy) {
  let soma = 0;

  const id = String(enemy.id ?? enemy.typeId ?? "?");

  for (let i = 0; i < id.length; i += 1) {
    soma = (soma * 31 + id.charCodeAt(i)) >>> 0;
  }

  return (soma % SLOT_COUNT) * (SLOT_SWEEP / SLOT_COUNT);
}

/** o ponto que o mob persegue: o alvo girado no angulo do seu setor */
function pontoDoSetor(enemy, target) {
  const angulo = anguloDoSlot(enemy);

  const distancia = (enemy.attackRange ?? 44) * 0.72;

  return {
    x: target.x + Math.cos(angulo) * distancia,
    y: target.y + Math.sin(angulo) * distancia,
  };
}

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
      enemy.facing = normalize(
        enemy.x - player.x,
        enemy.y - player.y,
      );

      const andou = this.moveToward(
        enemy,
        { x: enemy.x * 2 - player.x, y: enemy.y * 2 - player.y },
        deltaTime,
        enemy.speed,
      );

      /**
       * `retreat` tambem esta no conjunto de andar, entao o mesmo defeito
       * atingia o atirador: ele batia na multidao do jogador, o passo
       * saia zero e a arte de andar tocava com o bicho parado
       */
      enemy.aiState = andou ? "retreat" : "idle";

      return;
    }

    /**
     * O ALCANCE QUE DECIDE O GOLPE tem a folga da multidao.
     *
     * O `tryAttack` ainda exige o alcance de verdade para acertar: ele
     * recebe `toPlayer` e compara com `tuning.attackRange`. Aqui a
     * comparacao e a do `alcanceEfetivo`, que e o mesmo alcance mais meia
     * raio — o suficiente para o anel de oito ogres caber
     */
    if (toPlayer <= alcanceEfetivo(enemy)) {
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

    /**
     * O ALVO E O SETOR, e nao o jogador.
     *
     * Perseguir o ponto do jogador faz todos tentarem a mesma
     * circunferencia: um entra no alcance e seis ficam do lado de fora
     * empurrando. Cada mob persegue o girado do seu setor, entao varios
     * chegam a bater ao mesmo tempo
     *
     * A comparacao do `toPlayer` acima continua sendo com o jogador de
     * verdade: e o alcance do golpe que conta, e nao o do setor
     */
    const andou = this.moveToward(
      enemy,
      pontoDoSetor(enemy, player),
      deltaTime,
      enemy.speed,
    );

    /**
     * O ESTADO SO E `chase` SE O MOBO ANDOU.
     *
     * Era aqui que nascia a animacao travada: o `aiState` virava
     * `chase` pela INTENCAO, e `chase` esta no conjunto de estados que
     * tocam animacao de andar. Com o mob bloqueado por outro, o estado
     * continuava `chase` e o desenho tocava andar com o bicho parado
     *
     * Sem passo, o estado volta a `idle`, que e o que o desenho sabe
     * tocar parado. O proximo quadro em que ele destravar traz `chase`
     * de volta sozinho
     */
    enemy.aiState = andou ? "chase" : "idle";

    enemy.facing = normalize(
      player.x - enemy.x,
      player.y - enemy.y,
    );
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

    const andou = this.moveToward(
      enemy,
      home,
      deltaTime,
      enemy.speed,
    );

    enemy.aiState = andou ? "return" : "idle";
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

    /**
     * O `wander` so e `wander` SE ANDOU.
     *
     * E o caso mais comum do defeito: sete limos nao agressivos nascem
     * perto um do outro, todos sorteiam o mesmo ponto de passeio e
     * empilham. O primeiro chega e fica `idle`; os outros seis ficam
     * com `wander` rodando sem sair do lugar, e sete bixos tocam
     * animacao de caminhada parada
     */
    const andou = this.moveToward(
      enemy,
      enemy.wanderTarget,
      deltaTime,
      enemy.wanderSpeed ?? enemy.speed * 0.35,
    );

    enemy.aiState = andou ? "wander" : "idle";
  }

  tryAttack(enemy, targetDistance, target, tuning = enemy) {
    if (enemy.attackCooldownRemaining > 0) return;

    /**
     * O alcance aqui e o EFETIVO, com a folga da multidao.
     *
     * E o que permite o mob travado na borda do anel acertar o golpe. Sem
     * esta troca, o `updateCombat` o colocaria em `attack` (dentro da
     * tolerancia) e o `tryAttack` recusaria de novo pelo alcance real —
     * o bicho ficaria parado em `attack` para sempre
     */
    if (targetDistance > alcanceEfetivo(tuning)) return;

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

  /**
   * A EMPURRAO ENTRE MOBES.
   *
   * ## POR QUE EXISTE
   *
   * O colisor so diz "este passo esta bloqueado". Isso e o suficiente
   * para uma parede, e e exatamente o que forma a parede de mobes: cada um
   * empurra o proximo, e o ultimo da fila nao sai do lugar
   *
   * Aqui a multidao se resolve ANTES do passo: cada mob soma um vetor que
   * aponta PARA FORA de quem esta perto demais, e esse vetor entra na
   * direcao final. O resultado e um circulo que se abre sozinho, sem
   * nenhum mob precisar saber dos outros
   *
   * ## POR QUE SO ENTRE MOBES VIVOS
   *
   * O filtro e o mesmo do colisor (`alive !== false`), e por ele que um
   * cadaver nao empurra ninguem e o jogador nao entra na conta. Um mob que
   * se aproxima do jogador tem que atravessar a multidao dos aliados
   *
   * ## POR QUE A FORCA CAI COM A DISTANCIA
   *
   * `1 - distancia / (minimo * FATOR)`: dois mobes encostados empurram com
   * forca 1 e dois que quase se tocam empurram com quase nada. E o que faz
   * a multidao ceder espaco em vez de tremer
   */
  separacaoDe(thisEnemy) {
    let x = 0;
    let y = 0;

    const vizinhos = this.world.enemies;

    for (const outro of vizinhos) {
      if (outro === thisEnemy) continue;
      if (outro.alive === false) continue;
      if (outro.isCreature !== true) continue;

      const dx = thisEnemy.x - outro.x;
      const dy = thisEnemy.y - outro.y;

      const distancia = Math.hypot(dx, dy);

      const minimo = (thisEnemy.radius ?? 20) + (outro.radius ?? 20);

      // longe demais: nao ha por que empurrar
      if (distancia >= SEPARATION_RANGE) continue;

      /**
       * `distancia` em 0 daria `NaN` na divisao. Dois corpos exatamente
       * sobrepostos e o caso que a multidao produz, porque todos miram o
       * mesmo ponto — e e o pior estado possivel do sistema
       */
      if (distancia < 0.0001) {
        const ang = anguloDoSlot(thisEnemy);

        x += Math.cos(ang);
        y += Math.sin(ang);

        continue;
      }

      const sobreposicao =
        1 - distancia / (minimo * SEPARATION_FACTOR);

      if (sobreposicao <= 0) continue;

      const forca = sobreposicao * SEPARATION_WEIGHT;

      x += (dx / distancia) * forca;
      y += (dy / distancia) * forca;
    }

    return { x, y };
  }

  /**
   * Anda na direcao de um ponto, somando a empurrao da multidao.
   *
   * ## POR QUE A DIRECAO FINAL NAO E O ALVO
   *
   * Ir direto no alvo e o que forma a parede de mobes. A separacao entra
   * na MESMA soma da direcao do alvo, e nao como um passo a parte: dois
   * passos depois do colisor produziriam um trem de allowances, em que a
   * separacao sempre perde para o bloqueio do primeiro da fila
   *
   * ## O QUE VOLTA
   *
   * `true` quando o mob ANDOU. E o que o `updateCombat` usa para nao
   * deixar a animacao de andar com o bicho parado: `chase` so continua
   * se houve passo, e sem passo o estado volta a `idle`, que e o que o
   * desenho sabe tocar
   */
  moveToward(enemy, target, deltaTime, speed) {
    const rumo = normalize(
      target.x - enemy.x,
      target.y - enemy.y,
    );

    const empurrao = this.separacaoDe(enemy);

    /**
     * A EMPURRAO SO TRABALHA DE LADO.
     *
     * ## O QUE ESTAVA ERRADO
     *
     * A primeira versao somava a empurrao inteira na direcao do alvo. Com
     * oito ogres em volta do jogador, cada um empurrava o vizinho para
     * FORA do centro, e o equilibrio era um anel a 84px — seis pixels
     * fora do alcance de golpe de 78. O resultado era o pior dos dois:
     * nenhum se sobrepunha e nenhum batia
     *
     * ## POR QUE SO A PARTE TANGENCIAL
     *
     * O que resolve a multidao e DESLIZAR: o mob que tem outro na frente
     * contorna de lado ate a posicao estar livre. Empurrar para longe do
     * alvo fights o objetivo em vez de servir a ele
     *
     * A projecao em `(perpendicular · empurrao)` joga fora a componente
     * que aponta para tras e guarda a que corre ao longo do anel. Com
     * isso o anel aperta o quanto precisar para todos caberem e o
     * primeiro que chega bate
     */
    const lateral =
      -rumo.y * empurrao.x + rumo.x * empurrao.y;

    let dirX = rumo.x + -rumo.y * lateral;
    let dirY = rumo.y + rumo.x * lateral;

    const tamanho = Math.hypot(dirX, dirY);

    if (tamanho > 0.0001) {
      dirX /= tamanho;
      dirY /= tamanho;
    }

    if (dirX === 0 && dirY === 0) {
      return false;
    }

    const stepX = dirX * speed * deltaTime;
    const stepY = dirY * speed * deltaTime;

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
        x: -dirY * enemy.sidestepSign,
        y: dirX * enemy.sidestepSign,
      };

      const sidestepSpeed = speed * 0.85;

      this.world.collision.moveEntity(
          enemy,
          perpendicular.x * sidestepSpeed * deltaTime,
          perpendicular.y * sidestepSpeed * deltaTime,
          this.world.enemies,
        );
    }

    return moved >= STUCK_THRESHOLD;
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
