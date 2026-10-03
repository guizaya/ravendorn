import { describe, expect, it } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  SERVER_EVENTS,
  createCommand,
} from "../../src/shared/protocol.js";
import {
  MAIN_QUESTS,
  QUEST_TYPE,
} from "../../src/data/quests/index.js";
import { MAX_LEVEL } from "../../src/game/progression/Levels.js";

/**
 * A missao de nivel, pelo caminho do SERVIDOR.
 *
 * O defeito era da regra, e nao do save: a missao "Alcance o nivel
 * 5" so fechava por EVENTO de level-up. O caminho que o jogador
 * descreve e o do save: ele chegou no nivel antes de a missao virar
 * a atual, e ela nunca mais destravou.
 *
 * Aqui o teste passa pelo `restaurar`, que e onde o personagem
 * volta com o nivel e a missao ja la dentro do save.
 */
function montar() {
  const jogo = new GameServer({ config: { ...SERVER_CONFIG } });

  const abrir = (nome, classId = "warrior") => {
    const recebidos = [];

    const socket = {
      readyState: 1,
      send: (texto) => recebidos.push(JSON.parse(texto)),
    };

    const client = new Client(socket);

    jogo.conectar(client);

    jogo.receber(
      client,
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.JOIN, {
          name: nome,
          classId,
        }),
      ),
    );

    return {
      client,
      sessao: () => jogo.engine.world.players.get(client.id),
      painel: () => {
        jogo.enviarPainel(client);

        for (let i = recebidos.length - 1; i >= 0; i -= 1) {
          if (recebidos[i].type === SERVER_EVENTS.PLAYER_STATE) {
            return recebidos[i].payload;
          }
        }

        return null;
      },
    };
  };

  /**
   * Um pedido de painel na sessao de um jogador.
   *
   * O `Client` duble e ligado a sessao que ja esta no jogo: e assim
   * que o botao do painel chega no servidor de verdade, e nao por uma
   * chamada direta ao motor
   */
  const pedido = (jogador, payload) => {
    const duble = new Client({ readyState: 1, send: () => {} });

    duble.session = jogador.sessao();
    duble.joined = true;

    jogo.receber(
      duble,
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.PANEL, payload),
      ),
    );
  };

  return { jogo, abrir, pedido };
}

const indiceDe = (id) =>
  MAIN_QUESTS.findIndex((q) => q.id === id);

const missaoDeNivel = (count) =>
  MAIN_QUESTS.find(
    (q) => q.type === QUEST_TYPE.LEVEL && q.count === count,
  );

