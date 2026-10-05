
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
 * Cada mapa declara o seu. Sao duas texturas pintadas de 1600x1600,
 * feitas para repetir:
 *
 *   - `grama`: a grama do Vale de Cinzas, o mapa_1
 *   - `cidade`: o calcamento do mapa base
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
  grama: new URL(
    "../../assets/terrain/grama.jpg",
    import.meta.url,
  ).href,

  cidade: new URL(
    "../../assets/terrain/chao_cidade.jpg",
    import.meta.url,
  ).href,
};

/**
 * O lado do tile de chao, em pixel do mundo.
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
 * O TERENO DAS AREAS DE MOB E O `terra.jpg`.
 *
 * Onze dos doze zonas do vale passam a ser ladrilhadas com esta textura,
 * na mesma conta da grama: 1600px reduzidos para 128px no carregamento
 *
 * O que muda em relacao ao estado anterior:
 *
 *   - as 11 zonas de mob deixaram de usar os tiles de 32px da
 *     `terrain.png` — floresta, gelo, pedra, brejo e areia saem todos do
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
  "../../assets/terrain/terra.jpg",
  import.meta.url,
).href;

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
 * Inclusive o campo de provas. Ele ja foi a unica de fora — o
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
 * zona — e o mesmo ladrilho para as doze, e o `terrain` so pinta a
 * area no minimapa
 */
export function zoneUsesTile(zone) {
  if (!ZONES_USE_TILE) return false;

  return true;
}

/**
 * AS TRANSICOES FORAM REMOVIDAS DO MAPA.
 *
 * Existia uma faixa de 32px em volta de cada zona, tirada da
 * `transitions.png`, que misturava o terreno da zona com o de fora. Sao
 * 15 pares, de `grass_ice` a `sand_ash`
 *
 * Saiu por causa do chao novo: o `grama.jpg` e uma textura pintada de
 * 128px, e a faixa era pixel art de 32px. As duas se juntavam num
 * contorno serrilhado em volta de cada uma das 12 areas de mob
 *
 * O que foi embora junto, por ficar sem uso:
 *
 *   - a folha `assets/terrain/transitions.png`
 *   - a `TRANSITION_LIST` e a `TRANSITION_ROW`, e com elas o
 *     `transitionIdFor` e o `getTransition`
 *   - a entrada `transitions` do `TERRAIN_SHEETS`
 *
 * Os geradores continuam em `tools/terrain-art.mjs` e
 * `tools/generate-terrain.mjs`: rodando o `generate-terrain.mjs` a
 * folha volta, e so falta o `drawZoneEdges` para desenha-la
 *
 * A BORDA DA ZONA FICOU SECA. Com o chao em grama pintada e a zona em
 * pixel art, o corte entre as duas e visivel — e a leitura de "aqui comeca
 * uma area de mob" continua, agora por corte em vez de por mistura
 */
export const FEATURE_LIST = [
  "tufts",
  "pebbles",
  "ripples",
  "cracks",
  "puddles",
  "needles",
  "frost",
  "embers",
];

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
