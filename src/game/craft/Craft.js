import {
  CRAFT_CATEGORIES,
  CRAFT_RECIPES,
  dropSourcesOf,
  getCraftRecipe,
  getCraftVariant,
  variantsOf,
} from "../../data/craft/index.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import {
  canCraftItem,
  classesOfItem,
  isExclusiveToClass,
} from "../../data/craft/craftPorClasse.js";
import {
  RARITY_ORDER,
  RARITY_STYLE,
  WEAPON_KIND_LABEL,
  getItem,
  isStackable,
  rarityOf,
  statsAt,
  valueAt,
} from "../../data/items/index.js";

export const CRAFT_RESULT = {
  OK: "ok",
  UNKNOWN: "receita desconhecida",
  MISSING: "faltam materiais",
  FULL: "mochila cheia",
  LOCKED: "item de outra classe",
  COINS: "moedas insuficientes",
};

const CLASS_NAME = Object.fromEntries(
  CHARACTER_CLASSES.map((entry) => [entry.id, entry.name]),
);

const FRACTION_STATS = new Set(["attackSpeed"]);

const STAT_LABELS = {
  attack: "ATQ",
  defense: "DEF",
  maxHp: "HP",
  speed: "VEL",
  attackSpeed: "VEL. ATQ",
  resourceRegen: "REG",
  resource: "REC",
};

function describeStats(stats) {
  return Object.entries(stats ?? {})
    .map(([stat, value]) => {
      const label = STAT_LABELS[stat] ?? stat;
      const sign = value > 0 ? "+" : "";

      return FRACTION_STATS.has(stat)
        ? `${label} ${sign}${Math.round(value * 100)}%`
        : `${label} ${sign}${Math.round(value)}`;
    })
    .join("  ·  ");
}

/**
 * Fabrica de receitas.
 *
 * Nao guarda contagem de nada: o estado do craft e a propria
 * mochila. Nao existe meta nem limite de criacao, entao um
 * "criados: N" so faria o jogador sentir que precisa fechar um
 * placar em vez de criar o que quiser.
 */
export class Craft {
  recipeOf(id) {
    return getCraftRecipe(id);
  }

  /**
   * Quem pode criar esta receita.
   *
   * A regra e uma so: MATERIAL e comum, EQUIPAMENTO e de uma
   * classe. A trava mora em `data/items/index.js`
   * (`canClassUseItem`, que le a familia da arma), e este metodo so
   * pergunta. Nenhuma lista de classes mora aqui, porque uma lista
   * paralela divergiria da familia sem ninguem perceber.
   */
  canUse(recipe, classId) {
    if (!recipe) return false;

    // sem classe nao ha o que restringir: a lista mostra o
    // catalogo inteiro. Sem esse desvio, um snapshot sem classe
    // esconderia TODAS as armas, porque nenhuma classe e "null".
    if (classId === null || classId === undefined) {
      return true;
    }

    return canCraftItem(recipe.itemId, classId);
  }

  /**
   * As classes que podem criar o item desta receita.
   *
   * Lista vazia significa "todo mundo": e o caso do material e de
   * qualquer peca sem familia. Uma lista com menos classes que o
   * jogo tem e o item exclusivo, e e o que o painel usa para
   * esconder o item de quem nao e dono em vez de mostrar cadeado
   */
  allowedClassesOf(recipe) {
    const classes = classesOfItem(recipe?.itemId);

    if (classes === null) {
      return [];
    }

    return classes.map(
      (classId) =>
        CLASS_NAME[classId] ?? classId,
    );
  }

  /** o item e de uma classe so, ou e de todo mundo? */
  isExclusive(recipe) {
    return isExclusiveToClass(recipe?.itemId);
  }

  /**
   * O que a receita custa naquela raridade.
   *
   * `rarity` nulo cai na raridade natural do item, entao os
   * chamadores antigos continuam funcionando.
   */
  variantOf(itemId, rarity = null) {
    return getCraftVariant(itemId, rarity);
  }

