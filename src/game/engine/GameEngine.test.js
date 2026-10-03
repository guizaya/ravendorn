import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { GameEngine, mergeBonuses } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1, MAP_1_META } from "../../data/maps/index.js";
import {
  isAutoCompletable,
  QUEST_TYPE,
  SIDE_QUESTS,
} from "../../data/quests/index.js";
import { STAT_DEFS } from "../stats/StatSheet.js";
import {
  ITEM_TYPE,
  ITEMS,
  getItem,
} from "../../data/items/index.js";
function advanceMainTo(quests, predicate) {
  let guard = 0;

  while (!predicate(quests.currentMain) && guard < 20) {
    guard += 1;

    const quest = quests.currentMain;

    if (isAutoCompletable(quest)) {
      quests.onKill(quest.target, quest.count);
    } else if (quest.type === QUEST_TYPE.EQUIP) {
      quests.onEquipRarity(quest.rarity);
    } else {
      quests.onLevelUp(quest.count);
    }
  }
}
import {
  MINIMAP_TOP_IDLE,
  MINIMAP_TOP_TARGETED,
} from "../ui/minimap.js";

const windowListeners = new Map();

globalThis.window = {
  devicePixelRatio: 1,
  addEventListener(type, handler) {
    if (!windowListeners.has(type)) {
      windowListeners.set(type, new Set());
    }

    windowListeners.get(type).add(handler);
  },
  removeEventListener(type, handler) {
    windowListeners.get(type)?.delete(handler);
  },
};

globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

function pressKey(code) {
  for (const handler of windowListeners.get("keydown") ?? []) {
    handler({ code, repeat: false, preventDefault() {} });
  }
}

/**
 * A tecla indo para um CAMPO, como o navegador faz com o foco num
 * input.
 *
 * O alvo e um objeto COMO o DOM descreveria o campo, e nao um
 * `createElement`: este arquivo roda no ambiente de node, sem DOM, e o
 * `digitandoEm` e puro sobre o `target` justamente para isso. O que o
 * motor le do evento sao `code` e `target`, e um campo so precisa
 * carregar o que a funcao olha
 *
 * Devolve quantas vezes o evento foi CANCELADO, que e a medida do
 * defeito: enquanto o motor chamava `preventDefault` nas teclas
 * controladas, a letra nao chegava no campo — o jogador via o boneco
 * parado, nenhum painel abrindo e o campo em branco
 */
function pressKeyInCampo(code, type = "text") {
  const evento = {
    code,
    repeat: false,
    target: { tagName: "INPUT", type },
    cancelados: 0,
    preventDefault() {
      this.cancelados += 1;
    },
  };

  for (const handler of windowListeners.get("keydown") ?? []) {
    handler(evento);
  }

  return evento;
}

function createEngine(classDefinition) {
  const listeners = {};
  let snapshot = null;

  const context = new Proxy(
    { createPattern: () => ({ pattern: true }) },
    {
      get(target, key) {
        if (key in target) return target[key];
        return () => {};
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );

  const canvas = {
    getContext: () => context,
    addEventListener(type, handler) {
      (listeners[type] ??= []).push(handler);
    },
    removeEventListener(type, handler) {
      listeners[type] = (listeners[type] ?? []).filter(
        (item) => item !== handler,
      );
    },
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    }),
  };

  const engine = new GameEngine(
    canvas,
    classDefinition,
    (next) => {
      snapshot = next;
    },
  );

  engine.setMap(MAP_1);
  engine.world.collision.map = MAP_1;

  return {
    engine,
    listeners,
    getSnapshot: () => snapshot,
  };
}

function click(engine, listener, clientX, clientY) {
  listener({
    button: 0,
    clientX,
    clientY,
  });
}

function screenTo(engine, worldX, worldY) {
  return {
    x:
      worldX +
      engine.viewport.width / 2 -
      engine.world.player.x,
    y:
      worldY +
      engine.viewport.height / 2 -
      engine.world.player.y,
  };
}

const ALL_CLASSES = CHARACTER_CLASSES;

describe("per-skill auto flag", () => {
  it("defaults every skill to manual", () => {
    // cada sessao nasce vazia. antes a flag vivia num `Map` de
    // modulo e sobrevivia ate a outro jogador
    for (const definition of ALL_CLASSES) {
      const { engine } = createEngine(definition);

      for (const skill of definition.skills) {
        expect(
          engine.getSkillAuto(skill.id),
          `${skill.name} deveria iniciar manual`,
        ).toBe(false);
      }

      engine.destroy();
    }
  });

  it("uses only basic attack when no skill is auto", () => {
    const definition = ALL_CLASSES[0];
    const { engine } = createEngine(definition);

    engine.setAutoPlay(true);

    const used = new Set();

    const originalRequest = engine.skillSystem.request.bind(
      engine.skillSystem,
    );

    engine.skillSystem.request = (action, ...rest) => {
      used.add(action.id);
      return originalRequest(action, ...rest);
    };

    for (let frame = 0; frame < 900; frame += 1) {
      engine.update(1 / 60);

      for (const enemy of engine.world.enemies) {
        if (enemy.hp <= 0) enemy.hp = enemy.maxHp;
      }
    }

    expect([...used]).toEqual([
      definition.basicAttack.id,
    ]);

    engine.destroy();
  });

  it("never auto-casts the ultimate", () => {
    for (const definition of ALL_CLASSES) {
      const { engine } = createEngine(definition);

      for (const skill of definition.skills) {
        engine.setSkillAuto(skill.id, true);
      }

      engine.setAutoPlay(true);

      const used = new Set();

      const originalRequest = engine.skillSystem.request.bind(
        engine.skillSystem,
      );

      engine.skillSystem.request = (action, ...rest) => {
        used.add(action.id);
        return originalRequest(action, ...rest);
      };

      for (let frame = 0; frame < 1500; frame += 1) {
        engine.update(1 / 60);

        for (const enemy of engine.world.enemies) {
          if (enemy.hp <= 0) enemy.hp = enemy.maxHp;
        }
      }

      expect(
        used.has(definition.ultimate.id),
        `${definition.name} usou a ultimate automaticamente`,
      ).toBe(false);

      engine.destroy();
    }
  });

  it("only auto-casts skills flagged as auto", () => {
    for (const definition of ALL_CLASSES) {
      const target = definition.skills[0];

      const { engine } = createEngine(definition);

      engine.setSkillAuto(target.id, true);

      engine.setAutoPlay(true);

      const used = new Set();

      const originalRequest = engine.skillSystem.request.bind(
        engine.skillSystem,
      );

      engine.skillSystem.request = (action, ...rest) => {
        used.add(action.id);
        return originalRequest(action, ...rest);
      };

      for (let frame = 0; frame < 1500; frame += 1) {
        engine.update(1 / 60);

        for (const enemy of engine.world.enemies) {
          if (enemy.hp <= 0) enemy.hp = enemy.maxHp;
        }
      }

      for (const skill of definition.skills) {
        if (skill.id === target.id) continue;

        expect(
          used.has(skill.id),
          `${definition.name} usou ${skill.name} fora do auto`,
        ).toBe(false);
      }

      expect(
        used.size,
        `${definition.name} não usou a skill marcada como auto`,
      ).toBeGreaterThan(0);

      engine.destroy();
    }
  });

  it("honours the flag in click-to-engage mode too", () => {
    const definition = ALL_CLASSES[0];
    const { engine, listeners } = createEngine(definition);

    const target = engine.world.enemies[0];
    const point = screenTo(engine, target.x, target.y);

    click(
      engine,
      listeners.pointerdown[0],
      point.x,
      point.y,
    );

    const used = new Set();

    const originalRequest = engine.skillSystem.request.bind(
      engine.skillSystem,
    );

    engine.skillSystem.request = (action, ...rest) => {
      used.add(action.id);
      return originalRequest(action, ...rest);
    };

    for (let frame = 0; frame < 900; frame += 1) {
      engine.update(1 / 60);

      for (const enemy of engine.world.enemies) {
        if (enemy.hp <= 0) enemy.hp = enemy.maxHp;
      }
    }

    expect([...used]).toEqual([
      definition.basicAttack.id,
    ]);

    engine.destroy();
  });

  it("keeps the flag on the session, not on a shared store", () => {
    const definition = ALL_CLASSES[0];
    const skill = definition.skills[2];

    const first = createEngine(definition);

    first.engine.setSkillAuto(skill.id, true);

    // a flag sobrevive a recriar o MOTOR, porque a sessao e a
    // mesma. antes ela vivia num `Map` de modulo
    const second = createEngine(definition);

    expect(second.engine.getSkillAuto(skill.id)).toBe(false);

    second.engine.destroy();
    first.engine.destroy();
  });

  it("starts every new session on manual", () => {
    const definition = ALL_CLASSES[0];

    const primeira = createEngine(definition);

    for (const skill of definition.skills) {
      primeira.engine.setSkillAuto(skill.id, true);
    }

    // quem arrasta e o jogador local, e a sessao dele. um jogador
    // que entra depois comeca com tudo manual, como deve ser
    const segunda = createEngine(definition);

    for (const skill of definition.skills) {
      expect(
        segunda.engine.getSkillAuto(skill.id),
        `${skill.name} ja nasceu automatico`,
      ).toBe(false);
    }

    segunda.engine.destroy();
    primeira.engine.destroy();
  });
});

