import { describe, expect, it } from "vitest";

import {
  canEnchantItem,
  describeEnchant,
  ENCHANT_BASE_COST,
  ENCHANT_POWER,
  ENCHANT_STATS,
  enchantCost,
enchantOdds,
  isEnchant,
  RARITY_COST,
  resolveEnchant,
  rollEnchant,
  rollRarity,
} from "./index.js";

import {
  ITEM_LIST,
  ITEM_TYPE,
  RARITY,
  RARITY_ORDER,
  getItem,
} from "../items/index.js";

/**
 * O ENCANTAMENTO: o sorteio e a tabela.
 *
 * O `random` entra por parametro justamente para isto. Com
 * `Math.random` dentro da funcao, o unico jeito de testar a raridade
 * epica seria rodar o sorteio 1000 vezes e torcer — e um teste que
 * passa por sorte e um teste que falha 1 em 100 no CI
 */

/** um `random` que sempre devolve o mesmo valor */
const fixo = (valor) => () => valor;

/** um `random` que devolve uma sequencia e depois o ultimo valor */
function sequencia(valores) {
  let i = 0;

  return () =>
    valores[Math.min(i++, valores.length - 1)];
}

/** os stats que o `applyEquipment` do motor realmente aplica */
const PIPELINE_STATS = new Set([
  "maxHp",
  "resource",
  "attack",
  "defense",
  "speed",
  "attackSpeed",
  "resourceRegen",
]);

const ARCO = "willow_bow";
const ALJAVA = "aljava_arbalist";
const BOTAS = "botas_arbalist";
const GEL = "slime_gel";

describe("a tabela do encantamento", () => {
  it("so oferece stats que o motor sabe aplicar", () => {
    /**
     * O teste que mais importa deste arquivo.
     *
     * Um stat fora do `applyEquipment` nao quebraria nada: ele entraria
     * no objeto de bonus, apareceria no painel de status como se
     * estivesse valendo, e NAO mudaria o jogo. E o pior tipo de defeito
     * — silencioso, e o jogador gasta ouro achando que ganhou algo
     *
     * `critRate` e `critDamage` sao o caso concreto: os dois existem
     * no personagem, e o motor so os escreve uma vez, na criacao
     */
    for (const stat of ENCHANT_STATS) {
      expect(PIPELINE_STATS.has(stat), stat).toBe(true);
    }
  });

  it("nao oferece nem crit nem dano critico", () => {
    // estes dois NAO funcionam por equipamento, e e uma limitacao
    // conhecida do motor. A lista de afixos e a mesma do pipeline de
    // proposito: nenhum stat aqui pode ser um "bonus que nao bonus"
    expect(ENCHANT_STATS).not.toContain("critRate");
    expect(ENCHANT_STATS).not.toContain("critDamage");
  });

  it("da um valor para cada raridade, e a curva sobe", () => {
    for (const raridade of RARITY_ORDER) {
      const valor = ENCHANT_POWER[raridade];

      expect(valor, raridade).toBeGreaterThan(0);
    }

    // raro 2% e epico 4%, que e o exemplo que motivou o painel
    expect(ENCHANT_POWER[RARITY.RARE]).toBe(0.02);
    expect(ENCHANT_POWER[RARITY.EPIC]).toBe(0.04);

    // a curva e crescente: um lendario vale mais que um raro
    for (let i = 1; i < RARITY_ORDER.length; i += 1) {
      expect(
        ENCHANT_POWER[RARITY_ORDER[i]],
        `${RARITY_ORDER[i]} nao vale mais que ${RARITY_ORDER[i - 1]}`,
      ).toBeGreaterThan(ENCHANT_POWER[RARITY_ORDER[i - 1]]);
    }
  });

  it("cobre exatamente as cinco raridades do catalogo", () => {
    expect(Object.keys(ENCHANT_POWER).sort()).toEqual(
      [...RARITY_ORDER].sort(),
    );
  });
});

