import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import MarketPanel from "./MarketPanel.jsx";
import {
  ANUNCIOS_MAXIMOS,
  PRECO_MAXIMO,
  PRECO_MINIMO,
} from "../../data/market/index.js";
import { ITEM_TYPE, RARITY, getItem } from "../../data/items/index.js";

/**
 * O painel do MARKET.
 *
 * Tres abas, filtro por tipo e raridade, e o preco. O que este
 * arquivo prova nao e que o painel tem esses controles — e que eles
 * mudam o que o jogador VÊ, e que nada de um jogador vaza para o
 * painel do outro
 */

/** um anuncio pronto, no formato do `snapshotMarket` */
function anuncio(over = {}) {
  return {
    id: "a_1",
    itemId: "willow_bow",
    rarity: RARITY.EPIC,
    count: 1,
    price: 500,
    sellerName: "Ana",
    sellerKey: "p_ana",
    expiresAt: 1_000_000,
    restanteMs: 500_000,
    color: "#c07be8",
    ...over,
  };
}

/**
 * Monta o painel e devolve os spies das acoes.
 *
 * Os spies sao `vi.fn()` em vez de um array manual: `toHaveBeenCalledWith`
 * diz o ARGUMENTO exato e `toHaveBeenCalledTimes` pega um duplo clique,
 * coisa que um `toEqual` sobre o array deixaria passar.
 *
 * O helper embrulha tudo num objeto só — `container` do render e `spies`
 * das acoes. Por isso quem chama precisa desestruturar
 * (`const { container, spies } = montarPainel(...)`) em vez de usar o
 * retorno direto: `montarPainel(...).onBuy` e `undefined`, porque os
 * spies vivem na chave `spies`, nao na raiz
 */
const montarPainel = (market, props = {}) => {
  const spies = {
    onBuy: vi.fn(),
    onCancel: vi.fn(),
    onList: vi.fn(),
    onClose: vi.fn(),
  };

  const utils = render(
    <MarketPanel
      market={market}
      inventory={props.inventory ?? null}
      onBuy={spies.onBuy}
      onCancel={spies.onCancel}
      onList={spies.onList}
      onClose={spies.onClose}
    />,
  );

  return { ...utils, spies };
};

/** o painel completo, com as tres listas e os limites */
const dados = (over = {}) => ({
  listings: [],
  meus: [],
  historico: [],
  total: 0,
  coins: 1000,

  /**
   * A mochila de quem esta olhando. O servidor manda `livres` e
   * `capacity`, e o painel so desabilita a compra quando estes numeros
   * existem — sem eles (Single player) o botao age e quem decide e o
   * servidor
   */
  mochila: { livres: 20, capacity: 20 },

  limites: {
    maxAnuncios: ANUNCIOS_MAXIMOS,
    precoMinimo: PRECO_MINIMO,
    precoMaximo: PRECO_MAXIMO,
  },
  ...over,
});

afterEach(cleanup);

describe("as tres abas", () => {
  it("existe comprar, vender e historico", () => {
    const { container } = montarPainel(dados());

    const abas = [
      ...container.querySelectorAll("[role='tab']"),
    ];

    expect(abas).toHaveLength(3);

    expect(
      abas.map((a) => a.textContent.trim()),
    ).toHaveLength(3);
  });

  it("abre em COMPRAR, que e a vitrine alheia", () => {
    const { container } = montarPainel(
      dados({ listings: [anuncio()] }),
    );

    expect(
      container.querySelector(".mkt-item"),
      "a vitrine nao veio primeiro",
    ).toBeTruthy();
  });

  it("cada aba mostra o seu conteudo", () => {
    const { container } = montarPainel(
      dados({
        listings: [anuncio()],
        meus: [anuncio({ id: "a_2" })],
        historico: [anuncio({ id: "a_3", minha: true })],
      }),
    );

    const clicarNaAba = (nome) =>
      fireEvent.click(
        [...container.querySelectorAll("[role='tab']")].find(
          (aba) => aba.textContent.includes(nome),
        ),
      );

    // a vitrine tem 1 item e o historico tem outro
    expect(
      container.querySelectorAll(".mkt-item"),
    ).toHaveLength(1);

    clicarNaAba("Historico");

    /**
     * O historico abre em "MINHAS", entao a linha do historico precisa
     * da marca `minha` — que e o que o servidor envia quando a venda
     * foi minha. Sem ela a linha seria de outro jogador e ficaria fora
     * do escopo padrao
     */
    expect(container.querySelectorAll(".mkt-item")).toHaveLength(1);
  });

  it("o historico abre so com as MINHAS vendas", () => {
    const { container } = montarPainel(
      dados({
        historico: [
          anuncio({ id: "a_minha", minha: true }),
          anuncio({ id: "a_alheia", minha: false }),
        ],
      }),
    );

    fireEvent.click(
      [...container.querySelectorAll("[role='tab']")].find((aba) =>
        aba.textContent.includes("Historico"),
      ),
    );

    expect(container.querySelectorAll(".mkt-item")).toHaveLength(1);

    // e o botao "todas" traz as duas
    fireEvent.click(
      [...container.querySelectorAll("button")].find((b) =>
        b.textContent.trim() === "Todas",
      ),
    );

    expect(container.querySelectorAll(".mkt-item")).toHaveLength(2);
  });
});

