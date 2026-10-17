import {
  CREATURE_TYPES,
  DUMMY_LOOT,
  ZONE_ROSTER,
} from "../enemies/index.js";
import { getZoneById } from "../maps/index.js";
import {
  ITEM_TYPE,
  ITEM_TYPE_LABEL,
  RARITY_ORDER,
  getItem,
} from "../items/index.js";
import {
  BASES,
  DEGRAUS,
  MATERIAIS,
  idDoGrau,
  nomeDoGrau,
  receitaDeRefino,
  todosOsMateriais,
} from "../materiais/index.js";

/**
 * As receitas do jogo.
 *
 * ## POR QUE NADA E ESCRITO A MAO
 *
 * Porque existem duas familias de receita e as duas sao uma REGRA:
 *
 * - o REFINO de material, que e sempre "cinco de um grau viram um do
 *   seguinte", nas onze cadeias da tabela `data/materiais`
 * - o EQUIPAMENTO, que e sempre "tres familias de material, com a
 *   quantidade da raridade", em catorze pecas
 *
 * Escritas a mao seriam 44 + 70 receitas e mais de mil linhas em que um
 * id errado so apareceria quando o jogador tentasse criar. Aqui as duas
 * sao geradas de uma tabela curta, e a tabela e o que se edita
 *
 * ## O FORMATO QUE O RESTO DO JOGO ESPERA
 *
 * Continua sendo o de sempre: uma lista por item, com as cinco raridades
 * dentro. `CRAFT_VARIANTS` le `recipe[rarity]` e monta as 195
 * combinacoes, e o `Craft` valida por variante
 *
 * ## E AS CINCO RARIDADES DE UM MATERIAL
 *
 * Um material so existe na raridade do seu grau, mas a receita
 * declara as cinco assim mesmo. Sem os cinco blocos, a variante nascia
 * com `ingredients: []` e `coins: 0` — e uma receita de material sem
 * ingrediente e uma receita que cria o item de graa
 */
const i = (itemId, count) => ({ itemId, count });

/**
 * O MESMO BLOCO NAS CINCO RARIDADES, que e o que um material pede.
 *
 * E por que o preco do refino e sempre zero: o refino troca material por
 * material, e nao ha trabalho nenhum. Se houvesse moeda, o primeiro
 * grau seria mais barato que o drop e o jogador nunca voltaria a cacar
 */
function mesmoEmTodas(ingredients) {
  const bloco = { coins: 0, ingredients };

  return {
    common: bloco,
    uncommon: bloco,
    rare: bloco,
    epic: bloco,
    legendary: bloco,
  };
}

/**
 * AS RECEITAS DE REFINO: 5 de um grau viram 1 do seguinte.
 *
 * Sao 44 — onze cadeias de quatro graus — e nenhuma delas e escrita
 * aqui: `todosOsMateriais` ja sabe, para cada item de material, de que
 * grau ele vem, e `receitaDeRefino` monta a partir dai
 *
 * O ingrediente e SEMPRE o grau de baixo. E o que mantem a cadeia andando
 * para cima e impede que dois materiais do mesmo grau se usem: nao existe
 * nenhuma receita aqui que aceite o proprio resultado
 */
const RECEITAS_DE_REFINO = todosOsMateriais()
  .filter((entrada) => entrada.grau)
  .map((entrada) => {
    const { destino, ingrediente } = receitaDeRefino(entrada);

    return {
      itemId: destino.id,
      ...mesmoEmTodas([i(ingrediente.id, ingrediente.count)]),
    };
  });

/**
 * AS RECEITAS DE EQUIPAMENTO, e as duas tabelas que as geram.
 *
 * ## A COLUNA DE CADA PEÇA
 *
 * `materiais` sao as TRES familias que a peca consome, e `contagens` tem
 * uma linha por raridade, na ordem `comum, incomum, raro, epico,
 * legendary`
 *
 * ## O GRAU SOBE COM A RARIDADE
 *
 * Uma peca comum consome material BASE, a incomum consome REFORCADO, a
 * rara RESISTENTE, a epica REFINADO e a lendaria LENDARIO. A peca e o
 * material andam na mesma escada, e e por isso que a receita nao escreve
 * o grau: ele sai da raridade
 *
 * A excecao esta marcada em `grauFixo` — sao os materiais que o desenho
 * do texto de criacao usou de proposito em outro grau, e o comentario de
 * cada um diz qual
 */
const GRAU_DA_RARIDADE = {
  common: null,
  uncommon: "reforcado",
  rare: "resistente",
  epic: "refinado",
  legendary: "lendario",
};

/**
 * Um ingrediente de receita, escrito na forma curta.
 *
 * `m("osso_quebrado", null, 8)` e "8 de Osso Quebrado" — o material
 * base. `m("osso_quebrado", "reforcado", 3)` e "3 de Osso Quebrado
 * Reforcado"
 *
 * Devolve um PAR `[id, quantidade]` e nao o objeto `{ itemId, count }`
 * porque a tabela de equipamento e uma lista de pares, e um `{...}` em
 * cada um dos 210 ingredientes transformaria a leitura da receita numa
 * parede de chaves
 */
