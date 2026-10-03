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
 * A folha do RATO DA TOCA.
 *
 * A arte e a mais bagunçada do jogo, e cada problema dela virou uma
 * decisao que este arquivo trava:
 *
 * 1. **A pasta se chama `urso`, e a criatura e `rat`.** O nome e da
 *    arte. A saida e o nome da CRIATURA, que e o que o `GameEngine`
 *    procura — como o ghoul, que usa a pasta `guerreiro` e sai como
 *    `ghoul_faminto-sheet.png`
 *
 * 2. **Falta o `south` de caminhada.** Sao sete direcoes e um idle.
 *    A folha usa o `idle` de frente como a linha do sul, para o bicho
 *    olhar na direcao do jogador ao descer. A alternativa — copiar a
 *    vizinha em grau — poria o rato andando na diagonal, e e a
 *    direcao mais vista do jogo
 *
 * 3. **As telas de origem tem tamanhos diferentes**: 68, 64, 60 e 56.
 *    A ferramenta centraliza as menores na celula, sem redimensionar
 *
 * 4. **Quatro quadros vieram truncados** pelo stream LZW, dois em cada
 *    diagonal de baixo. A ferramenta os copia do quadro vizinho
 */
const build = () => buildSheet("rato_da_toca");

const PASTA = SHEETS.rato_da_toca.sourceDir;

describe("a folha do rato da toca", () => {
  it("usa a pasta da arte e o nome da criatura", () => {
    expect(PASTA).toBe("src/assets/sprites/urso");
    expect(SHEETS.rato_da_toca.output).toBe(
      "src/assets/sprites/rato_da_toca-sheet.png",
    );

    // e o prefixo das constantes do layout
    expect(SHEETS.rato_da_toca.prefix).toBe("RATO_DA_TOCA");
  });

  it("declara o substitute do sul, e ele existe", () => {
    // sem esta declaracao a construcao PARA com "falta ./south.gif".
    // O `walkFallback` e o que diz que a arte pode faltar, e de onde
    // vem — nunca um palpite interno nem um arquivo renomeado
    expect(SHEETS.rato_da_toca.walkFallback).toEqual({
      south: "idle",
    });

    // e o alvo precisa existir de verdade
    expect(
      readFileSync(
        resolve(PASTA, "idle.gif"),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("o sul realmente nao existe na arte", () => {
    /**
     * A folha so declara o substitute porque o arquivo falta. Se a
     * arte passar a trazer `south.gif`, este teste avisa: o
     * `walkFallback` estara colando arte velha em cima da nova, e o
     * rato andaria de frente sem as patas mesmo com a arte de
     * caminhada disponivel
     */
    expect(() => readFileSync(resolve(PASTA, "south.gif"))).toThrow();
  });

  it("declara sem golpe, e nao com pasta de golpe", () => {
    // o rato e PASSIVO e nao ataca. `shootDir: "attack"` seria
    // mentira: nao existe pasta de golpe nenhuma
    expect(SHEETS.rato_da_toca.shoot).toBe(false);
    expect(SHEETS.rato_da_toca.shootDir).toBe(undefined);
    expect(SHEETS.rato_da_toca.idle).toBe(true);
  });

  it("mantem o padrao novo so nas folhas que declaram", () => {
    // `walkFallback` e uma escolha do rato, e nao da ferramenta: as
    // outras folhas tem as oito direcoes de verdade
    for (const nome of [
      "arbalist",
      "zumbi",
      "ogre",
      "warrior",
      "sorcerer",
      "lancer",
      "boneco",
      "ghoul",
    ]) {
      expect(
        SHEETS[nome].walkFallback,
        nome,
      ).toBe(undefined);
    }
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
    // a ancora amarra a celula ao ponto do mundo. Com a errada o rato
    // aparece deslocado em relacao as outras criaturas
    const resultado = build();

    expect(resultado.anchorX).toBe(33.5);
    expect(resultado.anchorY).toBe(51);
  });

  it("a geracao nao descarta nenhum quadro truncado", () => {
    /**
     * Quatro quadros vieram com o stream LZW cortado pela arte de
     * origem. Eles nao viram "vazios": a ferramenta copia o quadro
     * valido mais proximo, e o `audit` reprovaria a folha se restasse
     * alguma celula vazia
     */
    const resultado = build();

    expect(resultado.output).toBeTruthy();
  });
});

describe("a arte de origem do rato", () => {
  it("tem as sete direcoes de caminhada que existem", () => {
    // sete de oito: falta o sul, e a folha sabe disso pelo
    // `walkFallback`
    for (const direcao of ROWS) {
      if (direcao === "south") continue;

      expect(
        readFileSync(resolve(PASTA, `${direcao}.gif`)).length,
        direcao,
      ).toBeGreaterThan(0);
    }
  });

  it("os gifs tem oito quadros e nenhum vem pela metade", () => {
    // o `audit` da folha ja reprovaria celula vazia ou personagem
    // incompleto. Aqui a conferencia e no gif CRU, para o defeito ser
    // attributed a arte e nao a ferramenta
    for (const arquivo of [
      "east",
      "west",
      "north",
      "north-east",
      "north-west",
      "south-east",
      "south-west",
      "idle",
    ]) {
      const gif = decodeGif(
        readFileSync(resolve(PASTA, `${arquivo}.gif`)),
      );

      expect(gif.frames.length, arquivo).toBe(8);

      const truncados = gif.frames.filter(
        (frame) => !frame.complete,
      ).length;

      // as duas diagonais de baixo vem com dois quadros cortados
      // cada. A ferramenta conserta; o teste registra o defeito da
      // arte para ninguem achar que ele nasceu na folha
      const esperado =
        arquivo === "south-east" || arquivo === "south-west" ? 2 : 0;

      expect(truncados, arquivo).toBe(esperado);
    }
  });

  it("as telas de origem tem tamanhos diferentes, e nenhum passa da celula", () => {
    /**
     * A celula e 68px, e a arte vem em 68, 64, 60 e 56.
     *
     * As MENORES sao centralizadas. Uma tela MAIOR seria recusada, e
     * este teste e o que prova que a regra do ">68" nunca esta
     * bloqueando a geracao por acidente
     */
    const CELULA = SHEETS.rato_da_toca.frameSize;

    const tamanhos = new Set();

    for (const arquivo of [
      "east",
      "west",
      "north",
      "north-east",
      "north-west",
      "south-east",
      "south-west",
      "idle",
    ]) {
      const gif = decodeGif(
        readFileSync(resolve(PASTA, `${arquivo}.gif`)),
      );

      expect(gif.width, arquivo).toBeLessThanOrEqual(CELULA);
      expect(gif.height, arquivo).toBeLessThanOrEqual(CELULA);

      tamanhos.add(`${gif.width}x${gif.height}`);
    }

    // e sao MESMO tamanhos diferentes: se algum dia a arte vier
    // uniforme, o log de centralizacao deixa de ter motivo
    expect(tamanhos.size).toBeGreaterThan(1);
  });
});