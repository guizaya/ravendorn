import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";

/**
 * O ANUNCIO pelo caminho de verdade: socket de verdade.
 *
 * Os outros testes do mercado montam o comando na mao, com o `Client` e
 * um socket de mentira. Este sobe o `index.js` de verdade — HTTP, WebSocket,
 * o `GameClient` que a tela usa — e pergunta a coisa que o jogador
 * perguntaria: o item que o PAINEL mostrou e o que o SERVIDOR aceita?
 *
 * A diferenca importa porque cada camada normaliza o pedido: o
 * `GameClient` monta o comando, o `parsePanel` valida campo por campo e o
 * servidor decide contra o inventario. Um `uid` que se perca em qualquer
 * uma delas chega intacto no teste de cima e produce "Voce nao tem esse
 * item" na tela
 */
let http;
let wss;
let jogo;
let porta;

const esperar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  await new Promise((resolve) => {
    http = createServer();

    http.listen(0, "127.0.0.1", () => {
      porta = http.address().port;
      resolve();
    });
  });

  wss = new WebSocketServer({ server: http, path: "/ws" });

  jogo = new GameServer({ config: { ...SERVER_CONFIG } });

  // o mesmo encadeamento do `server/src/index.js`
  wss.on("connection", (socket) => {
    const client = new Client(socket);

    jogo.conectar(client);

    socket.on("message", (bruto, isBinary) => {
      if (isBinary) return;

      jogo.receber(client, bruto.toString());
    });

    socket.on("close", () => jogo.desconectar(client));
  });

  jogo.start();
});

afterAll(async () => {
  jogo.stop();

  await new Promise((resolve) => {
    for (const socket of wss.clients) socket.terminate();
    wss.close(() => http.close(resolve));
  });
});

/**
 * Os clientes criados no teste, para sair no fim.
 *
 * Sem isso o segundo teste tentaria entrar com o mesmo nome do primeiro,
 * que ainda esta online: o servidor recusa nome repetido (ele e o
 * identificador do save e da propriedade no mercado) e o teste falharia
 * por um motivo que nao tem nada a ver com o que ele verifica
 */
const CONECTADOS = new Set();

afterEach(() => {
  for (const cliente of CONECTADOS) {
    try {
      cliente.desconectar();
    } catch {
      // o socket ja estava fechando
    }
  }

  CONECTADOS.clear();
});

async function entrarEVerMochila(nome) {
  const cliente = new GameClient({
    url: `ws://127.0.0.1:${porta}/ws`,
    WebSocketImpl: WebSocket,
  });

  CONECTADOS.add(cliente);

  cliente.conectar();
  cliente.entrar({ name: nome, classId: "arbalist" });

  for (let i = 0; i < 200; i += 1) {
    if (cliente.jogando() && cliente.painel) break;

    await esperar(25);
  }

  expect(cliente.jogando(), `${nome} nao entrou`).toBe(true);

  // um personagem novo nasce com a mochila vazia: o teste precisa de um
  // item de verdade, como o jogador que esta ha tempo caçando
  const sessao = jogo.sessaoDe(cliente.playerId);

  sessao.inventory.add("slime_gel", 7);
  sessao.inventory.add("capuz_arbalist", 1, "rare");

  // o painel chega a 4Hz
  for (let i = 0; i < 80; i += 1) {
    if ((cliente.painel?.inventory?.items ?? []).length >= 2) break;

    await esperar(25);
  }

  return cliente;
}

/** espera o anuncio aparecer no painel de quem pediu */
async function esperarAnuncio(cliente, tentativas = 80) {
  for (let i = 0; i < tentativas; i += 1) {
    const meus = cliente.painel?.market?.meus ?? [];

    if (meus.length > 0) return meus[0];

    await esperar(25);
  }

  return null;
}

describe("anunciar pelo caminho da tela", () => {
  it("o item que o painel mostra e o que o servidor aceita", { timeout: 30000 }, async () => {
    const ana = await entrarEVerMochila("Ana");

    const item = ana.painel.inventory.items[0];

    expect(item, "o painel nao trouxe a mochila").toBeTruthy();

    // o que a tela faz ao clicar em "Anunciar"
    ana.listarNoMarket(item.uid, 120, 3);

    const anuncio = await esperarAnuncio(ana);

    expect(
      anuncio,
      `anunciar falhou: ${JSON.stringify(ana.painel?.message)}`,
    ).toBeTruthy();

    expect(anuncio.itemId).toBe("slime_gel");
    expect(anuncio.count).toBe(3);
    expect(anuncio.price).toBe(120);

    // a pilha perdeu SO a parte anunciada
    expect(
      jogo.sessaoDe(ana.playerId).inventory.countAt("slime_gel"),
      "o vendedor perdeu a pilha inteira",
    ).toBe(4);
  });

  it("o item comprado chega com a quantidade anunciada", { timeout: 30000 }, async () => {
    const ana = await entrarEVerMochila("Ana");
    const bento = await entrarEVerMochila("Bento");

    const item = ana.painel.inventory.items[0];

    ana.listarNoMarket(item.uid, 120, 3);

    const anuncio = await esperarAnuncio(ana);

    expect(anuncio, "o vendedor nao conseguiu anunciar").toBeTruthy();

    // o comprador precisa ver o anuncio na vitrine e ter moedas
    for (let i = 0; i < 80; i += 1) {
      if ((bento.painel?.market?.listings ?? []).length > 0) break;

      await esperar(25);
    }

    const naVitrine = (bento.painel?.market?.listings ?? [])[0];

    expect(
      naVitrine,
      `o anuncio nao apareceu na vitrine: ${JSON.stringify(bento.painel?.message)}`,
    ).toBeTruthy();

    expect(naVitrine.count).toBe(3);

    jogo.sessaoDe(bento.playerId).inventory.addCoins(500);

    /**
     * A conta e o DELTA, e nao o valor final: o comprador ja saiu do
     * setup com 7 de gel, entao esperar "tem mais de zero" passaria
     * antes mesmo da compra e o teste diria que o item chegou sem que
     * ele tivesse chegado
     */
    const antes = jogo
      .sessaoDe(bento.playerId)
      .inventory.countAt("slime_gel");

    bento.comprarNoMarket(naVitrine.id);

    for (let i = 0; i < 80; i += 1) {
      if (
        jogo
          .sessaoDe(bento.playerId)
          .inventory.countAt("slime_gel") > antes
      ) {
        break;
      }

      await esperar(25);
    }

    expect(
      jogo.sessaoDe(bento.playerId).inventory.countAt("slime_gel"),
      "o comprador nao recebeu a quantidade do anuncio",
    ).toBe(antes + 3);

    // e o vendedor recebeu o dinheiro
    expect(
      jogo.sessaoDe(ana.playerId).inventory.coins,
      "o vendedor nao recebeu",
    ).toBeGreaterThanOrEqual(120);
  });

  it("a peca unica vai como uma peca so, mesmo pedindo quantidade", { timeout: 30000 }, async () => {
    const ana = await entrarEVerMochila("Cacadora");

    const bota = ana.painel.inventory.items.find(
      (i) => i.itemId === "capuz_arbalist",
    );

    expect(bota, "a bota nao esta na mochila").toBeTruthy();

    // um cliente forjado pedindo 7 copias de uma peca unica
    ana.listarNoMarket(bota.uid, 300, 7);

    const anuncio = await esperarAnuncio(ana);

    expect(
      anuncio,
      `anunciar falhou: ${JSON.stringify(ana.painel?.message)}`,
    ).toBeTruthy();

    expect(anuncio.count).toBe(1);
  });
});