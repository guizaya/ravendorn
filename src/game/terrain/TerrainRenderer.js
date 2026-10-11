import {
  BASE_TERRAIN,
  GROUND_TILES,
  GROUND_TILE_SIZE,
  GROUND_USES_TILE,
  groundTileEspelhadoFor,
  groundTileFor,
  groundTileSizeFor,
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

/**
 * A BORDA SUAVE DA ZONA, em pixel de mundo.
 *
 * ## O QUE ELA COMPENSA
 *
 * A zona e um `fillRect` com o ladrilho de terra em cima da grama, e um
 * retangulo de terra sobre um retangulo de grama tem aresta reta. As duas
 * artes sao ruido pintado na mesma escala, entao o olho le a borda como um
 * corte — e um corte nao existe em chao de verdade: onde a terra encontra a
 * grama, o proprio ladrilho da terra ja tem as bordas esgarçadas
 *
 * Por isso o valor e generoso: 88px e um quarto da altura de uma zona, e o
 * suficiente para que a transicao apareca como a terra ENTRANDO na grama e
 * nao como um vinco. Uma borda de 8px ficaria como um borrão, e uma de
 * 200 comeria o campo de provas inteiro
 *
 * Subiu de 48 para 88 depois da primeira versao: com 48 a aresta ainda se
 * via, porque o olho nao le 48px de gradiente como "terra entrando na grama"
 * e sim como um vinco suave — a borda e reta, e reta com borda reta e
 * reta por mais suave que o tom fique. O que esconde uma aresta reta nao e
 * suavizar o tom, e dar LARGURA para o olho perder o vinco
 *
 * ## POR QUE UM GRADIENTE, E NAO UM DESFOQUE
 *
 * O desfoque do `ctx.filter` desfaria a BORDA do retangulo, e a borda e
 * exatamente o que esta ali para ser escondido: ela cortaria o ladrilho
 * num retangulo perfeito de qualquer jeito, so que com a borda borrada
 *
 * Apagar a faixa com `destination-out` e um gradiente e o que deixa o
 * ladrilho de fora aparecer ATRAS da ultima ponta de terra: o pixel de grama
 * que estava embaixo da borda seca e o pixel que a terra estava cobrando.
 * E o desfoque que o jogador queria, feito na fonte
 *
 * ## POR QUE SO QUATRO FAIXAS E NAO A ZONA INTEIRA
 *
 * As quatro faixas somam `4 * 88` px de altura e largura, e nao a area da
 * zona. O miolo e opaco e nao precisa de nenhum tratamento — ele entra
 * com um `fillRect` normal
 */
const EDGE_FEATHER = 88;

/**
 * AS QUATRO FAIXAS DE APAGADO.
 *
 * Cada faixa tem o `eixo` em que corre, o `lado` (-1 ou 1) que diz de que
 * lado da zona ela esta, e o `nome` da borda — que e o que decide se a
 * faixa existe: uma borda fora da tela nao pode ter faixa, ou a dissolucao
 * apareceria no meio da zona
 */
const EDGE_BANDS = [
  { eixo: "y", lado: -1, nome: "cima" },
  { eixo: "y", lado: 1, nome: "baixo" },
  { eixo: "x", lado: -1, nome: "esquerda" },
  { eixo: "x", lado: 1, nome: "direita" },
];

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

    /**
     * O RASCUNHO DA BORDA SUAVE, e ele e um so para todas as zonas.
     *
     * E um canvas do tamanho da JANELA VISIVEL de uma zona, nunca da zona
     * inteira: as zonas chegam a 1900x1200 e alocar isso a cada quadro seria
     * o dobro da memoria a cada 16ms. O recorte e sempre a interseccao da
     * zona com a camera, entao o canvas nunca passa de uma tela
     *
     * E um canvas de rascunho mesmo existindo um `draw` direto: apagar a
     * borda com `destination-out` precisa de uma superficie propria. Fazer
     * isso no contexto do mundo apagaria a grama junto com a terra, e o
     * buraco apareceria em vez da borda suave
     *
     * O tamanho e guardado porque o `width`/`height` de um canvas cria um
     * buffer novo: trocar as dimensoes a cada quadro e a forma mais cara de
     * descobrir que o cache nao existia
     */
    this.zoneEdgeCanvas = null;
    this.zoneEdgeContext = null;
    this.zoneEdgeWidth = 0;
    this.zoneEdgeHeight = 0;

    this.ready = false;
  }

  /**
   * O rascunho do tamanho pedido, reusado entre as zonas e entre os quadros.
   *
   * Devolve `null` sem `document` ou sem contexto 2d, e quem chama cai no
   * preenchimento seco — e melhor uma borda dura que um buraco
   */
  zoneEdgeScratch(width, height) {
    if (typeof document === "undefined") return null;

    const w = Math.max(1, Math.ceil(width));
    const h = Math.max(1, Math.ceil(height));

    if (
      this.zoneEdgeCanvas === null ||
      this.zoneEdgeWidth !== w ||
      this.zoneEdgeHeight !== h
    ) {
      const canvas = document.createElement("canvas");

      if (!canvas) return null;

      canvas.width = w;
      canvas.height = h;

      const contexto = canvas.getContext?.("2d");

      if (!contexto) return null;

      this.zoneEdgeCanvas = canvas;
      this.zoneEdgeContext = contexto;
      this.zoneEdgeWidth = w;
      this.zoneEdgeHeight = h;
    }

    return this.zoneEdgeContext;
  }

  /**
   * A FAIXA DE APAGADO DE UM LADO DA ZONA.
   *
   * ## O GRADIENTE VAI DE OPACO LADO DE FORA A TRANSPARENTE LADO DE DENTRO
   *
   * O `destination-out` remove o que o alpha cobrir, entao quanto mais opaco
   * mais ele apaga. E o LADO DE FORA da zona que precisa sumir — e a aresta
   * reta, o vinco — enquanto o lado de dentro e o miolo da zona, que tem de
* ficar inteiro. Entao o alpha e 1 na borda e 0 no fim da faixa
    *
    * ## O ALPHA CHEIO NA BORDA E O QUE FAZ A FAIXA PRECISAR DE LARGURA
    *
    * Nao existe meio termo na aresta: na borda da zona o alpha e 1 e apaga
    * tudo, ou o ladrilho de terra emendaria com o de grama na linha exata e
    * o vinco voltaria a ser aresta — so que agora sem suavizar o tom. O que
    * se compra e a DISTANCIA entre a ultima ponta de terra e o primeiro tom
    * solido, e e por isso que a faixa tem 88px
    *
    * ## POR QUE O GRADIENTE E INVERTIDO PARA CADA LADO
   *
   * A `createLinearGradient` vai do primeiro ponto ao segundo, e o
   * `addColorStop(0)` fica no primeiro. Para a faixa de cima, "fora" e `y`
   * pequeno e "dentro" e `y` grande, entao o gradiente desce. Para a de
   * baixo, e o contrario. Sao as duas orientacoes de `banda.lado`, e e por
* isso que ele existe: sem ele as faixas de baixo e de direita apagariam
   * o miolo e deixariam a aresta dura do lado errado
   */
  fadeBand(contexto, banda, rect, largura) {
    /**
     * `fora` E A BORDA DA ZONA, e `dentro` E O OUTRO EXTREMO DA FAIXA.
     *
     * E `fora - banda.lado`, e nao `fora + banda.lado`. O `lado` aponta
     * para FORA da zona, entao somar ele sairia da faixa pelo lado oposto:
     * na faixa de cima o gradiente nasceria em y e terminaria em
     * y - largura, acima do retangulo preenchido. O canvas prende o que
     * esta fora dos extremos na cor da ponta, entao a faixa inteira
     * recebia alpha 0 e NAO apagava nada
     *
     * Era esse o defeito que fazia a borda continuar seca: tres dos quatro
     * lados apagavam zero, e o quarto — o de baixo, o unico cujo sinal
     * batia por acaso — quase nunca esta na tela, porque as doze zonas
     * sao maiores que a janela visivel
     */
    const fora =
      banda.eixo === "y"
        ? banda.lado < 0
          ? rect.y
          : rect.y + rect.height
        : banda.lado < 0
          ? rect.x
          : rect.x + rect.width;

    const dentro = fora - banda.lado * largura;

    const gradiente =
      banda.eixo === "y"
        ? contexto.createLinearGradient(0, fora, 0, dentro)
        : contexto.createLinearGradient(fora, 0, dentro, 0);

    if (!gradiente) return false;

    /**
     * A CURVA E SUAVE (smoothstep) E NAO UMA RETA, e e por isso que a
     * aresta parou de se ver.
     *
     * Com os tres pontos antigos — 1, 0.3 no meio, 0 — a queda era
     * relativamente abrupta perto da borda: a maior parte da mudanca de tom
     * acontecia nos ultimos pixels da faixa, que e exatamente onde o olho
     * procura a aresta. O gradiente ficava reto e a aresta aparecia como
     * uma linha, so que com o tom certo
     *
     * Sao cinco pontos que descrevem uma curva `t * t * (3 - 2 * t)`: ela
     * comeca devagar e acaba devagar, entao o tom muda por igual ao longo de
     * toda a faixa e nao ha lugar na aresta onde o tom pule. E o mesmo
     * `smooth` que o `valueNoise` deste arquivo usa para o terreno antigo —
     * a mesma curva, pelo mesmo motivo
     */
    gradiente.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradiente.addColorStop(0.18, "rgba(0, 0, 0, 0.93)");
    gradiente.addColorStop(0.42, "rgba(0, 0, 0, 0.72)");
    gradiente.addColorStop(0.68, "rgba(0, 0, 0, 0.4)");
    gradiente.addColorStop(0.88, "rgba(0, 0, 0, 0.14)");
    gradiente.addColorStop(1, "rgba(0, 0, 0, 0)");

    contexto.fillStyle = gradiente;

    // o retangulo preenchido e a propria faixa, ancorada na borda
    if (banda.eixo === "y") {
      const y = banda.lado < 0 ? rect.y : rect.y + rect.height - largura;

      contexto.fillRect(rect.x, y, rect.width, largura);
    } else {
      const x = banda.lado < 0 ? rect.x : rect.x + rect.width - largura;

      contexto.fillRect(x, rect.y, largura, rect.height);
    }

    return true;
  }

  /**
   * LADrilha a zona e suaviza a BORDA dela.
   *
   * O recorte e sempre a interseccao da zona com a janela visivel, e e o que
   * segura o rascunho em uma tela em vez de 1900px
   */
  paintZoneFeathered(context, zone, padrao, view) {
    const feather = Math.min(EDGE_FEATHER, zone.width / 2, zone.height / 2);

    if (feather <= 0) return false;

    const esquerda = Math.max(zone.x, view.x);
    const topo = Math.max(zone.y, view.y);
    const direita = Math.min(
      zone.x + zone.width,
      view.x + view.width,
    );
    const base = Math.min(
      zone.y + zone.height,
      view.y + view.height,
    );

    const largura = direita - esquerda;
    const altura = base - topo;

    if (largura <= 0 || altura <= 0) return false;

    const scratch = this.zoneEdgeScratch(largura, altura);

    if (!scratch) return false;

    scratch.setTransform?.(1, 0, 0, 1, 0, 0);
    scratch.globalCompositeOperation = "source-over";
    scratch.clearRect(0, 0, largura, altura);

    /**
     * O LADRILHO COMECA NA BORDA DA ZONA, e nao na do recorte.
     *
     * Sem a translacao, o padrao ancoraria no canto do recorte — que e o
     * canto da tela quando a zona e maior que a camera — e o ladrilho
     * andaria junto com a camera. A conta e a mesma do `fillGround`: o
     * terreno e desenhado antes da camera, entao a textura fica presa ao
     * mapa
     */
    scratch.translate(-esquerda, -topo);

    scratch.fillStyle = padrao;
    scratch.fillRect(esquerda, topo, largura, altura);

    /**
     * AS FAIXAS VOLTAM PARA COORDENADA DE RASCUNHO, E ISSO E O PASSO QUE
     * FAZ O EFEITO APARECER.
     *
     * O `translate` acima existe so para o LADRILHO ancorar no mapa. As
     * faixas nao podem herdar a translacao — e nao podem ficar nas
     * coordenadas de mundo tambem, porque o canvas tem o tamanho da
     * JANELA VISIVEL, e nao o da zona: uma zona que comeca em x=80 com a
     * janela em x=2400 pintaria a faixa esquerda em 80 px de um canvas de
     * 1280, ou seja, nos ultimos 4 pixels da tela, e as outras tres cairiam
     * fora do canvas inteiro
     *
     * Por isso o `setTransform` volta para a identidade e as faixas usam o
     * rect do rascunho, que comeca em 0,0
     */
    scratch.setTransform?.(1, 0, 0, 1, 0, 0);

    /**
     * O RECT DAS FAIXAS E O DO RASCUNHO, comeando em 0,0.
     *
     * Nao o rect da zona nem o do recorte visivel: e o canvas. Ver a nota do
     * `setTransform` acima para o porque
     */
    const rect = {
      x: 0,
      y: 0,
      width: largura,
      height: altura,
    };

    /**
     * AS FAIXAS SO EXISTEM ONDE A BORDA DA ZONA ESTA NA TELA.
     *
     * Uma zona maior que a camera tem a borda esquerda fora da tela, e
     * apagar a faixa esquerda ali abriria uma dissolucao no MEIO da zona,
     * na borda da tela. E o defeito mais sutil deste efeito: so aparece
     * quando o jogador anda para o lado, e parece que o mapa esta comendo a
     * propria area de mob
     *
     * ## E PRECISO OLHAR A BORDA REAL, E NAO A DO RECORTE
     *
     * O rect do rascunho sempre comeca em 0,0 e a primeira linha do mapa e
     * em 80 — entao o canto superior esquerdo do rascunho NAO e o canto da
     * zona. Sao coisas diferentes: uma e a janela, outra e a area de mob
     */

    const bordaVisivel = {
      cima: zone.y >= view.y,
      baixo: zone.y + zone.height <= view.y + view.height,
      esquerda: zone.x >= view.x,
      direita: zone.x + zone.width <= view.x + view.width,
    };

    scratch.globalCompositeOperation = "destination-out";

    let desfez = 0;

    for (const banda of EDGE_BANDS) {
      if (!bordaVisivel[banda.nome]) continue;

      if (this.fadeBand(scratch, banda, rect, feather)) {
        desfez += 1;
      }
    }

    scratch.globalCompositeOperation = "source-over";

    if (desfez === 0) return false;

    /**
     * O RASCUNHO vai para o mundo nas coordenadas do recorte.
     *
     * E o mesmo desenho de `fillGround`: o terreno entra antes da camera, e
     * por isso as coordenadas sao de mapa. Passar a largura e a altura aqui
     * daria o tamanho da tela, que e o que o `drawImage` de tres argumentos
     * ja assume
     */
    context.drawImage(
      this.zoneEdgeCanvas,
      esquerda,
      topo,
    );

    return true;
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

    /**
     * A CHAVE DO CACHE E A FOLHA JUNTO COM O LADO, e nao so a folha.
     *
     * O ladrilho e o resultado de duas entradas — a imagem e o lado — e
     * uma so nao basta desde que o lado virou por mapa. Dois mapas com a
     * MESMA folha e escalas diferentes eram o mesmo ladrilho antes, e agora
     * nao sao: sem o lado na chave, o segundo receberia o ladrilho do
     * primeiro e o chao dele sairia na escala alheia
     *
     * Hoje so o `cidade` tem lado proprio, e ele e a unica base que usa
     * essa folha. A chave e por precaution para o proximo mapa que pedir
     * uma escala diferente da mesma arte
     */
    const lado = groundTileSizeFor(map);

    const chave = `${folha}@${lado}`;

    if (this.groundTiles.has(chave)) {
      return this.groundTiles.get(chave);
    }

    // ja tentou e nao deu: nao refaz o trabalho a cada quadro
    if (this.groundTentados.has(chave)) return null;

    this.groundTentados.add(chave);

    if (!this.isGroundReady(map)) return null;

    const reduzido = TerrainRenderer.reduceToTile(
      this.groundImageFor(map),
      lado,
    );

    const tile = groundTileEspelhadoFor(map)
      ? TerrainRenderer.espelharParaLadrilho(reduzido) ?? reduzido
      : reduzido;

    this.groundTiles.set(chave, tile);

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
  fillZoneWithTile(context, zone, map, view) {
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

    /**
     * COM BORDA SUAVE, E COM A BORDA SECA DE RESERVA.
     *
     * O `paintZoneFeathered` desenha num rascunho e precisa de um recorte
     * visivel para caber num canvas de tela. Sem `view` — ou sem `document`
     * para o rascunho — o caminho antigo e o `fillRect` seco, e o mapa
     * continua desenhando em vez de sumir
     */
    if (
      view !== undefined &&
      this.paintZoneFeathered(context, zone, padrao, view)
    ) {
      return true;
    }

    context.fillStyle = padrao;

    context.fillRect(
      zone.x,
      zone.y,
      zone.width,
      zone.height,
    );

    return true;
  }

  fillZone(context, zone, map, view) {
    if (this.fillZoneWithTile(context, zone, map, view)) {
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
    /**
     * O MAPA QUE TEM CHAO PROPRIO.
     *
     * `groundTile: null` e o que a base usa: o mapa dela foi desenhado no
     * Tiled e o `TileMapRenderer` desenha o chao tile a tile. Sem esta
     * saida, o `groundTileFor` cairia na grama do vale — o `??` dele so
     * protege campo AUSENTE, e `null` e ausente de proposito — e a base
     * teria o chao do mapa_1 desenhado por baixo do mapa dela
     *
     * A cor de fundo entra no lugar do ladrilho: e ela que o `drawMap`
     * pintaria se o terreno nao estivesse pronto, e o mapa sem chao ainda
     * precisa de uma cor que nao seja o buraco do canvas
     */
    if (map.groundTile === null) {
      context.fillStyle = map.background;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      return;
    }

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
    /**
     * A GRAMA PRECISA COBRIR TAMBEM A FAIXA DA BORDA, e nao so a tela.
     *
     * A borda suave nao mistura terra com grama dentro de uma imagem: ela
     * apaga a terra com `destination-out`, o que deixa o pixel do rascunho
     * TRANSPARENTE. O que aparece nesse pixel transparente e o que ja estava
     * desenhado no contexto abaixo — e o unico que estava ali era a grama
     *
     * Com a margem de `TILE_SIZE` (32px), a grama parava 32px fora da tela,
     * e a faixa apagada tem 88px. Nos ultimos 56px da borda o pixel
     * transparente caia fora da grama e deixava ver o `clearRect` do render
     * — o fundo vazio do canvas. Era essa a "borda meio branca": nao era a
     * terra clareando, era buraco
     *
     * A margem e a propria faixa, e nao o dobro dela: o apagamento comeca
     * na borda da zona e cresce para DENTRO, entao o que precisa de grama
     * atras e a faixa inteira
     */
    this.fillGround(context, map, {
      x: view.x - EDGE_FEATHER,
      y: view.y - EDGE_FEATHER,
      width: view.width + EDGE_FEATHER * 2,
      height: view.height + EDGE_FEATHER * 2,
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
       *
       * O `view` desce com a zona porque e ele que limita o rascunho da
       * borda suave a uma tela: sem ele nao ha recorte visivel, e a borda
       * cai no `fillRect` seco
       */
      this.fillZone(context, zone, map, view);
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
