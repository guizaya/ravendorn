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
 * `skeleton` saiu daqui. A sentinela virou direcional de 68, depois virou o
 * Kaelen de 88, e este `1.35` era a escala de tela de uma folha que nao
 * existe mais. O `ENEMY_SPRITES` abaixo aponta o `skeleton` para o
 * `KAELEN_SPRITE`, e o que fica aqui e o resto das folhas de 32px
 */
const ESCALA = {
  /*
   * SO O SLIME FOI AUMENTADO, e ele e o unico deste mapa que ainda e
   * desenhado por aqui
   *
   * ## OS OUTROS TRES DESTE OBJETO NAO SAO DESPENHADOS
   *
   * `ghoul` e sobrescrito pela `GHOUL_FAMINTO_SPRITE` mais abaixo, que tem
   * celula de 68 e arte propria — entao o numero daqui nunca chega na tela.
   * `rat` e `goblin` nao estao em nenhum `mix` do `ZONE_ROSTER`: o jogo
   * chama o rato de `rat` pela arte mas nao o sorteia, e o goblin do mapa 1
   * tem id `ogre`
   *
   * Antes esses tres numeros cresciam em silencio. Deixe-los como estao,
   * com o comentario, porque o objeto parece autoritativo e nao e
   */
  slime: 1.5,
  rat: 1.2,
  goblin: 1.3,
  ghoul: 1.4,
};

/**
 * O OGRE DA PREDEIRA, que vem logo abaixo.
 *
 * ## ONDE ESTAVA O `ZUMBI_SPRITE`
 *
 * O arqueiro zumbi foi o primeiro direcional do jogo, e o layout dele
 * ficava aqui, com celula de 68 e folha de 17 linhas: 8 de caminhada, 1
 * de idle e 8 de tiro.
 *
 * Saiu quando a criatura virou a Nylara, porque a arte nova e de celula
 * 88, de 25 linhas e com animacao de morte — e a `NYLARA_SPRITE` mais
 * abaixo descreve a folha nova. A folha antiga
 * `zumbi_arbalist-sheet.png` continua no disco e sai de circulacao junto
 * com estas constantes
 */

/**
 * A NYLARA, que era o Arqueiro Zumbi.
 *
 * ## O ID CONTINUA `zumbi_arbalist`
 *
 * Como no goblin e no Kaelen: o id e a chave do save, das cacadas de
 * bestiario e das entregas de colecao. No mapa 2 a Nylara vem da regra
 * `slime: "zumbi_arbalist"`, e trocar o id mudaria o registro de abate de
 * quem ja matou o arqueiro zumbi
 *
 * ## A FOLHA
 *
 * ```
 *   0.. 7  walk   (8 direcoes, 8 quadros)
 *   8..15  idle   (8 direcoes, 8 quadros)
 *  16..23  attack (8 direcoes, 9 quadros)
 *      24  death  (so o sul,   9 quadros)
 * ```
 *
 * A mesma disposicao do goblin e do Kaelen. O idle e por direcao, entao
 * precisa de `rowOffset`; a morte e uma linha so, entao precisa de `row`.
 * Sao duas coisas diferentes e misturar os dois le a linha errada
 *
 * ## A CELULA E DE 88, E A ARTE NAO E TODA DE 84
 *
 * Oito dos gifs saem em 84x84, e dois — `west` e `north-west` — em 88x88.
 * A celula tem que ser a maior, porque a ferramenta recusa cortar pixel
 * de arte. A ancora (43.5, 70) veio do log da folha, e nao pode ser a do
 * zumbi antigo, que era 33 numa celula de 68
 *
 * ## O GOLPE CONTINUA COM `needsTarget`
 *
 * A Nylara e `ranged: true`: ela atira de longe, com `keepDistance` e
 * projetil. A arte do golpe e a de DISPARO, entao o `needsTarget` fica —
 * e e ele que impede ela de brandir o arco no ar vazio. O Kaelen, que e
 * corpo a corpo, tirou o mesmo flag pelo mesmo motivo invertido
 */
const NYLARA_CELL = 88;

const NYLARA_WALK_FRAMES = 8;
const NYLARA_IDLE_FRAMES = 8;
const NYLARA_ATTACK_FRAMES = 9;
const NYLARA_DEATH_FRAMES = 9;

// o idle comeca depois das oito linhas de caminhada
const NYLARA_IDLE_ROW_OFFSET = 8;

// o golpe comeca depois das oito de caminhada e das oito de idle
const NYLARA_ATTACK_ROW_OFFSET = 16;

// a morte e a ultima linha, e a unica: nao ha direcao para somar
const NYLARA_DEATH_ROW = 24;

const NYLARA_WALK_FPS = 12;
const NYLARA_IDLE_FPS = 6;
const NYLARA_ATTACK_FPS = 14;

/**
 * O RITMO DA MORTE, e o MESMO do goblin e do Kaelen.
 *
 * Os mesmos numeros de proposito: os tres tem 9 quadros de morte e o mesmo
 * comprimento de ciclo na arte. Divergir aqui faria o cadaver da Nylara
 * ficar mais rapido ou mais lento que o do goblin sem que houvesse razao
 */
const NYLARA_DEATH_DURATION = 0.6;
const NYLARA_DEATH_FADE = 0.4;

