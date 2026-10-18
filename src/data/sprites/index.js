/**
 * Os sprites: layout + a imagem de cada um.
 *
 * A URL vem de `new URL(..., import.meta.url)`, e nao de
 * `import url from "warrior.png"`. O Node resolve isso para uma
 * string sem abrir o arquivo; com o `import` de `.png`, este
 * modulo derrubava o processo do servidor com
 * ERR_UNKNOWN_FILE_EXTENSION, porque o motor e importado por ele
 * para rodar a simulacao sem DOM. O Vite continua reescrevendo
 * para o asset bundlado, entao a imagem no jogo e a mesma.
 */
import {
  SPRITE_FORMAT,
  ARBALIST_DIRECTIONS,
  WARRIOR_DIRECTIONS,
  WARRIOR_SPRITE as WARRIOR_LAYOUT,
  SORCERER_DIRECTIONS,
  SORCERER_SPRITE as SORCERER_LAYOUT,
  LANCER_DIRECTIONS,
  LANCER_SPRITE as LANCER_LAYOUT,
  createDirectionalSpriteDefinition,
} from "./layout.js";

const ARBALIST_SHEET = new URL(
  "../../assets/sprites/arbalist-sheet.png",
  import.meta.url,
).href;

/**
 * A FLECHA DO ARBALIST, e o efeito que vai no LUGAR do tiro.
 *
 * ## ESTA E A FLECHA ISOLADA, E NAO A DO GIF
 *
 * A primeira versao usava a animacao de 8 quadros de `hit_basic/hit.gif`, com
 * o rastro verde pulsando. Trocada pela `flecha_isolada.png`, que e a MESMA
 * flecha sem a trilha de rastro — o jogador pediu a troca por ela ficar
 * melhor, e concorda: a arte isolada le como uma flecha em vez de um efeito
 *
 * ## O QUE A TROCA CUSTOU: A ANIMACAO
 *
 * O PNG tem UM quadro, entao a animacao do rastro foi com ele. O tiro agora
 * e uma seta estatica que voa. `frames: 1` abaixo e o que declara isso, e e
 * de proposito — nao e um valor que esqueci de atualizar
 *
 * ## POR QUE 90 GRAUS A MAIS
 *
 * O arquivo vem de pe: 70x295, com a ponta em cima. O motor gira o projetil
 * com `atan2(vy, vx)`, o que so funciona com a arte ja apontando para a
 * DIREITA. `tools/girar-flecha.mjs` faz esse giro e mede a arte
 *
 * ## POR QUE NAO ENTRA NA FOLHA DO ARBALIST
 *
 * Porque a folha do arquiro e uma grade DIRECIONAL de celulas 84x84. Esta
 * imagem e 295x70 depois de girada — um retangulo de 4:1. O
 * `resolveFrameRect` fatia a folha com `frameWidth` do sprite INTEIRO, e uma
 * linha desto leria um pedaco de cada quadro, e a flecha sairia cortada
 *
 * ## POR QUE UM PNG E NAO UMA FOLHA
 *
 * Porque com UM quadro nao ha linha para varrer: o eixo X era o tempo na
 * animacao do rastro, e sem rastro o eixo sumiu
 */
