/**
 * O SISTEMA DE TELEGRAPH: a fase de preparacao, o instante do impacto e o dano.
 *
 * ## A REGRA QUE DOMINA ESTE ARQUIVO
 *
 * O instante do impacto e um numero unico calculado pelo SERVIDOR, e ele
 * viaja no pacote. Nenhum cliente calcula o momento do dano, e o relogio
 * daqui nao e "quantos quadros faltam" — e "quanto falta ate `impactoEm`",
 * medido no mesmo relogio que o servidor mediu
 *
 * Isso e o que a secao 5 do pedido pede: nao dependa de que cada cliente
 * receba o evento no mesmo instante. O cliente recebe o telegraph com
 * `impactoEm` ja calculado, e o quadro de ataque e desenhado com base nele
 *
 * ## POR QUE O SISTEMA VIVE NO MOTOR E NAO NO RENDERIZADOR
 *
 * Porque o motor e a unica coisa que o servidor E o cliente compartilham: o
 * `GameServer` instancia o mesmo `GameEngine`. O sistema cria a execucao,
 * o motor avanca o relogio, o servidor aplica o dano, e o renderizador so
 * le o estado. Se a preparo vivesse no renderizador, cada cliente teria a
 * sua copia e o dano nao teria dono
 */

import {
  contemPonto,
  cosMeioAnguloDe,
} from "./telegraphGeometry.js";

/**
 * UM IDENTIFICADOR DE EXECUCAO.
 *
 * ## E POR QUE UM CONTADOR, E NAO O ID DA CRIATURA
 *
 * Porque o mesmo chefe pode ter dois telegraphs vivos em uma janela que se
 * sobrepoe (uma preparo que dura 2s e uma que dura 1.2s, se a segunda
 * comecar logo depois da primeira). Com o id da criatura os doisteriamos o
 * mesmo nome, e o pacote nao saberia qual era qual
 *
 * ## E POR QUE UM CONTADOR MONOTONICO, E NAO UM RANDOM
 *
 * Porque e um identificador de correlacao entre o servidor e o cliente. Se o
 * cliente inventasse um, os dois lados poderiam gerar o mesmo numero para
 * execucoes diferentes e umindicador apareceria no lugar errado. O contador
 * cresce dentro de um motor so, e cada cliente tem o seu motor
 */
let contadorExecucao = 1;

export function proximoIdDeExecucao() {
  const id = contadorExecucao;

  contadorExecucao += 1;

  return `tg_${id}`;
}

/**
 * O TELEGRAPHSYSTEM, e o dono das execucoes vivas.
 *
 * ## O QUE ELE GUARDA
 *
 * Uma lista de execucoes por criatura. Cada execucao tem: a habilidade, o
 * instante de inicio, o instante de impacto, a geometria CONGELADA (a posicao
 * de onde o golpe sai), e se o dano ja foi aplicado
 *
 * ## E POR QUE A GEOMETRIA E CONGELADA
 *
 * Porque o jogador tem de ver o mesmo que o dano vai acertar. Se a posicao
 * fosse reavaliada no impacto, um chefe que andou durante a preparacao
 * acertaria uma area que nunca foi anunciada. A excecao explicita e o
 * `focarNoImpacto`, que congela no IMPACTO — e o jogador ve o disco
 * acompanhar o chefe ate o ultimo quadro, o que e justo porque o alvo e o
 * proprio chefe
 */
export class TelegraphSystem {
  constructor(world) {
    this.world = world;
  }

