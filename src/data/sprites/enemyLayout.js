/**
 * O LAYOUT dos sprites de inimigo, sem imagem.
 *
 * O mesmo motivo de `./layout.js`: este modulo e importado pelo
 * motor, que roda no servidor, e um `import x from ".png"` no
 * topo derrubava o processo do Node antes de o servidor subir.
 *
 * `src/data/sprites/enemies.client.js` junta estes numeros com a
 * imagem de verdade, e so o cliente importa aquele.
 */
import {
  SPRITE_FORMAT,
  SEM_IMAGEM,
  ARBALIST_DIRECTIONS,
  createDirectionalSpriteDefinition,
} from "./layout.js";

const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;
const ANCHOR_X = 16;
const ANCHOR_Y = 26;
const FOOT_OFFSET = 10;

export function createEnemySpriteDefinition(id, src, scale) {
  return {
    id,
    format: SPRITE_FORMAT.SHEET,
    src,

    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,

    anchorX: ANCHOR_X,
    anchorY: ANCHOR_Y,

    scale,
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
      hurt: { start: 9, length: 2, fps: 10 },
    },
  };
}

/**
 * As criaturas de folha antiga: celula de 32x32, tres linhas (baixo,
 * frente, lado) e arte desenhada para aquele tamanho.
 *
 * O `ogre` saiu daqui. Ele usava `enemies/ogre.png`, uma folha de
 * 32px, e passou a usar a MESMA folha direcional de 68px do ogre da
 * predeira: no jogo apareciam os dois ogres lado a lado com artes
 * diferentes, e o pedido foi que todo ogre use a folha da predeira.
 * A criatura continua existindo com os proprios numeros, zona e
 * cacadas; so o desenho mudou.
 */
const ESCALA = {
  slime: 1.5,
  rat: 1.2,
  goblin: 1.3,
  ghoul: 1.4,
  skeleton: 1.35,
};

/**
 * O arqueiro zumbi e o primeiro inimigo DIRECIONAL.
 *
 * As outras criaturas usam folhas de 3 linhas (baixo, frente, lado) e
 * so têm andar e atacar. O zumbi veio com a arte de oito direcoes
 * do arqueiro, entao ele precisa da mesma folha em 17 linhas: 8 de
 * caminhada, 1 de idle e 8 de tiro.
 *
 * A celula e 68x68, e nao os 64x64 do arqueiro: a arte de origem
 * dele ja veio nesse tamanho, e encolher para 64 cortaria o
 * personagem. A ancora (33, 55) foi medida pela ferramenta que monta
 * a folha, e nao chutada.
 */
const ZUMBI_CELL = 68;

const ZUMBI_WALK_FRAMES = 8;
const ZUMBI_IDLE_FRAMES = 9;
const ZUMBI_IDLE_ROW = 8;
const ZUMBI_SHOOT_FRAMES = 9;
const ZUMBI_SHOOT_ROW = 9;
const ZUMBI_WALK_FPS = 12;
const ZUMBI_IDLE_FPS = 5;
const ZUMBI_SHOOT_FPS = 20;

export const ZUMBI_SPRITE = {
  ...createDirectionalSpriteDefinition("zumbi_arbalist", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,
    walkBob: { amplitude: 4, frequency: 1.5 },
    animations: {
      idle: {
        row: ZUMBI_IDLE_ROW,
        start: 0,
        length: ZUMBI_IDLE_FRAMES,
        fps: ZUMBI_IDLE_FPS,
      },
      walk: {
        start: 0,
        length: ZUMBI_WALK_FRAMES,
        fps: ZUMBI_WALK_FPS,
      },
      attack: {
        rowOffset: ZUMBI_SHOOT_ROW,
        start: 0,
        length: ZUMBI_SHOOT_FRAMES,
        fps: ZUMBI_SHOOT_FPS,
        needsTarget: true,
      },
    },
  }),

  frameWidth: ZUMBI_CELL,
  frameHeight: ZUMBI_CELL,
  anchorX: 33,
  anchorY: 55,
};

