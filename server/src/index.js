import { createServer } from "node:http";
import express from "express";
import { WebSocketServer } from "ws";
import { GameServer } from "./domain/GameServer.js";
import { Client } from "./domain/Client.js";
import {
  PASTA_PADRAO,
} from "./persistence/CharacterStore.js";
import { SERVER_CONFIG } from "./config.js";
import {
  nameKey,
  validateName,
} from "../../src/data/characterName.js";
import {
  isReadableSave,
  saveClassOf,
} from "../../src/game/save/CharacterSave.js";
import { PROTOCOL_VERSION } from "../../src/shared/protocol.js";

const app = express();
const http = createServer(app);

app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "rpg-2d-prototype-server",
    players: jogo.jogadores,
    protocolVersion: PROTOCOL_VERSION,
    timestamp: new Date().toISOString(),
  });
});

/**
 * A SAUDE DE VERDADE.
 *
 * O `/health` de cima responde `ok` mesmo com o mundo congelado: ele
 * so diz que o processo existe. Esta rota diz se o laco estaandando.
 *
 * A distincao importa porque `errosDeTick` parava o `setInterval` sem
 * derrubar o processo, e o health continuava verde. Um monitor que
 * so olha o `/health` nunca veria o jogo parado
 */
app.get("/health/laco", (_request, response) => {
  const tique = jogo.saudeDoLaco();

  response.status(tique.rodando ? 200 : 503).json({
    rodando: tique.rodando,
    tickRate: SERVER_CONFIG.tickRate,
    ...tique,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/version", (_request, response) => {
  response.json({
    protocolVersion: PROTOCOL_VERSION,
  });
});

app.get("/api/capabilities", (_request, response) => {
  response.json({
    ...SERVER_CONFIG.capabilities,
    players: jogo.jogadores,
  });
});

/**
 * O QUE JA EXISTE COM ESSE NICKNAME.
 *
 * E a consulta que o botao JOGAR faz antes de abrir o socket, e o que
 * transforma a recusa em aviso imediato na tela de selecao.
 *
 * Sem ela, o jogador so descobre que o personagem esta logado ou que a
 * classe nao bate depois de entrar no mundo, quando a tela do mapa ja
 * abriu e o socket ja conectou — e o aviso chega tarde, sozinho, num
 * canto da tela de jogo
 *
 * O nome vai pela mesma chave que o save usa (`nameKey`), entao
 * "Teste", "teste " e "TESTE" sao o mesmo personagem aqui e no disco.
 * E a MESMA regra que `GameServer.entrar` aplica: este endpoint ANTECIPA
 * o que o servidor faria, e nao substitui o servidor — um cliente
 * adulterado continua sendo recusado no JOIN
 */
app.get("/api/personagem/:nome", (request, response) => {
  const nome = request.params.nome ?? "";

  const checagem = validateName(nome);

  // nome invalido nao e consulta: e erro de digitacao, e a tela de
  // selecao ja cuida disso antes de consultar
  if (!checagem.ok) {
    response.status(400).json({
      ok: false,
      erro: checagem.reason,
    });
    return;
  }

  const chave = nameKey(checagem.value);

  // O MESMO NICKNAME, OUTRA SESSAO CONECTADA
  //
  // `.keys()` e nao `.values()`: o `clients` e um Map cuja CHAVE e o
  // client e o valor e um `true` de ocupacao. Ler os valores daria uma
  // lista de booleanos, e `true.joined` e `undefined` — o que fazia
  // esta consulta responder "ninguem logado" mesmo com o personagem
  // conectado. E `entrar` usa `keys()`, que e a razao de o servidor
  // recusar e a tela liberar
  const logado = [...jogo.clients.keys()].some(
    (client) =>
      client.joined &&
      client.session &&
      nameKey(client.session.name) === chave,
  );

  // O PERSONAGEM JA SALVO, E EM QUE CLASSE
  let classeDoSave = null;

  if (!logado) {
    const salvo = jogo.saves?.carregar(checagem.value) ?? null;

    if (salvo && isReadableSave(salvo)) {
      classeDoSave = saveClassOf(salvo) ?? null;
    }
  }

  response.json({
    ok: true,
    logado,
    existe: Boolean(classeDoSave),
    classe: classeDoSave,
  });
});

app.use((_request, response) => {
  response.status(404).json({
    error: "Rota nao encontrada",
  });
});

/**
 * O jogo.
 *
 * A persistencia fica LIGADA de proposito: o personagem e o nome, e
 * fechar o navegador nao pode apagar o trabalho. `PASTA_DE_SAVES`
 * deixa a pasta de fora do projeto, e `SAVE_DIR` aponta para ela.
 */
const jogo = new GameServer({
  persistencia: {
    pasta: process.env.SAVE_DIR ?? PASTA_PADRAO,
  },
});

// o mesmo servidor HTTP responde o WebSocket. subir dois
// servidores em portas diferentes obriga o cliente a saber duas
// portas e cria um ponto de falha a mais
const wss = new WebSocketServer({
  server: http,
  path: "/ws",

  /**
   * `maxPayload` no `ws`, e nao so o limite manual do `message`.
   *
   * O `LIMITE_MENSAGEM` abaixo checa `bruto.length`, mas o `ws` JA
   * materializou o frame inteiro em memoria para chegar ate aqui. Um
   * cliente mandando 50MB de `INPUT` gastava os 50MB antes de levar
   * `close(1009)`. O limite no `ws` barra na hora da leitura
   */
  maxPayload: 8 * 1024,

  /**
   * COMPRESSÃO DO PAINEL.
   *
   * O `PLAYER_STATE` tem ~154KB, dos quais 112KB são o catálogo de
   * receitas — JSON altamente repetitivo, que é exatamente o caso que o
   * DEFLATE comprime para perto de 10%. O default do `ws@8` é
   * `false`, então antes disso o servidor mandava ~37MB/s só para
   * estado com 50 jogadores
   *
   * `concurrencyLimit` em 10 e o teto de negociacoes por socket: sem
   * ele, um pico de reconexao faz o servidor abrir dezenas de
   * negociacoes ao mesmo tempo para o mesmo socket, e cada uma
   * reserva memória para a janela do compressor
   */
  perMessageDeflate: {
    threshold: 1024,
    concurrencyLimit: 10,
  },
});

/**
 * O tamanho maximo de uma mensagem.
 *
 * Sem isso, um cliente so mandando `INPUT` de 50 MB faria o
 * servidor guardar tudo em memoria antes de notar que o JSON nao
 * presta. 8 KB e folgado para o maior comando valido.
 */
const LIMITE_MENSAGEM = 8 * 1024;

/**
 * QUEM ESTA VIVO.
 *
 * Sem isso um socket MORTO fica registrado para sempre. O caso comum
 * nao e o servidor derrubar o cliente: e o cabo puxado, o NAT com a
 * sessao expirada, ou a aba do navegador suspensa pelo SO. Nenhum dos
 * tres gera `close` — o socket fica "aberto" dos dois lados, o
 * `joined` continua `true`, e o tick segue montando um painel de 154KB
 * a 4Hz para um destinatario que nao le. Com `ws` isso vira buffer no
 * processo do servidor crescendo sem limite
 *
 * O `ping` do `ws` e a forma barata de descobrir: o kernel responde
 * `pong` sozinho, e quem nao responder em 30s esta morto
 *
 * O intervalo e de 30s porque e o piso do NAT UDP para considerar um
 * pacote descartado. Va abaixo disso, uma rede intermediaria com
 * timeout curto derruba jogador que estava de boa
 */
const BATIMENTO_MS = 30_000;

const vivos = new Set();

wss.on("connection", (socket) => {
  const client = new Client(socket);

  /**
   * O `isAlive` e o `pong` sao o heartbeat.
   *
   * O `ping` e enviado pelo SERVIDOR, e o cliente so precisa deixar o
   * `ws` responder, que ele faz sozinho — nenhum codigo no cliente
   */
  socket.isAlive = true;

  socket.on("pong", () => {
    socket.isAlive = true;
  });

  vivos.add(socket);

  jogo.conectar(client);

  socket.on("message", (bruto, isBinary) => {
    if (isBinary) return;

    // o `parseCommand` do protocolo ja recusa lixo e `NaN`, mas
    // so DEPOIS de o servidor ter lido a string inteira. o limite
    // e o que impede o estouro de memoria
    if (bruto.length > LIMITE_MENSAGEM) {
      socket.close(1009, "Mensagem grande demais");
      return;
    }

    /**
     * O LIMITER E COBRADO AQUI E NO `GameServer.receber` — o dobro.
     *
     * Cada `permite()` empurra um marco no array, entao as duas
     * chamadas contavam DOIS disparos por mensagem. O teto real
     * acabava sendo metade do configurado (45/s em vez de 90/s), o
     * que dava um Gravity Parkour de teste diferente do que o numero
     * dizia
     *
     * Aqui, e nao no `GameServer`: quem decide o que e Abuse e quem
     * segura o socket. O `GameServer` recebe a mensagem e confia
     */
    if (!client.limiter.permite()) {
      client.enviar("REJECTED", {
        reason: "Voce esta mandando comandos demais.",
      });
      return;
    }

    try {
      jogo.receber(client, bruto.toString());
    } catch (erro) {
      // uma regra com bug nao pode derrubar o mundo para os
      // outros jogadores. o jogador ruim perde a conexao
      console.error("[ws] erro ao tratar mensagem:", erro);
      socket.close(1011, "Erro interno");
    }
  });

  socket.on("close", () => {
    vivos.delete(socket);
    jogo.desconectar(client);
  });

  socket.on("error", () => {
    vivos.delete(socket);
    jogo.desconectar(client);
  });
});

const batimento = setInterval(() => {
  for (const socket of vivos) {
    /**
     * O tique anterior chegou e ele nao respondeu: o caminho died.
     *
     * `terminate()` e nao `close()` porque nao ha handshake a fazer
     * com quem nao esta mais la — e nao ha ninguem para ler os 30s de
     * painel que o `bufferedAmount` pode ter acumulado
     */
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }

    socket.isAlive = false;
    socket.ping();
  }
}, BATIMENTO_MS);

batimento.unref();

jogo.start();

http.listen(SERVER_CONFIG.port, SERVER_CONFIG.host, () => {
  console.log(
    `Jogo em http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port} ` +
      `(ws em /ws, ${SERVER_CONFIG.tickRate} ticks/s)`,
  );
});

/**
 * Encerrar o laco de 20 Hz no Ctrl+C.
 *
 * Sem isso o processo fica pendurado esperando o `setInterval`
 * morro, e o `npm run dev` nunca termina o comando.
 */
function encerrar() {
  jogo.stop();
  wss.close();
  http.close(() => process.exit(0));

  // se algum socket travado impedir o close, sai assim mesmo
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
