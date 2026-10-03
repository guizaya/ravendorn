import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";
import {
  GUILD_CRIACAO_CUSTO,
  GUILD_MENSAGEM,
  GUILD_ROLE,
} from "../../src/data/guild/index.js";

/**
 * A GUILDA, de ponta a ponta.
 *
 * Socket de verdade dos dois lados, como o `GameClient.net.test.js`
 * faz. E a unica forma de medir o que esta feature inteira precisa
 * medir: o caminho do pedido tem nove OPERACOES e cada uma passa por
 * `parsePanel`, pelo store e de volta pelo painel
 *
 * O que este arquivo pega, e que nenhum outro pega:
 *
 * 1. **o ciclo de duas sessoes.** Criar guilda, sair e entrar de novo
 *    tem que devolver o MESMO estado. O store e global no servidor, e
 *    a sessao recriada a cada conexao — se o estado ficasse na sessao,
 *    a guilda desapareceria a cada reconnect
 * 2. **o accrue offline entre conexoes.** O ponto de uma hora e
 *    justamente do jogador que saiu: e o `ultimoPontoEm` no save que
 *    faz esse teste possivel sem esperar uma hora
 * 3. **o gasto de ponto.** Destravar tem que tirar do saldo do jogador
 *    e marcar na arvore da GUILDA, e nao da sessao
 */

let http;
let wss;
let jogo;
let porta;
let pasta;

const esperar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Espera uma CONDICAO, com limite.
 *
 * Em socket a espera fixa e uma aposta: o handshake tem que acontecer,
 * o tick tem que rodar e o pacote tem que voltar
 */
async function esperarAte(condicao, tentativas = 160, passo = 25) {
  for (let i = 0; i < tentativas; i += 1) {
    if (condicao()) return true;

    await esperar(passo);
  }

  return false;
}

/**
 * um servidor com o relogio na mao E com a persistencia ligada.
 *
 * A persistencia e o que segura o accrue offline entre conexoes, e ela
 * vem DESLIGADA por padrao no `GameServer` — de proposito, para os
 * testes nao escreverem todos no mesmo lugar. Aqui ela e ligada numa
 * pasta temporaria, porque este arquivo mede justamente o que acontece
 * entre um `desconectar` e o `entrar` seguinte
 *
 * Sem isso o `guardar` era um no-op silencioso (`this.saves` era
 * `null`), o save nao existia, e o `ultimoPontoEm` voltava `null` a
 * cada entrada: o relogio reiniciava e o jogador que dormiu tres horas
 * voltava com zero pontos
 */
function subir(relogio = { agora: 1_000_000 }) {
  pasta = mkdtempSync(join(tmpdir(), "guilda-"));

  return new Promise((resolve) => {
    http = createServer();

    http.listen(0, "127.0.0.1", () => {
      porta = http.address().port;

      wss = new WebSocketServer({ server: http, path: "/ws" });

      jogo = new GameServer({
        config: { ...SERVER_CONFIG, agora: () => relogio.agora },
        mapId: "map_1",
        persistencia: { pasta: join(pasta, "personagens") },
      });

      wss.on("connection", (socket) => {
        const c = new Client(socket);

        jogo.conectar(c);

        socket.on("message", (bruto) => {
          if (bruto.length > 8 * 1024) return;
          if (!c.limiter.permite()) return;

          jogo.receber(c, bruto.toString());
        });

        socket.on("close", () => jogo.desconectar(c));
      });

      jogo.start();

      resolve(relogio);
    });
  });
}

/** um cliente de verdade, com o painel guardado */
function criarCliente() {
  const estados = [];

  const cliente = new GameClient({
    url: `ws://127.0.0.1:${porta}/ws`,
    WebSocketImpl: WebSocket,
    onStatus: () => {},
    onState: (s) => estados.push(s),
  });

  cliente.conectar();

  return { cliente, estados };
}

/** entra e espera o primeiro painel */
async function entrar(nome, classeId = "warrior") {
  const { cliente, estados } = criarCliente();

  cliente.entrar({ name: nome, classId: classeId });

  const chegou = await esperarAte(() => cliente.painel);

  return { cliente, estados, chegou };
}

/** o painel mais recente */
const painelDe = (estados) => {
  for (let i = estados.length - 1; i >= 0; i -= 1) {
    if (estados[i]?.painel) return estados[i].painel;
  }

  return null;
};

