import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_IDS,
  baseAttributes,
  attributesForLevel,
  buildStatSheet,
  formatBonus,
  formatStat,
  STAT_BY_ID,
  STAT_DEFS,
  STAT_GROUPS,
  statValueOf,
} from "./StatSheet.js";
import {
  CHARACTER_CLASSES,
  getCharacterDefinition,
} from "../../data/characters/index.js";
import { statsForLevel } from "../progression/Levels.js";

/**
 * A folha de stats do personagem.
 *
 * O defeito que este arquivo segura nao aparece no painel: o painel
 * mostra o que a folha entrega, e ele ficaria bonito e errado do
 * mesmo jeito. O que quebra e a RELACAO entre a folha e o resto do
 * jogo — o ATK da tela tem de ser o `player.attack`, e `base + bonus`
 * tem de fechar em todas as linhas
 */

const folhaDe = (classId, level = 1, bonus = {}) =>
  buildStatSheet(getCharacterDefinition(classId), level, bonus);

describe("o catalogo de stats", () => {
  it("tem os vinte e seis stats, e nenhum repetido", () => {
    expect(STAT_DEFS).toHaveLength(26);

    const ids = STAT_DEFS.map((def) => def.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cobre os cinco atributos", () => {
    for (const id of ATTRIBUTE_IDS) {
      expect(STAT_BY_ID[id], id).toBeTruthy();
      expect(STAT_BY_ID[id].group, id).toBe("atributos");
      expect(STAT_BY_ID[id].attribute, id).toBe(true);
    }
  });

  it("todo stat pertence a um grupo que existe", () => {
    const grupos = new Set(STAT_GROUPS.map((g) => g.id));

    for (const def of STAT_DEFS) {
      expect(grupos.has(def.group), def.id).toBe(true);
    }
  });

  it("todo stat tem rotulo, nome e unidade", () => {
    // o rotulo e o que o jogador le e o nome e o que ele descobre no
    // `title`. Sem os dois, a linha vira um codigo so
    for (const def of STAT_DEFS) {
      expect(def.label, def.id).toBeTruthy();
      expect(def.name, def.id).toBeTruthy();
      expect(
        ["integer", "percent", "perSecond", "multiplier"],
        def.unit,
      ).toContain(def.unit);
    }
  });

  it("agrupa na ordem de leitura", () => {
    expect(STAT_GROUPS.map((g) => g.id)).toEqual([
      "atributos",
      "combate",
      "recursos",
      "progresso",
    ]);
  });
});

describe("a base de cada classe", () => {
  it("todas as quatro classes tem os cinco atributos", () => {
    // uma classe sem VIT apareceria com VIT 0 na folha, e o jogador
    // leria "VIT 0" como um defeito do personagem em vez de um
    // atributo que aquela classe nao tem
    for (const classe of CHARACTER_CLASSES) {
      const atributos = baseAttributes(classe);

      for (const id of ATTRIBUTE_IDS) {
        expect(
          atributos[id],
          `${classe.id}.${id}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("a base e a mesma em qualquer nivel", () => {
    for (const classe of CHARACTER_CLASSES) {
      const base = baseAttributes(classe);

      expect(attributesForLevel(classe, 1)).toEqual(base);
    }
  });

  it("sobe com o nivel, e no ritmo da classe", () => {
    for (const classe of CHARACTER_CLASSES) {
      const nivel1 = attributesForLevel(classe, 1);
      const nivel20 = attributesForLevel(classe, 20);

      for (const id of ATTRIBUTE_IDS) {
        expect(
          nivel20[id],
          `${classe.id}.${id}`,
        ).toBeGreaterThan(nivel1[id]);
      }
    }
  });

  it("as classes se separam em nivel alto", () => {
    // o teste de que a folha vale como COMPARACAO entre classes: se
    // todas crescessem igual, o painel seria a mesma tabela quatro
    // vezes e o jogador nao escolheria classe por atributo
    const guerreiro = attributesForLevel(
      getCharacterDefinition("warrior"),
      40,
    );

    const sorcerer = attributesForLevel(
      getCharacterDefinition("sorcerer"),
      40,
    );

    expect(guerreiro.vit).toBeGreaterThan(sorcerer.vit);
    expect(sorcerer.int).toBeGreaterThan(guerreiro.int);
  });

  it("cada atributo move pelo menos um stat derivado", () => {
    // um atributo que so aparece na linha dele e enfeite. Cada um dos
    // cinco tem de mexer em algo, senao o jogador nao descobre o que
    // aquele numero faz
    const alvos = {
      str: ["penetration"],
      int: ["magicAttack", "equipmentDropRate"],
      dex: ["accuracy", "evasion", "dropRate"],
      vit: ["hpRegen", "magicDefense"],
      wis: ["magicDefense", "xpGain", "goldGain"],
    };

    for (const classe of CHARACTER_CLASSES) {
      for (const [atributo, derivados] of Object.entries(
        alvos,
      )) {
        const semBonus = buildStatSheet(classe, 20, {});
        const comBonus = buildStatSheet(classe, 20, {
          [atributo]: 6,
        });

        const moveu = derivados.some(
          (id) =>
            comBonus.byId[id].total > semBonus.byId[id].total,
        );

        expect(
          moveu,
          `${classe.id}: +6 de ${atributo} nao moveu nenhum derivado`,
        ).toBe(true);
      }
    }
  });
});

describe("base, bonus e total", () => {
  it("a soma fecha em toda linha, com e sem bonus", () => {
    const cenarios = [
      [1, {}],
      [9, {}],
      [40, { attack: 40, vit: 5 }],
      [12, { attackSpeed: 0.08, maxHp: 200, critRate: 0.05 }],
    ];

    for (const classe of CHARACTER_CLASSES) {
      for (const [nivel, bonus] of cenarios) {
        const folha = buildStatSheet(classe, nivel, bonus);

        for (const row of folha.rows) {
          expect(
            row.base + row.bonus,
            `${classe.id} nv${nivel} ${row.id}`,
          ).toBeCloseTo(row.total, 6);
        }
      }
    }
  });

  it("sem bonus nenhum, a base e o total", () => {
    // no nivel 1 e sem item, o personagem e a classe: e o que faz a
    // coluna `base` ter sentido de "o que a classe entrega"
    for (const classe of CHARACTER_CLASSES) {
      const folha = buildStatSheet(classe, 1, {});

      for (const row of folha.rows) {
        expect(row.bonus, row.id).toBe(0);
        expect(row.total, row.id).toBeCloseTo(row.base, 6);
      }
    }
  });

  it("todo bonus cresce ou some, nunca fica negativo sozinho", () => {
    const folha = folhaDe("arbalist", 20, {
      attack: 30,
      maxHp: 300,
      vit: 4,
    });

    expect(folha.byId.attack.bonus).toBeGreaterThan(0);
    expect(folha.byId.maxHp.bonus).toBeGreaterThan(0);
    expect(folha.byId.vit.bonus).toBeGreaterThan(0);
  });

  it("um bonus de item move a linha que NAO e atributo", () => {
    // a comparacao e no MESMO nivel, sem e com a peca: e o que separa
    // "o bonus desta peca" do "o quanto eu ganhei subindo de nivel",
    // que sao duas coisas que o jogador precisa ver separadas na tela
    const semPeca = folhaDe("arbalist", 20, {});
    const comPeca = folhaDe("arbalist", 20, {
      attack: 30,
      maxHp: 300,
      vit: 4,
    });

    expect(comPeca.byId.attack.total).toBe(
      semPeca.byId.attack.total + 30,
    );
    expect(comPeca.byId.maxHp.total).toBe(
      semPeca.byId.maxHp.total + 300,
    );
    expect(comPeca.byId.vit.total).toBe(
      semPeca.byId.vit.total + 4,
    );

    // e o que a peca NAO deu continua zero, mesmo com nivel alto: o
    // bonus dela e zero, nao o bonus do nivel
    expect(
      comPeca.byId.accuracy.total,
      "a peca de +30 ATK inventou precisao",
    ).toBe(semPeca.byId.accuracy.total);
  });

  it("o bonus de atributo aparece uma vez so", () => {
    // o ponto e somado nos atributos E lido de novo na linha do
    // atributo. Somando nos dois lugares, uma peca de +5 VIT subia o
    // atributo em 10 — que e o tipo de erro que so se ve comparando
    // a folha com o item
    const classe = getCharacterDefinition("arbalist");

    const semPeca = buildStatSheet(classe, 9, {});
    const comPeca = buildStatSheet(classe, 9, { vit: 5 });

    expect(comPeca.byId.vit.total - semPeca.byId.vit.total).toBe(
      5,
    );
  });
});

describe("a folha bate com o combate", () => {
  it("o ATK da folha e o player.attack", () => {
    // a promessa mais importante do arquivo: o numero que o painel
    // mostra como ATK e o MESMO que o motor usa no golpe. Sao as
    // duas contas feitas em lugares diferentes, e elas so podem
    // concordar se forem a mesma conta
    const classe = CHARACTER_CLASSES[3];

    for (const nivel of [1, 7, 15, 40]) {
      for (const bonus of [
        {},
        { attack: 33, maxHp: 120, defense: 9 },
      ]) {
        const folha = buildStatSheet(classe, nivel, bonus);
        const growth = statsForLevel(nivel);

        const esperado =
          classe.stats.attack + growth.attack + (bonus.attack ?? 0);

        expect(
          folha.byId.attack.total,
          `nv${nivel}`,
        ).toBe(esperado);
      }
    }
  });

  it("a DEF, o HP e o MP da folha batem com o motor", () => {
    const classe = CHARACTER_CLASSES[0];
    const folha = buildStatSheet(classe, 22, {
      defense: 14,
      maxHp: 250,
    });

    const growth = statsForLevel(22);

    expect(folha.byId.defense.total).toBe(
      classe.stats.defense + growth.defense + 14,
    );
    expect(folha.byId.maxHp.total).toBe(
      classe.stats.hp + growth.maxHp + 250,
    );
    expect(folha.byId.maxResource.total).toBe(
      classe.stats.resource,
    );
  });

  it("a velocidade e a cadencia da folha batem com o motor", () => {
    const classe = CHARACTER_CLASSES[1];
    const folha = buildStatSheet(classe, 10, {
      speed: 6,
      attackSpeed: 0.08,
    });

    expect(folha.byId.movementSpeed.total).toBe(
      classe.stats.speed + 6,
    );
    expect(folha.byId.attackSpeed.total).toBeCloseTo(
      classe.stats.attackSpeed + 0.08,
      6,
    );
  });

  it("o MSPD e o `speed` que o motor ja usava", () => {
    // o MSPD e um nome novo para um campo que ja existia. Se o id
    // da folha fosse `movementSpeed` e o motor lesse `speed`, o painel
    // mostraria o bonus de velocidade duas vezes
    const classe = CHARACTER_CLASSES[2];

    const folha = buildStatSheet(classe, 5, { speed: 9 });

    expect(STAT_BY_ID.movementSpeed.id).toBe("movementSpeed");
    expect(folha.byId.movementSpeed.bonus).toBe(9);
  });

  it("o MP aceita os dois nomes que o bonus pode trazer", () => {
    // o motor le `bonus.resource`, e o painel fala em MP. Sem aceitar
    // os dois nomes, uma peca que declarasse `maxResource` moveria o
    // painel e nao moveria o personagem
    const classe = CHARACTER_CLASSES[0];

    expect(
      buildStatSheet(classe, 1, { resource: 30 })
        .byId.maxResource.total,
    ).toBe(classe.stats.resource + 30);

    expect(
      buildStatSheet(classe, 1, { maxResource: 30 })
        .byId.maxResource.total,
    ).toBe(classe.stats.resource + 30);
  });
});

describe("a leitura dos numeros", () => {
  it("inteiro arredonda, e percentual mostra fracao como porcento", () => {
    expect(formatStat(STAT_BY_ID.attack, 104.6)).toBe("105");
    expect(formatStat(STAT_BY_ID.critRate, 0.25)).toBe("25%");
    expect(formatStat(STAT_BY_ID.evasion, 0.083)).toBe("8,3%");
  });

  it("multiplicador e cadencia tem a unidade na tela", () => {
    expect(formatStat(STAT_BY_ID.critDamage, 2)).toBe("2,00x");
    expect(formatStat(STAT_BY_ID.attackSpeed, 1.4)).toBe(
      "1,40/s",
    );
  });

  it("o bonus zero some, e o positivo ganha o sinal", () => {
    // um "+0" em vinte e seis linhas e ruido. O que o jogador procura
    // na coluna do meio e o que mudou
    expect(formatBonus(STAT_BY_ID.attack, 0)).toBe("");
    expect(formatBonus(STAT_BY_ID.attack, 40)).toBe("+40");
    expect(formatBonus(STAT_BY_ID.attack, -8)).toBe("-8");
    expect(formatBonus(STAT_BY_ID.evasion, 0)).toBe("");
  });

  it("a porcentagem de bonus tambem e fracao", () => {
    // 0.015 de chance de drop tem de sair como +1,5%. Multiplicando
    // por 100 duas vezes sairia +150%, que e um numero que faz o
    // jogador achar que o item e melhor do que e
    expect(formatBonus(STAT_BY_ID.dropRate, 0.015)).toBe(
      "+1,5%",
    );
  });

  it("le um stat pela id", () => {
    const folha = folhaDe("warrior", 3);

    expect(statValueOf(folha, "attack")).toBe(
      folha.byId.attack.total,
    );
    expect(statValueOf(folha, "stat_que_nao_existe")).toBe(
      null,
    );
  });
});

describe("o que o motor ja calculou", () => {
  /**
   * A folha aceita os numeros que o MOTOR ja gravou.
   *
   * Sem isto a folha seria uma segunda conta da mesma formula, e as
   * duas so podem concordar por enquanto. O caso que ja divergiu: o
   * servidor nao roda `applyEquipment` ao entrar, entao o
   * `player.attack` de quem acabou de logar e o valor cru da classe e
   * o offline ja tem o crescimento do nivel 1. Uma folha que
   * recalculasse mostraria 107 para um golpe que usa 104
   */
  it("usa o numero do motor quando ele existe", () => {
    const classe = getCharacterDefinition("arbalist");

    const folha = buildStatSheet(classe, 9, {}, {
      attack: 104,
      defense: 18,
      maxHp: 700,
      maxResource: 125,
      speed: 230,
    });

    expect(folha.byId.attack.total).toBe(104);
    expect(folha.byId.defense.total).toBe(18);
    expect(folha.byId.maxHp.total).toBe(700);
    expect(folha.byId.maxResource.total).toBe(125);
    expect(folha.byId.movementSpeed.total).toBe(230);

    // e a soma ainda fecha: o bonus absorve a diferenca entre o que o
    // motor gravou e o que a classe daria
    for (const row of folha.rows) {
      expect(row.base + row.bonus, row.id).toBeCloseTo(
        row.total,
        6,
      );
    }
  });

  it("calcula a propria parte quando o motor nao diz nada", () => {
    // os cinco stat derivados do atributo NAO tem campo no jogador,
    // entao a folha tem de saber fazer a conta deles sozinha
    const classe = getCharacterDefinition("sorcerer");

    const comMotor = buildStatSheet(classe, 9, {}, {
      attack: 1,
    });

    const semMotor = buildStatSheet(classe, 9, {});

    for (const id of [
      "magicAttack",
      "magicDefense",
      "accuracy",
      "evasion",
      "penetration",
      "hpRegen",
      "dropRate",
      "goldGain",
      "enhanceSuccess",
    ]) {
      expect(
        comMotor.byId[id].total,
        id,
      ).toBe(semMotor.byId[id].total);
    }
  });

  it("ignora um numero do motor que nao e numero", () => {
    const classe = getCharacterDefinition("warrior");

    const suja = buildStatSheet(classe, 5, {}, {
      attack: "104",
      maxHp: NaN,
      speed: undefined,
    });

    const limpa = buildStatSheet(classe, 5, {});

    for (const row of suja.rows) {
      expect(
        Number.isFinite(row.total),
        row.id,
      ).toBe(true);

      expect(
        row.total,
        row.id,
      ).toBeCloseTo(limpa.byId[row.id].total, 6);
    }
  });
});

describe("os grupos da folha", () => {
  it("traz as vinte e seis linhas, uma vez cada", () => {
    const folha = folhaDe("sorcerer", 10);

    const total = folha.groups.reduce(
      (soma, group) => soma + group.rows.length,
      0,
    );

    expect(total).toBe(STAT_DEFS.length);

    const ids = folha.groups.flatMap((g) =>
      g.rows.map((r) => r.id),
    );

    expect(new Set(ids).size).toBe(STAT_DEFS.length);
  });

  it("nao repete a ordem dos grupos em outro lugar", () => {
    // a ordem mora em `STAT_GROUPS` e so ali. O painel usa a ordem que
    // veio, e nenhum grupo repete a lista de categorias
    const folha = folhaDe("warrior", 1);

    expect(
      folha.groups.map((g) => g.id),
    ).toEqual(
      STAT_GROUPS.filter((g) =>
        STAT_DEFS.some((d) => d.group === g.id),
      ).map((g) => g.id),
    );
  });
});

describe("folha sem classe", () => {
  it("nao estoura quando a classe nao existe", () => {
    // um id de classe invalido no save nao pode derrubar o painel
    // inteiro: o jogador perderia a tela por causa de um dado
    const folha = buildStatSheet(null, 5, {});

    expect(folha.rows).toHaveLength(STAT_DEFS.length);

    for (const row of folha.rows) {
      expect(Number.isFinite(row.total), row.id).toBe(true);
      expect(row.base + row.bonus, row.id).toBeCloseTo(
        row.total,
        6,
      );
    }
  });

  it("aceita nivel bagunçado", () => {
    for (const nivel of [undefined, null, 0, -5, 3.7, NaN]) {
      const folha = buildStatSheet(
        getCharacterDefinition("warrior"),
        nivel,
        {},
      );

      expect(folha.level, String(nivel)).toBeGreaterThanOrEqual(1);

      for (const row of folha.rows) {
        expect(Number.isFinite(row.total), row.id).toBe(true);
      }
    }
  });

  it("descarta bonus que nao e numero", () => {
    // `attack: "dez"` num item velho somaria `"dez"` no ATK e viraria
    // `"107dez"`, e a conta do bonus — `"107dez" - 107` — daria `NaN`
    // nas 26 linhas. A comparacao e com a folha sem bonus nenhum NO
    // MESMO nivel: o que importa e que o texto entrou como zero
    const classe = getCharacterDefinition("warrior");

    const suja = buildStatSheet(classe, 5, {
      attack: "dez",
      vit: NaN,
      dex: Infinity,
    });

    const limpa = buildStatSheet(classe, 5, {});

    for (const row of suja.rows) {
      expect(
        Number.isFinite(row.total),
        `${row.id} virou NaN`,
      ).toBe(true);

      expect(
        row.total,
        `${row.id} absorveu o bonus quebrado`,
      ).toBeCloseTo(limpa.byId[row.id].total, 6);
    }
  });
});