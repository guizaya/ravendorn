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

function BonusSummary({ bonuses, label }) {
  const entries = Object.entries(bonuses ?? {});

  if (entries.length === 0) {
    return (
      <p className="bst-empty">
        Nenhuma cacada concluida ainda. Abata criaturas para
        desbloquear bonus permanentes.
      </p>
    );
  }

  return (
    <div className="bst-bonus">
      {entries.map(([stat, value]) => {
        const info = BESTIARY_STAT[stat];
        const percent = info?.percent === true;

        return (
          <span
            key={stat}
            className="bst-bonus__chip"
            title={info?.label ?? stat}
          >
            <small>
              {info?.short ?? stat}
            </small>

            <strong
              style={{
                color: value >= 0 ? "#7ef0b0" : "#ff9d9d",
              }}
            >
              {value >= 0 ? "+" : ""}
              {percent
                ? `${Math.round(value * 100)}%`
                : Math.round(value)}
            </strong>
          </span>
        );
      })}

      {label && (
        <span className="bst-bonus__label">
          {label}
        </span>
      )}
    </div>
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
        <section className="bst-panel__bonus">
          <span className="eyebrow">Bônus permanente</span>
          <BonusSummary
            bonuses={data.bonuses}
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
