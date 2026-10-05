/**
 * As FOLHAS dos NPCs e os tamanhos medidos delas.
 *
 * Ficam em um arquivo proprio, e nao no `index.js` do catalogo, por
 * duas razoes:
 *
 * 1. **o Vite so empacota `new URL` com caminho literal.** Montar a URL
 *    por template — `` `../../assets/npc/${nome}.png` `` — passa no
 *    desenvolvimento e some no build, e o NPC aparece com a arte
 *    quebrada em producao e ninguem descobre por que
 * 2. **o tamanho medido e um dado, e um dado que o teste usa.** O
 *    `npce` precisa confirmar que a folha do disco tem o tamanho que o
 *    catalogo declara, e medir o PNG dentro do catalogo misturaria
 *    "o que o NPC e" com "o que a arte tem"
 */
/**
 * O tamanho de cada folha, medido no arquivo do disco.
 *
 * Sao os valores que decidem a escala e a ancora. Medidos aqui e nao
 * cridos: a imagem do mercador e 520x597, e qualquer numero inventado
 * faria o NPC aparecer com o pe no lugar errado
 */
export const NPC_SPRITE_SIZES = Object.freeze({
  mercador: Object.freeze({
    width: 520,
    height: 597,
  }),
});

/**
 * As folhas, por tipo.
 *
 * Um `new URL` literal por entrada, e e o que o Vite reconhece
 */
export const NPC_SHEETS = Object.freeze({
  mercador: new URL(
    "../../assets/npc/market_base.png",
    import.meta.url,
  ).href,
});
