import { describe, expect, it } from "vitest";
import {
  ROWS,
  SHEETS,
  buildSheet,
  decodeGif,
} from "./gif-to-sheet.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A folha do GOBLIN SAQUEADOR.
 *
 * A arte esta limpa, como a da sentinela, do limo e do ghoul: oito
 * direcoes, `idle`, todas em 68x68, oito quadros, nenhum truncado.
 * Nenhuma adaptacao foi necessaria
 *
 * A pasta de origem se chama `hulk`, que e o nome da arte. A saida usa
 * `goblin_saqueador`, o nome de exibicao da criatura, como o ghoul usa
 * `ghoul_faminto` para a pasta `guerreiro`. A razao do fim do arquivo
 */
const build = () => buildSheet("goblin_saqueador");

const PASTA = SHEETS.goblin_saqueador.sourceDir;
const CELULA = SHEETS.goblin_saqueador.frameSize;

const gifs = () =>
  [...ROWS.map((row) => row), "idle"].map((name) => ({
    name,
    gif: decodeGif(readFileSync(resolve(PASTA, `${name}.gif`))),
  }));

describe("a folha do goblin saqueador", () => {
  it("usa a pasta `hulk`, que e o nome da arte", () => {
    expect(PASTA).toBe("src/assets/sprites/hulk");

    /**
     * A pasta e `hulk` e a criatura e o `goblin`. Sao coisas diferentes:
     * `hulk` e o nome que quem desenhou deu para o arquivo, e
     * `goblin` e o `id` que o jogo usa no save, no bestiario e no loot
     */
    expect(SHEETS.goblin_saqueador.prefix).toBe(
      "GOBLIN_SAQUEADOR",
    );
  });

  it("a saida usa o nome de exibicao, como o ghoul", () => {
    expect(SHEETS.goblin_saqueador.output).toBe(
      "src/assets/sprites/goblin_saqueador-sheet.png",
    );

    /**
     * `hulk` nao pode virar o nome do arquivo.
     *
     * O nome de exibicao e "Goblin Saqueador", e o ghoul faz o mesmo
     * com "Ghoul Faminto" quando a pasta dele e `guerreiro`. Usar a
     * pasta na saida criaria um `hulk-sheet.png` que nada liga ao
     * goblin, e o proximo a olhar essa pasta pensaria que existe um
     * hulk no jogo
     */
    expect(SHEETS.goblin_saqueador.output).not.toContain("hulk");
  });

  it("a saida nao colide com a de nenhuma outra folha", () => {
    const saidas = Object.values(SHEETS)
      .map((sheet) => sheet.output)
      .filter(Boolean);

    expect(new Set(saidas).size, "saidas repetidas").toBe(
      saidas.length,
    );
  });

  it("declara sem golpe, e nao com pasta de golpe", () => {
    /**
     * O goblin e `SEMI_PASSIVE` com `aggroRange: 0`, o mesmo caso do
     * ghoul faminto: passeia e nao persegue. `shootDir: "attack"`
     * seria mentira, nao existe pasta de golpe
     */
    expect(SHEETS.goblin_saqueador.shoot).toBe(false);
    expect(SHEETS.goblin_saqueador.shootDir).toBe(undefined);
    expect(SHEETS.goblin_saqueador.idle).toBe(true);
  });

  it("tem as oito direcoes e nenhuma de golpe", () => {
    const resultado = build();

    expect(ROWS).toHaveLength(8);
    expect(resultado.rows).toBe(9);
    expect(resultado.shootRow).toBe(null);
    expect(resultado.shootFrames).toBe(0);
  });

  it("cabe 8 colunas e 9 linhas de 68px", () => {
    const resultado = build();

    expect(resultado.frameSize).toBe(68);
    expect(resultado.columns).toBe(8);
    expect(resultado.width).toBe(8 * 68);
    expect(resultado.height).toBe(9 * 68);
  });

  it("conta os quadros de cada ciclo", () => {
    const resultado = build();

    expect(resultado.walkFrames).toBe(8);
    expect(resultado.idleFrames).toBe(8);
  });

  it("poe o idle na linha 8", () => {
    expect(build().idleRow).toBe(8);
  });

  it("mede a ancora em vez de chutar", () => {
    const resultado = build();

    expect(resultado.anchorX).toBe(33.5);
    expect(resultado.anchorY).toBe(55);
  });
});

describe("a arte de origem do goblin", () => {
  it("tem as oito direcoes de caminhada, todas", () => {
    for (const direcao of ROWS) {
      expect(
        readFileSync(resolve(PASTA, `${direcao}.gif`)).length,
        `falta ${direcao}.gif`,
      ).toBeGreaterThan(0);
    }
  });

  it("tem oito quadros em cada gif, e nenhum pela metade", () => {
    for (const { name, gif } of gifs()) {
      expect(gif.width, name).toBe(CELULA);
      expect(gif.height, name).toBe(CELULA);
      expect(gif.frames.length, name).toBe(8);

      const truncados = gif.frames.filter(
        (frame) => !frame.complete,
      ).length;

      expect(truncados, `${name}.gif`).toBe(0);
    }
  });

  it("todas as telas tem o MESMO tamanho", () => {
    const tamanhos = new Set(
      gifs().map(({ gif }) => `${gif.width}x${gif.height}`),
    );

    expect([...tamanhos]).toEqual([`${CELULA}x${CELULA}`]);
  });
});