/**
 * Gerador de equipamento por classe.
 *
 * Escreve o bloco de um item de equipamento em
 * `src/data/craft/index.js`, com as cinco raridades ja escaladas.
 *
 * Por que um comando e nao um script com lista dentro: o destino e
 * um arquivo de dados legivel, e o valor esta em editar a receita a
 * mao depois. O comando monta a primeira versao, que e a parte
 * repetitiva, e deixa as ajuste de design para quem decide o
 * balanceamento.
 *
 * Como usar:
 *
 *   node tools/gerar-equipamento.mjs
 *     lista as classes e o que cada uma pode receber
 *
 *   node tools/gerar-equipamento.mjs --classe arbalist
 *     a linha de arma daquela classe, com a receita pronta
 *
 *   node tools/gerar-equipamento.mjs --classe arbalist --dry
 *     mostra o bloco sem escrever no arquivo
 *
 * O `--dry` e o default de seguranca: o comando escreve no arquivo de
 * dados, e um `--dry` explicito evita sobrescrever receita ajustada a
 * mao sem querer.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  gerarReceitaEquipamento,
} from "../src/data/craft/gerarEquipamento.js";
import {
  CLASS_WEAPON_KINDS,
} from "../src/data/items/index.js";
import {
  CHARACTER_CLASSES,
} from "../src/data/characters/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = path.join(
  HERE,
  "..",
  "src",
  "data",
  "craft",
  "index.js",
);

/**
 * O marcador onde o bloco novo entra.
 *
 * Fica DEPOIS do arco escrito a mao, entao uma receita gerada nunca
 * entra antes dele e o arquivo continua abrindo na ordem de leitura:
 * materiais primeiro, equipamento depois.
 */
const ANCORA = "  /* ---- equipamento gerado: nao editar a mao ---- */";

const args = process.argv.slice(2);

/**
 * Le a flag tanto como `--classe x` quanto como `--classe=x`.
 *
 * O espaco e a forma de escrever de verdade na linha de comando, e o
 * `=` resolve a interface com o `valor`/`flag` abaixo. Sem o espaco,
 * `--classe` virava flag booleana e o comando caia na listagem.
 */
function flag(nome) {
  if (args.includes(nome)) return true;

  return args.some((arg) => arg.startsWith(`${nome}=`));
}

function valor(nome, padrao = null) {
  const comIgual = args.find((arg) =>
    arg.startsWith(`${nome}=`),
  );

  if (comIgual) {
    return comIgual.slice(nome.length + 1);
  }

  const pos = args.indexOf(nome);

  if (pos === -1) return padrao;

  const seguinte = args[pos + 1];

  // a proxima flag e outra flag, entao o valor nao existe
  if (seguinte === undefined || seguinte.startsWith("--")) {
    return padrao;
  }

  return seguinte;
}

/**
 * Como cada item de equipamento nasce.
 *
 * O `nomeBase` e o que o gerador nao inventa: o nome, o icone e os
 * stats sao design, nao aritmetica. O gerador monta a RECIPTA, e o
 * `kind`/`slot`, que sao a trava de classe. Os stats sao um
 * multiplicador do `statsBase` da classe, porque um arco e uma espada
 * nao tem o mesmo ATQ e isso se escreve uma vez por classe.
 */
const MODELO = {
  weapon: {
    materiais: ["baixo", "alto"],
    base: 2,
    type: "weapon",
    slot: null,
  },
  armor: {
    materiais: ["baixo", "medio", "alto"],
    base: 3,
    type: "armor",
    slot: "chest",
  },
  trinket: {
    materiais: ["medio", "alto", "alto2"],
    base: 1,
    type: "trinket",
    slot: null,
  },
};

/** o texto do bloco, no formato do arquivo de receitas */
function blocoDeReceita(receita) {
  const linha = (rarity) => {
    const { coins, ingredients } = receita[rarity];

    const lista = ingredients
      .map(
        (ing) => `i("${ing.itemId}", ${ing.count})`,
      )
      .join(", ");

    return `${rarity}: { coins: ${coins}, ingredients: [${lista}] }`;
  };

  const partes = [
    "  {",
    `    itemId: "${receita.itemId}",`,
    `    coins: ${receita.coins},`,
    `    ingredients: [${receita.ingredients
      .map((ing) => `i("${ing.itemId}", ${ing.count})`)
      .join(", ")}],`,
    `    ${linha("common")},`,
  ];

  for (const rarity of ["uncommon", "rare"]) {
    partes.push(`    ${linha(rarity)},`);
  }

  for (const rarity of ["epic", "legendary"]) {
    const { coins, ingredients } = receita[rarity];

    partes.push(`    ${rarity}: {`);
    partes.push(`      coins: ${coins},`);
    partes.push("      ingredients: [");
    partes.push(
      ...ingredients.map(
        (ing) => `        i("${ing.itemId}", ${ing.count}),`,
      ),
    );
    partes.push("      ],");
    partes.push("    },");
  }

  partes.push("  },");

  return partes.join("\n");
}

/** o que a classe pode receber, e a familia que trava o item */
function planoDaClasse(classId) {
  const kinds = CLASS_WEAPON_KINDS[classId] ?? [];

  return kinds.map((kind) => ({
    kind,
    tipo: "weapon",
    ...MODELO.weapon,
  }));
}

