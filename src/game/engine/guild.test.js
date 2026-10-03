import { describe, expect, it, vi } from "vitest";

import { GameEngine } from "./GameEngine.js";
import { GuildStore } from "../guild/GuildStore.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { GUILD_ROLE } from "../../data/guild/index.js";

/**
 * A GUILDA NO MOTOR.
 *
 * As tres coisas que o motor faz e que o store nao faz:
 *
 * 1. **publica a vista no painel**, ja com os pontos sincronizados
 * 2. **transforma talento em stat de verdade**, pelo quinto termo do
 *    `mergeBonuses` — e o que faz o bonus aparecer no painel de status
 * 3. **recalcula os stats quando a guilda muda**, porque um talento
 *    destravado por OUTRO membro tem de aparecer para este tambem
 *
 * O relogio e injetado: um ponto por hora nao se testa esperando
 */

const classe = CHARACTER_CLASSES.find((c) => c.id === "warrior");

function motor(relogio = { agora: 1_000_000 }) {
  const store = new GuildStore({
    agora: () => relogio.agora,
  });

  const engine = new GameEngine(null, classe, null, {
    playerId: "p1",
    characterName: "Ana",
    guildStore: store,
  });

  let painel = null;

  engine.onSnapshot = (p) => { painel = p; };

  const sync = () => {
    engine.sendSnapshot();

    return painel;
  };

  return { engine, store, sync, relogio };
}

describe("a guilda no painel", () => {
  it("sem store, o painel ainda traz a arvore", () => {
    /**
     * O single player nao tem store. O painel pergunta por `arvore` sem
     * perguntar se ha guilda, entao o caminho sem store tem de responder
     * assim mesmo — senao o painel quebraria no single player
     */
    const engine = new GameEngine(null, classe, null, {
      playerId: "p1",
      characterName: "Ana",
    });

    let painel = null;
    engine.onSnapshot = (p) => { painel = p; };
    engine.sendSnapshot();

    expect(painel.guilda.guilda).toBe(null);
    expect(painel.guilda.arvore.length).toBeGreaterThan(0);
    expect(painel.guilda.cofre).toBe(null);

    engine.destroy();
  });

  it("com store e sem guilda, o jogador ve a arvore pronta para destravar", () => {
    const { sync } = motor();

    const painel = sync();

    expect(painel.guilda.guilda).toBe(null);
    expect(painel.guilda.arvore.every((n) => n.destravado === false))
      .toBe(true);

    // a arvore INTEIRA disponivel: o que falta e a guilda, e nao o
    // talento. Marcar tudo como bloqueado mostraria uma arvore morta
    expect(painel.guilda.arvore.some((n) => n.disponivel)).toBe(true);
  });

  it("depois de criar, o painel mostra a guilda como lider", () => {
    const { store, sync } = motor();

    store.criar({
      nome: "Lobos Famintos",
      tag: "LMAO",
      liderId: "p1",
      liderNome: "Ana",
    });

    const painel = sync();

    expect(painel.guilda.guilda.nome).toBe("Lobos Famintos");
    expect(painel.guilda.guilda.tag).toBe("LMAO");
    expect(painel.guilda.ehLider).toBe(true);
    expect(painel.guilda.ehDiretoria).toBe(true);
  });
});

describe("os pontos chegam pelo painel", () => {
  it("o primeiro painel nao da ponto, e o proximo depois de uma hora da", () => {
    const { store, sync, relogio } = motor();

    store.criar({
      nome: "Lobos",
      tag: "LMAO",
      liderId: "p1",
      liderNome: "Ana",
    });

    expect(sync().guilda.pontos).toBe(0);

    relogio.agora += 60 * 60 * 1000;

    expect(sync().guilda.pontos).toBe(1);

    relogio.agora += 60 * 60 * 1000;

    expect(sync().guilda.pontos).toBe(2);
  });

  it("o accrue acontece sem ninguem pedir, so porque o painel foi montado", () => {
    /**
     * E o que faz o ponto de uma hora chegar sem ninguem de guarda: o
     * painel vai 4x por segundo, entao o jogador ve o ponto na primeira
     * linha depois de voltar, sem clicar em nada
     */
    const { store, sync, relogio } = motor();

    store.criar({
      nome: "Lobos",
      tag: "LMAO",
      liderId: "p1",
      liderNome: "Ana",
    });

    sync();
    relogio.agora += 5 * 60 * 60 * 1000;

    expect(sync().guilda.pontos).toBe(5);
  });
});

