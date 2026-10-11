
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

/**
 * A FOLHA DO ARBUSTO, que e a sebe do mapa 1.
 *
 * Mesma historia da arvore: uma arte pintada grande, reduzida pelo
 * `tools/gerar-arbusto-prop.mjs` para 96x93. Fica em arquivo separado
 * porque a `props.png` e de 32px e esticaria o arbusto para pixel art
 *
 * O nome do arquivo gerado tem o sufixo `_prop` de proposito: o
 * `arbusto.png` de 1254px continua no lugar como a MATERIA PRIMA, e
 * sobrescreve-lo com a versao reduzida destruiria a origem de quem
 * quiser regerar em outro tamanho
 */
export const ARBUSTO_SHEET = new URL(
  "../../assets/props/arbusto_prop.png",
  import.meta.url,
).href;

/**
 * O ARBUSTO DO MAPA 2, que e uma sebe de neve com folha vermelha.
 *
 * ## POR QUE EXISTE UM ARQUIVO REDUZIDO
 *
 * A arte original (`arbusto-vermelho-neve.png`, 1600x1600) e a MATERIA
 * PRIMA, e nao pode ser desenhada direto: o `PROP_TYPES.arbusto` recorta
 * uma celula de `frameWidth` x `frameHeight` a partir do canto superior
 * esquerdo, e numa arte de 1600px esse canto e MARGEM TRANSPARENTE —
 * o arbusto saia invisivel
 *
 * O mesmo caminho que o arbusto do vale e a arvore ja usavam: cortar a
 * caixa opaca e reduzir para o tamanho do jogo. O original continua
 * intacto para quem quiser regerar
 *
 * ## O MESMO TAMANHO DO ARBUSTO DO VALE
 *
 * 67x65, e nao o tamanho proprio da arte. A sebe e uma fileira de props
 * com o mesmo `y`, e `base: 1` apoia o pe do arbusto nesse ponto: com
 * dois tamanhos diferentes, a fileira do mapa 2 ficaria desalinhada da
 * do mapa 1 e a silhueta da cerca mudaria de proporcao
 */
export const ARBUSTO_NEVE_SHEET = new URL(
  "../../assets/props/arbusto_neve_prop.png",
  import.meta.url,
).href;

/**
 * AS FOLHAS DOS CRISTAIS DO VALE 1, uma por raridade.
 *
 * ## POR QUE CADA RARIDADE TEM A SUA, E NAO UMA FOLHA COM QUATRO LINHAS
 *
 * Porque sao quatro ARTES DIFERENTES, nao quatro variacoes da mesma. A
 * silhueta muda entre elas — a do lendario e 40px mais larga e 37px mais
 * baixa que a do comum — e a cor tambem. Uma folha so obrigaria as quatro
 * a terem a mesma caixa, e ou o cristal comum esticava ou o lendario
 * perdia pixels
 *
 * ## POR QUE CADA UMA E UMA IMAGEM SOLTA, E NAO UMA LINHA DE 32px
 *
 * Porque estas nao sao pixel art de 32px como a `props.png`. Sao
 * sprites pintados de 1600px, como a arvore e o arbusto, e cada um ja
 * foi cortado, reduzido para o tamanho do jogo e salvo em PNG com
 * transparência pelo `tools/gerar-cristal-prop.py`
 *
 * E um PNG, e nao o JPEG que o usuario entregou, por um motivo tecnico
 * e nao artistico: JPEG nao tem canal alfa. O `drawImage` de um JPEG
 * mostraria o retangulo branco em volta do cristal, que e 71% da imagem
 * da arte original
 *
 * O nome do arquivo de origem era `common`, `rare`, `epic` e
 * `legendary`, em ingles. Aqui virou `comum`, `raro`, `epico` e
 * `lendario`, porque e assim que o resto do catalogo de props se chama
 */
export const CRISTAL_COMUM_SHEET = new URL(
  "../../assets/props/cristal_comum_prop.png",
  import.meta.url,
).href;

export const CRISTAL_RARO_SHEET = new URL(
  "../../assets/props/cristal_raro_prop.png",
  import.meta.url,
).href;