function m(baseId, grau, quantidade) {
  return [idDoGrau(baseId, grau), quantidade];
}

/**
 * AS RECEITAS DE EQUIPAMENTO, e as tabelas do desenho de criacao.
 *
 * ## POR QUE SAO EXPLICITAS E NAO GERADAS POR REGRA
 *
 * Porque o desenho NAO e uma escada uniforme. O arco sobe de grau com a
 * raridade, mas o anel comeca em "Minério Bruto + Pedra Verde" e o
 * amuleto troca Tecido Militar por Aço Temperado quando chega no grau
 * raro. Um gerador de "tres familias, grau = raridade" nao reproduz
 * nenhuma das duas pecas
 *
 * E porque as tabelas do desenho sao o CONTEUDO. As 44 receitas de refino
 * sao uma regra e sao geradas; estas catorze sao design e sao escritas
 *
 * ## O GRAU QUE CADA RARIDADE USA
 *
 * As pecas seguem a escada `reforcado, resistente, refinado, lendario`
 * combinada para os materiais. Onde o desenho escreveu "Epico" ou
 * "Refinado" num degrau que nao era o da escada, vale o grau da escada —
 * e o comentario da peca diz onde isso aconteceu
 *
 * O preco sobe com a raridade porque material de grau alto exige
 * caca de grau alto: 1 / 1,5 / 2,5 / 4 / 6,5
 */
