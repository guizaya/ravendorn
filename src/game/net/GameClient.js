import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  PLAYER_ACTIONS,
  SERVER_EVENTS,
  createCommand,
} from "../../shared/protocol.js";
import { WorldState } from "./WorldState.js";
import { moveFromKeys, aimFromPointer } from "./intent.js";

/** Os estados que a tela precisa mostrar ao jogador. */
export const STATUS = {
  CONECTANDO: "conectando",
  CONECTADO: "conectado",
  JOGANDO: "jogando",
  RECUSADO: "recusado",
  FECHADO: "fechado",
  ERRO: "erro",
};

/**
 * A ligacao do cliente com o mundo.
 *
 * O cliente nao simula nada: ele manda INTENCAO e guarda o que o
 * servidor devolve. Nao existe "posicao local" para o servidor
 * aceitar, entao nao ha como trapacear o movimento daqui.
 */
export class GameClient {
  /**
   * @param {object} opcoes
   * @param {string} opcoes.url            onde abrir o socket
   * @param {(estado: object) => void} opcoes.onStatus
   * @param {(estado: object) => void} opcoes.onState
   */
  constructor({
    url,
    onStatus = () => {},
    onState = () => {},
    onEnter = () => {},
    onLeave = () => {},
    onDano = () => {},
    onConviteParty = () => {},
    WebSocketImpl,
    agora = () => Date.now(),
  } = {}) {
    this.url = url;
    this.onStatus = onStatus;
    this.onState = onState;
    this.onEnter = onEnter;
    this.onLeave = onLeave;

    /**
     * O golpe resolvido que o servidor so mandou para este jogador.
     *
     * Sem esta linha o `recebe` chamava `this.onDano?.(...)` em cima de
     * `undefined`, e o `?.` engolia o erro em silencio: o servidor
     * mandava o `DAMAGE` certo e o cliente nao desenhava numero
     * nenhum, sem nenhum erro no console. Um optional chaining que
     * esconde um handler que nunca foi ligado
     */
    this.onDano = onDano;

    /**
     * O CONVITE DE PARTY, e o que fecha a caixa de cinco segundos.
     *
     * `null` e um valor de primeira classe: ele significa "o convite que
     * estava na tela nao esta mais", e e o que a caixa usa para sumir
     */
    this.onConviteParty = onConviteParty;

    /** O convite pendente, para quem quiser ler sem assinar o callback. */
    this.conviteParty = null;

    this.agora = agora;

    // o `WebSocketImpl` entra por parametro para o teste rodar em
    // Node, onde `WebSocket` global nao existe. sem esta
    // injecao o cliente so poderia ser testado no navegador
    this.WebSocketImpl =
      WebSocketImpl ?? globalThis.WebSocket;

    this.socket = null;
    this.mundo = new WorldState();

    // comandos enviados antes do socket abrir
    this.fila = [];

    this.status = STATUS.CONECTANDO;
    this.playerId = null;
    this.erro = null;
    this.motivoRecusa = null;

    /** o ultimo painel que o servidor mandou (inventario, missoes...) */
    this.painel = null;

    this.keys = new Set();
    this.ponteiro = { x: 0, y: 0, inside: false };

    this.seq = 0;
    this.intencaoEnviada = null;

    this.fechadoDeProposito = false;
  }

  conectar() {
    if (!this.WebSocketImpl) {
      return this.falhar(
        "Este navegador nao tem WebSocket.",
      );
    }

    this.fechadoDeProposito = false;
    this.status = STATUS.CONECTANDO;
    this.avisaStatus();

    try {
      this.socket = new this.WebSocketImpl(this.url);
    } catch (erro) {
      return this.falhar(erro.message);
    }

    this.socket.onopen = () => {
      this.status = STATUS.CONECTADO;
      this.avisaStatus();
      this.despejaFila();
    };

    this.socket.onmessage = (evento) => {
      this.recebe(evento.data);
    };

    this.socket.onerror = () => {
      // o `onclose` vem logo em seguida e e ele que muda o
      // status. aqui so garantimos que houve um erro
      if (this.fechadoDeProposito) return;

      this.erro = "Nao deu para falar com o servidor.";
    };

    this.socket.onclose = () => {
      this.socket = null;

      // um RECUSADO nao pode virar FECHADO: o `close` que eu mesmo
      // faco ao receber a recusa dispara este evento logo depois, e
      // a tela mostraria "voce saiu" em vez de "esse nome nao
      // serve", que e a informacao que o jogador precisa
      if (this.status === STATUS.RECUSADO) {
        this.avisaStatus();
        return;
      }

      if (this.fechadoDeProposito) {
        this.status = STATUS.FECHADO;
      } else {
        this.status = STATUS.ERRO;
        this.erro ??= "A conexao com o servidor caiu.";
      }

      this.avisaStatus();
    };
  }

