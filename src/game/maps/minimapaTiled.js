/**
 * O MAPA DO MAPA 1 PRONTO PARA O MINIMAPA.
 *
 * ## O QUE ISTO FAZ
 *
 * Pega a grade de tiles do `.tmj` e desenha uma vez num canvas fora de tela,
 * na escala do minimapa. O `drawMinimap` entao so copia esse canvas pronto
 *
 * ## POR QUE UM CANVAS FORA DE TELA, E NAO `drawImage` POR TILE
 *
 * Porque o mapa 1 tem 6204 tiles. Desenhar tile a tile a cada quadro, a 60Hz,
 * sao 372 mil `drawImage` por segundo para redesenhar uma imagem que nao
 * muda. O canvas fora de tela resolve: o mapa e desenhado uma vez, e o
 * minimapa so copia
 *
 * ## POR QUE A COR MEDIA DE CADA TILE, E NAO O TILE REDUZIDO
 *
 * ## O DEFEITO QUE O TILE REDUZIDO CAUSAVA
 *
 * Um tile de 64px neste mapa sai com 2.5px no minimapa. O motor desliga o
 * suavizado, que e o certo para pixel art na tela, entao o canvas faz
 * nearest-neighbor: dos 4096 pixels do tile, so 9 chegam na tela, e sao os
 * de origem 0, 25 e 50. Quase a diagonal, nunca o miolo
 *
 * O resultado dependia de ONDE o detalhe estava pintado dentro do tile. Se o
 * desenho encostava no canto amostrado, aparecia; se estava no meio, o tile
 * virava uma mancha lisa. Metade do mapa ficava "normal" e metade parecia
 * errada, sem nenhum padrao, que e exatamente o sintoma de uma area com
 * coisa errada no minimapa
 *
 * ## E POR QUE A MEDIA RESOLVE
 *
 * Porque a media e o mesmo para o tile inteiro, e nao muda com o alinhamento:
 * o tile de parede vira sempre a mesma cor escura, o de chao a mesma cor de
 * chao. O contraste entre parede e chao, que e o que o olho le no minimapa,
 * sobrevive inteiro, sem depender de onde o tijolo foi pintado
 *
 * ## E POR QUE O MAPA DO JOGO NAO MUDA
 *
 * Porque isto e so o canvas do minimapa. Na tela o tile continua 64px, com o
 * desenho inteiro. E um resumo do mapa, nao uma versao diferente dele
 *
 * ## E POR QUE SO O MAPA QUE TEM CAMADA
 *
 * Porque `tiledDoMapa` devolve `null` para quem nao tem `.tmj`, e o minimapa
 * dos outros mapas continua desenhando as zonas, que e a unica coisa que
 * eles tem para mostrar
 */

/** O PASSO ENTRE OS PIXELS QUE A MEDIA LE, para nao varrer 4096 por tile. */
const PASSO_DA_AMOSTRA = 8;

/**
 * O CANVAS JA PRONTO, por `mapId`.
 *
 * E um `Map` e nao um campo solto porque o minimapa e desenhado para varios
 * mapas no servidor: dois jogadores em mapas diferentes, um `canvas` unico
 * seria sobrescrito pelo outro a cada quadro
 */
const prontos = new Map();

/**
 * O MAPA ESTA PRONTO PARA O MINIMAPA?
 *
 * E o que o `drawMinimap` pergunta antes de copiar, e o que evita o
 * `getContext` de um canvas que nao existe
 */
export function minimapaPronto(mapId) {
  return prontos.has(mapId);
}

/**
 * DESENHA O MAPA NUM CANVAS E GUARDA.
 *
 * Idempotente por `mapId`: chamar de novo com o mesmo mapa nao redesenha.
 * E o que mantem o custo em um quadro por mapa, em vez de um por quadro
 *
 * @param {string} mapId
 * @param {object} mapa o que `tiledDoMapa(mapId)` devolveu
 * @param {object} tileset
 * @param {HTMLImageElement} imagem a folha de tiles ja carregada
 * @param {number} larguraMinimap a largura em pixels que o minimapa vai ter
 * @returns {boolean} o canvas ficou pronto
 */
