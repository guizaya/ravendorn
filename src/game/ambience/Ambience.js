/** Um numero de verdade, e nunca `NaN` nem `undefined`. */
const finito = (valor, padrao) => (Number.isFinite(valor) ? valor : padrao);

/**
 * AS CAIXAS DO RUAO DO JOGO: o piso do painel e o teto.
 *
 * ## POR QUE O MINIMO E 320 E NAO ZERO
 *
 * Porque uma caixa de largura ZERO faz `#sorteio(min, max)` devolver `min`
 * para TODAS as particulas. Elas nascem empilhadas na mesma linha e andam
 * juntas - que e o sintoma exato de "o ar bugado depois de um TP"
 *
 * ## POR QUE O `finito` NOS DOIS EIXOS
 *
 * Porque um `viewport` pela metade - presente no `largura` e `undefined` na
 * `altura` - produz `maxY - minY` como `NaN`, e `Math.max(NaN, 240)` continua
 * `NaN`. Um `Number.isFinite` aqui e o que garante que a caixa e um retangulo
 * de verdade, com os quatro lados diferentes
 */
const LARGURA_MINIMA = 320;
const ALTURA_MINIMA = 240;

/**
 * A AMBIENTACAO: o que o mundo tem de ar, e o que ele faz com a luz.
 *
 * ## O QUE ISTO NAO E
 *
 * Nao e clima, e nao e ciclo dia/noite. Sao duas coisas mais baratas que
 * resolvem mais da sensacao de lugar: uma PELICULA de cor sobre a tela, com o
 * vinheta que fecha os cantos, e as PARTICULAS que flutuam no ar do mapa
 *
 * ## POR QUE UM MODULO E NAO DOIS
 *
 * Porque os dois leem o MESMO dado — o `ambience` que o mapa declara — e
 * porque eles precisam saber a mesma coisa: quantas particulas tem, e aonde a
 * camera esta, para nascerem em volta dela e nao no canto oposto do mapa
 *
 * ## E POR QUE O MAPA DECLARA, E NAO O MOTOR
 *
 * Porque a ambientacao e propriedade do LUGAR. Uma arena nao pode ter a poeira
 * dourada de um vilarejo, e a tabela do motor seria uma lista de id com
 * excecoes. No mapa, o proximo mapa novo ja nasce ambientado, e apagar o
 * campo o devolve ao padrao
 */

/**
 * O QUE UM MAPO PODE DECLARAR.
 *
 * `tinta` e a cor que entra por cima da cena e `vinheta` o quanto essa cor
 * pesa — de 0 (nada) a 1 (a cena inteira). `particula` e o NOME de um
 * `TIPOS` aqui embaixo, e `quantas` quantas delas existem
 *
 * Os tres numeros do padrao sao de proposito conservative: um mapa sem
 * `ambience` nao fica preto nem sem vida, e quem nao declare ve a grama e um
 * ceu limpo
 */
export const AMBIENCIA_PADRAO = {
  tinta: "#5b7a8c",
  tintaPeso: 0.14,
  vinheta: 0.3,
  vinhetaCor: "#05080c",
  particula: "poeira",
  quantas: 60,

  /**
   * ONDE O AR VIVE: `"camera"` ou `"mapa"`.
   *
   * ## `"camera"` — o campo persegue a tela
   *
   * E o padrao, e o certo para mapa grande: o vale tem 6016 pixels de largura
   * e nao caberia em memoria de outro jeito. O ar fica onde o olho esta
   *
   * ## `"mapa"` — o ar e do lugar, e nao da tela
   *
   * E para mapa pequeno e fixo, que a gente ve inteiro sem effort. A base tem
   * 1664x1152: a tela mostra uns 992x558 de cada vez, mas as pontas do lugar
   * estao ali na tela o tempo todo
   *
   * Com o campo na camera, o ar da base ficava preso no meio: a caixa era
   * 2160 pixels de largura centrada no jogador, entao as pontas da vila —
   * que o jogador ve e nunca chega a pisar, porque o spawn e sempre o centro
   * — ficavam sem uma unica faisca
   */
  campo: "camera",

  /**
   * A NEBLINA DE FUNDO, EM CIMA E EM BAIXO DA TELA.
   *
   * E neblina, e nao vinheta: a vinheta escurece os cantos, e isso e uma
   * moldura. A neblina e uma camada de ar entre a camera e o mundo, e ela
   * entra pela FRENTE do cenario e sai pelo meio da tela — como o ar de um
   * vale de manha cedo
   *
   * Os numeros sao forca: 0 e nada, 1 e uma parede branca. Os dois lados andam
   * juntos porque neblina que sobe do chao e sempre da metade de cima
   */
  nevoa: { topo: 0.18, base: 0.26, cor: "#b9c6cf" },
};

/**
 * OS TIPOS DE PARTICULA.
 *
 * Cada um e um jeito de mexer no ar. O que muda entre eles e a cor, o tamanho
 * e o VENTO — e e o vento que separa poeira de neve: as duas descem, mas uma
 * cai e a outra e empurrada de lado
 */
