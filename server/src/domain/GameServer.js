import { randomUUID } from "node:crypto";
import { GameEngine } from "../../../src/game/engine/GameEngine.js";
import { createPlayerSession } from "../../../src/game/engine/PlayerSession.js";
import { CHARACTER_CLASSES } from "../../../src/data/characters/index.js";
import {
  ARENA_ID,
  findMap,
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
import { criarGuildSave } from "../persistence/GuildSave.js";
import {
  MarketStore,
  snapshotMarket,
} from "../../../src/game/market/MarketStore.js";
import { GuildStore } from "../../../src/game/guild/GuildStore.js";
import { PartyStore, PARTY_INVITE_TTL } from "./PartyStore.js";
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
  POCAO_MAX_POR_COMPRA,
  getPocao,
} from "../../../src/data/potions/index.js";
import { livrosDaClasse } from "../../../src/data/skills/books.js";
import { portalLiberado } from "../../../src/data/quests/index.js";
import { getTalent, podeGerenciar } from "../../../src/data/guild/index.js";
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
 * QUANTOS TICKS a janela deslizante guarda, para o `/health/laco`.
 *
 * 200 tiques a 20Hz da 10 segundos: uma briga inteira, o suficiente para
 * ver um tique pesado de abate grande e o seguinte leve, sem a janela
 * engolir nenhum dos dois
 *
 * E um numero pequeno de proposito. A janela e percorrida so quando
 * alguem CHAMA o `/health/laco` — uma leitura a cada 200 tiques nao
 * custa, e uma janela de 20.000 custaria mesmo sem ninguem perguntando
 */
const JANELA_TICK = 200;

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
 * A versao do arquivo das guildas.
 *
 * Igual a do mercado: um arquivo de uma versao mais nova NAO e lido, e
 * fica intacto para o servidor que entende o formato
 */
const GUILDA_VERSAO = 1;

/**
 * O RAIO DO BONECO, para a conferida de chegada.
 *
 * E o mesmo `16` que o colisor usa como raio do jogador, e ele esta em
 * um `const` do motor. Se um dia mudar la, este vira um numero errado
 * e a conferida aceitaria uma chegada com o boneco atravessando a
 * borda — por isso ele e nomeado aqui e nao repetido solto em cada
 * conferida
 */
