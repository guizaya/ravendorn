import { RANK_ABAS } from "../../game/ranking/rankView.js";

/**
 * AS ABAS DE CRITÉRIO do rank.
 *
 * ## POR QUE DUAS E SO
 *
 * Porque e o que o jogo tem: nível e poder sao as duas leituras legitimas
 * de "quem esta na frente". Uma terceira aba seria um numero que ninguem
 * entende sem legenda — e um painel de ranking com cinco criteria e cinco
 * sub-rankings deixa de ser um ranking
 *
 * ## POR QUE `role="tablist"` E NAO UM CONJUNTO DE BOTOES
 *
 * Porque sao abas de verdade: uma so fica ativa por vez e elas dividem um
 * painel. O leitor de tela anuncia "aba 1 de 2" e o `aria-selected` diz qual
 * esta na frente, o que um conjunto de botoes nao faz
 *
 * ## POR QUE A ATIVA ESTA DENTRO DO `<button>`
 *
 * Porque um `role="tab"` que nao seja focavel quebra a navegacao por
 * teclado — setas e Tab saem do `tablist`. E o `tabIndex` e o que faz
 * exatamente uma aba ficar no caminho do Tab: a do jogador, que e a ativa
 */
export default function RankingTabs({ ativa, onTrocar }) {
  return (
    <div className="rnk-tabs" role="tablist" aria-label="Critério do ranking">
      {RANK_ABAS.map((aba) => {
        const selecionada = aba.id === ativa;

        return (
          <button
            key={aba.id}
            type="button"
            role="tab"
            id={`rnk-tab-${aba.id}`}
            aria-selected={selecionada}
            aria-controls="rnk-painel"
            tabIndex={selecionada ? 0 : -1}
            className={[
              "rnk-tab",
              selecionada ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onTrocar(aba.id)}
          >
            <span className="rnk-tab__titulo">{aba.titulo}</span>

            <span className="rnk-tab__subtitulo">{aba.subtitulo}</span>

            {/*
              A CONTAGEM DA ABA SAIU.

              ## POR QUE O NUMERO MENTIA

              Porque as duas abas trocam de ORDEM, nao de conteudo. Quem
              esta no nivel 20 e no 8 de poder e o mesmo jogador nas duas
              listas, e o total e identico — a contagem era sempre a mesma,
              nos dois chips, embrulhada num numero que parecia comparar
              alguma coisa

              E quando o filtro de classe ou a busca entravam, o numero
              continuava o do ranking inteiro ao lado de uma lista que
              ja nao era a mesma: o chip dizia "87" e a tela embaixo
              mostrava doze guerreiros

              ## O QUE FICOU

              O titulo e o subtitulo. O subtitulo ("os cacadores mais
              avancados", "poder do cacador") ja diz o que a aba mede, e
              e o que o jogador precisa para escolher entre elas
            */}
          </button>
        );
      })}
    </div>
  );
}