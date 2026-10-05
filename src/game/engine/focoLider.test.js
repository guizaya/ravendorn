import { describe, expect, it, beforeEach } from "vitest";
import { GameEngine } from "../engine/GameEngine.js";
import { createPlayerSession } from "../engine/PlayerSession.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { PartyStore } from "../../../server/src/domain/PartyStore.js";
import { createCreature } from "../../data/enemies/index.js";

/**
 * FOCAR O ALVO DO LIDER.
 *
 * ## AS DUAS REGRAS DO PEDIDO
 *
 * - com o foco ligado, o membro bate no MESMO inimigo do lider
 * - com o lider sem alvo, o membro nao bate em NINGUEM
 *
 * ## POR QUE O TESTE NAO ESPERA O RELOGIO
 *
 * `runAutoHunt` escolhe o alvo no tique de `AUTO_RETARGET_INTERVAL`.
 * Forcando o tique a zero, o teste mede a DECISAO — contra quem o
 * membro ataca — sem depender de quantos quadros passaram
 */
const classe = CHARACTER_CLASSES.find((c) => c.id === "warrior");

const ANA = "p_Ana";
const BENTO = "p_Bento";

/** Ana e lider; Bento e membro. */
function montar() {
  const engine = new GameEngine(null, classe, null, {
    playerId: ANA,
    characterName: "Ana",
  });

  engine.setMap(MAP_1);
  engine.world.collision.map = MAP_1;

  const store = new PartyStore();

  for (const [id, nome] of [[ANA, "Ana"], [BENTO, "Bento"]]) {
    engine.addPlayer(
      createPlayerSession(classe, { id, name: nome }),
      { mapId: "map_1" },
    );
  }

  const party = {
    id: "party_1",
    lider: ANA,
    membros: new Set([ANA, BENTO]),
  };

  store.parties.set(party.id, party);
  store.partyPorSessao.set(ANA, party.id);
  store.partyPorSessao.set(BENTO, party.id);

  engine.partyStore = store;

  return { engine, store, party };
}

/** Um slime vivo no mapa, longe dos dois jogadores. */
function placingSlime(engine) {
  const mob = createCreature("slime", { x: 1200, y: 900 }, 0, 1);

  mob.alive = true;

  engine.world.enemies.push(mob);

  return mob;
}

/** Coloca os dois jogadores perto do mob, para o alcance nao ser o problema. */
function perto(engine, mob) {
  engine.world.players.get(ANA).player.x = mob.x - 30;
  engine.world.players.get(ANA).player.y = mob.y;
  engine.world.players.get(BENTO).player.x = mob.x + 30;
  engine.world.players.get(BENTO).player.y = mob.y;
}

/** Um tique de Auto, com a escolha de alvo forcada. */
const cacar = (engine, player) => {
  engine.autoDecisionTimer = -1;

  engine.runAutoHunt(0.016, player);
};

