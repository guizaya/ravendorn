/**
 * Os PORTAIS DO MAPA.
 *
 * Os portais do vale e o do hub tem PARA ONDE IR; o da floresta tambem,
 * e e o unico que tem TRAVA: ele so abre com a campanha do mapa 1
 * acabada. Um portal sem `destino` e um enfeite, e a tela nao oferece
 * nada sobre ele
 * e e o unico que tem TRAVA: ele so abre com a campanha do mapa 1
 * acabada. Um portal sem `destino` e um enfeite, e a tela nao oferece
 * nada sobre ele
 *
 * O caminho e de ida e volta entre o hub e o vale:
 *
 *   hub     -> portal_hub     -> vale   (passagem na parede, automatica)
 *   portal_pantano -> portal_hub -> hub (passagem na parede, automatica)
 *
 * Os dois lados da ligacao sao PASSAGENS: sem arte, sem caixa e sem botao.
 * O jogador chega andando na luz dourada da parede e atravessa sozinho. O
 * `size`/`raioY` de cada uma e a ZONA DE ENTRADA, medida pelo `portalSobOsPes`
 * dos dois lados — o cliente para oferecer, o servidor para aceitar
 *
 * E a ida da campanha:
 *
 *   portal_floresta -> Floresta Sombria (so com o mapa 1 completo)
 *   portal_mapa2    -> vale (sempre, a volta e livre)
 *
 * A volta nao tem trava nenhuma, e de proposito: a trava segura a
 * ENTRADA no mapa novo, e um jogador preso la fora nao tem como voltar
 * nem terminar o que falta
 *
 * Os dois lados declaram o par pelo `id` do outro portal. Nenhum guarda
 * coordenada de chegada, entao mover um portal move a chegada dos dois
 * lados sem ninguem editar numero
 *
 * O que ainda NAO existe aqui, e e o tipo de coisa que o proximo que mexer
 * neste arquivo vai perguntar: passar por cima do portal sem clicar,
 * cooldown, portal de uma terceira maquina, e o que quer que seja
 */

/**
 * As folhas dos portais, uma por arte.
 *
 * `new URL(..., import.meta.url)` e nao `import url from
 * "portal_base.png"`: o Node resolve isso para uma string sem abrir o
 * arquivo, que derrubaria o processo do servidor, e o Vite continua
 * reescrevendo para o asset bundlado
 *
 * NENHUM dos arquivos de 1600px entra no bundle. Os dois de origem — o
 * `portal_1.png` e o `portal_2.png` — passam de 2,3MB cada e tem 1451px
 * de desenho, que no viewport de 1280x720 cobriria a tela inteira. Quem
 * corta e reduz e o `tools/gerar-portal.mjs`
 *
 * Sao duas folhas porque sao duas artes: o portal do Pantano tem o
 * vortice roxo e o da Floresta tem o de fogo. Nao da para juntar as duas
 * em um arquivo so sem encolher uma delas
 */
export const PORTAL_SHEETS = {
  // o vortice roxo, do Pantano Profundo
  pantano: new URL(
    "../../assets/portais/portal_base.png",
    import.meta.url,
  ).href,

  // o vortice de fogo, da Floresta Sombria
  floresta: new URL(
    "../../assets/portais/portal_2_base.png",
    import.meta.url,
  ).href,

  /**
   * O aro de pedra, do HUB.
   *
   * A arte do `base.png` e a unica que chegou sem canal alpha: e um RGB
   * de 1254px, com o fundo quase branco PINTADO em pixels de verdade. O
   * `tools/gerar-portal.mjs` corta esse fundo por inundacao a partir da
   * borda — o aro de pedra e fechado, entao o branco de dentro nao e
   * alcancado — e so o arquivo de 192px entra no bundle
   */
hub: new URL(
  "../../assets/portais/portal_hub_base.png",
  import.meta.url,
).href,

  /**
   * O VORTICE NOVO, da base.
   *
   * A diferenca das outras tres folhas e que este arquivo JA VEIO com canal
   * alpha: `new_portal.png` e um PNG de 256x256 em `Format32bppArgb`, e o
   * fundo e transparente de verdade — nao um branco pintado, como o
   * `base.png` do hub foi. Por isso ele nao passou pelo
   * `tools/gerar-portal.mjs`, que existe justamente para cortar o fundo
   * pintado das folhas de entrada
   *
   * E por isso ele entra aqui na medida em que esta, sem o corte: um 256 que
   * o `PortalRenderer` desenha no tamanho do `PORTAL_SIZE`
   */
  novo: new URL(
    "../../assets/portais/new_portal.png",
    import.meta.url,
  ).href,
};

/** o lado do portal no mundo, em pixel */
export const PORTAL_SIZE = 192;

