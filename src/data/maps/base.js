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

export const BASE_WIDTH = 1680;
export const BASE_HEIGHT = 1176;

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
 * O CENTRO do mapa base.
 *
 * `bounds.x + width / 2` da 840, e `width / 2` do mapa inteiro tambem:
 * a margem de 40 e igual dos dois lados, entao os dois centros coincidem
 */
export const BASE_SPAWN = {
  x: Math.round(BASE_BOUNDS.x + BASE_BOUNDS.width / 2),
  y: Math.round(BASE_BOUNDS.y + BASE_BOUNDS.height / 2),
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
   * `1.4286` e `1 / 0.7`, e nao `1.3`. A camera 30% mais perto ve
   * 70% da distancia, e o que cabe na tela e proporcional a distancia:
   * entao ver 70% de antes e multiplicar por `1 / 0.7`
   *
   * E `1.3` seria outra coisa — 30% MAIS ampliado, que corta menos da
   * tela. A diferenca aparece: em 1.43 a area visivel cai 30%, em 1.3
   * cai 23%
   *
   * Isto nao muda o TAMANHO do personagem no mundo. O boneco continua
   * com 128px de largura; ele so ocupa mais espaco na TELA, porque a
   * camera esta mais perto. Reduzir a arte dele encolheria o boneco no
   * mapa e no colisor de clique, que e outra coisa
   *
   * A propriedade e do MAPA porque e uma diferenca de LUGAR: o vale
   * fica no enquadramento de sempre e o hub aperta o enquadramento.
   * Todo mapa que nao declarar nada usa 1
   */
  cameraZoom: 1 / 0.7,


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