export const CRISTAL_EPICO_SHEET = new URL(
  "../../assets/props/cristal_epico_prop.png",
  import.meta.url,
).href;

export const CRISTAL_LENDARIO_SHEET = new URL(
  "../../assets/props/cristal_lendario_prop.png",
  import.meta.url,
).href;

/**
 * A FOLHA DE CADA TIPO, POR MAPA.
 *
 * A chave e o mapa; o que nao estiver aqui usa a folha do `PROP_TYPES`.
 * O arbusto e o unico tipo com duas artes no projeto — o do vale e o
 * de neve — e o mapeamento fica no dado, junto do resto do catalogo
 * de props, e nao espalhado no renderer
 */
export const PROP_SHEET_POR_MAPA = {
  map_2: {
    arbusto: ARBUSTO_NEVE_SHEET,
  },
};

/** A folha deste tipo NESTE mapa. Cai na do catalogo sem declaracao. */
export function propSheetFor(typeId, map) {
  return (
    PROP_SHEET_POR_MAPA[map?.id]?.[typeId] ??
    PROP_TYPES[typeId]?.sheet ??
    null
  );
}

/**
 * OS TIPOS QUE NAO DESENHAM SOMBRA NESTE MAPA.
 *
 * A sombra no chao e uma elipse preta fixa. Na neve ela vira uma mancha
 * que nao segue a luz do cenario e denuncia o que e arte sobre o que e
 * chao — o arbusto e a arvore do mapa 2 ficam sem ela
 *
 * E por TIPO e nao "o mapa inteiro sem sombra": pedra e toco continuam
 * com a sombra, que e o que da assentamento ao resto do cenario
 */
export function propSemSombra(typeId, map) {
  const semSombra = map?.propsSemSombra;

  if (!Array.isArray(semSombra)) return false;

  return semSombra.includes(typeId);
}

