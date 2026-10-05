import { describe, expect, it, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";
import { NPC_ACAO, NPC_TYPES } from "../../data/npc/index.js";

/**
 * O clique no NPC ABRINDO o painel.
 *
 * O painel de guilda ja sumiu uma vez por causa de um `?.` sobre um
 * handler que o construtor nunca guardou: o motor chamava, o `?.`
* engolia, e nada aparecia sem erro no console. O NPC e o mesmo caminho
     * — o motor entrega a entidade e quem tem de abrir o painel e a HUD —
     * entao o que este arquivo segura e que o hook foi INSTALADO no motor
     * e que ele CHEGA na hora
 */

afterEach(cleanup);

const ANA = {
  id: "p_ana",
  name: "Ana",
  className: "Warrior",
  level: 9,
  hp: 1400,
  maxHp: 1400,
  resource: 100,
  maxResource: 100,
  resourceName: "Furia",
  shield: 0,
  skills: [],
  statusEffects: [],
};

/**
 * O mercado, no MESMO formato que o `hudMarket.test.jsx` monta.
 *
 * Com `market: null` o `MarketPanel` abre e quebra em `.length` de uma
 * lista indefinida. E nao um defeito do NPC: e o snapshot de teste que
 * estava incompleto, e o formato do painel e o do servidor
 */
const MARKET = {
  listings: [],
  meus: [],
  historico: [],
  total: 0,
  coins: 500,
  limites: {
    maxAnuncios: 8,
    precoMinimo: 5,
    precoMaximo: 1_000_000,
  },
};

const snapshot = {
  time: 0,
  autoPlay: false,
  engaged: false,
  player: ANA,
  cooldowns: {},
  inventory: {
    coins: 500,
    used: 0,
    capacity: 20,
    isFull: false,
    freeSlots: 20,
    items: [],
  },
  equipment: { slots: [], items: [] },
  market: MARKET,
};

/**
 * O motor com o hook capturing.
 *
 * O `engineRef` e um `useRef` de verdade porque o HUD instala o
 * `onNpcClick` num efeito: um objeto literal recriado a cada render
 * perderia o hook e o teste passaria a medir outra coisa
 */
function montar() {
  const engineRef = { current: null };

  const utils = render(
    <HUD
      classDefinition={getCharacterDefinition("warrior")}
      characterName="Ana"
      snapshot={snapshot}
      engineRef={engineRef}
      intencao={null}
    />,
  );

  return { ...utils, engineRef };
}

/** o motor que o HUD precisa para instalar o hook */
function motorFalso() {
  return { onNpcClick: null };
}

describe("o hook do NPC", () => {
  it("a HUD instala o onNpcClick no motor", () => {
    const engine = motorFalso();
    const engineRef = { current: engine };

    render(
      <HUD
        classDefinition={getCharacterDefinition("warrior")}
        characterName="Ana"
        snapshot={snapshot}
        engineRef={engineRef}
        intencao={null}
      />,
    );

    /**
     * O motor precisa saber que ALGUEM escuta.
     *
     * Sem esta linha o clique no NPC sai pelo `this.onNpcClick?.()`
     * sobre `undefined` e nao abre nada — o mesmo silencio do `onDano`
     * que a guild e o numero de dano ja pickeram
     */
    expect(
      typeof engine.onNpcClick,
      "a HUD nao instalou o hook do NPC",
    ).toBe("function");
  });

  it("o hook sai quando a tela desmonta", () => {
    const engine = motorFalso();

    const { unmount } = render(
      <HUD
        classDefinition={getCharacterDefinition("warrior")}
        characterName="Ana"
        snapshot={snapshot}
        engineRef={{ current: engine }}
        intencao={null}
      />,
    );

    unmount();

    /**
     * Sem a limpeza, o motor guardaria o callback de uma tela que nao
     * existe mais, e o clique no NPC de outra tela abriria um painel
     * que foi desmontado junto
     */
    expect(
      engine.onNpcClick,
      "o hook sobrou depois do unmount",
    ).toBe(null);
  });

  it("sem motor, a HUD nao estoura", () => {
    expect(() =>
      render(
        <HUD
          classDefinition={getCharacterDefinition("warrior")}
          characterName="Ana"
          snapshot={snapshot}
          engineRef={{ current: null }}
          intencao={null}
        />,
      ),
    ).not.toThrow();
  });
});

describe("o clique no mercador abre a loja de pocoes", () => {
  it("abre a loja, e nao o mercado entre jogadores", () => {
    const engine = motorFalso();
    const engineRef = { current: engine };

    const { container } = render(
      <HUD
        classDefinition={getCharacterDefinition("warrior")}
        characterName="Ana"
        snapshot={snapshot}
        engineRef={engineRef}
        intencao={null}
      />,
    );

    // o que o motor faria ao clicar na barra de pocoes
    act(() => {
      engine.onNpcClick({
        ...NPC_TYPES.mercador,
        id: "npc_mercado_base",
        x: 710,
        y: 377,
      });
    });

    /**
     * A LOJA abre, e o mercado NAO.
     *
     * Sao os dois lados da mesma asercao. A loja e `.pocao-panel`, e o
     * mercado e `.mkt-panel`: o mercador da base nao tem oferta nenhuma
     * para propose, entao abrir `.mkt-panel` mostraria um painel de
     * mercado vazio e o jogador nao veria a pocao que foi comprar
     */
    expect(
      container.querySelector(".pocao-panel"),
      "o clique no mercador nao abriu a loja",
    ).toBeTruthy();

    expect(
      container.querySelector(".mkt-panel"),
      "o mercador abriu o mercado entre jogadores",
    ).toBe(null);
  });

  it("a acao do mercador e a de pocoes, e nao a do mercado", () => {
    // O nome da acao e o que separa as duas coisas. Se `POCOES`
    // voltasse a ser `MERCADO`, o teste acima ainda passaria por
    // acidente enquanto o painel certo estivesse no lugar
    expect(NPC_ACAO.POCOES).toBe("pocoes");

    expect(NPC_TYPES.mercador.acao).toBe(NPC_ACAO.POCOES);
  });

  it("o botao do mercado NAO e o caminho do mercador", () => {
    const { container } = montar();

    expect(container.querySelector(".pocao-panel")).toBe(null);

    /**
     * O botao da barra abre o mercado, e so o mercado. Ele e um atalho
     * para a vitrine ENTRE jogadores, e nao um atalho para a loja: a
     * loja nao e lugar para onde se vai pelo teclado, e sim para onde
     * se vai clicando no NPC
     */
    act(() => {
      container.querySelector(".hud-btn--market").click();
    });

    expect(container.querySelector(".mkt-panel")).toBeTruthy();
    expect(container.querySelector(".pocao-panel")).toBe(null);
  });

  it("um NPC de acao desconhecida nao abre nada", () => {
    const engine = motorFalso();

    const { container } = render(
      <HUD
        classDefinition={getCharacterDefinition("warrior")}
        characterName="Ana"
        snapshot={snapshot}
        engineRef={{ current: engine }}
        intencao={null}
      />,
    );

    act(() => {
      engine.onNpcClick({
        ...NPC_TYPES.mercador,
        acao: "bancaDeMissao",
        id: "npc_banca",
        x: 100,
        y: 100,
      });
    });

    /**
     * Uma acao que o catalogo nao conhece nao abre painel nenhum.
     *
     * Sem o `if` por acao, um NPC futuro cairia na loja por padrao e
     * qualquer bancadinha abriria a loja de pocoes errado ate alguem
     * notar
     */
    expect(container.querySelector(".pocao-panel")).toBe(null);
    expect(container.querySelector(".mkt-panel")).toBe(null);
  });
});
