import { randomUUID } from "node:crypto";
import { GameEngine, marcarChefeVencido } from "../../../src/game/engine/GameEngine.js";
import { createPlayerSession } from "../../../src/game/engine/PlayerSession.js";
import { CHARACTER_CLASSES } from "../../../src/data/characters/index.js";
import {
  ARENA_ID,
  findMap,
  getMap,
  DEFAULT_MAP_ID,
  MAP_TESTE_ID,
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
import {
  ExpeditionStore,
  EXPEDICAO_MAX_MEMBROS,
  EXPEDICAO_ERROS,
} from "../../../src/game/boss/ExpeditionStore.js";
import { chefePorId } from "../../../src/data/bosses/index.js";
import { PartyStore, PARTY_INVITE_TTL } from "./PartyStore.js";
import { createRandom } from "../../../src/data/maps/index.js";
import { registrarTilesDoDisco } from "../maps/tilesDoDisco.js";
import {
  PEDRA_VOLTA_EM_S,
  SEGUNDOS_POR_BATIDA,
  batidasDe,
  encostadoNaPedida,
  mineravel,
  sortearSteel,
  steelMaximoDe,
} from "../../../src/data/props/mineracao.js";
import {
  GUILD_CRIACAO_CUSTO,
  GUILD_MEMBROS_MAX,
  corDaGuilda,
  mensagemDeGuilda,
} from "../../../src/data/guild/index.js";
import {
  ANUNCIOS_MAXIMOS,
  lanceMinimoAtual,
  MARKET_RESULT,
  MOEDA,
  MODO_VENDA,
  moedaDaConta,
  PRECO_MAXIMO,
  PRECO_MINIMO,
  describeAnuncioItem,
  podeListar,
} from "../../../src/data/market/index.js";
import {
  POCAO_MAX_POR_COMPRA,
  getPocao,
  pocaoLiberada,
} from "../../../src/data/potions/index.js";
import { livrosDaClasse } from "../../../src/data/skills/books.js";
import {
  portalLiberado,
  entradaNaArena,
} from "../../../src/data/quests/index.js";
import {
  LOJA_PACOTES,
  MOEDAS_ESPECIAIS,
} from "../../../src/data/loja/index.js";
import { getTalent, podeGerenciar } from "../../../src/data/guild/index.js";
import {
  MOCHILA_SLOTS_MAX,
  proximaCompra,
} from "../../../src/data/inventory/capacidade.js";
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
import {
  encerrar as encerrarFarm,
  iniciar as iniciarFarm,
  resolver as resolverFarm,
} from "../../../src/game/progression/OfflineFarm.js";
import { grantXp } from "../../../src/game/progression/Levels.js";
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
 * alguem CHAMA o `/health/laco` â€” uma leitura a cada 200 tiques nao
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
 * recebe so o que esta perto dele â€” e o quadrado evita a raiz a cada
 * mob: `(dx*dx + dy*dy) > INTERESSE_QUADRADO`
 *
 * O valor e 1000 porque e o alcance da tela do jogador: mandar mob
 * alem disso e trafego para desenhar coisa fora do quadro. E um teste
 * do servidor mede essa distancia no proprio pacote, entao o numero
 * nao e um palpite de rendimento â€” e o contrato
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
 * borda â€” por isso ele e nomeado aqui e nao repetido solto em cada
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
 * qual mapa quer â€” este parametro e o caminho que ja existe para isso,
 * em vez de um `DEFAULT_MAP_ID` lido em tres lugares
 */
export class GameServer {
  constructor({
    config = SERVER_CONFIG,
    persistencia,
    mapId = DEFAULT_MAP_ID,
    contas = null,
    verificadorDeToken = null,
  } = {}) {
    this.config = config;
    this.contas = contas;
    this.verificadorDeToken = verificadorDeToken;
    this.clients = new Map();

    /**
     * AS PAREDES DO MAPA ANTES DE QUALQUER JOGADOR.
     *
     * O movimento online e autoritativo, entao a parede precisa estar no
     * servidor e nao so na tela. O `.tmj` e lido do disco e registrado no
     * mesmo registro que o navegador usa, e o motor pega a colisao por la
     *
     * E no construtor porque depois daqui ja existe jogador com posicao: o
     * `setMap` mais abaixo ja sobe as paredes no `CollisionSystem`
     */
    registrarTilesDoDisco();

    /**
     * O CLIENTE de cada entidade de jogador, por `player`.
     *
     * `clienteDoJogador` precisa achar o socket de quem levou o golpe, e
     * ele recebia a ENTIDADE de jogador â€” e nao a sessao, e nao o id. A
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
     * confundida com esta â€” ela sobrevive a reconexao, esta nao
     */
    this.clientePorJogador = new Map();

    /**
     * O MARKET, e o primeiro estado que NAO e por jogador.
     *
     * Todo o resto da `PlayerSession` e privado â€” invento, missao,
     * bestiario â€” e o `PlayerSession.js` explica por que estado
     * privado nao pode morar no mundo: dois jogadores compartilhando o
     * mesmo estado veem o loot um do outro. O mercado e o oposto
     * exato: o anuncio de um jogador E o produto que o outro compra,
     * entao ele tem de ser de todos
     *
     * E o `agora` e injetado, como o do `GameClient`. Os sete dias de
     * validade nao cabem num teste de espera, e um timer falso esconde
     * as bordas â€” o ultimo segundo, e `expiresAt` igual ao `agora`
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
     * O relogio e o mesmo do market â€” o `config.agora` â€” e nao um
     * `Date.now()` solto. E o que faz os pontos por hora serem
     * testaveis: o testeanda o relogio em vez de esperar uma hora
     */
    this.guild = new GuildStore({
      agora: config.agora ?? (() => Date.now()),
    });

    /**
     * AS EXPEDIÇÕES DO CHEFE: o quarto estado compartilhado.
     *
     * Uma instância só, pelo mesmo motivo da guilda e da party: uma expedição
     * criada por um jogador PRECISA aparecer para os outros, e isso só
     * acontece se os dois lados lerem o mesmo `Map`. Com um store por motor, o
     * botão "entrar" apontaria para um grupo que o outro cliente nunca ouviu
     * falar
     *
* E o `agora` é injetado como na guilda: o store usa `Date.now()` para
    * gerar id, e um teste que anda o relógio precisa poder controlar isso
     */
    this.expedicoes = new ExpeditionStore({
      agora: config.agora ?? (() => Date.now()),
      maximo: EXPEDICAO_MAX_MEMBROS,
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
     * vendedor â€” apenas nao havia onde creditar. E o `devolucao`, que e
     * o item de um anuncio cancelado cuja mochila lotou no caminho
     *
     * As duas sao drenadas quando o jogador entra, em `entrar`, e as
     * duas apontam pela CHAVE DO DONO. Com o id de sessao elas nunca
     * casariam de volta: a sessao que vendeu ja foi destruida quando
     * o jogador saiu
     */
    this.pagamentosPendentes = [];
    this.pendentesDeDevolucao = [];

    /**
     * AS PEDRAS DE CADA MAPA, E O QUE SOBRA DELAS.
     *
     * A chave e o MAPA, e nao a sessao. E a decisao que define se dois
     * jogadores veem o mesmo campo: a pedida e do mundo, nao do jogador
     *
     * Se isto vivesse na sessao, cada um teria a sua copia da pedida. O
     * primeiro a minerar esgotaria a DELA, o segundo veria a pedra ainda
     * de pe com o painel mostrando batidas que nao existiam mais, e os
     * dois jogadores somariam steel de um recurso que so havia um
     *
     * O valor e um `Map` de `propId` para o estado da pedra, e so entra
     * quem precisa de alguma coisa: uma pedra intacta nao tem entrada, e
     * `esgotadas()` devolve so as que estao fora. Com 40 cristais e dois
     * demolidos, o snapshot leva dois ids e nao quarenta
     */
    this.minasPorMapa = new Map();

    /**
     * O RELOGIO DO SERVIDOR, guardado aqui e nao lido de `Date.now()`
     * espalhado.
     *
     * E o mesmo `config.agora` que ja vai para o mercado, a guilda e as
     * parties, e pelo mesmo motivo: a mineracao tem um prazo de 10s por
     * batida e uma ressurreicao de 120s, e um prazo so se testa mexendo no
     * relogio. Com `Date.now()` dentro do metodo, o teste teria de esperar
     * dois minutos de verdade
     */
    this.relogio = config.agora ?? (() => Date.now());

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
         * A expedição entra pelo MESMO caminho da guilda e da party: injetada,
         * e o motor só pergunta. Quem cria, entra e dissolve é o
         * `ExpeditionStore` — o que garante que a lista que o painel recebe é a
         * mesma que os outros clientes estão vendo
         */
        expeditionStore: this.expedicoes,

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

          /**
           * QUANTO RESTA DE UMA PEDIDA, lido do estado do mapa.
           *
           * O contador de batidas mora aqui, e nao na sessao: a PEDIDA e do
           * mundo. Com o contador na sessao, largar a pedra e voltar
           * recomeÃ§ava do total cheio, e o tempo gasto sumia
           *
           * E uma funcao e nao um valor, pelo mesmo motivo do
           * `personagensSalvos`: o painel e montado a 4Hz por jogador e a
           * resposta muda a cada batida
           */
          lerPedida: (propId, mapa) =>
            this.leituraDePedida(propId, mapa),
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
     * `EffectSystem` dele â€” que nunca e desenhado, porque este motor
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
     * em disco â€” tudo sincrono, tudo na thread do `setInterval` de 20Hz
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
     * entao a janela real e de 30s â€” o que corta as 200 releitura por
     * segundo para ~1 passagem a cada 30s
     *
     * A lista devolvida e a MESMA referencia para todos os paineis do
     * intervalo. `montarRank` ordena uma copia (`[...lista].sort`) e nao
     * muta a entrada, entao isso e seguro â€” mas e um contrato, e nao um
     * detalhe: se algum dia alguem ordenar a lista no lugar, o rank
     * passa a mudar de ordem conforme os paineis correm
     */
    this.savesEmCache = null;

    /**
     * CACHE DOS DROPS do tick, e o mapa a que ele pertence.
     *
     * Ve `estadoDrops`. Vive junto do cache de saves porque e o mesmo
     * tipo de desperdicio â€” trabalho identico refeito por cliente â€” mas
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
     * compra. `mercadoSujo` existe para nao escrever a cada tick â€” o
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
     * jogador conectar â€” a aba Membros consulta o store no primeiro
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
    // mapa â€” sempre a mesma coisa, e sempre errada
    for (const client of this.clients.keys()) {
      if (client.joined) total += 1;
    }

    return total;
  }

  /**
   * Um socket virou conexao.
   *
   * SÃ³ registra. A sessao de jogador nasce no JOIN, e nao aqui: um
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
     * a eles custava 115ms de CPU por segundo POR CLIENTE â€” na mesma
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
   * guardado no anuncio removido â€” um item que ninguem tinha, ninguem
   * via e ninguem podia mais usar
   *
   * E chamado a cada tick, e nao num laco de relogio: o
   * `MarketStore.expirar` e lazy de proposito, e o tick e o unico
   * lugar que ja roda sem parar
   */
  expirarAnuncios() {
    // `expirados()` e a LEITURA; a remocao e de quem trata cada caso. O
    // `market.expirar()` antigo apagava tudo de uma vez, e um leilao nao
    // pode ser apagado sem decidir o que acontece com o lance
    for (const anuncio of this.market.expirados()) {
      /**
       * O LEILÃO VENCIDO tem um comprador, e ele muda o desfecho inteiro.
       *
       * Sem lance, um leilao que vence e uma devolucao comum — o item volta ao
       * vendedor. Com lance, o item e do comprador e o dinheiro e do vendedor,
       * e as duas transferencias nao tem nada a ver com o caminho de baixo
       */
      if (anuncio.modo === MODO_VENDA.LEILAO) {
        this.encerrarLeilao(anuncio);

        continue;
      }

      this.devolverAnuncioVencido(anuncio);
    }
  }

  /**
   * UM LEILÃO QUE VENCEU: o item vai para quem lancei, o dinheiro para quem vendeu.
   *
   * ## POR QUE NINGUÉM PRECISA ESTAR ONLINE
   *
   * Porque as duas pontas podem estar fora, e o dinheiro nao pode depender
   * disso. Quem nao tem sessao viva entra na fila: `pagamentosPendentes` para
   * o vendedor e `pendentesDeDevolucao` para o comprador, e as duas sao
   * resolvidas na proxima entrada. A fila e o que impede um lance de virar
   * dinheiro sumido no dia seguinte
   */
  encerrarLeilao(anuncio) {
    const resultado = this.market.fecharLeilao(anuncio.id);

    if (!resultado.ok) return;

    this.marcarMercadoSujo();

    // leilao sem lance nenhum: o item volta para o vendedor
    if (!resultado.comprador) {
      this.devolverAnuncioVencido(anuncio);

      return;
    }

    const { comprador, valor, currency } = {
      comprador: resultado.comprador,
      valor: resultado.valor,
      currency: anuncio.currency,
    };

    /**
     * O DINHEIRO DO VENDEDOR, e ele vai ANTES do item.
     *
     * A ordem e o que mantem a verdade do mercado: se a entrega do item
     * falhar, o vendedor ja foi pago e o comprador tem a fila. Ao contrario,
     * o comprador receberia a peca e o vendedor nunca receberia nada
     */
    const vendedor = this.sessaoDoDono(anuncio.sellerKey);

    if (vendedor) {
      this.creditarAoDono(vendedor, currency, valor);

      this.avisoDoDono(
        vendedor,
        `Seu leilao de ${describeAnuncioItem(anuncio)} venceu por ${valor}.`,
      );
    } else {
      this.pagamentosPendentes.push({
        ownerKey: anuncio.sellerKey,
        coins: valor,
        currency,
      });
    }

    const compradorVivo = this.sessaoDoDono(comprador.key);

    if (!compradorVivo) {
      this.pendentesDeDevolucao.push({
        ownerKey: comprador.key,
        itemId: anuncio.itemId,
        rarity: anuncio.rarity,
        count: anuncio.count,
      });

      return;
    }

    const entregue = compradorVivo.inventory.add(
      anuncio.itemId,
      anuncio.count,
      anuncio.rarity,
    );

    if (entregue.added < anuncio.count) {
      this.pendentesDeDevolucao.push({
        ownerKey: comprador.key,
        itemId: anuncio.itemId,
        rarity: anuncio.rarity,
        count: anuncio.count - entregue.added,
      });

      // o que entrou na mochila e que nao coube no `count` fica com ele
      return;
    }

    this.avisoDoDono(
      compradorVivo,
      `Voce venceu o leilao de ${describeAnuncioItem(anuncio)} por ${valor}.`,
    );
  }

  /**
   * O CAMINHO DE SEMPRE: o item de um anúncio vencido volta ao dono.
   *
   * E o que o leilao sem lance usa, e o que usava antes de existir leilao.
   * Ficar aqui, e nao espalhado em dois `continue`, e o que impede uma
   * versao de devolver o item e a outra de devolver em ouro
   */
  devolverAnuncioVencido(anuncio) {
    const dono = this.sessaoDoDono(anuncio.sellerKey);

    if (!dono) {
      // o vendedor saiu e a sessao morreu: o item espera por ele
      this.pendentesDeDevolucao.push({
        ownerKey: anuncio.sellerKey,
        itemId: anuncio.itemId,
        rarity: anuncio.rarity,
        count: anuncio.count,
      });

      return;
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

      return;
    }

    this.marcarMercadoSujo();

    this.avisoDoDono(
      dono,
      `Seu anuncio de ${describeAnuncioItem(anuncio)} venceu e o item voltou.`,
    );
  }

  /**
   * A SESSAO DE UM JOGADOR pelo ID, ou `null`.
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
   * preco "por numero de dano" â€” o que era verdade com o servidor de
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
   * informar nada â€” e o jogador nao consegue ver o proprio HP cair
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
   * cancelamento viraria uma escrita de arquivo â€” e a expiracao roda a
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
   * desligada, quando nada mudou, ou quando o disco falhou â€” e nenhum
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
   * pedido aceito viraria uma escrita de arquivo â€” e o accruo de pontos
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
   * quando nada mudou, ou quando o disco falhou â€” e nenhum dos tres e
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
   * resolveria o caso do jogador que fez a acao â€” e nao o do
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
     * que o jogador le â€” e o generico continua sendo o padrao para
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

      /**
       * OS MOTIVOS NOVOS, e cada um com o seu texto.
       *
       * "Erro no mercado" num lance recusado e o pior resultado possivel: o
       * jogador ve o botao que nao funciona e nao descobre se foi o piso, a
       * moeda ou o saldo. Um motivo por situacao e o que faz o recuso
       * virar instrucao
       */
      [MARKET_RESULT.LANCE]:
        "Lance invalido. Confira o lance minimo e o maior lance atual.",
      [MARKET_RESULT.MOEDA]: "Essa moeda nao existe.",
      [MARKET_RESULT.MODO]: "Esse anuncio nao aceita esse tipo de operacao.",
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
     * sozinho â€” mas o painel do jogador prometeria um lote que ele
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
      currency: pedido.currency,
      modo: pedido.modo,
      minBid: pedido.minBid,
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
  /**
   * O CAMINHO DE GANHO, e o par exato do `descontarDoAnuncio`.
   *
   * ## POR QUE ELE EXISTE EM SEPARADO
   *
   * Porque o dinheiro do vendedor chega em tres momentos: na venda direta, na
   * entrega do leilao, e no estorno do lance ultrapassado. E o diamante ainda
   * tem o passo a mais de subir para a conta — sem ele, o vendedor ganharia o
   * valor no personagem e a conta nunca saberia
   *
   * @param {object} sessao quem recebe
   * @param {string} currency a moeda do anuncio
   * @param {number} valor quanto creditar
   */
  creditarAoDono(sessao, currency, valor) {
    if (currency === MOEDA.STEEL) {
      sessao.inventory.addSteel(valor);

      return;
    }

    if (moedaDaConta(currency)) {
      sessao.inventory.addDiamonds(valor);
      this.guardarDiamantesNaConta(sessao);

      return;
    }

    sessao.inventory.addCoins(valor);
  }

  /**
   * UM LANCE EM LEILAO: debita, guarda o dinheiro e devolve o do perdedor.
   *
   * ## A ORDEM DAS TRES COISAS, E POR QUE IMPORTA
   *
   * Saldo, depois espaco de volta para o comprador ultrapassado, e so entao
   * o lance novo. Se o espaco viesse primeiro, um comprador sem lugar na
   * mochila cancelaria o lance do outro e ficaria com o dinheiro dos dois
   *
   * ## E POR QUE `market.bid` NAO DEVOLVE NADA
   *
   * Porque o `MarketStore` nao tem saldo de ninguem. Ele devolve no resultado
   * QUEM foi ultrapassado, e e este metodo que credita — se os dois fizessem,
   * o mesmo dinheiro voltaria duas vezes
   */
  darLanceNoMarket(sessao, pedido) {
    /**
     * O SALDO PRIMEIRO, e o lance so depois.
     *
     * E o que evita ter que desfazer: `market.bid` grava o maior lance no
     * anuncio assim que aceita. Se o debito viesse depois, um jogador sem
     * saldo deixaria um lance fantasma no piso — e o proximo comprador veria
     * um valor minimo que ninguem pagou
     */
    const anuncio = this.market.get(pedido.listingId);

    if (
      !anuncio ||
      !this.podePagarMoeda(sessao, anuncio.currency, pedido.price)
    ) {
      this.resultadoDoMarket(
        sessao,
        { ok: false, reason: MARKET_RESULT.MOEDAS },
        null,
      );

      return;
    }

    const resultado = this.market.bid(
      pedido.listingId,
      sessao.donoKey,
      sessao.name,
      pedido.price,
    );

    if (!resultado.ok) {
      this.resultadoDoMarket(sessao, resultado, null);

      return;
    }

    const debitado = this.descontarDoAnuncio(
      sessao,
      resultado.listing.currency,
      pedido.price,
    );

    if (!debitado) {
      // o saldo foi conferido acima, entao isto e defensivo: se o debito falhar
      // mesmo assim, o lance nao pode ficar valendo
      this.market.desfazerLance(
        resultado.listing.id,
        resultado.maiorAnterior,
        resultado.lances,
      );

      this.resultadoDoMarket(
        sessao,
        { ok: false, reason: MARKET_RESULT.MOEDAS },
        null,
      );

      return;
    }

    /**
     * O DINHEIRO DO LANCE ANTERIOR VOLTA AGORA.
     *
     * Em leilao o dinheiro fica retido enquanto o item esta anunciado, entao
     * devolver no ato e o unico jeito de o perdedor nao ficar preso ate o fim
     */
    if (resultado.devolvido && resultado.maiorAnterior) {
      const anterior = this.sessaoDoDono(resultado.maiorAnterior.key);

      if (anterior) {
        this.creditarAoDono(
          anterior,
          resultado.listing.currency,
          resultado.devolvido,
        );

        this.avisoDoDono(
          anterior,
          `Seu lance de ${resultado.devolvido} foi ultrapassado. O valor voltou.`,
        );
      } else {
        this.pagamentosPendentes.push({
          ownerKey: resultado.maiorAnterior.key,
          coins: resultado.devolvido,
          currency: resultado.listing.currency,
        });
      }
    }

    this.marcarMercadoSujo();

    this.resultadoDoMarket(
      sessao,
      { ok: true },
      `Lance de ${pedido.price} em ${describeAnuncioItem(resultado.listing)}.`,
    );
  }

  cancelarNoMarket(sessao, pedido) {
    const resultado = this.market.cancel(
      pedido.listingId,
      sessao.donoKey,
    );

    if (!resultado.ok) {
      this.resultadoDoMarket(sessao, resultado, null);

      return;
    }

    /**
     * O LANCE VOLTA PARA QUEM DELE, e antes do item voltar para o vendedor.
     *
     * O dinheiro e o que o compradorTEM, e o item e o que o vendedor tem. Um
     * pedido de cancelamento que devolvesse o item e esquecesse o lance
     * entregaria a peca E o dinheiro de volta para o mesmo par
     */
    const lanceDevolvido = this.market.lanceARetornar(resultado.listing);

    if (lanceDevolvido) {
      const perdedor = this.sessaoDoDono(lanceDevolvido.key);

      if (perdedor) {
        this.creditarAoDono(
          perdedor,
          lanceDevolvido.currency,
          lanceDevolvido.valor,
        );

        this.avisoDoDono(
          perdedor,
          `O leilao de ${describeAnuncioItem(resultado.listing)} foi cancelado. Seu lance de ${lanceDevolvido.valor} voltou.`,
        );
      } else {
        this.pagamentosPendentes.push({
          ownerKey: lanceDevolvido.key,
          coins: lanceDevolvido.valor,
          currency: lanceDevolvido.currency,
        });
      }
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
   * para o jogo: uma sessao sÃ³, um preco que vem do catalogo, e
   * nenhum outro jogador envolvido. E por isso que ela usa
   * `showMessage` como o encantar e a guilda, em vez do
   * `resultadoDoMarket` â€” aquele existe para reconciliar as duas telas
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
   * dinheiro â€” e devolver junto com o que entrou na mochila, para o
   * jogador ficar exatamente onde estava. Sem o `take`, ele perderia o
   * preco E ficaria com parte das pocoes de graca
   */
  comprarPocao(sessao, pedido) {
    const pocao = getPocao(pedido.itemId);

    if (!pocao) {
      this.engine.showMessage(
        "O mercador nÃ£o tem essa poÃ§Ã£o.",
        true,
      );

      return;
    }

    /**
     * O NIVEL MINIMO, conferido ANTES de cobrar.
     *
     * ## POR QUE AQUI E NAO NO PAINEL
     *
     * Porque o painel e um desenho. `parsePanel` joga fora tudo que o
     * cliente nao pediu, e o nivel nao esta na lista â€” entao um cliente
     * editado so precisa mandar o `itemId` certo e o preco errado nao
     * importa. Se a trava vivesse so na tela, ela existiria como numero
     * na tela e nao como regra do jogo
     *
     * E a mesma ordem do `comprarLivro` logo abaixo: conferido antes do
     * `spendCoins`, para o jogador nunca ficar com o preco debitado de
     * uma compra recusada
     *
     * O `nivel` vem da sessao e nunca do pedido, e e por isso que o
     * `motivo` vem pronto do catalogo: os dois lados precisam da mesma
     * frase, e a do servidor tem de ser a mesma que o painel mostra no
     * `title` do botao
     */
    const trava = pocaoLiberada(sessao?.player?.level, pocao);

    if (!trava.ok) {
      this.engine.showMessage(trava.motivo, true);

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
        `Moedas insuficientes: ${preco} sÃ£o necessÃ¡rias.`,
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

      /**
       * A COMPRA CONTA PARA O TUTORIAL DA LOJA.
       *
       * E no FIM de proposito: o caminho tem tres saidas antes daqui â€” a
       * pocao inexistente, o nivel trancado e a mochila lotada com o
       * dinheiro devolvido. Contar em qualquer uma delas fecharia um tutorial
       * de compra que o jogador nao.completeou
       */
      sessao.quests?.onAcao?.("buy");
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
   * `comprarPocao` aceita quantidade porque poÃ§ao se empilha e faz
   * sentido ter tres na mochila. Um livro ENSINA uma skill, e a segunda
   * copia do mesmo livro nao ensina mais nada â€” o `aprenderHabilidade`
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
     * `aprenderHabilidade` recusaria no uso â€” o dinheiro foi gasto para
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

    /**
     * A COMPRA CONTA PARA O TUTORIAL DA LOJA.
     *
     * Pelo mesmo motivo do `comprarPocao`: e no fim, depois de todas as
     * saidas que devolvem o dinheiro
     */
    sessao.quests?.onAcao?.("buy");
  }

  /**
   * COMPRAR um produto da LOJA.
   *
   * E a mesma transacao do `comprarPocao` e do `comprarLivro` â€” preco do
   * catalogo do servidor, pedido que nao escolhe o que paga, mochila cheia
   * devolvendo o dinheiro â€” com uma diferenca que these nao tem: o produto
   * e um CONJUNTO, e a transacao so fecha se o CONJUNTO inteiro couber
   *
   * ## POR QUE "CABER INTEIRO" E NAO "CABER PARCIALMENTE"
   *
   * Porque um pacote pela metade e o pior resultado possivel: o jogador
   * pagou 560, recebeu 2 dos 3 itens e o terceiro foi devolvido. Ele nao
   * pode pedir reembolso â€” o jogo nao tem â€” e ele nao sabe o que faltou.
   *
   * Entao o espaco e conferido ANTES do `spendCoins`, com todos os itens do
   * pacote de uma vez. E por isso que o preco debitado e a entrega nao
   * pertencem a `inventory.add`: um pacote com 3 pecas de equipamento nao
   * empilha, e cada `add` contaria uma pilha a mais na capacidade
   *
   * ## POR QUE A MOEDA VAI POR FORA DO `inventory.add`
   *
   * Porque ouro e steel sao SALDO, nao pilha. Eles aparecem como `itemId`
   * no catalogo so porque o card precisa de um glifo â€” o `MOEDAS_ESPECIAIS`
   * e o que da o icone. Passar "ouro" pelo `add` criaria uma pilha de ouro
   * na mochila, e o jogador veria ouro no inventario E no saldo
   *
   * ## POR QUE O PRODUTO COMPRADO FICA MARCADO
   *
   * Porque o card precisa desativar, e o servidor e o unico lugar que sabe
   * se a compra saiu. Marcar na tela seria o `useState` de antes: o jogador
   * recarregaria e o pacote voltaria a ficar compravel, e ele poderia pagar
   * duas vezes
   */
  /**
   * COMPRA ESPACO DE MOCHILA.
   *
   * ## POR QUE O PEDIDO NÃO TRAZ NENHUM NÚMERO
   *
   * O cliente manda so "quero expandir". Os slots, o preço e quantas compras
   * ja foram feitas sao lidos DA SESSAO e calculados com `proximaCompra`.
   * Um pedido com `slots: 999` viraria uma mochila de mil slots de graça, e
   * um `preco: 1` faria o jogador pagar um diamante pelo dobro
   *
   * ## A ORDEM: PREÇO, DIAMANTE, CAPACIDADE
   *
   * O preco e lido antes de qualquer coisa, e o diamante e debitado antes da
   * capacidade crescer. Se a ordem fosse o contrario, um debito que falhasse
   * deixaria a mochila maior sem cobrar nada — e o jogador teria os slots E o
   * diamante de volta
   *
   * ## E POR QUE O DIAMANTE SOBE PARA A CONTA
   *
   * Pelo mesmo motivo da `LOJA`: `spendDiamonds` mexe no espelho do
   * personagem e o `guardarDiamantesNaConta` e o que a conta sabe. Sem ele, os
   * dois personagens da mesma conta poderiam gastar o mesmo saldo duas vezes
   *
   * @returns {boolean} `true` quando a compra saiu
   */
  expandirMochila(sessao) {
    const compra = proximaCompra(sessao.inventory.capacity);

    if (!compra.pode) {
      this.engine.showMessage(
        `A mochila ja esta no limite de ${MOCHILA_SLOTS_MAX} slots.`,
        true,
      );

      return false;
    }

    if (!sessao.inventory.spendDiamonds(compra.preco)) {
      this.engine.showMessage(
        `Diamantes insuficientes: ${compra.preco} sao necessarios.`,
        true,
      );

      return false;
    }

    this.guardarDiamantesNaConta(sessao);

    sessao.inventory.capacity = compra.capacity;

    /**
     * O SAVE AGORA, e nao no proximo `guardar`.
     *
     * Porque o debito do diamante ja subiu para a conta neste instante, e a
     * capacidade ainda esta so na sessao. Um restart entre as duas coisas
     * devolveria o diamante debitado COM a mochila no tamanho antigo — e o
     * jogador perderia a compra sem ter ganho nada
     */
    this.guardar(sessao);

    this.avisoDoDono(
      sessao,
      `Mochila expandida: ${compra.slots} slots a mais, por ${compra.preco} diamantes. Agora sao ${compra.capacity}.`,
    );

    return true;
  }

  comprarProduto(sessao, pedido) {
    const produto = LOJA_PACOTES.find(
      (p) => p.id === pedido.produtoId,
    );

    if (!produto) {
      this.engine.showMessage("Esse produto nao existe.", true);

      return;
    }

    /**
     * JA COMPRADO.
     *
     * Conferido antes de cobrar, como toda recusa deste arquivo. Sem esta
     * linha o produto de 12 itens seria compravel em loop, e cada compra
     * entregaria os 12 de novo
     */
    if (sessao.lojaComprados.has(produto.id)) {
      this.engine.showMessage("Voce ja comprou esse produto.", true);

      return;
    }

    /**
     * OS QUE VIRAM PILHA, e a MOEDA, que vai por fora.
     *
     * ## POR QUE `quantidade` E NAO `count`
     *
     * Porque o e o nome que o catalogo da loja usa em `itens`, e o mesmo que
     * o `LojaPanel` le no `x{it.quantidade}`. Escrever `count` aqui
     * entregaria `undefined`: o jogador pagava 180, o preco saia, e o
     * `inventory.add(id, undefined)` nao colocava nada na mochila
     *
     * E por isso que a moeda NAO vem de `itens`: ela vem do `valorReal`,
     * que e o campo que o card ja mostra como "500 de ouro". Filtrar
     * `itens` procurando `"ouro"` nunca encontraria nada
     */
    /**
     * OS QUE VIRAM PILHA, e a MOEDA, que vai por fora.
     *
     * ## POR QUE A MOEDA PRECISA SAIR DE `itens`
     *
     * Porque o catalogo escreve a moeda nos DOIS lugares: em `itens` com o
     * id `"ouro"`, e em `valorReal.ouro`. O `itens` existe so para o card
     * ter um glifo â€” o `MOEDAS_ESPECIAIS` e o que da o icone, e e por isso
     * que `ItemIcon` nunca e chamado para ela
     *
     * Sem este filtro, o `inventory.add("ouro", 250)` criaria uma PILHA de
     * ouro na mochila, e o jogador veria o ouro no inventario E no saldo. O
     * teste chegou a recusar "Mochila cheia" numa mochila VAZIA por causa
     * disso: `hasSpace` contava uma pilha que nunca deveria existir
     */
    const pilhas = produto.itens.filter(
      (entrada) => !MOEDAS_ESPECIAIS[entrada.itemId],
    );

    /**
     * A MOEDA, LIDA DE `itens`.
     *
     * E nao de `valorReal`: os dois campos concordam, mas `itens` e a lista
     * que o card mostra, e e dela que o jogador leu "1.000 de ouro". Ler o
     * `valorReal` e reescrever a regra do catalogo em outro lugar
     */
    const ouro = produto.itens.reduce(
      (total, entrada) =>
        entrada.itemId === "ouro"
          ? total + Number(entrada.quantidade ?? 0)
          : total,
      0,
    );

    const steel = produto.itens.reduce(
      (total, entrada) =>
        entrada.itemId === "steel"
          ? total + Number(entrada.quantidade ?? 0)
          : total,
      0,
    );

    /**
     * O ESPACO ANTES DO DINHEIRO.
     *
     * E o `hasSpace` do proprio `Inventory`, e ele conta PILHAS â€” um
     * material que o jogador ja tem cresce na pilha existente em vez de
     * pedir um lugar novo. Passando um numero de unidades aqui, um pacote
     * de 12 materiais seria recusado num inventario com 3 espacos livres,
     * e o jogador veria "Mochila cheia" sem ter
     */
    if (!sessao.inventory.hasSpace(pilhas)) {
      this.engine.showMessage("Mochila cheia.", true);

      return;
    }

/**
     * O PRECO E EM DIAMANTE, e nao em ouro.
     *
     * ## A DIVISAO DAS DUAS LOJAS
     *
     * Sao dois lugares e duas moedas, e a diferenca nao e o preco: e QUEM
     * pode vender. A loja do NPC vende pocao e livro, e e ouro â€” dinheiro que
     * o jogador ganha matando bicho. A `LOJA` vende pacote e evento, e e
     * diamante â€” a moeda que o jogo nao produz em drop nenhum
     *
     * ## POR QUE ISTO PRECISA FICAR SEPARADO
     *
     * Porque `spendDiamonds` devolve `false` sem mexer no saldo quando falta,
     * e a compra de ouro continuaria debitando `coins` â€” os dois saldos
     * convivem, e um jogador pode ter 1000 diamantes e 12 ouro
     *
     * A loja do mercador e o unico lugar que ainda usa `spendCoins`, e
     * `comprarLivro` e `comprarPocao` continuam em ouro de proposito
     */
      /**
     * A MOEDA DO PACOTE, e nao a DO PAINEL.
     *
     * ## POR QUE O CAMPO EXISTE
     *
     * Porque a loja inteira era So por diamante, e a aba de ITENS virou ouro:
     * o diamante nao sai de drop nenhum, e cobrar por pocao e pergaminho
     * punia o jogo em vez da compra. A aba e o que o jogador esta olhando, e
     * por isso que a moeda mora no PACOTE — os dois pacotes da mesma aba
     * podem ser lidos em moedas diferentes sem quebrar a regra
     *
     * ## POR QUE O DEBITO CONTINUA SENDO DOIS CAMINHOS
     *
     * Porque `spendDiamonds` e `spendCoins` sao metodos diferentes, com
     * guardas diferentes, e o diamante mora na CONTA enquanto o ouro mora no
     * PERSONAGEM. O que muda e qual dos dois e chamado — nao o valor, que e
     * o mesmo `preco` nos dois casos
     */
    const emOuro = produto.moeda === "coins";

    if (
      emOuro
        ? !sessao.inventory.spendCoins(produto.preco)
        : !sessao.inventory.spendDiamonds(produto.preco)
    ) {
      this.engine.showMessage(
        emOuro
          ? `Ouro insuficiente: ${produto.preco} sao necessarios.`
          : `Diamantes insuficientes: ${produto.preco} sao necessarios.`,
        true,
      );

      return;
    }

      /**
       * O DEBITO SOBE PARA A CONTA AGORA, e nao no proximo save.
       *
       * O diamante e da conta, entao o saldo da conta tem que cair no mesmo
       * instante em que o do personagem cai. Se dependesse do `guardar`, um
       * jogador com dois personagens na mesma conta podia gastar duas vezes
       * o mesmo saldo: um gastava, o outro entrava antes do save seguinte e
       * ainda via o numero antigo na tela
       *
       * E POR QUE SO NO CASO DO DIAMANTE
       *
       * Porque o ouro mora no PERSONAGEM, e ele ja foi debitado do
       * `spendCoins` — o que o jogador carrega e um numero, nao uma conta. A
       * sincronizar aqui debitaria a conta por uma moeda que a conta nunca
       * teve
       */
      if (!emOuro) this.guardarDiamantesNaConta(sessao);

    /**
     * O QUE ENTROU, para o aviso.
     *
     * E montado aqui e nao no catalogo porque o aviso tem que dizer o que o
     * jogador recebeu, e nao o que o card dizia: `valorReal.texto` e a
     * promessa, e isto e a entrega
     */
    const recebido = [
      ...pilhas.map(
        (entrada) =>
          `${entrada.quantidade}x ${getItem(entrada.itemId)?.name ?? entrada.itemId}`,
      ),
      ...(ouro > 0 ? [`${ouro} de ouro`] : []),
      ...(steel > 0 ? [`${steel} de steel`] : []),
    ];

    for (const entrada of pilhas) {
      const entregue = sessao.inventory.add(
        entrada.itemId,
        entrada.quantidade,
      );

      /**
       * A ENTREGA PARCIAL AINDA ASSIM.
       *
       * O `hasSpace` de cima ja recusou o pacote que nao cabe, entao este
       * desvio e o caso que o `hasSpace` nao prevÃª: um item do pacote ter
       * espaco, mas nao o suficiente para a pilha inteira. A devolve aqui
       * e o unico jeito de nao manter um produto marcado como comprado que
       * o jogador nao recebeu inteiro
       *
       * A devolve e em `addDiamonds` e nao em `addCoins` porque o debito
       * acima foi em diamante. Devolver em ouro daria ao jogador uma moeda
       * que ele nao gastou â€” e o preco do pacote mais um preco em ouro
       * que nunca foi cobrado
       */
      if (entregue.added < entrada.quantidade) {
        sessao.inventory.addDiamonds(produto.preco);

        /**
         * O ESTORNO SOBE PARA A CONTA TAMBEM.
         *
         * E o caminho do GANHO: o diamante devolvido aqui e da conta tanto
         * quanto o debitado acima. Sem esta linha o personagem recuperava o
         * valor e a conta nao sabia — e o proximo personagem a abrir o jogo
         * veria o saldo sem essa devolucao
         */
        this.guardarDiamantesNaConta(sessao);

        if (entregue.added > 0) {
          sessao.inventory.take(entrada.itemId, entregue.added);
        }

        this.engine.showMessage("Mochila cheia.", true);

        return;
      }
    }

    /**
     * A MOEDA DEPOIS, e nao junto do preco.
     *
     * Soma o saldo em vez de passar pelo `add`, e so depois que todos os
     * itens couberam: um pacote que da ouro e nao cabe nao pode deixar o
     * ouro no jogador com a compra desfeita
     */
    if (ouro > 0) sessao.inventory.addCoins(ouro);
    if (steel > 0) sessao.inventory.addSteel(steel);

    sessao.lojaComprados.add(produto.id);

    this.engine.showMessage(`${produto.nome}: ${recebido.join(", ")}.`);

    sessao.quests?.onAcao?.("buy");
  }

  /**
   * COMPRAR um anuncio.
   *
   * A ordem das tres checagens antes de qualquer transferencia:
   * saldo do comprador, espaco na mochila do comprador, e pagamento ao
   * vendedor. Qualquer uma delas falha ANTES de o item sair do
   * vendedor â€” um `takeUid` antes do `spendCoins` daria o item de
   * graca, e um `spendCoins` antes do espaco daria o dinheiro sem o
   * item
   */
  /**
   * TEM SALDO PARA A MOEDA? E nao desconta.
   *
   * ## POR QUE NAO E SO CHAMAR `descontarDoAnuncio`
   *
   * Porque o lance valida o SALDO antes de gravar o lance no anuncio, e o
   * desconto vem DEPOIS do `market.bid`. Se o unico jeito de conferir saldo
   * fosse descontando, o dinheiro sairia duas vezes: uma na conferencia e
   * outra no debito
   *
   * E o espelho do `descontarDoAnuncio`: os dois leem o mesmo campo de saldo,
   * ou o lance passaria com dinheiro que o debito depois negaria
   */
  podePagarMoeda(sessao, currency, valor) {
    if (currency === MOEDA.STEEL) {
      return sessao.inventory.steel >= valor;
    }

    if (moedaDaConta(currency)) {
      return sessao.inventory.diamonds >= valor;
    }

    return sessao.inventory.coins >= valor;
  }

  /**
   * DESCONTA A MOEDA DE UM ANUNCIO, E DEVOLVE QUANDO O ITEM NAO CABE.
   *
   * ## POR QUE O METODO, E NAO UM `if` NO COMPRAR
   *
   * Porque o dinheiro entra em tres lugares diferentes: o pagamento da compra,
   * o estorno quando a mochila lota, e o credito ao lance ultrapassado. Sao
   * tres momentos com a MESMA pergunta — "tira isso da moeda do anuncio" — e
   * tres copias do `switch` divergiriam no primeiro dia que uma moeda nova
   * entrasse
   *
   * ## POR QUE O DIAMANTE PASSA PELA CONTA
   *
   * Porque ouro e steel vivem no personagem, e o diamante na conta. Sem este
   * desvio, `spendCoins` cobraria de um saldo que o jogador nem ve — e o
   * numero na tela mentiria em 100%
   *
   * @param {object} sessao quem paga
   * @param {string} currency a moeda do anuncio
   * @param {number} valor quanto tirar
   * @returns {boolean} `true` quando o desconto saiu
   */
  descontarDoAnuncio(sessao, currency, valor) {
    if (currency === MOEDA.STEEL) {
      return sessao.inventory.spendSteel(valor);
    }

    /**
     * O DEBITO DE DIAMANTE SOBE PARA A CONTA NO MESMO INSTANTE.
     *
     * E o mesmo caminho da `LOJA`: `spendDiamonds` mexe no espelho do
     * personagem, e o `guardarDiamantesNaConta` e o que faz a conta saber. Se
     * dependesse do proximo save, dois personagens da mesma conta poderiam
     * gastar o mesmo saldo duas vezes — um gastava, o outro entrava e ainda
     * via o numero velho na tela
     */
    if (moedaDaConta(currency)) {
      if (!sessao.inventory.spendDiamonds(valor)) return false;

      this.guardarDiamantesNaConta(sessao);

      return true;
    }

    return sessao.inventory.spendCoins(valor);
  }

  /**
   * O CAMINHO INVERSO DE `descontarDoAnuncio`, e ele tem que ser O MESMO.
   *
   * Uma devolucao em moeda diferente da que foi cobrada e dinheiro criado do
   * nada: o jogador pagou em diamante e recebeu ouro de volta
   */
  devolverAoAnuncio(sessao, currency, valor) {
    if (currency === MOEDA.STEEL) {
      sessao.inventory.addSteel(valor);

      return;
    }

    if (moedaDaConta(currency)) {
      sessao.inventory.addDiamonds(valor);
      this.guardarDiamantesNaConta(sessao);

      return;
    }

    sessao.inventory.addCoins(valor);
  }

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
     * "mochila cheia" sem nenhum numero â€” e, como o `add` funde so com
     * pilhas da MESMA raridade, dava para ter espaÃ§o na mochila e ainda
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

    if (!this.descontarDoAnuncio(sessao, anuncio.currency, preco)) {
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
      this.devolverAoAnuncio(sessao, anuncio.currency, preco);

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
     * pendente e e pago quando ele voltar â€” e nao e uma segunda
     * origem da verdade: o valor ja foi decidido no `buy`
     */
    const vendedor = this.sessaoDoDono(anuncio.sellerKey);

    if (vendedor) {
      this.creditarAoDono(vendedor, anuncio.currency, preco);

      this.avisoDoDono(
        vendedor,
        `Vendeu ${describeAnuncioItem(anuncio)} por ${preco}.`,
      );
    } else {
      /**
       * O dinheiro fica aqui, e nao e uma segunda venda.
       *
       * O `market.buy` acima JA chamou `registrarVenda` â€” o historico
       * tem uma entrada so. Chamar de novo duplicaria a linha, e o
       * jogador veria a mesma venda duas vezes no historico
       */
      this.pagamentosPendentes.push({
        ownerKey: anuncio.sellerKey,
        coins: preco,
        currency: anuncio.currency,
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
  entrar(client, { name, classId, token } = {}) {
    if (client.joined) return;

    /**
     * O TOKEN DE ENTRADA, QUANDO HAI CONTAS.
     *
     * Sem o front, o JOIN era `{ name, classId }` e o nome era a unica
     * identidade. Isso abria a porta para entrar como qualquer um: bastava
     * `JOIN { name: "Alguem", classId: "warrior" }` no console
     *
     * Com contas, o nome e a classe passam a vir do TOKEN, e nao do
     * cliente. O token foi emitido pelo servidor para um personagem que a
     * conta realmente tem, e e assinado com segredo que o navegador nao
     * tem. O que o cliente mandar em `name`/`classId` e ignorado
     *
     * ## POR QUE O TOKEN E QUEIMADO AQUI E NAO NUM ROTA
     *
     * Porque ele precisa ser de uso unico. Se o `verificar` consumisse o
     * token, uma aba que recarrega depois do JOIN perderia o token e
     * entraria de novo como o mesmo personagem — que esta certo. Mas se a
     * queima ficasse num endpoint, a aba que so ESPERANDO o socket ficaria
     * com o token valido e qualquer um poderia abrir duas sessoes com o
     * mesmo token
     */
    let entrada = { nome: name, classe: classId, contaId: null };

    if (this.contas) {
      const resultado = this.confereTokenDeEntrada(token);

      if (!resultado.ok) {
        client.enviar(SERVER_EVENTS.REJECTED, {
          reason: resultado.motivo,
        });
        return;
      }

      entrada = {
        nome: resultado.corpo.nome,
        classe: resultado.corpo.classe,
        contaId: resultado.corpo.contaId,
      };
    }

    const checagem = validateName(entrada.nome);

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
      (c) => c.id === entrada.classe,
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
     * cai. O mercado precisa do contrario â€” um anuncio continua valendo
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

        // A CONTA, quando o token trouxe uma.
        //
        // `donoKey` continua sendo o nome, e nao a conta: mercado,
        // guilda e pagamento offline dependem dessa chave e ela ja estava
        // funcionando. A `contaId` e a AMARRA — e o que permite, mais
        // para a frente, trocar `donoKey` para a conta sem mexer nesses
        // tres, e saber de quem e este personagem
        contaId: entrada.contaId,

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

    /**
     * O SALDO DE DIAMANTES VEM DA CONTA, E NAO DO SAVE.
     *
     * E a ultima coisa antes de o jogador ver o painel, porque o painel le
     * `inventory.diamonds`. O `restaurar` acima acabou de trazer o valor
     * antigo deste personagem, e esse valor e de antes da unificacao: um
     * jogador que gaste diamante com um personagem deixa os outros dois da
     * mesma conta com o numero velho na tela
     *
     * A conta e a fonte da verdade, entao o espelho e reescrito aqui — e
     * reescrito tanto no caminho do save quanto no do personagem novo, porque
     * `diamantes` vale zero nos dois
     */
    this.carregarDiamantesDaConta(client.session);

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
     * `onChefeDerrotado` declarado â€” e ligar antes de `jogar` existir
     * seria um `undefined` silencioso, do tipo que so apareceria na
     * primeira vitoria da arena
     */
    this.conectarChefe();

    /**
     * Paga o que ficou pendido enquanto este jogador estava fora.
     *
     * O dinheiro de um item vendido offline e o item de um anuncio
     * cancelado com a mochila lotada. As duas filas vivem no servidor
     * desde a venda e so tem sessao onde cair quando ele volta â€” e o
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

        this.creditarAoDono(
          sessao,
          pagamento.currency ?? MOEDA.OURO,
          pagamento.coins,
        );
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
         * vez. Um `filter` que devolvesse `added >= count` â€” o
         * inverso â€” apagava a fila justamente no caso em que a
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

    /**
     * O FARM OFFLINE, e ele e resolvido AQUI, antes do primeiro pacote.
     *
     * ## POR QUE NESTE PONTO
     *
     *porque e o unico lugar em que as tres coisas que o accrue precisa
     * estao prontas ao mesmo tempo:
     *
     * 1. a sessao existe e tem os STATS DERIVADOS â€” o `restaurar` ja
     *    rodou o `applyEquipment`, entao o `attack` do jogador e o de
     *    verdade, com equipamento e bonus, e nao o da ficha
     * 2. o motor esta FOCADO neste jogador (`focusPlayer` na linha de
     *    cima), entao `grantXp` e `applyEquipment` escrevem em quem
     *    acabou de entrar e nao em quem entrou por ultimo
     * 3. NADA FOI ENVIADO AINDA â€” o `WELCOME` sai na proxima linha
     *
     * Se o accrue rodasse depois do `WELCOME`, o jogador veria um painel
     * com o nivel velho e so no pacote seguinte o nivel novo, com o
     * inventario mudando debaixo do cursor. Aqui ele entra no jogo ja
     * com o resultado
     *
     * ## E POR QUE DENTRO DE `withPlayer`
     *
     * O `focusPlayer` ja aponta para este jogador, mas `withPlayer`
     * tambem garante que uma excecao dentro do accrue nao deixe o foco
     * vazando para o proximo `tick`
     */
    this.engine.withPlayer(sessao.id, () => {
      this.resolverFarmOffline(sessao);
    });

    client.enviar(SERVER_EVENTS.WELCOME, {
      playerId: id,
      protocolVersion: PROTOCOL_VERSION,
      classId: classe.id,
      tickRate: this.config.tickRate,
    });

    this.anunciar(id, true);
  }

  /**
   * CONFERE O TOKEN DE ENTRADA E O QUEIMA.
   *
   * ## POR QUE O TOKEN MORRE AQUI
   *
   * Um token de uso unico que sobrevivesse a uma recusa abriria uma porta:
   * o jogador entra, o servidor recusa por `NAME_TAKEN` porque a conta esta
   * aberta em outra aba, e o token ainda valeria para a proxima
   *
   * Queimar ANTES das checagens de nome e classe e o que garante que um
   * token = uma tentativa. Se validasse e so queimasse no sucesso, um
   * jogador travado em `NAME_TAKEN` ficaria com o token na mao para tentar
   * de novo quantas vezes quisesse — e o `NAME_TAKEN` e exatamente o caso
   * em que o jogador vai querer tentar de novo
   *
   * ## POR QUE O TOKEN E REEMITIDO A CADA TENTATIVA
   *
   * Justamente por causa disso. O front pede um token novo sempre que o
   * jogador clica em Jogar, entao recusar aqui devolve o jogador para a
   * tela de personagem e ele tenta de novo com um token novo
   */
  confereTokenDeEntrada(token) {
    if (!token) {
      return { ok: false, motivo: REJECT.BAD_TOKEN };
    }

    const corpo = this.verificadorDeToken?.(token) ?? null;

    if (!corpo) {
      return { ok: false, motivo: REJECT.BAD_TOKEN };
    }

    /**
     * O TOKEN PRECISA VIR DE UMA CONTA QUE TEM O PERSONAGEM.
     *
     * Sem esta conferenca, o token seria a unica autoridade: bastaria o
     * servidor emitir um para "Ana" e ele valeria para sempre, mesmo que a
     * conta de Ana apagasse o personagem no meio do caminho
     *
     * E o que amarra o token ao que existe: o front pode pedir um token
     * para qualquer coisa, e so passa quem tem o personagem na conta
     */
    /**
     * O TIPO PRECISA VIA JUNTO DO ID.
     *
     * `contas.personagens` chama `normalizarIdentidade`, que escolhe o
     * prefixo do arquivo pelo `tipo`: carteira vira `carteira_0x...`, Google
     * vira o `sub` cru. Passando so o `id`, a busca ia pro arquivo `0x...`,
     * que nao existe, e TODO token seria recusado — o sintoma seria "o
     * login funciona mas ninguem entra no jogo"
     *
     * O token guarda o `tipo` da conta justamente para esta linha
     */
    const personagens =
      this.contas?.personagens({
        tipo: corpo.tipoConta,
        id: corpo.contaId,
      }) ?? [];

    const temOPersonagem = personagens.some(
      (p) => nameKey(p.nome) === nameKey(corpo.nome) && p.classe === corpo.classe,
    );

    if (!temOPersonagem) {
      return { ok: false, motivo: REJECT.BAD_TOKEN };
    }

    return { ok: true, corpo };
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
 *    o portal â€” e o portal seria decoracao
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
     * A ARENA ACEITA UMA PESSOA DE CADA VEZ.
     *
     * ## POR QUE A TRAVA FICA AQUI, E NAO NO `createBosses`
     *
     * Porque o chefe por jogador resolve a VIDA, e nao o ACESSO. Sem esta
     * trava, dois jogadores na arena teriam dois Hulks com vida separada e
     * lutando ao mesmo tempo no mesmo pixel — cada um so vendo o dele, e
     * cada um ENTITY_atacando o dono. Os dois bonecos brigando com um Hulk
     * invisivel e o pior defeito de jogo que existe, e e melhor nao deixar
     * a situacao existir
     *
     * ## POR QUE SO A ARENA
     *
     * Porque a arena tem `bossPorJogador`, e o resto dos mapas tem chefe
     * compartilhado de proposito: o vale e feito para dois caçarem o mesmo
     * guardian. Travar todo mapa com chefe ia transformar a campanha em
     * fila
     *
     * ## E O JOGADOR QUE ESTA JA DENTRO
     *
     * A sessao que esta tentando sair para fora e contada como presente, e
     * assim ela nao tranca a si mesma
     */
    if (emCima.destino?.id === ARENA_ID && this.arenaOcupadaPor(sessao)) {
      this.avisoDoDono(
        sessao,
        "Tem alguem lutando na arena. Tente de novo quando ele sair.",
        true,
      );

      return false;
    }

    /**
     * A TRAVA, e a RECUSA COM MOTIVO.
     *
     * O `engine.travessarPortal` tambem confere a trava, mas ele so
     * devolve `false` â€” e o jogador ficaria em cima do portal apertando
     * um botao que nao faz nada, sem nunca saber o porquÃª. Aqui a recusa
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
   * LIGA OU DESLIGA a tag do jogador sobre o boneco dele.
   *
   * ## POR QUE NAO VAI PELO `operarGuilda`
   *
   * Porque o `operarGuilda` marca o arquivo de guildas e chama o
   * `applyEquipment`, e esta operacao nao e nenhuma das duas coisas: e uma
   * preferencia de tela, que nao muda nenhum stat de ninguem. Passando por
   * la, cada clique no interruptor reescreveria o arquivo de guildas inteiro
   * e recalcularia os atributos de todo mundo que esta online
   *
   * E o store ainda e quem confere que o jogador tem guilda: um pedido de
   * quem nao tem devolve "semGuilda" e nada acontece
   *
   * ## POR QUE O AVISO DE RECUSA E O MESMO DA GUILDA
   *
   * Porque o store devolve o motivo e o painel ja sabe ler o aviso do
   * `operarGuilda`. Uma frase nova aqui exigiria uma entrada nova em
   * `GUILD_MENSAGEM` para um caso que ja tem nome
   */
  definirTagDoJogador(sessao, pedido) {
    if (!this.guild) return false;

    const resultado = this.guild.definirMostrarTag(
      chaveDaSessao(sessao),
      pedido.mostrar,
    );

    if (resultado && resultado.ok === false) {
      /**
       * O "igual" NAO vira aviso.
       *
       * E a unica recusa silenciosa, porque nao e um erro: e o interruptor
       * ja na posicao que o jogador pediu. Um "voce ja esta assim" apareceria
       * a cada clique repetido, e o jogador aprenderia a ignorar os avisos
       * de guilda por inteiro
       */
      if (resultado.motivo !== "igual") {
        this.mensagemDeGuilda(resultado.motivo);
      }

      return false;
    }

    this.marcarGuildaSuja();

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
 * inverso â€” criar e so depois descontar â€” criaria guilda de graÃ§a
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

    /**
     * O ESTILO vai pela MESMA rota, e o store revalida.
     *
     * O `parsePanel` ja devolveu `null` para um `icone` ou uma `cor` que
     * nao existam no catalogo, entao aqui ja chega limpo. E o store valida
     * de novo porque ele e quem grava no disco â€” duas validacoes em series
     * e nao uma a mais: uma no protocolo, para o payload, e outra no store,
     * para o arquivo
     */
    icone: pedido.icone,
    cor: pedido.cor,

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
   * guilda que nao cabe naquele generic â€” ela e a unica que COBRA. E e
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
 * ensinaria o jogador a ignorar o aviso â€” que e o caminho mais curto para
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
 * O BAU DA BASE: deposita e retira itens do personagem.
 *
 * ## POR QUE ISTO NAO E O `mexerNoCofre` DE NOVO
 *
 * Porque o cofre precisa do `GuildStore` â€” que so existe online â€” e o
 * bau nao precisa de store nenhum. A movimentacao do bau esta no
 * `GameEngine.mexerNoBau`, junto com o resto do estado do jogador, e
 * funciona igual no single player. Aqui so resta o que e do servidor: a
 * traducao do pedido e o aviso na tela
 *
 * ## POR QUE UM `case` DE CINCO LINHAS E NAO UM METODO COM A REGRA
 *
 * Porque a regra esta no motor, e a razao de o pedido passar por aqui e
 * so uma: transformar `bauAcao` + `uid` + `count` em uma chamada. O que o
 * pedido NAO pode fazer e chegar sem acao â€” e o `parsePanel` ja deixou
 * `bauAcao` como `null` nesse caso, entao um pedido invalido cai fora
 * deste `if` e vira um no-op, que e o resultado certo
 *
 * ## E POR QUE NAO SEGURO A REGRA DE "O ITEM TEM QUE ESTAR COM MIM"
 *
 * Porque o bau e do NPC da BASE e a base tem um lugar para o jogador
 * ficar. O cofre exige guilda porque guilda e um estado que o jogador
 * pode nao ter; o bau nao tem essa condicao. O que o jogador precisa e o
 * painel aberto, e o painel so abre pelo clique no NPC â€” no online, isso
 * e o mesmo NPC do mapa
 */
  mexerNoBau(sessao, pedido) {
    /**
     * PEDIDO SEM ACAO E PEDIDO INVALIDO.
     *
     * O `parsePanel` ja reduziu qualquer texto fora da lista a `null`, e
     * um `case` que chamasse o motor com `null` cairia no `retirar`
     * â€” porque o `mexerNoBau` do motor trata "tudo que nao e depositar"
     * como retirada. Transformar um pedido malformado em uma retirada
     * seria o pior erro possivel aqui: o jogador perderia um item por ter
     * o socket fora do ar no meio do envio
     */
    if (!pedido.bauAcao) return false;

    const resultado = this.engine.mexerNoBau(
      pedido.bauAcao,
      pedido.uid,
      pedido.count,
    );

    if (!resultado?.ok) {
      this.avisoDoDono(sessao, resultado?.reason ?? "Nao deu.", true);

      return false;
    }

    /**
     * A MENSAGEM DO SUCESSO, que e o que fecha a operacao.
     *
     * Sem ela o jogador deposita e a unica prova de que funcionou e o
     * item ter desaparecido da coluna da esquerda â€” que e exatamente o
     * que acontece quando algo da errado do outro lado
     *
     * O `parcial` tem frase propria porque "guardou 3" quando o jogador
     * pediu 5 e a peca mais 2 esta na mochila e nao no bau. Dizer
     * "guardado" sem o "de 5" deixaria o jogador achando que perdeu as
     * outras 2
     */
    if (resultado.parcial) {
      this.avisoDoDono(
        sessao,
        `${resultado.guardado} guardado, ${resultado.devolvido} devolvido ` +
          "por falta de espaco.",
      );

      return true;
    }

    const verbo = pedido.bauAcao === "depositar" ? "guardado" : "retirado";

    this.avisoDoDono(sessao, `${resultado.guardado} ${verbo}.`);

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
 * cofre. Se o cofre recusar, o item volta inteiro â€” e a ordem contraria
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
   * em um unico lugar, e o caminho do jogo real nao passava por ele â€”
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
    /**
     * O CAMPO AUSENTE CHEGA COMO `null`, E NAO COMO `undefined`.
     *
     * ## POR QUE ESTE `if` NAO E MAIS SO `!== undefined`
     *
     * Porque o `parsePanel` reconstroi a mensagem por uma lista fechada, e
     * um campo que o cliente nao mandou vira `null`, nao fica de fora. Um
     * `if (pedido.moeda !== undefined)` era verdade para TODO pedido de
     * item, e o deposito de um item entrava no ramo das moedas com o valor
     * zero e voltava recusado por quantidade
     *
     * Os tres campos do cofre chegam sempre, porque e assim que a lista
     * fechada funciona. E o `!= null` e o que diz "este pedido quer
     * dinheiro", em vez de dizer "este pedido veio sem o campo"
     */
    if (pedido.moeda !== undefined && pedido.moeda !== null) {
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

/**
     * A PILHA DA MOCHILA, e ela pode ser achada de DUAS maneiras.
     *
     * ## O QUE O PAINEL MANDA
     *
     * A chave do item escolhido e `entrada.uid ?? entrada.itemId`. Para uma
     * pilha com `uid` — que e o caso normal, o `Inventory.summary` sempre o
     * manda — a chave e o `uid` completo e o `findByUid` acha na hora
     *
     * ## O QUE QUEBRAVA
     *
     * Uma pilha SEM `uid` fazia o painel recorrer ao `itemId`, e ai o
     * `findByUid` recebia `"couro_goblin"` — que nao casa com nenhum
     * `uid`, que tem o formato `couro_goblin#common#1`. O servidor recusava
     * com `semPedido`, e o painel mostrava a recusa mais generica do
     * dicionario, que fala em "pedido" e nao em "item nao encontrado"
     *
     * ## POR QUE O `itemId` E ACEITO
     *
     * Porque e o que o painel manda quando nao ha `uid`, e recusar ali
     * tornava impossivel depositar uma pilha vinda de um caminho que nao
     * passa pelo `summary`. O `itemId` sozinho nao identifica a pilha
     * exata — duas pilhas do mesmo item com raridades diferentes sao duas —
     * entao a primeira que casa e a escolhida, e o `count` pedido e o que
     * limita o deposito
     */
const stack =
      sessao.inventory.findByUid(pedido.item) ??
      sessao.inventory.findStack(pedido.item) ??
      null;

    if (!stack) {
      return { ok: false, motivo: "semPedido" };
    }

    /**
     * A CHAVE COM QUE A PILHA SAI.
     *
     * O `takeUid` procura pelo `uid` de novo, entao ele tem que receber o
     * `uid` da PILHA ACHADA e nao a chave que o painel mandou. Sao a mesma
     * coisa no caso normal, e diferentes no caso do `itemId`: mandar
     * `takeUid("couro_goblin")` nao encontraria nada, e o deposito falharia
     * DEPOIS de passar pela guarda — que e o jeito mais caro de falhar
     */
    const chaveDaPilha = stack.uid ?? pedido.item;

    const pedido2 = Math.floor(Number(pedido.quantidade) || 0);

  /**
   * A PILHA some do inventario e vai para o cofre, e o `taken` e a prova
   * do que saiu. O `taken` e usado em vez do `stack` original porque o
   * `takeUid` pode ter esvaziado a pilha e removido ela da mochila â€” usar
   * o `stack` depois disso seria ler um objeto que nao esta mais na lista
   */
  const taken = sessao.inventory.takeUid(chaveDaPilha, pedido2);

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
    /**
     * O MESMO `null` DO DEPOSITO, E PELO MESMO MOTIVO.
     *
     * O campo ausente vira `null` na lista fechada do `parsePanel`, entao um
     * saque de item que testasse so `!== undefined` entraria no ramo das
     * moedas — e o jogador veria "quantidade invalida" ao tentar retirar
     * uma pilha
     */
    if (pedido.moeda !== undefined && pedido.moeda !== null) {
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
     * conhecer a `Inventory` â€” ele vive em `data/guild`/`game/guild` e a
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
   * A ARENA JA TEM ALGUEM, E NAO E A SESSAO QUE PERGUNTA?
   *
   * ## POR QUE PERCORRE `clients`, E NAO O `world.players` DO MOTOR
   *
   * Porque `world.players` e o elenco do mapa em FOCO no ultimo quadro. A
   * pergunta "quem esta na arena" e sobre o estado de cada sessao, e nao
   * sobre o que o motor tem em memoria agora — um jogador parado em outro
   * mapa pode ter a arena como destino salvo e nao estar la
   *
   * E pelas CHAVES, pelo mesmo motivo do `expulsarDaArena`: `clients` e um
   * `Map` guardado ao contrario, e o valor e um `true` de presenca
   *
   * @param {object} sessao a sessao que esta perguntando
   * @returns {boolean} `true` se tem OUTRO jogador dentro da arena
   */
  arenaOcupadaPor(sessao) {
    for (const client of this.clients.keys()) {
      const outra = client.session;

      if (!outra || outra === sessao) continue;
      if (outra.mapId !== ARENA_ID) continue;

      return true;
    }

    return false;
  }

  conectarChefe() {
    /**
     * A VITORIA NAO TIRA NINGUEM DA ARENA.
     *
     * ## O QUE MUDOU
     *
     * Este gancho chamava `expulsarDaArena`, que devolvia todo mundo ao
     * `arenaOrigem` com o aviso "O chefe caiu. Voce voltou para onde
     * estava". Agora ele so avisa
     *
     * ## POR QUE
     *
     * Porque a arena tem uma SAIDA: o vao aberto na parede de baixo, com a
     * passagem que leva direto para o mapa 2. E porque a entrada deixou de
     * ser o botao da HUD e passou a ser a passagem do topo do mapa 1 — ou
     * seja, ninguem tem mais `arenaOrigem`, e a expulsao nao tinha destino
     * para onde mandar ninguem
     *
     * ## POR QUE O JOGADOR FICA, E O AVISO DIZ PARA ONDE IR
     *
     * Porque expulsar e o oposto do que a arena faz. O jogador lutou ate o
     * fim, ganhou a missao 1.19, e ser jogado de volta para o mapa da
     * briga seria desfezer a vitoria com uma teletransporte. Ele sai andando,
     * pelo vao, para o mapa 2 — que e onde a campanha continua
     */
    this.engine.onChefeDerrotado = ({ map }) => {
      if (!map?.id) return;

      for (const client of this.clients.keys()) {
        const sessao = client.session;

        if (!sessao || sessao.mapId !== map.id) continue;

        /**
         * O CHEFE NAO VOLTA PARA ESTE JOGADOR.
         *
         * E o que separa "derrotar o chefe" de "abater o chefe tres vezes".
         * O `createBosses` le este registro antes de montar a criatura, e
         * devolve uma lista vazia para quem ja venceu — entao a arena que o
         * jogador reencontra nao tem Hulk
         *
         * E por SESSAO, e nao global: o chefe e por jogador, e o registro
         * tambem. Dois podem ter feito a mesma luta em epocas diferentes
         */
        marcarChefeVencido(sessao.id, map.id);

        this.avisoDoDono(
          sessao,
          "O chefe caiu. A saida fica no vao da parede de baixo.",
        );
      }
    };
  }

  /**
   * A VITORIA: todo mundo que esta na arena volta para onde veio.
   *
   * ## POR QUE SAO TODOS, E NAO SO QUEM AJUDOU
   *
   * O chefe e da arena, e o loot e de quem matou. Mas o resto estava
   * dentro da luta acompanhando â€” e deixar quem nao conhececeu a vitoria
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
   * Quem esta em outro mapa nem entra na conta â€” e nao ha como "sair" de
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
     * de `true` sem sessao nenhuma, e ninguem seria expulsado â€” o
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
       * entrou por outra via â€” um comando de teste, um portal futuro â€”
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
   * que o jogador esta â€” dois `op` dependeriam de o cliente saber em que
   * mapa ele esta, e um cliente desatualizado travaria o jogador na
   * arena sem nenhum botao para sair
   *
   * ## O DESTINO NAO VEM DO CLIENTE
   *
   * O pedido nao tem mapa nenhum. A arena e `boss_1` porque o servidor
   * diz que e, e o destino da volta e a posicao que o SERVIDOR guardou.
   * Um `mapa` vindo do cliente daria a qualquer um um teletransporte
   * para onde quisesse â€” o mesmo motivo que o `travessarPortal` nao
   * aceita destino
   *
   * ## POR QUE A POSICAO E DA SESSAO E NAO DO SAVE
   *
   * A volta e "para onde eu estava", e isso e estado de UMA visita. Se
   * gravasse no save, o jogador que entrasse na arena, desconectasse e
   * voltasse um dia depois teria o destino sobrescrito por outra
   * visita â€” e a "volta" levaria a um lugar de horas atras. A sessao
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
     * A ENTRADA NA ARENA E A MISSAO DO CHEFE, E A CONFERIDA E AQUI.
     *
     * ## POR QUE ESTA GUARDA VIVE NO SERVIDOR E NAO SO NA BOX
     *
     * Porque o botao da box e um detalhe visual. Sem esta linha, um cliente
     * velho — ou um editado de proposito — mandaria `IR_PARA_ARENA` e entraria
     * numa luta de nivel 20 sem nunca ter chegado no degrau dela. O servidor
     * e quem decide o mapa, entao e ele que recusa
     *
     * E a volta NAO e conferida: ela sai no `if (naArena)` acima, porque o
     * jogador ja esta dentro e o botao de sair nunca pode ficar preso por
     * causa de um degrau de missao
     *
     * ## POR QUE O `bad` E `true`
     *
     * Porque e uma recusa, e nao um aviso neutro: o jogador clicou num botao
     * que parecia morto e precisa ler o motivo. `travessarPortal` faz a
     * mesma coisa com `trava.motivo`, e os dois textos vem do mesmo modulo
     * para nao haver duas traducoes do mesmo motivo
     *
     * ## POR QUE ANTES DE GRAVAR A ORIGEM
     *
     * Porque `arenaOrigem` e o destino da volta, e uma recusa nao e uma
     * visita. Gravar antes deixaria o sessao apontando para o mapa em que o
     * jogador nunca saiu — inofensivo hoje, porque o proximo clique valido
     * sobrescreve, e um bug so no dia em que alguem ler esse campo sem
     * passar pela entrada
     */
    const entrada = entradaNaArena(sessao.quests?.mainIndex ?? 0);

    if (!entrada.ok) {
      this.avisoDoDono(sessao, entrada.motivo, true);

      return false;
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
   * A MINERACAO DE STEEL, do lado que manda nela.
   *
   * Tudo aqui e do SERVIDOR: o tempo, o sorteio, o saldo e a pedra. O
   * cliente manda "quero minerar esta prop" e nada mais â€” nem quantas
   * batidas quer, nem quanto tempo, nem quanto vale
   */

  /**
   * O ESTADO DAS PEDRAS DE UM MAPA.
   *
   * Criado na primeira vez que alguem minerar nele, e nunca apagado: um
   * mapa com todas as pedras intactos nao tem entrada nenhuma, que e a
   * forma correta de dizer "nada foi mexido aqui"
   */
  minasDoMapa(mapId) {
    if (!this.minasPorMapa.has(mapId)) {
      this.minasPorMapa.set(mapId, new Map());
    }

    return this.minasPorMapa.get(mapId);
  }

  /**
   * A PEDIDA QUE ESTA EM UM MAPA, pelo id.
   *
   * Devolve `null` se o id nao existir no mapa. E a funcao que impede o
   * cliente de minerar qualquer coisa: o id vem do clique, entao um
   * jogador poderia mandar o id de uma prop de outro mapa, ou de uma que
   * nao existe
   */
  pedidaNoMapa(mapId, propId) {
    if (typeof mapId !== "string" || typeof propId !== "string") {
      return null;
    }

    return (
      findMap(mapId)?.props?.find((prop) => prop.id === propId) ?? null
    );
  }

  /**
   * QUANTAS BATIDAS RESTAM NESTA PEDIDA DO MUNDO.
   *
   * ## POR QUE O CONTADOR VIVE AQUI E NAO NA SESSAO
   *
   * Porque a PEDIDA e do mapa. Com o contador na sessao, largar e voltar
   * criava um estado novo com o total cheio: o jogador minerava 4 das 5
   * batidas do comum, andava 3 passos, voltava, e a pedra tinha as 5 de
   * novo â€” o tempo gasto sumia sem aviso
   *
   * E o que resolve as DUAS coisas de uma vez: o progresso sobrevive ao
   * cancelamento, e dois jogadores na mesma pedra veem o mesmo numero
   *
   * ## O QUE O ESTADO GUARDA
   *
   * `voltaEm` e 0 enquanto a pedra esta DE PE, e so ganha um relogio quando
   * ela e demolida. E o que faz `pedidaEsgotada` ser uma unica pergunta:
   * "tem estado e `voltaEm > agora`". Sem isso, uma pedra sendo minerada
   * apareceria na lista de fora do mapa
   *
   * A entrada some quando o prazo vence, no `tickMineracao`, e a pedra volta
   * ao total cheio por nao ter mais estado
   */
  batidasRestantes(mapId, prop, agora) {
    const total = batidasDe(prop?.type);

    if (total <= 0) return 0;

    const estado = this.minasDoMapa(mapId).get(prop.id);

    if (!estado) return total;

    if (estado.voltaEm > agora) return 0;

    return Math.max(0, estado.batidasRestantes);
  }

  /**
 * O QUE O MOTOR LÃŠ DE UMA PEDIDA, para formatar o painel.
 *
 * ## POR QUE O MAPA ENTRA COMO PARAMETRO E NAO SAI DA CONSULTA
 *
 * Porque o motor formata o painel do jogador que esta em foco, e o
 * `world` dele ja aponta para o mapa certo. Passar o mapa deixa a funcao
 * utilizavel fora do `withPlayer` â€” que e o que acontece na primeira
 * montagem, antes de alguem entrar
 *
 * E o `agora` e lido de `this.relogio`, e nao de `Date.now`: o painel e
 * montado 4 vezes por segundo por jogador, e um prazo lido de um relogio
 * que nao e o do servidor faria o tempo da batida pular de uma conta para
 * outra
 */
leituraDePedida(propId, mapId) {
    const agora = this.relogio();
    const mapa = mapId ?? this.engine.world?.map?.id;
    const prop = this.pedidaNoMapa(mapa, propId);

    if (!prop) return null;

    return {
      batidas: batidasDe(prop.type),
      batidasRestantes: this.batidasRestantes(mapa, prop, agora),
      esgotada: this.pedidaEsgotada(mapa, propId, agora),
    };
  }

  /**
   * O ESTADO INICIAL DE UMA PEDIDA, criado na primeira vez que alguem
   * encosta nela.
   *
   * E aqui que o total vira numero guardado. Sem esta linha o
   * `batidasRestantes` devolveria o total a cada leitura e a pedra nunca
   * perderia uma batida
   */
  abrirPedida(mapId, prop) {
    const minas = this.minasDoMapa(mapId);

    if (minas.has(prop.id)) return minas.get(prop.id);

    const estado = {
      batidasRestantes: batidasDe(prop.type),
      voltaEm: 0,
      mineradaPor: null,
    };

    minas.set(prop.id, estado);

    return estado;
  }

  /**
   * ESTA PEDIDA ESTA FORA DO MAPA AGORA?
   *
   * E a consulta que o `drawProps` do cliente usa para NAO desenhar a
   * pedra, e a que o `minerar` usa para recusar. As duas leem o mesmo
   * estado, entao nao ha caminho em que o jogador veja a pedra e o
   * servidor diga que ela nao existe
   */
  pedidaEsgotada(mapId, propId, agora) {
    const estado = this.minasDoMapa(mapId).get(propId);

    if (!estado) return false;

    return estado.voltaEm > agora;
  }

  /**
   * OS IDS DAS PEDRAS FORA DO MAPA, para o pacote.
   *
   * E so o que esta fora. Um mapa com 40 cristais e um demolido leva um
   * id no snapshot, e nao quarenta: o `snapshot` vai a 20Hz para todo
   * mundo no mapa, e a lista completa seria o mesmo dado repetido 20
   * vezes por segundo sem ninguem ver mudanca nela
   */
  pedidasEsgotadas(mapId, agora) {
    const esgotadas = [];

    for (const [propId, estado] of this.minasDoMapa(mapId)) {
      if (estado.voltaEm > agora) esgotadas.push(propId);
    }

    return esgotadas;
  }

  /**
   * A RESSURREICAO DAS PEDIDAS, e o PRAZO DELAS.
   *
   * Roda no `tick`, junto com o prazo dos anuncios e o dos convites, e
   * pelo mesmo motivo deles: o jogador parado tambem precisa ver a pedra
   * voltar. Se isto so rodasse quando alguem minerasse, a pedra de quem
   * parou de minerar nunca voltaria
   */
  tickMineracao(agora) {
    if (this.minasPorMapa.size === 0) return;

    for (const [mapId, minas] of this.minasPorMapa) {
      for (const [propId, estado] of minas) {
        /**
         * SAI A PEDIDA CUJO PRAZO VENCEU.
         *
         * O `> 0` e obrigatorio, e nao um detalhe. Uma pedra DE PE tem
         * `voltaEm = 0` â€” o zero e "nunca foi demolida" â€” e `0 <= agora` e
         * verdade desde sempre. Sem a guarda, este laco apagava o estado de
         * toda pedra que estivesse sendo minerada, a cada tique: o contador
         * voltava ao total cheio 20 vezes por segundo e a pedra nunca
         * perdia uma batida
         *
         * E o que separa "prazo venceu" de "nunca teve prazo"
         */
        if (estado.voltaEm === 0 || estado.voltaEm > agora) continue;

        minas.delete(propId);
      }

      /**
       * O MOTOR SABE QUE A PEDIDA VOLTOU.
       *
       * E por aqui que o COLISOR do servidor para de barrar um cristal que
       * nao esta mais la. O cliente recebia a lista pelo pacote, mas quem
       * decide se o jogador anda e o servidor â€” e sem esta linha o jogador
       * ficava preso num cristal invisivel do lado dele da tela
       */
      this.engine.sincronizarPedidasFora(
        mapId,
        this.pedidasEsgotadas(mapId, agora),
      );
    }
  }

  /**
   * ENCOSTAR NUMA PEDIDA E COMECAR A MINERAR.
   *
   * E o `op` do cliente. Devolve `true` quando aceitou, e o motor usa
   * isso para saber se ha algo para andar ate
   *
   * ## A RECUSA VEM ANTES DE QUALQUER COISA SER MEXIDA
   *
   * Nenhum saldo, nenhum relogio e nenhuma prop muda antes das quatro
   * checagens: o mapa tem essa prop, ela e do tipo que se mineraria, ela
   * ainda tem batida e o jogador nao esta encostado em outra. Pedir a
   * pedra de outro mapa, ou uma segunda pedra enquanto anda ate a
   * primeira, nao pode deixar rastro nenhum
   */
  minerar(sessao, propId, agora) {
    if (!sessao) return false;

    /**
     * JA ESTA ENCOSTADO EM ALGUMA PEDIDA: este pedido e o de PARAR.
     *
     * O sinal de que o jogador quer parar e ele estar minerando. E o que
     * faz o mesmo clique na tela serve para as duas coisas, sem o cliente
     * precisar saber em que estado esta
     */
    if (sessao.mineracao) {
      this.pararMineracao(sessao);

      return true;
    }

    const prop = this.pedidaNoMapa(sessao.mapId, propId);

    if (!prop) return false;
    if (!mineravel(prop.type)) return false;
    if (this.pedidaEsgotada(sessao.mapId, prop.id, agora)) return false;

const batidas = batidasDe(prop.type);

    if (batidas <= 0) return false;

    /**
     * A PEDIDA ABRE AGORA, com o que ainda resta nela.
     *
     * Se ela ja foi minerada antes, o estado existe e o `batidasRestantes`
     * e o que sobrou. E o que faz o progresso sobreviver ao cancelamento: o
     * jogador pode largar a pedra no meio e voltar â€” ela nao volta cheia
     *
     * E `abrirPedida` antes do `alcancado`, e nao no painel: o numero do
     * painel e lido do estado, entao o estado precisa existir antes de
     * alguem chegar a mostrar
     */
    this.abrirPedida(sessao.mapId, prop);

    const restantes = this.batidasRestantes(sessao.mapId, prop, agora);

    /**
     * SEM BATIDA RESTANDO, O PEDIDO E RECUSADO.
     *
     * O `pedidaEsgotada` logo acima ja pegou a pedra no prazo de
     * ressurreicao. Este e o caso da pedra com zero batidas e ainda de pe,
     * que so acontece se o estado for escrito por outro caminho
     */
    if (restantes <= 0) return false;

    /**
       * A PRIMEIRA BATIDA NAO E NA HORA.
       *
       * E NEM NA HORA DA CHEGADA: o relogio so comeca a correr quando o
       * jogador encosta, e nao quando ele clica.
       *
       * Com o relogio contando desde o clique, uma caminhada de 25s dava
       * duas batidas de steel com o boneco ainda atravessando o vale â€” o
       * jogador recebia por minerar algo em que nao estava encostado. E o
       * painel, que so abre na chegada, apareceria mostrando tempo demais
       * pela metade
       *
       * ## POR QUE E O SERVIDOR QUE LIGA O RELOGIO, E NAO O MOTOR
       *
       * Porque o motor sabe que o jogador chegou, mas quem tem o relogio e o
       * servidor. O `alcancado` e a ponte: o motor lacra, e o primeiro
       * tique em que o lacre aparece e o que arma o `proximoGolpeEm`
       */
      sessao.mineracao = {
      propId: prop.id,
      type: prop.type,

      /**
       * `null` ate o jogador encostar. O `proximoGolpeEm` de verdade e
       * escrito no primeiro tique em que o `alcancado` aparecer
       */
      proximoGolpeEm: null,

      /**
       * O JOGADOR JA CHEGOU NA PEDIDA?
       *
       * Comeca em `false`, e quem vira `true` e o motor, no `runMineracao`.
       * O servidor nao escreve aqui: ele nao anda, entao nao tem como saber
       * se o boneco ja encostou â€” so o motor, que produziu o caminho, tem
       * essa resposta
       *
       * E o que segura a mineracao durante a caminhada. Sem ele, o
       * proprio `tick` soltaria o pedido antes do primeiro passo
       */
      alcancado: false,

      /** o relogio ja foi armado? o que separa "indo" de "minerando" */
      contando: false,
    };

    sessao.mineracaoCaminho = [];
    sessao.mineracaoRecalcula = 0;

    /**
     * O SORTEIO VEM DE UM `random` DA PROPRIA SESSAO, E NAO DE
     * `Math.random`.
     *
     * Nao e preciosismo. E que o painel do cliente mostra o steel desta
     * batida assim que ela cai, e o numero que aparece tem de ser o que o
     * servidor somou â€” se o cliente sorteasse por conta propria, mostraria
     * o premio de outra pedra
     *
     * A semente e o instante em que o jogador encostou, o que faz a
     * primeira batida sair sempre no mesmo valor para quem encostou no
     * mesmo milissegundo. E reproduzivel: o mesmo instante e a mesma
     * pedra dao a mesma sequencia, sem precisar guardar nada
     */
    sessao.mineracaoRandom = createRandom(agora >>> 0);

    return true;
  }

  /**
   * SOLTAR A PEDIDA.
   *
   * Nao devolve o que foi minerado e nao apaga o progresso: o que o
   * jogador ja extraiu fica com ele, e a pedra continua com as batidas
   * que faltavam. Parar e um direito do jogador, nao um castigo
   */
  pararMineracao(sessao) {
    if (!sessao) return false;

    sessao.mineracao = null;
    sessao.mineracaoCaminho = [];
    sessao.mineracaoRecalcula = 0;

    return true;
  }

  /**
   * O PASSO DO RELOGIO DA MINERACAO.
   *
   * Roda por sessao, dentro do `withPlayer`, porque cada jogador tem o
   * seu relogio e o seu caminho ate a pedra. Uma batida de 10s com o tick
   * a 20Hz dÃ¡ 200 tiques de folga, entao o `while` nao vai acumular
   * batidas perdidas quando o servidor engasgar
   */
  tickMineracaoDaSessao(sessao, delta, agora) {
    const min = sessao.mineracao;

    if (!min) return;

/**
       * ANDOU PARA LONGE: SO SOLTA SE ELE JA TINHA CHEGADO.
       *
       * ## POR QUE O `alcancado` PRECISA VIR ANTES DA DISTANCIA
       *
       * Porque o jogador que acabou de CLICAR na pedra esta no meio do
       * vale, a 400px dela. Sem esta guarda, o `tick` seguinte ja soltava
       * a mineracao â€” o boneco nao dava um passo sequer e o painel nunca
       * aparecia. O sintoma era "cliquei e nada acontece"
       *
       * Quem escreve o `alcancado` e o MOTOR, no `runMineracao`, que e o
       * unico que sabe se o A* entregou o jogador na pedra. E ele roda
       * dentro do `engine.update`, ANTES deste laco â€” entao a ordem dos
       * dois e o que faz o campo chegar preenchido
       *
       * O `alcancado` e a MESMA conta do `encostadoNaPedida`, entao os dois
       * nao podem divergir: se o motor marcou chegada e a distancia diz que
       * nao encosta, alguma coisa mexeu no jogador no meio do caminho
       */
      if (min.alcancado === true && !this.encostadoNaPedida(sessao, min, agora)) {
        this.pararMineracao(sessao);

        return;
      }

      /**
       * O RELOGIO ARMA QUANDO O JOGADOR ENCOSTA, E SO UMA VEZ.
       *
       * E o que separa "indo para a pedra" de "minerando". O painel so abre
       * depois do lacre, entao o tempo que o jogador ve e sempre o tempo de
       * verdade: dez segundos ate a primeira batida contados de quando ele
       * chegou
       */
      if (min.alcancado === true && min.contando !== true) {
        min.contando = true;
        min.proximoGolpeEm = agora + SEGUNDOS_POR_BATIDA * 1000;

        return;
      }

      /**
       * AINDA CAMINHANDO: NAO HAY O QUE CONTAR.
       *
       * O `proximoGolpeEm` ainda e `null`, e e o `while` abaixo que
       * cortaria o mineracao se ele rodasse. Este `return` e o que segura a
       * caminhada
       */
if (min.contando !== true) return;

    /**
     * A BATIDA CAI QUANDO O RELOGIO VENCE, E NAO A CADA TIQUE.
     *
     * E o que separa o steel de um numero que so muda a cada 50ms. O
     * `while` e para o caso de o servidor ter ficado parado mais de um
     * periodo: sem ele, quem ficou dois minutos sem tick devolveria uma vez
     * e perderia as batidas do intervalo
     */
    let steelDoTique = 0;

    /**
     * A PEDIDA DE ONDE A BATIDA SAI, e nao a primeira do mapa.
     *
     * Uma vez por chamada e nao por batida: a prop nao muda enquanto o
     * jogador esta encostado nela, e o `while` pode passar varias vezes se o
     * servidor ficou parado
     */
    const prop = this.pedidaNoMapa(sessao.mapId, min.propId);

    if (!prop) {
      this.pararMineracao(sessao);

      return;
    }

    const estado = this.abrirPedida(sessao.mapId, prop);

    while (agora >= min.proximoGolpeEm) {
      min.proximoGolpeEm += SEGUNDOS_POR_BATIDA * 1000;

      const ganho = sortearSteel(sessao.mineracaoRandom ?? Math.random);

      sessao.inventory.addSteel(ganho);
      steelDoTique += ganho;

      /**
       * A BATIDA SAI DA PEDIDA, E NAO DA SESSAO.
       *
       * E o que faz o progresso sobreviver ao cancelamento: largar a
       * pedra e voltar encontra o mesmo estado, com o que ja tinha sido
       * tirado. Antes o contador vivia na sessao e cada `minerar` criava um
       * total cheio â€” o tempo gasto sumia sem aviso
       */
      estado.batidasRestantes -= 1;

      if (estado.batidasRestantes <= 0) {
        this.demolirPedida(sessao, min, estado, agora);
        this.pararMineracao(sessao);

        return;
      }
    }

if (steelDoTique > 0) {
        sessao.mineracaoSteelNoTique = steelDoTique;
        sessao.mineracaoSteelEm = agora;

        /**
         * A BATIDA CONTA PARA O TUTORIAL DE MINERAR.
         *
         * E aqui, e nao no `GameEngine`, porque a batida e do SERVIDOR: o
         * motor so desenha o relogio da mineracao, e quem conta o tempo de
         * verdade e este `while`. Ligar no motor contaria o quadro, e o
         * tutorial fecharia com o jogador encostado na pedra sem ter tirado
         * nada dela
         *
         * O `count` do tutorial e o numero de BATIDAS, e nao de segundos:
         * a batida e o que o jogador ve â€” o steel piscando na tela â€” e e
         * ela que precisa ser contada. Um tutorial de "minere por 30
         * segundos" contaria tempo com o painel fechado, e o jogador
         * cumpriria sem nunca ter visto a pedra
         *
         * E uma chamada so por tique, e nao uma por batida: o tutorial
         * cuida de 1 e nao tem por que contar quantas batidas o `while`
         * accumulou. O que importa e que ele aconteceu
         */
        sessao.quests?.onAcao?.("mine");
      }
    }

  /**
   * A PEDIDA CAIU: ela some do mapa e fica de fora por um tempo.
   *
   * O estado e o MESMO que a batida vinha baixando â€” e por isso que o
   * metodo recebe o `estado` pronto e nao o procura. A unica coisa que
   * muda aqui e o `voltaEm`, que ate agora era 0 porque a pedra estava de pe
   *
   * E some para TODO MUNDO: o outro jogador encostado nela ve o painel
   * fechar junto
   */
  demolirPedida(sessao, min, estado, agora) {
    estado.batidasRestantes = 0;
    estado.voltaEm = agora + PEDRA_VOLTA_EM_S * 1000;
    estado.mineradaPor = sessao.id ?? null;

    /**
     * O MOTOR SABE QUE A PEDIDA CAIU.
     *
     * O SERVIDOR e quem manda no movimento, entao e o colisor DELE que
     * precisa parar de barrar a pedra â€” e nao so o do cliente. Sem esta
     * linha o jogador via o cristal sumir e continuava preso no lugar dele
     */
    this.engine.sincronizarPedidasFora(
      sessao.mapId,
      this.pedidasEsgotadas(sessao.mapId, agora),
    );
  }

  /**
   * O JOGADOR ESTA ENCOSTADO NA PEDIDA?
   *
   * E a MESMA funcao que o motor usa, com o mesmo numero e a mesma folga.
   * Ver o `encostadoNaPedida` do modulo: os dois lados precisam dar a mesma
   * resposta, senao o servidor veria o jogador longe enquanto o motor o
   * considerava parado na pedra, e a batida cairia com o boneco a um passo
   */
  encostadoNaPedida(sessao, min, agora) {
    const prop = this.pedidaNoMapa(sessao.mapId, min.propId);

    if (!prop) return false;

    const jogador = sessao.player;

    if (!jogador) return false;

    return encostadoNaPedida(
      jogador.x,
      jogador.y,
      prop,
      jogador.radius,
    );
  }

  /**
   * O PAINEL DA MINERACAO DE UMA SESSAO, ou `null`.
   *
   * ## POR QUE ELE CALCULA O QUE FALTA, E NAO MANDA O QUE FALTA
   *
   * O painel vai a 4Hz e o relogio a 20Hz. Se o pacote trouxesse "faltam
   * 7" e o cliente descontasse sozinho, o numero pararia por 250ms entre
   * um clique e o seguinte. Mandando o relogio, o painel faz a conta com o
   * relogio dele e o tempo anda sozinho â€” e o numero de batidas vem
   * pronto, porque esse e inteiro e nao muda entre um tique e outro
   *
   * E o mesmo desenho do `morte.restante`, que e o outro prazo que a HUD
   * exibe
   */
  mineracaoPainel(sessao, agora) {
    const min = sessao?.mineracao;

    if (!min) return null;

    /**
     * INDO PARA A PEDIDA: SEM TEMPO, SEM PAINEL.
     *
     * O painel so existe com o relogio armado. Sem este `null`, o cliente
     * receberia `proximoGolpeEm: null` e o `MineracaoPanel` â€” que so abre
     * com `encostado` â€” receberia um `NaN` em `(proximoGolpeEm - agora)`
     *
     * E a MESMA regra que segura o `tick`, entao nao ha quadro em que o
     * painel mostra um tempo que o relogio ainda nao estÃ¡ contando
     */
    if (min.contando !== true) return null;

    const prop = this.pedidaNoMapa(sessao.mapId, min.propId);

    /**
     * AS BATIDAS VEM DO MUNDO, E NAO DA SESSAO.
     *
     * E o que faz o painel mostrar `3/5` depois de o jogador ter largado a
     * pedra duas vezes no meio: o contador esta no estado da pedida, e o
     * total vem do tipo
     *
     * A pedra pode ter sumido entre o pedido e este painel â€” outro jogador
     * terminou a ultima batida nesse intervalo. AÃ­ o `batidasRestantes`
     * devolve 0 e o painel mostra `0/5` por um pacote, ate o
     * `pararMineracao` fechar no proximo tique
     */
    const restantes = this.batidasRestantes(sessao.mapId, prop, agora);

    return {
      propId: min.propId,
      type: min.type,
      batidas: batidasDe(min.type),
      batidasRestantes: restantes,

      /**
       * O TEMPO RESTANTE, e ele conta a batida em curso uma vez so.
       *
       * Sao `restantes - 1` periodos CHEIOS depois do que falta para a
       * batida que ja esta em curso. Somar `restantes` periodos contaria
       * o da batida em curso duas vezes: um lendario com 20 batidas
       * prometia 3min30 quando leva 3min20, e era 10s de mentira a cada
       * vez que o painel era aberto
       *
       * E o que o `MineracaoPanel` refaz sozinho a partir do
       * `proximoGolpeEm`; este campo e o valor pronto para quem so quiser
       * mostrar a frase
       */
      segundosRestantes: Math.max(
        0,
        Math.ceil((min.proximoGolpeEm - agora) / 1000) +
          Math.max(0, restantes - 1) * SEGUNDOS_POR_BATIDA,
      ),

      steelMaximo: steelMaximoDe(batidasDe(min.type)),
      steelAgora: sessao.inventory?.steel ?? 0,
      proximoGolpeEm: min.proximoGolpeEm,
    };
  }

  /**
   * O MAPA DO TESTE, e a VOLTA DELE.
   *
   * ## O MESMO MOLDE DA ARENA, DE PROPONITO
   *
   * As duas fazem a mesma coisa: um `op`, dois sentidos, e a origem
   * guardada na sessao antes da troca. Copiar o `irParaArena` inteiro
   * seria reescrever o mesmo estado de sessao com outro nome
   *
   * ## POR QUE A SESSAO PRECISA DO MAPA DE ONDE VOLTAR
   *
   * Sem isso, o primeiro clique numa conexao nova gravaria `base` como
   * destino, e a volta jogaria o jogador no meio do hub em vez de onde
   * ele realmente estava. E o `arenaOrigem` explica o mesmo problema no
   * comentario dele
   *
   * ## POR QUE NAO HA AVISO QUANDO NAO HA PARA ONDE VOLTAR
   *
   * Porque o caso nao chega: se o jogador esta no mapa de teste, ele so
   * chegou nele por este botao, que e o que guardou a origem. A guarda
   * do `irParaArena` cobre a arena, que tem outros caminhos de entrada â€”
   * o mapa de teste nao tem nenhum, nem portal
   */
  irParaTeste(sessao) {
    if (!sessao) return false;

    const teste = findMap(MAP_TESTE_ID);

    if (!teste) return false;

    const noTeste = sessao.mapId === MAP_TESTE_ID;

    /**
     * A POSICAO DE HOJE e guardada ANTES da troca.
     *
     * Ler depois seria ler a posicao do mapa de teste, e a volta
     * jogaria o jogador no meio dele duas vezes
     */
    if (noTeste) {
      const origem = sessao.mapaTesteOrigem ?? null;

      if (!origem) return false;

      this.moverParaMapa(
        sessao,
        findMap(origem.mapId),
        { x: origem.x, y: origem.y },
      );

      sessao.mapaTesteOrigem = null;

      return true;
    }

    sessao.mapaTesteOrigem = {
      mapId: sessao.mapId,
      x: Math.round(sessao.player?.x ?? teste.spawn.x),
      y: Math.round(sessao.player?.y ?? teste.spawn.y),
    };

    this.moverParaMapa(sessao, teste, null);

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
   * estivesse em foco e nao do que pediu â€” que e o bug que o
   * `portalSoDeUm` trava
   *
   * ## A POSICAO E DO `setMap`, E NAO MINHA
   *
   * O `setMap` ja posiciona: `chegada ?? map.spawn`. Reescrever a
   * posicao aqui[l] fora criaria dois lugares que podem divergir â€” e o
   * `setMap` sozinho colocaria o jogador no spawn da arena, que e
   * exatamente o que se quer na entrada
   *
   * A unica coisa que este metodo acrescenta e a conferida da chegada,
   * que o `setMap` nao faz
   *
   * ## A CONFERIDA ANTES, E O `world.collision` JA DO MAPA NOVO
   *
   * O `isInsideBounds` roda ANTES do `setMap`, entao ele ainda consulta
   * o colisor do mapa de ORIGEM â€” que e retangular e sempre aceitaria
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
 * em telas diferentes â€” recusa aqui e aviso no painel. Traduzir num
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
     * `world.player` ficava `null` e o `applyEquipment` â€” que a
     * travessia de portal e toda operacao de guilda chama â€” estourava em
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
           * pacote â€” por isso o slot so e lido quando nao veio `uid`
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

        case PANEL_OPS.EXPAND_INVENTORY:
          this.expandirMochila(sessao);
          break;

        case PANEL_OPS.FIX_MISPLACED_EQUIPMENT:
          this.engine.fixMisplacedEquipment();
          break;

case PANEL_OPS.TOGGLE_AUTO_PLAY:
            this.engine.toggleAutoPlay();
            break;

          /**
           * O DASH, e ele e a unica ORDEM que o motor decide a DIRECAO.
           *
           * O pedido nao leva vetor, e isso e o que o torna seguro: a mira
           * ja chegou pelo `INPUT` a 45Hz e o `aplicarIntencao` ja a converteu
           * em um ponto no mundo. O motor le esse mesmo `pointer` e sai para
           * la
           *
           * Mandar a direcao no pedido daria ao cliente duas fontes de
           * verdade: o pacote do `INPUT` e o do `PANEL`, que chegariam em
           * ordens diferentes, e o dash iria para a direcao do mais velho
           *
           * E o `useDash` recusando sozinho quando o cooldown nao acabou: o
           * servidor nao precisa de uma segunda trava, e uma conferida a
           * mais aqui so atrasaria a resposta do botao
           */
case PANEL_OPS.DASH:
  this.engine.useDash();
  break;

  /**
   * O FARM OFFLINE, ligado pelo jogador na pausa.
   *
   * Nao ha payload para ler, e isso e o ponto: o mapa, o tempo e o poder
   * sao todos do servidor. O pedido existe so para dizer "agora"
   *
   * O accrue em si NAO acontece aqui â€” acontece quando o jogador VOLTA,
   * no `entrar`. Ligar aqui e so carimbar o relogio e gravar
   */
  case PANEL_OPS.INICIAR_FARM_OFFLINE:
    this.iniciarFarmOffline(sessao);
    break;

  /**
   * O JOGADOR VIU O RELATORIO.
   *
   * E o unico motivo de o relatorio nao reaparecer a cada entrada: ele
   * mora na sessao, e a sessao vive enquanto o jogador esta online
   */
  case PANEL_OPS.FARM_OFFLINE_VISTO:
    this.farmOfflineVisto(sessao);
    break;

        case PANEL_OPS.SET_AUTO_POTION:
          /**
           * A CONFIGURACAO DO USO AUTOMATICO DA POCAO.
           *
           * Os tres campos num pedido so porque eles nao sao independentes:
           * trocar a pocao com o automatico ligado desliga o automatico, e
           * um pedido so garante que essa regra chegue inteira
           *
           * O `itemId` chega como `null` quando o jogador tirou a pocao do
           * slot e `undefined` quando ele so mexeu no interruptor â€” e a
           * distincao e do `parsePanel`. O motor valida o resto: se o id
           * nao for pocao de cura, o pedido volta inteiro sem mudar nada
           */
          this.engine.configurarAutoPocao({
            ligado: pedido.pocaoLigado ?? undefined,
            limiar: pedido.pocaoLimiar ?? undefined,

            /**
             * O `itemId` vai CRU, sem `??`.
             *
             * O motor distingue tres estados por `undefined` â€” ausente e
             * "nao mexeu", `null` e "tirar do slot". Um `?? null` aqui
             * apagaria a distincao e cada clique no interruptor do painel
             * viraria um "tirar a pocao" junto, porque o `undefined` do
             * `parsePanel` viraria `null` neste ponto
             */
            itemId: pedido.pocaoItemId,
          });
          break;

        case PANEL_OPS.TOGGLE_QUEST_AUTO:
          this.engine.toggleQuestAuto();
          break;

        case PANEL_OPS.FOCUS_QUEST:
          this.engine.focusQuest(pedido.questId);
          break;

        case PANEL_OPS.CREATE_EXPEDITION: {
          /**
           * CRIAR A EXPEDIÇÃO DO CHEFE.
           *
           * ## POR QUE A CHEGADA NA PARTY É AQUI E NÃO NO STORE
           *
           * Porque o `ExpeditionStore` não conhece party. São dois estados
           * diferentes — a expedition é um ACORDO de intenção sobre um chefe, e
           * a party é um grupo que anda pelo mundo junto, com loot dividido. O
           * store que sabe dos dois é este `GameServer`, e é aqui que a regra
           * "não nos dois ao mesmo tempo" fica
           *
           * E a regra é real: estar numa expedition não tira o jogador da
           * party, e o inverso também não. Quem está numa party com o grupo já
           * formado não pode entrar numa expedition, e o caminho é sair da
           * party primeiro — que é o botão que ele já tem na HUD
           *
           * ## E POR QUE O CHEFE É CONFERIDO CONTRA O CATÁLOGO
           *
           * Porque o id vem do cliente, e é dado não confiável como todo o
           * resto do pedido. Sem esta conferência um cliente alterado criaria
           * "expedição do chefe Khaos", e ela apareceria na busca dos outros
           * apontando para uma tela que não abre
           */
          if (this.parties.partyDe(sessao?.id)) {
            this.engine.marcarErroDaExpedicao(EXPEDICAO_ERROS.EM_PARTY);
            break;
          }

          const chefeId = chefePorId(pedido.expedicaoChefe)
            ? pedido.expedicaoChefe
            : null;

          const criacao = this.expedicoes.criar({
            jogadorId: sessao?.id ?? null,
            jogadorNome: sessao?.name ?? sessao?.definition?.name ?? "",
            chefeId,
            dificuldade: pedido.expedicaoDificuldade,
          });

          this.engine.marcarErroDaExpedicao(criacao.erro ?? null);
          break;
        }

        case PANEL_OPS.JOIN_EXPEDITION: {
          /**
           * A MESMA TRAVA DA CRIAÇÃO, e pela mesma razão.
           *
           * Entrar numa expedição é o mesmo compromisso que criar uma: o
           * jogador vai estar com aquele grupo numa hora marcada. Ficar com os
           * dois ao mesmo tempo é o estado sem Meaning nenhum, e é o tipo de
           * coisa que o jogador não percebe até estar longe do chefe tentando
           * decidir de qual lado está
           */
          if (this.parties.partyDe(sessao?.id)) {
            this.engine.marcarErroDaExpedicao(EXPEDICAO_ERROS.EM_PARTY);
            break;
          }

          const entrada = this.expedicoes.entrar({
            jogadorId: sessao?.id ?? null,
            expedicaoId: pedido.expedicaoId,
          });

          this.engine.marcarErroDaExpedicao(entrada.erro ?? null);
          break;
        }

        case PANEL_OPS.LEAVE_EXPEDITION: {
          const saida = this.expedicoes.sair({
            jogadorId: sessao?.id ?? null,
            expedicaoId: pedido.expedicaoId,
          });

          this.engine.marcarErroDaExpedicao(saida.erro ?? null);
          break;
        }

        case PANEL_OPS.DISBAND_EXPEDITION: {
          const fim = this.expedicoes.dissolver({
            jogadorId: sessao?.id ?? null,
            expedicaoId: pedido.expedicaoId,
          });

          this.engine.marcarErroDaExpedicao(fim.erro ?? null);
          break;
        }

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

        case PANEL_OPS.LEARN_TREE_NODE:
          /**
           * O PONTO DA ARVORE DE HABILIDADES.
           *
           * O `noId` vem do cliente e nao vale nada: o `learnTreeNode`
           * procura o no no catalogo da CLASSE DA SESSAO, e recusa quando o
           * no e de outra, quando o nivel nao alcanca, quando o
           * pre-requisito falta ou quando o ponto nao paga
           *
           * E o `exige` que ele confere, e nao o `requer`: os nos do
           * catalogo chamam o campo de `exige`, e o motor lia um campo que
           * nenhum no tem. O `?? []` escondia isso — a conferencia de
           * pre-requisito nunca rodou, e o servidor aceitava um no de
           * nivel 3 sem o de nivel 1 estar comprado
           */
          this.engine.learnTreeNode(pedido.noId);
          break;

        case PANEL_OPS.CLAIM_ALL_QUEST_REWARDS:
          /**
           * O resgate de tudo que a aba aberta tem na fila.
           *
           * O mesmo descarte do resgate de uma: o `scope` e o `mapa` vem
           * do cliente e nao valem nada. Quem filtra e o
           * `claimablesDe`, que le a fila do `QuestLog` — e a fila e a
           * unica coisa que decide o que existe para pagar
           *
           * Sem o `mapa` o pagamento vazaria para o outro mapa: as duas
           * abas existem nos dois, e o botao da principal do vale pagaria
           * os degraus do mapa 2 junto. E cada pagamento passa pelo
           * `claim`, que tira a linha da fila, entao repetir o pedido
           * inteiro nao paga duas vezes
           */
          this.engine.claimQuestRewards(pedido.scope, pedido.mapa);
          break;

        case PANEL_OPS.CLAIM_PASS_REWARD:
          /**
           * O resgate de um dia do passe.
           *
           * O `passId` e o `dia` vem do cliente e nao valem nada: o motor
           * acha o premio no CATALOGO pelo par e nao paga se ele nao estiver
           * la. E o `claimPassReward` confere a lista de resgates antes de
           * pagar, entao repetir o pedido nao paga duas vezes
           */
          this.engine.claimPassReward(pedido.passId, pedido.dia);
          break;

        case PANEL_OPS.SET_PASS_PREMIUM:
          /**
           * O interruptor do premium.
           *
           * Leva o valor novo e nao um "inverter", porque dois cliques
           * rapidos chegam em qualquer ordem
           *
           * O `setPassPremium` debita diamante DENTRO do motor, que nao sabe
           * que conta existe. O saldo do personagem ja esta certo — ele foi
           * lido da conta na entrada —, entao a sincronizacao de volta aqui
           * e o que faz o outro personagem da conta ver o novo saldo
           */
          this.engine.setPassPremium(pedido.ativo, pedido.passId ?? null);
          this.guardarDiamantesNaConta(sessao);
          break;

        case PANEL_OPS.TRAVESSAR_PORTAL:
          this.travessarPortal(pedido.portalId, sessao);
          break;

      case PANEL_OPS.IR_PARA_ARENA:
        this.irParaArena(sessao);
        break;

      /**
       * O MAPA DE TESTE, pelo mesmo caminho da arena.
       *
       * Um `op` para os dois sentidos: quem decide se entra ou se volta
       * e o mapa em que o jogador esta, e nao o botao
       */
      case PANEL_OPS.IR_PARA_TESTE:
        this.irParaTeste(sessao);
        break;

      /**
       * A MINERACAO, pelo mesmo caminho de dois sentidos.
       *
       * O `minerar` decide sozinho o que o pedido quer: se a sessao ja
       * esta encostada, o pedido e parar. E por isso que ele precisa do
       * relogio â€” o `agora` e o que decide se a pedra ainda tem batida
       *
       * Nao ha retorno para o cliente. O painel volta pelo caminho de
       * sempre, no `PLAYER_STATE` a 4Hz, e e de la que a HUD le as
       * batidas que restam. Um `return` aqui so serviria para o cliente
       * descobrir se a pedra era valida antes de o painel chegar
       */
      case PANEL_OPS.MINERAR:
        this.minerar(sessao, pedido.propId, this.relogio());
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

        case PANEL_OPS.SET_GUILD_STYLE:
          /**
           * O EMBLEMA e A COR da guilda.
           *
           * Vai pelo `operarGuilda` como toda acao de guilda, e por isso o
           * store devolve "semPermissao" para quem nao e o lider â€” o
           * servidor nao repete essa regra, ele so guarda o disco
           */
          this.operarGuilda(sessao, pedido, (s, p) =>
            s.definirEstilo(chaveDaSessao(sessao), {
              icone: p.icone,
              cor: p.cor,
            }),
          );
          break;

        case PANEL_OPS.SET_SHOW_TAG:
          /**
           * A TAG sobre o boneco de quem pediu.
           *
           * Nao passa pelo `operarGuilda` porque ele RECUSA a operacao sem
           * ser do jogador â€” e esta nao e uma acao da guilda, e uma
           * preferencia sobre o proprio boneco. Qualquer membro pode, e o
           * store e quem confere que ele tem guilda
           */
          this.definirTagDoJogador(sessao, pedido);
          break;

        case PANEL_OPS.BAU:
          this.mexerNoBau(sessao, pedido);
          break;

        case PANEL_OPS.SET_BESTIARY_AUTO:
          /**
           * O mesmo pedido LIGA e DESLIGA.
           *
           * O botao "ir matar" da tela e um interruptor: pedir a
           * criatura que ja esta em cacada significa desistir dela. Se
           * este `op` so ligasse, nao existiria caminho para desligar
           * pelo botao â€” e o jogador so poderia resolver recarregando
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
          this.engine.deliverCollection(pedido.collectionId, pedido.indice ?? null);
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
         * e um `break` e o caminho da recusa e o mais comum â€” ouro
         * insuficiente acontece toda hora. Sem o `showMessage`, o
         * jogador veria o botao nao fazer nada
         */
        case PANEL_OPS.ENCHANT: {
          const daMochila = Boolean(pedido.uid);
          const doCorpo = Boolean(pedido.slotId);

          if (daMochila === doCorpo) {
            this.engine.showMessage(
              "Escolha uma peÃ§a para encantar.",
              true,
            );

            break;
          }

          const resultado = daMochila
            ? this.engine.enchantItem(pedido.uid)
            : this.engine.enchantSlot(pedido.slotId);

          if (!resultado?.ok) {
            this.engine.showMessage(
              resultado?.reason ?? "NÃ£o foi possÃ­vel encantar.",
              true,
            );
          }

          break;
        }

        /**
         * APRIMORAR uma peca, da mochila OU do corpo.
         *
         * ## POR QUE ACEITA OS DOIS LADOS
         *
         * Porque o `enhance` migrou do SLOT para a PECA (ver
         * `Equipment.equip`). O numero agora viaja com o item e sobrevive
         * a trocar de lugar, entao a restricao antiga â€” "so peca vestida"
         * â€” nao tem mais razao de existir
         *
         * A distincao que sobra e a do `ENCHANT`: `uid` para a mochila e
         * `slotId` para o corpo, e nunca os dois, porque o servidor
         * recusaria um pedido ambiguo de qualquer jeito
         */
        case PANEL_OPS.ENHANCE: {
          const daMochila = Boolean(pedido.uid);
          const doCorpo = Boolean(pedido.slotId);

          if (daMochila === doCorpo) {
            this.engine.showMessage(
              "Escolha uma peÃ§a para aprimorar.",
              true,
            );

            break;
          }

          const resultado = daMochila
            ? this.engine.enhanceItem(pedido.uid)
            : this.engine.enhanceSlot(pedido.slotId);

          if (!resultado?.ok) {
            this.engine.showMessage(
              resultado?.reason ?? "NÃ£o foi possÃ­vel aprimorar.",
              true,
            );
          }

          /**
           * NAO CHAMA `enviarPainel` AQUI.
           *
           * Quem responde o pedido e o `aplicarPainel`, mas quem manda o
           * painel e o `tratarComando`: todo `CLIENT_COMMANDS.PANEL` cai
           * no `enviarPainel` do fim, dentro do `withPlayer` certo. Uma
           * chamada aqui seria um painel a mais por aprimoramento, com o
           * `withPlayer` ja rodado duas vezes
           */
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

        case PANEL_OPS.MARKET_BID:
          this.darLanceNoMarket(sessao, pedido);
          break;

        /**
         * USAR um consumivel da mochila.
         *
         * O `usarItem` e do motor e devolve `false` quando nao fez
         * nada â€” item que nao existe, item sem `use`, ou vida ja cheia.
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
         * pediu esta morto â€” sem isso, `REVIVER` viraria um jeito de
         * recarregar vida cheia de graÃ§a em qualquer momento
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
         * mandar para o ponto que quisesse â€” inclusive pelo meio de uma
         * arvore ou de uma parede, que e onde a walk real nunca entraria
         *
         * A recusa e o aviso do proprio motor, nao um `showMessage`
         * aqui: sao tres motivos possiveis (sem viagem, sem pergaminho,
         * destino em outro mapa) e cada um tem sua frase
         */
        case PANEL_OPS.TELEPORTAR:
          this.engine.teleportarParaOFim();
          break;

        /**
         * ANDA ATÉ O NPC, para abrir o painel dele.
         *
         * ## POR QUE SÓ O ID CHEGA AO MOTOR
         *
         * O pedido traz `npcId` e nada mais, e o motor procura esse NPC no
         * MUNDO DELE. Se o cliente mandasse `x`/`y`, qualquer um se mandaria
         * para o ponto que quisesse — e, pior, por dentro de parede
         *
         * ## E POR QUE UM `id` INVALIDO NÃO É ERRO
         *
         * Porque ele já pode ter sumido: o jogador clicou num mercador, o
         * NPC foi removido do mapa naquele instante, e o pedido chegou um
         * tique depois. O `find` do motor não acha ninguém, a caminhada não
         * começa, e o jogador fica parado — que é o que ele veria de qualquer
         * forma
         *
         * E os campos vem de `pedido`, e não de `op`: o `op` e a STRING do
         * comando, e e o `switch (op)` que compara com o `PANEL_OPS`. Os
         * dados do pedido (`pedido.uid`, `pedido.slotId`) moram no objeto
         * de fora
         */
        case PANEL_OPS.IR_ATE_NPC: {
          const npcId = pedido.npcId;

          if (typeof npcId === "string" && npcId.length > 0) {
            this.engine.irAteNpc(npcId);
          }

          break;
        }

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
         * A LOJA DE PRODUTOS, pelo mesmo motivo das duas de cima: uma sessao
         * so, preco e lista vindos do catalogo do servidor
         */
        case PANEL_OPS.BUY_SHOP:
          this.comprarProduto(sessao, pedido);
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
          resultado = { ok: false, motivo: "Jogador nÃ£o encontrado" };
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
          resultado = { ok: false, motivo: "Ele nÃ£o estÃ¡ na sua party" };
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
         * estado inicial â€” e o jogador teria clicado duas vezes para
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
         * estar na party â€” passar a lideranca para quem esta fora da
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
         * Sem isto, so a tela de quem pediu era atualizada â€” e quem
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
     * unica â€” duas copias da condicao divergem na primeira vez que uma
     * delas for esquecida
     *
     * ## POR QUE NAO TEM AVISO
     *
     * Porque o jogador pediu o silencio. Havia um `showMessage` com o
     * "Nao da para atacar na base." aqui, e ele se repetia a cada clique
     * e a cada tecla de ataque dentro do hub: a base e o lugar onde o
     * jogador passeia, clica nos NPCs e acerta o ar, e uma tarja vermelha
     * a cada tentativa era mais ruÃ­do do que informaÃ§Ã£o
     *
     * O clique continuar sem resposta e a leitura correta de la: nao ha
     * inimigo, entao nao ha golpe, e o circulo tracejado do alcance ja
     * some no hub (`drawAim`) como o aviso de que ali nao se briga. O
     * silencio do golpe e do mesmo aviso, sem repetir a cada tecla
     *
     * E o `return` continua: e ele que impede o golpe de sair. O que foi
     * removido e so a frase
     */
    this.engine.withPlayer(sessao.id, () => {
      const ehGolpe =
        action === "BASIC_ATTACK" ||
        (targetId !== null && targetId !== undefined);

      if (!this.engine.emZonaDeCombate() && ehGolpe) {
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
   * chamada a missao ficaria mostrando 0 de 5 para sempre, sem avancar e sem fechar â€” e no nivel maximo ninguem mais subia, entao
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
   * Antes, `limites` vinha de `config.limites` â€” um campo que NINGUEM
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
    /**
     * O `agora` E O DO SERVIDOR, e nao um `Date.now()` solto aqui dentro.
     *
     * A restauracao usa o relogio para cortar um `ultimoEm` de farm
     * offline escrito no futuro. Sem injetar, o corte seria feito no
     * relogio da maquina e o accrue no `config.agora` do servidor â€” dois
     * relogios na mesma entrada, e uma hora que o motorMock avanca nao
     * mexe na restauracao
     */
    applyCharacterSave(sessao, salvo, {
      ...this.entradaNoMapa(),
      agora: this.relogio(),
    });

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
     * classe â€” o mesmo Guerreiro nivel 30 batia fraco ate vestir
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
   * LIGA O FARM OFFLINE de um jogador, e grava na hora.
   *
   * ## POR QUE `guardar` DENTRO DO METODO
   *
   * Porque o proximo passo do jogador e SAIR do jogo, e o `desconectar`
   * grava. Se o pedido fosse atendido e o jogador fechasse a janela antes
   * do socket fechar, o `desconectar` ainda rodaria e gravaria â€” mas nao
   * ha garantia de que ele rode: um `location.reload()` mata o socket sem
   * passar pelo caminho limpo
   *
   * Gravar aqui custa um acesso ao disco e fecha o buraco inteiro. O
   * jogador que recarrega a pagina com o botao clicado tem o farm salvo,
   * e nao um ganho perdido
   *
   * ## E POR QUE MAPA E O DO JOGADOR, E NAO O DO PEDIDO
   *
   * Porque o pedido nao tem mapa. O `PANEL_OPS` foi declarado sem payload
   * justamente para isso: se o cliente pudesse escolher o mapa, ele
   * escolheria o do chefe. Quem decide e o servidor, e o mapa em que o
   * jogador esta
   */
  iniciarFarmOffline(sessao) {
    if (!sessao) return null;

    const mapaId = sessao.mapId ?? this.mapaInicial?.id ?? null;

    sessao.farmOffline = iniciarFarm(
      sessao.farmOffline,
      { agora: this.relogio(), mapaId },
    );

    this.guardar(sessao);

    return sessao.farmOffline;
  }

  /**
   * O JOGADOR FECHOU O RELATORIO, e o servidor pode esquece-lo.
   *
   * Sem isto o relatorio voltaria a cada entrada, porque ele mora na
   * sessao e sobrevive enquanto o jogador estiver conectado
   */
  farmOfflineVisto(sessao) {
    if (!sessao?.farmOffline?.relatorio) return false;

    sessao.farmOffline = {
      ...sessao.farmOffline,
      relatorio: null,
    };

    /**
     * GRAVA NA HORA, e pelo mesmo motivo do `iniciarFarmOffline`.
     *
     * O relatorio estava na sessao E no arquivo: o accrue roda antes do
     * primeiro pacote, e o `desconectar` do jogador anterior ja o gravou.
     * Limpar so a memoria deixava o arquivo com o relatorio, e um servidor
     * que reiniciasse antes do autosave de 30s mostraria a tela de novo â€”
     * o jogador que ja viu o resultado vendo o mesmo resultado outra vez
     *
     * E o inverso do `guardar` do `iniciar`: aquele evita perder um farm
     * que o jogador nao viu, este evita repetir um que ele ja viu
     */
    this.guardar(sessao);

    return true;
  }

  /**
   * RESOLVE O FARM OFFLINE, e entrega o que ele rendeu.
   *
   * ## POR QUE ISTO NAO DA ERRO
   *
   * Porque Called dentro do `entrar`, antes do `WELCOME`. Um farm que
   * desse exception derrubaria o jogador no meio da entrada, depois de o
   * save ja ter sido lido e a sessao ja criada â€” e ele entraria sem
   * `WELCOME`, sem painel e sem poder fazer nada
   *
   * Um `try` com aviso no console e o preco. Perder um farm e um
   * contratempo; derrubar a entrada e perder o jogo
   */
  resolverFarmOffline(sessao) {
    if (!sessao?.farmOffline?.ativo) return null;

    try {
      const agora = this.relogio();

      /**
       * O JOGADOR COMO A CONTA VE.
       *
       * `level` e `attack` sao os DERIVADOS, os que o `applyEquipment`
       * acabou de escrever com o equipamento vestido. E o que faz o
       * farm de quem trocou de uma espada boa valer mais do que o de
       * quem nao trocou â€” que e a resposta que o jogador espera quando
       * diz "contabiliza com o meu poder"
       */
      const jogador = {
        level: sessao.player?.level ?? 1,
        attack: sessao.player?.attack ?? 1,
        lootFilter: sessao.lootFilter ?? null,
      };

      const { estado, relatorio, ganhos } = resolverFarm({
        estado: sessao.farmOffline,
        jogador,
        agora,
      });

      sessao.farmOffline = estado;

      if (!relatorio || relatorio.abates <= 0) {
        this.avisoDoDono(
          sessao,
          "Nao houve tempo de farm util enquanto voce esteve fora.",
        );

        return relatorio;
      }

      const entregue = this.entregarFarmOffline(sessao, ganhos, relatorio);

      /**
       * O OURO, e ele e creditado AQUI e nao dentro da entrega dos itens.
       *
       * Porque `entregarFarmOffline` cuida de espaco, e ouro nao ocupa
       * espaco nenhum: ele vai para `inventory.coins`, que e um numero, e
       * nao uma pilha. Passar pelo mesmo caminho faria `cabe()` responder
       * sobre a mochila cheia e o jogador perderia ouro que ele nao tinha
       * como perder â€” a contabilidade do relatorio mostraria `coins` e o
       * saldo nao mudaria
       *
       * E creditar ANTES dos itens nao importa, e por isso a ordem nao e
       *uma regra: nao ha dependencia entre eles
       */
      sessao.inventory.addCoins(relatorio.coins);

      /**
       * O XP VAI DEPOIS DO LOOT, e por um motivo que nao e de ordem
       * alfabetica.
       *
       * Entregar o item nao muda o nivel. Mas o LOOT e o que muda a
       * mochila, e o XP o que muda os STATS: se o XP viesse primeiro, o
       * `applyEquipment` rodaria com o equipamento antigo, e o `attack`
       * que o proximo farm usaria ja seria outro
       *
       * O `grantXp` e do MOTOR e nao da sessao, e ele precisa do
       * `world.player` â€” que e exatamente o jogador em foco, porque esta
       * chamada inteira roda dentro do `withPlayer` do `entrar`
       */
      const niveis = grantXp(
        this.engine.world.player,
        relatorio.xp,
      );

      this.engine.applyEquipment();

      sessao.farmOffline = {
        ...sessao.farmOffline,
        relatorio: {
          ...relatorio,
          nivelDepois: sessao.player?.level ?? relatorio.nivelAntes,
          naMochila: entregue.mochila,
          noBau: entregue.bau,
          perdidos: entregue.perdidos,
        },
      };

      for (const nivel of niveis) {
        this.engine.announceLevelUp?.(nivel);
      }

      this.engine.quests?.onLevelUp?.(sessao.player?.level ?? 1);

      return sessao.farmOffline.relatorio;
    } catch (erro) {
      console.error(
        "[farmOffline] erro ao resolver o accrue:",
        erro?.stack ?? erro,
      );

      /**
       * O ESTADO VOLTA A DESLIGADO MESMO NO ERRO.
       *
       * Sem isto, um farm que deu exception continuaria ligado na sessao:
       * o jogador entraria de novo, o accrue tentaria de novo, e o erro
       * repetiria a cada entrada â€” com o relogio parado, porque `resolver`
       * so avanca `ultimoEm` quando termina
       */
      sessao.farmOffline = encerrarFarm(sessao.farmOffline);

      return null;
    }
  }

  /**
   * ENTREGA OS ITENS DO FARM: mochila, depois bau, e o resto some.
   *
   * ## POR QUE O BAU NO MEIO
   *
   * Porque o bau existe para ser o espaco de sobra, e a regra do jogo
   * para loot e descartar quando a mochila esta cheia â€” e descartar o
   * resultado de doze horas de farm seria a pior resposta possivel para
   * quem fez a coisa certa
   *
   * O bau tem 60 slots e a mochila 20. Um farm entrega no maximo 60
   * entradas, entao tudo cabe em um dos dois, e o `perdidos` quase nunca
   * sai do zero. Ele existe para o bau tambem estar cheio, e nesse caso o
   * relatorio DIZ que perdeu â€” o jogador ve o numero em vez de
   * descobrir depois
   */
  entregarFarmOffline(sessao, ganhos, relatorio) {
    let mochila = 0;
    let bau = 0;
    let perdidos = 0;

    for (const ganho of ganhos) {
      const quantidade = Math.max(1, Math.floor(ganho.count || 1));

      const opcoes = {
        comercializavel: ganho.comercializavel ?? false,
        enhance: ganho.enhance ?? 0,
        enchant: ganho.enchant ?? null,
      };

      if (
        sessao.inventory.cabe(
          ganho.itemId,
          quantidade,
          null,
          sessao.equipment,
        )
      ) {
        const r = sessao.inventory.add(
          ganho.itemId,
          quantidade,
          null,
          opcoes,
        );

        mochila += r.added;
        perdidos += r.dropped;
        continue;
      }

      if (
        sessao.bau.cabe(ganho.itemId, quantidade, null, null)
      ) {
        const r = sessao.bau.add(ganho.itemId, quantidade, null, opcoes);

        bau += r.added;
        perdidos += r.dropped;
        continue;
      }

      perdidos += quantidade;
    }

    return { mochila, bau, perdidos };
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
     * jogador que ficou online sem tocar em nada nunca venceria â€” e o
     * item ficaria fora do alcance dele para sempre
     */
    this.expirarAnuncios();

    /**
     * O PRAZO DOS CONVITES.
     *
     * Corre aqui pelo mesmo motivo dos anuncios: o jogador parado tambem
     * precisa ver o convite sair de perto. Sem este `tick`, o convite
     * ficaria na tela ate o jogador clicar em algo, e o aceite seria
     * recusado pelo servidor com "o convite expirou" â€” a caixa ficaria
     * morta na frente de quem nao fez nada de errado
     */
    const expirados = this.parties.tick(this.engine.world);

    for (const alvo of expirados) {
      this.enviarConviteFechado(alvo.sessionId);
      this.enviarPartyNoPainel(alvo.sessionId);
    }

    /**
     * AS PEDIDAS QUE VOLTAM A EXISTIR, e as batidas de todo mundo.
     *
     * A ressurreicao roda ANTES do laco dos jogadores, e por um motivo
     * concreto: se a pedra de um jogador volta neste tique, ele precisa
     * ver a pedra de pe no mesmo quadro em que o relogio diz que ela
     * voltou. O contrario faria o painel abrir sobre uma pedra que o
     * cliente ja tinha escondido
     *
     * O segundo passo e por sessao, e roda DEPOIS do `engine.update`: o
     * motor e quem move o jogador, e a checagem de "o jogador ainda esta
     * encostado" so faz sentido com a posicao deste tique. Se rodasse
     * antes, o jogador que andou para longe no tique passaria mais um
     * tique inteiro encostado e receberia uma batida a mais
     */
    const agora = this.relogio();

    this.tickMineracao(agora);

    for (const client of this.clients.keys()) {
      if (!client.joined) continue;
      if (!client.session?.mineracao) continue;

      const sessao = client.session;

      // o ganho do tique e zerado ANTES, e nao depois: se o jogador
      // encostou a meio tique, o `mineracao` ja existe aqui e o painel
      // receberia o `steelNoTique` do tique em que ele encostou, que e
      // sempre zero. Zerar primeiro deixa o campo dizer a verdade sobre
      // ESTE tique
      sessao.mineracaoSteelNoTique = 0;

      this.engine.withPlayer(client.id, () => {
        this.tickMineracaoDaSessao(sessao, delta, agora);
      });
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
           * outro para quem nao atravessou â€” que e o bug de todo mundo
           * atravessar o portal junto
           */
          mapa: client.session.mapId,

        players: this.estadoJogadores(client),
          enemies: this.estadoInimigos(client),
          drops: this.estadoDrops(),
          projectiles: this.estadoProjetis(client),

          /**
           * OS IDS DAS PEDRAS QUE ESTAO FORA DO MAPA.
           *
           * Vem no estado do MUNDO e nao no painel, e pela razao do resto
           * do pacote: a pedra que o outro jogador demoliu some para todo
           * mundo, e nao so para quem encostou nela. Mandar no painel
           * faria a pedra desaparecer para quem olha e continuar de pe
           * para quem minerou
           *
           * E so a LISTA dos que estao fora. Com 40 cristais e um
           * demolido, o campo leva um id â€” e o `pedidasEsgotadas` devolve
           * so os que estao fora justamente para o campo nao crescer com o
           * tamanho do mapa
           */
          pedidasFora: this.pedidasEsgotadas(client.session.mapId, agora),
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
     * para o vazio de novo â€” o desperdicio voltaria sem ninguem perceber
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
       * um resultado identico â€” nenhuma anunciacao vence o prazo dentro
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
     * esta em outro mapa â€” ele so recebe uma posicao
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
       * mapa, a banda de jogadores era 50 x 50 registros por pacote â€” e o
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

        /**
         * O NIVEL DO JOGADOR REMOTO.
         *
         * ## POR QUE ESTE CAMPO ENTROU AGORA
         *
         * Porque a barra flutuante desenhava "Nv.1" para todo mundo: o
         * payload mandava `hp` e `maxHp`, mas nao o nivel, e o `Math.max(1,
         * Math.round(undefined ?? 1))` do cliente caia no piso. O jogador
         * via um nivel errado ao passar o mouse, e ele nao tem como ver o
         * verdadeiro em nenhum outro lugar da tela
         *
         * E o servidor e quem sabe o nivel: ele aplica xp e subiu o jogador
         * durante a partida. O cliente nunca teria como deduzi-lo
         */
        level: Math.max(1, Math.floor(p.level ?? 1)),
        x: Math.round(p.x),
        y: Math.round(p.y),

        /**
         * O `ackSeq` E O ULTIMO INPUT QUE ESTA POSICAO REFLETE.
         *
         * ## POR QUE O SERVIDOR PRECISA DEVOLVER ISSO
         *
         * A posicao acima e a que o servidor tinha quando ele a
         * calculou, e ele nao tinha os ultimos inputs do cliente: a
         * posicao viaja com um atraso de meio RTT. Sem o `ackSeq`, o
         * cliente nao tem como saber QUANTO dessa posicao e uma
         * resposta a ele e quanto e so a viagem, e qualquer correcao
         * que ele faca vira um rubber band — o boneco sendo puxado
         * para tras duas vezes por segundo.
         *
         * ## POR QUE SO O JOGADOR LOCAL PRECISA
         *
         * Os outros nao sao reconciliados: eles sao interpolados por
         * `WorldState.amostrar`, que so depende de dois pacotes e nao
         * de um_ack_. Mandar o campo para todo mundo custaria banda
         * a 20Hz para ninguem. Por isso ele vale zero para os remotos,
         * e o cliente so le o campo do `eu`.
         *
         * A comparacao e pelo id do jogador, e nao pelo objeto da
         * sessao: `world.players` guarda a mesma sessao que
         * `client.session`, mas isso e detalhe de implementacao. O id
         * do jogador e a identidade que os dois lados concordam.
         */
        ackSeq:
          p.id === client?.session?.player?.id
            ? sessao.intent?.seq ?? 0
            : 0,
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

        /**
         * A PICARETA, ou seja: o jogador esta em cima da pedra.
         *
         * E o mesmo booleano que o offline escreve no `atualizaMineracaoVisual`,
         * e ele vem pelo MESMO motivo do `selectedTargetId`: a decisao e do
         * servidor, e o cliente nao tem como deduzi-la
         *
         * ## POR QUE O `p.isMining` NAO CHEGA SO
         *
         * Porque no modo rede o cliente NAO roda a `runMineracao`: o `update`
         * dele volta antes, no ramo de rede. Sem este campo no pacote, o
         * `isMining` do cliente ficaria `false` para sempre e o arqueiro
         * socaria o ar â€” com a animacao nova instalada e nunca aparecendo
         *
         * E por que `p.isMining` e nao `sessao.mineracao?.encostado`: o
         * primeiro ja e a resposta da MESMA conta que o painel usa, calculada
         * no tique, sem refazer a distancia aqui
         */
        mining: p.isMining === true,

        /**
         * A TAG DA GUILDA deste jogador, ou `null`.
         *
         * ## POR QUE SO QUANDO ELE LIGOU
         *
         * Porque a opcao e sobre o boneco de quem liga. Sem este filtro, um
         * membro que desligou a tag teria o nome da guilda desenhado em
         * cima do boneco dele na tela de todo mundo â€” e ele nao teria como
         * tirar, porque a opcao dele e justamente "nao quero isso"
         *
         * E por isso que e `null` e nao `tag: ""`: o cliente usa o `null`
         * para saber que NAO ha tag, e um texto vazio faria ele desenhar
         * "[]" no lugar
         *
         * ## E POR QUE SO A TAG, E NAO A GUILDA INTEIRA
         *
         * Porque este pacote vai a 20Hz para todo mundo que esta perto, e a
         * guilda inteira â€” membros, talentos, cofre â€” multiplicaria a banda
         * por um dado que o painel ja traz, a 4Hz, so para quem tem guilda.
         * Aqui vai o minimo que o desenho precisa: a sigla e a cor
         */
        ...this.tagDaGuildaDe(sessao),
      });
    }

    return lista;
  }

  /**
   * A TAG e a COR da guilda de uma sessao, para o desenho no canvas.
   *
   * ## POR QUE UM METODO E NAO SO UM `?` NO OBJETO
   *
   * Porque a leitura e em tres passos â€” achar a guilda pelo jogador, achar o
   * membro, conferir a opcao â€” e isso em forma de ternario dentro de um
   * literal de objeto vira um bloco de seis linhas entre `acting` e `hasTarget`,
   * no meio dos campos que descrevem o sprite. Aqui a chamada cabe numa linha
   *
   * ## E POR QUE A COR SAI COMO HEX JA VALIDADO
   *
   * Porque e um `fillStyle` do canvas. A cor vem do catalogo do servidor, e
   * nao do cliente nem do arquivo: um arquivo de guildas editado a mao com
   * uma cor fora da lista foi descartado no `fromSave`, entao o que chega
   * aqui ja e um dos onze
   */
  tagDaGuildaDe(sessao) {
    const chave = chaveDaSessao(sessao);

    const guildaId = this.guild?.guildaDoJogador?.(chave)?.id;

    if (!guildaId) return { guilda: null };

    const guilda = this.guild.guilds.get(guildaId);

    const membro = guilda?.membros?.get(chave);

    if (!membro || membro.mostrarTag !== true) {
      return { guilda: null };
    }

    return {
      guilda: {
        tag: guilda.tag,
        cor: corDaGuilda(guilda.cor),
      },
    };
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
      /**
       * O CHEFE DE OUTRO JOGADOR NAO ENTRA NO SEU PACOTE.
       *
       * A arena cria um Hulk por sessao, e cada um e um objeto separado com
       * a vida dele. Sem este filtro, o jogador receberia a barra do chefe
       * do outro — e, pior, o `id` do chefe alheio no mesmo pacote
       *
       * E o filtro e por DONO, e nao por mapa: todo mundo na arena ve a
       * arena, mas so ve o proprio chefe
       *
       * O `!== undefined` e o que mantem o resto do jogo intacto: um mob
       * comum nao tem `sessaoDe`, e ele passa
       */
      if (inimigo.sessaoDe !== undefined && inimigo.sessaoDe !== client?.session?.id) {
        continue;
      }

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

        /**
         * QUANTO RESTA DO CADAVER, em segundos.
         *
         * O cliente tem o mesmo goblin, com a mesma arte e o mesmo
         * relogio de morte â€” mas o `killEnemy` que liga esse relogio
         * roda AQUI, no motor do servidor. Sem este campo, o cliente
         * recebia `state: "dead"` e marcava `alive = false`, com o
         * `deathTimer` ainda em `null` que significa "esta criatura nao
         * tem arte de morte" â€” e o cadaver nunca era desenhado
         *
         * E o servidor quem manda, e nao o cliente, por dois motivos:
         *
         * - o relogio do servidor e o unico que contou. Mandar o valor
         *   absolute faria o cadaver pular entre 0.9 e 0.85 conforme o
         *   pacote chegava, e ele tremeria
         * - o resto do relogio depende da arte, que mora no cliente. O
         *   `duration` e o `fade` sao lidos do layout la; aqui so
         *   interessa quanto resta do total
         *
         * `null` quando o bicho morre sem arte de morte: o goblin da
         * pedreira e do campo de provas mandam numero, o esqueleto e o
         * slime mandam `null` e continuam sumindo na hora
         */
        restamMorte: (inimigo.deathTimer ?? null),

        /**
         * O TELEGRAPH, quando o chefe esta preparando um golpe.
         *
         * ## POR QUE VIAJA DENTRO DO INIMIGO, E NAO COMO UM PACOTE SEPARADO
         *
         * Porque o `estadoInimigos` ja e filtrado por distancia ao cliente e
         * ja viaja a 10Hz. Um pacote novo exigiria um envio por execucao, o
         * que seria rapido demais: uma investida de 0.8s receberia tres
         * pacotes identicos, e um telegraph de 3s receberia um so â€” o mesmo
         * ataque com pesos diferentes na rede
         *
         * Aqui o telegraph entra junto do chefe que o produziu, e o filtro de
         * distancia e o mesmo. Quem esta longe do chefe nao recebe, e quem
         * esta longe do jogador nao precisava mesmo
         *
         * ## E O QUE O CLIENTE RECEBE
         *
         * O `impactoEm` e um instante do `world.time` do SERVIDOR, e nao um
         * "faltam N segundos". E o que faz dois jogadores com relogios
         * diferentes verem o golpe no mesmo quadro: os dois recalculam o
         * progresso a partir do mesmo numero, e nao do instante em que o
         * pacote chegou
         *
         * Quem calcula o dano e o servidor â€” o cliente recebe a geometria
         * para DESENHAR, e nao para decidir quem levou o golpe
         */
        telegraph: this.telegraphDe(
          inimigo.id,
          this.engine.world.telegraphs,
          this.engine.world.time,
        ),
      });
    }

    return lista;
  }


/**
   * O TELEGRAPH DE UM INIMIGO, pronto para o pacote.
   *
   * ## POR QUE SO O MAIS RECENTE
   *
   * Porque uma criatura so pode ter UM telegraph correndo por vez: a trava
   * `telegraphAtivo` na `EnemyAI` impede duas preparacoes simultaneas, e o
   * pedido diz que a IA nao deve escolher nova habilidade durante uma acao
   * incompativel. Mandar uma lista seria supor um estado que o motor nao
   * permite
   *
   * ## E OS CAMPOS QUE NAO VIAJAM
   *
   * `danoAplicado` e `tipoHabilidade` ficam de fora. O primeiro e estado
   * interno do servidor — o cliente nunca decide se o dano saiu. O segundo e
   * o objeto do catalogo inteiro, que o cliente nao precisa: ele so precisa
   * do `tipo` (string) e das medidas ja resolvidas na execucao
   *
   * ## E O ARREDONDAMENTO
   *
   * As posicoes sao arredondadas como as do inimigo. O telegraph e uma AREA,
   * e um pixel de erro em uma borda de 260px de raio nao muda o resultado
   * para ninguem — mas reduz o pacote
   */
  /**
   * O TELEGRAPH DE UM INIMIGO, pronto para o pacote.
   *
   * @param tempoDoServidor
   *   o `world.time` do SERVIDOR agora. Vai no pacote para o cliente alinhar
   *   o relogio dele com o do servidor — ver o comentario do `servidorEm`
   */
  telegraphDe(inimigoId, telegraphs, tempoDoServidor) {
    if (!telegraphs?.length) return null;

    for (const execucao of telegraphs) {
      if (execucao.inimigoId !== inimigoId) continue;

      const base = {
        id: execucao.id,
        habilidadeId: execucao.habilidadeId,
        tipo: execucao.tipo,
        cor: execucao.cor,

        // os instantes, que sao a verdade da sincronia
        inicioEm: execucao.inicioEm,
        impactoEm: execucao.impactoEm,
        duracao: execucao.duracao,

        /**
         * O RELOGIO DO SERVIDOR no instante em que este pacote saiu.
         *
         * E o que permite ao cliente alinhar os dois relogios. Sem ele, o
         * cliente tenta comparar `impactoEm` (que e um numero do
         * `world.time` do servidor) com o `spriteTime` dele, que e uma
         * escala completamente diferente: o servidor pode estar em 340 e o
         * cliente em 12, e o `progresso` do telegraph daria um numero
         * negativo cortado em zero
         *
         * Com este campo o cliente calcula o desloca uma vez, no pacote, e
         * passa a ler o tempo do servidor com o relogio dele. E o que faz a
         * barra ENCHER em vez de ficar parada
         */
        servidorEm: tempoDoServidor,

        // a posicao congelada, e nao a do chefe agora: o cliente desenha o
        // que o SERVIDOR decidiu, e nao onde o chefe veio a estar
        x: Math.round(execucao.x),
        y: Math.round(execucao.y),

        dirX: execucao.dirX,
        dirY: execucao.dirY,
      };

      // as medidas, so as que o tipo usa
      if (execucao.raio !== undefined) {
        base.raio = Math.round(execucao.raio);
      }

      if (execucao.raioInterno !== undefined) {
        base.raioInterno = Math.round(execucao.raioInterno);
        base.raioExterno = Math.round(execucao.raioExterno);
      }

      if (execucao.alcance !== undefined) {
        base.alcance = Math.round(execucao.alcance);
      }

      if (execucao.largura !== undefined) {
        base.largura = Math.round(execucao.largura);
      }

      if (execucao.anguloGraus !== undefined) {
        base.anguloGraus = execucao.anguloGraus;
      }

      return base;
    }

    return null;
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
   * por tick descartados â€” e o `JSON.stringify` logo abaixo transformava
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

    this.guardarDiamantesNaConta(sessao);

    try {
      return this.saves.salvar(
        sessao.name,
        snapshotSession(sessao),
      );
    } catch {
      return false;
    }
  }

  /**
   * O SALDO DE DIAMANTES SOBE PARA A CONTA.
   *
   * ## O INVENTARIO E UM ESPELHO, E A CONTA E O DONO
   *
   * O diamante e um saldo so, da conta. O `inventory.diamonds` do personagem
   * existe porque a HUD e o mercado leem dele, entao ele precisa mostrar o
   * numero certo — mas quem GUARDA o numero e a conta
   *
   * Esta e a hora de copiar de volta: o jogador pode ter gasto diamante no
   * passe (`GameEngine`) ou recebido de uma venda no mercado, e as duas
   * mexeram no inventario. Sem esta linha o saldo da conta ficaria parado
   * enquanto o personagem gastava, e a proxima entrada dele recarregaria um
   * valor velho
   *
   * ## POR QUE AQUI, E NO PONTO DE CADA GASTO
   *
   * Porque `guardar` e o gargao unico do personagem. Gastos acontecem em
   * varios lugares — o motor, o mercado, uma futura recompensa de missao — e
   * cada um deles ia precisar lembrar de chamar isto. Aqui nao tem como
   * esquecer: quem grava o personagem grava a conta junto
   *
   * ## E QUANDO A CONTA NAO EXISTE
   *
   * No single player nao ha `contas`, e o saldo volta a ser o do personagem.
   * E o que mantem o jogo funcionando sem servidor de conta
   *
   * ## E O QUE ACONTECE COM DOIS PERSONAGENS DA MESMA CONTA ONLINE
   *
   * Cada sessao tem o seu `inventory.diamonds`, entao quem grava por ultimo
   * define o saldo. Com uma sessao por conta — o caso normal — nao ha
   * conflito. E um limite conhecido, e nao um bug escondido: sincronizar os
   * dois ao vivo seria levar o saldo para o outro jogador na hora, e isso e
   * outro trabalho
   */
  guardarDiamantesNaConta(sessao) {
    if (!this.contas || !sessao?.contaId || !sessao.inventory) return false;

    const saldo = sessao.inventory.diamonds ?? 0;

    const atual = this.contas.diamantes(sessao.contaId);

    if (atual === saldo) return false;

    this.contas.movimentarDiamantes(sessao.contaId, saldo - atual);

    return true;
  }

  /**
   * PUXA O SALDO DA CONTA PARA O INVENTARIO DO PERSONAGEM.
   *
   * O caminho inverso do `guardarDiamantesNaConta`, e roda uma vez, na
   * entrada. E o que faz os tres personagens da conta abrirem o jogo vendo o
   * MESMO numero: o save do personagem ainda traz o `diamonds` que ele tinha
   * da ultima vez, e esse valor e sobrescrito aqui
   *
   * Sem esta linha o personagem mostraria o saldo antigo dele, e ele
   * poderia gastar um diamante que ja foi gasto por outro da conta
   */
  carregarDiamantesDaConta(sessao) {
    if (!this.contas || !sessao?.contaId || !sessao.inventory) return false;

    sessao.inventory.diamonds = this.contas.diamantes(sessao.contaId);

    return true;
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
   * `montarRank` ler `player.level` de `undefined` â€” todo offline
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
   * `"?"` â€” porque o `removePlayer` da primeira passada ja tinha
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
     * valendo como se o jogador tivesse saÃ­do
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
        // excecao isoladas â€” uma as 3h da manha, outra no meio de uma
        // batalha, outra um dia depois â€” paravam o laco para sempre sem
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
   * truque esta no `n` â€” e o que decide se divide pelo numero de tiques
   * REALMENTE medidos, e nao por 200
   *
   * E `null` enquanto a janela nao enchou, e nao 0. Uma janela com dois
   * tiques medidos nao e "media zero", e e "ainda nao da para saber" â€”
   * e a tela usa esse `null` para mostrar "â€”" em vez de um numero que
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
       * O MESMO NUMERO, SÃ“ NOS ULTIMOS 10 SEGUNDOS.
       *
       * A `duracaoMediaMs` e a media da vida inteira, e ela nao serve
       * para VERIFICAR mudanca: um servidor que passou horas lento
       * continua reportando media alta depois da otimizacao, e da a
       * impressao de que nada mudou
       *
       * Antes da janela encher, `janelaTickCheia` e false e o numero sai
       * como `null` â€” dividir os zeros iniciais por uma contagem errada
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
 * E a `donoKey` â€” o nome normalizado â€” e nao o `id` da sessao, que e
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











































































