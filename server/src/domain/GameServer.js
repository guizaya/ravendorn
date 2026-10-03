import { randomUUID } from "node:crypto";
import { GameEngine } from "../../../src/game/engine/GameEngine.js";
import { createPlayerSession } from "../../../src/game/engine/PlayerSession.js";
import { CHARACTER_CLASSES } from "../../../src/data/characters/index.js";
import {
  getMap,
  DEFAULT_MAP_ID,
} from "../../../src/data/maps/index.js";
import {
  nameKey,
  validateName,
} from "../../../src/data/characterName.js";
import { criarCharacterStore } from "../persistence/CharacterStore.js";
import {
  criarMarketSave,
  devolucoesLegiveis,
  pagamentosLegiveis,
} from "../persistence/MarketSave.js";
import {
  MarketStore,
  snapshotMarket,
} from "../../../src/game/market/MarketStore.js";
import { GuildStore } from "../../../src/game/guild/GuildStore.js";
import {
  GUILD_CRIACAO_CUSTO,
  GUILD_MEMBROS_MAX,
  mensagemDeGuilda,
} from "../../../src/data/guild/index.js";
import {
  ANUNCIOS_MAXIMOS,
  MARKET_RESULT,
  PRECO_MAXIMO,
  PRECO_MINIMO,
  describeAnuncioItem,
  podeListar,
} from "../../../src/data/market/index.js";
import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  PROTOCOL_VERSION,
  REJECT,
  SERVER_EVENTS,
  parseCommand,
} from "../../../src/shared/protocol.js";
import {
  applyCharacterSave,
  isReadableSave,
  refillVitals,
  saveClassOf,
  snapshotSession,
} from "../../../src/game/save/CharacterSave.js";
import { SERVER_CONFIG } from "../config.js";
import { Client } from "./Client.js";
import { getItem, isStackable } from "../../../src/data/items/index.js";

/**
 * De quanto em tempo o online vira arquivo.
 *
 * O `desconectar` ja salva, e e o caminho que importa no dia a dia:
 * fechar o navegador fecha o socket. Isto e a rede de seguranca para o
 * caso em que o servidor MORRE com gente jogando
 *
 * Trinta segundos e um meio termo: curto o bastante para o jogador nao
 * perder a hora de farm, longo o bastante para nao escrever arquivo a
 * cada minuto de quem so passou pelo jogo
 */
const SEGUNDO_ENTRE_SAVES = 30;

/**
 * A distacia, em unidades de mundo, de onde a mira do jogador alcanca.
 *
 * O ponteiro do cliente nao entra no pacote: ele e da TELA, e cada
 * navegador tem a sua. O que o servidor recebe e "quero mirar para a
 * direita", e ele que decide ate onde. Sem isto, um jogador de
 * monitor grande miraria mais longe que um de monitor pequeno
 */
const DISTANCIA_DE_MIRA = 1000;

/**
 * O RAIO de interesse, ao quadrado, de um cliente.
 *
 * O mapa e do tamanho do mundo, e mandar todos os inimigos para
 * todo mundo a 20Hz seria uma banda absurda por conexao. Cada cliente
 * recebe so o que esta perto dele — e o quadrado evita a raiz a cada
 * mob: `(dx*dx + dy*dy) > INTERESSE_QUADRADO`
 *
 * O valor e 1000 porque e o alcance da tela do jogador: mandar mob
 * alem disso e trafego para desenhar coisa fora do quadro. E um teste
 * do servidor mede essa distancia no proprio pacote, entao o numero
 * nao e um palpite de rendimento — e o contrato
 */
const INTERESSE = 1000;
const INTERESSE_QUADRADO = INTERESSE * INTERESSE;

/**
 * O MESMO dado do arquivo, na versao deste servidor.
 *
 * Um arquivo de uma versao mais nova nao e lido: os campos daquele
 * formato nao significam nada aqui, e o mercado comeca vazio em vez de
 * virar uma vitrine de anuncios meio lidos
 */
const MERCADO_VERSAO = 1;

/**
 * O SERVIDOR.
 *
 * Tudo que decides no jogo mora aqui: quem esta no mapa, o que cada um
 * carrega, o que o loot dropped, e o mercado. O cliente manda
 * INTENCAO ("quero andar para a direita") e recebe o RESULTADO. Ele
 * nunca diz onde esta, quanto tem, nem o que o mob dele tem
 *
 * O `GameEngine` e o mesmo motor da tela offline, rodando sem canvas.
 * Isso e deliberado: ter duas simulacoes seria ter dois jogos que
 * divergem no primeiro bug. Aqui o motor so e testemunha de snapshot e de
 * comando, e quem decide o que o motor pode fazer com um jogador e o
 * `withPlayer`, que troca o foco antes de cada operacao
 *
 * `mapId` escolhe em que MAPA o mundo roda. Sem argumento entra o
 * `DEFAULT_MAP_ID`, que e o hub. O jogador comum entra no calcamento,
 * como deve ser
 *
 * Quem passa um id esta escolhendo de proposito: os testes de combate
 * pedem `map_1`, porque o hub nao tem zona de mob e o teste precisa de
 * um alvo. E assim que o portal ligar os mapas, o cliente passa a dizer
 * qual mapa quer — este parametro e o caminho que ja existe para isso,
 * em vez de um `DEFAULT_MAP_ID` lido em tres lugares
 */
export class GameServer {
  constructor({
    config = SERVER_CONFIG,
    persistencia,
    mapId = DEFAULT_MAP_ID,
  } = {}) {
    this.config = config;
    this.clients = new Map();

    /**
     * O MARKET, e o primeiro estado que NAO e por jogador.
     *
     * Todo o resto da `PlayerSession` e privado — invento, missao,
     * bestiario — e o `PlayerSession.js` explica por que estado
     * privado nao pode morar no mundo: dois jogadores compartilhando o
     * mesmo estado veem o loot um do outro. O mercado e o oposto
     * exato: o anuncio de um jogador E o produto que o outro compra,
     * entao ele tem de ser de todos
     *
     * E o `agora` e injetado, como o do `GameClient`. Os sete dias de
     * validade nao cabem num teste de espera, e um timer falso esconde
     * as bordas — o ultimo segundo, e `expiresAt` igual ao `agora`
     */
    this.market = new MarketStore({
      agora: config.agora ?? (() => Date.now()),
    });

    /**
     * A GUILDA: o segundo estado compartilhado, depois do market.
     *
     * Mora no servidor e tem uma unica copia, pelo mesmo motivo do
     * market: duas instancias permitiriam a duas guildas com o mesmo
     * nome, ou a um jogador estar em duas ao mesmo tempo
     *
     * O relogio e o mesmo do market — o `config.agora` — e nao um
     * `Date.now()` solto. E o que faz os pontos por hora serem
     * testaveis: o testeanda o relogio em vez de esperar uma hora
     */
    this.guild = new GuildStore({
      agora: config.agora ?? (() => Date.now()),
    });

    /**
     * As duas filas do mercado que dependem de sessao viva.
     *
     * O `pagamentosPendentes` e dinheiro de vendedor OFFLINE: o item
     * ja foi vendido e o comprador ja pagou, entao o dinheiro e do
     * vendedor — apenas nao havia onde creditar. E o `devolucao`, que e
     * o item de um anuncio cancelado cuja mochila lotou no caminho
     *
     * As duas sao drenadas quando o jogador entra, em `entrar`, e as
     * duas apontam pela CHAVE DO DONO. Com o id de sessao elas nunca
     * casariam de volta: a sessao que vendeu ja foi destruida quando
     * o jogador saiu
     */
    this.pagamentosPendentes = [];
    this.pendentesDeDevolucao = [];

    // chave do dono -> sessao viva. Ver o `entrar`
    this.sessoesPorDono = new Map();

    // o primeiro jogador criado aqui e so um placeholder para o
    // motor ter uma sessao em foco no primeiro tick. ele e
    // descartado assim que o primeiro JOIN real chegar
    this.engine = new GameEngine(
      null,
      CHARACTER_CLASSES[0],
      null,
      {
        playerId: "p_placeholder",
        characterName: "Placeholder",
        marketStore: this.market,
        guildStore: this.guild,
      },
    );

    // o motor ja sabe montar o painel inteiro (inventario,
    // missoes, craft, numeros do personagem) porque o offline
    // desenhava na tela. aqui esse callback entrega no dono da
    // vez, entao nao existe uma segunda descricao do formato
    // que possa divergir da que a tela ja consome
    this.clienteAtual = null;

    this.engine.onSnapshot = (painel) => {
      if (!this.clienteAtual) return;

      this.clienteAtual.enviar(
        SERVER_EVENTS.PLAYER_STATE,
        painel,
      );
    };

    /**
     * O NUMERO DE DANO que sobe na tela de quem o provocou.
     *
     * O motor do servidor calcula o dano e cria o texto flutuante no
     * `EffectSystem` dele — que nunca e desenhado, porque este motor
     * foi criado com `canvas = null`. Sem este repasse, o numero
     * nasceria e morreria no servidor, e o cliente nunca veria um
     * unico numero de dano no online
     *
* Vai SO para quem atirou e para quem levou. O resto dos jogadores
     * nao tem interesse no golpe de ninguem, e o `DAMAGE` nao entra no
     * `SNAPSHOT` de proposito: um golpe e um instante, e o snapshot vai
     * para todo mundo a 20 Hz
     */
    this.engine.onDanoResolvido = (attacker, target, resultado) => {
      this.anunciarDano(attacker, target, resultado);
    };

/**
     * O mapa deste mundo.
     *
     * Sem argumento e o hub, o mesmo que o single player abre. Se o
     * servidor usasse outro sem querer, o jogador entraria no mundo
     * pelo calcamento e apareceria no vale, ou ao contrario
     */
    this.engine.setMap(getMap(mapId));

    this.placeholder = this.engine.world.session;

    this.intervalo = null;
    this.ultimoTick = 0;
    this.acumulado = 0;
    this.seq = 0;
    this.seqTick = 0;

    /**
     * Os personagens salvos, um arquivo por nome.
     *
     * O save mora no SERVIDOR e nao no navegador: o servidor e a
     * autoridade, e um save do lado do cliente seria apagado no
     * primeiro F5 e aceitaria nivel 9999 de boa
     *
     * Desligado por PADRAO, e o `server/src/index.js` e quem liga.
     * Com o padrao ligado, cada teste que sobe um servidor escreveria
     * no mesmo lugar com o mesmo nome de jogador: o "Ana" de um
     * arquivo de teste apareceria com o inventario do "Ana" do
     * arquivo anterior, e o teste passaria a depender da ordem em
     * que os arquivos rodam. Quem quer save pede save
     */
    this.saves =
      !persistencia
        ? null
        : criarCharacterStore(persistencia);

    /**
     * O mercado em disco, e o sinal de que ele mudou.
     *
     * O arquivo e um so para o servidor inteiro, ao contrario do
     * personagem: os anuncios de um jogador sao o produto que o outro
     * compra. `mercadoSujo` existe para nao escrever a cada tick — o
     * `expirarAnuncios` roda 20 vezes por segundo, e um mercado que
     * nao mudou nao tem nada a dizer
     */
    this.mercado =
      !persistencia ? null : criarMarketSave(persistencia);

    this.mercadoSujo = false;

    // o que estava no disco entra ANTES do primeiro jogador: um
    // anuncio carregado tem de estar na vitrine de quem entrar em
    // seguida, e nao aparecer sozinho na proxima expiracao
    this.restaurarMercado();

    // de quanto em quanto tempo o personagem de quem esta ONLINE vai
    // para o disco
    this.intervaloDeSave = null;
    this.ultimoSave = 0;

    /**
     * Quantos ticks seguidos falharam.
     *
     * Um tick que estoura nao pode derrubar o servidor: o
     * `setInterval` roda fora de qualquer `try`, e uma excecao la mata
     * o processo. Tres seguidos e o mundo esta em um estado que nao se
     * recupera sozinho, e o laco para em vez de queimar cpu
     */
    this.errosDeTick = 0;
  }

