import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import { GameClient } from "../../src/game/net/GameClient.js";
import { nameKey } from "../../src/data/characterName.js";

/**
 * O progresso de um personagem sobrevive ao navegador fechar.
 *
 * Sem isto, fechar a aba era perder o personagem inteiro: nivel,
 * ouro, itens, missoes e bestiario. E perder tudo sem aviso e pior
 * do que perder algo pequeno, porque o jogador nao sabe o que
 * perdeu e nao consegue Planejar.
 *
 * A chave e o NOME, na forma normalizada (`nameKey`), a mesma que o
 * servidor ja usa para proibir dois jogadores com o mesmo nome. Entao
 * "Teste", "teste" e "TESTE" sao o mesmo personagem, e um jogador nao
 * ganha um save novo so por digitar com outra caixa.
 */
let http;
let wss;
let jogo;
let porta;
let pasta;

async function subir({ pasta: dir = null, semSave = false } = {}) {
  await new Promise((resolve) => {
    http = createServer();

    http.listen(0, "127.0.0.1", () => {
      porta = http.address().port;
      resolve();
    });
  });

  wss = new WebSocketServer({ server: http, path: "/ws" });

  // `semSave` e o que os outros arquivos de teste fazem, so que
  // aqui a opcao e passada explicitamente para o teste poder
  // conferir que o padrao NAO e gravar
  jogo = new GameServer(
    semSave
      ? { config: { ...SERVER_CONFIG }, mapId: "map_1" }
      : {
          config: { ...SERVER_CONFIG },
          mapId: "map_1",
          persistencia: { pasta: dir },
        },
  );

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

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "rpg-save-"));
});

