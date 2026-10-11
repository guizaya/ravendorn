import {
  hasSkillIcon,
  skillIconGlyph,
  skillIconUrl,
} from "../../data/skillIcons.js";

/**
 * O icone de um slot de skill: arte desenhada, ou glifo de reserva.
 *
 * Mesma ideia do `HudIcon` e do `ItemIcon`, pelo mesmo motivo: quem decide
 * entre a imagem e o texto e este componente, e nao cada slot. A diferenca e
 * o que acontece quando a arte nao existe — nas outras tres classes o
 * glifo vem do catalogo da skill, e o slot continua mostrando as duas
 * letras que mostrava antes
 *
 * O `alt` e vazio de proposito. O botao que contem este icone ja tem o
 * `aria-label` e o `title` com o nome da skill ("Usar Quick Shot"), e um
 * leitor de tela anunciando "icone do quick shot" logo depois de "usar
 * quick shot" enche a barra de repeticao
 */
export default function SkillIcon({
  skillId,
  glyph,
  className = "",
}) {
  const src = skillIconUrl(skillId);

  const classNames = [
    "skill-icon",
    src ? "" : "skill-icon--glyph",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  /**
 * O GLIFO VEM DA SKILL, E O MAPA DESTE ARQUIVO E SO O RESERVA.
 *
 * O `icon` do `SKILL_PACKS` e a fonte da verdade do que o slot mostrava
 * antes da arte, entao usa-lo e o que garante que a troca seja so de
 * desenho
 *
 * E o mapa deste modulo existe para uma skill que chegasse ao slot sem
 * `icon` nenhum. As outras tres classes tem glifo no catalogo e nao tem arte:
 * o `SkillSlot` sempre passa o `glyph={skill.icon}`, entao elas nao chegam
 * aqui — e se chegassem, o `skillIconGlyph` devolveria `null` e o slot
 * ficaria vazio, que e pior do que duas letras
 */
const texto = glyph ?? skillIconGlyph(skillId);

  if (!src) {
    return <span className={classNames}>{texto}</span>;
  }

  return (
    <span className={classNames}>
      <img src={src} alt="" draggable={false} />
    </span>
  );
}

/**
 * A skill tem arte desenhada?
 *
 * Exportado para os testes do `SkillSlot` conferirem pelo mesmo lugar que a
 * tela usa, em vez de repetir a regra do formato
 */
export function hasSkillIconFor(skillId) {
  return hasSkillIcon(skillId);
}