/**
 * O ogre da predeira: o segundo direcional, e o primeiro CORPO A
 * CORPO com arte de oito direcoes.
 *
 * A folha tem 16 linhas: 8 de caminhada e 8 de golpe. O nome da
 * pasta de origem e `shoot`, mas nao ha arco nenhum ali: e o
 * swinging do ogre, e ele precisa de andar ate o jogador.
 *
 * A celula e 68x68, a mesma do zumbi, e a ancora (33.5, 55) foi
 * medida pela ferramenta que monta a folha.
 *
 * NESTE sprite nao existe `row` de idle, e isso e proposital. O
 * `resolveFrameRect` cai em `animations.walk` quando a animacao
 * pedida nao existe, o que faria o ogre MARCHAR no lugar quando
 * estivesse parado. Por isso o idle existe aqui, com `length: 1` e
 * sem `row` nem `rowOffset`: um unico frame, na linha da
 * caminhada DA DIRECAO atual. E um pose de caminhada congelado,
 * que e o melhor que da para fazer sem arte de parado -- e pelo
 * menos fica virado para o lado certo, que um idle unico nao
 * faria.
 */
const OGRE_PREDEIRA_CELL = 68;

const OGRE_PREDEIRA_WALK_FRAMES = 8;
const OGRE_PREDEIRA_GOLPE_FRAMES = 9;
const OGRE_PREDEIRA_GOLPE_ROW = 8;
const OGRE_PREDEIRA_WALK_FPS = 12;
const OGRE_PREDEIRA_GOLPE_FPS = 18;

export const OGRE_PREDEIRA_SPRITE = {
  ...createDirectionalSpriteDefinition(
    "ogre_da_predeira",
    SEM_IMAGEM,
    {
      directions: ARBALIST_DIRECTIONS,
      walkBob: { amplitude: 3, frequency: 1.1 },
      animations: {
        // `length: 1` e o que segura o pose. o `fps` alto nao
        // importa: com um frame so, `resolveFrame` sempre devolve
        // a coluna 0
        idle: { start: 0, length: 1, fps: 1 },

        walk: {
          start: 0,
          length: OGRE_PREDEIRA_WALK_FRAMES,
          fps: OGRE_PREDEIRA_WALK_FPS,
        },

        // o golpe e corpo a corpo e depende de alvo tanto quanto o
        // tiro do zumbi: o `resolveFrameRect` so entra na arte de
        // ataque quando existe alvo de verdade, e um mob que esta
        // longe nao pode aparecer brandindo o porrete no vazio
        attack: {
          rowOffset: OGRE_PREDEIRA_GOLPE_ROW,
          start: 0,
          length: OGRE_PREDEIRA_GOLPE_FRAMES,
          fps: OGRE_PREDEIRA_GOLPE_FPS,
          needsTarget: true,
        },
      },
    },
  ),

  frameWidth: OGRE_PREDEIRA_CELL,
  frameHeight: OGRE_PREDEIRA_CELL,
  anchorX: 33.5,
  anchorY: 55,
};

/**
 * O boneco de madeira: o TERCEIRO direcional, e o primeiro que NAO
 * tem golpe.
 *
 * A arte veio so com as oito direcoes de caminhada, sem idle e sem
 * pasta de golpe: um boneco de treino nao ataca. Por isso este
 * sprite nao declara `attack`, e o `resolveFrameRect` cai em
 * `animations.walk` quando pedem "attack" -- o boneco fica no pose
 * de direcao em vez de inventar um golpe que nao foi desenhado.
 *
 * O `idle` e o mesmo truque do ogre da predeira: um frame, sem
 * `row`, entao aponta para o primeiro frame da caminhada DA
 * DIRECAO. O boneco nao anda, e sem isso ele ficaria num idle fixo
 * de frente enquanto o resto do mundo e art nao e.
 *
 * Celula 68x68, ancora (33.5, 54) medida pela ferramenta.
 */
const BONECO_CELL = 68;

const BONECO_WALK_FRAMES = 8;
const BONECO_WALK_FPS = 10;

export const BONECO_MADEIRA_SPRITE = {
  ...createDirectionalSpriteDefinition(
    "dummy_warrior",
    SEM_IMAGEM,
    {
      directions: ARBALIST_DIRECTIONS,

      // sem `walkBob`: boneco de treino nao balanca. O deslocamento
      // vertical ia fazer o boneco oscilar parado, e um boneco
      // parado e parado
      walkBob: null,

      animations: {
        idle: { start: 0, length: 1, fps: 1 },
        walk: {
          start: 0,
          length: BONECO_WALK_FRAMES,
          fps: BONECO_WALK_FPS,
        },
      },
    },
  ),

  frameWidth: BONECO_CELL,
  frameHeight: BONECO_CELL,
  anchorX: 33.5,
  anchorY: 54,
};

