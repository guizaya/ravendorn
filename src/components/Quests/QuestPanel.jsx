import { useState } from "react";
import ItemIcon from "../UI/ItemIcon.jsx";
import { getItem } from "../../data/items/index.js";
import { QUEST_SCOPE } from "../../data/quests/index.js";

const TYPE_LABEL = {
  hunt: "Caçada",
  kill: "Extermínio",
  equip: "Equipamento",
  level: "Progressão",
  locked: "Bloqueada",
};

/**
 * O bloco de RECOMPENSAS de uma missao: ouro, xp e itens.
 *
 * Fica a DIREITA do cartao, na ordem em que o jogador lida com eles:
 * moedas, xp, itens. E sempre o que a missao promete, e nao o que o
 * jogador ja recebeu — e o valor da coluna e ver antes de clicar no
 * [RECEBER]
 *
 * Cada icone e a arte do item quando ele tem (`ItemIcon` cai no
 * glifo do catalogo quando nao tem), a moeda usa o mesmo `◉` do
 * contador de ouro da HUD, e o xp e um selo de texto. Nenhum dos
 * tres e um item do catalogo, entao os tres tem tratamento proprio
 */
function Rewards({ rewards }) {
  const coins = rewards?.coins ?? 0;
  const xp = rewards?.xp ?? 0;
  const items = rewards?.items ?? [];

  if (coins <= 0 && xp <= 0 && items.length === 0) {
    return null;
  }

  return (
    <div
      className="qst-rewards"
      title="Recompensa ao concluir a missão"
    >
      {coins > 0 && (
        <span className="qst-reward qst-reward--gold">
          <i aria-hidden="true">◉</i>
          {coins}
          <span className="qst-reward__sr">
            {" "}
            moedas
          </span>
        </span>
      )}

      {xp > 0 && (
        <span className="qst-reward qst-reward--xp">
          <i aria-hidden="true">XP</i>
          {xp}
          <span className="qst-reward__sr"> de xp</span>
        </span>
      )}

      {items.map((premio) => {
        /**
         * O item do CATALOGO, e nao so o `itemId`.
         *
         * O `ItemIcon` tira a arte do `itemId` + raridade, mas o
         * glifo de quem nao tem arte vem do `item.icon`. Passando so
         * o `itemId`, os materiais da missao — que sao todos sem arte
         * desenhada — desenharia um icone VAZIO, que e pior que
         * nenhum icone
         */
        const item = getItem(premio.itemId);

        return (
          <span
            key={premio.itemId}
            className="qst-reward qst-reward--item"
            title={`${premio.count}x ${
              item?.name ?? premio.itemId
            }`}
          >
            <ItemIcon
              item={item}
              itemId={premio.itemId}
              rarity={item?.rarity ?? null}
              className="qst-reward__icon"
              alt=""
            />
            <b>{premio.count}</b>
            <span className="qst-reward__sr">
              {" "}
              {item?.name ?? premio.itemId}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** A barra e o contador `3/4` de um objetivo que anda. */
function Progress({ progress, count }) {
  const atual = Math.min(progress ?? 0, count ?? 0);
  const percent =
    count > 0 ? Math.min(100, (atual / count) * 100) : 0;

  return (
    <div className="qst-progress">
      <div className="qst-progress__track">
        <i style={{ width: `${percent}%` }} />
      </div>
      <span>
        {atual}/{count}
      </span>
    </div>
  );
}

/**
 * O cartao de uma missao.
 *
 * Tres colunas, na ordem da referencia: o que a missao e a fazer, o
 * que ela paga, e o botao. O `li` e o alvo do layout em grade, e por
 * isso que o texto fica num wrapper so: o nome nunca compete com os
 * icones por espaco
 */
function QuestRow({
  quest,
  state,
  onAccept,
  onAbandon,
  onFocus,
  onClaim,
  auto,
}) {
  const waiting = quest.autoCompletable === false;
  const claimable = Boolean(quest.claimable) || state === "claimed";

  const progresso =
    typeof quest.count === "number" && quest.count > 0;

  const classe = [
    "qst-row",
    `is-${state}`,
    claimable ? "is-claimed" : "",
    waiting && state === "active" ? "is-waiting" : "",
    auto ? "is-auto" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={classe}>
      <div className="qst-row__info">
        <div className="qst-row__head">
          <strong>{quest.name}</strong>
          <span className="qst-row__type">
            {TYPE_LABEL[quest.type] ?? quest.type}
          </span>
        </div>

        <p className="qst-row__text">
          {quest.summary}
        </p>

        {progresso &&
          !waiting &&
          (state === "active" || state === "available") && (
            <Progress
              progress={quest.progress ?? 0}
              count={quest.count}
            />
          )}

        {waiting && state === "active" && (
          <span className="qst-row__waiting">
            Conclua manualmente
          </span>
        )}
      </div>

      <Rewards rewards={quest.rewards} />

      <div className="qst-row__action">
        {/*
          A ordem aqui e o que separa [RECEBER] de [CONCLUIDA].

          `claimable` vem PRIMEIRO porque e o unico estado em que a
          recompensa ainda esta na fila. O `done` sozinho quer dizer
          "o objetivo foi cumprido E o resgate ja saiu", e nesse
          caso o botao e so o rotulo
        */}
        {claimable ? (
          <button
            type="button"
            className="qst-action qst-action--claim"
            onClick={() => onClaim?.(quest.id)}
            title="Receber moedas, xp e itens"
          >
            RECEBER
          </button>
        ) : state === "available" && onAccept ? (
          <button
            type="button"
            className="qst-action qst-action--accept"
            onClick={() => onAccept(quest.id)}
          >
            Aceitar
          </button>
        ) : onFocus && state === "active" && !waiting ? (
          <button
            type="button"
            className={[
              "qst-action",
              "qst-action--auto",
              auto ? "is-on" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onFocus(quest.id)}
            title="Completar esta missão em modo automático"
          >
            {auto ? "AUTO" : "Completar auto"}
          </button>
        ) : state === "done" ? (
          <span className="qst-action qst-action--done">
            ✓ CONCLUÍDA
          </span>
        ) : null}

        {onAbandon && state === "active" && (
          <button
            type="button"
            className="qst-action qst-action--abandon"
            onClick={onAbandon}
          >
            Abandonar
          </button>
        )}
      </div>
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
  onClaim,
}) {
  const data = quests ?? {
    main: { steps: [], current: null, total: 0 },
    side: { available: [], current: null, completed: 0 },
    auto: { enabled: false, objectiveId: null, quest: null },
    claimable: [],
  };

  const side = data.side;
  const auto = data.auto ?? {};

  const hasActiveSide = Boolean(side.current);

  // a aba segue o trabalho do jogador: com uma side ativa e uma
  // principal em andamento, a principal tem prioridade, porque e
  // ela que desbloqueia a campanha
  const [tab, setTab] = useState(() =>
    data.main?.current ? "main" : "side",
  );

  // A aba escolhida pode esvaziar do nada: a campanha termina e a
  // lista de passos some do snapshot. Marcar "Principal" com
  // nada dentro e pior que trocar de aba, porque o jogador fica
  // olhando para um vazio achando que quebrou. O desvio vai para
  // a aba que tem o que mostrar.
  const mainTemAlgo = data.main.steps.length > 0;
  const sideTemAlgo =
    side.available.length > 0 || hasActiveSide;

  const ativa =
    tab === "main"
      ? mainTemAlgo
        ? "main"
        : sideTemAlgo
          ? "side"
          : "main"
      : sideTemAlgo
        ? "side"
        : mainTemAlgo
          ? "main"
          : "side";

  const abas = [
    {
      id: "main",
      label: "Principal",
      icon: "★",
      // quantas faltam terminar: e o que importa na campanha
      count: data.main.steps.filter(
        (step) =>
          data.main.current?.id === step.id ||
          step.state !== "done",
      ).length,
    },
    {
      id: "side",
      label: "Secundárias",
      icon: "◆",
      count: side.available.filter((quest) => !quest.done)
        .length,
    },
  ];

  /**
   * De onde vem a missao da aba ABERTA, que e o que o [RECEBER]
   * filtra.
   *
   * A aba e o que o jogador esta olhando, e o `scope` e o que a
   * recompensa e. Os dois andam juntos — a Principal so tem
   * recompensa de missao principal — mas quem decide a aba e o
   * snapshot, e nao o contrario
   */
  const scopeDaAba =
    ativa === "main" ? QUEST_SCOPE.MAIN : QUEST_SCOPE.SIDE;

  /**
   * As missoes com recompensa nao recebida DESTA aba.
   *
   * O filtro e pelo `scope` justamente para o [RECEBER] nao vazar
   * de uma aba para a outra: uma principal concluida apareceria duas
   * vezes, uma em cada aba, e o jogador veria o mesmo botao em dois
   * lugares
   *
   * O [RECEBER] nao e um cartao a parte: ele fica no cartao da propria
   * missao, e o que muda e o estado dela. Sem o `state: "claimed"`
   * abaixo, a principal concluida desapareceria da lista no instante
   * em que o jogador fecha o objetivo, e ele nunca veria de onde saiu
   * o gold
   */
  const resgataveis = (data.claimable ?? []).filter(
    (entrada) => entrada.scope === scopeDaAba,
  );

  const recompensaDe = (questId) =>
    resgataveis.find((entrada) => entrada.id === questId) ??
    null;

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

        {resgataveis.length > 0 && (
          <span className="qst-panel__pending">
            {resgataveis.length}{" "}
            {resgataveis.length === 1
              ? "recompensa"
              : "recompensas"}{" "}
            a receber
          </span>
        )}

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

      <nav
        className="qst-tabs"
        role="tablist"
        aria-label="Tipo de missão"
      >
        {abas.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            className={[
              "qst-tab",
              ativa === entry.id ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-selected={ativa === entry.id}
            onClick={() => setTab(entry.id)}
            title={
              entry.id === "side"
                ? hasActiveSide
                  ? "Uma secundária ativa por vez"
                  : "Escolha uma secundária"
                : entry.label
            }
          >
            <span className="qst-tab__icon">
              {entry.icon}
            </span>
            <small>{entry.label}</small>
            {entry.count > 0 && (
              <i className="qst-tab__count">
                {entry.count}
              </i>
            )}
          </button>
        ))}
      </nav>

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

        {ativa === "main" ? (
          <section className="qst-group">
            <ul className="qst-list">
              {data.main.steps.map((step) => {
                const current =
                  data.main.current?.id === step.id;

                const base = current
                  ? data.main.current
                  : {
                      ...step,
                      /**
                       * So o passo que ainda NAO foi cumprido e
                       * "bloqueado".
                       *
                       * Marcar tambem o passo `done` como bloqueado
                       * colocava a etiqueta BLOQUEADA ao lado do
                       * [RECEBER], e o jogador lia "esta missao esta
                       * trancada" numa missao que ele acabou de
                       * terminar. O bloqueio de verdade continua no
                       * `state: "locked"`, que e a opacidade do
                       * cartao
                       */
                      type:
                        step.state === "done"
                          ? step.type
                          : "locked",
                    };

                const resgatavel = recompensaDe(step.id);

                return (
                  <QuestRow
                    key={step.id}
                    quest={{
                      ...base,
                      // a recompensa vem do passo, e o passo e
                      // sempre a linha real do catalogo. o `current`
                      // e o mesmo passo ja atualizado com progresso
                      rewards:
                        step.rewards ?? base.rewards,
                      claimable: step.claimable,
                    }}
                    state={
                      resgatavel
                        ? "claimed"
                        : current
                          ? "active"
                          : step.state
                    }
                    auto={
                      auto.enabled &&
                      auto.objectiveId === step.id
                    }
                    onFocus={
                      current ? onFocus : undefined
                    }
                    onClaim={onClaim}
                  />
                );
              })}
            </ul>
          </section>
        ) : (
          <section className="qst-group">
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
                  onClaim={onClaim}
                />
              </ul>
            )}

            <ul className="qst-list">
              {side.available.map((quest) => {
                /**
                 * A missao ativa JA esta desenhada no bloco de
                 * cima, com o botao de abandonar e o de auto.
                 *
                 * Ela aparecia duas vezes: uma la e outra aqui, com
                 * dois "Abandonar" na mesma tela. A de cima e a
                 * completa; a de baixo e a lista do que da para
                 * escolher, e a ativa ja esta escolhida
                 */
                if (quest.active) return null;

                const resgatavel =
                  recompensaDe(quest.id);

                const state = resgatavel
                  ? "claimed"
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
                    onClaim={onClaim}
                  />
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}