  /** quantas pessoas estao jogando agora (o placeholder nao conta) */
  get jogadores() {
    let total = 0;

    // pelas CHAVES: o valor do Map e um booleano de "conectado", e
    // nao o cliente. Contar os valores contaria quantos `true` tem o
    // mapa — sempre a mesma coisa, e sempre errada
    for (const client of this.clients.keys()) {
      if (client.joined) total += 1;
    }

    return total;
  }

  /**
   * Um socket virou conexao.
   *
   * Só registra. A sessao de jogador nasce no JOIN, e nao aqui: um
   * socket aberto sem nome e uma aba que recarregou a tela
   */
  conectar(client) {
    this.clients.set(client, true);
  }

  /**
   * O TEXTO que chegou no socket vira intencao.
   *
   * Cada pacote passa por tres portas antes de virar acao: o JSON
   * abre, a versao do protocolo bate, e o rate limit libera. O que
   * sobra vira comando, e o comando vira estado no motor
   *
   * Nao lanca. Um pacote quebrado e o cliente estragado, nao o mundo
   */
  receber(client, texto) {
    if (!client) return;

    // o limite e POR CONEXAO: um jogador disparando pacotes sem
    // parar nao pode acabar com o processing dos outros
    if (!client.limiter.permite()) {
      client.ultimoErro(REJECT.RATE_LIMIT);
      return;
    }

    /**
     * O TEXTO do socket vira comando validado.
     *
     * O `JSON.parse` fica aqui, e nao no `parseCommand`: aquele valida
     * o CONTEUDO, e o socket entrega bytes. Um JSON quebrado e o
     * cliente estragado (ou um ataque de dentro da rede), entao vira
     * recusa de mensagem invalida e o mundo nem percebe
     */
    let bruto;

    try {
      bruto = JSON.parse(texto);
    } catch {
      client.enviar(SERVER_EVENTS.REJECTED, {
        reason: REJECT.BAD_MESSAGE,
      });
      return;
    }

    /**
     * `parseCommand` ja devolve `{ ok: false, reason }` para o que
     * nao bate: versao de protocolo diferente, um `op` de painel que
     * nao existe, ou um numero que nao e numero. O motivo vem pronto
     * para o cliente, e nenhum dos casos derruba o mundo
     */
    const comando = parseCommand(bruto);

    if (!comando || comando.ok !== true) {
      client.enviar(SERVER_EVENTS.REJECTED, {
        reason: comando?.reason ?? REJECT.BAD_MESSAGE,
      });
      return;
    }

    const { type, payload = {} } = comando;

    /**
     * Tudo que mexe em estado de jogador precisa de sessao.
     *
     * Sem o JOIN, um INPUT entraria sem dono: o `withPlayer` nao
     * acharia ninguem e o movimento seria de ninguem
     */
    if (
      type !== CLIENT_COMMANDS.JOIN &&
      type !== CLIENT_COMMANDS.PING &&
      !client.joined
    ) {
      client.ultimoErro(REJECT.NOT_JOINED);
      return;
    }

    switch (type) {
      case CLIENT_COMMANDS.JOIN:
        this.entrar(client, payload);
        break;

      case CLIENT_COMMANDS.INPUT:
        this.aplicarIntencao(client, payload);
        break;

      case CLIENT_COMMANDS.ACTION:
        this.aplicarAcao(client, payload);
        break;

      case CLIENT_COMMANDS.PANEL:
        this.aplicarPainel(client, payload);
        break;

      case CLIENT_COMMANDS.PING:
        client.enviar(SERVER_EVENTS.PONG, {
          time: this.engine.world.time,
        });
        break;

      // um comando de uma versao futura cai aqui. recusar e melhor
      // do que executar "o mais parecido": aqui significa que o
      // protocolo e o servidor divergiram
      default:
        client.enviar(SERVER_EVENTS.REJECTED, {
          reason: REJECT.BAD_MESSAGE,
        });
    }

    /**
     * O painel volta na hora, sem esperar o proximo ciclo de 4Hz: o
     * jogador que equipou um item precisa ver o capacete aparecer, nao
     * 250ms depois
     *
     * O JOIN fica de fora de proposito. O WELCOME ja diz que o mundo
     * aceitou a entrada, e mandar o painel junto faria o cliente ter
     * um estado velho do instante em que a acao foi pedida: o que
     * ainda esta em jogo seria um pacote de meio segundo atras. Quem
     * traz o estado novo e o proximo tick
     */
    if (type !== CLIENT_COMMANDS.JOIN) {
      this.enviarPainel(client);
    }
  }

  /**
   * Devolve ao dono o item dos anuncios que venceram.
   *
   * `MarketStore.expirar` REMOVE o anuncio e devolve a lista. O item
   * nao volta sozinho: ele mora no anuncio, e quem o pende de volta na
   * mochila do dono e este metodo
   *
   * Sem ele o vendedor anunciava, o prazo vencia, e o item ficava
   * guardado no anuncio removido — um item que ninguem tinha, ninguem
   * via e ninguem podia mais usar
   *
   * E chamado a cada tick, e nao num laco de relogio: o
   * `MarketStore.expirar` e lazy de proposito, e o tick e o unico
   * lugar que ja roda sem parar
   */
  expirarAnuncios() {
    const expirados = this.market.expirar();

    for (const anuncio of expirados) {
      const dono = this.sessaoDoDono(anuncio.sellerKey);

      if (!dono) {
        // o vendedor saiu e a sessao morreu: o item espera por ele
        this.pendentesDeDevolucao.push({
          ownerKey: anuncio.sellerKey,
          itemId: anuncio.itemId,
          rarity: anuncio.rarity,
          count: anuncio.count,
        });

        continue;
      }

      const devolvido = dono.inventory.add(
        anuncio.itemId,
        anuncio.count,
        anuncio.rarity,
      );

      if (devolvido.added < anuncio.count) {
        // a mochila do dono lotou entre o anuncio e a expiracao
        this.pendentesDeDevolucao.push({
          ownerKey: anuncio.sellerKey,
          itemId: anuncio.itemId,
          rarity: anuncio.rarity,
          count: anuncio.count - devolvido.added,
        });

        continue;
      }

      this.marcarMercadoSujo();

      this.avisoDoDono(
        dono,
        `Seu anuncio de ${describeAnuncioItem(anuncio)} venceu e o item voltou.`,
      );
    }

    /**
     * algo saiu do ar, com ou sem sessao viva do dono: o disco esta
     * com uma vitrine que ninguem mais ve. um anuncio que VENCE sem
     * gravar volta inteiro no proximo boot, e o item nunca acha o
     * dono
     */
    if (expirados.length > 0) this.marcarMercadoSujo();

    return expirados.length;
  }

  /**
   * A sessao de um jogador pelo ID, ou `null`.
   *
   * Serve para o MUNDO (quem esta onde, quem atira em quem), onde o
   * id de sessao e a identidade de verdade
   */
  sessaoDe(playerId) {
    return this.engine.world.players.get(playerId) ?? null;
  }

  /**
   * O CLIENTE dono de uma entidade de jogador, ou `null`.
   *
   * `sessoesPorDono` guarda a sessao pelo DONO, que sobrevive a
   * reconexao, e nao guarda quem esta com o socket aberto agora. Para
   * falar com um jogador e preciso das duas coisas: a sessao para saber
   * que e ele, e o cliente para ter onde escrever
   *
   * O parametro e a ENTIDADE (`sessao.player`), e nao a sessao: e assim
   * que o `DamageSystem` entrega o alvo, e comparar com a sessao
   * erraria o tipo e devolveria `null` para todo golpe
   *
   * Percorre os `clients` porque sao poucos. Um servidor com o
   * suficiente de gente para o custo importar usaria um indice, e nao
   * vale o preco de um indice por numero de dano
   */
  clienteDoJogador(jogador) {
    if (!jogador) return null;

    for (const client of this.clients.keys()) {
      if (client.session?.player === jogador) return client;
    }

    return null;
  }

