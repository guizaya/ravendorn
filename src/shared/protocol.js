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

  /**
   * A CONFIGURACAO DO USO AUTOMATICO DA POCAO.
   *
   * E UM pedido so para as tres coisas — liga/desliga, limiar e qual pocao
   * — pelo mesmo motivo do `setSkillAuto` la do motor: elas nao sao
   * independentes. Trocar a pocao com o automatico ligado desliga o
   * automatico, e um protocolo com tres acoes permitiria a segunda
   * metade dessa regra chegar sem a primeira
   *
   * O `itemId` ausente e "tirar a pocao do slot", e nao "nao mexer": sao
   * tres estados num campo, e sem o `undefined` o painel nunca esvaziaria
   * o slot
   */
  SET_AUTO_POTION: "SET_AUTO_POTION",

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

  /**
   * O RESGATE DE UM DIA DO PASSE.
   *
   * Pelo mesmo caminho do `CLAIM_QUEST_REWARD`: e o jogador apertando um
   * botao, e quem tem a mochila e o estado do resgate e o servidor.
   *
   * O pedido leva SO `passId` e `dia`. Nada do premio viaja: um cliente que
   * mandasse `itemId` e `quantidade` seria ignorado, porque o servidor le
   * o item do catalogo pelo par `passId`/`dia` e paga o que esta la
   *
   * E o par que impede o resgate duplo: o servidor confere se o dia ja
   * saiu da lista antes de pagar, entao repetir o pedido nao paga de novo
   */
  CLAIM_PASS_REWARD: "CLAIM_PASS_REWARD",

  /**
   * O INTERRUPTOR DO PASSE PREMIUM.
   *
   * ## POR QUE ISSO E UMA MENSAGEM E NAO UM RESGATE
   *
   * Porque o premium nao paga nada: ele muda QUEM pode resgatar. Sem ele no
   * servidor, o dia premium ficaria `premium` no painel e o resgate recusaria
   * o clique — o botao morreria na mao do jogador. Com ele, o servidor e o
   * painel leem o mesmo interruptor
   *
   * ## E POR QUE NAO COMPRA NADA
   *
   * Porque nao ha loja de passe. O interruptor existe para o jogador ver o
   * que muda, e agora tambem para destravar os dias premium de verdade. Um
   * dia em que existir a compra, este op vira parte do pagamento e nao
   * continua sendo um interruptor
   */
  SET_PASS_PREMIUM: "SET_PASS_PREMIUM",

  /**
   * MUDA O EMBLEMA e A COR DA GUILDA.
   *
   * Leva o par `icone`/`cor`, e os dois sao IDs do catalogo — nunca o glifo
   * nem o hex. Mandar o hex abriria porta para um cliente modificado gravar
   * uma cor qualquer no arquivo de guildas, e o motor pinta esse hex
   * direto no canvas
   */
  SET_GUILD_STYLE: "SET_GUILD_STYLE",

  /**
   * LIGA OU DESLIGA a tag da guilda sobre o boneco do jogador.
   *
   * Leva o valor novo e nao um "inverter", pelo mesmo motivo do
   * `SET_PASS_PREMIUM`: dois cliques rapidos chegam em qualquer ordem
   */
  SET_SHOW_TAG: "SET_SHOW_TAG",

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

  /**
   * A ARENA DO CHEFE: um botao que entra e sai.
   *
   * E o unico `op` de viagem que nao passa por portal, e por isso ele nao
   * recebe o id de destino: o servidor sabe que a arena e `boss_1` e sabe
   * de onde o jogador veio. Aceitar um mapa vindo do cliente daria a
   * qualquer um um teletransporte para onde quisesse — o mesmo motivo que
   * o `TRAVESSAR_PORTAL` acima nao aceita destino
   *
   * O segundo clique no botao e o mesmo `op`: quem decide o sentido e o
   * mapa em que o jogador esta, e nao o botao. Um `op` para entrar e
   * outro para sair permitiria que o cliente ficasse travado na arena se
   * um dos dois se perdesse
   */
  IR_PARA_ARENA: "IR_PARA_ARENA",

  /* ------------------------------------------------------------------
     MAPA DE TESTE
     ------------------------------------------------------------------
     O MESMO MOLDE DO `IR_PARA_ARENA`, e pelos mesmos dois motivos: o
     pedido nao recebe mapa de destino, e o segundo clique e o mesmo op

     Sem destino porque o servidor sabe que o mapa de teste e `mapa_teste`
     e sabe de onde o jogador veio. Aceitar um id vindo do cliente daria
     a qualquer um um teletransporte para onde quisesse

     O mesmo op nos dois sentidos porque quem decide o sentido e o mapa em
     que o jogador esta. Dois ops — um para entrar, um para sair —
     permitiriam que o cliente ficasse preso no mapa de teste se um dos
     dois se perdesse, e o jogador nao teria botao para sair
  */

    IR_PARA_TESTE: "IR_PARA_TESTE",

    /* ------------------------------------------------------------------
       MINERACAO DE STEEL
       ------------------------------------------------------------------
       A op e uma so, e o servidor decide o sentido pelo estado da
       sessao: se o jogador ja esta encostado em uma pedra, o pedido
       significa PARAR; se nao esta, significa ENCOSTAR na pedra do
       `propId` que veio

       Sao dois ops separados porque o `propId` so existe no sentido de
       parar, e um pedido de parar sem `propId` nao tem como dizer qual
       pedra o jogador pensou. Com um op so, o servidor teria de adivinhar
       qual era
       ------------------------------------------------------------------ */

    MINERAR: "MINERAR",

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
   * O BAU DA BASE: depositar e retirar.
   *
   * ## POR QUE UMA OP SO, E NAO DUAS
   *
   * Porque as duas acoes tem EXATAMENTE o mesmo formato — `uid` e `count`
   * de uma pilha — e so mudam para onde o item vai. E o mesmo motivo do
   * `GUILD_COFRE`: um `switch` com dois braços que so trocam o destino do
   * item e um mapa de duas entradas que existe so para caber no `switch`
   *
   * E o que muda a coisa nao e o formato do pedido, e que o item pode ser
   * DEVOLVIDO no caminho errado: um deposito que lota o destino tem que
   * devolver a peca para a mochila. As duas metades ficam no servidor, em
   * `GameServer.mexerNoBau`, pelo mesmo motivo do cofre
   *
   * O bau e POR PERSONAGEM, e nao compartilhado como o cofre de guilda.
   * Por isso ele mora no save do personagem e nao em um store do
   * servidor — nao ha nada de global para serializar
   */
  BAU: "BAU",

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
   * APRIMORAR a peca vestida de um slot.
   *
   * Mora ao lado do `ENCHANT` porque mora na mesma aba do painel, mas e
   * outra coisa: o `ENCHANT` SORTEIA um afixo e nao pode falhar no
   * resultado, enquanto este AUMENTA o valor dos stats que a peca ja tem
   *
   * Nao sorteia nada, e por isso nao devolve afixo no snapshot — o
   * `enhance` da peca ja la estava e o servidor so soma um. Sem sorteio,
   * `slotId` sozinho identifica tudo: peca da mochila nao e aprimoravel,
   * porque o `enhance` mora no SLOT e e o slot que o `bonuses` le
   */
