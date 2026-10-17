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
 *
 * ## ONDE A BARREIRA VIVE AGORA
 *
 * A arena **nao tem** barreira em codigo. Ela saiu do `boundsCircle`, e a
 * parede que fecha o combate e desenhada no `boss_1.tmj`, numa camada de
 * objeto chamada `PAREDES` — que o `colisaoTiled` le e o colisor consome
 *
 * ## POR QUE A BARREIRA SAIU DE CODIGO
 *
 * Porque o circulo nao fechava a arena, e o jogador via o motivo. O raio
 * era a METADE DA ALTURA (588) para caber inteiro no mapa, e o mapa e
 * 1680 de largura: sobrava uma faixa de 252px de cada lado onde o jogador
 * via o piso e nao podia chegar. O circulo nao era a arena — era um
 * circulo desenhado DENTRO de um retangulo, e o retangulo aparecia
 *
 * ## POR QUE AS PAREDES VAO NO TILED E NAO EM UM `solids` FIXO
 *
 * Porque `bounds` ja segura o jogador dentro do mundo, e o que faltava era
 * a forma da sala. No Tiled essa forma e desenhada junto com o chao: o que
 * se ve e o que barra saem do mesmo arquivo, entao nao existe parede invisivel
 * nem buraco no chao onde o jogador atravessa
 *
 * E o `boss_1.tmj` e aberto no Tiled de proposito — e para voce montar a sala
 * la, tile por tile
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

/**
 * O TAMANHO DA ARENA, E ELE VEM DO `.tmj`.
 *
 * ## POR QUE SAO 26 E 18, E NAO OS 27 E 19 DO COMECO
 *
 * Porque a arena foi desenhada no Tiled com 26 colunas e 18 linhas de tile
 * de 64 — 1664x1152 — e o `bounds` precisa ser EXATAMENTE o que o tile
 * desenha. Antes ele era 1680x1176, e sobravam 16px a direita e 24px embaixo
 * onde o jogador via o fundo e ainda andava
 *
 * ## POR QUE MULTIPLICAR E NAO ESCREVER O NUMERO
 *
 * Porque o `.tmj` e quem manda, e o `tilewidth` dele e quem diz o tamanho
 * do tile. Se voce resizear a arena no Tiled, aqui e um lugar so a mudar
 *
 * ## E POR QUE O `bounds` PRECISA BATER EXATO
 *
 * Porque ele e o que segura o jogador dentro do mundo. Um `bounds` maior
 * que o piso deixa o boneco andar no vazio; um menor deixa uma faixa de
 * tile morta, que ele ve e nao alcança — que era a metade do defeito do
 * circulo
 */
export const BOSS_1_WIDTH = 26 * 64;
export const BOSS_1_HEIGHT = 18 * 64;

/**
 * O RETANGULO DO MUNDO.
 *
 * ## ELE NAO E A BARREIRA DA ARENA
 *
 * Antes este retangulo era o circumscrevente de um circulo, e a confusao
 * entre os dois era o defeito. Agora ele e so a BORDA DO MAPA: impede que o
 * jogador saia andando para fora do `.tmj` e caia no vazio, e nada mais
 *
 * ## POR QUE ELE NAO PODE FALTAR
 *
 * Porque a grade de navegacao le `map.width ?? map.bounds.width` para saber
 * o tamanho do mundo, e um `bounds` ausente daria `undefined` la dentro
 *
 * A sala em si e desenhada no Tiled. Este retangulo e a unica coisa
 * segurando o jogador no mundo, e ele e o mesmo nos dois modos
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
 * E o meio do mapa. Sem o circulo, ele deixou de ser o circuncentro de uma
 * curva e virou o ponto onde o chefe nasce e de onde o jogador encara a
 * luta — que e a unica coisa que um centro precisa ser aqui
 */
