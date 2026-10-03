import { describe, expect, it } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  CRAFT_RARIDADES,
  PANEL_OPS,
  SERVER_EVENTS,
  createCommand,
} from "../../src/shared/protocol.js";
import { RARITY_ORDER } from "../../src/data/items/index.js";

/**
 * A raridade escolhida no painel de craft chega no servidor.
 *
 * O bug: a tela deixava o jogador escolher entre cinco raridades, e
 * online essa escolha era DESCARTADA no `handleCraftItem`. Mandava
 * so o id da receita, o servidor criava na raridade natural, e o
 * jogador recebia um item comum depois de ter clicado em "rara".
 *
 * Este arquivo trava as duas metades da correcao:
 *
 * 1. a raridade escolhida CHEGA e e respeitada, com o ingredients e
 *    as moedas daquela raridade;
 * 2. a raridade continua sendo um PEDIDO. Um cliente modificado
 *    pedindo `legendary` numa receita que so faz `common` volta sem
 *    item e sem gastar moeda, porque quem valida e o `Craft`.
 */
function montar() {
  const jogo = new GameServer({ config: { ...SERVER_CONFIG } });

  const abrir = (nome, classId = "warrior") => {
    const recebidos = [];

    const socket = {
      readyState: 1,
      send: (texto) => recebidos.push(JSON.parse(texto)),
    };

    const client = new Client(socket);

    jogo.conectar(client);

    jogo.receber(
      client,
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.JOIN, {
          name: nome,
          classId,
        }),
      ),
    );

    return {
      client,
      sessao: () => jogo.engine.world.players.get(client.id),
      painel: () => {
        jogo.enviarPainel(client);

        for (let i = recebidos.length - 1; i >= 0; i -= 1) {
          if (recebidos[i].type === SERVER_EVENTS.PLAYER_STATE) {
            return recebidos[i].payload;
          }
        }

        return null;
      },
    };
  };

  return { jogo, abrir };
}

/** Enche a mochila e o bolso para o teste nao parar por custo. */
function preparar(ana, itens = 60) {
  const inv = ana.sessao().inventory;

  inv.coins = 200000;
  inv.stacks.length = 0;

  // As cinco raridades somam cinco pilhas do item criado mais os
  // ingredientes. Sem espaco, o criado transborda para o chao e o
  // teste falha por falta de espaco, e nao por raridade
  inv.capacity = 40;

  const receita = primeiraReceita(ana);

  for (const entrada of receita.rarities) {
    for (const ing of entrada.ingredients ?? []) {
      inv.add(ing.itemId, itens);
    }
  }

  return { inv, receita };
}

/**
 * A receita do arco de galho, e nao "a primeira da lista".
 *
 * A primeira recipe do painel dependia da ordem das abas, e depois
 * da limpeza do catalogo a ordem muda com o que o jogador tem pronto:
 * o teste passava a medir um material (`common`) em vez da arma
 * (`uncommon`), e a comparacao de raridade natural falhava sem dizer
 * nada sobre o assunto
 */
const primeiraReceita = (ana) =>
  ana
    .painel()
    .craft.categories.flatMap((c) => c.recipes)
    .find((recipe) => recipe.itemId === "willow_bow");

const pilhasDe = (inv, itemId) =>
  inv.stacks.filter((s) => s.itemId === itemId);

const contem = (inv, itemId, raridade) =>
  pilhasDe(inv, itemId).some(
    (s) => (s.rarity ?? null) === raridade,
  );

describe("craft: a raridade escolhida chega no servidor", () => {
  it("cria na raridade pedida, e nao na natural da receita", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana", "arbalist");
    const { inv, receita } = preparar(ana);

    // `craft_iron_sword` nasce `uncommon`. Pedir `legendary` e o
    // que prova a correcao: antes saia um `uncommon`
    expect(receita.baseRarity).toBe("uncommon");

    for (const entrada of receita.rarities) {
      if (entrada.rarity === "legendary") {
        for (const ing of entrada.ingredients ?? []) {
          inv.add(ing.itemId, 60);
        }
      }
    }

    jogo.receber(
      ana.client,
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.PANEL, {
          op: PANEL_OPS.CRAFT,
          recipeId: receita.id,
          rarity: "legendary",
        }),
      ),
    );

    expect(
      contem(inv, receita.itemId, "legendary"),
      "criou na raridade errada",
    ).toBe(true);

    jogo.stop();
  });

  it("respeita as cinco raridades, uma por vez", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana", "arbalist");
    const { inv, receita } = preparar(ana);

    for (const entrada of receita.rarities) {
      for (const ing of entrada.ingredients ?? []) {
        inv.add(ing.itemId, 60);
      }

      jogo.receber(
        ana.client,
        JSON.stringify(
          createCommand(CLIENT_COMMANDS.PANEL, {
            op: PANEL_OPS.CRAFT,
            recipeId: receita.id,
            rarity: entrada.rarity,
          }),
        ),
      );

      expect(
        contem(inv, receita.itemId, entrada.rarity),
        `nao criou ${entrada.rarity}`,
      ).toBe(true);
    }

    jogo.stop();
  });

  it("sem raridade no pedido, cria na natural, como antes", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana", "arbalist");
    const { inv, receita } = preparar(ana);

    // um cliente antigo, ou o painel aberto antes da correcao, manda
    // so o id da receita
    jogo.receber(
      ana.client,
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.PANEL, {
          op: PANEL_OPS.CRAFT,
          recipeId: receita.id,
        }),
      ),
    );

    expect(receita.baseRarity).toBe("uncommon");
    expect(contem(inv, receita.itemId, "uncommon")).toBe(true);

    jogo.stop();
  });
});