const TIPOS = {
  /**
   * PO DO CHAO E CONTEUDO NO AR.
   *
   * Deriva e nunca cai. E o tipo de um vilarejo ao entardecer, e a que
   * combina com a luz quente de uma forja ou uma fogueira
   */
  poeira: {
    cor: ["#f0d9a8", "#e8c98a", "#fff2cf"],
    tamanho: [0.7, 1.6],
    velocidade: [6, 18],
    subida: -4,
    alfa: 0.5,
    pulsa: true,
  },

  /** A PALAVRA DE UM MAPA DE NEVE: cai reto e some rapido. */
  neve: {
    cor: ["#ffffff", "#dce8f5", "#f4f9ff"],
    tamanho: [0.9, 2],
    velocidade: [10, 26],
    subida: 22,
    alfa: 0.72,
    pulsa: false,
  },

  /** BRASA: sobe, e e a unica que clareia enquanto sobe. */
  brasa: {
    cor: ["#ff9a3c", "#ff6a1e", "#ffd27a"],
    tamanho: [0.8, 1.7],
    velocidade: [4, 12],
    subida: -16,
    alfa: 0.68,
    pulsa: true,
  },

  /** CINZA: cai devagar e e apagada, e o que fica no ar de um lugar morto. */
  cinza: {
    cor: ["#6b7480", "#8a939e", "#545c66"],
    tamanho: [0.8, 1.9],
    velocidade: [4, 11],
    subida: 9,
    alfa: 0.42,
    pulsa: false,
  },

  /** FAGULHA: sobe e pisca forte. E o que uma luz nao para de fazer. */
  faisca: {
    cor: ["#ffe08a", "#ffc94d", "#fff6c9"],
    tamanho: [0.9, 1.9],
    velocidade: [5, 14],
    subida: -12,
    alfa: 0.8,
    pulsa: true,
  },
};

/**
 * O TAMANHO DA CAIXA onde as particulas nascem.
 *
 * E maior que a tela de proposito: uma particula que nasce dentro da tela
 * aparece de repente na beira, e uma que nasce fora nunca e vista. O
 * `1.35` e um meio a mais que o necessario em cada direcao
 */
const FATOR_DA_CAIXA = 1.35;

/** O teto de particulas, e o que segura o custo de preenchimento. */
const MAXIMO_DE_PARTICULAS = 220;

/**
 * O LADO DO BLOB PRÉ-RENDERIZADO.
 *
 * E grande de proposito: o blob e desenhado uma vez por COR e depois so
 * reduzido com `drawImage`. Fazer o pixel art do pixel na hora daria uma
 * borrao sem detalhe, e o que se quer nao e borrao de maquina — e uma
 * particula pequena e suave
 */
const LADO_DO_BLOB = 64;

/**
 * ONDE O GRADIENTE CHEGA A ZERO.
 *
 * O miolo e solido ate 22% do raio e some no resto. Um disco todo solido com
 * a borda dura demais leria como um ponto de tinta; um gradiente que comeca a
 * sumir no centro leria como nevoa
 */
const NUCLEO_SOLIDO = 0.13;

/**
 * O QUANTO O BLOB E MAIOR QUE A PARTICULA.
 *
 * E o que faz a BORDA aparecer. Desenhando o blob no tamanho exato do
 * raio, o gradiente cabe em 3 pixels e o olho le um ponto duro de novo; em
 * 2,6 vezes o raio da para ver o esmaecimento, que e o que foi pedido
 */
const FATOR_DE_DESFOQUE = 3.4;

/**
 * A ALTURA DE UMA FAIXA DE NEBLINA.
 *
 * E ABSOLUTA, e nao uma fracao da altura da janela, por dois motivos. O piso
 * e pre-renderizado uma vez e so depois repetido, entao uma fracao seria
 * congelada no tamanho da tela do primeiro carregamento; e o `drawImage`
 * recebe a altura do piso, e nao a da tela, para a neblina nao esticar ao
 * redimensionar a janela
 */
const ALTURA_DA_NEBLINA = 190;

/**
 * A LARGURA DO PISO DE NEBLINA PRE-RENDERIZADO.
 *
 * O piso e repetido na horizontal ate cobrir a tela. E largo de proposito —
 * em 512 pixels a repeticao passaria umas quatro vezes numa tela de 2048, e
 * com o parallax arrastando por cima o olho nao pega o intervalo
 */
const LARGURA_DO_PISO = 512;

/**
 * QUANTOS VENTOS HA NO PISO.
 *
 * Sao as manchas de neblina dentro de um quadrado. Se fosse um degrade reto
 * na vertical, daria uma vinheta — e a vinheta ja existe. Sao varias manchas
 * sobrepostas que nunca formam uma linha reta, que e o que faz parecer ar
 */
const VENTOS_NO_PISO = 22;

/**
 * A DERIVA DA NEBLINA EM RELACAO A CAMERA.
 *
 * E um PARALLAX de verdade, e nao uma animacao solta: a neblina anda com a
 * camera, mas em 5% do passo. Por isso ela parece estar no MUNDO, em um
 * plano mais longe — e nao grudada no vidro. Andando junto, dava a sensacao
 * de que a tela era um papel de parede com sombra
 */
const PARALLAX_DA_NEBLINA = 0.05;

