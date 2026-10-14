/**
 * O LAYOUT dos sprites, sem imagem nenhuma.
 *
 * Frame, ancora, escala e as linhas de animacao sao so numeros.
 * Ninguem no servidor precisa dos pixels, mas o motor e
 * importado por ele e o `import x from "a.png"` no topo do
 * modulo antigo quebrava o `node server/src/index.js`
 * (ERR_UNKNOWN_FILE_EXTENSION) antes de o servidor subir.
 *
 * A URL da imagem entra em `src/data/sprites/index.js`, que so o
 * cliente importa. Aqui o `src` fica `null`, e o motor cai no
 * desenho vetorial, que ele ja sabia fazer.
 */

const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;
const ANCHOR_X = 16;
const ANCHOR_Y = 27;
const SCALE = 2;
const FOOT_OFFSET = 12;

const DIRECTIONAL_FRAME_WIDTH = 64;
const DIRECTIONAL_FRAME_HEIGHT = 64;
const DIRECTIONAL_ANCHOR_X = 32;
const DIRECTIONAL_ANCHOR_Y = 54;
const DIRECTIONAL_SCALE = 0.8;
const DIRECTIONAL_FALLBACK = "south";

const DIRECTIONAL_WALK_BOB = {
  amplitude: 4,
  frequency: 1.5,
};

/**
 * As medidas do ARBALIST, medidas na folha gerada.
 *
 * `celula`, `ANCORA` e as contagens sao a saida de
 * `node tools/gif-to-sheet.mjs arbalist`. A arte foi trocada DUAS vezes e
 * os numeros mudaram duas vezes:
 *
 * - o idle foi de 7 para **8** quadros. O gif trouxe um quadro a mais, e
 *   o `length: 7` antigo deixaria o ultimo frame fora do balanco parado
 * - a celula foi de 64 para **84**: a arte nova tem 84x84 em todas as 17
 *   lanes. E o numero mais importante dos tres — sem ele o
 *   `resolveFrameRect` le um pedaco de 64x64 de cada quadro de 84 e o
 *   boneco sai cortado
 * - a ancora foi de (32, 54) para (31.5, 51) e depois para
 *   **(41.5, 68)**: o pe da arte nova esta 20px mais baixo na celula,
 *   porque a celula tambem cresceu. Sem isto o arquiro andaria 17px
 *   dentro do chao em todas as direcoes — um erro grande e bem visivel,
 *   que faz o personagem parecer estar enterrado em vez de pisando
 *
 * ## ESTES NUMEROS ESTAO DUPLICADOS EM `index.js`
 *
 * O `ARBALIST_SPRITE` deste arquivo (sem imagem, para o servidor) e o de
 * `index.js` (com imagem, para o cliente) declaram os mesmos numeros, e
 * a duplicacao vem de antes desta conversa. Trocar a arte exige mexer
 * nos dois, e esquecer um deles deixa o cliente e o servidor discordando
 * sobre onde fica o pe do arquiro
 *
 * A ancora e declarada POR FOLHA, e nao no padrao compartilhado, pelo
 * mesmo motivo que o guerreiro tem a dele: cada celula tem a sua, e
 * `DIRECTIONAL_ANCHOR_Y` e o do arquiro ANTIGO
 */
const ARBALIST_FRAME_SIZE = 96;

/**
 * A ANCORA, regerada com a arte nova.
 *
 * Antes: `47.5` e `77`. Agora `48` e `75`, que sao os numeros que o
 * `gif-to-sheet.mjs` mediu e imprimiu na ultima geracao da folha.
 *
 * O `anchorY` e o que decide a ALTURA do boneco no chao. Caiu 2px porque o
 * `alignAnchors` mede a MEDIANA do pe de cada lane, e a arte nova tem o
 * pes 2px mais alto na celula de 96. Deixar em 77 punha o arquiro 2px
 * dentro do chao em todas as direcoes
 *
 * O `anchorX` subiu meia unidade porque o desenho novo esta meio pixel a
 * mais para a direita: o `alignAnchors` alinha o CENTRO do corpo pela
 * mediana, e a mediana das oito lanes mudou
 */
const ARBALIST_ANCHOR_X = 48;
const ARBALIST_ANCHOR_Y = 75;
const ARBALIST_COLUMNS = 9;

