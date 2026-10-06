import {
  BASE_TERRAIN,
  GROUND_TILES,
  GROUND_TILE_SIZE,
  GROUND_USES_TILE,
  groundTileEspelhadoFor,
  groundTileFor,
  TILE_SIZE,
  TILE_VARIANTS,
  TERRAIN_ROW,
  TERRAIN_SHEETS,
  ZONE_TILE_SIZE,
  zoneTileFor,
  ZONES_USE_TILE,
  zoneUsesTile,
} from "../../data/terrain/index.js";
/**
 * A margem usada para descartar as zonas fora da tela.
 *
 * Chamava-se BAND por causa da faixa de transicao, que ocupava
 * exatamente uma tile em volta de cada zona. A faixa saiu; o cull
 * continuou, e o nome agora nao tem mais a quem se referir
 */
const CULL_MARGIN = TILE_SIZE;
const PATCH_TILES = 8;
const PATCH_SIZE = TILE_SIZE * PATCH_TILES;
const PATCH_CELL = 96;

function hash2(x, y, seed) {
  let h = seed | 0;

  h = Math.imul(h ^ (x * 374761393), 0x27d4eb2d);
  h = Math.imul(h ^ (y * 668265263), 0x85ebca6b);

  h ^= h >>> 13;

  h = Math.imul(h, 0xc2b2ae35);

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(seed, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);

  const tx = smooth(x - xi);
  const ty = smooth(y - yi);

  const top =
    hash2(xi, yi, seed) +
    (hash2(xi + 1, yi, seed) - hash2(xi, yi, seed)) * tx;

  const bottom =
    hash2(xi, yi + 1, seed) +
    (hash2(xi + 1, yi + 1, seed) - hash2(xi, yi + 1, seed)) *
      tx;

  return top + (bottom - top) * ty;
}

function fbm(seed, x, y, octaves = 2) {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total +=
      valueNoise(seed + octave, x * frequency, y * frequency) *
      amplitude;

    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / norm;
}

function loadImage(src) {
  if (typeof Image === "undefined") return null;

  const image = new Image();

  image.src = src;

  return image;
}

function variantAt(column, row, salt = 0) {
  const value =
    (column * 73856093) ^
    (row * 19349663) ^
    (salt * 83492791);

  return Math.abs(value) % TILE_VARIANTS;
}

export class TerrainRenderer {
  constructor() {
    this.terrain = loadImage(TERRAIN_SHEETS.terrain);
    this.features = loadImage(TERRAIN_SHEETS.features);


    /**
     * As folhas de chao, uma imagem cada.
     *
     * Sao dois chos no projeto: a grama do vale e o calcamento do
     * hub. O cache e por URL, que e o que identifica a folha — sem
     * ele, trocar de mapa buscaria a mesma textura a cada quadro
     *
     * Nenhuma delas entra no `isReady()`: sao 450KB e 250KB, e um JPG
     * que demore ou falhe nao pode deixar o mundo inteiro em branco. O
     * `fillGround` so usa o tile quando ele carregou, e cai no pixel art
     * de 32px enquanto isso
     */
    this.groundImages = new Map();

    if (GROUND_USES_TILE) {
      for (const folha of Object.values(GROUND_TILES)) {
        this.groundImages.set(folha, loadImage(folha));
      }
    }

    /**
     * O tile reduzido e o padrao, POR FOLHA.
     *
     * Sao dois chos no projeto e cada um tem o seu tile de 128px. Um
     * `groundTile` unico teria o padrao da grama sendo desenhado no
     * calcamento do hub
     *
     * `groundTentados` marca as folhas ja tentadas: uma folha que nao
     * deu para reduzir nao pode virar trabalho repetido a cada quadro
     */
    this.groundTiles = new Map();
    this.groundTentados = new Set();
    this.groundPatterns = new Map();

    /**
     * O terreno das areas de mob, ladrilhado por MAPA
     *
     * Antes era uma folha so, carregada no construtor. Com o mapa 2
     * declarando a terra dele, uma unica folha passaria a repintar o
     * mapa errado na hora da troca: o cache e por URL, igual ao do
     * chao, e a folha do mapa que esta em cena e a que foi pedida
     *
     * Fora do `isReady()` pelo mesmo motivo das folhas de chao: uma arte
     * de 250KB que falha devolve a zona ao pixel art de 32px, e nao um
     * buraco no meio do mapa
     */
    this.zoneImages = new Map();

    this.zoneTiles = new Map();
    this.zonePatterns = new Map();

    this.patches = new Map();
    this.zoneGrids = new Map();

    this.ready = false;
  }

