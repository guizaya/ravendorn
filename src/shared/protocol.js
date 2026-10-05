/**
 * Contrato entre o cliente e o servidor.
 *
 * Fica em `src/shared` de proposito: e o MESMO arquivo importado
 * pelo cliente e pelo servidor. Se cada lado tivesse a sua copia,
 * qualquer mensagem renomeada em um so lado quebraria em
 * producao, e o teste nao pegaria.
 *
 * O jogo e autoritativo no servidor: o cliente manda INTENCAO
 * ("quero andar para a direita", "quero usar a habilidade 1") e o
 * servidor decide o que acontece. O cliente nunca manda posicao,
 * dano nem loot.
 */

/** o que o cliente pede */
/**
 * QUANTAS PESSOAS CABEM NUMA PARTY.
 *
 * Mora aqui, e nao no `PartyStore`, porque os DOIS lados precisam do
 * numero: o servidor decide quem entra, e a caixa da tela esconde o
 * botao de convidar quando a party chega nele
 *
 * Se o numero so vivesse no servidor, a tela mostraria "convidar" para uma
 * party cheia e o pedido falharia na hora de clicar
 */
export const PARTY_MAX = 3;

export const CLIENT_COMMANDS = Object.freeze({
  JOIN: "JOIN",
  INPUT: "INPUT",
  INPUT: "INPUT",
  ACTION: "ACTION",
  PANEL: "PANEL",
  PING: "PING",
});

/**
 * As operacoes de painel.
 *
 * Um comando so, com um `op` escolhido da lista, em vez de um
 * comando novo para cada coisa. Equipar, usar uma pocao e criar
 * um item sao a mesma familia de pedido: "mexe no MEU estado".
 * Cada operacao e checada aqui, entao o servidor nunca recebe um
 * `op` inventado.
 */