/**
 * O TAMANHO DEPOIS DE DOIS PEDIDOS DE DIMINUICAO.
 *
 * A celula do arquiro subiu de 84 para 96 quando a arte foi regerada. Depois
 * veio o pedido de dobrar, que foi para 1.4, e depois dois pedidos de diminuir:
 * 20%, que deu `1.4 * 0.8 = 1.12`, e agora 15%, que da `1.12 * 0.85 = 0.952`
 *
 * Cada "diminuir X%" e lido como X% do valor ATUAL, e nao como X pontos
 * percentuais. Sao numeros diferentes: 15 pontos tiraria 0.15 e deixaria 0.97
 *
 * ## ONDE ESTE NUMERO TERMINA
 *
 * O guerreiro, o lancer e o sorcerer continuam em `DIRECTIONAL_SCALE`, que e
 * 0.8 sobre celula de 68, o que da 54px na tela. O arquiro em 0.952 da
 * `96 * 0.952 = 91`px, ou seja, 1.69x os outros tres
 *
 * Para o arquiro ter exatamente o mesmo tamanho deles, este numero seria
 * 0.56 — e nao 0.952
 */
const ARBALIST_SCALE = 0.952;

const ARBALIST_FRAMES = 8;

/**
 * O IDLE PASSOU DE 8 PARA 9 QUADROS.
 *
 * A arte nova de `idle/` tem nove quadros em todas as oito direcoes. Com o
 * `length` em 8, o nono quadro nao existia no ciclo: o arquiro ia perder a
 * volta final da respiracao, e o `rowOffset` continuaria correto — o
 * defeito apareceria so como uma animacao que "nao fecha"
 *
 * O `shoot` do norte veio com onze quadros e foi cortado para 9 pelo
 * `normalizarFrames`, que corta no MENOR do grupo. E o que mantem o ritmo
 * do golpe igual em todas as direcoes
 */
const ARBALIST_IDLE_FRAMES = 9;

/**
 * O IDLE E POR DIRECAO, entao a linha e um DESLOCAMENTO.
 *
 * A pasta `idle/` do arquiro tem um gif para cada um dos oito angulos, igual
 * a `walk/`. Antes era um `idle.gif` unico, lido por `row` fixo; agora cada
 * angulo ocupa a sua linha e o layout aponta com `rowOffset`
 *
 * Sao dois jeitos diferentes de apontar a mesma folha, e trocar um pelo
 * outro sem trocar o outro mostra o boneco parado com o angulo errado
 */
const ARBALIST_IDLE_ROW_OFFSET = 8;

const ARBALIST_SHOOT_FRAMES = 9;
const ARBALIST_SHOOT_ROW = 16;

/**
 * A MINERACAO PASSOU A SER POR DIRECAO, entao a linha e um DESLOCAMENTO.
 *
 * ## O QUE MUDOU
 *
 * Antes: uma lane so, na linha 24, lida por `row`. A arte tinha vindo so do
 * sul — o arquiro mina virado para a pedra — entao nao havia oito angulos
 *
 * Agora a pasta `mining/` tem um gif para cada um dos oito angulos, e o
 * ciclo e lido por `rowOffset`, como o `idle` e o `shoot`: a linha do
 * angulo e a linha do ciclo MAIS o deslocamento da direcao
 *
 * ## POR QUE ISTO E VISIVEL, E NAO UM DETALHE
 *
 * O jogador chega na pedra de qualquer lado, e a picareta e a mao que ele
 * esta olhando. Com `row: 24` fixo, quem estava de norte socava para BAIXO
 * — o angulo errado na acao que mais se nota na tela
 *
 * A folha foi de 25 para 32 linhas: as sete novas sao as direcoes que
 * entraram depois do sul
 *
 * ## POR QUE NAO E SO TROCAR `row` POR `rowOffset`
 *
 * Porque `rowOffset` sem as oito linhas na folha aponta para o tiro (16..23)
 * ou para fora. O mesmo cuidado do `idle`, que nunca foi `row` fixo
 */
const ARBALIST_MINING_ROW_OFFSET = 24;

/**
 * OS QUADROS E O RITMO DA PICARETA.
 *
 * O `fps` e o ritmo da picareta: 9 quadros a 10 por segundo da um ciclo de
 * 0.9s, perto do vao entre batidas que o painel de mineracao mostra. O
 * ciclo e em LOOP, e e o que segura enquanto o jogador esta na pedra
 */
const ARBALIST_MINING_FRAMES = 9;
const ARBALIST_MINING_FPS = 10;

