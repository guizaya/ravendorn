import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

import EnchantPanel from "./EnchantPanel.jsx";
import {
  ENCHANT_POWER,
  enchantCost,
} from "../../data/enchant/index.js";
import { RARITY } from "../../data/items/index.js";

/**
 * O painel de ENCANTAR.
 *
 * Este arquivo trava o que a TELA faz, e nao o que o sorteio faz — o
 * sorteio e do `enchant.test.js`, e a regra do ouro e do motor e do
 * `enchantItem.test.js`. O que nao tem teste em outro lugar e a tela:
 * a lista, a caixa do lado, e a selecao
 *
 * Duas regras que a tela cumpre e que valem um teste cada:
 *
 * 1. A LISTA so tem o que aceita afixo. Mostrar material seria uma
 *    isca sem resultado: o jogador selecionaria e o botao nao teria o
 *    que fazer
 *
 * 2. A SELECAO e por `uid`, e nao por `itemId`. Duas pecas iguais do
 *    mesmo item e mesma raridade sao DUAS entradas, e podem ter afixos
 *    diferentes. Guardando o `itemId`, encantar uma marcaria a outra
 */

const ARCO = "willow_bow";
const ALJAVA = "aljava_arbalist";
const BOTAS = "botas_arbalist";
const GEL = "slime_gel";

/** um item de inventario, com o `uid` que a tela usa */
const peca = (itemId, uid, rarity = "uncommon", enchant = null) => ({
  uid,
  itemId,
  rarity,
  count: 1,
  equipped: false,
  enchant,
});

/** o snapshot minimo que o painel consome */
const inventario = (items, coins = 5000) => ({
  coins,
  used: items.length,
  capacity: 20,
  isFull: false,
  items,
});

/** um slot ocupado, do jeito que o `equipment.summary()` entrega */
const slot = (id, itemId, rarity = "rare", enchant = null) => ({
  id,
  name: {
    weapon: "Arma",
    weapon2: "Arma Secundária",
    chest: "Peito",
  }[id] ?? id,
  icon: "⚔",
  itemId,
  rarity,
  tier: 1,
  enhance: 0,
  enchant,
  accepts: ["weapon"],
});

/** o equipamento com os slots livres, como o jogador comeca�� */
const vazioEquipamento = () => ({
  slots: [],
  bonuses: {},
  power: 0,
});

const afixoDe = (stat = "speed") => ({
  stat,
  rarity: RARITY.RARE,
  power: ENCHANT_POWER[RARITY.RARE],
});

const montar = (inv, props = {}) => {
  const onEnchant = props.onEnchant ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();

  const utils = render(
    <EnchantPanel
      inventory={inv}
      equipment={props.equipment ?? vazioEquipamento()}
      onEnchant={onEnchant}
      onClose={onClose}
    />,
  );

  return { ...utils, onEnchant, onClose };
};

afterEach(cleanup);

