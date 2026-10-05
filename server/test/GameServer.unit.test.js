import { describe, expect, it } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  PLAYER_ACTIONS,
  REJECT,
  SERVER_EVENTS,
  createCommand,
} from "../../src/shared/protocol.js";

/**
 * As regras do jogo SEM socket de verdade.
 *
 * O duble tem dois sentidos: `send` e o que o SERVIDOR escreve
 * (fica gravado para o teste ler) e `doCliente` e o que entra.
 * Roda rapido e isola as regras do transporte: se um teste falha
 * aqui, o problema nao e a rede.
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
    let client;

    const socket = {
      readyState: 1,
      send: (texto) => doServidor.push(JSON.parse(texto)),
    };

    client = new Client(socket);

    jogo.conectar(client);

    const mandar = (command) => {
      socket.send.length; // sem uso, mantem a forma do duble
      jogo.receber(client, JSON.stringify(command));
    };

    const ultimo = (tipo) => {
      for (let i = doServidor.length - 1; i >= 0; i -= 1) {
        if (doServidor[i].type === tipo) return doServidor[i];
      }

      return null;
    };

    mandar(
      createCommand(CLIENT_COMMANDS.JOIN, { name: nome, classId }),
    );

    return { client, mandar, ultimo, doServidor };
  };

  return { jogo, abrir };
}

describe("a entrada no mundo", () => {
  it("aceita um nome valido e devolve o id", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    const bemVindo = ana.ultimo(SERVER_EVENTS.WELCOME);

    expect(bemVindo.payload.playerId).toMatch(/^p_/);
    expect(bemVindo.payload.protocolVersion).toBe(1);
    expect(jogo.jogadores).toBe(1);
  });

  it("o placeholder some quando o primeiro jogador entra", () => {
    const { jogo, abrir } = montar();

    // sem isso, todo mundo veria um personagem fantasma parado
    // no mapa, com vida cheia, no primeiro snapshot
    expect(jogo.placeholder).toBeTruthy();

    abrir("Ana");

    expect(jogo.placeholder).toBe(null);
    expect(
      jogo.engine.world.players.has("p_placeholder"),
    ).toBe(false);
  });

  it("recusa nome curto demais", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ab");

    expect(ana.ultimo(SERVER_EVENTS.WELCOME)).toBe(null);
    expect(jogo.jogadores).toBe(0);
  });

  it("recusa nome com controle injetado", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana\u0000Bento");

    // um \u0000 no nome forja uma linha de log inteira. so
    // validar no cliente nao bastava: o script ignora o formulario
    expect(ana.ultimo(SERVER_EVENTS.WELCOME)).toBe(null);
    expect(jogo.jogadores).toBe(0);
  });

  it("recusa classe desconhecida em vez de trocar", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana", "deus");

    // cair para uma classe qualquer faria o jogador pedir
    // Arbalist e receber Warrior sem aviso
    expect(ana.ultimo(SERVER_EVENTS.REJECTED).payload.reason).toBe(
      REJECT.UNKNOWN_CLASS,
    );
    expect(jogo.jogadores).toBe(0);
  });

  it("recusa nome repetido, ignorando a caixa", () => {
    const { jogo, abrir } = montar();
    abrir("Ana");
    const outro = abrir("ana");

    // dois "Ana" no mesmo mapa: o loot vai por id, mas as
    // pessoas veem o nome
    expect(outro.ultimo(SERVER_EVENTS.REJECTED).payload.reason).toBe(
      REJECT.NAME_TAKEN,
    );
    expect(jogo.jogadores).toBe(1);
  });

  it("recusa a segunda entrada da mesma conexao", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");
    const id = ana.client.id;

    ana.mandar(
      createCommand(CLIENT_COMMANDS.JOIN, {
        name: "Outro",
        classId: "sorcerer",
      }),
    );

    // reconectar sem fechar a conexao antiga criaria um segundo
    // personagem, e o loot do primeiro iria para o segundo
    expect(jogo.jogadores).toBe(1);
    expect(ana.client.id).toBe(id);
  });

  it("recusa INPUT antes do JOIN", () => {
    const { jogo } = montar();
    const doServidor = [];
    const socket = { readyState: 1, send: (t) => doServidor.push(JSON.parse(t)) };
    const client = new Client(socket);

    jogo.conectar(client);

    jogo.receber(
      client,
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.INPUT, { seq: 1, moveX: 1 }),
      ),
    );

    // sem sessao, o pacote entraria sem dono e o loot do abate
    // iria para null
    const rejeitado = doServidor.at(-1);

    expect(rejeitado.type).toBe(SERVER_EVENTS.REJECTED);
    expect(rejeitado.payload.reason).toBe(REJECT.NOT_JOINED);
  });

  it("recusa JSON quebrado sem derrubar o mundo", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    ana.mandar.quebrar = true;

    jogo.receber(ana.client, "{ isto nao e json");

    expect(ana.ultimo(SERVER_EVENTS.REJECTED)).toBeTruthy();

    expect(() => jogo.tick(SERVER_CONFIG.tickSeconds)).not.toThrow();
    expect(
      ana.ultimo(SERVER_EVENTS.SNAPSHOT).payload.players.length,
    ).toBe(1);
  });

  it("recusa versao de protocolo diferente", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    jogo.receber(ana.client, JSON.stringify({
      protocolVersion: 99,
      type: CLIENT_COMMANDS.JOIN,
      payload: { name: "Outro", classId: "warrior" },
      timestamp: Date.now(),
    }));

    expect(ana.ultimo(SERVER_EVENTS.REJECTED).payload.reason).toBe(
      REJECT.BAD_VERSION,
    );
  });
});

describe("a intencao vira movimento", () => {
  it("o INPUT mexe no jogador, e nao so no pacote", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    const xAntes = ana.client.session.player.x;

    ana.mandar(
      createCommand(CLIENT_COMMANDS.INPUT, {
        seq: 1,
        moveX: 1,
        moveY: 0,
      }),
    );

    jogo.tick(SERVER_CONFIG.tickSeconds);

    // sem isto, o servidor aceitaria o INPUT, devolveria
    // "recebido", e o jogador ficaria parado: o motor so sabia
    // ler teclado
    expect(ana.client.session.player.x).toBeGreaterThan(xAntes);
  });

  it("cada jogador anda para o seu lado", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    const xAna = ana.client.session.player.x;
    const xBento = bento.client.session.player.x;

    ana.mandar(
      createCommand(CLIENT_COMMANDS.INPUT, {
        seq: 1,
        moveX: 1,
        moveY: 0,
      }),
    );
    bento.mandar(
      createCommand(CLIENT_COMMANDS.INPUT, {
        seq: 1,
        moveX: -1,
        moveY: 0,
      }),
    );

    jogo.tick(SERVER_CONFIG.tickSeconds);

    expect(ana.client.session.player.x).toBeGreaterThan(xAna);
    expect(bento.client.session.player.x).toBeLessThan(xBento);
  });

  it("ignora intencao antiga ou repetida", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    ana.mandar(
      createCommand(CLIENT_COMMANDS.INPUT, { seq: 5, moveX: 1, moveY: 0 }),
    );
    ana.mandar(
      createCommand(CLIENT_COMMANDS.INPUT, { seq: 2, moveX: -1, moveY: 0 }),
    );

    jogo.tick(SERVER_CONFIG.tickSeconds);

    // se o seq 2 fosse aceito, o jogador daria meia-volta por
    // causa de um pacote atrasado
    expect(ana.client.session.intent.seq).toBe(5);
    expect(ana.client.session.intent.moveX).toBe(1);
  });

  it("nao deixa um jogador mover o outro", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    const xBento = bento.client.session.player.x;

    ana.mandar(
      createCommand(CLIENT_COMMANDS.INPUT, { seq: 1, moveX: 1, moveY: 0 }),
    );

    jogo.tick(SERVER_CONFIG.tickSeconds);

    expect(ana.client.session.player.x).not.toBe(xBento);
    expect(bento.client.session.player.x).toBe(xBento);
  });
});

describe("o tick e o mundo compartilhado", () => {
  it("um tick que estoura nao derruba o servidor", () => {
    // O laco de 20Hz roda fora de qualquer `try`. Uma excecao no
    // `tick` matava o processo, e o `node --watch` so reinicia em
    // mudanca de arquivo, nao em crash: o mundo saia do ar para
    // todo mundo e nao voltava sozinho.
    const { jogo, abrir } = montar();

    abrir("Ana");

    const original = console.error;
    const erros = [];

    console.error = (...partes) => erros.push(partes.join(" "));

    try {
      jogo.engine.update = () => {
        throw new Error("regra com bug");
      };

      // o codigo REAL do laco, nao uma copia dele
      jogo.avancarTempo(SERVER_CONFIG.tickSeconds);

      // o erro foi registrado com rastreio, para alguem achar a
      // causa no terminal
      expect(jogo.errosDeTick).toBe(1);
      expect(erros.join(" ")).toContain("regra com bug");
      expect(erros.join(" ")).toContain("GameServer");

      // e o laco continua: o proximo tick roda normal
      jogo.engine.update = () => {};

      jogo.avancarTempo(SERVER_CONFIG.tickSeconds);

      expect(jogo.errosDeTick).toBe(1);
    } finally {
      console.error = original;
    }
  });

  it("tres ticks seguidos quebrando param o laco, com aviso", () => {
    const { jogo, abrir } = montar();

    abrir("Ana");

    const original = console.error;
    const erros = [];

    console.error = (...partes) => erros.push(partes.join(" "));

    try {
      jogo.engine.update = () => {
        throw new Error("sempre quebra");
      };

      for (let i = 0; i < 3; i += 1) {
        jogo.avancarTempo(SERVER_CONFIG.tickSeconds);
      }

      expect(jogo.errosDeTick).toBe(3);

      // o laco parou: um estado que sempre estoura nao se
      // recupera, e ficar repetindo 20x/s so esconde a causa
      expect(jogo.intervalo).toBe(null);

      // e alguem precisa ler isso no terminal para reiniciar
      expect(erros.join(" ")).toContain("tres erros seguidos");
    } finally {
      console.error = original;
    }
  });

  it("manda snapshot com os jogadores e os inimigos", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");
    abrir("Bento", "sorcerer");

    jogo.tick(SERVER_CONFIG.tickSeconds);

    const snap = ana.ultimo(SERVER_EVENTS.SNAPSHOT);

    expect(snap.payload.players.length).toBe(2);
    // o snapshot traz so o que o jogador ve por perto. o mapa
    // inteiro tem 83, mas o grosso e o trafego para desenhar
    // coisa fora da tela
    expect(snap.payload.enemies.length).toBeGreaterThan(0);
    expect(snap.payload.enemies.length).toBeLessThan(
      jogo.engine.world.enemies.length,
    );
  });

  it("o numero do snapshot anda", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    jogo.tick(SERVER_CONFIG.tickSeconds);
    const a = ana.ultimo(SERVER_EVENTS.SNAPSHOT);

    jogo.tick(SERVER_CONFIG.tickSeconds);
    const b = ana.ultimo(SERVER_EVENTS.SNAPSHOT);

    // o cliente usa este numero para descartar pacote fora de
    // ordem. sem ele, um pacote atrasado chega e o jogador anda para
    // tras
    expect(b.payload.seq).toBeGreaterThan(a.payload.seq);
  });

  it("um abate aparece como morto no snapshot", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    const alvo = jogo.engine.world.enemies
      .filter((e) => e.isCreature && e.hp > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - 3000, a.y - 2100) -
          Math.hypot(b.x - 3000, b.y - 2100),
      )[0];

    jogo.engine.withPlayer(ana.client.id, () => {
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

    jogo.tick(SERVER_CONFIG.tickSeconds);

    const snap = ana.ultimo(SERVER_EVENTS.SNAPSHOT);
    const visto = snap.payload.enemies.find((e) => e.id === alvo.id);

    // senao a barra de vida do mob ficaria parada no ar
    expect(visto.state).toBe("dead");
  });

  it("o drop no chao leva o dono", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    // determinismo: o slime so da item 17% das vezes
    jogo.engine.loot.roll = () => ({
      coins: 0,
      items: [{ itemId: "slime_gel", count: 1 }],
    });

    // um inventario no limite forca o item a transbordar para o
    // chao em vez de entrar na mochila
    ana.client.session.inventory.capacity = 0;

    const mob = jogo.engine.world.enemies.find(
      (e) => e.isCreature && e.hp > 0,
    );

    jogo.engine.withPlayer(ana.client.id, () => {
      jogo.engine.killEnemy(mob, ana.client.session.player);
    });

    const drop = jogo.engine.world.drops.at(-1);

    // o dono vai no drop: e o que impede o Bento de passar por
    // cima e pegar o item da Ana
    expect(drop).toBeTruthy();
    expect(drop.ownerId).toBe(ana.client.id);
    expect(drop.ownerId).not.toBe(bento.client.id);
  });

  it("o loot direto vai para o inventario de quem matou", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    jogo.engine.loot.roll = () => ({
      coins: 7,
      items: [{ itemId: "slime_gel", count: 1 }],
    });

    const mob = jogo.engine.world.enemies.find(
      (e) => e.isCreature && e.hp > 0,
    );

    jogo.engine.withPlayer(ana.client.id, () => {
      jogo.engine.killEnemy(mob, ana.client.session.player);
    });

    expect(ana.client.session.inventory.coins).toBe(7);
    expect(bento.client.session.inventory.coins).toBe(0);
  });
});

describe("a acao usa a classe de quem pediu", () => {
  it("cada sessao guarda a propria classe", () => {
    const { abrir } = montar();
    const ana = abrir("Ana", "warrior");
    const bento = abrir("Bento", "sorcerer");

    // usar `engine.classDefinition` faria o Bento gastar o
    // recurso e disparar a habilidade da warrior do placeholder
    expect(ana.client.session.classId).toBe("warrior");
    expect(bento.client.session.classId).toBe("sorcerer");
  });

  it("a acao nao derruba o servidor", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    ana.mandar(
      createCommand(CLIENT_COMMANDS.ACTION, {
        action: PLAYER_ACTIONS.BASIC_ATTACK,
        slot: 0,
      }),
    );

    expect(() => jogo.tick(SERVER_CONFIG.tickSeconds)).not.toThrow();
  });

  it("limita a rajada de acoes de uma conexao", () => {
    const { abrir } = montar();
    const ana = abrir("Ana");

    let rejeicoes = 0;

    for (let i = 0; i < 80; i += 1) {
      const antes = ana.doServidor.length;

      ana.mandar(
        createCommand(CLIENT_COMMANDS.ACTION, {
          action: PLAYER_ACTIONS.BASIC_ATTACK,
          slot: 0,
        }),
      );

      for (const msg of ana.doServidor.slice(antes)) {
        if (
          msg.type === SERVER_EVENTS.REJECTED &&
          msg.payload.reason === REJECT.RATE_LIMIT
        ) {
          rejeicoes += 1;
        }
      }
    }

    // 80 acoes em rajada. sem o limite, o jogador seguraria a
    // habilidade sem cooldown
    expect(rejeicoes).toBeGreaterThan(0);
  });
});

describe("sair limpa a sessao", () => {
  it("remove o jogador do mundo", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    expect(jogo.jogadores).toBe(2);

    jogo.desconectar(bento.client);

    expect(jogo.jogadores).toBe(1);
    expect(
      jogo.engine.world.players.has(bento.client.id),
    ).toBe(false);
    expect(ana.client.session).toBeTruthy();
  });

  it("avisa os outros", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    jogo.desconectar(bento.client);

    const saiu = ana.ultimo(SERVER_EVENTS.PLAYER_LEFT);

    expect(saiu).toBeTruthy();
    expect(saiu.payload.id).toBe(bento.client.id);
  });

  it("nao deixa o motor quebrado com ninguem", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");
    const bento = abrir("Bento", "sorcerer");

    jogo.desconectar(ana.client);
    jogo.desconectar(bento.client);

    expect(() => jogo.tick(SERVER_CONFIG.tickSeconds)).not.toThrow();
    expect(jogo.jogadores).toBe(0);
  });

  it("o socket fechado nao derruba o mundo", () => {
    const { jogo, abrir } = montar();
    const ana = abrir("Ana");

    // o `send` depois do close levanta excecao. se o `tick` nao
    // tolerate, um jogador que saiu derrubaria os outros
    ana.client.socket.readyState = 3;

    expect(() => jogo.tick(SERVER_CONFIG.tickSeconds)).not.toThrow();
  });
});