export function prepararMinimapa(
  mapId,
  mapa,
  tileset,
  imagem,
  larguraMinimap,
  alturaMinimap = larguraMinimap,
) {
  if (!mapId || !mapa?.layers?.length || !tileset || !imagem) return false;

  if (prontos.has(mapId)) return true;

  if (!imagem.complete || !imagem.naturalWidth) return false;

  const cols = mapa.layers[0]?.cols ?? 0;
  const rows = mapa.layers[0]?.rows ?? 0;

  if (cols <= 0 || rows <= 0) return false;

/**
   * A ESCALA E A DO `computeMinimapTransform`, REFEITA AQUI.
   *
   * E a MESMA conta, e nao uma parecida: as duas precisam dar exatamente o
   * mesmo numero. Se divergirem, o minimapa mostraria o mapa deslocado em
   * relacao a onde o jogador esta: o retangulo branco da visao ficaria
   * sobre o lugar errado, que e pior do que um minimapa sem mapa
   *
   * E por isso que a altura entra no calculo, e nao so a largura: um painel
   * mais alto que largo nao e limitado pela altura, e usar so a largura
   * daria um canvas maior que o transform espera
   *
   * O MAPA COMECA NO 0,0, E O PANEL E QUE CENTRALIZA.
   *
   * O canvas e o mapa CRU, do canto dele ate o canto oposto, sem a margem
   * que o `computeMinimapTransform` calcula para caber o painel. E o
   * `drawMinimap` que centraliza ao colar
   *
   * Se o canvas trouxesse a margem, ele teria que ser colado em `baseX` e
* nao em 0, e o jogador, que usa `baseX`, e o mapa, que usaria 0,
   * ficariam com origens diferentes
   *
   * E por isso que a escala NAO tem o `512 / mapa.width` que existiu na
   * primeira versao: aqui a escala e a do transform, e o transform ja
   * centraliza. O `512` viraria um segundo limite que nao existe do outro
* lado e cortaria o mapa por baixo
   */
  const escala = Math.min(
    larguraMinimap / mapa.width,
    alturaMinimap / mapa.height,
  );

  const largura = Math.max(1, Math.round(mapa.width * escala));
  const altura = Math.max(1, Math.round(mapa.height * escala));

  const canvas = document.createElement("canvas");

  canvas.width = largura;
  canvas.height = altura;

  const context = canvas.getContext("2d");

  if (!context) return false;

  /**
   * O FUNDO ANTES DOS TILES.
   *
 * Sem isto, onde o mapa nao tem tile, a camada pode ter buraco, fica
   * transparente, e o minimapa mostra o jogo atraves dele. Um escuro opaco
   * deixa claro que ali nao tem mapa
   */
  context.fillStyle = "#0b1118";
  context.fillRect(0, 0, largura, altura);

  /**
   * AS CORES SAO LIDAS DA FOLHA AQUI, UMA VEZ.
   *
 * E o `getImageData` que so este arquivo faz. A folha ja esta carregada,
 * e a mesma promessa de `onload` que o `TileMapRenderer` cumpre, entao
   * nenhuma leitura de rede acontece aqui
   *
   * O `getImageData` pode lancar em canvas com a imagem de outra origem, e
   * o erro nao pode derrubar o minimapa: um mapa sem imagem no minimapa ainda
   * mostra jogador, inimigos e a faixa de visao
   */
  let cores = null;

  try {
    cores = coresDosTiles(context, imagem, tileset);
  } catch {
    cores = null;
  }

  if (cores) {
    desenharCamada(context, cores, tileset, mapa.layers[0], escala);
  }

  prontos.set(mapId, { canvas, largura, altura });

  return true;
}

/**
 * UMA CAMADA, TILE A TILE, JA NA ESCALA DO MINIMAPA.
 *
 * ## POR QUE UM `fillRect` POR TILE E NAO UM `drawImage`
 *
 * Porque `drawImage` de 64px para 2.5px com o suavizado desligado faz
 * nearest-neighbor: dos 4096 pixels do tile, so 9 chegam na tela, e sao os de
 * origem 0, 25 e 50. O tile sao entao o detalhe sorteado: se o desenho
 * estava no canto amostrado, aparecia; se estava no meio, virava mancha lisa
 *
 * `fillRect` com a cor media nao sorteia nada, e o resultado e sempre o mesmo
 * para o mesmo tile
 */
