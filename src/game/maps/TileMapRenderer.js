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

    /**
     * QUEM JA ESTA BAIXANDO.
     *
     * ## O QUE ESTE SET EVITA
     *
     * Sem ele, `precarregar()` chamado duas vezes no mesmo mapa criaria DUAS
     * `Image` para a mesma URL: o download happening em segundo plano e o do
     * preload, disputando a mesma conexao. O navegador so cacheia depois
     * que a primeira termina, entao a segunda esperaria a fila e o preload
     * que existia para adiantar acabaria atrasando.
     *
     * E `imagens` nao serve para isto: ele so recebe a imagem no `onload`,
     * e a janela que importa aqui e a que vai do `new Image()` ate ele.
     */
    this.baixando = new Set();
  }

  /**
   * COMECA A BAIXAR AS FOLHAS DE UM MAPA, SEM ESPERAR.
   *
   * ## POR QUE ISTO EXISTE
   *
   * O `load()` so era chamado de dentro do `drawMap`, e o `drawMap` so roda
   * quando o mapa JA esta em cena. Ou seja: o download dos tiles comecava no
   * mesmo quadro em que o jogador ja via o mapa novo — o que produz o
   * defeito de o chao aparecer depois, com o mapa vazio por um instante.
   *
   * Chamando isto na travessia, o download comeca antes do `setMap`, e a
   * janela entre o comando e a chegada da arte ja passa com a folha no
   * cache do navegador.
   *
   * ## POR QUE NAO E `await`
   *
   * Porque o preload nao pode travar a travessia. Um `await` aqui seguraria
   * o portal ate a imagem chegar, e uma folha que da 404 — ou uma conexao
   * lenta — prenderia o jogador em frente ao portal sem nenhuma saida.
   * O preload e uma promessa de que vai ajudar, nao uma condicao.
   *
   * @returns {boolean} `true` se o mapa inteiro ja estava pronto
   */
  precarregar(mapa) {
    this.load(mapa);

    return this.pronto(mapa);
  }

  /**
   * ESTA FOLHA JA ESTA EM CACHE, EM DOWNLOAD, OU JA FALHOU?
   *
   * E o filtro que `load()` usa para nao pedir a mesma imagem duas vezes.
   * Estao os tres estados juntos porque so `imagens` (o `onload`) e um
   * deles: uma imagem que esta baixando agora nao esta em `imagens` ainda,
   * e sem este `Set` ela seria pedida de novo a cada chamada.
   */
  jaConhecida(url) {
    return (
      this.imagens.has(url) ||
      this.baixando.has(url) ||
      this.falhou.has(url)
    );
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

    /**
     * SEM DOM, `Image` NAO EXISTE.
     *
     * E o caso do servidor (que importa este arquivo pelo `data/maps`) e de
     * qualquer teste em Node puro. O `load` antes era chamado SO de dentro do
     * `drawMap`, que nao roda sem canvas — entao o `new Image()` ficava
     * inalcancavel nesses ambientes.
     *
     * O `precarregar` quebrou isso: ele e chamado da travessia de portal e
     * do `NetworkWorld`, e nenhum dos dois e caminho de desenho. Sem este
     * `return`, toda suite que instancia o motor e atravessa um portal
     * quebraria com `Image is not defined` — e por um motivo que nao tem
     * nada a ver com o que o teste quer verificar.
     *
     * Devolver `false` e o certo: em Node nao existe arte para carregar, e
     * quem chamou so usa este valor como diagnostico
     */
    if (typeof Image === "undefined") return false;

    for (const folha of this.folhasDe(mapa)) {
      if (!folha?.url) continue;

      alguma = true;

      /**
       * JA CONHECIDA EM QUALQUER UM DOS TRES ESTADOS.
       *
       * O `jaConhecida` cobre os tres de uma vez. O que mudou em relacao
       * ao codigo anterior e a ordem: antes a janela de "baixando" nao
       * existia, entao um `precarregar` seguido de um `load` no mesmo
       * quadro criaria uma segunda `Image` para a mesma URL
       */
      if (this.jaConhecida(folha.url)) continue;

      /**
       * A FOLHA ESTA BAIXANDO AGORA.
       *
       * Sai do `onload` e do `onerror`. Sem o `delete` no `onload`, a
       * entrada ficaria no `Set` para sempre e a imagem — que agora esta
       * em `imagens` — seria tratada como "ainda baixando" por um estado
       * que nao existe mais
       */
      this.baixando.add(folha.url);

      const imagem = new Image();

      // o desenho e pixel art, e o padrao do motor ja desliga o
      // suavizado; repetir aqui deixa o tile em pixelado mesmo se um dia
      // algum outro desenho ligar o suavizado global
      imagem.decoding = "async";

      imagem.onload = () => {
        this.baixando.delete(folha.url);
        this.imagens.set(folha.url, imagem);
      };

      imagem.onerror = () => {
        this.baixando.delete(folha.url);
        this.falhou.add(folha.url);
      };

      imagem.src = folha.url;
    }

    return alguma;
  }

  /**
   * O MAPA ESTA INTEIRO NA TELA?
   *
   * ## POR QUE ISTO E DIFERENTE DO `isReady`
   *
   * Porque `isReady` responde "o jogador ve ALGUMA coisa?", e ele precisa
   * responder isso para o primeiro quadro: negar o desenho inteiro enquanto
   * uma folha falta mostraria um buraco preto, e e melhor mostrar o
   * terreno sem os tiles do que nada.
   *
   * Esta e a pergunta do PRELOAD: "da para trocar de mapa agora?". Aqui a
   * resposta e sim-so-com-tudo: uma folha a caminho significa que o mapa
   * destino ainda nao esta pronto, e e com base nesta conta que o motor
   * decide entre segurar a travessia ou deixar o jogo mostrar o vazio
   * por um instante.
   *
   * ## POR QUE UMA FOLHA SEM URL NAO IMPEDE
   *
   * Porque `url: null` e "o autor nao registrou a imagem" — um erro de
   * declaracao, nao um download pendente. Contar como "pronto" e o que o
   * `isReady` ja faz, e inverter isso aqui prenderia o jogador para sempre
   * num mapa cujo arte nunca vai chegar
   */
  pronto(mapa) {
    for (const folha of this.folhasDe(mapa)) {
      if (!folha?.url) continue;

      const imagem = this.imagens.get(folha.url);

      if (!imagem?.complete || !imagem.naturalWidth) return false;
    }

    return true;
  }

  /**
   * DESENHA AS CAMADAS VISIVEIS.
   *
   * @param {CanvasRenderingContext2D} context
   * @param {object} mapa o que `lerMapaTiled` devolveu
   * @param {object} view a janela visivel, em coordenada de mundo
   */
  draw(context, mapa, view, alinhamento = { dpr: 1, escala: 1 }) {
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
      this.drawCamada(context, folhas, camada, maiorW, maiorH, view, alinhamento);
    }
  }

  /**
   * O QUE O MOTOR SABE DA CAMERA PARA ALINHAR OS TILES.
   *
   * ## POR QUE ISTO EXISTE
   *
   * Para a fresta de 1px sumir, o `drawImage` de cada tile precisa receber
   * um destino em pixel INTEIRO de dispositivo. O motor e quem sabe o `dpr` e
   * o `zoom`, e quem tem a transform da camera aplicada — o renderizador so
   * ve coordenadas de mundo.
   *
   * Sem estes dois numeros, o renderizador arredonda o destino em MUNDO, e o
   * `zoom` e o `dpr` vem DEPOIS desse arredondamento na hora do desenho. E ai
   * que a fracao que abre a fresta nasce.
   *
   * @param {number} dpr
   * @param {number} zoom
   */
  alinhamentoDeDispositivo(dpr = 1, zoom = 1) {
    const d = dpr > 0 ? dpr : 1;
    const z = zoom > 0 ? zoom : 1;

    return { dpr: d, escala: d * z };
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
  drawCamada(context, folhas, camada, maiorW, maiorH, view, alinhamento) {
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

        /**
         * O DESTINO EM PIXEL DE DISPOSITIVO, E O QUE MATA A FRESTA.
         *
         * ## A CAUSA
         *
         * Com `imageSmoothingEnabled = false` o navegador nao suaviza a
         * imagem, mas ainda precisa decidir em que pixel de dispositivo cada
         * tile comeca e termina — e essa decisao e por arredondamento. Quando
         * o canto do tile cai em `x.4`, o tile da esquerda termina no pixel
         * `X` e o da direita comeca no `X+1`: sobra um pixel de vao.
         *
         * Como todos os tiles da linha compartilham a mesma fracao (a do
         * camera), a fresta e continua ao longo da linha inteira, e ela anda
         * junto com a camera. E o sintoma de "linhas que aparecem entre os
         * tiles enquanto o personagem anda".
         *
         * ## POR QUE O ARREDONDAMENTO PRECISA SER AQUI, EM DISPOSITIVO
         *
         * O codigo arredondava o destino em coordenada de MUNDO. Isso nao
         * funciona: entre este `Math.round` e o pixel na tela ainda passam o
         * `zoom` e o `dpr` da camera, e um destino inteiro em mundo vira
         * fracionario em dispositivo assim que o zoom e diferente de 1 — que
         * e o caso da base (1/0.62) e do chefe (1/0.7).
         *
         * Aqui o destino e convertido para dispositivo ANTES do arredondamento,
         * e o valor que sobra e convertido de volta. O tile que estava em
         * `x.4` vai para o pixel `X`, e o vizinho tambem — os dois fecham.
         *
         * ## POR QUE ISTO NAO QUEBRA A CONTINUIDADE DA ARTE
         *
         *e o tamanho real da arte. O que muda e so de ONDE o tile comeca, e
         * esse deslocamento e de menos de meio pixel de dispositivo; o
         * cenario, o `.tmj` e as colisoes nao sabem que ele aconteceu
         */
        const escala = alinhamento?.escala ?? 1;

        /**
         * O DESTINO, ALINHADO NA GRADE ACUMULATIVA DO DISPOSITIVO.
         *
         * ## POR QUE A POSICAO E ARREDONDADA E O TAMANHO NAO
         *
         * Porque a fresta e uma diferenca entre o fim de um tile e o
         * comeco do vizinho. Se as DUAS pontas sao arredondadas na mesma
         * grade, a emenda fecha. Arredondar tambem o tamanho, como fez uma
         * versao anterior deste bloco, faz o pior: a largura arredondada e
         * um valor CONSTANTE, e a posicao e cumulativa — os dois discordam a
         * cada tres tiles e sobra um vao de 1px. Era a grade visivel que
         * apareceu depois da correcao.
         *
         * ## POR QUE A GRADE E CUMULATIVA
         *
         * Porque o device de um tile nao e `arredonda(tile * escala)`: e
         * `arredonda(tile * escala) / escala`, e o proximo tile continua da
         * borda arredondada ANTERIOR. Arredondar cada origem de forma
         * independente faz o erro de cada tile apontar para um lado diferente
         * e a fresta nao fecha nunca
         */
        const destinoX = arredondarEmDispositivo(
          centroX - folha.tileWidth / 2,
          escala,
        );

        const destinoY = arredondarEmDispositivo(
          centroY - folha.tileHeight / 2,
          escala,
        );

        /**
         * QUANDO O TILE E MENOR QUE A CELULA, DESENHA DO TAMANHO DA ARTE.
         *
         * Um tile de 16px numa celula de 64px ficaria com 48px de vazio em
         * volta se fosse esticado ate a celula — e o mapa da base encolheria
         * inteiro. E por isso que o destino usa `tileWidth`/`tileHeight`, e
         * nao o tamanho da celula
         *
         * O TAMANHO aqui e o de MUNDO, sem arredondar: e a escala da camera
         * que o converte, e as duas bordas do tile ja caem na mesma grade
         * porque as POSICOES sao cumulativas
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

/**
 * ARREDONDA UM DESTINO DE MUNDO PARA CAIR NA GRADE DE PIXEL DE DISPOSITIVO.
 *
 * ## POR QUE ESTA FUNCAO E NAO UM `Math.round` NO LUGAR
 *
 * Porque o `Math.round` simples arredonda a coordenada de MUNDO, e o que
 * precisa cair no pixel inteiro e a coordenada de DISPOSITIVO — que e a de
 * mundo depois do `zoom` e do `dpr` da camera. Arredondar antes desfaz a
 * conta: um destino inteiro em mundo vira fracionario em dispositivo assim
 * que o zoom e diferente de 1, que e o caso da base (1/0.62) e do chefe
 * (1/0.7).
 *
 * ## POR QUE O RESULTADO PRECISA SER DIVIDIDO DE VOLTA POR `escala`
 *
 * Porque o `drawImage` recebe coordenadas de MUNDO, e o canvas multiplica
 * por `escala` na hora de desenhar. Devolver o valor em dispositivo faria o
 * canvas multiplicar de novo, e o tile cairia `escala` vezes longe do lugar.
 * A divisao desfaz a conta e devolve a MESMA posicao de mundo que agora cai
 * exatamente num pixel de dispositivo.
 *
 * ## E POR QUE ISSO FECHA A FRESTA ENTRE VIZINHOS
 *
 * Porque todos os tiles passam pelo mesmo arredondamento e nao ha
 * arredondamento de tamanho. O fim de um tile e o comeco do vizinho sao a
 * mesma conta, entao as duas bordas caem no mesmo pixel de dispositivo — e
 * a emenda fica selada em qualquer posicao da camera.
 *
 * @param {number} mundo a coordenada de mundo
 * @param {number} escala `dpr * zoom` — quantos pixels de dispositivo ha
 *   por pixel de mundo
 */
function arredondarEmDispositivo(mundo, escala) {
  if (escala === 1) return Math.round(mundo);

  return Math.round(mundo * escala) / escala;
}
