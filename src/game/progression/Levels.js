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

/**
 * TIRA XP. E o espelho do `grantXp`, e existe por causa dele.
 *
 * O `grantXp` e um `while` que sobe de nivel; nao dava para tira-lo de
 * la, entao a perda mora aqui do lado. E o unico lugar do projeto que
 * DIMINUI `player.xp`
 *
 * ## POR QUE A PERDA NAO DESCE DE NIVEL
 *
 * A perda e um valor fixo, e nao uma fracao do XP total. Se ela
 * tirasse o necessario para descer um nivel, o jogador perderia ate
 * `levelRequirement(level - 1)` de uma vez — no nivel 1, sao 550 XP
 * ganhos em dias de caca. Isso e a mesma punicao de voltar tres
 * misses, e nao e o que "perder 10% do XP" quer dizer
 *
 * ## O QUE VOLTA A CIMA
 *
 * Devolve QUANTO tirou, arredondado para baixo. O painel mostra esse
 * numero no aviso, e o jogador precisa ver o mesmo numero que o
 * servidor tirou
 *
 * `player.xp` nunca fica negativo: no `grantXp` ele e acumulado e
 * subtraido pelo nivel, e um XP negativo faria a barra do HUD passar
 * do lado esquerdo do zero
 */
export function loseXp(player, amount) {
  const total = Math.floor(player.xp ?? 0);

  if (total <= 0) return 0;

  const perdido = Math.min(total, Math.max(0, Math.floor(amount)));

  if (perdido <= 0) return 0;

  player.xp = total - perdido;

  return perdido;
}

/**
 * QUANTO de XP custa voltar para a base.
 *
 * E uma funcao e nao um `Math.floor` no meio do servidor porque o painel
 * mostra o numero ANTES do clique: o jogador precisa saber o preco que
 * vai pagar para escolher entre as duas saidas
 */
export function xpPerdidoNaMorte(player) {
  const { xpPerdido } = BALANCE.morte;

  return Math.floor((player?.xp ?? 0) * xpPerdido);
}
