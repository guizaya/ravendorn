import { describe, expect, it } from "vitest";
import {
  fireEvent,
  render as montarDOM,
} from "@testing-library/react";
import QuestPanel from "./QuestPanel.jsx";

/**
 * O painel virou duas abas porque a lista de secundarias empilhava
 * a principal para fora da vista. Estes testes clicam de verdade:
 * o defeito anterior era de estado, e so um render com DOM e clique
 * pega troca de aba.
 */

const principal = {
  id: "principal_1",
  name: "Abrir caminho",
  summary: "Mate 3 slimes",
  type: "kill",
  count: 3,
  progress: 1,
  autoCompletable: true,
  rewards: {
    coins: 120,
    xp: 90,
    items: [{ itemId: "slime_core", count: 2 }],
  },
};

const side = {
  id: "side_1",
  name: "Pele estropiada",
  summary: "Caixe 2 ratos",
  type: "hunt",
  count: 2,
  progress: 0,
  autoCompletable: true,
  rewards: {
    coins: 60,
    xp: 40,
    items: [{ itemId: "rat_pelt", count: 4 }],
  },
};

const sideFeita = {
  id: "side_2",
  name: "Osso viejo",
  summary: "Reuna 4 ossos",
  type: "hunt",
  count: 4,
  progress: 4,
  done: true,
  autoCompletable: true,
  rewards: { coins: 90, xp: 70, items: [] },
};

function dados({
  passos = [principal],
  atualPrincipal = principal,
  sideAtual = null,
  disponiveis = [side, sideFeita],
  resgataveis = [],
} = {}) {
  return {
    main: {
      steps: passos,
      current: atualPrincipal,
      total: passos.length,
    },
    side: {
      available: disponiveis,
      current: sideAtual,
      completed: 1,
    },
    auto: {
      enabled: false,
      objectiveId: null,
      quest: null,
    },
    claimable: resgataveis,
  };
}

const montar = (quests = dados(), props = {}) =>
  montarDOM(
    <QuestPanel
      quests={quests}
      onClose={() => {}}
      onAccept={() => {}}
      onAbandon={() => {}}
      onFocus={() => {}}
      onToggleAuto={() => {}}
      onClaim={() => {}}
      {...props}
    />,
  );

const abas = (container) =>
  [...container.querySelectorAll(".qst-tab")];

const clicarNaAba = (container, label) => {
  const aba = abas(container).find(
    (botao) =>
      botao.querySelector("small")?.textContent.trim() ===
      label,
  );

  if (!aba) {
    throw new Error(`aba "${label}" nao existe`);
  }

  fireEvent.click(aba);
};

