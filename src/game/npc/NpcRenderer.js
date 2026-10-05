/**
 * O desenho dos NPCs.
 *
 * Um renderer proprio, e nao um `PROP_TYPE` novo, por tres razoes que
 * nenhuma se resolve dentro do `PropRenderer`:
 *
 * 1. **a arte nao vem da folha de props.** As props leem celulas de
 *    32px com quatro variacoes, indexadas por `frame`. Um NPC e um
 *    desenho unico de 520x597 sem grade, e a conta de `frame` nao tem
 *    o que indexar
 * 2. **a ancora e no PE, e nao no centro.** O `PropRenderer` desenha a
 *    prop pelo centro da celula. Um NPC com 203px de altura ancorado
 *    pelo centro flutua 100px acima do chao, com a barraca no ar
 * 3. **ele reage ao clique.** O prop e alvo de mira; o NPC e alvo de
 *    painel. Sao dois papeis diferentes e um unico renderer esconde os
 *    dois
 */

function loadImage(src) {
  if (typeof Image === "undefined" || !src) return null;

  const image = new Image();

  image.src = src;

  return image;
}

/**
 * Que fracao da altura da arte e SOLIDA.
 *
 * 0.42 do pe para cima. Abaixo disso estao a barraca e os pes, que sao
 * as coisas que o jogador nao atravessa; acima estao o tronco e a
 * cabeca, que ele simplesmente passa por tras
 */
const BLOCK_ALTURE_FRACAO = 0.42;

/** A largura do solido, em fracao da arte. Estreita para o ombro passar */
const BLOCK_LARGURA_FRACAO = 0.72;

export class NpcRenderer {
  constructor() {
    /**
     * Uma imagem por folha, carregada na primeira vez que o NPC entra
     * no enquadramento.
     *
     * E por URL que o cache e armado, como no `PropRenderer`: dois NPCs
     * do mesmo tipo compartilham a mesma arte, e sem o cache a folha
     * seria buscada a cada quadro so por estar no mapa
     */
    this.images = new Map();
  }

  imageFor(sheet) {
    if (!sheet) return null;

    if (this.images.has(sheet)) return this.images.get(sheet);

    const image = loadImage(sheet);

    this.images.set(sheet, image);

    return image;
  }

  /** a folha deste NPC, se ja carregou */
  isReady(npc) {
    const image = this.imageFor(npc.sheet);

    return image !== null && image.complete === true;
  }

  /**
   * O tamanho que o NPC ocupa no mundo, ja escalado.
   *
   * A escala vem do catalogo, e nao do `npc`, porque e propriedade do
   * TIPO: dois mercadores do mesmo mapa sao do mesmo tamanho
   */
  sizeOf(npc) {
    const scale = npc.scale ?? 1;

    return {
      width: npc.naturalWidth * scale,
      height: npc.naturalHeight * scale,
    };
  }

  /**
   * A caixa do NPC, com o PE em (x, y).
   *
   * E o retangulo que o colisor de clique e o desenho usam, e o mesmo
   * objeto para os dois: se o clique e o desenho lessem caixas
   * diferentes, o alvo pareceria estar deslocado da arte, e o
   * jogador clicaria "no chao ao lado" e o painel abriria
   */
  boxOf(npc) {
    const { width, height } = this.sizeOf(npc);

    return {
      x: npc.x - width / 2,
      y: npc.y - height,
      width,
      height,
    };
  }

  /**
   * A PEGADA: a fatia de baixo que realmente barra o jogador.
   *
   * Nao e a caixa da arte. Um solido de 203px de altura pararia o
   * jogador no ar, longe da barraca, e ele pareceria estar batendo numa
   * parede invisivel no meio do calcamento
   *
   * A fatia comeca onde a arte costuma ser solida — a barra e os pes,
   * nos ultimos 42% da altura — e e ligeiramente mais estreita que a
   * arte, para o boneco nao ficar com o ombro raspando na barreira
   */
  blockBoxOf(npc) {
    const box = this.boxOf(npc);

    const height = box.height * BLOCK_ALTURE_FRACAO;

    const width = box.width * BLOCK_LARGURA_FRACAO;

    return {
      x: npc.x - width / 2,
      y: npc.y - height,
      width,
      height,
    };
  }

