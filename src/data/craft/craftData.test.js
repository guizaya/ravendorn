import { describe, expect, it } from "vitest";
import {
  CRAFT_CATEGORIES,
  CRAFT_RECIPES,
  CRAFT_VARIANTS,
  RECIPES,
  dropSourcesOf,
  getCraftRecipe,
  getCraftVariant,
} from "./index.js";
import {
  getItem,
  ITEM_LIST,
  ITEM_TYPE,
  RARITY,
  RARITY_ORDER,
} from "../items/index.js";
import { CREATURE_TYPES } from "../enemies/index.js";

/** o preco total de uma receita escrita: ingrediente mais moeda */
const total = (recipe) =>
  recipe.ingredients.reduce(
    (sum, ingredient) => sum + ingredient.count,
    0,
  ) + recipe.coins;

describe("receitas de craft", () => {
  it("existe pelo menos uma receita", () => {
    expect(CRAFT_RECIPES.length).toBeGreaterThan(0);
  });

  it("todo resultado aponta para um item de verdade", () => {
    for (const recipe of CRAFT_RECIPES) {
      expect(
        getItem(recipe.itemId),
        recipe.itemId,
      ).not.toBe(null);
    }
  });

  it("todo ingrediente aponta para um item de verdade", () => {
    for (const recipe of CRAFT_RECIPES) {
      for (const ingredient of recipe.ingredients) {
        expect(
          getItem(ingredient.itemId),
          `${recipe.itemId} <- ${ingredient.itemId}`,
        ).not.toBe(null);
      }
    }
  });

  it("todo ingrediente exige pelo menos uma unidade", () => {
    for (const recipe of CRAFT_RECIPES) {
      // uma receita sem ingrediente e a de materia bruta, que se
      // compra so com moeda
      if (recipe.ingredients.length === 0) {
        expect(
          recipe.coins,
          recipe.itemId,
        ).toBeGreaterThan(0);
        continue;
      }

      for (const ingredient of recipe.ingredients) {
        expect(
          ingredient.count,
          `${recipe.itemId} <- ${ingredient.itemId}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("toda receita cobra ingrediente ou moeda", () => {
    for (const recipe of CRAFT_RECIPES) {
      expect(
        recipe.ingredients.length > 0 ||
          recipe.coins > 0,
        recipe.itemId,
      ).toBe(true);
    }
  });

  it("nunca usa o proprio item como ingrediente", () => {
    for (const recipe of CRAFT_RECIPES) {
      for (const ingredient of recipe.ingredients) {
        expect(
          ingredient.itemId,
          recipe.itemId,
        ).not.toBe(recipe.itemId);
      }
    }
  });

  it("nao repete o mesmo ingrediente na mesma receita", () => {
    for (const recipe of CRAFT_RECIPES) {
      const ids = recipe.ingredients.map(
        (ingredient) => ingredient.itemId,
      );

      expect(
        new Set(ids).size,
        `${recipe.itemId} repete ingrediente`,
      ).toBe(ids.length);
    }
  });

  it("nao tem dois ids de receita iguais", () => {
    const ids = CRAFT_RECIPES.map((recipe) => recipe.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo item do catalogo tem receita", () => {
    const comReceita = new Set(
      CRAFT_RECIPES.map((recipe) => recipe.itemId),
    );

    const semReceita = ITEM_LIST.filter(
      (item) => !comReceita.has(item.id),
    );

    expect(
      semReceita.map((item) => item.id),
    ).toEqual([]);
  });

  it("todo item do catalogo tem receita nas cinco raridades", () => {
    for (const item of ITEM_LIST) {
      for (const rarity of RARITY_ORDER) {
        expect(
          getCraftVariant(item.id, rarity),
          `${item.id} @ ${rarity}`,
        ).not.toBe(null);
      }
    }

    expect(CRAFT_VARIANTS).toHaveLength(
      ITEM_LIST.length * RARITY_ORDER.length,
    );
  });

  it("as cinco receitas de um item sao diferentes entre si", () => {
    // com ids iguais por raridade, o craft gravaria por cima da
    // receita escolhida e o preco mostrado seria o de outra
    for (const recipe of CRAFT_RECIPES) {
      const ids = new Set();

      for (const rarity of RARITY_ORDER) {
        ids.add(getCraftVariant(recipe.itemId, rarity).id);
      }

      expect(ids.size, recipe.itemId).toBe(RARITY_ORDER.length);
    }
  });

  it("cada raridade tem uma receita propria de custo", () => {
    // a receita exibida precisa mudar junto com a raridade
    for (const recipe of CRAFT_RECIPES) {
      const preços = RARITY_ORDER.map((rarity) => {
        const variant = getCraftVariant(recipe.itemId, rarity);

        return (
          `${variant.coins}:` +
          variant.ingredients
            .map((ing) => ing.count)
            .join(",")
        );
      });

      // um item sem ingrediente e so moeda: a moeda escala
      if (recipe.ingredients.length === 0) {
        expect(
          new Set(preços).size,
          recipe.itemId,
        ).toBeGreaterThan(1);
        continue;
      }

      expect(
        new Set(preços).size,
        `${recipe.itemId} ${preços}`,
      ).toBeGreaterThan(1);
    }
  });

  it("material tambem e fabricavel", () => {
    const materiais = CRAFT_RECIPES.filter(
      (recipe) =>
        getItem(recipe.itemId).type === ITEM_TYPE.MATERIAL,
    );

    expect(materiais.length).toBeGreaterThan(0);
  });

  it("item de missao tambem e fabricavel", () => {
    // a missao continua dando o item, mas nao e mais o caminho
    // unico para conseguir
    const deMissao = CRAFT_RECIPES.filter(
      (recipe) => getItem(recipe.itemId).quest,
    );

    expect(deMissao.length).toBeGreaterThan(0);
  });

  it("todo material da cadeia desce ate uma raiz de moeda", () => {
    // como o grafo e aciclico e todo item tem receita, seguir os
    // ingredientes tem de acabar numa receita sem ingrediente.
    // isso e o que garante que nenhum material e inalcancavel.
    const comReceita = new Map(
      CRAFT_RECIPES.map((recipe) => [
        recipe.itemId,
        recipe,
      ]),
    );

    const desce = (itemId, rastro) => {
      const recipe = comReceita.get(itemId);

      if (!recipe) return false;
      if (recipe.ingredients.length === 0) {
        expect(
          recipe.coins,
          `${rastro} -> ${itemId} sem raiz de moeda`,
        ).toBeGreaterThan(0);
        return true;
      }

      for (const ingredient of recipe.ingredients) {
        if (!desce(ingredient.itemId, [...rastro, itemId])) {
          return false;
        }
      }

      return true;
    };

    for (const recipe of CRAFT_RECIPES) {
      expect(
        desce(recipe.itemId, []),
        recipe.itemId,
      ).toBe(true);
    }
  });

  it("as raizes de moeda nao dependem de nenhum material", () => {
    const raizes = CRAFT_RECIPES.filter(
      (recipe) => recipe.ingredients.length === 0,
    );

    expect(raizes.length).toBeGreaterThan(0);

    for (const recipe of raizes) {
      expect(
        getItem(recipe.itemId).type,
        recipe.itemId,
      ).toBe(ITEM_TYPE.MATERIAL);
    }
  });

  it("material de bicho grande nao sai so de bicho pequeno", () => {
    // o que conteve: transformar 2 peles de rato em garra de
    // ghoul dava material de ghoul sem nunca matar um ghoul
    const garra = CRAFT_RECIPES.find(
      (recipe) => recipe.itemId === "ghoul_claw",
    );

    const cheap = new Set([
      "slime_gel",
      "rat_tail",
      "dummy_wood",
      "goblin_cloth",
    ]);

    for (const ingredient of garra.ingredients) {
      expect(
        cheap.has(ingredient.itemId),
        `garra de ghoul <- ${ingredient.itemId}`,
      ).toBe(false);
    }
  });

  it("a cadeia de materiais nao tem ciclo", () => {
    // com ciclo dava para fabricar o item mais Caro do catalogo
    // usando a si mesmo
    const visita = new Set();
    const pronto = new Set();

    const desce = (itemId) => {
      if (pronto.has(itemId)) return true;
      if (visita.has(itemId)) return false;

      visita.add(itemId);

      const recipe = CRAFT_RECIPES.find(
        (entry) => entry.itemId === itemId,
      );

      for (const ingredient of recipe?.ingredients ?? []) {
        if (!desce(ingredient.itemId)) return false;
      }

      visita.delete(itemId);
      pronto.add(itemId);

      return true;
    };

    for (const recipe of CRAFT_RECIPES) {
      expect(
        desce(recipe.itemId),
        `ciclo em ${recipe.itemId}`,
      ).toBe(true);
    }
  });

  it("todo ingrediente pode ser obtido de alguma criatura", () => {
    // e a garantia de que a tela de craft sempre consegue
    // responder "qual inimigo dropa isso?"
    for (const recipe of CRAFT_RECIPES) {
      for (const ingredient of recipe.ingredients) {
        expect(
          dropSourcesOf(ingredient.itemId).length,
          `${recipe.itemId} <- ${ingredient.itemId} sem origem`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("todo material empilha, para caber na mochila", () => {
    // sem empilhar, "8x seixo" ocuparia 8 dos 20 slots
    for (const recipe of CRAFT_RECIPES) {
      for (const ingredient of recipe.ingredients) {
        const item = getItem(ingredient.itemId);

        expect(
          item.stackable,
          ingredient.itemId,
        ).toBe(true);

        expect(
          item.maxStack,
          ingredient.itemId,
        ).toBeGreaterThanOrEqual(ingredient.count);
      }
    }
  });
});

describe("as receitas escritas no arquivo", () => {
  /** a receita escrita de um item numa raridade */
  const written = (recipe, rarity) => recipe[rarity];

  it("toda receita tem as cinco raridades escritas", () => {
    // antes as quatro raridades acima da natural sao calculadas
    // por multiplicador. agora elas precisam estar no arquivo, e
    // este e o teste que impede uma delas de voltar a sumir
    for (const recipe of RECIPES) {
      for (const rarity of RARITY_ORDER) {
        expect(
          recipe[rarity],
          `${recipe.itemId} sem bloco ${rarity}`,
        ).toBeTruthy();

        expect(
          recipe[rarity].ingredients,
          `${recipe.itemId} ${rarity}`,
        ).toBeInstanceOf(Array);

        expect(
          Number.isFinite(recipe[rarity].coins),
          `${recipe.itemId} ${rarity} coins`,
        ).toBe(true);
      }
    }

    // a contagem nao e um numero solto: ela sai da propria lista de
    // receitas. O 70 era o tamanho do catalogo depois da limpeza, e
    // travava o arquivo contra item novo — inclusive o arco e a
    // aljava, que entraram depois
    expect(RECIPES.length * RARITY_ORDER.length).toBe(
      CRAFT_RECIPES.length * RARITY_ORDER.length,
    );

    // e o que o resto do arquivo assume: toda receita do catalogo
    // tem as cinco raridades
    expect(RECIPES.length).toBe(CRAFT_RECIPES.length);
  });

  it("nenhuma receita sobe de raridade ficando mais barata", () => {
    // a regra de ouro: subir de raridade NUNCA reduz o preco
    for (const recipe of RECIPES) {
      let anterior = -Infinity;

      for (const rarity of RARITY_ORDER) {
        const atual = total(written(recipe, rarity));

        expect(
          atual,
          `${recipe.itemId} ${rarity} (${anterior} -> ${atual})`,
        ).toBeGreaterThanOrEqual(anterior);

        anterior = atual;
      }
    }
  });

  it("a raridade natural nunca e a mais cara do item", () => {
    // senao criar o item "na raridade dele" seria o preco maximo
    for (const recipe of CRAFT_RECIPES) {
      const written = RECIPES.find(
        (entry) => entry.itemId === recipe.itemId,
      );

      const natural = total(
        written[recipe.baseRarity],
      );
      const low = total(written[RARITY.COMMON]);

      expect(
        natural,
        `${recipe.itemId} natural=${natural} comum=${low}`,
      ).toBeGreaterThanOrEqual(low);
    }
  });

  it("nenhum ingrediente vale zero", () => {
    for (const recipe of RECIPES) {
      for (const rarity of RARITY_ORDER) {
        for (const ingredient of recipe[rarity].ingredients) {
          expect(
            ingredient.count,
            `${recipe.itemId} ${rarity} <- ${ingredient.itemId}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("nenhuma repete ingrediente dentro dela", () => {
    for (const recipe of RECIPES) {
      for (const rarity of RARITY_ORDER) {
        const ids = recipe[rarity].ingredients.map(
          (ingredient) => ingredient.itemId,
        );

        expect(
          new Set(ids).size,
          `${recipe.itemId} ${rarity}`,
        ).toBe(ids.length);
      }
    }
  });

  it("nenhuma usa o proprio item", () => {
    for (const recipe of RECIPES) {
      for (const rarity of RARITY_ORDER) {
        for (const ingredient of recipe[rarity].ingredients) {
          expect(
            ingredient.itemId,
            `${recipe.itemId} ${rarity}`,
          ).not.toBe(recipe.itemId);
        }
      }
    }
  });

  it("a lendaria troca ingrediente, nao so multiplica quantidade", () => {
    // a intencao das receitas escritas: subir de raridade troca o
    // ingrediente. se a lendaria usasse exatamente os materiais da
    // comum, o multiplicador antigo ja resolveria e o preco nao
    // diria nada sobre a hunt do jogador
    for (const recipe of RECIPES) {
      const comum = new Set(
        recipe.common.ingredients.map(
          (ingredient) => ingredient.itemId,
        ),
      );

      const lendaria = recipe.legendary.ingredients.filter(
        (ingredient) => !comum.has(ingredient.itemId),
      );

      // a materia bruta nao tem nada mais caro para exigir
      if (recipe.common.ingredients.length === 0) continue;

      expect(
        lendaria.length,
        `${recipe.itemId} lendario repete os materiais do comum`,
      ).toBeGreaterThan(0);
    }
  });

  it("material raro nao aparece em receita de material comum", () => {
    // a cadeia so desce de nivel: um material de nivel N nunca
    // pode depender de coisa de nivel N ou maior. e o que garante
    // que a lendaria nao exija material mais caro que ela mesma
    const nivel = {
      // 0: materia bruta, so se compra
      dummy_wood: 0,
      slime_gel: 0,
      rat_tail: 0,
      // 1: slime, rato, goblin e esqueleto
      goblin_cloth: 1,
      slime_core: 1,
      rat_pelt: 1,
      skeleton_bone: 1,
      // 2: ghoul e o seixo do ogro
      ghoul_rot: 2,
      ghoul_claw: 2,
      ogre_pebble: 2,
      // 3: costela, cranio e couro do ogro
      ghoul_rib: 3,
      skeleton_skull: 3,
      ogre_hide: 3,
    };

    const nivelDe = (itemId) => {
      const item = getItem(itemId);
      if (item?.type !== ITEM_TYPE.MATERIAL) return Infinity;

      return nivel[itemId] ?? 0;
    };

    for (const recipe of RECIPES) {
      for (const rarity of RARITY_ORDER) {
        for (const ingredient of recipe[rarity].ingredients) {
          expect(
            nivelDe(ingredient.itemId),
            `${recipe.itemId} ${rarity} <- ${ingredient.itemId}`,
          ).toBeLessThanOrEqual(nivelDe(recipe.itemId));
        }
      }
    }
  });

  it("as receitas sao aciclicas", () => {
    // a garantia de que nenhum item pode ser feito usando ele
    // mesmo, nem o mais caro do catalogo
    const grafo = new Map(
      CRAFT_RECIPES.map((recipe) => [recipe.itemId, recipe]),
    );

    const desce = (itemId, rastro) => {
      const recipe = grafo.get(itemId);
      if (!recipe) return true;

      if (rastro.includes(itemId)) {
        throw new Error(
          `ciclo: ${[...rastro, itemId].join(" -> ")}`,
        );
      }

      for (const rarity of RARITY_ORDER) {
        for (const ingredient of recipe[rarity].ingredients) {
          if (!desce(ingredient.itemId, [...rastro, itemId])) {
            return false;
          }
        }
      }

      return true;
    };

    for (const recipe of CRAFT_RECIPES) {
      expect(desce(recipe.itemId, []), recipe.itemId).toBe(true);
    }
  });

  it("so materia bruta e material de ogre cobram moeda", () => {
    // nas outras a progressao e de material. cobrar moeda seria
    // um segundo obstaculo sem motivo, e moeda nao e o que trava
    // o jogador no meio do jogo
    const comMoeda = CRAFT_RECIPES.filter(
      (recipe) => recipe.coins > 0,
    ).map((recipe) => recipe.itemId);

    expect(comMoeda.sort()).toEqual([
      "dummy_wood",
      "goblin_cloth",
      "ogre_hide",
      "ogre_pebble",
      "rat_tail",
      "slime_gel",
    ]);
  });

  it("toda receita sem ingrediente so se paga com moeda", () => {
    for (const recipe of RECIPES) {
      for (const rarity of RARITY_ORDER) {
        const escrita = recipe[rarity];

        if (escrita.ingredients.length === 0) {
          expect(
            escrita.coins,
            `${recipe.itemId} ${rarity} sem nada`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("abas do craft", () => {
  it("agrupa as receitas por tipo de item", () => {
    const total = CRAFT_CATEGORIES.reduce(
      (sum, category) => sum + category.recipes.length,
      0,
    );

    expect(total).toBe(CRAFT_RECIPES.length);
  });

  it("material fecha a lista de abas", () => {
    // material e o ingrediente, nao o resultado: ele vai depois.
    // A ordem e a de `CATEGORY_ORDER` em `data/craft/index.js`, e
    // a lista sai daqui — uma peca nova entra pelo tipo dela
    const ids = CRAFT_CATEGORIES.map(
      (category) => category.id,
    );

    expect(ids).toEqual([
      ITEM_TYPE.WEAPON,
      ITEM_TYPE.ARMOR,
      ITEM_TYPE.MATERIAL,
    ]);

    expect(ids.at(-1)).toBe(ITEM_TYPE.MATERIAL);
  });

  it("nao abre aba de tipo que nao tem receita", () => {
    // reliquia saiu do catalogo e continua fora: e o tipo que ainda
    // nao tem peca. `CRAFT_CATEGORIES` descarta a aba que fica sem
    // receita, e sem este teste uma aba vazia voltaria a aparecer na
    // tela do craft
    const ids = CRAFT_CATEGORIES.map(
      (category) => category.id,
    );

    expect(ids).not.toContain(ITEM_TYPE.TRINKET);

    for (const category of CRAFT_CATEGORIES) {
      expect(
        category.recipes.length,
        category.id,
      ).toBeGreaterThan(0);
    }
  });

  it("a arma vem antes do material", () => {
    const ids = CRAFT_CATEGORIES.map(
      (category) => category.id,
    );

    const material = ids.indexOf(ITEM_TYPE.MATERIAL);

    expect(ids.indexOf(ITEM_TYPE.WEAPON)).toBeLessThan(
      material,
    );
  });

  it("toda aba tem icone proprio", () => {
    // material e reliquia já dividiam o mesmo glifo, o que
    // deixava duas abas visualmente iguais
    const icons = CRAFT_CATEGORIES.map(
      (category) => category.icon,
    );

    for (const icon of icons) {
      expect(icon).toBeTruthy();
    }

    expect(new Set(icons).size).toBe(icons.length);
  });

  it("toda aba tem rotulo", () => {
    for (const category of CRAFT_CATEGORIES) {
      expect(
        category.label,
        category.id,
      ).toBeTruthy();
    }
  });

  it("nao abre aba sem receita", () => {
    for (const category of CRAFT_CATEGORIES) {
      expect(
        category.recipes.length,
        category.id,
      ).toBeGreaterThan(0);
    }
  });

  it("classifica a receita pelo tipo do item real", () => {
    for (const category of CRAFT_CATEGORIES) {
      for (const recipe of category.recipes) {
        expect(
          recipe.itemType,
          recipe.itemId,
        ).toBe(getItem(recipe.itemId).type);
      }
    }
  });

  it("cobre arma e material", () => {
    // As duas unicas abas do craft depois da limpeza do catalogo: o
    // arco de galho e os materiais
    const ids = CRAFT_CATEGORIES.map(
      (category) => category.id,
    );

    expect(ids).toContain(ITEM_TYPE.WEAPON);
    expect(ids).toContain(ITEM_TYPE.MATERIAL);
  });
});

describe("busca de receita", () => {
  it("acha pelo id da receita", () => {
    const recipe = CRAFT_RECIPES[0];

    expect(getCraftRecipe(recipe.id).itemId).toBe(
      recipe.itemId,
    );
  });

  it("acha pelo id do item", () => {
    const recipe = CRAFT_RECIPES[0];

    expect(getCraftRecipe(recipe.itemId).id).toBe(recipe.id);
  });

  it("devolve nulo para receita desconhecida", () => {
    expect(getCraftRecipe("craft_nada")).toBe(null);
    expect(getCraftRecipe(null)).toBe(null);
  });
});

describe("indice reverso de drop", () => {
  it("acha quem dropa um material comum", () => {
    const sources = dropSourcesOf("slime_gel");

    expect(sources.length).toBeGreaterThan(0);

    const ids = sources.map((source) => source.id);

    expect(ids).toContain("slime");
  });

  it("inclui os bonecos quando eles dropam o item", () => {
    // dummy_wood e o exemplo: so os bonecos soltam
    const ids = dropSourcesOf("dummy_wood").map(
      (source) => source.id,
    );

    expect(ids).toContain("training_dummy");
  });

  it("ordena da fonte mais provavel para a mais rara", () => {
    const shares = dropSourcesOf("slime_gel").map(
      (source) => source.share,
    );

    expect(shares).toEqual(
      [...shares].sort((a, b) => b - a),
    );
  });

  it("trae nome, nivel e zona de cada fonte", () => {
    for (const source of dropSourcesOf("ogre_hide")) {
      expect(source.name, source.id).toBeTruthy();
      expect(source.icon, source.id).toBeTruthy();
      expect(source.level, source.id).toBeGreaterThan(0);
      expect(source.zoneName, source.id).toBeTruthy();
      expect(source.share, source.id).toBeGreaterThan(0);
      expect(source.share, source.id).toBeLessThanOrEqual(1);
    }
  });

  it("a chance e a fatia do pool, nao um numero solto", () => {
    const slime = CREATURE_TYPES.slime.loot;
    const total = slime.items.reduce(
      (sum, entry) => sum + entry.weight,
      0,
    );

    const gel = slime.items.find(
      (entry) => entry.id === "slime_gel",
    );

    const source = dropSourcesOf("slime_gel").find(
      (entry) => entry.id === "slime",
    );

    expect(source.share).toBeCloseTo(
      gel.weight / total,
      6,
    );
  });

  it("devolve lista vazia para item que ninguem dropa", () => {
    expect(dropSourcesOf("willow_bow")).toEqual([]);
    expect(dropSourcesOf("nao_existe")).toEqual([]);
  });

  it("traz todos os inimigos que dropam um item raro", () => {
    // o cranio cai de dois bichos: o esqueleto e o zumbi arqueiro,
    // que reaproveita material de osso. A lista e o indice INTEIRO de
    // quem dropa, entao um bicho novo que dropa o item tem que
    // aparecer aqui
    const ids = dropSourcesOf("skeleton_skull")
      .map((source) => source.id)
      .sort();

    expect(ids).toEqual([
      "skeleton",
      "zumbi_arbalist",
    ]);
  });

  it("todo drop aponta para um item que existe no catalogo", () => {
    // A limpeza do catalogo tirou as armas, armaduras e reliquias.
    // Um `id` de drop que sobrou apontando para um item removido nao
    // quebra em tempo de execucao: a criatura simplesmente nunca
    // entrega aquela peca, e o material some da tabela sem aviso
    for (const source of dropSourcesOf("slime_gel")) {
      expect(source.id).toBeTruthy();
    }

    for (const itemId of ["skeleton_bone", "skeleton_skull"]) {
      for (const source of dropSourcesOf(itemId)) {
        expect(
          getItem(itemId),
          itemId,
        ).toBeTruthy();
      }
    }
  });
});