  /**
   * A folha de chao de um mapa, ou null se nao carregou
   *
   * `groundTileFor` traduz a chave do mapa para a URL, e o cache
   * guarda a imagem por URL
   */
  groundImageFor(map) {
    return this.groundImages.get(groundTileFor(map)) ?? null;
  }

  isGroundReady(map) {
    const image = this.groundImageFor(map);

    return (
      image !== null &&
      image.complete === true &&
      (image.naturalWidth ?? image.width ?? 0) > 0
    );
  }

  /**
   * A FOLHA DE TERRA DESTE MAPA, ou null se nao carregou.
   *
   * O cache e por URL, igual ao do chao: o mapa 1 pede a terra do
   * vale e o mapa 2 pede a dele, e cada uma e carregada uma vez so
   */
  zoneImageFor(map) {
    const folha = zoneTileFor(map);

    if (this.zoneImages.has(folha)) {
      return this.zoneImages.get(folha);
    }

    const image = ZONES_USE_TILE ? loadImage(folha) : null;

    this.zoneImages.set(folha, image);

    return image;
  }

  isZoneReady(map) {
    const image = this.zoneImageFor(map);

    return (
      image !== null &&
      image.complete === true &&
      (image.naturalWidth ?? image.width ?? 0) > 0
    );
  }

  /**
   * REDUZ UMA ARTE DE 1600px PARA UM TILE DE 128px.
   *
   * Vale para as duas artes do mapa — o `grama.jpg` do chao e o
   * `terra.jpg` das areas de mob — e e a mesma conta nas duas, entao
   * esta funcao e o unico lugar onde ela existe
   *
   * As imagens sao JPEG e o projeto nao tem decodificador de imagem, entao
   * a reducao acontece no carregamento, no navegador. O arquivo de 1600px
   * continua sendo o que se baixa
   *
   * A REDUCAO E FEITA POR METADES, e nao em um salto so
   *
   * Cair de 1600 para 128 em um `drawImage` e um fator de 12,5 de uma
   * vez: o navegador amostra poucos pontos de cada grupo e o grao vira
   * um xadrez. Cortando pela metade — 1600, 800, 400, 200 — cada degrau e
   * um fator de 2, que o navegador resolve bem, e so o ultimo passo cai
   * de 200 para 128
   *
   * Devolve `null` quando nao da: sem `document`, sem contexto 2d, ou a
   * arte sem largura. Quem chama cai no caminho antigo
   */
  static reduceToTile(image, tamanho) {
    if (typeof document === "undefined") return null;

    const natural = image.naturalWidth ?? image.width;

    if (!natural || natural <= 0) return null;

    // a arte ja veio no tamanho certo: usa ela mesma
    if (natural === tamanho) return image;

    const canvas = document.createElement("canvas");

    if (!canvas) return null;

    canvas.width = tamanho;
    canvas.height = tamanho;

    const contexto = canvas.getContext?.("2d");

    if (!contexto) return null;

    let fonte = image;
    let lado = natural;

    while (lado > tamanho * 2) {
      const proximo = Math.max(
        tamanho,
        Math.round(lado / 2),
      );

      const degrau = document.createElement("canvas");

      if (!degrau) return null;

      degrau.width = proximo;
      degrau.height = proximo;

      const ctxDegrau = degrau.getContext?.("2d");

      if (!ctxDegrau) return null;

      ctxDegrau.imageSmoothingEnabled = true;
      ctxDegrau.imageSmoothingQuality = "high";

      ctxDegrau.drawImage(
        fonte,
        0,
        0,
        proximo,
        proximo,
      );

      fonte = degrau;
      lado = proximo;
    }

    contexto.imageSmoothingEnabled = true;
    contexto.imageSmoothingQuality = "high";

    contexto.drawImage(
      fonte,
      0,
      0,
      tamanho,
      tamanho,
    );

    return canvas;
  }

