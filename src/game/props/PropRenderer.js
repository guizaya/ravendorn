import {
  AURA_DO_CRISTAL,
  PROP_FRAME,
  PROP_SHEET,
  PROP_SCALE,
  PROP_TYPES,
  PROP_VARIANTS,
  propSemSombra,
  propSheetFor,
} from "../../data/props/index.js";

const MARGIN = 80;

function loadImage(src) {
  if (typeof Image === "undefined") return null;

  const image = new Image();

  image.src = src;

  return image;
}

export class PropRenderer {
  constructor() {
    /**
     * Uma imagem por folha, e nao uma so.
     *
     * A arvore do vale vem de `arvore.png` e a props antiga de
     * `props.png`: sao artes de formato e estilo diferentes, e uma
     * folha so nao da conta das duas
     *
     * `this.image` continua sendo a folha principal, porque e o
     * contrato do `isReady()`
     */
    this.images = new Map();

    this.image = loadImage(PROP_SHEET);

    this.images.set(PROP_SHEET, this.image);
  }

  /**
   * A imagem de uma folha, carregada na primeira vez que aparece.
   *
   * A arvore e a unica prop do mapa, entao sem este cache a folha
   * `props.png` seria buscada a cada arvore desenhada. O cache e por
   * URL porque e ela que identifica a folha
   */
  imageFor(sheet) {
    if (!sheet) return this.image;

    if (this.images.has(sheet)) return this.images.get(sheet);

    const image = loadImage(sheet);

    this.images.set(sheet, image);

    return image;
  }

  isReady() {
    return (
      this.image !== null &&
      this.image.complete === true
    );
  }

