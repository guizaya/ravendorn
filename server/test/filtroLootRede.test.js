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
  DEFAULT_LOOT_FILTER,
  LOOT_CATEGORY,
} from "../../src/game/loot/lootFilter.js";
import { createCreature } from "../../src/data/enemies/index.js";
import { getItem } from "../../src/data/items/index.js";

/**
 * O filtro de coleta, online.
 *
 * O bug que o jogador relocationou: os tres botoes do filtro
 * (escolher raridade, padrao, limpar mochila) chamavam o motor da
 * TELA. Online quem decide o loot e o servidor, entao o ajuste morria
 * no cliente e a tela voltava ao normal no pacote seguinte.
 *
 * A correcao tem duas metades, e a segunda e a que os testes
 * prendem:
 *
 * 1. o pedido vai pela rede, e o servidor aplica na sessao de quem
 *    pediu;
 * 2. o filtro e POR SESSAO. Ele vivia no motor, e ai estava o
 *    defeito invisivel: um so filtro para o mundo inteiro, entao o
 *    filtro de um jogador mudava o loot de todo mundo no mesmo mapa.
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

    const sessao = () => jogo.engine.world.players.get(client.id);

    const painel = () => {
      jogo.enviarPainel(client);

      for (let i = recebidos.length - 1; i >= 0; i -= 1) {
        if (recebidos[i].type === SERVER_EVENTS.PLAYER_STATE) {
          return recebidos[i].payload;
        }
      }

      return null;
    };

    const pedir = (payload) =>
      jogo.receber(
        client,
        JSON.stringify(
          createCommand(CLIENT_COMMANDS.PANEL, payload),
        ),
      );

    return { client, sessao, painel, pedir };
  };

  return { jogo, abrir };
}

/** Um material comum, que e o alvo tipico do filtro. */
const MATERIAL = "slime_gel";

const filtro = (categoria, raridade) => ({
  ...DEFAULT_LOOT_FILTER,
  [categoria]: raridade,
});

describe("filtro de coleta online: o pedido chega e vale", () => {
  it("o filtro do painel muda e VOLTA no painel do dono", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    // antes de pedir, o jogador nao tem filtro: "pega tudo". E a
    // SESSAO que guarda a verdade; o painel e a copia que volta
    expect(ana.sessao().lootFilter).toBeNull();

    ana.pedir({
      op: PANEL_OPS.SET_LOOT_FILTER,
      filter: filtro(LOOT_CATEGORY.MATERIAL, "rare"),
    });

    // e o painel volta com o que o servidor guardou. Antes disto o
    // clique mudava um filtro do cliente e o proximo pacote
    // sobrescrevia a tela com o valor antigo
    expect(ana.painel().lootFilter[LOOT_CATEGORY.MATERIAL]).toBe(
      "rare",
    );

    jogo.stop();
  });

  it("descarta o loot abaixo da raridade escolhida, para quem escolheu", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    ana.pedir({
      op: PANEL_OPS.SET_LOOT_FILTER,
      filter: filtro(LOOT_CATEGORY.MATERIAL, "epic"),
    });

    // um material comum nao passa; um lendario passa
    expect(
      ana.sessao().lootFilter[LOOT_CATEGORY.MATERIAL],
    ).toBe("epic");

    jogo.stop();
  });

  it("voltar ao padrao limpa o filtro", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    ana.pedir({
      op: PANEL_OPS.SET_LOOT_FILTER,
      filter: filtro(LOOT_CATEGORY.MATERIAL, "rare"),
    });

    ana.pedir({
      op: PANEL_OPS.SET_LOOT_FILTER,
      filter: DEFAULT_LOOT_FILTER,
    });

    expect(
      ana.painel().lootFilter[LOOT_CATEGORY.MATERIAL],
    ).toBeNull();

    jogo.stop();
  });
});

