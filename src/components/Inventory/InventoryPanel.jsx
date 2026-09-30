import { useMemo, useState } from "react";
import {
  getItem,
  ITEM_TYPE,
  ITEM_TYPE_LABEL,
  rarityOf,
} from "../../data/items/index.js";

const CATEGORIES = [
  { id: "all", label: "Tudo", icon: "A", types: null },
  {
    id: "equip",
    label: "Equip.",
    icon: "⚔",
    types: [
      ITEM_TYPE.WEAPON,
      ITEM_TYPE.ARMOR,
      ITEM_TYPE.TRINKET,
    ],
  },
  {
    id: "material",
    label: "Mat.",
    icon: "◈",
    types: [ITEM_TYPE.MATERIAL],
  },
];

const STAT_LABELS = {
  attack: "ATQ",
  defense: "DEF",
  maxHp: "HP",
  speed: "VEL",
  attackSpeed: "VEL. ATQ",
  resourceRegen: "REG",
  resource: "REC",
};

function statLine(stats) {
  return Object.entries(stats ?? {})
    .map(([key, value]) => {
      const percent =
        key === "attackSpeed" || key === "resourceRegen";

      const text = percent
        ? `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`
        : `+${Math.round(value)}`;

      return `${STAT_LABELS[key] ?? key} ${text}`;
    })
    .join("  ·  ");
}

function ItemSlot({
  entry,
  onEquip,
  onUnequip,
  compact = false,
}) {
  const item = getItem(entry.itemId);

  if (!item) return null;

  const rarity = rarityOf(item);

  const unique = !item.stackable;

  return (
    <li
      className={[
        "inv-slot",
        `inv-slot--${item.rarity}`,
        entry.equipped ? "is-equipped" : "",
        compact ? "is-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--rarity": rarity.color }}
      title={`${item.name}\n${rarity.label} · ${
        ITEM_TYPE_LABEL[item.type]
      }\nValor: ${item.value} moedas${
        statLine(item.stats) ? `\n${statLine(item.stats)}` : ""
      }`}
    >
      <button
        type="button"
        className="inv-slot__hit"
        onClick={() => onUnequip?.(entry.slotId)}
        disabled={!onUnequip}
        aria-label={item.name}
      >
        <span className="inv-slot__icon">
          {item.icon}
        </span>
      </button>

      {entry.equipped && (
        <span className="inv-slot__badge inv-slot__badge--equipped">
          E
        </span>
      )}

      {item.tier > 0 && (
        <span className="inv-slot__badge inv-slot__badge--tier">
          T{item.tier}
        </span>
      )}

      {unique && (
        <span className="inv-slot__mark" title="Item único" />
      )}

      {entry.count > 1 && (
        <span className="inv-slot__count">
          {entry.count}
        </span>
      )}

      {!entry.equipped &&
        item.tier > 0 &&
        (onEquip || onUnequip) && (
          <span className="inv-slot__action">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEquip?.(entry);
              }}
            >
              Equipar
            </button>
          </span>
        )}
    </li>
  );
}

function EmptySlot({ slot, equippedItem, onUnequip }) {
  if (equippedItem) {
    return (
      <ItemSlot
        compact
        entry={equippedItem}
        onUnequip={() =>
          onUnequip?.(equippedItem.slotId)
        }
      />
    );
  }

  return (
    <li
      className="inv-slot inv-slot--empty"
      title={`${slot.name} — vazio`}
    >
      <span className="inv-slot__icon">🔒</span>
      <small>{slot.name}</small>
    </li>
  );
}

