import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { NetworkWorld } from "../net/NetworkWorld.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { MAP_1 } from "../../data/maps/index.js";

const classe = CHARACTER_CLASSES.find((c) => c.id === "arbalist");

const criar = () => {
  const engine = new GameEngine(
    null,
    classe,
    null,
    { playerId: "p_ana", characterName: "Ana" },
  );

  engine.setMap(MAP_1);

  return engine;
};

/** Um estado no formato exato que o cliente entrega. */
const estado = (extra = {}) => ({
  eu: {
    id: "p_ana",
    name: "Ana",
    x: 3100,
    y: 2100,
    hp: 80,
    maxHp: 100,
    facing: { x: 1, y: 0 },
    isMoving: true,
  },
  outros: [],
  inimigos: [],
  drops: [],
  ...extra,
});

describe("o motor em modo rede", () => {
  it("comeca simulando, como sempre", () => {
    const engine = criar();

    // o single player depende disso: se o padrao mudasse, o
    // jogo offline viraria um visor de pacote sem servidor
    expect(engine.networked).toBe(false);
    expect(() => engine.update(0.016)).not.toThrow();

    engine.destroy();
  });

  it("ligado, ele NAO move o jogador sozinho", () => {
    const engine = criar();

    engine.setNetworked(true);

    const antes = engine.world.player.x;

    // o motor nao pode empurrar o jogador: quem decide a posicao
    // agora e o servidor. se ele se movesse, teriamos duas
    // simulacoes divergindo
    engine.input.keys.add("KeyD");
    engine.update(0.5);
    engine.update(0.5);

    expect(engine.world.player.x).toBe(antes);

    engine.destroy();
  });

  it("ligado, ele nao roda a IA dos inimigos", () => {
    const engine = criar();
    const inimigo = engine.world.enemies.find(
      (e) => e.kind !== "training" && e.hp > 0,
    );

    const xAntes = inimigo.x;

    engine.setNetworked(true);
    engine.update(1);

    // um inimigo andando sozinho viraria uma segunda fonte de
    // verdade, e o cliente veria o mob se mexer para fora do que o
    // servidor mandou
    expect(inimigo.x).toBe(xAntes);

    engine.destroy();
  });

  it("ligado, ele nao causa dano em ninguem", () => {
    const engine = criar();
    const inimigo = engine.world.enemies.find(
      (e) => e.kind !== "training" && e.hp > 0,
    );

    const hpAntes = inimigo.hp;

    engine.setNetworked(true);
    engine.input.keys.add("KeyD");
    engine.update(1);

    expect(inimigo.hp).toBe(hpAntes);

    engine.destroy();
  });

  it("ligado, o relogio de desenho continua andando", () => {
    const engine = criar();

    engine.setNetworked(true);
    engine.update(0.25);

    // sem isto o sprite ficaria congelado entre um snapshot e o
    // outro, e o personagem pareceria uma foto
    expect(engine.spriteTime).toBeGreaterThan(0);

    engine.destroy();
  });

  it("desligar volta a simulacao local", () => {
    const engine = criar();

    engine.setNetworked(true);
    engine.update(0.5);

    const xParado = engine.world.player.x;

    engine.setNetworked(false);
    engine.update(0.5);

    // o modo offline precisa continuar funcionando depois de uma
    // queda de conexao
    expect(engine.world.player.x).toBe(xParado);

    engine.destroy();
  });
});

describe("a ponte escreve o estado nas entidades", () => {
  it("move o jogador para onde o servidor disse", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    mundo.aplicar(estado());

    expect(engine.world.player.x).toBe(3100);
    expect(engine.world.player.y).toBe(2100);
    expect(engine.world.player.hp).toBe(80);
    expect(engine.world.player.isMoving).toBe(true);

    engine.destroy();
  });

  it("mata o inimigo que o servidor matou", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    const alvo = engine.world.enemies.find(
      (e) => e.kind !== "training",
    );

    expect(alvo.alive).toBe(true);

    mundo.aplicar(
      estado({
        inimigos: [
          {
            id: alvo.id,
            x: alvo.x,
            y: alvo.y,
            hp: 0,
            maxHp: alvo.maxHp,
            state: "dead",
          },
        ],
      }),
    );

    // sem isto, a barra de vida ficaria vazia no ar e o mob
    // continuaria desenhado
    expect(alvo.alive).toBe(false);
    expect(alvo.hp).toBe(0);

    engine.destroy();
  });

  it("mantem a posicao do inimigo que o servidor mandou", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    const alvo = engine.world.enemies.find(
      (e) => e.kind !== "training",
    );

    mundo.aplicar(
      estado({
        inimigos: [
          {
            id: alvo.id,
            x: 1234,
            y: 5678,
            hp: 5,
            maxHp: alvo.maxHp,
            state: "idle",
          },
        ],
      }),
    );

    expect(alvo.x).toBe(1234);
    expect(alvo.y).toBe(5678);
    expect(alvo.alive).toBe(true);

    engine.destroy();
  });

  it("ignora inimigo que o cliente nao conhece", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);
    const antes = engine.world.enemies.length;

    mundo.aplicar(
      estado({
        inimigos: [
          { id: "monstro_novo", x: 1, y: 1, hp: 10, maxHp: 10, state: "idle" },
        ],
      }),
    );

    // inventar uma entidade sem sprite nem barra daria um
    // quadrado preto no meio do mapa
    expect(engine.world.enemies).toHaveLength(antes);

    engine.destroy();
  });

  it("ignora estado vazio em vez de zerar tudo", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    const xAntes = engine.world.player.x;

    // o primeiro estado chega sem mundo nenhum. se fosse aplicado,
    // o personagem iria para o canto (0, 0) e piscaria
    expect(mundo.aplicar(null)).toBe(false);
    expect(mundo.aplicar({ inimigos: [] })).toBe(false);
    expect(engine.world.player.x).toBe(xAntes);

    engine.destroy();
  });
});