const EQUIPAMENTOS = [
  /* ---- arqueiro: as sete do desenho de criacao ---- */

  {
    itemId: "willow_bow",
    /** as tres familias do arco: osso, tendao e madeira */
    linhas: [
      [m("osso_quebrado", null, 8), m("tendao_ressecado", null, 5), m("madeira_de_lanca", null, 3)],
      [m("osso_quebrado", "reforcado", 3), m("tendao_ressecado", "reforcado", 2), m("madeira_de_lanca", "reforcado", 2)],
      [m("osso_quebrado", "resistente", 3), m("tendao_ressecado", "resistente", 2), m("aco_temperado", null, 2)],
      [m("osso_quebrado", "refinado", 3), m("tendao_ressecado", "refinado", 2), m("aco_temperado", "refinado", 2)],
      [m("osso_quebrado", "lendario", 3), m("tendao_ressecado", "lendario", 2), m("aco_temperado", "lendario", 2)],
    ],
  },

  {
    itemId: "peito_arbalist",
    linhas: [
      [m("couro_goblin", null, 8), m("couro_reforcado", null, 5), m("tecido_militar", null, 3)],
      [m("couro_goblin", "reforcado", 3), m("tecido_militar", "reforcado", 3), m("fragmento_de_ferro", null, 2)],
      [m("couro_goblin", "resistente", 3), m("tecido_militar", "resistente", 3), m("fragmento_de_aco", null, 2)],
      [m("couro_goblin", "refinado", 3), m("tecido_militar", "refinado", 3), m("aco_temperado", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("tecido_militar", "lendario", 3), m("aco_temperado", "lendario", 2)],
    ],
  },

  {
    itemId: "calca_arbalist",
    linhas: [
      [m("couro_goblin", null, 6), m("tendao_ressecado", null, 4), m("tecido_militar", null, 3)],
      [m("couro_goblin", "reforcado", 3), m("tendao_ressecado", "reforcado", 2), m("tecido_militar", "reforcado", 2)],
      [m("couro_goblin", "resistente", 3), m("tendao_ressecado", "resistente", 2), m("tecido_militar", "resistente", 2)],
      [m("couro_goblin", "refinado", 3), m("tendao_ressecado", "refinado", 2), m("tecido_militar", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("tendao_ressecado", "lendario", 2), m("tecido_militar", "lendario", 2)],
    ],
  },

  {
    itemId: "botas_arbalist",
    linhas: [
      [m("couro_goblin", null, 5), m("couro_reforcado", null, 3), m("madeira_de_lanca", null, 2)],
      [m("couro_goblin", "reforcado", 3), m("madeira_de_lanca", "reforcado", 2), m("fragmento_de_ferro", null, 2)],
      [m("couro_goblin", "resistente", 3), m("madeira_de_lanca", "resistente", 2), m("fragmento_de_aco", null, 2)],
      [m("couro_goblin", "refinado", 3), m("madeira_de_lanca", "refinado", 2), m("aco_temperado", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("madeira_de_lanca", "lendario", 2), m("aco_temperado", "lendario", 2)],
    ],
  },

  {
    itemId: "luvas_arbalist",
    linhas: [
      [m("tendao_ressecado", null, 5), m("couro_goblin", null, 4), m("tecido_militar", null, 2)],
      [m("tendao_ressecado", "reforcado", 3), m("couro_goblin", "reforcado", 3), m("tecido_militar", "reforcado", 2)],
      [m("tendao_ressecado", "resistente", 3), m("couro_goblin", "resistente", 3), m("tecido_militar", "resistente", 2)],
      [m("tendao_ressecado", "refinado", 3), m("couro_goblin", "refinado", 3), m("tecido_militar", "refinado", 2)],
      [m("tendao_ressecado", "lendario", 3), m("couro_goblin", "lendario", 3), m("tecido_militar", "lendario", 2)],
    ],
  },

  /**
   * OS SEIS ACESSORIOS.
   *
   * ## POR QUE SEIS RECEITAS E NAO DUAS
   *
   * Porque eram dois itens, e agora sao tres aneis e tres amuletos — um por
   * atributo. A receita e por item, entao as seis precisam existir: sem a
   * linha, a aba de craft mostra a peca e nunca da para criar
   *
   * ## A ESCALA DE CADA EIXO
   *
   * O anel de forca e o de mana sobem de familia de materia, como o anel
   * antigo fazia. O de vigor fica no couro e no tendao, que e o par de
   * resistencia do jogo. Os tres amuletos recebem Aco Temperado a partir do
   * grau raro, que e o que os torna as pecas caras
   *
   * Nenhum tem `classes`: a trava de classe do craft e a familia da arma, e
   * reliquia nao tem familia
   */

  {
    itemId: "anel_de_forca",
    linhas: [
      [m("minerio_bruto", null, 5), m("pedra_verde_bruta", null, 2)],
      [m("minerio_bruto", "reforcado", 3), m("pedra_verde_bruta", "reforcado", 2)],
      [m("fragmento_de_ferro", null, 3), m("pedra_verde_bruta", "resistente", 2)],
      [m("fragmento_de_aco", null, 3), m("pedra_verde_bruta", "refinado", 2)],
      [m("aco_temperado", null, 3), m("pedra_verde_bruta", "lendario", 2)],
    ],
  },

  {
    itemId: "anel_de_mana",
    linhas: [
      [m("essencia_necrotica", null, 4), m("pedra_verde_bruta", null, 2)],
      [m("essencia_necrotica", "reforcado", 3), m("pedra_verde_bruta", "reforcado", 2)],
      [m("essencia_necrotica", "resistente", 3), m("pedra_verde_bruta", "resistente", 2)],
      [m("essencia_necrotica", "refinado", 3), m("pedra_verde_bruta", "refinado", 2)],
      [m("essencia_necrotica", "lendario", 3), m("pedra_verde_bruta", "lendario", 2)],
    ],
  },

  {
    itemId: "anel_de_vigor",
    linhas: [
      [m("couro_goblin", null, 4), m("tendao_ressecado", null, 3)],
      [m("couro_goblin", "reforcado", 3), m("tendao_ressecado", "reforcado", 2)],
      [m("couro_goblin", "resistente", 3), m("tendao_ressecado", "resistente", 2)],
      [m("couro_goblin", "refinado", 3), m("tendao_ressecado", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("tendao_ressecado", "lendario", 2)],
    ],
  },

  {
    itemId: "amuleto_de_forca",
    linhas: [
      [m("minerio_bruto", null, 6), m("pedra_verde_bruta", null, 2)],
      [m("fragmento_de_ferro", "reforcado", 4), m("pedra_verde_bruta", "reforcado", 2)],
      [m("fragmento_de_aco", null, 4), m("pedra_verde_bruta", "resistente", 2)],
      [m("aco_temperado", "refinado", 3), m("pedra_verde_bruta", "refinado", 2)],
      [m("aco_temperado", "lendario", 3), m("pedra_verde_bruta", "lendario", 2)],
    ],
  },

  {
    itemId: "amuleto_de_mana",
    linhas: [
      [m("essencia_necrotica", null, 5), m("pedra_verde_bruta", null, 2), m("tecido_militar", null, 2)],
      [m("essencia_necrotica", "reforcado", 4), m("pedra_verde_bruta", "reforcado", 2), m("tecido_militar", "reforcado", 2)],
      [m("essencia_necrotica", "resistente", 3), m("pedra_verde_bruta", "resistente", 2), m("aco_temperado", null, 2)],
      [m("essencia_necrotica", "refinado", 3), m("pedra_verde_bruta", "refinado", 2), m("aco_temperado", "refinado", 2)],
      [m("essencia_necrotica", "lendario", 3), m("pedra_verde_bruta", "lendario", 2), m("aco_temperado", "lendario", 2)],
    ],
  },

  {
    itemId: "amuleto_de_vigor",
    linhas: [
      [m("couro_goblin", null, 5), m("tendao_ressecado", null, 4), m("osso_quebrado", null, 2)],
      [m("couro_goblin", "reforcado", 4), m("tendao_ressecado", "reforcado", 3), m("osso_quebrado", "reforcado", 2)],
      [m("couro_goblin", "resistente", 3), m("tendao_ressecado", "resistente", 3), m("osso_quebrado", "resistente", 2)],
      [m("couro_goblin", "refinado", 3), m("tendao_ressecado", "refinado", 3), m("osso_quebrado", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("tendao_ressecado", "lendario", 3), m("osso_quebrado", "lendario", 2)],
    ],
  },

  /* ---- arqueiro: as duas que o desenho nao listou ----
     O capuz e a aljava nao aparecem nas tabelas do txt. Montados no mesmo
     padrao das outras: duas ou tres familias e a escala da raridade. Sao
     as duas unicas pecas do arquiro que ficariam sem receita, e uma peca
     sem receita e uma aba de craft que mostra a peca e nunca da para criar */

  {
    itemId: "capuz_arbalist",
    linhas: [
      [m("couro_goblin", null, 4), m("tendao_ressecado", null, 3), m("tecido_militar", null, 2)],
      [m("couro_goblin", "reforcado", 3), m("tendao_ressecado", "reforcado", 2), m("tecido_militar", "reforcado", 2)],
      [m("couro_goblin", "resistente", 3), m("tendao_ressecado", "resistente", 2), m("tecido_militar", "resistente", 2)],
      [m("couro_goblin", "refinado", 3), m("tendao_ressecado", "refinado", 2), m("tecido_militar", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("tendao_ressecado", "lendario", 2), m("tecido_militar", "lendario", 2)],
    ],
  },

  {
    itemId: "aljava_arbalist",
    linhas: [
      [m("madeira_de_lanca", null, 5), m("tendao_ressecado", null, 2), m("pedra_verde_bruta", null, 2)],
      [m("madeira_de_lanca", "reforcado", 3), m("tendao_ressecado", "reforcado", 2), m("pedra_verde_bruta", "reforcado", 2)],
      [m("madeira_de_lanca", "resistente", 3), m("tendao_ressecado", "resistente", 2), m("pedra_verde_bruta", "resistente", 2)],
      [m("madeira_de_lanca", "refinado", 3), m("tendao_ressecado", "refinado", 2), m("pedra_verde_bruta", "refinado", 2)],
      [m("madeira_de_lanca", "lendario", 3), m("tendao_ressecado", "lendario", 2), m("pedra_verde_bruta", "lendario", 2)],
    ],
  },

  /* ---- guerreiro: as cinco de armadura ----
     O desenho lista sete pecas, todas do arquiro. Sem estas o Guerreiro
     ficaria sem nenhuma armadura craftavel, entao entram com as MESMAS
     familias de material do arquiro e a mesma escala — e o que mantem o
     Guerreiro no mesmo ritmo de progressao, e nao atrasado por causa de
     uma lista que nao o citava. As duas armas dele vem logo abaixo */

  {
    itemId: "peito_warrior",
    linhas: [
      [m("couro_goblin", null, 8), m("couro_reforcado", null, 5), m("tecido_militar", null, 3)],
      [m("couro_goblin", "reforcado", 3), m("tecido_militar", "reforcado", 3), m("fragmento_de_ferro", null, 2)],
      [m("couro_goblin", "resistente", 3), m("tecido_militar", "resistente", 3), m("fragmento_de_aco", null, 2)],
      [m("couro_goblin", "refinado", 3), m("tecido_militar", "refinado", 3), m("aco_temperado", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("tecido_militar", "lendario", 3), m("aco_temperado", "lendario", 2)],
    ],
  },

  {
    itemId: "elmo_warrior",
    linhas: [
      [m("fragmento_de_ferro", null, 6), m("couro_goblin", null, 3), m("tecido_militar", null, 3)],
      [m("fragmento_de_ferro", "reforcado", 3), m("couro_goblin", "reforcado", 3), m("tecido_militar", "reforcado", 2)],
      [m("fragmento_de_ferro", "resistente", 3), m("couro_goblin", "resistente", 3), m("tecido_militar", "resistente", 2)],
      [m("fragmento_de_ferro", "refinado", 3), m("couro_goblin", "refinado", 3), m("tecido_militar", "refinado", 2)],
      [m("fragmento_de_ferro", "lendario", 3), m("couro_goblin", "lendario", 3), m("tecido_militar", "lendario", 2)],
    ],
  },

  {
    itemId: "calca_warrior",
    linhas: [
      [m("couro_goblin", null, 6), m("tendao_ressecado", null, 4), m("tecido_militar", null, 3)],
      [m("couro_goblin", "reforcado", 3), m("tendao_ressecado", "reforcado", 2), m("tecido_militar", "reforcado", 2)],
      [m("couro_goblin", "resistente", 3), m("tendao_ressecado", "resistente", 2), m("tecido_militar", "resistente", 2)],
      [m("couro_goblin", "refinado", 3), m("tendao_ressecado", "refinado", 2), m("tecido_militar", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("tendao_ressecado", "lendario", 2), m("tecido_militar", "lendario", 2)],
    ],
  },

  {
    itemId: "botas_warrior",
    linhas: [
      [m("couro_goblin", null, 5), m("couro_reforcado", null, 3), m("madeira_de_lanca", null, 2)],
      [m("couro_goblin", "reforcado", 3), m("madeira_de_lanca", "reforcado", 2), m("fragmento_de_ferro", null, 2)],
      [m("couro_goblin", "resistente", 3), m("madeira_de_lanca", "resistente", 2), m("fragmento_de_aco", null, 2)],
      [m("couro_goblin", "refinado", 3), m("madeira_de_lanca", "refinado", 2), m("aco_temperado", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("madeira_de_lanca", "lendario", 2), m("aco_temperado", "lendario", 2)],
    ],
  },

  {
    itemId: "luvas_warrior",
    linhas: [
      [m("tendao_ressecado", null, 5), m("couro_goblin", null, 4), m("tecido_militar", null, 2)],
      [m("tendao_ressecado", "reforcado", 3), m("couro_goblin", "reforcado", 3), m("tecido_militar", "reforcado", 2)],
      [m("tendao_ressecado", "resistente", 3), m("couro_goblin", "resistente", 3), m("tecido_militar", "resistente", 2)],
      [m("tendao_ressecado", "refinado", 3), m("couro_goblin", "refinado", 3), m("tecido_militar", "refinado", 2)],
      [m("tendao_ressecado", "lendario", 3), m("couro_goblin", "lendario", 3), m("tecido_militar", "lendario", 2)],
    ],
  },

  /* ---- guerreiro: as duas armas ----
     A ESPADA e a arma principal, e o ESCUDO a secundaria. Nenhum dos dois
     declara `allowedClasses` na receita: a restricao vem do proprio item,
     em `classesOfItem` — a espada pelo `kind` (`sword`, que so o Guerreiro
     tem em `CLASS_WEAPON_KINDS`) e o escudo pelo `classes`. Escrever a classe
     aqui seria uma terceira fonte de verdade para a mesma regra, e a que
     mais cedo mentira: trocar a familia da espada no catalogo mudaria o
     `kind` e a receita continuaria permitindo o Guerreiro */

  {
    itemId: "espada_warrior",
    /**
     * As tres familias da espada: o ferro da lamina, o aco do fio e o osso
     * do cabo. As tres aceitam os cinco graus, entao a subida de preco e
     * so no grau do material — e nao numa troca de familia no meio, como o
     * peito faz
     */
    linhas: [
      [m("fragmento_de_ferro", null, 8), m("aco_temperado", null, 4), m("osso_quebrado", null, 3)],
      [m("fragmento_de_ferro", "reforcado", 3), m("aco_temperado", "reforcado", 3), m("osso_quebrado", "reforcado", 2)],
      [m("fragmento_de_ferro", "resistente", 3), m("aco_temperado", "resistente", 3), m("osso_quebrado", "resistente", 2)],
      [m("fragmento_de_ferro", "refinado", 3), m("aco_temperado", "refinado", 3), m("osso_quebrado", "refinado", 2)],
      [m("fragmento_de_ferro", "lendario", 3), m("aco_temperado", "lendario", 3), m("osso_quebrado", "lendario", 2)],
    ],
  },

  {
    itemId: "escudo_warrior",
    /**
     * Madeira na tampa, couro na face e ferro no aro.
     *
     * As tres familias sao as mesmas do resto da armadura do Guerreiro, e nao
     * por coquetel: `madeira_de_lanca`, `couro_goblin` e `fragmento_de_ferro`
     * ja sao o eixo das pecas dele, e um escudo com outra materia puxaria o
     * Guerreiro para uma curva de custo diferente da do resto do conjunto
     *
     * O `escudo_warrior` e `type: WEAPON` no `slot` `weapon2`, e nao ARMOR:
     * o slot `weapon2` so aceita `WEAPON`, entao um escudo com o outro type
     * simplesmente nao entraria em lugar nenhum
     */
    linhas: [
      [m("madeira_de_lanca", null, 6), m("couro_goblin", null, 5), m("fragmento_de_ferro", null, 2)],
      [m("madeira_de_lanca", "reforcado", 3), m("couro_goblin", "reforcado", 3), m("fragmento_de_ferro", "reforcado", 2)],
      [m("madeira_de_lanca", "resistente", 3), m("couro_goblin", "resistente", 3), m("fragmento_de_ferro", "resistente", 2)],
      [m("madeira_de_lanca", "refinado", 3), m("couro_goblin", "refinado", 3), m("fragmento_de_ferro", "refinado", 2)],
      [m("madeira_de_lanca", "lendario", 3), m("couro_goblin", "lendario", 3), m("fragmento_de_ferro", "lendario", 2)],
    ],
  },

  /* ---- sorcerer: as sete pecas ----
     O Sorcerer nao tinha NENHUMA receita: `CLASS_WEAPON_KINDS` ja apontava
     para `staff`, mas nao havia item, arte nem linha de craft da classe. Sao
     sete pecas entao, e nao cinco como o Guerreiro

     ## AS FAMILIES NAO SAO AS DO GUERREIRO, E E DE PROPONITO

     O Guerreiro e o Arqueiro compartilham couro, tecido e madeira porque
     vestem o corpo. O conjureiro manipula essencia e cristal, entao entra
     `essencia_necrotica` e `pedra_verde_bruta` — duas familias que nenhum
     outro conjunto usa. Sem isso o Sorcerer seria o Guerreiro com nome
     diferente, e o jogador nao sentiria a classe no craft, so na arte

     ## E AS TRES QUE ELE COMPARTILHA

     `tecido_militar`, `couro_goblin`, `madeira_de_lanca`, `fragmento_de_ferro`
     e `aco_temperado` aparecem aqui tambem, nas pecas que sao roupa de
     verdade (calca, peito, botas, luvas). E o que mantem o custo por peca
     parecido entre as classes, mesmo com a identidade trocada */

  {
    itemId: "cajado_sorcerer",
    /**
     * Madeira na haste, essencia no canal e cristal na ponta. As tres
     * familias aceitam os cinco graus, entao a subida e so no grau
     */
    linhas: [
      [m("madeira_de_lanca", null, 8), m("essencia_necrotica", null, 5), m("pedra_verde_bruta", null, 3)],
      [m("madeira_de_lanca", "reforcado", 3), m("essencia_necrotica", "reforcado", 3), m("pedra_verde_bruta", "reforcado", 2)],
      [m("madeira_de_lanca", "resistente", 3), m("essencia_necrotica", "resistente", 3), m("pedra_verde_bruta", "resistente", 2)],
      [m("madeira_de_lanca", "refinado", 3), m("essencia_necrotica", "refinado", 3), m("pedra_verde_bruta", "refinado", 2)],
      [m("madeira_de_lanca", "lendario", 3), m("essencia_necrotica", "lendario", 3), m("pedra_verde_bruta", "lendario", 2)],
    ],
  },

  {
    itemId: "livro_habilidade_sorcerer",
    /**
     * Tecido na encadernacao, essencia na tinta e cristal na pedra de
     * guarda. Nao usa couro: e a unica peca da classe sem couro nem metal
     */
    linhas: [
      [m("tecido_militar", null, 6), m("essencia_necrotica", null, 4), m("pedra_verde_bruta", null, 3)],
      [m("tecido_militar", "reforcado", 3), m("essencia_necrotica", "reforcado", 3), m("pedra_verde_bruta", "reforcado", 2)],
      [m("tecido_militar", "resistente", 3), m("essencia_necrotica", "resistente", 3), m("pedra_verde_bruta", "resistente", 2)],
      [m("tecido_militar", "refinado", 3), m("essencia_necrotica", "refinado", 3), m("pedra_verde_bruta", "refinado", 2)],
      [m("tecido_militar", "lendario", 3), m("essencia_necrotica", "lendario", 3), m("pedra_verde_bruta", "lendario", 2)],
    ],
  },

  {
    itemId: "peito_sorcerer",
    linhas: [
      [m("tecido_militar", null, 8), m("couro_goblin", null, 5), m("essencia_necrotica", null, 3)],
      [m("tecido_militar", "reforcado", 3), m("couro_goblin", "reforcado", 3), m("essencia_necrotica", "reforcado", 3)],
      [m("tecido_militar", "resistente", 3), m("couro_goblin", "resistente", 3), m("essencia_necrotica", "resistente", 2)],
      [m("tecido_militar", "refinado", 3), m("couro_goblin", "refinado", 3), m("essencia_necrotica", "refinado", 2)],
      [m("tecido_militar", "lendario", 3), m("couro_goblin", "lendario", 3), m("essencia_necrotica", "lendario", 2)],
    ],
  },

  {
    itemId: "capuz_sorcerer",
    linhas: [
      [m("tecido_militar", null, 6), m("couro_goblin", null, 4), m("pedra_verde_bruta", null, 3)],
      [m("tecido_militar", "reforcado", 3), m("couro_goblin", "reforcado", 3), m("pedra_verde_bruta", "reforcado", 2)],
      [m("tecido_militar", "resistente", 3), m("couro_goblin", "resistente", 3), m("pedra_verde_bruta", "resistente", 2)],
      [m("tecido_militar", "refinado", 3), m("couro_goblin", "refinado", 3), m("pedra_verde_bruta", "refinado", 2)],
      [m("tecido_militar", "lendario", 3), m("couro_goblin", "lendario", 3), m("pedra_verde_bruta", "lendario", 2)],
    ],
  },

  {
    itemId: "calca_sorcerer",
    linhas: [
      [m("tecido_militar", null, 6), m("couro_goblin", null, 4), m("madeira_de_lanca", null, 3)],
      [m("tecido_militar", "reforcado", 3), m("couro_goblin", "reforcado", 3), m("madeira_de_lanca", "reforcado", 2)],
      [m("tecido_militar", "resistente", 3), m("couro_goblin", "resistente", 3), m("madeira_de_lanca", "resistente", 2)],
      [m("tecido_militar", "refinado", 3), m("couro_goblin", "refinado", 3), m("madeira_de_lanca", "refinado", 2)],
      [m("tecido_militar", "lendario", 3), m("couro_goblin", "lendario", 3), m("madeira_de_lanca", "lendario", 2)],
    ],
  },

  {
    itemId: "botas_sorcerer",
    linhas: [
      [m("couro_goblin", null, 5), m("madeira_de_lanca", null, 3), m("pedra_verde_bruta", null, 2)],
      [m("couro_goblin", "reforcado", 3), m("madeira_de_lanca", "reforcado", 2), m("pedra_verde_bruta", "reforcado", 2)],
      [m("couro_goblin", "resistente", 3), m("madeira_de_lanca", "resistente", 2), m("pedra_verde_bruta", "resistente", 2)],
      [m("couro_goblin", "refinado", 3), m("madeira_de_lanca", "refinado", 2), m("pedra_verde_bruta", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("madeira_de_lanca", "lendario", 2), m("pedra_verde_bruta", "lendario", 2)],
    ],
  },

  {
    itemId: "luvas_sorcerer",
    linhas: [
      [m("couro_goblin", null, 5), m("tecido_militar", null, 3), m("essencia_necrotica", null, 2)],
      [m("couro_goblin", "reforcado", 3), m("tecido_militar", "reforcado", 2), m("essencia_necrotica", "reforcado", 2)],
      [m("couro_goblin", "resistente", 3), m("tecido_militar", "resistente", 2), m("essencia_necrotica", "resistente", 2)],
      [m("couro_goblin", "refinado", 3), m("tecido_militar", "refinado", 2), m("essencia_necrotica", "refinado", 2)],
      [m("couro_goblin", "lendario", 3), m("tecido_militar", "lendario", 2), m("essencia_necrotica", "lendario", 2)],
    ],
  },
];

/**
 * A receita de UMA peca, com as cinco raridades montadas.
 *
 * E o preco que sobe: material de grau alto custa caca de grau alto, e
 * uma peca lendaria exige material lendario. A curva 1 / 1,5 / 2,5 / 4 /
 * 6,5 e a mesma que os custos de mercado usam
 */
function receitaDeEquipamento(equipamento) {
  const precos = [1, 1.5, 2.5, 4, 6.5];

  const bloco = {};

  RARITY_ORDER.forEach((raridade, indice) => {
    bloco[raridade] = {
      coins: Math.round(60 * precos[indice]),
      ingredients: (equipamento.linhas[indice] ?? []).map((entrada) => ({
        itemId: entrada[0],
        count: entrada[1],
      })),
    };
  });

  return { itemId: equipamento.itemId, ...bloco };
}

export const RECIPES = [
  ...RECEITAS_DE_REFINO,
  ...EQUIPAMENTOS.map(receitaDeEquipamento),
];

/**
 * Quem dropa um item, e o tanto do pool daquele bicho que ele representa.
 *
 * ## POR QUE O ICONE FICOU AQUI
 *
 * Porque este arquivo e o que o painel do craft le para mostrar "onde
 * isso cai". O icone morava no catalogo de bestiario, e o bestiario
 * sai nesta etapa: sem mover o mapa para ca, o painel passaria a buscar
 * um modulo que nao existe mais
 *
 * Sao os glifos de reserva do catalogo de criaturas, e nao arte: o icone
 * de um bicho aqui e um detalhe de uma linha de texto, nao a coisa que o
 * jogador esta olhando
 */
const ICONE_DA_CRIATURA = {
  slime: "☠",
  rat: "⌇",
  goblin: "◆",
  ghoul: "☣",
  skeleton: "⚔",
  zumbi_arbalist: "⚑",
  ogre_da_predeira: "◈",
  ogre: "◈",
  hulk: "⬤",
};

/** a soma dos pesos de um pool de drop */
function poolTotal(table) {
  let total = 0;

  for (const entry of table?.items ?? []) {
    total += entry.weight ?? 1;
  }

  return total;
}

/** a zona de uma criatura, ou `null` */
function zoneOf(creatureId) {
  for (const zone of ZONE_ROSTER) {
    if (zone.creatures?.includes(creatureId)) {
      return getZoneById(zone.id) ?? null;
    }
  }

  return null;
}

/**
 * Indice reverso item -> quem dropa.
 *
 * E DERIVADO das tabelas de loot, e nao escrito: uma tabela de drop nova
 * aparece no painel do craft sem tocar em nada aqui
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
        icon: ICONE_DA_CRIATURA[creatureId] ?? "◆",
        level: type.level,
        color: type.color,
        zoneName: zone?.name ?? null,
        weight: entry.weight ?? 1,
        share: total > 0 ? (entry.weight ?? 1) / total : 0,
      });
    }
  }

  /**
   * Os bonecos de treino compartilham uma unica tabela, entao viram uma
   * fonte agregada em vez de sete entradas repetidas
   */
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
      share: dummyTotal > 0 ? (entry.weight ?? 1) / dummyTotal : 0,
    });
  }

  return index;
}

const DROP_INDEX = buildDropIndex();

/** quem dropa o item, da fonte mais provavel para a mais rara */
export function dropSourcesOf(itemId) {
  return DROP_INDEX.get(itemId) ?? [];
}

export const CRAFT_RECIPES = RECIPES.map((recipe, index) => {
  // o tipo vem do item, e nao de uma lista paralela aqui, para a aba do
  // craft nunca divergir do item de verdade
  const item = getItem(recipe.itemId);
  const baseRarity = item?.rarity ?? "common";

  /**
   * O topo da receita e a variante na raridade NATURAL do item.
   *
   * Os chamadores antigos leem `recipe.coins` e `recipe.ingredients`, e
   * e essa variante que eles esperam
   */
  const natural = recipe[baseRarity] ?? recipe;

  return {
    ...recipe,
    id: `craft_${recipe.itemId}`,
    index,
    coins: natural.coins ?? 0,
    ingredients: natural.ingredients ?? [],
    itemType: item?.type ?? ITEM_TYPE.MATERIAL,
    baseRarity,
    ingredientCount: (natural.ingredients ?? []).reduce(
      (sum, ingredient) => sum + ingredient.count,
      0,
    ),
  };
});

/**
 * Cada receita existe nas cinco raridades.
 *
 * Aqui nao ha calculo nenhum: a variante e lida direto do bloco da
 * raridade no objeto da receita. Um item que nao traga a raridade quebra
 * em vez de cair num preco inventado
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
    ingredients: (written?.ingredients ?? []).map((ingredient) => ({
      itemId: ingredient.itemId,
      count: ingredient.count,
    })),
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
  VARIANTS_BY_ITEM.get(variant.itemId).set(variant.rarity, variant);
}

/**
 * A receita de um item numa raridade.
 *
 * Sem `rarity`, cai na raridade natural do item. Aceita tanto o id
 * completo da variante quanto o id do item
 */
export function getCraftVariant(itemId, rarity = null) {
  const byItem = VARIANTS_BY_ITEM.get(itemId) ?? null;

  if (byItem) {
    const target = rarity ?? getItem(itemId)?.rarity;

    return byItem.get(target) ?? null;
  }

  return VARIANTS_BY_ID.get(itemId) ?? null;
}

/** as cinco variantes de um item, na ordem de raridade */
export function variantsOf(itemId) {
  const byItem = VARIANTS_BY_ITEM.get(itemId);

  if (!byItem) return [];

  return RARITY_ORDER.map((rarity) => byItem.get(rarity));
}

/**
 * Ordem das abas.
 *
 * Material fecha a lista: ele e o ingrediente, nao o resultado, e o
 * inventario tambem deixa "Mat." por ultimo
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

/**
 * O NOME DA ABA, QUE NAO E SEMPRE O NOME DO TIPO.
 *
 * ## POR QUE SO O TRINKET DIVERGE
 *
 * Porque o `ITEM_TYPE_LABEL` chama o tipo de "Relíquia", e esse nome veio de
 * quando havia um anel e um amuleto — peça de alto valor que se guarda como
 * relíquia. Sao seis aneis e seis amuletos agora, tres de cada, e nenhum
 * deles é relíquia: sao ajuste de atributo que o jogador usa no ombro e na
 * mao
 *
 * ## POR QUE NAO TROCA O ROTULO DO TIPO INTEIRO
 *
 * Porque o mesmo rotulo aparece na aba do mercado, no tooltip do item e no
 * painel de encantamento. Trocar la dentro mudaria quatro telas sem ninguem
 * pedir. A aba do craft e a unica que o jogador escolhe pelo nome, e e a
 * unica que ganhou o nome novo
 *
 * Se um dia "acessório" for o nome certo em todas elas, o lugar de mudar e
 * o `ITEM_TYPE_LABEL` — e esta linha some junto
 */
const CATEGORY_LABEL = {
  [ITEM_TYPE.TRINKET]: "Acessório",
};

export const CRAFT_CATEGORIES = CATEGORY_ORDER.map((type) => ({
  id: type,
  label: CATEGORY_LABEL[type] ?? ITEM_TYPE_LABEL[type],
  icon: CATEGORY_ICON[type],
}))
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

/**
 * As cadeias de material inteiras, para o painel mostrar a escada.
 *
 * Nao e usado pelo craft — que so precisa das receitas — e sim por
 * qualquer tela que queira mostrar "este material tem quatro graus acima"
 */
export { MATERIAIS, DEGRAUS, BASES, nomeDoGrau };