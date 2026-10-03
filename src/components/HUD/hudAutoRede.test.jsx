import { describe, expect, it, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import HUD from "./HUD.jsx";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";

/**
 * Os botoes do HUD precisam falar com o SERVIDOR quando online.
 *
 * O botao do auto de cacar perto ja fazia isso. O da missao nao:
 * chamava `engineRef.current.focusQuest` direto, e o motor do
 * cliente nao tem sessao nem simula. O clique morria ali, e a tela
 * mostrava o estado certo de um pedido que nunca tinha sido feito.
 *
 * Estos testes clicam de verdade e olham o que foi enviado.
 */
const classe = CHARACTER_CLASSES.find((c) => c.id === "warrior");

/**
 * O painel minimo com a missao principal visivel.
 *
 * A forma e a mesma que o proprio `HUD.test.jsx` usa, com o que o
 * HUD precisa para desenhar: os numeros do personagem, as faixas de
 * skill e o bloco de missoes. Sem `statusEffects` o `BuffStrip`
 * estoura no primeiro render e o teste nem chega no clique.
 */
const snapshot = () => ({
  time: 0,
  autoPlay: false,
  engaged: false,
  player: {
    id: "p_ana",
    name: "Ana",
    className: "Warrior",
    level: 1,
    hp: 980,
    maxHp: 1400,
    resource: 40,
    maxResource: 100,
    resourceName: "Chi",
    shield: 0,
    attack: 82,
    defense: 42,
    speed: 165,
    casting: false,
    castingName: null,
    statusEffects: [],
  },
  cooldowns: {},
  selectedTarget: null,
  message: null,

  quests: {
    auto: { enabled: false, objectiveId: null, quest: null },
    main: {
      index: 0,
      total: 3,
      done: false,

      // o `QuestPanel` le `steps`, e sem a lista ele estoura no
      // primeiro render do painel - que e onde mora o botao AUTO
      steps: [
        {
          id: "missao_1",
          name: "Primeira passada",
          summary: "Cace slimes",
          type: "hunt",
          count: 3,
          progress: 0,
          state: "active",
        },
      ],
      current: {
        id: "missao_1",
        name: "Primeira passada",
        summary: "Cace slimes",
        autoCompletable: true,
        progress: 0,
        count: 3,
        target: "slime",
      },
    },
    side: { current: null, available: [] },
  },
});

const intencao = () => ({
  alternarAutoPlay: vi.fn(),
  alternarAutoMissao: vi.fn(),
  focarMissao: vi.fn(),
  aceitarMissaoSecundaria: vi.fn(),
  abandonarMissaoSecundaria: vi.fn(),
  resgatarRecompensaMissao: vi.fn(),
  cacarCriatura: vi.fn(),
  pararCacada: vi.fn(),
  atacar: vi.fn(),
  limparAlvos: vi.fn(),
  marcarAuto: vi.fn(),
});

const renderHud = (props = {}) => {
  const net = intencao();
  const flagsLocais = new Map();
  const engine = {
    focusQuest: vi.fn(),
    toggleQuestAuto: vi.fn(),
    acceptSideQuest: vi.fn(),
    abandonSideQuest: vi.fn(),
    claimQuestReward: vi.fn(),
    toggleBestiaryAuto: vi.fn(),
    clearBestiaryAuto: vi.fn(),
    getSkillAuto: vi.fn((skillId) => Boolean(flagsLocais.get(skillId))),
    setSkillAuto: vi.fn((skillId, enabled) => {
      if (enabled) flagsLocais.set(skillId, true);
      else flagsLocais.delete(skillId);

      return Boolean(enabled);
    }),
  };

  const painel = { ...snapshot(), ...(props.painel ?? {}) };

  const utils = render(
    <HUD
      classDefinition={classe}
      characterName="Ana"
      snapshot={painel}
      engineRef={{ current: engine }}
      intencao={props.semRede ? null : net}
    />,
  );

  return { ...utils, net, engine, flagsLocais, painel };
};

afterEach(cleanup);

/**
 * Abre o painel de missoes, que e onde mora o botao "AUTO".
 *
 * O tracker da HUD e um botao so: ele ESCOLHE a missao. O que liga
 * e desliga o auto da missao fica no painel, e o caminho e o mesmo
 * que o jogador faz - abrir o painel e clicar.
 */
const abrirPainelDeMissoes = (container) => {
  const cabecalho = container.querySelector(
    ".qst-tracker__head",
  );

  expect(cabecalho).toBeTruthy();

  // dentro de `act`: o clique abre o painel por estado do React, e
  // fora dele o painel ainda nao esta no DOM quando a gente procura
  // o botao
  act(() => {
    cabecalho.click();
  });
};

const botaoAutoDaMissao = (container) =>
  container.querySelector(".qst-auto");

/**
 * Arrasta o slot para baixo, que e o gesto de colocar em auto.
 *
 * O `SkillSlot` so comeca a arrastar depois do deadzone, e so
 * decide no `pointerup`, entao os tres eventos tem de andar juntos
 * e o offset precisa passar do limiar de 22px.
 */
const arrastarParaBaixo = (slot) => {
  const base = { pointerId: 1, bubbles: true, clientX: 0 };

  // o jsdom nao tem `PointerEvent`, e o `SkillSlot` so escuta
  // `pointerdown/move/up`. um `MouseEvent` com o `clientY` chega no
  // mesmo caminho, com a vantagem de trazer `button` e `buttons` que
  // o `setPointerCapture` olha
  const evento = (tipo, clientY) =>
    new MouseEvent(tipo, { ...base, clientY });

  act(() => {
    slot.dispatchEvent(evento("pointerdown", 0));
    slot.dispatchEvent(evento("pointermove", 60));
    slot.dispatchEvent(evento("pointerup", 60));
  });
};

/** A linha do tracker: o clique nela ESCOLHE a missao. */
const linhaDoTracker = (container) =>
  container.querySelector(".qst-tracker__row.is-clickable");

describe("o botao de auto da missao vai para o servidor", () => {
  it("online, o botao AUTO do painel vira um pedido", () => {
    const { container, net, engine } = renderHud();

    abrirPainelDeMissoes(container);

    const botao = botaoAutoDaMissao(container);
    expect(botao).toBeTruthy();

    act(() => {
      botao.click();
    });

    // o pedido foi para a rede
    expect(net.alternarAutoMissao).toHaveBeenCalled();

    // e o motor do cliente NAO foi chamado. se fosse, o clique
    // entraria num motor sem sessao e morreria sem efeito
    expect(engine.toggleQuestAuto).not.toHaveBeenCalled();
  });

  it("online, escolher a missao no tracker vira um pedido", () => {
    const { container, net, engine } = renderHud();

    const linha = linhaDoTracker(container);
    expect(linha).toBeTruthy();

    act(() => {
      linha.click();
    });

    // o id da missao foi junto: sem ele o servidor nao saberia
    // qual missao o jogador escolheu
    expect(net.focarMissao).toHaveBeenCalledWith("missao_1");
    expect(engine.focusQuest).not.toHaveBeenCalled();
  });

  it("offline, o botao AUTO continua chamando o motor da tela", () => {
    const { container, net, engine } = renderHud({ semRede: true });

    abrirPainelDeMissoes(container);

    const botao = botaoAutoDaMissao(container);

    act(() => {
      botao.click();
    });

    // o single player nao pode perder o caminho offline
    expect(engine.toggleQuestAuto).toHaveBeenCalled();
    expect(net.alternarAutoMissao).not.toHaveBeenCalled();
  });

  it("offline, escolher a missao continua chamando o motor da tela", () => {
    const { container, net, engine } = renderHud({ semRede: true });

    act(() => {
      linhaDoTracker(container).click();
    });

    expect(engine.focusQuest).toHaveBeenCalledWith("missao_1");
    expect(net.focarMissao).not.toHaveBeenCalled();
  });

  it("o botao de cacar perto continua indo para a rede", () => {
    const { container, net } = renderHud();

    const botao = container.querySelector(".hud-ability");
    expect(botao).toBeTruthy();

    act(() => {
      botao.click();
    });

    expect(net.alternarAutoPlay).toHaveBeenCalled();
  });
});

/**
 * A missao SECUNDARIA parou de aparecer na caixa depois da migracao.
 *
 * O botao "aceitar" chamava `engineRef.current.acceptSideQuest`
 * direto, sem `intencao`. Online o motor da tela nao tem sessao nem
 * simula: o clique morria ali, o servidor nunca soube da missao, e
 * o proximo painel voltava com `side.current: null`.
 *
 * O caminho offline precisa continuar igual, entao os dois lados
 * sao testados.
 */
describe("a missao secundaria vai para o servidor", () => {
  const SECUNDARIA = {
    id: "side_brejo",
    name: "Limpeza no Brejo",
    summary: "Va ao Brejo e abata 10 limos",
    count: 10,
    target: "slime",
    location: "brejo",
    done: false,
    active: false,
  };

  /** A recompensa da secundaria: moedas, xp e um item. */
  const RECOMPENSA = {
    coins: 90,
    xp: 80,
    items: [{ itemId: "slime_core", count: 3 }],
  };

  /**
   * O painel com uma secundaria disponivel.
   *
   * `quests` mora DENTRO do painel: e o que a HUD passa para o
   * `QuestPanel` e para o tracker da caixa.
   */
  const comSecundaria = () => ({
    quests: {
      ...snapshot().quests,
      side: {
        activeId: null,
        completed: 0,
        current: null,
        available: [SECUNDARIA],
      },
    },
  });

  /** O painel com uma secundaria JA aceita, em andamento. */
  const comSecundariaAtiva = () => ({
    quests: {
      ...snapshot().quests,
      side: {
        activeId: SECUNDARIA.id,
        completed: 0,
        current: { ...SECUNDARIA, progress: 4, active: true },
        available: [{ ...SECUNDARIA, active: true }],
      },
    },
  });

  /**
   * O painel com uma secundaria CONCLUIDA e a recompensa nao paga.
   *
   * `claimable` e o que o `QuestLog` devolve depois do resgate: a
   * lista das recompensas esperando o clique
   */
  const comSecundariaConcluida = () => ({
    quests: {
      ...snapshot().quests,
      claimable: [
        {
          id: SECUNDARIA.id,
          scope: "side",
          name: SECUNDARIA.name,
          summary: SECUNDARIA.summary,
          rewards: RECOMPENSA,
        },
      ],
      side: {
        activeId: null,
        completed: 1,
        current: null,
        available: [
          { ...SECUNDARIA, done: true, claimable: true, rewards: RECOMPENSA },
        ],
      },
    },
  });

  /** Abre o painel e vai na aba das secundarias, como o jogador. */
  const abrirAbaSecundaria = (container) => {
    abrirPainelDeMissoes(container);

    const aba = [...container.querySelectorAll(".qst-tab")].find(
      (botao) => botao.getAttribute("title")?.includes("secund"),
    );

    expect(aba).toBeTruthy();

    act(() => {
      aba.click();
    });
  };

  const botaoAceitar = (container) =>
    container.querySelector(".qst-action--accept");

  it("online, aceitar vira pedido e nao mexe no motor da tela", () => {
    const { container, net, engine } = renderHud({
      painel: comSecundaria(),
    });

    abrirAbaSecundaria(container);

    const botao = botaoAceitar(container);
    expect(botao).toBeTruthy();

    act(() => {
      botao.click();
    });

    // o id da missao foi junto, senao o servidor nao saberia qual
    expect(net.aceitarMissaoSecundaria).toHaveBeenCalledWith(
      SECUNDARIA.id,
    );

    // e o motor do cliente NAO foi chamado
    expect(engine.acceptSideQuest).not.toHaveBeenCalled();
  });

  it("online, abandonar vira pedido", () => {
    const { container, net, engine } = renderHud({
      painel: comSecundariaAtiva(),
    });

    abrirAbaSecundaria(container);

    const botao = container.querySelector(".qst-action--abandon");
    expect(botao).toBeTruthy();

    act(() => {
      botao.click();
    });

    expect(net.abandonarMissaoSecundaria).toHaveBeenCalled();
    expect(engine.abandonSideQuest).not.toHaveBeenCalled();
  });

  it("offline, aceitar continua chamando o motor da tela", () => {
    const { container, net, engine } = renderHud({
      semRede: true,
      painel: comSecundaria(),
    });

    abrirAbaSecundaria(container);

    act(() => {
      botaoAceitar(container).click();
    });

    expect(engine.acceptSideQuest).toHaveBeenCalledWith(SECUNDARIA.id);
    expect(net.aceitarMissaoSecundaria).not.toHaveBeenCalled();
  });

  it("offline, abandonar continua chamando o motor da tela", () => {
    const { container, net, engine } = renderHud({
      semRede: true,
      painel: comSecundariaAtiva(),
    });

    abrirAbaSecundaria(container);

    act(() => {
      container.querySelector(".qst-action--abandon").click();
    });

    expect(engine.abandonSideQuest).toHaveBeenCalled();
    expect(net.abandonarMissaoSecundaria).not.toHaveBeenCalled();
  });

  /**
   * O [RECEBER] da recompensa.
   *
   * O caminho e o do aceite pelo mesmo motivo: gold, xp e mochila
   * estao no servidor, e o clique no motor da tela nao pagaria nada
   * online. O `questId` viaja sozinho, porque e ele que localiza a
   * recompensa — o painel nao manda quantidade nem valor
   */
  it("online, receber a recompensa vira pedido", () => {
    const { container, net, engine } = renderHud({
      painel: comSecundariaConcluida(),
    });

    abrirAbaSecundaria(container);

    const botao = container.querySelector(".qst-action--claim");

    expect(botao).toBeTruthy();

    act(() => {
      botao.click();
    });

    expect(net.resgatarRecompensaMissao).toHaveBeenCalledWith(
      SECUNDARIA.id,
    );
    expect(engine.claimQuestReward).not.toHaveBeenCalled();
  });

  it("offline, receber a recompensa chama o motor da tela", () => {
    const { container, net, engine } = renderHud({
      semRede: true,
      painel: comSecundariaConcluida(),
    });

    abrirAbaSecundaria(container);

    act(() => {
      container.querySelector(".qst-action--claim").click();
    });

    expect(engine.claimQuestReward).toHaveBeenCalledWith(
      SECUNDARIA.id,
    );
    expect(net.resgatarRecompensaMissao).not.toHaveBeenCalled();
  });

  it("a caixa desenha a secundaria ativa com a tag S", () => {
    const { container } = renderHud({ painel: comSecundariaAtiva() });

    // a linha da caixa que o jogador disse que sumiu depois do aceite
    const linha = container.querySelector(".qst-tracker__row.is-side");
    expect(linha).toBeTruthy();
    expect(linha.textContent).toContain(SECUNDARIA.name);
    expect(linha.textContent).toContain("4/10");
    expect(linha.querySelector(".qst-tracker__tag").textContent).toBe("S");
  });
});

/**
 * O "ir matar" do bestiario parou de funcionar depois da migracao.
 *
 * Mesma causa das duas anteriores: o botao chamava
 * `engineRef.current.toggleBestiaryAuto` sem `intencao`, e online o
 * motor da tela nao tem sessao nem simula. O `bestiaryTargetType` ja
 * era por sessao e o painel ja publicava `bestiaryAuto`: faltava so
 * o caminho.
 */
describe("o ir matar do bestiario vai para o servidor", () => {
  const CRIATURA = {
    id: "hunt_slime",
    creatureId: "slime",
    name: "Limo",
    icon: "🟢",
    level: 1,
    color: "#6ab04c",
    behavior: "agressivo",

    // sem `zoneId` o `EntryCard` desabilita o botao: nao ha para onde
    // levar o piloto. o painel so aceita criatura com zona conhecida
    zoneId: "brejo",
    zoneName: "Brejo",

    kills: 0,
    required: 5,
    done: false,
    hunts: [
      {
        id: "hunt_slime",
        creatureId: "slime",
        name: "Limo",
        required: 5,
        progress: 0,
        done: false,
      },
    ],
  };

  const comBestiario = () => ({
    bestiary: { completed: 0, bonus: [], entries: [CRIATURA] },
  });

  /** Abre o painel do bestiario pelo botao da HUD. */
  const abrirBestiario = (container) => {
    const botao = container.querySelector(".hud-btn--bestiary");
    expect(botao).toBeTruthy();

    act(() => {
      botao.click();
    });
  };

  it("online, Ir matar vira pedido com a criatura", () => {
    const { container, net, engine } = renderHud({
      painel: comBestiario(),
    });

    abrirBestiario(container);

    const botao = container.querySelector(".bst-entry__go");
    expect(botao).toBeTruthy();
    expect(botao.textContent).toBe("Ir matar");

    act(() => {
      botao.click();
    });

    // o id da criatura foi junto, senao o servidor nao saberia o que
    // caçar
    expect(net.cacarCriatura).toHaveBeenCalledWith(CRIATURA.creatureId);

    // e o motor do cliente NAO foi chamado
    expect(engine.toggleBestiaryAuto).not.toHaveBeenCalled();
  });

  it("online, a caixa de cacada manda Parar pela rede", () => {
    const { container, net, engine } = renderHud({
      painel: {
        ...comBestiario(),
        bestiaryAuto: {
          creatureId: CRIATURA.creatureId,
          name: CRIATURA.name,
          icon: CRIATURA.icon,
          color: CRIATURA.color,
          zoneId: "brejo",
          zoneName: "Brejo",
          kills: 0,
          required: 5,
        },
      },
    });

    const caixa = container.querySelector(".bst-auto");
    expect(caixa).toBeTruthy();
    expect(caixa.textContent).toContain("Caçando Limo");

    act(() => {
      caixa.click();
    });

    expect(net.pararCacada).toHaveBeenCalled();
    expect(engine.clearBestiaryAuto).not.toHaveBeenCalled();
  });

  it("online, a criatura em cacada mostra Parar no lugar de Ir matar", () => {
    const { container } = renderHud({
      painel: {
        ...comBestiario(),
        bestiaryAuto: {
          creatureId: CRIATURA.creatureId,
          name: CRIATURA.name,
          icon: CRIATURA.icon,
          color: CRIATURA.color,
          zoneId: "brejo",
          zoneName: "Brejo",
          kills: 0,
          required: 5,
        },
      },
    });

    abrirBestiario(container);

    const botao = container.querySelector(".bst-entry__go");
    expect(botao.textContent).toBe("Parar");

    // o `BestiaryPanel` recebe `hunting` do painel, entao o botao
    // vira interruptor pela MESMA criatura
    expect(botao.closest(".bst-entry").className).toContain("is-hunting");
  });

  it("offline, Ir matar continua chamando o motor da tela", () => {
    const { container, net, engine } = renderHud({
      semRede: true,
      painel: comBestiario(),
    });

    abrirBestiario(container);

    act(() => {
      container.querySelector(".bst-entry__go").click();
    });

    expect(engine.toggleBestiaryAuto).toHaveBeenCalledWith(
      CRIATURA.creatureId,
    );
    expect(net.cacarCriatura).not.toHaveBeenCalled();
  });

  it("offline, Parar continua chamando o motor da tela", () => {
    const { container, net, engine } = renderHud({
      semRede: true,
      painel: {
        ...comBestiario(),
        bestiaryAuto: {
          creatureId: CRIATURA.creatureId,
          name: CRIATURA.name,
          icon: CRIATURA.icon,
          color: CRIATURA.color,
          zoneId: "brejo",
          zoneName: "Brejo",
          kills: 0,
          required: 5,
        },
      },
    });

    act(() => {
      container.querySelector(".bst-auto").click();
    });

    expect(engine.clearBestiaryAuto).toHaveBeenCalled();
    expect(net.pararCacada).not.toHaveBeenCalled();
  });
});

/**
 * O sintoma reportado: arrastar a skill para baixo LIGAVA o auto,
 * mas a skill nao acendia nada.
 *
 * A causa era dupla. Online o arrasto e so um pedido, e o HUD
 * devolvia antes de tocar no estado local, entao a skill ficava
 * cinza mesmo com o auto funcionando. E o painel nao carregava as
 * flags, entao nao havia de onde a tela saber.
 */
describe("a skill arrastada para auto mostra o AUTO", () => {
  const skill = classe.skills[0];

  /** Os slots da barra, na ordem em que a HUD os desenha. */
  const slots = (container) =>
    [...container.querySelectorAll(".skill-slot")];

  const emAuto = (container) =>
    slots(container).map((slot) => slot.classList.contains("is-auto"));

  it("online, a skill acende quando o painel traz a flag", () => {
    const { container } = renderHud({
      painel: { skillAuto: [skill.id] },
    });

    // a skill arrastada esta acesa, e a ultimate nunca entra: ela
    // nao tem `is-auto` por decisao de design
    expect(emAuto(container).at(0)).toBe(true);
    expect(emAuto(container).filter(Boolean)).toHaveLength(1);
  });

  it("online, a skill apagada no painel apaga a sinalizacao", () => {
    const { container } = renderHud({ painel: { skillAuto: [] } });

    expect(emAuto(container).some(Boolean)).toBe(false);
  });

  it("online, arrastar vira pedido e nao mexe no estado local", () => {
    const { container, net, engine } = renderHud();

    const alvo = slots(container).at(0);

    act(() => {
      arrastarParaBaixo(alvo);
    });

    // o pedido foi para o servidor
    expect(net.marcarAuto).toHaveBeenCalledWith(skill.id, true);

    // e o motor do cliente NAO foi mexido, como nos outros botoes
    expect(engine.setSkillAuto).not.toHaveBeenCalled();

    // sem a resposta do painel, a skill continua apagada. o HUD
    // nao pode inventar estado que o servidor ainda nao confirmou
    expect(emAuto(container).at(0)).toBe(false);
  });

  it("online, a skill acende assim que o painel responde", () => {
    const painel = snapshot();

    const { container, net, rerender } = renderHud({
      painel: { skillAuto: [] },
    });

    arrastarParaBaixo(slots(container).at(0));
    expect(net.marcarAuto).toHaveBeenCalled();

    // o painel volta com a flag
    act(() => {
      rerender(
        <HUD
          classDefinition={classe}
          characterName="Ana"
          snapshot={{ ...painel, skillAuto: [skill.id] }}
          engineRef={{ current: { getSkillAuto: () => false } }}
          intencao={intencao()}
        />,
      );
    });

    expect(emAuto(container).at(0)).toBe(true);
  });

  it("offline, arrastar acende na hora pelo motor da tela", () => {
    const { container, engine } = renderHud({ semRede: true });

    const alvo = slots(container).at(0);

    expect(emAuto(container).at(0)).toBe(false);

    act(() => {
      arrastarParaBaixo(alvo);
    });

    // offline nao ha painel: o motor e a fonte, e a tela acende
    // na hora como sempre foi
    expect(engine.setSkillAuto).toHaveBeenCalledWith(skill.id, true);
    expect(emAuto(container).at(0)).toBe(true);
  });
});
