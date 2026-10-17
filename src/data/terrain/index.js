
export const TILE_SIZE = 32;
export const TILE_VARIANTS = 4;

export const TERRAIN_TYPES = [
  "grass",
  "dirt",
  "sand",
  "stone",
  "swamp",
  "forest",
  "ice",
  "ash",
];

export const TERRAIN_ROW = {
  grass: 0,
  dirt: 1,
  sand: 2,
  stone: 3,
  swamp: 4,
  forest: 5,
  ice: 6,
  ash: 7,
};

export const BASE_TERRAIN = "grass";

/**
 * O CHAO DE CADA MAPA E UM TILE DE VERDADE.
 *
 * Cada mapa declara o seu. Sao texturas pintadas de 1600x1600, feitas
 * para repetir:
 *
 *   - `grama`: a grama do Vale de Cinzas, o mapa_1
 *   - `cidade`: o calcamento do mapa base
 *   - `neve`: o chao do mapa 2
 *
 * Antes o chao era um `GROUND_TILE` unico, e com um segundo mapa no
 * projeto isso passou a ser errado: o mapa base abriria com grama
 *
 * E nao `import url from "grama.jpg"`: o Node resolve a string sem
 * abrir o arquivo, que derrubaria o processo do servidor, e o Vite
 * continua reescrevendo para o asset bundlado
 *
 * A imagem de 1600px continua sendo a que se baixa; a reducao para
 * 128px acontece no carregamento, num canvas fora de tela
 */
export const GROUND_TILES = {
  /**
   * A GRAMA DO MAPA 1.
   *
   * Antes era o `grama.jpg`, de 1600x1600. A arte nova e um PNG de
   * 1254x1254, o mesmo tamanho do baÃº e da mira, e entra no mesmo
   * _pipeline_: o ladrilho de 128px continua sendo montado no carregamento
   * e a arte grande nunca entra no bundle reduzida
   *
   * ## O TAMANHO DA ORIGEM NAO ESTA EM NENHUM CODIGO
   *
   * Nem aqui nem no `reduceToTile`. O ladrilho tem 128px em `GROUND_TILE_SIZE`,
   * e a `reduceToTile` le `naturalWidth` da imagem e corta por metades ate
   * chegar no 128 â€” 1254 vira 627, 314, 157 e 128. Nenhuma das duas medidas
   * esta escrita em lugar nenhum, entao trocar a arte nao e um numero que
   * precisa accompanyar
   *
   * O `grama.jpg` antigo continua no disco: e a arte de origem do campo de
   * provas e a referencia de cor do resto, e some quando nenhum mapa
   * apontar para ele
   */
  grama: new URL(
    "../../assets/terrain/new_grama_mapa_1.png",
    import.meta.url,
  ).href,

  /**
   * O CALCAMENTO DO MAPA BASE.
   *
   * Antes era o `chao_cidade.jpg`, de 1600x1600. A arte nova e um PNG de
   * 1254x1254 â€” o mesmo tamanho da grama e da terra do mapa 1 â€” e entra no
   * mesmo _pipeline_: o ladrilho de 128px continua sendo montado no
   * carregamento e a arte grande nunca entra no bundle reduzida
   *
   * ## O TAMANHO DA ORIGEM NAO ESTA EM NENHUM CODIGO
   *
   * O ladrilho tem 128px em `GROUND_TILE_SIZE`, e a `reduceToTile` le
   * `naturalWidth` da imagem e corta por metades ate chegar nele â€” 1254 vira
   * 627, 314, 157 e 128. Nenhuma das duas medidas esta escrita em lugar
   * nenhum, entao trocar a arte nao e um numero que precisa acompanhar
   *
   * ## POR QUE ESTE CALCAMENTO NAO ESTA NO ESPELHADO
   *
   * A nota da `boss.jpg` ao lado explica o problema que o espelhado resolve:
   * a arte emenda mal. E o calcamento o unico do jogo que ladrilha sem
   * costura ha anos, entao o espelhado dele e o que impede a emenda
   *
   * O `chao_cidade.jpg` antigo continua no disco: e a materia prima de
   * comparacao e some quando nenhum mapa apontar para ele
   */
  cidade: new URL(
    "../../assets/terrain/new_chao_cidade.png",
    import.meta.url,
  ).href,

  neve: new URL(
    "../../assets/terrain/neve.jpg",
    import.meta.url,
  ).href,

  /**
   * O CHAO DA ARENA DE CHEFE.
   *
   * Antes era o `boss.jpg`, de 1600x1600. A arte nova e um PNG de
   * 1254x1254 â€” o mesmo tamanho da grama, da terra e do calcamento â€” e
   * entra no mesmo _pipeline_: o ladrilho de 128px continua sendo montado no
   * carregamento e a arte grande nunca entra no bundle reduzida
   *
   * ## A EMENDA MELHOROU, E A ARTE ANTIGA JA EMENDAVA BEM
   *
   * A nota antiga dizia que a `boss.jpg` emendava com 58 de diferenca media
   * entre a coluna da esquerda e a da direita, e por isso nao estava no
   * espelhado. Medindo agora: a antiga da 19,7 e a nova da 3,2
   *
   * A nova emenda seis vezes melhor, e o espelhado continua fora â€” ele e o
   * conserto para arte que NAO fecha (a neve), nao um padrao. Uma arte que
   * fecha por si so nao precisa de espelho, por melhor que a emenda fique
   *
   * O `boss.jpg` continua no disco como materia prima de comparacao
   */
  boss: new URL(
    "../../assets/terrain/new_chao_boss.png",
    import.meta.url,
  ).href,

  /**
   * O CHAO ESCURO DO VALE 1.
   *
   * Era a `terra_2`, que apontava para o mesmo arquivo que e a terra das
   * ZONAS do mapa 2, em `ZONE_TILES`. Trocada pela arte escura
   *
   * ## POR QUE A CHAVE E `dark` E O ARQUIVO NAO
   *
   * Porque o arquivo se chama
   * `terra_2-voce-consedue-deixar-ela-uma-terra-mais-preta.jpg`. O nome
   * e um pedido, nao um rotulo: e assim que a arte chegou, com o
   * lembrete de que o chao do vale tem de ficar mais preto
   *
   * Deixar a chave com esse nome seria um mapa de traducao para ninguem
   * consultar. O arquivo guarda a conversa; a chave guarda o que o
   * desenho e
   *
   * ## POR QUE A CHAVE `terra_2` SUMIU DO CHAO
   *
   * Porque ela foi criada aqui so para este mapa: nao servia a nenhum
   * outro chao do jogo. O `terra_2.jpg` continua existindo e continua em
   * uso, como terra de zona do mapa 2
   *
   * Sao camadas diferentes do mesmo desenho, e por isso chaves
   * diferentes: o `groundTile` preenche a tela inteira quando o mapa nao
   * tem zona nenhuma, e o `zoneTile` e o ladrilho que se repete dentro de
   * cada retangulo de zona
   */
  dark: new URL(
    "../../assets/terrain/terra_2-voce-consedue-deixar-ela-uma-terra-mais-preta.jpg",
    import.meta.url,
  ).href,
};

