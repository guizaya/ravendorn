/**
 * A GUILDA: as regras, e nada de estado.
 *
 * Este arquivo e o que a guilda E. O `GuildStore` guarda quem esta em
 * qual guilda; aqui mora o que vale para toda guilda do jogo, e o que
 * um jogador consegue fazer numa guilda
 *
 * A separacao e a mesma do catalogo de itens e do de monstros: dado que
 * o mundo inteiro le e que nao muda, fica num modulo so. Se um numero
 * como "quantos membros uma guilda tem" vivesse dentro do store, cada
 * lugar que precisasse dele teria que abrir o store
 *
 * As tres secoes:
 *
 * 1. papeis e limites
 * 2. a arvore de talentos
 * 3. a validacao de nome e tag
 */

/* ============================================================================
   1. PAPEIS E LIMITES
   ============================================================================ */

/**
 * Os tres papeis.
 *
 * A ordem importa: `podeGerenciar` e o que compara o indice, e o
 * LIDER tem que vir antes dos outros
 */
export const GUILD_ROLE = Object.freeze({
  LIDER: "lider",
  CO_LIDER: "coLider",
  MEMBRO: "membro",
});

/** o papel de maior privilegio primeiro */
export const GUILD_ROLE_ORDEM = Object.freeze([
  GUILD_ROLE.LIDER,
  GUILD_ROLE.CO_LIDER,
  GUILD_ROLE.MEMBRO,
]);

/**
 * O PAPEL e forte o bastante para abrir o cofre?
 *
 * O cofre e a EXCEPTION declarada do resto: o jogador pediu que so a
 * diretoria entrasse nele. Todo o resto da guilda — pontos, talentos,
 * sair, candidatar-se — e de qualquer membro
 */
export function podeGerenciar(guilda, jogadorId) {
  if (!guilda) return false;

  return (
    guilda.liderId === jogadorId ||
    guilda.coLiderId === jogadorId
  );
}

/** quantos cargos de diretoria existem: um lider e UM co-lider */
export const GUILD_CARGA = Object.freeze({
  LIDER: 1,
  CO_LIDER: 1,
});

export const GUILD_NOME_MIN = 3;
export const GUILD_NOME_MAX = 24;
export const GUILD_TAG_MIN = 2;
export const GUILD_TAG_MAX = 4;

/**
 * Quantos membros a guilda aceita, e quantos pedidos de entrada.
 *
 * O limite de membros e o que impede uma guilda de virar o servidor
 * inteiro: sem ele, o painel de Anyone Could join seria uma fila sem
 * fim e o bonus de guilda seria o bonus de todo mundo
 */
export const GUILD_MEMBROS_MAX = 40;
export const GUILD_PEDIDOS_MAX = 30;

/**
 * O PRECO de fundar uma guilda: **10 moedas**.
 *
 * E o que separa "entrar na guilda do outro" de "fundar a sua". Sem
 * custo, o primeiro jogador a digitar um nome teria uma guilda, e o
 * nome seria o unico criterio — e buscar nome seria o jogo inteiro
 *
 * Sao 10 moedas, e nao uma fortuna: o preco tem que pesar o bastante
 * para o jogador pensar duas vezes, e ser tao baixo que nao trave o
 * jogo novo. Quem ganhou o ouro nao sente, e quem perdeu um mob troca
 * a fila do bau por um bau
 *
 * O dinheiro vai para o COFRE da guilda recem-criada, nao para o
 * jogador: e patrimonio coletivo, e nao ha como voltar para o bolso
 */
export const GUILD_CRIACAO_CUSTO = 10;

/**
 * As moedas como o jogador as le: `1.250.000`.
 *
 * O valor cru — `1250000` — e ilegivel numa tela de RPG. Um numero
 * grande tem de parecer grande, e nao um numero de telefone. O
 * separador de milhar e o que faz essa diferenca, entao ele fica aqui
 * e nao espalhado por cada painel
 */
export function formatarMoedas(valor) {
  return Math.max(0, Math.floor(Number(valor) || 0)).toLocaleString("pt-BR");
}