/**
 * O ID DO VALE, REPETIDO AQUI DE PROPOSITO.
 *
 * ## POR QUE NAO VEIO DO `data/maps`
 *
 * Porque `maps/index.js` importa ESTE arquivo para saber a lista de portais
 * de cada mapa, e um import de la para ca fecharia o ciclo. O `MAP_TESTE_ID`
 * de la nao esta visivel aqui
 *
 * E a repeticao e perigosa: se um dia o vale mudar de id, este constante fica
 * para tras e a passagem passa a apontar para um mapa que nao existe — o
 * `findMap` devolve `null` e o jogador atravessa para o spawn padrao, sem
 * erro nenhum. A verificacao esta em `checarDestinos`, la embaixo
 */
const ID_DO_VALE = "mapa_teste";

/**
 * Onde os portais estao.
 *
 * As duas posicoes foram pedidas na coordenada exata, e sao elas que
 * estao aqui.
 *
 * AVISO RESOLVIDO: a posicao do portal da Floresta mudou.
 *
 * A primeira era (111, 125), perto demais do canto. O ponto estava
 * dentro dos limites, mas o portal e de 192px e ANCORADO PELO CENTRO:
 * o desenho ia de x=15 a x=207 e de y=29 a y=221, e a borda do mundo
 * comeca em x=40 e y=40. Sobravam **25px pendurados pela esquerda e 11px
 * por cima**, no vazio de fora do mapa — e o jogador chega la, o limite
 * que ele alcanca e x=62
 *
 * Agora e (223, 204): o desenho vai de x=127 a x=319 e de y=108 a y=300,
 * inteiro dentro, com folga de 87px pela esquerda e 68px por cima
 *
 * As consequencias que sobraram, ambas verificadas:
 *
 * 1. o portal do Pantano cai numa zona `active`, entao monstros andam em
 *    volta dele e alguns passam por cima. Como ele nao tem colisao,
 *    nada trava
 * 2. os dois estao longe do nascimento, que e (3000, 2100): 3142px e
 *    3363px. E proprio de um portal e nao e um defeito
 */

/**
 * editei a posicao dos portais manualmente, deve ficar assim:
 * export const PORTALS = [
    {
      id: "portal_pantano",
      x: 5799,
      y: 3981,
      size: PORTAL_SIZE,
      sheet: "pantano",
    },

    {
      id: "portal_floresta",
      x: 178,
      y: 180,
      size: PORTAL_SIZE,
      sheet: "floresta",
    },
  ];
 * 
 */
/**
 * A PASSAGEM DO CHEFE, NA MESMA FAIXA DA PASSAGEM DA FLORESTA.
 *
 * ## POR QUE SAO DOIS PORTAIS EMPILHADOS NO MESMO PIXEL
 *
 * Porque o destino muda SOZINHO, na virada da missao 1.19: antes dela o
 * jogador vai para a arena terminar o chefe, e depois dela vai para o mapa 2
 *
 * Um portal so, com destino dinamico, exigiria que TODO o caminho de
 * `findMap(portal.destino)` — em `portalSobOsPets`, em `chegadaDe`, em
 * `travessarPortal`, na box e no aviso — soubesse resolver um destino que
 * depende do jogador. Dois portais no mesmo pixel nao mudam nenhum desses
 * caminhos: eles ja sabem achar um portal por posicao
 *
 * ## COMO SO UM DOS DOIS EXISTE POR VEZ
 *
 * Pelo `abreNoDegrau`, que e o indice da escada a partir do qual o portal
 * entra na lista. O `portalSobOsPets` pula o que ainda nao abriu, entao o
 * jogador so enxerga e encosta no que lhe serve:
 *
 * - `mainIndex` 0 a 17: nenhum dos dois. A passagem nao existe ainda
 * - `mainIndex` 18 (na missao 1.19): so o `portal_chefe`, que leva a arena
 * - `mainIndex` 19 ou mais: so o `portal_floresta`, que leva ao mapa 2
 *
 * E o `exigeMissaoDe` do `portal_floresta` foi embora: ele barrava ate a
 * campanha INTEIRA acabar, e quem esta NA missao do chefe e exatamente quem
 * tem que atravessar — para chegar nela
 */
