import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { inflateSync } from "node:zlib";
import {
  dirname,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { encodePng } from "./png.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * As folhas que a ferramenta monta.
 *
 * Cada uma tem o seu tamanho de celula: o arqueiro e o arqueiro
 * zumbi usam artes de origem com dimensoes diferentes, e um frame
 * quadrado de 64x64 nao cabe numa celula de 68x68 sem cortar o
 * personagem. Encolher as duas para o menor seria perder pixels da
 * arte nova, entao cada sheet declara o proprio tamanho.
 *
 * `idle` e `shootFallback` existem por causa do ogre da predeira, que
 * veio com uma arte menos completa que as outras duas: o golpe (o nome
 * da pasta no origem e `shoot`, mas nao ha arco nenhum) so veio em 5
 * das 8 direcoes, e o `idle.gif` chegou depois de a folha estar montada
 * — o `idle: false` abaixo e o que segurava a folha sem essa linha.
 * Ver `buildSheet`.
 */
export const SHEETS = {
  arbalist: {
    sourceDir: "src/assets/sprites/arbalist",
    output: "src/assets/sprites/arbalist-sheet.png",
    frameSize: 64,
    prefix: "ARBALIST",
  },
  zumbi: {
    sourceDir: "src/assets/sprites/zumbi_arbalist",
    output: "src/assets/sprites/zumbi_arbalist-sheet.png",
    frameSize: 68,
    prefix: "ZUMBI",
  },
  ogre: {
    sourceDir: "src/assets/sprites/ogre_da_predeira",
    output:
      "src/assets/sprites/ogre_da_predeira-sheet.png",
    frameSize: 68,
    prefix: "OGRE_PREDEIRA",

    /**
     * O `idle.gif` EXISTE.
     *
     * A folha ficava sem idle ate a arte de parado chegar. Agora ela veio: a
     * folha sai com 8 linhas de caminhada, 1 de idle e 8 de golpe, e o
     * layout aponta o idle para a linha dele em vez de congelar um frame
     * da caminhada
     */
    idle: true,

    /**
     * Direcao que substitui cada lane de golpe ausente.
     *
     * A escolha e a vizinha mais proxima na ROSA DOS VENTOS, e nao a
     * primeira que apareceu na pasta. A ordem de `ROWS` e
     * circular, entao a distancia e circular tambem: `north` esta a
     * 2 passos de `east` e de `west`, e a 3 de `south-east`.
     *
     * `south` (o oposto) esta descartado de proposito: colar o lado
     * de frente no lugar do lado de costas faria o jogador ver a
     * CARA do ogre quando o ogre esta virado para away, que e o
     * caso mais comum num golpe.
     *
     * Declarar o mapa aqui, em vez de a ferramenta escolher, deixa a
     * troca visivel no codigo e no log: e uma decisao sobre a arte,
     * nao um detalhe de implementacao.
     */
    shootFallback: {
      north: "east",
      "north-east": "east",
      "north-west": "west",
    },
  },
  boneco: {
    sourceDir: "src/assets/sprites/boneco_de_madeira",
    output: "src/assets/sprites/boneco_de_madeira-sheet.png",
    frameSize: 68,
    prefix: "BONECO",

    // O boneco de treino so tem as OITO DIRECOES de caminhada.
    // Nem idle, nem golpe: e um boneco, ele nao ataca. A folha sai
    // com 8 linhas e nada mais, e o layout do inimigo declara
    // apenas `walk` e um `idle` de 1 frame congelado na linha da
    // direcao
    idle: false,
    shoot: false,
  },

  ghoul: {
    // A pasta de origem chama o ghoul de "guerreiro", e a saida
    // mantem o nome do INIMIGO (`ghoul_faminto`), que e quem o jogo
    // conhece. Um asset com o nome em portugues e o que ja acontece
    // com `ogre_da_predeira`
    sourceDir: "src/assets/sprites/guerreiro",
    output: "src/assets/sprites/ghoul_faminto-sheet.png",
    frameSize: 68,
    prefix: "GHOUL_FAMINTO",

    // Tem `idle.gif` e as oito direcoes, mas nao tem golpe. O
    // ghoul e corpo a corpo, entao o golpe dele esta no MESMO
    // arquivo da caminhada: nao existe arte de ataque separada
    idle: true,
    shoot: false,
  },

  warrior: {
    sourceDir: "src/assets/sprites/warrior",
    output: "src/assets/sprites/warrior-sheet.png",
    frameSize: 68,
    prefix: "WARRIOR",

    /**
     * O golpe do guerreiro esta em `attack/`, e nao em `shoot/`.
     *
     * O nome do ciclo e dado pela arte de origem, e o padrao da
     * ferramenta (`shoot`) so vale para quem o respeita. Um corpo a
     * corpo como o guerreiro nao atira: o golpe dele e um `./target`,
     * e chamar a pasta de tiro faria o log mentir sobre o que a
     * folha contem
     */
    shootDir: "attack",

    /**
     * O idle do guerreiro se chama `indle.gif`, com o `d` trocado
     * pelo `i`.
     *
     * Declarar o nome real aqui em vez de renomear o arquivo: a arte
     * de origem e do usuario, e um nome equivalente nao muda o que a
     * folha le. O padrao `idle` continua valendo para as outras
     * folhas
     */
    idleFile: "indle",
  },

  sorcerer: {
    sourceDir: "src/assets/sprites/sorcerer",
    output: "src/assets/sprites/sorcerer-sheet.png",
    frameSize: 68,
    prefix: "SORCERER",

    /**
     * O `idle.gif` do sorcerer e uma arte de verdade, com oito
     * quadros, e nao um frame congelado: a folha ganha a linha 8 de
     * idle como o guerreiro, o arquiro e o ghoul
     */
    idle: true,

    /**
     * Sem golpe, como o ghoul.
     *
     * O sorcerer e um caster de projetil e a pasta de origem nao tem
     * arte de ataque: nem em `shoot/`, nem em pasta propria, nem
     * misturado na caminhada. E o mesmo caso do ghoul, e a folha sai
     * com oito linhas de direcao mais a de idle
     *
     * O desenho enquanto o golpe corre fica por conta do
     * `src/data/sprites/layout.js`: enquanto nao houver arte de
     * ataque, o `attack` do sorcerer aponta para a linha de idle
     */
    shoot: false,
  },

  lancer: {
    sourceDir: "src/assets/sprites/lancer",
    output: "src/assets/sprites/lancer-sheet.png",
    frameSize: 68,
    prefix: "LANCER",

    /**
     * O idle do lancer tem o mesmo nome trocado do guerreiro,
     * `indle.gif`. A pasta declara o nome real em vez de a arte ser
     * renomeada: os dois archivos sao do usuario, e o que a folha le
     * nao muda por causa do `d`
     */
    idleFile: "indle",

    /**
     * Sem golpe, como o sorcerer e o ghoul.
     *
     * O lancer e um bruiser de alcance e o golpe basico dele e um
     * `./target` em linha, mas a pasta de origem nao trouxe a arte
     * disso: nem em `shoot/`, nem em pasta propria. Sao oito direcoes
     * de caminhada e um idle, e nada mais
     *
     * Nao e preciso declarar `shootDir: "attack"` como no guerreiro:
     * ali a pasta existe e se chama `attack`, e o nome declara o que a
     * folha contem. Aqui nao ha pasta nenhuma, e `shoot: false` e o
     * que impede a ferramenta de procurar arquivos que nunca existiram
     */
    shoot: false,
  },

  /**
   * O RATO DA TOCA.
   *
   * A pasta de origem se chama `urso`, e o nome e da arte: e um urso
   * que o jogador mandou para o bicho da toca. O nome do jogo continua
   * sendo "Rato da Toca" e o `id` continua sendo `rat` — renomear a
   * criatura para o nome da arte mudaria o save de todo mundo que ja
   * matou um rato
   *
   * A mesma separacao do ghoul, que usa a pasta `guerreiro` e sai como
   * `ghoul_faminto-sheet.png`: a pasta guarda o nome da arte, e a
   * saida e o nome da CRIATURA, que e o que o `GameEngine` procura
   */
  rato_da_toca: {
    sourceDir: "src/assets/sprites/urso",
    output: "src/assets/sprites/rato_da_toca-sheet.png",
    frameSize: 68,
    prefix: "RATO_DA_TOCA",

    /**
     * Tem `idle` de verdade: as oito direcoes de caminhada mais um
     * `idle.gif` desenhado
     */
    idle: true,

    /**
     * Sem golpe, como o ghoul.
     *
     * O rato e PASSIVO, com `aggroRange: 0`: ele foge do jogador e
     * nao ataca. O `attackRange` e `damage` do catalogo existem para
     * a criatura ter os mesmos campos dos outros, e nao porque ele
     * golpeie — entao nao ha arte de ataque para montar
     *
     * Com o `shoot: false` o pedido de "attack" cai no reserva do
     * `resolveFrameRect`, que procura o `idle` antes do `walk`: um
     * pedido de golpe mostraria o parado, e nao o bicho andando no
     * meio de um golpe que ele nunca deu
     */
    shoot: false,

    /**
     * A CAMINHADA do `south` vem do `idle.gif`.
     *
     * A arte nao tem `south.gif`: sao sete direcoes de caminhada e o
     * `idle`, que e a arte de PARADO de frente. Copiar a vizinha mais
     * proxima em grau — o que o mapa faz por padrao, e o que o ogre
     * usa para as direcoes de golpe que faltam — poria o rato andando
     * na diagonal toda vez que ele andasse na direcao do jogador, e essa
     * e a direcao mais vista do jogo
     *
     * A arte parada mantem o RATO DE FRENTE, que e o sinal mais forte
     * de para onde ele esta indo. O que se perde e a pata mexendo: andando
     * para baixo o rato desliza em vez de caminhar. E um defeito
     * visivel, e a troca foi consciente — a diagonal seria visivel
     * tambem, e errada de um jeito pior
     *
     * Quando o `south.gif` chegar na pasta, e apagar esta linha: a
     * ferramenta passa a usar a arte de verdade e o log volta a dizer
     * que as oito direcoes vieram da arte
     */
    walkFallback: {
      south: "idle",
    },
  },

  /**
   * A SENTINELA ESQUELETICA.
   *
   * A pasta se chama `sentinela` e a criatura e `skeleton` — o nome de
   * exibicao e "Sentinela Esquelética". O `id` continua `skeleton`
   * porque e ele que esta no save, no bestiario e nas missoes que
   * pedem a caca
   *
   * A arte e a mais limpa do jogo: as oito direcoes de caminhada e o
   * `idle`, todas em 68x68, com oito quadros e nenhum truncado. Nada
   * precisou de `walkFallback` nem de centralizacao, e a folha sai
   * direto
   */
  sentinela_esqueletica: {
    sourceDir: "src/assets/sprites/sentinela",
    output: "src/assets/sprites/sentinela_esqueletica-sheet.png",
    frameSize: 68,
    prefix: "SENTINELA_ESQUELETICA",

    // tem `idle` desenhado, com oito quadros
    idle: true,

/**
     * O GOLPE TEM ARTE, EM OITRO DIRECOES.
     *
     * A pasta do `shoot/` encheu depois de a folha ter sido montada pela
     * primeira vez: as oito direcoes de golpe chegaram de uma vez. Antes
     * disso a sentinela atirava sem animacao, e o golpe caia no reserva do
     * `resolveFrameRect` — a linha do idle, que e a pose de parado
     *
     * Sem `walkFallback` nem `shootFallback`: as oito direcoes estao
     * la, entao a folha sai direto e nada e copiado
     */
    shoot: true,
  },

  /**
   * O LIMO PREGUICOSO.
   *
   * A pasta se chama `guerreiro_2`, e o nome e da arte. A criatura e o
   * `slime` — o primeiro bicho do jogo, o de nivel 1, e o `slime` que
   * todo mundo ja matou mil vezes. O `id` nao muda por causa de uma
   * troca de arte: ele esta no save, no bestiario, nas missoes e, o que
   * pesa mais aqui, no `slime_gel` e no `slime_core` que o craft e as
   * missoes pedem
   *
   * A segunda pasta `guerreiro` do jogo — a primeira e o ghoul faminto.
   * As duasvem do mesmo lugar e as duas precisam do nome proprio na
   * saida, porque um `guerreiro-sheet.png` sobrescreveria o do outro
   *
   * A arte e limpa como a da sentinela: oito direcoes, `idle`, todas
   * em 68x68, oito quadros, nenhum truncado
   */
  limo_preguicoso: {
    sourceDir: "src/assets/sprites/guerreiro_2",
    output: "src/assets/sprites/limo_preguicoso-sheet.png",
    frameSize: 68,
    prefix: "LIMO_PREGUICOSO",

    // tem `idle` desenhado, com oito quadros
    idle: true,

    /**
     * Sem golpe, e aqui isso e questionavel de verdade.
     *
     * O limo e PASSIVO com `aggroRange: 0`: ele foge do jogador e
     * praticamente nunca ataca. O `attackRange: 44` e o `damage: 7` do
     * catalogo existem para a criatura ter os mesmos campos dos
     * outros. Sem `attack`, um pedido de golpe cai no reserva do
     * `resolveFrameRect`, que prefere o `idle`
     */
    shoot: false,
  },

  /**
   * O GOBLIN SAQUEADOR.
   *
   * A pasta se chama `hulk`, e o nome e da arte. A criatura e o
   * `goblin`, que e o `id` do save e do bestiario; a saida usa o nome
   * de exibicao, "Goblin Saqueador", como o ghoul usa "Ghoul Faminto"
   *
   * A arte e limpa como a da sentinela e a do limo: oito direcoes,
   * `idle`, todas em 68x68, oito quadros, nenhum truncado
   */
  goblin_saqueador: {
    sourceDir: "src/assets/sprites/hulk",
    output: "src/assets/sprites/goblin_saqueador-sheet.png",
    frameSize: 68,
    prefix: "GOBLIN_SAQUEADOR",

    // tem `idle` desenhado, com oito quadros
    idle: true,

    /**
     * Sem golpe, e aqui a ausencia e DOVADA pelo catalogo.
     *
     * O goblin e `SEMI_PASSIVE` com `aggroRange: 0`: ele passeia e nao
     * persegue. O `attackRange: 52` e o `damage: 22` existem para a
     * criatura ter os mesmos campos dos outros, e nao porque ele
     * persiga o jogador — e o mesmo caso do ghoul faminto, que tambem
     * e semi-passivo e tambem nao tem arte de golpe
     *
     * Sem `attack` na definicao, um pedido de golpe cai no reserva do
     * `resolveFrameRect`, que prefere o `idle` a caminhada. E aqui o
     * salto de direcao e imperceptivel, ao contrario da sentinela: um
     * bicho que nao persegue quase nao entra na janela de golpe
     */
    shoot: false,
  },
};

export const ROWS = [
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east",
];

/**
 * A pasta e a linha do ciclo de tiro/golpe, quando a folha nao
 * declara outra.
 *
 * O nome e `shoot` porque foi o primeiro asset a ter essa arte (o
 * arqueiro zumbi atira). O ogre da predeira e corpo a corpo e o
 * golpe dele esta na MESMA pasta: o nome do arquivo de origem nao
 * descreve o que a arte faz. E o guerreiro tem golpe em pasta
 * propria, chamada `attack` — por isso `shootDir` na folha
 */
export const SHOOT_DIR = "shoot";

/**
 * O arquivo de idle, quando a folha nao declara outro.
 *
 * `idle` e o nome de toda arte de origem ate aqui. O guerreiro
 * entrega o dele com o `d` trocado (`indle.gif`), e o nome real
 * fica declarado na folha em vez de ser adivinhado
 */
export const IDLE_FILE = "idle";



function lzwDecode(minCodeSize, data, pixelCount) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;

  let codeSize = minCodeSize + 1;
  let next = eoi + 1;

  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4096);

  for (let i = 0; i < clear; i += 1) {
    prefix[i] = -1;
    suffix[i] = i;
  }

  const out = new Uint8Array(pixelCount);

  let written = 0;
  let bitBuffer = 0;
  let bitCount = 0;
  let pos = 0;
  let old = -1;
  let truncated = false;

  const readCode = () => {
    while (bitCount < codeSize) {
      if (pos >= data.length) return -1;
      bitBuffer |= data[pos] << bitCount;
      pos += 1;
      bitCount += 8;
    }

    const code = bitBuffer & ((1 << codeSize) - 1);

    bitBuffer >>= codeSize;
    bitCount -= codeSize;

    return code;
  };

  while (written < pixelCount) {
    const code = readCode();

    if (code === -1) {
      truncated = true;
      break;
    }

    if (code === eoi) {
      if (written < pixelCount) truncated = true;
      break;
    }

    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = eoi + 1;
      old = -1;
      continue;
    }

    let current = code;
    let sp = 0;

    if (code >= next) {
      if (old === -1) {
        truncated = true;
        break;
      }
      stack[sp] = suffix[old];
      sp += 1;
      current = old;
    }

    while (current >= clear) {
      stack[sp] = suffix[current];
      sp += 1;
      current = prefix[current];
      if (sp >= 4096) break;
    }

    stack[sp] = suffix[current];
    sp += 1;

    for (let i = sp - 1; i >= 0 && written < pixelCount; i -= 1) {
      out[written] = stack[i];
      written += 1;
    }

    if (old !== -1 && next < 4096) {
      prefix[next] = old;
      suffix[next] = stack[sp - 1];
      next += 1;

      if (next === 1 << codeSize && codeSize < 12) {
        codeSize += 1;
      }
    }

    old = code;
  }

  return { out, written, truncated };
}