export const ARBALIST_FLECHA = {
  src: new URL(
    "../../assets/sprites/arbalist-flecha.png",
    import.meta.url,
  ).href,

  frameWidth: 295,
  frameHeight: 70,

  /** UM quadro. A arte do rastro foi trocada por uma imagem so */
  frames: 1,

  /**
   * O `fps` NAO E USADO com `frames: 1`, mas fica declarado.
   *
   * Sem ele, um `fps` faltando viraria `NaN` no `resolveFrame` e o motor
   * deixaria de desenhar o tiro inteiro. Um numero morta e melhor que um
   * buraco no objeto
   */
  fps: 1,

  /**
   * A ESCALA, e ela e o que decide o tamanho da flecha na tela.
   *
   * A arte visivel mede 282x50 (`girar-flecha.mjs`). A primeira versao casou
   * exatamente o tiro vetorial antigo — 23px, e `23 / 282 = 0,082` — e ficou
   * fina demais na tela: o tiro e rapido e o jogador quase nao via a arte
   *
   * Este valor da ~30px, o TEORICO de tamanho util. Acima disso a flecha
   * comeca a cobrir o mob que ela acerta, e um tiro que esconde o alvo e pior
   * do que um tiro pequeno
   *
   * ## O QUE FALTA AUMENTAR AGORA
   *
   * O comprimento. A 30px a flecha esta no limite, e o que continua magro e a
   * ALTURA: 5,3px contra os 12px do tiro vetorial antigo. Se ela ainda parecer
   * pequena depois deste aumento, o proximo passo nao e mais o `scale` — e dar
   * uma `alturaMinima` para a arte, ou trocar por uma arte mais encorpada
   */
  scale: 0.107,

  /**
   * O CENTRO DA ARTE, e nao o canto nem o centro da celula.
   *
   * O `projectile.x/y` do motor e o PONTO que voa, e a arte tem 10px de
   * margem transparente em cima e 10 em baixo (visivel de y=10 a y=59 numa
   * celula de 70). Ancorar no canto colocaria a flecha inteira deslocada, e o
   * tiro pareceria errar o alvo
   */
  anchorX: 147,
  anchorY: 35,

  /** quem usa esta arte; as outras classes seguem com o tiro vetorial */
  classId: "arbalist",
};

/**
 * O PROJETIL BASICO DO SORCERER: a esfera azul com o rastro de faiscas.
 *
 * ## O QUE ESTA ARTE E, E POR QUE NAO E UM SPRITE DE PERSONAGEM
 *
 * A pasta `attack/` do sorcerer ja tem a pose de oito direcoes, e ela continua
 * valendo — o boneco continua levantando o cajado como sempre. O que esta aqui
 * e o QUE VOA: a esfera que sai da mao
 *
 * ## POR QUE A FOLHA E UMA FAIXA E NAO UMA GRADE
 *
 * Porque o gif e uma faixa de VFX em laco, nao uma pose. Sao 122x25 por quadro,
 * e dentro de cada quadro a esfera atravessa da esquerda para a direita: a
 * cabeca vai de x=30,5 no primeiro quadro a x=109,5 no ultimo, em passos de
 * ~11,3px. Eixo X e tempo, entao a folha e uma linha so
 *
 * Gerada por `tools/gerar-projetil-sorcerer.mjs`, no mesmo formato da flecha
 */
export const SORCERER_PROJETIL = {
  src: new URL(
    "../../assets/sprites/sorcerer-projetil-sheet.png",
    import.meta.url,
  ).href,

  frameWidth: 122,
  frameHeight: 25,

  frames: 8,

  /**
   * O `fps` E O DO PROPRIO GIF: oito quadros de 80ms, 0,64s por ciclo.
   *
   * Ler o delay real em vez de inventar um numero e o que mantem a arte com a
   * cadencia que o desenho tem — e o ciclo fecha certo em 0,64s
   */
  fps: 12.5,

  /**
   * A ESCALA. A esfera mede 12x16 na arte, e aqui ela vira ~14x19 na tela.
   *
   * E de proposito proximo do tiro vetorial antigo, que era uma bola de raio 10
   * — 20px de diametro. Uma esfera de ataque basico maior que isso comeca a
   * cobrir o mob que ela acerta, e um tiro que esconde o alvo e pior do que um
   * tiro pequeno
   *
   * A faixa inteira tem 146px, mas quase tudo e transparente: o conteudo
   * visivel de cada quadro ocupa 43 a 56px, que e o comprimento do cometa
   */
  scale: 1.2,

  /**
   * A POSICAO DA ESFERA EM CADA QUADRO — e nao um `anchorX` so.
   *
   * ## POR QUE UM ANCOR POR QUADRO E NAO UM PONTO FIXO
   *
   * Porque a esfera NAO esta parada dentro do quadro: ela viaja. Ancorando no
   * centro da celula (x=61), a esfera passaria de 30,5 a 109,5 e passearia
   * ~45px para um lado e para o outro em volta do ponto do projetil. O tiro
   * pareceria errar o alvo e voltar
   *
   * ## O QUE FAZ ESTA LISTA
   *
   * Prende a esfera no ponto do projetil e deixa o rastro pulsar atras. E o
   * classico cometa: a cabeca fica, a cauda brilha
   *
   * Os valores sao medidos pelo `tools/gerar-projetil-sorcerer.mjs`, que acha a
   * cabeca pela ALTURA da coluna — a esfera e alta (~16px) e o rastro e fino
   * (~5px). Nao sao numeros escritos a mao
   */
  ancorasPorQuadro: [
    [30.5, 11.5],
    [41.5, 12.5],
    [53, 11.5],
    [64.5, 11.5],
    [75.5, 11.5],
    [86.5, 11],
    [98, 11.5],
    [109.5, 11.5],
  ],

  classId: "sorcerer",
};

