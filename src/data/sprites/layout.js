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
const DIRECTIONAL_SCALE = 1;
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
const ARBALIST_FRAME_SIZE = 84;
const ARBALIST_ANCHOR_X = 41.5;
const ARBALIST_ANCHOR_Y = 68;
const ARBALIST_COLUMNS = 9;

const ARBALIST_FRAMES = 8;
const ARBALIST_IDLE_FRAMES = 8;
const ARBALIST_IDLE_ROW = 8;
const ARBALIST_SHOOT_FRAMES = 9;
const ARBALIST_SHOOT_ROW = 9;
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
const WARRIOR_FRAME_SIZE = 68;
const WARRIOR_ANCHOR_X = 34;
const WARRIOR_ANCHOR_Y = 55;
const WARRIOR_WALK_FRAMES = 8;
const WARRIOR_IDLE_FRAMES = 8;
const WARRIOR_IDLE_ROW = 8;
const WARRIOR_ATTACK_FRAMES = 9;
const WARRIOR_ATTACK_ROW = 9;
const WARRIOR_WALK_FPS = 12;
const WARRIOR_IDLE_FPS = 5;
const WARRIOR_ATTACK_FPS = 18;

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

    walkBob: DIRECTIONAL_WALK_BOB,

    animations: {
      idle: {
        row: ARBALIST_IDLE_ROW,
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
    },
  },
);

/**
 * O guerreiro, a partir da arte de `assets/sprites/warrior/`.
 *
 * Os numeros sao a saida de `node tools/gif-to-sheet.mjs warrior`, e
 * a folha tem 17 linhas: 8 de caminhada, 1 de idle e 8 de golpe.
 *
 * A celula dele tem 68px, e nao os 64 do arquiro: sao artes de
 * origem com dimensoes diferentes, e encolher uma para a outra
 * perderia pixel da arte nova. O `tools/gif-to-sheet.mjs` mede a
 * ancora de cada celula justamente para a arte nao precisar ser
 * encolhida para caber
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
        row: WARRIOR_IDLE_ROW,
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
    },
  },
);

/**
 * As medidas do sorcerer, medidas na folha gerada por
 * `node tools/gif-to-sheet.mjs sorcerer`.
 *
 * A celula e a do guerreiro, 68px, e a ancora (33, 56) e a que a
 * propria folha mediu: o personagem da arte fica com o pe em y=56
 * depois do alinhamento, e e esse numero que o amarra ao ponto do
 * mundo. Um `anchorY` de 54, o do arquiro, colocaria o sorcerer 2px
 * fora do chao em relacao as outras classes
 */
const SORCERER_FRAME_SIZE = 68;
const SORCERER_ANCHOR_X = 33;
const SORCERER_ANCHOR_Y = 56;
const SORCERER_WALK_FRAMES = 8;
const SORCERER_IDLE_FRAMES = 8;
const SORCERER_IDLE_ROW = 8;
const SORCERER_WALK_FPS = 12;
const SORCERER_IDLE_FPS = 5;

export const SORCERER_GEOMETRY = {
  frameWidth: SORCERER_FRAME_SIZE,
  frameHeight: SORCERER_FRAME_SIZE,
  anchorX: SORCERER_ANCHOR_X,
  anchorY: SORCERER_ANCHOR_Y,
};

/**
 * O idle do sorcerer, e o golpe provisorio que aponta para ele.
 *
 * As duas entradas sao o MESMO objeto de proposito: enquanto o
 * sorcerer nao tiver arte de ataque, o `idle` e o que entra no
 * desenho durante o golpe, e deixar isso escrito como o mesmo bloco
 * diz o que acontece sem depender de nenhum reserva do motor
 */
const SORCERER_IDLE_ANIMATION = {
  row: SORCERER_IDLE_ROW,
  start: 0,
  length: SORCERER_IDLE_FRAMES,
  fps: SORCERER_IDLE_FPS,
};

/**
 * O sorcerer, a partir da arte de `assets/sprites/sorcerer/`.
 *
 * Sao oito direcoes de caminhada e um `idle.gif` de verdade, com oito
 * quadros, e NADA de golpe: a pasta de origem nao tem arte de ataque.
 * A folha tem 9 linhas — 8 de caminhada, 1 de idle na linha 8.
 *
 * O `attack` aponta para a linha de idle, e nao para uma linha de
 * golpe que nao existe. A diferenca para o ghoul, que tambem nao tem
 * arte de golpe: o ghoul OMITE o `attack` e deixa o pedido cair no
 * reserva do `resolveFrameRect`, e o sorcerer DECLARA. Com o bloco
 * declarado, o `resolveAnimation` devolve `attack` durante o golpe
 * mesmo com o personagem andando — sem ele, um sorcerer que anda e
 * ataca junto entraria no `walk`, que e a caminhada de verdade, e o
 * golpe apareceria com as pernas mexendo
 *
 * E o que o usuario pediu enquanto nao existir a arte: parado em idle
 * enquanto ataca. Quando o `attack/` chegar na pasta, e so declarar a
 * linha e a contagem novas aqui, como o guerreiro fez
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

      /**
       * Provisorio: o MESMO bloco do idle, e nao uma linha de golpe
       * propria. Ver `SORCERER_IDLE_ANIMATION` acima
       */
      attack: SORCERER_IDLE_ANIMATION,
    },
  },
);

/**
 * As medidas do lancer, medidas na folha gerada por
 * `node tools/gif-to-sheet.mjs lancer`.
 *
 * A celula e a do guerreiro e do sorcerer, 68px, e a ancora
 * (33.5, 53) e a que a propria folha mediu. O `anchorY` de 53 e 3px
 * menor que o do sorcerer, e e o que a arte pede: o pe do lancer fica
 * mais alto na celula. Copiar a ancora de outra classe da ao personagem
 * um deslocamento vertical em relacao as outras
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

