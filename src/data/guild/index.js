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
 * O NOME DE CADA BONUS, para o no da arvore mostrar.
 *
 * ## POR QUE ESTA TABELA E NAO O `STAT_DEFS`
 *
 * As chaves de bonus do motor e os ids do catalogo de stats NAO sao os
 * mesmos, e a diferenca e do motor:
 *
 *   bonus do motor   id no STAT_DEFS
 *   speed            movementSpeed
 *   resource         maxResource
 *
 * O `applyEquipment` soma `bonus.speed` em `player.speed` e
 * `bonus.resource` em `player.maxResource`, entao e com esses nomes que o
 * no da arvore tem que entregar o bonus. O rotulo e o que o jogador le
 * na folha de stats, e por isso os dois nomes convivem aqui
 *
 * ## POR QUE ESTA TABELA VIVE NO `data/guild`
 *
 * Porque e dado da guilda: e o nome que o bonus do talento tem quando
 * mostrado no no. Importar o `STAT_DEFS` de `game/stats` aqui viraria um
 * `data` dependendo de `game`, e este arquivo hoje nao importa nada — e
 * essa e a garantia de que ele pode ser lido por qualquer um, inclusive
 * pelo painel, sem puxar o resto do jogo
 *
 * O `sigla` e o que aparece no no (curto, para caber em tres colunas) e o
 * `nome` e o que entra no `title`, que o jogador le com o mouse parado
 * em cima. Um numero sem sigla nao diz se e vida, defesa ou velocidade —
 * o erro mais facil de cometer numa tela cheia de numeros
 */
export const GUILD_BONUS_ROTULO = Object.freeze({
  attack: { sigla: "ATK", nome: "Ataque fisico" },
  defense: { sigla: "DEF", nome: "Defesa fisica" },
  maxHp: { sigla: "HP", nome: "Vida maxima" },
  speed: { sigla: "MSPD", nome: "Velocidade de movimento" },
  resource: { sigla: "MP", nome: "Recurso maximo" },
  resourceRegen: { sigla: "MPRG", nome: "Regeneracao de recurso" },
  attackSpeed: { sigla: "ASPD", nome: "Velocidade de ataque" },
});

/**
 * O NOME DE UM BONUS, ou `null` se a chave nao for conhecida.
 *
 * O `null` e o que impede um no de mostrar `+2 undefined`: um stat novo
 * acrescentado ao catalogo de talentos sem passar por aqui apareceria com
 * a sigla crua, que e pior do que nao aparecer
 */
export function rotuloDoBonus(stat) {
  return GUILD_BONUS_ROTULO[stat] ?? null;
}

/**
 * Os STATS de um no, no nivel pedido, ja com o rotulo.
 *
 * ## POR QUE Some E NAO MULTIPLICA
 *
 * O bonus do no e a soma dos degraus ate o nivel — o mesmo de
 * `talentBonuses`, que e o que o motor aplica no personagem. Se o no
 * mostrasse o valor de um degrau e o motor aplicasse a soma, a tela
 * mentiria: o painel de status diria "+6 ATK" e o personagem teria
 * outro numero
 *
 * E o que o jogador compara com a propria folha: o no diz o quanto a
 * guilda esta dando, e a folha diz o quanto ele tem
 */
export function bonusDoNo(talentId, talentos, nivelAlvo = null) {
  const node = getTalent(talentId);

  if (!node) return [];

  const nivel =
    nivelAlvo === null ? talentNivel(talentId, talentos) : nivelAlvo;

  const total = {};

  for (const degrau of node.niveis.slice(0, nivel)) {
    for (const [stat, valor] of Object.entries(degrau)) {
      total[stat] = (total[stat] ?? 0) + valor;
    }
  }

  return Object.entries(total)
    .filter(([, valor]) => valor > 0)
    .map(([stat, valor]) => {
      const rotulo = rotuloDoBonus(stat);

      return {
        stat,
        valor,
        sigla: rotulo?.sigla ?? stat,
        nome: rotulo?.nome ?? stat,
      };
    });
}

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

/**
 * OS EMBLEMAS QUE UMA GUILDA PODE ESCOLHER.
 *
 * ## POR QUE SAO DOZE E NAO MAIS
 *
 * Porque eles vao num seletor de grade dentro de um painel de 560px, em
 * celulas de 44px: doze dao tres linhas, que e o que cabe sem rolar. Com
 * dezenove seriam quatro linhas e o jogador teria de rolar o seletor para
 * ver metade das opcoes antes de escolher
 *
 * ## POR QUE GLIFO DE TEXTO E NAO EMOJI
 *
 * Porque o emblema vai pintado no CANVAS, em cima de um sprite escuro, e um
 * emoji colorido ali vira um borrão. Estes sao os mesmos glifos que o jogo
 * usa no resto da interface — e o criterio de escolha foi o mesmo dos
 * talentos: formaRecognizivel a 10px, que e o tamanho em que a tag sera
 * desenhada
 *
 * ## E POR QUE ESTES E NAO QUALQUER UM
 *
 * Porque sao eles que formam um conjunto. Um emblema de guilda precisa
 * parecer parte de uma familia: os que entram aqui tem peso visual parecido
 * e cabem num losango de 38px. Um "🎉" ou um "🐉" quebraria a regra
 */