const RAIO_DO_JOGADOR = 16;

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
     * O CLIENTE de cada entidade de jogador, por `player`.
     *
     * `clienteDoJogador` precisa achar o socket de quem levou o golpe, e
     * ele recebia a ENTIDADE de jogador — e nao a sessao, e nao o id. A
     * busca era um `for` nos `clients` comparando `client.session?.player
     * === jogador`, e ela roda POR NUMERO DE DANO resolvido
     *
     * O comentario antigo aqui dizia que um indice nao valia o preco "por
     * numero de dano". Isso era verdade com o servidor de poche gente que
     * ele foi escrito para; o servidor agora e para muita gente ao mesmo
     * tempo, e o preco e O(n) por golpe
     *
     * A chave e a ENTIDADE, e nao o id, porque e a entidade que o
     * `DamageSystem` entrega. Indexar por id exigiria converter, e o id
     * pode vir de outra sessao apos uma reconexao
     *
     * Manter em tres lugares: o JOIN cria a sessao, e o `desconectar`
     * tira. A chave do dono (`sessoesPorDono`) e separada e nao e
     * confundida com esta — ela sobrevive a reconexao, esta nao
     */
    this.clientePorJogador = new Map();

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
     * A PARTY: o terceiro estado compartilhado.
     *
     * Mora no servidor e tem uma unica copia, pelo mesmo motivo da
     * guilda: duas instancias dariam duas parties com o mesmo jogador,
     * e o loot compartilhado passaria a contar duas vezes
     *
     * E o estado que decide QUEMganha o que. O cliente sabe que esta
     * numa party e desenha a box, mas quem divide moeda, quem sorteia o
     * item e quem recebe o abate na missao e este objeto
     */
    this.parties = new PartyStore({
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
        /**
         * A party entra no motor pelo mesmo caminho do market e da
         * guilda: injetada, e so lida. Quem cria party e o `PartyStore`;
         * o motor so pergunta quem mais esta no grupo
         */
        partyStore: this.parties,

        /**
         * OS PERSONAGENS EM DISCO, para o rank mostrar offline.
         *
         * Uma FUNCAO e nao a lista: o painel e montado quatro vezes por
         * segundo para cada jogador, e ler a pasta de saves nesse
         * intervalo e I/O de disco no laco. Quem chama decide o
         * momento; o motor so recebe a lista pronta
         *
         * Sem isto o rank conhece apenas quem esta conectado, e
         * fechar o navegador apaga o jogador da tabela
         */
        personagensSalvos: () => this.listaDePersonagensSalvos(),
      },
    );

    // o motor ja sabe montar o painel inteiro (inventario,
    // missoes, craft, numeros do personagem) porque o offline
    // desenhava na tela. aqui esse callback entrega no dono da
    // vez, entao nao existe uma segunda descricao do formato
    // que possa divergir da que a tela ja consome
    this.clienteAtual = null;

    /**
     * O PAINEL E DO SERVIDOR, e nao do timer do motor.
     *
     * O motor tem um timer de 10Hz que chama `sendSnapshot()` para o
     * HUD do single player. Aqui ele roda FORA de qualquer jogador em
     * foco, entao o painel saia completo e o `onSnapshot` descartava
     * por nao ter dono: 100 de 140 paineis montados em 200 ticks eram
     * lixo, a 2,5ms cada. Com o timer desligado, o painel passa a ser
     * construido so em `enviarPainel`, que sabe de quem e
     */
    this.engine.painelExterno = true;

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

    /**
     * O MAPA DE ENTRADA, e nao o mapa em que o `world` esta.
     *
     * Sao coisas diferentes agora que cada jogador tem o seu mapa: o
     * `world` aponta para o mapa do ultimo jogador em foco, e um
     * jogador que entra enquanto outro esta no vale leria `world.map` e
     * nasceria no vale sem ter atravessado nada
     *
     * E o servidor que sabe em que mapa o mundo comeca
     */
    this.mapaInicial = getMap(mapId);

    this.placeholder = this.engine.world.session;

    this.intervalo = null;
    this.ultimoTick = 0;
    this.acumulado = 0;

    /**
     * A CONTAGEM DO LACO, para o `/health/laco`.
     *
     * `duracaoAcumuladaMs` e dividida por `tiquesRodados`, e por isso
     * os dois andam juntos. Sem media, so haveria o intervalo entre
     * disparos, que mede a fila e nao o trabalho
     */
    this.tiquesRodados = 0;
    this.duracaoAcumuladaMs = 0;
    this.seq = 0;
    this.seqTick = 0;

    /**
     * AS ULTIMAS DURACOES DE TICK, numa janela deslizante.
     *
     * A `duracaoAcumuladaMs` acima e a media da VIDA INTEIRA do processo,
     * e e o numero certo para o `/health/laco` do monitoramento: ela
     * responde "o servidor aguenta", e nao "o servidor esta bem agora"
     *
     * Para VERIFICAR uma otimizacao as duas medidas respondem perguntas
     * diferentes, e a da vida inteira e a que atrapalha: um servidor que
     * passou 6 horas com 40ms por tick e acaba de cair para 4ms continua
     * reportando uma media alta, e da a impressao de que nada mudou. O
     * inverso tambem: uma otimizacao que so ajuda o jogador recem
     * conectando fica invisivel na media por horas
     *
     * Sao 200 tiques, que a 20Hz da 10 segundos. E o tempo de uma briga
     * media: da para ver o tique pesado de um abate grande e o seguinte,
     * leve, sem a janela engolir um nem esconder o outro
     *
     * E um array circular com contagem propria em vez de `shift()`: o
     * `shift` reindexa os 200 elementos a cada tique, 20 vezes por
     * segundo, para nada
     */
    this.janelaTick = new Array(JANELA_TICK).fill(0);
    this.janelaTickPos = 0;
    this.janelaTickCheia = false;

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
     * CACHE dos saves lidos, para o rank do painel.
     *
     * `listaDePersonagensSalvos` e chamada por CADA painel, e cada painel
     * a 4Hz por cliente. Antes ela fazia, por chamada, um `readdirSync`
     * mais um `existsSync` + `readFileSync` + `JSON.parse` para CADA save
     * em disco — tudo sincrono, tudo na thread do `setInterval` de 20Hz
     *
     * Com 50 jogadores e 50 saves, isso dava 200 paineis/s vezes 51
     * operacoes de arquivo = **~10.700 operacoes sincronas por segundo**
     * de I/O bloqueante. Nao e CPU cara: e I/O que segura o event loop
     * inteiro, e com ele o HTTP, o WebSocket e o proprio tick. O tick
     * perde a regularidade e a latencia sobe para todo mundo ao mesmo
     * tempo
     *
     * O cache e invalidado em `guardar`, o unico caminho que escreve save:
     * o servidor nunca chama `apagar`. O autosave de 30s invalida junto,
     * entao a janela real e de 30s — o que corta as 200 releitura por
     * segundo para ~1 passagem a cada 30s
     *
     * A lista devolvida e a MESMA referencia para todos os paineis do
     * intervalo. `montarRank` ordena uma copia (`[...lista].sort`) e nao
     * muta a entrada, entao isso e seguro — mas e um contrato, e nao um
     * detalhe: se algum dia alguem ordenar a lista no lugar, o rank
     * passa a mudar de ordem conforme os paineis correm
     */
    this.savesEmCache = null;

    /**
     * CACHE DOS DROPS do tick, e o mapa a que ele pertence.
     *
     * Ve `estadoDrops`. Vive junto do cache de saves porque e o mesmo
     * tipo de desperdicio — trabalho identico refeito por cliente — mas
     * por um motivo diferente: o de saves era I/O de disco, e este e
     * alocacao
     *
     * `dropsDoTickMapa` existe porque o `world` e virado por
     * `withPlayer` a cada cliente: dois jogadores em mapas diferentes
     * veem listas diferentes no MESMO tick, e um cache de uma so ranura
     * passaria o drop do vale para quem esta no hub
     *
     * Os dois sao zerados no comeco do `tick`
     */
    this.dropsDoTick = null;
    this.dropsDoTickMapa = null;

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

    /**
     * As guildas em disco, e o sinal de que elas mudaram.
     *
     * Mesmo desenho do mercado, e pelo mesmo motivo: o `GuildStore` e
     * estado em memoria e o mundo precisa das guildas ANTES do primeiro
     * jogador conectar — a aba Membros consulta o store no primeiro
     * painel, e uma guilda que so aparecesse no primeiro `criar` seria
     * uma guilda que some da tela de quem ja estava dentro dela
     *
     * Sem isto o clan evaporava no relog: o `GuildStore` guardava tudo
     * em memoria, e voltar a conectar encontrava um store vazio
     */
    this.guilda =
      !persistencia ? null : criarGuildSave(persistencia);

    this.guildaSuja = false;

    this.restaurarGuildas();

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

    /**
     * O LIMITE NAO E COBRADO AQUI.
     *
     * Ele ja foi cobrado no `message` do socket, antes de `receber`
     * ser chamado. Cada `permite()` empurra um marco no array do
     * limiter, entao as duas chamadas contavam DOIS disparos por
     * mensagem: o teto real era metade do configurado (45/s em vez
     * de 90/s), e `MAX_MESSAGES_PER_SECOND` deixava de ser verdade
     *
     * Quem decide o que e Abuse e quem segura o socket. Aqui o
     * limite nao seria apenas redundante, e um furo: um jogador que
     * passasse pelo `message` por algum motivo cairia em um segundo
     * portao que nao devia existir
     */

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
     *
     * `INPUT` E `PING` TAMBEM FICAM DE FORA, e isso nao e detalhe.
     *
     * `INPUT` chega a 45 vezes por segundo (o teto do rate limiter) e
     * `PING` e o comando que deveria ser o mais barato de todos. Nenhum
     * dos dois muda uma unica coisa do painel: `aplicarIntencao` so
     * sobrescreve o vetor de movimento, que o proximo SNAPSHOT de 20Hz
     * ja leva. Mas o painel custa ~2,5ms para montar e serializar
     * (154KB, dos quais 112KB sao o catalogo de craft), entao responder
     * a eles custava 115ms de CPU por segundo POR CLIENTE — na mesma
     * thread do `setInterval` do tick. Com meia duzia de jogadores era
     * um terco do tiqueUMENTO em construir painel para ninguem
     */
    const COM_PAINEL = new Set([
      CLIENT_COMMANDS.ACTION,
      CLIENT_COMMANDS.PANEL,
    ]);

    if (COM_PAINEL.has(type)) {
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
   * O indice e por ENTIDADE, e por isso a chave e o `player` da sessao:
   * e assim que o `DamageSystem` entrega o alvo, e comparar com a sessao
   * erraria o tipo e devolveria `null` para todo golpe
   *
   * A busca era um `for` nos `clients`, e ela roda POR NUMERO DE DANO
   * resolvido. O comentario antigo aqui dizia que um indice nao valia o
   * preco "por numero de dano" — o que era verdade com o servidor de
   * poche gente para o qual foi escrito. Este e o servidor de muita gente
   * ao mesmo tempo, e o preco passou a ser O(n) por golpe
   */
  clienteDoJogador(jogador) {
    if (!jogador) return null;

    return this.clientePorJogador.get(jogador) ?? null;
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

  /* ------------------------------------------------------------------
     AS GUILDAS NO DISCO
     ------------------------------------------------------------------ */

  /**
   * Le as guildas do arquivo para o `GuildStore`.
   *
   * Mesma politica do mercado: um `versao` maior do que este servidor
   * entende NAO e carregado, e o arquivo fica intacto para quem entende.
   * Ler um formato desconhecido faria um campo novo ser lido como se
   * fosse o que este codigo conhece
   *
   * O `fromSave` ja descarta guilda malformada uma por uma, entao aqui
   * nao ha filtro a repetir: quem valida cada linha e o store, e o
   * servidor so decide se o arquivo inteiro pode entrar
   */
  restaurarGuildas() {
    if (!this.guilda) return false;

    const bruto = this.guilda.carregar();

    if (!bruto || typeof bruto !== "object") return false;

    if (Number(bruto.versao ?? 0) > GUILDA_VERSAO) {
      return false;
    }

    return this.guild.fromSave(bruto.guilds) > 0;
  }

  /**
   * As guildas mudaram, e o disco esta atrasado.
   *
   * So um sinalizador, como o mercado: quem escreve e o `guardarGuildas`,
   * no intervalo de gravacao e no `stop`. Marcar e gritar de imediato
   * resolveria o relog, mas cada entrada aceita, cada talento e cada
   * pedido aceito viraria uma escrita de arquivo — e o accruo de pontos
   * chama `sincronizarPontos` a cada tick
   */
  marcarGuildaSuja() {
    if (!this.guilda) return;

    this.guildaSuja = true;
  }

  /**
   * Grava as guildas, se alguma mudou.
   *
   * `true` quando escreveu. `false` quando a persistencia esta desligada,
   * quando nada mudou, ou quando o disco falhou — e nenhum dos tres e
   * motivo para derrubar o servidor no meio de uma promocao
   */
  guardarGuildas() {
    if (!this.guilda || !this.guildaSuja) return false;

    const gravado = this.guilda.salvar({
      guilds: this.guild.toSave(),
    });

    if (gravado) this.guildaSuja = false;

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

    /**
     * O MOTIVO ESPECIFICO VENCE O GENERICO.
     *
     * `motivoDoMarket` sabe o que aconteceu ("mochila cheia"), mas nao
     * o quanto: e a compra que sabe que o anuncio exige 3 slots e o
     * jogador tem 1. Quando a chamada traz um texto proprio, ele e o
     * que o jogador le — e o generico continua sendo o padrao para
     * quem nao tem nada de melhor a dizer
     */
    this.avisoDoDono(
      sessao,
      motivo ?? this.motivoDoMarket(resultado.reason),
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
   * COMPRAR uma pocao na loja do mercador.
   *
   * ## POR QUE ESTA NAO E O `comprarNoMarket`
   *
   * O mercado entre jogadores move dinheiro entre DUAS sessoes, e por
   * isso ele mora aqui e nao no motor. A loja do mercador move dinheiro
   * para o jogo: uma sessao só, um preco que vem do catalogo, e
   * nenhum outro jogador envolvido. E por isso que ela usa
   * `showMessage` como o encantar e a guilda, em vez do
   * `resultadoDoMarket` — aquele existe para reconciliar as duas telas
   * do mercado ao mesmo tempo, e aqui nao ha segunda tela
   *
   * ## NADA DO PEDIDO E CONFIAVEL
   *
   * O `itemId` e procurado no catalogo da loja, e um id fora dele e
   * recusado. O preco NUNCA vem do pedido: sai do catalogo, e e por
   * isso que um cliente modificado nao consegue comprar por 1. A
   * quantidade vem do pedido porque o jogador pode legitimamente
   * comprar varias, e por isso ela tem teto de regra aqui, em vez de
   * teto no transporte
   *
   * ## A ORDEM: COBRA, DEPOIS ENTREGA, E DESFAZ SE NAO COUBER
   *
   * E a mesma ordem do `comprarNoMarket`, e pelo mesmo motivo. E o
   * espaco que falha depois da cobranca que obriga a devolver o
   * dinheiro — e devolver junto com o que entrou na mochila, para o
   * jogador ficar exatamente onde estava. Sem o `take`, ele perderia o
   * preco E ficaria com parte das pocoes de graca
   */
  comprarPocao(sessao, pedido) {
    const pocao = getPocao(pedido.itemId);

    if (!pocao) {
      this.engine.showMessage(
        "O mercador não tem essa poção.",
        true,
      );

      return;
    }

    /**
     * A quantidade pedida, ou 1.
     *
     * `null` e o que o transporte devolve para um numero invalido, e
     * `1` e a compra minima. O teto e o da LOJA e nao o do mercado
     * entre jogadores: 99 pocoes num clique caberiam na mochila e
     * esvaziariam a bolsa antes de o jogador confirmar o preco
     */
    const quantidade = Math.min(
      Math.max(1, Math.floor(pedido.count ?? 1)),
      POCAO_MAX_POR_COMPRA,
    );

    const preco = pocao.preco * quantidade;

    if (!sessao.inventory.spendCoins(preco)) {
      this.engine.showMessage(
        `Moedas insuficientes: ${preco} são necessárias.`,
        true,
      );

      return;
    }

    const entregue = sessao.inventory.add(pocao.id, quantidade);

    if (entregue.added < quantidade) {
      // a mochila lotou: o dinheiro volta e o que entrou sai de novo
      sessao.inventory.addCoins(preco);

      if (entregue.added > 0) {
        sessao.inventory.take(pocao.id, entregue.added);
      }

      this.engine.showMessage("Mochila cheia.", true);

      return;
    }

    this.engine.showMessage(
      `${getItem(pocao.id)?.name ?? pocao.id} x${quantidade}.`,
    );
  }

  /**
   * COMPRAR um livro de habilidade com o Mestre de Habilidades.
   *
   * A mesma transacao de `comprarPocao`, e pelas mesmas razoes: o preco
   * vem do catalogo do servidor, o pedido nao pode escolher quanto
   * paga, e a mochila lotada devolve o dinheiro.
   *
   * ## POR QUE UM POR VEZ
   *
   * `comprarPocao` aceita quantidade porque poçao se empilha e faz
   * sentido ter tres na mochila. Um livro ENSINA uma skill, e a segunda
   * copia do mesmo livro nao ensina mais nada — o `aprenderHabilidade`
   * recusa e o jogador teria pago por nada
   *
   * ## A CLASSE E DO SERVIDOR
   *
   * `sessao.classId` resolve o catalogo, e o cliente nao manda classe
   * nenhuma. Um pedido com o id de um livro de outra classe cai no
   * `getLivroDaClasse` abaixo e e recusado, o que impede comprar o livro
   * de Arbalist sendo Guerreiro
   */
  comprarLivro(sessao, pedido) {
    const classeId = sessao.classId;

    /**
     * O CATALOGO DESTA CLASSE, e nao o catalogo inteiro.
     *
     * E o que faz o shop ser separado por classe. Um livro que existe no
     * catalogo global mas nao no desta classe nao e encontrado, e a
     * compra e recusada com a mensagem de "nao vende esse livro"
     */
    const livro = livrosDaClasse(classeId).find(
      (item) => item.itemId === pedido.itemId,
    );

    if (!livro) {
      this.engine.showMessage(
        "O Mestre nao vende esse livro para a sua classe.",
        true,
      );

      return;
    }

    /**
     * JA APRENDEU.
     *
     * Conferido ANTES de cobrar, e nao depois de entregar. Se a checagem
     * viesse depois, o jogador pagaria 150 moedas, receberia o livro, e o
     * `aprenderHabilidade` recusaria no uso — o dinheiro foi gasto para
     * nada e o jogador teria o livro na mao sem uso
     */
    if (sessao.habilidadesAprendidas.has(livro.skillId)) {
      this.engine.showMessage(
        "Voce ja aprendeu essa habilidade.",
        true,
      );

      return;
    }

    if (!sessao.inventory.spendCoins(livro.preco)) {
      this.engine.showMessage(
        `Moedas insuficientes: ${livro.preco} sao necessarias.`,
        true,
      );

      return;
    }

    const entregue = sessao.inventory.add(livro.itemId, 1);

    if (entregue.added < 1) {
      sessao.inventory.addCoins(livro.preco);

      this.engine.showMessage("Mochila cheia.", true);

      return;
    }

    this.engine.showMessage(
      `${getItem(livro.itemId)?.name ?? livro.itemId}. Use o livro para aprender.`,
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

    /**
     * A MOCHILA PRIMEIRO, e a mensagem agora.
     *
     * Antes a compra gastava a moeda, tentava o `add` e so entao
     * devolvia o dinheiro se o `add` nao coubesse. O jogador recebia
     * "mochila cheia" sem nenhum numero — e, como o `add` funde so com
     * pilhas da MESMA raridade, dava para ter espaço na mochila e ainda
     * assim faltar: 200 unidades de um material que voce nao tem
     * precisam de 3 slots (99 por pilha), e 1 slot livre parece
     * suficiente
     *
     * Perguntar antes de gastar deixa o dinheiro intacto e transforma a
     * negativa em algo acionavel: quantos slots o item exige, quantos
     * voce tem. E o motivo do erro continua o mesmo
     */
    const slots = sessao.inventory.slotsNeeded(
      anuncio.itemId,
      anuncio.count,
      anuncio.rarity,
    );

    const livres = sessao.inventory.freeSlots;

    if (slots > livres) {
      this.resultadoDoMarket(
        sessao,
        { ok: false, reason: MARKET_RESULT.ESPACO },
        `Sem espaco: ${describeAnuncioItem(anuncio)} precisa de ${slots} slot(s) e voce tem ${livres}.`,
      );

      return;
    }

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
    this.market.buy(anuncio.id, sessao.donoKey, sessao.name);

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
      {
        /**
         * O MAPA DE ENTRADA, e nao `world.map`.
         *
         * O `world` aponta para o mapa do ultimo jogador em foco, e um
         * jogador que entra enquanto outro esta no vale nasceria la sem
         * ter atravessado nada
         */
        mapId: this.mapaInicial.id,
      },
    );

    /**
     * O CLIENTE desta entidade entra no indice por golpe.
     *
     * A sessao acabou de nascer e e a primeira vez que existe um `player`
     * para este socket. Sem esta linha o `clienteDoJogador` devolveria
     * `null` para todo numero de dano desta pessoa, e o jogador nao veria
     * o proprio golpe nem o dano que levou
     */
    this.clientePorJogador.set(client.session.player, client);

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
     * O gancho de "chefe caiu" e ligado aqui, na PRIMEIRA entrada.
     *
     * Nao no construtor porque ele nao existe enquanto o motor nao tem
     * `onChefeDerrotado` declarado — e ligar antes de `jogar` existir
     * seria um `undefined` silencioso, do tipo que so apareceria na
     * primeira vitoria da arena
     */
    this.conectarChefe();

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
travessarPortal(portalId, sessao = null) {
  if (!portalId) return false;

  const emCima = this.engine.portalSobOsPes();

  if (!emCima) return false;

  // o id pedido tem que ser o portal em que o jogador esta. Aceitar
  // qualquer id leto o jogador atravessar pelo portal do pantano
  // estando em cima do da floresta
if (emCima.portal.id !== portalId) return false;

    /**
     * A TRAVA, e a RECUSA COM MOTIVO.
     *
     * O `engine.travessarPortal` tambem confere a trava, mas ele so
     * devolve `false` — e o jogador ficaria em cima do portal apertando
     * um botao que nao faz nada, sem nunca saber o porquê. Aqui a recusa
     * vira aviso, e o aviso carrega o nome da missao que falta
     *
     * E a conferida fica ANTES do `engine.travessarPortal` de proposito:
     * quem decide o mapa e o motor, e um motor que ja trocou o mapa nao
     * volta por recusar
     */
    const trava = portalLiberado(
      emCima.portal.exigeMissaoDe,
      sessao?.quests?.mainIndex ?? 0,
    );

    if (!trava.ok) {
      this.avisoDoDono(sessao, trava.motivo, true);

      return false;
    }

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

  /**
   * A GUILDA MUDOU, e o disco precisa saber.
   *
   * E aqui, num so lugar, porque `operarGuilda` e o caminho de tudo que
   * passa pelo `GuildStore`: convites, promocoes, expulsoes, lideranca,
   * cofre. Marcar em cada metodo do store seria a mesma regra escrita em
   * oito lugares, e uma delas esquecida seria uma guilda que so some em
   * silencio
   *
   * O `resultado` e conferido ANTES: uma recusa nao mudou nada, e marcar
   * o disco por ela faria cada tentativa errada virar uma escrita
   */
  this.marcarGuildaSuja();

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

  /**
   * A GUILDA NASCEU, e o disco precisa de imediato.
   *
   * Nao passa pelo `operarGuilda` porque a criacao e a unica operacao de
   * guilda que nao cabe naquele generic — ela e a unica que COBRA. E e
   * tambem a unica que precisa marcar aqui: e a primeira guilda do mundo,
   * e perder o sinalizador nela significaria um servidor inteiro rodando
   * sem nenhuma guilda gravada
   */
  this.marcarGuildaSuja();

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
     *
     * E vai para a SESSAO, e nao para o motor. No `searchResults` do
     * motor a busca de um jogador aparecia no painel dos outros: o motor
     * e compartilhado por todo mundo conectado, entao um campo dele e a
     * ultima busca que alguem fez
     */
    sessao.guildaBusca = this.guild.buscar(
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
 * ATRIBUI UM PONTO a um talento, e e o unico caso que GASTA pontos.
 *
 * O gasto e aqui e nao no store: os pontos moram na sessao e o store
 * nao sabe o saldo. Quem subtrai e o servidor, depois da recusa
 *
 * ## UM PONTO POR CLIQUE
 *
 * E o que foi pedido, e e o que muda a barra na tela: o no enche um
 * ponto de cada vez, e o nivel sobe quando a marca do proximo e
 * ultrapassada. O `resultado.custo` e sempre 1, e ele volta do store
 * para o servidor nao repetir o numero em dois lugares
 *
 * ## O AVISO SO QUANDO O NIVEL MUDA
 *
 * Quatro cliques no mesmo no produzem: tres cliques que so enchem a
 * barra e um que sobe o nivel. Avisar "Nv. 2!" nos quatro seria barulho e
 * ensinaria o jogador a ignorar o aviso — que e o caminho mais curto para
 * o jogador nao ler mais nada do painel
 */
  destravarTalent(sessao, pedido) {
  if (!this.guild) return false;

  const guilda = this.guild.guildaDoJogador(chaveDaSessao(sessao));

  if (!guilda) {
    this.mensagemDeGuilda("semGuilda");

    return false;
  }

  const resultado = this.guild.atribuirPonto(
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

  // o no recebeu um ponto: a arvore gravada no disco esta errada, e sem
  // isto o jogador voltaria com a barra zerada depois do reinicio
  this.marcarGuildaSuja();

  const node = getTalent(pedido.talentId);

  if (resultado.subiuDeNivel) {
    this.avisoDoDono(
      sessao,
      `${node?.nome ?? "Talento"} chegou ao Nv. ${resultado.nivel}!`,
    );
  }

  /**
   * O `applyEquipment` e o que faz o bonus novo valer AGORA, e nao no
   * proximo level up: sem esta chamada o jogador sobe o degrau, ve o
   * numero subir na arvore e nao sente nada no personagem ate fechar o
   * jogo
   */
  this.engine.applyEquipment();

  return true;
}

/**
 * O COFRE da guilda: deposita e saca moedas e itens. So a diretoria.
 *
 * ## POR QUE O SERVIDOR E QUEM MEXE NA MOCHILA
 *
 * O store cuida do cofre; a mochila e do jogador e mora na sessao. O
 * item tem que sair de um lado e chegar no outro dentro do MESMO pedido,
 * e quem enxerga os dois lados e o servidor. Passar pelo store exigiria
 * dar a mochila ao store, que e estado de jogador e nao de guilda
 *
 * ## A ORDEM DE CADA MOVIMENTO
 *
 * **Depositar**: o item sai da mochila primeiro e so depois entra no
 * cofre. Se o cofre recusar, o item volta inteiro — e a ordem contraria
 * (creditar o cofre e so entao tirar da mochila) deixaria o item duplicado
 * quando a retirada falhasse
 *
 * **Retirar**: o item sai do cofre depois que a mochila aceitou, e o
 * store recebe um `soltar` que devolve `false` se nao couber. E o
 * inverso do deposito pelo mesmo motivo: nao se tira do cofre antes de
 * ter lugar no destino
 *
 * Moedas nao tem esse problema de espaco e por isso vao pelo caminho
 * simples: um `spendCoins` que so chama o store se der
 */
  mexerNoCofre(sessao, pedido) {
  if (!this.guild) return false;

  const guilda = this.guild.guildaDoJogador(chaveDaSessao(sessao));

  if (!guilda) {
    this.mensagemDeGuilda("semGuilda");

    return false;
  }

  const chave = chaveDaSessao(sessao);

  /**
   * O CARGO, conferido AQUI e nao so no store.
   *
   * O `guild.mexerNoCofre` tambem confere, e ele precisa continuar
   * existindo porque e a entrada que os testes e o resto do jogo usam.
   * Mas este metodo ja nao passa por ele: ele chama os metodos
   * granulares do store (`sacarMoedas`, `depositarItem`), que nao sabem
   * QUEM esta chamando
   *
   * Sem esta conferida, a regra "so a diretoria mexe no cofre" existia
   * em um unico lugar, e o caminho do jogo real nao passava por ele —
   * qualquer membro comum depositava moedas. E o tipo de bug em que a
   * regra esta escrita, documentada e testada, e mesmo assim nao vale
   * para quem realmente usa
   */
  if (!podeGerenciar(guilda, chave)) {
    this.mensagemDeGuilda("semCargo");

    return false;
  }

  const acao = pedido.cofreAcao;

  const resultado = acao === "retirar"
    ? this.retirarDoCofre(sessao, guilda, chave, pedido)
    : this.depositarNoCofre(sessao, guilda, chave, pedido);

  if (!resultado.ok) {
    this.mensagemDeGuilda(resultado.motivo);

    return false;
  }

  /**
   * O COFRE MUDOU.
   *
   * E o estado que mais doi perder de uma guilda: um item depositado e
   * um item que pertence a vinte pessoas e esta na mochila de nenhuma
   * delas. Sem esta marca, o deposito do jogador sumiria no proximo
   * reinicio e ninguem saberia onde o item foi parar
   */
  this.marcarGuildaSuja();

  return true;
}

/**
 * DEPOSITA moedas ou um item da mochila no cofre.
 *
 * O `moeda` e o `item` sao mutuamente exclusivos e o `item` ganha: um
 * pedido com os dois preenchidos e um pedido malformado, e a regiao
 *usuario nao tem como querer as duas coisas de uma vez
 */
  depositarNoCofre(sessao, guilda, chave, pedido) {
  // ----- as moedas -----
  if (pedido.moeda !== undefined) {
    const moedas = Math.floor(Number(pedido.moeda) || 0);

    if (moedas <= 0) {
      return { ok: false, motivo: "quantidade" };
    }

    /**
     * O DINHEIRO SAI DA MOCHILA ANTES DE IR PARA O COFRE.
     *
     * O inverso creditaria o cofre e so entao tentaria cobrar, e um
     * `spendCoins` que falha deixaria a guilda com moedas que ninguem
     * depositou
     */
    if (!sessao.inventory.spendCoins(moedas)) {
      return { ok: false, motivo: "moedasInsuficientes" };
    }

    const guardado = this.guild.cofreDe(guilda);

    this.guild.depositarMoedas(guardado, moedas);

    this.avisoDoDono(sessao, `${moedas} moedas no cofre.`);

    return { ok: true };
  }

  // ----- um item -----
  if (pedido.item === undefined || pedido.item === null) {
    return { ok: false, motivo: "cofreInvalido" };
  }

  const stack = sessao.inventory.findByUid(pedido.item);

  if (!stack) {
    return { ok: false, motivo: "semPedido" };
  }

  const pedido2 = Math.floor(Number(pedido.quantidade) || 0);

  /**
   * A PILHA some do inventario e vai para o cofre, e o `taken` e a prova
   * do que saiu. O `taken` e usado em vez do `stack` original porque o
   * `takeUid` pode ter esvaziado a pilha e removido ela da mochila — usar
   * o `stack` depois disso seria ler um objeto que nao esta mais na lista
   */
  const taken = sessao.inventory.takeUid(pedido.item, pedido2);

  if (!taken || taken.count <= 0) {
    return { ok: false, motivo: "semPedido" };
  }

  const guardado = this.guild.depositarItem(
    this.guild.cofreDe(guilda),
    taken,
    taken.count,
  );

  /**
   * O COFRE RECUSOU: o item VOLTA.
   *
   * E o unico caminho do jogo em que um item volta para a mochila, e
   * ele existe porque a alternativa e o item sumir: o cofre estava
   * cheio, o item saiu da mochila, e se nao voltasse nem o jogador nem a
   * guilda teriam o que era dele
   */
  if (!guardado.ok) {
    sessao.inventory.add(
      taken.itemId,
      taken.count,
      taken.rarity,
    );

    return guardado;
  }

  this.avisoDoDono(sessao, `${guardado.count}x no cofre.`);

  return { ok: true };
}

/**
 * SACA moedas ou um item do cofre para a mochila.
 *
 * O `soltar` e a funcao que o store chama para colocar o item na mochila:
 * e ele quem sabe se cabe, e o store nao conhece a mochila
 */
  retirarDoCofre(sessao, guilda, chave, pedido) {
  // ----- as moedas -----
  if (pedido.moeda !== undefined) {
    const moedas = Math.floor(Number(pedido.moeda) || 0);

    if (moedas <= 0) {
      return { ok: false, motivo: "quantidade" };
    }

    const resultado = this.guild.sacarMoedas(
      this.guild.cofreDe(guilda),
      moedas,
    );

    if (!resultado.ok) return resultado;

    sessao.inventory.addCoins(moedas);

    this.avisoDoDono(sessao, `${moedas} moedas retiradas.`);

    return { ok: true };
  }

  // ----- um item -----
  if (pedido.uid === undefined || pedido.uid === null) {
    return { ok: false, motivo: "cofreInvalido" };
  }

  const resultado = this.guild.sacarItem(
    this.guild.cofreDe(guilda),
    pedido.uid,
    pedido.quantidade,

    /**
     * O DESTINO do item: a mochila do jogador.
     *
     * E uma funcao e nao a mochila direto porque o store nao deve
     * conhecer a `Inventory` — ele vive em `data/guild`/`game/guild` e a
     * mochila e estado de sessao. A funcao e a ponte, e o `soltar` devolve
     * o `{ added }` que o store confere para saber se coube tudo
     */
    (itemId, count, rarity) =>
      sessao.inventory.add(itemId, count, rarity),
  );

  if (!resultado.ok) return resultado;

  this.avisoDoDono(
    sessao,
    `${resultado.count}x ${resultado.itemId} retirado.`,
  );

  return { ok: true };
}

/* ------------------------------------------------------------------
     A ARENA DO CHEFE
     ------------------------------------------------------------------ */

  /**
   * LIGA O GANCHO DE "CHEFE CAIU" AO MOTOR.
   *
   * E aqui e nao no construtor porque a arena nao e um conceito do
   * motor: ele so avisa que um chefe caiu, e quem sabe o que fazer com a
   * arena e este servidor, que e quem tem as sessoes
   */
  conectarChefe() {
    this.engine.onChefeDerrotado = ({ map }) => {
      this.expulsarDaArena(map?.id);
    };
  }

  /**
   * A VITORIA: todo mundo que esta na arena volta para onde veio.
   *
   * ## POR QUE SAO TODOS, E NAO SO QUEM AJUDOU
   *
   * O chefe e da arena, e o loot e de quem matou. Mas o resto estava
   * dentro da luta acompanhando — e deixar quem nao conhececeu a vitoria
   * preso numa arena sem chefe nenhum e a pior das saidas: o botao de
   * sair existe, mas ele so traz a pessoa para ONDE ela entrou, e quem
   * entrou pela arena e nao tem um `arenaOrigem` fica la
   *
   * ## CADA UM VOLTA PARA O SEU
   *
   * O destino e o `arenaOrigem` da propria sessao. Nao ha um destino
   * comum porque a entrada e por um botao: cada um pode ter vindo de um
   * mapa diferente, e um "voltar para o hub" unico seria um teleport que
   * joga gente no lugar errado
   *
   * ## E O MOTOR QUE SABE QUEM ESTA LA
   *
   * `mapId` e por SESSAO, e a iteracao e sobre as sessoes conectadas.
   * Quem esta em outro mapa nem entra na conta — e nao ha como "sair" de
   * um lugar em que nao esta
   */
  expulsarDaArena(mapId) {
    if (!mapId) return 0;

    let expulsos = 0;

    /**
     * PELAS CHAVES, E NAO PELOS VALORES.
     *
     * `clients` e um `Map` guardado ao contrario: a chave e o cliente e o
     * valor e um `true` de presenca. Percorrer `.values()` daria uma file
     * de `true` sem sessao nenhuma, e ninguem seria expulsado — o
     * metodo rodaria inteiro sem errar e nao moveria um jogador sequer
     */
    for (const client of this.clients.keys()) {
      const sessao = client.session;

      if (!sessao || sessao.mapId !== mapId) continue;

      const origem = sessao.arenaOrigem;

      /**
       * SEM ORIGEM, O JOGADOR FICA.
       *
       * Nao ha um destino honesto para onde manda-lo: o mapa de origem
       * e desconhecido e inventar um seria um teleport sem razao. Quem
       * entrou por outra via — um comando de teste, um portal futuro —
       * e quem fica, e e o botao de sair da arena que resolve
       */
      if (!origem) continue;

      const destino = findMap(origem.mapId);

      if (!destino) continue;

      const chegou = this.moverParaMapa(
        sessao,
        destino,
        { x: origem.x, y: origem.y },
      );

      if (!chegou) continue;

      sessao.arenaOrigem = null;
      expulsos += 1;

      this.avisoDoDono(
        sessao,
        "O chefe caiu. Voce voltou para onde estava.",
      );
    }

    return expulsos;
  }

  /**
   * O BOTAO DA ARENA: entra, e o segundo clique traz de volta.
   *
   * ## UM `op`, DOIS SENTIDOS
   *
   * O botao e um so e o pedido e um so. Quem decide o sentido e o mapa em
   * que o jogador esta — dois `op` dependeriam de o cliente saber em que
   * mapa ele esta, e um cliente desatualizado travaria o jogador na
   * arena sem nenhum botao para sair
   *
   * ## O DESTINO NAO VEM DO CLIENTE
   *
   * O pedido nao tem mapa nenhum. A arena e `boss_1` porque o servidor
   * diz que e, e o destino da volta e a posicao que o SERVIDOR guardou.
   * Um `mapa` vindo do cliente daria a qualquer um um teletransporte
   * para onde quisesse — o mesmo motivo que o `travessarPortal` nao
   * aceita destino
   *
   * ## POR QUE A POSICAO E DA SESSAO E NAO DO SAVE
   *
   * A volta e "para onde eu estava", e isso e estado de UMA visita. Se
   * gravasse no save, o jogador que entrasse na arena, desconectasse e
   * voltasse um dia depois teria o destino sobrescrito por outra
   * visita — e a "volta" levaria a um lugar de horas atras. A sessao
   * morre com a conexao, entao a posicao guardada pertence a visita que
   * a guardou
   */
  irParaArena(sessao) {
    if (!sessao) return false;

    const arena = findMap(ARENA_ID);

    if (!arena) return false;

    const naArena = sessao.mapId === ARENA_ID;

    /**
     * A SESSAO PRECISA DE MAPA PARA ONDE VOLTAR.
     *
     * Sem isso, o primeiro clique numa conexao nova gravaria `base` como
     * destino e a volta jogaria o jogador no meio do hub em vez de onde
     * ele realmente estava
     */
    const origem = sessao.arenaOrigem ?? null;

    if (naArena) {
      if (!origem) {
        // entrou na arena por outro caminho (um portal, um comando de
        // teste): nao ha onde voltar, e ficar e melhor do que inventar
        // um destino
        return false;
      }

      this.moverParaMapa(
        sessao,
        findMap(origem.mapId),
        { x: origem.x, y: origem.y },
      );

      sessao.arenaOrigem = null;

      return true;
    }

    /**
     * A POSICAO DE HOJE e guardada ANTES da troca.
     *
     * Ler depois seria ler a posicao da arena, e a volta jogaria o
     * jogador no meio dela duas vezes
     */
    sessao.arenaOrigem = {
      mapId: sessao.mapId,
      x: Math.round(sessao.player?.x ?? arena.spawn.x),
      y: Math.round(sessao.player?.y ?? arena.spawn.y),
    };

    this.moverParaMapa(sessao, arena, null);

    return true;
  }

  /**
   * TROCA O MAPA DE UMA SESSAO, e a POSICAO.
   *
   * ## POR QUE DENTRO DO `withPlayer`
   *
   * O `setMap` do motor escreve em `this.world.session` e em
   * `this.world.player`, e o `world` e do jogador EM FOCO. Sem o
   * `withPlayer`, trocar o mapa do jogador errado moveria o mapa de quem
   * estivesse em foco e nao do que pediu — que e o bug que o
   * `portalSoDeUm` trava
   *
   * ## A POSICAO E DO `setMap`, E NAO MINHA
   *
   * O `setMap` ja posiciona: `chegada ?? map.spawn`. Reescrever a
   * posicao aqui[l] fora criaria dois lugares que podem divergir — e o
   * `setMap` sozinho colocaria o jogador no spawn da arena, que e
   * exatamente o que se quer na entrada
   *
   * A unica coisa que este metodo acrescenta e a conferida da chegada,
   * que o `setMap` nao faz
   *
   * ## A CONFERIDA ANTES, E O `world.collision` JA DO MAPA NOVO
   *
   * O `isInsideBounds` roda ANTES do `setMap`, entao ele ainda consulta
   * o colisor do mapa de ORIGEM — que e retangular e sempre aceitaria
   * qualquer ponto. Conferir depois do `setMap` deixaria o motor ja ter
   * pulado o jogador para fora da arena, e a correcao viria do `clamp`
   * do proximo tick: ele apareceria na borda, sem explicacao
   *
   * Por isso a conferida e contra o colisor que acabamos de montar, e
   * nao contra o que esta no `world`
   */
  moverParaMapa(sessao, mapa, chegada) {
    if (!mapa) return false;

    let trocou = false;

    this.engine.withPlayer(sessao.id, () => {
      /**
       * O COLISOR DO MAPA DESTINO, montado sem troca de mapa.
       *
       * `contextoDoMapa` e o que `setMap` usa para montar o mundo. Pedir
       * o contexto e ler so o `collision` dele nao troca mapa nenhum, e
       * e o que faz a conferida valer para o mapa que o jogador VAI
       * entrar e nao para o de onde ele sai
       */
      if (chegada) {
        const contexto = this.engine.contextoDoMapa(mapa);

        const dentro = contexto.collision.isInsideBounds(
          { x: chegada.x, y: chegada.y },
          RAIO_DO_JOGADOR,
        );

        if (!dentro) return;
      }

      this.engine.setMap(mapa, { chegada });

      trocou = true;
    });

    return trocou;
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
          this.travessarPortal(pedido.portalId, sessao);
          break;

        case PANEL_OPS.IR_PARA_ARENA:
          this.irParaArena(sessao);
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

        /**
         * USAR um consumivel da mochila.
         *
         * O `usarItem` e do motor e devolve `false` quando nao fez
         * nada — item que nao existe, item sem `use`, ou vida ja cheia.
         * So o primeiro motivo e erro do jogador; os outros dois sao
         * o jogo respondendo "agora nao", e uma mensagem de erro para
         * eles seria o painel chamando de erro o que nao e
         */
        case PANEL_OPS.USE_ITEM: {
          const usou = this.engine.usarItem(pedido.uid);

          if (!usou && !pedido.uid) {
            this.engine.showMessage(
              "Escolha um item para usar.",
              true,
            );
          }

          break;
        }

        /**
         * AS DUAS SAIDAS DA MORTE.
         *
         * Os dois casos sao delegados ao motor e nao tem preco aqui: o
         * motor tem o `level` que define o custo do revive, e o `xp`
         * que a perda de XP desconta. O servidor so garante que quem
         * pediu esta morto — sem isso, `REVIVER` viraria um jeito de
         * recarregar vida cheia de graça em qualquer momento
         *
         * A recusa de um jogador VIVO e silenciosa de proposito: o
         * painel so existe quando o jogador esta morto, entao um pedido
         * desses so pode vir de um cliente modificado. E o
         * `return false` do motor ja e a resposta
         */
        case PANEL_OPS.REVIVER:
          if (this.engine.jogadorMorto()) {
            this.engine.reviverComOuro();
          }

          break;

        case PANEL_OPS.VOLTAR_BASE:
          if (this.engine.jogadorMorto()) {
            this.engine.voltarParaBase();
          }

          break;

        /**
         * O TELEPORTE, e por que o pedido nao leva coordenada.
         *
         * O destino vem do `travelPlan` que o proprio motor montou, e nao
         * do pedido. Um pedido com `x`/`y` deixaria qualquer cliente se
         * mandar para o ponto que quisesse — inclusive pelo meio de uma
         * arvore ou de uma parede, que e onde a walk real nunca entraria
         *
         * A recusa e o aviso do proprio motor, nao um `showMessage`
         * aqui: sao tres motivos possiveis (sem viagem, sem pergaminho,
         * destino em outro mapa) e cada um tem sua frase
         */
        case PANEL_OPS.TELEPORTAR:
          this.engine.teleportarParaOFim();
          break;

        // a loja do mercador tambem e do motor, e nao do bloco do
        // mercado acima: so uma sessao entra nesta conta
        case PANEL_OPS.BUY_POTION:
          this.comprarPocao(sessao, pedido);
          break;

        /**
         * A LOJA DO MESTRE, pelo mesmo motivo da do mercador: uma sessao
         * so, e o preco vem do catalogo do servidor
         */
        case PANEL_OPS.BUY_SKILL_BOOK:
          this.comprarLivro(sessao, pedido);
          break;

        /**
         * A PARTY.
         *
         * Quatro operacoes e um bloco so, porque todas precisam da MESMA
         * coisa depois: reenviar o estado da party para todo mundo
         * envolvido. Uma party que so atualiza quem pediu deixa os
         * outros com a box velha na tela
         */
        case PANEL_OPS.PARTY_INVITE:
        case PANEL_OPS.PARTY_CREATE:
        case PANEL_OPS.PARTY_INVITE_BY_NAME:
        case PANEL_OPS.PARTY_ACCEPT_INVITE:
        case PANEL_OPS.PARTY_KICK:
        case PANEL_OPS.PARTY_FOLLOW:
        case PANEL_OPS.PARTY_FOCUS:
        case PANEL_OPS.PARTY_TRANSFER:
        case PANEL_OPS.PARTY_LEAVE:
          this.tratarParty(sessao, pedido);
          break;

        // um `op` de outra versao do cliente. o motor fica como esta:
        // e o servidor que decide o que existe
        default:
          break;
      }
    });
  }

  /**
   * Uma operacao de PARTY.
   *
   * Todas as quatro caem aqui, e todas terminam em
   * `reenviarPartyDe`: quem participa de uma party precisa ver a caixa
   * nova, inclusive quem NAO pediu nada
   */
  tratarParty(sessao, pedido) {
    const store = this.parties;

    let resultado;

    switch (pedido.op) {
      case PANEL_OPS.PARTY_CREATE: {
        /**
         * A PARTY DE UM SO.
         *
         * E o que faz o campo do nick aparecer: sem estar numa party o
         * jogador esta FORA de party, e a caixa mostra so [Criar party]
         */
        resultado = store.criar(sessao.id);

        break;
      }

      case PANEL_OPS.PARTY_INVITE: {
        /**
         * O CONVITE PELO CLIQUE no personagem.
         *
         * O cliente manda o id do jogador mirado, e o servidor procura a
         * sessao. Nao e confiavel: um id de sessao forjado cairia em
         * `null` e o convite nao sairia
         */
        const alvo = pedido.alvoId
          ? this.engine.world.players.get(pedido.alvoId)
          : null;

        if (!alvo) {
          resultado = { ok: false, motivo: "Jogador não encontrado" };
          break;
        }

        resultado = store.convidar(sessao.id, alvo, this.engine.world);

        if (resultado.ok) {
          this.enviarConvite(alvo.id, resultado.convite);
        }

        break;
      }

      case PANEL_OPS.PARTY_INVITE_BY_NAME: {
        resultado = store.convidarPorNome(
          sessao.id,
          pedido.nome,
          this.engine.world,
        );

        if (resultado.ok) {
          const alvo = store.conviteRecebidoDe(resultado.convite);

          if (alvo) this.enviarConvite(alvo, resultado.convite);
        }

        break;
      }

      case PANEL_OPS.PARTY_ACCEPT_INVITE: {
        /**
         * A LISTA DE QUEM VAI RECEBER.
         *
         * E montada ANTES do aceite, porque sair pode dissolver a party
         * de alguem. Quem foi excluido do grupo nao recebe nada
         */
        resultado = store.aceitarConvite(sessao.id, this.engine.world);

        if (resultado.ok) {
          const ids = [...resultado.party.membros];

          this.reenviarParty(ids);
        }

        this.enviarConviteFechado(sessao.id);

        break;
      }

      case PANEL_OPS.PARTY_KICK: {
        /**
         * A EXPULSAO.
         *
         * O `alvoId` vem do cliente e nao e confiavel: quem valida e o
         * `PartyStore`, que confere se quem pede e mesmo o lider
         */
        resultado = store.expulsar(sessao.id, pedido.alvoId);

        if (resultado.ok) {
          this.reenviarParty(resultado.avisar);
        }

        break;
      }

      case PANEL_OPS.PARTY_FOLLOW: {
        /**
         * SEGUIR UM MEMBRO.
         *
         * O `alvoId` so pode ser alguem da MINHA party: seguir um
         * jogador qualquer pelo socket transformaria o botao em um
         * rastreador, e o alvo nao receberia nem o pedido
         */
        const membros = store.membrosDe(sessao.id);

        if (!membros.includes(pedido.alvoId)) {
          resultado = { ok: false, motivo: "Ele não está na sua party" };
          break;
        }

        // o mesmo botao desliga: clicar em quem ja se segue CANCELA
        resultado =
          sessao.seguindoId === pedido.alvoId
            ? { ok: true, parou: true }
            : { ok: true };

        if (resultado.parou) {
          this.engine.pararDeSeguir();
        } else {
          /**
           * O `seguirJogador` liga o Auto por conta propria.
           *
           * O motor precisa saber que foi ele quem ligou, para
           * desligar quando chegar do lado. Se o servidor ligasse aqui,
           * o motor desligaria um Auto que ja estava ligado antes e o
           * jogador perderia a cacada que tinha ligada
           */
          this.engine.seguirJogador(pedido.alvoId);
        }

        break;
      }

      case PANEL_OPS.PARTY_FOCUS: {
        /**
         * LIGAR OU DESLIGAR O FOCO DO LIDER.
         *
         * O pedido manda o estado (`ativo`), e nao um "inverter": com
         * dois cliques rapidos no botao, um "inverter" acabaria no
         * estado inicial — e o jogador teria clicado duas vezes para
         * tentar desligar e descobrir que nao desligou
         *
         * O `ativo` chega como `null` quando o pedido nao traz, e `null`
         * e diferente de `false`: `null` e "nao pedi nada", e por isso o
         * estado NAO muda. Sem esta distincao, um pedido viria com o
         * interruptor desligado sem ninguem ter clicado nele
         *
         * O `focarLider` mora na SESSAO porque e uma escolha de cada
         * um. O motor e quem le, no `runAutoHunt`
         */
        if (!store.partyDe(sessao.id)) {
          resultado = { ok: false, motivo: "Voce nao esta em party" };
          break;
        }

        if (pedido.ativo === null || pedido.ativo === undefined) {
          resultado = { ok: false, motivo: "Faltou o estado do foco" };
          break;
        }

        sessao.focarLider = Boolean(pedido.ativo);

        resultado = { ok: true, focarLider: sessao.focarLider };

        break;
      }

      case PANEL_OPS.PARTY_TRANSFER: {
        /**
         * PASSAR A LIDERANCA.
         *
         * E o unico caso em que o pedido traz um `alvoId` que NAO e
         * um convite nem uma expulsion: e o novo lider. O alvo tem que
         * estar na party — passar a lideranca para quem esta fora da
         * grupo nao faria sentido
         */
        const party = store.partyDe(sessao.id);

        if (!party) {
          resultado = { ok: false, motivo: "Voce nao esta em party" };
          break;
        }

        if (party.lider !== sessao.id) {
          resultado = { ok: false, motivo: "So o lider passa a lideranca" };
          break;
        }

        const membros = store.membrosDe(sessao.id);

        if (!membros.includes(pedido.alvoId)) {
          resultado = { ok: false, motivo: "Ele nao esta na party" };
          break;
        }

        if (pedido.alvoId === sessao.id) {
          resultado = { ok: false, motivo: "Voce ja e o lider" };
          break;
        }

        party.lider = pedido.alvoId;

        this.engine.withPlayer(pedido.alvoId, () => {
          this.engine.showMessage("Voce agora e o lider da party.");
        });

        resultado = { ok: true, lider: pedido.alvoId };

        /**
         * O GRUPO INTEIRO RECEBE A CAIXA NOVA.
         *
         * Sem isto, so a tela de quem pediu era atualizada — e quem
         * acabara de virar lider continuaria vendo a etiqueta do lider
         * antigo e sem nenhum botao `L`, que e exatamente "passar
         * lideranca nao funciona" do ponto de vista de quem recebeu
         */
        this.reenviarParty(store.membrosDe(sessao.id));

        break;
      }

      case PANEL_OPS.PARTY_LEAVE: {
        const antes = store.membrosDe(sessao.id);

        resultado = store.sair(sessao.id);

        if (resultado.ok) {
          /**
           * O QUE SAI JUNTO COM A PARTY.
           *
           * Sair do grupo nao pode deixar o resto ligado: um `focarLider`
           * apontando para o lider que nao existe mais e um `seguindoId`
           * para alguem que acabou de sair. Sem esta limpeza, a sessao
           * guarda as duas coisas e o jogador voltaria a cacar e a andar
           * atras de ninguem quando entrasse em outra party
           */
          sessao.focarLider = false;
          sessao.seguindoId = null;

          const ids = new Set([...antes, ...(resultado.restantes ?? [])]);

          /**
           * O LIGAMENTO DOS QUE FICARAM, NAO SO O DE QUEM SAIU.
           *
           * Esta e a parte que faltava, e ela so aparecia quando quem
           * saia era o LIDER. Os dois lados da party guardavam o
           * `focarLider` e o `seguindoId` um no outro: o lider focando
           * o membro, o membro seguindo o lider.
           *
           * Quando saia um MEMBRO qualquer, a limpeza de uma linha
           * bastava, porque o par nao existia mais. Quando saia o
           * LIDER, o membro que ficava continuava com `focarLider`
           * ligado e com `seguindoId` apontando para quem tinha saido
           * ligado e com seguindoId apontando para quem tinha saido.
           * O ocoDoLidorAtivo do motor so desliga por causa da
           * party, entao um vestigio de um grupo que nao existe mais
           *
           * A limpeza e por REFERENCIA: so quem apontava para quem
           * A limpeza e por REFERENCIA: so quem apontava para quem
           * continua seguindo, porque aquilo nao tem nada a ver com a
           * saida
           */
          for (const id of resultado.restantes ?? []) {
            const outro = this.engine.world.players.get(id);

            if (!outro) continue;

            if (outro.seguindoId === sessao.id) {
              outro.seguindoId = null;
            }

            if (outro.focarLider) {
              outro.focarLider = false;
            }
          }

          this.reenviarParty([...ids]);
        }

        break;
      }

      default:
        resultado = { ok: false };
        break;
    }

    /**
     * A CAIXA DE QUEM PEDIU.
     *
     * Vai no `PLAYER_STATE` e nao num evento separado: e estado do
     * jogador, e o `snapshot` ja viaja a 20Hz para todo mundo
     */
    this.enviarPartyNoPainel(sessao.id);

    if (!resultado?.ok && resultado?.motivo) {
      this.engine.showMessage(resultado.motivo, true);
    }
  }

  /** Manda o convite para QUEM foi convidado, e so para ele. */
  enviarConvite(sessionId, convite) {
    this.enviarPara(sessionId, SERVER_EVENTS.PARTY_INVITE_RECEIVED, {
      de: {
        id: convite.de,
        nome: convite.nome,
        classe: convite.classe,
      },
      partyId: convite.partyId,
      expiraEm: convite.expiresAt,
      ttl: PARTY_INVITE_TTL,
    });
  }

  /** Fecha a caixa de convite de quem RECEBEU, aceitando ou expirando. */
  enviarConviteFechado(sessionId) {
    this.enviarPara(sessionId, SERVER_EVENTS.PARTY_INVITE_CLOSED, {});
  }

  /** Reenvia o estado da party para cada id envolvido. */
  reenviarParty(sessionIds) {
    for (const id of sessionIds) {
      this.enviarPartyNoPainel(id);
    }
  }

  /** Escreve o bloco `party` no painel de um jogador. */
  enviarPartyNoPainel(sessionId) {
    const sessao = this.engine.world.players.get(sessionId);

    if (!sessao) return;

    sessao.party = this.parties.snapshot(sessionId, this.engine.world);
  }

  /**
   * Um pacote para UM jogador.
   *
   * E o que o convite usa: ele vai so para quem foi convidado, porque
   * saber que alguem convidou alguem e informacao de terceiro
   */
  enviarPara(sessionId, evento, payload) {
    /**
     * Percorre as CHAVES do `clients`.
     *
     * O valor do Map e um booleano de "conectado", nao o cliente. Contar
     * os valores contaria quantos `true` tem o mapa, e sempre errado
     */
    for (const client of this.clients.keys()) {
      if (!client.joined) continue;

      if (client.session?.id !== sessionId) continue;

      client.enviar(evento, payload);
    }
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

    /**
     * O GOLPE NA BASE.
     *
     * A autoridade esta no servidor, entao a recusa mora aqui e nao no
     * cliente. A checagem e DENTRO do `withPlayer` e nao antes dele: o
     * `world.map` e o do jogador em FOCO, e o `withPlayer` de baixo e que
     * troca esse foco. Contar pelo `sessao.mapId` aqui em cima daria a
     * mesma resposta, mas o `emZonaDeCombate` do motor e a regra
     * unica — duas copias da condicao divergem na primeira vez que uma
     * delas for esquecida
     *
     * O aviso vai pelo `showMessage`, e nao por `SERVER_EVENTS.REJECTED`:
     * o `REJECTED` muda o STATUS da conexao para recusado, e o status de
     * quem ja esta jogando e `JOGANDO` — a recusa chegava e nao aparecia
     * em lugar nenhum. O `showMessage` e o mesmo caminho do "Mochila
     * cheia.", que o jogador le
     */
    this.engine.withPlayer(sessao.id, () => {
      const ehGolpe =
        action === "BASIC_ATTACK" ||
        (targetId !== null && targetId !== undefined);

      if (!this.engine.emZonaDeCombate() && ehGolpe) {
        this.engine.showMessage(REJECT.NO_COMBAT_IN_BASE, true);

        return;
      }

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
    /**
     * O MAPA DE ENTRADA, e nao `world.map`.
     *
     * Cada jogador tem o seu mapa agora, e o `world` so aponta para o
     * do ultimo em foco. Um jogador que entra enquanto outro esta no
     * vale nasceria no vale, do outro lado do portal, sem ter clicado em
     * nada
     */
    const { spawn, bounds } = this.mapaInicial;

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
    if (!this.mapaInicial.resumeWhereLeftOff) {
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
    /**
     * O CACHE DE DROPS MORRE AQUI, todo tick.
     *
     * `estadoDrops` e a unica lista do pacote que nao depende de QUEM
     * recebe: ela ve `world.drops`, que e o mapa em foco. Dentro de um
     * tick os drops ja foram simulados (`engine.update` roda antes do
     * broadcast) e nao mudam mais, entao a mesma lista serve para todo
     * mundo daquele mapa
     *
     * Zerar por tick, e nao por chamada, e o que impede servir lista
     * velha: o `coletarDropDoChao` roda dentro de `engine.update` e
     * remove drops do array. Sem o reset, o pacote do proximo tick
     * repetiria um drop que alguem acabou de pegar
     */
    this.dropsDoTick = null;
    this.dropsDoTickMapa = null;

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

    /**
     * O PRAZO DOS CONVITES.
     *
     * Corre aqui pelo mesmo motivo dos anuncios: o jogador parado tambem
     * precisa ver o convite sair de perto. Sem este `tick`, o convite
     * ficaria na tela ate o jogador clicar em algo, e o aceite seria
     * recusado pelo servidor com "o convite expirou" — a caixa ficaria
     * morta na frente de quem nao fez nada de errado
     */
    const expirados = this.parties.tick(this.engine.world);

    for (const alvo of expirados) {
      this.enviarConviteFechado(alvo.sessionId);
      this.enviarPartyNoPainel(alvo.sessionId);
    }

    for (const client of this.clients.keys()) {
      if (!client.joined) continue;

      /**
       * CADA PACOTE E MONTADO COM O DONO EM FOCO.
       *
       * O `world` do motor e um so, e ele aponta para o mapa de quem
       * esta em foco. Montar o pacote de todos fora do `withPlayer`
       * mandaria o elenco de inimigos, os drops e os projeteis do
       * ultimo jogador processado para todo mundo
       *
       * E o `focusPlayer` que troca o `world` para o mapa de quem esta
       * em foco. Sem esta linha, o jogador que NAO atravessou o portal
       * veria os mobs do mapa do outro
       */
      this.engine.withPlayer(client.id, () => {
        client.enviar(SERVER_EVENTS.SNAPSHOT, {
          seq: ++this.seq,
          time: this.engine.world.time,

          /**
           * EM QUE MAPA ESTE JOGADOR.
           *
           * E o que faz o cliente acompanhar uma travessia: quando o
           * servidor troca o mapa do jogador, este id muda e o
           * `NetworkWorld` troca o motor tambem
           *
           * Sai da SESSAO e nao de `world.map`. O `world` e o mapa do
           * jogador em foco, e ler dele aqui seria mandar o mapa do
           * outro para quem nao atravessou — que e o bug de todo mundo
           * atravessar o portal junto
           */
          mapa: client.session.mapId,

        players: this.estadoJogadores(client),
          enemies: this.estadoInimigos(client),
          drops: this.estadoDrops(),
          projectiles: this.estadoProjetis(client),
        });
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

    /**
     * `painelSolicitado` diz ao motor que ESTE painel tem dono.
     *
     * O motor tem `painelExterno` ligado e usa isso para nao montar painel
     * de ninguem: uma acao de combate dispara um `sendSnapshot` por
     * efeito colateral, e sem esta flag o painel de ~154KB era montado e
     * descartado em cada golpe, cada loot e cada missao
     *
     * O `finally` abaixa de novo. Sem ele, um painel que estourasse no
     * `catch` deixaria a flag ligada e o motor passaria a montar painel
     * para o vazio de novo — o desperdicio voltaria sem ninguem perceber
     */
    this.engine.painelSolicitado = true;

    try {
      /**
       * A EXPIRACAO DE ANUNCIOS NAO ESTA AQUI, e no `tick`.
       *
       * Ela rodava neste ponto alem do `tick`, uma vez por cliente: o
       * topo do tick ja expirava tudo, e estas n chamadas seguintes
       * recebiam a lista vazia para percorrer de novo. Com 50 jogadores
       * eram 51 varreduras de todos os anuncios por tique, a 20Hz, para
       * um resultado identico — nenhuma anunciacao vence o prazo dentro
       * da mesma fracao de segundo em que o tick roda
       *
       * A ordem que o comentario antigo protegia continua valendo, e e
       * a que importa: o `tick` expira ANTES do laco de painel, entao o
       * item volta para a mao do dono no mesmo instante em que o anuncio
       * some da vitrine dele. So mudou de lugar, nao de efeito
       */
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
      this.engine.painelSolicitado = false;
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
  estadoJogadores(client) {
    const lista = [];

    /**
     * SO QUEM ESTA NO MESMO MAPA.
     *
     * Cada jogador tem o seu mapa agora, e as coordenadas de um mapa
     * nao significam nada no outro: mandar todo mundo faria o Bento
     * aparecer no hub do Ana, no meio do calcamento, enquanto o Bento
     * estava no vale. E o cliente nao tem como saber que o boneco dele
     * esta em outro mapa — ele so recebe uma posicao
     */
    const meuMapa = this.engine.world.session?.mapId;

    /**
     * A REFERENCIA DA DISTANCIA e o boneco de QUEM RECEBE.
     *
     * `client`, e nao `world.player`: o `world` ja foi virado para o mapa
     * de quem esta em foco, e `estadoInimigos` mede a partir de
     * `client.session.player` pelo mesmo motivo. Medir a partir do mundo
     * daria a posicao do ultimo focado, e o filtro viraria um bug que so
     * aparece com mais de um jogador no mapa
     */
    const px = client?.session?.player?.x ?? 0;
    const py = client?.session?.player?.y ?? 0;

    for (const sessao of this.engine.world.players.values()) {
      if (sessao.mapId !== meuMapa) continue;

      const p = sessao.player;

      /**
       * E O MESMO RAIO DOS INIMIGOS, e nao um novo.
       *
       * O `estadoInimigos` ja filtra por `INTERESSE_QUADRADO` desde antes,
       * entao o cliente ja convive com mob sumindo na borda. Reusar o
       * mesmo raio mantem uma regra so: "o que esta a mais de 1000px nao
       * existe para a tela". Um raio diferente para jogador criaria duas
       * bordas visiveis, e um boneco que some antes do mob ou depois dele
       *
       * O jogador e sempre incluido: a distancia dele para ele mesmo e 0.
       * O `estadoJogadores` alimenta o `eu` do cliente, e sem esta entrada
       * ele perderia a propria posicao e o boneco sairia da tela
       *
       * Custo que isto tira: a lista ia de O(n) para todo mundo no mapa
       * receber todo mundo no mapa, a 20Hz. Com 50 jogadores no mesmo
       * mapa, a banda de jogadores era 50 x 50 registros por pacote — e o
       * array `players` cresce com n, entao o total era O(n^2). Agora e
       * O(n) e so cresce com quem esta por perto
       */
      const dx = p.x - px;
      const dy = p.y - py;

      if (dx * dx + dy * dy > INTERESSE_QUADRADO) continue;

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

  /**
   * os drops no chao, com o dono de cada um
   *
   * Cacheado por mapa dentro do tick. Este e o unico pacote do
   * broadcast que NAO depende de quem recebe: `estadoInimigos` e
   * `estadoProjetis` filtram por distancia a partir do cliente, e
   * `estadoJogadores` tambem, mas os drops sao do mapa inteiro para todo
   * mundo
   *
   * Antes disso o `.map` rodava uma vez por cliente por tick, realocando
   * D objetos e D arrays aninhados n vezes para produzir n listas
   * identicas. Com 50 jogadores e 40 drops no chao, eram 2000 objetos
   * por tick descartados — e o `JSON.stringify` logo abaixo transformava
   * cada uma em bytes identicos
   */
  estadoDrops() {
    const mapa = this.engine.world.session?.mapId ?? null;

    if (this.dropsDoTick && this.dropsDoTickMapa === mapa) {
      return this.dropsDoTick;
    }

    const lista = this.engine.world.drops.map((d) => ({
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

    this.dropsDoTickMapa = mapa;
    this.dropsDoTick = lista;

    return lista;
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

    /**
     * O CACHE do rank fica velho assim que um save muda.
     *
     * A invalidacao vem ANTES do `try` de proposito: o cache pode ficar
     * desatualizado para o resto do ciclo, mas nunca errado. Se o
     * `salvar` falhar o cache e recomputado a toa, que e o preco barato
     */
    this.savesEmCache = null;

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

  /**
   * OS PERSONAGENS SALVOS, lidos do disco.
   *
   * E o que alimenta o rank com quem esta offline. Devolve o SAVE
   * direto, e nao um embrulho `{ nome, save }`: o proprio save ja tem
   * `name` dentro (`snapshotSession` grava), e embrulhar fazia o
   * `montarRank` ler `player.level` de `undefined` — todo offline
   * entrava na tabela como nivel 1
   *
   * Um arquivo ilegivel e pulado em vez de derrubar a lista inteira:
   * perder um personagem no rank e melhor do que o painel de todo
   * mundo ficar sem rank
   */
  listaDePersonagensSalvos() {
    if (!this.saves) return [];

    if (this.savesEmCache) return this.savesEmCache;

    const lista = [];

    for (const nome of this.saves.listar()) {
      const salvo = this.saves.carregar(nome);

      if (salvo && isReadableSave(salvo)) {
        lista.push(salvo);
      }
    }

    this.savesEmCache = lista;

    return lista;
  }

  /**
   * Sai de jogador, e so UMA vez.
   *
   * O `ws` emite `error` e `close` juntos quando o erro vem do
   * protocolo (`emitErrorAndClose`), e o `index.js` escuta os dois. Sem
   * o flag, a segunda chamada achava `client.joined` ainda verdadeiro,
   * gravava o MESMO save outra vez e mandava `PLAYER_LEFT` com o nome
   * `"?"` — porque o `removePlayer` da primeira passada ja tinha
   * tirado a sessao do mundo, entao `anunciar` nao achava mais o
   * jogador. Todo mundo no mapa via um jogador chamado `"?"` sumir
   */
  desconectar(client) {
    this.clients.delete(client);

    if (!client.joined) return;

    // o `joined` e zerado ANTES de qualquer trabalho: e o que torna a
    // segunda chamada um no-op
    client.joined = false;

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

    /**
     * O indice por golpe sai junto, e so se AINDA for este cliente.
     *
     * A mesma defesa do `sessoesPorDono` acima: com o mesmo personagem em
     * duas abas, a segunda entrada sobrescreveu a chave `player` no
     * indice. Apagar sem conferir tiraria o socket novo, e os numeros de
     * dano da pessoa que CONTINUA online parariam de aparecer
     */
    if (this.clientePorJogador.get(sessao?.player) === client) {
      this.clientePorJogador.delete(sessao.player);
    }

    // O save acontece ANTES de a sessao sair do mundo: depois do
    // `removePlayer` nao ha mais sessao para ler
    this.guardar(sessao);

    /**
     * A PARTY ANTES DE SAIR DO MUNDO.
     *
     * Sair limpa a party e reenvia o estado para quem sobrou. O
     * `removePlayer` vem depois: se viesse antes, o `enviarPartyNoPainel`
     * nao acharia mais a sessao de quem ficou
     */
    const antesDaParty = this.parties.membrosDe(sessao?.id ?? "");

    this.parties.remover(sessao?.id);

    if (antesDaParty.length > 0) {
      this.reenviarParty(antesDaParty);
    }

    // o `anunciar` precisa do nome, entao roda ANTES do `removePlayer`
    this.anunciar(client.id, false);

    this.engine.removePlayer(client.id);
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
    if (this.saves || this.mercado || this.guilda) {
      this.intervaloDeSave = setInterval(() => {
        this.guardarTodos();
        this.guardarMercado();
        this.guardarGuildas();
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
        const inicioTique = Date.now();

        this.tick(this.config.tickSeconds);

        // quanto o tique LEVOU, e nao o intervalo entre tiques. e o
        // numero que diz se o mundo cabe no orcamento de 50ms
        this.duracaoAcumuladaMs += Date.now() - inicioTique;
        this.tiquesRodados = (this.tiquesRodados ?? 0) + 1;

        /**
         * A MESMA DURACAO na janela deslizante.
         *
         * Escreve por sobrescrita na posicao atual e avanca o cursor: e
         * o que mantem o array com tamanho fixo sem `shift`, que
         * reindexaria 200 elementos a cada tique
         */
        this.janelaTick[this.janelaTickPos] =
          Date.now() - inicioTique;

        this.janelaTickPos =
          (this.janelaTickPos + 1) % JANELA_TICK;

        if (this.janelaTickPos === 0) this.janelaTickCheia = true;

        // O contador e de ERROS SEGUIDOS, entao volta a zero no
        // primeiro tique bom.
        //
        // Sem isso ele contava erros na VIDA INTEIRA do processo: tres
        // excecao isoladas — uma as 3h da manha, outra no meio de uma
        // batalha, outra um dia depois — paravam o laco para sempre sem
        // ninguem saber por que. O teste queexistia fixava o numero
        // em 1 depois de um tique bom, o que so faz sentido se ele
        // contar consecutividade: um erro que ja passou nao conta
        this.errosDeTick = 0;
      } catch (erro) {
        this.acumulado = 0;

        this.errosDeTick += 1;
        console.error(
          "[tick] erro ao rodar o mundo:",
          erro?.stack ?? erro,
        );

        // tres erros SEGUIDOS: o mundo esta em um estado que nao se
        // recupera sozinho. melhor parar o laco e dizer do que queimar
        // cpu 20 vezes por segundo
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

  /**
   * A SAUDE DO LACO, para um monitor olhar.
   *
   * O que interessa nao e so "o `setInterval` existe", e "o mundo
   * avanca". Um tique que demora mais que o orcamento atrasa todo o
   * resto: e o que o jogador sente como lag
   *
   * `atrasoMs` e o quanto o intervalo de verdade estourou o`tique`. Um
   * valor grande e pessimo: o `avancarTempo` roda mais tiques de
   * recuperacao, e o servidor fica sempre dois passos atras
   */
  /**
   * A MEDIA dos tiques que ainda estao na janela, ou `null`.
   *
   * Percorre a janela INTEIRA, incluindo as posicoes que ainda nao
   * foram escritas: elas sao zero, e somar zero nao muda a media. O
   * truque esta no `n` — e o que decide se divide pelo numero de tiques
   * REALMENTE medidos, e nao por 200
   *
   * E `null` enquanto a janela nao enchou, e nao 0. Uma janela com dois
   * tiques medidos nao e "media zero", e e "ainda nao da para saber" —
   * e a tela usa esse `null` para mostrar "—" em vez de um numero que
   * ninguem mediu
   */
  duracaoDaJanela() {
    if (!this.janelaTickCheia && this.tiquesRodados === 0) {
      return null;
    }

    let soma = 0;
    let n = 0;

    for (const ms of this.janelaTick) {
      if (ms > 0) {
        soma += ms;
        n += 1;
      }
    }

    if (n === 0) return null;

    return Number((soma / n).toFixed(3));
  }

  /**
   * O PIOR TIQUE DA JANELA.
   *
   * O maximo puro, e nao um percentil: com 200 amostras o 95o percentil
   * quase nunca se distingue do maximo, e aqui o numero que interessa e
   * o travamento. Quem quiser a cauda inteira pode pedir a janela
   *
   * Devolve `null` pela mesma razao da media: sem medicao nao ha numero
   */
  piorDaJanela() {
    let pior = 0;

    for (const ms of this.janelaTick) {
      if (ms > pior) pior = ms;
    }

    return pior > 0 ? pior : null;
  }

  saudeDoLaco() {
    const agora = Date.now();

    const atrasoMs = this.ultimoTick ? agora - this.ultimoTick : 0;

    const orcamento = this.config.tickSeconds * 1000;

    return {
      rodando: Boolean(this.intervalo),

      /**
       * `atrasoMs` so vale depois que o laco rodou pelo menos uma vez.
       * Antes disso `ultimoTick` e o instante do `start`, e a diferenca
       * e o tempo de vida do processo, nao um atraso
       */
      atrasoMs,

      atrasado: atrasoMs > orcamento * 2,

      tiquesRodados: this.tiquesRodados ?? 0,

      /**
       * A media de quanto cada tique LEVOU de verdade, que e o numero
       * que compara com o orcamento. O `atrasoMs` mede o intervalo
       * entre disparos; este mede o trabalho dentro do tique
       */
      duracaoMediaMs:
        this.tiquesRodados > 0
          ? Number(
              (
                this.duracaoAcumuladaMs / this.tiquesRodados
              ).toFixed(3),
            )
          : 0,

      /**
       * O MESMO NUMERO, SÓ NOS ULTIMOS 10 SEGUNDOS.
       *
       * A `duracaoMediaMs` e a media da vida inteira, e ela nao serve
       * para VERIFICAR mudanca: um servidor que passou horas lento
       * continua reportando media alta depois da otimizacao, e da a
       * impressao de que nada mudou
       *
       * Antes da janela encher, `janelaTickCheia` e false e o numero sai
       * como `null` — dividir os zeros iniciais por uma contagem errada
       * daria uma media baixa que nao aconteceu
       */
      duracaoRecenteMs: this.duracaoDaJanela(),

      /**
       * O PIOR TICK DA JANELA, e o 95o percentil.
       *
       * A media esconde o tique que travou: 200 tiques onde 199 levam 4ms
       * e um leva 900ms tem media de 8ms e parece saudavel, enquanto o
       * jogador teve um engasgo de quase um segundo. E o pior numero da
       * janela que e o que interessa, porque e o travamento
       */
      duracaoPiorMs: this.piorDaJanela(),

      /**
       * O ORCAMENTO de cada tique, em ms, para a tela calcular a barra
       *
       * Vem do `tickSeconds` de verdade em vez de um 50 escrito a mao:
       * se alguem mudar o `TICK_RATE`, a tela continua comparando contra
       * o orcamento certo sem ninguem lembrar de mexer aqui
       */
      orcamentoMs: Math.round(this.config.tickSeconds * 1000),

      errosSeguidos: this.errosDeTick,

      jogadores: this.clients.size,

      /**
       * Os paineis que foram para o lixo porque o socket nao lia.
       * Sobe e nunca desce dentro de um processo: e a assinatura de
       * banda insuficiente, e nao de um travamento
       */
      paineisDescartados: [...this.clients.values()].reduce(
        (total, client) => total + (client.paineisDescartados ?? 0),
        0,
      ),
    };
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

    /**
     * E as guildas, que sao o caso mais cruel de perder.
     *
     * Uma guilda que desaparece deixa o jogador com pontos acumulados no
     * save e nenhuma guilda para gastar: ele volta para "criar ou
     * buscar" com o saldo cheio e nenhuma explicacao. Guardar no `stop`
     * e o que evita o pior, mas o intervalo ja cobre o processo morto
     * sem aviso
     */
    this.guardarGuildas();
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
















































































