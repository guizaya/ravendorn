import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, act } from "@testing-library/react";
import GameCanvas from "./GameCanvas.jsx";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";

/**
 * O clique DE VERDADE, no canvas de verdade.
 *
 * O teste de rede do servidor chamava `cliente.atacarAlvo()`
 * direto e passava. O defeito estava um passo antes: o clique do
 * MOUSE nunca chegava na camada de rede. O motor recebia o
 * clique, rodava o golpe localmente, a animacao tocava, e nada
 * acontecia no mundo.
 *
 * Aqui o clique sai de um evento de verdade, num canvas de
 * verdade, com o estado do servidor chegando pelo mesmo caminho
 * que a tela usa.
 */

const classe = CHARACTER_CLASSES.find((c) => c.id === "warrior");

const CAIXA = { left: 0, top: 0, width: 1280, height: 720 };

/**
 * jsdom nao desenha. O motor so precisa que o contexto aceite
 * atribuicoes, e o `Proxy` em vez de objeto deixa qualquer metodo
 * de desenho virar no-op em vez de estourar.
 */
function instalarCanvasFalso() {
  const contexto = new Proxy(
    { createPattern: () => ({ pattern: true }) },
    {
      get(alvo, chave) {
        if (chave in alvo) return alvo[chave];
        return () => {};
      },
      set(alvo, chave, valor) {
        alvo[chave] = valor;
        return true;
      },
    },
  );

  HTMLCanvasElement.prototype.getContext = () => contexto;
  HTMLCanvasElement.prototype.getBoundingClientRect = () => CAIXA;
}

/** Snapshot minimo: liga o modo rede, sem mob nenhum. */
const VAZIO = {
  eu: { id: "p_ana", x: 1000, y: 1000, hp: 100, facing: { x: 0, y: 1 } },
  outros: [],
  inimigos: [],
  drops: [],
};

/**
 * Monta o canvas e devolve o motor, que fica num ref comum: e
 * assim que a tela de verdade alcanca o motor.
 */
function montar({ online = true, semIntencao = false } = {}) {
  const atacou = [];
  const ponteiros = [];

  const intencao = {
    tecla: vi.fn(),
    ponteiro: vi.fn((x, y) => ponteiros.push({ x, y })),
    sincronizar: vi.fn(),
    atacar: vi.fn((alvo) => atacou.push(alvo)),
    soltar: vi.fn(),
  };

  // um ref estavel, exatamente o que `useRef` devolve. o GameCanvas
  // escreve o motor aqui dentro, e o teste le no mesmo lugar
  const ref = { current: null };
  const guarda = { ref, estado: VAZIO, intencao: null };

  if (!semIntencao) guarda.intencao = intencao;

  function Tela() {
    return (
      <GameCanvas
        classDefinition={classe}
        characterName="Ana"
        engineRef={ref}
        estado={online ? guarda.estado : null}
        onIntent={online ? guarda.intencao : null}
      />
    );
  }

  const utils = render(<Tela />);

  /**
   * Este arquivo e de CLIQUE EM MOB, entao precisa de um mob no mundo.
   *
   * A tela abre no hub, que nao tem zona de mob nenhuma — e nao e
   * defeito, e o que um hub e. O motor e trocado para o vale aqui, pelo
   * mesmo caminho que o jogo usa quando o portal trocar o mapa
   */
  act(() => {
    ref.current?.setMap(MAP_1);
  });

  return {
    ...utils,

    get motor() {
      return guarda.ref.current;
    },

    intencao,
    atacou,
    ponteiros,

    /** O socket respondeu e a intencao passou a existir. */
    ligarIntencao() {
      guarda.intencao = intencao;
      act(() => {
        utils.rerender(<Tela />);
      });
    },

    /** O proximo pacote do servidor. */
    proximo(estado) {
      guarda.estado = estado;
      act(() => {
        utils.rerender(<Tela />);
      });
    },

    /** Um clique de verdade, com coordenadas de tela. */
    clicar(clientX, clientY) {
      const canvas = utils.container.querySelector("canvas");

      act(() => {
        canvas.dispatchEvent(
          new MouseEvent("pointerdown", {
            bubbles: true,
            button: 0,
            clientX,
            clientY,
          }),
        );
      });
    },

    /** Move o ponteiro, como o mouse de verdade. */
    mover(clientX, clientY) {
      const canvas = utils.container.querySelector("canvas");

      act(() => {
        canvas.dispatchEvent(
          new MouseEvent("pointermove", {
            bubbles: true,
            clientX,
            clientY,
          }),
        );
      });
    },
  };
}

/** Coord de tela que cai em cima de um ponto do mundo. */
function telaDoAlvo(motor, alvo) {
  return {
    x: CAIXA.left + CAIXA.width / 2 + (alvo.x - motor.world.player.x),
    y: CAIXA.top + CAIXA.height / 2 + (alvo.y - motor.world.player.y),
  };
}

/** Um slime que o servidor mandou, em posicao conhecida. */
function snapshotComMob(id, x, y) {
  return {
    ...VAZIO,
    inimigos: [{ id, x, y, hp: 30, maxHp: 30, state: "idle" }],
  };
}

/**
 * O primeiro mob que o cliente realmente conhece.
 *
 * O id vem do mundo, nao de um palpite: `NetworkWorld` so atualiza
 * inimigo que ja existe na lista local. Testar com um id inventado
 * passaria a fabricate.
 *
 * E a lista depende do mapa: o `montar` troca o motor para o vale logo
 * depois de subir a tela. A tela abre no hub — que e o certo — e o hub
 * nao tem zona de mob, entao este teste, que e de combate, pede o vale
 */
