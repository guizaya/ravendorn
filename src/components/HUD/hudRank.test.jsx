import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";
import { RANK_CRITERIO } from "../../game/ranking/rank.js";

/**
 * O botao de rank na barra, ao lado do bestiario.
 *
 * O que importa aqui e a ligacao com o PAINEL: o botao nao calcula
 * posicao nenhuma, ele le a lista que o servidor mandou. Se a HUD
 * ordenasse, o cliente escolheria a propria colocacao.
 */

const lista = [
  {
    id: "p_ana",
    name: "Ana",
    nivel: 9,
    xp: 0,
    cacadas: 1,
    abates: 4,
    posicao: 1,
    medalha: "🥇",
  },
  {
    id: "p_bia",
    name: "Bia",
    nivel: 3,
    xp: 90,
    cacadas: 6,
    abates: 20,
    posicao: 2,
    medalha: "🥈",
  },
  {
    id: "p_cid",
    name: "Cid",
    nivel: 1,
    xp: 0,
    cacadas: 0,
    abates: 0,
    posicao: 3,
    medalha: "🥉",
  },
];

const montar = (rank) => {
  const painel = {
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
    rank,
  };

  return render(
    <HUD
      classDefinition={getCharacterDefinition("warrior")}
      characterName="Ana"
      snapshot={painel}
      engineRef={{ current: {} }}
      intencao={null}
    />,
  );
};

const clicar = async (alvo) => {
  await act(async () => {
    alvo.click();
  });
};

const botaoRank = (container) =>
  container.querySelector(".hud-btn--rank");

const botaoBestiary = (container) =>
  container.querySelector(".hud-btn--bestiary");

afterEach(cleanup);

describe("botao de rank na HUD", () => {
  it("existe ao lado do bestiario", () => {
    const { container } = montar(null);

    expect(botaoRank(container)).toBeTruthy();
    expect(botaoBestiary(container)).toBeTruthy();
  });

  it("abre e fecha o painel de rank", async () => {
    const { container } = montar({
      [RANK_CRITERIO.NIVEL]: lista,
      [RANK_CRITERIO.BESTIARIO]: [...lista].reverse(),
    });

    await clicar(botaoRank(container));

    expect(container.querySelector(".rnk-panel")).toBeTruthy();
    expect(botaoRank(container).className).toContain("is-active");

    await clicar(botaoRank(container));

    expect(container.querySelector(".rnk-panel")).toBeNull();
  });

  it("mostra a posicao completa da Ana no medalão", () => {
    const { container } = montar({
      [RANK_CRITERIO.NIVEL]: lista,
      [RANK_CRITERIO.BESTIARIO]: [...lista].reverse(),
    });

    // a Ana e a lider: "1/3" e informacao real, e um "1" solto seria
    // vago com tres pessoas
    expect(botaoRank(container).textContent).toContain("1/3");
  });

  it("nao mostra medalão com uma pessoa so, para nao virar ruido", () => {
    const { container } = montar({
      [RANK_CRITERIO.NIVEL]: [lista[0]],
      [RANK_CRITERIO.BESTIARIO]: [lista[0]],
    });

    expect(botaoRank(container).textContent).not.toContain("/");
  });

  it("nao mostra medalão antes do primeiro pacote, quando nao ha rank", () => {
    const { container } = montar(null);

    expect(botaoRank(container).textContent).not.toContain("/");

    // e o botao continua funcionando: abrir um painel vazio e melhor
    // do que um botao morto
    expect(botaoRank(container)).toBeTruthy();
  });

  it("fecha o bestiario ao abrir o rank, para os dois nao se atropelarem", async () => {
    const { container } = montar({
      [RANK_CRITERIO.NIVEL]: lista,
      [RANK_CRITERIO.BESTIARIO]: [...lista].reverse(),
    });

    await clicar(botaoBestiary(container));

    expect(container.querySelector(".bst-panel")).toBeTruthy();

    await clicar(botaoRank(container));

    // os dois paineis sao centrais e na mesma posicao: abertos juntos,
    // um cobriria o outro e o jogador perderia a referencia de onde
    // esta olhando
    expect(container.querySelector(".bst-panel")).toBeNull();
    expect(container.querySelector(".rnk-panel")).toBeTruthy();

    await clicar(botaoBestiary(container));

    expect(container.querySelector(".rnk-panel")).toBeNull();
    expect(container.querySelector(".bst-panel")).toBeTruthy();
  });

  it("repassa a lista inteira ao painel, sem trocar a ordem", async () => {
    const { container } = montar({
      [RANK_CRITERIO.NIVEL]: lista,
      [RANK_CRITERIO.BESTIARIO]: [...lista].reverse(),
    });

    await clicar(botaoRank(container));

    // o nome vem do primeiro no de texto do `strong`: a badge
    // "voce" e um elemento dentro dele, e `textContent` inteiro
    // daria "Anavoidce"
    const nomes = [
      ...container.querySelectorAll(".rnk-row__name"),
    ].map((el) => el.childNodes[0].textContent.trim());

    expect(nomes).toEqual(["Ana", "Bia", "Cid"]);

    expect(
      container.querySelector(".rnk-row__you").textContent,
    ).toBe("voce");
  });

  it("abre e fecha pela tecla R", async () => {
    const { container } = montar({
      [RANK_CRITERIO.NIVEL]: lista,
      [RANK_CRITERIO.BESTIARIO]: lista,
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyR" }),
      );
    });

    expect(container.querySelector(".rnk-panel")).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyR" }),
      );
    });

    expect(container.querySelector(".rnk-panel")).toBeNull();
  });

  it("nao chama o motor para nada: o rank e leitura de painel", () => {
    const engine = {
      focusRank: vi.fn(),
      getRank: vi.fn(),
    };

    const painel = {
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
      rank: {
        [RANK_CRITERIO.NIVEL]: lista,
        [RANK_CRITERIO.BESTIARIO]: lista,
      },
    };

    render(
      <HUD
        classDefinition={getCharacterDefinition("warrior")}
        characterName="Ana"
        snapshot={painel}
        engineRef={{ current: engine }}
        intencao={null}
      />,
    );

    // o motor nao tem nem `focusRank` nem `getRank`, e a HUD nao
    // precisa de nenhum dos dois: o rank e so leitura do painel
    expect(engine.focusRank).not.toHaveBeenCalled();
    expect(engine.getRank).not.toHaveBeenCalled();
    expect(screen.getByTitle("Rank (R)")).toBeTruthy();
  });
});
