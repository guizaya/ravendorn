import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";
import { RARITY } from "../../data/items/index.js";

/**
 * O CAMINHO DO ANUNCIO, do clique ate o pedido.
 *
 * Os testes do `MarketPanel` conferem que o `onList` recebe o objeto
 * certo, e o do `GameClient` confere que o `uid` chega no socket. Nenhum
 * dos dois enxerga a EMPLACAO entre eles — e foi na emenda que o bug
 * nasceu: o painel chamava `onList` com um objeto e o HUD desestruturava
 * tres argumentos posicionais. O `uid` chegava como objeto, o protocolo o
 * descartava, e o servidor respondia "Voce nao tem esse item" para um item
 * que o jogador estava vendo na mochila
 *
 * Aqui os dois lados estao montados de verdade. E o teste que teria
 * pegado: ele falha se o painel e o HUD discordarem sobre a FORMA do
 * pedido, por mais que cada um esteja correto sozinho
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

const MOCHILA = {
  coins: 500,
  used: 2,
  capacity: 20,
  isFull: false,
  freeSlots: 18,
  items: [
    {
      uid: "slime_gel#common#1",
      itemId: "slime_gel",
      rarity: RARITY.COMMON,
      count: 7,
      equipped: false,
    },
    {
      uid: "capuz_arbalist#rare#2",
      itemId: "capuz_arbalist",
      rarity: RARITY.RARE,
      count: 1,
      equipped: false,
    },
  ],
};

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

function montar({ intencao: extra = {}, snapshot = {} } = {}) {
  /**
   * Os spies nascem aqui e o extra SOBRESCREVE campos, nunca a
   * funcao inteira. Substituir `intencao` por um objetoCru tiraria o
   * `vi.fn()` e o teste leria "undefined is not a spy" — que e o erro
   * de teste, nao o de codigo
   */
  const intencao = {
    ...{
      listarNoMarket: vi.fn(),
      comprarNoMarket: vi.fn(),
      cancelarNoMarket: vi.fn(),
    },
    ...extra,
  };

  const utils = render(
    <HUD
      classDefinition={classe}
      characterName="Ana"
      snapshot={{
        time: 0,
        autoPlay: false,
        engaged: false,
        player: ANA,
        cooldowns: {},
        inventory: MOCHILA,
        equipment: { slots: [], items: [] },
        market: MARKET,
        ...snapshot,
      }}
      engineRef={{ current: null }}
      intencao={intencao}
    />,
  );

  // abre o market pela barra, como o jogador faz
  fireEvent.click(utils.container.querySelector(".hud-btn--market"));

  // e vai para a aba de vender
  fireEvent.click(abaDe(utils.container, "Vender"));

  return { ...utils, intencao };
}

/** o slot da mochila do vendedor: o MESMO do inventario */
const celula = (container, indice = 0) =>
  [
    ...container.querySelectorAll(".inv-grid .inv-slot"),
  ][indice];

const abaDe = (container, nome) =>
  [...container.querySelectorAll("[role='tab']")].find((aba) =>
    aba.textContent.includes(nome),
  );

describe("anunciar: do clique ao pedido", () => {
  it("o material vai com uid, preco e quantidade", () => {
    const { container, intencao } = montar();

    fireEvent.click(
    celula(container, 0).querySelector(".inv-slot__hit"),
  );

    fireEvent.change(
      container.querySelector(".mkt-input--preco"),
      { target: { value: "250" } },
    );

    fireEvent.change(
      container.querySelector(".mkt-input--quantidade"),
      { target: { value: "3" } },
    );

    fireEvent.click(container.querySelector(".mkt-submit"));

    expect(intencao.listarNoMarket).toHaveBeenCalledTimes(1);

    const [uid, preco, count] =
      intencao.listarNoMarket.mock.calls[0];

    expect(uid, "o uid nao chegou no pedido").toBe(
      "slime_gel#common#1",
    );

    expect(preco).toBe(250);
    expect(count).toBe(3);
  });

  it("sem quantidade digitada, o pedido leva a pilha inteira", () => {
    const { container, intencao } = montar();

    fireEvent.click(
    celula(container, 0).querySelector(".inv-slot__hit"),
  );

    fireEvent.change(
      container.querySelector(".mkt-input--preco"),
      { target: { value: "250" } },
    );

    fireEvent.click(container.querySelector(".mkt-submit"));

    const [, , count] = intencao.listarNoMarket.mock.calls[0];

    expect(count, "a pilha nao foi inteiro").toBe(7);
  });

  it("a peca unica vai com o uid dela, e sem quantidade", () => {
    const { container, intencao } = montar();

    fireEvent.click(
    celula(container, 1).querySelector(".inv-slot__hit"),
  );

    fireEvent.change(
      container.querySelector(".mkt-input--preco"),
      { target: { value: "400" } },
    );

    fireEvent.click(container.querySelector(".mkt-submit"));

    const [uid, preco, count] =
      intencao.listarNoMarket.mock.calls[0];

    expect(uid).toBe("capuz_arbalist#rare#2");
    expect(preco).toBe(400);
    expect(count).toBe(1);
  });

  it("comprar e cancelar seguem levando so o id", () => {
    const { container, intencao } = montar({
      snapshot: {
        market: {
          ...MARKET,
          listings: [
            {
              id: "a_1",
              itemId: "slime_gel",
              rarity: RARITY.COMMON,
              count: 3,
              price: 90,
              sellerName: "Bento",
              expiresAt: 9_999_999_999,
              restanteMs: 500_000,
              color: "#c3ccd6",
            },
          ],
          meus: [
            {
              id: "a_2",
              itemId: "slime_core",
              rarity: RARITY.COMMON,
              count: 1,
              price: 70,
              expiresAt: 9_999_999_999,
              restanteMs: 400_000,
              color: "#c3ccd6",
              completo: true,
            },
          ],
        },
      },
    });

    fireEvent.click(abaDe(container, "Comprar"));

    fireEvent.click(
      container.querySelector(".mkt-item__buy"),
    );

    expect(intencao.comprarNoMarket).toHaveBeenCalledWith("a_1");

    fireEvent.click(abaDe(container, "Vender"));

    fireEvent.click(
      container.querySelector(".mkt-item__cancel"),
    );

    expect(intencao.cancelarNoMarket).toHaveBeenCalledWith("a_2");
  });
});