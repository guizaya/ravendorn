import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";
import {
  POCAO_MAX_POR_COMPRA,
  getPocao,
  precoPocao,
} from "../../src/data/potions/index.js";
import { getItem } from "../../src/data/items/index.js";

/**
 * A LOJA DE POCOES e o USO do consumivel, de ponta a ponta.
 *
 * Socket de verdade dos dois lados, como o `guildRede.test.js` faz, e
 * pelo mesmo motivo: o caminho que importa aqui tem `parsePanel`, o
 * switch de ops do `GameServer`, o motor e de volta o painel.
 *
 * O que este arquivo pega, e que nenhum outro pega:
 *
 * 1. **o preco vem do servidor.** Um cliente modificado que manda
 *    `price: 1` tem de pagar o preco do catalogo. E o teste que separa
 *    uma loja de um formulario: sem ele, `BUY_POTION` poderia estar
 *    lendo o preco do pedido e ninguem notaria ate o mercado virar
 *    barato
 * 2. **o uso nao gasta a pocao com a vida cheia.** A recusa e do
 *    servidor. Um cliente que decide isso sozinho mostraria o item
 *    sumindo na tela e a barra parada
 * 3. **o item a mais nao paga.** E o espaco na mochila: a compra tem de
 *    sair completa ou nao sair
 */

let http;
let wss;
let jogo;
let porta;

const esperar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function esperarAte(condicao, tentativas = 160, passo = 25) {
  for (let i = 0; i < tentativas; i += 1) {
    if (condicao()) return true;

    await esperar(passo);
  }

  return false;
}

function subir() {
  return new Promise((resolve) => {
    http = createServer();

    http.listen(0, "127.0.0.1", () => {
      porta = http.address().port;

      wss = new WebSocketServer({ server: http, path: "/ws" });

      jogo = new GameServer({
        config: SERVER_CONFIG,
        mapId: "map_1",
      });

      wss.on("connection", (socket) => {
        const c = new Client(socket);

        jogo.conectar(c);

        socket.on("message", (bruto) => {
          if (bruto.length > 8 * 1024) return;
          if (!c.limiter.permite()) return;

          jogo.receber(c, bruto.toString());
        });

        /**
         * O `jogo` do closure, e nao a variavel do modulo.
         *
         * O `afterEach` termina com `jogo = null`, e o `close` do
         * socket chega DEPOIS disso — o `terminate()` derruba a conexao
         * de forma assincrona. Ler a variavel do modulo daria
         * `Cannot read properties of null` num `desconectar`, e o
         * vitest conta isso como erro nao tratado que derruba a
         * suíte inteira
         */
        const servidor = jogo;

        socket.on("close", () => servidor.desconectar(c));
      });

      jogo.start();

      resolve();
    });
  });
}

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

async function entrar(nome) {
  const { cliente, estados } = criarCliente();

  cliente.entrar({ name: nome, classId: "warrior" });

  const chegou = await esperarAte(() => cliente.painel);

  return { cliente, estados, chegou };
}

const painelDe = (estados) => {
  for (let i = estados.length - 1; i >= 0; i -= 1) {
    if (estados[i]?.painel) return estados[i].painel;
  }

  return null;
};

const sessaoDe = (nome) =>
  [...jogo.engine.world.players.values()].find(
    (s) => s.name === nome,
  );

/** da moedas pelo servidor, e nao pelo cliente */
function darMoedas(nome, moedas) {
  sessaoDe(nome).inventory.addCoins(moedas);
}

const moedasDe = (nome) => sessaoDe(nome).inventory.coins;

const pocoasDe = (nome) =>
  sessaoDe(nome).inventory.count("pocao_cura");

afterEach(async () => {
  /**
   * O teardown so desliga o que subiu.
   *
   * Os testes do catalogo nao sobem servidor nenhum, e um
   * `await new Promise(r => http?.close(r))` com `http` nulo NUNCA
   * resolve: o `?.` nao chama nada, e o `r` fica para sempre esperando.
   * O sintoma nao e um teste travado, e um erro nao tratado no fim da
   * suíte inteira, que e pior — ela derruba testes que nao tem nada a
   * ver com o assunto
   */
  if (!http) return;

  jogo?.stop?.();

  wss?.clients?.forEach((c) => c.terminate());
  wss?.close?.();

  await new Promise((resolve) => http.close(resolve));

  http = null;
  wss = null;
  jogo = null;
});

