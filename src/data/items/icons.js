/**
 * Os icones desenhados de item, por raridade.
 *
 * O catalogo de itens tem um `icon` que e um GLIFO de texto (um
 * emoji), e ele nao muda com a raridade: o arco de galho e o mesmo
 * `🏹` nas cinco. Quando a arte entra, o icone passa a ser uma
 * imagem, e a imagem depende da raridade: um arco lendario nao e o
 * arco comum com outra cor, e um arco outro.
 *
 * Este modulo tem as duas pontas:
 *
 * 1. O mapa de raridade para o nome do ARQUIVO. O id de raridade do
 *    jogo e em ingles (`common`, `uncommon`), e o nome do arquivo na
 *    pasta de arte e em portugues (`comum.png`, `incomun.png`).
 *    Sao dois dicionarios diferentes, e o mapa e o unico lugar onde
 *    eles se encontram. Um `typo` aqui nao quebra nada em tempo de
 *    execucao: o `new URL` de um arquivo que nao existe vira uma
 *    URL que da 404 no navegador, e o item aparece sem imagem. Por
 *    isso o teste deste modulo confere os cinco arquivos em disco
 *
 * 2. O item que tem arte, ligado aos cinco arquivos. O id do arco e
 *    `willow_bow` e a pasta se chama `arco_de_galho`, que e o nome de
 *    exibicao em portugues; o resto do projeto nomeia as pastas com o
 *    id (`zumbi_arbalist`, `ogre_da_predeira`), e o item e a excecao
 *
 * `new URL(..., import.meta.url)` e o mesmo motivo de `./sprites/`:
 * o motor tambem roda no servidor Node, e um `import url from
 * "comum.png"` derrubaria o processo com ERR_UNKNOWN_FILE_EXTENSION.
 * O Node resolve isto para uma string sem abrir o arquivo, e o Vite
 * ainda reescreve para o asset empacotado
 */
import { RARITY } from "./index.js";

/**
 * Raridade do jogo -> nome do arquivo de arte.
 *
 * As tres ultimas batem com o id. As duas primeiras nao batem, e
 * sao a razao deste mapa existir
 */
export const RARITY_ICON_FILE = {
  [RARITY.COMMON]: "comum",
  [RARITY.UNCOMMON]: "incomun",
  [RARITY.RARE]: "rare",
  [RARITY.EPIC]: "epic",
  [RARITY.LEGENDARY]: "legendary",
};

/**
 * Os itens que tem arte desenhada.
 *
 * A lista cresce de proposito. A ordem e a de entrada no catalogo:
 * o arco e a arma principal do arbalist, a aljava e a secundaria.
 * O `icons.test.js` trava a lista, entao um item novo com arte
 * aparece la como falha ate ser declarado aqui de proposito
 */
export const ICON_ITEM_IDS = [
  "willow_bow",
  "aljava_arbalist",
  "botas_arbalist",
  "calca_arbalist",
  "capuz_arbalist",
  "luvas_arbalist",
  "peito_arbalist",
];

/**
 * Item -> os cinco PNGs de raridade.
 *
 * Cada `new URL` aqui tem o caminho INTEIRO escrito, sem template
 * literal. Isso e obrigatorio, e nao preferencia de escrita.
 *
 * Com `new URL(\`../../assets/Items/${pasta}/${raridade}.png\`)` o
 * build passa, imprime `✓ built`, e o PNG nao vai para o `dist`.
 * Nao ha erro nem aviso: no desenvolvimento a URL `file://` funciona
 * e o icone aparece, e so em producao que some. O mesmo vale para
 * um unico trecho variavel
 *
 * A regra do Vite e so com o caminho literal, porque e ele que
 * consegue enxergar o arquivo no build. Por isso a lista e escrita
 * cinco vezes, e nao gerada: e a forma que o empacotador entende
 *
 * O nome da pasta segue o id do item com underscore. A excecao
 * continua sendo o arco: pasta `arco_de_galho`, id `willow_bow`. A
 * `itemIconFolder` e o mapa que resolve essa excecao sem espalhar o
 * `if` pelo arquivo
 */