function EquipmentView({ equipment, onUnequip, onAutoEquip }) {
  const slots = equipment?.slots ?? [];
  const bonuses = equipment?.bonuses ?? {};

  return (
    <div className="inv-equip">
      <div className="inv-equip__grid">
        {slots.map((slot) => {
          const equipped = slots.find(
            (entry) => entry.id === slot.id,
          );

          return (
            <EmptySlot
              key={slot.id}
              slot={slot}
              equippedItem={
                equipped?.itemId
                  ? {
                      ...equipped,
                      itemId: equipped.itemId,
                      count: 1,
                      slotId: slot.id,
                    }
                  : null
              }
              onUnequip={onUnequip}
            />
          );
        })}
      </div>

      <div className="inv-equip__bonus">
        <span className="eyebrow">Bônus_total</span>

        {Object.keys(bonuses).length === 0 ? (
          <p className="inv-equip__empty">
            Nenhum equipamento. Use “Equipar melhores”.
          </p>
        ) : (
          <ul>
            {Object.entries(bonuses).map(([key, value]) => (
              <li key={key}>
                <strong>
                  {STAT_LABELS[key] ?? key}
                </strong>
                <span>
                  {key === "attackSpeed" ||
                  key === "resourceRegen"
                    ? `${value > 0 ? "+" : ""}${Math.round(
                        value * 100,
                      )}%`
                    : `+${Math.round(value)}`}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="inv-equip__power">
          <span>Power</span>
          <strong>
            {equipment?.power ?? 0}
          </strong>
        </div>
      </div>

      <button
        type="button"
        className="inv-action"
        onClick={onAutoEquip}
      >
        Equipar melhores
      </button>
    </div>
  );
}

export default function InventoryPanel({
  inventory,
  equipment,
  onClose,
  onEquip,
  onUnequip,
  onAutoEquip,
}) {
  const [view, setView] = useState("bag");
  const [category, setCategory] = useState("all");

  const summary = inventory ?? {
    coins: 0,
    used: 0,
    capacity: 20,
    isFull: false,
    items: [],
  };

  const entries = summary.items ?? [];

  const visible = useMemo(() => {
    const filter = CATEGORIES.find(
      (entry) => entry.id === category,
    );

    if (!filter?.types) return entries;

    return entries.filter((entry) => {
      const item = getItem(entry.itemId);

      return item && filter.types.includes(item.type);
    });
  }, [entries, category]);

  const groups = useMemo(() => {
    const map = new Map();

    for (const entry of visible) {
      const item = getItem(entry.itemId);

      if (!item) continue;

      const label = ITEM_TYPE_LABEL[item.type];

      if (!map.has(label)) {
        map.set(label, []);
      }

      map.get(label).push(entry);
    }

    return [...map.entries()];
  }, [visible]);

  const totalValue = entries.reduce((total, entry) => {
    const item = getItem(entry.itemId);

    return total + (item?.value ?? 0) * entry.count;
  }, 0);

  return (
    <section className="inv-panel">
      <header className="inv-panel__head">
        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (I)"
        >
          ✕
        </button>

        <h2>
          {view === "bag"
            ? "Inventário"
            : "Equipamento"}
        </h2>

        <div className="inv-wallet">
          <span className="inv-wallet__coins">
            <i>◉</i>
            {summary.coins}
          </span>
        </div>
      </header>

      <div className="inv-panel__body">
        <nav className="inv-rail">
          {CATEGORIES.map((entry) => {
            const count = entry.types
              ? entries.filter((item) => {
                  const def = getItem(item.itemId);

                  return (
                    def &&
                    entry.types.includes(def.type)
                  );
                }).length
              : entries.length;

            return (
              <button
                key={entry.id}
                type="button"
                className={[
                  "inv-rail__item",
                  category === entry.id
                    ? "is-active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setCategory(entry.id)}
                title={entry.label}
              >
                <span className="inv-rail__icon">
                  {entry.icon}
                </span>
                <small>{entry.label}</small>
                {count > 0 && (
                  <i className="inv-rail__count">
                    {count}
                  </i>
                )}
              </button>
            );
          })}
        </nav>

        <div className="inv-main">
          <div className="inv-tabs">
            <button
              type="button"
              className={[
                "inv-tab",
                view === "bag" ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setView("bag")}
            >
              <span>▤</span>
              Inventário
            </button>

            <button
              type="button"
              className={[
                "inv-tab",
                view === "equip" ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setView("equip")}
            >
              <span>⚔</span>
              Equipamento
            </button>
          </div>

          {view === "equip" ? (
            <EquipmentView
              equipment={equipment}
              onUnequip={onUnequip}
              onAutoEquip={onAutoEquip}
            />
          ) : (
            <>
              {groups.map(([label, list]) => (
                <section
                  key={label}
                  className="inv-group"
                >
                  <h3 className="inv-group__title">
                    {label}
                  </h3>

                  <ul className="inv-grid">
                    {list.map((entry) => (
                      <ItemSlot
                        key={entry.uid ?? entry.itemId}
                        entry={entry}
                        onEquip={onEquip}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              {visible.length === 0 && (
                <p className="inv-panel__empty">
                  Nenhum item nesta categoria.
                </p>
              )}

              <footer className="inv-footer">
                <span className="inv-footer__cap">
                  {summary.used}/{summary.capacity}
                </span>

                <span className="inv-footer__value">
                  {totalValue} em itens
                </span>

                {summary.isFull && (
                  <span className="inv-footer__full">
                    Cheio
                  </span>
                )}
              </footer>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
