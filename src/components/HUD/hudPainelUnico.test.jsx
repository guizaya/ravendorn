import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";
import { RANK_CRITERIO } from "../../game/ranking/rank.js";

/**
 * Um painel por vez.
 *
 * A HUD tinha nove `boolean`, um por painel, e cada botao fechava NA
 * MAO dois ou tres dos outros. Duas coisas davam errado com isso:
 *
 * 1. A lista de fechamentos estava sempre incompleta. O botao do
 *    bestiario fechava o rank, o da colecao fechava o rank e o
 *    bestiario, e o do craft fechava o market — mas nenhum fechava o
 *    inventario, o status ou o teste. Um painel novo nascia obrigado a
 *    lembrar de fechar todos os outros em cada lugar
 *
 * 2. Os ATALHOS nao fechavam nada. O `B` ligava o bestiario e o `K`
 *    ligava a colecao, cada um por conta propria, e o resultado eram
 *    dois paineis centrais empilhados na mesma posicao, com a colecao
 *    por cima do bestiario. Era esse o relato
 *
 * Este arquivo trava a regra geral, e nao os pares: abrir um painel
 * fecha o que estivesse aberto, seja pelo botao, seja pela tecla.
 */

/**
 * O inventario precisa do seletor proprio.
 *
 * Craft, market, status e teste sao todos
 * `<section className="inv-panel cft-panel">` e companhia: `inv-panel`
 * e a CAIXA, e a segunda classe e o que identifica o painel. Contar
 * `inv-panel` e `cft-panel` junto contaria o craft duas vezes, e o
 * teste passaria aclaivar "esperado 1, recebido 2" num painel unico.
 * O `:not` deixa a busca da mochila somente com a caixa que nao tem
 * painel nenhum junto
 *
 * O `enc-panel` entrou na lista pelo MESMO motivo e pelo motivo
 * oposto: o painel de encantar TAMBEM e `<section className="inv-panel
 * enc-panel">`, porque ele reusa a casca do inventario de proposito.
 * Sem ele aqui, abrir a mochila e o encantar contaria como dois
 * paineis — e este arquivo existe justamente para provar que nunca sao
 */
const SO_A_MOCHILA =
  ".inv-panel:not(.cft-panel):not(.mkt-panel)" +
  ":not(.sts-panel):not(.enc-panel)";

/** o seletor de cada painel, o botao, a tecla e se o botao alterna */
const PAINEL = [
  {
    nome: "missoes",
    seletor: ".qst-panel",
    botao: ".qst-tracker__head",
    tecla: "KeyQ",

    // o cabecalho do rastreador ABRE, e nao alterna: e um "va para as
    // missoes", nao um botao de painel
    alterna: false,
  },
  { nome: "bestiario", seletor: ".bst-panel", botao: ".hud-btn--bestiary", tecla: "KeyB", alterna: true },
  { nome: "rank", seletor: ".rnk-panel", botao: ".hud-btn--rank", tecla: "KeyR", alterna: true },
  { nome: "craft", seletor: ".cft-panel", botao: ".hud-btn--craft", tecla: "KeyC", alterna: true },
  { nome: "colecao", seletor: ".col-panel", botao: ".hud-btn--collection", tecla: "KeyK", alterna: true },
  { nome: "market", seletor: ".mkt-panel", botao: ".hud-btn--market", tecla: "KeyM", alterna: true },
  { nome: "status", seletor: ".sts-panel", botao: ".hud-btn--status", tecla: "KeyP", alterna: true },
  { nome: "encantar", seletor: ".enc-panel", botao: ".hud-btn--test", tecla: "KeyX", alterna: true },
  { nome: "inventario", seletor: SO_A_MOCHILA, botao: ".hud-pouch", tecla: "KeyI", alterna: true },
];

