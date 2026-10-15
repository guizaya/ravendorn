/**
 * A PREVISAO E A RECONCILIACAO do jogador local.
 *
 * ## O QUE ESTE ARQUIVO resolve
 *
 * Sem ele, o cliente nao simulava nada: o `GameEngine` sai antes de
 * qualquer logica de jogo quando `networked` esta ligado
 * (`GameEngine.js`, o `return` do ramo de rede), e a posicao do boneco
 * vinha inteira do servidor, a 20Hz, por interpolacao
 * (`WorldState.amostrar`).
 *
 * Isso dava dois defeitos ao mesmo tempo:
 *
 * 1. TRAVAMENTO. O servidor manda 20 pacotes por segundo. Entre um
 *    pacote e o outro o boneco ficava parado, mesmo com a tecla
 *    apertada
 * 2. ATRASO. A interpolacao desenha o PASSADO de proposito (o pacote
 *    que acabou de chegar descreve um instante que ja passou). Com 80ms
 *    de ping, o boneco andava 80ms atras do dedo
 *
 * ## POR QUE UM ARQUIVO SO, E NAO DENTRO DO `NetworkWorld`
 *
 * Porque e a unica parte do cliente que precisa de uma regra propria:
 * os outros jogadores tem interpolacao, que e deterministica e nao
 * tem nada a reconciliar. O jogador local tem previsao, que e a unica
 * coisa aqui que depende de uma ESTIMATIVA do servidor, e essa
 * estimativa tem regra de comparacao (o limiar) e regra de
 * suavizacao (a taxa). Deixar isso espalhado no `NetworkWorld` ia
 * misturar "o que o servidor disse" com "quanto a tela ainda deve
 * andar para la", e as duas coisas nao podem ser lidas na mesma hora.
 */

/**
 * O LIMIAR DO ESTALO, em pixels.
 *
 * ## POR QUE 48 E NAO 2
 *
 * A correcao aqui nao e um erro de matematica: e a diferenca entre
 * ONDE O DEDO ESTA (a previsao local, agora) e ONDE O SERVIDOR
 * ESTAVA (a posicao autoritativa, ha meio RTT). Com 80ms de ping, o
 * servidor mandou uma posicao que ja tem 40ms de idade, e o boneco
 * andou uns 40px desde entao mesmo que o cliente esteja
 * PERFEITAMENTE em sintonia com ele.
 *
 * Se o limiar fosse pequeno, esse atraso de rede seria lido como erro
 * todo pacote e o boneco seria puxado para tras duas vezes por
 * segundo -- o rubber band que a previsao existe para matar. Se fosse
 * enorme, o cliente nunca aceitaria uma correcao real do servidor e
 * andaria atraves de parede ate dar o proximo passo.
 *
 * 48px e um pouco mais que a distancia percorrida num RTT de 100ms na
 * velocidade do jogo: acima disso, e divergencia de verdade (parede,
 * teleporte, dash, empurrao do mob) e o servidor esta certo.
 */
export const LIMIAR_ESTALO_PX = 48;

/**
 * A TAXA DE CORRECAO, por segundo.
 *
 * ## POR QUE SUAVIZAR E NAO ESTALAR SEMPRE
 *
 * Estalar sempre seria "correto" e seria horrivel: a 20Hz, o boneco
 * daria um salto de meio mapa a cada 50ms, que e a doenca original.
 * A taxa faz o erro ser pago em ~0,2s (1 - e^(-14 * 0,2) = 94%),
 * imperceptivel como salto, e ainda assim corrige.
 *
 * ## POR QUE NAO E UM TEMPO FIXO
 *
 * Porque um ganho fixo por quadro (`+= erro / 8`) muda de velocidade
 * conforme o quadro: a 144Hz o boneco voaria para o servidor em 55ms,
 * a 30Hz levaria 266ms. Multiplicar pelo `deltaTime` deixa a
 * correcao com a MESMA duracao em qualquer maquina.
 */
export const TAXA_CORRECAO = 14;

/**
 * O TETO DA CORRECAO, em pixels.
 *
 * ## POR QUE ISTO EXISTE
 *
 * A correcao pendente e a soma de varios erros, e nada impede que ela
 * cresca sem teto: se o servidor fica meio segundo sem mandar nada e
 * volta, o erro acumulado pode ser de centenas de pixels. Pagar isso
 * todo pelo mesmo `e^-14t` faz o boneco dar um bote de meio segundo no
 * meio da partida.
 *
 * O teto transforma esse caso raro em varios passos de tamanho
 * razoavel: o boneco ainda corrige, so que em vez de um bote feio ele
 * anda rapido por um quarto de segundo. O teto e por passo e nao
 * acumulado, entao o resto da correcao continua na fila.
 */
export const TETO_CORRECAO_PX = 96;

export class Previsao {
  constructor({
    limiar = LIMIAR_ESTALO_PX,
    taxa = TAXA_CORRECAO,
    teto = TETO_CORRECAO_PX,
  } = {}) {
    this.limiar = limiar;
    this.taxa = taxa;
    this.teto = teto;

    /**
     * O QUE AINDA FALTA andar.
     *
     * X e Y separados porque a correcao nao e um vetor normalizado:
     * ela e "quanto falta, em cada eixo", e normalizar aqui
     * transformaria um desvio quase-so-horizontal em um salto na
     * diagonal.
     */
    this.pendenteX = 0;
    this.pendenteY = 0;

    /** O ultimo `ackSeq` do servidor, so para diagnostico e guarda. */
    this.ackSeq = 0;

    /** Quantas vezes o servidor estalou a posicao. Sobe em conflito real. */
    this.estalos = 0;
  }

