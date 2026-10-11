/**
 * A CAMADA DE TILE DO MAPA 1, e este arquivo so roda no navegador.
 *
 * ## POR QUE O MAPA 1 E O PRIMEIRO A USAR ISSO
 *
 * Porque o `dungeon.tmj` e a exportacao do proprio mapa 1: 94x66 tiles de
 * 64px, que dao 6016x4224 — exatamente as medidas que `MAP_1_WIDTH` e
 * `MAP_1_HEIGHT` ja produzem
 *
 * ## E POR QUE ESTE ARQUIVO EXISTE, E O MAPA NAO DECLARA SO
 *
 * Porque o `GameServer` importa o mesmo `data/maps/index.js` e roda em Node
 * puro. O que faz o `.tmj` virar modulo e o plugin `tiledTmj` do
 * `vite.config.js`, que so existe no build do navegador — e um `import`
 * dele aqui dentro derrubaria o servidor na carga, com um erro que fala de
 * extensao de arquivo e nao de mapa
 *
 * ## E POR QUE OS DADOS DO TILESET ESTAO AQUI E NAO NO `.tmj`
 *
 * Porque o mapa foi salvo com o tileset EXTERNO: o `.tmj` carrega so
 * `{ "firstgid": 1, "source": "dungeon.tsx" }`, e o `dungeon.tsx` tem colunas,
 * contagem e tamanho em XML — que o navegador nao le de `src/assets` sem um
 * fetch
 *
 * Editar o `.tmj` na mao nao resolveria: o Tiled regrava o arquivo inteiro
 * no proximo "Salvar" e o `source` volta a ser so um nome
 */

import tmjDoMapa1 from "../../assets/tilesets/map_1/dungeon.tmj";
import imagemDoMapa1 from "../../assets/tilesets/map_1/dungeon.png?url";
import { registrarCamadas } from "./registroDeTiles.js";

/**
 * O QUE O `dungeon.tsx` DIZ, transcrito.
 *
 * ## POR QUE ESTES NUMEROS PRECISAM CONFERIR COM O ARQUIVO
 *
 * Porque sao a unica coisa do tileset que o navegador nao le sozinha. Se a
 * folha mudar de tamanho no Tiled, estes numeros ficam velhos e o mapa
 * desenha a linha errada da imagem — em silencio, e em parte
 *
 * O `tools/conferir-tiled-mapa.mjs` le o `.tsx` e compara com o que esta
 * aqui. E a unica rede contra esse erro, porque nada no desenho avisa
 */
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
 * REGISTRA A CAMADA DO MAPA 1.
 *
 * E uma chamada de efeito no import: o `main.jsx` importa este arquivo, e o
 * registro acontece antes do primeiro quadro. Nao ha `await` e nao ha estado
 * de "carregando": ou a camada esta declarada, ou o mapa usa o terreno
 */
registrarCamadas("map_1", {
  tmj: tmjDoMapa1,
  imagens: { dungeon: imagemDoMapa1 },

  /**
   * A chave e o NOME DO ARQUIVO, que e o que o `.tmj` traz em `source`.
   *
   * E nao o `name`: num mapa com tileset externo o `name` nao existe no
   * arquivo, e e o `source` que o `lerMapaTiled` encontra para casar
   */
  tilesets: { "dungeon.tsx": TILESET_DUNGEON },
});