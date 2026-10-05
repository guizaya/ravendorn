import { describe, expect, it, beforeEach } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  PROTOCOL_VERSION,
} from "../../src/shared/protocol.js";

/**
 * PASSAR A LIDERANCA DA PARTY.
 *
 * ## AS REGRAS
 *
 * - so o LIDER atual passa
 * - so para quem esta NA party
 * - o grupo continua o mesmo: passar o comando nao passa o lugar
 * - quem sai da party nao leva o `focarLider` nem o `seguindoId`
 *
 * ## POR QUE UM SERVIDOR DE VERDADE
 *
 * A regra mora no `switch` do `GameServer.receber`, e nao no store. Um
 * teste que so chamasse `store` passaria com o servidor aceitando
 * qualquer um, que e o que o botão na tela realmente chama
 */
const ANA = "p_Ana";
const BENTO = "p_Bento";
const CORA = "p_Cora";

/**
 * `nomes` sao os IDS DE SESSAO, e nao os nomes.
 *
 * A primeira versao prefixava `p_` de novo e criava `p_p_Ana`. O
 * `aplicarPainel` devolvia cedo por `sessao` nulo, e o teste media um
 * servidor que ignorava o pedido — que e o mesmo sintoma de uma regra
 * que nao existe
 */
function jogoCom(ids) {
  const jogo = new GameServer({
    config: { ...SERVER_CONFIG, persistencia: false },
    mapId: "map_1",
  });

  const engine = jogo.engine;

  engine.world.enemies.length = 0;

  const party = {
    id: "party_1",
    lider: ANA,
    membros: new Set(ids),
  };

  jogo.parties.parties.set(party.id, party);

  for (const id of ids) {
    const nome = id.replace("p_", "");

    engine.addPlayer(
      {
        id,
        name: nome,
        player: {
          id,
          name: nome,
          x: 100,
          y: 100,
          hp: 100,
          maxHp: 100,
          level: 1,
          definition: { id: "warrior" },
          cooldowns: {},
        },
        isPlayer: true,
      },
      { mapId: "map_1" },
    );

    jogo.parties.partyPorSessao.set(id, party.id);
  }

  return { jogo, party };
}

/**
 * Manda um pedido de painel como se viesse do socket.
 *
 * O comando e `{ type: CLIENT_COMMANDS.PANEL, payload }`, e nao um
 * objeto solto: e o `parseCommand` que le o `type` e chama o
 * `aplicarPainel`. Um `{ type: "PEDIDO" }` seria descartado como
 * comando desconhecido, e o teste passaria sem exercitar nada
 */
function pedir(jogo, de, op, payload = {}) {
  const client = {
    id: de,
    joined: true,
    session: jogo.engine.world.players.get(de),
    enviar() {},
    ultimoErro() {},
    limiter: { permite: () => true },
  };

  jogo.receber(
    client,
    JSON.stringify({
      protocolVersion: PROTOCOL_VERSION,
      type: CLIENT_COMMANDS.PANEL,
      payload: { op, ...payload },
    }),
  );
}

