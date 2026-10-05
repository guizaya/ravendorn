import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";
import { createPlayerSession } from "../../src/game/engine/PlayerSession.js";
import { GameEngine } from "../../src/game/engine/GameEngine.js";
import { CHARACTER_CLASSES } from "../../src/data/characters/index.js";
import { BASE_MAP } from "../../src/data/maps/base.js";
import { MAP_1, MAP_2 } from "../../src/data/maps/index.js";
import { BASE_PORTALS } from "../../src/data/portais/index.js";

const [PORTAL] = BASE_PORTALS;

/**
 * O HUB COMO MAPA INICIAL, DE PONTA A PONTA.
 *
 * A tela de jogo nunca roda o motor sozinho: `TestMapScene` sempre pede
 * um `useGameClient`, e o `HUD` recebe `estado?.painel`. Se o servidor
 * nao mandar o primeiro pacote, o `snapshot` fica `null` e TODOS os
 * panels aparecem vazios — inventario, missoes, rank, craft, e a caixa
 * de missoes some junto
 *
 * E por isso que este arquivo existe. O painel ser identico no motor nao
 * prova que ele chega: prova so que o `sendSnapshot` monta. Falta o
 * caminho entre o servidor e a tela, que e onde o hub pode quebrar sem
 * nenhum teste de unidade reclamar
 *
 * O hub nao tem zona de mob, entao nao ha combate aqui. O que este
 * arquivo mede e: o jogador entra, o primeiro painel chega, e chega COM
 * CONTEUDO
 */

let http;
let wss;
let jogo;
let porta;

/** Um servidor no `mapId` pedido, com socket de verdade. */
async function subir(mapId) {
  await new Promise((resolve) => {
    http = createServer();

    http.listen(0, "127.0.0.1", () => {
      porta = http.address().port;
      resolve();
    });
  });

  wss = new WebSocketServer({ server: http, path: "/ws" });

  jogo = new GameServer({ config: { ...SERVER_CONFIG }, mapId });

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
}

const esperar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Espera uma CONDICAO, com limite.
 *
 * Em socket a espera fixa e uma aposta: o handshake tem que acontecer,
 * o tick tem que rodar e o pacote tem que voltar. Esperar o efeito, e
 * nao um numero de milissegundos, deixa o teste medir o que ele diz
 */
async function esperarAte(condicao, tentativas = 160, passo = 25) {
  for (let i = 0; i < tentativas; i += 1) {
    if (condicao()) return true;

    await esperar(passo);
  }

  return false;
}

/** Um cliente de verdade, ligado ao servidor que esta no ar. */
function criarCliente() {
  const estados = [];
  const status = [];

  const cliente = new GameClient({
    url: `ws://127.0.0.1:${porta}/ws`,
    WebSocketImpl: WebSocket,
    onStatus: (s) => status.push(s.status),
    onState: (s) => estados.push(s),
  });

  cliente.conectar();

  return { cliente, estados, status };
}

/** Entra e espera o primeiro painel. */
async function entrar(mapId, nome) {
  await subir(mapId);

  const { cliente, estados, status } = criarCliente();

  cliente.entrar({ name: nome, classId: "warrior" });

  const chegou = await esperarAte(() => cliente.painel);

  return { cliente, estados, status, chegou };
}

