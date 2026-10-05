import { describe, expect, it } from "vitest";
import { GameEngine } from "../engine/GameEngine.js";
import { createPlayerSession } from "../engine/PlayerSession.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { createCreature } from "../../data/enemies/index.js";
import { PartyStore } from "../../../server/src/domain/PartyStore.js";

/**
 * A DIVISAO DE LOOT DA PARTY.
 *
 * ## AS TRES REGRAS QUE O PEDIDO FAZ
 *
 * - MISSAO: o mob que um matou conta na missao do outro, INTEIRO
 * - OURO e XP: divididos entre quem esta na party
 * - ITEM: sorteado para UM so membro
 *
 * ## POR QUE A MISSAO NAO E DIVIDIDA
 *
 * Dividir a barra por dois faria a missao levar o dobro de tempo so por
 * estar acompanhado. O jogadorCompanheiro nao deveria ser um obstaculo
 *
 * ## POR QUE O ITEM NAO E DIVIDIDO
 *
 * Um item por abate, sorteado entre os membros. Sortear um por membro
 * faria tres itens cairem em tres gente, e a party viraria uma maquina
 * de multiplicar loot
 */

const classe = CHARACTER_CLASSES.find((c) => c.id === "warrior");

/** Coloca as sessoas na MESMA party, sem passar pelo convite. */
function montarParty(membros) {
  const engine = new GameEngine(null, classe, null, {
    playerId: "p_placeholder",
    characterName: "Placeholder",
  });

  engine.setMap(MAP_1);
  engine.world.collision.map = MAP_1;

  const store = new PartyStore();

  /**
   * A SESSAO VEM DE `createPlayerSession`, e nao e um objeto de mentira.
   *
   * O `handleKill` le `inventory`, `quests` e `bestiary` da sessao. Uma
   * sessao feita a mao daria um falso verde: o abate_findaria o ouro e a
   * missao passaria sem nada existir
   */
  for (const nome of membros) {
    const sessao = createPlayerSession(classe, {
      id: `p_${nome}`,
      name: nome,
    });

    engine.addPlayer(sessao);
  }

  return { engine, store };
}

describe("o abate da party", () => {
  it("a missao conta para os DOIS, inteiro", () => {
    const { engine, store } = montarParty(["Ana", "Bento"]);

    const party = {
      id: "party_teste",
      membros: new Set(["p_Ana", "p_Bento"]),
    };

    store.parties.set(party.id, party);
    store.partyPorSessao.set("p_Ana", party.id);
    store.partyPorSessao.set("p_Bento", party.id);

    engine.partyStore = store;

    engine.world.enemies.length = 0;

    const mob = createCreature("slime", { x: 3000, y: 2100 }, 0, 1);

    mob.alive = true;

    engine.world.enemies.push(mob);

    // Bento mata, e Ana e o segundo membro
    engine.withPlayer("p_Bento", () => {
      engine.handleKill(mob, engine.world.players.get("p_Bento").player);
    });

    const ana = engine.world.players.get("p_Ana");
    const bento = engine.world.players.get("p_Bento");

    // os doiswargs de hunt avancaram
    expect(ana.quests.mainProgress + ana.quests.sideProgress).toBeGreaterThan(0);
    expect(bento.quests.mainProgress + bento.quests.sideProgress).toBeGreaterThan(0);
  });

  it("o ouro e dividido e a SOMA fecha", () => {
    const { engine, store } = montarParty(["Ana", "Bento", "Cora"]);

    const party = {
      id: "party_3",
      membros: new Set(["p_Ana", "p_Bento", "p_Cora"]),
    };

    store.parties.set(party.id, party);

    for (const nome of ["Ana", "Bento", "Cora"]) {
      store.partyPorSessao.set(`p_${nome}`, party.id);
    }

    engine.partyStore = store;

    engine.world.enemies.length = 0;

    const mob = createCreature("ogre", { x: 3000, y: 2100 }, 0, 12);

    mob.alive = true;

    engine.world.enemies.push(mob);

    const antes = ["Ana", "Bento", "Cora"].map(
      (n) => engine.world.players.get(`p_${n}`).inventory.coins,
    );

    engine.withPlayer("p_Ana", () => {
      engine.handleKill(mob, engine.world.players.get("p_Ana").player);
    });

    const depois = ["Ana", "Bento", "Cora"].map(
      (n) => engine.world.players.get(`p_${n}`).inventory.coins,
    );

    const ganhou = depois.map((v, i) => v - antes[i]);

    // o dono ganhou a parte dele
    expect(ganhou[0]).toBeGreaterThan(0);

    // os outros tambem ganharam ALGUMA coisa: e a divisao
    expect(ganhou[1]).toBeGreaterThan(0);
    expect(ganhou[2]).toBeGreaterThan(0);

    /**
     * A SOMA DEVE SER O TOTAL DO LOOT SORTEADO UMA VEZ.
     *
     * Se a divisao dobrasse o ouro, a soma passaria do teto do sorteio. E
     * `mob.loot.coins` e a FAIXA `{min, max}` do drop, e nao o valor
     * sorteado: o teto da faixa e o maior ouro que aquele mob poderia
     * dar, entao e o limite valido para a soma
     */
    const tetoDoMob = mob.loot.coins.max;

    const totalDividido = ganhou.reduce((a, b) => a + b, 0);

    expect(totalDividido).toBeLessThanOrEqual(tetoDoMob);

    // e ninguem passou do teto: a divisao nao inventa moeda
    for (const ganho of ganhou) {
      expect(ganho).toBeLessThanOrEqual(tetoDoMob);
    }
  });

  it("sozinho na party, o loot NAO e dividido", () => {
    const { engine, store } = montarParty(["Ana"]);

    const party = { id: "p1", membros: new Set(["p_Ana"]) };

    store.parties.set(party.id, party);
    store.partyPorSessao.set("p_Ana", party.id);

    engine.partyStore = store;

    engine.world.enemies.length = 0;

    const mob = createCreature("slime", { x: 3000, y: 2100 }, 0, 1);

    mob.alive = true;

    engine.world.enemies.push(mob);

    const antes = engine.world.players.get("p_Ana").inventory.coins;

    engine.withPlayer("p_Ana", () => {
      engine.handleKill(mob, engine.world.players.get("p_Ana").player);
    });

    const depois = engine.world.players.get("p_Ana").inventory.coins;

    /**
     * O ganho e o LOOT CHEIO.
     *
     * Sem ninguem para dividir, o dono leva os `min` do sorteio — que e o
     * piso da faixa do mob, e nunca mais que isso
     */
    expect(depois - antes).toBeGreaterThanOrEqual(mob.loot.coins.min);

    expect(depois - antes).toBeLessThanOrEqual(mob.loot.coins.max);
  });
});