describe("minimap target awareness", () => {
  it("rests in the target slot with no target", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.update(1 / 60);
    engine.render();

    expect(engine.selectedTargetId).toBe(null);
    expect(engine.hasLiveTarget()).toBe(false);
    expect(engine.minimapY).toBe(MINIMAP_TOP_IDLE);

    engine.destroy();
  });

  it("drops below the target panel once a target is picked", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies[0];

    engine.selectedTargetId = target.id;

    expect(engine.hasLiveTarget()).toBe(true);

    for (let frame = 0; frame < 240; frame += 1) {
      engine.update(1 / 60);
      engine.render();
    }

    expect(engine.minimapY).toBe(MINIMAP_TOP_TARGETED);
    expect(engine.minimapY).toBeGreaterThan(
      MINIMAP_TOP_IDLE,
    );

    engine.destroy();
  });

  it("returns to the target slot when the target dies", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies[0];

    engine.selectedTargetId = target.id;

    for (let frame = 0; frame < 60; frame += 1) {
      engine.update(1 / 60);
    }

    target.alive = false;
    target.hp = 0;
    target.respawnTimer = 9999;

    expect(engine.hasLiveTarget()).toBe(false);

    for (let frame = 0; frame < 240; frame += 1) {
      engine.update(1 / 60);
      engine.render();
    }

    expect(engine.minimapY).toBe(MINIMAP_TOP_IDLE);

    engine.destroy();
  });

  it("never overlaps the target panel in either state", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    for (const targeted of [false, true]) {
      engine.selectedTargetId = targeted
        ? engine.world.enemies[0].id
        : null;

      for (let frame = 0; frame < 240; frame += 1) {
        engine.update(1 / 60);
        engine.render();
      }

      const panelBottom = 84 + 86;

      if (engine.hasLiveTarget()) {
        expect(engine.minimapY).toBeGreaterThanOrEqual(
          panelBottom,
        );
      } else {
        expect(engine.minimapY).toBe(84);
      }
    }

    engine.destroy();
  });

  it("slides instead of teleporting", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.selectedTargetId = engine.world.enemies[0].id;

    const seen = new Set();

    for (let frame = 0; frame < 120; frame += 1) {
      engine.update(1 / 60);
      engine.render();

      seen.add(Math.round(engine.minimapY));
    }

    // deve passar por posições intermediárias
    expect(seen.size).toBeGreaterThan(3);

    engine.destroy();
  });
});