export function decodeGif(buffer) {
  const signature = buffer
    .subarray(0, 6)
    .toString("latin1");

  if (!signature.startsWith("GIF8")) {
    throw new Error(`nao e um gif: ${signature}`);
  }

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const packed = buffer[10];

  const globalTableSize = 3 * 2 ** ((packed & 7) + 1);

  let i = 13 + globalTableSize;

  const frames = [];

  let transparent = null;
  let loop = null;
  let delay = null;
  let disposal = null;

  while (i < buffer.length) {
    const block = buffer[i];

    if (block === 0x21) {
      const label = buffer[i + 1];

      if (label === 0xf9) {
        const gcePacked = buffer[i + 3];

        delay = buffer.readUInt16LE(i + 4);

        if (gcePacked & 1) {
          transparent = buffer[i + 6];
        }

        disposal = (gcePacked >> 2) & 7;
        i += 8;
      } else {
        if (label === 0xff) {
          const size = buffer[i + 2];
          const app = buffer
            .subarray(i + 3, i + 3 + size)
            .toString("latin1");

          if (app.startsWith("NETSCAPE")) {
            loop = buffer.readUInt16LE(i + 3 + size + 2);
          }
        }

        i += 2;

        while (buffer[i] !== 0) i += buffer[i] + 1;
        i += 1;
      }

      continue;
    }

    if (block === 0x2c) {
      const imgPacked = buffer[i + 9];

      let j = i + 10;
      let tableOffset = 13;
      let tableSize = globalTableSize;

      if (imgPacked & 0x80) {
        tableOffset = j;
        tableSize = 3 * 2 ** ((imgPacked & 7) + 1);
        j += tableSize;
      }

      const minCodeSize = buffer[j];
      j += 1;

      const chunks = [];

      while (buffer[j] !== 0) {
        const length = buffer[j];
        chunks.push(buffer.subarray(j + 1, j + 1 + length));
        j += length + 1;
      }

      const pixelCount = width * height;
      const { out: indices, written, truncated } = lzwDecode(
        minCodeSize,
        Buffer.concat(chunks),
        pixelCount,
      );

      const rgba = new Uint8Array(pixelCount * 4);

      for (let p = 0; p < pixelCount; p += 1) {
        const value = indices[p];

        if (value === transparent) continue;

        const base = tableOffset + value * 3;
        const target = p * 4;

        rgba[target] = buffer[base];
        rgba[target + 1] = buffer[base + 1];
        rgba[target + 2] = buffer[base + 2];
        rgba[target + 3] = 255;
      }

      frames.push({
        rgba,
        delay,
        disposal,
        complete: !truncated && written === pixelCount,
        written,
      });

      i = j + 1;
      continue;
    }

    if (block === 0x3b) break;
    i += 1;
  }

  return { width, height, frames, loop, transparent };
}

