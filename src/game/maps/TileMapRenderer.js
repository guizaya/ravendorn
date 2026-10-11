import { FLIP_HORIZONTAL, FLIP_VERTICAL, FLIP_DIAGONAL } from "./tiled.js";

/**
 * AS CAMADAS DE TILE DO TILED, DESENHADAS.
 *
 * ## POR QUE ISSO NAO E O `TerrainRenderer`
 *
 * Porque o `TerrainRenderer` pinta CHAO, e o chao dele e uma textura unica
 * repetida em `createPattern` — nao ha grade, nao ha indice, nao ha tile. O
 * que o Tiled traz e o oposto: uma grade explicita, tile a tile, com tile de
 * borda, tile de canto e tile de meio, e o desenho correto depende de qual
 * deles caiu em cada celula
 *
 * Forcar o mapa do Tiled pelo `createPattern` mostraria UM tile repetido, e o
 * resultado seria um chao liso onde o mapa tem uma parede de tijolo no meio
 *
 * ## POR QUE A IMAGEM E CARREGADA AQUI E NAO NO `ImageSprite`
 *
 * Porque o tileset e uma folha de tiles, e nao uma animacao: o que muda de
 * celula em celula e o retangulo de origem dentro da mesma imagem. Uma folha
 * de sprite tem indice de quadro; esta tem indice de coluna e linha
 *
 * ## POR QUE O DESENHO E EM COORDENADA DE MUNDO
 *
 * Porque e o que o `GameEngine` faz antes de aplicar a camera, e e o que o
 * `TerrainRenderer` faz. Se este desenhasse em coordenada de tela, o mapa
 * grudaria na tela em vez de andar com o jogador
 */
export default class TileMapRenderer {
  constructor() {
    this.imagens = new Map();

    /**
     * AS IMAGENS QUE JA FALHARAM.
     *
     * Sem isto, uma imagem que da 404 seria pedida de novo a cada quadro,
     * para sempre. O erro de arte e um erro de arte: nao ha recuperacao
     */
    this.falhou = new Set();
  }

  /** A imagem deste tileset ja carregou? */
  isReady(mapa) {
    if (!mapa?.tileset?.url) return false;

    const imagem = this.imagens.get(mapa.tileset.url);

    return Boolean(imagem?.complete && imagem.naturalWidth > 0);
  }

  /**
   * CARREGA A FOLHA DO TILESET.
   *
   * E idempotente: chamar de novo com o mesmo mapa nao cria uma segunda
   * `Image`, o que importaria porque `new Image` dispara um novo download
   */
  load(mapa) {
    const tileset = mapa?.tileset;

    if (!tileset?.url) return false;

    if (this.imagens.has(tileset.url)) return true;

    // ja deu 404 uma vez: nao tenta de novo
    if (this.falhou.has(tileset.url)) return false;

    const imagem = new Image();

    // o desenho e pixel art, e o padrao do motor ja desliga o
    // suavizado; repetir aqui deixa o tile em pixelado mesmo se um dia
    // algum outro desenho ligar o suavizado global
    imagem.decoding = "async";

    imagem.onload = () => {
      this.imagens.set(tileset.url, imagem);
    };

    imagem.onerror = () => {
      this.falhou.add(tileset.url);
    };

    imagem.src = tileset.url;

    return true;
  }

  /**
   * DESENHA AS CAMADAS VISIVEIS.
   *
   * @param {CanvasRenderingContext2D} context
   * @param {object} mapa o que `lerMapaTiled` devolveu
   * @param {object} view a janela visivel, em coordenada de mundo
   */
  draw(context, mapa, view) {
    if (!mapa?.layers?.length) return;

    const tileset = mapa.tileset;

    if (!tileset) return;

    const imagem = this.imagens.get(tileset.url);

    if (!imagem?.complete || !imagem.naturalWidth) return;

    const tw = tileset.tileWidth;
    const th = tileset.tileHeight;

    for (const camada of mapa.layers) {
      this.drawCamada(context, imagem, tileset, camada, tw, th, view);
    }
  }

