import {
  CREATURE_TYPES,
  DUMMY_LOOT,
  ZONE_ROSTER,
} from "../enemies/index.js";
import { getZoneById } from "../maps/index.js";
import { BESTIARY_ICON } from "../bestiary/index.js";
import {
  ITEM_TYPE,
  ITEM_TYPE_LABEL,
  RARITY,
  RARITY_ORDER,
  getItem,
} from "../items/index.js";

/**
 * Receitas de craft.
 *
 * As de MATERIAL sao escritas a mao, e continuam sendo. A cadeia de
 * materiais e a parte do jogo que depende de caca: quanto material
 * cada bicho dropa, e em que ordem o jogo vai liberando, e isso e
 * design, nao aritmetica.
 *
 * As de EQUIPAMENTO nao sao escritas a mao. Um item de equipamento
 * sao cinco receitas com a MESMA escalada de quantidade e de nivel de
 * material, e com quatro classes isso sao vinte receitas iguais com o
 * id diferente. Escritas a mao elas divergem - uma quantidade errada
 * so aparece quando o jogador tenta criar. `gerarEquipamento.js`
 * monta essas vinte de uma vez, e o comando
 * `tools/gerar-equipamento.mjs` e o que as escreve no arquivo.
 *
 * O formato e uma lista por item, com as cinco raridades dentro:
 *
 *   {
 *     itemId: "willow_bow",
  *     common:    { coins: 0,  ingredients: [...] },
  *     uncommon:  { coins: 0,  ingredients: [...] },
  *     rare:      { coins: 0,  ingredients: [...] },
  *     epic:      { coins: 0,  ingredients: [...] },
  *     legendary: { coins: 0,  ingredients: [...] },
  *   }
  *
  * A receita do item continua sendo a do catalogo: `coins` e
  * `ingredients` no topo sao o que os chamadores antigos leem, e
  * apontam para a variante na raridade NATURAL do item.
  *
* `coins` existe porque a cadeia de materiais precisa de uma raiz:
   * os tres materiais mais basicos so se compram. Como nao existe
   * loja no jogo, essa e a finalidade das moedas. So esses tres,
   * mais os dois materiais de ogro, cobram moeda: nos outros a
   * progressao e de material, e a moeda viraria um segundo obstaculo
   * sem motivo.
   *
  * Duas regras de design valem para TODAS as receitas:
   *
   * 1. A cadeia so desce de nivel. Nenhuma receita usa um material
   *    de nivel igual ou superior ao seu, o que mantem a progressao
   *    de caça valendo e garante que nao existe ciclo.
   *
   * 2. Subir de raridade troca ingrediente, nao so multiplica
   *    quantidade. O comum e barato e usa material de bicho pequeno;
   *    o lendario exige material de bicho grande. Nas receitas escritas
   *    a mao isso e responsabilidade de quem escreve; nas geradas, e o
   *    que `gerarEquipamento.js` garante.
   *
 * Consequencia pratica: subir de raridade NUNCA e mais barato.
 * A auditoria em craftData.test.js garante isso em todas.
 *
 * ================================================================
 * A CADEIA FOI REESCRITA PARA O MAPA 1
 * ================================================================
 *
 * A regra que manda em TODA receita escrita aqui e uma so:
 *
 *   nenhum ingrediente pode ser material que o jogador nao consiga
 *   no mapa 1, exceto no epic e no lendario
 *
 * A razao e concreta. O mapa 1 tem tres criaturas no roster - `slime`,
 * `ogre` e `ogre_da_predeira` - e elas dropam exatamente cinco
 * materiais: `slime_gel`, `slime_core`, `skeleton_bone`,
 * `ogre_pebble` e `ogre_hide`. Todo o resto da cadeia antiga
 * dependia de `dummy_wood` e `rat_tail`, e nenhum dos dois cai no
 * mapa 1: o primeiro so sai de boneco de treino, e
 * `TRAINING_DUMMY_BLUEPRINTS` e vazio; o segundo so sai de `rat`, e o
 * rato nao esta em nenhum `mix` do `ZONE_ROSTER`.
 *
 * O efeito era que o mapa 1 nao era autossuficiente. Tudo dava para
 * fabricar, mas comprando `dummy_wood` com moeda - e `dummy_wood` era
 * a base de todas as doze pecas de equipamento na raridade comum.
 *
 * O MAPA 2 GUARDA O TOPO. Ele nao tem material proprio: reaproveita
 * `slime` virando `zumbi_arbalist` e `ogre` virando `skeleton`. O que
 * ele dropa so dele sao `ghoul_rot`, `ghoul_claw` e `skeleton_skull`, e
 * sao esses tres que seguram o epic e o lendario. E o que da sentido
 * ao segundo mapa: ele e o degrau final da cadeia, e nao um lugar
 * que repete o primeiro.
 *
 * TRES MATERIAIS FICARAM DE FORA DA CADEIRA
 *
 * `rat_pelt`, `goblin_cloth` e `ghoul_rib` nao dropam de criatura
 * nenhuma que esteja no roster - rato, goblin e ghoul nao estao em
 * nenhum `mix`. Eles continuam no catalogo e continuam com receita, e
 * ainda dao para fabricar e vender, mas nenhum item os usa como
 * ingrediente: um ingrediente que ninguem consegue cacar nem
 * comprar so aparecia na tela como exigencia imposible.
 *
 * DETALHE QUE A CADEIA EXIGE
 *
 * A regra 1 acima (a cadeia so desce de nivel) NAO sozinha impede
 * ciclo entre dois materiais do mesmo nivel. `slime_core` e
 * `skeleton_bone` sao os dois nivel 1, entao um poderia usar o outro -
 * e se os dois fizessem isso, fechava ciclo e dava para fabricar os
 * dois com um unico par. Por isso a camada do nivel 1 tem uma ordem
 * fixa e so usa de tras para frente:
 *
 *     slime_gel -> skeleton_bone -> slime_core -> goblin_cloth
 *
 * O mesmo vale no nivel 2 com `ghoul_rot` e `ghoul_claw`, os dois
 * materia do mapa 2: a garra e o mais simples e nao usa a podricao, e
 * a podricao usa a garra so no topo dela.
 */

