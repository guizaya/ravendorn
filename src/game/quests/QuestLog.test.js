import { describe, expect, it } from "vitest";
import { QuestLog } from "./QuestLog.js";
import {
  isAutoCompletable,
  MAIN_QUESTS,
  QUEST_TYPE,
  SIDE_QUESTS,
  meetsRarity,
} from "../../data/quests/index.js";

function kill(log, typeId, amount = 1) {
  return log.onKill(typeId, amount);
}

function advanceTo(log, predicate) {
  let guard = 0;

  while (!predicate(log.currentMain) && guard < 20) {
    guard += 1;

    const quest = log.currentMain;

    if (isAutoCompletable(quest)) {
      kill(log, quest.target, quest.count);
    } else if (quest.type === QUEST_TYPE.EQUIP) {
      log.onEquipRarity(quest.rarity);
    } else {
      log.onLevelUp(quest.count);
    }
  }
}

describe("main chain", () => {
  it("starts on the first quest", () => {
    const log = new QuestLog();

    expect(log.currentMain.id).toBe(MAIN_QUESTS[0].id);
    expect(log.mainProgress).toBe(0);
  });

  it("only counts the targeted creature", () => {
    const log = new QuestLog();

    kill(log, "rat", 5);

    expect(log.mainProgress).toBe(0);
  });

  it("completes and advances on kill quests", () => {
    const log = new QuestLog();
    const first = MAIN_QUESTS[0];

    const done = kill(log, first.target, first.count);

    expect(done).toHaveLength(1);
    expect(log.mainIndex).toBe(1);
    expect(log.currentMain.id).toBe(MAIN_QUESTS[1].id);
    expect(log.drainRewards()).toHaveLength(1);
  });

  it("never exceeds the quest count", () => {
    const log = new QuestLog();
    const first = MAIN_QUESTS[0];

    kill(log, first.target, first.count * 3);

    expect(log.mainProgress).toBe(0);
    expect(log.mainIndex).toBe(1);
  });

  it("completes equip quests by rarity", () => {
    const log = new QuestLog();

    advanceTo(log, (quest) => quest.type === QUEST_TYPE.EQUIP);

    const quest = log.currentMain;

    expect(log.onEquipRarity("common")).toHaveLength(0);
    expect(log.onEquipRarity("uncommon")).toHaveLength(0);

    const done = log.onEquipRarity(quest.rarity);

    expect(done).toHaveLength(1);
    expect(log.mainIndex).toBe(
      MAIN_QUESTS.findIndex((entry) => entry.id === quest.id) +
        1,
    );
  });

  it("accepts a stronger rarity than required", () => {
    expect(meetsRarity("epic", "rare")).toBe(true);
    expect(meetsRarity("rare", "epic")).toBe(false);
    expect(meetsRarity("rare", "rare")).toBe(true);
    expect(meetsRarity("common", "rare")).toBe(false);
    expect(meetsRarity("invalida", "rare")).toBe(false);
  });

  it("completes level quests", () => {
    const log = new QuestLog();

    advanceTo(log, (quest) => quest.type === QUEST_TYPE.LEVEL);

    const quest = log.currentMain;

    expect(quest.type).toBe(QUEST_TYPE.LEVEL);
    expect(log.onLevelUp(quest.count - 1)).toHaveLength(0);

    const done = log.onLevelUp(quest.count);

    expect(done).toHaveLength(1);
    expect(log.mainIndex).toBe(
      MAIN_QUESTS.findIndex((entry) => entry.id === quest.id) +
        1,
    );
  });

  it("finishes the whole chain", () => {
    const log = new QuestLog();

    for (const quest of MAIN_QUESTS) {
      if (isAutoCompletable(quest)) {
        kill(log, quest.target, quest.count);
        continue;
      }

      if (quest.type === QUEST_TYPE.EQUIP) {
        log.onEquipRarity(quest.rarity);
        continue;
      }

      log.onLevelUp(quest.count);
    }

    expect(log.mainDone).toBe(true);
    expect(log.currentMain).toBe(null);
    expect(
      log.snapshot().main.steps.every(
        (step) => step.state === "done",
      ),
    ).toBe(true);
  });
});