  /**
   * Manda o numero de dano para QUEM PRECISA dele.
   *
   * Sao dois: o que atirou e o que levou. O jogador ve o numero dos
   * proprios golpes e o dano que ele mesmo apanhou, e nao o dos outros.
   * Com lots de gente no mapa, o numero alheio enche a tela sem
   * informar nada — e o jogador nao consegue ver o proprio HP cair
   * entre tres numeros que nao tem nada a ver com ele
   *
   * O `missed` vai tambem: um golpe que passou batido e a informacao
   * mais importante do ponto de vista de quem errou. Sem ele, o
   * jogador ve o mob sem piscar e nao descobre se o golpe nao saiu ou
   * simplesmente nao chegou
   */
  anunciarDano(attacker, target, resultado) {
    if (!resultado) return;

    const payload = {
      /**
       * O `id` e o que o cliente usa para achar ONDE desenhar. O de
       * um mob e o proprio `id` dele, que vem no `SNAPSHOT`. O da
       * vitima jogador vem com `alvoSouJogador`, e o cliente nem
       * precisa procurar: o dano nele e desenhado em cima de quem o
       * jogador esta vendo, que e ele mesmo
       */
      alvoId: target?.id ?? null,
      alvoSouJogador: Boolean(target?.isPlayer),
      amount: resultado.amount,
      critical: resultado.critical,
      missed: resultado.missed,
      damageType: resultado.damageType,
    };

    const jaAvisados = new Set();

    for (const pessoa of [attacker, target]) {
      if (!pessoa?.isPlayer) continue;

      /**
       * O mesmo jogador pode ser atacante e vitima ao mesmo tempo, num
       * golpe refletido ou num auto-ataque em area. O `Set` garante
       * um envio so, e sem ele o mesmo golpe apareceria duas vezes
       * empilhadas no mesmo ponto da tela
       */
      if (jaAvisados.has(pessoa)) continue;

      jaAvisados.add(pessoa);

      this.clienteDoJogador(pessoa)?.enviar(
        SERVER_EVENTS.DAMAGE,
        payload,
      );
    }
  }

  /**
   * A sessao viva de uma chave de dono, ou `null`.
   *
   * E o caminho do mercado para achar o vendedor de um anuncio. Um
   * anuncio sobrevive ao dono sair, entao `sessaoDe` (que busca o id de
   * sessao, unico so nesta conexao) nao serviria: o pagamento de uma
   * venda nunca encontraria a sessao nova do mesmo personagem
   */
  sessaoDoDono(donoKey) {
    if (!donoKey) return null;

    return this.sessoesPorDono.get(donoKey) ?? null;
  }

  /**
   * Le o mercado do disco.
   *
   * Nao lanca e nao exige nada: sem arquivo, com JSON quebrado ou com
   * `versao` de outra forma, o mercado comeca vazio. Perder a vitrine
   * e ruim; derrubar o servidor no boot porque alguem editou o arquivo
   * na mao e pior
   *
   * O que entra e o que passa pelo filtro do `MarketSave`: um anuncio
   * pela metade no arquivo voltaria como um item que pertence a
   * ninguem, e uma devolucao sem dono ficaria esperando para sempre
   */
  restaurarMercado() {
    if (!this.mercado) return false;

    const bruto = this.mercado.carregar();

    if (!bruto || typeof bruto !== "object") return false;

    if (Number(bruto.versao ?? 0) > MERCADO_VERSAO) {
      /**
       * Arquivo de uma versao mais nova que este servidor.
       *
       * Carregar assim seria ler um formato que este codigo nao
       * conhece, e um campo novo seria lido como se fosse o que este
       * servidor entende. O mercado comeca vazio e o arquivo fica
       * intacto para o servidor que entende o formato
       */
      return false;
    }

    this.market.fromSave(bruto.market);

    this.pagamentosPendentes = pagamentosLegiveis(
      bruto.pagamentosPendentes,
    );

    this.pendentesDeDevolucao = devolucoesLegiveis(
      bruto.pendentesDeDevolucao,
    );

    return true;
  }

  /**
   * O mercado mudou, e o disco esta atrasado.
   *
   * So um sinalizador: quem escreve e o `guardarMercado`, no
   * intervalo de gravacao e no `stop`. Marcar e gritar de imediato
   * resolveria o problema da queda, mas cada anuncio, compra e
   * cancelamento viraria uma escrita de arquivo — e a expiracao roda a
   * cada tick
   */
  marcarMercadoSujo() {
    if (!this.mercado) return;

    this.mercadoSujo = true;
  }

  /**
   * Grava o mercado, se algo mudou.
   *
   * `true` quando escreveu. `false` quando a persistencia esta
   * desligada, quando nada mudou, ou quando o disco falhou — e nenhum
   * dos tres e motivo para derrubar o servidor no meio de uma venda
   */
  guardarMercado() {
    if (!this.mercado || !this.mercadoSujo) return false;

    const gravado = this.mercado.salvar({
      market: this.market.toSave(),
      pagamentosPendentes: this.pagamentosPendentes,
      pendentesDeDevolucao: this.pendentesDeDevolucao,
    });

    // so o disco decide quando o mercado esta em dia. se a escrita
    // falhou, o sinalizador fica aceso e a proxima tentativa repete
    if (gravado) this.mercadoSujo = false;

    return gravado;
  }

  /**
   * O aviso de tela de UMA sessao.
   *
   * O `showMessage` do motor escreve na sessao em FOCO, entao ele
   * resolveria o caso do jogador que fez a acao — e nao o do
   * vendedor, que esta em outra sessao. Aqui o texto vai direto no
   * dono, com o mesmo relogio de 2.5s que o motor usa
   */
  avisoDoDono(sessao, texto, bad = false) {
    if (!sessao) return;

    sessao.message = { text: texto, bad };
    sessao.messageRemaining = 4;
    sessao.messageTick = this.engine.world.time;
  }

  /**
   * Aplica um pedido do mercado e mostra o resultado na tela de quem
   * pediu.
   *
   * O `motivo` e o que o jogador le: cada recusa tem uma frase, e um
   * "nao deu" generico obrigaria o jogador a deduzir se foi preco,
   * espaco ou dinheiro
   */
  resultadoDoMarket(sessao, resultado, motivo) {
    if (resultado.ok) {
      this.avisoDoDono(sessao, motivo);

      return true;
    }

    this.avisoDoDono(
      sessao,
      this.motivoDoMarket(resultado.reason),
      true,
    );

    return false;
  }

  /** o texto de cada recusa, na lingua do jogador */
  motivoDoMarket(reason) {
    const textos = {
      [MARKET_RESULT.SEM_ITEM]: "Voce nao tem esse item.",
      [MARKET_RESULT.PRECO]: `Preco invalido. Use entre ${PRECO_MINIMO} e ${PRECO_MAXIMO}.`,
      [MARKET_RESULT.QUANTIDADE]: "Quantidade invalida.",
      [MARKET_RESULT.LIMITE]: `Voce ja tem ${ANUNCIOS_MAXIMOS} anuncios abertos.`,
      [MARKET_RESULT.SEM_ANUNCIO]: "Esse anuncio nao existe mais.",
      [MARKET_RESULT.PROPRIO]: "Voce nao pode comprar o seu proprio anuncio.",
      [MARKET_RESULT.MOEDAS]: "Moedas insuficientes.",
      [MARKET_RESULT.ESPACO]: "A mochila esta cheia.",
    };

    return textos[reason] ?? "Nao deu para fazer no mercado.";
  }

  /**
   * ANUNCIAR um item.
   *
   * A ordem e o que importa e nao e uma escolha: o item SAI da mochila
   * do vendedor ANTES de o anuncio existir, e o `uid` do pedido e o
   * que diz qual peca e. Um `uid` forjado aponta para uma peca que
   * nao existe e o pedido volta com `SEM_ITEM`, sem tocar em nada
   */
  listarNoMarket(sessao, pedido) {
    const stack = sessao.inventory.findByUid(pedido.uid);

    if (!stack || !podeListar(stack.itemId)) {
      this.resultadoDoMarket(
        sessao,
        { ok: false, reason: MARKET_RESULT.SEM_ITEM },
        null,
      );

      return;
    }

    /**
     * A quantidade anunciada, conferida contra a mochila.
     *
     * O cliente PEDE uma quantidade, e o servidor decide: um `count`
     * forjado acima do que o vendedor tem vira a quantidade que ele tem,
     * e nunca um numero maior. Sem este corte, o `takeUid` cortaria
     * sozinho — mas o painel do jogador prometeria um lote que ele
     * receberia menor, e o preco do anuncio e do LOTE inteiro
     *
     * Uma peca que NAO empilha e sempre 1, ignorando o pedido: um arco
     * raro nao vira "3 arcos" porque o cliente mandou 3. E o painel nem
     * mostra o campo para esses itens
     *
     * Sem `count` no pedido (cliente antigo) vale a pilha inteira: e o
     * que o mercado fazia antes de existir a quantidade
     */
    const empilha = isStackable(getItem(stack.itemId));

    const pedidoCount = Number(pedido.count);

    const total = !empilha
      ? 1
      : Math.min(
          stack.count,
          Math.max(
            1,
            Number.isFinite(pedidoCount) && pedidoCount >= 1
              ? Math.floor(pedidoCount)
              : stack.count,
          ),
        );

    // a peca ja esta com o vendedor: o `uid` aponta para ela
    const resultado = this.market.list({
      sellerKey: sessao.donoKey,
      sellerName: sessao.name,
      uid: pedido.uid,
      price: pedido.price,
    });

    if (!resultado.ok) {
      this.resultadoDoMarket(sessao, resultado, null);

      return;
    }

    const tomado = sessao.inventory.takeUid(
      pedido.uid,
      total,
    );

    if (!tomado) {
      // o item sumiu entre o `findByUid` e aqui: desfaz o anuncio em
      // vez de deixar um anuncio de um item que o vendedor tem
      this.market.cancel(
        resultado.listing.id,
        sessao.donoKey,
      );

      this.resultadoDoMarket(
        sessao,
        { ok: false, reason: MARKET_RESULT.SEM_ITEM },
        null,
      );

      return;
    }

    if (!this.market.fill(resultado.listing, tomado)) {
      // o `fill` recusou (item fora do catalogo): devolve a peca
      this.market.cancel(
        resultado.listing.id,
        sessao.donoKey,
      );

      sessao.inventory.add(
        tomado.itemId,
        tomado.count,
        tomado.rarity,
      );

      this.resultadoDoMarket(
        sessao,
        { ok: false, reason: MARKET_RESULT.SEM_ITEM },
        null,
      );

      return;
    }

    this.marcarMercadoSujo();

    this.resultadoDoMarket(
      sessao,
      { ok: true },
      `${describeAnuncioItem(resultado.listing)} anunciado por ${resultado.listing.price}.`,
    );
  }

