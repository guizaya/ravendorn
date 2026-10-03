import { describe, expect, it } from "vitest";
import {
  MarketStore,
  snapshotMarket,
} from "./MarketStore.js";
import {
  ANUNCIO_SEGUNDOS,
  MARKET_RESULT,
  PRECO_MAXIMO,
  PRECO_MINIMO,
  podeListar,
  precoValido,
} from "../../data/market/index.js";
import { ITEM_TYPE, RARITY } from "../../data/items/index.js";
import { Inventory } from "../inventory/Inventory.js";

/**
 * O MOTOR do market.
 *
 * O relogio e INJETADO, e nao `Date.now()` de verdade: sete dias de
 * validade nao cabem num teste de espera, e um timer falso esconde o
 * que acontece nas bordas — o ultimo segundo, e `expiresAt` exatamente
 * igual ao `agora`
 */
function loja(agora = 1_000_000) {
  let relogio = agora;
  let contador = 0;

  const store = new MarketStore({
    agora: () => relogio,
    novoId: () => `a_${++contador}`,
  });

  return {
    store,
    agora: () => relogio,
    /** avanca o relogio */
    passa: (ms) => {
      relogio += ms;
    },
  };
}

/** um anuncio de uma peca que existe no catalogo */
function anuncio(store, extras = {}) {
  return store.list({
    sellerKey: "ana",
    sellerName: "Ana",
    uid: "botas_arbalist#rare#7",
    price: 100,
    ...extras,
  });
}

describe("as regras do preco", () => {
  it("o preco tem piso e teto", () => {
    expect(precoValido(PRECO_MINIMO)).toBe(true);
    expect(precoValido(PRECO_MINIMO - 1)).toBe(false);
    expect(precoValido(PRECO_MAXIMO)).toBe(true);
    expect(precoValido(PRECO_MAXIMO + 1)).toBe(false);
  });

  it("preco quebrado e recusado, nao transformado em 0", () => {
    // Um preco `NaN` que passasse viraria um anuncio de graça
    expect(precoValido(NaN)).toBe(false);
    expect(precoValido(Infinity)).toBe(false);
    expect(precoValido("100")).toBe(false);
    expect(precoValido(null)).toBe(false);
    expect(precoValido(-100)).toBe(false);
  });

  it("qualquer item do catalogo pode ser listado", () => {
    expect(podeListar("willow_bow")).toBe(true);
    expect(podeListar("botas_warrior")).toBe(true);
    expect(podeListar("slime_gel")).toBe(true);

    // so item que nao existe nao pode
    expect(podeListar("item_que_nao_existe")).toBe(false);
    expect(podeListar("")).toBe(false);
    expect(podeListar(null)).toBe(false);
  });
});

