import { useMemo, useState } from "react";
import {
  getItem,
  ITEM_TYPE,
  ITEM_TYPE_LABEL,
  rarityOf,
  RARITY_ORDER,
  RARITY_STYLE,
} from "../../data/items/index.js";
import {
  isEquippable,
  slotNameFor,
} from "../../game/equipment/Equipment.js";
import ItemIcon from "../UI/ItemIcon.jsx";
import InvSlotView from "../UI/InvSlotView.jsx";
import {
  DEFAULT_LOOT_FILTER,
  LOOT_CATEGORIES,
  LOOT_CATEGORY_LABEL,
  normalizeLootFilter,
} from "../../game/loot/lootFilter.js";

/**
 * As abas da mochila.
 *
 * `types` e o filtro da aba, e o `[]` e um filtro que nao casa com
 * nada: e assim que a aba de runas existe sem mostrar item. Um
 * `null` devolveria TUDO, e a aba seria um duplicado da "Tudo"
 */
export const TABS = [
  { id: "all", label: "Tudo", icon: "▤", types: null },
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
  {
    id: "rune",
    label: "Runas",
    // `ᚱ` e uma letra runica, e nao um emoji: nao ha variation
    // selector depois dela, entao o navegador desenha como glifo de
    // TEXTO e ela herda a cor da aba. Um emoji aqui sairia colorido
    // ao lado das outras tres, que sao todas glifos
    icon: "ᚱ",
    // `types` vazio, e nao `null`: e a aba que ainda nao mostra nada.
    // Com `null` o filtro devolve TUDO, e a aba de runas viraria uma
    // copia da aba "Tudo". Com `[]` o `includes` nunca casa e a grade
    // fica vazia, mostrando o "Nenhum item nesta categoria"
    types: [],
  },
];

// área de cada peça no boneco de equipamento (grid 3x3 do OSRS)
const DOLL_AREA = {
  head: "head",
  gloves: "gloves",
  weapon: "weapon",
  weapon2: "weapon2",
  chest: "chest",
  legs: "legs",
  boots: "boots",
  trinket1: "trinket1",
  trinket2: "trinket2",
};

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

