import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";
import { getBestiaryEntry } from "../../src/data/bestiary/index.js";

/**
 * O botao "ir matar" do bestiario parou de funcionar.
 *
 * O motor ja guardava a cacada na SESSAO (`bestiaryTargetType`) e o
 * painel ja publicava `bestiaryAuto`, entao as duas pontas estavam
 * prontas. O que nao existia era o meio: o botao chamava
 * `engineRef.current.toggleBestiaryAuto` direto, sem `intencao`.
 * Online o motor da tela nao tem sessao nem simula, o clique morria
 * ali e o servidor nunca recebia o pedido.
 *
 * Este teste percorre o caminho pela rede: pedir a cacada, o painel
 * confirmar, o botao assumir o comando, e o outro jogador nao ser
 * arrastado junto.
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

async function entrar(cliente, nome, classId = "arbalist") {
  cliente.entrar({ name: nome, classId });

  for (let i = 0; i < 100 && !cliente.jogando(); i += 1) {
    await esperar(25);
  }

  expect(cliente.jogando()).toBe(true);

  for (let i = 0; i < 100; i += 1) {
    if (cliente.painel?.bestiary) return cliente;

    await esperar(25);
  }

  throw new Error(
    `o painel de ${nome} nao trouxe o bestiario: ${JSON.stringify(
      Object.keys(cliente.painel ?? {}),
    )}`,
  );
}

/** A primeira criatura do bestiario que o painel conhece. */
async function primeiraCriatura(cliente) {
  const entradas = cliente.painel?.bestiary?.entries ?? [];

  expect(
    entradas.length,
    "o painel deveria listar as criaturas do bestiario",
  ).toBeGreaterThan(0);

  return entradas[0];
}

/** Espera a cacada aparecer no painel, e devolve o estado. */
async function esperarCacada(cliente, timeoutMs = 3000) {
  const limite = Date.now() + timeoutMs;

  while (Date.now() < limite) {
    if (cliente.painel?.bestiaryAuto) {
      return cliente.painel.bestiaryAuto;
    }

    await esperar(25);
  }

  return cliente.painel?.bestiaryAuto ?? null;
}

describe("o botao ir matar do bestiario volta a funcionar", () => {
  it("pedir a cacada chega no servidor e volta no painel", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    // antes de pedir, nao ha cacada
    expect(ana.painel?.bestiaryAuto ?? null).toBeFalsy();

    const criatura = await primeiraCriatura(ana);

    ana.cacarCriatura(criatura.creatureId);

    const cacada = await esperarCacada(ana);

    // e o `BestiaryAutoBox` da tela que mostra isto
    expect(cacada).toBeTruthy();
    expect(cacada.creatureId).toBe(criatura.creatureId);

    const entry = getBestiaryEntry(criatura.creatureId);
    expect(cacada.name).toBe(entry.name);

    ana.desconectar();
  });

  it("a cacada toma o comando e desliga o auto da missao", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    // a Ana comeca com o auto de cacar perto ligado
    ana.alternarAutoPlay();

    for (let i = 0; i < 100; i += 1) {
      if (ana.painel?.autoPlay) break;
      await esperar(25);
    }

    expect(ana.painel?.autoPlay).toBe(true);

    const criatura = await primeiraCriatura(ana);

    ana.cacarCriatura(criatura.creatureId);
    await esperarCacada(ana);

    // o bestiario e dedicado a UMA criatura: dividiria o piloto
    // com o botao e nao terminaria nenhum dos dois
    expect(ana.painel?.autoPlay).toBe(false);
    expect(ana.painel?.quests?.auto?.enabled).toBe(false);

    ana.desconectar();
  });

  it("pedir de novo a MESMA criatura desliga a cacada", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const criatura = await primeiraCriatura(ana);

    ana.cacarCriatura(criatura.creatureId);
    expect(await esperarCacada(ana)).toBeTruthy();

    // o botao e um interruptor
    ana.cacarCriatura(criatura.creatureId);

    for (let i = 0; i < 100; i += 1) {
      if (!ana.painel?.bestiaryAuto) break;
      await esperar(25);
    }

    expect(ana.painel?.bestiaryAuto ?? null).toBeFalsy();

    ana.desconectar();
  });

  it("o botao Parar desliga a cacada", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const criatura = await primeiraCriatura(ana);

    ana.cacarCriatura(criatura.creatureId);
    expect(await esperarCacada(ana)).toBeTruthy();

    ana.pararCacada();

    for (let i = 0; i < 100; i += 1) {
      if (!ana.painel?.bestiaryAuto) break;
      await esperar(25);
    }

    expect(ana.painel?.bestiaryAuto ?? null).toBeFalsy();

    ana.desconectar();
  });

  it("a cacada da Ana nao arrasta o Bento", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const bento = criarCliente();
    await entrar(bento, "Bento");

    const criatura = await primeiraCriatura(ana);

    ana.cacarCriatura(criatura.creatureId);
    expect(await esperarCacada(ana)).toBeTruthy();

    // o `bestiaryTargetType` e por sessao: o Bento nao pode cair na
    // cacada que a Ana pediu
    expect(bento.painel?.bestiaryAuto ?? null).toBeFalsy();
    expect(bento.painel?.autoPlay).toBe(false);

    const sessoes = [...jogo.engine.world.players.values()];
    const sessaoBento = sessoes.find((s) => s.name === "Bento");

    expect(sessaoBento.bestiaryTargetType).toBeNull();

    ana.desconectar();
    bento.desconectar();
  });

  it("criatura que nao existe no bestiario nao liga nada", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    ana.cacarCriatura("dragao_que_nao_existe");

    await esperar(400);

    // o `setBestiaryAuto` recusa id desconhecido, entao a cacada
    // nao começa e o painel fica como estava
    expect(ana.painel?.bestiaryAuto ?? null).toBeFalsy();

    ana.desconectar();
  });

  it("a criatura escolhida e a que o painel estava mirando", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    // uma criatura que NAO e a primeira, para o teste nao passar
    // por acidente pegando sempre a mesma
    const criaturas = ana.painel.bestiary.entries;
    const outra = criaturas.find((c) => !c.done)?.creatureId;

    ana.cacarCriatura(outra);

    const cacada = await esperarCacada(ana);

    expect(cacada.creatureId).toBe(outra);

    // e a sessao guardou a MESMA criatura
    const sessaoAna = [...jogo.engine.world.players.values()].find(
      (s) => s.name === "Ana",
    );

    expect(sessaoAna.bestiaryTargetType).toBe(outra);

    ana.desconectar();
  });
});
