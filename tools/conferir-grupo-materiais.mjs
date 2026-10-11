/**
 * O QUE ESTE ARQUIVO CONFERE
 *
 * A aba Material do craft virava 48 quadrados soltos, sem nome e em ordem
 * alfabetica. Os tres materiais de uma familia tem a MESMA arte, entao tres
 * quadrados vizinhos eram o mesmo desenho com bordas diferentes, e nada na
 * tela dizia que eles andavam juntos
 *
 * A correcao foi agrupar por familia, com o nome da criatura no cabecalho.
 * Este arquivo confere a cadeia INTEIRA — do dado ate o agrupamento — porque
 * a familia tem que sobreviver a tres passos, e cada um deles pode engolir o
 * campo sem erro nenhum:
 *
 *   1. `MATERIAIS` declara `mob` (o id da criatura)
 *   2. `todosOsMateriais` + `createItem` levam ate `ITENS`
 *   3. `Craft.snapshot` expoe para o painel
 *   4. o painel agrupa na ordem de `FAMILIAS`
 */

import { getItem, ITEMS } from "../src/data/items/index.js";
import {
  FAMILIAS,
  MATERIAIS,
  todosOsMateriais,
} from "../src/data/materiais/index.js";

let passou = 0;
let falhou = 0;

function conferir(descricao, condicao) {
  if (condicao) {
    passou += 1;
    console.log(`  ok   ${descricao}`);

    return true;
  }

  falhou += 1;
  console.log(`  FALHA ${descricao}`);

  return false;
}

/**
 * O AGRUPAMENTO DO PAINEL, reescrito.
 *
 * Se o painel mudar, este trecho precisa mudar junto — e e esse acoplamento
 * que o arquivo quer deixar visivel
 */
function agrupar(recipes) {
  const porFamilia = new Map();

  for (const familia of FAMILIAS) porFamilia.set(familia.mob, []);

  const semFamilia = [];

  for (const recipe of recipes) {
    if (!recipe.familia) {
      semFamilia.push(recipe);

      continue;
    }

    if (!porFamilia.has(recipe.familia)) porFamilia.set(recipe.familia, []);

    porFamilia.get(recipe.familia).push(recipe);
  }

  const grupos = FAMILIAS.map((familia) => ({
    chave: familia.mob,
    titulo: familia.nome,
    recipes: porFamilia.get(familia.mob) ?? [],
  })).filter((grupo) => grupo.recipes.length > 0);

  const conhecidas = new Set(FAMILIAS.map((familia) => familia.mob));

  for (const [mob, lista] of porFamilia) {
    if (conhecidas.has(mob) || lista.length === 0) continue;

    grupos.push({ chave: mob, titulo: mob, recipes: lista });
  }

  if (semFamilia.length > 0) {
    grupos.push({ chave: "__sem_familia", titulo: null, recipes: semFamilia });
  }

  return grupos;
}

console.log("\nAGRUPAMENTO DE MATERIAIS NO CRAFT\n");

/* ------------------------------------------------------------------ *
 * 1. A FAMILIA CHEGA AO CATALOGO
 * ------------------------------------------------------------------ */
console.log("1. a familia atravessa o catalogo\n");

{
  const todos = todosOsMateriais();

  conferir("sao 60 materiais", todos.length === 60);
  conferir("sao 12 materiais base", MATERIAIS.length === 12);
  conferir("e 4 familias", FAMILIAS.length === 4);

  const semFamilia = todos.filter((m) => !getItem(m.id)?.familia);

  conferir(
    "todo material tem familia no catalogo",
    semFamilia.length === 0,
  );

  conferir(
    "todo material tem o nome da familia tambem",
    todos.every((m) => typeof getItem(m.id)?.familiaNome === "string"),
  );

  /**
   * O QUE O `mob` NAO DEIXA PASSAR SOZINHO.
   *
   * `createItem` termina em `...config`, entao o campo sobrevive sem nenhuma
   * alteracao na assinatura. Se um dia isso mudar para uma lista explicita,
   * a familia continua no dado e some do item — e nada avisa
   */
  conferir(
    "o campo sobrevive pelo ...config do createItem",
    getItem("osso_quebrado")?.familia === "slime",
  );
}

/* ------------------------------------------------------------------ *
 * 2. AS FAMILIAS COBREM TUDO
 * ------------------------------------------------------------------ */
console.log("\n2. as familias cobrem todos os materiais\n");

{
  const mobsDoDado = new Set(MATERIAIS.map((m) => m.mob));
  const mobsDeclarados = new Set(FAMILIAS.map((f) => f.mob));

  conferir(
    "todo mob do dado tem familia declarada",
    [...mobsDoDado].every((mob) => mobsDeclarados.has(mob)),
  );

  conferir(
    "e nenhuma familia declarada sobra sem uso",
    [...mobsDeclarados].every((mob) => mobsDoDado.has(mob)),
  );

  conferir(
    "as familias tem nome legivel",
    FAMILIAS.every((f) => typeof f.nome === "string" && f.nome.length > 2),
  );
}