/**
 * QUAIS CHASOS PRECISAM VIRAR UM TILE ESPELHADO.
 *
 * ## O PROBLEMA
 *
 * O chao e um `createPattern` repetido. Para a repeticao nao aparecer,
 * a arte precisa ser CONTINUA: o que toca na borda direita tem que
 * continuar na borda esquerda, e o que toca embaixo tem que continuar
 * em cima. Grama e calcamento foram feitos assim
 *
 * A neve nao. Tem terra batida encostando nas quatro bordas, e ao
 * repetir, cada mancha e CORTAVA na emenda e continuava no tile de
 * baixo: o desenho aparecia cortado ao meio, com a parte de cima de um
 * lado e a de baixo do outro. E o "um tile cortando o outro"
 *
 * ## O ESPELHO COMO CONSERTO
 *
 * O ladrilho e montado com a arte quatro vezes, espelhada:
 *
 *     +--------+--------+
 *     | normal | <-H    |
 *     +--------+--------+
 *     |  -V    | -H -V  |
 *     +--------+--------+
 *
 * A borda direita do quadrante normal encosta na borda esquerda do
 * quadrante espelhado, que e a propria borda esquerda da arte. Os
 * dois lados casam por definicao, entao a emenda some
 *
 * E POR MAPA, E POR QUE A CIDADE ENTROU
 *
 * A regra original era so para a neve, com o argumento de que a grama e o
 * calcamento "ja sao continuos". A medicao do ladrilho de 64 px conta outra
 * historia: a borda direita da textura reduzida e a borda esquerda, e elas
 * NAO casam — o desvio medio e de 5,86 na horizontal e 6,44 na vertical. Sem
 * espelhar, essa emenda se repete a cada 64 px e vira a grade visivel no chao
 * da base
 *
 * O espelhar resolve pela definicao, e nao por ajuste: o quadrante de baixo e
 * o de cima com o eixo Y invertido, entao a emenda vira o centro da arte, que
 * ja era uma borda e nao uma costura
 *
 * Ficam de fora, de proposito, as texturas que nao estao em uso agora: `grama`,
 * `boss` e `dark`. Se alguma delas mostrar a mesma grade, e so acrescentar a
 * chave aqui
 */
