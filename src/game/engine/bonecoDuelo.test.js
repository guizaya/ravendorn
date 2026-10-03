import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { createPlayerSession } from "./PlayerSession.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { distance } from "../math.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

/**
 * A regra do boneco de duelo.
 *
 * O que foi pedido, em uma frase: boneco de treino parado ate
 * levar o primeiro golpe, e dai em diante e o OGRE, com uma
 * diferenca que muda tudo num jogo com duas pessoas na tela: ele
 * NAO troca de alvo.
 *
 * O boneco trava em QUEM BATEU PRIMEIRO, vai ate la e causa dano.
 * Se um segundo jogador mais PROXIMO comecar a bater, ele continua
 * no primeiro. So quando o alvo morre o agro passa para quem
 * estiver batendo naquele instante, e sem ninguem batendo ele
 * destrava e volta a ser alvo fixo.
 *
 * Os outros seis bonecos de treino nao entram em nada disso.
 */
const TIPO = "dummy_warrior";

installDomStubs();

const classe = () =>
  CHARACTER_CLASSES.find((d) => d.id === "warrior");

function criar() {
  const engine = new GameEngine(
    createTestCanvas().element,
    classe(),
    () => {},
  );

  engine.setMap(MAP_1);

  return engine;
}

/** Ana (o jogador local) e Bento, um segundo jogador de verdade. */
function comDois(engine) {
  const ana = [...engine.world.players.values()][0];

  const sessaoBento = createPlayerSession(classe(), {
    id: "p_bento",
    name: "Bento",
  });

  engine.addPlayer(sessaoBento, { focus: false });

  return { ana, bento: sessaoBento };
}

const boneco = (engine) =>
  engine.world.enemies.find((enemy) => enemy.id === TIPO);

/** Bate no boneco como este jogador, pelo caminho real de dano. */
function bater(engine, sessao, alvo = boneco(engine)) {
  engine.withPlayer(sessao.id, () => {
    engine.damage.applyDamage(sessao.player, alvo, {
      damage: 30,
      damageType: "physical",
    });
  });
}

const rodar = (engine, segundos) => {
  const quadros = Math.round(segundos * 60);

  for (let i = 0; i < quadros; i += 1) {
    engine.update(1 / 60);
  }
};

describe("boneco de duelo: fica parado ate levar o primeiro golpe", () => {
  it("nao anda, nao vagueia e nao tem alvo enquanto ninguem bate", () => {
    const engine = criar();

    const alvo = boneco(engine);

    expect(alvo.duelo).toBeTruthy();
    expect(alvo.targetId).toBeNull();

    rodar(engine, 10);

    expect(alvo.aiState).toBe("idle");
    expect(alvo.targetId).toBeNull();
    expect(
      Math.hypot(alvo.x - alvo.spawnX, alvo.y - alvo.spawnY),
    ).toBe(0);

    engine.destroy();
  });

  it("trava no primeiro agressor, e nao no mais proximo", () => {
    const engine = criar();
    const { ana, bento } = comDois(engine);

    const alvo = boneco(engine);

    // o Bento e posto BEM mais perto que a Ana, para o teste provar
    // que a escolha e pelo GOLPE e nao pela distancia
    bento.player.x = alvo.x + 40;
    bento.player.y = alvo.y;

    bater(engine, ana);
    bater(engine, bento);

    expect(alvo.targetId).toBe(ana.player.id);

    engine.destroy();
  });
});

describe("boneco de duelo: vai ate o alvo e causa dano", () => {
  it("caminha ate quem bateu e chega no alcance do golpe", () => {
    const engine = criar();
    const { ana } = comDois(engine);

    const alvo = boneco(engine);
    const antes = distance(alvo, ana.player);

    bater(engine, ana);
    rodar(engine, 15);

    const depois = distance(alvo, ana.player);

    // andou ate encostar, e PAROU no alcance: um melee que
    // atravessasse o jogador ficaria do outro lado
    expect(antes).toBeGreaterThan(alvo.duelo.attackRange);
    expect(depois).toBeLessThanOrEqual(alvo.duelo.attackRange + 8);
    expect(alvo.aiState).toBe("attack");

    engine.destroy();
  });

  it("golpeia o alvo, e so o alvo", () => {
    const engine = criar();
    const { ana, bento } = comDois(engine);

    const alvo = boneco(engine);

    // o Bento encosta no boneco e bate, mas nao e o alvo
    bento.player.x = alvo.x + 50;
    bento.player.y = alvo.y;

    const hpAna = ana.player.hp;
    const hpBento = bento.player.hp;

    bater(engine, ana);
    bater(engine, bento);

    rodar(engine, 15);

    expect(ana.player.hp).toBeLessThan(hpAna);
    expect(bento.player.hp).toBe(hpBento);

    engine.destroy();
  });

  it("nao cria projétil: o golpe e de perto", () => {
    const engine = criar();
    const { ana } = comDois(engine);

    bater(engine, ana);
    rodar(engine, 10);

    expect(engine.world.projectiles.length).toBe(0);

    engine.destroy();
  });

  it("nao volta para casa nem vagueia durante o duelo", () => {
    const engine = criar();
    const { ana } = comDois(engine);

    const alvo = boneco(engine);

    // a Ana bem longe: um mob normal voltaria para casa ao esticar
    // a `leash`, e o boneco tem `leash: Infinity`
    ana.player.x = alvo.spawnX + 1500;
    ana.player.y = alvo.spawnY;

    bater(engine, ana);
    rodar(engine, 8);

    // esta indo na direcao da Ana, nao de volta para o lugar
    expect(alvo.x).toBeGreaterThan(alvo.spawnX);
    expect(alvo.aiState).toBe("chase");

    engine.destroy();
  });
});

