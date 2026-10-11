/**
 * O FARM OFFLINE: quanto o jogador ganha enquanto esta fora.
 *
 * ## O QUE ESTE ARQUIVO E
 *
 * Um modulo PURO. Ele nao conhece sessao, inventario, socket nem disco:
 * recebe um estado com um relogio e um jogador com numeros, e devolve um
 * relatorio. Quem credita, guarda e mostra e o servidor e o HUD
 *
 * E por isso que ele e um arquivo so, e nao uma classe: a regra de quanto
 * o jogador ganha offline precisa ser a MESMA no teste, no servidor e em
 * qualquer leitura futura. Se a conta morasse dentro do `GameServer`,
 * ninguem conseguiria responder "quanto ele ganha em duas horas" sem
 * subir o servidor inteiro
 *
 * ## O PRECEDENTE QUE ESTE CODIGO SEGUE
 *
 * Os pontos de guilda (`data/guild/index.js`, `pontosDesde`). A regra e a
 * mesma em tres pontos:
 *
 * 1. O que se guarda e UM RELOGIO (`ultimoEm`), nunca um saldo acumulado
 * 2. O accrue acontece na LEITURA, e nao em timer — ninguem fica de guarda
 * 3. O excesso se PERDE, e nao vira divida
 *
 * ## POR QUE O TEMPO E LIMITADO, E O SALDO NAO
 *
 * Nos pontos de guilda o teto e sobre o SALDO (24 pontos): quem tem 10 e
 * fica um mes fora ganha ate 24, e para nos 24. Aqui seria errado — o
 * farm offline nao acumula "banco de XP", ele VALORIZA o tempo: um jogador
 * que volta em duas horas e um que volta em doze NAO podem receber a mesma
 * coisa, senao quem jogou mais nao ganha nada por ter jogado
 *
 * O que existe e um teto de TEMPO: `DURACAO_MAXIMA_MS`. Alem disso o
 * excessoo simplesmente se perde. Nao vira divida, nao vira saldo
 * guardado, e nao acumula para a proxima — o que deixa a regra mais facil de ler
 *
 * ## POR QUE O LOOT E SORTEADO DE VERDADE
 *
 * Porque a alternativa seria reescrever as tabelas de drop aqui, e elas
 * mudam. Este modulo chama o `LootSystem.roll` de verdade: o afixo, a
 * raridade e a chance de comercializavel sao os do jogo, porque sao as
 * MESMAS funcoes. Se o balanceamento mexer em `PESO_AFIXO_DROP` amanha,
 * o farm offline muda junto, sem ninguem lembrar deste arquivo
 */

import { createCreatureRoster } from "../../data/enemies/index.js";
import { getMap } from "../../data/maps/index.js";
import { getItem } from "../../data/items/index.js";
import { xpForKill, MAX_LEVEL } from "./Levels.js";
import { LootSystem } from "../loot/LootSystem.js";

/**
 * Os numeros do farm offline, e onde cada um vem.
 *
 * Ficam juntos e nomeados porque eles SAO a resposta para "quanto o
 * jogador ganha offline", e essa pergunta precisa de uma unica resposta
 * verificavel
 */