  /**
   * O que falta para criar nesta raridade, ingrediente a
   * ingrediente. Sem `rarity`, usa a receita na raridade natural.
   */
  ingredientsOf(recipe, inventory, rarity = null) {
    const variant = this.variantOf(
      recipe.itemId ?? recipe,
      rarity,
    );

    if (!variant) return [];

    return variant.ingredients.map((ingredient) => {
      const item = getItem(ingredient.itemId);
      const have = inventory
        ? inventory.count(ingredient.itemId)
        : 0;

      return {
        itemId: ingredient.itemId,
        name: item?.name ?? ingredient.itemId,
        icon: item?.icon ?? "◆",
        rarity: item?.rarity ?? null,
        need: ingredient.count,
        have,
        // o que falta e clampado em zero: um excedente de
        // ingrediente e um bom sinal, nao um numero negativo
        missing: Math.max(0, ingredient.count - have),
        ok: have >= ingredient.count,
        sources: dropSourcesOf(ingredient.itemId),
      };
    });
  }

  canCraft(
    recipe,
    inventory,
    classId = null,
    rarity = null,
  ) {
    if (!recipe || !inventory) return false;

    if (!this.canUse(recipe, classId)) return false;

    const variant = this.variantOf(recipe.itemId, rarity);

    if (!variant) return false;

    if (this.ingredientsOf(recipe, inventory, rarity).some(
      (ingredient) => !ingredient.ok,
    )) {
      return false;
    }

    if (
      (inventory.coins ?? 0) <
      this.coinCostOf(recipe, rarity)
    ) {
      return false;
    }

    return this.fits(inventory, recipe.itemId, variant.rarity);
  }

  /** quanto custa a receita em moeda naquela raridade */
  coinCostOf(recipe, rarity = null) {
    return (
      this.variantOf(recipe?.itemId, rarity)?.coins ?? 0
    );
  }

  /**
   * O resultado precisa caber antes de gastar ingrediente.
   * Sem esta checagem o jogador perderia os materiais para um item
   * que foi para o chao.
   */
  fits(inventory, itemId, rarity = null) {
    const item = getItem(itemId);

    if (!item) return false;

    if (isStackable(item)) {
      const stack = inventory.findStack(itemId, rarity);
      const room = item.maxStack - (stack?.count ?? 0);

      return room > 0;
    }

    return inventory.freeSlots > 0;
  }

  /**
   * Consome os ingredientes e entrega o item, ou nao mexe em
   * nada. A checagem vem inteira antes de qualquer remocao para
   * o craft nunca ser parcialmente aplicado.
   */
  craft(
    inventory,
    recipeId,
    classId = null,
    rarity = null,
  ) {
    const recipe = this.recipeOf(recipeId);

    if (!recipe) {
      return { ok: false, reason: CRAFT_RESULT.UNKNOWN, recipe: null };
    }

    if (!this.canUse(recipe, classId)) {
      return { ok: false, reason: CRAFT_RESULT.LOCKED, recipe };
    }

    const variant = this.variantOf(
      recipe.itemId,
      rarity,
    );

    if (!variant) {
      return { ok: false, reason: CRAFT_RESULT.UNKNOWN, recipe };
    }

    const ingredients = this.ingredientsOf(
      recipe,
      inventory,
      variant.rarity,
    );

    if (ingredients.some((ingredient) => !ingredient.ok)) {
      return { ok: false, reason: CRAFT_RESULT.MISSING, recipe };
    }

    // a moeda entra na mesma checagem dos materiais: sem esta
    // ordem, um jogador sem moedas perderia os itens e so
    // receberia o aviso depois
    if (
      (inventory.coins ?? 0) < variant.coins
    ) {
      return { ok: false, reason: CRAFT_RESULT.COINS, recipe };
    }

    if (!this.fits(inventory, recipe.itemId, variant.rarity)) {
      return { ok: false, reason: CRAFT_RESULT.FULL, recipe };
    }

    for (const ingredient of ingredients) {
      inventory.remove(ingredient.itemId, ingredient.need);
    }

    inventory.spendCoins(variant.coins);

    // a variante entra na raridade escolhida, e nao na do
    // catalogo: foi o que o jogador pagou para criar
    const result = inventory.add(
      recipe.itemId,
      1,
      variant.rarity,
    );

    return { ok: true, recipe, variant, result };
  }

