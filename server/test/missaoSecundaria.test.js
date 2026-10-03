import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";

/**
 * A missao SECUNDARIA sumiu da caixa depois da migracao.
 *
 * O `QuestLog` sempre montou `side.current` no snapshot, e a HUD
 * sempre soube desenhar a linha com a tag `S`. O que nao existia
 * era o CAMINHO: aceitar e abandonar chamavam
 * `engineRef.current.acceptSideQuest` direto, ou seja, o motor da
 * tela. Online esse motor nao tem sessao nem simula, entao o clique
 * morria ali e o servidor nunca soube da missao. O proximo painel
 * voltava com `side.current: null` e a caixa nao mostrava nada.
 *
 * Este teste percorre a jornada inteira pela rede: aceitar, aparecer
 * na caixa, avancar, completar e sumir.
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
  jogo = new GameServer({
    config: { ...SERVER_CONFIG },

    /**
     * Este teste e de COMBATE, entao roda no vale.
     *
     * O hub nao tem zona de mob — e nao e defeito, e o que um hub e.
     * Sem este `mapId` o servidor entraria no calcamento e nao haveria
     * alvo nenhum para bater
     */
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

  // `jogando()` fica true no WELCOME, e o painel vem logo depois.
  // sem esperar o primeiro painel, `quests` ainda nao chegou
  for (let i = 0; i < 100; i += 1) {
    if (cliente.painel?.quests?.side) return cliente;

    await esperar(25);
  }

  throw new Error(
    `o painel de ${nome} nao trouxe as missoes: ${JSON.stringify(
      Object.keys(cliente.painel ?? {}),
    )}`,
  );
}

/** Espera o painel trazer a missao secundaria aceita. */
async function esperarMissao(cliente, timeoutMs = 3000) {
  const limite = Date.now() + timeoutMs;

  while (Date.now() < limite) {
    const atual = cliente.painel?.quests?.side?.current ?? null;

    if (atual) return atual;

    await esperar(25);
  }

  return cliente.painel?.quests?.side?.current ?? null;
}

const sideDoPainel = (cliente) => cliente.painel?.quests?.side ?? null;

describe("a missao secundaria volta para a caixa", () => {
  it("aceitar pela rede coloca a missao na caixa", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    // antes de aceitar, a caixa mostra as disponiveis e nada ativo
    expect(sideDoPainel(ana)?.current).toBeFalsy();
    expect(
      sideDoPainel(ana)?.available?.length,
      "a lista de secundarias deveria vir no painel",
    ).toBeGreaterThan(0);

    const alvo = sideDoPainel(ana).available[0];

    ana.aceitarMissaoSecundaria(alvo.id);

    const ativa = await esperarMissao(ana);

    // e ISTO que a box da missao desenha: a linha com a tag `S`
    expect(ativa).toBeTruthy();
    expect(ativa.id).toBe(alvo.id);
    expect(ativa.name).toBe(alvo.name);
    expect(ativa.count).toBe(alvo.count);
    expect(ativa.progress).toBe(0);

    ana.desconectar();
  });

  it("a aceita marca a secundaria como ativa e tranca as outras", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const antes = sideDoPainel(ana).available;
    const alvo = antes[0];

    ana.aceitarMissaoSecundaria(alvo.id);
    await esperarMissao(ana);

    const depois = sideDoPainel(ana).available;
    const escolhida = depois.find((q) => q.id === alvo.id);
    const outra = depois.find((q) => q.id !== alvo.id);

    // o `QuestLog` e quem trava: so uma secundaria ativa por vez
    expect(escolhida.active).toBe(true);

    if (outra) {
      expect(outra.active).toBe(false);
      expect(outra.done).toBe(false);
    }

    ana.desconectar();
  });

  it("abandonar tira a missao da caixa", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const alvo = sideDoPainel(ana).available[0];

    ana.aceitarMissaoSecundaria(alvo.id);
    expect(await esperarMissao(ana)).toBeTruthy();

    ana.abandonarMissaoSecundaria();

    for (let i = 0; i < 100; i += 1) {
      await esperar(25);

      if (!sideDoPainel(ana)?.current) break;
    }

    // a caixa volta a nao mostrar nada ativo, e a missao fica
    // disponivel de novo
    expect(sideDoPainel(ana)?.current).toBeFalsy();

    const reativavel = sideDoPainel(ana)?.available?.find(
      (q) => q.id === alvo.id,
    );

    expect(reativavel?.active).toBe(false);
    expect(reativavel?.done).toBe(false);

    ana.desconectar();
  });

  it("a secundaria da Ana nao aparece na caixa do Bento", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const bento = criarCliente();
    await entrar(bento, "Bento");

    const alvo = sideDoPainel(ana).available[0];

    ana.aceitarMissaoSecundaria(alvo.id);
    expect(await esperarMissao(ana)).toBeTruthy();

    // o painel do Bento tem as MESMAS disponiveis, mas nenhuma ativa:
    // o `QuestLog` e por sessao
    expect(sideDoPainel(bento)?.current).toBeFalsy();
    expect(
      sideDoPainel(bento)?.available?.some((q) => q.active),
      "a missao da Ana vazou para o Bento",
    ).toBe(false);

    ana.desconectar();
    bento.desconectar();
  });

  it("id de missao que nao existe nao cria nada", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    ana.aceitarMissaoSecundaria("missao_que_nao_existe");

    await esperar(400);

    // o `acceptSide` devolve false para id desconhecido, e a caixa
    // fica como estava
    expect(sideDoPainel(ana)?.current).toBeFalsy();
    expect(
      sideDoPainel(ana)?.available?.some((q) => q.active),
    ).toBe(false);

    ana.desconectar();
  });

  it("o progresso da secundaria conta e a conclusao some da caixa", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const sessao = [...jogo.engine.world.players.values()].at(-1);
    const log = sessao.quests;

    const alvo = sideDoPainel(ana).available[0];

    ana.aceitarMissaoSecundaria(alvo.id);
    expect(await esperarMissao(ana)).toBeTruthy();

    const ativa = log.currentSide;
    expect(ativa).toBeTruthy();
    expect(ativa.id).toBe(alvo.id);

    // o avanco real de uma secundaria de hunt e o abate, e ele
    // acontece no log da SESSAO. a caixa so reflete
    for (let i = 0; i < ativa.count; i += 1) {
      log.onKill(ativa.target, 1);
    }

    // concluida: some da caixa e vira `done` na lista
    expect(log.currentSide).toBeFalsy();

    for (let i = 0; i < 100; i += 1) {
      await esperar(25);

      if (!sideDoPainel(ana)?.current) break;
    }

    expect(sideDoPainel(ana)?.current).toBeFalsy();
    expect(
      sideDoPainel(ana)?.available?.find((q) => q.id === alvo.id)?.done,
    ).toBe(true);

    ana.desconectar();
  });
});