export const FARM_OFFLINE = Object.freeze({
  /**
   * DOZE HORAS, e nao vinte e quatro.
   *
   * O dobro do ciclo de sono e do turno de trabalho. Passando disso a
   * diferenca ja nao e "jogou mais", e "a maquina ficou ligada": o que
   * passou das 12h nao tem dono, e premiar isso seria premiar AbsenceTools
   *
   * O numero e generoso de proposito — quem joga pouco ama poder voltar e
   * ter ganhado algo — e e curto o bastante para o teto ser uma regra e
   * nao um detalhe
   */
  DURACAO_MAXIMA_MS: 12 * 60 * 60 * 1000,

  /**
   * O TETO DE ABATES, e ele existe por um motivo tecnico.
   *
   * Sem ele, um jogador de nivel 40 com ataque alto contra um mob fraco
   * passa de um abate por segundo, e doze horas passam de 40 mil. Cada
   * abate e um sorteio de loot, entao 40 mil sorteios na entrada do
   * jogador travam o servidor para todo mundo
   */
  TETO_ABATES: 40000,

  /**
   * QUANTOS ABATES SAO SIMULADOS DE VERDADE.
   *
   * E aqui que a conta fica barata sem virar mentira. O jogador matou
   * 14 mil bichos; isso aqui sorteia 200 e multiplica por 70
   *
   * ## POR QUE MULTIPLICAR E NAO SIMULAR TUDO
   *
   * Porque o resultado de 200 sorteios de uma tabela ja e estavel. Com
   * 200, a chance de um legendary aparecer (0,3%) e de cerca de 45%, e o
   * desvio de um agregado de 200 sorteios e de poucos pontos percentuais.
   * Repetir 14 mil vezes nao muda a distribuicao — so demora
   *
   * E o custo de mentir aqui seria alto: o jogador ve o numero e confia
   * nele. Um numero aproximado e honesto porque a DISTRIBUICAO e a do
   * jogo; um numero inventado nao seria
   */
  AMOSTRA_ABATES: 200,

  /**
   * O MENOR TEMPOR POR ABATE, em segundos.
   *
   * Ninguem mata um mob em 0,2s: existe o andar ate ele, o alvo, e o
   * tempo de rotacao. Este piso e o que impede o `TETO_ABATES` de ser
   * alcancado por um jogador de ataque absurdamente alto — ele deixa de
   * bater rapido e passa a bater no minimo, que e o tempo de ir ate o
   * proximo
   */
  SEGUNDOS_POR_ABATE_MINIMO: 1.15,

  /**
   * O FATOR DE DANO POR SEGUNDO.
   *
   * Traduz `attack` em dano por segundo. O 2,6 diz que um golpe basico
   * leva ~0,38s entre acertos e que o dano do golpe e o ataque: o valor
   * que faz um guerreiro de nivel 10 derrubar o mob de nivel 10 em um
   * punhado de golpes, e nao em quarenta
   *
   * E uma aproximacao honesta: o motor real tem dano de habilidade, alvo
   * mover e animacao, e nenhum deles esta disponivel aqui. O numero so
   * precisa ordenar quem e mais forte de quem — e a escala de `attack` ja
   * faz isso
   */
  FATOR_DANO_POR_SEGUNDO: 2.6,

  /**
 * A JANELA DE NIVEL: um abaixo, um acima.
 *
 * ## POR QUE ESTA E NAO "ATE O NIVEL DO JOGADOR + 6"
   *
   * Porque o relatorio tem que ser uma promessa que o jogador reconhece. Com
   * tolerancia de 6, o jogador de nivel 4 lia "Goblin Nv 10" numa tela que
   * ele nao conseguiria tirar do caminho — e a leitura correta de um relatorio
   * de farm e "fiz isso enquanto voce esteve fora"
   *
   * ## E POR QUE UM NIVEL ACIMA VAI MAIS RARO
   *
   * E o `MAX_LEVEL` em versao menor: um mob um nivel acima do jogador e uma
   * luta de verdade, e doze horas fora nao deveriam passar neles
   *
   * O peso e `PESO_NIVEL_ACIMA`, e ele NAO e um filtro: o mob continua
   * aparecendo no relatorio, so demora mais para o jogador derrubar. Tirar
   * o mob do relatorio seria mentir sobre o que existe no mapa
   */
  DESVIO_NIVEL: 1,
  PESO_NIVEL_ACIMA: 0.35,

  /**
   * QUE FRACAO DO TEMPO E GASTA BATENDO.
   *
   * Este e o numero que separa "o jogador jogou doze horas" de "o
   * jogador existiu doze horas". O resto e andar entre zonas, mirar o
   * proximo, pegar o item do chao, beber pocao e o tempo em que o
   * jogador simplesmente nao fez nada
   *
   * ## POR QUE 0,4
   *
   * E a calibrate de olho mesmo, e e honesto deixar isso claro: nao ha
   * telemetria de quanto tempo um jogador realmente gasta matando bicho.
   *
   * O que o numero FAZ e impedir que o relatorio seja uma promessa que o
   * jogo nao cumpre. Um farm de doze horas que devolve doze horas de
   * abates ia nivelar o personagem em um suspiro, e o jogador ia
   * descobrir que voltar para jogar de verdade valia MENOS do que nao
   * jogar. Com 0,4, doze horas offline rendem perto de cinco horas de
   * jogo, e o online continua valendo a pena
   *
   * E o primeiro numero a mexer se o farm parecer fraco ou forte demais:
   * mexer aqui mexe todos os mobs ao mesmo tempo, mexer no
   * `FATOR_DANO_POR_SEGUNDO` so mexe nos fracos
   */
  EFICIENCIA: 0.4,

  /**
   * QUANTAS PILHAS DE ITEM O FARM ENTREGA.
   *
   * E nao `TETO_ABATES`, e a distincao importa: o XP e o ouro nao tem
   * limite porque nenhum dos dois ocupa espaco, e um farm de doze horas
   * que rende trinta niveis e o que o jogador veio buscar
   *
   * ## POR QUE ISTO EXISTE
   *
   * Porque item ocupa espaco, e o espaco e 20. Um farm de oito horas de um
   * personagem de nivel 25 sorteia seis mil itens: dois mil e quinhentos
   * couros de goblin e quatrocentas luvas de arqueiro. Entregar tudo
   * significa seis mil entradas e um jogador com o save inchado e a
   * mochila inútil para o resto do jogo
   *
   * ## POR QUE O LIMITE E DE PILHAS, E NAO DE ITENS
   *
   * Porque material empilha em 99. "Couro Goblin x2440" ocupa vinte e
   * cinco slots e vale muito; "Luvas de Arqueiro x410" ocupa quatrocentos
   * e dez slots e vale pouco. Limitar por UNIDADE cortaria o ouro do
   * jogador justo no item que ele mais queria, e o limite por entrada
   * deixa passar os dois
   *
   * ## E O QUE SE PERDE
   *
   * O excedente vira `descartadoNoFarm` no relatorio, e o modal mostra
   * junto do resto. O jogador ve o total que o tempo rendeu E o que
   * coube — esconder qualquer um dos dois seria pior que perder
   */
  TETO_ITENS_ENTREGUE: 60,

  /**
   * A ESCALA DO QUE O FARM ENTREGA: 0,5 para XP, ouro e itens.
   *
   * ## POR QUE UMA CONSTANTE SO
   *
   * Porque a reducao pedida foi a mesma para os tres, e tres numeros
   * iguais guardados em tres lugares e o jeito de um dia divergirem sem
   * ninguem mexer. Se um dia o XP precisar cair diferente do ouro, este
   * aqui se divide em dois — e o comentario dessa linha e o lugar onde
   * a duvida fica escrita
   *
   * ## POR QUE 0,5 E NAO MENOS
   *
   * E metade do que o tempo rende. Uma reducao maior comecaria a tornar o
   * offline menor que o online: um jogador que fica duas horas para farmar
   * ganha mais do que um que fecha o jogo pelo mesmo tempo. Abaixo de 0,5
   * o botao da pausa vira uma decoracao
   */
  ESCALA: 0.5,
});

/**
 * O ESTADO DE REPOUSO, e ele nao tem `null` espalhado.
 *
 * Toda funcao deste arquivo comeca daqui, e `agora` recebe sempre um
 * objeto inteiro. O caminho alternativo — `sessao.farmOffline?.ativo` em
 * seis lugares — e o que deixa um estado meio inicializado passar
 * despercebido ate aparecer na tela
 */