/** shorthands de ingrediente, para a receita ficar legivel */
const i = (itemId, count) => ({ itemId, count });

/**
 * Materiais.
 *
 * A base comum usa materia de bicho pequeno. A lendaria troca por
 * material de bicho grande, e a moeda entra so nos materiais de
 * ogro: ele e lento de matar, e quem tem pouco tempo de caça paga
 * para nao repetir a caça.
 */
export const RECIPES = [
  /* ---- raiz: materia bruta so se compra ---- */
  {
    itemId: "dummy_wood",
    coins: 25,
    ingredients: [],
    common: { coins: 25, ingredients: [] },
    uncommon: { coins: 45, ingredients: [] },
    rare: { coins: 75, ingredients: [] },
    epic: { coins: 120, ingredients: [] },
    legendary: { coins: 200, ingredients: [] },
  },
  {
    itemId: "slime_gel",
    coins: 20,
    ingredients: [],
    common: { coins: 20, ingredients: [] },
    uncommon: { coins: 38, ingredients: [] },
    rare: { coins: 62, ingredients: [] },
    epic: { coins: 100, ingredients: [] },
    legendary: { coins: 165, ingredients: [] },
  },
  {
    itemId: "rat_tail",
    coins: 15,
    ingredients: [],
    common: { coins: 15, ingredients: [] },
    uncommon: { coins: 30, ingredients: [] },
    rare: { coins: 50, ingredients: [] },
    epic: { coins: 82, ingredients: [] },
    legendary: { coins: 140, ingredients: [] },
  },
  /* ---- nivel 1: o que o SLIME da ---- */
  {
    itemId: "slime_core",
    coins: 0,
    ingredients: [
      i("slime_gel", 6),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 4)] },
    uncommon: { coins: 0, ingredients: [i("slime_gel", 6)] },
    rare: { coins: 0, ingredients: [i("slime_gel", 9)] },
    epic: { coins: 0, ingredients: [i("slime_gel", 11), i("skeleton_bone", 2)] },
    legendary: { coins: 0, ingredients: [i("slime_gel", 14), i("skeleton_bone", 4)] },
  },
  {
    itemId: "skeleton_bone",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3)] },
    uncommon: { coins: 0, ingredients: [i("slime_gel", 5)] },
    rare: { coins: 0, ingredients: [i("slime_gel", 7)] },
    epic: { coins: 0, ingredients: [i("slime_gel", 10)] },
    legendary: { coins: 0, ingredients: [i("slime_gel", 14), i("rat_tail", 6)] },
  },
  {
    itemId: "rat_pelt",
    coins: 0,
    ingredients: [
      i("slime_gel", 4),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3)] },
    uncommon: { coins: 0, ingredients: [i("slime_gel", 4)] },
    rare: { coins: 0, ingredients: [i("slime_gel", 7)] },
    epic: { coins: 0, ingredients: [i("slime_gel", 10), i("slime_core", 2)] },
    legendary: { coins: 0, ingredients: [i("slime_gel", 14), i("slime_core", 4)] },
  },
  {
    itemId: "goblin_cloth",
    coins: 30,
    ingredients: [
      i("slime_core", 3),
    ],
    common: { coins: 30, ingredients: [i("slime_core", 3)] },
    uncommon: { coins: 55, ingredients: [i("slime_core", 5), i("skeleton_bone", 3)] },
    rare: { coins: 95, ingredients: [i("slime_core", 7), i("skeleton_bone", 4)] },
    epic: { coins: 150, ingredients: [i("slime_core", 9), i("skeleton_bone", 5)] },
    legendary: {
      coins: 240,
      ingredients: [
        i("slime_core", 12),
        i("skeleton_bone", 7),
        i("rat_tail", 6),
      ],
    },
  },
  /* ---- nivel 2: o SEIXO do ogre, e a materia do mapa 2 ---- */
  {
    itemId: "ghoul_rot",
    coins: 0,
    ingredients: [
      i("slime_core", 3),
      i("skeleton_bone", 2),
    ],
    common: { coins: 0, ingredients: [i("slime_core", 3), i("skeleton_bone", 2)] },
    uncommon: { coins: 0, ingredients: [i("slime_core", 5), i("skeleton_bone", 3)] },
    rare: { coins: 0, ingredients: [i("slime_core", 7), i("skeleton_bone", 4)] },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_core", 9),
        i("skeleton_bone", 5),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_core", 12),
        i("skeleton_bone", 7),
        i("ghoul_claw", 4),
      ],
    },
  },
  {
    itemId: "ghoul_claw",
    coins: 0,
    ingredients: [
      i("slime_core", 3),
      i("skeleton_bone", 2),
    ],
    common: { coins: 0, ingredients: [i("slime_core", 2), i("skeleton_bone", 1)] },
    uncommon: { coins: 0, ingredients: [i("slime_core", 3), i("skeleton_bone", 2)] },
    rare: { coins: 0, ingredients: [i("slime_core", 5), i("skeleton_bone", 4)] },
    epic: { coins: 0, ingredients: [i("slime_core", 7), i("skeleton_bone", 5)] },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_core", 9),
        i("skeleton_bone", 7),
        i("rat_tail", 6),
      ],
    },
  },
  {
    itemId: "ogre_pebble",
    coins: 60,
    ingredients: [
      i("slime_core", 4),
      i("skeleton_bone", 3),
    ],
    common: { coins: 60, ingredients: [i("slime_core", 4), i("skeleton_bone", 3)] },
    uncommon: { coins: 95, ingredients: [i("slime_core", 6), i("skeleton_bone", 4)] },
    rare: { coins: 150, ingredients: [i("slime_core", 8), i("skeleton_bone", 6)] },
    epic: {
      coins: 230,
      ingredients: [
        i("slime_core", 10),
        i("skeleton_bone", 7),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 380,
      ingredients: [
        i("slime_core", 13),
        i("skeleton_bone", 9),
        i("ghoul_claw", 4),
      ],
    },
  },
  /* ---- nivel 3: o COURO do ogre, e o cranio ---- */
  {
    itemId: "ghoul_rib",
    coins: 0,
    ingredients: [
      i("slime_core", 6),
      i("skeleton_bone", 4),
    ],
    common: { coins: 0, ingredients: [i("slime_core", 3), i("skeleton_bone", 2)] },
    uncommon: { coins: 0, ingredients: [i("slime_core", 4), i("skeleton_bone", 3)] },
    rare: { coins: 0, ingredients: [i("slime_core", 6), i("skeleton_bone", 4)] },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_core", 8),
        i("skeleton_bone", 5),
        i("skeleton_skull", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_core", 11),
        i("skeleton_bone", 7),
        i("skeleton_skull", 4),
      ],
    },
  },
  {
    itemId: "skeleton_skull",
    coins: 0,
    ingredients: [
      i("skeleton_bone", 9),
      i("slime_core", 5),
    ],
    common: { coins: 0, ingredients: [i("skeleton_bone", 4), i("slime_core", 2)] },
    uncommon: { coins: 0, ingredients: [i("skeleton_bone", 6), i("slime_core", 3)] },
    rare: { coins: 0, ingredients: [i("skeleton_bone", 9), i("slime_core", 5)] },
    epic: {
      coins: 0,
      ingredients: [
        i("skeleton_bone", 12),
        i("slime_core", 6),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("skeleton_bone", 16),
        i("slime_core", 8),
        i("ogre_pebble", 5),
        i("ghoul_claw", 4),
      ],
    },
  },
  {
    itemId: "ogre_hide",
    coins: 130,
    ingredients: [
      i("ogre_pebble", 5),
      i("slime_core", 3),
    ],
    common: { coins: 80, ingredients: [i("ogre_pebble", 3), i("slime_core", 2)] },
    uncommon: { coins: 130, ingredients: [i("ogre_pebble", 5), i("slime_core", 3)] },
    rare: {
      coins: 200,
      ingredients: [
        i("ogre_pebble", 7),
        i("slime_core", 5),
        i("skeleton_bone", 3),
      ],
    },
    epic: {
      coins: 300,
      ingredients: [
        i("ogre_pebble", 9),
        i("slime_core", 6),
        i("skeleton_skull", 2),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 500,
      ingredients: [
        i("ogre_pebble", 12),
        i("slime_core", 8),
        i("skeleton_skull", 4),
        i("ghoul_claw", 4),
      ],
    },
  },
  /* ---- o arco e a aljava do arbalist ---- */
  {
    itemId: "willow_bow",
    coins: 0,
    ingredients: [
      i("slime_gel", 6),
      i("slime_core", 3),
      i("skeleton_bone", 2),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 4), i("slime_core", 2)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 3),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 5),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 6),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 8),
        i("skeleton_bone", 6),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
  {
    itemId: "aljava_arbalist",
    coins: 0,
    ingredients: [
      i("slime_gel", 5),
      i("slime_core", 2),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: { coins: 0, ingredients: [i("slime_gel", 5), i("slime_core", 2)] },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 8),
        i("slime_core", 4),
        i("skeleton_bone", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 11),
        i("slime_core", 5),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
        i("ghoul_claw", 1),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 14),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
        i("skeleton_skull", 1),
      ],
    },
  },
  /* ---- as dez pecas de armadura: o MESMO modelo, so muda o slot ---- */
  {
    itemId: "botas_arbalist",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
      i("slime_core", 1),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 2),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 4),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 5),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
  {
    itemId: "calca_arbalist",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
      i("slime_core", 1),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 2),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 4),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 5),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
  {
    itemId: "capuz_arbalist",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
      i("slime_core", 1),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 2),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 4),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 5),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
  {
    itemId: "luvas_arbalist",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
      i("slime_core", 1),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 2),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 4),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 5),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
  {
    itemId: "peito_arbalist",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
      i("slime_core", 1),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 2),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 4),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 5),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
  {
    itemId: "botas_warrior",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
      i("slime_core", 1),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 2),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 4),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 5),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
  {
    itemId: "calca_warrior",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
      i("slime_core", 1),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 2),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 4),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 5),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
  {
    itemId: "elmo_warrior",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
      i("slime_core", 1),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 2),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 4),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 5),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
  {
    itemId: "luvas_warrior",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
      i("slime_core", 1),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 2),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 4),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 5),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
  {
    itemId: "peito_warrior",
    coins: 0,
    ingredients: [
      i("slime_gel", 3),
      i("slime_core", 1),
    ],
    common: { coins: 0, ingredients: [i("slime_gel", 3), i("slime_core", 1)] },
    uncommon: {
      coins: 0,
      ingredients: [
        i("slime_gel", 6),
        i("slime_core", 2),
        i("skeleton_bone", 2),
      ],
    },
    rare: {
      coins: 0,
      ingredients: [
        i("slime_gel", 9),
        i("slime_core", 4),
        i("skeleton_bone", 3),
        i("ogre_pebble", 2),
      ],
    },
    epic: {
      coins: 0,
      ingredients: [
        i("slime_gel", 12),
        i("slime_core", 5),
        i("skeleton_bone", 4),
        i("ogre_pebble", 3),
        i("ghoul_claw", 2),
      ],
    },
    legendary: {
      coins: 0,
      ingredients: [
        i("slime_gel", 16),
        i("slime_core", 7),
        i("skeleton_bone", 5),
        i("ogre_pebble", 4),
        i("ghoul_claw", 3),
        i("skeleton_skull", 2),
      ],
    },
  },
];

