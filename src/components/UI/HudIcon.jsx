import {
  hasHudIcon,
  hudIconGlyph,
  hudIconUrl,
} from "../../data/hudIcons.js";

/**
 * O icone de um botao da HUD: arte desenhada, ou glifo de reserva.
 *
 * Mesma ideia do `ItemIcon`, pelo mesmo motivo: quem decide entre a
 * imagem e o texto e este componente, e nao cada botao. A diferenca e o
 * que acontece quando a arte nao existe — no item o glifo e do
 * catalogo, e aqui o glifo vem junto no `hudIcons.js`, dos botoes que
 * ja usavam aquele caractere antes da arte
 *
 * O `alt` e vazio de proposito. O botao que contem este icone ja tem o
 * `aria-label` e o `title` com o nome do painel ("Bestiario (B)"), e um
 * leitor de tela anunciando "icone do bestiario" logo depois de
 * "Abrir o bestiario" enche a barra de repeticao
 */
export default function HudIcon({
  iconId,
  className = "",
}) {
  const src = hudIconUrl(iconId);

  const classNames = [
    "hud-icon",
    src ? "" : "hud-icon--glyph",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!src) {
    return <span className={classNames}>{hudIconGlyph(iconId)}</span>;
  }

  return (
    <span className={classNames}>
      <img src={src} alt="" draggable={false} />
    </span>
  );
}

/**
 * O nome tem arte desenhada?
 *
 * Exportado para os testes do `HUD` conferirem os quatro botoos pelo
 * mesmo lugar que a tela usa, em vez de repetir a regra do formato
 */
export function hasHudIconFor(iconId) {
  return hasHudIcon(iconId);
}