function measure(frame, width, height) {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (frame[(y * width + x) * 4 + 3] === 0) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count += 1;
    }
  }

  return { minX, maxX, minY, maxY, count };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[middle];

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function shiftFrame(frame, width, height, dx, dy) {
  if (dx === 0 && dy === 0) return frame;

  const out = new Uint8Array(frame.length);

  for (let y = 0; y < height; y += 1) {
    const sourceY = y - dy;

    if (sourceY < 0 || sourceY >= height) continue;

    for (let x = 0; x < width; x += 1) {
      const sourceX = x - dx;

      if (sourceX < 0 || sourceX >= width) continue;

      const source = (sourceY * width + sourceX) * 4;
      const target = (y * width + x) * 4;

      out[target] = frame[source];
      out[target + 1] = frame[source + 1];
      out[target + 2] = frame[source + 2];
      out[target + 3] = frame[source + 3];
    }
  }

  return out;
}

/**
 * Decodifica um PNG RGBA de 8 bits.
 *
 * Exportado porque e o unico jeito de conferir a folha DEPOIS de
 * gerada, sem depender do que o navegador faz com a imagem: um
 * teste pode abrir o png e comparar celula a celula com os gifs de
 * origem, e provar que o que esta no arquivo e a arte de quem
 * mandou, e nao outra coisa.
 */