/**
 * O ghoul faminto: o QUARTO direcional, e o primeiro que tem `idle`
 * de verdade e NAO tem golpe.
 *
 * A arte veio em `assets/sprites/guerreiro`, que tem as oito
 * direcoes de caminhada mais um `idle.gif`, e nada de golpe: o ghoul
 * e corpo a corpo, entao o ataque dele esta no MESMO arquivo da
 * caminhada. Nao existe `attack` nesta definicao, e ai e que a ordem
 * do reserva do `resolveFrameRect` conta: ele procura `idle` ANTES
 * de `walk`, entao um pedido de "attack" cai na pose parada e o ghoul
 * nao sai andando no meio do golpe, com as pernas mexendo em pose de
 * ataque. (Se o `idle` nao existisse, cairia no `walk`.)
 *
 * O `idle` aqui e o unico dos direcionais que aponta para uma linha
 * propria (a linha 8, o `idle.gif` de verdade). O ogre e o boneco
 * congelam o primeiro frame da caminhada da direcao porque nao
 * tinham arte de parado; o ghoul tem, e usar o frame congelado
 * deixaria de lado arte ja desenhada
 *
 * Celula 68x68, ancora (33.5, 56) medida pela ferramenta.
 */
const GHOUL_FAMINTO_CELL = 68;

const GHOUL_FAMINTO_WALK_FRAMES = 8;
const GHOUL_FAMINTO_IDLE_FRAMES = 8;
const GHOUL_FAMINTO_IDLE_ROW = 8;
const GHOUL_FAMINTO_WALK_FPS = 12;
const GHOUL_FAMINTO_IDLE_FPS = 6;

export const GHOUL_FAMINTO_SPRITE = {
  ...createDirectionalSpriteDefinition(
    "ghoul",
    SEM_IMAGEM,
    {
      directions: ARBALIST_DIRECTIONS,
      walkBob: { amplitude: 3, frequency: 1.1 },
      animations: {
        // a linha do idle e uma linha INTEIRA da folha, entao o
        // `row` e obrigatorio: sem ele o `resolveFrameRect` usaria
        // `rowOffset ?? 0` e leria a linha 0, que e a caminhada
        // para leste
        idle: {
          row: GHOUL_FAMINTO_IDLE_ROW,
          start: 0,
          length: GHOUL_FAMINTO_IDLE_FRAMES,
          fps: GHOUL_FAMINTO_IDLE_FPS,
        },

        walk: {
          start: 0,
          length: GHOUL_FAMINTO_WALK_FRAMES,
          fps: GHOUL_FAMINTO_WALK_FPS,
        },
      },
    },
  ),

  frameWidth: GHOUL_FAMINTO_CELL,
  frameHeight: GHOUL_FAMINTO_CELL,
  anchorX: 33.5,
  anchorY: 56,
};

/**
 * O RATO DA TOCA: o QUINTO direcional, e o primeiro PASSIVO com arte.
 *
 * A arte veio em `assets/sprites/urso` — o nome e da arte, um urso que
 * o jogador mandou para o bicho da toca. O `id` da criatura continua
 * `rat`, e e por ele que o `GameEngine` acha o sprite
 *
 * Celula 68x68, ancora (33.5, 51) medida pela ferramenta.
 *
 * Duas coisas deste bicho valem o comentario:
 *
 * 1. **NAO tem golpe.** Ele e PASSIVO e tem `aggroRange: 0`: foge do
 *    jogador e nao ataca. O `attackRange` e o `damage` do catalogo
 *    existem para a criatura ter os mesmos campos dos outros, e nao
 *    porque ele golpeie. Sem `attack` nesta definicao, um pedido de
 *    "attack" cai no reserva do `resolveFrameRect`, que procura o
 *    `idle` ANTES do `walk` — e o bicho fica parado em vez de andar
 *    no meio de um golpe que ele nunca deu. (Se o `idle` nao
 *    existisse, cairia no `walk`.)
 *
 * 2. **A linha de `south` e arte de PARADO.** A pasta de origem tem
 *    sete direcoes de caminhada e nenhuma `south`. A folha usa o
 *    `idle.gif` — que e o rato de frente — como a linha do sul, para o
 *    bicho olhar na direcao do jogador ao descer, ao custo das patas
 *    nao mexerem. Copiar a vizinha em grau poria o rato andando na
 *    diagonal, e essa e a direcao mais vista do jogo. Ver
 *    `walkFallback` em `tools/gif-to-sheet.mjs`
 */