describe("missao de nivel no servidor: volta destravada do save", () => {
  it("um save com nivel 8 na missao de nivel 5 NAO fica travado", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    // o save do jogador: nivel 8, e a missao de nivel 5 e a atual
    const dados = {
      version: 1,
      name: "Ana",
      classId: "warrior",
      player: { level: 8, xp: 0, x: 3100, y: 2100 },
      quests: {
        mainIndex: indiceDe("main_nivel_5"),
        mainProgress: 0,
        mainDone: false,
      },
    };

    jogo.restaurar(ana.sessao(), dados);

    // o objetivo "Alcance o nivel 5" ja estava cumprido quando o
    // save foi escrito, entao a missao tem de ter fechado
    expect(ana.sessao().quests.currentMain.id).not.toBe(
      "main_nivel_5",
    );

    jogo.stop();
  });

  it("um save no nivel maximo tambem fecha a missao do nivel 10", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    // este e o caso que era PERMANENTE: no maximo ninguem sobe de
    // nivel, entao o evento nunca mais vinha e a missao nao fechava
    // jamais
    const dados = {
      version: 1,
      name: "Ana",
      classId: "warrior",
      player: { level: MAX_LEVEL, xp: 0, x: 3100, y: 2100 },
      quests: {
        mainIndex: indiceDe("main_nivel_10"),
        mainProgress: 0,
        mainDone: false,
      },
    };

    jogo.restaurar(ana.sessao(), dados);

    expect(ana.sessao().quests.currentMain.id).not.toBe(
      "main_nivel_10",
    );

    jogo.stop();
  });

  it("um save ABAIXO do nivel deixa a missao esperando", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    const dados = {
      version: 1,
      name: "Ana",
      classId: "warrior",
      player: { level: 3, xp: 0, x: 3100, y: 2100 },
      quests: {
        mainIndex: indiceDe("main_nivel_5"),
        mainProgress: 0,
        mainDone: false,
      },
    };

    jogo.restaurar(ana.sessao(), dados);

    // nivel 3 nao cumpre "alcanca o nivel 5": a missao continua
    // ativa, e e o comportamento certo
    expect(ana.sessao().quests.currentMain.id).toBe(
      "main_nivel_5",
    );
    expect(ana.sessao().quests.mainProgress).toBe(0);

    jogo.stop();
  });

  it("a missao de nivel fecha quando a missao anterior termina tarde", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    // o jogador esta no nivel 9 e a missao de cacada e a atual. A
    // missao de nivel vem DEPOIS, e ja esta cumprida: e o caso em que
    // a missao vira a atual no meio do jogo, sem passar por save
    ana.sessao().player.level = 9;
    ana.sessao().quests.mainIndex = indiceDe("main_goblins");
    ana.sessao().quests.mainProgress = 99;

    jogo.engine.withPlayer(ana.client.id, () => {
      jogo.engine.resolveQuestProgress(
        ana.sessao().quests.onKill("goblin", 99),
      );
    });

    // a cacada fechou e a missao de nivel entrou, mas o jogador ja
    // estava no 9
    const atual = ana.sessao().quests.currentMain;

    expect(atual.id).not.toBe("main_nivel_5");
    expect(atual.id).not.toBe("main_goblins");

    jogo.stop();
  });

  it("a recompensa da missao de nivel espera o [RECEBER]", () => {
    const { jogo, abrir, pedido } = montar();

    const ana = abrir("Ana");

    const recompensa = missaoDeNivel(5).rewards?.coins ?? 0;
    const moedasAntes = ana.sessao().inventory.coins;

    const dados = {
      version: 1,
      name: "Ana",
      classId: "warrior",
      player: { level: 8, xp: 0, x: 3100, y: 2100 },
      quests: {
        mainIndex: indiceDe("main_nivel_5"),
        mainProgress: 0,
        mainDone: false,
      },
    };

    jogo.restaurar(ana.sessao(), dados);

    // fechar a missao tem que VALER: as moedas do objetivo entram
    // na mochila assim que o jogador pede, e nao antes
    expect(recompensa).toBeGreaterThan(0);

    // nada na mochila ainda: a recompensa esta na fila do resgate
    expect(ana.sessao().inventory.coins).toBe(moedasAntes);
    expect(
      ana.sessao().quests.isClaimable("main_nivel_5"),
    ).toBe(true);

    // e o pedido do painel paga
    pedido(ana, {
      op: PANEL_OPS.CLAIM_QUEST_REWARD,
      questId: "main_nivel_5",
    });

    expect(ana.sessao().inventory.coins).toBe(
      moedasAntes + recompensa,
    );
    expect(
      ana.sessao().quests.isClaimable("main_nivel_5"),
    ).toBe(false);

    jogo.stop();
  });

  it("o segundo pedido de resgate nao paga de novo", () => {
    // o clique duplo do [RECEBER]. A fila do `QuestLog` perde a
    // linha no primeiro resgate, entao repetir o pedido nao encontra
    // o que pagar
    const { jogo, abrir, pedido } = montar();

    const ana = abrir("Ana");

    const moedasAntes = ana.sessao().inventory.coins;

    jogo.restaurar(ana.sessao(), {
      version: 1,
      name: "Ana",
      classId: "warrior",
      player: { level: 8, xp: 0, x: 3100, y: 2100 },
      quests: {
        mainIndex: indiceDe("main_nivel_5"),
        mainProgress: 0,
        mainDone: false,
      },
    });

    const resgate = {
      op: PANEL_OPS.CLAIM_QUEST_REWARD,
      questId: "main_nivel_5",
    };

    pedido(ana, resgate);

    const depoisDoPrimeiro =
      ana.sessao().inventory.coins;

    pedido(ana, resgate);
    pedido(ana, resgate);

    expect(ana.sessao().inventory.coins).toBe(
      depoisDoPrimeiro,
    );
    expect(depoisDoPrimeiro).toBeGreaterThan(moedasAntes);

    jogo.stop();
  });

  it("resgatar uma missao que nao existe nao paga nada", () => {
    // o `questId` vem do cliente. Um id forjado nao pode virar moeda
    const { jogo, abrir, pedido } = montar();

    const ana = abrir("Ana");

    const moedasAntes = ana.sessao().inventory.coins;

    pedido(ana, {
      op: PANEL_OPS.CLAIM_QUEST_REWARD,
      questId: "missao_forjada",
    });

    expect(ana.sessao().inventory.coins).toBe(moedasAntes);

    jogo.stop();
  });
});
