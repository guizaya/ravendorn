/**
 * Os icones desenhados dos botoes da HUD.
 *
 * Os botoes da barra usavam um GLIFO de texto — `☠` no bestiario,
 * `⇄` no market, `⚒` no craft e `?` no status — e eles nao dizem o que
 * o painel e. O `?` do status e o pior dos quatro: e o caractere de
 * "duvida" do teclado virado de proposito para o painel do personagem,
 * e o jogador tem de adivinhar o que ele abre. A arte resolve, e e o
 * que esta pasta tem
 *
 * O nome do arquivo e o do botao: `stats.png`, `bestiario.png`,
 * `market.png`, `craft.png`, `colecao.png` e `rank.png`. O
 * `gear_pixel_icon.png` e a excecao, e ele entra pelo `HUD_ICON_FILE`
 * logo abaixo. O mapa e o unico lugar onde o nome do botao e o caminho
 * do arquivo se encontram, e ele e escrito POR EXTENSO, com o caminho
 * literal em cada `new URL`
 *
 * Isso nao e preferencia de escrita: e a regra do Vite, que so
 * empacota o `new URL` quando o caminho e um literal. Com
 * `new URL(\`../assets/icons/${nome}.png\`, import.meta.url)` o
 * build passa, imprime `✓ built`, e o PNG nao vai para o `dist`: no
 * desenvolvimento a URL `file://` funciona e o icone aparece, e so em
 * producao que ele some. Sem erro, sem aviso — e o Vite tem outros
 * arquivos que aparecem no `dev` e nao chegam no `dist`
 *
 * O `new URL(..., import.meta.url)` e o mesmo motivo de
 * `data/items/icons.js` e de `./sprites/`: o motor tambem roda no
 * servidor Node, e um `import url from "stats.png"` derrubaria o
 * processo com ERR_UNKNOWN_FILE_EXTENSION. O Node resolve isto para uma
 * string sem abrir o arquivo
 */

/**
 * Os icones que existem, e o glifo de cada um.
 *
 * O glifo e o RESERVA: e o que o botao mostra enquanto a imagem nao
 * carregou, e o que ele mostra se o arquivo faltar. Sem ele, um icone
 * que da 404 deixa o botao vazio, e um botao vazio na barra e pior do
 * que o glifo feio que ele substitui — o jogador perde a referencia
 * de qual painel aquele circulo abre
 *
 * A ordem e a da barra, e a lista cresce de proposito: um icone novo
 * entra aqui e o `hudIcons.test.js` o acha pelo `for`, sem ninguem
 * precisar escrever um caso
 *
 * O que NAO esta aqui e o botao de teste. Ele e painel de depuracao, e
 * a arte dele nao foi feita; quando aparecer, e um `png` e uma linha
 * nesta lista, e nada mais
 */
export const HUD_ICON_IDS = [
  "stats",
  "bestiario",
  "arena",
  "market",
  "collection",
  "craft",
  "rank",
  "guild",
  "settings",
];

/**
 * O glifo de reserva de cada icone.
 *
 * E o mesmo caractere que o botao usava antes da arte, e nao um
 * glifo novo: o desenho precisa da mesma leitura de antes, e o texto
 * ainda e o que aparece se a imagem nao vier
 */
const HUD_ICON_GLYPH = {
  stats: "?",
  bestiario: "☠",

  /**
   * A ARENA DO CHEFE.
   *
   * E o `☠` do bestiario de proposito: os dois botoes sao sobre criaturas
   * e luta, e a arena e ONDE a luta acontece. Um glifo proprio
   * acrescentaria um nono desenho que o jogador precisa aprender sem
   * dizer nada novo
   *
   * O botao e o mesmo nas duas direcoes e muda so o texto e a cor — o
   * glifo e um so, e ver o mesmo icone virar "sair" e o que comunica que
   * e a mesma porta
   */
  arena: "☠",

  market: "⇄",

  // a colecao usava o `⛁`, o mesmo caractere do catalogo de itens
  collection: "⛁",

  craft: "⚒",
  rank: "♛",

  /**
   * A GUILDA.
   *
   * O escudo e o glifo de reserva, e a leitura e de "grupo protegido
   * que voce entra". Um emoji de gente sugeriria lista de amigos, que
   * nao e o que o painel faz: lao dentro tem arvore de talento e cofre
   */
  guild: "⛊",
  settings: "⚙",
};

