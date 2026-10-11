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
        {/*
          SEM O ICONE DO INIMIGO, e o nome comeca na borda do cartao.

          Havia um glifo colorido de 26px antes do nome e do nivel. Ele
          era o mesmo de todas as criaturas daquele tipo — o catalogo tem
          um icone por TIPO, e nao um por criatura — entao dois slimes de
          nivel diferente mostravam o glifo identico ao lado de numeros que
          nao eram. O que ele acrescentava era cor, e a cor do tipo ja
          aparece na barra de progresso da cacada logo abaixo
        */}
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
          data-tip={
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

  /**
   * A LISTA COM O QUE AINDA DA PARA CAÇAR EM CIMA.
   *
   * ## POR QUE ORDENAR AQUI E NAO NO `Bestiary.snapshot`
   *
   * Porque a ordem e uma decisao de LEITURA da tela, e nao do estado. O
   * `snapshot` monta o que cada criatura tem; quem decide o que o jogador
   * ve primeiro e o painel. Ordenar la deixaria o estado do jogo
   * dependendo de um criterio visual
   *
   * ## POR QUE SO `done`
   *
   * Porque o que desce e o ACABADO. Uma criatura com cacada em andamento
   * continua sendo trabalho do jogador e continua valendo o lugar dela
   * em cima, mesmo com metade feita
   *
   * ## POR QUE UM `[...].sort` E NAO `toSorted`
   *
   * Porque `toSorted` cria um array novo e o `entries` do snapshot pode
   * ser o mesmo objeto que o servidor mandou. Ordenar no lugar mexeria no
   * dado de quemRecebeu — e da proxima vez que o painel fosse aberto sem
   * um pacote novo, a lista ja viria fora de ordem
   *
   * ## E POR QUE SO DESEMPATA POR `done`, SEM `localeCompare`
   *
   * Porque dentro de cada grupo a ordem do catalogo se mantem, e e a
   * ordem em que as criaturas foram pensadas. Um `sort` por nome tiraria
   * o slime do primeiro lugar do Brejo e colocaria no meio, e o jogador
   * perderia o mapa mental do bestiario
   */
  const entries = [...data.entries].sort(
    (a, b) => Number(a.done) - Number(b.done),
  );

  return (
    <section className="bst-panel">
      <header className="bst-panel__head">
        <h2>Bestiario</h2>

        <span className="bst-panel__tally">
          {data.completed}/{data.total} cacadas
        </span>

        {/*
          O X NO FIM DO CABEÇALHO, e nao no começo.

          `margin-left: auto` só joga um elemento para a direita quando ele
          é o ÚLTIMO da linha. Sendo o primeiro, ele encostava no título
        */}
        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar (B)"
        >
          ✕
        </button>
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
          {entries.map((entry) => (
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