ENHANCE: "ENHANCE",

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

  /**
   * COMPRAR um livro de habilidade com o Mestre de Habilidades.
   *
   * ## POR QUE E UM OP E NAO O `USE_ITEM` DE NOVO
   *
   * Porque `USE_ITEM` gasta o livro da mochila, e este ENTREGA um. Sao
   * a mesma coisa vista de lados opostos, e misturar as duas daria um
   * `USE_ITEM` que cria itens
   *
   * O `itemId` e o do LIVRO, e nao o da skill: e o livro que tem preco.
   * O servidor passa esse id pelo catalogo de livros e resolve a skill
   * por ele, entao um id de skill forjado no pedido vira um livro que
   * nao existe e a compra e recusada
   *
   * O preco segue a regra do `BUY_POTION`: vem do catalogo do SERVIDOR,
   * e o que vier no pedido e descartado
   */
  BUY_SKILL_BOOK: "BUY_SKILL_BOOK",

  /**
   * COMPRAR um produto da LOJA.
   *
   * E o unico `op` que compra um CONJUNTO: os outros compram uma coisa so
   * (a pocao, o livro). O pacote da loja e uma lista de itens e um preco,
   * e nenhum dos dois vem do cliente — o pedido leva so o `produtoId`, e o
   * servidor procura a lista e o preco no catalogo
   */
  BUY_SHOP: "BUY_SHOP",

  /**
   * O DASH, na DIRECAO DA MIRA.
   *
   * E o unico pedido de ORDEM que nao leva NENHUM dado: a direcao ja esta
   * no servidor, porque o `INPUT` manda a mira a 45Hz
   *
   * Sem isso o servidor teria de adivinhar a direcao, e as duas respostas que
   * importam para o dash — "para o lado que eu estou olhando" e "para o lado
   * que eu estou andando" — virariam a mesma coisa
   */
  DASH: "DASH",

  /* ------------------------------------------------------------------
     MORTE
     ------------------------------------------------------------------
     Os dois jeitos de voltar ao jogo depois de morrer. Nao ha um
     comando so porque a escolha e do jogador e o preco de cada uma e
     diferente: um custa ouro, o outro custa XP. Um comando unico com um
     parametro "como" deixaria o cliente escolhendo o preco de si mesmo
   */

  /**
   * REVIVER NA HORA, pagando ouro.
   *
   * Quem decide o preco e o SERVIDOR, e ele confere contra a mochila de
   * quem pediu. O painel mostra o valor porque o jogador precisa saber
   * antes de clicar, mas se o cliente mandasse o valor, bastaria mandar
   * zero
   *
   * Nao leva `custo` no payload: e o servidor que cobra, e o painel
   * mostra o mesmo numero que o servidor vai cobrar
   */
  REVIVER: "REVIVER",

  /**
   * VOLTAR PARA A BASE perdendo parte do XP.
   *
   * Nao custa ouro — custa o que o jogador acumulou no nivel. E nao
   * leva `xp` no payload pelo mesmo motivo do de cima: quem calcula a
   * perda e o servidor, sobre o XP que ele proprio concedeu
   *
   * A BASE e o `DEFAULT_MAP_ID`. O servidor resolve o destino, e nao o
   * cliente: aceitar um `mapId` aqui deixaria qualquer um se mandar
   * para o vale sem portal nenhum
   */
  VOLTAR_BASE: "VOLTAR_BASE",

  /**
   * TELEPORTAR para o fim da viagem, gastando um pergaminho.
   *
   * Nao leva coordenada no payload, e e o ponto mais importante deste
   * comando: se o cliente mandasse `x`/`y`, qualquer um se teleporte
   * para onde quisesse, atravessando o mapa inteiro de uma vez. O
   * servidor resolve o destino pelo plano de viagem que ELE esta
   * calculando, e ignora qualquer coordenada que venha junto
   *
   * O pergaminho tambem nao vem no pedido, pelo mesmo motivo do revive:
   * quem conta e quem gasta e o servidor, contra a mochila de quem
   * pediu
   */
  TELEPORTAR: "TELEPORTAR",

  /**
   * LIGA O FARM OFFLINE, e nao leva nada no payload.
   *
   * ## POR QUE NAO LEVA MAPA, NEM TEMPO, NEM QUANTIDADE
   *
   * Porque o servidor nao confia no cliente para nada que tenha valor.
   * Se o pedido trouxesse "mapa: map_2, horas: 48", um cliente modificado
   * farmaria no chefe do mapa e por dois dias. O pedido aqui nao tem
   * campo nenhum: o servidor usa o mapa em que o jogador esta, o relogio
   * de agora, e o ataque que ele tem — e o que o `OfflineFarm` le
   *
   * O `op` ser um valor da lista fechada e o que garante isso: um `op`
   * inventado morre no `parsePanel`
   */
  INICIAR_FARM_OFFLINE: "INICIAR_FARM_OFFLINE",

  /**
   * O JOGADOR VIU O RELATORIO do farm, e o servidor pode esquece-lo.
   *
   * Sem esta op o relatorio voltaria a cada entrada, porque ele mora na
   * sessao e a sessao sobrevive enquanto o jogador estiver online. E o
   * modal nao fecharia nunca
   *
   * E um acknowledge, nao um pedido de dado: nao leva payload e o
   * servidor nao responde com nada alem do painel de sempre
   */
  FARM_OFFLINE_VISTO: "FARM_OFFLINE_VISTO",
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