const ARBALIST_WALK_FPS = 12;
const ARBALIST_IDLE_FPS = 5;
const ARBALIST_SHOOT_FPS = 20;

/**
 * As medidas do guerreiro, todas medidas na folha gerada.
 *
 * `celula`, `ANCORAS` e as contagens sao a saida de
 * `node tools/gif-to-sheet.mjs warrior`. A celula de 68px e a
 * diferenca que importa: enquanto o arquiro e 64, o guerreiro
 * desenha 4px maior em cada dimensao na tela
 */
/**
 * AS MEDIDAS DA ARTE NOVA, impressas pelo `gif-to-sheet`.
 *
 * ## A CELULA SUBIU DE 68 PARA 96
 *
 * Porque a arte nova e maior: `idle` e `walk` medem 88x88, `mining` e `attack`
 * medem 92x92, e duas diagonais do idle medem 84x84. Numa celula de 68 a arte
 * seria cortada
 *
 * E 96, e nao 92, pelo mesmo motivo do arquiro: `attack/north` tem um quadro
 * que ENCOSTA na propria borda, e a ferramenta recusa a folha sem 2px de
 * folga. Os 4 pixels que sobram entram preenchidos de transparente
 *
 * ## A ANCORA, REGERADA
 *
 * Antes `(34, 55)`. Agora `(48, 76)`, que e a saida do `gif-to-sheet`: o
 * `alignAnchors` mede a MEDIANA do pe de cada lane, e o pe da arte nova esta
 * 20px mais baixo numa celula 28px maior. Deixar em 55 punha o guerreiro 21px
 * dentro do chao em todas as direcoes
 *
 * ## E A ESCALA, QUE AGORA E A DO ARQUIRO
 *
 * A arte nova e do mesmo tamanho em tela que a do arquiro, entao o
 * guerreiro passou a usar a MESMA escala que o arquiro tem no `index.js`, a
 * 1.1 — e nao o `ARBALIST_SCALE` de 0.952 deste arquivo, que e numero velho
 * do arquiro: o `index.js` sobrescreve a escala ao montar o sprite final, e
 * quem manda no tamanho na tela e o `index.js`, nao esta constante
 *
 * Com celula de 96 e escala de 1.1, os dois bonecos medem 105.6px na tela —
 * iguais
 */
const WARRIOR_FRAME_SIZE = 96;
const WARRIOR_ANCHOR_X = 47;
const WARRIOR_ANCHOR_Y = 77;
const WARRIOR_WALK_FRAMES = 8;
const WARRIOR_IDLE_FRAMES = 8;
const WARRIOR_IDLE_ROW_OFFSET = 8;
const WARRIOR_ATTACK_FRAMES = 9;
const WARRIOR_ATTACK_ROW = 16;
const WARRIOR_MINING_FRAMES = 9;
const WARRIOR_MINING_ROW_OFFSET = 24;
const WARRIOR_WALK_FPS = 12;
const WARRIOR_IDLE_FPS = 5;
const WARRIOR_ATTACK_FPS = 18;
const WARRIOR_MINING_FPS = 10;

/**
 * A geometria do guerreiro, para o `./index.js` montar a versao com
 * imagem.
 *
 * O `layout.js` e o `index.js` declaram o MESMO sprite duas vezes: o
 * primeiro sem `src`, para o servidor que nao tem pixels, e o segundo
 * com a URL, para o cliente. As medidas da celula e da ancora saem
 * daqui, para os dois lados nao poderem divergir: se o cliente
 * achasse que a celula tem 64 e o PNG foi gerado com 68, cada
 * `drawImage` recorta um pedaco do personagem e desloca a linha, e
 * nada no console reclama
 */
export const WARRIOR_GEOMETRY = {
  frameWidth: WARRIOR_FRAME_SIZE,
  frameHeight: WARRIOR_FRAME_SIZE,
  anchorX: WARRIOR_ANCHOR_X,
  anchorY: WARRIOR_ANCHOR_Y,

  /**
   * A ESCALA FINAL, E NAO A 0.952 DO ARQUIRO.
   *
   * Este arquivo e a copia que o SERVIDOR usa, e ele nao desenha: o
   * `index.js` monta o sprite final do cliente e sobrescreve a escala com a
   * 1.1 do arquiro. Aqui a 0.952 ficaria a copia do servidor discordando da
   * do cliente, que e o que o comentario do `index.js` avisa sobre o arquiro
   */
  scale: 1.1,
};