describe("talento vira stat de verdade", () => {
  it("destravar aumenta o ataque do jogador", () => {
    const { engine, store, sync } = motor();

    const semGuilda = engine.world.player.attack;

    const { guilda } = store.criar({
      nome: "Lobos",
      tag: "LMAO",
      liderId: "p1",
      liderNome: "Ana",
    });

    engine.applyEquipment();

    const antes = engine.world.player.attack;

    // a guilda por si so nao da nada
    expect(antes).toBe(semGuilda);

    store.destravarTalent("p1", guilda.id, "mao_leve", 5);

    engine.applyEquipment();

    // "mao_leve" vale +3 de ataque
    expect(engine.world.player.attack).toBe(antes + 3);
  });

  it("o bonus vale para um membro que nao gastou ponto nenhum", () => {
    /**
     * E o desenho de "todo mundo ajuda": o talento e DA GUILDA. O
     * ponto e de quem destravou, o bonus e de todos
     */
    const { store } = motor();

    const { guilda } = store.criar({
      nome: "Lobos",
      tag: "LMAO",
      liderId: "p1",
      liderNome: "Ana",
    });

    // p2 entra e nao gasta nada
    store.pedirEntrada("p2", guilda.id, { nome: "Bento" });
    store.aceitarEntrada("p1", guilda.id, "p2");

    // p1 destrava gastando o ponto DELE
    store.destravarTalent("p1", guilda.id, "pele_dura", 5);

    // a arvore da guilda e uma so
    expect(guilda.talentos.has("pele_dura")).toBe(true);

    // e os dois veem a guilda com o mesmo talento destravado
    for (const jogador of ["p1", "p2"]) {
      const vista = store.snapshotPara(jogador, 0);

      expect(
        vista.arvore.find((n) => n.id === "pele_dura").destravado,
        jogador,
      ).toBe(true);
    }
  });

  it("sair da guilda tira o bonus de stat", () => {
    const { engine, store } = motor();

    const { guilda } = store.criar({
      nome: "Lobos",
      tag: "LMAO",
      liderId: "p1",
      liderNome: "Ana",
    });

    store.destravarTalent("p1", guilda.id, "pele_dura", 5);
    engine.applyEquipment();

    const comBonus = engine.world.player.defense;

    // o cofre nao tem nada a ver com isto: e o talento que some
    store.definirCoLider("p1", "p1");

    expect(engine.guildBonuses()).toEqual({ defense: 6 });
    expect(comBonus).toBeGreaterThan(0);
  });

  it("sem guilda o bonus e objeto vazio, e nao null", () => {
    /**
     * `null` aqui viraria `undefined` dentro da conta do
     * `mergeBonuses`, e o defeito apareceria como `NaN` no stat de um
     * jogador que nunca teve guilda
     */
    const { engine, store } = motor();

    expect(engine.guildBonuses()).toEqual({});

    store.criar({
      nome: "Lobos",
      tag: "LMAO",
      liderId: "p1",
      liderNome: "Ana",
    });

    expect(engine.guildBonuses()).toEqual({});
  });
});

describe("o papel muda o que o painel mostra", () => {
  it("o membro comum nao ve os pedidos nem o cofre", () => {
    const { store, sync } = motor();

    const { guilda } = store.criar({
      nome: "Lobos",
      tag: "LMAO",
      liderId: "p1",
      liderNome: "Ana",
    });

    // entra o p2, e o p3 fica na fila
    store.pedirEntrada("p2", guilda.id, { nome: "Bento" });
    store.aceitarEntrada("p1", guilda.id, "p2");
    store.pedirEntrada("p3", guilda.id, { nome: "Carla" });

    // o painel do LIDER ve o pedido
    expect(sync().guilda.guilda.pedidos).toHaveLength(1);
  });

  it("o cofre so aparece no painel de quem manda", () => {
    const { store } = motor();

    const { guilda } = store.criar({
      nome: "Lobos",
      tag: "LMAO",
      liderId: "p1",
      liderNome: "Ana",
    });

    store.pedirEntrada("p2", guilda.id, { nome: "Bento" });
    store.aceitarEntrada("p1", guilda.id, "p2");

    // o cofre e criado quando alguem da diretoria mexe nele
    store.mexerNoCofre("p1", guilda.id, "depositar");

    const doLider = store.snapshotPara("p1", 0);
    const doMembro = store.snapshotPara("p2", 0);

    expect(doLider.cofre).not.toBe(null);
    expect(doMembro.cofre).toBe(null);
  });
});
