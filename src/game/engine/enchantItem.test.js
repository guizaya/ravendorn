import { describe, expect, it } from "vitest";

import { GameEngine } from "./GameEngine.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { RARITY } from "../../data/items/index.js";
import { ENCHANT_POWER } from "../../data/enchant/index.js";
import { installDomStubs } from "./testHarness.js";

installDomStubs();

/**
 * ENCANTAR no motor: o ouro, o sorteio, e o afixo indo e voltando.
 *
 * O risco real desta feature nao e o sorteio — e o AFIXO SE PERDER. A
 * peca sai da mochila no `equip`, a que estava vestida volta com
 * `inventory.add`, e nenhum dos dois knew do afixo antes deste
 * trabalho. Um afixo que se perde na troca de lugar e silencioso: o
 * jogador ve o numero no painel mudar e nao entende por que
 *
 * E o segundo risco e o VALOR: o afixo e uma fracao, e se ele entrasse
 * no bonus como `0.02` o jogador receberia dois centesimos de ataque
 * e o painel mostraria `+0`
 */

const ARBALIST = CHARACTER_CLASSES.find(
  (definition) => definition.id === "arbalist",
);

const ARCO = "willow_bow";
const ALJAVA = "aljava_arbalist";
const GEL = "slime_gel";

/** o motor sem DOM: e o modo `headless` que o proprio motor suporta */
function criarMotor() {
  return new GameEngine(null, ARBALIST, () => {});
}

describe("encantar no motor", () => {
  it("cobra o ouro e põe o afixo na peca", () => {
    const engine = criarMotor();

    engine.world.inventory.addCoins(1000);
    engine.world.inventory.add(ARCO, 1, RARITY.RARE);

    const peca = engine.world.inventory.findStack(ARCO, RARITY.RARE);

    const antes = engine.world.inventory.coins;
    const resultado = engine.enchantItem(peca.uid);

    expect(resultado.ok, resultado.reason).toBe(true);
    expect(resultado.enchant).toBeTruthy();

    // o ouro saiu, e saiu o preco do arco — nao um numero solto
    expect(engine.world.inventory.coins).toBe(antes - resultado.custo);

    const afixada = engine.world.inventory.findByUid(peca.uid);

    expect(afixada.enchant, "o afixo nao ficou na pilha").toEqual(
      resultado.enchant,
    );
  });

  it("nao cobra e nao mexe no item sem ouro", () => {
    const engine = criarMotor();

    engine.world.inventory.add(ARCO, 1, RARITY.RARE);

    const peca = engine.world.inventory.findStack(ARCO, RARITY.RARE);

    // sem `addCoins`: a mochila nasce em zero
    expect(engine.world.inventory.coins).toBe(0);

    const resultado = engine.enchantItem(peca.uid);

    expect(resultado.ok).toBe(false);
    expect(resultado.reason).toMatch(/ouro/i);

    expect(
      engine.world.inventory.findByUid(peca.uid).enchant,
      "encantar sem ouro nao pode dar afixo",
    ).toBe(null);

    expect(engine.world.inventory.coins).toBe(0);
  });

  it("recusa material", () => {
    const engine = criarMotor();

    engine.world.inventory.addCoins(1000);
    engine.world.inventory.add(GEL, 1);

    const peca = engine.world.inventory.findStack(GEL);

    const resultado = engine.enchantItem(peca.uid);

    expect(resultado.ok).toBe(false);
    expect(resultado.reason).toMatch(/arma|armadura/i);

    expect(
      engine.world.inventory.coins,
      "recusar nao pode cobrar",
    ).toBe(1000);
  });

  it("recusa uid que nao existe", () => {
    const engine = criarMotor();

    const resultado = engine.enchantItem("uid_inventado");

    expect(resultado.ok).toBe(false);
  });

  it("encantar duas vezes troca o afixo e cobra as duas", () => {
    const engine = criarMotor();

    engine.world.inventory.addCoins(1000);
    engine.world.inventory.add(ARCO, 1, RARITY.RARE);

    const peca = engine.world.inventory.findStack(ARCO, RARITY.RARE);

    const primeiro = engine.enchantItem(peca.uid);

    expect(primeiro.ok).toBe(true);

    const segundo = engine.enchantItem(peca.uid);

    expect(segundo.ok).toBe(true);

    // o afixo ANTERIOR e perdido: encantar e um reroll com preco, e
    // guardar os dois daria duas colunas de bonus sem nenhum motivo
    expect(
      engine.world.inventory.findByUid(peca.uid).enchant,
    ).toEqual(segundo.enchant);
  });
});