  /**
   * O NPC sob o cursor, o mais proximo primeiro.
   *
   * A ordem importa quando dois NPCs se sobrepoem no cliques: o de
   * frente e o que o jogador quis dizer. O `sort` e por `y`, que e o
   * mesmo criterio da ordenacao de desenho — o que esta mais a frente
   * e o que esta mais embaixo
   */
  pickAt(npcs, point) {
    if (!Array.isArray(npcs) || npcs.length === 0) return null;

    const candidatos = [];

    for (const npc of npcs) {
      const box = this.boxOf(npc);

      const dentro =
        point.x >= box.x &&
        point.x <= box.x + box.width &&
        point.y >= box.y &&
        point.y <= box.y + box.height;

      if (!dentro) continue;

      candidatos.push(npc);
    }

    if (candidatos.length === 0) return null;

    candidatos.sort((a, b) => b.y - a.y);

    return candidatos[0];
  }

  drawShadow(context, npc, hover = false) {
    const { width } = this.sizeOf(npc);

    context.save();

    context.fillStyle = "rgba(0, 0, 0, 0.3)";

    context.beginPath();
    context.ellipse(
      npc.x,
      npc.y,
      // A sombra encolhe com o balanco: um NPC que sobe tem o pe fora do
      // chao, e uma sombra do mesmo tamanho diria que ele continua
      // pisado nele
      width * (hover ? 0.3 : 0.34),
      width * (hover ? 0.08 : 0.1),
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.restore();
  }

  /**
   * O quanto o NPC sobe quando o ponteiro esta em cima dele.
   *
   * O `pico` e a altura do salto, e o ciclo e um vaivem. O `tempo` vem
   * do relogio do motor, nao de um relogio proprio do renderer: dois
   * relogios contariam o tempo duas vezes e o balanco entraria em camera
   * lenta
   */
  alturaDoHover(hover, tempo) {
    if (hover !== true) return 0;

    return Math.abs(Math.sin(tempo * 6)) * 6;
  }

  drawNpc(context, npc, hover = false, tempo = 0) {
    const image = this.imageFor(npc.sheet);

    if (!image || image.complete !== true) return;

    const { width, height } = this.sizeOf(npc);

    context.save();

    /**
     * O REBALCO quando o ponteiro chega.
     *
     * E um vaivem pelo `sin`: o NPC sobe e desce em vez de tremer, que e
     * o gesto de "estou aqui". Um `Math.random()` por quadro faria o
     * NPC tremeluzir, e tremeluzir parece defeito, nao convite
     */
    const sobe = this.alturaDoHover(hover, tempo);

    /**
     * A arte vai pelo CENTRO, e o PE fica em (x, y).
     *
     * E o inverso do `PropRenderer`, que desenha pelo centro da celula
     * e deixa a prop pousada no chao sozinha. Um NPC tem perna e tem
     * barra de pocoes, e o que toca o chao tem de ser o chao
     *
     * O `sobe` entra aqui e nao no desenho: o NPC sobe e a sombra encolhe,
     * os dois juntos. Levantar so a arte deixaria o NPC boiando com o pe
     * na mesma altura do chao
     */    context.drawImage(
      image,
      npc.x - width / 2,
      npc.y - height - sobe,
      width,
      height,
    );

    /**
     * O brilho do contorno.
     *
     * O balanco sozinho some rapido demais quando o jogador passa o mouse
     * por cima sem parar. O contorno fica enquanto o ponteiro estiver
     * em cima, e e ele que segura a leitura de "isto abre alguma coisa"
     */
    if (hover === true) {
      context.globalAlpha = 0.45 + Math.abs(Math.sin(tempo * 6)) * 0.3;

      context.strokeStyle = "#ffd479";
      context.lineWidth = 2;

      context.strokeRect(
        npc.x - width / 2 + 1,
        npc.y - height - sobe + 1,
        width - 2,
        height - 2,
      );
    }

    context.restore();
  }

  /**
   * Os NPCs dentro do enquadramento da camera.
   *
   * E o mesmo recorte que o `PropRenderer` faz, e pelo mesmo motivo: a
   * tela mostra uma fracao do mapa, e dibujar o mapa inteiro e o que
   * faz a taxa de quadros cair em um mapa grande
   */
  collectVisible(npcs, view) {
    if (!Array.isArray(npcs)) return [];

    const visible = [];

    for (const npc of npcs) {
      const box = this.boxOf(npc);

      if (
        box.x > view.x + view.width ||
        box.x + box.width < view.x ||
        box.y > view.y + view.height ||
        box.y + box.height < view.y
      ) {
        continue;
      }

      visible.push(npc);
    }

    return visible;
  }

  draw(context, npcs, view) {
    for (const npc of this.collectVisible(npcs, view)) {
      this.drawShadow(context, npc);
      this.drawNpc(context, npc);
    }
  }

  visibleCount(npcs, view) {
    return this.collectVisible(npcs, view).length;
  }
}