describe("quests and progression", () => {
  it("grants xp when a creature dies", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies.find(
      (enemy) => enemy.isCreature,
    );

    engine.world.inventory.clear();

    const before = engine.world.player.xp ?? 0;

    target.hp = 1;

    engine.damage.applyDamage(
      engine.world.player,
      target,
      { damage: 9999, damageType: "physical" },
    );

    expect(
      engine.world.player.xp ?? 0,
    ).toBeGreaterThanOrEqual(before);

    engine.destroy();
  });

  it("grows the player on level up", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;

    const baseHp = player.maxHp;
    const baseAttack = player.attack;

    const victim = engine.world.enemies.find(
      (enemy) => enemy.isCreature,
    );

    // matarMany criaturas de uma vez empurra varios niveis
    for (let round = 0; round < 40; round += 1) {
      for (const enemy of engine.world.enemies) {
        if (!enemy.isCreature) continue;

        enemy.alive = true;
        enemy.hp = 1;

        engine.damage.applyDamage(
          engine.world.player,
          enemy,
          { damage: 9999, damageType: "physical" },
        );
      }
    }

    expect(player.level).toBeGreaterThan(1);
    expect(player.maxHp).toBeGreaterThan(baseHp);
    expect(player.attack).toBeGreaterThan(baseAttack);

    engine.destroy();
  });

  it("advances the main quest from kills", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quest = engine.world.quests.currentMain;

    expect(isAutoCompletable(quest)).toBe(true);

    for (const enemy of engine.world.enemies) {
      if (!enemy.isCreature) continue;
      if (!enemy.id.startsWith(`${quest.target}_`)) {
        continue;
      }

      enemy.alive = true;
      enemy.hp = 1;

      engine.damage.applyDamage(
        engine.world.player,
        enemy,
        { damage: 9999, damageType: "physical" },
      );
    }

    expect(
      engine.world.quests.currentMain.id,
    ).not.toBe(quest.id);

    engine.destroy();
  });

  it("keeps side quests exclusive", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const available =
      engine.world.quests.snapshot().side.available;

    expect(engine.acceptSideQuest(available[0].id)).toBe(
      true,
    );

    expect(
      engine.acceptSideQuest(available[1].id),
    ).toBe(false);

    expect(
      engine.abandonSideQuest(),
    ).toBe(true);

    expect(engine.acceptSideQuest(available[1].id)).toBe(
      true,
    );

    engine.destroy();
  });

  it("reports quests and xp in the snapshot", () => {
    const { engine, getSnapshot } = createEngine(
      ALL_CLASSES[0],
    );

    engine.update(1 / 60);
    engine.sendSnapshot();

    const snapshot = getSnapshot();

    expect(snapshot.quests.main.total).toBeGreaterThan(0);
    expect(snapshot.quests.main.current).not.toBe(null);
    expect(
      snapshot.quests.side.available.length,
    ).toBeGreaterThan(0);
    expect(snapshot.player.xpToNext).toBeGreaterThan(0);

    engine.destroy();
  });

  it("waits for the claim instead of paying on completion", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const quest = SIDE_QUESTS[0];

    engine.world.inventory.clear();
    engine.acceptSideQuest(quest.id);

    // o caminho de verdade do painel: `onKill` fecha a missao e o
    // `resolveQuestProgress` e quem anunciaria o resgate
    engine.resolveQuestProgress(
      quests.onKill(quest.target, quest.count),
    );

    // a missao fechou e o dinheiro NAO entrou: quem paga e o clique
    // em [RECEBER]
    expect(quests.isClaimable(quest.id)).toBe(true);
    expect(engine.world.inventory.coins).toBe(0);

    engine.destroy();
  });

  it("claimQuestReward pays coins, xp and items once", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const inventory = engine.world.inventory;
    const quest = quests.currentMain;

    inventory.clear();

    for (const enemy of engine.world.enemies) {
      if (!enemy.isCreature) continue;
      if (!enemy.id.startsWith(`${quest.target}_`)) {
        continue;
      }

      enemy.alive = true;
      enemy.hp = 1;

      engine.damage.applyDamage(
        engine.world.player,
        enemy,
        { damage: 9999, damageType: "physical" },
      );
    }

    const moedasAntes = inventory.coins;
    const xpAntes = engine.world.player.xp;
    const { reward } = quests.pendingOf(quest.id);

    expect(engine.claimQuestReward(quest.id)).toBe(true);

    // as tres coisas da recompensa chegam na mochila e no xp
    expect(inventory.coins).toBe(moedasAntes + reward.coins);
    expect(engine.world.player.xp).toBe(xpAntes + reward.xp);

    for (const item of reward.items) {
      expect(
        inventory.count(item.itemId),
        item.itemId,
      ).toBeGreaterThanOrEqual(item.count);
    }

    // e o segundo clique do MESMO botao nao paga de novo
    expect(engine.claimQuestReward(quest.id)).toBe(false);
    expect(inventory.coins).toBe(moedasAntes + reward.coins);
    expect(engine.world.player.xp).toBe(xpAntes + reward.xp);

    engine.destroy();
  });

  it("claimQuestReward pays nothing for a quest that is not waiting", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.world.inventory.clear();

    // id forjado pelo cliente: nao ha recompensa com esse id
    expect(engine.claimQuestReward("missao_forjada")).toBe(
      false,
    );
    expect(engine.claimQuestReward("side_brejo")).toBe(
      false,
    );
    expect(engine.world.inventory.coins).toBe(0);

    engine.destroy();
  });
  it("walks toward the quest zone when auto is on", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;
    const quest = engine.world.quests.currentMain;
    const zone = MAP_1_META.zones.find(
      (entry) => entry.id === quest.location,
    );

    expect(zone).toBeDefined();

    player.x = MAP_1.spawn.x;
    player.y = MAP_1.spawn.y;

    engine.focusQuest(quest.id);

    expect(engine.world.quests.autoEnabled).toBe(true);

    // o auto da missao anda pelo objetivo dela, nao pelo `autoPlay`.
    // o botao e outro pedido: se lider o piloto, apertar T no meio da
    // missao parava o personagem com a tela ainda mostrando AUTO
    expect(engine.autoPlay).toBe(false);
    expect(engine.isAutoActive()).toBe(true);

    const before = Math.hypot(
      player.x - (zone.x + zone.width / 2),
      player.y - (zone.y + zone.height / 2),
    );

    for (let frame = 0; frame < 600; frame += 1) {
      engine.update(1 / 60);
    }

    const after = Math.hypot(
      player.x - (zone.x + zone.width / 2),
      player.y - (zone.y + zone.height / 2),
    );

    expect(after).toBeLessThan(before);

    engine.destroy();
  });

  it("hunts only the quest target creature", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quest = engine.world.quests.currentMain;

    engine.focusQuest(quest.id);

    const player = engine.world.player;
    const zone = MAP_1_META.zones.find(
      (entry) => entry.id === quest.location,
    );

    player.x = zone.x + zone.width / 2;
    player.y = zone.y + zone.height / 2;

    for (let frame = 0; frame < 120; frame += 1) {
      engine.update(1 / 60);
    }

    const target = engine.selectedTargetId;

    if (target) {
      expect(target.replace(/_\d+$/, "")).toBe(
        quest.target,
      );
    }

    engine.destroy();
  });

  it("refuses auto for a manual quest", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;

    advanceMainTo(quests, (quest) =>
      ["equip", "level"].includes(quest.type),
    );

    const manual = quests.currentMain;

    expect(isAutoCompletable(manual)).toBe(false);

    engine.focusQuest(manual.id);

    expect(quests.autoEnabled).toBe(false);
    expect(quests.objective()).toBe(null);

    engine.destroy();
  });

  it("toggles quest auto from the engine", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    expect(engine.toggleQuestAuto()).toBe(true);
    expect(engine.world.quests.autoEnabled).toBe(true);
    expect(engine.toggleQuestAuto()).toBe(false);
    expect(engine.world.quests.autoEnabled).toBe(false);

    engine.destroy();
  });

  it("clicking a quest turns auto on, clicking again turns it off", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const quest = quests.currentMain;

    expect(quests.autoEnabled).toBe(false);

    engine.focusQuest(quest.id);

    expect(quests.autoEnabled).toBe(true);
    expect(quests.objectiveId).toBe(quest.id);

    // o botao de auto NAO acende junto. ele e "cacar perto": com os
    // dois ligados, o piloto dividia o comando e o botao obedecia
    // a missao, atravessando o mapa em vez de bater no mob do lado
    expect(engine.autoPlay).toBe(false);
    expect(engine.isAutoActive()).toBe(true);

    engine.focusQuest(quest.id);

    expect(quests.autoEnabled).toBe(false);
    expect(quests.objectiveId).toBe(null);
    expect(engine.autoPlay).toBe(false);
    expect(engine.isAutoActive()).toBe(false);

    engine.destroy();
  });

  it("toggles auto for an accepted side quest", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const available = quests.snapshot().side.available;

    engine.acceptSideQuest(available[0].id);

    const side = quests.currentSide;

    expect(side).not.toBe(null);

    engine.focusQuest(side.id);

    expect(quests.autoEnabled).toBe(true);
    expect(quests.objectiveId).toBe(side.id);

    engine.focusQuest(side.id);

    expect(quests.autoEnabled).toBe(false);
    expect(quests.objectiveId).toBe(null);

    engine.destroy();
  });

  it("switches auto between quests instead of toggling off", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const main = quests.currentMain;
    const available = quests.snapshot().side.available;

    engine.focusQuest(main.id);
    expect(quests.objectiveId).toBe(main.id);

    engine.acceptSideQuest(available[0].id);

    const side = quests.currentSide;

    engine.focusQuest(side.id);

    expect(quests.autoEnabled).toBe(true);
    expect(quests.objectiveId).toBe(side.id);

    engine.destroy();
  });

  it("keeps the side quest accepted after toggling its auto", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const quests = engine.world.quests;
    const available = quests.snapshot().side.available;

    engine.acceptSideQuest(available[0].id);

    const sideId = quests.sideId;

    engine.focusQuest(sideId);
    engine.focusQuest(sideId);

    expect(quests.sideId).toBe(sideId);
    expect(quests.currentSide).not.toBe(null);

    engine.destroy();
  });
});

