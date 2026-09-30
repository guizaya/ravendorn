import { RARITY } from "../data/items/index.js";

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

  /**
   * multiplicador global sobre a chance authored de cada criatura.
   * 0.1 Leaving itens comuns praticamente impossiveis; 0.5 mantem
   * o grind pesado sem esconder o loot basico.
   */
  dropChance: 0.5,

  maxItemsPerKill: 2,

  /**
   * peso extra por raridade na hora de escolher o item da tabela.
   * o comum virou o grosso do loot, o lendario continua rarissimo.
   */
  rarityDropWeight: {
    [RARITY.COMMON]: 3,
    [RARITY.UNCOMMON]: 1.6,
    [RARITY.RARE]: 0.7,
    [RARITY.EPIC]: 0.25,
    [RARITY.LEGENDARY]: 0.08,
  },

  /** itens de missao caem bem mais vezes que a media da tabela */
  questItemBonus: 2.2,

  /** materiais empilhavel vem em pilhas de 1..N em vez de unidade */
  stackableDropMax: 3,
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
    itemChance: Math.min(
      loot.itemChance * BALANCE.dropChance,
      1,
    ),
    maxItems: Math.min(
      loot.maxItems ?? 1,
      BALANCE.maxItemsPerKill,
    ),
  };
}