/** o id da sessao do servidor, para o teste mexer no mundo */
const sessaoDe = (nome) =>
  [...jogo.engine.world.players.values()].find(
    (s) => s.name === nome,
  );

/**
 * DA as moedas da taxa a um jogador.
 *
 * Fundar uma guilda custa `GUILD_CRIACAO_CUSTO`, e um personagem novo
 * comeca com pouco. Sem isto o teste nem chega na guilda: o servidor
 * recusa com "moedas insuficientes" e todos os passos seguintes falam
 * de uma guilda que nunca existiu — um teste que passa por um caminho
 * que o jogador real nao percorre
 *
 * Dar pelo servidor e nao pelo `GameClient` porque o cliente nao tem
 * operacao de credito: e dinheiro de teste, nao uma feature
 */
function darTaxa(nome) {
  sessaoDe(nome).inventory.addCoins(GUILD_CRIACAO_CUSTO);
}

/**
 * Derruba o servidor do teste.
 *
 * Cada teste sobe o seu, e sem este `afterEach` os sete ficavam de pe
 * ate o fim do arquivo: sockets abertos, ticks rodando e portas presas.
 * Isso nao dava erro, mas comia o tempo do teste seguinte ate o
 * primeiro pedido estourar o timeout de 5s — o sintoma parecia um
 * defeito da guilda e era so falta de limpeza
 */
afterEach(async () => {
  for (const socket of wss?.clients ?? []) socket.terminate();

  jogo?.stop();

  /**
   * `http.close()` sozinho espera as conexoes irem, e o `ws` segura
   * keep-alive que nao morre no `terminate`. Sem o
   * `closeAllConnections` o hook estourava em 10s
   *
   * E o `Promise.race` com o alarme e a rede de seguranca: melhor um
   * teardown curto e um servidor vazado do que um arquivo de teste que
   * nunca chega ao ultimo teste
   */
  const alarme = Symbol("alarme");

  const espera = (ms) =>
    new Promise((resolve) => setTimeout(() => resolve(alarme), ms));

  await Promise.race([
    Promise.all([
      new Promise((resolve) => {
        if (!wss) return resolve();
        wss.close(resolve);
      }),
      new Promise((resolve) => {
        if (!http) return resolve();
        http.closeAllConnections?.();
        http.close(resolve);
      }),
    ]),
    espera(2000),
  ]);

  if (pasta) rmSync(pasta, { recursive: true, force: true });

  http = null;
  wss = null;
  jogo = null;
  porta = null;
  pasta = null;
});

describe("a taxa de criacao", () => {
  it("sem o dinheiro, a guilda nao nasce e o motivo diz o preco", { timeout: 20000 }, async () => {
    await subir();

    const { cliente, estados } = await entrar("Ana");

    // um centavo a menos do que a taxa
    sessaoDe("Ana").inventory.addCoins(GUILD_CRIACAO_CUSTO - 1);

    cliente.criarGuilda("Lobos", "lmao");

    await esperar(400);

    expect(painelDe(estados).guilda.guilda).toBe(null);

    // o aviso do servidor e `{ text, bad }`, nao a frase solta
    expect(painelDe(estados).message?.text).toBe(
      GUILD_MENSAGEM.moedasInsuficientes,
    );

    // e o dinheiro do jogador continua inteiro
    expect(sessaoDe("Ana").inventory.coins).toBe(
      GUILD_CRIACAO_CUSTO - 1,
    );

    cliente.desconectar();
  });

  it("cobra a taxa e põe o valor no cofre da guilda recem-criada", { timeout: 20000 }, async () => {
    await subir();

    const { cliente, estados } = await entrar("Ana");

    darTaxa("Ana");

    cliente.criarGuilda("Lobos", "lmao");

    const viu = await esperarAte(
      () => painelDe(estados).guilda.guilda !== null,
    );

    expect(viu, "a guilda nao nasceu").toBe(true);

    // os dez milhoes sairam do bolso
    expect(sessaoDe("Ana").inventory.coins).toBe(0);

    // e foram para o patrimonio coletivo
    const cofre = jogo.guild
      .get(painelDe(estados).guilda.guilda.id)
      .cofre;

    expect(cofre.moedas).toBe(GUILD_CRIACAO_CUSTO);

    cliente.desconectar();
  });

  it("nome ja usado nao custa a taxa", { timeout: 20000 }, async () => {
    await subir();

    const ana = await entrar("Ana");

    darTaxa("Ana");

    ana.cliente.criarGuilda("Lobos", "lmao");

    await esperarAte(
      () => painelDe(ana.estados).guilda.guilda !== null,
    );

    // um segundo jogador, com a taxa no bolso
    const bento = await entrar("Bento");

    darTaxa("Bento");

    bento.cliente.criarGuilda("Lobos", "outra");

    await esperar(400);

    // recusou, e o dinheiro voltou
    expect(painelDe(bento.estados).guilda.guilda).toBe(null);
    expect(sessaoDe("Bento").inventory.coins).toBe(GUILD_CRIACAO_CUSTO);

    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });
});

