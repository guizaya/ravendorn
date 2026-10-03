import { describe, expect, it, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { useRef, useState } from "react";
import GameCanvas from "./GameCanvas.jsx";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";

/**
 * As teclas de COMANDO precisam virar pedido, como o clique.
 *
 * O movimento (WASD) ja ia para o servidor pelo caminho certo. As
 * teclas que sao ORDENS nao: `Space`, `1` a `8`, `R`, `Backspace` e
 * `T` eram tratados pelo motor da TELA, que em modo rede nao tem
 * sessao e nao simula. O pedido morria ali.
 *
 * A `T` e a mais visivel: apertar T nao ligava o auto de cacar
 * perto, e o auto da missao, que ja estava ligado, continuava
 * puxando o personagem. Parecia que o botao tinha virado o auto da
 * missao.
 */
const classe = CHARACTER_CLASSES.find((c) => c.id === "arbalist");

const VAZIO = {
  eu: {
    id: "p_ana",
    name: "Ana",
    x: 1000,
    y: 1000,
    hp: 100,
    maxHp: 100,
    facing: { x: 0, y: 1 },
  },
  outros: [],
  inimigos: [],
  drops: [],
};

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
  HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 1280,
    height: 720,
  });
}

function montar({ online = true } = {}) {
  const teclas = [];
  const intencao = {
    tecla: vi.fn((code, pressionada) =>
      teclas.push({ code, pressionada }),
    ),
    ponteiro: vi.fn(),
    sincronizar: vi.fn(),
    atacar: vi.fn(),
    habilidade: vi.fn(),
    ultimate: vi.fn(),
    alternarAutoPlay: vi.fn(),
    alternarAutoMissao: vi.fn(),
    focarMissao: vi.fn(),
    limparAlvos: vi.fn(),
    soltar: vi.fn(),
  };

  const ref = { current: null };

  function Tela() {
    const [estado] = useState(VAZIO);

    return (
      <GameCanvas
        classDefinition={classe}
        characterName="Ana"
        engineRef={ref}
        estado={online ? estado : null}
        onIntent={online ? intencao : null}
      />
    );
  }

  const utils = render(<Tela />);

  const apertar = (code, { repeat = false } = {}) => {
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          code,
          repeat,
          bubbles: true,
        }),
      );
    });
  };

  return {
    ...utils,
    get motor() {
      return ref.current;
    },
    intencao,
    teclas,
    apertar,
  };
}

afterEach(cleanup);

describe("a tecla T vira um pedido para o servidor", () => {
  it("apertar T pede o auto de cacar perto", () => {
    instalarCanvasFalso();

    const jogo = montar();

    jogo.apertar("KeyT");

    expect(jogo.intencao.alternarAutoPlay).toHaveBeenCalled();

    // e o motor da tela nao mexe no auto local: quem decide e o
    // servidor, e o auto local nao tem sessao
    expect(jogo.motor.autoPlay).toBe(false);

    jogo.motor.destroy();
  });

  it("segurar T nao fica alternando o auto", () => {
    instalarCanvasFalso();

    const jogo = montar();

    jogo.apertar("KeyT", { repeat: true });
    jogo.apertar("KeyT", { repeat: true });
    jogo.apertar("KeyT", { repeat: true });

    // o SOUNDO chega a repetir o keydown. sem o guarda, o auto
    // piscava a cada 30ms enquanto a tecla estivesse apertada
    expect(jogo.intencao.alternarAutoPlay).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });

  it("T nao entra como tecla de movimento", () => {
    instalarCanvasFalso();

    const jogo = montar();

    jogo.apertar("KeyT");

    // se T fosse forwarded como tecla, o servidor receberia um
    // INPUT sem direcao nenhuma a cada aperto
    expect(jogo.intencao.tecla).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });
});

