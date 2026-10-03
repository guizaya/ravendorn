import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
} from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  SERVER_EVENTS,
  createCommand,
} from "../../src/shared/protocol.js";
import { ITEMS } from "../../src/data/items/index.js";

/**
 * Abrir o inventario tira do corpo a peca no slot errado, online.
 *
 * A regra de posicao vive no `equip`, e o `equip` so roda quando o
 * jogador veste alguma coisa. Quem ja tem peca no slot errado veio de
 * um save antigo, e continuaria vendo o capuz no peito para sempre: o
 * painel abriria, mostraria o boneco errado, e nada no jogo corrigiria
 *
 * Online isso tem duas metades, e a segunda e a que os testes
 * prendem:
 *
 * 1. abrir o inventario precisa virar um PEDIDO. Online o
 *    equipamento mora no servidor, e o cliente nao tem a sessao do
 *    jogador nem simula. Chamar o motor da tela, como o botao fazia
 *    com o filtro de coleta, o pedido morre no cliente
 *
 * 2. o pedido vale para QUEM abriu. O `withPlayer` do servidor ja
 *    garante o foco, mas um pedido vazado mexe no equipamento dos
 *    outros, e com dois jogadores na partida um abriria o inventario
 *    e veria a peca do outro sair do corpo
 */

/**
 * Pecas de armadura que so existem durante o teste.
 *
 * Depois da limpeza do catalogo sobrou uma peca equipavel, o arco de
 * galho, que e arma e nao declara posicao. Sem estas pecas de teste
 * nao ha como exercitar a correcao: um item de armadura de verdade
 * seria a unica forma de um save antigo ter peca no slot errado
 */
const CAPUZ = {
  id: "__test_capuz",
  name: "Capuz de Teste",
  icon: "C",
  rarity: "uncommon",
  type: "armor",
  slot: "head",
  tier: 1,
  value: 1,
  stackable: false,
  maxStack: 1,
  stats: { defense: 5 },
};

const GIBAO = {
  id: "__test_gibao",
  name: "Gibao de Teste",
  icon: "G",
  rarity: "uncommon",
  type: "armor",
  slot: "chest",
  tier: 1,
  value: 1,
  stackable: false,
  maxStack: 1,
  stats: { defense: 7 },
};

const FIXTURES = [CAPUZ, GIBAO];

beforeEach(() => {
  for (const item of FIXTURES) ITEMS[item.id] = item;
});

afterEach(() => {
  for (const item of FIXTURES) delete ITEMS[item.id];
});

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

    /**
     * Coloca uma peca num slot que nao e dela, como um save antigo.
     *
     * Vai direto no slot, e nao pelo `equip`: e o que o `load` do
     * save produz, e o `equip` recusaria pela regra que estamos
     * testando
     */
    const vestirErrado = (itemId, slotId, rarity) => {
      const s = sessao();

      jogo.engine.withPlayer(client.id, () => {
        const slot = s.equipment.getSlot(slotId);

        slot.itemId = itemId;
        slot.rarity = rarity ?? null;
      });
    };

    const limparMochila = () => {
      const s = sessao();

      jogo.engine.withPlayer(client.id, () => {
        s.inventory.clear();
      });
    };

    /**
     * Enche a mochila de verdade, com pecas que NAO empilham.
     *
     * Os 14 itens do catalogo sao quase todos material, e material
     * empilha: encher 20 slots com eles e impossivel. A peca de
     * teste de armadura e o que ocupa espaco de verdade
     */
    const encherMochila = () => {
      const s = sessao();

      jogo.engine.withPlayer(client.id, () => {
        s.inventory.clear();

        for (let i = 0; i < 40; i += 1) {
          s.inventory.add(CAPUZ.id, 1);
          s.inventory.add(GIBAO.id, 1);
        }
      });
    };

    return {
      client,
      sessao,
      painel,
      pedir,
      vestirErrado,
      limparMochila,
      encherMochila,
    };
  };

  return { jogo, abrir };
}

