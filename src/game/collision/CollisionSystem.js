import {
  circleIntersectsRect,
  circleRectPenetration,
  distanceSquared,
} from "../math.js";

const CELL_SIZE = 220;

const CORNER_ESCAPE_TURN = 0.5;

export class CollisionSystem {
  /**
   * @param {object} map    o mapa, com os seus solidos
   * @param {object[]} [extraSolids]  retangulos solidos de OUTRA
   *   origem — no jogo, a pegada dos NPCs
   *
   * Os NPCs viram solidos por parametro e nao por `map.solids` porque a
   * pegada e DEDUZIDA da arte e da posicao: ela sai da escala e da
   * ancora, que so o motor tem. Escrever o retangulo a mao no dado do
   * mapa faria a barreira e a arte poderem divergir sem ninguem ver
   */
  constructor(map, extraSolids = []) {
    this.map = map;

    this.solids = [
      ...(map.solids ?? []),
      ...(map.walls ?? []),
      ...(map.obstacles ?? []),
      ...extraSolids,
    ];

    this.cellSize = CELL_SIZE;

    /**
     * AS PROPS QUE SUMIRAM DO MAPA.
     *
     * ## POR QUE ISTO VIVE AQUI E NAO RECONSTRUI A LISTA
     *
     * Porque `map.solids` e DADO ESTATICO, montado uma vez no `setMap`, e
     * a pedra demolida continua nele. Sem esta lista o jogador ficava preso
     * num cristal invisivel: o servidor dizia que a pedra tinha acabado, o
     * desenho sumia, e o colisor da artecontinuava la barrando o caminho
     *
     * E uma lista mutavel em vez de um `CollisionSystem` novo porque
     * reconstruir custaria refazer a grade de 220px a cada pedra demolida, e
     * uma pedra cai no maximo a cada 10s — o filtro e um `Set.has` dentro
     * do laco que ja existe
     *
     * E por `propId` e nao por `kind`: o `kind` e o TIPO, e as 23 pedras
     * comumas do vale sao todas `cristal_comum`
     */
    this.pedidasFora = new Set();

    const bounds = map.bounds;

    const extentWidth =
      map.width ?? bounds.x + bounds.width;

    const extentHeight =
      map.height ?? bounds.y + bounds.height;

    this.columns = Math.max(
      1,
      Math.ceil(extentWidth / this.cellSize) + 1,
    );

    this.rows = Math.max(
      1,
      Math.ceil(extentHeight / this.cellSize) + 1,
    );

    this.cells = new Array(
      this.columns * this.rows,
    );

    for (let index = 0; index < this.cells.length; index += 1) {
      this.cells[index] = [];
    }

    this.seen = new Set();

    /**
     * O CIRCULO DE RASCUNHO.
     *
     * `circleIntersectsRect` so le `x`, `y` e `radius`, entao um objeto
     * so precisa existir para toda a vida do colisor. Este e chamado com
     * todos os solidos visiveis da celula, para cada eixo de movimento
     * de cada criatura: o literal por solido eram milhares de objetos de
     * um so campo jogados fora por tique
     */
    this._circulo = { x: 0, y: 0, radius: 0 };

    for (const rect of this.solids) {
      this.insertSolid(rect);
    }

    this.scratch = [];
  }

  cellIndex(cellX, cellY) {
    return cellY * this.columns + cellX;
  }

  cellBounds(x, y, radius) {
    return {
      minX: Math.max(
        0,
        Math.floor((x - radius) / this.cellSize),
      ),
      maxX: Math.min(
        this.columns - 1,
        Math.floor((x + radius) / this.cellSize),
      ),
      minY: Math.max(
        0,
        Math.floor((y - radius) / this.cellSize),
      ),
      maxY: Math.min(
        this.rows - 1,
        Math.floor((y + radius) / this.cellSize),
      ),
    };
  }

