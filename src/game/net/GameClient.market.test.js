import { describe, expect, it } from "vitest";
import { GameClient } from "./GameClient.js";
import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  SERVER_EVENTS,
  createEvent,
} from "../../shared/protocol.js";

/**
 * O que o cliente MANDA, e nao o que ele entende.
 *
 * O mercado tem um caminho longo entre a tela e o servidor: o painel
 * monta o pedido, o HUD repassa, o `useGameClient` embrulha e o
 * `GameClient` escreve no socket. Cada um desses e uma passagem que pode
 * esquecer um campo — e o campo esquecido nao da erro nenhum, o anuncio
 * simplesmente sai com a quantidade errada
 *
 * Aqui nao ha servidor: o socket e um duble que guarda o texto enviado,
 * que e exatamente o contrato do cliente
 */
class SocketFalso {
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    this.enviados = [];

    INSTANCIAS.push(this);
  }

  send(texto) {
    this.enviados.push(texto);
  }

  close() {
    this.readyState = 3;
  }
}

/** as instancias do duble, para o teste ler o que saiu */
const INSTANCIAS = [];

/**
 * Um cliente CONECTADO e JOGANDO.
 *
 * O `pedirPainel` so envia depois do WELCOME (`jogando()`), porque um
 * painel sem sessao seria recusado pelo servidor. Sem esse WELCOME o
 * comando ficaria na fila e o teste leria uma lista vazia — que e o
 * sintoma de "o cliente nao mandou nada", nao de "o campo sumiu"
 */
function clienteJogando() {
  const cliente = new GameClient({
    url: "ws://127.0.0.1:1/ws",
    WebSocketImpl: SocketFalso,
  });

  cliente.conectar();

  const socket = cliente.socket;

  // o socket abriu: a fila e despejada e o status vira CONECTADO
  socket.onopen?.();

  // o servidor aceitou a entrada
  socket.onmessage?.({
    data: JSON.stringify(
      createEvent(SERVER_EVENTS.WELCOME, {
        playerId: "p_teste",
        protocolVersion: 1,
        classId: "arbalist",
        tickRate: 20,
      }),
    ),
  });

  return cliente;
}

/** o comando mais recente de um `op`, ja desserializado */
function comandoDe(cliente, op) {
  const textos = INSTANCIAS.at(-1)?.enviados ?? [];

  for (let i = textos.length - 1; i >= 0; i -= 1) {
    const comando = JSON.parse(textos[i]);

    if (comando.payload?.op === op) return comando.payload;
  }

  return null;
}

describe("GameClient: o pedido do mercado", () => {
  it("a quantidade vai no comando", () => {
    const cliente = clienteJogando();

    cliente.listarNoMarket("slime_gel#common#1", 100, 3);

    const pedido = comandoDe(cliente, PANEL_OPS.MARKET_LIST);

    expect(pedido, "o pedido do market nao saiu").toBeTruthy();
    expect(pedido.count).toBe(3);
    expect(pedido.price).toBe(100);
    expect(pedido.uid).toBe("slime_gel#common#1");
  });

  it("sem quantidade, o campo vai nulo e o servidor usa a pilha", () => {
    const cliente = clienteJogando();

    cliente.listarNoMarket("botas_arbalist#rare#1", 200);

    const pedido = comandoDe(cliente, PANEL_OPS.MARKET_LIST);

    expect(pedido.count).toBe(null);
  });

  it("o pedido nao carrega mais o modo de venda", () => {
    const cliente = clienteJogando();

    cliente.listarNoMarket("slime_gel#common#1", 100, 1);

    const pedido = comandoDe(cliente, PANEL_OPS.MARKET_LIST);

    // o market tem uma regra so. um `mode` no comando seria um campo
    // que o servidor ignora, e um `undefined` aqui vira ausente no JSON
    expect("mode" in pedido).toBe(false);
  });

  it("comprar e cancelar seguem com o id do anuncio", () => {
    const cliente = clienteJogando();

    cliente.comprarNoMarket("a_1");
    cliente.cancelarNoMarket("a_1");

    expect(
      comandoDe(cliente, PANEL_OPS.MARKET_BUY).listingId,
    ).toBe("a_1");

    expect(
      comandoDe(cliente, PANEL_OPS.MARKET_CANCEL).listingId,
    ).toBe("a_1");
  });

  it("o comando sai com o tipo e a versao do protocolo", () => {
    const cliente = clienteJogando();

    cliente.listarNoMarket("slime_gel#common#1", 100, 1);

    const textos = INSTANCIAS.at(-1)?.enviados ?? [];

    expect(textos.length, "nada foi enviado").toBeGreaterThan(0);

    const comando = JSON.parse(textos.at(-1));

    expect(comando.type).toBe(CLIENT_COMMANDS.PANEL);
    expect(comando.protocolVersion).toBe(1);
  });
});