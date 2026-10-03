import { describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

import HUD from "./HUD.jsx";
import { GameEngine } from "../../game/engine/GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { BASE_MAP } from "../../data/maps/base.js";
import { BASE_PORTALS } from "../../data/portais/index.js";

/**
 * O BOTAO "Atravessar", do clique ate a intencao.
 *
 * Este arquivo existe por causa de um defeito que nao aparecia em
 * lugar nenhum: o HUD chamava `intencao.travessarPortal`, e o objeto de
 * intencao entrega `atravessarPortal`, com o A. O nome do wrapper e o
 * do metodo divergem o tempo todo nesta ponte — `atacar` chama
 * `c.atacarAlvo`, `handleTravelPortal` chama `intencao.atravessarPortal` —
 * e escrever o nome do wrapper em vez do metodo levanta um `TypeError`
 * DENTRO do handler do React
 *
 * O preco e silencio: o erro so aparece no console, e o clique
 * simplesmente nao faz nada. Nem o teste de socket pegaria, porque ele
 * chama o `GameClient` direto e nao passa pela ponte da tela
 *
 * O painel vem de um motor DE VERDADE, com o jogador em cima do portal.
 * Montar o snapshot a mao daria um fixture que passa e nao prova nada:
 * o que importa aqui e o dado real chegando no HUD
 */

const [PORTAL] = BASE_PORTALS;

/** um motor no hub, com o jogador em cima do portal, e o painel dele */
function painelComJogadorNoPortal() {
  const engine = new GameEngine(
    null,
    CHARACTER_CLASSES[0],
    null,
    { playerId: "p1", characterName: "Ana" },
  );

  engine.setMap(BASE_MAP);
  engine.world.player.x = PORTAL.x;
  engine.world.player.y = PORTAL.y;

  let painel = null;

  engine.onSnapshot = (p) => { painel = p; };
  engine.sendSnapshot();

  return { painel, engine };
}

const montarHud = (painel, intencao, engine = null) =>
  render(
    <HUD
      classDefinition={CHARACTER_CLASSES[0]}
      characterName="Ana"
      snapshot={painel}
      engineRef={{ current: engine }}
      intencao={intencao}
    />,
  );

describe("o painel traz o portal", () => {
  it("em cima do portal, o painel tem id, destino e nome", () => {
    const { painel, engine } = painelComJogadorNoPortal();

    expect(painel.portal).toEqual({
      id: "portal_hub",
      destino: "map_1",
      nome: "Mapa 1",
    });

    engine.destroy();
  });
});

describe("a box do portal no HUD", () => {
  it("aparece o botao e o nome do destino", () => {
    const { painel, engine } = painelComJogadorNoPortal();

    const { container } = montarHud(painel, {
      atravessarPortal: vi.fn(),
    });

    expect(
      container.querySelector(".prt-box__go"),
      "a box do portal nao apareceu",
    ).toBeTruthy();

    expect(container.querySelector(".prt-box__name").textContent)
      .toBe("Mapa 1");

    engine.destroy();
    cleanup();
  });

  it("o clique pede a travessia pelo id do portal", () => {
    const { painel, engine } = painelComJogadorNoPortal();

    const intencao = { atravessarPortal: vi.fn() };

    const { container } = montarHud(painel, intencao);

    act(() => {
      container.querySelector(".prt-box__go").click();
    });

    expect(
      intencao.atravessarPortal,
      "o clique nao chegou em intencao.atravessarPortal — o nome " +
        "divergente levanta TypeError dentro do handler e o clique " +
        "nao faz nada",
    ).toHaveBeenCalledWith("portal_hub");

    engine.destroy();
    cleanup();
  });

  it("sem portal no painel, nao ha box", () => {
    const { painel, engine } = painelComJogadorNoPortal();

    painel.portal = null;

    const { container } = montarHud(painel, {
      atravessarPortal: vi.fn(),
    });

    expect(container.querySelector(".prt-box__go")).toBe(null);

    engine.destroy();
    cleanup();
  });

  it("sem intencao, o clique usa o motor local e nao lanca", () => {
    /**
     * O caminho offline: sem `intencao` o HUD manda no motor da tela.
     * O motor local realmente atravessa, entao o clique tem efeito
     */
    const { painel, engine } = painelComJogadorNoPortal();

    const { container } = montarHud(painel, null, engine);

    const botao = container.querySelector(".prt-box__go");

    expect(() =>
      act(() => {
        botao.click();
      }),
    ).not.toThrow();

    expect(engine.world.map.id).toBe("map_1");

    engine.destroy();
    cleanup();
  });
});