  drawShadow(context, prop, map = null) {
    /**
     * ESTA PROP NAO TEM SOMBRA NESTE MAPA.
     *
     * A lista vem do mapa (`propsSemSombra`), e nao daqui: e o cenario
     * que decide, e o renderer so obedece. Sem este `return`, a
     * elipse preta continuaria desenhada embaixo de arbusto e arvore
     * na neve
     */
    if (propSemSombra(prop.type, map)) return;

    const type = PROP_TYPES[prop.type];

    /**
     * A SOMBRA DE CONTATO, QUANDO O TIPO DECLARA UMA.
     *
     * ## POR QUE O PADRAO NAO SERVE PARA O CRISTAL
     *
     * A sombra padrao e uma elipse tirada do `radius`, e ela serve para a
     * arvore e o arbusto, que tem tronco largo. O cristal nao: a ultima linha
     * da arte tem SEIS pixels de largura, e a elipse do padrao sai com 45.
     * Uma mancha de 45px embaixo de uma ponta de 6px nao e sombra de contato —
     * e uma poca escura flutuando, e era o que fazia o cristal parecer que
     * estava no ar
     *
     * ## E POR QUE ELA SOBE, E NAO SOBE PARA CIMA DA PONTA
     *
     * A elipse do padrao e centrada em `prop.y + 6`, DEBAIXO do ponto onde a
     * arte encosta no chao. Com a ponta do cristal em `prop.y`, a sombra
     * nascia com um vao de 6px entre ela e o cristal — e vao entre o
     * objeto e a propria sombra e o que o olho le como "flutuando", mais do
     * que a largura
     *
     * Por isso o cristal declara `dy` negativo: a sombra sobe para encostar
     * na ponta em vez de descer para longe dela
     */
    const sombra = type?.sombra ?? null;

    if (!sombra) {
      const escala = prop.radius / 26;

      context.save();

      context.fillStyle = "rgba(0, 0, 0, 0.26)";
      context.beginPath();
      context.ellipse(
        prop.x,
        prop.y + 6,
        prop.radius * 0.72,
        prop.radius * 0.3,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();

      context.restore();

      return;
    }

    context.save();

    context.fillStyle = "rgba(0, 0, 0, 0.26)";
    context.beginPath();
    context.ellipse(
      prop.x,
      prop.y + (sombra.dy ?? 0),
      sombra.raioX,
      sombra.raioY,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.restore();
  }

  /**
 * A AURÉA DO CRISTAL, desenhada ANTES da sombra e do cristal.
 *
 * ## POR QUE SOBE DA PEDRA E NÃO É UMA BOLA
 *
 * A aura é a luz que sai DA pedra. Uma elipse redonda no meio dela lia como
 * mancha no chão — o jogador não lia "cristal brilhando", lia "pedra pintada".
 * A forma de vela que vai do pé para cima diz de onde a luz está saindo, e
 * ainda guarda o chão limpo em volta do cristal
 *
 * ## E POR QUE O GRADIENTE É FORTE NO PÉ E APAGA EM CIMA
 *
 * Porque é o caminho da luz. Quem vê o brilho nascer na base do cristal e
 * morrer antes da ponta entende que a luz SAI da pedra; um brilho mais forte
   * no meio da arte leria como uma cor colada nela
 *
 * ## E POR QUE O `scale` DO CONTEXTO, E NÃO UM `ellipse` ALTO
 *
 * Porque o `createRadialGradient` só faz círculo. Esticar o contexto antes de
 * desenhar é o que transforma o círculo em vela sem reescrever o gradiente —
 * e as coordenadas continuam em px de tela, que é o que o resto do renderer
 * usa
 */
drawAura(context, prop, map = null) {
  const aura = AURA_DO_CRISTAL[prop.type];

  if (!aura) return;

  /**
   * A AURA SOME NO MAPA QUE SEMBRA PROPS.
   *
   * A mesma lista que apaga a sombra. Um brilho de cristal num mapa de neve
   * seria luz sem fonte: não há cristal nenhum para brilhar
   */
  if (propSemSombra(prop.type, map)) return;

const type = PROP_TYPES[prop.type];
  const altura = type?.drawHeight ?? PROP_FRAME * PROP_SCALE;

  /**
   * O MEIO DA PEDRA, e é onde o brilho é mais forte.
   *
   * O jogador pediu o pico no meio da arte, atrás dela. É o que faz a aura
   * parecer luz que a pedra emite, e não uma mancha colada nela
   */
  const centroY = prop.y - altura * 0.45;

/**
 * O RAIO VERTICAL DO BRILHO.
 *
 * Vai do meio da pedra até a PONTA dela: `0.45 + 0.55 = 1.0` da altura. É o
 * que segura a aura dentro da pedra — com o raio maior, o brilho estouraria
 * acima da ponta e viraria a coluna de luz que o jogador reclamou
 */
const raioVertical = altura * 0.55;

  const meiaLargura = aura.raio * 0.55;

/**
 * O ESTICAMENTO DO CONTEXTO, e o cuidado que ele exige.
 *
 * O gradiente radial do canvas só faz círculo. Para virar a vela alta, o
 * contexto é esticado na vertical e o raio do gradiente é o MEIO LARGURA.
 *
 * ## E O ERGO QUE CAI NESSA CONTAGEM
 *
 * O centro de um gradiente radial é uma coordenada do espaço JÁ ESTICADO. A
 * primeira versão passou o deslocamento do meio da pedra direto, e o `scale`
 * multiplicou o deslocamento de novo: o brilho subiu muito mais que o
 * pretendido e a elipse, que tem o mesmo raio vertical, desceu abaixo do
 * chão. Por isso o `centroY` NUNCA entra aqui — o contexto é transladado
 * para ele, e o gradiente nasce na origem, que é zero por construção
 */
const esticamento = raioVertical / meiaLargura;

context.save();

context.translate(prop.x, centroY);
context.scale(1, esticamento);

/**
 * O CORTE NO PÉ DA PEDRA.
 *
 * ## POR QUE PRECISA DO CLIP E NÃO SÓ DO GRADIENTE
 *
 * Porque o gradiente é radial e redondo: ele desceria por baixo da pedra
 * a mesma facilidade com que sobe. Só que essa parte de baixo é invisível no
 * chão escuro — e nas cores fortes, com a aura inteira aparecendo, ela
 * virava um brilho deitado embaixo do cristal
 *
 * O `clip` é a garantia: o desenho só existe ACIMA de `prop.y`. Abaixo do pé
 * não há forma nenhuma, então não há como vazar
 *
 * E o limite é calculado no espaço esticado, que é o espaço em que o `clip`
 * `yDoPe` é onde a pedra começa, em pixels de tela
 * tem que estar na mesma unidade do gradiente
 */
const yDoPe = (prop.y - centroY) / esticamento;

const gradiente = context.createRadialGradient(0, 0, 0, 0, 0, meiaLargura);

gradiente.addColorStop(0, this.corDaAura(aura.cor, aura.forca));
gradiente.addColorStop(0.45, this.corDaAura(aura.cor, aura.forca * 0.55));
gradiente.addColorStop(1, this.corDaAura(aura.cor, 0));

context.fillStyle = gradiente;
context.beginPath();
context.rect(-meiaLargura, -meiaLargura, meiaLargura * 2, yDoPe + meiaLargura);
context.clip();

context.beginPath();
context.arc(0, 0, meiaLargura, 0, Math.PI * 2);
context.fill();

context.restore();
}

/**
 * O MESMO HEX, COM ALPHA.
 *
 * Canvas nao aceita `#rrggbbaa` em todo lugar, e jogar o alpha no gradiente
 * por cor seria reescrever o hex a mao em cada uma das tres paradas
 */
corDaAura(hex, alpha) {
  const limpo = hex.replace("#", "");
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

drawProp(context, prop, map = null) {
    const type = PROP_TYPES[prop.type];

    if (!type) return;

    /**
     * A FOLHA VEM DO MAPA.
     *
     * `propSheetFor` troca a arte do arbusto no mapa 2 e devolve a do
     * catalogo em todos os outros. O cache de imagens e por URL, entao
     * as duas artes convivem sem uma piscar na outra ao trocar de mapa
     */
    const image = this.imageFor(propSheetFor(prop.type, map));

    /**
     * Sem imagem nao ha o que desenhar, e chamar `drawImage` com `null`
     * levanta em vez de pular o prop. A arvore so aparece depois que a
     * folha carrega
     */
    if (!image) return;

    // a celula na arte: quadrada de 32 nos tipos antigos, e o tamanho
    // proprio da arvore
    const frameWidth = type.frameWidth ?? PROP_FRAME;
    const frameHeight = type.frameHeight ?? PROP_FRAME;

    // o tamanho NA TELA: os tipos antigos esticam a celula de 32px
    // pela escala do raio, e a arvore ja vem no tamanho do jogo
    const herdado =
      PROP_FRAME * PROP_SCALE * (type.radius / 26);

    const width = type.drawWidth ?? herdado;
    const height = type.drawHeight ?? herdado;

    const base = type.base ?? 0.78;

    context.drawImage(
      image,
      prop.variant * frameWidth,
      type.row * frameHeight,
      frameWidth,
      frameHeight,
      Math.round(prop.x - width / 2),
      Math.round(prop.y - height * base),
      Math.round(width),
      Math.round(height),
    );
  }

  collectVisible(props, view) {
    const visible = [];

    const startX = view.x - MARGIN;
    const startY = view.y - MARGIN;
    const endX = view.x + view.width + MARGIN;
    const endY = view.y + view.height + MARGIN;

    for (const prop of props) {
      if (
        prop.x < startX ||
        prop.x > endX ||
        prop.y < startY ||
        prop.y > endY
      ) {
        continue;
      }

      visible.push(prop);
    }

    return visible;
  }

  draw(context, props, view, map = null) {
    for (const prop of this.collectVisible(props, view)) {
      this.drawShadow(context, prop, map);
      this.drawProp(context, prop, map);
    }
  }

  visibleCount(props, view) {
    return this.collectVisible(props, view).length;
  }
}

export { PROP_VARIANTS };