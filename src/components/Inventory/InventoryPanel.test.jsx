import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import InventoryPanel, {
  FilterPanel,
  ItemSlot,
  SlotMenu,
} from "./InventoryPanel.jsx";

const INVENTORY = {
  coins: 361,
  used: 3,
  capacity: 20,
  isFull: false,
  items: [
    { uid: "ember_blade#1", itemId: "ember_blade", count: 1 },
    { uid: "dummy_wood#2", itemId: "dummy_wood", count: 12 },
    {
      uid: "frost_ward#3",
      itemId: "frost_ward",
      count: 1,
      equipped: true,
    },
  ],
};

const EQUIPMENT = {
  slots: [
    {
      id: "weapon",
      name: "Arma",
      icon: "⚔",
      itemId: null,
      accepts: ["weapon"],
    },
    {
      id: "head",
      name: "Cabeça",
      icon: "⛑",
      itemId: "hunter_hood",
      accepts: ["armor"],
    },
    {
      id: "chest",
      name: "Peito",
      icon: "⛊",
      itemId: null,
      accepts: ["armor"],
    },
    {
      id: "legs",
      name: "Pernas",
      icon: "⛉",
      itemId: null,
      accepts: ["armor"],
    },
    {
      id: "trinket1",
      name: "Anel",
      icon: "◈",
      itemId: "frost_ward",
      accepts: ["trinket"],
    },
    {
      id: "trinket2",
      name: "Amuleto",
      icon: "❖",
      itemId: null,
      accepts: ["trinket"],
    },
  ],
  bonuses: { attack: 12, defense: 4 },
  power: 160,
};

const PLAYER = { hp: 118, maxHp: 120 };

function render(props = {}) {
  return renderToStaticMarkup(
    <InventoryPanel
      inventory={INVENTORY}
      equipment={EQUIPMENT}
      player={PLAYER}
      onClose={() => {}}
      onEquip={() => {}}
      onUnequip={() => {}}
      onDiscardItem={() => {}}
      onDiscardEquipped={() => {}}
      onAutoEquip={() => {}}
      onFilterChange={() => {}}
      onFilterReset={() => {}}
      onFilterPrune={() => {}}
      {...props}
    />,
  );
}

describe("InventoryPanel", () => {
  it("usa o layout OSRS: abas, boneco, mochila e barra de status", () => {
    const html = render();

    expect(html).toContain('class="inv-tabs"');
    expect(html).toContain('class="inv-illus"');
    expect(html).toContain('class="inv-main"');
    expect(html).toContain('class="inv-status"');
    expect(html).toContain('class="inv-grid"');
  });

  it("posiciona as pecas do boneco nas areas do grid", () => {
    const html = render();

    expect(html).toContain("grid-area:head");
    expect(html).toContain("grid-area:weapon");
    expect(html).toContain("grid-area:trinket2");
  });

  it("mostra o equipamento vestido e marca os slots vazios", () => {
    const html = render();

    expect(html).toContain("inv-slot--uncommon is-equipped is-compact");
    expect(html).toContain("inv-slot inv-slot--empty");
    expect(html).toContain("vazio");
    expect(html).toContain("Peito");
  });

  it("mostra hp e moedas na barra de status", () => {
    const html = render();

    expect(html).toContain("118");
    expect(html).toContain("120");
    expect(html).toContain("361");
    expect(html).toContain('class="inv-status__fill" style="width:98.33333333333333%"');
  });

  it("agrupa a mochila em uma grade unica ordenada por raridade", () => {
    const html = render();
    const groups = html.match(/class="inv-group"/g) ?? [];

    expect(groups).toHaveLength(0);
    expect(html).toContain('class="inv-grid"');

    const names = [...html.matchAll(/class="inv-cell__name">([^<]+)</g)].map(
      (match) => match[1],
    );

    // ember_blade (epico) antes de frost_ward (raro) e dummy_wood (comum)
    expect(names[0]).toBe("Lâmina de Brasa");
    expect(names[1]).toBe("Guarda de Gelo");
    expect(names[2]).toBe("Madeira de Treino");
  });

  it("exibe a contagem de itens empilhados", () => {
    const html = render();

    expect(html).toContain('class="inv-slot__count">12</span>');
  });

  it("aguenta snapshot vazio", () => {
    const html = render({ inventory: null, equipment: null, player: null });

    expect(html).toContain('class="inv-panel"');
    expect(html).toContain("Nenhum item nesta categoria.");
  });
});

