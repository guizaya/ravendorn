import { describe, expect, it } from "vitest";
import {
  NAME_MAX,
  fallbackName,
  nameKey,
  sanitizeNameInput,
  validateName,
} from "./characterName.js";

describe("sanitizeNameInput", () => {
  it("corta o que nao serve para um nome", () => {
    expect(sanitizeNameInput("Zoe<script>")).toBe("Zoescript");
    expect(sanitizeNameInput("a@b#c")).toBe("abc");
  });

  it("tira acento em vez de recusar", () => {
    // acento recusado faria o jogador achar que o nome foi salvo
    // errado. melhor normalizar e avisar que o que vale e o normal
    expect(sanitizeNameInput("Zoë das Flechas")).toBe(
      "Zoe das Flechas",
    );
    expect(sanitizeNameInput("João")).toBe("Joao");
  });

  it("junta espaco e hifen repetidos", () => {
    expect(sanitizeNameInput("Ana  Maria")).toBe(
      "Ana Maria",
    );
    expect(sanitizeNameInput("a--b")).toBe("a-b");
  });

  it("limita o tamanho", () => {
    const longo = "x".repeat(NAME_MAX + 40);

    expect(sanitizeNameInput(longo)).toHaveLength(
      NAME_MAX,
    );
  });
});

describe("validateName", () => {
  it("aceita um nome normal", () => {
    const result = validateName("Ana Maria");

    expect(result.ok).toBe(true);
    expect(result.value).toBe("Ana Maria");
    expect(result.reason).toBe(null);
  });

  it("recusa nome vazio", () => {
    expect(validateName("   ").ok).toBe(false);
    expect(validateName(null).ok).toBe(false);
    expect(validateName(undefined).ok).toBe(false);
  });

  it("recusa nome curto demais", () => {
    // "Ana" tem exatamente NAME_MIN e passa: o limite e o minimo
    // aceito, nao o maximo
    expect(validateName("Ana").ok).toBe(true);

    const result = validateName("Al");

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("3");
  });

  it("recusa pontuacao nas pontas", () => {
    // "Ana-" ou "-Ana" ficariam com pontuacao solta na HUD
    expect(validateName("-Ana").ok).toBe(false);
    expect(validateName("Ana-").ok).toBe(false);
  });

  it("aceita espaco e hifen no meio", () => {
    expect(validateName("Ana Maria").ok).toBe(true);
    expect(validateName("Ana-Marina").ok).toBe(true);
  });

  it("recusa nomes reservados ignorando caixa e espaco", () => {
    // sem o fold, "SISTEMA" passaria e o jogador viraria o
    // proprio sistema na lista de jogadores
    for (const nome of [
      "Sistema",
      "SISTEMA",
      "  sistema  ",
      "Ad min",
      "ADMIN",
      "Game Master",
    ]) {
      const result = validateName(nome);

      expect(result.ok, nome).toBe(false);
      expect(result.reason, nome).toContain(
        "reservado",
      );
    }
  });

  it("recusa o mesmo reservado escrito com acento", () => {
    expect(validateName("Sistéma").ok).toBe(false);
  });

  it("aceita nome parecido com reservado", () => {
    // "Sistematico" nao e o sistema: barrar isso seria absurdo
    expect(validateName("Sistematico").ok).toBe(true);
    expect(validateName("Jogadora").ok).toBe(true);
  });

  it("devolve o valor ja limpo no erro", () => {
    // a tela usa o valor para mostrar o que foi digitado de
    // verdade, senao o campo piscaria a cada tecla
    const result = validateName("Ana<script>!");

    expect(result.value).toBe("Anascript");
  });
});

describe("nameKey", () => {
  it("ignora caixa, espaco, hifen e acento", () => {
    const esperado = "anamariasilva";

    for (const nome of [
      "Ana Maria Silva",
      "ana-maria-silva",
      "ANAMARIASILVA",
      "Ana Maria Silva",
    ]) {
      expect(nameKey(nome), nome).toBe(esperado);
    }
  });
});

describe("fallbackName", () => {
  it("cabe no limite de tamanho", () => {
    // nao precisa preencher tudo: so nao pode estourar
    // um id de verdade e um que nao existe: `fallbackName` nao
    // conhece a lista de classes, e um id de classe apagada ainda
    // precisa caber no limite
    for (const classe of [
      "warrior",
      "arbalist",
      "summoner",
      "a",
      "x".repeat(40),
    ]) {
      expect(
        fallbackName(classe).length,
        classe,
      ).toBeLessThanOrEqual(NAME_MAX);
    }
  });

  it("e um nome valido", () => {
    expect(validateName(fallbackName("arbalist")).ok).toBe(
      true,
    );
  });
});
