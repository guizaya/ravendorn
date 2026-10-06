/**
 * Os NPCs: as criaturas que NAO sao inimigo.
 *
 * Um NPC e uma entidade do mundo com tres diferencas em relacao a um
 * mob, e as tres importam:
 *
 * 1. **nao ataca, nao e atacado e nao entra em combate.** Nao ha HP,
 *    nao ha alvo e nao ha loot. Um mob que o jogador nao pode bater e
 *    apenas um mob com falta de vergonha
 * 2. **reage ao clique** abrindo um painel, em vez de virar alvo. E o
 *    que faz ele ser NPC e nao enfeite
* 3. **e uma arte propria, nao um quadro da folha de props.** As
 *    props vem de `props.png`, com celulas de 32px e quatro variacoes.
 *    Um NPC e um desenho unico, de centenas de px, que precisa de uma
 *    ancora nos PES para ficar de pe no chao
 *
 * ## A arte
 *
 * A imagem e UNICA de 520x597, nao uma folha. Nao
 * ha grade de direcoes, e o que o jogador ve nesta tela e a unica
 * pose do mercador: ele esta de frente, virado para o sul, com a
 * barra de pocoes ao lado

 *
 * A imagem e WAY maior que um boneco de 64px e nao cabe no calcamento
 * do hub sem encolher. `NPC_MERCADOR_SCALE` mede o quanto: 0.34 leva
 * os 597px para 203px, que e um pouco mais alto que o jogador (128px)
 * e le como "alguem" e nao como "um obstaculo"
 */

import { NPC_SHEETS, NPC_SPRITE_SIZES } from "./sheets.js";

/**
 * O QUE o clique num NPC faz.
 *
 * O valor viaja pelo mapa inteiro — do dado ate o HUD — entao ele e uma
 * palavra, e nao uma funcao: um mapa nao pode carregar funcao, e o
 * servidor precisa conseguir ler
 */
export const NPC_ACAO = Object.freeze({
  /**
   * abre a LOJA DE POCOES do mercador.
   *
   * Nao e `MERCADO`, e o nome e o que mantem as duas coisas separadas.
   * A acao antiga apontava para o mercado ENTRE jogadores, que e um
   * painel de oferta e proposta, sem catalogo e sem preco de NPC. O
   * mercador da base nao tem oferta nenhuma para propose: ele tem
   * pocoes para vender. Abrir o mercado de jogadores aqui mostrava um
   * painel vazio com o sentido errado
   *
   * O valor `pocoes` tambem evita a colisao com o `PAINEL.MARKET` do
   * HUD, que e o nome do painel do mercado entre jogadores
   */
  POCOES: "pocoes",

  /**
   * Abre o painel de HABILIDADES do mestre da base.
   *
   * O painel ainda esta VAZIO de proposito: o NPC existe, o clique
   * funciona e a tela abre, e o que vai dentro dela e trabalho que vem
   * depois
   *
   * E um valor proprio, e nao o reuso de outro painel. Se este
   * apontasse para `PAINEL.STATUS`, o mestre abriria o painel de status
   * do personagem — uma tela que existe, e que nao tem nada a ver com
   * aprender uma habilidade
   */
  HABILIDADES: "habilidades",
});

/**
 * O CATALOGO de NPCs.
 *
 * Um registro por tipo, e nao uma lista solta no mapa: cada mapa
 * declara *onde* tem NPC e *qual* e o tipo, e este arquivo diz o que o
 * tipo e. A alternativa — o mapa bringing `onClick` junto — punha o
 * painel dentro do dado do mapa
 */
