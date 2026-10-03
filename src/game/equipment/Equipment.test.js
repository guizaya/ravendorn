import { describe, expect, it, afterEach } from "vitest";
import {
  Equipment,
  EQUIPMENT_SLOTS,
  isEquippable,
  slotNameFor,
} from "./Equipment.js";
import {
  ITEM_TYPE,
  ITEMS,
  getItem,
} from "../../data/items/index.js";

/**
 * Equipamento, depois da limpeza do catalogo.
 *
 * Sobrou UMA peca equipavel: o arco de galho, que e arma do
 * arquero e nao declara posicao. Armadura e reliquia saíram, e com
 * elas os tres slots de corpo e os dois de reliquia ficaram sem
 * nenhuma peca que os ocupe.
 *
 * Este arquivo foi reescrito por causa disso. Ele ainda mede o que
 * existe de verdade:
 *
 * - o TIPO decide se a peca entra (arma so vai no slot de arma)
 * - a troca devolve a peca anterior na MESMA raridade
 * - desequipar devolve a variante, e o bonus escala com a raridade
 *
 * E mede a REGRA DE POSICAO com uma peca de teste, porque nenhum item
 * do catalogo declara posicao hoje. Sem isso, a regra que decide se
 * um capuz entra no peito em vez da cabeca ficaria sem nenhum teste
 * e voltaria quebrada na proxima armadura
 */

const ARCO = "willow_bow";
const ALJAVA = "aljava_arbalist";
const BOTAS = "botas_arbalist";
const CALCA = "calca_arbalist";
const CAPUZ = "capuz_arbalist";
const LUVAS = "luvas_arbalist";
const PEITO = "peito_arbalist";

/** as pecas do arbalist: duas armas e as cinco armaduras */
const arco = () => getItem(ARCO);
const aljava = () => getItem(ALJAVA);
const botas = () => getItem(BOTAS);
const calca = () => getItem(CALCA);
const capuz = () => getItem(CAPUZ);
const luvas = () => getItem(LUVAS);

/**
 * As pecas de um `slot` que pertencem a uma classe.
 *
 * Filtra pelo `classes` declarado, e nao por uma lista escrita a mao,
 * para o teste nao repetir a fonte de verdade do catalogo
 */
const equipaveisDoSlot = (slot, classId) =>
  Object.values(ITEMS).filter(
    (item) =>
      item.type === ITEM_TYPE.ARMOR &&
      item.slot === slot &&
      Array.isArray(item.classes) &&
      item.classes.includes(classId),
  );
const peito = () => getItem(PEITO);

/**
 * Uma peca de armadura que so existe durante o teste.
 *
 * O `ITEMS` e um objeto comum e exportado, entao um teste pode
 * plantar e arrancar uma entrada. E o jeito de exercitar a regra de
 * posicao sem trazer de volta um item que o jogador pediu para
 * remover
 */
const FIXTURES = [
  {
    id: "__test_capuz",
    name: "Capuz de Teste",
    icon: "C",
    rarity: "common",
    type: ITEM_TYPE.ARMOR,
    slot: "head",
    tier: 1,
    value: 1,
    stackable: false,
    maxStack: 1,
    stats: { defense: 5 },
  },
  {
    id: "__test_gibao",
    name: "Gibao de Teste",
    icon: "G",
    rarity: "common",
    type: ITEM_TYPE.ARMOR,
    slot: "chest",
    tier: 1,
    value: 1,
    stackable: false,
    maxStack: 1,
    stats: { defense: 7 },
  },
  {
    id: "__test_anel",
    name: "Anel de Teste",
    icon: "A",
    rarity: "common",
    type: ITEM_TYPE.TRINKET,
    slot: null,
    tier: 1,
    value: 1,
    stackable: false,
    maxStack: 1,
    stats: { attack: 3 },
  },
];

function plantarFixtures() {
  for (const item of FIXTURES) ITEMS[item.id] = item;
}

function arrancarFixtures() {
  for (const item of FIXTURES) delete ITEMS[item.id];
}

afterEach(arrancarFixtures);

