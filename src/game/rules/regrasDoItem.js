import { RARITY } from "../../data/items/raridade.js";

/**
 * AS QUATRO REGRAS QUE MUDARAM O JOGO.
 *
 * Este arquivo e a fonte unica delas. Antes cada uma estava espalhada em um
 * modulo different — a chance de drop no `balance.js`, a familia da arma em
 * `items/index.js`, o filtro de equipar em `Equipment.js` — e mudar uma regra
 * significava caçar tres lugares
 */

/* ============================================================== *
 * 1. O CRAFT CONTINUA SENDO POR CLASSE, E ISSO NAO MUDA
 * ============================================================== */

/**
 * O CRAFT E DE UMA CLASSE SO.
 *
 * ## O QUE ESTA REGRA PROTEGE
 *
 * A identidade da classe. Se qualquer classe pudesse fazer qualquer peca, a
 * classe viraria uma escolha de skin e nao uma escolha de jogo: nao haveria
 * razao para ser guerreiro em vez de arqueiro alem da arte
 *
 * ## POR QUE O CRAFT E A REGRA, E O DROP NAO
 *
 * Porque sao dois momentos diferentes. O CRAFT e uma escolha do jogador, e
 * qualquer escolha que esvazia a classe e uma escolha que nao vale a pena. O
 * DROP e o acaso — e o acaso nao pode ser filtrado por classe, senao o
 * jogador de uma classe so ve metade do mundo
 *
 * Entao: voce faz a SUA arma, mas qualquer monstro pode soltar a arma dos
 * outros. O que voce faz e raro e o seu; o que cai no chao e de todo mundo
 */

/* ============================================================== *
 * 2. A CHANCE DE SER COMERCIALIZAVEL
 * ============================================================== */

/**
 * A PORCENTAGEM DE VIRAR COMERCIALIZAVEL.
 *
 * ## POR QUE E PEQUENA DE PROPOSITO
 *
 * Porque o item comum do jogador tem que ser dele. Um drop com 50% de chance de
 * virar mercadoria vira moeda disfarçada — o jogador para de caçar para USAR e
 * passa a caçar para VENDER, e o loop do jogo inteiro vira economia
 *
 * E o inverso tambem: se a chance for zero, o mercado entre jogadores fica
 * morto, porque ninguem tem o que vender. O numero certo e o que mantem o
 * mercado como um CANAL SECUNDARIO
 *
 * ## POR QUE CRAFT E DROP TEM VALORES DIFERENTES
 *
 * Porque sao economies diferentes. O craft e producao deliberada: o jogador
 * escolheu fazer aquela peca, entao ela tem mais chance de ser trash ou de ir
 * para o mercado. O drop e sorteio: quase tudo o jogador pega e descartado
 * logo depois, entao a taxa e menor
 */
export const CHANCE_COMERCIALIZAVEL = {
  /** peca feita na mao pelo jogador */
  craft: 0.25,

  /** material que caiu de monstro */
  drop: 0.12,

  /** equipamento que caiu de monstro */
  dropEquipamento: 0.2,
};

/**
 * O ITEM VAI PARA O MERCADO?
 *
 * ## POR QUE UM SORTIO E NAO UMA PROPRIEDADE DO CATALOGO
 *
 * Porque dois arcos `+0` sao o mesmo item do catalogo e mesmo assim um pode
 * ser seu e o outro de outro jogador. Se a comercializavel morasse no
 * catalogo, todo arco do mundo seria comercializavel ou nenhum seria — e o
 * mercado perderia a escolha, que e onde esta a economia
 *
 * E o mesmo item dropado duas vezes na mesma hora pode sair diferente, e
 * isso e o que mantem o mercado vivo: ha sempre uma peca nao
 * comercializavel
 */
export function sortearComercializavel(chave, random = Math.random) {
  const chance =
    CHANCE_COMERCIALIZAVEL[chave] ?? CHANCE_COMERCIALIZAVEL.drop;

  return random() < chance;
}

/* ============================================================== *
 * 3. O DROP JA VEM ENCANTADO
 * ============================================================== */

