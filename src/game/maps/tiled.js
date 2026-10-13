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
 * "ESTE TILE NAO PERTENCE A NENHUMA FOLHA".
 *
 * ## POR QUE E UM NUMERO E NAO `-1`
 *
 * Porque `folhaDe` e um `Uint16Array`, e nele nao existe o `-1`. O Tiled
 * reserva o `0` para o tile de indice zero — a primeira arte da folha, que na
 * base e uma parede escura — entao o "nao ha folha" tem de ser algum numero
 * que nenhum indice real atinge
 *
 * E por que e `0xFFFF` e nao `999`: um indice so e valido de 0 ate
 * `folhas.length - 1`. Qualquer valor acima disso esta fora da lista por
 * construcao, e continua fora mesmo se o autor declarar mil tilesets
 */
const SEM_FOLHA = 0xffff;

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

  /**
   * TODOS OS TILESETS DO MAPA, e nao so o primeiro.
   *
   * ## POR QUE DEIXOU DE SER UM
   *
   * Porque um `.tmj` do Tiled aceita quantos tilesets voce quiser, cada um
   * com a sua faixa de `gid`. A base tem dois: o `chao` comeca em 1 e tem 16
   * tiles, e o `estatus1` comeca em 17 e tem 1
   *
   * Ler so o `[0]` e ler UM tileset e chamar de todos: o tile de `gid 17` era
   * procurado como se fosse o 17 do chao, que tem 16 tiles — caia fora da
   * folha e a celula era pulada em silencio. Era o sintoma de "adicionei a arte
   * no Tiled e ela nao aparece"
   *
   * ## E A ORDEM IMPORTA
   *
   * O `firstgid` de cada um vira a FRONTEIRA da faixa dele: um `gid 17`
   * pertence a quem comecou em 17, e nao a quem comecou em 1. Por isso a
   * lista sai ordenada por `firstgid` — sem isso, o primeiro tileset da pasta
   * engoliria a faixa dos outros
   *
   * ## E O MAPA QUE SO TEM UM VOLTA A SER EXATAMENTE O QUE ERA
   *
   * Com uma folha, o `folhas[0]` e o `tileset` singular, e o desenho usa o
   * mesmo caminho de antes. Vale e a arena do hulk, e o vale
   */
  const declarados = (tmj.tilesets ?? [])
    .filter(Boolean)
    .sort((a, b) => (a.firstgid ?? 1) - (b.firstgid ?? 1));

  const folhas = declarados.map((definicao) =>
    lerTileset(definicao, imagens, tilesets),
  );

  /**
   * A FOLHA DE CADA `gid`, resolvida UMA VEZ na carga.
   *
   * E aqui, e nao no desenho, porque o desenho pergunta sessenta vezes por
   * segundo: uma busca binaria por tile num mapa de 468 celulas seriam 28080
   * comparacoes por quadro, e o ganho seria zero. Um `Uint16Array` de indice
   * por celula resolve na leitura e o desenho so le o numero
   */
  const indiceDaFolha = (gid) => {
    let baixo = 0;
    let alto = folhas.length - 1;

    while (baixo <= alto) {
      const meio = (baixo + alto) >> 1;
      const folha = folhas[meio];

      if (!folha) return SEM_FOLHA;

      if (gid < folha.firstgid) {
        alto = meio - 1;
      } else if (meio === folhas.length - 1 || gid < folhas[meio + 1].firstgid) {
        return meio;
      } else {
        baixo = meio + 1;
      }
    }

    return SEM_FOLHA;
  };

  const camadas = (tmj.layers ?? [])
    .filter((camada) => camada.type === "tilelayer" && Array.isArray(camada.data))
    .filter((camada) => camada.visible !== false)
    .map((camada) =>
      lerCamada(camada, folhas, indiceDaFolha, tileWidth, tileHeight),
    );

  /**
   * AS FOLHAS SEM IMAGEM, uma vez por leitura.
   *
   * ## POR QUE ISTO E `info` E NAO `error`
   *
   * Porque nao impede o desenho: cada tile pula a celula quando a folha dele
   * nao carregou, e as folhas com imagem continuam desenhando. Um tileset
   * declarado sem imagem e um estado NORMAL — o autor pintou com ele no Tiled
   * e a imagem ficou fora
   *
   * E por leitura, e nao por quadro: quem chama isto tem cache, e repetir a
   * cada quadro enche o console em segundos
   */
  const semImagem = folhas
    .filter((folha) => !folha?.url)
    .map((folha) => folha.name);

  if (semImagem.length) {
    console.info(
      `[tiled] ${folhas.length} tileset(s) declarados, ${semImagem.length} sem imagem: ` +
        `${semImagem.join(", ")}. As celulas desses tiles ficam vazias.`,
    );
  }

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

    /**
     * A PRIMEIRA FOLHA, que e o tileset do mapa.
     *
     * ## POR QUE ESTE CAMPO CONTINUA AQUI
     *
     * Porque ele responde "o mapa tem arte de chao?", e a resposta precisa
     * ser UMA para o mapa inteiro. O `minimapaTiled` e o `GameEngine` leem
     * este campo, e nenhum dos dois sabe de que tileset vem o proximo tile
     *
     * ## E A LISTA COMPLETA AO LADO
     *
     * Quem precisa da folha certa por celula — o `TileMapRenderer` — le
     * `folhas`, nao este campo. Este e o resumo, e nao a fonte
     */
    tileset: folhas[0] ?? null,
    folhas,
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

  /**
   * O NOME DA FOLHA, e a chave de `imagens`.
   *
   * ## POR QUE ELE NAO PODE VIR SO DO `declarado`
   *
   * Porque o `source` do `.tmj` traz o nome do ARQUIVO, com `.tsx`, e o
   * `name` dentro dele traz o nome SEM a extensao. Nenhuma chave de
   * `imagens` tem `.tsx`, entao o `source` nunca casa com uma delas
   *
   * E o `?? definicao` acima e o caso perigoso: quando a busca pelo `.tsx`
   * falha — um tileset novo que o autor ainda nao registrou no codigo — o
   * `declarado` vira o `{ firstgid, source }` cru do `.tmj`, que NAO tem
   * `name`. A folha saia com `name: undefined`, nenhuma imagem casava, e o
   * mapa INTEIRO ficava sem chao
   *
   * O plano B tira o caminho e o `.tsx` do `source`, e sobra o nome que o
   * autor criou no Tiled — que e como a imagem foi registrada
   */
  const nome =
    declarado.name ||
    String(definicao.source ?? "")
      .split(/[\\/]/)
      .pop()
      .replace(/\.tsx$/i, "");

  /**
   * A URL, e `null` quando a imagem nao foi declarada.
   *
   * ## POR QUE ISTO DEIXOU DE LANÇAR
   *
   * Porque um tileset sem imagem e um estado NORMAL, e nao um erro de
   * programacao: o autor pintou com ele no Tiled e a imagem ficou fora do
   * repositorio
   *
   * Lancar aqui derrubava o mapa INTEIRO. Com um tileset so, o `catch` do
   * `tiledDoMapa` segurava e o mapa caia no terreno — ainda desenho. Com
   * varios, um unico tileset sem imagem derrubava a leitura toda, e o
   * terreno nao era desenhado: o mapa virava preto
   *
   * O aviso sai uma vez, em `lerMapaTiled`, e cada tile pula a celula dele
   * quando a folha nao carregou
   */
  const url = imagens[nome] ?? null;

  return {
    name: nome,
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
 *
 * ## E O TILESET DE CADA TILE, JA RESOLVIDO
 *
 * E um `Uint16Array` de indice na lista de folhas, e nao o objeto inteiro: um
 * indice ocupa 2 bytes e o objeto nao ocupa memoria nenhuma, e o desenho ja
 * precisa do indice para escolher a imagem. Guardar o indice e o que mantem
 * esta funcao sem conhecer a url de ninguem
 */
function lerCamada(camada, folhas, indiceDaFolha, cellWidth, cellHeight) {
  const cols = camada.width ?? 0;
  const rows = camada.height ?? 0;
  const total = cols * rows;

  const gids = new Int32Array(total);
  const flags = new Int32Array(total);

  /**
   * DE QUE FOLHA VEM CADA TILE.
   *
   * `0xFFFF` e "esta celula nao pertence a nenhuma folha": acontece quando
   * o autor apaga um tileset e o mapa fica com a referencia. A celula e
   * desenhada como VAZIA, e nunca com a arte do vizinho
   */
  const folhaDe = new Uint16Array(total);

  for (let indice = 0; indice < total; indice += 1) {
    const bruto = camada.data[indice] ?? 0;
    const gid = bruto === 0 ? -1 : gidDe(bruto);

    gids[indice] = gid;
    flags[indice] = bruto === 0 ? 0 : flagsDe(bruto);

    folhaDe[indice] = gid < 0 ? SEM_FOLHA : indiceDaFolha(gid);
  }

  return {
    name: camada.name,
    opacity: camada.opacity ?? 1,
    cols,
    rows,
    gids,
    flags,
    folhaDe,

    /**
     * O LADO DA CELULA, EM PIXELS DE MUNDO.
     *
     * ## POR QUE FICA NA CAMADA E NAO SO NO MAPA
     *
     * Porque a grade e do MAPA — 64x64 na base — e o desenho precisa saber
     * o tamanho da celula para distinguir duas coisas: o retangulo de
     * origem, que e o tamanho do TILE da folha, e o retangulo de destino,
     * que e onde a arte cai
     *
     * Sao numeros diferentes de proposito. Com um tileset so, os dois sao
     * iguais e ninguem nota a diferenca. Com o `estatus1` de 344x192 numa
     * grade de 64x64, a diferenca e a coisa que decide se a estatua aparece
     * do tamanho dela ou achatada num quadrado
     */
    cellWidth,
    cellHeight,
  };
}