export function estadoInativo(mapaId = null) {
  return {
    ativo: false,
    ultimoEm: null,
    mapaId,
    relatorio: null,
  };
}

/**
 * LÊ O ESTADO DE VOLTA DO DISCO, e corta o que for absurdo.
 *
 * ## POR QUE ISTO EXISTE E NAO E SO UM `??`
 *
 * Porque o arquivo do personagem e dado de fora. `snapshotSession` grava
 * com `numero()`, mas o `isReadableSave` so checa `version` e `name`: um
 * arquivo editado a mao passa. Este e o unico lugar do farm offline que
 * le o relogio, entao e aqui que a pergunta "isso veio de um jogador ou
 * de um editor de texto" precisa de resposta
 *
 * ## O QUE E RECUSADO
 *
 * - `ultimoEm` no FUTURO: um relogio adiantado daria tempo negativo, e o
 *   `Math.max(0, ...)` transformaria a adulteracao em "zero farm", que e
 *   inofensivo. Pior seria o contrario
 * - `ultimoEm` absurdo no PASSADO: com o teto de 12h, so interessa a
 *   janela recente — e um numero gigante nao muda o resultado, entao nao
 *   ha o que Ganhar em cortar
 * - `relatorio` de tamanho livre: ele vai para o painel e para a tela, e
 *   um payload enorme no `PLAYER_STATE` custa a todo mundo no servidor
 *
 * @param {object} bruto o campo lido do disco, que pode ser qualquer coisa
 * @param {number} agora o relogio de quem chama, em ms
 */
export function sanear(bruto, agora, mapaPadrao = null) {
  const d = bruto && typeof bruto === "object" ? bruto : {};

  const bruto2 = Number(d.ultimoEm);

  const ultimoEm =
    Number.isFinite(bruto2) && bruto2 > 0
      ? Math.min(bruto2, agora)
      : null;

  const mapaId =
    typeof d.mapaId === "string" && d.mapaId.length > 0 && d.mapaId.length <= 64
      ? d.mapaId
      : mapaPadrao;

  return {
    ativo: d.ativo === true && ultimoEm !== null,
    ultimoEm,
    mapaId,
    relatorio: relatorioDeDisco(d.relatorio),
  };
}

/**
 * O RELATORIO VOLTA DO DISCO JA CORTO.
 *
 * Nao e paranoia: e para o painel nao crescer sem limite. `itens` e
 * `mobs` sao as listas que a tela desenha, e cada uma e limitada aqui —
 * um relatorio com mil entradas differentes nao cabe em um painel, nem em
 * um modal, nem e util para o jogador ler
 */
function relatorioDeDisco(bruto) {
  if (!bruto || typeof bruto !== "object") return null;

  const itens = Array.isArray(bruto.itens)
    ? bruto.itens
        .filter((e) => e && typeof e.itemId === "string" && getItem(e.itemId))
        .slice(0, 40)
        .map((e) => ({
          itemId: e.itemId,
          nome: typeof e.nome === "string" ? e.nome.slice(0, 64) : "",
          count: Math.max(0, Math.floor(Number(e.count) || 0)),
        }))
    : [];

  const mobs = Array.isArray(bruto.mobs)
    ? bruto.mobs
        .filter((e) => e && typeof e.typeId === "string")
        .slice(0, 24)
        .map((e) => ({
          /**
           * A CHAVE COM O NIVEL vai salva e restaurada.
           *
           * Porque duas linhas do relatorio podem ter o mesmo `typeId` — os
           * dois "Goblin", e os slimes de nivel 3 e 5. A chave e o que as
           * separa no React, e um save que perdesse a chave faria a tela
           * avisar de chave duplicada na volta do jogador
           *
           * Ela e montada de novo quando falta, para um save antigo: o
           * relatorio nao tem data de emissao e nao depende do save
           */
          chave:
            typeof e.chave === "string" && e.chave.length <= 96
              ? e.chave
              : `${e.typeId}@${Math.max(1, Math.floor(Number(e.nivel) || 1))}`,

          typeId: e.typeId,
          nome: typeof e.nome === "string" ? e.nome.slice(0, 64) : "",
          nivel: Math.max(1, Math.floor(Number(e.nivel) || 1)),
          abates: Math.max(0, Math.floor(Number(e.abates) || 0)),
        }))
    : [];

  return {
    inicioEm: Number(bruto.inicioEm) || 0,
    fimEm: Number(bruto.fimEm) || 0,
    duracaoMs: Math.max(0, Number(bruto.duracaoMs) || 0),
    duracaoEfetivaMs: Math.max(0, Number(bruto.duracaoEfetivaMs) || 0),
    mapaId: typeof bruto.mapaId === "string" ? bruto.mapaId : null,
    abates: Math.max(0, Math.floor(Number(bruto.abates) || 0)),
    xp: Math.max(0, Math.floor(Number(bruto.xp) || 0)),
    nivelAntes: Math.max(1, Math.floor(Number(bruto.nivelAntes) || 1)),
    nivelDepois: Math.max(1, Math.floor(Number(bruto.nivelDepois) || 1)),
    coins: Math.max(0, Math.floor(Number(bruto.coins) || 0)),
    naMochila: Math.max(0, Math.floor(Number(bruto.naMochila) || 0)),
    noBau: Math.max(0, Math.floor(Number(bruto.noBau) || 0)),
    perdidos: Math.max(0, Math.floor(Number(bruto.perdidos) || 0)),
    motivo: typeof bruto.motivo === "string" ? bruto.motivo.slice(0, 64) : "",
    itens,
    mobs,
  };
}

