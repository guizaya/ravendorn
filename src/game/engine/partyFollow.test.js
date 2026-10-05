import { describe, expect, it } from "vitest";
import { GameEngine } from "../engine/GameEngine.js";
import { createPlayerSession } from "../engine/PlayerSession.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1, MAPS, findMap } from "../../data/maps/index.js";

/**
 * SEGUIR UM MEMBRO DA PARTY.
 *
 * ## AS TRES REGRAS DO PEDIDO
 *
 * - o plano acompanha a posicao VIVA do seguido, e nao um ponto guardado
 * - o plano atravessa portal ate o mapa onde o seguido esta
 * - o acompanhamento PARA sozinho quando chega do lado
 *
 * ## POR QUE O TESTE NAO ESPERA O RELOGIO
 *
 * `runTravelPlan` e chamado direto, com o `deltaTime` do teste. O que
 * se quer verificar aqui e a DECISAO — replanejar, ou parar — e nao a
 * quantidade de quadros que o jogador andou ate la
 */
const classe = CHARACTER_CLASSES.find((c) => c.id === "warrior");

/** Dois jogadores no mesmo mapa, no mesmo ponto de partida. */
function montarDois() {
  const engine = new GameEngine(null, classe, null, {
    playerId: "p_Ana",
    characterName: "Ana",
  });

  engine.setMap(MAP_1);
  engine.world.collision.map = MAP_1;

  const sessoes = [];

  for (const nome of ["Ana", "Bento"]) {
    const sessao = createPlayerSession(classe, {
      id: `p_${nome}`,
      name: nome,
    });

    engine.addPlayer(sessao);

    sessoes.push(sessao);
  }

  return { engine, ana: sessoes[0], bento: sessoes[1] };
}

