import {
  PROP_FRAME,
  PROP_SHEET,
  PROP_SCALE,
  PROP_TYPES,
  PROP_VARIANTS,
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

  drawShadow(context, prop) {
    const scale = prop.radius / 26;

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
  }

  drawProp(context, prop) {
    const type = PROP_TYPES[prop.type];

    if (!type) return;

    const image = this.imageFor(type.sheet);

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

  draw(context, props, view) {
    for (const prop of this.collectVisible(props, view)) {
      this.drawShadow(context, prop);
      this.drawProp(context, prop);
    }
  }

  visibleCount(props, view) {
    return this.collectVisible(props, view).length;
  }
}

export { PROP_VARIANTS };
