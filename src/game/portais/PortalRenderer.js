import {
  PORTAL_SHEETS,
  PORTAL_SIZE,
  sheetFor,
} from "../../data/portais/index.js";

/**
 * O MARGEM DE CULL
 *
 * O portal e de 192px, entao a folga de 32px que o `TerrainRenderer`
 * usa nao daria conta de um sprite que comeca 96px antes da borda da tela
 */
const MARGEM = 96;

function loadImage(src) {
  if (typeof Image === "undefined") return null;

  const image = new Image();

  image.src = src;

  return image;
}

/**
 * O desenho dos portais.
 *
 * E um `drawImage` por portal, sem patch e sem padrao: sao DOIS no
 * mapa. O cull existe para o dia em que houver mais, e para o `drawMap`
 * poder passar a lista inteira sem pensar nisso
 */
export class PortalRenderer {
  constructor() {
    /**
     * Uma imagem por folha, e nao uma so
     *
     * Os dois portais tem artes diferentes — o vortice roxo e o de fogo
     * — entao uma folha so nao da conta dos dois
     *
     * `this.images` e o cache por URL, porque e ela que identifica a
     * folha. Sem ele, os dois portais do mesmo tipo buscariam a mesma
     * imagem a cada quadro
     */
    this.images = new Map();

    for (const folha of Object.values(PORTAL_SHEETS)) {
      this.images.set(folha, loadImage(folha));
    }

    // a primeira folha, para o `isReady` ter o que olhar
    this.image = this.images.get(PORTAL_SHEETS.pantano);
  }

  /**
   * A imagem de um portal.
   *
   * `sheetFor` cai na folha do Pantano quando o portal nao declara uma,
   * entao este metodo nunca devolve `undefined` para um portal do
   * catalogo
   */
  imageFor(portal) {
    return this.images.get(sheetFor(portal)) ?? null;
  }

  isReady() {
    for (const image of this.images.values()) {
      if (
        image === null ||
        image.complete !== true
      ) {
        return false;
      }
    }

    return this.images.size > 0;
  }

  /**
   * O retangulo de um portal, ancorado pelo CENTRO.
   *
   * Centro e nao a base como nos props: o aro e redondo e deitado no
   * chao, entao o ponto do mapa e o meio do circulo. Ancorar pela base
   * empurraria o portal metade do tamanho para cima do lugar pedido
   */
  rectOf(portal) {
    const size = portal.size ?? PORTAL_SIZE;

    return {
      x: portal.x - size / 2,
      y: portal.y - size / 2,
      width: size,
      height: size,
    };
  }

  drawPortal(context, portal) {
    const image = this.imageFor(portal);

    if (!image) return false;

    const rect = this.rectOf(portal);

    context.drawImage(
      image,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );

    return true;
  }

  /**
   * O portal esta pelo menos inteiro na tela?
   *
   * `collectVisible` empurra pela folga e o portal e maior que ela, entao
   * um portal pode estar na lista e ainda assim estar completamente fora
   * do que o jogador ve
   */
  visible(portal, view) {
    const rect = this.rectOf(portal);

    return !(
      rect.x > view.x + view.width ||
      rect.y > view.y + view.height ||
      rect.x + rect.width < view.x ||
      rect.y + rect.height < view.y
    );
  }

  collectVisible(portals, view) {
    return portals.filter(
      (portal) => !portal.oculto && this.visible(portal, view),
    );
  }

  draw(context, portals, view) {
    for (const portal of this.collectVisible(portals, view)) {
      this.drawPortal(context, portal);
    }
  }

  /**
   * AS PASSAGENS SEM ARTE NAO DESENHAM NADA.
   *
   * ## POR QUE O CAMPO VEM DO DADO E NAO DE UMA LISTA AQUI
   *
   * Porque "esta passagem nao tem imagem" e uma propriedade DA PASSAGEM, e
   * nao uma excecao deste renderer. O portal da base virou uma passagem com
   * arte substituida pela luz na borda do mapa: se a lista de "nao desenha"
   * vivesse aqui, o proximo que inventasse uma passagem com arte teria que
   * vir arrumar este arquivo
   */
}