describe("MarketStore: listar", () => {
  it("cria o anuncio com o prazo de sete dias", () => {
    const { store, agora } = loja();

    const resultado = store.list({
      sellerKey: "ana",
      sellerName: "Ana",
      uid: "x#rare#1",
      price: 100,
    });

    expect(resultado.ok).toBe(true);

    expect(resultado.listing.expiresAt - agora()).toBe(
      ANUNCIO_SEGUNDOS * 1000,
    );
  });

  it("recusa preco fora da faixa, e o motivo e PRECO", () => {
    const { store } = loja();

    expect(
      store.list({
        sellerKey: "ana",
        sellerName: "Ana",
        uid: "x#rare#1",
        price: 1,
      }).reason,
    ).toBe(MARKET_RESULT.PRECO);

    expect(store.openCount).toBe(0);
  });

it("ignora um modo de venda que veio no pedido", () => {
      const { store } = loja();

      /**
       * O market tem UM modo so, entao o pedido nao tem lugar para um
       * `mode`. Um cliente antigo — ou um script — mandando `mode` nao
       * pode criar um anuncio com regra propria: o extra e simplesmente
       * ignorado, e o anuncio nasce no preco fixo
       */
      const resultado = store.list({
        sellerKey: "ana",
        sellerName: "Ana",
        uid: "x#rare#1",
        price: 100,
        mode: "barato_pra_caras",
      });

      expect(resultado.ok).toBe(true);
      expect(resultado.listing.mode).toBe(undefined);
    });

  it("o limite de anuncios por jogador existe", () => {
    const { store } = loja();

    for (let i = 0; i < 8; i += 1) {
      expect(
        store.list({
          sellerKey: "ana",
          sellerName: "Ana",
          uid: `x#rare#${i}`,
          price: 100,
        }).ok,
      ).toBe(true);
    }

    const nono = store.list({
      sellerKey: "ana",
      sellerName: "Ana",
      uid: "x#rare#99",
      price: 100,
    });

    expect(nono.ok).toBe(false);
    expect(nono.reason).toBe(MARKET_RESULT.LIMITE);

    // e o limite e POR jogador: o outro vendedor ainda consegue
    expect(
      store.list({
        sellerKey: "bento",
        sellerName: "Bento",
        uid: "y#rare#1",
        price: 100,
      }).ok,
    ).toBe(true);
  });

  it("um anuncio so entra na vitrine depois do item sair da mao", () => {
    const { store } = loja();

    const { listing } = store.list({
      sellerKey: "ana",
      sellerName: "Ana",
      uid: "x#rare#1",
      price: 100,
    });

    // o `list` NAO sabe o que e o item: quem tira do inventario chama
    // o `fill` depois. Sem essa separacao, um erro no meio do caminho
    // deixaria um anuncio com `itemId: null` na vitrine
    expect(listing.itemId).toBe(null);

    const painel = snapshotMarket({
      store,
      viewerKey: "bento",
      viewerName: "Bento",
    });

    expect(
      painel.listings,
      "anuncio sem item apareceu na vitrine",
    ).toHaveLength(0);

    store.fill(listing, {
      itemId: "botas_arbalist",
      rarity: RARITY.RARE,
    });

    expect(listing.itemId).toBe("botas_arbalist");

    expect(
      snapshotMarket({
        store,
        viewerKey: "bento",
        viewerName: "Bento",
      }).listings,
    ).toHaveLength(1);
  });
});

describe("MarketStore: comprar", () => {
  it("o vendedor nao compra o proprio anuncio", () => {
    const { store } = loja();

    const { listing } = anuncio(store);
    store.fill(listing, { itemId: "slime_gel" });

    const resultado = store.buy(listing.id, "ana");

    expect(resultado.ok).toBe(false);
    expect(resultado.reason).toBe(MARKET_RESULT.PROPRIO);

    // e o anuncio continua no ar
    expect(store.openCount).toBe(1);
  });

  it("nao compra anuncio incompleto", () => {
    const { store } = loja();

    const { listing } = anuncio(store);

    // sem o `fill`, o anuncio nao tem item
    const resultado = store.buy(listing.id, "bento");

    expect(resultado.ok).toBe(false);
    expect(resultado.reason).toBe(MARKET_RESULT.SEM_ITEM);
  });

  it("a compra tira o anuncio do ar e entra no historico", () => {
    const { store } = loja();

    const { listing } = anuncio(store, { price: 250 });
    store.fill(listing, { itemId: "capuz_arbalist" });

    const resultado = store.buy(listing.id, "bento");

    expect(resultado.ok).toBe(true);
    expect(resultado.listing.price).toBe(250);

    expect(store.openCount).toBe(0);

    const historico = store.allHistory();

    expect(historico).toHaveLength(1);
    expect(historico[0].itemId).toBe("capuz_arbalist");
    expect(historico[0].price).toBe(250);
    expect(historico[0].buyerKey).toBe("bento");
    expect(historico[0].sellerKey).toBe("ana");
  });

  it("o historico e limitado, e o mais ANTIGO sai", () => {
    const { store } = loja();

    for (let i = 0; i < 45; i += 1) {
      const { listing } = store.list({
        sellerKey: "ana",
        sellerName: "Ana",
        uid: `x#rare#${i}`,
        price: 100 + i,
      });

      store.fill(listing, { itemId: "slime_gel" });
      store.buy(listing.id, "bento");
    }

    const historico = store.allHistory();

    expect(historico).toHaveLength(40);

    // o mais recente e o de maior preco, o de i=44
    expect(historico[0].price).toBe(144);

    // e o de i=4, que era o mais antigo da janela, foi o que saiu
    expect(
      historico.some((venda) => venda.price === 104),
    ).toBe(false);
  });

  it("comprar duas vezes o mesmo anuncio da erro na segunda", () => {
    const { store } = loja();

    const { listing } = anuncio(store);
    store.fill(listing, { itemId: "slime_gel" });

    expect(store.buy(listing.id, "bento").ok).toBe(true);

    const segunda = store.buy(listing.id, "bento");

    expect(segunda.ok).toBe(false);
    expect(segunda.reason).toBe(MARKET_RESULT.SEM_ANUNCIO);
  });
});

