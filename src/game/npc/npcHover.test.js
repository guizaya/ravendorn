import { describe, expect, it } from "vitest";
import { GameEngine } from "../engine/GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { BASE_MAP } from "../../data/maps/base.js";

/**
 * O PONTEIRO SOBRE O NPC, e o CURSOR que ele decide.
 *
 * O clique no NPC ja funcionava, mas o ponteiro era sempre a mesma mira.
 * O jogador nao tinha como saber que aquele mercador era clicavel sem
 * clicar para descobrir — e na base, onde nao ha nada para bater, a mira
 * de combate ainda prometia um golpe que o mapa nao tem
 *
 * O que este arquivo trava:
 *
 * 1. o `npcHover` guarda ID e nao a ENTIDADE, porque a rede recria a
 *    lista de NPCs a cada snapshot;
 * 2. o NPC ganha do hub no cursor, e nao o contrario;
 * 3. o balanco some quando o ponteiro sai, e nao fica preso ligando.
 */
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
};

globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

function createContext() {
  return {
    setTransform() {},
    clearRect() {},
    fillRect() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    drawImage() {},
    fillText() {},
    strokeText() {},
    strokeRect() {},
    beginPath() {},
    arc() {},
    ellipse() {},
    fill() {},
    stroke() {},
    rect() {},
    roundRect() {},
    clip() {},
    moveTo() {},
    lineTo() {},
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    font: "10px sans-serif",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowColor: "transparent",
    shadowBlur: 0,
  };
}

function createEngine() {
  const context = createContext();

  const canvas = {
    getContext: () => context,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    }),
  };

  const engine = new GameEngine(
    canvas,
    CHARACTER_CLASSES[0],
    () => {},
  );

  return engine;
}

function createHub() {
  const engine = createEngine();

  engine.setMap(BASE_MAP);
  engine.world.collision.map = BASE_MAP;

  return engine;
}

/**
 * Coloca o ponteiro em cima de um ponto do MUNDO.
 *
 * O `input.pointer` e reescrito direto em vez de chamar
 * `handlePointerMove`: aquele le `clientX`/`clientY` e passa por
 * `screenToWorld`, que aqui dependeria do zoom da camera. O que o motor
 * consulta depois e `pointer.x`/`pointer.y` no mundo, que e exatamente o
 * que este teste precisa mover
 */
function apontarPara(engine, worldX, worldY) {
  engine.input.pointer = {
    x: worldX,
    y: worldY,
    inside: true,
  };
}

const mercadorDoHub = (engine) =>
  engine.world.npcs.find((npc) => npc.typeId === "mercador");

describe("o ponteiro sobre o NPC", () => {
  it("acende o hover quando entra na caixa do NPC", () => {
    const engine = createHub();
    const mercador = mercadorDoHub(engine);

    apontarPara(engine, mercador.x, mercador.y - 20);
    engine.atualizarHoverDeNpc();

    expect(engine.npcHover).toBe(mercador.id);
    expect(engine.cursorMode).toBe("npc");
  });

  it("guarda o ID, e nao a entidade do NPC", () => {
    const engine = createHub();
    const mercador = mercadorDoHub(engine);

    apontarPara(engine, mercador.x, mercador.y - 20);
    engine.atualizarHoverDeNpc();

    /**
     * A rede recria `world.npcs` a cada snapshot. Se o motor guardasse o
     * OBJETO, o `===` do desenho — que compara com o NPC da lista nova —
     * falharia no primeiro pacote recebido e o balanco pararia de piscar
     * para sempre, sem erro nenhum
     */
    expect(typeof engine.npcHover).toBe("string");
    expect(engine.npcHover).toBe(mercador.id);
  });

  it("apaga o hover quando o ponteiro sai do NPC", () => {
    const engine = createHub();
    const mercador = mercadorDoHub(engine);

    apontarPara(engine, mercador.x, mercador.y - 20);
    engine.atualizarHoverDeNpc();

    expect(engine.npcHover).not.toBeNull();

    // longe demais para a caixa do NPC
    apontarPara(engine, mercador.x + 900, mercador.y - 900);
    engine.atualizarHoverDeNpc();

    expect(engine.npcHover).toBeNull();
  });

  it("sai do mapa com o ponteiro e limpa o hover", () => {
    const engine = createHub();
    const mercador = mercadorDoHub(engine);

    apontarPara(engine, mercador.x, mercador.y - 20);
    engine.atualizarHoverDeNpc();

    expect(engine.npcHover).not.toBeNull();

    /**
     * O `pointerleave` e o unico caminho que limpa o hover com o ponteiro
     * fora da tela. Sem ele, o ultimo mercador ficaria balancando para
     * sempre depois que o mouse saisse da janela
     */
    engine.handlePointerLeave();

    expect(engine.npcHover).toBeNull();
  });
});