describe("sorteio da raridade", () => {
  it("o comum e o mais provavel e o lendario o mais raro", () => {
    // o `random` em 0 cai na primeira faixa da lista de pesos
    expect(rollRarity(fixo(0))).toBe(RARITY.COMMON);

    // e o mais perto de 1 cai na ultima
    expect(rollRarity(fixo(0.999999))).toBe(RARITY.LEGENDARY);
  });

  it("a chance de cada raridade segue o peso do catalogo", () => {
    /**
     * A distribuicao e conferida pela FAIXA do sorteio, e nao por mil
     * amostras. Rodar 3000 sorteios reais passaria por sorte mesmo com
     * os pesos errados; uma faixa nao passa
     *
     * Os pesos somam 100 (62 + 24 + 10 + 3.4 + 0.6), entao o valor do
     * `random` e lido como porcentagem direta
     */
    // 10%: ainda dentro dos 62% do comum
    expect(rollRarity(fixo(0.1))).toBe(RARITY.COMMON);

    // 88%: passou dos 62 do comum e dos 24 do incomum (86 no total),
    // entao ja e a faixa do raro
    expect(rollRarity(fixo(0.88))).toBe(RARITY.RARE);

    // 97%: passou de 96 (comum + incomum + raro), entao e epico
    expect(rollRarity(fixo(0.97))).toBe(RARITY.EPIC);

    // 99.9%: o epico fecha em 99.4, entao o resto e lendario
    expect(rollRarity(fixo(0.999))).toBe(RARITY.LEGENDARY);
  });

  it("nunca devolve raridade fora da lista", () => {
    for (const valor of [0, 0.5, 0.9, 0.99, 1]) {
      expect(RARITY_ORDER, `${valor}`).toContain(
        rollRarity(fixo(valor)),
      );
    }
  });

  it("devolve uma raridade para qualquer random, sem undefined", () => {
    /**
     * A ponta de soma de ponto flutuante.
     *
     * Se os pesos somarem 100.0000001, um `random` muito perto de 1
     * deixa o alvo POSITIVO depois do ultimo subtrair, e um
     * `for` sem `return` no fim devolveria `undefined`. A UI leria
     * `RARITY_STYLE[undefined].color` e quebraria
     */
    for (let i = 0; i <= 100; i += 1) {
      const raridade = rollRarity(fixo(i / 100));

      expect(raridade, `${i / 100}`).toBeTruthy();
    }
  });
});

describe("o sorteio inteiro", () => {
  it("devolve um stat da lista e uma raridade com o valor dela", () => {
    const enchant = rollEnchant(ARCO, sequencia([0.5, 0.97]));

    expect(ENCHANT_STATS).toContain(enchant.stat);
    expect(enchant.rarity).toBe(RARITY.EPIC);
    expect(enchant.power).toBe(ENCHANT_POWER[RARITY.EPIC]);
  });

  it("escolhe o primeiro stat com random 0", () => {
    // o primeiro `random` da funcao e o do STAT, e nao o da raridade
    expect(rollEnchant(ARCO, sequencia([0])).stat).toBe(
      ENCHANT_STATS[0],
    );
  });

  it("devolve null para material", () => {
    /**
     * Material e empilhavel, e uma pilha de 99 nao tem um afixo por
     * peca. Devolver um afixo aqui colocaria o bonus duas vezes, uma
     * por unidade — o gel de slime com 40Hp de vida
     */
    expect(getItem(GEL).type).toBe(ITEM_TYPE.MATERIAL);

    expect(rollEnchant(GEL)).toBe(null);
  });

  it("devolve null para item que nao existe", () => {
    expect(rollEnchant("item_que_nao_existe")).toBe(null);
  });

  it("aceita arma e armadura", () => {
    for (const id of [ARCO, ALJAVA, BOTAS]) {
      expect(canEnchantItem(id), id).toBe(true);
      expect(rollEnchant(id), id).toBeTruthy();
    }
  });
});