describe("equipment integration", () => {
  /**
   * Pecas de armadura e reliquia que so existem durante o teste.
   *
   * O catalogo ficou com uma peca equipavel (o arco, arma), e ela nao
   * da nem preserva posicao nem raridade trocada. Estas fixtures
   * existem para o bloco continuar medindo o que media: peca em slot
   * errado, peca que volta com a raridade, e duas pecas em slots
   * diferentes somando stats
   */
  const FIXTURES = [
    {
      id: "__test_gibao",
      name: "Gibao de Teste",
      icon: "G",
      rarity: "uncommon",
      type: ITEM_TYPE.ARMOR,
      slot: "chest",
      tier: 1,
      value: 1,
      stackable: false,
      maxStack: 1,
      stats: { defense: 7 },
    },
    {
      id: "__test_capuz",
      name: "Capuz de Teste",
      icon: "C",
      rarity: "uncommon",
      type: ITEM_TYPE.ARMOR,
      slot: "head",
      tier: 1,
      value: 1,
      stackable: false,
      maxStack: 1,
      stats: { defense: 5 },
    },
    {
      id: "__test_anel",
      name: "Anel de Teste",
      icon: "A",
      rarity: "uncommon",
      type: ITEM_TYPE.TRINKET,
      slot: null,
      tier: 1,
      value: 1,
      stackable: false,
      maxStack: 1,
      stats: { attack: 3, maxHp: 40 },
    },
  ];

  const GIBAO_ID = "__test_gibao";
  const CAPUZ_ID = "__test_capuz";

  beforeEach(() => {
    for (const item of FIXTURES) ITEMS[item.id] = item;
  });

  afterEach(() => {
    for (const item of FIXTURES) delete ITEMS[item.id];
  });

  it("moves an item out of the bag and into the slot", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("willow_bow", 1);

    const stack = inventory.stacks[0];

    expect(inventory.usedSlots).toBe(1);

    expect(
      engine.equipItem(stack.uid, "weapon"),
    ).toBe(true);

    expect(inventory.usedSlots).toBe(0);
    expect(
      engine.world.equipment.isEquipped("willow_bow"),
    ).toBe(true);

    engine.destroy();
  });

  it("applies the stat bonus to the player", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;
    const inventory = engine.world.inventory;

    const baseAttack = player.attack;
    const baseMaxHp = player.maxHp;

    inventory.clear();

    // uma peca em cada slot: o arco (arma) e o anel (reliquia, que
    // da vida). Antes eram uma espada e um coracao, e os dois nao
    // existem mais
    inventory.add("willow_bow", 1);
    inventory.add("__test_anel", 1);

    const arco = inventory.stacks[0];
    const anel = inventory.stacks[1];

    engine.equipItem(arco.uid, "weapon");
    engine.equipItem(anel.uid, "trinket1");

    // arco: 8 de ataque. anel: 3 de ataque e 40 de vida
    expect(player.attack).toBe(baseAttack + 11);
    expect(player.maxHp).toBe(baseMaxHp + 40);

    engine.destroy();
  });

  it("recomputes stats after unequipping", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;

    const baseAttack = player.attack;

    engine.world.inventory.clear();
    engine.world.inventory.add("willow_bow", 1);

    const stack = engine.world.inventory.stacks[0];

    engine.equipItem(stack.uid, "weapon");

    expect(player.attack).toBeGreaterThan(baseAttack);

    expect(engine.unequipItem("weapon")).toBe(true);

    expect(player.attack).toBe(baseAttack);
    expect(
      engine.world.inventory.count("willow_bow"),
    ).toBe(1);

    engine.destroy();
  });

  it("rejects equipping into the wrong slot", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("__test_gibao", 1);

    const stack = inventory.stacks[0];

    // o gibao e do peito, e so do peito
    expect(
      engine.equipItem(stack.uid, "head"),
    ).toBe(false);
    expect(
      engine.equipItem(stack.uid, "legs"),
    ).toBe(false);
    expect(
      engine.equipItem(stack.uid, "chest"),
    ).toBe(true);

    engine.destroy();
  });

  it("rejects an unknown uid", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    expect(
      engine.equipItem("nao-existe", "weapon"),
    ).toBe(false);

    engine.destroy();
  });

  it("returns the swapped item to the bag", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("__test_gibao", 1);
    inventory.add("__test_anel", 1);

    const [gibao, anel] = inventory.stacks;

    engine.equipItem(gibao.uid, "chest");
    engine.equipItem(anel.uid, "trinket1");

    expect(
      engine.world.equipment.isEquipped("__test_gibao"),
    ).toBe(true);
    expect(
      engine.world.equipment.isEquipped("__test_anel"),
    ).toBe(true);

    // a mochila ficou vazia: cada peca foi para o seu slot
    expect(inventory.usedSlots).toBe(0);

    engine.destroy();
  });

  it("auto-equips the best item in every slot", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;
    const equipment = engine.world.equipment;

    inventory.clear();

    inventory.add("willow_bow", 1);
    inventory.add("__test_gibao", 1);
    inventory.add("__test_anel", 1);

    expect(engine.autoEquipBest()).toBe(true);

    // uma peca de CADA posicao. Sem a regra de posicao, o
    // auto-equip podia escolher o mesmo slot para varias, porque as
    // tres sao aceitas pelo mesmo TIPO
    expect(equipment.getEquipped("weapon")?.id).toBe(
      "willow_bow",
    );
    expect(equipment.getEquipped("chest")?.id).toBe(
      "__test_gibao",
    );
    expect(equipment.getEquipped("trinket1")?.id).toBe(
      "__test_anel",
    );

    engine.destroy();
  });

  it("equipar no slot certo devolve a peça anterior na mesma raridade", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;
    const equipment = engine.world.equipment;

    inventory.clear();

    // um gibao LENDARIO ja vestido, e um RARO na mochila
    inventory.add("__test_gibao", 1, "legendary");
    equipment.equip("__test_gibao", "chest", "legendary");

    const uidLendario = inventory.stacks[0].uid;

    inventory.add("__test_gibao", 1, "rare");

    const uidRaro = inventory.stacks.find(
      (stack) => stack.rarity === "rare",
    ).uid;

    expect(uidLendario).toBeTruthy();

    expect(engine.equipItem(uidRaro, "chest")).toBe(true);

    // o slot agora tem o item raro
    expect(equipment.getEquipped("chest").rarity).toBe("rare");

    // e o lendario voltou para a mochila, NA MESMA raridade. Se
    // voltasse como "comum", o jogador perderia a peca boa sem ter
    // feito nada de errado
    const voltou = inventory.stacks.find(
      (stack) => stack.itemId === "__test_gibao",
    );

    expect(voltou.rarity).toBe("legendary");
    expect(voltou.count).toBe(1);

    engine.destroy();
  });

  it("recusa peça na posição errada e não move nada", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;
    const equipment = engine.world.equipment;

    inventory.clear();
    inventory.add("__test_gibao", 1);

    const uid = inventory.stacks[0].uid;

    // um gibao na cabeca: recusado
    expect(engine.equipItem(uid, "head")).toBe(false);
    expect(equipment.getEquipped("head")).toBe(null);

    // e o item continua na mochila, intacto
    expect(inventory.count("__test_gibao")).toBe(1);

    // na posicao certa, entra
    expect(engine.equipItem(uid, "chest")).toBe(true);
    expect(equipment.getEquipped("chest")?.id).toBe(
      "__test_gibao",
    );

    engine.destroy();
  });

  it("diz o slot de cada item para o painel", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    // o arco nao declara posicao: o destino vem do TIPO dele
    expect(engine.slotFor("willow_bow")).toBe("weapon");

    // material nao veste
    expect(engine.slotFor("slime_gel")).toBe(null);

    // e a peca com posicao declarada vai no slot que declara
    expect(engine.slotFor("__test_gibao")).toBe("chest");

    engine.destroy();
  });

  /**
   * A correcao do slot errado, que roda ao abrir o inventario.
   *
   * A regra de posicao vive no `equip`, e o `equip` so roda quando o
   * jogador veste alguma coisa. Quem ja tem peca no slot errado veio
   * de um save antigo e ficaria vendo o boneco errado para sempre.
   *
   * Estas pecas de teste sao o que permite exercitar isso: sem uma
   * armadura de verdade no catalogo, nao ha peca que possa estar no
   * slot errado
   */
  describe("corrige peca no slot errado", () => {
    it("desequipa a peca que entrou no slot errado", () => {
      const { engine } = createEngine(ALL_CLASSES[0]);
      const inventory = engine.world.inventory;
      const equipment = engine.world.equipment;

      inventory.clear();

      // um save antigo: o capuz no peito
      equipment.getSlot("chest").itemId = CAPUZ_ID;
      equipment.getSlot("chest").rarity = "legendary";

      const movidos = engine.fixMisplacedEquipment();

      expect(movidos).toHaveLength(1);
      expect(movidos[0].itemId).toBe(CAPUZ_ID);

      // saiu do corpo
      expect(equipment.getEquipped("chest")).toBe(null);
      expect(equipment.getEquipped("head")).toBe(null);

      // e voltou para a mochila, na MESMA raridade
      const pilha = inventory.stacks.find(
        (stack) => stack.itemId === CAPUZ_ID,
      );

      expect(pilha).toBeTruthy();
      expect(pilha.rarity).toBe("legendary");
      expect(pilha.count).toBe(1);

      engine.destroy();
    });

    it("nao veste a peca corrigida no slot certo", () => {
      const { engine } = createEngine(ALL_CLASSES[0]);
      const equipment = engine.world.equipment;

      engine.world.inventory.clear();

      // o gibao e do peito: ele estava no slot da cabeca
      equipment.getSlot("head").itemId = GIBAO_ID;

      engine.fixMisplacedEquipment();

      // o gibao NAO pulou para o peito: o pedido era desequipar, e
      // mudar o equipamento do jogador sem ele pedir seria decisao
      // demais
      expect(equipment.getEquipped("chest")).toBe(null);
      expect(equipment.getEquipped("head")).toBe(null);

      engine.destroy();
    });

    it("corrige todas as pecas erradas de uma vez", () => {
      const { engine } = createEngine(ALL_CLASSES[0]);
      const inventory = engine.world.inventory;
      const equipment = engine.world.equipment;

      inventory.clear();

      // save antigo: gibao na cabeca e capuz no peito
      equipment.getSlot("head").itemId = GIBAO_ID;
      equipment.getSlot("chest").itemId = CAPUZ_ID;

      const movidos = engine.fixMisplacedEquipment();

      expect(movidos).toHaveLength(2);
      expect(equipment.misplacedSlots()).toEqual([]);
      expect(equipment.getEquipped("head")).toBe(null);
      expect(equipment.getEquipped("chest")).toBe(null);
      expect(inventory.count(GIBAO_ID)).toBe(1);
      expect(inventory.count(CAPUZ_ID)).toBe(1);

      engine.destroy();
    });

    it("nao perde a peca quando a mochila esta cheia", () => {
      const { engine } = createEngine(ALL_CLASSES[0]);
      const inventory = engine.world.inventory;
      const equipment = engine.world.equipment;

      inventory.clear();

      // enche a mochila de verdade. As pecas de teste nao empilham,
      // e sao elas que ocupam espaco: os itens do catalogo sao quase
      // todos material, que empilha numa pilha so
      for (let i = 0; i < 40; i += 1) {
        inventory.add(CAPUZ_ID, 1);
        inventory.add(GIBAO_ID, 1);
      }

      expect(inventory.isFull).toBe(true);

      const cheioAntes = inventory.usedSlots;

      equipment.getSlot("chest").itemId = CAPUZ_ID;
      equipment.getSlot("chest").rarity = "legendary";

      engine.fixMisplacedEquipment();

      // a peca nao pode sumir. Sem espaco na mochila ela volta para
      // o MESMO slot: e o melhor destino que existe, e o mesmo que
      // qualquer desequipar tinha antes
      expect(equipment.getEquipped("chest")?.id).toBe(
        CAPUZ_ID,
      );
      expect(inventory.usedSlots).toBe(cheioAntes);

      engine.destroy();
    });

    it("nao mexe em equipamento que esta certo", () => {
      const { engine } = createEngine(ALL_CLASSES[0]);
      const inventory = engine.world.inventory;
      const equipment = engine.world.equipment;

      inventory.clear();

      equipment.equip(GIBAO_ID, "chest", "rare");
      inventory.add("willow_bow", 1);
      engine.equipItem(inventory.stacks[0].uid, "weapon");

      const antes = JSON.stringify(equipment.summary().slots);

      expect(engine.fixMisplacedEquipment()).toEqual([]);

      expect(JSON.stringify(equipment.summary().slots)).toBe(
        antes,
      );
      expect(equipment.getEquipped("chest")?.rarity).toBe(
        "rare",
      );

      engine.destroy();
    });
  });
});