/**
 * A URL de uma imagem que o servidor nao tem.
 *
 * O motor usa este valor para saber que nao ha o que desenhar e
 * cair no corpo vetorial, em vez de tentar abrir uma imagem.
 */
export const SEM_IMAGEM = null;

export const SPRITE_FORMAT = {
  SHEET: "sheet",
  DIRECTIONAL: "directional",
};

export const DIRECTIONAL_DIRECTIONS = {
  east: 0,
  "south-east": 1,
  south: 2,
  "south-west": 3,
  west: 4,
  "north-west": 5,
  north: 6,
  "north-east": 7,
};

/**
 * O mesmo mapa, com o nome da primeira classe que o usou.
 *
 * Nao e um mapa do arquiro: e a ORDEM das linhas que
 * `tools/gif-to-sheet.mjs` grava em toda folha direcional, e vale
 * para qualquer uma. O nome antigo continua exportado porque
 * `enemyLayout.js` e os testes importam por ele
 */
export const ARBALIST_DIRECTIONS = DIRECTIONAL_DIRECTIONS;

export const WARRIOR_DIRECTIONS = DIRECTIONAL_DIRECTIONS;

export const SORCERER_DIRECTIONS = DIRECTIONAL_DIRECTIONS;

export const LANCER_DIRECTIONS = DIRECTIONAL_DIRECTIONS;

export function createSpriteDefinition(id, src) {
  return {
    id,
    format: SPRITE_FORMAT.SHEET,
    src,
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    anchorX: ANCHOR_X,
    anchorY: ANCHOR_Y,
    scale: SCALE,
    footOffset: FOOT_OFFSET,
    directions: {
      down: 0,
      up: 1,
      side: 2,
    },
    animations: {
      idle: { start: 0, length: 2, fps: 2.5 },
      walk: { start: 2, length: 4, fps: 9 },
      attack: { start: 6, length: 3, fps: 14 },
    },
  };
}

export function createDirectionalSpriteDefinition(
  id,
  src,
  {
    directions,
    animations,
    fallbackDirection = DIRECTIONAL_FALLBACK,
    walkBob = null,

    /**
     * As medidas da celula e da ancora.
     *
     * O padrao (64x64, ancora 32/54) e o do arquiro, que foi a
     * primeira classe convertida. O guerreiro entrou depois com arte
     * de origem de 68x68 e a ancora que a propria folha mediu, entao
     * a celula passou a ser declarada por folha
     *
     * Sem isso, `anchorY` fixo colocaria o guerreiro 1px fora do
     * chao em relacao ao arquiro — a ancora e o que amarra a arte ao
     * ponto do personagem, e cada celula tem a sua
     */
    frameWidth = DIRECTIONAL_FRAME_WIDTH,
    frameHeight = DIRECTIONAL_FRAME_HEIGHT,
    anchorX = DIRECTIONAL_ANCHOR_X,
    anchorY = DIRECTIONAL_ANCHOR_Y,
    scale = DIRECTIONAL_SCALE,

    /**
     * A caixa que o DESENHO ocupa dentro da celula, em px.
     *
     * A celula e quadrada e o personagem nao a preenche: o
     * arquiro ocupa 30x44 dentro dos 64x64, com 17px de margem
     * transparente de cada lado. Num retrato, centralizar a CELULA
     * centraliza a margem, e nao o personagem — a arte sai pequena e
     * levemente alta
     *
     * Quem preenche o espaco do retrato e o CHAMADOR: o motor
     * desenha a celula inteira, porque em jogo a posicao do corpo
     * e o que importa. O recorte e para o retrato, e a medicao
     * abaixo foi tirada do PNG
     */
    contentBox = null,
  },
) {
  return {
    id,
    format: SPRITE_FORMAT.DIRECTIONAL,
    src,
    fallbackDirection,
    frameWidth,
    frameHeight,
    anchorX,
    anchorY,
    scale,
    footOffset: FOOT_OFFSET,
    contentBox: contentBox ? { ...contentBox } : null,
    directions: { ...directions },
    walkBob: walkBob ? { ...walkBob } : null,
    animations: Object.fromEntries(
      Object.entries(animations).map(([name, animation]) => [
        name,
        { ...animation },
      ]),
    ),
  };
}