describe("QuestPanel abas de missao", () => {
  it("tem uma aba para a principal e outra para as secundarias", () => {
    const { container } = montar();

    const labels = abas(container).map(
      (aba) => aba.querySelector("small").textContent,
    );

    expect(labels).toEqual([
      "Principal",
      "Secundárias",
    ]);
  });

  it("abre na principal por padrao", () => {
    const { container } = montar();

    const ativa = container.querySelector(
      ".qst-tab.is-active small",
    );

    expect(ativa.textContent).toBe("Principal");
    expect(container.textContent).toContain(
      "Abrir caminho",
    );
  });

  it("a aba principal esconde as secundarias", () => {
    const { container } = montar();

    expect(container.textContent).toContain(
      "Abrir caminho",
    );
    expect(container.textContent).not.toContain(
      "Pele estropiada",
    );
  });

  it("clicar em secundarias troca o conteudo", () => {
    const { container } = montar();

    clicarNaAba(container, "Secundárias");

    expect(container.textContent).toContain(
      "Pele estropiada",
    );
    expect(container.textContent).not.toContain(
      "Abrir caminho",
    );
  });

  it("clicar de volta traz a principal de volta", () => {
    const { container } = montar();

    clicarNaAba(container, "Secundárias");
    clicarNaAba(container, "Principal");

    expect(container.textContent).toContain(
      "Abrir caminho",
    );
    expect(container.textContent).not.toContain(
      "Pele estropiada",
    );
  });

  it("marca so a aba aberta como ativa", () => {
    const { container } = montar();

    expect(
      container.querySelectorAll(".qst-tab.is-active"),
    ).toHaveLength(1);

    clicarNaAba(container, "Secundárias");

    const ativa = container.querySelector(
      ".qst-tab.is-active small",
    );

    expect(ativa.textContent).toBe("Secundárias");
    expect(
      container.querySelectorAll(".qst-tab.is-active"),
    ).toHaveLength(1);
  });

  it("as abas sao marcadas para leitores de tela", () => {
    const { container } = montar();

    const nav = container.querySelector(".qst-tabs");

    expect(nav.getAttribute("role")).toBe("tablist");

    for (const aba of abas(container)) {
      expect(aba.getAttribute("role")).toBe("tab");
      expect(aba.hasAttribute("aria-selected")).toBe(
        true,
      );
    }

    clicarNaAba(container, "Secundárias");

    const selecionadas = abas(container).filter(
      (aba) => aba.getAttribute("aria-selected") === "true",
    );

    expect(selecionadas).toHaveLength(1);
    expect(
      selecionadas[0].querySelector("small").textContent,
    ).toBe("Secundárias");
  });

  it("a aba conta quantas faltam, nao quantas existem", () => {
    // contar "as 4 principais" faria o jogador achar que tem
    // trabalho a fazer quando 3 ja foram concluidas
    const { container } = montar(
      dados({
        passos: [
          principal,
          { ...principal, id: "p2", state: "done" },
          { ...principal, id: "p3", state: "done" },
        ],
      }),
    );

    const abaPrincipal = abas(container)[0];
    const abaSecundaria = abas(container)[1];

    expect(
      abaPrincipal.querySelector(".qst-tab__count")
        .textContent,
    ).toBe("1");

    // so a side nao concluida conta
    expect(
      abaSecundaria.querySelector(".qst-tab__count")
        .textContent,
    ).toBe("1");
  });

  it("nao põe contador quando nada falta", () => {
    const { container } = montar(
      dados({
        passos: [
          { ...principal, state: "done" },
        ],
        atualPrincipal: null,
        disponiveis: [sideFeita],
      }),
    );

    for (const aba of abas(container)) {
      expect(
        aba.querySelector(".qst-tab__count"),
      ).toBe(null);
    }
  });

  it("abre nas secundarias quando so ha side", () => {
    // nada de principal para ver: a aba morta nao ajuda
    const { container } = montar(
      dados({
        passos: [],
        atualPrincipal: null,
      }),
    );

    expect(
      container.querySelector(".qst-tab.is-active small")
        .textContent,
    ).toBe("Secundárias");
  });

  it("a side ativa aparece na aba de secundarias", () => {
    const { container } = montar(
      dados({ sideAtual: side }),
    );

    clicarNaAba(container, "Secundárias");

    expect(container.textContent).toContain(
      "Abandonar",
    );
    expect(container.textContent).toContain(
      "Pele estropiada",
    );
  });

  it("nao deixa a aba Principal vazia quando a campanha acaba", () => {
    // a principal termina e some do snapshot. sem um desvio a
    // tela ficaria vazia com "Principal" marcada, sem nenhuma
    // missao visivel
    const comPrincipal = dados();
    const utils = montarDOM(
      <QuestPanel
        quests={comPrincipal}
        onClose={() => {}}
        onAccept={() => {}}
        onAbandon={() => {}}
        onFocus={() => {}}
        onToggleAuto={() => {}}
      />,
    );

    clicarNaAba(utils.container, "Secundárias");
    clicarNaAba(utils.container, "Principal");

    // a campanha acabou: nenhum passo, nenhuma atual
    utils.rerender(
      <QuestPanel
        quests={dados({
          passos: [],
          atualPrincipal: null,
        })}
        onClose={() => {}}
        onAccept={() => {}}
        onAbandon={() => {}}
        onFocus={() => {}}
        onToggleAuto={() => {}}
      />,
    );

    const ativa = utils.container.querySelector(
      ".qst-tab.is-active small",
    );

    expect(ativa.textContent).toBe("Secundárias");
    expect(utils.container.textContent).toContain(
      "Pele estropiada",
    );
    expect(utils.container.textContent).not.toContain(
      "Escolha uma missão",
    );
  });

  it("aguenta snapshot sem nenhuma missao", () => {
    const { container } = montar(
      dados({
        passos: [],
        atualPrincipal: null,
        disponiveis: [],
      }),
    );

    expect(container.querySelector(".qst-panel")).not.toBe(
      null,
    );
    expect(
      container.querySelectorAll(".qst-tab"),
    ).toHaveLength(2);
  });
});