  /**
   * CANCELAR um anuncio.
   *
   * O `MarketStore.cancel` ja recusa quem nao e o dono, entao um
   * jogador nao cancela o anuncio de outro. E o `uid` do anuncio e o
   * que devolve a peca ao dono
   */
  cancelarNoMarket(sessao, pedido) {
    const resultado = this.market.cancel(
      pedido.listingId,
      sessao.donoKey,
    );

    if (!resultado.ok) {
      this.resultadoDoMarket(sessao, resultado, null);

      return;
    }

    const devolvido = sessao.inventory.add(
      resultado.listing.itemId,
      resultado.listing.count,
      resultado.listing.rarity,
    );

    if (devolvido.added < resultado.listing.count) {
      // a mochila lotou entre o anuncio e o cancelamento: o item
      // fica guardado em `pendentesDeDevolucao` em vez de sumir
      this.pendentesDeDevolucao.push({
        ownerKey: sessao.donoKey,
        itemId: resultado.listing.itemId,
        rarity: resultado.listing.rarity,
        count: resultado.listing.count - devolvido.added,
      });
    }

    this.marcarMercadoSujo();

    this.resultadoDoMarket(
      sessao,
      { ok: true },
      "Anuncio cancelado. O item voltou.",
    );
  }

  /**
   * COMPRAR um anuncio.
   *
   * A ordem das tres checagens antes de qualquer transferencia:
   * saldo do comprador, espaco na mochila do comprador, e pagamento ao
   * vendedor. Qualquer uma delas falha ANTES de o item sair do
   * vendedor — um `takeUid` antes do `spendCoins` daria o item de
   * graca, e um `spendCoins` antes do espaco daria o dinheiro sem o
   * item
   */
  comprarNoMarket(sessao, pedido) {
    const anuncio = this.market.get(pedido.listingId);

    if (!anuncio || !anuncio.itemId) {
      this.resultadoDoMarket(
        sessao,
        { ok: false, reason: MARKET_RESULT.SEM_ANUNCIO },
        null,
      );

      return;
    }

    if (anuncio.sellerKey === sessao.donoKey) {
      this.resultadoDoMarket(
        sessao,
        { ok: false, reason: MARKET_RESULT.PROPRIO },
        null,
      );

      return;
    }

    const preco = anuncio.price;

    if (!sessao.inventory.spendCoins(preco)) {
      this.resultadoDoMarket(
        sessao,
        { ok: false, reason: MARKET_RESULT.MOEDAS },
        null,
      );

      return;
    }

    const recebido = sessao.inventory.add(
      anuncio.itemId,
      anuncio.count,
      anuncio.rarity,
    );

    if (recebido.added < anuncio.count) {
      // a mochila nao comportou: o dinheiro volta, o anuncio continua
      sessao.inventory.addCoins(preco);

      this.resultadoDoMarket(
        sessao,
        { ok: false, reason: MARKET_RESULT.ESPACO },
        null,
      );

      return;
    }

    // so agora o anuncio sai do ar
    this.market.buy(anuncio.id, sessao.donoKey);

    /**
     * O vendedor recebe, se ainda estiver conectado.
     *
     * Online ele esta em `sessoesPorDono` e o dinheiro entra na hora.
     * Offline nao ha sessao para Creditar, entao o pagamento fica
     * pendente e e pago quando ele voltar — e nao e uma segunda
     * origem da verdade: o valor ja foi decidido no `buy`
     */
    const vendedor = this.sessaoDoDono(anuncio.sellerKey);

    if (vendedor) {
      vendedor.inventory.addCoins(preco);

      this.avisoDoDono(
        vendedor,
        `Vendeu ${describeAnuncioItem(anuncio)} por ${preco}.`,
      );
    } else {
      /**
       * O dinheiro fica aqui, e nao e uma segunda venda.
       *
       * O `market.buy` acima JA chamou `registrarVenda` — o historico
       * tem uma entrada so. Chamar de novo duplicaria a linha, e o
       * jogador veria a mesma venda duas vezes no historico
       */
      this.pagamentosPendentes.push({
        ownerKey: anuncio.sellerKey,
        coins: preco,
      });
    }

    this.marcarMercadoSujo();

    this.resultadoDoMarket(
      sessao,
      { ok: true },
      `Comprou ${describeAnuncioItem(anuncio)} por ${preco}.`,
    );
  }

  /**
   * ENTRA no mundo.
   *
   * O nome passa pelo mesmo validador da tela de selecao. O cliente ja
   * bloqueou, mas o cliente nao e autoridade: um script malicioso
   * ignora o formulario
   */
  entrar(client, { name, classId } = {}) {
    if (client.joined) return;

    const checagem = validateName(name);

    if (!checagem.ok) {
      client.enviar(SERVER_EVENTS.REJECTED, {
        reason: REJECT.BAD_NAME,
        detail: checagem.reason,
      });
      return;
    }

    /**
     * Dois "Ana" no mesmo mapa e confusao garantida: o loot vai por id
     * de sessao, mas as pessoas veem o nome. E o save e por nome, entao
     * o segundo sobrescreveria o arquivo do primeiro
     */
    for (const outro of this.clients.keys()) {
      if (outro === client || !outro.joined) continue;

      const sessaoDoOutro = outro.session;

      if (
        sessaoDoOutro &&
        nameKey(sessaoDoOutro.name) === nameKey(checagem.value)
      ) {
        client.enviar(SERVER_EVENTS.REJECTED, {
          reason: REJECT.NAME_TAKEN,
        });
        return;
      }
    }

    const classe = CHARACTER_CLASSES.find(
      (c) => c.id === classId,
    );

    if (!classe) {
      client.enviar(SERVER_EVENTS.REJECTED, {
        reason: REJECT.UNKNOWN_CLASS,
      });
      return;
    }

    if (this.jogadores >= this.config.maxPlayers) {
      client.enviar(SERVER_EVENTS.REJECTED, {
        reason: REJECT.PLAYER_FULL,
      });
      return;
    }

    const id = `p_${randomUUID().slice(0, 8)}`;

    /**
     * A chave do DONO, e nao o id da sessao.
     *
     * O `id` acima muda a cada entrada: ele serve para o mundo (quem
     * esta onde, quem atira em quem) e e descartado quando a conexao
     * cai. O mercado precisa do contrario — um anuncio continua valendo
     * com o jogador fora, e o dinheiro de uma venda offline tem de
     * encontrar o dono quando ele volta. Guardados pelo `id`, os dois
     * casos nunca mais casariam: o pagamento ficaria numa fila para uma
     * sessao que nao existe mais
     *
     * A chave do nome e ESTAVEL entre entradas e e UNICA entre jogadores
     * (o servidor recusa dois nomes iguais, e o `CharacterStore` usa a
     * mesma chave como nome de arquivo)
     */
    const donoKey = nameKey(checagem.value);

    /**
     * O personagem guardado, se este nome ja jogou.
     *
     * A classe e parte da IDENTIDADE do personagem, nao uma escolha
     * da tela. Se "Teste" foi criado como Arbalist e volta como
     * Warrior, as duas coisas nao podem ser verdade ao mesmo tempo:
     * aceitar o Warrior gravado por cima apagaria o Arbalist inteiro,
     * nivel, ouro e missoes, sem ninguem ter pedido isso. Recusar e o
     * unico jeito de nao perder nada
     */
    const salvo = this.saves?.carregar(checagem.value) ?? null;

    if (salvo && isReadableSave(salvo)) {
      const classeDoSave = saveClassOf(salvo);

      if (classeDoSave && classeDoSave !== classe.id) {
        client.enviar(SERVER_EVENTS.REJECTED, {
          reason: REJECT.CHARACTER_CLASS_MISMATCH,
        });
        return;
      }
    }

    client.session = this.engine.addPlayer(
      createPlayerSession(classe, {
        id,
        name: checagem.value,

        // a chave do dono viaja na sessao: e ela que o mercado usa
        // para saber de quem e o anuncio, mesmo depois de reconectar
        donoKey,

        // o spawn vem do mapa, igual no single player, para nao
        // nascer dentro de um mob
        ...this.entradaNoMapa(),
      }),
    );

    /**
     * A sessao viva de cada chave de dono.
     *
     * E um indice para achar "a sessao do Ana" sem varrer o mundo, e
     * e o que permite pagar um vendedor OFFLINE na hora em que ele
     * entra. Uma segunda entrada do MESMO nome troca a referencia: o
     * `id` no mundo continua sendo dois jogadores distintos, mas o
     * dono e um so, e o mercado e do personagem
     */
    this.sessoesPorDono.set(donoKey, client.session);

    // O save e aplicado DEPOIS de a sessao existir e ANTES do
    // jogador receber o primeiro pacote. Se o Applying viesse depois
    // do WELCOME, o painel mostraria um personagem nivel 1 e o
    // progresso apareceria um segundo depois, como se fosse bug
    if (salvo && isReadableSave(salvo)) {
      this.restaurar(client.session, salvo);
    } else {
      /**
       * Personagem NOVO tambem precisa dos stats derivados.
       *
       * O `restaurar` acima ja faz isso, e sem uma chamada igual aqui
       * um jogador que acabou de criar o personagem entrava com os
       * numeros crus da classe — sem o crescimento do nivel 1. O
       * efeito nao era so no combate: o painel de status mostra a
       * coluna `Bonus` como `total - base`, e um total MENOR que a
       * base produzia um bonus negativo na tela logo no primeiro
       * minuto de jogo
       */
      this.engine.withPlayer(client.session.id, () => {
        this.engine.applyEquipment();
      });
    }

    client.joined = true;

    // o placeholder foi criado so para o motor ter uma sessao em
    // foco no primeiro tick. assim que existe um jogador de
    // verdade, ele sai: senao ele continuaria no snapshot com
    // vida cheia, e todo mundo veria um personagem fantasma
    // parado no mapa
    if (this.placeholder) {
      this.engine.removePlayer(this.placeholder.id);
      this.placeholder = null;
    }

    this.engine.focusPlayer(id);

    /**
     * Paga o que ficou pendido enquanto este jogador estava fora.
     *
     * O dinheiro de um item vendido offline e o item de um anuncio
     * cancelado com a mochila lotada. As duas filas vivem no servidor
     * desde a venda e so tem sessao onde cair quando ele volta — e o
     * pagamento de uma venda e dinheiro DELE, entao o dinheiro nao
     * pode esperar mais
     *
     * O filtro e pela CHAVE DO DONO, nunca pelo id de sessao: quem
     * vendou foi uma sessao que nao existe mais, e e este o caso que
     * esta funcao existe para pagar
     */
    const sessao = client.session;

    let pendentes = 0;

    this.pagamentosPendentes =
      this.pagamentosPendentes.filter((pagamento) => {
        if (pagamento.ownerKey !== donoKey) return true;

        sessao.inventory.addCoins(pagamento.coins);
        pendentes += 1;

        return false;
      });

    this.pendentesDeDevolucao =
      this.pendentesDeDevolucao.flatMap((pendente) => {
        if (pendente.ownerKey !== donoKey) return [pendente];

        const devolvido = sessao.inventory.add(
          pendente.itemId,
          pendente.count,
          pendente.rarity,
        );

        pendentes += devolvido.added;

        const resto = pendente.count - devolvido.added;

        /**
         * A fila guarda SO o que nao coube, e nao a entrada inteira.
         *
         * Deixar a entrada como estava, para a proxima entrada tentar
         * de novo, creditaria o item DE NOVO: a mochila ja tem a
         * peca que coube, e a fila traria a quantidade completa outra
         * vez. Um `filter` que devolvesse `added >= count` — o
         * inverso — apagava a fila justamente no caso em que a
         * devolucao tinha dado certo, que e o caso comum
         */
        return resto > 0
          ? [{ ...pendente, count: resto }]
          : [];
      });

    if (pendentes > 0) {
      // as filas do mercado mudaram de tamanho: o que sobrou no disco
      // e o que sobrou aqui
      this.marcarMercadoSujo();

      this.avisoDoDono(
        sessao,
        `Recebeu ${pendentes} item(ns) pendente(s) do mercado.`,
      );
    }

    client.enviar(SERVER_EVENTS.WELCOME, {
      playerId: id,
      protocolVersion: PROTOCOL_VERSION,
      classId: classe.id,
      tickRate: this.config.tickRate,
    });

    this.anunciar(id, true);
  }

