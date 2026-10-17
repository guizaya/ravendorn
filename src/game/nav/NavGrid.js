/**
 * A NAVEGACAO: onde o boneco pode pisar, e como ir de A a B sem bater
 * em arvore.
 *
 * ## POR QUE ISTO EXISTE
 *
 * O piloto automatico usava `walkToward`, que e um *seek* puro: ele
 * aponta para o destino e anda em linha reta. Isso funciona em campo
 * aberto e falha em qualquer outra coisa — o `CollisionSystem` faz o
 * boneco deslizar pelo eixo livre e girar 0.5 rad quando os dois eixos
 * travam (`escapeCorner`), e o resultado pratico e o boneco empurrando
 * contra o tronco ate o auto ser desligado a mao
 *
 * No vale isso nao e um caso raro. Sao 137 arvores bloqueantes, e
 * medindo a reta do portal do Pantano ate o centro de cada zona, OITO
 * das DOZE zonas tem pelo menos uma arvore no caminho. Uma em cada tres
 *
 * ## POR QUE UMA GRADE, E NAO UM A* SOBRE SOLIDOS
 *
 * A* sobre solidos e o algoritmo certo e a solida errada aqui. Os solidos
 * sao retangulos, e o espaco entre eles e o espaco dentro deles e o
 * mesmo plano: um A* que andasse pelas arestas dos retangulos
 * encontraria corredores de largura zero, que o boneco nao cabe
 *
 * A grade resolve os dois problemas de uma vez:
 *
 * - cada celula guarda um SIM ou NAO, ja testado com o RAIO do boneco
 *   (`isPositionFree(centro, 22)`). O corredor entre duas arvores fica
 *   marcado como andavel ou nao pelo teste real, sem geometria;
 * - o vizinho e sempre o vizinho, entao o algoritmo e uma busca em
 *   grade e nao tem caso de espaco continuo
 *
 * A celula e de 40px contra um raio de 22px. E grosso de proposito: uma
 * celula fina daria mais precisao e exigiria mais celulas para cobrir o
 * mesmo mapa, e o desvio de ate meio raio de arvore e invisivel numa
 * tela com zoom de 1.4286
 *
 * ## A FOLGA: POR QUE O CAMINHO NAO RASPA NO OBSTACULO
 *
 * A grade da para o boneco ENCOSTAR no obstaculo, e encostar e o
 * defeito que o jogador ve. O collider do arbusto e uma caixa de 28px
 * e o boneco e um circulo de raio 22: encostando, o centro do boneco
 * fica a 22px do arbusto e a arte dele, que e 67px de largura, passa
 * POR CIMA da metade do arbusto. O piloto "anda em cima do arbusto" —
 * nao porque o codigo esteja errado, mas porque ele esta obeying a
 * linha do collider ao pe da letra
 *
 * E ha o segundo motivo, que e o pior: raspar e instavel. Uma perna de
 * caminho que passa a 22px exatos de um collider passa com folga zero,
 * e qualquer coisa de meio px — um passo do `moveBySteps`, um empurrao
 * de inimigo, o `resolveOverlap` — joga o boneco para dentro do arbusto.
 * Aí ele para, o `travelParado` conta 3s, o caminho e refeito do mesmo
 * jeito, e ele volta a encostar no mesmo arbusto. O travamento e o
 * sintoma de um caminho que foi desenhado com folga zero
 *
 * Por isso a grade testa com `RAIO + FOLGA`. Oito pixels e o que separa
 * "encostado" de "passando pelo meio": com 30px de raio, medindo o
 * caminho entre os centros das doze zonas do vale, o ponto MAIS PERTO de
 * qualquer obstaculo fica a 28px — e nenhum trecho do caminho passa
 * dentro de arbusto nenhum
 *
 * ## A GRADE JUSTA, PARA QUANDO A FOLGA FECHA TUDO
 *
 * Fechar um corredor e o preco da folga: um vao que o boneco cabe mas
 * que nao cabe com 8px a mais deixa de existir para o A*, e uma zona
 * inteira ficaria "sem caminho". Por isso existe a segunda grade, sem
 * folga nenhuma, montada so quando a primeira nao acha rota — e ela e
 * o que garante que o preco nunca e "o piloto desistiu"
 *
 * ## O CUSTO, E POR QUE ELE NAO IMPORTA
 *
 * Construir a grade do vale e 15.750 testes de `isPositionFree`, na
 * primeira chamada. A grade e IMUTAVEL enquanto o mapa nao muda, entao
 * o motor a guarda e a segunda chamada e de graca
 *
 * O A* roda por viagem, nao por quadro. E o que faz ser aceitavel:
 * o piloto recalcula o caminho quando comeca uma etapa, quando termina
 * uma etapa e quando trava — nao a cada quadro
 */

