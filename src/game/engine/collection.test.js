import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { RARITY } from "../../data/items/index.js";
import {
  COLLECTIONS,
  getCollection,
  rewardError,
} from "../../data/collection/index.js";
import { ATTRIBUTE_IDS, STAT_BY_ID } from "../stats/StatSheet.js";

/**
 * A entrega de COLECAO dentro do motor.
 *
 * A `Collection` sozinha tem teste proprio. O que este arquivo prova
 * e a parte que so existe no motor: que a sessao tem uma colecao, que
 * o metodo paga a recompensa pelo caminho certo, e que a entrega nao
 * acontece pela metade quando o motor e quem confere
 */
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

const instances = [];

function createEngine() {
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

  const classDefinition =
    CHARACTER_CLASSES.find(
      (entry) => entry.id === "arbalist",
    ) ?? CHARACTER_CLASSES[0];

  const engine = new GameEngine(canvas, classDefinition, (next) => {
    snapshot = next;
  });

  engine.setMap(MAP_1);
  engine.world.collision.map = MAP_1;

  instances.push(engine);

  return { engine, getSnapshot: () => snapshot };
}

/** da ao jogador tudo que uma colecao pede */
function comTudo(engine, collectionId) {
  const collection = getCollection(collectionId);

  for (const requirement of collection.requirements) {
    if (requirement.itemId) {
      engine.world.inventory.add(
        requirement.itemId,
        requirement.count,
      );
      continue;
    }

    engine.world.inventory.add(
      "botas_arbalist",
      requirement.count,
      requirement.rarity,
    );
  }
}

const GELO = "slime_gel";
const CAUDA = "rat_tail";
const PELLE = "rat_pelt";

beforeEach(() => {
  instances.length = 0;
});

afterEach(() => {
  for (const engine of instances) engine.destroy();
});

describe("GameEngine: a sessao tem uma colecao", () => {
  it("a colecao nasce na sessao, e nao no world", () => {
    const { engine } = createEngine();

    /**
     * Se a colecao morasse no `world` e nao na sessao, dois jogadores
     * online compartilhariam o mesmo estado: a entrega de um fecharia a
     * colecao do outro
     */
    expect(engine.world.collection).toBeTruthy();
    expect(engine.world.collection.completedCount).toBe(0);
    expect(
      engine.world.collection,
      "a colecao deveria ser estado privado",
    ).toBe(engine.world.session.collection);
  });

  it("o snapshot manda o painel de colecao", () => {
    const { engine, getSnapshot } = createEngine();

    getSnapshot();

    const dados = getSnapshot().collection;

    expect(dados).toBeDefined();
    expect(dados.entries).toHaveLength(COLLECTIONS.length);
    expect(dados.completed).toBe(0);
    expect(dados.total).toBe(COLLECTIONS.length);
  });
});