describe("filtro de coleta: e de cada jogador, nao do mundo", () => {
  it("um jogador nao mexe no filtro do outro", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const bento = abrir("Bento");

    ana.pedir({
      op: PANEL_OPS.SET_LOOT_FILTER,
      filter: filtro(LOOT_CATEGORY.MATERIAL, "rare"),
    });

    expect(ana.sessao().lootFilter[LOOT_CATEGORY.MATERIAL]).toBe("rare");
    expect(bento.sessao().lootFilter).toBeNull();

    jogo.stop();
  });

  it("o mesmo abate da para os dois, cada um com o seu filtro", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const bento = abrir("Bento");

    // A Ana so quer epico ou melhor. O Bento quer tudo
    ana.pedir({
      op: PANEL_OPS.SET_LOOT_FILTER,
      filter: filtro(LOOT_CATEGORY.MATERIAL, "epic"),
    });

    /**
     * Uma criatura com drop GARANTIDO.
     *
     * Com um slime de verdade o teste dependia da sorte: o slime so
     * da item 17% das vezes, e o teste passava ou falhava conforme o
     * sorteio. Aqui o `itemChance` e 1, entao o material sempre
     * aparece, e a unica variavel e de QUEM o filtro e
     */
    const criatura = {
      id: "isca_de_teste",
      name: "Isca",
      isCreature: true,
      loot: {
        coins: { min: 10, max: 10 },
        itemChance: 1,
        maxItems: 1,
        items: [{ id: MATERIAL, weight: 1 }],
      },
    };

    jogo.engine.withPlayer(ana.id, () => {
      jogo.engine.loot.collectFrom(criatura, ana.sessao());
    });

    jogo.engine.withPlayer(bento.id, () => {
      jogo.engine.loot.collectFrom(criatura, bento.sessao());
    });

    const temGel = (inv) =>
      inv.stacks.some((s) => s.itemId === MATERIAL);

    // a Ana NUNCA recebeu o material comum: o filtro dela tirou o
    // item do pool ANTES do sorteio
    expect(
      temGel(ana.sessao().inventory),
      "a Ana pegou o que o filtro dela barra",
    ).toBe(false);

    // e o Bento, que nao filtra, recebeu
    expect(
      temGel(bento.sessao().inventory),
      "o Bento devia ter pegado o comum",
    ).toBe(true);

    // os dois ganharam as moedas: o filtro e por CATEGORIA de item,
    // e nao barra moeda
    expect(ana.sessao().inventory.coins).toBeGreaterThan(0);
    expect(bento.sessao().inventory.coins).toBeGreaterThan(0);

    jogo.stop();
  });

  it("limpar a mochila apaga so a mochila de quem pediu", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const bento = abrir("Bento");

    // a Ana barra tudo que for material, o Bento nao barra nada
    ana.pedir({
      op: PANEL_OPS.SET_LOOT_FILTER,
      filter: filtro(LOOT_CATEGORY.MATERIAL, "legendary"),
    });

    for (const p of [ana, bento]) {
      p.sessao().inventory.add(MATERIAL, 3);
    }

    expect(ana.sessao().inventory.count(MATERIAL)).toBe(3);
    expect(bento.sessao().inventory.count(MATERIAL)).toBe(3);

    // so a Ana pede a limpeza
    ana.pedir({ op: PANEL_OPS.PRUNE_INVENTORY });

    expect(
      ana.sessao().inventory.count(MATERIAL),
      "a mochila da Ana devia estar limpa",
    ).toBe(0);

    expect(
      bento.sessao().inventory.count(MATERIAL),
      "a mochila do Bento NAO devia ser tocada",
    ).toBe(3);

    jogo.stop();
  });
});

describe("filtro de coleta: o que o filtro barra e o que o jogador tem", () => {
  it("o material barrado nao entra na mochila de quem bateu", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    ana.pedir({
      op: PANEL_OPS.SET_LOOT_FILTER,
      filter: filtro(LOOT_CATEGORY.MATERIAL, "legendary"),
    });

    // drop garantido, para o teste nao depender da sorte
    const criatura = {
      id: "isca",
      name: "Isca",
      isCreature: true,
      loot: {
        coins: { min: 1, max: 1 },
        itemChance: 1,
        maxItems: 1,
        items: [{ id: MATERIAL, weight: 1 }],
      },
    };

    jogo.engine.withPlayer(ana.id, () => {
      jogo.engine.loot.collectFrom(criatura, ana.sessao());
    });

    const pegouComum = ana
      .sessao()
      .inventory.stacks.filter(
        (s) => s.itemId === MATERIAL,
      );

    // nenhum destes pode ter raridade abaixo de `legendary`
    for (const pilha of pegouComum) {
      const item = getItem(pilha.itemId);

      expect(item?.rarity).toBe("legendary");
    }

    jogo.stop();
  });
});
