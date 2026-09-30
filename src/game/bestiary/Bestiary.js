import {
  BESTIARY,
  describeBonus,
  getBestiaryEntry,
  TOTAL_HUNTS,
} from "../../data/bestiary/index.js";

/**
 * Registro de cacadas do bestiario.
 * O progresso e por criatura, e as cacadas de uma mesma criatura
 * andam em sequencia: a 2 so conta depois da 1 fechar.
 * Os bonus sao permanentes e somam no mesmo pipeline do equipamento.
 */
export class Bestiary {
  constructor() {
    this.kills = new Map();
    this.completed = new Set();
  }

  progressOf(huntId) {
    const hunt = this.findHunt(huntId);

    if (!hunt) return 0;

    return this.kills.get(hunt.creatureId) ?? 0;
  }

  isDone(huntId) {
    return this.completed.has(huntId);
  }

  /** a cacada que o jogador esta mirando agora, para o HUD mostrar */
  get activeHunts() {
    const active = [];

    for (const entry of BESTIARY) {
      const hunt = entry.hunts.find(
        (candidate) => !this.isDone(candidate.id),
      );

      if (!hunt) continue;

      active.push({
        hunt,
        entry,
        progress: this.kills.get(entry.id) ?? 0,
      });
    }

    return active;
  }

  findHunt(huntId) {
    for (const entry of BESTIARY) {
      const hunt = entry.hunts.find(
        (candidate) => candidate.id === huntId,
      );

      if (hunt) return hunt;
    }

    return null;
  }

  entryOf(creatureId) {
    return getBestiaryEntry(creatureId);
  }

  /**
   * conta uma abate e devolve as cacadas que fecharam agora.
   * o contador e cumulativo por criatura, entao as tres cacadas
   * leem o mesmo numero: 5, 15 e 40 abates.
   */
  onKill(creatureId, amount = 1) {
    if (amount <= 0) return [];

    const entry = this.entryOf(creatureId);

    if (!entry) return [];

    const next =
      (this.kills.get(creatureId) ?? 0) + amount;

    this.kills.set(creatureId, next);

    const finished = [];

    for (const hunt of entry.hunts) {
      if (this.isDone(hunt.id)) continue;
      if (next < hunt.count) break; // cacadas andam em ordem

      this.completed.add(hunt.id);
      finished.push(hunt);
    }

    return finished;
  }

  get completedCount() {
    return this.completed.size;
  }

  get totalCount() {
    return TOTAL_HUNTS;
  }

  get isComplete() {
    return this.completed.size >= TOTAL_HUNTS;
  }

  /** soma de tudo que ja virou bonus permanente */
  bonuses() {
    const total = {};

    for (const entry of BESTIARY) {
      for (const hunt of entry.hunts) {
        if (!this.isDone(hunt.id)) continue;

        for (const [stat, value] of Object.entries(
          hunt.reward,
        )) {
          total[stat] = (total[stat] ?? 0) + value;
        }
      }
    }

    return total;
  }

  describeTotal() {
    return describeBonus(this.bonuses());
  }

  snapshot() {
    const entries = BESTIARY.map((entry) => {
      const progress = this.kills.get(entry.id) ?? 0;

      return {
        id: entry.id,
        creatureId: entry.creatureId,
        name: entry.name,
        icon: entry.icon,
        level: entry.level,
        color: entry.color,
        behavior: entry.behavior,
        zoneId: entry.zoneId,
        zoneName: entry.zoneName,

        kills: progress,

        hunts: entry.hunts.map((hunt) => ({
          id: hunt.id,
          tier: hunt.tier,
          title: hunt.title,
          summary: hunt.summary,
          count: hunt.count,
          reward: hunt.reward,
          rewardLabel: describeBonus(hunt.reward),
          done: this.isDone(hunt.id),
          progress: Math.min(progress, hunt.count),
        })),

        done: entry.hunts.every((hunt) => this.isDone(hunt.id)),
      };
    });

    return {
      entries,
      kills: Object.fromEntries(this.kills),
      completed: this.completedCount,
      total: this.totalCount,
      isComplete: this.isComplete,
      bonuses: this.bonuses(),
      bonusesLabel: this.describeTotal(),
    };
  }
}