/**
 * O DESTINO DE UM TILE, EM PIXELS DE MINIMAPA.
 *
 * ## POR QUE NAO ARREDONDA, E POR QUE TEM PISO DE 1
 *
 * O arredondamento era o defeito que cortava a ponta do mapa: `2.545` arredondado
 * para `3`, multiplicado por 94 tiles, estourava o canvas de 239px em 43px, e o
 * canvas descarta o que nao cabe. O minimapa mostrava so o mapa ate `x=5099`, e o
 * portal, em `x=5799`, ficava sem arte nenhuma debaixo: o marcador do jogador
 * aparecia flutuando no vazio
 *
 * A fracao e o que mantem `94 * 2.545 = 239`, exatamente o tamanho do canvas
 *
 * O piso de 1px e para o caso de o mapa ser tao grande que caiba menos de 1px
 * por tile, ai um tile de 0px nao seria desenhado, e uma parede sumiria do
 * minimapa em vez de virar um ponto
 */
export function destinoDe(tileWidth, escala) {
  return Math.max(1, tileWidth * escala);
}

/**
 * AS CORES MEDIAS DE CADA TILE DA FOLHA, lidas uma vez.
 *
 * ## POR QUE UMA LEITURA DA FOLHA, E NAO UM `drawImage` POR TILE
 *
 * Porque `getImageData` na folha e uma leitura so: 259x259 pixels, 268 mil
 * bytes. Feito isso, cada tile do mapa vira um `fillRect` de uma cor, e
 * `fillRect` nao faz amostragem nenhuma, e o defeito era exatamente
 * amostragem
 *
 * ## E POR QUE UMA COR POR TILE DA FOLHA, E NAO POR TILE DO MAPA
 *
 * Porque a folha tem 16 tiles e o mapa tem 6204 celulas. A media de um tile
 * da folha e a mesma em qualquer celula que o use, entao sao 16 medias para
 * 6204 celulas, e `fillRect` de 2.5px e mais barato que `drawImage` de 2.5px
 *
 * ## E POR QUE UM PASSO DE 8 PIXELS NA LEITURA
 *
 * Porque a media exata de 4096 pixels por tile e 65536 leituras, e o minimapa
 * nao precisa de precisao que essa escala nao mostra. De 8 em 8 pixels sao
 * 64 por tile, e a media continua sendo a mesma cor a uma fracao de cor de
 * distancia, invisivel num tile de 2.5px
 */
function coresDosTiles(context, imagem, tileset) {
  const tw = tileset.tileWidth;
  const th = tileset.tileHeight;

  /**
   * A LEITURA PRECISA DE UM CANVAS PROPRIO, E SEM SUAVIZADO.
   *
   * ## POR QUE UM CANVAS SEPARADO
   *
   * Porque `getImageData` devolve os pixels COMO ESTAO no canvas. Se o
   * suavizado estivesse ligado, a media de cada tile sairia de pixels
   * interpolados, e o minimapa mostraria uma cor que nao existe na folha
   *
   * E o canvas de trabalho e pequeno, e recriado a cada `prepararMinimapa`,
   * que roda uma vez por mapa
   */
  const leitura = document.createElement("canvas");

  leitura.width = imagem.naturalWidth;
  leitura.height = imagem.naturalHeight;

  const leituraContext = leitura.getContext("2d", { willReadFrequently: true });

  if (!leituraContext) return null;

  leituraContext.imageSmoothingEnabled = false;

  leituraContext.drawImage(imagem, 0, 0);

  const folha = leituraContext.getImageData(0, 0, leitura.width, leitura.height).data;

  const cores = [];

  for (let local = 0; local < tileset.tilecount; local += 1) {
    const coluna = local % tileset.columns;
    const linha = Math.floor(local / tileset.columns);

    const baseX = tileset.margin + coluna * (tw + tileset.spacing);
    const baseY = tileset.margin + linha * (th + tileset.spacing);

    let somaR = 0;
    let somaG = 0;
    let somaB = 0;
    let conta = 0;

    for (let y = 0; y < th; y += PASSO_DA_AMOSTRA) {
      for (let x = 0; x < tw; x += PASSO_DA_AMOSTRA) {
        /**
         * O PIXEL PRECISA DENTRO DA FOLHA.
         *
         * O `spacing` de 1px entre tiles significa que o ultimo pixel de um
         * tile pode cair na linha de separacao. Ler fora da folha daria `NaN`
          * na media, e o `fillRect` receberia uma cor invalida, que o canvas
         * ignora em silencio, deixando o tile transparente
         */
        const px = baseX + x;
        const py = baseY + y;

        if (px >= imagem.naturalWidth || py >= imagem.naturalHeight) continue;

        const i = (py * imagem.naturalWidth + px) * 4;

        somaR += folha[i];
        somaG += folha[i + 1];
        somaB += folha[i + 2];
        conta += 1;
      }
    }

    if (conta === 0) continue;

    cores[local] = `rgb(${Math.round(somaR / conta)},${Math.round(somaG / conta)},${Math.round(somaB / conta)})`;
  }

  return cores;
}