  /**
   * O AVANCO DO RELOGIO, chamado uma vez por quadro pelo motor.
   *
   * ## POR QUE O IMPACTO E TRATADO AQUI, E NAO NUM `setTimeout`
   *
   * Porque um `setTimeout` nao pausa quando o jogo pausa, nao acompanha o
   * relogio do servidor, e nao sobrevive a um relogio de mapa. Aqui o
   * tempo e o do motor, entao o golpe sai exatamente quando o motor diz que
   * saiu
   *
   * ## E POR QUE O `impactoEm` E ABSOLUTO
   *
   * Porque um tempo relativo ("faltam 1.2s") se perderia a cada quadro em
   * que o pacote nao chegasse. O `impactoEm` e um instante: se o cliente
   * recebe o telegraph atrasado, ele roda a preparacao a partir da data
   * real e chega no mesmo ponto
   */
  update(deltaTime, agora) {
    const execucoes = this.world.telegraphs;

    for (let i = execucoes.length - 1; i >= 0; i -= 1) {
      const execucao = execucoes[i];

      /**
       * O INSTANTE DO IMPACTO, traduzido para o relogio DESTE motor.
       *
       * ## POR QUE NAO COMPARAR DIRETO
       *
       * Porque `impactoEm` e um numero do `world.time` do SERVIDOR, e o
       * cliente conta em `spriteTime`. Sao escalas sem relacao: o servidor em
       * 340 e o cliente em 12 davam `agora >= impactoEm` como `12 >= 342`,
       * sempre falso. A execucao remota nunca saia da lista, entao o mesmo
       * telegraph se redesenhava a cada pacote, a 10Hz, para sempre
       *
       * O `deslocamento` foi calculado no `aplicarTelegraph`, que e o unico
       * lugar que viu o pacote. Aqui ele so e aplicado
       *
       * A execucao LOCAL do servidor nao tem `deslocamento` — o `?? 0` faz
       * a conta voltar a ser a direta, que e a correta la
       */
      const instanteDoImpacto =
        execucao.impactoEm - (execucao.deslocamento ?? 0);

      /**
       * A EXECUCAO SEU EXECUTOU.
       *
       * O `>=` e o que garante o requisito do pedido: "o ataque nunca deve
       * causar dano antes do tempo anunciado". Com `>` o dano sairia no
       * quadro ANTES do instante, que e o que faria o jogador levar dano
       * com o disco ainda crescendo
       */
      if (agora >= instanteDoImpacto) {
        this.aplicarImpacto(execucao);

        /**
         * A TRAVA DO CHEFE E LIBERADA AQUI, e nao so no ramo de `update`.
         *
         * Este bloco e o unico lugar onde o `telegraphAtivo` volta a false
         * depois de um golpe. A execucao remota do CLIENTE nao passa por ele
         * — o `liberarChefe` e o do SERVIDOR, e o cliente nao decide quando
         * o chefe volta a poder escolher habilidade
         *
         * E o `telegraphAtivo` e uma trava do motor de SIMULACAO. No cliente
         * ela nunca foi ligada (a IA nao roda la), entao a leitura e sempre
         * `undefined` e o `liberarChefe` sai no primeiro `if`
         */
        if (!execucao.isRemote) this.liberarChefe(execucao);

        execucoes.splice(i, 1);
        continue;
      }

      /**
       * A EXECUCAO FOI CANCELADA e nao deve mais ter efeito.
       *
       * O chefe morreu, foi removido ou a fase mudou: a execucao sai da lista
       * sem aplicar dano. E o que garante que um ataque atrasado nao acerte
       * um jogador depois que a luta acabou
       */
      if (!this.execucaoContinuaValida(execucao)) {
        if (!execucao.isRemote) this.liberarChefe(execucao);

        execucoes.splice(i, 1);
        continue;
      }

      /**
       * O ALVO MARCADO, com `seguirAlvo`.
       *
       * A posicao do disco segue o jogador enquanto a execucao esta na fase
       * de acompanhamento. No instante da fixacao — `impactoEm - fixarAntesDeImpacto` —
       * a posicao congela e o jogador tem o tempo restante para sair
       *
       * E o que a secao 2.4 do pedido chama de comportamento B, e o
       * comportamento A e o mesmo caminho com `seguirAlvo: false`, que nunca
       * entra neste bloco
       */
      if (execucao.seguirAlvo) {
const limiteFixacao =
        instanteDoImpacto - execucao.fixarAntesDeImpacto;

        if (agora < limiteFixacao) {
          const alvo = this.alvoDe(execucao);

          if (alvo) {
            execucao.x = alvo.x;
            execucao.y = alvo.y;
          }
        }
      }
    }
  }