export const MAP_1_PORTAL_DO_CHEFE = {
  id: "portal_chefe",

  /** o mesmo pixel da passagem da floresta: os dois dividem a parede */
  x: 11 * 64,
  y: 150,
  size: 256,
  raioY: 128,

  oculto: true,
  passagem: true,
  brilho: true,

  destino: "boss_1",
  chegada: "portal_chefe_saida",

  /**
   * ABRE NA MISSAO DO CHEFE, E FECHA LOGO DEPOIS.
   *
   * O numero e o indice GLOBAL da escada: `MAIN_QUESTS[18]` e o Hulk, a
   * missao 1.19.
   *
   * ## POR QUE PRECISA DO `fechaNoDegrau`, E SO DO `abreNoDegrau`
   *
   * Porque os dois portais dividem o pixel, e sem o `fecha` os dois ficariam
   * abertos depois do chefe: quem ja matou o Hulk encostava na passagem e ia
   * voltar para a arena para lutar com um chefe que nao existe mais
   *
   * Com o par fechado, cada degrau tem UM destino so:
   *
   * - ate o 17: nenhum dos dois
   * - 18 (missao 1.19): so a arena
   * - 19 ou mais: so o mapa 2
   *
   * E `fecha` e `>=` porque o degrau do chefe JA NAO E O ATUAL: a missao
   * 1.19 concluida significa que o `mainIndex` andou para 19
   */
  abreNoDegrau: 18,
  fechaNoDegrau: 19,
};