export const BOSS_1_CENTER = {
  x: Math.round(BOSS_1_WIDTH / 2),
  y: Math.round(BOSS_1_HEIGHT / 2),
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
 * E o valor cabe folgado dentro da arena: o nascimento fica bem longe da
 * parede que voce desenhar no Tiled, e o boneco inteiro cabe com folga
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

import { BOSS_1_PORTALS } from "../portais/index.js";

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
   * A SAIDA, NO VAO DA PAREDE DE BAIXO.
   *
   * A arena ficou sem nenhum portal ate agora: o botao da HUD e o `irParaArena`
   * faziam o caminho inteiro. O que fica aqui e a SAIDA, no unico sentido em
   * que o jogador sai da arena andando
   *
   * Nao ha portal de VOLTA porque o jogador nao volta: ele mata o chefe e
   * segue para o mapa 2, e o unico caminho de volta e morrer — que devolve
   * ele ao mapa 1 pelo respawn
   */
  portals: BOSS_1_PORTALS,

  /**
   * SEM `boundsCircle`: A SALA E DESENHADA NO TILED.
   *
   * Este campo era o que desenhava a arena, e ele nao fechava: o circulo de
   * raio 588 deixava 252px de cada lado onde o jogador via o piso e nao
   * podia chegar. A parede que fecha o combate agora e um retangulo seu na
   * camada de objeto `PAREDES` do `boss_1.tmj` — e o `colisaoTiled` le ela
   *
   * Sem este campo, o `CollisionSystem` cai no `bounds`: uma conta por
   * eixo, que e exatamente o que uma sala quadrada precisa
   */

  /**
   * O FUNDO, so se a folha do chao falhar ao carregar.
   *
   * Um asphalt escuro, como o do hub: o fallback nao pode ser uma mancha
   * de cor que nao existe em lugar nenhum do jogo
   */
  background: "#2b2f33",

  groundTile: "boss",

  /**
   * O AR DA ARENA: brasa subindo em um lugar vermelho.
   *
   * E a unica tint quente do jogo que e HOSTIL. O vilarejo tem dourado tambem,
   * e a diferenca esta no peso: 0.18 contra 0.1. O mesmo dourado, mas pesando
   * o dobro na tela, e o jogador le a diferenca antes de ler a cor
   *
   * A vinheta e a mais fechada das cinco. Uma arena e o lugar onde o jogador
   * olha para o centro o tempo todo, e a borda apertada reforca isso
   */
  ambience: {
    tinta: "#c0392b",
    tintaPeso: 0.18,
    vinheta: 0.5,
    vinhetaCor: "#1a0505",
    particula: "brasa",
    quantas: 85,
    nevoa: { topo: 0.22, base: 0.32, cor: "#c08462" },
  },

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
   * proprio boneco na mesma tela, e o zoom do hub e o que faz isso.
   *
   * ## POR QUE `91 / 64` E NAO `1 / 0.7`
   *
   * Pelo mesmo motivo da base: a arena tem tile de 64px, e `64 * (1 / 0.7)`
   * da `91.43` pixels de dispositivo. Um tile terminava sempre entre dois
   * pixels e o chao aparecia com uma grade de linhas, uma por emenda.
   *
   * `91 / 64` da `91` exatos, e o enquadramento muda em `0.47%` do valor
   * antigo — invisivel na tela. E o `dpr` 1 ou 2 mantem o produto inteiro
   * nos dois casos
   */
  cameraZoom: 91 / 64,

/**
   * A ESCALA DESTE MAPA, COM A ARTE NOVA DO SORCERER.
   *
   * ## A CONTA
   *
   * O alvo e o mesmo 67.7px do vale, e a camera da arena tem zoom de 1.43.
   * Com a arte nova o sorcerer sai de `62 * 1.1 = 68.2px`, entao o fator e
   *
   *     67.7 / 68.2 = 0.993
   *
   * E o MESMO numero do vale, e e por isso que os dois foram atualizados
   * juntos: as duas contas comecam no mesmo tamanho alvo, com o mesmo zoom
   * efetivo por causa do `cameraZoom` identico
   *
   * ## E NAO A ESCALA DA CLASSE
   *
   * Porque a base tem a exigencia propria de deixar o sorcerer do mesmo
   * tamanho do arqueiro no hub, e mexer na escala da CLASSE arrastaria a base
   * junto
   */
  escalaSprites: { sorcerer: 0.993 },

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
   * O jogador entra pelo meio. O chefe no centro faz a luta comecar no
   * instante em que o jogador aparece na arena, e nao depois de ele andar
   * ate o fundo para descobrir que ha alguem la
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
   * UM CHEFE POR JOGADOR, E ELE NAO VOLTA.
   *
   * ## POR QUE O CAMPO ESTA AQUI E NAO NA CRIATURA
   *
   * Porque "uma instancia por jogador" e uma propriedade da ARENA. O mesmo
   * `hulk` pode ser um mob comum de um mapa e o guardian de outro, e o
   * catalogo de criaturas nao pode saber disso — o mesmo motivo que fez o
   * `chefe` ser uma propriedade do mapa e nao da criatura
   *
   * ## O QUE ELE FAZ NA PRATICA
   *
   * - o `createBosses` cria o Hulk com o `sessaoDe` de quem entrou, e o id
   *   ganha o sufixo do dono
   * - o snapshot de um jogador nao carrega o chefe do outro
   * - a IA do chefe so persegue o proprio dono
   *
   * E o `marcarChefeVencido` faz a segunda metade: quem ja venceu nao
   * reencontra o Hulk na arena
   */
  bossPorJogador: true,

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