const ARCO_DE_GALHO = {
  comum: new URL(
    "../../assets/Items/arco_de_galho/comum.png",
    import.meta.url,
  ).href,
  incomun: new URL(
    "../../assets/Items/arco_de_galho/incomun.png",
    import.meta.url,
  ).href,
  rare: new URL(
    "../../assets/Items/arco_de_galho/rare.png",
    import.meta.url,
  ).href,
  epic: new URL(
    "../../assets/Items/arco_de_galho/epic.png",
    import.meta.url,
  ).href,
  legendary: new URL(
    "../../assets/Items/arco_de_galho/legendary.png",
    import.meta.url,
  ).href,
};

/**
 * A arma secundaria do arbalist: a aljava.
 *
 * Mesma forma do arco e pelo mesmo motivo. A arte e a mesma nos dois
 * slots: couro verde no comum e couro dourado no lendario, e o que
 * muda entre as cinco e a materia, nao o objeto
 */
const ARMA_SECUNDARIA_ARBALIST = {
  comum: new URL(
    "../../assets/Items/arma_secundaria_arbalist/comum.png",
    import.meta.url,
  ).href,
  incomun: new URL(
    "../../assets/Items/arma_secundaria_arbalist/incomun.png",
    import.meta.url,
  ).href,
  rare: new URL(
    "../../assets/Items/arma_secundaria_arbalist/rare.png",
    import.meta.url,
  ).href,
  epic: new URL(
    "../../assets/Items/arma_secundaria_arbalist/epic.png",
    import.meta.url,
  ).href,
  legendary: new URL(
    "../../assets/Items/arma_secundaria_arbalist/legendary.png",
    import.meta.url,
  ).href,
};

/**
 * As botas do arbalist: as grevas.
 *
 * Terceira arte do mesmo arquivo e pelo mesmo motivo das duas
 * primeiras. A arte e a mesma nas cinco: couro verde no comum e couro
 * dourado no lendario, e o que muda entre elas e a materia
 */
const BOTAS_ARBALIST = {
  comum: new URL(
    "../../assets/Items/botas_arbalist/comum.png",
    import.meta.url,
  ).href,
  incomun: new URL(
    "../../assets/Items/botas_arbalist/incomun.png",
    import.meta.url,
  ).href,
  rare: new URL(
    "../../assets/Items/botas_arbalist/rare.png",
    import.meta.url,
  ).href,
  epic: new URL(
    "../../assets/Items/botas_arbalist/epic.png",
    import.meta.url,
  ).href,
  legendary: new URL(
    "../../assets/Items/botas_arbalist/legendary.png",
    import.meta.url,
  ).href,
};

/**
 * As calcas do arbalist: as calcas de couro.
 *
 * Mesma forma das outras tres e pelo mesmo motivo. Quarta arte do
 * mesmo arquivo: couro verde no comum e couro dourado no lendario
 */
const CALCA_ARBALIST = {
  comum: new URL(
    "../../assets/Items/calca_arbalist/comum.png",
    import.meta.url,
  ).href,
  incomun: new URL(
    "../../assets/Items/calca_arbalist/incomun.png",
    import.meta.url,
  ).href,
  rare: new URL(
    "../../assets/Items/calca_arbalist/rare.png",
    import.meta.url,
  ).href,
  epic: new URL(
    "../../assets/Items/calca_arbalist/epic.png",
    import.meta.url,
  ).href,
  legendary: new URL(
    "../../assets/Items/calca_arbalist/legendary.png",
    import.meta.url,
  ).href,
};

/**
 * O capuz do arbalist.
 *
 * Mesma forma das outras quatro e pelo mesmo motivo. Quinta arte do
 * mesmo arquivo: aco no comum e ouro no lendario
 */
