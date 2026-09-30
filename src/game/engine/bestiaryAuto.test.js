import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { TEST_MAP } from "../../data/maps/index.js";
import { ZONES } from "../../data/maps/index.js";
import { BESTIARY } from "../../data/bestiary/index.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

installDomStubs();

const ARBALIST = CHARACTER_CLASSES.find(
  (definition) => definition.id === "arbalist",
);

function createEngine() {
  const canvas = createTestCanvas();

  const engine = new GameEngine(
    canvas.element,
    ARBALIST,
    () => {},
  );

  engine.setMap(TEST_MAP);

  return engine;
}

function zoneOf(id) {
  return ZONES.find((zone) => zone.id === id) ?? null;
}

function creatureTypeOf(enemy) {
  return enemy.id.replace(/_\d+$/, "");
}

function creatures(engine) {
  return engine.world.enemies.filter(
    (enemy) => enemy.isCreature,
  );
}

describe("bestiary auto", () => {
  it("turns the auto on for the chosen creature", () => {
    const engine = createEngine();

    expect(engine.setBestiaryAuto("slime")).toBe(true);
    expect(engine.bestiaryTargetType).toBe("slime");
    expect(engine.autoPlay).toBe(true);
    expect(engine.isBestiaryAutoOn).toBe(true);
    expect(engine.isAutoActive()).toBe(true);

    engine.destroy();
  });

  it("rejects a creature that is not in the bestiary", () => {
    const engine = createEngine();

    expect(engine.setBestiaryAuto("dragao")).toBe(false);
    expect(engine.bestiaryTargetType).toBe(null);
    expect(engine.autoPlay).toBe(false);

    engine.destroy();
  });

  it("publishes the hunt in the snapshot for the hud box", () => {
    const engine = createEngine();

    let published = null;

    engine.onSnapshot = (snapshot) => {
      published = snapshot;
    };

    engine.setBestiaryAuto("ogre");

    expect(published.bestiaryAuto).toEqual({
      creatureId: "ogre",
      name: expect.any(String),
      icon: expect.any(String),
      color: expect.any(String),
      zoneId: expect.any(String),
      zoneName: expect.any(String),
      kills: 0,
    });

    engine.destroy();
  });

  it("clears the box when the hunt stops", () => {
    const engine = createEngine();

    let published = null;

    engine.onSnapshot = (snapshot) => {
      published = snapshot;
    };

    engine.setBestiaryAuto("slime");

    expect(published.bestiaryAuto).not.toBe(null);

    expect(engine.clearBestiaryAuto()).toBe(true);

    expect(published.bestiaryAuto).toBe(null);
    expect(engine.bestiaryTargetType).toBe(null);
    expect(engine.isBestiaryAutoOn).toBe(false);

    engine.destroy();
  });

  it("does nothing when clearing an inactive hunt", () => {
    const engine = createEngine();

    expect(engine.clearBestiaryAuto()).toBe(false);

    engine.destroy();
  });

  it("toggles off when the same creature is clicked twice", () => {
    const engine = createEngine();

    expect(engine.toggleBestiaryAuto("rat")).toBe(true);
    expect(engine.bestiaryTargetType).toBe("rat");

    expect(engine.toggleBestiaryAuto("rat")).toBe(true);
    expect(engine.bestiaryTargetType).toBe(null);
    expect(engine.autoPlay).toBe(false);

    engine.destroy();
  });

  it("switches the hunt without leaving the auto on", () => {
    const engine = createEngine();

    engine.toggleBestiaryAuto("slime");

    expect(engine.toggleBestiaryAuto("ghoul")).toBe(true);
    expect(engine.bestiaryTargetType).toBe("ghoul");
    expect(engine.autoPlay).toBe(true);

    engine.destroy();
  });

  it("turns the general auto back off only if the hunt turned it on", () => {
    const engine = createEngine();

    engine.setAutoPlay(true);
    engine.setBestiaryAuto("slime");

    expect(engine.bestiaryOwnsAutoPlay).toBe(false);

    engine.clearBestiaryAuto();

    expect(engine.autoPlay).toBe(true);

    engine.destroy();
  });

  it("stops the hunt when the master auto button goes off", () => {
    const engine = createEngine();

    engine.setBestiaryAuto("slime");

    expect(engine.autoPlay).toBe(true);

    engine.setAutoPlay(false);

    expect(engine.bestiaryTargetType).toBe(null);
    expect(engine.isBestiaryAutoOn).toBe(false);
    expect(engine.isAutoActive()).toBe(false);

    engine.destroy();
  });

  it("only ever attacks the chosen creature", () => {
    const engine = createEngine();

    engine.setBestiaryAuto("slime");

    const player = engine.world.player;

    player.hp = player.maxHp;

    for (const enemy of creatures(engine)) {
      enemy.hp = enemy.maxHp;
    }

    const attacked = new Set();

    for (let frame = 0; frame < 900; frame += 1) {
      engine.world.player.hp = engine.world.player.maxHp;

      engine.update(1 / 60);

      const target = engine.getLiveTarget?.();

      if (target) {
        attacked.add(creatureTypeOf(target));
      }
    }

    for (const type of attacked) {
      expect(
        type === "slime" || !engine.world.enemies.some(
          (enemy) =>
            enemy.isCreature &&
            creatureTypeOf(enemy) === type &&
            enemy.alive,
        ),
        `atacou ${type}`,
      ).toBe(true);
    }

    engine.destroy();
  });

  it("walks to the creature zone when none is alive", () => {
    const engine = createEngine();

    const entry = BESTIARY.find(
      (candidate) => candidate.id === "ogre",
    );

    const zone = zoneOf(entry.zoneId);

    expect(zone).not.toBe(null);

    const player = engine.world.player;

    player.hp = player.maxHp;

    const zoneCenter = {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2,
    };

    const startDistance = Math.hypot(
      zoneCenter.x - player.x,
      zoneCenter.y - player.y,
    );

    expect(startDistance).toBeGreaterThan(800);

    engine.setBestiaryAuto("ogre");

    let usedWaypoint = false;

    for (let frame = 0; frame < 900; frame += 1) {
      player.hp = player.maxHp;

      for (const enemy of creatures(engine)) {
        enemy.alive = false;
        enemy.respawnTimer = 9999;
      }

      engine.update(1 / 60);

      if (engine.autoWaypoint) usedWaypoint = true;
    }

    const endDistance = Math.hypot(
      zoneCenter.x - player.x,
      zoneCenter.y - player.y,
    );

    expect(usedWaypoint, "deve usar waypoint").toBe(true);

    expect(
      endDistance,
      `distancia ${startDistance.toFixed(0)} -> ${endDistance.toFixed(0)}`,
    ).toBeLessThan(startDistance * 0.6);

    engine.destroy();
  });

  it("keeps walking between decisions, not one frame in fifteen", () => {
    const engine = createEngine();

    const player = engine.world.player;

    for (const enemy of creatures(engine)) {
      enemy.alive = false;
      enemy.respawnTimer = 9999;
    }

    engine.setBestiaryAuto("ogre");

    let movingFrames = 0;

    for (let frame = 0; frame < 60; frame += 1) {
      player.hp = player.maxHp;

      engine.update(1 / 60);

      if (player.isMoving) movingFrames += 1;
    }

    // o timer de decisao roda a cada 0.25s, mas o waypoint tem de
    // valer entre as decisoes senao o personagem anda 1 frame em 15
    expect(
      movingFrames,
      `andou em ${movingFrames} de 60 frames`,
    ).toBeGreaterThan(50);

    engine.destroy();
  });

  it("hunts a respawned creature and keeps hunting", () => {
    const engine = createEngine();

    engine.setBestiaryAuto("slime");

    const player = engine.world.player;

    for (let frame = 0; frame < 1800; frame += 1) {
      player.hp = player.maxHp;

      engine.update(1 / 60);
    }

    expect(
      engine.world.bestiary.kills.get("slime") ?? 0,
    ).toBeGreaterThan(0);

    expect(engine.bestiaryTargetType).toBe("slime");

    engine.destroy();
  });

  it("gives every bestiary creature a zone to travel to", () => {
    for (const entry of BESTIARY) {
      expect(entry.zoneId, entry.id).toBeTruthy();
      expect(zoneOf(entry.zoneId), entry.id).not.toBe(null);
    }
  });
});
