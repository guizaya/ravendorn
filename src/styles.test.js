import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/styles.css", "utf8");

const SCROLLABLE = [
  ".qst-panel__body",
  ".inv-main",
  ".bst-panel__body",
  ".col-panel__body",
];
const MODALS = [
  ".qst-panel",
  ".inv-panel",
  ".bst-panel",
  ".col-panel",
];

function declarationsFor(selector) {
  const escaped = selector.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const pattern = new RegExp(
    `${escaped}\\s*\\{([^}]*)\\}`,
    "g",
  );

  return [...CSS.matchAll(pattern)]
    .map((match) => match[1])
    .join("\n");
}

describe("hud pointer events", () => {
  it("keeps the overlay transparent by default", () => {
    expect(CSS).toMatch(
      /\.hud\s*\{[^}]*pointer-events:\s*none/,
    );
  });

  it("re-enables pointer events on buttons", () => {
    expect(CSS).toMatch(
      /\.hud button\s*\{[^}]*pointer-events:\s*auto/,
    );
  });
});

describe("scrollable panels", () => {
  it("re-enables pointer events on every scrollable region", () => {
    for (const selector of SCROLLABLE) {
      expect(
        declarationsFor(selector),
        `${selector} precisa de pointer-events: auto para rolar`,
      ).toMatch(/pointer-events:\s*auto/);
    }
  });

  it("declares overflow on every scrollable region", () => {
    for (const selector of SCROLLABLE) {
      expect(
        declarationsFor(selector),
        selector,
      ).toMatch(/overflow-y:\s*auto/);
    }
  });

  it("flexes the body so the panel does not grow past the viewport", () => {
    for (const selector of SCROLLABLE) {
      const body = declarationsFor(selector);

      expect(body, selector).toMatch(/flex:\s*1/);
      expect(body, selector).toMatch(/min-height:\s*0/);
    }
  });

  it("constrains the modal height and clips overflow", () => {
    for (const selector of MODALS) {
      const body = declarationsFor(selector);

      expect(body, selector).toMatch(/max-height:/);
      expect(body, selector).toMatch(/overflow:\s*hidden/);
    }
  });

  it("re-enables pointer events on every modal", () => {
    for (const selector of MODALS) {
      expect(
        declarationsFor(selector),
        `${selector} precisa de pointer-events: auto`,
      ).toMatch(/pointer-events:\s*auto/);
    }
  });

  it("keeps panels above the overlay", () => {
    for (const selector of MODALS) {
      expect(
        declarationsFor(selector),
        selector,
      ).toMatch(/z-index:\s*30/);
    }
  });
});

