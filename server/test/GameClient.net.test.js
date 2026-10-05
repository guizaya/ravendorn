import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient, STATUS } from "../../src/game/net/GameClient.js";

/**
 * O cliente de rede contra o servidor DE VERDADE.
 *
 * Duas pontas de socket real, dois clientes reais. E o unico tipo
 * de teste que pega o que importa aqui: handshake, `seq`, e o
 * fato de o movimento realmente chegar do outro lado.
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

/** Cria um cliente de rede apontando para o servidor de teste. */
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

const esperar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Espera uma CONDICAO virar verdadeira, com um limite.
 *
 * Num teste de socket a espera fixa e uma aposta: a intencao tem que
 * viajar, o tick tem que rodar e o estado tem que voltar, e none
 * desses passos tem duracao garantida quando a maquina esta
 * ocupada. Esperar o efeito, em vez de um numero de milissegundos,
 * deixa o teste medir o que ele diz medir.
 */
async function esperarAte(
  condicao,
  tentativas = 120,
  passo = 25,
) {
  for (let i = 0; i < tentativas; i += 1) {
    if (condicao()) return true;

    await esperar(passo);
  }

  return false;
}

/** Espera o cliente passar a estar jogando. */
async function jogando(cliente, tentativas = 80) {
  for (let i = 0; i < tentativas; i += 1) {
    if (cliente.jogando() && cliente.playerId) return true;
    await esperar(25);
  }

  return false;
}

describe("o cliente entra no mundo", () => {
  it("conecta, envia o nome e recebe o id", async () => {
    const { cliente, status } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });

    expect(await jogando(cliente)).toBe(true);
    expect(cliente.playerId).toMatch(/^p_/);

    // a tela precisa passar por "conectando" antes de "jogando",
    // senao o botao de Jogar pisca sem explicacao
    expect(status).toContain(STATUS.CONECTANDO);
    expect(status).toContain(STATUS.JOGANDO);

    cliente.desconectar();
  });

  it("recebe o primeiro snapshot e sabe quem e ele", async () => {
    const { cliente, estados } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(cliente);
    await esperar(200);

    expect(estados.length).toBeGreaterThan(0);

    const ultimo = estados.at(-1);

    expect(ultimo.eu.id).toBe(cliente.playerId);
    // o recorte de interesse, nao os 83 do mapa
    expect(ultimo.inimigos.length).toBeGreaterThan(0);
    expect(ultimo.inimigos.length).toBeLessThan(83);
    expect(ultimo.outros).toHaveLength(0);

    cliente.desconectar();
  });

  it("recusa um nome invalido e diz o motivo", async () => {
    const { cliente, status } = criarCliente();

    cliente.entrar({ name: "A", classId: "warrior" });
    await esperar(200);

    // o servidor barra e o cliente diz que foi recusado, em vez de
    // ficar parado numa tela sem resposta
    expect(cliente.status).toBe(STATUS.RECUSADO);
    expect(cliente.motivoRecusa).toBeTruthy();
    expect(status).toContain(STATUS.RECUSADO);

    cliente.desconectar();
  });

  it("nao envia nada antes de receber o WELCOME", async () => {
    const { cliente } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });

    // um INPUT antes do JOIN seria recusado pelo servidor. o
    // cliente nao arrisca
    expect(cliente.jogando()).toBe(false);

    await jogando(cliente);
    cliente.desconectar();
  });
});

