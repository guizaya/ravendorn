import { useArrastarScroll } from "../../game/ui/arrastarScroll.js";
import RankingRow from "./RankingRow.jsx";
import { formatarNumero } from "../../game/ranking/rankView.js";

/**
 * O CABEÇALHO E A LISTA, no mesmo bloco.
 *
 * ## POR QUE A LISTA COMEÇA NO 4º E NÃO NO 1º
 *
 * Porque os três primeiros já estão no pódio, e a lista é o que o jogador
 * ROLA. Ver o 1º lugar duas vezes — grande no pódio e pequeno na lista —
 * faria os três primeiros ocuparem metade da rolagem sem acrescentar nada:
 * o pódio é a apresentação, a lista é o resto
 *
 * ## POR QUE O `useArrastarScroll` E NÃO UM `onWheel`
 *
 * Porque é o mesmo hook que a coleção e o passe usam, e ele já resolve o
 * que uma lista rolável precisa: trocar de eixo conforme o container,
 * `pointer` em vez de `mouse` (para o arrasto funcionar também no toque) e o
 * limiar que separa um clique de um arrasto. Escrever isso aqui seria a
 * quarta cópia no projeto
 *
 * ## POR QUE A BARRA É INVISÍVEL
 *
 * Porque o painel já tem borda em dois lugares — a do painel e a do card — e
 * uma barra dentro da lista seria a terceira moldura empilhada. A rolagem
 * continua funcionando; só não há uma peça visual dentro de outra
 *
 * ## POR QUE A CLASSE `is-dragging` NÃO ESTÁ NO `className`
 *
 * Porque é o próprio hook que liga e desliga nela, e os outros três painéis
 * que rolam (`passe`, `coleção` e `guilda`) confiam nisso também. Escrever a
 * classe aqui seria a mesma peça em dois lugares — e o `className` do React
 * passaria por cima da classe que o hook pôs, brigando com o gesto em vez de
 *cedence-lo
 */
export default function RankingList({
  jogadores = [],
  total = 0,
  temNoPodio = false,
  criterio,
  euSouEu = false,
  busca = "",
  onBusca = null,
  carregando = false,
  erro = null,
  aoTentarNovamente = null,
}) {
  const rolagem = useArrastarScroll({ eixo: "y" });

  /**
   * A LISTA NÃO FILTRA DE NOVO.
   *
   * O filtro por classe e por busca já aconteceu no `RankingPanel`, e é de lá
   * que o pódio e a barra da posição também lêem. Filtrar aqui de novo seria
   * a MESMA comparação duas vezes por linha, e o dia em que uma das duas
   * versões mudasse, a lista e o pódio passariam a discordar — que é
   * exatamente o defeito que o filtro no painel existe para impedir
   */

/**
 * O TOTAL E O QUE O FILTRO ENCONTROU.
 *
 * ## POR QUE NAO E `Math.max(total, jogadores.length)`
 *
 * Porque `total` ja e o total FILTRADO, e os dois juntos davam o maior
 * numero em vez do certo: com oito guerreiros no recorte e um na lista, o
 * `Math.max` escrevia oito acima de uma lista de uma linha
 *
 * O piso continua sendo `jogadores.length`, porque e o unico numero que a
 * lista consegue provar: se o `total` vier menor que as linhas desenhadas,
 * alguma coisa errou na contagem e a lista esta na tela
 */
const totalMostrado = Math.max(total, jogadores.length);

  return (
    <div className="rnk-lista-bloco">
      <header className="rnk-lista-cabecalho">
        <h3 className="rnk-lista-titulo">
          Top 200
          <span className="rnk-lista-total">
            {" · "}
            {formatarNumero(totalMostrado)} jogadores
          </span>
        </h3>

        {/*
          A BUSCA. O `⌕` é o mesmo glifo que o inventário usa
          (`inv-search__icon`), e não um SVG: o projeto não tem SVG de lupa
          e inventar um aqui seria um ícone que existe em um lugar só
        */}
        {onBusca && (
          <div className="rnk-busca">
            <span className="rnk-busca__icone" aria-hidden="true">
              ⌕
            </span>

            <input
              type="text"
              className="rnk-busca__input"
              placeholder="Buscar caçador"
              value={busca}
              onChange={(event) => onBusca(event.target.value)}
            />

            {busca && (
              <button
                type="button"
                className="rnk-busca__limpar"
                onClick={() => onBusca("")}
                data-tip="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </header>

      {carregando ? (
        <ul className="rnk-lista" aria-hidden="true">
          {Array.from({ length: 8 }, (_, indice) => (
            <li key={indice} className="rnk-row is-skeleton" />
          ))}
        </ul>
      ) : erro ? (
        <div className="rnk-vazio">
          <p className="rnk-vazio__texto">{erro}</p>

          {aoTentarNovamente && (
            <button
              type="button"
              className="rnk-vazio__botao"
              onClick={aoTentarNovamente}
            >
              Tentar novamente
            </button>
          )}
        </div>
      ) : jogadores.length === 0 ? (
        <p className="rnk-vazio__texto">
          {/*
            A LISTA VAZIA TEM DUAS CAUSAS, E ELAS NÃO SE PARECEM.

            ## COM JOGADORES NO PÓDIO

            Sao tres ou menos no recorte, e os tres — ou os dois, ou o um —
            estao ACIMA, no pódio. Escrever "Nenhum caçador encontrado" aqui
            foi a pior versao do texto: o jogador filtra por Guerreiro, ve
            os personagens na tela e le que o filtro nao funcionou

            E a frase aponta para ONDE eles estao, que e a unica acao util
            numa tela sem lista
          */}
          {temNoPodio
            ? "Estes são os primeiros do recorte — a lista começa no 4º lugar."
            : "Nenhum caçador encontrado"}
        </p>
      ) : (
        <ul
          className="rnk-lista"
          role="list"
          ref={rolagem.ref}
          {...rolagem.evento}
        >
          {jogadores.map((jogador) => (
            <RankingRow
              key={jogador.id ?? jogador.name}
              jogador={jogador}
              criterio={criterio}
              euSouEu={euSouEu}
            />
          ))}
        </ul>
      )}
    </div>
  );
}