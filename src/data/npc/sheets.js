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
    width: 1548,
    height: 172,
  }),
  habilidades: Object.freeze({
    width: 1548,
    height: 172,
  }),
  bau: Object.freeze({
    width: 1512,
    height: 168,
  }),
});

/**
 * O TAMANHO DE UMA CELULA DE NPC, E O QUE A FOLHA TEM DENTRO.
 *
 * A arte do mercador mudou de desenho unico para faixa de idle, e a folha
 * deixou de ser uma imagem: sao 9 celulas de 172x172 em linha. O tamanho da
 * folha (`NPC_SPRITE_SIZES`) e a medida do ARQUIVO, e a celula e o que o
 * `NpcRenderer` recorta de cada quadro
 *
 * E por isso que o `width` do mercador e 1548 e nao 172: 9 * 172. O desenho
 * de um NPC so e um quadrado, e quem ler `NPC_SPRITE_SIZES` sem este comentario
 * vai tentar pintar 1548px de quadro na tela
 */
export const NPC_SPRITE_CELULAS = Object.freeze({
  mercador: Object.freeze({
    width: 172,
    height: 172,
    quadros: 9,

    /**
     * OS 26px TRANSPARENTES DA BASE DA CELULA.
     *
     * ## POR QUE ISTO PRECISA EXISTIR
     *
     * Porque o `y` do NPC e o PE, e o `NpcRenderer` ancora a arte pelo PE
     * da CELULA. Mas o desenho dentro do `idle_npc_potions.gif` termina na
     * linha 145 de 172: os 26 ultimos pixels sao vazios nos nove quadros
     *
     * Sem descontar isso, o merchant fica 26 * 0.58 = 15px ACIMA do chao,
     * flutuando. E o tipo de defeito que ninguem acha olhando o catalogo,
     * porque a posicao esta certa e a arte que esta errada
     *
     * ## E POR QUE MEDIDO, E NAO CHUTADO
     *
     * A margem foi lida do alfa de cada um dos nove quadros, e vale 26 nos
     * nove. O que varia no idle e o TOPO (23 a 27) e a largura (50 a 54 a
     * esquerda), que e o balanco do corpo — e o balanco nao descola o pe do
     * chao
     */
    margemBaixo: 26,

    /**
     * A LARGURA DO QUE ESTE DESENHADO DE VERDADE.
     *
     * ## POR QUE A CELULA DE 172 NAO SERVE PARA A SOMBRA
     *
     * Porque a sombra e uma elipse medida na largura da arte, e a arte e o
     * boneco — nao a moldura. A celula tem 172 de largura e o desenho ocupa
     * dela uns 76: 50 de margem transparente a esquerda e 46 a direita
     *
     * Medindo pela celula, a sombra sairia com 68px de diametro para um
     * boneco de 76 de largura: a sombra nearly do tamanho do boneco, e o
     * piso embaixo dele viraria um disco em vez de uma sombra de pe
     *
     * ## E POR QUE 76 E NAO 70
     *
     * Porque e a LARGURA MAXIMA dos nove quadros. O idle balanca o corpo e a
     * arte vai de 67 a 76 de largura; usar a maior mantem a sombra estavel
     * nos dois extremos em vez de pulsar junto com a respiracao
     */
    larguraDesenhada: 76,
  }),
  habilidades: Object.freeze({
    width: 172,
    height: 172,
    quadros: 9,

    /**
     * OS 25px TRANSPARENTES DA BASE, MEDIDOS NOS NOVE QUADROS.
     *
     * A mesma correcao do mercador: o `y` do NPC e o PE, e a celula tem
     * 25px vazios embaixo. Sem descontar, o mestre flutuaria 25 * 0.58
     */
    margemBaixo: 25,

    /**
     * A MAIOR LARGURA DESENHADA NOS NOVE QUADROS.
     *
     * O idle balanca o corpo e a arte vai de 65 a 71 de largura. A maior
     * mantem a sombra estavel nos dois extremos em vez de pulsar junto com a
     * respiracao
     */
    larguraDesenhada: 71,
  }),
  bau: Object.freeze({
    width: 168,
    height: 168,
    quadros: 9,

    /**
     * OS 25px TRANSPARENTES DA BASE, MEDIDOS NOS NOVE QUADROS.
     *
     * A mesma correcao dos outros dois NPCs: o `y` e o PE, e a celula tem
     * 25px vazios embaixo. Sem descontar, o bau flutuaria
     */
    margemBaixo: 25,

    /**
     * A MAIOR LARGURA DESENHADA NOS NOVE QUADROS.
     *
     * O idle balanca a tampa do bau e a arte vai de 62 a 66 de largura
     */
    larguraDesenhada: 66,
  }),
});

/**
 * As folhas, por tipo.
 *
 * Um `new URL` literal por entrada, e e o que o Vite reconhece
 */
export const NPC_SHEETS = Object.freeze({
  /**
   * O MERCADOR: `potions_base.png`, a faixa de idle.
   *
   * Sao 9 quadros de 172x172 em linha, gerados de
   * `src/assets/sprites/npcs/idle_npc_potions.gif`. O GIF de origem e
   * animado e nao cabe em `new URL` — o `Image` do canvas le o primeiro
   * quadro e para, sem animacao
   */
  mercador: new URL(
    "../../assets/npc/potions_base.png",
    import.meta.url,
  ).href,
  /**
   * O MESTRE: `habilidades_base.png`, a faixa de idle.
   *
   * Mesma receita do mercador: 9 quadros de 172x172 em linha, gerados de
   * `idle_npc_habilidades.gif`. A arte antiga era um desenho unico de
   * 1205x1306
   */
  habilidades: new URL(
    "../../assets/npc/habilidades_base.png",
    import.meta.url,
  ).href,

/**
   * O BAU: `bau_base.png`, a faixa de idle.
   *
   * Mesma receita dos outros dois: 9 quadros de 168x168 em linha, gerados de
   * `idle_npc_bau.gif`. A arte antiga era `storage_2.png`, um quadrado de
   * 1254x1254
   *
   * Os dois arquivos antigos continuam em `src/assets/npc/` e nenhum codigo
   * aponta para eles. Eles ficaram no disco de proposito: apagar arte que o
   * jogador pode querer de volta nao faz parte de trocar a referencia, e o
   * Vite ja deixa de fora do build o que ninguem importa
   */
  bau: new URL(
    "../../assets/npc/bau_base.png",
    import.meta.url,
  ).href,
});
