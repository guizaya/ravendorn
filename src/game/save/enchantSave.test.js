import { describe, expect, it } from "vitest";

import { createPlayerSession } from "../engine/PlayerSession.js";
import {
  applyCharacterSave,
  isReadableSave,
  snapshotSession,
} from "./CharacterSave.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { RARITY } from "../../data/items/index.js";
import { ENCHANT_POWER } from "../../data/enchant/index.js";

/**
 * O AFIXO NO SAVE.
 *
 * O save e o unico lugar onde o afixo sobrevive a um F5. E o lugar
 * onde ele pode voltar errado: um arquivo e texto que o jogador pode
 * editar, e um afixo com `stat` inventado entraria direto no stat do
 * personagem
 *
 * Duas regras, uma por direcao:
 *
 * 1. O que o motor escreveu volta igual. E o teste de ida e volta
 * 2. O que o jogador escreveu errado volta `null`. E o filtro do
 *    `isEnchant`
 *
 * O `SAVE_VERSION` NAO sobe. A versao e um portao rigido — um save com
 * outra versao e recusado e o jogador comeca do zero. Como o campo novo
 * e opcional e o leitor ja ignora o que nao reconhece, subir a versao
 * jogaria fora o progresso de todo mundo por causa de um afixo
 */

const CLASSE = "arbalist";

const afixo = (stat = "speed", rarity = RARITY.RARE) => ({
  stat,
  rarity,
  power: ENCHANT_POWER[rarity],
});

const arco = () => ({
  uid: "arco#1",
  itemId: "willow_bow",
  rarity: RARITY.RARE,
  count: 1,
  equipped: false,
  enchant: afixo(),
});

/**
 * Uma sessao nova, com o mesmo personagem.
 *
 * O `createPlayerSession` recebe a definicao da classe, e nao o id
 * escrito a mao — e o mesmo caminho que o servidor usa para abrir um
 * personagem de verdade
 */
const sessaoNova = () =>
  createPlayerSession(CHARACTER_CLASSES[0], {
    name: "Ana",
    classId: "arbalist",
  });

function sessaoCom(item, equipado = false) {
  const sessao = sessaoNova();

  sessao.inventory.addCoins(1000);

  if (equipado) {
    sessao.inventory.add(item.itemId, 1, item.rarity);
    sessao.equipment.equip(
      item.itemId,
      "weapon",
      item.rarity,
      item.enchant,
    );
  } else {
    sessao.inventory.add(item.itemId, 1, item.rarity);

    const pilha = sessao.inventory.findStack(
      item.itemId,
      item.rarity,
    );

    if (item.enchant) pilha.enchant = item.enchant;
  }

  return sessao;
}