export const ARBALIST_SPRITE = createDirectionalSpriteDefinition(
  "arbalist",
  SEM_IMAGEM,
  {
    directions: ARBALIST_DIRECTIONS,

    frameWidth: ARBALIST_FRAME_SIZE,
    frameHeight: ARBALIST_FRAME_SIZE,
    anchorX: ARBALIST_ANCHOR_X,
    anchorY: ARBALIST_ANCHOR_Y,
    scale: ARBALIST_SCALE,

    walkBob: DIRECTIONAL_WALK_BOB,

    animations: {
      idle: {
        rowOffset: ARBALIST_IDLE_ROW_OFFSET,
        start: 0,
        length: ARBALIST_IDLE_FRAMES,
        fps: ARBALIST_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: ARBALIST_FRAMES,
        fps: ARBALIST_WALK_FPS,
      },

      attack: {
        rowOffset: ARBALIST_SHOOT_ROW,
        start: 0,
        length: ARBALIST_SHOOT_FRAMES,
        fps: ARBALIST_SHOOT_FPS,
        needsTarget: true,
      },

      /**
       * A PICARETA, EM LOOP, E POR DIRECAO.
       *
       * ## POR QUE `rowOffset`, E NAO `row` FIXO
       *
       * Era uma linha so na 24, lida por `row`: a arte tinha vindo so do
       * sul. Agora sao oito angulos, e o ciclo segue o angulo em que o
       * jogador chegou na pedra — quem esta de norte soca para o norte
       *
       * Sem `holdLast`: o bloco e o que segura a animacao no ULTIMO quadro,
       * e ele e da MORTE. Aplicado aqui, o arquiro socaria uma vez e
       * ficaria com a picareta no chao ate parar de minerar
       *
       * Sem `needsTarget`: `needsTarget` e o que trava arte de tiro, e o
       * alvo do arquiro e um INIMIGO. A mineracao nao tem alvo — tem uma
       * pedra, que e um objeto do mapa, nao alguem que possa morrer. Com a
       * flag aqui o ciclo nunca entraria
       */
      mining: {
        rowOffset: ARBALIST_MINING_ROW_OFFSET,
        start: 0,
        length: ARBALIST_MINING_FRAMES,
        fps: ARBALIST_MINING_FPS,
      },
    },
  },
);

/**
 * O guerreiro, a partir da arte de `assets/sprites/warrior/`.
 *
 * Os numeros sao a saida de `node tools/gif-to-sheet.mjs warrior`, e
 * a folha tem 32 linhas: 8 de caminhada, 8 de idle, 8 de golpe e 8 de
 * picareta — quatro animacoes por direcao, todas com os oito angulos
 *
 * ## A MESMA CELULA E A MESMA ESCALA DO ARQUIRO
 *
 * Antes a celula dele era de 68 e a escala de `DIRECTIONAL_SCALE`, que dava
 * 54px na tela — o arquiro, com celula de 96 e escala de 0.952, dava 91px, e
 * o guerreiro saia 1.7x menor que o arquiro ao lado
 *
 * Agora os dois saem de 96 com 0.952 e medem os mesmos 91.4px. E a arte do
 * guerreiro nao foi encolhida para isso: a celula subiu para caber nela, e
 * o `gif-to-sheet` mede a ancora de cada celula justamente para a arte nao
 * precisar ser encolhida nem cortada
 *
 * ## E O IDLE PASSOU A SER POR DIRECAO
 *
 * Era um gif unico na raiz, chamado `indle.gif`. Agora sao oito gifs em
 * `idle/`, um por angulo — igual ao arquiro. Por isso o idle usa
 * `rowOffset` e nao `row`: o retrato dele tambem precisa seguir o angulo em
 * que o boneco esta virado
 *
 * O golpe dele NAO precisa de alvo: e um `./target`, nao um tiro, e
 * qualquer golpe basico de corpo a corpo tem animacao. O
 * `needsTarget` do arquiro existe porque o arco dele so existe
 * apontado para alguma coisa
 */
