import { describe, expect, it } from "vitest";
import { createPlayerSession } from "../engine/PlayerSession.js";
import {
  applyCharacterSave,
  snapshotSession,
} from "./CharacterSave.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { getQuest } from "../../data/quests/index.js";

/**
 * A recompensa NAO resgatada atravessa o save.
 *
 * O resgate da missao virou um clique do jogador, e entre o objetivo
 * fechar e o clique existe um intervalo em que o jogador pode fechar o
 * navegador. A fila de resgate precisa sobreviver a isso, porque
 * perder o gold sem erro nenhum e o pior resultado que um save pode
 * dar
 *
 * O outro lado do mesmo caminho e o arquivo editado a mao. Um
 * `questId` forjado viraria um [RECEBER] para uma missao que ninguem
 * conhece, e um `reward` forjado viraria uma quantia de moedas que o
 * servidor nao pediu. Por isso o pagamento e relido do CATALOGO
 */

const sessaoDe = () =>
  createPlayerSession(CHARACTER_CLASSES[0], {
    name: "Ana",
    classId: "warrior",
  });

describe("a recompensa nao resgatada no save", () => {
  it("volta para a fila depois do round trip", () => {
    const antes = sessaoDe();

    antes.quests.complete(
      { coins: 999, xp: 1, items: [] },
      "main",
      "main_brejo",
    );

    const arquivo = snapshotSession(antes);

    // o `questId` viaja com a linha: e ele que o painel usa para
    // desenhar o [RECEBER] e para garantir o resgate unico
    expect(arquivo.quests.pending).toHaveLength(1);
    expect(arquivo.quests.pending[0].questId).toBe(
      "main_brejo",
    );

    const depois = sessaoDe();

    applyCharacterSave(depois, arquivo);

    expect(depois.quests.isClaimable("main_brejo")).toBe(
      true,
    );
    expect(
      depois.quests.pendingOf("main_brejo").scope,
    ).toBe("main");
  });

  it("paga o que o catalogo manda, e nao o que o arquivo diz", () => {
    const sessao = sessaoDe();

    applyCharacterSave(sessao, {
      version: 1,
      name: "Ana",
      classId: "warrior",
      player: { level: 1, xp: 0, x: 100, y: 100 },
      quests: {
        mainIndex: 1,
        pending: [
          {
            questId: "main_brejo",
            reward: {
              coins: 999_999,
              xp: 0,
              items: [{ itemId: "willow_bow", count: 9 }],
            },
          },
        ],
      },
    });

    const esperado = getQuest("main_brejo").rewards;

    expect(
      sessao.quests.pendingOf("main_brejo").reward,
    ).toEqual({
      coins: esperado.coins,
      xp: esperado.xp,
      items: esperado.items,
    });
  });

  it("descarta um questId que nao existe no catalogo", () => {
    const sessao = sessaoDe();

    applyCharacterSave(sessao, {
      version: 1,
      name: "Ana",
      classId: "warrior",
      player: { level: 1, xp: 0, x: 100, y: 100 },
      quests: {
        pending: [
          {
            questId: "missao_forjada",
            reward: { coins: 1_000_000, xp: 0, items: [] },
          },
        ],
      },
    });

    expect(sessao.quests.pending).toHaveLength(0);
  });

  it("descarta uma linha sem questId", () => {
    // o formato antigo do save guardava so `scope` e `reward`. Sem o
    // id nao ha como ligar um botao a uma recompensa, entao a linha
    // nao volta: e melhor perder a recompensa antiga do que oferecer
    // um resgate que aponta para lugar nenhum
    const sessao = sessaoDe();

    applyCharacterSave(sessao, {
      version: 1,
      name: "Ana",
      classId: "warrior",
      player: { level: 1, xp: 0, x: 100, y: 100 },
      quests: {
        pending: [
          { scope: "main", reward: { coins: 40, xp: 30 } },
        ],
      },
    });

    expect(sessao.quests.pending).toHaveLength(0);
  });

  it("descarta a duplicata pelo questId", () => {
    // um arquivo com a mesma missao duas vezes pagaria duas vezes. O
    // `claim` impede o segundo CLIQUE, nao um arquivo adulterado
    const sessao = sessaoDe();

    applyCharacterSave(sessao, {
      version: 1,
      name: "Ana",
      classId: "warrior",
      player: { level: 1, xp: 0, x: 100, y: 100 },
      quests: {
        pending: [
          { questId: "main_brejo", reward: { coins: 1 } },
          { questId: "main_brejo", reward: { coins: 1 } },
        ],
      },
    });

    expect(sessao.quests.pending).toHaveLength(1);
    expect(sessao.quests.claimableCount).toBe(1);
  });

  it("nao confunde a principal com a secundaria", () => {
    // o `scope` do save e ignorado: ele sai do catalogo. Um arquivo
    // que disser `main` para uma secundaria colocaria o [RECEBER] na
    // aba errada
    const sessao = sessaoDe();

    applyCharacterSave(sessao, {
      version: 1,
      name: "Ana",
      classId: "warrior",
      player: { level: 1, xp: 0, x: 100, y: 100 },
      quests: {
        pending: [
          { questId: "side_brejo", scope: "main" },
          { questId: "main_toca", scope: "side" },
        ],
      },
    });

    expect(
      sessao.quests.pendingOf("side_brejo").scope,
    ).toBe("side");
    expect(
      sessao.quests.pendingOf("main_toca").scope,
    ).toBe("main");
  });
});