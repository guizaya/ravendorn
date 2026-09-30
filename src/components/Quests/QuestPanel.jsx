const TYPE_LABEL = {
  hunt: "Caçada",
  kill: "Extermínio",
  equip: "Equipamento",
  level: "Progressão",
};

function Progress({ progress, count }) {
  const percent =
    count > 0 ? Math.min(100, (progress / count) * 100) : 0;

  return (
    <div className="qst-progress">
      <div className="qst-progress__track">
        <i style={{ width: `${percent}%` }} />
      </div>
      <span>
        {progress}/{count}
      </span>
    </div>
  );
}

function QuestRow({
  quest,
  state,
  onAccept,
  onAbandon,
  onFocus,
  auto,
}) {
  const waiting = quest.autoCompletable === false;

  return (
    <li
      className={[
        "qst-row",
        `is-${state}`,
        waiting ? "is-waiting" : "",
        auto ? "is-auto" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="qst-row__head">
        <strong>{quest.name}</strong>
        <span className="qst-row__type">
          {TYPE_LABEL[quest.type] ?? quest.type}
        </span>
      </header>

      <p className="qst-row__text">
        {quest.summary}
      </p>

      {waiting && state === "active" && (
        <span className="qst-row__waiting">
          Conclua manualmente
        </span>
      )}

      {(state === "active" || state === "available") &&
        !waiting && (
          <>
            <Progress
              progress={quest.progress ?? 0}
              count={quest.count}
            />

            {onFocus && (
              <button
                type="button"
                className={[
                  "qst-row__accept",
                  auto ? "is-on" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onFocus(quest.id)}
              >
                {auto ? "AUTO ligado" : "Completar auto"}
              </button>
            )}
          </>
        )}

      {onAbandon && (
        <button
          type="button"
          className="qst-row__abandon"
          onClick={onAbandon}
        >
          Abandonar
        </button>
      )}

      {state === "available" && onAccept && (
        <button
          type="button"
          className="qst-row__accept"
          onClick={() => onAccept(quest.id)}
        >
          Aceitar
        </button>
      )}

      {state === "done" && (
        <span className="qst-row__done">
          ✓ Concluída
        </span>
      )}
    </li>
  );
}

export default function QuestPanel({
  quests,
  onClose,
  onAccept,
  onAbandon,
  onFocus,
  onToggleAuto,
}) {
  const data = quests ?? {
    main: { steps: [], current: null, total: 0 },
    side: { available: [], current: null, completed: 0 },
    auto: { enabled: false, objectiveId: null, quest: null },
  };

  const side = data.side;
  const auto = data.auto ?? {};

  const hasActiveSide = Boolean(side.current);

  return (
    <section className="qst-panel">
      <header className="qst-panel__head">
        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (Q)"
        >
          ✕
        </button>

        <h2>Missões</h2>

        <button
          type="button"
          className={[
            "qst-auto",
            auto.enabled ? "is-on" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={onToggleAuto}
          title="Completar a missão em modo automático"
        >
          {auto.enabled ? "AUTO ON" : "AUTO"}
        </button>
      </header>

      <div className="qst-panel__body">
        {auto.quest && (
          <div className="qst-autoinfo">
            <span className="qst-autoinfo__tag">
              AUTO
            </span>
            <div>
              <strong>{auto.quest.name}</strong>
              <small>
                {auto.quest.summary} —{" "}
                {auto.quest.progress}/{auto.quest.count}
              </small>
            </div>
          </div>
        )}

        <section className="qst-group">
          <h3 className="qst-group__title">Principal</h3>

          <ul className="qst-list">
            {data.main.steps.map((step) => {
              const current =
                data.main.current?.id === step.id;

              return (
                <QuestRow
                  key={step.id}
                  quest={
                    current
                      ? data.main.current
                      : { ...step, type: "locked" }
                  }
                  state={
                    current
                      ? "active"
                      : step.state
                  }
                  auto={
                    auto.enabled &&
                    auto.objectiveId === step.id
                  }
                  onFocus={
                    current
                      ? onFocus
                      : undefined
                  }
                />
              );
            })}
          </ul>
        </section>

        <section className="qst-group">
          <h3 className="qst-group__title">
            Secundárias
            <small>
              {hasActiveSide
                ? "uma ativa por vez"
                : "escolha uma"}
            </small>
          </h3>

          {side.current && (
            <ul className="qst-list">
              <QuestRow
                quest={side.current}
                state="active"
                auto={
                  auto.enabled &&
                  auto.objectiveId === side.current.id
                }
                onAbandon={onAbandon}
                onFocus={onFocus}
              />
            </ul>
          )}

          <ul className="qst-list">
            {side.available.map((quest) => {
              const state = quest.active
                ? "active"
                : quest.done
                  ? "done"
                  : hasActiveSide
                    ? "locked"
                    : "available";

              return (
                <QuestRow
                  key={quest.id}
                  quest={quest}
                  state={state}
                  onAccept={
                    state === "available" ? onAccept : null
                  }
                />
              );
            })}
          </ul>
        </section>
      </div>
    </section>
  );
}
