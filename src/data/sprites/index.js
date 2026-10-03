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
 * direcoes e as linhas de animacao, e aqui so entram a URL e a caixa
 * do desenho. O `attack` do sorcerer aponta para a linha de idle
 * enquanto nao houver arte de ataque — ver `SORCERER_SPRITE` no
 * `layout.js`
 */
export const SORCERER_SPRITE = {
  ...SORCERER_LAYOUT,
  src: SORCERER_SHEET,

  /**
   * A caixa do DESENHO dentro da celula de 68x68, medida do PNG.
   *
   * O sorcerer ocupa 41x47 no idle inteiro, os oito quadros: 14px de
   * margem transparente de cada lado, 10 em cima e 11 embaixo. E o
   * `contentBox` que faz o retrato da tela de selecao preencher o
   * quadrado com o PERSONAGEM, e nao com a margem
   *
   * A caixa e a maior de todos os quadros porque o cajado entra e sai
   * de lado a lado: o quadro 5 chega em x=54 e o quadro 3 para em
   * x=49. Uma caixa medida so num quadro mais estreito cortaria o
   * cajado pela metade, e o quadro mais largo sairia com mais
   * transparente de cada lado
   */
  contentBox: { x: 14, y: 10, width: 41, height: 47 },
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
     * A caixa do DESENHO dentro da celula de 64x64, medida do PNG.
     *
     * O arquiro ocupa 30x44: 17px de margem transparente de cada
     * lado, 8 em cima e 12 embaixo. E o `contentBox` que deixa o
     * retrato da tela de selecao com a arte preenchendo o quadrado e
     * centrada no PERSONAGEM, e nao na margem
     *
     * A altura do desenho muda 1px entre os quadros do idle (43 a
     * 45), que e a propria animacao de respirar. A caixa e a maior
     * das sete, e o quadro mais curto sai com uma linha transparente
     * em cima, o que nao aparece
     */
    contentBox: { x: 17, y: 7, width: 30, height: 45 },

    animations: {
      idle: { row: 8, start: 0, length: 7, fps: 5 },
      walk: { start: 0, length: 8, fps: 12 },
      attack: {
        rowOffset: 9,
        start: 0,
        length: 9,
        fps: 20,
        needsTarget: true,
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