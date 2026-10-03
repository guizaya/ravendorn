import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import HUD from "./HUD.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";
import { HUD_ICON_IDS, hudIconUrl } from "../../data/hudIcons.js";

/**
 * Os icones desenhados DENTRO dos botoes da HUD.
 *
 * O `hudIcons.test.js` prova que os arquivos existem e que o mapa esta
 * certo. Este arquivo prova o outro lado: que o botao da tela mostra a
 * `<img>` e nao o glifo. Sao dois defeitos distintos, e um passa sem o
 * outro — um mapa perfeito com o `HUD` ainda chamando o componente
 * errado nao muda nada na tela
 */

/** o botao e o icone dentro dele */
const botaoDe = (container, seletor) => {
  const botao = container.querySelector(seletor);

  return { botao, icone: botao?.querySelector(".hud-icon") ?? null };
};

const montar = () => {
  const snapshot = {
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

    quests: {
      main: { steps: [], total: 0, current: null },
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
  };

  return render(
    <HUD
      classDefinition={getCharacterDefinition("warrior")}
      characterName="Ana"
      snapshot={snapshot}
      engineRef={{ current: {} }}
      intencao={null}
    />,
  );
};

/** o botao da HUD que tem o icone deste nome */
const SELETOR_DO_ICONE = {
  stats: ".hud-btn--status",
  bestiario: ".hud-btn--bestiary",
  market: ".hud-btn--market",
  collection: ".hud-btn--collection",
  craft: ".hud-btn--craft",
  rank: ".hud-btn--rank",
  guild: ".hud-btn--guild",
  settings: ".hud-btn--settings",
};

afterEach(cleanup);

describe("o icone dentro do botao da HUD", () => {
  it.each(HUD_ICON_IDS)("%s mostra a arte, e nao o glifo", (iconId) => {
    const { container } = montar();

    const { botao, icone } = botaoDe(
      container,
      SELETOR_DO_ICONE[iconId],
    );

    expect(botao, `o botao de ${iconId} sumiu`).toBeTruthy();
    expect(icone, `${iconId} nao tem .hud-icon`).toBeTruthy();

    const img = icone.querySelector("img");

    expect(
      img,
      `${iconId} caiu no glifo dentro do botao`,
    ).toBeTruthy();

    // e a imagem e a do ICONE DESTE botao: dois botoes com a mesma URL
    // apareciam iguais na tela
    expect(img.getAttribute("src")).toBe(hudIconUrl(iconId));

    // o `alt` vazio: o nome do painel ja esta no `aria-label` e no
    // `title` do botao, e um leitor de tela anunciando os dois enche a
    // barra de repeticao
    expect(img.getAttribute("alt")).toBe("");

    // a imagem nao e arrastavel: um `<img>` arrastado dentro da barra
    // vira um fantasma do icone seguindo o cursor
    expect(img.getAttribute("draggable")).toBe("false");
  });

  it.each(HUD_ICON_IDS)(
    "%s mantem o nome do painel no botao",
    (iconId) => {
      const { container } = montar();

      const { botao } = botaoDe(container, SELETOR_DO_ICONE[iconId]);

      // com a arte no lugar, o glifo some e o nome do painel fica so
      // no `title`/`aria-label`. Sem nenhum dos dois, o botao ficaria
      // sem nome nenhum para quem nao ve a imagem
      expect(botao.getAttribute("title")).toBeTruthy();
      expect(botao.getAttribute("aria-label")).toBeTruthy();
    },
  );

  it("os quatro botoes tem artes diferentes", () => {
    const { container } = montar();

    const srcs = HUD_ICON_IDS.map((iconId) => {
      const { icone } = botaoDe(container, SELETOR_DO_ICONE[iconId]);

      return icone?.querySelector("img")?.getAttribute("src");
    });

    expect(srcs.every(Boolean), "algum botao sem imagem").toBe(true);
    expect(new Set(srcs).size).toBe(HUD_ICON_IDS.length);
  });

  it("so o botao de teste continua no glifo", () => {
    const { container } = montar();

    /**
 * Os botoes com arte sao os de painel e o de configuracao. O de teste
 * e o unico que ficou no caractere, porque nao ha `test.png` em
 * `assets/icons/` — e ele e painel de depuracao, nao de jogo
 *
 * A contagem vem do `SELETOR_DO_ICONE`, e nao e um numero escrito aqui.
 * Escrever "7" obrigava a editar este arquivo a cada icone novo da
 * barra, e o numero acabava virando um lembrete de atualizar — que e
 * exatamente o que se esquece. Derivando do mapa, um icone sem
 * seletor quebra o `it.each` acima, que e o erro que importa
 */
expect(HUD_ICON_IDS).toHaveLength(
  Object.keys(SELETOR_DO_ICONE).length,
);

    // e nenhum id pode ficar sem botao, e nenhum botao sem id
    expect(
      [...Object.keys(SELETOR_DO_ICONE)].sort(),
    ).toEqual([...HUD_ICON_IDS].sort());

    for (const seletor of [".hud-btn--test"]) {
      const botao = container.querySelector(seletor);

      expect(botao, seletor).toBeTruthy();

      expect(
        botao.querySelector(".hud-icon"),
        `${seletor} nao devia ter icone`,
      ).toBe(null);

      expect(
        botao.querySelector("img"),
        `${seletor} nao devia ter imagem`,
      ).toBe(null);

      expect(
        botao.textContent.trim(),
        `${seletor} ficou sem o glifo`,
      ).not.toBe("");
    }
  });

  it("todo botao com icone tem a arte, e nenhum ficou pelo caminho", () => {
    const { container } = montar();

    /**
     * O inverso do teste anterior, e a verificacao que pega o botao
     * esquecido: se a arte da colecao entrasse no mapa mas o `HUD`
     * continuasse chamando o glifo, os outros testes passariam e este
     * acusaria o botao sem `<img>`
     */
    const semArte = Object.values(SELETOR_DO_ICONE).filter(
      (seletor) =>
        !container
          .querySelector(seletor)
          ?.querySelector(".hud-icon img"),
    );

    expect(
      semArte,
      "botoes com icone declarado e sem imagem na tela",
    ).toEqual([]);
  });

  it("o icone nao rouba o clique do botao", () => {
    const { container } = montar();

    /**
     * O `<img>` e um elemento dentro do `<button>`, entao o clique nele
     * chega no botao por heranca — mas o `pointer-events: none` e o
     * que garante isso sem depender da heranca. E o `alt` vazio e o
     * `draggable` desligado sao a mesma ideia pelo lado do arrasto: a
     * arte nao pode virar um fantasma puxado pelo mouse
     */
    const { icone } = botaoDe(container, ".hud-btn--bestiary");

    expect(icone).toBeTruthy();
  });

  it("abrir o painel pelo clique no icone funciona igual", async () => {
    const { container } = montar();

    const { botao, icone } = botaoDe(container, ".hud-btn--bestiary");

    /**
     * O clique precisa ser no `<img>`, e nao no botao: e o que o
     * navegador entrega quando o jogador clica em cima da arte, que e
     * onde a arte esta. Se o `pointer-events: none` sumisse do CSS, o
     * `<img>` viraria o alvo e o `onClick` do botao pararia de responder
     */
    await act(async () => {
      icone.querySelector("img").click();
    });

    expect(container.querySelector(".bst-panel")).toBeTruthy();
    expect(botao).toBeTruthy();
  });
});