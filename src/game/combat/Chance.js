/**
 * A CHANCE de errar o golpe.
 *
 * Este e o unico lugar do jogo que decide se um golpe acerta ou passa
 * batido. Ele existe separado do `DamageSystem` por tres motivos:
 *
 * 1. **repetibilidade.** O `DamageSystem` sorteia uma vez por golpe, e
 *    um teste que quisesse provar a chance teria que rezar para o
 *    numero cair certo. Com a conta isolada, o teste prova a CONTA e o
 *    sorteio continua sendo uma linha
 * 2. **os dois lados do combate.** A mesma conta serve para o jogador
 *    errando o mob e para o mob errando o jogador. Dentro do
 *    `DamageSystem`, a segunda metade seria um `if` assimétrico
 * 3. **os stats finalmente importam.** `accuracy` e `evasion` eram
 *    mostrados no painel e nunca lidos em lugar nenhum: o jogador subia
 *    de DEX, via "Precisao 84" subir na tela, e o combate nao mudava.
 *    Aqui eles passam a valer
 *
 * ## A conta
 *
 * `evasion` e uma FRACAO (0.02 = 2%) e ja era assim no `StatSheet`, de
 * onde vem `0.02 + dex * 0.0035`. `accuracy` e um numero alto
 * (`dex * 3.2 + 40 + nivel * 2.5`, uns 75 no nivel 1), nao uma fracao.
 * Sao unidades diferentes, e a conta e que traduz uma na outra
 *
 * A precisao vira uma REDUCAO, nao uma chance:
 *
 *     reducao = precisao / (precisao + 150)
 *
 * e uma curva que sobe devagar e nunca chega a 1. Monotona, sem
 * numero magico no meio da formula, e com um chao util: um mob sem
 * `accuracy` nenhuma reduz zero, e erra na evasion inteira do alvo
 *
 * ## Os limites
 *
 * O piso de 1% e o teto de 50% nao sao numeros arbitrarios:
 *
 * - **piso 1%** — o mechanic precisa ser VISIVEL. Com 0%, o jogador
 *   passaria o jogo inteiro sem ver um "MISS" e concluiria que o
 *   recurso nao funciona
 * - **teto 50%** — acima da metade o alvo parece quebrado, e o jogador
 *   para de atacar. Nenhum duelo deixa um alvo errar mais da metade
 *
 * A Environmentacao e o sorteio estao separados de proposito: quem rola
 * o dado e o `DamageSystem`, porque o sorteio tem que acontecer UMA vez
 * por golpe, e nao uma vez por leitura de stat
 */

/** O alvo mais evasion nunca escapa de mais da metade dos golpes */
export const MISS_MAXIMO = 0.5;

/**
 * NINGUEM passa 1% dos golpes sem acertar.
 *
 * E o piso que garante o mechanic ser visto. Ver o bloco de cima
 */
export const MISS_MINIMO = 0.01;

/** O quanto a precisao do atacante neutraliza, na escala da evasion */
const BASE_NEUTRALIZA = 150;

/**
 * A chance de o golpe passar batido, de 0 a 1.
 *
 * @param {object} atacante  quem atirou. `accuracy` e um numero alto
 * @param {object} alvo      quem leva. `evasion` e uma fracao
 * @returns {number} fracao de chance, ja dentro dos limites
 */
export function chanceDeErrar(atacante, alvo) {
  const evasion = Math.max(0, Number(alvo?.evasion) || 0);

  /**
   * Quem nao tem evasion nenhuma nunca e escolhido para errar o golpe.
   *
   * Sem este `if`, o piso de 1% valeria para TODO MUNDO — inclusive
   * para os bonecos de treino do primeiro mapa, que nao tem atributo
   * nenhum. O piso serve para o mechanic aparecer, nao para transformar
   * um alvo sem stats num alvo que erra
   */
  if (evasion <= 0) return 0;

  const precisao = Math.max(
    0,
    Number(atacante?.accuracy) || 0,
  );

  const reducao = precisao / (precisao + BASE_NEUTRALIZA);

  const chance = evasion * (1 - reducao);

  return Math.min(MISS_MAXIMO, Math.max(MISS_MINIMO, chance));
}

/**
 * O golpe passou batido?
 *
 * O `random` e injetavel para o teste cravar os dois lados do sorteio:
 * um `0` faz o golpe errar, um `0.99` faz ele acertar com uma chance
 * de 5%. Sem o parametro seria impossivel provar o "acertou" sem
 * rezar para o `Math.random`
 */
export function errouOGolpe(atacante, alvo, random = Math.random) {
  const chance = chanceDeErrar(atacante, alvo);

  if (chance <= 0) return false;

  return random() < chance;
}
