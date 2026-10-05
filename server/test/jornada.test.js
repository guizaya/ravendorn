import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient, STATUS } from "../../src/game/net/GameClient.js";
import { WorldState } from "../../src/game/net/WorldState.js";
import { NetworkWorld } from "../../src/game/net/NetworkWorld.js";
import { GameEngine } from "../../src/game/engine/GameEngine.js";
import { CHARACTER_CLASSES } from "../../src/data/characters/index.js";
import { MAP_1 } from "../../src/data/maps/index.js";

/**
 * A jornada inteira: aperta a tecla, o servidor move, o snapshot
 * volta, a tela escreve na entidade que vai ser desenhada.
 *
 * Cada arquivo de teste ate agora cobriu uma ponta. Este junta as
 * quatro num so fluxo, que e o caminho que o jogador realmente
 * percorre. Um pacote que chega com nome de campo diferente, ou um
 * `snapshot` que nunca chega a tela, passa em todos os testes
 * separados e quebra aqui.
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

const esperar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Espera a condicao valer, em vez de dormir um tempo chute.
 *
 * O painel vai 4 vezes por segundo (250ms) e o mundo 20 (50ms).
 * Dormir 400ms e torcer funciona ate o CI ficar carregado; dai o
 * teste falha sem ter nada errado. Sono sem condicao tambem
 * esconde bug real: um pacote que nunca chega passaria em 400ms.
 */
async function esperarQue(
  condicao,
  { tentativas = 60, passo = 25, descricao = "condicao" } = {},
) {
  for (let i = 0; i < tentativas; i += 1) {
    const valor = condicao();

    if (valor) return valor;

    await esperar(passo);
  }

  throw new Error(
    `esperou ${descricao} por ${tentativas * passo}ms e nao veio`,
  );
}

/** O cliente de rede, como o navegador usaria. */
function criarCliente(nome = "Ana", classId = "warrior") {
  const estados = [];

  const cliente = new GameClient({
    url: `ws://127.0.0.1:${porta}/ws`,
    WebSocketImpl: WebSocket,
    onState: (e) => estados.push(e),
  });

  cliente.conectar();

  return { cliente, estados };
}

async function jogando(cliente, tentativas = 100) {
  for (let i = 0; i < tentativas; i += 1) {
    if (cliente.jogando() && cliente.playerId) return true;
    await esperar(25);
  }

  return false;
}

/** O motor de desenho, como o canvas montaria. */
function criarMotor(classId = "warrior") {
  const engine = new GameEngine(
    null,
    CHARACTER_CLASSES.find((c) => c.id === classId),
    null,
    { playerId: "p_ana", characterName: "Ana" },
  );

  engine.setMap(MAP_1);
  engine.setNetworked(true);

  return { engine, mundo: new NetworkWorld(engine) };
}