describe("a vitrine alheia", () => {
  it("mostra o preco, o vendedor e o item", () => {
    const { container } = montarPainel(
      dados({ listings: [anuncio({ price: 750 })] }),
    );

    const texto = container.textContent;

    expect(texto).toContain("750");
    expect(texto).toContain("Ana");
    expect(texto).toContain("Arco de Galho");
  });

  it("comprar leva o ID do anuncio", () => {
    const { container, spies } = montarPainel(
      dados({ listings: [anuncio({ id: "a_99" })] }),
    );

    fireEvent.click(
      container.querySelector(".mkt-item__buy"),
    );

    expect(spies.onBuy).toHaveBeenCalledTimes(1);
    expect(spies.onBuy).toHaveBeenCalledWith("a_99");
  });

  it("o filtro por TIPO reduz a lista", () => {
    const { container } = montarPainel(
      dados({
        listings: [
          anuncio({ id: "a_1", itemId: "willow_bow" }),
          anuncio({ id: "a_2", itemId: "slime_gel" }),
          anuncio({
            id: "a_3",
            itemId: "calca_warrior",
          }),
        ],
      }),
    );

    expect(
      container.querySelectorAll(".mkt-item"),
    ).toHaveLength(3);

    fireEvent.change(
      container.querySelector(".mkt-filters select"),
      {
        target: { value: ITEM_TYPE.MATERIAL },
      },
    );

    // so o material sobra
    expect(container.querySelectorAll(".mkt-item")).toHaveLength(1);
    expect(container.textContent).toContain("Gelo de Limo");
  });

  it("o filtro por RARIDADE reduz a lista", () => {
    const { container } = montarPainel(
      dados({
        listings: [
          anuncio({ id: "a_1", rarity: RARITY.COMMON }),
          anuncio({ id: "a_2", rarity: RARITY.LEGENDARY }),
          anuncio({ id: "a_3", rarity: RARITY.LEGENDARY }),
        ],
      }),
    );

    const selects = container.querySelectorAll(
      ".mkt-filters select",
    );

    fireEvent.change(selects[1], {
      target: { value: RARITY.LEGENDARY },
    });

    expect(container.querySelectorAll(".mkt-item")).toHaveLength(2);
  });

  it("um filtro sem resultado diz isso, e nao mostra a lista toda", () => {
    const { container } = montarPainel(
      dados({ listings: [anuncio()] }),
    );

    const selects = container.querySelectorAll(
      ".mkt-filters select",
    );

    fireEvent.change(selects[0], {
      target: { value: ITEM_TYPE.ARMOR },
    });

    expect(container.querySelectorAll(".mkt-item")).toHaveLength(0);
    expect(container.textContent).toContain("filtro");
  });
});

