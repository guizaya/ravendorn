import { describe, expect, it, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { render, cleanup, act } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import HUD from "./HUD.jsx";
import GameCanvas from "../Game/GameCanvas.jsx";
import useGameClient from "../Game/useGameClient.js";
import { GameServer } from "../../../server/src/domain/GameServer.js";
import { Client } from "../../../server/src/domain/Client.js";
import { SERVER_CONFIG } from "../../../server/src/config.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";

/**
 * O BOTAO DO T, de ponta a ponta.
 *
 * Cada metade deste caminho ja tinha teste, e nenhuma pegou o
 * defeito: o teste do HUD usava um duble de intencao, e o teste do
 * servidor chamava `alternarAutoPlay()` na mao. O que faltava era o
 * MEIO: um clique de verdade num botao de verdade, passando pelo
 * `GameClient`, indo pelo socket e voltando como estado do servidor.
 *
 * E o que o jogador fez: clicou no ON/OFF do T com o auto da missao
 * ligado, e o personagem continuou indo para a zona.
 */
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const classe = CHARACTER_CLASSES.find((c) => c.id === "arbalist");

function instalarCanvasFalso() {
  const contexto = new Proxy(
    { createPattern: () => ({ pattern: true }) },
    {
      get(alvo, chave) {
        if (chave in alvo) return alvo[chave];
        return () => {};
      },
      set(alvo, chave, valor) {
        alvo[chave] = valor;
        return true;
      },
    },
  );

  HTMLCanvasElement.prototype.getContext = () => contexto;
  HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 1280,
    height: 720,
  });
}

let http;
let wss;
let jogo;
let porta;
let WebSocketOriginal;

async function subirServidor() {
  await new Promise((resolve) => {
    http = createServer();

    http.listen(0, "127.0.0.1", () => {
      porta = http.address().port;
      resolve();
    });
  });

  wss = new WebSocketServer({ server: http, path: "/ws" });

  /**
   * Este teste e de CAÇAR PERTO, entao o servidor roda no vale.
   *
   * O padrao e o hub, e o hub nao tem zona de mob. Sem o `mapId` o
   * piloto nao teria criatura nenhuma para escolher e o
   * `selectedTargetId` nunca viria
   */
  jogo = new GameServer({
    config: { ...SERVER_CONFIG },
    mapId: "map_1",
  });

  wss.on("connection", (socket) => {
    const client = new Client(socket);

    jogo.conectar(client);

    socket.on("message", (bruto) => {
      if (bruto.length > 8 * 1024) return;
      if (!client.limiter.permite()) return;

      jogo.receber(client, bruto.toString());
    });

    socket.on("close", () => jogo.desconectar(client));
  });

  jogo.start();

  // O `useGameClient` tira o endereco de `window.location`, que no
  // jsdom e o localhost do Vite e nao o servidor deste teste. Em vez
  // de abrir uma porta na producao so para o teste, o `WebSocket`
  // global e reescrito para apontar para a porta do servidor: e o
  // mesmo socket, com o endereco trocado.
  WebSocketOriginal = globalThis.WebSocket;

  globalThis.WebSocket = class extends WebSocketOriginal {
    constructor(url, protocolos) {
      super(
        String(url).replace(/^ws:\/\/[^/]+/, `ws://127.0.0.1:${porta}`),
        protocolos,
      );
    }
  };
}

async function derrubarServidor() {
  globalThis.WebSocket = WebSocketOriginal;

  jogo.stop();

  await new Promise((resolve) => {
    for (const socket of wss.clients) socket.terminate();
    wss.close(() => http.close(resolve));
  });
}

/**
 * A tela do jogo de verdade: um `useGameClient`, e o mesmo objeto
 * entregue ao canvas e ao HUD. E a montagem de `TestMapScene`.
 */