/** O lado de uma celula, em px de mundo */
const CELULA = 40;

/**
 * O RAIO que decide se o boneco cabe na celula.
 *
 * E o mesmo `player.radius` que o `moveEntity` usa, e nao um numero
 * solto: se a grade aceitasse um raio menor que o boneco, o A* tracaria
 * corredores por onde ele nao passa, e o piloto voltaria a empurrar
 * contra o obstaculo — o defeito que a grade veio resolver
 */
const RAIO = 22;

/**
 * A FOLGA que a grade soma ao raio do boneco.
 *
 * E o que separa "o caminho encosta no arbusto" de "o caminho passa no
 * meio do vao". Ver o bloco da folga no topo do arquivo: o collider e
 * menor que a arte, entao encostar e andar por cima do arbusto, e
 * folga zero e um caminho que qualquer empurrao joga dentro do obstaculo
 *
 * Oito pixels, e nao mais: e o que mantem as quatro faixas do vale
 * ligadas. Com 14px a mais o vao da sebe do norte, do lado do portal,
 * fecha, e a regiao de cima fica inacessivel
 */
const FOLGA = 8;

/** O MENOR avanco entre celulas, em px */
const AVANCO_MINIMO = 8;

/**
 * Quantas celulas a frente o simplificador olha.
 *
 * E o TETO da busca pelo ultimo ponto visivel, e ele existe por causa do
 * custo: sem teto, um caminho de 250 celulas — e o vale tem travelled de
 * serpente com as sebes — faz o simplificador testar visibilidade para
 * as 250 celulas do fim para tras em cada perna. Com o teto, cada perna
 * testa no maximo ISTO, e o caminho sai com um ponto a cada 1.900px
 * numa reta livre, o que e mais do que a tela mostra
 *
 * O preco e um caminho com mais pontos em curva, e o preco de um
 * caminho com mais pontos e zero: o `walkToward` so olha o primeiro
 */
const VAO_SIMPLIFICAR = 48;

/**
 * Os OITO vizinhos, na ordem que o A* prefere.
 *
 * A ordem e o desempate: com custo igual, `f` e o mesmo para os quatro
 *cardeais, entao a ordem decide qual caminho sai quando ha empate.
 * Primeiro o cardinal, depois o diagonal
 */
const VIZINHOS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * O indice de um par na heap.
 *
 * `f` primeiro, e o `h` no desempate. Sem o desempate, uma heap
 * qualquer devolveria caminhos imprevisiveis entre chamadas
 * identicas, e o mesmo trajeto andaria diferente a cada viagem
 *
 * ## O MENOS QUE MENOS, E O `< 0` QUE FAZ ELE SER MENOS
 *
 * A versao anterior devolvia a DIFERENCA: `a.f - b.f || a.h - b.h`. Isso
 * funciona como classificador enquanto ninguem le como booleano, e
 * quebra assim que alguem le — porque a diferenca e POSITIVA quando `a`
 * e o MAIOR, e `if (menorQue(a, b))` era verdadeiro exatamente quando
 * `a` nao devia subir
 *
 * A heap virou uma heap de MAXIMO. E o A* continuava devolvendo um
 * caminho valido — qualquer caminho valido — entao nenhum teste falhou:
 * o `NavGrid.test.js` confere se o caminho CABE, e um caminho de 238
 * celulas cabe igual a um de 15. O que mudou no jogo foi o resto: um
 * A* de maximo abre a regiao mais distante primeiro, entao ele
 * explorava o vale INTEIRO para ir 700px, e levava 100ms a 400ms por
 * chamada. No piloto, isso e o boneco dando a volta pelo mapa inteiro,
 * voltando, e parando em um canto
 *
 * O `< 0` no fim e o que faz `menorQue` significar "a e menor que b", que
 * e o que o nome promete e o que a sift-up e a sift-down esperam
 */
const menorQue = (a, b) => (a.f - b.f || a.h - b.h) < 0;

class Heap {
  constructor() {
    this.itens = [];
  }

  get tamanho() {
    return this.itens.length;
  }

  push(item) {
    this.itens.push(item);

    let i = this.itens.length - 1;

    while (i > 0) {
      const pai = (i - 1) >> 1;

      if (menorQue(this.itens[i], this.itens[pai])) {
        /**
         * A TROCA POR DESTRUCTURING ALOCAVA UM ARRAY POR PASSO.
         *
         * `[a, b] = [b, a]` cria um array temporario quando os dois
         * lados leem indices recalculados do mesmo array. Como este
         * `while` pode dar dezenas de passos por `push`, vezes as
         * centenas de celulas que o A* expande, a alocacao sao
         * milhares de arrays por chamada de caminho
         *
         * O `const` e um cache de slot: zero alocacao, semantica
         * identica
         */
        const temporario = this.itens[i];

        this.itens[i] = this.itens[pai];
        this.itens[pai] = temporario;

        i = pai;
      } else {
        break;
      }
    }
  }