describe("MarketStore: cancelar", () => {
  it("o dono cancela e o item volta para a mao dele", () => {
    const { store } = loja();

    const { listing } = anuncio(store);
    store.fill(listing, { itemId: "slime_gel" });

    const resultado = store.cancel(listing.id, "ana");

    expect(resultado.ok).toBe(true);
    expect(store.openCount).toBe(0);
  });

  it("ninguem cancela o anuncio de outro", () => {
    const { store } = loja();

    const { listing } = anuncio(store);
    store.fill(listing, { itemId: "slime_gel" });

    // este e o furo de seguranca mais grave do market: cancelar o
    // anuncio de outro e ficar com o item de volta
    const resultado = store.cancel(listing.id, "bento");

    expect(resultado.ok).toBe(false);
    expect(resultado.reason).toBe(MARKET_RESULT.SEM_ANUNCIO);

    // e o anuncio continua no ar
    expect(store.openCount).toBe(1);
  });
});

describe("MarketStore: os sete dias", () => {
  it("o anuncio vive enquanto o prazo nao vence", () => {
    const { store, passa } = loja();

    const { listing } = anuncio(store);
    store.fill(listing, { itemId: "slime_gel" });

    // seis dias e um segundo: ainda valendo
    passa((ANUNCIO_SEGUNDOS - 1) * 1000);

    expect(store.openCount).toBe(1);
  });

  it("vence no instante exato do prazo", () => {
    const { store, passa } = loja();

    const { listing } = anuncio(store);
    store.fill(listing, { itemId: "slime_gel" });

    // `expirar` compara `expiresAt > agora`, entao no instante exato o
    // anuncio JA venceu. E a borda que o teste precisa cobrir: um
    // `>=` aqui deixa o anuncio vivo por mais um frame
    passa(ANUNCIO_SEGUNDOS * 1000);

    expect(store.openCount).toBe(0);
  });

  it("expirar devolve o que volta, para o vendedor receber", () => {
    const { store, passa } = loja();

    const { listing } = anuncio(store);
    store.fill(listing, { itemId: "slime_gel" });

    passa(ANUNCIO_SEGUNDOS * 1000 + 1);

    const expirados = store.expirar();

    expect(expirados).toHaveLength(1);

    // o que volta tem o `uid` do vendedor: sem ele o item nao tem como
    // voltar para a mao de quem vendeu
    expect(expirados[0].uid).toBe("botas_arbalist#rare#7");
    expect(expirados[0].itemId).toBe("slime_gel");
  });

  it("um anuncio vencido nao aparece na vitrine, nem como 'vencido'", () => {
    const { store, passa } = loja();

    const { listing } = anuncio(store);
    store.fill(listing, { itemId: "slime_gel" });

    passa(ANUNCIO_SEGUNDOS * 1000 + 1);

    const painel = snapshotMarket({
      store,
      viewerKey: "bento",
      viewerName: "Bento",
    });

    expect(painel.listings).toHaveLength(0);
  });

  it("nao da para comprar um anuncio vencido", () => {
    const { store, passa } = loja();

    const { listing } = anuncio(store);
    store.fill(listing, { itemId: "slime_gel" });

    passa(ANUNCIO_SEGUNDOS * 1000 + 1);

    const resultado = store.buy(listing.id, "bento");

    expect(resultado.ok).toBe(false);
    expect(resultado.reason).toBe(MARKET_RESULT.SEM_ANUNCIO);
  });
});

