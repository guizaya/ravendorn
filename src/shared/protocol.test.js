import { describe, expect, it } from "vitest";
import {
  CLIENT_COMMANDS,
  MAX_MESSAGES_PER_SECOND,
  PLAYER_ACTIONS,
  PROTOCOL_VERSION,
  RateLimiter,
  REJECT,
  SERVER_EVENTS,
  createCommand,
  createEvent,
  parseCommand,
} from "./protocol.js";

const base = (tipo, payload) => ({
  protocolVersion: PROTOCOL_VERSION,
  type: tipo,
  payload,
  timestamp: Date.now(),
});

describe("envelope das mensagens", () => {
  it("o comando carrega a versao do protocolo", () => {
    expect(createCommand("X").protocolVersion).toBe(
      PROTOCOL_VERSION,
    );
  });

  it("o evento carrega a versao do protocolo", () => {
    expect(createEvent("Y").protocolVersion).toBe(
      PROTOCOL_VERSION,
    );
  });

  it("os dois lados tem os mesmos nomes de mensagem", () => {
    // se o cliente e o servidor tivessem listas diferentes, o
    // bug so apareceria em producao
    expect(CLIENT_COMMANDS.JOIN).toBe("JOIN");
    expect(SERVER_EVENTS.WELCOME).toBe("WELCOME");
  });
});

describe("JOIN", () => {
  it("aceita nome e classe", () => {
    const r = parseCommand(
      base(CLIENT_COMMANDS.JOIN, {
        name: "Ana",
        classId: "arbalist",
      }),
    );

    expect(r.ok).toBe(true);
    expect(r.payload).toEqual({
      name: "Ana",
      classId: "arbalist",
    });
  });

  it("recusa nome que nao e texto", () => {
    for (const nome of [null, 42, {}, [], ""]) {
      const r = parseCommand(
        base(CLIENT_COMMANDS.JOIN, {
          name: nome,
          classId: "arbalist",
        }),
      );

      expect(r.ok, String(nome)).toBe(false);
    }
  });

  it("recusa nome com caractere de controle", () => {
    // um \u0000 no nome forja linha de log no servidor
    const r = parseCommand(
      base(CLIENT_COMMANDS.JOIN, {
        name: "Ana\u0000injetado",
        classId: "arbalist",
      }),
    );

    expect(r.ok).toBe(false);
  });

  it("recusa nome gigante", () => {
    const r = parseCommand(
      base(CLIENT_COMMANDS.JOIN, {
        name: "x".repeat(5000),
        classId: "arbalist",
      }),
    );

    expect(r.ok).toBe(false);
  });
});

describe("INPUT", () => {
  const entrada = (payload) =>
    parseCommand(base(CLIENT_COMMANDS.INPUT, payload));

  it("aceita direcao normalizada", () => {
    const r = entrada({
      seq: 1,
      moveX: 1,
      moveY: 0,
      aimX: 0,
      aimY: 1,
    });

    expect(r.ok).toBe(true);
    expect(r.payload.moveX).toBe(1);
    expect(r.payload.aimY).toBe(1);
  });

  it("duas teclas nao andam mais rapido que uma", () => {
    // segurar duas direcoes e um movimento normalizado, nao o
    // dobro de velocidade
    const r = entrada({
      seq: 1,
      moveX: 1,
      moveY: 1,
      aimX: 0,
      aimY: 0,
    });

    const tamanho = Math.hypot(
      r.payload.moveX,
      r.payload.moveY,
    );

    expect(tamanho).toBeCloseTo(1, 5);
  });

  it("corta um vetor gigante em vez de aceitar", () => {
    // sem o corte, um cliente mandaria 9999 e atravessaria o
    // mapa em um frame
    const r = entrada({
      seq: 1,
      moveX: 9999,
      moveY: 0,
      aimX: 0,
      aimY: 0,
    });

    expect(r.payload.moveX).toBe(1);
  });

  it("recusa NaN e infinito", () => {
    // um NaN na direcao viraria posicao NaN no servidor e o
    // jogador sumiria do mapa para todo mundo
    for (const valor of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const r = entrada({
        seq: 1,
        moveX: valor,
        moveY: 0,
        aimX: 0,
        aimY: 0,
      });

      // o valor vira 0 em vez de NaN: segue jogavel
      expect(r.ok, String(valor)).toBe(true);
      expect(Number.isNaN(r.payload.moveX)).toBe(false);
    }
  });

  it("trata campo ausente como zero", () => {
    const r = entrada({ seq: 1 });

    expect(r.ok).toBe(true);
    expect(r.payload.moveX).toBe(0);
    expect(r.payload.aimX).toBe(0);
  });

  it("recusa sem numero de sequencia", () => {
    expect(entrada({ moveX: 1 }).ok).toBe(false);
    expect(entrada({ seq: "a", moveX: 1 }).ok).toBe(false);
  });
});

