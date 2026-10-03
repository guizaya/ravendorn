import { describe, expect, it } from "vitest";
import { Collection, DELIVER_RESULT } from "./Collection.js";
import { Inventory } from "../inventory/Inventory.js";
import { Equipment } from "../equipment/Equipment.js";
import {
  RARITY,
  getItem,
} from "../../data/items/index.js";
import {
  COLLECTIONS,
  REQUIREMENT_TYPE,
  getCollection,
  requirementError,
} from "../../data/collection/index.js";

/** um mundo minimo: mochila, equipamento e coleção */
function mundo() {
  const inventory = new Inventory();
  const equipment = new Equipment();
  const collection = new Collection();

  return { inventory, equipment, collection };
}

const BOTA_ARBALIST = "botas_arbalist";
const CACA_ARBALIST = "capuz_arbalist";
const GELO = "slime_gel";
const CAUDA = "rat_tail";
const PELLE = "rat_pelt";

describe("os dados das colecoes", () => {
  it("todo requisito declara exatamente um dos dois tipos", () => {
    // A lista de requisito e dado escrito a mao, e um campo trocado
    // (`itemId` num requisito de equipamento, `rarity` num de
    // material) passaria em qualquer teste de comportamento: o
    // `missingOf` simplesmente contaria zero e a coleção nunca
    // completaria, sem erro nenhum
    for (const collection of COLLECTIONS) {
      for (const requirement of collection.requirements) {
        expect(
          requirementError(requirement),
          `${collection.id}: ${JSON.stringify(requirement)}`,
        ).toBe(null);
      }
    }
  });

  it("o tipo do requisito bate com o que ele aponta", () => {
    // Um requisito de MATERIAL tem de apontar para um material de
    // verdade. Se apontasse para uma espada, o jogador entregaria uma
    // espada e o painel chamaria aquilo de material
    for (const collection of COLLECTIONS) {
      for (const requirement of collection.requirements) {
        if (requirement.type !== REQUIREMENT_TYPE.MATERIAL) {
          continue;
        }

        expect(
          getItem(requirement.itemId).type,
          requirement.itemId,
        ).toBe("material");
      }
    }
  });

  it("nenhuma colecao repete id, e toda colecao tem nome e resumo", () => {
    const ids = COLLECTIONS.map((c) => c.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const collection of COLLECTIONS) {
      expect(collection.name, collection.id).toBeTruthy();
      expect(collection.summary, collection.id).toBeTruthy();
      expect(
        collection.requirements.length,
        collection.id,
      ).toBeGreaterThan(0);
    }
  });

  it("pede equipamento de raridade que existe", () => {
    // Um requisito com `rarity: "lendaria"` — com acento e no
    // portugues — nao casaria com nenhum item, e a coleção viraria
    // impossivel sem nenhum aviso
    for (const collection of COLLECTIONS) {
      for (const requirement of collection.requirements) {
        if (requirement.type !== REQUIREMENT_TYPE.EQUIPMENT) {
          continue;
        }

        expect(
          Object.values(RARITY),
          requirement.rarity,
        ).toContain(requirement.rarity);
      }
    }
  });
});

describe("Collection: o que falta", () => {
  it("uma colecao com um material só conta esse material", () => {
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);

    expect(
      collection.canDeliver("col_cacos", inventory, equipment),
    ).toBe(true);
  });

  it("conta material que esteja em qualquer pilha", () => {
    // O requisito e por ID, e nao por pílha: cinco unidades separadas
    // em tres pilhas contam como cinco
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 2);
    inventory.add(GELO, 2);
    inventory.add(GELO, 1);

    expect(
      inventory.countAt(GELO),
      "o inventario nao somou as pilhas",
    ).toBe(5);

    expect(
      collection.canDeliver("col_cacos", inventory, equipment),
    ).toBe(true);
  });

  it("exige os DOIS materiais quando a colecao tem dois", () => {
    // O requisito mais facil de errar: com 5 de cauda e 0 de pelo a
    // colecao tem material de sobra e ainda assim nao pode ser
    // entregue
    const { inventory, equipment, collection } = mundo();

    inventory.add(CAUDA, 5);

    expect(
      collection.canDeliver("col_ninho", inventory, equipment),
    ).toBe(false);

    inventory.add(PELLE, 2);

    expect(
      collection.canDeliver("col_ninho", inventory, equipment),
    ).toBe(false);

    inventory.add(PELLE, 1);

    expect(
      collection.canDeliver("col_ninho", inventory, equipment),
    ).toBe(true);
  });

  it("conta material e equipamento juntos", () => {
    // A terceira forma que o jogador pediu: um equipamento de
    // raridade X E um material. Falta um dos dois e nao entrega
    const { inventory, equipment, collection } = mundo();

    inventory.add("goblin_cloth", 5);
    inventory.add(BOTA_ARBALIST, 1, RARITY.RARE);

    expect(
      collection.canDeliver(
        "col_primeira_ferra",
        inventory,
        equipment,
      ),
    ).toBe(true);

    // tira o material: nao pode mais
    inventory.remove("goblin_cloth", 5);

    expect(
      collection.canDeliver(
        "col_primeira_ferra",
        inventory,
        equipment,
      ),
    ).toBe(false);

    // devolve o material e tira o equipamento: tambem nao
    inventory.add("goblin_cloth", 5);
    inventory.remove(BOTA_ARBALIST, 1, RARITY.RARE);

    expect(
      collection.canDeliver(
        "col_primeira_ferra",
        inventory,
        equipment,
      ),
    ).toBe(false);
  });
});

