import {
  ITEM_TYPE,
  RARITY_ORDER,
  RARITY_STYLE,
  getItem,
} from "../../data/items/index.js";

export const LOOT_CATEGORY = {
  EQUIPMENT: "equipment",
  MATERIAL: "material",
};

export const LOOT_CATEGORY_LABEL = {
  [LOOT_CATEGORY.EQUIPMENT]: "Equipamento",
  [LOOT_CATEGORY.MATERIAL]: "Material",
};

export const LOOT_CATEGORIES = [
  LOOT_CATEGORY.EQUIPMENT,
  LOOT_CATEGORY.MATERIAL,
];

export const FILTER_STORAGE_KEY = "rpg2d.lootFilter.v1";

/**
 * raridade minima que ainda vale coletar, por categoria.
 * null significa "coleta tudo".
 */
export const DEFAULT_LOOT_FILTER = {
  [LOOT_CATEGORY.EQUIPMENT]: null,
  [LOOT_CATEGORY.MATERIAL]: null,
};

export function categoryOf(item) {
  if (!item) return LOOT_CATEGORY.EQUIPMENT;

  return item.type === ITEM_TYPE.MATERIAL
    ? LOOT_CATEGORY.MATERIAL
    : LOOT_CATEGORY.EQUIPMENT;
}

export function normalizeLootFilter(raw) {
  const filter = { ...DEFAULT_LOOT_FILTER };

  if (!raw || typeof raw !== "object") return filter;

  for (const category of LOOT_CATEGORIES) {
    const value = raw[category];

    if (RARITY_ORDER.includes(value)) {
      filter[category] = value;
    }
  }

  return filter;
}

/** o item passa no filtro? se nao passa, nunca e sorteado */
export function isCollected(item, filter) {
  if (!item) return false;

  const min = filter?.[categoryOf(item)];

  if (!min) return true;

  return (
    RARITY_ORDER.indexOf(item.rarity) >=
    RARITY_ORDER.indexOf(min)
  );
}

export function isCollectedId(itemId, filter) {
  return isCollected(getItem(itemId), filter);
}

/** rotulo curto do filtro atual, usado no botao e nas mensagens */
export function describeFilter(filter) {
  const next = normalizeLootFilter(filter);

  return LOOT_CATEGORIES.map((category) => {
    const min = next[category];
    const label = min
      ? RARITY_STYLE[min].label
      : "Tudo";

    return `${LOOT_CATEGORY_LABEL[category]}: ${label}`;
  }).join(" · ");
}

function storageOrNull(storage) {
  if (storage !== undefined) return storage;

  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadLootFilter(storage) {
  const store = storageOrNull(storage);

  if (!store) return { ...DEFAULT_LOOT_FILTER };

  try {
    const raw = store.getItem(FILTER_STORAGE_KEY);

    if (!raw) return { ...DEFAULT_LOOT_FILTER };

    return normalizeLootFilter(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_LOOT_FILTER };
  }
}

export function saveLootFilter(filter, storage) {
  const store = storageOrNull(storage);

  if (!store) return false;

  try {
    store.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify(normalizeLootFilter(filter)),
    );

    return true;
  } catch {
    return false;
  }
}