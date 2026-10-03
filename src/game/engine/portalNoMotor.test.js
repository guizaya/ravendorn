import { describe, expect, it } from "vitest";

import { GameEngine } from "./GameEngine.js";
import { PortalRenderer } from "../portais/PortalRenderer.js";
import { portalsOf } from "../../data/portais/index.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1_META, MAP_1 } from "../../data/maps/index.js";
import {
  createTestCanvas,
  installDomStubs,
} from "./testHarness.js";

installDomStubs();

const classe = CHARACTER_CLASSES.find(
  (c) => c.id === "warrior",
);

function criar() {
  const canvas = createTestCanvas();

  const engine = new GameEngine(canvas.element, classe, () => {});

  engine.setMap(MAP_1);

  return engine;
}

/**
 * O PORTAL NO MOTOR.
 *
 * O catalogo e o desenho tem teste proprio. Aqui o que importa e a
 * LIGACAO: o mapa entrega o portal, o motor guarda no mundo, e o portal
 * e desenhado no lugar certo da pilha
 *
 * A ordem do desenho e o detalhe que faz o portal parecer deitado no
 * chao, e ela nao esta no JSX nem no CSS: esta na sequencia de
 * chamadas dentro do `drawMap`. Se o portal fosse desenhado antes do
 * terreno, a grama cobriria ele; se fosse desenhado depois do
 * `drawWorldSorted`, os monstros da zona sumiriam debaixo do portal
 */
/**
 * Um contexto 2D de mentira, com TODOS os metodos que o `drawMap`
 * chama.
 *
 * A primeira versao daqui faltava `strokeRect`, que e a borda do mapa
 * desenhando. O `drawMap` lancou no meio do caminho e o erro derrubou
 * os testes seguintes tambem — e a falha seguinte era do teste, nao do
 * motor
 */
