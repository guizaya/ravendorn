import { BASE_PORTALS, PORTAL_SHEETS } from "../portais/index.js";
import { BASE_NPCS } from "../npc/index.js";
import { NPC_SHEETS } from "../npc/sheets.js";

/**
 * O MAPA BASE: o HUB do jogo.
 *
 * E o mapa que o jogador ve ao clicar em jogar. O Vale de Cinzas — o
 * mapa_1 — continua existindo com as 12 zonas de criatura, mas nao e por
 * onde o jogo comeca
 *
 * O que o diferencia do mapa_1, e por que:
 *
 *   - **28% do tamanho**: 1680x1176 contra 6000x4200. Saiu de 40% e
 *     caiu mais 30%, entao sobraram 70% dos 2400x1680 que eram antes.
 *     Como a leitura e de LADO e nao de area, a AREA e so 7,8% da do
 *     vale: area e o quadrado da medida, e encolher um quadrado encolhe
 *     o quadrado da medida duas vezes
 *   - **Sem zona de criatura nenhuma.** E o hub: nao tem mob, nao tem
 *     spawn de inimigo e nao tem lista de zona. O mapa inteiro e o
 *     calcamento
 *   - **O spawn no centro.** (840, 588), que e o meio do mapa. O
 *     jogador aparece no calcamento, longe de qualquer borda
 *   - **Sem prop e sem portal**, por enquanto. As arvores do vale nao
 *     fazem sentido numa cidade, e o portal entre os mapas vem na
 *     proxima etapa
 */

/**
 * O LADO DO TILE deste mapa, em pixel de mundo.
 *
 * ## POR QUE 64, E O MESMO DO MAPA 1
 *
 * Porque e o ladrilho que o `TerrainRenderer` ja desenha para `grama`, e e o
 * `tilewidth` que o `dungeon.tmj` do vale e o `base.tmj` declaram. Um tile de
 * outro lado aqui faria a grade nao fechar com o chao que o mapa desenha
 *
 * Este numero vem PRIMEIRO porque as medidas do mapa sao multiplos dele: um
 * `const` nao sobe, e usar `BASE_TILE` antes da declaracao derrubaria o
 * modulo na carga
 */
export const BASE_TILE = 64;

/**
 * O TAMANHO DO MAPA BASE, e um multiplo exato do tile.
 *
 * ## POR QUE 1664 x 1152 E NAO 1680 x 1176
 *
 * Porque 1680 / 64 = 26,25 e 1176 / 64 = 18,375. Grade de tile nao fecha em
 * numero quebrado, e o `base.tmj` exportado declara 26 x 18 tiles — que sao
 * exatamente 1664 x 1152 px
 *
 * Este e o mesmo motivo que fez o vale passar de 6000 x 4200 para
 * 6016 x 4224 (`MAP_1_WIDTH` e `MAP_1_HEIGHT`, que fazem `ceil`). Aqui nao
 * houve `ceil`: o mapa foi encolhido 16px na horizontal e 24px na vertical
 *
 * ## E POR QUE ENCOLHER, E NAO CRESCER
 *
 * Porque a base nao tem nada perto da borda: `zones: []`, sem prop, sem
 * portal, e o spawn no meio. O vale cresceu porque as tres zonas da coluna
 * direita terminavam a 5880/5900/5900 — encolher teria cortado conteudo
 */
export const BASE_WIDTH = 26 * BASE_TILE;
export const BASE_HEIGHT = 18 * BASE_TILE;

/**
 * Os limites do mapa base.
 *
 * A margem de 40px e a mesma do vale: e a faixa que o
 * `CollisionSystem` usa para barrar o jogador na beira
 */
export const BASE_BOUNDS = {
  x: 40,
  y: 40,
  width: BASE_WIDTH - 80,
  height: BASE_HEIGHT - 80,
};

