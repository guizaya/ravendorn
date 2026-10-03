import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  createCommand,
} from "../../src/shared/protocol.js";
import { RARITY } from "../../src/data/items/index.js";

/**
 * O MERCADO sobrevive ao servidor morrer.
 *
 * Um anuncio e um item na mochila de ninguem: o vendedor tirou a peca,
 * o servidor guardou, e se o arquivo nao voltar no proximo boot o item
 * sumiu sem ninguem ter ganho nada. O mesmo vale para o pagamento de
 * uma venda com o vendedor offline — dinheiro que ele ganhou e que
 * estava so na memoria
 *
 * Por isso estes testes NAO usam socket: o que se testa e o disco, e
 * subir o `GameServer` inteiro e lento demais para o que precisa ser
 * provado
 */
function abrir(jogo, nome, classId = "arbalist") {
  const recebidos = [];

  const client = new Client({
    readyState: 1,
    send: (texto) => recebidos.push(JSON.parse(texto)),
  });

  jogo.conectar(client);

  jogo.receber(
    client,
    JSON.stringify(
      createCommand(CLIENT_COMMANDS.JOIN, { name: nome, classId }),
    ),
  );

  const sessao = () => jogo.engine.world.players.get(client.id);

  const ultimo = (tipo) => {
    for (let i = recebidos.length - 1; i >= 0; i -= 1) {
      if (recebidos[i].type === tipo) return recebidos[i];
    }

    return null;
  };

  return {
    client,
    sessao,
    ultimo,
    moedas: () => sessao().inventory.coins,
    dar: (itemId, count = 1, rarity = null) =>
      sessao().inventory.add(itemId, count, rarity),
    uid: (itemId, rarity) =>
      sessao().inventory.findStack(itemId, rarity)?.uid,
    painel: () => {
      jogo.enviarPainel(client);

      return ultimo("PLAYER_STATE")?.payload ?? null;
    },
    anunciar: (uid, price) =>
      jogo.receber(
        client,
        JSON.stringify(
          createCommand(CLIENT_COMMANDS.PANEL, {
            op: PANEL_OPS.MARKET_LIST,
            uid,
            price,
          }),
        ),
      ),
    comprar: (listingId) =>
      jogo.receber(
        client,
        JSON.stringify(
          createCommand(CLIENT_COMMANDS.PANEL, {
            op: PANEL_OPS.MARKET_BUY,
            listingId,
          }),
        ),
      ),
    cancelar: (listingId) =>
      jogo.receber(
        client,
        JSON.stringify(
          createCommand(CLIENT_COMMANDS.PANEL, {
            op: PANEL_OPS.MARKET_CANCEL,
            listingId,
          }),
        ),
      ),
  };
}

/** uma pasta temporaria e um servidor ligado nela */
function subir({ relogio = { agora: 1_000_000 } } = {}) {
  const pasta = mkdtempSync(join(tmpdir(), "mercado-"));

  const novoJogo = () =>
    new GameServer({
      config: {
        ...SERVER_CONFIG,
        agora: () => relogio.agora,
      },
      persistencia: { pasta: join(pasta, "personagens") },
    });

  return { pasta, novoJogo, relogio };
}