describe("GameEngine: entregar uma colecao", () => {
it("consome o material e paga SO stat", () => {
    const { engine } = createEngine();

    engine.world.inventory.add(GELO, 5);

    const moedasAntes = engine.world.inventory.coins;
    const xpAntes = engine.world.player.xp ?? 0;

    const hpAntes = engine.world.player.maxHp;

    const ok = engine.deliverCollection("col_cacos");

    expect(ok).toBe(true);
    expect(engine.world.inventory.countAt(GELO)).toBe(0);

    // a entrega nao paga nem moeda nem xp: ela paga stat, e o stat
    // fica no personagem para sempre
    expect(engine.world.inventory.coins).toBe(moedasAntes);
    expect(engine.world.player.xp ?? 0).toBe(xpAntes);

    // `col_cacos` da `vit: 2` e `maxHp: 40`. O VIT alone move a
    // regeneracao, e o maxHp e o bonus mais direto
    expect(engine.world.collection.bonuses()).toEqual({
      vit: 2,
      maxHp: 40,
    });

    expect(engine.world.player.maxHp).toBe(hpAntes + 40);
    expect(engine.world.collection.isDone("col_cacos")).toBe(true);
  });

  it("o bonus da entrega aparece no personagem e na folha de stats", () => {
    // A entrega soma no `collection.bonus`, e o `applyEquipment`
    // leva esse bonus para o jogador e para a folha. Sem ele o painel
    // mostraria a colecao como entregue e os stats sem o valor novo,
    // no exato instante em que o jogador olha para os dois
    const { engine } = createEngine();

    const player = engine.world.player;

    const vitAntes =
      player.stats.byId.vit.total - player.stats.byId.vit.base;
    const maxHpAntes = player.maxHp;

    engine.world.inventory.add(GELO, 5);

    expect(engine.deliverCollection("col_cacos")).toBe(true);

    expect(
      player.stats.byId.vit.total - player.stats.byId.vit.base,
      "o bonus de VIT nao chegou na folha",
    ).toBe(vitAntes + 2);

    expect(player.maxHp).toBe(maxHpAntes + 40);
  });

  it("a entrega nao paga xp, e por isso nao sobe de nivel", () => {
    // o xp da entrega apontava para `grantXp`, que dispara a missao de
    // nivel. Sem xp de colecao, esse caminho nao existe mais e a
    // entrega nao pode mudar o nivel do jogador
    const { engine } = createEngine();

    engine.world.inventory.add(GELO, 5);
    engine.deliverCollection("col_cacos");

    expect(engine.world.player.level).toBe(1);
  });

  it("o aviso da entrega lista os stats, e nao moedas", () => {
    const { engine } = createEngine();

    engine.world.inventory.add(GELO, 5);
    engine.deliverCollection("col_cacos");

    const aviso = engine.world.session?.message?.text ?? "";

    expect(aviso).toContain("Restos do Brejo");
    expect(aviso).toContain("VIT");
    expect(aviso).toContain("HP");
    expect(aviso).not.toContain("moedas");
  });

  it("nao entrega, e nao mexe no material, quando falta um requisito", () => {
    const { engine } = createEngine();

    engine.world.inventory.add(CAUDA, 5);

    const ok = engine.deliverCollection("col_ninho");

    expect(ok).toBe(false);

    // a colecao tem dois materiais e o jogador so tem um
    expect(engine.world.inventory.countAt(CAUDA)).toBe(5);
    expect(engine.world.collection.isDone("col_ninho")).toBe(false);
  });

  it("recusa uma colecao que nao existe, sem gastar nada", () => {
    const { engine } = createEngine();

    const ok = engine.deliverCollection("col_que_nao_existe");

    expect(ok).toBe(false);
    expect(engine.world.collection.completedCount).toBe(0);
  });

  it("a segunda entrega do mesmo conjunto e recusada", () => {
    const { engine } = createEngine();

    engine.world.inventory.add(GELO, 5);

    expect(engine.deliverCollection("col_cacos")).toBe(true);

    // e o jogador enche a mochila de novo: se a trava nao existir, ele
    // ganha moedas infinitas com o mesmo material
    engine.world.inventory.add(GELO, 5);

    const moedas = engine.world.inventory.coins;

    expect(engine.deliverCollection("col_cacos")).toBe(false);
    expect(engine.world.inventory.coins).toBe(moedas);
    expect(engine.world.inventory.countAt(GELO)).toBe(5);
  });

  it("a entrega sai pela metada nunca", () => {
    // O material de DUAS colecoes diferentes na interfere. Entregar a
    // primeira tem de deixar a segunda tao intacta quanto estava
    const { engine } = createEngine();

    engine.world.inventory.add(GELO, 5);
    engine.world.inventory.add(CAUDA, 5);
    engine.world.inventory.add(PELLE, 3);

    expect(engine.deliverCollection("col_cacos")).toBe(true);

    expect(engine.world.inventory.countAt(CAUDA)).toBe(5);
    expect(engine.world.inventory.countAt(PELLE)).toBe(3);

    // e a segunda ainda entrega, o que prova que o material dela nao
    // foi consumido pela primeira
    expect(engine.deliverCollection("col_ninho")).toBe(true);
    expect(engine.world.inventory.countAt(CAUDA)).toBe(0);
    expect(engine.world.inventory.countAt(PELLE)).toBe(0);
  });

  it("o snapshot depois da entrega mostra a colecao como feita", () => {
    const { engine, getSnapshot } = createEngine();

    engine.world.inventory.add(GELO, 5);

    expect(getSnapshot()).toBeDefined();
    expect(getSnapshot().collection.completed).toBe(0);

    engine.deliverCollection("col_cacos");

    // `deliverCollection` manda o snapshot, entao a contagem ja vem
    // atualizada sem o jogador esperar o proximo tick
    const dados = getSnapshot().collection;

    expect(dados.completed).toBe(1);
    expect(
      dados.entries.find((e) => e.id === "col_cacos").done,
    ).toBe(true);
  });
});

