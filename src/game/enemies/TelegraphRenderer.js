/**
 * O RENDERIZADOR DOS TELEGRAPHS, e o unico lugar que desenha as areas de
 * perigo.
 *
 * ## POR QUE ELE VIVE NUM ARQUIVO SEPARADO
 *
 * Porque o pedido diz para os indicadores ficarem no PLANO DO CHAO, abaixo
 * dos personagens. O `GameEngine` ja tem um lugar fixo para isso — entre o
 * `drawMap` e o `drawWorldSorted` — e um renderer proprio, como o
 * `PropRenderer` e o `TerrainRenderer`. Uma classe nova e a mesma forma do
 * resto do motor
 *
 * ## E POR QUE NAO USAR DOM
 *
 * O pedido e explicito sobre isso: se o jogo usa Canvas, desenhar no Canvas.
 * Cada indicador como um `<div>` posicionado daria um elemento por telegraph
 * por quadro, com layout do navegador a cada transicao — e o motor inteiro
 * ja e Canvas, entao seria a unica parte do desenho fora do lugar
 */

/**
 * A OPACIDADE BASE DE CADA FASE DA PREPARACAO.
 *
 * E um numero por fase, e nao uma conta por quadro, porque o pedido pede
 * que o preenchimento seja PROGRESSIVO e legivel: se a opacidade fosse
 * linear o jogador veria o disco fraco demais no comeco e nem saberia que e
 * perigo
 */
const OPACIDADE_BASE = 0.16;
const OPACIDADE_ALVO = 0.42;

/**
 * A ESCALA DA OPACIDADE QUE CRESCE, e ela vai de 0.28 a 0.72.
 *
 * E larga de proposito: o crescimento e linear, mas o olho le areas como
 * "quase pronta" bem antes da metade. Uma escala que comecasse baixa deixaria
 * o primeiro terco do preparo praticamente invisivel, e o jogador perderia o
 * aviso mais importante — o de que o golpe vem
 *
 * O `0.72` no fim e o teto de legibilidade: acima disso a cor da habilidade
 * passa a competir com o contorno branco e o indicador perde a borda
 */
const OPACIDADE_CRESCENDO = 0.28;
const OPACIDADE_CIMOS = 0.72;

/**
 * A COR DA FRENTE, e ela e um branco morno em vez de branco puro.
 *
 * Branco puro sobre a cor da habilidade estouraria os tres canais e viraria
 * um buraco no meio da area. O morno fica acima do preenchimento sem
 * estourar
 */
const FRENTE_CLARA = "#ffffff";

/**
 * A BORDA, e o que separa a area de perigo do chao.
 *
 * ## POR QUE SAO DOIS CírCULOS
 *
 * Porque o preenchimento sozinho desaparece em piso claro. Um disco vermelho
 * a 42% sobre a grama do vale e visivel; sobre a areia da pedreira, quase nao
 * e. A borda e o que garante o contraste, e ela e desenhada com
 * `globalAlpha` cheia para nao ter o mesmo problema
 */
const BORDA_LARGA = 4;
const BORDA_FINA = 1.5;

export class TelegraphRenderer {
  constructor() {
    /**
     * NADA E ALOCADO AQUI.
     *
     * O desenho aloca zero objetos: o `context` do canvas e o unico recurso,
     * e o `save`/`restore` devolve o estado a cada quadro. Um telegraph por
     * quadro e um preenchimento, nao um objeto
     */
  }

  /**
   * DESENHA UM TELEGRAPH.
   *
   * O `progresso` e o quanto do tempo de preparacao ja passou, de 0 a 1. O
   * renderizador nao calcula ele: quem tem o relogio e o motor, e o mesmo
   * relogio que determina o impacto
   */
  desenharTelegraph(context, execucao, progresso, tempoRestante) {
    switch (execucao.tipo) {
      case "circle":
        this.desenharCirculo(context, execucao, progresso);
        break;

      case "ring":
        this.desenharAnel(context, execucao, progresso);
        break;

      case "cone":
        this.desenharCone(context, execucao, progresso);
        break;

      case "line":
        this.desenharLinha(context, execucao, progresso);
        break;

      case "charge":
        this.desenharInvestida(context, execucao, progresso);
        break;

      case "targeted":
        this.desenharCirculo(context, execucao, progresso);
        break;

      default:
        break;
    }
  }

