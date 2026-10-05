import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { MAP_1_META } from "../../data/maps/index.js";

/**
 * Os tres "auto" sao tres PEDIDOS diferentes, e so um pode estar
 * no comando.
 *
 * 1. o botao (e a tecla T): cacar as criaturas perto
 * 2. o auto da missao: seguir o objetivo da missao
 * 3. o auto do bestiario: cacar UMA criatura
 *
 * O defeito era que os tres dividiam UM flag so, o `autoPlay`. Com
 * isso, ligar a missao acendia o botao, e apertar T no meio da
 * missao desligava o piloto sem desligar a missao: a tela dizia
 * "AUTO" e o personagem nao andava. Pior, o botao passava a
 * obedecer ao objetivo da missao e o arqueiro atravessava o mapa
 * atrás da zona em vez de bater no mob do lado.
 */
const criar = (classId = "warrior") => {
  const engine = new GameEngine(
    null,
    CHARACTER_CLASSES.find((c) => c.id === classId),
    null,
    { playerId: "p_ana", characterName: "Ana" },
  );

  engine.setMap(MAP_1);
  engine.world.collision.map = MAP_1;

  const player = engine.world.player;

  player.x = MAP_1.spawn.x;
  player.y = MAP_1.spawn.y;

  return { engine, player };
};

/** A zona do objetivo da missao principal. */
const zonaDaMissao = (engine) => {
  const quest = engine.world.quests.currentMain;

  return MAP_1_META.zones.find((entry) => entry.id === quest.location);
};

/**
 * A criatura VIVA mais proxima do jogador.
 *
 * Antes era "a primeira criatura viva da lista", o que so funciona por
 * acaso: o botao persegue o mob MAIS PROXIMO, entao o alvo do teste
 * precisa ser esse. Com o campo de provas ganhou um par de criaturas,
 * o primeiro registro da lista deixou de ser o mais proximo, e o teste
 * passou a medir a distancia para uma criatura que o piloto nem estava
 * mirando — o defeito aparecia como 3645px contra 3197px, sem pista
 * de que o problema era a escolha do alvo
 */
const criaturaViva = (engine) => {
  const player = engine.world.player;

  return engine.world.enemies
    .filter((e) => e.alive && e.isCreature)
    .sort(
      (a, b) =>
        Math.hypot(a.x - player.x, a.y - player.y) -
        Math.hypot(b.x - player.x, b.y - player.y),
    )[0];
};

/**
 * O piloto chegou perto de ALGUMA criatura?
 *
 * ## POR QUE NAO BASTA CONFERIR UMA
 *
 * O `pickAutoTarget` reavalia o mais proximo a cada tick, entao o alvo
 * pode trocar no meio da perseguida: o limo e PASSIVO e vagueia, e um
 * outro limo pode ficar mais perto do que o que o piloto mirava. Medir
 * uma criatura fixa entao mede a distancia para alguem que o piloto
 * ja abandoned — a criatura e o piloto andam para lados opostos e o
 * teste reprova com o piloto funcionando certo
 *
 * A intencao destes testes e "o botao leva o jogador ate um mob", e nao
 * "o botao persegue o registro 0 da lista". Isso mede a segunda
 */
const chegouEmAlgumMob = (engine, antes) => {
  const player = engine.world.player;

  const agora = Math.min(
    ...engine.world.enemies
      .filter((e) => e.alive && e.isCreature)
      .map((e) => Math.hypot(e.x - player.x, e.y - player.y)),
  );

  expect(agora).toBeLessThan(antes);
};

/** quanto o piloto andou no total */
const rodar = (engine, frames) => {
  const inicio = {
    x: engine.world.player.x,
    y: engine.world.player.y,
  };

  for (let frame = 0; frame < frames; frame += 1) {
    engine.update(1 / 60);
  }

  return Math.hypot(
    engine.world.player.x - inicio.x,
    engine.world.player.y - inicio.y,
  );
};

