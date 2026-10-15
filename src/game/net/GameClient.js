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

    /**
     * QUEM QUER REAGIR AO PAINEL CHEGANDO.
     *
     * Um `Set` e nao um `onState` novo porque o `onState` ja e do dono do
     * jogo — o `GameCanvas` — e um segundo callback overwrite o primeiro
     *
     * Existe para o `iniciarFarmOffline`, que precisa saber que o
     * servidor JA_atendeu antes de deixar o jogador sair. O painel e a
     * unica resposta que existe: o pedido nao tem confirmacao propria
     */
    this.painelOuvintes = new Set();

this.keys = new Set();
this.ponteiro = { x: 0, y: 0, inside: false };

/**
 * O VETOR DE ANDAR DA INTENCAO ENVIADA POR ULTIMO.
 *
 * ## POR QUE ISTO EXISTE SENDO QUE `keys` JA RESPONDE A PERGUNTA
 *
 * Porque a previsao do `NetworkWorld` roda 60 vezes por segundo e o
 * `moveFromKeys` nao e chamado 60 vezes por segundo: a intencao so
 * vira pacote quando o vetor MUDA ou passa o intervalo. Ler `keys`
 * direto no `NetworkWorld` daria o mesmo vetor, entao parece
 * equivalente — e nao e.
 *
 * `keys` e o que o TECLADO esta pressionando agora; este campo e o
 * que o SERVIDOR foi avisado que o jogador quer. Sao iguais na
 * pratica, mas o segundo sobrevive a uma tecla que o navegador
 * engole (perde o foco, `blur`, uma aba em segundo plano): com `keys`,
 * a previsao continuaria andando para um lugar que o servidor nunca
 * recebeu e o boneco arrancaria para longe a cada perda de foco.
 *
 * O objeto e REATRIBUIDO, nunca modificado: e o mesmo vetor que foi
 * para o pacote, sem risco de a previsao ler uma conta pela metade.
 *
 * @type {{x: number, y: number}}
 */