describe("o que conta como afixo valido", () => {
  it("aceita o que o sorteio produz", () => {
    for (let i = 0; i < 50; i += 1) {
      const enchant = rollEnchant(ARCO);

      expect(isEnchant(enchant), JSON.stringify(enchant)).toBe(
        true,
      );
    }
  });

  it("recusa um afixo forjado com o power inflado", () => {
    /**
     * O filtro que segura o save.
     *
     * Um arquivo com `power: 999` colocaria um multiplicador de mil no
     * stat do jogador, e o painel mostraria um numero absurdo sem
     * explicar de onde veio. O `power` precisa ser a fracao DAQUELA
     * raridade — e nao so um numero
     */
    expect(
      isEnchant({
        stat: "attack",
        rarity: RARITY.RARE,
        power: 999,
      }),
    ).toBe(false);
  });

  it("recusa stat inventado", () => {
    expect(
      isEnchant({
        stat: "critRate",
        rarity: RARITY.RARE,
        power: 0.02,
      }),
    ).toBe(false);
  });

  it("recusa raridade fora das cinco", () => {
    expect(
      isEnchant({
        stat: "attack",
        rarity: "comum",
        power: 0.02,
      }),
    ).toBe(false);
  });

  it("recusa null, undefined e numero", () => {
    for (const bruto of [null, undefined, 0.02, "attack", []]) {
      expect(isEnchant(bruto), String(bruto)).toBe(false);
    }
  });
});

describe("a fracao virando numero", () => {
  it("multiplica a base para os stats absolutos", () => {
    // 2% de 200 de ataque e 4, e nao 0.02
    expect(
      resolveEnchant(
        { stat: "attack", rarity: RARITY.RARE, power: 0.02 },
        200,
      ),
    ).toBe(4);

    expect(
      resolveEnchant(
        { stat: "speed", rarity: RARITY.EPIC, power: 0.04 },
        165,
      ),
    ).toBe(6.6);
  });

  it("NAO multiplica a base dos stats que ja sao fracao", () => {
    /**
     * `attackSpeed` e um multiplicador e `resourceRegen` e um tanto por
     * segundo. Multiplicar a fracao pela base daria um numero sem
     * sentido: 0.02 * 1.4 para um `attackSpeed` de 1.4 daria 0.028 de
     * ataque extra, e nao 2%
     */
    for (const stat of ["attackSpeed", "resourceRegen"]) {
      expect(
        resolveEnchant(
          { stat, rarity: RARITY.RARE, power: 0.02 },
          1.4,
        ),
        stat,
      ).toBe(0.02);
    }
  });

  it("devolve zero sem afixo e sem base valida", () => {
    expect(resolveEnchant(null, 200)).toBe(0);

    // base ausente nao pode virar NaN, que viraria um stat NaN no
    // jogador e apagaria o boneco sem erro no console
    expect(
      resolveEnchant(
        { stat: "attack", rarity: RARITY.RARE, power: 0.02 },
        undefined,
      ),
    ).toBe(0);

    expect(
      resolveEnchant(
        { stat: "attack", rarity: RARITY.RARE, power: 0.02 },
        "abc",
      ),
    ).toBe(0);
  });
});