export const GUILD_ICONS = Object.freeze([
  { id: "espadas", glifo: "⚔", nome: "Espadas cruzadas" },
  { id: "escudo", glifo: "⛊", nome: "Escudo" },
  { id: "escudo_broquel", glifo: "⛨", nome: "Broquel" },
  { id: "coroa", glifo: "♛", nome: "Coroa" },
  { id: "torre", glifo: "♜", nome: "Torre" },
  { id: "losango", glifo: "◈", nome: "Losango" },
  { id: "flor", glifo: "❈", nome: "Flor de guerra" },
  { id: "estrela", glifo: "✦", nome: "Estrela" },
  { id: "estrela_dupla", glifo: "✹", nome: "Estrela de doze" },
  { id: "flor_de_lis", glifo: "⚜", nome: "Flor de lis" },
  { id: "cruz", glifo: "✠", nome: "Cruz" },
  { id: "osso", glifo: "☗", nome: "Osso cruzado" },
]);

/** O emblema de uma guilda, ou o primeiro da lista. */
export function getGuildIcon(icone) {
  return GUILD_ICONS.find((i) => i.id === icone) ?? GUILD_ICONS[0];
}

/**
 * AS CORES DE GUILDA.
 *
 * ## POR QUE SAO DEZ E TODAS CLARAS
 *
 * Porque a cor viaja para o CANVAS, pintada em cima de um sprite escuro e de
 * um mapa escuro, com um contorno preto de 3px atras. Uma cor escura
 * desapareceria nos dois lugares — e uma cor que o jogador escolheu para se
 * ver no mundo e invisible no mundo nao serve para nada
 *
 * E nenhuma delas e o branco puro nem o vermelho do jogo: o branco puro e o
 * que o nome ja usa, e o vermelho e a cor de perigo, e uma guilda pintada
 * de vermelho leria como um efeito de dano
 */
export const GUILD_CORES = Object.freeze([
  { id: "dourado", cor: "#ffc247", nome: "Dourado" },
  { id: "creme", cor: "#ffe9b0", nome: "Creme" },
  { id: "ambar", cor: "#ff9d2e", nome: "Ambar" },
  { id: "vermelhao", cor: "#ff5c4d", nome: "Vermelhao" },
  { id: "rosa", cor: "#ff5cc8", nome: "Rosa" },
  { id: "violeta", cor: "#b06bff", nome: "Violeta" },
  { id: "azul", cor: "#3d8bff", nome: "Azul" },
  { id: "ciano", cor: "#22d3ee", nome: "Ciano" },
  { id: "esmeralda", cor: "#25e08a", nome: "Esmeralda" },
  { id: "lima", cor: "#c3f53c", nome: "Lima" },
  { id: "acinzentado", cor: "#9fb3c8", nome: "Acinzentado" },
]);

/** A cor de uma guilda, ou a primeira da lista. */
export function getGuildColor(cor) {
  return GUILD_CORES.find((c) => c.cor === cor) ?? GUILD_CORES[0];
}

/**
 * O `id` de uma cor, pelo hex, e nao o hex direto.
 *
 * E o que a cor vira no pedido do cliente. Mandar o hex significaria o
 * servidor receber uma string de cor de um cliente modificado e pintar texto
 * com qualquer coisa; mandando o id, ele so aceita as onze da lista
 */
export function corParaId(hex) {
  return GUILD_CORES.find((c) => c.cor === hex)?.id ?? GUILD_CORES[0].id;
}

/** O hex de uma cor pelo id, e o que o motor pinta. */
export function corDaGuilda(id) {
  return GUILD_CORES.find((c) => c.id === id)?.cor ?? GUILD_CORES[0].cor;
}

/**
 * Um emblema e uma cor servem para o pedido?
 *
 * ## POR QUE ISTO E UM CATALOGO FECHADO E NAO UM `includes`
 *
 * Porque `cor` e uma string que vem do cliente e vai parar num `fillStyle`.
 * Um `includes` sobre as cores aceitas resolveria so metade: o servidor
 * aceitaria `#fff` de um cliente modificado e nao rejeitaria. Checando o ID
 * contra o catalogo, o cliente pode pedir so o que existe
 *
 * E `semChave` devolve os PADROES em vez de `false`, porque quem chama sem
 * chave e a criacao de uma guilda antiga ou um painel montado sem props: o
 * jogador deve ver dourado e espada, e nao um erro
 */
