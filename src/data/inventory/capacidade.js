/**
 * AS REGRAS DA EXPANSÃO DA MOCHILA.
 *
 * ## POR QUE UM ARQUIVO SÓ PARA ISTO
 *
 * Porque sao tres lugares que precisam da MESMA conta: o servidor que cobra,
 * a tela que anuncia o preco, e o save que guarda quantas compras o jogador
 * fez. Com a conta escrita em cada um, a divergencia aparece como "a tela
 * mostrou 60 e o servidor cobrou 80" — e o jogador tem razao nos dois casos
 *
 * ## E POR QUE A CAPACIDADE E O DADO, E NAO A CONTAGEM DE COMPRAS
 *
 * Porque a capacidade e o que a mochila usa. Guardar "quantas compras fez"
 * obrigaria todo mundo a converter para slots antes de comparar com um
 * `capacity`, e essa conversao aparecia em pelo menos tres lugares diferentes
 */
export const MOCHILA_SLOTS_BASE = 20;

/** O TEOR, e nao um numero que o mercado pode furar. */
export const MOCHILA_SLOTS_MAX = 100;

/** QUANTOS SLOTS CADA COMPRA ENTREGA. */
export const MOCHILA_SLOTS_POR_COMPRA = 10;

/**
 * O PREÇO DA n-ésIMA COMPRA, em diamantes.
 *
 * ## A SEQUENCIA, E POR QUE ELA E ASSIM
 *
 * 10, 20, 40, 60, 80, 100, 120, 140.
 *
 * O primeiro e o segundo sao 10 e 20 para o jogo ensinar o valor sem
 * assustar; a partir do terceiro sobe de 20 em 20. E progressivo de proposito:
 * uma mochila cheia custa mais para crescer do que uma quase cheia, e o
 * jogador sente o preco no lugar onde dói — quando já perdeu drop
 *
 * ## POR QUE NÃO É UM `n * 20`
 *
 * Porque isso daria 20 na primeira compra. E a primeira e a que decide se o
 * jogador compra a segunda: cobrar o dobro no primeiro passo é como se
 *punir quem conhece o jogo
 *
 * @param {number} indice quantas compras JA FORAM feitas (0 = a primeira)
 * @returns {number} o preco em diamantes
 */
export function precoDaCompra(indice) {
  const n = Math.floor(indice);

  if (n <= 0) return 10;
  if (n === 1) return 20;

  return 20 + (n - 1) * 20;
}

/**
 * QUANTAS COMPRAS CABEM DE 20 A 100, de 10 EM 10.
 *
 * E o que impede um loop infinito de `proximaCompra`: sem este teto, a
 * chamada recursiva continuaria para sempre devolvendo `{ pode: true }`
 */
export const COMPRAS_TOTAIS = Math.floor(
  (MOCHILA_SLOTS_MAX - MOCHILA_SLOTS_BASE) / MOCHILA_SLOTS_POR_COMPRA,
);

/**
 * O QUE A PRÓXIMA COMPRA ENTREGA, e o que ela custa.
 *
 * E a função que a tela e o servidor chamam. Devolve `pode: false` quando a
 * mochila ja chegou no teto, e e esse `pode` que o botão do painel lê — a
 * tela nunca decide sozinha que acabou
 *
 * @param {number} capacity a capacidade atual
 * @returns {{ slots: number, preco: number, pode: boolean, capacity: number }}
 *   `capacity` e o valor QUE FICA depois da compra, que e o que a tela mostra
 *   como "vai ficar"
 */
export function proximaCompra(capacity) {
  const atual = Math.max(
    MOCHILA_SLOTS_BASE,
    Math.min(MOCHILA_SLOTS_MAX, Math.floor(Number(capacity) || 0)),
  );

  const slots = Math.min(MOCHILA_SLOTS_POR_COMPRA, MOCHILA_SLOTS_MAX - atual);
  const destino = atual + slots;

  if (slots <= 0) {
    return { slots: 0, preco: 0, pode: false, capacity: atual };
  }

  return {
    slots,
    preco: precoDaCompra((atual - MOCHILA_SLOTS_BASE) / MOCHILA_SLOTS_POR_COMPRA),
    pode: true,
    capacity: destino,
  };
}

/**
 * A CAPACIDADE DEVE SER ACEITA?
 *
 * ## POR QUE ISTO EXISTE
 *
 * Porque a capacidade vem do disco, e um arquivo editado a mao — ou um save
 * de quando o teto era maior — pode trazer qualquer numero. E um
 * `capacity: 10000` daria uma mochila com 10.000 slots e nenhum diamante pago
 *
 * A regra e simples e nao negociavel: nunca menos que a base, nunca mais que
 * o teto. Um save invalido volta para a base em vez de ser recusado, porque
 * recusar o save inteiro perderia o personagem inteiro — e perder um
 * personagem por um campo corrompido e pior que perder o bonus
 *
 * @param {*} valor o que veio do save
 * @returns {number} uma capacidade confiavel
 */
export function capacidadeConfiavel(valor) {
  const n = Math.floor(Number(valor));

  if (!Number.isFinite(n) || n <= MOCHILA_SLOTS_BASE) {
    return MOCHILA_SLOTS_BASE;
  }

  return Math.min(n, MOCHILA_SLOTS_MAX);
}