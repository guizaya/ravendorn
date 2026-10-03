import { useMemo, useState } from "react";
import {
  RARITY_ORDER,
  RARITY_STYLE,
} from "../../data/items/index.js";
import ItemIcon from "../UI/ItemIcon.jsx";

const COMMON = "common";

const EMPTY_CRAFT = {
  categories: [],
  total: 0,
  ready: 0,
};

/** um ingrediente da receita, com a resposta de onde vem */
function IngredientRow({ ingredient }) {
  return (
    <li
      className={[
        "cft-ing",
        ingredient.ok ? "is-ok" : "is-missing",
      ].filter(Boolean).join(" ")}
    >
      <div className="cft-ing__head">
        <span className="cft-ing__icon">{ingredient.icon}</span>
        <span className="cft-ing__name">{ingredient.name}</span>
        <span className="cft-ing__count">
          <b>{ingredient.have}</b>
          <i>/{ingredient.need}</i>
        </span>
      </div>

      {ingredient.missing > 0 && (
        <p className="cft-ing__missing">
          Faltam {ingredient.missing}
        </p>
      )}

      {ingredient.sources.length > 0 ? (
        <ul className="cft-source">
          {ingredient.sources.map((source) => (
            <li
              key={`${ingredient.itemId}_${source.id}`}
              className="cft-source__row"
            >
              <span
                className="cft-source__icon"
                style={{ color: source.color }}
              >
                {source.icon}
              </span>
              <span className="cft-source__name">
                {source.name}
                <small>
                  Nv.{source.level}
                  {source.zoneName ? ` · ${source.zoneName}` : ""}
                </small>
              </span>
              <span
                className="cft-source__chance"
                title={`${Math.round(
                  source.share * 100,
                )}% do pool de itens desta criatura`}
              >
                <i
                  className="cft-source__bar"
                  style={{ width: `${Math.max(
                    3,
                    Math.round(source.share * 100),
                  )}%` }}
                />
                <b>{Math.round(source.share * 100)}%</b>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cft-source__none">
          Nenhuma criatura solta este item.
        </p>
      )}
    </li>
  );
}

/** as cinco raridades do item */
function RarityPicker({ recipe, chosen, onPick }) {
  return (
    <div className="cft-rarity">
      <span className="eyebrow">Raridade</span>

      <div
        className="cft-rarity__row"
        role="group"
        aria-label="Raridade do item"
      >
        {recipe.rarities.map((entry) => (
          <button
            key={entry.rarity}
            type="button"
            className={[
              "cft-rarity__choice",
              entry.rarity === chosen ? "is-active" : "",
              entry.canCraft ? "is-ready" : "",
            ].filter(Boolean).join(" ")}
            style={{ "--rarity": entry.color }}
            onClick={() => onPick(entry.rarity)}
            aria-pressed={entry.rarity === chosen}
            title={`${entry.label}${
              entry.statsLine ? ` · ${entry.statsLine}` : ""
            }`}
          >
            <i />
            <small>{entry.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/** a receita do item na raridade escolhida */
export function RecipeDetail({
  recipe,
  rarity,
  onPickRarity,
  onCraft,
}) {
  if (!recipe) {
    return (
      <aside className="cft-detail cft-detail--empty">
        <p className="inv-panel__empty">
          Escolha um item para ver a receita.
        </p>
      </aside>
    );
  }

  return (
    <aside className="cft-detail">
      <header className="cft-detail__head">
        {/* o icone grande segue a raridade ESCOLHIDA: e o que o
            jogador vai receber, e nao a do catalogo. A arte tambem
            segue a escolhida, e nao a base do item */}
        <span
          className="cft-detail__icon"
          style={{ "--rarity": rarity?.color }}
        >
          <ItemIcon
            item={recipe}
            rarity={rarity?.rarity ?? null}
          />
        </span>

        <span className="cft-detail__names">
          <strong>{recipe.name}</strong>
          <small>
            {recipe.tier > 0 ? `T${recipe.tier}` : "Sem tier"}
            {recipe.kindLabel ? ` · ${recipe.kindLabel}` : ""}
            {rarity ? ` · ${rarity.label}` : ""}
          </small>
        </span>

        {rarity && (
          <span
            className="cft-detail__rarity"
            style={{ "--rarity": rarity.color }}
          >
            {rarity.label}
          </span>
        )}
      </header>

      <RarityPicker
        recipe={recipe}
        chosen={rarity?.rarity}
        onPick={onPickRarity}
      />

      {/* material nao tem stat nenhum: o valor sozinho ainda
          precisa aparecer, senao a aba de materia fica muda */}
      {(rarity?.statsLine || rarity?.value > 0) && (
        <p className="cft-detail__stats">
          {rarity.statsLine}
          <span className="cft-detail__value">
            {rarity.value} moedas
          </span>
        </p>
      )}

      {rarity && rarity.coins > 0 && (
        <p
          className={[
            "cft-coins",
            rarity.shortOnCoins ? "is-short" : "",
          ].filter(Boolean).join(" ")}
        >
          <i>◉</i>
          <b>{rarity.coins}</b> moedas
          {rarity.shortOnCoins && (
            <small>
              voce tem {rarity.haveCoins}
            </small>
          )}
        </p>
      )}

      <span className="eyebrow">Ingredientes</span>

      <ul className="cft-ing__list">
        {(rarity?.ingredients ?? []).map((ingredient) => (
          <IngredientRow
            key={ingredient.itemId}
            ingredient={ingredient}
          />
        ))}
      </ul>

      <button
        type="button"
        className={[
          "cft-action",
          rarity?.canCraft ? "is-ready" : "",
        ].filter(Boolean).join(" ")}
        onClick={() =>
          onCraft?.(recipe.id, rarity?.rarity ?? null)
        }
        disabled={!rarity?.canCraft}
      >
        {rarity?.canCraft
          ? "Criar"
          : rarity?.shortOnCoins
            ? "Faltam moedas"
            : (rarity?.missing ?? 0) > 0
              ? `Faltam ${rarity.missing} ingrediente${
                  rarity.missing > 1 ? "s" : ""
                }`
              : "Mochila cheia"}
      </button>
    </aside>
  );
}

/** uma celula da grade, com o mesmo visual de slot do inventario */
function CraftCell({ recipe, selected, onSelect }) {
  const ready = recipe.rarities.filter(
    (entry) => entry.canCraft,
  );

  return (
    <div className="inv-cell cft-cell">
      {/* A celula da lista e o NOME do produto, nao um item ja
          feito: a arte e sempre a COMUM, e a raridade de verdade so
          aparece na receita, a direita, depois que o jogador escolhe.
          Mostrar a raridade do catalogo aqui prometia uma coisa que o
          craft nao entrega.

          O `rarity` explicito no `ItemIcon` e obrigatorio: sem ele o
          componente receberia `null`, cairia no glifo de TEXTO, e a
          celula do arco mostraria um emoji no lugar da arte. */}
      <div
        className={[
          "inv-slot",
          "inv-slot--common",
          selected ? "is-menu" : "",
          recipe.canCraft ? "cft-cell--ready" : "",
        ].filter(Boolean).join(" ")}
        style={{ "--rarity": RARITY_STYLE[COMMON].color }}
        title={`${recipe.name}\n${
          RARITY_ORDER.length
        } raridades · ${recipe.ingredientCount} ingredientes${
          recipe.canCraft
            ? "\nPronto para criar"
            : "\nFaltam materiais"
        }`}
      >
        <button
          type="button"
          className="inv-slot__hit"
          onClick={() => onSelect(recipe.id)}
          aria-label={recipe.name}
          aria-pressed={selected}
        >
          <ItemIcon
            className="inv-slot__icon"
            item={recipe}
            rarity={COMMON}
          />
        </button>

        {recipe.tier > 0 && (
          <span className="inv-slot__badge inv-slot__badge--tier">
            T{recipe.tier}
          </span>
        )}

        {recipe.canCraft && (
          <span
            className="cft-cell__check"
            title={`Pronto em ${ready.length} raridade${
              ready.length > 1 ? "s" : ""
            }`}
          >
            ✓
          </span>
        )}
      </div>

      <span className="inv-cell__name">{recipe.name}</span>
    </div>
  );
}

export default function CraftPanel({
  craft,
  onCraft,
  onClose,
}) {
  const data = craft ?? EMPTY_CRAFT;

  const [category, setCategory] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [rarity, setRarity] = useState(null);

  // o badge do botao promete "N prontas", entao o painel tem de
  // abrir mostrando o que da para criar. so quando nao ha nada
  // pronto ele cai na primeira aba.
  const active = useMemo(
    () =>
      data.categories.find(
        (entry) => entry.id === category,
      ) ??
      data.categories.find(
        (entry) => entry.ready > 0,
      ) ??
      data.categories[0] ??
      null,
    [data.categories, category],
  );

  const selected = useMemo(
    () =>
      active?.recipes.find(
        (recipe) => recipe.id === selectedId,
      ) ??
      active?.recipes.find(
        (recipe) => recipe.canCraft,
      ) ??
      active?.recipes[0] ??
      null,
    [active, selectedId],
  );

  // a raridade escolhida precisa ser o OBJETO da raridade, e nao
  // a string dela. o detalhe inteiro le rarity.color, .label,
  // .statsLine e .ingredients: com a string no lugar, clicar numa
  // raridade apagava a receita e o rotulo em vez de trocar
  const chosenRarity = useMemo(() => {
    if (!selected) return null;

    return (
      (rarity
        ? selected.rarities.find(
            (entry) => entry.rarity === rarity,
          )
        : null) ??
      selected.rarities.find(
        (entry) => entry.rarity === selected.defaultRarity,
      ) ??
      selected.rarities[0] ??
      null
    );
  }, [selected, rarity]);

  const pick = (id) => {
    setCategory(id);

    const next = data.categories.find(
      (entry) => entry.id === id,
    );

    setSelectedId(next?.recipes[0]?.id ?? null);
    setRarity(null);
  };

  const pickRarity = (next) => {
    setRarity(next);
  };

  return (
    <section className="inv-panel cft-panel">
      <nav className="inv-tabs">
        {data.categories.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={[
              "inv-tab",
              active?.id === entry.id ? "is-active" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => pick(entry.id)}
            title={entry.label}
          >
            <span className="inv-tab__icon">{entry.icon}</span>
            <small>{entry.label}</small>
            {entry.recipes.length > 0 && (
              <i className="inv-tab__count">
                {entry.recipes.length}
              </i>
            )}
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="inv-close cft-close"
        onClick={onClose}
        title="Fechar (C)"
        aria-label="Fechar o craft"
      >
        ✕
      </button>

      <div className="inv-panel__body cft-body">
        <div className="inv-main">
          {active && active.recipes.length > 0 ? (
            <div className="inv-grid">
              {active.recipes.map((recipe) => (
                <CraftCell
                  key={recipe.id}
                  recipe={recipe}
                  selected={selected?.id === recipe.id}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          ) : (
            <p className="inv-panel__empty">
              Nenhuma receita nesta categoria.
            </p>
          )}
        </div>

        <RecipeDetail
          recipe={selected}
          rarity={chosenRarity}
          onPickRarity={pickRarity}
          onCraft={onCraft}
        />
      </div>

      {/* Nao existe meta de criação: com os itens da receita em
          mãos o jogador cria quantos quiser, a qualquer momento.
          Um contador de "criados" e um "prontas de 29" faziam o
          craft parecer uma lista de tarefas com fim, e nao e.
          O que sobra aqui é o saldo, que é o unico numero que
          muda de estado e importa. */}
      <footer className="inv-status">
        <span className="inv-status__coins">
          <i>◉</i>
          {data.coins ?? 0}
        </span>
      </footer>
    </section>
  );
}
