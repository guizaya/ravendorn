/**
 * O MARKET entre jogadores.
 *
 * Regras que moram aqui, e nao no componente nem no servidor:
 *
 * - o que pode ser listado: qualquer item, de qualquer tipo
 * - quanto tempo um anuncio vale
 * - os dois jeitos de vender, e o que cada um promete ao vendedor
 *
 * O que NAO mora aqui: onde o anuncio fica, quem compra. Isso e do
 * `MarketStore`, e ele roda no SERVIDOR — o preco de um item e uma
 * transferencia de item e moeda, e as duas precisam de uma unica
 * autoridade para nao haver dois copias do mesmo item
 */
import {
  ITEM_TYPE,
  ITEM_TYPE_LABEL,
  RARITY,
  RARITY_ORDER,
  RARITY_STYLE,
  getItem,
} from "../items/index.js";

/**
 * Os sete dias de validade.
 *
 * Em SEGUNDOS, e nao em dias: e o que o `Date.now()` do servidor
 * mede, e o que o teste consegue verificar sem esperar sete dias.
 * Sete dias sao 604800 segundos
 */
export const ANUNCIO_DIAS = 7;
export const ANUNCIO_SEGUNDOS = ANUNCIO_DIAS * 24 * 60 * 60;

/**
 * OS MODOS DE VENDA, e o que cada um cobra.
 *
 * ## POR QUE O LEILAO VOLTOU
 *
 * Existiu e foi removido porque nao tinha mecanica de lance: cobrava o valor
 * do anuncio na hora, igual ao preco fixo, e so mudava o nome. Um rotulo que
 * promete uma coisa e faz outra e pior do que nao ter a opcao
 *
 * Agora ele tem o que promete: o dinheiro fica RETIDO em lance, o item
 * continua anunciado, e o proximo lance tem de passar do maior ate ali. E o
 * `minBid` e obrigatorio, porque um leilao sem piso deixa o primeiro a levar
 * por 1 moeda — que e exatamente a loteria que o `PRECO_MINIMO` existe para
 * impedir
 *
 * ## E POR QUE `FIXO` CONTINUA SENDO O PADRAO
 *
 * Porque a venda direta e o que o jogador le sem pensar. Quem quiser
 * disputar por um item raro e o que escolhe o leilao, e o lance minimo que ele
 * escreve ja e o piso de todo o resto
 */
export const MODO_VENDA = {
  FIXO: "fixo",
  LEILAO: "leilao",
};

export const MODO_VENDA_LABEL = {
  [MODO_VENDA.FIXO]: "Preço fixo",
  [MODO_VENDA.LEILAO]: "Leilão",
};

/**
 * A descricao que o painel mostra embaixo do preco.
 *
 * ## POR QUE SÃO CURTAS
 *
 * Porque elas caem numa meia coluna de uns 180px. "O primeiro que pagar leva
 * pelo preço escrito." quebrava em duas linhas e empurrava o formulário para
 * fora da caixa — e a frase inteira cabe em uma se a segunda parte for óbvia
 */
export const MODO_VENDA_DICA = {
  [MODO_VENDA.FIXO]: "O primeiro que pagar leva.",
  [MODO_VENDA.LEILAO]: "O lance fica retido. Vence o maior.",
};

/**
 * AS MOEDAS DO ANUNCIO, e onde cada uma mora.
 *
 * ## POR QUE O DIAMANTE E DIFERENTE DAS OUTRAS DUAS
 *
 * Porque ouro e steel sao do PERSONAGEM, e o diamante e da CONTA. Nao e um
 * detalhe de codigo: e o que impede o mercado de usar `spendCoins` para
 * todo mundo e cobrar de um saldo que o vendedor nem ve
 */
export const MOEDA = {
  OURO: "coins",
  STEEL: "steel",
  DIAMANTE: "diamonds",
};

/** O nome que o jogador le embaixo do icone. */
export const MOEDA_LABEL = {
  [MOEDA.OURO]: "Ouro",
  [MOEDA.STEEL]: "Steel",
  [MOEDA.DIAMANTE]: "Diamante",
};

/** A MOEDA E DA CONTA, e nao do personagem? */
export function moedaDaConta(moeda) {
  return moeda === MOEDA.DIAMANTE;
}

/**
 * O PASSO MINIMO ENTRE DOIS LANCES.
 *
 * Sem ele, dois lances de 100 e 101 disputam o mesmo item por um ouro de
 * diferenca, e o "leilao" vira um clickspam. O `%` e um TETO do salto, para o
 * passo nao ser absurdo em um item muito caro
 */
export const PASSO_MINIMO_DO_LANCE = 1;
export const PASSO_MAXIMO_DO_LANCE = 0.1;