describe("as outras teclas de comando tambem", () => {
  it("Espaco ataca", () => {
    instalarCanvasFalso();

    const jogo = montar();

    jogo.apertar("Space");

    expect(jogo.intencao.atacar).toHaveBeenCalled();

    jogo.motor.destroy();
  });

  it("os numeros usam a habilidade da pagina atual", () => {
    instalarCanvasFalso();

    const jogo = montar();

    // a pagina 0 e a padrão, entao o 3 e o slot 3
    jogo.motor.setSkillPage(0);
    jogo.apertar("Digit3");

    // o alvo escolhido viaja junto: sem ele a habilidade de alvo
    // sairia na direcao da mira, e nao no mob
    expect(jogo.intencao.habilidade.mock.calls[0][0]).toBe(3);

    // na pagina 1, o mesmo 3 e o slot 11. o numero do dedo e o
    // mesmo e o que muda e a pagina, que o HUD troca no botao
    jogo.intencao.habilidade.mockClear();
    jogo.motor.setSkillPage(1);
    jogo.apertar("Digit3");

    expect(jogo.intencao.habilidade.mock.calls[0][0]).toBe(11);

    jogo.motor.destroy();
  });

  it("R usa a ultimate", () => {
    instalarCanvasFalso();

    const jogo = montar();

    jogo.apertar("KeyR");

    expect(jogo.intencao.ultimate).toHaveBeenCalled();

jogo.motor.destroy();
  });
});

/**
 * O `Backspace` NAO e mais atalho.
 *
 * Ele ressuscitava os bonecos de treinamento, e e a tecla que o jogador
 * precisa para apagar um caractere do campo onde esta digitando. Um
 * atalho em cima do `Backspace` e um atalho em cima de qualquer tecla
 * de texto
 *
 * O teste trava a ausencia: sem ele, voltar o atalho seria uma troca
 * de uma linha que nenhum teste notaria — foi assim que o atalho
 * sobreviveu a varias revisions
 */
describe("o Backspace pertence ao campo de texto", () => {
  it("nao ressuscita boneco nenhum", () => {
    instalarCanvasFalso();

    const jogo = montar();

    jogo.apertar("Backspace");

    // o pedido de restaurar os alvos foi embora do cliente
    expect(jogo.intencao.limparAlvos).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });

  it("nao vira tecla de movimento", () => {
    instalarCanvasFalso();

    const jogo = montar();

    jogo.apertar("Backspace");

    /**
     * O `Backspace` e controlado sem ser ordem.
     *
     * Ele e engolido de proposito: o motor cancela o evento para o
     * navegador nao tratar como "voltar", e nenhuma ordem sai daqui.
     * Sem este `expect`, tirar o `Backspace` do `CODES_DE_ORDEM`
     * transformaria o apagador de caractere em tecla de andar
     */
    expect(jogo.intencao.tecla).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });

/**
 * E dentro do campo que ele precisa funcionar.
 *
 * O cancelamento do motor so vale FORA do campo: com o foco no input o
 * `digitandoEm` devolve a mao o evento, e o navegador apaga o
 * caractere. O contraste e a prova — o mesmo `Backspace` cancelado
 * fora, liberado dentro
 */
it("fora do campo e cancelado, dentro do campo passa", () => {
    instalarCanvasFalso();

    const jogo = montar();

    const fora = window.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "Backspace",
        bubbles: true,
        cancelable: true,
      }),
    );

    const campo = document.createElement("input");

    document.body.appendChild(campo);
    campo.focus();

    const dentro = campo.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "Backspace",
        bubbles: true,
        cancelable: true,
      }),
    );

    // `dispatchEvent` devolve `false` quando alguem chamou
    // `preventDefault`. Fora do campo e cancelado para o navegador nao
    // "voltar"; dentro do campo o evento passa inteiro
    expect(
      fora,
      "o Backspace deixou de ser cancelado fora do campo",
    ).toBe(false);

    expect(
      dentro,
      "o Backspace foi cancelado dentro do campo e nao apaga nada",
    ).toBe(true);

    document.body.removeChild(campo);

    jogo.motor.destroy();
  });
});



describe("o movimento continua no caminho antigo", () => {
  it("WASD vai pelo caminho da tecla, como sempre", () => {
    instalarCanvasFalso();

    const jogo = montar();

    jogo.apertar("KeyD");

    expect(jogo.intencao.tecla).toHaveBeenCalledWith("KeyD", true);
    expect(jogo.intencao.alternarAutoPlay).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });

  it("offline, a T continua sendo do motor da tela", () => {
    instalarCanvasFalso();

    const jogo = montar({ online: false });

    jogo.apertar("KeyT");

    // no single player nao ha servidor: o motor e quem decide, e
    // ele tem sessao
    expect(jogo.motor.autoPlay).toBe(true);
    expect(jogo.intencao.alternarAutoPlay).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });
});

