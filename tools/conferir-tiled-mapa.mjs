/**
 * O QUE ESTE ARQUIVO CONFERE
 *
 * A camada de tile do mapa 1 vem de um `.tmj` com tileset EXTERNO, e a
 * descricao da folha esta no `dungeon.tsx`. O navegador nao le XML de
 * `src/assets`, entao o codigo transcreve as colunas, a contagem e o
 * tamanho para dentro de `camadaDoMapa1.js`
 *
 * E essa transcricao e o ponto fraco do sistema inteiro: se a folha mudar no
 * Tiled, ela fica velha, e o mapa DESENHA A LINHA ERRADA DA IMAGEM — sem
 * erro, sem aviso, e em parte. O desenho nao denuncia nada disso
 *
 * Este arquivo fecha a rede comparando os dois lados: o que o `.tsx` diz e o
 * que o codigo repete. E tambem confere a leitura do `.tmj`, porque um
 * `firstgid` ou um espelhamento mal lido passa pelo desenho do mesmo jeito
 */

import { readFileSync } from "node:fs";
import { lerMapaTiled, gidDe, flagsDe } from "../src/game/maps/tiled.js";

const PASTA = "src/assets/tilesets/map_1";

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
 * O QUE ESTA TRANSCRITO EM `camadaDoMapa1.js`.
 *
 * E uma copia, e e o ponto do arquivo: se o codigo mudar, este teste tem que
 * mudar junto, e ai alguem ve o porque
 */
const NO_CODIGO = {
  name: "dungeon",
  columns: 4,
  tilewidth: 64,
  tileheight: 64,
  tilecount: 16,
  spacing: 1,
  margin: 0,
};

/**
 * ATRIBUTOS DO `.tsx`.
 *
 * O `.tsx` e XML, e nao ha biblioteca de XML no projeto. Ler com regex e
 * seguro aqui porque o arquivo e do proprio Tiled e tem uma forma so — e um
 * gerador de XML em vez de um parser seria 40 linhas para um arquivo de 242
 * bytes
 */
function lerTsx(caminho) {
  const xml = readFileSync(caminho, "utf8");

  const atributo = (nome) =>
    xml.match(new RegExp(`${nome}="([^"]*)"`))?.[1] ?? null;

  const imagem = {
    source: xml.match(/<image source="([^"]*)"/)?.[1] ?? null,
    width: Number(xml.match(/<image[^>]*width="([^"]*)"/)?.[1] ?? 0),
    height: Number(xml.match(/<image[^>]*height="([^"]*)"/)?.[1] ?? 0),
  };

  return {
    name: atributo("tileset") ? null : null,
    nomeDoTileset: xml.match(/<tileset[^>]*name="([^"]*)"/)?.[1] ?? null,
    tilewidth: Number(atributo("tilewidth")),
    tileheight: Number(atributo("tileheight")),
    spacing: Number(atributo("spacing")),
    tilecount: Number(atributo("tilecount")),
    columns: Number(atributo("columns")),
    imagem,
  };
}

console.log("\nCAMADA DE TILE DO MAPA 1\n");

const tmj = JSON.parse(readFileSync(`${PASTA}/dungeon.tmj`, "utf8"));
const tsx = lerTsx(`${PASTA}/dungeon.tsx`);

/* ------------------------------------------------------------------ *
 * 1. A TRANSCRICAO BATE COM O ARQUIVO
 * ------------------------------------------------------------------ */
console.log("1. o codigo repete o que o .tsx diz\n");

conferir("o nome bate", NO_CODIGO.name === tsx.nomeDoTileset);
conferir(`as colunas batem (${tsx.columns})`, NO_CODIGO.columns === tsx.columns);
conferir(`o tile cabe (${tsx.tilewidth})`, NO_CODIGO.tilewidth === tsx.tilewidth);
conferir(`a altura do tile bate (${tsx.tileheight})`, NO_CODIGO.tileheight === tsx.tileheight);
conferir(`o espaco entre tiles bate (${tsx.spacing})`, NO_CODIGO.spacing === tsx.spacing);
conferir(`a contagem bate (${tsx.tilecount})`, NO_CODIGO.tilecount === tsx.tilecount);
conferir("o .tsx aponta para a imagem do lado", tsx.imagem.source === "dungeon.png");