const WARRIOR_SHEET = new URL(
  "../../assets/sprites/warrior-sheet.png",
  import.meta.url,
).href;

const SORCERER_SHEET = new URL(
  "../../assets/sprites/sorcerer-sheet.png",
  import.meta.url,
).href;

const LANCER_SHEET = new URL(
  "../../assets/sprites/lancer-sheet.png",
  import.meta.url,
).href;

/**
 * O guerreiro com a imagem, a partir do guerreiro SEM imagem.
 *
 * A definicao vive em dois arquivos porque o servidor importa o motor
 * e nao tem pixels: `layout.js` traz celula, ancora, direcoes e as
 * linhas de animacao, e aqui so entra o que o cliente tem a mais — a
 * URL e a caixa do desenho.
 *
 * O guerreiro nao repete nenhum numero. Copiar a celula, a
 * ancora e as linhas de animacao aqui seria tantas chances de este
 * arquivo ficar para tras quantas forem as medidas, e a falha seria
 * silenciosa: cada `drawImage` recortaria a folha no lugar errado e
 * o boneco apareceria deslocado, sem nada no console
 *
 * O arquiro ainda repete, e nao porchoice: ele foi o primeiro e a
 * duplicacao dele vem de antes desta conversa. Quem trocar o
 * `layout.js` dele tem de lembrar deste ponto
 */
export const WARRIOR_SPRITE = {
  ...WARRIOR_LAYOUT,
  src: WARRIOR_SHEET,

  /**
   * A caixa do DESENHO dentro da celula de 96x96, medida do PNG.
   *
   * ## POR QUE SUBIU DE 50x45 PARA 49x63
   *
   * E a UNIAO DO IDLE INTEIRO, as oito direcoes e os oito quadros de cada
   * uma — a mesma regra que o lancer e o sorcerer seguem, e a mesma do
   * `idleUnion()` dos testes deles
   *
   * A largura ficou parecida e a altura quase dobrou, porque a celula subiu
   * de 68 para 96: a arte antiga ocupava 50x45 com 11px de margem em cima e
   * 13 embaixo, e a nova ocupa dos pixels 14 aos 76 — o desenho vai ate bem
   * mais perto do pe da celula
   *
   * E o `contentBox` que faz o retrato da tela de selecao pegar o DESENHO e
   * nao a margem transparente: sem ele o boneco sairia pequeno, com vao de
   * cada lado
   *
   * ## E NAO A MAIOR DE TODAS AS LANES
   *
   * O `attack/south` e largo (9..90) porque a espada sai do corpo. Pegar a
   * union dele aqui espremeria o idle, que e o retrato, e a arte apareceria
   * pequena. E o que os outros dois fazem
   */
  contentBox: { x: 25, y: 14, width: 49, height: 63 },
};

/**
 * O sorcerer com a imagem, a partir do sorcerer SEM imagem.
 *
 * Mesmo contrato do guerreiro: o `layout.js` traz celula, ancora,
 * direcoes, escala e as linhas de animacao, e aqui so entram a URL e
 * a caixa do desenho
 */
export const SORCERER_SPRITE = {
  ...SORCERER_LAYOUT,
  src: SORCERER_SHEET,

  /**
   * A caixa do DESENHO dentro da celula de 96x96, medida do PNG.
   *
   * ## POR QUE MUDOU DE NOVO COM A ARTE NOVA
   *
   * A caixa anterior (7, 13, 112x102) era de uma celula de 132 com arte de
   * 128: na celula de 96 ela passaria da borda e o retrato mostraria o boneco
   * cortado
   *
   * E e a UNICA coisa que esta caixa faz: e ela que enche o quadrado do
   * retrato com o PERSONAGEM, e nao com a margem transparente. Sem ela, o
   * sorcerer sairia pequeno e levemente alto no retrato
   *
   * ## E A MAIOR DE TODOS OS QUADROS, INCLUINDO A MINERACAO
   *
   * Medida nos 32 grupos de 8 direcoes da folha: `walk` vai de x=23 a 71,
   * `idle` de 19 a 75, `attack` de 12 a 83 e `mining` de 7 a 79. A uniao e
   * 7..83 em X e 10..84 em Y
   *
   * A `mining` e a que manda nos dois extremos: o cajado entra de lado a
   * lado e o movimento de baixo levanta o boneco. Medir num quadro de
   * caminhada daria uma caixa estreita, e o cajado da picareta sairia
   * cortado pela metade
   */
  contentBox: { x: 7, y: 10, width: 77, height: 75 },
};