export const NPC_TYPES = Object.freeze({
  mercador: Object.freeze({
    id: "mercador",
    name: "Mercador",

    /** o que o clique abre: a loja de pocoes, e nao o mercado entre jogadores */
    acao: NPC_ACAO.POCOES,

    /**
     * A FOLHA deste NPC.
     *
     * Uma imagem so, e nao um indice de quadro: a arte do mercador e
     * um desenho unico de 520x597, sem grade de direcoes
     */
    sheet: NPC_SHEETS.mercador,

    /**
     * A arte medida, e a escala que a traz para o mundo do hub.
     *
     * A primeira versao foi 0.34, que dava 203px de altura. Era grande
     * demais: o mercador ocupava uma fatia do calcamento que nao parece
     * parte de um hub — e a camera do hub ja e 1.4286 mais perto, o que
     * faz a arte parecer ainda maior em tela
     *
     * 0.2 leva os 597px para 119px, pouco menos que o jogador (128px).
     * E a altura certa para um NPC: da para ver que e alguem, e nao e
     * um obstaculo
     */
    scale: 0.2,

    /** o inventario, para o retrato e o colisor de clique */
    naturalWidth: NPC_SPRITE_SIZES.mercador.width,
    naturalHeight: NPC_SPRITE_SIZES.mercador.height,

    /**
     * O RAIO do clique, em px de mundo.
     *
     * Maior que o raio de prop porque o NPC e um alvo de cliques, e o
     * jogador mira nele com o mouse e nao por acaso. Este acompanha a
     * escala: 28px da o alvo com folga em volta da barraca sem invadir
     * o calcamento inteiro
     */
    clickRadius: 28,

    /**
     * A BARRA de passagem.
     *
     * Um NPC que o jogador atravessa e um NPC que parece um adesivo.
     * `blocking: true` e o que diz ao `CollisionSystem` que aqui tem
     * algo solido; e o que impede o boneco de parar dentro da barraca
     */
    blocking: true,
  }),

  /**
   * O MESTRE DE HABILIDADES, ao lado do mercador.
   *
   * ## A ESCALA E 0.09, E NAO A DO MERCADOR
   *
   * A arte e 1205x1306 — mais que o DOBRO da do mercador em cada lado.
   * Com o 0.2 do mercador, ela sairia com 241x261 na tela, o dobro da
   * altura do jogador, e o mestre pareceria um segundo jogador gigante em
   * vez de alguem contando com a propria silhueta
   *
   * 0.09 leva os 1306px para 118px, praticamente a altura do mercador
   * (119px) e do jogador (128px). E o que faz os dois se lerem como duas
   * pessoas no calcamento, e nao como um obstaculo e um poste
   *
   * ## O RAIO DE CLIQUE E O DO MERCADOR
   *
   * Os dois tem por volta de 100px de largura em tela, entao o mesmo
   * `28` de raio da um alvo de mouse equivalente. Um raio maior nao
   * help: a arte e larga mas o boneco e o que o jogador mira, e um alvo
   * largo demais comeca a competir com o calcamento
   */
  habilidades: Object.freeze({
    id: "habilidades",
    name: "Mestre de Habilidades",

    /** o que o clique abre: o painel de habilidades, hoje vazio */
    acao: NPC_ACAO.HABILIDADES,

    sheet: NPC_SHEETS.habilidades,
    scale: 0.09,
    naturalWidth: NPC_SPRITE_SIZES.habilidades.width,
    naturalHeight: NPC_SPRITE_SIZES.habilidades.height,
    clickRadius: 28,
    blocking: true,
  }),
});

/**
 * O NPC DO HUB, na posicao pedida.
 *
 * (710, 377) e a esquerda do calcamento e acima da linha do meio, do
 * lado oposto ao portal (1475, 588). A escolha e de leitura: quem
 * entra no hub olhando para o norte ve a barraca de frente, e o portal
 * continua sendo a outra coisa grande da tela
 *
 * A posicao e a do PE do NPC, e nao o centro da imagem. A arte tem
 * 597px de altura e a barra ocupa a parte de baixo: ancorar pelo centro
 * faria o mercador flutuar 100px acima do chao
 */

export const BASE_NPCS = Object.freeze([
  Object.freeze({
    id: "npc_mercado_base",
    typeId: "mercador",
    x: 710,
    y: 377,
  }),

  /**
   * O MESTRE DE HABILIDADES, AO LADO do mercador.
   *
   * (880, 377) e 170px a direita do mercador, na MESMA altura — os dois
   * ficam na mesma linha do calcamento, e nao um atras do outro. A
   * leitura e a de duas bancas: quem entra no hub ve as duas de uma vez
   * e escolhe a que precisa
   *
   * 170px e o menor espacaco que ainda deixa o mestre com a propria
   * largura. A arte e 108px em tela, entao uma separacao menor faria as
   * duas se tocarem
   */
  Object.freeze({
    id: "npc_habilidades_base",
    typeId: "habilidades",
    x: 880,
    y: 377,
  }),
]);

/** O NPC de um id, ou `null`. Mesmo contrato do `getPropType` */
export function getNpcType(typeId) {
  return NPC_TYPES[typeId] ?? null;
}