export const GROUND_TILE_ESPELHADO = new Set(["neve", "cidade"]);

/** O chao deste mapa precisa de ladrilho espelhado? */
export function groundTileEspelhadoFor(map) {
  return GROUND_TILE_ESPELHADO.has(map?.groundTile);
}

/**
 * O lado do tile de chao, em pixel do mundo, quando o mapa nao declara outro.
 *
 * O valor e o mesmo para as duas texturas por uma razao pratica: e a
 * mesma conta de reducao, e um tile de grama com um de calcamento em
 * escalas diferentes fariam o mapa parecer dois jogos
 *
 * A 128px o tile cabe dez vezes na largura da tela, entao a repeticao
 * fica visivel. Esse e o preco do detalhe: a 1600px a textura e
 * bonita, mas o tile nem caberia uma vez na viewport
 *
 * Na grama cada detalhe da arte fica 12,5 vezes menor e o chao passa a
 * ter grao de verdade em vez de manchas. No calcamento o efeito e o
 * mesmo: a 1600px cada pedra era do tamanho de um bicho
 */
export const GROUND_TILE_SIZE = 128;

/**
 * O LADO DO TILE DAS CHAVES QUE NAO USAM O PADRAO.
 *
 * ## POR QUE UM TABELA E NAO SO O `GROUND_TILE_SIZE`
 *
 * Porque ele e global. Mexer no valor mudaria os cinco chaos do jogo de uma
 * vez â€” e a grama e a neve ja estavam certas quando o calcamento da base
 * entrou com a arte nova. Um ajuste que e do calcamento nao pode custar o
 * ajuste da grama
 *
 * E a chave e `groundTile`, a mesma que `GROUND_TILE_ESPELHADO` le, e nao a
 * URL: duas bases com a mesma folha mas escalas diferentes sao dois mapas de
 * verdade, e quem decide a escala e o mapa
 */
const GROUND_TILE_SIZE_POR_CHAVE = {
  /**
   * O CALCAMENTO DA BASE, na metade do padrao de repeticao.
   *
   * A arte nova de 1254px, reduzida a 128px, dava uma pedra grande demais
   * perto das outras: cada bloco media quase o tamanho de um personagem, e
   * o calcamento lia como uma parede de tijolos em vez de um chao
   *
   * Desceu de 128 para 96 e depois para 64. A 64px a pedra cai para metade
   * do lado, que e o que faz o calcamento virar chao de verdade â€” e a
   * reducao nao vira ruido por causa do `reduceToTile`, que corta por
   * metades (1254, 627, 314, 157, 64): cada degrau e um fator de 2, e o
   * ultimo e de 157 para 64
   *
   * ## O PRECO, E ELE E JUSTO AQUI
   *
   * A 64px o ladrilho cabe vinte vezes na largura de uma tela de 1280. A
   * repeticao aparece, e o espelhado que a neve usa nao esta nesta chave:
   * `cidade` nunca entrou em `GROUND_TILE_ESPELHADO`, e o calcamento antigo
   * ja ladrilhava sem costura ha anos. Se a emenda aparecer aqui, e o
   * espelhado a saida â€” mas a arte nova emenda sete vezes melhor que a
   * antiga, entao provavelmente nao vai precisar
   *
   * E por 64 e nao por um numero redondo menor: 64 e exatamente a metade do
   * `GROUND_TILE_SIZE`, entao o calcamento fica em escala de 1:2 com a
   * grama â€” e nao com o pixel art de 32px, com quem compartilha o dobro
   */
  cidade: 64,

  /**
   * A GRAMA DO MAPA 1, em 16px.
   *
   * ## POR QUE 16 E NAO 32
   *
   * Porque 16 e o `TILE_SIZE` deste arquivo, e o lado com quem o pixel art
   * do jogo inteiro ja conversa: o mob, a prop e o boneco sao desenhados em
   * celulas de 32 com metade ocupada, ou seja, a arte viva ocupa 16
   *
   * Com o ladrilho do chao em 16, a grade do terreno passa a bater com a
   * grade da arte. Um ladrilho de 128 sobre celulas de 16 e um ladrilho de
   * 16: os dois ladrilham, mas so um deles tem as contas fechando
   *
   * ## O QUE MUDA NA TELA
   *
   * O grao da grama fica 8 vezes menor e a repeticao aparece mais. E o preco
   * do `cidade` em 64, pelo mesmo motivo: a 16px o ladrilho cabe oitenta
   * vezes na largura de uma tela de 1280
   *
   * ## E SO O MAPA 1
   *
   * Porque a chave e `groundTile`, e o vale e o unico mapa com
   * `new_grama_mapa_1`. A neve, o calcamento e a arena ficam no que ja
   * estavam
   */
  grama: 64,
};