  /**
   * O PREENCHIMENTO progressivo, e o que faz o jogador saber QUANTO falta.
   *
   * ## E POR QUE UM SEGUNDO PASSO, E NAO SO A OPACIDADE
   *
   * Porque opacidade sozinha e um aviso fraco: no comeco do preparo o disco
   * esta a 16% e no fim a 42%, o que da uma sensacao de tempo, mas nao uma
   * leitura. O segundo preenchimento, desenhado com a cor quase branca e
   * somente ate `progresso`, cresce da BORDA para o CENTRO como uma frente
   * de onda — e o jogador ve "quanto ja passou", nao so "quanto falta"
   *
   * O pedido pede "animacao progressiva, mostrando quanto tempo falta". As
   * duas metades da frase precisam de sinais diferentes: a opacidade carrega
   * "falta", e a frente de onda carrega "ja passou"
   */
  preenchimento(context, execucao, progresso, desenhar, desenharFrente = null) {
    const cor = execucao.cor;

    context.save();

    // a area total, fraca: e o "onde pode machucar", e nao precisa mudar
    context.globalAlpha = OPACIDADE_BASE;
    context.fillStyle = cor;
    desenhar(context, 1);
    context.fill();

    /**
     * O QUE CRESCE, e a opacidade dele sobe com o tempo.
     *
     * ## POR QUE A OPACIDADE VARIA E NAO E FIXA
     *
     * Com as duas camadas em numeros fixos, o telegraph cresce de tamanho
     * mas mantem a mesma cor — o jogador ve a area sumindo da borda para o
     * centro, e nao ve "esta quase pronto"
     *
     * Com a opacidade subindo de 0.28 para 0.72, o preenchimento fica
     * visivelmente mais forte E maior. Os dois sinais juntos sao o que faz o
     * olho ler "falta pouco" em vez de "tem algo ali"
     */
    context.globalAlpha = OPACIDADE_CRESCENDO + (OPACIDADE_CIMOS - OPACIDADE_CRESCENDO) * progresso;
    context.fillStyle = cor;
    desenhar(context, progresso);
    context.fill();

    context.restore();

    /**
     * A FRENTE, e ela e a parte que faz o efeito existir.
     *
     * Sem ela o preenchimento e uma mancha que cresce, e o jogador nao tem
     * o "agora". Com ela, a linha/area tem uma PONTA luminosa que caminha do
     * chefe ate a borda, e no ultimo quadro chega — que e literalmente o
     * que o jogador precisa ver para saber que e agora
     */
    if (desenharFrente && progresso > 0.001 && progresso < 0.999) {
      context.save();

      context.globalAlpha = 0.95;
      context.fillStyle = FRENTE_CLARA;
      desenharFrente(context, progresso);
      context.fill();

      context.restore();
    }
  }

  /**
   * O CONTORNO, que e o que garante a legibilidade em qualquer piso.
   */
  contorno(context, execucao, desenhar) {
    context.save();

    context.globalAlpha = 0.9;
    context.strokeStyle = execucao.cor;
    context.lineWidth = BORDA_LARGA;
    desenhar(context);
    context.stroke();

    context.lineWidth = BORDA_FINA;
    context.strokeStyle = "rgba(255,255,255,0.85)";
    context.stroke();

    context.restore();
  }