/**
 * Decodifica um PNG para RGBA.
 *
 * Sao aceitos os dois formatos de 8 bits que aparecem no projeto:
 *
 * - **color 6, RGBA**: o que o `portal_1.png` e o `portal_2.png` tem.
 *   A transparencia ja vem no arquivo
 * - **color 2, RGB**: o que o `base.png` tem. Sem canal alpha nenhum,
 *   entao o recorte da moldura e do fundo depende de quem chama
 *
 * O caso RGB entra devolvendo alpha 255 em tudo. Isso NAO inventa
 * transparencia: so faz o resto do pipeline — o `caixaOpaca` do
 * `gerar-portal.mjs`, por exemplo — poder tratar os dois formatos com o
 * mesmo codigo. Quem precisa cortar um fundo pintado faz isso a parte,
 * porque so quem conhece a arte sabe qual pixel e fundo
 */
export function inflatePng(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[i] !== signature[i]) {
      throw new Error("png invalido");
    }
  }

  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;

  const idat = [];

  let i = 8;

  while (i < buffer.length) {
    const length = buffer.readUInt32BE(i);
    const type = buffer.toString("ascii", i + 4, i + 8);
    const data = buffer.subarray(i + 8, i + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }

    i += 12 + length;
  }

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(
      `png inesperado: depth ${bitDepth}, color ${colorType}`,
    );
  }

  /**
   * Os bytes por pixel do ARQUIVO, que e o que o filtro da linha usa.
   *
   * E 3 no RGB e 4 no RGBA. Confundir os dois faz a linha inteira
   * correr e a imagem sai com listras diagonais
   */
  const bpp = colorType === 6 ? 4 : 3;

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;

  // o filtro acontece em RGB puro; a expansao para RGBA vem depois
  const cru = new Uint8Array(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(
      y * (stride + 1) + 1,
      y * (stride + 1) + 1 + stride,
    );

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? cru[y * stride + x - bpp] : 0;
      const up = y > 0 ? cru[(y - 1) * stride + x] : 0;
      const upLeft =
        x >= bpp && y > 0 ? cru[(y - 1) * stride + x - bpp] : 0;

      let value = line[x];

      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const dl = Math.abs(p - left);
        const du = Math.abs(p - up);
        const dul = Math.abs(p - upLeft);

        value +=
          dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      }

      cru[y * stride + x] = value & 0xff;
    }
  }

  // RGB ja veio: devolve como esta
  if (colorType === 6) {
    return { width, height, data: cru };
  }

  const out = new Uint8Array(width * height * 4);

  for (let p = 0; p < width * height; p += 1) {
    out[p * 4] = cru[p * 3];
    out[p * 4 + 1] = cru[p * 3 + 1];
    out[p * 4 + 2] = cru[p * 3 + 2];
    out[p * 4 + 3] = 255;
  }

  return { width, height, data: out };
}

function repairTruncatedFrames(directions) {
  const repairs = [];

  for (const direction of directions) {
    const { frames } = direction.gif;
    const total = frames.length;

    const valid = frames
      .map((frame, index) => (frame.complete ? index : null))
      .filter((index) => index !== null);

    if (valid.length === 0) {
      throw new Error(
        `${direction.name}.gif nao tem nenhum frame decodificavel`,
      );
    }

    frames.forEach((frame, index) => {
      if (frame.complete) return;

      let best = null;
      let bestDistance = Infinity;

      for (const candidate of valid) {
        const raw = Math.abs(candidate - index);
        const distance = Math.min(raw, total - raw);

        const prefersEarlier =
          distance === bestDistance && candidate < index;

        if (distance < bestDistance || prefersEarlier) {
          best = candidate;
          bestDistance = distance;
        }
      }

      repairs.push({
        name: direction.name,
        dir: direction.dir === "." ? null : direction.dir,
        index,
        from: best,
        written: frame.written,
      });

      frame.rgba = Uint8Array.from(frames[best].rgba);
      frame.complete = true;
    });

    direction.frames = frames.map((frame) => frame.rgba);
  }

  return repairs;
}