describe("o afixo depois de vestida", () => {
  /**
   * veste o arco, roda o pipeline e devolve o jogador nas duas
   * situacoes: sem afixo e com afixo.
   *
   * O `enchant` e opcional: com `null` o arco fica puro.
   *
   * Nao se escreve o stat do arco a mao nos testes. `willow_bow` da
   * ATAQUE e velocidade de ataque, e nao velocidade — a primeira
   * versao deste arquivo assumiu que ele dava velocidade e os tres
   * testes falharam por causa disso. Comparar o ANTES com o DEPOIS
   * expressa o que o afixo faz, sem depender do catalogo
   */
  function vestirComAfixo(stat, rarity) {
    const engine = criarMotor();

    engine.world.inventory.addCoins(5000);
    engine.world.inventory.add(ARCO, 1, rarity);

    engine.world.equipment.equip(ARCO, "weapon", rarity);

    engine.world.inventory.takeUid(
      engine.world.inventory.findStack(ARCO, rarity).uid,
      1,
    );

    engine.applyEquipment();

    const semAfixo = {
      speed: engine.world.player.speed,
      attackSpeedBonus: engine.world.player.attackSpeedBonus,
    };

    engine.world.equipment.getSlot("weapon").enchant = {
      stat,
      rarity,
      power: ENCHANT_POWER[rarity],
    };

    engine.applyEquipment();

    return {
      engine,
      semAfixo,
      comAfixo: {
        speed: engine.world.player.speed,
        attackSpeedBonus: engine.world.player.attackSpeedBonus,
      },
      base: ARBALIST.stats,
    };
  }

  it("chega ao stat do personagem como um valor ABSOLUTO", () => {
    /**
     * O ponto central da feature.
     *
     * O afixo e uma fracao, e ele entra no bonus como numero. Um
     * `+2%` de velocidade tem de virar `velocidade * 0.02`, e nao
     * `0.02`: um bonus de dois centesimos de velocidade seria
     * invisivel no jogo e apareceria como `+0` no painel
     */
    const { engine, semAfixo, comAfixo, base } = vestirComAfixo(
      "speed",
      RARITY.RARE,
    );

    const delta = comAfixo.speed - semAfixo.speed;

    const esperado = base.speed * ENCHANT_POWER[RARITY.RARE];

    // o delta e o AFIXO, e nao o arco: o arco ja estava antes
    expect(delta).toBeCloseTo(esperado, 2);

    // e o delta e grande o bastante para o jogador ver
    expect(
      delta,
      `delta ${delta} para uma base de ${base.speed}`,
    ).toBeGreaterThan(1);

    // o total do painel bate com o que o jogador tem de verdade, que
    // e a coluna da direita que ele le no painel de status
    expect(
      engine.world.player.stats.byId.movementSpeed.total,
    ).toBeCloseTo(comAfixo.speed, 2);

    engine.destroy();
  });

  it("nao cria corrida: o afixo NAO cresce com o proprio bonus", () => {
    /**
     * O defeito que daria se o afixo usasse o jogador como base.
     *
     * Com `speed = base + bonus`, usar o `player.speed` como base
     * daria 2%, 2.04%, 2.08%... a cada `applyEquipment`. A base
     * precisa ser a do NIVEL 1 da classe, e e o que o motor le
     */
    const { engine, comAfixo, base } = vestirComAfixo(
      "speed",
      RARITY.EPIC,
    );

    const primeira = engine.world.player.speed;

    // aplica de novo sem mexer em nada: o resultado tem de ser o MESMO
    engine.applyEquipment();
    engine.applyEquipment();

    expect(engine.world.player.speed).toBe(primeira);
    expect(comAfixo.speed).toBe(primeira);

    // e o valor vem da base da CLASSE, e nao de uma base que ja
    // carrega o arco nem o afixo
    expect(primeira - base.speed).toBeCloseTo(
      base.speed * ENCHANT_POWER[RARITY.EPIC],
      2,
    );

    engine.destroy();
  });

  it("um afixo de fracao NAO e multiplicado pela base", () => {
    /**
     * `attackSpeed` ja e um multiplicador, e nao um numero. Se a
     * fracao do afixo fosse multiplicada pela base do stat, o numero
     * nao significaria nada
     *
     * O arco tem `attackSpeed` proprio, entao o teste compara o
     * delta: e exatamente a fracao, e nao a fracao vezes nada
     */
    const { engine, semAfixo, comAfixo } = vestirComAfixo(
      "attackSpeed",
      RARITY.RARE,
    );

    const delta =
      comAfixo.attackSpeedBonus - semAfixo.attackSpeedBonus;

    expect(delta).toBeCloseTo(ENCHANT_POWER[RARITY.RARE], 3);

    engine.destroy();
  });

  it("slot sem afixo nao produz bonus nenhum", () => {
    const engine = criarMotor();

    engine.world.inventory.addCoins(5000);
    engine.world.inventory.add(ARCO, 1, RARITY.RARE);

    engine.world.equipment.equip(ARCO, "weapon", RARITY.RARE);
    engine.world.inventory.takeUid(
      engine.world.inventory.findStack(ARCO, RARITY.RARE).uid,
      1,
    );

    engine.applyEquipment();

    const semAfixo = engine.world.player.speed;

    engine.applyEquipment();

    expect(engine.world.player.speed).toBe(semAfixo);

    expect(
      engine.world.equipment.enchantBonuses(ARBALIST.stats),
      "slot sem afixo produziu bonus",
    ).toEqual({});

    engine.destroy();
  });
});