/**
 * LIGA O FARM OFFLINE.
 *
 * ## POR QUE O RELOGIO COMECA AQUI E NAO NO ULTIMO LOGOUT
 *
 * Porque este e o instante em que o jogador DECIDIU farmar. Ligar no
 * logout daria tempo de farm a quem abriu o jogo, entrou, e olhou a tela
 * por um minuto antes de sair
 *
 * ## E POR QUE NAO COMECA AGORA MESMO, SO AO SAIR
 *
 * Porque o servidor nao tem "o jogador vai sair" — ele tem "o jogador
 * saiu". Se o relogio so andasse no disconnect, fechar o jogo sem querer
 * marcaria um farm que o jogador nao pediu, e o tempo entre a decisao e a
 * ida para a tela de classe nao seria de ninguem
 *
 * @returns {object} um estado NOVO. O antigo nao e mexido: quem chama
 *   decide se troca ou guarda
 */
export function iniciar(estado, { agora, mapaId = null } = {}) {
  const momento = Number(agora);

  if (!Number.isFinite(momento)) return estadoInativo(mapaId);

  // religar um farm que ja estava ligado NAO reinicia o relogio
  if (estado?.ativo && Number.isFinite(Number(estado.ultimoEm))) {
    return {
      ...estadoInativo(mapaId ?? estado.mapaId ?? null),
      ultimoEm: Number(estado.ultimoEm),
    };
  }

  return {
    ativo: true,
    ultimoEm: momento,
    mapaId: mapaId ?? estado?.mapaId ?? null,
    relatorio: null,
  };
}

/**
 * DESLIGA O FARM OFFLINE, e o relatorio some com ele.
 *
 * Chamado quando o jogador chega e o accrue ja foi pago: o proximo logout
 * nao pode recontar o mesmo tempo. E o par de `iniciar` — os dois juntos
 * sao o ciclo inteiro da feature
 */
export function encerrar(estado) {
  return {
    ativo: false,
    ultimoEm: null,
    mapaId: estado?.mapaId ?? null,
    relatorio: null,
  };
}

/**
 * QUANTO TEMPO DE FARM EXISTE entre dois instantes.
 *
 * Separado do `resolver` porque a tela de pausa precisa MOSTRAR esse
 * numero enquanto o farm esta ligado, e ele nao pode ser um detalhe
 * escondido dentro da conta grande
 *
 * @returns {{ms: number, saturou: boolean}} o tempo aproveitavel e se ele
 *   bateu no teto
 */
export function tempoDeFarm(estado, agora, opcoes = {}) {
  const teto = opcoes.duracaoMaximaMs ?? FARM_OFFLINE.DURACAO_MAXIMA_MS;

  if (!estado?.ativo || !Number.isFinite(Number(estado.ultimoEm))) {
    return { ms: 0, saturou: false };
  }

  const decorrido = Math.max(0, Number(agora) - Number(estado.ultimoEm));

  const ms = Math.min(decorrido, teto);

  return { ms, saturou: decorrido > teto };
}

/**
 * OS ABATES QUE O TEMPO COMPRA.
 *
 * E aqui que o poder do jogador entra na conta.
 *
 * ## A CONTA
 *
 * `danoPorSegundo = attack * FATOR`, e o tempo de um abate e a vida do
 * mob dividida por isso. Um guerreiro de nivel 30 tem ataque ~96 e mata
 * um goblin de nivel 25 (vida ~390) em pouco mais de um segundo; o mesmo
 * jogador no nivel 1, com ataque ~3, levaria dois minutos no mesmo mob e
 * nao terminaria nunca
 *
 * ## POR QUE UM PISO, E POR QUE UM TETO
 *
 * O piso e o `SEGUNDOS_POR_ABATE_MINIMO`: ninguem mata em 0,2s, e sem o
 * piso um numero de ataque grande faria o abate ir para zero e o
 * `TETO_ABATES` seria alcancado em minutos. O teto e o `TETO_ABATES`, que
 * existe para o custo de CPU nao virar uma Neighbor Table
 */
export function abatesPossiveis({ attack, mobMaxHp, ms, opcoes = {} }) {
  const piso = opcoes.segundosPorAbate ?? FARM_OFFLINE.SEGUNDOS_POR_ABATE_MINIMO;
  const teto = opcoes.tetoAbates ?? FARM_OFFLINE.TETO_ABATES;
  const fator = opcoes.fatorDano ?? FARM_OFFLINE.FATOR_DANO_POR_SEGUNDO;

  const dano = Math.max(1, Number(attack) || 0) * fator;
  const vida = Math.max(1, Number(mobMaxHp) || 0);

  const segundosPorAbate = Math.max(piso, vida / dano);

  if (ms <= 0) return 0;

  return Math.max(0, Math.min(teto, Math.floor(ms / 1000 / segundosPorAbate)));
}

/**
 * OS MOBS QUE O JOGADOR NESSE MAPA REALMENTE ENCONTRA.
 *
 * ## POR QUE `createCreatureRoster` E NAO A LISTA DE TIPOS
 *
 * Porque o roster e o que o mapa REALMENTE spawna: ja vem com o nivel da
 * zona resolvido, o `maxHp` escalado e o loot completo. Reconstruir isso
 * aqui seria escrever de novo a regra de nivel por zona e a de escala — e
 * errar uma das duas sem nenhuma pista, porque o numero errado aparece
 * so no relatorio
 *
 * ## E POR QUE A JANELA E [nivel - 1, nivel + 1]
 *
 * Porque o relatorio conta o que o jogador MATARIA, e nao o que existe no
 * mapa. Sem o filtro, quem esta no nivel 1 teria o mapa inteiro na conta
 * e o numero de abates nao diria nada sobre o poder dele
 *
 * ## E O QUE ACONTECE QUANDO A JANELA NAO TEM NINGUEM
 *
 * Acontece. O mapa 1 vai do nivel 1 ao 12, e um jogador de nivel 15 tem
 * uma janela [14, 16] completamente vazia: sem o reserva o farm devolveria
 * zero abates para quem esta no meio da campanha
 *
 * O reserva pega os DOIS niveis mais proximos que existem no mapa. E ele
 * prefere o mais BAIXO quando ha empate, porque um jogador de nivel 15
 * contra o nivel 14 e uma luta, e contra o 16 e uma tanda de que ele
 * ja subiu demais — e o relatorio nao deve empurrar o jogador para cima
 */
