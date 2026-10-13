/**
 * O PADRAO DE TAMANHO E DE CENTRALIZACAO DOS ICONES DA HUD.
 *
 * ## O QUE ESTE CONFERE
 *
 * Que TODOS os icones de painel tem a mesma caixa, e que cada arte ja esta
 * recortada no tamanho do seu desenho
 *
 * ## POR QUE O RECORTE E A METADE DA CONFERENCIA
 *
 * Porque o `object-fit: contain` so iguala a CAIXA, nao o DESENHO. Com a
 * margem transparente da arte, cada icone ocupava uma fatia diferente de si
 * mesmo dentro dos 30px — e a barra ficava com icones de tamanhos diferentes,
 * mesmo com o CSS perfeito
 *
 * Entao ha duas metades: o CSS declara um tamanho so, e a arte nao tem
 * sobra. Se uma das duas mudar, a barra volta a ter icones diferentes
 *
 * ## POR QUE NAO CONFERE `scale` NEM `translate` AQUI
 *
 * Porque nenhuma regra por icone deveria existir. Um ajuste por imagem
 * encolheria uns e esticaria outros — foi exatamente o que aconteceu quando
 * o `scale` foi posto para centralizar, e o jeito foi cortar a arte
 */

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let ok = 0;
let falhas = 0;

function conferir(descricao, condicao, detalhe = "") {
  if (condicao) {
    ok++;
    console.log("  ok   " + descricao);
  } else {
    falhas++;
    console.log("  FALHA " + descricao + (detalhe ? "  (" + detalhe + ")" : ""));
  }
}

const css = readFileSync(join(RAIZ, "src/styles.css"), "utf8");

console.log("\n  O PADRAO DE TAMANHO DOS ICONES\n");

/** O `--icon-w` do `:root` */
const padrao = (() => {
  const m = /--icon-w:\s*(\d+)px/.exec(css);

  return m ? Number(m[1]) : null;
})();

conferir("o padrao --icon-w existe no :root", padrao !== null, String(padrao));
conferir("o padrao cabe dentro do botao", padrao !== null && padrao <= 34, String(padrao));

/** SO UMA REGRA COM ESSE SELETOR */
const regras = (css.match(/^\.hud-icon\s*\{/gm) || []).length;

conferir("existe so uma regra .hud-icon", regras === 1, regras + " encontradas");

/**
 * O TAMANHO DECLARADO NUM BLOCO CSS.
 *
 * ## POR QUE ACEITA `var()`
 *
 * Porque o `.hud-icon` nao escreve `30px`: escreve `var(--icon-w)`, que e o
 * ponto do padrao — um numero so, declarado no `:root`. Um verificador que
 * so lesse px literal acusaria falha num CSS que esta certo
 */
function valor(seletor, propriedade, texto = css) {
  const i = texto.indexOf(seletor + " {");

  if (i < 0) return null;

  const corpo = texto.slice(i, texto.indexOf("}", i));
  const achado = new RegExp(propriedade + ":\\s*([^;]+)").exec(corpo);

  if (!achado) return null;

  const bruto = achado[1].trim();

  if (bruto.startsWith("var(")) return bruto;

  const px = /^(-?[\d.]+)px$/.exec(bruto);

  return px ? Number(px[1]) : bruto;
}

const largura = valor(".hud-icon", "width");
const altura = valor(".hud-icon", "height");

const usaPadrao = (v) => typeof v === "string" && v.startsWith("var(--icon-w)");

conferir(
  ".hud-icon usa o padrao na largura",
  usaPadrao(largura),
  String(largura),
);
conferir(
  ".hud-icon usa o padrao na altura",
  usaPadrao(altura),
  String(altura),
);
conferir("a caixa do icone e a mesma nos dois eixos", largura === altura);

const imgLargura = valor(".hud-icon img", "width");
const imgAltura = valor(".hud-icon img", "height");

conferir(".hud-icon img preenche a caixa na largura", imgLargura === "100%", String(imgLargura));
conferir(".hud-icon img preenche a caixa na altura", imgAltura === "100%", String(imgAltura));

const flex = valor(".hud-icon", "flex");

conferir(
  "o icone nao encolhe dentro da coluna",
  flex === "0 0 var(--icon-w)",
  String(flex),
);

const glifo = (() => {
  const i = css.indexOf(".hud-btn .hud-icon--glyph {");

  if (i < 0) return null;

  const corpo = css.slice(i, css.indexOf("}", i));
  const m = /font-size:\s*(\d+)px/.exec(corpo);

  return m ? Number(m[1]) : null;
})();

conferir("o glifo acompanha o padrao", glifo !== null && glifo > padrao * 0.5, String(glifo));

/** O BOTAO NAO CRESCE, E A COLUNA NAO ANDA */
const btnH = (() => {
  const m = /--btn-h:\s*(\d+)px/.exec(css);

  return m ? Number(m[1]) : null;
})();

conferir("o botao e maior que o icone", btnH !== null && btnH > padrao, btnH + " vs " + padrao);

console.log("\n  E NENHUM AJUSTE POR ICONE\n");

const porIcone = [...css.matchAll(/\.hud-btn \.hud-icon--(\w+) img\s*\{([^}]*)\}/g)];