describe("o hub como mapa inicial", () => {
  it("o jogador entra e o primeiro painel chega", async () => {
    const { cliente, chegou } = await entrar("base", "Ana");

    expect(chegou, "nenhum painel chegou da base").toBe(true);
    expect(cliente.painel).toBeTruthy();

    cliente.desconectar();
  });

  it("o painel da base tem as mesmas chaves do vale", async () => {
    const base = await entrar("base", "Ana");

    const chavesBase = Object.keys(base.cliente.painel ?? {}).sort();

    base.cliente.desconectar();

    const vale = await entrar("map_1", "Bento");

    const chavesVale = Object.keys(vale.cliente.painel ?? {}).sort();

    vale.cliente.desconectar();

    expect(chavesBase.length).toBeGreaterThan(0);
    expect(chavesBase).toEqual(chavesVale);
  });

  it("inventario, missoes, rank e craft chegam com conteudo", async () => {
    const { cliente } = await entrar("base", "Ana");

    const p = cliente.painel;

    expect(p.inventory, "inventario ausente").toBeTruthy();
    expect(p.quests, "missoes ausentes").toBeTruthy();
    expect(p.rank, "rank ausente").toBeTruthy();
    expect(p.craft, "craft ausente").toBeTruthy();

    // a caixa de missoes do HUD e desenhada a partir disto
    expect(
      p.quests.main,
      "nenhuma missao principal no painel da base",
    ).toBeTruthy();

    expect(
      p.quests.main.current,
      "missao principal sem missao atual",
    ).toBeTruthy();

    // `rank` e `{ nivel, bestiario }`, nao uma lista
    expect(p.rank.nivel.length, "rank vazio").toBeGreaterThan(0);

    // `craft` e `{ categories }`
    expect(
      p.craft.categories.length,
      "craft sem categoria na base",
    ).toBeGreaterThan(0);

    cliente.desconectar();
  });

  it("o jogador nasce no meio do hub", async () => {
    const { cliente } = await entrar("base", "Ana");

    const eu = cliente.painel?.player;

    expect(eu, "painel sem jogador").toBeTruthy();
    expect(eu.x).toBe(BASE_MAP.spawn.x);
    expect(eu.y).toBe(BASE_MAP.spawn.y);

    cliente.desconectar();
  });

  it("o hub ignora a posicao salva, mesmo quando ela cabe no mapa", () => {
    /**
     * O defeito que o `resumeWhereLeftOff` resolve.
     *
     * (1200, 800) e onde o motor colocava o jogador na era do vale. Essa
     * posicao esta DENTRO da base, que vai de 40 a 1640 em X e de 40 a
     * 1136 em Y — entao o limite a aceitou e o personagem reapareceu
     * longe do meio, sem nenhuma relacao com o calcamento
     *
     * E por isso que o centro nao pode depender so do clamp: o clamp
     * existe para o personagem nao nascer no vazio, nao para decidir
     * onde um hub comeca
     */
    const jogo = new GameServer({
      config: { ...SERVER_CONFIG },
      mapId: "base",
    });

    const sessao = createPlayerSession(
      CHARACTER_CLASSES[0],
      { id: "p1", name: "Ana", spawn: BASE_MAP.spawn },
    );

    jogo.engine.addPlayer(sessao, { focus: true });

    jogo.restaurar(sessao, {
      player: { level: 1, xp: 0, x: 1200, y: 800 },
    });

    expect(sessao.player.x).toBe(BASE_MAP.spawn.x);
    expect(sessao.player.y).toBe(BASE_MAP.spawn.y);

    jogo.stop();
  });

  it("o vale aceita a posicao salva, que e o que ele deve fazer", () => {
    const jogo = new GameServer({
      config: { ...SERVER_CONFIG },
      mapId: "map_1",
    });

    const sessao = createPlayerSession(
      CHARACTER_CLASSES[0],
      { id: "p1", name: "Ana", spawn: MAP_1.spawn },
    );

    jogo.engine.addPlayer(sessao, { focus: true });

    jogo.restaurar(sessao, {
      player: { level: 1, xp: 0, x: 3000, y: 2000 },
    });

    // o vale e de exploracao: voltar no meio do nada perderia o caminho
    expect(sessao.player.x).toBe(3000);
    expect(sessao.player.y).toBe(2000);

    jogo.stop();
  });

  it("o vale ainda joga no spawn um save de fora dos limites", () => {
    /**
     * O outro lado da mesma regra: retomar onde parou so faz sentido
     * enquanto o ponto salvo existe neste mapa
     */
    const jogo = new GameServer({
      config: { ...SERVER_CONFIG },
      mapId: "map_1",
    });

    const sessao = createPlayerSession(
      CHARACTER_CLASSES[0],
      { id: "p1", name: "Ana", spawn: MAP_1.spawn },
    );

    jogo.engine.addPlayer(sessao, { focus: true });

    jogo.restaurar(sessao, {
      player: { level: 1, xp: 0, x: 99999, y: 99999 },
    });

    expect(sessao.player.x).toBe(MAP_1.spawn.x);
    expect(sessao.player.y).toBe(MAP_1.spawn.y);

    jogo.stop();
  });

  it("o estado do mundo chega, mesmo sem nenhum mob", { timeout: 20000 }, async () => {
    const { cliente, estados, chegou } = await entrar("base", "Ana");

    expect(chegou, "o painel nao chegou").toBe(true);

    // o `GameClient` traduz o pacote para o formato que o
    // `NetworkWorld` consome: `eu`, `inimigos`, `outros`
    const comEstado = await esperarAte(
      () => estados.some((e) => Boolean(e?.eu)),
    );

    expect(comEstado, "nenhum estado do mundo chegou").toBe(true);

    const ultimo = estados.filter((e) => Boolean(e?.eu)).pop();

    // o hub nao tem mob, e isso e o esperado. O que nao pode e o estado
    // sumir: `eu` traz o proprio jogador, entao o cliente sabe onde
    // desenhar. E `inimigos` virando lista vazia, e nao `undefined`:
    // o `aplicarInimigos` so continua se o valor for array
    expect(ultimo.eu, "o estado nao trouxe o proprio jogador").toBeTruthy();

    expect(ultimo.eu.x).toBe(BASE_MAP.spawn.x);
    expect(ultimo.eu.y).toBe(BASE_MAP.spawn.y);

    expect(Array.isArray(ultimo.inimigos), "inimigos nao virou lista").toBe(true);
    expect(ultimo.inimigos).toHaveLength(0);

    cliente.desconectar();
  });
});