/** a vitrine de uma criatura, mesma regra do bestiario */
function zoneOf(typeId) {
  let best = null;

  for (const row of ZONE_ROSTER) {
    const weight = row.mix?.[typeId] ?? 0;

    if (weight <= 0) continue;
    if (best && weight <= best.weight) continue;

    best = { zone: row.zone, weight };
  }

  return best ? getZoneById(best.zone) : null;
}

function poolTotal(table) {
  let total = 0;

  for (const entry of table?.items ?? []) {
    total += entry.weight ?? 1;
  }

  return total;
}

/**
 * Indice reverso item -> quem dropa.
 *
 * Nao existe nada disso pronto no projeto, e a resposta e sempre
 * derivada das tabelas de loot, entao uma tabela nova de drop
 * aparece no craft sem tocar em nada aqui.
 */
function buildDropIndex() {
  const index = new Map();

  const register = (itemId, source) => {
    const list = index.get(itemId) ?? [];

    list.push(source);
    index.set(itemId, list);
  };

  for (const [creatureId, type] of Object.entries(CREATURE_TYPES)) {
    const table = type.loot;
    const zone = zoneOf(creatureId);
    const total = poolTotal(table);

    for (const entry of table?.items ?? []) {
      register(entry.id, {
        id: creatureId,
        name: type.name,
        icon: BESTIARY_ICON[creatureId] ?? "◆",
        level: type.level,
        color: type.color,
        zoneName: zone?.name ?? null,
        weight: entry.weight ?? 1,
        // quanto do pool daquela criatura e este item. util para
        // o jogador saber se e uma fonte confiavel ou um sorteio
        share: total > 0 ? (entry.weight ?? 1) / total : 0,
      });
    }
  }

  // os bonecos de treino compartilham uma unica tabela, entao
  // viram uma fonte agregada em vez de sete entradas repetidas
  const dummyTotal = poolTotal(DUMMY_LOOT);

  for (const entry of DUMMY_LOOT?.items ?? []) {
    register(entry.id, {
      id: "training_dummy",
      name: "Bonecos de treino",
      icon: "▬",
      level: 1,
      color: "#b78555",
      zoneName: "Acampamento",
      weight: entry.weight ?? 1,
      share:
        dummyTotal > 0 ? (entry.weight ?? 1) / dummyTotal : 0,
    });
  }

  // a fonte mais provavel vem primeiro
  for (const list of index.values()) {
    list.sort((a, b) => b.share - a.share);
  }

  return index;
}