export const PROP_TYPES = {
  /**
   * O ARBUSTO DA SEBE: a props que segura o jogador dentro dos campos.
   *
   * Este e o UNICO outro tipo que carrega folha propria, e a diferenca do
   * `bush` antigo e a que importa: aquele e pixel art de 32px e tem
   * `blocking: false`, ou seja, o jogador atravessava ele semuestr
   *
   * Aqui o `collider` e o que segura o jogador. O `radius` e a footprint
   * para o sorteio e para o minimapa; o `collider` e a caixa de colisao
   * de verdade, e e ela que fecha a passagem
   */
  arbusto: {
    id: "arbusto",
    row: 0,
    blocking: true,
    radius: 48,
    collider: 14,
    tint: "#2c4734",

    /**
     * `isTree` e falso de proposito: e verde no minimapa como pedra. A
     * sebe e um obstaculo fixo e desenhado, e nao uma arvore que o
     * jogador associaria a "lugar de madeira"
     */
    isTree: false,

    sheet: ARBUSTO_SHEET,

    /**
     * 67x65 e a arte depois do corte e da reducao, e nao um numero
     * redondo: o `gerar-arbusto-prop.mjs` calcula a altura pela proporcao
     * da caixa opaca da origem, que e 633x613 — arredondar para 64 daria
     * uma linha de corte a mais no rodape e o arbusto perderia a base
     *
     * O `collider` e `14` e NAO acompanha esta reducao, e e de proposito:
     * ele e o que segura o jogador, e a arte e so o que se ve. Baixar o
     * collider junto abriria a sebe — a folga passaria de 32 para 40px e
     * o jogador passaria raspando
     */
    frameWidth: 67,
    frameHeight: 65,
    drawWidth: 67,
    drawHeight: 65,
    variants: 1,

    /**
     * A base e o PE do arbusto, e ele fica EM `y` — igual a arvore.
     *
     * A sebe e uma linha de y IGUAL para todas as copias, entao qualquer
     * valor diferente de 1 desalinharia a fileira em degraus, e um muro
     * com degraus vira uma escada por onde o jogador sobe
     */
    base: 1,
  },

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

  /**
   * OS CRISTAIS DO VALE 1, um tipo por raridade.
   *
   * Sao quatro tipos, e nao um tipo com quatro variacoes, por causa do
   * que a variante e no `PropRenderer`: a coluna da folha. Uma variante
   * escolhe um TRECHO DA MESMA ARTE, entao as quatro raridades teriam de
   * ter a mesma silhueta e a mesma caixa. Aqui cada uma tem arte, largura
   * e altura proprias
   *
   * ## O QUE CRESCE COM A RARIDADE, E POR QUE SAO DOIS NUMEROS
   *
   * A altura na tela (90 -> 120 -> 150 -> 180) e o que o jogador le sem
   * ler nada: um cristal de 180px num campo de 90px se anuncia sozinho
   *
   * O `radius` e o `collider` NAO sao a mesma coisa, e a diferenca e o que
   * decide se o campo e agradavel de andar:
   *
   * - `radius` e a pegada, e e ela que mede a distancia entre um cristal
   *   e outro no sorteio, o tamanho da sombra e o ponto do minimapa. Vale
   *   meia largura da arte, que e a conta da arvore (96px de arte, 46 de
   *   raio)
   *
   * - `collider` e o que barra o jogador, e e menor de proposito. A arte
   *   tem 69% de borda vazia em volta e a base e so o terco de baixo: com
   *   o collider na largura toda, o jogador pararia a um metro de um
   *   cristal que parece longe, do lado de dentro da sombra, sem ver o
   *   que barra. E a mesma razao do tronco de 11px da arvore
   *
   * ## `base: 1`, E NAO OS 0.78 DOS TIPOS ANTIGOS
   *
   * Porque o pe do cristal encosta na ultima linha da arte. Com 0.78 a
   * base flutuaria 20px acima do ponto de colisao, e o jogador pararia no
   * vazio embaixo do cristal
   */
  cristal_comum: {
    id: "cristal_comum",
    row: 0,
    blocking: true,
    radius: 34,
    collider: 22,
    tint: "#8a8f96",
    isTree: false,
    sheet: CRISTAL_COMUM_SHEET,
    frameWidth: 69,
    frameHeight: 90,
    drawWidth: 69,
    drawHeight: 90,
    variants: 1,
    base: 1,

    /** barra o jogador na borda da arte, e nao num quadrado na base */
    solidoNaArte: true,

    /** mineravel: 5 batidas de 10s, 50s no total */
    mineravel: true,
    batidas: 5,
  },
  cristal_raro: {
    id: "cristal_raro",
    row: 0,
    blocking: true,
    radius: 45,
    collider: 28,
    tint: "#2f8fd0",
    isTree: false,
    sheet: CRISTAL_RARO_SHEET,
    frameWidth: 91,
    frameHeight: 120,
    drawWidth: 91,
    drawHeight: 120,
    variants: 1,
    base: 1,
    solidoNaArte: true,
    mineravel: true,
    batidas: 9,
  },
  cristal_epico: {
    id: "cristal_epico",
    row: 0,
    blocking: true,
    radius: 57,
    collider: 34,
    tint: "#c02b3f",
    isTree: false,
    sheet: CRISTAL_EPICO_SHEET,
    frameWidth: 115,
    frameHeight: 150,
    drawWidth: 115,
    drawHeight: 150,
    variants: 1,
    base: 1,
    solidoNaArte: true,
    mineravel: true,
    batidas: 14,
  },
  cristal_lendario: {
    id: "cristal_lendario",
    row: 0,
    blocking: true,
    radius: 69,
    collider: 40,
    tint: "#d8a93a",
    isTree: false,
    sheet: CRISTAL_LENDARIO_SHEET,
    frameWidth: 139,
    frameHeight: 180,
    drawWidth: 139,
    drawHeight: 180,
    variants: 1,
    base: 1,
    solidoNaArte: true,
    mineravel: true,
    batidas: 20,
  },
};

export const PROP_ORDER = [
  "arvore",
  "arbusto",
  "treeSmall",
  "treeMedium",
  "treeLarge",
  "rock",
  "bush",
  // os cristais do vale 1, do mais comum para o mais raro
  "cristal_comum",
  "cristal_raro",
  "cristal_epico",
  "cristal_lendario",
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
