import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import { useEffect, useRef } from "react";
import { readFileSync } from "node:fs";
import useGameClient, {
  urlDoServidor,
} from "./useGameClient.js";
import { STATUS, GameClient } from "../../game/net/GameClient.js";

/**
 * Um WebSocket falso que registra o que o cliente mandou e
 * deixa o teste responder na mao.
 *
 * Um socket de mentira e melhor que mock de modulo aqui: o
 * `GameClient` roda de verdade, com o JSON de verdade, e o que
 * se testa e o que a TELA mostra, nao se o mock foi chamado.
 */
class SocketFalso {
  static instancias = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.enviados = [];
    SocketFalso.instancias.push(this);
  }

  abrir() {
    this.readyState = 1;
    this.onopen?.();
  }

  send(texto) {
    this.enviados.push(JSON.parse(texto));
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  /** O "servidor" responde. */
  responder(tipo, payload) {
    this.onmessage?.({
      data: JSON.stringify({
        protocolVersion: 1,
        type: tipo,
        payload,
      }),
    });
  }

  ultimo(tipo) {
    for (let i = this.enviados.length - 1; i >= 0; i -= 1) {
      if (this.enviados[i].type === tipo) return this.enviados[i];
    }

    return null;
  }
}

beforeEach(() => {
  SocketFalso.instancias = [];
  vi.stubGlobal("WebSocket", SocketFalso);
});

// o vitest deste projeto nao tem `globals`, entao o cleanup
// automatico do testing-library nao roda. sem ele, a tela de um
// teste fica no documento do seguinte e o `getByText` acha
// varios botoes com o mesmo nome
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Monta a hook e devolve os atalhos que a tela usaria. */
function montar({ nome = "Ana", classe = { id: "warrior" } } = {}) {
  const visto = { status: [], estado: null };

  function Tela() {
    const {
      status,
      mensagem,
      erro,
      jogando,
      tecla,
      atacar,
      entregarColecao,
    } = useGameClient({
      classDefinition: classe,
      characterName: nome,
      onState: (e) => {
        visto.estado = e;
      },
    });

    visto.status.push(status);

    return (
      <div>
        <p data-testid="mensagem">{mensagem}</p>
        <p data-testid="jogando">{String(jogando)}</p>
        {erro ? <p data-testid="erro">{erro}</p> : null}
        <button onClick={() => tecla("KeyD", true)}>andar</button>
        <button onClick={() => tecla("KeyD", false)}>parar</button>
        <button onClick={() => atacar("slime_0")}>atacar</button>

        {/*
          O botao da entrega existe para o teste do caminho INTEIRO
          passar pela hook de verdade. Com um duble aqui dentro, o
          teste passaria com o nome do metodo errado — que e
          exatamente o defeito que o teste abaixo caça
        */}
        <button onClick={() => entregarColecao("col_cacos")}>
          entregar
        </button>
      </div>
    );
  }

  const utils = render(<Tela />);

  return { ...utils, visto, socket: () => SocketFalso.instancias.at(-1) };
}

/** Deixa o React processar os efeitos. */
async function subir() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("o endereco do servidor", () => {
  it("usa o mesmo host da pagina em dev", () => {
    // o Vite faz proxy de /ws. se o cliente apontasse para
    // outra porta, o dev quebraria com a API respondendo normal
    expect(urlDoServidor()).toMatch(/^ws:\/\/.*\/ws$/);
  });
});

describe("a tela enquanto conecta", () => {
  it("comeca conectando e mostra que algo esta acontecendo", async () => {
    montar();

    // sem esta mensagem, o jogador clica em Jogar e ve uma tela
    // preta sem nenhuma explicacao
    expect(screen.getByTestId("mensagem").textContent).toMatch(
      /Entrando no mundo/i,
    );
    expect(screen.getByTestId("jogando").textContent).toBe("false");
  });

  it("o socket so abre depois que a tela monta", () => {
    montar();

    // o socket e criado no efeito, nunca durante o render: criar
    // conexao enquanto renderiza faria a tela abrir duas
    // conexoes em modo estrito
    expect(SocketFalso.instancias).toHaveLength(1);
    expect(SocketFalso.instancias[0].readyState).toBe(0);
  });
});

