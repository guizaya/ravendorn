import ItemIcon from "./ItemIcon.jsx";
import {
  ITEM_TYPE_LABEL,
  RARITY_STYLE,
  getItem,
  isStackable,
} from "../../data/items/index.js";

/**
 * O SLOT de um item, so a apresentacao.
 *
 * Extraido do `InventoryPanel` para que o mercado use o MESMO desenho da
 * mochila. A alternativa — copiar o `<div class="inv-slot">` para dentro
 * do `MarketPanel` — parece mais rapida e cobra o pedagogo depois: uma
 * correcao no slot da mochila (uma badge nova, um ajuste de cor) chega so
 * em um dos dois, e o jogador ve a mesma peca com duas aparencias no
 * mesmo jogo
 *
 * Este componente nao sabe o que e um `uid`, nem de onde veio a entrada:
 * ele desenha. Quem decide o que acontece no clique e o `ItemSlot` do
 * inventario (menu de equipar/descartar) e o seletor do mercado (escolher
 * o que anunciar)
 *
 * O `title` e o mesmo do inventario de proposito: nome, raridade, tipo,
 * valor e atributos num texto so. E a forma mais barata de dar a
 * informacao completa sem ocupar a tela
 */
function statLine(stats) {
  if (!stats) return "";

  const STAT_LABELS = {
    attack: "ATQ",
    defense: "DEF",
    speed: "VEL",
    attackSpeed: "VEL. ATQ",
    critChance: "CRIT",
    critDamage: "DANO CRIT",
    maxHp: "HP",
    maxResource: "REC",
    lifeSteal: "ROUBO",
    cooldownReduction: "CD",
  };

  return Object.entries(stats)
    .map(([key, value]) => `${STAT_LABELS[key] ?? key} ${value}`)
    .join("  ·  ");
}

export default function InvSlotView({
  entry,
  compact = false,
  area,
  className = "",
  children = null,
  onSelect = null,
  selected = false,
}) {
  const item = getItem(entry.itemId);

  if (!item) return null;

  /**
   * A raridade do SLOT e a da variante na mochila, e nao a do catalogo.
   *
   * O catalogo tem uma raridade so, e ela e a "natural" do item: o
   * craft entrega o mesmo arco nas cinco, entao um `willow_bow` guardado
   * pode ser lendario. Ler `item.rarity` pintaria o slot com a cor da
   * raridade base enquanto o `title` diz outra coisa
   */
  const raridadeId = entry.rarity ?? item.rarity;

  const rarity = RARITY_STYLE[raridadeId] ?? null;

  const unique = !isStackable(item);

  const nome = item.name;

  return (
    <div
      className={[
        "inv-slot",
        `inv-slot--${raridadeId}`,
        entry.equipped ? "is-equipped" : "",
        compact ? "is-compact" : "",
        selected ? "is-selected" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--rarity": rarity?.color ?? "#c3ccd6",
        ...(area ? { gridArea: area } : null),
      }}
      title={`${item.name}\n${rarity?.label ?? ""} · ${
        ITEM_TYPE_LABEL[item.type]
      }\nValor: ${item.value} moedas${
        statLine(item.stats) ? `\n${statLine(item.stats)}` : ""
      }`}
    >
      <button
        type="button"
        className="inv-slot__hit"
        onClick={() => onSelect?.(entry)}
        aria-label={nome}
        aria-pressed={onSelect ? Boolean(selected) : undefined}
      >
        <ItemIcon
          className="inv-slot__icon"
          item={item}
          rarity={raridadeId}
        />
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
        <span className="inv-slot__count">{entry.count}</span>
      )}

      {children}
    </div>
  );
}