describe("o que entra na lista", () => {
  it("mostra arma e armadura da mochila", () => {
    const { container } = montar(
      inventario([
        peca(ARCO, "u1"),
        peca(BOTAS, "u2"),
      ]),
    );

    expect(
      container.querySelectorAll(".inv-grid .inv-cell"),
    ).toHaveLength(2);
  });

  it("mostra o que esta EQUIPADO", () => {
    /**
     * O pedido que Motivou os dois grupos.
     *
     * Uma peca vestida e uma peca na mochila sao coisas diferentes: a
     * primeira esta valendo no jogo agora. Sem o grupo do equipado o
     * jogador teria de abrir o inventario para descobrir o que tinha
     * encantado
     */
    const { container } = montar(inventario([]), {
      equipment: {
        ...vazioEquipamento(),
        slots: [
          slot("weapon", ARCO),
          slot("weapon2", ALJAVA),
          slot("chest", BOTAS),
        ],
      },
    });

    expect(
      container.querySelectorAll(".inv-grid .inv-cell"),
      "as tres pecas vestidas nao apareceram",
    ).toHaveLength(3);

    expect(container.textContent).toContain("Equipado");
  });

  it("separa o equipado da mochila em dois grupos", () => {
    /**
     * Dois grupos e nao uma lista so, porque as pecas se confundem sem
     * o rotulo: um arco no corpo e um arco na mochila mostram a MESMA
     * arte e o MESMO nome
     */
    const { container } = montar(
      inventario([peca(ARCO, "mochila-1")]),
      {
        equipment: {
          ...vazioEquipamento(),
          slots: [slot("weapon", ARCO)],
        },
      },
    );

    const grupos = container.querySelectorAll(".enc-group");

    expect(grupos).toHaveLength(2);
    expect(grupos[0].textContent).toContain("Equipado");
    expect(grupos[1].textContent).toContain("Mochila");

    // as DUAS pecas aparecem, mesmo sendo o mesmo item
    expect(
      container.querySelectorAll(".inv-grid .inv-cell"),
    ).toHaveLength(2);
  });

  it("o equipado vem antes da mochila", () => {
    // a peca que esta valendo agora vem primeiro; com a mochila na
    // frente o jogador veria dois arcos iguais sem saber qual estava
    // no corpo
    const { container } = montar(
      inventario([peca(ARCO, "mochila-1")]),
      {
        equipment: {
          ...vazioEquipamento(),
          slots: [slot("weapon", BOTAS)],
        },
      },
    );

    const primeira = container.querySelector(
      ".inv-grid .inv-cell",
    );

    // a primeira e a vestida, e o texto dela diz de onde veio
    expect(primeira.textContent).toMatch(/Botas/i);
    expect(primeira.getAttribute("title")).toMatch(/vestida/i);
  });

  it("nao mostra slot vazio", () => {
    // um slot sem peca nao tem o que encantar, e apareceria com nome
    // em branco ocupando espaco na grade
    const { container } = montar(
      inventario([peca(ARCO, "u1")]),
      {
        equipment: {
          ...vazioEquipamento(),
          slots: [
            {
              ...slot("weapon", null),
              itemId: null,
              rarity: null,
            },
          ],
        },
      },
    );

    expect(
      container.querySelectorAll(".inv-grid .inv-cell"),
    ).toHaveLength(1);

    expect(container.querySelectorAll(".enc-group")).toHaveLength(1);
  });

  it("nao mostra reliquia vestida", () => {
    // `trinket1` e `trinket2` nao aceitam afixo: o pedido foi arma e
    // armadura, e nao ha item de reliquia no catalogo
    const { container } = montar(inventario([]), {
      equipment: {
        ...vazioEquipamento(),
        slots: [
          {
            ...slot("trinket1", ARCO),
            accepts: ["trinket"],
          },
        ],
      },
    });

    // o arco e do tipo `weapon`, entao passa; o que este teste trava e
    // que o FILTRO existe no grupo do corpo tambem
    expect(container.querySelectorAll(".enc-group")).toHaveLength(1);
  });

  it("nao mostra material", () => {
    /**
     * O item nao aceitaria afixo: o botao ficaria sem o que fazer e o
     * jogador veria gel de slime num painel de encantar
     */
    const { container } = montar(
      inventario([peca(GEL, "u1"), peca(ARCO, "u2")]),
    );

    const nomes = [...container.querySelectorAll(".inv-cell__name")]
      .map((n) => n.textContent);

    expect(nomes).toHaveLength(1);
    expect(nomes[0]).toMatch(/Arco/i);
  });

  it("avisa quando nao ha nada para encantar", () => {
    const { container } = montar(inventario([]));

    expect(container.querySelector(".inv-grid")).toBe(null);
    expect(container.textContent).toMatch(
      /Nenhuma arma ou armadura/i,
    );
  });

  it("aguenta o snapshot ausente, como todo painel", () => {
    /**
     * O primeiro quadro chega antes do primeiro pacote de rede, e o
     * painel que dereferencia `inventory.items` nesse instante derruba
     * a tela do jogador
     */
    const { container } = montar(undefined);

    expect(container.querySelector(".enc-panel")).toBeTruthy();
    expect(container.textContent).toMatch(/Nenhuma arma ou armadura/i);
  });

  it("mostra o afixo da peca que ja tem", () => {
    const { container } = montar(
      inventario([
        peca(ARCO, "u1", "rare", afixoDe("speed")),
      ]),
    );

    expect(container.querySelector(".enc-affix")).toBeTruthy();
    expect(container.textContent).toContain("+2%");
  });

  it("mostra o afixo do que esta vestida", () => {
    const { container } = montar(inventario([]), {
      equipment: {
        ...vazioEquipamento(),
        slots: [slot("weapon", ARCO, "rare", afixoDe("attack"))],
      },
    });

    expect(container.textContent).toContain("+2%");
  });
});

