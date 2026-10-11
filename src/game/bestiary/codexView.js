/**
 * A CATEGORIA "MONSTROS" DO CODEX, DERIVADA DO SNAPSHOT REAL.
 *
 * ## POR QUE UM ARQUIVO SO PARA ISSO
 *
 * Porque `bestiario.txt` pede cinco categorias — Monstros, Loots,
 * Equipamentos, Aprimoramento, Coleções — e quatro delas NAO TEM DADO NO
 * PROJETO. O `Bestiary` so conhece criaturas: nao existe inventario de loot
 * por criatura, nem criterio de aprimoramento por criatura, nem colecao por
 * criatura. Um `CodexTabs` com cinco abas seria cinco abas, e quatro delas
 * mostrariam "nenhuma entrada" para sempre
 *
 * Entao a lista de categorias daqui tem uma ab so. Quando as outras quatro
 * tiverem dado de verdade, elas entram NESTA lista — e nao em um array novo
 * dentro do componente, que e o que faria a segunda versao divergir da
 * primeira
 *
 * ## O QUE CADA CAMPO VEM
 *
 * Tudo vem do `Bestiary.snapshot()`: `kills`, `hunts` (com `done`,
 * `progress`, `count`) e `done`. Nenhum numero deste arquivo e inventado —
 * e o que nao existe no snapshot simplesmente nao aparece
 */
import { BESTIARY_ICON } from "../../data/bestiary/index.js";

/**
 * As CATEGORIAS DO CODEX QUE TEM DADO.
 *
 * O `id` e o que o painel usa para escolher o que renderizar. `MONSTROS` e o
 * unico por enquanto, e o motivo esta no comentario do topo do arquivo
 */
export const CATEGORIAS_CODEX = [
  {
    id: "monstros",
    rotulo: "MONSTROS",
    icone: BESTIARY_ICON,
  },
];

/** O percentual e de 0 a 1, e nunca passa de 1 nem fica negativo. */
export function fracaoDe(entrada) {
  const total = (entrada?.hunts ?? []).reduce(
    (soma, hunt) => soma + (hunt.count || 0),
    0,
  );

  if (total <= 0) return 0;

  const feitos = (entrada?.hunts ?? []).reduce(
    (soma, hunt) => soma + (hunt.done ? hunt.count : hunt.progress || 0),
    0,
  );

  return Math.max(0, Math.min(1, feitos / total));
}

/**
 * O PERCENTUAL DE UMA CACADA.
 *
 * E a conta mais honesta que existe: quantos foram, sobre quantos a cacada
 * pedia. Uma cacada de 60 com 90 abates fica em 100% e NAO em 150% — o
 * excedente e do jogador, nao da cacada
 */
export function fracaoDaCacada(hunt) {
  const meta = hunt?.count ?? 0;

  if (meta <= 0) return 0;

  return Math.max(0, Math.min(1, (hunt.progress ?? 0) / meta));
}

/**
 * O PRIMEIRO OBJETIVO QUE AINDA FALTA.
 *
 * E a cacada que o jogador esta para fechar: a de menor `tier` que nao
 * terminou. A ordem das cacadas no array ja e a ordem do tier, entao o
 * `find` respeita essa ordem sem ordenar nada
 */
export function proximoObjetivoDe(entrada) {
  return (entrada?.hunts ?? []).find((hunt) => !hunt.done) ?? null;
}

/**
 * QUANTO FALTA PARA O PRÓXIMO MARCO.
 *
 * A subtração simples, com o piso em 0: um jogador com 90 abates numa
 * cacada de 60 tem "-0" sem ele, e o numero negativo num painel de
 * progresso é pior que o zero
 */
export function faltaPara(hunt) {
  if (!hunt) return 0;

  return Math.max(0, (hunt.count ?? 0) - (hunt.progress ?? 0));
}

/**
 * A CATEGORIA INTEIRA, PRONTA PARA A LISTA.
 *
 * Cada entrada ganha o `id` que o componente usa como chave e no `aria`, e
 * o `fracao` que a barra e o percentual leem. O resto do objeto segue
 * intacto: o detalhe precisa de `kills`, `zoneName`, `level` e `hunts`
 */
export function vitrineDeCategoria(categoriaId, snapshot) {
  if (categoriaId !== "monstros") return [];

  return (snapshot?.entries ?? []).map((entrada) => ({
    ...entrada,
    fracao: fracaoDe(entrada),
    proximo: proximoObjetivoDe(entrada),
  }));
}

/**
 * O STATUS DA ENTRADA, em texto.
 *
 * Sai de `done` e do proximo objetivo, que ja vem do snapshot. Nenhum dos
 * tres estados e decidido por outro criterio, para o texto e a cor nunca
 * discordarem do que a barra mostra
 */
export function statusDe(entrada) {
  if (entrada?.done) return "COMPLETO";
  if ((entrada?.kills ?? 0) > 0) return "EM ANDAMENTO";

  return "NÃO INICIADO";
}