describe("o espaco da mochila na hora de comprar", () => {
  /**
   * O BUG QUE ESTE BLOCO TRAVA.
   *
   * O painel decidia se o item cabia lendo `inventory.freeSlots`, e o
   * `summary` do servidor NUNCA mandou esse campo — ele manda `used`,
   * `capacity` e `isFull`. Um `undefined > 0` da `false`, entao o botao
   * de compra ficava desabilitado com o titulo "A mochila esta cheia"
   * para TODO anuncio, com a mochila livre
   *
   * O numero da tela agora vem de `data.mochila`, que o servidor monta
   * com o mesmo `freeSlots` que ele usa para recusar a compra
   */
  const botao = (container) =>
    container.querySelector(".mkt-item__buy");

  const comEspaco = (livres) =>
    montarPainel(
      dados({
        listings: [anuncio()],
        mochila: { livres, capacity: 20 },
      }),
    );

  it("compra liberada quando ha slot livre", () => {
    const { container } = comEspaco(5);

    expect(botao(container).disabled).toBe(false);
    expect(botao(container).getAttribute("title")).toBe("Comprar");
  });

  it("compra bloqueada quando a mochila esta cheia de verdade", () => {
    const { container } = comEspaco(0);

    expect(botao(container).disabled).toBe(true);
    expect(botao(container).getAttribute("title")).toContain(
      "voce tem 0",
    );
  });

  it("o motivo traz quantos slots o anuncio exige", () => {
    // 99 de um material = 1 pilha; o titulo tem que dizer "1 slot"
    const { container } = comEspaco(0);

    expect(botao(container).getAttribute("title")).toContain(
      "precisa de 1 slot",
    );
  });

  it("um anuncio que funde no que ja existe nao gasta slot", () => {
    const { container } = montarPainel(
      dados({
        listings: [
          // a MESMA raridade da pilha do comprador: e por isso que funde
          anuncio({
            itemId: "slime_gel",
            count: 10,
            rarity: "common",
          }),
        ],
        mochila: { livres: 0, capacity: 20 },
      }),
      {
        // o comprador JA tem uma pilha parcial do mesmo item
        inventory: {
          items: [{ itemId: "slime_gel", count: 5, rarity: "common" }],
          used: 20,
          capacity: 20,
          isFull: true,
        },
      },
    );

    expect(botao(container).disabled).toBe(false);
  });

  it("sem os slots no painel o botao age: quem decide e o servidor", () => {
    const { container } = montarPainel(
      dados({ listings: [anuncio()], mochila: undefined }),
    );

    expect(botao(container).disabled).toBe(false);
  });

  it("cada anuncio e julgado pelo seu proprio tamanho", () => {
    const { container } = montarPainel(
      dados({
        listings: [
          anuncio({ id: "a_1", itemId: "slime_gel", count: 10 }),
          anuncio({ id: "a_2", itemId: "willow_bow", count: 3 }),
        ],
        mochila: { livres: 2, capacity: 20 },
      }),
    );

    const botoes = container.querySelectorAll(".mkt-item__buy");

    // o material cabe em 1 slot; 3 arcos nao empilham, dao 3
    expect(botoes[0].disabled).toBe(false);
    expect(botoes[1].disabled).toBe(true);
  });
});