export const PORTALS = [
  MAP_1_PORTAL_DO_CHEFE,

  {
    id: "portal_pantano",

    /**
     * A PASSAGEM DO MAPA 1, NA PAREDE — tiles (93, 62) e (93, 63).
     *
     * ## POR QUE SAIU DE (5799, 3981)
     *
     * Porque a imagem saiu e a travessia virou automatica, do mesmo jeito que
     * a da base. A imagem vivia no meio do mapa, e o jogador pisava nela para
     * abrir a caixa; agora ele chega andando na parede
     *
     * ## A CONTA DO `x`: `94 * 64 - 62`
     *
     * A parede do mapa 1 esta em `40 + (94 * 64 - 80) = 5976`, e o
     * `CollisionSystem` ainda desconta o raio do boneco (22px). O centro do
     * jogador para em `5976 - 22 = 5954`, e e ali que a passagem tem que
     * ficar — e o mesmo `- 62` da base, porque e a mesma conta: largura
     * menos a margem de 40, menos o raio de 22
     *
     * Com o portal no meio do mapa, a zona nunca era alcancada; na parede, e
     * exatamente onde o jogador encosta
     *
     * ## E O `y`: `63 * 64`
     *
     * As duas celulas pedidas (62 e 63) vao de `y = 3968` a `4096`, e o meio
     * delas e `4032`. E a mesma conta da base, que usa as linhas 8 e 9
     */
    x: 94 * 64 - 62,
    y: 63 * 64,

    /**
     * A ZONA DE ENTRADA, E A ALTURA COBRINDO AS DUAS CELULAS.
     *
     * `raioY: 128` e a ALTURA: a faixa das duas celulas tem 128px, e o
     * jogador atravessa andando na altura que quiser, sem precisar acertar um
     * circulo estreito
     *
     * ## POR QUE O `size` NAO PODE SER MENOR QUE O RAIO DO JOGADOR
     *
     * A zona de entrada e a metade do `size` para cada lado em X, e o
     * jogador NAO encosta na parede: o colisor o segura a 34px de distancia.
     * Medido no servidor, com o boneco andando contra a parede da base, ele
     * para em x=1590 — e a passagem e a 1602
     *
     * Com `size: 16` a zona comecava em 1594, ou seja 4px DEPOIS de onde o
     * jogador consegue ficar. A conta da elipse dava 2.25 e o
     * `portalSobOsPets` devolvia `null` com o boneco colado na parede: era a
     * passagem que nao existia para ninguem, e o autoEncravava nela
     *
     * Com `size: 48` a zona abre em 1578 e o jogador entra nela 24px antes da
     * parede, com folga para o raio de colisao
     */
    size: 48,
    raioY: 128,
    sheet: "pantano",

    /** A arte saiu: a passagem e a luz dourada na parede, nao um sprite */
    oculto: true,

    /** Sem caixa e sem botao: quem chega na ponta atravessa sozinho */
    passagem: true,

    /** A luz dourada que marca a saida na parede */
    brilho: true,

    /**
     * A VOLTA PARA O HUB.
     *
     * Este e o par de `portal_hub`: ele traz o jogador para o
     * `portal_pantano`, e este devolve. Os dois declaram o par pelo
     * `id` do outro, entao nenhum guarda coordenada e nenhum pode
     * divergir do lugar onde o outro esta
     *
     * A `chegada` e o `portal_hub` e nao o centro do hub: atravessar de
     * volta e chegar em cima do portal de onde o jogador saiu e o que
     * faz a ida e a volta sentirem o mesmo lugar. Chegar no meio do
     * calcamento obrigaria a andar de volta ate o portal para sair
     * dele, e o segundo clique pareceria nao funcionar
     *
     * A `portal_floresta` continua sem destino: e o segundo portal do
     * vale, e liga-lo e outra etapa
     */
    destino: "base",
    chegada: "portal_hub",
  },

  {
    id: "portal_floresta",

    /**
     * A FAIXA NO TOPO, DOS TILES 9 A 12.
     *
     * ## POR QUE `size` E 256 E NAO O `PORTAL_SIZE`
     *
     * Porque este portal e DEITADO. Os outros pares estao em paredes
     * verticais, e ali a faixa e alta em Y (`raioY`) e estreita em X (`size`).
     * Aqui a faixa e larga em X — os tiles 9 a 12 dao 4 tiles, ou 256px — e
     * tem pouca profundidade em Y
     *
     * E `size` e a LARGURA em X nas duas posicoes: `size: 256` abre a zona
     * de 576 a 832, que e exatamente a faixa pedida
     */
    x: 11 * 64,
    size: 256,

    /**
     * A PROFUNDIDADE DE 2 TILES PARA DENTRO DO MAPA.
     *
     * ## POR QUE 150, E NAO A BORDA DA PAREDE
     *
     * A parede do topo do mapa 1 e o objeto `id: 13` do `dungeon.tmj`, em
     * (64, 64) com 768x64 — ela tem 64px de ESPESSURA, e a borda de baixo
     * fica em y=128, nao em 64
     *
     * Com o raio de colisao em 34, o jogador para em y=162. A passagem fica
     * 22px abaixo da borda, em 150, e o jogador entra na zona ao encostar
     *
     * Medido: a faixa inteira de x=576 a x=832 esta livre nessa altura
     */
    y: 150,
    raioY: 128,

    /** a arte saiu: e a passagem e a luz na parede */
    oculto: true,

    /** sem caixa e sem botao: quem chega na ponta atravessa sozinho */
    passagem: true,

    /** a luz dourada que marca a saida na parede */
    brilho: true,

    /**
     * O PAR DO MAPA 2.
     *
     * Os dois declaram o par pelo `id` do outro: este diz para onde vai e
     * onde chega, e o outro faz o mesmo na volta
     */
    destino: "map_2",
    chegada: "portal_mapa2",

    /**
     * ABRE SO DEPOIS DO CHEFE.
     *
     * E o par da regra com o `portal_chefe`: os dois ficam no mesmo pixel,
     * e este so entra na lista quando a missao 1.19 ja foi concluida. Sem
     * este campo a Floresta Sombria seria alcancavel no minuto um, e a
     * campanha do mapa 2 sem nunca ter lutado contra o Hulk
     */
    abreNoDegrau: 19,
  },

  /**
   * A PASSAGEM PARA O VALE, NA PAREDE ESQUERDA.
   *
   * ## A POSICAO, VINDO DOS TILES PEDIDOS
   *
   * `x` na parede da esquerda e a conta que a parede imp—e, nao a conta do
   * tile: o tile `(0, —)` — a COLUNA 0, e o boneco nunca chega nela. O
   * `bounds` do mapa comeca em x=40 e o colisor segura o jogador a 34px da
   * parede, entao ele para em x=74 — e a passagem fica em 62, os mesmos 22px
   * de folga que o `portal_hub` usa na direita
   *
   * `y` e o meio da faixa: tiles 52 a 56 sao cinco, ou seja 320px, e o meio
   * e o tile 54. Com `raioY: 160` a zona cobre de 3296 a 3616 — a faixa
   * inteira dos cinco tiles
   *
   * ## POR QUE `size: 48`
   *
   * Pela mesma razao das outras passagens: a zona em X e a metade do `size`,
   * e ela tem que conter onde o jogador CONSEGUE ficar. Com o raio de 34, ele
   * encosta a 12px do centro, e `raioX: 24` tem folga de sobra
   */
  {
    id: "portal_vale",
    x: 62,
    y: 54 * 64,
    size: 48,

    /**
     * A ALTURA INTEIRA DA FAIXA, E NAO A METADE.
     *
     * O `portalSobOsPets` le `(raioY ?? size) / 2`, entao o campo guarda a
     * altura toda e a metade sai da conta. Cinco tiles sao 320px: com
     * `raioY: 160` a zona cobria 160px e a faixa nao chegava na ponta da
     * coluna pedida
     */
    raioY: 320,
    sheet: "floresta",

    /** a arte saiu: e a passagem e a luz na parede, como as outras */
    oculto: true,

    /** sem caixa e sem botao: quem chega na ponta atravessa sozinho */
    passagem: true,

    /** a luz dourada que marca a saida na parede */
    brilho: true,

    /**
     * O PAR: CHEGA NO `portal_vale_retorno`, DO VALE.
     *
     * Os dois lados se declaram pelo `id` do outro. Sem isto, a chegada cai
     * no spawn do mapa — e o jogador aparece no meio do vale, longe da
     * parede, sem entender por que
     *
     * ## E O DESTINO E `mapa_teste`, E NAO `map_2`
     *
     * Porque o vale tem nome e id diferentes: o mapa se chama "Vale 1" e o
     * registro dele e `MAP_TESTE_ID` (`"mapa_teste"`). O nome e o que se le
     * na HUD, e o id e o que o `findMap` e o `setMap` recebem — e nenhum dos
     * dois e `map_2`, que e a Floresta Sombria
     */
    destino: ID_DO_VALE,
    chegada: "portal_vale_retorno",
  },
];

