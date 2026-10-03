import { describe, expect, it } from "vitest";
import { GameServer } from "../src/domain/GameServer.js";
import { Client } from "../src/domain/Client.js";
import { SERVER_CONFIG } from "../src/config.js";
import {
  CLIENT_COMMANDS,
  PANEL_OPS,
  REJECT,
  SERVER_EVENTS,
  createCommand,
} from "../../src/shared/protocol.js";
import { COLLECTIONS } from "../../src/data/collection/index.js";

/**
 * A ENTREGA da colecao pela rede.
 *
 * A regra que estes testes defendem e a mais importante do arquivo: a
 * entrega e a acao mais destrutiva que um cliente pode pedir, porque
 * tira item do inventario DELE. O cliente pode PEDIR; ele nunca DIZ o
 * que tem.
 *
 * Sem a checagem no servidor, um cliente editado mandaria
 * "entrega a col_primeira_ferra" com a mochila vazia e receberia 140
 * moedas de graca. E o caminho do `Collection` confere contra o
 * inventario do servidor, que e a unica copia que conta
 */
function montar() {
  const jogo = new GameServer({ config: { ...SERVER_CONFIG } });

  const abrir = (nome, classId = "warrior") => {
    const doServidor = [];

    const socket = {
      readyState: 1,
      send: (texto) => doServidor.push(JSON.parse(texto)),
    };

    const client = new Client(socket);
    jogo.conectar(client);

    const mandar = (command) =>
      jogo.receber(client, JSON.stringify(command));

    mandar(
      createCommand(CLIENT_COMMANDS.JOIN, {
        name: nome,
        classId,
      }),
    );

    const ultimo = (tipo) => {
      for (let i = doServidor.length - 1; i >= 0; i -= 1) {
        if (doServidor[i].type === tipo) return doServidor[i];
      }

      return null;
    };

    const painel = () => {
      jogo.enviarPainel(client);

      return (
        ultimo(SERVER_EVENTS.PLAYER_STATE)?.payload ?? null
      );
    };

    /**
     * A sessao viva do jogador.
     *
     * O `GameServer` nao guarda os jogadores: eles vao em
     * `engine.world.players`, e e o `withPlayer` do motor que troca o
     * `world` para a sessao de quem esta agindo
     */
    const sessao = () =>
      jogo.engine.world.players.get(client.id);

    /**
     * Da um item direto na mochila da sessao.
     *
     * E um atalho de teste, e nao um caminho do jogo: o loot entra pelo
     * `loot.collectFrom` ou pelo craft. Aqui o que importa e o estado
     * do servidor antes do pedido, e o pedido vem pela rede
     */
    const darItem = (itemId, count = 1, rarity = null) => {
      sessao().inventory.add(itemId, count, rarity);
    };

    return {
      client,
      mandar,
      ultimo,
      painel,
      sessao,
      darItem,
      entregar: (collectionId) =>
        mandar(
          createCommand(CLIENT_COMMANDS.PANEL, {
            op: PANEL_OPS.DELIVER_COLLECTION,
            collectionId,
          }),
        ),
    };
  };

  return { jogo, abrir };
}

const GELO = "slime_gel";
const CAUDA = "rat_tail";
const PELLE = "rat_pelt";

