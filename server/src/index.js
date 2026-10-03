import { createServer } from "node:http";
import express from "express";
import { WebSocketServer } from "ws";
import { GameServer } from "./domain/GameServer.js";
import { Client } from "./domain/Client.js";
import {
  PASTA_PADRAO,
} from "./persistence/CharacterStore.js";
import { SERVER_CONFIG } from "./config.js";
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
});

/**
 * O tamanho maximo de uma mensagem.
 *
 * Sem isso, um cliente so mandando `INPUT` de 50 MB faria o
 * servidor guardar tudo em memoria antes de notar que o JSON nao
 * presta. 8 KB e folgado para o maior comando valido.
 */
const LIMITE_MENSAGEM = 8 * 1024;

wss.on("connection", (socket) => {
  const client = new Client(socket);

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
    jogo.desconectar(client);
  });

  socket.on("error", () => {
    jogo.desconectar(client);
  });
});

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