export function SlotMenu({ actions, align }) {
  if (actions.length === 0) return null;

  return (
    <span className={`inv-menu inv-menu--${align}`}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={[
            "inv-menu__action",
            action.danger ? "is-danger" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={(event) => {
            event.stopPropagation();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </span>
  );
}

export function ItemSlot({
  entry,
  onEquip,
  onUnequip,
  onDiscardItem,
  onDiscardEquipped,
  onUseItem,
  compact = false,
  area,
  menuOpen = false,
  onToggleMenu,
}) {
  const item = getItem(entry.itemId);

  if (!item) return null;

  /**
   * A raridade do SLOT e a da variante na mochila, e nao a do
   * catalogo.
   *
   * O catalogo tem uma raridade so, e ela e a "natural" do item. O
   * craft entrega o mesmo arco nas cinco, entao um `willow_bow`
   * guardado pode ser lendario. Ler `item.rarity` pintava o slot com
   * a cor da raridade base enquanto o nome no `title` dizia outra
   * coisa, e a arte da raridade que se ajuste a cor
   */
  const raridadeId = entry.rarity ?? item.rarity;

  const rarity = RARITY_STYLE[raridadeId] ?? rarityOf(item);

  const unique = !item.stackable;

  // so oferece "Equipar" quando o item tem ALGUM slot de destino
  // valido. A regra antiga so olhava o tipo, e toda armadura tinha
  // os tres slots de armadura como destino; agora a posicao conta, e
  // um item cuja posicao nao existe no boneco fica sem a opcao em vez
  // de falhar ao clicar
  const equippable =
    item.type !== ITEM_TYPE.MATERIAL &&
    item.tier > 0 &&
    isEquippable(item);

  const actions = [];

  if (entry.equipped) {
    if (onUnequip) {
      actions.push({
        id: "unequip",
        label: "Desequipar",
        run: () => onUnequip(entry.slotId),
      });
    }

    if (onDiscardEquipped) {
      actions.push({
        id: "discard",
        label: "Excluir",
        danger: true,
        run: () => onDiscardEquipped(entry.slotId),
      });
    }
  } else {
    if (equippable && onEquip) {
      // O rotulo diz ONDE a peca vai. Com a regra da posicao, isso
      // deixou de ser obvio: "Equipar" num slot livre qualquer era
      // uma promessa vaga, e o jogador so descobria o destino depois
      // de vestir
      const destino = slotNameFor(item);

      actions.push({
        id: "equip",
        label: destino ? `Equipar · ${destino}` : "Equipar",
        run: () => onEquip(entry),
      });
    }

    /**
     * USAR, quando o item e consumivel.
     *
     * Vem ANTES do "Excluir" de proposito: e a acao principal de uma
     * pocao, e o menu que lista "Excluir" primeiro faz o jogador
     * procurar o uso. O `danger` do excluir ja o separa visualmente
     *
     * O que decide e o `use` do CATALOGO, e nao o tipo.
     * `ITEM_TYPE.POTION` e um rotulo, e o que o motor sabe aplicar e o
     * `use` — um item novo com `use` ganha o botao sem tocar neste
     * arquivo
     *
     * O rotulo mostra QUANTO cura. O jogador decide se vale o espaco da
     * mochila olhando o numero, e nao descobrindo depois de ter perdido
     * a pocao
     */
    if (item.use && onUseItem) {
      const partes = [];

      if (item.use.heal) partes.push(`${item.use.heal} de vida`);
      if (item.use.restoreResource) {
        partes.push(`${item.use.restoreResource} de recurso`);
      }

      const efeito = partes.join(" e ");

      actions.push({
        id: "use",
        label: efeito ? `Usar · ${efeito}` : "Usar",
        run: () => onUseItem(entry),
      });
    }

    if (onDiscardItem) {
      actions.push({
        id: "discard",
        label: "Excluir",
        danger: true,
        run: () => onDiscardItem(entry.uid),
      });
    }
  }

  return (
    <InvSlotView
      entry={entry}
      compact={compact}
      area={area}
      className={menuOpen ? "is-menu" : ""}
    >
      <button
        type="button"
        className="inv-slot__hit"
        onClick={() => onToggleMenu?.(entry)}
        aria-label={item.name}
        aria-expanded={menuOpen}
      />

      {menuOpen && (
        <SlotMenu
          actions={actions}
          align={area ? "left" : "center"}
        />
      )}
    </InvSlotView>
  );
}

function DollSlot({
  slot,
  onUnequip,
  onDiscardEquipped,
  menuOpen,
  onToggleMenu,
}) {
  const area = DOLL_AREA[slot.id];

  if (slot.itemId) {
    return (
      <ItemSlot
        compact
        area={area}
        menuOpen={menuOpen}
        onToggleMenu={onToggleMenu}
        entry={{
          itemId: slot.itemId,
          // A raridade da variante vestida. Sem esta linha a entrada
          // nao trazia raridade nenhuma, e o slot caia na do
          // catalogo: vestir um arco lendario mostrava a arte da
          // raridade base dele, que e o mesmo arco em outra
          // imagem
          rarity: slot.rarity ?? null,
          count: 1,
          slotId: slot.id,
          equipped: true,
        }}
        onUnequip={onUnequip}
        onDiscardEquipped={onDiscardEquipped}
      />
    );
  }

  return (
    <div
      className="inv-slot inv-slot--empty"
      style={{ gridArea: area }}
      title={`${slot.name} — vazio`}
    >
      <span className="inv-slot__icon">{slot.icon}</span>
    </div>
  );
}

function EquipmentDoll({
  equipment,
  onUnequip,
  onDiscardEquipped,
  menu,
  onToggleMenu,
}) {
  const slots = equipment?.slots ?? [];

  return (
    <div className="inv-equip__grid">
      {slots.map((slot) => (
        <DollSlot
          key={slot.id}
          slot={slot}
          menuOpen={menu === slot.id}
          onToggleMenu={onToggleMenu}
          onUnequip={onUnequip}
          onDiscardEquipped={onDiscardEquipped}
        />
      ))}
    </div>
  );
}

function Bonuses({ equipment, onAutoEquip }) {
  const bonuses = equipment?.bonuses ?? {};

  return (
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
                {key === "attackSpeed" || key === "resourceRegen"
                  ? `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`
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

export function FilterPanel({
  filter,
  onChange,
  onReset,
  onPrune,
  onClose,
}) {
  return (
    <div className="inv-filter">
      <header className="inv-filter__head">
        <strong>Filtro de coleta</strong>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar filtro"
        >
          ✕
        </button>
      </header>

      <p className="inv-filter__hint">
        Item abaixo da raridade escolhida é descartado na hora:
        não dropara, não vai para o chão e não entra na mochila.
      </p>

      {LOOT_CATEGORIES.map((category) => (
        <div key={category} className="inv-filter__row">
          <span className="inv-filter__label">
            {LOOT_CATEGORY_LABEL[category]}
          </span>

          <div className="inv-filter__choices">
            <button
              type="button"
              className={[
                "inv-filter__choice",
                filter[category] === null ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                onChange(category, null)
              }
            >
              Tudo
            </button>

            {RARITY_ORDER.map((rarity) => {
              const style = RARITY_STYLE[rarity];

              return (
                <button
                  key={rarity}
                  type="button"
                  className={[
                    "inv-filter__choice",
                    filter[category] === rarity
                      ? "is-active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ "--rarity": style.color }}
                  onClick={() =>
                    onChange(category, rarity)
                  }
                >
                  {style.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="inv-filter__foot">
        <button
          type="button"
          className="inv-filter__action"
          onClick={onPrune}
        >
          Limpar mochila
        </button>

        <button
          type="button"
          className="inv-filter__action"
          onClick={onReset}
        >
          Padrão
        </button>
      </div>
    </div>
  );
}

export default function InventoryPanel({
  inventory,
  equipment,
  player,
  lootFilter,
  onClose,
  onEquip,
  onUnequip,
  onDiscardItem,
  onDiscardEquipped,
  onAutoEquip,
  onUseItem,
  onFilterChange,
  onFilterReset,
  onFilterPrune,
}) {
  const [category, setCategory] = useState("all");
  const [menu, setMenu] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const filter = useMemo(
    () => normalizeLootFilter(lootFilter),
    [lootFilter],
  );

  const summary = inventory ?? {
    coins: 0,
    used: 0,
    capacity: 20,
    isFull: false,
    items: [],
  };

  const hp = Math.max(0, Math.round(player?.hp ?? 0));
  const maxHp = Math.max(1, Math.round(player?.maxHp ?? 0));
  const hpPercent = Math.min(100, (hp / maxHp) * 100);

  const entries = summary.items ?? [];

  const closeMenu = () => setMenu(null);

  const toggleMenu = (entry) =>
    setMenu((current) => {
      const id = entry.slotId ?? entry.uid;

      return current === id ? null : id;
    });

  const discardItem = (uid) => {
    closeMenu();
    onDiscardItem?.(uid);
  };

  const discardEquipped = (slotId) => {
    closeMenu();
    onDiscardEquipped?.(slotId);
  };

  /**
   * USA um consumivel, e fecha o menu do slot.
   *
   * O `closeMenu` vem antes do pedido pelo mesmo motivo do descarte:
   * o menu fica na tela ate a proxima resposta do servidor, e um menu
   * aberto em cima da pocao que acabou de sumir mostra um slot vazio
   * com acoes que nao valem mais nada
   */
  const useItem = (entry) => {
    closeMenu();
    onUseItem?.(entry);
  };

  const changeFilter = (key, value) => {
    closeMenu();
    onFilterChange?.(key, value);
  };

  const visible = useMemo(() => {
    const filter_ = TABS.find(
      (entry) => entry.id === category,
    );

    if (!filter_?.types) return entries;

    return entries.filter((entry) => {
      const item = getItem(entry.itemId);

      return item && filter_.types.includes(item.type);
    });
  }, [entries, category]);

  const slots = useMemo(() => {
    const list = visible
      .map((entry) => {
        const item = getItem(entry.itemId);

        if (!item) return null;

        // ordena pela raridade que o slot vai MOSTRAR, e nao pela do
        // catalogo. Um arco base e um arco lendario sao o mesmo item,
        // entao ordenar so pelo catalogo punha os dois juntos e o
        // lendario nao chegava ao topo que ele deveria ter
        return {
          entry,
          item,
          raridadeId: entry.rarity ?? item.rarity,
        };
      })
      .filter(Boolean);

    // ordena por raridade para que os melhores fiquem no topo da grade
    const rank = {
      legendary: 0,
      epic: 1,
      rare: 2,
      uncommon: 3,
      common: 4,
    };

    return list.sort(
      (a, b) =>
        (rank[a.raridadeId] ?? 9) - (rank[b.raridadeId] ?? 9),
    );
  }, [visible]);

  const totalValue = entries.reduce((total, entry) => {
    const item = getItem(entry.itemId);

    return total + (item?.value ?? 0) * entry.count;
  }, 0);

  const filtering =
    filter[LOOT_CATEGORIES[0]] !== null ||
    filter[LOOT_CATEGORIES[1]] !== null;

  return (
    <section className="inv-panel">
      <nav className="inv-tabs">
        {TABS.map((entry) => {
          const count = entry.types
            ? entries.filter((item) => {
                const def = getItem(item.itemId);

                return (
                  def && entry.types.includes(def.type)
                );
              }).length
            : entries.length;

          return (
            <button
              key={entry.id}
              type="button"
              className={[
                "inv-tab",
                category === entry.id ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setCategory(entry.id)}
              title={entry.label}
            >
              <span className="inv-tab__icon">
                {entry.icon}
              </span>
              <small>{entry.label}</small>
              {count > 0 && (
                <i className="inv-tab__count">{count}</i>
              )}
            </button>
          );
        })}

        <button
          type="button"
          className={[
            "inv-gear",
            filterOpen ? "is-active" : "",
            filtering ? "is-filtering" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => {
            closeMenu();
            setFilterOpen((current) => !current);
          }}
          title="Configurar filtro de coleta"
        >
          ⚙
        </button>

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (I)"
        >
          ✕
        </button>

        {filterOpen && (
          <FilterPanel
            filter={filter}
            onChange={changeFilter}
            onReset={() => onFilterReset?.()}
            onPrune={() => onFilterPrune?.()}
            onClose={() => setFilterOpen(false)}
          />
        )}
      </nav>

      <div className="inv-panel__body">
        <aside className="inv-illus">
          <EquipmentDoll
            equipment={equipment}
            menu={menu}
            onToggleMenu={toggleMenu}
            onUnequip={onUnequip}
            onDiscardEquipped={discardEquipped}
          />

          <Bonuses
            equipment={equipment}
            onAutoEquip={onAutoEquip}
          />
        </aside>

        <div className="inv-main">
          {slots.length === 0 ? (
            <p className="inv-panel__empty">
              Nenhum item nesta categoria.
            </p>
          ) : (
            <div className="inv-grid">
              {slots.map(({ entry, item }) => (
                <div
                  key={entry.uid ?? entry.itemId}
                  className="inv-cell"
                >
                  <ItemSlot
                    entry={entry}
                    onEquip={onEquip}
                    onDiscardItem={discardItem}
                    onUseItem={useItem}
                    menuOpen={menu === entry.uid}
                    onToggleMenu={toggleMenu}
                  />
                  <span className="inv-cell__name">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {menu !== null && (
        <button
          type="button"
          className="inv-menu__backdrop"
          aria-label="Fechar menu do item"
          onClick={() => {
            closeMenu();
            setFilterOpen(false);
          }}
        />
      )}

      <footer className="inv-status">
        <span className="inv-status__cap">
          <i>▣</i>
          {summary.used}/{summary.capacity}
        </span>

        <span className="inv-status__hp">
          <span className="inv-status__bar">
            <span
              className="inv-status__fill"
              style={{ width: `${hpPercent}%` }}
            />
          </span>

          <span className="inv-status__hptext">
            {hp} / {maxHp}
          </span>
        </span>

        {summary.isFull && (
          <span className="inv-status__full">Cheio</span>
        )}

        {filtering && (
          <span
            className="inv-status__filter"
            title="Filtro de coleta ativo: itens abaixo da raridade escolhida são descartados automaticamente"
          >
            <i>⚙</i>
            Filtro
          </span>
        )}

        <span className="inv-status__value">
          {totalValue} em itens
        </span>

        <span className="inv-status__coins">
          <i>◉</i>
          {summary.coins}
        </span>
      </footer>
    </section>
  );
}

export { DEFAULT_LOOT_FILTER };