const DROP_INDEX = buildDropIndex();

/** quem dropa o item, da fonte mais provavel para a mais rara */
export function dropSourcesOf(itemId) {
  return DROP_INDEX.get(itemId) ?? [];
}

export const CRAFT_RECIPES = RECIPES.map((recipe, index) => {
  // o tipo vem do item, e nao de uma lista paralela aqui, para a
  // aba do craft nunca divergir do item de verdade
  const item = getItem(recipe.itemId);
  const baseRarity = item?.rarity ?? RARITY.COMMON;

  // o preco e os ingredientes do topo sao a receita na raridade
  // NATURAL do item. Os chamadores antigos leem recipe.coins e
  // recipe.ingredients, e essa e a variante que eles esperam.
  const natural = recipe[baseRarity] ?? recipe;

  return {
    ...recipe,
    id: `craft_${recipe.itemId}`,
    index,
    coins: natural.coins ?? 0,
    ingredients: natural.ingredients ?? [],
    itemType: item?.type ?? ITEM_TYPE.MATERIAL,
    baseRarity,
    ingredientCount: (
      natural.ingredients ?? []
    ).reduce(
      (sum, ingredient) => sum + ingredient.count,
      0,
    ),
  };
});

/**
 * Cada receita existe nas cinco raridades, e as 195 sao escritas.
 *
 * Aqui nao ha calculo nenhum: a variante e lida direto do bloco
 * da raridade no objeto da receita. Se um item nao trouxer a
 * raridade, isso quebra em vez de cair num preco inventado, que
 * era exatamente o que o multiplicador antigo escondia.
 */