const montar = () => {
  const painel = {
    time: 0,
    autoPlay: false,
    engaged: false,
    player: {
      id: "p_ana",
      name: "Ana",
      className: "Warrior",
      level: 9,
      hp: 1400,
      maxHp: 1400,
      resource: 100,
      maxResource: 100,
      resourceName: "Chi",
      shield: 0,
      skills: [],
      statusEffects: [],
    },

    /**
     * A missoes e o painel com o snapshot mais raso do laco: o
     * `QuestPanel` le `data.side.current` sem guarda nenhuma, entao
     * `side`, `main` e `auto` precisam existir todos — o `main` com
     * `current` tambem e o que faz o RASTREADOR aparecer na barra, que
     * e o botao de abrir das missoes
     */
    quests: {
      main: {
        steps: [],
        total: 3,
        current: {
          id: "principal_1",
          name: "Abrir caminho",
          summary: "Mate 3 slimes",
          progress: 1,
          total: 3,
          autoCompletable: true,
        },
      },
      side: { available: [], current: null, completed: 0 },
      auto: { enabled: false, objectiveId: null, quest: null },
      claimable: [],
    },

    inventory: {
      coins: 0,
      used: 0,
      capacity: 20,
      isFull: false,
      items: [],
    },

    rank: {
      [RANK_CRITERIO.NIVEL]: [
        {
          id: "p_ana",
          name: "Ana",
          nivel: 9,
          xp: 0,
          cacadas: 1,
          abates: 4,
          posicao: 1,
        },
      ],
    },
  };

  return render(
    <HUD
      classDefinition={getCharacterDefinition("warrior")}
      characterName="Ana"
      snapshot={painel}
      /**
       * O motor precisa do `fixMisplacedEquipment`: o `I` passa pelo
       * mesmo caminho do botao da mochila, e um motor vazio faria o
       * atalho chamar `undefined` e o teste estourar num erro de
       * `TypeError` em vez de no que ele verifica
       */
      engineRef={{
        current: { fixMisplacedEquipment() {} },
      }}
      intencao={null}
    />,
  );
};

const clicar = async (alvo) => {
  await act(async () => {
    alvo.click();
  });
};

const tecla = async (code) => {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code }));
  });
};

/**
 * Quantos paineis estao na tela.
 *
 * Cada seletor da lista e um painel distinto, entao a soma e a
 * quantidade de paineis abertos. Com dois abertos o total seria 2, e
 * e exatamente isso que este arquivo proibe
 */
const abertos = (container) =>
  PAINEL.reduce(
    (total, { seletor }) =>
      total + container.querySelectorAll(seletor).length,
    0,
  );

/** o primeiro painel que nao e o alvo, para ser o "anterior" */
const outro = (nome) =>
  PAINEL.find((painel) => painel.nome !== nome);

afterEach(cleanup);

