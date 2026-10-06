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

import { nameKey } from "../../data/characterName.js";

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

    // quem esta na partida agora. Um jogador offline entra na lista
    // com `false`, e o painel usa isso para nao mostrar a lista toda
    // igual sem diferenciar quem pode ser encontrado no mapa
    online: true,
  };
}

/**
 * O MESMO DADO, lido de um PERSONAGEM SALVO em vez de uma sessao viva.
 *
 * O save tem a MESMA informacao com outra forma: o `bestiary` vai
 * como `kills` em pares `[tipo, total]` e `completed` em lista, porque
 * JSON nao tem `Map` nem `Set`. Sem esta leitura, o rank so conhecia
 * quem estava conectado — e fechar o navegador sumia com o jogador
 * da tabela
 *
 * O `nome` vem de fora porque o arquivo se chama pela CHAVE do nome
 * (`nameKey`), e o nome com acento e com caixa e o que o jogador
 * digitou: e ele que o painel precisa mostrar
 */
export function dadosDoSalvo(save, nome) {
  if (!save || typeof save !== "object") return null;

  const player = save.player ?? {};
  const bestiary = save.bestiary ?? {};

  let abates = 0;

  // `kills` pode vir como array de pares ou ja como objeto, se um save
  // antigo tiver sido escrito de outra forma
  const pares = Array.isArray(bestiary.kills)
    ? bestiary.kills
    : Object.entries(bestiary.kills ?? {});

  for (const par of pares) {
    const total = Array.isArray(par) ? par[1] : par;

    abates += Math.max(0, Math.floor(total ?? 0));
  }

  const completed = Array.isArray(bestiary.completed)
    ? bestiary.completed
    : [];

  return {
    id: null,
    name: save.name ?? nome,
    classId: save.classId ?? null,

    nivel: Math.max(1, Math.floor(player.level ?? 1)),
    xp: Math.max(0, Math.floor(player.xp ?? 0)),

    cacadas: completed.length,
    abates,

    online: false,
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
 * `sessoes` e a lista de `PlayerSession` do mundo: quem esta na
 * partida agora. `salvos` sao os personagens em disco, para o rank
 * mostrar quem ja jogou e hoje esta offline
 *
 * ## A ORDEM DE PRECEDENCIA
 *
 * Online vence offline. Se o mesmo nickname aparecesse duas vezes — a
 * sessao viva e o arquivo — o painel mostraria a mesma pessoa duas
 * vezes e o resto da lista desceria uma posicao sem motivo
 *
 * A comparacao e por `nameKey`, a MESMA chave do arquivo e do
 * servidor: "Teste", "teste " e "TESTE" sao um personagem so
 */
export function montarRank(sessoes, salvos = []) {
  const vistos = new Set();

  const dados = [];

  for (const sessao of sessoes) {
    const linha = dadosDoJogador(sessao);

    if (!linha) continue;

    vistos.add(nameKey(linha.name));

    dados.push(linha);
  }

  for (const salvo of salvos) {
    const linha = dadosDoSalvo(salvo, salvo?.name);

    if (!linha) continue;

    // ja esta na lista pela sessao viva: o dado de agora e mais novo
    if (vistos.has(nameKey(linha.name))) continue;

    vistos.add(nameKey(linha.name));

    dados.push(linha);
  }

  return {
    [RANK_CRITERIO.NIVEL]: comPosicao(ordenarPorNivel(dados)),
    [RANK_CRITERIO.BESTIARIO]: comPosicao(ordenarPorBestiario(dados)),
  };
}