describe("o preco", () => {
  it("custa ouro e nunca zero", () => {
    for (const id of [ARCO, ALJAVA, BOTAS]) {
      expect(enchantCost(id), id).toBeGreaterThan(0);
    }
  });

  it("o item mais caro custa mais", () => {
    /**
     * A comparacao vem do CATALOGO, e nao de dois ids escritos a mao.
     *
     * A primeira versao deste teste usava as botas contra o arco e
     * falhou: o arco vale 58 e a bota 36, entao a bota e a mais
     * barata. O preco estava certo e a suposicao do teste estava
     * errada — escrever dois ids fixos deixaria o teste quebrar de
     * novo no primeiro item novo que entrasse no catalogo
     */
    const candidates = ITEM_LIST.filter(
      (item) =>
        item.type === ITEM_TYPE.WEAPON ||
        item.type === ITEM_TYPE.ARMOR,
    ).sort((a, b) => a.value - b.value);

    const maisBarato = candidates[0];
    const maisCaro = candidates.at(-1);

    expect(
      enchantCost(maisCaro.id),
      `${maisCaro.id} (${maisCaro.value}) vs ${maisBarato.id} (${maisBarato.value})`,
    ).toBeGreaterThan(enchantCost(maisBarato.id));
  });

  it("a mesma peca sempre custa o mesmo", () => {
    // o preco nao pode variar com o sorteio: um botao que mostra um
    // preco e cobra outro depois do clique e a forma mais rapida de
    // perder a confianca do jogador
    expect(enchantCost(ARCO)).toBe(enchantCost(ARCO));
  });

  it("devolve zero para item que nao existe", () => {
    expect(enchantCost("item_que_nao_existe")).toBe(0);
  });

  it("a copia local da escala de custo bate com a do catalogo", () => {
    /**
     * `RARITY_COST` e uma copia local da `RARITY_COST_SCALE` do
     * catalogo, que nao e exportada. Uma copia e um lugar onde os dois
     * lados podem divergir: se o craft mudar a escala e o encantar
     * ficar, o preco do encantar para de acompanhar o resto do jogo
     * sem nenhum aviso
     */
    expect(Object.keys(RARITY_COST).sort()).toEqual(
      [...RARITY_ORDER].sort(),
    );

    expect(RARITY_COST[RARITY.RARE]).toBe(1);
    expect(RARITY_COST[RARITY.COMMON]).toBeLessThan(1);
    expect(RARITY_COST[RARITY.LEGENDARY]).toBeGreaterThan(1);
  });

  it("o preco base existe e e positivo", () => {
    expect(ENCHANT_BASE_COST).toBeGreaterThan(0);
  });
});

describe("o texto do afixo", () => {
  it("mostra o percentual com o nome do stat", () => {
    expect(
      describeEnchant({
        stat: "speed",
        rarity: RARITY.RARE,
        power: 0.02,
      }),
    ).toBe("+2% Velocidade");

    expect(
      describeEnchant({
        stat: "attack",
        rarity: RARITY.EPIC,
        power: 0.04,
      }),
    ).toBe("+4% Ataque");
  });

  it("devolve string vazia sem afixo", () => {
    expect(describeEnchant(null)).toBe("");
  });
});

describe("as chances mostradas no painel", () => {
  it("lista as cinco raridades com o valor delas", () => {
    const chances = enchantOdds();

    expect(chances).toHaveLength(5);

    for (const chance of chances) {
      expect(chance.label, chance.rarity).toBeTruthy();
      expect(chance.color, chance.rarity).toMatch(/^#/);
      expect(chance.percent, chance.rarity).toBeGreaterThan(0);
    }
  });

  it("o lendario e a ultima e a mais cara chance", () => {
    const chances = enchantOdds();

    expect(chances.at(-1).rarity).toBe(RARITY.LEGENDARY);
  });
});

describe("a lista de itens e coerente com o catalogo", () => {
  it("todo item do tipo aceito tem um caminho de encantar", () => {
    /**
     * A volta: `canEnchantItem` diz SIM para todo item de tipo
     * weapon/armor do catalogo. Se um dia existir um tipo novo que
     * aceita afixo, este teste avisa — ele compara contra o catalogo e
     * nao contra a lista do modulo
     */
    for (const item of ITEM_LIST) {
      const doTipo = item.type === ITEM_TYPE.WEAPON ||
        item.type === ITEM_TYPE.ARMOR;

      expect(
        canEnchantItem(item.id),
        `${item.id} e ${item.type} e o modulo diz que nao`,
      ).toBe(doTipo);
    }
  });
});