export const WARRIOR_SPRITE = createDirectionalSpriteDefinition(
  "warrior",
  SEM_IMAGEM,
  {
    directions: WARRIOR_DIRECTIONS,

    ...WARRIOR_GEOMETRY,

    walkBob: DIRECTIONAL_WALK_BOB,

    animations: {
      idle: {
        rowOffset: WARRIOR_IDLE_ROW_OFFSET,
        start: 0,
        length: WARRIOR_IDLE_FRAMES,
        fps: WARRIOR_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: WARRIOR_WALK_FRAMES,
        fps: WARRIOR_WALK_FPS,
      },

      attack: {
        rowOffset: WARRIOR_ATTACK_ROW,
        start: 0,
        length: WARRIOR_ATTACK_FRAMES,
        fps: WARRIOR_ATTACK_FPS,
      },

      /**
       * A PICARETA, EM LOOP, E POR DIRECAO.
       *
       * ## POR QUE `rowOffset`, E NAO `row` FIXO
       *
       * Porque o ciclo segue o angulo em que o jogador chegou na pedra: quem
       * esta de norte soca para o norte. Com `row` fixo, o guerreiro socaria
       * para o sul estando virado para o norte
       *
       * ## E SEM `needsTarget`
       *
       * Porque mineracao nao tem alvo — tem uma pedra, que e um objeto do
       * mapa e nao alguem que possa morrer. A `needsTarget` trava a arte de
       * tiro, e o alvo do arquiro e um INIMIGO
       */
      mining: {
        rowOffset: WARRIOR_MINING_ROW_OFFSET,
        start: 0,
        length: WARRIOR_MINING_FRAMES,
        fps: WARRIOR_MINING_FPS,
      },
    },
  },
);

/**
 * As medidas do sorcerer, medidas na folha gerada por
 * `node tools/gif-to-sheet.mjs sorcerer`.
 *
 * ## A CELULA CAIU DE 132 PARA 96
 *
 * A arte do pacote novo e menor que a anterior: `walk`, `idle` e `attack`
 * medem 88x88, e so o `mining` chega a 92x92. A celula de 132 era a arte
 * velha, que saia em 128 e 132 — a de 96 e a menor que cabe no 92 do
 * `mining` com a folga que a ferramenta exige
 *
 * ## A ANCORA VEIO DA FOLHA, NAO DE OUTRA CLASSE
 *
 * O `anchorY` e 76: e onde o pe do sorcerer fica na caminhada, que e o
 * que amarra o desenho ao ponto do mundo. Copiar a ancora do arquiro (76
 * tambem, por acaso) daria o numero certo pela razao errada — e a ancora
 * da arena (75) e o valor que o resto da arte tambem confirma
 *
 * O `anchorX` e 48, a metade da celula: a arte e simetrica na horizontal em
 * todas as oito direcoes, entao o meio do PNG e o meio do personagem
 */
const SORCERER_FRAME_SIZE = 96;
const SORCERER_ANCHOR_X = 48;
const SORCERER_ANCHOR_Y = 76;

/**
 * ONZE COLUNAS, E NAO NOVE
 *
 * A folha tem 11 colunas porque e o MAIOR grupo de quadros da classe: o
 * `mining` do norte tem 11 quadros. Com 9, o indice 9 e 10 cairiam na linha
 * de baixo da celula e o sprite leria tile de outra animacao
 */
const SORCERER_COLUMNS = 11;
const SORCERER_WALK_FRAMES = 8;
const SORCERER_IDLE_FRAMES = 8;
const SORCERER_IDLE_ROW_OFFSET = 8;
const SORCERER_ATTACK_FRAMES = 9;
const SORCERER_ATTACK_ROW = 16;
const SORCERER_MINING_FRAMES = 9;
const SORCERER_MINING_ROW = 24;
const SORCERER_WALK_FPS = 12;
const SORCERER_IDLE_FPS = 5;
const SORCERER_ATTACK_FPS = 20;
const SORCERER_MINING_FPS = 10;

export const SORCERER_GEOMETRY = {
  frameWidth: SORCERER_FRAME_SIZE,
  frameHeight: SORCERER_FRAME_SIZE,
  anchorX: SORCERER_ANCHOR_X,
  anchorY: SORCERER_ANCHOR_Y,

  /**
 * A ESCALA E A MESMA DO ARQUEIRO E DO GUERREIRO: 1.1.
 *
 * ## POR QUE ANTES ERA 0.697, E POR QUE NAO E MAIS
 *
 * A celula do sorcerer era 132 e a do arqueiro 96. A escala compensava essa
 * diferenca para o PERSONAGEM sair do mesmo tamanho na tela, e o numero
 * compensava tanto que 0.697 ficava minusculo ao lado de um 1.1
 *
 * Com a celula de 96, essa compensacao sumiu: as tres classes desenham na
 * mesma grade. A escala virou a mesma das outras duas por um motivo real —
 * a medida em que elas sao iguais — e nao porque o numero foi copiado
 *
 * ## E POR QUE O SORCERER SAI UM POUCO MAIOR QUE O ARQUEIRO
 *
 * Porque a arte dele e um pouco mais alta: 62px contra 56 na caminhada.
 * O boneco carrega cajado e capa, e ele ocupa mais espaco vertical que um
 * arqueiro de arco curto. Forcar os dois no mesmo numero de pixel seria
 * encolher a arte do sorcerer ate ela deixar de caber na propria pose
 */
  scale: 1.1,
};

