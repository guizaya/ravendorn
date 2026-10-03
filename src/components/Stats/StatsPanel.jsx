import {
  formatBonus,
  formatStat,
  STAT_DEFS,
} from "../../game/stats/StatSheet.js";

/**
 * O painel de STATS.
 *
 * A folha do personagem em tres colunas: o que a classe entrega nua,
 * o que veio de jogar, e o total. A ordem das linhas e a ordem em que
 * o jogador decide o que vestir, entao comeca pelo que ele E e so
 * depois mostra o que ele DERA
 *
 * Nada aqui calcula numero. Tudo vem pronto do `player.stats`, que o
 * motor monta no mesmo passo que monta os stats de combate. Um painel
 * que refaz a conta seria uma segunda verdade sobre o personagem, e
 * a segunda verdade e sempre a errada: ela nao sabe da peca que o
 * jogador acabou de tirar
 */
function StatRow({ row }) {
  const bonus = formatBonus(row, row.bonus);

  return (
    <li
      className={[
        "sts-row",
        row.attribute ? "is-attribute" : "",
        row.bonus > 0 ? "has-bonus" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className="sts-row__label"
        title={row.name}
      >
        <b>{row.label}</b>
        <small>{row.name}</small>
      </span>

      <span
        className="sts-row__base"
        title={`Base da classe: ${formatStat(row, row.base)}`}
      >
        {formatStat(row, row.base)}
      </span>

      {/*
        A celula de bonus fica VAZIA quando o bonus e zero, e nao com
        "0" ou "+0". Um "+0" em vinte e cinco linhas e ruido: o que o
        jogador procura na coluna e o que mudou, e um zero nao mudou
      */}
      <span
        className={[
          "sts-row__bonus",
          bonus ? "is-plus" : row.bonus < 0 ? "is-minus" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {bonus || "—"}
      </span>

      <span className="sts-row__total">
        {formatStat(row, row.total)}
      </span>
    </li>
  );
}

/**
 * Um bloco de stats: o titulo do grupo e as linhas dele.
 *
 * O grupo e a unidade de leitura, e o cabecalho de coluna (`Base`,
 * `Bonus`, `Total`) fica uma vez so no painel inteiro. Repetir os
 * rotulos em cada bloco faria a coluna ficar mais larga do que o
 * conteudo e o jogador teria que procurar a mesma palavra quatro
 * vezes
 */
function StatGroup({ group }) {
  return (
    <section className="sts-group">
      <h3 className="sts-group__title">
        {group.label}
      </h3>

      <ul className="sts-list">
        {group.rows.map((row) => (
          <StatRow key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Um estado provisorio, para quando a folha ainda nao chegou.
 *
 * A folha e montada pelo servidor, e no primeiro quadro de uma conexao
 * ela pode nao estar no pacote ainda. Sem este caminho o painel
 * apareceria com a moldura e nada dentro, que e o pior dos dois
 * mundos: o jogador ve que algo quebrou quando so faltou um pacote
 */
function semFolha() {
  return {
    level: 1,
    groups: [],
    rows: [],
    byId: {},
    attributes: {},
  };
}

export default function StatsPanel({
  stats,
  className,
  level,
  onClose,
}) {
  const folha = stats ?? semFolha();

  const grupos =
    folha.groups?.length > 0
      ? folha.groups
      : groupPorPadrao(folha.rows ?? []);

  return (
    <section className="inv-panel sts-panel">
      <header className="inv-close-row">
        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (S)"
          aria-label="Fechar o painel de status"
        >
          ✕
        </button>

        <h2>Status</h2>

        {className && (
          <span className="sts-panel__class">
            {className}
          </span>
        )}

        <span className="sts-panel__level">
          Nv.{level ?? folha.level ?? 1}
        </span>
      </header>

      {grupos.length === 0 ? (
        <p className="inv-panel__empty">
          Carregando os status…
        </p>
      ) : (
        <div className="sts-panel__body">
          <div
            className="sts-head"
            aria-hidden="true"
          >
            <span>Stat</span>
            <span>Base</span>
            <span>Bonus</span>
            <span>Total</span>
          </div>

          {grupos.map((group) => (
            <StatGroup key={group.id} group={group} />
          ))}

          <p className="sts-foot">
            Base é a classe nua no nível 1. Bonus é tudo que veio de
            nível, equipamento e caçadas.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * O mesmo agrupamento, refeito a partir das linhas.
 *
 * So e usado quando o servidor mandou `rows` sem `groups`, o que
 * acontece com um snapshot velho de outra versao. Sem isto, o painel
 * mostraria uma lista corrida sem titulo, e o jogador perderia a
 * leitura de "e agora os meus numeros de combate"
 */
function groupPorPadrao(rows) {
  const ordem = [
    { id: "atributos", label: "Atributos" },
    { id: "combate", label: "Combate" },
    { id: "recursos", label: "Recursos" },
    { id: "progresso", label: "Progresso" },
  ];

  const porId = new Map(
    ordem.map((group) => [group.id, { ...group, rows: [] }]),
  );

  for (const row of rows) {
    const def = STAT_DEFS.find(
      (entry) => entry.id === row.id,
    );

    const bucket = porId.get(def?.group ?? "combate");

    if (bucket) bucket.rows.push(row);
  }

  return [...porId.values()].filter(
    (group) => group.rows.length > 0,
  );
}