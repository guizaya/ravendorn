/**
 * A CAMADA DE TILE DA ARENA DO HULK, e este arquivo so roda no navegador.
 *
 * ## PARA QUE SERVE
 *
 * Para voce poder abrir o `boss.tmj` no Tiled e desenhar a arena tile por
 * tile — um chao de pedra, a marca do combate, o que a arena precisar. Antes
 * disso o `boss_1` era o unico mapa sem `.tmj`: o chao saia do
 * `TerrainRenderer`, ladrilhado a partir de `groundTile: "boss"`
 *
 * E assim que o mapa ganha a camada, o `drawMap` passa a DESENHAR O TILED E
 * NAO O TERRENO: a linha `if (!temCamadaDeTile(map.id))` na frente do
 * `terrain.draw` e o que decide. Sem o `zones: []` do `BOSS_1_MAP`, o
 * terreno la se sobrepoe ao Tiled, sessenta vezes por segundo
 *
 * ## O ARQUIVO E `boss.tmj`, E O NOME VEM DO QUE O TILED SALVOU
 *
 * A arena foi salva como `boss.tmj`, e nao como `boss_1.tmj`. O `import`
 * aponta para o nome que esta no disco — foi exatamente esse descasamento que
 * travou o build com "Could not resolve boss_1.tmj" quando o arquivo foi
 * renomeado no Tiled
 *
 * ## E AGORA SAO DUAS FOLHAS
 *
 * O `boss.tmj` declara `boss.tsx` em `firstgid: 1` e
 * `../new_base/dungeon.tsx` em `firstgid: 17`. A arena pintada usa SO a
 * segunda faixa — todos os `gid` do mapa estao entre 17 e 32, e nenhum toca a
 * folha do `boss`. A do `boss` fica declarada para o autor ter a folha da arte
 * do chefe disponivel ao pintar, e e registrada aqui porque declarado e nao
 * registrado e o jeito silencioso de o Tiled mostrar um tile que o jogo ignora
 *
 * ## E A FOLHA DO PISO E A DO MAPA 1
 *
 * A `dungeon.tsx` e a mesma folha de pedra do vale — 4 colunas, 16 tiles,
 * `spacing: 1`, imagem de 259x259 — mas o `.tsx` mora em `new_base/` e a
 * imagem em `boss_1/`. E o mesmo desenho de sempre; muda so onde o arquivo
 * esta
 *
 * ## POR QUE ISSO PRECISA ESTAR REGISTRADO AQUI
 *
 * Porque o `lerTileset` casa pelo `source` do `.tmj`, e a imagem da folha
 * so chega no navegador por `import ... ?url`. Um `source` sem imagem
 * registrada nao da erro: o `tiled.js` loga uma vez, guarda `null` e o
 * `drawMap` sai antes de pintar — a arena fica PRETA, sem nenhum aviso
 *
 * ## COMO VOCE DESENHA A SALA
 *
 * No Tiled, neste arquivo: uma camada de objeto (**Object Layer**) com o
 * nome exato `PAREDES`, e dentro dela os retangulos da parede. E o nome
 * que importa — o `colisaoTiled` le a camada pelo nome, e uma camada
 * chamada `paredes` ou `Parede` e ignorada em silencio
 *
 * Os retangulos sao em pixels de mundo, com `x`/`y` no CANTO (o que o
 * Tiled ja chama de Position). Cada um vira um solido, e o boneco para nele.
 * **Tile object nao serve**: ele grava `gid` e o `width`/`height` vem
 * zerado, entao a parede nao barra ninguem
 *
 * ## E POR QUE UM TILED E NAO UM `solids` NO CODIGO
 *
 * Porque a parede que se ve e a que barra saem do mesmo arquivo. Com a
 * barreira em codigo, elas podiam divergir: o jogador via uma sala e
 * batia em outra. Aqui nao ha como divergir
 */

import tmjDoBoss1 from "../../assets/tilesets/boss_1/boss.tmj";
import imagemDoBoss from "../../assets/tilesets/boss_1/boss.png?url";
import imagemDoDungeon from "../../assets/tilesets/boss_1/dungeon.png?url";
import { registrarCamadas } from "./registroDeTiles.js";

/**
 * O `source` DO `.tsx`, E A CHAVE QUE CASA COM ELE.
 *
 * ## POR QUE A STRING INTEIRA, COM O `../` E TUDO
 *
 * Porque o `lerTileset` busca por essa string INTEIRA, sem normalizar caminho:
 *
 *     tilesets[definicao.source]  //  tilesets["../new_base/dungeon.tsx"]
 *
 * Registrar como `dungeon.tsx` — que e o que o `map_1` usa, porque o
 * `dungeon.tmj` esta NA MESMA PASTA e o Tiled escreve so o arquivo — nao
 * casa. E o `lerTileset` cai no `?? definicao`, que nao tem `name` nem
 * `columns`, e ai o `imagens[undefined]` estoura
 *
 * As duas chaves sao escritas aqui como literais, e nao montadas com
 * `replace`, porque e o Tiled que decide o caminho relativo e um
 * `replace` errado falha do mesmo jeito silencioso
 */
const ARQUIVO_DO_BOSS = "boss.tsx";
const ARQUIVO_DO_DUNGEON = "../new_base/dungeon.tsx";

/**
 * O QUE CADA `.tsx` DIZ, transcrito.
 *
 * Sao a unica coisa do tileset que o navegador nao le sozinha: o `.tmj`
 * guarda so `{ firstgid, source }` e o resto esta em XML
 *
 * As DUAS folhas tem os mesmos numeros porque a imagem tem 259x259 com
 * `spacing: 1` e 4 colunas — 4 * 64 + 3 * 1 = 259 — e as duas foram
 * montadas nessa mesma grade
 */
const TILESET_BOSS = {
  name: "boss",
  columns: 4,
  tilewidth: 64,
  tileheight: 64,
  tilecount: 16,
  spacing: 1,
  margin: 0,
};

const TILESET_DUNGEON = {
  name: "dungeon",
  columns: 4,
  tilewidth: 64,
  tileheight: 64,
  tilecount: 16,
  spacing: 1,
  margin: 0,
};

/**
 * REGISTRA A CAMADA DA ARENA.
 *
 * A chave e `"boss_1"`, o mesmo `id` do `BOSS_1_MAP`. E o que o
 * `colisaoDoMapa(mapId)` e o `tiledDoMapa(mapId)` leem quando o motor entra
 * na arena
 */
registrarCamadas("boss_1", {
  tmj: tmjDoBoss1,

  /**
   * A CHAVE DA IMAGEM E O NOME DO TILESET SEM O `.tsx`.
   *
   * A mesma convencao do mapa base. O nome vem do atributo `name` do `.tsx`,
   * e o `source` do `.tmj` e o que casa com ele
   */
  imagens: {
    boss: imagemDoBoss,
    dungeon: imagemDoDungeon,
  },

  tilesets: {
    [ARQUIVO_DO_BOSS]: TILESET_BOSS,
    [ARQUIVO_DO_DUNGEON]: TILESET_DUNGEON,
  },
});