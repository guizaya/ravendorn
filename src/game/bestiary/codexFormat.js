/**
 * O MILHAR DO CODEX.
 *
 * ## POR QUE ISTO NAO E O `formatarNumero` DO RANKING
 *
 * Porque `rankView.js` e a APRESENTACAO do ranking: ele formata a METRICA de
 * uma posicao, e sabe qual criterio esta ativo. O Codex formata contagens de
 * abates e de metas, que sao numeros de outra natureza, e um modulo de
 * ranking nao deve ser o lugar onde um bestiario procura o `Intl`
 *
 * ## POR QUE `Intl` E NAO UM `replace` COM PONTO
 *
 * Porque em pt-BR o milhar e ponto e a centena e virgula, e o `Intl` ja
 * sabe disso — inclusive quando o numero tem casas decimais, o que um
 * `replace` transformaria em "1.234,5" sem o separador correto
 */
const numeroPtBr = new Intl.NumberFormat("pt-BR");

export function formatarNumero(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return "0";

  return numeroPtBr.format(Math.round(numero));
}