import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";
import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  createCommand,
} from "../../src/shared/protocol.js";
import { CHARACTER_CLASSES } from "../../src/data/characters/index.js";

/**
 * A skill em automatico e ESTADO PRIVADO de cada jogador.
 *
 * O sintoma reportado era visual: arrastar a skill para baixo
 * funcionava, mas o HUD nao acendia o `AUTO`. Debaixo disso havia
 * dois problemas, e o primeiro era pior que o que se via.
 *
 * As flags viviam num `Map` de modulo, e no servidor um `Map` de
 * modulo e de TODO MUNDO: arrastar uma skill na Ana ligava o
 * automatico daquela skill para o Bento tambem. O automatico
 * "funcionava" justamente porque estava vazado.
 *
 * E o HUD nunca escrevia nesse store quando online: o clique
 * virava pedido e o `return` saia antes de atualizar o estado
 * local. O painel, que era a fonte da verdade, nem carregava as
 * flags.
 */
let http;
let wss;
let jogo;
let porta;

beforeEach(async () => {
  await new Promise((resolve) => {
    http = createServer();

    http.listen(0, "127.0.0.1", () => {
      porta = http.address().port;
      resolve();
    });
  });

  wss = new WebSocketServer({ server: http, path: "/ws" });
  jogo = new GameServer({ config: { ...SERVER_CONFIG } });

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
});

afterEach(async () => {
  jogo.stop();

  await new Promise((resolve) => {
    for (const socket of wss.clients) socket.terminate();
    wss.close(() => http.close(resolve));
  });
});

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function criarCliente() {
  const cliente = new GameClient({
    url: `ws://127.0.0.1:${porta}/ws`,
    WebSocketImpl: WebSocket,
  });

  cliente.conectar();

  return cliente;
}

async function entrar(cliente, nome, classId) {
  cliente.entrar({ name: nome, classId });

  for (let i = 0; i < 100 && !cliente.jogando(); i += 1) {
    await esperar(25);
  }

  expect(cliente.jogando()).toBe(true);

  return cliente;
}

/** Liga o automatico de uma skill direto no servidor. */
function marcarAuto(sessao, skillId, ativo) {
  const duble = new Client({ readyState: 1, send: () => {} });

  duble.session = sessao;
  duble.joined = true;

  jogo.receber(
    duble,
    JSON.stringify(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.SET_SKILL_AUTO,
        skillId,
        ativo,
      }),
    ),
  );
}

describe("o automatico de skill e de cada jogador", () => {
  it("a skill arrastada da Ana nao vira automatica para o Bento", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "arbalist");

    const bento = criarCliente();
    await entrar(bento, "Bento", "arbalist");

    const sessoes = [...jogo.engine.world.players.values()];
    const sessaoAna = sessoes.find((s) => s.name === "Ana");
    const sessaoBento = sessoes.find((s) => s.name === "Bento");

    const skill = sessaoAna.classDefinition.skills[0];

    marcarAuto(sessaoAna, skill.id, true);

    // o automatico e DA ANA
    expect(sessaoAna.skillAuto.has(skill.id)).toBe(true);

    // e o Bento continua no manual. antes these flags eram um
    // `Map` de modulo e o Bento ligava junto
    expect(sessaoBento.skillAuto.has(skill.id)).toBe(false);

    ana.desconectar();
    bento.desconectar();
  });

  it("o painel devolve as flags, que e o que o HUD desenha", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "arbalist");

    const sessao = [...jogo.engine.world.players.values()].at(-1);
    const skill = sessao.classDefinition.skills[0];
    const outra = sessao.classDefinition.skills[1];

    marcarAuto(sessao, skill.id, true);

    for (let i = 0; i < 60; i += 1) {
      await esperar(50);

      const flags = ana.painel?.skillAuto;

      if (Array.isArray(flags)) {
        // a skill arrastada esta no pacote, e a outra nao
        expect(flags).toContain(skill.id);
        expect(flags).not.toContain(outra.id);
        break;
      }
    }

    expect(Array.isArray(ana.painel?.skillAuto)).toBe(true);

    ana.desconectar();
  });

  it("o cliente ve a skill como automatica depois de arrastar", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana", "arbalist");

    const sessao = [...jogo.engine.world.players.values()].at(-1);
    const skill = sessao.classDefinition.skills[0];

    ana.marcarAuto(skill.id, true);

    let chegou = false;

    for (let i = 0; i < 60 && !chegou; i += 1) {
      await esperar(50);

      if (ana.painel?.skillAuto?.includes(skill.id)) chegou = true;
    }

    // e o que o HUD usa para acender o `AUTO` da skill
    expect(chegou).toBe(true);

    ana.desconectar();
  });
});