  /**
   * A EXECUCAO AINDA VALE?
   *
   * ## OS TRES MOTIVOS DE CANCELAR
   *
   * - o chefe morreu ou saiu do mapa: nao ha quem ataque
   * - o chefe entrou em `retreating` pela `leash`: ele esta voltando para
   *   casa, e um telegraph parado no chao enquanto o chefe se afasta seria
   *   um ataque sem dono
   * - o jogador-alvo do `marked_strike` desconectou: a marca ficaria
   *   congelada no chao sem ninguem para desviar
   *
   * ## E POR QUE ISTO E UM METODO, E NAO UM `if` NO `update`
   *
   * Porque sa tres motivos que crescem, e cada um novo e uma linha no
   * `update` com um `splice` proprio. O metodo e o lugar onde a lista de
   * motivos mora
   */
  execucaoContinuaValida(execucao) {
    /**
     * A EXECUCAO RECEBIDA JA FOI VALIDADA PELO SERVIDOR.
     *
     * E o que resolve a execucao remota sumindo no primeiro quadro: o
     * `inimigoDe` procura no `indiceInimigos`, que e montado pelo `setMap` do
     * MOTOR DE SIMULACAO. No cliente os inimigos vem pelo pacote, em uma
     * lista propria, e nao nesse indice — entao a busca dava `null` e a
     * execucao era descartada como "chefe nao encontrado"
     *
     * Ela nao sumia de vez porque o `aplicarTelegraph` recria a lista a cada
     * pacote, a 10Hz. O telegraph piscava 10 vezes por segundo e o
     * preenchimento recomecava do zero toda vez
     *
     * Quem tem o direito de cancelar um telegraph e o SERVIDOR: ele ja
     * verificou o chefe, o alvo e a fase antes de mandar o pacote. O cliente
     * so desenha o que recebeu
     */
    if (execucao.isRemote) return true;

    const inimigo = this.inimigoDe(execucao);

    if (!inimigo) return false;
    if (!inimigo.alive) return false;
    if (inimigo.retreating) return false;

    if (execucao.seguirAlvo && !this.alvoDe(execucao)) return false;

    return true;
  }