describe("vender", () => {
  const mochila = {
    items: [
      {
        uid: "u1",
        itemId: "slime_gel",
        rarity: RARITY.COMMON,
        count: 5,
      },
      {
        uid: "u2",
        itemId: "capuz_arbalist",
        rarity: RARITY.RARE,
        count: 1,
      },
    ],
    isFull: false,
    freeSlots: 12,
  };

  /**
   * O slot da mochila do vendedor, agora o MESMO do inventario
   *
   * O mercado nao tem uma lista propria: ele usa o InvSlotView na
   * grade inv-grid. Um teste que procurasse .mkt-pick__cell passaria
   * vazio depois da mudanca — e falharia pelo motivo errado
   */
  const escolher = (container, indice = 0) => {
    const slot = [
      ...container.querySelectorAll(".inv-grid .inv-slot"),
    ][indice];

    expect(
      slot,
      `o slot ${indice} nao existe na mochila`,
    ).toBeTruthy();

    fireEvent.click(slot.querySelector(".inv-slot__hit"));

    return slot;
  };

  const abrirVenda = (market) => {
    const utils = montarPainel(market ?? dados(), { inventory: mochila });
    const { container } = utils;

    fireEvent.click(
      [...container.querySelectorAll("[role='tab']")].find(
        (aba) => aba.textContent.includes("Vender"),
      ),
    );

    return utils;
  };

  /**
 * O formulario so existe depois de escolher o item.
 *
 * Antes ele aparecia vazio, com a faixa de preco no placeholder, e o
 * jogador via dois campos e um numero que nao era dele. Sem item nao ha
 * o que preencher, entao a tela fica limpa
 */
it("sem item escolhido nao ha formulario nem botao", () => {
  const { container } = abrirVenda();

  expect(
    container.querySelector(".mkt-input--preco"),
    "o campo de preco apareceu sem escolher",
  ).toBe(null);

  expect(
    container.querySelector(".mkt-submit"),
    "o botao de anunciar apareceu sem escolher",
  ).toBe(null);

  expect(container.textContent).toContain(
    "Escolha um item da mochila",
  );
});

it("o anuncio so liga depois de escolher item e preco valido", () => {
  const { container } = abrirVenda();

  const botao = () =>
    container.querySelector(".mkt-submit");

  escolher(container);

  // item sem preco: existe o campo, mas nada foi escrito
  expect(botao(), "o botao nao apareceu com o item escolhido").toBeTruthy();
  expect(botao().disabled).toBe(true);

  // preco abaixo do piso
  fireEvent.change(
    container.querySelector(".mkt-input--preco"),
    { target: { value: "2" } },
  );

  expect(
    botao().disabled,
    "o botao ligou com preco abaixo do piso",
  ).toBe(true);

  // e o motivo fica escrito, em vez de um botao morto sem explicacao
  expect(container.textContent).toContain(
    "O preco precisa estar entre",
  );

  // preco valido
  fireEvent.change(
    container.querySelector(".mkt-input--preco"),
    { target: { value: "300" } },
  );

  expect(botao().disabled).toBe(false);
});

  it("anunciar leva o uid, o preco e a quantidade", () => {
    const { container, spies } = abrirVenda();

    escolher(container);

    fireEvent.change(
      container.querySelector(".mkt-input--preco"),
      { target: { value: "300" } },
    );

    fireEvent.click(
      container.querySelector(".mkt-submit"),
    );

    expect(spies.onList).toHaveBeenCalledTimes(1);
    expect(spies.onList).toHaveBeenCalledWith({
      uid: "u1",
      price: 300,
      count: 5,
    });
  });

  /**
 * O ICONE do item na aba de vender.
 *
 * O `ItemIcon` escolhe entre a arte e o glifo do catalogo. Passando so
 * o `itemId`, o componente nao acha nenhum dos dois e devolve um
 * `<span>` VAZIO: era o que acontecia com o material, que aparecia na
 * mochila com arte e na hora de vender virava um quadradinho sem nada
 */
it("o material da aba de vender mostra o icone, como na mochila", () => {
    const { container } = abrirVenda();

    const celulas = [
    ...container.querySelectorAll(".inv-grid .inv-slot"),
  ];

  // o primeiro item da mochila de teste e o gel, o material
  const gel = celulas[0];

  expect(gel, "o material nao esta na lista").toBeTruthy();

  const icone = gel.querySelector(".inv-slot__icon");

  expect(icone, "o icone do material sumiu").toBeTruthy();

  /**
   * `item-icon` e a classe de quem TEM arte (um `<img>` dentro), e
   * `item-icon--glyph` e a de quem cai no glifo de texto. Um dos dois
   * precisa aparecer: o que nao pode e um `span` sem conteudo
   */
  const temArte = icone.className.includes("item-icon");
  const temGlifo =
    icone.className.includes("item-icon--glyph") &&
    (icone.textContent ?? "").trim().length > 0;

  expect(
    temArte || temGlifo,
    "o icone do material esta vazio",
  ).toBe(true);
});

it("so o que empilha tem o campo de quantidade", () => {
  const { container } = abrirVenda();

  const campo = () =>
    container.querySelector(".mkt-input--quantidade");

  // material: empilha, entao o campo existe
  escolher(container, 0);

  expect(
    campo(),
    "o material precisa de quantidade",
  ).toBeTruthy();

  // peca unica: o campo some
  escolher(container, 1);

  expect(
    campo(),
    "uma peca unica nao tem quantidade",
  ).toBe(null);
});

it("a quantidade vai no pedido, e a pilha inteira quando fica vazia", () => {
  const { container, spies } = abrirVenda();

  escolher(container, 0);

  // vazio = a pilha inteira (o gel esta em 5)
  fireEvent.change(
    container.querySelector(".mkt-input--preco"),
    { target: { value: "300" } },
  );

  fireEvent.click(container.querySelector(".mkt-submit"));

  expect(spies.onList).toHaveBeenCalledWith({
    uid: "u1",
    price: 300,
    count: 5,
  });

  // agora 2 de 5
  spies.onList.mockClear();

  escolher(container, 0);

  fireEvent.change(
    container.querySelector(".mkt-input--quantidade"),
    { target: { value: "2" } },
  );

  fireEvent.change(
    container.querySelector(".mkt-input--preco"),
    { target: { value: "100" } },
  );

  fireEvent.click(container.querySelector(".mkt-submit"));

  expect(spies.onList).toHaveBeenCalledWith({
    uid: "u1",
    price: 100,
    count: 2,
  });
});

it("uma quantidade acima da pilha desliga o botao", () => {
  const { container } = abrirVenda();

    escolher(container);

    fireEvent.change(
      container.querySelector(".mkt-input--preco"),
      { target: { value: "300" } },
    );

    // a pilha tem 5
    fireEvent.change(
      container.querySelector(".mkt-input--quantidade"),
      { target: { value: "9" } },
    );

    expect(
      container.querySelector(".mkt-submit").disabled,
      "anunciou mais do que tem na mochila",
    ).toBe(true);
  });

it("o preco do lote mostra o valor por unidade", () => {
  const { container } = abrirVenda();

  fireEvent.click(
    escolher(container),
  );

  fireEvent.change(
    container.querySelector(".mkt-input--quantidade"),
    { target: { value: "4" } },
  );

  fireEvent.change(
    container.querySelector(".mkt-input--preco"),
    { target: { value: "100" } },
  );

  const texto = container.textContent;

  // 100 por 4 = 25 por unidade. Sem esta linha o jogador acredita que
  // vendeu cada gel por 100
  expect(texto).toContain("25 por");
});

/**
 * O VALOR do catalogo como referencia de preco.
 *
 * Aparece depois de escolher o item, e some antes: enquanto o jogador
 * esta escolhendo o que vender nao ha valor nenhum para mostrar. E o
 * numero vem do catalogo (`getItem().value`), o mesmo que o inventario
 * mostra no title do slot — uma fonte so, para o valor de um item
 */
it("o valor do item aparece depois de escolher", () => {
  const { container } = abrirVenda();

  expect(
    container.textContent,
    "o valor apareceu antes de escolher",
  ).not.toContain("Valor do item");

  escolher(container, 0);

  expect(container.textContent).toContain(
    `Valor do item: ${getItem("slime_gel").value}`,
  );

  // troca de item troca o valor. o segundo item da mochila de teste e o
  // capuz — uma peca de armadura, sem pilha
  escolher(container, 1);

  expect(container.textContent).toContain(
    `Valor do item: ${getItem("capuz_arbalist").value}`,
  );
});

it("o limite de anuncios desliga o botao", () => {
    const meus = Array.from(
      { length: ANUNCIOS_MAXIMOS },
      (_, i) =>
        anuncio({ id: `a_${i}`, itemId: "slime_gel" }),
    );

    const { container } = abrirVenda(dados({ meus }));

    escolher(container);

    fireEvent.change(
      container.querySelector(".mkt-input--preco"),
      { target: { value: "300" } },
    );

    expect(
      container.querySelector(".mkt-submit").disabled,
      "anunciou acima do limite",
    ).toBe(true);

    expect(container.textContent).toContain("limite");
  });

  it("cancelar leva o id do anuncio", () => {
    const { container, spies } = abrirVenda(
      dados({ meus: [anuncio({ id: "a_7" })] }),
    );

    fireEvent.click(
      container.querySelector(".mkt-item__cancel"),
    );

    expect(spies.onCancel).toHaveBeenCalledTimes(1);
    expect(spies.onCancel).toHaveBeenCalledWith("a_7");
  });

  it("a mochila vazia diz isso em vez de mostrar uma grade vazia", () => {
    const { container } = montarPainel(dados(), {
      inventory: { items: [], isFull: false, freeSlots: 20 },
    });

    fireEvent.click(
      [...container.querySelectorAll("[role='tab']")].find(
        (aba) => aba.textContent.includes("Vender"),
      ),
    );

    expect(container.textContent).toContain("vazia");
  });
});