function Tela({ nome }) {
  const engineRef = useRef(null);
  const [estado, setEstado] = useState(null);

  const onState = useCallback((novo) => setEstado(novo), []);

  const rede = useGameClient({
    classDefinition: classe,
    characterName: nome,
    onState,
  });

  return (
    <>
      <GameCanvas
        classDefinition={classe}
        characterName={nome}
        engineRef={engineRef}
        estado={estado}
        onIntent={rede}
      />

      <HUD
        classDefinition={classe}
        characterName={nome}
        snapshot={estado?.painel ?? null}
        engineRef={engineRef}
        intencao={rede}
      />
    </>
  );
}

/**
 * Espera o primeiro painel chegar.
 *
 * Nao serve o `.hud-ability`: ele existe mesmo sem painel, porque o
 * HUD desenha os botoes antes de qualquer numero chegar. O que so
 * aparece com o painel e o tracker da missao.
 */
async function esperarOPainel(container) {
  /**
   * A ESPERA e pela LINHA da missao, e nao pelo cabecalho da box.
   *
   * O cabecalho (`Nv.3` e a barra de XP) e o que primeiro chega do
   * servidor: ele so depende do `player` do snapshot. A linha da missao
   * depende do `quests`, que vem no mesmo pacote mas e o que este teste
   * precisa
   *
   * Esperar pelo cabecalho funcionava por acaso, porque a box inteira
   * so aparecia quando havia missao — a box nunca some agora, e esperar
   * por ela deixaria o teste clicar antes do painel chegar
   */
  for (let i = 0; i < 120; i += 1) {
    if (container.querySelector(".qst-tracker__row")) return;
    await esperar(50);
  }

  throw new Error("a tela nao recebeu painel do servidor");
}

/** A sessao que o teste acabou de criar. */
const sessaoDesteTeste = () =>
  [...jogo.engine.world.players.values()].at(-1);

const esperarPor = async (condicao, tentativas = 120) => {
  for (let i = 0; i < tentativas; i += 1) {
    if (condicao()) return true;
    await esperar(50);
  }

  return false;
};

