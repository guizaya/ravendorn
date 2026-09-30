import {
  BALANCE,
  levelRequirement,
} from "../balance.js";

export const MAX_LEVEL = 40;

export function xpToNext(level) {
  if (level >= MAX_LEVEL) return Infinity;

  return levelRequirement(level);
}

export function xpForKill(enemy) {
  if (!enemy?.maxHp) return 0;

  const share = enemy.isCreature
    ? BALANCE.xpShare.creature
    : BALANCE.xpShare.dummy;

  return Math.max(
    1,
    Math.round(enemy.maxHp * share),
  );
}

export function statsForLevel(level) {
  return {
    maxHp: Math.round(level * 26),
    attack: Math.round(level * 3.2),
    defense: Math.round(level * 2.4),
  };
}

export function grantXp(player, amount) {
  if (amount <= 0) return [];

  const levels = [];

  player.xp = (player.xp ?? 0) + Math.floor(amount);

  let guard = 0;

  while (player.level < MAX_LEVEL && guard < 50) {
    guard += 1;

    const needed = xpToNext(player.level);

    if (!Number.isFinite(needed)) break;

    if (player.xp < needed) break;

    player.xp -= needed;
    player.level += 1;

    levels.push(player.level);
  }

  if (player.level >= MAX_LEVEL) {
    player.xp = 0;
  }

  return levels;
}
