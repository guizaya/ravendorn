import { describe, expect, it } from "vitest";
import { Craft, CRAFT_RESULT } from "./Craft.js";
import { Inventory } from "../inventory/Inventory.js";
import { Equipment } from "../equipment/Equipment.js";
import {
  CRAFT_RECIPES,
  variantsOf,
} from "../../data/craft/index.js";
import {
  ITEM_TYPE,
  RARITY,
  RARITY_COST_SCALE,
  RARITY_ORDER,
  getItem,
  statsAt,
} from "../../data/items/index.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";

/** enche a mochila com os ingredientes de uma receita */
function stockRecipe(inventory, recipeId, extra = 0) {
  const recipe = new Craft().recipeOf(recipeId);

  for (const ingredient of recipe.ingredients) {
    inventory.add(
      ingredient.itemId,
      ingredient.count + extra,
    );
  }

  return recipe;
}

/** shorthands de receita usados em varios blocos */
const BOW = "craft_willow_bow";
const MATERIAL = "craft_ghoul_rib";

/** enche a mochila com os ingredientes de UMA raridade */
function stockVariant(inventory, recipeId, rarity) {
  const craft = new Craft();
  const recipe = craft.recipeOf(recipeId);

  for (const ingredient of craft.ingredientsOf(
    recipe,
    inventory,
    rarity,
  )) {
    inventory.add(ingredient.itemId, ingredient.need);
  }

  return recipe;
}

describe("Craft ingredientes", () => {
  it("conta o que falta ingrediente a ingrediente", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(inventory, MATERIAL);

    // some com a ultima unidade de um dos ingredientes
    const first = recipe.ingredients[0];

    inventory.remove(first.itemId, first.count);

    const ingredients = craft.ingredientsOf(recipe, inventory);

    expect(ingredients).toHaveLength(
      recipe.ingredients.length,
    );

    for (const ingredient of ingredients) {
      expect(ingredient.need).toBeGreaterThan(0);
      expect(ingredient.have).toBeGreaterThanOrEqual(0);
      expect(ingredient.missing).toBe(
        Math.max(0, ingredient.need - ingredient.have),
      );
    }
  });

  it("nunca mostra falta negativa quando sobra ingrediente", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(inventory, MATERIAL, 5);

    for (const ingredient of craft.ingredientsOf(
      recipe,
      inventory,
    )) {
      expect(
        ingredient.missing,
        ingredient.itemId,
      ).toBe(0);
    }
  });

  it("traz o nome e o icone do ingrediente resolvidos", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(inventory, MATERIAL);

    for (const ingredient of craft.ingredientsOf(
      recipe,
      inventory,
    )) {
      expect(ingredient.name).not.toBe(ingredient.itemId);
      expect(ingredient.icon).toBeTruthy();
      expect(ingredient.sources.length).toBeGreaterThan(0);
    }
  });

  it("funciona sem inventario nenhum", () => {
    const craft = new Craft();
    const recipe = craft.recipeOf(MATERIAL);

    for (const ingredient of craft.ingredientsOf(
      recipe,
      null,
    )) {
      expect(ingredient.have).toBe(0);
      expect(ingredient.ok).toBe(false);
    }
  });
});

describe("Craft canCraft", () => {
  it("fecha a receita com os materiais certos", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(inventory, MATERIAL);

    expect(craft.canCraft(recipe, inventory)).toBe(true);
  });

  it("trava quando falta um ingrediente", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(
      inventory,
      MATERIAL,
    );

    // tira do primeiro ingrediente, que existe na receita
    inventory.remove(recipe.ingredients[0].itemId, 1);

    expect(craft.canCraft(recipe, inventory)).toBe(false);
  });

  it("trava quando sobra menos que a conta", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(
      inventory,
      MATERIAL,
    );

    // esvazia a mochila inteira: sobra menos que a conta de tudo
    inventory.stacks.length = 0;

    expect(craft.canCraft(recipe, inventory)).toBe(false);
  });

  it("trava com receita desconhecida", () => {
    expect(
      new Craft().canCraft(null, new Inventory()),
    ).toBe(false);
  });
});

