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

  /**
   * A CLASSE DO ICONE, para o CSS poder centralizar a arte.
   *
   * ## POR QUE CADA ICONE PRECISA DO SEU
   *
   * Porque as artes nao tem a mesma margem. Cada uma e um PNG de 1600px com
   * o desenho no meio e uma faixa transparente em volta, e a faixa NAO e
   * igual: o `market.png` sobra 186px a esquerda e 0 a direita, o `guild.png`
   * sobra 329 dos dois lados
   *
   * O `object-fit: contain` centraliza a ARTE inteira, margem inclusa — o
   * que sai e o desenho deslocado. Em 30px de botao, o `market` ficava
   * 4.5px a esquerda do meio, e era o que o jogador via como "icone torto"
   *
   * Uma classe por icone deixa o ajuste no CSS, que e onde ele pertence: a
   * arte continua sendo a do designer, e o numero vive num lugar que o
   * `conferir-margem-icones.mjs` consegue conferir contra o PNG de verdade
   *
   * Sem isto, a unica saida seria `transform` em cada imagem, e ela
   * empurraria o desenho em vez de devolver o espaco que a margem ocupava
   */
  const classNames = [
    "hud-icon",
    `hud-icon--${iconId}`,
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