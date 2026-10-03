import { describe, expect, it } from "vitest";
import {
  MISS_MAXIMO,
  MISS_MINIMO,
  chanceDeErrar,
  errouOGolpe,
} from "./Chance.js";

/**
 * A CHANCE de errar o golpe.
 *
 * A conta vive fora do `DamageSystem` para poder ser provada aqui sem
 * rezar para um `Math.random`. O que este arquivo segura e a FORMA da
 * conta — monotonicidade, limites e o tratamento de quem nao tem stat —
 * e nao o sorteio, que e uma comparacao.
 *
 * O risco real do arquivo e a esquerda chata: uma conta que quase nunca
 * da miss passa o teste que so verifica "pode dar miss", e o jogador
 * nunca ve a palavra MISS na tela.
 */

/** um alvo com a evasao em fracao, como o jogo usa */
const alvo = (evasion) => ({ evasion });

/** um atacante com a precisao em numero alto, como o jogo usa */
const atacante = (accuracy) => ({ accuracy });

describe("chanceDeErrar", () => {
  it("quem nao tem evasao nunca e escolhido para errar", () => {
    /**
     * O caso do boneco de madeira e de qualquer alvo sem stat.
     *
     * O piso de 1% existe para o mechanic ser visivel, mas se valesse
     * para todos, TODO alvo erraria 1% das vezes — inclusive os
     * bonecos de treino, que nao tem atributo nenhum. O piso nao pode
     * inventar esquiva onde nao ha
     */
    expect(chanceDeErrar(atacante(75), alvo(0))).toBe(0);
    expect(chanceDeErrar(atacante(75), alvo(null))).toBe(0);
    expect(chanceDeErrar(atacante(75), {})).toBe(0);
    expect(chanceDeErrar(atacante(75), null)).toBe(0);
  });

  it("quem nao tem precisao nao reduz a chance", () => {
    // e o caso do mob: nenhuma criatura tem `accuracy`
    const semPrecisao = chanceDeErrar({}, alvo(0.05));

    expect(semPrecisao).toBeCloseTo(0.05, 10);
  });

  it("mais precisao significa MENOS chance de errar", () => {
    const fraco = chanceDeErrar(atacante(10), alvo(0.08));
    const medio = chanceDeErrar(atacante(75), alvo(0.08));
    const forte = chanceDeErrar(atacante(300), alvo(0.08));

    expect(fraco).toBeGreaterThan(medio);
    expect(medio).toBeGreaterThan(forte);
  });

  it("a precisao nunca zera a chance por completo", () => {
    /**
     * Precisao altissima ainda deixa passar um pouco.
     *
     * Com `accuracy` de mil, `1000 / (1000 + 150)` da 0.87, e sobra
     * 13% da evasiva. Zerar aqui transformaria qualquer investimento
     * em precisao em imunidade total, e o stat viraria so um numero
     * de tela
     */
    const chance = chanceDeErrar(atacante(1000), alvo(0.5));

    expect(chance).toBeGreaterThan(0);
    expect(chance).toBeLessThan(0.5);
  });

  it("mais evasao significa mais chance de errar", () => {
    expect(chanceDeErrar(atacante(75), alvo(0.1))).toBeGreaterThan(
      chanceDeErrar(atacante(75), alvo(0.02)),
    );
  });

  it("o piso garante que o mechanic aparece", () => {
    // um evasion de meio ponto, que ninguem tem de verdade
    const chance = chanceDeErrar(atacante(400), alvo(0.005));

    expect(chance).toBe(MISS_MINIMO);
  });

  it("o teto segura o alvo longe de ser imbativel", () => {
    const chance = chanceDeErrar({}, alvo(0.99));

    expect(chance).toBe(MISS_MAXIMO);
  });

  it("a evasion e fracao e a precisao e numero, e a conta entende", () => {
    /**
     * A confusao de unidade que a conta tem de evitar.
     *
     * `evasion` vem como 0.055 (5,5%) e `accuracy` como 75. Se a conta
     * misturasse as duas, `0.055 - 75` daria negativo e a chance
     * viraria o piso para todo mundo
     */
    const chance = chanceDeErrar(atacante(75), alvo(0.055));

    // 0.055 * (1 - 75/225) = 0.055 * 0.667 = ~3.7%
    expect(chance).toBeGreaterThan(0.03);
    expect(chance).toBeLessThan(0.04);
  });

  it("valores absurdos nao quebram a conta", () => {
    expect(chanceDeErrar(atacante(-50), alvo(0.05))).toBeGreaterThan(0);
    expect(chanceDeErrar(atacante(75), alvo(-1))).toBe(0);
    expect(chanceDeErrar(atacante(NaN), alvo(0.05))).toBeCloseTo(0.05, 10);
  });
});

describe("errouOGolpe", () => {
  it("sorteio abaixo da chance faz o golpe passar", () => {
    // 10% de chance, e o sorteio caiu em 5%
    expect(errouOGolpe(atacante(75), alvo(0.1), () => 0.05)).toBe(true);
  });

  it("sorteio acima da chance faz o golpe acertar", () => {
    expect(errouOGolpe(atacante(75), alvo(0.1), () => 0.5)).toBe(false);
  });

  it("quem nao tem evasao nunca sorteia", () => {
    /**
     * O sorteio nem acontece.
     *
     * Chamar `random()` para um alvo sem evasiao seria gastar um
     * numero do gerador sem necessidade, e pior: o `random` injetado
     * nos testes conta as chamadas. Um alvo sem evasiao tem de gastar
     * zero
     */
    let sorteios = 0;

    errouOGolpe(atacante(75), alvo(0), () => {
      sorteios += 1;
      return 0;
    });

    expect(sorteios, "sorteou para um alvo sem esquiva").toBe(0);
  });

  it("o `Math.random` real cabe na conta", () => {
    // so prova que a chamada padrao nao estoura
    expect(() => errouOGolpe(atacante(75), alvo(0.05))).not.toThrow();
  });
});
