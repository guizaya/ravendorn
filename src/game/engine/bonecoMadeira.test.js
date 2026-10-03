import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { getEnemySprite } from "../../data/sprites/enemyLayout.js";
import {
  resolveCreatureAnimation,
  resolveFrameRect,
  resolveWalkOffset,
} from "../sprites/animation.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

/**
 * O boneco de madeira.
 *
 * E o terceiro direcional e o primeiro que NAO tem golpe. A arte
 * veio so com as oito direcoes de caminhada: sem idle, sem pasta de
 * golpe. Um boneco de treino nao ataca, e o sprite nao inventa uma
 * animacao que ninguem desenhou.
 *
 * Ha aqui um furo antigo que este trabalho fechou: os bonecos sao
 * `isCreature: false`, e o motor so registrava sprite de criatura.
 * Os sete bonecos viviam no corpo vetorial, sem arte nenhuma.
 */
const TIPO = "dummy_warrior";
const CELULA = 68;

installDomStubs();

const criar = () => {
  const engine = new GameEngine(
    createTestCanvas().element,
    CHARACTER_CLASSES[0],
    () => {},
  );

  engine.setMap(MAP_1);

  return engine;
};

const LADO = {
  sul: { x: 0, y: 1 },
  norte: { x: 0, y: -1 },
  leste: { x: 1, y: 0 },
  oeste: { x: -1, y: 0 },
};

describe("boneco de madeira: a arte", () => {
  it("esta registrado pelo id do boneco", () => {
    const sprite = getEnemySprite(TIPO);

    expect(sprite).toBeTruthy();
    expect(sprite.id).toBe(TIPO);
    expect(sprite.format).toBe("directional");
    expect(sprite.frameWidth).toBe(CELULA);
  });

  it("NAO declara animacao de golpe, porque o boneco nao ataca", () => {
    const { animations } = getEnemySprite(TIPO);

    // A diferenca entre "sem golpe" e "golpe de 0 frames": o primeiro
    // cai no reserva, o segundo desenharia nada
    expect(animations.attack).toBeUndefined();

    // e o boneco fica no pose de direcao quando o jogo pede golpe
    const boneco = { facing: LADO.sul, attackAnimation: 0.2 };

    expect(resolveCreatureAnimation(boneco)).toBe("attack");

    const comGolpe = resolveFrameRect(
      getEnemySprite(TIPO),
      "attack",
      0.1,
      LADO.sul,
    );

    // O reserva e o `idle`, e nao o `walk`. O pedido so acontece se
    // o `attackAnimation` subisse, e o boneco nunca ataca: o que
    // importa aqui e que o pedido nao caia numa animacao que ele nao
    // tem. Com o `walk` no lugar, um boneco de treino parado
    // entraria andando quando alguem pedisse golpe
    const parado = resolveFrameRect(
      getEnemySprite(TIPO),
      "idle",
      0.1,
      LADO.sul,
    );

    expect(comGolpe).toEqual(parado);

    // e o `idle` do boneco tambem e por direcao, entao a pose
    // continua virada para onde ele olha
    const paraOeste = resolveFrameRect(
      getEnemySprite(TIPO),
      "attack",
      0.1,
      LADO.oeste,
    );

    expect(paraOeste.y).not.toBe(comGolpe.y);
  });

  it("tem as oito direcoes, e so as oito", () => {
    const sprite = getEnemySprite(TIPO);

    const linhas = [
      LADO.leste,
      { x: 1, y: 1 },
      LADO.sul,
      { x: -1, y: 1 },
      LADO.oeste,
      { x: -1, y: -1 },
      LADO.norte,
      { x: 1, y: -1 },
    ].map(
      (lado) =>
        resolveFrameRect(sprite, "walk", 0.1, lado).y / CELULA,
    );

    // A folha tem 8 linhas, uma por direcao. Diferente do ogre, que
    // tem 16: aqui nao existe bloco de golpe
    expect(linhas).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    // nenhuma linha pode cair fora da folha de 8
    for (const linha of linhas) {
      expect(linha).toBeLessThan(8);
    }
  });

  it("congela o idle na direcao atual, em vez de virar para o sul", () => {
    const sprite = getEnemySprite(TIPO);

    const norte = resolveFrameRect(sprite, "idle", 0.4, LADO.norte);
    const sul = resolveFrameRect(sprite, "idle", 0.4, LADO.sul);

    // direcoes diferentes: sem isto o boneco viraria a cabeca para a
    // frente enquanto virado para o norte
    expect(norte.y).not.toBe(sul.y);

    // e o tempo parado nao anda: um idle que corre viraria marcha
    const depois = resolveFrameRect(sprite, "idle", 3.1, LADO.norte);

    expect(depois.x).toBe(norte.x);
    expect(depois.y).toBe(norte.y);
  });

  it("nao balanca parado, ao contrario do ogre e do zumbi", () => {
    // `walkBob` desloca o desenho no eixo Y conforme o tempo. Num
    // boneco de treino, que nao anda, isso e um boneco oscilando no
    // ar sem motivo
    const sprite = getEnemySprite(TIPO);

    expect(sprite.walkBob).toBeNull();

    const boneco = { x: 0, y: 0, facing: LADO.sul, isMoving: false };

    expect(resolveWalkOffset(sprite, boneco).y).toBe(0);
  });
});

