import { useMemo, useState } from "react";
import {
  getItem,
  ITEM_TYPE,
  rarityOf,
  RARITY_ORDER,
  RARITY_STYLE,
} from "../../data/items/index.js";
import {
  isEquippable,
  slotNameFor,
} from "../../game/equipment/Equipment.js";
import { canEnchantItem } from "../../data/enchant/index.js";
import { SKILL_PACKS } from "../../data/skills/index.js";
import InvSlotView from "../UI/InvSlotView.jsx";
import ItemCard from "../UI/ItemCard.jsx";
import SlotMenuFloat from "../UI/SlotMenuFloat.jsx";
import {
  DEFAULT_LOOT_FILTER,
  LOOT_CATEGORIES,
  LOOT_CATEGORY_LABEL,
  normalizeLootFilter,
} from "../../game/loot/lootFilter.js";

/**
 * A SKILL DE UM ID, ou `null`.
 *
 * Percorre os packs das classes em vez de receber a classe como
 * argumento: o inventario mostra item de qualquer origem — loot, mercado,
 * loja — e nenhuma delas sabe a classe de quem esta olhando. Com o
 * argumento, cada chamador teria de descobrir a classe primeiro para
 * desenhar um rotulo
 *
 * Este arquivo so DESENHA. Quem decide se o livro ensina mesmo e o
 * servidor, no `aprenderHabilidade`, e este `null` serve para o rotulo
 * cair em "ensina a habilidade" em vez de quebrar
 */
function skillPeloId(skillId) {
  if (!skillId) return null;

  for (const pack of Object.values(SKILL_PACKS)) {
    const achada = pack.skills?.find((skill) => skill.id === skillId);

    if (achada) return achada;
  }

  return null;
}

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
    // TEXTO e ela herda a cor da aba
    icon: "ᚱ",
    // `types` vazio, e nao `null`: com `null` o filtro devolve TUDO e
    // a aba de runas viraria uma copia da aba "Tudo"
    types: [],
  },
];

/**
 * As ordenacoes da mochila.
 *
 * A raridade e a padrao porque e o que o jogador procura primeiro: o
 * lendario no topo. O desempate e sempre o nome, para a grade nao
 * embaralhar entre duas aberturas do painel.
 */
const RARITY_RANK = {
  legendary: 0,
  epic: 1,
  rare: 2,
  uncommon: 3,
  common: 4,
};

const SORTS = [
  { id: "rarity", label: "Raridade" },
  { id: "name", label: "Nome" },
  { id: "count", label: "Quantidade" },
  { id: "value", label: "Valor" },
];

// area de cada peça no boneco de equipamento
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

const PERCENT_STATS = new Set(["attackSpeed", "resourceRegen"]);

function formatStat(key, value) {
  return PERCENT_STATS.has(key)
    ? `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`
    : `+${Math.round(value)}`;
}