function desenharCamada(context, cores, tileset, camada, escala) {
  const tw = tileset.tileWidth;

  const destino = destinoDe(tw, escala);

  for (let cy = 0; cy < camada.rows; cy += 1) {
    for (let cx = 0; cx < camada.cols; cx += 1) {
      const indice = cy * camada.cols + cx;
      const gid = camada.gids[indice];

      if (gid < 0) continue;

      const local = gid - tileset.firstgid;

      if (local < 0 || local >= tileset.tilecount) continue;

      const cor = cores[local];

      if (!cor) continue;

      /**
       * A POSICAO E A ESCALA SAO FRACIONARIAS, E ISTO E O QUE SALVA O MAPA.
       *
       * ## O DEFEITO QUE A VERSAO ARREDONDADA CAUSAVA
       *
       * Um tile de 64px neste mapa sai com `64 * 0.0398 = 2.545px`. Arredondado
        * para 3px, 94 tiles viravam 282px num canvas de 239, e o canvas
       * descarta o que nao cabe: o minimapa mostrava so o mapa ate `x=5099`, e o
       * portal, em `x=5799`, ficava sem arte nenhuma debaixo
       *
       * ## E POR QUE NAO ARREDONDA A POSICAO TAMBEM
       *
       * Porque o `Math.round` na posicao acumula o mesmo erro: um tile a cada
       * vez, 94 vezes. A posicao fracionaria mantem o tile sempre no lugar
       * certo da grade
       *
       * ## E O `+0.5` DE SOBREPOSICAO
       *
       * Porque o destino fracionario de 2.545px deixa uma fresta de meio pixel
       * entre tiles, e 6204 dessas viram uma grade visivel sobre o mapa. Com
       * `fillRect` nao faz amostragem nenhuma, mas a fresta continua
       * existindo: o `+0.5` a cobre sem ir longe
       */
      context.fillStyle = cor;

      context.fillRect(
        cx * destino,
        cy * destino,
        destino + 0.5,
        destino + 0.5,
      );
    }
  }
}

/**
 * O CANVAS PRONTO DESTE MAPA, ou `null`.
 *
 * ## POR QUE ESTE E O QUE O `drawMinimap` COPIA
 *
 * Porque este canvas e o mapa CRU: do canto dele ate o canto oposto, na escala
 * do minimapa, com cada tile no lugar exato da grade. Quem centraliza no painel
 * e o `drawMinimap`, colando em `baseX`, a mesma origem do jogador
 */
export function minimapaDe(mapId) {
  return prontos.get(mapId)?.canvas ?? null;
}

/**
 * ESQUECE O MAPA PRONTO.
 *
 * E o que `registrarCamadas` chama quando um `.tmj` novo e registrado: o
 * canvas fora de tela foi desenhado do arquivo antigo, e sem isto ele
 * continuaria na tela depois de voce mover uma parede
 */
export function esquecerMinimapa(mapId) {
  prontos.delete(mapId);
}