  /**
   * O SERVIDOR DISSE ONDE O JOGADOR ESTAVA.
   *
   * ## POR QUE COMPARA COM A POSICAO PREVISTA E NAO COM A AUTORITATIVA DIRETO
   *
   * Nao ha como casar `ackSeq` com um instante exato da previsao sem
   * um relogio em comum entre as duas maquinas. E a alternativa
   * classica — guardar o historico de inputs e reexecutar a simulacao
   * do zero ate o `ackSeq` — foi descartada de proposito aqui: o
   * `updatePlayer` deste motor nao e so andar, ele tambem resolve
   * empurrao de mob, dash, mineracao e sobreposicao de prop, e
   * reexecutar tudo isso a cada pacote viraria uma segunda
   * simulacao completa, divergindo do servidor por motivos que nao tem
   * a ver com rede.
   *
   * A diferenca que sobra e o que este metodo trata: o quanto a tela
   * precisa se aproximar do servidor.
   */
  reconciliar(jogador, servidor) {
    if (!jogador || !servidor) return;

    if (typeof servidor.ackSeq === "number") {
      // pacotes antigos podem chegar depois: um ack que anda para
      // tras e um pacote de um servidor que reiniciou, nao o nosso
      if (servidor.ackSeq >= this.ackSeq) this.ackSeq = servidor.ackSeq;
    }

    const dx = servidor.x - jogador.x;
    const dy = servidor.y - jogador.y;
    const distancia = Math.hypot(dx, dy);

    /**
     * O ESTALO, e so ele.
     *
     * E o unico caminho que escreve direto em `jogador.x/y`. Aqui o
     * servidor esta certo e o cliente errado: parede, teleporte,
     * knockback, ou um cliente com colisao diferente. Pagando isso
     * aos poucos o boneco atravessaria a parede que o servidor ja
     *Barrou, e o proximo pacote repetiria a conta.
     */
    if (distancia > this.limiar) {
      jogador.x = servidor.x;
      jogador.y = servidor.y;

      this.pendenteX = 0;
      this.pendenteY = 0;
      this.estalos += 1;

      return;
    }

    /**
     * A CORRECAO VAI PARA A FILA, E NAO PARA O JOGADOR.
     *
     * Some com o que ja estava na fila em vez de acumular por cima.
     * Sem isto, dois pacotes seguidos a 50ms de intervalo somariam o
     * mesmo erro duas vezes e o boneco passaria do servidor — o
     * rubber band de novo, agora com sinal invertido, que e pior que o
     * original porque o jogador nao consegue mais andar reto.
     *
     * A posicao autoritativa mais recente SUBSTITUI a anterior, que ja
     * virou informacao velha.
     */
    this.pendenteX = dx;
    this.pendenteY = dy;
  }

  /**
   * UM QUADRO DE CORRECAO, antes de qualquer coisa do servidor.
   *
   * E chamado pelo `GameEngine` no ramo de rede, no lugar onde antes
   * nao rodava nada. A ordem dentro do quadro e o que importa: a
   * correcao e paga ANTES da previsao do dedo, para que o dedo sempre
   * tenha a ultima palavra sobre para onde o boneco vai neste quadro.
   */
  avancar(jogador, deltaTime) {
    if (!jogador) return;

    if (this.pendenteX === 0 && this.pendenteY === 0) return;

    if (deltaTime <= 0) return;

    /**
     * `1 - e^(-taxa * dt)` e o equivalente discreto de `e^(-taxa * t)`.
     *
     * Usar `Math.exp` direto e o erro classico de integracao: a
     * 60Hz, `pendente * 0.2333` pagaria a mesma fracao por quadro em
     * qualquer maquina, mas a fracao por SEGUNDO mudaria com o quadro.
     */
    const passo = 1 - Math.exp(-this.taxa * deltaTime);

    const dx = this.pendenteX * passo;
    const dy = this.pendenteY * passo;

    this.pendenteX -= dx;
    this.pendenteY -= dy;

    const sobra = Math.hypot(this.pendenteX, this.pendenteY);

    /**
     * O TETO POR PASSO, e o resto continua na fila.
     *
     * Cortar o resto (deixar zero) seria rapido demais: um buraco de
     * 400px seria pago em 4 quadros e o boneco daria um bote. O que
     * este codigo faz e limitar o quanto entra neste quadro, e deixar
     * o restante esperando o proximo.
     */
    if (sobra > this.teto) {
      const passo = this.teto / sobra;

      this.pendenteX *= passo;
      this.pendenteY *= passo;
    }

    /**
     * O RESTO E MENOR QUE UM SUB-PXEL: e ruido de ponto flutuante.
     *
     * Sem este corte a pendente nunca chega a zero (ela decai por
     * multiplicacao e converge para um numero minuscule, nao para 0) e
     * o boneco ficaria arrastando um residuo para sempre.
     */
    if (Math.hypot(this.pendenteX, this.pendenteY) < 0.05) {
      this.pendenteX = 0;
      this.pendenteY = 0;
    }

    jogador.x += dx;
    jogador.y += dy;
  }

  /** O que ainda falta andar. So para diagnostico. */
  falta() {
    return Math.hypot(this.pendenteX, this.pendenteY);
  }

  /** Esquece o que estava pendente. Usado ao trocar de mapa. */
  limpar() {
    this.pendenteX = 0;
    this.pendenteY = 0;
    this.ackSeq = 0;
    this.estalos = 0;
  }
}