describe("Collection: entrega de equipamento", () => {
  it("exige a raridade EXATA, e nao aceita uma melhor", () => {
    // A decisao do jogador: a entrega CONSOME o item, e consumir um
    // lendario para cumprir um pedido de raro seria o pior resultado
    // possivel do painel
    const { inventory, equipment, collection } = mundo();

    inventory.add("goblin_cloth", 5);
    inventory.add(CACA_ARBALIST, 1, RARITY.EPIC);

    expect(
      collection.canDeliver(
        "col_primeira_ferra",
        inventory,
        equipment,
      ),
    ).toBe(false);

    inventory.remove(CACA_ARBALIST, 1, RARITY.EPIC);
    inventory.add(CACA_ARBALIST, 1, RARITY.RARE);

    expect(
      collection.canDeliver(
        "col_primeira_ferra",
        inventory,
        equipment,
      ),
    ).toBe(true);
  });

  it("material raro nao conta como equipamento", () => {
    // Material e o unico tipo que empilha, entao e o unico que o
    // requisito por RARIDADE nao pode aceitar. Sem esta separacao, 5
    // de um material epico na mochila contariam como "1 equipamento
    // epico" e o jogador entregaria um monte de gelo
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5, RARITY.EPIC);

    const faltam = collection.missingOf(
      getCollection("col_primeira_ferra"),
      inventory,
      equipment,
    );

    // o equipamento epico nao existe na mochila
    const doEquipamento = faltam.find(
      (f) => f.type === REQUIREMENT_TYPE.EQUIPMENT,
    );

    expect(doEquipamento).toBeDefined();
    expect(
      doEquipamento.have,
      "o material raro contou como equipamento",
    ).toBe(0);
  });

  it("conta a peca que esta VESTIDA, e tira ela do corpo", () => {
    // Peca equipada nao esta no inventario: `equipItem` tira a pilha
    // e `unequipItem` devolve. Sem este caso o jogador veria o
    // requisito faltando enquanto a peça esta no corpo dele, e teria
    // que tirar a mao do equipamento para completa a colecao
    const { inventory, equipment, collection } = mundo();

    inventory.add("goblin_cloth", 5);
    inventory.add(BOTA_ARBALIST, 1, RARITY.RARE);

    const slot = equipment.slotForItem(BOTA_ARBALIST);

    expect(slot).toBe("boots");

    // `equip` devolve `null` quando o slot estava vazio, e nao `true`:
    // o retorno bem-sucedido e o par `{itemId, rarity}`. Por isso o
    // teste confere o ESTADO depois, e nao o retorno
    equipment.equip(BOTA_ARBALIST, slot, RARITY.RARE);

    // o `getEquipped` devolve o item ESPALHADO, entao o campo e `id`.
    // `itemId` seria `undefined` e o teste passaria com a peca nao
    // vestida
    expect(
      equipment.getEquipped(slot)?.id,
      "a peca nao foi vestida",
    ).toBe(BOTA_ARBALIST);

    /**
     * Vestir tira a peca da mochila, e quem faz isso e o
     * `GameEngine.equipItem` — nao o `Equipment.equip`.
     *
     * Aqui a pilha e removida a mao para reproduzir o estado real. Sem
     * esta linha o teste comeca com DUAS copias da bota, uma na
     * mochila e uma vestida, e a entrega consumindo a da mochila
     * deixaria a vestida no corpo: o resultado pareceria certo por
     * acidente, e o requisito "1 bota rara" estaria sendo satisfeito
     * por duas pecas distintas
     */
    const pilha = inventory.findStack(
      BOTA_ARBALIST,
      RARITY.RARE,
    );

    expect(pilha, "a peca deveria estar na mochila").toBeTruthy();
    expect(inventory.takeUid(pilha.uid, 1)).toBeTruthy();

    // a pilha saiu da mochila ao vestir
    expect(inventory.countAt(BOTA_ARBALIST, RARITY.RARE)).toBe(0);

    // e mesmo assim a colecao conta com ela
    expect(
      collection.canDeliver(
        "col_primeira_ferra",
        inventory,
        equipment,
      ),
    ).toBe(true);

    const resultado = collection.deliver(
      "col_primeira_ferra",
      inventory,
      equipment,
    );

    expect(resultado.ok).toBe(true);

    // a peca foi consumida, e nao voltou para a mochila
    expect(equipment.getEquipped(slot)).toBe(null);
    expect(inventory.countAt(BOTA_ARBALIST, RARITY.RARE)).toBe(0);
  });
});

