import {
  getMainQuest,
  getSideQuest,
  isAutoCompletable,
  MAIN_QUESTS,
  meetsRarity,
  QUEST_SCOPE,
  QUEST_TYPE,
  SIDE_QUESTS,
} from "../../data/quests/index.js";

export class QuestLog {
  constructor() {
    this.mainIndex = 0;
    this.mainProgress = 0;
    this.mainDone = false;

    this.sideId = null;
    this.sideProgress = 0;
    this.sideCompleted = 0;

    this.autoEnabled = false;
    this.objectiveId = null;

    this.completedSide = new Set();
    this.pending = [];
  }

  get currentMain() {
    if (this.mainDone) return null;

    return getMainQuest(this.mainIndex) ?? null;
  }

  get currentSide() {
    if (!this.sideId) return null;

    return getSideQuest(this.sideId) ?? null;
  }

  get mainProgressValue() {
    return this.mainProgress;
  }

  progressOf(questId) {
    if (questId === this.currentSide?.id) {
      return this.sideProgress;
    }

    if (questId === this.currentMain?.id) {
      return this.mainProgress;
    }

    return 0;
  }

  get currentObjective() {
    const quest =
      getMainQuest(this.mainIndexOf(this.objectiveId)) ??
      getSideQuest(this.objectiveId);

    if (!quest) return null;

    return {
      ...quest,
      progress: this.progressOf(quest.id),
    };
  }

  mainIndexOf(questId) {
    return MAIN_QUESTS.findIndex(
      (quest) => quest.id === questId,
    );
  }

  objective() {
    if (!this.autoEnabled) return null;

    const quest = this.currentObjective;

    if (!quest) return null;

    if (!isAutoCompletable(quest)) return null;

    return quest;
  }

  setAuto(enabled) {
    this.autoEnabled = Boolean(enabled);

    if (this.autoEnabled) {
      this.objectiveId ??= this.currentMain?.id;
    }

    return this.autoEnabled;
  }

  toggleAuto() {
    return this.setAuto(!this.autoEnabled);
  }

  focusQuest(questId) {
    const quest =
      getMainQuest(this.mainIndexOf(questId)) ??
      getSideQuest(questId);

    if (!quest) return false;

    this.objectiveId = questId;

    return true;
  }

  clearObjective() {
    this.objectiveId = null;
  }

  acceptsSide(questId) {
    if (this.sideId) return false;

    return Boolean(getSideQuest(questId));
  }

  acceptSide(questId) {
    if (!this.acceptsSide(questId)) return false;

    this.sideId = questId;
    this.sideProgress = 0;

    return true;
  }

  abandonSide() {
    if (!this.sideId) return false;

    this.sideId = null;
    this.sideProgress = 0;

    return true;
  }

  complete(reward, scope) {
    this.pending.push({ reward, scope });

    return reward;
  }

  focusNextMain() {
    if (this.mainDone) return false;

    const next = this.currentMain;

    if (!next) return false;

    this.objectiveId = next.id;

    return true;
  }

  advanceMain() {
    const quest = this.currentMain;

    if (!quest) return false;

    if (this.mainProgress < quest.count) {
      return false;
    }

    this.complete(quest.rewards, QUEST_SCOPE.MAIN);
    this.mainProgress = 0;
    this.mainIndex += 1;

    if (this.mainIndex >= MAIN_QUESTS.length) {
      this.mainDone = true;

      if (this.objectiveId === quest.id) {
        this.clearObjective();
      }

      if (this.autoEnabled) {
        this.setAuto(false);
      }

      return true;
    }

    if (this.autoEnabled) {
      this.focusNextMain();
    }

    return true;
  }

  advanceSide() {
    const quest = this.currentSide;

    if (!quest) return false;

    if (this.sideProgress < quest.count) {
      return false;
    }

    this.complete(quest.rewards, QUEST_SCOPE.SIDE);

    this.completedSide.add(quest.id);
    this.sideCompleted += 1;
    this.sideId = null;
    this.sideProgress = 0;

    return true;
  }