const CAPUZ_ARBALIST = {
  comum: new URL(
    "../../assets/Items/capuz_arbalist/comum.png",
    import.meta.url,
  ).href,
  incomun: new URL(
    "../../assets/Items/capuz_arbalist/incomun.png",
    import.meta.url,
  ).href,
  rare: new URL(
    "../../assets/Items/capuz_arbalist/rare.png",
    import.meta.url,
  ).href,
  epic: new URL(
    "../../assets/Items/capuz_arbalist/epic.png",
    import.meta.url,
  ).href,
  legendary: new URL(
    "../../assets/Items/capuz_arbalist/legendary.png",
    import.meta.url,
  ).href,
};

/**
 * As luvas do arbalist: as manoplas.
 *
 * Mesma forma das outras cinco e pelo mesmo motivo. Sexta arte do
 * mesmo arquivo: aco no comum e ouro no lendario
 */
const LUVAS_ARBALIST = {
  comum: new URL(
    "../../assets/Items/luvas_arbalist/comum.png",
    import.meta.url,
  ).href,
  incomun: new URL(
    "../../assets/Items/luvas_arbalist/incomun.png",
    import.meta.url,
  ).href,
  rare: new URL(
    "../../assets/Items/luvas_arbalist/rare.png",
    import.meta.url,
  ).href,
  epic: new URL(
    "../../assets/Items/luvas_arbalist/epic.png",
    import.meta.url,
  ).href,
  legendary: new URL(
    "../../assets/Items/luvas_arbalist/legendary.png",
    import.meta.url,
  ).href,
};

/**
 * O peito do arbalist: a couraca.
 *
 * Mesma forma das outras seis e pelo mesmo motivo. Setima arte do
 * mesmo arquivo: aco no comum e ouro no lendario
 */
const PEITO_ARBALIST = {
  comum: new URL(
    "../../assets/Items/peito_arbalist/comum.png",
    import.meta.url,
  ).href,
  incomun: new URL(
    "../../assets/Items/peito_arbalist/incomun.png",
    import.meta.url,
  ).href,
  rare: new URL(
    "../../assets/Items/peito_arbalist/rare.png",
    import.meta.url,
  ).href,
  epic: new URL(
    "../../assets/Items/peito_arbalist/epic.png",
    import.meta.url,
  ).href,
  legendary: new URL(
    "../../assets/Items/peito_arbalist/legendary.png",
    import.meta.url,
  ).href,
};

/**
 * Item -> arte por raridade.
 *
 * Um item que NAO esta aqui continua usando o glifo do catalogo, e e
 * assim que os outros 12 itens funcionam. O `icons.test.js` trava a
 * lista, entao a lista cresce de proposito, com arte nova em pasta
 * nova
 */
export const ITEM_ICON_ASSET = {
  [ICON_ITEM_IDS[0]]: ARCO_DE_GALHO,
  [ICON_ITEM_IDS[1]]: ARMA_SECUNDARIA_ARBALIST,
  [ICON_ITEM_IDS[2]]: BOTAS_ARBALIST,
  [ICON_ITEM_IDS[3]]: CALCA_ARBALIST,
  [ICON_ITEM_IDS[4]]: CAPUZ_ARBALIST,
  [ICON_ITEM_IDS[5]]: LUVAS_ARBALIST,
  [ICON_ITEM_IDS[6]]: PEITO_ARBALIST,
};

/** O item tem arte desenhada? */
export function hasItemIcon(itemId) {
  return Boolean(ITEM_ICON_ASSET[itemId]);
}

/**
 * O caminho da imagem do item NAQUELA raridade, ou `null`.
 *
 * Devolve `null` em tres casos, e nos tres o certo e o chamador
 * desenhar o glifo do catalogo: item sem arte, raridade fora das
 * cinco, ou item que nem existe. Devolver `null` em vez de uma URL
 * quebrada importa porque a pasta de arte e opcional por item: um
 * item novo entra no jogo sem nenhum arquivo, e o icone dele tem de
 * continuar funcionando
 */
export function itemIconUrl(itemId, rarity = null) {
  const arte = ITEM_ICON_ASSET[itemId];

  if (!arte) return null;

  const file = RARITY_ICON_FILE[rarity];

  if (!file) return null;

  return arte[file] ?? null;
}