/**
 * O idle do sorcerer, que agora e uma arte por direcao.
 *
 * Antes era um `idle.gif` solto, lido por `row`. Agora a pasta `idle/` tem os
 * oito angulos, entao cada um ocupa a sua linha e o layout aponta com
 * `rowOffset`
 *
 * ## POR QUE ISTO NAO E UM DETALHE
 *
 * Um idle de uma linha so lido por `row` mostraria o sorcerer parado com o
 * angulo da linha 8 — o angulo do `east`, sempre — de qualquer lado que ele
 * esteja olhando. O jogador para de andar para o norte e ve o bonecone virado
 * para leste
 */
const SORCERER_IDLE_ANIMATION = {
  rowOffset: SORCERER_IDLE_ROW_OFFSET,
  start: 0,
  length: SORCERER_IDLE_FRAMES,
  fps: SORCERER_IDLE_FPS,
};

/**
 * O golpe do sorcerer, que antes nao existia.
 *
 * ## POR QUE `needsTarget`
 *
 * Porque o golpe basico dele e `type: "projectile"` — e um conjurador de
 * projeteil, e a arte e direcional. A mesma marca que o arqueiro usa: sem alvo
 * de verdade o ciclo nao entra, e o boneco continua andando em vez de parar
 * paraconjurar no vazio
 *
 * E o motor vira o personagem para o alvo durante o tiro, que e o que usa o
 * `firingTargetId` gravado pelo `SkillSystem`
 *
 * ## E POR QUE 20 QUADROS POR SEGUNDO, IGUAL AO ARQUEIRO
 *
 * Porque sao os dois projecteis, com a mesma pose de 0.22s. O ritmo do golpe
 * e o mesmo das duas classes, e dois numeros diferentes fariam o conjurador
 * "piscar" em comparacao com o arqueiro
 *
 * ## O GOLPE DO NORTE VEI COM 11 QUADROS
 *
 * Cortado para 9 pelo `normalizarFrames`, que corta no MENOR do grupo — o
 * mesmo corte que o tiro do arquiro levou. E o que mantem o passo igual nas
 * oito direcoes
 */
const SORCERER_ATTACK_ANIMATION = {
  rowOffset: SORCERER_ATTACK_ROW,
  start: 0,
  length: SORCERER_ATTACK_FRAMES,
  fps: SORCERER_ATTACK_FPS,
  needsTarget: true,
};

/**
 * A MINERACAO, que saiu do pacote novo.
 *
 * ## POR QUE O CONJURADOR GANHOU PICARRETA
 *
 * O comentario antigo dizia que a picareta era do arqueiro e que nenhuma
 * outra classe tinha a arte. O pacote novo trouxe `mining/` com os oito
 * angulos, entao o sprite sem esse bloco cairia no `idle` quando o jogador
 * chega numa pedra — boneco parado mexendo o cajado, como se conjurasse
 * para uma pedra
 *
 * ## E O MESMO RITMO DO GUERREIRO
 *
 * 10 quadros por segundo: os dois cavam com o mesmo movimento de tranco, e
 * dois numeros diferentes fariam o sorcerer parecer lento ao lado do
 * guerreiro quebrando a mesma pedra
 */
const SORCERER_MINING_ANIMATION = {
  rowOffset: SORCERER_MINING_ROW,
  start: 0,
  length: SORCERER_MINING_FRAMES,
  fps: SORCERER_MINING_FPS,
};

/**
 * O sorcerer, a partir da arte de `assets/sprites/sorcerer/`.
 *
 * ## A FOLHA MUDOU DE 24 PARA 32 LINHAS
 *
 * Sao oito de caminhada, oito de idle, oito de golpe e oito de mineracao,
 * nesta ordem. Antes eram oito de caminhada, UMA de idle e oito de golpe
 *
 * E a celula caiu de 132 para 96, que e a mesma do arquiro e do guerreiro
 */
