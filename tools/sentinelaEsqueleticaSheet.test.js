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
 * A folha da SENTINELA ESQUELETICA.
 *
 * Esta e a arte mais limpa que ja entrou no jogo, e este arquivo existe
 * justamente por isso: nenhuma adaptacao foi necessaria, e um teste que
 * so confirmasse o que ja funciona nao diria nada. O que ele trava e o
 * QUE a pasta nao mudou:
 *
 * 1. As oito direcoes estao todas. O rato entrou com sete e precisou de
 *    `walkFallback`; se a sentinela perder um dia o `south`, este teste
 *    avisa em vez de a folha passar a colar arte de parado em silencio
 *
 * 2. Todas as telas tem o mesmo tamanho. Nenhuma foi centralizada, e a
 *    regra de centralizar existe para arte menor — nao para arte torta
 *
 * 3. Nenhum quadro veio truncado pelo stream LZW
 */
const build = () => buildSheet("sentinela_esqueletica");

const PASTA = SHEETS.sentinela_esqueletica.sourceDir;
const CELULA = SHEETS.sentinela_esqueletica.frameSize;

const gifs = () =>
  [...ROWS.map((row) => row), "idle"].map((name) => ({
    name,
    gif: decodeGif(
      readFileSync(resolve(PASTA, `${name}.gif`)),
    ),
  }));

describe("a folha da sentinela esqueletica", () => {
  it("usa a pasta da arte e o nome da criatura", () => {
    expect(PASTA).toBe("src/assets/sprites/sentinela");
    expect(SHEETS.sentinela_esqueletica.output).toBe(
      "src/assets/sprites/sentinela_esqueletica-sheet.png",
    );
    expect(SHEETS.sentinela_esqueletica.prefix).toBe(
      "SENTINELA_ESQUELETICA",
    );
  });

  it("NAO declara walkFallback: as oito direcoes existem", () => {
    /**
     * A diferenca mais importante em relacao ao rato.
     *
     * O `walkFallback` do rato existe porque faltava `south.gif`. A
     * sentinela tem todas as oito, entao declarar um substituto aqui
     * faria a ferramenta USAR a arte errada em vez da arte certa: o
     * `loadLane` so troca quando o arquivo nao existe, e um
     * `walkFallback` com a direcao presente nao muda nada — mas deixa
     * a folha parecendo depender de um artifato
     */
    expect(
      SHEETS.sentinela_esqueletica.walkFallback,
      "a sentinela nao precisa de substitute",
    ).toBe(undefined);
  });

  it("declara COM golpe, que a arte passou a ter", () => {
    // a sentinela ATACA (`attackRange: 58`) e mesmo assim nao ha arte de
    // A pasta `shoot/` encheu com as oito direcoes. Sem `shootDir`, a
    // ferramenta le o nome padrao, que e o da pasta
    expect(SHEETS.sentinela_esqueletica.shoot).toBe(true);
    expect(SHEETS.sentinela_esqueletica.shootDir).toBe(undefined);
    expect(SHEETS.sentinela_esqueletica.idle).toBe(true);
  });

  it("tem as oito direcoes de caminhada e as oito de golpe", () => {
    const resultado = build();

    expect(ROWS).toHaveLength(8);
    expect(resultado.rows).toBe(17);
    expect(resultado.shootRow).toBe(9);
    expect(resultado.shootFrames).toBe(9);
  });

  it("cabe 9 colunas e 17 linhas de 68px", () => {
    const resultado = build();

    expect(resultado.frameSize).toBe(68);
    expect(resultado.columns).toBe(9);
    expect(resultado.width).toBe(9 * 68);

    // 8 de caminhada + 1 de idle + 8 de golpe
    expect(resultado.height).toBe(17 * 68);
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
    // a ancora amarra a celula ao ponto do mundo. Com a errada a
    // sentinela aparece deslocada em relacao as outras criaturas
    const resultado = build();

    expect(resultado.anchorX).toBe(33.5);
    expect(resultado.anchorY).toBe(54);
  });
});

describe("a arte de origem da sentinela", () => {
  it("tem as oito direcoes de caminhada, todas", () => {
    // o contrario do rato: aqui nada falta, e nenhum `substituiu`
    // pode ter entrado na folha
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

      // a assinatura de quadro truncado e o stream LZW parando no meio.
      // O `audit` da folha reprovaria uma celula vazia, mas a conferir
      // aqui atribui o defeito a arte e nao a ferramenta
      const truncados = gif.frames.filter(
        (frame) => !frame.complete,
      ).length;

      expect(truncados, `${name}.gif`).toBe(0);
    }
  });

  it("todas as telas tem o MESMO tamanho", () => {
    /**
     * A regra de centralizar so existe para arte MENOR que a celula.
     * Uma tela maior seria recusada com "seria preciso cortar pixel da
     * arte", e uma arte com tamanhos variados tem de passar por ela
     */
    const tamanhos = new Set(
      gifs().map(({ gif }) => `${gif.width}x${gif.height}`),
    );

    expect(
      [...tamanhos],
      "a arte da sentinela nao devia ter telas de tamanhos diferentes",
    ).toEqual([`${CELULA}x${CELULA}`]);
  });

  it("nenhuma direcao tem um desenho muito diferente das outras", () => {
    /**
     * A sentinela e uma criatura so, entao as oito direcoes tem o
     * mesmo corpo em tamanhos parecidos. Um `bbox` muito diferente
     * seria a pista de que entrou a arte errada na pasta — e o rato
     * foi exatamente assim que veio a `Idle_v3_idle_breathing_south`
     */
    for (const { name, gif } of gifs()) {
      let minX = gif.width;
      let maxX = -1;
      let minY = gif.height;
      let maxY = -1;

      const frame = gif.frames[0].rgba;

      for (let y = 0; y < gif.height; y += 1) {
        for (let x = 0; x < gif.width; x += 1) {
          if (frame[(y * gif.width + x) * 4 + 3] === 0) continue;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }

      const largura = maxX - minX + 1;
      const altura = maxY - minY + 1;

      // nenhuma direcao e uma silhueta radicalmente diferente
      expect(largura, `${name} largura`).toBeGreaterThan(20);
      expect(altura, `${name} altura`).toBeGreaterThan(20);
      expect(altura, `${name} altura`).toBeLessThan(CELULA - 8);
    }
  });
});