/* ============================================================================
   2. OS PONTOS
   ============================================================================ */

/**
 * QUANDO o membro ganha ponto, e quanto pode guardar.
 *
 * A regra pedida: **1 ponto por hora**, o ponto chega **mesmo com o
 * jogador offline**, e o total para em **24**
 *
 * O "mesmo offline" nao e um caso especial de codigo — e o que sai de
 * guardar QUANDO o ultimo ponto foi dado, e nao quantos tem. O store
 * recalcula pelo relogio quando o jogador volta, entao o tempo em que
 * o servidor estava desligado conta igual
 *
 * E o teto de 24 e o que da sentido a arvore: a arvore inteira custa
 * 24 pontos (veja `GUILD_TALENT_CUSTO_TOTAL`), entao um membro que
 * fica 24 horas fora volta capaz de destravar tudo sozinho. Isso e de
 * proposito — a guilda de quem nao joga nao fica parada
 */
export const GUILD_PONTO_INTERVALO_MS = 60 * 60 * 1000;
export const GUILD_PONTOS_MAX = 24;

/**
 * Os pontos que o TEMPO deu, desde a ultima visita.
 *
 * Devolve o numero a adicionar e o instante a partir do qual contar de
 * novo. E uma funcao pura: o tempo entra, o numero sai, e o store
 * decide o que fazer com ele
 *
 * ESTA funcao nao aplica o teto de 24, e a decisao e dela nao: aqui so
 * corre o relogio. Quem sabe quanto o jogador JA tem e o store, e o
 * teto e sobre o SALDO, nao sobre o tempo
 *
 * A razao de o teto nao ser daqui e que "24" tem dois lugares
 * possiveis e eles dao resultados diferentes. Se o teto cortasse o
 * TEMPO, um jogador com 10 pontos que ficasse 30 dias offline ganharia
 * 24 e passaria a ter 34. Se o teto corta o SALDO — que e o que foi
 * pedido — ele ganha ate 24, para nos 24, e so volta a ganhar depois
 * de gastar
 *
 * O `proximoEm` sai sempre pela conta matematica, sem corte. Assim o
 * relogio fica em dia quando o jogador volta, e o excesso de horas se
 * perde em vez de virar uma divida que da pontos de novo na proxima
 * visita
 */
export function pontosDesde(
  ultimoPontoEm,
  agora,
  { intervaloMs = GUILD_PONTO_INTERVALO_MS } = {},
) {
  // sem registro ainda: o primeiro ponto conta a partir de agora, e nao
  // de quando a guilda foi criada. Um jogador novo que entra na semana
  // seguinte do mundo nao pode vir com 200 pontos de presente
  if (
    ultimoPontoEm === null ||
    ultimoPontoEm === undefined
  ) {
    return { pontos: 0, proximoEm: agora };
  }

  const decorrido = agora - ultimoPontoEm;

  if (decorrido < intervaloMs) {
    return { pontos: 0, proximoEm: ultimoPontoEm };
  }

  const ganhos = Math.floor(decorrido / intervaloMs);

  return {
    pontos: ganhos,
    proximoEm: ultimoPontoEm + ganhos * intervaloMs,
  };
}

/* ============================================================================
   3. A ARVORE DE TALENTOS
   ============================================================================ */

/**
 * Os NODES da arvore.
 *
 * Cada node declara o que custa, o que DA e o que exige antes. O
 * `exige` e o ID do node pai: e ele que faz a arvore ser uma arvore e
 * nao uma lista. Um node sem `exige` e a raiz do seu tier
 *
 * A soma dos custos e **24** — o mesmo numero do teto de pontos. E o
 * que fecha o desenho: a arvore inteira cabe nos pontos que um membro
 * junta em um dia offline, e ninguem precisa jogar 24 horas seguidas
 * para unlockar tudo
 *
 * Os bonuses sao somados como os de qualquer outra fonte, em
 * `mergeBonuses`. Um node de `attack` e um `attack` a mais para todo
 * membro, e nao para quem comprou
 */
