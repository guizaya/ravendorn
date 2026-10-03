import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { NetworkWorld } from "../net/NetworkWorld.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { getClassSprite } from "../../data/sprites/index.js";
import { getEnemySprite } from "../../data/sprites/enemies.js";

/**
 * O outro jogador tem que sair com a FIGURA DELE.
 *
 * O sintoma era: entrar com dois Arbalist e ver o segundo
 * usando a mesma imagem de um slime. A causa foi eu ter colocado
 * o jogador distante na lista de inimigos, que e onde o motor
 * guarda a folha de sprite de MOB por id.
 */
const criar = (classId = "arbalist") => {
  const engine = new GameEngine(
    null,
    CHARACTER_CLASSES.find((c) => c.id === classId),
    null,
    { playerId: "p_ana", characterName: "Ana" },
  );

  engine.setMap(MAP_1);
  engine.setNetworked(true);

  return { engine, mundo: new NetworkWorld(engine) };
};

/** O estado que o servidor manda para um jogador. */
const estado = (classId = "arbalist", extra = {}) => ({
  eu: {
    id: "p_ana",
    name: "Ana",
    x: 3000,
    y: 2100,
    hp: 100,
    maxHp: 100,
    facing: { x: 1, y: 0 },
    isMoving: false,
  },
  outros: [
    {
      id: "p_bento",
      name: "Bento",
      classId,
      x: 3100,
      y: 2100,
      hp: 100,
      maxHp: 100,
      facing: { x: -1, y: 0 },
      isMoving: false,
      ...extra,
    },
  ],
  inimigos: [],
  drops: [],
});

describe("o outro jogador usa o sprite da CLASSE dele", () => {
  it("um Arbalist remoto nao usa a imagem de um mob", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(estado("arbalist"));

    const remoto = mundo.porId.get("p_bento");
    const folhaDoArbalist = getClassSprite("arbalist");
    const folhaDoSlime = getEnemySprite("slime");

    // e o que estava quebrado: as duas imagens sao diferentes
    expect(folhaDoArbalist.src).not.toBe(folhaDoSlime.src);

    // o remoto NAO pode herdar a identidade de um mob
    expect(remoto.isRemote).toBe(true);
    expect(remoto.isPlayer).toBe(true);

    // nem ficar registrado na tabela de sprites de mob
    expect(engine.enemySprites.has(remoto.id)).toBe(false);

    // e a folha que o motor vai usar e a da classe
    const folha = engine.spriteDeClasse(remoto.classId);

    expect(folha).toBeTruthy();
    expect(folha.definition.id).toBe("arbalist");

    engine.destroy();
  });

  it("cada classe tem a sua propria imagem", () => {
    const { engine, mundo } = criar();

    // uma linha por classe REAL. A lista vem de
    // `CHARACTER_CLASSES`, entao uma classe que sai do jogo nao
    // deixa um id morto aqui: o teste acompanha a lista
    const outros = CHARACTER_CLASSES.map((classe, indice) => ({
      id: `p_${indice}`,
      name: classe.name,
      classId: classe.id,
      x: indice + 1,
      y: indice + 1,
      hp: 100,
      maxHp: 100,
    }));

    mundo.aplicar({ ...estado("arbalist"), outros });

    for (const outro of outros) {
      const jogador = mundo.porId.get(outro.id);

      expect(jogador.classId, outro.id).toBe(outro.classId);

      // e o sprite dele existe de verdade: um `classId` que chegou
      // pela rede sem sprite local cai no corpo vetorial, e o
      // jogador veria os outros como bonecos de treino
      expect(
        engine.spriteDeClasse(outro.classId).definition.id,
        outro.classId,
      ).toBe(outro.classId);
    }

    engine.destroy();
  });

  it("dez Arbalist na tela BAIXAM uma imagem so", () => {
    const { engine, mundo } = criar();

    const outros = [];

    for (let i = 0; i < 10; i += 1) {
      outros.push({
        id: `p_${i}`,
        name: `P${i}`,
        classId: "arbalist",
        x: 3000 + i,
        y: 2100,
        hp: 100,
        maxHp: 100,
      });
    }

    mundo.aplicar({ ...estado("arbalist"), outros });

    // o cache e por classe. por jogador, dez pessoas na tela
    // baixariam dez copias da mesma imagem
    expect(engine.playerSprites.size).toBe(1);

    engine.destroy();
  });

  it("o topo da cabeca usa a ancora da CLASSE", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(estado("arbalist"));

    const remoto = mundo.porId.get("p_bento");
    const comClasse = engine.enemyHeadTop(remoto);
    const definicao = getClassSprite("arbalist");

    // a barra de vida e o nome se apoiam aqui. com a ancora do
    // mob, o rotulo do Arbalist flutuaria acima da cabeca
    const esperado =
      remoto.y +
      definicao.footOffset -
      definicao.anchorY * definicao.scale;

    expect(comClasse).toBe(esperado);

    engine.destroy();
  });
});

