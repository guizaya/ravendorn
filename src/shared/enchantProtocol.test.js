import { describe, expect, it } from "vitest";

import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  PROTOCOL_VERSION,
  parseCommand,
} from "./protocol.js";
import { GameClient } from "../game/net/GameClient.js";

/**
 * O ENCHANTAR pela rede.
 *
 * Este `op` e o unico do painel que ROLDA em vez de mandar o
 * resultado, e e por isso que ele precisa de um teste proprio: um
 * cliente que mandasse o afixo escolhido escreveria o numero que
 * quisesse dentro do stat do jogador, e o `parsePanel` nao tem como
 * saber se aquilo saiu de um sorteio
 *
 * A regra que o `parsePanel` ja garante e que um `op` fora da lista e
 * recusado. `ENCHANT` entrou na lista, entao ele passa — e a lista e
 * unica fonte de verdade, nos dois lados do socket
 *
 * O teste entra por `parseCommand`, e nao pelo `parsePanel` direto:
 * o `parsePanel` e privado, e o caminho real e o envelope inteiro
 */

/** o envelope de um comando de painel, como o `GameClient` escreve */
const comandoPainel = (payload) => ({
  protocolVersion: PROTOCOL_VERSION,
  type: CLIENT_COMMANDS.PANEL,
  payload,
});

/** um cliente com o socket capturing, sem conectar de verdade */
function clienteCapturador() {
  const enviados = [];

  const cliente = Object.create(GameClient.prototype);

  cliente.envia = (tipo, payload) => {
    enviados.push({ tipo, payload });

    return true;
  };

  cliente.jogando = () => true;

  cliente.enviados = enviados;

  return cliente;
}

describe("o op de encantar no protocolo", () => {
  it("existe na lista de ops", () => {
    expect(PANEL_OPS.ENCHANT).toBe("ENCHANT");
  });

  it("e aceito pelo parsePanel com o uid", () => {
    const parsed = parseCommand(
      comandoPainel({
        op: PANEL_OPS.ENCHANT,
        uid: "willow_bow#rare#7",
      }),
    );

    expect(parsed.ok, parsed.reason).toBe(true);
    expect(parsed.payload.uid).toBe("willow_bow#rare#7");
    expect(parsed.payload.op).toBe(PANEL_OPS.ENCHANT);
  });

  it("e aceito pelo parsePanel com o slotId", () => {
    const parsed = parseCommand(
      comandoPainel({
        op: PANEL_OPS.ENCHANT,
        slotId: "chest",
      }),
    );

    expect(parsed.ok, parsed.reason).toBe(true);
    expect(parsed.payload.slotId).toBe("chest");
  });

  it("os dois campos passam pelo filtro, e a decisao fica no servidor", () => {
    /**
     * O `parsePanel` e um filtro de TIPOS, nao de combinacoes: ele
     * devolve os dois campos quando os dois vem preenchidos. Caber a
     * decisao de recusar o pedido ambiguo e do servidor, que e quem
     * sabe o que fazer com um `uid` e um `slotId` ao mesmo tempo
     */
    const parsed = parseCommand(
      comandoPainel({
        op: PANEL_OPS.ENCHANT,
        uid: "willow_bow#rare#7",
        slotId: "chest",
      }),
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.payload.uid).toBe("willow_bow#rare#7");
    expect(parsed.payload.slotId).toBe("chest");
  });

  it("recusa op desconhecido", () => {
    // o guarda que garante que o servidor nunca recebe um `op`
    // inventado. Sem ele, um cliente poderia chamar qualquer metodo do
    // motor pelo nome
    const parsed = parseCommand(
      comandoPainel({
        op: "ENCHANT_E_TUDO",
        uid: "x",
      }),
    );

    expect(parsed.ok).toBe(false);
  });

  it("recusa o uid forjado", () => {
    /**
     * O `uid` vem do cliente, entao ele precisa ser filtrado. Um
     * objeto no lugar do texto nao acharia pilha nenhuma no motor, mas
     * passaria adiante e quebraria o `findByUid`
     */
    const parsed = parseCommand(
      comandoPainel({
        op: PANEL_OPS.ENCHANT,
        uid: { itemId: "willow_bow" },
      }),
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.payload.uid).toBe(null);
  });
});

describe("o pedido do cliente", () => {
  it("manda o uid da peca da mochila", () => {
    const cliente = clienteCapturador();

    cliente.encantar({ uid: "willow_bow#rare#7" });

    expect(cliente.enviados).toHaveLength(1);

    const [mensagem] = cliente.enviados;

    expect(mensagem.tipo).toBe("PANEL");

    /**
     * E SO o endereco.
     *
     * Nenhum campo de afixo, nenhum campo de valor: se o cliente
     * mandasse o resultado, o servidor confiaria num numero que veio
     * da outra ponta do socket. O sorteio e do servidor
     */
    expect(Object.keys(mensagem.payload).sort()).toEqual([
      "op",
      "uid",
    ]);

    expect(mensagem.payload.op).toBe(PANEL_OPS.ENCHANT);
    expect(mensagem.payload.uid).toBe("willow_bow#rare#7");
  });

  it("manda o slotId da peca vestida", () => {
    const cliente = clienteCapturador();

    cliente.encantar({ slotId: "chest" });

    const [mensagem] = cliente.enviados;

    expect(Object.keys(mensagem.payload).sort()).toEqual([
      "op",
      "slotId",
    ]);

    expect(mensagem.payload.slotId).toBe("chest");
  });

  it("nunca manda os dois enderecos juntos", () => {
    /**
     * Um pedido com `uid` e `slotId` e AMBIGUO, e o servidor o recusa.
     * O cliente tambem nao monta um: mesmo que um chamador errado passe
     * os dois, so o slot vai, e o servidor encara um pedido valido em
     * vez de recusar
     */
    const cliente = clienteCapturador();

    cliente.encantar({ uid: "willow_bow#rare#7", slotId: "chest" });

    const [mensagem] = cliente.enviados;

    expect(mensagem.payload.slotId).toBe("chest");
    expect(mensagem.payload.uid).toBe(undefined);
  });

  it("nao manda nada sem alvo", () => {
    // nem `uid` nem `slotId`: nao ha peca para encantar, e mandar o
    // pedido assim seria deixar o servidor adivinhar
    const cliente = clienteCapturador();

    for (const alvo of [undefined, null, {}, { itemId: "willow_bow" }]) {
      expect(cliente.encantar(alvo), String(alvo)).toBe(false);
    }

    expect(cliente.enviados).toHaveLength(0);
  });

  it("nao manda nada antes de entrar", () => {
    // o mesmo de todas as acoes de painel: sem sessao nao ha a quem
    // pedir
    const cliente = Object.create(GameClient.prototype);

    cliente.envia = () => true;
    cliente.jogando = () => false;

    expect(cliente.encantar({ uid: "x" })).toBe(false);
  });
});