export const PANEL_OPS = Object.freeze({
  EQUIP: "EQUIP",
  UNEQUIP: "UNEQUIP",
  DISCARD: "DISCARD",
  AUTO_EQUIP: "AUTO_EQUIP",
  CRAFT: "CRAFT",
  SET_LOOT_FILTER: "SET_LOOT_FILTER",
  PRUNE_INVENTORY: "PRUNE_INVENTORY",

  // Abrir o inventario tira do corpo a peca que esta no slot errado.
  // E um pedido, e nao uma correcao do cliente: o equipamento mora no
  // servidor, e um save antigo pode ter o capuz no peito gravado
  FIX_MISPLACED_EQUIPMENT: "FIX_MISPLACED_EQUIPMENT",
  TOGGLE_AUTO_PLAY: "TOGGLE_AUTO_PLAY",
  TOGGLE_QUEST_AUTO: "TOGGLE_QUEST_AUTO",
  FOCUS_QUEST: "FOCUS_QUEST",

  // A missao SECUNDARIA tinha que passar pelo mesmo caminho. Antes
  // o botao "aceitar" chamava o motor da tela, que online nao tem
  // sessao: o clique morria e a missao nunca chegava no servidor,
  // entao a caixa nao mostrava nada depois do aceite
  ACCEPT_SIDE_QUEST: "ACCEPT_SIDE_QUEST",
  ABANDON_SIDE_QUEST: "ABANDON_SIDE_QUEST",

  /**
   * O resgate da recompensa de uma missao concluida.
   *
   * Pelo mesmo caminho do aceite: o botao [RECEBER] e um ato do
   * cliente, e quem tem o gold, o xp e os itens e o servidor. Chamar
   * o motor da tela nao valeria online, porque o cliente nao tem
   * sessao nem simula
   *
   * O `questId` e dado nao confiavel como todo `questId` daqui: o
   * servidor procura a recompensa na fila pelo id e, se ela nao
   * estiver la, nao paga nada. E como a fila perde a linha no
   * resgate, o segundo clique do mesmo botao nao paga de novo
   */
  CLAIM_QUEST_REWARD: "CLAIM_QUEST_REWARD",

  // O "ir matar" do bestiario tinha o mesmo furo: o botao chamava
  // o motor da tela e o servidor nunca recebia a cacada. E um pedido
  // dedicado a UMA criatura, entao e op proprio e nao o
  // TOGGLE_AUTO_PLAY
  SET_BESTIARY_AUTO: "SET_BESTIARY_AUTO",
  CLEAR_BESTIARY_AUTO: "CLEAR_BESTIARY_AUTO",

  /**
   * A PARTY.
   *
   * As quatro operacoes sao de painel como as outras: um `op` so, e o
   * servidor valida tudo. O cliente nunca decide a composicao da party —
   * ele so pede, e quem monta o grupo e o dono
   */
  PARTY_INVITE: "PARTY_INVITE",
  PARTY_CREATE: "PARTY_CREATE",
  PARTY_INVITE_BY_NAME: "PARTY_INVITE_BY_NAME",
  PARTY_ACCEPT_INVITE: "PARTY_ACCEPT_INVITE",
  PARTY_KICK: "PARTY_KICK",
  PARTY_FOLLOW: "PARTY_FOLLOW",
  PARTY_FOCUS: "PARTY_FOCUS",
  PARTY_TRANSFER: "PARTY_TRANSFER",
  PARTY_LEAVE: "PARTY_LEAVE",

  /**
   * O `RESET_TARGETS` foi embora junto com o atalho.
   *
   * Ele ressuscitava os bonecos de treinamento e vinha no `Backspace` —
   * uma tecla que o jogador precisa para APAGAR um caractere do campo
   * onde esta digitando. Um atalho de jogo em cima do `Backspace` e um
   * atalho em cima de qualquer tecla de texto, e nao valia o preco
   */
  SET_SKILL_AUTO: "SET_SKILL_AUTO",

  /**
   * Atravessar um portal.
   *
   * O cliente manda o `id` do portal, e nao o mapa de destino: o
   * servidor descobre o destino pelo proprio portal e, antes disso,
   * confere que o jogador esta EM CIMA dele. Aceitar um mapa vindo do
   * cliente deixaria qualquer um teletransportar para onde quisesse
   */
  TRAVESSAR_PORTAL: "TRAVESSAR_PORTAL",

  /* ------------------------------------------------------------------
     GUILDA
     ------------------------------------------------------------------
     Todas entram pelo mesmo caminho do resto: o cliente pede, o
     servidor decide. Nenhuma delas confia no que o cliente diz sobre
     guilda — nem nome, nem papel, nem pontos. O `nome` e o `id` do
     jogador sao lidos do servidor, e o papel sai de quem mandou
     ------------------------------------------------------------------ */

  GUILD_CRIAR: "GUILD_CRIAR",
  GUILD_BUSCAR: "GUILD_BUSCAR",
  GUILD_PEDIR: "GUILD_PEDIR",
  GUILD_ACEITAR: "GUILD_ACEITAR",
  GUILD_NEGAR: "GUILD_NEGAR",
  GUILD_SAIR: "GUILD_SAIR",
  GUILD_TALENTO: "GUILD_TALENTO",
  GUILD_LIDERANCA: "GUILD_LIDERANCA",
GUILD_COFRE: "GUILD_COFRE",

  /**
   * O MARKET entre jogadores.
   *
   * Sao tres operacoes porque sao tres poderes diferentes sobre o

   * estado de outra pessoa. `LIST` tira um item do vendedor, `BUY`
   * tira dinheiro do comprador e da o item a ele, e `CANCEL` devolve
   * o item ao vendedor
   *
   * A transferencia de item e moeda e a operacao mais destrutiva que
   * um cliente pode pedir neste jogo: na colecao o cliente entrega
   * coisa DELE e ganha de volta, aqui ele tira coisa DE OUTRO. Por
   * isso o servidor nao confia em nada do pedido — nem no `uid`, nem
   * no `price`, nem na quantidade — e decide tudo contra o
   * inventario dele
   */
  MARKET_LIST: "MARKET_LIST",
  MARKET_BUY: "MARKET_BUY",
  MARKET_CANCEL: "MARKET_CANCEL",

  // A ENTREGA de uma colecao. Pelo mesmo motivo do "ir matar" do
  // bestiario: o botao "Entregar" precisa chegar no servidor, e sem
  // esta op ele chamaria o motor da tela, que online nao tem sessao —
  // o clique consumiria material na tela e o servidor nunca saberia
  //
  // E a acao mais destrutiva do jogo pelo caminho do cliente: tira
  // item do inventario do jogador. Por isso o servidor NUNCA confia no
  // que o cliente diz que tem; ele confere contra o proprio
  // inventario, que e a unica copia que conta
  DELIVER_COLLECTION: "DELIVER_COLLECTION",

  /**
   * Encantar uma peca da mochila.
   *
   * E o unico `op` que ROLAGOA em vez de mandar o resultado: o
   * jogador nao escolhe o stat nem a raridade, ele paga e o afixo sai.
   *
   * O `uid` vai no pedido e o afixo volta na resposta, no proximo
   * `SNAPSHOT`. A UI nunca sorteia: ela mostraria um afixo que o
   * servidor nao aceitou, e o jogador veria o numero mudando quando o
   * pacote chegasse
   */
ENCHANT: "ENCHANT",

  /**
   * BEBER um consumivel da mochila.
   *
   * Pelo mesmo caminho do `ENCHANT` e pelo mesmo motivo: o botao "usar"
   * e um ato do cliente, e quem tem a vida e o item e o servidor. Chamar
   * o motor da tela curaria em um jogador local e o servidor nunca
   * saberia — em rede o jogador veria o `+120` na tela, a barra dele
   * nao mexeria, e a pocao nao sairia da mochila
   *
   * O servidor e quem recusa o uso com a vida cheia, e nao o cliente.
   * Confiar nisso no cliente daria um item que se perde sem curar
   */
  USE_ITEM: "USE_ITEM",

  /**
   * COMPRAR na loja de pocoes do mercador.
   *
   * Differe do `MARKET_BUY` em uma coisa que importa: aqui o dinheiro
   * vai para o jogo e o item vem do CATALOGO da loja. No mercado entre
   * jogadores o preco vem de quem vendeu. Nos dois casos o servidor
   * ignora o preco do pedido e resolve contra o catalogo dele, porque o
   * cliente nao pode escolher quanto paga
   */
  BUY_POTION: "BUY_POTION",
});