describe("peca no slot errado, online", () => {
  it("o pedido de abrir o inventario tira a peca do corpo", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    // save antigo: o capuz no peito
    ana.limparMochila();
    ana.vestirErrado(CAPUZ.id, "chest", "legendary");

    const antes = ana.painel();

    expect(
      antes.equipment.slots.find((s) => s.id === "chest")
        .itemId,
    ).toBe(CAPUZ.id);

    // e o pedido, e nao uma chamada no motor da tela
    ana.pedir({ op: PANEL_OPS.FIX_MISPLACED_EQUIPMENT });

    const depois = ana.painel();

    expect(
      depois.equipment.slots.find((s) => s.id === "chest")
        .itemId,
    ).toBe(null);

    // e a peca voltou para a mochila do MESMO jogador
    const mochila = depois.inventory.items.find(
      (item) => item.itemId === CAPUZ.id,
    );

    expect(mochila).toBeTruthy();
    expect(mochila.rarity).toBe("legendary");
    expect(mochila.count).toBe(1);

    jogo.stop();
  });

  it("um jogador nao tira a peca do corpo do outro", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const bento = abrir("Bento");

    // os dois com save antigo, cada um com o seu
    ana.limparMochila();
    ana.vestirErrado(CAPUZ.id, "chest", "rare");

    bento.limparMochila();
    bento.vestirErrado(GIBAO.id, "head", "epic");

    // a Ana abre o inventario
    ana.pedir({ op: PANEL_OPS.FIX_MISPLACED_EQUIPMENT });

    // o capuz SAIU do corpo da Ana
    expect(
      ana.painel().equipment.slots.find((s) => s.id === "chest")
        .itemId,
    ).toBe(null);

    // e o gibao do Bento continua no lugar
    expect(
      bento
        .painel()
        .equipment.slots.find((s) => s.id === "head").itemId,
    ).toBe(GIBAO.id);

    jogo.stop();
  });

  it("nao mexe em peca que esta no slot certo", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const sessao = ana.sessao();

    ana.limparMochila();

    jogo.engine.withPlayer(ana.client.id, () => {
      sessao.equipment.equip(CAPUZ.id, "head", "rare");
    });

    ana.pedir({ op: PANEL_OPS.FIX_MISPLACED_EQUIPMENT });

    const painel = ana.painel();
    const cabeca = painel.equipment.slots.find(
      (s) => s.id === "head",
    );

    // a peca legitimate continua vestida, com a raridade dela
    expect(cabeca.itemId).toBe(CAPUZ.id);
    expect(cabeca.rarity).toBe("rare");

    jogo.stop();
  });

  it("o pedido responde no painel de quem pediu", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    ana.limparMochila();
    ana.vestirErrado(CAPUZ.id, "chest", null);

    ana.pedir({ op: PANEL_OPS.FIX_MISPLACED_EQUIPMENT });

    // sem o `sendSnapshot` do fim do pedido, a correcao valeria no
    // servidor e o painel continuaria mostrando o capuz no peito ate
    // o proximo pacote: o jogador veria que nada aconteceu
    expect(
      ana.painel().equipment.slots.find((s) => s.id === "chest")
        .itemId,
    ).toBe(null);

    jogo.stop();
  });

  it("pedido com inventario cheio nao perde a peca", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    ana.encherMochila();

    expect(ana.painel().inventory.isFull).toBe(true);

    // a peca entra depois de encher: encher limpava a mochila
    ana.vestirErrado(CAPUZ.id, "chest", "legendary");

    ana.pedir({ op: PANEL_OPS.FIX_MISPLACED_EQUIPMENT });

    const painel = ana.painel();
    const peito = painel.equipment.slots.find(
      (s) => s.id === "chest",
    );

    // sem espaco na mochila a peca volta para o MESMO slot: e o
    // melhor destino que existe, e nada se perde
    expect(peito.itemId).toBe(CAPUZ.id);
    expect(peito.rarity).toBe("legendary");

    jogo.stop();
  });
});