/**
 * A IMAGE BATE COM A CONTAGEM DE TILES.
 *
 * E a conta que fecha a folha: quatro colunas de 64px com 1px de espaco dao
 * 259px, que e a largura que o `.tsx` declara. Se a folha tivesse 5 colunas e
 * o codigo achasse que tem 4, a imagem bateria na conta e o desenho pegaria
 * a linha errada do ultimo tile
 */
const larguraEsperada =
  tsx.columns * tsx.tilewidth + (tsx.columns - 1) * tsx.spacing;
const alturaEsperada =
  Math.ceil(tsx.tilecount / tsx.columns) * tsx.tileheight +
  (Math.ceil(tsx.tilecount / tsx.columns) - 1) * tsx.spacing;

conferir(
  `a imagem tem ${larguraEsperada}px de largura`,
  tsx.imagem.width === larguraEsperada,
);

conferir(
  `a imagem tem ${alturaEsperada}px de altura`,
  tsx.imagem.height === alturaEsperada,
);

conferir(
  "a folha tem linhas inteiras",
  tsx.tilecount % tsx.columns === 0,
);

/* ------------------------------------------------------------------ *
 * 2. O MAPA E DO TAMANHO CERTO
 * ------------------------------------------------------------------ */
console.log("\n2. o mapa casa com o tamanho do jogo\n");

conferir(`o mapa tem ${tmj.width}x${tmj.height} tiles`, tmj.width === 94 && tmj.height === 66);
conferir("o tile do mapa e o do tileset", tmj.tilewidth === tsx.tilewidth && tmj.tileheight === tsx.tileheight);

/**
 * A CONTA QUE FAZ O MAPA CABER NO LUGAR DELE.
 *
 * O motor nao le o tamanho do Tiled: `MAP_1_WIDTH` e `MAP_1_HEIGHT` sao
 * calculados no `data/maps`. Se um lado mudar e o outro nao, o jogador anda
 * sobre uma borda detiles que nao existe — ou o Tiled desenha alem do limite
 * do mundo
 */
const larguraDoJogo = Math.ceil(6000 / tmj.tilewidth) * tmj.tilewidth;
const alturaDoJogo = Math.ceil(4200 / tmj.tileheight) * tmj.tileheight;

conferir(
  "a largura do mapa do jogo bate com o Tiled",
  tmj.width * tmj.tilewidth === larguraDoJogo,
);

conferir(
  "a altura do mapa do jogo bate com o Tiled",
  tmj.height * tmj.tileheight === alturaDoJogo,
);

conferir(`o mundo fica com ${larguraDoJogo}x${alturaDoJogo}px`, larguraDoJogo === 6016 && alturaDoJogo === 4224);

/* ------------------------------------------------------------------ *
 * 3. A LEITURA PELO MOTOR
 * ------------------------------------------------------------------ */
console.log("\n3. a leitura que o motor faz\n");

const lido = lerMapaTiled(tmj, {
  imagens: { dungeon: "dungeon.png" },
  tilesets: { "dungeon.tsx": NO_CODIGO },
});

conferir("o mapa tem uma camada", lido.layers.length === 1);
conferir("e ela e a de blocos", lido.layers[0].name === "Camada de Blocos 1");
conferir("a camada tem 94 colunas", lido.layers[0].cols === 94);
conferir("a camada tem 66 linhas", lido.layers[0].rows === 66);
conferir(`e ${94 * 66} celulas`, lido.layers[0].gids.length === 94 * 66);
conferir("o tileset tem 16 tiles", lido.tileset.tilecount === 16);
conferir("e 4 colunas", lido.tileset.columns === 4);
conferir("o firstgid vem do mapa", lido.tileset.firstgid === 1);
conferir(`o mapa lido tem ${lido.width}x${lido.height}px`, lido.width === 6016 && lido.height === 4224);

