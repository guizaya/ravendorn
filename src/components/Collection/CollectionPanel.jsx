import ItemIcon from "../UI/ItemIcon.jsx";
import StatsPanel from "../Stats/StatsPanel.jsx";
import PermanentBonus from "../UI/PermanentBonus.jsx";
import { RARITY_STYLE, getItem } from "../../data/items/index.js";
import { statBonusEntries } from "../../game/stats/StatSheet.js";

/**
 * O painel de COLECAO.
 *
 * A colecao e uma missao de entrega: o jogador junta material e
 * equipamento e aperta o botao para entregar. A diferenca para o
 * `QuestPanel` e que aqui nada acontece sozinho — nao ha evento de
 * jogo que feche uma entrega, so a mao do jogador
 *
 * O que o painel mostra, em ordem de importancia para quem decide o
 * que fazer:
 *
 * - o que FALTA, com a contagem, e nao um "pronta: nao". "Faltam 2 de
 *   Gelo de Limo" e o que o jogador usa; "faltam 5 coisas" obriga ele a
 *   contar de cabeca
 * - a recompensa, antes da entrega, e nao depois. Entregar sem saber
 *   o que da e entregar no escuro
 * - a entrega e uma vez so, entao a colecao pronta continua na lista
 *   marcada como feita em vez de sumir: sumindo, o jogador nao
 *   saberia se ja entregou
 */
/**
 * O painel de STATUS, que e o painel de STATS.
 *
 * A casca e a mesma dos outros paineis — `.inv-panel`, e nao uma
 * nova. O `.inv-panel` ja tem a moldura, o `z-index` e o `transform`
 * de centralizacao testados pelo `styles.test.js`, e uma classe nova
 * repetiria essa casca sem ganhar nada
 *
 * O conteudo mora no `StatsPanel`, e nao aqui: a folha de stats tem
 * regras suficientes para ter o proprio teste, e um componente de
 * painel que cresce de vinte e cinco linhas para dentro de um arquivo
 * de colecao seria um lugar imposible de achar
 */
export function StatusPanel({
  stats = null,
  className = null,
  level = null,
  onClose,
}) {
  return (
    <StatsPanel
      stats={stats}
      className={className}
      level={level}
      onClose={onClose}
    />
  );
}

/**
 * O painel de TESTE.
 *
 * Igual ao de status: vazio, so com o botao de fechar, e a mesma
 * casca `.inv-panel`.
 *
 * A duplicacao com o `StatusPanel` e deliberada. Os dois tem um X e um
 * titulo, e o que vao mostrar ainda nao esta decidido: um componente
 * com `{ titulo, onClose }` resolveria os dois hoje e custaria um
 * parametro a mais no meio do caminho quando os doisContents diferentes
 * precisarem existir de verdade
 */