  /**
   * O TILE ESPELHADO, que fecha a emenda.
   *
   * A arte entra quatro vezes num canvas do dobro: normal, espelhada
   * na horizontal, espelhada na vertical e espelhada nos dois eixos.
   * A borda direita do quadrante normal encosta na borda esquerda do
   * espelhado — que e a propria borda esquerda da arte — entao os dois
   * lados casam por construcao e a emenda desaparece
   *
   * So e usado nos mapas declarados em `GROUND_TILE_ESPELHADO`: a
   * grama e o calcamento ja vem continuos, e espelhar arte que ja
   * fecha so mudaria o visual de mapas que estao certos
   */
  static espelharParaLadrilho(tile) {
    if (!tile) return null;

    const lado = tile.width;

    if (!lado) return null;

    const canvas = document.createElement("canvas");

    if (!canvas) return null;

    canvas.width = lado * 2;
    canvas.height = lado * 2;

    const ctx = canvas.getContext?.("2d");

    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // superior esquerdo: a arte como veio
    ctx.drawImage(tile, 0, 0);

    // superior direito: espelhado no eixo X
    ctx.save();
    ctx.translate(lado * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(tile, 0, 0);
    ctx.restore();

    // inferior esquerdo: espelhado no eixo Y
    ctx.save();
    ctx.translate(0, lado * 2);
    ctx.scale(1, -1);
    ctx.drawImage(tile, 0, 0);
    ctx.restore();

    // inferior direito: espelhado nos dois eixos
    ctx.save();
    ctx.translate(lado * 2, lado * 2);
    ctx.scale(-1, -1);
    ctx.drawImage(tile, 0, 0);
    ctx.restore();

    return canvas;
  }

  /**
   * O tile do chao, memorizado.
   *
   * `groundTentou` impede que a tentativa fracassada vire trabalho
   * repetido a cada quadro
   */
  buildGroundTile(map) {
    const folha = groundTileFor(map);

    if (this.groundTiles.has(folha)) {
      return this.groundTiles.get(folha);
    }

    // ja tentou e nao deu: nao refaz o trabalho a cada quadro
    if (this.groundTentados.has(folha)) return null;

    this.groundTentados.add(folha);

    if (!this.isGroundReady(map)) return null;

    const reduzido = TerrainRenderer.reduceToTile(
      this.groundImageFor(map),
      GROUND_TILE_SIZE,
    );

    const tile = groundTileEspelhadoFor(map)
      ? TerrainRenderer.espelharParaLadrilho(reduzido) ?? reduzido
      : reduzido;

    this.groundTiles.set(folha, tile);

    return tile;
  }

  /**
   * O tile de terra das areas de mob deste mapa, memorizado.
   *
   * Mesma conta do chao, sobre a terra que o mapa declarar. O cache e
   * por URL: sao duas terras no projeto e cada uma e reduzida uma vez
   * so, mesmo entrando e saindo do mapa varias vezes
   *
   * ## POR QUE NAO HAI MAIS O "JA TENTOU E NAO DEU"
   *
   * A folha da zona e carregada sob demanda, e no primeiro quadro ela
   * ainda esta baixando. A guarda de tentativa marcava a folha como
   * descartada PARA SEMPRE nesse primeiro `false` — e a zona vivia
   * caindo no pixel art de 32px, que e o terreno antigo, para sempre
   *
   * O guarda so fazia sentido quando a folha era carregada no
   * construtor, antes do primeiro quadro. Nao ha tentativa a repetir
   * agora: enquanto a imagem nao carrega, este metodo sai antes de
   * reduzir qualquer coisa, e o `zoneTiles` ja evita refazer o ladrilho
   * depois de pronto
   */
  buildZoneTile(map) {
    const folha = zoneTileFor(map);

    if (this.zoneTiles.has(folha)) {
      return this.zoneTiles.get(folha);
    }

    if (!this.isZoneReady(map)) return null;

    const tile = TerrainRenderer.reduceToTile(
      this.zoneImageFor(map),
      ZONE_TILE_SIZE,
    );

    this.zoneTiles.set(folha, tile);

    return tile;
  }

  /**
   * O mapa so precisa da folha de terreno agora.
   *
   * Antes esta checava a `transitions` tambem, e o mapa ficava esperando
   * uma imagem de 12,9KB que nao era mais desenhada — o mundo inteiro
   * dependia de uma arte que ninguem via
   */
  isReady() {
    return (
      this.terrain !== null &&
      this.terrain.complete === true
    );
  }

  buildPatch(typeId) {
    const cached = this.patches.get(typeId);

    if (cached) return cached;

    if (typeof document === "undefined") {
      return null;
    }

    const canvas = document.createElement("canvas");

    canvas.width = PATCH_SIZE;
    canvas.height = PATCH_SIZE;

    const patchContext = canvas.getContext("2d");

    if (!patchContext) return null;

    patchContext.imageSmoothingEnabled = false;

    const row = TERRAIN_ROW[typeId] ?? 0;

    for (let y = 0; y < PATCH_TILES; y += 1) {
      for (let x = 0; x < PATCH_TILES; x += 1) {
        patchContext.drawImage(
          this.terrain,
          (x % TILE_VARIANTS) * TILE_SIZE,
          row * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
          x * TILE_SIZE,
          y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
      }
    }

    const entry = { canvas, pattern: null };

    this.patches.set(typeId, entry);

    return entry;
  }

  getPattern(context, typeId) {
    const entry = this.patches.get(typeId);

    if (!entry) return null;

    if (entry.pattern !== null) {
      return entry.pattern;
    }

    entry.pattern =
      context.createPattern?.(entry.canvas, "repeat") ??
      null;

    return entry.pattern;
  }

  blitPatch(context, entry, rect) {
    const startX =
      Math.floor(rect.x / PATCH_SIZE) * PATCH_SIZE;
    const startY =
      Math.floor(rect.y / PATCH_SIZE) * PATCH_SIZE;

    const endX = rect.x + rect.width;
    const endY = rect.y + rect.height;

    for (let y = startY; y < endY; y += PATCH_SIZE) {
      for (
        let x = startX;
        x < endX;
        x += PATCH_SIZE
      ) {
        context.drawImage(
          entry.canvas,
          x,
          y,
        );
      }
    }
  }

  fillTerrain(context, typeId, rect) {
    const entry = this.buildPatch(typeId);

    if (entry) {
      const pattern = this.getPattern(
        context,
        typeId,
      );

      if (pattern) {
        context.fillStyle = pattern;
        context.fillRect(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
        );

        return;
      }

      this.blitPatch(context, entry, rect);
      return;
    }

    const startX = Math.floor(rect.x / TILE_SIZE);
    const endX = Math.ceil(
      (rect.x + rect.width) / TILE_SIZE,
    );
    const startY = Math.floor(rect.y / TILE_SIZE);
    const endY = Math.ceil(
      (rect.y + rect.height) / TILE_SIZE,
    );

    for (let row = startY; row < endY; row += 1) {
      for (
        let column = startX;
        column < endX;
        column += 1
      ) {
        this.drawTerrain(
          context,
          typeId,
          column * TILE_SIZE,
          row * TILE_SIZE,
        );
      }
    }
  }

  drawTerrain(
    context,
    typeId,
    x,
    y,
    salt = 0,
  ) {
    const row = TERRAIN_ROW[typeId] ?? 0;

    const column = variantAt(
      Math.floor(x / TILE_SIZE),
      Math.floor(y / TILE_SIZE),
      salt,
    );

    context.drawImage(
      this.terrain,
      column * TILE_SIZE,
      row * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      x,
      y,
      TILE_SIZE,
      TILE_SIZE,
    );
  }

  fillTerrainLegacy(
    context,
    typeId,
    rect,
    salt = 0,
  ) {
    const startX = Math.floor(rect.x / TILE_SIZE);
    const endX = Math.ceil(
      (rect.x + rect.width) / TILE_SIZE,
    );
    const startY = Math.floor(rect.y / TILE_SIZE);
    const endY = Math.ceil(
      (rect.y + rect.height) / TILE_SIZE,
    );

    for (let row = startY; row < endY; row += 1) {
      for (
        let column = startX;
        column < endX;
        column += 1
      ) {
        this.drawTerrain(
          context,
          typeId,
          column * TILE_SIZE,
          row * TILE_SIZE,
          salt,
        );
      }
    }
  }

  /**
 * A FAIXA DE BORDA DA ZONA FOI REMOVIDA.
 *
 * Era aqui que vivia o `drawTransitionBand` e o `drawZoneEdges`, que
 * desenhavam uma faixa de 32px em volta de cada zona misturando o
 * terreno dela com o de fora
 *
 * Saiu porque o chao virou o `grama.jpg`, uma textura pintada de
 * 128px, e a faixa era pixel art de 32px: as duas se juntavam num
 * contorno serrilhado em volta das 12 areas de mob
 *
 * A BORDA FICOU SECA, e a leitura da area continua por corte. Uma zona
 * de pixel art dentro de um chao pintado ja se destaca pelo estilo, e
 * nao precisa de mistura para se mostrar
 */
  zoneGrid(zone) {
    const cached = this.zoneGrids.get(zone.id);

    if (cached) return cached;

    const alt = zone.terrainAlt ?? zone.terrain;

    if (!zone.terrainAlt) {
      this.zoneGrids.set(zone.id, null);
      return null;
    }

    const columns = Math.max(
      1,
      Math.ceil(zone.width / PATCH_CELL),
    );
    const rows = Math.max(
      1,
      Math.ceil(zone.height / PATCH_CELL),
    );

    const bias = zone.altBias ?? 0.25;

    const seed = zone.id
      .split("")
      .reduce((sum, c) => sum + c.charCodeAt(0), 0);

    const cells = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const value = fbm(
          seed,
          (column / columns) * 3.4,
          (row / rows) * 3.4,
          2,
        );

        cells.push(
          value > bias ? alt : zone.terrain,
        );
      }
    }

    const entry = { columns, rows, cells };

    this.zoneGrids.set(zone.id, entry);

    return entry;
  }

