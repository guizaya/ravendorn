/**
 * OS ICONES DAS MOEDAS, e a URL de cada arte.
 *
 * ## POR QUE ESTE REGISTRO EXISTE
 *
 * Porque as tres moedas apareciam como GLIFO DE TEXTO — um `◉`, um `◈` e um
 * `◇` escritos dentro de um `<i>`. Sao tres caracteres que dependem da fonte
 * da maquina: no Windows sao redondos, no Linux podem nem existir, e em
 * qualquer lugar eles nao se parecem com uma moeda de ouro
 *
 * ## E POR QUE UM MAPA E NAO TRES `new URL` soltos
 *
 * Porque o mesmo glifo estava escrito em sete arquivos, e cada um com um
 * `<i>` proprio. Trocar a arte passaria a ser quinze edits, e esquecer um
 * deles deixaria um `◉` perdido no meio do jogo
 *
 * Com o mapa, `new URL` roda uma vez por moeda e o resto do projeto so
 * importa `MOEDA_DE_OURO` e pergunta pelo id
 *
 * ## E POR QUE `new URL` E NAO `import`
 *
 * Porque o motor tambem roda no servidor Node puro. Um `import url from
 * "ouro.png"` derrubaria o processo com `ERR_UNKNOWN_FILE_EXTENSION` no
 * boot — o mesmo motivo que o `data/items/icons.js` ja documenta
 *
 * O Node resolve isto para uma string sem abrir o arquivo, e o Vite ainda
 * reescreve para o asset empacotado
 */

/** O OURO. A moeda que o jogo chama de `coins` em quase todo o codigo. */
export const MOEDA_DE_OURO = new URL(
  "../../assets/icons/currencys/ouro.png",
  import.meta.url,
).href;

/** O STEEL. Sai de minerar, e nao se compra na loja. */
export const MOEDA_DE_STEEL = new URL(
  "../../assets/icons/currencys/steel.png",
  import.meta.url,
).href;

/** O DIAMANTE. Compra vaga de personagem; a moeda de conta. */
export const MOEDA_DE_DIAMANTE = new URL(
  "../../assets/icons/currencys/diamante.png",
  import.meta.url,
).href;

/**
 * O ID DE CADA MOEDA, e o dicionario que o painel usa.
 *
 * O nome e o mesmo que o `data` ja usa: `coins`, `steel` e `diamonds`. E o
 * painel passa o id, nao a URL, porque ele tem tres numeros e nao tres
 * imports — quem decide a arte e este mapa
 */
export const MOEDAS = {
  coins: MOEDA_DE_OURO,
  steel: MOEDA_DE_STEEL,
  diamonds: MOEDA_DE_DIAMANTE,
};

/** A arte de uma moeda pelo id, ou `null` quando o id nao existe. */
export function iconeDaMoeda(id) {
  return MOEDAS[id] ?? null;
}
