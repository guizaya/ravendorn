import { describe, expect, it } from "vitest";
import {
  categoryOf,
  DEFAULT_LOOT_FILTER,
  describeFilter,
  FILTER_STORAGE_KEY,
  isCollected,
  isCollectedId,
  LOOT_CATEGORIES,
  LOOT_CATEGORY,
  loadLootFilter,
  normalizeLootFilter,
  saveLootFilter,
} from "./lootFilter.js";
import { getItem, RARITY } from "../../data/items/index.js";

function fakeStorage(initial = {}) {
  const data = { ...initial };

  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("categories", () => {
  it("splits materials from everything else", () => {
    expect(categoryOf(getItem("skeleton_bone"))).toBe(
      LOOT_CATEGORY.MATERIAL,
    );

    expect(categoryOf(getItem("willow_bow"))).toBe(
      LOOT_CATEGORY.EQUIPMENT,
    );

    expect(categoryOf(null)).toBe(LOOT_CATEGORY.EQUIPMENT);
  });

  it("exposes both categories for the UI", () => {
    expect(LOOT_CATEGORIES).toEqual([
      LOOT_CATEGORY.EQUIPMENT,
      LOOT_CATEGORY.MATERIAL,
    ]);
  });
});

describe("isCollected", () => {
  it("keeps everything without a filter", () => {
    for (const id of ["slime_gel", "willow_bow"]) {
      expect(isCollectedId(id, null)).toBe(true);
      expect(isCollectedId(id, undefined)).toBe(true);
      expect(
        isCollectedId(id, DEFAULT_LOOT_FILTER),
      ).toBe(true);
    }
  });

  it("rejects items below the chosen rarity", () => {
    const filter = {
      ...DEFAULT_LOOT_FILTER,
      [LOOT_CATEGORY.MATERIAL]: RARITY.EPIC,
    };

    expect(isCollectedId("slime_gel", filter)).toBe(false);
    expect(isCollectedId("slime_core", filter)).toBe(false);
  });

  it("keeps items at or above the chosen rarity", () => {
    // O arco e a unica peca de equipamento que sobrou, e ele e
    // `uncommon` no catalogo. Antes o teste comparava um item de
    // equipamento em varias raridades (epic, legendary), o que nao e
    // mais possivel: a raridade do filtro e comparada com a
    // raridade de CATALOGO do item, e o arco e sempre o mesmo
    const filter = {
      ...DEFAULT_LOOT_FILTER,
      [LOOT_CATEGORY.EQUIPMENT]: RARITY.EPIC,
    };

    // arco uncommon, filtro epic: barrado
    expect(isCollectedId("willow_bow", filter)).toBe(false);

    // e a mesma peca passa com o filtro abaixo da raridade dela
    expect(
      isCollectedId("willow_bow", {
        ...DEFAULT_LOOT_FILTER,
        [LOOT_CATEGORY.EQUIPMENT]: RARITY.COMMON,
      }),
    ).toBe(true);
  });

  it("filtra material pela raridade de catalogo", () => {
    // a parte que antes ficava coberta pelo teste de equipamento:
    // a comparacao de raridade propriamente dita, em itens que
    // realmente tem raridades diferentes
    const raro = {
      ...DEFAULT_LOOT_FILTER,
      [LOOT_CATEGORY.MATERIAL]: RARITY.RARE,
    };

    // `skeleton_skull` e `rare`: fica
    expect(isCollectedId("skeleton_skull", raro)).toBe(
      true,
    );
    // `slime_gel` e `common`: sai
    expect(isCollectedId("slime_gel", raro)).toBe(false);
  });

  it("filters each category on its own", () => {
    const filter = {
      [LOOT_CATEGORY.EQUIPMENT]: null,
      [LOOT_CATEGORY.MATERIAL]: RARITY.RARE,
    };

    // equipamento liberado, material barrado
    expect(isCollectedId("willow_bow", filter)).toBe(true);
    expect(isCollectedId("skeleton_bone", filter)).toBe(false);
    expect(isCollectedId("ogre_hide", filter)).toBe(false);
    expect(isCollectedId("skeleton_skull", filter)).toBe(true);
  });

  it("never collects a missing item", () => {
    expect(isCollected(null, null)).toBe(false);
    expect(isCollectedId("nao_existe", null)).toBe(false);
  });
});

describe("normalizeLootFilter", () => {
  it("drops unknown keys and bad rarities", () => {
    const filter = normalizeLootFilter({
      equipment: "dourado",
      material: RARITY.RARE,
      outra: RARITY.LEGENDARY,
    });

    expect(filter).toEqual({
      [LOOT_CATEGORY.EQUIPMENT]: null,
      [LOOT_CATEGORY.MATERIAL]: RARITY.RARE,
    });
  });

  it("falls back to the default on junk", () => {
    expect(normalizeLootFilter(null)).toEqual(
      DEFAULT_LOOT_FILTER,
    );

    expect(normalizeLootFilter("lixo")).toEqual(
      DEFAULT_LOOT_FILTER,
    );
  });

  it("never returns null for a category", () => {
    const filter = normalizeLootFilter({});

    for (const category of LOOT_CATEGORIES) {
      expect(Object.hasOwn(filter, category)).toBe(true);
    }
  });
});

describe("persistence", () => {
  it("round-trips through storage", () => {
    const storage = fakeStorage();

    saveLootFilter(
      { equipment: RARITY.EPIC, material: null },
      storage,
    );

    expect(storage.data[FILTER_STORAGE_KEY]).toBeDefined();

    expect(loadLootFilter(storage)).toEqual({
      [LOOT_CATEGORY.EQUIPMENT]: RARITY.EPIC,
      [LOOT_CATEGORY.MATERIAL]: null,
    });
  });

  it("returns the default when storage is empty", () => {
    expect(loadLootFilter(fakeStorage())).toEqual(
      DEFAULT_LOOT_FILTER,
    );
  });

  it("survives corrupted storage", () => {
    const storage = fakeStorage({
      [FILTER_STORAGE_KEY]: "{quebrado",
    });

    expect(loadLootFilter(storage)).toEqual(
      DEFAULT_LOOT_FILTER,
    );
  });

  it("works without any storage available", () => {
    expect(loadLootFilter(null)).toEqual(
      DEFAULT_LOOT_FILTER,
    );

    expect(
      saveLootFilter(DEFAULT_LOOT_FILTER, null),
    ).toBe(false);
  });
});

describe("describeFilter", () => {
  it("names the rarity kept per category", () => {
    expect(
      describeFilter({
        equipment: RARITY.EPIC,
        material: null,
      }),
    ).toContain("Épico");

    expect(
      describeFilter({
        equipment: null,
        material: null,
      }),
    ).toContain("Tudo");
  });
});