describe("GameEngine: entrega com equipamento", () => {
  it("aceita equipamento na mochila", () => {
    const { engine } = createEngine();

    comTudo(engine, "col_primeira_ferra");

    expect(
      engine.world.inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
    ).toBe(1);

    expect(
      engine.deliverCollection("col_primeira_ferra"),
    ).toBe(true);

    expect(
      engine.world.inventory.countAt(
        "botas_arbalist",
        RARITY.RARE,
      ),
      "a peca entregue voltou para a mochila",
    ).toBe(0);
  });

  it("nao aceita equipamento de raridade diferente", () => {
    const { engine } = createEngine();

    // lendario no lugar do raro
    engine.world.inventory.add(
      "botas_arbalist",
      1,
      RARITY.EPIC,
    );
    engine.world.inventory.add("goblin_cloth", 5);

    expect(
      engine.deliverCollection("col_primeira_ferra"),
    ).toBe(false);

    // e o lendario continua com o jogador
    expect(
      engine.world.inventory.countAt(
        "botas_arbalist",
        RARITY.EPIC,
      ),
    ).toBe(1);
  });
});

/**
 * A entrega com a mochila cheia.
 *
 * Este bloco existia por causa da fila de recompensa que nao cabia. A
 * fila foi embora com o item: um bonus de stat nao ocupa slot, nao
 * entra no inventario e nao pode ficar esperando. O que sobrou para
 * verificar e que a entrega continua valendo com a mochila cheia — o
 * caso em que o jogador nao tem como liberar espaco
 */
describe("GameEngine: entrega com a mochila cheia", () => {
  it("a entrega acontece mesmo com a mochila cheia", () => {
    const { engine } = createEngine();

    const inventario = engine.world.inventory;

    inventario.add(GELO, 5);

    // espreme ate lotar. A entrega tem de passar: recusar por causa de
    // espaco seria o jogador preso sem caminho para entregar o que ele
    // ja juntou
    while (inventario.freeSlots > 0) {
      inventario.add(CAUDA, 1);
    }

    expect(inventario.isFull).toBe(true);
    expect(engine.deliverCollection("col_cacos")).toBe(true);
    expect(engine.world.collection.isDone("col_cacos")).toBe(true);

    // o bonus entra inteiro, sem depender de nenhum slot
    expect(engine.world.collection.bonuses()).toEqual({
      vit: 2,
      maxHp: 40,
    });
  });

  it("a entrega nao enche a mochila", () => {
    // o inverso do teste antigo: a recompensa NAO pode ocupar espaco.
    // Se voltasse a devolver item, o jogador veria a mochila mais cheia
    // depois de entregar, e a colecao viraria um lugar que perde
    // espaco
    const { engine } = createEngine();

    const inventario = engine.world.inventory;

    inventario.add(GELO, 5);

    const slotsAntes = inventario.stacks.length;

    engine.deliverCollection("col_cacos");

    expect(inventario.stacks).toHaveLength(slotsAntes - 1);
  });

  it("o painel nao anuncia mais recompensa pendente", () => {
    const { engine } = createEngine();

    engine.world.inventory.add(GELO, 5);
    engine.deliverCollection("col_cacos");

    // o aviso de "N recompensa(s) esperando espaco na mochila" e o
    // `pending` foram embora com o item da recompensa. Um painel
    // mostrando isso depois de uma entrega paga seria o jogador
    // esperando algo que nunca chega
    expect(engine.collectionSnapshot().pending).toBe(undefined);

    const texto = JSON.stringify(engine.collectionSnapshot());

    expect(texto).not.toContain("pending");
    expect(texto).not.toContain("waiting");
  });
});