  pop() {
    const topo = this.itens[0];

    const ultimo = this.itens.pop();

    if (this.itens.length > 0) {
      this.itens[0] = ultimo;

      let i = 0;

      for (;;) {
        const esq = i * 2 + 1;
        const dir = esq + 1;

        let menor = i;

        if (
          esq < this.itens.length &&
          menorQue(this.itens[esq], this.itens[menor])
        ) {
          menor = esq;
        }

        if (
          dir < this.itens.length &&
          menorQue(this.itens[dir], this.itens[menor])
        ) {
          menor = dir;
        }

        if (menor === i) break;

        // mesma troca sem array temporario do destructuring
        const temporario = this.itens[i];

        this.itens[i] = this.itens[menor];
        this.itens[menor] = temporario;

        i = menor;
      }
    }

    return topo;
  }
}

export class NavGrid {
  /**
   * @param {object} map       o mapa, por `width`/`height`
   * @param {object} collision  o `CollisionSystem` DESTE mapa
   * @param {object} [opcoes]   `{ raio, folga, celula }`, para o teste
   */
  constructor(map, collision, opcoes = {}) {
    this.map = map;
    this.collision = collision;

    /**
     * O RAIO DO CORPO, e o raio com que o CAMINHO anda.
     *
     * `raioCorpo` e o `player.radius` de verdade: e ele que decide se o
     * ultimo ponto do caminho pode ser o destino exato, porque essa
     * perna e curtissima — no maximo meia celula — e o que importa nela
     * e o boneco chegar, nao a folga
     *
     * `raio` e o mesmo numero mais a folga: e ele que decide onde o
     * caminho pode passar, e por isso que a grade e a linha de visada sao
     * testadas com ele
     */
    this.raioCorpo = opcoes.raio ?? RAIO;
    this.folga = opcoes.folga ?? FOLGA;
    this.raio = this.raioCorpo + this.folga;

    this.celula = opcoes.celula ?? CELULA;

    const largura = map.width ?? map.bounds.width;
    const altura = map.height ?? map.bounds.height;

    this.columns = Math.max(1, Math.ceil(largura / this.celula));
    this.rows = Math.max(1, Math.ceil(altura / this.celula));

    /**
     * `Uint8Array` e nao `Array`: sao 15 mil celulas no vale, e um
     * array de numeros comuns seria 15 mil ponteiros e 15 mil caixas
     * numeradas, o que o motor constroi uma vez por mapa e mesmo assim
     * pesa mais do que a lista de obstaculos inteira
     */
    this.andavel = new Uint8Array(this.columns * this.rows);

    /**
     * AS ROTAS JA RESPONDIDAS.
     *
     * Vive aqui e nao no motor porque a resposta e da GRADE: a grade e
     * estatica e o A* sobre ela e determinista, entao a mesma pergunta tem
     * sempre a mesma resposta — e o custo de responder e o do caminho, nao
     * o da pergunta
     */
    this.cacheCaminho = new Map();

    /**
     * A GRADE JUSTA, montada na primeira rota perdida.
     *
     * Comeca `null` porque o caso comum e a primeira grade achar caminho,
     * e montar as duas custaria 30 mil testes de posicao livre para
     * usar uma delas so em emergencia
     */
    this.gradeJusta = null;

    /**
     * Os BUFFERS do A*, tambem preguisosos.
     *
     * Sao 200KB por chamada — `Float64Array` de 15 mil e mais dois —, e
     * o A* do `seguir` roda a cada 400ms enquanto o caminho do resto do
     * jogo roda uma vez por viagem. Alocar tres typed arrays por chamada
     * e o tipo de lixo que aparece no perfil como tempo de GC
     */
    this.custo = null;
    this.anterior = null;
    this.fechado = null;

    this.#construir();
  }