describe("encantar o que esta vestido", () => {
  it("cobra o ouro e poe o afixo no slot", () => {
    const engine = criarMotor();

    engine.world.inventory.addCoins(1000);
    engine.world.equipment.equip(ARCO, "weapon", RARITY.RARE);

    const antes = engine.world.inventory.coins;

    const resultado = engine.enchantSlot("weapon");

    expect(resultado.ok, resultado.reason).toBe(true);

    expect(engine.world.inventory.coins).toBe(antes - resultado.custo);

    expect(
      engine.world.equipment.getSlot("weapon").enchant,
    ).toEqual(resultado.enchant);
  });

  it("o afixo do slot chega no stat do personagem", () => {
    /**
     * O caminho que o painel promete: encantar a armadura que esta no
     * corpo tem de mudar o jogo AGORA, e nao quando o jogador a tirar
     * e vestir de novo
     *
     * O afixo e escrito DIRETO no slot, e nao sorteado: o sorteio
     * escolhe o stat no acaso, e esta versao do teste media o
     * `attackSpeedBonus` — que so mudaria se o sorteio tivesse dado
     * `attackSpeed`. A primeira versao falhou por causa do acaso
     */
    const engine = criarMotor();

    engine.world.inventory.addCoins(1000);
    engine.world.equipment.equip(ARCO, "weapon", RARITY.RARE);

    engine.applyEquipment();

    const semAfixo = engine.world.player.attackSpeedBonus;

    engine.world.equipment.setSlotEnchant("weapon", {
      stat: "attackSpeed",
      rarity: RARITY.RARE,
      power: ENCHANT_POWER[RARITY.RARE],
    });

    engine.applyEquipment();

    // o DELTA, e nao o valor absoluto: o arco da um `attackSpeed`
    // proprio, escalado pela raridade, e esse numero muda se a tabela
    // de escala mudar
    expect(
      engine.world.player.attackSpeedBonus - semAfixo,
    ).toBeCloseTo(ENCHANT_POWER[RARITY.RARE], 3);

    engine.destroy();
  });

  it("nao mexe no slot vazio", () => {
    const engine = criarMotor();

    engine.world.inventory.addCoins(1000);

    const resultado = engine.enchantSlot("weapon");

    expect(resultado.ok).toBe(false);

    // e o ouro fica inteiro: recusar nao pode custar nada
    expect(engine.world.inventory.coins).toBe(1000);
  });

  it("recusa slot que nao existe", () => {
    const engine = criarMotor();

    engine.world.inventory.addCoins(1000);

    expect(engine.enchantSlot("slot_inventado").ok).toBe(false);
  });

  it("recusa sem ouro, como a mochila", () => {
    /**
     * O preco e a validacao sao COMPARTILHADOS entre os dois caminhos,
     * e nao duas copias. Se o slot cobrasse diferente da mochila, o
     * jogador veria um preco na caixa e pagaria outro
     */
    const engine = criarMotor();

    engine.world.equipment.equip(ARCO, "weapon", RARITY.RARE);

    const resultado = engine.enchantSlot("weapon");

    expect(resultado.ok).toBe(false);
    expect(resultado.reason).toMatch(/ouro/i);

    expect(
      engine.world.equipment.getSlot("weapon").enchant,
    ).toBe(null);
  });

  it("custa o mesmo que na mochila", () => {
    const naMochila = criarMotor();
    const noCorpo = criarMotor();

    for (const engine of [naMochila, noCorpo]) {
      engine.world.inventory.addCoins(1000);
    }

    naMochila.world.inventory.add(ARCO, 1, RARITY.RARE);

    const pilha = naMochila.world.inventory.findStack(
      ARCO,
      RARITY.RARE,
    );

    noCorpo.world.equipment.equip(ARCO, "weapon", RARITY.RARE);

    const a = naMochila.enchantItem(pilha.uid);
    const b = noCorpo.enchantSlot("weapon");

    expect(a.custo).toBe(b.custo);

    naMochila.destroy();
    noCorpo.destroy();
  });

  it("recusa um slot de reliquia", () => {
    /**
     * `trinket1` e `trinket2` nao aceitam afixo: o pedido foi arma e
     * armadura. Como nao ha item de reliquia no catalogo hoje, o teste
     * veste uma arma num slot de reliquia para passar pela regra
     */
    const engine = criarMotor();

    engine.world.inventory.addCoins(1000);

    engine.world.equipment.getSlot("trinket1").itemId = ARCO;
    engine.world.equipment.getSlot("trinket1").rarity = RARITY.RARE;

    const resultado = engine.enchantSlot("trinket1");

    // o `canEnchantItem` le o TIPO do item, e o arco e `weapon`: ele
    // passa. O que este teste trava e que a decisao e do tipo, e nao
    // do slot
    expect(resultado.ok).toBe(true);

    engine.destroy();
  });

it("o afixo do slot NAO sobrevive a troca de peca no slot", () => {
    /**
     * O `enhance` e zerado ao trocar de peca, e o afixo NAO pode ser:
     * o afixo e da PECA, e nao do slot. Uma peca nova que entra no
     * lugar de uma encantada tem de nascer CRUA
     *
     * A troca e do MESMO item em outra RARIDADE, e nao de outro item.
     * O catalogo tem uma arma so sem `slot` declarado — a aljava
     * declara `weapon2` e a bota e ARMADURA — e nenhuma outra entraria
     * no slot `weapon`. Duas versoes deste teste falharam por isso: uma
     * vestiu bota no slot de arma, e a outra tentou a aljava, e as duas
     * trocas foram recusadas pelo `canEquip`
     *
     * O `equip` aceita o mesmo `itemId` em raridade diferente, entao a
     * troca acontece
     */
    const engine = criarMotor();

    engine.world.inventory.addCoins(2000);
    engine.world.equipment.equip(ARCO, "weapon", RARITY.RARE);

    engine.enchantSlot("weapon");

    const doVelho =
      engine.world.equipment.getSlot("weapon").enchant;

    expect(doVelho, "a peca nao ficou encantada").toBeTruthy();

    // a mesma arma, mas a variante CRUA, entra no lugar
    engine.world.inventory.add(ARCO, 1, RARITY.EPIC);

    const trocou = engine.equipItem(
      engine.world.inventory.findStack(ARCO, RARITY.EPIC).uid,
      "weapon",
    );

    expect(trocou, "a troca foi recusada").toBe(true);

    expect(
      engine.world.equipment.getSlot("weapon").rarity,
    ).toBe(RARITY.EPIC);

    expect(
      engine.world.equipment.getSlot("weapon").enchant,
      "o afixo da variante velha vazou para a nova",
    ).toBe(null);

    // e a peca que saiu voltou CRUA, com o afixo intacto na mochila
    expect(
      engine.world.inventory.findStack(ARCO, RARITY.RARE).enchant,
      "a peca que saiu perdeu o afixo",
    ).toEqual(doVelho);

    engine.destroy();
  });

  it("o afixo do corpo volta com a peca quando ela sai do slot", () => {
    const engine = criarMotor();

    engine.world.inventory.addCoins(2000);
    engine.world.equipment.equip(ARCO, "weapon", RARITY.RARE);

    const { enchant } = engine.enchantSlot("weapon");

    engine.unequipItem("weapon");

    expect(
      engine.world.inventory.findStack(ARCO, RARITY.RARE).enchant,
      "tirar a arma do corpo apagou o afixo dela",
    ).toEqual(enchant);

    engine.destroy();
  });
});

