/**
 * O ICONE DOS BOTOES CRESCE, E O BOTAO NAO.
 *
 * ## POR QUE UM VERIFICADOR PARA UM NUMERO
 *
 * Porque a conta e o que quebra em silencio. O botao e posicionado por
 * `calc(12px + var(--btn-h) + var(--btn-gap))`, um degrau por botao: se o
 * `--btn-h` mudar, a coluna inteira desce e a ultima caixa passa por cima da
 * barra de acoes do rodape. E um defeito que so aparece na tela larga, com
 * os sete botoes abertos
 *
 * ## E POR QUE O GLIFO PRECISA DA MESMA REGRA
 *
 * Porque um glifo e um caractere de texto: o que define o tamanho dele e o
 * `font-size`, nao o `width`. Sem a regra do glifo, os botoes que ainda
 * usam letra ficariam com 15px ao lado de arte de 30px, e a coluna pareceria
 * com metade dos botoes quebrados
 */

import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CSS = readFileSync(join(RAIZ, "src/styles.css"), "utf8");

let ok = 0;
let falhas = 0;

function conferir(condicao, mensagem, detalhe) {
  if (condicao) {
    ok++;
    console.log("  ok    " + mensagem);
    return;
  }
  falhas++;
  console.log("  FALHA " + mensagem);
  if (detalhe !== undefined) console.log("         " + detalhe);
}

/**
 * O TAMANHO DECLARADO NUM BLOCO CSS.
 *
 * ## POR QUE ACEITA `var()`
 *
 * Porque o `.hud-icon` nao escreve `30px`: escreve `var(--icon-w)`, que e o
 * ponto do padrao — um numero so, no `:root`. Um verificador que so lesse px
 * literal acusaria falha num CSS que esta certo
 *
 * ## E POR QUE `.hud-icon` SEM O `.hud-btn`
 *
 * Porque a regra e unica e vale para todos os usos do icone, e nao so para os
 * botoes de painel. O `SkillIcon` usa o mesmo `.hud-icon`, e um seletor
 * `.hud-btn .hud-icon` deixaria o icone dele com o tamanho antigo
 */
function valor(seletor, propriedade, texto = CSS) {
  const i = texto.indexOf(seletor + " {");

  if (i < 0) return null;

  const corpo = texto.slice(i, texto.indexOf("}", i));
  const achado = new RegExp(propriedade + ":\\s*([^;]+)").exec(corpo);

  if (!achado) return null;

  const bruto = achado[1].trim();

  if (bruto.startsWith("var(")) {
    const m = /var\(--([\w-]+)\)/.exec(bruto);

    return m ? { variavel: m[1], px: Number((/--[\w-]+:\s*(\d+)px/.exec(CSS) || [])[1]) } : null;
  }

  const px = /^(-?[\d.]+)px$/.exec(bruto);

  return px ? Number(px[1]) : bruto;
}

/** O VALOR DE UMA VARIAVEL DO `:root` */
function variavel(nome, texto = CSS) {
  const m = new RegExp("--" + nome + ":\\s*(\\d+)px").exec(texto);

  return m ? Number(m[1]) : null;
}

console.log("\n  O ICONE DOS BOTOES DE PAINEL\n");

const BTN_W = 38;
const BTN_H = 38;

const base = valor(".hud-btn", "width");
const baseH = valor(".hud-btn", "height");

conferir(base === BTN_W, "o botao base continua com " + BTN_W + "px de largura", `ficou ${base}px`);
conferir(baseH === BTN_H, "o botao base continua com " + BTN_H + "px de altura", `ficou ${baseH}px`);

const icone = variavel("icon-w");
const regraIcone = valor(".hud-icon", "width");
const regraIconeH = valor(".hud-icon", "height");

conferir(icone !== null, "a regra do icone existe", "nao achei `.hud-icon`");
conferir(regraIcone === icone, "a caixa usa o padrao na largura", String(regraIcone));
conferir(regraIconeH === icone, "a caixa usa o padrao na altura", String(regraIconeH));
conferir(icone === regraIconeH, "o icone e quadrado", `${icone} x ${regraIconeH}`);

console.log("\n  O ICONE CRESCEU?\n");

const ANTIGO = 24;

conferir(icone > ANTIGO, `o icone passou de ${ANTIGO}px`, `esta em ${icone}px`);

console.log("\n  E CABE DENTRO DO CIRCULO?\n");

/**
 * O QUE FAZ O ICONE ENCOSTAR NA MOLDURA
 *
 * O botao e um circulo de 38px com borda de 1px. O canto de um quadrado
 * de lado `i` dentro dele fica a `38/sqrt(2) - i/sqrt(2)` do centro ate a
 * borda â€” que e `(38 - i) / 1.414`
 *
 * Com folga menor que a borda de 1px, o canto do desenho passa por cima da
 * moldura nas diagonais, que e onde o olho repara primeiro
 */
const Borda = 1;

conferir(icone < BTN_W, "o icone e menor que o botao", `${icone}px dentro de ${BTN_W}px`);

const folgaLateral = (BTN_W - icone) / 2;

conferir(folgaLateral >= 2, "sobra pelo menos 2px de cada lado", `${folgaLateral}px`);

console.log("\n  E O GLIFO ACOMPANHA?\n");

/**
 * O GLOFO VIVO NO `.hud-icon--glyph`, E NAO NO `.hud-btn .hud-icon--glyph`.
 *
 * Porque o glifo e um `span` com texto, e ele vale para qualquer icone sem
 * arte — nao so para os botoes. O seletor com `.hud-btn` deixaria o glifo do
 * rodape com a letra antiga
 */
const glifo = valor(".hud-icon--glyph", "font-size");
const glifoAntigo = 15;

conferir(glifo !== null, "a regra do glifo existe");
conferir(glifo > glifoAntigo, `o glifo passou de ${glifoAntigo}px`, `esta em ${glifo}px`);

/**
 * O GLIFO E O ICONE DEVEM PARECER DO MESMO TAMANHO
 *
 * A razao aqui e a da arte: um glifo de 19px ocupa uma caixa de cerca de
 * 14px, e um icone de 30px ocupa 30. Para o olho, os dois ficam com o mesmo
 * peso na coluna. O numero exato nao importa â€” o que importa e o glifo
 * NAO ter ficado com a letra pequena de antes, que era o defeito
 */
conferir(
  glifo / icone > 0.5 && glifo / icone < 0.8,
  "o glifo esta na mesma escala visual do icone",
  `glifo ${glifo}px para icone ${icone}px (razao ${(glifo / icone).toFixed(2)})`,
);

console.log("\n  A COLUNA DE BOTOES NAO SE MOVEU?\n");

/** O PASSO VERTICAL DA COLUNA, que depende do tamanho do botao */
const passo = /--btn-h:\s*(\d+)px/.exec(CSS);

conferir(passo !== null, "o passo da coluna esta declarado");
conferir(
  Number(passo?.[1]) === BTN_H,
  "o passo da coluna ainda bate com a altura do botao",
  `--btn-h ${passo?.[1]}px para um botao de ${BTN_H}px`,
);

console.log(`\n  ${ok} ok, ${falhas} falhas\n`);

process.exit(falhas ? 1 : 0);