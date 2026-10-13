import { FLIP_HORIZONTAL, FLIP_VERTICAL, FLIP_DIAGONAL } from "./tiled.js";

/**
 * "ESTA CELULA NAO TEM FOLHA".
 *
 * E o mesmo `0xFFFF` que o `tiled.js` grava em `folhaDe`, repetido aqui
 * porque este arquivo roda no navegador e o `tiled.js` tambem — mas a
 * constante e privada dele, e uma importacao cruzada por um numero mágico e
 * pior que repetir o numero
 */
const SEM_FOLHA = 0xffff;

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
 * ## E POR QUE UM MAPA PODE TER VARIAS FOLHAS
 *
 * Porque cada tileset do Tiled ocupa uma FAIXA de `gid`: a base tem o `chao`
 * de 1 a 16 e o `estatus1` em 17. Uma folha so nao tem como atender a segunda
 * faixa — o `gid 17` seria procurado na folha do chao, que so tem 16 tiles,
 * e a celula seria pulada em silencio
 *
 * A folha de cada celula ja vem pronta em `camada.folhaDe`, resolvida uma vez
 * na carga do mapa. Aqui nao ha busca nenhuma: o desenho le um indice
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

  /**
   * AS FOLHAS DO MAPA, NA ORDEM DE `firstgid`.
   *
   * ## POR QUE ISTO ACEITA O MAPA ANTIGO, DE UMA FOLHA SO
   *
   * Porque `lerMapaTiled` passou a devolver `folhas`, mas um mapa vindo de
   * outro lugar — um teste, um `catch` do `tiledDoMapa` que monta o mapa na
   * mao — pode ter so o `tileset` singular. Este metodo embrulha os dois e o
   * resto do arquivo nunca precisa saber a diferenca
   */
  folhasDe(mapa) {
    if (Array.isArray(mapa?.folhas) && mapa.folhas.length) return mapa.folhas;
    return mapa?.tileset ? [mapa.tileset] : [];
  }

  /**
   * O MAPA JA TEM ARTE NA TELA?
   *
   * ## POR QUE "PELO MENOS UMA" E NAO "A PRIMEIRA"
   *
   * Porque a condicao precisa responder "o jogador ve o mapa?", e nao "o
   * chao carregou?". Um mapa cujo terreno deu 404 e cujo sprite carregou
   * ainda mostra algo util; negar o desenho inteiro mostraria um buraco
   * preto
   */
  isReady(mapa) {
    return this.folhasDe(mapa).some((folha) => {
      if (!folha?.url) return false;

      const imagem = this.imagens.get(folha.url);

      return Boolean(imagem?.complete && imagem.naturalWidth > 0);
    });
  }

  /**
   * CARREGA AS FOLHAS DO MAPA.
   *
   * E idempotente por `url`: chamar de novo com o mesmo mapa nao cria uma
   * segunda `Image`, o que importaria porque `new Image` dispara um novo
   * download
   *
   * ## E POR QUE UMA FOLHA SEM URL NAO CONTA COMO FALHA
   *
   * Porque `url: null` significa "o autor declarou o tileset mas nao registrou
   * a imagem". Registrar isso em `falhou` seria mentir: o download nem foi
   * tentado, e corrigir o codigo e o que faz a folha aparecer
   */
  load(mapa) {
    let alguma = false;

    for (const folha of this.folhasDe(mapa)) {
      if (!folha?.url) continue;

      alguma = true;

      if (this.imagens.has(folha.url)) continue;

      // ja deu 404 uma vez: nao tenta de novo
      if (this.falhou.has(folha.url)) continue;

      const imagem = new Image();

      // o desenho e pixel art, e o padrao do motor ja desliga o
      // suavizado; repetir aqui deixa o tile em pixelado mesmo se um dia
      // algum outro desenho ligar o suavizado global
      imagem.decoding = "async";

      imagem.onload = () => {
        this.imagens.set(folha.url, imagem);
      };

      imagem.onerror = () => {
        this.falhou.add(folha.url);
      };

      imagem.src = folha.url;
    }

    return alguma;
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

    const folhas = this.folhasDe(mapa);

    if (!folhas.length) return;

    /**
     * O MAIOR TILE DE CADA FOLHA, EM PIXELS DE DESTINO.
     *
     * E o que o corte da tela precisa. O `estatus1` tem tile de 344x192 numa
     * grade de 64x64, entao ele cobre 344px de largura a partir do CENTRO da
     * celula — cerca de 140px de cada lado. Sem esta conta, a tela cortaria
     * a borda de uma estatua que estava ali
     */
    let maiorW = 0;
    let maiorH = 0;

    for (const folha of folhas) {
      if (!folha?.url) continue;

      const imagem = this.imagens.get(folha.url);

      if (!imagem?.complete || !imagem.naturalWidth) continue;

      maiorW = Math.max(maiorW, folha.tileWidth);
      maiorH = Math.max(maiorH, folha.tileHeight);
    }

    if (maiorW === 0) return;

    for (const camada of mapa.layers) {
      this.drawCamada(context, folhas, camada, maiorW, maiorH, view);
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
  drawCamada(context, folhas, camada, maiorW, maiorH, view) {
    /**
     * A CELULA DA GRADE, E NAO O TAMANHO DO TILE.
     *
     * A grade e do MAPA: sao 64x64 na base, e e por ela que a camera se
     * move. O tile e a arte que preenche a celula — e pode ser maior ou
     * menor, sem que a grade mude
     */
    const cellW = camada.cellWidth ?? 64;
    const cellH = camada.cellHeight ?? 64;

    /**
     * QUANTO A ARTE TRANSPORDA DA CELULA, PARA CADA LADO.
     *
     * E o que o corte precisa. O `estatus1` tem 344x192 numa grade de 64x64
     * e e desenhado pelo CENTRO da celula, entao cobre 344px de largura a
     * partir dali — cerca de 140px de cada lado. Sem esta conta, a tela
     * cortaria a borda de uma estatua que estava ali
     */
    const sobraW = Math.max(0, (maiorW - cellW) / 2);
    const sobraH = Math.max(0, (maiorH - cellH) / 2);

    const x0 = view.x - sobraW;
    const y0 = view.y - sobraH;
    const x1 = view.x + view.width + sobraW;
    const y1 = view.y + view.height + sobraH;

    const primeiroX = Math.max(0, Math.floor(x0 / cellW));
    const ultimoX = Math.min(camada.cols - 1, Math.floor(x1 / cellW));
    const primeiroY = Math.max(0, Math.floor(y0 / cellH));
    const ultimoY = Math.min(camada.rows - 1, Math.floor(y1 / cellH));

    if (primeiroX > ultimoX || primeiroY > ultimoY) return;

    for (let cy = primeiroY; cy <= ultimoY; cy += 1) {
      for (let cx = primeiroX; cx <= ultimoX; cx += 1) {
        const indice = cy * camada.cols + cx;

        // `-1` e o vazio do Tiled translated para o motor
        if (camada.gids[indice] < 0) continue;

        const folha = folhas[camada.folhaDe?.[indice] ?? SEM_FOLHA];

        // celula pintada com um tileset que foi apagado: pular e o certo
        if (!folha?.url) continue;

        const imagem = this.imagens.get(folha.url);

        if (!imagem?.complete || !imagem.naturalWidth) continue;

        const gid = camada.gids[indice];
        const local = gid - folha.firstgid;

        if (local < 0 || local >= folha.tilecount) continue;

        const colunaPixels = folha.tileWidth + folha.spacing;
        const linhaPixels = folha.tileHeight + folha.spacing;

        const origemX =
          folha.margin + (local % folha.columns) * colunaPixels;
        const origemY =
          folha.margin + Math.floor(local / folha.columns) * linhaPixels;

        /**
         * ONDE O TILE CAI.
         *
         * E o CENTRO da celula. E assim que o Tiled desenha: uma arte maior
         * que a celula nao e espremida nem recortada, ela transborda para os
         * lados. O `estatus1` e a razao de existir deste bloco — 344x192
         * numa grade de 64x64 daria uma estatua achatada se fosse espremida
         * na celula
         */
        const centroX = cx * cellW + cellW / 2;
        const centroY = cy * cellH + cellH / 2;

        const destinoX = Math.round(centroX - folha.tileWidth / 2);
        const destinoY = Math.round(centroY - folha.tileHeight / 2);

        /**
         * QUANDO O TILE E MENOR QUE A CELULA, DESENHA DO TAMANHO DA ARTE.
         *
         * Um tile de 16px numa celula de 64px ficaria com 48px de vazio em
         * volta se fosse esticado ate a celula — e o mapa da base encolheria
         * inteiro. E por isso que o destino usa `tileWidth`/`tileHeight`, e
         * nao o tamanho da celula
         */
        this.drawTile(
          context,
          imagem,
          origemX,
          origemY,
          destinoX,
          destinoY,
          folha.tileWidth,
          folha.tileHeight,
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