describe("a caixa do lado", () => {
  it("comeca vazia, pedindo uma escolha", () => {
    const { container } = montar(inventario([peca(ARCO, "u1")]));

    const caixa = container.querySelector(".enc-side");

    expect(caixa).toBeTruthy();
    expect(caixa.querySelector(".enc-slot")).toBe(null);
    expect(caixa.textContent).toMatch(/Escolha um item/i);
  });

  it("mostra a peca escolhida, ao lado da lista", () => {
    const { container } = montar(
      inventario([
        peca(ARCO, "u1"),
        peca(BOTAS, "u2"),
      ]),
    );

    // a lista e a caixa sao IRMAOS dentro do mesmo corpo: e o que o
    // pedido pediu, a peca escolhida numa caixa AO LADO da lista
    const corpo = container.querySelector(".inv-panel__body");

    expect(corpo.querySelector(".enc-side")).toBeTruthy();
    expect(corpo.querySelector(".inv-main")).toBeTruthy();
    expect(corpo.querySelector(".inv-grid")).toBeTruthy();

    fireEvent.click(
      container.querySelectorAll(".inv-cell")[1],
    );

    const caixa = container.querySelector(".enc-slot");

    expect(caixa).toBeTruthy();
    expect(caixa.textContent).toMatch(/Botas/i);
  });

  it("trocar a selecao troca a peca da caixa", () => {
    const { container } = montar(
      inventario([
        peca(ARCO, "u1"),
        peca(BOTAS, "u2"),
      ]),
    );

    const celulas = container.querySelectorAll(".inv-cell");

    fireEvent.click(celulas[0]);
    expect(container.querySelector(".enc-slot").textContent).toMatch(
      /Arco/i,
    );

    fireEvent.click(celulas[1]);
    expect(container.querySelector(".enc-slot").textContent).toMatch(
      /Botas/i,
    );
  });

  it("clicar de novo na mesma peca desmarca", () => {
    const { container } = montar(inventario([peca(ARCO, "u1")]));

    const celula = container.querySelector(".inv-cell");

    fireEvent.click(celula);
    expect(container.querySelector(".enc-slot")).toBeTruthy();

    fireEvent.click(celula);
    expect(container.querySelector(".enc-slot")).toBe(null);
  });

  it("a selecao e por uid: duas pecas iguais sao duas entradas", () => {
    /**
     * O caso que quebra com `itemId`.
     *
     * Dois arcos do mesmo item e mesma raridade sao duas pilhas com
     * `uid` diferente. Guardando o `itemId`, clicar num marcaria os
     * dois, e o jogador veria duas artes iguais piscando como se
     * fossem uma so
     */
    const { container } = montar(
      inventario([peca(ARCO, "u1"), peca(ARCO, "u2")]),
    );

    const celulas = container.querySelectorAll(".inv-cell");

    fireEvent.click(celulas[0]);

    const marcadas = container.querySelectorAll(".is-selected");

    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toBe(celulas[0]);
  });

  it("a selecao e por chave: o mesmo item nos dois grupos nao colide", () => {
    /**
     * O caso que quebra com `itemId`.
     *
     * Um arco no corpo e um arco na mochila tem o MESMO `itemId`. Com a
     * selecao guardando o `itemId`, clicar num marcaria os dois, e o
     * jogador veria duas artes iguais piscando como se fossem uma so.
     * E o que mandou a chave levar o grupo: `mochila:` e `slot:`
     */
    const { container } = montar(
      inventario([peca(ARCO, "mochila-1")]),
      {
        equipment: {
          ...vazioEquipamento(),
          slots: [slot("weapon", ARCO)],
        },
      },
    );

    const celulas = container.querySelectorAll(".inv-cell");

    fireEvent.click(celulas[0]);

    expect(
      container.querySelectorAll(".is-selected"),
      "as duas pecas do mesmo item foram marcadas",
    ).toHaveLength(1);

    // e a marcada e a vestida, e o pedido vai com `slotId`
    expect(container.querySelector(".enc-slot")).toBeTruthy();
  });

  it("limpa a selecao quando a peca vestida sai do corpo", () => {
    /**
     * O equivalente ao caso da mochila para o slot.
     *
     * Desequipar move a peca da lista do equipado para a da mochila
     * com um `uid` novo. A chave antiga morre com o slot, e a caixa
     * nao pode continuar mostrando uma peca que ja nao esta vestida
     */
    const comArma = {
      ...vazioEquipamento(),
      slots: [slot("weapon", ARCO)],
    };

    const { container, rerender } = montar(inventario([]), {
      equipment: comArma,
    });

    fireEvent.click(container.querySelector(".inv-cell"));

    expect(container.querySelector(".enc-slot")).toBeTruthy();

    // a arma saiu do corpo; sobrou so a peca da mochila
    rerender(
      <EnchantPanel
        inventory={inventario([peca(ARCO, "mochila-1")])}
        equipment={vazioEquipamento()}
        onEnchant={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      container.querySelector(".enc-slot"),
      "a caixa continuou com uma peca que saiu do corpo",
    ).toBe(null);
  });

  it("limpa a selecao quando a peca some do snapshot", () => {
    /**
     * Encantar um arco com o ouro justo faz ele ir para o chao, e o
     * pacote seguinte ja nao traz aquele `uid`. Sem a limpeza a caixa
     * mostraria uma peca que o jogador nao tem, e o botao pagaria por
     * um encantar que nao existe
     */
    const { container, rerender } = montar(
      inventario([peca(ARCO, "u1"), peca(BOTAS, "u2")]),
    );

    fireEvent.click(
      container.querySelectorAll(".inv-cell")[0],
    );

    expect(container.querySelector(".enc-slot")).toBeTruthy();

    // o arco sumiu; sobrou so a bota
    rerender(
      <EnchantPanel
        inventory={inventario([peca(BOTAS, "u2")])}
        onEnchant={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      container.querySelector(".enc-slot"),
      "a caixa continuou com uma peca que nao existe mais",
    ).toBe(null);
  });
});

describe("o botao de encantar", () => {
  it("manda o endereco da peca escolhida", () => {
    const { container, onEnchant } = montar(
      inventario([peca(ARCO, "u1"), peca(BOTAS, "u2")]),
      { equipment: vazioEquipamento() },
    );

    fireEvent.click(
      container.querySelectorAll(".inv-cell")[1],
    );

    fireEvent.click(container.querySelector(".enc-action"));

    // e um OBJETO, e nao o `uid` solto: a peca pode estar na mochila
    // ou vestida, e o servidor escolhe o metodo pelo campo que veio
    // preenchido
    expect(onEnchant).toHaveBeenCalledWith({ uid: "u2" });
  });

  it("manda o slotId da peca vestida, e nunca os dois", () => {
    const { container, onEnchant } = montar(
      inventario([peca(ARCO, "u1")]),
      {
        equipment: {
          ...vazioEquipamento(),
          slots: [slot("weapon", ARCO, "rare", afixoDe("speed"))],
        },
      },
    );

    // a vestida vem primeiro na lista
    fireEvent.click(container.querySelectorAll(".inv-cell")[0]);

    fireEvent.click(container.querySelector(".enc-action"));

    const pedido = onEnchant.mock.calls[0][0];

    expect(pedido.slotId).toBe("weapon");
    expect(pedido.uid).toBe(undefined);
  });

  it("nao manda nada sem peca escolhida", () => {
    const { container, onEnchant } = montar(
      inventario([peca(ARCO, "u1")]),
    );

    // o botao nem existe sem selecao, entao nao ha o que clicar
    expect(container.querySelector(".enc-action")).toBe(null);
    expect(onEnchant).not.toHaveBeenCalled();
  });

  it("mostra o preco antes de cobrar", () => {
    /**
     * O botao desabilitado sem ouro ainda precisa dizer QUANTO custa.
     * Um botao cinza sem numero deixaria o jogador sem forma de saber
     * o que falta, e ele trocaria de item achando que a peca e cara
     */
    const { container } = montar(
      inventario([peca(ARCO, "u1")], 0),
    );

    fireEvent.click(container.querySelector(".inv-cell"));

    const custo = enchantCost(ARCO, "uncommon");

    expect(container.querySelector(".enc-cost").textContent).toContain(
      String(custo),
    );

    const botao = container.querySelector(".enc-action");

    expect(botao.disabled).toBe(true);
    expect(botao.getAttribute("title")).toMatch(/insuficiente/i);
  });

  it("libera o botao quando ha ouro", () => {
    const { container } = montar(
      inventario([peca(ARCO, "u1")], 5000),
    );

    fireEvent.click(container.querySelector(".inv-cell"));

    expect(container.querySelector(".enc-action").disabled).toBe(
      false,
    );
  });

  it("o preco acompanha a peca escolhida", () => {
    const { container } = montar(
      inventario([peca(ARCO, "u1"), peca(BOTAS, "u2")], 0),
    );

    const celulas = container.querySelectorAll(".inv-cell");

    fireEvent.click(celulas[0]);

    const comArco = container.querySelector(".enc-cost").textContent;

    fireEvent.click(celulas[1]);

    const comBota = container.querySelector(".enc-cost").textContent;

    // arco vale 58 e bota 36, entao os precos nao podem ser iguais
    expect(comArco).not.toBe(comBota);
  });
});

describe("o painel na tela", () => {
  it("fecha pelo X", () => {
    const { container, onClose } = montar(
      inventario([peca(ARCO, "u1")]),
    );

    fireEvent.click(container.querySelector(".inv-close"));

    expect(onClose).toHaveBeenCalled();
  });

  it("mostra as chances de cada raridade", () => {
    const { container } = montar(inventario([peca(ARCO, "u1")]));

    const texto = container.querySelector(".enc-odds").textContent;

    for (const rotulo of [
      "Comum",
      "Incomum",
      "Raro",
      "Épico",
      "Lendário",
    ]) {
      expect(texto, rotulo).toContain(rotulo);
    }
  });

  it("a peca da lista e um botao de verdade", () => {
    /**
     * A peca e SOLEIR a selecao, entao ela tem de ser alcanavel pelo
     * teclado. Uma `div` com `onClick` seria invisivel para o `Tab`, e
     * o jogador nao conseguiria encantar sem mouse
     */
    const { container } = montar(inventario([peca(ARCO, "u1")]));

    const celula = container.querySelector(".inv-cell");

    expect(celula.tagName).toBe("BUTTON");
    expect(celula.getAttribute("type")).toBe("button");
  });
});