  /** Entra no mundo com o nome e a classe escolhidos. */
  entrar({ name, classId }) {
    this.envia(
      CLIENT_COMMANDS.JOIN,
      { name, classId },
    );
  }

  /**
   * Manda o estado do teclado e do mouse.
   *
   * E chamado a cada quadro, mas so vira pacote quando o vetor
   * MUDA ou passou o intervalo. Mandar 60 INPUT por segundo e
   * desperdicio de banda e nao torna o movimento mais fluido: o
   * servidor simula a 20Hz de qualquer jeito.
   */
  sincronizarIntencao() {
    if (!this.jogando()) return;

    const move = moveFromKeys(this.keys);

    // a mira sai do ponteiro em relacao ao centro da tela, onde o
    // jogador e desenhado. o jogador e desenhado no centro porque
    // a camera segue ele
    const aim = aimFromPointer(this.ponteiro, { x: 0, y: 0 });

    // repare o que NAO esta aqui: a posicao. o pacote e "quero ir
    // para a direita", e o servidor decide o quanto. e o que
    // impede um cliente modificado de teleportar
    this.envia(CLIENT_COMMANDS.INPUT, {
      seq: ++this.seq,
      moveX: move.x,
      moveY: move.y,
      aimX: aim.x,
      aimY: aim.y,
    });
  }

  /** Dispara uma acao. `slot` so importa para SKILL. */
  agir(action, { targetId = null, slot = 0 } = {}) {
    if (!this.jogando()) return;

    const aim = aimFromPointer(this.ponteiro, { x: 0, y: 0 });

    this.envia(CLIENT_COMMANDS.ACTION, {
      action,
      targetId,
      slot,
      aimX: aim.x,
      aimY: aim.y,
    });
  }

  atacarAlvo(targetId) {
    this.agir(PLAYER_ACTIONS.BASIC_ATTACK, { targetId });
  }

  usarHabilidade(slot, targetId = null) {
    this.agir(PLAYER_ACTIONS.SKILL, { slot, targetId });
  }

  usarUltimate(targetId = null) {
    this.agir(PLAYER_ACTIONS.ULTIMATE, { targetId });
  }

  /** Marca um inimigo como alvo, para o proximo ataque mirar nele. */
  mirar(targetId) {
    this.agir(PLAYER_ACTIONS.TARGET, { targetId });
  }

  /**
   * Um pedido que mexe no seu painel.
   *
   * O cliente nao guarda inventario nem equipamento: ele pede e
   * espera o servidor mandar de volta. Por isso cada chamada aqui
   * e "quero isso", e nao "fiz isso". E o que impede um cliente
   * modificado de "equipar" um item que ele nao tem.
   */
  pedirPainel(pedido) {
    if (!this.jogando()) return false;

    return this.envia(CLIENT_COMMANDS.PANEL, pedido);
  }

  equipar(uid, slotId) {
    return this.pedirPainel({ op: PANEL_OPS.EQUIP, uid, slotId });
  }

  desequipar(slotId) {
    return this.pedirPainel({ op: PANEL_OPS.UNEQUIP, slotId });
  }

  descartar(uid) {
    return this.pedirPainel({ op: PANEL_OPS.DISCARD, uid });
  }

  equiparMelhor() {
    return this.pedirPainel({ op: PANEL_OPS.AUTO_EQUIP });
  }

  /**
   * Pede a criacao de um item.
   *
   * A `rarity` e o PEDIDO, nao uma concessao: o servidor confere se
   * a receita tem variante naquela raridade e cobra o ingredients e
   * as moedas que ela custa. Sem mandar, o servidor usava a
   * raridade natural da receita e o jogador recebia um item comum
   * depois de ter escolhido uma rara na tela
   */
  criar(recipeId, rarity = null) {
    return this.pedirPainel({
      op: PANEL_OPS.CRAFT,
      recipeId,
      rarity,
    });
  }