describe("o caminho inteiro, do teclado ao desenho", () => {
  it("andar chega no servidor e volta para o motor", async () => {
    const { cliente } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });

    expect(await jogando(cliente)).toBe(true);
    await esperar(150);

    const { engine, mundo } = criarMotor();

    const xServidorAntes =
      jogo.engine.world.players.get(cliente.playerId).player.x;

    // 1. o jogador aperta D
    cliente.keys.add("KeyD");
    cliente.sincronizarIntencao();

    await esperar(250);

    // 2. o servidor moveu
    const xServidorDepois =
      jogo.engine.world.players.get(cliente.playerId).player.x;

    expect(xServidorDepois).toBeGreaterThan(xServidorAntes);

    // 3. o estado que a tela recebeu
    const estado = cliente.amostra();

    expect(estado.eu).toBeTruthy();
    expect(estado.eu.x).toBeGreaterThan(0);

    // 4. a ponte escreveu na entidade que sera desenhada
    mundo.aplicar(estado);

    expect(engine.world.player.x).toBe(estado.eu.x);
    expect(engine.world.player.x).toBeGreaterThan(0);

    // 5. e o motor nao mexeu: quem move e o servidor
    const xDepoisDoFrame = engine.world.player.x;

    engine.update(0.5);
    engine.update(0.5);

    expect(engine.world.player.x).toBe(xDepoisDoFrame);

    cliente.desconectar();
  });

  it("o painel volta e escreve no HUD", async () => {
    const { cliente, estados } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });

    expect(await jogando(cliente)).toBe(true);

    // o painel chega a 4Hz, entao esperar um tempo fixo e torcer
    // falha assim que a maquina carrega
    await esperarQue(
      () => estados.at(-1)?.painel,
      { descricao: "o primeiro painel" },
    );

    // o painel tem a MESMA forma que o offline montava, entao o
    // HUD nao precisou mudar
    const ultimo = estados.at(-1);

    expect(ultimo.painel).toBeTruthy();
    expect(ultimo.painel.player.name).toBe("Ana");
    expect(ultimo.painel.inventory).toBeTruthy();
    expect(ultimo.painel.equipment).toBeTruthy();
    expect(ultimo.painel.quests).toBeTruthy();
    expect(ultimo.painel.craft).toBeTruthy();

    cliente.desconectar();
  });

  it("dar um item no servidor aparece no painel do cliente", async () => {
    const { cliente, estados } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });
    expect(await jogando(cliente)).toBe(true);

    // o painel chega a 4Hz, entao nao da para supor que ja veio
    // depois de um tempo fixo
    await esperarQue(
      () => estados.at(-1)?.painel,
      { descricao: "o primeiro painel" },
    );

    const antes = estados.at(-1).painel.inventory.items.length;

    // o servidor da um item, como se um mob tivesse dropado
    const sessao = jogo.engine.world.players.get(cliente.playerId);

    jogo.engine.withPlayer(cliente.playerId, () => {
      jogo.engine.world.inventory.add("slime_gel", 2);
    });

    // o painel precisa voltar sozinho, sem o cliente pedir nada
    const painel = await esperarQue(
      () => {
        const p = estados.at(-1)?.painel;

        return p?.inventory.items.some(
          (i) => i.itemId === "slime_gel",
        )
          ? p
          : null;
      },
      { descricao: "o painel com o slime_gel" },
    );
    const slime = painel.inventory.items.find(
      (i) => i.itemId === "slime_gel",
    );

    // veio exatamente um stack novo
    expect(painel.inventory.items.length).toBe(antes + 1);

    expect(slime.count).toBe(2);

    expect(sessao).toBeTruthy();
    cliente.desconectar();
  });

  it("equipar pelo cliente so vale depois que o servidor confirma", async () => {
    const { cliente, estados } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });
    expect(await jogando(cliente)).toBe(true);

    // o painel chega a 4Hz: esperar um tempo fixo e torcer falha
    // quando a maquina carrega
    await esperarQue(
      () => estados.at(-1)?.painel,
      { descricao: "o primeiro painel" },
    );

    const sessao = jogo.engine.world.players.get(cliente.playerId);

    sessao.inventory.add("willow_bow", 1);

    const uid = sessao.inventory.summary().items[0].uid;

    // o pedido vai. o cliente NAO cambia nada por conta propria
    cliente.equipar(uid, "weapon");

    const mudouNaHora = estados.at(-1).painel.equipment.slots.find(
      (s) => s.id === "weapon",
    );

    // o estado que o cliente tinha antes de pedir
    expect(mudouNaHora.itemId).toBeFalsy();

    // depois da confirmacao, aparece
    const confirmado = await esperarQue(
      () => {
        const arma = estados
          .at(-1)
          ?.painel?.equipment?.slots?.find((s) => s.id === "weapon");

        return arma?.itemId ? arma : null;
      },
      { descricao: "a confirmacao do servidor" },
    );

    expect(confirmado.itemId).toBe("willow_bow");

    cliente.desconectar();
  });

  it("um abate aparece no desenho dos dois", async () => {
    const ana = criarCliente("Ana", "warrior");
    const bento = criarCliente("Bento", "sorcerer");

    ana.cliente.entrar({ name: "Ana", classId: "warrior" });
    expect(await jogando(ana.cliente)).toBe(true);

    bento.cliente.entrar({ name: "Bento", classId: "sorcerer" });
    expect(await jogando(bento.cliente)).toBe(true);

    await esperar(250);

    // um mob perto dos dois
    const alvo = jogo.engine.world.enemies
      .filter((e) => e.isCreature && e.hp > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - 3000, a.y - 2100) -
          Math.hypot(b.x - 3000, b.y - 2100),
      )[0];

    const sessao = jogo.engine.world.players.get(ana.cliente.playerId);

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

    // o motor de cada um, e o mob morto some dos dois
    const daAna = criarMotor();
    const doBento = criarMotor();

    daAna.mundo.aplicar(ana.cliente.amostra());
    doBento.mundo.aplicar(bento.cliente.amostra());

    const paraAna = daAna.mundo.porId.get(alvo.id);
    const paraBento = doBento.mundo.porId.get(alvo.id);

    expect(paraAna.alive).toBe(false);
    expect(paraBento.alive).toBe(false);

    // e o loot foi so para quem matou
    expect(sessao.inventory.coins >= 0).toBe(true);

    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });
});