describe("Collection: entregar", () => {
  it("consome o material e paga a recompensa", () => {
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);

    const resultado = collection.deliver(
      "col_cacos",
      inventory,
      equipment,
    );

    expect(resultado.ok).toBe(true);
    expect(resultado.reason).toBeUndefined();

    expect(inventory.countAt(GELO), "o material nao foi consumido").toBe(0);
    expect(collection.isDone("col_cacos")).toBe(true);
  });

  it("NAO consome nada quando falta um dos requisitos", () => {
    // A entrega pela metade e o pior resultado possivel aqui: o
    // jogador perderia material sem receber nada. Toda a checagem vem
    // antes de qualquer remocao, pelo mesmo motivo do craft
    const { inventory, equipment, collection } = mundo();

    inventory.add(CAUDA, 5);
    inventory.add(PELLE, 1);

    const resultado = collection.deliver(
      "col_ninho",
      inventory,
      equipment,
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.reason).toBe(DELIVER_RESULT.MISSING);

    // o cauda continua inteiro
    expect(inventory.countAt(CAUDA)).toBe(5);
    expect(inventory.countAt(PELLE)).toBe(1);
    expect(collection.isDone("col_ninho")).toBe(false);
  });

  it("devolve o motivo UNKNOWN para colecao que nao existe", () => {
    const { inventory, equipment, collection } = mundo();

    expect(
      collection.deliver("col_inexistente", inventory, equipment),
    ).toEqual({
      ok: false,
      reason: DELIVER_RESULT.UNKNOWN,
    });
  });

  it("nao entrega duas vezes a mesma colecao", () => {
    // "Uma vez so" foi a decisao do jogador. Sem esta trava o jogador
    // ganha moedas infinitas: a colecao fica pronta de novo assim que
    // o material volta, e o material nunca mais acaba de ser util
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);

    expect(
      collection.deliver("col_cacos", inventory, equipment).ok,
    ).toBe(true);

    inventory.add(GELO, 5);

    const segunda = collection.deliver(
      "col_cacos",
      inventory,
      equipment,
    );

    expect(segunda.ok).toBe(false);
    expect(segunda.reason).toBe(DELIVER_RESULT.DONE);
    expect(inventory.countAt(GELO), "gastou material na segunda").toBe(5);
  });

  it("a entrega nao sai pela metade mesmo com material repetido", () => {
    // Dois requisitos do MESMO item: contar e `countAt` uma vez so daria
    // 5 para os dois, e o jogador entregaria 5 tendo 5 quando precisa
    // de 10. Aqui cada requisito e conferido no seu valor inteiro
    const { inventory, equipment, collection } = mundo();

    const mesmaPeca = {
      id: "col_dup",
      name: "Dup",
      summary: "s",
      icon: "x",
      requirements: [
        {
          type: REQUIREMENT_TYPE.MATERIAL,
          itemId: GELO,
          count: 3,
        },
        {
          type: REQUIREMENT_TYPE.MATERIAL,
          itemId: GELO,
          count: 3,
        },
      ],
      rewards: { coins: 1, xp: 1, items: [] },
    };

    // forca a colecao no catalogo em memoria so neste teste
    COLLECTIONS.push(mesmaPeca);

    try {
      inventory.add(GELO, 5);

      expect(
        collection.canDeliver("col_dup", inventory, equipment),
        "5 unidades satisfazem dois requisitos de 3",
      ).toBe(false);

      inventory.add(GELO, 1);

      expect(
        collection.canDeliver("col_dup", inventory, equipment),
      ).toBe(true);

      const resultado = collection.deliver(
        "col_dup",
        inventory,
        equipment,
      );

      expect(resultado.ok).toBe(true);
      expect(
        inventory.countAt(GELO),
        "consumiu menos que a soma dos requisitos",
      ).toBe(0);
    } finally {
      COLLECTIONS.pop();
    }
  });
});

