import { CHARACTER_CLASSES } from "../../data/characters/index.js";

/**
 * OS CHIPS DE CLASSE.
 *
 * ## POR QUE SAO QUATRO E EM INGLES
 *
 * Porque `CHARACTER_CLASSES` tem quatro — `warrior`, `lancer`, `sorcerer`,
 * `arbalist` — e os nomes de exibição sao Warrior, Lancer, Sorcerer e
 * Arbalist. O briefing sugere Guerreiro, Assassino, Mago, Arqueiro e
 * Sacerdote, e ele mesmo diz para usar os nomes que o projeto define. Sao
 * cinco nomes para quatro classes: "Assassino" e "Sacerdote" nao existem aqui
 *
 * ## POR QUE O RÓTULO "CLASSE" SAIU
 *
 * Porque o nome do filtro nao diz o que o filtro FAZ, e nesta tela ele nao
 * precisa: a lista e de classes com icone, e o primeiro chip e "Todas". O
 * jogador le "Todas · Warrior · Lancer" e sabe em um segundo que e classe. O
 * rotulo era 50px de larguraoccupied que empurravam a linha para a direita sem
 * acrescentar nada
 *
 * ## POR QUE O BOTAO DE LIMPAR VIVE AQUI
 *
 * Porque ele e irmao dos chips: limpar os filtros e a mesma acao que trocar a
 * classe, entao ele fica na mesma linha, no fim. No estado vazio ele aparecia
 * SO quando a busca nao devolvia nada — e o jogador com um filtro ativo que
 * ainda tinha resultado nao tinha como limpar sem trocar cada chip na mao
 */
export default function ClassFilterChips({
  ativa,
  onTrocar,
  contagens,
  limpar = null,
}) {
  return (
    <div className="mkt-filtros">
      <button
        type="button"
        className={[
          "mkt-chip-classe",
          ativa === null ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={ativa === null}
        onClick={() => onTrocar(null)}
      >
        Todas
      </button>

      {CHARACTER_CLASSES.map((classe) => {
        const ativaAqui = ativa === classe.id;

        return (
          <button
            key={classe.id}
            type="button"
            className={[
              "mkt-chip-classe",
              ativaAqui ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={ativaAqui}
            style={{ "--classe": classe.accent }}
            onClick={() => onTrocar(ativaAqui ? null : classe.id)}
          >
            {/*
              O `aria-hidden` porque o nome da classe ja esta escrito do lado:
              um leitor de tela anunciaria "Arbalist, Arbalist" sem ele
            */}
            <span className="mkt-chip-classe__icone" aria-hidden="true">
              {classe.icon}
            </span>

            {classe.name}

            {contagens?.[classe.id] !== undefined && (
              <span className="mkt-chip-classe__conta">
                {contagens[classe.id]}
              </span>
            )}
          </button>
        );
      })}

      {/*
        O LIMPAR, no fim da linha e do lado do ultimo chip.

        E por isso que ele e um `chip` e nao o botao grande que era antes: o
        botao grande pedia uma acaoisolada, e aqui ele e um passo a mais na
        mesma fita de opcoes. O `type="button"` dentro de um container sem
        `<form>` nao submete nada
      */}
      {limpar && (
        <button
          type="button"
          className="mkt-chip mkt-chip--limpar"
          onClick={limpar}
          data-tip="Limpar busca, categoria e classe"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}