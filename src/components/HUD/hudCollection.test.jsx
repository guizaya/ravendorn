import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";
import {
  COLLECTIONS,
  getCollection,
} from "../../data/collection/index.js";

/**
 * A aba de COLECAO na barra do HUD.
 *
 * Este arquivo e do BOTAO e do CAMINHO do pedido, nao da entrega: a
 * regra de consumir item tem teste proprio em `game/collection`, no
 * motor e no servidor
 *
 * O que importa aqui:
 *
 * - o botao existe, e fica AO LADO do bestiario, que e onde o jogador
 *   foi procura-lo
 * - ele abre e fecha o painel
 * - online a entrega vira PEDIDO, e nao chamada no motor da tela. O
 *   motor da tela nao tem sessao deste jogador online, entao consumir
 *   material nele perderia a entrega pelo caminho
 */
const classe = getCharacterDefinition("arbalist");

/**
 * O jogador do snapshot.
 *
 * A HUD le muito mais do que a colecao: `BuffStrip` faz
 * `effects.length` sem guarda, e o `skills` do jogador alimenta a barra
 * de acoes. Um snapshot com so `hp` derruba o `render` inteiro — e o
 * erro aparece como `Cannot read properties of undefined`, longe da
 * causa
 */
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

/** um snapshot com a colecao pronta para a primeira entrega */
function snapshotCom(entries, extra = {}) {
  const base = {
    time: 0,
    autoPlay: false,
    engaged: false,
    player: ANA,
    collection: {
      entries,
      completed: 0,
      total: COLLECTIONS.length,
      isComplete: false,
      pending: 0,
    },
  };

  return {
    ...base,
    ...extra,
    // o `collection` vai por ultimo: quem passa um bloco inteiro
    // precisa que ele ganhe do padrao, e nao o contrario
    collection: extra.collection ?? base.collection,
  };
}

/** uma entrada do painel, no formato que o `Collection.snapshot` devolve */
function entrada(id, { pronta = true, done = false } = {}) {
  const collection = getCollection(id);

  return {
    ...collection,
    done,
    pronta,
    faltam: null,
    needs: collection.requirements.map((r) => ({
      type: r.type,
      itemId: r.itemId ?? null,
      rarity: r.rarity ?? null,
      need: r.count,
      have: pronta ? r.count : 0,
      falta: pronta ? 0 : r.count,
      label: "x",
    })),
  };
}

/**
 * A barra de um snapshot especifico.
 *
 * O `html` recebe o bloco `collection` INTEIRO e ele substitui o
 * padrao. Passar so `entries` faria o `snapshotCom` remontar o resto
 * com `completed: 0`, e o teste do badge leria `0/6` sem nunca ter
 * usado o `completed: 2` que ele passou
 */
const html = (collection) =>
  renderToStaticMarkup(
    <HUD
      classDefinition={classe}
      characterName="Ana"
      snapshot={snapshotCom(collection?.entries ?? [], {
        collection,
      })}
      engineRef={{ current: null }}
    />,
  );

/** a barra de abas, isolada do resto da HUD */
const barra = (markup) =>
  markup.slice(
    markup.indexOf('<nav class="hud-menu">'),
    markup.indexOf("</nav>") + 6,
  );

describe("a aba de colecao", () => {
  it("o botao existe na barra, ao lado do bestiario", () => {
    const menu = barra(html());

    expect(menu).toContain("hud-btn--collection");
    expect(menu).toContain("hud-btn--bestiary");

    /**
     * A ORDEM importa. O jogador procurou a colecao AO LADO do
     * bestiario, e um `toContain` passaria com o botao em qualquer
     * lugar da barra — inclusive num menu que nao existe ainda na tela
     */
    expect(menu.indexOf("hud-btn--collection")).toBeGreaterThan(
      menu.indexOf("hud-btn--bestiary"),
    );

    // e antes do craft, que e acao e nao progresso
    expect(menu.indexOf("hud-btn--collection")).toBeLessThan(
      menu.indexOf("hud-btn--craft"),
    );
  });

  it("o botao mostra o progresso", () => {
    const menu = barra(
      html({
        entries: [],
        completed: 2,
        total: 6,
        isComplete: false,
        pending: 0,
      }),
    );

    expect(menu).toContain("2/6");
  });

  it("nao mostra badge quando a colecao esta completa", () => {
    const menu = barra(
      html({
        entries: [],
        completed: 6,
        total: 6,
        isComplete: true,
        pending: 0,
      }),
    );

    // "6/6" no badge seria ruido: o painel ja tem a tela de
    // celebracao, e o botao deve sair do foco quando nao ha nada a
    // fazer
    expect(menu).not.toContain("hud-btn__badge");
  });

  it("aguenta a HUD sem snapshot de colecao", () => {
    // O primeiro evento de rede chega um instante depois do primeiro
    // quadro. A barra nao pode quebrar sem a colecao
    const markup = renderToStaticMarkup(
      <HUD
        classDefinition={classe}
        characterName="Ana"
        snapshot={{ ...snapshotCom([]), collection: null }}
        engineRef={{ current: null }}
      />,
    );

    expect(barra(markup)).toContain("hud-btn--collection");
  });
});