  filtroDeLoot(filter) {
    return this.pedirPainel({
      op: PANEL_OPS.SET_LOOT_FILTER,
      filter,
    });
  }

  /**
   * Pede a limpeza da mochila pelo filtro.
   *
   * Antes o botao "Limpar mochila" chamava o motor da tela, que
   * online nao tem a sessao do jogador: o pedido morria no cliente e
   * a mochila continuava cheia. Online quem limpa e o servidor, e so
   * a mochila de quem pediu
   */
  podarMochila() {
    return this.pedirPainel({ op: PANEL_OPS.PRUNE_INVENTORY });
  }

  /**
   * Pede a correcao das pecas vestidas na posicao errada.
   *
   * Online, abrir o inventario e um ato do cliente, mas o
   * equipamento mora no servidor. Sem este pedido, o painel abriria
   * mostrando um capuz no peito para sempre: a correcao de posicao
   * roda no `equip`, e o `equip` so acontece quando o jogador veste
   * alguma coisa
   */
  consertarEquipamento() {
    return this.pedirPainel({
      op: PANEL_OPS.FIX_MISPLACED_EQUIPMENT,
    });
  }

  alternarAutoPlay() {
    return this.pedirPainel({ op: PANEL_OPS.TOGGLE_AUTO_PLAY });
  }

  /**
   * ATRAVESSAR O PORTAL.
   *
   * Manda o ID do portal, e nao o mapa. O destino e decidido pelo
   * servidor a partir do portal, e ele ainda confere que o jogador esta
   * em cima dele: pedir direto por um mapa permitiria teleportar para
   * qualquer lugar
   */

  /* ------------------------------------------------------------------
     GUILDA
     ------------------------------------------------------------------
     O pedido leva o que o jogador ESCOLHEU e nada mais. O papel, os
     pontos e a existencia da guilda sao lidos pelo servidor: aceitar
     qualquer um deles vindo do cliente deixaria um jogador criar
     guilda com 24 pontos, ou abrir o cofre sem ser da diretoria
     ------------------------------------------------------------------ */

  criarGuilda(nome, tag) {
    return this.pedirPainel({
      op: PANEL_OPS.GUILD_CRIAR,
      guildName: nome,
      guildTag: tag,
    });
  }

  /* ---------------------------------------------------------------- */
  /* A PARTY                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * CRIA A PARTY.
   *
   * Criar uma party de um jogador so NAO muda nada visivel: o `PartyStore`
   * cria o grupo com um membro, e o mesmo pedido com `PARTY_INVITE` e
   * quem enche
   *
   * O botao existe porque o pedido diz que a box mostra o caminho, e o
   * caminho de um jogador so e "criar" e depois "convidar" — sem a party
   * criada, o campo do nick nunca apareceria
   */
  criarParty() {
    return this.pedirPainel({ op: PANEL_OPS.PARTY_CREATE });
  }

  /** Convida pelo clique no personagem, e o caminho do `PARTY_INVITE`. */
  convidarParty(alvoId) {
    return this.pedirPainel({
      op: PANEL_OPS.PARTY_INVITE,
      alvoId,
    });
  }

  /**
   * Convida pelo NICK digitado.
   *
   * O nome vai como string e o servidor resolve. Resolver aqui exigiria
   * a lista de jogadores connected no cliente, e essa lista nao existe:
   * o cliente so enxerga quem esta no ALCANCE da tela
   */
  convidarPartyPorNome(nome) {
    return this.pedirPainel({
      op: PANEL_OPS.PARTY_INVITE_BY_NAME,
      nome,
    });
  }

  /**
   * Aceita o convite que esta NA TELA.
   *
   * Nao manda o id de quem convidou: o servidor tem um convite pendente
   * por jogador e sabe qual e. Mandar o id abriria a porta de aceitar o
   * convite de outra pessoa, se o cliente forjado
   */
  aceitarConviteParty() {
    return this.pedirPainel({
      op: PANEL_OPS.PARTY_ACCEPT_INVITE,
    });
  }

  /**
   * EXPULSA UM MEMBRO DA PARTY.
   *
   * So o lider pode, e a checagem e do servidor: o `alvoId` aqui e um
   * pedido, e o `PartyStore` decide. Um cliente que forjou o pedido
   * receberia "so o lider pode expulsar"
   */
  expulsarDaParty(alvoId) {
    return this.pedirPainel({
      op: PANEL_OPS.PARTY_KICK,
      alvoId,
    });
  }