describe("boneco de madeira: no motor", () => {
  it("o boneco de madeira tem sprite, os outros seis nao", () => {
    const engine = criar();

    const bonecos = [...engine.world.enemies].filter(
      (enemy) => enemy.isDummy,
    );

    // sete bonecos de treino no campo de provas
    expect(bonecos).toHaveLength(7);

    const comFolha = bonecos.filter((boneco) =>
      engine.enemySprites.has(boneco.id),
    );

    // so o de madeira. Os outros seis NAO tem arte e continuam no
    // corpo vetorial, que e o que o registro decide quando nao
    // conhece o tipo
    expect(comFolha.map((b) => b.id)).toEqual([TIPO]);

    const definicao = engine.enemySprites.get(TIPO).definition;

    expect(definicao.format).toBe("directional");
    expect(definicao.frameWidth).toBe(CELULA);

    engine.destroy();
  });

  it("o boneco tem typeId, que e o que o registro usa", () => {
    const engine = criar();

    const boneco = [...engine.world.enemies].find(
      (enemy) => enemy.id === TIPO,
    );

    // Sem `typeId`, o motor procuraria `undefined` no registro e o
    // boneco cairia no vetor. Foi exatamente o que acontecia: os
    // bonecos eram `isCreature: false` e o motor so registrava
    // criatura
    expect(boneco.typeId).toBe(TIPO);
    expect(boneco.isCreature).toBe(false);
    expect(boneco.isDummy).toBe(true);

    engine.destroy();
  });

  it("e melee: recebe o golpe de perto e nao atira", () => {
    const engine = criar();

    const boneco = [...engine.world.enemies].find(
      (enemy) => enemy.id === TIPO,
    );

    const hpAntes = boneco.hp;

    engine.withPlayer(
      [...engine.world.players.keys()][0],
      () => {
        engine.damage.applyDamage(
          engine.world.player,
          boneco,
          { damage: 40, damageType: "physical" },
        );
      },
    );

    expect(boneco.hp).toBeLessThan(hpAntes);

    // sem projétil: o golpe e de perto, direto no hp
    expect(engine.world.projectiles.length).toBe(0);

    engine.destroy();
  });

  it("tem spriteOffset, sem o qual ele DESAPARECE", () => {
    const engine = criar();

    const boneco = [...engine.world.enemies].find(
      (enemy) => enemy.id === TIPO,
    );

    // Este e o teste que pegou o boneco invisivel. O desenho soma
    // `spriteTime + spriteOffset`; sem o campo, o tempo vira `NaN`,
    // o retangulo de origem sai com `x: NaN`, e o navegador nao
    // desenha nada. Nao ha erro, nao ha aviso, e o resto do jogo
    // continua normal: o boneco simplesmente nao existe na tela
    expect(boneco.spriteOffset).toBe(0);

    engine.destroy();
  });

  it("TODO inimigo com sprite produz um retangulo FINITO", () => {
    // A rede de seguranca: nenhum inimigo do mapa pode virar um
    // retangulo com coordenada `NaN`. Um `NaN` aqui e invisibilidade
    // silenciosa, que e a falha mais dificil de achar deste projeto
    const engine = criar();

    const quebrados = [];

    for (const enemy of engine.world.enemies) {
      const sheet = engine.enemySprites.get(enemy.id);

      if (!sheet) continue;

      // o mesmo tempo que o motor usa no desenho
      const elapsed = engine.spriteTime + enemy.spriteOffset;

      const rect = resolveFrameRect(
        sheet.definition,
        resolveCreatureAnimation(enemy),
        elapsed,
        enemy.facing,
      );

      for (const [campo, valor] of Object.entries(rect)) {
        if (typeof valor === "number" && !Number.isFinite(valor)) {
          quebrados.push(`${enemy.id}.${campo} = ${valor}`);
        }
      }
    }

    expect(quebrados, quebrados.slice(0, 5).join(", ")).toEqual([]);

    engine.destroy();
  });

  it("um spriteOffset ausente nao apaga o desenho, e so zera o tempo", () => {
    // A segunda camada: mesmo que um inimigo chegue sem
    // `spriteOffset`, ele tem que aparecer parado no primeiro frame
    // em vez de sumir
    const sprite = getEnemySprite(TIPO);

    const semOffset = resolveFrameRect(
      sprite,
      "idle",
      1.75 + undefined,
      LADO.sul,
    );

    expect(Number.isFinite(semOffset.x)).toBe(true);
    expect(Number.isFinite(semOffset.y)).toBe(true);
    expect(semOffset.x).toBe(0);
  });
});