/**
/**
 * O menor preco de um anuncio, e o maior.
 *
 * O piso impede a loteria: com um minimo de 1, um jogador com 1 moeda
 * compra qualquer coisa, e o mercado deixa de ser sobre VALOR.
 *
 * O teto existe para o `preco * quantidade` de um material nao estourar
 * o `NUMERO_MAX` do save
 *
 * Os dois numeros sao ARREDONDADOS de proposito: o preco que o jogador
 * ve na loja tem que ser o mesmo que o servidor cobra, e um `Math.round`
 * no meio do caminho faria o painel mentir em 1 moeda
 */
export const PRECO_MINIMO = 5;
export const PRECO_MAXIMO = 1_000_000;

/**
 * O TETO DE CADA MOEDA.
 *
 * Ouro e steel dividem o `PRECO_MAXIMO`: sao saldos de personagem, e o teto
 * existe para o `preco * quantidade` nao estourar o `NUMERO_MAX` do save. O
 * diamante tem o seu, bem menor, porque nao sai de drop nenhum — um anuncio
 * de um milhao de diamante seria um numero sem lastro
 */
export const PRECO_MAXIMO_POR_MOEDA = {
  [MOEDA.OURO]: PRECO_MAXIMO,
  [MOEDA.STEEL]: PRECO_MAXIMO,
  [MOEDA.DIAMANTE]: 5_000,
};

/** O teto de um lance, e ele nunca passa do teto da moeda. */
export function tetoDaMoeda(moeda) {
  return PRECO_MAXIMO_POR_MOEDA[moeda] ?? PRECO_MAXIMO;
}

/**
 * Quantos anuncios um jogador pode ter abertos.
 *
 * Sem teto, um jogador esvazia a mochila inteira num mercado so dele e
 * a vitrine fica com 40 linhas do mesmo vendedor. Com teto, a vitrine
 * mostra Variedade — que e o que faz um mercado valer a pena
 */
export const ANUNCIOS_MAXIMOS = 8;

/**
 * Os motivos de recusa.
 *
 * Um enum, e nao um booleano: o painel precisa dizer QUAL coisa
 * impediu, e "nao deu" obriga o jogador a deduzir
 */
export const MARKET_RESULT = {
  OK: "ok",

  UNKNOWN: "unknown",

  /** o item nao existe, ou o vendedor nao tem esse uid */
  SEM_ITEM: "sem_item",

  /** o preco fora da faixa, ou nao e numero */
  PRECO: "preco",

  /** o item e material e a quantidade nao cabe */
  QUANTIDADE: "quantidade",

  /** ja tem anuncios abertos demais */
  LIMITE: "limite",

  /** o anuncio nao existe mais (vendido, cancelado ou expirado) */
  SEM_ANUNCIO: "sem_anuncio",

  /** e o proprio jogador tentando comprar o que ele vendeu */
  PROPRIO: "proprio",

  /** moedas insuficientes */
  MOEDAS: "moedas",

  /**
   * A MOEDA NAO E UMA DAS TRES, OU O MODO NAO E UM DOS DOIS.
   *
   * O mesmo motivo cobre os dois: os dois vem do cliente, e um pedido com
   * `currency: "qualquerCoisa"` cairia no `spendCoins` do servidor por falta
   * de caso no `switch` — o jogador anunciaria numa moeda que o servidor nao
   * conhece e receberia em ouro
   */
  MOEDA: "moeda",

  /** o anuncio nao e de leilao, ou e, e o lance nao bateu o piso */
  MODO: "modo",

  /** o comprador nao tem espaco na mochila */
  ESPACO: "espaco",

  /**
   * O LANCE NAO BATEU.
   *
   * E um motivo so para tres situacoes: lance abaixo do minimo do leilao,
   * lance que nao passa do maior que ja existe, e lance em um anuncio que nao
   * e leilao. As tres sao o mesmo erro do ponto de vista do jogador — "meu
   * lance nao valeu" — e o texto do motivo diz qual delas
   */
  LANCE: "lance",
};

/** A moeda e uma das tres? Fica como funcao para o servidor e o painel usarem a MESMA regra. */
export function moedaValida(moeda) {
  return Object.prototype.hasOwnProperty.call(MOEDA_LABEL, moeda);
}

/** O modo de venda e um dos dois? */
export function modoValido(modo) {
  return modo === MODO_VENDA.FIXO || modo === MODO_VENDA.LEILAO;
}

/**
 * O MENOR LANCE ACEITO AGORA, e o que a tela mostra embaixo do campo.
 *
 * ## POR QUE NAO E SO O `minBid`
 *
 * Porque o piso do leilao e o lance do VENDEDOR, e o piso do proximo
 * comprador e o MAIOR LANCE JA FEITO. Sao duas contas diferentes, e o erro
 * mais comum de um leilao e o comprador escrever o minimo e ver o lance
 * recusado sem entender
 *
 * ## E POR QUE UM `+1` SOBRE O MAIOR
 *
 * Porque lance igual nao vence ninguem. O passo e o maior entre um piso
 * fixo e um percentual do lance atual, que impede o clickspam sem dar um
 * salto absurdo em um item caro
 *
 * @param {object} anuncio o anuncio do leilao
 * @returns {number} o menor valor aceito agora, ou 0 quando nao e leilao
 */
