/**
 * A ordem do rank de quem esta conectado.
 *
 * Fica num modulo PURO, sem servidor e sem DOM, por dois motivos: a
 * regra de ordenacao e uma regra de jogo (e vale um teste proprio),
 * e o SERVIDOR e quem monta a ordem. Um cliente que recebesse a
 * lista cru e ordenasse no navegador mostraria a posicao que
 * quises, entao a lista chega pronta.
 *
 * Sao dois criterios, porque "quem esta na frente" tem duas
 * leituras legitimas e elas discordam:
 *
 * - NIVEL: nivel, e o XP DENTRO do nivel no desempate. O `xp` do
 *   jogador e o que sobra do nivel, e nao o acumulado: ele e
 *   subtraido quando o jogador sobe. Ordenar pelo `xp` cru
 *   colocaria todo mundo nivel 1 na frente de todo mundo nivel 40.
 * - BESTIARIO: cacadas fechadas, e abates no desempate. Mede quem
 *   realmente foi caçar.
 *
 * O desempate final e sempre o NOME, com a mesma comparacao do
 * resto do jogo (`nameKey`, sem acento e sem caixa). Sem ele dois
 * jogadores com os mesmos numeros trocariam de posicao a cada
 * pacote, e a lista "pularia" na tela.
 */

/** Os criterios que o painel oferece, na ordem em que aparecem. */
export const RANK_CRITERIO = {
  NIVEL: "nivel",
  BESTIARIO: "bestiario",
};

/** O icone de posicao: 1 a 3 ganham medalha, o resto fica neutro. */
export const RANK_MEDALHA = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export const RANK_MEDALHA_PADRAO = "•";

/**
 * O numero mostrado do lado do nome.
 *
 * Medalha so nos tres primeiros: um emoji de medalha no 47o lugar
 * seria mentira, ja que o quarto nao e o mesmo premio. A posicao
 * numerada continua a do lado, entao ninguem perde a informacao.
 */
export function rankPosicao(posicao) {
  return posicao > 0 && posicao <= 3
    ? RANK_MEDALHA[posicao]
    : RANK_MEDALHA_PADRAO;
}

/** Le o que o rank precisa de uma sessao, e nada mais. */
export function dadosDoJogador(sessao) {
  const { player, bestiary } = sessao;

  // `xp` e o do nivel corrente e pode ser `undefined` em um
  // personagem recem-criado: nenhum abate subiu ele ainda
  const xp = Math.max(0, Math.floor(player.xp ?? 0));

  // o somatorio de abates e o desempate do bestiario. Um `Map` de
  // criatura para total e o que o `Bestiary` guarda
  let abates = 0;

  for (const total of bestiary.kills.values()) {
    abates += Math.max(0, Math.floor(total ?? 0));
  }

  return {
    id: sessao.id,
    name: sessao.name,
    classId: sessao.classId,

    nivel: Math.max(1, Math.floor(player.level ?? 1)),
    xp,

    cacadas: bestiary.completed.size,
    abates,
  };
}

/**
 * Nivel primeiro, XP dentro do nivel como desempate.
 *
 * Nao exportada de proposito: ela recebe a SAIDA de
 * `dadosDoJogador`, e nao uma `PlayerSession`. Exportada, dava para
 * chamar com a sessao crua, o `nivel` virava `undefined` em todas
 * e o comparador caia no nome -- devolvendo a lista na entrada, sem
 * erro nenhum. Os testes passam por `montarRank`, que e a API real.
 */
function ordenarPorNivel(lista) {
  return [...lista].sort((a, b) => {
    if (b.nivel !== a.nivel) return b.nivel - a.nivel;
    if (b.xp !== a.xp) return b.xp - a.xp;

    return a.name.localeCompare(b.name, "pt-BR");
  });
}

/** Cacadas fechadas primeiro, abates no desempate. */
function ordenarPorBestiario(lista) {
  return [...lista].sort((a, b) => {
    if (b.cacadas !== a.cacadas) return b.cacadas - a.cacadas;
    if (b.abates !== a.abates) return b.abates - a.abates;

    // com o bestiario empatado, o nivel ainda separa: e melhor do
    // que ordenar so por nome e ver dois jogadores nivel 40 com o
    // mesmo numero de cacadas em ordem alfabetica
    if (b.nivel !== a.nivel) return b.nivel - a.nivel;

    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function comPosicao(ordenada) {
  return ordenada.map((jogador, indice) => ({
    ...jogador,
    posicao: indice + 1,
    medalha: rankPosicao(indice + 1),
  }));
}

/**
 * Monta o rank inteiro, as duas listas ja ordenadas.
 *
 * `sessoes` e a lista de `PlayerSession` do mundo. O servidor
 * chama com todo mundo que esta conectado, e o painel mostra so
 * quem entrou na partida: um rank com jogador que ja saiu seria
 * uma posicao que ninguem pode Occupy.
 */
export function montarRank(sessoes) {
  const dados = sessoes
    .map(dadosDoJogador)
    .filter(Boolean);

  return {
    [RANK_CRITERIO.NIVEL]: comPosicao(ordenarPorNivel(dados)),
    [RANK_CRITERIO.BESTIARIO]: comPosicao(ordenarPorBestiario(dados)),
  };
}
