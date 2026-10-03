import { describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
} from "@testing-library/react";
import { useState } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import CharacterSelectScene from "./CharacterSelectScene.jsx";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { NAME_MAX } from "../../data/characterName.js";
import { ARBALIST_SPRITE, getClassSprite } from "../../data/sprites/index.js";
import { isDirectionalFormat } from "../../game/sprites/animation.js";

/**
 * As classes que tem arte ANIMADA, lido dos dados.
 *
 * A lista nao e escrita aqui. Ela vem de `isDirectionalFormat` do
 * sprite de cada classe, que e o mesmo fato que decide se o retrato
 * desenha o canvas ou o glifo — e a lista fixa que vivia neste
 * arquivo quebrou quando o guerreiro ganhou arte: ele passou a ter
 * idle de verdade e o teste continuou afirmar o contrario
 *
 * Ler dos dados tambem deixa o teste valer para a proxima classe que
 * for convertida, sem ninguem precisar lembrar deste arquivo
 */
const COM_ARTE = CHARACTER_CLASSES.filter((classe) =>
  isDirectionalFormat(getClassSprite(classe.id)),
).map((classe) => classe.id);

const SEM_ARTE = CHARACTER_CLASSES.filter(
  (classe) => !COM_ARTE.includes(classe.id),
).map((classe) => classe.id);

/**
 * O CSS da tela de selecao, lido do disco.
 *
 * A forma do cartao e CSS, e o teste precisa ver o CSS: assertar
 * sobre o HTML nao alcança `grid-template-columns` nem `aspect-ratio`.
 * E o `styles.test.js` nao cobre a tela de selecao, entao este e o
 * lugar onde a largura do cartao fica presa
 *
 * O caminho sai de `__dirname` e nao de `import.meta.url`: sob o
 * Vitest o `import.meta.url` do teste vem como `http://`, e o
 * `fileURLToPath` recusa com "The URL must be of scheme file"
 */
const CSS = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "styles.css",
  ),
  "utf8",
);

const primeiraClasse = CHARACTER_CLASSES[0];

const montar = (props = {}) =>
  render(
    <CharacterSelectScene
      selectedClass={primeiraClasse}
      onSelectClass={() => {}}
      onPlay={() => {}}
      characterName=""
      onNameChange={() => {}}
      {...props}
    />,
  );

const campo = (container) =>
  container.querySelector(".name-field__input");

const botaoJogar = (container) =>
  container.querySelector(".play-button");

