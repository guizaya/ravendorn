import { COLLECTIONS } from "../../data/collection/index.js";
import { CREATURE_TYPES } from "../../data/enemies/index.js";

/**
 * PARA ONDE O ITEM LEVA: colecao, codex, ou os dois.
 *
 * ## POR QUE ISTO EXISTE
 *
 * O jogador tem um item na mochila e quer saber o que fazer com ele. As duas
 * respostas estao em paineis diferentes e longe do inventario: o material que
 * serve para uma entrega esta na COLECAO, e o drop de criatura esta no CODEX.
 * Ate aqui o caminho era abrir o painel, varrer a lista e achar a linha
 *
 * ## POR QUE O FILTRO IGNORA O APRIMORAMENTO
 *
 * O pedido e explicito: um arco aprimorado `+3` e o MESMO arco de um requisito
 * de colecao que pede `+0`. O `enhance` do requisito e uma exigencia do
 * crivel, nao uma identidade do item: o que define o par item/requisito e o
 * `itemId`, e e por ele que a busca e feita
 *
 * Se este filtro respeitasse o `enhance`, o jogador que agilidade o arco
 * perderia o atalho, e o atalho sumiria justamente no jogo avancado, que e
 * onde ele e mais util
 *
 * ## POR QUE NAO UM INDICE
 *
 * Uma busca linear por item so no clique e o custo real aqui. Um indice seria
 * mais rapido e custaria um segundo lugar para manter em dia quando um item
 * novo entra no catalogo — e a segunda verdade que sempre fica velha
 */

/** As entradas de colecao que pedem ESTE item. */
export function colecoesQuePedem(itemId) {
  if (!itemId) return [];

  return COLLECTIONS.filter((collection) =>
    (collection.requirements ?? []).some(
      (requirement) => requirement?.itemId === itemId,
    ),
  );
}

/**
 * As criaturas que DROPAM este item.
 *
 * O codigo olha `loot.items`, que e a lista de ids com peso do sorteio. E o
 * mesmo lugar que o servidor le na hora de decideder o drop, entao nao ha
 * segunda tabela para sair de sincronia
 */
export function criaturasQueDropam(itemId) {
  if (!itemId) return [];

  return Object.keys(CREATURE_TYPES).filter((typeId) =>
    (CREATURE_TYPES[typeId]?.loot?.items ?? []).some(
      (drop) => drop?.id === itemId,
    ),
  );
}

/**
 * O que o menu deste item pode oferecer.
 *
 * Devolve `null` para os dois quando o item nao tem relacao nenhuma — e o caso
 * comum, e o menu fica igual ao que era
 */
export function destinosDoItem(itemId) {
  const colecoes = colecoesQuePedem(itemId);
  const criaturas = criaturasQueDropam(itemId);

  if (colecoes.length === 0 && criaturas.length === 0) return null;

  return {
    colecoes,
    criaturas,
    temColecao: colecoes.length > 0,
    temCodex: criaturas.length > 0,
  };
}