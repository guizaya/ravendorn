/**
 * AS CAMADAS DE TILE NO SERVIDOR, lidas do disco.
 *
 * ## POR QUE ISTO EXISTE
 *
 * Porque o movimento online e AUTORITATIVO: o servidor decide para onde o
 * jogador andou. Um servidor sem as paredes do mapa deixa qualquer um
 * atravessar qualquer parede, e o cliente nao tem como corrigir — ele so
 * recebe a posicao final
 *
 * ## E POR QUE LER O ARQUIVO E NAO IMPORTAR
 *
 * Porque `src/data/maps/index.js` e importado pelo servidor em Node puro,
 * e o Node nao entende `.tmj`: o que faz o arquivo virar modulo e o plugin
 * `tiledTmj` do `vite.config.js`, que so existe no build do navegador
 *
 * Ler com `readFileSync` nao tem esse problema — e o Node lendo um arquivo.
 * Nao e gambiarra: e o unico jeito de o arquivo ser a MESMA fonte de
 * verdade dos dois lados
 *
 * ## E POR QUE ISTO REGISTRA, E NAO MONTA UM MAPA SEPARADO
 *
 * Porque o `CollisionSystem` e o mesmo codigo nos dois lados. Registrando no
 * mesmo `registroDeTiles` que o navegador usa, o motor tem UM caminho so para
 * a colisao — e `conferir-paredes-tiled.mjs` compara os dois lados para
 * garantir que continuam iguais
 *
 * ## E O QUE ESTE ARQUIVO NAO FAZ
 *
 * Nao desenha. O servidor nao tem imagem de tileset e nao precisa de uma: a
 * colisao sai de retangulos de objeto, que sao texto no arquivo
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registrarCamadas } from "../../../src/game/maps/registroDeTiles.js";

const AQUI = dirname(fileURLToPath(import.meta.url));

/**
 * O MESMO MAPA QUE O NAVEGADOR LE, apontado pelo caminho do repositorio.
 *
 * E o mesmo caminho relativo do `camadaDoMapa1.js` do cliente, escrito de
 * novo porque os dois arquivos nao compartilham diretorio
 */
const CAMADAS = [
  {
    mapId: "map_1",
    tmj: "src/assets/tilesets/map_1/dungeon.tmj",
    tilesets: { "dungeon.tsx": null },
  },
  {
    mapId: "base",
    tmj: "src/assets/tilesets/base/base.tmj",
    tilesets: {
      "64x64_seamless_top-down_2D_MMORPG_terrain_tile_sho (1).tsx": null,
    },
  },
  {
    /**
     * A ARENA DO HULK.
     *
     * A entrada existe pela MESMA razao das outras duas: o movimento online e
     * autoritativo e o servidor precisa ler o mesmo `.tmj` que o navegador
     * desenha.
     *
     * ## AGORA QUE A BARREIRA SAIU DE CODIGO, ESTA LINHA E OBRIGATORIA
     *
     * A arena nao tem mais `boundsCircle`: quem fecha a sala e a camada de
     * objeto `PAREDES` que voce desenha no `boss_1.tmj`. Sem esta entrada o
     * servidor nao leria essas paredes, e o movimento online passaria por
     * elas — o jogador bateria na parede no cliente e atravessaria no
     * servidor, que e o pior defeito que existe nesta parte do jogo
     *
     * Vale a pena deixar claro que o navegador e o servidor leem o MESMO
     * arquivo: desenhar a parede e salvar no Tiled ja vale nos dois lugares,
     * sem nenhuma mudanca de codigo
     *
     * ## E O `boss_1.tmj` QUE ESTAVA AQUI, E POR QUE MUDOU
     *
     * A arena foi salva no Tiled como `boss.tmj`, e nao como `boss_1.tmj` — o
     * mesmo descasamento de nome que o `camadaDoBoss1.js` do navegador ja
     * documenta. Com o caminho errado aqui o `existsSync` falhava, o mapa
     * seguia sem colisao e a arena barrava so no cliente: o jogador batia na
     * parede na tela e passava por ela no servidor
     */
    mapId: "boss_1",
    tmj: "src/assets/tilesets/boss_1/boss.tmj",
    tilesets: { "dungeon.tsx": null },
  },
  {
    /**
     * O VALE 1.
     *
     * A mesma razao das outras: o movimento online e autoritativo, e o
     * servidor precisa ler o MESMO `vale.tmj` que o navegador desenha.
     *
     * ## E O QUE A CAMADA `PAREDES` FAZ AQUI
     *
     * O vale nao tem mais `limiteVisivel` e nao tem sebe: o que fecha o mundo
     * agora e o anel de retangulos da camada de objeto `PAREDES`, desenhado no
     * Tiled. Sem esta entrada o servidor nao leria esse anel, e o jogador
     * bateria nele no cliente e passaria por ele no servidor — que e o pior
     * defeito que existe nesta parte do jogo
     *
     * ## POR QUE OS SOLIDS DO MAPA 1 NAO SERVEM AQUI
     *
     * Porque os dois campos sao caminhos diferentes: `solids` vem do codigo
     * (os 40 cristais, por `buildPropSolids`) e a camada de objeto vem do
     * arquivo. Registrar o `.tmj` NAO substitui os cristais: eles somem do
     * servidor se esta linha faltar, e as paredes somem se ela sobrar
     */
    mapId: "mapa_teste",
    tmj: "src/assets/tilesets/vale_1/vale.tmj",
    tilesets: { "vale.tsx": null },
  },
  {
    /**
     * O MAPA 2.
     *
     * A mesma razao das outras: o movimento online e autoritativo, e o
     * servidor precisa ler o MESMO `map_2.tmj` que o navegador desenha
     *
     * ## E O QUE A CAMADA `PAREDES` FAZ AQUI
     *
     * O mapa 2 tem quatro retangulos nela, que fecham a borda da sala. Sem
     * esta entrada o servidor nao leria nenhum deles, e o jogador bateria na
     * parede no cliente e atravessaria no servidor — o pior defeito que
     * existe nesta parte do jogo
     *
     * O `tilesets` leva `png.tsx` porque e o que o `source` do `.tmj` traz:
     * o autor chamou a folha de `png` no Tiled, e casar pelo nome do arquivo
     * e o que impede a camada de ser ignorada em silencio
     */
    mapId: "map_2",
    tmj: "src/assets/tilesets/map_2/map_2.tmj",
    tilesets: { "png.tsx": null },
  },
];

