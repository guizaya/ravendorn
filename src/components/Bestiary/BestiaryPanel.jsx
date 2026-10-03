import PermanentBonus from "../UI/PermanentBonus.jsx";
import { BESTIARY_STAT } from "../../data/bestiary/index.js";

const BEHAVIOR_LABEL = {
  passive: "Pacífico",
  semiPassive: "Semi-agressivo",
  active: "Agressivo",
};

function HuntRow({ hunt }) {
  const percent = Math.min(
    100,
    (hunt.progress / hunt.count) * 100,
  );

  return (
    <li
      className={[
        "bst-hunt",
        hunt.done ? "is-done" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="bst-hunt__title">
        {hunt.title}
      </span>

      <span className="bst-hunt__bar">
        <span
          className="bst-hunt__fill"
          style={{ width: `${percent}%` }}
        />
      </span>

      <span className="bst-hunt__count">
        {Math.min(hunt.progress, hunt.count)}/{hunt.count}
      </span>

      <span className="bst-hunt__reward">
        {hunt.rewardLabel}
      </span>
    </li>
  );
}

function EntryCard({ entry, hunting, onHunt }) {
  const done = entry.hunts.filter((hunt) => hunt.done).length;

  const canHunt = Boolean(entry.zoneId);

  return (
    <li
      className={[
        "bst-entry",
        entry.done ? "is-done" : "",
        hunting ? "is-hunting" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="bst-entry__head">
        <span
          className="bst-entry__icon"
          style={{ color: entry.color }}
        >
          {entry.icon}
        </span>

        <span className="bst-entry__names">
          <strong>{entry.name}</strong>
          <small>
            Nv.{entry.level} ·{" "}
            {BEHAVIOR_LABEL[entry.behavior] ??
              entry.behavior}
            {entry.zoneName
              ? ` · ${entry.zoneName}`
              : ""}
          </small>
        </span>

        <span className="bst-entry__tally">
          {done}/{entry.hunts.length}
        </span>

        <button
          type="button"
          className="bst-entry__go"
          onClick={() => onHunt?.(entry.creatureId)}
          disabled={!canHunt}
          title={
            hunting
              ? `Parar de caçar ${entry.name}`
              : canHunt
                ? `Ir até ${entry.zoneName} e caçar apenas ${entry.name}`
                : `${entry.name} não tem zona conhecida`
          }
        >
          {hunting ? "Parar" : "Ir matar"}
        </button>
      </header>

      <ul className="bst-entry__hunts">
        {entry.hunts.map((hunt) => (
          <HuntRow key={hunt.id} hunt={hunt} />
        ))}
      </ul>
    </li>
  );
}

export default function BestiaryPanel({
  bestiary,
  hunting = null,
  onHunt,
  onClose,
}) {
  const data = bestiary ?? {
    entries: [],
    completed: 0,
    total: 0,
    isComplete: false,
    bonuses: {},
    bonusesLabel: "",
  };

  return (
    <section className="bst-panel">
      <header className="bst-panel__head">
        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (B)"
        >
          ✕
        </button>

        <h2>Bestiario</h2>

        <span className="bst-panel__tally">
          {data.completed}/{data.total} cacadas
        </span>
      </header>

      <div className="bst-panel__body">
        <section className="perm-bonus-box">
          <span className="eyebrow">Bônus permanente</span>

          {/*
            O MESMO componente que a colecao usa.

            Cacada e colecao dao a mesma coisa — stat permanente — e o
            jogador que le um le o outro sem traduzir. Antes os dois
            paineis faziam o selo com listas proprias, e o bestiario
            escrevia `VID` onde o painel de status escrevia `HP` para o
            mesmo numero
          */}
          <PermanentBonus
            bonuses={data.bonuses}
            empty="Nenhuma cacada concluida ainda. Abata criaturas para desbloquear bonus permanentes."
            label={data.bonusesLabel}
          />
        </section>

        <ul className="bst-list">
          {data.entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              hunting={hunting === entry.creatureId}
              onHunt={onHunt}
            />
          ))}
        </ul>

        {data.isComplete && (
          <p className="bst-complete">
            Bestiario completo. Todos os bonus sao seus.
          </p>
        )}
      </div>
    </section>
  );
}