describe("inventory hover label", () => {
  it("ancora o rotulo dentro do container de scroll", () => {
    const name = declarationsFor(".inv-cell__name");

    expect(name).toMatch(/position:\s*absolute/);
    expect(name).toMatch(/white-space:\s*nowrap/);
    expect(name).toMatch(/pointer-events:\s*none/);
  });

  it("inverte a primeira linha para baixo para nao ser recortado", () => {
    // o `5` e o numero de COLUNAS da grade, e tem de bater com o
    // `repeat(5, ...)` da grade. A grade tinha 7 colunas com o slot de
    // 52px e passou a ter 5 com o slot de 68px
    expect(CSS).toMatch(
      /\.inv-grid\s*>\s*\.inv-cell:nth-child\(-n\+5\)\s+\.inv-cell__name\s*\{[^}]*top:\s*calc\(100%/,
    );

    // abrir para baixo so funciona se o bottom for limpo
    expect(CSS).toMatch(
      /\.inv-grid\s*>\s*\.inv-cell:nth-child\(-n\+5\)\s+\.inv-cell__name\s*\{[^}]*bottom:\s*auto/,
    );
  });

  it("prende o rotulo nas colunas das pontas", () => {
    // o `5` aqui tem de ser o mesmo numero de colunas da grade: com
    // o `5n` errado o rotulo da ponta esquerda vaza para fora do
    // painel, e com o `-n+5` errado a primeira linha abre para cima e
    // some atras da barra de abas
    expect(CSS).toMatch(
      /\.inv-cell:nth-child\(5n\+1\)\s+\.inv-cell__name\s*\{[^}]*left:\s*0/,
    );

    expect(CSS).toMatch(
      /\.inv-cell:nth-child\(5n\)\s+\.inv-cell__name\s*\{[^}]*right:\s*0/,
    );
  });

  it("os seletores do rotulo nao podem citar as antigas 7 colunas", () => {
    // o `nth-child(7n)` e o `-n+7` velhos nao podem sobrar em lugar
    // nenhum: eles nao casam com nenhuma celula de uma grade de 5, e
    // o rotulo da primeira linha e das pontas sai cortado sem erro
    const antigo = CSS.match(
      /\.inv-grid\s*>\s*\.inv-cell:nth-child\(-n\+7\)|\.inv-cell:nth-child\(7n/g,
    );

    expect(antigo ?? []).toEqual([]);
  });

  it("mantem a grade do INVENTARIO em 5 colunas em todos os breakpoints", () => {
    // so a grade do inventario. A do craft tem 4 colunas em uma
    // regra propria (`.cft-body .inv-grid`), porque o detalhe ocupa
    // a lateral e o espaco que sobraria seria linha vazia. Por isso
    // o seletor aqui e `.inv-grid` exato, e nao uma substring: uma
    // regra do craft com 4 nao pode contar como quebra do inventario
    //
    // O seletor precisa ser `.inv-grid` INTEIRO, e nao uma regra que
    // contenha a palavra. Um matcher de texto solto contaria
    // `.cft-body .inv-grid` tambem, porque nela aparece `.inv-grid`
    //
    // e o `\s*` antes da chave e obrigatorio: a regra da grade esta
    // precedida por um comentario CSS, e sem ele o seletor capturado
    // seria o comentario inteiro mais `.inv-grid`, que nao casa
    //
    // eram 7 colunas com o slot de 52px; com o slot de 68px sao 5
    const padrao =
      /(^|[},])\s*\.inv-grid\s*\{([^}]*grid-template-columns:\s*repeat\(\s*(\d+))/gm;

    const colunas = [...CSS.matchAll(padrao)].map(
      (match) => Number(match[3]),
    );

    expect(colunas).toEqual([5]);
  });

  it("a arte do inventario e a do craft, no mesmo tamanho", () => {
    // A mesma arte aparece no inventario e no craft, e o jogador
    // compara as duas telas. Um numero em cada lugar deixa a arte
    // mudar de tamanho de um painel para o outro, que e o defeito
    // exato que o `44px` unico veio corrigir
    const arteDoInventario = CSS.match(
      /\.item-icon\s+img\s*\{[^}]*width:\s*(\d+)px/,
    )[1];

    const arteDoCraft = CSS.match(
      /\.cft-cell\s+\.item-icon\s+img\s*\{[^}]*width:\s*(\d+)px/,
    )[1];

    expect(arteDoInventario).toBe(arteDoCraft);
    expect(arteDoInventario).toBe("44");
  });

  it("a arte do inventario e suavizada, e nao serrilhada", () => {
    // O `pixelated` foi escolhido quando a arte era pixel art de
    // 48x48. Hoje ela e desenhada em 1254x1254 e esta sendo reduzida,
    // entao o navegador tem de amostrar: com `pixelated` ele pega o
    // pixel vizinho e mostra o degrau da reducao a 44px
    expect(CSS).toMatch(
      /\.item-icon\s+img\s*\{[^}]*image-rendering:\s*auto/,
    );
  });

  it("o slot do inventario e do mesmo tamanho do slot do craft", () => {
    // A caixa do slot vazio e a mesma arte, dentro do mesmo tamanho:
    // `--slot` do inventario e a celula do craft, entao os dois
    // precisam ser 68px
    const slotDoInventario = CSS.match(
      /\.inv-panel\s*\{[^}]*--slot:\s*(\d+)px/,
    )[1];

    const celulaDoCraft = CSS.match(
      /\.cft-body\s+\.inv-grid\s*\{[^}]*repeat\(\s*\d+\s*,\s*(\d+)px/,
    )[1];

    expect(slotDoInventario).toBe(celulaDoCraft);
    expect(slotDoInventario).toBe("68");
  });

  it("as duas armas na coluna esquerda, luva na cintura e amuleto embaixo", () => {
    // A ordem das areas e o desenho do boneco. Este teste trava as
    // QUATRO linhas inteiras, e nao um par delas: e o desenho todo que
    // importa, e cada linha ja diz onde as outras nao podem estar
    //
    // o valor do `grid-template-areas` e UMA string com as quatro
    // linhas separadas por quebra de linha, e nao quatro valores. Por
    // isso o corte e pelos pares de aspas, e nao por `;` nem por `}` —
    // cortar por `;` traria junto o `grid-template-columns` e daria
    // seis "linhas" em vez de quatro
    const areas = CSS.match(
      /\.inv-equip__grid\s*\{[^}]*grid-template-areas:\s*([^}]+)\}/,
    )[1];

    const linhas = [...areas.matchAll(/"([^"]+)"/g)].map(
      (match) => match[1].trim(),
    );

    // a cabeca no alto, a arma secundaria na altura do peito, a
    // principal e a luva na altura da cintura, e o amuleto com as
    // botas na ultima linha
    expect(linhas).toEqual([
      ". head .",
      "weapon2 chest trinket1",
      "weapon legs gloves",
      "trinket2 boots .",
    ]);

    // as DUAS armas na coluna esquerda, e nao uma em cada coluna: as
    // duas na mesma coluna e o desenho de quem segura uma arma em cada
    // mao
    expect(linhas[1].split(" ")[0]).toBe("weapon2");
    expect(linhas[2].split(" ")[0]).toBe("weapon");
  });

  it("as areas do boneco cobrem os nove slots, uma vez cada", () => {
    // Toda area precisa estar escrita e nenhuma pode repetir: uma
    // area repetida faz o gridempilhar dois slots na mesma celula, e
    // uma area faltando deixa o slot vestido sem posicao — o
    // `grid-area` do slot aponta para um nome que nao existe e o
    // navegador cria uma area implicita, quebrando o desenho
    // o valor do `grid-template-areas` e UMA string com as quatro linhas
    // separadas por quebra de linha, e nao quatro valores
    const areas = CSS.match(
      /\.inv-equip__grid\s*\{[^}]*grid-template-areas:\s*([^}]+)\}/,
    )[1];

    const linhas = [...areas.matchAll(/"([^"]+)"/g)].map(
      (match) => match[1].trim(),
    );

    const nomes = linhas.flatMap(
      (linha) => linha.split(" "),
    );

    // o `.` nao e um slot: e a celula vazia do canto, e ele aparece
    // tres vezes de proposito. A unicidade so vale para os slots
    const slots = nomes.filter((nome) => nome !== ".");
    const unicos = new Set(slots);

    // 4 linhas de 3 colunas, com 3 celulas vazias: 9 slots
    expect(nomes.length, "celulas do boneco").toBe(12);
    expect(nomes.filter((n) => n === ".").length).toBe(3);

    expect(slots.length, "slots escritos").toBe(9);
    expect(unicos.size, "area repetida").toBe(slots.length);

    // os nove slots de `EQUIPMENT_SLOTS` tem de estar aqui
    for (const slot of [
      "head",
      "gloves",
      "chest",
      "legs",
      "boots",
      "weapon",
      "weapon2",
      "trinket1",
      "trinket2",
    ]) {
      expect(unicos, slot).toContain(slot);
    }
  });

  it("a coluna do boneco cabe na grade de slots do boneco", () => {
    // A coluna do boneco e 3 colunas do boneco mais os vaos mais os
    // dois `padding` de 10px. Com o slot de 68px sao 3x68 + 2x4 = 212,
    // e 212 + 20 = os 232px da coluna. Se o slot crescer sem a coluna
    // crescer junto, a grade do boneco vaza para a coluna da mochila
    const slot = Number(
      CSS.match(/\.inv-panel\s*\{[^}]*--slot:\s*(\d+)px/)[1],
    );

    const vao = 4;
    const colunas = 3;

    const larguraDaColuna = Number(
      CSS.match(/\.inv-illus\s*\{[^}]*width:\s*(\d+)px/)[1],
    );

    const precisa = colunas * slot + vao * (colunas - 1) + 20;

    expect(larguraDaColuna, "a coluna do boneco nao cabe").toBe(
      precisa,
    );
  });

  it("a grade da mochila cabe na coluna que sobrou", () => {
    // A mochila e a coluna da direita da modal de 600px. Descontando a
    // coluna do boneco e a borda, sobra o que a grade da mochila usa.
    // Com 5 colunas de 68px ela cabe; com 7 nao cabia, e era por isso
    // que a grade tinha 7 colunas com o slot de 52px
    const slot = Number(
      CSS.match(/\.inv-panel\s*\{[^}]*--slot:\s*(\d+)px/)[1],
    );

    const vao = 4;

    const larguraDoBoneco = Number(
      CSS.match(/\.inv-illus\s*\{[^}]*width:\s*(\d+)px/)[1],
    );

    const larguraDaModal = Number(
      CSS.match(/\.inv-panel\s*\{[^}]*width:\s*min\((\d+)px/)[1],
    );

    const disponivel = larguraDaModal - larguraDoBoneco - 2;

    const colunas = Number(
      CSS.match(
        /(^|[},])\s*\.inv-grid\s*\{[^}]*repeat\(\s*(\d+)/m,
      )[2],
    );

    const usada = colunas * slot + vao * (colunas - 1);

    expect(usada, "a mochila nao cabe na modal").toBeLessThan(
      disponivel,
    );
  });

  it("a grade do craft tem 4 colunas, para o detalhe caber ao lado", () => {
    // A grade do craft nao usa o `var(--slot)` do inventario: com o
    // detalhe ao lado, mais colunas de 68px nao caberiam na modal de
    // 600px. Quatro colunas de 68px dao a arte 44px, com 12px de folga
    // de cada lado
    expect(CSS).toMatch(
      /\.cft-body\s+\.inv-grid\s*\{[^}]*grid-template-columns:\s*repeat\(\s*4/,
    );

    expect(CSS).toMatch(
      /\.cft-cell\s+\.item-icon\s+img\s*\{[^}]*width:\s*44px/,
    );
  });

  it("a arte do item selecionado e a maior, e nao pixelada", () => {
    // A arte do selecionado e a unica que mostra a raridade escolhida,
    // e e onde o jogador compara as cinco antes de gastar material. De
    // 38px para 68px porque a arte foi desenhada em 1254x1254 e a 30px
    // perdia o cinto e as fivelas
    expect(CSS).toMatch(
      /\.cft-detail__icon\s*\{[^}]*width:\s*68px/,
    );

    expect(CSS).toMatch(
      /\.cft-detail__icon\s+\.item-icon\s+img\s*\{[^}]*width:\s*56px/,
    );

    // `image-rendering: auto` e o oposto do `pixelated` da celula.
    // A arte e grande e esta sendo REDUZIDA, entao o navegador tem de
    // amostrar e suavizar: com `pixelated` ele pegaria o pixel
    // vizinho e mostraria o degrau da reducao
    expect(CSS).toMatch(
      /\.cft-detail__icon\s+\.item-icon\s+img\s*\{[^}]*image-rendering:\s*auto/,
    );
  });

  it("o detalhe tem largura para a arte maior e o nome", () => {
    // Com a arte em 68px, os 260px originais cortavam o nome do item
    // com reticencias — a caixa, o nome e o rotulo de raridade nao
    // cabiam. 264px e o menor que cabe "Botas de Arqueiro" inteiro
    expect(CSS).toMatch(
      /\.cft-detail\s*\{[^}]*width:\s*264px/,
    );
  });

  it("a modal do craft tem a mesma largura da do inventario", () => {
    // A 720px nao cabia bem e a modal ficava larga demais na tela.
    // A solucao foi encolher as DUAS colunas e manter os 600px: a
    // grade foi para 68px por celula e o detalhe para 264px, e a arte
    // continua em 44px
    expect(CSS).toMatch(
      /\.cft-panel\s*\{[^}]*width:\s*min\(600px/,
    );

    // a altura sobe um pouco: a arte do selecionado foi de 38px para
    // 68px, e a lista de ingredientes precisa de espaco antes de
    // rolar
    expect(CSS).toMatch(
      /\.cft-panel\s*\{[^}]*max-height:\s*min\(600px/,
    );
  });

  it("a modal do craft nunca passa da borda da tela", () => {
    // o `calc(100vw - 24px)` e o mesmo do inventario: em tela
    // estreita a modal tem de encostar na borda, nunca sair dela
    expect(CSS).toMatch(
      /\.cft-panel\s*\{[^}]*calc\(100vw - 24px\)/,
    );
  });

  it("a soma das duas colunas cabe na modal do craft", () => {
    // Este e o teste que pegaria o corte de verdade. As medidas saem
    // do proprio CSS em vez de numeros escritos aqui: se a grade ou o
    // detalhe crescerem de novo, este teste acusa
    // Um seletor por vez: as regras sao lidas com o seletor INTEIRO,
    // e nao por substring.
    //
    // dois detalhes que custaram uma rodada cada:
    //
    // 1. o `(?:^|[},])` no comeco e obrigatorio. Sem ele o regex
    //    casaria a string `.cft-panel` dentro de `.cft-panel > .inv-tabs`,
    //    e leria o `{` da regra errada. E o `\s*` antes da chave
    //    tambem: a regra vem precedida de comentario CSS
    //
    // 2. `matchAll`, e nao `match`. Com a flag `g`, `match` devolve
    //    so os achados e JOGA os grupos de captura fora; o `[1]` daria
    //    `undefined` e a conta quebraria sem avisar qual era a regra
    //    errada
    const corpoDaRegra = (seletor) => {
      const partes = new RegExp(
        `(?:^|[},])\\s*${seletor.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        )}\\s*\\{([^}]*)`,
        "gm",
      );

      return [...CSS.matchAll(partes)][0]?.[1] ?? "";
    };

    const grade = corpoDaRegra(".cft-body .inv-grid");

    const [, vao] = grade.match(/gap:\s*(\d+)px/);
    const [, colunas, tam] = grade.match(
      /repeat\(\s*(\d+)\s*,\s*(\d+)px/,
    );

    const larguraDaGrade =
      Number(tam) * Number(colunas) +
      Number(vao) * (Number(colunas) - 1);

    const larguraDoDetalhe = Number(
      corpoDaRegra(".cft-detail").match(/width:\s*(\d+)px/)[1],
    );

    const larguraDaModal = Number(
      corpoDaRegra(".cft-panel").match(/min\((\d+)px/)[1],
    );

    // a grade tem 4 colunas de 68px e 3 vaos de 8px = 296px
    expect(larguraDaGrade).toBe(296);

    // 296 + 264 = 560, e a modal precisa de folga para a borda de 2px
    // de cada lado. 600px sobra, e e a MESMA largura do inventario:
    // alargar a modal resolvia o corte do detalhe e estragava a tela
    expect(
      larguraDaGrade + larguraDoDetalhe,
      "as duas colunas nao cabem na modal",
    ).toBeLessThan(larguraDaModal - 8);

    // e a folga nao pode sertao grande que a modal pareca vazia de
    // proposito: 600 - 560 = 40px, mais a borda
    const folga =
      larguraDaModal - (larguraDaGrade + larguraDoDetalhe);

    expect(folga, "folga lateral da modal").toBeLessThan(60);
  });

  it("o icone de slot vazio e cinza, mesmo sendo emoji", () => {
    // O glifo de luvas (`🧤`) e de botas (`👢`) sao EMOJI, e emoji
    // ignora `color`: o navegador desenhava os dois na cor original
    // em tela cheia, com o slot vazio colorido ao lado dos outros seis
    // que ficavam cinza. O `grayscale` trava a arte no cinza
    expect(CSS).toMatch(
      /\.inv-slot--empty\s+\.inv-slot__icon\s*\{[^}]*filter:\s*grayscale\(1\)/,
    );
  });

  it("a coluna da grade do craft nao pode ser espremida pelo detalhe", () => {
    // sem este minimo a flexbox espreme a esquerda e as celulas
    // quebram de largura, porque o detalhe tem `flex: none` e 260px
    // fixos
    expect(CSS).toMatch(
      /\.cft-body\s+\.inv-main\s*\{[^}]*min-width:\s*\d+px/,
    );
  });

  it("so posiciona o rotulo no eixo X para nao competir com o vertical", () => {
    const translations = [
      ...CSS.matchAll(/\.inv-cell__name[^{]*\{[^}]*transform:\s*([^;]+);/g),
    ].map((match) => match[1].trim());

    expect(translations.length).toBeGreaterThan(0);

    for (const value of translations) {
      expect(value, value).toMatch(/^translateX\(/);
    }
  });
});

describe("inventory popovers", () => {
  it("ancora a barra de abas para o popover do filtro nao escapar", () => {
    const tabs = declarationsFor(".inv-tabs");

    // sem isto o top do popover resolve contra o .inv-panel e ele
    // nasce la fora, cortado pelo overflow: hidden do painel
    expect(tabs).toMatch(/position:\s*relative/);
  });

  it("mantem o popover e o menu dentro do painel", () => {
    for (const selector of [".inv-filter", ".inv-menu"]) {
      const body = declarationsFor(selector);

      expect(body, selector).toMatch(/position:\s*absolute/);
      expect(body, selector).toMatch(/top:\s*calc\(100%/);
    }
  });

  it("mantem a barra de abas acima do backdrop do menu", () => {
    const tabs = declarationsFor(".inv-tabs");
    const backdrop = declarationsFor(".inv-menu__backdrop");

    const z = (body) =>
      Number(
        body.match(/z-index:\s*(\d+)/)?.[1] ?? "0",
      );

    expect(z(backdrop)).toBeGreaterThan(0);
    // senao o primeiro clique na engrenagem so fecharia o menu
    expect(z(tabs)).toBeGreaterThan(z(backdrop));
  });

  it("mantem o popover do filtro acima do menu de slot", () => {
    const filter = declarationsFor(".inv-filter");
    const menu = declarationsFor(".inv-menu");

    const z = (body) =>
      Number(
        body.match(/z-index:\s*(\d+)/)?.[1] ?? "0",
      );

    expect(z(filter)).toBeGreaterThan(0);
    expect(z(menu)).toBeGreaterThan(0);
  });

  it("desenha o backdrop cobrindo o painel inteiro", () => {
    const backdrop = declarationsFor(".inv-menu__backdrop");

    expect(backdrop).toMatch(/position:\s*absolute/);
    expect(backdrop).toMatch(/inset:\s*0/);
  });
});

describe("bestiary panel", () => {
  it("draws a monster button in the top-right menu", () => {
    expect(CSS).toMatch(/\.hud-btn--bestiary\s*\{/);
    expect(CSS).toMatch(/\.hud-menu\s*\{/);
  });

  it("anchors the closed-hunt badge on the button corner", () => {
    const badge = declarationsFor(".hud-btn__badge");

    expect(badge).toMatch(/position:\s*absolute/);
    expect(badge).toMatch(/top:\s*-3px/);
    expect(badge).toMatch(/right:\s*-3px/);
  });

  it("lays each hunt as title, bar, count and reward", () => {
    const hunt = declarationsFor(".bst-hunt");

    expect(hunt).toMatch(/display:\s*grid/);
    expect(hunt).toMatch(/grid-template-columns:/);
  });

  it("paints finished hunts in gold and pending in purple", () => {
    const fill = declarationsFor(".bst-hunt__fill");

    expect(fill).toMatch(/background:\s*linear-gradient/);
    expect(fill).toMatch(/#c489ff/);

    const done = declarationsFor(
      ".bst-hunt.is-done .bst-hunt__fill",
    );

    expect(done).toMatch(/#e5bb68/);
  });

  it("gives the list room to breathe between cards", () => {
    const list = declarationsFor(".bst-list");

    expect(list).toMatch(/display:\s*grid/);
    expect(list).toMatch(/gap:\s*8px/);
    expect(list).toMatch(/list-style:\s*none/);
  });
});

describe("bestiary auto box", () => {
  it("stacks the box under the quest tracker", () => {
    const stack = declarationsFor(".hud-stack");

    expect(stack).toMatch(/position:\s*absolute/);
    expect(stack).toMatch(/display:\s*grid/);
    expect(stack).toMatch(/gap:\s*8px/);

    // o tracker deixa de ser absoluto para nao brigar com o pai
    expect(declarationsFor(".qst-tracker")).toMatch(
      /position:\s*relative/,
    );
  });

  it("paints the box as a clickable button with a live border", () => {
    const box = declarationsFor(".bst-auto");

    expect(box).toMatch(/display:\s*flex/);
    expect(box).toMatch(/width:\s*100%/);
    expect(box).toMatch(/cursor:\s*pointer/);
    expect(box).toMatch(/border:\s*1px solid rgba\(126,/);
  });

  it("pulses so the player can tell the hunt is running", () => {
    expect(declarationsFor(".bst-auto")).toMatch(
      /animation:\s*bst-auto-pulse/,
    );

    expect(CSS).toMatch(/@keyframes bst-auto-pulse/);
  });

  it("labels the box as auto and offers a stop", () => {
    expect(CSS).toMatch(/\.bst-auto__tag\b/);
    expect(CSS).toMatch(/\.bst-auto__stop\b/);
  });

  it("keeps the zone name on one line", () => {
    const zone = declarationsFor(".bst-auto__zone");

    expect(zone).toMatch(/overflow:\s*hidden/);
    expect(zone).toMatch(/text-overflow:\s*ellipsis/);
    expect(zone).toMatch(/white-space:\s*nowrap/);
  });

  it("highlights the entry being hunted in the panel", () => {
    const hunting = declarationsFor(".bst-entry.is-hunting");

    expect(hunting).toMatch(/border-color:\s*rgba\(126,/);

    const stop = declarationsFor(
      ".bst-entry.is-hunting .bst-entry__go",
    );

    expect(stop).toMatch(/background:\s*#7ef0b0/);
  });

  it("disables the go button for a creature with no zone", () => {
    expect(declarationsFor(".bst-entry__go:disabled")).toMatch(
      /cursor:\s*not-allowed/,
    );
  });
});

describe("tema do inventario", () => {
  const THEME = readFileSync("src/theme-inventory.css", "utf8");
  const MAIN = readFileSync("src/main.jsx", "utf8");

  function themeFor(selector) {
    const escaped = selector.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    const pattern = new RegExp(
      `${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`,
      "g",
    );

    return [...THEME.matchAll(pattern)]
      .map((match) => match[1])
      .join("\n");
  }

  it("entra depois do styles.css para poder sobrescrever", () => {
    const styles = MAIN.indexOf("./styles.css");
    const theme = MAIN.indexOf("./theme-inventory.css");

    expect(styles).toBeGreaterThan(-1);
    expect(theme).toBeGreaterThan(styles);
  });

  it("documenta como reverter em uma linha", () => {
    expect(THEME).toMatch(/PARA REVERTER/);
    expect(THEME).toMatch(/theme-inventory\.css/);
  });

  it("mantem styles.css intacto como referencia", () => {
    expect(THEME).not.toMatch(/\.inv-panel\s*\{/);
    expect(THEME).not.toMatch(/\.inv-cell\s*\{/);
  });

  it("redefine as variaveis que styles.css consumia", () => {
    const root = themeFor(":root");

    for (const token of [
      "--panel",
      "--panel-strong",
      "--border",
      "--muted",
      "--gold",
    ]) {
      expect(root, token).toMatch(
        new RegExp(`${token}\\s*:`),
      );
    }
  });

  it("aplica a mesma moldura em todos os paineis", () => {
    for (const selector of [
      ".hud-vitals",
      ".target-panel",
      ".qst-panel",
      ".bst-panel",
      ".bst-auto",
      ".class-card",
      ".rnk-panel",
    ]) {
      expect(themeFor(selector), selector).toMatch(
        /background:\s*linear-gradient/,
      );
    }
  });

  it("aplica o mesmo tema as abas e as linhas do rank", () => {
    // O rank entrou no tema depois do painel. Sem estas entradas, o
    // painel ganhava a moldura nova e as abas e as linhas ficariam
    // na paleta antiga: um painel meio tematizado, que e pior do que
    // nao tematizar
    for (const seletor of [
      ".rnk-tabs",
      ".rnk-tab",
      ".rnk-tab.is-active",
      ".rnk-tab__count",
      ".rnk-row",
    ]) {
      expect(themeFor(seletor), seletor).toMatch(
        /var\(--t-/,
      );
    }
  });

  it("destaca a sua linha no rank com o mesmo dourado da missao ativa", () => {
    // a posicao do jogador e a unica informacao que o painel
    // precisa gritar, e o dourado e o que o jogo ja usa para dizer
    // "esta e a sua linha"
    expect(themeFor(".rnk-row.is-you")).toMatch(
      /--t-gold-line/,
    );

    expect(themeFor(".rnk-row.is-you")).toMatch(
      /--t-active/,
    );
  });

  it("tira o raio de 50% e o blur do inventario", () => {
    for (const selector of [
      ".hud-btn",
      ".skill-slot",
      ".hud-buff",
      ".hud-ability",
    ]) {
      const block = themeFor(selector);

      expect(block, selector).toMatch(/border-radius:\s*var\(--t-radius/);
      expect(block, selector).not.toMatch(/border-radius:\s*50%/);
    }

    const panels = [
      ".hud-vitals",
      ".qst-tracker",
      ".qst-panel",
      ".bst-panel",
    ].map(themeFor).join("\n");

    expect(panels).not.toMatch(/backdrop-filter:\s*blur/);
  });

  it("mantem cada tipo de buff distinguivel", () => {
    const types = [
      "burning",
      "poison",
      "stun",
      "attackSpeed",
      "freeze",
      "invulnerability",
      "damageReduction",
      "power",
      "regeneration",
      "cloak",
      "elementalAffinity",
    ];

    const hues = new Set();

    for (const type of types) {
      const block = themeFor(`.hud-buff--${type}`);

      expect(block, type).toMatch(/border-color:\s*rgba\(/);

      hues.add(block.match(/border-color:\s*([^;]+)/)[1]);
    }

    // 7 familias distintas: os buffs que compartilham matiz de
    // proposito (stun/attackSpeed, poison, etc) podem repetir
    expect(hues.size).toBeGreaterThanOrEqual(7);
  });

  it("nao mexe no canvas do jogo", () => {
    expect(THEME).not.toMatch(/\.game-canvas\s*\{/);
  });

  it("cobre toda propriedade de aparencia que o styles.css usa", () => {
    const APPEARANCE = [
      "background",
      "background-color",
      "background-image",
      "border",
      "border-color",
      "border-top",
      "border-bottom",
      "border-left",
      "border-right",
      "border-radius",
      "box-shadow",
      "color",
      "outline",
      "backdrop-filter",
      "text-shadow",
    ];

    function parse(source) {
      const out = [];
      let buffer = "";
      let selector = "";
      let parens = 0;
      let inComment = false;
      let depth = 0;

      for (let i = 0; i < source.length; i += 1) {
        const char = source[i];

        if (inComment) {
          if (char === "*" && source[i + 1] === "/") {
            inComment = false;
            i += 1;
          }
          continue;
        }

        if (char === "/" && source[i + 1] === "*") {
          inComment = true;
          i += 1;
          continue;
        }

        if (char === "(") parens += 1;
        if (char === ")") parens -= 1;

        if (char === "{" && parens === 0) {
          if (depth === 0 && buffer.trim().startsWith("@")) {
            depth = 1;
            buffer = "";
            continue;
          }

          selector = buffer.trim().replace(/\s+/g, " ");
          buffer = "";
          depth += 1;
          continue;
        }

        if (char === "}" && parens === 0) {
          depth -= 1;

          if (depth === 0 && selector) {
            out.push({ selector, body: buffer });
          }

          selector = "";
          buffer = "";
          continue;
        }

        if (char !== "{") buffer += char;
      }

      return out;
    }

    const baseRules = parse(
      CSS.slice(0, CSS.indexOf("Inventario - HUD no padrao OSRS")),
    ).filter((rule) => !rule.selector.startsWith("@"));

    const themeRules = parse(THEME).filter(
      (rule) => !rule.selector.startsWith("@"),
    );

    const themeIndex = themeRules.map((rule) => ({
      classes: new Set(
        [...rule.selector.matchAll(/\.([\w-]+)/g)].map(
          (match) => match[1],
        ),
      ),
      body: rule.body,
    }));

    const gaps = [];

    for (const rule of baseRules) {
      if (/^(:root|\*|html|body|button|h1)/.test(rule.selector)) {
        continue;
      }

      const subjects = rule.selector
        .split(",")
        .map((part) => part.trim())
        .map((part) => part.split(/\s+|>/).pop())
        .filter(Boolean);

      for (const property of APPEARANCE) {
        if (
          !new RegExp(`(^|;)\\s*${property}\\s*:`).test(
            rule.body,
          )
        ) {
          continue;
        }

        for (const subject of subjects) {
          const classes = [
            ...subject.matchAll(/\.([\w-]+)/g),
          ].map((match) => match[1]);

          if (classes.length === 0) continue;

          const covered = themeIndex.some(
            (entry) =>
              classes.some((name) => entry.classes.has(name)) &&
              new RegExp(
                `(^|;)\\s*${property}\\s*:`,
              ).test(entry.body),
          );

          if (!covered) {
            gaps.push(`${subject} :: ${property}`);
          }
        }
      }
    }

    expect(
      [...new Set(gaps)],
      "seletores que ainda usam o visual antigo",
    ).toEqual([]);
  });

  it("mantem as acoes de layout fora do tema", () => {
    for (const selector of [".hud-stack", ".qst-tracker"]) {
      const block = themeFor(selector);

      expect(block, selector).not.toMatch(/(^|\s)(top|left|right|bottom|width|height):/);
    }
  });
});

describe("stylesheet integrity", () => {
  const THEME = readFileSync("src/theme-inventory.css", "utf8");

  it("has balanced braces", () => {
    expect((CSS.match(/\{/g) ?? []).length).toBe(
      (CSS.match(/\}/g) ?? []).length,
    );
  });

  it("has balanced braces in the theme layer too", () => {
    expect((THEME.match(/\{/g) ?? []).length).toBe(
      (THEME.match(/\}/g) ?? []).length,
    );
  });

  it("has no comment glued to a selector in the theme", () => {
    expect(THEME).not.toMatch(/\*\/\./);
  });

  it("keeps the theme lines readable", () => {
    const longest = THEME.split("\n").reduce(
      (max, line) => Math.max(max, line.length),
      0,
    );

    expect(longest).toBeLessThan(130);
  });

  it("has no replacement characters from bad encoding", () => {
    expect(CSS).not.toMatch(/\uFFFD/);
  });

  it("has no comment glued to a selector", () => {
    expect(CSS).not.toMatch(/\*\/\./);
  });

  it("has no collapsed single-line rules", () => {
    // um bloco inteiro numa linha costuma ser sinal de edicao quebrada
    const lines = CSS.split("\n").filter(
      (line) => !line.trim().startsWith("@import"),
    );

    const longest = lines.reduce(
      (max, line) => Math.max(max, line.length),
      0,
    );

    expect(longest).toBeLessThan(130);
  });
});