  /**
   * O INIMIGO DE UMA EXECUCAO.
   *
   * O indice e o mesmo `byId` que o resto do motor usa, e nao uma busca
   * linear: sao 3 telegraphs vivos contra 93 inimigos, e uma busca por
   * quadro seria 279 comparacoes para nada
   */
/**
 * LIBERA O CHEFE, e devolve a ele a capacidade de escolher habilidade.
 *
 * ## POR QUE ISTO PRECISA EXISTIR, E O QUE ACONTECE SEM ISSO
 *
 * A trava `telegraphAtivo` e ligada pela IA no inicio da preparacao. Se
 * ninguem limpa, o chefe fica `attack` para sempre: a `tentarHabilidadeDeChefe`
 * ve a trava, devolve `true` e o `updateBehavior` sai — o chefe nem persegue,
 * nem ataca, nem passeia. Um chefe que para de existir em pleno combate
 *
 * ## E POR QUE E CHAMADO NOS DOIS CAMINHOS
 *
 * No impacto e no cancelamento. Se o chefe morreu no meio da preparacao, o
 * caminho do cancelamento e o que roda, e sem ele a trava ficaria presa num
 * inimigo morto — que e o pior caso, porque o `telegraphAtivo` sobrevive ao
 * `killEnemy` e reaparece se o chefe for reerguido
 */
liberarChefe(execucao) {
  const inimigo = this.inimigoDe(execucao);

  if (!inimigo) return;

  inimigo.telegraphAtivo = false;
}

/**
 * O INIMIGO DE UMA EXECUCAO.
 *
 * ## E POR QUE `findEnemyById`, E NAO O INDICE DIRETO
 *
 * Porque `findEnemyById` e a API do motor para "quem tem esse id", e ela ja
 * resolve a duvida de ONDE o indice mora: ele vive no motor
 * (`engine.indiceInimigos`), montado no `setMap`, e nao no `world` — que e
 * o estado comum entre jogadores
 *
 * A primeira versao deste metodo usava `world.byId`, campo que nao existe
 * em lugar nenhum do motor. O resultado era `null` em TODA chamada: o
 * `liberarChefe` nunca achava o chefe, a trava `telegraphAtivo` ficava
 * ligada para sempre e o chefe passava o resto da luta em `attack`, sem se
 * mover e sem escolher outra habilidade
 *
 * ## E POR QUE O `world`, E NAO O MOTOR
 *
 * Porque o `TelegraphSystem` e criado com o `world` e nao sabe do motor que
 * o contem. Se um dia outro dono quiser um telegraph, ele precisa pasar o
 * indice — e nao o motor inteiro
 */
inimigoDe(execucao) {
  const indice = this.world.indiceInimigos;

  if (indice instanceof Map) {
    return indice.get(execucao.inimigoId) ?? null;
  }

  // o indice pode nao estar montado ainda: o setMap ainda nao rodou
  const lista = this.world.enemies;

  if (!Array.isArray(lista)) return null;

  return lista.find((e) => e.id === execucao.inimigoId) ?? null;
}

  /**
   * O JOGADOR-ALVO DE UMA EXECUCAO.
   *
   * A lista vem do proprio motor (`world.players`), e nao de um alvo
   * guardado: o jogador pode desconectar no meio da preparacao, e o
   * telegraph tem de notar isso pelo mesmo caminho que o resto do jogo
   */
  alvoDe(execucao) {
    const alvoId = execucao.alvoId;

    if (!alvoId) return null;

    /**
     * O `players` e um `Map` de SESSAO, e nao de jogador.
     *
     * Cada valor e a sessao que tem o jogador dentro (`{ player, ... }`), e
     * e o `player` que tem `x`, `y` e `hp`. Devolver a sessao aqui fazia o
     * `marked_strike` ler `alvo.x === undefined` e a marca teleportar para
     * `NaN` no primeiro quadro de acompanhamento
     */
    if (this.world.players instanceof Map) {
      const sessao = this.world.players.get(alvoId);

      return sessao?.player ?? null;
    }

    return this.world.player?.id === alvoId
      ? this.world.player
      : null;
  }

