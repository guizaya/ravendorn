import { useState } from "react";
import { RANK_CRITERIO } from "../../game/ranking/rank.js";

/**
 * O rank de quem esta conectado.
 *
 * Duas abas porque "quem esta na frente" tem duas respostas
 * diferentes, e cada uma e a certa para uma pergunta: nivel mede
 * o personagem, bestiario mede quem foi caçar. Um jogador de nivel
 * 30 com duas cacadas fechadas fica em 2o no nivel e em ultimo no
 * bestiario, e as duas informacoes sao verdade.
 *
 * A lista chega ORDENADA do servidor (ver `src/game/ranking`). Este
 * componente nao reordena nada: se ele ordenasse, um cliente
 * modificado mostraria a posicao que quisesse, e o rank deixaria de
 * ser uma informacao do servidor.
 *
 * A casacao visual e com o INVENTARIO, nao com o bestiario: mesmo
 * painel, mesmas abas e mesmo rodape de status. Sao tres janelas
 * sobre o mesmo mundo, e o jogador nao deveria notar qual delas ele
 * abriu. As cores, a borda dupla e o gradiente vem de la; aqui so
 * ha `rnk-` no lugar de `inv-`.
 */
const ABAS = [
  { id: RANK_CRITERIO.NIVEL, icone: "★", label: "Nivel" },
  { id: RANK_CRITERIO.BESTIARIO, icone: "☠", label: "Bestiario" },
];

/**
 * A linha de um jogador: medalha, posicao, nome e o numero do
 * criterio da aba.
 *
 * O criterio do rodape ("12 cacadas", "380 xp") muda com a aba, e o
 * numero do criterio esta no `title`: ele diz o que o numero e sem
 * precisar repetir o rotulo em cada linha.
 */
function RankRow({ jogador, criterio, ehVoce }) {
  const numero =
    criterio === RANK_CRITERIO.BESTIARIO
      ? `${jogador.cacadas} cacada${jogador.cacadas === 1 ? "" : "s"}`
      : `${jogador.xp} xp no nivel ${jogador.nivel}`;

  return (
    <li
      className={[
        "rnk-row",
        ehVoce ? "is-you" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className="rnk-row__medal"
        title={`${jogador.posicao}o lugar`}
      >
        {jogador.medalha}
      </span>

      <strong className="rnk-row__name">
        {jogador.name}

        {ehVoce && <small className="rnk-row__you">voce</small>}
      </strong>

      <span className="rnk-row__lvl" title="Nivel">
        Nv.{jogador.nivel}
      </span>

      <span
        className="rnk-row__value"
        title={numero}
      >
        {criterio === RANK_CRITERIO.BESTIARIO
          ? jogador.cacadas
          : jogador.xp}
      </span>
    </li>
  );
}

export default function RankPanel({
  rank,
  meuId,
  onClose,
}) {
  // o nivel e a aba que se abre primeiro: e o numero que o jogador
  // ja ve no proprio HUD
  const [criterio, setCriterio] = useState(RANK_CRITERIO.NIVEL);

  const lista = rank?.[criterio] ?? [];
  const lider = lista[0];

  const eu = lista.find((jogador) => jogador.id === meuId);

  return (
    <section className="rnk-panel">
      <nav className="rnk-tabs">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            type="button"
            role="tab"
            aria-selected={criterio === aba.id}
            className={[
              "rnk-tab",
              criterio === aba.id ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setCriterio(aba.id)}
            title={aba.label}
          >
            <span className="rnk-tab__icon">
              {aba.icone}
            </span>

            <small>{aba.label}</small>

            {lista.length > 0 && (
              <i className="rnk-tab__count">
                {lista.length}
              </i>
            )}
          </button>
        ))}

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (R)"
        >
          ✕
        </button>
      </nav>

      <div className="rnk-panel__body">
        <div className="rnk-main">
          {lista.length === 0 ? (
            <p className="inv-panel__empty">
              Nenhum jogador conectado
            </p>
          ) : (
            <ul className="rnk-list">
              {lista.map((jogador) => (
                <RankRow
                  key={jogador.id}
                  jogador={jogador}
                  criterio={criterio}
                  ehVoce={jogador.id === meuId}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <footer className="rnk-status">
        <span className="rnk-status__cap">
          <i>♛</i>
          {lista.length} conectado{lista.length === 1 ? "" : "s"}
        </span>

        {lider && (
          <span
            className="rnk-status__lead"
            title="Quem esta na frente nesta ordem"
          >
            {lider.medalha} {lider.name}
          </span>
        )}

        {eu && (
          <span className="rnk-status__me">
            {eu.posicao}/{lista.length}
          </span>
        )}
      </footer>
    </section>
  );
}
