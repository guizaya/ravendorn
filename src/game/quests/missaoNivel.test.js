import { describe, expect, it } from "vitest";
import { QuestLog } from "./QuestLog.js";
import { QUEST_TYPE, MAIN_QUESTS } from "../../data/quests/index.js";
import { MAX_LEVEL } from "../progression/Levels.js";

/**
 * A missao de nivel, quando o jogador chega no nivel antes dela.
 *
 * "Alcance o nivel 5" era contada por EVENTO: so um level-up
 * completava. Quem farmou ate o nivel 7 ANTES de a missao virar a
 * atual ficava preso nela. O painel mostrava 0 de 5, o objetivo
 * escrito na missao ja estava cumprido, e nada mais viria.
 *
 * O pior caso e permanente: se a missao e "Alcance o nivel 10" e o
 * jogador ja esta no maximo, nenhum level-up acontece nunca mais e
 * a missao nao fecha jamais.
 *
 * A regra agora e comparar com o nivel que o jogador TEM.
 */
const missaoDeNivel = (count) =>
  MAIN_QUESTS.find(
    (q) => q.type === QUEST_TYPE.LEVEL && q.count === count,
  );

/** Deixa a missao de nivel como a ATUAL, como se as anteriores tivessem sido feitas. */
function comMissaoAtual(log, id) {
  const indice = MAIN_QUESTS.findIndex((q) => q.id === id);

  expect(indice, `missao ${id} nao existe`).toBeGreaterThanOrEqual(0);

  log.mainIndex = indice;
  log.mainProgress = 0;

  return indice;
}

describe("missao de nivel: o nivel conta o que o jogador TEM", () => {
  it("completa na hora quando o jogador ja chegou no nivel", () => {
    const log = new QuestLog();

    comMissaoAtual(log, "main_nivel_5");

    // o jogador subiu de nivel farmando, e a missao virou a atual
    // depois disso
    const feitas = log.syncLevel(7);

    expect(feitas.map((q) => q.id)).toEqual(["main_nivel_5"]);

    // e a missao SEGUE, nao fica parada como ativa
    expect(log.currentMain.id).not.toBe("main_nivel_5");
  });

  it("para na missao seguinte, e nao pula as que estao no meio", () => {
    const log = new QuestLog();

    comMissaoAtual(log, "main_nivel_5");

    // o jogador farmou ate o 12, o que cumpre `nivel_5` E `nivel_10`
    const feitas = log.syncLevel(12);

    // So a `nivel_5` fecha. Entre ela e a `nivel_10` tem uma cacada e
    // um equipamento, e um level alto NAO pode fazer o jogador pular
    // as duas. O laco para na primeira missao que nao e de nivel
    expect(feitas.map((q) => q.id)).toEqual(["main_nivel_5"]);

    const seguinte = MAIN_QUESTS.findIndex(
      (q) => q.id === "main_nivel_5",
    ) + 1;

    expect(log.currentMain.id).toBe(MAIN_QUESTS[seguinte].id);
    expect(log.currentMain.type).not.toBe(QUEST_TYPE.LEVEL);
  });

  it("cumpre missoes de nivel seguidas, uma por chamada", () => {
    // Nao ha duas missoes de nivel seguidas na cadeia real, entao
    // este teste usa uma cadeia propria. O que importa e o laco: com
    // duas de nivel em sequencia, o `syncLevel` tem de andar as duas
    class CadeiaDeNiveis extends QuestLog {
      get currentMain() {
        return (
          this.minha[this.mainIndex] ?? null
        );
      }
    }

    const log = new CadeiaDeNiveis();

    log.minha = [
      { ...missaoDeNivel(5), rewards: {}, count: 5 },
      { ...missaoDeNivel(10), rewards: {}, count: 10 },
    ];
    log.mainIndex = 0;
    log.mainProgress = 0;

    const feitas = log.syncLevel(12);

    expect(feitas.map((q) => q.count)).toEqual([5, 10]);
    expect(log.currentMain).toBeNull();
  });

  it("nao completa antes da hora", () => {
    const log = new QuestLog();

    comMissaoAtual(log, "main_nivel_5");

    expect(log.syncLevel(4)).toEqual([]);
    expect(log.currentMain.id).toBe("main_nivel_5");
    expect(log.mainProgress).toBe(0);
  });

  it("nao trava quando a missao pede o nivel maximo e o jogador ja nele", () => {
    const log = new QuestLog();

    // o caso PERMANENTE: ninguem sobe mais de nivel, entao o
    // evento nunca mais vem
    comMissaoAtual(log, "main_nivel_10");

    const feitas = log.syncLevel(MAX_LEVEL);

    expect(feitas.map((q) => q.id)).toEqual(["main_nivel_10"]);
    expect(log.currentMain.id).not.toBe("main_nivel_10");
  });

  it("o nivel exato da missao conta como cumprido", () => {
    const log = new QuestLog();

    comMissaoAtual(log, "main_nivel_5");

    expect(log.syncLevel(5).map((q) => q.id)).toEqual([
      "main_nivel_5",
    ]);
  });

  it("uma missao que nao e de nivel nao e mexida pelo syncLevel", () => {
    const log = new QuestLog();

    // na terceira missao principal, uma cacada
    expect(MAIN_QUESTS[0].type).toBe(QUEST_TYPE.HUNT);

    log.mainIndex = 0;
    log.mainProgress = 2;

    expect(log.syncLevel(MAX_LEVEL)).toEqual([]);
    expect(log.currentMain.id).toBe(MAIN_QUESTS[0].id);
    expect(log.mainProgress).toBe(2);
  });

  it("o level-up continua completando, pelo mesmo caminho de antes", () => {
    const log = new QuestLog();

    comMissaoAtual(log, "main_nivel_5");

    // `onLevelUp` virou um atalho para o `syncLevel`, entao o
    // caminho que existia antes continua funcionando
    expect(log.onLevelUp(5).map((q) => q.id)).toEqual([
      "main_nivel_5",
    ]);
  });

  it("sincronizar duas vezes com o mesmo nivel nao completa duas vezes", () => {
    const log = new QuestLog();

    comMissaoAtual(log, "main_nivel_5");

    expect(log.syncLevel(8)).toHaveLength(1);

    // a segunda chamada ve a proxima missao, que nao e de nivel
    expect(log.syncLevel(8)).toEqual([]);
  });

  it("guarda o nivel para o painel consultar", () => {
    const log = new QuestLog();

    log.syncLevel(6);

    expect(log.levelConhecido).toBe(6);
  });

  it("as missoes de nivel do jogo sao as que a regra pressupoe", () => {
    // o defeito so existe porque existe missao de nivel no meio da
    // cadeia. Se a lista mudar, este teste avisa
    const deNivel = MAIN_QUESTS.filter(
      (q) => q.type === QUEST_TYPE.LEVEL,
    );

    expect(deNivel.map((q) => q.count)).toEqual([5, 10]);
    expect(missaoDeNivel(5)).toBeTruthy();
    expect(missaoDeNivel(10)).toBeTruthy();
  });
});