function dropTruncatedFrames(source) {
  const dropped = [];
  const kept = [];

  source.gif.frames.forEach((frame, index) => {
    if (frame.complete) {
      kept.push(frame.rgba);
      return;
    }

    dropped.push({
      name: source.name,
      index,
      written: frame.written,
    });
  });

  if (kept.length === 0) {
    throw new Error(
      `${source.name}.gif nao tem nenhum frame decodificavel`,
    );
  }

  source.frames = kept;

  return dropped;
}

function alignAnchors(lanes, target, frameSize) {
  const anchors = lanes.map((lane) => {
    const measured = lane.frames.map((frame) =>
      measure(frame, frameSize, frameSize),
    );

    return {
      foot: median(measured.map((box) => box.maxY)),
      center: median(
        measured.map((box) => box.minX + box.maxX),
      ),
    };
  });

  const targetFoot = target?.foot ??
    median(anchors.map((anchor) => anchor.foot));

  const targetCenter = target?.center ??
    median(anchors.map((anchor) => anchor.center));

  const offsets = anchors.map((anchor) => ({
    dx: Math.round((targetCenter - anchor.center) / 2),
    dy: targetFoot - anchor.foot,
  }));

  lanes.forEach((lane, index) => {
    const { dx, dy } = offsets[index];

    if (dx === 0 && dy === 0) return;

    lane.frames = lane.frames.map((frame) =>
      shiftFrame(frame, frameSize, frameSize, dx, dy),
    );
  });

  return { offsets, targetFoot, targetCenter };
}

function audit(directions, frameSize) {
  const perRow = [];
  const squashed = [];
  let touching = 0;
  let empty = 0;

  for (const [row, direction] of directions.entries()) {
    const boxes = direction.frames.map((frame) =>
      measure(frame, frameSize, frameSize),
    );

    const unionWidth =
      Math.max(...boxes.map((box) => box.maxX)) -
      Math.min(...boxes.map((box) => box.minX)) +
      1;

    const unionHeight =
      Math.max(...boxes.map((box) => box.maxY)) -
      Math.min(...boxes.map((box) => box.minY)) +
      1;

    const unionArea = unionWidth * unionHeight;

    let minX = frameSize;
    let maxX = -1;
    let minY = frameSize;
    let maxY = -1;
    let opaque = 0;

    boxes.forEach((box, index) => {
      if (box.count === 0) {
        empty += 1;
        return;
      }

      const width = box.maxX - box.minX + 1;
      const height = box.maxY - box.minY + 1;

      // a assinatura de frame corrompido e perder ALTURA: o
      // stream LZW truncado escreve as primeiras linhas da celula
      // e o resto fica vazio. largura varia de legitimamente na
      // animacao de tiro, com o arco sendo puxado e estendido.
      const flat = height < unionHeight * 0.5;
      const sparse = width * height < unionArea * 0.3;

      if (flat || sparse) {
        squashed.push(
          `${direction.name} frame ${index} ` +
            `(${width}x${height} contra ${unionWidth}x${unionHeight})`,
        );
      }

      if (
        box.minX === 0 ||
        box.maxX === frameSize - 1 ||
        box.minY === 0 ||
        box.maxY === frameSize - 1
      ) {
        touching += 1;
      }

      minX = Math.min(minX, box.minX);
      maxX = Math.max(maxX, box.maxX);
      minY = Math.min(minY, box.minY);
      maxY = Math.max(maxY, box.maxY);
      opaque += box.count;
    });

    perRow[row] = {
      minX,
      maxX,
      minY,
      maxY,
      foot: maxY,
      opaque,
    };
  }

  return {
    perRow,
    touching,
    empty,
    squashed,
    foot: median(perRow.map((info) => info.foot)),
  };
}

function verifySheet(png, data, sheetWidth, lanes, frameSize) {
  const decoded = inflatePng(png);

  if (
    decoded.width !== sheetWidth ||
    decoded.height !== frameSize * lanes.length
  ) {
    throw new Error("png gerado com dimensao errada");
  }

  let mismatched = 0;
  let opaquePixels = 0;

  for (const [row, lane] of lanes.entries()) {
    for (const [column, frame] of lane.frames.entries()) {
      for (let y = 0; y < frameSize; y += 1) {
        for (let x = 0; x < frameSize; x += 1) {
          const source = (y * frameSize + x) * 4;
          const targetX = column * frameSize + x;
          const targetY = row * frameSize + y;
          const target = (targetY * sheetWidth + targetX) * 4;

          if (frame[source + 3] > 0) opaquePixels += 1;

          for (let channel = 0; channel < 4; channel += 1) {
            if (
              frame[source + channel] !==
              decoded.data[target + channel]
            ) {
              mismatched += 1;
            }
          }
        }
      }
    }
  }

  if (mismatched > 0) {
    throw new Error(
      `png divergiu da sheet montada em ${mismatched} canais`,
    );
  }

  return {
    opaquePixels,
    cells: lanes.reduce(
      (total, lane) => total + lane.frames.length,
      0,
    ),
  };
}

/**
 * Carrega um lane (uma direcao de um ciclo), aplicando a substituicao
 * declarada quando o gif nao existe.
 *
 * `substituicoes` e o mapa `direcao -> direcao vizinha` da folha. Ele
 * existe porque o ogre da predeira so tem 5 direcoes de golpe: sem
 * isso a ferramenta pararia num arquivo faltando, e a folha do
 * inimigo nao existiria.
 */
