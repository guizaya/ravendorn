import PodiumCard from "./PodiumCard.jsx";

/**
 * O PÓDIO: o 2º à esquerda, o 1º no meio, o 3º à direita.
 *
 * ## POR QUE A ORDEM VISUAL É 2, 1, 3
 *
 * Porque é a convenção de pódio que o jogador já viu em tudo: o primeiro
 * fica no centro e mais alto, e os outros se distribuem em volta. Uma ordem
 * 1, 2, 3 da esquerda para a direita seria uma lista, não um pódio
 *
 * ## POR QUE OS SLOTS SÃO UM ARRAY DE POSIÇÃO, E NÃO `[2, 1, 3]`
 *
 * Porque o desenho pede posição, e a posição é o que diz "2º à esquerda".
 * Montar com `[jogadores[1], jogadores[0], jogadores[2]]` seria mais curto,
 * mas quebraria no instante em que houver menos de três jogadores: o
 * `undefined` do meio empurraria a lista e o primeiro lugar apareceria à
 * esquerda
 *
 * Cada slot sabe a posição que representa e só desenha se ela existir.
 * Menos de três jogadores renderiza os que existem, na ordem certa, sem
 * nenhum `if` espalhado pelo JSX
 */
const SLOTS = [
  { posicao: 2 },
  { posicao: 1 },
  { posicao: 3 },
];

/**
 * @param {Array} jogadores a lista JÁ filtrada e JÁ ordenada
 * @param {string} criterio a aba ativa
 * @param {boolean} euSouEu o jogador logado está entre os três primeiros
 * @param {boolean} carregando o painel ainda está esperando dados
 */
export default function Podium({
  jogadores = [],
  criterio,
  euSouEu = false,
  carregando = false,
}) {
  // o desenho pede skeleton no pódio enquanto carrega, e é o que impede a
  // lista de pular de altura quando os dados chegarem
  if (carregando) {
    return (
      <div className="rnk-podio" aria-hidden="true">
        {SLOTS.map(({ posicao }) => (
          <div
            key={posicao}
            className={[
              "rnk-podio-card",
              "is-skeleton",
              posicao === 1 ? "is-primeiro" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="rnk-podio">
      {SLOTS.map(({ posicao }) => {
        const jogador = jogadores[posicao - 1];

        // menos de três: o slot fica vazio e o lugar some, em vez de
        // desenhar um card com "—"
        if (!jogador) return null;

        return (
          <PodiumCard
            key={jogador.id ?? `${jogador.name}-${posicao}`}
            jogador={jogador}
            posicao={posicao}
            criterio={criterio}
            euSouEu={euSouEu}
          />
        );
      })}
    </div>
  );
}