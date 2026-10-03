import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";

/**
 * O botao de CONFIGURACAO, ao lado do rank.
 *
 * Ele nao abre um painel proprio: abre o PAUSE, a mesma cortina que a
 * ESC abre, que e onde vivem o "Continuar" e o "Voltar para as
 * classes". Fez sentido nao ter um segundo menu com as mesmas duas
 * opcoes
 *
 * O que este arquivo trava e a ligacao do botao com o pause. Sem ele,
 * o botao pode existir, ter a arte certa e nao abrir nada — que e o
 * tipo de defeito que so aparece quando alguem clica
 */
const montar = (props = {}) => {
  const snapshot = {
    time: 0,
    autoPlay: false,
    engaged: false,

    player: {
      id: "p_ana",
      name: "Ana",
      className: "Warrior",
      level: 9,
      hp: 1400,
      maxHp: 1400,
      resource: 100,
      maxResource: 100,
      resourceName: "Chi",
      shield: 0,
      skills: [],
      statusEffects: [],
    },

    quests: {
      main: { steps: [], total: 0, current: null },
      side: { available: [], current: null, completed: 0 },
      auto: { enabled: false, objectiveId: null, quest: null },
      claimable: [],
    },

    inventory: {
      coins: 0,
      used: 0,
      capacity: 20,
      isFull: false,
      items: [],
    },
  };

  const onBack = vi.fn();

  const utils = render(
    <HUD
      classDefinition={getCharacterDefinition("warrior")}
      characterName="Ana"
      snapshot={snapshot}
      engineRef={{ current: {} }}
      onBack={onBack}
      {...props}
    />,
  );

  return { ...utils, onBack };
};

const botaoConfig = (container) =>
  container.querySelector(".hud-btn--settings");

const esc = async () => {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" }));
  });
};

afterEach(cleanup);

describe("o botao de configuracao", () => {
  it("existe, ao lado do rank", () => {
    const { container } = montar();

    expect(botaoConfig(container)).toBeTruthy();

    // a posicao e testada aqui e nao so por CSS: a engrenagem e a
    // ultima da fila, e o motivo esta no comentario do `HUD.jsx`
    const menu = container.querySelector(".hud-menu");

    const ordem = [...menu.querySelectorAll("button")].map((botao) =>
      [...botao.classList]
        .find((nome) => nome.startsWith("hud-btn--")),
    );

    expect(ordem.at(-1)).toBe("hud-btn--settings");
    expect(ordem).toContain("hud-btn--rank");

    // e o rank vem logo antes dele, sem nada entre os dois
    expect(ordem.indexOf("hud-btn--rank")).toBe(ordem.length - 2);
  });

  it("abre o pause", () => {
    const { container } = montar();

    expect(container.querySelector(".pause")).toBe(null);

    fireEvent.click(botaoConfig(container));

    expect(container.querySelector(".pause")).toBeTruthy();
  });

  it("abre o MESMO pause que a ESC, com as mesmas opcoes", async () => {
    const peloBotao = montar();

    fireEvent.click(botaoConfig(peloBotao.container));

    const botoesDoBotao = [
      ...peloBotao.container.querySelectorAll(".pause__btn"),
    ].map((botao) => botao.textContent.trim());

    cleanup();

    const pelaEsc = montar();

    // o `await` e obrigatorio: o `act` que monta o `esc` e assincrono,
    // e sem esperar o DOM ainda e o de antes do pause
    await esc();

    const botoesDaEsc = [
      ...pelaEsc.container.querySelectorAll(".pause__btn"),
    ].map((botao) => botao.textContent.trim());

    // sao o mesmo menu: "Continuar" e "Voltar para as classes". Se os
    // dois divergirem, o jogador encontrou o menu do botao e o da
    // tecla como telas diferentes
    expect(botoesDoBotao).toEqual(botoesDaEsc);
    expect(botoesDoBotao.length).toBe(2);
  });

  it("o continuar do botao volta para o jogo sem sair do personagem", () => {
    const { container, onBack } = montar();

    fireEvent.click(botaoConfig(container));

    const continuar = [
      ...container.querySelectorAll(".pause__btn"),
    ].find((botao) => botao.textContent.includes("Continuar"));

    fireEvent.click(continuar);

    expect(container.querySelector(".pause")).toBe(null);
    expect(
      onBack,
      "continuar saiu do personagem",
    ).not.toHaveBeenCalled();
  });

  it("o voltar do botao sai para as classes", () => {
    const { container, onBack } = montar();

    fireEvent.click(botaoConfig(container));

    const voltar = [
      ...container.querySelectorAll(".pause__btn"),
    ].find((botao) =>
      botao.textContent.includes("Voltar para as classes"),
    );

    fireEvent.click(voltar);

    expect(onBack).toHaveBeenCalled();
    expect(container.querySelector(".pause")).toBe(null);
  });

  it("fecha o painel que estava aberto", () => {
    const { container } = montar();

    // o painel de status nao le nada do snapshot, entao abre sem
    // depender do que o teste montou
    fireEvent.click(container.querySelector(".hud-btn--status"));

    expect(container.querySelector(".sts-panel")).toBeTruthy();

    fireEvent.click(botaoConfig(container));

    // sao duas camadas na mesma tela: o jogador que abriu o menu para
    // sair nao deveria encontrar o painel por cima dele
    expect(
      container.querySelector(".sts-panel"),
      "o painel ficou por cima do pause",
    ).toBe(null);

    expect(container.querySelector(".pause")).toBeTruthy();
  });

it("a ESC ainda fecha o pause que o botao abriu", async () => {
    const { container } = montar();

    fireEvent.click(botaoConfig(container));

    expect(container.querySelector(".pause")).toBeTruthy();

    // o botao ABRE e nao alterna, entao a ESC precisa continuar sendo
    // o caminho de volta sem mouse — e com o painel cobrindo a tela,
    // o cursor nem sempre alcanca o "Continuar"
    await esc();

    expect(container.querySelector(".pause")).toBe(null);
  });

  it("o botao nao tem badge, e nao e painel", () => {
    const { container } = montar();

    const botao = botaoConfig(container);

    // ele nao abre um painel e nao tem contagem de nada: um badge aqui
    // seria um numero sem o que significar
    expect(botao.querySelector(".hud-btn__badge")).toBe(null);

    // e por isso ele nao entra na lista de `is-active`: o pause e a
    // cortina, nao um painel
    expect(botao.className).not.toContain("is-active");
  });

  it("a tecla da barra nao mexe no pause", async () => {
    const { container } = montar();

    fireEvent.click(botaoConfig(container));

    // o pause e uma cortina com `aria-modal`, e nenhum atalho de painel
    // pode abrir um painel por baixo dela
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyP" }),
      );
    });

    expect(container.querySelector(".sts-panel")).toBe(null);
    expect(container.querySelector(".pause")).toBeTruthy();
  });
});