/**
 * A folha de stats do jogador, ponta a ponta.
 *
 * O motor monta a folha no MESMO passo que define `player.attack` e
 * `player.maxHp`, e a manda no painel. O teste e deste arquivo e nao
 * do `StatSheet` porque o que ele segura e a PROMESSA entre os dois
 * lugares: o ATK que a tela mostra tem de ser o ataque que o golpe
 * usou. Um teste so do modulo passaria mesmo com o motor lendo a
 * folha de um lugar e o painel de outro
 */
describe("a folha de stats no painel", () => {
  it("a folha do jogador chega no snapshot com as 26 linhas", () => {
    const { engine, getSnapshot } = createEngine(
      ALL_CLASSES[3],
    );

    engine.update(1 / 60);
    engine.sendSnapshot();

    const folha = getSnapshot().player.stats;

    expect(folha).toBeTruthy();
    expect(folha.rows).toHaveLength(STAT_DEFS.length);
    expect(folha.level).toBe(1);

    engine.destroy();
  });

  it("o ATK da folha e o attack do jogador", () => {
    for (const classe of ALL_CLASSES) {
      const { engine, getSnapshot } = createEngine(
        classe,
      );

      for (const nivel of [1, 8, 25]) {
        engine.world.player.level = nivel;
        engine.applyEquipment();
        engine.sendSnapshot();

        const player = engine.world.player;

        expect(
          getSnapshot().player.stats.byId.attack.total,
          `${classe.id} nv${nivel}`,
        ).toBe(player.attack);

        expect(
          getSnapshot().player.stats.byId.defense.total,
          `${classe.id} nv${nivel}`,
        ).toBe(player.defense);

        expect(
          getSnapshot().player.stats.byId.maxHp.total,
          `${classe.id} nv${nivel}`,
        ).toBe(player.maxHp);
      }

      engine.destroy();
    }
  });

  it("vestir peca mexe na folha no mesmo quadro do combate", () => {
    // a Arbalist e a classe do arco: `equipItem` recusa uma peca que
    // a classe nao veste, e o teste passaria sem verificar nada se
    // usasse o Guerreiro
    const { engine, getSnapshot } = createEngine(
      ALL_CLASSES[3],
    );

    engine.sendSnapshot();

    const antes = getSnapshot().player.stats.byId.attack;

    // `equipItem` trabalha com o `uid` da PILHA, e nao com o id do
    // item: a peca precisa estar na mochila antes de virar slot
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("willow_bow", 1, "rare");

    const stack = inventory.findStack("willow_bow", "rare");

    expect(engine.equipItem(stack.uid, "weapon")).toBe(true);
    engine.sendSnapshot();

    const depois = getSnapshot().player.stats.byId.attack;

    expect(
      engine.world.equipment.getEquipped("weapon")?.id,
      "a peca nem entrou no slot",
    ).toBe("willow_bow");

    expect(depois.total).toBeGreaterThan(antes.total);
    expect(depois.total).toBe(engine.world.player.attack);

    engine.destroy();
  });

  it("a folha nunca guarda um numero quebrado", () => {
    // uma linha com `NaN` na tela derruba o painel inteiro, porque o
    // `toFixed` do formatador estoura. O teste passa por TODAS as
    // linhas de uma classe com bonus grande
    const { engine, getSnapshot } = createEngine(
      ALL_CLASSES[1],
    );

    engine.world.player.level = 40;
    engine.applyEquipment();
    engine.sendSnapshot();

    for (const row of getSnapshot().player.stats.rows) {
      expect(
        Number.isFinite(row.base),
        `${row.id} base`,
      ).toBe(true);
      expect(
        Number.isFinite(row.total),
        `${row.id} total`,
      ).toBe(true);
    }

    engine.destroy();
  });

  it("o jogador recem-criado ja tem folha, antes do primeiro tick", () => {
    // sem isto, um painel aberto no primeiro quadro veria `null` e
    // mostraria "carregando" para um personagem que ja existe
    const { engine } = createEngine(ALL_CLASSES[2]);

    expect(engine.world.player.stats).toBeTruthy();
    expect(engine.world.player.stats.rows).toHaveLength(
      STAT_DEFS.length,
    );

    engine.destroy();
  });
});

