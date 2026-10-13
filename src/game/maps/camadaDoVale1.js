/**
 * A CAMADA DE TILE DO VALE 1, e este arquivo so roda no navegador.
 *
 * ## PARA QUE SERVE
 *
 * Para voce poder abrir o `vale.tmj` no Tiled e pintar o vale tile por tile.
 * Antes disso o vale era o unico mapa grande sem `.tmj` de 64: o chao saia
 * do `TerrainRenderer`, ladrilhado a partir de `groundTile: "dark"` no
 * `GROUND_TILE_SIZE` de 128, e a unica coisa desenhada em cima dele eram os
 * 40 cristais
 *
 * E assim que o mapa ganha a camada, o `drawMap` passa a DESENHAR O TILED E
 * NAO O TERRENO: a linha `if (!temCamadaDeTile(map.id))` na frente do
 * `terrain.draw` e o que decide. O vale ja tem `zones: []`, entao nada e
 * pintado por cima do Tiled
 *
 * ## A CHAVE E `mapa_teste`, E O NOME DO MAPA E "VALE 1"
 *
 * A chave do registro e o `id`, e o `id` do vale e `MAP_TESTE_ID`
 * (`"mapa_teste"`), com `name: "Vale 1"`. O nome e o que voce le na HUD; o
 * `id` e o que o `temCamadaDeTile` e o `tiledDoMapa` recebem. Registrar por
 * `vale_1` nao pegaria: o registro e por `id`, e o mapa se procuraria no
 * `MAPS` por um id que nao existe
 *
 * ## E O `.tmj` JA ESTA EM 64, E BATE COM O MAPA
 *
 * O `vale.tmj` declara `tilewidth: 64`, `tileheight: 64`, 94 x 66 tiles — e
 * 94 * 64 = 6016 e 66 * 64 = 4224, que sao exatamente `MAP_1_WIDTH` e
 * `MAP_1_HEIGHT`. E o `tileSize: MAP_1_TILE` que o `MAP_TESTE` declara: o
 * campo e a promessa, e o arquivo e a prova
 *
 * ## E SO UMA FOLHA
 *
 * Ao contrario do `new_base.tmj` (duas folhas, `chao` e `estatus1`) e do
 * `boss.tmj` (duas, `boss` e `dungeon`), o vale tem uma so: `vale.tsx` em
 * `firstgid: 1`. Todos os `gid` da camada ficam entre 1 e 16, dentro da
 * folha
 */

import tmjDoVale1 from "../../assets/tilesets/vale_1/vale.tmj";
import imagemDoVale from "../../assets/tilesets/vale_1/vale.png?url";
import { registrarCamadas } from "./registroDeTiles.js";

/**
 * O `source` DO `.tsx`, E A CHAVE QUE CASA COM ELE.
 *
 * A string inteira, sem normalizar caminho — o mesmo motivo do
 * `camadaDoBoss1.js`: o `lerTileset` busca por `tilesets[definicao.source]`
 * e um `replace` errado falha do mesmo jeito silencioso
 *
 * Aqui o `.tsx` mora NA MESMA PASTA do `.tmj`, entao o Tiled escreveu so o
 * nome do arquivo, sem `../`
 */
const ARQUIVO_DO_VALE = "vale.tsx";

/**
 * O QUE O `.tsx` DIZ, transcrito.
 *
 * Sao a unica coisa do tileset que o navegador nao le sozinha: o `.tmj`
 * guarda so `{ firstgid, source }` e o resto esta em XML
 *
 * A conta fecha com a imagem: 259x259 com `spacing: 1` e 4 colunas —
 * 4 * 64 + 3 * 1 = 259. Sao os mesmos numeros da folha de pedra do mapa 1
 */
const TILESET_VALE = {
  name: "vale",
  columns: 4,
  tilewidth: 64,
  tileheight: 64,
  tilecount: 16,
  spacing: 1,
  margin: 0,
};

/**
 * REGISTRA A CAMADA DO VALE.
 *
 * A chave e `MAP_TESTE_ID`, o mesmo `id` do `MAP_TESTE`. E o que o
 * `colisaoDoMapa(mapId)` e o `tiledDoMapa(mapId)` leem quando o motor entra
 * no vale
 */
registrarCamadas("mapa_teste", {
  tmj: tmjDoVale1,

  /**
   * A CHAVE DA IMAGEM E O NOME DO TILESET SEM O `.tsx`.
   *
   * A mesma convencao do mapa base e da arena. O nome vem do atributo
   * `name` do `.tsx`, e o `source` do `.tmj` e o que casa com ele
   */
  imagens: {
    vale: imagemDoVale,
  },

  tilesets: {
    [ARQUIVO_DO_VALE]: TILESET_VALE,
  },
});