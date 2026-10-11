/**
 * O MAPA DO TILED LIDO PARA O QUE O MOTOR ENTIENDE.
 *
 * ## POR QUE ISTO EXISTE E NAO UM IMPORT DIRETO
 *
 * Porque o `.tmj` do Tiled fala a lingua DELE: tile de 16px, `gid` com as
 * flags de espelhamento presas nos bits de cima, e o caminho da imagem do
 * tileset escrito em string. O motor fala outra: pixels de mundo, e nenhuma
 * ideia de `gid`
 *
 * Nenhuma das duas linguas esta errada, e nenhuma delas muda. O que este
 * arquivo faz e a traducao, uma vez, na carga do modulo — e o resto do jogo
 * nunca ve um `gid`
 *
 * ## POR QUE O TAMANHO DO MAPA SAI DAQUI, E NAO DO `base.js`
 *
 * Porque o `width`/`height` que o motor usa sao pixels de mundo, e a conta e
 * a do Tiled: 25 tiles de 16px. Se o `base.js` continuasse declaring
 * `1680 x 1176` a parte, o desenho do Tiled e a area andavel seriam duas
 * coisas diferentes e o jogador veria o fundo preto em volta do mapa
 *
 * E o inverso tambem vale: mexer no tamanho do tile no Tiled muda o tamanho
 * do mapa no jogo, sem ninguem editar codigo
 */

/** O bit de espelhamento horizontal do Tiled. */
export const FLIP_HORIZONTAL = 0x80000000;

/** O bit de espelhamento vertical do Tiled. */
export const FLIP_VERTICAL = 0x40000000;

/** O bit de espelhamento na diagonal do Tiled. */
export const FLIP_DIAGONAL = 0x20000000;

/**
 * OS TRES BITS DE FLAG, e nada mais.
 *
 * O `gid` do Tiled e um inteiro de 32 bits: os tres de cima sao flags e o
 * resto e o numero do tile. Sem esta mascara, o tile `200` espelhado nos dois
 * eixos chegaria aqui como `3221225688` — um indice de imagem tres bilhoes
 * e acima, que o `drawImage` transformaria em largura negativa
 */
const MASCARA_FLAGS = FLIP_HORIZONTAL | FLIP_VERTICAL | FLIP_DIAGONAL;
const MASCARA_GID = ~MASCARA_FLAGS >>> 0;

/**
 * O `gid` SEM AS FLAGS.
 *
 * E o numero que a camada guarda. A mascara vem de `~MASCARA_FLAGS >>> 0`
 * porque em JavaScript `~` devolve inteiro com sinal, e sem o `>>> 0` o
 * resultado seria negativo — e um indice negativo na imagem é outra coisa
 * quebrada, só mais silenciosa
 */
export function gidDe(gidComFlags) {
  return gidComFlags & MASCARA_GID;
}

/** As flags do `gid`, separado do numero do tile. */
export function flagsDe(gidComFlags) {
  return gidComFlags & MASCARA_FLAGS;
}

/**
 * O MAPA DO TILED, PRONTO PARA O MOTOR.
 *
 * ## POR QUE AS CAMADAS DE TILE SAO AS UNICAS QUE INTERESSAM
 *
 * Porque o `.tmj` tem tres camadas, todas `tilelayer`. `objectlayer` — que e
 * onde descreveriam NPCs, portais e solidos — nao existe nenhuma aqui: esses
 * tres continuam vindo do catalogo (`BASE_NPCS`, `BASE_PORTAIS`), que e de
 * onde o resto do jogo tira
 *
 * `imagelayer` tambem e ignorada, e nao por esquecimento: e uma foto do mapa
 * inteiro, que aqui viraria uma segunda copia da arte do tileset
 *
 * @param {object} tmj o JSON do mapa, como veio do arquivo
 * @param {object} imagens `nomeDoTileset -> url` resolvida pelo bundler
 */
export function lerMapaTiled(tmj, { imagens = {}, tilesets = {} } = {}) {
  if (!tmj || typeof tmj !== "object") {
    throw new TypeError("lerMapaTiled: o mapa do Tiled veio vazio");
  }

  const tileWidth = tmj.tilewidth ?? 16;
  const tileHeight = tmj.tileheight ?? 16;

  const tileset = lerTileset(tmj.tilesets?.[0], imagens, tilesets);

  const camadas = (tmj.layers ?? [])
    .filter((camada) => camada.type === "tilelayer" && Array.isArray(camada.data))
    .filter((camada) => camada.visible !== false)
    .map((camada) =>
      lerCamada(camada, tileset),
    );

  return {
    tileWidth,
    tileHeight,

    /**
     * O MAPA EM PIXELS DE MUNDO.
     *
     * E a unica conta que o Tiled faz pelo mapa inteiro: colunas vezes a
     * largura do tile. `width` e `height` do motor sao exatamente estes dois
     * numeros
     */
    width: (tmj.width ?? 0) * tileWidth,
    height: (tmj.height ?? 0) * tileHeight,

    tileset,
    layers: camadas,
  };
}