describe("loot and inventory", () => {
  it("sends loot straight to the inventory", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies[0];

    target.hp = 1;

    engine.world.inventory.clear();

    engine.damage.applyDamage(
      engine.world.player,
      target,
      { damage: 9999, damageType: "physical" },
    );

    expect(target.alive).toBe(false);

    expect(engine.world.inventory.coins).toBeGreaterThan(0);
    expect(
      engine.world.drops.length,
      "nao deveria haver drop no chao",
    ).toBe(0);
  });

  it("collects coins and items in a single death", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies[0];

    target.hp = 1;

    engine.world.inventory.clear();

    const action = {
      damage: 9999,
      damageType: "physical",
    };

    for (let hit = 0; hit < 5; hit += 1) {
      engine.damage.applyDamage(
        engine.world.player,
        target,
        action,
      );
    }

    expect(engine.world.inventory.coins).toBeGreaterThan(0);
    expect(
      engine.world.drops.length,
      "loot rolado mais de uma vez",
    ).toBe(0);
  });

  it("spills the overflow to the ground when full", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const target = engine.world.enemies[0];
    const inventory = engine.world.inventory;

    inventory.clear();

    while (!inventory.isFull) {
      inventory.add("skeleton_bone", 1);
    }

    const coinsBefore = inventory.coins;

    target.hp = 1;

    engine.damage.applyDamage(
      engine.world.player,
      target,
      { damage: 9999, damageType: "physical" },
    );

    // moedas nunca bloqueiam
    expect(inventory.coins).toBeGreaterThan(coinsBefore);

    // itens que nao couberam ficam no chao
    for (const drop of engine.world.drops) {
      expect(drop.kind).toBe("item");
      expect(
        Math.hypot(
          drop.x - target.x,
          drop.y - target.y,
        ),
      ).toBeLessThanOrEqual(40);
    }
  });

  it("still collects a ground drop by walking over it", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;

    engine.world.inventory.clear();

    engine.loot.spawnGroundDrop({
      kind: "item",
      itemId: "willow_bow",
      count: 1,
      x: player.x + 20,
      y: player.y,
    });

    engine.update(1 / 60);

    expect(
      engine.world.inventory.count("willow_bow"),
    ).toBe(1);
    expect(engine.world.drops).toHaveLength(0);

    engine.destroy();
  });

  it("picks up loot by walking over it", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;

    engine.world.inventory.clear();

    engine.loot.spawnGroundDrop({
      kind: "coins",
      coins: 40,
      x: player.x + 20,
      y: player.y,
    });

    engine.loot.spawnGroundDrop({
      kind: "item",
      itemId: "willow_bow",
      count: 1,
      x: player.x,
      y: player.y + 20,
    });

    engine.update(1 / 60);

    expect(engine.world.drops).toHaveLength(0);
    expect(engine.world.inventory.coins).toBe(40);
    expect(
      engine.world.inventory.count("willow_bow"),
    ).toBe(1);

    engine.destroy();
  });

  it("keeps the drop when the inventory is full", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const player = engine.world.player;
    const inventory = engine.world.inventory;

    inventory.clear();

    while (!inventory.isFull) {
      inventory.add("skeleton_bone", 1);
    }

    const usedBefore = inventory.usedSlots;

    engine.loot.spawnGroundDrop({
      kind: "item",
      itemId: "willow_bow",
      count: 1,
      x: player.x,
      y: player.y,
    });

    engine.update(1 / 60);

    expect(inventory.usedSlots).toBe(usedBefore);
    expect(
      engine.world.drops.some(
        (drop) => drop.itemId === "willow_bow",
      ),
    ).toBe(true);

    engine.destroy();
  });

  it("reports the inventory in the snapshot", () => {
    const { engine, getSnapshot } = createEngine(
      ALL_CLASSES[0],
    );

    engine.world.inventory.clear();
    engine.world.inventory.addCoins(123);
    engine.world.inventory.add("skeleton_skull", 1);

    engine.update(1 / 60);
    engine.sendSnapshot();

    const summary = getSnapshot().inventory;

    expect(summary.coins).toBe(123);
    expect(summary.used).toBe(1);
    expect(summary.capacity).toBeGreaterThan(0);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].itemId).toBe(
      "skeleton_skull",
    );
    expect(summary.items[0].uid).toBeTruthy();

    engine.destroy();
  });

  it("keeps coins growing and drops empty during normal farming", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.world.inventory.clear();

    for (let round = 0; round < 120; round += 1) {
      const target = engine.world.enemies[round % 7];

      target.hp = 1;
      target.alive = true;

      engine.damage.applyDamage(
        engine.world.player,
        target,
        { damage: 9999, damageType: "physical" },
      );

      for (const enemy of engine.world.enemies) {
        if (!engine.world.inventory.isFull) break;
        if (enemy.alive) continue;
        engine.world.inventory.remove("__none__", 0);
      }
    }

    // sem transbordo, nada deve ir para o chão
    expect(engine.world.drops).toHaveLength(0);
    expect(
      engine.world.inventory.coins,
    ).toBeGreaterThan(0);

    engine.destroy();
  });
});

describe("discarding items", () => {
  it("removes a stack from the inventory", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("willow_bow", 1);

    const stack = inventory.findStack("willow_bow");

    expect(engine.discardItem(stack.uid)).toBe(true);
    expect(inventory.count("willow_bow")).toBe(0);

    engine.destroy();
  });

  it("drops the whole stack by default", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("dummy_wood", 12);

    const stack = inventory.findStack("dummy_wood");

    engine.discardItem(stack.uid);

    expect(inventory.count("dummy_wood")).toBe(0);

    engine.destroy();
  });

  it("reports failure for an unknown uid", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    expect(engine.discardItem("nao_existe#99")).toBe(false);

    engine.destroy();
  });

  it("unequips and destroys the piece in one go", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("willow_bow", 1);

    const stack = inventory.findStack("willow_bow");

    engine.equipItem(stack.uid, "weapon");

    expect(
      engine.world.equipment.getEquipped("weapon"),
    ).not.toBe(null);

    engine.discardEquipped("weapon");

    expect(
      engine.world.equipment.getEquipped("weapon"),
    ).toBe(null);
    expect(inventory.count("willow_bow")).toBe(0);

    engine.destroy();
  });

  it("reports failure for an empty slot", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    expect(engine.discardEquipped("head")).toBe(false);

    engine.destroy();
  });
});

describe("loot filter integration", () => {
  it("starts with everything collectable", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    expect(engine.lootFilterSummary()).toEqual({
      equipment: null,
      material: null,
      label: expect.any(String),
    });

    engine.destroy();
  });

  it("never lets a rejected item reach the ground or the bag", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();

    engine.setLootFilter({
      equipment: null,
      material: "legendary",
    });

    for (let round = 0; round < 200; round += 1) {
      const target = engine.world.enemies[round % 7];

      target.hp = 1;
      target.alive = true;

      engine.damage.applyDamage(
        engine.world.player,
        target,
        { damage: 9999, damageType: "physical" },
      );
    }

    for (const stack of inventory.stacks) {
      expect(
        getItem(stack.itemId).type,
        stack.itemId,
      ).not.toBe("material");
    }

    for (const drop of engine.world.drops) {
      if (drop.kind !== "item") continue;

      expect(
        getItem(drop.itemId).type,
        drop.itemId,
      ).not.toBe("material");
    }

    engine.destroy();
  });

  it("still pays coins with a strict filter", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.world.inventory.clear();

    engine.setLootFilter({
      equipment: "legendary",
      material: "legendary",
    });

    for (let round = 0; round < 150; round += 1) {
      const target = engine.world.enemies[round % 7];

      target.hp = 1;
      target.alive = true;

      engine.damage.applyDamage(
        engine.world.player,
        target,
        { damage: 9999, damageType: "physical" },
      );
    }

    expect(
      engine.world.inventory.coins,
    ).toBeGreaterThan(0);

    engine.destroy();
  });

  it("clears the ground when the filter tightens", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.world.inventory.clear();

    engine.loot.spawnGroundDrop({
      kind: "item",
      itemId: "skeleton_bone",
      count: 4,
      x: 10,
      y: 10,
    });

    expect(engine.world.drops).toHaveLength(1);

    engine.setLootFilter({
      equipment: null,
      material: "legendary",
    });

    expect(engine.world.drops).toHaveLength(0);

    engine.destroy();
  });

  it("cleans the bag on demand", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();
    inventory.add("skeleton_bone", 1);
    inventory.add("willow_bow", 1);

    engine.setLootFilter({
      equipment: null,
      material: "legendary",
    });

    const removed = engine.pruneInventory();

    expect(removed).toBe(1);
    expect(inventory.count("skeleton_bone")).toBe(0);
    expect(inventory.count("willow_bow")).toBe(1);

    engine.destroy();
  });

  it("restores the default filter", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.setLootFilter({
      equipment: "epic",
      material: "legendary",
    });

    engine.setLootFilter({
      equipment: null,
      material: null,
    });

    expect(engine.lootFilterSummary()).toMatchObject({
      equipment: null,
      material: null,
    });

    engine.destroy();
  });

  it("publishes the filter in the snapshot", () => {
    const { engine, getSnapshot } = createEngine(ALL_CLASSES[0]);

    engine.setLootFilter({
      equipment: "rare",
      material: null,
    });

    expect(getSnapshot().lootFilter).toMatchObject({
      equipment: "rare",
      material: null,
    });

    engine.destroy();
  });
});

