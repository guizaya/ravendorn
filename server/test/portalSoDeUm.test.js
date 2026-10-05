import { describe, expect, it, beforeEach } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { SERVER_CONFIG } from "../src/config.js";
import { findMap } from "../../src/data/maps/index.js";

/**
 * O PORTAL ATRAVessa SO QUEM CLICOU.
 *
 * ## O QUE ESTE TESTE PROVA
 *
 * Que o mapa e DA SESSAO, e nao do mundo. Antes, `world.map` era um
 * campo do motor e o servidor tinha um motor so: o `setMap` de um
 * jogador trocava o mapa de todo mundo, e o `broadcast` mandava o id
 * novo no pacote dos outros. Os dois clientes recebiam a troca e os
 * dois personagens atravessavam o portal juntos
 *
 * ## POR QUE UM SERVIDOR DE VERDADE
 *
 * O defeito estava na juncao de tres pecas: o `setMap` do motor, o
 * `broadcast` do servidor e o `mapa` do pacote. Um teste que so
 * chamasse `engine.setMap` passaria e o bug continuaria na tela, porque
 * o pacote e que leva a troca ate o cliente
 */
function servidorNo(mapId) {
  return new GameServer({
    config: { ...SERVER_CONFIG, persistencia: false },
    mapId,
  });
}

/** Uma sessao no mundo do servidor, como o `conectar` faria. */
function entra(jogo, nome) {
  const engine = jogo.engine;

  engine.addPlayer(
    {
      id: `p_${nome}`,
      name: nome,
      player: {
        id: `p_${nome}`,
        name: nome,
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        level: 1,
        definition: { id: "warrior" },
      },
      quests: null,
      bestiary: null,
      inventory: null,
      equipment: null,
      craft: null,
      collection: null,
      isPlayer: true,
    },
    { mapId: jogo.mapaInicial.id },
  );

  return engine.world.players.get(`p_${nome}`);
}

describe("o portal e de quem clica nele", () => {
  let jogo;
  let ana;
  let bento;

  beforeEach(() => {
    jogo = servidorNo("map_1");

    ana = entra(jogo, "Ana");
    bento = entra(jogo, "Bento");
  });

  it("cada sessao nasce no mapa de entrada do servidor", () => {
    expect(ana.mapId).toBe(jogo.mapaInicial.id);
    expect(bento.mapId).toBe(jogo.mapaInicial.id);
  });

  it("o setMap de um jogador so move o mapa DELE", () => {
    const hub = findMap("base");

    jogo.engine.withPlayer("p_Ana", () => {
      jogo.engine.setMap(hub);
    });

    expect(ana.mapId).toBe("base");

    // Bento continua no vale: e o bug inteiro
    expect(bento.mapId).toBe("map_1");
  });

  it("o mundo aponta para o mapa de quem esta em foco", () => {
    const hub = findMap("base");

    jogo.engine.withPlayer("p_Ana", () => {
      jogo.engine.setMap(hub);
    });

    // com o Ana em foco, o mundo e o hub
    jogo.engine.focusPlayer("p_Ana");
    expect(jogo.engine.world.map.id).toBe("base");

    // com o Bento em foco, o mundo volta a ser o vale
    jogo.engine.focusPlayer("p_Bento");
    expect(jogo.engine.world.map.id).toBe("map_1");
  });

  it("cada mapa tem o SEU elenco de inimigos", () => {
    const hub = findMap("base");

    jogo.engine.withPlayer("p_Ana", () => {
      jogo.engine.setMap(hub);

      const hubNaoTemZona = jogo.engine.world.enemies.length;

      jogo.engine.setMap(findMap("map_1"));

      const valeTemZona = jogo.engine.world.enemies.length;

      expect(valeTemZona).toBeGreaterThan(hubNaoTemZona);
    });
  });

  it("o estado de um mapa SOBREVIVE ao outro: nada se perde ao voltar", () => {
    const hub = findMap("base");

    jogo.engine.withPlayer("p_Ana", () => {
      jogo.engine.setMap(findMap("map_1"));

      const inimigosDoVale = jogo.engine.world.enemies.length;

      jogo.engine.setMap(hub);

      expect(jogo.engine.world.enemies.length).toBeLessThan(inimigosDoVale);

      // e o vale volta com o elenco inteiro, e nao com uma lista vazia
      jogo.engine.setMap(findMap("map_1"));

      expect(jogo.engine.world.enemies.length).toBe(inimigosDoVale);
    });
  });

  it("o pacote de cada jogador so leva quem esta no mesmo mapa", () => {
    const hub = findMap("base");

    jogo.engine.withPlayer("p_Ana", () => {
      jogo.engine.setMap(hub);
    });

    /**
     * O `estadoJogadores` e montado com o dono em foco, entao quem
     * decide o filtro e o mapa de quem esta em foco. O Bento, no vale,
     * nao pode ver a Ana no hub: as coordenadas de um mapa nao queriam
     * nada no outro, e o cliente nao tem como saber que o boneco dele
     * esta em outro mapa — ele so recebe uma posicao
     */
    jogo.engine.withPlayer("p_Bento", () => {
      const ids = jogo.estadoJogadores().map((p) => p.id);

      expect(ids).toContain("p_Bento");
      expect(ids).not.toContain("p_Ana");
    });

    jogo.engine.withPlayer("p_Ana", () => {
      const ids = jogo.estadoJogadores().map((p) => p.id);

      expect(ids).toContain("p_Ana");
      expect(ids).not.toContain("p_Bento");
    });
  });

  it("a parte compartilhada do tick roda uma vez por mapa", () => {
    const hub = findMap("base");

    jogo.engine.withPlayer("p_Ana", () => {
      jogo.engine.setMap(hub);
    });

    // um por mapa: o hub com a Ana e o vale com o Bento
    expect(jogo.engine.jogadoresPorMapa()).toHaveLength(2);

    // e nao um por jogador
    jogo.engine.withPlayer("p_Cora_check", () => {});

    expect(jogo.engine.jogadoresPorMapa()).toHaveLength(2);
  });
});