export function mobsPara(mapaId, nivel, opcoes = {}) {
  const desvio =
    opcoes.desvioNivel ?? FARM_OFFLINE.DESVIO_NIVEL;

  const mapa = getMap(mapaId);

  if (!mapa) return [];

  const roster = createCreatureRoster(mapa);

  const doJogador = Math.max(1, Number(nivel) || 1);

  const janela = roster.filter((c) => {
    if (!c.isCreature) return false;

    const lvl = c.level ?? 1;

    return lvl >= doJogador - desvio && lvl <= doJogador + desvio;
  });

  if (janela.length > 0) return janela;

  const niveis = [...new Set(roster.filter((c) => c.isCreature).map((c) => c.level ?? 1))]
    .sort((a, b) => {
      const distancia = Math.abs(a - doJogador) - Math.abs(b - doJogador);

      // empate de distancia vai para o nivel MENOR
      return distancia !== 0 ? distancia : a - b;
    })
    .slice(0, 2);

  return roster.filter((c) => c.isCreature && niveis.includes(c.level ?? 1));
}

/**
 * RESOLVE O FARM: e aqui que o tempo vira numero.
 *
 * ## O QUE ESTA FUNCAO FAZ, EM ORDEM
 *
 * 1. Mede o tempo desde `ultimoEm`, com o teto de 12 horas
 * 2. Descobre os mobs do mapa que o jogador encara
 * 3. Converte o tempo em ABATES, usando o ataque dele contra a vida deles
 * 4. Sorteia o loot de verdade sobre uma AMOSTRA, e multiplica
 * 5. Devolve o relatorio E o novo estado, ja desligado
 *
 * ## POR QUE ELA NAO ENTREGA NADA
 *
 * Porque entregar item exige saber o que cabe na mochila, o que esta
 * vestido e o que ja existe — e `Inventory` e `Equipment` nao tem nada a
 * ver com "quanto tempo rendeu". Quem entrega e o servidor, que chama
 * esta funcao e depois usa o `relatorio.ganhos` como uma lista comum
 *
 * ## POR QUE A AMOSTRA E MULTIPLICADA
 *
 * Ver `AMOSTRA_ABATES`. A distribuicao e a do jogo; so o numero de
 * sorteios e menor, e o total e o do tempo real
 */
