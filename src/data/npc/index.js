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
 * A folha e uma FAIXA DE IDLE de 9 quadros de 172x172, vinda do
 * `idle_npc_potions.gif`. Nao ha grade de direcoes — o que o jogador ve
 * nesta tela e o mercador parado de frente, virado para o sul, com a barra
 * de pocoes ao lado, respirando num ciclo de 1.62s
 *
 *
 * A celula e WAY maior que um boneco de 64px e nao cabe no calcamento
 * do hub sem encolher. A escala mede o quanto: 0.58 leva os 172px da celula
 * para 100px, que e a MESMA altura que o mercador ocupava antes da troca de
 * arte — o bau e o mestre ficam do mesmo tamanho no calcamento
 */

import { NPC_SHEETS, NPC_SPRITE_CELULAS, NPC_SPRITE_SIZES } from "./sheets.js";

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

  /**
   * Abre o bau da base.
   *
   * ## POR QUE UM VALOR PROPRIO E NAO O `INVENTARIO` DO HUD
   *
   * Porque o bau e a MOCHILA DO PERSONAGEM VINDO DE FORA, e a mochila em si
   * e a lista de itens que o jogador carrega. Sao o mesmo conjunto de
   * coisas e dois lugares diferentes: o bau guarda, o inventario carrega.
   *
   * Apontar para `PAINEL.INVENTARIO` faria o clique no bau abrir a mochila
   * comum, e o jogador nao teria como saber que guardou alguma coisa — o
   * painel apareceria igual, sem nenhuma diferenca que dissesse "voce veio
   * ate aqui"
   *
   * ## E POR QUE O PAINEL AINDA NAO EXISTE
   *
   * Pelo mesmo motivo do mestre de habilidades: o NPC existe, o clique
   * responde e o alvo da acao esta nomeado. O que cabe DENTRO desse painel
   * — o que da para guardar, quanto cabe, o que ja esta guardado — e
   * trabalho que vem depois, e que precisa de uma decisao do servidor antes
   * de ter tela
   */
  BAU: "bau",
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
     * Uma faixa de idle de 9 quadros, e nao um desenho unico: a arte do
     * mercador agora e `potions_base.png`, gerada de
     * `idle_npc_potions.gif`. A celula e `NPC_SPRITE_CELULAS.mercador`, e o
     * `NpcRenderer` recorta dela o retangulo do quadro do momento
     */
    sheet: NPC_SHEETS.mercador,

    /**
     * A CELULA E O CICLO DO IDLE.
     *
     * `quadros` e quantos retangulos a folha tem na linha; `velocidade` e o
     * tempo de cada um, em segundos. Os dois juntos sao o que faz o NPC
     * respirar: 9 * 0.18 = 1.62s por volta, que e o ritmo de um idle sem
     * pressa
     *
     * `quadros: 1` e o caso de um NPC de arte estatica: o `NpcRenderer` le o
     * `0` e o `1 % 1` da sempre, e o desenho sai igual ao de antes
     */
    celula: NPC_SPRITE_CELULAS.mercador,
    velocidade: 0.18,

    /**
     * A arte medida, e a escala que a traz para o mundo do hub.
     *
     * A primeira versao foi 0.34, que dava 203px de altura. Era grande
     * demais: o mercador ocupava uma fatia do calcamento que nao parece
     * parte de um hub — e a camera do hub ja e 1.4286 mais perto, o que
     * faz a arte parecer ainda maior em tela
     *
     * ## POR QUE 0.168
     *
     * O pedido foi de 80% do tamanho, e depois um aumento de 5% sobre
     * esse resultado: 0.2 x 0.8 x 1.05 = 0.168. Leva os 597px para 100px
     *
     * A altura que importa e a comparacao com o BAU, o outro objeto
     * pequeno do calcamento: o bau esta em 94px e o mercador em 100px.
     * Os 6px de diferenca ainda leem como a mesma familia de tamanho, e
     * o mercedor volta a ter a presenca de quem vende coisa
     *
     * Os 100px ficam abaixo do jogador (128px). A leitura de "alguem" se
     * sustenta no desenho e na barra de pocoes ao lado, e nao na altura
     */
    /**
     * A ESCALA, MEDIDA PARA A ARTE NOVA.
     *
     * A antiga dava 100px de altura a 0.168 sobre 597px. A celula nova mede
     * 172, e 0.168 levaria a 29px — um boneco do tamanho de um prop
     *
     * 0.58 leva os 172px para 100px: a MESMA altura que o mercador tinha
     * antes, entao o calcamento nao muda de lugar nenhum e o bau continua
     * do mesmo tamanho do lado
     */
    scale: 0.58,

    /** o inventario, para o retrato e o colisor de clique */
    naturalWidth: NPC_SPRITE_SIZES.mercador.width,
    naturalHeight: NPC_SPRITE_SIZES.mercador.height,

    /**
     * O RAIO do clique, em px de mundo.
     *
     * Maior que o raio de prop porque o NPC e um alvo de cliques, e o
     * jogador mira nele com o mouse e nao por acaso.
     *
     * ## POR QUE CONTINUA 28, MESMO COM A ARTE MENOR
     *
     * Porque o raio e do ALVO, e nao do desenho: 28px de raio sao um
     * circulo de 56px, que na arte antiga de 104px de largura era 54% e
     * agora e 64% dos 83px que sobraram. O alvo ficou RELATIVAMENTE
     * maior, entao encolher a arte nao tornou o clique mais dificil — e
     * baixar o raio junto deixaria o jogador mirando em volta do
     * mercador para acertar
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
   * ## A ESCALA E 0.0756, E NAO A DO MERCADOR
   *
   * A arte e 1205x1306 — mais que o DOBRO da do mercador em cada lado.
   * Com a escala do mercador, ela sairia com 205x221 na tela, quase o
   * dobro da altura do jogador, e o mestre pareceria um segundo jogador
   * gigante em vez de alguem contando com a propria silhueta
   *
   * 0.0756 leva os 1306px para 99px, e o mercador esta em 100px. Os dois
   * continuam separados por 1px de altura, entao continuam se lendo como
   * duas pessoas de tamanho parecido no calcamento
   *
   * ## POR QUE 0.0756, E NAO UM NUMERO REDONDO
   *
   * Porque e a conta do pedido: 0.09 x 0.8 x 1.05. Arredondar para 0.076
   * daria um aumento de 5,6% e o mestre passaria a ter 2px a mais que o
   * mercador — o tipo de diferenca que nao se ve, mas que faz um numero
   * escrito na mao divergir do numero que o jogador pediu
   *
   * E o valor feio de proposito: a escala e a unica conta do arquivo que
   * nao tem resultado redondo, e arredondar aqui seria trocar um erro
   * visivel (5% pedido, 5,6% entregue) por um erro invisivel
   *
   * ## O RAIO DE CLIQUE E O DO MERCADOR
   *
   * Os dois tem por volta de 90px de largura em tela, entao o mesmo `28`
   * de raio da um alvo de mouse equivalente — e continua valendo pelo
   * mesmo motivo do mercador: o alvo e relativo ao desenho, entao
   * encolher a arte aumenta a proporcao coberta em vez de diminui-la
   */
  habilidades: Object.freeze({
    id: "habilidades",
    name: "Mestre de Habilidades",

    /** o que o clique abre: o painel de habilidades, hoje vazio */
    acao: NPC_ACAO.HABILIDADES,

    /** a faixa de idle, e a celula que o renderer recorta dela */
    sheet: NPC_SHEETS.habilidades,
    celula: NPC_SPRITE_CELULAS.habilidades,
    velocidade: 0.18,

    /**
     * A ESCALA, MEDIDA PARA A ARTE NOVA.
     *
     * A antiga dava 100px de altura a 0.0756 sobre 1306px. A celula nova mede
     * 172, e 0.0756 a levaria a 13px — invisivel
     *
     * 0.58 leva os 172px para 100px, a MESMA altura que o mestre ocupava
     * antes e a mesma do mercador novo. Os dois ficam com a mesma altura em
     * tela, que e o que mantem o calcamento lendo como duas bancas do mesmo
     * tamanho
     */
    scale: 0.58,
    naturalWidth: NPC_SPRITE_SIZES.habilidades.width,
    naturalHeight: NPC_SPRITE_SIZES.habilidades.height,
    clickRadius: 28,
    blocking: true,
  }),

  /**
   * O BAU DA BASE.
   *
   * ## A FOLHA E 1254x1254, E ISSO NAO DIZ O TAMANHO DO BAU
   *
   * O arquivo e quadrado e do tamanho do do mestre de habilidades, mas o
   * que o jogador ve nao e a moldura: e o desenho dentro dela
   *
   * A arte antiga (`storage.png`) ocupava o quadrado INTEIRO — sem margem
   * transparente, das quatro pontas. A nova (`storage_2.png`) tem 64px de
   * folga na esquerda, 53px na direita, 50px em cima e 31px embaixo, e o
   * desenho de verdade mede 1137x1173
   *
   * Por isso a escala subiu de 0.075 para 0.08. Na mesma escala, a arte
   * nova apareceria com 85x88px em vez dos 94x94px da antiga — o baU
   * encolheria um decimo sem ninguem ter pedido para isso. Compensando a
   * margem, o desenho volta para 91x94px, que e o tamanho que o jogador
   * ja viu no calcamento
   *
   * ## POR QUE A ESCALA NAO E MENOR QUE A DO MERCADOR
   *
   * Porque um baU e MOBILIO, nao alguem. Com a escala do mercador
   * (0.2) sairiam 227px, quase o dobro da altura do jogador, e o
   *(player 128px) passaria a ser o menor desenho do calcamento
   *
   * ## O RAIO DE CLIQUE E MAIOR QUE O DAS PESSOAS
   *
   * O `28` das outras duas foi escolhido porque a arte delas tem por
   * volta de 100px de largura em tela. O baU e um OBJETO: o jogador mira
   * no meio dele, e o meio de um quadrado e mais facil de acertar do que
   * o torso de um desenho. Com `28` o alvo ficaria apertado demais para o
   * que ele e, entao vai para `34` — ainda bem menor que o `48` dos
   * props, para nao competir com o calcamento
   *
   * E `blocking: true` pelo mesmo motivo das outras duas: um baU e solido,
   * e o boneco parar dentro dele seria pior do que nao ter baU nenhum
   */
  bau: Object.freeze({
    id: "bau",
    name: "Baú",

    /** o que o clique abre: o painel do bau, com as duas colunas */
    acao: NPC_ACAO.BAU,

    /** a faixa de idle, e a celula que o renderer recorta dela */
    sheet: NPC_SHEETS.bau,
    celula: NPC_SPRITE_CELULAS.bau,
    velocidade: 0.18,

    /**
     * A ESCALA, MEDIDA PARA A ARTE NOVA.
     *
     * A antiga dava 94px de altura a 0.08 sobre 1254px. A celula nova mede
     * 168, e 0.08 a levaria a 13px — invisivel
     *
     * 0.58 leva os 168px para 97px. Fica 3px abaixo dos outros dois NPCs, que
     * estao em 100px: e o suficiente para o bau ler como um OBJETO e nao
     * como mais uma pessoa, sem parecer menor por acidente
     */
    scale: 0.58,
    naturalWidth: NPC_SPRITE_SIZES.bau.width,
    naturalHeight: NPC_SPRITE_SIZES.bau.height,
    clickRadius: 34,
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

/**
 * OS TRES NPCs DA BASE, NAS MESMAS POSICOES DE SEMPRE.
 *
 * O mapa foi desenhado no Tiled (`base.tmj`: 105 tiles de 16px, 1680 x 1168) e
 * as posicoes continuam sendo as mesmas de sempre, porque a largura nao mudou.
 * Reescrever o mapa no Tiled nao mexe em nada deste bloco: sao coordenadas de
 * mundo, nao de tile
 */
export const BASE_NPCS = Object.freeze([
  Object.freeze({
    id: "npc_mercado_base",
    typeId: "mercador",

    /**
     * O TILE 11, 6.
     *
     * A grade do mapa base e de 64px, entao o tile e a celula: coluna 11 ->
     * 11 * 64 = 704, linha 6 -> 6 * 64 = 384. O `y` e o PE do desenho, e nao
     * o canto da celula — o `NpcRenderer` ancora a arte por ele
     *
     * Antes era (710, 377), que e este mesmo tile medido a olho. A conta
     * agora e a do tile, e nao um numero solto
     */
    x: 704,
    y: 384,
  }),

  /**
   * O MESTRE DE HABILIDADES, AO LADO do mercador.
   *
   * E na mesma linha do calcamento que o mercador, e nunca um atras do outro:
   * a leitura e a de duas bancas, e quem entra no hub ve as duas de uma vez e
   * escolhe a que precisa
   *
   * A coluna e o que separa as tres coisas, e ela mudou com a arte. O
   * mestre era um desenho de 1205x1306 e depois virou uma faixa de idle de
   * 172x172; um NPC largo precisa de mais espaco antes do proximo do que um
   * alto
   */
  Object.freeze({
    id: "npc_habilidades_base",
    typeId: "habilidades",

    /**
     * O TILE 18, 6.
     *
     * A grade e de 64px: coluna 18 -> 18 * 64 = 1152, linha 6 -> 6 * 64 = 384.
     * O `y` e o PE, e nao o canto da celula
     *
     * Foi o tile 17 mais um, por pedido. Com a arte nova o mestre tem cerca
     * de 100px de largura e estava a 38px do bau, que fica em (1050, 377):
     * as silhuetas encostavam. Mais um tile abre 102px de vao
     */
    x: 1152,
    y: 384,
  }),

  /**
   * O BAU, AO LADO DO MESTRE.
   *
   * (1050, 377) e 170px a direita do mestre, na MESMA linha — os tres
   * ficam na mesma altura do calcamento, e nao um atras do outro. E o
   * mesmo passo do mestre para o mercador, pelo mesmo motivo: quem entra
   * no hub ve as tres coisas de uma vez e escolhe a que precisa
   *
   * ## POR QUE 170px E NAO MENOS, COM UM BAU MENOR
   *
   * Porque o passo foi escolhido pela arte MAIOR do trio, que e o mestre
   * (87px em tela, depois do encolhimento dos dois NPCs). O bau e o mais
   * estreito dos tres (91px), entao uma separacao menor caberia nele sem
   * tocar — mas a conta e feita pelo vizinho mais largo: se os tres
   * andassem juntos em 130px, as silhuetas se encostariam e a leitura de
   * "tres coisas separadas" viraria "um pileira"
   *
   * Com 170px sobram 81px de vao entre o mestre e o bau. E folga de sobra
   * para os dois encolherem ainda mais, se um dia precisarem
   *
   * ## E POR QUE O MESMO `y` DO MESTRE
   *
   * E o mesmo `y`, e e de proposito: o `y` e o PE do desenho, e o
   * `NpcRenderer` ancora a arte pelo rodape (`y: npc.y - height`). O
   * `storage_2.png` tem 31px de margem transparente embaixo, que a 0.08
   * valem 2,5px — o bau aparece 2,5px acima da linha do pe, dentro da
   * margem de erro de qualquer coisa do calcamento
   */
  Object.freeze({
    id: "npc_bau_base",
    typeId: "bau",

    /**
     * O TILE 9, 8.
     *
     * A grade e de 64px: coluna 9 -> 9 * 64 = 576, linha 8 -> 8 * 64 = 512.
     * O `y` e o PE, e nao o canto da celula
     *
     * Saiu da linha dos outros dois de proposito. O bau e um OBJETO, e nao
     * uma pessoa: quando ele estava na mesma altura do mercador e do mestre,
     * a leitura era de tres bancas iguais — e um bau nao e uma banca
     *
     * Uma linha abaixo do mercador (11,6) e o que separa os dois sem
     * parecerem estar em outra fileira do calcamento
     */
    x: 576,
    y: 512,
  }),
]);

/** O NPC de um id, ou `null`. Mesmo contrato do `getPropType` */
export function getNpcType(typeId) {
  return NPC_TYPES[typeId] ?? null;
}