/**
 * NENHUMA CELULA SAI DA FOLHA.
 *
 * Um `gid` maior que a contagem de tiles vira um retangulo de origem fora da
 * imagem, e o `drawImage` desenha nada — um buraco no chao sem aviso. E o
 * `+1` e do `firstgid`: o tile 16 do mapa e o indice 15 da folha
 */
const foraDaFolha = lido.layers[0].gids.filter(
  (gid) => gid >= 0 && gid - lido.tileset.firstgid >= lido.tileset.tilecount,
);

conferir("nenhum gid aponta fora da folha", foraDaFolha.length === 0);

const distintos = [...new Set(lido.layers[0].gids)].sort((a, b) => a - b);

console.log(`\n  tiles usados: ${distintos.join(", ")}`);

conferir(
  "todos os tiles usados existem",
  distintos.every((gid) => gid >= 1 && gid <= 16),
);

conferir("nenhuma celula esta vazia", lido.layers[0].gids.every((g) => g !== -1));

/* ------------------------------------------------------------------ *
 * 4. OS ESPELHAMENTOS
 * ------------------------------------------------------------------ */
console.log("\n4. os espelhamentos do mapa\n");

{
  const brutos = tmj.layers[0].data;

  const comFlag = brutos.filter((g) => flagsDe(g) !== 0);
  const soVertical = brutos.filter((g) => flagsDe(g) === 0x40000000);
  const doisEixos = brutos.filter((g) => flagsDe(g) === (0x80000000 | 0x40000000));

  console.log(`  celulas com espelho: ${comFlag.length}`);
  console.log(`    so vertical: ${soVertical.length}`);
  console.log(`    nos dois eixos: ${doisEixos.length}\n`);

  /**
   * O MAPA E ORTOGONAL, E SO EXISTEM TRES BITS DE ESPELHO.
   *
   * Os bits de hexagono e de rotacao nao existem em mapa ortogonal, e um
   * deles ligado aqui seria um tile virado que o jogador nao arrumou. A
   * mascara do `tiled.js` cobre so os tres, entao um bit a mais passaria
   * direto para o `gid` e viraria indice de imagem tres bilhoes
   */
  const bitsValidos = 0x80000000 | 0x40000000 | 0x20000000;

  conferir(
    "nenhuma celula tem bit que nao existe em mapa ortogonal",
    brutos.every((g) => (g & ~bitsValidos & ~0x1fffffff) === 0),
  );

  conferir(
    "e o espelho nao muda o tile desenhado",
    comFlag.every((g) => gidDe(g) > 0 && gidDe(g) <= 16),
  );
}

/* ------------------------------------------------------------------ *
 * 5. O TILESET EXTERNO SEM REGISTRO
 * ------------------------------------------------------------------ */
console.log("\n5. tileset externo sem declaracao\n");

{
  let lancou = false;
  let mensagem = "";

  try {
    lerMapaTiled(tmj, { imagens: { dungeon: "dungeon.png" } });
  } catch (erro) {
    lancou = true;
    mensagem = erro.message;
  }

  /**
   * SEM REGISTRO, O MAPO TEM QUE RECUSAR — E DIZER POR QUE.
   *
   * Se passasse com `columns: 1` e `tilecount: 0`, o desenho usaria a linha
   * errada da imagem sem reclamar de nada. Falhar alto aqui e o que impede
   * que um tileset externo esquecido vire um mapa em branco
   */
  conferir("um tileset externo sem dados e recusado", lancou);
  conferir("e a mensagem diz o tileset", mensagem.includes("undefined"));

  conferir(
    "e um tileset embutido continua funcionando sem registro",
    (() => {
      const embutido = {
        ...tmj,
        tilesets: [{ ...NO_CODIGO, firstgid: 1 }],
      };

      const lidoEmbutido = lerMapaTiled(embutido, {
        imagens: { dungeon: "dungeon.png" },
      });

      return lidoEmbutido.tileset.columns === 4;
    })(),
  );
}

console.log(`\n${passou} ok, ${falhou} falhas\n`);

if (falhou) process.exit(1);