describe("equipment slots", () => {
  it("exposes the expected slot layout", () => {
    const equipment = new Equipment();

    expect(equipment.getSlots()).toHaveLength(
      EQUIPMENT_SLOTS.length,
    );
  });

  it("tem os slots que o boneco desenha", () => {
    const ids = EQUIPMENT_SLOTS.map((slot) => slot.id);

    // a arma secundaria e as pecas de mao e de pe entraram depois
    expect(ids).toEqual([
      "weapon",
      "weapon2",
      "head",
      "gloves",
      "chest",
      "legs",
      "boots",
      "trinket1",
      "trinket2",
    ]);
  });

  it("as duas armas aceitam arma, e so arma", () => {
    const porId = Object.fromEntries(
      EQUIPMENT_SLOTS.map((slot) => [slot.id, slot]),
    );

    for (const id of ["weapon", "weapon2"]) {
      expect(porId[id].accepts, id).toEqual([
        ITEM_TYPE.WEAPON,
      ]);
    }
  });

  it("luvas e botas aceitam armadura, e nao arma", () => {
    const porId = Object.fromEntries(
      EQUIPMENT_SLOTS.map((slot) => [slot.id, slot]),
    );

    for (const id of ["gloves", "boots"]) {
      expect(porId[id].accepts, id).toEqual([
        ITEM_TYPE.ARMOR,
      ]);
    }
  });

  it("as calcas continuam com o id de sempre", () => {
    // O save grava o `id`, e um arquivo antigo tem `legs` gravado.
    // Renomear o id quebraria a restauracao de todo mundo que ja
    // tinha peca vestida: a peca sumiria do corpo ao carregar
    const calcas = EQUIPMENT_SLOTS.find(
      (slot) => slot.id === "legs",
    );

    expect(calcas).toBeTruthy();
    expect(calcas.name).toBe("Calças");
  });

  it("a arma principal vem antes da secundaria", () => {
    // A ordem do boneco decide o destino padrao de uma peca sem
    // posicao declarada. Com `weapon2` antes de `weapon`, o arco
    // saltaria para a mao esquerda sempre que a principal estivesse
    // ocupada
    const primary = EQUIPMENT_SLOTS.findIndex(
      (slot) => slot.id === "weapon",
    );
    const secondary = EQUIPMENT_SLOTS.findIndex(
      (slot) => slot.id === "weapon2",
    );

    expect(primary).toBeLessThan(secondary);
    expect(
      new Equipment().slotForItem("willow_bow"),
    ).toBe("weapon");
  });

  it("starts empty", () => {
    const equipment = new Equipment();

    expect(equipment.getEquippedItems()).toHaveLength(0);
    expect(equipment.bonuses()).toEqual({});
  });
});

