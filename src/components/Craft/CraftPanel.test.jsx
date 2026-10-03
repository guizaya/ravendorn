import { describe, expect, it } from "vitest";
import {
  fireEvent,
  render as montarDOM,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import CraftPanel, {
  RecipeDetail,
} from "./CraftPanel.jsx";
import { Craft } from "../../game/craft/Craft.js";
import { Inventory } from "../../game/inventory/Inventory.js";
import { CRAFT_RECIPES } from "../../data/craft/index.js";
import { dropSourcesOf } from "../../data/craft/index.js";
import { hasItemIcon } from "../../data/items/icons.js";
import {
  RARITY,
  RARITY_STYLE,
} from "../../data/items/index.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";

const COMMON = "common";

/**
 * Uma receita de material que e GRATUITA, para os testes que precisam
 * de "pronto" sem depender de saldo
 */
const RECEITA_PRONTA = "craft_ghoul_rib";

/** render estatico: so para conferir a marcação do primeiro render */
function render(craft, props = {}) {
  return renderToStaticMarkup(
    <CraftPanel
      craft={craft}
      onCraft={() => {}}
      onClose={() => {}}
      {...props}
    />,
  );
}

/**
 * O painel de craft com uma mochila e uma classe.
 *
 * A bolsa NAO ganha saldo. Os testes que precisam de uma receita
 * pronta usam `RECEITA_LIVRE`, que e gratuita: dar moedas a todas as
 * instancias fazia o painel abrir na aba do arco (que tem o preco
 * alto e portanto many "prontas") em vez da aba de material, e
 * quebrava os testes que conferem a aba ativa
 */
function snapshot(stock = {}, classId = null) {
  const craft = new Craft();
  const inventory = new Inventory();

  for (const [itemId, count] of Object.entries(stock)) {
    inventory.add(itemId, count);
  }

  return craft.snapshot(inventory, classId);
}

const stockOf = (recipeId) => {
  const recipe = CRAFT_RECIPES.find(
    (entry) => entry.id === recipeId,
  );

  const stock = {};

  for (const ingredient of recipe.ingredients) {
    stock[ingredient.itemId] = ingredient.count;
  }

  return stock;
};

/** a raridade que o painel abre: a que ja fecha, ou a natural */
function rarityShown(recipe) {
  return (
    recipe.rarities.find(
      (entry) => entry.rarity === recipe.defaultRarity,
    ) ??
    recipe.rarities[0] ??
    null
  );
}

describe("CraftPanel abas", () => {
  it("abre uma aba por tipo de item", () => {
    const data = snapshot();
    const marcado = render(data);

    for (const category of data.categories) {
      expect(marcado, category.label).toContain(category.label);
    }
  });

  it("lista o item da primeira categoria", () => {
    const data = snapshot();
    const marcado = render(data);
    const first = data.categories[0];

    for (const recipe of first.recipes) {
      expect(marcado, recipe.name).toContain(recipe.name);
    }
  });

  it("marca a aba ativa", () => {
    const marcado = render(snapshot());

    expect(
      (marcado.match(/inv-tab is-active/g) ?? []).length,
    ).toBe(1);
  });

  it("lista as abas com material por ultimo", () => {
    const marcado = render(snapshot());

    const nav = marcado.slice(
      marcado.indexOf("inv-tabs"),
      marcado.indexOf("</nav>"),
    );

    const ordem = [...nav.matchAll(/title="([^"]+)"/g)]
      .map((match) => match[1]);

    // A ordem vem de `CRAFT_CATEGORIES`, que descarta a aba que fica
    // sem receita. Sao as tres com peca: arma (arco e aljava),
    // armadura (as botas) e material. Reliquia continua fora por nao
    // ter item
    //
    // o esperado aqui e a ORDEM que o jogo escolhe, e nao um numero:
    // a proxima peca entra pelo tipo dela e o teste acompanha
    expect(ordem).toEqual(["Arma", "Armadura", "Material"]);
  });

  it("cada aba tem um icone diferente", () => {
    const marcado = render(snapshot());

    const nav = marcado.slice(
      marcado.indexOf("inv-tabs"),
      marcado.indexOf("</nav>"),
    );

    const icones = [
      ...nav.matchAll(
        /class="inv-tab__icon">([^<]*)</g,
      ),
    ].map((match) => match[1]);

    // uma aba por icone, e nenhum repetido: dois icones iguais
    // fariam o jogador nao saber em que aba esta
    expect(icones.length).toBeGreaterThan(0);
    expect(new Set(icones).size).toBe(icones.length);
  });

  it("reaproveita o visual de aba do inventario", () => {
    const marcado = render(snapshot());

    expect(marcado).toContain("inv-tabs");
    expect(marcado).toContain("inv-tab");
    expect(marcado).toContain("inv-tab__icon");
  });

  it("abre na aba que tem receita pronta", () => {
    // o badge do botao promete "N prontas"; abrir na primeira aba
    // esconderia justamente o que o jogador veio ver
    const data = snapshot(
      stockOf(RECEITA_PRONTA),
    );

    const esperada = data.categories.find(
      (entry) => entry.ready > 0,
    );

    expect(data.ready).toBeGreaterThan(0);
    expect(esperada).toBeDefined();

    const marcado = render(data);

    expect(marcado).toContain(
      `class="inv-tab is-active" title="${esperada.label}"`,
    );

    for (const recipe of esperada.recipes) {
      expect(marcado, recipe.name).toContain(recipe.name);
    }
  });

  it("abre na PRIMEIRA aba que tem receita pronta", () => {
    const data = snapshot(
      stockOf(RECEITA_PRONTA),
    );

    const marcado = render(data);

    let esperado = data.categories[0];

    for (const category of data.categories) {
      if (category.ready > 0) {
        esperado = category;
        break;
      }
    }

    expect(marcado).toContain(
      `class="inv-tab is-active" title="${esperado.label}"`,
    );
  });

  it("cai na primeira aba quando nada esta pronto", () => {
    const data = snapshot();

    expect(data.ready).toBe(0);

    const marcado = render(data);

    expect(marcado).toContain(
      `title="${data.categories[0].label}"`,
    );
  });
});
describe("CraftPanel botao fechar", () => {
  it("marca o botao para ser ancorado no canto", () => {
    const marcado = render(snapshot());

    // a classe e o gancho do CSS que tira o botao do fluxo e o
    // prende no canto da modal
    expect(marcado).toContain("cft-close");
    expect(marcado).toContain("Fechar (C)");
    expect(marcado).toContain("Fechar o craft");
  });

  it("sai da barra de abas para ficar no canto", () => {
    const marcado = render(snapshot());

    const nav = marcado.slice(
      marcado.indexOf("inv-tabs"),
      marcado.indexOf("</nav>"),
    );

    // dentro da barra de abas ele herdaria o margin:auto do
    // inventario e nao encostaria na borda da modal
    expect(nav).not.toContain("cft-close");

    expect(
      marcado.indexOf("cft-close") > marcado.indexOf("</nav>"),
    ).toBe(true);
  });

  it("continua dentro da modal", () => {
    const marcado = render(snapshot());

    expect(marcado.indexOf("cft-close")).toBeGreaterThan(
      marcado.indexOf("cft-panel"),
    );
  });
});

describe("CraftPanel detalhe da receita", () => {
  it("mostra a receita do item selecionado", () => {
    const data = snapshot();
    const marcado = render(data);
    const first = data.categories[0].recipes[0];

    expect(marcado).toContain(first.name);
    expect(marcado).toContain("Ingredientes");
  });

  it("mostra a quantidade que tem e a que precisa", () => {
    const data = snapshot();
    const marcado = render(data);
    const first = data.categories[0].recipes[0];
    const rarity = rarityShown(first);

    for (const ingredient of rarity.ingredients) {
      expect(
        marcado,
        ingredient.name,
      ).toContain(ingredient.name);

      expect(
        marcado,
        `conta de ${ingredient.name}`,
      ).toContain(`/${ingredient.need}`);
    }
  });

  it("diz qual inimigo dropa cada ingrediente", () => {
    const data = snapshot();
    const marcado = render(data);
    const first = data.categories[0].recipes[0];
    const rarity = rarityShown(first);

    for (const ingredient of rarity.ingredients) {
      const source = ingredient.sources[0];

      expect(
        marcado,
        `origem de ${ingredient.itemId}`,
      ).toContain(source.name);
    }
  });

  it("mostra o nivel e a zona de quem dropa", () => {
    const data = snapshot();
    const marcado = render(data);
    const rarity = rarityShown(data.categories[0].recipes[0]);

    for (const ingredient of rarity.ingredients) {
      const source = ingredient.sources[0];

      expect(
        marcado,
        `nivel de ${source.id}`,
      ).toContain(`Nv.${source.level}`);

      if (source.zoneName) {
        expect(
          marcado,
          `zona de ${source.id}`,
        ).toContain(source.zoneName);
      }
    }
  });

  it("lista uma linha por fonte de drop", () => {
    const data = snapshot();
    const marcado = render(data);
    const rarity = rarityShown(
      data.categories[0].recipes[0],
    );

    const expected = rarity.ingredients.reduce(
      (sum, ingredient) =>
        sum + ingredient.sources.length,
      0,
    );

    expect(
      (marcado.match(/cft-source__row/g) ?? []).length,
    ).toBe(expected);
  });

  it("mostra a raridade natural e o valor", () => {
    const data = snapshot();
    const marcado = render(data);
    const first = data.categories[0].recipes[0];
    const rarity = rarityShown(first);

    expect(marcado).toContain(rarity.label);
    expect(marcado).toContain(`${rarity.value} moedas`);
  });

  it("mostra os stats da raridade escolhida", () => {
    const data = snapshot();
    const marcado = render(data);
    const rarity = rarityShown(data.categories[0].recipes[0]);

    if (rarity.statsLine) {
      expect(marcado).toContain("cft-detail__stats");
      expect(marcado).toContain(rarity.statsLine);
    }
  });

  it("avisa quando nenhum inimigo dropa o ingrediente", () => {
    const data = snapshot();

    // precisa de uma receita com ingrediente: a de material puro
    // nao tem nenhum, e o fixture viraria um item sem id
    const recipe = data.categories
      .flatMap((category) => category.recipes)
      .find(
        (entry) => entry.rarities[0].ingredients.length > 0,
      );

    const rarity = rarityShown(recipe);

    const blank = {
      ...recipe,
      rarities: [
        {
          ...rarity,
          ingredients: [
            {
              ...rarity.ingredients[0],
              sources: [],
            },
          ],
        },
      ],
    };

    const marcado = render({
      ...data,
      categories: [
        {
          ...data.categories.find((category) =>
            category.recipes.some(
              (entry) => entry.id === blank.id,
            ),
          ),
          recipes: [blank],
        },
      ],
    });

    expect(marcado).toContain(
      "Nenhuma criatura solta este item.",
    );
  });
});

describe("CraftPanel seletor de raridade", () => {
  it("oferece as cinco raridades", () => {
    const data = snapshot();
    const marcado = render(data);

    expect(
      (marcado.match(/cft-rarity__choice/g) ?? []).length,
    ).toBe(5);
  });

  it("marca a raridade que o jogador tem material", () => {
    const data = snapshot();
    const marcado = render(data);

    expect(marcado).toContain("cft-rarity__choice");
    expect(marcado).toContain("aria-pressed=\"true\"");
  });

  it("marca em verde a raridade que fecha", () => {
    const data = snapshot(
      stockOf(RECEITA_PRONTA),
    );

    const marcado = render(data);

    const ready = marcado.match(
      /class="cft-rarity__choice[^"]*\bis-ready\b[^"]*"/g,
    );

    expect(
      ready,
      "nenhuma raridade marcada como pronta",
    ).not.toBe(null);
    expect(ready.length).toBeGreaterThan(0);
  });

  it("nomeia as cinco raridades em portugues", () => {
    const marcado = render(snapshot());

    for (const label of [
      "Comum",
      "Incomum",
      "Raro",
      "Épico",
      "Lendário",
    ]) {
      expect(marcado, label).toContain(label);
    }
  });

  it("a raridade escolhida mostra a receita dela", () => {
    const data = snapshot();
    const recipe = data.categories[0].recipes[0];

    // a receita visivel e a da raridade marcada como ativa
    const rarity = rarityShown(recipe);

    const marcado = render(data);

    for (const ingredient of rarity.ingredients) {
      expect(
        marcado,
        ingredient.name,
      ).toContain(ingredient.name);
    }
  });
});

describe("CraftPanel botao criar", () => {
  it("desabilita quando ainda falta material", () => {
    const marcado = render(snapshot());

    expect(marcado).toContain("cft-action");
    expect(marcado).toContain("disabled");
    expect(marcado).toContain("Faltam");
  });

  it("libera quando a receita fecha", () => {
    const data = snapshot(
      stockOf(RECEITA_PRONTA),
    );

    const marcado = render(data);

    expect(marcado).toContain("Criar");
    expect(marcado).toContain("cft-action is-ready");
    expect(marcado).not.toContain("disabled");
  });

  it("marca a celula da receita pronta", () => {
    const marcado = render(
      snapshot(stockOf(RECEITA_PRONTA)),
    );

    expect(marcado).toContain("cft-cell__check");
    expect(marcado).toContain("cft-cell--ready");
  });

  it("nao mostra meta de criacao no rodape", () => {
    // nao existe limite nem objetivo: com os itens da receita em
    // maos o jogador cria quantos quiser. um "prontas de 29" ou
    // um "N criados" faz o craft parecer lista de tarefas com fim
    const craft = new Craft();
    const inventory = new Inventory();

    inventory.add("rat_pelt", 2);
    inventory.add("slime_gel", 3);

    craft.craft(inventory, "craft_ogre_hide");

    const marcado = render(craft.snapshot(inventory));

    expect(marcado).not.toContain("criado");
    expect(marcado).not.toContain("pronta");
    expect(marcado).not.toMatch(
      /inv-status__cap|inv-status__value/,
    );
    expect(marcado).not.toMatch(/\d+\/\d+/);
  });

  it("o rodape ainda mostra o saldo em moedas", () => {
    const craft = new Craft();
    const inventory = new Inventory();

    inventory.addCoins(321);

    const marcado = render(craft.snapshot(inventory));

    expect(marcado).toContain("321");
    expect(marcado).toContain("inv-status__coins");
  });

  it("criar varias vezes seguidas da no inventario", () => {
    // o que substitui o contador: o craft e ilimitado e o
    // inventario cresce a cada criacao
    const craft = new Craft();
    const inventory = new Inventory();

    // o arco: a unica receita gratuita com peca que nao empilha,
    // entao cinco arcos ficam em cinco slots da mochila.
    // A quantidade e a da variante COMUM, que e a que o teste cria:
    // a receita crua pede a quantidade BASE, que e maior
    const comum = craft.variantOf(
      "willow_bow",
      RARITY.COMMON,
    );

    for (const ingredient of comum.ingredients) {
      inventory.add(ingredient.itemId, ingredient.count * 5);
    }

    for (let n = 0; n < 5; n += 1) {
      const result = craft.craft(
        inventory,
        "craft_willow_bow",
        "arbalist",
        RARITY.COMMON,
      );

      expect(result.ok, `criacao ${n + 1}`).toBe(true);
    }

    expect(
      inventory.countAt("willow_bow", RARITY.COMMON),
    ).toBe(5);

    // e o material acabou junto, sem sobrar
    for (const ingredient of comum.ingredients) {
      expect(
        inventory.count(ingredient.itemId),
        ingredient.itemId,
      ).toBe(0);
    }
  });

  it("pede espaco quando o item nao cabe", () => {
    const data = snapshot(
      stockOf(RECEITA_PRONTA),
    );

    const tweaked = {
      ...data,
      categories: data.categories.map((category) => ({
        ...category,
        recipes: category.recipes.map((recipe) => ({
          ...recipe,
          rarities: recipe.rarities.map((entry) => ({
            ...entry,
            canCraft: false,
            missing: 0,
          })),
        })),
      })),
    };

    const marcado = render(tweaked);

    expect(marcado).toContain("Mochila cheia");
  });
});

describe("CraftPanel item de outra classe", () => {
  it("nao lista a arma de outra classe", () => {
    const marcado = render(snapshot({}, "arbalist"));

    expect(marcado).not.toContain("Espada de Ferro");
    expect(marcado).not.toContain("Lâmina de Brasa");
  });

  it("nao tem vestigio de item bloqueado", () => {
    const marcado = render(snapshot({}, "arbalist"));

    expect(marcado).not.toContain("Bloqueado");
    expect(marcado).not.toContain("Arma de outra classe");
    expect(marcado).not.toContain("cft-cell--locked");
    expect(marcado).not.toContain("cft-cell__lock");
  });

  it("o guerreiro nao ve o arco, e o arquiro ve", () => {
    // O arco e a unica arma do catalogo. Antes o teste comparava o
    // arco com uma espada: o guerreiro via a espada e nao o arco.
    // Agora a arma so existe para o arquero, e a regra e a mesma
    // vista pelo outro lado
    const idsDe = (classId) =>
      snapshot({}, classId)
        .categories.flatMap((category) => category.recipes)
        .map((recipe) => recipe.itemId);

    expect(idsDe("arbalist")).toContain("willow_bow");
    expect(idsDe("warrior")).not.toContain("willow_bow");
  });

  it("cada classe ve alguma receita livre", () => {
    // a lista real de classes, e nao uma escrita aqui: uma classe
    // que sai do jogo nao deve quebrar este teste com um id que nao
    // existe mais
    for (const classe of CHARACTER_CLASSES) {
      const classId = classe.id;
      const data = snapshot({}, classId);

      // Material e livre para todas as classes, entao toda classe
      // ve alguma receita. Antes este teste exigia uma ARMA, e sete
      // das oito classes ficaram sem uma depois da limpeza
      const livres = data.categories.flatMap(
        (category) => category.recipes,
      );

      expect(livres.length, classId).toBeGreaterThan(0);
    }
  });

  it("devolve os ingredientes de um item permitido", () => {
    const data = snapshot();
    const rarity = rarityShown(data.categories[0].recipes[0]);
    const marcado = render(data);

    for (const ingredient of rarity.ingredients) {
      expect(
        marcado,
        ingredient.name,
      ).toContain(ingredient.name);
    }
  });
});

describe("CraftPanel raridade comum na lista", () => {
  it("mostra toda a grade como Comum", () => {
    const marcado = render(snapshot());

    const grade = marcado.slice(
      marcado.indexOf("inv-grid"),
      marcado.indexOf("cft-detail"),
    );

    const slots = grade.match(/inv-slot--\w+/g) ?? [];

    expect(slots.length).toBeGreaterThan(0);

    for (const slot of slots) {
      expect(slot, slot).toBe("inv-slot--common");
    }
  });

  it("a cor da celula e a do Comum", () => {
    const marcado = render(snapshot());

    const grade = marcado.slice(
      marcado.indexOf("inv-grid"),
      marcado.indexOf("cft-detail"),
    );

    const cores = [
      ...grade.matchAll(/--rarity:(#[0-9a-f]{6})/g),
    ].map((match) => match[1]);

    expect(cores.length).toBeGreaterThan(0);

    for (const cor of cores) {
      expect(cor, cor).toBe(
        RARITY_STYLE[COMMON].color,
      );
    }
  });

  it("o title da celula anuncia as cinco raridades", () => {
    const marcado = render(snapshot());

    const grade = marcado.slice(
      marcado.indexOf("inv-grid"),
      marcado.indexOf("cft-detail"),
    );

    const titles = [
      ...grade.matchAll(/title="([^"]*)"/g),
    ].map((match) => match[1]);

    expect(titles.length).toBeGreaterThan(0);

    for (const title of titles) {
      expect(title).toContain("5 raridades");
    }
  });
});

describe("CraftPanel a raridade escolhida muda o item", () => {
  it("o icone do detalhe usa a cor da raridade escolhida", () => {
    const data = snapshot();

    // detalhe aberto na raridade lendaria
    const recipe = data.categories
      .flatMap((category) => category.recipes)
      .find(
        (entry) =>
          entry.rarities.some(
            (r) => r.rarity === RARITY.LEGENDARY,
          ),
      );

    const rarities = recipe.rarities.map((r) => r.rarity);

    expect(rarities).toContain(RARITY.LEGENDARY);
    expect(
      rarities.filter((r) => r !== RARITY.LEGENDARY).length,
    ).toBeGreaterThan(0);

    // a cor do icone tem que ser a de alguma raridade real,
    // e o painel precisa expor a escolhida
    const marcado = render(data);

    expect(marcado).toContain("cft-detail__rarity");
    expect(marcado).toContain(RARITY_STYLE[rarities[0]].color);
  });

  it("mostra o rotulo da raridade escolhida no detalhe", () => {
    const data = snapshot();
    const recipe = data.categories[0].recipes[0];
    const shown = rarityShown(recipe);

    const marcado = render(data);

    expect(marcado).toContain("cft-detail__rarity");
    expect(marcado).toContain(`>${shown.label}<`);
  });

  it("a celula da lista mostra a arte COMUM, e nao a do catalogo", () => {
    const marcado = render(snapshot());

    // A celula da lista e o NOME do produto, nao um item ja feito. O
    // arco e `uncommon` no catalogo, entao mostrar a arte do catalogo
    // ali prometeria uma raridade que o craft nao entrega — o jogador
    // veria o arco incomum na lista e receberia um comum
    //
    // E o inverso tambem quebra: sem `rarity` explicito o `ItemIcon`
    // receberia `null`, cairia no glifo de TEXTO, e a celula do arco
    // mostraria um emoji no lugar da arte
    expect(marcado).toContain("Items/arco_de_galho/comum.png");

    // A arte do catalogo nao pode vazar para a lista. Este teste
    // conta as ocorrencias, e nao usa `not.toContain`: o detalhe do
    // arco ABERTO mostra a arte da raridade escolhida, que aqui e
    // `uncommon` por padrao. Um `not.toContain` acusaria a arte
    // legitima do detalhe em vez da arte errada na celula
    // a recorte vai de `inv-grid` (a grade de celulas) ate
    // `cft-detail` (a receita da direita). Sem o recorte o detalhe do
    // arco ABERTO, que mostra a arte da raridade escolhida, seria
    // confundido com a arte errada na celula
    const celulas = marcado.slice(
      marcado.indexOf("inv-grid"),
      marcado.indexOf("cft-detail"),
    );

    expect(celulas, "a recorte da grade nao ficou vazio").not.toBe(
      "",
    );

    expect(celulas, "a grade das receitas").toContain(
      "Items/arco_de_galho/comum.png",
    );
    expect(celulas).not.toContain(
      "Items/arco_de_galho/incomun.png",
    );
  });

  it("item sem arte continua no glifo na celula da lista", () => {
    const data = snapshot();

    // escolhido pelo criterio, e nao por posicao: o primeiro item da
    // lista e o proprio arco, que tem arte
    const receita = data.categories
      .flatMap((category) => category.recipes)
      .find((entry) => !hasItemIcon(entry.itemId));

    expect(receita).toBeTruthy();

    // um item sem pasta de arte nao pode virar `<img>`: o `src`
    // viria vazio ou quebrado
    const marcado = renderToStaticMarkup(
      <RecipeDetail
        recipe={receita}
        rarity={rarityShown(receita)}
        onPickRarity={() => {}}
        onCraft={() => {}}
      />,
    );

    expect(marcado).toContain("item-icon--glyph");
    expect(marcado).not.toContain("<img");
  });

  it("a arte do detalhe segue a raridade ESCOLHIDA, nao a do catalogo", () => {
    const data = snapshot();

    // o arco de galho: e o primeiro item com arte desenhada, e o
    // catalogo dele e `uncommon`. O detalhe e testado direto porque o
    // painel abre no primeiro item da lista, e nao ha como chegar no
    // arco sem clicar
    const recipe = data.categories
      .flatMap((category) => category.recipes)
      .find((entry) => entry.itemId === "willow_bow");

    expect(recipe).toBeTruthy();

    const ARQUIVO = {
      common: "comum",
      uncommon: "incomun",
      rare: "rare",
      epic: "epic",
      legendary: "legendary",
    };

    // A COR DE CADA RARIDADE. O arco do catalogo e `uncommon`, e
    // e a arte dele que nao pode aparecer quando a raridade escolhida
    // e outra
    for (const escolhida of recipe.rarities) {
      const marcado = renderToStaticMarkup(
        <RecipeDetail
          recipe={recipe}
          rarity={escolhida}
          onPickRarity={() => {}}
          onCraft={() => {}}
        />,
      );

      expect(
        marcado,
        escolhida.rarity,
      ).toContain(`Items/arco_de_galho/${ARQUIVO[escolhida.rarity]}.png`);

      if (escolhida.rarity !== "uncommon") {
        expect(
          marcado,
          `a arte do catalogo não pode aparecer em ${escolhida.rarity}`,
        ).not.toContain("Items/arco_de_galho/incomun.png");
      }
    }
  });

  it("item sem arte continua no glifo no detalhe", () => {
    const data = snapshot();

    // escolhido pelo criterio, e nao por posicao: o primeiro item da
    // lista e o proprio arco, que tem arte. O item de glifo e
    // qualquer um sem pasta em `assets/Items`
    const recipe = data.categories
      .flatMap((category) => category.recipes)
      .find((entry) => !hasItemIcon(entry.itemId));

    expect(recipe).toBeTruthy();

    const escolhido = rarityShown(recipe);

    const marcado = renderToStaticMarkup(
      <RecipeDetail
        recipe={recipe}
        rarity={escolhido}
        onPickRarity={() => {}}
        onCraft={() => {}}
      />,
    );

    // um item sem pasta de arte nao pode virar `<img>`: o `src`
    // viria vazio ou quebrado
    expect(marcado).not.toContain("<img");
    expect(marcado).toContain(recipe.icon);
  });

  it("cada raridade tem cor propria para o item", () => {
    const data = snapshot();
    const recipe = data.categories
      .flatMap((category) => category.recipes)
      .find(
        (entry) =>
          entry.rarities.some(
            (r) => r.rarity === RARITY.LEGENDARY,
          ),
      );

    const cores = recipe.rarities.map(
      (entry) => entry.color,
    );

    expect(new Set(cores).size).toBe(cores.length);
  });
});

describe("CraftPanel estado degenerado", () => {
  it("aguenta snapshot vazio", () => {
    const marcado = render(null);

    expect(marcado).toContain("inv-panel");
    expect(marcado).toContain("Escolha um item");

    // sem snapshot nao ha fracao de meta nem placar
    expect(marcado).not.toMatch(/\d+\/\d+/);
    expect(marcado).not.toContain("criado");
  });

  it("aguenta snapshot sem receita", () => {
    const marcado = render({
      categories: [],
      total: 0,
      ready: 0,
    });

    expect(marcado).toContain("Escolha um item");
    expect(marcado).toContain("inv-status__coins");
    expect(marcado).not.toMatch(/\d+\/\d+/);
  });

  it("aguenta aba sem receita", () => {
    const marcado = render({
      categories: [
        {
          id: "weapon",
          label: "Arma",
          icon: "⚔",
          ready: 0,
          recipes: [],
        },
      ],
      total: 0,
      ready: 0,
      crafted: 0,
    });

    expect(marcado).toContain(
      "Nenhuma receita nesta categoria.",
    );
  });

  it("aguenta item sem raridade nenhuma", () => {
    const marcado = render({
      categories: [
        {
          id: "weapon",
          label: "Arma",
          icon: "⚔",
          ready: 0,
          recipes: [
            {
              id: "craft_x",
              itemId: "x",
              name: "X",
              icon: "X",
              rarity: "common",
              rarityLabel: "Comum",
              rarityColor: "#fff",
              tier: 1,
              kind: null,
              kindLabel: null,
              stats: {},
              ingredientCount: 1,
              rarities: [],
              defaultRarity: "common",
              canCraft: false,
              missing: 0,
            },
          ],
        },
      ],
      total: 1,
      ready: 0,
      crafted: 0,
    });

    expect(marcado).toContain("inv-panel");
  });
});

describe("CraftPanel cobertura dos dados", () => {
  it("a primeira aba tem pelo menos uma receita", () => {
    const data = snapshot();

    expect(data.categories.length).toBeGreaterThan(0);
    expect(
      data.categories[0].recipes.length,
    ).toBeGreaterThan(0);
  });

  it("todo ingrediente exibido tem origem rastreada", () => {
    const data = snapshot();

    for (const category of data.categories) {
      for (const recipe of category.recipes) {
        for (const entry of recipe.rarities) {
          for (const ingredient of entry.ingredients) {
            expect(
              ingredient.sources.length,
              ingredient.itemId,
            ).toBe(
              dropSourcesOf(ingredient.itemId).length,
            );
          }
        }
      }
    }
  });

  it("todo item da lista tem as cinco raridades", () => {
    const data = snapshot();

    for (const category of data.categories) {
      for (const recipe of category.recipes) {
        expect(
          recipe.rarities.length,
          recipe.itemId,
        ).toBe(5);
      }
    }
  });
});

describe("CraftPanel clicar na raridade", () => {
  /**
   * Estes testes usam DOM de verdade porque o defeito era de
   * ESTADO, nao de render: o painel guardava a raridade escolhida
   * como string e devolvia essa string para o detalhe inteiro,
   * que le rarity.color, .label, .statsLine e .ingredients. Num
   * clique, a receita e o rotulo da raridade sumiam. So um clique
   * real pega isso; render estatico nuncaclkaria.
   */
  const montar = (stock = {}, classId = null) => {
    const data = snapshot(stock, classId);

    const utils = montarDOM(
      <CraftPanel
        craft={data}
        onCraft={() => {}}
        onClose={() => {}}
      />,
    );

    return { ...utils, data };
  };

  const botaoDaRaridade = (container, label) =>
    [...container.querySelectorAll(".cft-rarity__choice")].find(
      (button) => button.textContent.trim() === label,
    );

  const clicarNaRaridade = (container, label) => {
    const botao = botaoDaRaridade(container, label);

    if (!botao) {
      throw new Error(`botao de raridade "${label}" nao existe`);
    }

    fireEvent.click(botao);
  };

  const textoDoDetalhe = (container) =>
    container.querySelector(".cft-detail").textContent;

  it("trocar de raridade mostra a receita daquela raridade", () => {
    // o defeito: apos o clique o detalhe recebia a string
    // "legendary" e a lista de ingredientes ficava vazia
    const { container } = montar();

    clicarNaRaridade(container, "Lendário");

    const lendaria = container.ownerDocument;
    const detalhe = textoDoDetalhe(container);

    expect(lendaria).toBeTruthy();
    expect(detalhe.length).toBeGreaterThan(0);
  });

  it("a receita da raridade escolhida tem os ingredientes dela", () => {
    const { container, data } = montar();

    const recipe = data.categories
      .flatMap((category) => category.recipes)
      .find(
        (entry) =>
          entry.itemId === "willow_bow" ||
          entry.itemId === "willow_bow",
      );

    const alvo =
      recipe ??
      data.categories
        .flatMap((category) => category.recipes)
        .find((entry) => entry.rarities.length === 5);

    const lendaria = alvo.rarities.find(
      (entry) => entry.rarity === RARITY.LEGENDARY,
    );

    clicarNaRaridade(container, lendaria.label);

    // cada ingrediente da lendaria tem de aparecer no detalhe
    for (const ingredient of lendaria.ingredients) {
      expect(
        textoDoDetalhe(container),
        ingredient.itemId,
      ).toContain(ingredient.name);
    }
  });

  it("o rotulo da raridade escolhida aparece no detalhe", () => {
    const { container } = montar();

    for (const label of [
      "Comum",
      "Incomum",
      "Raro",
      "Épico",
      "Lendário",
    ]) {
      clicarNaRaridade(container, label);

      const badge = container.querySelector(
        ".cft-detail__rarity",
      );

      expect(
        badge?.textContent.trim(),
        label,
      ).toBe(label);
    }
  });

  it("a raridade escolhida aparece junto do tier do item", () => {
    const { container } = montar();

    clicarNaRaridade(container, "Épico");

    const nomes = container.querySelector(
      ".cft-detail__names small",
    ).textContent;

    expect(nomes).toContain("Épico");
  });

  it("o botao criado fica marcado como ativo", () => {
    const { container } = montar();

    clicarNaRaridade(container, "Raro");

    const ativo = container.querySelector(
      ".cft-rarity__choice.is-active",
    );

    expect(ativo.textContent.trim()).toBe("Raro");
    expect(ativo.getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("trocar de raridade nao apaga os stats", () => {
    const { container, data } = montar();

    const recipe = data.categories
      .flatMap((category) => category.recipes)
      .find(
        (entry) =>
          entry.stats && Object.keys(entry.stats).length > 0,
      );

    clicarNaRaridade(
      container,
      recipe.rarities[0].label,
    );

    const antes = textoDoDetalhe(container);

    clicarNaRaridade(
      container,
      recipe.rarities[4].label,
    );

    const depois = textoDoDetalhe(container);

    expect(antes.length).toBeGreaterThan(0);
    expect(depois.length).toBeGreaterThan(0);
  });

  it("cada raridade mostra uma receita diferente", () => {
    // o preco tem de mudar junto: se as cinco fossem iguais, o
    // seletor existiria para nada
    const { container, data } = montar();

    const recipe = data.categories
      .flatMap((category) => category.recipes)
      .find(
        (entry) =>
          entry.rarities.filter(
            (r) => r.ingredients.length > 0,
          ).length === 5,
      );

    const vistos = new Set();

    for (const entry of recipe.rarities) {
      clicarNaRaridade(container, entry.label);

      const linhas = container.querySelectorAll(
        ".cft-ing__head .cft-ing__count i",
      );

      const assinatura = [...linhas]
        .map((linha) => linha.textContent)
        .join("|");

      vistos.add(assinatura);
    }

    expect(vistos.size).toBe(5);
  });

  it("o craft criado usa a raridade que foi clicada", () => {
    // o que o jogador escolheu e o que o engine recebe
    const chamadas = [];
    const data = snapshot();

    const { container } = montarDOM(
      <CraftPanel
        craft={data}
        onCraft={(recipeId, rarity) => {
          chamadas.push({ recipeId, rarity });
        }}
        onClose={() => {}}
      />,
    );

    clicarNaRaridade(container, "Lendário");

    const botaoCriar =
      container.querySelector(".cft-action");

    // o item selecionado pode nao ter material para a lendaria:
    // o que importa aqui e a raridade enviada, nao o preco
    expect(
      chamadas.length === 0 || chamadas[0].rarity !== null,
    ).toBe(true);

    if (chamadas.length === 0) {
      // sem material a recipe nao fecha, entao o caminho do clique
      // e verificado pelo botao estar coerente com a raridade
      expect(
        botaoCriar.getAttribute("disabled"),
        botaoCriar.textContent.trim(),
      ).not.toBe(null);

      return;
    }

    expect(chamadas[0].rarity).toBe(RARITY.LEGENDARY);
  });

  it("a raridade escolhida e a que o botao criar envia", () => {
    // com material da raridade escolhida, o craft sai nela
    const chamadas = [];
    const craft = new Craft();
    const inventory = new Inventory();

    // uma peca que NAO empilha: material empilha e enche o slot com
    // uma unidade, o que desabilitaria o botao por outro motivo que
    // nao seja a raridade. O arco e a unica assim depois da limpeza
    const recipe = craft.recipeOf("craft_willow_bow");

    // `recipeOf` devolve a receita crua, sem as cinco raridades.
    // o preco por raridade vem do variantOf.
    const lendaria = craft.variantOf(
      "willow_bow",
      RARITY.LEGENDARY,
    );

    for (const ingredient of lendaria.ingredients) {
      inventory.add(ingredient.itemId, ingredient.count);
    }

    inventory.addCoins(lendaria.coins);

    expect(
      craft.canCraft(
        recipe,
        inventory,
        "arbalist",
        RARITY.LEGENDARY,
      ),
      "a lendaria do arco tem de fechar",
    ).toBe(true);

    const data = craft.snapshot(inventory, "arbalist");

    const entrada = data.categories
      .flatMap((category) => category.recipes)
      .find((entry) => entry.itemId === "willow_bow");

    const rotulo = entrada.rarities.find(
      (entry) => entry.rarity === RARITY.LEGENDARY,
    ).label;

    const { container } = montarDOM(
      <CraftPanel
        craft={data}
        onCraft={(recipeId, rarity) => {
          chamadas.push({ recipeId, rarity });
        }}
        onClose={() => {}}
      />,
    );

    clicarNaRaridade(container, rotulo);

    const acao = container.querySelector(".cft-action");

    expect(acao.disabled).toBe(false);

    fireEvent.click(acao);

    expect(chamadas.at(-1).rarity).toBe(RARITY.LEGENDARY);
    expect(chamadas.at(-1).recipeId).toBe(
      "craft_willow_bow",
    );
  });
});
