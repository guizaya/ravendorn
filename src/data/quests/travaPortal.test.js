import { describe, expect, it } from "vitest";

import {
  ESCADA_MAPA_1,
  ESCADA_MAPA_2,
  MAIN_QUESTS,
  dadosDaTrava,
  getMainQuest,
  indiceDaUltimaMissao,
  mainQuestsDoMapa,
  portalLiberado,
} from "./index.js";
import {
  MAP_2_PORTALS,
  PORTALS,
} from "../portais/index.js";

/**
 * A TRAVA DO PORTAL DA FLORESTA SOMBRIA.
 *
 * A Floresta Sombria (mapa 2) so abre com a campanha do mapa 1
 * acabada. A regra esta em `portalLiberado`, e estes casos existem
 * porque ela tem tres inimigos silenciosos:
 *
 * 1. **o `>=` virando `>`.** Trocar `>` por `>=` abre o portal no
 *    minuto em que o jogador CHEGA na ultima missao, e nao no minuto em
 *    que ela TERMINA. E o tipo de erro que passa no teste de mao
 *    propria e quebra a campanha na Fifth Play
 * 2. **o indice escrito a mao.** Um `11` no meio do codigo vira errado
 *    no dia em que a escada ganhar um degrau, e o portal abre sozinho
 * 3. **o mapa sem missoes.** Um mapa novo, com zero degraus, viraria um
 *    portal fechado para sempre
 */

const FLORESTA = PORTALS.find((p) => p.id === "portal_floresta");
const VOLTA = MAP_2_PORTALS.find((p) => p.id === "portal_mapa2");

describe("qual e a ultima missao de um mapa", () => {
  it("o mapa 1 termina no ultimo degrau da escada dele", () => {
    expect(ESCADA_MAPA_1.length).toBe(12);
    expect(indiceDaUltimaMissao("map_1")).toBe(11);
    expect(getMainQuest(11).name).toBe("Floresta Sombria");
  });

  it("o mapa 2 comeca logo depois do mapa 1", () => {
    // a escada e UMA lista: o mapa 2 nao tem indice proprio
    expect(indiceDaUltimaMissao("map_2")).toBe(23);
    expect(MAIN_QUESTS.length).toBe(
      ESCADA_MAPA_1.length + ESCADA_MAPA_2.length,
    );
  });

  it("as missoes de um mapa sao exatamente as dele", () => {
    expect(mainQuestsDoMapa("map_1")).toHaveLength(ESCADA_MAPA_1.length);
    expect(mainQuestsDoMapa("map_2")).toHaveLength(ESCADA_MAPA_2.length);

    for (const quest of mainQuestsDoMapa("map_2")) {
      expect(quest.id.startsWith("map2_main_")).toBe(true);
    }
  });

  it("um mapa sem missoes devolve -1", () => {
    expect(indiceDaUltimaMissao("map_99")).toBe(-1);
  });
});

describe("o portal da Floresta Sombria", () => {
  const ULTIMA = indiceDaUltimaMissao("map_1");

  it("o portal declara a exigencia, e a volta nao", () => {
    expect(FLORESTA.destino).toBe("map_2");
    expect(FLORESTA.exigeMissaoDe).toBe("map_1");
    expect(VOLTA.exigeMissaoDe).toBe(undefined);
  });

  it("esta selado em TODO o caminho, do degrau zero ate o ultimo", () => {
    for (let i = 0; i <= ULTIMA; i++) {
      expect(
        portalLiberado("map_1", i).ok,
        `o portal abriu no degrau ${i} (${getMainQuest(i).name})`,
      ).toBe(false);
    }
  });

  /**
   * O CASO QUE MAIS IMPORTA.
   *
   * `mainIndex` e o indice do degrau ATUAL, e nao quantos foram feitos.
   * Estar no indice 11 significa estar NA ultima missao, ou seja, ela
   * ainda nao terminou. O portal abre no 12
   */
  it("terminar a ultima missao e o degrau DEPOIS dela", () => {
    expect(portalLiberado("map_1", ULTIMA).ok).toBe(false);
    expect(portalLiberado("map_1", ULTIMA + 1).ok).toBe(true);
  });

  it("depois disso, nunca mais fecha", () => {
    for (let i = ULTIMA + 1; i < MAIN_QUESTS.length; i++) {
      expect(portalLiberado("map_1", i).ok).toBe(true);
    }
  });

  it("o motivo diz qual missao falta", () => {
    const { ok, motivo, questId } = portalLiberado("map_1", 5);

    expect(ok).toBe(false);
    expect(questId).toBe(getMainQuest(11).id);
    expect(motivo).toContain(getMainQuest(11).name);
  });

  it("o motivo mostra o quanto da campanha falta", () => {
    expect(portalLiberado("map_1", 0).motivo).toContain("(1/12");
    expect(portalLiberado("map_1", 5).motivo).toContain("(6/12");
    expect(portalLiberado("map_1", 11).motivo).toContain("(12/12");
  });

  it("a volta e sempre livre, com a campanha no zero", () => {
    expect(portalLiberado(undefined, 0).ok).toBe(true);
    expect(portalLiberado(VOLTA.exigeMissaoDe, 0).ok).toBe(true);
  });

  it("um mapa sem missoes nao trava ninguem", () => {
    expect(portalLiberado("map_99", 0).ok).toBe(true);
  });
});

describe("o formato do painel", () => {
  const ULTIMA = indiceDaUltimaMissao("map_1");

  it("aberto vem com motivo nulo, para o painel ler sem testar", () => {
    expect(dadosDaTrava("map_1", ULTIMA + 1)).toEqual({
      bloqueado: false,
      motivo: null,
    });
  });

  it("selado vem com o motivo dentro", () => {
    const dados = dadosDaTrava("map_1", 3);

    expect(dados.bloqueado).toBe(true);
    expect(dados.motivo).toContain(getMainQuest(ULTIMA).name);
  });

  it("o portal do painel e o MESMO veredito da regra", () => {
    /**
     * A box do portal e o SERVIDOR nao podem discordar. Se um dia um
     * deles montar o `bloqueado` por conta propria, este teste e o que
     * avisa
     */
    for (const i of [0, ULTIMA, ULTIMA + 1]) {
      expect(dadosDaTrava(FLORESTA.exigeMissaoDe, i).bloqueado).toBe(
        !portalLiberado(FLORESTA.exigeMissaoDe, i).ok,
      );
    }
  });
});