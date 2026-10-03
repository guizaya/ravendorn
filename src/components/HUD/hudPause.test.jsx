import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";

/**
 * O PAUSE da tecla ESC.
 *
 * Ate aqui o "voltar para as classes" morava num botao solto na barra
 * direita. Saiu de la por um motivo concreto: e uma acao que nao se
 * desfaz, e um botao na beirada da tela e um convite a clicar sem
 * querer. Agora ela vive no pause, que e onde o jogador a procura
 * quando realmente quer parar
 *
 * Estes testes montam a HUD de verdade e disparam a tecla de verdade: o
 * atalho esta ligado num `useEffect` de `window`, e um teste que so
 * chamasse o handler nao cobriria o caminho que o jogador usa
 */
afterEach(cleanup);

const classe = getCharacterDefinition("arbalist");

const ANA = {
  id: "p_ana",
  name: "Ana",
  className: "Arbalist",
  level: 9,
  hp: 1400,
  maxHp: 1400,
  resource: 100,
  maxResource: 100,
  resourceName: "Chi",
  shield: 0,
  skills: [],
  statusEffects: [],
};

function snapshot() {
  return {
    time: 0,
    autoPlay: false,
    engaged: false,
    player: ANA,
    cooldowns: {},
    selectedTarget: null,
    message: null,
  };
}

function montar(props = {}) {
  /**
 * `null` e uma escolha legitima — o botao de sair nao tem para onde
 * voltar. O `??` trataria esse `null` como "nao passou nada" e o teste
 * receberia um spy novo, que e exatamente o contrario do que ele quer
 * conferir
 */
const onBack = "onBack" in props ? props.onBack : vi.fn();

  const utils = render(
    <HUD
      classDefinition={classe}
      characterName="Ana"
      snapshot={snapshot()}
      engineRef={{ current: null }}
      intencao={null}
      onBack={onBack}
    />,
  );

  return { ...utils, onBack };
}

const esc = () =>
  fireEvent.keyDown(window, { code: "Escape" });

describe("o pause (ESC)", () => {
  it("comeca fechado: nada na tela", () => {
    const { container } = montar();

    expect(container.querySelector(".pause")).toBe(null);
  });

  it("a ESC abre a cortina sobre o jogo", () => {
    const { container } = montar();

    esc();

    const pause = container.querySelector(".pause");

    expect(pause, "o pause nao abriu").toBeTruthy();

    // a cortina e o que separa o pause de um painel comum: sem ela o
    // jogo continua com aparencia de estar em jogo
    expect(
      pause.querySelector(".pause__veil"),
      "a cortina do fundo sumiu",
    ).toBeTruthy();

    expect(pause.textContent).toContain("Pausado");
  });

  it("a ESC de novo fecha", () => {
    const { container } = montar();

    esc();

    expect(container.querySelector(".pause")).toBeTruthy();

    esc();

    expect(
      container.querySelector(".pause"),
      "o pause nao fechou com a segunda ESC",
    ).toBe(null);
  });

  it("o botao de sair volta para as classes", () => {
    const { container, onBack } = montar();

    esc();

    fireEvent.click(
      [...container.querySelectorAll(".pause__btn")].find((botao) =>
        botao.textContent.includes("Voltar para as classes"),
      ),
    );

    expect(onBack).toHaveBeenCalledTimes(1);

    // e o pause fecha junto: voltar para a selecao de classe desmonta
    // a tela, e um pause aberto sobre ela seria lixo visual
    expect(container.querySelector(".pause")).toBe(null);
  });

  it("continuar fecha sem sair do personagem", () => {
    const { container, onBack } = montar();

    esc();

    fireEvent.click(
      [...container.querySelectorAll(".pause__btn")].find(
        (botao) => botao.textContent.includes("Continuar"),
      ),
    );

    expect(onBack, "continuar saiu do personagem").not.toHaveBeenCalled();

    expect(container.querySelector(".pause")).toBe(null);
  });

  it("o botao de sair some quando nao ha para onde voltar", () => {
    const { container } = montar({ onBack: null });

    esc();

    const botoes = [...container.querySelectorAll(".pause__btn")];

    expect(botoes.length).toBe(1);
    expect(botoes[0].textContent).toContain("Continuar");
  });

it("abrir o pause fecha os outros paineis", () => {
    const { container } = montar();

    // o painel de Status e o que abre com menos dado: ele nao le nada
    // do snapshot, entao nao depende do que o teste montou
    fireEvent.click(container.querySelector(".hud-btn--status"));

    expect(
      container.querySelector(".sts-panel"),
      "o painel de status nao abriu",
    ).toBeTruthy();

    esc();

    expect(
      container.querySelector(".sts-panel"),
      "o painel de status ficou por cima do pause",
    ).toBe(null);

    expect(container.querySelector(".pause")).toBeTruthy();
  });

it("as outras teclas continuam abrindo seus paineis", () => {
    const { container } = montar();

    // a `P`: o status saiu da `S` porque ela e de andar para baixo
    fireEvent.keyDown(window, { code: "KeyP" });

    expect(container.querySelector(".sts-panel")).toBeTruthy();
  });
});