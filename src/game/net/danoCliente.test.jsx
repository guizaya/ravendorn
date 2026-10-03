import { describe, expect, it } from "vitest";
import { GameClient } from "./GameClient.js";
import {
  SERVER_EVENTS,
  createEvent,
} from "../../shared/protocol.js";

/**
 * O NUMERO DE DANO no cliente.
 *
 * Este arquivo existe por causa de um defeito que nenhum teste pegava:
 * o `GameClient.recebe` chamava `this.onDano?.(payload)`, mas o
 * construtor nunca guardava o `onDano`. O `?.` engolia o `undefined` e
 * o numero de dano sumia em silencio — sem erro no console, sem
 * warning, e com o servidor mandando o evento perfeito
 *
 * Um optional chaining que esconde um handler que nunca foi ligado e o
 * pior tipo de defeito: some sem deixar rastro. Por isso este arquivo
 * nao testa so o numero, testa que o CAMINHO esta ligado elo por elo
 */

const definicoes = {
  warrior: {
    id: "warrior",
    name: "Guerreiro",
    stats: { hp: 100, attack: 10, defense: 5, speed: 60, resource: 20, range: 40 },
    skills: [],
  },
};

/** o `GameClient` nunca desenhou nada; e so o canal do golpe */
function criarCliente(onDano) {
  return new GameClient({
    url: "ws://exemplo",
    WebSocketImpl: class {},
    onStatus: () => {},
    onState: () => {},
    onDano,
  });
}

describe("o cliente guarda o onDano", () => {
  /**
   * O elo que sumiu.
   *
   * Se esta linha voltar a faltar, o defeito reaparece inteiro e o
   * teste acima nao diria nada: o `?.` do `recebe` continuaria
   * engolindo o `undefined`
   */
  it("o construtor guarda a funcao", () => {
    const cliente = criarCliente(() => {});

    expect(typeof cliente.onDano).toBe("function");
  });

  it("o DAMAGE chega no callback", () => {
    const vistos = [];

    const cliente = criarCliente((dano) => vistos.push(dano));

    cliente.recebe(
      JSON.stringify(
        createEvent(SERVER_EVENTS.DAMAGE, {
          alvoId: "goblin_0",
          alvoSouJogador: false,
          amount: 93,
          critical: false,
          missed: false,
          damageType: "physical",
        }),
      ),
    );

    expect(vistos).toHaveLength(1);
    expect(vistos[0]).toMatchObject({ amount: 93, alvoId: "goblin_0" });
  });

  it("o DAMAGE nao entra no estado da tela", () => {
    /**
     * Um golpe e um INSTANTE.
     *
     * Se viesse pelo `onState`, ele re-renderizaria o React inteiro a
     * cada golpe, e o numero nasceria depois do render — meio segundo
     * depois do mob ter andado longe
     */
    let estados = 0;

    const cliente = new GameClient({
      url: "ws://exemplo",
      WebSocketImpl: class {},
      onStatus: () => {},
      onState: () => {
        estados += 1;
      },
      onDano: () => {},
    });

    cliente.recebe(
      JSON.stringify(
        createEvent(SERVER_EVENTS.DAMAGE, {
          alvoId: "goblin_0",
          alvoSouJogador: false,
          amount: 10,
          critical: false,
          missed: false,
          damageType: "physical",
        }),
      ),
    );

    expect(estados, "o golpe passou pelo onState").toBe(0);
  });

  it("o cliente sem onDano nao estoura ao receber DAMAGE", () => {
    const cliente = criarCliente();

    cliente.onDano = undefined;

    expect(() =>
      cliente.recebe(
        JSON.stringify(
          createEvent(SERVER_EVENTS.DAMAGE, {
            amount: 1,
            missed: false,
          }),
        ),
      ),
    ).not.toThrow();
  });
});
