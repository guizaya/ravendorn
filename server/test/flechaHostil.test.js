import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";
import { CREATURE_TYPES } from "../../src/data/enemies/index.js";

/**
 * A flecha do arqueiro zumbi pela rede.
 *
 * O tiro do inimigo nasce em `world.projectiles`, a MESMA lista que
 * o jogador usa. Isso e de proposito: o `estadoProjetis` do
 * servidor, o `WorldState` do cliente e o `drawProjectiles` ja sabem
 * ler dessa lista. O que precisa ser provado aqui e que o tiro
 * hostil sobrevive a esse caminho compartilhado e que o dano cai na
 * sessao de quem foi atingido, e nao na do outro jogador.
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

  /**
   * Todo golpe ACERTA.
   *
   * Este arquivo mede se a flecha hostil chega no jogador certo. O
   * zumbi tem esquiva e o alvo tem esquiva, e um teste que espera o HP
   * cair passaria a depender do dado
   */
  jogo.engine.damage.random = () => 1;

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
    if (cliente.painel?.player) return cliente;

    await esperar(25);
  }

  throw new Error(`o painel de ${nome} nao chegou`);
}

/** Espera uma flecha hostil aparecer no mundo do cliente. */
describe("a flecha do zumbi chega no cliente", () => {
  it("o snapshot leva a flecha com a arte de arco", async () => {
    const ana = criarCliente();
    await entrar(ana, "Ana");

    const sessao = [...jogo.engine.world.players.values()].at(-1);
    const jogador = sessao.player;

    // um zumbi do lado da Ana, dentro do alcance e fora da
    // distancia minima: ele dispara em vez de recuar
    const { createCreature } = await import(
      "../../src/data/enemies/index.js"
    );

    const zumbi = createCreature(
      "zumbi_arbalist",
      { x: jogador.x + 240, y: jogador.y },
      999,
      CREATURE_TYPES.zumbi_arbalist.level,
    );

    jogo.engine.world.enemies.push(zumbi);

    // espera o pacote de mundo com a flecha
    let vista = null;

    for (let i = 0; i < 200 && !vista; i += 1) {
      await esperar(25);

      const hostile = jogo.engine.world.projectiles.find(
        (p) => p.hostile,
      );

      if (hostile) {
        vista = jogo.estadoProjetis({
          session: { player: jogador },
        });

        if (vista.length > 0) break;
      }
    }

    expect(
      vista,
      "a flecha hostil nao apareceu no estado",
    ).not.toBeNull();
    expect(vista.length).toBeGreaterThan(0);

    const [flecha] = vista;

    // os campos que o desenho do cliente le
    expect(flecha.style).toBe("arrow");
    expect(flecha.color).toBe(
      CREATURE_TYPES.zumbi_arbalist.projectileColor,
    );
    expect(Number.isFinite(flecha.x)).toBe(true);
    expect(Number.isFinite(flecha.velocityX)).toBe(true);

    // a flecha e do MUNDO, entao o filtro de interesse a mantem
    ana.desconectar();
  });

  it(
    "o dano da flecha cai na sessao de quem foi atingido",
    async () => {
      const ana = criarCliente();
      await entrar(ana, "Ana");

      const bento = criarCliente();
      await entrar(bento, "Bento");

      const sessoes = [...jogo.engine.world.players.values()];
      const sessaoAna = sessoes.find((s) => s.name === "Ana");
      const sessaoBento = sessoes.find((s) => s.name === "Bento");

      // Todo mundo nasce no MESMO ponto do mapa. Para este teste os
      // dois precisam estar longe um do outro, senao o
      // `nearestPlayer` da IA nao tem com quem decidir e os dois
      // zumbis atiram no mesmo alvo
      sessaoBento.player.x += 900;
      sessaoBento.player.y += 700;

      const { createCreature } = await import(
        "../../src/data/enemies/index.js"
      );

      // um zumbi ao lado de CADA jogador, cada um atirando no seu
      const zumbiDaAna = createCreature(
        "zumbi_arbalist",
        { x: sessaoAna.player.x + 240, y: sessaoAna.player.y },
        998,
        CREATURE_TYPES.zumbi_arbalist.level,
      );

      const zumbiDoBento = createCreature(
        "zumbi_arbalist",
        { x: sessaoBento.player.x - 240, y: sessaoBento.player.y },
        997,
        CREATURE_TYPES.zumbi_arbalist.level,
      );

      jogo.engine.world.enemies.push(zumbiDaAna, zumbiDoBento);

      // quem resolve a flecha e o loop do proprio servidor: este
      // teste nao empurra nada a mao, ele espera o motor trabalhar
      const hpAnaAntes = sessaoAna.player.hp;
      const hpBentoAntes = sessaoBento.player.hp;

      for (let i = 0; i < 120; i += 1) {
        await esperar(25);

        if (
          sessaoAna.player.hp < hpAnaAntes &&
          sessaoBento.player.hp < hpBentoAntes
        ) {
          break;
        }
      }

      // cada um levou no seu proprio inventario
      expect(
        sessaoAna.player.hp,
        "a Ana nao levou dano da flecha",
      ).toBeLessThan(hpAnaAntes);

      expect(
        sessaoBento.player.hp,
        "o Bento nao levou dano da flecha",
      ).toBeLessThan(hpBentoAntes);

      // e o painel de cada um mostra a vida DELE, e nao a do
      // parceiro: o foco do motor e trocado por sessao
      for (let i = 0; i < 80; i += 1) {
        await esperar(25);

        if (
          ana.painel?.player?.hp === sessaoAna.player.hp &&
          bento.painel?.player?.hp === sessaoBento.player.hp
        ) {
          break;
        }
      }

      expect(ana.painel?.player?.id).toBe(sessaoAna.id);
      expect(bento.painel?.player?.id).toBe(sessaoBento.id);

      // o painel vai 4x por segundo, entao a vida só pode ser
      // comparada depois que ele alcança o servidor. sem esta
      // espera a comparação seria entre o hp velho do pacote e o hp
      // novo do motor
      expect(
        ana.painel?.player?.hp,
        "o painel da Ana nao alcançou a vida dela",
      ).toBe(sessaoAna.player.hp);

      expect(bento.painel?.player?.hp).toBe(sessaoBento.player.hp);

      ana.desconectar();
      bento.desconectar();
    },
    15000,
  );
});
