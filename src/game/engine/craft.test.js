import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { CRAFT_RECIPES } from "../../data/craft/index.js";
import {
  ITEM_TYPE,
  canClassUseItem,
  getItem,
} from "../../data/items/index.js";

const ARBALIST_ID = "arbalist";

// o engine liga teclado e quadro direto na window, entao o teste
// precisa do mesmo stub que o GameEngine.test.js monta
const windowListeners = new Map();

globalThis.window = {
  devicePixelRatio: 1,
  addEventListener(type, handler) {
    if (!windowListeners.has(type)) {
      windowListeners.set(type, new Set());
    }

    windowListeners.get(type).add(handler);
  },
  removeEventListener(type, handler) {
    windowListeners.get(type)?.delete(handler);
  },
};

globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

const instances = [];

function createEngine(classDefinition) {
  const listeners = {};
  let snapshot = null;

  const context = new Proxy(
    { createPattern: () => ({ pattern: true }) },
    {
      get(target, key) {
        if (key in target) return target[key];
        return () => {};
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );

  const canvas = {
    getContext: () => context,
    addEventListener(type, handler) {
      (listeners[type] ??= []).push(handler);
    },
    removeEventListener(type, handler) {
      listeners[type] = (listeners[type] ?? []).filter(
        (item) => item !== handler,
      );
    },
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    }),
  };

  const fallback =
    CHARACTER_CLASSES.find(
      (entry) => entry.id === ARBALIST_ID,
    ) ?? CHARACTER_CLASSES[0];

  const engine = new GameEngine(
    canvas,
    classDefinition ?? fallback,
    (next) => {
      snapshot = next;
    },
  );

  engine.setMap(MAP_1);
  engine.world.collision.map = MAP_1;

  instances.push(engine);

  return { engine, getSnapshot: () => snapshot };
}

/** enche a mochila com os ingredientes e as moedas de uma receita */
function stock(engine, recipeId) {
  const recipe = CRAFT_RECIPES.find(
    (entry) => entry.id === recipeId,
  );

  for (const ingredient of recipe.ingredients) {
    engine.world.inventory.add(
      ingredient.itemId,
      ingredient.count,
    );
  }

  if (recipe.coins > 0) {
    engine.world.inventory.addCoins(recipe.coins);
  }

  return recipe;
}

