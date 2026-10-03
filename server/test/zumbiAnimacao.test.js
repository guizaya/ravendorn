import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";
import {
  CREATURE_TYPES,
  createCreature,
} from "../../src/data/enemies/index.js";
import { getEnemySprite } from "../../src/data/sprites/enemies.js";
import {
  resolveCreatureAnimation,
  resolveFrameRect,
} from "../../src/game/sprites/animation.js";

/**
 * O zumbi andava sempre para o mesmo lado e nunca levantava o arco.
 *
 * A causa nao era da arte nem do layout: as duas pontas existiam e
 * funcionavam offline. O que faltava era o MEIO.
 *
 * O `estadoInimigos` do servidor mandava posicao, vida e `aiState`,
 * e nada mais. O cliente nunca recebia para onde o mob olha nem se
 * ele estava atacando, entao o `facing` da entidade no cliente
 * ficava no valor inicial de `createCreature` (sempre para o sul) e o
 * `attackAnimation` nunca era setado.
 *
 * Para os mobs de folha antiga isso passa quase despercebido: eles
 * tem tres linhas e um espelhamento, entao "andando torto" e "do
 * jeito certo" parecem a mesma coisa. O zumbi tem oito direcoes e uma
 * arte de tiro propria, entao as duas ausencias apareceram como duas
 * animacoes faltando.
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
  await jogo.stop();

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

async function entrar(cliente, nome) {
  cliente.entrar({ name: nome, classId: "arbalist" });

  for (let i = 0; i < 120; i += 1) {
    if (cliente.painel?.player) return cliente;

    await esperar(25);
  }

  throw new Error(`${nome} nao entrou`);
}

/** A sessao do jogador que acabou de entrar. */
function sessaoAtual() {
  return [...jogo.engine.world.players.values()].at(-1);
}

/**
 * Coloca um zumbi do lado do jogador.
 *
 * O indice do `createCreature` vai no id do mob
 * (`zumbi_arbalist_<indice>`), entao dois zumbis com o mesmo indice
 * seriam o MESMO mob: o segundo viraria invisivel para a busca por
 * id, e o teste passaria a olhar a criatura errada sem nenhuma
 * falha aparecer.
 */
let indiceZumbi = 900;

function criarHelperZumbi(jogador, dx) {
  indiceZumbi += 1;

  const zumbi = createCreature(
    "zumbi_arbalist",
    { x: jogador.x + dx, y: jogador.y },
    indiceZumbi,
    CREATURE_TYPES.zumbi_arbalist.level,
  );

  jogo.engine.world.enemies.push(zumbi);

  return zumbi;
}

/** O que o SERVIDOR manda sobre um mob, pelo caminho de verdade. */
function estadoDo(zumbi, jogador = sessaoAtual().player) {
  const lista = jogo.estadoInimigos({
    session: { player: jogador },
  });

  return lista.find((e) => e.id === zumbi.id) ?? null;
}

const SPRITE = () => getEnemySprite("zumbi_arbalist");

const plantarZumbi = (dx) =>
  criarHelperZumbi(sessaoAtual().player, dx);

