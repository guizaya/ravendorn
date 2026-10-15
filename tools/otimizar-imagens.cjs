/**
 * OTIMIZADOR DE IMAGENS
 *
 * Regra: o limite vem do TAMANHO QUE A ARTE APARECE NA TELA, nao de um
 * numero unico. Icone de 44px nao precisa de 8000px de origem.
 *
 * O que NAO e tocado:
 * - GIF (animacao; o sharp nao preserva quadro a quadro)
 * - sprites/ e tilesets de terreno (pixel art e grade de tile)
 * - props, npc e cursor (desenhados no canvas em escala de mundo)
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SKIP_DIRS = /node_modules|\.output|[\\/]dist[\\/]|\.git/;

/** O MAIOR LADO PERMITIDO, por arquivo. `null` = so recomprimir, sem mexer no tamanho. */
function limitePara(arquivo) {
  const f = arquivo.replace(/\\/g, "/");

  if (f.startsWith("front_rpg/src/assets/")) {
    if (f.endsWith("/project/logo.png")) return 256; // aparece com 68px
    if (f.endsWith("/project/fav_icon.png")) return 180; // favicon nunca passa de 180
    if (f.endsWith("/diamante.png")) return 128; // aparece com 11 a 15px
    if (f.endsWith("/metamask.png")) return 128; // aparece com 18px
    if (f.endsWith("/world-map.png")) return 1600; // mapa do dialogo, bem maior
    if (f.endsWith("/world-map-dialog.png")) return 1200;
    if (/\.gif$/.test(f)) return null;
    return 1400; // fotos de classe
  }

  // Item, material, pocao, projeteil: 44px no slot, 68px na arte maior
  if (f.startsWith("src/assets/Items/")) return 256;

  // Icone de HUD e moeda: de 11px no slot a ~120px no painel
  if (f.startsWith("src/assets/icons/")) return 256;

  // Portal: PORTAL_SIZE e 192px, com folga para tela retina
  if (f.startsWith("src/assets/portais/")) return 512;

  // Tileset de terreno: a grade de tile eo que segura o desenho. Mexer no
  // tamanho quebra o alinhamento. So recomprime.
  if (f.startsWith("src/assets/terrain/")) return null;

  return null; // sprites, props, npc, cursor: nao toca
}

function andar(raiz, saida = []) {
  for (const e of fs.readdirSync(raiz, { withFileTypes: true })) {
    if (SKIP_DIRS.test(path.join(raiz, e.name))) continue;
    const p = path.join(raiz, e.name);
    if (e.isDirectory()) andar(p, saida);
    else if (/\.(png|jpg|jpeg)$/i.test(e.name)) saida.push(p);
  }
  return saida;
}

(async () => {
  const alvos = [...andar("front_rpg/src"), ...andar("src")];

  let antes = 0, depois = 0;
  let mexidos = 0, pulados = 0;
  const ganhos = [];

  for (const arq of alvos) {
    const orig = fs.statSync(arq).size;
    antes += orig;

    const limite = limitePara(arq);
    if (limite === null && orig < 400 * 1024) { depois += orig; pulados++; continue; }

    try {
      const img = sharp(arq, { failOn: "none" });
      const meta = await img.metadata();
      let precisaRedimensionar = limite !== null && Math.max(meta.width, meta.height) > limite;

      const saida = sharp(arq, { failOn: "none" });
      let pipe;

      if (precisaRedimensionar) {
        pipe = saida.resize({
          width: limite,
          height: limite,
          fit: "inside",
          withoutEnlargement: true,
          kernel: "lanczos3",
        });
      } else {
        pipe = saida;
      }

      const ehJpg = /\.jpe?g$/i.test(arq);
      pipe = pipe[ehJpg ? "jpeg" : "png"](
        ehJpg ? { quality: 82, mozjpeg: true } : { compressionLevel: 9, effort: 10, palette: false },
      );

      const buffer = await pipe.toBuffer();

      // so substitui se AJUDAR
      if (buffer.length < orig) {
        fs.writeFileSync(arq, buffer);
        depois += buffer.length;
        mexidos++;
        ganhos.push({ arq, orig, novo: buffer.length, w: meta.width, h: meta.height, redim: precisaRedimensionar });
      } else {
        depois += orig;
        pulados++;
      }
    } catch (e) {
      depois += orig;
      pulados++;
    }
  }

  console.log("  ANTES  : " + (antes / 1048576).toFixed(1) + " MB em " + alvos.length + " arquivos");
  console.log("  DEPOIS : " + (depois / 1048576).toFixed(1) + " MB");
  console.log("  GANHO  : " + ((1 - depois / antes) * 100).toFixed(1) + "%  (" + ((antes - depois) / 1048576).toFixed(1) + " MB a menos)");
  console.log("  alterados: " + mexidos + "   sem ganho/ignorados: " + pulados);
  console.log("");

  ganhos.sort((a, b) => b.orig - b.orig + (b.orig - b.novo) - (a.orig - a.novo));
  console.log("  --- os 25 que mais perderam ---");
  for (const g of ganhos.slice(0, 25)) {
    console.log(
      "  " + (g.orig / 1048576).toFixed(2).padStart(7) + " -> " + (g.novo / 1024).toFixed(0).padStart(7) + " KB   " +
      (g.redim ? g.w + "x" + g.h + " redim" : "recomprimido ") + "  " + g.arq,
    );
  }
})();