  /**
   * SEGUE UM MEMBRO DA PARTY.
   *
   * O botao e um interruptor: clicar em quem ja se segue CANCELA o
   * acompanhamento. Sem isso o jogador teria de procurar o botao de
   * desligar, e ele fica do lado do `×`
   */
  seguirPartyMember(alvoId) {
    return this.pedirPainel({
      op: PANEL_OPS.PARTY_FOLLOW,
      alvoId,
    });
  }

  /**
   * LIGA OU DESLIGA O FOCO DO ALVO DO LIDER.
   *
   * Manda o estado pedido, e nao um "inverter": dois cliques rapidos
   * num interruptor que inverteria voltariam ao estado inicial, e o
   * jogador teria clicado duas vezes para tentar desligar
   */
  focarAlvoDoLider(ligado) {
    return this.pedirPainel({
      op: PANEL_OPS.PARTY_FOCUS,

      /**
       * `ativo`, e nao `ligado`.
       *
       * O `parsePanel` so repassa os campos que ele conhece. Um campo
       * novo chegaria ao servidor como `undefined`, o botao pareceria
       * funcionar e o estado nunca mudaria — por isso o interruptor
       * viaja no campo que o protocolo ja carrega
       */
      ativo: Boolean(ligado),
    });
  }

/**
   * PASSA A LIDERANCA DA PARTY.
   *
   * O `alvoId` e quem passa a ser o lider. O servidor recusa se quem
   * pediu nao for o lider atual, ou se o alvo nao estiver na party
   *
   * ## POR QUE O NOME LE `DaParty`
   *
   * Ja existia um `passarLideranca` aqui, e o dele era o da GUILDA. Com
   * o mesmo nome, a definicao mais abaixo do arquivo vencia: o botao da
   * party acabava mandando `GUILD_LIDERANCA`, e a resposta era "Voce
   * ainda nao tem guilda." — o erro de guilda, num botao de party
   *
   * O nome do metodo e o que separava as duas coisas, e nao o `op` que
   * viaja dentro: dois metodos com o mesmo nome na mesma classe sao um
   * so
   */
  passarLiderancaDaParty(alvoId) {
      return this.pedirPainel({
        op: PANEL_OPS.PARTY_TRANSFER,
        alvoId,
      });
    }

  sairDaParty() {
    return this.pedirPainel({ op: PANEL_OPS.PARTY_LEAVE });
  }

  buscarGuilda(termo) {
    return this.pedirPainel({
      op: PANEL_OPS.GUILD_BUSCAR,
      guildName: termo,
    });
  }

  pedirGuilda(guildaId) {
    return this.pedirPainel({
      op: PANEL_OPS.GUILD_PEDIR,
      guildId: guildaId,
    });
  }

  aceitarGuilda(guildaId, alvoId) {
    return this.pedirPainel({
      op: PANEL_OPS.GUILD_ACEITAR,
      guildId: guildaId,
      alvoId,
    });
  }

  negarGuilda(guildaId, alvoId) {
    return this.pedirPainel({
      op: PANEL_OPS.GUILD_NEGAR,
      guildId: guildaId,
      alvoId,
    });
  }

  sairDaGuilda() {
    return this.pedirPainel({ op: PANEL_OPS.GUILD_SAIR });
  }

  /**
   * Gastar PONTO em um talento.
   *
   * Manda o talentId e nao o custo, e nao a guilda: o servidor
   * descobre a guilda do jogador, o preco do talento e se o saldo
   * basta
   */
  destravarTalent(talentId) {
    return this.pedirPainel({
      op: PANEL_OPS.GUILD_TALENTO,
      talentId,
    });
  }

  /** Passa a lideranca, ou dissolve quando o alvoId e null */
  passarLideranca(alvoId = null) {
    return this.pedirPainel({
      op: PANEL_OPS.GUILD_LIDERANCA,
      alvoId,
    });
  }

  /**
 * O COFRE: deposita e saca moedas e itens.
 *
 * O segundo argumento e um objeto com `moeda`, `item` ou `uid`, e nao
 * posicois soltas. Os tres caminhos nao convivem: um pedido com `moeda` e
 * `item` preenchidos e um pedido malformado, e o servidor le a moeda
 * primeiro
 *
 * O `uid` do item e sempre o da MOCHILA no deposito e o do SLOT no
 * saque — sao espacos diferentes com ids diferentes, e e o espaco que
 * diz de onde o item vem
 */
  mexerNoCofre(guildaId, acao, dados = {}) {
    return this.pedirPainel({
      op: PANEL_OPS.GUILD_COFRE,
      guildId: guildaId,
      cofreAcao: acao,
      ...dados,
    });
  }

