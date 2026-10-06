import { PORTAL_SHEETS } from "../portais/index.js";
import { NPC_SHEETS } from "../npc/sheets.js";

/**
 * A ARENA DO CHEFE: `boss_1`.
 *
 * ## UM CLONE DO HUB, COM TRES DIFERENCAS
 *
 * A planta e a do `base` — 1680x1176, spawn no meio, sem zona e sem
 * prop. Copiar a geometria do hub e nao inventar umaarena nova e o que
 * garante que o jogador veja o mesmo calcamento em que ele nasce, e nao
 * um lugar desconhecido com um chefe nele
 *
 * As tres diferencas, e cada uma por um motivo:
 *
 *   1. **Sem portal.** A arena e um destino, nao uma parada: um portal
 *      aqui ofereceria uma viagem para fora de um lugar que nao tem para
 *      onde ir. Quem traz o jogador para dentro e um portal de outro mapa
 *   2. **Sem mercador.** Um mercado de pocao dentro da arena e uma
 *      compra no meio da briga, e o preco da pocao que salva a vida
 *      decide a luta
 *   3. **O limite e um CIRCULO.** E a diferenca que da o nome ao mapa: a
 *      arena e uma arena, e o limite reto de um retangulo denunciaria o
 *      retangulo
 *
 * ## O PORQUE DO CIRCULO ESTAR EM `boundsCircle`, E NAO EM `bounds`
 *
 * `bounds` e um retangngulo, e tem leitores em tres lugares — o colisor, a
 * grade de navegacao e o teste. Trocar o formato dele obrigaria os tres a
 * mudarem junto, e o `bounds` de todos os outros mapas pararia de
 * funcionar
 *
 * `boundsCircle` e um campo A MAIS, que o colisor usa quando existe. Um
 * mapa sem ele continua exatamente como era — e a arena e o primeiro
 * mapa a declarar
 */
/**
 * O ID DESTA ARENA.
 *
 * Vive no arquivo do mapa, e nao num `const` solto em cada lado, porque
 * TRES lugares precisam do mesmo texto: o registro de mapas, o botao do
 * HUD (para saber se o clique entra ou sai) e o servidor (para saber para
 * onde ir). Com o id escrito em tres lugares, trocar o nome da arena
 * significaria tres mudancas — e um botao apontando para `boss_2` que
 * nao existe e um defeito silencioso, nao um erro
 */
export const BOSS_1_ID = "boss_1";

export const BOSS_1_WIDTH = 1680;
export const BOSS_1_HEIGHT = 1176;

/**
 * O RETANGULO que envolve o circulo.
 *
 * Ele existe porque `bounds` nao pode faltar: a grade de navegacao le
 * `map.width ?? map.bounds.width` para saber o tamanho do mundo, e um
 * `bounds` ausente daria `undefined` la dentro
 *
 * O retangulo e o circumscrevente do circulo: os mesmos 1680x1176 do
 * hub, sem a margem de 40. O circulo e que manda na barreira — este
 * retangulo so existe para os calculos que ainda sao retangulares
 */
export const BOSS_1_BOUNDS = {
  x: 0,
  y: 0,
  width: BOSS_1_WIDTH,
  height: BOSS_1_HEIGHT,
};

/**
 * O CENTRO da arena.
 *
 * E o meio do mapa, que e o meio do retangulo circumscrevente. Um
 * circulo fora do centro deixaria a borda mais perto de um lado que do
 * outro, e o jogador sentiria a arena "torta" sem saber porque
 */
export const BOSS_1_CENTER = {
  x: Math.round(BOSS_1_WIDTH / 2),
  y: Math.round(BOSS_1_HEIGHT / 2),
};

