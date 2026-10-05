import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { getCharacterDefinition } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";
import { getItem } from "../../data/items/index.js";

/**
 * USAR um consumivel da mochila: `engine.usarItem(uid)`.
 *
 * ## O QUE ESTE ARQUIVO SEGURA
 *
 * A pocao de cura e o primeiro item do jogo que SAI da mochila por
 * causa de um efeito. Antes dela, tudo que saia era equipamento
 * (`equipItem`) ou descarte (`descartarItem`), e as duas coisas
 * confundem com o que esta sendo testado:
 *
 * - `equipItem` move a peca para um SLOT, e o item volta a ser
 *   equipavel; um erro ali custa um equipamento, nao uma vida
 * - `descartarItem` nao faz NADA no jogador; um erro ali custa um item
 *
 * O uso e o unico que faz as duas coisas ao mesmo tempo: altera o
 * jogador E tira o item. E o unico em que o estado errado e o jogador
 * perde vida E o item
 *
 * ## A REGRA QUE IMPORTA MAIS
 *
 * **A pocao com a vida cheia NAO e gasta.**
 *
 * E o motivo de `heal` devolver quanto curou em vez de `void`. Sem o
 * retorno, o motor nao tem como saber se o efeito aconteceu, e o
 * pior resultado possivel passa a ser possivel: o jogador bebe a
 * ultima pocao em vida cheia, ve `+0`, e a pocao some da mochila sem
 * ter curado nada
 */
/**
 * O `window` minimo.
 *
 * O `GameEngine` registra os ouvintes de teclado na `window` no
 * construtor, e um `Global.window` de verdade precisa existir antes do
 * `new`. Nao e o unico stub necessario: e so o que impede o teste de
 * medir outra coisa — o motor precisa de `window`, `devicePixelRatio` e
 * os tres ouvintes, e nada mais
 */
const windowListeners = new Map();

globalThis.window = {
  devicePixelRatio: 1,
  addEventListener(type, handler) {
    if (!windowListeners.has(type)) {
      windowListeners.set(type, new Set());
    }

    windowListeners.get(type).add(handler);
  },
  removeEventListener(type, handler) {
    windowListeners.get(type)?.delete(handler);
  },
};

/**
 * O relogio do motor, parado.
 *
 * O construtor agenda o primeiro quadro, e este arquivo nao roda quadro
 * nenhum: um `requestAnimationFrame` de verdade dispararia o `update`
 * com o delta do relogio real e o jogador regeneraria vida entre duas
 * linhas de teste. Um stub que devolve identificador e nao chama nada
 * mantem o motor parado durante toda a medicao
 */
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

function montarEngine() {
  const listeners = {};

  const context = new Proxy(
    { createPattern: () => ({ pattern: true }) },
    {
      get(target, key) {
        if (key in target) return target[key];
        return () => {};
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );

  const canvas = {
    getContext: () => context,
    addEventListener(type, handler) {
      (listeners[type] ??= []).push(handler);
    },
    removeEventListener() {},
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    }),
  };

  const engine = new GameEngine(
    canvas,
    getCharacterDefinition("warrior"),
    () => {},
  );

  engine.setMap(MAP_1);
  engine.world.collision.map = MAP_1;

  return engine;
}

/** uma pocao na mochila, e o `uid` da pilha */
function comPocao(engine, count = 1) {
  engine.world.inventory.add("pocao_cura", count);

  return engine.world.inventory
    .findStack("pocao_cura")
    ?.uid;
}

/** deixa o jogador com `falta` de vida */
function machucar(engine, falta) {
  engine.world.player.hp = engine.world.player.maxHp - falta;
}

