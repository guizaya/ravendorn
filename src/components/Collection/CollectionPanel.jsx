import { useMemo } from "react";
import CollectionCard from "./CollectionCard.jsx";
import StatsPanel from "../Stats/StatsPanel.jsx";
import { useArrastarScroll } from "../../game/ui/arrastarScroll.js";
import PermanentBonus from "../UI/PermanentBonus.jsx";

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
  filtroItemId = null,
}) {
  /**
   * A LISTA ROLA COM A RODA E COM O ARRASTO.
   *
   * E o mesmo hook que a guilda e o passe usam, e nao um `onWheel` escrito
   * aqui: o `useArrastarScroll` ja sabe as tres coisas que uma lista com
   * rolagem precisa — trocar de eixo conforme o container, precisao do
   * `pointer` para o arrasto, e o limiar que separa um clique de um
   * arrasto. Escrever isso de novo aqui seria a terceira versao
   *
   * ## POR QUE A ROLAGEM PRECISA DO ARRASTO
   *
   * Porque a lista mostra TRES cards e existem cinco. Com a barra de 8px
   * embaixo, o jogador teria que acertar um alvo que some quando o cursor
   * sai, e a roda do mouse nao funciona em todo container com
   * `overflow: hidden` — que e o caso deste painel
   */
  const lista = useArrastarScroll({ eixo: "y" });
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

  /**
   * A LISTA COM O QUE DA PARA ENTREGAR EM CIMA.
   *
   * ## POR QUE ORDENAR AQUI E NAO NO `Collection.snapshot`
   *
   * O mesmo motivo do bestiario: a ordem e uma decisao de LEITURA da
   * tela. O `snapshot` diz o que cada entrega tem; quem decide o que o
   * jogador ve primeiro e o painel. Ordenar la faria o estado do jogo
   * depender de um criterio visual
   *
   * ## POR QUE SO `done`
   *
   * Porque o que desce e o ENTREGUE. Uma entrega que ainda falta um item
   * continua valendo o lugar dela em cima — e quando o jogador cai para
   * o que falta, e para essa parte da lista que ele olha
   *
   * E o `[...entries]` e obrigatorio: o `data.entries` pode ser o mesmo
   * array que o servidor mandou, e ordenar no lugar mexeria no dado de
   * quem recebeu. O `snapshot` chega a cada quadro
   *
   * ## POR QUE SO `done`, SEM `pronta` no meio
   *
   * Porque "pronta" muda a cada item que o jogador pega e larga, e a
   * lista inteira saltaria de lugar enquanto ele caminha pelo mapa. A
   * ordem so pode depender de uma coisa que nao muda sozinha
   */
const entries = [...data.entries].sort(
      (a, b) => Number(a.done) - Number(b.done),
    );

    /**
     * O FILTRO QUE CHEGA DO MENU DO ITEM.
     *
     * E um `itemId`, nao um indice: quem abre a colecao pelo atalho quer ver
     * as entregas que PEDEM aquele item, e nao a entrada de um numero fixo.
     * A lista de requisitos e o lugar da verdade, e o filtro le exatamente a
     * mesma coisa que o `entrega()` escreveu
     *
     * O `enhance` e ignorado de proposito. Um arco `+3` satisfaz o mesmo par
     * item/requisito que um `+0`, e o atalho nao pode desaparecer no jogo
     * avancado, que e onde ele serve mais
     *
     * Sem filtro — que e o caso normal, quando o jogador abriu a colecao pelo
     * botao da HUD — nada muda e o filtro nao custa nem um segundo array
     */
    const filtroItem = filtroItemId ?? null;

    const visiveis = useMemo(() => {
      if (!filtroItem) return entries;

      return entries.filter((entry) =>
        (entry.requirements ?? []).some(
          (requirement) => requirement?.itemId === filtroItem,
        ),
      );
    }, [entries, filtroItem]);

  return (
    <section className="col-panel">
      <header className="col-panel__head">
        <h2>Colecao</h2>

        <span className="col-panel__tally">
          {data.completed}/{data.total} entregues
        </span>

        {/*
          O X NO FIM, como no bestiario e nas missoes.

          Os tres cabecalhos tinham o botao como PRIMEIRO filho, e o
          `margin-left: auto` que o joga para a direita so vale para o
          ultimo da linha. O X abria a esquerda do titulo, ao contrario
          de todos os outros paineis
        */}
        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          data-tip="Fechar (K)"
        >
          ✕
        </button>
      </header>

      <div className="col-panel__body">
        {/*
          O BONUS PERMANENTE, numa COLUNA AO LADO dos cartoes.

          ## POR QUE SAIU DE CIMA

          Porque em cima ele empurrava a lista para baixo e o jogador tinha
          de rolar ate os cartoes para ver o que ia ganhar. Ao lado, o
          bonus fica visivel enquanto ele le os cartoes, e o olho vai do
          "o que eu ganho com ESTA entrega" para o "quanto eu ja ganhei"
          sem voltar

          E a unica coisa do painel que responde "quanto a colecao ja me
          deu": cada cartao mostra o que AQUELA entrega daria, e a soma so
          existe aqui
        */}
        <section className="col-panel__coluna">
          <div className="perm-bonus-box">
            <span className="eyebrow">Bônus permanente</span>

{/* `layout="lista"`: aqui o bonus e o TOTAL, e o que o jogador
              compara com o que ja tem no personagem. Lista deixa os
              valores na mesma coluna; chip solto nao

              `todos`: mostra os 26 stats da ficha, e nao so os que o
              jogador ja tem. A lista completa e o que diz o que ainda da
              para buscar — com so os que ele tem, ele veria duas linhas e
              nao saberia se era tudo */}
          <PermanentBonus
            bonuses={data.bonuses}
            layout="lista"
            todos
            empty="Nenhuma entrega concluída ainda. Junte material para desbloquear bônus permanentes."
          />
          </div>

{visiveis.length === 0 ? (
            <p className="col-empty">
              {filtroItem
                ? "Nenhuma entrega pede este item."
                : "Nenhuma colecao disponivel."}
            </p>
          ) : (
            /* a lista rola: o `ref` e os eventos `pointer` vem do hook, e ele
               mesmo aplica a classe `is-dragging` durante o gesto */
            <ul
              className="col-list"
              ref={lista.ref}
              {...lista.evento}
            >
              {visiveis.map((entry) => (
              <CollectionCard
                key={entry.id}
                entry={entry}
                onDeliver={onDeliver}
              />
            ))}
          </ul>
        )}
        </section>

        {data.isComplete && (
          <p className="col-complete">
            Colecao completa. Todas as entregas foram feitas.
          </p>
        )}
      </div>
    </section>
  );
}