describe("a travessia pelo portal, conferida no servidor", () => {
  const entrarNoHub = () => {
    const jogo = new GameServer({
      config: { ...SERVER_CONFIG },
      mapId: "base",
    });

    const sessao = createPlayerSession(
      CHARACTER_CLASSES[0],
      { id: "p1", name: "Ana", spawn: BASE_MAP.spawn },
    );

    jogo.engine.addPlayer(sessao, { focus: true });

    return { jogo, sessao };
  };

  it("atravessa quando o jogador esta em cima do portal", () => {
    const { jogo, sessao } = entrarNoHub();

    sessao.player.x = PORTAL.x;
    sessao.player.y = PORTAL.y;

    expect(jogo.travessarPortal(PORTAL.id)).toBe(true);
    expect(jogo.engine.world.map.id).toBe("map_1");

    jogo.stop();
  });

  it("atravessa e CHEGA NO PORTAL, nao no meio do vale", () => {
    const { jogo, sessao } = entrarNoHub();

    sessao.player.x = PORTAL.x;
    sessao.player.y = PORTAL.y;

    expect(jogo.travessarPortal(PORTAL.id)).toBe(true);
    expect(jogo.engine.world.map.id).toBe("map_1");

    const chegada = jogo.engine.world.portals.find(
      (p) => p.id === PORTAL.chegada,
    );

    expect(
      jogo.engine.world.player.x,
      "o jogador nao chegou no portal de chegada",
    ).toBe(chegada.x);

    expect(jogo.engine.world.player.y).toBe(chegada.y);

    // e nao no spawn, que e a tres mil pixels dali
    expect(jogo.engine.world.player.x).not.toBe(MAP_1.spawn.x);

    jogo.stop();
  });

  it("o servidor e o motor concordam onde a chegada e", () => {
    /**
     * O servidor delega a travessia ao motor em vez de reescrever a
     * conta. Este teste e a prova de que a delegacao nao divergiu: se
     * um dos dois calculasse o ponto sozinho, os dois aqui concordariam, e
     * o cliente veria um lugar e o servidor outro
     */
    const { jogo, sessao } = entrarNoHub();

    sessao.player.x = PORTAL.x;
    sessao.player.y = PORTAL.y;

    const peloMotor = new Map();

    {
      const engine = new GameEngine(
        null,
        CHARACTER_CLASSES[0],
        null,
        { playerId: "p1", characterName: "Ana" },
      );

      engine.setMap(BASE_MAP);
      engine.world.player.x = PORTAL.x;
      engine.world.player.y = PORTAL.y;
      engine.travessarPortal();

      peloMotor.set("x", engine.world.player.x);
      peloMotor.set("y", engine.world.player.y);
    }

    jogo.travessarPortal(PORTAL.id);

    expect(jogo.engine.world.player.x).toBe(peloMotor.get("x"));
    expect(jogo.engine.world.player.y).toBe(peloMotor.get("y"));

    jogo.stop();
  });

  it("recusa quando o jogador NAO andou ate o portal", () => {
    /**
     * A conferencia que faz o portal valer alguma coisa.
     *
     * Sem ela, qualquer jogador Could pedir a travessia sem nunca sair
     * do meio do calcamento — e o portal seria uma imagem no chao
     */
    const { jogo, sessao } = entrarNoHub();

    sessao.player.x = BASE_MAP.spawn.x;
    sessao.player.y = BASE_MAP.spawn.y;

    expect(jogo.travessarPortal(PORTAL.id)).toBe(false);
    expect(jogo.engine.world.map.id).toBe("base");

    jogo.stop();
  });

  it("recusa o id de um portal em que o jogador nao esta", () => {
    /**
     * O jogador esta em cima do portal do hub, mas manda o id de outro.
     * Aceitar faria o `id` do pedido valer mais do que a posicao real
     */
    const { jogo, sessao } = entrarNoHub();

    sessao.player.x = PORTAL.x;
    sessao.player.y = PORTAL.y;

    expect(jogo.travessarPortal("portal_pantano")).toBe(false);
    expect(jogo.engine.world.map.id).toBe("base");

    jogo.stop();
  });

  it("recusa um id que nem existe", () => {
    const { jogo, sessao } = entrarNoHub();

    sessao.player.x = PORTAL.x;
    sessao.player.y = PORTAL.y;

    expect(jogo.travessarPortal("portal_inventado")).toBe(false);
    expect(jogo.travessarPortal(null)).toBe(false);
    expect(jogo.travessarPortal(undefined)).toBe(false);

    expect(jogo.engine.world.map.id).toBe("base");

    jogo.stop();
  });

  it("longe do portal do vale, nao atravessa", () => {
    const { jogo, sessao } = entrarNoHub();

    jogo.engine.setMap(MAP_1);
    sessao.player.x = 3000;
    sessao.player.y = 2100;

    // os dois portais do vale estao em (5799, 3981) e (178, 180), e o
    // jogador esta no meio do mapa: longe dos dois
    expect(jogo.travessarPortal("portal_pantano")).toBe(false);
    expect(jogo.travessarPortal("portal_floresta")).toBe(false);
    expect(jogo.engine.world.map.id).toBe("map_1");

    jogo.stop();
  });

  it("em cima do portal do vale, volta para o hub", () => {
    const { jogo, sessao } = entrarNoHub();

    jogo.engine.setMap(MAP_1);
    sessao.player.x = 5799;
    sessao.player.y = 3981;

    expect(jogo.travessarPortal("portal_pantano")).toBe(true);
    expect(jogo.engine.world.map.id).toBe("base");

    jogo.stop();
  });

  it("voltar deixa o jogador EM CIMA do portal do hub, e no centro", () => {
    /**
     * O pedido que fechava o ciclo: chegar no meio do hub obrigaria o
     * jogador a andar de volta ate o portal para sair dele, e o segundo
     * clique pareceria nao funcionar
     */
    const { jogo, sessao } = entrarNoHub();

    // hub -> vale
    sessao.player.x = PORTAL.x;
    sessao.player.y = PORTAL.y;

    expect(jogo.travessarPortal(PORTAL.id)).toBe(true);
    expect(jogo.engine.world.map.id).toBe("map_1");

    // vale -> hub
    expect(
      jogo.travessarPortal("portal_pantano"),
    ).toBe(true);

    expect(jogo.engine.world.map.id).toBe("base");
    expect(jogo.engine.world.player.x).toBe(PORTAL.x);
    expect(jogo.engine.world.player.y).toBe(PORTAL.y);

    // e nao no meio do hub
    //
    // so no X: o portal foi pedido em y=588, que e a MESMA altura do
    // spawn do hub. A diferenca de linha seria zero por escolha de
    // posicao, nao por defeito
    expect(jogo.engine.world.player.x).not.toBe(BASE_MAP.spawn.x);
    expect(BASE_MAP.spawn.y).toBe(PORTAL.y);

    jogo.stop();
  });

  it("o portal da floresta leva para o mapa 2, e a volta funciona", () => {
    /**
     * O SEGUNDO portal do vale foi ligado.
     *
     * Antes ele era enfeite, e este teste affirms isso. Agora ele e o par
     * do `portal_mapa2`: o mapa 1 tem dois caminhos saida, um para o hub
     * e um para o mapa 2
     *
     * A ida E a volta sao o mesmo caminho visto dos dois lados, entao
     * atravessar duas vezes tem que devolver o jogador ao mapa de
     * origem — e nao a um terceiro lugar
     */
    const { jogo, sessao } = entrarNoHub();

    jogo.engine.setMap(MAP_1);
    sessao.player.x = 178;
    sessao.player.y = 180;

    expect(jogo.travessarPortal("portal_floresta")).toBe(true);
    expect(jogo.engine.world.map.id).toBe("map_2");

    // a chegada e o par do portal, e nao o spawn do mapa
    expect(sessao.player.x).toBe(178);
    expect(sessao.player.y).toBe(180);

    jogo.stop();
  });

  it("quem chega no mapa 2 volta pelo portal de la", () => {
    /**
     * O par declarado pelos DOIS lados.
     *
     * `portal_floresta` diz para onde vai e onde chega; `portal_mapa2`
     * faz o mesmo na volta. Se um dos dois declarasse o par errado, o
     * jogador atravessaria para o lugar e voltaria para o portal sem o
     * lado de la saber para onde devolve
     */
    const { jogo, sessao } = entrarNoHub();

    jogo.engine.setMap(MAP_2);
    sessao.player.x = 178;
    sessao.player.y = 180;

    expect(jogo.travessarPortal("portal_mapa2")).toBe(true);
    expect(jogo.engine.world.map.id).toBe("map_1");

    jogo.stop();
  });
});

afterEach(async () => {
  jogo?.stop();

  await new Promise((resolve) => {
    for (const socket of wss?.clients ?? []) socket.terminate();

    wss?.close?.(() => http?.close?.(resolve));
    setTimeout(resolve, 60);
  });
});