describe("a loja de pocoes", () => {
  it("compra a pocao pelo preco do catalogo", async () => {
    await subir();

    const { cliente, estados } = await entrar("Ana");

    darMoedas("Ana", 500);

    const preco = precoPocao("pocao_cura");

    cliente.comprarPocao("pocao_cura", 1);

    const ok = await esperarAte(() => pocoasDe("Ana") === 1);

    expect(ok, "a pocao nao chegou na mochila").toBe(true);

    /**
     * O preco do CATALOGO, e nao o que o cliente mandou.
     *
     * E o que separa uma loja de um formulario de pedido: se o
     * servidor lesse `price` do pedido, um cliente modificado pagaria 1
     * moeda numa pocao de 50
     */
    expect(moedasDe("Ana")).toBe(500 - preco);

    void painelDe(estados);
  });

  it("ignora um preco forjado no pedido", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    darMoedas("Ana", 500);

    const preco = precoPocao("pocao_cura");

    /**
     * O `GameClient` nao tem como mandar `price`: a assinatura nao
     * aceita. O preco forjado e montado na mao, como um cliente
     * modificado faria
     */
    cliente.pedirPainel({
      op: "BUY_POTION",
      itemId: "pocao_cura",
      count: 1,
      price: 1,
    });

    const ok = await esperarAte(() => pocoasDe("Ana") === 1);

    expect(ok).toBe(true);

    expect(
      moedasDe("Ana"),
      "o servidor aceitou o preco do pedido",
    ).toBe(500 - preco);
  });

  it("recusa moedas insuficientes sem dar a pocao", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    const preco = precoPocao("pocao_cura");

    // uma moeda a menos do que a pocao custa
    darMoedas("Ana", preco - 1);

    cliente.comprarPocao("pocao_cura", 1);

    /**
     * O tempo de espera e proposital: a recusa nao chega como
     *confirmacao, e a ausencia de pocao e o que se mede. Sem
     * esperar, o teste passaria antes de o servidor ter visto o pedido
     */
    await esperar(200);

    expect(pocoasDe("Ana")).toBe(0);
    expect(moedasDe("Ana")).toBe(preco - 1);
  });

  it("cobra o preco vezes a quantidade", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    darMoedas("Ana", 1_000);

    const preco = precoPocao("pocao_cura");

    cliente.comprarPocao("pocao_cura", 3);

    const ok = await esperarAte(() => pocoasDe("Ana") === 3);

    expect(ok).toBe(true);
    expect(moedasDe("Ana")).toBe(1_000 - preco * 3);
  });

  it("cobra o PILHA e empilha de uma vez", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    darMoedas("Ana", 1_000);

    const preco = precoPocao("pocao_cura");

    cliente.comprarPocao("pocao_cura", 2);
    await esperarAte(() => pocoasDe("Ana") === 2);

    cliente.comprarPocao("pocao_cura", 2);

    const ok = await esperarAte(() => pocoasDe("Ana") === 4);

    expect(ok).toBe(true);
    expect(moedasDe("Ana")).toBe(1_000 - preco * 4);

    /**
     * As duas compras ocupam UM slot.
     *
     * A pocao e empilhavel, e e o que faz a loja poder vender x5 sem
     * encher a mochila. Sem esta asercao, uma compra por clique e um
     * item por slot continuariam passando nos testes acima
     */
    const sessao = sessaoDe("Ana");

    expect(
      sessao.inventory.findStack("pocao_cura").count,
    ).toBe(4);
  });

  it("recusa um item que nao esta a venda", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    darMoedas("Ana", 500);

    /**
     * Um item que existe, mas que o mercador nao vende.
     *
     * E o caso perigoso: o servidor tem o `itemId` no catalogo de
     * ITENS, entao um `getItem` ali passaria. O que barra e o catalogo
     * da LOJA, e e ele que precisa ser o filtro
     */
    cliente.comprarPocao("willow_bow", 1);

    await esperar(200);

    expect(
      sessaoDe("Ana").inventory.count("willow_bow"),
    ).toBe(0);

    expect(moedasDe("Ana")).toBe(500);
  });

  it("recusa um id que nao existe", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    darMoedas("Ana", 500);

    cliente.comprarPocao("item_que_nao_existe", 1);

    await esperar(200);

    expect(moedasDe("Ana")).toBe(500);
  });

  it("corta a quantidade no teto da loja", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    darMoedas("Ana", 10_000);

    const preco = precoPocao("pocao_cura");

    /**
     * Vinte passa no transporte e passa na regra da loja. Sao dois
     * tetos em lugares diferentes, e e essa distincao que importa:
     *
     * - o `parsePanel` recusa acima de `MARKET_QUANTIDADE_MAX` (99), o
     *   limite do mercado entre jogadores;
     * - o `comprarPocao` CORTA em `POCAO_MAX_POR_COMPRA` (5), porque o
     *   mercador entrega uma mao por clique.
     *
     * Vinte cai entre os dois, entao e o numero que mede o teto da
     * loja sem ser barrado antes pelo transporte
     */
    cliente.comprarPocao("pocao_cura", 20);

    const ok = await esperarAte(() => pocoasDe("Ana") > 0);

    expect(ok).toBe(true);

    expect(pocoasDe("Ana")).toBe(POCAO_MAX_POR_COMPRA);

    /**
     * E o preco cobrado e o do TETO, e nao o do numero pedido.
     *
     * E esta a parte que importa: cortar a quantidade sem cortar o
     * preco daria cinco pocoes pelo preco de vinte
     */
    expect(moedasDe("Ana")).toBe(
      10_000 - preco * POCAO_MAX_POR_COMPRA,
    );
  });

  it("recusa um numero de quantidade impossivel", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    darMoedas("Ana", 10_000);

    /**
     * Um numero que o transporte REJEITA vira `null`, e o servidor
     * interpreta `null` como "o pedido padrao", que e 1.
     *
     * Nao e a mesma coisa que o teto da loja: ali o numero era
     * valido demais e foi cortado para 5; aqui ele nem chegou a ser
     * numero. Um `Math.max(1, ...)` no lugar do `?? 1` transformaria
     * este `null` em 1 tambem — e o `999` viraria 999 se o teto do
     * transporte nao existisse
     */
    cliente.comprarPocao("pocao_cura", 999);

    const ok = await esperarAte(() => pocoasDe("Ana") > 0);

    expect(ok).toBe(true);

    expect(pocoasDe("Ana")).toBe(1);
  });
});