describe("o historico", () => {
  it("cada venda diz quem vendeu e para quem", () => {
    const { container } = montarPainel(
      dados({
        historico: [
          anuncio({
            id: "h1",
            sellerName: "Ana",
            buyerName: "Bento",
            price: 900,
            minha: true,
          }),
        ],
      }),
    );

    fireEvent.click(
      [...container.querySelectorAll("[role='tab']")].find(
        (aba) => aba.textContent.includes("Historico"),
      ),
    );

    const texto = container.textContent;

    expect(texto).toContain("Ana");
    expect(texto).toContain("Bento");
    expect(texto).toContain("900");
  });

  it("venda de terceiro nao tem a marca de 'minha'", () => {
    const { container } = montarPainel(
      dados({
        historico: [anuncio({ id: "h1", minha: false })],
      }),
    );

    fireEvent.click(
      [...container.querySelectorAll("[role='tab']")].find(
        (aba) => aba.textContent.includes("Historico"),
      ),
    );

    expect(
      container.querySelector(".mkt-item.is-mine"),
    ).toBe(null);
  });

  it("sem historico, diz que nada foi vendido", () => {
    const { container } = montarPainel(dados());

    fireEvent.click(
      [...container.querySelectorAll("[role='tab']")].find(
        (aba) => aba.textContent.includes("Historico"),
      ),
    );

    expect(container.textContent).toContain("Nada foi vendido");
  });
});