describe("a tela ve os outros jogadores", () => {
  it("cada um desenha o outro pelo nome", async () => {
    const ana = criarCliente("Ana", "warrior");
    const bento = criarCliente("Bento", "sorcerer");

    ana.cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(ana.cliente);

    bento.cliente.entrar({ name: "Bento", classId: "sorcerer" });
    await jogando(bento.cliente);

    await esperar(250);

    const estado = ana.cliente.amostra();
    const { engine, mundo } = criarMotor();

    mundo.aplicar(estado);

    const remoto = mundo.porId.get(bento.cliente.playerId);

    // sem isto, o Bento entraria no mundo como um mob anonimo e
    // o jogador nao saberia com quem esta brigando
    expect(remoto).toBeTruthy();
    expect(remoto.isPlayer).toBe(true);
    expect(remoto.name).toBe("Bento");

    // e ele esta na lista de desenho, junto dos inimigos
    expect(engine.world.enemies).toContain(remoto);

    // e com a figura da CLASSE dele, e nao a de um mob
    const folha = engine.spriteDeClasse(remoto.classId);

    expect(folha.definition.id).toBe("sorcerer");
    expect(engine.enemySprites.has(remoto.id)).toBe(false);

    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });

  it("dois Arbalist veem a figura de Arbalist um no outro", async () => {
    const ana = criarCliente("Ana", "arbalist");
    const bento = criarCliente("Bento", "arbalist");

    ana.cliente.entrar({ name: "Ana", classId: "arbalist" });
    await jogando(ana.cliente);

    bento.cliente.entrar({ name: "Bento", classId: "arbalist" });
    await jogando(bento.cliente);

    await esperar(250);

    // o relato do bug: o segundo jogador saia com a imagem de
    // um mob. o que o servidor manda precisa ter a classe, e o
    // cliente precisa transformar isso na folha certa
    const snap = ana.cliente.amostra();
    const outro = snap.outros[0];

    expect(outro.classId).toBe("arbalist");

    const { engine, mundo } = criarMotor("arbalist");
    mundo.aplicar(snap);

    const remoto = mundo.porId.get(outro.id);

    expect(engine.spriteDeClasse(remoto.classId).definition.id).toBe(
      "arbalist",
    );

    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });

  it("o servidor avisa que o outro esta atirando", async () => {
    const ana = criarCliente("Ana", "arbalist");
    const bento = criarCliente("Bento", "arbalist");

    ana.cliente.entrar({ name: "Ana", classId: "arbalist" });
    await jogando(ana.cliente);

    bento.cliente.entrar({ name: "Bento", classId: "arbalist" });
    await jogando(bento.cliente);

    await esperar(250);

    // a arte de tiro do outro jogador depende deste sinal. sem
    // ele, o Arbalist remoto fica parado no idle mesmo atirando
    const sessao = jogo.engine.world.players.get(
      bento.cliente.playerId,
    );

    jogo.engine.withPlayer(bento.cliente.playerId, () => {
      // A janela e maior que a pausa de baixo de proposito. Com
      // 0.2s, o teste era uma corrida: sob carga (a suíte inteira
      // rodando em paralelo) o `esperar(150)` passa de 200ms, a
      // animacao acaba antes de o pacote ser amostrado e o
      // `acting` chega falso. Isso falhava 1 vez a cada varias
      // execucoes, sem nenhuma mudanca no jogo.
      //
      // O que o teste quer provar e que o SINAL chega, nao quanto
      // dura a arte. 1.5s Folga o atraso sem mudar o caminho do
      // codigo: o pacote ainda carrega `acting` porque o valor
      // estava acima de zero
      jogo.engine.world.player.attackAnimation = 1.5;
      jogo.engine.world.player.firingTargetId = "slime_0";
    });

    await esperar(150);

    const visto = ana.cliente
      .amostra()
      .outros.find((p) => p.id === bento.cliente.playerId);

    expect(visto.acting).toBe(true);
    expect(visto.hasTarget).toBe(true);

    expect(sessao).toBeTruthy();
    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });

  it("o outro jogador some quando sai", async () => {
    const ana = criarCliente("Ana", "warrior");
    const bento = criarCliente("Bento", "sorcerer");

    ana.cliente.entrar({ name: "Ana", classId: "warrior" });
    await jogando(ana.cliente);

    bento.cliente.entrar({ name: "Bento", classId: "sorcerer" });
    await jogando(bento.cliente);

    await esperar(250);

    const { mundo } = criarMotor();
    mundo.aplicar(ana.cliente.amostra());

    expect(mundo.porId.has(bento.cliente.playerId)).toBe(true);

    bento.cliente.desconectar();
    await esperar(350);

    mundo.aplicar(ana.cliente.amostra());

    // sem a limpeza, o Bento ficaria congelado no mapa para sempre
    expect(mundo.porId.has(bento.cliente.playerId)).toBe(false);
  });
});

