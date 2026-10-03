import { describe, expect, it } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  REJECT,
  SERVER_EVENTS,
  createCommand,
} from "../../src/shared/protocol.js";
import { STAT_DEFS } from "../../src/game/stats/StatSheet.js";

/**
 * O painel do jogador, que vive no SERVIDOR.
 *
 * A regra que estes testes defendem: o cliente pode PEDIR, nunca
 * DIZER. Se um pedido pudesse carregar "coins: 99999" ou
 * "level: 50", editar o JavaScript do jogo daria ouro e nivel de
 * graca.
 */
function montar() {
  const jogo = new GameServer({
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

  const abrir = (nome, classId = "warrior") => {
    const doServidor = [];

    const socket = {
      readyState: 1,
      send: (texto) => doServidor.push(JSON.parse(texto)),
    };

    const client = new Client(socket);
    jogo.conectar(client);

    const mandar = (command) =>
      jogo.receber(client, JSON.stringify(command));

    mandar(
      createCommand(CLIENT_COMMANDS.JOIN, { name: nome, classId }),
    );

    const ultimo = (tipo) => {
      for (let i = doServidor.length - 1; i >= 0; i -= 1) {
        if (doServidor[i].type === tipo) return doServidor[i];
      }

      return null;
    };

    // o painel e um evento normal: vai pelo socket, igual qualquer
    // outra coisa. pedir e ler o que o servidor respondeu
    const painel = () => {
      jogo.enviarPainel(client);
      return ultimo(SERVER_EVENTS.PLAYER_STATE)?.payload ?? null;
    };

    return { client, mandar, ultimo, doServidor, painel };
  };

  return { jogo, abrir };
}

describe("o painel chega para o dono", () => {
  it("o motor monta o mesmo formato que a tela ja consome", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");

    const estado = ana.painel();

    // sao exatamente as chaves que o HUD ja lia no offline. se
    // alguma faltar, o painel aparece vazio sem erro nenhum
    for (const chave of [
      "player",
      "inventory",
      "equipment",
      "lootFilter",
      "bestiary",
      "quests",
      "craft",
    ]) {
      expect(estado[chave], chave).toBeTruthy();
    }

    expect(estado.player.name).toBe("Ana");
  });

  it("cada jogador recebe o SEU painel", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    // se os dois lessem o mesmo estado, o Bento veria o inventario
    // da Ana. o foco por sessao e o que evita isso
    expect(ana.painel().player.name).toBe("Ana");
    expect(bento.painel().player.name).toBe("Bento");

    expect(ana.painel().player.className).not.toBe(
      bento.painel().player.className,
    );
  });

  it("a folha de stats chega no painel do dono", () => {
    // online o painel de status e alimentado pelo PACOTE, e nao pelo
    // motor da tela. Sem a folha no `PLAYER_STATE`, o painel abriria
    // vazio para quem esta jogando online — que e justamente o caso
    // em que o painel de status importa
    const { abrir } = montar();
    const ana = abrir("Ana", "arbalist");

    const folha = ana.painel().player.stats;

    expect(folha, "a folha nao veio no painel").toBeTruthy();
    expect(folha.rows).toHaveLength(STAT_DEFS.length);
    expect(folha.groups.length).toBe(4);

    // e o ATK da folha e o mesmo attack que a HUD ja recebia
    expect(folha.byId.attack.total).toBe(
      ana.painel().player.attack,
    );
  });

  it("a folha e de cada jogador, e nao uma compartilhada", () => {
    const { abrir } = montar();
    const ana = abrir("Ana", "warrior");
    const bento = abrir("Bento", "sorcerer");

    // as duas classes tem atributos diferentes, e uma folha
    // compartilhada mostraria o INT do Sorcerer na Ana
    expect(
      ana.painel().player.stats.byId.int.total,
    ).not.toBe(bento.painel().player.stats.byId.int.total);

    // e trocar de classe nao deixa o objeto antigo no lugar
    expect(ana.painel().player.stats.level).toBe(1);
  });

  it("ninguem comeca com bonus NEGATIVO", () => {
    // O `bonus` da folha e `total - base`, e a `base` e a classe no
    // nivel 1. Se o `total` do motor for menor que a base — o que
    // acontecia quando o jogador logava sem o `applyEquipment` rodar
    // e ficava com os numeros crus da classe, sem o crescimento do
    // nivel 1 — o painel mostrava "-26" na coluna de bonus de um
    // personagem recem-criado, que e o primeiro numero que o jogador
    // ve do personagem dele
    const { abrir } = montar();

    for (const classe of [
      "warrior",
      "lancer",
      "sorcerer",
      "arbalist",
    ]) {
      const jogador = abrir(`Ana-${classe}`, classe);

      for (const row of jogador.painel().player.stats.rows) {
        expect(
          row.bonus,
          `${classe}.${row.id} comeca negativo`,
        ).toBeGreaterThanOrEqual(0);
      }

      jogador.client.close?.();
    }
  });
});

