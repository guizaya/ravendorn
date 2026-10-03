import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";

installDomStubs();

function createEngine() {
  const canvas = createTestCanvas();

  const engine = new GameEngine(
    canvas.element,
    CHARACTER_CLASSES[0],
    () => {},
  );

  engine.setMap(MAP_1);

  return engine;
}

describe("performance", () => {
  it("measures the worst case frame cost", () => {
    const engine = createEngine();
    const player = engine.world.player;
    const creatures = engine.world.enemies.filter(
      (enemy) => enemy.isCreature,
    );

    console.log(
      `inimigos: ${engine.world.enemies.length} (${creatures.length} criaturas)`,
    );

    creatures.forEach((enemy, index) => {
      enemy.x =
        player.x + (index % 7) * 30 - 90;
      enemy.y =
        player.y + Math.floor(index / 7) * 30 - 90;
    });

    engine.setAutoPlay(true);

    for (const skill of engine.classDefinition.skills) {
      engine.setSkillAuto(skill.id, true);
    }

    for (let i = 0; i < 300; i += 1) {
      engine.update(1 / 60);
    }

    const start = performance.now();

    for (let i = 0; i < 2000; i += 1) {
      engine.update(1 / 60);
    }

    const perFrame =
      (performance.now() - start) / 2000;

    console.log(
      `pior caso: ${perFrame.toFixed(3)} ms/frame`,
    );
    console.log(
      `uso do orcamento 60fps: ${(
        (perFrame / 16.67) *
        100
      ).toFixed(1)}%`,
    );

    expect(perFrame).toBeLessThan(16.67);

    engine.destroy();
  });
});