  /**
   * A intencao do cliente vira movimento no motor.
   *
   * Repare que nao ha posicao no pacote: o cliente diz "quero ir
   * para a direita" e o servidor decide o quanto. E o que impede
   * alguem de enviar `x: 9999` e teleportar
   */
  aplicarIntencao(client, { seq, moveX, moveY, aimX, aimY } = {}) {
    // pacote perdido ou fora de ordem: uma intencao antiga
    // sobrescreveria a nova e o jogador andaria para tras
    if (typeof seq === "number" && seq <= client.session.intent.seq) {
      return;
    }

    Object.assign(client.session.intent, {
      seq: Number(seq ?? 0),
      moveX,
      moveY,
      aimX,
      aimY,
    });

    // A mira precisa estar no ALVO, e nao onde o cliente apontou na
    // tela. o servidor nao sabe onde fica o mouse de ninguem, e a
    // resolucao do cliente nao e a de todos: sem isto, o golpe sairia
    // na direcao do ultimo movimento
    const sessao = client.session;

    sessao.input.pointer.x =
      sessao.player.x + aimX * DISTANCIA_DE_MIRA;
    sessao.input.pointer.y =
      sessao.player.y + aimY * DISTANCIA_DE_MIRA;
    sessao.input.pointer.inside = true;
  }

  /**
   * Um comando de painel: tudo que mexe no estado privado.
   *
   * Todas as operacoes sao do MOTOR, dentro do `withPlayer`: o
   * equipamento, o craft, a colecao e o mercado tem uma unica
   * implementacao, e ela e a mesma da tela offline
   *
   * O que o cliente manda e sempre um PEDIDO com nome de item ou id
   * de peca. O preco, a quantidade e a posse sao lidos do servidor
   */
  /**
 * ATRAVESSAR UM PORTAL.
 *
 * O pedido traz so o `portalId`. O destino NAO vem do cliente, e a
 * posicao tambem nao: os dois sao lidos do mundo, aqui no servidor
 *
 * Sao tres recusas, e cada uma fecha uma porta diferente:
 *
 * 1. **o jogador nao esta em cima do portal.** Sem esta conferida,
 *    qualquer jogador Could teleportar para o vale sem nunca andar ate
 *    o portal — e o portal seria decoracao
 * 2. **o portal nao tem destino.** Os dois do vale ainda nao tem, e
 *    atravessar um enfeite nao tem para onde ir
 * 3. **o destino nao existe no registro.** Um `destino` com id errado
 *    deixaria o mundo sem mapa, que e pior do que nao fazer nada
 *
 * Nenhuma delas derruba o servidor: um portal recusado e um portal que
 * nao fez nada
 */
travessarPortal(portalId) {
  if (!portalId) return false;

  const emCima = this.engine.portalSobOsPes();

  if (!emCima) return false;

  // o id pedido tem que ser o portal em que o jogador esta. Aceitar
  // qualquer id leto o jogador atravessar pelo portal do pantano
  // estando em cima do da floresta
if (emCima.portal.id !== portalId) return false;

    /**
     * A CHEGADA e resolvida pelo motor, e nao pelo servidor.
     *
     * O motor e quem sabe onde esta cada portal, e o servidor usa o
     * motor para tudo. Reescrever a conta aqui criaria dois lugares que
     * podem divergir: um portal movido no `GameEngine` e o mesmo portal
     * no `GameServer` nasceriam em pontos diferentes
     */
    this.engine.travessarPortal();

    return true;
  }

/**
 * As OPERACOES DE GUILDA, pelo mesmo caminho das outras.
 *
 * Todas passam por `operarGuilda`, que faz tres coisas antes de chamar
 * o store:
 *
 * 1. **recusa sem store.** No single player nao ha guilda e nao ha o que
 *   painel mostrar; um pedido aqui seria um clique sem destino
 * 2. **chama o store.** Quem decide papel, limite e preco do talento e
 *    o `GuildStore`. Este arquivo nao reescreve nenhuma regra
 * 3. **devolve o motivo na falha.** O painel mostra o que deu errado, e
 *    uma recusa silenciosa seria indistinguivel de um botao quebrado
 *
 * O `alcance` recebe o store e o pedido, e devolve o resultado que o
 * store devolveu. Passar a acao como funcao e o que mantem o painel
 * sincronizado sem o `aplicarPainel` saber de cada caso
 */
  operarGuilda(sessao, pedido, alcance) {
  if (!this.guild) return false;

  const resultado = alcance(this.guild, pedido);

  if (resultado && resultado.ok === false) {
    this.mensagemDeGuilda(resultado.motivo);

    return false;
  }

  // qualquer mudanca na guilda mexe nos stats de quem esta nela, porque
  // o bonus dos talentos entra no `applyEquipment`
  this.engine.applyEquipment();

  return true;
}

/**
 * FUNDA uma guilda, e cobra os dez milhoes.
 *
 * Fica fora do `operarGuilda` porque so esta operacao toca no dinheiro:
 * a taxa e a unica coisa no jogo que um jogador paga para NAO ter
 * coisa nenhuma, e um caminho generico de "toda operacao cobra" teria
 * descontado tambem do talent, do pedido e da saida
 *
 * A ordem e cobrar, criar, e ESTORNAR se a criacao recusar. O caminho
 * inverso — criar e so depois descontar — criaria guilda de graça
 * quando o `spendCoins` falhasse. E o estorno existe pelo mesmo
 * motivo: um nome ja usado, ou um jogador que ja tem guilda, nao pode
 * custar dez milhoes
 *
 * O dinheiro vai para o COFRE da guilda recem-criada. E patrimonio
 * coletivo: e o que uma guilda recem nascida comeca com algo em vez de
 * vazia
 */
criarGuilda(sessao, pedido) {
  if (!this.guild) return false;

  const moedas = sessao.inventory.coins;

  if (moedas < GUILD_CRIACAO_CUSTO) {
    this.mensagemDeGuilda("moedasInsuficientes");

    return false;
  }

  sessao.inventory.spendCoins(GUILD_CRIACAO_CUSTO);

  const resultado = this.guild.criar({
    nome: pedido.guildName,
    tag: pedido.guildTag,
    liderId: chaveDaSessao(sessao),
    liderNome: sessao.name,
  });

  if (!resultado.ok) {
    // o store recusou: o dinheiro volta inteiro
    sessao.inventory.addCoins(GUILD_CRIACAO_CUSTO);

    this.mensagemDeGuilda(resultado.motivo);

    return false;
  }

  /**
   * O COFRE recem-criado ja nasce com o valor da taxa.
   *
   * `addItem` e o metodo do cofre, nao o da mochila: o dinheiro fundou
   * um patrimonio coletivo e nao tem como voltar para o bolso de quem
   * pagou
   */
  this.guild.adicionarAoCofre(resultado.guilda.id, {
    coins: GUILD_CRIACAO_CUSTO,
  });

  this.engine.applyEquipment();

  return true;
}

/** a busca nao muda nada: devolve a lista e nao reclama de motivo */