export function validarEstiloGuilda(bruto) {
  const icone = GUILD_ICONS.some((i) => i.id === bruto?.icone)
    ? bruto.icone
    : GUILD_ICONS[0].id;

  const cor = GUILD_CORES.some((c) => c.id === bruto?.cor)
    ? bruto.cor
    : GUILD_CORES[0].id;

  return { icone, cor };
}

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
 * QUANTOS ITENS DISTINTOS O COFRE AGUENTA.
 *
 * E em PILHAS, como a mochila: um material de 40 e um de 200 ocupam a
 * mesma pilha, porque e o que a fusao do cofre faz. O que limita e o
 * numero de slots, e nao o volume — que e o que permite o cofre guardar
 * uma coleta inteira sem estourar
 *
 * O teto e generoso de proposito: um cofre que enche sozinho trava a
 * diretoria no meio de uma campanha, e a recusa ("cofre cheio") e pior
 * do que o item voltar para a mochila
 */
export const GUILD_COFRE_SLOTS_MAX = 40;

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
 * A ARVORE, em tres colunas e sete nos.
 *
 * ## POR QUE UMA ARVORE E NAO UM NIVEL
 *
 * Cada no e um NODULO que sobe de Nv. 0 a Nv. 5, e cada degrau paga em
 * pontos do jogador. O no e o que da nome a progressao; o degrau e o que
 * da ritmo
 *
 * A arvore tem TRES colunas porque e a profundidade que o desenho pede:
 * as quatro raizes na esquerda, dois nós que dependem de DUAS raizes no
 * meio, e um topo que depende dos dois do meio
 *
 * ## POR QUE UM NO EXIGE VARIOS PAIS
 *
 * E o que separa uma arvore de uma lista. `exige` e uma LISTA de ids, e
 * o no so destrava quando TODOS subiram pelo menos um degrau
 *
 * Com um pai so, as colunas seriam quatro trilhos paralelos e o topo
 * seria a ponta de cada um deles — quatro arvores fingindo ser uma, e o
 * jogador escolheria um ramo e ignoraria o resto. Exigir os dois pais
 * obriga o silencio a andar pelos dois lados, e e isso que faz a coluna
 * do meio valer o investimento
 *
 * ## OS PONTOS SAO DO JOGADOR, E ISSO E O JOGO
 *
 * O `GUILD_PONTO_INTERVALO_MS` continua dando 1 ponto por hora a cada
 * membro, com o teto de 24 do saldo. O gasto e do jogador que sobe o
 * degrau, e o bonus e da guilda
 *
 * E por isso que um no alto custa mais caro que um baixo: o jogador
 * escolhe onde investir primeiro, e a arvore obriga a escolher em varios
 * lugares antes de chegar em qualquer um deles
 */
export const GUILD_TALENT_NIVEL_MAX = 5;

/**
 * AS MARCAS de cada nivel, e elas sao ACUMULADAS.
 *
 * O indice e o nivel que a marca destrava: `4` e o total de pontos que
 * o no precisa ter RECEBIDO para chegar ao Nv. 1, `10` para o Nv. 2, e
 * assim por diante. Nao sao custos de degrau — sa a cumulo
 *
 * ## POR QUE UM PONTO POR CLIQUE, E NAO UM PRECO POR DEGRAU
 *
 * E o que foi pedido, e muda o que a barra significa. Com um preco por
 * degrau, o clique e uma compra: o jogador precisa ter o saldo inteiro,
 * ve um numero secreto e decide. Com um ponto por clique, o clique e uma
 * contribuicao: o no enche um ponto de cada vez, e a barra sobe junto
 *
 * Isso e o que torna a barra HONESTA. Antes ela comparava o saldo do
 * jogador com o custo do degrau — e com 24 pontos e um degrau de 4, os
 * sete nos mostravam 100% ao mesmo tempo, sem nada considerado
 *
 * ## POR QUE ACUMULADO E NAO ZERADO A CADA NIVEL
 *
 * Se o no zerasse ao subir de nivel, o jogador veria a barra pular de
 * 100% para 0% e comecar de novo, e a leitura seria "falta tudo de novo"
 * logo depois de ter conquistado alguma coisa
 *
 * Com a marca acumulada, o no guarda o que ele recebeu e a barra sobe de
 * onde parou. O Nv. 2 e a MESMA barra que ja estava quase cheia, e nao
 * uma barra nova
 *
 * ## POR QUE A CURVA
 *
 * `4, 10, 18, 28, 40` sao degraus de 4, 6, 8, 10 e 12 pontos. O
 * primeiro nivel chega rapido — dois cliques e o jogador ve bonus no
 * personagem —, e o ultimo custa mais que a arvore inteira de uma raiz
 * custava antes. E o que faz o topo da Expedicao ser uma meta de dias,
 * e nao um item de um fim de semana
 */
export const GUILD_TALENT_MARCAS = Object.freeze([4, 10, 18, 28, 40]);

/**
 * O CUSTO DE UM CLIQUE, e ele e SEMPRE 1.
 *
 * Named para o servidor nao repetir o numero magico em tres lugares: o
 * que o painel manda, o que o store desconta e o que a mensagem de
 * recusa promete tem de ser o mesmo numero
 */
