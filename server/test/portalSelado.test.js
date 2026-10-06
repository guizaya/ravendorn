import { describe, expect, it, beforeEach, vi } from "vitest";

import { GameServer } from "../src/domain/GameServer.js";
import { SERVER_CONFIG } from "../src/config.js";
import { MAP_2_PORTALS, PORTALS } from "../../src/data/portais/index.js";
import {
  getMainQuest,
  indiceDaUltimaMissao,
} from "../../src/data/quests/index.js";

/**
 * O SERVIDOR NEGA O PORTAL SELADO.
 *
 * A Floresta Sombria so abre com a campanha do mapa 1 acabada, e quem
 * precisa negar e o SERVIDOR: o cliente pede, o servidor decide. Um
 * motor que recusasse sozinho nao bastaria, porque em rede quem troca o
 * mapa e o `engine.travessarPortal` chamado pelo `GameServer`
 *
 * O teste injeta o portal em que o jogador esta, porque o motor so
 * acha portal por COORDENADA e o jogador de teste nasce em (0, 0).
 * Injetar o portal injato (peleo, destino) e nao mexer na posicao do
 * jogador: o que se quer provar aqui e a REGRA, e nao o raio do portal
 */
const [FLORESTA] = PORTALS.filter((p) => p.id === "portal_floresta");
const [VOLTA] = MAP_2_PORTALS;

const ULTIMA = indiceDaUltimaMissao("map_1");

function servidorNo(mapId) {
  return new GameServer({
    config: { ...SERVER_CONFIG, persistencia: false },
    mapId,
  });
}

/** uma sessao com nome, moedas e missoes de verdade */
function entra(jogo, nome) {
  const client = {
    nome,
    joined: false,
    session: null,
    limiter: { permite: () => true },
    actionLimiter: { permite: () => true },
    enviados: [],
    enviarParaSi() {},
    enviar() {},
    ultimoErro: () => null,
  };

  jogo.conectar(client);
  jogo.entrar(client, { name: nome, classId: "warrior" });

  return { client, sessao: client.session };
}

/** o motor passa a "enxergar" este portal sob os pes do jogador */
function emCimaDo(jogo, portal) {
  jogo.engine.portalSobOsPes = () => ({
    portal,
    nome: portal.destino,
    destino: { id: portal.destino, name: portal.destino },
  });
}

describe("o servidor nega o portal da Floresta Sombria", () => {
  let jogo;
  let sessao;
  let avisos;
  let trocou;

  beforeEach(() => {
    jogo = servidorNo("map_1");

    ({ sessao } = entra(jogo, "Ana"));

    avisos = [];
    trocou = false;

    const avisoOriginal = jogo.avisoDoDono.bind(jogo);

    jogo.avisoDoDono = (s, texto) => {
      avisos.push(texto);
      return avisoOriginal(s, texto);
    };

    /**
     * O `travessarPortal` do motor e quem REALMENTE troca o mapa. Trocar
     * o mapa aqui e o que prova que a recusa acontece ANTES dele: se a
     * conferida estivesse depois, `trocou` viraria `true` e o jogador
     * estaria no mapa 2 com um "nao deu" na tela
     */
    jogo.engine.travessarPortal = () => {
      trocou = true;
      return true;
    };

    emCimaDo(jogo, FLORESTA);
  });

  it("no meio da campanha, nao atravessa e avisa o que falta", () => {
    sessao.quests.mainIndex = 5;

    const ok = jogo.travessarPortal(FLORESTA.id, sessao);

    expect(ok).toBe(false);
    expect(trocou, "o mapa trocou mesmo com o portal selado").toBe(false);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain(getMainQuest(ULTIMA).name);
  });

  it("na ultima missao em andamento, ainda e recusado", () => {
    /**
     * `mainIndex` e o indice do degrau ATUAL. Estar no 11 e estar
     * NA ultima missao, ou seja, ela ainda nao acabou
     */
    sessao.quests.mainIndex = ULTIMA;

    expect(jogo.travessarPortal(FLORESTA.id, sessao)).toBe(false);
    expect(trocou).toBe(false);
    expect(avisos).toHaveLength(1);
  });

  it("terminada a campanha do mapa 1, atravessa em silencio", () => {
    sessao.quests.mainIndex = ULTIMA + 1;

    const ok = jogo.travessarPortal(FLORESTA.id, sessao);

    expect(ok).toBe(true);
    expect(trocou).toBe(true);
    expect(avisos, "um portal aberto nao pode mandar aviso").toHaveLength(0);
  });

  it("a recusa nao gasta nem devolve nada: e so uma recusa", () => {
    sessao.quests.mainIndex = 0;
    sessao.inventory.addCoins(500);

    jogo.travessarPortal(FLORESTA.id, sessao);

    expect(sessao.inventory.coins).toBe(500);
    expect(jogo.market.all()).toHaveLength(0);
  });

  it("a VOLTA do mapa 2 nunca e selada", () => {
    sessao.quests.mainIndex = 0;
    avisos.length = 0;

    emCimaDo(jogo, VOLTA);

    const ok = jogo.travessarPortal(VOLTA.id, sessao);

    expect(ok).toBe(true);
    expect(trocou).toBe(true);
    expect(avisos).toHaveLength(0);
  });

  it("a trava nao afrouxa a conferida de posicao", () => {
    sessao.quests.mainIndex = ULTIMA + 1;
    avisos.length = 0;

    // campanha pronta, mas o id pedido NAO e o portal em que esta
    const ok = jogo.travessarPortal("portal_que_nao_e_este", sessao);

    expect(ok).toBe(false);
    expect(trocou).toBe(false);
  });

  it("sem sessao, o pedido e recusado em vez de estourar", () => {
    sessao.quests.mainIndex = 0;

    expect(() => jogo.travessarPortal(FLORESTA.id, null)).not.toThrow();
    expect(trocou).toBe(false);
  });
});