describe("so um painel da HUD por vez", () => {
  it("nenhum painel comecela aberto", () => {
    const { container } = montar();

    expect(abertos(container)).toBe(0);
  });

  it("abrir um pelo botao fecha o que estava aberto", async () => {
    for (const alvo of PAINEL) {
      const anterior = outro(alvo.nome);

      const { container } = montar();

      await clicar(container.querySelector(anterior.botao));

      expect(
        abertos(container),
        `${anterior.nome} nao abriu`,
      ).toBe(1);

      await clicar(container.querySelector(alvo.botao));

      expect(
        abertos(container),
        `${alvo.nome} em cima de ${anterior.nome}`,
      ).toBe(1);

      expect(
        container.querySelector(alvo.seletor),
        `${alvo.nome} nao abriu`,
      ).toBeTruthy();

      cleanup();
    }
  });

  it("abrir um pela tecla fecha o que estava aberto", async () => {
    // O caminho do relato: os atalhos nao fechavam nada, e `B` seguido
    // de `K` deixava a colecao empilhada sobre o bestiario
    for (const alvo of PAINEL) {
      const anterior = outro(alvo.nome);

      const { container } = montar();

      await tecla(anterior.tecla);

      expect(abertos(container), `${anterior.nome} nao abriu`).toBe(1);

      await tecla(alvo.tecla);

      expect(
        abertos(container),
        `${alvo.nome} por tecla em cima de ${anterior.nome}`,
      ).toBe(1);

      expect(
        container.querySelector(alvo.seletor),
        `${alvo.tecla} nao abriu ${alvo.nome}`,
      ).toBeTruthy();

      cleanup();
    }
  });

  it("o atalho fecha o painel que estava aberto pelo botao", async () => {
    // A combinacao que mais acontecia: abrir com o mouse e trocar com a
    // tecla, ou o contrario
    const { container } = montar();

    await clicar(container.querySelector(".hud-btn--bestiary"));

    await tecla("KeyK");

    expect(container.querySelector(".bst-panel")).toBe(null);
    expect(container.querySelector(".col-panel")).toBeTruthy();
    expect(abertos(container)).toBe(1);

    // e o botao de outro painel fecha o que a tecla abriu
    await clicar(container.querySelector(".hud-btn--rank"));

    expect(container.querySelector(".col-panel")).toBe(null);
    expect(container.querySelector(".rnk-panel")).toBeTruthy();
    expect(abertos(container)).toBe(1);
  });

  it("abrir todos em sequencia nunca empilha", async () => {
    const { container } = montar();

    for (const alvo of PAINEL) {
      await tecla(alvo.tecla);

      expect(
        abertos(container),
        `depois de abrir ${alvo.nome}`,
      ).toBe(1);

      expect(
        container.querySelector(alvo.seletor),
        `${alvo.nome} nao abriu pela tecla ${alvo.tecla}`,
      ).toBeTruthy();
    }
  });

  it("a tecla do painel aberto fecha ele", async () => {
    for (const alvo of PAINEL) {
      const { container } = montar();

      await tecla(alvo.tecla);

      expect(abertos(container), alvo.nome).toBe(1);

      await tecla(alvo.tecla);

      expect(
        abertos(container),
        `${alvo.tecla} nao fechou ${alvo.nome}`,
      ).toBe(0);

      cleanup();
    }
  });

  it("o botao do painel aberto fecha ele", async () => {
    for (const alvo of PAINEL.filter((p) => p.alterna)) {
      const { container } = montar();

      await clicar(container.querySelector(alvo.botao));

      expect(abertos(container), alvo.nome).toBe(1);

      await clicar(container.querySelector(alvo.botao));

      expect(
        abertos(container),
        `${alvo.botao} nao fechou ${alvo.nome}`,
      ).toBe(0);

      cleanup();
    }
  });

  it("o X do painel fecha ele e nao abre outro", async () => {
    // O botao de fechar e o `onClose` do painel: ele so pode fechar o
    // proprio. Se ele virasse "abrir null", fecharia o painel inteiro
    const { container } = montar();

    await clicar(container.querySelector(".hud-btn--bestiary"));

    await clicar(container.querySelector(".bst-panel .inv-close"));

    expect(abertos(container)).toBe(0);

    // e nao sobrou nenhum pelo meio
    await clicar(container.querySelector(".hud-btn--collection"));

    expect(abertos(container)).toBe(1);
    expect(container.querySelector(".col-panel")).toBeTruthy();
  });

  it("so um botao fica marcado como ativo", async () => {
    // Os botoes de painel usam `is-active`, e o de pagina de habilidade
    // tambem — entao a checagem e sobre os botoes que TEM painel. A
    // mochila e a excecao: ela marca com `is-open`, nao `is-active`
    const BOTOES = [
      ".hud-btn--bestiary",
      ".hud-btn--market",
      ".hud-btn--collection",
      ".hud-btn--craft",
      ".hud-btn--rank",
      ".hud-btn--status",
      ".hud-btn--test",
    ];

    const marcados = (container) =>
      BOTOES.filter((seletor) =>
        container.querySelector(seletor)?.className.includes(
          "is-active",
        ),
      );

    for (const alvo of PAINEL) {
      const { container } = montar();

      await tecla(alvo.tecla);

      const ativos = marcados(container);

      expect(
        ativos.length,
        `${alvo.nome}: ${ativos.join(", ") || "nenhum"}`,
      ).toBeLessThanOrEqual(1);

      if (alvo.nome === "inventario") {
        expect(
          container
            .querySelector(".hud-pouch")
            .className.includes("is-open"),
          "a mochila nao ficou marcada",
        ).toBe(true);
      }

      cleanup();
    }
  });

  it("abrir o pause fecha o painel que estava aberto", async () => {
    const { container } = montar();

    await clicar(container.querySelector(".hud-btn--collection"));

    expect(abertos(container)).toBe(1);

    await tecla("Escape");

    // o painel some e o pause aparece
    expect(abertos(container)).toBe(0);
    expect(container.querySelector(".pause")).toBeTruthy();
  });
});