function variantOf(recipe, rarity) {
  const written = recipe[rarity] ?? null;

  return {
    id: `craft_${recipe.itemId}_${rarity}`,
    recipeId: recipe.id,
    itemId: recipe.itemId,
    itemType: recipe.itemType,
    rarity,
    isBaseRarity: rarity === recipe.baseRarity,
    coins: written?.coins ?? 0,
    ingredients: (written?.ingredients ?? []).map(
      (ingredient) => ({
        itemId: ingredient.itemId,
        count: ingredient.count,
      }),
    ),
  };
}

export const CRAFT_VARIANTS = CRAFT_RECIPES.flatMap((recipe) =>
  RARITY_ORDER.map((rarity) => variantOf(recipe, rarity)),
);

const VARIANTS_BY_ID = new Map(
  CRAFT_VARIANTS.map((variant) => [variant.id, variant]),
);

const VARIANTS_BY_ITEM = CRAFT_RECIPES.reduce((map, recipe) => {
  map.set(recipe.itemId, new Map());
  return map;
}, new Map());

for (const variant of CRAFT_VARIANTS) {
  VARIANTS_BY_ITEM.get(variant.itemId).set(
    variant.rarity,
    variant,
  );
}

/**
 * A receita de um item numa raridade.
 *
 * Sem `rarity`, cai na raridade natural do item, que e o que a
 * maioria dos chamadores quer. Aceita tanto o id completo da
 * variante quanto o id do item.
 */