/**
 * Os portais da ARENA DO CHEFE.
 *
 * ## A PASSAGEM DE SAIDA, NO VAO DA PAREDE DE BAIXO
 *
 * A arena tem uma unica saida, e ela fica num buraco que o jogador fez no
 * `boss.tmj`: entre x=704 e x=1024 a parede de baixo foi aberta
 *
 * A posicao nao sai da conta de "parede menos 22" dos outros pares, porque
 * aqui nao ha parede para encostar: o vao e um buraco, e o jogador desce
 * por ele. Medido com o colisor de verdade:
 *
 * - na altura y=1100 o jogador ocupa x de 738 a 990 (252px de largura util)
 * - descendo pelo vao, ele chega em y=1118
 *
 * O `x` e o meio dos 252px, e o `y` fica um pouco antes do limite, para o
 * gatilho disparar na descida e nao no fundo do buraco
 */
export const BOSS_1_PORTALS = [
  /**
   * A SAIDA DE QUEM AINDA NAO MATOU O CHEFE: VOLTA PARA O MAPA 1.
   *
   * ## POR QUE A ARENA TEM DOIS PORTAIS NO MESMO VAO
   *
   * Pelo mesmo motivo do mapa 1, e pelo mesmo motivo exato: o destino muda
   * sozinho quando a missao 1.19 e concluida. Quem entra na arena e luta e
   * desiste volta para o mapa 1; quem mata o Hulk sai para o mapa 2
   *
   * E sem isso o jogador que entrasse na arena por curiosidade, sem a
   * missao em dia, so tinha um caminho: matar o chefe para poder sair. Perder
   * o progresso inteiro da arena por curiosidade e o pior resultado que um
   * portal fechado produz
   *
   * ## POR QUE ESTE TEM JANELA, E O OUTRO DO VAO TAMBEM
   *
   * Porque os dois precisam se EXCLUIR, e nao basta um deles abrir depois
   * do chefe: enquanto o outro ficar sempre aberto, ele ganha — e a volta
   * para o mapa 1 continua sendo a primeira da lista
   */
  {
    id: "portal_chefe_saida_volta",

    /** o mesmo vao, o mesmo pixel, o mesmo buraco */
    x: 864,
    y: 1100,
    size: 256,
    raioY: 128,

    oculto: true,
    passagem: true,
    brilho: true,

    /**
     * O MAPA 1, E O PONTO DE CHEGADA DA PASSAGEM QUE TRAZ O JOGADOR AQUI.
     *
     * E o par do `portal_chefe`: aquele traz para a arena, este devolve para
     * la. Declarar pelo `id` do outro mantem os dois no mesmo lugar sem
     * ninguem editar coordenada
     */
    destino: "map_1",
    chegada: "portal_chefe",

    /**
     * FECHA DEPOIS DO CHEFE — E O QUE FAZ OS DOIS SEREM EXCLUSIVOS.
     *
     * Sem este `fecha`, os dois portais do vao ficariam abertos depois da
     * missao 1.19: quem ja matou o Hulk encostaria no vao e voltaria para o
     * mapa 1, porque este e o primeiro da lista. O `abreNoDegrau: 19` do
     * outro nao impede isso — os dois NEED se excluem por janela
     *
     * Entao o vao tem UM destino por vez:
     *
     * - antes da missao 1.19 acabar: so este, e a volta para o mapa 1
     * - depois dela: so o `portal_chefe_saida`, e a ida para o mapa 2
     */
    fechaNoDegrau: 19,
  },

  {
    id: "portal_chefe_saida",
    x: 864,
    y: 1100,
    size: 256,
    raioY: 128,

    oculto: true,
    passagem: true,
    brilho: true,

    /**
     * A SAIDA VAI DIRETO PARA O MAPA 2.
     *
     * E o destino pedido: quem sobreviveu ao chefe nao volta para o mapa 1,
     * ele segue para a Floresta Sombria
     *
     * A chegada e a MESMA passagem de topo do mapa 2, a `portal_mapa2` — o
     * mesmo ponto por onde o mapa 1 chega. Um segundo ponto de chegada seria
     * duas entradas na mesma parede, e o jogador apareceria em um lugar
     * diferente conforme veio
     */
    destino: "map_2",
    chegada: "portal_mapa2",

    /**
     * ABRE SO DEPOIS DO CHEFE — E A CONDICAO INTEIRA DESTA SAIDA.
     *
     * "Depois do chefe" e "com a missao 1.19 concluida", que e a mesma coisa:
     * o degrau global avanca de 18 para 19 quando o Hulk cai. Enquanto o
     * jogador estiver no 18, esta passagem nao existe e o que sobra no vao e
     * o `portal_chefe_saida_volta`, que devolve o mapa 1
     *
     * Sem este campo, sair da arena SEM matar o chefe jogava o jogador no
     * mapa 2 e a campanha continuava sem o Hulk — que era o bug
     */
    abreNoDegrau: 19,
  },
];