  buscarGuilda(sessao, pedido) {
  if (!this.guild) return false;

  /**
   * A lista em CRU, e nao o `snapshotPara` de cada guilda.
   *
   * O painel de busca mostra nome, tag e quantos membros tem. Montar
   * a vista completa de cada guilda daria ao jogador os pedidos e o
   * cofre de guilda nenhuma e que ele nao pertence
   */
  this.engine.searchResults = this.guild.buscar(
    pedido.guildName ?? "",
  ).map((guilda) => ({
    id: guilda.id,
    nome: guilda.nome,
    tag: guilda.tag,
    membros: guilda.membros.size,
    membrosMax: GUILD_MEMBROS_MAX,
    cheia: guilda.membros.size >= GUILD_MEMBROS_MAX,
  }));

  return true;
}

/**
 * Destrava um talento, e e o unico caso que GASTA pontos.
 *
 * O gasto e aqui e nao no store: os pontos moram na sessao e o store
 * nao sabe o saldo. Quem subtrai e o servidor, depois da recusa
 */
  destravarTalent(sessao, pedido) {
  if (!this.guild) return false;

  const guilda = this.guild.guildaDoJogador(chaveDaSessao(sessao));

  if (!guilda) {
    this.mensagemDeGuilda("semGuilda");

    return false;
  }

  const resultado = this.guild.destravarTalent(
    chaveDaSessao(sessao),
    guilda.id,
    pedido.talentId,
    sessao.guilda?.pontos ?? 0,
  );

  if (!resultado.ok) {
    this.mensagemDeGuilda(resultado.motivo);

    return false;
  }

  sessao.guilda = {
    pontos: (sessao.guilda?.pontos ?? 0) - resultado.custo,
    ultimoPontoEm: sessao.guilda?.ultimoPontoEm ?? null,
  };

  this.engine.applyEquipment();

  return true;
}

/** o cofre, que so a diretoria abre */
  mexerNoCofre(sessao, pedido) {
  if (!this.guild) return false;

  const guilda = this.guild.guildaDoJogador(chaveDaSessao(sessao));

  if (!guilda) {
    this.mensagemDeGuilda("semGuilda");

    return false;
  }

  const resultado = this.guild.mexerNoCofre(
    chaveDaSessao(sessao),
    guilda.id,
    pedido.cofreAcao,
  );

  if (!resultado.ok) {
    this.mensagemDeGuilda(resultado.motivo);

    return false;
  }

  return true;
}

/**
 * O MOTIVO de uma recusa, em portugues.
 *
 * O store devolve codigos e nao frases porque o mesmo motivo aparece
 * em telas diferentes — recusa aqui e aviso no painel. Traduzir num
 * lugar so evita as duas metades divergirem
 */
  mensagemDeGuilda(motivo) {
  this.engine.showMessage(mensagemDeGuilda(motivo));
}

  aplicarPainel(client, pedido = {}) {
    const sessao = client.session;

    if (!sessao) return;

    const { op } = pedido;

    /**
     * `withPlayer` com o ID DA SESSAO, e nao com a chave.
     *
     * `world.players` e indexado pelo id da sessao (`p_<uuid>`), e nao
     * pela `donoKey`. Passar a chave aqui nao focalizava ninguem:
     * `world.player` ficava `null` e o `applyEquipment` — que a
     * travessia de portal e toda operacao de guilda chama — estourava em
     * `player.definition`
     *
     * A chave entra so dentro do callback, onde o store a usa. Sao duas
     * coisas diferentes com nomes parecidos, e confundi-las derruba o
     * servidor no primeiro pedido
     */
    this.engine.withPlayer(sessao.id, () => {
      switch (op) {
        case PANEL_OPS.EQUIP:
          this.engine.equipItem(pedido.uid, pedido.slotId);
          break;

        case PANEL_OPS.UNEQUIP:
          this.engine.unequipItem(pedido.slotId);
          break;

        case PANEL_OPS.DISCARD:
          /**
           * Descartar sai pelo `uid` da pilha. A peca VESTIDA tem
           * `uid` proprio no equipamento, e um pedido so com `slotId`
           * descartaria a peca errada se os dois existissem no mesmo
           * pacote — por isso o slot so e lido quando nao veio `uid`
           */
          if (pedido.uid) this.engine.discardItem(pedido.uid);
          else if (pedido.slotId) {
            this.engine.discardEquipped(pedido.slotId);
          }
          break;

        case PANEL_OPS.AUTO_EQUIP:
          this.engine.autoEquipBest();
          break;

        case PANEL_OPS.CRAFT:
          this.engine.craftItem(
            pedido.recipeId,
            pedido.rarity ?? null,
          );
          break;

        case PANEL_OPS.SET_LOOT_FILTER:
          this.engine.setLootFilter(pedido.filter);
          break;

        case PANEL_OPS.PRUNE_INVENTORY:
          this.engine.pruneInventory();
          break;

        case PANEL_OPS.FIX_MISPLACED_EQUIPMENT:
          this.engine.fixMisplacedEquipment();
          break;

        case PANEL_OPS.TOGGLE_AUTO_PLAY:
          this.engine.toggleAutoPlay();
          break;

        case PANEL_OPS.TOGGLE_QUEST_AUTO:
          this.engine.toggleQuestAuto();
          break;

        case PANEL_OPS.FOCUS_QUEST:
          this.engine.focusQuest(pedido.questId);
          break;

        case PANEL_OPS.ACCEPT_SIDE_QUEST:
          this.engine.acceptSideQuest(pedido.questId);
          break;

        case PANEL_OPS.ABANDON_SIDE_QUEST:
          this.engine.abandonSideQuest();
          break;

        case PANEL_OPS.CLAIM_QUEST_REWARD:
          /**
           * O resgate da recompensa.
           *
           * O `questId` vem do cliente e nao vale nada: o
           * `claimQuestReward` procura a recompensa na fila do
           * `QuestLog` e nao paga se ela nao estiver la. E a fila
           * perde a linha no resgate, entao repetir o pedido nao
           * paga duas vezes
           */
          this.engine.claimQuestReward(pedido.questId);
          break;

        case PANEL_OPS.TRAVESSAR_PORTAL:
          this.travessarPortal(pedido.portalId);
          break;

        case PANEL_OPS.GUILD_CRIAR:
          this.criarGuilda(sessao, pedido);
          break;

        case PANEL_OPS.GUILD_BUSCAR:
          this.buscarGuilda(sessao, pedido);
          break;

        case PANEL_OPS.GUILD_PEDIR:
          this.operarGuilda(sessao, pedido, (s, p) =>
            s.pedirEntrada(chaveDaSessao(sessao), p.guildId, {
              nome: sessao.name,
              classe: sessao.classId,
            }),
          );
          break;

        case PANEL_OPS.GUILD_ACEITAR:
          this.operarGuilda(sessao, pedido, (s, p) =>
            s.aceitarEntrada(chaveDaSessao(sessao), p.guildId, p.alvoId),
          );
          break;

        case PANEL_OPS.GUILD_NEGAR:
          this.operarGuilda(sessao, pedido, (s, p) =>
            s.negarEntrada(chaveDaSessao(sessao), p.guildId, p.alvoId),
          );
          break;

        case PANEL_OPS.GUILD_SAIR:
          this.operarGuilda(sessao, pedido, (s) => s.sair(chaveDaSessao(sessao)));
          break;

        case PANEL_OPS.GUILD_TALENTO:
          this.destravarTalent(sessao, pedido);
          break;

        case PANEL_OPS.GUILD_LIDERANCA:
          this.operarGuilda(sessao, pedido, (s, p) =>
            s.passarLideranca(chaveDaSessao(sessao), p.alvoId),
          );
          break;

        case PANEL_OPS.GUILD_COFRE:
          this.mexerNoCofre(sessao, pedido);
          break;

        case PANEL_OPS.SET_BESTIARY_AUTO:
          /**
           * O mesmo pedido LIGA e DESLIGA.
           *
           * O botao "ir matar" da tela e um interruptor: pedir a
           * criatura que ja esta em cacada significa desistir dela. Se
           * este `op` so ligasse, nao existiria caminho para desligar
           * pelo botao — e o jogador so poderia resolver recarregando
           */
          this.engine.toggleBestiaryAuto(
            pedido.creatureId,
          );
          break;

        case PANEL_OPS.CLEAR_BESTIARY_AUTO:
          this.engine.clearBestiaryAuto();
          break;

        case PANEL_OPS.SET_SKILL_AUTO:
          this.engine.setSkillAuto(
            pedido.skillId,
            Boolean(pedido.ativo),
          );
          break;

        case PANEL_OPS.DELIVER_COLLECTION:
          this.engine.deliverCollection(pedido.collectionId);
          break;

        /**
         * O ENCANTAMENTO sorteia aqui, e nao no cliente.
         *
         * E o unico `op` do painel que produz um numero aleatorio, e
         * por isso ele precisa do servidor: se o cliente sorteasse, o
         * afixo mostrado na tela seria o que o jogador QUIS ver, e o
         * `parsePanel` nao tem como conferir um sorteio
         *
         * O pedido traz o `uid` da mochila OU o `slotId` do que esta
         * vestido. Com os dois preenchidos o pedido e ambiguo, e por
         * isso ele e RECUSADO em vez de escolher um: o jogador pagaria
         * para encantar uma peca e veria outra mudar
         *
         * A falha precisa virar mensagem. `enchantItem` devolve
         * `{ok: false, reason}` em vez de lancar, porque o caminho feliz
         * e um `break` e o caminho da recusa e o mais comum — ouro
         * insuficiente acontece toda hora. Sem o `showMessage`, o
         * jogador veria o botao nao fazer nada
         */
        case PANEL_OPS.ENCHANT: {
          const daMochila = Boolean(pedido.uid);
          const doCorpo = Boolean(pedido.slotId);

          if (daMochila === doCorpo) {
            this.engine.showMessage(
              "Escolha uma peça para encantar.",
              true,
            );

            break;
          }

          const resultado = daMochila
            ? this.engine.enchantItem(pedido.uid)
            : this.engine.enchantSlot(pedido.slotId);

          if (!resultado?.ok) {
            this.engine.showMessage(
              resultado?.reason ?? "Não foi possível encantar.",
              true,
            );
          }

          break;
        }

        // as tres do mercado ficam aqui, e nao no motor: elas
        // precisam das DUAS sessoes ao mesmo tempo (quem vende e quem
        // compra), e o motor so enxerga a sessao em foco
        case PANEL_OPS.MARKET_LIST:
          this.listarNoMarket(sessao, pedido);
          break;

        case PANEL_OPS.MARKET_BUY:
          this.comprarNoMarket(sessao, pedido);
          break;

        case PANEL_OPS.MARKET_CANCEL:
          this.cancelarNoMarket(sessao, pedido);
          break;

        // um `op` de outra versao do cliente. o motor fica como esta:
        // e o servidor que decide o que existe
        default:
          break;
      }
    });
  }