describe("entrega de colecao pela rede", () => {
  it("o painel do servidor ja vem com a colecao", () => {
    const { abrir } = montar();

    const ana = abrir("Ana");

    const dados = ana.painel().collection;

    expect(dados, "o painel nao tem a colecao").toBeTruthy();
    expect(dados.entries.length).toBeGreaterThan(0);
    expect(dados.completed).toBe(0);
  });

  it("um pedido de entrega chega no servidor", () => {
    const { abrir } = montar();

    const ana = abrir("Ana");

    ana.darItem(GELO, 5);

    const antes = ana.painel().collection.completed;

    ana.entregar("col_cacos");

    expect(ana.painel().collection.completed).toBe(antes + 1);
  });

  /**
   * A entrega completa, do botao ate o personagem.
   *
   * As tres metades que o jogador ve, em cadeia e no mesmo pacote:
   * a colecao conta como entregue, o bonus permanente aparece no
   * painel, e o bonus entra nos stats do personagem. Qualquer uma
   * delas quebrando sozinha produz a tela em que a entrega "nao
   * funciona" — o cartao vira "✓ Entregue", o numero some, e o
   * jogador nao sabe qual das tres falhou
   */
  it("entregar conta no painel e credita o bonus nos stats", () => {
    const { abrir } = montar();

    const ana = abrir("Ana");

    ana.darItem(GELO, 5);

    const antes = ana.painel();
    const folhaAntes = antes.player.stats.byId;

    expect(antes.collection.bonuses).toEqual({});
    expect(folhaAntes.vit.bonus).toBe(0);

    ana.entregar("col_cacos");

    const depois = ana.painel();

    // 1. a colecao conta
    expect(depois.collection.completed).toBe(1);
    expect(depois.collection.isComplete).toBe(false);

    // 2. o bonus permanente aparece no painel da colecao
    expect(depois.collection.bonuses).toEqual({
      vit: 2,
      maxHp: 40,
    });

    // 3. o bonus entrou no personagem
    expect(depois.player.maxHp).toBe(antes.player.maxHp + 40);
    expect(depois.player.stats.byId.vit.bonus).toBe(2);
    expect(depois.player.stats.byId.maxHp.bonus).toBe(40);

    // e o total da folha e a base mais o bonus: e o numero que o
    // jogador le no painel de status
    for (const stat of ["vit", "maxHp"]) {
      const row = depois.player.stats.byId[stat];

      expect(row.base + row.bonus, stat).toBeCloseTo(
        row.total,
        6,
      );
    }
  });

  it("cada entrega soma no bonus e o aviso diz so o que ela deu", () => {
    // O aviso da entrega usa o valor devolvido pelo `deliver`. Se ele
    // devolvesse o ACUMULADO, a segunda entrega anunciaria os bonus da
    // primeira tambem — e o jogador leria "+12 VIT" na primeira entrega
    // e "+12 VIT" de novo em todas as seguintes, achando que o bonus
    // nao subia
    const { abrir } = montar();

    const ana = abrir("Ana");

    /**
     * O texto do aviso e a CONCATENACAO das mensagens da sessao, e nao
     * so a ultima. A funcao recorta a partir do ultimo "Colecao
     * entregue:", que e o que o jogador le por cima da tela
     */
    const ultimoAviso = () => {
      const texto = ana.painel().message?.text ?? "";
      const marco = "Colecao entregue:";

      return texto.slice(texto.lastIndexOf(marco));
    };

    ana.darItem(GELO, 5);
    ana.darItem(CAUDA, 5);
    ana.darItem(PELLE, 3);

    ana.entregar("col_cacos");

    expect(ultimoAviso()).toContain("+2 VIT");
    expect(ultimoAviso()).toContain("+40 HP");
    expect(ultimoAviso()).not.toContain("DEX");

    ana.entregar("col_ninho");

    // a segunda entrega anunciaria os bonus da primeira tambem — e o
    // jogador leria "+12 VIT" na primeira entrega e "+12 VIT" de novo
    // em todas as seguintes, achando que o bonus nao subia
    expect(ultimoAviso()).toContain("DEX");
    expect(ultimoAviso()).toContain("MSPD");
    expect(ultimoAviso()).not.toContain("+40 HP");

    // e o acumulado no painel tem as duas
    expect(ana.painel().collection.bonuses).toEqual({
      vit: 2,
      maxHp: 40,
      dex: 3,
      movementSpeed: 20,
      evasion: 0.02,
      critRate: 0.01,
      attackSpeed: 0.05,
    });
  });

  it("as seis entregas fecham a colecao e dao o bonus inteiro", () => {
    const { abrir } = montar();

    const ana = abrir("Ana");

    const materiais = {
      col_cacos: [["slime_gel", 5]],
      col_ninho: [
        ["rat_tail", 5],
        ["rat_pelt", 3],
      ],
      col_ossada: [
        ["skeleton_bone", 5],
        ["skeleton_skull", 2],
      ],
      col_primeira_ferra: [["goblin_cloth", 5]],
      col_couro_ogro: [
        ["ogre_hide", 5],
        ["ogre_pebble", 8],
      ],
      col_besta_do_ossario: [["ghoul_claw", 5]],
    };

    // os dois requisitos de EQUIPAMENTO sao por raridade EXATA: um
    // lendario nao satisfaz um pedido de raro. E a decisao que impede
    // o jogador de entregar a peca cara para cumprir o pedido mais
    // barato
    ana.darItem("willow_bow", 1, "rare");
    ana.darItem("willow_bow", 1, "legendary");

    for (const collection of COLLECTIONS) {
      for (const [itemId, count] of materiais[collection.id] ??
        []) {
        ana.darItem(itemId, count);
      }

      const entrada = ana.painel().collection.entries.find(
        (e) => e.id === collection.id,
      );

      expect(
        entrada.pronta,
        `${collection.id} nao ficou pronta`,
      ).toBe(true);

      ana.entregar(collection.id);
    }

    const fim = ana.painel();

    expect(fim.collection.completed).toBe(COLLECTIONS.length);
    expect(fim.collection.isComplete).toBe(true);

    // o bonus total e a soma das seis, e ele esta nos stats
    const bonus = fim.collection.bonuses;

    expect(bonus.maxHp).toBe(220);
    expect(bonus.attack).toBe(40);
    expect(bonus.vit).toBe(12);
    expect(bonus.defense).toBe(26);

    expect(fim.player.stats.byId.maxHp.bonus).toBe(220);
    expect(fim.player.stats.byId.attack.bonus).toBe(40);
    expect(fim.player.stats.byId.vit.bonus).toBe(12);
  });

  it("um cliente que MENTE sobre o estoque nao ganha nada", () => {
    // Este pedido NAO leva quantidade nem item: quem manda e a
    // quantidade e o item. Sem esse campo no pedido nao ha o que
    // forjar — o `parsePanel` so passa `collectionId`, e o
    // `Collection` le o inventario do servidor para conferir
    // A defesa principal deste arquivo. O cliente pede a entrega sem
    // ter o material; se o servidor confiasse no pedido, ele receberia
    // as moedas sem entregar nada
    const { abrir } = montar();

    const ana = abrir("Ana");

    const moedasAntes = ana.painel().inventory.coins;

    // a mochila esta vazia e o pedido acontece assim mesmo
    ana.entregar("col_cacos");

    const depois = ana.painel();

    expect(depois.collection.completed).toBe(0);
    expect(depois.collection.isComplete).toBe(false);
    expect(
      depois.inventory.coins,
      "o cliente ganhou moedas sem material",
    ).toBe(moedasAntes);
  });

  it("um cliente que forja o estoque tambem nao ganha", () => {
    // O caso anterior mostra que o pedido sem material e recusado. Este
    // mostra que nao ha como declarar o estoque na MENSAGEM
    const { abrir } = montar();

    const ana = abrir("Ana");

    const moedasAntes = ana.painel().inventory.coins;

    /**
     * O payload manda `itemId` e `count` como se fossem creditos, mas
     * o `parsePanel` so repassa o `collectionId` — os dois campos
     * extras morrem no filtro de texto e o `Collection` nem os ve
     */
    ana.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: PANEL_OPS.DELIVER_COLLECTION,
        collectionId: "col_cacos",
        itemId: GELO,
        count: 5,
      }),
    );

    const depois = ana.painel();

    expect(depois.collection.completed).toBe(0);
    expect(depois.inventory.coins).toBe(moedasAntes);
  });

  it("nao entrega uma colecao ja entregue", () => {
    // Sem a trava, um jogador faria a entrega em loop e ganharia
    // moedas infinitas: depois da primeira ele so precisa repor o
    // material
    const { abrir } = montar();

    const ana = abrir("Ana");

    ana.darItem(GELO, 5);
    ana.entregar("col_cacos");

    const moedas = ana.painel().inventory.coins;

    // repoe o material e tenta de novo
    ana.darItem(GELO, 5);
    ana.entregar("col_cacos");

    expect(ana.painel().collection.completed).toBe(1);
    expect(
      ana.painel().inventory.coins,
      "a reentrega pagou de novo",
    ).toBe(moedas);
  });

  it("um id de colecao forjado e recusado, e nao derruba o servidor", () => {
    const { jogo, abrir } = montar();

    const ana = abrir("Ana");

    expect(() => ana.entregar("colecao_que_nao_existe")).not.toThrow();

    expect(ana.painel().collection.completed).toBe(0);

    // e o servidor segue vivo, respondendo o painel
    expect(jogo).toBeTruthy();
    expect(ana.painel()).toBeTruthy();
  });

  it("um id de colecao enorme e recusado pela validação", () => {
    // O `parsePanel` limita o tamanho do id. Sem isso, um cliente
    // mandaria um id de um megabyte e o servidor guardaria tudo em
    // memoria so para comparar
    const { abrir } = montar();

    const ana = abrir("Ana");

    ana.entregar("c".repeat(500));

    expect(ana.painel().collection.completed).toBe(0);
  });

  it("a colecao de um jogador nao interfere na do outro", () => {
    // A colecao e estado privado, mora na sessao. Se ela estivesse no
    // `world` do servidor, a entrega da Ana fecharia a do Bento
    const { abrir } = montar();

    const ana = abrir("Ana");
    const bento = abrir("Bento");

    ana.darItem(GELO, 5);
    ana.entregar("col_cacos");

    expect(ana.painel().collection.completed).toBe(1);
    expect(
      bento.painel().collection.completed,
      "a entrega da Ana marcou a do Bento",
    ).toBe(0);
  });

  it("uma operacao de painel inventada continua recusada", () => {
    // O `DELIVER_COLLECTION` nao pode ter aberto brecha: a validacao
    // da op e a mesma de sempre
    const { abrir } = montar();

    const ana = abrir("Ana");

    ana.mandar(
      createCommand(CLIENT_COMMANDS.PANEL, {
        op: "DAR_ITEM",
        itemId: "slime_gel",
      }),
    );

    expect(ana.ultimo(SERVER_EVENTS.REJECTED)?.payload.reason).toBe(
      REJECT.BAD_MESSAGE,
    );
  });
});