describe("side quests", () => {
  it("starts with none active", () => {
    const log = new QuestLog();

    expect(log.currentSide).toBe(null);
    expect(log.acceptsSide(SIDE_QUESTS[0].id)).toBe(true);
  });

  it("ignores kills that match no quest", () => {
    const log = new QuestLog();

    // main_brejo é caça a limos, então ratos não contam
    expect(kill(log, "rat", 3)).toHaveLength(0);
    expect(log.sideProgress).toBe(0);
    expect(log.currentSide).toBe(null);
    expect(log.mainProgress).toBe(0);
  });

  it("accepts one quest at a time", () => {
    const log = new QuestLog();

    expect(log.acceptSide(SIDE_QUESTS[0].id)).toBe(true);

    expect(log.acceptsSide(SIDE_QUESTS[1].id)).toBe(false);
    expect(log.acceptSide(SIDE_QUESTS[1].id)).toBe(false);
    expect(log.currentSide.id).toBe(SIDE_QUESTS[0].id);
  });

  it("is exclusive until completed or abandoned", () => {
    const log = new QuestLog();
    const quest = SIDE_QUESTS[0];

    log.acceptSide(quest.id);
    kill(log, quest.target, quest.count - 1);

    expect(log.acceptSide(SIDE_QUESTS[1].id)).toBe(false);

    const done = kill(log, quest.target, 1);

    expect(done).toHaveLength(1);
    expect(log.currentSide).toBe(null);
    expect(log.acceptSide(SIDE_QUESTS[1].id)).toBe(true);
  });

  it("frees the slot when abandoned", () => {
    const log = new QuestLog();

    log.acceptSide(SIDE_QUESTS[0].id);

    expect(log.abandonSide()).toBe(true);
    expect(log.currentSide).toBe(null);
    expect(log.acceptSide(SIDE_QUESTS[1].id)).toBe(true);
  });

  it("only accepts kill or hunt quests", () => {
    for (const quest of SIDE_QUESTS) {
      expect(
        isAutoCompletable(quest),
        quest.id,
      ).toBe(true);

      expect(quest.target, quest.id).toBeTruthy();
      expect(quest.location, quest.id).toBeTruthy();
      expect(quest.count, quest.id).toBeGreaterThan(0);
    }
  });

  it("counts completions across quests", () => {
    const log = new QuestLog();

    log.acceptSide(SIDE_QUESTS[0].id);
    kill(log, SIDE_QUESTS[0].target, SIDE_QUESTS[0].count);

    log.acceptSide(SIDE_QUESTS[1].id);
    kill(log, SIDE_QUESTS[1].target, SIDE_QUESTS[1].count);

    expect(log.sideCompleted).toBe(2);
    expect(log.isSideDone(SIDE_QUESTS[0].id)).toBe(true);
  });

  it("rejects unknown side quests", () => {
    const log = new QuestLog();

    expect(log.acceptSide("side_fantasma")).toBe(false);
  });
});

describe("rewards", () => {
  it("queues rewards and drains them once", () => {
    const log = new QuestLog();
    const quest = log.currentMain;

    kill(log, quest.target, quest.count);

    const rewards = log.drainRewards();

    expect(rewards).toHaveLength(1);
    expect(rewards[0].reward.coins).toBe(
      quest.rewards.coins,
    );
    expect(log.drainRewards()).toHaveLength(0);
  });
});