/**
 * A PROPORCAO DE DROPS QUE JA VEMEM COM AFIXO.
 *
 * ## POR QUE POUCO
 *
 * Porque um afixo e um bonus que o jogador passou tempo GANHANDO. Se meio dos
 * drops vem pronto, o encantamento deixa de ser um sistema e vira um extra
 * que veio de graca — e o encantamento do inventario, que o jogador escolhe e
 * paga, perde o sentido
 *
 * ## POR QUE ALGUM E NAO NENHUM
 *
 * Porque um afixo raro no chao e o que faz o jogador querer PEGAR o drop em
 * vez de deixar para tras. E o que faz o mercado derance — uma peca com afixo
 * negociada vale mais que uma sem
 */
/**
 * A CHANCE ANTIGA DE DROP VIR COM AFIXO. ESTA MORTA.
 *
 * ## O QUE ELA FAZIA, E POR QUE NAO FAZ MAIS NADA
 *
 * O `sortearAfixoDrop` rollava 8% para "o drop vem com afixo", e o resultado
 * — um inteiro de 1 a 3 — era escrito no campo `enhance` do drop, que o
 * `LootSystem` usava como flag de "veio com afixo"
 *
 * ## O PROBLEMA: `enhance` NAO E AFIXO
 *
 * `enhance` e APRIMORAMENTO, e o motor le: `Equipment.bonuses` faz
 * `1 + entry.enhance * 0.12`. Entao o afixo de drop estava entrando como
 * multiplicador de stat — o drop saia +12% a +36% de graça, mais forte que
 * qualquer aprimoramento pago na aba
 *
 * ## ONDE O AFIXO ESTA AGORA
 *
 * Em `PESO_AFIXO_DROP` e no `rollEnchantDeDrop`, no modulo de encantamento. O
 * afixo de drop e 100% das pecas e a raridade dele e a tabela de drop —
 * lendario a 0.3, metade da do menu
 *
 * ## POR QUE FICA AQUI, E NAO APAGADO
 *
 * Porque e o unico registro de que a regra ja foi de 8%. Apagar os tres nomes
 * junto faria a proxima pessoa que precisar da chance recriar a regra com o
 * nome errado de novo — e o nome errado e exatamente o que gerou o bug
 */
export const CHANCE_DROP_ENCANTADO = 0.08;

/**
 * A FAIXA ANTIGA DO "NIVEL DE AFIXO". ESTA MORTA TAMBEM.
 *
 * Era 1 a 3, e virava `enhance` — ver o bloco acima. O afixo de drop nao tem
 * "nivel": ele tem `{stat, rarity, power}`, e a raridade dele vem da
 * `PESO_AFIXO_DROP`
 */
export const AFIXO_DROP = {
  minimo: 1,
  maximo: 3,
};

/**
 * SORTEIA O "AFIXO" DE UM DROP. MORTO, E O NOME E O PROBLEMA.
 *
 * ## POR QUE O NOME PRECISA FICAR AQUI
 *
 * Porque `sortearAfixoDrop` parece a funcao do afixo de drop, e nao e: devolve
 * um inteiro de 1 a 3, que e NIVEL DE APRIMORAMENTO. Quem procurar "como o
 * drop ganha afixo" chega aqui e conclui que o drop e aprimorado
 *
 * O afixo de verdade e `rollEnchantDeDrop`, em `src/data/enchant/index.js`
 *
 * ## E POR QUE ESTE CORPO AINDA EXISTE
 *
 * Porque alguma coisa pode importar, e apagar uma funcao exportada e a forma
 * mais facil de quebrar um modulo que eu nao conheco por inteiro. Nenhum
 * caminho de producao chama: o `LootSystem` parou de usar, e a busca por
 * `sortearAfixoDrop` no codigo nao encontra nenhum outro chamador
 *
 * Se voce esta lendo isto procurando o afixo do drop: o numero certo esta em
 * `PESO_AFIXO_DROP`, e o sorteio em `rollEnchantDeDrop`
 */
