/**
 * A LOJA: O QUE VENDE, EM CINCO CATEGORIAS.
 *
 * ## O QUE ESTE ARQUIVO E
 *
 * O catalogo da loja: as categorias, os pacotes, e o que cada pacote
 * contem. E nao o ESTADO dela — o que o jogador ja comprou e o saldo de
 * moeda premium nao mora aqui, e sim em quem renderiza, porque estado que
 * muda mora no componente
 *
 * ## POR QUE CADA `itemId` VEM DO CATALOGO
 *
 * Nenhum item novo. Todo id deste arquivo existe em `ITEMS`, e o
 * `ItemIcon` do painel busca a arte e o glifo la. Um id escrito a mao que
 * o catalogo nao conhece renderiza um quadrado vazio — o jogador ve um
 * item que o jogo nao tem como dar
 *
 * ## POR QUE NAO TEM CRISTAIS NOS PACOTES
 *
 * Porque cristal nao e ITEM: e prop do Vale 1, o que o jogador quebra
 * minerando, e nunca entra na mochila como item. Um pacote de "cristal" com
 * `cristal_comum` seria uma promessa que nao existe no `ITEMS`, e o
 * `ItemIcon` mostraria um espaco vazio no lugar da arte. O que substitui o
 * cristal no pacote e o STEEL, que e a moeda que o cristal produz — e essa
 * troca e o que o jogador reconhece
 *
 * ## POR QUE A MOEDA PREMIUM NAO ESTA NO INVENTARIO AINDA
 *
 * Porque nao existe. O jogo tem ouro e steel, e nenhum dos dois e
 * "premium": ouro vem de missao e venda, e steel de bater pedra. A moeda
 * premium e o PRECO que o jogo cobra, e ela nasce com a loja — o saldo
 * entra no `Inventory` no mesmo passo que a primeira compra
 */
export const LOJA_CATEGORIAS = [
  {
    id: "eventos",
    nome: "Eventos",
    icone: "✦",
    descricao: "O que so existe por pouco tempo.",
  },
  {
    id: "pacotes",
    nome: "Pacotes",
    icone: "❖",
    descricao: "Conjuntos de baus e equipamento.",
  },
  {
    id: "itens",
    nome: "Itens",
    icone: "⛁",
    descricao: "Peças e materiais avulsos.",
  },
];

/**
 * UM PACOTE.
 *
 * ## OS CAMPOS
 *
 * - `categoria`: o id de uma das cinco, e o que decide em que aba ele
 *   aparece. Um pacote sem categoria nao aparece em lugar nenhum
 * - `tag`: `null`, `"new"` ou `"event"`. A tag e o que o jogador ve
 *   PRIMEIRO, e por isso ela fica no cartao e nao em algum lugar do painel
 * - `terminaEmHoras`: quanto falta para a oferta acabar. `null` e um pacote
 *   permanente, e ele NAO mostra contador — um contador parado em 99:59
 *   seria uma contagem regressiva parada, que e pior que nenhuma
 * - `itens`: o conteudo. Cada um tem `itemId` do catalogo, `quantidade` e
 *   `rarity` quando o item sai acima da raridade natural
 * - `preco`: o que custa em moeda premium
 * - `valorReal`: o que o mesmo conteudo custaria em ouro e steel, quando
 *   existe. E o que faz o jogador decidir se a loja e cara
 *
 * ## POR QUE `valorReal` E UM CAMPO E NAO UM CALCULO
 *
 * Porque o "valor real" de um pacote NAO e a soma do `value` dos itens: um
 * pacote de evento leva coisas que o jogador nao compra em lugar nenhum,
 * e um pacote de moeda vale exatamente o que vale. O numero e uma
 * promocao escrita a mao, nao uma conta — e por isso que ele esta aqui e
 * nao no componente
 */