/**
 * O abate por DoT e a parte da secundaria que o `updateEnemies`
 * resolvia.
 *
 * O `StatusSystem` tira vida direto, sem passar pelo `DamageSystem`,
 * entao o abate acontece em `updateEnemies` - e esse laco e a parte
 * COMPARTILHADA do tick, que roda FORA do `withPlayer` de cada
 * jogador. Sem sessao em foco, `this.world.quests` era `null` e o
 * `onKill` estourava. Com duas sessoes presentes era pior: o
 * progresso ia para o jogador em foco, e nao para quem aplicou o
 * veneno.
 *
 * O loot ja estava certo: o `lastHitBy` aponta para o autor do
 * tick. A missao e o bestiario usavam o foco, e o foco nao existe
 * ali.
 */
describe("o abate por veneno credita quem aplicou", () => {
  it("a secundaria do autor do DoT avanca", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const bento = criarCliente();
    await entrar(bento, "Bento");

    const sessoes = [...jogo.engine.world.players.values()];
    const sessaoAna = sessoes.find((s) => s.name === "Ana");
    const sessaoBento = sessoes.find((s) => s.name === "Bento");

    const alvo = sideDoPainel(ana).available[0];

    ana.aceitarMissaoSecundaria(alvo.id);
    expect(await esperarMissao(ana)).toBeTruthy();

    // um slime queimando, quase morto, com a Ana como autora do tick
    const slime = jogo.engine.world.enemies.find((e) =>
      e.id.startsWith("slime"),
    );

    expect(slime).toBeTruthy();

    slime.statusEffects.push({
      type: "burning",
      remaining: 5,
      damagePerTick: 50,
      tickInterval: 0.5,
      tickTimer: 0,
      source: sessaoAna.player,
    });

    slime.hp = 10;

    const antes = sessaoAna.quests.progressOf(alvo.id);
    const antesDoBento = sessaoBento.quests.progressOf(alvo.id);

    // o tick de verdade: e o `updateEnemies` que encontra o hp zero
    jogo.engine.update(1 / 60);

    // a missao da ANA avancou. antes disso o `onKill` rodava com
    // `world.quests` nulo e o tick inteiro estourava
    expect(sessaoAna.quests.progressOf(alvo.id)).toBe(antes + 1);
    expect(sessaoBento.quests.progressOf(alvo.id)).toBe(antesDoBento);

    ana.desconectar();
    bento.desconectar();
  });

  it("o tick sobrevive ao abate por DoT", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const slime = jogo.engine.world.enemies.find((e) =>
      e.id.startsWith("slime"),
    );

    const sessao = [...jogo.engine.world.players.values()].at(-1);

    slime.statusEffects.push({
      type: "poison",
      remaining: 5,
      damagePerTick: 999,
      tickInterval: 0.5,
      tickTimer: 0,
      source: sessao.player,
    });

    slime.hp = 5;

    // nao pode estourar: uma excecao aqui derrubava o laco de 20Hz
    // e levava o mundo inteiro junto
    expect(() => jogo.engine.update(1 / 60)).not.toThrow();

    ana.desconectar();
  });
});