export const GUILD_TALENT_POR_CLIQUE = 1;

/**
 * Os nos da arvore, em ordem de leitura: coluna, e dentro dela de cima
 * para baixo
 *
 * Cada `niveis` traz o bonus do DEGRAU, e nao o total: o bonus de um no
 * e a soma dos degraus ate ele. Assim subir e somar, e nao reescrever o
 * numero inteiro do no — que e o que faz o nivel 3 valer 18 e nao 18
 * de novo
 *
 * Todo stat aqui e um que o `applyEquipment` consome de verdade: `attack`,
 * `defense`, `speed`, `maxHp`, `resource` e `resourceRegen`. Um stat
 * inventado seria um no que sobe, brilha e nao muda nada
 *
 * ## SEM `custo` E SEM `exige` DE NUMERO
 *
 * O custo de um no esta em `GUILD_TALENT_MARCAS` e e o mesmo para todos:
 * e o accumulate que diferencia, nao a tabela. O que cada no declara de
 * diferente e so `exige`, a lista de pais, que e o que faz a arvore ser
 * uma arvore
 */

export const GUILD_TALENTS = Object.freeze([
  /* ---------------- coluna 1: as quatro raizes ---------------- */

  {
    id: "salao_artes_marcais",
    nome: "Salao das Artes Marciais",
    coluna: 1,
    exige: [],
    descricao: "Treino dos lutadores da clã",
    icone: "⚔",

    /**
     * O ADEQUAMENTO de ataque, e nao um ataque de valor fixo.
     *
     * Sobe mais nas bordas do que no meio (2, 4, 7, 10, 14) porque o
     * primeiro degrau compra "o grupo ja treina", e o quinto compra "o
     * grupo treina melhor que os outros". A curva diz o que o degrau
     * comprou, e o flat nao diria
     */
    niveis: [
      { attack: 2 },
      { attack: 4 },
      { attack: 7 },
      { attack: 10 },
      { attack: 14 },
    ],
  },
  {
    id: "cofre_clan",
    nome: "Cofre da Clan",
    coluna: 1,
    exige: [],
    descricao: "O tesouro que a clan guarda",
    icone: "◈",

    /**
     * A `resource` e o MANTER do recurso da classe, e nao a bolsa grande:
     * o cofre enche o que o guerreiro carrega. `resourceRegen` entra
     * junto nos degraus altos, porque um cofre cheio que nao se repõe
     * e um cofre que seca
     */
    niveis: [
      { resource: 4 },
      { resource: 8, resourceRegen: 1 },
      { resource: 13, resourceRegen: 2 },
      { resource: 19, resourceRegen: 3 },
      { resource: 26, resourceRegen: 5 },
    ],
  },
  {
    id: "acumulo_energia",
    nome: "Acumulo de Energia",
    coluna: 1,
    exige: [],
    descricao: "A forca que a clan junta e guarda",
    icone: "◉",

    /**
     * A REGENERACAO, e e o no de ritmo: ele nao aumenta o quanto o
     * jogador tem, e o quao depressa volta. Por isso e a raiz que mais
     * rende no primeiro degrau — quem so joga de longe sente a diferenca
     * antes de qualquer outro
     */
    niveis: [
      { resourceRegen: 2 },
      { resourceRegen: 4 },
      { resourceRegen: 7, speed: 2 },
      { resourceRegen: 10, speed: 4 },
      { resourceRegen: 14, speed: 7 },
    ],
  },
  {
    id: "armazem_clan",
    nome: "Armazem da Clan",
    coluna: 1,
    exige: [],
    descricao: "A guarda que sustenta o Lager",
    icone: "▤",

    niveis: [
      { defense: 3 },
      { defense: 6 },
      { defense: 10 },
      { defense: 15 },
      { defense: 21 },
    ],
  },

  /* ---------------- coluna 2: os dois do meio ---------------- */

  {
    id: "rejuvenescimento_guerreiro",
    nome: "Rejuvenescimento do Guerreiro",
    coluna: 2,

    /**
     * DOIS PAIS, e nao um.
     *
     * E o no que faz a coluna do meio valer o investimento: ele so
     * existe para quem subiu o Salao E o Cofre. Quem investe so num
     * ramo chega no meio e trava, e o jogo diz que a vida depende do
     * ataque e do recurso de uma vez
     */
    exige: ["salao_artes_marcais", "cofre_clan"],
    descricao: "A vida do guerreiro se renova",
    icone: "❤",

    niveis: [
      { maxHp: 20 },
      { maxHp: 45 },
      { maxHp: 75 },
      { maxHp: 110 },
      { maxHp: 150 },
    ],
  },
  {
    id: "deposito_comercio",
    nome: "Deposito de Comercio",
    coluna: 2,
    exige: ["acumulo_energia", "armazem_clan"],
    descricao: "As compras da clan ficam mais baratas",
    icone: "⇄",

    niveis: [
      { speed: 3 },
      { speed: 6 },
      { speed: 10, defense: 5 },
      { speed: 15, defense: 9 },
      { speed: 21, defense: 14 },
    ],
  },

  /* ---------------- coluna 3: o topo ---------------- */

  {
    id: "expedicao",
    nome: "Expedicao",
    coluna: 3,

    /**
     * O TOPO, e ele exige os DOIS nos do meio.
     *
     * E o no mais caro da arvore inteira e o unico que mexe em todo
     * stat de uma vez. Quem chega ate aqui subiu as quatro raizes e os
     * dois meios, e o bonus e a soma do caminho todo
     */
    exige: ["rejuvenescimento_guerreiro", "deposito_comercio"],
    descricao: "A clan marcha para fora",
    icone: "✦",

    niveis: [
      { attack: 8, defense: 8, maxHp: 40 },
      { attack: 18, defense: 18, maxHp: 90 },
      { attack: 31, defense: 31, maxHp: 150 },
      { attack: 47, defense: 47, maxHp: 220 },
      { attack: 66, defense: 66, maxHp: 300 },
    ],
  },

  /* ---------------- coluna 2: os dois que faltavam ---------------- */

  /**
   * ## POR QUE A COLUNA 2 TEM QUATRO E NAO DOIS
   *
   * Porque com dois nos no meio, a arvore obrigava a subir as DUAS raizes
   * do mesmo ramo para sair do meio — nao havia escolha nenhuma entre eles,
   * e a arvore de pontos deixava de ser uma arvore e virava um trilho. Com
   * quatro, o jogador escolhe uma das duas metades e so depende de um par de
   * raizes, o que faz o mesmo numero de pontos chegar em dois caminhos
   * diferentes
   *
   * E o par novo depende cada um de um par de raizes DIFERENTE: quem
   * investiu em ataque e defesa sobe um caminho; quem investiu em recurso e
   * velocidade sobe o outro. Nenhum dos quatro exige os outros dois do
   * meio, entao os caminhos nunca se cruzam
   */
  {
    id: "muralha_ascensor",
    nome: "Muralha do Ascensor",
    coluna: 2,
    exige: ["salao_artes_marcais", "armazem_clan"],
    descricao: "A parede que a clan sustenta",
    icone: "▩",

    /**
     * DEFESA e VIDA, e nao so defesa.
     *
     * E o par de quem escolheu a metade do SCSALO e do ARMAZEM: quem sobe
     * este no esta comprando sobrevivencia, entao o quinto degrau junta os
     * dois. Uma defesa de 34 pontos com vida de 400 daria um tanque que
     * morre em tres golpes — a vida e o que faz a defesa valer
     */
    niveis: [
      { defense: 5, maxHp: 15 },
      { defense: 10, maxHp: 32 },
      { defense: 17, maxHp: 55 },
      { defense: 25, maxHp: 84 },
      { defense: 34, maxHp: 120 },
    ],
  },
  {
    id: "frente_mercante",
    nome: "Frente do Mercante",
    coluna: 2,
    exige: ["cofre_clan", "acumulo_energia"],
    descricao: "A rota que a clan protege",
    icone: "⇢",

    /**
     * RECURSO e REGENERACAO, e nao velocidade.
     *
     * E o par do COFRE e do ACUMULO, e ele e o outro lado do mesmo no de
     * ritmo. Quem sobe este no esta comprando "atirar ate acabar", entao o
     * que falta e bolsa e recarga — e a `attackSpeed` entra so no ultimo
     * degrau, onde o recurso ja dura o bastante para ela valer
     */
    niveis: [
      { resource: 6, resourceRegen: 1 },
      { resource: 12, resourceRegen: 2 },
      { resource: 19, resourceRegen: 4 },
      { resource: 27, resourceRegen: 6 },
      { resource: 36, resourceRegen: 9, attackSpeed: 1 },
    ],
  },

  /* ---------------- coluna 3: os dois do meio ---------------- */

  {
    id: "bastiao_avancado",
    nome: "Bastiao Avancado",
    coluna: 3,

    /**
     * DEPENDE DO PAR DE DEFESA, e nao dos dois do meio.
     *
     * E o topo da metade defensiva: quem subiu MURALHA e DEPOSITO chega
     * aqui. E ele mexe em DEFESA e VIDA juntos, porque no topo o stat
     * sozinho deixa de fazer sentido — um no que so da vida e um no que so
     * da defesa existem la embaixo, na arvore
     */
    exige: ["muralha_ascensor", "rejuvenescimento_guerreiro"],
    descricao: "A trincheira que a clan constroi",
    icone: "⛊",

    niveis: [
      { defense: 14, maxHp: 70 },
      { defense: 30, maxHp: 150 },
      { defense: 52, maxHp: 245 },
      { defense: 79, maxHp: 360 },
      { defense: 111, maxHp: 500 },
    ],
  },
  {
    id: "pavio_de_guerra",
    nome: "Pavio de Guerra",
    coluna: 3,

    /**
     * DEPENDE DO PAR DE RECURSO, e e o topo da metade ofensiva a distancia.
     *
     * E o no de ATK com RECURSO: quem sobe este nao esta comprando sobreviver,
     * esta comprando manter apressao. E a `speed` so no terceiro degrau,
     * porque movimento e a forma mais cara de sumir de um golpe so depois
     * que voce ja tem o recurso para voltar a atacar
     */
    exige: ["frente_mercante", "deposito_comercio"],
    descricao: "A guarnicao que nunca dorme",
    icone: "✧",

    niveis: [
      { attack: 12, resource: 8 },
      { attack: 26, resource: 16 },
      { attack: 45, resource: 27, speed: 3 },
      { attack: 69, resource: 40, speed: 6 },
      { attack: 98, resource: 56, speed: 10 },
    ],
  },

  /* ---------------- coluna 4: o topo novo ---------------- */

  {
    id: "selo_da_clan",
    nome: "Selo da Clan",
    coluna: 4,

    /**
     * O TOPO DE TUDO, e ele exige os DOIS topos do meio.
     *
     * E o no mais caro da arvore inteira e o unico que mexe em seis stats
     * de uma vez. Quem chega ate aqui subiu as quatro raizes, os quatro
     * do meio e um dos dois topos, e e o resumo do caminho
     *
     * E o unico no com `attackSpeed`: a velocidade de ataque nao aparece
     * em mais lugar nenhum da arvore, porque ela e o stat que multiplica
     * TODOS os outros. Em qualquer outro no ela dominaria o no inteiro
     */
    exige: ["bastiao_avancado", "pavio_de_guerra"],
    descricao: "O nome da clan na historia",
    icone: "❈",

    niveis: [
      { attack: 20, defense: 20, maxHp: 80, resource: 10, resourceRegen: 2, attackSpeed: 1 },
      { attack: 44, defense: 44, maxHp: 175, resource: 21, resourceRegen: 4, attackSpeed: 2 },
      { attack: 76, defense: 76, maxHp: 290, resource: 35, resourceRegen: 7, attackSpeed: 3 },
      { attack: 115, defense: 115, maxHp: 430, resource: 52, resourceRegen: 10, attackSpeed: 5 },
      { attack: 161, defense: 161, maxHp: 600, resource: 72, resourceRegen: 14, attackSpeed: 7 },
    ],
  },
]);