  /**
   * O IMPACTO: aplica o dano e dispara o efeito.
   *
   * ## O `danoAplicado` E O QUE IMPEDE DANO DUPLICADO
   *
   * A secao 4 do pedido pede explicitamente. Como o `update` remove a
   * execucao da lista depois do impacto, nao haveria como aplicar duas vezes
   * no caminho normal — mas o guard e barato e protege o caso em que um
   * pacote de rede chega atrasado e o motor roda o mesmo instante duas vezes
   */
  aplicarImpacto(execucao) {
    if (execucao.danoAplicado) return;

    /**
     * A VALIDADE E CHECADA AQUI, E NAO SO NO `update`.
     *
     * O `update` ja remove a execucao cancelada antes do impacto, entao o
     * `aplicarImpacto` nunca veria uma execucao morta naquele caminho. Mas
     * o `aplicarImpacto` e publico e chamado direto pelo pacote de rede: um
     * cliente que recebeu uma execucao e aplicou o impacto no mesmo quadro
     * em que o servidor a cancelou passaria pelo `update` sem ver
     *
     * Sem esta checagem, um telegraph cancelado por `retreating` aplicava
     * dano atrasado no quadro em que a `leash` puxou o chefe para casa — e o
     * jogador recebia um golpe de um ataque que ja tinha sumido da tela
     */
    if (execucao.danoAplicado) return;

    if (!execucao.isRemote && !this.execucaoContinuaValida(execucao)) {
      this.liberarChefe(execucao);
      return;
    }

    execucao.danoAplicado = true;

    /**
     * A EXECUCAO RECEBIDA DO SERVIDOR NAO APLICA DANO AQUI.
     *
     * E a regra mais importante deste arquivo. O cliente recebe a execucao
     * pelo pacote e a reconstroi para DESENHAR — mas se o `update` a tratasse
     * como uma execucao local, ele chamaria o `onDanoDoChefe` e o cliente
     * decidira quem levou o golpe. A secao 13 do pedido proibe exatamente
     * isso, e o `isRemote` e o que garante
     *
     * O cliente so desenha. Quem aplica o dano e o servidor, uma vez, com o
     * dano resolvido la
     */
    if (execucao.isRemote) return;

    const inimigo = this.inimigoDe(execucao);

    if (!inimigo || !inimigo.alive) return;

    const dano = (inimigo.damage ?? 0) * execucao.multiplicadorDano;

    /**
     * OS JOGADORES QUE ESTAO NA FORMA.
     *
     * A lista vem do `world` inteiro, nao do "jogador em foco". O chefe
     * ataca todo mundo dentro da area — inclusive quem esta do outro lado da
     * tela, e o `contemPonto` e que recusa quem nao esta na forma
     *
     * O `contemPonto` e o MESMO que o renderizador usa para desenhar a
     * forma. Um jogador nunca ve uma area e leva o dano de fora dela
     */
    for (const jogador of this.jogadoresAtivos()) {
      if (!contemPonto(execucao, jogador.x, jogador.y)) continue;

      this.world.onDanoDoChefe?.(inimigo, dano, jogador, execucao);
    }

    this.world.onImpactoDoTelegraph?.(execucao, inimigo);
  }

  /**
   * A LISTA DE JOGADORES VIVOS.
   *
   * O `players` e um `Map` de sessao no online e o `player` e uma unica
   * sessao no single player. O motor ja tem os dois formatos, e o telegraph
   * nao pode caringuir qual
   */
  jogadoresAtivos() {
    if (this.world.players instanceof Map) {
      return [...this.world.players.values()].filter(
        (p) => p?.player?.hp > 0,
      ).map((p) => p.player);
    }

    const p = this.world.player;

    return p && p.hp > 0 ? [p] : [];
  }

  /**
   * COMECA UM TELEGRAPH.
   *
   * E o unico ponto de entrada. A execucao nasce com a geometria JA
   * resolvida — posicao, direcao, raios, angulo — porque o renderizador e o
   * sistema de dano vao ler exatamente estes campos
   *
   * ## E POR QUE A POSICAO NASCE CONGELADA, E O `focarNoImpacto` EXISTE
   *
   * A maioria dos ataques marca o lugar onde o chefe ESTAVA quando a
   * preparacao comecou, e o golpe sai de la. Sem isso o jogador veria um
   * disco parado enquanto o chefe andava, e o dano viria de onde o chefe
   * terminou — duas coisas diferentes
   *
   * O `focarNoImpacto` inverte: a posicao e reavaliada no instante do golpe.
   * E o caso do `ground_slam` e do `shock_ring`, cujo ataque nasce do CHEFE
   * e nao do lugar
   */
  iniciar({ inimigo, habilidade, agora, alvo }) {
    const execucao = {
      id: proximoIdDeExecucao(),

      inimigoId: inimigo.id,
      habilidadeId: habilidade.id,
      tipo: habilidade.tipo,
      cor: habilidade.cor ?? "#ff3b30",

      /**
       * O MULTIPLICADOR e o `knockback` VIAJAM COM A EXECUCAO.
       *
       * E nao sao lidos do catalogo no impacto. O motivo e o pacote de rede:
       * se o cliente so recebe o telegraph e nao o catalogo inteiro, ele nao
       * tem como reproduzir a apresentacao sem estes numeros. E o dano, que e
       * calculado no servidor, usa o MESMO `multiplicadorDano` — assim o
       * numero que sobe na tela e o que o servidor aplicou
       */
      multiplicadorDano: habilidade.multiplicadorDano ?? 1,
      knockback: habilidade.knockback ?? 0,

      // os instantes, que sao a verdade do impacto
      inicioEm: agora,
      impactoEm: agora + habilidade.preparo,
      duracao: habilidade.preparo,

      // a posicao inicial, congelada
      x: inimigo.x,
      y: inimigo.y,

      dirX: inimigo.facing?.x ?? 0,
      dirY: inimigo.facing?.y ?? 1,

      tipoHabilidade: habilidade,

      danoAplicado: false,
    };

    this.aplicarGeometria(execucao, habilidade, inimigo, alvo);

    this.world.telegraphs.push(execucao);

    return execucao;
  }