describe("o afixo na mochila", () => {
  it("faz a ida e a volta", () => {
    const original = sessaoCom(arco());

    const dados = snapshotSession(original);


    const lido = sessaoNova();


    applyCharacterSave(lido, dados);

    const pilha = lido.inventory.findStack(
      "willow_bow",
      RARITY.RARE,
    );

    expect(pilha, "a peca nao voltou").toBeTruthy();
    expect(pilha.enchant, "o afixo nao sobreviveu ao save").toEqual(
      afixo(),
    );
  });

  it("o save tem um campo so por peca, e nao uma peca a mais", () => {
    /**
     * A peca enchanted continua sendo a MESMA peca. Se o afixo virasse
     * uma pilha nova, o jogador teria duas entradas do mesmo arco e a
     * mochila mostraria o dobro do que ele tem
     */
    const dados = snapshotSession(sessaoCom(arco()));

    const doArco = dados.inventory.stacks.filter(
      (p) => p.itemId === "willow_bow",
    );

    expect(doArco).toHaveLength(1);
    expect(doArco[0].enchant).toEqual(afixo());
  });

  it("guarda `null` na peca sem afixo", () => {
    // `null` explicito e melhor que omitir: o arquivo fica legivel, e
    // `undefined` nao sobrevive ao `JSON.stringify` de forma util
    const dados = snapshotSession(
      sessaoCom({
        itemId: "willow_bow",
        rarity: RARITY.RARE,
        enchant: null,
      }),
    );

    expect(
      dados.inventory.stacks[0],
      "o campo do afixo sumiu do arquivo",
    ).toHaveProperty("enchant", null);
  });

  it("descarta um afixo forjado do arquivo", () => {
    /**
     * O filtro.
     *
     * Um `stat` que nao existe nao entraria no bonus do motor — ele
     * seria ignorado em silencio. O perigo maior e o `power`: um
     * `power: 999` viraria um multiplicador enorme, e o painel mostraria
     * um numero absurdo sem explicar de onde veio
     */
    const dados = {
      version: 1,
      name: "Ana",
      classId: CLASSE,
      savedAt: Date.now(),
      player: { level: 1, xp: 0, x: 1200, y: 800 },
      inventory: {
        coins: 0,
        overflow: 0,
        stacks: [
          {
            itemId: "willow_bow",
            rarity: RARITY.RARE,
            count: 1,
            enchant: {
              stat: "speed",
              rarity: RARITY.RARE,
              power: 999,
            },
          },
        ],
      },
      equipment: [],
      quests: {},
      bestiary: {},
      collection: { done: [], bonus: {} },
      lootFilter: {},
    };


    const sessao = sessaoNova();


    applyCharacterSave(sessao, dados);

    const pilha = sessao.inventory.findStack(
      "willow_bow",
      RARITY.RARE,
    );

    expect(pilha, "a peca foi descartada").toBeTruthy();
    expect(
      pilha.enchant,
      "um afixo com power 999 entrou no arquivo",
    ).toBe(null);
  });

  it("descarta um afixo com stat inventado", () => {
    const dados = snapshotSession(sessaoCom(arco()));

    // forja o `stat` no arquivo
    dados.inventory.stacks[0].enchant.stat = "sorte";


    const sessao = sessaoNova();


    applyCharacterSave(sessao, dados);

    expect(
      sessao.inventory.findStack("willow_bow", RARITY.RARE).enchant,
    ).toBe(null);
  });

  it("um save antigo, sem o campo, abre normal", () => {
    /**
     * A compatibilidade.
     *
     * Todo mundo com um save de antes desta feature tem um arquivo sem
     * `enchant`. Se o leitor exigisse o campo, todo mundo perderia o
     * personagem
     */
    const dados = snapshotSession(sessaoCom(arco()));

    // um save de antes: o campo nao existe
    for (const pilha of dados.inventory.stacks) {
      delete pilha.enchant;
    }

    expect(isReadableSave(dados)).toBe(true);


    const sessao = sessaoNova();


    applyCharacterSave(sessao, dados);

    expect(
      sessao.inventory.findStack("willow_bow", RARITY.RARE).enchant,
      "o save sem o campo falhou",
    ).toBe(null);
  });

  it("a versao do save nao subiu", () => {
    /**
     * O portao de versao e rigido: um arquivo com outra versao e
     * RECUSADO, e o jogador comeca do zero. Como o campo novo e
     * opcional, subir a versao teria jogado fora o progresso de todo
     * mundo por causa de um afixo
     */
    const dados = snapshotSession(sessaoCom(arco()));

    expect(dados.version).toBe(1);
    expect(isReadableSave(dados)).toBe(true);

    // e um arquivo de versao futura continua recusado, como antes
    expect(isReadableSave({ ...dados, version: 2 })).toBe(false);
  });
});

describe("o afixo na peca vestida", () => {
  it("faz a ida e a volta pelo slot", () => {
    const original = sessaoCom(arco(), true);

    const dados = snapshotSession(original);


    const lido = sessaoNova();


    applyCharacterSave(lido, dados);

    expect(
      lido.equipment.getSlot("weapon").enchant,
      "o afixo da peca vestida nao sobreviveu",
    ).toEqual(afixo());
  });

  it("o slot vazio nao guarda afixo de uma peca que foi embora", () => {
    /**
     * O `applyCharacterSave` zera os slots ANTES de ler o arquivo. Sem
     * esse zero, um afixo de um slot que o arquivo nao lista passaria
     * para o slot seguinte — e uma peca nova nasceria ja encantada
     */

    const sessao = sessaoNova();


    sessao.equipment.getSlot("weapon").enchant = afixo();

    const dados = snapshotSession(sessao);

    // o arquivo nao tem equipamento nenhum
    expect(dados.equipment).toEqual([]);


    const lido = sessaoNova();


    applyCharacterSave(lido, dados);

    expect(
      lido.equipment.getSlot("weapon").enchant,
      "um afixo vazou para o slot",
    ).toBe(null);
  });
});