export function getCraftVariant(itemId, rarity = null) {
  const byItem =
    VARIANTS_BY_ITEM.get(itemId) ?? null;

  if (byItem) {
    const target = rarity ?? getItem(itemId)?.rarity;

    return byItem.get(target) ?? null;
  }

  // veio um id completo: craft_item_rarity
  return VARIANTS_BY_ID.get(itemId) ?? null;
}

/** as cinco variantes de um item, na ordem de raridade */
export function variantsOf(itemId) {
  const byItem = VARIANTS_BY_ITEM.get(itemId);

  if (!byItem) return [];

  return RARITY_ORDER.map((rarity) => byItem.get(rarity));
}

/**
 * Abas do craft, na mesma ordem de tipos do inventario.
 * Um tipo sem receita nao entra, para nao mostrar aba vazia.
 */
/**
 * Ordem das abas.
 *
 * Material fecha a lista: ele e o ingrediente, nao o resultado,
 * e o inventario tambem deixa "Mat." por ultimo. A ordem e
 * explicita porque a do enum de tipos comeca pelo material, que
 * aqui viraria a primeira aba de proposito contrario.
 */
const CATEGORY_ORDER = [
  ITEM_TYPE.WEAPON,
  ITEM_TYPE.ARMOR,
  ITEM_TYPE.TRINKET,
  ITEM_TYPE.MATERIAL,
];

const CATEGORY_ICON = {
  [ITEM_TYPE.WEAPON]: "⚔",
  [ITEM_TYPE.ARMOR]: "⛊",
  [ITEM_TYPE.TRINKET]: "◈",
  [ITEM_TYPE.MATERIAL]: "⛏",
};

export const CRAFT_CATEGORIES = CATEGORY_ORDER.map(
  (type) => ({
    id: type,
    label: ITEM_TYPE_LABEL[type],
    icon: CATEGORY_ICON[type],
  }),
)
  .map((category) => ({
    ...category,
    recipes: CRAFT_RECIPES.filter(
      (recipe) => recipe.itemType === category.id,
    ),
  }))
  .filter((category) => category.recipes.length > 0);

export function getCraftRecipe(id) {
  return (
    CRAFT_RECIPES.find(
      (recipe) => recipe.id === id || recipe.itemId === id,
    ) ?? null
  );
}