describe("usar a pocao de cura", () => {
  it("cura o que a pocao promete", () => {
    const engine = montarEngine();

    const uid = comPocao(engine);

    machucar(engine, 300);

    const antes = engine.world.player.hp;

    expect(engine.usarItem(uid)).toBe(true);

    /**
     * Exatamente o `heal` do catalogo, e nao "alguma coisa".
     *
     * O `120` vem do item, entao o teste le o `use` do catalogo em vez
     * de escrever o numero. Se alguém mudar a cura da pocao para 200,
     * este teste acompanha sem ser reescrito — e continua pegando o
     * caso em que o motor aplica um numero ESCRITO no codigo
     */
    const esperado = Math.min(
      getItem("pocao_cura").use.heal,
      engine.world.player.maxHp - antes,
    );

    expect(engine.world.player.hp - antes).toBe(esperado);
  });

  it("gasta UMA pocao, e nao a pilha inteira", () => {
    const engine = montarEngine();

    const uid = comPocao(engine, 3);

    machucar(engine, 300);

    expect(engine.usarItem(uid)).toBe(true);

    expect(engine.world.inventory.count("pocao_cura")).toBe(2);
  });

  it("a pilha some quando era a ultima", () => {
    const engine = montarEngine();

    const uid = comPocao(engine, 1);

    machucar(engine, 300);

    engine.usarItem(uid);

    expect(engine.world.inventory.count("pocao_cura")).toBe(0);
    expect(engine.world.inventory.findByUid(uid)).toBe(null);
  });

  it("NAO gasta a pocao com a vida cheia", () => {
    const engine = montarEngine();

    const uid = comPocao(engine, 2);

    engine.world.player.hp = engine.world.player.maxHp;

    /**
     * `false`, e nao um `true` com cura zero.
     *
     * E este o teste que justifica `heal` devolver quanto curou. Com o
     * retorno em `void`, o motor so veria que "nao deu erro" e gastaria
     * a pocao: o jogador perderia a ultima pocao sem ganhar vida, que
     * e o pior resultado do jogo num so clique
     */
    expect(engine.usarItem(uid)).toBe(false);

    expect(engine.world.inventory.count("pocao_cura")).toBe(2);
  });

  it("nao passa da vida maxima", () => {
    const engine = montarEngine();

    const uid = comPocao(engine);

    // falta menos do que a pocao cura
    machucar(engine, 10);

    engine.usarItem(uid);

    expect(engine.world.player.hp).toBe(engine.world.player.maxHp);

    // e a pocao E consumida: ela curou o que dava
    expect(engine.world.inventory.count("pocao_cura")).toBe(0);
  });

  it("gasta com vida quase cheia, e nao com vida cheia", () => {
    const engine = montarEngine();

    const uid = comPocao(engine, 2);

    // falta 1 ponto: a cura e de 1, e nao de 120
    machucar(engine, 1);

    expect(engine.usarItem(uid)).toBe(true);

    expect(engine.world.player.hp).toBe(engine.world.player.maxHp);
    expect(engine.world.inventory.count("pocao_cura")).toBe(1);
  });

  it("recusa um uid que nao esta na mochila", () => {
    const engine = montarEngine();

    machucar(engine, 300);

    expect(engine.usarItem("uid-inventado")).toBe(false);
    expect(engine.usarItem(null)).toBe(false);
  });

  it("recusa um item que nao e consumivel", () => {
    const engine = montarEngine();

    engine.world.inventory.add("willow_bow", 1);

    const arco = engine.world.inventory.findStack("willow_bow");

    /**
     * O arco NAO e usado e NAO some.
     *
     * O `use` do catalogo e o que separa "consumivel" de "tudo
     * else", e e o mesmo teste que impede uma arma de ser bebida. Sem
     * o `if (!definition?.use)`, o arco entraria no `Object.entries` com
     * um objeto vazio, nao aplicaria nada, e o `aplicou` ficaria falso
     * — por sorte. Com um item que tivesse `use` e o chamasse de outra
     * forma, o efeito viraria item quebrado em vez de recusado
     */
    expect(engine.usarItem(arco.uid)).toBe(false);

    expect(engine.world.inventory.count("willow_bow")).toBe(1);
  });

  it("escreve o texto flutuante da cura", () => {
    const engine = montarEngine();

    const uid = comPocao(engine);

    machucar(engine, 300);

    // o texto entra pelo mesmo `DamageSystem.heal` da regeneracao, e
    // e isso que o jogador ve subindo da barra
    const escritos = [];

    engine.damage.effects.addText = (x, y, text) => {
      escritos.push(text);
    };

    engine.usarItem(uid);

    expect(escritos.some((t) => t.startsWith("+"))).toBe(true);
  });
});

describe("o efeito vem do catalogo", () => {
  it("a pocao declara o que ela faz", () => {
    /**
     * Sem esta linha o resto deste arquivo passaria com uma pocao sem
     * efeito nenhum: `usarItem` devolveria `false` sempre, e nenhum dos
     * testes de cura acima falharia por um motivo que o jogador nunca
     * veria
     */
    const pocao = getItem("pocao_cura");

    expect(pocao.use).toEqual({ heal: 120 });
  });

  it("a pocao e empilhavel, para a loja poder vender varias", () => {
    const pocao = getItem("pocao_cura");

    expect(pocao.stackable).toBe(true);
    expect(pocao.type).toBe("potion");
  });
});