/**
 * OS PONTOS DE SUBIR A ARVORE INTEIRA.
 *
 * Doze nos, e a marca do topo de cada um: `40` por no, `480` no total.
 * Nao e um orcamento que o jogador ve — ele nao sabe os numeros, e e
 * esse o ponto. Fica aqui para quem quiser conferir o balanceamento sem
 * abrir a tela
 *
 * ## POR QUE 480 E NAO 280
 *
 * Porque a arvore tinha sete nos e dois no meio, o que obrigava a subir as
 * DUAS raizes do mesmo ramo para sair do meio: nao havia escolha, e a
 * arvore de pontos virava um trilho. Com quatro no meio e dois topos, ha
 * dois caminhos que nao se cruzam, e subir a arvore toda e uma ESCOLHA de
 * caminho — o que e o que faz os 480 pontos valerem as horas que levam
 *
 * E o total de CLIQUES, nao de pontos por hora: com um ponto por clique,
 * subir a arvore toda sao 480 cliques. Com o saldo travado em 24, sao as
 * horas de jogo do grupo — e nao um numero que o jogador possa gastar de
 * uma vez
 */
export const GUILD_TALENT_CUSTO_TOTAL =
  GUILD_TALENTS.length *
  GUILD_TALENT_MARCAS[GUILD_TALENT_MARCAS.length - 1];