describe("o cliente so pode pedir", () => {
  it("nao consegue criar moedas pelo pedido", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");

    ana.client.session.inventory.addCoins(5);

    ana.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.EQUIP,
        uid: "x",

        // tudo abaixo e lixo de cliente. o parser joga fora
        coins: 99999,
        level: 50,
        questsDone: true,
      }),
    );

    // o pedido nao carrega `coins` para o servidor, entao nao ha
    // caminho para o dinheiro aparecer
    expect(ana.client.session.inventory.coins).toBe(5);
  });

  it("nao consegue forjar um item pelo id do drop", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");

    // o uid e uma referencia interna do servidor. se o cliente
    // pudesse escolher, bastaria adivinhar um uid valido
    ana.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.EQUIP,
        uid: "inventario_do_ana_1",
        slotId: "weapon",
      }),
    );

    // equipou o que nao existe: o motor recusa e nao cria nada
    expect(ana.client.session.inventory.count("willow_bow")).toBe(0);
  });

  it("recusa uma operacao de painel inventada", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");

    ana.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: "DAR_ITEM",
        itemId: "slime_gel",
      }),
    );

    expect(ana.ultimo(SERVER_EVENTS.REJECTED)?.payload.reason).toBe(
      REJECT.BAD_MESSAGE,
    );
  });
});

describe("as operacoes do painel", () => {
  it("equipar move o item para o equipamento", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");

    const inventario = ana.client.session.inventory;
    inventario.add("willow_bow", 1);

    // o uid sai do proprio inventario, que e a unica fonte
    // confiavel dele
    const uid = inventario.summary().items[0].uid;

    ana.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.EQUIP,
        uid,
        slotId: "weapon",
      }),
    );

    const Slots = ana.client.session.equipment.slots;
    const arma = Slots.find((s) => s.id === "weapon");

    // o servidor que decidiu, olhando o inventario DELE
    expect(arma.itemId).toBe("willow_bow");
    expect(inventario.count("willow_bow")).toBe(0);
  });

  it("nao mexe no equipamento de outro jogador", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    const inventario = ana.client.session.inventory;
    inventario.add("willow_bow", 1);

    const uid = inventario.summary().items[0].uid;

    ana.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.EQUIP,
        uid,
        slotId: "weapon",
      }),
    );

    const armaBento = bento.client.session.equipment.slots.find(
      (s) => s.id === "weapon",
    );

    expect(armaBento.itemId).toBeFalsy();
  });

  it("descartar tira o item de quem pediu, e so dele", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    ana.client.session.inventory.add("willow_bow", 1);
    bento.client.session.inventory.add("willow_bow", 1);

    const uid = ana.client.session.inventory.summary().items[0].uid;

    ana.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.DISCARD,
        uid,
      }),
    );

    expect(ana.client.session.inventory.count("willow_bow")).toBe(0);

    // o do Bento continua: um descarte nunca vaza para o
    // inventario de outra pessoa
    expect(bento.client.session.inventory.count("willow_bow")).toBe(1);
  });

  it("nao cria um item a partir de uma receita inexistente", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");

    const antes = ana.client.session.inventory.count("slime_gel");

    ana.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.CRAFT,
        recipeId: "receita_que_nao_existe",
      }),
    );

    // o motor recusa a receita desconhecida. um cliente nao pode
    // inventar um item
    expect(ana.client.session.inventory.count("slime_gel")).toBe(
      antes,
    );
  });

  it("um filtro de loot nao-objeto nao derruba o mundo", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");

    // um filtro quebrado derrubaria o motor inteiro, tiraria o
    // jogador do mundo e levaria os outros com ele
    expect(() => {
      ana.mandar(
        createCommand(CLIENT_COMMANDS.PANEL, {
          op: PANEL_OPS.SET_LOOT_FILTER,
          filter: "nao sou objeto",
        }),
      );
    }).not.toThrow();

    expect(ana.painel().lootFilter).toBeTruthy();
  });

  it("auto-equipar usa o equipamento certo", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");

    ana.client.session.inventory.add("willow_bow", 1);

    ana.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, { op: PANEL_OPS.AUTO_EQUIP }),
    );

    const arma = ana.client.session.equipment.slots.find(
      (s) => s.id === "weapon",
    );

    expect(arma.itemId).toBe("willow_bow");
  });
});