  /**
   * Um comando de ACAO: atacar, usar skill, mirar.
   *
   * O limite e POR CONEXAO, nao do servidor: um jogador disparando
   * acoes nao pode acabar com o processing dos outros
   */
  aplicarAcao(client, { action, targetId, aimX, aimY, slot } = {}) {
    if (!client.actionLimiter.permite()) {
      client.enviar(SERVER_EVENTS.REJECTED, {
        reason: REJECT.RATE_LIMIT,
      });
      return;
    }

    const sessao = client.session;

    this.engine.withPlayer(sessao.id, () => {
      // o limite de mira tambem e do cliente: sem ele, a mira fica
      // onde o jogador parou de mexer o mouse, e um golpe no vazio
      // parece um bug do servidor
      sessao.input.pointer.x =
        sessao.player.x + (aimX ?? 0) * DISTANCIA_DE_MIRA;
      sessao.input.pointer.y =
        sessao.player.y + (aimY ?? 0) * DISTANCIA_DE_MIRA;
      sessao.input.pointer.inside = true;

      if (targetId) {
        this.engine.lookAtTarget(targetId);

        this.engine.engageTarget(targetId, {
          atacarAgora: false,
        });

        return;
      }

      switch (action) {
        case "BASIC_ATTACK":
          this.engine.useBasicAttack();
          break;

        case "SKILL":
          this.engine.useSkillSlot(slot);
          break;

        case "ULTIMATE":
          this.engine.useUltimate();
          break;

        default:
          break;
      }
    });
  }

  /**
   * Aplica o save guardado na sessao recem-criada.
   *
   * O `applyCharacterSave` e o mesmo que a tela offline usa, e o
   * `refillVitals` vem DEPOIS: vida e recurso nao sao progresso, e
   * entrar com o personagem morto seria uma entrada sem jogo
   *
   * A missao de nivel e reconferida no fim, e este e o passo que
   * impede a missao travada: o save pode ter sido escrito no momento
   * exato em que o jogador ja cumpria "alcanca o nivel 5". Sem esta
   * chamada a missao ficaria mostrando 0 de 5 para sempre, sem avancar e sem fechar — e no nivel maximo ninguem mais subia, entao
   * o evento que fecharia a missao nunca mais viria
   */
  /**
   * ONDE UM JOGADOR ENTRA NESTE MAPA.
   *
   * Devolve o spawn E os limites juntos, de proposito. Eles sao a mesma
   * resposta para a mesma pergunta: "onde comeca este mapa". Um save
   * gravado no vale traz coordenadas do vale, e a unica coisa que sabe
   * dizer se elas servem aqui e o limite deste mapa
   *
   * Antes, `limites` vinha de `config.limites` — um campo que NINGUEM
   * definia. Ele chegava sempre `null`, o clamp nunca rodava, e um
   * personagem que salvou jogando no vale aparecia em (3000, 2000) dentro
   * da base, que so vai ate (1640, 1136)
   */
  entradaNoMapa() {
    const { spawn, bounds } = this.engine.world.map;

    return {
      spawn: { x: spawn.x, y: spawn.y },

      limites: {
        minX: bounds.x,
        maxX: bounds.x + bounds.width,
        minY: bounds.y,
        maxY: bounds.y + bounds.height,
      },
    };
  }

  restaurar(sessao, salvo) {
    applyCharacterSave(sessao, salvo, this.entradaNoMapa());

    /**
     * O HUB RECOMECA PELO MEIO.
     *
     * O save traz uma posicao, e ela pode estar DENTRO dos limites da
     * base sem estar no centro: quem jogou antes dela existir ficou
     * com o motor em (1200, 800), e isso cabe folgado num mapa de 40 a
     * 1640. O limite so devolve o spawn quando a posicao cai FORA, entao
     * ele nao segura esse caso
     *
     * Quem nao retoma e o MAPA que decide, pelo `resumeWhereLeftOff`. O
     * hub diz que nao, e o jogador entra sempre pelo meio do
     * calcamento. O vale diz que sim, e continua de onde parou
     */
    if (!this.engine.world.map.resumeWhereLeftOff) {
      const { spawn } = this.entradaNoMapa();

      sessao.player.x = spawn.x;
      sessao.player.y = spawn.y;
    }

    /**
     * Os STATS sao derivados, entao entram AQUI.
     *
     * O save carrega nivel e equipamento, e nao os numeros de ataque,
     * defesa e vida maxima: eles sao a SOMA da classe com o nivel e
     * com o que esta vestido, e essa soma e do motor. Sem esta
     * chamada o jogador que voltava logava com os numeros crus da
     * classe — o mesmo Guerreiro nivel 30 batia fraco ate vestir
     * alguma peca
     *
     * E a ordem importa: o `refillVitals` abaixo preenche a vida com
     * o `maxHp` que estiver no jogador, entao os stats precisam estar
     * prontos antes dele
     */
    this.engine.withPlayer(sessao.id, () => {
      this.engine.applyEquipment();
    });

    refillVitals(sessao);

    this.engine.withPlayer(sessao.id, () => {
      const concluidas = this.engine.world.quests.syncLevel(
        sessao.player?.level ?? 1,
      );

      if ((concluidas ?? []).length > 0) {
        this.engine.resolveQuestProgress(concluidas);
      }
    });
  }

  /**
   * Um tick do mundo.
   *
   * O `delta` e o tempo SIMULADO, nao o real: o loop chama
   * `avancarTempo` com o relogio e sao os ticks que rodam aqui. Um
   * `setInterval` atrasado passaria um delta gigante, e um teleport
   * atravessa o mapa em um tick so
   */
  tick(delta) {
    // quantos jogadores ainda estao online. o tick nao roda para
    // ninguem: com o mundo vazio, so o `expirarAnuncios` trabalha
    this.engine.update(delta);

    /**
     * O prazo dos anuncios corre mesmo com o jogador parado.
     *
     * Se isto so rodasse quando alguem abre o painel, o anuncio de um
     * jogador que ficou online sem tocar em nada nunca venceria — e o
     * item ficaria fora do alcance dele para sempre
     */
    this.expirarAnuncios();

    for (const client of this.clients.keys()) {
      if (!client.joined) continue;

      client.enviar(SERVER_EVENTS.SNAPSHOT, {
        seq: ++this.seq,
        time: this.engine.world.time,

        /**
         * EM QUE MAPA O MUNDO ESTA.
         *
         * E o que faz o cliente acompanhar uma travessia: quando o
         * servidor troca o mapa, este id muda e o `NetworkWorld` troca
         * o motor tambem. Sem ele, o servidor estaria no vale e o cliente
         * desenhando o hub, cada um com o proprio elenco de inimigos
         *
         * O id viaja em TODOS os pacotes, e nao so na virada. Custa uma
         * palavra a 20Hz e remove um estado de "o mapa ja mudou?" que
         * teria de ser guardado dos dois lados
         */
        mapa: this.engine.world.map.id,

        players: this.estadoJogadores(),
        enemies: this.estadoInimigos(client),
        drops: this.estadoDrops(),
        projectiles: this.estadoProjetis(client),
      });
    }

    // o painel vai 4x por segundo, nao 20. o jogador nao percebe
    // a diferenca em um inventario, e o pacote inteiro do painel
    // (itens, missoes, craft) e grande demais para 20Hz
    this.seqTick = (this.seqTick ?? 0) + 1;

    if (this.seqTick % 5 !== 0) return;

    for (const client of this.clients.keys()) {
      if (!client.joined) continue;

      this.enviarPainel(client);
    }
  }

  /**
   * Monta e manda o PAINEL de um cliente.
   *
   * O painel e montado pelo motor, que e o mesmo codigo que a tela
   * offline consome: nao existe uma segunda descricao do formato que
   * possa divergir da que a tela ja consome
   */
  enviarPainel(client) {
    if (!client?.joined) return;

    this.clienteAtual = client;

    try {
      /**
       * A expiracao roda ANTES de montar o painel.
       *
       * O painel de um jogador sozinho ja empurraria o `expirar` do
       * `MarketStore` e apagaria o anuncio de todo mundo sem devolver o
       * item ao dono. Com a expiracao aqui, o item volta para a mao
       * dele no mesmo instante em que o anuncio some da vitrine dele
       */
      this.expirarAnuncios();

      this.engine.withPlayer(client.id, () => {
        this.engine.sendSnapshot();
      });
    } catch (erro) {
      /**
       * Um painel que estourou nao pode derrubar o servidor.
       *
       * Sem este `try`, a excecao subiria pelo `setInterval` do tick e
       * mataria o timer: o mundo inteiro congelava, e nao voltava nem
       * com jogador novo
       */
      console.error(
        "[painel] erro ao montar o painel:",
        erro?.stack ?? erro,
      );
    } finally {
      this.clienteAtual = null;
    }
  }

  /**
   * Os jogadores que o cliente pode VER.
   *
   * Quem esta longe demais nao entra: o mapa e do tamanho do mundo, e
   * a lista inteira para todo mundo a 20Hz seria banda por ninguem
   *
   * O `hurt` e o TEMPO RESTANTE da reacao ao dano, e ele chega
   * diminuindo a cada pacote: o cliente aceita o numero e deixa o
   * relogio correr entre um pacote e outro, o que faz o tremor do
   * desenho morrer suave em vez de voltar ao comeco a cada 50ms
   */
  estadoJogadores() {
    const lista = [];

    for (const sessao of this.engine.world.players.values()) {
      const p = sessao.player;

      lista.push({
        id: p.id,
        name: p.name,
        classId: p.definition.id,
        x: Math.round(p.x),
        y: Math.round(p.y),
        hp: Math.ceil(p.hp),
        maxHp: p.maxHp,
        isMoving: Boolean(p.isMoving),

        // a direcao real da entidade. Sem ela o cliente escolheria a
        // linha do sprite pelo movimento, e um personagem parado de
        // costas andando de lado viraria para a arte errada
        facing: {
          x: p.facing?.x ?? 0,
          y: p.facing?.y ?? 1,
        },

        // o tempo que resta do tremor. Ver o `NetworkWorld`: o
        // cliente aceita o numero e deixa o relogio correr entre os
        // pacotes, para o tremor nao voltar ao comeco a cada 50ms
        hurt: Math.max(0, p.hitFlash ?? 0),

        // o tiro COMECOU. O cliente escolhe a pose com estes dois:
        // `acting` sozinho prenderia o arco na mao para sempre, e
        // `hasTarget` sozinho mostraria o arco num buff em si mesmo
        acting: (p.attackAnimation ?? 0) > 0,
        hasTarget: Boolean(p.firingTargetId),
        selectedTargetId: sessao.selectedTargetId ?? null,
      });
    }

    return lista;
  }

