import { describe, expect, it } from "vitest";
import {
  IDLE_FILE,
  ROWS,
  SHEETS,
  SHOOT_DIR,
  buildSheet,
} from "./gif-to-sheet.mjs";

/**
 * A folha do guerreiro.
 *
 * Este arquivo trava as DUAS adaptacoes que a arte dele exigiu, e nao
 * apenas que a imagem saiu:
 *
 * 1. O golpe dele esta em `attack/`, e nao em `shoot/`. O nome da
 *    pasta vem da arte de origem, entao a pasta declara o dela. E um
 *    corpo a corpo: o golpe e um `./target`, nao um tiro
 * 2. O idle se chama `indle.gif`, com o `d` trocado pelo `i`. O nome
 *    real fica declarado, e nao um palpite interno nem um arquivo
 *    renomeado por baixo dos panos
 *
 * E trava tambem a geometria, que e o que impede o jogo de desenhar
 * a arte errada em silencio: 9 colunas x 17 linhas de 68px, com as
 * linhas na ordem que o layout em `src/data/sprites/layout.js` le.
 */
const build = () => buildSheet("warrior");

describe("sheet do guerreiro", () => {
  it("declara a pasta do golpe e o nome real do idle", () => {
    expect(SHEETS.warrior.sourceDir).toBe(
      "src/assets/sprites/warrior",
    );

    // o golpe em `attack/`, e nao o `shoot` padrao
    expect(SHEETS.warrior.shootDir).toBe("attack");
    expect(SHEETS.warrior.shootDir).not.toBe(SHOOT_DIR);

    // o idle com o nome trocado, declarado em vez de adivinhado
    expect(SHEETS.warrior.idleFile).toBe("indle");
    expect(SHEETS.warrior.idleFile).not.toBe(IDLE_FILE);
  });

  it("mantem shoot e idle como padrao para as outras folhas", () => {
    // o guerreiro nao pode ter virado o padrao da ferramenta: as
    // outras cinco folhas nao tem `attack/` nem `indle.gif`
    for (const nome of [
      "arbalist",
      "zumbi",
      "ogre",
      "boneco",
      "ghoul",
    ]) {
      expect(SHEETS[nome].shootDir, nome).toBe(undefined);
      expect(SHEETS[nome].idleFile, nome).toBe(undefined);
    }

    expect(SHEETS.arbalist.shoot).toBe(undefined);
    expect(SHEETS.zumbi.shoot).toBe(undefined);
  });

  it("tem as 8 direcoes de caminhada e as 8 de golpe", () => {
    const resultado = build();

    expect(ROWS).toHaveLength(8);
    expect(resultado.rows).toBe(17);
    expect(resultado.substituidas).toEqual([]);
  });

  it("cabe 9 colunas e 17 linhas de 68px", () => {
    // 8 de caminhada + 1 de idle + 8 de golpe = 17 linhas
    // 9 colunas porque o golpe tem 9 quadros, um a mais que os 8 da
    // caminhada e do idle
    const resultado = build();

    expect(resultado.frameSize).toBe(68);
    expect(resultado.columns).toBe(9);
    expect(resultado.width).toBe(9 * 68);
    expect(resultado.height).toBe(17 * 68);
  });

  it("conta os quadros de cada ciclo", () => {
    const resultado = build();

    expect(resultado.walkFrames).toBe(8);
    expect(resultado.idleFrames).toBe(8);
    expect(resultado.shootFrames).toBe(9);
  });

  it("põe o idle na linha 8 e o golpe na 9", () => {
    // A ordem das linhas e o que o layout em `layout.js` le. A
    // caminhada ocupa de 0 a 7, o idle vem logo depois, e o golpe
    // depois do idle. Se a ordem mudar, o layout passa a apontar o
    // golpe para a caminhada e o jogo desenha o guerreiro
    // andando enquanto ele golpeia
    const resultado = build();

    expect(resultado.idleRow).toBe(8);
    expect(resultado.shootRow).toBe(9);
  });

  it("mede a ancora em vez de chutar", () => {
    // A ancora e o que amarra a celula ao personagem, e o motor
    // posiciona o desenho por ela. Com a ancora errada o guerreiro
    // appearia deslocado em relacao as outras classes
    const resultado = build();

    expect(resultado.anchorX).toBe(34);
    expect(resultado.anchorY).toBe(55);
  });

  it("nao repete a caminhada como se fosse golpe", () => {
    // O golpe do guerreiro e uma arte de verdade em `attack/`. Se um
    // dia a pasta sumir, a ferramenta nao pode colar a caminhada no
    // lugar do golpe: o jogador veria o personagem andando no meio do
    // golpe, e o `shootFallback` declarado aqui seria a prova
    const resultado = build();

    // 8 substituicoes = as 8 direcoes de golpe vindas de outra arte
    expect(resultado.substituidas).toHaveLength(0);
  });
});