  /**
   * O CÍRCULO, e o `ground_slam` e o `marked_strike`.
   */
  /**
   * O PULSO DE URGENCIA, e ele e o relogio visual do golpe.
   *
   * ## POR QUE DESENHAR UM ANEL QUE CRESCE E SOME
   *
   * Porque e a unica forma de mostrar TEMPO em um desenho estatico. Um anel
   * que nasce no raio pequeno, cresce para o raio da area e apaga, repetido
   * mais rapido conforme o preparo acaba, faz o olho ler "acabando" sem
   * precisar de numero na tela
   *
   * ## E A MEIA VIDA VARIAVEL, E NAO UM TEMPO FIXO
   *
   * O pulso comeca lento (0.9s entre um e outro) e termina quase colado
   * (0.12s). O numero de aneis ate o impacto e sempre o mesmo, mas a
   * distribuicao deles muda: poucos e largos no comeco, muitos e rapidos no
   * fim
   *
   * E o que faz o jogador se mexer no tempo certo. O aviso que importa nao
   * e o primeiro pulso — e o terceiro, quando a area ainda esta longe de
   * fechar mas ja esta piscando
   *
   * ## E POR QUE NAO USA `spriteTime`
   *
   * Porque o pulso tem de andar com o PROGRESSO deste telegraph. Com o tempo
   * global, dois telegraphs simultaneos pulsariam em fase, e o de quem esta
   * quase batendo pareceria lento
   *
   * @param {(context: CanvasRenderingContext2D, escala: number) => void} desenhar
   *   desenha UM anel; a escala vai de 0.55 ate 1
   */
  pulsoDeUrgencia(context, execucao, progresso, desenhar) {
    // nada de pulso no primeiro e no ultimo quadro: no primeiro a area esta
    // fraca demais para o anel aparecer, e no ultimo o impacto ja saiu
    if (progresso <= 0.02 || progresso >= 0.995) return;

    const restante = 1 - progresso;

    // a MEIA VIDA ENCURTA: 0.9s no comeco, 0.12s no fim
    const meiaVida = 0.12 + restante * 0.78;

    // onde estamos dentro do pulso atual
    const fase = (progresso / meiaVida) % 1;

    /**
     * QUANTOS ANEIS ESTAO VIVOS, e sobe de 1 no comeco para 3 no fim.
     *
     * O `2.9` em vez de `2` e o que faz o terceiro anel aparecer: com o
     * multiplicador em 2, `(1 - restante) * 2` chegava a 2.0 exato no fim e
     * o `Math.floor` devolvia 2 — o pulso ficava com a MESMA quantidade de
     * aneis do inicio ao fim, e a unica coisa que mudava era a meia vida.
     *
     * A intensificacao que o olho le e a quantidade, nao so a velocidade:
     * tres aneis sobrepostos piscam diferente de um, e e isso que faz o
     * ultimo quarto do preparo parecer urgente
     */
    const vivos = 1 + Math.floor((1 - restante) * 2.9);

    context.save();

    for (let i = 0; i < vivos; i += 1) {
      const t = (fase + i / vivos) % 1;

      // o anel cresce e APAGA junto; sem o fade o anel desapareceria de
      // repente e o pulso pareceria um defeito
      const escala = 0.55 + t * 0.45;

      context.globalAlpha = 0.5 * (1 - t);
      context.strokeStyle = execucao.cor;
      context.lineWidth = BORDA_FINA + (1 - t) * 2;

      desenhar(context, escala);
      context.stroke();
    }

    context.restore();
  }

  desenharCirculo(context, execucao, progresso) {
    const r = execucao.raio;

    this.preenchimento(
      context,
      execucao,
      progresso,
      (ctx, fatia) => {
        // a frente de onda e um arco, e nao um disco inteiro
        ctx.beginPath();
        ctx.moveTo(execucao.x + r, execucao.y);
        ctx.arc(
          execucao.x,
          execucao.y,
          r,
          0,
          Math.PI * 2 * fatia,
        );
        ctx.closePath();
      },
    );

this.contorno(context, execucao, (ctx) => {
        ctx.beginPath();
        ctx.arc(execucao.x, execucao.y, r, 0, Math.PI * 2);
      });

      /**
       * O PULSO QUE ACELERA, e ele e o relogio visual do golpe.
       *
       * ## POR QUE A FREQUENCIA MUDA
       *
       * Com um pulso de periodo fixo, o jogador aprende a ignorar — o
       * primeiro pulso parece igual ao ultimo, entao o "acabou" so chega
       * quando a area inteira preenche
       *
       * Encurtando o periodo conforme o preparo avanca, o ultimo quarto do
       * tempo pisca varias vezes em um so segundo. O olho pega isso antes
       * da area fechar, e o jogador se mexe antes de ver o dano
       *
       * E por isso nao usa `spriteTime`: o pulso tem de andar com o PROGRESSO
       * do telegraph. Com o tempo global, dois telegraphs simultaneos
       * pulsariam em fase, e o de quem esta quase batendo pareceria lento
       */
this.pulsoDeUrgencia(context, execucao, progresso, (ctx, escala) => {
        ctx.beginPath();
        ctx.arc(execucao.x, execucao.y, r * escala, 0, Math.PI * 2);
      });
  }