export function resolver({
  estado,
  jogador,
  agora,
  loot = null,
  opcoes = {},
}) {
  const inicio = Number(agora);

  const mapaId = estado?.mapaId ?? opcoes.mapaPadrao ?? null;

  const vazio = {
    ...estadoInativo(mapaId),
    relatorio: relatorioVazio(estado, inicio, mapaId, "sem-mob"),
  };

  if (!estado?.ativo || !Number.isFinite(Number(estado.ultimoEm))) {
    return { estado: encerrar(estado), relatorio: null, ganhos: [] };
  }

  const { ms, saturou } = tempoDeFarm(estado, inicio, opcoes);

  const inicioEm = Number(estado.ultimoEm);

  const relatorioBase = {
    inicioEm,
    fimEm: inicio,
    duracaoMs: Math.max(0, inicio - inicioEm),
    duracaoEfetivaMs: ms,
    mapaId,
    abates: 0,
    xp: 0,
    nivelAntes: Math.max(1, Math.floor(Number(jogador?.level) || 1)),
    nivelDepois: Math.max(1, Math.floor(Number(jogador?.level) || 1)),
    coins: 0,
    naMochila: 0,
    noBau: 0,
    perdidos: 0,
    motivo: ms <= 0 ? "sem-tempo" : saturou ? "teto" : "",
    itens: [],
    mobs: [],
  };

  if (ms <= 0) {
    return {
      estado: { ...encerrar(estado), relatorio: relatorioBase },
      relatorio: relatorioBase,
      ganhos: [],
    };
  }

  const mobs = mobsPara(mapaId, relatorioBase.nivelAntes, opcoes);

  if (mobs.length === 0) {
    return {
      estado: { ...encerrar(estado), relatorio: { ...relatorioBase, motivo: "sem-mob" } },
      relatorio: { ...relatorioBase, motivo: "sem-mob" },
      ganhos: [],
    };
  }

/**
   * OS GRUPOS DE ABATE, e o tempo e DIVIDIDO entre eles.
   *
   * ## O ERGO QUE ESTA ESTRUTURA CORRIGE
   *
   * A primeira versao dava o tempo INTEIRO a cada criatura e somava os
   * abates. Com cinquenta criaturas no roster, o jogador recebia cinquenta
   * vezes o tempo: nivel 1, duas horas, onze mil abates. O numero nao
   * estava nem perto do possivel
   *
   * ## POR QUE AGRUPAR POR TIPO
   *
   * Porque o jogador nao esta em cinquenta lugares ao mesmo tempo. Ele
   * limpa uma zona, passa para a proxima, e em cada zona o que ele mata e
   * o mesmo bicho duas ou tres vezes seguidas. O grupo por `typeId` e essa
   * unidade: uma "sessao de farm" num tipo de bicho
   *
   * ## E POR QUE CADA GRUPO TEM O MESMO TEMPO
   *
   * Porque ele divide o tempo entre os tipos, e nao entre as criaturas. Um
   * jogador de nivel 30 com o mapa inteiro aberto divide o dia entre os
   * tipos que ele encara, e nao spends duas horas no primeiro que achar
   *
   * E o que faz o relatorio mostrar varios bichos em vez de um so, sem
   * inventar um numero de tempo que nao existe
   */
  const grupos = agruparPorTipo(mobs, jogador?.attack, relatorioBase.nivelAntes);

  if (grupos.length === 0) {
    return {
      estado: { ...encerrar(estado), relatorio: { ...relatorioBase, motivo: "sem-abates" } },
      relatorio: { ...relatorioBase, motivo: "sem-abates" },
      ganhos: [],
    };
  }

  /**
   * O TEMPO UTIL, EM SEGUNDOS, E A DIVISAO ENTRE OS GRUPOS.
   *
   * `EFICIENCIA` tira de cena o que nao e abate; o resto do tempo vai
   * metade para cada grupo. O `TETO_ABATES` NAO entra aqui: e um teto de
   * QUANTOS abates um grupo pode ter, e ele e aplicado logo abaixo, no
   * `Math.min` de cada grupo. Uma versao anterior dividia o tempo por ele
   * e o resultado era zero abate para qualquer jogador
   */
  const tempoUtil = (ms / 1000) * FARM_OFFLINE.EFICIENCIA;

  const segundosPorGrupo = tempoUtil / grupos.length;

  let abates = 0;

  for (const grupo of grupos) {
    grupo.abates =
      grupo.tempoPorAbate > 0
        ? Math.min(
            FARM_OFFLINE.TETO_ABATES,
            Math.floor(segundosPorGrupo / grupo.tempoPorAbate),
          )
        : 0;

    abates += grupo.abates;
  }

  abates = Math.min(abates, FARM_OFFLINE.TETO_ABATES);

  if (abates <= 0) {
    return {
      estado: { ...encerrar(estado), relatorio: { ...relatorioBase, motivo: "sem-abates" } },
      relatorio: { ...relatorioBase, motivo: "sem-abates" },
      ganhos: [],
    };
  }

  /**
   * A AMOSTRA, e o `fator` que a transforma no total.
   *
   * Se o total cabe na amostra, a amostra e o total — `fator` vale 1 e
   * nada e multiplicado. O caminho comum (jogador normal, farm de 2h) e
   * EXATO
   */
  const amostra = Math.min(abates, FARM_OFFLINE.AMOSTRA_ABATES);

  const fator = abates / amostra;

  /**
   * O SORTEADOR.
   *
   * E o `LootSystem` de verdade, o mesmo que roda no jogo. Nao ha
   * `random` injetavel aqui e isso e proposital: o `LootSystem` sorteia
   * com o `Math.random` dele, e um farm offline com outra semente daria
   * loot que o jogador nao veria NUNCA online
   *
   * O `world` do construtor fica de fora porque `roll` nao o usa — so a
   * `roll` e a `rollCoins`, que leem a tabela da criatura
   */
  const sorteador = loot ?? new LootSystem();

  const ganhos = [];
  const porItem = new Map();

  let xp = 0;
  let coins = 0;

  /**
   * O FATOR DE AMOSTRA, e o FATOR DE ESCALA.
   *
   * Sao duas multiplicacoes e nao uma porque elas respondem a perguntas
   * diferentes:
   *
   * - `fator` (o de amostra) corrige o atalho: sorteamos 200 e o tempo
   *   diz `abates`, entao multiplicamos
   * - `escala` e o BALANCEAMENTO: o jogo foi ajustado para render metade
   *
   * Juntados dariam um numero so que ninguem conseguiria mexer no
   * balanceamento sem mexer no atalho por acidente
   */
  const escala = FARM_OFFLINE.ESCALA;

  for (let i = 0; i < amostra; i += 1) {
    const grupo = grupos[Math.min(i, grupos.length - 1)];
    const mob = grupo.mob;

    xp += xpForKill(mob) * fator * escala;

    /**
     * O `roll` DEVOLVE AS MOEDAS, e nao so os itens.
     *
     * Chamar `rollCoins` e depois `roll` contaria o ouro duas vezes — e o
     * bug apareceria como um ouro inflado no relatorio, sem nenhum erro
     * em lugar nenhum. `roll` e a chamada unica
     */
    const sorteado = sorteador.roll(mob, jogador?.lootFilter ?? null);

    coins += sorteado.coins * fator * escala;

    for (const item of sorteado.items) {
      /**
       * A ESCALA NOS ITENS, e ela usa `floor` E PULA o que da zero.
       *
       * ## POR QUE NAO O MESMO `Math.max(1, ...)` DE ANTES
       *
       * Com o piso em 1, a metade das multiplicacoes cairia em menos de
       * um e voltaria para 1: um farm pequeno nao perderia UM item sequer,
       * que e o oposto do que a escala pede. O piso existe para o jogo
       * nunca devolver "zero items" num sorteio que deu item — mas aqui o
       * sorteio dar e a escala mandar embora sao coisas diferentes
       *
       * ## POR QUE PULAR E MELHOR QUE ARREDONDAR
       *
       * `Math.round(0.5)` e 1 em JavaScript, entao arredondar devolveria
       * exatamente o item que a escala queria tirar. Com `floor`, metade
       * dos itens somem de verdade — que e o que "50% menos drop"
       * significa
       *
       * O sorteio continua sendo o do jogo. A escala nao mexe na chance:
       * ela mexe no que foi sorteado, e o que nao passou do corte nao
       * entra nem na lista de entrega nem na lista do relatorio
       */
      const quantidade = Math.floor(
        Math.max(1, Number(item.count) || 1) * fator * escala,
      );

      if (quantidade <= 0) continue;

      ganhos.push({ ...item, count: quantidade });

      /**
       * A AGREGACAO E SÓ PARA MOSTRAR.
       *
       * A tela mostra "12x Osso Quebrado", e nao doze linhas. O que vai
       * para o inventario continua sendo a lista `ganhos`, com o afixo de
       * cada um: agregar o desenho nunca agrega o que foi entregue
       */
      const chave = item.itemId;

      const anterior = porItem.get(chave);

      if (anterior) {
        anterior.count += quantidade;
      } else {
        porItem.set(chave, {
          itemId: item.itemId,
          nome: getItem(item.itemId)?.name ?? item.itemId,
          count: quantidade,
        });
      }
    }

    }

  const entregue = limitaEntregues(ganhos, FARM_OFFLINE.TETO_ITENS_ENTREGUE);

  const relatorio = relatorioDe({
    base: relatorioBase,
    abates,
    xp,
    coins,
    ganhos: entregue.entregues,
    porItem,
    grupos,
  });

  relatorio.entregues = entregue.entregues.length;
  relatorio.descartadoNoFarm = entregue.descartado;

  return {
    estado: { ...encerrar(estado), relatorio },
    relatorio,
    ganhos: entregue.entregues,
  };
}

