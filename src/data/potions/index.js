/**
 * A LOJA DE POCOES do mercador da base.
 *
 * ## POR QUE O PRECO NAO ESTA NO ITEM
 *
 * O catalogo de itens (`data/items`) tem o `value` de cada um, e esse
 * `value` e o que o MERCADO ENTRE JOGADORES paga. Ele nao e o preco de
 * loja, e a separacao e deliberada:
 *
 * - o `value` e o que um jogador aceita oferecer pela pocao;
 * - o preco aqui e quanto o mercador cobra.
 *
 * Se os dois fossem o mesmo numero, cada mudanca de preco da loja
 * mexeria no valor de mercado de todo item que um jogador tivesse a
 * oferecer — e um item com valor de mercado alto e preco de loja
 * baixo vira um caminho infinito de ouro
 *
 * O preco vive aqui porque ele e uma decisao do MERCADOR, e nao do
 * item. O mercador compra vida ao preco que ele quere, do mesmo jeito
 * que uma loja real
 *
 * ## O QUE O CATALOGO GUARDA
 *
 * So o que a loja precisa para mostrar a linha e fechar a venda: qual
 * item, quanto custa, e o texto que explica o que acontece quando o
 * jogador bebe. O resto — cura de 120, empilhavel, imagem — vem do
 * catalogo de itens, que ja e a fonte unica. Guardar os dois aqui
 * deixaria dois lugares para mudar a mesma coisa
 */

/**
 * O preco maximo de uma pilha, para o painel poder vender "x5" de uma vez.
 *
 * Cinco e um teto de convenience, e nao de regra: e o quanto o mercador
 * entrega numa mao. Um numero alto demais nao cabe na mochila de quem
 * compra, e um numero baixo demais obriga a clicar cinco vezes
 */
export const POCAO_MAX_POR_COMPRA = 5;

/**
 * As pocoes a venda.
 *
 * Uma so, de proposito. O mercador e a primeira loja do jogo e nao tem
 * um catalogo de dez linhas: a pocao de cura e o item de consumo, e e
 * ela que precisa existir antes de o painel, o uso e a compra
 * fazerem sentido
 *
 * O preco de 50 moedas e o dobro do `value` da pocao. O mercador
 * compra do jogador pelo valor e vende pelo preco, e e assim que a
 * moeda circula entre quem caça e quem se cura
 */
export const POCOES = Object.freeze([
  Object.freeze({
    id: "pocao_cura",

    /** quanto custa uma unidade */
    preco: 50,

    /** a linha de descricao do painel */
    descricao: "Recupera 120 de vida ao ser consumida.",

    /**
     * A cor do preco.
     *
     * O ouro do jogador e o mesmo numero que o do mercador, entao a cor
     * e o que diz "isto e despesa" antes do jogador clicar
     */
    corPreco: "#e8c96a",
  }),

  Object.freeze({
    id: "pergaminho_teleporte",

    /**
     * 90, e quase o DOBRO da pocao.
     *
     * E o preco de uma atalho de viagem, e nao de um item de consumo.
     * A pocao se paga porque evita uma morte; o pergaminho se paga porque
     * evita andar tres mil pixels, e isso vale mais para quem ja esta
     * com o auto ligado do que para quem esta parado no meio do mapa
     *
     * E mais caro que a pocao DEPOIS de subiu de nivel, porque e
     * justamente quem tem level alto quem atravessa o vale inteiro: o
     * preco nao acompanha o nivel, e o tempo que ele economiza
     */
    preco: 90,

    descricao:
      "Pula direto para o fim do deslocamento automatico. Gasta um pergaminho por teleporte.",

    corPreco: "#e8c96a",
  }),
]);

/** A pocao de um id, ou `null`. Mesmo contrato do `getNpcType` */
export function getPocao(id) {
  return POCOES.find((pocao) => pocao.id === id) ?? null;
}

/** O preco de uma pocao, ou `null` quando ela nao esta a venda */
export function precoPocao(id) {
  return getPocao(id)?.preco ?? null;
}

/** As pocoes do catalogo, na ordem em que aparecem no painel */
export const POCAO_IDS = Object.freeze(POCOES.map((pocao) => pocao.id));