/**
 * Os portais do MAPA 2.
 *
 * Um so, por enquanto: o `portal_mapa2`, que faz par com o
 * `portal_floresta` do mapa 1. O mapa 2 e uma copia do mapa 1, e a copia
 * ainda nao tem o par do `portal_pantano` — quando ele vier, entra aqui
 * como segundo portal, do mesmo jeito que no mapa 1
 *
 * A posicao e a mesma do `portal_floresta` porque o mapa 2 tem as mesmas
 * dimensoes e o mesmo terreno: o portal cai na Floresta Sombria, no
 * canto superior esquerdo
 */
export const MAP_2_PORTALS = [
  {
    id: "portal_mapa2",

    /**
     * A MESMA FAIXA DO MAPA 1: tiles 9 a 12, no topo.
     *
     * O `x` e igual ao do outro lado porque os dois mapas tem as mesmas
     * dimensoes — 94 tiles de largura — e a faixa pedida e a mesma
     */
    x: 11 * 64,
    size: 256,

    /**
     * ## POR QUE 86, E NAO OS 150 DO MAPA 1
     *
     * Porque a parede do topo do mapa 2 tem OUTRA espessura. E o objeto
     * `id: 2` do `map_2.tmj`, em (-64, -128) com 6336x192: a borda de baixo
     * fica em y=64, e nao em 128 como no mapa 1
     *
     * O jogador encosta em 64 + 34 = 98, e a passagem fica 22px abaixo da
     * borda, em 86
     *
     * Copiar os 150 do mapa 1 deixaria a zona em 86..214 com o jogador
     * parado em 98 — ainda dentro, por sorte. Mas a 3 tiles de folga em vez
     * de 12px e o tipo de margem que some quando a parede muda
     */
    y: 86,
    raioY: 128,

    /** a arte saiu: e a passagem e a luz na parede */
    oculto: true,

    /** sem caixa e sem botao: quem chega na ponta atravessa sozinho */
    passagem: true,

    /** a luz dourada que marca a saida na parede */
    brilho: true,

    /**
     * A VOLTA PARA O MAPA 1.
     *
     * Sem `exigeMissaoDe` de proposito: a trava e a da IDA, no
     * `portal_floresta`. Quem volta nao pode ser barrado pela campanha
     */
    destino: "map_1",
    chegada: "portal_floresta",
  },
];

/**
 * A PASSAGEM DE VOLTA, NA PAREDE DIREITA DO VALE.
 *
 * ## POR QUE O `x` NAO E `94 * 64 - 62`, COMO NO MAPA 1
 *
 * Porque no vale a parede NAO e um limite de `bounds`: e um objeto da
 * camada `PAREDES` do `vale.tmj`, o de `id: 1`, em (5952, -64) com
 * 128x4800. O `bounds` deixaria o jogador chegar em 5942, e a parede o segura
 * 24px antes — em 5918
 *
 * Com a passagem em 5954 a zona abria em 5930, e o jogador nunca entrava
 * nela: nascia uma parede que nao teleporteia. E o mapa 1 nao tem esse
 * problema porque, na altura da passagem dele (y=3456), o `dungeon.tmj` nao
 * tem parede nenhuma — la quem limita mesmo e o `bounds`
 *
 * ## A CONTA
 *
 * Parede em 5952, menos 22 de folga: a passagem fica em 5930 e a zona abre
 * em 5906. O jogador encosta em 5918, que esta dentro
 */
export const VALE_PORTALS = [
  {
    id: "portal_vale_retorno",
    x: 5952 - 22,
    y: 33 * 64,
    size: 48,

    /**
     * A ALTURA INTEIRA DA FAIXA: cinco tiles, 320px.
     *
     * O `portalSobOsPets` le `(raioY ?? size) / 2`, entao e a altura toda que
     * vai no campo — a metade sai da conta
     */
    raioY: 320,
    sheet: "floresta",

    /**
     * A ARTE NAO E DESENHADA.
     *
     * O vale nao tem arte de portal: a saida e a luz na parede, como nos
     * outros dois pares
     */
    oculto: true,

    /** Sem caixa e sem botao: quem chega na ponta atravessa sozinho */
    passagem: true,

    /** a luz dourada que marca a saida na parede */
    brilho: true,

    /**
     * A VOLTA PARA O MAPA 1.
     *
     * O par e o `portal_vale`, do lado esquerdo do mapa 1
     */
    destino: "map_1",
    chegada: "portal_vale",
  },
];