describe("passar a lideranca da party", () => {
  let jogo;
  let party;

  beforeEach(() => {
    /**
     * SEM `start()` DE PROPOSITO.
     *
     * O `start` liga o `setInterval` do tick, e o tick passa por
     * `world.quests.objective`. As sessoes deste arquivo sao de mentira e
     * nao tem missao: o tick estouraria a cada 50ms e o teste mediria
     * o erro do tick em vez da regra da lideranca
     *
     * O que este arquivo mede e o `switch` do `receber`, que e o que o
     * botao na tela chama
     */
    ({ jogo, party } = jogoCom([ANA, BENTO, CORA]));
  });

  it("o lider passa para um membro e o grupo continua o mesmo", () => {
    pedir(jogo, ANA, "PARTY_TRANSFER", { alvoId: BENTO });

    expect(party.lider).toBe(BENTO);

    // os tres continuam na party
    expect(party.membros.has(ANA)).toBe(true);
    expect(party.membros.has(BENTO)).toBe(true);
    expect(party.membros.has(CORA)).toBe(true);
  });

  it("ninguem mais no comando: o lider novo tambem nao pode repassar", () => {
    pedir(jogo, ANA, "PARTY_TRANSFER", { alvoId: BENTO });

    // o Bento agora e o lider e ja pode passar
    pedir(jogo, BENTO, "PARTY_TRANSFER", { alvoId: CORA });

    expect(party.lider).toBe(CORA);

    // a Ana ja nao manda em ninguem
    pedir(jogo, ANA, "PARTY_TRANSFER", { alvoId: BENTO });

    expect(party.lider).toBe(CORA);
  });

  it("quem nao e o lider NAO passa a lideranca", () => {
    pedir(jogo, BENTO, "PARTY_TRANSFER", { alvoId: CORA });

    expect(party.lider).toBe(ANA);
  });

  it("nao passa para quem esta fora da party", () => {
    const fora = jogo.engine.addPlayer(
      {
        id: "p_Fora",
        name: "Fora",
        player: {
          id: "p_Fora",
          name: "Fora",
          x: 0,
          y: 0,
          hp: 100,
          maxHp: 100,
          level: 1,
          definition: { id: "warrior" },
          cooldowns: {},
        },
        isPlayer: true,
      },
      { mapId: "map_1" },
    );

    pedir(jogo, ANA, "PARTY_TRANSFER", { alvoId: "p_Fora" });

    expect(party.lider).toBe(ANA);
    expect(fora.id).toBe("p_Fora");
  });

  it("nao passa para si mesmo", () => {
    pedir(jogo, ANA, "PARTY_TRANSFER", { alvoId: ANA });

    expect(party.lider).toBe(ANA);
  });

  it("quem nao esta em party nao passa lideranca", () => {
    jogo.engine.addPlayer(
      {
        id: "p_sozinho",
        name: "Sozinho",
        player: {
          id: "p_sozinho",
          name: "Sozinho",
          x: 0,
          y: 0,
          hp: 100,
          maxHp: 100,
          level: 1,
          definition: { id: "warrior" },
          cooldowns: {},
        },
        isPlayer: true,
      },
      { mapId: "map_1" },
    );

    pedir(jogo, "p_sozinho", "PARTY_TRANSFER", { alvoId: BENTO });
  });

  it("o snapshot mostra o lider novo para o grupo inteiro", () => {
    pedir(jogo, ANA, "PARTY_TRANSFER", { alvoId: BENTO });

    const doAna = jogo.parties.snapshot(ANA, jogo.engine.world);
    const doBento = jogo.parties.snapshot(BENTO, jogo.engine.world);

    // o marcador de lider na tela tem que mudar para os dois
    expect(doAna.lider).toBe(BENTO);
    expect(doBento.lider).toBe(BENTO);
  });

  it("o foco do lider tambem troca de dono com a lideranca", () => {
    pedir(jogo, BENTO, "PARTY_FOCUS", { ativo: true });

    expect(
      jogo.engine.world.players.get(BENTO).focarLider,
    ).toBe(true);

    pedir(jogo, ANA, "PARTY_TRANSFER", { alvoId: BENTO });

    // o Ana nao e mais o lider: o foco dele nao vale para ninguem
    jogo.engine.withPlayer(ANA, () => {
      expect(jogo.engine.focoDoLiderAtivo()).toBe(false);
    });

    jogo.engine.withPlayer(BENTO, () => {
      expect(jogo.engine.focoDoLiderAtivo()).toBe(false);
    });
  });

  it("sair da party leva o foco e o acompanhamento junto", () => {
    pedir(jogo, BENTO, "PARTY_FOCUS", { ativo: true });

    const sessao = jogo.engine.world.players.get(BENTO);

    /**
     * O `seguindoId` e escrito direto, e nao pelo `seguirJogador`.
     *
     * O metodo do motor liga o Auto, e o Auto encosta em
     * `world.quests` — que estas sessoes de mentira nao tem. O que este
     * teste mede e a LIMPEZA do servidor na saida, e nao o caminho do
     * motor que liga o acompanhamento
     */
    sessao.seguindoId = ANA;

    expect(sessao.focarLider).toBe(true);
    expect(sessao.seguindoId).toBe(ANA);

    pedir(jogo, BENTO, "PARTY_LEAVE");

    // sem isto, a sessao guardaria as duas coisas e voltaria a cacar e
    // a andar atras de alguem na proxima party
    expect(sessao.focarLider).toBe(false);
    expect(sessao.seguindoId).toBeNull();
  });

  it("o LIDER VE que o membro ligou o foco", () => {
    pedir(jogo, BENTO, "PARTY_FOCUS", { ativo: true });

    /**
     * O `focandoLider` vem POR MEMBRO no snapshot.
     *
     * Sem ele, o interruptor do membro existia mas o estado nao aparecia
     * em lugar nenhum da tela do lider — e uma opcao que nao se ve e
     * uma opcao que o jogador acredita que nao foi implementada
     */
    const doAna = jogo.parties.snapshot(ANA, jogo.engine.world);

    const bento = doAna.membros.find((m) => m.id === BENTO);

    expect(bento.focandoLider).toBe(true);

    // e o proprio membro ve o mesmo estado no botao
    const doBento = jogo.parties.snapshot(BENTO, jogo.engine.world);

    expect(doBento.focarLider).toBe(true);
  });

  it("quem desliga o foco some da etiqueta do lider", () => {
    pedir(jogo, BENTO, "PARTY_FOCUS", { ativo: true });
    pedir(jogo, BENTO, "PARTY_FOCUS", { ativo: false });

    const doAna = jogo.parties.snapshot(ANA, jogo.engine.world);

    const bento = doAna.membros.find((m) => m.id === BENTO);

    expect(bento.focandoLider).toBe(false);
  });

  it("o interruptor do foco liga e desliga pelo estado, nao invertendo", () => {
    pedir(jogo, BENTO, "PARTY_FOCUS", { ativo: true });
    pedir(jogo, BENTO, "PARTY_FOCUS", { ativo: true });

    // dois "ligar" seguidos nao podem alternar
    expect(jogo.engine.world.players.get(BENTO).focarLider).toBe(true);

    pedir(jogo, BENTO, "PARTY_FOCUS", { ativo: false });

    expect(jogo.engine.world.players.get(BENTO).focarLider).toBe(false);
  });

  it("o foco nao liga sem party", () => {
    jogo.engine.addPlayer(
      {
        id: "p_sozinho2",
        name: "Sozinho2",
        player: {
          id: "p_sozinho2",
          name: "Sozinho2",
          x: 0,
          y: 0,
          hp: 100,
          maxHp: 100,
          level: 1,
          definition: { id: "warrior" },
          cooldowns: {},
        },
        isPlayer: true,
      },
      { mapId: "map_1" },
    );

    pedir(jogo, "p_sozinho2", "PARTY_FOCUS", { ativo: true });

    expect(
      jogo.engine.world.players.get("p_sozinho2").focarLider,
    ).toBeFalsy();
  });
});