function loadLane(
  sourceDir,
  frameSize,
  dir,
  name,
  expectedFrames,
  substituicoes = null,
) {
  const file = resolve(sourceDir, dir, `${name}.gif`);

  let lane = null;
  let usado = null;

  if (existsSync(file)) {
    lane = loadGif(file, `${dir}/${name}.gif`, frameSize);
    usado = name;
  } else {
    const vizinho = substituicoes?.[name] ?? null;

    if (!vizinho) {
      throw new Error(
        `falta ${dir}/${name}.gif e a folha nao declara ` +
          `nenhum substituto para essa direcao`,
      );
    }

    const arquivoVizinho = resolve(
      sourceDir,
      dir,
      `${vizinho}.gif`,
    );

    if (!existsSync(arquivoVizinho)) {
      throw new Error(
        `${dir}/${name}.gif nao existe e o substituto ` +
          `declarado (${vizinho}.gif) tambem nao`,
      );
    }

    lane = loadGif(
      arquivoVizinho,
      `${dir}/${name}.gif`,
      frameSize,
    );

    usado = vizinho;
  }

  if (
    expectedFrames !== null &&
    lane.gif.frames.length !== expectedFrames
  ) {
    throw new Error(
      `${usado}.gif tem ${lane.gif.frames.length} frames, ` +
        `esperado ${expectedFrames}`,
    );
  }

  return { name, dir, gif: lane.gif, usado, substituiu: usado !== name };
}

/**
 * Centraliza um frame menor dentro da celula da folha.
 *
 * A arte de origem nem sempre vem com a mesma tela em todos os
 * arquivos. A do `urso` e o caso: `north` sai em 68x68, `east` em
 * 64x64, `idle` em 60x60 e os dois de baixo em 56x56 — com o MESMO
 * desenho dentro, so a borda em volta que muda
 *
 * Preencher a celula com transparente resolve, e sem REDIMENSIONAR:
 * encolher o maior para o menor perderia pixel da arte, que e a razao
 * de cada folha declarar o proprio tamanho de celula. Como o desenho
 * ja cabe em qualquer das celulas, o unico efeito e uma margem
 * transparente a mais
 *
 * O deslocamento e inteiro e Centralizado: `(celula - origem) / 2`
 * arredondado para baixo. O `alignAnchors` cuida do pe e do centro do
 * CORPO depois, e e ele que decide o alinhamento final — aqui so
 * importa que a arte nao encoste na borda
 */
function centraliza(frame, origem, frameSize) {
  if (origem === frameSize) return frame;

  const out = new Uint8Array(frameSize * frameSize * 4);

  const dx = Math.floor((frameSize - origem) / 2);
  const dy = Math.floor((frameSize - origem) / 2);

  for (let y = 0; y < origem; y += 1) {
    for (let x = 0; x < origem; x += 1) {
      const source = (y * origem + x) * 4;
      const target = ((y + dy) * frameSize + x + dx) * 4;

      out[target] = frame[source];
      out[target + 1] = frame[source + 1];
      out[target + 2] = frame[source + 2];
      out[target + 3] = frame[source + 3];
    }
  }

  return out;
}

function loadGif(file, nome, frameSize) {
  const gif = decodeGif(readFileSync(file));

  /**
   * A arte MENOR que a celula e centralizada; a MAIOR ainda e erro.
   *
   * Centralizar e seguro porque o desenho ja cabe. Uma tela de
   * origem MAIOR que a celula exigiria cortar pixel, e cortar pixel
   * de arte e o que nenhuma folha deve fazer — por isso esse lado
   * continua sendo recusado, com o tamanho na mensagem
   */
  if (gif.width > frameSize || gif.height > frameSize) {
    throw new Error(
      `${nome} tem ${gif.width}x${gif.height}, ` +
        `maior que a celula de ${frameSize}x${frameSize}: ` +
        `seria preciso cortar pixel da arte`,
    );
  }

  if (gif.width !== frameSize || gif.height !== frameSize) {
    for (const frame of gif.frames) {
      frame.rgba = centraliza(
        frame.rgba,
        gif.width,
        frameSize,
      );
    }

    gif.centralizado = `${gif.width}x${gif.height}`;
  }

  return { gif };
}

/**
 * O menor numero de frames do grupo, e o corte de todos nele.
 *
 * A arte nao vem com contagem igual em todas as direcoes: o ogre da
 * predeira tem caminhada de 8 e 9 frames e golpe de 9 e 10. Cortar
 * no MENOR e o que mantem o passo das pernas e o ritmo do golpe
 * iguais em todas as direcoes.
 *
 * A alternativa, completar o grupo repetindo o ultimo frame, faria
 * o ciclo dar um tranco no final da volta: em um loop, segurar o
 * ultimo quadro por um tempo fixo e visivel.
 */
function normalizarFrames(lanes, grupo) {
  const alvo = Math.min(
    ...lanes.map((lane) => lane.gif.frames.length),
  );

  const cortes = [];

  for (const lane of lanes) {
    const total = lane.gif.frames.length;

    if (total === alvo) continue;

    if (total < alvo) {
      throw new Error(
        `${lane.name} tem ${total} frames e o menor do grupo ` +
          `(${grupo}) tem ${alvo}: nao da para completar`,
      );
    }

    cortes.push({
      name: lane.name,
      de: total,
      para: alvo,
    });

    lane.gif.frames.length = alvo;
  }

  return { alvo, cortes };
}

/**
 * Monta uma sheet a partir dos gifs de uma criatura ou classe.
 *
 * `name` e a chave em `SHEETS`. A funcao nao roda nada sozinha: quem
 * chama e decide qual folha montar. Antes o `run()` disparava no
 * import, e um `import { decodeGif }` num script de inspecao
 * regerava a sheet do arqueiro por efeito colateral.
 */
