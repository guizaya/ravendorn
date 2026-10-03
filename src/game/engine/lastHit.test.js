import { describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { createPlayerSession } from "./PlayerSession.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";

const classe = CHARACTER_CLASSES.find(
  (c) => c.id === "arbalist",
);

/**
 * Engine headless com espiao no loot.
 *
 * O que interessa aqui e DE QUEM o loot e. Em vez de olhar o
 * inventario (que e um so, o do jogador local), a gente
 * intercepta `collectFrom`, que e onde o dono entra.
 */
const criar = (options = {}) => {
  const engine = new GameEngine(
    null,
    classe,
    null,
    { playerId: "p1", characterName: "Ana", ...options },
  );

  engine.setMap(MAP_1);

  const lootCalls = [];

  const real = engine.loot.collectFrom.bind(engine.loot);

  engine.loot.collectFrom = (creature, owner = null) => {
    const result = real(creature, owner);
    lootCalls.push({ ...result, ownerId: owner?.id ?? null });
    return result;
  };

  return { engine, lootCalls };
};

/**
 * Um SEGUNDO jogador de verdade, como o servidor cria por conexao.
 *
 * Antes era um objeto solto, `{ id: "p2" }`, so com o id. Ele
 * funcionava porque o loot so precisava de um id para marcar o drop,
 * mas escondia o ponto central da regra: o dono do abate e
 * resolvido pelo id ate a SESSAO, e sem sessao nao ha para quem
 * entregar. Com o atalho, o teste passava pedindo ouro a um
 * aggressor que nao existia.
 *
 * A sessao entra sem foco, entao `engine.world.player` continua
 * sendo o p1 e os testes de "o local nao recebeu" seguem valendo.
 */
const entrarComo = (engine, id) => {
  const sessao = createPlayerSession(classe, { id, name: id });

  engine.addPlayer(sessao, { focus: false });

  return sessao;
};

/** O mesmo segundo jogador, ja na forma de quem leva o golpe. */
const outroJogador = (engine, id = "p2") =>
  entrarComo(engine, id).player;

const primeiroMob = (engine) =>
  engine.world.enemies.find((e) => e.isCreature);

/**
 * O golpe SEMPRE acerta.
 *
 * Este arquivo mede last hit e dono de loot, e nao precisa. Deixando o
 * sorteio solto, uma criatura com 3% de esquiva faria este teste
 * passar ou falhar conforme a rodada — e um teste que roda de novo
 * para ver se passou e pior do que um teste que falta
 *
 * `1` e o maior valor que o `random` pode devolver, e `1 < 3%` nunca
 * e verdade. E o mesmo `random` que controla o critico: aqui ele
 * desliga o critico tambem, que e o que o loot espera
 */
const semFalhar = (engine) => {
  engine.damage.random = () => 1;

  return engine;
};

const dano = (engine, enemy, attacker, amount = 999999) => {
  engine.damage.applyDamage(
    attacker,
    enemy,
    { damage: amount, damageType: "physical" },
  );
};

const veneno = {
  type: "poison",
  duration: 5,
  damagePerTick: 50,
  tickInterval: 0.5,
};

/** roda um segundo de simulacao: o tick do DoT so dispara a
 * cada `tickInterval`, e 2 frames nao chegam nele */
const simularUmSegundo = (engine) => {
  for (let i = 0; i < 60; i++) {
    engine.update(1 / 60);
  }
};

describe("last hit do loot", () => {
  it("o loot e do jogador local quando ele mata", () => {
    const { engine, lootCalls } = criar();

    semFalhar(engine);
    const mob = primeiroMob(engine);

    dano(engine, mob, engine.world.player);

    expect(mob.alive).toBe(false);
    expect(lootCalls).toHaveLength(1);
    expect(lootCalls[0].ownerId).toBe("p1");

    engine.destroy();
  });

  it("o loot e do OUTRO jogador quando ele da o ultimo golpe", () => {
    // o coracao da regra: dois jogadores no mesmo mob, o loot vai
    // para quem zerou o HP
    const { engine, lootCalls } = criar();

    semFalhar(engine);
    const mob = primeiroMob(engine);

    dano(engine, mob, outroJogador(engine, "p2"));

    expect(mob.alive).toBe(false);
    expect(lootCalls[0].ownerId).toBe("p2");

    engine.destroy();
  });

  it("o loot vai para o ULTIMO a dar dano, nao para o primeiro", () => {
    const { engine, lootCalls } = criar();

    semFalhar(engine);
    const mob = primeiroMob(engine);

    // o local acerta, mas nao mata
    dano(engine, mob, engine.world.player, 1);
    expect(mob.alive).toBe(true);
    expect(lootCalls).toHaveLength(0);

    // o outro finaliza
    dano(engine, mob, outroJogador(engine, "p2"));

    expect(lootCalls[0].ownerId).toBe("p2");

    engine.destroy();
  });

  it("quem deu o golpe final leva, mesmo tendo dado o primeiro", () => {
    const { engine, lootCalls } = criar();

    semFalhar(engine);
    const mob = primeiroMob(engine);

    // o outro abre o abate
    dano(engine, mob, outroJogador(engine, "p2"), 5);

    // o local fecha
    dano(engine, mob, engine.world.player);

    expect(lootCalls[0].ownerId).toBe("p1");

    engine.destroy();
  });

  it("guarda o ultimo agressor no proprio mob", () => {
    const { engine } = criar();
    const mob = primeiroMob(engine);

    dano(engine, mob, outroJogador(engine, "p2"), 3);

    expect(mob.lastHitBy.id).toBe("p2");

    engine.destroy();
  });

  it("o drop transbordado carrega o id do dono", () => {
    const { engine } = criar();
    const mob = primeiroMob(engine);

    // o sorteio e aleatorio (a chance de drop do slime e 17%), e
    // um teste que depende da sorte falha 5 em cada 6 vezes. o
    // que importa aqui e o `ownerId` do drop, entao o sorteio
    // e fixado
    engine.loot.roll = () => ({
      coins: 5,
      items: [{ itemId: "slime_gel", count: 4 }],
    });

    // Esvazia a mochila de QUEM VAI RECEBER. Antes este passo
    // esvaziava `engine.world.inventory`, a do p1, e o teste passava
    // porque o loot caia no inventario de quem estava em foco. Com o
    // loot indo para a sessao do matador, e a mochila DELE que
    // precisa estar cheia: senao o item entra e nada transborda
    const p2 = entrarComo(engine, "p2");

    p2.inventory.capacity = 0;
    p2.inventory.stacks.length = 0;

    dano(engine, mob, p2.player);

    const drops = engine.world.drops.filter(
      (d) => d.kind === "item",
    );

    expect(drops.length).toBeGreaterThan(0);

    for (const drop of drops) {
      expect(drop.ownerId, drop.itemId).toBe("p2");
    }

    engine.destroy();
  });

  it("ninguem mais recolhe o drop de outro", () => {
    const { engine } = criar();

    engine.world.drops.push({
      uid: "drop_teste",
      kind: "item",
      itemId: "slime_gel",
      count: 3,
      x: engine.world.player.x,
      y: engine.world.player.y,
      ownerId: "p2",
      age: 0,
    });

    const antes = engine.world.inventory.count("slime_gel");

    engine.loot.collectNear(engine.world.player);

    expect(
      engine.world.inventory.count("slime_gel"),
      "pegou drop de outro jogador",
    ).toBe(antes);
    expect(engine.world.drops).toHaveLength(1);

    engine.destroy();
  });

  it("o dono do drop recolhe normalmente", () => {
    const { engine } = criar({ playerId: "p2" });

    engine.world.drops.push({
      uid: "drop_meu",
      kind: "item",
      itemId: "slime_gel",
      count: 3,
      x: engine.world.player.x,
      y: engine.world.player.y,
      ownerId: "p2",
      age: 0,
    });

    engine.loot.collectNear(engine.world.player);

    expect(
      engine.world.inventory.count("slime_gel"),
    ).toBe(3);
    expect(engine.world.drops).toHaveLength(0);

    engine.destroy();
  });

  it("drop sem dono continua recolhivel", () => {
    // loot antigo, ou de mob sem dono rastreado, nao pode ficar
    // preso no chao para sempre
    const { engine } = criar();

    engine.world.drops.push({
      uid: "drop_sem_dono",
      kind: "item",
      itemId: "slime_gel",
      count: 2,
      x: engine.world.player.x,
      y: engine.world.player.y,
      ownerId: null,
      age: 0,
    });

    engine.loot.collectNear(engine.world.player);

    expect(
      engine.world.inventory.count("slime_gel"),
    ).toBe(2);

    engine.destroy();
  });
  it("o mob volta a dar loot depois de restaurado", () => {
    // O `rewardGranted` impede o loot de ser entregue duas vezes
    // para o mesmo abate. Se um caminho de ressurreicao esquecer de
    // limpar esse flag, o mob volta a andar e a apanhar, mas nunca
    // mais da loot, sem nenhum erro. Foi assim que a ressurreicao
    // manual quebrou uma vez.
    const { engine, lootCalls } = criar();

    semFalhar(engine);
    const mob = primeiroMob(engine);

    dano(engine, mob, engine.world.player);
    expect(lootCalls).toHaveLength(1);

    engine.reviveEnemy(mob);
    mob.hp = 1;

    dano(engine, mob, engine.world.player);

    expect(lootCalls, "segundo abate nao deu loot").toHaveLength(
      2,
    );

    engine.destroy();
  });
});

describe("cada jogador tem o proprio loot", () => {
  /**
   * No single player existe um so inventario, entao qualquer teste
   * de last hit passa sem provar nada sobre dono. Aqui o segundo
   * jogador e uma SESSAO de verdade, com o inventario dele, e e ai
   * que mora a prova.
   *
   * Antes o teste montava um objeto com `inventory` colado a mao e
   * ainda prende `engine.world.player.inventory` na entidade, para
   * compensar o `inventoryOf` cair no fallback. As duas gambiarras
   * sairam: a sessao ja tem o inventario, e o loot agora recebe a
   * sessao do dono em vez de confiar em quem esta em foco.
   */
  const criarDois = () => {
    const { engine, lootCalls } = criar();

    semFalhar(engine);
    const mob = primeiroMob(engine);

    const outro = entrarComo(engine, "p2");

    return { engine, mob, outro, lootCalls };
  };

  it("o item cai no inventario de quem deu o ultimo golpe", () => {
    const { engine, mob, outro } = criarDois();

    // o sorteio do slime so da item 17% das vezes: fixado, senao
    // o teste falharia na maioria das execucoes
    engine.loot.roll = () => ({
      coins: 4,
      items: [{ itemId: "slime_gel", count: 2 }],
    });

    dano(engine, mob, outro.player);

    // o outro recebeu
    expect(outro.inventory.count("slime_gel")).toBe(2);
    expect(outro.inventory.coins).toBe(4);

    // e o local nao recebeu nada
    expect(engine.world.inventory.coins).toBe(0);
    expect(engine.world.inventory.stacks).toHaveLength(0);

    engine.destroy();
  });

  it("o mesmo mob da loot para inventarios diferentes", () => {
    const { engine, mob, outro } = criarDois();

    engine.loot.roll = () => ({
      coins: 7,
      items: [{ itemId: "slime_gel", count: 2 }],
    });

    dano(engine, mob, outro.player);

    expect(outro.inventory.coins).toBe(7);
    expect(outro.inventory.count("slime_gel")).toBe(2);

    expect(engine.world.inventory.coins).toBe(0);
    expect(engine.world.inventory.count("slime_gel")).toBe(0);

    engine.destroy();
  });

  it("cada um recolhe o proprio drop pelo chao", () => {
    const { engine, mob, outro } = criarDois();

    // um drop de cada, com dono, no mesmo ponto
    engine.world.drops.push(
      {
        uid: "d2",
        kind: "item",
        itemId: "slime_gel",
        count: 1,
        x: mob.x,
        y: mob.y,
        ownerId: "p2",
        age: 0,
      },
      {
        uid: "d1",
        kind: "item",
        itemId: "rat_tail",
        count: 1,
        x: mob.x,
        y: mob.y,
        ownerId: "p1",
        age: 0,
      },
    );

    // o local parado em cima do chao pega so o dele
    engine.world.player.x = mob.x;
    engine.world.player.y = mob.y;

    engine.loot.collectNear(engine.world.player);

    expect(engine.world.inventory.count("slime_gel")).toBe(0);
    expect(engine.world.inventory.count("rat_tail")).toBe(1);

    // o outro pega o dele
    engine.loot.collectNear(
      { ...outro.player, x: mob.x, y: mob.y },
      undefined,
      outro.inventory,
    );

    expect(outro.inventory.count("slime_gel")).toBe(1);

    engine.destroy();
  });
});

describe("abate por veneno nao perde o loot", () => {
  it("o DoT que mata o mob entrega loot e xp", () => {
    // O StatusSystem tira vida direto, sem passar pelo
    // DamageSystem. Antes essa rota marcava o mob morto e seguia,
    // sem loot, sem xp, sem missao: o jogador assistia ao abate
    // e nao recebia nada
    const { engine, lootCalls } = criar();

    semFalhar(engine);
    const mob = primeiroMob(engine);
    const award = vi.spyOn(engine, "announceLoot");

    mob.hp = 1;

    engine.statuses.apply(
      mob,
      veneno,
      engine.world.player,
    );

    const xpAntes = engine.world.player.xp ?? 0;

    simularUmSegundo(engine);

    expect(mob.alive).toBe(false);
    expect(award).toHaveBeenCalled();
    expect(lootCalls).toHaveLength(1);
    expect(
      engine.world.player.xp ?? 0,
      "nenhum xp foi dado",
    ).toBeGreaterThan(xpAntes);

    engine.destroy();
  });

  it("o loot do DoT vai para quem aplicou o veneno", () => {
    const { engine, lootCalls } = criar();

    semFalhar(engine);
    const mob = primeiroMob(engine);

    mob.hp = 1;

    engine.statuses.apply(
      mob,
      veneno,
      outroJogador(engine, "p2"),
    );

    simularUmSegundo(engine);

    expect(lootCalls[0].ownerId).toBe("p2");

    engine.destroy();
  });

  it("a rota de morte e a mesma com e sem DoT", () => {
    // duas rotas de morte que discordam e a origem do bug. agora
    // as duas passam por killEnemy e deixam o mob no mesmo estado
    const comDot = criar();
    const semDot = criar();

    const mobA = primeiroMob(comDot.engine);
    const mobB = primeiroMob(semDot.engine);

    mobA.hp = 1;

    comDot.engine.statuses.apply(
      mobA,
      veneno,
      comDot.engine.world.player,
    );
    simularUmSegundo(comDot.engine);

    dano(semDot.engine, mobB, semDot.engine.world.player);

    for (const campo of [
      "alive",
      "aiState",
      "alerted",
      "provoked",
      "rewardGranted",
    ]) {
      expect(mobA[campo], campo).toBe(mobB[campo]);
    }

    // o respawn comeca nos dois, mas o DoT morre no meio da
    // simulacao e ja conta tempo, entao so o "> 0" faz sentido
    expect(mobA.respawnTimer).toBeGreaterThan(0);
    expect(mobB.respawnTimer).toBeGreaterThan(0);

    comDot.engine.destroy();
    semDot.engine.destroy();
  });

  it("o DoT nao roda duas vezes no mesmo mob", () => {
    // killEnemy tem guarda de `alive === false`. sem ela, o
    // segundo update entregaria o loot duas vezes
    const { engine, lootCalls } = criar();

    semFalhar(engine);
    const mob = primeiroMob(engine);

    mob.hp = 1;

    engine.statuses.apply(
      mob,
      veneno,
      engine.world.player,
    );

    simularUmSegundo(engine);
    simularUmSegundo(engine);

    expect(lootCalls).toHaveLength(1);

    engine.destroy();
  });
});