describe("o auto do botao e o de CACAR PERTO", () => {
  it("com a missao automatica desligada, o botao nao persegue a zona", () => {
    const { engine, player } = criar();

    const mob = criaturaViva(engine);

    // o botao, e nada mais
    engine.toggleAutoPlay();

    expect(engine.autoPlay).toBe(true);

    // a missao esta TRACADA (o auto dela esta desligado), que e o
    // estado normal do jogo. mesmo assim o botao tem que bater no
    // mob do lado
    expect(engine.world.quests.autoEnabled).toBe(false);
    expect(engine.getQuestObjective()).toBeNull();

    const distanciaAoMob = Math.hypot(
      mob.x - player.x,
      mob.y - player.y,
    );

    // o piloto tem que se aproximar do MOB, nao da zona da missao
    for (let frame = 0; frame < 600; frame += 1) {
      engine.update(1 / 60);
    }

    chegouEmAlgumMob(engine, distanciaAoMob);

    engine.destroy();
  });

  it("o botao nao empurra o personagem para longe do spawn", () => {
    const { engine } = criar();

    engine.toggleAutoPlay();

    const andou = rodar(engine, 600);

    // `autoLeashRange` e o limite do botao. um piloto que andou
    // mais que isso atravessou o mapa, que e o sintoma
    expect(andou).toBeLessThanOrEqual(
      engine.autoLeashRange * 3,
    );

    engine.destroy();
  });
});