describe("menu de acao do item", () => {
  it("comeca fechado, sem menu nem backdrop", () => {
    const html = render();

    expect(html).not.toContain("inv-menu");
    expect(html).not.toContain("inv-menu__backdrop");
  });

  it("abre com equipar e excluir em item equipavel", () => {
    const html = renderToStaticMarkup(
      <ItemSlot
        entry={{ uid: "ember_blade#1", itemId: "ember_blade", count: 1 }}
        onEquip={() => {}}
        onDiscardItem={() => {}}
        menuOpen
        onToggleMenu={() => {}}
      />,
    );

    expect(html).toContain("is-menu");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain(">Equipar<");
    expect(html).toContain(">Excluir<");
    expect(html).toContain("inv-menu__action is-danger");
  });

  it("nao oferece equipar em material", () => {
    const html = renderToStaticMarkup(
      <ItemSlot
        entry={{ uid: "dummy_wood#2", itemId: "dummy_wood", count: 12 }}
        onEquip={() => {}}
        onDiscardItem={() => {}}
        menuOpen
        onToggleMenu={() => {}}
      />,
    );

    expect(html).toContain(">Excluir<");
    expect(html).not.toContain(">Equipar<");
  });

  it("oferece desequipar e excluir em peca vestida", () => {
    const html = renderToStaticMarkup(
      <ItemSlot
        entry={{
          itemId: "frost_ward",
          count: 1,
          slotId: "trinket1",
          equipped: true,
        }}
        onUnequip={() => {}}
        onDiscardEquipped={() => {}}
        compact
        menuOpen
        onToggleMenu={() => {}}
      />,
    );

    expect(html).toContain(">Desequipar<");
    expect(html).toContain(">Excluir<");
    expect(html).not.toContain(">Equipar<");
  });

  it("some quando o slot nao esta aberto", () => {
    const html = renderToStaticMarkup(
      <ItemSlot
        entry={{ uid: "ember_blade#1", itemId: "ember_blade", count: 1 }}
        onEquip={() => {}}
        onDiscardItem={() => {}}
        onToggleMenu={() => {}}
      />,
    );

    expect(html).not.toContain("inv-menu");
    expect(html).not.toContain("is-menu");
    expect(html).toContain('aria-expanded="false"');
  });

  it("ancora o menu a esquerda no boneco e centralizado na mochila", () => {
    const left = renderToStaticMarkup(
      <SlotMenu actions={[{ id: "a", label: "X", run: () => {} }]} align="left" />,
    );

    const center = renderToStaticMarkup(
      <SlotMenu actions={[{ id: "a", label: "X", run: () => {} }]} align="center" />,
    );

    expect(left).toContain("inv-menu inv-menu--left");
    expect(center).toContain("inv-menu inv-menu--center");
  });

  it("nao desenha menu sem acoes", () => {
    const html = renderToStaticMarkup(
      <SlotMenu actions={[]} align="center" />,
    );

    expect(html).toBe("");
  });
});

describe("filtro de coleta", () => {
  function renderFilter(filter) {
    return renderToStaticMarkup(
      <FilterPanel
        filter={{
          equipment: null,
          material: null,
          ...filter,
        }}
        onChange={() => {}}
        onReset={() => {}}
        onPrune={() => {}}
        onClose={() => {}}
      />,
    );
  }

  it("tem o botao de configuracao na barra de abas", () => {
    const html = render();

    expect(html).toContain("inv-gear");
    expect(html).not.toContain("inv-filter");
  });

  it("explica que o item barrado nao dropara", () => {
    const html = renderFilter({});

    expect(html).toContain("Filtro de coleta");
    expect(html).toContain("não dropara");
    expect(html).toContain("não entra na mochila");
  });

  it("lista as duas categorias", () => {
    const html = renderFilter({});

    expect(html).toContain("Equipamento");
    expect(html).toContain("Material");
  });

  it("oferece Tudo mais todas as raridades", () => {
    const html = renderFilter({});

    expect(html).toContain(">Tudo<");
    expect(html).toContain(">Comum<");
    expect(html).toContain(">Incomum<");
    expect(html).toContain(">Raro<");
    expect(html).toContain(">Épico<");
    expect(html).toContain(">Lendário<");
  });

  it("marca a raridade escolhida em cada categoria", () => {
    const html = renderFilter({
      equipment: "epic",
      material: null,
    });

    expect(html).toMatch(
      /class="inv-filter__choice is-active" style="--rarity:#c489ff">Épico</,
    );

    expect(html).toMatch(
      /class="inv-filter__choice is-active">Tudo</,
    );
  });

  it("trata filtro invalido como coleta tudo", () => {
    const html = renderFilter({ equipment: "dourado" });

    expect(html).toContain("Filtro de coleta");
    expect(html).toMatch(
      /class="inv-filter__choice is-active">Tudo</,
    );
  });

  it("oferece limpar a mochila e voltar ao padrao", () => {
    const html = renderFilter({});

    expect(html).toContain("Limpar mochila");
    expect(html).toContain("Padrão");
  });

  it("avisa na barra de status quando ha filtro ativo", () => {
    const inactive = render();

    expect(inactive).not.toContain("inv-status__filter");

    const active = render({
      lootFilter: { equipment: "epic", material: null },
    });

    expect(active).toContain("inv-status__filter");
    expect(active).toContain("is-filtering");
  });
});