import { describe, expect, it } from "vitest";
import {
  IDLE_FILE,
  ROWS,
  SHEETS,
  SHOOT_DIR,
  buildSheet,
} from "./gif-to-sheet.mjs";

/**
 * A folha do sorcerer.
 *
 * Este arquivo trava as adapting que a arte dele exigiu, e nao apenas
 * que a imagem saiu:
 *
 * 1. NAO tem golpe. O sorcerer e um caster de projetil, mas a pasta de
 *    origem nao trouxe arte de ataque: nem em `shoot/`, nem em pasta
 *    propria, nem misturado na caminhada. A folha sai com 8 linhas de
 *    direcao mais a de idle, e `shoot: false` e o que impede a
 *    ferramenta de procurar um `shoot/east.gif` que nunca existiu
 *
 * 2. TEM idle de verdade, com oito quadros. O ghoul tambem nao tem
 *    golpe, mas o idle dele e um `idle.gif` desenhado; e o que separa
 *    "sem golpe" de "sem idle", e as duas coisas sao declaradas
 *    separadas aqui
 *
 * E trava a geometria, que e o que impede o jogo de desenhar a arte
 * errada em silencio: 8 colunas x 9 linhas de 68px, com a linha de idle
 * na 8, que e a posicao que o layout em `src/data/sprites/layout.js`
 * le.
 */
const build = () => buildSheet("sorcerer");

describe("sheet do sorcerer", () => {
  it("declara que nao tem golpe, e tem idle de verdade", () => {
    expect(SHEETS.sorcerer.sourceDir).toBe(
      "src/assets/sprites/sorcerer",
    );
    expect(SHEETS.sorcerer.shoot).toBe(false);
    expect(SHEETS.sorcerer.idle).toBe(true);

    // `shoot: false` tem de ser uma ESCOLHA, e nao o silencio: sem
    // esta linha, `false` e `undefined` seriam lidos igual e o teste
    // passaria mesmo com a pasta de origem errada
    expect(SHEETS.sorcerer.shootDir).toBe(undefined);
    expect(SHEETS.sorcerer.shootDir).not.toBe(SHOOT_DIR);
    expect(SHEETS.sorcerer.idleFile).toBe(undefined);
    expect(SHEETS.sorcerer.idleFile).not.toBe(IDLE_FILE);
  });

  it("mantem o sorcerer fora do padrao novo das outras folhas", () => {
    // o sorcerer nao pode ter virado padrao da ferramenta: `shoot:
    // false` e `idle: true` so valem para ele e para quem nao tem
    // golpe nenhum
    for (const nome of [
      "arbalist",
      "zumbi",
      "ogre",
      "warrior",
    ]) {
      expect(SHEETS[nome].shoot, nome).not.toBe(false);
      expect(SHEETS[nome].idle, nome).not.toBe(true);
    }

    // o boneco e o ghoul nao tem golpe, e o motivo e o mesmo
    expect(SHEETS.boneco.shoot).toBe(false);
    expect(SHEETS.ghoul.shoot).toBe(false);
  });

  it("tem as 8 direcoes de caminhada e nenhuma de golpe", () => {
    const resultado = build();

    expect(ROWS).toHaveLength(8);
    expect(resultado.rows).toBe(9);

    // `shootRow: null` e melhor que zero: zero parece "um golpe de
    // zero quadros", e o que a folha tem a dizer e que NAO tem linha
    // de golpe nenhuma
    expect(resultado.shootRow).toBe(null);
    expect(resultado.shootFrames).toBe(0);
    expect(resultado.substituidas).toEqual([]);
  });

  it("cabe 8 colunas e 9 linhas de 68px", () => {
    // 8 de caminhada + 1 de idle = 9 linhas. Nao ha 17 linhas como
    // no guerreiro: sao as 8 de golpe que faltam
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
    // A ordem das linhas e o que o layout em `layout.js` le. A
    // caminhada ocupa de 0 a 7 e o idle vem logo depois. Se a ordem
    // mudar, o layout passa a apontar o idle para a caminhada e o
    // sorcerer "respira" andando
    const resultado = build();

    expect(resultado.idleRow).toBe(8);
  });

  it("mede a ancora em vez de chutar", () => {
    // A ancora e o que amarra a celula ao personagem, e o motor
    // posiciona o desenho por ela. Com a ancora errada o sorcerer
    // aparece deslocado em relacao as outras classes: ele tem celula
    // de 68px, e o `anchorY` do arquiro (54) o colocaria 2px fora do
    // chao
    const resultado = build();

    expect(resultado.anchorX).toBe(33);
    expect(resultado.anchorY).toBe(56);
  });

  it("nao repete a caminhada como se fosse golpe", () => {
    // Sem `shoot: false`, a ferramenta pararia num `shoot/east.gif`
    // faltando. Com ele, a folha nao pode DEPOIS colar a caminhada
    // no lugar de um golpe que nao existe: o jogador veria o
    // personagem andando no meio do golpe
    const resultado = build();

    expect(resultado.substituidas).toHaveLength(0);
  });
});