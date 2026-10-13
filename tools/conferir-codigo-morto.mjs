/**
 * OS EXPORTS QUE NINGUEM IMPORTA.
 *
 * ## POR QUE ESTE ARQUIVO EXISTE
 *
 * Porque "exportado e nunca usado" e um julgamento, e um script que
 * responde so sim ou nao empurra a decisao para quem le. Este separa o que
 * e CODIGO MORTO do que e EXPORT DESNECESSARIO, e do que e CONTRATO
 *
 * ## E POR QUE ELE NAO APAGA NADA SOZINHO
 *
 * Porque apagar um export por busca de texto e o tipo de coisa que quebra em
 * silencio. Um simbolo pode ser lido por nome em string, por `import()`
 * dinamico, ou reexportado por um `export *`. Este ve texto, nao o grafo de
 * modulo: ele informa e quem decide
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function andar(dir, acc = []) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist"].includes(entrada.name)) continue;

    const caminho = join(dir, entrada.name);

    if (entrada.isDirectory()) andar(caminho, acc);
    else if (/\.(js|jsx|mjs)$/.test(entrada.name)) acc.push(caminho);
  }

  return acc;
}

const TODOS = [...andar("src"), ...andar("server"), ...andar("tools")];

const arquivos = TODOS.map((arq) => ({
  arq,
  rel: arq.replace(/\\/g, "/"),
  txt: readFileSync(arq, "utf8"),
}));

/**
 * CONTA AS OCORRENCIAS DO NOME, SEM A ARMADILHA DO `\b`.
 *
 * A fronteira de palavra impede `lerp` de contar dentro de `interpolacao`.
 * Ela e montada com `String.raw` porque um `\b` escrito num template literal
 * normal vira backspace no JavaScript — e o `RegExp` resultante nunca casa, o
 * que faz TODOS os simbolos parecerem mortos
 */
function contar(nome, texto) {
  const limite = new RegExp(String.raw`(^|[^A-Za-z0-9_$])${nome}([^A-Za-z0-9_$]|$)`, "g");

  return (texto.match(limite) || []).length;
}

/** O NOME APARECE COMO STRING ALGUM LUGAR? */
function comoPonteiro(nome, texto) {
  return new RegExp(`["'\`]\\s*${nome}\\b`).test(texto);
}

/**
 * A DECLARACAO INTEIRA, do `export` ate o fecha da chave ou do ponto e virgula.
 *
 * ## POR QUE IMPORTA
 *
 * Porque `export const ROTULO = {` ocupa uma linha e o objeto fecha dez
 * depois. Contando pela linha do `export`, o nome DENTRO do corpo — e o uso
 * em outra funcao do mesmo arquivo — passariam como "nenhuma ocorrencia", e
 * um simbolo em uso entraria na lista de morto
 */
function declaracao(texto, inicio) {
  let abre = 0;
  let viuChave = false;

  for (let i = inicio; i < texto.length; i++) {
    const ch = texto[i];

    if (ch === "{") { abre++; viuChave = true; }
    else if (ch === "}") abre--;

    if (viuChave && abre <= 0) return texto.slice(inicio, i + 1);

    if (ch === ";" && !viuChave) return texto.slice(inicio, i + 1);
  }

  return texto.slice(inicio);
}

/** INDICE DE TODO `export const|let|function|class NOME`, com o corpo junto */
function exportacoesDe({ rel, txt }) {
  const achados = [];

  for (const achado of txt.matchAll(/export\s+(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
    achados.push({
      nome: achado[1],
      rel,
      corpo: declaracao(txt, achado.index),
      onde: achado.index,
    });
  }

  return achados;
}

const producao = arquivos.filter((a) => !/\.test\./.test(a.rel));

const porNome = new Map();

for (const arquivo of producao) {
  for (const achado of exportacoesDe(arquivo)) {
    if (!porNome.has(achado.nome)) porNome.set(achado.nome, []);

    porNome.get(achado.nome).push({ ...achado, txt: arquivo.txt });
  }
}

const CONTRATO = /shared\/protocol\.js|server\/src\/config\.js/;

const relatorio = [];

for (const [nome, defs] of porNome) {
  const def = defs[0];

  let usos = 0;
  let emTeste = false;
  let ponteiro = false;

  for (const arquivo of arquivos) {
    const n = contar(nome, arquivo.txt);

    if (!n) continue;

    /**
     * A DECLARACAO PROPRIA E SUBTRAIDA INTEIRA.
     *
     * O `corpo` contem o nome uma vez no `export`. Subtrair so 1 contaria
     * as repeticoes DENTRO do proprio objeto como uso de fora, e o simbolo
     * pareceria vivo
     */
    const foraDaDeclaracao = arquivo.rel === def.rel ? n - contar(nome, def.corpo) : n;

    usos += foraDaDeclaracao;

    if (/\.test\./.test(arquivo.rel)) emTeste = true;
    if (comoPonteiro(nome, arquivo.txt)) ponteiro = true;
  }

  /** USADO DENTRO DO PROPRIO ARQUIVO: nao e morto, so nao precisa do `export` */
  const interno = contar(nome, def.txt) - contar(nome, def.corpo);

  relatorio.push({
    nome,
    def: def.rel,
    usos,
    interno,
    emTeste,
    ponteiro,
    contrato: CONTRATO.test(def.rel),
  });
}

const semUso = relatorio.filter((r) => r.usos === 0);

const mortos = semUso.filter((r) => !r.interno && !r.contrato);
const soInterno = semUso.filter((r) => r.interno && !r.contrato);
const contrato = semUso.filter((r) => r.contrato);

console.log(`\n  ${porNome.size} exports, ${semUso.length} sem uso externo\n`);

console.log(`  ## CODIGO MORTO (${mortos.length}) — apagar a declaracao\n`);

for (const m of mortos.sort((a, b) => a.def.localeCompare(b.def))) {
  console.log(`  ${m.nome.padEnd(28)} ${m.def}${m.emTeste ? "  [teste]" : ""}`);
}

console.log(`\n  ## SÓ O ` + "`export`" + ` É DEMAIS (${soInterno.length}) — apagar a palavra\n`);

for (const m of soInterno.sort((a, b) => a.def.localeCompare(b.def))) {
  console.log(`  ${m.nome.padEnd(28)} ${m.def}  (${m.interno} uso interno)`);
}

console.log(`\n  ## CONTRATO DE REDE (${contrato.length}) — deixar\n`);

for (const m of contrato) console.log(`  ${m.nome.padEnd(28)} ${m.def}`);

console.log("");