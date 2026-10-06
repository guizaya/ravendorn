import { HURT_FLASH_DURATION } from "../sprites/animation.js";
import { errouOGolpe } from "./Chance.js";

/**
 * AS CORES do numero que sobe.
 *
 * Quatro estados e quatro cores, e cada uma responde a uma pergunta
 * diferente que o jogador faz ao ver o numero:
 *
 * - **branco** — "errou?" (o golpe nao encostou)
 * - **vermelho** — "critico!" (o dobro, e o unico numero que vale a
 *   pena receber bonus de afinidade)
 * - **roxo** — "magico" (o golpe ignorou parte da defesa do alvo)
 * - **amarelo** — o resto, o golpe normal de fisico
 *
 * A ordem importa: um critico magico e VERMELHO, e nao roxo. O critico
 * e a informacao mais importante da tela e nao pode ser diluida por
 * "de que tipo foi o golpe"
 */
export const COR_DANO = Object.freeze({
  normal: "#ffe66d",
  critico: "#ff5f56",
  magico: "#bba0ff",
  miss: "#ffffff",
});

export class DamageSystem {
  constructor({
    statuses,
    effects,
    onDamaged = null,
    onDeath = null,
    onResolved = null,
    random = Math.random,
  }) {
    this.statuses = statuses;
    this.effects = effects;
    this.onDamaged = onDamaged;
    this.onDeath = onDeath;

    /**
     * Cada golpe RESOLVIDO, com o resultado inteiro.
     *
     * E o que alimenta o numero flutuante no multiplayer: o motor roda
     * no servidor, que nao desenha, entao o texto criado aqui morre
     * sem nunca chegar na tela. Com este hook, quem tem o canvas
     * transforma o resultado em numero na posicao certa
     *
     * Diferente do `onDamaged`, que so dispara no acerto que TIRA VIDA,
     * este dispara tambem no miss e na imunidade — um golpe que errou
     * nao tirou vida, e mesmo assim o jogador precisa ver que errou
     */
    this.onResolved = onResolved;

    /**
     * O sorteio, injetavel.
     *
     * E o que permite testar "o golpe errou" sem rezar para o
     * `Math.random`. Vale para o critico e para o miss, que sao as duas
     * rolagens deste metodo
     */
    this.random = random;
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

      this.onResolved?.(attacker, target, {
        amount: 0,
        critical: false,
        missed: false,
        immune: true,
        damageType: action.damageType,
      });

      return 0;
    }

    /**
     * O golpe pode PASSAR BATIDO, e e a primeira coisa resolvida.
     *
     * Antes de qualquer conta. Se o golpe errou, nao ha defense a
     * aplicar, nao ha HP a tirar, nao ha lifesteal, nao ha reflexo e
     * nao ha `onDamaged` — e tratar o erro como "dano zero" daria ao
     * alvo um golpe de zero que ainda dispara tudo, e o jogador veria
     * um numero em vez de "MISS"
     */
    const missed = errouOGolpe(attacker, target, this.random);

    if (missed) {
      this.effects.addText(
        target.x,
        target.y - target.radius - 8,
        "MISS",
        COR_DANO.miss,
      );

      this.onResolved?.(attacker, target, {
        amount: 0,
        critical: false,
        missed: true,
        immune: false,
        damageType: action.damageType,
      });

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

    const critical = this.random() < (attacker.critRate ?? 0);

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

    // quanto tempo o alvo fica reagindo ao golpe. E o mesmo numero
    // para mob e para jogador, e o desenho usa ele tanto para o flash
    // quanto para o tremor
    target.hitFlash = HURT_FLASH_DURATION;

    // Quem deu o golpe que zerou o HP fica com o loot. Isto e
    // gravado a CADA dano, nao so na morte: com dois jogadores no
    // mesmo mob, o ultimo a acertar e o dono, mesmo que ele ja
    // esteja longe quando o mob cai. O lifesteal e o reflexo
    // abaixo usam o `attacker` local, entao a copia em
    // `lastHitBy` nao interfere neles.
    if (attacker && attacker !== target) {
      target.lastHitBy = attacker;

      /**
       * QUANDO O GOLPE ACONTECEU, e nao so quem deu.
       *
       * O `lastHitBy` sozinho nao diz se o golpe e de agora. Ele e
       * gravado a cada dano e NUNCA e limpo: o mob leva o primeiro
       * golpe, o jogador vai caçar outro, e tres minutos depois o mob
       * morre de DoT — e o dono do abate ainda era o jogador que saiu
       * para longe ha tres minutos
       *
       * O sintoma era o pior dos dois: o jogador que tinha acabado de
       * matar o proprio mob viajava quatro mil pixels para a base e,
       * quando voltava, recebia o loot de um abate que ele nao deu
       *
       * So o tempo de agora gravado resolve: o dono passa a valer
       * enquanto o golpe for recente, e um abate cujo dono ultimo
       * atacou faz tempo cai no `null` e nao paga ninguem
       */
      target.lastHitAt = Date.now();

      /**
       * GOLPE DIREITO, entao a marca do veneno e apagada.
       *
       * Um mob pode estar envenenado e levar um golpe na mao. Se o
       * golpe direto nao limpasse a marca, o abate seguinte seria
       * creditado a quem envenenou — que foi o ultimo a queimar, nao
       * o ultimo a bater
       */
      target.lastHitPorDoT = false;
    }

    this.onDamaged?.(attacker, target, amount, action);

    /**
     * A cor do numero, nesta ordem de prioridade: critico, depois
     * magico, depois o normal.
     *
     * O critico nao cede para o magico porque e a informacao mais cara
     * da tela: e o numero que o jogador procura para decidir de meter
     * ponto em afinidade. Um critico magico pintado de roxo seria lido
     * como "golpe de fogo normal"
     */
    const cor = critical
      ? COR_DANO.critico
      : action.damageType === "magic"
        ? COR_DANO.magico
        : COR_DANO.normal;

    this.effects.addText(
      target.x,
      target.y - target.radius - 8,
      String(amount),
      cor,
      critical,
    );

    this.onResolved?.(attacker, target, {
      amount,
      critical,
      missed: false,
      immune: false,
      damageType: action.damageType,
    });

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

  /**
   * Cura `target` e devolve QUANTO curou.
   *
   * O retorno e o que permite ao uso de item nao beber a pocao com a
   * vida cheia: quem chama decide se consume com base no numero, e
   * nao num `void` que so diz "pode ter curado". O `min` com o teto ja
   * existia para o lifesteal nao estourar a barra; aqui ele e
   * informacao, e nao so um clamp
   *
   * `0` quando nao curou nada: alvo morto, valor invalido, ou vida
   * ja cheia
   */
  heal(target, amount) {
    if (!target || target.hp <= 0 || amount <= 0) return 0;

    const healed = Math.min(amount, target.maxHp - target.hp);

    if (healed <= 0) return 0;

    target.hp += healed;

    this.effects.addText(
      target.x,
      target.y - target.radius - 12,
      `+${healed}`,
      "#83ef9b",
    );

    return healed;
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