describe("a animacao do remoto", () => {
  it("a direcao vem do servidor", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(estado("arbalist"));

    const remoto = mundo.porId.get("p_bento");

    // sem a direcao, a classe direcional andaria sempre olhando
    // para baixo, independente de para onde o personagem anda
    expect(remoto.facing).toEqual({ x: -1, y: 0 });
    expect(remoto.moveDirection).toEqual({ x: -1, y: 0 });

    engine.destroy();
  });

  it("andando, o balanco cresce; parado, ele volta a zero", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(
      estado("arbalist", { isMoving: true }),
    );

    const remoto = mundo.porId.get("p_bento");

    for (let i = 0; i < 30; i += 1) engine.update(1 / 60);

    const andando = remoto.walkBlend;
    const fase = remoto.walkPhase;

    // sem isto, o Arbalist remoto desliza sem o balanco que o
    // jogador local tem
    expect(andando).toBeGreaterThan(0.5);
    expect(fase).toBeGreaterThan(0);

    mundo.aplicar(estado("arbalist", { isMoving: false }));

    for (let i = 0; i < 60; i += 1) engine.update(1 / 60);

    expect(remoto.walkBlend).toBeLessThan(andando);

    engine.destroy();
  });

  it("o relogio de animacao nao e compartilhado entre os dois", () => {
    const { engine, mundo } = criar();

    mundo.aplicar({
      ...estado("arbalist"),
      outros: [
        { id: "p_b", name: "B", classId: "arbalist", x: 1, y: 1, hp: 100, maxHp: 100, isMoving: true },
        { id: "p_c", name: "C", classId: "arbalist", x: 2, y: 2, hp: 100, maxHp: 100, isMoving: false },
      ],
    });

    engine.update(1 / 60);

    // o `structuredClone` antigo nao existia, mas o `spriteTime`
    // e global. se os dois usassem o mesmo objeto, um andando
    // arrastaria o outro junto
    expect(mundo.porId.get("p_b").isMoving).toBe(true);
    expect(mundo.porId.get("p_c").isMoving).toBe(false);
    expect(mundo.porId.get("p_b")).not.toBe(
      mundo.porId.get("p_c"),
    );

    engine.destroy();
  });

  it("a arte de tiro entra e sai sozinha", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(
      estado("arbalist", { acting: true, hasTarget: true }),
    );

    const remoto = mundo.porId.get("p_bento");

    // o Arbalist so entra na arte de tiro HAVENDO alvo: por isso
    // o `firingTargetId`
    expect(remoto.attackAnimation).toBeGreaterThan(0);
    expect(remoto.firingTargetId).toBe("alvo");

    for (let i = 0; i < 40; i += 1) engine.update(1 / 60);

    // e volta ao idle sozinho, sem o servidor precisar avisar que
    // parou
    expect(remoto.attackAnimation).toBe(0);
    expect(remoto.firingTargetId).toBe(null);

    engine.destroy();
  });

  it("sem alvo, a arte de tiro do Arbalist nao entra", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(
      estado("arbalist", { acting: true, hasTarget: false }),
    );

    // o motor local tem a mesma regra: um buff proprio nao usa a
    // arte de tiro. os dois precisam concordar
    expect(
      mundo.porId.get("p_bento").firingTargetId,
    ).toBe(null);

    engine.destroy();
  });
});

describe("o desenho usa o caminho de jogador", () => {
  it("drawEnemy desvia o remoto para o desenho de jogador", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(estado("arbalist"));

    const remoto = mundo.porId.get("p_bento");

    let chamouRemoto = false;
    let chamouMob = false;

    engine.drawJogadorRemoto = () => {
      chamouRemoto = true;
    };
    engine.drawEnemyBody = () => {
      chamouMob = true;
    };

    engine.drawEnemy(null, remoto);

    expect(chamouRemoto).toBe(true);
    expect(chamouMob).toBe(false);

    engine.destroy();
  });

  it("o nome do remoto e desenhado", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(estado("arbalist"));

    const remoto = mundo.porId.get("p_bento");

    // sem o nome, a figura la no meio da briga e anonima
    expect(remoto.name).toBe("Bento");

    engine.destroy();
  });

  it("destruir o motor libera as imagens de classe", () => {
    const { engine, mundo } = criar();

    mundo.aplicar(estado("arbalist"));
    engine.spriteDeClasse("arbalist");

    expect(engine.playerSprites.size).toBe(1);

    engine.destroy();

    // sem liberar, toda saida de tela vazava uma imagem por
    // classe, e a memoria cresceria a cada partida
    expect(engine.playerSprites.size).toBe(0);
  });
});