/**
 * O NO DE UM ID.
 *
 * Uma lista no lugar de um `Map` porque sao sete: sete nos e uma busca
 * linear e mais rapida que montar o indice, e o `Map` custaria uma
 * linha de estado a mais para nada
 */
export function getTalent(id) {
  return GUILD_TALENTS.find((node) => node.id === id) ?? null;
}

/**
 * OS PONTOS QUE UM NO JA RECEBEU.
 *
 * ## O QUE O MAP GUARDA AGORA
 *
 * O valor e o TOTAL de pontos atribuido ao no, e nao o nivel. Sao duas
 * coisas que antes eram o mesmo numero e hoje nao podem ser:
 *
 *   - o nivel e DERIVADO dos pontos, pelas marcas
 *   - os pontos nao voltam a zero quando o no sobe
 *
 * Guardar so o nivel perderia a barra: com o nivel no `Map`, a porcentagem
 * teria de ser calculada a partir de uma diferenca entre nivel e nivel, e
 * no nivel 0 nao haveria de onde tirar. Guardar so os pontos resolve, e
 * deixa um numero por no em vez de um numero e uma regra
 *
 * Aceita o `Set` do desenho anterior (ids ligados) como 1 ponto, para uma
 * guilda vinda do formato velho nao aparecer com a barra zerada depois de
 * ter comprado algo. `undefined` nos dois formatos e zero
 */
