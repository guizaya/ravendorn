import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Verifica o gerador de equipamento.
 *
 * Os testes em `src/data/craft/craftPorClasse.test.js` provam que a
 * ESCALADA esta certa: que a lendaria troca ingrediente, que subir
 * de raridade nunca fica mais barato. Este arquivo prova o outro
 * lado, que e o texto que sai da ferramenta.
 *
 * Uma escalada perfeita que escreve um bloco invalido deixa o
 * arquivo de dados quebrado sem nenhum teste de dado acusar, porque
 * o defeito esta no que foi GERADO e nao no que foi escrito a mao.
 *
 * O arquivo real NUNCA e tocado: cada teste que escreve restaura no
 * `afterEach`. Sem isso, um teste quebrado no meio deixaria o
 * `data/craft/index.js` pela metade e os testes seguintes rodariam
 * contra um arquivo diferente do que eles esperam.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(HERE, "..");

const COMANDO = path.join(RAIZ, "tools", "gerar-equipamento.mjs");
const RECIPES = path.join(
  RAIZ,
  "src",
  "data",
  "craft",
  "index.js",
);

/**
 * Quem escreve no arquivo de dados e o `beforeEach`, e o
 * `afterEach` restaura.
 *
 * Isto corrige um defeito real deste arquivo. Antes, cada teste que
 * gerava tinha o proprio par gravar/restaurar. Um deles falhava
 * ANTES de gravar, deixava o arquivo com a receita de teste dentro, e
 * o teste seguinte lia esse arquivo sujo e gerava por cima: a sessao
 * terminava com o arquivo de dados sujo, e `craftData.test.js`
 * passava sem reclamar porque ele nao sabe o que procurar.
 *
 * Com o par em `beforeEach`/`afterEach` todo teste ve o arquivo como
 * o jogador vai ver, e a restauracao sempre tem o que restaurar,
 * inclusive quando o teste falha no meio
 */
let original = null;

const guardarOriginal = () => {
  original = fs.readFileSync(RECIPES, "utf8");
};

/** o comando sem --dry, que falha com codigo de saida != 0 */
const rodar = (args) =>
  execFileSync(process.execPath, [COMANDO, ...args], {
    cwd: RAIZ,
    encoding: "utf8",
    stdio: "pipe",
  });

const falhar = (args) => () =>
  execFileSync(process.execPath, [COMANDO, ...args], {
    cwd: RAIZ,
    encoding: "utf8",
    stdio: "pipe",
  });

/** roda de verdade e devolve o arquivo que o comando deixou */
const gerar = (args, id = "arma_de_teste") => {
  const saida = rodar([...args, "--id", id]);

  return { saida, arquivo: fs.readFileSync(RECIPES, "utf8") };
};

/**
 * Carrega o arquivo de receitas em um processo NOVO.
 *
 * Nao pode ser `import()` aqui: o Vitest guarda o modulo em cache
 * depois do primeiro teste, entao a segunda leitura usaria a versao
 * de antes da geracao e o teste passaria com um arquivo que o
 * jogador nunca vai abrir. Processo separado e o unico jeito de ler
 * o disco de verdade
 */
const carregarReceitas = (itemId) => {
  // o caminho e relativo ao arquivo temporario, que fica em
  // `tools/`: por isso o `../`. Um `./src/...` resolveria para
  // `tools/src/...` e o processo morreria com MODULE_NOT_FOUND
  const script = [
    'const m = await import("../src/data/craft/index.js");',
    "const r = m.getCraftRecipe(process.argv[2]);",
    "process.stdout.write(JSON.stringify({",
    "  achou: r !== null,",
    "  id: r?.id ?? null,",
    "  ingredientes: r?.common?.ingredients?.length ?? -1,",
    "  variantes: m.variantsOf(process.argv[2]).length,",
    "}));",
  ].join("\n");

  const caminho = path.join(RAIZ, "tools", ".ler-receitas.mjs");

  fs.writeFileSync(caminho, script, "utf8");

  try {
    // o id vai como o SEGUNDO argumento: o primeiro e o caminho do
    // proprio script, que o Node poe em argv[1]
    const saida = execFileSync(
      process.execPath,
      [caminho, itemId],
      { cwd: RAIZ, encoding: "utf8", stdio: "pipe" },
    );

    return JSON.parse(saida);
  } finally {
    fs.rmSync(caminho, { force: true });
  }
};

