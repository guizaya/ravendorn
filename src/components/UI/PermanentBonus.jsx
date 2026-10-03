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
 */
export default function PermanentBonus({
  bonuses,
  empty = "",
  label = null,
}) {
  const entradas = statBonusEntries(bonuses);

  if (entradas.length === 0) {
    if (!empty) return null;

    return (
      <p className="perm-bonus__empty">{empty}</p>
    );
  }

  return (
    <div className="perm-bonus">
      {entradas.map((entrada) => (
        <span
          key={entrada.id}
          className="perm-bonus__chip"
          title={entrada.name}
        >
          <small>{entrada.label}</small>

          <strong
            style={{
              color:
                entrada.value >= 0 ? "#7ef0b0" : "#ff9d9d",
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