export const LOJA_PACOTES = [
  /* ---------------- EVENTOS ---------------- */

  {
    id: "evento-caca-fantasma",
    categoria: "eventos",
    nome: "Caca a Fantasma",
    tag: "event",
    terminaEmHoras: 6,
    preco: 320,
    valorReal: { ouro: 0, steel: 0, texto: "Exclusivo do evento" },
    itens: [
      { itemId: "essencia_necrotica", quantidade: 3 },
      { itemId: "osso_quebrado", quantidade: 12 },
      { itemId: "tendao_ressecado", quantidade: 8 },
    ],
  },
  {
    id: "evento-lua-de-sangue",
    categoria: "eventos",
    nome: "Lua de Sangue",
    tag: "event",
    terminaEmHoras: 41,
    preco: 450,
    valorReal: { ouro: 0, steel: 0, texto: "Exclusivo do evento" },
    itens: [
      { itemId: "couro_goblin", quantidade: 8 },
      { itemId: "pocao_grande", quantidade: 6 },
      { itemId: "steel", quantidade: 60 },
    ],
  },
  {
    id: "evento-primeira-vez",
    categoria: "eventos",
    nome: "Primeira Caçada",
    tag: "new",
    terminaEmHoras: 72,
    preco: 150,
    valorReal: { ouro: 0, steel: 0, texto: "Só nesta temporada" },
    itens: [
      { itemId: "osso_quebrado", quantidade: 20 },
      { itemId: "tendao_ressecado", quantidade: 8 },
      { itemId: "pocao_cura", quantidade: 10 },
    ],
  },

  /* ---------------- PACOTES ---------------- */

  {
    id: "bau-iniciante",
    categoria: "pacotes",
    nome: "Báu do Novato",
    tag: "new",
    terminaEmHoras: null,
    preco: 180,
    valorReal: { ouro: 500, steel: 0, texto: "500 de ouro" },
    itens: [
      { itemId: "pocao_cura", quantidade: 15 },
      { itemId: "osso_quebrado", quantidade: 25 },
      { itemId: "dummy_wood", quantidade: 20 },
    ],
  },
  {
    id: "bau-caçador",
    categoria: "pacotes",
    nome: "Báu do Caçador",
    tag: null,
    terminaEmHoras: null,
    preco: 560,
    valorReal: { ouro: 1200, steel: 40, texto: "1.200 de ouro + 40 de steel" },
    itens: [
      { itemId: "essencia_necrotica", quantidade: 6 },
      { itemId: "tendao_ressecado", quantidade: 10 },
      { itemId: "pocao_media", quantidade: 12 },
    ],
  },
  {
    id: "pacote-arqueiro",
    categoria: "pacotes",
    nome: "Arsenal do Arqueiro",
    tag: null,
    terminaEmHoras: null,
    preco: 890,
    valorReal: { ouro: 900, steel: 60, texto: "900 de ouro + 60 de steel" },
    itens: [
      { itemId: "willow_bow", quantidade: 1, rarity: "legendary" },
      { itemId: "peito_arbalist", quantidade: 1, rarity: "epic" },
      { itemId: "capuz_arbalist", quantidade: 1, rarity: "rare" },
      { itemId: "luvas_arbalist", quantidade: 1, rarity: "rare" },
    ],
  },
  {
    id: "pacote-guerreiro",
    categoria: "pacotes",
    nome: "Armadura do Guerreiro",
    tag: null,
    terminaEmHoras: null,
    preco: 980,
    valorReal: { ouro: 1000, steel: 60, texto: "1.000 de ouro + 60 de steel" },
    itens: [
      { itemId: "peito_warrior", quantidade: 1, rarity: "legendary" },
      { itemId: "elmo_warrior", quantidade: 1, rarity: "epic" },
      { itemId: "luvas_warrior", quantidade: 1, rarity: "rare" },
      { itemId: "botas_warrior", quantidade: 1, rarity: "rare" },
    ],
  },

  /* ---------------- ITENS ---------------- */

  {
    id: "item-brasa-viva",
    categoria: "itens",
    nome: "Brasa Viva",
    tag: null,
    terminaEmHoras: null,
    preco: 140,
    valorReal: { ouro: 300, steel: 0, texto: "300 de ouro" },
    itens: [{ itemId: "pocao_grande", quantidade: 3 }],
  },
  {
    id: "item-sela",
    categoria: "itens",
    nome: "Selo Rúnico",
    tag: null,
    terminaEmHoras: null,
    preco: 90,
    valorReal: { ouro: 80, steel: 0, texto: "80 de ouro" },
    itens: [{ itemId: "pergaminho_teleporte", quantidade: 2 }],
  },
  {
    id: "item-arco-lendario",
    categoria: "itens",
    nome: "Arco do Alvorecer",
    tag: "new",
    terminaEmHoras: null,
    preco: 620,
    valorReal: { ouro: 121, steel: 30, texto: "121 de ouro + 30 de steel" },
    itens: [{ itemId: "willow_bow", quantidade: 1, rarity: "legendary" }],
  },
  {
    id: "item-pocao-lendaria",
    categoria: "itens",
    nome: "Poção Élfica",
    tag: null,
    terminaEmHoras: null,
    preco: 210,
    valorReal: { ouro: 250, steel: 0, texto: "250 de ouro" },
    itens: [{ itemId: "pocao_media", quantidade: 5 }],
  },

  /* ---------------- MOEDAS ---------------- */

  {
    id: "moeda-ouro",
    categoria: "moedas",
    nome: "Ouro",
    tag: null,
    terminaEmHoras: null,
    preco: 100,
    valorReal: { ouro: 250, steel: 0, texto: "250 de ouro" },
    itens: [{ itemId: "ouro", quantidade: 250 }],
  },
  {
    id: "moeda-ouro-grande",
    categoria: "moedas",
    nome: "Ouro em Lingotes",
    tag: null,
    terminaEmHoras: null,
    preco: 380,
    valorReal: { ouro: 1000, steel: 0, texto: "1.000 de ouro" },
    itens: [{ itemId: "ouro", quantidade: 1000 }],
  },
  {
    id: "moeda-steel",
    categoria: "moedas",
    nome: "Steel Refinado",
    tag: null,
    terminaEmHoras: null,
    preco: 160,
    valorReal: { steel: 120, texto: "120 de steel" },
    itens: [{ itemId: "steel", quantidade: 120 }],
  },
  {
    id: "moeda-duplex",
    categoria: "moedas",
    nome: "Dobro de Ouro",
    tag: "event",
    terminaEmHoras: 12,
    preco: 320,
    valorReal: { ouro: 800, steel: 0, texto: "800 de ouro" },
    itens: [{ itemId: "ouro", quantidade: 800 }],
  },
];

