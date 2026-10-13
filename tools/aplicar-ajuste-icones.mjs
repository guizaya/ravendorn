/**
 * CENTRALIZA AS ARTES SEM MEXER NO TAMANHO DELAS.
 *
 * ## O QUE ESTAVA ERRADO NA TENTATIVA ANTERIOR
 *
 * Cada icone tinha um `scale` proprio: 1.103 no market, 0.895 no rank. Isso
 * centralizava, mas deixava um icone visivelmente maior que o outro — e foi
 * exatamente o que o jogador reclamou
 *
 * ## POR QUE NAO PRECISA DE SCALE
 *
 * Porque o `object-fit: contain` ja encolhe a arte inteira para 30px, e
 * qualquer `scale` diferente de 1 quebra a igualdade de tamanho entre os
 * icones. O desenho de cada um tem um tamanho proprio e isso e do designer;
 * a unica coisa errada e a POSICAO dele dentro da caixa
 *
 * Entao o ajuste e so `translate`: devolve o desenho ao meio sem estica-lo
 *
 * ## POR QUE O VALOR NAO E UM PALpite
 *
 * E o deslocamento entre o centro do desenho e o centro da caixa, medido do
 * canal alpha do PNG
 */

import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CAIXA = 30;

function lerCaixa(caminho) {
  const buf = readFileSync(caminho);

  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  if (buf[24] !== 8 || buf[25] !== 6) return null;

  const largura = buf.readUInt32BE(16);

  /**
   * A ALTURA DA ARTE, QUE O LAÇO DE PIXELS PRECISA.
   *
   * E diferente da largura em arte que nao e quadrada, e usar a largura como
   * limite de linhas parava antes do fim
   */
  const altura = buf.readUInt32BE(20);

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
  const passo = largura * 4;

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

  let minX = largura;
  let minY = 1e9;
  let maxX = -1;
  let maxY = -1;
  let anterior = linha(0);

  /**
 * O LAÇO VARRE AS LINHAS PELA ALTURA DA IMAGEM.
 *
 * Com `largura` no lugar, uma arte mais alta que larga (o `rank` e 254x301)
 * parava 47 linhas antes do fim e a margem de baixo saia errada
 */
for (let y = 0; y < altura; y++) {
    let atual = anterior;

    if (y > 0) {
      const crua = linha(y);

      atual = Buffer.alloc(passo);

      for (let x = 0; x < passo; x++) atual[x] = (crua[x] + anterior[x]) & 0xff;
    }

    for (let x = 0; x < largura; x++) {
      if (atual[x * 4 + 3] < 12) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    anterior = atual;
  }

  return { largura, altura, w: maxX - minX + 1, h: maxY - minY + 1, x: minX, y: minY };
}

const catalogo = readFileSync(join(RAIZ, "src/data/hudIcons.js"), "utf8");

const pares = [...catalogo.matchAll(/(\w+):\s*new URL\(\s*"\.\.\/assets\/icons\/([^"]+)"/g)]
  .map((m) => [m[1], m[2]]);

const L = [];

L.push("");
L.push("/* ===================================================================");
L.push("   OS ICONES DOS BOTOES DE PAINEL");
L.push("   ===================================================================");
L.push("");
L.push("   O `.hud-icon` era de 24px dentro de um `.hud-btn` de 38px: sobrando 7px");
L.push("   de cada lado. Agora e de 30px, e o botao continua com 38px");
L.push("");
L.push("   O botao NAO cresce porque os sete botoes sao posicionados por");
L.push("   `calc(12px + var(--btn-h) + var(--btn-gap))`: um degrau por botao. Mexer no");
L.push("   `--btn-h` move a coluna inteira ate a barra de acoes do rodape. O icone e");
L.push("   o unico numero que cresce sem empurrar nada");
L.push("");
L.push("   E o glifo sobe junto porque e um caractere de texto, e nao uma imagem: quem");
L.push("   define o tamanho dele e o `font-size`");
L.push("   */");
L.push("");
L.push(".hud-btn .hud-icon {");
L.push("  width: 30px;");
L.push("  height: 30px;");
L.push("}");
L.push("");
L.push(".hud-btn .hud-icon--glyph {");
L.push("  font-size: 19px;");
L.push("}");
L.push("");
L.push("/* -------------------------------------------------------------------");
L.push("   A CENTRALIZACAO DAS ARTES");
L.push("");
L.push("   O botao e o icone ja usam `place-items: center`, e o `img` usa");
L.push("   `object-fit: contain`. A centralizacao do CSS esta CORRETA: o que sai");
L.push("   torto e a arte");
L.push("");
L.push("   Cada icone e um PNG quadrado com o desenho no meio e uma faixa");
L.push("   transparente em volta, e a faixa NAO e igual. O `contain` centraliza a");
L.push("   arte INTEIRA, faixa inclusa, entao o desenho fica fora do meio do botao");
L.push("");
L.push("   Aqui so desloca. NAO ha `scale` em nenhuma regra, e essa e a parte");
L.push("   importante: um `scale` por icone centralizaria, mas encolheria uns e");
L.push("   esticaria outros, e a barra passaria a ter icones de tamanhos diferentes");
L.push("");
L.push("   Os numeros sao o deslocamento entre o centro do desenho e o centro da");
L.push("   caixa, medido do canal alpha de cada PNG por");
L.push("   `tools/conferir-margem-icones.mjs`");
L.push("   ------------------------------------------------------------------- */");

for (const [id, arquivo] of pares) {
  const c = lerCaixa(join(RAIZ, "src/assets/icons", arquivo));

  if (!c) continue;

  /** O CENTRO DO DESENHO, EM PX DE TELA: A ARTE CABE EXATAMENTE NA CAIXA */
  const centroX = ((c.x + c.w / 2) / c.largura) * CAIXA;

  /**
   * O CENTRO VERTICAL USA A ALTURA DA ARTE, E NAO A LARGURA.
   *
   * Sao iguais em quase toda arte, e por isso o erro passa: com `rank`
   * (254x301) a conta pela largura dava `-0.66px` e a certa dava `-0.47px`.
   * Com `collection`, cuja margem e assimetrica, a conta errada dava
   * `0.06px` — o verificador acusou
   */
  const centroY = ((c.y + c.h / 2) / c.altura) * CAIXA;

  const tx = Number((-(centroX - CAIXA / 2)).toFixed(2));
  const ty = Number((-(centroY - CAIXA / 2)).toFixed(2));

  L.push("");
  L.push("/* " + id + ": desenho de " + c.w + "x" + c.h + " em " + c.largura + ". */");
  L.push(".hud-btn .hud-icon--" + id + " img {");
  L.push("  translate: " + tx + "px " + ty + "px;");
  L.push("}");
}

const CAMINHO = join(RAIZ, "src/styles.css");
const css = readFileSync(CAMINHO, "utf8");

/** CORTA O BLOCO ANTERIOR, DO PRIMEIRO COMENTARIO DE ICONE AO FIM */
const inicio = css.indexOf("/* ===================================================================\n   OS ICONES DOS BOTOES DE PAINEL");

if (inicio < 0) {
  console.log("\n  nao achei o bloco anterior\n");
  process.exit(1);
}

writeFileSync(CAMINHO, css.slice(0, inicio).trimEnd() + "\n" + L.join("\n") + "\n", "utf8");

console.log("\n  centralizado sem scale, " + pares.length + " icones\n");