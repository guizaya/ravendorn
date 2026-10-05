import { describe, expect, it } from "vitest";
import { QuestLog } from "./QuestLog.js";
import {
  MAIN_QUESTS,
  getSideFor,
  getSideIdFor,
} from "../../data/quests/index.js";

/**
 * O MESMO ABATE CONTA PARA AS DUAS MISSOES.
 *
 * ## A REGRA
 *
 * Com uma principal em andamento e a secundaria ativa, matar um inimigo
 * que satisfaz as duas avanza os dois contadores de uma vez. E o que faz
 * a secundaria ser o caminho curto: o jogador pega a missao curta, mata
 * o que a principal exige, e ao voltar a principal ja esta a meia
 *
 * ## POR QUE ISTO NAO E UM EFEITO COLATERAL
 *
 * O `onKill` percorre as DUAS missoes num laco e cada uma soma no seu
 * contador. Isso ja valia, e o par de missoes da primeira campanha
 * (principal 10, secundaria 5) foi escrito na mesma zona de proposito
 * para que a regra pudesse ser exercitada
 *
 * O que os testes abaixo travam e a parte que quebraria: que a
 * secundaria NAO ZERE o progresso da principal quando fecha, e que
 * aceitar a secundaria no meio do caminho nao apague o que ja foi
 * feito
 */

const MAIN = MAIN_QUESTS[0];
const SIDE_ID = getSideIdFor(MAIN.id);

/** Um log com a principal atual e a secundaria aceita. */
function comAsDuasAtivas() {
  const log = new QuestLog();

  log.acceptSide(SIDE_ID);

  return log;
}

/** Mata `n` limos de nivel 1, um por vez. */
function matar(log, n, level = 1) {
  const feitas = [];

  for (let i = 0; i < n; i += 1) {
    feitas.push(...log.onKill("slime", 1, level).map((q) => q.id));
  }

  return feitas;
}

describe("principal e secundaria contam o mesmo abate", () => {
  it("um abate avanca os dois contadores", () => {
    const log = comAsDuasAtivas();

    log.onKill("slime", 1, 1);

    expect(log.mainProgress).toBe(1);
    expect(log.sideProgress).toBe(1);
  });

  it("a secundaria fecha na metade e a principal continua", () => {
    const log = comAsDuasAtivas();

    const feitas = matar(log, MAIN.count / 2);

    // a secundaria fecha exatamente na metade da principal
    expect(feitas).toEqual([SIDE_ID]);

    // e o progresso da principal NAO ZERA: e o que o jogador ganhou
    expect(log.mainProgress).toBe(MAIN.count / 2);

    // a secundaria ja saiu de cena
    expect(log.sideId).toBe(null);
    expect(log.sideProgress).toBe(0);
  });

  it("aceitar a secundaria no meio nao apaga o progresso da principal", () => {
    const log = new QuestLog();

    matar(log, 3);

    const antes = log.mainProgress;

    expect(antes).toBe(3);

    log.acceptSide(SIDE_ID);

    // o contador da principal e de outro campo: aceitar nao encosta nele
    expect(log.mainProgress).toBe(antes);

    /**
     * E as duas passam a contar juntas — e a secundaria comeca do ZERO.
     *
     * As 3 mortes anteriores foram antes de ela existir, entao nao
     * contam para ela: o `sideProgress` comeca em 0 no `acceptSide`
     */
    expect(log.sideProgress).toBe(0);

    const side = getSideFor(MAIN.id);

    matar(log, side.count);

    expect(log.sideProgress).toBe(0);
    expect(log.completedSide.has(SIDE_ID)).toBe(true);

    // a principal contou as 5 da secundaria tambem
    expect(log.mainProgress).toBe(antes + side.count);
  });

  it("inimigo que nao satisfaz a missao nao conta para nenhuma", () => {
    const log = comAsDuasAtivas();

    // um rato nao e o alvo de nenhuma das duas
    log.onKill("rat", 1, 1);

    expect(log.mainProgress).toBe(0);
    expect(log.sideProgress).toBe(0);

    // e o `minLevel` barra junto: as duas pedem nivel 1, entao um limo
    // de nivel 7 conta — o que prova que o filtro e de nivel e nao de
    // criatura diferente
    log.onKill("slime", 1, 7);

    expect(log.mainProgress).toBe(1);
    expect(log.sideProgress).toBe(1);
  });

  it("a principal fecha e o par nao reabre", () => {
    const log = comAsDuasAtivas();
    const side = getSideFor(MAIN.id);

    // primeiro a secundaria, na metade
    expect(matar(log, side.count)).toEqual([SIDE_ID]);

    // depois a principal, no fim
    expect(matar(log, MAIN.count - side.count)).toEqual([MAIN.id]);

    expect(log.completedSide.has(SIDE_ID)).toBe(true);

    /**
     * O PAR FECHOU, mas a CAMPANIA nao: com doze missoes, a principal
     * seguinte vira a atual. E ela e de nivel 2, entao um abate de nivel
     * 1 nao conta para ela — o `minLevel` e o que impede o par de
     * reabrir
     */
    expect(log.mainDone).toBe(false);
    expect(log.mainIndex).toBe(1);

    expect(matar(log, 3)).toEqual([]);
  });

  it("a secundaria conta sozinha quando a campanha acabou", () => {
    const log = new QuestLog();

    log.mainDone = true;

    log.acceptSide(SIDE_ID);

    log.onKill("slime", 1, 1);

    // sem principal em andamento, a secundaria nao fica orfa
    expect(log.sideProgress).toBe(1);
  });
});

describe("a secundaria e metade da principal", () => {
  it("toda principal de cacada tem uma secundaria correspondente", () => {
    for (const main of MAIN_QUESTS) {
      const side = getSideFor(main.id);

      expect(side, `principal ${main.id} sem secundaria`).toBeTruthy();
    }
  });

  it("a secundaria pede metade dos inimigos", () => {
    for (const main of MAIN_QUESTS) {
      const side = getSideFor(main.id);

      expect(side.count * 2, `principal ${main.id}`).toBe(main.count);
    }
  });

  it("a secundaria e na MESMA zona da principal", () => {
    for (const main of MAIN_QUESTS) {
      const side = getSideFor(main.id);

      /**
       * E o que faz o auto levar o jogador para a zona certa: os dois
       * pedidos apontam para o mesmo lugar. Com `location` diferentes, o
       * auto escolheria um e o painel mostraria o outro
       */
      expect(side.location, `principal ${main.id}`).toBe(main.location);
    }
  });

  it("principal sem abate nao tem secundaria", () => {
    /**
     * "inimigo pela metade" nao faz sentido numa missao de `equip` ou de
     * `level`: nao ha criatura involveda
     */
    expect(getSideFor("main_inexistente")).toBe(null);
  });
});