export function createPlayer(classDefinition, spawn) {
  const stats = classDefinition.stats;

  return {
    id: `player_${classDefinition.id}`,
    name: classDefinition.name,
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
    attackAnimation: 0,
    hitFlash: 0,
    cast: null,
  };
}