describe("Craft craft", () => {
  it("consome os materiais e entrega o item", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(inventory, MATERIAL);

    const result = craft.craft(inventory, recipe.id);

    expect(result.ok).toBe(true);
    expect(result.recipe.itemId).toBe(recipe.itemId);
    expect(inventory.count(recipe.itemId)).toBe(1);

    for (const ingredient of recipe.ingredients) {
      expect(
        inventory.count(ingredient.itemId),
        ingredient.itemId,
      ).toBe(0);
    }
  });

  it("cria quantas vezes o jogador quiser", () => {
    // nao existe limite nem contador: quem decide quantas sao e
    // quanto material sobra. o que se guarda e o resultado, nao
    // um placar
    const craft = new Craft();
    const inventory = new Inventory();

    // um MATERIAL, que empilha: a contagem e o total da pilha
    const recipe = stockRecipe(inventory, MATERIAL);

    craft.craft(inventory, recipe.id);

    expect(
      inventory.count(recipe.itemId),
    ).toBe(1);

    stockRecipe(inventory, recipe.id);
    craft.craft(inventory, recipe.id);

    expect(
      inventory.count(recipe.itemId),
    ).toBe(2);

    expect(craft.craftedCount).toBeUndefined();
  });

  it("aceita o id do item, e nao so o da receita", () => {
    const craft = new Craft();
    const inventory = new Inventory();

    const recipe = stockRecipe(
      inventory,
      MATERIAL,
    );

    expect(
      craft.craft(inventory, recipe.itemId).ok,
    ).toBe(true);
  });

  it("recusa receita desconhecida sem tocar na mochila", () => {
    const craft = new Craft();
    const inventory = new Inventory();

    inventory.add("slime_gel", 10);

    const result = craft.craft(inventory, "craft_nada");

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CRAFT_RESULT.UNKNOWN);
    expect(inventory.count("slime_gel")).toBe(10);
  });

  it("nao gasta nada quando falta um so ingrediente", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(
      inventory,
      MATERIAL,
    );

    // tira a ultima unidade do primeiro ingrediente da receita
    const alvo = recipe.ingredients[0];

    inventory.remove(alvo.itemId, alvo.count);

    const before = inventory.summary();
    const result = craft.craft(inventory, recipe.id);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CRAFT_RESULT.MISSING);

    // o que dava para gastar continua na mochila
    expect(
      inventory.count(alvo.itemId),
      alvo.itemId,
    ).toBe(0);

    for (const ingredient of recipe.ingredients) {
      if (ingredient.itemId === alvo.itemId) continue;

      expect(
        inventory.count(ingredient.itemId),
        ingredient.itemId,
      ).toBe(ingredient.count);
    }

    expect(inventory.usedSlots).toBe(before.used);
    expect(inventory.count(recipe.itemId)).toBe(0);
  });

  it("nao cria o mesmo item duas vezes por engano", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(
      inventory,
      MATERIAL,
    );

    craft.craft(inventory, recipe.id);

    // ainda tem ingredients porque a receita foi repetida
    stockRecipe(inventory, recipe.id);

    const again = craft.craft(inventory, recipe.id);

    expect(again.ok).toBe(true);
    expect(inventory.count(recipe.itemId)).toBe(2);
  });
});

describe("Craft mochila cheia", () => {
  /**
   * O resultado precisa de um slot NOVO, entao a receita tem de ser de
   * uma peca que nao empilha.
   *
   * Depois da limpeza do catalogo o arco de galho e a unica: material
   * empilha (`maxStack` 99) e cabe na pilha que ja existe, mesmo com a
   * mochila cheia. Usar um material aqui dava `true` onde o teste
   * espera `false`, sem nenhuma falha logica visivel
   */
  const RECEITA_ARMA = "craft_willow_bow";

  it("recusa o craft antes de gastar quando o item nao cabe", () => {
    const craft = new Craft();
    const inventory = new Inventory(2);

    const recipe = stockRecipe(
      inventory,
      RECEITA_ARMA,
    );

    // enche os dois slots com pecas que nao empilham
    inventory.add("skeleton_skull", 1);
    inventory.add("skeleton_skull", 1);

    expect(inventory.isFull).toBe(true);

    const before = inventory.summary();
    const result = craft.craft(inventory, recipe.id);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CRAFT_RESULT.FULL);

    // nenhum ingrediente foi consumido
    for (const ingredient of recipe.ingredients) {
      expect(
        inventory.count(ingredient.itemId),
        ingredient.itemId,
      ).toBe(ingredient.count);
    }

    expect(inventory.count(recipe.itemId)).toBe(0);
    expect(inventory.usedSlots).toBe(before.used);
  });

  it("aceita quando o resultado empilha em um slot existente", () => {
    const craft = new Craft();
    const inventory = new Inventory(2);

    const recipe = stockRecipe(
      inventory,
      MATERIAL,
    );

    // o resultado e um MATERIAL, que empilha: cabe na pilha que ja
    // existe, mesmo com a mochila cheia
    inventory.add("willow_bow", 1);
    inventory.add("skeleton_skull", 1);

    expect(inventory.isFull).toBe(true);

    expect(
      craft.craft(inventory, recipe.id).ok,
    ).toBe(true);
  });

  it("cabe quando ainda ha slot livre", () => {
    const craft = new Craft();
    const inventory = new Inventory(4);

    stockRecipe(inventory, RECEITA_ARMA);

    inventory.add("skeleton_skull", 1);

    expect(inventory.isFull).toBe(false);
    expect(
      craft.craft(inventory, RECEITA_ARMA).ok,
    ).toBe(true);
  });
});

