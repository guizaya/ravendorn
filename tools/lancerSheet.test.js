import { describe, expect, it } from "vitest";
import {
  IDLE_FILE,
  ROWS,
  SHEETS,
  SHOOT_DIR,
  buildSheet,
} from "./gif-to-sheet.mjs";

/**
 * A folha do lancer.
 *
 * Este arquivo trava as adaptacoes que a arte dele exigiu:
 *
 * 1. O idle se chama `indle.gif`, com o `d` trocado pelo `i` — o mesmo
 *    nome que o guerreiro entrega. O nome real fica DECLARADO na
 *    folha, e nao um palpite interno nem um arquivo renomeado
 *
 * 2. NAO tem golpe. O lancer e um bruiser e o golpe basico dele e um
 *    `./target` em linha, mas a pasta de origem nao trouxe a arte:
 *    nem em `shoot/`, nem em pasta propria. A folha sai com 8 linhas
 *    de direcao mais a de idle
 *
 * E trava a geometria, que e o que impede o jogo de desenhar a arte
 * errada em silencio: 8 colunas x 9 linhas de 68px, com o idle na 8.
 */
const build = () => buildSheet("lancer");

describe("sheet do lancer", () => {
  it("declara o nome real do idle, o mesmo do guerreiro", () => {
    expect(SHEETS.lancer.sourceDir).toBe(
      "src/assets/sprites/lancer",
    );

    expect(SHEETS.lancer.idleFile).toBe("indle");
    expect(SHEETS.lancer.idleFile).not.toBe(IDLE_FILE);

    // e o guerreiro declara o mesmo nome: as duas pastas de origem
    // vieram do mesmo lugar, e as duas folhas precisam ler o arquivo
    // que existe
    expect(SHEETS.lancer.idleFile).toBe(SHEETS.warrior.idleFile);
  });

  it("declara que nao tem golpe, sem declarar pasta de golpe", () => {
    expect(SHEETS.lancer.shoot).toBe(false);

    // `shootDir: "attack"` seria mentira: nao existe pasta de golpe
    // nenhuma no lancer. O guerreiro declara porque a pasta dele
    // existe e se chama `attack`
    expect(SHEETS.lancer.shootDir).toBe(undefined);
    expect(SHEETS.lancer.shootDir).not.toBe(SHOOT_DIR);
    expect(SHEETS.lancer.shootDir).not.toBe(SHEETS.warrior.shootDir);
  });

  it("mantem o padrao novo so nas folhas que declara", () => {
    // O lancer nao pode ter virado padrao da ferramenta: `shoot:
    // false` so vale para ele, o sorcerer e o boneco de treino
    for (const nome of [
      "arbalist",
      "zumbi",
      "ogre",
      "warrior",
    ]) {
      expect(SHEETS[nome].shoot, nome).not.toBe(false);
    }

    expect(SHEETS.sorcerer.shoot).toBe(false);
    expect(SHEETS.boneco.shoot).toBe(false);
    expect(SHEETS.ghoul.shoot).toBe(false);
  });

  it("tem as 8 direcoes de caminhada e nenhuma de golpe", () => {
    const resultado = build();

    expect(ROWS).toHaveLength(8);
    expect(resultado.rows).toBe(9);

    expect(resultado.shootRow).toBe(null);
    expect(resultado.shootFrames).toBe(0);
    expect(resultado.substituidas).toEqual([]);
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
    // A ordem das linhas e o que o layout em `layout.js` le. A
    // caminhada ocupa de 0 a 7 e o idle vem logo depois. Se a ordem
    // mudar, o layout aponta o idle para a caminhada e o lancer
    // "respira" andando
    const resultado = build();

    expect(resultado.idleRow).toBe(8);
  });

  it("mede a ancora em vez de chutar", () => {
    // A ancora e o que amarra a celula ao personagem. A do lancer e
    // (33.5, 53), e nao a do sorcerer (33, 56): o pe dele fica mais
    // alto na celula, e copiar a ancora de outra classe o desloca em
    // relacao as outras em 3px
    const resultado = build();

    expect(resultado.anchorX).toBe(33.5);
    expect(resultado.anchorY).toBe(53);
  });

  it("nao repete a caminhada como se fosse golpe", () => {
    // Sem `shoot: false`, a ferramenta pararia num `shoot/east.gif`
    // faltando. Com ele, a folha nao pode DEPOIS colar a caminhada
    // no lugar de um golpe que nao existe
    const resultado = build();

    expect(resultado.substituidas).toHaveLength(0);
  });
});