/**
 * A `RARITY` vem de `../items/raridade.js` e NAO de `../items/index.js`.
 *
 * O catalogo de itens importa ESTE arquivo para montar os 55 itens de
 * material no topo do modulo. Se este importasse o catalogo, os dois se
 * puxariam em ciclo e a `RARITY` cairia em "acesso antes da
 * inicializacao" — um crash no carregamento do modulo, nao numa funcao
 *
 * O motivo de a raridade estar num arquivo a parte esta escrito la
 */
import { RARITY } from "../items/raridade.js";

/**
 * OS MATERIAIS DO JOGO, e a escada de reforco deles.
 *
 * ## POR QUE ESTE ARQUIVO EXISTE SEPARADO DO CATALOGO DE ITENS
 *
 * Porque sao 55 itens com uma REGRA, e a regra nao muda de item para item:
 * todo material tem quatro versoes acima de si, e cada uma sai de cinco do
 * nivel de baixo. Escrever 55 `createItem` e 44 receitas a mao daria um
 * catalogo de 1500 linhas em que um erro de digitacao no id de um tier
 * so apareceria quando o jogador tentasse fabricar
 *
 * A tabela abaixo e a fonte da verdade: o `id`, o nome e a raridade de
 * cada material sao DERIVADOS dela, e nao escritos duas vezes
 *
 * ## POR QUE CADA MATERIAL TEM UM `mob`
 *
 * Porque o campo diz de QUEM o material cai, e o loot dos inimigos le
 * daqui. Sem ele, cada mob teria uma lista de materiais escrita a mao e o
 * catalogo nao saberia de onde veio nenhum deles
 */

/**
 * Os quatro degraus acima do material base.
 *
 * `reforcado -> resistente -> refinado -> lendario`
 *
 * A escada foi combinada com quem especificou o sistema: o txt de
 * desenho trazia duas versoes conflitantes — a regra geral dizia
 * "reforcado, refinado, epico, lendario" e o exemplo dizia "reforcado,
 * resistente, refinado, lendario". Vale a do exemplo, que e a que as
 * tabelas de arco e de amuleto usam
 */
export const DEGRAUS = ["reforcado", "resistente", "refinado", "lendario"];

export const ROTULO_DEGRAU = {
  reforcado: "Reforçado",
  resistente: "Resistente",
  refinado: "Refinado",
  lendario: "Lendário",
};

/**
 * A RARIDADE de cada degrau.
 *
 * E a MESMA escada de raridade do jogo, e e por isso que o degrau guarda
 * um par: `reforcado` e incomum, `lendario` e lendario
 *
 * Sem esta ligacao o `item.rarity` do material seria escrito a mao em 44
 * lugares, e um material "Refinado" marcado como raro apareceria na tela
 * com a cor errada ao lado de um equipamento raro
 */
export const RARIDADE_DEGRAU = {
  reforcado: RARITY.UNCOMMON,
  resistente: RARITY.RARE,
  refinado: RARITY.EPIC,
  lendario: RARITY.LEGENDARY,
};

/**
 * O MOB de cada material, e o `id` da CRIATURA — nao o nome.
 *
 * Os ids nao batem com os nomes porque os ids sao a chave do save, das
 * cacadas e das Missoes: o `slime` passou a se chamar Esqueleto e continua
 * `slime`, e o `skeleton` passou a se chamar Kaelen e continua `skeleton`.
 * Quem decide qual id solta qual material e o `id` daqui
 *
 * Sao quatro families, tres materiais cada:
 *
 * - `slime` (Esqueleto): osso, tendao, essencia
 * - `ogre` e `ogre_da_predeira` (Goblin): couro, minerio, pedra verde
 * - `skeleton` (Kaelen): ferro, couro reforcado, aco
 * - `zumbi_arbalist` (Nylara): madeira, tecido, aco temperado
 */