const carregarItens = (itemId) => {
  const script = [
    'const m = await import("../src/data/items/index.js");',
    "process.stdout.write(JSON.stringify({",
    "  existe: m.getItem(process.argv[2]) !== null,",
    "}));",
  ].join("\n");

  const caminho = path.join(RAIZ, "tools", ".ler-itens.mjs");

  fs.writeFileSync(caminho, script, "utf8");

  try {
    const saida = execFileSync(
      process.execPath,
      [caminho, itemId],
      { cwd: RAIZ, encoding: "utf8", stdio: "pipe" },
    );

    return JSON.parse(saida);
  } finally {
    fs.rmSync(caminho, { force: true });
  }
};

/**
 * O arquivo volta EXATAMENTE como estava.
 *
 * A restauracao guarda o conteudo INTEIRO em vez de apagar o bloco
 * gerado: o comando pode ter inserido a receita no meio do arquivo,
 * e uma busca-e-substituicao deixaria o arquivo diferente do original
 * mesmo sem o item. O teste seguinte rodaria contra um arquivo que o
 * jogador nunca vai ver, e a falha apareceria la em vez de aqui.
 */
beforeEach(() => {
  guardarOriginal();
});

afterEach(() => {
  if (original !== null) {
    fs.writeFileSync(RECIPES, original, "utf8");
    original = null;
  }
});

/**
 * O arquivo precisa do marcador, e o comando falha sem ele.
 *
 * Estes testes existem porque o marcador sumiu uma vez durante o
 * desenvolvimento, e a falha apareceu como "o comando nao achou o
 * marcador" em quatro testes ao mesmo tempo, sem nenhum deles dizer
 * que o problema era o arquivo. A mensagem sozinha aponta para o
 * comando, e o comando estava certo
 */
describe("gerar-equipamento: o marcador", () => {
  it("o arquivo de receitas tem o marcador de insercao", () => {
    expect(fs.readFileSync(RECIPES, "utf8")).toContain(
      "/* ---- equipamento gerado: nao editar a mao ---- */",
    );
  });

  it("o marcador fica no fim da lista de receitas", () => {
    const fonte = fs.readFileSync(RECIPES, "utf8");
    const posBow = fonte.indexOf('    itemId: "willow_bow"');
    const posMarca = fonte.indexOf("/* ---- equipamento gerado");

    // o casamento e pela receita, com a indentacao: a palavra
    // "willow_bow" tambem aparece no comentario do topo do arquivo,
    // e um `indexOf` sem a indentacao acharia o comentario em vez
    // da receita
    expect(posBow).toBeGreaterThan(-1);
    expect(posMarca).toBeGreaterThan(posBow);
  });

  it("o marcador e o ULTIMO comentario da lista", () => {
    // O comando insere o bloco novo logo depois do marcador e
    // recria o marcador em seguida, entao o marcador nunca e a
    // ultima receita: ele e sempre a ultima linha antes do `];`.
    //
    // E o que garante que a proxima geracao acha o lugar de insercao.
    // Na primeira versao do comando o marcador era CONSUMIDO pelo
    // `replace`, e a segunda geracao falhava com "marcador nao
    // encontrado" — o comando so funcionava uma vez
    const fonte = fs.readFileSync(RECIPES, "utf8");
    const posMarca = fonte.indexOf("/* ---- equipamento gerado");
    const posFecha = fonte.indexOf("\n];");

    expect(posMarca).toBeGreaterThan(-1);
    expect(posFecha).toBeGreaterThan(posMarca);
  });

  it("o comando pode gerar duas vezes seguidas", () => {
    // a prova de que o marcador sobrevive: duas geracoes de verdade,
    // e as duas receitas precisam estar no arquivo ao mesmo tempo
    gerar(
      ["--classe", "warrior", "--tipo", "weapon"],
      "arma_um",
    );
    gerar(
      ["--classe", "lancer", "--tipo", "weapon"],
      "arma_dois",
    );

    const fonte = fs.readFileSync(RECIPES, "utf8");

    expect(fonte).toContain('itemId: "arma_um"');
    expect(fonte).toContain('itemId: "arma_dois"');
    expect(
      carregarReceitas("arma_um").achou,
    ).toBe(true);
    expect(
      carregarReceitas("arma_dois").achou,
    ).toBe(true);
  });

  it("so o arco e a aljava sao equipamento: nenhum resto de teste", () => {
    // um item de teste que sobrou no arquivo de dados passa em
    // qualquer teste de estrutura e quebra o balanceamento: ele
    // aparece para o jogador como receita normal
    //
    // o casamento e por `itemId`, e nao pela palavra solta: "repetida"
    // aparece num comentario legitimo sobre os sete bonecos, e um
    // `not.toContain("repetida")` acusaria o arquivo inteiro
    const fonte = fs.readFileSync(RECIPES, "utf8");

    for (const sobra of [
      "arma_de_teste",
      "arma_um",
      "arma_dois",
      "repetida",
      "warrior_weapon",
      "lancer_weapon",
      "sorcerer_weapon",
    ]) {
      expect(fonte, sobra).not.toContain(`itemId: "${sobra}"`);
    }
  });
});