afterEach(async () => {
  if (jogo) await jogo.stop();

  if (http) {
    await new Promise((resolve) => {
      for (const socket of wss.clients) socket.terminate();
      wss.close(() => http.close(resolve));
    });
  }

  rmSync(pasta, { recursive: true, force: true });
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

/** Entra e espera o primeiro painel, que e o estado do personagem. */
async function entrar(cliente, nome, classId = "arbalist") {
  cliente.entrar({ name: nome, classId });

  for (let i = 0; i < 120; i += 1) {
    if (cliente.painel?.player) return cliente;

    await esperar(25);
  }

  throw new Error(
    `${nome} nao entrou: ${cliente.motivoRecusa ?? "sem painel"}`,
  );
}

/** Sai e espera o servidor guardar o personagem. */
async function sair(cliente) {
  cliente.desconectar();

  for (let i = 0; i < 120; i += 1) {
    if (jogo.clients.size === 0) return;

    await esperar(25);
  }
}

const sessaoDe = (nome) =>
  [...jogo.engine.world.players.values()].find(
    (s) => s.name === nome,
  );

describe("o progresso sobrevive ao navegador fechar", () => {
  it("carrega nivel, xp, ouro, itens, missoes e bestiario", async () => {
    await subir({ pasta });

    // 1a sessao: joga, ganha progressao e sai
    const ana = criarCliente();
    await entrar(ana, "Teste");

    const sessao = sessaoDe("Teste");

    sessao.player.level = 4;
    sessao.player.xp = 1234;
    sessao.player.hp = 210;
    sessao.inventory.addCoins(777);
    sessao.inventory.add("slime_core", 3);
    sessao.inventory.add("willow_bow", 1, "raro");
    sessao.quests.mainIndex = 1;
    sessao.quests.mainProgress = 4;
    sessao.quests.sideId = "side_brejo";
    sessao.quests.sideProgress = 6;
    sessao.quests.sideCompleted = 2;
    sessao.quests.completedSide.add("side_ratos");
    sessao.quests.complete(
      { coins: 500, xp: 400, items: [] },
      "main",
      "main_brejo",
    );
    sessao.bestiary.kills.set("slime", 17);
    sessao.bestiary.completed.add("slime_cacada_1");
    sessao.player.x = 4321;
    sessao.player.y = 8765;

    await sair(ana);

    // 2a sessao: MESMO nome, do zero
    await subir({ pasta });

    const volta = criarCliente();
    await entrar(volta, "Teste");

    const s2 = sessaoDe("Teste");

    expect(s2).toBeTruthy();
    expect(s2.player.level).toBe(4);
    expect(s2.player.xp).toBe(1234);
    expect(s2.inventory.coins).toBe(777);
    expect(s2.inventory.count("slime_core")).toBe(3);
    expect(s2.quests.mainIndex).toBe(1);
    expect(s2.quests.mainProgress).toBe(4);
    expect(s2.quests.currentSide?.id).toBe("side_brejo");
    expect(s2.quests.progressOf("side_brejo")).toBe(6);
    expect(s2.quests.sideCompleted).toBe(2);
    expect(s2.bestiary.kills.get("slime")).toBe(17);
    expect(s2.bestiary.completed.has("slime_cacada_1")).toBe(true);
    expect(s2.quests.isSideDone("side_ratos")).toBe(true);

    /**
     * Os STATS voltam como numeros, e nao como o valor cru da classe.
     *
     * Ataque, defesa e vida maxima sao derivados: classe mais nivel
     * mais equipamento. O save carrega o nivel e a peca, e quem faz a
     * soma e o motor. Sem a soma no `restaurar`, quem voltava logava
     * com os numeros do nivel 1 e batia fraco ate vestir alguma
     * coisa — e o painel de status, que le o motor, repetiria o
     * erro na tela
     */
    expect(s2.player.attack).toBeGreaterThan(
      s2.classDefinition.stats.attack,
    );

    expect(s2.player.maxHp).toBeGreaterThan(
      s2.classDefinition.stats.hp,
    );

    // e a vida foi preenchida com o maxHp JA SOMADO, e nao com o da
    // classe: `refillVitals` roda depois dos stats de proposito
    expect(s2.player.hp).toBe(s2.player.maxHp);

    /**
     * A recompensa NAO resgatada atravessa o logout.
     *
     * O resgate virou um clique do jogador, e o intervalo entre a
     * missao fechar e o clique existe. Fechar o navegador nesse meio
     * tempo nao pode engolir o gold: a linha da fila entra no arquivo
     * e volta com o [RECEBER] no painel
     *
     * E o que pagou e o CATALOGO, e nao o numero gravado: o arquivo
     * foi escrito com 500 moedas numa missao que paga 40, e o que
     * voltou sao as 40 do catalogo
     */
    expect(s2.quests.isClaimable("main_brejo")).toBe(true);
    expect(
      s2.quests.pendingOf("main_brejo").reward.coins,
    ).toBe(40);

    // e o cliente ve o botao, nao so o servidor
    expect(volta.painel.player.level).toBe(4);
    expect(volta.painel.inventory.coins).toBe(777);
    expect(volta.painel.quests.side.current?.id).toBe("side_brejo");
    expect(
      volta.painel.bestiary.entries.find((e) => e.id === "slime")
        ?.kills,
    ).toBe(17);
    expect(
      volta.painel.quests.claimable.map((c) => c.id),
    ).toContain("main_brejo");

    await sair(volta);
  });

  it("o mesmo nome com outra caixa e o mesmo personagem", async () => {
    await subir({ pasta });

    const ana = criarCliente();
    await entrar(ana, "Teste");

    sessaoDe("Teste").player.level = 7;
    sessaoDe("Teste").inventory.addCoins(50);

    await sair(ana);

    // "TESTE" e "teste" sao a mesma chave: `nameKey` e o que o
    // servidor ja usa para proibir nome repetido na partida
    await subir({ pasta });

    const volta = criarCliente();
    await entrar(volta, "TESTE");

    expect(sessaoDe("TESTE").player.level).toBe(7);
    expect(sessaoDe("TESTE").inventory.coins).toBe(50);

    await sair(volta);
  });

  it("outro nome comeca do zero", async () => {
    await subir({ pasta });

    const ana = criarCliente();
    await entrar(ana, "Teste");
    sessaoDe("Teste").player.level = 9;
    sessaoDe("Teste").inventory.addCoins(999);

    await sair(ana);

    await subir({ pasta });

    const bento = criarCliente();
    await entrar(bento, "Bento");

    expect(sessaoDe("Bento").player.level).toBe(1);
    expect(sessaoDe("Bento").inventory.coins).toBe(0);

    await sair(bento);
  });

  it("o equipamento volta vestido", async () => {
    await subir({ pasta });

    const ana = criarCliente();
    await entrar(ana, "Teste", "warrior");

    const sessao = sessaoDe("Teste");

    // `iron_sword` existe no catalogo e `rare` e a chave de raridade
    // (o catalogo e em ingles, mesmo com o nome do item em portugues)
    sessao.inventory.add("willow_bow", 1, "rare");

    const pilha = sessao.inventory.stacks.find(
      (s) => s.itemId === "willow_bow",
    );

    expect(pilha).toBeTruthy();

    // o equipar e do MOTOR, nao da sessao: e ele que valida o slot
    // e recalcula os stats
    jogo.engine.withPlayer(sessao.id, () => {
      jogo.engine.equipItem(pilha.uid, "weapon");
    });

    expect(sessao.equipment.getEquipped("weapon")).toBeTruthy();

    await sair(ana);

    await subir({ pasta });

    const volta = criarCliente();
    await entrar(volta, "Teste", "warrior");

    const sessaoVolta = sessaoDe("Teste");

    // o SLOT e o que o save carrega: e o estado cru, com o id do
    // item. o `getEquipped` devolve o item do catalogo mesclado, e
    // nele o id se chama `id`
    const slot = sessaoVolta.equipment.getSlot("weapon");

    expect(slot.itemId).toBe("willow_bow");
    expect(slot.rarity).toBe("rare");

    // e o painel mostra a arma vestida
    const equipado = sessaoVolta.equipment.getEquipped("weapon");

    expect(equipado).toBeTruthy();
    expect(equipado.id).toBe("willow_bow");
    expect(equipado.rarity).toBe("rare");

    await sair(volta);
  });

  it("o mesmo nome com outra classe e recusado", async () => {
    await subir({ pasta });

    const ana = criarCliente();
    await entrar(ana, "Teste", "arbalist");
    sessaoDe("Teste").player.level = 5;

    await sair(ana);

    // O personagem E a classe. Sobrescrever o save do Arbalist com
    // um Warrior apagaria o progresso sem ninguem pedir
    await subir({ pasta });

    const outro = criarCliente();
    outro.entrar({ name: "Teste", classId: "warrior" });

    // a recusa chega por pacote: o cliente sai do mundo ANTES de
    // receber o motivo, entao esperar so por `jogando()` leria o
    // motivo antes de ele chegar
    for (let i = 0; i < 120; i += 1) {
      if (outro.motivoRecusa) break;
      await esperar(25);
    }

    expect(outro.jogando()).toBe(false);
    expect(outro.motivoRecusa).toBeTruthy();

    // e o save do Arbalist continua inteiro
    const re = criarCliente();
    await entrar(re, "Teste", "arbalist");

    expect(sessaoDe("Teste").player.level).toBe(5);

    await sair(re);
  });
});

describe("um save quebrado nao derruba o servidor", () => {
  it("arquivo com lixo lida como personagem novo", async () => {
    await subir({ pasta });

    const arquivo = join(
      pasta,
      `${nameKey("Teste")}.json`,
    );

    writeFileSync(arquivo, "{isto nao e json", "utf8");

    const ana = criarCliente();
    await entrar(ana, "Teste");

    // nao ha o que recuperar: o jogador entra como personagem novo
    expect(sessaoDe("Teste").player.level).toBe(1);
    expect(sessaoDe("Teste").inventory.coins).toBe(0);

    await sair(ana);
  });

  it("numeros absurdos ou negativos sao aparados", async () => {
    await subir({ pasta });

    writeFileSync(
      join(pasta, `${nameKey("Teste")}.json`),
      JSON.stringify({
        version: 1,
        name: "Teste",
        classId: "arbalist",
        player: {
          level: 9999,
          xp: -500,
          hp: 10 ** 9,
          resource: -1,
          x: "abc",
          y: null,
        },
        inventory: {
          coins: -12345,
          stacks: [
            { itemId: "inexistente", count: 5 },
            { itemId: "slime_core", count: -3 },
            { itemId: "slime_core", count: 10 ** 6 },
          ],
        },
        quests: {
          mainIndex: 999,
          sideId: "missao_que_nao_existe",
        },
        bestiary: { kills: { dragao: 5 } },
      }),
      "utf8",
    );

    const ana = criarCliente();
    await entrar(ana, "Teste");

    const s = sessaoDe("Teste");

    // nivel maluco nao entra: um nivel 9999 quebraria o growth
    expect(s.player.level).toBeLessThanOrEqual(200);
    expect(s.player.level).toBeGreaterThanOrEqual(1);
    expect(s.player.xp).toBeGreaterThanOrEqual(0);

    // ouro negativo nao vira divida
    expect(s.inventory.coins).toBeGreaterThanOrEqual(0);

    // item que nao existe e quantidade absurda ficam de fora
    expect(
      s.inventory.stacks.some((p) => p.itemId === "inexistente"),
    ).toBe(false);

    // e o servidor continua de pe
    expect(jogo.engine.errosDeTick ?? 0).toBe(0);

    await sair(ana);
  });

  it("o save e escrito com a versao do formato", async () => {
    await subir({ pasta });

    const ana = criarCliente();
    await entrar(ana, "Teste");
    sessaoDe("Teste").player.level = 3;

    await sair(ana);

    const dados = JSON.parse(
      readFileSync(
        join(pasta, `${nameKey("Teste")}.json`),
        "utf8",
      ),
    );

    expect(dados.version).toBe(1);
    expect(dados.name).toBe("Teste");
    expect(dados.classId).toBe("arbalist");
    expect(dados.player.level).toBe(3);
  });
});

describe("a persistencia so grava quem pede", () => {
  it("um servidor sem a opcao nao escreve arquivo nenhum", async () => {
    // Todos os outros arquivos de teste sobem um servidor SEM pedir
    // save. Se o padrao estivesse ligado, o "Ana" de um arquivo
    // apareceria com o inventario do "Ana" do arquivo anterior, e a
    // suite passaria a depender da ordem de execucao
    await subir({ semSave: true });

    const ana = criarCliente();
    await entrar(ana, "Ana");

    sessaoDe("Ana").player.level = 12;
    sessaoDe("Ana").inventory.addCoins(4242);

    await sair(ana);

    expect(jogo.saves).toBeFalsy();
    expect(existsSync(join(pasta, "ana.json"))).toBe(false);
  });
});

describe("o mundo nao e salvo", () => {
  it("mob morto volta vivo para quem entra depois", async () => {
    await subir({ pasta });

    const ana = criarCliente();
    await entrar(ana, "Teste");

    // mata um slime de verdade, pelo caminho do motor
    const slime = jogo.engine.world.enemies.find((e) =>
      e.id.startsWith("slime"),
    );

    expect(slime).toBeTruthy();

    jogo.engine.withPlayer(sessaoDe("Teste").id, () => {
      jogo.engine.killEnemy(slime, sessaoDe("Teste").player);
    });

    expect(slime.alive).toBe(false);

    await sair(ana);

    // O estado do mob pertence ao MUNDO, nao ao personagem. Se fosse
    // salvo, o slime que a Ana matou continue morto para o Bento e
    // para o proximo "Teste", e o mundo comecaria a perder criaturas
    // a cada entrada
    await subir({ pasta });

    const volta = criarCliente();
    await entrar(volta, "Teste");

    const mesmo = jogo.engine.world.enemies.find(
      (e) => e.id === slime.id,
    );

    expect(mesmo).toBeTruthy();
    expect(mesmo.alive).toBe(true);

    await sair(volta);
  });

  it("drop no chao nao volta", async () => {
    await subir({ pasta });

    const ana = criarCliente();
    await entrar(ana, "Teste");

    // um drop de verdade, pelo caminho do `LootSystem`
    const sessao = sessaoDe("Teste");

    jogo.engine.loot.spawnGroundDrop({
      kind: "item",
      itemId: "slime_core",
      count: 1,
      rarity: "comum",
      x: sessao.player.x + 60,
      y: sessao.player.y,
      ownerId: sessao.id,
    });

    const uid = jogo.engine.world.drops.at(-1)?.uid;

    expect(uid).toBeTruthy();

    await sair(ana);

    await subir({ pasta });

    const volta = criarCliente();
    await entrar(volta, "Teste");

    expect(
      jogo.engine.world.drops.some((d) => d.uid === uid),
    ).toBe(false);

    await sair(volta);
  });
});