  atravessarPortal(portalId) {
    return this.pedirPainel({
      op: PANEL_OPS.TRAVESSAR_PORTAL,
      portalId,
    });
  }

  /**
   * O BOTAO DA ARENA: entra, e o segundo clique traz de volta.
   *
   * Nao leva mapa nem posicao, e nao por falta de argumento: o destino
   * e a origem sao lidos pelo SERVIDOR. Um `mapa` aqui viraria um
   * teletransporte para qualquer lugar pedido pelo cliente
   *
   * O sentido tambem nao vem do cliente. Quem decide e o mapa em que o
   * jogador esta, entao o botao sabe o que faz olhando o proprio icone e
   * o pedido e o mesmo nos dois casos
   */
  irParaArena() {
    return this.pedirPainel({ op: PANEL_OPS.IR_PARA_ARENA });
  }

  /**
   * Teleporta para o fim da viagem, gastando um pergaminho.
   *
   * Nao leva coordenada nenhuma, e e o que fecha a porta de um cliente
   * modificado: o destino sai do plano de viagem que o SERVIDOR esta
   * calculando. Mandar `x`/`y` aqui seria aceitar "me mande para
   * qualquer ponto do mapa", e o servidor resolveria o destino de um
   * pedido que ele mesmo montou
   */
  teleportar() {
    return this.pedirPainel({ op: PANEL_OPS.TELEPORTAR });
  }

  /**
   * Liga e desliga o auto da missao.
   *
   * Vai pelo painel como o auto de cacar perto, e pelo mesmo motivo:
   * quem decide o objetivo do piloto e o servidor. Chamar isso no
   * motor da tela nao faria nada, porque o cliente nao simula.
   */
  alternarAutoMissao() {
    return this.pedirPainel({ op: PANEL_OPS.TOGGLE_QUEST_AUTO });
  }

  /** Escolhe a missao do botao "auto" dela no painel. */
  focarMissao(questId) {
    return this.pedirPainel({
      op: PANEL_OPS.FOCUS_QUEST,
      questId,
    });
  }

  /**
   * Aceita uma missao secundaria.
   *
   * O `QuestLog` e por sessao, entao aceitar pelo motor da tela
   * online nao valeria: o servidor nunca saberia, e o proximo painel
   * voltaria sem a missao na caixa.
   */
  aceitarMissaoSecundaria(questId) {
    return this.pedirPainel({
      op: PANEL_OPS.ACCEPT_SIDE_QUEST,
      questId,
    });
  }

  /** Desiste da missao secundaria ativa. */
  abandonarMissaoSecundaria() {
    return this.pedirPainel({
      op: PANEL_OPS.ABANDON_SIDE_QUEST,
    });
  }

  /**
   * Recebe a recompensa de uma missao concluida.
   *
   * O pedido leva o `questId` so para o servidor encontrar a
   * recompensa certa. Os numeros do pagamento NAO viajam: o servidor
   * le a fila dele, e um cliente que mandasse "coins: 99999" seria
   * ignorado. Pelo mesmo caminho de `aceitarMissaoSecundaria`,
   * porque quem tem gold, xp e mochila e o servidor
   */
  resgatarRecompensaMissao(questId) {
    return this.pedirPainel({
      op: PANEL_OPS.CLAIM_QUEST_REWARD,
      questId,
    });
  }

  /**
   * Pede a cacada de UMA criatura no bestiario.
   *
   * O botao "ir matar" chamava o motor da tela, que online nao tem
   * sessao: o clique morria e o servidor nunca recebia a cacada.
   * E o `bestiaryTargetType` mora na sessao, entao o pedido tem de
   * ir para quem decide.
   */
  cacarCriatura(creatureId) {
    return this.pedirPainel({
      op: PANEL_OPS.SET_BESTIARY_AUTO,
      creatureId,
    });
  }