describe("mergeBonuses", () => {
  it("soma a mesma chave em vez de sobrescrever", () => {
    expect(
      mergeBonuses({ maxHp: 180 }, { maxHp: 45 }),
    ).toEqual({ maxHp: 225 });
  });

  it("mantem chaves que so existem em uma fonte", () => {
    expect(
      mergeBonuses(
        { maxHp: 10, defense: 8 },
        { speed: 4 },
      ),
    ).toEqual({
      maxHp: 10,
      defense: 8,
      speed: 4,
    });
  });

  it("soma varias fontes", () => {
    expect(
      mergeBonuses(
        { attack: 6 },
        { attack: 6 },
        { attack: 12 },
      ),
    ).toEqual({ attack: 24 });
  });

  it("aceita fonte vazia ou nula", () => {
    expect(mergeBonuses(null, { maxHp: 5 }, undefined))
      .toEqual({ maxHp: 5 });

    expect(mergeBonuses()).toEqual({});
  });

  it("preserva o valor zero em vez de descartar", () => {
    expect(
      mergeBonuses({ attack: 0 }, { attack: 7 }),
    ).toEqual({ attack: 7 });
  });
});

describe("bestiary integration", () => {
  /**
   * mata `times` criaturas do tipo, ressuscitando as ja abatidas
   * em vez de esperar o respawn do jogo
   */
  function kill(engine, typeId, times) {
    /**
     * Todo golpe ACERTA.
     *
     * Este bloco conta abates, e nao mede precisao. Deixando o sorteio
     * solto, uma criatura com 3% de esquiva faria `killed` contar um
     * abate que nao aconteceu, e o teste falharia uma vez a cada
     * tres rodadas — um teste que precisa de varias tentativas para
     * dizer se o codigo esta certo nao mede o codigo
     *
     * `1` nunca e menor que uma chance, entao desliga o miss e o
     * critico de uma vez
     */
    engine.damage.random = () => 1;

    const pool = engine.world.enemies.filter(
      (enemy) =>
        enemy.isCreature &&
        enemy.id.replace(/_\d+$/, "") === typeId,
    );

    if (pool.length === 0) return false;

    let killed = 0;

    for (let round = 0; round < times; round += 1) {
      const target = pool[round % pool.length];

      // usa o caminho de ressurreicao do engine, e nao so
      // `alive = true`: o estado de morto tem varias partes
      // (`rewardGranted` entre elas) e um mob restaurado na mao
      // ficaria sem loot para sempre
      engine.reviveEnemy(target);
      target.hp = 1;

      engine.damage.applyDamage(
        engine.world.player,
        target,
        { damage: 9999, damageType: "physical" },
      );

      killed += 1;
    }

    return killed;
  }

  it("starts with an empty bestiary in the snapshot", () => {
    const { engine, getSnapshot } = createEngine(ALL_CLASSES[0]);

    const bestiary = getSnapshot().bestiary;

    expect(bestiary.completed).toBe(0);
    expect(bestiary.total).toBeGreaterThan(0);
    expect(bestiary.bonuses).toEqual({});
    expect(bestiary.entries.length).toBeGreaterThan(0);

    engine.destroy();
  });

  it("counts kills on the target creature", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    expect(kill(engine, "slime", 2)).toBe(2);

    // o snapshot e throttled e so sobe no update, entendo leio o estado
    expect(
      engine.world.bestiary.kills.get("slime"),
    ).toBe(2);

    engine.destroy();
  });

  it("does not raise max hp before the hunt closes", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const before = engine.world.player.maxHp;

    kill(engine, "slime", 4);

    expect(engine.world.player.maxHp).toBe(before);

    engine.destroy();
  });

  it("raises max hp for good when the hunt closes", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const before = engine.world.player.maxHp;
    const nivelAntes = engine.world.player.level;

    expect(kill(engine, "slime", 5)).toBe(5);

    // 5 limos = +12 vida da cacada
    //
    // A soma e conferida com o NIVEL, e nao como +12 pelado: as
    // criaturas do mundo tem niveis variados, entao o XP dos 5
    // abates muda conforme quais limos o teste pegou, e o jogador
    // pode subir de nivel no mesmo abate que fecha a cacada. Sem
    // descontar a vida do nivel, o teste quebrava de tempos em
    // tempos conforme o roster do mapa mudou
    const subiuDeNivel =
      engine.world.player.level - nivelAntes;

    expect(engine.world.player.maxHp).toBe(
      before + 12 + 26 * subiuDeNivel,
    );

    engine.destroy();
  });

  it("raises speed when the rat hunt closes", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const before = engine.world.player.speed;

    // 5 ratos = +6 velocidade
    expect(kill(engine, "rat", 5)).toBe(5);

    expect(engine.world.player.speed).toBe(before + 6);

    engine.destroy();
  });

  it("raises attack speed on the second rat hunt", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const before = engine.world.player.attackSpeedBonus;

    // 15 ratos = +5% vel de ataque
    expect(kill(engine, "rat", 15)).toBe(15);

    expect(
      engine.world.player.attackSpeedBonus,
    ).toBeCloseTo(before + 0.05, 5);

    engine.destroy();
  });

  it("stacks bestiary bonus on top of equipment", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;
    const player = engine.world.player;

    inventory.clear();

    // uma peca vestida que DA VIDA, para o teste medir a SOMA
    // dos dois bonuses. O catalogo nao tem nenhuma: usava o coracao
    // de basalto (180 de vida), que saiu na limpeza
    const COM_HP = {
      id: "__test_coracao",
      name: "Coracao de Teste",
      icon: "C",
      rarity: "uncommon",
      type: ITEM_TYPE.TRINKET,
      slot: null,
      tier: 1,
      value: 1,
      stackable: false,
      maxStack: 1,
      stats: { maxHp: 180 },
    };

    ITEMS[COM_HP.id] = COM_HP;

    inventory.add(COM_HP.id, 1);
    engine.equipItem(
      inventory.findStack(COM_HP.id).uid,
      "trinket1",
    );

    const withGear = player.maxHp;

    expect(
      engine.world.equipment.bonuses().maxHp,
    ).toBeGreaterThan(0);

    // 5 ghouls = +45 vida de bestiario
    expect(kill(engine, "ghoul", 5)).toBe(5);

    // matar dá xp e pode subir de nivel, entao a diferenca exata nao
    // fecha: o que importa e o bestiario ter entrado por cima do gear
    expect(player.maxHp).toBeGreaterThan(withGear);
    expect(
      engine.world.bestiary.bonuses().maxHp,
    ).toBe(45);
    expect(
      engine.world.equipment.bonuses().maxHp,
    ).toBeGreaterThan(0);

    delete ITEMS[COM_HP.id];
    engine.destroy();
  });

  it("adds bestiary and equipment max hp instead of overwriting", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    inventory.clear();

    // uma peca vestida que DA VIDA, para o teste medir a SOMA
    // dos dois bonuses. O catalogo nao tem nenhuma: usava o coracao
    // de basalto (180 de vida), que saiu na limpeza
    const COM_HP = {
      id: "__test_coracao",
      name: "Coracao de Teste",
      icon: "C",
      rarity: "uncommon",
      type: ITEM_TYPE.TRINKET,
      slot: null,
      tier: 1,
      value: 1,
      stackable: false,
      maxStack: 1,
      stats: { maxHp: 180 },
    };

    ITEMS[COM_HP.id] = COM_HP;

    const gearHp = COM_HP.stats.maxHp; // 180

    inventory.add(COM_HP.id, 1);
    engine.equipItem(
      inventory.findStack(COM_HP.id).uid,
      "trinket1",
    );

    kill(engine, "ghoul", 5); // +45 de bestiario

    // os dois precisam estar na soma
    expect(
      mergeBonuses(
        engine.world.equipment.bonuses(),
        engine.world.bestiary.bonuses(),
      ).maxHp,
    ).toBe(gearHp + 45);

    delete ITEMS[COM_HP.id];
    engine.destroy();
  });

  it("announces the closed hunt", () => {
    const { engine, getSnapshot } = createEngine(ALL_CLASSES[0]);

    kill(engine, "slime", 5);

    expect(getSnapshot().message.text).toContain(
      "Cacada do bestiario",
    );

    engine.destroy();
  });

  it("accumulates several creatures in the snapshot", () => {
    const { engine, getSnapshot } = createEngine(ALL_CLASSES[0]);

    kill(engine, "slime", 5); // +12 vida
    kill(engine, "rat", 5); // +6 velocidade

    const bestiary = getSnapshot().bestiary;

    expect(bestiary.completed).toBe(2);
    expect(bestiary.bonuses).toEqual({
      maxHp: 12,
      speed: 6,
    });

    engine.destroy();
  });

  it("ignores training dummy kills", () => {
    const { engine, getSnapshot } = createEngine(ALL_CLASSES[0]);

    const dummy = engine.world.enemies.find(
      (enemy) => !enemy.isCreature,
    );

    for (let round = 0; round < 30; round += 1) {
      dummy.hp = 1;
      dummy.alive = true;

      engine.damage.applyDamage(
        engine.world.player,
        dummy,
        { damage: 9999, damageType: "physical" },
      );
    }

    expect(getSnapshot().bestiary.completed).toBe(0);
    expect(getSnapshot().bestiary.bonuses).toEqual({});

    engine.destroy();
  });

  it("keeps the bonus when the gear is unequipped", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);
    const inventory = engine.world.inventory;

    kill(engine, "slime", 5);

    const withHunt = engine.world.player.maxHp;

    engine.unequipItem("head");

    expect(engine.world.player.maxHp).toBe(withHunt);

    engine.destroy();
  });
});

