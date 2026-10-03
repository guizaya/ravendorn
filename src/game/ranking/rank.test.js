import { describe, expect, it } from "vitest";
import {
  RANK_CRITERIO,
  RANK_MEDALHA_PADRAO,
  dadosDoJogador,
  montarRank,
  rankPosicao,
} from "./rank.js";

/**
 * Uma sessao falsa so com o que o rank le. O resto da `PlayerSession`
 * nao interessa, e montar uma inteira aqui seria testar o servidor
 * dentro do teste da regra de ordenacao.
 */
function sessao({
  id,
  name,
  classId = "guerreiro",
  nivel = 1,
  xp = 0,
  cacadas = 0,
  abates = 0,
}) {
  return {
    id,
    name,
    classId,
    player: { level: nivel, xp },
    bestiary: {
      kills: new Map(
        abates > 0 ? [["zumbi_arbalist", abates]] : [],
      ),
      completed: new Set(
        Array.from(
          { length: cacadas },
          (_, i) => `hunt_${i}`,
        ),
      ),
    },
  };
}

/** Os dois criterios, pela API real. */
const porNivel = (sessoes) =>
  montarRank(sessoes)[RANK_CRITERIO.NIVEL];

const porBestiario = (sessoes) =>
  montarRank(sessoes)[RANK_CRITERIO.BESTIARIO];

const nomes = (lista) => lista.map((j) => j.name);

describe("rank", () => {
  it("ordena por nivel e usa o xp do nivel como desempate", () => {
    const lista = [
      sessao({ id: "1", name: "Ana", nivel: 3, xp: 10 }),
      sessao({ id: "2", name: "Bia", nivel: 3, xp: 90 }),
      sessao({ id: "3", name: "Cid", nivel: 9, xp: 0 }),
    ];

    expect(nomes(porNivel(lista))).toEqual([
      "Cid",
      "Bia",
      "Ana",
    ]);
  });

  it("ordena por cacadas fechadas e abates no desempate", () => {
    const lista = [
      sessao({ id: "1", name: "Ana", nivel: 1, cacadas: 0, abates: 40 }),
      sessao({ id: "2", name: "Bia", nivel: 1, cacadas: 2, abates: 3 }),
      sessao({ id: "3", name: "Cid", nivel: 1, cacadas: 2, abates: 30 }),
    ];

    expect(nomes(porBestiario(lista))).toEqual([
      "Cid",
      "Bia",
      "Ana",
    ]);
  });

  it("desempata pelo nome, para a lista nao pular entre pacotes", () => {
    const lista = [
      sessao({ id: "1", name: "Zeta", nivel: 5, xp: 5 }),
      sessao({ id: "2", name: "Ana", nivel: 5, xp: 5 }),
    ];

    // a ordem do `sort` e estavel, mas inverter a entrada prova que
    // e o NOME que decide, e nao a ordem em que o servidor listou
    expect(nomes(porNivel([...lista].reverse()))).toEqual([
      "Ana",
      "Zeta",
    ]);
  });

  it("numera as posicoes e a posicao comeca em 1", () => {
    const rank = montarRank([
      sessao({ id: "1", name: "Ana", nivel: 1 }),
      sessao({ id: "2", name: "Bia", nivel: 7 }),
    ]);

    expect(
      rank[RANK_CRITERIO.NIVEL].map((j) => [j.name, j.posicao]),
    ).toEqual([
      ["Bia", 1],
      ["Ana", 2],
    ]);
  });

  it("medalha so nos tres primeiros, e o resto fica neutro", () => {
    expect(rankPosicao(1)).toBe("🥇");
    expect(rankPosicao(2)).toBe("🥈");
    expect(rankPosicao(3)).toBe("🥉");
    expect(rankPosicao(4)).toBe(RANK_MEDALHA_PADRAO);
    expect(rankPosicao(27)).toBe(RANK_MEDALHA_PADRAO);
  });

  it("trata xp ausente como zero, sem virar NaN na ordenacao", () => {
    // um personagem recem-criado nao subiu de nivel nenhuma vez, e
    // `player.xp` ainda e `undefined`
    const recemCriado = {
      id: "1",
      name: "Ana",
      classId: "guerreiro",
      player: { level: 1, xp: undefined },
      bestiary: { kills: new Map(), completed: new Set() },
    };

    expect(dadosDoJogador(recemCriado).xp).toBe(0);

    // com o XP ausente, a ordenacao nao pode virar `NaN`: se
    // devolvesse `NaN`, o `sort` trataria como zero e a ordem viraria
    // a da entrada, e um novato acabaria na frente de quem tem nivel
    const lista = porNivel([
      recemCriado,
      sessao({ id: "2", name: "Bia", nivel: 2, xp: 0 }),
    ]);

    expect(nomes(lista)).toEqual(["Bia", "Ana"]);
  });

  it("soma os abates de todas as criaturas no desempate", () => {
    const dados = dadosDoJogador({
      id: "1",
      name: "Ana",
      classId: "guerreiro",
      player: { level: 2, xp: 4 },
      bestiary: {
        kills: new Map([
          ["goblin", 7],
          ["zumbi_arbalist", 5],
        ]),
        completed: new Set(["hunt_0", "hunt_1"]),
      },
    });

    expect(dados.abates).toBe(12);
    expect(dados.cacadas).toBe(2);
  });

  it("monta as duas listas e nao altera a ordem dosCriteria", () => {
    const rank = montarRank([
      sessao({ id: "1", name: "Ana", nivel: 1, cacadas: 9 }),
      sessao({ id: "2", name: "Bia", nivel: 20, cacadas: 0 }),
    ]);

    expect(nomes(rank[RANK_CRITERIO.NIVEL])).toEqual(["Bia", "Ana"]);
    expect(nomes(rank[RANK_CRITERIO.BESTIARIO])).toEqual([
      "Ana",
      "Bia",
    ]);
  });

  it("lista vazia nao quebra", () => {
    const rank = montarRank([]);

    expect(rank[RANK_CRITERIO.NIVEL]).toEqual([]);
    expect(rank[RANK_CRITERIO.BESTIARIO]).toEqual([]);
  });
});