/**
 * AS QUATRO FAMILIAS, e o NOME que o jogador le de cada uma.
 *
 * ## POR QUE O NOME ESTA AQUI E NAO NO CATALOGO DE CRIATURAS
 *
 * Porque o `data/enemies` ja importa o `data/items`, e o `data/items` importa
 * este arquivo. Pegar o nome de la criaria um ciclo de import entre os tres, e
 * ciclo em JS nao avisa: um dia um `undefined` aparece e a culpada e a ultima
 * coisa alterada
 *
 * ## POR QUE O NOME NAO BATE COM O ID
 *
 * Porque os ids sao a chave do save e das missoes: o `slime` passou a se
 * chamar Esqueleto e continua `slime`. Este nome e so o rotulo que o painel
 * de craft escreve no cabecalho do grupo — nao entra em save, nem em missao,
 * nem em receita
 *
 * ## E A ORDEM DAS CHAVES
 *
 * E a ordem em que os grupos aparecem na tela, e ela segue a de `MATERIAIS`:
 * Esqueleto, Goblin, Kaelen, Nylara. Um `Map` nao tem ordem garantida no
 * `Object.keys`, entao o painel usa esta lista e nao o objeto
 */
export const FAMILIAS = [
  { mob: "slime", nome: "Esqueleto" },
  { mob: "ogre", nome: "Goblin" },
  { mob: "skeleton", nome: "Kaelen" },
  { mob: "zumbi_arbalist", nome: "Nylara" },
];

export const MATERIAIS = [
  /* ---- Esqueleto ---- */
  {
    id: "osso_quebrado",
    nome: "Osso Quebrado",
    icone: "osso_quebrado.png",
    mob: "slime",
    raridade: RARITY.COMMON,
    valor: 6,
  },
  {
    id: "tendao_ressecado",
    nome: "Tendão Ressecado",
    icone: "tendao_ressecado.png",
    mob: "slime",
    raridade: RARITY.UNCOMMON,
    valor: 20,
  },
  {
    id: "essencia_necrotica",
    nome: "Essência Necrótica",
    icone: "essencia_necrotica.png",
    mob: "slime",
    raridade: RARITY.RARE,
    valor: 62,
  },

  /* ---- Goblin ---- */
  {
    id: "couro_goblin",
    nome: "Couro Goblin",
    icone: "couro_goblin.png",
    mob: "ogre",
    raridade: RARITY.COMMON,
    valor: 7,
  },
  {
    id: "minerio_bruto",
    nome: "Minério Bruto",
    icone: "minerio_bruto.png",
    mob: "ogre",
    raridade: RARITY.UNCOMMON,
    valor: 22,
  },
  {
    id: "pedra_verde_bruta",
    nome: "Pedra Verde Bruta",
    icone: "pedra_verde_final.png",
    mob: "ogre",
    raridade: RARITY.RARE,
    valor: 68,
  },

  /* ---- Kaelen ---- */
  {
    id: "fragmento_de_ferro",
    nome: "Fragmento de Ferro",
    icone: "fragmento_de_ferro.png",
    mob: "skeleton",
    raridade: RARITY.COMMON,
    valor: 8,
  },
  {
    id: "couro_reforcado",
    nome: "Couro Reforçado",
    icone: "couro_reforcado.png",
    mob: "skeleton",
    raridade: RARITY.UNCOMMON,
    valor: 24,
  },
  {
    id: "fragmento_de_aco",
    nome: "Fragmento de Aço",
    icone: "fragmento_de_aco.png",
    mob: "skeleton",
    raridade: RARITY.RARE,
    valor: 72,
  },

  /* ---- Nylara ---- */
  {
    id: "madeira_de_lanca",
    nome: "Madeira de Lança",
    icone: "madeira_de_lanca.png",
    mob: "zumbi_arbalist",
    raridade: RARITY.COMMON,
    valor: 7,
  },
  {
    id: "tecido_militar",
    nome: "Tecido Militar",
    icone: "tecido_militar.png",
    mob: "zumbi_arbalist",
    raridade: RARITY.UNCOMMON,
    valor: 23,
  },
  {
    id: "aco_temperado",
    nome: "Aço Temperado",
    icone: "aco_temperado.png",
    mob: "zumbi_arbalist",
    raridade: RARITY.RARE,
    valor: 70,
  },
];

/**
 * Os DOZE materiais abrem uma cadeia cada, e nenhum divide grau com o
 * outro.
 *
 * O desenho do txt de criacao lista "Couro Goblin" (goblin) e "Couro
 * Reforcado" (kaelen) como dois materiais distintos, com linhas separadas
 * na lista de drop. Eles entao sao duas cadeias: uma sai do couro do
 * goblin e a outra do couro do kaelen
 *
 * Tratar o `couro_reforcado` como um grau da cadeia do couro do goblin
 * pareceria esperto e daria dois problemas: o item `couro_goblin_reforcado`
 * nasceria como um segundo "Couro Reforcado", e o equipamento que pede
 * couro nos dois niveis acabaria pedindo `couro_reforcado_reforcado`, um id
 * que ninguem cria
 */

