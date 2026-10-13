/**
 * ATRIBUTOS DAS CLASSES, e a FONTE UNICA deles.
 *
 * ## POR QUE `value` E `percent` SAO DOIS CAMPOS
 *
 * Porque `value` e o numero REAL do jogo e `percent` e so a barra. Sao coisas
 * diferentes desde que os numeros deixaram de ser de 0 a 100: a velocidade do
 * guerreiro e 165 e a do arqueiro 230, e nenhuma das duas cabe numa barra
 * porcentual
 *
 * A tentacao e fazer `width: ${value * 0.5}%` na hora de renderizar. E o que
 * faz a home e a criacao de personagem divergirem assim que uma delas Ganhar
 * um ajuste — e o motivo deste arquivo existir
 *
 * ## DE ONDE VEM OS NUMEROS
 *
 * De `stats` em `src/data/characters/index.js`, no jogo:
 *
 * | classe do jogo | `attack` | `defense` | `speed` |
 * |---|---|---|---|
 * | `warrior`   |  82 | 42 | 165 |
 * | `lancer`    |  90 | 30 | 220 |
 * | `sorcerer`  | 112 | 16 | 195 |
 * | `arbalist`  | 104 | 18 | 230 |
 *
 * `attack` e_forca, `defense` e defesa e `speed` e velocidade. Sao os tres
 * unicos que a home mostra: vigor, agilidade e magia sairam porque sao
 * derivados de `hp` e de `attackSpeed`, e mostrar os cinco dava quatro numeros
 * que o jogador nao consegue comparar entre classes
 *
* ## POR QUE O TETO E 300, E NAO O MAIOR VALOR DE CADA ATRIBUTO
 *
 * Porque com o teto por atributo (`112 / 42 / 230`) a barra de defesa do
 * guerreiro e de velocidade do arqueiro apareceriam CHEIAS — e uma barra
 * cheia diz "isto e o maximo do mundo" quando nao e: e so o maximo entre as
 * quatro classes. Duas barras em 100% e nenhuma em 100% sao leituras
 * diferentes do mesmo jogo
 *
 * ## E O QUE O 300 COMPRA
 *
 * A barra fica como uma ESCALA, e nao como um resultado. 300 e o dobro do
 * maior valor real (a velocidade da arqueira, 230), entao a barra mais cheia
 * do site para em 77% e nenhuma encosta no fim
 *
 * O preco e a defesa: com um teto so, defesa e o atributo mais fraco das
 * quatro classes e vira barra de 5% a 14%. E verdade — defesa e o menor
 * numero do jogo inteiro, de 16 a 42 — mas se ficar curto demais para ler,
 * o certo e trocar por um teto por atributo e perder a escala única. Por
 * enquanto e 300, e a leitura e a de "quase nada no mundo tem 300"
 */
export type ClassStat = { label: string; value: number; percent: number }

/** O teto unico de toda barra de atributo do site. Ver a nota acima */
const TETO_DA_BARRA = 300

type Atributo = 'Força' | 'Defesa' | 'Velocidade'

/**
 * UM ATRIBUTO, com o numero e a barra ja prontos.
 *
 * O arredondamento e para inteiro porque a barra vira `width` em CSS: um
 * `73.214...%` funciona, mas ninguem le e o diff de um numero fracionario
 * nao diz nada
 */
function atributo(label: Atributo, value: number): ClassStat {
  return { label, value, percent: Math.round((value / TETO_DA_BARRA) * 100) }
}

/** Atributos de cada classe. Fonte única: home e criação de personagem usam os mesmos valores. */
export const CLASS_STATS: Record<'Guerreiro' | 'Arqueiro' | 'Mago', ClassStat[]> = {
  /**
   * O GUERREIRO e o `warrior` do jogo: o unico com 42 de defesa, e o teto
   * dela. A barra de defesa dele aparece cheia — e nao por enfeite, e porque
   * 42 e o maior valor de defesa das quatro classes
   */
  Guerreiro: [
    atributo('Força', 82),
    atributo('Defesa', 42),
    atributo('Velocidade', 165),
  ],

  /**
   * A ARQUEIRA e o `arbalist` do jogo: a mais rapida das quatro (230, o teto)
   * e a segunda mais fraca em defesa. A velocidade no maximo com 18 de defesa
   * e o resumo do que ela e
   */
  Arqueiro: [
    atributo('Força', 104),
    atributo('Defesa', 18),
    atributo('Velocidade', 230),
  ],

  /**
   * O MAGO e o `sorcerer` do jogo: o maior `attack` das quatro (112, o teto)
   * e o menor `speed` entre as tres da home. E o mais fragil de defesa, o que
   * e coerente com 680 de vida
   */
  Mago: [
    atributo('Força', 112),
    atributo('Defesa', 16),
    atributo('Velocidade', 195),
  ],
}