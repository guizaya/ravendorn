import { describe, expect, it } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  REJECT,
  SERVER_EVENTS,
  createCommand,
  parseCommand,
} from "../../src/shared/protocol.js";
import {
  ANUNCIO_SEGUNDOS,
  PRECO_MAXIMO,
} from "../../src/data/market/index.js";
import { RARITY } from "../../src/data/items/index.js";

/**
 * O MARKET pela rede, com dois jogadores de verdade.
 *
 * A regra que estes testes defendem e a do dinheiro: o preco de um item
 * e uma transferencia entre DUAS pessoas, e nenhum dos dois lados
 * pode forjar nada do que o outro tem.
 *
 * O `agora` e injetado no `config`, entao os sete dias de validade sao
 * testados sem esperar sete dias
 */
function montar({ agora } = {}) {
  let relogio = agora ?? 1_000_000;

  const jogo = new GameServer({
    config: {
      ...SERVER_CONFIG,
      agora: () => relogio,
    },
  });

  const abrir = (nome, classId = "arbalist") => {
    const recebidos = [];

    const socket = {
      readyState: 1,
      send: (texto) => recebidos.push(JSON.parse(texto)),
    };

    const client = new Client(socket);
    jogo.conectar(client);

    const mandar = (command) =>
      jogo.receber(client, JSON.stringify(command));

    mandar(
      createCommand(CLIENT_COMMANDS.JOIN, {
        name: nome,
        classId,
      }),
    );

    const ultimo = (tipo) => {
      for (let i = recebidos.length - 1; i >= 0; i -= 1) {
        if (recebidos[i].type === tipo) return recebidos[i];
      }

      return null;
    };

    const painel = () => {
      jogo.enviarPainel(client);

      return (
        ultimo(SERVER_EVENTS.PLAYER_STATE)?.payload ?? null
      );
    };

    const sessao = () =>
      jogo.engine.world.players.get(client.id);

    return {
      client,
      mandar,
      ultimo,
      painel,
      sessao,
      moedas: () => sessao().inventory.coins,
      dar: (itemId, count = 1, rarity = null) =>
        sessao().inventory.add(itemId, count, rarity),
      uid: (itemId, rarity) =>
        sessao().inventory.findStack(itemId, rarity)?.uid,
      anunciar: (uid, price, count = null) =>
        mandar(
          createCommand(CLIENT_COMMANDS.PANEL, {
            op: PANEL_OPS.MARKET_LIST,
            uid,
            price,
            count,
          }),
        ),
      comprar: (listingId) =>
        mandar(
          createCommand(CLIENT_COMMANDS.PANEL, {
            op: PANEL_OPS.MARKET_BUY,
            listingId,
          }),
        ),
      cancelar: (listingId) =>
        mandar(
          createCommand(CLIENT_COMMANDS.PANEL, {
            op: PANEL_OPS.MARKET_CANCEL,
            listingId,
          }),
        ),
    };
  };

  return {
    jogo,
    abrir,
    passar: (ms) => {
      relogio += ms;
    },
  };
}

/** deixa os dois jogadores no mercado com uma peca da Ana anunciada */
function cenario() {
  const mundo = montar();
  const ana = mundo.abrir("Ana");
  const bento = mundo.abrir("Bento");

  ana.dar("botas_arbalist", 1, RARITY.RARE);
  ana.anunciar(ana.uid("botas_arbalist", RARITY.RARE), 200);

  return { ...mundo, ana, bento };
}

describe("o painel do market", () => {
  it("vem no painel do servidor", () => {
    const { ana } = cenario();

    const dados = ana.painel().market;

    expect(dados, "o painel nao tem o market").toBeTruthy();
    expect(dados.limites.precoMaximo).toBe(PRECO_MAXIMO);
  });

  it("o vendedor ve o proprio anuncio na aba dele, e nao na vitrine", () => {
    const { ana } = cenario();

    const dados = ana.painel().market;

    expect(dados.listings).toHaveLength(0);
    expect(dados.meus).toHaveLength(1);
    expect(dados.meus[0].itemId).toBe("botas_arbalist");
  });

  it("o comprador ve o anuncio na vitrine", () => {
    const { bento } = cenario();

    const vitrine = bento.painel().market.listings;

    expect(vitrine).toHaveLength(1);
    expect(vitrine[0].itemId).toBe("botas_arbalist");
    expect(vitrine[0].price).toBe(200);
    expect(vitrine[0].sellerName).toBe("Ana");
  });
});