describe("os outros jogadores aparecem", () => {
  it("cria um corpo para quem entrou", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    mundo.aplicar(
      estado({
        outros: [
          {
            id: "p_bento",
            name: "Bento",
            classId: "sorcerer",
            x: 3200,
            y: 2150,
            hp: 90,
            maxHp: 100,
          },
        ],
      }),
    );

    const bento = mundo.porId.get("p_bento");

    expect(bento).toBeTruthy();
    expect(bento.isPlayer).toBe(true);
    expect(bento.name).toBe("Bento");
    expect(bento.x).toBe(3200);
    expect(bento.alive).toBe(true);
    expect(engine.world.enemies).toContain(bento);

    engine.destroy();
  });

  it("some quando o jogador sai", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    const comBento = {
      outros: [
        { id: "p_bento", name: "Bento", x: 3200, y: 2150, hp: 90, maxHp: 100 },
      ],
    };

    mundo.aplicar(estado(comBento));
    expect(mundo.porId.has("p_bento")).toBe(true);

    mundo.aplicar(estado({ outros: [] }));

    // sem a limpeza, o Bento ficaria congelado no mapa para sempre
    // depois de desconectar
    expect(mundo.porId.has("p_bento")).toBe(false);
    expect(engine.world.enemies).not.toContain(
      mundo.remotos?.get("p_bento"),
    );

    engine.destroy();
  });

  it("atualiza a posicao de quem ja estava", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    const bento = (x) => ({
      outros: [
        { id: "p_bento", name: "Bento", x, y: 2150, hp: 90, maxHp: 100 },
      ],
    });

    mundo.aplicar(estado(bento(3200)));
    mundo.aplicar(estado(bento(3300)));

    expect(mundo.porId.get("p_bento").x).toBe(3300);

    // e continua sendo UM corpo, nao dois
    const quantos = engine.world.enemies.filter(
      (e) => e.id === "p_bento",
    );

    expect(quantos).toHaveLength(1);

    engine.destroy();
  });
});

describe("os drops no chao", () => {
  it("so mostra o drop do proprio jogador", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    mundo.aplicar(
      estado({
        drops: [
          { uid: "d1", kind: "item", itemId: "slime_gel", x: 100, y: 100, ownerId: "p_ana" },
          { uid: "d2", kind: "item", itemId: "rat_tail", x: 120, y: 120, ownerId: "p_bento" },
        ],
      }),
    );

    const ids = engine.world.drops.map((d) => d.itemId);

    // o drop de outro jogador nao pode parecer pegavel, ou o
    // jogador ficaria clicking em um item que nunca entra
    expect(ids).toContain("slime_gel");
    expect(ids).not.toContain("rat_tail");

    engine.destroy();
  });

  it("aceita drop sem dono", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    mundo.aplicar(
      estado({
        drops: [
          { uid: "d1", kind: "coins", coins: 5, x: 100, y: 100, ownerId: null },
        ],
      }),
    );

    expect(engine.world.drops).toHaveLength(1);

    engine.destroy();
  });

  it("nao recria o drop a cada snapshot", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    const drops = () => [
      { uid: "d1", kind: "item", itemId: "slime_gel", x: 100, y: 100, ownerId: "p_ana" },
    ];

    mundo.aplicar(estado({ drops: drops() }));

    const primeiro = engine.world.drops[0];

    mundo.aplicar(estado({ drops: drops() }));

    // recriar a entidade a cada pacote (20x por segundo) faria o
    // item no chao piscar e a idade reiniciar sem parar
    expect(engine.world.drops[0]).toBe(primeiro);

    engine.destroy();
  });
});

describe("o caminho completo: servidor -> tela", () => {
  it("o que o cliente mostra bate com o que o motor desenha", () => {
    const engine = criar();
    const mundo = new NetworkWorld(engine);

    engine.setNetworked(true);

    mundo.aplicar(estado());

    // o teste que amarra as duas pontas: se o ids do snapshot e
    // do motor divergirem, o jogador veria o mob no lugar errado
    expect(engine.world.player.x).toBe(3100);
    expect(engine.world.session.player.x).toBe(3100);

    engine.destroy();
  });
});