export const GUILD_TALENTS = Object.freeze([
  /* --- tier 1: as raizes. Um ponto cada, e os quatro sao faceis --- */
  {
    id: "mao_leve",
    nome: "Mao Leve",
    custo: 1,
    tier: 1,
    exige: null,
    descricao: "+3 de ataque",
    bonus: { attack: 3 },
  },
  {
    id: "pele_dura",
    nome: "Pele Dura",
    custo: 1,
    tier: 1,
    exige: null,
    descricao: "+6 de defesa",
    bonus: { defense: 6 },
  },
  {
    id: "passo_leve",
    nome: "Passo Leve",
    custo: 1,
    tier: 1,
    exige: null,
    descricao: "+3 de velocidade",
    bonus: { speed: 3 },
  },
  {
    id: "folego",
    nome: "Folego",
    custo: 1,
    tier: 1,
    exige: null,
    descricao: "+20 de vida",
    bonus: { maxHp: 20 },
  },

  /* --- tier 2: depends de uma raiz. Tres pontos cada --- */
  {
    id: "golpe_duplo",
    nome: "Golpe Duplo",
    custo: 3,
    tier: 2,
    exige: "mao_leve",
    descricao: "+9 de ataque",
    bonus: { attack: 9 },
  },
  {
    id: "couro_reforcado",
    nome: "Couro Reforcado",
    custo: 3,
    tier: 2,
    exige: "pele_dura",
    descricao: "+18 de defesa",
    bonus: { defense: 18 },
  },
  {
    id: "corrida",
    nome: "Corrida",
    custo: 3,
    tier: 2,
    exige: "passo_leve",
    descricao: "+9 de velocidade",
    bonus: { speed: 9 },
  },
  {
    id: "segunda_pele",
    nome: "Segunda Pele",
    custo: 3,
    tier: 2,
    exige: "folego",
    descricao: "+60 de vida",
    bonus: { maxHp: 60 },
  },

  /* --- tier 3: o topo. Custa o que resta da arvore --- */
  {
    id: "lemao",
    nome: "Leao",
    custo: 4,
    tier: 3,
    exige: "golpe_duplo",
    descricao: "+30 de ataque",
    bonus: { attack: 30 },
  },
  {
    id: "muralha",
    nome: "Muralha",
    custo: 4,
    tier: 3,
    exige: "couro_reforcado",
    descricao: "+60 de defesa",
    bonus: { defense: 60 },
  },
]);

/** o custo de destravar a arvore inteira */
export const GUILD_TALENT_CUSTO_TOTAL = GUILD_TALENTS.reduce(
  (total, node) => total + node.custo,
  0,
);

const TALENT_POR_ID = new Map(
  GUILD_TALENTS.map((node) => [node.id, node]),
);

/** o node de um id, ou `null` */
export function getTalent(id) {
  return TALENT_POR_ID.get(id) ?? null;
}

/** o node pode ser destravado com os talents ja abertos? */
export function talentDisponivel(talentId, TalentosAbertos) {
  const node = getTalent(talentId);

  if (!node) return false;

  if (TalentosAbertos.has(talentId)) return false;

  if (!node.exige) return true;

  return TalentosAbertos.has(node.exige);
}

/**
 * Os bonuses somados dos talents abertos.
 *
 * A MESMA forma que `mergeBonuses` consome, e por isso que o motor
 * recebe como mais um termo, e nao um `if` so para guilda
 *
 * Nao ha estado aqui: quem guarda quais talents estao abertos e o
 * store, porque essa lista e por guilda e muda no servidor
 */
export function talentBonuses(talentIds) {
  const bonus = {};

  for (const id of talentIds) {
    const node = getTalent(id);

    if (!node) continue;

    for (const [stat, valor] of Object.entries(node.bonus)) {
      bonus[stat] = (bonus[stat] ?? 0) + valor;
    }
  }

  return bonus;
}

/* ============================================================================
   5. OS MOTIVOS DE RECUSA
   ============================================================================ */