describe("o cliente nao inventa nada", () => {
  it("nao guarda inventario local para fingir que tem", async () => {
    const { cliente, estados } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });
    expect(await jogando(cliente)).toBe(true);

    // idem: o painel chega a 4Hz
    await esperarQue(
      () => estados.at(-1)?.painel,
      { descricao: "o primeiro painel" },
    );

    const painel = estados.at(-1).painel;

    // o inventario do cliente e uma COPIA do que o servidor
    // mandou. ele nao tem um proprio, entao nao ha como "usar"
    // um item que ele nao tem
    expect(painel.inventory.items).toEqual([]);

    // e o servidor concorda
    const sessao = jogo.engine.world.players.get(cliente.playerId);

    expect(sessao.inventory.summary().items).toEqual([]);

    cliente.desconectar();
  });

  it("o estado do mundo ignora pacote atrasado", async () => {
    const mundo = new WorldState();

    mundo.aplicar({
      seq: 10,
      time: 1,
      players: [{ id: "p", x: 100, y: 100 }],
      enemies: [],
      drops: [],
    });

    const aceitou = mundo.aplicar({
      seq: 4,
      time: 0.4,
      players: [{ id: "p", x: 0, y: 0 }],
      enemies: [],
      drops: [],
    });

    // se aceitasse, o jogador voltaria para a posicao antiga
    expect(aceitou).toBe(false);
    expect(mundo.eu("p").x).toBe(100);
  });
});

describe("o servidor sobrevive a jogador indo e voltando", () => {
  it("o ultimo a sair nao derruba o laco", async () => {
    const { cliente } = criarCliente();

    cliente.entrar({ name: "Ana", classId: "warrior" });
    expect(await jogando(cliente)).toBe(true);

    await esperar(200);
    cliente.desconectar();
    await esperar(200);

    // o mundo fica sem ninguem por um tempo. e exatamente aqui que
    // o motor quebrava: sem sessao em foco, o painel nao tem
    // inventario, e a excecao dentro do setInterval matava o timer
    expect(jogo.jogadores).toBe(0);

    // e o laco continua: um jogador novo entra e funciona
    const segundo = criarCliente("Bento", "sorcerer");

    segundo.cliente.entrar({
      name: "Bento",
      classId: "sorcerer",
    });

    expect(await jogando(segundo.cliente)).toBe(true);
    await esperar(200);

    expect(segundo.cliente.amostra().eu).toBeTruthy();
    expect(segundo.cliente.status).toBe(STATUS.JOGANDO);

    segundo.cliente.desconectar();
  });
});