/**
 * O RAIO DA ARENA.
 *
 * E a METADE DA ALTURA, e nao metade da largura: o circulo tem que
 * CABER inteiro na altura do mapa, entao o diametro nao pode passar de
 * 1176. Usar metade da largura daria um circulo de 1680 de diametro, com
 * 252px de cada lado cortados pelo limite retangular do `bounds`
 *
 * Sao 588 de raio num mapa de 1680x1176: sobra uma faixa de calcamento
 * fora do circulo em cima, embaixo e dos lados. E essa faixa que fica
 * morta — o jogador ve o chao alem da barreira e nao consegue chegar
 * ate ele, e e o que faz o limite parecer uma borda e nao um corte seco
 */
export const BOSS_1_RADIUS = Math.round(BOSS_1_HEIGHT / 2);

/**
 * O LIMITE CIRCULAR.
 *
 * `x` e `y` sao o CENTRO, e nao o canto superior esquerdo como no
 * `bounds`. A nomeacao e proposital: um `x` que significa "canto" num
 * objeto e "centro" no outro, no mesmo mapa, seria o tipo de coisa que
 * alguem leria errado daqui a um mes
 */
export const BOSS_1_BOUNDS_CIRCLE = {
  x: BOSS_1_CENTER.x,
  y: BOSS_1_CENTER.y,
  radius: BOSS_1_RADIUS,
};

/**
 * A DISTANCIA DO NASCIMENTO ate o CENTRO.
 *
 * ## POR QUE O JOGADOR NAO NASCE EM CIMA DO CHEFE
 *
 * O clone do hub nasce no meio do mapa, e o meio do mapa e onde o chefe
 * foi pedido. Os dois no mesmo ponto significam que o jogador aparece
 * DENTRO do alcance de golpe de um inimigo de 260 de dano — que e um
 * golpe de morte para qualquer um que ainda nao chegou no fim do mapa 2.
 * A arena virava um lugar onde se entra e se morre, sem ver o chefe
 *
 * ## POR QUE 320, E NAO QUALQUER NUMERO
 *
 * O `aggroRange` do chefe e 520, entao 320 nao o tira da briga: ele vem
 * atras de qualquer passo. O que os 320 compram e o TEMPO — o jogador
 * chega, ve o chefe parado no meio, e decide chegar ou nao. Sem isso a
 * arena nao tem escolha nenhuma, e uma luta que comeca sem o jogador
 * escolher e so um espirito deAccept
 *
 * E o valor cabe folgado dentro do circulo: o nascimento fica a 268px do
 * limite, e o boneco inteiro cabe com folga
 */
export const BOSS_1_DISTANCIA_DO_SPAWN = 320;

/**
 * O PONTO DE NASCIMENTO, abaixo do centro.
 *
 * O jogador chega na arena olhando para o chefe, e nao em cima dele
 */
export const BOSS_1_SPAWN = {
  x: BOSS_1_CENTER.x,
  y: BOSS_1_CENTER.y + BOSS_1_DISTANCIA_DO_SPAWN,
};

/**
 * A ARENA DE CHEFE, pronta para o `setMap`.
 *
 * ## POR QUE O CHAO E `boss` E NAO `cidade`
 *
 * O `groundTile` e a chave que o `TerrainRenderer` le no terreno, e e o
 * que decide a arte do chao. `boss` aponta para a `boss.jpg` de 1600px,
 * que o carregamento reduz para o ladrilho de 128px do resto do jogo
 */