describe("andar pelo cliente mexe no servidor", () => {
  it("a intencao chega e o servidor e quem move", async () => {
    const { cliente } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(cliente);
    await esperar(150);

    const antes = jogo.engine.world.players.get(cliente.playerId)
      .player.x;

    cliente.keys.add("KeyD");
    cliente.sincronizarIntencao();

    // A espera e pelo MOVIMENTO, e nao por um tempo fixo. A
    // intencao precisa viajar pelo socket, o tick do servidor tem que
    // rodar e o estado tem que voltar: 250ms dava conta disso com a
    // maquina livre e nao dava com a suíte rodando em paralelo, onde
    // este teste falhava de tempos em tempos
    await esperarAte(() => {
      const agora = jogo.engine.world.players.get(
        cliente.playerId,
      ).player.x;

      return agora > antes;
    });

    const depois = jogo.engine.world.players.get(cliente.playerId)
      .player.x;

    // o servidor andou. o cliente nao guarda posicao para "por
    // segurar": ele so diz para onde quer ir
    expect(depois).toBeGreaterThan(antes);

    // o cliente ve a posicao do ULTIMO pacote, entao fica ate um
    // tick atras do servidor. e o esperado: se batesse exatamente,
    // seria porque o cliente estaria adivinhando o futuro
    //
    // A espera e pelo que o CLIENTE ve, e nao pelo servidor: os dois
    // sao caminhos diferentes. Esperar so o servidor e esperar cedo
    // demais: o teste lia a posicao do cliente antes de o pacote do
    // mundo chegar
    await esperarAte(() => {
      const visivel = cliente.mundo.eu(cliente.playerId).x;

      return visivel > antes;
    });

    const visto = cliente.mundo.eu(cliente.playerId).x;

    expect(visto).toBeGreaterThan(antes);

    // O cliente ve a posicao do ULTIMO pacote, entao pode estar
    // alguns ticks atras. Um numero solto na comparacao quebrava
    // quando a maquina carregava; a tolerancia vem da VELOCIDADE
    // real do jogador vezes 250ms (o intervalo de 5 ticks que o
    // cliente pode ficar sem news), entao ela tem um motivo.
    const sessao = jogo.engine.world.players.get(cliente.playerId);
    const tolerancia = sessao.player.speed * 0.25;

    expect(Math.abs(visto - depois)).toBeLessThan(tolerancia);

    cliente.desconectar();
  });

  it("soltar a tecla para o jogador", async () => {
    const { cliente } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(cliente);

    cliente.keys.add("KeyD");
    cliente.sincronizarIntencao();
    await esperar(200);

    cliente.keys.delete("KeyD");
    cliente.sincronizarIntencao();
    await esperar(200);

    const sessao = jogo.engine.world.players.get(cliente.playerId);

    expect(sessao.intent.moveX).toBe(0);

    const parado = sessao.player.x;
    await esperar(150);

    expect(sessao.player.x).toBe(parado);

    cliente.desconectar();
  });

  it("o pacote manda direcao, nunca posicao", async () => {
    const { cliente } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(cliente);

    const enviados = [];
    const original = cliente.socket.send.bind(cliente.socket);

    cliente.socket.send = (texto) => {
      enviados.push(JSON.parse(texto));
      original(texto);
    };

    cliente.keys.add("KeyD");
    cliente.sincronizarIntencao();

    const input = enviados.find((m) => m.type === "INPUT");

    // se aparecesse `x` no payload, um cliente modificado poderia
    // escolher a posicao e o movimento nao seria autoritativo
    expect(input).toBeTruthy();
    expect(input.payload.x).toBeUndefined();
    expect(input.payload.y).toBeUndefined();
    expect(input.payload.moveX).toBe(1);

    cliente.desconectar();
  });
});

