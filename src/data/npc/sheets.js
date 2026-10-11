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
 *
 * A do mestre de habilidades e 1205x1306, que e o MAIOR arquivo de NPC
 * do jogo. E a escala dele que corrige isso — ver `NPC_TYPES.habilidades`
 *
 * O bau tambem e 1254x1254, e ele e QUADRADO: a arte antiga preenchia a
 * moldura inteira e a nova (`storage_2.png`) tem margem transparente em
 * volta do desenho. E o desenho que mede na tela, nao a moldura — ver
 * `NPC_TYPES.bau`
 */
export const NPC_SPRITE_SIZES = Object.freeze({
  mercador: Object.freeze({
    width: 520,
    height: 597,
  }),
  habilidades: Object.freeze({
    width: 1205,
    height: 1306,
  }),
  bau: Object.freeze({
    width: 1254,
    height: 1254,
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
  habilidades: new URL(
    "../../assets/npc/habilidades_base.png",
    import.meta.url,
  ).href,

  /**
   * O BAU: `storage_2.png`, e nao o `storage.png` antigo.
   *
   * O caminho e um literal inteiro de propósito — o Vite so empacota
   * `new URL` escrito na mão, e montar o nome por variável faz a arte
   * sumir no build (ver o comentario do topo deste arquivo)
   *
   * O `storage.png` antigo continua em `src/assets/npc/` e nenhum codigo
   * aponta para ele. Ele ficou no disco de proposito: apagar um arquivo de
   * arte que o jogador pode querer de volta nao faz parte de trocar a
   * referencia, e o Vite ja o deixa de fora do build por nao ser
   * importado por nada
   */
  bau: new URL(
    "../../assets/npc/storage_2.png",
    import.meta.url,
  ).href,
});
