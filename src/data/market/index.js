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
 * O market vende de UM jeito so: o primeiro que pagar o preco escrito
 * leva o item.
 *
 * Existiu um segundo modo, o "leilao", que nao tinha mecanica de
 * lance: cobrava o valor do anuncio na hora, igual ao preco fixo, e
 * so mudava o nome. Um rotulo que promete uma coisa e faz outra e
 * pior do que nao ter a opcao — o jogador paga believing num negocio
 * que nao existe. Um market com uma regra so e um market que o
 * jogador entende
 */
export const MODO_VENDA = {
  FIXO: "fixo",
};

export const MODO_VENDA_LABEL = {
  [MODO_VENDA.FIXO]: "Preco fixo",
};

/** a descricao que o painel mostra embaixo do preco */
export const MODO_VENDA_DICA = {
  [MODO_VENDA.FIXO]: "O primeiro que pagar leva pelo preco escrito.",
};

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

  /** o comprador nao tem espaco na mochila */
  ESPACO: "espaco",
};

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
 * O modo do anuncio e valido?
 *
 * So existe o preco fixo, entao a funcao existe para o SERVIDOR ter um
 * unico lugar que responde "isso aqui e um modo?". Um cliente antigo
 * ainda pode mandar `mode: "leilao"` num pedido — o `parsePanel`
 * ignora, e um anuncio antigo gravado no disco vem com o campo antigo.
 * Nenhum dos dois vira um modo novo
 */
export function modoValido(modo) {
  return modo === MODO_VENDA.FIXO;
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