describe("a aba de colecao abre e fecha", () => {
  it("o clique abre e fecha o painel", () => {
    const { container } = render(
      <HUD
        classDefinition={classe}
        characterName="Ana"
        snapshot={snapshotCom([entrada("col_cacos")])}
        engineRef={{ current: null }}
      />,
    );

    const botao = container.querySelector(
      ".hud-btn--collection",
    );

    expect(container.querySelector(".col-panel")).toBe(null);

    fireEvent.click(botao);

    expect(
      container.querySelector(".col-panel"),
      "o painel nao abriu",
    ).toBeTruthy();

    expect(botao.className).toContain("is-active");

    fireEvent.click(botao);

    expect(container.querySelector(".col-panel")).toBe(null);
    expect(botao.className).not.toContain("is-active");

    cleanup();
  });

  it("abrir a colecao fecha o bestiario", () => {
    /**
     * Os dois sao painel central e nao cabem um em cima do outro. O
     * bestiario ja fechava o rank, mas o caminho contrario nao era
     * verdade: os dois ficavam abertos juntos, sobrepostos
     */
    const { container } = render(
      <HUD
        classDefinition={classe}
        characterName="Ana"
        snapshot={snapshotCom([entrada("col_cacos")])}
        engineRef={{ current: null }}
      />,
    );

    fireEvent.click(container.querySelector(".hud-btn--bestiary"));

    expect(container.querySelector(".bst-panel")).toBeTruthy();

    fireEvent.click(container.querySelector(".hud-btn--collection"));

    expect(container.querySelector(".col-panel")).toBeTruthy();
    expect(
      container.querySelector(".bst-panel"),
      "os dois paineis ficaram abertos juntos",
    ).toBe(null);

    cleanup();
  });

  it("a tecla K abre e fecha", async () => {
    const { container } = render(
      <HUD
        classDefinition={classe}
        characterName="Ana"
        snapshot={snapshotCom([entrada("col_cacos")])}
        engineRef={{ current: null }}
      />,
    );

    /**
     * O `dispatchEvent` vai dentro do `act`.
     *
     * O `setState` do `useEffect` da HUD acontece FORA do ciclo de
     * render do React quando disparado direto na `window`, e sem o
     * `act` o React agrupa a atualizacao e nao a aplicou na hora. O
     * resultado e `col-panel` nulo e um teste que parece testar a
     * tecla e nao testa nada
     */
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyK" }),
      );
    });

    expect(
      container.querySelector(".col-panel"),
      "a tecla K nao abriu a colecao",
    ).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyK" }),
      );
    });

    expect(container.querySelector(".col-panel")).toBe(null);

    cleanup();
  });
});

describe("a entrega sai pelo caminho certo", () => {
  const montar = (props = {}) => {
    const utils = render(
      <HUD
        classDefinition={classe}
        characterName="Ana"
        snapshot={snapshotCom([entrada("col_cacos")])}
        engineRef={{ current: props.engine ?? null }}
        intencao={props.intencao ?? null}
      />,
    );

    fireEvent.click(
      utils.container.querySelector(".hud-btn--collection"),
    );

    return utils;
  };

  const clicarEmEntregar = (utils) => {
    const botao = utils.container.querySelector(
      ".col-entry__give:not(:disabled)",
    );

    expect(botao, "o painel nao abriu ou nada esta pronto").toBeTruthy();

    fireEvent.click(botao);
  };

  it("offline chama o motor da tela", () => {
    const entregue = [];

    const utils = montar({
      engine: {
        deliverCollection: (id) => entregue.push(id),
      },
    });

    clicarEmEntregar(utils);

    expect(entregue).toEqual(["col_cacos"]);

    cleanup();
  });

  it("online vira pedido, e nao mexe no motor da tela", () => {
    /**
     * Este e o ponto do padrao bifasico da HUD, e o furo que a missao
     * secundaria e a cacada do bestiario ja tinham.
     *
     * Online o motor da tela nao tem sessao deste jogador: chamar
     * `deliverCollection` nele consumiria material de um motor vazio e
     * o servidor nunca receberia a entrega
     */
    const entregarColecao = vi.fn();
    const deliverCollection = vi.fn();

    const utils = montar({
      engine: { deliverCollection },
      intencao: { entregarColecao },
    });

    clicarEmEntregar(utils);

    expect(entregarColecao).toHaveBeenCalledWith("col_cacos");
    expect(
      deliverCollection,
      "o motor da tela foi chamado online",
    ).not.toHaveBeenCalled();

    cleanup();
  });

  it("online entrega o id da colecao, e nao a posicao na lista", () => {
    const entregarColecao = vi.fn();

    const utils = montar({
      intencao: { entregarColecao },
    });

    clicarEmEntregar(utils);

    // o id vem do `entry.id`, nao do indice: a lista pode crescer ou
    // mudar de ordem sem quebrar o pedido
    expect(entregarColecao).toHaveBeenCalledWith("col_cacos");

    cleanup();
  });
});