/**
 * O lancer com a imagem, a partir do lancer SEM imagem.
 *
 * Mesmo contrato do guerreiro e do sorcerer: o `layout.js` traz
 * celula, ancora, direcoes e as linhas de animacao, e aqui so entram
 * a URL e a caixa do desenho. O `attack` do lancer aponta para a
 * linha de idle enquanto nao houver arte de golpe — ele e corpo a
 * corpo e a pasta de origem nao trouxe arte nenhuma de ataque
 */
export const LANCER_SPRITE = {
  ...LANCER_LAYOUT,
  src: LANCER_SHEET,

  /**
   * A caixa do DESENHO dentro da celula de 68x68, medida do PNG.
   *
   * O lancer ocupa 49x44 no idle inteiro, os oito quadros: 9px de
   * margem transparente de cada lado, 10 em cima e 14 embaixo. E mais
   * largo que o do sorcerer (41x47) porque a Lanca entra de lado a
   * lado nos quadros de virada
   *
   * A caixa cobre o idle INTEIRO: a arte muda de largura de quadro
   * para quadro, e o quadro 1 chega em x=57 enquanto o 6 para em
   * x=55. Uma caixa medida num unico quadro cortaria a lanca pela
   * metade
   */
  contentBox: { x: 9, y: 10, width: 49, height: 44 },
};