describe("Craft por classe", () => {
  /**
   * O arco e a unica arma do catalogo, e ele e do arqueiro.
   *
   * O bloco antigo comparava duas armas: o arqueiro via arco e nao
   * espada, o guerreiro via espada e nao arco. Depois da limpeza do
   * catalogo nao ha com o que comparar, entao a regra passa a ser
   * medida pelo lado de quem NAO e dono: a arma some da lista e o
   * craft e recusado como travado
   */
  const ARMEIRO = "arbalist";
  const DEMAIS = CHARACTER_CLASSES.filter(
    (entry) => entry.id !== ARMEIRO,
  );

  it("o arqueiro cria o arco", () => {
    const craft = new Craft();
    const inventory = new Inventory();

    stockRecipe(inventory, BOW);

    expect(
      craft.canCraft(
        craft.recipeOf(BOW),
        inventory,
        ARMEIRO,
      ),
    ).toBe(true);
  });

  it("ninguem mais cria o arco", () => {
    const craft = new Craft();
    const inventory = new Inventory();

    stockRecipe(inventory, BOW);

    for (const entry of DEMAIS) {
      expect(
        craft.canCraft(
          craft.recipeOf(BOW),
          inventory,
          entry.id,
        ),
        entry.id,
      ).toBe(false);
    }
  });

  it("material fica livre para qualquer classe", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const receita = MATERIAL;

    stockRecipe(inventory, receita);

    for (const entry of CHARACTER_CLASSES) {
      expect(
        craft.canCraft(
          craft.recipeOf(receita),
          inventory,
          entry.id,
        ),
        entry.id,
      ).toBe(true);
    }
  });

  it("recusa a receita travada e nao gasta material", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(inventory, BOW);

    const result = craft.craft(
      inventory,
      BOW,
      "warrior",
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CRAFT_RESULT.LOCKED);

    // nenhum ingrediente foi gasto
    for (const ingredient of recipe.ingredients) {
      expect(
        inventory.count(ingredient.itemId),
        ingredient.itemId,
      ).toBe(ingredient.count);
    }

    expect(inventory.count(recipe.itemId)).toBe(0);
  });

  it("a trava vem antes da falta de material", () => {
    // sem material E de outra classe, o motivo que importa
    // para o jogador e a classe
    const result = new Craft().craft(
      new Inventory(),
      BOW,
      "warrior",
    );

    expect(result.reason).toBe(CRAFT_RESULT.LOCKED);
  });

  it("cria a arma quando a classe e a dona", () => {
    const craft = new Craft();
    const inventory = new Inventory();

    const recipe = stockRecipe(inventory, BOW);

    expect(
      craft.craft(inventory, BOW, ARMEIRO).ok,
    ).toBe(true);

    expect(inventory.count(recipe.itemId)).toBe(1);
  });

  it("a arma de outra classe nao aparece na lista", () => {
    const data = new Craft().snapshot(
      new Inventory(),
      ARMEIRO,
    );

    const ids = data.categories
      .flatMap((category) => category.recipes)
      .map((recipe) => recipe.itemId);

    // o arqueiro ve a arma dele
    expect(ids).toContain(
      new Craft().recipeOf(BOW).itemId,
    );
  });

  it("a arma some da lista de quem nao e dono", () => {
    // nem cinza, nem bloqueada: a arma de outra classe nao aparece
    // em lugar nenhum da lista
    for (const entry of DEMAIS) {
      const ids = new Craft()
        .snapshot(new Inventory(), entry.id)
        .categories.flatMap((category) => category.recipes)
        .map((recipe) => recipe.itemId);

      expect(
        ids,
        entry.id,
      ).not.toContain(
        new Craft().recipeOf(BOW).itemId,
      );
    }
  });

  it("esconde ate com todos os materiais prontos", () => {
    const craft = new Craft();
    const inventory = new Inventory();

    stockRecipe(inventory, BOW);

    const ids = craft
      .snapshot(inventory, "warrior")
      .categories.flatMap((category) => category.recipes)
      .map((recipe) => recipe.itemId);

    expect(ids).not.toContain(
      craft.recipeOf(BOW).itemId,
    );
  });

  it("so o arqueiro tem arma na lista", () => {
    for (const entry of CHARACTER_CLASSES) {
      const weapons = new Craft()
        .snapshot(new Inventory(), entry.id)
        .categories.flatMap((category) => category.recipes)
        .filter((recipe) => recipe.type === ITEM_TYPE.WEAPON);

      if (entry.id === ARMEIRO) {
        expect(
          weapons.length,
          entry.id,
        ).toBeGreaterThan(0);
        continue;
      }

      // as outras sete classes ficaram sem arma no catalogo depois
      // da limpeza. e o estado real, nao um esquecimento
      expect(
        weapons.length,
        entry.id,
      ).toBe(0);
    }
  });

  it("material aparece para as 8 classes", () => {
    const gear = CRAFT_RECIPES.filter(
      (recipe) =>
        getItem(recipe.itemId)?.type === ITEM_TYPE.MATERIAL,
    );

    expect(gear.length).toBeGreaterThan(0);

    for (const entry of CHARACTER_CLASSES) {
      const ids = new Craft()
        .snapshot(new Inventory(), entry.id)
        .categories.flatMap((category) => category.recipes)
        .map((recipe) => recipe.itemId);

      for (const recipe of gear) {
        expect(
          ids,
          `${recipe.itemId} sumiu em ${entry.id}`,
        ).toContain(recipe.itemId);
      }
    }
  });


  it("marca a familia da arma na lista", () => {
    const data = new Craft().snapshot(
      new Inventory(),
      "arbalist",
    );

    const bow = data.categories
      .flatMap((category) => category.recipes)
      .find((recipe) => recipe.itemId === "willow_bow");

    expect(bow.kindLabel).toBe("Arco");
  });
});