  /**
   * Entrega uma COLECAO.
   *
   * E a op mais destrutiva do cliente: tira item do inventario. O
   * servidor ignora o que o cliente afirma ter e confere contra o
   * proprio inventario, entao um cliente modificado so ganha a recusa,
   * nunca o item
   *
   * O nome e `entregarColecao` e nao `deliverCollection` porque e o
   * nome que o `useGameClient` chama. A dividao de nomes vivia em paz
   * so nos testes: o duble do `intencao` no teste da HUD tinha o
   * metodo com o nome que o teste queria, entao o teste passava
   * enquanto o `GameClient` de verdade respondia a outro nome. No
   * jogo o clique chamava um metodo `undefined`, o `comCliente` engolia
   * o erro no `catch` do socket morto e a entrega saia silenciosa
   *
   * O pedido leva so o `collectionId`. Quem tem o material e a
   * recompensa e o servidor: um cliente que mandasse "items: 10" seria
   * ignorado
   */
  entregarColecao(collectionId) {
    return this.pedirPainel({
      op: PANEL_OPS.DELIVER_COLLECTION,
      collectionId,
    });
  }

  /**
   * Encanta uma peca.
   *
   * O pedido leva o `uid` da mochila OU o `slotId` do que esta
   * vestido, e nunca os dois. Quem decide e o servidor: um pedido com
   * os dois preenchidos e ambiguo, e o motor escolheria um dos dois
   * sem o jogador saber qual
   *
   * Os dois caminhos levam SO o endereco. O afixo nunca vem do
   * cliente: ele sorteia do lado do servidor, porque um cliente que
   * mandasse o resultado escreveria o numero que quisesse dentro do
   * stat do jogador, e o `parsePanel` nao tem como saber se aquilo
   * saiu de um sorteio
   *
   * O resultado volta no `SNAPSHOT` seguinte, em
   * `inventory.items` ou em `equipment.slots`, e a UI le o afixo de la
   */
  encantar(alvo) {
    const pedido = { op: PANEL_OPS.ENCHANT };

    if (alvo?.slotId) {
      pedido.slotId = alvo.slotId;
    } else if (alvo?.uid) {
      pedido.uid = alvo.uid;
    } else {
      return false;
    }

    return this.pedirPainel(pedido);
  }

  /**
   * As tres operacoes do MARKET.
   *
   * O `uid`, o `price` e o `mode` vao como PEDIDO e sao conferidos
   * pelo servidor contra o inventario real de quem pediu. Um cliente
   * modificado que mandasse um preco de 1 levaria o item por 1 moeda:
   * quem aplica o piso de preco e o servidor, nao este codigo
   */
  listarNoMarket(uid, price, count = null) {
    return this.pedirPainel({
      op: PANEL_OPS.MARKET_LIST,
      uid,
      price,
      count,
    });
  }

  comprarNoMarket(listingId) {
    return this.pedirPainel({
      op: PANEL_OPS.MARKET_BUY,
      listingId,
    });
  }

  cancelarNoMarket(listingId) {
    return this.pedirPainel({
      op: PANEL_OPS.MARKET_CANCEL,
      listingId,
    });
  }

  /**
   * USA um consumivel da mochila: a pocao de cura, por enquanto.
   *
   * Manda so o `uid` e nao o efeito nem o valor: a cura e o que o
   * catalogo do item diz, e um cliente que mandasse `heal: 9999` curaria
   * 9999 se o servidor lesse o numero
   */
  usarItem(uid) {
    if (!uid) return false;

    return this.pedirPainel({
      op: PANEL_OPS.USE_ITEM,
      uid,
    });
  }

  /**
   * COMPRA uma pocao na loja do mercador.
   *
   * `count` vai sem teto aqui: o transporte ja recusa numero quebrado,
   * e o teto de regra — quantas poucoes a loja vende por clique — e do
   * servidor, que e quem cobra
   */
  comprarPocao(itemId, count = 1) {
    if (!itemId) return false;

    return this.pedirPainel({
      op: PANEL_OPS.BUY_POTION,
      itemId,
      count,
    });
  }

  /**
   * Compra um livro com o Mestre de Habilidades.
   *
   * `itemId` e o do LIVRO, e nao o da skill: e o livro que tem preco.
   * O servidor passa esse id pelo catalogo e descobre a skill por ele
   *
   * Nao vai `count` porque um livro ensina uma skill — a segunda copia
   * nao ensina nada, e o servidor recusa antes de cobrar
   */
  comprarLivro(itemId) {
    if (!itemId) return false;

    return this.pedirPainel({
      op: PANEL_OPS.BUY_SKILL_BOOK,
      itemId,
    });
  }