conferir(
  "nao ha regra por icone",
  porIcone.length === 0,
  porIcone.length + " encontradas",
);

conferir("nao ha scale em nenhum icone", !/\.hud-btn \.hud-icon--\w+ img\s*\{[^}]*scale/.test(css));
conferir("nao ha translate em nenhum icone", !/\.hud-btn \.hud-icon--\w+ img\s*\{[^}]*translate/.test(css));

console.log("\n  E A ARTE DE CADA ICONE JA ESTA RECORTADA\n");

/** AS ARTES, PELOS NOMES QUE O `hudIcons.js` USA */
function lerCaixa(caminho) {
  const buf = readFileSync(caminho);

  if (buf.readUInt32BE(0) !== 0x89504e47) return null;

  const largura_ = buf.readUInt32BE(16);
  const altura_ = buf.readUInt32BE(20);

  if (buf[24] !== 8 || buf[25] !== 6) return null;

  const partes = [];
  let i = 8;

  while (i < buf.length) {
    const tamanho = buf.readUInt32BE(i);

    if (buf.toString("ascii", i + 4, i + 8) === "IDAT") {
      partes.push(buf.subarray(i + 8, i + 8 + tamanho));
    }

    i += 12 + tamanho;
  }

  const dados = inflateSync(Buffer.concat(partes));
  const passo = largura_ * 4;

  function linha(y) {
    const base = y * (passo + 1);
    const filtro = dados[base];
    const atual = Buffer.from(dados.subarray(base + 1, base + 1 + passo));

    for (let x = 0; x < passo; x++) {
      const a = x >= 4 ? atual[x - 4] : 0;
      const b = y > 0 ? dados[base - passo + x] : 0;
      const c = x >= 4 && y > 0 ? dados[base - passo + x - 4] : 0;

      if (filtro === 1) atual[x] = (atual[x] + a) & 0xff;
      else if (filtro === 2) atual[x] = (atual[x] + b) & 0xff;
      else if (filtro === 3) atual[x] = (atual[x] + ((a + b) >> 1)) & 0xff;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);

        atual[x] = (atual[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
    }

    return atual;
  }

  let minX = largura_;
  let minY = altura_;
  let maxX = -1;
  let maxY = -1;
  let anterior = linha(0);

  for (let y = 0; y < altura_; y++) {
    let atual = anterior;

    if (y > 0) {
      const crua = linha(y);

      atual = Buffer.alloc(passo);

      for (let x = 0; x < passo; x++) atual[x] = (crua[x] + anterior[x]) & 0xff;
    }

    for (let x = 0; x < largura_; x++) {
      if (atual[x * 4 + 3] < 12) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    anterior = atual;
  }

  if (maxX < 0) return null;

  return {
    largura: largura_,
    altura: altura_,
    caixa: { w: maxX - minX + 1, h: maxY - minY + 1 },
  };
}

const catalogo = readFileSync(join(RAIZ, "src/data/hudIcons.js"), "utf8");

const pares = [...catalogo.matchAll(/(\w+):\s*new URL\(\s*"\.\.\/assets\/icons\/([^"]+)"/g)];

for (const [, id, arquivo] of pares) {
  let info = null;

  try {
    info = lerCaixa(join(RAIZ, "src/assets/icons", arquivo));
  } catch {
    // arquivo faltando
  }

  if (!info) {
    falhas++;
    console.log("  FALHA " + id + ": nao consegui ler " + arquivo);
    continue;
  }

  const { largura: L, altura: A, caixa } = info;

  const margemX = L - caixa.w;
  const margemY = A - caixa.h;

  const recortado = margemX <= 1 && margemY <= 1;

  if (recortado) ok++;
  else falhas++;

  console.log(
    "  " + (recortado ? "ok   " : "FALHA ") +
    id.padEnd(12) +
    (caixa.w + "x" + caixa.h).padEnd(12) +
    (recortado ? "no limite" : "sobra " + margemX + "x" + margemY),
  );
}

console.log("\n  " + ok + " ok, " + falhas + " falhas\n");

process.exit(falhas === 0 ? 0 : 1);