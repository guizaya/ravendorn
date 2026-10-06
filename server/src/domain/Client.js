import {
  RateLimiter,
  SERVER_EVENTS,
  createEvent,
} from "../../../src/shared/protocol.js";
import { SERVER_CONFIG } from "../config.js";

/**
 * QUANTOS BYTES PODEM FICAR NA FILA ANTES DE DESCARTAR PAINEL.
 *
 * 1MB cabe uns seis paineis de 154KB. Abaixo disso o jogador lento
 * recebe tudo em ordem; acima disso, e melhor perder um painel
 * velho — que o proximo substitui inteiro — do que crescer sem teto
 */
const LIMITE_FILA = 1024 * 1024;

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

    /**
     * Quantos paineis foram jogados fora por socket lento.
     *
     * Fica no cliente para o `/health` mostrar. Um numero que sobe e
     * sinal de banda, e era invisivel antes: o servidor parecia lento
     * sem nenhum sintoma
     */
    this.paineisDescartados = 0;
  }

  get id() {
    return this.session?.id ?? null;
  }

  enviar(tipo, payload = {}) {
    // depois do close, o socket pode estar fechando e escrever
    // nele levanta excecao DENTRO do tick, derrubando o mundo
    // para todos os outros jogadores
    if (this.socket.readyState !== 1) return;

    /**
     * O PAINEL DESCARTADO QUANDO O JOGADOR NAO CONSEGUE ACOMODAR.
     *
     * `bufferedAmount` e o quanto do processo ainda nao saiu para o
     * socket. Sem ninguem lendo, ele sobe — e o `PLAYER_STATE` tem
     * 154KB, entao um jogador lento acumulava ~616KB/s dentro do
     * processo do servidor, para sempre. Como o heartbeat derruba o
     * socket morto em 30s, isso aqui e a janela antes disso
     *
     * Descartar o painel antigo e o unico jeito de se recuperar: ele e
     * um estado COMPLETO, entao o proximo que chegar substitui o
     * anterior. O que nao pode ser descartado e acao — perder um
     * "equipou" deixa o servidor e a tela discordando
     *
     * O limite e 1MB, ou seja uns 6 paineis de fila. Abaixo disso o
     * jogador lento ainda recebe tudo, em ordem
     */
    if (tipo === SERVER_EVENTS.PLAYER_STATE) {
      if (this.socket.bufferedAmount > LIMITE_FILA) {
        this.paineisDescartados += 1;

        return;
      }
    }

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