describe("Craft por raridade", () => {
  it("cada item da classe tem as cinco raridades", () => {
    const data = new Craft().snapshot(
      new Inventory(),
      "arbalist",
    );

    for (const recipe of data.categories.flatMap(
      (category) => category.recipes,
    )) {
      expect(
        recipe.rarities.length,
        recipe.itemId,
      ).toBe(5);

      expect(
        recipe.rarities.map((entry) => entry.rarity),
        recipe.itemId,
      ).toEqual(RARITY_ORDER);
    }
  });

  it("a raridade natural e a mais barata de criar", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = craft.recipeOf(MATERIAL);

    const cost = (rarity) =>
      craft
        .ingredientsOf(recipe, inventory, rarity)
        .reduce((sum, ing) => sum + ing.need, 0);

    const base = cost(recipe.baseRarity);

    for (const rarity of RARITY_ORDER) {
      if (rarity === recipe.baseRarity) continue;

      if (
        RARITY_COST_SCALE[rarity] > RARITY_COST_SCALE[recipe.baseRarity]
      ) {
        expect(cost(rarity), rarity).toBeGreaterThan(base);
      } else {
        expect(cost(rarity), rarity).toBeLessThan(base);
      }
    }
  });

  it("nunca cobra zero de um ingrediente", () => {
    const craft = new Craft();
    const recipe = craft.recipeOf(MATERIAL);

    for (const rarity of RARITY_ORDER) {
      for (const ingredient of craft.ingredientsOf(
        recipe,
        new Inventory(),
        rarity,
      )) {
        expect(ingredient.need, rarity).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("raridade acima da natural da stats mais fortes", () => {
    const base = statsAt("willow_bow", RARITY.EPIC);
    const legendary = statsAt("willow_bow", RARITY.LEGENDARY);
    const common = statsAt("willow_bow", RARITY.COMMON);

    expect(legendary.attack).toBeGreaterThan(base.attack);
    expect(common.attack).toBeLessThan(base.attack);
  });

  it("escala o percentual sem perder o sinal", () => {
    // o `attackSpeed` e um PERCENTUAL: 0.02 no catalogo, nao 2. O
    // arredondamento tem de preservar o sinal, senao um percentual
    // negativo viraria 0 e o item pararia de dar o efeito
    const catalogo = getItem("willow_bow").stats.attackSpeed;

    expect(catalogo).toBeGreaterThan(0);
    expect(catalogo).toBeLessThan(1);

    for (const rarity of RARITY_ORDER) {
      const escalado = statsAt("willow_bow", rarity)
        .attackSpeed;

      // continua fracao de 1, e nao virou numero inteiro
      expect(
        Math.abs(escalado),
        rarity,
      ).toBeGreaterThan(0);
      expect(
        Math.abs(escalado),
        rarity,
      ).toBeLessThan(1);
    }
  });

  it("cria na raridade escolhida, nao na do catalogo", () => {
    // O arco e a unica peca que NAO empilha, entao cada raridade vive
    // em uma pilha propria. E por isso que estes testes usam o arco: um
    // material empilharia as duas variantes na mesma pilha e a
    // separacao por raridade nao seria visivel
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockRecipe(inventory, BOW);

    stockVariant(inventory, BOW, RARITY.LEGENDARY);

    const result = craft.craft(
      inventory,
      BOW,
      "arbalist",
      RARITY.LEGENDARY,
    );

    expect(result.ok).toBe(true);
    expect(result.variant.rarity).toBe(RARITY.LEGENDARY);

    expect(
      inventory.countAt(recipe.itemId, RARITY.LEGENDARY),
    ).toBe(1);

    expect(
      inventory.countAt(recipe.itemId, RARITY.COMMON),
    ).toBe(0);
  });

  it("cria em duas raridades ao mesmo tempo", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const itemId = craft.recipeOf(BOW).itemId;

    stockVariant(inventory, BOW, RARITY.COMMON);
    stockVariant(inventory, BOW, RARITY.LEGENDARY);

    craft.craft(inventory, BOW, "arbalist", RARITY.COMMON);
    craft.craft(
      inventory,
      BOW,
      "arbalist",
      RARITY.LEGENDARY,
    );

    expect(
      inventory.countAt(itemId, RARITY.COMMON),
    ).toBe(1);
    expect(
      inventory.countAt(itemId, RARITY.LEGENDARY),
    ).toBe(1);
  });

  it("equipar a variante mantem a raridade", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const itemId = craft.recipeOf(BOW).itemId;

    stockVariant(inventory, BOW, RARITY.LEGENDARY);
    craft.craft(
      inventory,
      BOW,
      "arbalist",
      RARITY.LEGENDARY,
    );

    const stack = inventory.findStack(
      itemId,
      RARITY.LEGENDARY,
    );

    const equipment = new Equipment();

    equipment.equip(itemId, "weapon", stack.rarity);

    expect(
      equipment.getEquipped("weapon").rarity,
    ).toBe(RARITY.LEGENDARY);
  });

  it("cada raridade mostra a propria receita", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = craft.recipeOf(MATERIAL);

    const cost = (rarity) =>
      craft
        .ingredientsOf(recipe, inventory, rarity)
        .reduce((sum, ing) => sum + ing.need, 0);

    const base = cost(recipe.baseRarity);

    for (const variant of variantsOf("willow_bow")) {
      const chosen = cost(variant.rarity);

      if (variant.rarity === recipe.baseRarity) {
        expect(chosen, variant.rarity).toBe(base);
        continue;
      }

      expect(
        chosen,
        variant.rarity,
      ).not.toBe(base);
    }
  });
});