describe("GameEngine: o catalogo paga so stat", () => {
  /**
   * Nenhuma colecao pode devolver moeda, xp ou item.
   *
   * A regra e do CATALOGO e vale para toda colecao nova: uma seventh
   * colecao com `coins: 500` passaria por todos os testes de
   * comportamento — a entrega consumiria o material, o `deliver`
   * devolveria `ok` — e o jogador receberia nada em troca
   */
  it("nenhuma colecao declara coins, xp ou items", () => {
    for (const collection of COLLECTIONS) {
      for (const proibido of ["coins", "xp", "items"]) {
        expect(
          collection.rewards[proibido],
          `${collection.id} paga ${proibido}`,
        ).toBe(undefined);
      }
    }
  });

  it("toda colecao da pelo menos um stat do jogo", () => {
    for (const collection of COLLECTIONS) {
      const chaves = Object.keys(collection.rewards);

      expect(chaves.length, collection.id).toBeGreaterThan(0);

      for (const stat of chaves) {
        expect(
          STAT_BY_ID[stat],
          `${collection.id} paga ${stat}, que nao e stat`,
        ).toBeTruthy();

        expect(
          collection.rewards[stat],
          `${collection.id}.${stat}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("o catalogo inteiro passa pela validação", () => {
    // `rewardError` e a regra escrita uma vez. Ela so vale alguma
    // coisa se alguem a chamar, e um `it` que nao a exercita deixa a
    // regra ser deletada sem ninguem perceber
    for (const collection of COLLECTIONS) {
      expect(
        rewardError(collection.rewards),
        collection.id,
      ).toBe(null);
    }
  });

  it("os pontos de atributo escalam entre as colecoes", () => {
    /**
     * A escalada e conferida em PONTO DE ATRIBUTO, e nao na soma
     * dos valores.
     *
     * Somar os valores brutos nao mede nada: `maxHp: 40` e `2` de VIT
     * somam 42 e 2, mas um e vida e o outro e um ponto que move meia
     * duzia de stats derivados. Um catalogo perfeitamente escalado
     * falharia nesse teste so porque a primeira colecao deu 40 de vida
     *
     * O ponto de atributo e a moeda escassa da colecao: e o unico
     * valor que e a MESMA unidade em todas as seis entregas, e o que
     * o jogador entende como "a colecao me deu mais"
     */
    const pontos = (collection) =>
      ATTRIBUTE_IDS.reduce(
        (soma, id) => soma + (collection.rewards[id] ?? 0),
        0,
      );

    for (let i = 1; i < COLLECTIONS.length; i += 1) {
      expect(
        pontos(COLLECTIONS[i]),
        `${COLLECTIONS[i].id} da menos ponto de atributo que ` +
          `${COLLECTIONS[i - 1].id}`,
      ).toBeGreaterThan(pontos(COLLECTIONS[i - 1]));
    }
  });

  it("o bonus total das seis entregas cabe na personagem", () => {
    // a colecao toda rende um bonus permanente. Se a soma for grande
    // demais o equipamento deixa de importar, e se for pequena demais
    // o jogador atravessa as seis entregas sem sentir nada
    const total = COLLECTIONS.reduce((acc, collection) => {
      for (const [stat, valor] of Object.entries(
        collection.rewards,
      )) {
        acc[stat] = (acc[stat] ?? 0) + valor;
      }

      return acc;
    }, {});

    expect(total.maxHp).toBeLessThan(1000);
    expect(total.attack).toBeLessThan(150);
    expect(total.attack).toBeGreaterThan(20);

    for (const [stat, valor] of Object.entries(total)) {
      expect(STAT_BY_ID[stat], stat).toBeTruthy();
      expect(valor, stat).toBeGreaterThan(0);
    }
  });
});