describe("a guilda de ponta a ponta", () => {
  it("o primeiro jogador cria e o painel mostra a guilda", async () => {
    await subir();

    const { cliente, estados, chegou } = await entrar("Ana");

    expect(chegou, "o painel nao chegou").toBe(true);

    // antes de criar: sem guilda, com a arvore na tela
    expect(painelDe(estados).guilda.guilda).toBe(null);

    darTaxa("Ana");

    cliente.criarGuilda("Lobos Famintos", "lmao");

    const viu = await esperarAte(
      () => painelDe(estados).guilda.guilda !== null,
    );

    expect(viu, "a guilda criada nao chegou no painel").toBe(true);

    const painel = painelDe(estados);

    expect(painel.guilda.guilda.nome).toBe("Lobos Famintos");
    expect(painel.guilda.guilda.tag).toBe("LMAO");
    expect(painel.guilda.ehLider).toBe(true);

    cliente.desconectar();
  });

  it("o pedido de entrada chega na guilda do outro", { timeout: 20000 }, async () => {
    await subir();

    const ana = await entrar("Ana");

    darTaxa("Ana");

    ana.cliente.criarGuilda("Lobos Famintos", "lmao");

    await esperarAte(
      () => painelDe(ana.estados).guilda.guilda !== null,
    );

    const bento = await entrar("Bento");

    // o Bento procura a guilda da Ana
    bento.cliente.buscarGuilda("lobos");

    const achou = await esperarAte(
      () => painelDe(bento.estados).guilda.busca.length > 0,
    );

    expect(achou, "a busca nao achou a guilda").toBe(true);

    const [achada] = painelDe(bento.estados).guilda.busca;

    expect(achada.nome).toBe("Lobos Famintos");
    expect(achada.membros).toBe(1);

    bento.cliente.pedirGuilda(achada.id);

    const temPedido = await esperarAte(
      () => painelDe(ana.estados).guilda.guilda.pedidos.length > 0,
    );

    expect(temPedido, "o pedido nao chegou na guilda").toBe(true);

    expect(
      painelDe(ana.estados).guilda.guilda.pedidos[0].nome,
    ).toBe("Bento");

    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });

  it("so a diretoria aceita, e o aceito vira membro", { timeout: 20000 }, async () => {
    await subir();

    const ana = await entrar("Ana");

    darTaxa("Ana");

    ana.cliente.criarGuilda("Lobos", "lmao");

    await esperarAte(
      () => painelDe(ana.estados).guilda.guilda !== null,
    );

    const idDaGuilda =
      painelDe(ana.estados).guilda.guilda.id;

    const bento = await entrar("Bento");

    bento.cliente.pedirGuilda(idDaGuilda);

    await esperarAte(
      () => painelDe(ana.estados).guilda.guilda.pedidos.length > 0,
    );

    const alvo =
      painelDe(ana.estados).guilda.guilda.pedidos[0].jogadorId;

    // o Bento tenta aceitar o PROPRIO pedido: sem cargo, nada acontece
    bento.cliente.aceitarGuilda(idDaGuilda, alvo);

    await esperar(400);

    expect(
      painelDe(ana.estados).guilda.guilda.pedidos.length,
      "um membro comum aceitou um pedido",
    ).toBe(1);

    // a Ana aceita
    ana.cliente.aceitarGuilda(idDaGuilda, alvo);

    const entrou = await esperarAte(
      () =>
        painelDe(ana.estados).guilda.guilda.membros.length === 2,
    );

    expect(entrou, "o Bento nao entrou na guilda").toBe(true);

    /**
     * E o BENTO que precisa aparecer na guilda nova, entao e o painel
     * DELE que a espera tem de olhar.
     *
     * Aguadar o da Ana e ler o do Bento em seguida e uma corrida: os
     * dois ticks sao pushes separados, e o do Bento chega um tick
     * depois. O guilda aparece para os dois ao mesmo tempo no servidor,
     * mas nao no socket
     */
    const viu = await esperarAte(
      () => painelDe(bento.estados).guilda.guilda !== null,
    );

    expect(viu, "o Bento nao viu a guilda que entrou").toBe(true);

    // e o Bento ve a guilda nova, sem ser o dono dela
    const painelBento = painelDe(bento.estados);

    expect(painelBento.guilda.guilda.id).toBe(idDaGuilda);
    expect(painelBento.guilda.ehLider).toBe(false);

    ana.cliente.desconectar();
    bento.cliente.desconectar();
  });

  it("o ponto de uma hora chega depois de reconectar", { timeout: 20000 }, async () => {
    const relogio = await subir();

    const { cliente, estados } = await entrar("Ana");

    darTaxa("Ana");

    cliente.criarGuilda("Lobos", "lmao");

    await esperarAte(
      () => painelDe(estados).guilda.guilda !== null,
    );

    expect(painelDe(estados).guilda.pontos).toBe(0);

    // o jogador sai, e o tempo passa
    const nomeDeSave = sessaoDe("Ana").donoKey;

    cliente.desconectar();

    await esperar(300);

    relogio.agora += 3 * 60 * 60 * 1000;

    const volta = await entrar("Ana");

    const juntou = await esperarAte(
      () => painelDe(volta.estados).guilda.pontos > 0,
    );

    expect(
      juntou,
      `os pontos nao chegaram depois de 3h offline (${nomeDeSave})`,
    ).toBe(true);

    expect(painelDe(volta.estados).guilda.pontos).toBe(3);

    volta.cliente.desconectar();
  });

  it("destravar gasta o ponto e muda o STAT do personagem", { timeout: 20000 }, async () => {
    const relogio = await subir();

    const { cliente, estados } = await entrar("Ana");

    darTaxa("Ana");

    cliente.criarGuilda("Lobos", "lmao");

    await esperarAte(
      () => painelDe(estados).guilda.guilda !== null,
    );

    const idDaGuilda = painelDe(estados).guilda.guilda.id;

    // junta pontos
    relogio.agora += 2 * 60 * 60 * 1000;

    await esperarAte(() => painelDe(estados).guilda.pontos >= 2);

    const ataqueAntes = painelDe(estados).player.attack;

    cliente.destravarTalent("mao_leve");

    const destravou = await esperarAte(
      () =>
        painelDe(estados).guilda.arvore.some(
          (n) => n.id === "mao_leve" && n.destravado,
        ),
    );

    expect(destravou, "o talento nao destravou").toBe(true);

    const painel = painelDe(estados);

    // "mao_leve" e +3 de ataque
    expect(painel.player.attack).toBe(ataqueAntes + 3);

    // e o ponto saiu do saldo
    expect(painel.guilda.pontos).toBe(1);

    cliente.desconectar();
  });

  it("sem pontos, destravar nao muda nada", async () => {
    await subir();

    const { cliente, estados } = await entrar("Ana");

    darTaxa("Ana");

    cliente.criarGuilda("Lobos", "lmao");

    await esperarAte(
      () => painelDe(estados).guilda.guilda !== null,
    );

    const ataqueAntes = painelDe(estados).player.attack;

    cliente.destravarTalent("mao_leve");

    await esperar(500);

    const painel = painelDe(estados);

    expect(painel.player.attack).toBe(ataqueAntes);
    expect(
      painel.guilda.arvore.some((n) => n.destravado),
      "destravou sem pontos",
    ).toBe(false);

    cliente.desconectar();
  });

  it("a guilda sobrevive a reconectar do dono", { timeout: 20000 }, async () => {
    await subir();

    const { cliente, estados } = await entrar("Ana");

    darTaxa("Ana");

    cliente.criarGuilda("Lobos", "lmao");

    await esperarAte(
      () => painelDe(estados).guilda.guilda !== null,
    );

    const idDaGuilda = painelDe(estados).guilda.guilda.id;

    cliente.desconectar();

    await esperar(300);

    const volta = await entrar("Ana");

    const voltou = await esperarAte(
      () => painelDe(volta.estados).guilda.guilda !== null,
    );

    expect(voltou, "a guilda sumiu ao reconectar").toBe(true);

    const painel = painelDe(volta.estados);

    expect(painel.guilda.guilda.id).toBe(idDaGuilda);
    expect(painel.guilda.ehLider).toBe(true);

    volta.cliente.desconectar();
  });
});
