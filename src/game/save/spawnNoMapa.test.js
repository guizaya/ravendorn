import { describe, expect, it } from "vitest";

import { createPlayerSession } from "../engine/PlayerSession.js";
import { applyCharacterSave } from "./CharacterSave.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { BASE_MAP } from "../../data/maps/base.js";
import { MAP_1 } from "../../data/maps/index.js";

/**
 * ONDE O JOGADOR NASCE, EM CADA MAPA.
 *
 * O hub tem um spawn so: o meio. Isso parece tautologia — o
 * `BASE_SPAWN` ja sai de `bounds.x + width / 2` — e e por isso que o
 * lugar onde o spawn pode ser furado merece teste.
 *
 * Sao dois caminhos que colocam o jogador no mundo, e os dois precisam
 * respeitar o centro:
 *
 *   - o personagem NOVO, que nasce na sessao
 *   - o personagem QUE VOLTA, cuja posicao vem de um save gravado em
 *     outro mapa
 *
 * O segundo e o que passou. Um save do vale traz coordenadas do vale
 * (3000, 2000), e a base vai so ate (1640, 1136): o jogador nascia no
 * vazio, invisivel e sem saida. O `limites` que impediria isso vinha de
 * `config.limites`, um campo que ninguem definia, entao chegava sempre
 * `null` e o clamp nunca rodava
 */

const classe = CHARACTER_CLASSES.find(
  (c) => c.id === "arbalist",
);

/** Os limites no formato que o `applyCharacterSave` espera. */
function limitesDe(mapa) {
  return {
    minX: mapa.bounds.x,
    maxX: mapa.bounds.x + mapa.bounds.width,
    minY: mapa.bounds.y,
    maxY: mapa.bounds.y + mapa.bounds.height,
  };
}

const sessao = (mapa) =>
  createPlayerSession(classe, {
    spawn: { x: mapa.spawn.x, y: mapa.spawn.y },
  });

describe("o spawn do hub e o meio do mapa", () => {
  it("o meio sai da propria conta dos limites", () => {
    expect(BASE_MAP.spawn.x).toBe(BASE_MAP.width / 2);
    expect(BASE_MAP.spawn.y).toBe(BASE_MAP.height / 2);
  });

  it("o meio esta longe das quatro bordas", () => {
    const { x, y } = BASE_MAP.spawn;
    const { bounds } = BASE_MAP;

    expect(x - bounds.x).toBeGreaterThan(300);
    expect(bounds.x + bounds.width - x).toBeGreaterThan(300);
    expect(y - bounds.y).toBeGreaterThan(300);
    expect(bounds.y + bounds.height - y).toBeGreaterThan(300);
  });
});

describe("personagem novo na base", () => {
  it("nasce no meio", () => {
    const s = sessao(BASE_MAP);

    expect(s.player.x).toBe(BASE_MAP.spawn.x);
    expect(s.player.y).toBe(BASE_MAP.spawn.y);
  });
});

describe("personagem que volta de outro mapa", () => {
  it("um save do vale traz o personagem para o meio da base", () => {
    // (3000, 2000) esta no Pantano Profundo, bem dentro do vale e
    // completamente fora da base
    const vale = sessao(MAP_1);
    const base = sessao(BASE_MAP);

    applyCharacterSave(
      base,
      { player: { level: 1, xp: 0, x: 3000, y: 2000 } },
      { limites: limitesDe(BASE_MAP), spawn: BASE_MAP.spawn },
    );

    expect(base.player.x).toBe(BASE_MAP.spawn.x);
    expect(base.player.y).toBe(BASE_MAP.spawn.y);

    // e o vale, para o caso de o `x` estar dentro mas o `y` nao
    expect(vale.player.x).toBe(MAP_1.spawn.x);
  });

  it("um eixo fora ja joga no meio, mesmo com o outro dentro", () => {
    const base = sessao(BASE_MAP);

    applyCharacterSave(
      base,
      { player: { level: 1, xp: 0, x: 800, y: 9999 } },
      { limites: limitesDe(BASE_MAP), spawn: BASE_MAP.spawn },
    );

    // o x estava bom e foi preservado; o y nao tinha para onde ir
    expect(base.player.y).toBe(BASE_MAP.spawn.y);
  });

  it("a base nao devolve ninguem para fora dos limites dela", () => {
    const base = sessao(BASE_MAP);

    applyCharacterSave(
      base,
      { player: { level: 1, xp: 0, x: 3000, y: 2000 } },
      { limites: limitesDe(BASE_MAP), spawn: BASE_MAP.spawn },
    );

    expect(base.player.x).toBeLessThanOrEqual(
      BASE_MAP.bounds.x + BASE_MAP.bounds.width,
    );

    expect(base.player.y).toBeLessThanOrEqual(
      BASE_MAP.bounds.y + BASE_MAP.bounds.height,
    );
  });
});

describe("continuar onde parou continua valendo", () => {
  it("quem salvou no vale volta no vale, no ponto dele", () => {
    const vale = sessao(MAP_1);

    applyCharacterSave(
      vale,
      { player: { level: 1, xp: 0, x: 3000, y: 2000 } },
      { limites: limitesDe(MAP_1), spawn: MAP_1.spawn },
    );

    expect(vale.player.x).toBe(3000);
    expect(vale.player.y).toBe(2000);
  });

  it("sem limites, o save e aceito como vem", () => {
    /**
     * Quem chama sem `limites` esta dizendo que nao sabe onde o
     * personagem esta. A funcao nao inventa limite: ela respeita o
     * que veio
     */
    const vale = sessao(MAP_1);

    applyCharacterSave(
      vale,
      { player: { level: 1, xp: 0, x: 3000, y: 2000 } },
      { spawn: MAP_1.spawn },
    );

    expect(vale.player.x).toBe(3000);
    expect(vale.player.y).toBe(2000);
  });

  it("posicao sem numero cai no spawn", () => {
    const base = sessao(BASE_MAP);

    applyCharacterSave(
      base,
      { player: { level: 1, xp: 0, x: "abc", y: null } },
      { limites: limitesDe(BASE_MAP), spawn: BASE_MAP.spawn },
    );

    expect(base.player.x).toBe(BASE_MAP.spawn.x);
    expect(base.player.y).toBe(BASE_MAP.spawn.y);
  });
});
