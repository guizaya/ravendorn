import { afterEach, describe, expect, it } from "vitest";
import {
  fireEvent,
  render,
  cleanup,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import CollectionPanel from "./CollectionPanel.jsx";
import { Collection } from "../../game/collection/Collection.js";
import { Inventory } from "../../game/inventory/Inventory.js";
import { Equipment } from "../../game/equipment/Equipment.js";
import { RARITY } from "../../data/items/index.js";
import { COLLECTIONS } from "../../data/collection/index.js";

/** um snapshot de verdade, montado pelo dominio */
function dados(mutar = null) {
  const inventory = new Inventory();
  const equipment = new Equipment();
  const collection = new Collection();

  mutar?.({ inventory, equipment, collection });

  return collection.snapshot(inventory, equipment);
}

const html = (snapshot, props = {}) =>
  renderToStaticMarkup(
    <CollectionPanel
      collection={snapshot}
      onDeliver={() => {}}
      onClose={() => {}}
      {...props}
    />,
  );

const GELO = "slime_gel";

/** o nome visivel de uma colecao, para achar a linha no DOM */
const nomeDe = (id) =>
  COLLECTIONS.find((c) => c.id === id)?.name ?? id;

describe("CollectionPanel", () => {
  it("abre com o placar das entregas", () => {
    const markup = html(dados());

    expect(markup).toContain("Colecao");
    expect(markup).toContain("0/");
    expect(markup).toContain("entregues");
  });

  it("lista uma linha por colecao do catalogo", () => {
    const markup = html(dados());

    expect((markup.match(/class="col-entry[ "]/g) ?? []).length).toBe(
      COLLECTIONS.length,
    );
  });

  it("mostra o que FALTA, com a contagem", () => {
    // "pronta: nao" nao ajuda ninguem a decidir o proximo passo. A
    // linha precisa dizer quantas unidades ainda faltam
    const markup = html(
      dados(({ inventory }) => {
        inventory.add(GELO, 3);
      }),
    );

    expect(markup).toContain("faltam 2 (3/5)");
    expect(markup).toContain("Gelo de Limo");
  });

  it("o botao de entregar so liga quando a colecao esta pronta", () => {
    /**
     * A checagem e por COLECAO, e nao no markup inteiro.
     *
     * As seis colecoes estao na tela ao mesmo tempo, entao um
     * `not.toContain("disabled")` no HTML inteiro falha sempre — as
     * cinco incompletas tem botao desabilitado de proposito. E um
     * `toContain("disabled")` tambem passaria mesmo com a colecao
     * errada: o `disabled` estaria ali por causa das outras cinco
     */
    const botaoDe = (snapshot, id) => {
      const { container } = render(
        <CollectionPanel
          collection={snapshot}
          onDeliver={() => {}}
          onClose={() => {}}
        />,
      );

      const linha = [
        ...container.querySelectorAll(".col-entry"),
      ].find((el) =>
        el.querySelector(".col-entry__names strong")
          ?.textContent.trim() === nomeDe(id),
      );

      return linha?.querySelector(".col-entry__give") ?? null;
    };

    const incompleta = botaoDe(
      dados(({ inventory }) => {
        inventory.add(GELO, 2);
      }),
      "col_cacos",
    );

    expect(incompleta, "a colecao sumiu da lista").toBeTruthy();
    expect(
      incompleta.disabled,
      "o botao de entregar ficou ativo sem material",
    ).toBe(true);

    const pronta = botaoDe(
      dados(({ inventory }) => {
        inventory.add(GELO, 5);
      }),
      "col_cacos",
    );

    expect(pronta).toBeTruthy();
    expect(
      pronta.disabled,
      "o botao ficou desabilitado com a colecao pronta",
    ).toBe(false);
  });

  it("a colecao entregue fica na lista, marcada", () => {
    // Some da lista, o jogador nao saberia se ja entregou. E o
    // requisito continua aparecendo, com o que foi entregue
    const markup = html(
      dados(({ inventory, collection, equipment }) => {
        inventory.add(GELO, 5);
        collection.deliver("col_cacos", inventory, equipment);
      }),
    );

    expect(markup).toContain("is-done");
    expect(markup).toContain("Entregue");
    expect(markup).toContain("1/");

    // o que NAO pode e a entrega ter sumido: uma colecao pronta ainda
    // mostra o botao, so que desabilitado. E o botao some na linha que
    // ja foi entregue, e nao do painel inteiro
    expect(markup).toContain("col-entry__give");

    const { container } = render(
      <CollectionPanel
        collection={dados(
          ({ inventory, collection, equipment }) => {
            inventory.add(GELO, 5);
            collection.deliver("col_cacos", inventory, equipment);
          },
        )}
        onDeliver={() => {}}
        onClose={() => {}}
      />,
    );

    const feita = [
      ...container.querySelectorAll(".col-entry.is-done"),
    ];

    expect(feita).toHaveLength(1);
    expect(
      feita[0].querySelector(".col-entry__give"),
      "a colecao entregue ainda offerta entrega",
    ).toBe(null);
  });

  it("a recompensa aparece ANTES da entrega", () => {
    // Entregar sem saber o que da e entregar no escuro. E a recompensa
    // e so stat, entao o que aparece e o rotulo do jogo de cada um
    const markup = html(dados());

    expect(markup).toContain("Bônus de status");
    expect(markup).toContain("VIT");
    expect(markup).toContain("HP");

    // e NAO aparece mais moeda nem item: a entrega consome o material
    // do jogador e devolver item era trocar material por material
    expect(markup).not.toContain("moedas");
    expect(markup).not.toContain("Madeira");
  });

  it("cada stat da recompensa mostra o rotulo e o valor", () => {
    const markup = html(dados());

    // "+2" e "VIT" no mesmo selo, e nao "2 moedas" numa frase. Um
    // numero sem rotulo nao diz se e vida, defesa ou velocidade
    expect(markup).toMatch(/\+2/);
    expect(markup).toMatch(/\+40/);
  });

  it("a recompensa continua visivel depois de entregue", () => {
    const markup = html(
      dados(({ inventory, collection, equipment }) => {
        inventory.add(GELO, 5);
        collection.deliver("col_cacos", inventory, equipment);
      }),
    );

    expect(markup).toContain("Bônus de status");
    expect(markup).toContain("VIT");
  });

  it("mostra o bonus permanente, como o bestiario", () => {
    // Cacada e colecao dao a mesma coisa — stat que fica no
    // personagem — entao as duas telas mostram na mesma forma e no
    // mesmo lugar. Sem esta secao o jogador entregava as seis colecoes
    // sem ver o que tinha ganhado, porque cada cartao so mostra o que
    // AQUELA entrega daria
    const antes = html(dados());

    expect(antes).toContain("perm-bonus-box");
    expect(antes).toContain("Bônus permanente");
    expect(antes).toContain("Nenhuma entrega concluída");

    const depois = html(
      dados(({ inventory, collection, equipment }) => {
        inventory.add(GELO, 5);
        collection.deliver("col_cacos", inventory, equipment);
      }),
    );

    expect(depois).toContain("perm-bonus__chip");
    expect(depois).toContain("VIT");
    expect(depois).toContain("+2");
    expect(depois).toContain("+40");

    // e some o convite: depois da primeira entrega nao ha mais o que
    // convidar a fazer
    expect(depois).not.toContain("Nenhuma entrega concluída");
  });

  it("usa a MESMA caixa do bestiario", () => {
    // Duas classes diferentes para a mesma caixa e o melhor jeito de
    // a colecao sair sem moldura nenhuma: o nome `.perm-bonus-box` nao
    // tem "bst" nem "col", entao nenhum dos dois paineis consegue
    // ficar com a caixa so dele
    const colecao = html(dados());

    expect(colecao).toContain('class="perm-bonus-box"');

    const css = readFileSync("src/styles.css", "utf8");

    expect(css).toContain(".perm-bonus-box {");
    expect(css).not.toContain(".bst-panel__bonus {");
    expect(css).not.toContain(".col-panel__bonus {");
  });

  it("todo requisito mostra um icone, e nenhum fica vazio", () => {
    // Os materiais da entrega nao tem arte desenhada, entao o `ItemIcon`
    // cai no glifo do catalogo — e so quando o `item` vai JUNTO do
    // `itemId`. Passando so o id, cada linha abria com um
    // quadradinho em branco e o painel parecia quebrado
    const { container } = render(
      <CollectionPanel
        collection={dados()}
        onDeliver={() => {}}
        onClose={() => {}}
      />,
    );

    for (const icone of [
      ...container.querySelectorAll(".col-need__icon"),
    ]) {
      expect(
        icone.textContent.trim(),
        "requisito sem icone",
      ).not.toBe("");
    }
  });

  it("o requisito por raridade diz que e exato", () => {
    // O jogador com um lendario na mochila e um pedido de RARO na tela
    // le "faltam 1 (0/1)" com o lendario na frente dos olhos e conclui
    // que a entrega esta quebrada. A regra nao mudou; ela passou a
    // estar escrita onde o jogador decide
    const { container } = render(
      <CollectionPanel
        collection={dados()}
        onDeliver={() => {}}
        onClose={() => {}}
      />,
    );

    expect(container.textContent).toContain("equipamento raro exato");
    expect(container.textContent).toContain("equipamento lendario exato");
  });

  it("nao avisa mais sobre recompensa esperando espaco", () => {
    // A fila de recompensa foi embora com o item: um bonus de stat
    // nao ocupa slot. Um aviso de "esperando espaco na mochila" depois
    // de uma entrega paga seria o jogador esperando algo que nunca
    // chega
    const inventory = new Inventory(1);
    const equipment = new Equipment();
    const collection = new Collection();

    inventory.add(GELO, 5);
    collection.deliver("col_cacos", inventory, equipment);

    const markup = html(collection.snapshot(inventory, equipment));

    expect(markup).not.toContain("esperando espaco");
    expect(markup).not.toContain("col-pending");
  });

  it("aguenta snapshot vazio", () => {
    // O primeiro evento de rede chega um instante depois do primeiro
    // quadro, e ate la `collection` e `null`. Um painel que
    // dereferencia `entries` nesse instante derruba a tela
    const markup = renderToStaticMarkup(
      <CollectionPanel
        collection={null}
        onDeliver={() => {}}
        onClose={() => {}}
      />,
    );

    expect(markup).toContain("Colecao");
    expect(markup).toContain("Nenhuma colecao disponivel");
  });

  it("aguenta uma colecao sem nenhuma entrada", () => {
    const markup = html({
      entries: [],
      completed: 0,
      total: 0,
      isComplete: false,
      bonuses: {},
    });

    expect(markup).toContain("Nenhuma colecao disponivel");
  });

  it("aguenta uma recompensa que nao e stat", () => {
    // o snapshot e dado; uma colecao com `coins` no lugar de um stat
    // nao pode fazer o painel escrever "undefined" na tela
    const markup = html({
      entries: [
        {
          id: "col_quebrada",
          name: "Quebrada",
          icon: "◍",
          summary: "rewards fora do formato",
          done: false,
          pronta: false,
          needs: [],
          rewards: { coins: 10, items: [{ itemId: "x", count: 1 }] },
        },
      ],
      completed: 0,
      total: 1,
      isComplete: false,
      bonuses: { coins: 10 },
    });

    expect(markup).not.toContain("undefined");
    expect(markup).not.toContain("NaN");
  });
});

