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
      {/*
        O NOME NA FRENTE, E A SIGLA DEPOIS, EM OUTRA COR.

        ## POR QUE ISSO, E NAO A SIGLA SOZINHA

        Porque "Força" e o que o jogador procura e "STR" e a sigla de quem ja
        conhece o jogo. Com a sigla na frente, o olho parava nela e traduzia
        sozinho — trabalho que o painel existe para fazer

        E as duas na MESMA linha, e nao empilhadas: empilhadas, viravam dois
        dados, e a coluna do rotulo crescia ate o nome do stat ser cortado.
        Aqui a sigla e legenda do nome, e fica menor e apagada

        O `title` continua com o nome inteiro porque a sigla de um stat raro
        nao se decifra sem ajuda
      */}
      <span
        className="sts-row__label"
        data-tip={row.name}
      >
        <span className="sts-row__nome">{row.name}</span>
        <span className="sts-row__sigla">{row.label}</span>
      </span>

      <span
        className="sts-row__base"
        data-tip={`Base da classe: ${formatStat(row, row.base)}`}
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
        <h2>Status</h2>

        {className && (
          <span className="sts-panel__class">
            {className}
          </span>
        )}

        <span className="sts-panel__level">
          Nv.{level ?? folha.level ?? 1}
        </span>

        {/*
          O X NO FIM DO CABEÇALHO.

          Era o primeiro filho, entao abria na esquerda do "Status" — o
          unico painel em que o botao de fechar nao ficava do lado do
          titulo. Agora ele e o ultimo, e o `margin-left: auto` faz o
          que faz nos outros
        */}
        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar (S)"
          aria-label="Fechar o painel de status"
        >
          ✕
        </button>
      </header>

      {grupos.length === 0 ? (
        <p className="inv-panel__empty">
          Carregando os status…
        </p>
      ) : (
        <div className="sts-panel__body">
          {/*
            O CABECALHO DAS COLUNAS.

            ## POR QUE SO UM, PARA AS QUATRO COLUNAS

            Porque `Base`, `Bonus` e `Total` significam a mesma coisa em todos
            os grupos. Repetir o cabecalho em cada um faria a coluna ficar mais
            larga do que o conteudo, e o jogador teria que procurar a mesma
            palavra quatro vezes
          */}
          <div
            className="sts-head"
            aria-hidden="true"
          >
            <span>Stat</span>
            <span>Base</span>
            <span>Bonus</span>
            <span>Total</span>
          </div>

          {/*
            OS QUATRO GRUPOS, E OS ATRIBUTOS NO MESMO PADRAO DELES.

            Houve uma ficha de cinco tiles no topo do painel, com os atributos
            destacados. Saiu: ela ocupava uma tela inteira para mostrar cinco
            numeros que a tabela embaixo ja mostrava — e o jogador que abriu o
            painel para ler "quanto eu tenho de ataque" tinha que passar por
            eles antes

            O atributo volta a ser LINHA, como todo o resto, e continua
            marcado pela faixa dourada da `is-attribute`: ele e o que o resto
            deriva, e essa distincao vale — so a forma de caixa nao valia
          */}
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