  onKill(typeId, amount = 1) {
    if (amount <= 0) return [];

    const quests = [];

    for (const quest of [
      this.currentMain,
      this.currentSide,
    ]) {
      if (!quest) continue;

      if (
        quest.type !== QUEST_TYPE.HUNT &&
        quest.type !== QUEST_TYPE.KILL
      ) {
        continue;
      }

      if (quest.target !== typeId) continue;

      const isSide = quest.id === this.sideId;

      if (isSide) {
        this.sideProgress = Math.min(
          quest.count,
          this.sideProgress + amount,
        );

        if (this.advanceSide()) {
          quests.push(quest);
        }

        continue;
      }

      this.mainProgress = Math.min(
        quest.count,
        this.mainProgress + amount,
      );

      if (this.advanceMain()) {
        quests.push(quest);
      }
    }

    return quests;
  }

  onEquipRarity(rarity) {
    const main = this.currentMain;

    if (
      !main ||
      main.type !== QUEST_TYPE.EQUIP ||
      !meetsRarity(rarity, main.rarity)
    ) {
      return [];
    }

    this.mainProgress = 1;

    if (this.advanceMain()) {
      return [main];
    }

    return [];
  }

  onLevelUp(level) {
    const main = this.currentMain;

    if (!main || main.type !== QUEST_TYPE.LEVEL) {
      return [];
    }

    if (level < main.count) return [];

    this.mainProgress = main.count;

    if (this.advanceMain()) {
      return [main];
    }

    return [];
  }

  drainRewards() {
    if (this.pending.length === 0) return [];

    const rewards = this.pending;

    this.pending = [];

    return rewards;
  }

  isSideDone(questId) {
    return this.completedSide.has(questId);
  }

  snapshot() {
    const main = this.currentMain;
    const side = this.currentSide;
    const objective = this.currentObjective;

    return {
      auto: {
        enabled: this.autoEnabled,
        objectiveId: this.objectiveId,
        quest: objective
          ? {
              id: objective.id,
              name: objective.name,
              type: objective.type,
              summary: objective.summary,
              count: objective.count,
              progress: objective.progress,
              target: objective.target ?? null,
              location: objective.location ?? null,
              autoCompletable:
                isAutoCompletable(objective),
            }
          : null,
      },

      main: {
        index: this.mainIndex,
        total: MAIN_QUESTS.length,
        done: this.mainDone,
        current: main
          ? {
              id: main.id,
              name: main.name,
              type: main.type,
              summary: main.summary,
              count: main.count,
              progress: this.mainProgress,
              target: main.target ?? null,
              location: main.location ?? null,
              rarity: main.rarity ?? null,
              autoCompletable: isAutoCompletable(main),
            }
          : null,
        steps: MAIN_QUESTS.map((quest, index) => ({
          id: quest.id,
          name: quest.name,
          summary: quest.summary,
          type: quest.type,
          count: quest.count,
          progress:
            index === this.mainIndex
              ? this.mainProgress
              : 0,
          state:
            index < this.mainIndex
              ? "done"
              : index === this.mainIndex
                ? "active"
                : "locked",
        })),
      },

      side: {
        activeId: this.sideId,
        completed: this.sideCompleted,
        current: side
          ? {
              id: side.id,
              name: side.name,
              summary: side.summary,
              count: side.count,
              progress: this.sideProgress,
              target: side.target,
              location: side.location ?? null,
            }
          : null,
        available: SIDE_QUESTS.map((quest) => ({
          id: quest.id,
          name: quest.name,
          summary: quest.summary,
          count: quest.count,
          target: quest.target,
          location: quest.location ?? null,
          done: this.isSideDone(quest.id),
          active: this.sideId === quest.id,
        })),
      },
    };
  }
}