  /**
 * * ladrilha a zona com o `terra.jpg`
 *
 * E o caminho das 11 areas de mob. A zona toda e um unico
 * `fillRect` com padrao, e nao uma grade de patches
 *
 * O caminho antigo montava uma grade por zona, sorteando com `fbm` se
 * cada celula era o `terrain` ou o `terrainAlt` — e depois colava as
 * celulas iguais em retangulos. Com o ladrilho de terra as onze zonas
 * ficaram com o MESMO terrerno de ponta a ponta, entao a grade inteira
 * virou um retangulo so, e essa conta sai da tela
 *
 * Devolve `false` quando o ladrilho nao deu, e o `fillZone` cai no
 * pixel art: e melhor um ladrilho de 32px velho do que um buraco
 */
  fillZoneWithTile(context, zone, map) {
    if (!zoneUsesTile(zone)) return false;

    const folha = zoneTileFor(map);

    /**
     * O PADRAO E POR MAPA, e nao um campo solto.
     *
     * Com uma unica zona no mundo inteiro, entrar no mapa 2 depois do
     * mapa 1 reaproveitaria o padrao da terra do vale — e o cambio de
     * mapa trocaria a geometria e nao a textura
     */
    if (!this.zonePatterns.has(folha)) {
      /**
       * A FOLHA AINDA ESTA BAIXANDO: NAO GUARDA NADA.
       *
       * O ladrilho e a imagem sao montados sob demanda, e no primeiro
       * quadro nenhum dos dois existe ainda. Guardar esse resultado
       * vazio era o que prendia a zona no pixel art de 32px para
       * sempre: o cache dizia "ja resolvido" com `null`, e nenhum
       * quadro depois voltava a tentar
       *
       * Devolver `false` sem tocar no cache faz o proximo quadro
       * tentar de novo. E o que resolve: a imagem baixa uma vez — o
       * `zoneImages` guarda o objeto `Image`, entao nao ha nova
       * requisição por quadro — e o ladrilho nasce assim que ela
       * estiver pronta
       */
      const imagem = this.zoneImageFor(map);

      // a arte crua de 1600px so serve de reserva quando o ladrilho de
      // 128px nao deu, e nao enquanto a imagem esta baixando
      const ladrilho =
        this.buildZoneTile(map) ??
        (this.isZoneReady(map) ? imagem : null);

      if (!ladrilho) return false;

      let padrao = null;

      try {
        padrao =
          context.createPattern?.(ladrilho, "repeat") ?? null;
      } catch {
        padrao = null;
      }

      // um padrao que naobornou tambem nao entra no cache: o
      // `createPattern` pode recusar uma imagem que so agora ficou
      // pronta, e no quadro seguinte ela serve
      if (!padrao) return false;

      this.zonePatterns.set(folha, padrao);
    }
    const padrao = this.zonePatterns.get(folha);

    if (!padrao) return false;

    context.fillStyle = padrao;

    context.fillRect(
      zone.x,
      zone.y,
      zone.width,
      zone.height,
    );

    return true;
  }