/**
 * As DUAS acoes do cofre da guilda.
 *
 * Lista fechada e nao texto livre, porque o cofre guarda item e
 * dinheiro de verdade. Um `op` solto ali seria um caminho para mexer
 * em coisa que o jogador nao pediu
 */
export const GUILD_COFRE_ACOES = Object.freeze([
  "depositar",
  "retirar",
]);

/** o que o servidor responde */
export const SERVER_EVENTS = Object.freeze({
  WELCOME: "WELCOME",

  // O MUNDO: jogadores, inimigos e drops. Vai para todo mundo,
  // porque e o mesmo para todos.
  SNAPSHOT: "SNAPSHOT",

  // O SEU painel: inventario, equipamento, missoes, bestiario,
  // craft e os numeros do seu personagem. Vai SO para o dono,
  // porque e o estado privado dele: mandar o inventario dos
  // outros para todo mundo seria um vazamento de informacao.
  PLAYER_STATE: "PLAYER_STATE",
  REJECTED: "REJECTED",
  PLAYER_JOINED: "PLAYER_JOINED",
  PLAYER_LEFT: "PLAYER_LEFT",
  LOOT: "LOOT",
  PONG: "PONG",

  /**
   * A PARTY.
   *
   * Sao tres eventos e nao um so, porque o CONVITE tem dono diferente
   * da party: ele chega so para quem foi convidado, e some em 5 segundos
   * sem nenhum pacote de "expirou" — o cliente conta o tempo e descarta
   */
  PARTY_STATE: "PARTY_STATE",
  PARTY_INVITE_RECEIVED: "PARTY_INVITE_RECEIVED",
  PARTY_INVITE_CLOSED: "PARTY_INVITE_CLOSED",

  /**
   * UM GOLPE RESOLVIDO, para o numero que sobe na tela.
   *
   * O `SNAPSHOT` nao serve para isto, e por dois motivos. Primeiro,
   * ele vai para todo mundo a 20 Hz: um numero de dano e um instante,
   * e mandar o mesmo golpe para dez pessoas enche a tela delas de
   * numero de dano dos outros. Segundo, e o INSTANTE que importa — o
   * snapshot chega ate 50ms depois, e o efeito flutuante precisa nascer
   * junto com o golpe, nao quando o pacote passar
   *
   * Vai SO para o atacante e para a vitima. O jogador ve o numero dos
   * proprios golpes e o dano que ele proprio levou, e nao o dos outros:
   * o numero de dano alheio polui a tela sem informar nada
   */
  DAMAGE: "DAMAGE",
});