const RATO_DA_TOCA_CELL = 68;

const RATO_DA_TOCA_WALK_FRAMES = 8;
const RATO_DA_TOCA_IDLE_FRAMES = 8;
const RATO_DA_TOCA_IDLE_ROW = 8;
const RATO_DA_TOCA_WALK_FPS = 12;
const RATO_DA_TOCA_IDLE_FPS = 6;

export const RATO_DA_TOCA_SPRITE = {
  ...createDirectionalSpriteDefinition("rat", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,

    /**
     * O balanco e MENOR que o do ghoul.
     *
     * O `amplitude` e a altura que o sprite sobe a cada passo, e um
     * bicho de 43px nao pode pular 4px: ele sairia do chao mais do
     * que andaria em cima dele. O ghoul e grande e aguenta
     */
    walkBob: { amplitude: 2, frequency: 1.4 },

    animations: {
      // a linha do idle e uma linha INTEIRA da folha, entao o `row`
      // e obrigatorio: sem ele o `resolveFrameRect` usaria
      // `rowOffset ?? 0` e leria a linha 0, que e a caminhada para
      // leste
      idle: {
        row: RATO_DA_TOCA_IDLE_ROW,
        start: 0,
        length: RATO_DA_TOCA_IDLE_FRAMES,
        fps: RATO_DA_TOCA_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: RATO_DA_TOCA_WALK_FRAMES,
        fps: RATO_DA_TOCA_WALK_FPS,
      },
    },
  }),

  frameWidth: RATO_DA_TOCA_CELL,
  frameHeight: RATO_DA_TOCA_CELL,
  anchorX: 33.5,
  anchorY: 51,
};

/**
 * A SENTINELA ESQUELETICA: o SEXTO direcional, e a primeira criatura
 * que ATACA sem ter arte de golpe.
 *
 * A arte veio em `assets/sprites/sentinela`: oito direcoes de
 * caminhada e um `idle.gif`, todas em 68x68, e nada de golpe. E a arte
 * mais limpa do jogo — nenhum quadro truncado, nenhuma tela de tamanho
 * diferente, todas as oito direcoes presentes
 *
 * Celula 68x68, ancora (33.5, 54) medida pela ferramenta.
 *
 * O ponto que merece atencao aqui e a AUSENCIA de `attack`, num bicho
 * que ataca o tempo todo:
 *
 * - O `ghoul` e o `rato` tambem nao tem `attack`, e para os dois a
 *   diferenca e imperceptivel: sao passivos, com `aggroRange: 0`, e
 *   quase nunca esta no meio de um golpe
 *
 * - A sentinela e `ACTIVE`, com `aggroRange: 330`, `attackRange: 58` e
 *   `damage: 42`. O pedido de "attack" cai no reserva do
 *   `resolveFrameRect`, que prefere o `idle` (linha 8, arte de frente)
 *   a caminhada. O esqueleto vira de frente no instante da pancada e
 *   volta a andar na direcao certa no frame seguinte
 *
 * A alternativa seria declarar `attack` apontando para a linha da
 * caminhada da direcao, que manteria o corpo virado para o alvo sem
 * o salto — e por isso que nao foi feita: o `walk` de uma criatura
 * andando durante um golpe e o defeito que o comentario do `ghoul`
 * descreve, e o esqueleto e grande o bastante para o salto de direcao
 * chamar mais atencao do que as pernas mexendo
 *
 * Se um dia chegar arte de golpe, e so declarar a linha e a contagem
 * aqui, como o guerreiro fez
 */
const SENTINELA_ESQUELETICA_CELL = 68;

const SENTINELA_ESQUELETICA_WALK_FRAMES = 8;
const SENTINELA_ESQUELETICA_IDLE_FRAMES = 8;
const SENTINELA_ESQUELETICA_IDLE_ROW = 8;
const SENTINELA_ESQUELETICA_WALK_FPS = 12;
const SENTINELA_ESQUELETICA_IDLE_FPS = 6;

