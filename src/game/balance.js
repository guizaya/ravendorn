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

  /**
   * A MORTE tem duas saidas, e as duas cobram alguma coisa.
   *
   * A escolha do jogador e entre as duas, e nao ha uma de graca: um
   * revive sem custo nenhum tornaria o ouro inutil depois do primeiro
   * abate, e uma perda de XP sozinha puniria quem nao tem escolha
   */
  morte: {
    /**
     * REVIVER NA HORA.
     *
     * Sobe com o nivel, porque o ouro tambem sobe com o nivel: um
     * preco fixo seria barato demais no fim e caro demais no começo.
     * A formula e `base + porNivel * level`, o que da 60 no nivel 1 e
     * 460 no 40
     */
    reviveBase: 40,
    revivePorNivel: 10,

    /**
     * VOLTAR PARA A BASE.
     *
     * A perda e FRACA do XP do nivel, e nao do XP acumulado: `player.xp`
     * e sempre o XP do nivel corrente (o `grantXp` desconta o necessario
     * ao subir), entao 10% dele e 10% do progresso dentro do nivel
     *
     * Dez por cento e o classico do genre, e e o numero certo aqui
     * porque a curva e de 550 no nivel 1: perder 10% do nivel 1 sao 55 de
     * XP, quase um abate. No nivel 20 sao 2.700, quase dois. A perda
     * cresce junto com o que vale a pena perder
     */
    xpPerdido: 0.1,

    /**
     * O PRAZO PARA ESCOLHER.
     *
     * Vinte segundos, e o prazo e do MOTOR — nao do painel. Um cliente
     * modificado nao escolheria nunca, e ficaria com o veu na tela para
     * sempre contando como online
     *
     * E o prazo e generoso de proposito: a unica acao disponivel e
     * clicar em um botao, e clicar em um botao e a acao mais facil do
     * jogo. Um prazo curto faria o jogador perder a escolha por estar
     * lendo o preco
     */
    prazoSegundos: 20,
  },
};

/**
 * O PRECO de reviver para este nivel.
 *
 * Vive aqui e nao em um numero solto no painel, porque o SERVIDOR cobra
 * este valor e o painel mostra este valor: se fossem dois numeros, o
 * jogador veria um preco e pagaria outro
 */
export function reviveCost(level) {
  const { reviveBase, revivePorNivel } = BALANCE.morte;

  return Math.max(0, reviveBase + revivePorNivel * (level ?? 1));
}

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