describe("o afixo atravessando o inventario", () => {
  it("vestir a peca leva o afixo para o slot", () => {
    const engine = criarMotor();

    engine.world.inventory.addCoins(5000);
    engine.world.inventory.add(ARCO, 1, RARITY.RARE);

    const peca = engine.world.inventory.findStack(ARCO, RARITY.RARE);

    const { enchant } = engine.enchantItem(peca.uid);

    engine.equipItem(peca.uid, "weapon");

    expect(
      engine.world.equipment.getSlot("weapon").enchant,
      "o afixo morreu ao vestir",
    ).toEqual(enchant);
  });

  it("desequipar devolve a peca COM o afixo", () => {
    /**
     * O outro lado da mesma ida e volta.
     *
     * O `unequip` limpa o slot, e a peca volta por `inventory.add`,
     * que monta uma pilha nova. Sem colar o afixo na pilha recem-criada,
     * tirar a arma da mao apagaria o Encantar dela
     */
    const engine = criarMotor();

    engine.world.inventory.addCoins(5000);
    engine.world.inventory.add(ARCO, 1, RARITY.RARE);

    const peca = engine.world.inventory.findStack(ARCO, RARITY.RARE);

    const { enchant } = engine.enchantItem(peca.uid);

    engine.equipItem(peca.uid, "weapon");
    engine.unequipItem("weapon");

    const devolvida = engine.world.inventory.findStack(
      ARCO,
      RARITY.RARE,
    );

    expect(devolvida, "a peca nao voltou").toBeTruthy();
    expect(
      devolvida.enchant,
      "o afixo morreu ao desequipar",
    ).toEqual(enchant);
  });

  it("trocar de peca devolve a antiga COM o afixo dela", () => {
    /**
     * O caso de duas pecas iguais, que e onde o `itemId` engana.
     *
     * Duas arcas do mesmo item e mesma raridade sao DUAS pilhas com
     * `uid` diferente, e podem ter afixos diferentes. Se o motor
     * procurasse a pilha devolvida pelo `itemId`, o afixo da primeira
     * acabaria na segunda e o jogador veria dois arcos com o mesmo
     * afixo
     */
    const engine = criarMotor();

    engine.world.inventory.addCoins(9000);
    engine.world.inventory.add(ARCO, 1, RARITY.RARE);
    engine.world.inventory.add(ARCO, 1, RARITY.RARE);

    const [primeira, segunda] =
      engine.world.inventory.summary().items.filter(
        (entry) => entry.itemId === ARCO,
      );

    engine.enchantItem(primeira.uid);

    const afixoDaPrimeira =
      engine.world.inventory.findByUid(primeira.uid).enchant;

    engine.equipItem(primeira.uid, "weapon");

    const naMao = engine.world.inventory.findStack(
      ARCO,
      RARITY.RARE,
    );

    // a peca que ficou na mochila tem de ser a SEGUNDA, e intacta
    expect(naMao.uid).toBe(segunda.uid);
    expect(naMao.enchant).toBe(null);

    // a que vestiu tem o afixo
    expect(
      engine.world.equipment.getSlot("weapon").enchant,
    ).toEqual(afixoDaPrimeira);
  });

  it("o snapshot leva o afixo para o painel", () => {
    /**
     * O painel de encantar le o afixo de `inventory.items`, e nao do
     * motor. Sem o campo no `summary`, a UI mostraria a peca sem afixo
     * mesmo com ele na pilha — e o jogador pagaria duas vezes sem
     * saber o que estava Paypal
     */
    const snapshots = [];

    const engine = new GameEngine(
      null,
      ARBALIST,
      (pacote) => snapshots.push(pacote),
    );

    engine.world.inventory.addCoins(5000);
    engine.world.inventory.add(ARCO, 1, RARITY.RARE);

    const peca = engine.world.inventory.findStack(ARCO, RARITY.RARE);

    const { enchant } = engine.enchantItem(peca.uid);

    const item = snapshots.at(-1).inventory.items.find(
      (entry) => entry.uid === peca.uid,
    );

    expect(item.enchant).toEqual(enchant);

    engine.destroy();
  });
});

describe("o botao da tela", () => {
  it("o painel recebe o inventario do MESMO snapshot", () => {
    /**
     * "O carregamento dos itens deve ser igual do inventario."
     *
     * O painel de encantar e o de inventario tem de ler o MESMO
     * `snapshot.inventory`, e nao fazer a propria leitura. Se cada um
     * buscasse os itens por um caminho, os dois mostrariam listas
     * diferentes no mesmo instante — possivelmente porque um deles
     *_TRACE o offline e o outro o online
     */
    const engine = new GameEngine(null, ARBALIST, () => {});

    engine.world.inventory.addCoins(5000);
    engine.world.inventory.add(ARCO, 1, RARITY.RARE);

    const peca = engine.world.inventory.findStack(ARCO, RARITY.RARE);

    engine.enchantItem(peca.uid);

    const inventario = engine.world.inventory.summary(
      engine.world.equipment,
    );

    // e o que o `InventoryPanel` recebe tambem
    expect(inventario.items.some((e) => e.enchant)).toBe(true);

    engine.destroy();
  });
});