export const SORCERER_SPRITE = createDirectionalSpriteDefinition(
  "sorcerer",
  SEM_IMAGEM,
  {
    directions: SORCERER_DIRECTIONS,

    ...SORCERER_GEOMETRY,

    walkBob: DIRECTIONAL_WALK_BOB,

    animations: {
      idle: SORCERER_IDLE_ANIMATION,

      walk: {
        start: 0,
        length: SORCERER_WALK_FRAMES,
        fps: SORCERER_WALK_FPS,
      },

      attack: SORCERER_ATTACK_ANIMATION,

      mining: SORCERER_MINING_ANIMATION,
    },
  },
);

/**
 * As medidas do lancer, medidas na folha gerada por
 * `node tools/gif-to-sheet.mjs lancer`.
 *
 * A celula e a do guerreiro, 68px, e a ancora (33.5, 53) e a que a
 * propria folha mediu. O `anchorY` de 53 e 3px
 * menor que o do sorcerer ANTIGO, e era o que a arte pedia. O sorcerer
 * passou a ter celula de 132 depois, e a conta de "mesmo tamanho na tela"
 * dele virou a `SORCERER_SCALE`. Copiar a ancora de outra classe da ao
 * personagem um deslocamento vertical em relacao as outras
 */
const LANCER_FRAME_SIZE = 68;
const LANCER_ANCHOR_X = 33.5;
const LANCER_ANCHOR_Y = 53;
const LANCER_WALK_FRAMES = 8;
const LANCER_IDLE_FRAMES = 8;
const LANCER_IDLE_ROW = 8;
const LANCER_WALK_FPS = 12;
const LANCER_IDLE_FPS = 5;

export const LANCER_GEOMETRY = {
  frameWidth: LANCER_FRAME_SIZE,
  frameHeight: LANCER_FRAME_SIZE,
  anchorX: LANCER_ANCHOR_X,
  anchorY: LANCER_ANCHOR_Y,
};

/**
 * O idle do lancer, e o golpe provisorio que aponta para ele.
 *
 * O MESMO contrato do sorcerer: enquanto nao houver arte de golpe, o
 * `idle` e o que entra no desenho durante o ataque, e o `attack` ser o
 * proprio bloco de idle e o que garante isso mesmo com o personagem
 * andando
 */
const LANCER_IDLE_ANIMATION = {
  row: LANCER_IDLE_ROW,
  start: 0,
  length: LANCER_IDLE_FRAMES,
  fps: LANCER_IDLE_FPS,
};

/**
 * O lancer, a partir da arte de `assets/sprites/lancer/`.
 *
 * Sao oito direcoes de caminhada e um `indle.gif` de verdade, com
 * oito quadros, e NADA de golpe — a pasta de origem nao trouxe arte
 * de ataque. A folha tem 9 linhas: 8 de caminhada e a de idle na 8.
 *
 * O `attack` aponta para a linha de idle pelo mesmo motivo do
 * sorcerer, e pela mesma razao de ele DECLARAR e nao omitir: o lancer
 * e corpo a corpo e ataca com um `./target` em linha, entao nao ha
 * `needsTarget` para travar a animacao; e sem o bloco declarado, um
 * lancer que anda e ataca junto entraria no `walk`
 */
export const LANCER_SPRITE = createDirectionalSpriteDefinition(
  "lancer",
  SEM_IMAGEM,
  {
    directions: LANCER_DIRECTIONS,

    ...LANCER_GEOMETRY,

    walkBob: DIRECTIONAL_WALK_BOB,

    animations: {
      idle: LANCER_IDLE_ANIMATION,

      walk: {
        start: 0,
        length: LANCER_WALK_FRAMES,
        fps: LANCER_WALK_FPS,
      },

      attack: LANCER_IDLE_ANIMATION,
    },
  },
);

/**
 * O layout de cada classe, sem a imagem: o `./index.js` junta a URL.
 *
 * Sao as mesmas quatro de `data/characters/index.js`. `taoist`,
 * `darkist`, `lionheart` e `summoner` sairam daqui junto com a
 * classe, o skill pack e a arte.
 *
 * As QUATRO jogaveis sao direcionais agora: `warrior`, `arbalist`,
 * `sorcerer` e `lancer`. Nenhuma classe ficou no formato antigo de
 * folha de 3 linhas com espelhamento
 */
export const CLASS_SPRITES = {
  warrior: WARRIOR_SPRITE,
  lancer: LANCER_SPRITE,
  sorcerer: SORCERER_SPRITE,
  arbalist: ARBALIST_SPRITE,
};

export function getClassSprite(classId) {
  return CLASS_SPRITES[classId] ?? null;
}