import { PRECO_MINIMO } from "../data/market/index.js";

export const PROTOCOL_VERSION = 1;

/** acoes que o cliente pode pedir */
export const PLAYER_ACTIONS = Object.freeze({
  BASIC_ATTACK: "BASIC_ATTACK",
  SKILL: "SKILL",
  ULTIMATE: "ULTIMATE",
  TARGET: "TARGET",
});

/** quanto o servidor simula por segundo */
export const TICK_RATE = 20;

/** com quantos hz o cliente pode mandar input */
export const INPUT_RATE = 30;

/**
 * Teto de mensagens por segundo, por cliente.
 *
 * Sem isso um cliente malicioso (ou com bug em laco) manda
 * milhares de comandos por segundo e o servidor gasta cpu com
 * input descartado, tirando o jogo de quem esta jogando direito.
 * O excedente e ignorado, nao acumulado.
 */
export const MAX_MESSAGES_PER_SECOND = 90;

/** o mesmo limite para acoes, que sao mais caras que o input */
export const MAX_ACTIONS_PER_SECOND = 20;

/** maior movimento aceito por segundo, em unidades de mundo */
export const MAX_MOVE_SPEED = 900;

/** o quanto o cliente pode rodar sem mandar snapshot */
export const MAX_SNAPSHOT_BYTES = 220_000;

/** motivo da recusa, em portugues, pronto para o toast */
export const REJECT = Object.freeze({
  BAD_MESSAGE: "Mensagem invalida.",
  BAD_VERSION: "Versao de protocolo diferente.",
  NO_NAME: "Escreva um nome para entrar.",
  NAME_TAKEN: "Esse nome ja esta no jogo.",
  UNKNOWN_CLASS: "Classe desconhecida.",
  ALREADY_JOINED: "Voce ja entrou nesta partida.",
  RATE_LIMIT: "Voce esta mandando comandos demais.",
  PLAYER_FULL: "O mundo esta cheio.",

  /**
   * O golpe na base.
   *
   * A base e o hub: nao ha inimigo nela, e o basico nao tem alvo
   * legitimo — mas a animacao do golpe saia mesmo assim, e o jogador
   * via uma espada varrer o chao vazio sem causar nenhum dano. A
   * recusa explica o silencio em vez de deixar o clique sem resposta
   */
  NO_COMBAT_IN_BASE: "Nao da para atacar na base.",

  // mandou INPUT ou ACTION sem ter mandado JOIN antes. Sem o
  // JOIN o pacote entraria sem dono e o loot do abate iria para
  // `null`, o que e pior do que recusar
  NOT_JOINED: "Entre no mundo antes de jogar.",

  // o nome passou no cliente e nao passou no servidor. O cliente
  // nao e autoridade: um script ignora o formulario
  BAD_NAME: "Esse nome nao e valido.",

  // O nome ja tem personagem guardado, mas de outra classe. A
  // classe e parte da identidade do personagem: aceitar a nova
  // classe gravaria por cima do progresso antigo e o jogador
  // perderia nivel, ouro e missoes sem ter pedido nada
  CHARACTER_CLASS_MISMATCH:
    "Esse nome ja tem um personagem de outra classe.",
});