describe("dois clientes no mesmo mundo", () => {
  it("cada um ve o outro na lista de jogadores", async () => {
    const ana = criarCliente();
    const bento = criarCliente();

    ana.cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(ana.cliente);

    bento.cliente.entrar({ name: "Bento", classId: "sorcerer" });
    await jogando(bento.cliente);

    await esperar(250);

    const snapAna = ana.cliente.amostra();
    const snapBento = bento.cliente.amostra();

    expect(snapAna.outros).toHaveLength(1);
    expect(snapAna.outros[0].id).toBe(bento.cliente.playerId);
    expect(snapAna.outros[0].name).toBe("Bento");

    expect(snapBento.outros[0].id).toBe(ana.cliente.playerId);

    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });

  it("os dois veem o mesmo slime na mesma posicao", async () => {
    const ana = criarCliente();
    const bento = criarCliente();

    ana.cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(ana.cliente);

    bento.cliente.entrar({ name: "Bento", classId: "sorcerer" });
    await jogando(bento.cliente);

    await esperar(250);

    const inimigoAna = ana.cliente.amostra().inimigos[0];
    const inimigoBento = bento.cliente.amostra().inimigos[0];

    // o mesmo id, a mesma posicao: e UM mob so, nao uma copia por
    // jogador
    expect(inimigoAna.id).toBe(inimigoBento.id);
    expect(inimigoAna.x).toBe(inimigoBento.x);

    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });

  it("um abate da Ana aparece para o Bento", async () => {
    const ana = criarCliente();
    const bento = criarCliente();

    ana.cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(ana.cliente);

    bento.cliente.entrar({ name: "Bento", classId: "sorcerer" });
    await jogando(bento.cliente);

    await esperar(200);

    const alvo = jogo.engine.world.enemies
      .filter((e) => e.isCreature && e.hp > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - 3000, a.y - 2100) -
          Math.hypot(b.x - 3000, b.y - 2100),
      )[0];

    jogo.engine.withPlayer(ana.cliente.playerId, () => {
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

    await esperar(250);

    const visto = bento.cliente
      .amostra()
      .inimigos.find((e) => e.id === alvo.id);

    expect(visto.state).toBe("dead");

    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });

  it("um jogador sair tira o nome da lista do outro", async () => {
    const ana = criarCliente();
    const bento = criarCliente();

    ana.cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(ana.cliente);

    bento.cliente.entrar({ name: "Bento", classId: "sorcerer" });
    await jogando(bento.cliente);

    await esperar(200);

    bento.cliente.desconectar();
    await esperar(300);

    // se o nome ficasse, a tela mostraria um "Bento" fantasma no
    // mapa para sempre
    expect(ana.cliente.amostra().outros).toHaveLength(0);
    expect(jogo.jogadores).toBe(1);

    ana.cliente.desconectar();
  });

  it("o drop no chao aparece para o dono e tem dono", async () => {
    const ana = criarCliente();
    const bento = criarCliente();

    ana.cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(ana.cliente);

    bento.cliente.entrar({ name: "Bento", classId: "sorcerer" });
    await jogando(bento.cliente);

    await esperar(200);

    jogo.engine.loot.roll = () => ({
      coins: 0,
      items: [{ itemId: "slime_gel", count: 1 }],
    });

    const sessao = jogo.engine.world.players.get(ana.cliente.playerId);
    sessao.inventory.capacity = 0;

    const mob = jogo.engine.world.enemies.find(
      (e) => e.isCreature && e.hp > 0,
    );

    jogo.engine.withPlayer(ana.cliente.playerId, () => {
      jogo.engine.killEnemy(mob, sessao.player);
    });

    await esperar(250);

    const drop = ana.cliente
      .amostra()
      .drops.find((d) => d.ownerId === ana.cliente.playerId);

    // o dono vai no pacote para o cliente saber o que pode
    // desenhar e pegar
    expect(drop).toBeTruthy();
    expect(drop.itemId).toBe("slime_gel");

    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });
});

describe("a queda da conexao", () => {
  it("o cliente avisa quando o servidor some", async () => {
    const { cliente, status } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(cliente);

    jogo.stop();
    for (const socket of wss.clients) socket.close();

    await esperar(250);

    // a tela precisa saber para mostrar "voce saiu", em vez de
    // ficar com o ultimo desenho congelado
    expect(cliente.status).not.toBe(STATUS.JOGANDO);
    expect(cliente.erro).toBeTruthy();

    void status;
  });

  it("desligar o cliente nao vira erro", async () => {
    const { cliente, status } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(cliente);

    cliente.desconectar();
    await esperar(200);

    // o `onclose` de uma saida planejada e FECHADO, nao ERRO. se
    // virasse erro, o jogador veria um alerta vermelho so por ter
    // saido do jogo
    expect(cliente.status).toBe(STATUS.FECHADO);
    expect(cliente.erro).toBe(null);

    void status;
  });

  it("nao explode se o socket nao existe", () => {
    const cliente = new GameClient({ url: "ws://x/ws" });

    // o `WebSocket` global nao existe no Node, entao nem
    // conectar deve ser obrigatorio para montar o objeto
    expect(() => cliente.sincronizarIntencao()).not.toThrow();
    expect(() => cliente.atacarAlvo("slime_0")).not.toThrow();
    expect(cliente.jogando()).toBe(false);
  });
});