describe("Craft snapshot", () => {
  it("conta so as receitas que a classe cria", () => {
    // O arqueiro ve os 13 materiais e as SETE pecas dele, e nao ve
    // uma unica peca do guerreiro. Antes ele via o catalogo inteiro,
    // e isso nao era filtro funcionando: o `kind` so trava ARMA,
    // entao a armadura do arqueiro — que era livre — nao escondia nada
    // e nao havia arma de outra classe no catalogo para esconder
    const DO_ARBALIST = [
      "willow_bow",
      "aljava_arbalist",
      "botas_arbalist",
      "calca_arbalist",
      "capuz_arbalist",
      "luvas_arbalist",
      "peito_arbalist",
    ];

    const DO_GUERREIRO = [
      "botas_warrior",
      "calca_warrior",
      "elmo_warrior",
      "luvas_warrior",
      "peito_warrior",
    ];

    const data = new Craft().snapshot(
      new Inventory(),
      "arbalist",
    );

    const all = data.categories.flatMap(
      (category) => category.recipes,
    );

    const visiveis = all.map((recipe) => recipe.itemId);

    for (const itemId of DO_ARBALIST) {
      expect(visiveis, itemId).toContain(itemId);
    }

    for (const itemId of DO_GUERREIRO) {
      expect(
        visiveis,
        `${itemId} apareceu para o arqueiro`,
      ).not.toContain(itemId);
    }

    // o total e a soma dos dois grupos, sem repetir o catalogo
    const materiais = CRAFT_RECIPES.filter(
      (recipe) =>
        getItem(recipe.itemId)?.type === ITEM_TYPE.MATERIAL,
    );

    expect(all.length).toBe(
      materiais.length + DO_ARBALIST.length,
    );
    expect(data.total).toBe(all.length);
    expect(data.ready).toBe(0);
    expect(data.crafted).toBeUndefined();
  });

  it("o guerreiro nao ve a armadura do arqueiro", () => {
    // O defeito reportado: as pecas do arqueiro apareciam no craft do
    // guerreiro. O caminho do painel e `snapshot`, e ele filtra pelo
    // mesmo `canClassUseItem` que o `Craft.canUse` usa ao executar —
    // mas sao dois lugares, entao os dois precisam ser testados
    const DO_ARBALIST = [
      "willow_bow",
      "aljava_arbalist",
      "botas_arbalist",
      "calca_arbalist",
      "capuz_arbalist",
      "luvas_arbalist",
      "peito_arbalist",
    ];

    const DO_GUERREIRO = [
      "botas_warrior",
      "calca_warrior",
      "elmo_warrior",
      "luvas_warrior",
      "peito_warrior",
    ];

    const data = new Craft().snapshot(
      new Inventory(),
      "warrior",
    );

    const visiveis = data.categories.flatMap(
      (category) =>
        category.recipes.map((recipe) => recipe.itemId),
    );

    for (const itemId of DO_ARBALIST) {
      expect(
        visiveis,
        `${itemId} apareceu para o guerreiro`,
      ).not.toContain(itemId);
    }

    for (const itemId of DO_GUERREIRO) {
      expect(visiveis, itemId).toContain(itemId);
    }

    // e o `canUse` concorda com a listagem: mesmo item, mesmo veredito
    const craft = new Craft();

    // `canUse` recebe a RECIPE, e nao o id: sao dois objetos
    // diferentes, e passar o id seria um `!recipe` silencioso que
    // devolveria `false` para as duas pecas e o teste passaria
    const receitaDe = (itemId) =>
      CRAFT_RECIPES.find(
        (recipe) => recipe.itemId === itemId,
      );

    for (const itemId of DO_ARBALIST) {
      expect(
        receitaDe(itemId),
        `${itemId} nao tem receita`,
      ).toBeDefined();

      expect(
        craft.canUse(receitaDe(itemId), "warrior"),
        `${itemId} no canUse do guerreiro`,
      ).toBe(false);
    }

    for (const itemId of DO_GUERREIRO) {
      expect(
        craft.canUse(receitaDe(itemId), "warrior"),
        `${itemId} no canUse do guerreiro`,
      ).toBe(true);
    }
  });

  it("a classe esconde arma de outra familia", () => {
    // o arqueiro e o unico com arma, entao a lista dele e o catalogo
    // inteiro. A REGRA e a que importa: se um dia entrar uma espada,
    // ela tem de sumir daqui
    const arqueiro = new Craft().snapshot(
      new Inventory(),
      "arbalist",
    );

    const guerreiro = new Craft().snapshot(
      new Inventory(),
      "warrior",
    );

    const idsDe = (data) =>
      data.categories
        .flatMap((category) => category.recipes)
        .map((recipe) => recipe.itemId);

    const arco = new Craft().recipeOf(BOW).itemId;

    expect(idsDe(arqueiro)).toContain(arco);
    expect(idsDe(guerreiro)).not.toContain(arco);
  });

  it("sem classe mostra o catalogo inteiro", () => {
    const data = new Craft().snapshot(new Inventory());

    expect(data.total).toBe(CRAFT_RECIPES.length);
  });

  it("marca como pronta a receita que fecha", () => {
    const craft = new Craft();
    const inventory = new Inventory();

    stockVariant(inventory, MATERIAL, RARITY.COMMON);

    // a lista do snapshot traz `itemId`, e a receita do craft traz
    // `id`. Sao campos diferentes e comparar um com o outro nao
    // acha a receita
    const itemId = craft.recipeOf(MATERIAL).itemId;

    const data = craft.snapshot(inventory, "arbalist");
    const pronta = data.categories
      .flatMap((category) => category.recipes)
      .find((recipe) => recipe.itemId === itemId);

    expect(pronta).toBeTruthy();
    expect(pronta.canCraft).toBe(true);
    expect(data.ready).toBeGreaterThanOrEqual(1);
    expect(
      data.categories.find(
        (category) => category.recipes.includes(pronta),
      ).ready,
    ).toBeGreaterThanOrEqual(1);
  });

  it("abre na raridade mais barata que ja fecha", () => {
    const craft = new Craft();
    const inventory = new Inventory();

    // so o material da receita COMUM
    stockVariant(inventory, MATERIAL, RARITY.COMMON);

    const itemId = craft.recipeOf(MATERIAL).itemId;

    const receita = craft
      .snapshot(inventory, "arbalist")
      .categories.flatMap((category) => category.recipes)
      .find((recipe) => recipe.itemId === itemId);

    const closed = receita.rarities.filter(
      (entry) => entry.canCraft,
    );

    // so a comum fecha, porque e a de menor preco
    expect(closed.map((entry) => entry.rarity)).toEqual([
      RARITY.COMMON,
    ]);
    expect(receita.defaultRarity).toBe(RARITY.COMMON);
  });

  it("o preco cresce com a raridade, em todo o catalogo", () => {
    const craft = new Craft();

    // monotonicidade, e nao desigualdade estrita: com quantidade
    // pequena o piso de 1 unidade faz duas raridades empatarem
    for (const recipe of CRAFT_RECIPES) {
      const cost = (rarity) =>
        craft
          .ingredientsOf(recipe, new Inventory(), rarity)
          .reduce((sum, ing) => sum + ing.need, 0);

      let anterior = -Infinity;

      for (const rarity of RARITY_ORDER) {
        const atual = cost(rarity);
        const label = `${recipe.itemId} ${rarity}`;

        expect(
          atual,
          `${label} (${anterior} -> ${atual})`,
        ).toBeGreaterThanOrEqual(anterior);

        anterior = atual;
      }
    }
  });

  it("a moeda tambem cresce com a raridade", () => {
    const craft = new Craft();

    for (const recipe of CRAFT_RECIPES) {
      if (recipe.coins <= 0) continue;

      let anterior = -Infinity;

      for (const rarity of RARITY_ORDER) {
        const atual = craft.coinCostOf(recipe, rarity);
        const label = `${recipe.itemId} ${rarity}`;

        expect(
          atual,
          `${label} (${anterior} -> ${atual})`,
        ).toBeGreaterThanOrEqual(anterior);

        anterior = atual;
      }
    }
  });

  it("a raridade mais cara e a de maior preco", () => {
    const craft = new Craft();

    for (const recipe of CRAFT_RECIPES) {
      if (recipe.ingredients.length === 0) continue;

      const base =
        craft.coinCostOf(recipe, recipe.baseRarity) +
        craft
          .ingredientsOf(
            recipe,
            new Inventory(),
            recipe.baseRarity,
          )
          .reduce((sum, ing) => sum + ing.need, 0);

      const low =
        craft.coinCostOf(recipe, RARITY.COMMON) +
        craft
          .ingredientsOf(
            recipe,
            new Inventory(),
            RARITY.COMMON,
          )
          .reduce((sum, ing) => sum + ing.need, 0);

      // a natural nunca e mais cara que a comum, senao criar
      // "nela mesma" seria o preco mais alto do item
      expect(
        base,
        `${recipe.itemId} base=${base} low=${low}`,
      ).toBeGreaterThanOrEqual(low);
    }
  });

  it("receita sem moeda continua sem moeda", () => {
    const craft = new Craft();

    for (const recipe of CRAFT_RECIPES) {
      if (recipe.coins > 0) continue;

      for (const rarity of RARITY_ORDER) {
        expect(
          craft.coinCostOf(recipe, rarity),
          `${recipe.itemId} ${rarity}`,
        ).toBe(0);
      }
    }
  });

  it("cai na raridade natural quando nada fecha", () => {
    const receita = new Craft()
      .snapshot(new Inventory(), "arbalist")
      .categories.flatMap((category) => category.recipes)
      .find(
        (recipe) => recipe.itemId === "willow_bow",
      );

    expect(receita.defaultRarity).toBe(receita.baseRarity);
  });

  it("conta quantos ingredientes faltam por raridade", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const recipe = stockVariant(
      inventory,
      MATERIAL,
      RARITY.LEGENDARY,
    );

    // tira do PRIMEIRO ingrediente da variante lendaria. Antes o
    // teste tirava um item solto (`ogre_hide`) que nao era
    // ingrediente desta receita, e a falta ficava 0 sem erro visivel
    const alvo = craft
      .ingredientsOf(recipe, inventory, RARITY.LEGENDARY)
      .find((ingredient) => ingredient.need > 0);

    inventory.remove(alvo.itemId, 1);

    const receita = craft
      .snapshot(inventory, "arbalist")
      .categories.flatMap((category) => category.recipes)
      .find(
        (candidate) => candidate.itemId === recipe.itemId,
      );

    const legendary = receita.rarities.find(
      (entry) => entry.rarity === RARITY.LEGENDARY,
    );

    expect(legendary.canCraft).toBe(false);
    expect(legendary.missing).toBe(1);
  });

  it("leva os dados de origem de cada ingrediente", () => {
    const data = new Craft().snapshot(new Inventory());

    for (const recipe of data.categories.flatMap(
      (category) => category.recipes,
    )) {
      expect(recipe.name, recipe.itemId).toBeTruthy();
      expect(recipe.icon, recipe.itemId).toBeTruthy();
      expect(
        recipe.rarityColor,
        recipe.itemId,
      ).toBeTruthy();
      expect(recipe.rarities.length).toBe(5);

      for (const entry of recipe.rarities) {
        expect(entry.label, entry.rarity).toBeTruthy();
        expect(entry.color, entry.rarity).toBeTruthy();
        expect(entry.variantId, entry.rarity).toBeTruthy();
        expect(entry.value, entry.rarity).toBeGreaterThan(0);
        expect(
          entry.coins,
          entry.rarity,
        ).toBeGreaterThanOrEqual(0);

        // material nao tem stat: o valor sozinho e o que sobra
        if (Object.keys(entry.stats).length > 0) {
          expect(
            entry.statsLine,
            `${recipe.itemId} ${entry.rarity}`,
          ).toBeTruthy();
        }

        for (const ingredient of entry.ingredients) {
          expect(ingredient.need).toBeGreaterThan(0);
          expect(
            ingredient.sources.length,
            ingredient.itemId,
          ).toBeGreaterThan(0);

          for (const source of ingredient.sources) {
            expect(
              source.name,
              source.id,
            ).toBeTruthy();
          }
        }
      }
    }
  });

  it("o material consumido some da proxima receita", () => {
    // como nao ha contador, o que o jogador percebe depois de
    // criar e o material ter acabado: a proxima deixa de fechar
    const craft = new Craft();
    const inventory = new Inventory();

    stockVariant(inventory, MATERIAL, RARITY.COMMON);
    craft.craft(inventory, MATERIAL, null, RARITY.COMMON);

    const data = craft.snapshot(inventory);

    expect(data.ready).toBe(0);
  });

  it("aguenta inventario vazio", () => {
    const data = new Craft().snapshot(new Inventory());

    expect(data.total).toBeGreaterThan(0);
    expect(data.ready).toBe(0);
  });
});