/**
 * O TILE ONDE O PERSONAGEM NASCE, e nao o pixel.
 *
 * ## POR QUE ESCREVER O TILE
 *
 * Porque "nasce no tile 1, 9" e um lugar que o autor enxerga no editor, e
 * `x: 96, y: 608` nao diz nada. O mapa base tem 26 x 18 tiles, e o spawn
 * antigo era o CENTRO do mapa — que o Tiled mostra como o tile 13, 9. Mudar
 * so a coluna e o que o jogador pediu, e deixar isso escrito como tile e o que
 * faz a proxima mudanca nao precisar de conta
 *
 * ## E O CENTRO DO TILE, E NAO O CANTO
 *
 * Porque `player.x` e `player.y` sao a posicao dos PES do boneco. No canto do
 * tile (64, 576) o boneco ficaria em cima da divisao com o tile de cima e o da
 * esquerda, e o jogador veria o personagem "dentro da parede" por causa de
 * 32px
 *
 * ## POR QUE NAO E O CANTO, E POR QUE TAMBEM NAO E O CENTRO DO MAPA
 *
 * O centro era o padrao porque nao ha obstaculo no hub: qualquer ponto do
 * calcamento serve. O tile 1, 9 e perto da borda esquerda, e por isso vale o
 * `BASE_BOUNDS` continuar mandando: um spawn perto demais da beira faria o
 * jogador nascer encostado na parede invisivel dos 40px
 */
const BASE_SPAWN_TILE = { x: 1, y: 9 };

export const BASE_SPAWN = {
  x: BASE_SPAWN_TILE.x * BASE_TILE + BASE_TILE / 2,
  y: BASE_SPAWN_TILE.y * BASE_TILE + BASE_TILE / 2,
};

/**
 * O mapa base, pronto para o `setMap`.
 *
 * `groundTile: "cidade"` e o que faz o `TerrainRenderer` ladrilhar o
 * calcamento em vez da grama. `zones: []` e o que mantem o motor sem
 * nenhuma lista de area para percorrer
 */