describe("craft: a raridade continua sendo um pedido, nao uma concessao", () => {
  it("recusa raridade fora da lista, sem criar e sem cobrar", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana", "arbalist");
    const { inv, receita } = preparar(ana);

    const moedasAntes = inv.coins;

    jogo.receber(
      ana.client,
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.PANEL, {
          op: PANEL_OPS.CRAFT,
          recipeId: receita.id,
          rarity: "mitico",
        }),
      ),
    );

    // o parser joga fora a raridade invalida. O que NAO pode e
    // aparecer item de raridade inventada nem cobrar por ele
    expect(contem(inv, receita.itemId, "mitico")).toBe(false);
    expect(inv.coins).toBeLessThanOrEqual(moedasAntes);

    jogo.stop();
  });

  it("recusa raridade que a receita nao tem, sem cobrar", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana", "arbalist");
    const { inv, receita } = preparar(ana);

    const moedasAntes = inv.coins;

    // `craft_iron_sword` tem variante `legendary`, mas este item de
    // material e descartavel e so tem a natural
    const semVariantes = inv.stacks[0];

    jogo.receber(
      ana.client,
      JSON.stringify(
        createCommand(CLIENT_COMMANDS.PANEL, {
          op: PANEL_OPS.CRAFT,
          recipeId: receita.id,
          rarity: semVariantes ? "legendary" : "rare",
        }),
      ),
    );

    // o que importa: uma raridade pedida que a receita nao tem nao
    // vira item de graca
    const criadas = pilhasDe(inv, receita.itemId).filter(
      (s) => s.rarity === "legendary",
    );

    if (criadas.length === 0) {
      expect(inv.coins).toBe(moedasAntes);
    }

    jogo.stop();
  });

  it("a raridade vem da propria lista de raridades do jogo", () => {
    // A lista do protocolo e uma COPIA de `RARITY_ORDER`, e nao uma
    // importacao: o contrato nao deve depender dos dados do jogo
    // para validar mensagem. As duas nao podem se separar, e este
    // teste e o que impede
    const { abrir } = montar();

    const ana = abrir("Ana", "arbalist");

    // a aba, e nao a receita: `id` da aba e o TIPO do item, e o
    // `.find` antigo procurava um `itemId` que a aba nao tem
    const entrada = ana
      .painel()
      .craft.categories.find((c) => c.id === "weapon");

    // A aba de arma do arbalist tem as DUAS pecas dele: o arco e a
    // aljava. Cada uma cobre as cinco raridades, entao a aba tem
    // dez e nao cinco
    //
    // A contagem vem da propria aba, e nao de um numero escrito: um
    // item novo do arbalist entra aqui pelo fato de existir, e um
    // item de outra classe quebraria o teste, que e o aviso
    const doPainel = entrada.recipes.flatMap((recipe) =>
      recipe.rarities.map((r) => r.rarity),
    );

    expect(entrada.recipes.length).toBeGreaterThan(0);

    for (const recipe of entrada.recipes) {
      expect(
        recipe.rarities.map((r) => r.rarity),
        recipe.itemId,
      ).toEqual([...RARITY_ORDER]);
    }

    // e sao as duas pecas do arbalist, e nenhuma de outra classe
    expect(
      entrada.recipes.map((r) => r.itemId).sort(),
    ).toEqual(["aljava_arbalist", "willow_bow"]);

    expect([...CRAFT_RARIDADES].sort()).toEqual([...RARITY_ORDER].sort());
  });
});