export function talentPontos(talentId, talentos) {
  const bruto = talentos instanceof Map
    ? talentos.get(talentId)
    : talentos?.has?.(talentId)
      ? 1
      : 0;

  return Math.max(0, Number(bruto) || 0);
}

/**
 * EM QUE NIVEL ESTA UM NO.
 *
 * A conta e "quantas marcas ja foram ultrapassadas": com 12 pontos e
 * marcas 4, 10, 18, 28, 40, o no passou duas e esta no Nv. 2
 *
 * O `reduce` conta as marcas e nao faz `Math.floor(pontos / marca)` —
 * dividir pela marca daria nivel 3 para quem tem 12 pontos, porque 12 / 4
 * e 3, e quem tem 12 pontos so passou a marca do Nv. 1 e a do Nv. 2
 */
export function talentNivel(talentId, talentos) {
  const pontos = talentPontos(talentId, talentos);

  let nivel = 0;

  for (const marca of GUILD_TALENT_MARCAS) {
    if (pontos < marca) break;

    nivel += 1;
  }

  return Math.min(nivel, GUILD_TALENT_NIVEL_MAX);
}

/**
 * A MARCA DO PROXIMO NIVEL, ou `null` se o no ja esta no topo.
 *
 * O numero que a tela NAO mostra. A funcao e publica porque o store e o
 * servidor precisam dela — esconder o valor no painel nao e o mesmo que
 * esconder a regra
 */
export function talentMarcaDoProximo(talentId, talentos) {
  const nivel = talentNivel(talentId, talentos);

  if (nivel >= GUILD_TALENT_NIVEL_MAX) return null;

  return GUILD_TALENT_MARCAS[nivel];
}

/**
 * OS PAIS JA SUBIRAM?
 *
 * E o que trava um no do meio enquanto a raiz correspondente estiver no
 * Nv. 0. Um degrau basta: subir a raiz UMA vez ja destrava o acesso ao
 * filho, e o resto do investimento no filho e escolha de quem joga
 */
export function talentPodeSubir(talentId, talentos) {
  const node = getTalent(talentId);

  if (!node) return false;

  return (node.exige ?? []).every(
    (paiId) => talentNivel(paiId, talentos) > 0,
  );
}

/**
 * O no esta no maximo? Nao da para atribuir nem para subir.
 */
export function talentNoMaximo(talentId, talentos) {
  return talentNivel(talentId, talentos) >= GUILD_TALENT_NIVEL_MAX;
}

/**
 * TUDO QUE A TELA PRECISA SABER DE UM NO, num objeto so.
 *
 * ## POR QUE NAO SAI DAQUI O NUMERO DA MARCA
 *
 * Porque o pedido e o numero ficar oculto. Esta funcao e o unico lugar
 * que monta o que viaja no socket, entao e aqui que a marca e
 * deliberadamente omitida: mandar `marca` seria o painel voltar a
 * mostrar, e o `GameClient` guarda o payload inteiro no `amostra`
 *
 * ## A PORCENTAGEM E DO PROPRIO NO
 *
 * E o ponto que estava errado. A conta e `pontos DESTE no / marca do
 * proximo nivel`, e nao `saldo do jogador / custo do degrau`. Com 24
 * pontos no bolso e um degrau de 4, a conta antiga dava 600% — saturado,
 * 100% — nos sete nos ao mesmo tempo, sem nada considerado
 *
 * Agora comeca em 0% e sobe um ponto por clique, que e o que o jogador
 * ve happening
 *
 * E o `100` e o no MAXIMO, com a `marca` em `null`. O painel precisa
 * distinguir "voce chegou" de "falta um clique", e e a unica coisa que
 * os dois se confundem
 */