describe("o mercado em disco", () => {
  it("o anuncio volta no boot seguinte", () => {
    const { pasta, novoJogo } = subir();

    const primeiro = novoJogo();
    const ana = abrir(primeiro, "Ana");

    ana.dar("botas_arbalist", 1, RARITY.RARE);
    ana.anunciar(ana.uid("botas_arbalist", RARITY.RARE), 200);

    expect(ana.painel().market.meus).toHaveLength(1);

    primeiro.stop();

    // o servidor morreu e subiu de novo, com o mesmo arquivo
    const segundo = novoJogo();
    const bento = abrir(segundo, "Bento");

    const vitrine = bento.painel().market.listings;

    expect(vitrine, "o anuncio nao voltou do disco").toHaveLength(1);
    expect(vitrine[0].itemId).toBe("botas_arbalist");
    expect(vitrine[0].price).toBe(200);
    expect(vitrine[0].sellerName).toBe("Ana");

    segundo.stop();
    rmSync(pasta, { recursive: true, force: true });
  });

  it("o vendedor ve o anuncio DELE como dele, e nao na vitrine", () => {
    const { pasta, novoJogo } = subir();

    const primeiro = novoJogo();
    const ana = abrir(primeiro, "Ana");

    ana.dar("botas_arbalist", 1, RARITY.RARE);
    ana.anunciar(ana.uid("botas_arbalist", RARITY.RARE), 200);

    primeiro.stop();

    // o mesmo nome, e uma sessao nova com id novo
    const segundo = novoJogo();
    const ana2 = abrir(segundo, "Ana");

    const painel = ana2.painel().market;

    expect(painel.meus, "o dono nao reconheceu o proprio anuncio").toHaveLength(1);
    expect(painel.listings, "o anuncio dele esta na vitrine").toHaveLength(0);

    segundo.stop();
    rmSync(pasta, { recursive: true, force: true });
  });

  it("o dinheiro de uma venda com o vendedor offline sobrevive ao boot", () => {
    const { pasta, novoJogo } = subir();

    const primeiro = novoJogo();
    const ana = abrir(primeiro, "Ana");
    const bento = abrir(primeiro, "Bento");

    bento.moedas();

    ana.dar("botas_arbalist", 1, RARITY.RARE);
    ana.anunciar(ana.uid("botas_arbalist", RARITY.RARE), 200);

    const anuncio = bento.painel().market.listings[0];

    // o vendedor sai ANTES da venda: o dinheiro fica pendente
    primeiro.desconectar(ana.client);

    bento.sessao().inventory.addCoins(1000);
    bento.comprar(anuncio.id);

    expect(primeiro.pagamentosPendentes).toHaveLength(1);

    primeiro.stop();

    // o servidor morre com o pagamento na fila. Sem o arquivo, o
    // dinheiro da venda seria perdido para sempre
    const segundo = novoJogo();
    const ana2 = abrir(segundo, "Ana");

    expect(ana2.moedas(), "o pagamento pendente nao sobreviveu").toBe(200);
    expect(segundo.pagamentosPendentes).toHaveLength(0);

    segundo.stop();
    rmSync(pasta, { recursive: true, force: true });
  });

  it("o item de um anuncio que venceu offline volta quando o dono entra", () => {
    const { pasta, novoJogo, relogio } = subir();

    const primeiro = novoJogo();
    const ana = abrir(primeiro, "Ana");

    ana.dar("botas_arbalist", 1, RARITY.RARE);
    ana.anunciar(ana.uid("botas_arbalist", RARITY.RARE), 200);

    primeiro.desconectar(ana.client);

    // passa dos sete dias com o anuncio no ar
    relogio.agora += 604_800_000 + 1000;

    primeiro.expirarAnuncios();

    expect(primeiro.pendentesDeDevolucao).toHaveLength(1);

    primeiro.stop();

    const segundo = novoJogo();
    const ana2 = abrir(segundo, "Ana");

    expect(
      ana2.sessao().inventory.countAt("botas_arbalist", RARITY.RARE),
      "o item nao voltou para o dono",
    ).toBe(1);

    expect(segundo.pendentesDeDevolucao).toHaveLength(0);

    segundo.stop();
    rmSync(pasta, { recursive: true, force: true });
  });

  it("um anuncio pela metade no arquivo nao vira item de ninguem", () => {
    const { pasta, novoJogo } = subir();

    const primeiro = novoJogo();
    const ana = abrir(primeiro, "Ana");

    ana.dar("botas_arbalist", 1, RARITY.RARE);
    ana.anunciar(ana.uid("botas_arbalist", RARITY.RARE), 200);

    primeiro.stop();

    // um anuncio sem `itemId` e o estado INTERMEDIO: o `uid` ja foi
    // tirado da mochila, mas o `fill` nao rodou. Devolver isso como
    // anuncio mostraria uma peca na vitrine que ninguem tem
    const arquivo = join(pasta, "mercado.json");
    const dados = JSON.parse(readFileSync(arquivo, "utf8"));

    dados.market.listings = [
      { id: "a_quebrado", sellerKey: "ana", sellerName: "Ana" },
    ];

    writeFileSync(arquivo, JSON.stringify(dados), "utf8");

    const segundo = novoJogo();
    const bento = abrir(segundo, "Bento");

    const vitrine = bento.painel().market.listings;

    expect(
      vitrine.some((a) => a.id === "a_quebrado"),
      "anuncio pela metade entrou na vitrine",
    ).toBe(false);

    segundo.stop();
    rmSync(pasta, { recursive: true, force: true });
  });

  it("um pagamento sem dono e um preco invalido nao entram no mundo", () => {
    const { pasta, novoJogo } = subir();

    const arquivo = join(pasta, "mercado.json");

    // um pagamento sem `ownerKey` nao tem para quem pagar, e um preco
    // negativo viraria moeda com o sinal trocado
    writeFileSync(
      arquivo,
      JSON.stringify({
        versao: 1,
        market: {
          listings: [
            {
              id: "a_barato",
              itemId: "botas_arbalist",
              rarity: RARITY.RARE,
              count: 1,
              price: -50,
              sellerKey: "ana",
              sellerName: "Ana",
              expiresAt: 9_999_999_999,
            },
          ],
          historico: [],
        },
        pagamentosPendentes: [{ coins: 500 }],
        pendentesDeDevolucao: [{ count: 1 }],
      }),
      "utf8",
    );

    const jogo = novoJogo();

    expect(jogo.pagamentosPendentes).toHaveLength(0);
    expect(jogo.pendentesDeDevolucao).toHaveLength(0);

    const ana = abrir(jogo, "Ana");

    // o preco negativo foi normalizado para o piso, ou recusado: o que
    // nao pode e um preco que vira dinheiro
    const meus = ana.painel().market.meus;

    expect(
      meus.every((a) => a.price > 0),
      "um anuncio com preco negativo sobreviveu",
    ).toBe(true);

    jogo.stop();
    rmSync(pasta, { recursive: true, force: true });
  });

  it("sem persistencia nada e escrito e o mercado comeca vazio", () => {
    const jogo = new GameServer({ config: { ...SERVER_CONFIG } });

    const ana = abrir(jogo, "Ana");

    ana.dar("botas_arbalist", 1, RARITY.RARE);
    ana.anunciar(ana.uid("botas_arbalist", RARITY.RARE), 200);

    expect(ana.painel().market.meus).toHaveLength(1);

    // desligado por padrao: um teste que subisse servidor escreveria
    // no mesmo lugar com o mesmo nome, e passaria a depender da ordem
    // em que os arquivos rodam
    expect(jogo.mercado).toBe(null);
    expect(jogo.guardarMercado()).toBe(false);

    jogo.stop();
  });

  it("o arquivo do mercado fica FORA da pasta dos personagens", () => {
    const { pasta, novoJogo } = subir();

    const primeiro = novoJogo();
    const ana = abrir(primeiro, "Ana");

    ana.dar("botas_arbalist", 1, RARITY.RARE);
    ana.anunciar(ana.uid("botas_arbalist", RARITY.RARE), 200);

    primeiro.stop();

    const arquivo = join(pasta, "mercado.json");

    expect(existsSync(arquivo), "o arquivo do mercado nao foi criado").toBe(true);

    /**
     * O `listar()` do personagem devolve o nome de cada `.json` da
     * pasta. Com o mercado dentro dela, a administracao listaria um
     * jogador chamado "mercado"
     */
    expect(primeiro.saves.listar()).not.toContain("mercado");

    rmSync(pasta, { recursive: true, force: true });
  });
});