/**
 * A coluna de RECOMPENSA e o [RECEBER].
 *
 * O layout novo e o de lista de MMORPG: nome, descricao e progresso
 * na esquerda, o que a missao paga na direita, e o botao no fim. E o
 * resgate que substituiu o pagamento automatico: o objetivo
 * concluindo NAO deposita nada, o dinheiro sai quando o jogador
 * clica.
 */
describe("a recompensa da missao", () => {
  const cartoes = (container) => [
    ...container.querySelectorAll(".qst-row"),
  ];

  /**
   * A campanha depois de fechar o primeiro passo: o primeiro esta
   * `done` com a recompensa na fila, e o segundo ja e a missao atual.
   *
   * E a situacao real que o [RECEBER] aparece: a missao seixinou, o
   * objetivo andar, e o jogador ainda nao pegou o que ganhou
   */
  const campanhaComResgate = () => {
    const passo = {
      ...principal,
      id: "principal_1",
      state: "done",
      claimable: true,
    };

    const atual = {
      ...principal,
      id: "principal_2",
      name: "Passo seguinte",
    };

    return dados({
      passos: [passo, atual],
      atualPrincipal: atual,
      resgataveis: [
        {
          id: passo.id,
          scope: "main",
          name: passo.name,
          summary: passo.summary,
          rewards: passo.rewards,
        },
      ],
    });
  };

  it("mostra moedas, xp e item de uma missao", () => {
    const { container } = montar();

    const cartao = cartoes(container)[0];
    const premios = [
      ...cartao.querySelectorAll(".qst-reward"),
    ];

    // a coluna e tres icones: a moeda, o xp e o item
    expect(premios).toHaveLength(3);
    expect(cartao.textContent).toContain("120");
    expect(cartao.textContent).toContain("90");
    expect(cartao.textContent).toContain("2");
  });

  it("usa o icone do catalogo para o item da recompensa", () => {
    const { container } = montar();

    const icone = container.querySelector(
      ".qst-reward--item .qst-reward__icon",
    );

    // `slime_core` nao tem arte, entao o `ItemIcon` cai no glifo do
    // catalogo. O ponto e que a coluna NAO inventa um icone: ela usa
    // o mesmo caminho do inventario
    expect(icone).not.toBe(null);
    expect(icone.textContent.trim()).not.toBe("");
  });

  it("a coluna fica DEPOIS do texto da missao", () => {
    const { container } = montar();

    const cartao = cartoes(container)[0];
    const info = cartao.querySelector(".qst-row__info");
    const coluna = cartao.querySelector(".qst-rewards");

    expect(info).not.toBe(null);
    expect(coluna).not.toBe(null);

    // a ordem no DOM e a ordem na tela: o grid do cartao tem tres
    // colunas e cada filho ocupa a sua
    expect(
      info.compareDocumentPosition(coluna) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("esconde a coluna quando a missao nao paga nada", () => {
    const { container } = montar(
      dados({
        passos: [
          {
            ...principal,
            rewards: { coins: 0, xp: 0, items: [] },
          },
        ],
      }),
    );

    expect(
      container.querySelector(".qst-rewards"),
    ).toBe(null);
  });

  it("nao mostra [RECEBER] enquanto o objetivo nao terminou", () => {
    const { container } = montar();

    expect(
      container.querySelector(".qst-action--claim"),
    ).toBe(null);
  });

  it("mostra [RECEBER] na missao concluida e nao resgatada", () => {
    const { container } = montar(campanhaComResgate());

    const botao =
      container.querySelector(".qst-action--claim");

    expect(botao).not.toBe(null);
    expect(botao.textContent).toBe("RECEBER");
    expect(
      container.querySelector(".qst-action--done"),
    ).toBe(null);
  });

  it("o [RECEBER] leva o id da missao para o resgate", () => {
    const pedidos = [];

    const { container } = montar(campanhaComResgate(), {
      onClaim: (id) => pedidos.push(id),
    });

    fireEvent.click(container.querySelector(".qst-action--claim"));

    expect(pedidos).toEqual(["principal_1"]);
  });

  it("vira [CONCLUIDA] depois que a recompensa sai da fila", () => {
    // o snapshot depois do resgate: a missao continua `done` e nao
    // esta mais em `claimable`
    const { container } = montar(
      dados({
        passos: [
          { ...principal, state: "done" },
          { ...principal, id: "principal_2" },
        ],
        atualPrincipal: {
          ...principal,
          id: "principal_2",
        },
        resgataveis: [],
      }),
    );

    expect(
      container.querySelector(".qst-action--claim"),
    ).toBe(null);

    const feito = container.querySelector(
      ".qst-action--done",
    );

    expect(feito).not.toBe(null);
    expect(feito.textContent).toContain("CONCLUÍDA");
  });

  it("conta as recompensas a receber no cabecalho", () => {
    const { container } = montar(campanhaComResgate());

    const aviso =
      container.querySelector(".qst-panel__pending");

    expect(aviso).not.toBe(null);
    expect(aviso.textContent).toContain("1");
    expect(aviso.textContent).toContain("a receber");
  });

  it("nao mostra o aviso quando nao ha nada a receber", () => {
    const { container } = montar();

    expect(
      container.querySelector(".qst-panel__pending"),
    ).toBe(null);
  });

  it("leva o [RECEBER] da secundaria para a aba das secundarias", () => {
    // o resgate e filtrado pelo `scope`. Uma principal concluida
    // resgatada na aba das secundarias mostraria um [RECEBER] que
    // aponta para uma missao que nao esta na tela
    const { container } = montar(
      dados({
        resgataveis: [
          {
            id: side.id,
            scope: "side",
            name: side.name,
            summary: side.summary,
            rewards: side.rewards,
          },
        ],
        disponiveis: [
          { ...side, done: true, claimable: true },
          sideFeita,
        ],
      }),
    );

    clicarNaAba(container, "Secundárias");

    const botoes = [
      ...container.querySelectorAll(".qst-action--claim"),
    ];

    expect(botoes).toHaveLength(1);
    expect(container.textContent).not.toContain(
      "Abrir caminho",
    );
  });

  it("a secundaria ativa aparece uma vez so", () => {
    // ela e desenhada no bloco de cima, com o botao de abandonar. A
    // lista de disponiveis tambem a trazia, e o mesmo "Abandonar"
    // aparecia duas vezes na tela
    const { container } = montar(
      dados({
        sideAtual: side,
        disponiveis: [{ ...side, active: true }],
      }),
    );

    clicarNaAba(container, "Secundárias");

    expect(
      container.querySelectorAll(".qst-action--abandon"),
    ).toHaveLength(1);
  });
});