  /**
   * Os inimigos que UM cliente ve.
   *
   * O filtro e de interesse, nao de estado: o cliente hide-and-seek
   * nao esconderia um mob, ele so deixaria de wasteful trafego
   */
  estadoInimigos(client) {
    const lista = [];
    const px = client?.session?.player?.x ?? 0;
    const py = client?.session?.player?.y ?? 0;

    for (const inimigo of this.engine.world.enemies) {
      const dx = inimigo.x - px;
      const dy = inimigo.y - py;

      if (dx * dx + dy * dy > INTERESSE_QUADRADO) continue;

      lista.push({
        id: inimigo.id,
        kind: inimigo.kind,
        x: Math.round(inimigo.x),
        y: Math.round(inimigo.y),
        hp: Math.ceil(inimigo.hp),
        maxHp: inimigo.maxHp,

        // `state` e o que o render usa para pular o mob: um slime
        // morto com `hp: 0` continuaria desenhado com a barra vazia
        state: inimigo.alive ? (inimigo.aiState ?? "idle") : "dead",

        // a direcao real. Sem ela o sprite do cliente ficaria sempre
        // no sul, que e o `facing` inicial da criatura, e o mob
        // andava de lado pelo mapa sem virar o corpo
        facing: {
          x: inimigo.facing?.x ?? 0,
          y: inimigo.facing?.y ?? 1,
        },

        // o golpe comecou. E um INSTANTE, nao um estado: o pacote vem
        // a cada 50ms e o golpe dura 0.28s, entao um `true` fixo
        // prenderia o mob segurando o arco para sempre. Quem conta o
        // tempo da pose e o cliente
        acting: (inimigo.attackAnimation ?? 0) > 0,
      });
    }

    return lista;
  }

  /** os drops no chao, com o dono de cada um */
  estadoDrops() {
    return this.engine.world.drops.map((d) => ({
      uid: d.uid,
      kind: d.kind,
      itemId: d.itemId,
      count: d.count,
      coins: d.coins,
      x: Math.round(d.x),
      y: Math.round(d.y),
      // o dono vai no pacote. o cliente nao deve desenhar o drop
      // de outra pessoa, mas quem decide isso e o servidor: um
      // cliente modificado mostraria o que quiser
      //
      // este `ownerId` e o do LOOT (o id de sessao que matou o
      // mob), e nao a chave de dono do mercado: um drop morre junto
      // com a sessao que o criou
      ownerId: d.ownerId ?? null,
    }));
  }

  /** as flechas e os outros projeteis que o SERVIDOR esta simulando */
  estadoProjetis(client) {
    const lista = [];
    const px = client?.session?.player?.x ?? 0;
    const py = client?.session?.player?.y ?? 0;

    for (const p of this.engine.world.projectiles) {
      const dx = p.x - px;
      const dy = p.y - py;

      if (dx * dx + dy * dy > INTERESSE_QUADRADO) continue;

      lista.push({
        id: p.id,
        x: Math.round(p.x),
        y: Math.round(p.y),
        radius: p.radius,
        velocityX: Math.round(p.velocityX),
        velocityY: Math.round(p.velocityY),
        style: p.action?.projectileStyle,
        color: p.action?.color,
        rain: Boolean(p.action?.rain),
      });
    }

    return lista;
  }

  /**
   * Grava o personagem de uma sessao.
   *
   * `false` quando nao ha store (persistencia desligada) ou quando o
   * disco falhou. Nao lanca: perder o save e ruim, mas derrubar o
   * servidor no `desconectar` seria pior, porque o jogador nem
   * conseguiria sair da tela
   */
  guardar(sessao) {
    if (!this.saves || !sessao) return false;

    try {
      return this.saves.salvar(
        sessao.name,
        snapshotSession(sessao),
      );
    } catch {
      return false;
    }
  }

  /** Grava todo mundo que esta online agora. */
  guardarTodos() {
    for (const client of this.clients.keys()) {
      if (!client.joined) continue;

      this.guardar(client.session);
    }
  }

  desconectar(client) {
    this.clients.delete(client);

    if (!client.joined) return;

    /**
     * O indice de donos so pode sair quando a sessao e a do dono.
     *
     * Se o mesmo personagem entrou duas vezes (duas abas), a segunda
     * entrada trocou a referencia do indice. Apagar aqui sem conferir
     * tiraria do mapa a sessao errada, e a sessao boa continuaria
     * valendo como se o jogador tivesse saído
     */
    const sessao = client.session;

    if (this.sessoesPorDono.get(sessao?.donoKey) === sessao) {
      this.sessoesPorDono.delete(sessao.donoKey);
    }

    // O save acontece ANTES de a sessao sair do mundo: depois do
    // `removePlayer` nao ha mais sessao para ler
    this.guardar(sessao);

    this.engine.removePlayer(client.id);
    this.anunciar(client.id, false);
  }

  /** Entra e sai de jogador, para todo mundo saber quem ha no mapa. */
  anunciar(id, entrou) {
    const sessao = this.engine.world.players.get(id);
    const nome = sessao?.player.name ?? "?";

    for (const outro of this.clients.keys()) {
      if (!outro.joined) continue;

      outro.enviar(
        entrou
          ? SERVER_EVENTS.PLAYER_JOINED
          : SERVER_EVENTS.PLAYER_LEFT,
        { id, name: nome },
      );
    }
  }

  /**
   * Liga o laco. O tempo real medido entre ticks manda no
   * `delta`: se a CPU engasgar, o tick seguinte compensa em vez
   * de perder tempo, e o limite de `maxCatchUpTicks` evita que
   * uma pausa longa dispare milhares de ticks de uma vez.
   */
  start() {
    if (this.intervalo) return;

    this.ultimoTick = Date.now();
    this.acumulado = 0;
    this.errosDeTick = 0;

    this.intervalo = setInterval(() => {
      const decorrido = (Date.now() - this.ultimoTick) / 1000;

      this.ultimoTick = Date.now();

      this.avancarTempo(decorrido);
    }, this.config.tickSeconds * 1000);

    // o laco nao pode ser a unica coisa segurando o processo vivo:
    // num teste, o `vitest` precisa conseguir terminar
    if (this.intervalo.unref) this.intervalo.unref();

    /**
     * Gravacao periodica de quem esta online.
     *
     * O `desconectar` ja salva, e e o caminho que importa no dia a
     * dia: fechar o navegador fecha o socket. Isto e a rede de
     * seguranca para o caso em que o servidor MORRE com gente
     * jogando, que e exatamente o que aconteceu hoje mais cedo.
     *
     * Trinta segundos e um meio termo: curto o bastante para o
     * jogador nao perder a hora de farm, longo o bastante para nao
     * escrever arquivo a cada minuto de quem so passou pelo jogo.
     */
    if (this.saves || this.mercado) {
      this.intervaloDeSave = setInterval(() => {
        this.guardarTodos();
        this.guardarMercado();
      }, SEGUNDO_ENTRE_SAVES * 1000);

      if (this.intervaloDeSave.unref) {
        this.intervaloDeSave.unref();
      }
    }
  }

  /**
   * Roda os ticks que o tempo passou permite.
   *
   * Esta parte saiu do `setInterval` de proposito: um laco de
   * relogio nao da para testar, e o que esta aqui e justamente o
   * que precisa de teste - ele decide quantos ticks rodam e o que
   * acontece quando um deles estoura.
   *
   * `decorrido` e o intervalo real do relogio, em segundos.
   */
  avancarTempo(decorrido) {
    // um `setInterval` atrasado pode devolver segundos demais,
    // e um delta gigante teleportaria todo mundo pelo mapa
    let tempo = decorrido;

    if (tempo > this.config.maxCatchUpTicks * this.config.tickSeconds) {
      tempo = this.config.tickSeconds;
    }

    this.acumulado += tempo;

    let passos = 0;

    while (
      this.acumulado >= this.config.tickSeconds &&
      passos < this.config.maxCatchUpTicks
    ) {
      // Um tick que estoura NAO pode derrubar o servidor.
      //
      // `setInterval` roda fora de qualquer `try`: uma excecao aqui
      // mata o processo, e o `node --watch` so reinicia em mudanca
      // de arquivo, nao em crash. O resultado era o pior possivel:
      // uma regra com bug tirava o mundo do ar para todo mundo e ele
      // nao voltava sozinho.
      //
      // o `acumulado` e zerado para o tick nao se repetir: um
      // estado que sempre estoura viraria uma avalanche de erro a
      // 20Hz, ocultando a causa.
      try {
        this.tick(this.config.tickSeconds);
      } catch (erro) {
        this.acumulado = 0;

        this.errosDeTick += 1;
        console.error(
          "[tick] erro ao rodar o mundo:",
          erro?.stack ?? erro,
        );

        // tres erros seguidos: o mundo esta em um estado que nao
        // se recupera sozinho. melhor parar o laco e dizer do que
        // queimar cpuDerivando 20 vezes por segundo
        if (this.errosDeTick >= 3) {
          console.error(
            "[tick] tres erros seguidos: o laco vai parar. " +
              "reinicie o servidor para voltar ao normal.",
          );

          this.stop();
        }

        break;
      }

      this.acumulado -= this.config.tickSeconds;
      passos += 1;
    }
  }

  stop() {
    if (this.intervalo) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }

    if (this.intervaloDeSave) {
      clearInterval(this.intervaloDeSave);
      this.intervaloDeSave = null;
    }

    // quem estava jogando tem o personagem gravado. Sem isto, o
    // `Ctrl+C` para o servidor perderia o progresso de quem nao
    // chegou a clicar em sair
    this.guardarTodos();

    // e o mercado: um anuncio no ar e um item na mochila de ninguem, e
    // um pagamento a um vendedor que so existe em memoria
    this.guardarMercado();
  }
}

/**
 * A CHAVE do jogador, que e estavel entre conexoes.
 *
 * E a `donoKey` — o nome normalizado — e nao o `id` da sessao, que e
 * `p_<uuid>` e muda a cada entrada. Indexar estado compartilhado pelo
 * id da sessao e o que faria a guilda sumir quando o jogador
 * reconectasse: ele voltava, o store nao reconhecia o id novo, e a
 * guilda parecia ter evaporado
 *
 * O `?? sessao.id` cobre o single player, onde nao ha `donoKey`. No
 * servidor ele sempre existe, e o `??` nunca e alcancado
 */
function chaveDaSessao(sessao) {
  return sessao?.donoKey ?? sessao?.id ?? null;
}