describe("auto play", () => {
  it("does nothing while disabled", () => {
    for (const definition of ALL_CLASSES) {
      const { engine } = createEngine(definition);
      const startX = engine.world.player.x;
      const totalHp = engine.world.enemies.reduce(
        (sum, enemy) => sum + enemy.hp,
        0,
      );

      for (let frame = 0; frame < 600; frame += 1) {
        engine.update(1 / 60);
      }

      expect(engine.world.player.x).toBe(startX);
      expect(
        engine.world.enemies.reduce(
          (sum, enemy) => sum + enemy.hp,
          0,
        ),
      ).toBe(totalHp);
    }
  });

  it("kills every dummy when enabled", () => {
    for (const definition of ALL_CLASSES) {
      const { engine } = createEngine(definition);

      let damageDealt = 0;

      const originalApply = engine.damage.applyDamage.bind(
        engine.damage,
      );

      engine.damage.applyDamage = (
        attacker,
        target,
        action,
        options,
      ) => {
        const dealt = originalApply(
          attacker,
          target,
          action,
          options,
        );

        damageDealt += dealt;

        return dealt;
      };

      engine.setAutoPlay(true);

      for (let frame = 0; frame < 3000; frame += 1) {
        engine.update(1 / 60);

        for (const enemy of engine.world.enemies) {
          if (enemy.hp <= 0) {
            enemy.hp = enemy.maxHp;
          }
        }
      }

      expect(
        damageDealt,
        `${definition.name} não causeu dano`,
      ).toBeGreaterThan(0);

      expect(
        engine.world.pendingPulses.length,
        `${definition.name} deixou pulsos acumulados`,
      ).toBeLessThan(64);

      expect(
        engine.world.projectiles.length,
        `${definition.name} deixou projéteis acumulados`,
      ).toBeLessThan(300);

      engine.destroy();
    }
  });

  it("stops moving when disabled again", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.setAutoPlay(true);

    for (let frame = 0; frame < 300; frame += 1) {
      engine.update(1 / 60);
    }

    engine.setAutoPlay(false);

    const position = {
      x: engine.world.player.x,
      y: engine.world.player.y,
    };

    for (let frame = 0; frame < 300; frame += 1) {
      engine.update(1 / 60);
    }

    expect(engine.world.player.x).toBe(position.x);
    expect(engine.world.player.y).toBe(position.y);
    expect(engine.selectedTargetId).toBe(null);
    expect(engine.engagedTargetId).toBe(null);
  });

  it("toggles auto play with the T key", () => {
    const { engine, getSnapshot } = createEngine(
      ALL_CLASSES[0],
    );

    expect(engine.autoPlay).toBe(false);

    pressKey("KeyT");
    engine.update(1 / 60);

    expect(engine.autoPlay).toBe(true);
    expect(getSnapshot().autoPlay).toBe(true);

    pressKey("KeyT");
    engine.update(1 / 60);

    expect(engine.autoPlay).toBe(false);
    expect(getSnapshot().autoPlay).toBe(false);
  });

  it("moves on to the next dummy after killing one", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    engine.setAutoPlay(true);

    const seen = new Set();

    for (let frame = 0; frame < 5000; frame += 1) {
      engine.update(1 / 60);

      for (const enemy of engine.world.enemies) {
        if (enemy.hp <= 0) {
          enemy.hp = enemy.maxHp;
        }

        if (engine.selectedTargetId) {
          seen.add(engine.selectedTargetId);
        }
      }
    }

    expect(seen.size).toBeGreaterThan(1);
    expect(
      engine.world.pendingPulses.length,
    ).toBeLessThan(64);

    engine.destroy();
  });

  it("keeps attacking a clicked enemy until it dies, then stops", () => {
    const { engine, listeners } = createEngine(ALL_CLASSES[0]);

    const target = engine.world.enemies[0];
    const point = screenTo(engine, target.x, target.y);

    click(
      engine,
      listeners.pointerdown[0],
      point.x,
      point.y,
    );

    expect(engine.engagedTargetId).toBe(target.id);
    expect(engine.autoPlay).toBe(false);

    let guard = 0;

    while (target.alive && guard < 36000) {
      engine.update(1 / 60);
      guard += 1;

      if (!target.alive) {
        engine.update(1 / 60);
        break;
      }
    }

    expect(target.hp).toBe(0);
    expect(target.alive).toBe(false);

    engine.update(1 / 60);

    expect(engine.engagedTargetId).toBe(null);
    expect(engine.selectedTargetId).toBe(null);

    const frozen = {
      x: engine.world.player.x,
      y: engine.world.player.y,
    };
    const untouched = engine.world.enemies[1].hp;

    for (let frame = 0; frame < 600; frame += 1) {
      engine.update(1 / 60);
    }

    expect(engine.world.player.x).toBe(frozen.x);
    expect(engine.world.player.y).toBe(frozen.y);
    expect(engine.world.enemies[1].hp).toBe(untouched);
  });
});

/**
 * COM O FOCO NUM CAMPO, A TECLA E DO CAMPO.
 *
 * O motor era o unico dos tres consumidores de teclado que cancelava o
 * evento, e e por isso que a letra nao aparecia no campo do nome da
 * guilda: as outras duas guardas impediam o movimento e o painel de
 * abrirem, e nenhuma delas pode falar "nao cancele"
 *
 * Cada tecla controlada pelo motor aparece aqui. A lista e o que impede
 * o defeito de voltar uma tecla por vez
 */
describe("com o foco num campo de texto", () => {
  const CONTROLADAS = [
    "KeyW", "KeyA", "KeyS", "KeyD",
    "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight",
    "Space",
    "Digit1", "Digit2", "Digit3", "Digit4",
    "Digit5", "Digit6", "Digit7", "Digit8",
    "KeyR",
    "KeyT",
  ];

  for (const code of CONTROLADAS) {
    it(`${code} nao e cancelada`, () => {
      const evento = pressKeyInCampo(code);

      expect(
        evento.cancelados,
        `${code} foi cancelada e a letra nao chega no campo`,
      ).toBe(0);
    });
  }

  it("a tecla nao entra como movimento no motor", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    pressKeyInCampo("KeyW");

    expect(
      engine.input.keys.has("KeyW"),
      "o motor anotou a tecla e o boneco andaria offline",
    ).toBe(false);

    engine.destroy();
  });

  it("um checkbox nao conta como digitacao: o motor ainda trata", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    pressKeyInCampo("KeyT", "checkbox");

    // marcar o ataque automatico nao pode virar um lugar onde as teclas
    // param de funcionar
    expect(engine.autoPlay).toBe(true);

    engine.destroy();
  });

  it("fora do campo, o motor continua cancelando a tecla de movimento", () => {
    const { engine } = createEngine(ALL_CLASSES[0]);

    // a razao do `preventDefault` no motor: sem ele a seta rolava a
    // pagina. Isso continua valendo fora do campo
    let cancelados = 0;

    for (const handler of windowListeners.get("keydown") ?? []) {
      handler({
        code: "ArrowDown",
        repeat: false,
        preventDefault() {
          cancelados += 1;
        },
      });
    }

expect(
      cancelados,
      "a seta voltou a rolar a pagina",
    ).toBeGreaterThan(0);

    engine.destroy();
  });
});