export function talentProgresso(talentId, talentos, pontos = 0) {
  const node = getTalent(talentId);

  if (!node) return null;

  const doNo = talentPontos(talentId, talentos);

  const nivel = talentNivel(talentId, talentos);

  const marca = talentMarcaDoProximo(talentId, talentos);

  const noMaximo = marca === null;

  /**
   * A PORCENTAGEM sobe por MARCA, e nao por ponto.
   *
   * Comparar `doNo / marca` daria 33% com 1 ponto e 50% com 2, quando o
   * primeiro nivel so chega em 4. A divisao e pelo quanto falta para a
   * marca inteira, que e o que a barra representa de verdade: um no a
   * um ponto do Nv. 1 e um no a um ponto do Nv. 4 estao em posicoes
   * diferentes, e a barra precisa mostrar isso
   */
  const anterior = nivel === 0 ? 0 : GUILD_TALENT_MARCAS[nivel - 1];

  const percentual = noMaximo
    ? 100
    : Math.max(
        0,
        Math.min(
          100,
          Math.floor(((doNo - anterior) / (marca - anterior)) * 100),
        ),
      );

  return {
    id: node.id,
    nome: node.nome,
    icone: node.icone,
    coluna: node.coluna,
    exige: node.exige ?? [],
    descricao: node.descricao,
    nivel,
    nivelMax: GUILD_TALENT_NIVEL_MAX,
    noMaximo,
    percentual,

    /**
     * O QUE O NO JA DA, e o QUE O PROXIMO NIVEL VAI SOMAR.
     *
     * Os dois vao no payload porque nenhum dos dois e o numero secreto:
     * o segredo e a MARCA (quantos pontos faltam para subir), e nao o
     * premio. Um jogador que descobre que o Nv. 3 da +30 ATK e leveling
     *indo e subir o no — o que ele nao pode e escolher o caminho pelo
     * menor numero de clique, e para isso o que some e a marca
     *
     * `bonus` e o TOTAL do nivel alcancado, que e o mesmo numero que o
     * `applyEquipment` vai somar no personagem. `proximo` e o que
     * aquele clique que vai subir o nivel entrega — e e a informacao que
     * decide se vale a pena esperar aquele ponto
     *
     * Os dois vao vazios no Nv. 0, e e honesto: um no que ainda nao
     * subiu nao da nada, e mostrar "+2 ATK" num no em 0% seria uma
     * promessa que o painel de status nao confirmaria
     */
    bonus: bonusDoNo(talentId, talentos, nivel),
    proximo: noMaximo
      ? []
      : bonusDoNo(talentId, talentos, nivel + 1).map((s) => {
          const antes = bonusDoNo(talentId, talentos, nivel);

          const base = antes.find((b) => b.stat === s.stat)?.valor ?? 0;

          return { ...s, valor: s.valor - base };
        }),

    /**
     * O `podeAtribuir` e o estado do TRANCAMENTO, e nao do saldo: e o que
     * responde "falta subir o pai?". O saldo e `temPontos`, que e outra
     * pergunta — o painel precisa das duas separadas, porque o no pode
     * estar destravado e o jogador ainda assim nao ter ponto nenhum (caso
     * em que o botao fica desligado sem o no parecer trancado)
     */
    podeAtribuir: talentPodeSubir(talentId, talentos),
    temPontos: (pontos ?? 0) >= GUILD_TALENT_POR_CLIQUE,
  };
}

/**
 * Os BONUSES somados dos nos que a guilda subiu.
 *
 * A MESMA forma que `mergeBonuses` consome, e por isso que o motor
 * recebe como mais um termo, e nao um `if` so para guilda
 *
 * ## POR QUE Some OS DEGRAUS E NAO MULTIPLICA PELO NIVEL
 *
 * O `Map` guarda os PONTOS de cada no, e o nivel sai das marcas. O bonus
 * e a soma dos degraus ate o nivel alcancado — o mesmo de sempre, e a
 * arvore inteira de bonus continua vindo do catalogo, nunca do disco
 *
 * Nao ha estado aqui: quem guarda quantos pontos cada no recebeu e o
 * store, porque essa lista e por guilda e muda no servidor
 */
export function talentBonuses(talentos) {
  const bonus = {};

  for (const [talentId, pontos] of talentos ?? []) {
    const node = getTalent(talentId);

    if (!node) continue;

    const nivel = talentNivel(talentId, talentos);

    for (const degrau of node.niveis.slice(0, nivel)) {
      for (const [stat, valor] of Object.entries(degrau)) {
        bonus[stat] = (bonus[stat] ?? 0) + valor;
      }
    }
  }

  return bonus;
}


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
  talentNoMaximo: "Esse talento ja esta no nivel maximo.",
  exigePai: "Suba o talento que vem antes primeiro.",

  /**
   * O JOGADOR NAO TEM PONTO NENHUM.
   *
   * A mensagem NAO diz quantos pontos o degrau custa — o numero e
   * segredo, e recusa-lo aqui entregaria pela metade de tras do painel.
   * O jogador ve a porcentagem no no e sabe que precisa esperar; o que
   * ele precisa e a REGRA ("sem pontos"), nao a conta
   *
   * E o texto e curto de proposito: um clique custa 1 ponto, entao
   * "pontos insuficientes" seria a mesma informacao em duas palavras
   */
  pontosInsuficientes: "Voce nao tem ponto para atribuir ainda.",

  /**
   * As recusas do COFRE.
   *
   * Cada uma diz o que fazer, e nao so o que deu errado. "Cofre cheio"
   * sozinho deixa o jogador sem saber se ele precisa tirar algo antes ou
   * se simplesmente nao cabe mais — e a diferenca entre uma acao e um
   * beco sem saida
   */
  cofreInvalido: "O cofre nao aceitou esse pedido.",
  cofreCheio:
    "O cofre esta cheio de itens. Tire alguma coisa antes de guardar mais.",
  cofreSemMoedas: "O cofre nao tem essa quantidade de moedas.",
  cofreSemItem: "O cofre nao tem esse item.",
  mocheiraCheia:
    "Sua mochila esta cheia. Tire alguma coisa antes de retirar.",

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