export function lanceMinimoAtual(anuncio) {
  if (anuncio?.modo !== MODO_VENDA.LEILAO) return 0;

  const maior = anuncio?.maiorLance ?? 0;
  const piso = Math.max(anuncio?.minBid ?? 0, maior);
  const passo = Math.max(
    PASSO_MINIMO_DO_LANCE,
    Math.ceil(piso * PASSO_MAXIMO_DO_LANCE),
  );

  return maior > 0 ? maior + passo : Math.max(piso, PRECO_MINIMO);
}

/**
 * O preco e valido?
 *
 * Fica como funcao e nao como expressao no meio do `listar` para que o
 * servidor e o painel chamem a MESMA regra: se o painel aceitasse 0 e
 * o servidor recusasse, o jogador veria um botao que nao funciona
 *
 * O `Math.round` e o que garante que o valor exibido e o valor cobrado
 */
export function precoValido(preco) {
  if (typeof preco !== "number") return false;
  if (!Number.isFinite(preco)) return false;
  if (preco < PRECO_MINIMO) return false;

  return preco <= PRECO_MAXIMO;
}

/** o preco normalizado, ou `null` se nao vale */
export function normalizarPreco(preco) {
  if (!precoValido(preco)) return null;

  return Math.round(preco);
}

/**
 * O item pode ser listado?
 *
 * Qualquer item de qualquer tipo — o jogador vende relíquia, equip,
 * arma e material. O que NAO pode e um item que nao existe, porque um
 * id forjado viraria um anuncio de um item invisivel que o comprador
 * receberia na mao
 */
export function podeListar(itemId) {
  if (!itemId) return false;

  return Boolean(getItem(itemId));
}

/**
 * O texto curto do item, para a lista de anuncios.
 *
 * O `name` sozinho nao basta: dois itens de classes diferentes podem
 * ter o mesmo nome, e o comprador precisa ver a RARIDADE. E a
 * quantidade, porque o anuncio pode ser de 3 materiais
 */
export function describeAnuncioItem({
  itemId,
  rarity,
  count = 1,
}) {
  const item = getItem(itemId);
  const nome = item?.name ?? itemId;
  const estilo = RARITY_STYLE[rarity];

  const sufixo = estilo ? ` (${estilo.label})` : "";

  const unidade = count === 1 ? "" : ` x${count}`;

  return `${nome}${sufixo}${unidade}`;
}

/** o tipo do item, para o filtro */
export function tipoDoAnuncio({ itemId }) {
  return getItem(itemId)?.type ?? null;
}

/** os tipos que tem no catalogo, para o filtro montar as opcoes */
export const TIPOS_VENDA = [
  ITEM_TYPE.WEAPON,
  ITEM_TYPE.ARMOR,
  ITEM_TYPE.TRINKET,
  ITEM_TYPE.MATERIAL,
];

/**
 * O rotulo do filtro de tipo.
 *
 * `ITEM_TYPE_LABEL` e um mapa sem os tipos que nao existem no
 * catalogo ainda, entao o filtro usa a lista de cima e nao as chaves
 * do mapa: um filtro com opcao que nao filtra nada e pior do que um
 * filtro sem a opcao
 */
export function labelTipo(tipo) {
  return ITEM_TYPE_LABEL[tipo] ?? tipo;
}

/** as raridades, do mais fraco ao mais forte, para o filtro */
export const RARIDADES_FILTRO = RARITY_ORDER;

/** a cor de um anuncio, pela raridade do item */
export function corDoAnuncio(rarity) {
  return RARITY_STYLE[rarity]?.color;
}

/**
 * Quanto falta para o anuncio expirar, em ms.
 *
 * O painel mostra a barra de tempo. O numero vem negativo quando o
 * anuncio ja venceu, e quem chama filtra os vencidos antes — mas o
 * clamp existe para uma barra de tempo negativa nao virar barra
 * nenhuma
 */
export function restanteMs(expiresAt, agora) {
  const restante = expiresAt - agora;

  return restante > 0 ? restante : 0;
}

/** o total do anuncio, para o comprador ver o valor da pilha */
export function totalDoAnuncio(preco, count = 1) {
  return Math.round(preco * count);
}

/** o preco de uma unidade, quando o anuncio e de varias */
export function precoUnitario(preco, count = 1) {
  return count > 1 ? Math.round(preco / count) : preco;
}

export { RARITY };