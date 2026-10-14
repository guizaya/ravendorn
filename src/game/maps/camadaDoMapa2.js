/**
 * A CAMADA DE TILE DO MAPA 2, e este arquivo so roda no navegador.
 *
 * ## O QUE O `map_2.tmj` TRAZ
 *
 * As mesmas duas camadas do `dungeon.tmj` do mapa 1, e no mesmo formato: a
 * `Camada de Blocos 1` com o desenho do chao, e a camada de objeto `PAREDES`
 * com os retangulos de colisao. 94x66 tiles de 64px, que dao 6016x4224 — as
 * medidas que `MAP_2_WIDTH` e `MAP_2_HEIGHT` ja produzem
 *
 * ## E POR QUE ESTE E UM ARQUIVO E NAO UM CAMPO NO MAPA
 *
 * Pelo mesmo motivo do `camadaDoMapa1.js`: o `GameServer` importa o mesmo
 * `data/maps/index.js` e roda em Node puro. O que faz o `.tmj` virar modulo e
 * o plugin `tiledTmj` do `vite.config.js`, que so existe no build do
 * navegador — e um `import` dele dentro do mapa derrubaria o servidor na
 * carga, com um erro que fala de extensao de arquivo e nao de mapa
 *
 * ## E POR QUE O TILESET VAI TRANSCRITO
 *
 * Porque o mapa foi salvo com o tileset EXTERNO: o `.tmj` carrega so
 * `{ "firstgid": 1, "source": "png.tsx" }`, e o `png.tsx` tem colunas,
 * contagem e tamanho em XML — que o navegador nao le de `src/assets` sem um
 * fetch
 *
 * O nome do tileset e `png`, e nao `map_2`: e o que o autor chamou a folha no
 * Tiled. O `source` do `.tmj` e `png.tsx`, e e por ele que o `lerMapaTiled`
 * casa — o `name` abaixo so existe para este arquivo descrever a folha
 */

import tmjDoMapa2 from "../../assets/tilesets/map_2/map_2.tmj";
import imagemDoMapa2 from "../../assets/tilesets/map_2/png.png?url";
import { registrarCamadas } from "./registroDeTiles.js";

/**
 * O QUE O `png.tsx` DIZ, transcrito.
 *
 * ## POR QUE ESTES NUMEROS PRECISAM CONFERIR COM O ARQUIVO
 *
 * Porque sao a unica coisa do tileset que o navegador nao le sozinha. Se a
 * folha mudar de tamanho no Tiled, estes numeros ficam velhos e o mapa desenha
 * a linha errada da imagem — em silencio, e em parte
 *
 * A folha tem a mesma forma da do mapa 1: 4 colunas, 16 tiles de 64 com 1 de
 * espaco, 259x259 de imagem. E o mesmo `spacing: 1`, que e o que faz o
 * desenho nao encostar a arte na vizinha
 */
const TILESET_MAP_2 = {
  name: "png",
  columns: 4,
  tilewidth: 64,
  tileheight: 64,
  tilecount: 16,
  spacing: 1,
  margin: 0,
};

/**
 * REGISTRA A CAMADA DO MAPA 2.
 *
 * E uma chamada de efeito no import: o `main.jsx` importa este arquivo, e o
 * registro acontece antes do primeiro quadro. Nao ha `await` e nao ha estado
 * de "carregando": ou a camada esta declarada, ou o mapa usa o terreno
 *
 * ## O QUE A CAMADA `PAREDES` FAZ AQUI
 *
 * O nome e o que o `colisaoTiled` procura, e o mapa 2 grava as quatro bordas
 * da sala nela. Sem o registro o mapa 2 ficaria sem colisao: o desenho viria
 * do terreno e o jogador passaria por qualquer parede
 *
 * A lista e curta de proposito — quatro retangulos que fecham a borda — mas
 * e o mesmo arquivo que o servidor le, entao as duas pontas nunca discordam
 */
registrarCamadas("map_2", {
  tmj: tmjDoMapa2,
  imagens: { png: imagemDoMapa2 },

  /**
   * A chave e o NOME DO ARQUIVO, que e o que o `.tmj` traz em `source`.
   *
   * E nao o `name`: num mapa com tileset externo o `name` nao existe no
   * arquivo, e e o `source` que o `lerMapaTiled` encontra para casar
   */
  tilesets: { "png.tsx": TILESET_MAP_2 },
});