export function buildSheet(name) {
  const sheet = SHEETS[name];

  if (!sheet) {
    throw new Error(
      `sheet desconhecida: ${name} (tem ${Object.keys(SHEETS).join(", ")})`,
    );
  }

  const { frameSize, prefix } = sheet;
  const sourceDir = resolve(HERE, "..", sheet.sourceDir);
  const output = resolve(HERE, "..", sheet.output);

  const querIdle = sheet.idle !== false;
  const querShoot = sheet.shoot !== false;

  // o nome do ciclo vem da arte de origem, e cada folha declara o
  // seu quando nao for o padrao da ferramenta
  const shootDir = sheet.shootDir ?? SHOOT_DIR;
  const idleFile = sheet.idleFile ?? IDLE_FILE;

  // Nenhuma contagem e esperada na carga: a arte de origem nao tem
  // por que ter o mesmo numero de frames em todas as direcoes, e o
  // ajuste para o menor do grupo acontece em `normalizarFrames`
  const walk = ROWS.map((rowName) =>
    loadLane(
      sourceDir,
      frameSize,
      ".",
      rowName,
      null,
      sheet.walkFallback ?? null,
    ),
  );

  const shoot = [];

  if (querShoot) {
    for (const rowName of ROWS) {
      shoot.push(
        loadLane(
          sourceDir,
          frameSize,
          shootDir,
          rowName,
          null,
          sheet.shootFallback ?? null,
        ),
      );
    }
  }

  const walkNorm = normalizarFrames(walk, "walk");
  const shootNorm = querShoot
    ? normalizarFrames(shoot, shootDir)
    : { alvo: 0, cortes: [] };

  // sem idle, a linha de tiro sobe: as linhas da folha sao as que o
  // layout vai ler, e ele e impresso no fim
  const idle = [];

  if (querIdle) {
    idle.push(
      loadLane(sourceDir, frameSize, ".", idleFile, null),
    );
  }

  // as direcoes mantem a contagem de frames porque o ciclo de
  // caminhada e compartilhado; o idle descarta os corrompidos
  // porque o ciclo dele e so dele
  const repairs = [
    ...repairTruncatedFrames(walk),
    ...(querShoot ? repairTruncatedFrames(shoot) : []),
  ];

  const drops = [];

  for (const lane of idle) {
    drops.push(...dropTruncatedFrames(lane));
  }

  if (idle.length > 0) {
    if (idle[0].frames.length < 2) {
      throw new Error(
        `idle.gif ficou com ${idle[0].frames.length} frame valido`,
      );
    }

    /**
     * A capacidade da grade e a MAIOR das linhas que existem, e nao
     * a do golpe.
     *
     * A checagem usava `shootNorm.alvo`, que e 0 numa folha sem
     * golpe: o ghoul faminto tem `idle.gif` e as oito direcoes, mas
     * nao tem arte de ataque, e a ferramenta falhava com "a grade
     * comporta 0" jogando fora uma arte valida. A largura da folha
     * e o maximo de todas as linhas, entao e com ele que o idle se
     * compara
     */
    const capacidade = Math.max(
      walkNorm.alvo,
      shootNorm.alvo,
    );

    if (idle[0].frames.length > capacidade) {
      throw new Error(
        `idle.gif tem ${idle[0].frames.length} frames validos, ` +
          `a grade comporta ${capacidade}`,
      );
    }
  }

  const walkAnchor = alignAnchors(walk, null, frameSize);

  const shared = {
    foot: walkAnchor.targetFoot,
    center: walkAnchor.targetCenter,
  };

  const idleAnchor = alignAnchors(idle, shared, frameSize);
  const shootAnchor = alignAnchors(shoot, shared, frameSize);

  const lanes = [...walk, ...idle, ...shoot];

  const idleRow = walk.length;
  const shootRow = walk.length + idle.length;

  const columns = Math.max(
    walkNorm.alvo,
    idle[0]?.frames.length ?? 0,
    shootNorm.alvo,
  );

  const report = audit(lanes, frameSize);

  if (report.touching > 0) {
    throw new Error(
      `${report.touching} celulas tocam a borda da celula; ` +
        "a arte esta encostando e pode vazar para a vizinha",
    );
  }

  if (report.empty > 0) {
    throw new Error(
      `${report.empty} celulas ficaram vazias apos o reparo`,
    );
  }

  if (report.squashed.length > 0) {
    throw new Error(
      `celulas com o personagem incompleto:\n` +
        report.squashed.map((entry) => `  - ${entry}`).join("\n"),
    );
  }

  const sheetWidth = frameSize * columns;
  const sheetHeight = frameSize * lanes.length;
  const data = new Uint8Array(sheetWidth * sheetHeight * 4);

  for (const [row, lane] of lanes.entries()) {
    for (const [column, frame] of lane.frames.entries()) {
      for (let y = 0; y < frameSize; y += 1) {
        for (let x = 0; x < frameSize; x += 1) {
          const source = (y * frameSize + x) * 4;
          const targetX = column * frameSize + x;
          const targetY = row * frameSize + y;
          const target = (targetY * sheetWidth + targetX) * 4;

          data[target] = frame[source];
          data[target + 1] = frame[source + 1];
          data[target + 2] = frame[source + 2];
          data[target + 3] = frame[source + 3];
        }
      }
    }
  }

  const png = encodePng(data, sheetWidth, sheetHeight);

  const verified = verifySheet(
    png,
    data,
    sheetWidth,
    lanes,
    frameSize,
  );

  writeFileSync(output, png);

  const substitutas = shoot.filter((lane) => lane.substituiu);

  /**
   * As telas de origem que foram centralizadas.
   *
   * Entra no log porque e uma diferenca entre a arte que o jogador
   * mandou e a folha que saiu: um `gif` de 56px dentro de uma celula
   * de 68px tem 6px de margem transparente a mais de cada lado. Sem
   * esta linha o artefato aparecia do nada, e a primeira pessoa a
   * verificar a arte nao teria como saber que ela foi assim
   */
  const centralizados = lanes.filter((lane) => lane.gif.centralizado);

  if (centralizados.length > 0) {
    console.log(
      `\ntelas de origem menores que a celula, centralizadas:`,
    );

    for (const lane of centralizados) {
      console.log(
        `  ${lane.name.padEnd(12)} ${lane.gif.centralizado} ` +
          `-> ${frameSize}x${frameSize}`,
      );
    }
  }

  console.log(
    `\nsheet ${name} gerada: ${sheetWidth}x${sheetHeight} ` +
      `(${columns} colunas x ${lanes.length} linhas: ` +
      `${ROWS.length} walk` +
      `${idle.length > 0 ? " + 1 idle" : " (sem idle)"}` +
      // o boneco de treino so tem direcao: a frase muda, para o
      // relatorio nao anunciar um golpe que nao esta na folha
      `${
        shoot.length > 0
          ? ` + ${ROWS.length} ${shootDir}`
          : " (sem golpe)"
      }, ` +
      `celula ${frameSize}x${frameSize})\n`,
  );

  /**
 * As substituicoes, por ciclo.
 *
 * O log e separado por ciclo porque a RAZAO de cada um e diferente.
 * O golpe do ogre falta em tres direcoes e a folha usa a vizinha mais
 * proxima em grau, que e o que o mapa `shootFallback` declara. A
 * caminhada do rato falta no `south`, e a folha usa a arte de PARADO
 * de frente, que mantem a direcao certa ao custo das patas paradas
 *
 * As duas sao substituicoes declaradas, e nao algo que a ferramenta
 * inventou: sem o mapa, a construcao para com o nome do arquivo que
 * faltou
 */
const substituidasPorCiclo = [
  { ciclo: "walk", lanes: walk.filter((lane) => lane.substituiu) },
  {
    ciclo: shootDir,
    lanes: substitutas,
  },
];

for (const { ciclo, lanes: copiadas } of substituidasPorCiclo) {
  if (copiadas.length === 0) continue;

  console.log(
    `\ndirecoes de ${ciclo} que faltavam na arte e foram ` +
      `copiadas de outra arte:`,
  );

  for (const lane of copiadas) {
    console.log(
      `  ${lane.name.padEnd(12)} <- ${lane.usado}.gif`,
    );
  }
}

  const allOffsets = [
    ...walkAnchor.offsets,
    ...idleAnchor.offsets,
    ...shootAnchor.offsets,
  ];

  for (const [row, lane] of lanes.entries()) {
    const info = report.perRow[row];
    const { dx, dy } = allOffsets[row];

    const group =
      row < walk.length
        ? "walk"
        : row < shootRow
          ? "idle"
          : shootDir;

    // a direcao vem com a marca de quando foi copiada de outra, para
    // o log deixar claro que a linha NAO veio da arte
    const veioDe = lane.substituiu
      ? ` (copiado de ${lane.usado})`
      : "";

    console.log(
      `  ${group.padEnd(6)} ${lane.name.padEnd(12)}${veioDe.padEnd(22)} ` +
        `linha ${String(row).padStart(2)}   ` +
        `frames ${String(lane.frames.length).padStart(2)}   ` +
        `offset ${dx >= 0 ? "+" : ""}${dx},${dy >= 0 ? "+" : ""}${dy}   ` +
        `pes y=${String(info.foot).padStart(2)}   ` +
        `bbox ${info.minX}..${info.maxX} x ${info.minY}..${info.maxY}`,
    );
  }

  for (const corte of [
    ...walkNorm.cortes,
    ...shootNorm.cortes,
  ]) {
    console.log(
      `\n  ${corte.name}: ${corte.de} -> ${corte.para} frames ` +
        `(o grupo foi cortado no menor, para o passo nao mudar ` +
        `de direcao para direcao)`,
    );
  }

  if (repairs.length > 0) {
    console.log("\nframes reparados (stream LZW truncado no gif):");

    for (const repair of repairs) {
      console.log(
        `  ${repair.dir ? `${repair.dir}/` : ""}${repair.name}.gif ` +
          `frame ${repair.index} -> copiado do frame ${repair.from} ` +
          `(${repair.written}/${frameSize * frameSize} pixels)`,
      );
    }
  }

  if (drops.length > 0) {
    console.log("\nframes descartados (stream LZW truncado no gif):");

    for (const drop of drops) {
      console.log(
        `  ${drop.name}.gif frame ${drop.index} ` +
          `(${drop.written}/${frameSize * frameSize} pixels)`,
      );
    }
  }

  console.log(
    `\nconstantes para o modulo de layout:` +
      `\n  celula ${frameSize}x${frameSize}` +
      `\n  ${prefix}_WALK_FRAMES = ${walkNorm.alvo}` +
      (idle.length > 0
        ? `\n  ${prefix}_IDLE_FRAMES = ${idle[0].frames.length}` +
          `\n  ${prefix}_IDLE_ROW = ${idleRow}`
        : "\n  (sem idle: aponte o idle para o frame 0 do walk)") +
      (shoot.length > 0
        ? `\n  ${prefix}_${shootDir.toUpperCase()}_FRAMES = ${shootNorm.alvo}` +
          `\n  ${prefix}_${shootDir.toUpperCase()}_ROW = ${shootRow}`
        : "\n  (sem golpe: a arte nao tem ataque)") +
      `\n  ${prefix}_COLUMNS = ${columns}` +
      `\n  ${prefix}_ANCHOR_X = ${walkAnchor.targetCenter / 2}` +
      `\n  ${prefix}_ANCHOR_Y = ${walkAnchor.targetFoot}`,
  );

  console.log(
    `\nvalidacao: ${verified.cells} celulas, ` +
      `${verified.opaquePixels} pixels opacos, ` +
      "0 divergencia com o png gerado",
  );

  console.log(
    `            ${report.touching} celulas encostando na borda, ` +
      `${report.empty} vazias, ` +
      `${report.squashed.length} com personagem incompleto`,
  );

  const spread = {
    foot: Math.max(...report.perRow.map((i) => i.foot)) -
      Math.min(...report.perRow.map((i) => i.foot)),
    center: Math.max(
      ...report.perRow.map((i) => (i.minX + i.maxX) / 2),
    ) - Math.min(
      ...report.perRow.map((i) => (i.minX + i.maxX) / 2),
    ),
  };

  console.log(
    `            dispersao entre linhas: ` +
      `${spread.foot}px vertical, ${spread.center}px horizontal`,
  );

  console.log(
    `\n-> ${relative(HERE + "/..", output)} (${png.length} bytes)`,
  );

  return {
    name,
    output,
    frameSize,
    width: sheetWidth,
    height: sheetHeight,
    columns,
    rows: lanes.length,
    idleRow: idle.length > 0 ? idleRow : null,
    idleFrames: idle[0]?.frames.length ?? 0,
    shootFrames: shoot.length > 0 ? shootNorm.alvo : 0,
    walkFrames: walkNorm.alvo,
    // `null` quando a folha nao tem golpe: e melhor que zero, porque
    // zero parece "um golpe de zero frames"
    shootRow: shoot.length > 0 ? shootRow : null,
    anchorX: walkAnchor.targetCenter / 2,
    anchorY: walkAnchor.targetFoot,

    // as direcoes de tiro que a arte nao tinha e de onde vieram.
    // Fica no retorno para um teste poder afirmar a escolha, e para
    // quem chamar a ferramenta saber o que foi inventado
    substituidas: substitutas.map((lane) => ({
      direcao: lane.name,
      veioDe: lane.usado,
    })),
  };
}

const executadoDireto =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (executadoDireto) {
  // sem argumento, reconstroi todas as folhas: e o que se espera
  // depois de trocar um gif na pasta da arte
  const pedidos = process.argv.slice(2);
  const folhas = pedidos.length > 0 ? pedidos : Object.keys(SHEETS);

  for (const folha of folhas) {
    buildSheet(folha);
  }
}