export function sortearAfixoDrop(random = Math.random) {
  if (random() >= CHANCE_DROP_ENCANTADO) return 0;

  const faixa = AFIXO_DROP.maximo - AFIXO_DROP.minimo + 1;

  return AFIXO_DROP.minimo + Math.floor(random() * faixa);
}

/* ============================================================== *
 * 4. SO A PROPRIA CLASSE VESTE
 * ============================================================== */

/**
 * ESTA CLASSE PODE VESTIR ESTA PECA?
 *
 * ## A REGRA, INTEIRA
 *
 * `classes` vazio ou ausente significa QUALQUER classe. `classes` com uma
 * classe significa SO ela. Nao existe terceira opcao — e nao existe item que
 * sirva para duas classes so
 *
 * ## POR QUE O ARRAY E POR CLASSE E NAO POR FAMILIA
 *
 * Porque o `WEAPON_KIND` so cobre arma, e armadura e o caso mais comum. Um
 * `botas_warrior` nao tem familia nenhuma: e so de guerreiro, e o campo que
 * diz isso e o `classes`
 *
 * ## POR QUE O CRAFT SERA POR CLASSE E O DROP DE TODOS
 *
 * Porque a restricao de vestir e uma restricao de JOGABILIDADE, e nao de
 * economia. O jogador pode ter na mochila a espada de um guerreiro que ele
 * matou, e nao pode vestir — e isso e o que faz o mercado entre jogadores ter
 * valor: a peca que voce nao pode usar voce pode REVENDER
 */
export function pecaServeParaClasse(peca, classId) {
  if (!peca) return false;

  if (!classId) return true;

  const classes = peca.classes ?? [];

  if (classes.length === 0) return true;

  return classes.includes(classId);
}

/**
 * POR QUE ESTA PECA ESTA SENDO JOGADA FORA DO DROP.
 *
 * E a lista de equipamentos que os monstros podem soltar. E o canal que faz
 * as duas metades da regra se encontrarem: qualquer monstro pode soltar
 * qualquer peca, mas o jogador so pode vestir a dele
 */
export const EQUIPAMENTOS_DE_DROP = [
  { id: "willow_bow", weight: 8 },
  { id: "aljava_arbalist", weight: 8 },

  { id: "botas_arbalist", weight: 10 },
  { id: "calca_arbalist", weight: 10 },
  { id: "capuz_arbalist", weight: 10 },
  { id: "luvas_arbalist", weight: 10 },
  { id: "peito_arbalist", weight: 10 },

  { id: "botas_warrior", weight: 10 },
  { id: "calca_warrior", weight: 10 },
  { id: "elmo_warrior", weight: 10 },
  { id: "luvas_warrior", weight: 10 },
  { id: "peito_warrior", weight: 10 },

  { id: "anel", weight: 4 },
  { id: "amuleto_arqueiro", weight: 4 },
];

/**
 * A RARIDADE DE UM DROP DE EQUIPAMENTO.
 *
 * ## POR QUE PUXA A RARIDADE E NAO SEMPRE COMUM
 *
 * Porque um equipamento que cai "comum" e indistinguivel de um encontrado
 * na loja, e o jogador nao tem motivo para comparar. Um equipamento raro que
 * cai e o que cria a historia de "achei um lendario no primeiro golem"
 *
 * ## POR QUE A LISTA ACIMA NAO FALA DE RARIDADE
 *
 * Porque a raridade NAO e sorteada aqui. O `loot` da criatura ja passa por
 * `applyDropScaling`, e `LootSystem.rollItems` ja sorteia a raridade com o
 * peso do `balance.js`. Sortear de novo aqui ignoraria essa escala e daria um
 * lendario no slime
 *
 * Este modulo guarda entao SO o que nao tinha lugar nenhum: as chances novas
 * e a lista de equipamentos. `RARITY` fica importado porque quem consumir este
 * arquivo costuma precisar dele para descrever o drop, e reexportar evita o
 * segundo import do mesmo modulo em dois lugares
 */
export { RARITY };