/**
 * COM O FOCO NUM CAMPO, A TECLA E DO CAMPO.
 *
 * O `keydown` da HUD esta no `window` e nao.preventDefault, entao antes
 * desta guarda digitar o nome da guilda abria painel por cima do campo:
 * `b` no nome abria o bestiario, e `g` — que e a tecla da propria
 * guilda — fechava o painel que o jogador estava preenchendo
 */
describe("o atalho de painel nao vale com o foco num campo", () => {
  /** um campo de verdade no DOM, com o foco nele */
  function campoNoFoco(tipo = "text") {
    const campo = document.createElement("input");

    campo.type = tipo;

    document.body.appendChild(campo);
    campo.focus();

    return campo;
  }

  /** a tecla nasce no campo, como o navegador faz */
  const teclaNoCampo = async (campo, code) => {
    await act(async () => {
      campo.dispatchEvent(
        new KeyboardEvent("keydown", { code, bubbles: true }),
      );
    });
  };

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("nenhuma tecla de painel abre painel enquanto o jogador digita", async () => {
    for (const alvo of PAINEL) {
      const campo = campoNoFoco();

      const { container } = montar();

      await teclaNoCampo(campo, alvo.tecla);

      expect(
        abertos(container),
        `${alvo.nome} abriu com o foco num campo de texto`,
      ).toBe(0);

      cleanup();
    }
  });

  /**
   * O `X` e o `G` sao o caso que dói.
   *
   * Sao as duas teclas da guilda, e as duas teclas de um painel que
   * TEM campos de texto. Digitar o nome com `x` e `g` no meio fecharia
   * e abriria o painel a cada letra
   */
  it("a letra do nome da guilda nao abre nem fecha painel", async () => {
    const campo = campoNoFoco();

    const { container } = montar();

    await clicar(container.querySelector(".hud-btn--test"));

    expect(container.querySelector(".enc-panel")).toBeTruthy();

    // o `g` da propria guilda, digitando no meio do nome
    await teclaNoCampo(campo, "KeyG");

    expect(
      container.querySelector(".enc-panel"),
      "o painel de encantar fechou digitando",
    ).toBeTruthy();
  });

  it("o ESC nao abre o pause com o foco num campo", async () => {
    const campo = campoNoFoco();

    const { container } = montar();

    await teclaNoCampo(campo, "Escape");

    expect(container.querySelector(".pause")).toBe(null);
  });

  it("com o foco fora do campo, o atalho volta a valer", async () => {
    const campo = campoNoFoco();

    const { container } = montar();

    await teclaNoCampo(campo, "KeyB");

    expect(abertos(container)).toBe(0);

    // o campo perde o foco: agora `b` volta a ser atalho
    campo.blur();
    document.body.focus();

    await tecla("KeyB");

    expect(container.querySelector(".bst-panel")).toBeTruthy();
  });

  /**
   * Um checkbox nao conta como digitacao.
   *
   * Marcar o "ataque automatico" nao pode virar um campo onde as teclas
   * param de funcionar — o jogador nao teria como saber
   */
  it("com o foco num checkbox, o atalho continua valendo", async () => {
    const caixa = campoNoFoco("checkbox");

    const { container } = montar();

    await teclaNoCampo(caixa, "KeyB");

    expect(container.querySelector(".bst-panel")).toBeTruthy();
  });
});