describe("CollectionPanel: os botoes", () => {
  afterEach(cleanup);

  const montar = (snapshot, props = {}) => {
    const entregues = [];

    const utils = render(
      <CollectionPanel
        collection={snapshot}
        onDeliver={(id) => entregues.push(id)}
        onClose={() => {}}
        {...props}
      />,
    );

    return { ...utils, entregues };
  };

  it("entregar leva o id da colecao, e nao a posicao", () => {
    const { container, entregues } = montar(
      dados(({ inventory }) => {
        inventory.add(GELO, 5);
      }),
    );

    const botoes = [
      ...container.querySelectorAll(".col-entry__give"),
    ].filter((b) => !b.disabled);

    expect(botoes.length).toBe(1);

    fireEvent.click(botoes[0]);

    expect(entregues).toEqual(["col_cacos"]);
  });

  it("o X fecha o painel", () => {
    let fechadas = 0;

    const { container } = montar(dados(), {
      onClose: () => {
        fechadas += 1;
      },
    });

    fireEvent.click(container.querySelector(".inv-close"));

    expect(fechadas).toBe(1);
  });

  it("o requisito de equipamento mostra a raridade, e nao um id de item", () => {
    // "1 unidade de equipamento raro" e o que o jogador le. Se
    // aparecesse o id do item, o painel estaria promising uma peca
    // especifica quando o requisito aceita qualquer uma daquela
    // raridade
    const markup = html(
      dados(({ inventory }) => {
        inventory.add("goblin_cloth", 5);
        inventory.add("capuz_arbalist", 1, RARITY.RARE);
      }),
    );

    expect(markup).toContain("equipamento raro");
  });
});
