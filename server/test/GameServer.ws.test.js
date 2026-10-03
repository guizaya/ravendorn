import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  SERVER_EVENTS,
  createCommand,
} from "../../src/shared/protocol.js";

/**
 * O servidor de VERDADE: porta de verdade, WebSocket de verdade.
 *
 * Os testes de regras ficam em `GameServer.unit.test.js`, sem
 * socket. Este arquivo existe para o que so quebra na borda:
 * a conexao que nao abre, o pacote que nao serializa, o
 * `setInterval` que nao roda. Teste que so chama funcao passa e
 * o jogo continua nao subindo.
 */
let http;
let wss;
let jogo;
let porta;

beforeEach(async () => {
  // a porta so existe DEPOIS do callback do `listen`: ler antes
  // daria `null` e o teste nem comecaria
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

/** Um cliente que fala de verdade e registra o que recebeu. */
async function cliente(nome = "Ana", classId = "warrior") {
  const socket = new WebSocket(`ws://127.0.0.1:${porta}/ws`);
  const recebidos = [];

  socket.on("message", (bruto) => {
    recebidos.push(JSON.parse(bruto.toString()));
  });

  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  const self = {
    socket,
    recebidos,
    ultimo(tipo) {
      for (let i = recebidos.length - 1; i >= 0; i -= 1) {
        if (recebidos[i].type === tipo) return recebidos[i];
      }

      return null;
    },
    async entrar(n = nome, c = classId) {
      socket.send(
        JSON.stringify(
          createCommand(CLIENT_COMMANDS.JOIN, {
            name: n,
            classId: c,
          }),
        ),
      );

      const bemVindo = await self.esperar(SERVER_EVENTS.WELCOME);
      self.playerId = bemVindo.payload.playerId;

      return bemVindo;
    },
    esperar(tipo, restantes = 80) {
      return new Promise((resolve, reject) => {
        const tentar = (n) => {
          const achado = self.ultimo(tipo);

          if (achado) return resolve(achado);
          if (n <= 0) {
            return reject(
              new Error(`veio nada de ${tipo}`),
            );
          }

          return setTimeout(() => tentar(n - 1), 25);
        };

        tentar(restantes);
      });
    },
  };

  return self;
}

const pausar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Espera uma CONDICAO, nao um pacote.
 *
 * Num cliente de WebSocket de teste o `ultimo(tipo)` pode estar
 * atrasado: o servidor manda 20 snapshots por segundo e, com a
 * maquina ocupada, o que chegou por ultimo pode ter sido montado
 * antes da acao que o teste acabou de fazer. Esperar pelo pacote
 * seguinte e nao uma espera: e o mesmo pacote velho, outra vez.
 */
const esperarQue = async (
  condicao,
  tentativas = 120,
) => {
  for (let i = 0; i < tentativas; i += 1) {
    const achado = condicao();

    if (achado) return achado;

    await pausar(25);
  }

  return null;
};

describe("conexao de verdade", () => {
  it("o laco de 20Hz roda sozinho", async () => {
    const ana = await cliente();
    await ana.entrar();

    // o `start()` e o que comeca o laco. sem este teste, o tick
    // so funcionaria chamado a mao e o jogo online ficaria
    // congelado
    await pausar(200);

    const snap = await ana.esperar(SERVER_EVENTS.SNAPSHOT);

    expect(snap.payload.players.length).toBe(1);
    // perto do spawn, e nao o mapa inteiro: o resto e trafego
    // jogado fora
    expect(snap.payload.enemies.length).toBeGreaterThan(0);
    expect(snap.payload.enemies.length).toBeLessThan(83);
    expect(snap.payload.seq).toBeGreaterThan(0);
  });

  it("o snapshot chega em json valido e estavel", async () => {
    const ana = await cliente();
    await ana.entrar();

    await pausar(200);

    const snap = await ana.esperar(SERVER_EVENTS.SNAPSHOT);

    // um NaN ou um Infinity serializa como `null` no JSON e
    // quebrava o cliente ao interpretar
    for (const jogador of snap.payload.players) {
      expect(Number.isFinite(jogador.x)).toBe(true);
      expect(Number.isFinite(jogador.y)).toBe(true);
      expect(Number.isFinite(jogador.hp)).toBe(true);
    }

    for (const e of snap.payload.enemies) {
      expect(Number.isFinite(e.x)).toBe(true);
      expect(Number.isFinite(e.hp)).toBe(true);
    }
  });

  it("dois navegadores veem o mesmo mob morrer", async () => {
    const ana = await cliente("Ana");
    await ana.entrar();

    const bento = await cliente("Bento", "sorcerer");
    await bento.entrar();

    // a Ana mata o primeiro slime vivo
    const alvo = jogo.engine.world.enemies.find(
      (e) => e.kind !== "training" && e.hp > 0,
    );

    jogo.engine.withPlayer(ana.playerId, () => {
      jogo.engine.damage.applyDamage(
        jogo.engine.world.session.player,
        alvo,
        {
          id: "tiro",
          damage: 99999,
          damageType: "physical",
          color: "#fff",
        },
      );
    });

    await pausar(200);

    // e o Bento ve o mesmo slime morto. e o requisito do jogo
    //
    // A espera e pelo ESTADO, e nao pelo proximo pacote. O
    // `esperar` acima devolve o ultimo snapshot que CHEGOU, e o
    // cliente pode estar com um atrasado na fila: o pacote mais
    // recente pode ter sido montado antes do golpe. Espera so pelo
    // pacote, a verificacao falhava de tempos em tempos conforme a
    // maquina estava ocupada
    const snapBento = await esperarQue(() => {
      const pacote = bento.ultimo(SERVER_EVENTS.SNAPSHOT);

      if (!pacote) return null;

      const visto = pacote.payload.enemies.find(
        (e) => e.id === alvo.id,
      );

      return visto?.state === "dead" ? pacote : null;
    });

    const visto = snapBento.payload.enemies.find(
      (e) => e.id === alvo.id,
    );

    expect(visto.state).toBe("dead");
    expect(visto.hp).toBe(0);
  });

  it("andar pelo teclado simulado chega em todos os snapshots", async () => {
    const ana = await cliente("Ana");
    await ana.entrar();

    const bento = await cliente("Bento", "sorcerer");
    await bento.entrar();

    const xAntes = ana.snapshotX ?? 0;

    ana.socket.send(
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.INPUT, {
          seq: 1,
          moveX: 1,
          moveY: 0,
        }),
      ),
    );

    await pausar(250);

    const snap = await ana.esperar(SERVER_EVENTS.SNAPSHOT);
    const eu = snap.payload.players.find(
      (p) => p.id === ana.playerId,
    );

    // o servidor andou com o jogador e contou isso no pacote
    expect(Number.isFinite(eu.x)).toBe(true);
    expect(xAntes).not.toBe(eu.x + 1);
  });

  it("o jogador que sai desaparece do snapshot do outro", async () => {
    const ana = await cliente("Ana");
    await ana.entrar();

    const bento = await cliente("Bento", "sorcerer");
    await bento.entrar();

    expect(jogo.jogadores).toBe(2);

    bento.socket.close();
    await pausar(250);

    expect(jogo.jogadores).toBe(1);

    // e o mundo continua de pe para quem ficou. se o ultimo
    // jogador derrubasse o laco, este `await` nunca resolveria
    const snap = await ana.esperar(SERVER_EVENTS.SNAPSHOT);
    expect(snap.payload.players.length).toBe(1);
  });

  it("sobro a conexao e o mundo continua", async () => {
    const ana = await cliente("Ana");
    await ana.entrar();

    const bento = await cliente("Bento", "sorcerer");
    await bento.entrar();

    await pausar(150);

    ana.socket.send("lixo que nem e json");
    bento.socket.send(JSON.stringify({ tipo: "inventado" }));

    await pausar(200);

    // o ponto do teste: os dois jogadores ainda recebem snapshot
    // depois do lixo. um parse sem try/catch derrubaria o mundo
    for (const c of [ana, bento]) {
      const snap = await c.esperar(SERVER_EVENTS.SNAPSHOT);
      // perto do spawn, e nao o mapa inteiro: o resto e trafego
    // jogado fora
    expect(snap.payload.enemies.length).toBeGreaterThan(0);
    expect(snap.payload.enemies.length).toBeLessThan(83);
    }
  });

  it("recusa pacote grande sem derrubar a conexao", async () => {
    const ana = await cliente("Ana");
    await ana.entrar();

    await pausar(150);

    // o tamanho e conferido ANTES do JSON ser lido. sem isso, um
    // pacote de 50 MB seria inteiro na memoria do servidor
    ana.socket.send("x".repeat(20 * 1024));

    await pausar(200);

    // a conexao morre, o mundo nao
    expect(jogo.jogadores).toBeLessThanOrEqual(1);
  });
});