/**
 * As DUAS acoes do bau da base.
 *
 * Lista fechada pelo mesmo motivo do cofre da guilda: o bau tira item do
 * personagem, e um texto livre ali seria um caminho para pedir qualquer
 * outra coisa com o payload de um deposito
 *
 * Sao as MESMAS palavras do cofre de proposito. O jogador que ja depositou
 * na guilda esta ACTIONando o mesmo verbo aqui, e dois vocabularios para
 * o mesmo gesto fariam o segundo painel parecer outro jogo
 */
export const BAU_ACOES = Object.freeze([
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
import { GUILD_CORES, GUILD_ICONS } from "../data/guild/index.js";

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
  /**
   * O NOME JA ESTA CONECTADO EM OUTRO LUGAR.
   *
   * A trava de um personagem so por nickname: "Teste" e "teste" sao o
   * mesmo personagem, entao abrir em outro navegador e negado. O texto
   * fala de personagem e nao so de "nome", porque e o personagem que
   * esta logado — e e assim que o jogador entende o que fechar
   */
  NAME_TAKEN:
    "Este personagem ja esta logado em outra janela.",
  UNKNOWN_CLASS: "Classe desconhecida.",
  ALREADY_JOINED: "Voce ja entrou nesta partida.",
  RATE_LIMIT: "Voce esta mandando comandos demais.",
  PLAYER_FULL: "O mundo esta cheio.",

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
  //
  // O texto diz o que fazer — escolher a classe certa — porque o
  // jogador so descobre que existe um personagem anterior quando
  // tenta entrar
  CHARACTER_CLASS_MISMATCH:
    "Este nickname ja tem um personagem de outra classe. Entre com a classe original.",

  // O TOKEN DE ENTRADA FALTANDO, PASSOU OU JA FOI USADO.
  //
  // Estas tres recusas sao o mesmo problema visto de tres lados: o JOIN
  // chegou sem prova de que a conta realmente tem aquele personagem. Sem
  // token, o nome e a classe passam a vir do proprio cliente, e qualquer
  // um entra como qualquer um pelo console
  //
  // O texto diz "passe pela tela de personagem" e nao "token invalido"
  // porque o jogador nao tem token na mao: ele tem uma tela. Quem envia o
  // token e o front, e o caminho que ele tem de seguir e voltar para ela
  BAD_TOKEN: "Passe pela tela de personagem para entrar.",
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
 * OS IDS DE ESTILO DE GUILDA QUE O CLIENTE PODE PEDIR.
 *
 * E o mesmo desenho do `CRAFT_RARIDADES`, e pelo mesmo motivo: sao os IDs
 * lidos do CATALOGO, e nao uma copia escrita aqui. Uma segunda lista de
 * onze cores neste arquivo divergiria do `data/guild` na primeira vez que o
 * catalogo ganhasse uma cor — e o cliente aceitaria a cor nova e o
 * servidor a recusaria
 *
 * E sao `Set` e nao `includes` porque a checagem acontece em CADA pedido de
 * painel que chega: `Set.has` e O(1) e `Array.includes` seria O(11) para o
 * mesmo resultado
 */
export const GUILD_ESTILO_ENVIOS = Object.freeze({
  icone: new Set(GUILD_ICONS.map((i) => i.id)),
  cor: new Set(GUILD_CORES.map((c) => c.id)),
});

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
 * O TETO DE MOEDAS NUM PEDIDO DE COFRE.
 *
 * ## POR QUE 1 BILHAO E NAO O SALDO
 *
 * Porque este nao e um limite de jogo: e higiene de transporte. O saldo de
 * um jogador e conferido pelo `spendCoins`, no servidor, e um deposito maior
 * que o saldo e recusado la com "moedas insuficientes" — que e a resposta
 * certaina
 *
 * O que o teto evita e o numero que quebra aritmetica antes de chegar la: um
 * `Infinity` que zera o saldo inteiro do servidor, ou um `1e400` que vira
 * `NaN` na conta do credito do cofre
 *
 * ## E POR QUE NAO O MESMO DO `MARKET_QUANTIDADE_MAX`
 *
 * Porque aquele teto e 99 por causa do `maxStack` do catalogo, que e uma
 * regra da mochila. Moeda nao empilha em pilha nenhuma: um jogador pode ter
 * milhoes no cofre sem que isso seja errado
 */
export const COFRE_MOEDAS_MAX = 1_000_000_000;

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
  const { name, classId, token } = payload;

  if (!isShortString(name, 32) || !isShortString(classId, 32)) {
    return { ok: false, reason: REJECT.BAD_MESSAGE };
  }

  /**
   * O TOKEN, QUANDO VEM.
   *
   * Ele e opcional no formato porque o servidor sem contas nao exige
   * nenhum: e o `GameServer` que decide, olhando se ha `contas`. Se fosse
   * obrigatorio aqui, o jogo local quebraria junto
   *
   * O limite e de 512 porque o token carrega `contaId`, `nome`, `classe` e
   * duas datas em base64 — sobra bastante
   */
  if (token !== undefined && !isShortString(token, 512)) {
    return { ok: false, reason: REJECT.BAD_MESSAGE };
  }

  return {
    ok: true,
    type: CLIENT_COMMANDS.JOIN,
    payload: { name, classId, token },
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
    passId,
    dia,
    icone,
    cor,
    mostrar,
    creatureId,
    collectionId,
    indice,
    produtoId,
    listingId,
      portalId,
      propId,
guildName,
    guildTag,
    guildId,
    alvoId,
    talentId,
    cofreAcao,
    bauAcao,
    moeda,
    item,
    quantidade,
    itemId,
    price,
    count,
    pocaoItemId,
    pocaoLigado,
    pocaoLimiar,
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
       * A CONFIGURACAO DO USO AUTOMATICO DA POCAO.
       *
       * Os tres campos vao no mesmo pedido pelo mesmo motivo do motor: eles
       * nao sao independentes. Trocar a pocao com o automatico ligado
       * desliga o automatico, e um pedido so garante que a segunda metade
       * da regra nunca chegue sem a primeira
       *
       * E o `parsePanel` que reconstroi o payload com uma lista fixa de
       * campos: um campo que nao estivesse nesta lista chegaria ao servidor
       * como `undefined` — o painel pareceria funcionar e o estado nunca
       * mudaria
       *
       * O `pocaoItemId` tem TRES estados, e o `undefined` e um deles.
       *
       * - string curta: e a pocao pedida
       * - `null`: e "tirar a pocao do slot"
       * - `undefined`: e "o painel so mexeu no interruptor", e NAO e
       *   "tirar"
       *
       * A distincao e obrigatoria porque o `JSON.stringify` do cliente
       * DESCARTA a chave quando o valor e `undefined`: o que nao foi enviado
       * chega no servidor como se nunca tivesse existido. Com o `else null`
       * simples, todo clique no interruptor mandava "tirar a pocao" junto
       * — o jogador clicava em "usar automaticamente" e a poção saia do
       * slot
       *
       * E o `undefined` que sobrevive e o que segura a regra do motor: so
       * um pedido que TROCA a pocao desliga o automatico
       */
      pocaoItemId:
        pocaoItemId === null
          ? null
          : isShortString(pocaoItemId, 64)
            ? pocaoItemId
            : undefined,
      pocaoLigado:
        typeof pocaoLigado === "boolean" ? pocaoLigado : null,
      pocaoLimiar: isFiniteNumber(pocaoLimiar)
        ? pocaoLimiar
        : null,

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

      /**
       * O PAR DO RESGATE DO PASSE: `passId` e `dia`.
       *
       * ## POR QUE OS DOIS ESTAO AQUI E NAO SO O `passId`
       *
       * Porque este `parsePanel` reconstroi o payload com uma lista fixa de
       * campos. Um campo fora dela chega ao servidor como `undefined` — sem
       * erro, sem aviso: o pedido e aceito, o `op` bate, e o servidor procura
       * um dia com `dia` indefinido e responde "Esse dia de passe nao
       * existe". E o botao pareceria funcionar, porque o pedido saiu
       *
       * ## E POR QUE O `dia` E NUMERO E NAO TEXTO
       *
       * Porque o servidor compara o dia com `===` contra os numeros do
       * catalogo. Um `"3"` de texto nao casaria com o `3` do dia 3, e o
       * resgate seria recusado sem motivo aparente. O `Math.trunc` corta o
       * `3.7` que um cliente modificado mandaria, e o `dia > 0` descarta o
       * `0` e o negativo, que nao existem em nenhum passe
       */
      passId: isShortString(passId, 64) ? passId : null,
      dia: isFiniteNumber(dia) && Math.trunc(dia) > 0
        ? Math.trunc(dia)
        : null,

      /**
       * O ESTILO DA GUILDA, e por que ele viaja como ID.
       *
       * `icone` e `cor` sao IDs de um catalogo, e nao o glifo e o hex. E
       * por isso que eles passam por `GUILD_ESTILO_ENVIOS`: um cliente
       * modificado mandaria `cor: "#000000"` e o servidor gravaria um preto
       * no arquivo de guildas — e o motor pinta esse valor direto no canvas,
       * em cima de um sprite, onde um preto e indistinguivel do contorno
       *
       * Quando o id nao existe no catalogo, o campo vira `null` e o servidor
       * cai no PADRAO. Nao em "erro": o servidor nao pode recusar a
       * mudanca de cor de um jogador so porque o cliente mandou um id
       * velho — ele aplica o padrao, que e sempre valido
       */
      icone: GUILD_ESTILO_ENVIOS.icone.has(icone) ? icone : null,
      cor: GUILD_ESTILO_ENVIOS.cor.has(cor) ? cor : null,

      /**
       * O INTERRUPTOR DA TAG, como booleano de verdade.
       *
       * E `typeof === "boolean"` e nao um "inverter" porque o servidor nao
       * pode deduzir o valor novo: ele precisa saber se o jogador quer LIGAR
       * ou DESLIGAR, e dois cliques rapidos invertidos se cancelariam
       */
      mostrar: typeof mostrar === "boolean" ? mostrar : null,

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

      /**
       * O PASSE DO PREMIUM.
       *
       * O premium e uma compra POR PASSE, entao o pedido precisa dizer qual.
       * Sem este campo o servidor cairia no passe padrao, e o jogador pagaria
       * uma vez e abriria os dias pagos dos tres
       *
       * O servidor procura o passe pelo id e recusa se nao existir — o
       * catalogo decide o preco, e o id do cliente so escolhe a qual passe
       * ele se refere
       */
      passId: isShortString(passId, 64) ? passId : null,

      /**
       * A PARCELA DA COLECAO que esta sendo entregue.
       *
       * ## O QUE ACONTECIA SEM ESTA LINHA
       *
       * O `parseCommand` nao repassa o payload inteiro: ele monta um objeto
       * novo, campo a campo, e so o que esta escrito ali sobrevive. O
       * `indice` nao estava na lista, entao ele era DESCARTADO no caminho
       *
       * O cliente mandava `{collectionId, indice: 0}`, e o servidor recebia
       * `{collectionId}` — e `pedido.indice ?? null` virava `null`, que o
       * `Collection` le como "entregar a colecao INTEIRA"
       *
       * ## POR QUE ISSO QUEBRAVA O JOGO DE DUAS MANEIRAS
       *
       * A entrega por parcela nunca acontecia. E o pior nao era a parcela
       * errada: as colecoesNAO tem `rewards` no nivel da colecao — o bonus
       * esta em cada `requirement`. A entrega inteira usava
       * `grantBonus(collection)`, lia um `{}` e **nao dava buff nenhum**
       *
       * E, como a entrega inteira exige TODAS as parcelas, ter so a
       * primeira pronta devolvia "faltam 40x osso": o material nao saia, o
       * bonus nao vinha, e o card ficava como estava. Era a mesma falha
       * parecendo duas
       *
       * ## POR QUE `null` CONTINUA SENDO ACEITO
       *
       * Porque e o pedido de entrega inteira, e ele e valido. Quem chama
       * `entregarColecao(id)` sem indice continua entregando tudo
       */
      indice: isFiniteNumber(indice) && Math.trunc(indice) >= 0
        ? Math.trunc(indice)
        : null,

      // o id do anuncio. Vem do cliente e NAO e confiavel: o servidor
      // procura o anuncio pelo id e a recusa se nao existir, entao um
// id forjado nao compra o item de ninguem
        listingId: isShortString(listingId, 64)
          ? listingId
          : null,

        /**
         * O PRODUTO DA LOJA.
         *
         * O mesmo cuidado do `listingId`, e pelo mesmo motivo com mais
         * forca: o pedido nao leva preco nem lista de itens, entao um
         * `produtoId` forjado nao paga menos — ele compra um produto
         * diferente do que o card mostra
         *
         * E o `isShortString` de 64 porque os ids da loja sao longos
         * (`bau-caçador` tem acento e tudo) e nenhum passa disso
         */
        produtoId: isShortString(produtoId, 64)
          ? produtoId
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
       * A PEDIDA DA MINERACAO, ou `null`.
       *
       * Vem do cliente e nao e confiavel, igual ao `portalId`: o servidor
       * procura essa prop no mapa em que o jogador esta, recusa se ela nao
       * existir la, se nao for do tipo que se mineraria ou se ja tiver sido
       * demolida
       *
       * O limite e 64 e nao 32 como o `portalId` porque o id de prop e
       * montado com o prefixo do lote e o indice — `cristal_cristal_comum_0`
       * — e 32 cortaria pela metade o id de uma pedra de raridade alta
       */
      propId: isShortString(propId, 64) ? propId : null,

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
       * A acao no bau: "depositar" ou "retirar".
       *
       * `null` quando veio outra coisa, e o servidor recusa. E o que
       * segura o bau: um pedido sem acao valida nao chega a virar uma
       * movimentacao, porque o `case` do servidor so age dentro do
       * `if (bauAcao)`
       *
       * O `uid` e o `count` acima ja servem as duas acoes, e por isso
       * este bloco nao repete nenhum dos dois
       */
      bauAcao: BAU_ACOES.includes(bauAcao) ? bauAcao : null,

      /**
       * OS TRES CAMPOS DO COFRE, e eles SUMIAM DA MENSAGEM INTEIRA.
       *
       * ## O QUE ACONTECIA
       *
       * O painel manda `{ moeda }`, `{ item, quantidade }` ou
       * `{ uid, quantidade }`, e o `GameClient` repassa as tres formas em
       * `dados`. Este `parsePanel` reconstrui a mensagem campo a campo por
       * uma lista fechada, e `moeda`, `item` e `quantidade` NAO estavam
       * nela: saiam apagados, sem aviso e sem erro
       *
       * Chegando no servidor, `pedido.moeda` e `pedido.item` davam
       * `undefined`, o deposito caia no `if` do item, achava `undefined` e
       * devolvia `cofreInvalido` — a mesma recusa para MOEDA e para ITEM,
       * que era a pista de que o problema era o transporte e nao o cofre
       *
       * E o `uid` do saque passava: ele ja estava na lista. So a quantidade
       * faltava, e uma retirada saia com `quantidade` indefinida
       *
       * ## POR QUE ESTES TRES E NAO O `count` DE NOVO
       *
       * Porque `count` e o nome do campo INTERNO da pilha, e quem pede e o
       * jogador falando QUANTO quer mexer. Sao coisas diferentes, e o
       * `GameClient.mexerNoBau` ja faz essa distincao de proposito
       */
      moeda:
        isFiniteNumber(moeda) &&
        Math.floor(moeda) >= 1 &&
        Math.floor(moeda) <= COFRE_MOEDAS_MAX
          ? Math.floor(moeda)
          : null,

      /**
       * A CHAVE DA PILHA NO DEPOSITO: um `uid` ou um `itemId`.
       *
       * Mesmo limite do `uid` acima e pelo mesmo motivo: e uma string curta
       * que o servidor procura na mochila, e nunca e confiavel
       */
      item: isShortString(item, 64) ? item : null,

      /**
       * A QUANTIDADE que sai, e nao a que a pilha tem.
       *
       * `null` e o pedido padrao, que o servidor traduz em "a pilha
       * inteira". O teto e o mesmo do `count`: uma pilha do jogo nao passa
       * de 99, entao pedir mais so significaria aceitar um numero que nao
       * existe na mochila
       */
      quantidade:
        isFiniteNumber(quantidade) &&
        Math.floor(quantidade) >= 1 &&
        Math.floor(quantidade) <= MARKET_QUANTIDADE_MAX
          ? Math.floor(quantidade)
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

  // qual habilidade. `SKILL` sem slot nao diz nada: as quatro
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