describe("o motor e o servidor concordam", () => {
  /**
   * A REGRA TEM DOIS DONOS, e so um pode existir.
   *
   * O `GameEngine` publica `bloqueado` para a box e o `GameServer`
   * recusa a travessia. Se os dois discordarem em algum degrau, o
   * jogador ve um botao ativo que o servidor nega — ou o contrario, um
   * portal selado que ele atravessa
   *
   * Aqui os dois sao exercitados de verdade, no mesmo degrau: o motor
   * publica o que a box mostraria, e o servidor responde se deixa
   * atravessar. Se algum dia um deles montar o veredito por conta
   * propria, e este teste que avisa
   */
  it("em todos os degraus, o painel e a recusa dizem a mesma coisa", () => {
    const divergencias = [];

    for (let i = 0; i <= ULTIMA + 2; i++) {
      const jogo = servidorNo("map_1");
      const { sessao } = entra(jogo, "Ana");

      sessao.quests.mainIndex = i;
      sessao.inventory.addCoins(100);

      // o que o MOTOR publica para a box
      jogo.engine.portalSobOsPes = () => ({
        portal: FLORESTA,
        nome: FLORESTA.destino,
        destino: { id: FLORESTA.destino, name: FLORESTA.destino },
      });

      const painel = jogo.engine.dadosDoPortalNoPe();

      // o que o SERVIDOR decide.
      //
      // O `travessarPortal` do motor e trocado por um que apenas responde
      // "deixou": aqui o que se compara e o VEREDITO, e a troca de mapa
      // de verdade ja e provada no bloco de cima. Deixar o motor real
      // tentar montar o contexto do mundo estoura, e essa falha nao diz
      // nada sobre a regra
      jogo.engine.travessarPortal = () => true;

      jogo.avisoDoDono = () => {};

      const atravessou = jogo.travessarPortal(FLORESTA.id, sessao);

      if (painel.bloqueado === atravessou) {
        divergencias.push(
          `degrau ${i}: painel diz bloqueado=${painel.bloqueado}, ` +
          `servidor atravessou=${atravessou}`,
        );
      }
    }

    expect(divergencias, divergencias.join("\n")).toHaveLength(0);
  });

  it("o painel do portal selado traz o motivo escrito", () => {
    const jogo = servidorNo("map_1");
    const { sessao } = entra(jogo, "Ana");

    sessao.quests.mainIndex = 3;

    jogo.engine.portalSobOsPes = () => ({
      portal: FLORESTA,
      nome: FLORESTA.destino,
      destino: { id: FLORESTA.destino, name: FLORESTA.destino },
    });

    const painel = jogo.engine.dadosDoPortalNoPe();

    expect(painel.bloqueado).toBe(true);
    expect(painel.motivo).toContain(getMainQuest(ULTIMA).name);
    expect(painel.motivo).toContain("(4/12");
  });
});