describe("o botao do T, do clique ate o servidor", () => {
  afterEach(async () => {
    cleanup();
    await derrubarServidor();
  });

  it("com a missao ligada, o botao do T troca para caÃ§ar perto", async () => {
    instalarCanvasFalso();
    await subirServidor();

    const { container } = render(
      <Tela nome={`Ana${Date.now() % 100000}`} />,
    );

    await esperarOPainel(container);

    // 1. o jogador liga o auto da MISSAO, pelo botao do painel
    await act(async () => {
      container.querySelector(".qst-tracker__head").click();
    });

    const botaoMissao = container.querySelector(".qst-auto");
    expect(botaoMissao).toBeTruthy();

    await act(async () => {
      botaoMissao.click();
    });

    expect(
      await esperarPor(() => sessaoDesteTeste().quests.autoEnabled),
    ).toBe(true);

    // 2. agora o jogador clica no ON/OFF do atalho T
    await act(async () => {
      container.querySelector(".hud-ability").click();
    });

    expect(
      await esperarPor(() => sessaoDesteTeste().autoPlay),
    ).toBe(true);

    // o ponto do relato: a missao SAI do comando. se ela ficasse,
    // o piloto continuaria puxando o personagem para a zona e o
    // botao pareceria estar "indo para a missao"
    expect(sessaoDesteTeste().quests.autoEnabled).toBe(false);
    expect(jogo.engine.getQuestObjective()).toBeNull();

    // 3. e o piloto escolhe uma CRIATURA, nao um waypoint de zona
    expect(
      await esperarPor(() => sessaoDesteTeste().selectedTargetId),
    ).toBe(true);

    const alvo = jogo.engine.findEnemyById(
      sessaoDesteTeste().selectedTargetId,
    );

    expect(alvo).toBeTruthy();
    expect(alvo.isCreature).toBe(true);

    // o personagem tem que estar perto do alvo, e nao a caminho da
    // zona da missao
    expect(
      Math.hypot(
        alvo.x - sessaoDesteTeste().player.x,
        alvo.y - sessaoDesteTeste().player.y,
      ),
    ).toBeLessThan(jogo.engine.autoLeashRange);
  });

  it("com DOIS jogadores, o botao do T so mexe em quem clicou", async () => {
    // O cenario real do jogador: dois navegadores no mesmo mundo.
    //
    // O `aplicarPainel` roda dentro de `withPlayer`, entao o estado
    // muda na sessao certa. Mas o `sendSnapshot` que o botao dispara
    // manda o painel para `clienteAtual`, que e o ULTIMO jogador que
    // recebeu painel - e nao o que pediu. Com dois jogadores, o
    // painel privado de um pode ir para o outro, e o HUD de quem
    // clicou fica mostrando o estado velho.
    instalarCanvasFalso();
    await subirServidor();

    const primeiro = render(<Tela nome={`Ana${Date.now() % 100000}`} />);

    await esperarOPainel(primeiro.container);

    // o segundo jogador entra e o ultimo painel vai para ele
    const segundo = render(
      <Tela nome={`Bento${Date.now() % 100000}`} />,
    );

    await esperarOPainel(segundo.container);

    for (let i = 0; i < 60 && jogo.engine.world.players.size < 2; i += 1) {
      await esperar(50);
    }

    expect(jogo.engine.world.players.size).toBe(2);

    const sessoes = [...jogo.engine.world.players.values()];

    // o jogador do primeiro navegador e o do segundo, por nome
    const ana = sessoes.find((s) => s.name.startsWith("Ana"));
    const bento = sessoes.find((s) => s.name.startsWith("Bento"));

    expect(ana).toBeTruthy();
    expect(bento).toBeTruthy();

    // a Ana liga o auto da missao
    await act(async () => {
      primeiro.container
        .querySelector(".qst-tracker__head")
        .click();
    });

    await act(async () => {
      primeiro.container.querySelector(".qst-auto").click();
    });

    expect(
      await esperarPor(() => ana.quests.autoEnabled),
    ).toBe(true);

    // e agora clica no botao do T
    await act(async () => {
      primeiro.container.querySelector(".hud-ability").click();
    });

    expect(
      await esperarPor(() => ana.autoPlay),
    ).toBe(true);

    expect(ana.quests.autoEnabled).toBe(false);
    expect(ana.bestiaryTargetType).toBeNull();

    // o Bento nao pode ter sido tocado: ele nao clicou em nada
    expect(bento.autoPlay).toBe(false);
    expect(bento.quests.autoEnabled).toBe(false);
    expect(bento.bestiaryTargetType).toBeNull();

    // e o painel que a Ana ve tem de ser o dela
    //
    // A espera aqui e pelo HUD, e nao so pelo servidor. O `autoPlay`
    // da sessao e a verdade do jogo, mas o que o jogador ve vem do
    // painel, que e enviado a 4 Hz: sem esperar, a afirmacao corria
    // antes do painel voltar e falhava de tempos em tempos conforme a
    // maquina estava ocupada
    expect(
      await esperarPor(() =>
        primeiro.container
          .querySelector(".hud-ability")
          .textContent.includes("AUTO"),
      ),
    ).toBe(true);

    // e o Bento nao pode ter recebido nada da Ana. o painel de
    // jogador e privado: o `aplicarPainel` responde para quem
    // PEDIU, e nao para o ultimo que recebeu painel
    //
    // Esta verificacao vem DEPOIS da anterior de proposito: quando a
    // Ana ja recebeu o painel dela, o Bento ter recebido o mesmo
    // texto seria a falha. Verificar antes daria tempo de sobra
    // demais para o bug aparecer
    expect(segundo.container.querySelector(".hud-ability").textContent)
      .not.toContain("AUTO");

    cleanup();
    segundo.unmount();
  });
});