/**
 * O lado do tile de um mapa, em pixel do mundo.
 *
 * Cai no `GROUND_TILE_SIZE` quando a chave nao esta na tabela â€” que e o
 * caminho de qualquer mapa novo, e o mesmo do `groundTileFor`
 */
export function groundTileSizeFor(map) {
  return (
    GROUND_TILE_SIZE_POR_CHAVE[map?.groundTile] ?? GROUND_TILE_SIZE
  );
}

/**
 * Se o chao de fora das zonas esta sendo pintado pelo tile.
 *
 * Desligar aqui faz os mapas voltarem ao pixel art de 32px sem mexer
 * em mais nada
 */
export const GROUND_USES_TILE = true;

/**
 * A folha de chao de um mapa.
 *
 * Cai na grama quando o mapa nao declara uma: assim um mapa novo sem
 * `groundTile` ainda mostra um chao, em vez de sair preto
 */
export function groundTileFor(map) {
  return GROUND_TILES[map?.groundTile] ?? GROUND_TILES.grama;
}

/**
 * O TERENO DAS AREAS DE MOB E A ARTE NOVA DE TERRA.
 *
 * Onze dos doze zonas do vale passam a ser ladrilhadas com esta textura,
 * na mesma conta da grama: a arte de origem reduzida para 128px no
 * carregamento
 *
 * ## O `terra.jpg` DE 1600px SAIU DE CIRCULACAO
 *
 * A arte e agora o `new_terra_mapa_1.png`, de 1254x1254. O arquivo
 * antigo continua no disco â€” e a materia prima de comparacao e a
 * referencia de cor â€” e sai de circulacao junto com esta constante quando
 * nenhum mapa apontar para ele
 *
 * O `terra_2` do mapa 2 nao foi tocado: a arte dele e a da temperatura
 * do Vale de Cinzas, e o pedido foi so a terra do mapa 1
 *
 * O que muda em relacao ao estado anterior:
 *
 *   - as 11 zonas de mob deixaram de usar os tiles de 32px da
 *     `terrain.png` â€” floresta, gelo, pedra, brejo e areia saem todos do
 *     mesmo ladrilho de terra
 *   - o Campo de Provas, que tem `kind: "training"` e so bonecos de
 *     treino, NAO foi mudado. Ele nao e area de mob, e continua em pixel
 *     art de grama
 *   - o `terrain` e o `terrainAlt` de cada zona continuam no catalogo,
 *     porque o minimapa ainda pinta cada zona com a cor do seu terreno e
 *     e por ele que se sabe qual area e qual
 *
 * O lado do tile e o mesmo da grama, e pela mesma razao: a 128px o grao
 * da terra fica no tamanho do chao
 */
export const ZONE_TILE = new URL(
  "../../assets/terrain/new_terra_mapa_1.png",
  import.meta.url,
).href;

/**
 * A TERRA DAS ZONAS DE MOB DE CADA MAPA.
 *
 * O `ZONE_TILE` acima e o padrao, e continua valendo para o mapa que
 * nao declarar nada. O mapa 2 declara a sua, porque a terra do Vale de
 * Cinzas e a terra do mapa 2 sao o mesmo bioma em dois cenarios
 * diferentes â€” e a diferenca de temperatura se enxerga no chao, nao
 * so no minimapa
 *
 * Same chaves, mesmo traducao: `zoneTileFor` e o `groundTileFor` do
 * chao. E a URL, e nao a imagem, que o cache guarda â€” assim trocar o
 * mapa nao precisa recarregar nada, e so procurar outro ladrilho
 */
export const ZONE_TILES = {
  terra: ZONE_TILE,

  terra_2: new URL(
    "../../assets/terrain/terra_2.jpg",
    import.meta.url,
  ).href,
};

/** A folha de terra das zonas deste mapa. Cai na do vale sem declaracao. */
export function zoneTileFor(map) {
  return ZONE_TILES[map?.zoneTile] ?? ZONE_TILE;
}

 export const ZONE_TILE_SIZE = 128;

/**
 * Desligar aqui faz as 11 voltarem ao pixel art de 32px, sem mexer em
 * mais nada
 */
export const ZONES_USE_TILE = true;

