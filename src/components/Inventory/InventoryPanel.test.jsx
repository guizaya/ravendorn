import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import InventoryPanel, {
  FilterPanel,
  ItemSlot,
  SlotMenu,
  TABS as TABS_COM_RUNAS,
} from "./InventoryPanel.jsx";

const INVENTORY = {
  coins: 361,
  used: 3,
  capacity: 20,
  isFull: false,
  items: [
    { uid: "slime_gel#1", itemId: "slime_gel", count: 4 },
    { uid: "dummy_wood#2", itemId: "dummy_wood", count: 12 },
    {
      uid: "ghoul_claw#3",
      itemId: "ghoul_claw",
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
      itemId: "willow_bow",
      accepts: ["weapon"],
    },
    {
      id: "weapon2",
      name: "Arma Secundária",
      icon: "🗡",
      itemId: null,
      accepts: ["weapon"],
    },
    {
      id: "head",
      name: "Cabeça",
      icon: "⛑",
      itemId: null,
      accepts: ["armor"],
    },
    {
      id: "gloves",
      name: "Luvas",
      icon: "🧤",
      itemId: null,
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
      name: "Calças",
      icon: "⛉",
      itemId: null,
      accepts: ["armor"],
    },
    {
      id: "boots",
      name: "Botas",
      icon: "👢",
      itemId: null,
      accepts: ["armor"],
    },
    {
      id: "trinket1",
      name: "Anel",
      icon: "◈",
      itemId: null,
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

  it("tem a aba de runas, e ela nao mostra item nenhum", () => {
    // A aba existe e ainda nao mostra nada. O `types` vazio e o que
    // garante: com `null` o filtro devolveria TUDO e a aba seria uma
    // copia da aba "Tudo"
    const html = render();

    expect(html).toContain("Runas");
    expect(html).toContain('title="Runas"');

    // a aba existe na barra: o `title` acima ja prova, mas o icone
    // runico precisa estar la tambem
    expect(html).toContain("ᚱ");
  });

  it("a aba de runas abre vazia, e nao com o catalogo inteiro", () => {
    // o estado inicial e a aba "Tudo", entao a de runas so e
    // exercitada pelo filtro. Aqui o que importa e que o `types`
    // dela seja `[]` e nao `null`: um `null` faria `visible` devolver
    // todas as entradas e a aba viraria um duplicado da "Tudo"
    const runas = TABS_COM_RUNAS.find(
      (tab) => tab.id === "rune",
    );

    expect(runas, "a aba de runas nao esta na lista").toBeTruthy();

    // `null` devolve tudo; `[]` devolve nada
    expect(runas.types, "types nao e lista").toBeInstanceOf(Array);
    expect(runas.types.length).toBe(0);
  });

  it("posiciona as pecas do boneco nas areas do grid", () => {
    const html = render();

    expect(html).toContain("grid-area:head");
    expect(html).toContain("grid-area:weapon");
    expect(html).toContain("grid-area:trinket2");

    // as areas novas: arma secundaria, luvas e botas. Sem elas no
    // `DOLL_AREA`, o slot e desenhado sem `grid-area` e o boneco
    // empilha as pecas todas no mesmo lugar
    expect(html).toContain("grid-area:weapon2");
    expect(html).toContain("grid-area:gloves");
    expect(html).toContain("grid-area:boots");
  });

  it("desenha os nove slots, com nome e vazio", () => {
    const html = render();

    // Conta so o boneco, pela `grid-area`: cada slot vestido ou
    // vazio sai um. Contar por `inv-slot--` pegaria tambem as celulas
    // da mochila, que usam a mesma classe
    const slots = [
      ...html.matchAll(/grid-area:[a-z0-9]+/g),
    ].length;

    expect(slots).toBe(9);

    for (const nome of [
      "Arma",
      "Arma Secundária",
      "Cabeça",
      "Luvas",
      "Peito",
      "Calças",
      "Botas",
      "Anel",
      "Amuleto",
    ]) {
      expect(html, nome).toContain(nome);
    }
  });

  it("mostra o equipamento vestido e marca os slots vazios", () => {
    const html = render();

    expect(html).toContain("inv-slot--uncommon is-equipped is-compact");
    expect(html).toContain("inv-slot inv-slot--empty");
    expect(html).toContain("vazio");
    expect(html).toContain("Peito");
  });

  it("todo slot vazio sai cinza, e nenhum glifo escapa", () => {
    // O `color` do slot vazio e cinza, mas o glifo de LUVAS (`🧤`) e
    // de BOTAS (`👢`) sao EMOJI, e emoji nao obedece a `color`: o
    // navegador desenhava a luva e a bota na cor original enquanto os
    // slots de texto (`⚔`, `⛊`, `⛉`) ficavam cinza. A correcao e um
    // `grayscale` no icone do slot vazio
    const html = render();

    // todo slot vazio precisa estar dentro do container que recebe o
    // filtro. Um slot vazio sem `inv-slot__icon` nao mostraria nada, e
    // um sem `inv-slot--empty` escaparia do cinza
    const vazios = [
      ...html.matchAll(
        /class="inv-slot inv-slot--empty"[^>]*>\s*<span class="inv-slot__icon">/g,
      ),
    ];

    expect(
      vazios.length,
      "slots vazios sem o icone dentro da classe esperada",
    ).toBeGreaterThan(0);
  });

  it("os glifos de slot vazio sao os do catalogo de slots", () => {
    // Se um slot novo receber um emoji, o `grayscale` continua
    // funcionando — mas este teste avisa que existe glifo de emoji no
    // catalogo, que e o que o filtro do CSS resolve
    const html = render();

    // o glifo de cada slot vazio tem que estar no HTML. Este teste nao
    // trava a cor: a cor e do CSS, e o `grayscale` e a garantia
    for (const glifo of ["⚔", "⛑", "⛊", "⛉", "🧤", "👢"]) {
      expect(html, glifo).toContain(glifo);
    }
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

    // Uma mochila com raridades distintas, para a ordem dizer algo.
    // O catalogo de hoje tem `skeleton_skull` (rare), `ghoul_claw`
    // (incomum) e `dummy_wood` (comum): a ordem tem de ser essa, do
    // melhor para o pior
    const ordenada = render({
      inventory: {
        coins: 0,
        used: 3,
        capacity: 20,
        isFull: false,
        items: [
          { uid: "a#1", itemId: "dummy_wood", count: 1 },
          { uid: "a#2", itemId: "skeleton_skull", count: 1 },
          { uid: "a#3", itemId: "ghoul_claw", count: 1 },
        ],
      },
    });

    const names = [
      ...ordenada.matchAll(
        /class="inv-cell__name">([^<]+)</g,
      ),
    ].map((match) => match[1]);

    expect(names).toEqual([
      "Crânio Antigo",
      "Garra de Ghoul",
      "Madeira de Treino",
    ]);
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

/**
 * A arte do arco de galho, e a raridade da variante que escolhe o
 * arquivo.
 *
 * O arco e o item com `rarity: uncommon` no catalogo, e o craft
 * entrega o MESMO arco nas cinco raridades. As duas entradas abaixo
 * sao o mesmo `itemId` com `rarity` diferente de proposito: e
 * exatamente o caso que quebra se o slot ler a raridade do catalogo,
 * porque as duas sairiam com a mesma imagem
 */
const ARCO = {
  coins: 10,
  used: 2,
  capacity: 20,
  isFull: false,
  items: [
    {
      uid: "willow_bow#rare#1",
      itemId: "willow_bow",
      rarity: "rare",
      count: 1,
    },
    {
      uid: "willow_bow#legendary#2",
      itemId: "willow_bow",
      rarity: "legendary",
      count: 1,
    },
  ],
};

const srcDoArco = (html, arquivo) =>
  [...html.matchAll(/<img[^>]*src="([^"]+)"/g)]
    .map((match) => match[1])
    .find((src) => src.includes(arquivo));

describe("o icone desenhado no slot", () => {
  it("escolhe a arte pela raridade da variante", () => {
    const html = render({ inventory: ARCO, equipment: null });

    // `rare.png` e `legendary.png` no mesmo HTML: a raridade decide
    expect(srcDoArco(html, "rare.png")).toBeTruthy();
    expect(srcDoArco(html, "legendary.png")).toBeTruthy();
  });

  it("NAO usa a raridade do catalogo", () => {
    const html = render({ inventory: ARCO, equipment: null });

    // o arco e `uncommon` no catalogo. Se o slot lesse o catalogo,
    // as duas entradas sairiam com `incomun.png` e nenhuma das duas
    // artes variantes apareceria
    expect(srcDoArco(html, "incomun.png")).toBeUndefined();
  });

  it("a cor do slot e a da variante, e nao a do catalogo", () => {
    const html = render({ inventory: ARCO, equipment: null });

    // sem isto o arco lendario mostraria a arte dourada com a
    // moldura da raridade base dele
    expect(html).toContain('class="inv-slot inv-slot--legendary');
    expect(html).toContain('class="inv-slot inv-slot--rare');
    expect(html).toContain("Lendário");
    expect(html).toContain("Raro");
  });

  it("item sem arte continua no glifo", () => {
    const html = render();

    // `ember_blade` e `dummy_wood` nao tem pasta de arte. Um `<img>`
    // com `src` vazio ou quebrado apareceria aqui
    const imgs = [...html.matchAll(/<img[^>]*src="([^"]*)"/g)];

    for (const [, src] of imgs) {
      expect(src).toContain("assets/Items");
    }
  });

  it("a peca vestida usa a raridade dela, e nao a do catalogo", () => {
    const html = render({
      equipment: {
        slots: [
          {
            id: "weapon",
            name: "Arma",
            icon: "🗡",
            itemId: "willow_bow",
            rarity: "legendary",
            accepts: ["weapon"],
          },
        ],
      },
    });

    // a entrada montada para o slot vestido nao trazia raridade, e
    // o slot caia na do catalogo: vestir um arco lendario mostrava
    // a arte da raridade base
    expect(srcDoArco(html, "legendary.png")).toBeTruthy();
    expect(srcDoArco(html, "incomun.png")).toBeUndefined();
  });
});

describe("menu de acao do item", () => {
  it("comeca fechado, sem menu nem backdrop", () => {
    const html = render();

    expect(html).not.toContain("inv-menu");
    expect(html).not.toContain("inv-menu__backdrop");
  });

  /**
   * O BOTAO DE USAR, que existe por causa do `use` do catalogo.
   *
   * E o que separa a pocao de um material comum no menu do slot. O
   * `ItemSlot` recebe um item e nao sabe o que e pocao: ele so olha o
   * `use`, e um item novo com efeito ganha o botao sem tocar nele
   */
  it("a pocao abre com usar, e sem equipar", () => {
    const html = renderToStaticMarkup(
      <ItemSlot
        entry={{ uid: "pocao#1", itemId: "pocao_cura", count: 2 }}
        onEquip={() => {}}
        onUseItem={() => {}}
        onDiscardItem={() => {}}
        menuOpen
        onToggleMenu={() => {}}
      />,
    );

    expect(html).toContain("is-menu");

    /**
     * O rotulo mostra QUANTO cura.
     *
     * E o que o jogador le antes de gastar a pocao. Com um rotulo
     * generico de "Usar", ele descobriria o valor so depois de perder
     * o item — e a Mochila cheia aqui seria o ultimo lugar para
     * descobrir
     */
    expect(html).toContain(">Usar · 120 de vida<");

    /**
     * Nao ha "Equipar" na pocao.
     *
     * `isEquippable` olha os slots do tipo, e `potion` nao tem nenhum.
     * Se a regra passasse a considerar `ITEM_TYPE.POTION` equipavel, a
     * pocao apareceria com "Equipar · Mao principal" e o clique
     * falharia em silencio
     */
    expect(html).not.toContain(">Equipar");
  });

  it("usar vem ANTES de excluir", () => {
    const html = renderToStaticMarkup(
      <ItemSlot
        entry={{ uid: "pocao#1", itemId: "pocao_cura", count: 2 }}
        onEquip={() => {}}
        onUseItem={() => {}}
        onDiscardItem={() => {}}
        menuOpen
        onToggleMenu={() => {}}
      />,
    );

    /**
     * A ordem do menu e o que decide se o jogador encontra o uso.
     *
     * "Excluir" primeiro com "Usar" embaixo faz o jogador procurar a
     * acao que ele quer no meio de um menu que comeca pela acao que ele
     * nao quer. E o `is-danger` do excluir ja os separa visualmente, o
     * que nao tira o problema da ordem
     */
    const usar = html.indexOf(">Usar");
    const excluir = html.indexOf(">Excluir");

    expect(usar).toBeGreaterThan(-1);
    expect(excluir).toBeGreaterThan(-1);
    expect(usar).toBeLessThan(excluir);
  });

  it("um item sem `use` NAO ganha o botao de usar", () => {
    const html = renderToStaticMarkup(
      <ItemSlot
        entry={{ uid: "slime#1", itemId: "slime_gel", count: 3 }}
        onEquip={() => {}}
        onUseItem={() => {}}
        onDiscardItem={() => {}}
        menuOpen
        onToggleMenu={() => {}}
      />,
    );

    /**
     * O gel de slime e material, e nao tem `use`.
     *
     * O botao de usar eachegado por `item.use`, e nao pelo tipo. Um
     * material que ganhasse o botao por ser empilhavel daria ao
     * jogador uma acao que nao faz nada — e o motor recusaria o uso
     * com um `false` silencioso
     */
    expect(html).not.toContain(">Usar");
  });

  it("sem o handler, o botao de usar nao aparece", () => {
    const html = renderToStaticMarkup(
      <ItemSlot
        entry={{ uid: "pocao#1", itemId: "pocao_cura", count: 2 }}
        onEquip={() => {}}
        onDiscardItem={() => {}}
        menuOpen
        onToggleMenu={() => {}}
      />,
    );

    /**
     * O `onUseItem` e opcional, e o item TEM `use`.
     *
     * Sem o handler nao ha para quem mandar o pedido, e um botao que
     * aparece e nao faz nada e pior do que um botao que nao aparece
     */
    expect(html).not.toContain(">Usar");
  });

  it("abre com equipar e excluir em item equipavel", () => {
    const html = renderToStaticMarkup(
      <ItemSlot
        entry={{ uid: "ember_blade#1", itemId: "willow_bow", count: 1 }}
        onEquip={() => {}}
        onDiscardItem={() => {}}
        menuOpen
        onToggleMenu={() => {}}
      />,
    );

    expect(html).toContain("is-menu");
    expect(html).toContain('aria-expanded="true"');

    // o rotulo diz ONDE a peca entra. A regra da posicao deixou de
    // ser obvio que o destino existe, entao o menu agora promete o
    // slot: `ember_blade` e uma arma, e arma so vai no slot de arma
    expect(html).toContain(">Equipar · Arma<");
    expect(html).toContain(">Excluir<");
    expect(html).toContain("inv-menu__action is-danger");
  });

  it("o rotulo de equipar diz o slot de destino", () => {
    const slotDe = (itemId) => {
      const html = renderToStaticMarkup(
        <ItemSlot
          entry={{ uid: "x#1", itemId, count: 1 }}
          onEquip={() => {}}
          onDiscardItem={() => {}}
          menuOpen
          onToggleMenu={() => {}}
        />,
      );

      return /Equipar · ([^<]+)</.exec(html)?.[1];
    };

    // O arco e a unica peca equipavel do catalogo, e ela vai no
    // slot de arma. O teste antigo conferia tres pecas de armadura
    // em slots diferentes (cabeca, peito, pernas), que sairam do
    // catalogo
    expect(slotDe("willow_bow")).toBe("Arma");
  });

  it("nao oferece equipar quando o item nao tem slot valido", () => {
    // a arma continua equipavel
    const arma = renderToStaticMarkup(
      <ItemSlot
        entry={{ uid: "y#1", itemId: "willow_bow", count: 1 }}
        onEquip={() => {}}
        onDiscardItem={() => {}}
        menuOpen
        onToggleMenu={() => {}}
      />,
    );

    expect(arma).toContain("Equipar ·");

    // e um material nao oferece a acao nenhuma
    const material = renderToStaticMarkup(
      <ItemSlot
        entry={{ uid: "z#1", itemId: "slime_gel", count: 3 }}
        onEquip={() => {}}
        onDiscardItem={() => {}}
        menuOpen
        onToggleMenu={() => {}}
      />,
    );

    expect(material).not.toContain("Equipar");
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
          itemId: "willow_bow",
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
        entry={{ uid: "ember_blade#1", itemId: "willow_bow", count: 1 }}
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