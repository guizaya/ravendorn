import { MAPS, findMap } from "../../data/maps/index.js";

/**
 * A ROTA ENTRE MAPAS: que portais atravessar para chegar la.
 *
 * ## POR QUE ISTO E SEPARADO DA NAVEGACAO
 *
 * `NavGrid` responde "como ir de A a B DENTRO de um mapa", e nao tem
 * como responder "como ir de A a B", porque A e B estao em mapas
 * diferentes e cada mapa tem a sua propria grade. O que liga um mapa ao
 * outro e o portal, e o portal e um GRAFO, nao uma lista
 *
 * O grafo do jogo hoje:
 *
 * ```
 *   base --portal_hub--> map_1
 *   map_1 --portal_pantano--> base
 *   map_1 --portal_floresta--> (nada: e enfeite)
 * ```
 *
 * Dois nos, uma aresta util, um beco. Uma BFS resolve em quatro passos.
 * E a BFS que importa, e nao o caso particular: quando o vale virar tres
 * mapas, ou quando existir um portal que so abre com uma chave, o codigo
 * abaixo nao muda
 *
 * ## O BECO E O CASO QUE PRECISA DE RESPOSTA
 *
 * `portal_floresta` esta dentro de `map_1` e nao declara `destino`. Ele
 * aparece no grafo como uma aresta para lugar nenhum, e uma busca que o
 * contasse atravessaria para um mapa `undefined` — o jogador sumiria do
 * mundo sem erro nenhum
 *
 * E por isso que o filtro e `findMap(portal.destino)`, e nao
 * `if (portal.destino)`: um `destino` apagado no registro e exatamente o
 * mesmo defeito, e so o registro sabe dizer a diferenca
 */

/** o mapa -> os portais que SAEM dele */
const GRAFO = new Map();

/**
 * As SAIDAS de um mapa.
 *
 * Uma lista de `{ portal, mapa }`, e nao so de `portal`: quem planeja
 * precisa do mapa de destino no mesmo passo que descobre o portal
 */
function saidasDe(mapa) {
  const saidas = [];

  for (const portal of mapa?.portals ?? []) {
    /**
     * Sem `destino`, o portal e enfeite.
     *
     * E o mesmo teste do `portalSobOsPes`, pela mesma razao: a box de
     * travessia e a rota automatica precisam concordar sobre o que e
     * atravessavel. Se um deles aceitasse o portal decorativo, o
     * jogador atravessaria para o vazio
     */
    if (!portal.destino) continue;

    const destino = findMap(portal.destino);

    if (!destino) continue;

    /**
     * Um portal para o PROPRIO mapa e uma aresta inútil.
     *
     * Entrar ali nao avanca nada e a busca perderia o controle do laco.
     * Descartar a aresta e o que mantem a rota mais curta: ela nunca
     * faz parte de um caminho minimo
     */
    if (destino.id === mapa.id) continue;

    saidas.push({ portal, mapa: destino });
  }

  return saidas;
}

/** o grafo montado na primeira chamada */
function grafo() {
  if (GRAFO.size > 0) return GRAFO;

  for (const mapa of Object.values(MAPS)) {
    GRAFO.set(mapa.id, saidasDe(mapa));
  }

  return GRAFO;
}

/**
 * Os PORTAIS que levam de um mapa a outro, na ordem de travessia.
 *
 * Cada item e `{ portal, mapa }`, e o `portal` e o do mapa de PARTIDA.
 * Quem chama so percorre a lista na ordem
 *
 * Tres respostas distintas, e a diferenca entre elas e o que faz o
 * chamador conseguir explicar a diferenca ao jogador:
 *
 * - `[]` — o jogador JA esta no mapa de destino. Nenhum passo, e nao e
 *   erro: "chegar onde eu ja estou" e um caminho de zero passos
 * - `null` — nao existe caminho. O destino esta em um mapa que nao se
 *   alcanca, e o piloto tem de dizer isso em vez de ficar andando
 * - lista — a rota, com um portal por travessia
 */
export function rotaDeMapas(mapaAtualId, mapaAlvoId) {
  if (!mapaAtualId || !mapaAlvoId) return null;

  if (mapaAtualId === mapaAlvoId) return [];

  const adjacencia = grafo();

  /**
   * A BUSCA em largura, guardando o predecessor de cada no.
   *
   * BFS e a escolha certa porque toda aresta custa o mesmo: uma
   * travessia. Dijkstra daria a mesma resposta com mais codigo
   */
  const anterior = new Map();

  const fila = [mapaAtualId];

  const visitado = new Set([mapaAtualId]);

  while (fila.length > 0) {
    const atual = fila.shift();

    for (const saida of adjacencia.get(atual) ?? []) {
      if (visitado.has(saida.mapa.id)) continue;

      visitado.add(saida.mapa.id);

      anterior.set(saida.mapa.id, { de: atual, saida });

      if (saida.mapa.id === mapaAlvoId) {
        return remontar(anterior, mapaAtualId, mapaAlvoId);
      }

      fila.push(saida.mapa.id);
    }
  }

  return null;
}

/** a lista de saidas do BFS, do inicio ao fim */
function remontar(anterior, partida, alvo) {
  const rota = [];

  let atual = alvo;

  while (atual !== partida) {
    const passo = anterior.get(atual);

    if (!passo) return null;

    rota.unshift(passo.saida);

    atual = passo.de;
  }

  return rota;
}

/**
 * O ID DO MAPA onde a rota termina.
 *
 * So para o chamador conferir se o destino e alcancavel sem percorrer a
 * lista. Um `[portal_hub]` termina em `map_1`, e o `null` do
 * `rotaDeMapas` nao termina em lugar nenhum
 */
export function mapaFinalDaRota(rota, mapaAtualId) {
  if (rota === null) return null;

  return rota.length === 0
    ? mapaAtualId
    : rota[rota.length - 1].mapa.id;
}