/**
 * Uma zona e ladrilhada com o `terra.jpg`?
 *
 * ## TODAS AS DOZE
 *
 * Inclusive o campo de provas. Ele ja foi a unica de fora â€” o
 * argumento era que o jogador precisa ver que ali e um campo de treino
 * e nao um territorio hostil. A leitura vem do que mora dentro: dois
* bonecos parados, nenhum inimigo, nenhum ataque. E o `terra.jpg`
 * faz o campo de provas deixar de ser o unico retangulo do vale com
 * outra textura, o que aparecia como um degrau de estilo na borda
 *
 * ## POR QUE O INTERRUPTOR CONTINUA SENDO O `ZONES_USE_TILE`
 *
 * Com ele em `false`, as doze voltam ao pixel art de 32px sem mexer em
 * mais nada. O que nao e o nome da pasta de arte nem o `terrain` da
 * zona â€” e o mesmo ladrilho para as doze, e o `terrain` so pinta a
 * area no minimapa
 */
export function zoneUsesTile(zone) {
  if (!ZONES_USE_TILE) return false;

  return true;
}

/**
 * AS TRANSICOES ENTRE ZONAS FORAM REMOVIDAS.
 *
 * Existia uma faixa de 32px em volta de cada zona, tirada da
 * `transitions.png`, que misturava o terreno da zona com o de fora. Saiu
 * porque o chao novo e uma textura pintada de 128px, e a faixa era pixel art
 * de 32px: as duas se juntavam num contorno serrilhado em volta de cada uma
 * das 12 areas de mob
 *
 * A borda ficou seca, e a leitura de "aqui comeca uma area de mob" continua,
 * agora por corte em vez de por mistura
 *
 * ## O QUE FOI EMBORA JUNTO
 *
 * A folha `assets/terrain/transitions.png`, a `TRANSITION_LIST` e a
 * `TRANSITION_ROW`, o `transitionIdFor`, o `getTransition` e a entrada
 * `transitions` do `TERRAIN_SHEETS`. Os geradores continuam em
 * `tools/terrain-art.mjs` e `tools/generate-terrain.mjs`: rodando o
 * `generate-terrain.mjs` a folha volta, e so falta o `drawZoneEdges`
 *
 * A `FEATURE_LIST` tambem saiu: era a lista de desenhos que a faixa
 * misturava, e sem a faixa nao ha o que lista
 */
export {};

/**
 * As folhas de imagem do terreno.
 *
 * `new URL(..., import.meta.url)` em vez de `import url from
 * "terrain.png"`: o Node resolve para uma string sem abrir o
 * arquivo. Com o `import`, este modulo derrubava o processo do
 * servidor com ERR_UNKNOWN_FILE_EXTENSION, porque o motor
 * importa daqui e roda la. O Vite continua reescrevendo para o
 * asset bundlado, entao a imagem no jogo e a mesma.
 */
export const TERRAIN_SHEETS = {
  terrain: new URL(
    "../../assets/terrain/terrain.png",
    import.meta.url,
  ).href,

  // sem `transitions`: as faixas de mistura sairam do mapa. O motivo e
  // o mesmo que levou o `GROUND_TILE` para o catalogo, e esta escrito
  // onde a lista estava

  features: new URL(
    "../../assets/terrain/features.png",
    import.meta.url,
  ).href,
};

const MINIMAP_TINTS = {
  grass: "rgba(91, 143, 113, 0.55)",
  dirt: "rgba(140, 122, 92, 0.55)",
  sand: "rgba(180, 152, 104, 0.55)",
  stone: "rgba(150, 155, 160, 0.55)",
  swamp: "rgba(94, 150, 120, 0.55)",
  forest: "rgba(52, 96, 62, 0.55)",
  ice: "rgba(120, 158, 176, 0.55)",
  ash: "rgba(122, 96, 112, 0.55)",
};

const LABEL_TINTS = {
  grass: "rgba(91, 143, 113, 0.1)",
  dirt: "rgba(140, 122, 92, 0.1)",
  sand: "rgba(180, 152, 104, 0.1)",
  stone: "rgba(150, 155, 160, 0.1)",
  swamp: "rgba(94, 150, 120, 0.1)",
  forest: "rgba(52, 96, 62, 0.1)",
  ice: "rgba(120, 158, 176, 0.1)",
  ash: "rgba(122, 96, 112, 0.1)",
};

export function minimapColorFor(terrain) {
  return (
    MINIMAP_TINTS[terrain] ??
    MINIMAP_TINTS[BASE_TERRAIN]
  );
}

export function terrainLabelColor(terrain) {
  return (
    LABEL_TINTS[terrain] ?? LABEL_TINTS[BASE_TERRAIN]
  );
}