describe("o pacote do mob leva direcao e tiro", () => {
  it("o servidor manda para onde o mob esta olhando", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    // Longe o bastante para ele ATIRAR em vez de recuar: a
    // `keepDistance` dele e 190, entao a 260 ele ja entra no
    // alcance e vira para o jogador
    const aOeste = plantarZumbi(-260);
    const aLeste = plantarZumbi(260);

    for (let i = 0; i < 60; i += 1) {
      await esperar(25);

      if (
        aOeste.aiState === "attack" &&
        aLeste.aiState === "attack"
      ) {
        break;
      }
    }

    const sprite = SPRITE();
    const oeste = estadoDo(aOeste);
    const leste = estadoDo(aLeste);

    // sem isto o sprite do cliente ficaria sempre no sul, que e o
    // `facing` inicial da criatura
    expect(oeste.facing).toBeTruthy();
    expect(typeof oeste.facing.x).toBe("number");
    expect(typeof oeste.facing.y).toBe("number");

    // o de oeste olha para o LESTE, onde esta a Ana
    expect(oeste.facing.x).toBeGreaterThan(0);
    expect(
      resolveFrameRect(sprite, "walk", 0, oeste.facing).y,
    ).toBe(sprite.directions.east * sprite.frameHeight);

    // e o de leste olha para o OESTE
    expect(leste.facing.x).toBeLessThan(0);
    expect(
      resolveFrameRect(sprite, "walk", 0, leste.facing).y,
    ).toBe(sprite.directions.west * sprite.frameHeight);

    // e as duas linhas sao diferentes: e a direcao que faz o sprite
    // girar o corpo, e nao a arte em si
    expect(
      resolveFrameRect(sprite, "walk", 0, oeste.facing).y,
    ).not.toBe(resolveFrameRect(sprite, "walk", 0, leste.facing).y);

    ana.desconectar();
  });

  it("o servidor avisa que o mob esta atirando", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    // plantado a LESTE da Ana, entao atira para o OESTE
    const zumbi = plantarZumbi(240);

    let tiro = null;

    for (let i = 0; i < 160; i += 1) {
      await esperar(25);

      const dado = estadoDo(zumbi);

      if (dado?.acting) {
        tiro = dado;
        break;
      }
    }

    // o zumbi atira varias vezes por segundo, entao se o aviso
    // sumisse o teste veria `null` aqui
    expect(tiro).toBeTruthy();

    // o aviso tem de vir JUNTO com a direcao, senao o arco entra
    // virado para o lado errado
    expect(tiro.facing).toBeTruthy();
    expect(tiro.facing.x).toBeLessThan(0);

    const sprite = SPRITE();

    // com o ataque marcado, a animacao escolhida e a de tiro
    expect(
      resolveCreatureAnimation({
        ...zumbi,
        attackAnimation: 0.2,
      }),
    ).toBe("attack");

    const linha = resolveFrameRect(sprite, "attack", 0, tiro.facing);

    // e a linha esta no BLOCO de tiro (linha 9 para o leste, 13
    // para o oeste), e nao no de caminhada (linhas 0 a 7)
    expect(linha.y).toBe(
      (sprite.animations.attack.rowOffset +
        sprite.directions.west) * sprite.frameHeight,
    );

    // e a MESMA linha que o offline escolheria, com o zumbi na
    // mesma posicao. se o cliente e o servidor discordassem da
    // direcao, a arte de tiro online sairia virada ao contrario
    const linhaDoServidor = resolveFrameRect(
      sprite,
      "attack",
      0,
      zumbi.facing,
    );

    expect(linhaDoServidor.y).toBe(linha.y);

    ana.desconectar();
  });

  it("quando o mob para de atirar, o aviso sai do pacote", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const zumbi = plantarZumbi(240);

    // espera ele entrar em recarga
    for (let i = 0; i < 160; i += 1) {
      await esperar(25);

      if (zumbi.attackAnimation <= 0 && zumbi.attackCooldownRemaining > 0) {
        break;
      }
    }

    const dado = estadoDo(zumbi);

    // `acting` e um INSTANTE e nao um estado: se ele ficasse true
    // para sempre, o zumbi ficaria permanentemente segurando o
    // arco, igual ao bug do arqueiro que o `REMOTO_ATAQUE` resolveu
    expect(dado.acting).toBe(false);

    ana.desconectar();
  });

  it("todos os mobs levam direcao, nao so o zumbi", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    // O mesmo furo atingia os mob de folha antiga tambem: eles
    // andavam sempre de frente para o sul e nunca olhavam para o
    // jogador. Com tres linhas e espelhamento o erro passa
    // despercebido, mas o mob atravessava a tela de lado sem virar
    const lista = jogo.estadoInimigos({
      session: { player: { x: 0, y: 0 } },
    });

    expect(lista.length).toBeGreaterThan(0);

    for (const dado of lista) {
      expect(
        typeof dado.facing?.x,
        `${dado.id} sem direcao no pacote`,
      ).toBe("number");

      expect(typeof dado.facing?.y).toBe("number");
      expect(typeof dado.acting).toBe("boolean");
    }

    ana.desconectar();
  });
});
