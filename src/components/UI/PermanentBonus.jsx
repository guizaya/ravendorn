import { statBonusEntries } from "../../game/stats/StatSheet.js";

/**
 * O BONUS PERMANENTE de um painel.
 *
 * Cacada e colecao dao a mesma coisa: um bonus de stat que fica no
 * personagem para sempre. As duas telas mostravam isso de formas
 * diferentes — a cacada com os rotulos curtos do bestiario (`VID`,
 * `VEL. ATQ`) e um `Object.entries` cru, e a colecao com uma frase
 * solta — e o jogador via `VID` num lugar e `HP` no outro para o
 * mesmo numero
 *
 * Este e o componente UNICO. O texto do selo vem do `StatSheet`,
 * entao o bonus permanente se le igual na cacada, na colecao, no
 * painel de status e no aviso de entrega
 *
 * ## OS DOIS FORMATOS, E POR QUE EXISTEM DOIS
 *
 * `chips` desenha cada bonus como uma caixa solta, e e o formato que
 * cabe numa linha de largura variavel. `lista` desenha uma coluna com
 * o rotulo a esquerda e o valor na direita
 *
 * A lista existe porque `chip` faz o bonus parecer um ITEM que se pega,
 * e nao um atributo que se ganha. E porque dois numeros so podem ser
 * comparados se estiverem na mesma coluna — com caixa em volta de cada
 * um, "HP" e "VIT" nao terminariam alinhados, e o jogador perderia a
 * unica coisa que o total de um painel serve para mostrar
 *
 * Os DOIS leem o `StatSheet`, entao nao ha divergencia de rotulo entre
 * os dois: e o mesmo `label` e o mesmo `text` nos dois formatos
 */
export default function PermanentBonus({
  bonuses,
  empty = "",
  label = null,
  layout = "chips",
  todos = false,
}) {
  const entradas = statBonusEntries(bonuses, { todos });

  if (entradas.length === 0) {
    if (!empty) return null;

    return (
      <p className="perm-bonus__empty">{empty}</p>
    );
  }

if (layout === "lista") {
      /**
       * A LISTA DE LINHAS, E O NOME CHEIO COM A SIGLA AO LADO.
       *
       * ## POR QUE A SIGLA VAI AO LADO E NAO NO LUGAR DO NOME
       *
       * Porque sao 26 stats, e varios nomes nao cabem na largura da box sem
       * cortar: "Chance de Drop de Equipamento" e "Sucesso de Aprimoramento"
       * nao entram. Cortar o nome tiraria justamente o que diz qual stat e
       *
       * ## O `todos` FAZ O VISUAL DIFERIR DELE
       *
       * Com `todos`, a lista traz os 26 stats e os que o jogador nao tem
       * aparecem com um travessao no lugar do numero. O esmaecimento e o
       * que separa o que ele JA TEM do que ainda pode buscar
       *
       * E o travessao e nao "0": um zero parece um bonus que o jogador pode
       * perder, e um travessao e a forma de dizer que o atributo simplesmente
       * nao foi tocado
       */
      return (
        <div className="perm-bonus">
          <ul className="perm-bonus__lista">
            {entradas.map((entrada) => (
<li
                  key={entrada.id}
                  className={[
                    "perm-bonus__linha",
                    entrada.zero ? "is-zero" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                {/*
                  O NOME POR EXTENSO, e a SIGLA depois.

                  Sao os dois campos do mesmo `StatSheet`, e nenhum dos dois
                  e escrito aqui: e o que impede esta lista de divergir do
                  painel de status
                */}
                <span className="perm-bonus__linha-nome">
                  <span className="perm-bonus__linha-texto">
                    {entrada.name}
                  </span>
                  <span className="perm-bonus__linha-sigla">
                    {entrada.label}
                  </span>
                </span>

                <b
                  className={[
                    "perm-bonus__linha-valor",
                    entrada.value < 0 ? "is-negativo" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {entrada.text}
                </b>
              </li>
            ))}
          </ul>

          {label && (
            <span className="perm-bonus__label">{label}</span>
          )}
        </div>
      );
    }

  return (
    <div className="perm-bonus">
      {entradas.map((entrada) => (
        <span
          key={entrada.id}
          className="perm-bonus__chip"
          data-tip={entrada.name}
        >
          <small>{entrada.label}</small>

          <strong
            style={{
              color:
                entrada.value >= 0 ? "#e5bb68" : "#ff9d9d",
            }}
          >
            {entrada.text}
          </strong>
        </span>
      ))}

      {label && (
        <span className="perm-bonus__label">{label}</span>
      )}
    </div>
  );
}