function listar() {
  console.log("Classes e o equipamento que cada uma pode ter:\n");

  for (const classe of CHARACTER_CLASSES) {
    const plano = planoDaClasse(classe.id);

    console.log(`  ${classe.id} (${classe.name})`);

    if (plano.length === 0) {
      console.log("    sem familia de arma definida");
      continue;
    }

    for (const item of plano) {
      console.log(`    ${item.tipo.padEnd(8)} kind=${item.kind}`);
    }
  }

  console.log(
    "\nPara gerar a receita de uma:\n" +
      "  node tools/gerar-equipamento.mjs --classe <id> --tipo weapon",
  );
}

function gerar(classeId, tipo) {
  const classe = CHARACTER_CLASSES.find(
    (entry) => entry.id === classeId,
  );

  if (!classe) {
    console.error(`Classe desconhecida: ${classeId}`);
    console.error(
      `Classes: ${CHARACTER_CLASSES.map((c) => c.id).join(", ")}`,
    );
    process.exit(1);
  }

  const modelo = MODELO[tipo];

  if (!modelo) {
    console.error(
      `Tipo desconhecido: ${tipo}. Use: ${Object.keys(MODELO).join(", ")}`,
    );
    process.exit(1);
  }

  if (flag("--ajuda") || flag("-h") || flag("--help")) {
    console.log(uso());
    return;
  }

  const kinds = CLASS_WEAPON_KINDS[classeId] ?? [];

  // o `kind` decide a trava de classe. Sem ele a receita sairia sem
  // dono e o item apareceria para todo mundo, entao o comando exige
  // que seja a familia que a classe trabalha — e nao qualquer uma
  // a chave da flag e COM o prefixo: `valor("--kind")`. Sem o
  // prefixo, `--kind` e `--kind sword` nao casavam, o `kind` ficava
  // nulo e a checagem de familia era pulada — o comando aceitaria
  // arco para o guerreiro em silencio
  const kind = valor("--kind") ?? kinds[0] ?? null;

  if (modelo.type === "weapon") {
    if (!kinds.includes(kind)) {
      console.error(
        `A classe ${classeId} nao trabalha a familia ${kind}. ` +
          `Dela: ${kinds.join(", ") || "(nenhuma)"}`,
      );
      process.exit(1);
    }
  }

  // o id pode vir como `--id x` ou como `--id=x`
  const itemId = valor("--id") ?? `${classeId}_${tipo}`;

  const receita = gerarReceitaEquipamento({
    itemId,
    base: Number(valor("--base", modelo.base)),
    materiais: modelo.materiais,
    coins: Number(valor("--coins", 0)),
  });

  const bloco = blocoDeReceita(receita);

  console.log(`Receita de ${itemId} para ${classeId}:\n`);
  console.log(bloco);

  if (flag("--dry")) {
    console.log("\n--dry: nada foi escrito.");
    return;
  }

  const fonte = fs.readFileSync(RECIPES_PATH, "utf8");

  if (fonte.includes(`itemId: "${itemId}"`)) {
    console.error(
      `\nA receita de ${itemId} ja existe. Remova-a antes de gerar de novo.`,
    );
    process.exit(1);
  }

  if (!fonte.includes(ANCORA)) {
    console.error(
      `O marcador nao foi encontrado em ${RECIPES_PATH}.\n` +
        `Procurado: ${ANCORA}`,
    );
    process.exit(1);
  }

  /**
   * O marcador e RECRIADO no fim da lista, nao consumido.
   *
   * A primeira versao trocava o marcador pelo bloco novo, e o comando
   * so funcionava uma vez: na segunda geracao o marcador tinha
   * desaparecido e o comando recusava. Quem误区 sobre o comentario
   * e que ele e do "nao editar a mao" continua verdadeiro para o
   * bloco que acabou de entrar, entao o marcador volta logo depois
   */
  const saida = fonte.replace(ANCORA, `${bloco}\n\n${ANCORA}`);

  fs.writeFileSync(RECIPES_PATH, saida, "utf8");

  console.log(`\nEscrito em ${RECIPES_PATH}`);
}

const uso = () =>
  [
    "",
    "  node tools/gerar-equipamento.mjs",
    "    lista as classes e a familia de arma de cada uma",
    "",
    "  node tools/gerar-equipamento.mjs --classe arbalist",
    "    a receita de arma daquela classe, com as cinco raridades",
    "",
    "  node tools/gerar-equipamento.mjs --classe warrior --tipo weapon --id espada_x --dry",
    "    mostra o bloco sem escrever no arquivo de dados",
    "",
    "  Flags:",
    "    --classe   id da classe: warrior, lancer, sorcerer, arbalist",
    "    --tipo     weapon, armor ou trinket",
    "    --id       id do item. Padrao: <classe>_<tipo>",
    "    --kind     familia da arma. Padrao: a da classe",
    "    --base     quantidade base do material inicial",
    "    --coins    moeda cobrada na receita",
    "    --dry      nao escreve, so mostra",
    "    --ajuda    esta ajuda",
    "",
    "  O comando escreve a RECEITA em src/data/craft/index.js.",
    "  O item correspondente ainda e criado a mao em",
    "  src/data/items/index.js: a receita sem o item nao aparece na",
    "  aba de equipamento, porque o craft classifica pelo item.",
  ].join("\n");

const classeId = valor("--classe");
const tipo = valor("--tipo", "weapon");

if (flag("--ajuda") || flag("-h") || flag("--help")) {
  console.log(uso());
} else if (!classeId) {
  listar();
} else {
  gerar(classeId, tipo);
}