describe("quais pecas ainda podem vestir", () => {
  it("o catalogo tem os sete do arbalist e os cinco do guerreiro", () => {
    // o arco, a aljava e as cinco armaduras do arqueiro; as cinco
    // armaduras do guerreiro. Este teste trava o estado: quando entrar
    // um item novo, ele quebra e alguem ve o catalogo grown
    //
    // a lista vem do `ITEMS` filtrado, e nao de uma escrita a mao,
    // para nao duplicar a fonte de verdade do catalogo
    const equipaveis = Object.values(ITEMS).filter(
      (item) =>
        item.type !== ITEM_TYPE.MATERIAL && item.tier > 0,
    );

    expect(equipaveis.map((item) => item.id)).toEqual([
      ARCO,
      ALJAVA,
      BOTAS,
      CALCA,
      CAPUZ,
      LUVAS,
      PEITO,
      "botas_warrior",
      "calca_warrior",
      "elmo_warrior",
      "luvas_warrior",
      "peito_warrior",
    ]);
  });

  it("as duas classes tem armadura propria, e nenhuma peca e das duas", () => {
    // O vazamento que motivou a armadura do guerreiro: o `kind` so
    // trava ARMA, entao a bota, a calca, o capuz, a luva e o peito do
    // arqueiro apareciam no craft de qualquer classe, e o guerreiro
    // via o conjunto inteiro do arqueiro
    //
    // Duas pecas com o mesmo slot e a mesma classe dona e o que
    // obrigaria a escolher entre as duas; o inverso — o mesmo `slot`
    // em classes diferentes — e o que o catalogo quer
    const PECAS = [
      "boots",
      "legs",
      "head",
      "gloves",
      "chest",
    ];

    for (const slot of PECAS) {
      const doArbalist = equipaveisDoSlot(slot, "arbalist");
      const doWarrior = equipaveisDoSlot(slot, "warrior");

      expect(doArbalist.length, `${slot} do arbalist`).toBe(1);
      expect(doWarrior.length, `${slot} do guerreiro`).toBe(1);

      expect(
        doArbalist[0].id,
        `${slot}: a peca e das duas classes`,
      ).not.toBe(doWarrior[0].id);
    }

    // e nenhuma peca de armadura ficou sem dona: uma peca com
    // `classes` vazio ou sem o campo volta a aparecer para todo mundo
    for (const item of Object.values(ITEMS)) {
      if (item.type !== ITEM_TYPE.ARMOR) continue;

      expect(
        Array.isArray(item.classes) && item.classes.length > 0,
        `${item.id} nao declara dona`,
      ).toBe(true);
    }
  });

  it("as pecas sao classificadas certo", () => {
    expect(isEquippable(arco())).toBe(true);
    expect(isEquippable(aljava())).toBe(true);
    expect(isEquippable(botas())).toBe(true);
    expect(isEquippable(calca())).toBe(true);
    expect(isEquippable(capuz())).toBe(true);
    expect(isEquippable(luvas())).toBe(true);
    expect(isEquippable(peito())).toBe(true);

    // material nao veste
    expect(isEquippable(getItem("slime_gel"))).toBe(false);

    // item que nao existe
    expect(isEquippable(null)).toBe(false);
  });

  it("as botas so entram no slot de pe", () => {
    // `slotNameFor` cai no primeiro slot do tipo quando o item nao
    // declara `slot`, e o primeiro slot de armadura e a cabeca. Sem
    // o `slot`, o jogador veria "Cabeca" num par de botas
    const equipment = new Equipment();

    expect(equipment.canEquip(BOTAS, "boots")).toBe(true);

    // e nao em nenhum dos outros slots de armadura
    expect(equipment.canEquip(BOTAS, "head")).toBe(false);
    expect(equipment.canEquip(BOTAS, "chest")).toBe(false);
    expect(equipment.canEquip(BOTAS, "gloves")).toBe(false);
    expect(equipment.canEquip(BOTAS, "legs")).toBe(false);
  });

  it("as botas sao a primeira armadura, e por isso nao tem familia", () => {
    // a trava de classe e a familia da ARMA. Armadura nao tem
    // familia, entao `canClassUseItem` solta para qualquer classe —
    // e por isso que `kind` e `null` aqui
    //
    // este teste trava essa EXPECTATIVA: se alguem pendurar uma
    // `kind` de arma nestas botas para prender a classe, a trava
    // passaria a existir por um campo que nao significa nada para
    // armadura, e o inventario aceitaria a peca num slot de arma
    expect(botas().kind).toBe(null);
    expect(botas().type).toBe(ITEM_TYPE.ARMOR);
  });

  it("as botas dao DEF e VEL, e nao ATQ", () => {
    // e a peca que se pisa no chao: o que importa nela e nao morrer
    // e chegar longe. Os bonus somam por stat em `applyEquipment`,
    // entao a DEF de outros slots se junta a esta
    const stats = botas().stats;

    expect(stats.defense, "DEF").toBeGreaterThan(0);
    expect(stats.speed, "VEL").toBeGreaterThan(0);
    expect(stats.attack ?? 0, "ATQ").toBe(0);
  });

  it("as calcas vao no slot legs, e nao em nenhum outro", () => {
    // O id do slot e `legs` mesmo com a peca virando "Calcas" no
    // texto: o save grava o id, e um arquivo antigo que tenha `legs`
    // continua restaurando no lugar certo. E o NOME do slot que o
    // jogador le
    const equipment = new Equipment();

    expect(equipment.canEquip(CALCA, "legs")).toBe(true);

    for (const outro of [
      "head",
      "gloves",
      "chest",
      "boots",
    ]) {
      expect(
        equipment.canEquip(CALCA, outro),
        outro,
      ).toBe(false);
    }
  });

  it("as calcas dao DEF e HP, e nao ATQ", () => {
    // a peca do corpo: o que ela faz e aguentar dano, e por isso HP
    // em vez de VEL como nas botas. Os bonus somam por stat, entao a
    // DEF do peito se junta a esta
    const stats = calca().stats;

    expect(stats.defense, "DEF").toBeGreaterThan(0);
    expect(stats.maxHp, "HP").toBeGreaterThan(0);
    expect(stats.attack ?? 0, "ATQ").toBe(0);
  });

  it("botas e calcas ocupam slots diferentes", () => {
    // se as duas tivessem o mesmo slot, vestir a segunda trocaria a
    // primeira e o arqueiro ficaria com uma peca so
    expect(botas().slot).toBe("boots");
    expect(calca().slot).toBe("legs");
  });

  it("as cinco armaduras sao livres, como armadura deve ser", () => {
    // a trava de classe e a familia da ARMA. As cinco armaduras nao
    // tem familia, entao `kind` e nulo e qualquer classe veste
    // qualquer uma
    for (const peca of [
      peito(),
      capuz(),
      luvas(),
      calca(),
      botas(),
    ]) {
      expect(peca.kind, peca.id).toBe(null);
      expect(peca.type, peca.id).toBe(ITEM_TYPE.ARMOR);
    }
  });

  it("o capuz vai so no slot da cabeca", () => {
    // o primeiro slot de armadura JA e a cabeca, entao aqui o `slot`
    // nao evita um slot errado: ele evita a peca ser aceita em
    // qualquer slot de armadura quando o `slot` fosse nulo
    const equipment = new Equipment();

    expect(equipment.canEquip(CAPUZ, "head")).toBe(true);

    for (const outro of [
      "gloves",
      "chest",
      "legs",
      "boots",
    ]) {
      expect(
        equipment.canEquip(CAPUZ, outro),
        outro,
      ).toBe(false);
    }
  });

  it("o capuz da DEF e attackSpeed, e nao ATQ", () => {
    // a pena na lateral e a peca que mira, entao o ganho dela e
    // velocidade de golpe e nao dano bruto. O `critRate` foi
    // tentado e nao cabe: `applyEquipment` so le sete stats, e um
    // stat fora dessa lista e bonus que o motor ignora
    const stats = capuz().stats;

    expect(stats.defense, "DEF").toBeGreaterThan(0);
    expect(stats.attackSpeed, "VEL. ATQ").toBeGreaterThan(0);
    expect(stats.attack ?? 0, "ATQ").toBe(0);
  });

  it("as luvas vao so no slot das maos", () => {
    const equipment = new Equipment();

    expect(equipment.canEquip(LUVAS, "gloves")).toBe(true);

    // sem `slot` a peca entraria em qualquer slot de armadura, e o
    // jogador veria "Cabeca" num par de luvas
    for (const outro of [
      "head",
      "chest",
      "legs",
      "boots",
    ]) {
      expect(
        equipment.canEquip(LUVAS, outro),
        outro,
      ).toBe(false);
    }
  });

  it("as luvas sao a unica peca com DEF e ATQ juntos", () => {
    // fecha a mao que segura o arco: e a peca que protege o golpe E
    // a mao que o da. Nenhuma outra do arbalist junta os dois — o
    // arco e so ATQ, o capuz e DEF mais velocidade, e as demais sao
    // so DEF
    const stats = luvas().stats;

    expect(stats.defense, "DEF").toBeGreaterThan(0);
    expect(stats.attack, "ATQ").toBeGreaterThan(0);
  });

  it("o peito so entra no slot do torso", () => {
    const equipment = new Equipment();

    expect(equipment.canEquip(PEITO, "chest")).toBe(true);

    for (const outro of [
      "head",
      "gloves",
      "legs",
      "boots",
    ]) {
      expect(
        equipment.canEquip(PEITO, outro),
        outro,
      ).toBe(false);
    }
  });

  it("o peito e a peca que mais protege, e ele mostra", () => {
    // o peito e onde o golpe chega, entao e a peca de DEF e HP mais
    // alta do catalogo. Um `expect` solto aqui nao diria nada: o que
    // trava e que ele bate a QUALQUER outra peca nos dois stats, o
    // que impede o balanceamento de se achatar num so numero
    for (const outra of [
      capuz(),
      luvas(),
      calca(),
      botas(),
      aljava(),
      arco(),
    ]) {
      expect(
        peito().stats.defense,
        `DEF contra ${outra.id}`,
      ).toBeGreaterThan(outra.stats.defense ?? 0);

      expect(
        peito().stats.maxHp,
        `HP contra ${outra.id}`,
      ).toBeGreaterThan(outra.stats.maxHp ?? 0);
    }
  });

  it("as pecas de armadura ocupam slots diferentes", () => {
    // se duas tivessem o mesmo slot, vestir a segunda trocaria a
    // primeira e o arqueiro ficaria com uma peca so
    const slots = [
      peito(),
      capuz(),
      luvas(),
      calca(),
      botas(),
    ].map((peca) => peca.slot);

    expect(slots).toEqual([
      "chest",
      "head",
      "gloves",
      "legs",
      "boots",
    ]);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("o arbalist tem peca em TODOS os slots de armadura", () => {
    // O conjunto fechou com o peito. Este teste e o que garante que
    // nao falta nenhuma: ele compara os slots declarados em
    // `EQUIPMENT_SLOTS` com os slots que as pecas do arbalist
    // ocupam, e nao conta pecas — contar deixaria passar um conjunto
    // com duas pecas no mesmo slot e uma faltando
    const slotsDeArmadura = EQUIPMENT_SLOTS.filter((slot) =>
      slot.accepts.includes(ITEM_TYPE.ARMOR),
    ).map((slot) => slot.id);

    const cobertos = new Set(
      [peito(), capuz(), luvas(), calca(), botas()].map(
        (peca) => peca.slot,
      ),
    );

    const semPeca = slotsDeArmadura.filter(
      (slot) => !cobertos.has(slot),
    );

    // antes do peito isto era `["chest"]`: o teste quebrava e dizia
    // o que faltava. Agora a lista e vazia, e a armadura esta
    // completa
    expect(semPeca).toEqual([]);
  });

  it("a aljava so entra no slot da arma secundaria", () => {
    // a aljava e a peca que fica nas costas, ao lado do arco na mao.
    // Se ela aceitasse o slot principal, equipar a segunda trocaria
    // a primeira e o arqueiro ficaria com uma peca so
    const equipment = new Equipment();

    expect(
      equipment.canEquip(ALJAVA, "weapon2"),
    ).toBe(true);

    // e nao na mao principal
    expect(
      equipment.canEquip(ALJAVA, "weapon"),
    ).toBe(false);
  });

  it("o arco so entra no slot de arma", () => {
    const equipment = new Equipment();

    expect(equipment.canEquip(ARCO, "weapon")).toBe(
      true,
    );

    for (const slotId of [
      "head",
      "chest",
      "legs",
      "trinket1",
      "trinket2",
    ]) {
      expect(
        equipment.canEquip(ARCO, slotId),
        slotId,
      ).toBe(false);
    }
  });

  it("as duas armas podem vestir ao mesmo tempo", () => {
    const equipment = new Equipment();

    // A secundaria existe para isso: duas pecas da mesma familia
    // nos dois slots, sem que uma puxe a outra para fora
    expect(
      equipment.equip(ARCO, "weapon"),
    ).toBe(null);
    expect(
      equipment.equip(ARCO, "weapon2"),
    ).toBe(null);

    expect(
      equipment.getEquipped("weapon")?.id,
    ).toBe(ARCO);
    expect(
      equipment.getEquipped("weapon2")?.id,
    ).toBe(ARCO);
  });

  it("trocar a secundaria nao mexe na principal", () => {
    plantarFixtures();

    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon");
    equipment.equip(ARCO, "weapon2", "legendary");

    const trocada = equipment.equip(
      ARCO,
      "weapon2",
      "rare",
    );

    // a principal continua como estava, na raridade natural do arco
    expect(
      equipment.getEquipped("weapon").rarity,
    ).toBe("uncommon");

    // e a secundaria trocou de variante, devolvendo a antiga
    expect(trocada.rarity).toBe("legendary");
  });

  it("material nao veste em lugar nenhum", () => {
    const equipment = new Equipment();

    for (const slot of EQUIPMENT_SLOTS) {
      expect(
        equipment.canEquip("slime_gel", slot.id),
        slot.id,
      ).toBe(false);
    }
  });

  it("recusa slot e item desconhecidos", () => {
    const equipment = new Equipment();

    expect(equipment.canEquip(ARCO, "anel")).toBe(
      false,
    );
    expect(
      equipment.canEquip("item_fantasma", "weapon"),
    ).toBe(false);
  });

  it("o arco nao declara posicao, entao a posicao nao o prende", () => {
    // `willow_bow.slot` e null: ele nao diz onde vai, e o slot de
    // arma e o unico que aceita o TIPO dele. Se um dia o arco
    // declarar `slot: "weapon"`, este teste avisa
    expect(arco().slot).toBe(null);
  });

  it("diz o nome do slot de destino", () => {
    expect(slotNameFor(arco())).toBe("Arma");
    expect(slotNameFor(getItem("slime_gel"))).toBe(null);
  });
});

describe("a regra de posicao", () => {
  it("a peca so entra no slot que ela declara", () => {
    plantarFixtures();

    const equipment = new Equipment();

    expect(
      equipment.canEquip("__test_capuz", "head"),
    ).toBe(true);
    expect(
      equipment.canEquip("__test_capuz", "chest"),
    ).toBe(false);
    expect(
      equipment.canEquip("__test_capuz", "legs"),
    ).toBe(false);

    expect(
      equipment.canEquip("__test_gibao", "chest"),
    ).toBe(true);
    expect(
      equipment.canEquip("__test_gibao", "head"),
    ).toBe(false);
  });

  it("peca sem posicao serve aos slots do mesmo tipo", () => {
    plantarFixtures();

    const equipment = new Equipment();

    // o anel nao declara posicao: ele serve de anel e de amuleto
    expect(
      equipment.canEquip("__test_anel", "trinket1"),
    ).toBe(true);
    expect(
      equipment.canEquip("__test_anel", "trinket2"),
    ).toBe(true);
  });

  it("diz em que slot cada peca tem que entrar", () => {
    plantarFixtures();

    const equipment = new Equipment();

    expect(equipment.slotForItem("__test_capuz")).toBe(
      "head",
    );
    expect(equipment.slotForItem("__test_gibao")).toBe(
      "chest",
    );
    expect(equipment.slotForItem(ARCO)).toBe("weapon");
  });

  it("peca sem posicao vai para um slot LIVRE do mesmo tipo", () => {
    plantarFixtures();

    const equipment = new Equipment();

    expect(equipment.slotForItem("__test_anel")).toBe(
      "trinket1",
    );

    // com o anel ocupado, o proximo destino e o outro slot de
    // reliquia
    equipment.equip("__test_anel", "trinket1");

    expect(equipment.slotForItem("__test_anel")).toBe(
      "trinket2",
    );
  });

  it("acha a peca que esta no slot errado", () => {
    plantarFixtures();

    const equipment = new Equipment();

    // um save antigo: o capuz no peito
    const chest = equipment.getSlot("chest");

    chest.itemId = "__test_capuz";
    chest.rarity = "legendary";

    expect(equipment.misplacedSlot()).toBe("chest");
    expect(equipment.misplacedSlots()).toEqual(["chest"]);
  });

  it("acha todas as pecas erradas de uma vez", () => {
    plantarFixtures();

    const equipment = new Equipment();

    equipment.getSlot("head").itemId = "__test_gibao";
    equipment.getSlot("chest").itemId = "__test_capuz";

    expect(equipment.misplacedSlots().sort()).toEqual([
      "chest",
      "head",
    ]);
  });

  it("nao acusa peca que esta no lugar certo", () => {
    plantarFixtures();

    const equipment = new Equipment();

    equipment.equip("__test_capuz", "head");
    equipment.equip("__test_gibao", "chest");

    expect(equipment.misplacedSlots()).toEqual([]);
  });

  it("nao acusa equipamento vazio", () => {
    expect(new Equipment().misplacedSlot()).toBe(null);
    expect(new Equipment().misplacedSlots()).toEqual([]);
  });

  it("devolve a peca ao slot sem conferir a posicao", () => {
    plantarFixtures();

    const equipment = new Equipment();

    // `restore` ignora a checagem de proposito: ele desfaz um
    // desequipar que nao coube na mochila, e `equip` recusaria a
    // mesma peca que a regra de posicao apontou
    expect(
      equipment.restore(
        { itemId: "__test_capuz", rarity: "rare" },
        "chest",
      ),
    ).toBe(true);

    expect(equipment.getSlot("chest").itemId).toBe(
      "__test_capuz",
    );
    expect(equipment.getSlot("chest").rarity).toBe("rare");

    // e slot que nao existe nao aceita
    expect(
      equipment.restore({ itemId: ARCO, rarity: null }, "anel"),
    ).toBe(false);
  });
});

describe("equipar", () => {
  it("preenche o slot e registra a peca", () => {
    const equipment = new Equipment();

    // devolve null quando o slot estava vazio
    expect(equipment.equip(ARCO, "weapon")).toBe(null);

    equipment.equip(ARCO, "weapon");

    expect(equipment.isEquipped(ARCO)).toBe(true);
    expect(equipment.getEquipped("weapon").name).toBe(
      "Arco de Galho",
    );
    expect(equipment.getEquipped("weapon").tier).toBe(1);
  });

  it("nao veste a mesma peca duas vezes no mesmo slot", () => {
    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon");

    expect(equipment.equip(ARCO, "weapon")).toBe(false);
  });

  it("veste a mesma peca em outra raridade", () => {
    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon", "rare");
    equipment.equip(ARCO, "weapon", "legendary");

    expect(
      equipment.getEquipped("weapon").rarity,
    ).toBe("legendary");
  });

  it("recusa peca no slot errado", () => {
    const equipment = new Equipment();

    expect(
      equipment.equip(ARCO, "head"),
    ).toBe(false);
    expect(equipment.getEquipped("head")).toBe(null);
  });

  it("devolve a peca anterior na mesma raridade ao trocar", () => {
    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon", "legendary");

    const trocada = equipment.equip(
      ARCO,
      "weapon",
      "rare",
    );

    // a variante anterior volta inteira: um arco lendario trocado
    // por um raro nao pode virar comum na mochila
    //
    // O `enchant: null` faz parte do combinado: a variante volta
    // junto com o afixo, e uma peca sem afixo devolve `null` no
    // lugar. Sem esta chave no `toEqual`, o teste passaria ignorando
    // o afixo e a peca poderia perder o dele na troca sem ninguem ver
    expect(trocada).toEqual({
      itemId: ARCO,
      rarity: "legendary",
      enchant: null,
    });
  });

  it("desequipar devolve a variante", () => {
    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon", "epic");

    expect(equipment.unequip("weapon")).toEqual({
      itemId: ARCO,
      rarity: "epic",
      enchant: null,
    });

    expect(equipment.getEquipped("weapon")).toBe(null);
  });

  it("ignora desequipar slot vazio", () => {
    expect(new Equipment().unequip("chest")).toBe(null);
  });
});

describe("bonuses", () => {
  it("some o stat da peca vestida", () => {
    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon");

    // arco de galho: 8 de ataque e 2% de velocidade
    expect(equipment.bonuses().attack).toBe(8);
  });

  it("escala o bonus com a raridade", () => {
    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon", "common");
    const fraco = equipment.bonuses().attack;

    equipment.equip(ARCO, "weapon", "legendary");

    // a mesma peca, mais cara em raridade, da mais poder
    expect(equipment.bonuses().attack).toBeGreaterThan(
      fraco,
    );
  });

  it("escala o bonus com o aprimoramento", () => {
    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon");

    const base = equipment.bonuses().attack;

    equipment.enhanceSlot("weapon");
    equipment.enhanceSlot("weapon");

    expect(equipment.getSlot("weapon").enhance).toBe(2);
    expect(equipment.bonuses().attack).toBeGreaterThan(
      base,
    );
  });

  it("nunca aprimora slot vazio", () => {
    expect(new Equipment().enhanceSlot("legs")).toBe(
      false,
    );
  });

  it("soma as pecas de slots diferentes", () => {
    plantarFixtures();

    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon");
    equipment.equip("__test_capuz", "head");

    const bonuses = equipment.bonuses();

    // 8 de ataque do arco + 5 de defesa do capuz
    expect(bonuses.attack).toBe(8);
    expect(bonuses.defense).toBe(5);
  });
});

describe("summary", () => {
  it("exposes slots, bonuses and power", () => {
    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon");

    const summary = equipment.summary();

    expect(summary.slots).toHaveLength(
      EQUIPMENT_SLOTS.length,
    );
    expect(summary.bonuses.attack).toBe(8);
    expect(summary.power).toBeGreaterThan(0);
  });

  it("reports zero power when empty", () => {
    expect(new Equipment().summary().power).toBe(0);
  });

  it("lists equipped items", () => {
    plantarFixtures();

    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon");
    equipment.equip("__test_capuz", "head");

    expect(equipment.getEquippedItems()).toHaveLength(2);
  });

  it("manda a raridade da variante no slot", () => {
    const equipment = new Equipment();

    equipment.equip(ARCO, "weapon", "epic");

    const slot = equipment
      .summary()
      .slots.find((entry) => entry.id === "weapon");

    expect(slot.rarity).toBe("epic");
  });
});
