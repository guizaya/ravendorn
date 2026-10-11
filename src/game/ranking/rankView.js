/**
 * A APRESENTACAO do rank: rotulos, metricas e formato de numero.
 *
 * ## POR QUE ESTE MODULO E SEPARADO DO `rank.js`
 *
 * Porque `rank.js` e o lugar da REGRA — quem fica na frente, e por que. E
 * ele roda no servidor, em Node, sem DOM e sem React. O texto "os caçadores
 * mais avançados" e o formatador de milhar nao tem nada a ver com a regra de
 * ordenacao, e um modulo que importa o outro no sentido errado acabaria
 * puxando `data/characters` para o servidor
 *
 * E `rankView.js` e de onde saem os rotulos de tela, e nao o componente: com
 * eles espalhados pelo JSX, o pódio e a lista escreviam "Nv 12" e "Nível 12"
 * em versoes diferentes — e o jogador veria dois formatos para o mesmo numero
 */

import { RANK_CRITERIO } from "./rank.js";

/**
 * As DUAS abas, e so duas.
 *
 * O desenho pede Nível e Poder, e nenhum outro critério. `cacadas` e `abates`
 * continuam no payload porque o bestiário usa os mesmos campos, mas aqui não
 * viram aba
 */
export const RANK_ABAS = [
  {
    id: RANK_CRITERIO.NIVEL,
    titulo: "Nível",
    subtitulo: "os caçadores mais avançados",
  },
  {
    id: RANK_CRITERIO.PODER,
    titulo: "Poder",
    subtitulo: "poder do caçador",
  },
];

/** A aba que abre o painel. */
export const RANK_ABA_PADRAO = RANK_CRITERIO.NIVEL;

/**
 * O NÚMERO DA ABELA, ja no formato do critério.
 *
 * E o `value` que o eixo Y do pódio e a coluna da lista medem. Centralizar
 * aqui é o que impede o pódio de mostrar "12" e a lista "Nível 12" para o
 * mesmo jogador
 */
export function valorDa(jogador, criterio) {
  if (!jogador) return 0;

  if (criterio === RANK_CRITERIO.PODER) {
    return Math.max(0, Math.floor(jogador.poder ?? 0));
  }

  return Math.max(1, Math.floor(jogador.nivel ?? 1));
}

/**
 * O TEXTO DA MÉTRICA, como o desenho pede.
 *
 * "Nv 12" na aba de nível e "1.240 poder" na de poder. O `Intl` entra
 * porque o número do poder passa de mil com facilidade — um caçador de
 * primeiro nível já tem mais de mil de poder, e "4122" cru na coluna da
 * direita seria a única coisa ilegível da linha
 */
export function metricaDe(jogador, criterio) {
  const valor = valorDa(jogador, criterio);

  if (criterio === RANK_CRITERIO.PODER) {
    return `${formatarNumero(valor)} poder`;
  }

  return `Nv ${valor}`;
}

/** O número sozinho, para a barra da posição do jogador. */
export function numeroDa(jogador, criterio) {
  return formatarNumero(valorDa(jogador, criterio));
}

/**
 * MILHAR pt-BR.
 *
 * E o `Intl` do navegador e nao um `replace` com ponto: o `Intl` sabe que
 * milhar em pt-BR é ponto e não vírgula, e sabe das casas decimais quando
 * o numero as tiver
 */
const numeroPtBr = new Intl.NumberFormat("pt-BR");

export function formatarNumero(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return "0";

  return numeroPtBr.format(Math.round(numero));
}

/**
 * A posição com o "#" e o milhar: "#3.617".
 *
 * E a mesma formatacao do numero, e ela é o que o desenho pede no eixo
 * esquerdo da barra
 */
export function formatarPosicao(posicao) {
  const numero = Number(posicao);

  if (!Number.isFinite(numero) || numero <= 0) return "—";

  return `#${formatarNumero(numero)}`;
}

/**
 * O JOGADOR SEM MEDIÇÃO DE PODER.
 *
 * ## POR QUE EXISTE ISSO
 *
 * Porque um save gravado antes do poder existir não tem o campo, e a leitura
 * devolve zero. Zero e um número VÁLIDO — um caçador nivel 1 recém-criado tem
 * poder baixo mas não zero — e tratar os dois como a mesma coisa colocaria
 * um jogador novo no mesmo lugar de um save antigo
 *
 * A linha diz "sem medição" em vez de "0": o jogador entende que é falta de
 * dado, e não que ele está fraco
 */
export function semMedicao(jogador, criterio) {
  return (
    criterio === RANK_CRITERIO.PODER &&
    Math.max(0, Math.floor(jogador?.poder ?? 0)) === 0 &&
    jogador?.online !== true
  );
}

/**
 * A COR DE MEDALHA por posição, mapeada para tokens do projeto.
 *
 * ## POR QUE A PRATA E O BRONZE NÃO SÃO TOKENS DA PALETA
 *
 * Porque a paleta do projeto é quente — do abyss ao gold — e não tem prata
 * nem bronze. Inventar um token novo para duas medalhas seria uma cor que
 * não existe em mais lugar nenhum da tela
 *
 * Em vez disso as duas usam o que já existe e é mais próximo: a prata é o
 * `--t-line-3`, o cinza-claro da borda, e o bronze é o `--t-gold-line`, o
 * ouro escuro. O ouro é o `--t-gold` de verdade. As três continuam
 * distintas entre si, e todas vivem na paleta
 */
export const RANK_COR_MEDALHA = Object.freeze({
  1: "var(--t-gold)",
  2: "var(--t-line-3)",
  3: "var(--t-gold-line)",
});