describe("CharacterSelectScene o retrato de cada classe", () => {
  const arbalist = CHARACTER_CLASSES.find(
    (c) => c.id === "arbalist",
  );

  it("o cartao e um quadrado, com o teto de largura", () => {
    // A grade era `repeat(8, minmax(140px, 1fr))` com QUATRO classes:
    // oito colunas para quatro cartoes deixavam metade da linha vazia,
    // e o `1fr` esticava os quatro primeiros pela largura toda da
    // janela. O `auto-fit` com teto de 150px descarta as colunas
    // vazias e recentra os cartoes
    const grade = CSS.match(/\.class-grid\s*\{([^}]*)\}/);

    const colunas =
      grade[1].match(/grid-template-columns:\s*([^;]+)/)[1];

    // `auto-fit`, e nao um numero fixo: o numero de colunas tem de
    // acompanhar o numero de classes sem redeclarar a cada classe
    // que entra ou sai
    expect(colunas).toMatch(/auto-fit/);

    // o TETO e o que impede o cartao de esticar com a janela
    expect(colunas).toMatch(/150px/);
    expect(grade[1]).toMatch(/justify-content:\s*center/);
  });

  it("o quadrado da arte preenche a largura do cartao", () => {
    // O retrato tem `aspect-ratio: 1` e o canvas e `inset: 0`, entao
    // a arte ocupa o quadrado inteiro. O que nao pode e a arte
    // encolher dentro dele
    const retrato = CSS.match(/\.class-portrait\s*\{([^}]*)\}/);

    expect(retrato[1]).toMatch(/aspect-ratio:\s*1/);

    const sprite = CSS.match(/\.class-sprite\s*\{([^}]*)\}/);

    expect(sprite[1]).toMatch(/inset:\s*0/);
    expect(sprite[1]).toMatch(/width:\s*100%/);
    expect(sprite[1]).toMatch(/height:\s*100%/);
  });

  it("o nome fica abaixo do quadrado, e nao dentro do botao", () => {
    // O botao e o QUADRADO, e so tem arte dentro. O nome e a legenda
    // da celula, depois do botao: nao caberia num quadrado, e ele ja
    // aparecia duas vezes na tela — no `<h2>` dos detalhes e no
    // rotulo do botao
    const { container } = montar({
      selectedClass: arbalist,
    });

    const celula = [
      ...container.querySelectorAll(".class-card-cell"),
    ].find((c) => c.textContent.includes("Arbalist"));

    expect(celula, "a celula do arquiro sumiu").toBeTruthy();

    const filhos = [...celula.children];

    const doBotao = filhos.findIndex(
      (f) => f.tagName === "BUTTON",
    );

    const doNome = filhos.findIndex((f) =>
      f.classList.contains("class-card__label"),
    );

    // o nome vem DEPOIS do botao
    expect(doBotao).toBe(0);
    expect(doNome).toBe(doBotao + 1);

    // e o botao tem so a arte dentro
    const botao = filhos[doBotao];

    expect(botao.querySelector(".class-portrait")).not.toBe(
      null,
    );
    expect(botao.querySelector(".class-card__label")).toBe(null);
  });

  it("o botao tem o nome no aria-label, para quem nao ve a arte", () => {
    // Sem o `aria-label` o botao so teria a arte desenhada dentro, e
    // o leitor de tela anunciaria um botao sem nome
    const { container } = montar({
      selectedClass: arbalist,
    });

    const botoes = [
      ...container.querySelectorAll(".class-card"),
    ];

    const rotulos = botoes.map((b) =>
      b.getAttribute("aria-label"),
    );

    expect(rotulos).toEqual(
      CHARACTER_CLASSES.map((c) => c.name),
    );

    // e o estado de selecao tambem e anunciado
    for (const botao of botoes) {
      expect(
        botao.hasAttribute("aria-pressed"),
      ).toBe(true);
    }
  });

  it("o botao e um quadrado, e sem texto dentro", () => {
    // `aspect-ratio: 1` e o que faz o quadrado, e `padding: 0` e o
    // que impede o texto de empurrar a borda para fora
    const cartao = CSS.match(/\.class-card\s*\{([^}]*)\}/);

    expect(cartao[1]).toMatch(/aspect-ratio:\s*1/);
    expect(cartao[1]).toMatch(/padding:\s*0/);
    expect(cartao[1]).toMatch(/width:\s*100%/);

    // O botao do ARBALIST, que tem arte, e um botao mudo: sem glifo,
    // sem halo e sem nome. O nome esta na legenda da celula
    const { container } = montar({
      selectedClass: arbalist,
    });

    const botao = [
      ...container.querySelectorAll(".class-card"),
    ].find(
      (b) => b.getAttribute("aria-label") === "Arbalist",
    );

    const comArte = botao.querySelector(".class-portrait--art");

    expect(comArte, "o botao do arquiro deveria ter arte").not.toBe(
      null,
    );

    expect(comArte.textContent.trim()).toBe("");
  });

  it("a arte preenche o quadrado pelo desenho, e nao pela celula", () => {
    // A celula do arquiro e 64x64 e o personagem ocupa 30x44 dela.
    // Centralizar a celula inteira centraliza a MARGEM transparente:
    // a arte sai pequena, com vao de cada lado, e um pouco alta. O
    // `contentBox` medido do PNG e o que preenche o quadrado
    expect(ARBALIST_SPRITE.contentBox).toEqual({
      x: 17,
      y: 7,
      width: 30,
      height: 45,
    });

    // a caixa tem de estar DENTRO da celula, senao o recorte corta o
    // personagem ou pega a margem transparente
    const { contentBox, frameWidth, frameHeight } =
      ARBALIST_SPRITE;

    expect(contentBox.x).toBeGreaterThanOrEqual(0);
    expect(contentBox.y).toBeGreaterThanOrEqual(0);
    expect(
      contentBox.x + contentBox.width,
    ).toBeLessThanOrEqual(frameWidth);
    expect(
      contentBox.y + contentBox.height,
    ).toBeLessThanOrEqual(frameHeight);

    // e ela e MENOR que a celula: se cobrisse tudo, o recorte nao
    // estaria fazendo nada
    expect(contentBox.width).toBeLessThan(frameWidth);
    expect(contentBox.height).toBeLessThan(frameHeight);
  });

  it("a arte entra nos DOIS lugares: botao e retrato grande", () => {
    // A arte e nos dois. O botao da lista e o lugar onde o jogador
    // ESCOLHE a classe, e era nele que o emoji do arquiro aparecia
    const { container } = montar({
      selectedClass: arbalist,
    });

    // o botao do arquiro e o unico com `aria-label` de Arbalist
    const botao = [
      ...container.querySelectorAll(".class-card"),
    ].find(
      (b) => b.getAttribute("aria-label") === "Arbalist",
    );

    expect(botao, "o botao do arquiro sumiu").toBeTruthy();

    expect(
      botao.querySelector(".class-portrait__sprite"),
      "o botao do arquiro nao tem arte animada",
    ).not.toBe(null);

    // e o retrato grande tambem
    expect(
      container
        .querySelector(".class-portrait--large")
        .querySelector(".class-portrait__sprite"),
    ).not.toBe(null);
  });

  it("a arte substitui glifo, halo e nome nos dois lugares", () => {
    // Com o desenho no retrato, o glifo ia por cima do personagem, o
    // halo virava um circulo da cor da classe em volta dele — no
    // arquiro, verde — e o nome ficava por cima da arte. O nome ja
    // esta na legenda da celula e no `<h2>` dos detalhes
    const { container } = montar({
      selectedClass: arbalist,
    });

    for (const retrato of [
      ...container.querySelectorAll(".class-portrait--art"),
    ]) {
      expect(
        retrato.querySelector(".class-portrait__icon"),
        "o glifo continua no retrato com arte",
      ).toBe(null);

      expect(
        retrato.querySelector(".class-portrait__aura"),
        "o halo continua no retrato com arte",
      ).toBe(null);

      expect(
        retrato.querySelector(".class-portrait__name"),
        "o nome continua por cima da arte",
      ).toBe(null);
    }

    // Todo retrato com arte tem de ter passado pelo laço acima: um
    // `.class-portrait--art` que sobrasse fora dele nao estaria
    // coberto pela checagem
    //
    // A contagem vem dos dados. Com o arquiro selecionado, sao os
    // cartoes de todas as classes com arte mais o retrato grande dele
    const comArte = container.querySelectorAll(
      ".class-portrait--art",
    ).length;

    expect(comArte).toBe(COM_ARTE.length + 1);

    // e o retrato selecionado esta entre eles
    expect(
      container.querySelector(".class-portrait--large")
        .classList.contains("class-portrait--art"),
    ).toBe(true);
  });

  it("toda classe jogavel tem arte animada, e nenhuma fica no glifo", () => {
    // Com o `lancer` convertido, as QUATRO classes jogaveis tem
    // folha direcional: nao sobrou nenhuma no glifo. A lista vem dos
    // dados, entao este e o teste que trava o fato — se uma classe
    // voltar a `createSpriteDefinition` (a folha antiga de 3 linhas,
    // com um quadro so de idle), ela reaparece em `SEM_ARTE` e este
    // teste avisa
    expect(SEM_ARTE, "classe sem arte animada").toEqual([]);
    expect(COM_ARTE.length).toBe(CHARACTER_CLASSES.length);

    const { container } = montar();

    expect(
      container.querySelectorAll(".class-portrait__icon").length,
      "glifo com todas as classes tendo arte",
    ).toBe(0);

    expect(
      container.querySelectorAll(".class-portrait__aura").length,
      "halo sem glifo atras",
    ).toBe(0);

    // um canvas por classe com arte na lista, mais o da selecionada
    const selecionadaTemArte = COM_ARTE.includes(primeiraClasse.id);

    expect(selecionadaTemArte).toBe(true);

    expect(
      container.querySelectorAll(".class-portrait__sprite").length,
    ).toBe(COM_ARTE.length + 1);
  });

  it("o glifo continua sendo o reserva de uma classe sem folha", () => {
    // O ramo do glifo existe para a proxima classe que chegar sem
    // arte, e com as quatro convertidas ele nao e exercitado por
    // nenhum dado real: renderizar um id que o registro de sprites nao
    // conhece e a unica forma de ele continuar testado
    const semFolha = {
      ...primeiraClasse,
      id: "classe_sem_folha",
      name: "Sem Folha",
      icon: "@@",
    };

    const { container } = montar({ selectedClass: semFolha });

    // o glifo, com halo e nome, no retrato grande da selecionada
    expect(
      container.querySelectorAll(".class-portrait__icon").length,
    ).toBe(1);

    expect(
      container.querySelectorAll(".class-portrait__aura").length,
    ).toBe(1);

    // e nenhum canvas para ela: sem folha gerada nao ha o que animar
    const retratosComSprite = [
      ...container.querySelectorAll(".class-portrait--art"),
    ].filter((retrato) =>
      retrato.querySelector(".class-portrait__sprite"),
    );

    // as classes da LISTA continuam com arte; so a selecionada, que
    // nao tem folha, cai no glifo
    expect(retratosComSprite.length).toBe(COM_ARTE.length);

    expect(
      container.querySelector(".class-portrait--large")
        .classList.contains("class-portrait--art"),
    ).toBe(false);
  });

  it("o nome do arquiro sai do botao mas fica na legenda", () => {
    // o nome nao foi apagado da tela: ele e a legenda da celula, e o
    // `aria-label` do botao. O que saiu do botao e do retrato foi o
    // nome POR CIMA da arte
    const { container } = montar({
      selectedClass: arbalist,
    });

    const celula = [
      ...container.querySelectorAll(".class-card-cell"),
    ].find((c) => c.textContent.includes("Arbalist"));

    // a legenda, visivel
    expect(
      celula.querySelector(".class-card__label").textContent,
    ).toBe("Arbalist");

    // e o nome nao esta no retrato
    expect(
      celula
        .querySelector(".class-portrait")
        .textContent.trim(),
    ).toBe("");
  });

  it("a arte do arquiro nao repete o nome dentro do retrato", () => {
    // O retrato grande tem o nome no `<h2>` dos detalhes. Se o
    // nome aparecesse tambem dentro do retrato, o arquiro teria o
    // nome escrito tres vezes na tela
    const { container } = montar({
      selectedClass: arbalist,
    });

    const grande = container.querySelector(
      ".class-detail__visual",
    );

    expect(
      grande.textContent.trim(),
      "o nome sobrou dentro do retrato",
    ).toBe("");
  });

  it("so as classes com arte animada mostram a arte no retrato grande", () => {
    // Quem tem arte animada e quem o sprite e uma folha direcional de
    // 8 direcoes, com idle de varios quadros. Quem nao tem folha gerada
    // fica no glifo, porque um laco de um quadro so nao se move. A
    // lista vem dos dados, entao este teste cobre qualquer classe
    // futura sem precisar de um caso escrito aqui
    for (const classe of CHARACTER_CLASSES) {
      const { container } = montar({
        selectedClass: classe,
      });

      const grande = container.querySelector(
        ".class-portrait--large",
      );

      const temSprite =
        grande.querySelector(".class-portrait__sprite") !==
        null;

      expect(
        temSprite,
        `${classe.id} com arte animada indevidamente`,
      ).toBe(COM_ARTE.includes(classe.id));
    }
  });

  it("trocar a classe selecionada troca a arte do retrato grande", () => {
    // O retrato grande acompanha a selecao. Se ele ficasse preso na
    // primeira classe, escolher o arquiro mostraria a arte errada ao
    // lado dos botoes
    //
    // As duas pontas do teste sao uma classe SEM folha e uma COM folha:
    // o que se prova e que o retrato troca, e nao que uma classe
    // especifica tem ou nao arte — isso e do teste anterior
    //
    // A ponta sem folha e um id que o registro de sprites nao conhece,
    // e nao uma classe da lista: com as quatro jogaveis convertidas,
    // nenhuma classe real sobra sem arte, e um `find` por `SEM_ARTE`
    // devolveria `undefined` com o retrato grande em `null`
    const semArte = {
      ...primeiraClasse,
      id: "classe_sem_folha",
      name: "Sem Folha",
      icon: "@@",
    };

    const { container } = montar({
      selectedClass: semArte,
    });

    expect(
      container
        .querySelector(".class-portrait--large")
        .querySelector(".class-portrait__sprite"),
      `${semArte.id} devia ficar no glifo`,
    ).toBe(null);

    const { container: outro } = montar({
      selectedClass: arbalist,
    });

    expect(
      outro
        .querySelector(".class-portrait--large")
        .querySelector(".class-portrait__sprite"),
      "o arquiro devia ter arte",
    ).not.toBe(null);
  });

  it("o canvas e decorativo, e nao lido duas vezes", () => {
    const { container } = montar({
      selectedClass: arbalist,
    });

    const sprite = container.querySelector(
      ".class-portrait__sprite",
    );

    // o nome da classe ja esta no rotulo do retrato. Um canvas com
    // `aria-label` faria o leitor de tela anunciar a arte e o nome
    // juntos
    expect(sprite.getAttribute("aria-hidden")).toBe("true");
    expect(sprite.getAttribute("aria-label")).toBe(null);
  });
});