this.ultimaIntencao = { x: 0, y: 0 };

    /**
     * ONDE O JOGADOR ESTA DESENHADO NA TELA.
     *
     * Nao e um numero guardado: e um LEITOR. O `GameCanvas` registra
     * aqui uma funcao que le a posicao direto do motor, e ela e chamada
     * na hora de cada pacote. Guardar o valor aqui nao daria: entre um
     * pacote e outro o jogador anda, a camera trava na borda do mapa e o
     * boneco sai do centro da tela — e um valor velho produz a mesma mira
     * errada que o bug antigo
     */
    this.leitorDeJogadorNaTela = null;

    /**
     * ONDE A MIRA APONTA, EM PIXEL DE TELA DO CENTRO.
     *
     * E um LEITOR pelo mesmo motivo do de cima: o ponto de mira e decidido
     * pelo motor, que e quem conhece a mira magnetica e o inimigo preso. Um
     * valor guardado aqui envelheceria assim que o bicho andasse
     *
     * Sem leitor, vale o `this.ponteiro` — que e o ponteiro cru, e o
     * comportamento de sempre
     */
    this.leitorDePonteiroDeMira = null;

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

      /**
       * A FILA MORRE COM O SOCKET.
       *
       * E o que fecha um vazamento que vinha crescendo a cada queda. Os
       * comandos da fila descrevem o que o jogador ESTAVA FAZENDO ha pouco —
       * e o `INPUT` guarda o delta de movimento. Se eles sobreviverem a
       * queda, a reconexao despeja tudo de uma vez, e o personagem anda
       * sozinho repetindo um andar que ja acabou
       *
       * E nao e Loss of amostra aceitavel: perder alguns comandos de um
       * socket caido e o comportamento correto. O que o jogador fez depois da
       * queda e que vale, e isso passa pelo input novo
       */
      this.fila.length = 0;

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

  /**
   * Entra no mundo com o nome e a classe escolhidos.
   *
   * ## O TOKEN, QUANDO VEM
   *
   * O `token` e a prova de que a conta realmente tem aquele personagem. Quem
   * chegou pelo front traz ele na URL; quem abriu o jogo direto nao traz, e
   * o servidor aceita o JOIN pelo nome como sempre fez
   *
   * A chave so entra no payload quando existe: mandar `token: undefined`
   * pelo JSON vira a string `"undefined"`, que o servidor leria como um token
   * invalido em vez de ausencia
   */
  entrar({ name, classId, token }) {
    const payload = { name, classId };

    if (token) payload.token = token;

    this.envia(CLIENT_COMMANDS.JOIN, payload);
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

/**
 * O VETOR QUE ESTE PACOTE CARREGA, guardado para a previsao.
 *
 * E a MESMA conta que vai dentro do `INPUT`, e nao uma segunda
 * leitura de `keys`: a previsao do `NetworkWorld` usa este valor 60
 * vezes por quadro, e ela precisa mover o boneco para ONDE o
 * servidor foi avisado, inclusive no intervalo entre um pacote e o
 * seguinte.
 *
 * A reatribuicao vem antes do `envia` de proposito: se o `envia`
 * falhar porque o socket acabou de fechar, a previsao nao deve ficar
 * com um vetor que ninguem recebeu.
 */
this.ultimaIntencao = { x: move.x, y: move.y };

    // a mira sai do ponto de mira em relacao ao JOGADOR NA TELA, e nao em
    // relacao ao centro da tela. As duas coisas so coincidem enquanto a
    // camera segue o jogador: perto da borda do mapa a camera trava, o
    // jogador anda na tela, e medir pelo centro manda a mira para o lado
    // errado
    const aim = aimFromPointer(this.ponteiroDeMira(), this.jogadorNaTela());

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

    const aim = aimFromPointer(this.ponteiroDeMira(), this.jogadorNaTela());

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
   * AVISA QUEM ESTAVA ESPERANDO O PAINEL.
   *
   * ## POR QUE COPIA O SET ANTES DE ITERAR
   *
   * Porque um listener pode se remover no meio da chamada — o
   * `iniciarFarmOffline` faz isso ao confirmar. Iterar o `Set` enquanto
   * ele se modifica pula o proximo, e o painel pararia de avisar depois
   * do primeiro uso
   *
   * E o `try` porque um listener que lanca nao pode impedir os outros de
   * serem avisados: o painel ja chegou, e quem nao foi avisado ficaria
   * esperando para sempre
   */
  avisaPainel() {
    for (const ouvinte of [...this.painelOuvintes]) {
      try {
        ouvinte(this.painel);
      } catch {
        // um listener quebrado nao derruba o painel dos outros
      }
    }
  }

  /**
   * Pede a limpeza da mochila pelo filtro.
   * Antes o botao "Limpar mochila" chamava o motor da tela, que
   * online nao tem a sessao do jogador: o pedido morria no cliente e
   * a mochila continuava cheia. Online quem limpa e o servidor, e so
   * a mochila de quem pediu
   */
  podarMochila() {
    return this.pedirPainel({ op: PANEL_OPS.PRUNE_INVENTORY });
  }

  /**
   * Compra mais 10 slots de mochila.
   *
   * Nao leva quantos slots nem por quanto: o servidor le a capacidade da
   * sessao e cobra com `proximaCompra`. Passar os numeros aqui daria ao
   * cliente uma autoridade que ele nao tem — e um cliente modificado mandando
   * `slots: 999` viraria uma mochila de graca
   */
  expandirMochila() {
    return this.pedirPainel({ op: PANEL_OPS.EXPAND_INVENTORY });
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

  /**
   * LIGA O FARM OFFLINE, e ESPERA o servidor confirmar.
   *
   * ## POR QUE ISSO DEVOLVE UMA PROMISE E NAO UM BOOLEAN
   *
   * Porque o proximo passo do jogador e DESCONECTAR, e o
   * `desconectar` faz `this.fila = []`. Um `true` aqui seria a promessa
   * de que o pedido saiu, e o jogador sairia na mesma hora em que a
   * linha seguinte do React desmonta a tela
   *
   * A WebSocket garante ordem — o que foi enviado antes do `close`
   * chega antes do `close` — entao o pedido nao se perde. Mas o cliente
   * nao tem como saber isso, e sem esperar o `disconectar` pode correr
   * primeiro por causa do agendamento do navegador
   *
   * Entao a UI espera: resolve quando o proximo painel trouxer o farm
   * ligado, e resolve tambem se o painel nao chegar, depois de um
   * prazo. O prazo existe porque um servidor velho, ou uma queda de
   * rede, deixaria a tela travada para sempre esperando uma confirmacao
   * que nunca vem
   *
   * @returns {Promise<boolean>} `true` se o servidor confirmou
   */
  iniciarFarmOffline({ timeoutMs = 2500 } = {}) {
    if (!this.jogando()) return Promise.resolve(false);

    return new Promise((resolve) => {
      let resolvido = false;

      const concluir = (confirmado) => {
        if (resolvido) return;

        resolvido = true;

        this.ouvinteFarmOffline = null;

        clearTimeout(timer);

        resolve(confirmado);
      };

      /**
       * O QUE ESCUTA: o painel, nao uma resposta dedicada.
       *
       * Nao existe um `SERVER_EVENTS.FARM_OFFLINE`. O painel ja viaja a
       * 4Hz com o estado de tudo, e o `iniciarFarmOffline` do servidor
       * dispara um `enviarPainel` junto com as outras ops de painel
       */
      this.ouvinteFarmOffline = () => {
        if (this.painel?.farmOffline?.ativo === true) {
          concluir(true);
        }
      };

      const timer = setTimeout(() => concluir(false), timeoutMs);

      this.painelOuvintes.add(this.ouvinteFarmOffline);

      this.pedirPainel({ op: PANEL_OPS.INICIAR_FARM_OFFLINE });
    });
  }

  /**
   * O JOGADOR FECHOU O MODAL do farm.
   *
   * Sem isto o relatorio voltaria a cada entrada, porque ele mora na
   * sessao e a sessao sobrevive enquanto o jogador estiver online
   */
  viuFarmOffline() {
    return this.pedirPainel({ op: PANEL_OPS.FARM_OFFLINE_VISTO });
  }

alternarAutoPlay() {
      return this.pedirPainel({ op: PANEL_OPS.TOGGLE_AUTO_PLAY });
    }

    /**
     * Pede o DASH, na direcao da mira do jogador.
     *
     * ## POR QUE NAO LE NENHUM ARGUMENTO
     *
     * Porque a direcao JA esta no servidor. O `INPUT` manda `aimX`/`aimY` a
     * 45Hz, e o `GameServer` transforma em um ponto no mundo antes de
     * aplicar. Mandar a mira de novo aqui seria o mesmo numero em dois
     * lugares, e os dois poderiam discordar — o dash iria para a direcao do
     * pacote mais antigo
     *
     * E por isso que o pedido e tao vazio quanto possivel: um dash e um
     * deslocamento, e o deslocamento nao se negocia — ou o servidor aceita
     * e decide a direcao, ou nao ha dash
     */
dash() {
    return this.pedirPainel({ op: PANEL_OPS.DASH });
  }

  /**
   * A CONFIGURACAO DO USO AUTOMATICO DA POCAO.
   *
   * Os tres campos num pedido so, e nao um pedido por acao, pelo mesmo
   * motivo do motor: trocar a pocao com o automatico ligado desliga o
   * automatico, e um pedido so garante que essa regra chegue inteira
   *
   * ## O `itemId` AUSENTE PRECISA VIR `undefined`, E NAO `null`
   *
   * Sao tres estados num campo, e o terceiro e o que o painel usa no
   * interruptor e no limiar:
   *
   * - string: equipou aquela pocao
   * - `null`: tirou a pocao do slot
   * - ausente: so mexeu no interruptor ou no limiar
   *
   * O `JSON.stringify` desta linha DESCARTA a chave quando o valor e
   * `undefined`, e e isso que faz o ausente chegar como ausente: se este
   * metodo transformasse o ausente em `null`, todo clique em "usar
   * automaticamente" mandaria ALSO "tirar a pocao do slot", e o motor
   * obedeceria as duas metades do pedido
   */
  configurarAutoPocao({ ligado, limiar, itemId } = {}) {
    return this.pedirPainel({
      op: PANEL_OPS.SET_AUTO_POTION,
      pocaoLigado: typeof ligado === "boolean" ? ligado : null,
      pocaoLimiar: Number.isFinite(limiar) ? limiar : null,

      /**
       * O `null` explicito chega como `null` porque o `JSON.stringify`
       * escreve `null` — e o que o `parsePanel` le como "tirar". O
       * `undefined` nao vira nada no pacote, e e o que o servidor le como
       * "nao mexeu na pocao"
       */
      pocaoItemId: itemId === undefined ? undefined : (itemId ?? null),
    });
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

  criarGuilda(nome, tag, estilo = null) {
    return this.pedirPainel({
      op: PANEL_OPS.GUILD_CRIAR,
      guildName: nome,
      guildTag: tag,

      /**
       * O ESTILO viaja por ID, e nunca como glifo ou hex.
       *
       * O `parsePanel` so deixa passar o que existe em `GUILD_ICONS` e
       * `GUILD_CORES`, e o que ele recusar chega `null` no servidor — que cai
       * no padrao. Mandar o hex abriria a porta para um cliente modificado
       * gravar qualquer cor no arquivo de guildas
       */
      icone: estilo?.icone ?? null,
      cor: estilo?.cor ?? null,
    });
  }

  /**
   * MUDA O EMBLEMA e A COR da guilda.
   *
   * E o caminho do LIDER. O servidor devolve "semPermissao" para qualquer
   * outro, e o store e quem confere — nao aqui, porque quem decide quem e
   * lider e o servidor
   */
  definirEstiloGuilda(icone, cor) {
    return this.pedirPainel({
      op: PANEL_OPS.SET_GUILD_STYLE,
      icone,
      cor,
    });
  }

  /**
   * LIGA OU DESLIGA a tag sobre o boneco deste jogador.
   *
   * Leva o valor novo e nao um "inverter", pelo mesmo motivo do
   * `definirPassePremium`: dois cliques rapidos podem chegar em qualquer
   * ordem no servidor
   */
  definirMostrarTag(mostrar) {
    return this.pedirPainel({
      op: PANEL_OPS.SET_SHOW_TAG,
      mostrar: mostrar === true,
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

  /**
   * O BAU DA BASE: deposita e retira itens.
   *
   * ## POR QUE UM OBJETO SO, E NAO `mexerNoBau(acao, uid, count)`
   *
   * Porque o `uid` e o `count` so fazem sentido JUNTOS com a acao, e uma
   * assinatura de tres posicoes soltas deixa o chamador trocar `uid` por
   * `acao` sem nenhum aviso do compilador. O `mexerNoCofre` acima ja
   * sofre disso e resolveu com um objeto em `dados`; aqui as duas metades
   * do pedido entram juntas no mesmo objeto
   *
   * E `quantidade`, e nao `count`, porque o `count` e o nome do campo
   * interno da pilha: o que o jogador pede e uma quantidade, e quem decide
   * o que sai da pilha e o servidor
   *
   * O `uid` e sempre o do ESPACO DE ORIGEM: da mochila no deposito, do
   * bau na retirada. Sao espacos com ids proprios, e o espaco e o que diz
   * de onde o item vem
   */
  mexerNoBau(bauAcao, { uid, quantidade } = {}) {
    return this.pedirPainel({
      op: PANEL_OPS.BAU,
      bauAcao,
      uid,
      count: quantidade,
    });
  }

  atravessarPortal(portalId) {    return this.pedirPainel({
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
   * ENTRA NO MAPA DE TESTE, E SAI DELE.
   *
   * O mesmo `op` da arena e pelo mesmo motivo: quem decide o sentido e o
   * mapa em que o jogador esta, e nao o botao. O servidor guarda a
   * origem e devolve o jogador para la
   */
irParaTeste() {
      return this.pedirPainel({ op: PANEL_OPS.IR_PARA_TESTE });
    }

  /**
   * ENCOSTAR NUMA PEDIDA DE STEEL, E SAIR DELA.
   *
   * O mesmo `op` nos dois sentidos, pelo mesmo motivo do mapa de teste: quem
   * decide e o servidor, olhando se a sessao ja esta encostada em alguma
   * pedra. O cliente nao guarda se esta minerando — esse estado vem no
   * painel, do servidor, e e de la que a HUD le
   *
   * O `propId` viaja mesmo quando o sentido e PARAR. Nao ha como o cliente
   * saber em qual sentido esta, e mandar o id de qualquer forma deixa o
   * servidor com o pedido completo nos dois casos
   */
  minerar(propId) {
      return this.pedirPainel({ op: PANEL_OPS.MINERAR, propId });
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
   * Gasta um ponto da arvore num no.
   *
   * ## POR QUE SO O `noId` VIAJA
   *
   * Porque o custo, o bonus e os pre-requisitos sao DADO do catalogo da
   * classe. Mandar qualquer um deles no pedido seria o cliente dizendo o
   * que custa, e o servidor pagaria o que o cliente pediu
   */
  aprenderNoArvore(noId) {
    return this.pedirPainel({
      op: PANEL_OPS.LEARN_TREE_NODE,
      noId,
    });
  }

  /**
   * Resgata TUDO que a aba aberta tem na fila.
   *
   * ## POR QUE VIAJA O ESCOPO E O MAPA, E NAO A LISTA
   *
   * Porque quem tem a fila e o servidor. Mandando os ids, o cliente estaria
   * dizendo o que deve ser pago, e a lista passaria pela rede duas vezes
   * — uma no `claimable` do snapshot e outra aqui. Mandando "esta aba, deste
   * mapa", o servidor filtra com o mesmo dado que montou o snapshot, e as
   * duas contas nao podem divergir
   *
   * O `mapa` e o que impede a aba principal do mapa 1 de pagar os degraus
   * do mapa 2: as duas abas existem nos dois mapas
   */
  resgatarTodasMissoes(scope, mapa) {
    return this.pedirPainel({
      op: PANEL_OPS.CLAIM_ALL_QUEST_REWARDS,
      scope,
      mapa,
    });
  }

  /**
   * Resgata UM dia do passe.
   *
   * ## POR QUE SO O PAR `passId` E `dia` VIAJA
   *
   * Porque o item e a quantidade NAO viajam. O servidor procura o dia no
   * catalogo pelo par e paga o que estiver la, entao um pedido forjado com
   * `quantidade: 999` seria ignorado. E o par tambem e o que garante a
   * unicidade: o servidor confere a lista de resgates antes de pagar, e o
   * segundo pedido do mesmo dia nao paga de novo
   *
   * O `dia` vai como numero ja, e nao como texto do botao: o `Number` aqui
   * deixa o servidor receives um `3` e nao um `"3"`, e assim o `===` da
   * lista de resgates bate sem conversao do lado de la
   */
  resgatarDiaDoPasse(passId, dia) {
    return this.pedirPainel({
      op: PANEL_OPS.CLAIM_PASS_REWARD,
      passId,
      dia: Math.floor(Number(dia)),
    });
  }

  /**
   * Liga ou desliga o passe premium.
   *
   * E um interruptor de ESTADO, entao o pedido leva o valor novo e nao um
   * "inverter": dois cliques rapidos no botao podem chegar em qualquer
   * ordem no servidor, e mandar "inverter" duas vezes deixaria o
   * interruptor como estava
   */
  definirPassePremium(ativo, passId) {
    return this.pedirPainel({
        op: PANEL_OPS.SET_PASS_PREMIUM,
        ativo: ativo === true,

        /**
         * O PASSE, e nao o painel.
         *
         * O premium e uma compra por passe: 100 diamantes pagam UM dos tres.
         * Sem o `passId` o servidor cairia no passe padrao, e o jogador
         * pagaria pela Praga e receberia os dias pagos dos tres
         *
         * E o id vem do catalogo, no servidor: um `passId` forjado cai em
         * `getPasse(null)` e nao cobra nem liga nada
         */
        passId: passId ?? null,
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
  entregarColecao(collectionId, indice = null) {
    return this.pedirPainel({
      op: PANEL_OPS.DELIVER_COLLECTION,
      collectionId,
      indice,
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
   * APRIMORA uma peca, da mochila OU do corpo.
   *
   * ## POR QUE A MESMA FORMA DO `encantar`
   *
   * Porque agora o `enhance` mora na PECA, entao os dois lados servem —
   * igual ao afixo. O `uid` e o da mochila e o `slotId` e o do corpo, e
   * nunca os dois: o servidor recusa o pedido ambiguo
   */
  aprimorar(alvo) {
    const pedido = { op: PANEL_OPS.ENHANCE };

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
  listarNoMarket(uid, price, count = null, opcoes = {}) {
    return this.pedirPainel({
      op: PANEL_OPS.MARKET_LIST,
      uid,
      price,
      count,

      // a moeda e o modo vao no MESMO pedido do preco: sao as tres metades do
      // mesmo anuncio, e mandar duas vezes permitiria um anuncio com preco de
      // ouro e entrega em diamante
      currency: opcoes.currency,
      modo: opcoes.modo,
      minBid: opcoes.minBid,
    });
  }

  comprarNoMarket(listingId) {
    return this.pedirPainel({
      op: PANEL_OPS.MARKET_BUY,
      listingId,
    });
  }

  /**
   * UM LANCE. E um pedido a parte do `comprar` porque a resposta e diferente:
   * a compra tira o item do ar, e o lance mantem o anuncio e devolve o valor
   * de quem foi ultrapassado
   */
  darLanceNoMarket(listingId, valor) {
    return this.pedirPainel({
      op: PANEL_OPS.MARKET_BID,
      listingId,
      price: valor,
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

  /**
   * Compra um PRODUTO da loja.
   *
   * E o unico pedido de compra que leva so o ID do produto: nem `count`, nem
   * preco, nem a lista de itens. O pacote tem tres ou quatro coisas dentro
   * e um preco, e nenhum dos dois vem do cliente — mandar qualquer um dos
   * dois aqui seria mandar "quanto eu quero pagar" para o servidor
   *
   * O card desativando e a resposta do `snapshot.loja.comprados`, e nao um
   * estado que este lado guarda: se o cliente marcasse, o F5 devolveria o
   * card e o jogador pagaria duas vezes
   */
  comprarProduto(produtoId) {
    if (!produtoId) return false;

    return this.pedirPainel({
      op: PANEL_OPS.BUY_SHOP,
      produtoId,
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

  /**
   * REGISTRA QUEM SABE ONDE O JOGADOR ESTA NA TELA.
   *
   * Quem passa isso e o `GameCanvas`, que e dono do motor e por isso sabe
   * a resposta. Este cliente so guarda pacote: ele nao tem canvas, nao tem
   * viewport e nao tem zoom, entao nenhum calculo aqui chegaria perto da
   * conta
   *
   * Passar `null` desregistra — e o que o `GameCanvas` faz ao desmontar,
   * para nao deixar uma funcao morta presa no socket
   */
definirLeitorDeJogadorNaTela(ler) {
this.leitorDeJogadorNaTela = typeof ler === "function" ? ler : null;
}

/**
 * O VETOR DE ANDAR QUE O SERVIDOR JA FOI AVISADO.
 *
 * Quem chama e o `NetworkWorld`, uma vez por quadro, para mover o
 * boneco antes de o servidor responder. O nome e proposital: devolve o
 * que foi ENVIADO, e nao o que o teclado esta pressionando.
 *
 * @returns {{x: number, y: number}}
 */
intencaoAtual() {
return this.ultimaIntencao;
}

  /**
   * REGISTRA QUEM SABE ONDE A MIRA APONTA.
   *
   * E o mesmo par do leitor de jogador: quem tem a resposta e o motor, e ele
   * registra os dois de uma vez pelo `GameCanvas`
   */
  definirLeitorDePonteiroDeMira(ler) {
    this.leitorDePonteiroDeMira = typeof ler === "function" ? ler : null;
  }

  /**
   * ONDE A MIRA APONTA AGORA, EM PIXEL DE TELA DO CENTRO.
   *
   * ## POR QUE ISTO E PREGUNTO AO MOTOR E NAO UM VALOR GUARDADO
   *
   * Porque a mira magnetica gruda num inimigo que ANDA. Se o cliente guardasse
   * a posicao do ponteiro no momento do ultimo `pointermove`, o reticulo
   * desenharia no bicho novo e o tiro sairia na posicao antiga — o jogador
   * veria a mira acertando e o golpe errando
   *
   * ## E POR QUE O PONTEIRO CRU CONTINUA SENDO O PADRAO
   *
   * Porque e ele que o `pointermove` manda, e ele nao esta preso a nada. Na
   * base, sem combate, sem inimigo por perto, os dois dao o mesmo numero e
   * nada muda
   */
  ponteiroDeMira() {
    if (!this.leitorDePonteiroDeMira) return this.ponteiro;

    try {
      const ponto = this.leitorDePonteiroDeMira();

      if (!Number.isFinite(ponto?.x) || !Number.isFinite(ponto?.y)) {
        return this.ponteiro;
      }

      /**
       * O `inside` VIEM DO PONTEIRO CRU, E ISTO E O QUE FAZ O TIRO MIRAR.
       *
       * ## O QUE ACONTECIA SEM ESTA LINHA
       *
       * O leitor devolve `{ x, y }` e nada mais. O `aimFromPointer` comeca
       * com `if (!ponteiro?.inside) return { x: 0, y: 0 }`, e `!undefined` e
       * `true` — entao a mira saia ZERADA em TODOS os quadros, com o ponteiro
       * exatamente onde o jogador mandou
       *
       * A mira zerada vira no servidor um `pointer` em cima do jogador, e o
       * tiro sai com direcao `(0, 0)`. `Math.atan2(0, 0)` e `0`, que e leste:
       * o golpe ia SEMPRE para a direita, qualquer que fosse o lado do clique
       *
       * ## POR QUE O `inside` DO CRU E O CERTO
       *
       * Porque o retculo pode estar grudado num inimigo, e ainda assim o
       * ponteiro estar FORA do canvas. A mira so vale se o jogador esta
       * mirando alguma coisa — e quem responde isso e o `pointerleave`, nao o
       * motor
       *
       * ## E POR QUE COMBINAR, E NAO SOBRESCREVER
       *
       * Porque o ponto do motor tem a posicao CORRETA (o inimigo andou desde
       * o ultimo `pointermove`) e o ponteiro cru tem o `inside` CORRETO. Cada
       * um sabe de uma coisa que o outro nao sabe
       */
      return {
        x: ponto.x,
        y: ponto.y,
        inside: this.ponteiro.inside,
      };
    } catch {
      // o motor pode ja ter sido destruido: perder um pacote e melhor que
      // derrubar o socket
      return this.ponteiro;
    }
  }

  /**
   * ONDE O JOGADOR ESTA DESENHADO, EM PIXELS DE TELA, MEDIDO DO CENTRO.
   *
   * O mesmo espaco do `this.ponteiro`, porque e a diferenca entre os dois
   * que vira direcao. O motor calcula como `(jogador - centro) * zoom`: o
   * `zoom` entra porque o `GameCanvas` manda o ponteiro em pixels de tela,
   * e o boneco e desenhado em pixels de tela tambem
   *
   * Sem leitor registrado, cai no centro. E o comportamento antigo, e e
   * exatamente o que a mira deve fazer quando nao se sabe onde o jogador
   * esta: e melhor mirar pelo meio do que por um ponto inventado
   */
  jogadorNaTela() {
    if (!this.leitorDeJogadorNaTela) return { x: 0, y: 0 };

    try {
      const posicao = this.leitorDeJogadorNaTela();

      return {
        x: Number.isFinite(posicao?.x) ? posicao.x : 0,
        y: Number.isFinite(posicao?.y) ? posicao.y : 0,
      };
    } catch {
      // o motor pode ja estar destruido: a tela saiu entre o pacote e a
      // mira. Perder um pacote e melhor que derrubar o socket
      return { x: 0, y: 0 };
    }
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
       * As pedras que o servidor tirou do mapa.
       *
       * Sai daqui e nao do `NetworkWorld` porque e o unico caminho que o
       * `GameCanvas` usa: ele entrega ESTE objeto ao `aplicar`. O
       * `NetworkWorld` le `estado.pedidasFora` e escreve no motor
       */
      pedidasFora: this.pedidasFora ?? [],

      /**
       * Em que mapa o servidor esta. O `NetworkWorld` compara com o
       * motor e troca quando o id muda
       */
      mapa: this.mapaAnterior,

      /**
* O JOGADOR LOCAL VAI SEM INTERPOLACAO.
*
* Todo o resto desta amostra passa por `amostrar(id, t)`, que
* desenha o PASSADO de proposito: o pacote que acabou de chegar
* descreve um instante que ja passou, e comecar nele faria todo
* boneco pular a cada 50ms.
*
* Para o jogador local isso seria um atraso somado ao atraso. O
* cliente ja tem previsao (`NetworkWorld.prever`), e a previsao
* precisa da posicao mais RECENTE que o servidor mandou — nao de uma
* media entre dois pacotes. Passar a interpolada aqui custaria ate
* 50ms de atraso extra em cima do meio RTT, e a `Previsao` passaria
* a pagar um erro constante que ela nao tem como distinguir de
* divergencia de verdade.
*/
eu: this.mundo.eu(this.playerId),
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
    this.painelOuvintes.clear();

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
      this.avisaPainel();
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

      /**
       * AS PEDRAS QUE SAIRAM DO MAPA, e guardadas para a amostra.
       *
       * ## POR QUE FICA AQUI E NAO ENTRA DIRETO NO MOTOR
       *
       * Porque quem escreve no motor NAO e este arquivo. O `aplicar` daqui
       * recebe o pacote CRU, que nao tem `eu`, e devolve `false` de
       * propósito — o mesmo caminho do estado vazio do `desconectar`. Quem
       * escreve no motor de verdade e o `GameCanvas`, com a AMOSTRA deste
       * arquivo
       *
       * Sem este campo a pedra demolida nunca chegava ao motor: o servidor
       * tirava a pedra do mundo, o cliente continuava desenhando o cristal e
       * o colisor dele continuava barrando o jogador
       *
       * E uma COPIA, e nao a referencia do pacote: a lista muda a 20Hz e o
       * `CollisionSystem` le um `Set`, que e construido do zero a cada
       * aplicacao. Guardar a referencia nao custaria nada, mas a copia
       * deixa obvio que este e o unico dono do estado
       */
      this.pedidasFora = Array.isArray(payload.pedidasFora)
        ? [...payload.pedidasFora]
        : [];

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
      /**
       * A FILA TEM TETO.
       *
       * ## POR QUE 200
       *
       * Porque a fila existe para a janela entre `entrar()` e o socket abrir,
       * que dura quelques milissegundos. O que cabe nela nesse tempo e o
       * `JOIN` e o primeiro `INPUT` — uma duzia de comandos. Duzentos e uma
       * folga de tres ordens de grandeza
       *
       * ## E POR QUE `shift` E NAO `pop`
       *
       * Porque o mais ANTIGO e o mais velho. Descartando o fim, perderíamos o
       * `JOIN` e o servidor nunca saberia quem e o jogador — oRejected seria
       * "sem nome", que e um erro diferente do verdadeiro
       *
       * ## O QUE ACONTECIA SEM TETO
       *
       * Se o socket ficasse em `CONNECTING` — o estado exato do erro do
       * console, "closed before the connection is established" — cada comando
       * do auto-play entrava na fila e nenhum saia. O `despejaFila` so roda
       * com o socket ABERTO, entao nada drenava. Minutos depois, a fila podia
       * ter milhares de `INPUT` velhos, e a reconexao mandava todos de uma
       * vez — pastindo o `RATE_LIMIT` do servidor e fazendo o personagem
       * repetir o andar que ja tinha acabado
       */
      this.fila.push(comando);

      while (this.fila.length > 200) this.fila.shift();

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