describe("o foco no alvo do lider", () => {
  let engine;
  let store;
  let party;
  let slime;

  beforeEach(() => {
    ({ engine, store, party } = montar());

    engine.withPlayer(ANA, () => {
      slime = placingSlime(engine);
    });

    perto(engine, slime);
  });

  it("sem o foco ligado, o membro escolhe o mob DELE, nao o do lider", () => {
    /**
     * DOIS MOBS, e o comando vai no mais LONGE.
     *
     * Com um mob so nao daria para distinguir as duas coisas: o membro
     * sem foco escolheria o mesmo que o lider, e o teste passaria
     * medindo a coincidencia em vez do foco
     */
    const longe = createCreature("slime", { x: 1800, y: 1300 }, 0, 1);

    longe.alive = true;

    /**
     * O ID PRECISA SER DIFERENTE.
     *
     * O `createCreature` numera a criacao, e dois slimes feitos no mesmo
     * teste saem com o mesmo id. Com ids iguais, os dois mobs viram um so
     * no `find`, e o teste mediria a coincidencia em vez do foco
     */
    longe.id = "slime_longe";

    engine.withPlayer(ANA, () => {
      engine.world.enemies.push(longe);

      engine.engagedTargetId = longe.id;
    });

    engine.withPlayer(BENTO, () => {
      expect(engine.focoDoLiderAtivo()).toBe(false);

      cacar(engine, engine.world.player);

      // o Bento escolhe o mob proximo dele, e nao o que o Ana batendo
      expect(engine.selectedTargetId).toBe(slime.id);
      expect(engine.selectedTargetId).not.toBe(longe.id);

      // e agora com o foco: passa a bater no do lider
      engine.world.session.focarLider = true;

      cacar(engine, engine.world.player);

      expect(engine.selectedTargetId).toBe(longe.id);
    });
  });

  it("com o foco ligado, o membro ataca o MESMO mob do lider", () => {
    engine.withPlayer(ANA, () => {
      engine.engagedTargetId = slime.id;
    });

    engine.withPlayer(BENTO, () => {
      engine.world.session.focarLider = true;

      expect(engine.focoDoLiderAtivo()).toBe(true);

      cacar(engine, engine.world.player);

      expect(engine.inimigoDoAlvoDoLider()?.id).toBe(slime.id);
      expect(engine.selectedTargetId).toBe(slime.id);
    });
  });

  it("o LIDER NAO foca em si mesmo", () => {
    engine.withPlayer(ANA, () => {
      engine.world.session.focarLider = true;

      // o Ana e o lider: focar no lider dele mesmo nao faz sentido
      expect(engine.focoDoLiderAtivo()).toBe(false);
      expect(engine.inimigoDoAlvoDoLider()).toBeNull();
    });
  });

  it("se o lider nao esta batendo em ninguem, o membro nao bate", () => {
    engine.withPlayer(ANA, () => {
      engine.engagedTargetId = null;
      engine.selectedTargetId = null;
    });

    engine.withPlayer(BENTO, () => {
      engine.world.session.focarLider = true;

      // o Bento com o foco ligado e sem Auto proprio
      engine.setAutoPlay(false);

      cacar(engine, engine.world.player);

      expect(engine.inimigoDoAlvoDoLider()).toBeNull();
      expect(engine.selectedTargetId).toBeNull();
    });
  });

  it("o alvo do AUTO do lider tambem conta como estar batendo", () => {
    engine.withPlayer(ANA, () => {
      engine.engagedTargetId = null;
      engine.selectedTargetId = slime.id;
    });

    engine.withPlayer(BENTO, () => {
      engine.world.session.focarLider = true;

      cacar(engine, engine.world.player);

      expect(engine.selectedTargetId).toBe(slime.id);
    });
  });

  it("o clique tem prioridade sobre o Auto do lider", () => {
    const outro = createCreature("slime", { x: 1400, y: 1000 }, 0, 1);

    outro.alive = true;

    outro.id = "slime_outro";

    engine.withPlayer(ANA, () => {
      engine.world.enemies.push(outro);

      engine.selectedTargetId = outro.id;
      engine.engagedTargetId = slime.id;
    });

    engine.withPlayer(BENTO, () => {
      engine.world.session.focarLider = true;

      expect(engine.inimigoDoAlvoDoLider()?.id).toBe(slime.id);
    });
  });

  it("o mob que o lider matou deixa de ser alvo, e nao vira outro", () => {
    engine.withPlayer(ANA, () => {
      engine.engagedTargetId = slime.id;
    });

    engine.withPlayer(BENTO, () => {
      engine.world.session.focarLider = true;

      cacar(engine, engine.world.player);

      expect(engine.selectedTargetId).toBe(slime.id);

      // o lider mata o slime
      slime.alive = false;

      cacar(engine, engine.world.player);

      // e o Bento nao vai atras de outro: some o alvo
      expect(engine.inimigoDoAlvoDoLider()).toBeNull();
      expect(engine.selectedTargetId).toBeNull();
    });
  });

  it("sem party, o foco nao faz nada", () => {
    engine.partyStore = new PartyStore();

    engine.withPlayer(BENTO, () => {
      engine.world.session.focarLider = true;

      expect(engine.focoDoLiderAtivo()).toBe(false);
      expect(engine.inimigoDoAlvoDoLider()).toBeNull();
    });
  });

  it("o foco nao e desligado pelo fim do acompanhamento", () => {
    engine.withPlayer(BENTO, () => {
      engine.world.session.focarLider = true;
      engine.seguirJogador(ANA);

      engine.pararDeSeguir();

      // as duas opcoes sao independentes: seguir e focar
      expect(engine.world.session.focarLider).toBe(true);
      expect(engine.world.session.seguindoId).toBeNull();
    });
  });

  it("o lider transferido vira a fonte do foco", () => {
    party.lider = BENTO;

    engine.withPlayer(ANA, () => {
      engine.world.session.focarLider = true;

      // com o Bento no comando, e o Ana que foca agora
      expect(engine.focoDoLiderAtivo()).toBe(true);
    });

    engine.withPlayer(BENTO, () => {
      // e o Bento deixa de focar
      expect(engine.focoDoLiderAtivo()).toBe(false);
    });
  });
});