  insertSolid(rect) {
    const bounds = this.cellBounds(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      Math.max(rect.width, rect.height) / 2,
    );

    for (let cellY = bounds.minY; cellY <= bounds.maxY; cellY += 1) {
      for (
        let cellX = bounds.minX;
        cellX <= bounds.maxX;
        cellX += 1
      ) {
        this.cells[this.cellIndex(cellX, cellY)].push(rect);
      }
    }
  }

  nearbySolids(x, y, radius) {
    const bounds = this.cellBounds(x, y, radius);
    const scratch = this.scratch;

    scratch.length = 0;

    const seen = this.seen;

    seen.clear();

    for (let cellY = bounds.minY; cellY <= bounds.maxY; cellY += 1) {
      for (
        let cellX = bounds.minX;
        cellX <= bounds.maxX;
        cellX += 1
      ) {
        const bucket = this.cells[this.cellIndex(cellX, cellY)];

        for (const rect of bucket) {
          if (seen.has(rect)) continue;

          seen.add(rect);
          scratch.push(rect);
        }
      }
    }

    return scratch;
  }

  /**
   * A POSICAO ESTA DENTRO DO LIMITE DO MAPA?
   *
   * ## O CIRCULO, QUANDO O MAPA DECLARAR UM
   *
   * A arena de chefe tem um limite redondo, e o `bounds` retangular nao
   * serve: ele barrava o jogador nos quatro cantos, deixando o circulo
   * com quatro "orelhas" quadradas nos pontos de cima, de baixo, da
   * esquerda e da direita
   *
   * Com `boundsCircle`, o teste e a DISTANCIA AO CENTRO. O `radius` do
   * jogador e descontado do raio do circulo, e nao somado: o boneco tem
   * que caber inteiro, entao e o CENTRO dele que tem que estar a
   * `radius - raioDoBoneco` do centro da arena. Somar em vez de
   * descontar deixaria o boneco pendurado para fora da borda
   */
  isInsideBounds(position, radius) {
    const circle = this.map.boundsCircle;

    if (circle) {
      const dx = position.x - circle.x;
      const dy = position.y - circle.y;

      const limite = Math.max(0, circle.radius - radius);

      return dx * dx + dy * dy <= limite * limite;
    }

    const bounds = this.map.bounds;

    return (
      position.x - radius >= bounds.x &&
      position.y - radius >= bounds.y &&
      position.x + radius <= bounds.x + bounds.width &&
      position.y + radius <= bounds.y + bounds.height
    );
  }

  isPositionFree(
    position,
    radius,
    entities = [],
    ignoredEntityId = null,
  ) {
    if (!this.isInsideBounds(position, radius)) {
      return false;
    }

    const candidates = this.nearbySolids(
      position.x,
      position.y,
      radius,
    );

    for (const rect of candidates) {
      if (rect.passable) continue;

      /**
       * A PROP FOI DEMOLIDA E O SEU SOLIDO JA NAO EXISTE.
       *
       * E o filtro que faltava aqui: e este metodo que o `moveEntity`
       * consulta antes de cada eixo, entao sem ele a pedra demolida
       * continuava barrando o jogador — e o sintoma era ficar preso num
       * cristal que ja nao estava na tela
       *
       * O `propId` so existe nos solidos que `buildPropSolids` montou a
       * partir de uma prop com `solidWidth` declarado. O `undefined` nos
       * outros cai no `has` e passa
       */
      if (rect.propId && this.pedidasFora.has(rect.propId)) {
        continue;
      }

      /**
       * O circulo e REAPROVEITADO, e nao um literal por solido.
       *
       * `circleIntersectsRect` so le `x`, `y` e `radius`, entao um
       * objeto so precisa existir. Este e chamado com todos os solidos
       * visiveis da celula, para cada eixo de movimento de cada
       * criatura: com 93 mobes, eram milhares de objetos de um so
       * campo jogados fora por tique
       */
      this._circulo.x = position.x;
      this._circulo.y = position.y;
      this._circulo.radius = radius;

      if (circleIntersectsRect(this._circulo, rect)) {
        return false;
      }
    }

    /**
     * AS ENTIDADES PASSADAS A LISTA INTEIRA, e nao um indice espacial.
     *
     * Este laco e O(n) sobre os inimigos do mapa: 93 no vale. E o
     * comentario antigo falava em trocar por um grid uniforme, mas medido
     * o laco NAO e o gargalo: ele ja compara ao quadrado, sem `sqrt`,
     * sem `hypot` e sem alocar nada. Um grid aqui custaria mais para ser
     * mantido a cada movimento do que o que economizaria na busca
     *
     * O que era caro de verdade neste metodo era o `distanceSquared`
     * receber um objeto novo para cada par, e o circulo do
     * `circleIntersectsRect` ser um literal por solido. As duas coisas
     * estao resolvidas acima
     */
    const dx = position.x;
    const dy = position.y;

    for (const entity of entities) {
      if (entity.id === ignoredEntityId || entity.alive === false) {
        continue;
      }

      const minimumDistance = radius + entity.radius;

      const ex = dx - entity.x;
      const ey = dy - entity.y;

      if (ex * ex + ey * ey < minimumDistance * minimumDistance) {
        return false;
      }
    }

    return true;
  }

