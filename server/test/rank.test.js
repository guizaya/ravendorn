import { describe, expect, it } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  SERVER_EVENTS,
  createCommand,
} from "../../src/shared/protocol.js";
import { RANK_CRITERIO } from "../../src/game/ranking/rank.js";

/**
 * O rank so presta se for do SERVIDOR. Se a lista chegasse crua e o
 * navegador ordenasse, um cliente modificado mostraria a posicao que
 * quisesse. Estes testes travam o que importa: a ordem vai pronta,
 * reflete o estado real da sessao, e ninguem some da lista sem sair.
 */
function montar() {
  const jogo = new GameServer({ config: { ...SERVER_CONFIG } });

  const abrir = (nome, classId = "warrior") => {
    const recebidos = [];

    const socket = {
      readyState: 1,
      send: (texto) => recebidos.push(JSON.parse(texto)),
    };

    const client = new Client(socket);

    jogo.conectar(client);

    jogo.receber(
      client,
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.JOIN, {
          name: nome,
          classId,
        }),
      ),
    );

    const ultimo = (tipo) => {
      for (let i = recebidos.length - 1; i >= 0; i -= 1) {
        if (recebidos[i].type === tipo) return recebidos[i];
      }

      return null;
    };

    const painel = () => {
      jogo.enviarPainel(client);

      return ultimo(SERVER_EVENTS.PLAYER_STATE)?.payload ?? null;
    };

    const sessao = () => jogo.engine.world.players.get(client.id);

    return { client, painel, sessao, ultimo, recebidos };
  };

  return { jogo, abrir };
}

const nomes = (lista) => lista.map((j) => j.name);

describe("rank no servidor", () => {
  it("manda o rank no painel, com todo mundo que esta conectado", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    expect(nomes(ana.painel().rank[RANK_CRITERIO.NIVEL])).toEqual([
      "Ana",
      "Bia",
    ]);

    // os dois lados veem a MESMA lista, na mesma ordem
    expect(nomes(bia.painel().rank[RANK_CRITERIO.NIVEL])).toEqual([
      "Ana",
      "Bia",
    ]);

    jogo.stop();
  });

  it("ordena por nivel, e nao pela ordem de entrada", () => {
    const { jogo, abrir } = montar();

    // Ana entra primeiro e vai para o FIM do rank de proposito, para
    // provar que a ordem nao e a de chegada
    const ana = abrir("Ana");
    const bia = abrir("Bia");

    ana.sessao().player.level = 12;

    expect(nomes(ana.painel().rank[RANK_CRITERIO.NIVEL])).toEqual([
      "Ana",
      "Bia",
    ]);

    bia.sessao().player.level = 20;

    expect(nomes(ana.painel().rank[RANK_CRITERIO.NIVEL])).toEqual([
      "Bia",
      "Ana",
    ]);

    jogo.stop();
  });

  it("usa o xp do nivel como desempate", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    bia.sessao().player.level = 3;
    bia.sessao().player.xp = 500;
    ana.sessao().player.level = 3;
    ana.sessao().player.xp = 10;

    expect(nomes(ana.painel().rank[RANK_CRITERIO.NIVEL])).toEqual([
      "Bia",
      "Ana",
    ]);

    jogo.stop();
  });

  it("mostra as duas ordens divergindo quando nivel e cacadas nao concordam", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    // a Bia nao subiu de nivel, mas cacou: e o caso em que as duas
    // ordenacoes discordam, que e o motivo de existirem as abas
    ana.sessao().player.level = 30;

    bia.sessao().bestiary.completed.add("cacada_1");
    bia.sessao().bestiary.completed.add("cacada_2");
    bia.sessao().bestiary.kills.set("zumbi_arbalist", 12);

    const painel = ana.painel();

    expect(nomes(painel.rank[RANK_CRITERIO.NIVEL])).toEqual([
      "Ana",
      "Bia",
    ]);

    expect(nomes(painel.rank[RANK_CRITERIO.BESTIARIO])).toEqual([
      "Bia",
      "Ana",
    ]);

    const biaNoBestiario = painel.rank[RANK_CRITERIO.BESTIARIO][0];

    expect(biaNoBestiario.cacadas).toBe(2);
    expect(biaNoBestiario.abates).toBe(12);

    jogo.stop();
  });

  it("numera a posicao a partir de 1 e da medalha so aos tres primeiros", () => {
    const { jogo, abrir } = montar();

    // `NAME_MIN` e 3, e o servidor recusa nome curto: os quatro
    // nomes aqui passam, e o que o rank lista e quem entrou
    const dani = abrir("Dani");

    abrir("Dois");
    abrir("Tres");
    abrir("Quatro");

    const lista = dani.painel().rank[RANK_CRITERIO.NIVEL];

    expect(lista.map((j) => j.posicao)).toEqual([1, 2, 3, 4]);
    expect(lista.map((j) => j.medalha)).toEqual([
      "🥇",
      "🥈",
      "🥉",
      "•",
    ]);

    jogo.stop();
  });

  it("leva o nivel e o xp de cada jogador, e nao zero para todos", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    ana.sessao().player.level = 7;
    ana.sessao().player.xp = 33;

    const lista = bia.painel().rank[RANK_CRITERIO.NIVEL];
    const linha = lista.find((j) => j.name === "Ana");

    expect(linha.nivel).toBe(7);
    expect(linha.xp).toBe(33);
    expect(lista[0].name).toBe("Ana");

    jogo.stop();
  });

  it("tira do rank quem desconecta", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    expect(ana.painel().rank[RANK_CRITERIO.NIVEL]).toHaveLength(2);

    jogo.desconectar(bia.client);

    const lista = ana.painel().rank[RANK_CRITERIO.NIVEL];

    // um rank com quem ja saiu mostraria uma posicao que ninguem
    // pode ocupar, e o numero de conectados mentiria
    expect(lista).toHaveLength(1);
    expect(lista[0].name).toBe("Ana");

    jogo.stop();
  });

  it("funciona com uma pessoa so, sem quebrar o painel", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    const lista = ana.painel().rank[RANK_CRITERIO.NIVEL];

    expect(lista).toHaveLength(1);
    expect(lista[0].posicao).toBe(1);

    jogo.stop();
  });

  it("mantem o rank fora do pacote do mundo, que vai 20 Hz para todos", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");
    const bia = abrir("Bia");

    // o pacote do mundo mostra posicao e vida. A progressao fica no
    // painel, que e privado e vai 4x por segundo: se o nivel
    // aparecesse no mundo, todo jogador veria o nivel dos outros
    // vinte vezes por segundo, e o envio cresceria junto
    const mundo = JSON.stringify(ana.ultimo(SERVER_EVENTS.WORLD));

    expect(mundo).not.toContain("nivel");
    expect(mundo).not.toContain("cacadas");

    // e o bestiario do jogador continua no painel, como sempre
    expect(ana.painel().bestiary).toBeTruthy();

    jogo.stop();
  });
});
