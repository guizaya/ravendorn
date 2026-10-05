import {
  afterEach,
  describe,
  expect,
  it,
  beforeEach,
  vi,
} from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { MAIN_QUESTS, getSideIdFor } from "../../data/quests/index.js";
import HUD from "./HUD.jsx";

const classe = CHARACTER_CLASSES.find((c) => c.id === "warrior");

const painel = (quests) => ({
  time: 0,
  autoPlay: false,
  engaged: false,
  player: {
    id: "p_ana",
    name: "Ana",
    className: "Warrior",
    level: 3,
    hp: 70,
    maxHp: 100,
    resource: 100,
    maxResource: 100,
    resourceName: "Foco",
    shield: 0,
    xp: 30,
    xpToNext: 100,
    x: MAP_1.spawn.x,
    y: MAP_1.spawn.y,
    skills: [],
    statusEffects: [],
    cooldowns: {},
  },
  quests,
});

const MISSOES = {
  main: {
    index: 0,
    total: MAIN_QUESTS.length,
    done: false,
    current: {
      id: MAIN_QUESTS[0].id,
      name: MAIN_QUESTS[0].name,
      type: "hunt",
      summary: MAIN_QUESTS[0].summary,
      count: MAIN_QUESTS[0].count,
      progress: 3,
      autoCompletable: true,
    },
    steps: [],
  },
  side: {
    available: [],
    current: null,
    completed: 0,
  },
  auto: { enabled: false, objectiveId: null, quest: null },
  claimable: [],
};

/** A box da esquerda, e nao a tela toda: `Nv.3` aparece duas vezes. */
const box = () => within(document.querySelector(".qst-tracker"));

function renderizar(snapshot) {
  return render(
    <HUD
      classDefinition={classe}
      characterName="Ana"
      snapshot={snapshot}
      engineRef={{ current: null }}
      intencao={null}
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "requestAnimationFrame",
    (fn) => setTimeout(fn, 0),
  );
});

/**
 * O DOM e limpo entre os testes.
 *
 * A config do projeto roda com `globals: false`, e o cleanup automatico do
 * testing-library so acontece quando os globals do vitest estao ligados.
 * Sem isso a HUD do teste anterior continua no documento e o
 * `querySelector(".qst-tracker")` acha a box velha
 */
afterEach(() => {
  cleanup();
});

/**
 * A BOX DE MISSOES NUNCA SAI.
 *
 * ## O DEFEITO
 *
 * O `QuestTracker` tinha `if (!main && !side) return null`. Era a unica
 * coisa da tela capaz de sumir sozinha, e sumia quando o snapshot nao
 * trazia `quests` — e um snapshot assim acontece no instante entre a
 * morte do personagem e o proximo pacote do servidor
 *
 * E o pior tipo de sumir: a box e a unica pista de onde ir quando o
 * jogador acaba de morrer. Ele volta, olha a tela para se orientar, e a
 * unica coisa que responderia "va para o Pantano" esta ausente
 */
describe("a box de missoes nunca some", () => {
  it("esta de pe com a principal em andamento", () => {
    renderizar(painel(MISSOES));

    expect(box().getByText("Nv.3")).toBeTruthy();
    expect(box().getByText(MAIN_QUESTS[0].name)).toBeTruthy();
  });

  it("continua de pe quando nao ha missao nenhuma", () => {
    renderizar(
      painel({
        main: { ...MISSOES.main, current: null },
        side: MISSOES.side,
        auto: MISSOES.auto,
        claimable: [],
      }),
    );

    // o cabecalho com nivel e XP e o que vale sempre
    expect(box().getByText("Nv.3")).toBeTruthy();

    // e o aviso ocupa o lugar da lista
    expect(box().getByText("Nenhuma missão ativa")).toBeTruthy();
  });

  it("continua de pe com o snapshot sem `quests`", () => {
    /**
     * O caso que reproduz o defeito: o pacote chega sem o campo. A box
     * nao pode depender de ele para existir
     */
    renderizar(painel(undefined));

    expect(box().getByText("Nv.3")).toBeTruthy();

    expect(box().getByText("Nenhuma missão ativa")).toBeTruthy();
  });

  it("continua de pe com o snapshot inteiro nulo", () => {
    /**
     * O primeiro pacote, ou o instante entre a morte e o proximo
     */
    renderizar(null);

    expect(box().getByText("Nenhuma missão ativa")).toBeTruthy();
  });

  it("volta a mostrar a missao quando o snapshot volta", () => {
    const { rerender } = renderizar(painel(undefined));

    expect(box().getByText("Nenhuma missão ativa")).toBeTruthy();

    rerender(
      <HUD
        classDefinition={classe}
        characterName="Ana"
        snapshot={painel(MISSOES)}
        engineRef={{ current: null }}
        intencao={null}
      />,
    );

    expect(box().getByText(MAIN_QUESTS[0].name)).toBeTruthy();
  });

  it("a secundaria ativa aparece junto com a principal", () => {
    renderizar(
      painel({
        ...MISSOES,
        side: {
          available: [],
          current: {
            id: getSideIdFor(MAIN_QUESTS[0].id),
            name: "Caminho curto",
            type: "kill",
            summary: "mate 5",
            count: 5,
            progress: 2,
            autoCompletable: true,
          },
          completed: 0,
        },
      }),
    );

    expect(box().getByText(MAIN_QUESTS[0].name)).toBeTruthy();
    expect(box().getByText("Caminho curto")).toBeTruthy();
  });
});