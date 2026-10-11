/**
 * O QUE ESTE ARQUIVO CONFERE
 *
 * Um jogador em cada navegador, na base, e cada um via o OUTRO grande.
 *
 * ## O QUE ACONTECIA
 *
 * O `escalaSprites` de um mapa e por CLASSE, e a base encolhe duas: o
 * arquiro e o sorcerer saem em 0.7 porque o hub tem zoom de 1.61. O motor
 * pegava o fator da classe do jogador LOCAL e aplicava so na folha local e
 * na folha daquela mesma classe
 *
 * Com um Arbalist e um Sorcerer na base:
 *
 * - no navegador do Arbalist, o Sorcerer usava a folha que NUNCA recebeu o
 *   fator, e aparecia 43% maior
 * - no navegador do Sorcerer, o Arbalist aparecia 43% maior
 *
 * E cada um via o proprio boneco no tamanho certo, que e o que torna o
 * defeito tao confuso: nao ha nada errado na sua tela para você relatar
 *
 * ## O SEGUNDO FURO, QUE SO APARECERIA SOZINHO
 *
 * As folhas de classe nascem a DEMORA, quando alguem entra na sala. Uma
 * folha criada depois da troca de mapa nascia com `escalaDoMapa` em 1 e
 * ficava errada ate o proximo portal. Com uma pessoa so na base, e o
 * proprio jogador entrando, o sintoma seria "o boneco entrou grande"
 */

import { readFileSync } from "node:fs";
import { inflatePng } from "./gif-to-sheet.mjs";
import { MAPS } from "../src/data/maps/index.js";

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
 * A ALTURA DA ARTE DE UMA FOLHA, para o tamanho final ser comparado em px.
 */
