/**
 * A GEOMETRIA DOS TELEGRAPHS, e o unico lugar que sabe o que e "dentro".
 *
 * ## O PROBLEMA QUE ESTE ARQUIVO RESOLVE
 *
 * O telegraph e desenhado no chao e o dano e aplicado no impacto. Se as duas
 * coisas usassem contas diferentes, o jogador veria um circulo e levaria o
 * dano de fora dele — ou o inverso, que e pior: o jogador desvia de uma area
 * que ele nunca foi atingido e leva dano de uma area que pareceu segura
 *
 * Por isso `contemPonto` e a unica funcao de "dentro", e tanto o
 * `TelegraphSystem` quanto o `TelegraphRenderer` passam por ela
 *
 * ## E POR QUE AS DISTANCIAS SAO AO QUADRADO
 *
 * Porque a comparacao ao quadrado evita a raiz: `dx*dx + dy*dy` nao tem
 * `sqrt`, e estes testes rodam para cada jogador, para cada telegraph ativo,
 * a cada quadro do servidor. Com 40 jogadores e 3 telegraphs ao mesmo tempo
 * sao 120 testes por quadro — e a raiz em cada um e o que faria o custo
 * aparecer no perfil
 */

/**
 * DISTANCIA AO QUADRADO entre dois pontos.
 *
 * E um `const` em vez de uma funcao porque o compilador inlina, e o nome
 * documenta o proposito: nenhum destes valores volta a ser uma distancia
 * real, entao nao ha `sqrt` em lugar nenhum do caminho quente
 */
export function distancia2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;

  return dx * dx + dy * dy;
}

/**
 * O PONTO ESTA DENTRO DA FORMA?
 *
 * E o unico teste de acerto do jogo. Recebe a execucao (que ja carrega a
 * posicao congelada, o raio e o angulo) e o ponto a testar
 *
 * ## O QUE CADA FORMA FAZ
 *
 * - `circle`: um disco. O ponto esta dentro se a distancia ao centro e menor
 *   que o raio
 * - `ring`: uma coroa. O ponto esta dentro se estiver ENTRE os dois raios —
 *   e e por isso que o raio interno existe: o centro do chefe e seguro
 * - `cone`: um setor. Alem da distancia, o ponto tem de estar dentro do
 *   angulo. E a unica forma que precisa do `facing`
 * - `line`: uma faixa retangular. O ponto e testado no espaco LOCAL do
 *   retangulo, girado pelo angulo da linha: o comprimento vira `|u|` e a
 *   largura vira `|v|`
 * - `targeted`: um disco, como o `circle`, mas o centro e a posicao do alvo
 * - `charge`: uma faixa retangular, como a `line`
 *
 * ## E POR QUE O `cone` E O `line` USAM O MESMO TESTE LOCAL
 *
 *porque os dois sao "meio retangulo ou meio setor" no espaco do alvo, e o
 * que muda e a funcao de borda. O setor e o retangulo recortado por um
 * angulo; a faixa e o retangulo inteiro. Calcular os dois no espaco local
 * evita duplicar a conta de distancia, que e a parte cara
 */
export function contemPonto(execucao, px, py) {
  switch (execucao.tipo) {
    case "circle":
      return (
        distancia2(px, py, execucao.x, execucao.y) <=
        execucao.raio * execucao.raio
      );

    /**
     * O ANEL: entre os dois raios, e nao dentro do externo.
     *
     * O `>=` no interno e o que torna o centro seguro. Sem ele, o
     * `shock_ring` acertaria o jogador colado no chefe, e a habilidade
     * inteira nao faria sentido — ela existe para empurrar para FORA
     */
    case "ring":
      return (
        distancia2(px, py, execucao.x, execucao.y) <=
          execucao.raioExterno * execucao.raioExterno &&
        distancia2(px, py, execucao.x, execucao.y) >=
          execucao.raioInterno * execucao.raioInterno
      );

    case "cone": {
      const dx = px - execucao.x;
      const dy = py - execucao.y;

      const d2 = dx * dx + dy * dy;

      if (d2 > execucao.alcance * execucao.alcance) return false;

      /**
       * O ANGULO, medido com o produto vetorial.
       *
       * `cos(angulo/2)` evita `Math.acos` no caminho quente. O teste e
       * "o ponto esta dentro da cunha": o produto vetorial entre a direcao
       * do chefe e a direcao do ponto precisa ser positivo E a distancia
       * precisa estar dentro do alcance
       */
      const comprimento = Math.hypot(dx, dy);

      if (comprimento < 0.0001) return true;

      const dot =
        (execucao.dirX * dx + execucao.dirY * dy) / comprimento;

      return dot >= execucao.cosMeioAngulo;
    }

    case "line":
    case "charge": {
      const dx = px - execucao.x;
      const dy = py - execucao.y;

      // o espaco LOCAL: `u` ao longo da linha, `v` atraves dela
      const u = dx * execucao.dirX + dy * execucao.dirY;
      const v = -dx * execucao.dirY + dy * execucao.dirX;

      return (
        u >= 0 &&
        u <= execucao.alcance &&
        Math.abs(v) <= execucao.largura / 2
      );
    }

    case "targeted":
      return (
        distancia2(px, py, execucao.x, execucao.y) <=
        execucao.raio * execucao.raio
      );

    default:
      return false;
  }
}

/**
 * O `cosMeioAngulo` de uma habilidade, em radianos.
 *
 * E o `Math.cos` do meio do angulo, usado pelo teste do cone. Fica aqui
 * porque e a unica trigonometria do caminho quente, e ela roda uma vez por
 * execucao — no inicio do telegraph, nao por quadro
 */
export function cosMeioAnguloDe(anguloGraus) {
  return Math.cos((anguloGraus * Math.PI) / 180 / 2);
}