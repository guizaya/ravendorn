/**
 * A CAMADA DE TILE DO MAPA BASE, e este arquivo so roda no navegador.
 *
 * ## POR QUE A BASE GANHOU ISSO
 *
 * Porque o `.tmj` e a exportacao do proprio mapa base: 26x18 tiles de
 * 64, que dao 1664x1152 — o multiplo exato do `BASE_TILE` de 64. Sem essa
 * aritmetica nao ha grade
 *
 * ## E POR QUE O MAPA VIVE EM `new_base/`
 *
 * Porque o autor desenhou a base nova numa pasta propria, e o
 * `new_base.tmj` dela e o mapa que o jogo usa. A pasta `base/` continua ao
 * lado com os PNG das folhas — e os `.tsx` de `new_base/` apontam para ela
 * com `../base/`, entao nenhum arquivo de imagem foi duplicado
 *
 * ## E POR QUE AS DUAS FOLHAS DESENHAM
 *
 * Porque o `tiled.js` do motor le TODAS as folhas do `.tmj`, na ordem do
 * `firstgid`. Com o `chao` em 1 e o `estatus1` em 17, cada `gid` cai na
 * folha que o declarou, e o `estatus1` aparece pintado em 344x192 no meio da
 * grade de 64x64
 *
 * As transcricoes dos dois `.tsx` abaixo sao o que falta ao navegador: o
 * `.tmj` guarda so `{ firstgid, source }` e o resto esta em XML, que o
 * navegador nao le de `src/assets` sem um fetch
 *
 * ## E POR QUE AS DUAS IMAGENS FICAM NA PASTA `base/`
 *
 * Porque foi assim que o autor salvou: os `.tsx` de `new_base/` apontam para
 * `../base/`. Copiar os PNG para ca teria deixado duas copias da mesma arte
 * divergindo em silencio na proxima edicao
 *
 * ## E POR QUE ESTE ARQUIVO EXISTE SEPARADO DO MAPA
 *
 * Porque o `GameServer` importa `data/maps` e roda em Node puro. O que faz
 * o `.tmj` virar modulo e o plugin `tiledTmj` do `vite.config.js`, que so
 * existe no build do navegador — um `import` dele dentro de `base.js`
 * derrubaria o servidor na carga, com um erro que fala de extensao de
 * arquivo e nao de mapa
 *
 * ## E POR QUE OS DADOS DO TILESET ESTAO AQUI E NAO NO `.tmj`
 *
 * Porque o mapa foi salvo com o tileset EXTERNO: o `.tmj` carrega so
 * `{ "firstgid": 1, "source": "chao.tsx" }`, e o `.tsx` tem colunas,
 * contagem e tamanho em XML — que o navegador nao le de `src/assets` sem
 * um fetch
 */

import tmjDaBase from "../../assets/tilesets/new_base/new_base.tmj";
import imagemDoChao from "../../assets/tilesets/base/64x64_seamless_top-down_2D_MMORPG_terrain_tile_sho (1).png?url";
import imagemDoEstatus from "../../assets/tilesets/base/teste3.png?url";
import { registrarCamadas } from "./registroDeTiles.js";

/**
 * O QUE O `chao.tsx` DIZ, transcrito.
 *
 * Estes numeros sao a unica coisa do tileset que o navegador nao le sozinha.
 * Se a folha mudar de tamanho no Tiled, eles ficam velhos e o mapa desenha a
 * linha errada da imagem — em silencio, e em parte
 *
 * A imagem mede 259x259 com `spacing: 1` e 4 colunas: 4 * 64 + 3 * 1 = 259.
 * A conta fecha, e e ela que diz que a transcricao abaixo ainda vale
 */
const TILESET_DO_CHAO = {
  name: "chao",
  columns: 4,
  tilewidth: 64,
  tileheight: 64,
  tilecount: 16,
  spacing: 1,
  margin: 0,
};

/**
 * O QUE O `estatus1.tsx` DIZ, transcrito.
 *
 * Um tile so, de 344x192. Declarado no `.tmj` com `firstgid: 17`, que e a
 * faixa que o Tiled reserva depois dos 16 tiles do chao
 *
 * E o arquivo do `.tsx` que o pinto tem o `image source` em `../base/`, e
 * nao nesta pasta: o autor manteve a imagem do lado, e o caminho relativo
 * atravessa as duas
 */
const TILESET_DO_ESTATUS = {
  name: "estatus1",
  columns: 1,
  tilewidth: 344,
  tileheight: 192,
  tilecount: 1,
  spacing: 1,
  margin: 0,
};

/**
 * REGISTRA A CAMADA DA BASE.
 *
 * A chave e `"base"`, o mesmo `id` do `BASE_MAP`. E o que o
 * `colisaoDoMapa(mapId)` e o `tiledDoMapa(mapId)` leem quando o motor entra
 * na base
 */
registrarCamadas("base", {
  tmj: tmjDaBase,

  /**
   * A CHAVE DA IMAGEM E O NOME DO TILESET SEM O `.tsx`.
   *
   * E a mesma convencao do mapa 1, onde `"dungeon.tsx"` casa com a chave
   * `dungeon`. O nome vem do atributo `name` do `.tsx`, nao do arquivo: sao
   * iguais aqui, mas nao precisam ser
   */
  imagens: {
    chao: imagemDoChao,
    estatus1: imagemDoEstatus,
  },

  tilesets: {
    "chao.tsx": TILESET_DO_CHAO,
    "estatus1.tsx": TILESET_DO_ESTATUS,
  },
});