export const SENTINELA_ESQUELETICA_SPRITE = {
  ...createDirectionalSpriteDefinition("skeleton", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,

    /**
     * O balanco e o do ghoul, e nao o do rato.
     *
     * O `amplitude` e a altura que o sprite sobe a cada passo. Um
     * bicho de 45px aguenta os 3px; o rato de 43px nao, e por isso
     * que ele ficou em 2
     */
    walkBob: { amplitude: 3, frequency: 1.1 },

    animations: {
      // a linha do idle e uma linha INTEIRA da folha, entao o `row`
      // e obrigatorio: sem ele o `resolveFrameRect` usaria
      // `rowOffset ?? 0` e leria a linha 0, que e a caminhada para
      // leste, e a sentinela parada viraria de lado
      idle: {
        row: SENTINELA_ESQUELETICA_IDLE_ROW,
        start: 0,
        length: SENTINELA_ESQUELETICA_IDLE_FRAMES,
        fps: SENTINELA_ESQUELETICA_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: SENTINELA_ESQUELETICA_WALK_FRAMES,
        fps: SENTINELA_ESQUELETICA_WALK_FPS,
      },
    },
  }),

  frameWidth: SENTINELA_ESQUELETICA_CELL,
  frameHeight: SENTINELA_ESQUELETICA_CELL,
  anchorX: 33.5,
  anchorY: 54,
};

/**
 * O LIMO PREGUICOSO: o SETIMO direcional, e o bicho de nivel 1.
 *
 * A arte veio em `assets/sprites/guerreiro_2` — a segunda pasta
 * `guerreiro` do jogo, a primeira sendo o ghoul faminto. O nome e da
 * arte; a criatura continua `slime`, que e o `id` do save, do
 * bestiario e das missoes
 *
 * Celula 68x68, ancora (33.5, 54) medida pela ferramenta
 *
 * O `slime` e o bicho que mais aparece no jogo, e o `slime_gel` e o
 * `slime_core` sao ingredientes de craft e recompensa de missao. Nada
 * aqui pode mudar o `id`, nem por troca de arte: um save com
 * `slime_gel` pararia de casar com o item
 *
 * Sem golpe: o limo e PASSIVO e foge do jogador, entao um pedido de
 * "attack" cai no reserva do `resolveFrameRect`, que prefere o `idle`
 */
const LIMO_PREGUICOSO_CELL = 68;

const LIMO_PREGUICOSO_WALK_FRAMES = 8;
const LIMO_PREGUICOSO_IDLE_FRAMES = 8;
const LIMO_PREGUICOSO_IDLE_ROW = 8;
const LIMO_PREGUICOSO_WALK_FPS = 10;
const LIMO_PREGUICOSO_IDLE_FPS = 5;

export const LIMO_PREGUICOSO_SPRITE = {
  ...createDirectionalSpriteDefinition("slime", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,

    /**
     * O balanco e o MENOR de todos, e o FPS tambem.
     *
     * O limo anda a `speed: 48` e passeia a `wanderSpeed: 30` — e o
     * bicho mais lento do jogo depois do rato. Um `amplitude` de 3px
     * faria uma gosma de 45px pular mais do que anda, e a 10fps o
     * ciclo de 8 quadros dura 0.8s, o que num bicho lento fica com
     * aspecto de escorregar em vez de caminhar
     */
    walkBob: { amplitude: 2, frequency: 0.9 },

    animations: {
      // a linha do idle e uma linha INTEIRA da folha, entao o `row`
      // e obrigatorio: sem ele o `resolveFrameRect` usaria
      // `rowOffset ?? 0` e leria a linha 0, que e a caminhada para
      // leste, e o limo parado viraria de lado
      idle: {
        row: LIMO_PREGUICOSO_IDLE_ROW,
        start: 0,
        length: LIMO_PREGUICOSO_IDLE_FRAMES,
        fps: LIMO_PREGUICOSO_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: LIMO_PREGUICOSO_WALK_FRAMES,
        fps: LIMO_PREGUICOSO_WALK_FPS,
      },
    },
  }),

  frameWidth: LIMO_PREGUICOSO_CELL,
  frameHeight: LIMO_PREGUICOSO_CELL,
  anchorX: 33.5,
  anchorY: 54,
};