/** monta um comando do cliente */
export function createCommand(type, payload = {}) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type,
    payload,
    timestamp: Date.now(),
  };
}

/** monta um evento do servidor */
export function createEvent(type, payload = {}) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type,
    payload,
    timestamp: Date.now(),
  };
}

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

/** uma string curta e sem caractere de controle */
const isShortString = (value, max) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= max &&
  // um \u0000 no nome quebraria o log do servidor e poderia
  // forjar uma linha de log falsa
  !/[\u0000-\u001f\u007f]/.test(value);

/**
 * As raridades que o pedido de craft pode citar.
 *
 * A lista fica AQUI, e nao importada de `data/items`, porque este
 * arquivo e o contrato entre as pontas e nao deve depender dos dados
 * do jogo para validar mensagem. Sao as mesmas de `RARITY_ORDER`, e o
 * teste de craft afirma que as duas nao se separaram.
 *
 * Exportada para esse teste. Nao ha outro uso dela fora daqui.
 */
export const CRAFT_RARIDADES = new Set([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
]);

/**
 * O teto do preco no protocolo.
 *
 * Este e o MESMO numero do `PRECO_MAXIMO` do market
 * (`data/market/index.js`), e nao um numero parecido.
 *
 * Quando os dois divergiam, um preco de 2.000.000 era cortado aqui
 * para 1.000.000 e chegava ao servidor como um preco VALIDO de um
 * milhao. O jogador tinha digitado um numero recusado e o sistema tinha
 * anunciado assim mesmo, em silencio — o pior resultado possivel para
 * quem escreve o preco
 *
 * Com o mesmo numero, o transporte recusa e a regra do jogo nunca ve o
 * valor. O teste do servidor cobre esse caminho
 */
export const MARKET_PRECO_MAX = 1_000_000;

/**
 * O maior lote que um anuncio pode ter.
 *
 * O `maxStack` do catalogo e 99, entao 99 e o maior lote que existe
 * numa mochila: acima disso o pedido esta pedindo algo que o jogador
 * nao tem, e o servidor teria de cortar a diferenca sem o jogador
 * saber
 */
export const MARKET_QUANTIDADE_MAX = 99;

/**
 * Valida e normaliza um comando vindo da rede.
 *
 * Devolve `{ ok, type, payload }` ou `{ ok: false, reason }`.
 * Tudo que vem da rede e tratado como nao confiavel: um cliente
 * pode mandar qualquer coisa, e o servidor nao deve deixar um
 * `NaN` chegar na simulacao (um `moveX` invalido viraria
 * posicao `NaN` e o jogador sumiria do mapa para todo mundo).
 */
export function parseCommand(raw) {
  if (!isObject(raw)) {
    return { ok: false, reason: REJECT.BAD_MESSAGE };
  }

  if (raw.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, reason: REJECT.BAD_VERSION };
  }

  const { type, payload } = raw;

  if (!isObject(payload)) {
    return { ok: false, reason: REJECT.BAD_MESSAGE };
  }

  switch (type) {
    case CLIENT_COMMANDS.JOIN:
      return parseJoin(payload);

    case CLIENT_COMMANDS.INPUT:
      return parseInput(payload);

    case CLIENT_COMMANDS.ACTION:
      return parseAction(payload);

    case CLIENT_COMMANDS.PANEL:
      return parsePanel(payload);

    case CLIENT_COMMANDS.PING:
      return { ok: true, type, payload: {} };

    default:
      return { ok: false, reason: REJECT.BAD_MESSAGE };
  }
}

function parseJoin(payload) {
  const { name, classId } = payload;

  if (!isShortString(name, 32) || !isShortString(classId, 32)) {
    return { ok: false, reason: REJECT.BAD_MESSAGE };
  }

  return {
    ok: true,
    type: CLIENT_COMMANDS.JOIN,
    payload: { name, classId },
  };
}