/**
 * A recompensa e SO STATS.
 *
 * Os testes deste bloco eram sobre a fila de item que nao cabia na
 * mochila. Essa fila foi embora com o item: um bonus de stat nao ocupa
 * espaco, nao entra no inventario e nao pode ficar esperando. O que
 * resta para verificar e o que a entrega faz em vez disso — SOMAR o
 * bonus, e nao mexer em nada que o jogador possa perder
 */
describe("Collection: recompensa", () => {
  it("a entrega soma o bonus de stat", () => {
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);

    const resultado = collection.deliver(
      "col_cacos",
      inventory,
      equipment,
    );

    expect(resultado.ok).toBe(true);
    expect(resultado.reward).toEqual({ vit: 2, maxHp: 40 });
    expect(collection.bonuses()).toEqual({ vit: 2, maxHp: 40 });
  });

  it("nao paga moeda, xp nem item", () => {
    // o motivo da mudanca: a entrega consome o material do jogador, e
    // devolver item era trocar material por material. O jogador
    // terminava com a mochila igual e nenhum ganho
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);

    const moedasAntes = inventory.coins;
    const slotsAntes = inventory.stacks.length;

    collection.deliver("col_cacos", inventory, equipment);

    expect(inventory.coins).toBe(moedasAntes);
    expect(inventory.stacks).toHaveLength(slotsAntes - 1);
  });

  it("cada colecao soma em vez de substituir", () => {
    // `col_cacos` e `col_ossada` dao as duas `vit`. Substituir faria a
    // segunda entrega apagar o bonus da primeira, e o jogador perderia
    // o que ja tinha ganhado
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);
    collection.deliver("col_cacos", inventory, equipment);

    inventory.add("skeleton_bone", 5);
    inventory.add("skeleton_skull", 2);
    collection.deliver("col_ossada", inventory, equipment);

    const bonus = collection.bonuses();

    expect(bonus.vit, "a segunda entrega apagou a primeira").toBe(6);
    expect(bonus.maxHp).toBe(40);
    expect(bonus.defense).toBe(8);
    expect(bonus.magicDefense).toBe(5);
    expect(bonus.hpRegen).toBe(2);
  });

  it("nao ha mais fila de recompensa esperando espaco", () => {
    // A mochila cheia era o caso que a fila resolvia. Um bonus de
    // stat nao ocupa slot, entao nao existe o que ficar esperando —
    // e a entrega continua valendo com a mochila cheia
    const inventory = new Inventory(1);
    const equipment = new Equipment();
    const collection = new Collection();

    inventory.add(GELO, 5);

    expect(
      collection.deliver("col_cacos", inventory, equipment).ok,
    ).toBe(true);

    expect(collection.bonus).toEqual({ vit: 2, maxHp: 40 });
    expect(collection.pendingCount).toBe(undefined);
    expect(collection.drainRewards).toBe(undefined);

    // e o material saiu, que e a parte que o jogador pode perder
    expect(inventory.countAt(GELO)).toBe(0);
  });

  it("a entrega da duas vezes nao soma duas vezes", () => {
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);
    collection.deliver("col_cacos", inventory, equipment);

    inventory.add(GELO, 5);

    const segunda = collection.deliver(
      "col_cacos",
      inventory,
      equipment,
    );

    expect(segunda.ok).toBe(false);
    expect(segunda.reason).toBe(DELIVER_RESULT.DONE);
    expect(collection.bonuses()).toEqual({ vit: 2, maxHp: 40 });
  });

  it("o bonus e uma copia, e nao o estado interno", () => {
    // quem chamasse `bonuses()` e mutasse o resultado mudaria o
    // personagem sem passar pela entrega
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);
    collection.deliver("col_cacos", inventory, equipment);

    const copia = collection.bonuses();

    copia.vit = 9999;

    expect(collection.bonuses().vit).toBe(2);
  });
});

