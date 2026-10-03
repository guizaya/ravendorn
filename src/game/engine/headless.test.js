import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";

const classe = CHARACTER_CLASSES.find(
  (c) => c.id === "arbalist",
);

const criar = (options = {}) => {
  const engine = new GameEngine(
    null,
    classe,
    null,
    { playerId: "p1", characterName: "Ana", ...options },
  );

  engine.setMap(MAP_1);
  return engine;
};

describe("GameEngine headless", () => {
  it("constroi sem canvas e sem window", () => {
    // o servidor nao tem DOM nenhum. se o construtor tocar em
    // `canvas.getContext` ou em `window.addEventListener`, o
    // processo do servidor estoura aqui
    const engine = criar();

    expect(engine.headless).toBe(true);
    expect(engine.canvas).toBe(null);
    expect(engine.context).toBe(null);
  });

  it("nao pede frame de animacao", () => {
    // no servidor o laco de tempo e do servidor. se o engine
    // chamasse requestAnimationFrame, o Node nem tem a funcao
    const engine = criar();

    expect(engine.animationFrame).toBeUndefined();

    engine.destroy();
  });

  it("avanca o mundo com update", () => {
    const engine = criar();

    const antes = engine.world.time;

    for (let i = 0; i < 30; i++) {
      engine.update(1 / 60);
    }

    expect(engine.world.time).toBeGreaterThan(antes);
    expect(engine.world.enemies.length).toBeGreaterThan(0);

    engine.destroy();
  });

  it("render e um no-op sem canvas", () => {
    const engine = criar();

    // tick junta update+render. no servidor so o update e usado,
    // mas tick nao pode explodir se alguém chamar
    expect(() => engine.tick(1 / 60)).not.toThrow();

    engine.destroy();
  });

  it("usa o nome e o id passados nas opcoes", () => {
    const engine = criar();

    expect(engine.world.player.name).toBe("Ana");
    expect(engine.world.player.id).toBe("p1");

    engine.destroy();
  });

  it("mobs andam sozinhos sem ninguem por perto", () => {
    // a prova de que a simulacao de verdade roda: sem jogador
    // perto, os mobs ficam parados, entao o teste compara o
    // movimento de um mob que alcancado a posicao do jogador
    const engine = criar();

    const mob = engine.world.enemies.find(
      (enemy) => enemy.isCreature,
    );

    const x0 = mob.x;
    const y0 = mob.y;

    // coloca o jogador em cima do mob para a IA reagir
    engine.world.player.x = mob.x;
    engine.world.player.y = mob.y;

    for (let i = 0; i < 60; i++) {
      engine.update(1 / 60);
    }

    const andou =
      Math.abs(mob.x - x0) + Math.abs(mob.y - y0) > 0.5;

    expect(andou, "o mob nao se moveu").toBe(true);

    engine.destroy();
  });

  it("o mesmo seed gera os mesmos mobs do cliente", () => {
    // se o servidor e o cliente gerassem os mobs em ordem
    // diferente, o id "slime_0" apontaria para bichos diferentes
    // nos dois lados e o dano iria para o lugar errado
    const a = criar();
    const b = criar();

    const idsA = a.world.enemies.map((e) => e.id);
    const idsB = b.world.enemies.map((e) => e.id);

    expect(idsA).toEqual(idsB);
    expect(idsA.length).toBeGreaterThan(0);

    const posA = a.world.enemies.map((e) => `${e.x},${e.y}`);
    const posB = b.world.enemies.map((e) => `${e.x},${e.y}`);

    expect(posA).toEqual(posB);

    a.destroy();
    b.destroy();
  });

  it("destroy nao estoura sem DOM", () => {
    const engine = criar();

    expect(() => engine.destroy()).not.toThrow();
    expect(engine.destroyed).toBe(true);
  });

  it("update para depois de destroy", () => {
    const engine = criar();

    engine.destroy();
    const t0 = engine.world.time;

    // o servidor pode ter um tick na fila quando o jogador sai
    engine.update(1 / 60);

    expect(engine.world.time).toBe(t0);
  });
});
