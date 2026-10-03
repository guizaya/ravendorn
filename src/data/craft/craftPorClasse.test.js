import { describe, expect, it } from "vitest";
import {
  canCraftItem,
  classesOfItem,
  isExclusiveToClass,
} from "./craftPorClasse.js";
import {
  gerarReceitaEquipamento,
} from "./gerarEquipamento.js";
import {
  CRAFT_RECIPES,
  getCraftRecipe,
} from "./index.js";
import {
  ITEM_TYPE,
  RARITY_ORDER,
  getItem,
} from "../items/index.js";
import { CHARACTER_CLASSES } from "../characters/index.js";
import { Craft } from "../../game/craft/Craft.js";
import { Inventory } from "../../game/inventory/Inventory.js";

const IDS = CHARACTER_CLASSES.map((c) => c.id);
const DEMAIS = (dono) => IDS.filter((id) => id !== dono);

describe("craft por classe: a regra", () => {
  it("material e comum para todas as classes", () => {
    for (const item of ["dummy_wood", "skeleton_bone", "ogre_hide"]) {
      // `null` e "todo mundo pode", que e diferente de lista vazia
      expect(classesOfItem(item), item).toBe(null);
      expect(isExclusiveToClass(item), item).toBe(false);

      for (const classId of IDS) {
        expect(canCraftItem(item, classId), `${item}/${classId}`).toBe(
          true,
        );
      }
    }
  });

  it("arma e de uma classe so", () => {
    expect(classesOfItem("willow_bow")).toEqual(["arbalist"]);
    expect(isExclusiveToClass("willow_bow")).toBe(true);

    expect(canCraftItem("willow_bow", "arbalist")).toBe(true);

    for (const classId of DEMAIS("arbalist")) {
      expect(canCraftItem("willow_bow", classId), classId).toBe(
        false,
      );
    }
  });

  it("item que nao existe nao trava ninguem em silencio", () => {
    // `null` e nao lista vazia: um id errado no gerador apareceria
    // como "ninguem pode criar" e nao como erro
    expect(classesOfItem("nao_existe")).toBe(null);
  });
});

describe("craft por classe: no painel", () => {
  const ARMEIRO = "arbalist";

  it("o arco some da lista de quem nao e arbalist", () => {
    const craft = new Craft();

    for (const classId of DEMAIS(ARMEIRO)) {
      const lista = craft
        .snapshot(new Inventory(), classId)
        .categories.flatMap((c) => c.recipes)
        .map((r) => r.itemId);

      expect(lista, classId).not.toContain("willow_bow");
    }
  });

  it("o arco aparece para o arbalist, marcado como exclusivo", () => {
    const craft = new Craft();

    const linha = craft
      .snapshot(new Inventory(), ARMEIRO)
      .categories.flatMap((c) => c.recipes)
      .find((r) => r.itemId === "willow_bow");

    expect(linha).toBeDefined();
    expect(linha.exclusive).toBe(true);
  });

  it("material continua na lista de todas as classes", () => {
    const craft = new Craft();

    for (const classId of IDS) {
      const lista = craft
        .snapshot(new Inventory(), classId)
        .categories.flatMap((c) => c.recipes)
        .map((r) => r.itemId);

      expect(lista, classId).toContain("dummy_wood");
    }
  });

  it("allowedClassesOf devolve o nome de quem pode criar", () => {
    const craft = new Craft();

    expect(
      craft.allowedClassesOf(craft.recipeOf("willow_bow")),
    ).toEqual(["Arbalist"]);

    // material e todo mundo: lista vazia, nao lista com quatro nomes
    expect(
      craft.allowedClassesOf(craft.recipeOf("dummy_wood")),
    ).toEqual([]);
  });

  it("recusa a receita de outra classe sem gastar material", () => {
    const craft = new Craft();
    const inventory = new Inventory();
    const receita = craft.recipeOf("willow_bow");

    // estoque generoso: o que barra e a trava, nao a falta
    for (const ing of craft.ingredientsOf(receita, inventory)) {
      inventory.add(ing.itemId, ing.need);
    }

    const antes = inventory.count("dummy_wood");

    const r = craft.craft(inventory, receita.id, "warrior");

    expect(r.ok).toBe(false);
    expect(r.reason).toBe("item de outra classe");
    expect(inventory.count("dummy_wood")).toBe(antes);
  });
});