  fillZone(context, zone, map) {
    if (this.fillZoneWithTile(context, zone, map)) {
      return;
    }

    const grid = this.zoneGrid(zone);

    if (!grid) {
      this.fillTerrain(
        context,
        zone.terrain,
        zone,
      );

      return;
    }

    const { columns, rows, cells } = grid;

    const originX = Math.floor(zone.x / PATCH_CELL);
    const originY = Math.floor(zone.y / PATCH_CELL);

    const used = new Uint8Array(columns * rows);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;

        if (used[index]) continue;

        const terrain = cells[index];

        let span = 1;

        while (
          column + span < columns &&
          used[index + span] === 0 &&
          cells[index + span] === terrain
        ) {
          span += 1;
        }

        let height = 1;

        let fits = true;

        while (row + height < rows) {
          for (let step = 0; step < span; step += 1) {
            const next =
              (row + height) * columns + column + step;

            if (
              used[next] !== 0 ||
              cells[next] !== terrain
            ) {
              fits = false;
              break;
            }
          }

          if (!fits) break;

          height += 1;
        }

        for (let dr = 0; dr < height; dr += 1) {
          for (let dc = 0; dc < span; dc += 1) {
            used[(row + dr) * columns + column + dc] = 1;
          }
        }

        const x = (originX + column) * PATCH_CELL;
        const y = (originY + row) * PATCH_CELL;

        this.fillTerrain(
          context,
          terrain,
          {
            x,
            y,
            width: span * PATCH_CELL,
            height: height * PATCH_CELL,
          },
        );
      }
    }
  }

  /**
   * O chao de fora das zonas: o `grama.jpg` ladrilhado.
   *
   * E um `createPattern` com um `fillRect`, e nao um laço de tiles. O
   * `grama.jpg` tem 1600px, entao o tile e grande demais para caber no
   * canvas de patch de 256px do `buildPatch` sem virar um borrão — e
   *ladrilhar a imagem direto mantem o detalhe
   *
   * O preenchimento acontece em coordenada de MUNDO: o `GameEngine`
   * chama o terreno antes de aplicar a camera, entao o ladrilho anda
   * junto com o mapa e nao gruda na tela
   *
   * Se o tile nao carregou, ou o navegador nao souber criar padrao
   * com imagem, cai no pixel art de 32px. O vale sempre tem chao
   */
  fillGround(context, map, rect) {
    if (!this.isGroundReady(map)) {
      this.fillTerrain(context, BASE_TERRAIN, rect);
      return;
    }

    const folha = groundTileFor(map);

    if (!this.groundPatterns.has(folha)) {
      /**
       * Do canvas de 128px quando deu para construir, e da arte crua
       * quando nao deu
       *
       * A arte de 1600px funciona como padrao — e o que havia antes
       * desta reducao — entao ela continua sendo o segundo caminho, e o
       * pixel art de 32px continua sendo o terceiro
       */
      const ladrilho =
        this.buildGroundTile(map) ?? this.groundImageFor(map);

      let padrao = null;

      try {
        padrao =
          context.createPattern?.(ladrilho, "repeat") ??
          null;
      } catch {
        // alguns ambientes lancam em vez de devolver null
        padrao = null;
      }

      this.groundPatterns.set(folha, padrao);
    }

    const padrao = this.groundPatterns.get(folha);

    if (!padrao) {
      this.fillTerrain(context, BASE_TERRAIN, rect);
      return;
    }

    context.fillStyle = padrao;

    context.fillRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
  }

  draw(context, map, zones, view) {
    this.fillGround(context, map, {
      x: view.x - TILE_SIZE,
      y: view.y - TILE_SIZE,
      width: view.width + TILE_SIZE * 2,
      height: view.height + TILE_SIZE * 2,
    });

    for (const zone of zones) {
      if (
        zone.x > view.x + view.width + CULL_MARGIN ||
        zone.y > view.y + view.height + CULL_MARGIN ||
        zone.x + zone.width < view.x - CULL_MARGIN ||
        zone.y + zone.height < view.y - CULL_MARGIN
      ) {
        continue;
      }

      /**
       * Nenhuma zona e pulada aqui.
       *
       * Houve um tempo em que o campo de provas era a unica de fora, e o
       * `draw` pulava ela para o chao do mapa aparecer. Agora as doze
       * entram no mesmo `fillZone`, e o campo de provas usa o mesmo
       * ladrilho de terra das onze areas de mob
       */
      this.fillZone(context, zone, map);
    }
  }

  terrainAt(x, y, zones) {
    for (const zone of zones) {
      if (
        x >= zone.x &&
        x < zone.x + zone.width &&
        y >= zone.y &&
        y < zone.y + zone.height
      ) {
        return zone.terrain ?? BASE_TERRAIN;
      }
    }

    return BASE_TERRAIN;
  }
}