  /** Desiste da cacada. */
  pararCacada() {
    return this.pedirPainel({
      op: PANEL_OPS.CLEAR_BESTIARY_AUTO,
    });
  }

  /**
   * REVIVER depois de morrer, pagando ouro.
   *
   * Nao leva o preco. O servidor calcula com `reviveCost(level)` e
   * cobra da mochila de quem pediu; mandar o valor aqui seria deixar o
   * cliente escolher quanto paga, e o painel so precisaria mostrar o
   * numero para o jogador saber o que espera pagar
   */
  reviver() {
    return this.pedirPainel({ op: PANEL_OPS.REVIVER });
  }

  /**
   * VOLTAR PARA A BASE depois de morrer, perdendo XP.
   *
   * Tambem sem parametro: nem o preco nem o mapa de destino. O destino
   * e o `DEFAULT_MAP_ID`, resolvido pelo servidor — aceitar um `mapId`
   * aqui seria um teletransporte de graça, sem passar por portal
   */
  voltarBase() {
    return this.pedirPainel({ op: PANEL_OPS.VOLTAR_BASE });
  }

  marcarAuto(skillId, ativo) {
    return this.pedirPainel({
      op: PANEL_OPS.SET_SKILL_AUTO,
      skillId,
      ativo,
    });
  }

  /** Uma tecla foi apertada ou solta. */
  tecla(tecla, pressionada) {
    if (pressionada) {
      this.keys.add(tecla);
    } else {
      this.keys.delete(tecla);
    }

    this.sincronizarIntencao();
  }

  /** O ponteiro se moveu sobre o canvas. */
  moverPonteiro(x, y, dentro = true) {
    this.ponteiro.x = x;
    this.ponteiro.y = y;
    this.ponteiro.inside = dentro;
  }

  /** Ja tem sessao no mundo? Sem WELCOME, nada e aceito. */
  jogando() {
    return (
      this.status === STATUS.JOGANDO && this.playerId !== null
    );
  }

  /** O que o cliente representa no mapa AGORA, interpolado. */
  amostra() {
    if (!this.jogando()) return null;

    const t = this.mundo.fracaoDoCiclo(this.agora());

    return {
      painel: this.painel,

      /**
       * Em que mapa o servidor esta. O `NetworkWorld` compara com o
       * motor e troca quando o id muda
       */
      mapa: this.mapaAnterior,

      eu: this.mundo.amostrar(this.playerId, t),
      outros: this.mundo
        .outros(this.playerId)
        .map((p) => this.mundo.amostrar(p.id, t) ?? p),
      inimigos: [...this.mundo.inimigos.values()],
      drops: [...this.mundo.drops.values()],

      // as flechas vao no mesmo caminho dos inimigos: sao desenho,
      // e o desenho do motor le daqui
      projeteis: this.mundo.projeteis(),
    };
  }

  desconectar() {
    this.fechadoDeProposito = true;
    this.fila = [];

    try {
      this.socket?.close();
    } catch {
      // socket ja estava fechado
    }

    this.socket = null;
  }

  // ----------------------------------------------------------------

