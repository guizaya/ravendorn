import { describe, expect, it } from "vitest";
import {
  CLASS_WEAPON_KINDS,
  ITEM_TYPE,
  ITEM_LIST,
  WEAPON_KIND,
  WEAPON_KIND_LABEL,
  canClassUseItem,
  classesOfWeaponKind,
  getItem,
  weaponKindsOfClass,
} from "./index.js";
import { CHARACTER_CLASSES } from "../characters/index.js";

/** os stats que o applyEquipment do engine realmente le */
const PIPELINE_STATS = new Set([
  "maxHp",
  "resource",
  "attack",
  "defense",
  "speed",
  "attackSpeed",
  "resourceRegen",
]);

const WEAPONS = ITEM_LIST.filter(
  (item) => item.type === ITEM_TYPE.WEAPON,
);

describe("familia de arma", () => {
  it("toda arma do catalogo tem familia", () => {
    for (const item of WEAPONS) {
      expect(
        item.kind,
        item.id,
      ).toBeTruthy();
    }
  });

  it("toda familia tem rotulo em portugues", () => {
    for (const kind of Object.values(WEAPON_KIND)) {
      expect(
        WEAPON_KIND_LABEL[kind],
        kind,
      ).toBeTruthy();
    }
  });

  it("nenhum item fora de arma tem familia", () => {
    for (const item of ITEM_LIST) {
      if (item.type === ITEM_TYPE.WEAPON) continue;

      expect(
        item.kind,
        item.id,
      ).toBe(null);
    }
  });

  it("as 8 classes tem familia declarada", () => {
    for (const entry of CHARACTER_CLASSES) {
      expect(
        weaponKindsOfClass(entry.id).length,
        entry.id,
      ).toBeGreaterThan(0);
    }
  });

  it("toda familia declarada pertence a alguma classe", () => {
    for (const [classId, kinds] of Object.entries(
      CLASS_WEAPON_KINDS,
    )) {
      for (const kind of kinds) {
        expect(
          classesOfWeaponKind(kind),
          `${classId} -> ${kind}`,
        ).toContain(classId);
      }
    }
  });

  it("toda familia usada por uma arma tem dono", () => {
    for (const item of WEAPONS) {
      expect(
        classesOfWeaponKind(item.kind).length,
        `${item.id} (${item.kind})`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("arma por classe", () => {
  /**
   * Depois da limpeza do catalogo, o arco de galho e a UNICA arma.
   *
   * As familias e o mapa `CLASS_WEAPON_KINDS` continuam inteiros: e a
   * regra que vai valer quando as proximas armas entram. O que mudou
   * e quem tem arma no catalogo hoje, e este bloco descreve isso sem
   * fingir que as outras classes ainda criam algo
   */
  it("so o arqueiro tem arma no catalogo", () => {
    const comArma = CHARACTER_CLASSES.filter((entry) =>
      WEAPONS.some((item) => canClassUseItem(item, entry.id)),
    ).map((entry) => entry.id);

    expect(comArma).toEqual(["arbalist"]);
  });

  it("o arqueiro cria o arco e nao pode usar o resto", () => {
    const bow = getItem("willow_bow");

    expect(bow.kind).toBe(WEAPON_KIND.BOW);
    expect(canClassUseItem(bow, "arbalist")).toBe(true);

    for (const entry of CHARACTER_CLASSES) {
      if (entry.id === "arbalist") continue;

      expect(
        canClassUseItem(bow, entry.id),
        entry.id,
      ).toBe(false);
    }
  });

  it("a familia do arco ainda e do arquiro, e nao de mais ninguem", () => {
    expect(classesOfWeaponKind(WEAPON_KIND.BOW)).toEqual([
      "arbalist",
    ]);

    // as outras familias continuam mapeadas, e sem arma no catalogo
    // nao quebra o mapa: a regra e por familia, nao por item
    for (const kind of Object.values(WEAPON_KIND)) {
      expect(
        classesOfWeaponKind(kind).length,
        kind,
      ).toBeGreaterThan(0);
    }
  });

  it("as familias sem arma no catalogo nao viram item invalido", () => {
    // Sword, lance, staff, dagger e mace ficaram sem nenhum item. A
    // espadas antes apontava para um item removido e o teste lia
    // `null.kind`; agora o caminho e olhar a arma que sobrou
    const kindsNoCatalogo = WEAPONS.map((item) => item.kind);

    expect(new Set(kindsNoCatalogo)).toEqual(
      new Set([WEAPON_KIND.BOW]),
    );
  });

  it("o cajado pertence a sorcerer, e nao ao guerreiro", () => {
    // a regra continua valendo por FAMILIA, e nao por item: o cajado
    // saiu do catalogo, mas a familia `staff` continua existindo e
    // a `sorcerer` e a unica classe que a trabalha agora
    expect(
      classesOfWeaponKind(WEAPON_KIND.STAFF),
    ).toEqual(["sorcerer"]);

    expect(
      classesOfWeaponKind(WEAPON_KIND.STAFF),
    ).not.toContain("warrior");
  });

  it("o enum de familias e as classes sao a mesma coisa dos dois lados", () => {
    // Este e o teste que prende as duas listas uma na outra. As
    // familias e as classes entraram e saem juntas: quando o darkist e
    // o lionheart sairam, `dagger` e `mace` foram do enum, porque
    // elas eram a arma deles e mais ninguem. Sem este teste, uma
    // familia orfa sobrevivia no enum e um item dela, se voltasse ao
    // catalogo, seria inWearavel por qualquer classe
    const familias = Object.values(WEAPON_KIND);

    // toda familia do enum pertence a alguma classe
    for (const kind of familias) {
      expect(
        classesOfWeaponKind(kind).length,
        `${kind} sem classe`,
      ).toBeGreaterThan(0);
    }

    // e nenhuma classe trabalha numa familia fora do enum
    for (const classe of CHARACTER_CLASSES) {
      for (const kind of weaponKindsOfClass(classe.id)) {
        expect(familias, `${classe.id} -> ${kind}`).toContain(kind);
      }
    }

    // alem disso, sao os mesmos numeros: uma familia por classe
    expect(familias.length).toBe(CHARACTER_CLASSES.length);
  });

  it("reliquia continua livre para qualquer classe", () => {
    // O nome deste teste ja afirmava que ARMADURA nao era travada por
    // classe, e parou de ser verdade quando o guerreiro ganhou
    // armadura propria. O corpo nunca testou armadura — o `continue`
    // pulava ela — entao o que ele mede e so a reliquia, que continua
    // sem dona
    //
    // A trava da armadura esta em "a armadura declara a sua dona"
    for (const item of ITEM_LIST) {
      if (item.type !== ITEM_TYPE.TRINKET) continue;

      for (const entry of CHARACTER_CLASSES) {
        expect(
          canClassUseItem(item, entry.id),
          `${item.id} em ${entry.id}`,
        ).toBe(true);
      }
    }
  });

  it("a armadura declara a sua dona", () => {
    // Toda peca de armadura do catalogo tem que declarar `classes`.
    // O padrao do `createItem` e `null`, que significa "de todo mundo"
    // — e um padrao silencioso, que e exatamente o que gerou o
    // vazamento: uma peca nova escrita sem o campo aparece para todo
    // mundo e nenhum teste reclama
    const armaduras = ITEM_LIST.filter(
      (item) => item.type === ITEM_TYPE.ARMOR,
    );

    expect(armaduras.length).toBeGreaterThan(0);

    for (const item of armaduras) {
      expect(
        Array.isArray(item.classes),
        `${item.id} nao tem \`classes\` como lista`,
      ).toBe(true);

      expect(
        item.classes.length,
        `${item.id} nao declara dona nenhuma`,
      ).toBeGreaterThan(0);

      for (const classId of item.classes) {
        expect(
          CHARACTER_CLASSES.some((c) => c.id === classId),
          `${item.id} declara a classe inexistente ${classId}`,
        ).toBe(true);
      }
    }
  });

  it("a armadura de uma classe e recusada pelas outras", () => {
    // O vazamento reportado: o `kind` so trava ARMA, entao as cinco
    // pecas do arqueiro apareciam no craft do guerreiro
    for (const item of ITEM_LIST) {
      if (item.type !== ITEM_TYPE.ARMOR) continue;

      const donas = item.classes;

      for (const entry of CHARACTER_CLASSES) {
        const esperada = donas.includes(entry.id);

        expect(
          canClassUseItem(item, entry.id),
          `${item.id} em ${entry.id}`,
        ).toBe(esperada);
      }
    }
  });

  it("as duas classes tem uma peca em cada slot de armadura", () => {
    // O conjunto e o que o jogador espera: cinco pecas em cinco slots.
    // Se o guerreiro ficasse com um buraco num slot, ele veria um slot
    // vazio que ninguem consegue preencher
    const SLOTS = ["boots", "legs", "head", "gloves", "chest"];

    for (const classId of ["arbalist", "warrior"]) {
      for (const slot of SLOTS) {
        const pecas = ITEM_LIST.filter(
          (item) =>
            item.type === ITEM_TYPE.ARMOR &&
            item.slot === slot &&
            item.classes.includes(classId),
        );

        expect(
          pecas.length,
          `${classId} no slot ${slot}`,
        ).toBe(1);
      }
    }
  });

  it("material continua livre para qualquer classe", () => {
    // A excecao que fecha a cadeia: se o ingrediente fosse de uma
    // classe so, ninguem comecaria a construir a arma dela
    for (const item of ITEM_LIST) {
      if (item.type !== ITEM_TYPE.MATERIAL) continue;

      for (const entry of CHARACTER_CLASSES) {
        expect(
          canClassUseItem(item, entry.id),
          `${item.id} em ${entry.id}`,
        ).toBe(true);
      }
    }
  });

  it("arma sem familia nao trava ninguem", () => {
    const nameless = {
      type: ITEM_TYPE.WEAPON,
      kind: null,
    };

    for (const entry of CHARACTER_CLASSES) {
      expect(
        canClassUseItem(nameless, entry.id),
      ).toBe(true);
    }
  });

  it("classe desconhecida nao cria arma de familia", () => {
    expect(
      canClassUseItem(getItem("willow_bow"), "bardo"),
    ).toBe(false);
  });

  it("item inexistente nunca e usavel", () => {
    expect(canClassUseItem(null, "warrior")).toBe(false);
  });

  it("devolve os nomes de classe de uma familia", () => {
    // e o que o painel mostra em "Quem cria isso"
    for (const kind of Object.values(WEAPON_KIND)) {
      const ids = classesOfWeaponKind(kind);

      for (const id of ids) {
        expect(
          CHARACTER_CLASSES.some(
            (entry) => entry.id === id,
          ),
          id,
        ).toBe(true);
      }
    }
  });
});

describe("stats dos itens", () => {
  it("todo item usa so stats que o engine aplica", () => {
    // um stat fora do pipeline e silenciosamente ignorado pelo
    // applyEquipment, e ainda aparece como "+0" na tooltip
    for (const item of ITEM_LIST) {
      for (const stat of Object.keys(item.stats ?? {})) {
        expect(
          PIPELINE_STATS.has(stat),
          `${item.id} usa ${stat}`,
        ).toBe(true);
      }
    }
  });

  it("todo item de equipamento tem algum stat", () => {
    for (const item of ITEM_LIST) {
      /**
       * O que separa "equipamento" de "resto" e o SLOT, e nao o tipo.
       *
       * A versao anterior pulava `ITEM_TYPE.MATERIAL` pelo nome, e
       * isso quebrou no primeiro item que nao e nem material nem
       * equipamento: a pocao de cura tem tipo novo e nao tem stat
       * nenhum — ela tem `use`. Um item sem `slot` nao vai para a
       * roupa por definicao, entao e ele que decide o pulo
       *
       * Filtrar por tipo exigiria lembrar de acrescentar cada tipo novo
       * aqui, e o esquecimento apareceria como um falso positivo neste
       * teste
       */
      if (!item.slot) continue;

      expect(
        Object.keys(item.stats ?? {}).length,
        item.id,
      ).toBeGreaterThan(0);
    }
  });
});
