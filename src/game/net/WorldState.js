/**
 * O que o cliente sabe do mundo, vindo do servidor.
 *
 * O servidor manda 20 snapshots por segundo e o navegador
 * desenha 60 vezes. Se o cliente desenhar direto o ultimo
 * pacote, o personagem da um salto a cada 50ms e parece que
 * esta teleportando. Por isso guardamos o anterior tambem e
 * `amostrar()` devolve a posicao no meio do caminho.
 */
export class WorldState {
  constructor() {
    this.seq = 0;
    this.time = 0;

    /** o ultimo pacote que chegou */
    this.atual = null;

    /** o pacote anterior, para interpolar */
    this.anterior = null;

    /** o primeiro pacote serve de ponto de partida da interpolacao */
    this.primeiro = null;

    this.jogadores = new Map();
    this.inimigos = new Map();
    this.drops = new Map();

    /**
     * As flechas, pelo id que o servidor deu, indexadas em
     * `flechasPorId`.
     *
     * Ficam indexadas como inimigos e drops porque e o mesmo tipo de
     * coisa: coisas que existem agora porque o servidor disse. O
     * `id` importa mais aqui do que nos outros: uma flecha e
     * recriada a cada disparo, entao o id e o que impede o desenho
     * de piscar quando o pacote chega.
     */
    this.flechasPorId = new Map();
  }

  /**
   * Aplica um pacote do servidor.
   *
   * Devolve `false` e ignora o pacote quando ele e mais velho
   * que o que ja temos. A internet entrega fora de ordem de vez
   * em quando, e aceitar um pacote atrasado faz o jogador dar
   * meia-volta.
   */
  aplicar(snapshot) {
    const seq = snapshot?.seq ?? 0;

    if (!snapshot || seq <= this.seq) return false;

    this.seq = seq;
    this.time = snapshot.time ?? this.time;

    this.anterior = this.atual;
    this.atual = snapshot;

    if (!this.primeiro) this.primeiro = snapshot;

    this.jogadores = indexar(snapshot.players);
    this.inimigos = indexar(snapshot.enemies);
    this.drops = new Map(
      (snapshot.drops ?? []).map((d) => [d.uid, d]),
    );

    // a lista e REFEITA a cada pacote, e nao mesclada: uma flecha
    // que o servidor parou de mandar bateu ou expirou, e o cliente
    // tem que parar de desenha-la no mesmo instante
    this.flechasPorId = indexar(snapshot.projectiles);

    if (this.recebidoEm === undefined) this.recebidoEm = 0;

    return true;
  }

  /** O meu jogador, pelo id que veio no WELCOME. */
  eu(playerId) {
    return this.jogadores.get(playerId) ?? null;
  }

  /**
   * As flechas do ultimo pacote.
   *
   * Nao ha interpolacao aqui, e uma decisao: a flecha e rapida
   * (720 px/s no Arbalist) e dura pouco. Andar a velocidade dela
   * entre pacotes daria uma trajetoria que o servidor nunca
   * mandou, e um cliente modificado veria a flecha voando para
   * onde ele quisesse. Quem decide a posicao e o servidor, e a
   * 50ms por pacote a flecha ja cobre um salto curto e legivel.
   */
  projeteis() {
    return [...this.flechasPorId.values()];
  }

  /** Os outros jogadores, ja sem o meu. */
  outros(playerId) {
    return [...this.jogadores.values()].filter(
      (p) => p.id !== playerId,
    );
  }

  /**
   * A posicao de um jogador AGORA, entre os dois ultimos pacotes.
   *
   * `t` e o quanto ja andamos no intervalo entre eles (0 = o
   * pacote anterior, 1 = o atual).
   *
   * O detalhe que importa: em `t = 0` devolvemos o ANTERIOR, nao
   * o atual. O pacote que acabou de chegar descreve o mundo em um
   * instante que ja passou, entao comecar nele e um tick adiantado
   * faria o personagem pular a cada 50ms. Desenhar o anterior e
   * chegar no atual com suavidade e o que tira o tremor; a troca
   * por extrapolar e segura porque o proximo pacote chega logo.
   */
  amostrar(id, t = 0) {
    const atual = this.jogadores.get(id);
    const anterior = this.anterior
      ? indexar(this.anterior.players).get(id)
      : null;

    if (!atual) return null;

    // um `t` estragado (aba em segundo plano voltando) nao pode
    // projetar o jogador para fora do mapa
    const limitado = Math.min(1, Math.max(0, t));

    // so um pacote ainda chegou: nao ha caminho para percorrer
    if (!anterior) return atual;

    return {
      ...atual,
      x: anterior.x + (atual.x - anterior.x) * limitado,
      y: anterior.y + (atual.y - anterior.y) * limitado,
    };
  }

  /**
   * Em que fracao do caminho estamos.
   *
   * O servidor roda a 20Hz, entao cada pacote cobre 50ms. O
   * cliente sabe quanto tempo passou desde o ultimo e usa isso
   * para o `t`. Fora da janela, trava em 1: sem isso, uma aba em
   * segundo plano voltaria e o personagem daria um salto de meio
   * mapa.
   */
  fracaoDoCiclo(agora, duracaoPacote = 50) {
    if (!this.atual) return 1;
    if (duracaoPacote <= 0) return 1;

    const passou = agora - this.recebidoEm;

    return Math.max(0, Math.min(1, passou / duracaoPacote));
  }

  marcaRecebimento(agora) {
    this.recebidoEm = agora;
  }
}

/** Um indice por id, que e como o desenho procura as coisas. */
function indexar(lista) {
  const mapa = new Map();

  for (const item of lista ?? []) {
    mapa.set(item.id, item);
  }

  return mapa;
}