/**
 * As recusas, em portugues.
 *
 * O store devolve CODIGOS e nao frases, porque o mesmo motivo aparece
 * em mais de um lugar: recusa no servidor e aviso no painel. Traduzir
 * num modulo so evita as duas metades divergirem — e permite o teste do
 * store ler `motivo` sem saber a lingua do jogo
 *
 * A lista e fechada de proposito. Um motivo novo que nao entrar aqui
 * cai no "Nao deu para fazer isso", que e generico demais para ajudar
 * quem errou o nome da guilda
 */
export const GUILD_MENSAGEM = Object.freeze({
  semGuilda: "Voce ainda nao tem guilda.",
  jaTemGuilda: "Voce ja esta em uma guilda.",
  naoEhLider: "So o lider faz isso.",
  semCargo: "So a diretoria pode.",
  guildaNaoExiste: "Essa guilda nao existe mais.",
  nome: "Esse nome de guilda nao serve.",
  ocupado: "Ja existe uma guilda com esse nome.",
  cheio: "A guilda esta cheia.",
  pedidosCheios: "A fila de pedidos esta cheia.",
  semPedido: "Nao ha pedido desse jogador.",
  alvoNaoEhMembro: "Esse jogador nao e membro.",
  alvoEhLider: "O lider nao pode virar co-lider.",
  liderTemQuePassar: "Passe o cargo ou dissolva a guilda.",
  talentNaoExiste: "Esse talento nao existe.",
  jaDestraulado: "Esse talento ja foi destravado.",
  exigePai: "Destrave o talento anterior primeiro.",
  pontosInsuficientes: "Voce nao tem pontos suficientes.",

  /**
   * Faltam moedas para a TAXA.
   *
   * A mensagem mostra o preco e diz o que falta, porque "moedas
   * insuficientes" sozinha deixa o jogador sem saber se precisa de dez
   * ou de um milhao
   */
  moedasInsuficientes:
    "Criar uma guilda custa 10 moedas.",
});

/** a frase de um motivo, ou a generica quando ele e desconhecido */
export function mensagemDeGuilda(motivo) {
  return (
    GUILD_MENSAGEM[motivo] ?? "Nao deu para fazer isso."
  );
}

/**
 * As letras de um nome de guilda.
 *
 * Com letra, numero e espaco, e o espaco so no meio. A regra barra os
 * casos que nao valem a pena tratar: emoji, acento combinando e
 * controls. Guilda e texto que o jogador digita e todo mundo ve
 */
const NOME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ]{2,23}$/u;
const TAG_RE = /^[\p{L}\p{N}]{2,4}$/u;

/** o motivo da recusa, ou `null` se o nome serve */
export function validarNomeGuilda(nome) {
  const texto = String(nome ?? "").trim();

  if (texto.length < GUILD_NOME_MIN) return "curto";
  if (texto.length > GUILD_NOME_MAX) return "longo";
  if (!NOME_RE.test(texto)) return "caractere";

  return null;
}

/** o motivo da recusa da tag, ou `null` */
export function validarTagGuilda(tag) {
  const texto = String(tag ?? "").trim();

  if (texto.length < GUILD_TAG_MIN) return "curta";
  if (texto.length > GUILD_TAG_MAX) return "longa";
  if (!TAG_RE.test(texto)) return "caractere";

  return null;
}

/**
 * O nome normalizado, para comparar.
 *
 * Minuscula e sem espaco nas pontas: "  Lmao  " e "lmao" sao a mesma
 * guilda, e sem isso o jogador criava "LMAO" e "lmao" como duas
 */
export function normalizarNome(nome) {
  return String(nome ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** a tag em caixa alta: "[LM]" e a forma de mostrar */
export function normalizarTag(tag) {
  return String(tag ?? "")
    .trim()
    .toUpperCase();
}

/** as iniciais que a busca aceita como atalho */
export function chaveDeBusca(texto) {
  return normalizarNome(texto).replace(/\s+/g, "");
}