/**
 * Id do icone -> nome do arquivo.
 *
 * Quatro ids batem com o arquivo. Dois NAO batem: `collection` segue o
 * `PAINEL.COLECAO` do `HUD.jsx` e o arquivo e `colecao.png`, e o id
 * `settings` vira `gear_pixel_icon.png`. Sao dois dicionarios
 * diferentes, e este mapa e o unico lugar onde eles se encontram
 *
 * O caminho continua escrito por extenso no `HUD_ICON_URL` logo abaixo,
 * porque e o Vite que so enxerga o `new URL` de caminho literal. Este
 * mapa nao monta caminho nenhum: ele existe para o teste saber qual
 * arquivo cada id deve estar apontando, e para o erro de nome ficar
 * visivel em vez de silencioso
 */
export const HUD_ICON_FILE = {
  stats: "stats",
  bestiario: "bestiario",

  /**
   * A arte da arena AINDA NAO EXISTE.
   *
   * A entrada fica declarada com o nome do arquivo que DEVERIA estar la,
   * pelo mesmo motivo da guilda logo abaixo: e o `hudIcons.test.js` que
   * compara as duas listas e falha dizendo o que falta. Sem esta linha
   * o icone cairia no glifo `☠` para sempre, e o botao da arena
   * pareceria igual ao do bestiario
   */
  arena: "arena",
  market: "market",
  craft: "craft",
  collection: "colecao",
  rank: "rank",

  /**
   * A arte da guilda ainda nao existe.
   *
   * A entrada fica declarada com o nome do arquivo que DEVERIA estar
   * la: e o `hudIcons.test.js` que compara as duas listas e falha
   * dizendo o que falta. Sem esta linha o teste passaria e o icone
   * cairia no glifo para sempre
   */
  guild: "guild",
  settings: "gear_pixel_icon",
};

const HUD_ICON_URL = {
  stats: new URL(
    "../assets/icons/stats.png",
    import.meta.url,
  ).href,

  bestiario: new URL(
    "../assets/icons/bestiario.png",
    import.meta.url,
  ).href,

  market: new URL(
    "../assets/icons/market.png",
    import.meta.url,
  ).href,

  craft: new URL(
    "../assets/icons/craft.png",
    import.meta.url,
  ).href,

  collection: new URL(
    "../assets/icons/colecao.png",
    import.meta.url,
  ).href,

  rank: new URL(
    "../assets/icons/rank.png",
    import.meta.url,
  ).href,

  /**
   * A arte da guilda: um escudo com o ramo da arvore de talento.
   *
   * Desenhada por codigo em `tools/gerar-icone-guild.mjs`, e nao
   * importada de uma pasta de arte. Os outros sete icones existem como
   * arquivo feito fora; nao havia arte de guilda no projeto, e um
   * espaco em branco na barra seria pior do que um escudo honesto
   */
  guild: new URL(
    "../assets/icons/guild.png",
    import.meta.url,
  ).href,

  // o nome do arquivo nao segue o id, e o `HUD_ICON_FILE` e quem
  // declara isso: o id e o que o botao pede, e o arquivo e o que a arte
  // se chama
  settings: new URL(
    "../assets/icons/gear_pixel_icon.png",
    import.meta.url,
  ).href,
};

/**
 * A URL do icone, ou `null`.
 *
 * `null` quando o nome nao existe no mapa, e e o que o `HudIcon`
 * le para cair no glifo. Um id de painel escrito errado no botao e o
 * que o teste deste modulo pega: sem este `null`, a imagem sairia com
 * `src="undefined"`
 */
export function hudIconUrl(iconId) {
  return HUD_ICON_URL[iconId] ?? null;
}

/** O glifo de reserva do icone, ou `null` */
export function hudIconGlyph(iconId) {
  return HUD_ICON_GLYPH[iconId] ?? null;
}

/** Existe arte desenhada para este icone? */
export function hasHudIcon(iconId) {
  return Object.hasOwn(HUD_ICON_URL, iconId);
}

export { HUD_ICON_URL };