/**
 * CORTA A LISTA DE ITENS no limite, e CONTA o que sobrou.
 *
 * ## POR QUE CORTA O FIM E NAO O COMECO
 *
 * Porque a lista sai na ordem em que o sorteio caiu, e o inicio da lista
 * e o que o jogador viu acontecer primeiro. Descartar o fim descarta o
 * que ele teria ganho por ultimo — que e a mesma coisa que o jogo faz
 * quando a mochila enche
 *
 * ## E POR QUE SOME A UNIDADE, E NAO A ENTRADA
 *
 * Porque "descartado" na tela do jogador e um numero de COISAS. Perder
 * uma pilha de duzentos couros e perder quatrocentas luvas sao numeros
 * diferentes, e o que ele espera ver e o total que nao coube
 */
function limitaEntregues(ganhos, teto) {
  if (ganhos.length <= teto) {
    return { entregues: ganhos, descartado: 0 };
  }

  const mantidas = ganhos.slice(0, teto);

  const descartado = ganhos
    .slice(teto)
    .reduce((total, entrada) => total + Math.max(0, Number(entrada.count) || 0), 0);

  return { entregues: mantidas, descartado };
}

/**
 * AGRUPA AS CRIATURAS POR TIPO, com o tempo de abate de cada uma.
 *
* ## POR QUE O GRUPO E TIPO **E NIVEL**, E NAO SO O TIPO
   *
   * Agrupar so pelo tipo fundia os slimes de nivel 3, 4 e 5 numa linha
   * so — e a linha mostrava o nivel da PRIMEIRA criatura do grupo, que e a
   * ordem do roster, nao a ordem em que o jogador matou. Um jogador de
   * nivel 4 lia "Esqueleto Nv 5" com todos os abates dentro, que e
   * exatamente a leitura que a janela de nivel veio para eliminar
   *
   * Com tipo e nivel no grupo, cada linha e uma coisa que aconteceu: quantos
   * Esqueletos de nivel 3 e quantos de nivel 5
   *
   * ## O PESO DO NIVEL ACIMA ENTRA AQUI, E E O LUGAR CERTO
   *
   * Um mob um nivel acima do jogador nao e excluido: ele entra no relatorio
   * e continua sendo o que existe no mapa. O que muda e o TEMPO que ele
   * consome — e o tempo de abate e a unica coisa que traduz "mais dificil"
   * em numero
   *
   * Com `peso = 0,35`, a criatura entra na media ponderada como
   * `0,35 / tempo`. Um grupo so de mobs um nivel acima fica 2,9 vezes mais
   * lento, e o jogador ganha cerca de um terco dos abates do mesmo bicho um
   * nivel abaixo
   *
   * ## POR QUE A MEDIA PRECISA DA CONTAGEM
   *
   * `n / soma(peso / t)`, e nao `1 / soma(peso / t)`. A primeira versao
   * esqueceu o `n`, e o resultado foi um tempo de abate proporcional ao
   * INVERSO do numero de criaturas: um grupo de quarenta e seis slimes dava
   * 1,5s em vez de 32, e o jogador de nivel 1 recebia mil abates em duas
   * horas. O piso de `SEGUNDOS_POR_ABATE_MINIMO` escondia o erro — sem ele
   * o numero seria ainda pior, nao melhor
   *
   * @returns {Array<{mob: object, tempoPorAbate: number, abates: number}>}
   */
function agruparPorTipo(criaturas, attack, nivelJogador = 1) {
  const dano =
    Math.max(1, Number(attack) || 0) * FARM_OFFLINE.FATOR_DANO_POR_SEGUNDO;

  const pesoNivelAcima = FARM_OFFLINE.PESO_NIVEL_ACIMA;

  const doJogador = Math.max(1, Number(nivelJogador) || 1);

  const porTipo = new Map();

  for (const criatura of criaturas) {
    const tipo = criatura.typeId ?? criatura.id;

    const nivel = criatura.level ?? 1;

    /**
     * A CHAVE COM O NIVEL DENTRO.
     *
     * E o que impede a fusao que escondia os niveis. Duas criaturas do
     * mesmo tipo em niveis diferentes sao duas linhas do relatorio, porque
     * sao duas coisas que o jogador matou em tempos diferentes
     */
    const chave = `${tipo}@${nivel}`;

    const peso = nivel > doJogador ? pesoNivelAcima : 1;

    if (!porTipo.has(chave)) {
      porTipo.set(chave, {
        mob: criatura,
        inversos: 0,
        quantidade: 0,
      });
    }

    const entrada = porTipo.get(chave);

    const segundos = Math.max(
      FARM_OFFLINE.SEGUNDOS_POR_ABATE_MINIMO,
      Math.max(1, Number(criatura.maxHp) || 0) / dano,
    );

    entrada.inversos += peso / segundos;
    entrada.quantidade += 1;
  }

  return [...porTipo.values()].map((entrada) => {
    /**
     * A MEDIA HARMONICA PRECISA DA CONTAGEM.
     *
     * `n / soma(1/t)`, e nao `1 / soma(1/t)`. A primeira versao deste
     * codigo esqueceu o `n`, e o resultado foi um tempo de abate
     * proporcional ao INVERSO do numero de criaturas: um grupo de
     * quarenta e seis slimes dava 1,5 s em vez de 32, e o jogador de
     * nivel 1 recebia mil abates em duas horas. O piso de
     * `SEGUNDOS_POR_ABATE_MINIMO` escondia o erro — sem ele o numero
     * seria ainda pior, nao melhor
     */
    const media =
      entrada.quantidade > 0 ? entrada.quantidade / entrada.inversos : 0;

    return {
      mob: entrada.mob,
      tempoPorAbate: Math.max(
        FARM_OFFLINE.SEGUNDOS_POR_ABATE_MINIMO,
        media,
      ),
      abates: 0,
    };
  });
}

