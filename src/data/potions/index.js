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
 * ## POR QUE TRES LINHAS DE POCAO E NAO UMA
 *
 * Começou com uma, de proposito: a pocao de cura era o item de consumo
 * e era ela que precisava existir antes de o painel, o uso e a compra
 * fazerem sentido. Hoje sao tres, e as tres existem pelo mesmo motivo —
 * a arte separa por tamanho de frasco, e um frasco grande que faz o
 * que o pequeno faz nao e um item, e o mesmo item duas vezes
 *
 * ## POR QUE A ORDEM E PEQUENA, MEDIA, GRANDE
 *
 * E a ordem em que o jogador precisa delas: a pequena e a que resolve o
 * apanhar de um goblin, e e a unica que ele compra sem pensar. A grande
 * e a ultima coisa que ele consideraria
 *
 * O preco de 50 moedas e o dobro do `value` da pocao pequena. O mercador
 * compra do jogador pelo valor e vende pelo preco, e e assim que a
 * moeda circula entre quem caça e quem se cura
 */
export const POCOES = Object.freeze([
  Object.freeze({
    id: "pocao_cura",

    /** quanto custa uma unidade */
    preco: 50,

    /**
     * A linha de descricao do painel.
     *
     * O numero e o total da regeneracao, e nao o `healPerTick`: quem
     * compra nao quer saber o quanto cura por passo, quer saber o quanto
     * volta. 25 a cada 2 segundos por 10 segundos e 125 no total
     */
    descricao: "Recupera 125 de vida ao ser consumida.",

    /**
     * A cor do preco.
     *
     * O ouro do jogador e o mesmo numero que o do mercador, entao a cor
     * e o que diz "isto e despesa" antes do jogador clicar
     */
    corPreco: "#e8c96a",
  }),

  Object.freeze({
    id: "pocao_media",

    /**
     * 95, e quase o DOBRO da pequena.
     *
     * O `value` dobrou e o preco nao dobrou, e essa e a intencao: a
     * media e a que o jogador compra para o trecho longo da volta, e
     * pagar quase o dobro do valor faz a conta fechar para quem vai
     * vender mais que uma. A progressao de preco e 50, 95, 170 — sempre
     * menos que o dobro, para ninguem comprar so a grande por
     * diferença
     */
    preco: 95,

    descricao: "Recupera 250 de vida ao ser consumida.",

    /**
     * O NIVEL MINIMO.
     *
     * ## POR QUE 11 E NAO 10
     *
     * O pedido foi "acima do nivel 10". Acima de 10 comeca no 11, e o
     * `nivelMinimo` e um PISO — o mesmo contrato do `minLevel` das
     * missoes, em `QuestLog.contaPara`: `level >= nivelMinimo`. Escrever
     * 10 aqui entregaria a media no nivel 10, que e o que "acima do 10"
     * proibe
     *
     * ## POR QUE A MEDIA E A PRIMEIRA TRAVA
     *
     * Porque e a trava que nao dói. A pequena resolve o apanhar de um
     * goblin e nao tem portao; a media e a que o jogador usa no trecho
     * longo, e esse trecho e o mapa de cima, onde os inimigos comecam a
     * bater mais forte. Quem chegou no nivel 11 ja passou pelo que a
     * pequena resolve
     */
    nivelMinimo: 11,

    corPreco: "#e8c96a",
  }),

  Object.freeze({
    id: "pocao_grande",

    /**
     * 170, e quase o DOBRO da media.
     *
     * Nao e a mais cara em numero: e a cara por CURA. Quatro vezes o
     * `value` da pequena por 3,4 vezes o preco, e a unica das tres em
     * que o preco por ponto de vida e o melhor. E o que faz a grande
     * valer a pena e a pequena continuar valendo para o apanhar
     * pequeno
     */
    preco: 170,

    descricao: "Recupera 500 de vida ao ser consumida.",

    /**
     * 21, pelo mesmo motivo da media: "acima do nivel 20" comeca no 21,
     * e o `nivelMinimo` e piso
     *
     * ## POR QUE DEZ NIVELOS DE DISTANCIA ENTRE AS DUAS TRAVAS
     *
     * E o tempo que o jogador precisa para usar a grade inteira.
     * Com dez de diferenca, quem compra a media no nivel 11 tem o trecho
     * inteiro de volta — e o chao cresce de forma continua entre os dois,
     * nao em degrau. Se as travas estivessem coladas, a maior seria
     * comprada no mesmo minuto que a media e nenhuma das duas existiria
     * como decisao
     *
     * ## POR QUE A GRANDE NAO TRAVA MAIS QUE ISSO
     *
     * Porque depois do 21 o jogo nao tem mais nada por nivel. A ultimate
     * libera no 6 e as zonas nao tem portao, entao uma trava mais alta
     * seria uma parede sem nada atras
     */
    nivelMinimo: 21,

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

/**
 * ESTE JOGADOR JA PODE COMPRAR ESTA POCAO?
 *
 * ## POR QUE `{ ok, motivo }` E NAO UM BOOLEANO
 *
 * Porque sao DOIS lugares precisam da resposta, e os dois em lingua do
 * jogador: o aviso que o servidor manda quando o cliente insiste, e o
 * `title` do botao desligado no painel. Um booleano obrigaria os dois a
 * escreverem a frase, e duas tradicoes do mesmo texto divergem na
 * primeira edicao
 *
 * E o mesmo formato do `portalLiberado`, em `data/quests/index.js`, que
 * e o outro lugar do jogo onde um aviso precisa dos dois lados
 *
 * ## POR QUE `level` PODE VIR `null`
 *
 * Porque ainda nao chegou. O painel comeca a desenhar antes do primeiro
 * snapshot, e com `null` esta funcao responde que pode — o botao fica
 * ligado e o servidor e quem recusa. E o mesmo tratamento que o saldo
 * desconhecido faz no `PotionPanel`: e melhor o jogador tentar e ouvir a
 * recusa do que ver um botao morto sem explicacao
 *
 * ## POR QUE O PISO E 1 E NAO 0
 *
 * Porque `level` ausente e `level` zero nao sao a mesma coisa, e o
 * primeiro nao e um jogador de nivel zero: e um jogador que o servidor
 * ainda nao leu. Tratar os dois como zero trancaria a loja inteira no
 * primeiro quadro
 */
export function pocaoLiberada(level, pocao) {
  const piso = pocao?.nivelMinimo ?? 1;

  if (level === null || level === undefined) {
    return { ok: true, motivo: null };
  }

  if (Number(level) >= piso) {
    return { ok: true, motivo: null };
  }

  return {
    ok: false,
    motivo: `Libera no nível ${piso}.`,
  };
}

/** As pocoes do catalogo, na ordem em que aparecem no painel */
export const POCAO_IDS = Object.freeze(POCOES.map((pocao) => pocao.id));

/**
 * O LIMIAR PADRAO DO USO AUTOMATICO, em porcentagem de vida.
 *
 * ## POR QUE 85 E NAO 40
 *
 * Porque as pocoes deste catalogo curam em REGENERACAO: a pequena devolve
 * 25 a cada 2 segundos durante 10 segundos, e a grande devolve 100 por
 * passo. Nenhuma delas devolve a vida toda de uma vez
 *
 * Com o limiar em 40 a regra dispararia numa briga de-Level 1, gastando a
 * pocao que o jogador guardava para quando ela importasse. Com 85 a
 * pocao entra quando o dano e de verdade, que e o unico momento em que
 * 125 de regeneracao valem mais do que guardar o frasco
 *
 * ## POR QUE ESTA AQUI E NAO NO `GameEngine`
 *
 * Porque o numero aparece em quatro lugares — a sessao nova, o snapshot,
 * o save e o painel — e esses quatro NEED conversar. Num numero solto em
 * cada arquivo, mudar o default deixaria o painel desenhando 85 enquanto o
 * motor decide por 40, e o jogador veria a barra numa posicao que a regra
 * nao esta usando
 *
 * E aqui porque este arquivo ja e onde uma DECISAO de pocao mora: os
 * precos, os nivel minimo e as descricoes de uso. O limiar automatico e a
 * mesmaspecies de escolha
 */
export const AUTO_POCAO_LIMIAR_PADRAO = 85;

/**
 * O PISO E O TETO DO LIMIAR.
 *
 * ## POR QUE O TETO E 95 E NAO 100
 *
 * Porque em 100 a pocao nunca entra, e o jogador teria um interruptor
 * ligado que nunca fez nada. Ele so descobriria isso no meio da luta
 *
 * ## POR QUE O PISO E 5 E NAO 0
 *
 * Porque em 0 a pocao entra com a vida cheia, gasta o item e nao cura
 * nada. E o jeito mais caro de perder uma pocao
 */
export const AUTO_POCAO_LIMIAR_MIN = 5;
export const AUTO_POCAO_LIMIAR_MAX = 95;