function contextoFalso() {
  const desenhados = [];

  return {
    desenhados,

    fillStyle: null,
    strokeStyle: null,
    font: "",
    textAlign: "",
    lineWidth: 1,
    imageSmoothingEnabled: true,

    drawImage: (...args) => {
      desenhados.push(args);
    },

    fillRect() {},
    strokeRect() {},
    fillText() {},
    strokeText() {},

    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    setLineDash() {},

    beginPath() {},
    closePath() {},
    arc() {},
    ellipse() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    rect() {},
    roundRect() {},
    fill() {},
    stroke() {},
    clip() {},

    measureText: () => ({ width: 10 }),
    createPattern: () => ({ padrao: true }),
    createLinearGradient: () => ({ addColorStop() {} }),
  };
}
describe("o portal no motor", () => {
  it("o motor tem um renderer de portal", () => {
    const engine = criar();

    expect(engine.portals).toBeInstanceOf(PortalRenderer);

    engine.destroy();
  });

  it("o mapa entrega os portais para o mundo", () => {
    const engine = criar();

    expect(engine.world.portals).toEqual(portalsOf(MAP_1));

    expect(engine.world.portals).toHaveLength(2);

    // e os dois tem id e lugar proprios
    expect(new Set(
      engine.world.portals.map((p) => p.id),
    ).size).toBe(2);

    engine.destroy();
  });

  it("um mapa sem portais deixa o mundo com lista vazia", () => {
    const engine = criar();

    engine.setMap({ ...MAP_1, portals: undefined });

    expect(engine.world.portals).toEqual([]);

    engine.destroy();
  });

  it("o portal nao entra na colisao", () => {
    const engine = criar();

    /**
     * Decorativo de verdade: o jogador atravessa o desenho
     */
    const portal = engine.world.portals[0];

    expect(
      engine.world.collision.isPositionFree(
        { x: portal.x, y: portal.y },
        22,
      ),
      "o portal esta barrando o jogador",
    ).toBe(true);

    engine.destroy();
  });

  it("o portal e desenhado sobre o terreno", () => {
    const engine = criar();

    const portal = engine.world.portals[0];

    /**
     * A janela precisa cobrir o portal. O jogador nasce longe, entao
     * e preciso levar o motor ate la
     */
    engine.world.player.x = portal.x;
    engine.world.player.y = portal.y;

    const contexto = contextoFalso();
    const desenhados = contexto.desenhados;


    engine.terrain.isReady = () => false;
    engine.portals.isReady = () => true;
    engine.portals.draw = (ctx, portais, view) => {
      for (const p of portais) {
        ctx.drawImage("FOLHA", p.x, p.y);
      }
    };

    engine.drawMap(contexto);

    // o portal entrou na lista desenhada
    expect(
      desenhados.some((args) => args[0] === "FOLHA"),
    ).toBe(true);

    engine.destroy();
  });

  it("o portal e desenhado ANTES dos monstros", () => {
    /**
     * A ordem que faz o monstro passar POR CIMA do portal.
     *
     * A ordem mora no `render`: `drawMap` — que desenha o portal — e so
     * depois `drawWorldSorted`, que desenha os bichos
     *
     * Este teste observa a ORDEM DAS CHAMADAS, e nao os pixels. A
     * primeira versao media `drawImage` e esperava o `drawWorldSorted`
     * deixar rastro — mas em Node as folhas de sprite nao carregam, e
     * nenhum monstro e desenhado. A ordem do pipeline e a promessa
     * real, e ela existe mesmo com a arte ausente
     */
    const engine = criar();

    const ordem = [];

    for (const nome of [
      "drawMap",
      "drawWorldSorted",
    ]) {
      const original = engine[nome].bind(engine);

      engine[nome] = (...args) => {
        ordem.push(nome);

        original(...args);
      };
    }

    engine.render();

    expect(ordem).toContain("drawMap");
    expect(ordem).toContain("drawWorldSorted");

    expect(
      ordem.indexOf("drawMap"),
      "o portal e desenhado DEPOIS dos monstros",
    ).toBeLessThan(ordem.indexOf("drawWorldSorted"));

    engine.destroy();
  });

  it("o portal e desenhado antes do rotulo da zona", () => {
    /**
     * A outra metade da ordem: dentro do `drawMap`, o portal vem logo
     * depois do terreno e ANTES do texto da zona
     *
     * O texto e informacao de interface, nao parte do chao. Se o portal
     * fosse desenhado depois, o nome da area sumiria em cima do
     * desenho — e o portal esta no Pantano Profundo, uma zona que o
     * jogador precisa conseguir identificar
     */
    const engine = criar();

    const eventos = [];

    engine.terrain.isReady = () => false;
    engine.portals.isReady = () => true;

    const contexto = contextoFalso();

    // o rotulo da zona e a unica coisa do `drawMap` que escreve texto
    contexto.fillText = () => {
      eventos.push("ROTULO");
    };

    const desenhoDoPortal =
      engine.portals.draw.bind(engine.portals);

    engine.portals.draw = (ctx, portais, view) => {
      eventos.push("PORTAL");

      desenhoDoPortal(ctx, portais, view);
    };

    engine.drawMap(contexto);

    expect(eventos).toContain("PORTAL");
    expect(eventos).toContain("ROTULO");

    expect(
      eventos.indexOf("PORTAL"),
      "o portal cobriu o rotulo da zona",
    ).toBeLessThan(eventos.indexOf("ROTULO"));

    engine.destroy();
  });

  it("a posicao pedida sobreviveu a troca de mapa", () => {
    const engine = criar();

    const antes = { ...engine.world.portals[0] };

    engine.setMap(MAP_1);

    expect(engine.world.portals[0]).toEqual(antes);

    // posicoes dos portais, editadas a mao
    expect(engine.world.portals[0].x).toBe(5799);
    expect(engine.world.portals[0].y).toBe(3981);

    engine.destroy();
  });

  it("o portal continua dentro dos limites depois de apply", () => {
    const engine = criar();

    const limites = MAP_1_META.bounds;
    const portal = engine.world.portals[0];

    expect(portal.x - portal.size / 2).toBeGreaterThanOrEqual(
      limites.x,
    );

    expect(
      portal.x + portal.size / 2,
    ).toBeLessThanOrEqual(limites.x + limites.width);

    engine.destroy();
  });
});