describe("gerar-equipamento: a linha de comando", () => {
  it("sem argumento lista as classes e nao escreve", () => {
    const saida = rodar([]);

    expect(saida).toContain("arbalist");
    expect(saida).toContain("warrior");
    expect(fs.readFileSync(RECIPES, "utf8")).toBe(original);
  });

  it("--dry mostra o bloco e nao escreve no arquivo", () => {
    const saida = rodar([
      "--classe",
      "warrior",
      "--tipo",
      "weapon",
      "--id",
      "arma_de_teste",
      "--dry",
    ]);

    expect(saida).toContain("arma_de_teste");
    expect(saida).toContain("--dry");
    expect(fs.readFileSync(RECIPES, "utf8")).toBe(original);
  });

  it("escreve um bloco que o jogo consegue carregar", () => {
    gerar(["--classe", "warrior", "--tipo", "weapon"]);

    // o teste que importa o arquivo de verdade: um bloco com virgula
    // ou chave errada derruba o modulo inteiro, e o jogo junto
    const lido = carregarReceitas("arma_de_teste");

    expect(lido.achou, "a receita gerada nao foi encontrada").toBe(
      true,
    );
    expect(lido.id).toBe("craft_arma_de_teste");
    expect(lido.ingredientes).toBeGreaterThan(0);
    expect(lido.variantes).toBe(5);
  });

  it("a receita entra depois do arco, e nao antes", () => {
    const { arquivo } = gerar([
      "--classe",
      "warrior",
      "--tipo",
      "weapon",
    ]);

    // a ordem de leitura do arquivo e parte do que ele comunica:
    // material, arco escrito a mao, gerado
    const posBow = arquivo.indexOf('    itemId: "willow_bow"');
    const posNovo = arquivo.indexOf(
      '    itemId: "arma_de_teste"',
    );

    expect(posBow).toBeGreaterThan(-1);
    expect(posNovo).toBeGreaterThan(posBow);
  });

  it("o id gerado nao colide com item do catalogo", () => {
    // a receita aponta para um item que precisa EXISTIR. Sem o item,
    // o craft classifica como material e o equipamento some da aba
    // de arma
    gerar(["--classe", "sorcerer", "--tipo", "weapon"]);

    // por enquanto o comando NAO cria o item: ele so escreve a
    // receita. Este teste trava essa EXPECTATIVA, para quem for
    // acrescentar a criacao do item saber o que mexer aqui
    expect(carregarItens("arma_de_teste").existe).toBe(false);
  });

  it("recusa uma classe que nao existe", () => {
    expect(falhar(["--classe", "necromante", "--tipo", "weapon"])).toThrow();
  });

  it("recusa um tipo que nao existe", () => {
    expect(falhar(["--classe", "warrior", "--tipo", "drone"])).toThrow();
  });

  it("recusa a familia de arma de outra classe", () => {
    // a espada e do guerreiro e o arco e do arqueiro: pedir arco
    // para o guerreiro produziria um item que ele cria mas nao pode
    // equipar
    expect(
      falhar([
        "--classe",
        "warrior",
        "--tipo",
        "weapon",
        "--kind",
        "bow",
      ]),
    ).toThrow();
  });

  it("recusa gerar duas vezes o mesmo item", () => {
    const args = [
      "--classe",
      "warrior",
      "--tipo",
      "weapon",
      "--id",
      "repetida",
    ];

    rodar(args);

    // a segunda vez reescreveria por cima de uma receita que
    // alguem pode ter ajustado a mao
    expect(falhar(args)).toThrow();
  });

  it("aceita --flag valor e --flag=valor", () => {
    const comEspaco = rodar([
      "--classe",
      "lancer",
      "--tipo",
      "weapon",
      "--id",
      "a",
      "--dry",
    ]);
    const comIgual = rodar([
      "--classe=lancer",
      "--tipo=weapon",
      "--id=b",
      "--dry",
    ]);

    // sem o espaco ser lido, `--classe` virava flag booleana e o
    // comando caia na listagem
    expect(comEspaco).toContain('"a"');
    expect(comIgual).toContain('"b"');
  });

  it("cada classe tem pelo menos uma familia de arma para gerar", () => {
    for (const classe of [
      "warrior",
      "lancer",
      "sorcerer",
      "arbalist",
    ]) {
      const saida = rodar([
        "--classe",
        classe,
        "--tipo",
        "weapon",
        "--id",
        "x",
        "--dry",
      ]);

      expect(saida, classe).toContain("x");
    }
  });
});