describe("auto objective", () => {
  it("focuses a quest from the tracker", () => {
    const log = new QuestLog();
    const quest = log.currentMain;

    expect(log.focusQuest(quest.id)).toBe(true);
    expect(log.objectiveId).toBe(quest.id);
  });

  it("rejects unknown quests", () => {
    expect(
      new QuestLog().focusQuest("quest_fantasma"),
    ).toBe(false);
  });

  it("returns no objective while auto is off", () => {
    const log = new QuestLog();

    log.focusQuest(log.currentMain.id);

    expect(log.objective()).toBe(null);
  });

  it("exposes the objective when auto is on", () => {
    const log = new QuestLog();
    const quest = log.currentMain;

    log.setAuto(true);

    expect(log.objectiveId).toBe(quest.id);
    expect(log.objective().id).toBe(quest.id);
    expect(log.objective().type).toBe(quest.type);
  });

  it("refuses auto for equip and level quests", () => {
    const log = new QuestLog();

    advanceTo(log, (quest) => quest.type === QUEST_TYPE.EQUIP);

    log.setAuto(true);

    expect(log.objective()).toBe(null);

    advanceTo(log, (quest) => quest.type === QUEST_TYPE.LEVEL);

    log.setAuto(true);

    expect(log.objective()).toBe(null);
  });

  it("toggles auto", () => {
    const log = new QuestLog();

    expect(log.autoEnabled).toBe(false);
    expect(log.toggleAuto()).toBe(true);
    expect(log.autoEnabled).toBe(true);
    expect(log.toggleAuto()).toBe(false);
  });

  it("chains to the next quest when auto is on", () => {
    const log = new QuestLog();
    const first = log.currentMain;

    log.setAuto(true);

    kill(log, first.target, first.count);

    expect(log.objectiveId).toBe(log.currentMain.id);
    expect(log.objectiveId).not.toBe(first.id);
  });

  it("keeps the objective when auto is off", () => {
    const log = new QuestLog();
    const first = log.currentMain;

    log.focusQuest(first.id);

    kill(log, first.target, first.count);

    expect(log.objectiveId).toBe(first.id);
  });

  it("clears auto when the chain ends", () => {
    const log = new QuestLog();

    log.setAuto(true);

    for (const quest of MAIN_QUESTS) {
      if (isAutoCompletable(quest)) {
        kill(log, quest.target, quest.count);
      } else if (quest.type === QUEST_TYPE.EQUIP) {
        log.onEquipRarity(quest.rarity);
      } else {
        log.onLevelUp(quest.count);
      }
    }

    expect(log.mainDone).toBe(true);
    expect(log.autoEnabled).toBe(false);
    expect(log.objectiveId).toBe(null);
  });

  it("reports auto state in the snapshot", () => {
    const log = new QuestLog();

    log.setAuto(true);

    const snapshot = log.snapshot();

    expect(snapshot.auto.enabled).toBe(true);
    expect(snapshot.auto.objectiveId).toBeTruthy();
    expect(snapshot.auto.quest).not.toBe(null);
    expect(
      snapshot.auto.quest.autoCompletable,
    ).toBe(true);
  });
});

describe("snapshot", () => {
  it("describes main and side state", () => {
    const log = new QuestLog();
    const quest = log.currentMain;

    kill(log, quest.target, 1);

    const snapshot = log.snapshot();

    expect(snapshot.main.total).toBe(
      MAIN_QUESTS.length,
    );
    expect(snapshot.main.current.progress).toBe(1);
    expect(snapshot.main.steps[0].state).toBe(
      "active",
    );
    expect(snapshot.main.steps[1].state).toBe(
      "locked",
    );
    expect(snapshot.side.available).toHaveLength(
      SIDE_QUESTS.length,
    );
    expect(snapshot.side.current).toBe(null);
  });

  it("marks a completed main step as done", () => {
    const log = new QuestLog();
    const quest = log.currentMain;

    kill(log, quest.target, quest.count);

    const snapshot = log.snapshot();

    expect(snapshot.main.steps[0].state).toBe("done");
  });
});