/**
 * A VELOCIDADE DA NEBLINA EM RELACAO AO TEMPO.
 *
 * Em pixels de tela por segundo. E devagar de proposito: neblina que corre
 * vira fumaca, e o objetivo e que o jogador nao perceba que ela se mexe
 */
const VELOCIDADE_DA_NEBLINA = 6;

/**
 * O ALFA QUE CADA VENTO NASCE.
 *
 * Fraco de proposito. Sao 22 manchas sobrepostas, e se cada uma viesse forte
 * a soma daria um bloco so. E por isso que elas nascem em valores diferentes:
 * o olho pega o contraste entre uma mancha forte e uma fraca
 */
const ALFA_DO_VENTO = [0.1, 0.34];

/**
 * A MESMA COR, COM ALFA ZERO.
 *
 * ## POR QUE SUFIXO `00` E NAO `rgba()`
 *
 * Porque todas as cores do catalogo sao `#rrggbb`, e um canal alfa de 8
 * digitos e o mesmo hex com dois zeros atras — sem parses, sem `replace`, e
 * sem o risco de um `rgb()` no meio de uma lista de `#`
 *
 * E sem `globalAlpha`: o gradiente PRECISA carregar a transparencia, porque
 * e ele que faz a borda. Deixar o alfa para o `drawImage` daria um disco
 * solido com o canal multiplicado por cima — que e o ponto duro de novo
 */
function corSemAlpha(cor) {
  return /^#[0-9a-f]{6}$/i.test(cor) ? `${cor}00` : "transparent";
}

export class Ambience {
  constructor() {
    this.particulas = [];

    /**
     * O TIPO VIGENTE, cacheado para o desenho.
     *
     * O `update` ja resolve o tipo do mapa, e o desenho roda 60 vezes por
     * segundo. Sem este campo, cada quadro faria a busca de novo para ler a
     * mesma cor
     */
    this.tipo = TIPOS[AMBIENCIA_PADRAO.particula];

    this.config = AMBIENCIA_PADRAO;

    /**
     * O NOME DO TIPO QUE ESTAVA NA LISTA, e nao a tabela.
     *
     * E o que impede a mistura entre mapas. Cada particula guarda a cor e o
     * tamanho com que NASCEU, entao trocar de mapa sem esvaziar a lista
     * deixaria as duas palettes na tela: indo do vilarejo (55 faiscas
     * douradas) para o vale, que pede 80, o `while` completava com 25 cinzas e
     * as 55 douradas ficavam — a tela tinha ar dos dois lugares ao mesmo
     * tempo
     *
     * Guardar o NOME e nao a tabela evita que um mapa que declara duas vezes a
     * mesma particula limpe a lista a cada tique
     */
    this.tipoNaLista = AMBIENCIA_PADRAO.particula;

    /**
     * O BLOB DE CADA COR, desenhado uma vez so.
     *
     * E um `Map` porque a chave e a cor — sao cinco tipos com tres cores cada,
     * no maximo quinze entradas, e o cache vive enquanto a partida viver
     */
    this.blobs = new Map();

    /**
     * O PISO DE NEBLINA DE CADA MAPA.
     *
     * A chave leva a COR, porque e ela que muda a pinta. Sao dois pisos por
     * mapa — o de cima e o de baixo — e sao feitos uma vez so
     */
    this.pisos = new Map();

    /**
     * O RELOGIO DA NEBLINA.
     *
     * Corre junto com o `update` e e o que faz a deriva ter tempo. Sem ele a
     * neblina andaria so com a camera, e parado no lugar ela pareceria um
     * desenho pintado no vidro
     */
    this.tempo = 0;
  }

  /**
   * O PISO DE NEBLINA, PRONTO PARA REPETIR.
   *
   * ## O PROBLEMA DE EMENDAR UM PISO
   *
   * Repetir um piso na horizontal cria emenda onde ele se encontra com ele
   * mesmo. A emenda aparece como uma linha vertical com a neblina faltando
   *
   * ## POR QUE ESTE NAO TEM EMENDA
   *
   * Porque cada vento e desenhado TRES vezes: no lugar, e tambem em `x` menos
   * a largura do piso e em `x` mais a largura. O vento nasce na direita,
   * estoura para fora, e volta a aparecer na esquerda ja no proximo ladrilho
   * — exatamente onde o ladrilho anterior acabou. E o mesmo padrao da parede
   * de tijolos, que so parece continua se o tijolo do fim casa com o do
   * comeco
   *
   * ## POR QUE A BORDA VERTICAL NAO TEM O MESMO PROBLEMA
   *
   * Porque a neblina nao e repetida na vertical: a faixa encosta na borda da
   * tela. A queda suave vem do `destination-in` com o degrade, que apaga o
   * resto e nao deixa um corte reto no meio da tela
   *
   * @param {string} cor a cor da neblina
   * @param {boolean} noTopo `true` para a faixa de cima, `false` para a de baixo
   * @returns {HTMLCanvasElement|OffscreenCanvas|null}
   */
  #pisoDeNevoa(cor, noTopo) {
    const chave = `${cor}|${noTopo ? "t" : "b"}`;

    if (this.pisos.has(chave)) return this.pisos.get(chave);

