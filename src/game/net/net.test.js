import { describe, expect, it } from "vitest";
import {
  aimFromPointer,
  estaAndando,
  limitar,
  moveFromKeys,
} from "./intent.js";
import { WorldState } from "./WorldState.js";

const teclas = (...lista) => new Set(lista);

describe("teclas viram direcao", () => {
  it("nenhuma tecla e parado", () => {
    expect(moveFromKeys(teclas())).toEqual({ x: 0, y: 0 });
  });

  it("cada direcao", () => {
    expect(moveFromKeys(teclas("KeyD"))).toEqual({ x: 1, y: 0 });
    expect(moveFromKeys(teclas("KeyA"))).toEqual({ x: -1, y: 0 });
    expect(moveFromKeys(teclas("KeyW"))).toEqual({ x: 0, y: -1 });
    expect(moveFromKeys(teclas("KeyS"))).toEqual({ x: 0, y: 1 });
  });

  it("as setas funcionam igual", () => {
    // o jogo ja aceitou setas, e o jogador nao pode descobrir
    // que o servidor so entende uma das duas
    expect(moveFromKeys(teclas("ArrowRight"))).toEqual(
      moveFromKeys(teclas("KeyD")),
    );
    expect(moveFromKeys(teclas("ArrowUp"))).toEqual({
      x: 0,
      y: -1,
    });
  });

  it("duas teclas nao andam mais rapido que uma", () => {
    // o bug classico: segurar D e W produz (1, 1), que tem
    // comprimento 1.41. sem o corte, a diagonal seria 41% mais
    // rapida que a linha reta
    const reta = moveFromKeys(teclas("KeyD"));
    const diagonal = moveFromKeys(teclas("KeyD", "KeyW"));

    const comprimento = Math.hypot(diagonal.x, diagonal.y);

    expect(comprimento).toBeCloseTo(1, 6);
    expect(Math.hypot(reta.x, reta.y)).toBeCloseTo(1, 6);
  });

  it("as quatro teclas juntas se cancelam", () => {
    // opostas ao mesmo tempo nao fazem nada. e o esperado:
    // segurar tudo e o oposto de andar na diagonal maxima
    expect(
      moveFromKeys(teclas("KeyW", "KeyA", "KeyS", "KeyD")),
    ).toEqual({ x: 0, y: 0 });
  });

  it("teclas opostas se cancelam", () => {
    expect(moveFromKeys(teclas("KeyA", "KeyD"))).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("saber se esta andando", () => {
    expect(estaAndando(teclas())).toBe(false);
    expect(estaAndando(teclas("KeyD"))).toBe(true);
    expect(estaAndando(teclas("KeyA", "KeyD"))).toBe(false);
  });
});

describe("o vetor nunca passa de 1", () => {
  it("corta um valor gigante", () => {
    // um cliente modificado mandaria isto para atravessar o mapa
    expect(limitar({ x: 9999, y: 0 })).toEqual({ x: 1, y: 0 });
  });

  it("NaN e infinito viram zero", () => {
    // NaN na posicao faz o jogador sumir do mapa para todo mundo
    expect(limitar({ x: Number.NaN, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(limitar({ x: Number.POSITIVE_INFINITY, y: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("um valor pequeno nao e esticado", () => {
    // 0.5 e direcao fraca, nao metade da velocidade magica
    expect(limitar({ x: 0.5, y: 0 })).toEqual({ x: 0.5, y: 0 });
  });

  it("zero nao divide por zero", () => {
    expect(limitar({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("a mira sai do ponteiro", () => {
  it("ponteiro fora do canvas nao e mira", () => {
    expect(
      aimFromPointer({ x: 10, y: 10, inside: false }),
    ).toEqual({ x: 0, y: 0 });
  });

  it("ponteiro a direita mira a direita", () => {
    const mira = aimFromPointer({ x: 100, y: 0, inside: true });

    expect(mira.x).toBeGreaterThan(0);
    expect(mira.y).toBe(0);
  });

  it("ponteiro em cima do jogador nao e mira", () => {
    // sem isto, o jogador miraria para uma direcao aleatoria
    expect(
      aimFromPointer({ x: 0, y: 0, inside: true }),
    ).toEqual({ x: 0, y: 0 });
  });

  it("perto e longe apontam a mesma direcao", () => {
    const perto = aimFromPointer({ x: 20, y: 0, inside: true });
    const longe = aimFromPointer({ x: 300, y: 0, inside: true });

    // a mira e uma DIRECAO. se 3 pixels valessem 0.3 de lado, o
    // tiro sairia torto de perto do jogador
    expect(perto.x).toBeCloseTo(1, 6);
    expect(longe.x).toBeCloseTo(1, 6);
  });

  it("o ponteiro em cima do jogador nao vira mira torta", () => {
    // com o mouse em cima do boneco, mirar e o mesmo que nao mirar
    expect(
      aimFromPointer({ x: 3, y: 1, inside: true }),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("o estado do mundo", () => {
  const pacote = (seq, x) => ({
    seq,
    time: seq * 0.05,
    players: [
      { id: "eu", name: "Ana", x, y: 100, hp: 100, maxHp: 100 },
    ],
    enemies: [{ id: "slime_0", x: 500, y: 500, hp: 10, maxHp: 10, state: "idle" }],
    drops: [],
  });

  it("guarda jogadores, inimigos e drops por id", () => {
    const mundo = new WorldState();

    expect(mundo.aplicar(pacote(1, 300))).toBe(true);

    expect(mundo.eu("eu").x).toBe(300);
    expect(mundo.inimigos.get("slime_0").x).toBe(500);
  });

  it("descarta um pacote atrasado", () => {
    const mundo = new WorldState();

    mundo.aplicar(pacote(5, 300));

    // a internet entrega fora de ordem as vezes. aceitar o
    // pacote velho faria o jogador dar meia-volta sozinho
    expect(mundo.aplicar(pacote(3, 10))).toBe(false);
    expect(mundo.eu("eu").x).toBe(300);
    expect(mundo.seq).toBe(5);
  });

  it("descarta um pacote repetido", () => {
    const mundo = new WorldState();

    mundo.aplicar(pacote(2, 300));

    expect(mundo.aplicar(pacote(2, 999))).toBe(false);
    expect(mundo.eu("eu").x).toBe(300);
  });

  it("ignora lixo sem quebrar", () => {
    const mundo = new WorldState();

    expect(() => mundo.aplicar(null)).not.toThrow();
    expect(mundo.eu("eu")).toBe(null);
  });

  it("lista os outros sem eu", () => {
    const mundo = new WorldState();

    mundo.aplicar({
      seq: 1,
      time: 0,
      players: [
        { id: "eu", name: "Ana", x: 1, y: 1 },
        { id: "bento", name: "Bento", x: 2, y: 2 },
      ],
      enemies: [],
      drops: [],
    });

    expect(mundo.outros("eu")).toHaveLength(1);
    expect(mundo.outros("eu")[0].name).toBe("Bento");
  });
});

describe("a interpolacao", () => {
  const pacote = (seq, x) => ({
    seq,
    time: seq * 0.05,
    players: [{ id: "eu", x, y: 0 }],
    enemies: [],
    drops: [],
  });

  it("no comeco do ciclo fica no pacote anterior", () => {
    const mundo = new WorldState();

    mundo.aplicar(pacote(1, 100));
    mundo.aplicar(pacote(2, 200));

    // desenhando 100 e 200 sem nada no meio, o personagem daria
    // um salto de 100 pixels
    expect(mundo.amostrar("eu", 0).x).toBe(100);
  });

  it("no fim do ciclo chega no pacote atual", () => {
    const mundo = new WorldState();

    mundo.aplicar(pacote(1, 100));
    mundo.aplicar(pacote(2, 200));

    expect(mundo.amostrar("eu", 1).x).toBe(200);
  });

  it("no meio fica no caminho", () => {
    const mundo = new WorldState();

    mundo.aplicar(pacote(1, 100));
    mundo.aplicar(pacote(2, 200));

    expect(mundo.amostrar("eu", 0.5).x).toBe(150);
  });

  it("nunca passa do pacote atual", () => {
    const mundo = new WorldState();

    mundo.aplicar(pacote(1, 100));
    mundo.aplicar(pacote(2, 200));

    // um `t` estragado (aba em segundo plano voltando) poderia
    // projetar o jogador para fora do mapa
    expect(mundo.amostrar("eu", 5).x).toBe(200);
    expect(mundo.amostrar("eu", -3).x).toBe(100);
  });

  it("com um pacote so, devolve ele mesmo", () => {
    const mundo = new WorldState();

    mundo.aplicar(pacote(1, 100));

    // ainda nao ha o pacote anterior para interpolar. devolver
    // `null` deixaria o personagem invisivel no primeiro segundo
    expect(mundo.amostrar("eu", 0.5).x).toBe(100);
  });

  it("quem nao existe no pacote devolve null", () => {
    const mundo = new WorldState();

    mundo.aplicar(pacote(1, 100));

    expect(mundo.amostrar("ninguem", 0.5)).toBe(null);
  });
});

describe("o fracao do ciclo", () => {
  it("sem pacote nenhum, ja esta no fim", () => {
    const mundo = new WorldState();

    expect(mundo.fracaoDoCiclo(1000)).toBe(1);
  });

  it("comeca em zero logo apos receber", () => {
    const mundo = new WorldState();

    mundo.aplicar({
      seq: 1,
      time: 0,
      players: [],
      enemies: [],
      drops: [],
    });
    mundo.marcaRecebimento(1000);

    expect(mundo.fracaoDoCiclo(1000)).toBe(0);
  });

  it("anda conforme o tempo passa", () => {
    const mundo = new WorldState();

    mundo.aplicar({
      seq: 1,
      time: 0,
      players: [],
      enemies: [],
      drops: [],
    });
    mundo.marcaRecebimento(1000);

    expect(mundo.fracaoDoCiclo(1025)).toBeCloseTo(0.5, 5);
  });

  it("trava em um quando o pacote atrasa", () => {
    const mundo = new WorldState();

    mundo.aplicar({
      seq: 1,
      time: 0,
      players: [],
      enemies: [],
      drops: [],
    });
    mundo.marcaRecebimento(1000);

    // 30 segundos sem pacote. sem o teto, `t` viraria 600 e a
    // interpolacao projetaria o jogador para fora do mapa
    expect(mundo.fracaoDoCiclo(31000)).toBe(1);
  });
});
