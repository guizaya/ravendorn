/**
 * Os icones desenhados das skills, por classe.
 *
 * ## O MESMO PROBLEMA DO `hudIcons.js`, E A MESMA SOLUCAO
 *
 * Os slots da barra de atalhos mostravam um GLIFO de texto — `QS`, `IA`,
 * `VM`, `C` e `AR` — e dois caracteres nao dizem o que a skill faz: `C` e
 * Cloaking e Cloqueamento e Cover, e o jogador que nunca viu a skill nao tem
 * como adivinhar. A arte resolve, e e o que esta pasta tem
 *
 * O `new URL(..., import.meta.url)` e obrigatório e nao e preferencia de
 * escrita, por dois motivos que o `hudIcons.js` documenta inteiro: o Vite so
 * empacota o `new URL` de caminho LITERAL — um caminho montado por template
 * passa o build, aparece no `dev` e some no `dist`, sem erro — e o motor
 * roda no servidor Node, onde um `import url from "quick_shot.jpg"` derrubaria
 * o processo
 *
 * ## POR QUE SO O ARBALIST TEM ARTE
 *
 * Porque so o arbalist tem. As outras tres classes continuam no glifo, e
 * continuam funcionando: e o `skillIconUrl` devolvendo `null` que faz o
 * `SkillIcon` cair no texto, e nada mais muda. Quando a arte de uma delas
 * existir, e um JPG na pasta e uma linha nesta tabela
 */

/**
 * As artes que existem.
 *
 * A chave e a CLASSE e nao o id da skill, porque a arte e uma propriedade
 * da classe: os quatro slots do arbalist e a ultimate sao todos desta pasta.
 * O id continuaria no `SKILL_PACKS`, que e quem decide nome, cooldown e slot
 *
 * E o caminho escrito POR EXTENSO em `SKILL_ICON_URL` logo abaixo, pelo
 * mesmo motivo do `HUD_ICON_FILE`: e o Vite que so enxerga o literal. Este
 * mapa existe para o arquivo de cada classe poder ser comparado com o que
 * esta no disco, e para um nome errado aparecer em um erro em vez de sumir
 * em silencio
 */
export const SKILL_ICON_FILE = {
  arbalist: "arbalist",
};

/**
 * Os glifos de reserva, e sao os mesmos de antes da arte.
 *
 * Sao as duas letras que ja estavam no `icon` de cada skill do
 * `SKILL_PACKS`. O glifo nao e um desenho novo: ele e o que o jogador ja
 * viu nos atalhos, e e o que aparece se o JPG nao carregar — um slot vazio
 * num circulo de 40px e pior do que duas letras
 */
const SKILL_ICON_GLYPH = {
  arbalist_quick_shot: "QS",
  arbalist_illusion_arrow: "IA",
  arbalist_venom_mist_shell: "VM",
  arbalist_cloaking: "C",
  arbalist_arrow_rain: "AR",
};

const SKILL_ICON_URL = {
  arbalist_quick_shot: new URL(
    "../assets/skills/arbalist/quick_shot.jpg",
    import.meta.url,
  ).href,

  arbalist_illusion_arrow: new URL(
    "../assets/skills/arbalist/illusion_arrow.jpg",
    import.meta.url,
  ).href,

  arbalist_venom_mist_shell: new URL(
    "../assets/skills/arbalist/venom_mist_shell.jpg",
    import.meta.url,
  ).href,

  arbalist_cloaking: new URL(
    "../assets/skills/arbalist/cloaking.jpg",
    import.meta.url,
  ).href,

  /**
   * A ULTIMATE, e o unico arquivo cujo nome nao segue o id.
   *
   * `ult.jpg` em vez de `arrow_rain.jpg`: o nome do arquivo e do slot que a
   * arte ocupa na barra, e o slot da ultimate e o `R`. A das outras quatro
   * segue o id porque elas ocupam o `1` ao `4` e cada uma tem um nome seu
   *
   * A entrada em `SKILL_ICON_GLYPH` e a que mantem o `AR` de reserva, entao
   * a diferenca de nome fica visivel num lugar so
   */
  arbalist_arrow_rain: new URL(
    "../assets/skills/arbalist/ult.jpg",
    import.meta.url,
  ).href,
};

/**
 * A URL do icone de uma skill, ou `null`.
 *
 * `null` e o que faz o `SkillIcon` cair no glifo, e e o caminho das outras
 * tres classes: elas nao tem entrada aqui, e continuam desenhando as letras
 */
export function skillIconUrl(skillId) {
  return SKILL_ICON_URL[skillId] ?? null;
}

/** O glifo de reserva da skill, ou `null` */
export function skillIconGlyph(skillId) {
  return SKILL_ICON_GLYPH[skillId] ?? null;
}

/** Existe arte desenhada para esta skill? */
export function hasSkillIcon(skillId) {
  return Object.hasOwn(SKILL_ICON_URL, skillId);
}

export { SKILL_ICON_URL };