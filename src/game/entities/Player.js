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