function parseInput(payload) {
  const { seq, moveX, moveY, aimX, aimY } = payload;

  if (!isFiniteNumber(seq)) {
    return { ok: false, reason: REJECT.BAD_MESSAGE };
  }

  // direcao e um VETOR normalizado: o cliente manda a intencao,
  // nao a velocidade. o servidor limita e normaliza, assim um
  // cliente nao ganha velocidade mandando 50
  const move = normalize(moveX, moveY);
  const aim = normalize(aimX, aimY);

  return {
    ok: true,
    type: CLIENT_COMMANDS.INPUT,
    payload: {
      seq: Math.floor(seq),
      moveX: move.x,
      moveY: move.y,
      aimX: aim.x,
      aimY: aim.y,
    },
  };
}

/**
 * Reduz um pedido de painel a um formato seguro.
 *
 * O que entra e apenas o que o SERVIDOR precisa para executar: qual
 * operacao, e o id do item. O cliente nao pode mandar
 * "coins: 99999" nem "level: 50", porque o parser joga fora tudo
 * que nao foi pedido aqui. Sem isso, editar o cliente daria ouro,
 * nivel e missao concluida de graca.
 */
function parsePanel(payload) {
  const {
    op,
    uid,
    slotId,
    recipeId,
    rarity,
    filter,
    skillId,
    ativo,
    questId,
    creatureId,
collectionId,
    listingId,
    portalId,
    guildName,
    guildTag,
    guildId,
    alvoId,
    talentId,
cofreAcao,
      itemId,
      price,
      count,
    } = payload;


  if (!Object.values(PANEL_OPS).includes(op)) {
    return { ok: false, reason: REJECT.BAD_MESSAGE };
  }

  return {
    ok: true,
    type: CLIENT_COMMANDS.PANEL,
    payload: {
      op,

      // o uid do item e uma referencia interna do servidor.
      // valida o formato para nao entrar um array gigante
      // disfarçado de id
      uid: isShortString(uid, 64) ? uid : null,
      slotId: isShortString(slotId, 32) ? slotId : null,
      recipeId: isShortString(recipeId, 96) ? recipeId : null,

      /**
       * A raridade escolhida no painel de craft.
       *
       * Este campo nao da item raro de graca: o servidor recebe o
       * PEDIDO de raridade e o `Craft` confere se a receita TEM
       * variante naquela raridade, e cobra os ingredientes e as
       * moedas que AQUELA raridade custa. Pedir `legendary` numa
       * receita que so faz `common` volta com falha, e nao com um
       * item raro.
       *
       * O que nao pode e o cliente escrever qualquer texto aqui: a
       * lista e a mesma de `RARITY_ORDER`, e o que nao estiver
       * nela vira `null`, que e a raridade natural da receita.
       */
      rarity: CRAFT_RARIDADES.has(rarity) ? rarity : null,

      // o filtro de loot e um objeto de booleanos. chaves
      // desconhecidas sao descartadas pelo servidor ao aplicar
      filter:
        filter &&
        typeof filter === "object" &&
        !Array.isArray(filter)
          ? filter
          : null,

      skillId: isShortString(skillId, 64) ? skillId : null,
      ativo: typeof ativo === "boolean" ? ativo : null,

      /**
       * O INTERRUPTOR DO FOCO DO LIDER, ligado ou desligado.
       *
       * E o `ativo` de novo, e nao um `ligado` novo: o `parsePanel`
       * reconstroi o payload com uma lista fixa de campos, e um campo
       * que nao estivesse nela chegaria ao servidor como `undefined` —
       * o botao pareceria funcionar e o estado nunca mudaria
       *
       * O nome e `ativo` porque e o mesmo formato de pedido: um estado
       * pedido, e nao um "inverter". Com "inverter", dois cliques rapidos
       * voltariam ao comeco
       */

      // o id da missao vem do cliente, entao e dado nao confiavel
      // como o resto. o servidor procura a missao pelo id e, se nao
      // existir, nao liga o piloto: um id inventado nao pode mandar
      // o personagem andar para lugar nenhum
      questId: isShortString(questId, 64) ? questId : null,

      // o mesmo cuidado para a criatura do bestiario. o
      // `setBestiaryAuto` procura a entrada pelo id e devolve false
      // se nao existir, entao um id forjado nao comeca nenhuma
      // cacada
      creatureId: isShortString(creatureId, 64) ? creatureId : null,

      // O id da colecao, pelo mesmo motivo do `questId` e do
      // `creatureId`: vem do cliente e nao e confiavel. O servidor
      // procura a colecao pelo id e a recusa se nao existir
      collectionId: isShortString(collectionId, 64)
        ? collectionId
        : null,

      // o id do anuncio. Vem do cliente e NAO e confiavel: o servidor
      // procura o anuncio pelo id e a recusa se nao existir, entao um
      // id forjado nao compra o item de ninguem
      listingId: isShortString(listingId, 64)
        ? listingId
        : null,

      /**
       * O portal a atravessar.
       *
       * Mesmo tratamento do `listingId`: vem do cliente e nao e
       * confiavel. O servidor procura o portal pelo id no mapa em que o
       * jogador esta, e recusa se nao achar — ou se o jogador nao
       * estiver em cima dele
       */
      portalId: isShortString(portalId, 32)
        ? portalId
        : null,

      /**
       * A GUILDA, em tudo que o pedido dela carrega.
       *
       * Tudo entra como texto curto ou `null`, e o servidor valida o
       * que importa. O `guildaId` e o id interno: um jogador podendo
       * mandar o id de qualquer guilda e normal, ele so entra se a diretoria
       * aceitar
       *
       * O `guildaNome` e o `guildaTag` sao o que o jogador DIGITA, e o
       * servidor normaliza e checa de novo. Aceitar o texto como veio
       * faria "Lobos" e "lobos" serem duas guildas
       */
      guildId: isShortString(guildId, 40) ? guildId : null,
      guildName: isShortString(guildName, 64) ? guildName : null,
      guildTag: isShortString(guildTag, 16) ? guildTag : null,

      /** o membro alvo: quem vai ser aceito, negado ou promovido */
      alvoId: isShortString(alvoId, 64) ? alvoId : null,

      talentId: isShortString(talentId, 32) ? talentId : null,

      /**
       * A acao no cofre: "depositar" ou "retirar".
       *
       * Lista explicita de duas opcoes, e nao texto livre: o cofre
       * guarda item e dinheiro de verdade, e um `op` solto ali seria um
       * caminho para mexer em coisa que o jogador nao pediu
       */
      cofreAcao: GUILD_COFRE_ACOES.includes(cofreAcao)
        ? cofreAcao
        : null,

      /**
       * A QUANTIDADE anunciada, e so para o que empilha.
       *
       * `null` e o pedido padrao, que o servidor traduz em "a pilha
       * inteira". Um numero recusado aqui vira `null` em vez de virar
       * 1: um `Math.max(1, ...)` transformaria um pedido quebrado num
       * anuncio de uma unidade sem o jogador ter pedido isso
       *
       * O teto e o `maxStack` do catalogo (99), e nao um numero
       * arbitrario: e o maior lote que o jogo inteiro consegue ter
       * numa mochila, entao aceitar mais so significaria tirar do ar
       * uma quantidade que nao existe
       */
      count:
        isFiniteNumber(count) &&
        Math.floor(count) >= 1 &&
        Math.floor(count) <= MARKET_QUANTIDADE_MAX
          ? Math.floor(count)
          : null,

      /**
       * O PRECO pedido pelo vendedor.
       *
       * Este e o primeiro numero que entra por `parsePanel`, e ele
       * precisa de `isFiniteNumber` + teto. Um `price` que passasse
       * cru seria um preco negativo — o `spendCoins` do comprador
       * receberia moedas — ou um `Infinity` que zeraria o saldo
       * inteiro do servidor
       *
       * O PISO e aplicado aqui, e nao so no market: um preco de 1 que
       * passasse chegaria ao servidor e a regra do jogo recusaria —
       * mas o `takeUid` do vendedor ja teria rodado antes da checagem.
       * Recusar no transporte evita tocar na mochila dele
       *
       * O piso REJEITA e nao eleva. Um `Math.max(PRECO_MINIMO, ...)`
       * transformaria um pedido de -5000 num anuncio de 5 moedas: o
       * jogador escreveu um numero recusado e o sistema anunciaria assim
       * mesmo, em silencio. O teto e o oposto e e cortado, porque um
       * preco de 2.000.000 recusado como `null` e um preco de 999.999
       * aceito, e nenhum dos dois mente
       *
       * O teto e `MARKET_PRECO_MAX`, que e o mesmo do `PRECO_MAXIMO`
       * do market: acima dele o valor vira `null`, e o servidor nunca
       * ve um preco que a regra recusaria
       */
      price:
        isFiniteNumber(price) &&
        Math.floor(price) >= PRECO_MINIMO &&
        Math.floor(price) <= MARKET_PRECO_MAX
          ? Math.floor(price)
          : null,

      /**
       * O ITEM que o jogador esta comprando na loja do NPC.
       *
       * Vem do cliente e nao e confiavel, como todo id: o servidor
       * procura no catalogo da loja e recusa o que nao esta a venda.
       * Se o servidor confiasse, bastaria mandar um id de item
       * qualquer e receber o preco de `null`
       */
      itemId: isShortString(itemId, 64) ? itemId : null,
    },
  };
}

