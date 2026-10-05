/**
 * Os PORTAIS DO MAPA.
 *
 * Os portais do vale e o do hub tem PARA ONDE IR; o da floresta ainda
 * nao. Um portal sem `destino` e um enfeite, e a tela nao oferece nada
 * sobre ele
 *
 * O caminho e de ida e volta entre o hub e o vale:
 *
 *   hub -> portal_pantano -> vale
 *   portal_pantano -> portal_hub -> hub
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
};

/** o lado do portal no mundo, em pixel */
export const PORTAL_SIZE = 192;

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
export const PORTALS = [
  {
    id: "portal_pantano",
    x: 5799,
    y: 3981,
    size: PORTAL_SIZE,
    sheet: "pantano",

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
    x: 178,
    y: 180,
    size: PORTAL_SIZE,
    sheet: "floresta",

    /**
     * O PAR DO MAPA 2.
     *
     * Este e o SEGUNDO portal do mapa 1, e ele vai para o PRIMEIRO
     * portal do mapa 2. Os dois declaram o par pelo `id` do outro: este
     * diz para onde vai e onde chega, e o outro faz o mesmo na volta
     *
     * E a `chegada` e `portal_mapa2`, e nao uma coordenada. Chegar "no
     * portal 1" e chegar "perto do portal 1" sao coisas diferentes: se
     * o portal se mover, o ponto de chegada acompanha sem ninguem editar
     * numero
     *
     * Um `chegada` que nao exista no mapa de destino cai no spawn do
     * mapa — e melhor aparecer no meio do vale do que nao atravessar
     */
    destino: "map_2",
    chegada: "portal_mapa2",
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
    x: 178,
    y: 180,
    size: PORTAL_SIZE,
    sheet: "floresta",

    /**
     * A VOLTA PARA O MAPA 1.
     *
     * E o par do `portal_floresta`: ele traz o jogador para o
     * `portal_mapa2`, e este devolve
     */
    destino: "map_1",
    chegada: "portal_floresta",
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
  {
    id: "portal_hub",
    x: 1475,
    y: 588,
    size: PORTAL_SIZE,
    sheet: "hub",

    /**
     * PARA ONDE ESTE PORTAL VAI.
     *
     * E o unico portal LIGADO por enquanto: o hub sai para o vale. Os
     * dois do vale nao tem destino e por isso nao mostram a box — um
     * portal sem `destino` e um enfeite, e e assim que eles continuam
     *
     * O valor e o `id` de um mapa do registro, e nao um nome. O nome que
     * aparece na box vem de `getMap(destino).name`, para o texto da tela
     * e o mapa do mundo nunca poderem divergir
     */
    destino: "map_1",

    /**
     * ONDE CHEGA, do outro lado.
     *
     * E o `id` de um portal do mapa de destino, e nao uma coordenada.
     * Chegar "no portal 1" e chegar "perto do portal 1" sao coisas
     * diferentes: quando o portal se mover, ou quando outro for ligado
     * no mesmo lugar, o ponto de chegada accompany sem ninguem editar
     * numero nenhum
     *
     * E o primeiro portal do vale, o `portal_pantano`. Sem este campo
     * a chegada seria o spawn do mapa, que e o meio do vale — o jogador
     * atravessaria o portal e apareceria a tres mil pixels dele, sem
     * entender de onde veio
     *
     * Um `chegada` que nao exista no mapa de destino cai no spawn: e
     * melhor aparecer no meio do mapa do que nao atravessar
     */
    chegada: "portal_pantano",
  },
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