describe("o tempo do anuncio", () => {
  it("a barra mostra quantos dias restam", () => {
    const markup = renderToStaticMarkup(
      <MarketPanel
        market={dados({
          listings: [
            anuncio({
              restanteMs: 3 * 24 * 60 * 60 * 1000,
            }),
          ],
        })}
        inventory={null}
        onBuy={() => {}}
        onCancel={() => {}}
        onList={() => {}}
        onClose={() => {}}
      />,
    );

    expect(markup).toContain("3d");
  });

  it("a barra nao estoura com tempo negativo", () => {
    // um `restanteMs` negativo viraria uma barra de largura negativa,
    // e o navegador nao desenha nada: o jogador perderia a informacao
    // de quanto tempo resta
    const markup = renderToStaticMarkup(
      <MarketPanel
        market={dados({
          listings: [anuncio({ restanteMs: -5000 })],
        })}
        inventory={null}
        onBuy={() => {}}
        onCancel={() => {}}
        onList={() => {}}
        onClose={() => {}}
      />,
    );

    expect(markup).toContain("mkt-time");
    expect(markup).not.toMatch(/width:\s*-/);
  });
});

describe("o painel aguenta dado faltando", () => {
  it("aguenta snapshot sem market", () => {
    // o primeiro evento de rede chega um instante depois do primeiro
    // quadro, e nesse intervalo o painel ja esta montado
    expect(() =>
      renderToStaticMarkup(
        <MarketPanel
          market={null}
          inventory={null}
          onBuy={() => {}}
          onCancel={() => {}}
          onList={() => {}}
          onClose={() => {}}
        />,
      ),
    ).not.toThrow();
  });

  it("aguenta um anuncio sem os campos opcionais", () => {
    expect(() =>
      renderToStaticMarkup(
        <MarketPanel
          market={dados({ listings: [anuncio({ color: null })] })}
          inventory={null}
          onBuy={() => {}}
          onCancel={() => {}}
          onList={() => {}}
          onClose={() => {}}
        />,
      ),
    ).not.toThrow();
  });
});