/**
 * O GOBLIN SAQUEADOR: o OITAVO direcional.
 *
 * A arte veio em `assets/sprites/hulk` — o nome e da arte. A criatura
 * e o `goblin`, que e o `id` do save e do bestiario, e a saida usa o
 * nome de exibicao, "Goblin Saqueador", como o ghoul usa "Ghoul
 * Faminto"
 *
 * Celula 68x68, ancora (33.5, 55) medida pela ferramenta
 *
 * Sem golpe: o goblin e `SEMI_PASSIVE` com `aggroRange: 0`, o mesmo
 * caso do ghoul faminto. Ele passeia e nao persegue, entao um pedido de
 * "attack" cai no reserva do `resolveFrameRect` — que prefere o `idle`
 * a caminhada — e o bicho fica parado em vez de sair andando no meio
 * de uma pancada
 *
 * Aqui a ausencia de arte de golpe custa MENOS que na sentinela: um
 * bicho que nao persegue quase nao entra na janela de golpe, entao o
 * salto de direcao do reserva quase nunca aparece
 */
const GOBLIN_SAQUEADOR_CELL = 68;

const GOBLIN_SAQUEADOR_WALK_FRAMES = 8;
const GOBLIN_SAQUEADOR_IDLE_FRAMES = 8;
const GOBLIN_SAQUEADOR_IDLE_ROW = 8;
const GOBLIN_SAQUEADOR_WALK_FPS = 12;
const GOBLIN_SAQUEADOR_IDLE_FPS = 6;

export const GOBLIN_SAQUEADOR_SPRITE = {
  ...createDirectionalSpriteDefinition("goblin", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,

    /**
     * O balanco e o do ghoul.
     *
     * O goblin e um bicho de pe medio com `radius: 20`: aguenta os 3px
     * de amplitude. O que o separou do limo foi o oposto — a arte e
     * grande e ele anda a `speed: 118`, bem mais rapido que a gosma
     */
    walkBob: { amplitude: 3, frequency: 1.1 },

    animations: {
      // a linha do idle e uma linha INTEIRA da folha, entao o `row`
      // e obrigatorio: sem ele o `resolveFrameRect` usaria
      // `rowOffset ?? 0` e leria a linha 0, que e a caminhada para
      // leste, e o goblin parado viraria de lado
      idle: {
        row: GOBLIN_SAQUEADOR_IDLE_ROW,
        start: 0,
        length: GOBLIN_SAQUEADOR_IDLE_FRAMES,
        fps: GOBLIN_SAQUEADOR_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: GOBLIN_SAQUEADOR_WALK_FRAMES,
        fps: GOBLIN_SAQUEADOR_WALK_FPS,
      },
    },
  }),

  frameWidth: GOBLIN_SAQUEADOR_CELL,
  frameHeight: GOBLIN_SAQUEADOR_CELL,
  anchorX: 33.5,
  anchorY: 55,
};

export const ENEMY_SPRITES = {
  ...Object.fromEntries(
    Object.entries(ESCALA).map(([id, scale]) => [
      id,
      createEnemySpriteDefinition(id, SEM_IMAGEM, scale),
    ]),
  ),

  // os direcionais: a chave e o `id` da criatura, e e assim que o
  // `GameEngine` acha o sprite de um inimigo
  zumbi_arbalist: ZUMBI_SPRITE,
  ogre_da_predeira: OGRE_PREDEIRA_SPRITE,

  // o ghoul faminto SUBSTITUI a arte antiga de folha pequena: a
  // chave e a do mesmo `id` de criatura, entao este registro tem
  // precedencia sobre o `createEnemySpriteDefinition` acima
  ghoul: GHOUL_FAMINTO_SPRITE,

  // TODO ogre usa a folha da predeira, o `ogre` da pedreira
  // incluso. As DUAS criaturas apontam para o MESMO objeto de
  // definicao: uma folha direcional de 68px, que o `ogre` nao tinha.
  // Isso leva o tamanho em tela de 61px (32 x 1.9) para 68px, e e o
  // que a arte nova pede
  ogre: OGRE_PREDEIRA_SPRITE,

  // o boneco de madeira. Os OUTROS seis bonecos nao tem arte e
  // continuam no corpo vetorial, que e o que o registro decide
  // quando nao conhece o tipo
  dummy_warrior: BONECO_MADEIRA_SPRITE,
};

export function getEnemySprite(creatureId) {
  return ENEMY_SPRITES[creatureId] ?? null;
}