describe("CharacterSelectScene nome do personagem", () => {
  it("tem um campo de nome na tela", () => {
    const { container } = montar();

    expect(campo(container)).not.toBe(null);
    expect(
      container.querySelector(".name-field__label")
        .textContent,
    ).toContain("NOME DO PERSONAGEM");
  });

  it("o campo e rotulado de verdade, nao so placeholder", () => {
    const { container } = montar();

    // sem o par label/for, clicar no rotulo nao foca o campo e o
    // leitor de tela nao anuncia o que e
    const input = campo(container);
    const label = container.querySelector(
      `label[for="${input.getAttribute("id")}"]`,
    );

    expect(label).not.toBe(null);
  });

  it("bloqueia o JOGAR sem nome", () => {
    const { container } = montar({ characterName: "" });

    expect(
      botaoJogar(container).className,
    ).toContain("is-blocked");
    expect(
      botaoJogar(container).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("libera o JOGAR com nome valido", () => {
    const { container } = montar({
      characterName: "Ana Maria",
    });

    expect(
      botaoJogar(container).className,
    ).not.toContain("is-blocked");
    expect(
      botaoJogar(container).getAttribute("aria-disabled"),
    ).toBe("false");
  });

  it("nao chama onPlay com nome vazio", () => {
    const onPlay = vi.fn();
    const { container } = montar({
      onPlay,
      characterName: "",
    });

    fireEvent.click(botaoJogar(container));

    expect(onPlay).not.toHaveBeenCalled();
  });

  it("mostra o erro so depois da primeira tentativa", () => {
    const onPlay = vi.fn();
    const { container } = montar({
      onPlay,
      characterName: "",
    });

    // reclamar do campo vazio antes de o jogador tentar faria
    // a tela de selecao parecer quebrada
    expect(
      container.querySelector(".name-field__help")
        .textContent,
    ).toContain("De 3 a");

    fireEvent.click(botaoJogar(container));

    expect(
      container.querySelector(".name-field__help.is-invalid")
        .textContent,
    ).toContain("Escreva um nome");
  });

  it("chama onPlay com o nome limpo", () => {
    const onPlay = vi.fn();
    const { container } = montar({
      onPlay,
      characterName: "Ana Maria",
    });

    fireEvent.click(botaoJogar(container));

    expect(onPlay).toHaveBeenCalledWith({
      name: "Ana Maria",
    });
  });

  it("repassa o que foi digitado, ja sem caractere invalido", () => {
    const onNameChange = vi.fn();
    const { container } = montar({ onNameChange });

    fireEvent.change(campo(container), {
      target: { value: "Ana<script>!" },
    });

    // quem faz a limpeza e o modulo compartilhado com o
    // servidor, nao a tela
    expect(onNameChange).toHaveBeenCalledWith("Anascript");
  });

  it("recusa nome reservado e explica", () => {
    const onPlay = vi.fn();
    const { container } = montar({
      onPlay,
      characterName: "Sistema",
    });

    fireEvent.click(botaoJogar(container));

    expect(onPlay).not.toHaveBeenCalled();
    expect(
      container.querySelector(".name-field__help.is-invalid")
        .textContent,
    ).toContain("reservado");
  });

  it("o campo nao aceita mais que o limite", () => {
    const { container } = montar();

    expect(
      campo(container).getAttribute("maxlength"),
    ).toBe(String(NAME_MAX));
  });

  it("marca o campo como invalido para leitor de tela", () => {
    const onPlay = vi.fn();
    const { container } = montar({
      onPlay,
      characterName: "Si",
    });

    fireEvent.click(botaoJogar(container));

    expect(
      campo(container).getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("o erro some quando o nome fica valido", () => {
    const onPlay = vi.fn();

    function Tela() {
      const [nome, setNome] = useState("Si");

      return (
        <CharacterSelectScene
          selectedClass={primeiraClasse}
          onSelectClass={() => {}}
          onPlay={onPlay}
          characterName={nome}
          onNameChange={setNome}
        />
      );
    }

    const { container } = render(<Tela />);

    fireEvent.click(botaoJogar(container));

    expect(
      container.querySelector(".name-field__help.is-invalid"),
    ).not.toBe(null);

    fireEvent.change(campo(container), {
      target: { value: "Silvia" },
    });

    expect(
      container.querySelector(".name-field__help.is-invalid"),
    ).toBe(null);
  });
});