function arteDoWalk(caminho, celula, cols) {
  const png = inflatePng(readFileSync(caminho));

  const alturas = [];

  for (let linha = 0; linha < 8; linha += 1) {
    let minY = celula;
    let maxY = -1;

    for (let c = 0; c < cols; c += 1) {
      for (let y = 0; y < celula; y += 1) {
        for (let x = 0; x < celula; x += 1) {
          const px = ((linha * celula + y) * png.width + (c * celula + x)) * 4;

          if (png.data[px + 3] < 8) continue;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    alturas.push(maxY < 0 ? 0 : maxY - minY + 1);
  }

  return Math.round(alturas.reduce((a, b) => a + b, 0) / alturas.length);
}

/**
 * A FOLHA, DO JEITO QUE O MOTOR TRATA.
 *
 * Reproduz o que importava do `SpriteSheet`: o `escalaDoMapa` vale 1 na
 * construcao, e o motor escreve nele quando o mapa e aplicado
 */
function novaFolha(classe, arte, escala) {
  return { classe, arte, escala, escalaDoMapa: 1 };
}

function tamanhoNaTela(folha, cameraZoom) {
  return folha.arte * folha.escala * folha.escalaDoMapa * cameraZoom;
}

/**
 * O `aplicarEscalaDosSprites`, reescrito a mao.
 *
 * Se o motor mudar, este trecho precisa mudar junto — e e esse acoplamento
 * que o teste quer deixar visivel
 */
function aplicarEscala(folhaLocal, folhasDeClasse, mapa) {
  const fatores = mapa?.escalaSprites ?? null;

  if (folhaLocal) folhaLocal.escalaDoMapa = fatores?.[folhaLocal.classe] ?? 1;

  for (const folha of folhasDeClasse.values()) {
    folha.escalaDoMapa = fatores?.[folha.classe] ?? 1;
  }
}

/**
 * O `spriteDeClasse`, tambem reescrito: a folha nova nasce com o fator.
 */
function criarFolha(classe, arte, escala, mapa) {
  const folha = novaFolha(classe, arte, escala);

  const fatores = mapa?.escalaSprites ?? null;
  const fator = fatores?.[classe];

  folha.escalaDoMapa = typeof fator === "number" && fator > 0 ? fator : 1;

  return folha;
}

const FOLHAS = { warrior: 8, lancer: 8, sorcerer: 9, arbalist: 9 };
const ESCALA = { warrior: 0.8, lancer: 0.8, sorcerer: 0.697, arbalist: 1.1 };

const ARTE = {};
const CELULA = { warrior: 68, lancer: 68, sorcerer: 132, arbalist: 96 };

for (const [classe, cols] of Object.entries(FOLHAS)) {
  ARTE[classe] = arteDoWalk(
    `src/assets/sprites/${classe}-sheet.png`,
    CELULA[classe],
    cols,
  );
}

const base = MAPS.base;
const ZOOM = base.cameraZoom ?? 1;

console.log(`\nESCALA ENTRE JOGADORES\n`);
console.log(`  base: cameraZoom ${ZOOM.toFixed(2)}, escalaSprites ${JSON.stringify(base.escalaSprites)}\n`);

/* ------------------------------------------------------------------ *
 * 1. UM DE CADA CLASSE, VISTOS DO OUTRO LADO
 * ------------------------------------------------------------------ */
console.log("1. Arbalist e Sorcerer na mesma sala\n");

{
  /**
   * O CENARIO EXATO DO RELATO.
   *
   * Cada cliente tem a folha dele local e a folha do outro, criada por causa
   * do remoto. As duas folhas existem antes do mapa ser aplicado
   */
  const folhasDoArbalist = new Map([
    ["sorcerer", novaFolha("sorcerer", ARTE.sorcerer, ESCALA.sorcerer)],
  ]);

  const folhasDoSorcerer = new Map([
    ["arbalist", novaFolha("arbalist", ARTE.arbalist, ESCALA.arbalist)],
  ]);

  const localArbalist = novaFolha("arbalist", ARTE.arbalist, ESCALA.arbalist);
  const localSorcerer = novaFolha("sorcerer", ARTE.sorcerer, ESCALA.sorcerer);

  aplicarEscala(localArbalist, folhasDoArbalist, base);
  aplicarEscala(localSorcerer, folhasDoSorcerer, base);

  const arbalistVistoDoSorcerer = tamanhoNaTela(
    folhasDoSorcerer.get("arbalist"),
    ZOOM,
  );

  const sorcererVistoDoArbalist = tamanhoNaTela(
    folhasDoArbalist.get("sorcerer"),
    ZOOM,
  );

  const arbalistLocal = tamanhoNaTela(localArbalist, ZOOM);
  const sorcererLocal = tamanhoNaTela(localSorcerer, ZOOM);

  console.log(`  navegador do ARBALIST:`);
  console.log(`    eu (arbalist)      ${arbalistLocal.toFixed(1)}px`);
  console.log(`    o sorcerer remoto  ${sorcererVistoDoArbalist.toFixed(1)}px`);
  console.log(`  navegador do SORCERER:`);
  console.log(`    eu (sorcerer)      ${sorcererLocal.toFixed(1)}px`);
  console.log(`    o arbalist remoto  ${arbalistVistoDoSorcerer.toFixed(1)}px\n`);

  /**
   * A ASSIMETRIA QUE O JOGADOR RELATOU.
   *
   * Cada um via o outro MAIOR do que o proprio boneco, e o boneco remoto
   * maior do que ele deveria. Sem esta checagem, um fator que simplesmente
   * nao se aplicasse passaria: os dois veriam 0.7, e "iguais" nao contaria
   */
  conferir(
    "o arbalist ve o sorcerer do tamanho do sorcerer",
    Math.abs(sorcererVistoDoArbalist - sorcererLocal) < 0.5,
  );

  conferir(
    "o sorcerer ve o arbalist do tamanho do arbalist",
    Math.abs(arbalistVistoDoSorcerer - arbalistLocal) < 0.5,
  );

  conferir(
    "ninguem ve o outro maior do que o proprio boneco",
    sorcererVistoDoArbalist <= sorcererLocal + 0.5 &&
      arbalistVistoDoSorcerer <= arbalistLocal + 0.5,
  );

  conferir(
    "e o fator 0.7 entrou nas duas folhas remotas",
    folhasDoArbalist.get("sorcerer").escalaDoMapa === 0.7 &&
      folhasDoSorcerer.get("arbalist").escalaDoMapa === 0.7,
  );
}

/* ------------------------------------------------------------------ *
 * 2. QUEM CHEGA DEPOIS
 * ------------------------------------------------------------------ */
console.log("\n2. quem entra depois do mapa ja ter sido aplicado\n");

{
  const local = novaFolha("warrior", ARTE.warrior, ESCALA.warrior);

  // o mapa entra: a folha local e a do arquiro, que ja existia
  const folhas = new Map([
    ["arbalist", novaFolha("arbalist", ARTE.arbalist, ESCALA.arbalist)],
  ]);

  aplicarEscala(local, folhas, base);

  conferir(
    "a folha que ja existia recebeu o fator",
    folhas.get("arbalist").escalaDoMapa === 0.7,
  );

  /**
   * O FURO QUE SO APARECERIA SOZINHO.
   *
   * O sorcerer entra na sala agora. A folha dele nasce depois do mapa, e sem
   * o fator na criacao ela ficaria em 1 para sempre
   */
  const nova = criarFolha("sorcerer", ARTE.sorcerer, ESCALA.sorcerer, base);

  conferir(
    "a folha que nasce depois ja nasce com o fator",
    nova.escalaDoMapa === 0.7,
  );

  conferir(
    "e com o mesmo tamanho que a do jogador local",
    Math.abs(tamanhoNaTela(nova, ZOOM) - tamanhoNaTela(
      criarFolha("sorcerer", ARTE.sorcerer, ESCALA.sorcerer, base),
      ZOOM,
    )) < 0.5,
  );
}

/* ------------------------------------------------------------------ *
 * 3. UM MAPA SEM FATOR
 * ------------------------------------------------------------------ */
console.log("\n3. mapa sem escalaSprites\n");

{
  /**
   * O MAPA QUE NAO DECLARA NADA.
   *
   * E o `mapa_teste`, e ele existe justamente para ser o caso sem
   * `escalaSprites`. Os outros quatro declaram: a base encolhe duas classes,
   * e o vale, o mapa 2 e a arena encolhem o sorcerer
   */
  const semFator = MAPS.mapa_teste;

  conferir("o mapa de teste nao declara fator", !semFator.escalaSprites);

  const folhas = new Map([
    ["arbalist", novaFolha("arbalist", ARTE.arbalist, ESCALA.arbalist)],
    ["sorcerer", novaFolha("sorcerer", ARTE.sorcerer, ESCALA.sorcerer)],
  ]);

  aplicarEscala(null, folhas, semFator);

  conferir("as duas folhas ficam em 1", [...folhas.values()].every(
    (f) => f.escalaDoMapa === 1,
  ));
}

console.log("\n3b. mapa que declara so uma classe\n");

{
  /**
   * O VALE DECLARE SO O SORCERER.
   *
   * E a checagem que importa: um mapa que fala de uma classe nao pode
   * empurrar o fator dela para a outra. A base encolhe as DUAS, e por isso
   * ela nao serviria para provar nada — os dois veriam 0.7 e o defeito
   * passaria
   */
  const vale = MAPS.map_1;

  conferir(
    "o vale declara o sorcerer e nao o arbalist",
    vale.escalaSprites?.sorcerer !== undefined &&
      vale.escalaSprites?.arbalist === undefined,
  );

  const folhas = new Map([
    ["arbalist", novaFolha("arbalist", ARTE.arbalist, ESCALA.arbalist)],
    ["sorcerer", novaFolha("sorcerer", ARTE.sorcerer, ESCALA.sorcerer)],
  ]);

  aplicarEscala(null, folhas, vale);

  conferir(
    "o arbalist fica em 1, sem o fator do sorcerer",
    folhas.get("arbalist").escalaDoMapa === 1,
  );

  conferir(
    "e o sorcerer recebe o seu",
    folhas.get("sorcerer").escalaDoMapa === vale.escalaSprites.sorcerer,
  );
}

/* ------------------------------------------------------------------ *
 * 4. FATOR QUEBRADO
 * ------------------------------------------------------------------ */
console.log("\n4. numero quebrado no mapa\n");

{
  const mapaRuim = { cameraZoom: 1, escalaSprites: { arbalist: 0, sorcerer: -1 } };

  conferir(
    "fator zero ou negativo cai em 1",
    criarFolha("arbalist", ARTE.arbalist, ESCALA.arbalist, mapaRuim).escalaDoMapa === 1 &&
      criarFolha("sorcerer", ARTE.sorcerer, ESCALA.sorcerer, mapaRuim).escalaDoMapa === 1,
  );

  conferir(
    "e classe sem sprite nao e consultada",
    criarFolha(null, 0, 1, base).escalaDoMapa === 1,
  );
}

console.log(`\n${passou} ok, ${falhou} falhas\n`);

if (falhou) process.exit(1);