  recebe(bruto) {
    let mensagem;

    try {
      mensagem = JSON.parse(bruto);
    } catch {
      // o servidor nao deveria mandar lixo. se mandar, seguimos
      // com o ultimo estado conhecido em vez de travar o cliente
      return;
    }

    const { type, payload } = mensagem;

    if (type === SERVER_EVENTS.WELCOME) {
      this.playerId = payload.playerId;
      this.status = STATUS.JOGANDO;
      this.mundo.aplicar({
        seq: 0,
        time: 0,
        players: [],
        enemies: [],
        drops: [],
      });
      this.avisaStatus();
      return;
    }

    if (type === SERVER_EVENTS.PLAYER_STATE) {
      // o painel e o estado privado de quem recebeu. e montado
      // pelo mesmo codigo que a tela offline consome, entao nao ha
      // duas descricoes do formato para divergirem
      this.painel = payload;
      this.onState(this.amostra());
      return;
    }

    if (type === SERVER_EVENTS.SNAPSHOT) {
      /**
       * O MAPA que o servidor esta rodando.
       *
       * Fica guardado aqui e sai na `amostra`, para o `NetworkWorld`
       * trocar o motor quando o id mudar. Quem troca NAO e este
       * arquivo: o `GameClient` nao conhece o motor, ele so carrega o
       * pacote — a troca acontece em quem tem o `engine`
       */
      if (payload.mapa) {
        this.mapaAnterior = payload.mapa;
      }

      if (!this.mundo.aplicar(payload)) return;

      this.mundo.marcaRecebimento(this.agora());
      this.onState(this.amostra());
      return;
    }

    if (type === SERVER_EVENTS.DAMAGE) {
      /**
       * O NUMERO DE DANO sobe na tela.
       *
       * Este arquivo nao desenha e nao conhece o motor: ele carrega o
       * pacote e avisa. Quem cria o texto flutuante e quem tem o
       * canvas, o `GameCanvas`, ligado por `onDano`
       *
       * Nao entra no `onState` de proposito: um golpe e um INSTANTE e
       * nao um estado. Se viesse dentro da amostra, ele re-renderizaria
       * o React inteiro 20 vezes por segundo para mostrar um numero que
       * so precisa aparecer uma vez
       */
      this.onDano?.(payload);
      return;
    }

    /**
   * O CONVITE DE PARTY CHEGOU.
   *
   * ## POR QUE ESTE EVENTO E SEPARADO DO PAINEL
   *
   * O convite e addressed so a QUEM foi convidado. Se viesse dentro do
   * `PLAYER_STATE`, o `onState` re-renderizaria a tela inteira para
   * mostrar uma caixa de cinco segundos — e todo mundo receberia um
   * pacote que nao e seu
   *
   * O prazo viaja como instante absoluto e a caixa conta a partir dele: o
   * relogio do servidor e o unico que vale, e um relogio adiantado aqui
   * nao daria uma party com vinte segundos de vida
   */
  if (type === SERVER_EVENTS.PARTY_INVITE_RECEIVED) {
    this.conviteParty = payload ?? null;

    this.onConviteParty?.(payload);

    return;
  }

  /**
   * O CONVITE FECHOU, por aceite ou por prazo.
   *
   * A caixa sai da tela sem esperar o proximo painel: se o jogador
   * recusou, a caixa morta na frente dele seria pior que a sumir
   */
  if (type === SERVER_EVENTS.PARTY_INVITE_CLOSED) {
    this.conviteParty = null;

    this.onConviteParty?.(null);

    return;
  }

  if (type === SERVER_EVENTS.REJECTED) {
      this.motivoRecusa = payload?.reason ?? null;

      // recusado SEM sessao e caso perdido: o nome foi rejeitado.
      // ficar conectado so faria o proximo INPUT ser recusado
      // tambem, e o jogador veria a tela parada sem saber por que
      if (!this.playerId) {
        this.fechadoDeProposito = true;
        this.status = STATUS.RECUSADO;

        try {
          this.socket?.close();
        } catch {
          // socket ja estava fechando
        }

        this.socket = null;
        this.avisaStatus();
      }
    }
  }

  /**
   * Envia um comando, ou guarda para quando o socket abrir.
   *
   * A tela chama `entrar()` no mesmo instante em que monta, e o
   * `open` do socket ainda vai demorar alguns milissegundos.
   * Sem esta fila o JOIN era simplesmente perdido, o servidor
   * nunca recebia o nome e o jogador ficava numa tela parada sem
   * nenhuma mensagem de erro.
   */
  envia(type, payload) {
    const comando = createCommand(type, payload);

    if (!this.socket) return false;

    if (this.socket.readyState !== 1) {
      this.fila.push(comando);
      return true;
    }

    try {
      this.socket.send(JSON.stringify(comando));
      return true;
    } catch {
      return false;
    }
  }

  /** Manda tudo o que acumulou enquanto o socket nao abria. */
  despejaFila() {
    if (this.socket?.readyState !== 1) return;

    const pendentes = this.fila;
    this.fila = [];

    for (const comando of pendentes) {
      try {
        this.socket.send(JSON.stringify(comando));
      } catch {
        // o socket morreu no meio do despejo
      }
    }
  }

  falhar(mensagem) {
    this.erro = mensagem;
    this.status = STATUS.ERRO;
    this.avisaStatus();
    return false;
  }

  avisaStatus() {
    this.onStatus({
      status: this.status,
      erro: this.erro,
      motivoRecusa: this.motivoRecusa,
    });
  }
}