describe("boneco de duelo: a regra do alvo", () => {
  it("nao troca de alvo enquanto o alvo estiver de pe", () => {
    const engine = criar();
    const { ana, bento } = comDois(engine);

    const alvo = boneco(engine);

    // o Bento e o mais proximo e fica batendo o tempo todo
    bento.player.x = alvo.x + 40;
    bento.player.y = alvo.y;

    bater(engine, ana);

    for (let i = 0; i < 10; i += 1) {
      bater(engine, bento);
      rodar(engine, 0.5);
    }

    // dez segundos de Bento batendo por perto, e o boneco continua
    // na Ana. E a diferenca entre este boneco e todo mob do jogo
    expect(alvo.targetId).toBe(ana.player.id);

    engine.destroy();
  });

  it("passa o agro para quem esta batendo quando o alvo morre", () => {
    const engine = criar();
    const { ana, bento } = comDois(engine);

    const alvo = boneco(engine);

    bento.player.x = alvo.x + 40;
    bento.player.y = alvo.y;

    bater(engine, ana);
    expect(alvo.targetId).toBe(ana.player.id);

    // a Ana cai. A entidade do jogador nao tem `alive`: a morte e
    // `hp <= 0`
    ana.player.hp = 0;

    // o Bento passa a bater: e ele quem o boneco tem de mirar agora
    bater(engine, bento);

    // a troca acontece no TICK seguinte, nao no golpe: e a
    // `updateDuel` que resolve o alvo
    rodar(engine, 0.2);

    expect(alvo.targetId).toBe(bento.player.id);

    engine.destroy();
  });

  it("destrava e volta a ficar parado quando ninguem mais bate", () => {
    const engine = criar();
    const { ana, bento } = comDois(engine);

    const alvo = boneco(engine);

    bater(engine, ana);

    ana.player.hp = 0;
    bento.player.hp = 0;

    // ninguem batendo: o boneco nao tem para onde ir
    rodar(engine, 0.5);

    expect(alvo.targetId).toBeNull();
    expect(alvo.aiState).toBe("idle");
    expect(
      Math.hypot(alvo.x - alvo.spawnX, alvo.y - alvo.spawnY),
    ).toBe(0);

    engine.destroy();
  });

  it("volta a travar no primeiro golpe depois de destravar", () => {
    const engine = criar();
    const { ana, bento } = comDois(engine);

    const alvo = boneco(engine);

    // primeiro duelo, morre o alvo
    bater(engine, ana);
    ana.player.hp = 0;
    rodar(engine, 0.3);
    expect(alvo.targetId).toBeNull();

    // a Ana volta, e o Bento comeca a bater: agora o primeiro golpe
    // e do Bento, e o boneco trava nele
    ana.player.hp = 1400;

    bater(engine, bento);
    rodar(engine, 0.2);

    expect(alvo.targetId).toBe(bento.player.id);

    engine.destroy();
  });
});

describe("os outros bonecos nao entram no duelo", () => {
  it("continuam alvos fixos, sem duelo e sem alvo", () => {
    const engine = criar();

    const { ana } = comDois(engine);

    const outros = engine.world.enemies.filter(
      (enemy) => enemy.isDummy && enemy.id !== TIPO,
    );

    expect(outros.length).toBeGreaterThan(0);

    for (const outro of outros) {
      expect(outro.duelo, outro.id).toBeNull();

      bater(engine, ana, outro);
    }

    rodar(engine, 5);

    for (const outro of outros) {
      expect(outro.targetId, outro.id).toBeNull();
      expect(
        Math.hypot(outro.x - outro.spawnX, outro.y - outro.spawnY),
        outro.id,
      ).toBe(0);
    }

    engine.destroy();
  });
});