export const ARBALIST_SPRITE = createDirectionalSpriteDefinition(
  "arbalist",
  ARBALIST_SHEET,
  {
    directions: ARBALIST_DIRECTIONS,
    walkBob: { amplitude: 4, frequency: 1.5 },

    /**
     * A CELULA SUBIU DE 84 PARA 96.
     *
     * A arte de `new_arbalist_2` foi regerada maior: as 25 lanes medem 92x92
     * e a folha saiu de 84x84 porque o arco do arquiro encosta na borda em
     * quatro quadros das diagonais. Sem declarar isto, o `resolveFrameRect`
     * leria um pedaco de 84 de cada quadro de 96 e o boneco sairia cortado —
     * e nao deslocado, que e o defeito mais enganoso: parece arte ruim e e
     * numero velho
     *
     * ## O `scale` E 1.1 E NAO O 0.952 DO `layout.js`
     *
     * A constante `ARBALIST_SCALE`, no `layout.js`, ainda vale 0.952, mas
     * este bloco monta o sprite FINAL e sobrescreve o valor. Quem precisar do
     * tamanho na tela do arqueiro tem de usar o 1.1 daqui
     *
     * Com 1.1, a celula sai com 105.6px e o personagem com 62.7px. Foi esse
     * numero que calibrou a `SORCERER_SCALE`: usar o 0.952 por engano deixa o
     * sorcerer 13% menor que o arqueiro na tela
     */
    frameWidth: 96,
    frameHeight: 96,
    scale: 1.1,

    /**
     * A ANCORA da arte, medida na folha gerada.
     *
     * Estes numeros sao os que o `gif-to-sheet.mjs` mediu e imprimiu na
     * geracao da arte nova: o pe do arquiro esta a **75** na celula de 96,
     * e nao a 77 como na arte anterior. O `anchorY` e o que decide a
     * altura do boneco no chao — sem declarar isto, o arquiro andaria 2px
     * dentro do chao em todas as direcoes
     *
     * O `anchorX` foi de 47.5 para 48: o desenho novo esta meia unidade a
     * mais para a direita, e o `alignAnchors` alinha o centro do corpo pela
     * mediana das oito lanes
     */
    anchorX: 48,
    anchorY: 75,

    /**
     * A caixa do DESENHO dentro da celula de 96x96, medida na folha.
     *
     * E a UNIAO das oito lanes de idle — 26..71 na horizontal e 17..75 na
     * vertical — e nao a caixa do tiro, que e muito mais larga: com o arco
     * estendido o `south` do tiro vai de 25 a 84, e usar essa caixa faria o
     * arquiro sair pequeno no retrato da tela de selecao, com o arco
     * ocupando metade do quadrado vazio
     *
     * E a MAIOR entre os quadros de cada lane, e nao a medida num so: a
     * arte muda de altura entre os quadros do idle, que e a propria
     * animacao de respirar, e um quadro mais curto sai com uma linha
     * transparente
     *
     * ## ESTA CAIXA MUDOU COM A ARTE NOVA
     *
     * Era `20..76 x 13..77` (57x65). A arte nova e mais ENTAIXADA: o
     * desenho ocupa 46x65 em vez de 57x65. Nao e a mesma arte encolhida —
     * o `south` do tiro chega a 84 de largura, quase o dobro do idle, e o
     * arco de verdade e a prova de que a folga nao foi perdida
     *
     * E o que deixa o retrato com a arte preenchendo o quadrado e centrada
     * no PERSONAGEM, e nao na margem transparente
     */
    contentBox: { x: 26, y: 17, width: 46, height: 59 },

    animations: {
      /**
       * O idle tem **9** quadros, e e **POR DIRECAO**.
       *
       * A pasta `idle/` trouxe um gif para cada um dos oito angulos, igual
       * a `walk/`. Antes era um `idle.gif` unico na raiz, lido por `row`
       * fixo; agora cada angulo ocupa a sua linha e o bloco usa `rowOffset`
       *
       * Sao dois jeitos diferentes de apontar a mesma folha. Deixar `row`
       * aqui mostraria sempre o idle do leste, com o boneco parado de lado
       * enquanto o jogador olha para o norte
       *
       * ## E O `length` SUBIU DE 8 PARA 9
       *
       * A arte nova de `idle/` tem nove quadros em todas as oito direcoes.
       * Deixar em 8 nao dava erro: a folha tem os nove, e o ciclo so
       * ignorava o ultimo. O sintoma era o arquiro perdendo a volta final
       * da respiracao — uma animacao que nao fecha, visivel mais no idle
       * do sul, que e o angulo mais parado do jogo
       */
      idle: {
        rowOffset: 8,
        start: 0,
        length: 9,
        fps: 5,
      },
      walk: { start: 0, length: 8, fps: 12 },
      attack: {
        rowOffset: 16,
        start: 0,
        length: 9,
        fps: 20,
        needsTarget: true,
      },

      /**
       * A PICARETA, EM LOOP, POR DIRECAO, a partir da linha 24.
       *
       * ## POR QUE `rowOffset: 24`, E NAO `row: 24`
       *
       * Era uma linha so, lida por `row`: a arte de mineracao tinha vindo
       * so do sul. Agora `mining/` tem um gif por angulo, e o ciclo segue
       * o lado de onde o jogador chegou na pedra — quem chega pelo norte
       * soca para o norte, e nao para baixo
       *
       * A folha foi de 25 para 32 linhas: as sete novas sao esses angulos.
       * `rowOffset` sem elas apontaria para o tiro, que fica em 16..23
       *
       * Sem `holdLast`: o bloco segura a animacao no ultimo quadro, e ele e
       * da MORTE. Aqui faria o arquiro socar uma vez e ficar com a picareta
       * no chao ate parar de minerar
       */
      mining: {
        rowOffset: 24,
        start: 0,
        length: 9,
        fps: 10,
      },
    },
  },
);

/**
 * Cada classe com a SUA imagem, escrita por extenso.
 *
 * Estas URLs nao podem ser montadas num template: o Vite so
 * empacota o `new URL` quando o caminho e um literal. Com
 * `new URL(\`.../${nome}.png\`, import.meta.url)` o build passa
 * sem reclamar, o caminho continua apontando para
 * `src/assets/sprites/xxx.png`, que NAO existe no `dist`, e o
 * sprite some em producao sem erro no console de build. Era o
 * que acontecia com as oito classes; agora sao quatro literais.
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

export {
  SPRITE_FORMAT,
  ARBALIST_DIRECTIONS,
  WARRIOR_DIRECTIONS,
  SORCERER_DIRECTIONS,
  LANCER_DIRECTIONS,
};