/**
 * A MONTAGEM DO RELATORIO, e ela arredonda os abates por mob.
 *
 * Os abates por tipo sao `abates * fração`, e a fração vem de uma
 * divisao. O resultado chegava na tela como `785.0550000000027`, e isso
 * vai para o `PLAYER_STATE` de todo mundo no servidor a 4Hz
 *
 * O arredondamento e feito AQUI e nao no `sanear` porque o numero que
 * sobra depois do arredondamento tem de fechar com o total: se cada tipo
 * arredonda para cima, a soma passa do `abates` e o relatorio mente. Por
 * isso o arredondamento e para BAIXO, e o resto fica com o ultimo tipo,
 * que e o unico que sobra
 */
function relatorioDe({
  base,
  abates,
  xp,
  coins,
  ganhos,
  porItem,
  grupos,
}) {
  const itens = [...porItem.values()].sort(
    (a, b) => b.count - a.count,
  );

  const porMob = grupos.map((grupo, indice) => ({
    /**
     * A CHAVE COM O NIVEL, E A MESMA DO AGRUPAMENTO.
     *
     * Duas linhas de relatorio podem ter o mesmo `typeId` — os dois
     * "Goblin", e os slimes de nivel 3 e 5 — entao a chave precisa do que
     * as separa. Sem o nivel, o React avisaria de chave duplicada e o
     * jogador veria uma das linhas substituir a outra
     */
    chave: `${grupo.mob.typeId ?? grupo.mob.id}@${grupo.mob.level ?? 1}`,

    typeId: grupo.mob.typeId ?? grupo.mob.id,
    nome: grupo.mob.name ?? grupo.mob.typeId,

    /**
     * O NIVEL DA CRIATURA, e ele esta aqui por um motivo de tela.
     *
     * O jogo tem DOIS criaturas chamadas "Goblin" — `ogre_da_predeira` e
     * `ogre` — e o catalogo nao renomeia nenhuma das duas, porque o id e
     * o que o bestiario, as missoes de cacada e os `mix` de zona usam para
     * achar a criatura
     *
     * Sem o nivel, o relatorio mostrava duas linhas identicas com "Goblin"
     * e numeros diferentes, e o jogador leria como bug. Com o nivel, as
     * duas linhas se distinguem — e o numero ainda diz o que ele quer saber
     * num relatorio de farm: contra o que ele gastou o tempo
     */
    nivel: Math.max(1, Math.floor(Number(grupo.mob.level) || 1)),

    abates:
      indice === grupos.length - 1
        ? Math.max(0, abates - somaArredondada(grupos, indice))
        : Math.floor(grupo.abates),
  }));

  return {
    ...base,
    abates,
    xp: Math.floor(xp),
    coins: Math.floor(coins),
    itens,
    mobs: porMob,
  };
}

/** A soma dos abates dos grupos ANTES do indice indicado. */
function somaArredondada(grupos, indice) {
  let total = 0;

  for (let i = 0; i < indice; i += 1) {
    total += Math.floor(grupos[i].abates);
  }

  return total;
}

/**
 * O RELATORIO DE UM FARM QUE NAO RENDEU NADA.
 *
 * Existe para o modal ter o que mostrar. "Voce voltou e nao aconteceu
 * nada" sem numero nenhum e indistinguivel de um bug — o jogador nao sabe
 * se o farm falhou, se o tempo era curto demais, ou se o mapa estava vazio
 */
function relatorioVazio(estado, agora, mapaId, motivo) {
  return {
    inicioEm: Number(estado?.ultimoEm) || 0,
    fimEm: agora,
    duracaoMs: Math.max(
      0,
      agora - (Number(estado?.ultimoEm) || agora),
    ),
    duracaoEfetivaMs: 0,
    mapaId,
    abates: 0,
    xp: 0,
    nivelAntes: Math.max(1, Math.floor(Number(estado?.nivel) || 1)),
    nivelDepois: Math.max(1, Math.floor(Number(estado?.nivel) || 1)),
    coins: 0,
    naMochila: 0,
    noBau: 0,
    perdidos: 0,
    motivo,
    itens: [],
    mobs: [],
  };
}

/**
 * O TEXTO QUE A PAUSA MOSTRA COM O FARM LIGADO.
 *
 * Fica aqui e nao no HUD porque a regra do teto e deste arquivo: se a HUD
 * tivesse o numero, teria duas verdadeis sobre quanto tempo ainda resta
 */
export function descricaoDeFarm(estado, agora, opcoes = {}) {
  if (!estado?.ativo) return null;

  const { ms, saturou } = tempoDeFarm(estado, agora, opcoes);

  return {
    ms,
    saturou,
    horas: Math.floor(ms / 3_600_000),
    minutos: Math.floor((ms % 3_600_000) / 60_000),
    segundos: Math.floor((ms % 60_000) / 1000),
    teto: opcoes.duracaoMaximaMs ?? FARM_OFFLINE.DURACAO_MAXIMA_MS,
  };
}

export { MAX_LEVEL };