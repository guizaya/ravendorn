import {
  getMainQuest,
  getSideQuest,
  isAutoCompletable,
  MAIN_QUESTS,
  meetsRarity,
  normalizeRewards,
  QUEST_SCOPE,
  QUEST_TYPE,
  SIDE_QUESTS,
} from "../../data/quests/index.js";

export class QuestLog {
  constructor() {
    this.mainIndex = 0;
    this.mainProgress = 0;
    this.mainDone = false;

    /**
     * O nivel do jogador, para as missoes de nivel.
     *
     * A missao "Alcance o nivel 5" se compara com ISTE numero, e
     * nao com uma contagem de quantas vezes o jogador subiu de
     * nivel. A diferencia aparece quando ele chega no nivel antes da
     * missao virar a atual
     */
    this.playerLevel = 1;

    this.sideId = null;
    this.sideProgress = 0;
    this.sideCompleted = 0;

    this.autoEnabled = false;
    this.objectiveId = null;

    this.completedSide = new Set();

    /**
     * As recompensas CONCLUIDAS E NAO RESGATADAS.
     *
     * Cada entrada e `{ questId, reward, scope }`, e o `questId` e o
     * que torna o resgate unico: e por ele que o botao [RECEBER]
     * encontra a recompensa, e e por ele que o segundo clique nao
     * paga de novo. Uma missao so entra aqui uma vez, entao a lista
     * nunca tem duas linhas do mesmo `questId`
     */
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

  /**
   * A missao terminou: a recompensa entra na fila de resgate.
   *
   * Ela NAO e paga aqui. O painel mostra [RECEBER] e o pagamento
   * acontece quando o jogador clica, o que muda duas coisas: ele ve
   * o que ganhou antes de receber, e o resgate pode ser conferido
   * contra o que a missao de fato promete
   *
   * O `questId` e obrigatorio de proposito. Sem ele nao haveria como
   * ligar um botao a uma recompensa, e o resgate voltaria a ser
   * "paga tudo que estiver na fila", que e exatamente o que o segundo
   * clique precisa NAO fazer
   */
  complete(reward, scope, questId) {
    if (!questId) return null;

    const entrada = {
      questId,
      scope: scope ?? QUEST_SCOPE.MAIN,
      reward: normalizeRewards(reward),
    };

    const indice = this.pending.findIndex(
      (item) => item.questId === questId,
    );

    // a mesma missao nunca entra duas vezes. Trocar no lugar em vez
    // de empilhar mantem o resgate unico mesmo se um `complete`
    // escapingasse por algum caminho
    if (indice >= 0) {
      this.pending[indice] = entrada;
    } else {
      this.pending.push(entrada);
    }

    return entrada;
  }

  /** Esta missao tem recompensa esperando o clique em [RECEBER]? */
  isClaimable(questId) {
    return this.pending.some((item) => item.questId === questId);
  }

  /**
   * Tira a recompensa da fila e devolve.
   *
   * E o UNICO caminho que paga. `splice` remove a linha do mesmo
   * passo que a devolve, entao o segundo clique do mesmo botao nao
   * encontra mais o que pagar e devolve `null`. E por isso que a
   * protecao contra clique duplo nao precisa de memoria do painel:
   * ela esta no lugar onde o dinheiro sai
   */
  claim(questId) {
    const indice = this.pending.findIndex(
      (item) => item.questId === questId,
    );

    if (indice < 0) return null;

    const [entrada] = this.pending.splice(indice, 1);

    return entrada;
  }

  /** Quantas missoes tem recompensa nao resgatada. */
  get claimableCount() {
    return this.pending.length;
  }

  /** A linha da fila de um `questId`, ou `null`. */
  pendingOf(questId) {
    return (
      this.pending.find((item) => item.questId === questId) ??
      null
    );
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

    this.complete(
      quest.rewards,
      QUEST_SCOPE.MAIN,
      quest.id,
    );
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

    this.complete(
      quest.rewards,
      QUEST_SCOPE.SIDE,
      quest.id,
    );

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

  /**
   * Confere a missao de NÍVEL contra o nivel ATUAL do jogador.
   *
   * A missao "Alcance o nivel 5" era contada por EVENTO: so
   * `onLevelUp` a completava. Quem chegou no nivel 5 antes de a
   * missao virar a atual ficava preso nela: o objetivo ja estava
   * cumprido, o painel mostrava 0 de 5, e nada mais disparava. No
   * pior caso e Permanente: se a missao e "Alcance o nivel 10" e o
   * jogador ja esta no maximo, nenhum level-up acontece nunca mais.
   *
   * Aqui o nivel e lido do personagem, entao a missao compara com o
   * que ele TEM, e nao com o que ele deixou de acontecer. O laco
   * importa: quem farmou ate o nivel 12 de uma vez cumpre
   * `nivel_5` e `nivel_10` de uma vez, em vez de ficar preso na
   * primeira ate o proximo level-up.
   *
   * Devolve as missoes concluidas, para o aviso e a recompensa sairem
   * pelo mesmo caminho de sempre.
   */
  syncLevel(level) {
    this.playerLevel = Math.max(1, Math.floor(level ?? 1));

    const concluidas = [];

    // few missoes de nivel no total, entao o laco termina rapido.
    // O `mainDone` e o guarda: sem ele, um `currentMain` nulo
    // entraria aqui e o laco sairia pela lista, nao pela condicao
    for (let passo = 0; passo < MAIN_QUESTS.length; passo += 1) {
      const main = this.currentMain;

      if (!main || main.type !== QUEST_TYPE.LEVEL) break;

      if (this.playerLevel < main.count) break;

      this.mainProgress = main.count;
      this.advanceMain();
      concluidas.push(main);
    }

    return concluidas;
  }

  /** so o nivel que a sessao conhece; usado para o painel */
  get levelConhecido() {
    return this.playerLevel;
  }

  onLevelUp(level) {
    return this.syncLevel(level);
  }

  /**
   * A fila de resgate, do jeito que o painel desenha.
   *
   * Cada linha traz o NOME e o RESUMO junto da recompensa. O painel
   * precisa dos dois para montar o card [RECEBER], e ele nao pode
   * procurar a missao no catalogo: a do jogador pode ser a principal
   * ou a secundaria, e as duas tem nomes diferentes
   */
  claimableSnapshot() {
    return this.pending.map((entrada) => {
      const quest =
        getMainQuest(this.mainIndexOf(entrada.questId)) ??
        getSideQuest(entrada.questId);

      return {
        id: entrada.questId,
        scope: entrada.scope,
        name: quest?.name ?? entrada.questId,
        summary: quest?.summary ?? "",
        rewards: entrada.reward,
      };
    });
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

      /**
       * As recompensas esperando o clique em [RECEBER].
       *
       * A lista e do JOGADOR, nao do catalogo: e o que ele ganhou e
       * ainda nao recebeu. Uma missao ja resgatada nao aparece aqui,
       * e por isso que o segundo clique encontra uma lista vazia em
       * vez de pagar de novo
       */
      claimable: this.claimableSnapshot(),

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
              rewards: normalizeRewards(main.rewards),
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
          /**
           * `claimable` e um estado do PASSO, e nao da missao: o
           * passo ja foi concluido e a recompensa ainda esta na
           * fila. Sem este campo o painel mostraria o passo como
           * `done`, e o botao [RECEBER] nao teria onde aparecer
           */
          claimable: this.isClaimable(quest.id),
          rewards: normalizeRewards(quest.rewards),
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
              rewards: normalizeRewards(side.rewards),
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
          claimable: this.isClaimable(quest.id),
          rewards: normalizeRewards(quest.rewards),
        })),
      },
    };
  }
}
