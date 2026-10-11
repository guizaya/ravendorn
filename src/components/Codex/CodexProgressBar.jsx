/**
 * A BARRA DE PROGRESSO, que o Codex usa em tres lugares.
 *
 * ## POR QUE UM COMPONENTE E NAO UMA CLasse
 * Porque o `bestiario.txt` pede a mesma barra na aba, no card da lista e no
 * etapa em andamento. Tres divs com a mesma classe seriam tres chances de
 * uma delas ficar sem o `role="progressbar"` que a secao 7 exige
 *
 * E o `aria-valuenow` vai sempre em 0 a 100, porque e o que o leitor de tela
 * anuncia — mandar a fracao 0.42 faria o leitor dizer "0,42" num campo que a
 * documentacao define como 0 a 100
 */
export default function CodexProgressBar({
  fracao = 0,
  variante = "",
  altura = 3,
}) {
  const limitada = Math.max(0, Math.min(1, fracao || 0));
  const porCento = Math.round(limitada * 100);

  return (
    <span
      className={[
        "cdx-progress",
        `cdx-progress--${altura}px`,
        variante ? `is-${variante}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="progressbar"
      aria-valuenow={porCento}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="cdx-progress__fill"
        style={{ width: `${porCento}%` }}
      />
    </span>
  );
}