  #construir() {
    for (let linha = 0; linha < this.rows; linha += 1) {
      for (let coluna = 0; coluna < this.columns; coluna += 1) {
        const ponto = this.centroDe(linha, coluna);

        this.andavel[linha * this.columns + coluna] =
          this.collision.isPositionFree(ponto, this.raio)
            ? 1
            : 0;
      }
    }
  }

  /**
   * O ponto de MUNDO no centro de uma celula.
   *
   * O centro e o que a grade testa, e por isso que e o centro e nao o
   * canto: um canto marca a celula pelo lugar pior dela, e uma arvore
   * encostada no canto bloquearia uma celula que o boneco atravessa
   * tranquilamente pelo meio
   */
  centroDe(linha, coluna) {
    return {
      x: coluna * this.celula + this.celula / 2,
      y: linha * this.celula + this.celula / 2,
    };
  }

  celulaDe(x, y) {
    return {
      linha: Math.min(
        this.rows - 1,
        Math.max(0, Math.floor(y / this.celula)),
      ),
      coluna: Math.min(
        this.columns - 1,
        Math.max(0, Math.floor(x / this.celula)),
      ),
    };
  }

  andavelEm(linha, coluna) {
    if (
      linha < 0 ||
      coluna < 0 ||
      linha >= this.rows ||
      coluna >= this.columns
    ) {
      return false;
    }

    return this.andavel[linha * this.columns + coluna] === 1;
  }

  /**
   * O A*.
   *
   * Devolve os pontos do caminho, ou `null` quando nao ha caminho
   * nenhum. O PRIMEIRO ponto do caminho e sempre a celula de partida e o
   * ULTIMO e a celula de chegada, e nao o destino exato — quem chama
   * empurra o destino para o fim, porque o destino pode estar dentro de
   * um obstaculo (o centro de uma arvore, a parede de um mapa)
   */
  #astar(de, para) {
    const inicio = this.celulaDe(de.x, de.y);
    const fim = this.celulaDe(para.x, para.y);

    /**
     * Se o destino esta num obstaculo, procura a celula andavel mais
     * perto.
     *
     * O destino de uma viagem e o CENTRO de uma zona e o meio de um
     * portal, e nenhum dos dois foi desenhado como ponto andavel: a
* celula do meio do portal e quase sempre livre, mas a do centro de
   * uma zona pode ter arvore. Sem esta busca, todo alvo em cima de
     * obstaculo viraria "sem caminho" e o jogador nunca chegaria
     */
    let celulaFim = fim;

    if (!this.andavelEm(fim.linha, fim.coluna)) {
      celulaFim = this.#maisPertoAndavel(fim);

      if (!celulaFim) return null;
    }

    const largura = this.columns;

    const indice = (linha, coluna) => linha * largura + coluna;

    const inicioId = indice(inicio.linha, inicio.coluna);
    const fimId = indice(celulaFim.linha, celulaFim.coluna);

    /**
     * Os MESMOS arrays, so que resetados.
     *
     * `custo` precisa de `Infinity` e nao de `0`, e `anterior` e
     * `fechado` precisam de zero: e o estado de "nunca visited". Os tres
     * `fill` custam o equivalente a alguns quadros de desenho, e o que
     * se economiza e a alocacao
     */
    if (!this.custo) {
      this.custo = new Float64Array(this.andavel.length);
      this.anterior = new Int32Array(this.andavel.length);
      this.fechado = new Uint8Array(this.andavel.length);
    }

    const custo = this.custo;
    const anterior = this.anterior;
    const fechado = this.fechado;

    custo.fill(Infinity);
    anterior.fill(-1);
    fechado.fill(0);

    /**
     * A DISTANCIA EM CELULAS.
     *
     * `Math.hypot` e varias vezes mais lento que `Math.sqrt(dx*dx+dy*dy)`
     * — ele existe para nao estourar o expoente, e os dois numeros aqui
     * sao indices de grade, no maximo ~150. Isso roda uma vez por celula
     * expandida, e o A* expande centenas
     */
    const heuristica = (linha, coluna) => {
      const dl = linha - celulaFim.linha;
      const dc = coluna - celulaFim.coluna;

      return Math.sqrt(dl * dl + dc * dc);
    };

    const heap = new Heap();

    custo[inicioId] = 0;

    /**
     * A HEURISTICA DA ORIGEM, CALCULADA UMA VEZ.
     *
     * Eram duas chamadas com os mesmos argumentos, uma para o `h` e
     * outra para o `f`. Na origem `g` e zero, entao `f` e `h` por
     * definicao
     */
    const hInicio = heuristica(inicio.linha, inicio.coluna);

    heap.push({
      id: inicioId,
      linha: inicio.linha,
      coluna: inicio.coluna,
      g: 0,
      h: hInicio,
      f: hInicio,
    });

    while (heap.tamanho > 0) {
      const atual = heap.pop();

      if (fechado[atual.id]) continue;

      fechado[atual.id] = 1;

      /**
       * Chegou.
       *
       * O `fechado` e o que garante que o primeiro caminho popped e o
       * de menor custo: sem ele, um no ja fechado seria re-aberto e
       * empilhado de novo, e o A* nao terminaria
       */
if (atual.id === fimId) {
        return this.#remontar(anterior, atual.id);
      }

      for (const [dl, dc, passo] of VIZINHOS) {
        const linha = atual.linha + dl;
        const coluna = atual.coluna + dc;

        if (!this.andavelEm(linha, coluna)) continue;

        /**
         * SEM CORTAR CANTO.
         *
         * O diagonal so passa quando os DOIS cardeais vizinhos sao
         * andaveis. Sem esta regra, o boneco "corta" a arvore pela
         * diagonal e a colisao o devolve para tras — e o piloto fica
         * tremendo na diagonal de um obstaculo para sempre
         */
        if (dl !== 0 && dc !== 0) {
          if (
            !this.andavelEm(atual.linha + dl, atual.coluna) ||
            !this.andavelEm(atual.linha, atual.coluna + dc)
          ) {
            continue;
          }
        }

        const vizinhoId = indice(linha, coluna);

        if (fechado[vizinhoId]) continue;

        const g = atual.g + passo;

        if (g >= custo[vizinhoId]) continue;

        custo[vizinhoId] = g;
        anterior[vizinhoId] = atual.id;

        const h = heuristica(linha, coluna);

        heap.push({
          id: vizinhoId,
          linha,
          coluna,
          g,
          h,
          f: g + h,
        });
      }
    }

    return null;
  }

  /**
   * A celula andavel mais perto de uma celula bloqueada.
   *
   * Busca em anel, e nao A*: e uma pergunta local ("de onde eu entro
   * nesse obstaculo?"), e o anel acharia a resposta com meia duzia de
   * comparacoes. A busca completa custaria mais que o proprio caminho
   */
  #maisPertoAndavel(celula) {
    for (let raio = 1; raio <= 12; raio += 1) {
      for (let dl = -raio; dl <= raio; dl += 1) {
        for (let dc = -raio; dc <= raio; dc += 1) {
          /**
           * So a BORDA do anel.
           *
           * Os aneis internos ja foram visitados e recusados antes
           */
          if (Math.max(Math.abs(dl), Math.abs(dc)) !== raio) {
            continue;
          }

          if (
            this.andavelEm(celula.linha + dl, celula.coluna + dc)
          ) {
            return { linha: celula.linha + dl, coluna: celula.coluna + dc };
          }
        }
      }
    }

    return null;
  }

  #remontar(anterior, fimId) {
    const caminho = [];

    let atual = fimId;

    while (atual !== -1) {
      const linha = Math.floor(atual / this.columns);
      const coluna = atual % this.columns;

      caminho.push(this.centroDe(linha, coluna));

      atual = anterior[atual];
    }

    caminho.reverse();

    return caminho;
  }