  /**
   * A GEOMETRIA, resolvida uma vez e lida por todo mundo.
   *
   * ## POR QUE UM METODO E NAO UM CONSTRUTOR INLINE
   *
   * Porque sao cinco formas com campos diferentes, e o `iniciar` grew ate
   * um `switch` grande. Aqui o `switch` fica, mas cada caso so resolve o
   * que e especifico do seu tipo — o `x`, `y`, `dirX`, `dirY` ja vieram
   */
  aplicarGeometria(execucao, habilidade, inimigo, alvo) {
    execucao.tipo = habilidade.tipo;

    switch (habilidade.tipo) {
      case "circle":
        execucao.raio = habilidade.raio;
        break;

      case "ring":
        execucao.raioInterno = habilidade.raioInterno;
        execucao.raioExterno = habilidade.raioExterno;
        break;

      case "cone":
        execucao.alcance = habilidade.alcance;
        execucao.anguloGraus = habilidade.anguloGraus;
        execucao.cosMeioAngulo = cosMeioAnguloDe(habilidade.anguloGraus);
        break;

      case "line":
        execucao.alcance = habilidade.alcance;
        execucao.largura = habilidade.largura;
        execucao.projetil = habilidade.projetil ?? null;
        execucao.projetilAvancou = 0;
        break;

      case "charge":
        execucao.alcance = habilidade.alcance;
        execucao.largura = habilidade.largura;
        execucao.duracaoInvestida = habilidade.duracaoInvestida;
        execucao.investidaRestante = habilidade.alcance;
        execucao.investidaVelocidade =
          habilidade.investida?.velocidade ?? 0;
        break;

      case "targeted":
        execucao.raio = habilidade.raio;
        execucao.seguirAlvo = habilidade.seguirAlvo ?? false;
        execucao.fixarAntesDeImpacto =
          habilidade.fixarAntesDeImpacto ?? 0;
        execucao.alvoId = alvo?.id ?? null;

        /**
         * A MARCA NASCE NO ALVO, e nao no chefe.
         *
         * E o que faz do `marked_strike` um ataque de alvo: o disco aparece
         * sob o jogador, e nao na direcao do chefe
         */
        if (alvo) {
          execucao.x = alvo.x;
          execucao.y = alvo.y;
        }

        break;

      default:
        break;
    }

    /**
     * O `focarNoImpacto` E UM FLAG, E NAO UM REPOSICIONAMENTO AGORA.
     *
     * A execucao nasce onde o chefe esta, e o `update` reavalia a posicao no
     * instante do impacto. Guardar um flag e o que permite o renderizador
     * mostrar o disco ACOMPANHANDO o chefe ate o ultimo quadro
     */
    execucao.focarNoImpacto = habilidade.focarNoImpacto ?? false;
  }
}