    const altura = ALTURA_DA_NEBLINA;

    let canvas = null;

    if (
      typeof document !== "undefined" &&
      typeof document.createElement === "function"
    ) {
      try {
        canvas = document.createElement("canvas");
      } catch {
        canvas = null;
      }
    }

    if (!canvas && typeof OffscreenCanvas !== "undefined") {
      try {
        canvas = new OffscreenCanvas(LARGURA_DO_PISO, altura);
      } catch {
        canvas = null;
      }
    }

    if (!canvas) {
      this.pisos.set(chave, null);
      return null;
    }

    canvas.width = LARGURA_DO_PISO;
    canvas.height = altura;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      this.pisos.set(chave, null);
      return null;
    }

    for (let i = 0; i < VENTOS_NO_PISO; i++) {
      const x = Math.random() * LARGURA_DO_PISO;

      /**
 * A POSICAO DENTRO DA FAIXA.
 *
 * ## POR QUE E UNIFORME, E NAO `sorteio ^ 2`
 *
 * Porque a forma da faixa ja vem do `destination-in`, que multiplica os
 * ventos por um degrade e apaga o resto. Concentrar os ventos perto da borda
 * E CONCENTRAR O DEGRADE: o resultado era 90% da neblina nos 10% de cima da
 * faixa, e o resto quase vazio. O que se via nao era neblina — era uma
 * massa colada na borda da tela com nada embaixo
 *
 * Aqui o vento cobre a faixa inteira por igual, e o degrade sozinho desenha
 * o perfil. Cada um faz uma coisa, e nenhuma das duas e feita duas vezes
 */
const y = Math.random() * altura;

      const raio = altura * (0.28 + Math.random() * 0.42);

      const alfa = this.#sorteio(ALFA_DO_VENTO[0], ALFA_DO_VENTO[1]);

      for (const deslocamento of [-LARGURA_DO_PISO, 0, LARGURA_DO_PISO]) {
        const gradiente = ctx.createRadialGradient(
          x + deslocamento,
          y,
          0,
          x + deslocamento,
          y,
          raio,
        );

        gradiente.addColorStop(0, cor);
        gradiente.addColorStop(0.45, corSemAlpha(cor));
        gradiente.addColorStop(1, corSemAlpha(cor));

        ctx.globalAlpha = alfa;
        ctx.fillStyle = gradiente;
        ctx.fillRect(x + deslocamento - raio, y - raio, raio * 2, raio * 2);
      }
    }

    /**
     * A QUEDA SUAVE, E O ULTIMO PASSO.
     *
     * O `destination-in` NAO desenha nada: ele apaga tudo que o destino — o
     * piso ja pronto — ainda nao tem. Como o degrade vai de opaco a
     * transparente de baixo para cima, e o que sobra e neblina cheia na borda
     * da tela e nada no meio dela. Sem este passo a faixa terminaria com um
     * corte horizontal reta no meio da tela
     */
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-in";

    const queda = ctx.createLinearGradient(0, 0, 0, altura);

    if (noTopo) {
      queda.addColorStop(0, "#fff");
      queda.addColorStop(0.55, "#ffffff66");
      queda.addColorStop(1, "#ffffff00");
    } else {
      queda.addColorStop(0, "#ffffff00");
      queda.addColorStop(0.45, "#ffffff66");
      queda.addColorStop(1, "#fff");
    }

    ctx.fillStyle = queda;
    ctx.fillRect(0, 0, LARGURA_DO_PISO, altura);

    ctx.globalCompositeOperation = "source-over";

    this.pisos.set(chave, canvas);

    return canvas;
  }

  /**
   * O BLOB SUAVE DE UMA COR, ou `null`.
   *
   * ## POR QUE PRE-RENDERIZAR E NAO FAZER GRADIENTE POR PARTICULA
   *
   * Por causa da conta: o mapa da neve tem 95 particulas, e o canvas roda a 60
   * no navegador. Um `createRadialGradient` por particula por quadro sao 5700
   * gradientes por segundo, e o gradiente e um dosakov draw do canvas
   *
   * Aqui o gradiente e feito UMA vez por cor e o resultado e um bitmap que o
   * `drawImage` reduced — que e a forma barata de desenhar o mesmo pixel
   * 5700 vezes
   *
   * ## POR QUE UM `Map` E NAO UM ARRAY
   *
   * Porque a chave e a COR, e cor se repete entre as particulas do mesmo
   * tipo. Um indice por particula guardaria quinze blobs identicos
   *
   * ## E POR QUE ELE PODE VOLTAR `null`
   *
   * Porque o `drawParticulas` so roda no navegador, mas este arquivo tambem e
   * importado pelo servidor em Node puro. Sem `document` e sem
   * `OffscreenCanvas` nao ha onde desenhar, e o desenho e opcional: o
   * chamador cai no circulo cheio
   */
  #blobDe(cor) {
    if (this.blobs.has(cor)) return this.blobs.get(cor);

    let canvas = null;

    if (
      typeof document !== "undefined" &&
      typeof document.createElement === "function"
    ) {
      try {
        canvas = document.createElement("canvas");
      } catch {
        canvas = null;
      }
    }

    if (!canvas && typeof OffscreenCanvas !== "undefined") {
      try {
        canvas = new OffscreenCanvas(LADO_DO_BLOB, LADO_DO_BLOB);
      } catch {
        canvas = null;
      }
    }

    if (!canvas) {
      this.blobs.set(cor, null);
      return null;
    }

    canvas.width = LADO_DO_BLOB;
    canvas.height = LADO_DO_BLOB;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      this.blobs.set(cor, null);
      return null;
    }

    const centro = LADO_DO_BLOB / 2;

    const gradiente = ctx.createRadialGradient(
      centro,
      centro,
      0,
      centro,
      centro,
      centro,
    );

    gradiente.addColorStop(0, cor);
    gradiente.addColorStop(NUCLEO_SOLIDO, cor);
    gradiente.addColorStop(1, corSemAlpha(cor));

    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, LADO_DO_BLOB, LADO_DO_BLOB);

    this.blobs.set(cor, canvas);

    return canvas;
  }

  /**
   * O QUE A CAMERA VE.
   *
   * As particulas nascem em volta do centro da camera, e nao em volta do
   * jogador: sao as duas coisas que mais importam sao o ALCANCE (para o
   * jogador ver as marcas chegando) e a DERIVA (para elas nao ficarem presas
   * num ponto). Quem nasce perto do jogador e reetido no movimento dele
   */
  #caixa(camera, mapa, config) {
    /**
     * O AR DO LUGAR INTEIRO.
     *
     * `mapa.width` e `mapa.height` ja vem em pixels de mundo — e o mesmo
     * numero que o clamp da camera usa para decidir se o mapa cabe na tela,
     * entao nao ha conversao nem meia duvida aqui
     *
     * E o wrap continua valendo: uma faisca que cruza a borda da vila volta
     * pela oposta. So que agora as duas pontas do salto estao com alfa zero,
     * porque o esmaecimento de borda mede a partir desta caixa — o que
     * antes era um salto de 2160 pixels vira um salto invisivel de 1664
     */
    if (config.campo === "mapa") {
      const larguraMapa = mapa?.width ?? 0;
      const alturaMapa = mapa?.height ?? 0;

      if (larguraMapa > 0 && alturaMapa > 0) {
        return { minX: 0, maxX: larguraMapa, minY: 0, maxY: alturaMapa };
      }
    }

    const largura =
      Math.max(finito(camera?.largura, LARGURA_MINIMA), LARGURA_MINIMA) *
      FATOR_DA_CAIXA;

    const altura =
      Math.max(finito(camera?.altura, ALTURA_MINIMA), ALTURA_MINIMA) *
      FATOR_DA_CAIXA;

    const cx = finito(camera?.x, 0);
    const cy = finito(camera?.y, 0);

    return {
      minX: cx - largura / 2,
      maxX: cx + largura / 2,
      minY: cy - altura / 2,
      maxY: cy + altura / 2,
    };
  }

  #sorteio(min, max) {
    /**
     * `Math.random() * (max - min)` e `NaN` quando um dos lados nao e numero,
     * e o `NaN` gruda na particula para sempre. Aqui os dois lados sao
     * saneados e o intervalo e invertido quando chega invertido, porque
     * `Math.random()` nunca devolve negativo
     */
    const a = finito(min, 0);
    const b = finito(max, a + 1);

    return a + Math.random() * Math.abs(b - a);
  }

  /**
   * UMA PARTICULA NOVA.
   *
   * A fase nasce aleatoria porque sem ela todas as particulas de um mapa
   * piscariam juntas — a primeira em 0, a segunda ja em meio ciclo. E o
   * `seno` do pulso precisa de fase propria, ou o campo inteiro bateria em
   * unissono
   */
  #nascer(tipo, caixa) {
    return {
      x: this.#sorteio(caixa.minX, caixa.maxX),
      y: this.#sorteio(caixa.minY, caixa.maxY),
      tamanho: this.#sorteio(tipo.tamanho[0], tipo.tamanho[1]),
      velocidade: this.#sorteio(tipo.velocidade[0], tipo.velocidade[1]),
      fase: Math.random() * Math.PI * 2,
      vida: 0,
      cor: tipo.cor[Math.floor(Math.random() * tipo.cor.length)],
    };
  }

  /**
   * ANDA O AR.
   *
   * ## POR QUE A PARTICULA SAI E VOLTA
   *
   * Porque ela nao pode crescer sem limite — em dez minutos de jogo seriam
   * dezenas de milhares. Quando ela passa da borda da caixa ela e devolvida
   * do lado oposto, e o campo continua do tamanho certo para sempre
   *
   * O lado oposto e do VENTO, e nao aleatorio: uma particula que sai pela
   * direita volta pela esquerda, que e o que faz o campo parecer corrente e
   * nao um conjunto de pontos parados
   *
   * @param {number} deltaTime o tempo do tique
   * @param {{x:number,y:number,largura:number,altura:number}} camera a vista
   * @param {object} mapa o mapa em cena, que traz o `ambience`
   */
  update(deltaTime, camera, mapa) {
    const config = { ...AMBIENCIA_PADRAO, ...(mapa?.ambience ?? {}) };

    /**
     * A NEBLINA TEM AS SUAS PROPRIAS CORES E ALTURAS.
     *
     * O `...` raso acima nao cobre isso: ele traz o bloco `nevoa` do mapa
     * inteiro, e um mapa que so muda a cor derrubaria a altura junto. Sao
     * tres campos para misturar na mao
     */
    this.config = {
      ...config,
      nevoa: { ...AMBIENCIA_PADRAO.nevoa, ...(config.nevoa ?? {}) },
    };

    this.tempo += deltaTime;
    this.tipo = TIPOS[config.particula] ?? TIPOS[AMBIENCIA_PADRAO.particula];

    /**
     * MUDOU DE LUGAR: A LISTA E DA OUTRA CASA.
     *
     * E o que resolve a mistura. As particulas ja nascidas tem a cor e o
     * tamanho do tipo antigo, entao nenhuma correcao nas novas as apagaria —
     * as velhas continuariam na tela com a paleta da base, misturadas com as
     * do vale
     *
     * E antes do laco de contagem, e nao depois: o `while` que completa a
     * lista ja cria as particulas novas com o tipo novo, e o `while` que corta
     * so remove as da ponta. Sem esvaziar antes, o corte e o completar
     * trabalhariam sobre uma lista que nao pertence mais a este mapa
     */
    if (config.particula !== this.tipoNaLista) {
      this.particulas.length = 0;
      this.tipoNaLista = config.particula;
    }

    if (!camera) return;

    const caixa = this.#caixa(camera, mapa, config);

    /**
     * A CAIXA FICA GUARDADA, e nao e so uma conta local.
     *
     * Porque o desenho precisa dela para o esmaecimento da borda, e recalcular
     * a mesma caixa duas vezes por quadro — uma no `update` e outra no
     * `draw` — daria duas medidas que so batem por acaso
     */
    this.caixa = caixa;

    const alvo = Math.min(config.quantas ?? 0, MAXIMO_DE_PARTICULAS);

    /**
     * O CONTROLE DE NUMERO E POR DIFERENCA, E NAO POR RECRIAR A LISTA
     *
     * Trocar o mapa reseta as particulas, e um mapa novo precisa de ar
     * novo. Dentro do mesmo mapa, however, so se completa ou se apaga o que
     * falta — recriar tudo a cada tique mudaria a cor de todas as particulas
     * a 60 quadros por segundo
     */
    if (this.particulas.length > alvo) this.particulas.pop();

    while (this.particulas.length < alvo) {
      this.particulas.push(this.#nascer(this.tipo, caixa));
    }

    /**
     * AS PARTICULAS FORAM DESLIGADAS.
     *
     * E so isto que muda: a lista nasce vazia e fica vazia. O `drawParticulas`
     * sai no primeiro `if (!this.particulas.length) return`, entao nada e
     * desenhado, e a neblina, a tinta e a vinheta continuam como estavam
     *
     * ## POR QUE O CODIGO FICOU
     *
     * Porque o resto do arquivo depende dele: a neblina usa o `#sorteio` no
     * alfa dos ventos, e `AMBIENCIA_PADRAO.particula` e o que cada mapa
     * declara. Apagar essas partes teria levado a neblina junto — e foi
     * exatamente o que aconteceu da outra vez
     *
     * ## POR QUE NAO E `quantas: 0` NO MAPA
     *
     * Porque `quantas` e por mapa, e a conta vem de `MAXIMO_DE_PARTICULAS`, que
     * nunca daria zero. Esvaziar a lista e o desligamento em um lugar so, e o
     * lugar onde a lista e a unica coisa que decide quantas existem
     */
    this.particulas.length = 0;

    for (const particula of this.particulas) {
      /**
       * O CUSTO DE REPARO, E O QUE FAZ ISSO ACABAR DE UMA VEZ.
       *
       * ## POR QUE RECONSTRUIR E NAO SÓ SANEAR A CAIXA
       *
       * Porque uma particula com `NaN` no `x` nao volta: `NaN + qualquer
       * coisa` continua `NaN`, e o `if (particula.x > caixa.maxX)` nunca
       * segura. O ar ficava empilhado naquela linha para o resto da sessao,
       * mesmo depois que a camera se arrumasse — e recarregar a pagina era a
       * unica saida
       *
       * Aqui a particula volta a nascer como se fosse nova. O preco e uma
       * condicao por quadro, que e a operacao mais barata do `update`
       *
       * E por que checar os DOIS eixos: so no `y` ela sobrevivia, e o
       * sintoma era uma faixa horizontal estranha em vez de uma linha
       */
      if (!Number.isFinite(particula.x) || !Number.isFinite(particula.y)) {
        Object.assign(particula, this.#nascer(this.tipo, caixa));

        continue;
      }

      particula.vida += deltaTime;

      particula.x += particula.velocidade * deltaTime;
      particula.y += this.tipo.subida * deltaTime;

      if (particula.x > caixa.maxX) particula.x = caixa.minX;
      if (particula.x < caixa.minX) particula.x = caixa.maxX;

      if (particula.y > caixa.maxY) particula.y = caixa.minY;
      if (particula.y < caixa.minY) particula.y = caixa.maxY;
    }
  }

  /**
   * DESENHA O AR.
   *
   * E chamado DENTRO da transformada do mundo, junto do `effects.draw`: as
   * particulas vivem em coordenada de mundo, e desenha-las fora dela as faria
   * ficarem presas na tela enquanto a camera andasse
   */
  drawParticulas(context) {
    const tipo = this.tipo;

    if (!this.particulas.length) return;

    context.save();

    for (const particula of this.particulas) {
      /**
       * A FASE DO PULSO.
       *
       * E o que separa uma poeira viva de um pontinho parado. E a base e
       * `vida`, que corre sempre: sem ela o pulso usaria o `x` ou o `y`, e
       * uma particula parada por um vento forte pararia de piscar
       */
      const pulso = tipo.pulsa
        ? 0.72 + Math.sin(particula.vida * 2.1 + particula.fase) * 0.28
        : 1;

      /**
       * O RAIO DO BLOB, e nao o raio da particula.
       *
       * E o `FATOR_DE_DESFOQUE` que faz a borda caber na tela. No tamanho
       * exato do raio da particula — 1,2 a 3 pixels — o gradiente inteiro
       * cabe num pixel e o olho le o ponto duro de antes
       */
      const raio = particula.tamanho * FATOR_DE_DESFOQUE;

      const alfa =
        tipo.alfa * pulso * this.esmaecimentoNaBorda(particula);

      const blob = this.#blobDe(particula.cor);

      /**
       * O BLOB, OU O CIRCULO CHEIO QUANDO NAO HOUVER ONDE DESENHAR.
       *
       * O `drawImage` e o caminho do navegador; o `arc` existe para o caso
       * sem `document` e sem `OffscreenCanvas`. Sem ele, em Node o metodo
       * quebraria em vez de simplesmente nao desenhar nada
       */
      if (blob) {
        context.globalAlpha = alfa;
        context.drawImage(
          blob,
          particula.x - raio,
          particula.y - raio,
          raio * 2,
          raio * 2,
        );
        continue;
      }

      context.globalAlpha = alfa;
      context.fillStyle = particula.cor;
      context.beginPath();
      context.arc(particula.x, particula.y, particula.tamanho, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  /**
   * A PELICULA: tinta e vinheta, em espaco de TELA.
   *
   * E o unico desenho que NAO entra na transformada do mundo, porque ele
   * cobre a tela inteira e nao o mapa
   *
   * ## POR QUE `source-over` E NAO `multiply`
   *
   * Porque `multiply` depende de o compositor do canvas aceitar o modo, e o
   * resultado muda entre navegadores. `source-over` com alfa baixo e o que
   * uma sobreposicao de CSS faria, e e previsivel em qualquer tela
   *
   * ## E POR QUE A VINHETA E UM GRADIENTE E NAO UM RETANGULO
   *
   * Porque a borda escura e o que faz a tela parecer um lugar e nao um
   * recorte. Um retangulo escuro daria a mesma borda nos quatro lados e
   * igualaria o canto — e a vinheta existe para fazer o olho ir ao centro
   */
  /**
   * A NEBLINA QUE ENTRA PELA FRENTE DA CENA.
   *
   * ## POR QUE ELA E DESENHADA EM COORDENADA DE TELA, E NAO DE MUNDO
   *
   * Porque neblina e uma camada entre a camera e o que a camera ve. Ela nao
   * tem posicao no mapa — da no mesmo lugar para todo mundo — mas ela ANDA
   * com a tela, e e esse deslize que a separa da vinheta, que esta grudada no
   * vidro. Uma coisa e sombra de lente; outra e o ar que tem entre a lente e o
   * assunto
   *
   * ## POR QUE DUAS FAIXAS, E NAO UMA NEBLINA SOB A TELA INTEIRA
   *
   * Porque neblina de verdade nao cobre o meio da imagem: ela se acumula onde
   * nao tem o que ver, que sao as bordas. Uma neblina uniforme em cima de tudo
   * deixaria o jogo lavado e apagaria o combate. As faixas entram pelas
   * pontas e morrem antes do miolo, e o centro fica limpo para o jogo
   *
   * @param {CanvasRenderingContext2D} context o contexto ja em coordenada de tela
   * @param {number} width a largura da tela
   * @param {number} height a altura da tela
   * @param {object} camera o centro clampado, para o parallax
   */
  drawNevoa(context, width, height, camera) {
    const { topo, base, cor } = this.config.nevoa;

    if (topo <= 0 && base <= 0) return;

    /**
     * O DESLOCAMENTO DO PARALLAX.
     *
     * E a posicao da camera vezes 5%. Com o zoom da base em 1,61, andar 100
     * pixels no mapa move a neblina 5 pixels na tela — bem devagar, do jeito
     * que uma camada mais distante se move. O tempo entra junto para a
     * neblina nao ficar morta quando o jogador fica parado
     */
    const anda =
      (camera?.x ?? 0) * PARALLAX_DA_NEBLINA +
      this.tempo * VELOCIDADE_DA_NEBLINA;

    const comecarEm = -(((anda % LARGURA_DO_PISO) + LARGURA_DO_PISO) % LARGURA_DO_PISO);

    /**
     * OS PISO SAO MONTADOS UMA VEZ POR QUADRO, E FORA DO LACO.
     *
     * Antes eles eram pedidos DENTRO do laco de colunas, o que significava
     * duas consultas ao cache por coluna — ate oito por quadro. O cache
     * segurava, mas a garantia dependia de a chave ser estavel: se a cor
     * mudasse de valor a cada quadro, o `#pisoDeNevoa` cairia no `createElement`
     * de novo, e ali estao 66 gradientes por piso. Isso e 132 gradientes por
     * quadro, e e o tipo de coisa que derruba o jogo inteiro sem lancar erro
     *
     * Aqui o piso e resolvido antes do laco. Se faltar, o laco inteiro nao
     * desenha neblina nenhuma — que e um resultado feio, e nao um travamento
     */
    const pisoDoTopo = topo > 0 ? this.#pisoDeNevoa(cor, true) : null;
    const pisoDaBase = base > 0 ? this.#pisoDeNevoa(cor, false) : null;

    if (!pisoDoTopo && !pisoDaBase) return;

    context.save();

    for (let x = comecarEm; x < width; x += LARGURA_DO_PISO) {
      if (pisoDoTopo) {
        context.globalAlpha = topo;
        context.drawImage(pisoDoTopo, x, 0, LARGURA_DO_PISO, pisoDoTopo.height);
      }

      if (pisoDaBase) {
        context.globalAlpha = base;
        context.drawImage(
          pisoDaBase,
          x,
          height - pisoDaBase.height,
          LARGURA_DO_PISO,
          pisoDaBase.height,
        );
      }
    }

    context.restore();
  }

  drawPelicula(context, width, height) {
    const config = this.config;

    if (config.tintaPeso > 0) {
      context.save();
      context.globalAlpha = Math.min(1, Math.max(0, config.tintaPeso));
      context.fillStyle = config.tinta;
      context.fillRect(0, 0, width, height);
      context.restore();
    }

    const vinheta = Math.min(1, Math.max(0, config.vinheta ?? 0));

    if (vinheta <= 0) return;

    const raio = Math.hypot(width, height) / 2;

    const gradiente = context.createRadialGradient(
      width / 2,
      height / 2,
      raio * 0.42,
      width / 2,
      height / 2,
      raio,
    );

    gradiente.addColorStop(0, "transparent");
    gradiente.addColorStop(1, config.vinhetaCor ?? AMBIENCIA_PADRAO.vinhetaCor);

    context.save();
    context.globalAlpha = vinheta;
    context.fillStyle = gradiente;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  /**
   * QUANTO A PARTICULA PODE BRILHAR, DE 0 A 1.
   *
   * ## O QUE ELA ESTAVA FAZENDO
   *
   * Uma particula que passa da borda da caixa e DEVOLVIDA para o lado
   * oposto. E o que mantem o campo do tamanho certo sem crescer sem limite —
   * mas e um salto: a particula estava embaixo e aparece em cima
   *
   * ## POR QUE ISSO APARECIA NA TELA
   *
   * Porque a caixa e 1,35 vez a tela, entao a borda da caixa fica FORA do que
   * o jogador ve. O problema nao e a borda em si: e que a particula devolvida
   * nasce do lado OPOSTO, e no caso da neve e da cinza — que caem — o lado
   * oposto e o de cima. Um floco aparecia no meio da tela, no alto, do nada,
   * a cada vez que a caixa andava com a camera. E o tipo de coisa que o olho
   * pega na hora e que ninguem sabe dizer de onde veio
   *
   * ## A CORRECAO E ESMAECER NA BORDA
   *
   * A particula perde o alfa de gradual ao se aproximar da borda, e ja
   * nasce fraca do outro lado. Ela nunca chega a zero de um salto, e nunca
   * aparece do nada. E o mesmo truque que o cinema usa para a chuva nao
   * piscar nas bordas do quadro
   *
   * @param {object} particula a particula a medir
   * @returns {number} 0 invisivel, 1 opaca
   */
  esmaecimentoNaBorda(particula) {
    const caixa = this.caixa;

    if (!caixa) return 1;

    /**
     * A MARGEM DE ESMAECIMENTO, e nao o pixel exato da borda.
     *
     * E uma fracao da caixa: esmaecer so nos ultimos 2 pixels seria um corte
     * seco que some e volta — o mesmo salto que o esmaecimento veio
     * resolver. Um quinto do lado da caixa da uma faixa larga o bastante para
     * o olho nao ver a transicao
     */
    const margemX = (caixa.maxX - caixa.minX) / 5;
    const margemY = (caixa.maxY - caixa.minY) / 5;

    const pertoDaEsquerda = (particula.x - caixa.minX) / margemX;
    const pertoDaDireita = (caixa.maxX - particula.x) / margemX;
    const pertoDeCima = (particula.y - caixa.minY) / margemY;
    const pertoDeBaixo = (caixa.maxY - particula.y) / margemY;

    const maisPerto = Math.min(
      pertoDaEsquerda,
      pertoDaDireita,
      pertoDeCima,
      pertoDeBaixo,
    );

    return Math.max(0, Math.min(1, maisPerto));
  }
}
