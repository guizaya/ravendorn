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
  arbalist_thorn_trap: "AT",
  arbalist_fan_volley: "SV",
  arbalist_venom_bolt_rain: "CV",
  arbalist_arrow_rain: "AR",
  sorcerer_mana_lance: "LM",
  sorcerer_crystal_nova: "NC",
  sorcerer_singularity: "SG",
  sorcerer_dragon_tornado: "DT",
};

/**
 * AS ARTES, E O NOME DELAS E O DO SLOT.
 *
 * ## POR QUE `skill_1` E NAO `thorn_trap`
 *
 * Porque o nome do arquivo e o do SLOT que a arte ocupa, e nao o da skill. As
 * tres, que ocupam os slots `1` a `3` do arqueiro, entao seguem o numero; a
 * ultimate e a unica com nome proprio (`ult.jpg`), porque o slot dela e o `R`
 *
 * E o que mantem o catalogo inteiro em ordem: slot 1, slot 2, slot 3, e a
 * ultimate. Se uma skill entrar antes de outra no `SKILL_PACKS`, e o nome da
 * arte que precisa trocar de lugar — e nao o id
 */
const SKILL_ICON_URL = {
  sorcerer_mana_lance: new URL(
    "../assets/skills/sorcerer/skill_1.png",
    import.meta.url,
  ).href,

  sorcerer_crystal_nova: new URL(
    "../assets/skills/sorcerer/skill_2.png",
    import.meta.url,
  ).href,

  sorcerer_singularity: new URL(
    "../assets/skills/sorcerer/skill_3.png",
    import.meta.url,
  ).href,

  arbalist_thorn_trap: new URL(
    "../assets/skills/arbalist/skill_1.png",
    import.meta.url,
  ).href,

  arbalist_fan_volley: new URL(
    "../assets/skills/arbalist/skill_2.png",
    import.meta.url,
  ).href,

  arbalist_venom_bolt_rain: new URL(
    "../assets/skills/arbalist/skill_3.png",
    import.meta.url,
  ).href,

  /**
   * A ULTIMATE, e o unico arquivo cujo nome nao segue o slot.
   *
   * `ult.jpg` em vez de `skill_4.jpg`: a arte ocupa o botao proprio, o `R`, e
   * nao um dos tres slots numerados. A entrada em `SKILL_ICON_GLYPH` e a que
   * mantem o `AR` de reserva, entao a diferenca de nome fica visivel num lugar
   * so
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