export function SlotMenu({ actions, align, direction = "down" }) {
  if (actions.length === 0) return null;

  return (
    <span
      className={[
        "inv-menu",
        `inv-menu--${align}`,
        `inv-menu--${direction}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
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

/**
 * AS ACOES DE UM SLOT, e a lista que a caixa de opcoes mostra.
 *
 * ## POR QUE ESTE TRECO SAIU DO `ItemSlot`
 *
 * Porque o `ItemSlot` desenha um slot com menu. A mochila usa um
 * `ItemCard` — que tem o nome embaixo do icone — e o `ItemCard` nao
 * sabe montar acoes: ele so repassa o que o dono da lista passar
 *
 * Com a montagem presa dentro do `ItemSlot`, a grade da mochila recebia
 * `onUseItem`, `onDiscardItem` e os outros pelo `slotProps` e nenhum
 * deles era lido. O clique abria o card, a caixa de opcoes nao aparecia,
 * e nao havia como usar, vestir nem excluir NADA da mochila — nao era o
 * livro, era o inventario inteiro
 *
 * Uma funcao que os dois chamam nao deixa essa lista de acoes crescer em
 * dois lugares: um item novo entra aqui e aparece nos dois paineis
 */
function buildItemActions(entry, handlers) {
  const {
    onEquip,
    onUnequip,
    onDiscardItem,
    onDiscardEquipped,
    onUseItem,
    onEnchant,
  } = handlers;

  const item = getItem(entry.itemId);

  if (!item) return [];

  // so oferece "Equipar" quando o item tem ALGUM slot de destino
  // valido: a posicao conta, e um item cuja posicao nao existe no
  // boneco fica sem a opcao em vez de falhar ao clicar
  const equippable =
    item.type !== ITEM_TYPE.MATERIAL &&
    item.tier > 0 &&
    isEquippable(item);

  /**
   * ESTA PECA ACEITA AFIXO?
   *
   * E o mesmo `canEnchantItem` que o painel de encantar usa para montar
   * as DUAS listas dele. Se os dois decidissem por conta propria, uma
   * peca aqui marcada como "Encantar" poderia nao aparecer na lista do
   * painel — e o jogador abriria um painel vazio procurando o que ele
   * acabou de clicar
   */
  const encantavel = canEnchantItem(item.id);

  const actions = [];

  if (entry.equipped) {
    if (onUnequip) {
      actions.push({
        id: "unequip",
        label: "Desequipar",
        run: () => onUnequip(entry.slotId),
      });
    }

    if (encantavel && onEnchant) {
      actions.push({
        id: "enchant",
        label: "Encantar",
        run: () => onEnchant(entry),
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
      // O rotulo diz ONDE a peca vai: "Equipar" num slot livre
      // qualquer era uma promessa vaga
      const destino = slotNameFor(item);

      actions.push({
        id: "equip",
        label: destino ? `Equipar · ${destino}` : "Equipar",
        run: () => onEquip(entry),
      });
    }

    if (item.use && onUseItem) {
      const partes = [];

      if (item.use.heal) partes.push(`${item.use.heal} de vida`);
      if (item.use.restoreResource) {
        partes.push(`${item.use.restoreResource} de recurso`);
      }

      /**
       * O LIVRO, e o NOME DA SKILL no rotulo.
       *
       * Sem esta parte o botao dizia so "Usar", e "Usar" e um botao que
       * o jogador ja leu trinta vezes em pocaos sem olhar. Here o que
       * ele esta prestes a perder 150 moedas decide, e o rotulo e o
       * lugar mais barato de dizer isso
       *
       * O nome vem do pack pelo id, e nao de um texto escrito no item:
       * renomear a skill no catalogo muda este rotulo junto, e nao
       * deixaria "Usar" aqui falando um nome velho
       */
      if (item.use.teachSkill) {
        const skill = skillPeloId(item.use.teachSkill);

        partes.push(
          skill ? `ensina ${skill.name}` : "ensina a habilidade",
        );
      }

      const efeito = partes.join(" e ");

      actions.push({
        id: "use",
        label: efeito ? `Usar · ${efeito}` : "Usar",
        run: () => onUseItem(entry),
      });
    }

    /**
     * ENCANTAR, na mochila.
     *
     * Fica entre "Usar" e "Excluir": e uma acao de transformação, que vem
     * antes da acao destrutiva, e nunca antes de "Equipar" — vestir a peca
     * e o que o jogador quer quando abre um item da mochila
     */
    if (encantavel && onEnchant) {
      actions.push({
        id: "enchant",
        label: "Encantar",
        run: () => onEnchant(entry),
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

  return actions;
}

export function ItemSlot({
  entry,
  onEquip,
  onUnequip,
  onDiscardItem,
  onDiscardEquipped,
  onUseItem,
  onEnchant,
  compact = false,
  area,
  menuOpen = false,
  onToggleMenu,
}) {
  const item = getItem(entry.itemId);

  /**
   * PARA ONDE A CAIXA ABRE: para baixo ou para cima.
   *
   * ## POR QUE ISTO EXISTE
   *
   * A caixa e `position: absolute` dentro do slot, entao ela NAO tem
   * lugar na tela: ela tem lugar no painel. E o painel tem
   * `overflow: hidden`, e a lista da mochila tem `overflow-y: auto`. Uma
   * caixa que abre para baixo e CORTADA no item da ultima linha — e o
   * slot das botas, no boneco, e exatamente um deles
   *
   * Abrir para cima resolve, mas quebra o item da PRIMEIRA linha. Nao ha
   * um lado que serve para todos: quem decide e a posicao do slot na
   * hora de abrir
   *
   * ## POR QUE MEDIR E NAO ADIVINHAR POR INDICE
   *
   * Poderia ser uma regra de "linha par abre para cima", que e o tipo de
   * coisa que funciona ate a lista ter rolagem. Medindo o retangulo do
   * slot contra o do container, a regra continua valendo com a lista
   * rolada, com o painel meio na tela e com o boneco ter so as botas
   * vestidas
   *
   * ## POR QUE O `event`, E NAO UM `ref`
   *
   * O `event.currentTarget` e o botao que o jogador apertou, e dele sai o
   * slot e o container por `closest`. Um `ref` exigiria que o
   * `InvSlotView` — que e compartilhado com o mercado —aceitasse
   *_forwardRef_, e o mercado passaria a pagar por uma referencia que
   * nao usa
   */
  const [direcao, setDirecao] = useState("down");

  const abrirMenu = (clicado, event) => {
    const slot = event?.currentTarget?.closest?.(".inv-slot");

    const container = slot?.closest?.(
      ".inv-content, .inv-equip__grid, .inv-panel__body",
    );

    if (!slot || !container) {
      onToggleMenu?.(clicado);
      return;
    }

    const caixaDoSlot = slot.getBoundingClientRect();
    const caixaDoContainer = container.getBoundingClientRect();

    /**
     * A ALTURA QUE A CAIXA PRECISA.
     *
     * Duas acoes (vestir e excluir) ocupam uns 56px. E uma ESTIMATIVA de
     * propósito: medir o conteudo antes de renderizar a caixa seria um
     * segundo layout, e o valor so precisa ser grande o bastante para a
     * decisao de lado acerto — na duvida, tratar como "nao cabe embaixo"
     */
    const ALTURA_ESTIMADA = 56;

    const espacoAbaixo =
      caixaDoContainer.bottom - caixaDoSlot.bottom;

    setDirecao(
      espacoAbaixo < ALTURA_ESTIMADA + 8 ? "up" : "down",
    );

    onToggleMenu?.(clicado);
  };

  if (!item) return null;

  const actions = buildItemActions(entry, {
    onEquip,
    onUnequip,
    onDiscardItem,
    onDiscardEquipped,
    onUseItem,
    onEnchant,
  });

  return (
    /**
     * O BOTAO DE CLIQUE E O DO `InvSlotView`, e nao um aqui.
     *
     * Este componente desenhavo um `<button class="inv-slot__hit">`
     * proprio, DENTRO do `InvSlotView` — que ja traz o seu. Sao dois
     * botoes com a mesma classe no mesmo slot, e num `display: grid` sem
     * `grid-template-rows` cada filho ocupa uma linha propria: o do
     * `InvSlotView` fica na linha 1, que e onde o jogador ve o icone, e o
     * de baixo empurrava para fora da caixa.
     *
     * O efeito era que o clique batia no botao do `InvSlotView`, cujo
     * `onSelect` NUNCA era passado aqui — entao `onSelect?.(entry)` era
     * um no-op silencioso e a caixa de opcoes nao abria em lugar nenhum.
     * O botao que funcionava estava embaixo da dobra
     *
     * Passar o `onToggleMenu` pelo `onSelect` resolve os dois: um botao
     * so, e ele e o que o jogador esta clicando de verdade
     */
    <InvSlotView
      entry={entry}
      compact={compact}
      area={area}
      className={menuOpen ? "is-menu" : ""}
      onSelect={abrirMenu}
      selected={menuOpen}
    >
      {menuOpen && (
        <SlotMenu
          actions={actions}
          align={area ? "left" : "center"}
          direction={direcao}
        />
      )}
    </InvSlotView>
  );
}

function DollSlot({
  slot,
  onUnequip,
  onDiscardEquipped,
  onEnchant,
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
          // A raridade da variante vestida: sem ela o slot caia na do
          // catalogo e mostrava a arte da raridade base
          rarity: slot.rarity ?? null,
          count: 1,
          slotId: slot.id,
          equipped: true,
        }}
        onUnequip={onUnequip}
        onDiscardEquipped={onDiscardEquipped}
        onEnchant={onEnchant}
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
  onEnchant,
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
          onEnchant={onEnchant}
        />
      ))}
    </div>
  );
}

/**
 * O cartao de poder e bonus do equipamento.
 *
 * O botao "Equipar melhores" mora aqui e aparece SEMPRE: antes ele
 * ficava dentro da secao de bonus, que sumia quando nao havia nada
 * vestido — justamente quando o jogador mais precisa dele.
 */
function PowerCard({ equipment, onAutoEquip }) {
  const bonuses = Object.entries(equipment?.bonuses ?? {});

  return (
    <div className="inv-power">
      <div className="inv-power__head">
        <span className="inv-power__label">Power</span>
        <strong className="inv-power__value">
          {equipment?.power ?? 0}
        </strong>
      </div>

      {bonuses.length === 0 ? (
        <p className="inv-power__empty">
          Nenhum equipamento vestido.
        </p>
      ) : (
        <ul className="inv-stat-grid">
          {bonuses.map(([key, value]) => (
            <li key={key} className="inv-stat">
              <small>{STAT_LABELS[key] ?? key}</small>
              <b>{formatStat(key, value)}</b>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="inv-action"
        onClick={onAutoEquip}
      >
        ✦ Equipar melhores
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
              onClick={() => onChange(category, null)}
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
                  onClick={() => onChange(category, rarity)}
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
  onEnchant,
  onFilterChange,
  onFilterReset,
  onFilterPrune,
}) {
  const [category, setCategory] = useState("all");
  const [menu, setMenu] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState("rarity");

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

  const capacityPercent = Math.min(
    100,
    (summary.used / Math.max(1, summary.capacity)) * 100,
  );

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

  const useItem = (entry) => {
    closeMenu();
    onUseItem?.(entry);
  };

  /**
   * ENCANTAR: fecha a mochila e entrega a peca ao painel de encantar.
   *
   * O `closeMenu` vem antes porque o painel de inventario vai sair de
   * cena — os dois paineis sao o mesmo `PAINEL`, entao abrir o de
   * encantar ja desmonta este. Sem fechar a caixa aqui, a troca
   * aconteceria um quadro depois e a caixa piscaria no item errado
   */
  const enchantItem = (entry) => {
    closeMenu();
    onEnchant?.(entry);
  };

  const changeFilter = (key, value) => {
    closeMenu();
    onFilterChange?.(key, value);
  };

  // a contagem de cada aba, calculada uma vez por mudanca da mochila
  const tabCounts = useMemo(() => {
    const counts = {};

    for (const tab of TABS) {
      counts[tab.id] = tab.types
        ? entries.filter((entry) => {
            const def = getItem(entry.itemId);
            return def && tab.types.includes(def.type);
          }).length
        : entries.length;
    }

    return counts;
  }, [entries]);

  // aba + busca + ordenacao num passo so, ja com o item resolvido
  const cards = useMemo(() => {
    const tab = TABS.find((entry) => entry.id === category);
    const term = searchTerm.trim().toLowerCase();

    const list = [];

    for (const entry of entries) {
      const item = getItem(entry.itemId);

      if (!item) continue;
      if (tab?.types && !tab.types.includes(item.type)) continue;
      if (term && !item.name.toLowerCase().includes(term)) continue;

      const raridadeId = entry.rarity ?? item.rarity;

      list.push({
        entry,
        item,
        raridadeId,
        style: RARITY_STYLE[raridadeId] ?? rarityOf(item),
      });
    }

    const byName = (a, b) => a.item.name.localeCompare(b.item.name);

    list.sort((a, b) => {
      if (sort === "name") return byName(a, b);

      if (sort === "count") {
        return b.entry.count - a.entry.count || byName(a, b);
      }

      if (sort === "value") {
        return (
          (b.item.value ?? 0) * b.entry.count -
            (a.item.value ?? 0) * a.entry.count || byName(a, b)
        );
      }

      return (
        (RARITY_RANK[a.raridadeId] ?? 9) -
          (RARITY_RANK[b.raridadeId] ?? 9) || byName(a, b)
      );
    });

    return list;
  }, [entries, category, searchTerm, sort]);

  const totalValue = entries.reduce((total, entry) => {
    const item = getItem(entry.itemId);

    return total + (item?.value ?? 0) * entry.count;
  }, 0);

  const filtering =
    filter[LOOT_CATEGORIES[0]] !== null ||
    filter[LOOT_CATEGORIES[1]] !== null;

  const searching = searchTerm.trim() !== "";

  return (
    <section className="inv-panel inv-v2">
      <header className="inv-header">
        <div className="inv-header__left">

          <div className="inv-header__titles">
            <h2 className="inv-title">Inventário</h2>

            <div className="inv-stats-summary">
              <span
                className={[
                  "inv-chip",
                  summary.isFull ? "is-full" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title="Espaço da mochila"
              >
                <i>▣</i>
                <b>
                  {summary.used}/{summary.capacity}
                </b>
                <span className="inv-chip__bar">
                  <span
                    style={{ width: `${capacityPercent}%` }}
                  />
                </span>
              </span>

              <span className="inv-chip inv-chip--gold" title="Moedas">
                <i>◉</i>
                <b>{summary.coins}</b>
              </span>
            </div>
          </div>
        </div>

        <div className="inv-header__right">
          <div className="inv-search">
            <span className="inv-search__icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="text"
              className="inv-search__input"
              placeholder="Pesquisar itens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="inv-search__clear"
                onClick={() => setSearchTerm("")}
                title="Limpar pesquisa"
              >
                ✕
              </button>
            )}
          </div>

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
        </div>
      </header>

      <div className="inv-panel__body">
        <aside className="inv-illus">
          <section className="inv-equipment-section">
            <h3 className="inv-section-title">Equipamento</h3>

            <EquipmentDoll
              equipment={equipment}
              menu={menu}
              onToggleMenu={toggleMenu}
              onUnequip={onUnequip}
              onDiscardEquipped={discardEquipped}
              onEnchant={enchantItem}
            />
          </section>

          <PowerCard
            equipment={equipment}
            onAutoEquip={onAutoEquip}
          />
        </aside>

        <main className="inv-main">
          <div className="inv-toolbar">
            <nav className="inv-tabs-compact">
              {TABS.map((entry) => {
                const count = tabCounts[entry.id];

                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={[
                      "inv-tab-compact",
                      category === entry.id ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      closeMenu();
                      setCategory(entry.id);
                    }}
                    title={entry.label}
                  >
                    <span className="inv-tab-compact__icon">
                      {entry.icon}
                    </span>
                    <small>{entry.label}</small>
                    {count > 0 && (
                      <i className="inv-tab-compact__count">
                        {count}
                      </i>
                    )}
                  </button>
                );
              })}
            </nav>

            <label className="inv-sort">
              <span>Ordenar</span>
              <select
                className="inv-sort__select"
                value={sort}
                onChange={(e) => {
                  closeMenu();
                  setSort(e.target.value);
                }}
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="inv-content">
            {cards.length === 0 ? (
              <div className="inv-empty-state">
                <div className="inv-empty-icon">
                  {searching ? "⌕" : "▣"}
                </div>
                <p className="inv-panel__empty">
                  {searching
                    ? "Nenhum item encontrado para a busca."
                    : "Nenhum item nesta categoria."}
                </p>
              </div>
            ) : (
              <div className="inv-grid-modern">
                {cards.map(({ entry, item, raridadeId, style }) => {
                  /**
                   * AS ACOES DESTE ITEM, montadas aqui e nao no cartao.
                   *
                   * O `ItemCard` so pendura o que recebe: quem sabe o que
                   * cabe num livro e o que cabe numa pocao e o dono da
                   * lista. Passar os handlers pelo `slotProps` sem montar a
                   * lista aqui deixava o inventario inteiro sem acao — o
                   * clique abria o card e nao aparecia nada
                   */
                  const acoes = buildItemActions(entry, {
                    onEquip,
                    onDiscardItem: discardItem,
                    onUseItem: useItem,
                    onEnchant: enchantItem,
                  });

                  const aberto = menu === entry.uid;

                  return (
                    <ItemCard
                      key={entry.uid ?? entry.itemId}
                      entry={entry}
                      className={aberto ? "is-menu" : ""}
                      slotProps={{
                        onToggleMenu: toggleMenu,
                        menuOpen: aberto,
                      }}
/**
                   * O MENU FORA DA LISTA, e nao dentro do cartao.
                   *
                   * A `.inv-content` rola, e um `absolute` dentro dela e
                   * cortado nas duas bordas: para baixo o item do topo
                   * perdia a caixa, para cima ela passava da borda e
                   * ficava ATRAS da barra de abas
                   *
                   * O portal pendura a caixa no `body` com `fixed`, que
                   * nao conhece container nenhum. E o que o `ItemTooltip`
                   * ja faz pela dica, pelo mesmo motivo
                   */
                  menu={
                    aberto ? (
                      <SlotMenuFloat
                        entry={entry}
                        actions={acoes}
                      />
                    ) : null
                  }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </main>
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

      {filterOpen && (
        <div className="inv-filter-panel">
          <FilterPanel
            filter={filter}
            onChange={changeFilter}
            onReset={() => onFilterReset?.()}
            onPrune={() => onFilterPrune?.()}
            onClose={() => setFilterOpen(false)}
          />
        </div>
      )}
    </section>
  );
}

export { DEFAULT_LOOT_FILTER };