  circleHitsSolid(position, radius) {
    if (!this.isInsideBounds(position, radius)) {
      return true;
    }

    const candidates = this.nearbySolids(
      position.x,
      position.y,
      radius,
    );

    for (const rect of candidates) {
      if (rect.passable) continue;

      // a pedra demolida nao bate mais: ver o `isPositionFree`
      if (rect.propId && this.pedidasFora.has(rect.propId)) {
        continue;
      }

      if (
        circleIntersectsRect(
          { x: position.x, y: position.y, radius },
          rect,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Empurra a entidade para dentro do limite do mapa.
   *
   * ## POR QUE O CIRCULO NAO PODE SER UM `min`/`max` POR EIXO
   *
   * O clamp do retangulo e uma conta por eixo. O do circulo nao: se o
   * jogador esta em (700, 120) numa arena de raio 548 centrada em (840,
   * 588), os dois eixos estao DENTRO do retangulo e fora do circulo —
   * mas clampar X e Y separadamente nao o traz de volta, porque cada eixo
   * isolado ja "cabe"
   *
   * A solucao e projetar o ponto na direcao do centro: se a distancia
   * passa do limite, o ponto vai para a borda do circulo NA MESMA LINHA
   * que o centro. E o que faz o boneco deslizar pela curva em vez de
   * parar reto nela
   *
   * E o `x === circle.x && y === circle.y` e a unica divisao por zero
   * possivel: sem ele, quem estivesse exatamente no centro dividiria por
   * zero e o clamp devolveria `NaN`, que some com a posicao do jogador
   */
  clampToBounds(entity, radius) {
    const circle = this.map.boundsCircle;

    if (circle) {
      const limite = Math.max(0, circle.radius - radius);

      const dx = entity.x - circle.x;
      const dy = entity.y - circle.y;

      const distancia = Math.sqrt(dx * dx + dy * dy);

      if (distancia <= limite) return false;

      const x = distancia === 0 ? circle.x : circle.x + (dx / distancia) * limite;
      const y = distancia === 0 ? circle.y : circle.y + (dy / distancia) * limite;

      entity.x = x;
      entity.y = y;

      return true;
    }

    const bounds = this.map.bounds;

    const minX = bounds.x + radius;
    const maxX = bounds.x + bounds.width - radius;
    const minY = bounds.y + radius;
    const maxY = bounds.y + bounds.height - radius;

    const x = Math.max(minX, Math.min(maxX, entity.x));
    const y = Math.max(minY, Math.min(maxY, entity.y));

    const clamped = x !== entity.x || y !== entity.y;

    entity.x = x;
    entity.y = y;

    return clamped;
  }

  /**
   * tira a entidade de dentro de qualquer solido (e de fora dos
   * limites do mapa). sem isso, entrar 1px num obstaculo trava o
   * movimento para sempre, porque isPositionFree so responde
   * sim ou nao e nenhuma posicao vizinha seria valida.
   *
   * devolve true quando teve que mover algo.
   */
  resolveOverlap(entity, radius, passes = 3) {
    let corrected = false;

    for (let pass = 0; pass < passes; pass += 1) {
      let movedThisPass = false;

      const candidates = [
        ...this.nearbySolids(
          entity.x,
          entity.y,
          radius,
        ),
      ];

for (const rect of candidates) {
        if (rect.passable) continue;

        /**
         * A mesma pedra demolida e ignorada aqui: e este laco que tira o
         * jogador de dentro de solido, e sem o filtro ele seria empurrado
         * para fora de um cristal que nao existe mais
         */
        if (rect.propId && this.pedidasFora.has(rect.propId)) {
          continue;
        }

        const push = circleRectPenetration(
          { x: entity.x, y: entity.y, radius },
          rect,
        );

        if (!push) continue;

        entity.x += push.x;
        entity.y += push.y;

        movedThisPass = true;
        corrected = true;
      }

      if (this.clampToBounds(entity, radius)) {
        movedThisPass = true;
        corrected = true;
      }

      if (!movedThisPass) break;
    }

    return corrected;
  }

  moveEntity(entity, deltaX, deltaY, entities = []) {
    const startX = entity.x;
    const startY = entity.y;

    if (deltaX !== 0) {
      const nextX = entity.x + deltaX;

      if (
        this.isPositionFree(
          { x: nextX, y: entity.y },
          entity.radius,
          entities,
          entity.id,
        )
      ) {
        entity.x = nextX;
      }
    }

    if (deltaY !== 0) {
      const nextY = entity.y + deltaY;

      if (
        this.isPositionFree(
          { x: entity.x, y: nextY },
          entity.radius,
          entities,
          entity.id,
        )
      ) {
        entity.y = nextY;
      }
    }

    const movedX = entity.x - startX;
    const movedY = entity.y - startY;

    // preso num canto: os dois eixos bloqueados nao tem diagonal
    // livre, entao a entidade fica sem escorregar. tenta girar o
    // passo para sair pela diagonal.
    if (
      movedX === 0 &&
      movedY === 0 &&
      (deltaX !== 0 || deltaY !== 0)
    ) {
      this.escapeCorner(
        entity,
        startX,
        startY,
        deltaX,
        deltaY,
        entities,
      );
    }

    return Math.hypot(entity.x - startX, entity.y - startY);
  }

  escapeCorner(
    entity,
    startX,
    startY,
    deltaX,
    deltaY,
    entities,
  ) {
    const length = Math.hypot(deltaX, deltaY);
    const angle = Math.atan2(deltaY, deltaX);

    for (const turn of [
      CORNER_ESCAPE_TURN,
      -CORNER_ESCAPE_TURN,
    ]) {
      const turned = angle + turn;

      const testX = startX + Math.cos(turned) * length;
      const testY = startY + Math.sin(turned) * length;

      if (
        !this.isPositionFree(
          { x: testX, y: testY },
          entity.radius,
          entities,
          entity.id,
        )
      ) {
        continue;
      }

      entity.x = testX;
      entity.y = testY;

      return true;
    }

    return false;
  }

  moveBySteps(entity, deltaX, deltaY, entities = []) {
    const distance = Math.hypot(deltaX, deltaY);

    if (distance === 0) return 0;

    const steps = Math.max(1, Math.ceil(distance / 10));

    let moved = 0;

    for (let i = 0; i < steps; i += 1) {
      moved += this.moveEntity(
        entity,
        deltaX / steps,
        deltaY / steps,
        entities,
      );
    }

    return moved;
  }
}
