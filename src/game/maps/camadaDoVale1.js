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
import imagemDoVale2 from "../../assets/tilesets/vale_1/vale_2.png?url";
import { registrarCamadas } from "./registroDeTiles.js";

/**
 * Os `source` DOS DOIS `.tsx`, e as chaves que casam com eles.
 *
 * Os dois estao na MESMA pasta do `.tmj`, entao o Tiled escreveu so o nome do
 * arquivo, sem `../`
 *
 * ## POR QUE AS DUAS FOLHAS PRECISAM ESTAR REGISTRADAS
 *
 * O `vale.tmj` declara `vale.tsx` em `firstgid: 1` e `vale_2.tsx` em
 * `firstgid: 17`. Tirando as flags de espelhamento, a camada usa os gid
 * **5** (folha `vale`), **20, 21, 22, 25, 27, 29** e **32** (folha `vale_2`)
 *
 * Uma folha nao registrada nao da erro: o `lerTileset` cai no `?? definicao`,
 * que nao tem `name` nem `columns`, e o desenho daquela parte do mapa sai
 * vazia. E o `imagens[undefined]` estoura antes
 *
 * ## E POR QUE A FOLHA VELHA CONTINUA REGISTRADA, SENDO QUASE INUTIL
 *
 * Porque ela e USADA: o gid 5 pertence a `vale` e nao a `vale_2`. Um tile so
 * nao muda a conta, mas um tile nao desenhado aparece como buraco no chao —
 * e o jogador nao sabe se e arte faltando ou mapa quebrado
 *
 * ## E POR QUE O `source` NAO PODE SER DEDUZIDO
 *
 * Porque o `registroDeTiles` casa pela string INTEIRA, sem normalizar caminho.
 * As duas chaves sao literais, e nao montadas com `replace`: um `replace`
 * errado falha do mesmo jeito silencioso
 */
const ARQUIVO_DO_VALE = "vale.tsx";
const ARQUIVO_DO_VALE2 = "vale_2.tsx";

/**
 * O QUE CADA `.tsx` DIZ, transcrito.
 *
 * Sao a unica coisa do tileset que o navegador nao le sozinha: o `.tmj`
 * guarda so `{ firstgid, source }` e o resto esta em XML
 *
 * As DUAS tem os mesmos numeros porque as DUAS imagens tem 259x259 com
 * `spacing: 1` e 4 colunas — 4 * 64 + 3 * 1 = 259 — e as duas foram montadas
 * nessa mesma grade
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

const TILESET_VALE2 = {
  name: "vale_2",
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
   * A mesma convencao do mapa base e da arena. O nome vem do atributo `name`
   * do `.tsx`, e o `source` do `.tmj` e o que casa com ele
   */
  imagens: {
    vale: imagemDoVale,
    vale_2: imagemDoVale2,
  },

  tilesets: {
    [ARQUIVO_DO_VALE]: TILESET_VALE,
    [ARQUIVO_DO_VALE2]: TILESET_VALE2,
  },
});