export default function CollectionPanel({
  collection,
  onDeliver,
  onClose,
}) {
  /**
   * O painel precisa funcionar antes do primeiro snapshot.
   *
   * O `snapshot` chega por um evento de rede, e ha um instante — o
   * primeiro quadro, ou um motor que ainda nao mandou nada — em que
   * ele e `null`. Um painel que dereferencia `collection.entries`
   * nesse instante derruba a tela inteira do jogador
   */
  const data = collection ?? {
    entries: [],
    completed: 0,
    total: 0,
    isComplete: false,
    bonuses: {},
  };

  return (
    <section className="col-panel">
      <header className="col-panel__head">
        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (K)"
        >
          ✕
        </button>

        <h2>Colecao</h2>

        <span className="col-panel__tally">
          {data.completed}/{data.total} entregues
        </span>
      </header>

      <div className="col-panel__body">
        {/*
          O BONUS PERMANENTE, no mesmo lugar e com a mesma forma do
          bestiario.

          A cacada e a colecao dao a mesma coisa — stat que fica no
          personagem — e o jogador que entende uma le a outra sem
          traduzir. E esta e a unica linha do painel que responde
          "quanto a colecao ja me deu": cada cartao mostra o que AQUELA
          entrega daria, e a soma so existe aqui

          O aviso de "recompensa esperando espaco na mochila" vivia
          neste espaco e foi embora com a recompensa em item: um bonus
          de stat nao ocupa lugar nenhum, entao nao ha o que esperar
        */}
        <section className="perm-bonus-box">
          <span className="eyebrow">Bônus permanente</span>

          <PermanentBonus
            bonuses={data.bonuses}
            empty="Nenhuma entrega concluída ainda. Junte material para desbloquear bônus permanentes."
          />
        </section>

        {data.entries.length === 0 ? (
          <p className="col-empty">Nenhuma colecao disponivel.</p>
        ) : (
          <ul className="col-list">
            {data.entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onDeliver={onDeliver}
              />
            ))}
          </ul>
        )}

        {data.isComplete && (
          <p className="col-complete">
            Colecao completa. Todas as entregas foram feitas.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Uma colecao, com os requisitos e o botao.
 *
 * A separacao existe pelo mesmo motivo do `EntryCard` do bestiario:
 * o componente principal fica com a forma do painel e este fica com a
 * forma de uma linha, que muda mais
 */
function EntryCard({ entry, onDeliver }) {
  return (
    <li
      className={[
        "col-entry",
        entry.done ? "is-done" : "",
        entry.pronta ? "is-ready" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="col-entry__head">
        <span className="col-entry__icon">{entry.icon}</span>

        <span className="col-entry__names">
          <strong>{entry.name}</strong>
          <small>{entry.summary}</small>
        </span>

        {entry.done ? (
          <span className="col-entry__done">
            ✓ Entregue
          </span>
        ) : (
          <button
            type="button"
            className="col-entry__give"
            onClick={() => onDeliver?.(entry.id)}
            disabled={!entry.pronta}
            title={
              entry.pronta
                ? `Entregar ${entry.name}`
                : "Faltam materiais"
            }
          >
            Entregar
          </button>
        )}
      </header>

      <ul className="col-needs">
        {entry.needs.map((need, index) => (
          <NeedRow
            key={`${need.itemId ?? need.rarity}-${index}`}
            need={need}
            entryPronta={entry.pronta}
          />
        ))}
      </ul>

      <RewardLine reward={entry.rewards} />
    </li>
  );
}

/**
 * Uma linha de requisito.
 *
 * A mesma linha serve para a colecao pronta e para a entregue, porque
 * o `snapshot` devolve `needs` normalizado nos dois casos. Sem isso a
 * linha mudaria de forma — e de posicao na tela — no instante da
 * entrega, que e quando o jogador esta olhando
 */
function NeedRow({ need, entryPronta }) {
  const completo = need.falta === 0;

  const conta = `${need.have}/${need.need}`;

  const cor =
    need.rarity !== null && need.rarity !== undefined
      ? RARITY_STYLE[need.rarity]?.color
      : undefined;

  return (
    <li
      className={[
        "col-need",
        completo ? "is-ok" : "is-missing",
      ]
        .join(" ")}
      style={cor ? { "--need": cor } : undefined}
    >
      {/*
        Requisito de MATERIAL mostra o icone do item.

        Requisito de EQUIPAMENTO nao tem item nenhum — e "1 peca rara",
        nao "1 arco raro" — entao nao ha glifo para desenhar. Um
        `<ItemIcon>` vazio deixava um quadradinho em branco na linha,
        e o requisito de equipamento ficava parecendo um elemento
        quebrado no meio do painel. No lugar dele entra um losango na
        cor da raridade, que e a mesma cor que a borda da linha ja
        usa
      */}
      {need.itemId ? (
        <ItemIcon
          item={getItem(need.itemId)}
          itemId={need.itemId}
          rarity={need.rarity}
          className="col-need__icon"
          alt=""
        />
      ) : (
        <span
          className="col-need__icon col-need__icon--rarity"
          aria-hidden="true"
        >
          ◈
        </span>
      )}

      <span className="col-need__label">{need.label}</span>

      <span className="col-need__count">
        {completo ? conta : `faltam ${need.falta} (${conta})`}
      </span>

      {/*
        O texto de "completo" e "faltando" mora num elemento escondido
        em vez de num `aria-label` na linha inteira: um `aria-label` no
        `<li>` esconderia o `col-need__label` e o `col-need__count`
        do leitor de tela, que sao justamente a informacao
      */}
      <span className="col-need__state">
        {completo ? "completo" : "faltando"}
        {entryPronta ? "" : " para esta entrega"}
      </span>
    </li>
  );
}

/**
 * A recompensa de uma colecao: SO STATS.
 *
 * Cada stat e um selo com o rotulo do jogo e o valor com o sinal, e o
 * texto vem do `StatSheet` — o mesmo formatador que o painel de status
 * e o aviso de entrega usam. Escrever "+40" aqui e "40 HP" la faria o
 * jogador aprender duas notacoes para o mesmo numero
 *
 * Fica visivel mesmo na colecao ja entregue: o jogador precisa ver o
 * que ganhou, e a linha de "✓ Entregue" sozinha nao diz o que foi
 */
function RewardLine({ reward }) {
  const entradas = statBonusEntries(reward);

  if (entradas.length === 0) return null;

  return (
    <div className="col-reward">
      <span className="col-reward__label">
        Bônus de status
      </span>

      <span className="col-reward__chips">
        {entradas.map((entrada) => (
          <span
            key={entrada.id}
            className="col-reward__chip"
            title={entrada.name}
          >
            <b>{entrada.text}</b>
            <i>{entrada.label}</i>
          </span>
        ))}
      </span>
    </div>
  );
}