describe("usar a pocao comprada", () => {
  it("o item comprado pode ser usado pelo uid", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    darMoedas("Ana", 500);

    cliente.comprarPocao("pocao_cura", 1);

    await esperarAte(() => pocoasDe("Ana") === 1);

    const sessao = sessaoDe("Ana");
    const pilha = sessao.inventory.findStack("pocao_cura");

    sessao.player.hp = sessao.player.maxHp - 300;

    const antes = sessao.player.hp;

    cliente.usarItem(pilha.uid);

    const ok = await esperarAte(
      () => pocoasDe("Ana") === 0,
    );

    expect(ok, "a pocao nao saiu da mochila").toBe(true);

    expect(sessao.player.hp).toBeGreaterThan(antes);
    expect(pilha.equipped).toBeFalsy();
  });

  it("nao gasta a pocao com a vida cheia", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    darMoedas("Ana", 500);

    cliente.comprarPocao("pocao_cura", 2);

    await esperarAte(() => pocoasDe("Ana") === 2);

    const sessao = sessaoDe("Ana");

    sessao.player.hp = sessao.player.maxHp;

    const pilha = sessao.inventory.findStack("pocao_cura");

    cliente.usarItem(pilha.uid);

    /**
     * A espera aqui e o que mede a recusa.
     *
     * Nao ha pacote de erro: a recusa e o item continuar na mochila. Por
     * isso o teste nao espera resposta nenhuma, e sim confirma que o
     * item continua la depois que o servidor teve tempo de ver o pedido
     */
    await esperar(250);

    expect(pocoasDe("Ana"), "a pocao foi gasta sem curar").toBe(2);

    expect(sessao.player.hp).toBe(sessao.player.maxHp);
  });

  it("recusa o uso sem derrubar a conexao", async () => {
    await subir();

    const { cliente } = await entrar("Ana");

    cliente.usarItem("uid-que-nao-existe");

    /**
     * Um `uid` forjado nao pode derrubar o servidor.
     *
     * E por isso que o `findByUid` devolve `null` e o `usarItem`
     * devolve `false`: o caminho do pedido inteiro tem de tolerar o
     * item que nao existe, e o cliente sobrer vivo para continuar
     */
    await esperar(250);

    expect(cliente.painel).toBeTruthy();
  });
});

describe("o catalogo da loja", () => {
  it("a pocao a venda existe no catalogo de itens", () => {
    /**
     * A loja guarda o `id`, e o nome e a cura vem do catalogo de itens.
     * Um id errado aqui daria uma linha sem nome e sem imagem, e o
     * jogador veria uma linha vazia sem pista do erro
     */
    expect(getItem(getPocao("pocao_cura").id)).toBeTruthy();
  });

  it("precoPocao devolve null para o que nao esta a venda", () => {
    expect(precoPocao("willow_bow")).toBe(null);
    expect(precoPocao("item_que_nao_existe")).toBe(null);
  });

  it("o preco da loja e o dobro do valor de mercado", () => {
    /**
     * A razao de o preco NAO ser o `value` do item.
     *
     * Se fossem o mesmo numero, a loja seria um caminho de ouro: o
     * jogador compra pelo `value`, vende no mercado pelo `value`, e a
     * moeda nasce do nada. O preco e o dobro porque o mercador compra
     * pelo `value` e vende pelo preco, e o que fica no meio e a moeda
     * que circula
     */
    expect(precoPocao("pocao_cura")).toBe(
      getItem("pocao_cura").value * 2,
    );
  });
});