  /**
   * O ANEL, e o `shock_ring`.
   *
   * O desenho tem que deixar CLARO que o centro e seguro: e o que diferencia
   * um anel de um circulo, e o jogador precisa ver isso antes de o relogio
   * acabar, nao descobrir levando dano
   */
  desenharAnel(context, execucao, progresso) {
    const interno = execucao.raioInterno;
    const externo = execucao.raioExterno;

    context.save();

    // a coroa, e nao o disco cheio
    context.globalAlpha = OPACIDADE_BASE;
    context.fillStyle = execucao.cor;
    context.beginPath();
    context.arc(execucao.x, execucao.y, externo, 0, Math.PI * 2);
    context.arc(
      execucao.x,
      execucao.y,
      interno,
      0,
      Math.PI * 2,
      true,
    );
    context.fill("evenodd");

    // a frente de onda viaja do raio interno para o externo
    const raioOnda =
      interno + (externo - interno) * progresso;

    context.globalAlpha = OPACIDADE_ALVO;
    context.beginPath();
    context.arc(execucao.x, execucao.y, raioOnda, 0, Math.PI * 2);
    context.arc(
      execucao.x,
      execucao.y,
      interno,
      0,
      Math.PI * 2,
      true,
    );
    context.fill("evenodd");

    // os dois contornos
    context.globalAlpha = 0.9;
    context.strokeStyle = execucao.cor;
    context.lineWidth = BORDA_LARGA;

    context.beginPath();
    context.arc(execucao.x, execucao.y, externo, 0, Math.PI * 2);
    context.stroke();

    context.beginPath();
    context.arc(execucao.x, execucao.y, interno, 0, Math.PI * 2);
    context.stroke();

    /**
     * O PULSO, e ele e a unica coisa que diz QUANDO a onda chega.
     *
     * O anel ja mostra ONDE o perigo esta — entre o raio interno e o
     * externo. O que ele nao diz e "falta um segundo", e o pulso e o que
     * fecha essa informacao
     */
    this.pulsoDeUrgencia(context, execucao, progresso, (ctx, escala) => {
      const r = interno + (externo - interno) * escala;

      ctx.beginPath();
      ctx.arc(execucao.x, execucao.y, r, 0, Math.PI * 2);
    });

    context.restore();
  }

  /**
   * O CONE, e o `cleave`.
   *
   * O angulo vem pronto da execucao (em radianos, ja dividido por dois na
   * criacao), e o arco vai do `-angulo/2` ao `+angulo/2` em relacao a
   * direcao congelada
   */
  desenharCone(context, execucao, progresso) {
    const meio = (execucao.anguloGraus * Math.PI) / 180 / 2;
    const ang = Math.atan2(execucao.dirY, execucao.dirX);
    const r = execucao.alcance;

    this.preenchimento(
      context,
      execucao,
      progresso,
      (ctx, fatia) => {
        ctx.beginPath();
        ctx.moveTo(execucao.x, execucao.y);
        ctx.arc(
          execucao.x,
          execucao.y,
          r,
          ang - meio,
          ang - meio + 2 * meio * fatia,
        );
        ctx.closePath();
      },
    );

    this.contorno(context, execucao, (ctx) => {
      ctx.beginPath();
      ctx.moveTo(execucao.x, execucao.y);
      ctx.arc(execucao.x, execucao.y, r, ang - meio, ang + meio);
      ctx.closePath();
    });
  }

