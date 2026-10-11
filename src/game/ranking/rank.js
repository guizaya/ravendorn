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
  PODER: "poder",
};

/**
 * OS PESOS DO PODER, e nao a conta espalhada pelo arquivo.
 *
 * Sao BALANCEAMENTO, e nao dado inventado: cada peso multiplica um stat que
 * o `Player` ja tem. Eles ficam numa tabela porque e a unica parte do rank
 * que um designer precisa mudar, e uma conta escrita em varias linhas daria
 * tres lugares diferentes para editar
 *
 * O poder BRUTA e o numero que a coluna mostra, e nao um numero redondinho:
 * um caçador com 3 de ataque e 950 de vida e mais forte que um com 950 de
 * ataque e 3 de vida, e um numero redondido esconderia essa diferenca
 */
export const PODER_PESOS = Object.freeze({
  /** nivel pesa, porque todo stat da ficha cresce com ele */
  nivel: 40,

  /** o dano, e o que o jogador sente na hora */
  attack: 3,

  /** a vida, que e o que segura o caçador vivo */
  maxHp: 1,

  /** a defesa, que reduz o que entra */
  defense: 2,

  /** a mana, que e o recurso das classes magicas */
  maxResource: 1,

  /** o critico, que e o pico do dano */
  critRate: 120,

  /** o dano critico, que multiplica esse pico */
  critDamage: 12,
});

/**
 * O PODER de um jogador, dos stats REAIS que o `Player` ja guarda.
 *
 * E por que o poder e GRAVADO no save e nao recalculado na leitura: o mesmo
 * motivo do `bonus` da `Collection`. Se o balanceamento mudar, quem foi
 * medido com a tabela antiga continua com o numero antigo — o jogador nao
 * perde nem ganha poder por causa de uma mudanca que nao tem nada a ver com
 * ele
 */
export function poderDe(stats = {}) {
  let total = 0;

  for (const [campo, peso] of Object.entries(PODER_PESOS)) {
    const valor = Number(stats[campo]);

    if (!Number.isFinite(valor)) continue;

    total += valor * peso;
  }

  return Math.max(0, Math.round(total));
}

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

    /**
     * O PODER, calculado da sessao viva.
     *
     * `player` e a fonte: os stats do `Player` ja incluem o equipamento
     * vestido, entao o numero mede o caçador de verdade e nao a ficha base
     */
    poder: poderDe(player),

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

    /**
     * O PODER DE UM JOGADOR QUE DESLIGOU.
     *
     * ## POR QUE VEM DO ARQUIVO E NAO E RECALCULADO
     *
     * Porque o save NAO guarda os stats de combate: ele grava `level`, `xp`,
     * `x` e `y`, e nada mais. Um poder recalculado aqui sairia zero para
     * todo mundo que nao esta conectado — que e metade da tabela
     *
     * E por isso que o `GameEngine` GRAVA o poder no save quando a sessao
     * fecha. Sem essa linha, o criterio "Poder" mostraria so os online, e
     * o jogador que salvou e saiu perderia a posicao
     *
     * Um save bem antigo, sem o campo, cai em zero — e o painel trata zero
     * como "sem medicao", botando o jogador depois dos medidos em vez de
     * misturado com eles
     */
    poder: Math.max(0, Math.floor(save.poder ?? 0)),

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

/**
 * Poder primeiro, nivel como desempate.
 *
 * O nivel no desempate e o que segura a ordem de quem nao tem medicao: um
 * save antigo sem `poder` vale zero, e o nivel coloca esse jogador depois
 * dos medidos em vez de numa posicao aleatoria
 */
function ordenarPorPoder(lista) {
  return [...lista].sort((a, b) => {
    if (b.poder !== a.poder) return b.poder - a.poder;

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
    [RANK_CRITERIO.PODER]: comPosicao(ordenarPorPoder(dados)),
  };
}