describe("MarketStore: o painel", () => {
  const lojaCom = () => {
    const l = loja();

    for (const item of [
      { itemId: "willow_bow", price: 500, rarity: RARITY.EPIC },
      { itemId: "slime_gel", price: 20, rarity: RARITY.COMMON },
      { itemId: "calca_warrior", price: 200, rarity: RARITY.RARE },
      { itemId: "ogre_hide", price: 80, rarity: RARITY.COMMON },
    ]) {
      const { listing } = l.store.list({
        sellerKey: "ana",
        sellerName: "Ana",
        uid: `${item.itemId}#1`,
        price: item.price,
        count: item.itemId === "slime_gel" ? 5 : 1,
      });

      l.store.fill(listing, {
        itemId: item.itemId,
        rarity: item.rarity,
      });
    }

    return l;
  };

  it("a vitrine vem ordenada pelo mais barato", () => {
    const { store } = lojaCom();

    const painel = snapshotMarket({
      store,
      viewerKey: "bento",
      viewerName: "Bento",
    });

    const precos = painel.listings.map((l) => l.price);

    expect(precos).toEqual([...precos].sort((a, b) => a - b));
    expect(precos[0]).toBe(20);
  });

  it("o jogador nao ve o proprio anuncio na vitrine", () => {
    const { store } = lojaCom();

    const painel = snapshotMarket({
      store,
      viewerKey: "ana",
      viewerName: "Ana",
    });

    expect(painel.listings).toHaveLength(0);

    // mas ele ve na aba dele
    expect(painel.meus).toHaveLength(4);
  });

  it("o filtro por tipo funciona", () => {
    const { store } = lojaCom();

    const painel = snapshotMarket({
      store,
      viewerKey: "bento",
      viewerName: "Bento",
      filtro: { tipo: ITEM_TYPE.MATERIAL },
    });

    expect(painel.listings).toHaveLength(2);
    expect(
      painel.listings.every(
        (l) => l.itemId === "slime_gel" || l.itemId === "ogre_hide",
      ),
    ).toBe(true);
  });

  it("o filtro por raridade funciona", () => {
    const { store } = lojaCom();

    const painel = snapshotMarket({
      store,
      viewerKey: "bento",
      viewerName: "Bento",
      filtro: { rarity: RARITY.RARE },
    });

    expect(painel.listings).toHaveLength(1);
    expect(painel.listings[0].itemId).toBe("calca_warrior");
  });

  it("os filtros se combinam", () => {
    const { store } = lojaCom();

    const painel = snapshotMarket({
      store,
      viewerKey: "bento",
      viewerName: "Bento",
      filtro: {
        tipo: ITEM_TYPE.MATERIAL,
        rarity: RARITY.COMMON,
      },
    });

    expect(painel.listings).toHaveLength(2);
  });

  it("o historico marca o que foi MEU, de qualquer ponta", () => {
    const { store } = loja();

    const { listing } = store.list({
      sellerKey: "ana",
      sellerName: "Ana",
      uid: "a#1",
      price: 100,
    });

    store.fill(listing, { itemId: "slime_gel" });
    store.buy(listing.id, "bento");

    // a Ana vendeu: a venda e dela
    expect(
      snapshotMarket({
        store,
        viewerKey: "ana",
      }).historico[0].minha,
    ).toBe(true);

    // o Bento comprou: tambem e dele
    expect(
      snapshotMarket({
        store,
        viewerKey: "bento",
      }).historico[0].minha,
    ).toBe(true);

    // e um terceiro nao tem nada
    expect(
      snapshotMarket({
        store,
        viewerKey: "terceiro",
      }).historico[0].minha,
    ).toBe(false);
  });

  it("o historico vem do mais recente para o mais antigo", () => {
    const { store, passa } = loja();

    for (const preco of [10, 20, 30]) {
      const { listing } = store.list({
        sellerKey: "ana",
        sellerName: "Ana",
        uid: `x#${preco}`,
        price: preco,
      });

      store.fill(listing, { itemId: "slime_gel" });
      store.buy(listing.id, "bento");

      passa(1000);
    }

    const historico = store.allHistory();

    expect(historico.map((v) => v.price)).toEqual([30, 20, 10]);
  });

  it("o painel traz os limites, para o jogador nao errar o preco", () => {
    const { store } = loja();

    const painel = snapshotMarket({
      store,
      viewerKey: "bento",
    });

    expect(painel.limites.precoMinimo).toBe(PRECO_MINIMO);
    expect(painel.limites.precoMaximo).toBe(PRECO_MAXIMO);
    expect(painel.limites.maxAnuncios).toBe(8);
  });
});