export const NYLARA_SPRITE = {
  ...createDirectionalSpriteDefinition("zumbi_arbalist", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,

    /**
     * O BALANCO E DE 2px, e nao os 4 do zumbi antigo.
     *
     * A celula subiu de 68 para 88, e com a amplitude de 4 o desenho sobe
     * para fora da propria celula a cada passo
     */
    walkBob: { amplitude: 2, frequency: 1.1 },

    animations: {
      /**
       * O IDLE APONTA PARA O BLOCO, E NAO PARA A LINHA.
       *
       * Sao oito linhas de idle na folha, uma por angulo, e e o `rowOffset`
       * que faz a linha 8 virar "o idle para leste" e a 9 virar "o idle para
       * sudeste". Com `row: 8` a Nylara parada viraria de lado em qualquer
       * posicao do mapa
       */
      idle: {
        rowOffset: NYLARA_IDLE_ROW_OFFSET,
        start: 0,
        length: NYLARA_IDLE_FRAMES,
        fps: NYLARA_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: NYLARA_WALK_FRAMES,
        fps: NYLARA_WALK_FPS,
      },

      /**
       * O DISPARO, com `needsTarget`.
       *
       * Ela e atiradora, entao o golpe so entra com alvo de verdade. Sem o
       * flag, a Nylara aparecia puxando a corda do arco no ar, a 300px de
       * um alvo que ela nem tinha
       */
      attack: {
        rowOffset: NYLARA_ATTACK_ROW_OFFSET,
        start: 0,
        length: NYLARA_ATTACK_FRAMES,
        fps: NYLARA_ATTACK_FPS,
        needsTarget: true,
      },

      /**
       * A MORTE, E SO ELA APONTA PARA `row`.
       *
       * A linha 24 existe uma vez na folha e serve para as oito direcoes.
       * Um `rowOffset` somaria a direcao da Nylara a 24 e leria a linha 25
       * ou 26 — que nao existem, e o desenho viraria um retangulo vazio da
       * parte de baixo da imagem
       *
       * O `holdLast` segura o cadaver no ultimo quadro durante o
       * esmaecimento. Sem ele o ciclo recomeçaria e o corpo voltaria a se
       * mexer enquanto some
       */
      death: {
        row: NYLARA_DEATH_ROW,
        start: 0,
        length: NYLARA_DEATH_FRAMES,
        fps: NYLARA_ATTACK_FPS,
        holdLast: true,
      },
    },
  }),

  frameWidth: NYLARA_CELL,
  frameHeight: NYLARA_CELL,

  /**
   * O TAMANHO DELA NA TELA: 0.896, e nao o 0.8 do padrao.
   *
   * ## O QUE ACONTECEU
   *
   * Os quatro bichos do mapa 1 e do mapa 2 seemed pequenos ao lado do
   * arbalist. Eles nao tinham encolhido: o ARBALIST que cresceu, de 67px
   * para 91px, e qualquer coisa do lado dele passou a parecer menor
   *
   * ## POR QUE 0.896 E NAO O 0.8 SIMPLES
   *
   * Porque sao DOIS pedidos seguidos, e a conta deles esta escrita: primeiro
   * `* 1.4` — os 40% maiores — e depois `* 0.8` — os 20% menores. O
   * resultado e 0.896, ou seja, 12% maior que o 0.8 de origem
   *
   * O `* 0.8` do fim parece redundante olhando so o numero: `0.8 * 1.4 * 0.8`
   * da 0.896, e so `0.896` daria o mesmo. Ele fica escrito porque o proximo
   * ajuste precisa saber que os 20% foram tirados do tamanho AUMENTADO, e nao
   * do 0.8 de origem — que daria 0.64
   */
  scale: 1,

  /**
   * O RITMO, e ele mora AQUI e nao no motor.
   *
   * `deathDuration` e o ciclo e `deathFade` a janela de esmaecimento
   * depois que ele acabou. O motor soma os dois e forma o relogio
   */
  deathDuration: NYLARA_DEATH_DURATION,
  deathFade: NYLARA_DEATH_FADE,

  /**
   * A ANCORA VIER DO LOG DA FOLHA.
   *
   * Sao os numeros que `gif-to-sheet.mjs nylara` imprimiu: o pe fica em
   * y=70 e o corpo e centrado em x=43.5. A celula e de 88, entao a ancora
   * nao pode ser a do zumbi antigo, que era 33 numa celula de 68
   */
  anchorX: 43.5,
  anchorY: 70,
};

/**
 * O ogre da predeira: o segundo direcional, e o primeiro CORPO A
 * CORPO com arte de oito direcoes.
 *
 * A folha tem 17 linhas: 8 de caminhada, 1 de idle e 8 de golpe. O nome
 * da pasta de origem e `shoot`, mas nao ha arco nenhum ali: e o
 * swinging do ogre, e ele precisa de andar ate o jogador.
 *
 * A celula e 68x68, a mesma do zumbi, e a ancora (33.5, 55) foi
 * medida pela ferramenta que monta a folha.
 *
 * ## A LINHA DE IDLE EXISTE DE VERDADE
 *
 * Antes a folha saia sem ela, e o idle caia no frame 0 da caminhada da
 * direcao: um pose de caminhada congelado, virado para o lado certo. O
 * `idle.gif` de origem chegou e a linha 8 passou a ser o idle de
 * verdade, entao o `idle` do layout aponta para ela
 *
 * Isso obriga o golpe a DESCER: com a linha de idle no meio, a
 * caminhada vai de 0 a 7, o idle e a 8, e o golpe passa a comecar na 9.
 * Um `rowOffset` de 8 aqui leria a linha do idle e o ogre brandiria o
 * porrete parado no meio do golpe
 */
const OGRE_PREDEIRA_CELL = 68;

const OGRE_PREDEIRA_WALK_FRAMES = 8;
const OGRE_PREDEIRA_IDLE_FRAMES = 8;
const OGRE_PREDEIRA_GOLPE_FRAMES = 9;

const OGRE_PREDEIRA_IDLE_ROW = 8;
const OGRE_PREDEIRA_GOLPE_ROW = 9;

const OGRE_PREDEIRA_WALK_FPS = 12;
const OGRE_PREDEIRA_IDLE_FPS = 6;
const OGRE_PREDEIRA_GOLPE_FPS = 18;

