/**
 * Gerador de equipamento por classe.
 *
 * Existe para NAO escrever a mao o que ja se repete: um item de
 * equipamento sao cinco receitas (uma por raridade), e com quatro
 * classes sao vinte. Escritas a mao, elas divergem: uma quantidade
 * errada passa, e o jogo so mostra o defeito quando o jogador tenta
 * criar. Aqui a quantidade vem de uma TEOREMA de escalada, entao as
 * vinte saem iguais por construcao.
 *
 * O que este arquivo NAO faz: escrever no catalogo. Ele devolve a
 * receita pronta, e quem aplica e o comando. Ver
 * `tools/gerar-equipamento.mjs`.
 *
 * A escalada tem uma regra de design, que nao e multiplicar preco:
 *
 *   - a quantidade de cada ingrediente CRESCE com a raridade
 *   - a partir da `rare` entra UM ingrediente de nivel mais alto,
 *     e ele nao some mais
 *
 * A segunda regra e a que importa. Um lendario feito so de mais
 * `dummy_wood` e mais caro, nao melhor: ele gasta o mesmo material de
 * inicio que o comum e nao muda o que o jogador precisa caçar. A
 * auditoria em `craftData.test.js` exige que a lendaria troque
 * ingrediente, e este gerador e a forma de nao depender de alguem
 * lembrar disso 20 vezes.
 */
import { RARITY, RARITY_ORDER } from "../items/index.js";

/** as cinco raridades, na ordem de escalada */
const LADDER = RARITY_ORDER;

/**
 * Os materiais por nivel, do mais basico ao mais alto.
 *
 * A chave e a ORDEM de entrada na receita, e nao o nivel: quem
 * escreve escolhe quais materiais usa, e a escalada decide a
 * quantidade de cada um. `promote` e o material que so entra a
 * partir da raridade pedida.
 */
const TIER = {
  // o nivel 0 e o material de inicio: e o unico que pode aparecer
  // numa receita comum
  baixo: ["dummy_wood", "goblin_cloth", "skeleton_bone", "ogre_pebble"],
  // o nivel 1 entra a partir da uncommon
  medio: ["slime_gel", "rat_tail", "goblin_cloth"],
  // o nivel 2 entra a partir da rare
  alto: ["slime_core", "rat_pelt", "ghoul_claw", "ogre_hide"],
  // o nivel 3 entra a partir da epic
  alto2: ["ghoul_rib", "skeleton_skull"],
  // o nivel 4 e o lendario: o material mais caro do jogo
  final: ["ogre_hide", "skeleton_skull"],
};

/** a partir de qual raridade cada nivel de material pode entrar */
const NIVEL_APARTIR_DE = {
  baixo: RARITY.COMMON,
  medio: RARITY.UNCOMMON,
  alto: RARITY.RARE,
  alto2: RARITY.EPIC,
  final: RARITY.LEGENDARY,
};

const ORDEM_NIVEL = ["baixo", "medio", "alto", "alto2", "final"];

const RARITY_INDEX = new Map(
  RARITY_ORDER.map((rarity, index) => [rarity, index]),
);

/**
 * Quantos materiais a raridade pede, em uma regra so.
 *
 * `base * (1 + raridadeIndex)`: comum e 1x, incomum 2x, raro 3x,
 * epico 4x, lendario 5x.
 *
 * O multiplicador de 1x por passo nao eaysao que a lendaria do arco
 * (que e escrita a mao) cobre em 9x: as duas coisas convivem de
 * proposito. A escalada do gerador serve para as receitas novas,
 * que sao todas iguais; a do arco foi ajustada a mao porque o arco ja
 * existia e o balanceamento dele ja foi feito.
 */
function countFor(base, rarityIndex) {
  return Math.max(1, base * (1 + rarityIndex));
}

/** escolhe o material do nivel, sempre o mesmo para o item inteiro */
function pickOf(tierName, index) {
  const pool = TIER[tierName] ?? [];

  return pool[index % pool.length];
}

/**
 * A receita de um item de equipamento, nas cinco raridades.
 *
 * `materiais` e a ESCALA do item: de quais niveis ele puxa. O que a
 * funcao devolve ja tem as cinco entradas escritas, no mesmo formato
 * do `RECIPES` de `data/craft/index.js`, para o gerador poder despejar
 * no arquivo sem traduzir nada.
 *
 * Exemplo — uma espada que usa material de inicio e um de nivel alto
 * a partir do raro:
 *
 *   gerarReceitaEquipamento({
 *     itemId: "cinza_sword",
 *     base: 2,
 *     materiais: ["baixo", "alto"],
 *   })
 */
export function gerarReceitaEquipamento({
  itemId,
  base = 2,
  materiais = ["baixo", "medio"],
  /** a moeda entra so se o item for caro; material nao paga moeda */
  coins = 0,
}) {
  const niveis = materiais.filter((nivel) =>
    ORDEM_NIVEL.includes(nivel),
  );

  // sem nivel declarado, o item usa so material de inicio. E um item
  // sem escalada nao quebra nada: ele simplesmente fica caro em
  // quantidade, e a auditoria so exige troca de ingrediente na
  // lendaria, o que este item nao tem por ser o unico de nivel baixo
  const usados =
    niveis.length > 0
      ? niveis
      : ["baixo"];

  // o material que entra mais tarde e o que a mais cara, entao a
  // escalada de preco acompanha a de ingrediente
  const primeiroNivel = usados[0];

  const raridades = {};

  for (const rarity of LADDER) {
    const raridadeIndex = RARITY_INDEX.get(rarity) ?? 0;

    const ingredients = usados
      .filter(
        (nivel) =>
          (RARITY_INDEX.get(NIVEL_APARTIR_DE[nivel]) ?? 0) <=
          raridadeIndex,
      )
      .map((nivel) => {
        // o material de nivel alto e mais raro entao recebe MENOS
        // unidades que o de baixo: subir de raridade troca a
        // dificuldade, e nao so o numero
        const peso = nivel === primeiroNivel ? base : 1;

        return {
          itemId: pickOf(nivel, usados.indexOf(nivel)),
          count: countFor(peso, raridadeIndex),
        };
      });

    raridades[rarity] = {
      coins,
      ingredients,
    };
  }

  // o topo aponta para a raridade natural, que e o mesmo formato das
  // receitas escritas a mao em `data/craft/index.js`
  const natural = RARITY.COMMON;

  return {
    itemId,
    coins: raridades[natural].coins,
    ingredients: raridades[natural].ingredients,
    ...raridades,
  };
}

/**
 * O item no formato do `ITEMS` de `data/items/index.js`.
 *
 * `slot` e o que trava a peca numa posicao da armadura, e `kind` e o
 * que trava a arma na classe. Os dois sao o que faz o craft ser por
 * classe: sem eles o item seria livre.
 */
export function gerarItemEquipamento({
  id,
  name,
  icon,
  type,
  slot = null,
  kind = null,
  rarity = RARITY.COMMON,
  tier = 1,
  value = 20,
  stats = {},
  classId = null,
}) {
  return {
    id,
    name,
    icon,
    type,
    slot,
    kind,
    rarity,
    tier,
    value,
    stats,
    // a classe dona e a que o craft usa para travar. Nao existe no
    // item porque `canClassUseItem` ja le a familia da arma; este
    // campo existe para o gerador poder conferir que o `kind` bate
    // com a classe
    classId,
  };
}