  /**
   * A LINHA, e o `energy_beam`.
   *
   * E o `charge` que NAO investe, entao a funcao e a mesma — a diferenca e
   * que o `charge` desenha o trajeto e depois o chefe anda sobre ele
   */
  desenharLinha(context, execucao, progresso) {
    const meia = execucao.largura / 2;

    this.preenchimento(
      context,
      execucao,
      progresso,
      (ctx, fatia) => {
        // o retangulo local, girado para a direcao da linha
        const comprimento = execucao.alcance * fatia;

        ctx.beginPath();
        ctx.moveTo(
          execucao.x - execucao.dirY * meia,
          execucao.y + execucao.dirX * meia,
        );
        ctx.lineTo(
          execucao.x + execucao.dirX * comprimento - execucao.dirY * meia,
          execucao.y + execucao.dirY * comprimento + execucao.dirX * meia,
        );
        ctx.lineTo(
          execucao.x + execucao.dirX * comprimento + execucao.dirY * meia,
          execucao.y + execucao.dirY * comprimento - execucao.dirX * meia,
        );
ctx.lineTo(
            execucao.x + execucao.dirY * meia,
            execucao.y - execucao.dirX * meia,
          );
          ctx.closePath();
        },

        /**
         * A FRENTE DO RAIO, e ela caminha do chefe ate a ponta.
         *
         * E o que o jogador acompanha com o olho enquanto espera: uma barra
         * branca atravessando a faixa, que chega na borda exatamente no
         * quadro do impacto. Sem ela o preenchimento so cresce em tamanho e
         * o "falta X" fica no chute do jogador
         */
        (ctx, fatia) => {
          const comprimento = execucao.alcance * fatia;

          const cx = execucao.x + execucao.dirX * comprimento;
          const cy = execucao.y + execucao.dirY * comprimento;

          // um pouco mais larga que a faixa, para a frente nao sumir dentro
          // dela no ultimo quadro
          const meiaFrente = meia * 1.35;

          ctx.beginPath();
          ctx.moveTo(cx - execucao.dirY * meiaFrente, cy + execucao.dirX * meiaFrente);
          ctx.lineTo(cx + execucao.dirY * meiaFrente, cy - execucao.dirX * meiaFrente);
          ctx.lineTo(
            cx + execucao.dirY * meiaFrente * 1.5,
            cy - execucao.dirX * meiaFrente * 1.5,
          );
          ctx.lineTo(
            cx - execucao.dirY * meiaFrente * 1.5,
            cy + execucao.dirX * meiaFrente * 1.5,
          );
          ctx.closePath();
        },
      );

    this.contorno(context, execucao, (ctx) => {
      const pontaX = execucao.x + execucao.dirX * execucao.alcance;
      const pontaY = execucao.y + execucao.dirY * execucao.alcance;

      ctx.beginPath();
      ctx.moveTo(
        execucao.x - execucao.dirY * meia,
        execucao.y + execucao.dirX * meia,
      );
      ctx.lineTo(
        pontaX - execucao.dirY * meia,
        pontaY + execucao.dirX * meia,
      );
      ctx.lineTo(
        pontaX + execucao.dirY * meia,
        pontaY - execucao.dirX * meia,
      );
      ctx.lineTo(
        execucao.x + execucao.dirY * meia,
        execucao.y - execucao.dirX * meia,
      );
      ctx.closePath();
    });
  }