export const OGRE_PREDEIRA_SPRITE = {
  ...createDirectionalSpriteDefinition(
    "ogre_da_predeira",
    SEM_IMAGEM,
    {
      directions: ARBALIST_DIRECTIONS,
      walkBob: { amplitude: 3, frequency: 1.1 },
      animations: {
        /**
         * A linha do idle e uma linha INTEIRA da folha, entao o `row` e
         * obrigatorio. Sem ele o `resolveFrameRect` usaria
         * `rowOffset ?? 0` e leria a linha 0, que e a caminhada para
         * leste — e o ogre voltaria a andar parado virado para o lado
         */
        idle: {
          row: OGRE_PREDEIRA_IDLE_ROW,
          start: 0,
          length: OGRE_PREDEIRA_IDLE_FRAMES,
          fps: OGRE_PREDEIRA_IDLE_FPS,
        },

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
 * O GOBLIN DA PEDREIRA.
 *
 * ## A FOLHA E `goblin-sheet.png`, COM 25 LINHAS
 *
 * A ordem das linhas nao e a das outras folhas, e a ordem e o layout:
 *
 * ```
 *   0.. 7  walk   (8 direcoes, 8 quadros)
 *   8..15  idle   (8 direcoes, 8 quadros)
 *  16..23  attack (8 direcoes, 9 quadros)
 *      24  death  (so o sul,   9 quadros)
 * ```
 *
 * A folha tem 9 colunas, e nao 8, porque o golpe e a morte tem 9
 * quadros
 *
 * ## O IDLE POR DIRECAO E POR ISSO QUE ESTE LAYOUT E DIFERENTE
 *
 * As outras folhas tem um `idle.gif` so, que vira UMA linha e e lida
 * por `row`. Aqui o idle veio em `idle/`, com um gif por angulo, e
 * ocupa OITO linhas: o `idle` deste layout aponta para `rowOffset: 8`
 * e a linha real depende de para onde o goblin esta olhando
 *
 * Com `row: 8` aqui, o goblin parado viraria de lado para o leste em
 * qualquer posicao do mapa
 *
 * ## A MORTE E `row`, E NAO `rowOffset`
 *
 * A arte veio so do sul, entao a morte ocupa a linha 24 e nao tem
 * direcao nenhuma. Um `rowOffset` somaria a direcao do goblin a 24 e
 * leria a linha 25 ou 26 — que nao existem na folha, e o desenho
 * leria a linha transparente de baixo da imagem e o cadaver viraria um
 * retangulo vazio
 */
const GOBLIN_CELL = 84;

const GOBLIN_WALK_FRAMES = 8;
const GOBLIN_IDLE_FRAMES = 8;
const GOBLIN_ATTACK_FRAMES = 9;
const GOBLIN_DEATH_FRAMES = 9;

// o idle comeca depois das oito linhas de caminhada
const GOBLIN_IDLE_ROW_OFFSET = 8;

// o golpe comeca depois das oito de caminhada e das oito de idle
const GOBLIN_ATTACK_ROW_OFFSET = 16;

// a morte e a ultima linha, e a unica: nao ha direcao para somar
const GOBLIN_DEATH_ROW = 24;

const GOBLIN_WALK_FPS = 12;
const GOBLIN_IDLE_FPS = 6;
const GOBLIN_ATTACK_FPS = 18;

/**
 * O TEMPO DA MORTE.
 *
 * Nove quadros a 18fps dao meio segundo de animacao, e o `fps` do
 * bloco `death` abaixo e do ciclo
 *
 * Este numero e o RELOGIO do motor, e e MAIOR que meio segundo de
 * proposito: o cadaver chega no ultimo quadro e fica um pouco mais em
 * cena antes de sumir. Sem a folga o bicho desapareceria no mesmo
 * instante em que o ultimo quadro aparecia, e a animacao nao chegaria
 * a ser vista
 */
const GOBLIN_DEATH_DURATION = 0.6;

/**
 * A JANELA DE SUMIR.
 *
 * Depois do ultimo quadro o cadaver fica neste tempo esmaecendo. E o
 * que o pedido de "sumir suavemente, sem demorar" virou em numero
 *
 * Nao e o mesmo relogio da `GOBLIN_DEATH_DURATION`: aquele mede o
 * ciclo da animacao, e este mede so o esmaecimento depois que ela
 * acabou
 */
const GOBLIN_DEATH_FADE = 0.4;

export const GOBLIN_SPRITE = {
  ...createDirectionalSpriteDefinition("goblin", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,

    /**
     * O BALANCO E DE 2px.
     *
     * A celula do goblin e de 84, nao de 68, e com a amplitude de 3 dos
     * bichos de pe o desenho sobe para fora da propria celula a cada
     * passo. Com 2 ele fica dentro
     */
    walkBob: { amplitude: 2, frequency: 1.1 },

    animations: {
      /**
       * O IDLE APONTA PARA O BLOCO, NAO PARA A LINHA.
       *
       * `rowOffset` soma a direcao do goblin ao valor, e e assim que a
       * linha 8 vira "o idle para leste" e a 9 vira "o idle para
       * sudeste". Sao oito linhas de verdade na folha
       */
      idle: {
        rowOffset: GOBLIN_IDLE_ROW_OFFSET,
        start: 0,
        length: GOBLIN_IDLE_FRAMES,
        fps: GOBLIN_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: GOBLIN_WALK_FRAMES,
        fps: GOBLIN_WALK_FPS,
      },

      /**
       * O GOLPE CORPO A CORPO DEPENDE DE ALVO.
       *
       * O `needsTarget` impede que o goblin brandindo o taco apareca
       * no meio do mapa, longe de quem ele persegue
       */
      attack: {
        rowOffset: GOBLIN_ATTACK_ROW_OFFSET,
        start: 0,
        length: GOBLIN_ATTACK_FRAMES,
        fps: GOBLIN_ATTACK_FPS,
        needsTarget: true,
      },

      /**
       * A MORTE, E SO ELA, APONTA PARA `row`.
       *
       * A linha 24 existe uma vez na folha e serve para as oito
       * direcoes, que e o que a arte de origem entregou
       *
       * O `holdLast` e o que segura o cadaver no ultimo quadro. Sem ele
       * o `resolveFrame` faria o ciclo recomeçar quando o tempo passasse
       * de `9 / 18 = 0.5s`, e o cadaver voltaria ao primeiro quadro
       * durante o esmaecimento — voltando a cair, deitado e em pe, no
       * meio do fade
       */
      death: {
        row: GOBLIN_DEATH_ROW,
        start: 0,
        length: GOBLIN_DEATH_FRAMES,
        fps: GOBLIN_ATTACK_FPS,
        holdLast: true,
      },
    },
  }),

  frameWidth: GOBLIN_CELL,
  frameHeight: GOBLIN_CELL,

  /**
   * O TAMANHO DELE NA TELA: 0.896, e nao o 0.8 do padrao.
   *
   * O mesmo caminho dos outros tres: `* 1.4` e depois `* 0.8`. O goblin e o
   * mob do mapa 1, e ele nao tinha encolhido — o arbalist que cresceu
   */
  scale: 1,

  /**
   * O RITMO DA MORTE, e ele mora AQUI e nao no motor.
   *
   * `deathDuration` e o ciclo da animacao e `deathFade` e a janela de
   * esmaecimento depois que ele acabou. O motor le os dois e soma para
   * formar o relogio
   *
   * Cada criatura com arte de morte declara o seu par, porque o ritmo
   * e propriedade da arte: uma animacao de 12 quadros em 24fps e uma de
   * 6 em 10 precisam de tempos diferentes para durarem o mesmo
   */
  deathDuration: GOBLIN_DEATH_DURATION,
  deathFade: GOBLIN_DEATH_FADE,

  /**
   * A ANCORA VIER DO LOG DA FOLHA.
   *
   * Sao os numeros que `gif-to-sheet.mjs goblin` imprimiu: o pe fica em
   * y=69 e o corpo e centrado em x=41.5. A celula e de 84, entao a
   * ancora e um pouco diferente da do ogre, que era de 33.5 numa
   * celula de 68
   */
  anchorX: 41.5,
  anchorY: 69,
};

/**
 * O KAELEN, que era a Sentinela Esqueletica.
 *
 * ## A FOLHA E `kaelen-sheet.png`, COM 25 LINHAS
 *
 * A MESMA ordem do goblin, e pelo mesmo motivo:
 *
 * ```
 *   0.. 7  walk   (8 direcoes, 8 quadros)
 *   8..15  idle   (8 direcoes, 8 quadros)
 *  16..23  attack (8 direcoes, 9 quadros)
 *      24  death  (so o sul,   9 quadros)
 * ```
 *
 * ## POR QUE A CELULA E DE 88 E A DA SENTINELA ERA DE 68
 *
 * A arte veio misturada: os quatro angulos do norte e o `south` saem em
 * 88x88, os outros quatro em 84x84. A celula tem que ser a MAIOR, porque a
 * ferramenta recusa cortar pixel de arte — e cortar 4px cortaria a ponta
 * da lanca. A Sentinela usava 68 porque a arte dela toda era de 68
 *
 * ## O GOLPE DEIXOU DE SER TIRO
 *
 * A Sentinela era `ranged: true`, atirava de longe, e por isso o `attack`
 * antigo era arte de TIRO com o `needsTarget` obrigando alvo de verdade. O
 * Kaelen e corpo a corpo, entao o `attack` novo e a arte do golpe de perto
 * — e o `needsTarget` sai junto, pelo mesmo motivo do goblin: um mob longe
 * nao pode aparecer brandindo a arma no vazio
 */
const KAELEN_CELL = 88;

const KAELEN_WALK_FRAMES = 8;
const KAELEN_IDLE_FRAMES = 8;
const KAELEN_ATTACK_FRAMES = 9;
const KAELEN_DEATH_FRAMES = 8;

// o idle comeca depois das oito linhas de caminhada
const KAELEN_IDLE_ROW_OFFSET = 8;

// o golpe comeca depois das oito de caminhada e das oito de idle
const KAELEN_ATTACK_ROW_OFFSET = 16;

// a morte e a ultima linha, e a unica: nao ha direcao para somar
const KAELEN_DEATH_ROW = 24;

const KAELEN_WALK_FPS = 12;
const KAELEN_IDLE_FPS = 6;
const KAELEN_ATTACK_FPS = 14;

/**
 * O RITMO DA MORTE, e o MESMO do goblin.
 *
 * Os mesmos numeros de proposito: os dois tem 9 quadros de morte e o mesmo
 * comprimento de ciclo na arte. Divergir aqui faria o cadaver do Kaelen
 * ficar mais rapido ou mais lento que o do goblin sem que houvesse razao
 */
const KAELEN_DEATH_DURATION = 0.6;
const KAELEN_DEATH_FADE = 0.4;

export const KAELEN_SPRITE = {
  ...createDirectionalSpriteDefinition("skeleton", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,

    /**
     * O BALANCO E DE 2px, e nao os 3 da Sentinela.
     *
     * A celula subiu de 68 para 88, e com a amplitude de 3 o desenho sobe
     * para fora da propria celula a cada passo
     */
    walkBob: { amplitude: 2, frequency: 1.1 },

    animations: {
      /**
       * O IDLE APONTA PARA O BLOCO, E NAO PARA A LINHA.
       *
       * Sao oito linhas de idle na folha, uma por angulo, e e o `rowOffset`
       * que faz a linha 8 virar "o idle para leste" e a 9 virar "o idle para
       * sudeste". Com `row: 8` o Kaelen parado viraria de lado em qualquer
       * posicao do mapa
       */
      idle: {
        rowOffset: KAELEN_IDLE_ROW_OFFSET,
        start: 0,
        length: KAELEN_IDLE_FRAMES,
        fps: KAELEN_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: KAELEN_WALK_FRAMES,
        fps: KAELEN_WALK_FPS,
      },

      /**
       * O GOLPE CORPO A CORPO, e SEM `needsTarget`.
       *
       * A Sentinela tinha `needsTarget: true` porque era arte de tiro: sem
       * alvo de verdade ela nao podia disparar. O Kaelen e corpo a corpo, e
       * o golpe entra quando ele esta de fato atacando — e quem garante isso
       * e o `attackAnimation`
       */
      attack: {
        rowOffset: KAELEN_ATTACK_ROW_OFFSET,
        start: 0,
        length: KAELEN_ATTACK_FRAMES,
        fps: KAELEN_ATTACK_FPS,
      },

      /**
       * A MORTE, E SO ELA APONTA PARA `row`.
       *
       * A linha 24 existe uma vez na folha e serve para as oito direcoes.
       * Um `rowOffset` somaria a direcao do Kaelen a 24 e leria a linha 25
       * ou 26 — que nao existem, e o desenho viraria um retangulo vazio da
       * parte de baixo da imagem
       *
       * O `holdLast` segura o cadaver no ultimo quadro durante o
       * esmaecimento. Sem ele o ciclo recomeçaria e o corpo voltaria a se
       * mexer enquanto some
       */
      death: {
        row: KAELEN_DEATH_ROW,
        start: 0,
        length: KAELEN_DEATH_FRAMES,
        fps: KAELEN_ATTACK_FPS,
        holdLast: true,
      },
    },
  }),

  frameWidth: KAELEN_CELL,
  frameHeight: KAELEN_CELL,

  /**
   * O TAMANHO DELE NA TELA: 0.896, e nao o 0.8 do padrao.
   *
   * O `id` dele e `skeleton`, que e o que o mapa 2 usa no lugar do ogre. E o
   * mesmo caminho dos outros tres: `* 1.4` e depois `* 0.8`
   */
  scale: 1,

  /**
   * O RITMO, e ele mora AQUI e nao no motor.
   *
   * `deathDuration` e o ciclo e `deathFade` a janela de esmaecimento
   * depois que ele acabou. O motor soma os dois e forma o relogio
   */
  deathDuration: KAELEN_DEATH_DURATION,
  deathFade: KAELEN_DEATH_FADE,

  /**
   * A ANCORA VIER DO LOG DA FOLHA.
   *
   * Sao os numeros que `gif-to-sheet.mjs kaelen` imprimiu: o pe fica em
   * y=71 e o corpo e centrado em x=42.5. A celula e de 88, entao a ancora
   * nao pode ser a da Sentinela antiga, que era 33.5 numa celula de 68
   */
  anchorX: 42.5,
  anchorY: 71,
};

/**
 * QUEM TEM ANIMACAO DE MORTE.
 *
 * A lista e lida pelo motor para decidir se um inimigo morto continua
 * sendo desenhado. Um bicho que morre e nao esta aqui some na hora,
 * como antes: nao ha arte de morte para rodar e o `death` do layout
 * cairia no `idle`, com o cadaver de pe no lugar dele
 *
 * O criterio e a EXISTENCIA do bloco `death` no layout, e nao o id:
 * quem entra aqui e quem tem a arte, e o nome da criatura pode mudar
 * sem mexer nesta lista
 */
export function temMorte(definition) {
  if (!definition?.animations?.death) return false;

  /**
   * A ARTE SEM O RELOGIO NAO CHEGA A SUMIR.
   *
   * O motor soma `deathDuration + deathFade` para montar o relogio. Um
   * layout que declarasse o bloco `death` e esquecesse os dois campos
   * deixaria o relogio em zero, e o cadaver nunca entraria na condicao
   * de desenho — a arte estaria pronta e nunca apareceria
   *
   * E por isso que a funcao le os tres campos e nao so o bloco
   */
  return (
    definition.deathDuration > 0 && definition.deathFade > 0
  );
}

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
 * A SENTINELA ESQUELETICA FOI O SEXTO DIRECIONAL, E AGORA E O KAELEN.
 *
 * O layout antigo desta criatura saiu daqui: celula 68, idle de uma linha
 * so, `attack` de arco com `needsTarget` e nenhuma arte de morte. Tudo o
 * que ele fazia esta no `KAELEN_SPRITE`, mais a morte e o idle por direcao
 *
 * A historica dela, porque explica o que mudou no nome:
 *
 * - A arte veio em `assets/sprites/sentinela`: oito direcoes de caminhada,
 *   um `idle.gif` e um `shoot/` com as oito direcoes de golpe, todas em
 *   68x68. Era a arte mais limpa do jogo
 *
 * - O `attack` apontava para a linha do idle — o reserva do
 *   `resolveFrameRect` — ate as oito direcoes de `shoot/` chegarem de uma
 *   vez, e ele passar para a linha 9
 *
 * - O `needsTarget: true` existia porque ela era ATIRADORA: a arte de arco
 *   so entrava com alvo de verdade, para o esqueleto nao dar as costas
 *
 * O `id` continua `skeleton` porque e ele que esta no save, no bestiario e
 * nas missoes que pedem a caca. O nome na tela e o do Kaelen agora
 *
 * A pasta `sentinela` e o `sentinela_esqueletica-sheet.png` continuam no
 * disco como arte antiga: nenhum layout os le mais
 */

/**
 * O ESQUELETO: o SETIMO direcional, e o bicho de nivel 1.

/**
 * O ESQUELETO: o SETIMO direcional, e o bicho de nivel 1.
 *
 * A criatura continua com o id `slime`, e o id nao muda por causa de uma
 * troca de arte: ele esta no save, no bestiario, nas missoes e, o que
 * pesa mais, no `slime_gel` e no `slime_core` que o craft e as missoes
 * pedem. Um save com `slime_gel` pararia de casar com o item
 *
 * ## POR QUE NAO SE CHAMA "LIMO" MAIS
 *
 * Porque nao e mais um limo: a arte, o nome e o comportamento mudaram, e
 * o `id` e a identidade no jogo, nao o rotulo. `LIMO_PREGUICOSO_*` e
 * `ESQUELETO_*` sao as mesmas criaturas, e este arquivo inteiro e o
 * lugar onde a troca de nome aparece
 *
 * Celula 88x88 — a arte veio maior que as outras do jogo —, ancora
 * (43.5, 73) e as 17 linhas medidas pela ferramenta
 *
 * ## A LINHA DE GOLPE EXISTE, E O QUE FALTAVA
 *
 * O `slime` e PASSIVO e nunca atacava, entao nao havia animacao de golpe:
 * um pedido de "attack" caia no reserva do `resolveFrameRect`, que prefere
 * o `idle`. Agora a criatura RETALIA quem a bate, e a linha 9+ da folha e
 * o que mostra o golpe acontecendo
 */
const ESQUELETO_CELL = 88;

const ESQUELETO_WALK_FRAMES = 9;
const ESQUELETO_IDLE_FRAMES = 8;
const ESQUELETO_IDLE_ROW = 8;
const ESQUELETO_ATTACK_FRAMES = 9;
const ESQUELETO_ATTACK_ROW = 9;
const ESQUELETO_WALK_FPS = 10;
const ESQUELETO_IDLE_FPS = 5;
const ESQUELETO_ATTACK_FPS = 9;

export const ESQUELETO_SPRITE = {
  ...createDirectionalSpriteDefinition("slime", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,

    /**
     * O balanco e o MENOR de todos, e o FPS tambem.
     *
     * A criatura continua a `speed: 48` e passeia a `wanderSpeed: 30` — e
     * o bicho mais lento do jogo depois do rato. Um `amplitude` de 3px
     * faria um boneco de 45px pular mais do que anda, e a 10fps o ciclo
     * de 9 quadros dura 0.9s, o que num bicho lento fica com aspecto de
     * escorregar em vez de caminhar
     */
    walkBob: { amplitude: 2, frequency: 0.9 },

    animations: {
      // a linha do idle e uma linha INTEIRA da folha, entao o `row`
      // e obrigatorio: sem ele o `resolveFrameRect` usaria
      // `rowOffset ?? 0` e leria a linha 0, que e a caminhada para
      // leste, e o esqueleto parado viraria de lado
      idle: {
        row: ESQUELETO_IDLE_ROW,
        start: 0,
        length: ESQUELETO_IDLE_FRAMES,
        fps: ESQUELETO_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: ESQUELETO_WALK_FRAMES,
        fps: ESQUELETO_WALK_FPS,
      },

      /**
       * O GOLPE, com `needsTarget` como o da sentinela.
       *
       * `needsTarget: true` e o que impede o golpe de tocar no ar: o
       * `resolveCreatureAnimation` so pede "attack" quando ha alvo, e o
       * esqueleto so tem alvo travado depois de levar um golpe. Sem essa
       * flag o boneco anima o soco enquanto passeia
       */
      attack: {
        row: ESQUELETO_ATTACK_ROW,
        start: 0,
        length: ESQUELETO_ATTACK_FRAMES,
        fps: ESQUELETO_ATTACK_FPS,
        needsTarget: true,
      },
    },
  }),

  frameWidth: ESQUELETO_CELL,
  frameHeight: ESQUELETO_CELL,

  /**
   * O TAMANHO DELE NA TELA: 0.896, e nao o 0.8 do padrao.
   *
   * ## O ID DELE E `slime`, E E POR ISSO QUE ESTA ESCALA FICAVA ESCAPADA
   *
   * O `ENEMY_SPRITES` do cliente monta `slime` espalhando ESTE sprite, com
   * a arte da `esqueleto-sheet.png`. Ou seja: o bicho que o jogador chama de
   * esqueleto tem id `slime` no jogo
   *
   * E foi por isso que aumentar o `slime` na `ESCALA` nao fez nada: o
   * `ESCALA` monta o `slime` com celula de 32 e folha de tres linhas, e o
   * cliente sobrescreve essa entrada inteira. A escala que manda e a de
   * aqui — e ela nao existia, entao o esqueleto caia no 0.8 do padrao e
   * continuava do mesmo tamanho, igual antes do pedido
   *
   * ## POR QUE 0.896
   *
   * E `0.8 * 1.4 * 0.8`: os 40% maiores e depois os 20% menores, sobre o
   * tamanho que ele ja tinha. Ver a `NYLARA_SPRITE`, que tem a conta escrita
   */
  scale: 1,
  anchorX: 43.5,
  anchorY: 73,
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

/**
 * O HULK: O CHEFE DA ARENA.
 *
 * ## A MESMA ARTE DO GOBLIN, E UM CHEFE DIFERENTE
 *
 * A pasta de origem e `src/assets/sprites/hulk` — a mesma do Goblin
 * Saqueador, e a folha e uma saida nova (`hulk-sheet.png`) do mesmo
 * par de gifs. Sao duas criaturas com a mesma arte e numeros muito
 * diferentes: o goblin e de nivel 5 e semi-passivo, e o hulk e o chefe de
 * nivel 20
 *
 * ## AS CONSTANTES SAO DA FOLHA GERADA, NAO CHUTADAS
 *
 * Vem do log do `gif-to-sheet.mjs hulk`: 17 linhas (8 de caminhada, 1
 * de idle e 8 de golpe), 9 quadros na linha de golpe, celula 68x68 e
 * ancora (33.5, 55)
 *
 * O `SHOOT_ROW` e 9 e nao 0 porque o `attack` do `goblin` NAO tem linha
 * propria — a folha do goblin para na linha 8. Sao duas folhas
 * diferentes do mesmo material, e por isso as duas tem numeros
 * proprios
 */
const HULK_CELL = 68;
const HULK_WALK_FRAMES = 8;
const HULK_IDLE_FRAMES = 8;
const HULK_IDLE_ROW = 8;
const HULK_ATTACK_FRAMES = 9;
const HULK_ATTACK_ROW = 9;
const HULK_WALK_FPS = 10;
const HULK_IDLE_FPS = 5;
const HULK_ATTACK_FPS = 8;

/**
 * A ESCALA DO CHEFE E 2, E E O CAMPO QUE REALMENTE DESENHA.
 *
 * ## POR QUE ESTA ESCALA E NAO O `spriteScale` DO CATALOGO
 *
 * Sao dois campos com nomes parecidos que NAO falam a mesma coisa, e so
 * um deles chega na tela:
 *
 * - `spriteScale`, no catalogo de criaturas, e um numero que o desenho
 *   nunca le. Nenhum codigo de renderizacao o consulta — ele existe no
 *   objeto do inimigo e morre ali
 * - `scale`, aqui no layout, e o que o `resolveDrawRect` multiplica pela
 *   celula para saber quantos pixels o chefe ocupa
 *
 * Sem declarar este `scale`, o `createDirectionalSpriteDefinition` cai no
 * `DIRECTIONAL_SCALE`, que e 1 — e o chefe aparecia com 68px, MENOR que
 * o boneco do jogador (que e `SCALE = 2` na folha de classe). Um chefe
 * de nivel 20 com metade do tamanho de quem ele persegue
 *
 * ## POR QUE 2, E NAO "O MAIOR DO JOGO"
 *
 * Com 2, o Hulk fica em 68x2 = 136px: o mesmo tamanho do jogador. E o
 * que o dobro do desenho que estava na tela pediu, e ja e o dobro de um
 * goblin (68px, `scale` 1). Ir alem de 2 e造 escolha de design, nao
 * correcao — se um dia o chefe tiver de dominar a tela de verdade, esse
 * numero e o lugar, mas 3 seria maior que o jogador e nao e o que foi
 * pedido aqui
 */
const HULK_SCALE = 2;

export const HULK_SPRITE = {
  ...createDirectionalSpriteDefinition("hulk", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,

    /**
     * O balanco e de 2px, e nao os 3 dos bichos de pe medio.
     *
     * O hulk e o maior inimigo do jogo e ele anda devagar
     * (`speed` baixa de proposito, para a luta ser de posicao e nao de
     * perseguicao). Com 3px de amplitude e `spriteScale` grande, o
     * desenho sobe para fora da propria celula a cada passo
     */
    walkBob: { amplitude: 2, frequency: 0.8 },

    /**
     * A escala que vai para a tela, 2. Ver `HULK_SCALE`: e este campo,
     * e nao o `spriteScale` do catalogo, que decide o tamanho do chefe
     */
    scale: HULK_SCALE,

    animations: {
      // a linha do idle e uma linha INTEIRA da folha: sem o `row`, o
      // `resolveFrameRect` leria a linha 0 (caminhada para leste) e o
      // chefe parado viraria de lado
      idle: {
        row: HULK_IDLE_ROW,
        start: 0,
        length: HULK_IDLE_FRAMES,
        fps: HULK_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: HULK_WALK_FRAMES,
        fps: HULK_WALK_FPS,
      },

      /**
       * O GOLPE NA LINHA DELE, e sem `needsTarget`.
       *
       * A sentinela e o zumbi botam `needsTarget: true` porque a arte de
       * arco so entra com alvo de verdade. O hulk e corpo a corpo e o
       * golpe dele e um `./target` na sua frente: com a exigencia, ele
       * levantaria o braco para o ar toda vez que entrasse na janela de
       * golpe sem ter alvo mirado, que no boss e a janela inteira
       */
      attack: {
        row: HULK_ATTACK_ROW,
        start: 0,
        length: HULK_ATTACK_FRAMES,
        fps: HULK_ATTACK_FPS,
      },
    },
  }),

  frameWidth: HULK_CELL,
  frameHeight: HULK_CELL,
  anchorX: 33.5,
  anchorY: 55,
};

/**
 * O CHEFE DO VALE, COM A ARTE DE `boss_vale/`.
 *
 * ## POR QUE UM REGISTRO NOVO, E NAO O `hulk` APONTANDO PARA O MESMO
 *
 * Porque `getEnemySprite` resolve pelo `typeId`, e o chefe do vale tem o
 * `typeId` `hulk_val`. Se os dois apontassem para o mesmo objeto, o `scale`
 * seria o mesmo e o chefe do vale sairia do mesmo tamanho do da arena — que
 * e o oposto de "outra criatura"
 *
 * ## OS NUMEROS SAO A SAIDA DA FERRAMENTA, NAO MEDIDOS A MAO
 *
 * `tools/gif-to-sheet.mjs boss_vale` imprime estes numeros e valida a folha
 * gerada: 200 celulas, 0 divergencia com o PNG, 0 celula encostando na borda e
 * 0 vazia. Copiar daqui e nao da folha e o que mantem os dois lados de acordo
 * na proxima regeracao da arte
 *
 * ## A ESCALA E 2, E A CELULA E 168
 *
 * A celula nova e 168 e a antiga era 68, entao o desenho na tela vai de
 * 68 x 2 = 136px para 168 x 2 = 336px. O chefe do vale e o maior desenho do
 * jogo por uma margem larga — e o `radius: 96` do catalogo agora e poco mais
 * de um quarto do corpo, entao o colisor merece revisao se o desenho ficar
 * grande demais na tela
 *
 * O IDLE E POR DIRECAO, entao usa `rowOffset` e nunca `row`: com `row`, o
 * `resolveFrameRect` leria sempre a linha 0 e o chefe parado viraria de lado
 */
const BOSS_VALE_CELL = 168;
const BOSS_VALE_WALK_FRAMES = 8;
const BOSS_VALE_IDLE_FRAMES = 8;
const BOSS_VALE_IDLE_ROW_OFFSET = 8;
const BOSS_VALE_ATTACK_FRAMES = 9;
const BOSS_VALE_ATTACK_ROW_OFFSET = 16;
const BOSS_VALE_SCALE = 2;

export const BOSS_VALE_SPRITE = {
  ...createDirectionalSpriteDefinition("boss_vale", SEM_IMAGEM, {
    directions: ARBALIST_DIRECTIONS,

    /**
     * O mesmo balanco de 2px do `hulk`, e pelo mesmo motivo: o chefe e grande
     * e anda devagar, e amplitude maior com `scale` grande empurra o desenho
     * para fora da propria celula a cada passo
     */
    walkBob: { amplitude: 2, frequency: 0.8 },

    scale: BOSS_VALE_SCALE,

    animations: {
      idle: {
        rowOffset: BOSS_VALE_IDLE_ROW_OFFSET,
        start: 0,
        length: BOSS_VALE_IDLE_FRAMES,
        fps: HULK_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: BOSS_VALE_WALK_FRAMES,
        fps: HULK_WALK_FPS,
      },

      /**
       * O GOLPE, sem `needsTarget`.
       *
       * Corpo a corpo: o golpe e um `./target` na frente dele. Com a exigencia
       * ele levantaria o braco para o ar toda vez que entrasse na janela sem
       * alvo mirado — e no chefe a janela e quase sempre
       */
      attack: {
        rowOffset: BOSS_VALE_ATTACK_ROW_OFFSET,
        start: 0,
        length: BOSS_VALE_ATTACK_FRAMES,
        fps: HULK_ATTACK_FPS,
      },
    },
  }),

  frameWidth: BOSS_VALE_CELL,
  frameHeight: BOSS_VALE_CELL,

  /**
   * A ANCORA E A DA FERRAMENTA: 83.5 de X e 142 de Y numa celula de 168.
   *
   * O `Y` de 142 e a linha do PE — a arte desenhada termina ali, e o resto da
   * celula embaixo e transparente. E o que faz o chefe ficar com o pe no
   * chao em vez de afundar nele
   */
  anchorX: 83.5,
  anchorY: 142,
};

/**
 * O HULK DO VALE AGORA USA A ARTE PROPRIA.
 *
 * O registro antigo — `...HULK_SPRITE` com `scale: 3` — foi removido: a folha
 * e a celula mudaram, e reaproveitar a folha do `hulk` da arena deixaria dois
 * chefes com a mesma cara
 */
export const ENEMY_SPRITES = {
  ...Object.fromEntries(
    Object.entries(ESCALA).map(([id, scale]) => [
      id,
      createEnemySpriteDefinition(id, SEM_IMAGEM, scale),
    ]),
  ),

  // os direcionais: a chave e o `id` da criatura, e e assim que o
  // `GameEngine` acha o sprite de um inimigo

  /**
   * A NYLARA, que era o Arqueiro Zumbi, e nao tem `ESCALA` acima.
   *
   * O `ESCALA` monta as criaturas de folha antiga, de celula 32 e tres
   * linhas. O arqueiro nunca entrou la — ele ja era direcional — e a
   * Nylara segue fora dele pelo mesmo motivo
   */
  zumbi_arbalist: NYLARA_SPRITE,

  /**
   * O KAELEN, e o `ESCALA` acima nao tem mais `skeleton`.
   *
   * O `ESCALA` monta as criaturas de folha antiga, de celula 32 e tres
   * linhas. A sentinela saiu de la quando virou direcional, e agora o
   * `skeleton` aponta para o `KAELEN_SPRITE` de celula 88 — que e o que
   * faz este registro ganhar precedencia sobre o `ESCALA` acima
   */
  skeleton: KAELEN_SPRITE,

  /**
   * O GOBLIN DO MAPA 1, nos DOIS ids.
   *
   * ## POR QUE AS DUAS CRIATURAS COMPARTILHAM A FOLHA
   *
   * `ogre` e o goblin da pedreira, niveis 8 a 12. `ogre_da_predeira` e o
   * goblin do Campo de Provas, nivel 7. Os dois sao o mesmo bicho: mesmo
   * preco, mesmo couro, mesmas numeros base, mesma cara
   *
   * Antes cada um tinha a sua folha — as duas apontavam para a de 68 do
   * ogre — e o jogo mostrava "Ogre da Pedreira" e "Ogre da Predeira" como
   * se fossem bichos diferentes. Sao o mesmo mob em degraus de nivel
   * diferentes, que e como a escada do mapa esta construida
   *
   * ## O `id` DE CADA UM CONTINUA O SEU
   *
   * Sao chaves de save: o `ogre_da_predeira` e a chave das tres cacadas de
   * bestiario, da missao do nivel 7 e da entrega do couro `ogre_hide`. Unir
   * os dois ids apagaria o progresso de quem ja fez tudo isso
   */
  ogre_da_predeira: GOBLIN_SPRITE,
  ogre: GOBLIN_SPRITE,

  // o ghoul faminto SUBSTITUI a arte antiga de folha pequena: a
  // chave e a do mesmo `id` de criatura, entao este registro tem
  // precedencia sobre o `createEnemySpriteDefinition` acima
  ghoul: GHOUL_FAMINTO_SPRITE,

  // o boneco de madeira. Os OUTROS seis bonecos nao tem arte e
  // continuam no corpo vetorial, que e o que o registro decide
  // quando nao conhece o tipo
  dummy_warrior: BONECO_MADEIRA_SPRITE,

  /**
   * O HULK, o chefe da arena.
   *
   * Nao entra pelo `createEnemySpriteDefinition` acima porque e
   * DIRECIONAL e tem linha de golpe propria: o `ESCALA` acima monta as
   * criaturas de folha pequena, que nao tem nem idle nem ataque
   */
  hulk: HULK_SPRITE,

  /**
   * O HULK DO VALE, o `typeId` novo que o chefe do centro usa.
   *
   * Aponta para o `BOSS_VALE_SPRITE`: a arte de `boss_vale/`, celula de 168 e
   * escala 2. Antes apontava para o `HULK_SPRITE` com escala 3 — a mesma
   * folha da arena, o que deixava os dois chefes com a mesma cara
   *
   * Sem esta linha o `getEnemySprite("hulk_val")` devolveria `null` e o chefe
   * apareceria sem arte nenhuma
   */
  hulk_val: BOSS_VALE_SPRITE,
};

export function getEnemySprite(creatureId) {
  return ENEMY_SPRITES[creatureId] ?? null;
}