/** as bases: os doze materiais, cada um com a sua cadeia */
export const BASES = MATERIAIS;

/** o material pelo id, ou `null` */
export function getMaterial(id) {
  return MATERIAIS.find((material) => material.id === id) ?? null;
}

/**
 * O `id` de um grau. Sem `grau`, e o proprio material base.
 *
 * O sufixo entra no id em vez de virar um campo, porque o `id` e o que a
 * mochila, o save e as receitas usam para casar. Um campo a parte
 * obrigaria os tres a saberem que ele existe
 */
export function idDoGrau(baseId, grau) {
  return grau ? `${baseId}_${grau}` : baseId;
}

/**
 * O NOME de um grau, e o nome do material com o rotulo do grau na frente.
 *
 * E o nome inteiro, e nao so "Osso Reforçado", por um motivo pratico: as
 * receitas do desenho de criacao usam nomes curtos como "Couro Reforcado",
 * e esse nome e o do Kaelen. Se o grau do couro do goblin tambem se
 * chamasse "Couro Reforçado", a tela teria dois itens de nome igual em
 * rakidades diferentes e o jogador nao saberia qual estava olhando
 */
export function nomeDoGrau(base, grau) {
  return grau ? `${base.nome} ${ROTULO_DEGRAU[grau]}` : base.nome;
}

/**
 * Todos os itens de material, base e graus, na ordem da tabela.
 *
 * E o que o catalogo de itens espalha no `ITEMS`
 */
export function todosOsMateriais() {
  const saida = [];

  for (const base of MATERIAIS) {
    saida.push({
      id: base.id,
      base,
      grau: null,
      nome: nomeDoGrau(base, null),
      raridade: base.raridade,
      degrauDe: null,
      valor: base.valor,
    });

    /**
     * Todo material tem quatro graus, sem excecao. Sao 12 bases e 48
     * graus, e nenhum id colide com outro porque o id do grau e o id da
     * base mais o sufixo
     */
    for (const grau of DEGRAUS) {
      saida.push({
        id: idDoGrau(base.id, grau),
        base,
        grau,
        nome: nomeDoGrau(base, grau),
        raridade: RARIDADE_DEGRAU[grau],
        degrauDe: base.id,
        valor: valorDoGrau(base, grau),
      });
    }
  }

  return saida;
}

/**
 * O VALOR de um grau, e cinco vezes o do grau de baixo.
 *
 * E o mesmo cinco da receita: cinco frascos de uma coisa valem uma da
 * coisa seguinte. Sem essa ligacao, o mercado entre jogadores pagaria
 * mais por cinco Ossos Quebrados do que por um Osso Reforçado, e o
 * primeiro degau da cadeia nunca valeria a pena
 *
 * E o valor do mercado entre jogadores, e nao o preco de loja: ele fica
 * em `item.value`, que e o que o mercado paga. Um material nao tem loja
 */
export function valorDoGrau(base, grau) {
  const indice = DEGRAUS.indexOf(grau);

  return base.valor * Math.pow(5, indice + 1);
}

/**
 * A receita que promove um material ao proximo grau: cinco do grau de
 * baixo viram um do grau de cima.
 *
 * `grau` e o de DESTINO. Sem ele, a receita promove a base no primeiro
 * grau — que e o unico caso em que falta o quinto de bonus
 */
export function receitaDeRefino(entrada) {
  const { base, grau } = entrada;

  if (!base || !grau) return null;

  const destino = {
    id: idDoGrau(base.id, grau),
    nome: nomeDoGrau(base, grau),
    raridade: RARIDADE_DEGRAU[grau],
  };

  return {
    destino,
    ingrediente: {
      id: idDoGrau(base.id, idDoGrauAnterior(grau)),
      count: 5,
    },
    icone: base.icone,
    valor: entrada.valor,
  };
}

/**
 * O GRAU ANTERIOR, e o que entra na receita deste.
 *
 * O primeiro grau vem da base, e nao de um grau que nao existe: e o que
 * impede a cadeia de pedir "Osso Base" e um item que o jogo nao cria
 */
function idDoGrauAnterior(grau) {
  const indice = DEGRAUS.indexOf(grau);

  return indice <= 0 ? null : DEGRAUS[indice - 1];
}