describe("ACTION", () => {
  const acao = (payload) =>
    parseCommand(base(CLIENT_COMMANDS.ACTION, payload));

  it("aceita as quatro acoes conhecidas", () => {
    for (const tipo of Object.values(PLAYER_ACTIONS)) {
      const r = acao({ action: tipo, targetId: "slime_0" });

      expect(r.ok, tipo).toBe(true);
    }
  });

  it("recusa acao desconhecida", () => {
    // "teleportar" ou "dar_golpe_infinito" nao podem passar
    const r = acao({ action: "TELEPORTAR" });

    expect(r.ok).toBe(false);
    expect(r.reason).toBe(REJECT.BAD_MESSAGE);
  });

  it("recusa alvo com formato invalido, mas nao derruba", () => {
    // o jogador pode ter clicado num mob que morreu no
    // instante do pacote: isso e normal e nao pode derrubar a
    // conexao
    for (const alvo of [42, {}, [], "x".repeat(500)]) {
      const r = acao({
        action: PLAYER_ACTIONS.BASIC_ATTACK,
        targetId: alvo,
      });

      expect(r.ok, String(alvo)).toBe(true);
      expect(r.payload.targetId).toBe(null);
    }
  });

  it("aceita acao sem alvo", () => {
    const r = acao({ action: PLAYER_ACTIONS.ULTIMATE });

    expect(r.ok).toBe(true);
    expect(r.payload.targetId).toBe(null);
  });
});

describe("rejeicoes gerais", () => {
  it("recusa lixo", () => {
    for (const entrada of [
      null,
      undefined,
      "texto",
      42,
      [],
    ]) {
      const r = parseCommand(entrada);

      expect(r.ok, String(entrada)).toBe(false);
      expect(r.reason).toBe(REJECT.BAD_MESSAGE);
    }
  });

  it("recusa versao diferente de protocolo", () => {
    // cliente de outra versao falaria em silencio sem isso
    const r = parseCommand({
      ...base(CLIENT_COMMANDS.PING, {}),
      protocolVersion: 99,
    });

    expect(r.ok).toBe(false);
    expect(r.reason).toBe(REJECT.BAD_VERSION);
  });

  it("recusa tipo desconhecido", () => {
    const r = parseCommand(base("DROPAR_ITEM", {}));

    expect(r.ok).toBe(false);
  });

  it("recusa payload que nao e objeto", () => {
    const r = parseCommand({
      ...base(CLIENT_COMMANDS.PING, {}),
      payload: "texto",
    });

    expect(r.ok).toBe(false);
  });
});

describe("RateLimiter", () => {
  it("deixa passar ate o teto", () => {
    const limiter = new RateLimiter(5);

    for (let i = 0; i < 5; i += 1) {
      expect(limiter.permite(), `msg ${i}`).toBe(true);
    }

    expect(limiter.permite()).toBe(false);
  });

  it("libera de novo depois da janela", async () => {
    const limiter = new RateLimiter(3, 20);

    for (let i = 0; i < 3; i += 1) limiter.permite();
    expect(limiter.permite()).toBe(false);

    await new Promise((resolve) =>
      setTimeout(resolve, 30),
    );

    expect(limiter.permite()).toBe(true);
  });

  it("nao deixa a lista crescer sem parar", async () => {
    // a janela deslizante e limpa a cada chamada: sem isso a
    // memoria do servidor cresceria com o tempo de conexao
    const limiter = new RateLimiter(5, 20);

    limiter.permite();
    await new Promise((resolve) =>
      setTimeout(resolve, 30),
    );
    limiter.permite();

    expect(limiter.marcos.length).toBeLessThanOrEqual(2);
  });

  it("o teto padrao existe e e razoavel", () => {
    expect(MAX_MESSAGES_PER_SECOND).toBeGreaterThan(30);
  });
});