describe("MarketStore: o disco", () => {
  it("o anuncio sobrevive ao round trip", () => {
    const { store } = loja();

    const { listing } = store.list({
      sellerKey: "ana",
      sellerName: "Ana",
      uid: "botas#rare#1",
      price: 300,
    });

    store.fill(listing, {
      itemId: "botas_arbalist",
      rarity: RARITY.RARE,
    });

    const salvo = store.toSave();

    const outro = new MarketStore({
      agora: () => 1_000_000,
      novoId: () => "novo",
    });

    outro.fromSave(salvo);

    const recuperado = outro.all()[0];

    expect(recuperado.id).toBe(listing.id);
    expect(recuperado.itemId).toBe("botas_arbalist");
    expect(recuperado.rarity).toBe(RARITY.RARE);
expect(recuperado.price).toBe(300);

      // e o `uid` do vendedor, sem o qual o item nao volta
      expect(recuperado.uid).toBe("botas#rare#1");
    });

  it("o historico tambem sobrevive", () => {
    const { store } = loja();

    const { listing } = store.list({
      sellerKey: "ana",
      sellerName: "Ana",
      uid: "a#1",
      price: 100,
    });

    store.fill(listing, { itemId: "slime_gel" });
    store.buy(listing.id, "bento");

    const outro = new MarketStore({ novoId: () => "x" });

    outro.fromSave(store.toSave());

    expect(outro.allHistory()).toHaveLength(1);
    expect(outro.allHistory()[0].price).toBe(100);
  });

  it("anuncio pela metade no arquivo e descartado", () => {
    const store = new MarketStore({ novoId: () => "x" });

    store.fromSave({
      listings: [
        { id: "a1", sellerKey: "p1" },
        { id: "a2", itemId: "slime_gel" },
        { id: "a3", sellerKey: "p1", itemId: "inexistente" },
        { id: "a4", sellerKey: "p1", itemId: "slime_gel", price: 1 },
        "lixo",
        null,
      ],
      historico: [],
    });

    // nenhum desses e um anuncio completo e valido
    expect(store.openCount).toBe(0);
  });

  it("anuncio com prazo perdido nao nasce morto", () => {
    const store = new MarketStore({
      agora: () => 5_000_000,
      novoId: () => "x",
    });

    store.fromSave({
      listings: [
        {
          id: "a1",
          sellerKey: "p1",
          sellerName: "Ana",
          itemId: "slime_gel",
          rarity: RARITY.COMMON,
          price: 100,
          uid: "u#1",
          createdAt: 1000,
          expiresAt: 0,
        },
      ],
      historico: [],
    });

    const anuncioRecuperado = store.all()[0];

    expect(
      anuncioRecuperado,
      "o anuncio foi descartado por causa do prazo",
    ).toBeDefined();

    // o prazo novo e de sete dias a partir de agora, nao no passado
    expect(anuncioRecuperado.expiresAt).toBeGreaterThan(5_000_000);
  });

  it("save corrompido nao derruba o store", () => {
    const store = new MarketStore({ novoId: () => "x" });

    for (const lixo of [
      null,
      undefined,
      {},
      "texto",
      { listings: "nao lista" },
      { listings: [1, 2, 3] },
      { historico: null },
    ]) {
      expect(() => store.fromSave(lixo)).not.toThrow();
    }

    expect(store.openCount).toBe(0);
  });
});

