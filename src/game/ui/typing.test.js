import { describe, expect, it } from "vitest";
import { digitandoEm } from "./typing.js";

/**
 * A PERGUNTA "o jogo esta digitando?".
 *
 * Este e o unico lugar do jogo que decide se uma tecla e digitacao ou
 * ordem. Os dois `keydown` — o da HUD e o do canvas — dependem dele, e
 * cada um sozinho deixaria a tecla passar
 *
 * O teste monta os alvos como objetos COMO o DOM os descreveria, e nao
 * com `document.createElement`. A funcao e pura sobre o `target`: se o
 * teste precisasse de um DOM real para responde "true", a funcao
 * estaria lendo alguma coisa do navegador que nao precisa ler
 *
 * O que este arquivo segura e a FRONTEIRA, porque errar para o lado
 * errado tem dois sintomas bem diferentes:
 *
 * - `false` onde devia ser `true`: o painel abre por cima do campo, e o
 *   personagem anda enquanto o jogador escreve
 * - `true` onde devia ser `false`: o auto e as skills morrem sozinhos,
 *   e o jogador nao acha o motivo — nao ha nada na tela que diga que ele
 *   esta "digitando"
 */

/** um alvo como o DOM o descreveria */
const alvo = (tagName, type = null, extra = {}) => ({
  tagName,
  type,
  ...extra,
});

/** um evento de teclado vindo do elemento, como o navegador faz */
const teclaEm = (alvo) => ({ target: alvo });

describe("digitandoEm", () => {
  it("um input de texto e digitacao", () => {
    expect(digitandoEm(teclaEm(alvo("INPUT", "text")))).toBe(true);
  });

  it("um input sem type e digitacao, porque o padrao e texto", () => {
    // e o `<input>` sem atributo, que o navegador le como `text`
    expect(digitandoEm(teclaEm(alvo("INPUT")))).toBe(true);
  });

  it("um textarea e digitacao", () => {
    expect(digitandoEm(teclaEm(alvo("TEXTAREA")))).toBe(true);
  });

  it("um select e digitacao", () => {
    expect(digitandoEm(teclaEm(alvo("SELECT")))).toBe(true);
  });

  /**
   * O `contentEditable` e o outro jeito de um elemento receber texto.
   *
   * Nao ha nenhum no jogo hoje, mas a pergunta e sobre o DOM e nao
   * sobre o que existe agora: um `contentEditable` engoliria todas as
   * teclas do mesmo jeito que um campo
   */
  it("um elemento editavel e digitacao", () => {
    expect(
      digitandoEm(teclaEm(alvo("DIV", null, { isContentEditable: true }))),
    ).toBe(true);
  });

  it("o target sem tag e a propria janela, e nao e digitacao", () => {
    // e o caso do jogo com o foco fora de qualquer campo: um `keydown`
    // disparado na janela tem `target` sem `tagName`
    expect(digitandoEm(teclaEm({}))).toBe(false);
  });

  it("um evento sem alvo nao e digitacao", () => {
    expect(digitandoEm({})).toBe(false);
    expect(digitandoEm(null)).toBe(false);
    expect(digitandoEm(undefined)).toBe(false);
  });

  it("um botao nao e digitacao", () => {
    expect(digitandoEm(teclaEm(alvo("BUTTON")))).toBe(false);
  });

  it("um div nao e digitacao", () => {
    expect(digitandoEm(teclaEm(alvo("DIV")))).toBe(false);
  });

  /**
   * Checkbox e radio NAO recebem texto.
   *
   * Se voltassem para a lista de digitacao, marcar o "ataque
   * automatico" mataria o auto e as skills ate o jogador clicar fora —
   * sem nada na tela que explicasse. Um checkbox nao e digitacao, e o
   * jogo tem varios
   */
  it("um checkbox nao e digitacao", () => {
    expect(digitandoEm(teclaEm(alvo("INPUT", "checkbox")))).toBe(false);
  });

  it("um radio nao e digitacao", () => {
    expect(digitandoEm(teclaEm(alvo("INPUT", "radio")))).toBe(false);
  });

  it("um botao de input nao e digitacao", () => {
    expect(digitandoEm(teclaEm(alvo("INPUT", "button")))).toBe(false);
  });

  it("um input numerico ainda e digitacao", () => {
    expect(digitandoEm(teclaEm(alvo("INPUT", "number")))).toBe(true);
  });

  it("um campo de busca e digitacao", () => {
    expect(digitandoEm(teclaEm(alvo("INPUT", "search")))).toBe(true);
  });

  it("o type em maiusculo nao engana a checagem", () => {
    // o DOM ja entrega `type` em minusculo, mas o atributo lido pode
    // vir maiusculo, e a lista e comparada depois do `toLowerCase`
    expect(digitandoEm(teclaEm(alvo("INPUT", "TEXT")))).toBe(true);
    expect(digitandoEm(teclaEm(alvo("INPUT", "CHECKBOX")))).toBe(false);
  });
});