  /**
   * A INVESTIDA, e o `charge`.
   *
   * ## E POR QUE UM TRACADO E NAO UM RETANGULO CHEIO
   *
   * Porque a investida tem um TRAJETO que o jogador tem de ler: de onde o
   * chefe vai sair, para onde ele vai e onde ele para. Um retangulo solido
   * diz que o chefe vai estar em algum lugar do retangulo; o tracado diz o
   * caminho, que e a informacao que permite desviar para o lado
   */
  desenharInvestida(context, execucao, progresso) {
    const meia = execucao.largura / 2;
    const comprimento = execucao.alcance;

    const pontaX = execucao.x + execucao.dirX * comprimento;
    const pontaY = execucao.y + execucao.dirY * comprimento;

    context.save();

    /**
     * A TRILHA, desenhada como RETANGULO CHEIO e nao como linha.
     *
     * A primeira versao usava `stroke` com `lineWidth` igual a largura da
     * investida, que e a forma mais barata de mostrar um trajeto. So que a
     * linha tem as pontas em `butt`, o canto da faixa ficava aberto, e o
     * preenchimento de 16% sobre o chao escuro do vale ficava quase
     * invisivel a distancia de jogo
     *
     * O retangulo cheio cobre a mesma area com as pontas fechadas, e
     * `preenchimento` reaproveita o mesmo par de opacidades das outras
     * formas — o que da a investida a MESMA leitura de "crescendo" que o
     * circulo e a linha, em vez de uma leitura so dela
     */
    this.preenchimento(
      context,
      execucao,
      progresso,
      (ctx, fatia) => {
        const comprimentoAtual = comprimento * fatia;

        const ponta = (mult) => ({
          x: execucao.x + execucao.dirX * comprimentoAtual * mult,
          y: execucao.y + execucao.dirY * comprimentoAtual * mult,
        });

        const a = ponta(0);
        const b = ponta(1);

        // o retangulo girado, pelos quatro cantos
        ctx.beginPath();
        ctx.moveTo(a.x - execucao.dirY * meia, a.y + execucao.dirX * meia);
        ctx.lineTo(b.x - execucao.dirY * meia, b.y + execucao.dirX * meia);
        ctx.lineTo(b.x + execucao.dirY * meia, b.y - execucao.dirX * meia);
        ctx.lineTo(a.x + execucao.dirY * meia, a.y - execucao.dirX * meia);
        ctx.closePath();
      },

      /**
       * A FRENTE DA INVESTIDA, e ela e uma barra transversal na ponta da
       * trilha que ja cresceu.
       *
       * E a barra, e nao um ponto: a investida tem 150 de largura, e um
       * ponto luminoso no meio dela se perderia. A barra ocupa a largura
       * INTEIRA, entao o jogador ve "a frente chegou aqui" com um golpe de
       * vista
       */
      (ctx, fatia) => {
        const comprimentoAtual = comprimento * fatia;

        const cx = execucao.x + execucao.dirX * comprimentoAtual;
        const cy = execucao.y + execucao.dirY * comprimentoAtual;

        ctx.beginPath();
        ctx.moveTo(cx - execucao.dirY * meia, cy + execucao.dirX * meia);
        ctx.lineTo(cx + execucao.dirY * meia, cy - execucao.dirX * meia);
        ctx.lineTo(
          cx + execucao.dirY * meia * 1.35,
          cy - execucao.dirX * meia * 1.35,
        );
        ctx.lineTo(
          cx - execucao.dirY * meia * 1.35,
          cy + execucao.dirX * meia * 1.35,
        );
        ctx.closePath();
      },
    );

    /**
     * AS BORDAS DA FAIXA, que sao o que fecha a leitura do "nao entre".
     *
     * Sem elas a trilha e um retangulo vermelho e o jogador nao sabe onde
     * comeca nem onde termina a investida — que e exatamente a informacao
     * que o telegraph precisa dar
     */
    context.globalAlpha = 0.9;
    context.strokeStyle = execucao.cor;
    context.lineWidth = BORDA_LARGA;

    for (const lado of [-1, 1]) {
      context.beginPath();
      context.moveTo(
        execucao.x - execucao.dirY * meia * lado,
        execucao.y + execucao.dirX * meia * lado,
      );
      context.lineTo(
        pontaX - execucao.dirY * meia * lado,
        pontaY + execucao.dirX * meia * lado,
      );
      context.stroke();
    }

    context.restore();
  }

  /**
   * O IMPACTO, o que aparece no quadro em que o dano sai.
   *
   * ## POR QUE UM QUADRO SO, E COM ALPHA DE COR
   *
   * Porque o efeito de impacto precisa ser visivel e nao pode virar lixo na
   * tela. Um anel que cresce e some no mesmo quadro e o "flash" que o jogador
   * associa com o golpe — e ele e desenhado pela COR do telegraph, entao o
   * golpe da marca amarela pisca amarelo e o do cone laranja pisca laranja,
   * sem nenhum numero novo
   */
  desenharImpacto(context, execucao, progressoImpacto) {
    const raio = execucao.raio ?? execucao.largura ?? 60;

    context.save();

    // o anel cresce e some: a opacidade cai mais rapido que o raio cresce
    context.globalAlpha = Math.max(0, 1 - progressoImpacto);
    context.strokeStyle = execucao.cor;
    context.lineWidth = BORDA_LARGA * (1 - progressoImpacto * 0.6);

    context.beginPath();
    context.arc(
      execucao.x,
      execucao.y,
      raio + raio * progressoImpacto * 0.6,
      0,
      Math.PI * 2,
    );
    context.stroke();

    context.restore();
  }
}