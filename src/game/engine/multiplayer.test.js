import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { createPlayerSession } from "./PlayerSession.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";

// o catalogo e uma lista, entao a classe se procura pelo id e
// nao por `classe("warrior")`
const classe = (id) =>
  CHARACTER_CLASSES.find((c) => c.id === id);

const criar = () => {
  const engine = new GameEngine(
    null,
    classe("warrior"),
    null,
    { playerId: "p1", characterName: "Ana" },
  );

  engine.setMap(MAP_1);

  return engine;
};

describe("varios jogadores no mesmo mundo", () => {
  it("cada sessao tem inventario, missoes e craft proprios", () => {
    const engine = criar();

    const ana = engine.addPlayer(
      createPlayerSession(classe("warrior"), {
        id: "p_ana",
        name: "Ana",
        spawn: { x: 100, y: 100 },
      }),
    );

    const bento = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
        spawn: { x: 200, y: 200 },
      }),
    );

    // o bug classico: os dois apontando para o mesmo objeto,
    // o loot de um apareceria no inventario do outro
    expect(ana.inventory).not.toBe(bento.inventory);
    expect(ana.quests).not.toBe(bento.quests);
    expect(ana.craft).not.toBe(bento.craft);

    engine.destroy();
  });

  it("todos veem a MESMA lista de inimigos", () => {
    const engine = criar();

    const listaDoLocal = engine.world.enemies;

    engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
      }),
    );

    // a lista e a mesma referencia: um abate do Ana some para o
    // Bento tambem, e nao existe um slime_0 so do Ana
    expect(engine.world.enemies).toBe(listaDoLocal);
    expect(engine.world.enemies.length).toBe(listaDoLocal.length);

    engine.destroy();
  });

  it("abater um mob remove ele para todo mundo", () => {
    const engine = criar();

    const bento = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
      }),
    );

    const alvo = engine.world.enemies.find(
      (e) => e.kind !== "training" && e.hp > 0,
    );

    expect(alvo).toBeTruthy();

    const antes = engine.world.enemies.length;

    engine.withPlayer(bento.id, () => {
      engine.damage.applyDamage(
        bento.player,
        alvo,
        {
          id: "tiro",
          damage: 99999,
          damageType: "physical",
          color: "#fff",
        },
      );
    });

    // o mob continua na lista, mas morto: e o que faz o
    // respawn compartilhado
    expect(engine.world.enemies.length).toBe(antes);
    expect(alvo.hp).toBe(0);

    engine.destroy();
  });

  it("o loot de um abate vai so para quem matou", () => {
    const engine = criar();

    const ana = engine.addPlayer(
      createPlayerSession(classe("warrior"), {
        id: "p_ana",
        name: "Ana",
      }),
    );

    const bento = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
      }),
    );

    // determinismo: sem isso o teste passa ou falha conforme o
    // sorteio de 17% do slime
    engine.loot.roll = () => ({
      coins: 3,
      items: [{ itemId: "slime_gel", count: 1 }],
    });

    const alvo = engine.world.enemies.find(
      (e) => e.kind !== "training" && e.hp > 0,
    );

    engine.withPlayer(ana.id, () => {
      engine.damage.applyDamage(ana.player, alvo, {
        id: "tiro",
        damage: 99999,
        damageType: "physical",
        color: "#fff",
      });
    });

    expect(ana.inventory.coins).toBe(3);
    expect(ana.inventory.count("slime_gel")).toBe(1);

    // o Bento matou nada, entao nao tem nada
    expect(bento.inventory.coins).toBe(0);
    expect(bento.inventory.count("slime_gel")).toBe(0);

    engine.destroy();
  });

  it("cada jogador tem cooldowns e alvo proprios", () => {
    const engine = criar();

    const ana = engine.addPlayer(
      createPlayerSession(classe("warrior"), {
        id: "p_ana",
        name: "Ana",
      }),
    );

    const bento = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
      }),
    );

    ana.selectedTargetId = "slime_0";
    ana.autoPlay = true;
    ana.player.cooldowns.golpe = 5;

    expect(bento.selectedTargetId).toBe(null);
    expect(bento.autoPlay).toBe(false);
    expect(bento.player.cooldowns.golpe).toBeUndefined();

    engine.destroy();
  });

  it("o foco volta ao jogador anterior mesmo com erro", () => {
    const engine = criar();

    const ana = engine.world.session;
    const bento = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
      }),
    );

    expect(() =>
      engine.withPlayer(bento.id, () => {
        throw new Error("falhou no meio");
      }),
    ).toThrow("falhou no meio");

    // sem o finally, o motor ficaria com o inventario do Bento em
    // memoria enquanto o Ana_age
    expect(engine.world.session).toBe(ana);
    expect(engine.world.inventory).toBe(ana.inventory);

    engine.destroy();
  });

  it("sair limpa a sessao e nao quebra o motor", () => {
    const engine = criar();

    const bento = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
      }),
    );

    expect(engine.world.players.size).toBe(2);

    engine.removePlayer(bento.id);

    expect(engine.world.players.size).toBe(1);
    expect(engine.world.inventory).toBeTruthy();

    // o ponto e nao estourar: sobrar jogando com o motor ainda
    // inteiro, sem a sessao que saiu
    expect(() => engine.update(0.016)).not.toThrow();

    engine.destroy();
  });

  it("o id repetido nao cria jogador duplicado", () => {
    const engine = criar();

    const primeiro = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
      }),
    );

    const segundo = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Impostor",
      }),
    );

    // se aceitasse, o segundo ocuparia o lugar do primeiro e o
    // loot do primeiro iria parar no impostor
    expect(segundo).toBe(primeiro);
    // o motor ja tinha o jogador local, entao dois no total:
    // p1 e o Bento. nem o Impostor entrou
    expect(engine.world.players.size).toBe(2);

    engine.destroy();
  });
});

