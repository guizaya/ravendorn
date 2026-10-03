import { describe, expect, it } from "vitest";
import { QuestLog } from "./QuestLog.js";
import {
  ALL_QUESTS,
  isAutoCompletable,
  MAIN_QUESTS,
  QUEST_SCOPE,
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
    expect(log.isClaimable(first.id)).toBe(true);
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
  it("waits for the claim instead of paying on completion", () => {
    const log = new QuestLog();
    const quest = log.currentMain;

    kill(log, quest.target, quest.count);

    // a fila tem a recompensa, mas ela nao saiu: quem paga e o
    // `claim`, chamado pelo botao [RECEBER]
    expect(log.claimableCount).toBe(1);
    expect(log.isClaimable(quest.id)).toBe(true);
    expect(log.pendingOf(quest.id).reward.coins).toBe(
      quest.rewards.coins,
    );
  });

  it("claims the reward once", () => {
    const log = new QuestLog();
    const quest = log.currentMain;

    kill(log, quest.target, quest.count);

    const entrada = log.claim(quest.id);

    expect(entrada.questId).toBe(quest.id);
    expect(entrada.reward.coins).toBe(quest.rewards.coins);
    expect(entrada.reward.xp).toBe(quest.rewards.xp);
    expect(entrada.reward.items).toEqual(
      quest.rewards.items,
    );

    expect(log.claimableCount).toBe(0);
    expect(log.isClaimable(quest.id)).toBe(false);
  });

  it("the second claim pays nothing", () => {
    // e o clique duplo do botao [RECEBER]. A fila perde a linha no
    // primeiro resgate, entao o segundo nao acha o que pagar
    const log = new QuestLog();
    const quest = log.currentMain;

    kill(log, quest.target, quest.count);

    expect(log.claim(quest.id)).not.toBe(null);
    expect(log.claim(quest.id)).toBe(null);
    expect(log.claim(quest.id)).toBe(null);
  });

  it("claims a side quest by its own id", () => {
    const log = new QuestLog();
    const quest = SIDE_QUESTS[0];

    log.acceptSide(quest.id);
    kill(log, quest.target, quest.count);

    // as duas cacam limo, entao a principal tambem fecha junto. O
    // que importa aqui e que a SECUNDARIA tem a linha dela, com o
    // `scope` dela: as duas nao podem se confundir no resgate
    expect(log.isClaimable(quest.id)).toBe(true);
    expect(
      log.pendingOf(quest.id).scope,
    ).toBe(QUEST_SCOPE.SIDE);

    const entrada = log.claim(quest.id);

    expect(entrada.scope).toBe(QUEST_SCOPE.SIDE);
    expect(entrada.reward.items).toEqual(
      quest.rewards.items,
    );
    expect(log.isClaimable(quest.id)).toBe(false);
  });

  it("claims nothing for a quest that is not waiting", () => {
    const log = new QuestLog();

    expect(log.claim("side_brejo")).toBe(null);
    expect(log.claim("missao_que_nao_existe")).toBe(null);
  });

  it("keeps the queue with one line per quest", () => {
    // a mesma missao entrando duas vezes nao pode criar duas linhas
    // resgataveis: o resgate e por `questId`, e duas linhas fariam o
    // painel oferecer [RECEBER] duas vezes para a mesma missao
    const log = new QuestLog();
    const quest = log.currentMain;

    log.complete(quest.rewards, QUEST_SCOPE.MAIN, quest.id);
    log.complete(quest.rewards, QUEST_SCOPE.MAIN, quest.id);

    expect(log.claimableCount).toBe(1);
  });

  it("reports the claimable list in the snapshot", () => {
    const log = new QuestLog();
    const quest = log.currentMain;

    kill(log, quest.target, quest.count);

    const snapshot = log.snapshot();

    expect(snapshot.claimable).toHaveLength(1);
    expect(snapshot.claimable[0]).toMatchObject({
      id: quest.id,
      scope: QUEST_SCOPE.MAIN,
      name: quest.name,
    });
    expect(
      snapshot.claimable[0].rewards.coins,
    ).toBe(quest.rewards.coins);

    // o passo da campanha entra como resgatavel, e nao como um
    // `done` sem botao: e nele que o [RECEBER] aparece
    expect(snapshot.main.steps[0].state).toBe("done");
    expect(snapshot.main.steps[0].claimable).toBe(true);

    // depois do resgate a lista esvazia e o passo segue `done`, sem
    // botao
    log.claim(quest.id);

    const depois = log.snapshot();

    expect(depois.claimable).toHaveLength(0);
    expect(depois.main.steps[0].claimable).toBe(false);
    expect(depois.main.steps[0].state).toBe("done");
  });

  it("carries the rewards of every quest in the snapshot", () => {
    const log = new QuestLog();
    const snapshot = log.snapshot();

    // o painel desenha a coluna de recompensa a partir daqui. Uma
    // missao sem `rewards` no snapshot apareceria sem moeda, sem xp e
    // sem item, que e o jeito de o [RECEBER] parecer nao valer nada
    for (const step of snapshot.main.steps) {
      expect(step.rewards, step.id).toBeTruthy();
      expect(
        step.rewards.coins,
        step.id,
      ).toBeGreaterThan(0);
    }

    for (const quest of snapshot.side.available) {
      expect(quest.rewards, quest.id).toBeTruthy();
      expect(
        quest.rewards.coins,
        quest.id,
      ).toBeGreaterThan(0);
    }
  });

  it("every quest in the catalog pays something", () => {
    // a coluna de recompensa nao pode ficar vazia em nenhum cartao
    for (const quest of ALL_QUESTS) {
      const { coins, xp, items } = quest.rewards;

      expect(
        coins > 0 || xp > 0 || items.length > 0,
        quest.id,
      ).toBe(true);
    }
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