describe("a tela depois do WELCOME", () => {
  it("manda o nome e a classe escolhidos", () => {
    montar({ nome: "Ana", classe: { id: "sorcerer" } });

    const socket = SocketFalso.instancias[0];
    socket.abrir();

    // o JOIN fica na fila ate o socket abrir, e sai na hora
    const join = socket.ultimo("JOIN");

    expect(join).toBeTruthy();
    expect(join.payload.name).toBe("Ana");
    expect(join.payload.classId).toBe("sorcerer");
  });

  it("vira jogando quando o WELCOME chega", async () => {
    montar();

    const socket = SocketFalso.instancias[0];

    await act(async () => {
      socket.abrir();
      socket.responder(SERVER_WELCOME(), {
        playerId: "p_abc",
        protocolVersion: 1,
        classId: "warrior",
        tickRate: 20,
      });
    });

    expect(screen.getByTestId("jogando").textContent).toBe("true");
  });

  it("mostra o mundo assim que o primeiro snapshot chega", async () => {
    const { visto } = montar();

    const socket = SocketFalso.instancias[0];

    await act(async () => {
      socket.abrir();
      socket.responder(SERVER_WELCOME(), {
        playerId: "p_abc",
        protocolVersion: 1,
      });

      socket.responder("SNAPSHOT", {
        seq: 1,
        time: 0.05,
        players: [{ id: "p_abc", name: "Ana", x: 10, y: 20, hp: 100, maxHp: 100 }],
        enemies: [{ id: "slime_0", x: 50, y: 60, hp: 5, maxHp: 10, state: "idle" }],
        drops: [],
      });
    });

    expect(visto.estado).toBeTruthy();
    expect(visto.estado.eu.id).toBe("p_abc");
    expect(visto.estado.inimigos).toHaveLength(1);
  });
});

describe("a tela quando da errado", () => {
  it("mostra o motivo da recusa", async () => {
    montar({ nome: "A" });

    const socket = SocketFalso.instancias[0];

    await act(async () => {
      socket.abrir();
      socket.responder("REJECTED", {
        reason: "Esse nome e muito curto.",
      });
    });

    // o jogador precisa saber O QUE aconteceu, nao so que
    // "algo" deu errado
    expect(screen.getByTestId("mensagem").textContent).toMatch(
      /nao serviu/i,
    );
  });

  it("avisa quando a conexao cai", async () => {
    montar();

    const socket = SocketFalso.instancias[0];

    await act(async () => {
      socket.abrir();
      socket.responder(SERVER_WELCOME(), {
        playerId: "p_abc",
        protocolVersion: 1,
      });
    });

    await act(async () => {
      socket.readyState = 3;
      socket.onclose?.();
    });

    expect(screen.getByTestId("jogando").textContent).toBe("false");
  });
});

describe("a tela passa o comando para o servidor", () => {
  it("andar vira um pacote de intencao", async () => {
    const { socket } = montar();

    await act(async () => {
      socket().abrir();
      socket().responder(SERVER_WELCOME(), {
        playerId: "p_abc",
        protocolVersion: 1,
      });
    });

    await act(async () => {
      screen.getByText("andar").click();
    });

    const input = socket().ultimo("INPUT");

    // e um VETOR, e nao uma posicao. o servidor decide o quanto
    expect(input).toBeTruthy();
    expect(input.payload.moveX).toBe(1);
    expect(input.payload.x).toBeUndefined();
  });

  it("atacar vira um pacote de acao", async () => {
    const { socket } = montar();

    await act(async () => {
      socket().abrir();
      socket().responder(SERVER_WELCOME(), {
        playerId: "p_abc",
        protocolVersion: 1,
      });
    });

    await act(async () => {
      screen.getByText("atacar").click();
    });

    const acao = socket().ultimo("ACTION");

    expect(acao.payload.action).toBe("BASIC_ATTACK");
    expect(acao.payload.targetId).toBe("slime_0");
  });

  it("nao manda nada antes de ter sessao", () => {
    const { socket } = montar();

    // clicar em andar antes do WELCOME geraria um INPUT sem dono,
    // que o servidor recusa
    screen.getByText("andar").click();

    expect(socket().ultimo("INPUT")).toBe(null);
  });
});

