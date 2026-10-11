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
 * O guerreiro nao repete nenhum numero. Copiar a celula de 68, a
 * ancora de 55 e as linhas 8 e 9 aqui seria três chances de este
 * arquivo ficar para tras, e a falha seria silenciosa: cada
 * `drawImage` recortaria a folha no lugar errado e o boneco
 * apareceria deslocado, sem nada no console
 *
 * O arquiro ainda repete, e nao porchoice: ele foi o primeiro e a
 * duplicacao dele vem de antes desta conversa. Quem trocar o
 * `layout.js` dele tem de lembrar deste ponto
 */
export const WARRIOR_SPRITE = {
  ...WARRIOR_LAYOUT,
  src: WARRIOR_SHEET,

  /**
   * A caixa do DESENHO dentro da celula de 68x68, medida do PNG.
   *
   * O guerreiro ocupa 50x45: 9px de margem transparente de cada
   * lado, 11 em cima e 13 embaixo. E o `contentBox` que deixa o
   * retrato da tela de selecao com a arte preenchendo o quadrado e
   * centrada no PERSONAGEM, e nao na margem
   *
   * A caixa cobre o idle INTEIRO, os oito quadros. A arte muda de
   * largura de quadro para quadro (o peso da espada entra e sai) e a
   * caixa e a maior de todos: um quadro mais estreito sai com mais
   * transparente de cada lado, o que nao aparece
   */
  contentBox: { x: 9, y: 11, width: 50, height: 45 },
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
   * A caixa do DESENHO dentro da celula de 132x132, medida do PNG.
   *
   * ## POR QUE MUDOU COM A ARTE NOVA
   *
   * A caixa antiga era de uma celula de 68 com arte de 41x47. A arte nova
   * ocupa 112x102 numa celula de 132, e a caixa antiga deixaria de envolver o
   * personagem: o retrato da tela de selecao mostraria o boneco cortado
   *
   * E e a UNICA coisa que esta caixa faz: e ela que enche o quadrado do
   * retrato com o PERSONAGEM, e nao com a margem transparente. Sem ela, o
   * sorcerer sairia pequeno e levemente alto no retrato
   *
   * ## E POR QUE A MAIOR DE TODOS OS QUADROS
   *
   * Porque o cajado entra e sai de lado a lado, e o golpe e o ciclo que mais
   * alarga. Medir num quadro de caminhada daria uma caixa estreita, e o
   * cajado do golpe sairia cortado pela metade
   */
  contentBox: { x: 7, y: 13, width: 112, height: 102 },
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