/**
 * O TILESET, com a imagem apontando para a url que o bundler resolveu.
 *
 * ## POR QUE A URL VEM DE FORA E NAO DO JSON
 *
 * Porque o `.tmj` carrega `"image": "../assets/tilesets/Walls_street.png"`
 * como texto, e um caminho relativo em string nao passa pelo Vite: ele nao
 * entra no grafo de modulos e nao seria copiado para `dist`. Quem resolve o
 * caminho e o `import`/`new URL` do lado do JS, e o mapa so diz QUAL imagem
 *
 * Sem o nome bater, o tileset entra sem imagem e o mapa sai em branco — e a
 * falha precisa dizer o nome, senao o sintoma e "o mapa sumiu"
 *
 * ## E O TILESET EXTERNO, QUE VEM SO COM `source`
 *
 * Quando o Tiled esta com "Embed Tilesets" desligado, o mapa carrega
 *
 *     "tilesets": [{ "firstgid": 1, "source": "dungeon.tsx" }]
 *
 * e nao tem nem nome nem colunas: o que descreve a folha esta no outro
 * arquivo. O parametro `tilesets` existe para o codigo fornecer essa
 * parte, e a chave e o NOME DO ARQUIVO — que e o que o `.tmj` traz
 *
 * ## POR QUE ISTO VEM DO CODIGO E NAO DE UM `.tsx` LIDO EM TEMPO DE EXECUCAO
 *
 * Porque o `.tsx` e XML, e o navegador nao le XML de `src/assets` sem um
 * fetch. E porque editar o `.tmj` na mao nao sobrevive: o Tiled regrava o
 * arquivo inteiro no proximo save, e o `source` volta a ser so um nome
 *
 * O preco e o codigo precisar concordar com a folha. Mudou o tileset no
 * Tiled, o `lerMapaTiled` recusa com o nome do tileset na mensagem, em vez
 * de desenhar metade
 */
function lerTileset(definicao, imagens, tilesets = {}) {
  if (!definicao) return null;

  /**
   * O TILESET DE FORA, e o que o mapa esta TEMENDO que nao traz.
   *
   * A busca e pelo `source` primeiro porque e o unico identificador que o
   * mapa carrega nesse formato, e pelo `name` depois para o mapa embutido
   */
  const declarado =
    (definicao.source ? tilesets[definicao.source] : null) ??
    (definicao.name ? tilesets[definicao.name] : null) ??
    definicao;

  const url = imagens[declarado.name] ?? null;

  if (!url) {
    throw new Error(
      `lerMapaTiled: o tileset "${declarado.name}" nao tem imagem registrada. ` +
        "Passe { imagens: { [nome]: url } } com a url vinda de new URL(...)",
    );
  }

  return {
    name: declarado.name,
    url,
    columns: declarado.columns ?? 1,
    tileWidth: declarado.tilewidth ?? 16,
    tileHeight: declarado.tileheight ?? 16,
    tilecount: declarado.tilecount ?? 0,
    margin: declarado.margin ?? 0,
    spacing: declarado.spacing ?? 0,
    /**
     * O `firstgid` vem do MAPA e nao do tileset declarado.
     *
     * O `firstgid` diz em que numero de tile do mapa comeca ESTE tileset, e
     * ele pertence ao mapa: dois tilesets na mesma lista contam os gids em
     * sequencia. Pegar do arquivo `.tsx` seria o numero local dele, e o
     * primeiro tile do mapa apontaria para a linha errada da imagem
     */
    firstgid: definicao.firstgid ?? 1,
    imageWidth: declarado.imagewidth ?? 0,
    imageHeight: declarado.imageheight ?? 0,
  };
}

/**
 * UMA CAMADA, com o `gid` limpo e as flags separadas.
 *
 * ## POR QUE SEPARAR AGORA E NAO NO DESENHO
 *
 * Porque a separacao e uma conta por tile, e o desenho roda a cada quadro.
 * Feita uma vez na carga, o quadro so le dois `Int32Array` — e o mapa da base
 * sao 625 tiles por camada, tres camadas, mil e oitocentos e poucas contas por
 * quadro que nao precisavam existir
 *
 * ## POR QUE O `gid` VIRA `-1` E NAO `0`
 *
 * Porque no Tiled `0` ja e "tile vazio", e o motor usa `-1` para dizer a
 * mesma coisa sem depender de um numero que o Tiled reserva. Um `0` solto
 * passaria pela conta e viraria o tile de indice 0 da imagem — o primeiro
 * tile da folha, que e uma parede escura
 */
function lerCamada(camada, tileset) {
  const cols = camada.width ?? 0;
  const rows = camada.height ?? 0;
  const total = cols * rows;

  const gids = new Int32Array(total);
  const flags = new Int32Array(total);

  for (let indice = 0; indice < total; indice += 1) {
    const bruto = camada.data[indice] ?? 0;
    const gid = bruto === 0 ? -1 : gidDe(bruto);

    gids[indice] = gid;
    flags[indice] = bruto === 0 ? 0 : flagsDe(bruto);
  }

  return {
    name: camada.name,
    opacity: camada.opacity ?? 1,
    cols,
    rows,
    gids,
    flags,
    tileset,
  };
}