describe("os tres autos nao convivem", () => {
  it("ligar a missao NAO acende o botao", () => {
    const { engine } = criar();

    engine.focusQuest(engine.world.quests.currentMain.id);

    expect(engine.world.quests.autoEnabled).toBe(true);

    // o botao e "cacar perto". se acender junto, o jogador nao
    // sabe mais qual dos dois o personagem esta seguindo
    expect(engine.autoPlay).toBe(false);

    engine.destroy();
  });

  it("apertar T com a missao no comando DESLIGA a missao", () => {
    const { engine } = criar();

    engine.focusQuest(engine.world.quests.currentMain.id);
    expect(engine.world.quests.autoEnabled).toBe(true);

    // agora o jogador quer voltar a cacar perto
    engine.toggleAutoPlay();

    // e o auto da missao sai do comando, senao o botao voltaria
    // a puxar o personagem para a zona
    expect(engine.world.quests.autoEnabled).toBe(false);
    expect(engine.autoPlay).toBe(true);
    expect(engine.getQuestObjective()).toBeNull();

    engine.destroy();
  });

  it("apertar T com a missao no comando faz CACAR, e nao seguir a zona", () => {
    const { engine, player } = criar();

    const quest = engine.world.quests.currentMain;

    engine.focusQuest(quest.id);

    // com a missao no comando, o piloto tem o OBJETIVO dela, e e
    // por ele que ele vai atras da zona da missao
    expect(engine.getQuestObjective()).not.toBeNull();

    // o jogador aperta T: quer voltar a cacar perto
    engine.toggleAutoPlay();

    const mob = criaturaViva(engine);
    const distanciaAoMob = Math.hypot(
      mob.x - player.x,
      mob.y - player.y,
    );

    for (let frame = 0; frame < 600; frame += 1) {
      engine.update(1 / 60);
    }

    // o piloto foi para o MOB
    chegouEmAlgumMob(engine, distanciaAoMob);

    // e, o que importa, ele nao tem mais destino de zona. medir a
    // distancia do centro da zona nao serviria: o mob escolhido
    // pode estar no caminho da zona, e o piloto estaria "indo
    // para longe" enquanto na verdade so mudou de alvo
    expect(engine.getQuestObjective()).toBeNull();
    expect(engine.autoPlayTarget()?.isWaypoint).toBeFalsy();

    engine.destroy();
  });

  it("o auto da missao ANDA mesmo com o botao desligado", () => {
    const { engine, player } = criar();

    const quest = engine.world.quests.currentMain;

    engine.focusQuest(quest.id);

    // e o defeito do "AUTO na tela e o personagem parado": o
    // piloto era ligado pelo `autoPlay`, e o botao podia
    // desligar o piloto sem desligar a missao
    expect(engine.autoPlay).toBe(false);

    const inicio = { x: player.x, y: player.y };

    for (let frame = 0; frame < 600; frame += 1) {
      engine.update(1 / 60);
    }

    /**
     * O QUE ESTE TESTE MEDE E "O PERSONAGEM ANDA", e nao "A DISTANCIA
     * ENCURTA".
     *
     * A primeira missao da campanha aponta para o Pantano, que fica na
     * ultima faixa do vale — e a fileira de arbustos do sul fecha o mapa
     * no meio. O caminho ate la passa pelo vao do oeste, entao nos
     * primeiros dez segundos o piloto anda para OPOSTO da zona e a
     * distancia reta CRESCE
     *
     * Medir a reta reprovava com o piloto certo. O que prova o defeito
     * original — a tela dizendo AUTO com o personagem parado — e o
     * deslocamento, e o objetivo no comando que diz quem mandou nele
     */
    const andou = Math.hypot(
      player.x - inicio.x,
      player.y - inicio.y,
    );

    expect(
      andou,
      "o personagem nao andou, e o auto da missao estava ligado",
    ).toBeGreaterThan(100);

    expect(engine.getQuestObjective()).not.toBeNull();

    expect(
      engine.autoWaypoint,
      "o piloto andou sem ter para onde: nenhum waypoint publicado",
    ).not.toBeNull();

    engine.destroy();
  });

  it("o auto do bestiario assume o comando e desliga o botao", () => {
    const { engine } = criar();

    engine.toggleAutoPlay();
    expect(engine.autoPlay).toBe(true);

    // o bestiario guarda o TIPO da criatura, nao a instancia: o id
    // do bicho no mapa e `slime_0`, e a entrada do bestiario e
    // `slime`
    engine.setBestiaryAuto(
      criaturaViva(engine).id.replace(/_\d+$/, ""),
    );

    // o bestiario e um pedido dedicado a UMA criatura. com o
    // botao ligado junto, o piloto podia alternar entre os dois
    // alvos e nunca completar nenhum
    expect(engine.isBestiaryAutoOn).toBe(true);
    expect(engine.autoPlay).toBe(false);

    engine.destroy();
  });

  it("o botao TIRA a cacada do bestiario do comando", () => {
    // O simetrico do teste de cima, e o defeito que ele nao pegava.
    //
    // `getAutoObjective` da PRIORIDADE ao bestiario. Uma cacada de
    // criatura que sobrevivesse ao botao continuaria mandando no
    // piloto, e o jogador veria o personagem ir para a zona da
    // criatura em vez de bater no mob do lado: o mesmo sintoma do
    // auto da missao, com outra causa.
    const { engine, player } = criar();

    engine.setBestiaryAuto(
      criaturaViva(engine).id.replace(/_\d+$/, ""),
    );

    expect(engine.isBestiaryAutoOn).toBe(true);

    // o jogador aperta T
    engine.toggleAutoPlay();

    expect(engine.autoPlay).toBe(true);
    expect(engine.isBestiaryAutoOn).toBe(false);

    // o objetivo agora e nulo: o piloto vai pelo botao, que e
    // cacar o que estiver perto
    expect(engine.getAutoObjective()).toBeNull();

    // e o personagem realmente vai para um mob, e nao para a zona
    const mob = criaturaViva(engine);
    const distancia = Math.hypot(mob.x - player.x, mob.y - player.y);

    for (let frame = 0; frame < 600; frame += 1) {
      engine.update(1 / 60);
    }

    chegouEmAlgumMob(engine, distancia);

    engine.destroy();
  });
});
