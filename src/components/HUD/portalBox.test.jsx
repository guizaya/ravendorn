import { describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

import HUD from "./HUD.jsx";
import { GameEngine } from "../../game/engine/GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { BASE_MAP } from "../../data/maps/base.js";
import { findMap } from "../../data/maps/index.js";
import {
  BASE_PORTALS,
  MAP_2_PORTALS,
  PORTALS,
} from "../../data/portais/index.js";
import { indiceDaUltimaMissao } from "../../data/quests/index.js";

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

    /**
     * `bloqueado` e `motivo` fazem parte do portal porque e o motor que
     * diz a travessia e o SERVIDOR que a nega. Sem os dois no painel, a
     * box so descobriria a trava depois de mandar o pedido, e o jogador
     * veria um botao que funciona umas vezes
     *
     * O portal do hub nao tem exigencia, entao vem aberto
     */
    expect(painel.portal).toEqual({
      id: "portal_hub",
      destino: "map_1",
      nome: "Mapa 1",
      bloqueado: false,
      motivo: null,
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

/**
 * O PORTAL SELADO: a Floresta Sombria so abre com o mapa 1 completo.
 *
 * O motor de verdade e o painel de verdade de novo: a trava e uma regra
 * do MOTOR (ele monta `bloqueado`), nao um estado que o HUD decide. Um
 * fixture montado a mao passaria mesmo com o motor publicando a trava
 * errada
 */
describe("o portal selado da Floresta Sombria", () => {
  const [FLORESTA] = PORTALS.filter((p) => p.id === "portal_floresta");

  /** motor no mapa 1, jogador em cima do portal da floresta */
  function painelNaFloresta(mainIndex) {
    const engine = new GameEngine(
      null,
      CHARACTER_CLASSES[0],
      null,
      { playerId: "p1", characterName: "Ana" },
    );

    engine.setMap(findMap("map_1"));
    engine.world.player.x = FLORESTA.x;
    engine.world.player.y = FLORESTA.y;
    engine.world.quests.mainIndex = mainIndex;

    let painel = null;

    engine.onSnapshot = (p) => { painel = p; };
    engine.sendSnapshot();

    return { painel, engine };
  }

  const ULTIMA = indiceDaUltimaMissao("map_1");

  it("a declaracao da trava esta no portal do mapa 1", () => {
    expect(FLORESTA.destino).toBe("map_2");
    expect(FLORESTA.exigeMissaoDe).toBe("map_1");
  });

  it("no meio da campanha, o painel diz que esta selado", () => {
    const { painel, engine } = painelNaFloresta(5);

    expect(painel.portal.bloqueado).toBe(true);
    expect(painel.portal.motivo).toContain("Floresta Sombria");

    engine.destroy();
  });

  it("a box escreve o motivo e desliga o botao", () => {
    const { painel, engine } = painelNaFloresta(5);

    const intencao = { atravessarPortal: vi.fn() };

    const { container } = montarHud(painel, intencao);

    expect(container.querySelector(".prt-box").dataset.bloqueado)
      .toBe("sim");

    expect(container.querySelector(".prt-box__lock").textContent)
      .toContain("Floresta Sombria");

    const botao = container.querySelector(".prt-box__go");

    expect(botao.disabled, "o botao ficou ativo num portal selado")
      .toBe(true);

    engine.destroy();
    cleanup();
  });

  it("terminada a campanha do mapa 1, o portal abre", () => {
    const { painel, engine } = painelNaFloresta(ULTIMA + 1);

    expect(painel.portal.bloqueado).toBe(false);
    expect(painel.portal.motivo).toBe(null);

    const { container } = montarHud(painel, {
      atravessarPortal: vi.fn(),
    });

    expect(container.querySelector(".prt-box__go").disabled).toBe(false);

    engine.destroy();
    cleanup();
  });

  /**
   * O MOTOR TAMBEM NEGA.
   *
   * Sem isto a trava existiria so na box e no servidor: no Single player
   * o clique passaria, porque o `travessarPortal` do motor nao olharia a
   * campanha. E o jogador que joga offline veria a regra funcionar so
   * online, que e o jeito de uma regra parecer implementada e nao estar
   */
  it("o motor recusa a travessia antes da campanha acabar", () => {
    const { engine } = painelNaFloresta(5);

    expect(engine.travessarPortal()).toBe(false);
    expect(engine.world.map.id).toBe("map_1");

    engine.destroy();
  });

  it("e atravessa assim que a campanha acaba", () => {
    const { engine } = painelNaFloresta(ULTIMA + 1);

    expect(engine.travessarPortal()).toBe(true);
    expect(engine.world.map.id).toBe("map_2");

    engine.destroy();
  });

  it("a VOLTA nunca e selada, mesmo com a campanha zerada", () => {
    const [VOLTA] = MAP_2_PORTALS;

    expect(VOLTA.exigeMissaoDe).toBe(undefined);

    const engine = new GameEngine(
      null,
      CHARACTER_CLASSES[0],
      null,
      { playerId: "p1", characterName: "Ana" },
    );

    engine.setMap(findMap("map_2"));
    engine.world.player.x = VOLTA.x;
    engine.world.player.y = VOLTA.y;
    engine.world.quests.mainIndex = 0;

    expect(engine.travessarPortal()).toBe(true);
    expect(engine.world.map.id).toBe("map_1");

    engine.destroy();
  });
});