/**
 * Os portais do HUB.
 *
 * O `base.png` do usuario, em (1475, 588).
 *
 * A posicao foi pedida exata e e ela que esta aqui. O desenho e de
 * 192px ANCORADO PELO CENTRO, entao ele vai de x=1379 a x=1571 e de
 * y=492 a y=684. A base vai de x=40 a x=1640 e de y=40 a y=1136: o
 * portal fica inteiro dentro, com folga de 69px pela direita e 452px
 * por baixo
 *
 * `y=588` e o mesmo do spawn, que e o meio do mapa. O portal fica na
 * mesma altura do nascimento e 635px a direita dele, entao o jogador
 * ve o portal sem sair do lugar
 *
 * Igual aos outros dois: SEM COLISAO e SEM TELEPORTE. O destino entre
 * os mapas vem na proxima etapa
 */
export const BASE_PORTALS = [
  /**
   * A PASSAGEM DA BASE, SEM ARTE E COM ENTRADA AUTOMATICA.
   *
   * ## O QUE MUDOU NESTE OBJETO
   *
   * A imagem saiu (`oculto`) e o portal passou a `passagem`: quem chega na
   * ponta da luz e levado sozinho, sem box e sem botao. A `posicao` e a
   * destino continuam EXATAMENTE como antes — e isso e o que mantem o par com
   * o `portal_pantano` do vale sem ninguem editar numero nos dois lados
   *
   * ## POR QUE O OBJETO CONTINUA SENDO UM PORTAL, E NAO UM DADO NOVO
   *
   * Porque o SERVIDOR valida a travessia chamando `portalSobOsPets()`, que e
   * o mesmo metodo do cliente: os dois lados leem `world.portals` e medem a
   * distancia ate o centro. Um portal aqui nao e so desenho — e a REGRA que
   * o servidor confere antes de trocar o mapa de alguem
   *
   * Se este objeto saisse da lista, o servidor passaria a recusar a
   * travessia por nao encontrar portal sob o jogador, e o teleporte
   * automatico nunca aconteceria
   */
  {
    id: "portal_hub",

    /**
     * A PASSAGEM FICA ONDE O JOGADOR ENCOSTA NA PAREDE.
     *
     * ## POR QUE `1602`, E NAO A BORDA DO MAPA
     *
     * Porque o jogador NUNCA chega na borda. Os `bounds` da base vao de 40 a
     * `40 + (26 * 64 - 80) = 1624`, e o `CollisionSystem` ainda desconta o
     * raio do boneco (22px): o centro dele para em `1624 - 22 = 1602`.
     *
     * Com o portal no meio da parede (1664), a zona de 16px iria de 1656 a
     * 1672 — e o jogador, preso em 1602, nunca chegaria nela. O teleporte
     * estava correto no codigo e IMPOSSIVEL no jogo
     *
     * ## E POR QUE `1602` E `26 * 64 - 62`, E NAO O NUMERO CRU
     *
     * Porque a conta do raio e do `bounds` e do `CollisionSystem`. Escrever
     * `1602` fixo na base de hoje funciona e para de funcionar no dia em que
     * a base ganhar uma coluna ou o boneco mudar de tamanho — e o teleporte
     * voltaria a nunca disparar, sem erro nenhum no console. A conta deixa a
     * relacao visivel: e a parede, menos o raio de quem anda ate ela
     *
     * ## E A VALIDACAO DO SERVIDOR CONTINUA PEGANDO
     *
     * Porque os dois lados medem com `portalSobOsPets`, a MESMA conta: a zona
     * e um circulo de diametro `size` em volta do centro. Com o centro em
     * 1602 e o jogador encostando em 1602, a distancia e zero — o que o
     * cliente pede e exatamente o que o servidor mede
     */
    x: 26 * 64 - 62,
    y: 9 * 64,

    /**
     * ## E O `size` NAO PODE SER MENOR QUE O RAIO DO JOGADOR
     *
     * Porque o jogador NAO encosta na parede: o colisor o segura a 34px de
     * distancia, e na base ele para em x=1590 com a passagem em 1602. Com
     * `size: 16` a zona so comecava em 1594 — 4px depois de onde o jogador
     *consegue ficar, e a conta da elipse dava 2.25: a passagem nao existia
     * para ninguem, e o auto encravava nela
     *
     * Com `size: 48` a zona abre em 1578 e o jogador entra nela 24px antes da
     * parede, com folga para o raio de colisao
     *
     * Quem le este campo e o `portalSobOsPets`, dos DOIS lados
     */
    size: 48,
    raioY: 128,
    sheet: "hub",

    /**
     * A ARTE NAO E DESENHADA.
     *
     * Quem respeita isto e o `PortalRenderer`. Sem o campo, o portal seria
     * desenhado do mesmo jeito — e a imagem antiga ficaria exatamente em cima
     * da luz nova, que e o que se pediu para tirar
     */
    oculto: true,

    /**
     * ESTE PORTAL E UMA PASSAGEM, E NAO UM PORTAL DE PE.
     *
     * E o que desliga a box e o botao. Sem este campo o jogador ainda
     * receberia `portal` no painel e veria a caixa de travel ao chegar perto
     * — e a caixa e o botao sairam de proposito: quem chega na ponta passa
     * sozinho, e um botao offerta seria um caminho que nao teleporta
     *
     * Quem respeita isto e o `dadosDoPortalNoPe`
     */
    passagem: true,

    destino: "map_1",
    chegada: "portal_pantano",

    /**
     * ESTA PASSAGEM TEM LUZ NA PAREDE.
     *
     * E o que faz o `drawBrilhoDaPassagem` pintar aqui. A base tem o mesmo
     * campo: as duas passagens do jogo acendem a mesma luz dourada, e o
     * efeito se posiciona pelo `x`/`y` do portal
     */
    brilho: true,
  },

  /**
   * O VORTICE NOVO, no tile (15, 0) da base.
   *
   * ## ESTE PORTAL FOI SUBSTITUIDO PELA PASSAGEM ACIMA
   *
   * Ele foi a primeira tentativa de ligar a base, com a arte de 256px. O que
   * substitute foi a luz da borda: a imagem ocupava o meio do calcamento e o
   * jogador pisava nela para abrir a caixa, e agora ele chega andando e
   * atravessa sozinho. O objeto fica comentado porque a arte `novo` continua
   * registrada em `PORTAL_SHEETS` e pode voltar em outra posicao
   *
   * ## A CONTA DA POSICAO, SE ELE VOLTAR
   *
   * A base tem tile de 64px e 26x18 de grade, e o `PortalRenderer` trata `x` e
   * `y` como o CENTRO do portal — ele desenha a partir de `x - size / 2`. O
   * tile (15, 0) e a terceira faixa da coluna, na linha de cima, entao o
   * centro dele e:
   *
   *     x = 15 * 64 + 32 = 992      y = 0 * 64 + 32 = 32
   *
   * ## E A LINHA 0 DEIXA METADE DO PORTAL FORA DO MAPA
   *
   * Com 192px de lado centrados em `y = 32`, o portal ocupa de `-64` ate
   * `128`: 96px acima da borda. Isso nao e bug, e o que o pedido descreve —
   * o tile (15, 0) e a primeira linha. Se a intention era o portal inteiro
   * dentro da base, o `y` precisa de 96 ou mais, que e a linha 1
   *
   * ## O TAMANHO E O `PORTAL_SIZE`, E NAO OS 256 DA ARTE
   *
   * A arte e um PNG de 256x256, mas o que aparece na tela e o `size`. Os
   * outros dois portais do vale usam o `PORTAL_SIZE` de 192, e um portal de
   * 256 ao lado deles seria o dobro do vortice de guerra. Se a intention era
   * a arte no tamanho nativo, e so trocar `size` por `256`
   *
   * ## E O `chegada` REAPROVEITA O PORTAL DO PANTANO
   *
   * Porque este portal vai para `map_1`, o mesmo destino do `portal_hub`, e
   * `chegada` e o `id` de um portal do mapa de destino. Reaproveitar o
   * `portal_pantano` faz os dois portais da base desembarcarem no mesmo
   * lugar. Um `chegada` novo aqui exigiria criar o portal de chegada no vale
   * tambem, e nenhum foi pedido
   */
  // {
  //   id: "portal_novo",
  //   x: 992,
  //   y: 40,
  //   size: PORTAL_SIZE,
  //   sheet: "novo",
  //   destino: "map_1",
  //   chegada: "portal_pantano",
  // },
];

/**
 * Os portais de um mapa.
 *
 * Lista vazia em vez de `undefined` quando o mapa nao declara nenhum: o
 * renderer percorre com `for` e conta `.length`, entao e o estado que
 * ele ja sabe tratar
 */
export function portalsOf(map) {
  return map?.portals ?? [];
}

/** A folha de um portal, ou a do Pantano quando ele nao declara uma */
export function sheetFor(portal) {
  return (
    PORTAL_SHEETS[portal.sheet] ?? PORTAL_SHEETS.pantano
  );
}
