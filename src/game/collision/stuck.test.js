import { describe, expect, it } from "vitest";
import { CollisionSystem } from "./CollisionSystem.js";
import {
  circleIntersectsRect,
  circleRectPenetration,
} from "../math.js";

const BOUNDS = {
  x: 0,
  y: 0,
  width: 1000,
  height: 1000,
};

const WALL = { x: 400, y: 0, width: 100, height: 1000 };

function makeSystem(extra = []) {
  return new CollisionSystem({
    bounds: BOUNDS,
    width: BOUNDS.width,
    height: BOUNDS.height,
    walls: [WALL],
    obstacles: extra,
  });
}

function body(id, x, y, radius = 20) {
  return { id, x, y, radius, alive: true };
}

describe("circleRectPenetration", () => {
  const rect = { x: 100, y: 100, width: 100, height: 100 };

  it("devolve null quando nao ha sobreposicao", () => {
    expect(
      circleRectPenetration(
        { x: 0, y: 0, radius: 10 },
        rect,
      ),
    ).toBe(null);

    expect(
      circleRectPenetration(
        { x: 300, y: 300, radius: 10 },
        rect,
      ),
    ).toBe(null);
  });

  it("empurra para fora pela borda mais proxima", () => {
    const circle = { x: 85, y: 150, radius: 20 };

    const push = circleRectPenetration(circle, rect);

    expect(push).not.toBe(null);
    expect(push.x).toBeLessThan(0);
    expect(push.y).toBe(0);

    // deve sair do outro lado da borda, com folga
    expect(circle.x + push.x).toBeLessThanOrEqual(80);
    expect(circleIntersectsRect(
      { x: circle.x + push.x, y: circle.y, radius: 20 },
      rect,
    )).toBe(false);
  });

  it("sai pelo eixo de menor penetracao quando o centro esta dentro", () => {
    const up = circleRectPenetration(
      { x: 150, y: 105, radius: 20 },
      rect,
    );

    expect(up.y).toBeLessThan(0);
    expect(up.x).toBe(0);

    const right = circleRectPenetration(
      { x: 195, y: 150, radius: 20 },
      rect,
    );

    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBe(0);
  });

  it("a sobreposicao some depois do empurrao", () => {
    const circle = { x: 85, y: 150, radius: 20 };
    const push = circleRectPenetration(circle, rect);

    circle.x += push.x;
    circle.y += push.y;

    expect(
      circleRectPenetration(circle, rect),
    ).toBe(null);
  });
});

describe("despenetracao de solidos", () => {
  it("tira a entidade de dentro do obstaculo", () => {
    const system = makeSystem();
    const entity = body("player", 430, 500, 20);

    expect(system.resolveOverlap(entity, 20)).toBe(true);

    expect(entity.x).toBeLessThan(430);
    expect(system.circleHitsSolid(entity, 20)).toBe(false);
  });

  it("nao mexe em quem ja esta livre", () => {
    const system = makeSystem();
    const entity = body("player", 200, 500, 20);

    expect(system.resolveOverlap(entity, 20)).toBe(false);
    expect(entity.x).toBe(200);
    expect(entity.y).toBe(500);
  });

  it("resolve em varios obstaculos sobrepostos", () => {
    const system = makeSystem([
      { x: 200, y: 400, width: 200, height: 200 },
    ]);

    const entity = body("player", 250, 450, 20);

    system.resolveOverlap(entity, 20);

    expect(
      system.circleHitsSolid(entity, 20),
    ).toBe(false);
  });

  it("devolve para dentro dos limites do mapa", () => {
    const system = makeSystem();
    const entity = body("player", -80, -80, 20);

    system.resolveOverlap(entity, 20);

    expect(entity.x).toBeGreaterThanOrEqual(BOUNDS.x + 20);
    expect(entity.y).toBeGreaterThanOrEqual(BOUNDS.y + 20);
  });

  it("nao trava mesmo com o empurrao ja aplicado", () => {
    const system = makeSystem();
    const entity = body("player", 445, 500, 20);

    system.resolveOverlap(entity, 20);

    // antes do fix, nenhuma direcao seria valida e o personagem
    // ficaria parado para sempre
    let moved = 0;

    for (let step = 0; step < 60; step += 1) {
      moved += system.moveEntity(entity, -4, 0);
    }

    expect(moved).toBeGreaterThan(100);
  });
});

describe("escape de canto", () => {
  it("sai pela diagonal quando os dois eixos estao bloqueados", () => {
    const system = makeSystem([
      { x: 300, y: 100, width: 100, height: 200 },
      { x: 200, y: 200, width: 200, height: 100 },
    ]);

    // cantinho onde os dois obstaculos se tocam
    const entity = body("player", 300, 200, 20);

    system.resolveOverlap(entity, 20);

    const moved = system.moveEntity(
      entity,
      -5,
      -5,
    );

    expect(
      moved,
      "precisa escorregar em diagonal",
    ).toBeGreaterThan(0);
  });

  it("nao teleporta quando o passo reto ja funciona", () => {
    const system = makeSystem();
    const entity = body("player", 300, 500, 20);

    const moved = system.moveEntity(entity, 6, 0);

    expect(moved).toBeCloseTo(6, 5);
    expect(entity.y).toBe(500);
  });
});

describe("corpos nao viram parede", () => {
  it("o jogador so e barrado por solidos", () => {
    const system = makeSystem();

    const player = body("player", 150, 500, 22);

    const crowd = [];

    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;

      crowd.push(
        body(
          `slime_${index}`,
          player.x + Math.cos(angle) * 40,
          player.y + Math.sin(angle) * 40,
          21,
        ),
      );
    }

    // e assim que o engine move o jogador: lista de corpos vazia.
    // a parede em x=400 continua barrando, so os corpos nao.
    const startX = player.x;

    for (let step = 0; step < 40; step += 1) {
      system.moveEntity(player, 5, 0, []);
    }

    const travelled = player.x - startX;

    expect(travelled).toBeGreaterThan(100);

    // e para na parede, nao antes
    expect(player.x).toBeLessThanOrEqual(378);
  });

  it("a lista de corpos ainda barraria o jogador, e por isso nao e usada", () => {
    const system = makeSystem();

    const player = body("player", 300, 500, 22);

    const crowd = [
      body("slime_0", 340, 500, 21),
      body("slime_1", 300, 460, 21),
    ];

    // colisao dura contra corpos: 22+21 = 43px
    system.moveEntity(player, 5, 0, crowd);

    expect(player.x).toBe(300);
  });

  it("a colisao dura ainda vale entre inimigos", () => {
    const system = makeSystem();

    const a = body("slime_0", 300, 500, 21);
    const b = body("slime_1", 350, 500, 21);

    // comeca valido: 50 > 21+21 = 42
    system.moveEntity(a, 5, 0, [b]);

    expect(b.x - a.x).toBeGreaterThanOrEqual(42);
  });
});
