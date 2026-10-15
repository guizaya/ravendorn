import { buildStatSheet } from "../stats/StatSheet.js";

export function createPlayer(
  classDefinition,
  spawn,
  options = {},
) {
  const stats = classDefinition.stats;

  const jogador = {
    // o id precisa ser unico por sessao. no single player o id da
    // classe servia, mas online dois jogadores da mesma classe
    // colidiriam e o last hit do loot nao saberia de quem e
    id: options.id ?? `player_${classDefinition.id}`,
    // marca explicita de que isto e um jogador. antes o motor
    // comparava com `world.player` para saber, o que so
    // funciona com uma pessoa jogando: online, o dano de um
    // jogador em um mob precisa ser reconhecido como vindo de
    // um jogador mesmo sendo o segundo da fila
    isPlayer: true,
    // o nome vem da tela de selecao. sem ele, o nome da classe e
    // um nome generico que todo mundo da classe compartilharia
    name: options.name ?? classDefinition.name,
    classId: classDefinition.id,
    definition: classDefinition,

    level: 1,

    x: spawn.x,
y: spawn.y,
      radius: 22,

      /**
       * O EMPURRAO, e ele precisa existir ANTES de qualquer coisa le-lo.
       *
       * ## POR QUE ESTE CAMPO ESTAVA FALTANDO
       *
       * O `GameEngine` le `player.pushVelocity` desde sempre — e o zerava na
       * morte e ao voltar para a base, em dois lugares. Mas o campo NUNCA foi
       * criado aqui: o jogador nao tinha `pushVelocity`, e o motor so o usava
       * para ZERAR algo que nao existia
       *
       * Ou seja: o golpe do inimigo no jogador nunca empurrou, e o
       * `enemiesPush` — que existe para isso — jogava num buraco
       *
       * ## POR QUE `enemiesPush` NAO DAVA ERRO
       *
       * Porque ele faz `target.pushVelocity.x += velocityX`, e o
       * `undefined += 1` e `NaN`, nao um erro. O `NaN` ficava guardado em
       * silencio ate o primeiro `if (pushVelocity.x !== 0)` — que e o que o
       * dash introduziu, e onde o tick inteiro morria
       *
       * ## E O MESMO CAMPO DO INIMIGO
       *
       * De proposito: o `updatePlayer` e o `updateEnemy` aplicam o
       * `pushVelocity` com o mesmo damping, e o motor tem um so jeito de
       * empurrar as duas coisas. Um campo separado aqui seria um segundo
       * caminho que o `enemiesPush` nao conheceria
       */
      pushVelocity: {
        x: 0,
        y: 0,
      },

    facing: {
      x: 1,
      y: 0,
    },

    aimDirection: {
      x: 1,
      y: 0,
    },

    moveDirection: {
      x: 0,
      y: 0,
    },

    hp: stats.hp,
    maxHp: stats.hp,

    resource: stats.resource,
    maxResource: stats.resource,

    shield: 0,

    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    attackSpeed: stats.attackSpeed,
    critRate: stats.critRate,
    critDamage: stats.critDamage,
    range: stats.range,

    controlResistance: 0,

    cooldowns: {},
    statusEffects: [],

isMoving: false,
      animationTime: 0,
      walkPhase: 0,
      walkBlend: 0,
      attackAnimation: 0,
      firingTargetId: null,
      hitFlash: 0,
      cast: null,

      /**
       * O JOGADOR ESTA SOCANDO A PEDRA.
       *
       * E um booleano, e nao um relogio, porque a animacao de minerar entra
       * em LOOP: o que segura o ciclo e a sessao de mineracao continuar
       * aberta, e nao um tempo que corra. Com um relogio aqui o arquiro
       * socaria uma vez e voltaria ao parado, que e o inverso do pedido
       *
       * Quem escreve e o motor, a partir do `mineracao.encostado` da sessao
       * — que e o unico lugar que sabe se a pedra ainda esta la. O `resolveAnimation`
       * so le o booleano
       */
      isMining: false,

      /**
       * O GOLPE EM LOOP: alvo focado, vivo e dentro do alcance.
       *
       * ## POR QUE ISTO EXISTE E O `attackAnimation` NAO DARIA
       *
       * O `attackAnimation` e um RELOGIO de 0,22s que o `SkillSystem` levanta
       * a cada ataque, e o ataque basico dispara de 0,71s a 1,18s atras. Sao
       * tempos que nao conversam: a pose durava 0,22s e o personagem passava
       * o resto do intervalo em walk ou idle. Era o "para e volta" que o
       * jogador via
       *
       * ## POR QUE NAO DA PARA DEIXAR O `attackAnimation` CORRER SOZINHO
       *
       * Porque ele e lido pelo `SkillSystem` para decidir QUANDO a flecha
       * sai (`restante = this.player.attackAnimation`). Trava-lo em loop
       * presa o tiro dentro da primeira animacao de 0,22s, e o arqueiro passa
       * a atirar sem parar, com o cooldown virando decoracao
       *
       * Por isso e um booleano SEPARADO: o `resolveAnimation` le este, e o
       * `SkillSystem` continua lendo o relogio. Nenhum dos dois muda o que o
       * outro faz
       *
       * ## E A MESMA FORMA DO `isMining`
       *
       * Booleano e nao relogio, pelo mesmo motivo: o que segura o ciclo e uma
       * CONDICAO que continua verdadeira — alvo focado e dentro do alcance —
       * e nao um tempo que corra. Quem escreve e o motor, no update
       */
      attackLoop: false,

    /**
     * A folha de stats, montada a partir do jogador RECEM-CRIADO.
     *
     * O `applyEquipment` do motor refaz isso a cada mudanca, com o
     * equipamento e as cacadas ja dentro. Este primeiro montagem e
     * para o jogador ter folha ANTES do primeiro tick: sem ela, um
     * painel aberto no primeiro quadro veria `null` e mostraria uma
     * lista vazia
     *
     * O `player` e passado de volta como `atuais` de proposito: a
     * folha mostra entao o MESMO ataque que o jogador tem neste
     * instante, e nao uma conta paralela. Online, onde o
     * `applyEquipment` ainda nao rodou, sao os dois o valor cru da
     * classe — e a folha concorda com o combate em vez de discordar
     * dele
     */
    stats: null,
  };

  jogador.stats = buildStatSheet(classDefinition, 1, {}, jogador);

  return jogador;
}