/**
 * COM O FOCO NUM CAMPO, A TECLA E DO CAMPO.
 *
 * O `keydown` do canvas esta no `window` e nao.preventDefault, entao
 * antes desta guarda escrever o nome da guilda andava o personagem: o
 * `w` e o `s` de "Lobos" iam para o servidor como ordem de movimento, e
 * o `3` disparava a terceira skill da pagina
 */
describe("com o foco num campo de texto", () => {
  /** um campo de verdade no DOM, com o foco nele */
  function campoNoFoco(tipo = "text") {
    const campo = document.createElement("input");

    campo.type = tipo;

    document.body.appendChild(campo);
    campo.focus();

    return campo;
  }

  /** a tecla nasce no campo, como o navegador faz */
  const apertarNoCampo = (campo, code) => {
    act(() => {
      campo.dispatchEvent(
        new KeyboardEvent("keydown", {
          code,
          bubbles: true,
        }),
      );
    });
  };

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("W nao vira movimento", () => {
    instalarCanvasFalso();

    const jogo = montar();

    const campo = campoNoFoco();

    apertarNoCampo(campo, "KeyW");

    expect(jogo.intencao.tecla).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });

  it("o nome inteiro da guilda nao anda o personagem", () => {
    instalarCanvasFalso();

    const jogo = montar();

    const campo = campoNoFoco();

    // as letras de "Lobos" viram `code` de tecla assim no navegador:
    // maiuscula e `KeyX`, minuscula e `KeyX` tambem, com o shift no
    // `key`. O que interessa e que nenhuma virou ordem
    for (const code of ["KeyL", "KeyO", "KeyB", "KeyS"]) {
      apertarNoCampo(campo, code);
    }

    expect(jogo.intencao.tecla).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });

  it("o numero da skill nao dispara habilidade", () => {
    instalarCanvasFalso();

    const jogo = montar();

    const campo = campoNoFoco();

    apertarNoCampo(campo, "Digit3");

    expect(jogo.intencao.habilidade).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });

  it("o espaco nao ataca", () => {
    instalarCanvasFalso();

    const jogo = montar();

    const campo = campoNoFoco();

    apertarNoCampo(campo, "Space");

    expect(jogo.intencao.atacar).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });

  it("a T nao liga o auto", () => {
    instalarCanvasFalso();

    const jogo = montar();

    const campo = campoNoFoco();

    apertarNoCampo(campo, "KeyT");

    expect(jogo.intencao.alternarAutoPlay).not.toHaveBeenCalled();

    jogo.motor.destroy();
  });

  /**
   * O `keyup` passa MESMO com o foco no campo.
   *
   * Sem isto, o jogador andava com `w`, clicava no campo para escrever
   * e soltava o `w` com o foco la: o servidor nunca receberia o
   * "soltou", e o personagem andaria sozinho ate a proxima tecla — que
   * nao viria, porque ele estava digitando
   */
  it("soltar a tecla chega ao servidor mesmo digitando", () => {
    instalarCanvasFalso();

    const jogo = montar();

    const campo = campoNoFoco();

    act(() => {
      campo.dispatchEvent(
        new KeyboardEvent("keyup", {
          code: "KeyW",
          bubbles: true,
        }),
      );
    });

    expect(jogo.intencao.tecla).toHaveBeenCalledWith("KeyW", false);

    jogo.motor.destroy();
  });

  it("um checkbox nao conta como digitacao", () => {
    instalarCanvasFalso();

    const jogo = montar();

    /**
     * Marcar o "ataque automatico" nao pode matar o auto.
     *
     * Se checkbox contasse como digitacao, o auto e as skills
     * morreriam ate o jogador clicar fora, sem nada na tela que
     * explicasse. Um checkbox nao recebe texto
     */
    const caixa = campoNoFoco("checkbox");

    apertarNoCampo(caixa, "KeyD");

    expect(jogo.intencao.tecla).toHaveBeenCalledWith("KeyD", true);

    jogo.motor.destroy();
  });
});