/**
 * A CATEGORIA QUE ABRE.
 *
 * `null` e o estado de "nenhuma escolhida", e o painel abre em
 * `LOJA_CATEGORIAS[0]` — a primeira da lista. Sem isso o jogador abriria a
 * loja com o menu a esquerda e um retangulo vazio a direita, sem saber se
 * e bug ou se precisa clicar
 */
export const CATEGORIA_INICIAL = LOJA_CATEGORIAS[0].id;

/**
 * O `itemId` QUE NAO E ITEM: OURO E STEEL SAO SALDO, NAO PILHA.
 *
 * ## POR QUE ELES APARECEM COMO `itemId`
 *
 * Porque o card precisa mostrar UMA lista, e o `ItemIcon` do jogo so sabe
 * desenhar item. Ouro e steel nao tem icone no catalogo de itens — sao
 * numeros no `Inventory` — entao eles entrariam com um espaco vazio na
 * grade. Escrever "ouro" e "steel" como ids especiais deixa o card com o
 * glifo certo e o numero certo
 *
 * E sao os dois ids que o jogo usa no glifo da HUD: o `◉` do ouro e o
 * `◈` do steel. Reusar os dois e o que faz o jogador ver na loja o mesmo
 * simbolo que ele ve no saldo
 */
export const MOEDAS_ESPECIAIS = {
  ouro: { nome: "Ouro", icone: "◉", cor: "#e6c47a" },
  steel: { nome: "Steel", icone: "◈", cor: "#c9a0ff" },

  /**
   * O DIAMANTE, a terceira moeda do jogo.
   *
   * Entra aqui pelo mesmo motivo dos outros dois: e um numero no
   * `Inventory`, sem icone no catalogo de itens, entao qualquer card que
   * mostre moeda em grade precisa de um id especial para o glifo sair certo
   *
   * E o `◆` porque o `items/index.js:324` ja usa `◆` como glifo de FALLBACK
   * dos 55 materiais — que sao eles tambem "um losango solido". Reaproveitar
   * o mesmo simbolo seria ambiguo entre material e moeda
   *
   * O azul e o que separa do gold e do steel: os tres ficam lado a lado na
   * barra de saldo do mercado, e duas cores iguais em tres simbolos
   * diferentes fazem o jogador ler errado antes de ler o nome
   */
  diamante: { nome: "Diamante", icone: "◇", cor: "#8fd6f2" },
};

/**
 * OS PACOTES DE UMA CATEGORIA, na ordem em que foram escritos.
 *
 * ## POR QUE A ORDEM E DO ARQUIVO E NAO DE PRECO OU DE TAG
 *
 * Porque a ordem de leitura do jogador nao e a do catalogo: e a ordem em
 * que os pacotes foram escritos, que e a ordem em que ele os conhece. Um
 * pacote de evento limitado sempre primeiro e o permanente embaixo e o que
 * mantem a aba com a mesma cara em toda visita
 */
export function pacotesDaCategoria(categoriaId) {
  return LOJA_PACOTES.filter((p) => p.categoria === categoriaId);
}