describe("o tick e o mesmo para todo mundo", () => {
  it("o mob e atualizado uma vez por tick, nao uma vez por jogador", () => {
    const engine = criar();

    // este e o bug que o teste existe para pegar: se a atualizacao
    // dos inimigos ficasse dentro do laco de jogadores, um
    // jogador a mais deixaria o mob mais rapido. com 3 online o
    // slime andaria e levaria dano 3 vezes mais rapido
    let chamadas = 0;
    const aiOriginal = engine.enemyAI.update.bind(
      engine.enemyAI,
    );

    engine.enemyAI.update = (enemy, dt) => {
      chamadas += 1;
      return aiOriginal(enemy, dt);
    };

    engine.update(0.016);
    const comUm = chamadas;

    chamadas = 0;
    for (let i = 0; i < 2; i += 1) {
      engine.addPlayer(
        createPlayerSession(classe("sorcerer"), {
          id: `p_extra_${i}`,
          name: `Extra ${i}`,
          spawn: { x: 4900, y: 4900 },
        }),
      );
    }

    engine.update(0.016);
    const comTres = chamadas;

    // veio de verdade, senao o teste passaria por acidente
    expect(comUm).toBeGreaterThan(0);
    expect(comTres).toBe(comUm);

    engine.destroy();
  });

  it("cada jogador anda na sua propria intencao", () => {
    const engine = criar();

    const ana = engine.world.session;

    const bento = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
        spawn: { x: 1200, y: 800 },
      }),
    );

    // a Ana aperta A, o Bento aperta D. se os dois lessem o mesmo
    // teclado as teclas se cancelariam e ninguem andaria
    ana.input.keys.add("KeyA");
    bento.input.keys.add("KeyD");

    const xAna = ana.player.x;
    const xBento = bento.player.x;

    engine.update(0.2);

    expect(ana.player.x).toBeLessThan(xAna);
    expect(bento.player.x).toBeGreaterThan(xBento);

    // e o teclado do outro nao vazou para o primeiro
    expect(ana.input.keys.has("KeyD")).toBe(false);
    expect(bento.input.keys.has("KeyA")).toBe(false);

    engine.destroy();
  });

  it("o foco no fim do tick e o jogador local", () => {
    const engine = criar();

    engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
      }),
    );

    // o laco passa por todo mundo, mas a camera e os paineis
    // continuam lendo o jogador local, e nao o ultimo da lista
    engine.update(0.016);

    expect(engine.world.session.id).toBe("p1");

    engine.destroy();
  });
});

describe("o mob persegue o jogador mais proximo", () => {
  it("acorda quando qualquer jogador entra no alcance", () => {
    const engine = criar();

    const bento = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
        spawn: { x: 5000, y: 5000 },
      }),
    );

    const alvo = engine.world.enemies.find(
      (e) => e.behavior === "active" && e.hp > 0,
    );

    // o Bento esta longe: o mob nao acorda
    engine.enemyAI.isAggressive(alvo);
    expect(alvo.alerted).toBe(false);

    // o jogador local chega perto
    const local = engine.world.session.player;
    local.x = alvo.x + 1;
    local.y = alvo.y;

    expect(engine.enemyAI.isAggressive(alvo)).toBe(true);
    expect(alvo.alerted).toBe(true);

    expect(bento).toBeTruthy();
    engine.destroy();
  });

  it("o dano do mob acerta quem ele realmente perseguiu", () => {
    const engine = criar();

    /**
     * Todo golpe ACERTA.
     *
     * Este arquivo mede para ONDE o mob ataca, e nao se ele acerta. O
     * jogador tem uns 5% de esquiva, e um teste que falhasse uma vez a
     * cada vinte por sorte nao mediria o alvo: mediria o dado
     *
     * `1` e o maior valor que o `random` devolve, e `1 < 5%` nunca e
     * verdade
     */
    engine.damage.random = () => 1;

    const bento = engine.addPlayer(
      createPlayerSession(classe("sorcerer"), {
        id: "p_bento",
        name: "Bento",
        spawn: { x: 5000, y: 5000 },
      }),
    );

    // o mob persegue o jogador local, entao o dano vai nele
    const local = engine.world.session.player;
    const hpLocal = local.hp;
    const hpBento = bento.player.hp;

    const alvo = engine.world.enemies.find(
      (e) => e.behavior === "active" && e.hp > 0,
    );

    local.x = alvo.x;
    local.y = alvo.y;

    engine.enemyAI.update(alvo, 5);

    // se o dano fosse para `world.player` fixo, o Bento nunca
    // levaria dano nenhum mesmo estivesse ao lado do mob
    expect(local.hp).toBeLessThan(hpLocal);
    expect(bento.player.hp).toBe(hpBento);

    engine.destroy();
  });
});