/**
 * O JSON DO MAPA, ou `null`.
 *
 * ## POR QUE O `existsSync` VEM ANTES
 *
 * Porque um `readFileSync` em arquivo que nao esta la derruba o servidor na
 * carga, e o sintoma seria o jogo inteiro fora do ar por causa de arte. A
 * falha de arte e a UNICA deste arquivo que pode ser silenciosa: sem o arquivo
 * o mapa fica sem colisao de parede, e ninguem ve nada quebrado — o jogador
 * so passa por onde nao devia
 *
 * ## E POR QUE O ERRO VAI PARA O CONSOLE E O MAPA SEGUE
 *
 * Porque derrubar o servidor por uma arte faltando e pior que serve o mapa
 * sem parede. Quem decide se isso e aceitavel e o mapa — e o mapa esta
 * desenhado em dois lugares: na folha de tiles, que o navegador mostra, e nos
 * solidos, que nao existem mais aqui
 */
function lerArquivo(caminhoRelativo) {
  const caminho = resolve(AQUI, "../../..", caminhoRelativo);

  if (!existsSync(caminho)) {
    console.warn(
      `[tiled] o arquivo "${caminhoRelativo}" nao existe: o mapa segue sem colisao de parede`,
    );

    return null;
  }

  try {
    return JSON.parse(readFileSync(caminho, "utf8"));
  } catch (erro) {
    console.error(`[tiled] o arquivo "${caminhoRelativo}" nao e JSON:`, erro);

    return null;
  }
}

/**
 * REGISTRA AS CAMADAS QUE ESTAO NO DISCO.
 *
 * E chamado uma vez, na partida do servidor. Registrar e idempotente, entao
 * chamar de novo nao duplica nada
 */
export function registrarTilesDoDisco() {
  for (const camada of CAMADAS) {
    const tmj = lerArquivo(camada.tmj);

    if (!tmj) continue;

    registrarCamadas(camada.mapId, {
      tmj,

      /**
       * SEM URL DE IMAGEM, DE PROPOSITO.
       *
       * O navegador precisa dela para DESENHAR a camada de tiles. O servidor
       * so quer a colisao, que sai dos retangulos de objeto e nao precisa de
       * folha nenhuma
       *
       * E por isso que este registro NAO serve para desenhar: chamar
       * `tiledDoMapa` aqui da um erro de "tileset sem imagem registrada",
       * que e o comportamento correto para quem esta no Node sem arte
       */
      imagens: {},
      tilesets: camada.tilesets,
    });
  }
}