export const BASE_MAP = {
  id: "base",
  name: "Base",

  width: BASE_WIDTH,
  height: BASE_HEIGHT,

  /**
   * O LADO DO TILE, declarado no mapa.
   *
   * E o `tileSize` que o `registroDeTiles` e o `colisaoTiled` leem para
   * fechar a conta de pixel para tile. Hoje o `.tmj` da base ainda nao
   * existe, entao este campo e o que vai ser conferido contra ele quando
   * entrar — e o `dungeon.tmj` do vale declara 64, o mesmo numero
   */
  tileSize: BASE_TILE,

  bounds: BASE_BOUNDS,

  /**
   * A cor de fundo so aparece se a folha do chao falhar ao carregar: o
   * `drawMap` pinta a tela com ela antes de o terreno entrar. E um
   * asfalto escuro, para o fallback nao ser um retangulo verde
   */
  background: "#2b2f33",

  /**
   * O CALCAMENTO DE FILL.
   *
   * A chave que o `groundTileFor` le no terreno. E o que faz o mapa base
   * ladrilhar o chao de cidade em vez da grama do vale
   */
  groundTile: "cidade",

  /**
   * O AR DO VILAREJO: uma tarde que esta acabando.
   *
   * A base e o unico lugar quente do jogo, e e de proposito que a tint seja
   * dourada: os outros mapas sao frios ou hostis, e e o contraste que faz o
   * hub ser o lugar de descanso
   *
   * A `faisca` e a unica particula que sobe E pisca forte, e ela existe para
   * parecer brasa de fogueira e de lanterna. A vinheta e a mais fraca das
   * cinco: um lugar seguro nao aperta a borda da tela
   */
  ambience: {
    tinta: "#e8a94f",
    tintaPeso: 0.1,
    vinheta: 0.26,
    vinhetaCor: "#120b06",
    particula: "faisca",
    quantas: 38,

    /**
     * O AR E DA VILA INTEIRA, E NAO DA TELA.
     *
     * A base cabe num olhar: 1664x1152, e o que a tela mostra sao uns
     * 992x558. As pontas do lugar estao ali na tela mesmo quando o jogador
     * esta no meio — e o spawn e sempre no meio
     *
     * Seguindo a camera, o ar se amontoava no centro da praca e as bordas da
     * vila ficavam limpas. Com o campo no mapa, a faisca cobre tambem o
     * que da para ver sem chegar perto
     */
    campo: "mapa",
    nevoa: { topo: 0.14, base: 0.2, cor: "#c9b89c" },
  },

  spawn: BASE_SPAWN,

  /**
   * O HUB RECOMECA PELO MEIO, SEMPRE.
   *
   * `false` aqui quer dizer: a posicao salva do personagem NAO e usada
   * ao entrar neste mapa. Quem clica em jogar aparece no centro do
   * calcamento, toda vez
   *
   * Sem esta flag o save wins, e o limite nao segura: o clamp so joga
   * no spawn quando a posicao esta FORA do mapa, e uma posicao antiga
   * de (1200, 800) cabe folgada na base, que vai de 40 a 1640. O
   * jogador voltava para onde tinha largado — as vezes no meio, as vezes
   * encostado numa parede, sem nenhuma relacao com o centro
   *
   * E o que distingue um hub de um mapa de exploracao: no vale se
   * continua de onde se parou, porque foi la para andar
   */
  resumeWhereLeftOff: false,

/**
   * A CAMERA MAIS PERTO, NESTE MAPA.
   *
   * `103 / 64` e `1.609375`, e nao `1 / 0.62`.
   *
   * O valor antigo era `1 / 0.62` (1.6129), escolhido para a camera ver 62%
   * da distancia. Ele foi trocado por este porque a base usa TILE DE 64PX, e
   * `64 * 1.6129` da `103.226` pixels de dispositivo: um tile terminava
   * sempre entre dois pixels e o mapa inteiro aparecia com uma GRADE de
   * linhas, uma por emenda de tile, andando junto com a camera.
   *
   * ## POR QUE `103 / 64` E NAO UM NUMERO ARREDONDADO
   *
   * Porque o que precisa fechar e `64 * zoom`: aqui da `103` exatos, e cada
   * tile ocupa um numero inteiro de pixels de dispositivo. Como a base roda
   * com `dpr` 1 ou 2, `103 * dpr` continua inteiro nos dois casos.
   *
   * ## E A VISIVELMENTE O MESMO ENQUADRAMENTO
   *
   * A diferenca para o valor antigo e de `0.22%` — a area visivel muda de
   * 38% para 38.08% de reducao. Ninguem distingue isso na tela, e em troca
   * a grade de linhas some. `104 / 64` (1.625) tambem fecharia, mas erra
   * `0.75%`, quase quatro vezes mais, sem trazer nenhuma vantagem
   */
  cameraZoom: 103 / 64,

  /**
   * AS DUAS CLASSES GRANDES DESTA MAPA, REDUZIDAS.
   *
   * ## POR QUE SO ESTAS DUAS E SO AQUI
   *
   * Porque a base tem `cameraZoom` de `1 / 0.62`, que e 1.61: o boneco e o
   * resto do hub sao desenhados 61% MAIORES que no vale. O arqueiro e o
   * sorcerer tem arte grande — 62.7px e 68.2px em unidades de mundo — entao
   * sem um fator aqui os dois ocupariam uma fatia grande demais da tela do hub
   *
   * ## E POR QUE OS DOIS FATORES SAO DIFERENTES
   *
   * Porque as DUAS ARTES mudaram e nao pelo mesmo tamanho. O arqueiro
   * continua com a arte de antes (57px de boneco x 1.1 = 62.7px), e o
   * sorcerer recebeu a arte nova, que e 62px de boneco na caminhada x 1.1 =
   * 68.2px
   *
   * Antes os dois mediam 62.7px e um fator unico os igualava. Agora o
   * sorcerer e 9% maior, e manter o mesmo 0.7 o deixaria visivelmente maior
   * que o arqueiro dentro do mesmo hub — que e o oposto do que o fator
   * existe para fazer
   *
   * A conta do sorcerer: o alvo e o mesmo 43.9px do arqueiro na base
   * (62.7 x 0.7), entao 43.9 / 68.2 = 0.644
   *
   * ## E POR QUE UM FATOR E NAO UM `scale` NOVO
   *
   * Porque o `scale` da definicao e o tamanho do PERSONAGEM, e ele e o mesmo
   * em todos os mapas. Este e um FATOR do LUGAR, e o motor multiplica um pelo
   * outro no desenho. Trocar o `scale` da definicao aqui mexeria no vale
   * tambem, que e o oposto do pedido
   *
   * ## E OS OUTROS MAPAS
   *
   * Nenhum precisa de fator. No vale e no mapa 2 o zoom e 1 e as duas ja
   * saem iguais; no boss 1 o zoom e 1.43 e continua igual
   *
   * Todo mapa que nao declarar isto usa 1
   */
  escalaSprites: { arbalist: 0.7, sorcerer: 0.644, warrior: 0.7 },


/**
   * O HUB NAO E DE COMBATE.
   *
   * O `emZonaDeCombate` do motor lia `map.id !== "base"` antes, e so
   * este `false` e o que mantem o portal do hub sem briga: e o unico mapa
   * do jogo onde nao se bate em nada
   *
   * Declarar aqui tira a regra do lugar errado. Com o id no motor, um
   * mapa novo — uma arena, um bosses, um evento — era de combate por
   * acidente, e o jeito de um mapa nao ter briga era ter o nome certo
   */
  combat: false,

  /**
   * A SEMENTE do sorteio deste mapa.
   *
   * O vale usa a dela para espalhar criaturas e arvores. O hub nao tem
   * zona nem prop, entao a semente nao sorteia nada por enquanto — mas
   * ela mora AQUI, e nao dentro do motor, porque e propriedade do mapa.
   * O motor le `map.seed` e nao sabe de onde veio
   */
  seed: 20240517,

  /**
   * O HUB NAO TEM ZONA
   *
   * Lista vazia, e nao `undefined`: o motor percorre com `for` e conta
   * `.length`, entao e o estado que ele ja sabe tratar
   */
  zones: [],

  /**
   * Sem arvore
   *
   * As arvores do vale sao arte pintada e nao fazem sentido num
   * calcamento. Um hub com arvore parece um mapa de teste com grama
   */
  props: [],
  blocking: [],
  decorative: [],
  solids: [],

  /**
   * O PORTAL DO HUB, em (1475, 588)
   *
   * Vem do catalogo de portais e nao e montado aqui: e um enfeite com
   * posicao pedida. `BASE_PORTALS` e uma lista separada da `PORTALS` do
   * vale porque as duas sao de mapas diferentes — cada mapa declara o
   * seu, e o registro decide qual entra
   *
   * Nao entra em `solids`: o portal e decorativo e nao barra passagem
   */
  portals: BASE_PORTALS,

  /**
   * O MERCADOR DO HUB, em (710, 377)
   *
   * Lista vazia de props, lista com um item de NPC. A diferenca nao e
   * decorativa: um prop e enfeite e nao reage a clique, e um NPC reage
   * a clique abrindo painel. Colocar o mercador em `props` faria ele
   * parecer parte do cenario e o clique passaria direto
   *
   * Vem do catalogo de NPCs, e nao e montado aqui: e um enfeite com
   * posicao pedida, e `BASE_NPCS` fica separado pelo mesmo motivo que
   * `BASE_PORTALS` — cada mapa declara os seus
   */
  npcs: BASE_NPCS,
};

/**
 * As folhas que o mapa base usa.
 *
 * Existe para o registro de mapas poder declarar o que cada mapa
 * depende, e para o teste garantir que o hub nao aponta para uma arte de
 * outro mapa
 */
export const BASE_ASSETS = {
  groundTile: "cidade",
  portalSheets: PORTAL_SHEETS,
  npcSheets: NPC_SHEETS,
};