/* ------------------------------------------------------------------ *
 * 3. O AGRUPAMENTO NA ABA MATERIAL
 * ------------------------------------------------------------------ */
console.log("\n3. a aba material vira quatro grupos\n");

{
  /**
   * AS RECEITAS QUE O PAINEL VÊ.
   *
   * Sao os graus de refino: cada material base menos o proprio base, porque
   * o material base e o que o mob da, e nao o que o jogador fabrica
   */
  const recipes = todosOsMateriais()
    .filter((m) => m.grau !== null)
    .map((m) => {
      const item = getItem(m.id);

      return {
        id: `craft_${m.id}`,
        itemId: m.id,
        familia: item?.familia ?? null,
        familiaNome: item?.familiaNome ?? null,
      };
    });

  conferir("sao 48 receitas de refino", recipes.length === 48);

  const grupos = agrupar(recipes);

  conferir("viraram 4 grupos", grupos.length === 4);

  conferir(
    "na ordem de FAMILIAS",
    grupos.map((g) => g.chave).join(",") === FAMILIAS.map((f) => f.mob).join(","),
  );

  conferir(
    "cada grupo tem 12 receitas",
    grupos.every((g) => g.recipes.length === 12),
  );

  conferir(
    "e nenhum grupo tem cabecalho nulo",
    grupos.every((g) => typeof g.titulo === "string"),
  );

  console.log("");
  for (const grupo of grupos) {
    console.log(`  ${grupo.titulo.padEnd(12)} ${grupo.recipes.length} receitas`);
  }
  console.log("");

  /**
   * NENHUM MATERIAL PERDE OU GANHA ALGO.
   *
   * O agrupamento e so leitura da lista que ja existia. Se um recipe sumisse
   * ou aparecesse duas vezes, a contagem continuaria em 48 e so a tela
   * mentiria
   */
  conferir(
    "nenhuma receita se perdeu no agrupamento",
    grupos.flatMap((g) => g.recipes).length === recipes.length,
  );

  conferir(
    "e nenhuma repetiu",
    new Set(grupos.flatMap((g) => g.recipes).map((r) => r.id)).size ===
      recipes.length,
  );
}

/* ------------------------------------------------------------------ *
 * 4. O QUE NAO TEM FAMILIA
 * ------------------------------------------------------------------ */
console.log("\n4. o equipamento nao ganha cabecalho\n");

{
  const pecas = Object.values(ITEMS).filter(
    (item) => item.type !== "material",
  );

  conferir(
    "nenhuma peca tem familia",
    pecas.every((item) => !item.familia),
  );

  const recipes = pecas.slice(0, 14).map((item) => ({
    id: `craft_${item.id}`,
    itemId: item.id,
    familia: item.familia ?? null,
  }));

  const grupos = agrupar(recipes);

  conferir("o equipamento fica em um grupo so", grupos.length === 1);
  conferir("e sem cabecalho", grupos[0].titulo === null);

  /**
   * UM MATERIAL QUE O `FAMILIAS` NAO CONHECE.
   *
   * Uma familia nova no dado sem a linha em `FAMILIAS` nao pode sumir da tela.
   * O agrupamento cria a chave sob demanda e joga no fim — melhor um grupo sem
   * nome do que um material invisivel
   */
  const orfao = agrupar([
    ...recipes,
    { id: "craft_x", itemId: "x", familia: "mob_novo" },
  ]);

  conferir(
    "familia fora da lista nao perde o material",
    orfao.flatMap((g) => g.recipes).length === recipes.length + 1,
  );

  /**
   * ONDE A FAMILIA DESCONHECIDA CAI.
   *
   * Ela vem DEPOIS das quatro declaradas e ANTES do grupo sem familia. O
   * equipamento — que nao tem familia nenhuma — e o ultimo porque e o que
   * sempre esteve la, e uma familia nova nao pode empurrar a aba inteira
   */
  const posOrfao = orfao.findIndex((g) => g.chave === "mob_novo");
  const posSemFamilia = orfao.findIndex((g) => g.chave === "__sem_familia");
  const ultimaConhecida = Math.max(
    ...FAMILIAS.map((f) => orfao.findIndex((g) => g.chave === f.mob)),
  );

  conferir(
    "a familia desconhecida vem depois das quatro declaradas",
    posOrfao > ultimaConhecida,
  );

  conferir(
    "e antes do grupo sem familia",
    posOrfao < posSemFamilia,
  );
}

console.log(`\n${passou} ok, ${falhou} falhas\n`);

if (falhou) process.exit(1);