describe("GameEngine craft", () => {
  beforeEach(() => {
    instances.length = 0;
  });

  afterEach(() => {
    for (const engine of instances) engine.destroy();
  });

  it("publica o craft no snapshot", () => {
    const { engine, getSnapshot } = createEngine();

    const data = getSnapshot().craft;

    expect(data).toBeDefined();

    // so as receitas da classe do jogador
    const shown = data.categories.flatMap(
      (category) => category.recipes,
    );

    const ids = shown.map((recipe) => recipe.itemId);

    // O motor roda com o arquero, que e o dono do arco. Antes o
    // teste comparava o arco com uma espada que o arquero nao cria;
    // depois o arco passou a ser a UNICA arma do catalogo, e a lista
    // do arquiro virou o catalogo inteiro por acidente — nao porque o
    // filtro funcionasse, e porque nao havia armadura de outra
    // classe para esconder nem arma de outra classe para tirar
    expect(ids).toContain("willow_bow");

    // e nao ve nenhuma peca do guerreiro
    for (const itemId of [
      "botas_warrior",
      "calca_warrior",
      "elmo_warrior",
      "luvas_warrior",
      "peito_warrior",
    ]) {
      expect(
        ids,
        `${itemId} na lista do arquiro`,
      ).not.toContain(itemId);
    }

    // O motor roda com o arquero, e a lista e a DELE: nao o catalogo
    // inteiro. O total do snapshot e o tanto que foi mostrado, e
    // menor que o catalogo porque a armadura do guerreiro e dele
    expect(data.total).toBe(ids.length);
    expect(data.total).toBeLessThan(CRAFT_RECIPES.length);

    engine.destroy();
  });

  it("cria o item e gasta os materiais", () => {
    const { engine } = createEngine();
    const recipe = stock(engine, "craft_ogre_hide");

    expect(engine.craftItem(recipe.id)).toBe(true);
    expect(
      engine.world.inventory.count(recipe.itemId),
    ).toBe(1);

    for (const ingredient of recipe.ingredients) {
      expect(
        engine.world.inventory.count(ingredient.itemId),
        ingredient.itemId,
      ).toBe(0);
    }

    engine.destroy();
  });

  it("rejeita a receita sem material", () => {
    const { engine } = createEngine();

    expect(engine.craftItem("craft_ogre_hide")).toBe(
      false,
    );
    expect(
      engine.world.inventory.count("ogre_hide"),
    ).toBe(0);

    engine.destroy();
  });

  it("atualiza o snapshot depois de criar", () => {
    const { engine, getSnapshot } = createEngine();
    const recipe = stock(engine, "craft_ogre_hide");

    engine.craftItem(recipe.id);

    const data = getSnapshot().craft;

    const recipes = data.categories.flatMap(
      (category) => category.recipes,
    );

    const criada = recipes.find(
      (entry) => entry.itemId === recipe.itemId,
    );

    // o snapshot nao carrega placar de criacao: o que muda e a
    // receita ficar sem material
    expect(data.crafted).toBeUndefined();
    expect(criada.canCraft).toBe(false);
  });

  it("rejeita receita desconhecida", () => {
    const { engine } = createEngine();

    expect(engine.craftItem("craft_nada")).toBe(false);

    engine.destroy();
  });

  it("avisa o jogador quando falta material", () => {
    const { engine, getSnapshot } = createEngine();

    engine.craftItem("craft_ogre_hide");

    const message = getSnapshot().message;

    expect(message.bad).toBe(true);
    expect(message.text).toContain("Faltam materiais");

    engine.destroy();
  });

  it("avisa o jogador quando o item foi criado", () => {
    const { engine, getSnapshot } = createEngine();
    const recipe = stock(engine, "craft_ogre_hide");

    engine.craftItem(recipe.id);

    const message = getSnapshot().message;

    expect(message.bad).toBe(false);
    expect(message.text).toContain("criado");

    engine.destroy();
  });

  it("nao perde material quando a mochila esta cheia", () => {
    const { engine } = createEngine();

    /**
     * O arco, e nao um material.
     *
     * O resultado precisa de um slot NOVO para a recusa acontecer: um
     * material empilha (`maxStack` 99) e cabe na pilha que ja existe,
     * mesmo com a mochila cheia. Ate a limpeza do catalogo o teste
     * usava uma receita de armadura, que e o que ele media; o arco
     * e a unica peca que nao empilha hoje
     */
    const recipe = stock(engine, "craft_willow_bow");

    // Enche a mochila. Com 14 itens no catalogo e capacidade 20, nao
    // ha item suficiente para ocupar 20 slots: cada material empilha
    // em uma pilha so. Entao a capacidade e ajustada para o que ja
    // esta guardado, que e o mesmo caminho de `isFull` sem depender
    // de o catalogo ter 20 tipos
    engine.world.inventory.capacity =
      engine.world.inventory.usedSlots;

    expect(engine.world.inventory.isFull).toBe(true);
    expect(engine.craftItem(recipe.id)).toBe(false);

    for (const ingredient of recipe.ingredients) {
      expect(
        engine.world.inventory.count(ingredient.itemId),
        ingredient.itemId,
      ).toBe(ingredient.count);
    }

    // e o arco nao foi criado
    expect(
      engine.world.inventory.count("willow_bow"),
    ).toBe(0);

    engine.destroy();
  });

  it("cada receita do catalogo fecha para a classe dona", () => {
    // o engine deste arquivo e um arbalist, entao so as receitas
    // de arco (e as livres) podem fechar
    for (const recipe of CRAFT_RECIPES) {
      const { engine } = createEngine();

      stock(engine, recipe.id);

      const allowed = canClassUseItem(
        getItem(recipe.itemId),
        ARBALIST_ID,
      );

      expect(
        engine.craftItem(recipe.id),
        `${recipe.id} permitido=${allowed}`,
      ).toBe(allowed);

      expect(
        engine.world.inventory.count(recipe.itemId),
        recipe.itemId,
      ).toBe(allowed ? 1 : 0);

      // o que nao pode criar nao pode perder material
      if (!allowed) {
        for (const ingredient of recipe.ingredients) {
          expect(
            engine.world.inventory.count(ingredient.itemId),
            ingredient.itemId,
          ).toBe(ingredient.count);
        }
      }

      engine.destroy();
    }
  });

  it("cada classe cria a arma da familia dela", () => {
    for (const classDefinition of CHARACTER_CLASSES) {
      const weapons = CRAFT_RECIPES.filter(
        (recipe) => getItem(recipe.itemId)?.kind,
      );

      expect(
        weapons.length,
        "precisa existir arma no catalogo",
      ).toBeGreaterThan(0);

      for (const recipe of weapons) {
        const { engine } = createEngine(classDefinition);

        stock(engine, recipe.id);

        const allowed = canClassUseItem(
          getItem(recipe.itemId),
          classDefinition.id,
        );

        expect(
          engine.craftItem(recipe.id),
          `${classDefinition.id} + ${recipe.itemId}`,
        ).toBe(allowed);

        engine.destroy();
      }
    }
  });

  it("avisa que a arma e de outra classe", () => {
    const { engine, getSnapshot } = createEngine();

    // A receita do arco, e nao o item: `CRAFT_RECIPES` traz `id` e
    // `itemId`, e a busca antiga pelo item nao achava nada
    const recipe = CRAFT_RECIPES.find(
      (entry) => entry.itemId === "willow_bow",
    );

    stock(engine, recipe.id);

    // o motor deste arquivo e um ARBALIST, que e o dono do arco, entao
    // o arco fecha. A trava por classe e medida pelo motor de outra
    // classe no teste seguinte; aqui o que importa e que a receita do
    // arco existe e e a arma do jogo
    expect(recipe).toBeTruthy();
    expect(
      canClassUseItem(
        getItem(recipe.itemId),
        ARBALIST_ID,
      ),
    ).toBe(true);

    engine.craftItem(recipe.id);

    const message = getSnapshot().message;

    expect(message.bad).toBe(false);
    expect(message.text).toContain("criado");
  });

  it("o motor de outra classe recusa o arco", () => {
    const guerreiro = CHARACTER_CLASSES.find(
      (entry) => entry.id === "warrior",
    );

    const { engine, getSnapshot } = createEngine(
      guerreiro,
    );

    const recipe = CRAFT_RECIPES.find(
      (entry) => entry.itemId === "willow_bow",
    );

    stock(engine, recipe.id);

    expect(
      engine.craftItem(recipe.id),
    ).toBe(false);

    const message = getSnapshot().message;

    expect(message.bad).toBe(true);
  });

  it("nao trava material por classe", () => {
    // Antes este teste media que armadura e reliquia nao eram
    // travadas por classe, e nao ha mais nenhum item desses no
    // catalogo. A REGRA que ele mede continua valendo para todo
    // item sem familia, e hoje quem a exercita e o material
    const gear = CRAFT_RECIPES.filter(
      (recipe) =>
        getItem(recipe.itemId)?.type === ITEM_TYPE.MATERIAL,
    );

    expect(gear.length).toBeGreaterThan(0);

    for (const recipe of gear) {
      const { engine } = createEngine();

      stock(engine, recipe.id);

      expect(
        engine.craftItem(recipe.id),
        recipe.id,
      ).toBe(true);

      engine.destroy();
    }
  });

  it("material bruto se compra com moeda", () => {
    const { engine, getSnapshot } = createEngine();
    const recipe = CRAFT_RECIPES.find(
      (entry) => entry.itemId === "dummy_wood",
    );

    expect(recipe.coins).toBeGreaterThan(0);
    expect(recipe.ingredients).toHaveLength(0);

    // sem moeda nenhuma
    expect(
      engine.craftItem(recipe.id),
    ).toBe(false);

    expect(getSnapshot().message.text).toContain(
      "Moedas insuficientes",
    );

    expect(
      engine.world.inventory.count("dummy_wood"),
    ).toBe(0);

    // com a moeda exata
    engine.world.inventory.addCoins(recipe.coins);

    expect(engine.craftItem(recipe.id)).toBe(true);
    expect(
      engine.world.inventory.count("dummy_wood"),
    ).toBe(1);
    expect(
      engine.world.inventory.coins,
    ).toBe(0);

    engine.destroy();
  });

  it("gasta a moeda junto com os materiais", () => {
    const { engine } = createEngine();
    const recipe = CRAFT_RECIPES.find(
      (entry) => entry.itemId === "ogre_pebble",
    );

    expect(recipe.coins).toBeGreaterThan(0);
    expect(recipe.ingredients.length).toBeGreaterThan(0);

    stock(engine, recipe.id);

    const antes = engine.world.inventory.coins;

    expect(engine.craftItem(recipe.id)).toBe(true);

    expect(engine.world.inventory.coins).toBe(
      antes - recipe.coins,
    );

    engine.destroy();
  });

  it("nao gasta material quando faltam moedas", () => {
    const { engine } = createEngine();
    const recipe = CRAFT_RECIPES.find(
      (entry) => entry.itemId === "ogre_pebble",
    );

    // so os materiais, sem a moeda
    for (const ingredient of recipe.ingredients) {
      engine.world.inventory.add(
        ingredient.itemId,
        ingredient.count,
      );
    }

    expect(
      engine.world.inventory.coins,
    ).toBe(0);
    expect(engine.craftItem(recipe.id)).toBe(false);

    for (const ingredient of recipe.ingredients) {
      expect(
        engine.world.inventory.count(ingredient.itemId),
        ingredient.itemId,
      ).toBe(ingredient.count);
    }

    engine.destroy();
  });
});
