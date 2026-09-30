export const BALANCE = {
  difficulty: "hard",

  levelCurve: {
    base: 550,
    exponent: 1.7,
  },

  xpShare: {
    creature: 0.6,
    dummy: 0.25,
  },

  dropChance: 0.1,

  maxItemsPerKill: 1,
};

export function levelRequirement(level) {
  const { base, exponent } = BALANCE.levelCurve;

  return Math.round(base * Math.pow(level, exponent));
}

export function totalXpForLevel(targetLevel) {
  let total = 0;

  for (let level = 1; level < targetLevel; level += 1) {
    total += levelRequirement(level);
  }

  return total;
}

export function applyDropScaling(loot) {
  return {
    ...loot,
    itemChance: loot.itemChance * BALANCE.dropChance,
    maxItems: Math.min(
      loot.maxItems ?? 1,
      BALANCE.maxItemsPerKill,
    ),
  };
}