describe("a loja inteira com dois jogadores", () => {
  it("o dinheiro sai do comprador e chega no vendedor", () => {
    // O `MarketStore` nao mexe em inventario: quem faz a transferencia
    // e o servidor, que tem as duas sessoes. Este teste prova o
    // contrato com o `Inventory` real, que e o que o servidor vai usar
    const { store } = loja();

    const daAna = new Inventory();
    const doBento = new Inventory();

    // O SLOT e o que limita isto. A mochila tem 20 slots e o
    // `slime_gel` empilha em 99, entao 3 unidades ocupam UMA pilha — e
    // `takeUid(pilha.uid, 2)` para dentro do que a pilha tem
    daAna.add("slime_gel", 3, RARITY.COMMON);
    daAna.addCoins(1000);
    doBento.addCoins(500);

    expect(daAna.usedSlots).toBe(1);

    // a Ana anuncia: 2 unidades saem da mochila dela
    const pilha = daAna.findStack("slime_gel", RARITY.COMMON);

    const tomado = daAna.takeUid(pilha.uid, 2);

    expect(tomado.count).toBe(2);

    const { listing } = store.list({
      sellerKey: "ana",
      sellerName: "Ana",
      uid: pilha.uid,
      price: 200,
    });

    store.fill(listing, tomado);

    expect(daAna.countAt("slime_gel")).toBe(1);

    // o Bento compra: paga e recebe
    expect(doBento.spendCoins(listing.price)).toBe(true);

    const recebido = doBento.add(
      listing.itemId,
      listing.count,
      listing.rarity,
    );

    expect(recebido.added).toBe(2);

    daAna.addCoins(listing.price);

    expect(daAna.coins).toBe(1200);
    expect(doBento.coins).toBe(300);
    expect(doBento.countAt("slime_gel")).toBe(2);

    store.buy(listing.id, "bento");
  });

  it("o comprador sem moedas nao leva o item", () => {
    // a ordem no servidor: checar saldo ANTES de tirar o item do
    // vendedor. Um `takeUid` antes do `spendCoins` daria o item de
    // graca
    const { store } = loja();

    const daAna = new Inventory();

    daAna.add("calca_warrior", 1, RARITY.EPIC);

    const pilha = daAna.findStack("calca_warrior", RARITY.EPIC);
    const tomado = daAna.takeUid(pilha.uid, 1);

    const { listing } = store.list({
      sellerKey: "ana",
      sellerName: "Ana",
      uid: pilha.uid,
      price: 900,
    });

    store.fill(listing, tomado);

    const doBento = new Inventory();
    doBento.addCoins(10);

    expect(doBento.spendCoins(listing.price)).toBe(false);

    // o dinheiro nao saiu, entao a compra nem comeca
    expect(doBento.coins).toBe(10);
    expect(daAna.countAt("calca_warrior")).toBe(0);
    expect(store.openCount).toBe(1);
  });
});