describe("o cursor segue o que ha embaixo dele", () => {
  it("a base usa a mao de armadura, e nao a mira", () => {
    const engine = createHub();

    apontarPara(engine, 10, 10);
    engine.atualizarHoverDeNpc();

    /**
     * A base nao tem inimigo. Uma mira ali seria uma promessa de golpe
     * que o mapa nao tem — e o jogador so descobriria isso tentando
     */
    expect(engine.cursorMode).toBe("hub");
  });

  it("o vale usa a mira de combate", () => {
    const engine = createEngine();

    engine.setMap(MAP_1);
    engine.world.collision.map = MAP_1;

    apontarPara(engine, 10, 10);
    engine.atualizarHoverDeNpc();

    expect(engine.cursorMode).toBe("combat");
  });

  it("o NPC ganha do hub: o clique funciona nos dois mapas", () => {
    const engine = createHub();
    const mercador = mercadorDoHub(engine);

    /**
     * O hub E onde mora o mercador. Se o modo `hub` ganhasse aqui, o
     * jogador veria a mao de armadura em cima do unico NPC clicavel do
     * jogo — o cursor estaria dizendo o oposto do que o clique faz
     */
    apontarPara(engine, mercador.x, mercador.y - 20);
    engine.atualizarHoverDeNpc();

    expect(engine.cursorMode).toBe("npc");
  });

  it("volta para o hub quando o ponteiro sai do NPC", () => {
    const engine = createHub();
    const mercador = mercadorDoHub(engine);

    apontarPara(engine, mercador.x, mercador.y - 20);
    engine.atualizarHoverDeNpc();

    apontarPara(engine, mercador.x + 900, mercador.y - 900);
    engine.atualizarHoverDeNpc();

    expect(engine.cursorMode).toBe("hub");
  });

  it("avisa a tela so quando o modo MUDA", () => {
    const engine = createHub();

    const vistos = [];

    engine.onCursorChange = (modo) => vistos.push(modo);

    // tres quadros no mesmo chao: um aviso so
    apontarPara(engine, 10, 10);
    engine.atualizarHoverDeNpc();
    engine.atualizarHoverDeNpc();
    engine.atualizarHoverDeNpc();

    // o cursor e lido 60 vezes por segundo; um aviso por quadro faria o
    // React reavaliar as classes do canvas sem parar, sem mudar nada
    expect(vistos).toEqual([]);

    apontarPara(engine, mercadorDoHub(engine).x, mercadorDoHub(engine).y - 20);
    engine.atualizarHoverDeNpc();

    expect(vistos).toEqual(["npc"]);

    apontarPara(engine, 10, 10);
    engine.atualizarHoverDeNpc();

    expect(vistos).toEqual(["npc", "hub"]);
  });
});

describe("o rebalco do NPC", () => {
  it("sobe quando o ponteiro esta em cima, e para quando sai", () => {
    const engine = createHub();
    const mercador = mercadorDoHub(engine);

    engine.drawClock = 0.4;

    const alto = engine.npcs.alturaDoHover(true, 0.4);
    const parado = engine.npcs.alturaDoHover(false, 0.4);

    /**
     * O vaivem e um `sin`, entao o balanco tem de voltar a zero pelo
     * caminho. Um balanco que so sobe deixaria o NPC boiando para sempre
     * depois que o mouse passasse por cima
     */
    expect(alto).toBeGreaterThan(0);
    expect(parado).toBe(0);
    expect(engine.npcs.alturaDoHover(true, 0)).toBeCloseTo(0, 5);
  });
});