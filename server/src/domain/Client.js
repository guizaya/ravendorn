import {
  RateLimiter,
  SERVER_EVENTS,
  createEvent,
} from "../../../src/shared/protocol.js";
import { SERVER_CONFIG } from "../config.js";

/**
 * Uma conexao virada em sessao de jogador.
 *
 * Guarda o que o SERVIDOR precisa saber: o socket, a sessao no
 * mundo, e o quanto essa pessoa falou agora (para o rate limit).
 * Nao guarda nada de confiavel vindo do cliente alem da intencao
 * ja validada.
 */
export class Client {
  constructor(socket) {
    this.socket = socket;
    this.session = null;
    this.joined = false;

    this.limiter = new RateLimiter(
      SERVER_CONFIG.maxMessagesPerSecond,
    );

    this.actionLimiter = new RateLimiter(
      SERVER_CONFIG.maxActionsPerSecond,
    );
  }

  get id() {
    return this.session?.id ?? null;
  }

  enviar(tipo, payload = {}) {
    // depois do close, o socket pode estar fechando e escrever
    // nele levanta excecao DENTRO do tick, derrubando o mundo
    // para todos os outros jogadores
    if (this.socket.readyState !== 1) return;

    try {
      this.socket.send(
        JSON.stringify(createEvent(tipo, payload)),
      );
    } catch {
      // o socket morreu no meio do envio. o evento `close` cuida
      // de tirar a sessao do mundo
    }
  }

  /** So para o proprio jogador saber qual ele e. */
  enviarParaSi(tipo, payload) {
    this.enviar(tipo, payload);
  }

  ultimoErro(reason, detail = null) {
    this.enviar(SERVER_EVENTS.REJECTED, { reason, detail });
  }
}