function parseAction(payload) {
  const { action, targetId, aimX, aimY, slot } = payload;

  const known = Object.values(PLAYER_ACTIONS);

  if (!known.includes(action)) {
    return { ok: false, reason: REJECT.BAD_MESSAGE };
  }

  // o alvo e um id de mob do servidor. um id invalido nao pode
  // derrubar a conexao: o jogador pode ter clicado num mob que
  // morreu no instante do pacote
  const alvo =
    isShortString(targetId, 64) ? targetId : null;

  const aim = normalize(aimX, aimY);

  // qual habilidade. `SKILL` sem slot nao diz nada: as tres
  // habilidades da classe sao diferentes, e o servidor precisa
  // saber qual foi pedida. fora da faixa vira 0 e o servidor
  // ignora, em vez de aceitar um slot 999 e quebrar
  const bruto = isFiniteNumber(slot) ? Math.floor(slot) : 0;

  return {
    ok: true,
    type: CLIENT_COMMANDS.ACTION,
    payload: {
      action,
      targetId: alvo,
      aimX: aim.x,
      aimY: aim.y,
      slot: bruto >= 1 && bruto <= 9 ? bruto : 0,
    },
  };
}

/**
 * Reduz um par para um VETOR de direcao.
 *
 * O comprimento e cortado em 1: segurar duas teclas nao anda
 * mais rapido, e um valor enorme (ou infinito) viraria
 * velocidade absurda.
 */
function normalize(x, y) {
  const nx = isFiniteNumber(x) ? x : 0;
  const ny = isFiniteNumber(y) ? y : 0;

  const tamanho = Math.hypot(nx, ny);

  if (tamanho <= 1) {
    return { x: nx, y: ny };
  }

  return { x: nx / tamanho, y: ny / tamanho };
}

/**
 * Conta quantas mensagens o cliente mandou na janela deslizante.
 *
 * Guarda so os instantes, e a janela anda. Um cliente que manda
 * em rajada e barrado sem derrubar os outros jogadores: o
 * excesso e simplesmente ignorado.
 */
export class RateLimiter {
  constructor(
    maxPerSecond = MAX_MESSAGES_PER_SECOND,
    janelaMs = 1000,
  ) {
    this.max = maxPerSecond;
    this.janelaMs = janelaMs;
    this.marcos = [];
  }

  /** `true` quando pode passar */
  permite() {
    const agora = Date.now();
    const corte = agora - this.janelaMs;

    while (this.marcos.length && this.marcos[0] < corte) {
      this.marcos.shift();
    }

    if (this.marcos.length >= this.max) {
      return false;
    }

    this.marcos.push(agora);
    return true;
  }

  reset() {
    this.marcos.length = 0;
  }
}