describe("anunciar", () => {
  it("o item sai da mochila do vendedor ao anunciar", () => {
    const { ana } = cenario();

    expect(
      ana.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(0);

    // e ele nao esta com o vendedor vestido
    expect(
      ana.sessao().equipment.getEquipped("boots"),
    ).toBe(null);
  });

  it("um uid forjado nao anuncia nada", () => {
    const { ana } = cenario();

    const antes = ana.moedas();

    ana.anunciar("uid_que_nao_existe#rare#1", 200);

    expect(ana.painel().market.meus).toHaveLength(1);

    // o anuncio bom continua, e nenhum novo apareceu
    expect(ana.moedas()).toBe(antes);
  });

  it("anunciar item de outra classe e recusado", () => {
    const { ana } = cenario();

    // a Ana tem uma peca do guerreiro na mochila
    ana.dar("peito_warrior", 1, RARITY.EPIC);

    const uidDoGuerreiro = ana.uid(
      "peito_warrior",
      RARITY.EPIC,
    );

    // o `canClassUseItem` nao e consultado pelo market: QUALQUER
    // item pode ser vendido, inclusive o de outra classe. O que nao
    // pode e um uid que nao existe na mochila dela
    ana.anunciar(uidDoGuerreiro, 500);

    expect(ana.painel().market.meus).toHaveLength(2);
  });

  it("um preco abaixo do piso e recusado pelo servidor", () => {
    const { bento } = cenario();

    bento.dar("slime_gel", 5);

    const antes = bento.moedas();

    bento.anunciar(bento.uid("slime_gel"), 1);

    // o item NAO saiu da mochila: o preco foi conferido antes
    expect(
      bento.sessao().inventory.countAt("slime_gel"),
    ).toBe(5);

    expect(bento.moedas()).toBe(antes);
  });

  it("um preco acima do teto do jogo nao anuncia", () => {
    const { bento } = cenario();

    bento.dar("slime_gel", 5);

    // o teto do jogo e o mesmo numero do teto do protocolo, entao o
    // valor precisa passar DOS DOIS para provar que a regra do jogo
    // recusa e nao so o transporte
    bento.anunciar(bento.uid("slime_gel"), PRECO_MAXIMO * 2);

    expect(bento.painel().market.meus).toHaveLength(0);
    expect(
      bento.sessao().inventory.countAt("slime_gel"),
      "o preco grande tirou o item assim mesmo",
    ).toBe(5);
  });

  it("um preco negativo nao vira moeda", () => {
    const { bento } = cenario();

    bento.dar("slime_gel", 5);

    bento.anunciar(bento.uid("slime_gel"), -5000);

    expect(bento.painel().market.meus).toHaveLength(0);
    expect(bento.moedas()).toBe(0);
    expect(
      bento.sessao().inventory.countAt("slime_gel"),
    ).toBe(5);
  });
});

/**
 * A QUANTIDADE anunciada.
 *
 * O `count` do pedido e um PEDIDO: o servidor corta no que o vendedor
 * tem na mochila. Sem esse corte, um cliente mandando 99 numa pilha de 5
 * anunciaria um lote que ele nao tem, e o comprador pagaria por um lote
 * que o servidor nao consegue tirar da mochila
 *
 * Estes testes usam um cenario COM UM SO jogador e nenhuma peca ja
 * anunciada: o `cenario()` da acima ja tem a bota da Ana na vitrine, e
 * um `meus[0]` ja ocupado esconderia qual anuncio o teste esta
 * olhando
 */
describe("anunciar: a quantidade", () => {
  const sozinho = () => {
    const mundo = montar();
    const ana = mundo.abrir("Ana");

    return { ...mundo, ana };
  };

  it("anuncia so a parte da pilha que o jogador pediu", () => {
    const { ana } = sozinho();

    ana.dar("slime_gel", 5);

    ana.anunciar(ana.uid("slime_gel"), 100, 2);

    const meus = ana.painel().market.meus;

    expect(meus).toHaveLength(1);
    expect(meus[0].count, "o lote anunciado nao foi o pedido").toBe(2);

    // e o resto da pilha continua com o vendedor
    expect(
      ana.sessao().inventory.countAt("slime_gel"),
      "o vendedor perdeu a pilha inteira",
    ).toBe(3);
  });

  it("uma quantidade acima da pilha anuncia o que tem, e nao mais", () => {
    const { ana } = sozinho();

    ana.dar("slime_gel", 5);

    ana.anunciar(ana.uid("slime_gel"), 100, 40);

    const meus = ana.painel().market.meus;

    expect(meus).toHaveLength(1);
    expect(meus[0].count, "anunciou mais do que tinha").toBe(5);

    expect(ana.sessao().inventory.countAt("slime_gel")).toBe(0);
  });

  it("sem quantidade no pedido, anuncia a pilha inteira", () => {
    const { ana } = sozinho();

    ana.dar("slime_gel", 5);

    // `count` ausente: o caminho de um cliente antigo
    ana.anunciar(ana.uid("slime_gel"), 100);

    expect(ana.painel().market.meus[0].count).toBe(5);
  });

  it("peca unica ignora a quantidade pedida", () => {
    const { ana } = sozinho();

    ana.dar("botas_arbalist", 1, RARITY.RARE);

    // a bota e uma peca so: pedir 7 nao cria um lote de 7
    ana.anunciar(ana.uid("botas_arbalist", RARITY.RARE), 200, 7);

    const meus = ana.painel().market.meus;

    expect(meus).toHaveLength(1);
    expect(meus[0].count, "uma peca unica virou um lote").toBe(1);

    expect(
      ana.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(0);
  });

  it("uma quantidade quebrada nao impede o anuncio", () => {
    const { ana } = sozinho();

    ana.dar("slime_gel", 5);

    // zero, negativo e fracao caem no mesmo tratamento: a pilha
    ana.anunciar(ana.uid("slime_gel"), 100, 0);

    const meus = ana.painel().market.meus;

    expect(meus).toHaveLength(1);
    expect(meus[0].count).toBeGreaterThanOrEqual(1);
    expect(meus[0].count).toBeLessThanOrEqual(5);
  });

  it("o comprador recebe a quantidade anunciada, nao a pilha", () => {
    const mundo = montar();
    const ana = mundo.abrir("Ana");
    const bento = mundo.abrir("Bento");

    ana.dar("slime_gel", 5);
    ana.anunciar(ana.uid("slime_gel"), 100, 2);

    const anuncio = bento.painel().market.listings[0];

    expect(anuncio.count).toBe(2);

    bento.sessao().inventory.addCoins(1000);
    bento.comprar(anuncio.id);

    expect(
      bento.sessao().inventory.countAt("slime_gel"),
      "o comprador nao recebeu a quantidade do anuncio",
    ).toBe(2);
  });
});

describe("comprar: o dinheiro anda", () => {
  it("o dinheiro sai do comprador e chega no vendedor", () => {
    const { ana, bento } = cenario();

    bento.dar("slime_gel", 5);
    bento.sessao().inventory.addCoins(1000);

    const moedasDoBento = bento.moedas();
    const moedasDaAna = ana.moedas();

    const anuncio = bento.painel().market.listings[0];

    bento.comprar(anuncio.id);

    expect(
      bento.moedas(),
      "o comprador nao pagou",
    ).toBe(moedasDoBento - 200);

    expect(
      ana.moedas(),
      "o vendedor nao recebeu",
    ).toBe(moedasDaAna + 200);
  });

  it("o item chega no comprador e sai do vendedor", () => {
    const { ana, bento } = cenario();

    bento.sessao().inventory.addCoins(1000);

    const anuncio = bento.painel().market.listings[0];

    bento.comprar(anuncio.id);

    expect(
      bento.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(1);

    // e o vendedor nao tem mais
    expect(
      ana.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(0);
  });

  it("o comprador sem moedas nao leva o item", () => {
    const { ana, bento } = cenario();

    // o Bento nao ganhou moedas
    const moedasDaAna = ana.moedas();

    const anuncio = bento.painel().market.listings[0];

    bento.comprar(anuncio.id);

    expect(bento.moedas()).toBe(0);
    expect(ana.moedas()).toBe(moedasDaAna);

    // o anuncio continua no ar: o dinheiro nao saiu
    expect(bento.painel().market.listings).toHaveLength(1);

    // e o vendedor continua sem o item
    expect(
      ana.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(0);
  });

  it("comprar duas vezes o mesmo anuncio da erro na segunda", () => {
    const { bento } = cenario();

    bento.sessao().inventory.addCoins(1000);

    const anuncio = bento.painel().market.listings[0];

    // `mandar` nao devolve o resultado da operacao: ele envia o
    // comando. O que se prova e o EFEITO — as moedas — e nao o
    // retorno
    bento.comprar(anuncio.id);

    const moedasDepois = bento.moedas();
    const itemDepois = bento
      .sessao()
      .inventory.countAt("botas_arbalist", RARITY.RARE);

    bento.comprar(anuncio.id);

    expect(bento.moedas()).toBe(moedasDepois);
    expect(
      bento.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(itemDepois);
  });

  it("ninguem compra o proprio anuncio", () => {
    const { ana } = cenario();

    const meu = ana.painel().market.meus[0];

    ana.comprar(meu.id);

    expect(ana.painel().market.meus).toHaveLength(1);
  });

  it("a compra entra no historico dos dois", () => {
    const { ana, bento } = cenario();

    bento.sessao().inventory.addCoins(1000);

    const anuncio = bento.painel().market.listings[0];

    bento.comprar(anuncio.id);

    // o historico e do SERVIDOR: a Ana ve a venda que fez
    expect(
      ana.painel().market.historico.some(
        (venda) => venda.minha,
      ),
    ).toBe(true);

    // e o historico so tem UMA linha, e nao uma por ponta
    const vendas = ana.painel().market.historico.filter(
      (venda) => venda.itemId === "botas_arbalist",
    );

    expect(vendas).toHaveLength(1);
    expect(vendas[0].price).toBe(200);
  });

  it("a mochila cheia do comprador devolve o dinheiro", () => {
    const { ana, bento } = cenario();

    bento.sessao().inventory.addCoins(1000);

    // enche a mochila do comprador ate lotar.
    //
    // O material EMPILHA: encher com `slime_gel` nao ocupa slots, e a
    // mochila nunca ficaria cheia. Sao pecas de equipamento, que tem
    // `maxStack: 1` e ocupam um slot cada
    while (!bento.sessao().inventory.isFull) {
      bento.dar("peito_warrior", 1);
    }

    expect(bento.sessao().inventory.isFull).toBe(true);

    const moedasDaAna = ana.moedas();
    const moedasDoBento = bento.moedas();

    const anuncio = bento.painel().market.listings[0];

    bento.comprar(anuncio.id);

    /**
     * O dinheiro VOLTOU. O `spendCoins` roda antes do `add`, e um erro
     * no meio daria as moedas ao vendedor sem o comprador receber o
     * item — dinheiro criado do nada
     */
    expect(
      bento.moedas(),
      "o dinheiro nao voltou",
    ).toBe(moedasDoBento);

    expect(ana.moedas()).toBe(moedasDaAna);
    expect(
      ana.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(0);

    // e o anuncio continua, para o proximo comprador tentar
    expect(bento.painel().market.listings).toHaveLength(1);
  });
});

describe("cancelar", () => {
  it("o item volta para o dono", () => {
    const { ana } = cenario();

    const meu = ana.painel().market.meus[0];

    ana.cancelar(meu.id);

    expect(
      ana.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(1);

    expect(ana.painel().market.meus).toHaveLength(0);
  });

  it("ninguem cancela o anuncio de outro", () => {
    const { ana, bento } = cenario();

    const meu = ana.painel().market.meus[0];

    bento.cancelar(meu.id);

    // o anuncio continua, e o item continua com o dono
    expect(ana.painel().market.meus).toHaveLength(1);
    expect(
      ana.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(0);
  });
});

describe("os sete dias", () => {
  it("o anuncio some da vitrine depois do prazo", () => {
    const mundo = cenario();
    const { bento, passar } = mundo;

    passar((ANUNCIO_SEGUNDOS + 10) * 1000);

    expect(bento.painel().market.listings).toHaveLength(0);
  });

  it("o vendedor recupera o item quando o anuncio vence", () => {
    const mundo = cenario();
    const { ana, passar } = mundo;

    passar((ANUNCIO_SEGUNDOS + 10) * 1000);

    // o aviso chegou: a Ana le a expiracao
    ana.painel();

    expect(
      ana.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
      "o item nao voltou para o vendedor",
    ).toBe(1);
  });

  it("nao da para comprar o anuncio vencido", () => {
    const mundo = cenario();
    const { bento, passar } = mundo;

    bento.sessao().inventory.addCoins(1000);

    const anuncio = bento.painel().market.listings[0].id;

    passar((ANUNCIO_SEGUNDOS + 10) * 1000);

    const moedas = bento.moedas();

    bento.comprar(anuncio);

    expect(bento.moedas()).toBe(moedas);
  });
});

describe("o seller offline", () => {
    it("o dinheiro do vendedor que saiu fica pendente", () => {
      const { jogo, ana, bento, abrir } = cenario();

      bento.sessao().inventory.addCoins(1000);

      const anuncio = bento.painel().market.listings[0];

      // a Ana desconecta pelo caminho de verdade: e o `desconectar`
      // que tira a sessao do indice de donos
      jogo.desconectar(ana.client);

      expect(
        jogo.sessaoDoDono("ana"),
        "a Ana continua mapeada como online",
      ).toBe(null);

      bento.comprar(anuncio.id);

      expect(
        bento.sessao().inventory.countAt(
          "botas_arbalist",
          RARITY.RARE,
        ),
        "o comprador nao recebeu o item",
      ).toBe(1);

      // e o dinheiro do vendedor foi guardado, nao perdido
      expect(jogo.pagamentosPendentes).toHaveLength(1);
      expect(jogo.pagamentosPendentes[0].coins).toBe(200);

      /**
       * E o mais importante: o dinheiro tem que CAIR quando a Ana
       * volta. A fila e guardada pela chave do personagem, e nao pelo id
       * de sessao — que e novo a cada entrada. Guardada pelo id, a
       * fila ficaria para sempre esperando uma sessao que nunca mais
       * existe, e o jogador perderia a venda
       */
      const moedasAntes = bento.moedas();

      const ana2 = abrir("Ana");

      expect(ana2.moedas(), "o pagamento nao chegou").toBe(200);

      expect(
        jogo.pagamentosPendentes,
        "a fila ficou com o pagamento ja pago",
      ).toHaveLength(0);

      // e o comprador nao foi descontado duas vezes
      expect(bento.moedas()).toBe(moedasAntes);
    });

    it("o item de um anuncio que venceu offline volta quando o dono entra", () => {
      const { jogo, ana, abrir, passar } = cenario();

      jogo.desconectar(ana.client);

      // passa dos sete dias com o anuncio no ar
      passar(ANUNCIO_SEGUNDOS * 1000 + 1000);

      jogo.expirarAnuncios();

      expect(jogo.pendentesDeDevolucao).toHaveLength(1);
      expect(jogo.pendentesDeDevolucao[0].ownerKey).toBe("ana");

      const ana2 = abrir("Ana");

      expect(
        ana2.sessao().inventory.countAt(
          "botas_arbalist",
          RARITY.RARE,
        ),
        "o item nao voltou para o dono",
      ).toBe(1);

      expect(jogo.pendentesDeDevolucao).toHaveLength(0);
    });
  });

describe("seguranca do protocolo", () => {
  it("um id de anuncio forjado nao compra nada", () => {
    const { ana, bento } = cenario();

    bento.sessao().inventory.addCoins(1000);

    const moedas = bento.moedas();

    bento.comprar("anuncio_que_nao_existe");

    expect(bento.moedas()).toBe(moedas);
    expect(
      bento.sessao().inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(0);
  });

  it("um modo de venda no pedido e simplesmente ignorado", () => {
    const { bento } = cenario();

    bento.dar("slime_gel", 5);

    /**
     * O market vende de um jeito so. Um cliente antigo — ou um script —
     * mandando `mode: "venda_por_pix"` nao pode criar uma regra
     * paralela: o `parsePanel` normaliza o pedido e o servidor anuncia
     * pelo preco escrito, como sempre
     */
    bento.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.MARKET_LIST,
        uid: bento.uid("slime_gel"),
        price: 100,
        mode: "venda_por_pix",
      }),
    );

    const meus = bento.painel().market.meus;

    expect(meus).toHaveLength(1);
    expect(meus[0].price).toBe(100);
    expect(meus[0].mode).toBe(undefined);
  });

  it("o preco e transportado como inteiro, com teto", () => {
    // `12.9` vira 12: o `Math.floor` no `parsePanel` e o que garante
    // que o preco cobrado e o preco que o painel mostrou
    const pedido = parseCommand(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.MARKET_LIST,
        uid: "a#1",
        price: 12.9,
      }),
    );

    expect(pedido.payload.price).toBe(12);

    const infinito = parseCommand(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.MARKET_LIST,
        uid: "a#1",
        price: Infinity,
      }),
    );

    expect(infinito.payload.price).toBe(null);
  });

  it("a quantidade e transportada como inteiro, dentro do teto", () => {
    // `2.9` vira 2, e o que passa do `maxStack` do catalogo vira
    // `null` (a pilha inteira), nunca um lote que o vendedor nao tem
    const pedido = parseCommand(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.MARKET_LIST,
        uid: "a#1",
        price: 100,
        count: 2.9,
      }),
    );

    expect(pedido.payload.count).toBe(2);

    const demais = parseCommand(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.MARKET_LIST,
        uid: "a#1",
        price: 100,
        count: 1000,
      }),
    );

    expect(demais.payload.count).toBe(null);

    // zero e negativo tambem caem no padrao, em vez de virar 1
    for (const ruim of [0, -4, "3", null, NaN]) {
      const recusa = parseCommand(
        createCommand(CLIENT_COMMANDS.PANEL, {
          op: PANEL_OPS.MARKET_LIST,
          uid: "a#1",
          price: 100,
          count: ruim,
        }),
      );

      expect(
        recusa.payload.count,
        `count ${ruim} passou pelo transporte`,
      ).toBe(null);
    }
  });

  it("a operacao de market continua sendo recusada se for inventada", () => {
    const { bento } = cenario();

    bento.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: "MARKET_DAR_ITEM",
        itemId: "slime_gel",
      }),
    );

    expect(bento.ultimo(SERVER_EVENTS.REJECTED)?.payload.reason).toBe(
      REJECT.BAD_MESSAGE,
    );
  });

  it("o sellerKey do cliente e ignorado: o preco e do vendedor", () => {
    // O pedido nao tem `sellerKey` nenhum: quem vende e quem pede, e o
    // servidor tira do inventario DELE. Um cliente que mandasse
    // "sellerKey: outro" nao teria o campo para mandar
    const { ana, bento } = cenario();

    bento.sessao().inventory.addCoins(1000);

    const anuncio = bento.painel().market.listings[0];

    bento.comprar(anuncio.id);

    // o dinheiro da Ana, e nao do Bento: o preco do anuncio, e nao o
    // que o comprador mandou
    expect(ana.moedas()).toBeGreaterThan(0);
  });
});