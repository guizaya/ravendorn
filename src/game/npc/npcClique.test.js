import { describe, expect, it } from "vitest";
import { GameEngine } from "../engine/GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1, MAP_1_META } from "../../data/maps/index.js";
import { BASE_MAP } from "../../data/maps/base.js";
import { NPC_ACAO, NPC_TYPES } from "../../data/npc/index.js";

/**
 * O CLIQUE no NPC, no motor.
 *
 * O painel de guilda nasceu de um `?.` que engolia um handler nao
 * ligado, e o numero de dano nasceu de um `onDano` que o construtor
 * nunca guardava: os dois sumiram sem erro nenhum. O clique no NPC e
 * o mesmo caminho — um hook que o motor chama e ninguem escuta — e e
 * por isso que este arquivo testa o hook, e nao so o desenho
 */

/**
 * O DOM que o motor pede no construtor.
 *
 * O `GameEngine` registra `keydown` e `keyup` no `window` e enfileira o
 * primeiro quadro. Em node nenhum dos dois existe, e o motor estouraria
 * em `bindDomEvents` antes de o teste chegar ao NPC. O stub e o mesmo
 * do `GameEngine.test.js`
 */
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
};

globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

function createEngine() {
  const context = {
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

  engine.setMap(MAP_1);
  engine.world.collision.map = MAP_1;

  return engine;
}

/** o motor do hub, que e onde o mercador esta */
function createHub() {
  const engine = createEngine();

  engine.setMap(BASE_MAP);
  engine.world.collision.map = BASE_MAP;

  return engine;
}

/**
 * Uma posicao de MUNDO virada em posicao de TELA.
 *
 * O `handlePointerDown` recebe `clientX`/`clientY` e passa por
 * `screenToWorld`. Passar coordenada de mundo como se fosse de tela
 * faria o clique cair num ponto qualquer do mapa — e o teste falharia
 * sem que o motor estivesse errado
 *
 * E o inverso EXATO do `screenToWorld`, com o `cameraZoom` incluido:
 * o hub tem zoom de 1.4286, e uma conta sem ele erraria por 43% da
 * distancia. Foi o que aconteceu na primeira versao deste arquivo
 */
function screenTo(engine, worldX, worldY) {
  const rect = engine.canvasRect;
  const z = engine.cameraZoom;

  return {
    x: rect.left + (worldX - engine.world.player.x) * z +
      engine.viewport.width / 2,
    y: rect.top + (worldY - engine.world.player.y) * z +
      engine.viewport.height / 2,
  };
}

/** o mercador do hub, ja montado pelo `setMap` */
const mercadorDoHub = (engine) =>
  engine.world.npcs.find((npc) => npc.typeId === "mercador");

describe("o mercador esta no hub", () => {
  it("o setMap monta o NPC a partir do catalogo", () => {
    const engine = createHub();

    expect(engine.world.npcs).toHaveLength(1);

    const mercador = mercadorDoHub(engine);

    expect(mercador).toBeTruthy();
    expect(mercador.x).toBe(710);
    expect(mercador.y).toBe(377);

    // o catalogo foi espalhado na entidade. A acao e a da LOJA de
    // pocoes, e nao a do mercado entre jogadores
    expect(mercador.acao).toBe(NPC_ACAO.POCOES);
    expect(mercador.sheet).toBe(NPC_TYPES.mercador.sheet);

    engine.destroy();
  });

  it("um mapa sem NPC nao quebra", () => {
    const engine = createEngine();

    // o vale nao declara nenhum
    expect(engine.world.npcs).toEqual([]);

    engine.destroy();
  });

  it("a pegada do NPC vira solido do colisor", () => {
    const engine = createHub();

    const mercador = mercadorDoHub(engine);

    const pegada = engine.npcs.blockBoxOf(mercador);

    /**
     * A barreira e a PEGADA, e nao a arte.
     *
     * E o que impede o boneco de parar dentro da barraca — e o que
     * impede tambem de bater numa parede invisivel 100px acima
     */
    expect(
      engine.world.collision.solids.some(
        (solido) =>
          solido.x === pegada.x &&
          solido.y === pegada.y &&
          solido.width === pegada.width &&
          solido.height === pegada.height,
      ),
      "a pegada do NPC nao entrou nos solidos",
    ).toBe(true);

    engine.destroy();
  });
});

describe("o clique no NPC", () => {
  it("chama o onNpcClick com o NPC", () => {
    const engine = createHub();

    const clicados = [];

    engine.onNpcClick = (npc) => clicados.push(npc);

    const mercador = mercadorDoHub(engine);

    const alvo = screenTo(engine, mercador.x, mercador.y - 20);

    engine.handlePointerDown({
      button: 0,
      clientX: alvo.x,
      clientY: alvo.y,
    });

    expect(clicados, "o clique no NPC nao chegou no hook").toHaveLength(1);
    expect(clicados[0]).toBe(mercador);

    engine.destroy();
  });

  it("o clique no NPC NAO vira alvo de combate", () => {
    const engine = createHub();

    let clicouNoAlvo = false;

    engine.onTargetClick = () => {
      clicouNoAlvo = true;
    };

    engine.onNpcClick = () => {};

    const mercador = mercadorDoHub(engine);

    const alvo = screenTo(engine, mercador.x, mercador.y - 20);

    engine.handlePointerDown({
      button: 0,
      clientX: alvo.x,
      clientY: alvo.y,
    });

    /**
     * O NPC tem a PRIMEIRA palavra.
     *
     * A barra tem 203px de altura e o raio do inimigo passaria por
     * dentro da perna do mercador. Sem o `return` depois do NPC, o
     * clique abriria o combate no chao em vez da loja
     */
    expect(clicouNoAlvo, "o clique no NPC virou ordem de combate").toBe(
      false,
    );

    engine.destroy();
  });

  it("o clique no chao ao lado nao pega o NPC nem vira combate", () => {
    const engine = createHub();

    const clicados = [];

    engine.onNpcClick = (npc) => clicados.push(npc);

    const mercador = mercadorDoHub(engine);

    const box = engine.npcs.boxOf(mercador);
    const fora = screenTo(engine, box.x - 40, mercador.y);

    engine.handlePointerDown({
      button: 0,
      clientX: fora.x,
      clientY: fora.y,
    });

    expect(clicados).toHaveLength(0);

    engine.destroy();
  });

  it("sem hook de NPC, o clique no chao nao estoura", () => {
    const engine = createHub();

    engine.onNpcClick = null;

    const mercador = mercadorDoHub(engine);
    const alvo = screenTo(engine, mercador.x, mercador.y - 20);

    expect(() =>
      engine.handlePointerDown({
        button: 0,
        clientX: alvo.x,
        clientY: alvo.y,
      }),
    ).not.toThrow();

    engine.destroy();
  });

  it("o botao do meio nao abre NPC", () => {
    const engine = createHub();

    const clicados = [];

    engine.onNpcClick = (npc) => clicados.push(npc);

    const mercador = mercadorDoHub(engine);
    const alvo = screenTo(engine, mercador.x, mercador.y - 20);

    engine.handlePointerDown({
      button: 2,
      clientX: alvo.x,
      clientY: alvo.y,
    });

    expect(clicados).toHaveLength(0);

    engine.destroy();
  });
});
