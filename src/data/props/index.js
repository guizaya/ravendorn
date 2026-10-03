
export const PROP_FRAME = 32;
export const PROP_VARIANTS = 4;
export const PROP_SCALE = 2;

/**
 * A URL da folha de props.
 *
 * `new URL(..., import.meta.url)` em vez de `import url from
 * "props.png"`: o Node resolve isso para uma string sem abrir o
 * arquivo (o `import` de .png matava o processo do servidor com
 * ERR_UNKNOWN_FILE_EXTENSION) e o Vite ainda reescreve para o
 * asset bundlado. O jogo continua mostrando a mesma imagem.
 */
export const PROP_SHEET = new URL(
  "../../assets/props/props.png",
  import.meta.url,
).href;

/**
 * A folha da arvore do vale, separada da `props.png`.
 *
 * Sao duas artes de estilos diferentes: a `props.png` e pixel art de
 * 32px dos cinco tipos antigos, e a arvore e uma ilustracao pintada de
 * 96x119. Nao da para juntar as duas em uma folha sem fazer a arvore
 * virar pixel art, entao cada tipo carrega a sua
 *
 * Esta declarado ANTES do `PROP_TYPES` de proposito: o tipo `arvore`
 * guarda a URL no proprio objeto, e um `const` nao pode ser lido antes
 * de ser inicializado
 */
export const ARVORE_SHEET = new URL(
  "../../assets/props/arvore.png",
  import.meta.url,
).href;

export const PROP_TYPES = {
  /**
   * A ARVORE DO VALE: a unica prop que o mapa usa hoje.
   *
   * A arte nao vem da `props.png`. Aquela e uma folha de 32px com cinco
   * tipos, e esta e uma unica arvore pintada de 1600px. Encolhida e
   * cortada pelo `tools/gerar-arvore-prop.mjs`, que deixa 96x119
   *
   * `drawWidth`/`drawHeight` sao o tamanho NA TELA, e `frameWidth`/
   * `frameHeight` o tamanho no arquivo. Sao a mesma coisa aqui porque a
   * imagem ja foi reduzida para o tamanho do jogo; nos tipos antigos os
   * dois divergem, porque a celula de 32px e esticada na hora de desenhar
   *
   * O `collider` e o tronco, medido: a base do tronco tem 22px de
   * largura na arte reduzida, entao o raio e 11. Usar a copa inteira
   * (96px) faria o jogador parar a um metro da arvore, do lado de dentro
   * da sombra, sem ver o que barra
   */
  arvore: {
    id: "arvore",
    row: 0,
    blocking: true,
    radius: 46,
    collider: 11,
    tint: "#2a4a33",

    /**
     * O minimapa pinta a prop de verde quando `isTree` e verdadeiro, e
     * cinza de pedra quando nao. Antes isso vinha de
     * `tipo.startsWith("tree")`, que era uma aposta no nome em ingles
     * e nao encontraria "arvore" — a arvore sairia no minimapa com a
     * cor da pedra
     */
    isTree: true,

    sheet: ARVORE_SHEET,
    frameWidth: 96,
    frameHeight: 119,
    drawWidth: 96,
    drawHeight: 119,
    // uma unica imagem, sem variantes para trocar entre copias
    variants: 1,

    /**
     * A base da arte e o pe do tronco, e ela fica EM `y`.
     *
     * Os tipos antigos usam 0.78 porque a folha de 32px tem a arvore
     * desenhada com folga abaixo. Esta nao tem: o tronco encosta na
     * ultima linha. Com 0.78 o tronco terminaria 26px acima do ponto de
     * colisao e a arvore pareceria flutuar
     */
    base: 1,
  },

  treeSmall: {
    id: "treeSmall",
    row: 0,
    blocking: true,
    radius: 20,
    collider: 9,
    tint: "#2a4a33",
  },
  treeMedium: {
    id: "treeMedium",
    row: 1,
    blocking: true,
    radius: 26,
    collider: 11,
    tint: "#2a4a33",
  },
  treeLarge: {
    id: "treeLarge",
    row: 2,
    blocking: true,
    radius: 34,
    collider: 14,
    tint: "#243f2d",
  },
  rock: {
    id: "rock",
    row: 3,
    blocking: true,
    radius: 18,
    collider: 15,
    tint: "#4e575c",
  },
  bush: {
    id: "bush",
    row: 4,
    blocking: false,
    radius: 12,
    collider: 0,
    tint: "#2c4734",
  },
};

export const PROP_ORDER = [
  "arvore",
  "treeSmall",
  "treeMedium",
  "treeLarge",
  "rock",
  "bush",
];

export const BLOCKING_PROP_IDS = PROP_ORDER.filter(
  (id) => PROP_TYPES[id].blocking,
);

export const DECORATIVE_PROP_IDS = PROP_ORDER.filter(
  (id) => !PROP_TYPES[id].blocking,
);

export function getPropType(id) {
  return PROP_TYPES[id] ?? null;
}

export function isBlockingProp(id) {
  return Boolean(PROP_TYPES[id]?.blocking);
}

/**
 * Quantas variantes um tipo tem.
 *
 * A folha antiga tem quatro copias por linha, e o sorteio usava esse 4
 * fixo. A arvore e UMA imagem so, e sortear um indice de 0 a 3 nela
 * buscaria fora do arquivo — o `drawImage` pegaria vazio e a arvore
 * sumiria em tres de cada quatro
 */
export function propVariantCount(type) {
  return type?.variants ?? PROP_VARIANTS;
}