function primeiroMob(jogo) {
  const mob = jogo.motor.world.enemies.find(
    (e) => e.alive && e.kind !== "training",
  );

  if (!mob) throw new Error("o mapa de teste nao tem mob comum");

  return mob;
}

describe("o clique do mouse vira um pedido ao servidor", () => {
  it("clicar num inimigo pede o ataque com o id dele", () => {
    instalarCanvasFalso();

    const jogo = montar();

    // o jogador fica em (1000, 1000) por causa do snapshot; o mob
    // e posto logo a direita, como o servidor faria
    const alvo = primeiroMob(jogo);

    // o servidor posiciona o mob a direita do jogador
    jogo.proximo(snapshotComMob(alvo.id, 1060, 1000));

    expect(alvo.alive).toBe(true);

    const tela = telaDoAlvo(jogo.motor, alvo);

    jogo.clicar(tela.x, tela.y);

    // o efeito do GameCanvas tem que ter plugged o motor na rede
    expect(typeof jogo.motor.onTargetClick).toBe("function");

    // e o pedido tem que trazer o id do mob
    expect(jogo.intencao.atacar).toHaveBeenCalled();
    expect(jogo.atacou.at(-1)).toBe(alvo.id);
  });

  it("clicar em vazio avisa que nao ha alvo", () => {
    instalarCanvasFalso();

    const jogo = montar();
    const alvo = primeiroMob(jogo);

    jogo.proximo(snapshotComMob(alvo.id, 1060, 1000));

    // longe de qualquer mob
    jogo.clicar(CAIXA.width / 2, CAIXA.height / 2 - 300);

    // o servidor precisa saber que o alvo sumiu, senao o
    // personagem fica andando para o nada
    expect(jogo.atacou.at(-1)).toBeNull();
  });

  it("em modo rede o motor NAO executa o golpe localmente", () => {
    instalarCanvasFalso();

    const jogo = montar();
    const alvo = primeiroMob(jogo);

    jogo.proximo(snapshotComMob(alvo.id, 1060, 1000));

    const motor = jogo.motor;

    let executouLocal = false;

    motor.useBasicAttack = () => {
      executouLocal = true;
      return true;
    };

    const antes = motor.engagedTargetId;
    const tela = telaDoAlvo(motor, alvo);

    jogo.clicar(tela.x, tela.y);

    // e o defeito reportado: a animacao tocava aqui e o mundo
    // nao mexia. o golpe e do servidor
    expect(executouLocal).toBe(false);
    expect(motor.engagedTargetId).toBe(antes);
  });

  it("offline, o clique continua sendo do motor", () => {
    instalarCanvasFalso();

    const jogo = montar({ online: false });
    const motor = jogo.motor;

    let executouLocal = false;

    motor.useBasicAttack = () => {
      executouLocal = true;
      return true;
    };

    const mob = motor.world.enemies.find((e) => e.alive);
    const tela = telaDoAlvo(motor, mob);

    jogo.clicar(tela.x, tela.y);

    // o single player nao pode perder o clique: e o caminho que
    // sempre funcionou
    expect(executouLocal).toBe(true);
    expect(motor.engagedTargetId).toBe(mob.id);
  });
});

describe("a mira do mouse vira direcao", () => {
  it("mover o ponteiro manda a mira, medida do centro", () => {
    instalarCanvasFalso();

    const jogo = montar();
    const alvo = primeiroMob(jogo);

    jogo.proximo(snapshotComMob(alvo.id, 1060, 1000));

    jogo.mover(CAIXA.width / 2 + 120, CAIXA.height / 2 - 60);

    expect(jogo.intencao.ponteiro).toHaveBeenCalled();

    // o jogador e desenhado no centro, entao e de la que a
    // direcao da mira e medida
    expect(jogo.ponteiros.at(-1)).toEqual({ x: 120, y: -60 });
  });

  it("o motor ainda rastreia o ponteiro para o hover do HUD", () => {
    instalarCanvasFalso();

    const jogo = montar();
    const alvo = primeiroMob(jogo);

    jogo.proximo(snapshotComMob(alvo.id, 1060, 1000));

    jogo.mover(700, 300);

    // a barra de vida e o nome do alvo dependem disto: sem o
    // rastreio no cliente, o HUD nunca mostraria o que esta sob
    // o cursor
    expect(jogo.motor.input.pointer.inside).toBe(true);
  });

  it("a mira funciona mesmo se o onIntent chegar depois da montagem", () => {
    instalarCanvasFalso();

    // a ordem da tela real: o canvas monta primeiro, e o
    // `onIntent` so existe depois que o socket responde. um
    // efeito que capture a funcao no mount perde a mira para
    // sempre, e o sintoma e "o tiro vai para onde eu cliquei
    // pela ultima vez"
    const jogo = montar({ semIntencao: true });
    const alvo = primeiroMob(jogo);

    jogo.proximo(snapshotComMob(alvo.id, 1060, 1000));
    jogo.ligarIntencao();

    jogo.mover(CAIXA.width / 2 + 90, CAIXA.height / 2);

    expect(jogo.ponteiros.at(-1)).toEqual({ x: 90, y: 0 });
  });
});

afterEach(() => {
  cleanup();
});
