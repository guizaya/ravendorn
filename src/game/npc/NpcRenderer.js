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

    /**
     * A CELULA, E NAO A FOLHA INTEIRA.
     *
     * Porque a folha do mercador tem 9 quadros lado a lado: medir a folha
     * daria 1548px de largura e o boneco entraria na tela de traversso. O que
     * ocupa o mundo e UM quadro, que e o que `celula` declara
     *
     * `celula` vazio (0) e o caso de um NPC de arte estatica, e o
     * `naturalWidth` do catalogo volta a ser a medida — o bau e o mestre
     * continuam exatamente como estavam
     */
    const celula = npc.celula;

    const largura = celula?.width > 0 ? celula.width : npc.naturalWidth;
    const altura = celula?.height > 0 ? celula.height : npc.naturalHeight;

    return {
      width: largura * scale,
      height: altura * scale,
    };
  }

  /**
   * O RETANGULO DE ORIGEM DO QUADRO, OU `null` PARA ARTE ESTATICA.
   *
   * ## POR QUE O TEMPO VAI DIVIDIDO PELA VELOCIDADE
   *
   * Porque `drawClock` e um relogio que so cresce, e o indice do quadro e uma
   * posicao na volta do ciclo: `tempo / velocidade` conta quantos QUADROS
   * passaram, e o `% quadros` guarda o resto. E a mesma conta de qualquer
   * animacao por quadro, e o que faz o idle do mercador respirar em 1.62s
   *
   * ## E POR QUE `null` E NAO UM RETANGULO ZERO
   *
   * Porque o `drawImage` de 5 argumentos e o caminho antigo: ele pinta a
   * imagem inteira, que e o que um NPC sem celula precisa. Passar um
   * `sx/sy/sw/sh` de 0 cortaria a arte em vez de desenha-la
   */
  frameOf(npc, tempo) {
    const celula = npc.celula;

    if (!celula || !(celula.quadros > 1) || !(celula.width > 0)) return null;

    const velocidade = npc.velocidade ?? 0.18;

    if (!(velocidade > 0)) return null;

    const quadro = Math.floor(tempo / velocidade) % celula.quadros;

    return {
      sx: quadro * celula.width,
      sy: 0,
      sw: celula.width,
      sh: celula.height,
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
  /**
 * OS PIXELS VAZIOS DA BASE DA CELULA, JA ESCALADOS.
 *
 * ## POR QUE O DESENHO DESCE, E NAO SOBE
 *
 * Porque o `npc.y` e o PE do boneco, e nao a base da celula. A celula tem
 * 26px transparentes embaixo, entao ancorar a BASE dela no `y` colocaria o
 * desenho 26px no ar — o mercador flutuando acima do calcamento
 *
 * Descer o desenho e a unica correcao: a celula sai 15px mais baixa e o pe
 * cai em cima do chao. Subir o `y` do catalogo resolveria a mesma coisa e
 * quebraria outra: o `y` e o PE por contrato, e o colisor de clique e o
 * `drawShadow` leem esse mesmo numero
 *
 * E o numero ja vem escalado, porque a margem e medida na arte (172) e o
 * que voa e a arte na tela (172 * scale)
 */
margemDoPe(npc) {
  const margem = npc.celula?.margemBaixo ?? 0;

  if (!(margem > 0)) return 0;

  return margem * (npc.scale ?? 1);
}

/**
   * A caixa do NPC, com o PE em (x, y).
   *
   * E o retangulo que o colisor de clique e o desenho usam, e o mesmo
   * objeto para os dois: se o clique e o desenho lessem caixas
   * diferentes, o alvo pareceria estar deslocado da arte, e o
   * jogador clicaria "no chao ao lado" e o painel abriria
   *
   * E a MESMA margem do desenho, pelos dois motivos de `margemDoPe`: o pe
   * fica no chao, e o alvo fica sob a arte que o jogador ve
   */
  boxOf(npc) {
    const { width, height } = this.sizeOf(npc);

    return {
      x: npc.x - width / 2,
      y: npc.y - height + this.margemDoPe(npc),
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

/**
 * A SOMBRA NO CHAO, e ela MUDA COM O HOVER.
 *
 * ## POR QUE ELA ENCOLHE
 *
 * O comentario original dizia que a sombra encolhe junto com o balaanco
 * porque um NPC que sobe tem o pe fora do chao — e uma sombra do mesmo
 * tamanho diria que ele continua pisado nele
 *
 * ## E POR QUE ISSO CONTINUA VALENDO SEM O BALANCO
 *
 * O balaanco saiu do pedido, mas a sombra encolher nao foi o que se
 * pediu para sair, e e um sinal de hover que o jogador reconhece — a
 * sombra suave no chao e o unico aviso visual que sobrou, ja que o
 * rebalanco e o contorno foram embora
 *
 * Nao e uma consequencia do balaanco que desapareceu: e o feedback de
 * hover que sobrou depois que os outros dois sairam
 */
drawShadow(context, npc, hover = false) {
  /**
   * A LARGURA DA SOMBRA VEM DO DESENHO, E NAO DA CELULA.
   *
   * ## POR QUE ISTO MUDOU
   *
   * A sombra e uma elipse medida na largura da arte, e a arte de um NPC com
   * celula e o boneco desenhado DENTRO dela. A celula do mercador mede 172 e
   * o boneco uns 76: as 96 de diferenca sao margem transparente do GIF de
   * origem
   *
   * Medindo pela celula, a sombra saia com 68px de diametro embaixo de um
   * boneco de 76 — quase do mesmo tamanho, e o piso virava um disco preto em
   * vez de uma sombra de pe
   *
   * ## E POR QUE O `??`, E NAO UM `||`
   *
   * Porque `larguraDesenhada: 0` e o caso de um NPC de arte estatica, e o
   * `||` cairia nele tambem — que e exatamente onde a largura da arte e a
   * medida certa. O `??` so substitui por `0`, e ai o `||` abaixo assume
   */
  const desenhada = npc.celula?.larguraDesenhada ?? 0;

  const largura = desenhada > 0 ? desenhada * (npc.scale ?? 1) : this.sizeOf(npc).width;

  context.save();

  context.fillStyle = "rgba(0, 0, 0, 0.3)";

  context.beginPath();
  context.ellipse(
    npc.x,
    npc.y,
    // encolhe no hover: o pe do NPC esta fora do chao
    largura * (hover ? 0.3 : 0.34),
    largura * (hover ? 0.08 : 0.1),
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
   * ## SEMPRE ZERO, E O PONTO
   *
   * O rebalco foi removido do pedido de hover do NPC. Antes o ponteiro
   * em cima fazia o boneco subir e descer em vaivem — e o gesto fica
   * estranho em cima de uma arte de 1000px: o NPC inteiro se desloca dois
   * pixels e meio para o lado, e o que o jogador ve e um tranco, nao um
   * "estou aqui"
   *
   * ## POR QUE O METODO CONTINUA, E NAO SAI UM `0`
   *
   * Porque ele e a REGRA de "o que o hover faz com o desenho", e essa
   * regra agora vale zero. Deixar a funcao returning 0 e o comentario
   * acima diz onde mexer se um dia o rebalco voltar: um numero solto
   * escrito no `drawImage` seria invisivel para quem lesse so ali
   */
  alturaDoHover() {
    return 0;
  }

  drawNpc(context, npc, hover = false, tempo = 0) {
    const image = this.imageFor(npc.sheet);

    if (!image || image.complete !== true) return;

    const { width, height } = this.sizeOf(npc);

    context.save();

    /**
     * SEM REBALCO E SEM QUADRADO NO HOVER.
     *
     * Os dois sairam do mesmo pedido: o boneco parado e a mao de cursor
     * ja dizem que ali ha um clique. O contorno dourado era o que segurava
     * a leitura de "isto abre alguma coisa" — mas ele desenhava um
     * retangulo em volta de uma arte de 1300px, que nao tem a forma de um
     * retangulo. O quadrado ficava no vazio em volta dos ombros do NPC,
     * apontando para um desenho que ele nao continha
     *
     * O que sobra do hover e o CURSOR, e ele e do motor: o
     * `atualizarHoverDeNpc` põe a classe `game-canvas--npc` no canvas, e
     * o CSS troca o cursor para mao. O NPC nao sabe disso, e nao precisa
     *
     * O `sobe` continua sendo lido no `drawImage`, e vale 0 sempre. E o
     * que mantem a arte ancorada pelo PE: sem ele, `npc.y - height` botaria
     * a base da imagem no chao e o boneco flutuaria 100px acima
     */
    const sobe = this.alturaDoHover(hover, tempo);

    /**
     * O PE NO CHAO, E A ARTE COM A MARGEM DEBAIXO.
     *
     * A soma com `margemDoPe` e o que tira o mercador do ar: os 26px
     * transparentes da base da celula sao compensados para baixo, e o desenho
     * passa a terminar exatamente em `npc.y` em vez de 26px acima
     */
    const base = npc.y - height - sobe + this.margemDoPe(npc);

    const quadro = this.frameOf(npc, tempo);

    if (quadro) {
      context.drawImage(
        image,
        quadro.sx,
        quadro.sy,
        quadro.sw,
        quadro.sh,
        npc.x - width / 2,
        base,
        width,
        height,
      );
    } else {
      context.drawImage(
        image,
        npc.x - width / 2,
        base,
        width,
        height,
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