/**
 * TODO METODO chamado nao existe no `GameClient` de verdade.
 *
 * Este e o teste que impede a entrega de colecao de quebrar em
 * silencio de novo.
 *
 * O defeito: `useGameClient` chamava `cliente.entregarColecao()`, e o
 * `GameClient` de verdade respondia a `deliverCollection`. O clique
 * chamava `undefined`, o `comCliente` engolia o `TypeError` no `catch`
 * que existe para o socket morto, e nada saia — nem pacote, nem aviso.
 * O offline funcionava porque ele vai pelo motor, nao pela rede, entao
 * o bug so aparecia online
 *
 * Por que os testes nao pegaram: o duble do `intencao` no teste da
 * HUD era escrito com o nome que o AUTOR do teste imaginava. Um duble
 * concorda com quem o escreve, entao ele nunca discorda do
 * `GameClient` — e o teste passa asserting o que ele mesmo inventou
 *
 * O contrato testado aqui e a CHAMADA, e nao o nome: o wrapper se
 * chama `atacar` e chama `c.atacarAlvo`, que estao certos e nao tem
 * o mesmo nome. Comparar nome a nome acusaria esses seis falsos. O que
 * nao pode existir e um `c.algoQueNaoExiste`
 */
describe("o objeto de intencao bate com o GameClient", () => {
  /**
   * O fonte da hook.
   *
   * Lido por caminho RELATIVO ao pacote de teste, e nao por
   * `import.meta.url`: o Vite reescreve o `import.meta.url` para uma
   * URL que o `fs` nao abre no ambiente de jsdom
   */
  const fonteDaHook = () =>
    readFileSync(
      "src/components/Game/useGameClient.js",
      "utf8",
    );

  /** o fonte do HUD, pelo mesmo caminho relativo da hook */
  const fonteDoHud = () =>
    readFileSync("src/components/HUD/HUD.jsx", "utf8");

  const metodos = () => {
    const nomes = new Set();

    let alvo = GameClient.prototype;

    while (alvo && alvo !== Object.prototype) {
      for (const nome of Object.getOwnPropertyNames(alvo)) {
        nomes.add(nome);
      }

      alvo = Object.getPrototypeOf(alvo);
    }

    return nomes;
  };

  it("todo metodo chamado em `c.` existe no GameClient", () => {
    const fonte = fonteDaHook();

    /**
     * As chamadas da hook sao todas `comCliente((c) => c.algo(...))`.
     * Extrair do FONTE e o que impede o teste de passar com duble: o
     * nome vem do codigo que roda no jogo, nao de uma lista escrita
     * aqui que poderia divergir sem ninguem perceber
     */
    const chamadas = [
      ...fonte.matchAll(/\bc\.([a-zA-Z]\w*)\s*\(/g),
    ].map((m) => m[1]);

    const existentes = metodos();

    const faltando = [
      ...new Set(chamadas.filter((nome) => !existentes.has(nome))),
    ];

    expect(
      faltando,
      "a hook chama metodos que o GameClient nao tem: o clique " +
        "vira TypeError e o comCliente engole o erro em silencio, " +
        "e a acao simplesmente nao acontece",
    ).toEqual([]);
  });

  it("a hook realmente chama alguma coisa", () => {
    // Se um dia o `matchAll` nao encontrar nada, o teste acima passa
    // por vacuidade e para de proteger qualquer coisa
    expect(
      [
        ...fonteDaHook().matchAll(/\bc\.([a-zA-Z]\w*)\s*\(/g),
      ].length,
      "a extracao das chamadas nao achou nada: o teste acima esta " +
        "passando por vacuidade",
    ).toBeGreaterThan(20);
  });

  it("todo metodo que o HUD pede para a intencao existe no objeto da hook", () => {
    /**
     * O MESMO contrato, do outro lado da ponte.
     *
     * O teste acima pega `hook -> GameClient`. Este pega
     * `HUD -> hook`, e ele existe porque o nome do wrapper e o do
     * metodo divergem o tempo todo: `atacar` chama `c.atacarAlvo`,
     * `handleTravelPortal` chama `intencao.atravessarPortal`. E
     * facil escrever o nome do wrapper em vez do metodo
     *
     * O preco de errar aqui e silencioso: um `intencao.algoQueNaoExiste`
     * levanta `TypeError` DENTRO do handler do React, o erro so aparece
     * no console, e o clique simplesmente nao faz nada. Foi exatamente
     * o que aconteceu com o botao do portal
     */
    const nomesDaHook = new Set([
      ...readFileSync(
        "src/components/Game/useGameClient.js",
        "utf8",
      ).matchAll(/^\s{2,4}([a-zA-Z]\w*),?\r?$/gm),
    ].map((m) => m[1]));

    const chamadas = [
      ...fonteDoHud().matchAll(/\bintencao\.([a-zA-Z]\w*)\s*\(/g),
    ].map((m) => m[1]);

    const faltando = [
      ...new Set(chamadas.filter((nome) => !nomesDaHook.has(nome))),
    ];

    expect(
      faltando,
      "o HUD pede para a intencao metodos que a hook nao entrega: o " +
        "clique levanta TypeError dentro do handler do React e nao " +
        "faz nada, sem erro na tela",
    ).toEqual([]);
  });

  it("a extracao dos metodos da hook nao passou por vacuidade", () => {
    /**
     * O teste acima passa de vacuidade se o padrao deixar de achar
     * metodos — e a falha apareceria como "nada faltando", que e o
     * resultado errado
     */
    const nomes = [
      ...readFileSync(
        "src/components/Game/useGameClient.js",
        "utf8",
      ).matchAll(/^\s{2,4}([a-zA-Z]\w*),?\r?$/gm),
    ];

    expect(
      nomes.length,
      "a extracao dos metodos da hook nao achou nada",
    ).toBeGreaterThan(20);

    // e o HUD realmente pede alguma coisa
    const chamadas = [
      ...readFileSync(
        "src/components/HUD/HUD.jsx",
        "utf8",
      ).matchAll(/\bintencao\.([a-zA-Z]\w*)\s*\(/g),
    ];

    expect(
      chamadas.length,
      "o HUD nao pede nada para a intencao: o teste acima esta " +
        "passando por vacuidade",
    ).toBeGreaterThan(5);
  });

  it("o metodo da entrega existe com o nome que a tela chama", () => {
    // o caso concreto, nome a nome, para a falha dizer O QUE quebrou
    // em vez de dizer so "faltou um metodo"
    expect(
      typeof GameClient.prototype.entregarColecao,
      "entregarColecao nao existe no GameClient",
    ).toBe("function");

    expect(
      typeof GameClient.prototype.deliverCollection,
      "deliverCollection ainda existe: se sobrou ele, existe para " +
        "ninguem chamar — foi codigo morto que escondeu o defeito",
    ).toBe("undefined");
  });
});

describe("a entrega de colecao vira pacote de painel", () => {
  it("o clique na tela vira um DELIVER_COLLECTION com o id", async () => {
    // o caminho INTEIRO, com o `GameClient` de verdade sobre um socket
    // falso: e o unico teste que pega um nome de metodo errado, porque
    // nao passa por duble nenhum
    const { socket } = montar();

    await act(async () => {
      socket().abrir();
      socket().responder(SERVER_WELCOME(), {
        playerId: "p_abc",
        protocolVersion: 1,
      });
    });

    await act(async () => {
      screen.getByText("entregar").click();
    });

    const painel = socket().ultimo("PANEL");

    expect(painel, "o clique nao virou pacote de painel").toBeTruthy();
    expect(painel.payload.op).toBe("DELIVER_COLLECTION");
    expect(painel.payload.collectionId).toBe("col_cacos");
  });
});

describe("sair da tela", () => {
  it("fecha o socket", async () => {
    const { unmount } = montar();

    const socket = SocketFalso.instancias[0];
    socket.abrir();

    // sem o close, o servidor continuaria contando este jogador
    // e o personagem dele andaria sozinho no mapa
    await act(async () => {
      unmount();
    });

    expect(socket.readyState).toBe(3);
  });

  it("nao abre duas conexoes quando a tela re-renderiza", () => {
    const { rerender } = montar();

    rerender(<div>outra coisa</div>);

    // se o efeito dependesse de um objeto recriado a cada render,
    // a tela abriria um socket por frame e inundaria o servidor
    expect(SocketFalso.instancias).toHaveLength(1);
  });
});

/** O WELCOME com o payload minimo que o cliente le. */
function SERVER_WELCOME() {
  return "WELCOME";
}