describe("Collection: snapshot e save", () => {
  it("o snapshot traz o que falta, e nao so um booleano", () => {
    // O painel mostra "faltam 2 de Gelo", e ele nao consegue
    // inventar essa frase a partir de um `pronta: false`
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 3);

    const dados = collection.snapshot(inventory, equipment);

    expect(dados.total).toBe(COLLECTIONS.length);
    expect(dados.completed).toBe(0);
    expect(dados.isComplete).toBe(false);

    const primeira = dados.entries[0];

    expect(primeira.pronta).toBe(false);
    expect(primeira.faltam).toHaveLength(1);
    expect(primeira.faltam[0].falta).toBe(2);
    expect(primeira.faltam[0].have).toBe(3);
    expect(primeira.faltam[0].label).toContain("Gelo");
  });

  it("colecao entregue aparece pronta, sem lista de faltantes", () => {
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);
    collection.deliver("col_cacos", inventory, equipment);

    const entrada = collection
      .snapshot(inventory, equipment)
      .entries.find((e) => e.id === "col_cacos");

    expect(entrada.done).toBe(true);
    expect(entrada.faltam).toBe(null);
  });

  it("o snapshot traz o bonus total, separado do de cada cartao", () => {
    // os cartoes mostram o que a entrega DARIA; o total e o que o
    // jogador tem. Sao iguais ate ele rebalancear uma colecao
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);
    collection.deliver("col_cacos", inventory, equipment);

    const dados = collection.snapshot(inventory, equipment);

    expect(dados.bonuses).toEqual({ vit: 2, maxHp: 40 });
    expect(dados.entries[0].rewards).toEqual({
      vit: 2,
      maxHp: 40,
    });
  });

  it("o bonus atravessa o save", () => {
    // o bonus e permanente: fechar o jogo nao pode devolver os stats
    // ao catalogo
    const { inventory, equipment, collection } = mundo();

    inventory.add(GELO, 5);
    collection.deliver("col_cacos", inventory, equipment);

    const outra = new Collection();

    outra.fromSave(collection.toSave());

    expect(outra.isDone("col_cacos")).toBe(true);
    expect(outra.bonuses()).toEqual({ vit: 2, maxHp: 40 });
  });

  it("reconstroi o bonus de um save antigo, sem o campo", () => {
    // um save gravado antes da recompensa virar stat tem `done` cheio e
    // nenhum bonus. Sem reconstruir, quem entregou as seis colecoes
    // perderia o bonus inteiro so por ter jogado antes da mudanca
    const collection = new Collection();

    collection.fromSave({ done: ["col_cacos", "col_ninho"] });

    expect(collection.bonuses()).toEqual({
      vit: 2,
      maxHp: 40,
      dex: 3,
      movementSpeed: 20,
      evasion: 0.02,
      critRate: 0.01,
      attackSpeed: 0.05,
    });
  });

  it("descarta bonus forjado no save", () => {
    // o `bonus` vem de fora. Um stat que o jogo nao conhece, ou um
    // valor que nao e numero, viraria stat permanente na mao
    const collection = new Collection();

    collection.fromSave({
      done: ["col_cacos"],
      bonus: {
        vit: 5,
        stat_que_nao_existe: 999,
        dex: "muitos",
        wis: -10,
        int: Infinity,
      },
    });

    // `vit: 5` e um stat valido com um numero valido, entao entra —
    // e o jogador edita o proprio save, e isso nao e uma falha de
    // seguranca. O que NAO pode entrar e o resto
    expect(collection.bonuses()).toEqual({ vit: 5 });
  });

  it("usa o bonus do arquivo mesmo quando ele nao bate com o catalogo", () => {
    // o `done` diz que `col_cacos` foi entregue e o catalogo hoje da
    // `vit: 2`. Quem entregou quando ela valia mais tem o bonus
    // antigo: o arquivo e a verdade do que o jogador ganhou, e
    // rebalancear o catalogo nao pode tirar o que ele ja tinha
    const collection = new Collection();

    collection.fromSave({
      done: ["col_cacos"],
      bonus: { vit: 9 },
    });

    expect(collection.bonuses()).toEqual({ vit: 9 });
  });

  it("o save ignora id de colecao que nao existe", () => {
    // O save vem de fora: uma colecao apagada do catalogo nao pode
    // ressuscitar no `done` de um jogador
    const collection = new Collection();

    collection.fromSave({
      done: ["col_cacos", "colecao_que_nao_existe"],
    });

    expect(collection.completedCount).toBe(1);
  });

  it("o save ignora dado corrompido", () => {
    const collection = new Collection();

    collection.fromSave(null);
    expect(collection.completedCount).toBe(0);

    collection.fromSave({ done: "nao e lista" });
    expect(collection.completedCount).toBe(0);

    collection.fromSave({ done: [1, 2, 3] });
    expect(collection.completedCount).toBe(0);
  });
});