describe("gerador de equipamento", () => {
  const r = gerarReceitaEquipamento({
    itemId: "teste",
    base: 2,
    materiais: ["baixo", "alto"],
  });

  it("devolve as cinco raridades", () => {
    for (const rarity of RARITY_ORDER) {
      expect(r[rarity], rarity).toBeDefined();
      expect(r[rarity].ingredients.length, rarity).toBeGreaterThan(
        0,
      );
    }
  });

  it("o topo aponta para a raridade natural", () => {
    // e o que os chamadores antigos leem: `coins` e `ingredients` no
    // topo tem de ser a variante que o item tem no catalogo
    expect(r.ingredients).toEqual(r.common.ingredients);
    expect(r.coins).toBe(r.common.coins);
  });

  it("subir de raridade nunca fica mais barato", () => {
    for (let i = 1; i < RARITY_ORDER.length; i += 1) {
      const anterior = r[RARITY_ORDER[i - 1]];
      const atual = r[RARITY_ORDER[i]];

      const custo = (v) =>
        v.ingredients.reduce((s, ing) => s + ing.count, 0) +
        v.coins;

      expect(
        custo(atual),
        RARITY_ORDER[i],
      ).toBeGreaterThan(custo(anterior));
    }
  });

  it("a lendaria troca ingrediente, e nao so multiplica", () => {
    // a regra de design que a auditoria de craftData exige: um
    // lendario de mais do mesmo material e mais caro, nao melhor
    const comuns = new Set(
      r.common.ingredients.map((ing) => ing.itemId),
    );

    const temNovo = r.legendary.ingredients.some(
      (ing) => !comuns.has(ing.itemId),
    );

    expect(temNovo).toBe(true);
  });

  it("o material de nivel alto so entra na raridade que o permite", () => {
    for (const ing of r.common.ingredients) {
      expect(
        r.common.ingredients.filter(
          (outro) => outro.itemId === ing.itemId,
        ).length,
      ).toBe(1);
    }

    // nenhum material de `alto` aparece antes do `rare`
    const alto = r.rare.ingredients.find(
      (ing) => !r.common.ingredients.some(
        (outro) => outro.itemId === ing.itemId,
      ),
    );

    if (alto) {
      expect(r.common.ingredients.map((i) => i.itemId)).not.toContain(
        alto.itemId,
      );
    }
  });

  it("nenhum ingrediente vale zero", () => {
    // zero seria um ingrediente de graca, e a receita contaria como
    // mais barata sem ser
    for (const rarity of RARITY_ORDER) {
      for (const ing of r[rarity].ingredients) {
        expect(ing.count, `${rarity}/${ing.itemId}`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("sobe de raridade com o material base mais caro", () => {
    for (let i = 1; i < RARITY_ORDER.length; i += 1) {
      const antes = r[RARITY_ORDER[i - 1]].ingredients[0].count;
      const agora = r[RARITY_ORDER[i]].ingredients[0].count;

      expect(agora, RARITY_ORDER[i]).toBeGreaterThan(antes);
    }
  });

  it("o material gerado existe no catalogo", () => {
    for (const rarity of RARITY_ORDER) {
      for (const ing of r[rarity].ingredients) {
        expect(
          getItem(ing.itemId),
          `${rarity}/${ing.itemId}`,
        ).not.toBe(null);

        expect(getItem(ing.itemId).type, ing.itemId).toBe(
          ITEM_TYPE.MATERIAL,
        );
      }
    }
  });
});

describe("craft por classe: o catalogo inteiro", () => {
  it("toda arma do catalogo tem uma unica dona", () => {
    const armas = CRAFT_RECIPES.filter(
      (r) => getItem(r.itemId)?.type === ITEM_TYPE.WEAPON,
    );

    expect(armas.length).toBeGreaterThan(0);

    for (const receita of armas) {
      const donas = classesOfItem(receita.itemId);

      expect(donas, receita.itemId).not.toBe(null);
      expect(donas.length, receita.itemId).toBe(1);
      expect(donas[0], receita.itemId).toBe(IDS[0] ? donas[0] : null);
    }
  });

  it("toda arma tem pelo menos um material disponivel na comum", () => {
    // sem isto, o item existe mas nao da para começar: a cadeia
    // comeca em material e ele precisa estar na receita comum
    for (const receita of CRAFT_RECIPES) {
      if (getItem(receita.itemId)?.type !== ITEM_TYPE.WEAPON) {
        continue;
      }

      expect(
        receita.common.ingredients.length,
        receita.itemId,
      ).toBeGreaterThan(0);
    }
  });

  it("o arco e a unica arma, e e do arbalist", () => {
    const armas = CRAFT_RECIPES.filter(
      (r) => getItem(r.itemId)?.type === ITEM_TYPE.WEAPON,
    );

    // as duas pecas do arbalist. A lista vem do filtro, e nao de
    // ids escritos a mao, para um item novo entrar aqui pelo fato de
    // existir — e para o teste avisar se entrar o que NAO deveria
    expect(armas.map((r) => r.itemId)).toEqual([
      "willow_bow",
      "aljava_arbalist",
    ]);

    // e as duas sao do arbalist: e o que faz o craft dele ter duas
    // armas e o das outras classes nenhuma
    expect(classesOfItem("willow_bow")).toEqual(["arbalist"]);
    expect(classesOfItem("aljava_arbalist")).toEqual(["arbalist"]);
  });

  it("nenhuma receita de equipamento e criavel por duas classes", () => {
    // a trava e por familia, e cada familia tem um dono. Se uma
    // familia ganhasse duas donas, o craft deixaria de ser por
    // classe sem nenhum teste falhar
    for (const receita of CRAFT_RECIPES) {
      const item = getItem(receita.itemId);

      if (item?.type !== ITEM_TYPE.WEAPON) continue;
      if (!item.kind) continue;

      expect(
        classesOfItem(receita.itemId).length,
        receita.itemId,
      ).toBe(1);
    }
  });

  it("toda receita de material e de material", () => {
    for (const receita of CRAFT_RECIPES) {
      const item = getItem(receita.itemId);

      if (item?.type !== ITEM_TYPE.MATERIAL) continue;

      expect(
        isExclusiveToClass(receita.itemId),
        receita.itemId,
      ).toBe(false);
    }
  });

  it("o getCraftRecipe acha a receita do arco pelo id do item", () => {
    expect(getCraftRecipe("willow_bow")?.id).toBe(
      "craft_willow_bow",
    );
  });
});