  /**
   * UMA CAMADA.
   *
   * ## POR QUE O CORTE E POR FAIXA, E NAO POR TILE
   *
   * Porque um tile e 16px e a tela tem milhares: testar "este tile esta
   * visivel" para cada um dos 1875 seria mais caro do que simplesmente
   * pular a faixa inteira que esta fora. O retangulo de celulas e a conta, e
   * o laco interno ja sabe que esta dentro
   */
  drawCamada(context, imagem, tileset, camada, tw, th, view) {
    const primeiroX = Math.max(0, Math.floor(view.x / tw));
    const ultimoX = Math.min(camada.cols - 1, Math.ceil((view.x + view.width) / tw) - 1);
    const primeiroY = Math.max(0, Math.floor(view.y / th));
    const ultimoY = Math.min(camada.rows - 1, Math.ceil((view.y + view.height) / th) - 1);

    if (primeiroX > ultimoX || primeiroY > ultimoY) return;

    const colunaPixels = tw + tileset.spacing;
    const linhaPixels = th + tileset.spacing;

    for (let cy = primeiroY; cy <= ultimoY; cy += 1) {
      for (let cx = primeiroX; cx <= ultimoX; cx += 1) {
        const indice = cy * camada.cols + cx;
        const gid = camada.gids[indice];

        // `-1` e o vazio do Tiled translated para o motor
        if (gid < 0) continue;

        const local = gid - tileset.firstgid;

        // gid fora da folha: e tile apagado no Tiled, e pular e o certo
        if (local < 0 || local >= tileset.tilecount) continue;

        const origemX = tileset.margin + (local % tileset.columns) * colunaPixels;
        const origemY = tileset.margin + Math.floor(local / tileset.columns) * linhaPixels;

        this.drawTile(
          context,
          imagem,
          origemX,
          origemY,
          cx * tw,
          cy * th,
          tw,
          th,
          camada.flags[indice],
        );
      }
    }
  }

  /**
   * UM TILE, COM AS FLAGS DE ESPELHAMENTO.
   *
   * ## POR QUE O CAMINHO NORMAL E O DO ESPELHADO SAO SEPARADOS
   *
   * Porque espelhar e `save`/`scale`/`restore` por tile, e o
   * `save`/`restore` custa mesmo em tile de 16px. No mapa da base sao 1875
   * tiles e UM deles espelhado: pagar o preco da transformacao em 1875 para
   * aproveitar em 1 seria trocar a tela inteira por um tile
   *
   * ## POR QUE A DIAGONAL E UM GIRO, E NAO UM INVERSO
   *
   * Porque espelhar na diagonal nao e inverter X nem inverter Y: e trocar o
   * eixo, e o que troca o eixo no canvas e o giro. Inverter os dois eixos daria
   * o mesmo resultado de inverter so um deles, que e o que a flag vertical
   * sozinha ja faz — as duas flags juntas caem no mesmo desenho que nenhuma
   *
   * O giro acontece em torno do CENTRO do tile, e nao da origem: a origem do
   * `drawImage` e o canto, e girar o canto mandaria o tile para fora do
   * retangulo dele. Para tile quadrado — e o `Walls_street` inteiro — o giro
   * no centro ja cai certo; o `translate` de correcao so mexe quando a arte
   * do tileset for retangular, que e o caso em que o giro troca largura e
   * altura
   */
  drawTile(context, imagem, sx, sy, dx, dy, tw, th, flags) {
    if (flags === 0) {
      context.drawImage(imagem, sx, sy, tw, th, dx, dy, tw, th);
      return;
    }

    const diagonal = (flags & FLIP_DIAGONAL) !== 0;
    const horizontal = (flags & FLIP_HORIZONTAL) !== 0;
    const vertical = (flags & FLIP_VERTICAL) !== 0;

    context.save();

    context.translate(dx + tw / 2, dy + th / 2);

    if (diagonal) {
      context.rotate(Math.PI / 2);

      // o giro trocou largura e altura; recentra para nao sair do retangulo
      context.translate((tw - th) / 2, (th - tw) / 2);
    }

    if (horizontal) context.scale(-1, 1);
    if (vertical) context.scale(1, -1);

    context.drawImage(imagem, sx, sy, tw, th, -tw / 2, -th / 2, tw, th);

    context.restore();
  }
}