  get craftableCount() {
    return CRAFT_RECIPES.length;
  }

  /**
   * Uma linha da lista: o item, com as cinco raridades dentro.
   *
   * Item que a classe nao cria NAO entra. A aba de arma do
   * arqueiro so tem arco, e a de armadura tem tudo: esconder e
   * mais honesto que mostrar um item que nunca vai destravar.
   */
  snapshot(inventory, classId = null) {
    const categories = CRAFT_CATEGORIES.map((category) => {
      const recipes = category.recipes
        .filter((recipe) =>
          this.canUse(recipe, classId),
        )
        .map((recipe) => {
          const item = getItem(recipe.itemId);
          const natural = rarityOf(item);

          const rarities = RARITY_ORDER.map(
            (rarityKey) =>
              this.rarityEntry(
                recipe,
                inventory,
                classId,
                rarityKey,
              ),
          );

          return {
            id: recipe.id,
            itemId: recipe.itemId,
            name: item?.name ?? recipe.itemId,
            icon: item?.icon ?? "◆",
            baseRarity: recipe.baseRarity,
            rarity: recipe.baseRarity,
            rarityLabel: natural.label,
            rarityColor: natural.color,
            value: item?.value ?? 0,
            tier: item?.tier ?? 0,
            type: recipe.itemType,
            kind: item?.kind ?? null,
            kindLabel: item?.kind
              ? WEAPON_KIND_LABEL[item.kind] ?? null
              : null,
            stats: item?.stats ?? {},
            ingredientCount: recipe.ingredientCount,
            // o item e de uma classe so? E o que separa "esconder
            // da lista" de "mostrar com cadeado". O item de outra
            // classe nem entra no snapshot, entao o painel nao tem
            // o que decidir: o filtro acontece antes
            exclusive: isExclusiveToClass(recipe.itemId),
            rarities,
            // a aba abre na raridade que ja fecha, se alguma
            defaultRarity:
              rarities.find((entry) => entry.canCraft)
                ?.rarity ?? recipe.baseRarity,
            canCraft: rarities.some((entry) => entry.canCraft),
            missing: rarities.reduce(
              (least, entry) => Math.min(least, entry.missing),
              Infinity,
            ),          };
        });

      return {
        id: category.id,
        label: category.label,
        icon: category.icon,
        recipes,
        ready: recipes.filter((recipe) => recipe.canCraft)
          .length,
      };
    });

    const all = categories.flatMap(
      (category) => category.recipes,
    );

    return {
      categories,
      total: all.length,
      ready: all.filter((recipe) => recipe.canCraft).length,
      coins: inventory?.coins ?? 0,
    };
  }

  /** uma raridade do item, ja com a receita e o que falta */
  rarityEntry(recipe, inventory, classId, rarity) {
    const variant = this.variantOf(recipe.itemId, rarity);
    const style = RARITY_STYLE[rarity];
    const ingredients = this.ingredientsOf(
      recipe,
      inventory,
      rarity,
    );
    const coins = variant?.coins ?? 0;
    const haveCoins = inventory?.coins ?? 0;

    return {
      rarity,
      variantId: variant?.id ?? null,
      label: style?.label ?? rarity,
      color: style?.color ?? null,
      isBase: variant?.isBaseRarity === true,
      stats: statsAt(recipe.itemId, rarity),
      statsLine: describeStats(statsAt(recipe.itemId, rarity)),
      value: valueAt(recipe.itemId, rarity),
      coins,
      haveCoins,
      shortOnCoins: coins > haveCoins,
      ingredients,
      canCraft: this.canCraft(
        recipe,
        inventory,
        classId,
        rarity,
      ),
      missing: ingredients.filter(
        (ingredient) => !ingredient.ok,
      ).length,
    };
  }
}