/**
   * A linha de visada entre dois pontos, com o RAIO DE NAVEGACAO.
   *
   * E o que permite o `simplificar`: sem ela, o caminho de uma zona
   * distante teria duas centenas de pontos, e o piloto viraria o
   * `autoWaypoint` duas vezes por segundo sem ganho nenhum
   *
   * O raio e o de navegacao (com folga) e nao o do corpo: e a folga que
   * impede a perna de encostar no arbusto. Uma linha de visada "raspando"
   * e um caminho que o proximo empurrao estraga
   *
   * O `raio` e parametro porque as duas perguntas sao diferentes e as
   * duas interessam: "da para IR por aqui sem raspar?" e a pergunta da
   * navegacao, e e a que o `caminho` faz. "O boneco conseguiria andar
   * nessa reta?" e a do corpo, e e a que distingue um obstaculo de um
   * destino que esta so um pouco apertado demais
   */
  temLinhaDeVisada(de, para, raio = this.raio) {
    return this.#visivel(de, para, raio);
  }

  /**
   * A linha de visada com um RAIO ESCOLHIDO.
   *
   * O `raio` e parametro porque ha duas perguntas de corpo diferente no
   * mesmo caminho, e elas nao podem ser a mesma:
   *
   * - "dá para IR por aqui sem raspar?" — folga, raio de navegacao. E a
   *   pergunta de todas as pernas do caminho;
   * - "dá para CHEGAR no destino?" — corpo, raio do boneco. E a pergunta
   *   so da ultima perna, que e de meia celula: ali o que importa e o
   *   boneco chegar, e nao a folga
   */
  #visivel(de, para, raio) {
    const dx = para.x - de.x;
    const dy = para.y - de.y;

    const distancia = Math.hypot(dx, dy);

    const passos = Math.max(1, Math.ceil(distancia / AVANCO_MINIMO));

    for (let i = 0; i <= passos; i += 1) {
      const t = i / passos;

      const x = de.x + dx * t;
      const y = de.y + dy * t;

      if (!this.collision.isPositionFree({ x, y }, raio)) {
        return false;
      }
    }

    return true;
  }

  /**
   * A GRADE JUSTA: a mesma grade sem folga, montada na hora.
   *
   * E o seguro do preco da folga. Fechar um vao e o jeito facil de a
   * folga transformar um caminho em "sem rota", e "sem rota" e o pior
   * resultado possivel para o piloto — ele para e o jogador nao sabe se
   * chegou ou se desistiu
   *
   * Ela so e construida quando a primeira falha, e o A* dela e o mesmo
   * codigo. O que muda e o preco: um caminho que passa raspando e
   * melhor do que nenhum caminho
   *
   * O `this.folga === 0` e o que impede a recursao: a grade justa nao
   * tem folga, entao ela nao pede uma terceira grade
   */
  #gradeSemFolga() {
    if (this.folga === 0) return null;

    if (!this.gradeJusta) {
      this.gradeJusta = new NavGrid(this.map, this.collision, {
        raio: this.raioCorpo,
        folga: 0,
        celula: this.celula,
      });
    }

    return this.gradeJusta;
  }

  /**
   * O CAMINHO, ja SIMPLIFICADO, ou `null`.
   *
   * O `simplificar` e o que troca "1500 pontos em zigue-zague" por "3
   * cantos". A grade tem 40px de lado, entao um caminho em diagonal
   * vira um degrau a cada celula — e um degrau a cada 40px de caminhada
   * e um boneco que anda dorminhando, visivel em qualquer sprite
   * animado
   */
  caminho(de, para) {
    /**
     * O MESMO PEDIDO, A MESMA RESPOSTA.
     *
     * ## O QUE FOI MEDIDO
     *
     * A rota de (3023,3461) ate o portal do topo do mapa 1 leva de 56ms a
     * 90ms por chamada. Para um alvo curto, 0ms a 5ms. A diferenca e a
     * distancia, e nao o tamanho da grade: e o tanto de celula que o A*
     * precisa abrir
     *
     * ## POR QUE ISSO APARECE NA TELA COMO TRAVADINHA
     *
     * Porque 60ms sao mais de tres quadros a 60Hz, e o motor faz isso no
     * MEIO do tique: o jogo inteiro para, desenhando o quadro seguinte. O
     * piloto travado refaz a rota a cada tique, e cada refacao e um
     * congelamento novo — que e o que o jogador viu
     *
     * ## POR QUE O MESMO PEDIDO VOLTA
     *
     * Porque o jogador parado nao se move: o `de` e byte a byte o mesmo, e
     * a grade e estatica e deterministica, entao a resposta e identica. Nao
     * ha nada para recalcular
     *
     * ## POR QUE UMA COPIA, E NAO O ARRAY GUARDADO
     *
     * Porque quem chama consome o caminho com `shift()`, no `travelPlan` e
     * na mineracao. Devolver o array guardado encheria o cache de listas pela
     * metade e a segunda consulta devolveria um caminho truncado
     */
    const chave = `${Math.round(de.x)},${Math.round(de.y)},${Math.round(para.x)},${Math.round(para.y)}`;

    const guardado = this.cacheCaminho.get(chave);

    if (guardado !== undefined) {
      return guardado === null ? null : [...guardado];
    }

    const resposta = this.#caminhoCalculado(de, para);

    /**
     * O LIMITE, E NAO UM LRU.
     *
     * Uma viagem faz poucas dezenas de pedidos, e 256 entradas cabem na
     * memoria sem esforço. Passando disso o mapa esta sendo varrido inteiro
     * — o que e uma varredura de tela, nao uma viagem — e limpar tudo e o
     * comportamento certo
     */
    if (this.cacheCaminho.size >= 256) this.cacheCaminho.clear();

    this.cacheCaminho.set(chave, resposta === null ? null : [...resposta]);

    return resposta;
  }

  /** o caminho de verdade, sem o cache */
  #caminhoCalculado(de, para) {
    const direto = this.#caminhoAqui(de, para);

    if (direto) return direto;

    /**
     * SEM ROTA COM FOLGA, TENTA SEM FOLGA.
     *
     * E a unica vez que a segunda grade entra, e ela entra so depois de
     * a primeira ter falhado. Uma folga mal escolhida fecha um corredor e
     * transforma uma zona inteira em "sem caminho" — e isso e pior que
     * qualquer caminho raspando
     */
    const justa = this.#gradeSemFolga();

    if (!justa) return null;

    return justa.caminho(de, para);
  }

  /** o caminho nesta grade, sem o seguro da grade justa */
  #caminhoAqui(de, para) {
    /**
     * A LINHA DIRETA primeiro.
     *
     * E o caso mais comum do jogo inteiro: o hub nao tem obstaculo, e
     * dentro da zona o piso esta limpo por construcao. Nesses casos o
     * A* e trabalho jogado fora — ele exploraria quinze mil celulas para
     * redesenhar o mesmo segmento
     *
     * O retorno e um ponto e nao dois: com o destino como unico ponto, o
     * `walkToward` aponta direto para ele, e um caminho de um ponto e o
     * caso degenerado do que o piloto ja fazia
     *
     * E a reta so vale com FOLGA. Com o raio do corpo, "da para ir reto"
     * includes as retas que passam a 22px do arbusto, que sao as que
     * fazem o boneco andar por cima da sebe
     */
    if (this.temLinhaDeVisada(de, para)) {
      return [{ x: para.x, y: para.y }];
    }

    const bruto = this.#astar(de, para);

    if (!bruto) return null;

    return this.#simplificar(de, bruto, para);
  }

  /**
   * O STRING PULLING: guarda so os cantos.
   *
   * A varredura procura o ponto mais distante que ainda se VE da posicao
   * atual, guarda esse, e recomeca dele. Uma varredura que fizesse isso
   * ponto a ponto em vez de por vez seria O(n^2) de teste de linha de
   * visada, e com 1500 pontos no vale isso sao milhoes de
   * `isPositionFree` numa unica viagem
   *
   * ## POR QUE A VARREDURA E DE TRAS PARA A FRENTE
   *
   * Porque ela procura o ULTIMO visivel, e o ultimo visivel e o primeiro
   * acerto vindo do fim. De frente ela testava as 250 celulas do
   * caminho inteiro para so entao guardar a ultima que viu — 250 testes
   * para uma resposta. De tras, num trecho livre ela acerta em um
   * passo, e so gasta a varredura inteira quando o caminho esta preso
   * atras de um obstaculo, que e o caso em que a resposta esta longe de
   * qualquer jeito
   *
   * ## O PRIMEIRO ponto testado e a posicao real do jogador
   *
   * E nao o centro da celula de partida. Sao ate 28px de diferenca, e o
   * suficiente para a primeira perna do caminho cortar a arvore que o
   * jogador ja esta encostado — o piloto sairia andando contra ela
   *
   * ## NENHUMA PERNA NASCE CEGA
   *
   * Todo ponto guardado foi visto do ponto anterior. A versao anterior
   * tinha um furo aqui: quando a visibilidade nao crescia com a distancia
   * — e nao cresce quando o caminho acaba de passar por um vao e sai
   * do outro lado de um obstaculo — a varredura guardava o ponto da
   * celula seguinte sem ele ter sido visto. O piloto recebia uma perna
   * de 9.000px atravessando a sebe de ponta a ponta
   *
   * ## A EXCECAO, E POR QUE ELA E DE 40px
   *
   * Quando NADA no vao e visivel — e o vao e cego quando o caminho esta
   * dentro de um corredor estreito, que e o vao de uma sebe — o
   * simplificador guarda o centro da celula seguinte assim mesmo. Sao
   * 40px, uma celula vizinha de outra celula andavel, num caminho que nao
   * corta canto: uma perna cega de 40px nao trava ninguem, porque o
   * `escapeCorner` tira o boneco do canto em meio passo e ele consome o
   * ponto no quadro seguinte
   *
   * O que nao pode e uma perna cega de 1.900px, e o `VAO` e o que
   * garante o tamanho dela: cada perna do caminho e, no maximo, um vao
   * inteiro de visibilidade mais o passo cego de uma celula
   *
   * E o "nada a fazer" quando ate esse passo e cego: guardar assim mesmo,
   * avancar, e deixar o `escapeCorner` do motor resolver o canto. O que
   * nao se faz e ficar parado ali — sem ponto novo a varredura nao
   * avanca e o simplificador entra em laco
   */
  #simplificar(de, pontos, destino) {
    const saida = [];

    let origem = de;

    let inicio = 0;

    while (inicio < pontos.length) {
      const teto = Math.min(pontos.length - 1, inicio + VAO_SIMPLIFICAR);

      let melhor = inicio;

      for (let alvo = teto; alvo > inicio; alvo -= 1) {
        if (this.temLinhaDeVisada(origem, pontos[alvo])) {
          melhor = alvo;
          break;
        }
      }

      saida.push(pontos[melhor]);

      origem = pontos[melhor];

      inicio = melhor + 1;
    }

    /**
     * O FIM. E uma funcao separada porque ela precisa do ponto ANTERIOR
     * a ultima — trocar o destino e o que muda a penultima perna, e nao
     * so a ultima
     */
    return this.#fecharNoDestino(de, destino, saida);
  }

  /**
   * O FIM do caminho: o destino exato, uma ponte, ou o centro de celula.
   *
   * ## POR QUE ISTO EXISTE
   *
   * A versao anterior escrevia o destino por cima do ultimo ponto, sem
   * perguntar nada. E o destino e o CENTRO de uma zona, e o ultimo centro
   * de celula pode estar a 28px dele: uma perna de 28px que o simplificador
   * nunca testou, porque ele testou a visada ate o CENTRO, nao ate o
   * destino
   *
   * O resultado era um caminho que acabava com uma perna atravessando
   * uma sebe — e o piloto ia nela, empurrava no arbusto, contava 3s
   * parado, refazia o mesmo caminho e empurrava de novo. O travamento
   * nao era do A*: era desta ultima linha
   *
   * ## A REGRA E VALER O CAMINHO INTEIRO
   *
   * Trocar o ultimo centro de celula pelo destino exato muda a PERNA
   * ANTERIOR, e nao so a ultima. Um destino 14px fora do centro gira a
   * linha toda, e uma perna de 1.710px que passava a 30px de uma arvore
   * passa a encostar nela: o caminho que era o melhor do vale vira uma
   * perna raspando por causa de 14px no fim
   *
   * Por isso a substituicao so acontece quando o caminho CONTINUA valido
   * com folga ate o destino. E quando nao continua, sao tres saidas, na
   * ordem:
   *
   * 1. **o destino DENTRO de um obstaculo**: nao ha nada melhor a fazer.
   *    O A* ja achou a celula de entrada (`#maisPertoAndavel`) e o
   *    caminho aponta para o destino mesmo assim — o boneco empurra o
   *    arbusto, o `moveEntity` devolve, e o motor descarta a etapa por
   *    nao ter mais o que consumir
   * 2. **uma PONTE**: um ponto intermediario visivel dos dois lados, que
   *    divide a perna em duas com folga. E o que resolve o destino que
   *    ficou do outro lado de um arbusto
   * 3. **o centro de celula**: o caminho acaba no ponto mais proximo do
   *    destino que o mapa deixa, e so quando nem a ponte existe
   *
   * ## E O PASSO DE LADO
   *
   * Sobrou um caso que as tres nao pegam: o destino e valido para o
   * corpo mas nao cabe com folga — o centro de uma zona que tem uma
   * arvore a 24px. A perna ate ele e de NO MAXIMO UMA CELULA, porque o
   * destino esta na mesma celula do centro, e o que se pede ao boneco e
   * um passo de lado, nao uma travessia
   *
   * Sem esse teto o mesmo truque criaria uma perna de 1.900px testada so
   * com o raio do corpo — que e exatamente a perna que raspa no arbusto e
   * trava. Com o teto, o passo de lado so abre para o que cabe numa
   * celula
   */
  #fecharNoDestino(de, destino, saida) {
    /**
     * O PONTO DE ONDE A ULTIMA PERNA PARTE.
     *
     * E o penultimo ponto guardado, ou a posicao real do jogador quando
     * o caminho tem um ponto so. Trocar o destino muda a perna que ENTRA
     * nele, e nao a que sai — por isso que este e o ponto que decide
     */
    const anterior = saida.length > 1 ? saida[saida.length - 2] : de;

    if (!this.#visivel(anterior, destino, this.raioCorpo)) {
      saida[saida.length - 1] = { x: destino.x, y: destino.y };

      return saida;
    }

    if (this.temLinhaDeVisada(anterior, destino)) {
      saida[saida.length - 1] = { x: destino.x, y: destino.y };

      return saida;
    }

    const ponte = this.#ponte(anterior, destino);

    if (ponte) {
      saida.push(ponte);
      saida.push({ x: destino.x, y: destino.y });

      return saida;
    }

    const perto =
      Math.hypot(destino.x - anterior.x, destino.y - anterior.y) <=
      this.celula;

    if (perto) {
      saida[saida.length - 1] = { x: destino.x, y: destino.y };
    }

    return saida;
  }

  /**
   * UM ponto intermediario visivel dos dois lados, ou `null`.
   *
   * As DUAS pernas sao conferidas com FOLGA, e nao com o raio do corpo.
   * A ponte existe para transformar uma travessia em duas passadas com
   * folga; uma ponte cujas pernas so passam com o raio do corpo seria
   * uma travessia de 400px raspa e uma travessia de 1.800px raspando,
   * que e o defeito que a folga veio matar
   *
   * A busca e um anel em torno do MEIO do segmento, e o meio e o melhor
   * chute: e onde o obstaculo esta quando a reta esta bloqueada e os
   * dois extremos estao livres. O raio sobe de uma celula em uma celula
   * porque um obstaculo que barra a reta esta tipicamente a uma celula
   * de distancia do meio dela
   *
   * E o que se chama quando o destino ficou do outro lado de um arbusto
   * — e um arbusto e 28px, entao o primeiro anel ja acha a volta
   */
  #ponte(de, para) {
    const meioX = (de.x + para.x) / 2;
    const meioY = (de.y + para.y) / 2;

    for (
      let alcance = this.celula;
      alcance <= this.celula * 4;
      alcance += this.celula
    ) {
      for (let passo = 0; passo < 12; passo += 1) {
        const angulo = (passo / 12) * Math.PI * 2;

        const ponto = {
          x: meioX + Math.cos(angulo) * alcance,
          y: meioY + Math.sin(angulo) * alcance,
        };

        if (
          this.temLinhaDeVisada(de, ponto) &&
          this.temLinhaDeVisada(ponto, para)
        ) {
          return ponto;
        }
      }
    }

    return null;
  }
}
