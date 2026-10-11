import { CHARACTER_CLASSES } from "../../data/characters/index.js";

/**
 * O FILTRO DE CLASSE do ranking.
 *
 * ## POR QUE "GERAL" VEM PRIMEIRO E SEM ÍCONE
 *
 * Porque é o estado que mostra mais gente, e ele é o padrão: um jogador que
 * abriu o rank quer ver a tabela inteira antes de decidir se quer um recorte.
 * Sem ícone nenhum, porque "geral" não é uma classe — e um chip com emoji de
 * Warrior diria que o filtro padrão é de Warrior
 *
 * ## POR QUE O NOME VEM DA DEFINIÇÃO E NÃO DO FILTRO
 *
 * Porque `CHARACTER_CLASSES` é a fonte da verdade das classes: tem o nome
 * de exibição (`Arbalist`, `Warrior`) e o ícone. Escrever a lista aqui seria
 * uma segunda cópia que divergiria no dia em que uma classe fosse
 * renomeada — e o projeto já tem `CHARACTER_CLASSES` justamente para ser a
 * fonte única
 */
export default function ClassFilter({ ativa, onTrocar }) {
  return (
    <div
      className="rnk-filtros"
      role="group"
      aria-label="Filtrar por classe"
    >
      {/*
        O "Geral". `aria-pressed` e o que diz ao leitor de tela que este
        filtro esta ligado agora — e `true`/`false`, nao "selecionado",
        porque um filtro não troca de aba: ele refina a que esta aberta
      */}
      <button
        type="button"
        aria-pressed={ativa === null}
        className={[
          "rnk-chip",
          ativa === null ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onTrocar(null)}
      >
        Geral
      </button>

      {CHARACTER_CLASSES.map((classe) => (
        <button
          key={classe.id}
          type="button"
          aria-pressed={ativa === classe.id}
          className={[
            "rnk-chip",
            ativa === classe.id ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onTrocar(classe.id)}
          style={{ "--classe": classe.accent }}
        >
          {/*
            O `icon` da classe e o emoji do catalogo, e ele vai dentro de um
            `aria-hidden` porque o nome da classe ja esta escrito do lado: um
            leitor de tela anunciaria "Arbalist" duas vezes
          */}
          <span className="rnk-chip__icone" aria-hidden="true">
            {classe.icon}
          </span>

          {classe.name}
        </button>
      ))}
    </div>
  );
}