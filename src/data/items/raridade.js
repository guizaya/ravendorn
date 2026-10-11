/**
 * AS CINCO RARIDADES DO JOGO, e so isto.
 *
 * ## POR QUE ESTE ARQUIVO EXISTE
 *
 * A tabela de materiais (`data/materiais`) precisa da `RARITY` para dizer
 * que um "reforcado" e incomum, e o catalogo de itens precisa dela para
 * derivar os 55 itens de material na hora de carregar o modulo
 *
 * Com os dois lendo deste arquivo, a dependencia fica de um lado so:
 * `materiais -> items/raridade` e `items/index -> materiais`. Sem este
 * arquivo, o catalogo importaria a tabela que importa o catalogo, e o
 * `RARITY` cairia em "acesso antes da inicializacao" — o crash vem no
 * topo do modulo, e nao numa funcao
 *
 * O `items/index.js` reexporta os tres, entao todo `import { RARITY } from
 * "data/items/index.js"` do jogo continua funcionando sem mudanca
 */

export const RARITY = {
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
};

export const RARITY_ORDER = [
  RARITY.COMMON,
  RARITY.UNCOMMON,
  RARITY.RARE,
  RARITY.EPIC,
  RARITY.LEGENDARY,
];

export const RARITY_STYLE = {
  [RARITY.COMMON]: {
    label: "Comum",
    color: "#c3ccd6",
    weight: 62,
  },
  [RARITY.UNCOMMON]: {
    label: "Incomum",
    color: "#7fd88f",
    weight: 24,
  },
  [RARITY.RARE]: {
    label: "Raro",
    color: "#6fb6ff",
    weight: 10,
  },
  [RARITY.EPIC]: {
    label: "Épico",
    color: "#c489ff",
    weight: 3.4,
  },
  [RARITY.LEGENDARY]: {
    label: "Lendário",
    color: "#ffc857",
    weight: 0.6,
  },
};