describe("o filtro de interesse dos inimigos", () => {
  it("nao manda o ogro do outro lado do mapa", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    jogo.tick(1 / 20);

    const snap = ana.ultimo(SERVER_EVENTS.SNAPSHOT);
    const jogador = ana.client.session.player;

    expect(snap, "nenhum SNAPSHOT chegou").toBeTruthy();

    const total = jogo.engine.world.enemies.length;

    // o mapa inteiro tem dezenas de inimigos
    expect(total).toBeGreaterThan(10);
    expect(snap.payload.enemies.length).toBeLessThan(total);

    // e nenhum deles esta longe do jogador
    for (const e of snap.payload.enemies) {
      const d = Math.hypot(e.x - jogador.x, e.y - jogador.y);
      expect(d).toBeLessThanOrEqual(1000);
    }
  });

  it("o recorte cabe em bem menos bytes que o mapa inteiro", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    jogo.tick(1 / 20);

    const snap = ana.ultimo(SERVER_EVENTS.SNAPSHOT);

    // o motivo de filtrar: 83 inimigos a 20Hz para cada jogador
    // seria o grosso do trafego para desenhar coisa fora da tela
    const bytesDoRecorte = JSON.stringify(snap.payload).length;
    const bytesDoMapa = JSON.stringify(
      jogo.engine.world.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y })),
    ).length;

    expect(bytesDoRecorte).toBeLessThan(bytesDoMapa);
  });
});

describe("o ritmo do envio", () => {
  it("o painel nao vai a cada tick", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    ana.doServidor.length = 0;

    // 4 ticks: o mundo ja foi 4x, o painel ainda nao. mandar o
    // inventario completo 20x por segundo seria desperdicio que
    // o jogador nao percebe
    for (let i = 0; i < 4; i += 1) jogo.tick(1 / 20);

    const conta = (tipo) =>
      ana.doServidor.filter((m) => m.type === tipo).length;

    expect(conta(SERVER_EVENTS.SNAPSHOT)).toBe(4);
    expect(conta(SERVER_EVENTS.PLAYER_STATE)).toBe(0);

    // no quinto, o painel sai
    jogo.tick(1 / 20);

    expect(conta(SERVER_EVENTS.PLAYER_STATE)).toBe(1);
  });

  it("painel e mundo vao para o dono certo", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    ana.doServidor.length = 0;
    bento.doServidor.length = 0;

    for (let i = 0; i < 5; i += 1) jogo.tick(1 / 20);

    for (const c of [ana, bento]) {
      const paineis = c.doServidor.filter(
        (m) => m.type === SERVER_EVENTS.PLAYER_STATE,
      );

      expect(paineis).toHaveLength(1);
      expect(paineis[0].payload.player.name).toBe(
        c.client.session.name,
      );
    }
  });
});
