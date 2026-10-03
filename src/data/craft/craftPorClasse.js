/**
 * O craft por classe.
 *
 * Regra: o MATERIAL e comum, o EQUIPAMENTO e de uma classe so.
 *
 * O material e ingrediente, e ingrediente precisa estar disponivel
 * para todo mundo: se o osso de esqueleto fosse do guerreiro, o
 * arqueiro nao teria nem como fazer arco, porque a cadeia de materiais
 * que leva ate ele comeca em material de outra classe.
 *
 * O equipamento nao: espada e do guerreiro e nao do lancer porque as
 * duas Classes se atrapalhariam no mesmo numero de arma, e o arco
 * perderia o sentido de ser uma classe de alcance.
 *
 * Onde a trava mora: em `canClassUseItem` (`data/items/index.js`),
 * que le a FAMILIA da arma, e no `slot` do item, que trava a peca
 * de armadura numa posicao. O craft so pergunta para
 * `Craft.canUse`, e nao repete a regra.
 *
 * O que este modulo NAO faz: segurar uma lista de classes por
 * receita. A lista real e `CLASS_WEAPON_KINDS` e o `slot` do item,
 * e uma lista paralela aqui divergiria dela sem ninguem perceber.
 */
import {
  CLASS_WEAPON_KINDS,
  ITEM_TYPE,
  WEAPON_KIND,
  canClassUseItem,
  classesOfWeaponKind,
  getItem,
} from "../items/index.js";
import { CHARACTER_CLASSES } from "../characters/index.js";

/**
 * As classes que podem criar este item.
 *
 * Devolve `null` quando TODO MUNDO pode, que e o caso do material e
 * da peca que nao declara dona. O `null` e diferente de lista vazia
 * de proposito: lista vazia seria "ninguem pode", e nenhum item do
 * catalogo esta assim.
 *
 * A ordem de quem responde e a mesma de `canClassUseItem`, para os
 * dois nunca discordarem sobre o mesmo item:
 *
 * 1. `item.classes` — a dona declarada. E o que segura a ARMADURA de
 *    uma classe longe da outra, e e o que a familia de
 *    `CLASS_WEAPON_KINDS` nao consegue expressar: familia e de ARMA
 * 2. `item.kind` — so para arma
 * 3. todas as classes, para material e para a peca sem dona
 */
export function classesOfItem(itemId) {
  const item = getItem(itemId);

  if (!item) return null;

  if (item.type === ITEM_TYPE.MATERIAL) return null;

  // a dona declarada tem a primeira palavra, e vale para armadura e
  // reliquia tanto quanto para arma
  if (Array.isArray(item.classes)) {
    return item.classes.length > 0
      ? [...item.classes]
      : null;
  }

  if (item.type === ITEM_TYPE.WEAPON) {
    if (!item.kind) return null;

    return classesOfWeaponKind(item.kind);
  }

  return CHARACTER_CLASSES.map((classe) => classe.id);
}

/** o item e createvel por esta classe? */
export function canCraftItem(itemId, classId) {
  // sem classe nao ha o que restringir: a listagem sem classe mostra
  // o catalogo inteiro
  if (classId === null || classId === undefined) {
    return true;
  }

  return canClassUseItem(getItem(itemId), classId);
}

/**
 * O item e de UMA classe, ou de todo mundo?
 *
 * E a pergunta que o painel de craft faz para decidir se o item
 * entra na lista. Separar "e meu" de "e de todo mundo" evita a
 * confusao de mostrar um item de outra classe com cadeado: item de
 * outra classe simplesmente nao aparece.
 */
export function isExclusiveToClass(itemId) {
  const classes = classesOfItem(itemId);

  return (
    classes !== null &&
    classes.length > 0 &&
    classes.length < CHARACTER_CLASSES.length
  );
}

export { CLASS_WEAPON_KINDS, WEAPON_KIND };