export const BOSS_1_MAP = {
  id: BOSS_1_ID,
  name: "Arena do Chefe",

  width: BOSS_1_WIDTH,
  height: BOSS_1_HEIGHT,

  bounds: BOSS_1_BOUNDS,

  /**
   * A TRAVA CIRCULAR, que e o que o colisor usa no lugar do retangulo.
   *
   * Esta linha e a razao do mapa existir: sem ela a arena seria o hub
   * com outro chao
   */
  boundsCircle: BOSS_1_BOUNDS_CIRCLE,

  /**
   * O FUNDO, so se a folha do chao falhar ao carregar.
   *
   * Um asphalt escuro, como o do hub: o fallback nao pode ser uma mancha
   * de cor que nao existe em lugar nenhum do jogo
   */
  background: "#2b2f33",

  groundTile: "boss",

  spawn: BOSS_1_SPAWN,

  /**
   * A ARENA RECOMECA PELO MEIO, COMO O HUB.
   *
   * `false` significa que a posicao salva do personagem NAO e usada.
   * Numa arena o jogador precisa chegar no meio da briga, e nao onde
   * largou da ultima vez — ele pode ter largado encostado na borda, e
   * voltar para la e comecar a luta a um passo do chefe
   */
  resumeWhereLeftOff: false,

  /**
   * A CAMERA MAIS PERTO, como o hub.
   *
   * Uma arena e um lugar de combate: o jogador precisa ver o chefe e o
   * proprio boneco na mesma tela, e o zoom do hub (1 / 0.7) e o que faz
   * isso
   */
  cameraZoom: 1 / 0.7,

  /**
   * A SEMENTE do sorteio.
   *
   * Igual a do hub, e pelo mesmo motivo: a arena nao tem zona nem prop,
   * entao a semente nao sorteia nada. Ela mora aqui porque e propriedade
   * do mapa, e nao do motor
   */
  seed: 20240518,

  /**
   * A ARENA E DE COMBATE.
   *
   * Antes disso o `emZonaDeCombate` do motor comparava o id do mapa com a
   * string `"base"`, e a arena ja passava por sorte: ela nao se chama
   * `base`. Declarar aqui tira a regra do lugar errado — o hub e o unico
   * mapa sem luta, e isso e propriedade do hub, nao uma lista de
   * excecoes no motor
   */
  combat: true,

  /**
   * O CHEFE, NO CENTRO DA ARENA.
   *
   * ## UM SO, E NO MEIO
   *
   * A arena e circular e o jogador entra pelo meio. O chefe no centro
   * faz a luta comecar no instante em que o jogador aparece na arena, e
   * nao depois de ele andar ate o fundo para descobrir que ha alguem
   * la
   *
   * ## O `bosses` E SEPARADO DAS ZONAS
   *
   * O roster espalha criaturas numa grade dentro de cada zona, e ele foi
   * feito para o campo de mob: sete bichos por zona, todos iguais. Um
   * chefe nao cabe nesse desenho — ele e um, em um ponto. Por isso o
   * mapa tem um campo `bosses` e o motor le os dois
   *
   * E `hulk` porque e o `id` da criatura no catalogo. O `level` nao
   * aparece aqui: o chefe usa o nivel do catalogo, e declarar o nivel
   * no mapa faria o numero ser escalado duas vezes
   */
  bosses: [
    {
      creature: "hulk",
      x: BOSS_1_CENTER.x,
      y: BOSS_1_CENTER.y,
    },
  ],

  /**
   * SEM ZONA, SEM PROP, SEM SOLIDO
   *
   * O clone do hub. A arena nao tem zona de mob — o chefe nao e uma
   * delas, e a `zones: []` e o que mantem o motor sem spawn nenhum
   * alem dele
   */
  zones: [],
  props: [],
  blocking: [],
  decorative: [],
  solids: [],

  /**
   * SEM PORTAL
   *
   * Lista vazia e nao `undefined`, como o resto do mapa. `portalSobOsPes`
   * percorre com `for` e conta `.length`, entao e o estado que ele ja
   * sabe tratar — e, mais importante, e o estado que faz a box do portal
   * NAO aparecer, em vez de aparecer com um botao que nao faz nada
   */
  portals: [],

  /**
   * SEM MERCADOR DE POCAO
   *
   * O hub tem um NPC de pocao em (710, 377). A arena nao: um mercado no
   * meio da briga transforma a luta numa decisao de compra, e o preco da
   * pocao decide o resultado
   */
  npcs: [],
};

/**
 * As folhas que a arena usa.
 *
 * Same shape as do hub e existe pelo mesmo motivo: o registro de mapas
 * declara o que cada mapa depende, e um teste pode conferir que a arena
 * nao aponta para a arte de outro mapa
 */
export const BOSS_1_ASSETS = {
  groundTile: "boss",
  portalSheets: PORTAL_SHEETS,
  npcSheets: NPC_SHEETS,
};
