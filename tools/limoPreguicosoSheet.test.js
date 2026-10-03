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
 * A folha do LIMO PREGUICOSO.
 *
 * Como a da sentinela, a arte e limpa: oito direcoes, `idle`, todas em
 * 68x68, oito quadros, nenhum truncado. Nenhuma adaptacao foi
 * necessaria, e este arquivo trava o QUE a pasta nao mudou
 *
 * A razao de a saida se chamar `limo_preguicoso` e nao `guerreiro_2`
 * esta no fim do arquivo: e o jogo que tem DUAS pastas `guerreiro`, e
 * um `guerreiro-sheet.png` sobrescreveria a folha do ghoul faminto
 */
const build = () => buildSheet("limo_preguicoso");

const PASTA = SHEETS.limo_preguicoso.sourceDir;
const CELULA = SHEETS.limo_preguicoso.frameSize;

const gifs = () =>
  [...ROWS.map((row) => row), "idle"].map((name) => ({
    name,
    gif: decodeGif(
      readFileSync(resolve(PASTA, `${name}.gif`)),
    ),
  }));

describe("a folha do limo preguiçoso", () => {
  it("usa a pasta da arte e o nome da criatura", () => {
    expect(PASTA).toBe("src/assets/sprites/guerreiro_2");
    expect(SHEETS.limo_preguicoso.output).toBe(
      "src/assets/sprites/limo_preguicoso-sheet.png",
    );
    expect(SHEETS.limo_preguicoso.prefix).toBe(
      "LIMO_PREGUICOSO",
    );
  });

  it("a saida NAO pode se chamar guerreiro, que ja e do ghoul", () => {
    /**
     * O jogo tem DUAS pastas `guerreiro`: a primeira virou o ghoul
     * faminto, e esta e a segunda. As duas folhas precisam de nome
     * proprio na saida, porque um `guerreiro-sheet.png` sobrescreveria
     * a do ghoul — e o ghoul apareceria com a arte do limo, sem erro
     * nenhum no build
     */
    const saidas = Object.values(SHEETS)
      .map((sheet) => sheet.output)
      .filter(Boolean);

    expect(new Set(saidas).size, "saidas repetidas").toBe(
      saidas.length,
    );

    for (const saida of saidas) {
      expect(
        saida.endsWith("guerreiro-sheet.png"),
        `a saida ${saida} colide com a pasta guerreiro`,
      ).toBe(false);
    }
  });

  it("NAO declara walkFallback: as oito direcoes existem", () => {
    // o `walkFallback` do rato existe porque faltava `south.gif`. Com
    // as oito presentes, declarar um substituto deixaria a folha
    // parecendo depender de um artefato
    expect(
      SHEETS.limo_preguicoso.walkFallback,
    ).toBe(undefined);
  });

  it("declara sem golpe, e nao com pasta de golpe", () => {
    // o limo e PASSIVO e foge do jogador. `shootDir: "attack"` seria
    // mentira: nao existe pasta de golpe nenhuma
    expect(SHEETS.limo_preguicoso.shoot).toBe(false);
    expect(SHEETS.limo_preguicoso.shootDir).toBe(undefined);
    expect(SHEETS.limo_preguicoso.idle).toBe(true);
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
    expect(resultado.anchorY).toBe(54);
  });
});

describe("a arte de origem do limo", () => {
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
    // a regra de centralizar so existe para arte MENOR que a celula
    const tamanhos = new Set(
      gifs().map(({ gif }) => `${gif.width}x${gif.height}`),
    );

    expect([...tamanhos]).toEqual([`${CELULA}x${CELULA}`]);
  });
});