describe("seguir um membro da party", () => {
  it("o plano aponta para ONDE o seguido esta, e nao para onde ele estava", () => {
    const { engine, bento } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.seguirJogador("p_Bento");

      // Bento comeca em um lugar e se mexe
      engine.world.players.get("p_Bento").player.x = 900;
      engine.world.players.get("p_Bento").player.y = 700;

      const destino = engine.destinoDoObjetivo();

      expect(destino.x).toBe(900);
      expect(destino.y).toBe(700);
    });

    expect(bento.id).toBe("p_Bento");
  });

  it("quem nao segue ninguem nao tem destino de travelling", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      expect(engine.world.session.seguindoId).toBeNull();
      expect(engine.destinoDoSeguido()).toBeNull();
    });
  });

  it("seguir a si mesmo nao gera destino — evita o loop infinito", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.seguirJogador("p_Ana");

      expect(engine.destinoDoSeguido()).toBeNull();
    });
  });

  it("o plano e refeito quando o seguido se move", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      const bento = engine.world.players.get("p_Bento").player;

      bento.x = 1200;

      engine.travelPlanParaObjetivo();

      const etapaDepois = engine.travelPlan[engine.travelPlan.length - 1];

      expect(Math.hypot(etapaDepois.x - 1200, etapaDepois.y - bento.y))
        .toBeLessThanOrEqual(1);

      // o relogio ainda nao venceu: o plano e o mesmo, sem custo de A*
      const antes = engine.travelPlan.length;

      bento.x = 1300;

      engine.runTravelPlan(0.016, engine.world.player);

      expect(engine.travelPlan.length).toBe(antes);
    });
  });

  it("o relogio vence e o plano passa a apontar para o novo lugar", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      const bento = engine.world.players.get("p_Bento").player;

      bento.x = 1200;

      engine.runTravelPlan(0.016, engine.world.player);

      const antes = engine.travelPlan.length;

      // Bento andou para o outro lado; o plano velho aponta para tras
      bento.x = 300;

      // um tique maior que SEGUIR_REPLANEJA
      engine.runTravelPlan(0.5, engine.world.player);

      const etapaDepois = engine.travelPlan[engine.travelPlan.length - 1];

      expect(Math.hypot(etapaDepois.x - 300, etapaDepois.y - bento.y))
        .toBeLessThanOrEqual(1);

      // e o plano realmente mudou
      expect(engine.travelPlan.length).not.toBe(0);
      expect(antes).toBeGreaterThan(0);
    });
  });

  it("CHEGANDO DO LADO o acompanhamento para sozinho", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      const ana = engine.world.player;
      const bento = engine.world.players.get("p_Bento").player;

      // ao lado: dentro de TRAVEL_CHEGADA + o raio do seguido
      ana.x = bento.x + 10;
      ana.y = bento.y;

      engine.runTravelPlan(0.016, ana);

      // parou: nem o id ficou, nem o plano ficou
      expect(engine.world.session.seguindoId).toBeNull();
      expect(engine.travelPlan).toHaveLength(0);
    });
  });

  it("LONGE do lado o acompanhamento continua", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      const ana = engine.world.player;
      const bento = engine.world.players.get("p_Bento").player;

      ana.x = 100;
      ana.y = 100;

      bento.x = 900;
      bento.y = 700;

      engine.runTravelPlan(0.016, ana);

      expect(engine.world.session.seguindoId).toBe("p_Bento");
    });
  });

  it("parar de seguir limpa o plano — o Auto nao continua andando", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      engine.travelPlanParaObjetivo();

      expect(engine.travelPlan.length).toBeGreaterThan(0);

      engine.pararDeSeguir();

      expect(engine.world.session.seguindoId).toBeNull();
      expect(engine.travelPlan).toHaveLength(0);
      expect(engine.travelParado).toBe(0);
    });
  });

  it("o alvo que saiu do jogo NAO e seguida para o vazio", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.seguirJogador("p_Bento");

      engine.world.players.delete("p_Bento");

      expect(engine.destinoDoSeguido()).toBeNull();
    });
  });

  it("a posicao do alvo e lida em COPIA, e mover o mapa nao a altera", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.seguirJogador("p_Bento");

      const destino = engine.destinoDoSeguido();

      const x = destino.x;
      const y = destino.y;

      // o destino e um instantaneo: o Auto le o plano, e nao guarda
      // referencia para o outro jogador
      engine.world.players.get("p_Bento").player.x = 9999;

      expect(destino.x).toBe(x);
      expect(destino.y).toBe(y);
    });
  });

  it("trocar de alvo descarta o plano do anterior", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      engine.travelPlanParaObjetivo();

      expect(engine.travelPlan.length).toBeGreaterThan(0);

      engine.seguirJogador("p_Cora");

      expect(engine.world.session.seguindoId).toBe("p_Cora");
      expect(engine.travelPlan).toHaveLength(0);
    });
  });

  it("um bicho VIVO NAO cancela o acompanhamento", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      const ana = engine.world.player;
      const bento = engine.world.players.get("p_Bento").player;

      ana.x = 100;
      ana.y = 100;

      bento.x = 1400;
      bento.y = 900;

      // o `runTravelPlan` comeca pelo `pickAutoTarget`, que devolve uma
      // criatura viva da zona. Sem a guarda do `seguindoId`, ela
      // cancelava o plano e o jogador ficava parado no meio do caminho
      expect(engine.pickAutoTarget()).not.toBeNull();

      engine.runTravelPlan(0.016, ana);

      expect(engine.world.session.seguindoId).toBe("p_Bento");

      // e o plano continua apontando para ofollowed, e nao para o slime
      const etapa = engine.travelPlan[0];

      expect(Math.hypot(etapa.destinoX - 1400, etapa.destinoY - 900))
        .toBeLessThanOrEqual(1);
    });
  });

  it("longe de uma criatura o plano normal continua igual", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      // sem seguir ninguem, a cacada manda: e o comportamento antigo
      engine.world.players.get("p_Bento").player.x = 5000;
      engine.world.players.get("p_Bento").player.y = 3600;

      expect(engine.pickAutoTarget()).not.toBeNull();

      // e o plano NAO e montado para o outro jogador
      expect(engine.destinoDoObjetivo()).toBeNull();
    });
  });

  it("ATRAVESSAR PORTAL: o plano velho e descartado e refeito no mapa novo", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      const bento = engine.world.players.get("p_Bento").player;

      bento.x = 1000;
      bento.y = 800;

      expect(engine.travelPlanParaObjetivo()).toBe(true);

      const etapaAntiga = engine.travelPlan[0];

      expect(etapaAntiga.portalId).toBeNull();
      expect(etapaAntiga.mapId).toBe(MAP_1.id);

      /**
       * O PORTAL TROCA O MAPA DO MUNDO INTEIRO.
       *
       * Nao ha "mapa por jogador": quando o grupo atravessa, todo mundo
       * vai junto. E o `runTravelPlan` que descarta a etapa de outro
       * mapa, porque as coordenadas dela nao significam nada aqui
       */
      const outroMapa = Object.values(MAPS).find((m) => m.id !== MAP_1.id);

      engine.setMap(outroMapa);
      engine.world.collision.map = outroMapa;

      // Bento acorda do outro lado, no ponto de chegada
      bento.x = 300;
      bento.y = 400;

      engine.runTravelPlan(0.016, engine.world.player);

      /**
       * O PLANO TEM QUE COBRIR OS DOIS MAPAS.
       *
       * A etapa final fica no mapa do ALVO, e nao no meu: e o ponto de
       * chegada dele. Um plano com tudo no mapa novo seria um waypoint
       * para coordenadas que so fazem sentido la fora
       */
      const mapas = engine.travelPlan.map((e) => e.mapId);

      expect(mapas).toContain(outroMapa.id);
      expect(mapas).toContain("map_1");
      expect(engine.travelPlan.some((e) => e.portalId !== null)).toBe(true);

      /**
       * O DESTINO CONTINUA SENDO O MAPO DELE.
       *
       * Mover o jogador em foco nao move o seguido: o Bento esta no
       * vale, e o destino do acompanhamento e o vale. Se o destino
       * trocasse de mapa junto, o plano seria reamontado com o mapa do
       * seguidor e a rota de portal desapareceria
       */
      const destino = engine.destinoDoSeguido();

      expect(destino.mapId).toBe("map_1");
      expect(destino.mapId).not.toBe(outroMapa.id);
      expect(destino.x).toBe(300);
      expect(destino.y).toBe(400);
    });
  });

  it("no mesmo mapa a etapa final e o ALVO, e nao um portal", () => {
    const { engine } = montarDois();

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      const bento = engine.world.players.get("p_Bento").player;

      bento.x = 1000;
      bento.y = 800;

      expect(engine.travelPlanParaObjetivo()).toBe(true);

      const etapa = engine.travelPlan[0];

      expect(etapa.portalId).toBeNull();
      expect(etapa.x).toBe(1000);
      expect(etapa.y).toBe(800);
    });
  });

  /**
   * O SEGUIDO ATRAVESSOU O PORTAL.
   *
   * Este e o defeito que a suite nao pegava: cada jogador tem o seu
   * mapa, entao quando o alvo atravessa, as coordenadas dele deixam de
   * existir no mapa de quem segue. Ler o mapa do SEGUIDOR fazia o
   * destino virar um ponto que nao existe, e o personagem andava
   * infinito contra o limite do mapa
   *
   * O que precisa acontecer: o destino declara o mapa do ALVO, e o
   * plano ganha uma etapa de portal na frente
   */
  it("quem segue atravesa o portal: a primeira etapa e o portal, nao o alvo", () => {
    const hub = findMap("base");

    const engine = new GameEngine(null, classe, null, {
      playerId: "p_Ana",
      characterName: "Ana",
    });

    engine.setMap(hub);
    engine.world.collision.map = hub;

    // Ana fica no hub
    const anaSessao = createPlayerSession(classe, {
      id: "p_Ana",
      name: "Ana",
    });

    engine.addPlayer(anaSessao, { mapId: "base" });

    // e Bento no vale
    const bentoSessao = createPlayerSession(classe, {
      id: "p_Bento",
      name: "Bento",
    });

    engine.addPlayer(bentoSessao, { mapId: "map_1" });

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      // o mapa do seguido, e nao o meu
      const destino = engine.destinoDoSeguido();

      expect(destino.mapId).toBe("map_1");

      expect(engine.travelPlanParaObjetivo()).toBe(true);

      const etapa = engine.travelPlan[0];

      // a etapa acontece NO MEU mapa e termina num portal
      expect(etapa.mapId).toBe("base");
      expect(etapa.portalId).not.toBeNull();

      // e a etapa seguinte ja e no mapa do outro
      expect(engine.travelPlan[engine.travelPlan.length - 1].mapId).toBe("map_1");
    });
  });

  it("andando infinito contra o limite nao acontece: o destino e do alvo", () => {
    const hub = findMap("base");

    const engine = new GameEngine(null, classe, null, {
      playerId: "p_Ana",
      characterName: "Ana",
    });

    engine.setMap(hub);
    engine.world.collision.map = hub;

    engine.addPlayer(
      createPlayerSession(classe, { id: "p_Ana", name: "Ana" }),
      { mapId: "base" },
    );

    engine.addPlayer(
      createPlayerSession(classe, { id: "p_Bento", name: "Bento" }),
      { mapId: "map_1" },
    );

    engine.withPlayer("p_Ana", () => {
      engine.setAutoPlay(true);
      engine.seguirJogador("p_Bento");

      engine.travelPlanParaObjetivo();

      const etapas = engine.travelPlan.length;

      // o plano tem que ser um CAMINHO com portais, e nao um waypoint
      // direto para as coordenadas de outro mapa. Um waypoint direto
      // levava o boneco contra a borda ate o limite do mapa
      expect(etapas).toBeGreaterThan(0);
      expect(engine.travelPlan.some((e) => e.portalId !== null)).toBe(true);

      // nenhuma etapa pode apontar para uma posicao de outro mapa sem
      // ser uma etapa de travessia
      for (const etapa of engine.travelPlan) {
        const destinoDePortao = etapa.destinoMapId !== etapa.mapId;

        if (!destinoDePortao) {
          expect(etapa.portalId).toBeNull();
        }
      }
    });
  });
});
