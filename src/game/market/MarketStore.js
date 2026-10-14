import {
  ANUNCIO_SEGUNDOS,
  ANUNCIOS_MAXIMOS,
  lanceMinimoAtual,
  MARKET_RESULT,
  MOEDA,
  MODO_VENDA,
  modoValido,
  moedaValida,
  PRECO_MAXIMO,
  PRECO_MINIMO,
  corDoAnuncio,
  normalizarPreco,
  podeListar,
} from "../../data/market/index.js";
import { ITEM_TYPE, getItem } from "../../data/items/index.js";

/**
 * O MOTOR do market.
 *
 * E o unico lugar do jogo onde o dinheiro e o item de um jogador andam
 * para o de outro. Por isso ele roda no SERVIDOR e e a unica copia dos
 * anuncios: dois anuncios do mesmo item em duas instancias permitiriam
 * a um jogador gastar duas vezes o mesmo objeto
 *
 * O store e GLOBAL e nao por sessao, ao contrario de `inventory` e
 * `collection`. A razao esta escrita no `PlayerSession.js`: estado
 * privado nao pode morar no mundo, e nao ha mundo compartilhado em
 * `world.players` que preste para isso
 *
 * O `agora` e INJETADO no construtor, como o `GameClient` faz. Sete
 * dias de validade sao impossiveis de testar com `Date.now()` de
 * verdade: o teste passaria esperando ou usaria timers falsos, e os
 * dois escondem bugs de borda — o que acontece no ultimo segundo, e o
 * que acontece com `expiresAt` exatamente igual a `agora`
 */
export class MarketStore {
  /**
   * @param {object} opcoes
   * @param {() => number} opcoes.agora  o relogio, em ms
   * @param {() => string} opcoes.novoId  gerador de id de anuncio
   */
  constructor({
    agora = () => Date.now(),
    novoId = null,
  } = {}) {
    this.agora = agora;
    this.novoId =
      novoId ??
      (() => `a_${this.agora().toString(36)}${this.sequencia++}`);

    this.sequencia = 0;

    /** os anuncios abertos, por id */
    this.listings = new Map();

    /**
     * O HISTORICO: o que ja foi vendido.
     *
     * Ele e limitado por dois motivos. O primeiro e espaco: o arquivo
     * do market nao pode crescer sem parar. O segundo e informacao:
     * um historico de 5000 vendas mostra precos que nao valem mais
     * nada, porque ha sete dias o jogador mais barato passou a existir
     *
     * O limite e o mesmo padrao dos `pending` da colecao: quando a
     * lista enche, o mais ANTIGO sai. Um anuncio comprado junto com o
     * item some do arquivo do vendedor quando ele sai
     */
    this.historico = [];

    this.MAX_HISTORICO = 40;
  }

  /**
   * Quando um anuncio criado agora vence.
   *
   * O prazo e contado do AGORA e nao do primeiro `tick`: um anuncio
   * criado durante um servidor parado teria o prazo contado duas vezes
   */
  expiresAtDe() {
    return this.agora() + ANUNCIO_SEGUNDOS * 1000;
  }

  /** quantos anuncios o jogador tem abertos */
  countOf(sellerKey) {
    let total = 0;

    for (const listing of this.vigentes()) {
      if (listing.sellerKey === sellerKey) total += 1;
    }

    return total;
  }

  /** os anuncios de um jogador, para a aba "meus anuncios" */
  ofSeller(sellerKey) {
    return this.vigentes().filter(
      (listing) => listing.sellerKey === sellerKey,
    );
  }

  /**
   * A vitrine inteira, ja sem os vencidos.
   *
   * `expirar` roda antes, e nao depois: um anuncio que venceu neste
   * instante nao pode aparecer na lista que o jogador esta vendo, nem
   * como "venceu agora"
   */
  all() {
    return this.vigentes();
  }

  get(listingId) {
    const listing = this.listings.get(listingId) ?? null;

    if (!listing) return null;

    return listing.expiresAt > this.agora() ? listing : null;
  }

  /**
   * Publica um anuncio.
   *
   * O `uid` vem do inventario do vendedor e e a REFERENCIA INTERNA do
   * servidor. E ele, e nao `itemId` + `rarity`, que diz qual peca e:
   * dois jogadores podem ter duas botas raras identicas, e cada uma e
   * um anuncio diferente
   */
  list({
    sellerKey,
    sellerName,
    uid,
    price,
    currency = MOEDA.OURO,
    modo = MODO_VENDA.FIXO,
    minBid = null,
  }) {
    const preco = normalizarPreco(price);

    if (preco === null) {
      return {
        ok: false,
        reason: MARKET_RESULT.PRECO,
      };
    }

    /**
     * A MOEDA E O MODO SAO VALIDADOS AQUI, E NAO SÓ NA TELA.
     *
     * Porque os dois vem do cliente e o cliente nao e autoridade. Sem esta
     * guarda, um pedido com `currency: "qualquerCoisa"` cairia no
     * `spendCoins` do servidor por falta de caso no `switch` — o jogador
     * anunciaria numa moeda que o servidor nao conhece e receberia em ouro
     */
    if (!moedaValida(currency)) {
      return { ok: false, reason: MARKET_RESULT.MOEDA };
    }

    if (!modoValido(modo)) {
      return { ok: false, reason: MARKET_RESULT.MODO };
    }

    /**
     * O LANCE MINIMO E OBRIGATORIO NO LEILAO.
     *
     * E o que separa um leilao de uma loteria. O `price` de um leilao e o
     * PRECO DE ABERTURA, e o que segura o item e o `minBid`; sem ele o
     * primeiro a chegar leva pelo `price`, e o `price` vira so um numero
     * decorativo
     */
    let lanceMinimo = null;

    if (modo === MODO_VENDA.LEILAO) {
      lanceMinimo = normalizarPreco(minBid);

      if (lanceMinimo === null) {
        return { ok: false, reason: MARKET_RESULT.LANCE };
      }
    }

    if (this.countOf(sellerKey) >= ANUNCIOS_MAXIMOS) {
      return {
        ok: false,
        reason: MARKET_RESULT.LIMITE,
      };
    }

    const id = this.novoId();

    const listing = {
      id,
      sellerKey,
      sellerName,

      // o que o comprador vai receber: o item e a variante dele
      itemId: null,
      rarity: null,

      uid,

      price: preco,

      /**
       * A MOEDA, O MODO E O LANCE.
       *
     * Os tres vao junto com o anuncio porque eles sao o que faz o pagamento
       * do servidor. `moedaDaConta` e o que decide se o desconto sai do
       * personagem ou da conta
       */
      currency,
      modo,
      minBid: lanceMinimo,

      /**
       * O MAIOR LANCE, E QUEM FEZ.
       *
       * `null` enquanto ninguem lancou. E o comprador anterior e devolvido no
       * ato, no `bid`: sem o `maiorLance` o dinheiro do perdedor ficava
       * preso em um anuncio que ja nao e o dele
       */
      maiorLance: null,
      lances: 0,

    // 1 ate o `fill`, que substitui pelo que foi realmente tirado da
    // mochila. Ver o comentario do `fill`: a quantidade do anuncio e o
    // que o vendedor PERDEU, e nao o que ele pediu
    count: 1,

    createdAt: this.agora(),
    expiresAt: this.expiresAtDe(),
  };

    this.listings.set(id, listing);

    return { ok: true, listing };
  }

  /**
   * Preenche o `itemId` e a `raridade` do anuncio.
   *
   * E separado do `list` porque quem anuncia ainda tem o item na mao:
   * `takeUid` devolve o objeto com `itemId`, `rarity` e a contagem, e
   * o anuncio so passa a valer DEPOIS que o servidor tirou a peca do
   * vendedor. Um anuncio com `itemId: null` que sobrevivesse a um erro
   * no meio mostraria um anuncio invisivel na vitrine
   */
  fill(listing, taken) {
    if (!this.listings.has(listing.id)) return false;
    if (!taken?.itemId) return false;

    if (!podeListar(taken.itemId)) return false;

    listing.itemId = taken.itemId;
    listing.rarity =
      taken.rarity ?? getItem(taken.itemId)?.rarity ?? null;

    /**
     * A quantidade vem do que foi TIRADO, e nao do `count` do pedido.
     *
     * Sao dois numeros independentes no papel: o jogador pede "um
     * anuncio", o servidor tira N unidades da mochila e devolve o
     * `taken`. Se o `count` do anuncio viesse do pedido, um vendedor
     * que tirasse 3 da mochila e escrevesse `count: 1` venderia 1 e
     * perderia 2 — o dinheiro do comprador nao voltaria e o item
     * sumiria do jogo sem ninguem perceber
     */
    listing.count = Math.max(
      1,
      Math.floor(taken.count ?? 1),
    );

    return true;
  }

  /** tira um anuncio do ar sem vender: e o botao "cancelar" */
  cancel(listingId, sellerKey) {
    const listing = this.get(listingId);

    if (!listing) {
      return {
        ok: false,
        reason: MARKET_RESULT.SEM_ANUNCIO,
      };
    }

    /**
     * So o dono cancela.
     *
     * Sem esta comparacao, um jogador poderia cancelar o anuncio de
     * outro e ficar com o item de volta na mao de quem nao era dono
     */
    if (listing.sellerKey !== sellerKey) {
      return {
        ok: false,
        reason: MARKET_RESULT.SEM_ANUNCIO,
      };
    }

    this.listings.delete(listingId);

    return { ok: true, listing };
  }

  /**
   * O LANCE RETIDO QUE O CANCELAMENTO DEVOLVE, ou `null`.
   *
   * ## POR QUE O ESTORNO NAO ESTA AQUI DENTRO
   *
   * Porque este arquivo nao tem saldo de ninguem. O `cancel` apaga o anuncio
   * e DEVOLVE no resultado quem tinha dinheiro dentro, e quem credita e o
   * servidor. Se o estorno saisse daqui, seria dinheiro criado num arquivo que
   * so decide — e o caminho de quem credita passaria a existir em dois lugares
   *
   * E o que separa "cancelar um anuncio de ouro" de "cancelar um leilao": no
   * primeiro nao ha ninguem para devolver; no segundo ha, e o dinheiro e dele
   * ate o anuncio sair do ar
   *
   * @param {object} listing o anuncio ja removido
   * @returns {object|null} `{ key, name, valor, currency }`
   */
  lanceARetornar(listing) {
    if (listing.maiorLance == null || !listing.maiorLanceBuyer?.key) return null;

    return {
      key: listing.maiorLanceBuyer.key,
      name: listing.maiorLanceBuyer.name,
      valor: listing.maiorLance,
      currency: listing.currency,
    };
  }

  /**
   * Compra um anuncio.
   *
   * NAO mexe em nenhum inventario. Este metodo so decide e reserva: quem
   * tira o item do vendedor e quem entrega ao comprador sao o servidor,
   * que tem as duas sessoes na mao ao mesmo tempo
   *
   * A separacao existe porque a ordem e o que importa: tirar o item do
   * vendedor e dar as moedas a ele, e dar o item ao comprador e tirar
   * as moedas DELE. Feito dentro do `Market`, um erro no meio
   * duplicaria dinheiro ou item
   */
  buy(listingId, buyerKey, buyerName = null) {
    const listing = this.get(listingId);

    if (!listing) {
      return {
        ok: false,
        reason: MARKET_RESULT.SEM_ANUNCIO,
      };
    }

    if (listing.sellerKey === buyerKey) {
      return {
        ok: false,
        reason: MARKET_RESULT.PROPRIO,
      };
    }

    // o anuncio precisa estar COMPLETO para ser comprado
    if (!listing.itemId) {
      return {
        ok: false,
        reason: MARKET_RESULT.SEM_ITEM,
      };
    }

    /**
     * EM LEILAO NAO EXISTE COMPRA DIRETA.
     *
     * Porque o dinheiro do maior lance esta RETIDO, e o item nao sai do ar
     * ate o tempo acabar. Deixar o `buy` passar abriria um caminho que entrega
     * a peca pelo `price` de abertura — o lance minimo viraria decorativo
     */
    if (listing.modo === MODO_VENDA.LEILAO) {
      return {
        ok: false,
        reason: MARKET_RESULT.MODO,
      };
    }

    this.listings.delete(listingId);

    this.registrarVenda(listing, buyerKey, buyerName);

    return { ok: true, listing };
  }

  /**
   * UM LANCE EM UM LEILAO, e o dinheiro de quem era o maior.
   *
   * ## O QUE ESTE METODO NAO FAZ
   *
   * Nao move dinheiro nenhum. Ele so VALIDA e TROCA o maior lance, e devolve
   * no resultado quem precisa ser devolvido. O debito e o credito sao do
   * servidor: aqui nao existe saldo, e um `MarketStore` que cobrasse deixaria
   * a valida��o do dinheiro em dois lugares — um que recusaria e um que nao
   *
   * ## POR QUE O ANUNCIO CONTINUA NO AR
   *
   * Porque e um leilao. O item so sai quando expira e o `finish` do
   * servidor resolve, e e ai que o dinheiro vai para o vendedor
   *
   * @param {string} listingId o anuncio
   * @param {string} buyerKey quem esta lancando
   * @param {string} buyerName o nome do comprador, para a tela
   * @param {number} valor o lance
   * @returns {object} `{ ok, listing, devolvido }`, onde `devolvido` e o
   *   lance anterior quando alguem foi ultrapassado, ou `null`
   */
  bid(listingId, buyerKey, buyerName = null, valor) {
    const listing = this.get(listingId);

    if (!listing || !listing.itemId) {
      return { ok: false, reason: MARKET_RESULT.SEM_ANUNCIO };
    }

    if (listing.modo !== MODO_VENDA.LEILAO) {
      return { ok: false, reason: MARKET_RESULT.MODO };
    }

    if (listing.sellerKey === buyerKey) {
      return { ok: false, reason: MARKET_RESULT.PROPRIO };
    }

    const lance = normalizarPreco(valor);

    if (lance === null || lance < lanceMinimoAtual(listing)) {
      return { ok: false, reason: MARKET_RESULT.LANCE };
    }

/**
     * O LANCE ANTERIOR, PARA DEVOLVER.
     *
     * E capturado ANTES de sobrescrever e devolvido no resultado, para o
     * servidor saber QUEM foi ultrapassado. O dinheiro em si nao sai daqui: o
     * `MarketStore` nao tem saldo de ninguem, e um desconto neste arquivo
     * seria um desconto que nenhum lugar verificou
     */
    const valorAnterior = listing.maiorLance;
    const compradorAnterior = listing.maiorLanceBuyer ?? null;

    /**
     * O `valor` viaja junto do comprador porque e o que o `desfazerLance` usa
     * para repor o piso quando o servidor nao conseguir cobrar
     */
    const maiorAnterior = compradorAnterior
      ? { ...compradorAnterior, valor: valorAnterior }
      : null;

    listing.maiorLance = lance;
    listing.maiorLanceBuyer = { key: buyerKey, name: buyerName };
    listing.lances += 1;

    return {
      ok: true,
      listing,
      devolvido: valorAnterior,
      maiorAnterior,
      lances: listing.lances,
    };
  }

  /**
   * DESFAZ UM LANCE QUE O SERVIDOR NAO CONSEGUIU COBRAR.
   *
   * ## POR QUE ISTO EXISTE, E NAO UM `if` LONGE DE AQUI
   *
   * Porque o `bid` ja trocou o maior lance quando o servidor tenta debitar. Se
   * o debito falhar e o anuncio ficar com o lance de um jogador que nunca
   * pagou, o proximo ve um piso errado e o item pode ser entregue de graca
   *
   * @param {string} listingId o anuncio
   * @param {object|null} maiorAnterior quem era o maior, como o `bid` devolveu
   * @param {number} lances o contador que o `bid` gravou
   */
  desfazerLance(listingId, maiorAnterior, lances) {
    const listing = this.get(listingId);

    if (!listing) return false;

    listing.maiorLance = maiorAnterior?.valor ?? null;
    listing.maiorLanceBuyer = maiorAnterior;
    listing.lances = Math.max(0, (lances ?? 1) - 1);

    return true;
  }

  /**
   * A venda entra no historico.
   *
   * O `buyerKey` vai junto porque o painel precisa dizer "vendido para
   * Ana" sem precisar de outra consulta — e porque o historico e a
   * unica pista de quem ficou com o item se um dia for preciso
   * desfazer
   *
   * O `buyerName` e O NOME, e nao a chave. A chave e o `nameKey` do
   * nome: minusculo, sem espaco e sem acento. Deixar `buyerName` nulo
   * fazia o painel cair no `buyerKey` e mostrar "vendido para teste2"
   * para quem se chama "Teste 2" — e, depois de um restart, o
   * `sanitizarVenda` lia esse nulo do disco e mantinha a chave para
   * sempre
   */
  registrarVenda(listing, buyerKey, buyerName = null) {
    this.historico.push({
      id: listing.id,
      itemId: listing.itemId,
      rarity: listing.rarity,
      count: listing.count,
      price: listing.price,

/**
       * A MOEDA DA VENDA.
       *
       * E nao um detalhe do historico: sem ela, uma linha de venda de um
       * item em diamante e uma em ouro mostrariam o MESMO numero, e o
       * jogador nao teria como saber qual das duas aconteceu
       */
      currency: listing.currency,

      sellerKey: listing.sellerKey,
      sellerName: listing.sellerName,
      buyerKey,
      buyerName: buyerName ?? null,

      soldAt: this.agora(),
      expiresAt: listing.expiresAt,
    });

    while (this.historico.length > this.MAX_HISTORICO) {
      this.historico.shift();
    }
  }

  /** o historico, do mais recente para o mais antigo */
  historyOf(sellerKey = null) {
    return [...this.historico]
      .filter(
        (venda) =>
          sellerKey === null ||
          venda.sellerKey === sellerKey,
      )
      .reverse();
  }

  /** todas as vendas, para o painel ver o movimento do mercado */
  allHistory() {
    return this.historyOf(null);
  }

  /**
   * Os anuncios VENCIDOS, sem remove-los.
   *
   * E a leitura de quem so quer mostrar a vitrine. Um anuncio vencido
   * e invisivel para o jogador, mas ele continua no `Map` ate alguem
   * CHAMAR o `expirar` e devolver o item ao dono
   *
* A separacao importa: se a vitrine usasse o `expirar` para nao
   * mostrar um anuncio vencido, ela apagaria o anuncio sem devolver o
   * item ao dono
   */
  expirados() {
    const agora = this.agora();

    return [...this.listings.values()].filter(
      (listing) => listing.expiresAt <= agora,
    );
  }

  /** os anuncios que ainda valem, sem mexer no `Map` */
  vigentes() {
    const agora = this.agora();

    return [...this.listings.values()].filter(
      (listing) => listing.expiresAt > agora,
    );
  }

/**
   * Remove os anuncios vencidos e devolve o que volta.
   *
   * E uma funcao LAZY: ela roda quando alguem le, nao num `setInterval`.
   * O motivo e o mesmo do `LootSystem.pruneDrops`: um anuncio vencido
   * e inofensivo enquanto ninguem o ve, e um laco de relogio a mais no
   * servidor seria mais uma fonte de bug
   *
   * O que EXPIROU volta para o vendedor: o item e dele, e sumir seria
   * o jogador perder trabalho por um esquecimento. Quem credita a
   * devolucao e o SERVIDOR, que e quem tem a sessao do dono
   *
   * ## E OS LEILÕES, POR QUE ESTE NÃO É O CAMINHO DELES
   *
   * Porque um leilao vencido tem dinheiro de terceiro dentro. Apagar o
   * anuncio aqui devolveria o item ao vendedor sem nunca decidir o que
   * acontece com o lance — e o comprador perderia o valor sem aviso
   *
   * Um leilao com lance e IGNORADO por este metodo, de proposito. Quem
   * encerra leilao e o `fecharLeilao`, chamado pelo servidor, que e quem
   * tem as duas sessoes para fazer as duas transferencias
   */
  expirar() {
    const agora = this.agora();
    const expirados = [];

    for (const [id, listing] of this.listings) {
      if (listing.expiresAt > agora) continue;

      // dinheiro de terceiro dentro: nao apaga aqui
      if (
        listing.modo === MODO_VENDA.LEILAO &&
        (listing.maiorLance != null || listing.lances > 0)
      ) {
        continue;
      }

      this.listings.delete(id);

      expirados.push(listing);
    }

    return expirados;
  }

  /**
   * ENCERRA UM LEILAO VENCIDO, e devolve quem venceu.
   *
   * ## POR QUE EXISTE SEPARADO DO `buy`
   *
   * Porque o `buy` e o COMPRADOR comprando no ato: ele paga e recebe na
   * mesma hora. O leilao vence sozinho, sem ninguem online, e o dinheiro do
   * lance precisa ir para o vendedor enquanto o item vai para o comprador —
   * duas sessoes diferentes, possivelmente nenhuma das duas on-line
   *
   * ## E POR QUE ELE NAO CUIDA DO DINHEIRO
   *
   * Porque este arquivo nao tem saldo de ninguem. Ele devolve QUEM venceu e o
   * VALOR, e quem credita e o servidor. Um `MarketStore` que pagasse seria a
   * segunda implementacao do dinheiro do mercado, e as duas divergiriam
   *
   * @param {string} listingId o anuncio
   * @returns {object} `{ ok, listing, comprador, valor }`, onde `comprador` e
   *   `null` em um leilao sem lances — nesse caso o item volta ao vendedor
   */
fecharLeilao(listingId) {
    /**
     * O MAP CRU, e nao o `get`.
     *
     * E o detalhe que faz este metodo funcionar: `get` esconde o anuncio
     * quando ele ja venceu, e um leilao que vence e EXATAMENTE o caso deste
     * metodo. Lendo pelo `get`, todo leilao devolvia `{ ok: false }` no
     * instante em que precisava fechar — o dinheiro do comprador ficava
     * retido para sempre e o item nunca chegava a ninguem
     */
    const listing = this.listings.get(listingId) ?? null;

    if (!listing || listing.modo !== MODO_VENDA.LEILAO) {
      return { ok: false };
    }

  this.listings.delete(listingId);

  // sem lance, o leilao vira uma devolucao comum: o `expirarAnuncios` do
  // servidor ja sabe devolver um item ao dono
  if (listing.maiorLance == null || !listing.maiorLanceBuyer?.key) {
    return { ok: true, listing, comprador: null };
  }

  const comprador = listing.maiorLanceBuyer;
  const valor = listing.maiorLance;

  this.registrarVenda(listing, comprador.key, comprador.name);

return { ok: true, listing, comprador, valor };
}

  /** quantos anuncios estao abertos AGORA.
 *
 * Roda `expirar` antes de contar. Um `openCount` que devolvesse o
 * tamanho do `Map` diria 1 para um anuncio que venceu no instante
 * anterior, e o painel mostraria um anuncio na vitrine que ninguem
 * consegue comprar
 */
get openCount() {
  return this.vigentes().length;
}

  /**
   * O estado que vai para o disco.
   *
   * Guarda o `uid` do vendedor porque sem ele o item listado nao
   * consegue voltar: o `uid` e a unica referencia para a peca dentro
   * do inventario de quem vendeu
   */
  toSave() {
    return {
      listings: [...this.listings.values()],
      historico: this.historico,
    };
  }

  fromSave(data) {
    if (!data || typeof data !== "object") return;

    this.listings = new Map();
    this.historico = [];

    for (const bruto of data.listings ?? []) {
      const listing = this.sanitizarAnuncio(bruto);

      if (!listing) continue;

      this.listings.set(listing.id, listing);
    }

    for (const bruto of data.historico ?? []) {
      const venda = this.sanitizarVenda(bruto);

      if (!venda) continue;

      this.historico.push(venda);
    }
  }

  /**
   * Um anuncio do disco so volta se ele for INTEIRO.
   *
   * O arquivo pode ter sido editado a mao, ser de uma versao futura ou
   * ter ficado pela metade — o `CharacterSave.js` diz isso no comeco.
   * Um anuncio pela metade na vitrine e pior que um anuncio a menos:
   * o jogador clicaria nele e o servidor recusaria
   */
  sanitizarAnuncio(bruto) {
    if (!bruto || typeof bruto !== "object") return null;

    const id = texto(bruto.id, 64);
    const sellerKey = texto(bruto.sellerKey, 64);
    const itemId = texto(bruto.itemId, 64);

    // um anuncio sem `itemId` nunca foi completo: ele nunca saiu da
    // mao do vendedor, e o item esta la
    if (!id || !sellerKey || !itemId) return null;

    // item fora do catalogo e descartado: viraria um anuncio que o
    // comprador recebe sem ver nada
    if (!podeListar(itemId)) return null;

    const price = normalizarPreco(bruto.price);

    if (price === null) return null;

    const createdAt = numero(bruto.createdAt);
    const expiresAt = numero(bruto.expiresAt);

    /**
     * O prazo e RECONSTRUIDO quando o arquivo traz algo inutil.
     *
     * Um `expiresAt` zerado faria o anuncio nascer morto — `expirar()`
     * o removeria no primeiro `all()` — e o vendedor perderia o item
     * sem nunca ter visto o anuncio
     */
    return {
      id,
      sellerKey,
      sellerName:
        texto(bruto.sellerName, 64) ?? "Anônimo",
      itemId,
      rarity:
        texto(bruto.rarity, 32) ??
        getItem(itemId)?.rarity ??
        null,
      count: Math.max(1, Math.floor(numero(bruto.count, 1))),
      uid: texto(bruto.uid, 64),
      price,

      /**
       * A MOEDA, O MODO E O LANCE, LIDOS DO DISCO.
       *
       * Os tres caem em `coins` e `fixo` quando o arquivo nao traz, porque
       * esse era o unico formato que existia antes. Um anuncio antigo gravado
       * sem os campos tem de continuar valendo como o que ele sempre foi: um
       * anuncio de ouro, com compra direta
       *
       * E o `modo` e lido ANTES do `minBid`, porque um `minBid` gravado num
       * anuncio de venda fixa nao faz sentido de restaurar — o `market.list`
       * e o `market.bid` so olham para o `minBid` em leilao
       */
      currency: moedaValida(bruto.currency) ? bruto.currency : MOEDA.OURO,
      modo: modoValido(bruto.modo) ? bruto.modo : MODO_VENDA.FIXO,

      /**
       * O MAIOR LANCE E QUEM FEZ.
       *
       * Juntos ou nada: um `maiorLance` sem comprador nao tem a quem devolver,
       * e um comprador sem valor nao tem o que devolver. Um arquivo com a
       * metade gravada vira um piso que ninguem pagou
       */
      minBid: normalizarPreco(bruto.minBid),
      maiorLance: normalizarPreco(bruto.maiorLance),
      maiorLanceBuyer:
        bruto.maiorLanceBuyer &&
        typeof bruto.maiorLanceBuyer === "object"
          ? {
              key: texto(bruto.maiorLanceBuyer.key, 64) ?? "",
              name: texto(bruto.maiorLanceBuyer.name, 64) ?? "",
            }
          : null,
      lances: Math.max(0, Math.floor(numero(bruto.lances, 0))),

      createdAt,
      expiresAt:
        expiresAt > createdAt
          ? expiresAt
          : this.expiresAtDe(),
    };
  }

  sanitizarVenda(bruto) {
    if (!bruto || typeof bruto !== "object") return null;

    const id = texto(bruto.id, 64);
    const itemId = texto(bruto.itemId, 64);

    if (!id || !itemId) return null;
    if (!podeListar(itemId)) return null;

    const price = normalizarPreco(bruto.price);

    if (price === null) return null;

    return {
      id,
      itemId,
      rarity:
        texto(bruto.rarity, 32) ??
        getItem(itemId)?.rarity ??
        null,
      count: Math.max(1, Math.floor(numero(bruto.count, 1))),
      price,

      // a moeda entra tambem no disco da venda, com a mesma queda para ouro
      // do anuncio: uma venda gravada antes das moedas era em ouro
      currency: moedaValida(bruto.currency) ? bruto.currency : MOEDA.OURO,

      sellerKey: texto(bruto.sellerKey, 64) ?? "",
      sellerName: texto(bruto.sellerName, 64) ?? "Anônimo",
      buyerKey: texto(bruto.buyerKey, 64) ?? "",
      buyerName: texto(bruto.buyerName, 64) ?? "",
      soldAt: numero(bruto.soldAt),
      expiresAt: numero(bruto.expiresAt),
    };
  }
}

/**
 * O painel do market, do ponto de vista de UM jogador.
 *
 * A funcao fica aqui, e nao no componente, porque quem monta o painel
 * e o `GameEngine`, e ele tem o vendedor e o comprador na mao. O
 * componente recebe so o resultado
 *
 * O filtro de tipo e de raridade acontece AQUI, e nao no componente,
 * pelo mesmo motivo do `rank`: se o cliente filtrasse, um cliente
 * modificado veria anuncios que o servidor escondeu. E a vitrine e
 * pequena, entao filtrar no servidor e o mais barato
 */
export function snapshotMarket({
  store,
  viewerKey,
  viewerName,
  filtro = {},
  agora = null,
  mochila = null,
  coins = null,
}) {
  const relogio = agora ?? store.agora();

  const listings = store.all()
    .filter((listing) => listing.itemId)
    .filter((listing) => matchesFiltro(listing, filtro))
    .filter((listing) => listing.sellerKey !== viewerKey)
    .map((listing) => ({
      id: listing.id,
      itemId: listing.itemId,
      rarity: listing.rarity,
      count: listing.count,
      price: listing.price,

      /**
       * A MOEDA, O MODO E O PISO DO LANCE, e eles SAlEM PARA O CLIENTE.
       *
       * Porque o `ListingCard` decide entre comprar e dar lance lendo o
       * `modo`, e o `IconeMoeda` precisa saber qual arte desenhar. Sem os
       * tres no snapshot, o cliente cairia no padrao ouro e o mostraria para
       * um anuncio que o servidor cobra em diamante
       */
      currency: listing.currency,
      modo: listing.modo,
      minBid: listing.minBid,
      maiorLance: listing.maiorLance,

      /**
       * QUEM ESTA NO MAIOR LANCE, so o NOME.
       *
       * A chave fica de fora pelo mesmo motivo da chave do vendedor: ela
       * existe para o servidor devolver o dinheiro, e nao ajuda o jogador a
       * ler o card
       */
      maiorLanceBuyer: listing.maiorLanceBuyer?.name ?? null,
      lances: listing.lances,

      sellerName: listing.sellerName,

      /**
       * A chave do vendedor NAO vai para o cliente.
       *
       * Ela existe para o servidor saber de quem e o anuncio, e nao
       * ajuda o jogador a ler nada. Mandar pelo socket daria a qualquer
       * cliente a chave de todos os personagens do mundo — inclusive a
       * de quem esta anunciando, que e o mesmo dado que impede o
       * jogador de comprar o proprio anuncio
       */
      // (o campo e omitido de proposito: ve o comentario acima)

      expiresAt: listing.expiresAt,
      restanteMs: Math.max(0, listing.expiresAt - relogio),
      color: corDoAnuncio(listing.rarity),
    }))
.sort((a, b) => {
        // mais barato primeiro: e o que o jogador quer ver numa compra
        if (a.price !== b.price) return a.price - b.price;

      // empate: mais rapido para vencer
      return b.restanteMs - a.restanteMs;
    });

  const meus = store.ofSeller(viewerKey).map((listing) => ({
    id: listing.id,
    itemId: listing.itemId,
    rarity: listing.rarity,
    count: listing.count,
    price: listing.price,

    // os mesmos tres da vitrine, e pelo mesmo motivo: a aba "meus anuncios"
    // precisa dizer em que moeda o item esta e se ele esta em leilao
    currency: listing.currency,
    modo: listing.modo,
    minBid: listing.minBid,
    maiorLance: listing.maiorLance,
    lances: listing.lances,

    expiresAt: listing.expiresAt,
    restanteMs: Math.max(
      0,
      listing.expiresAt - relogio,
    ),
    color: corDoAnuncio(listing.rarity),

    // um anuncio que nao tem `itemId` esta com o item na mao do
    // vendedor: ele nao aparece na vitrine, mas o jogador precisa
    // saber que ele existe
    completo: Boolean(listing.itemId),
  }));

  const historico = store.allHistory().map((venda) => ({
    id: venda.id,
    itemId: venda.itemId,
    rarity: venda.rarity,
    count: venda.count,
    price: venda.price,
    currency: venda.currency,
    sellerName: venda.sellerName,
    buyerName: venda.buyerName ?? venda.buyerKey,
    soldAt: venda.soldAt,
    color: corDoAnuncio(venda.rarity),

    // a venda e MINHA quando eu vendi ou comprei: o historico do
    // jogador mostra as duas pontas
    minha:
      venda.sellerKey === viewerKey ||
      venda.buyerKey === viewerKey,
  }));

  return {
    listings,
    meus,
    historico,

    total: store.openCount,

    /**
     * AS MOEDAS DE QUEM ESTA OLHANDO.
     *
     * O motor passa `coins` e este campo devolvia `null` fixo, entao o
     * painel do mercado recebia `null` mesmo com o valor real chegando.
     * O `?? 0` e so para o Single player, onde nao ha coins injetados
     */
    coins: coins ?? 0,

    /**
     * A MOCHILA DE QUEM ESTA OLHANDO, em slots.
     *
     * Sem isto o painel nao tem como saber que um anuncio nao cabe: o
     * jogador so descobria depois de clicar, com o servidor recusando e
     * o dinheiro jahaving sido devolvido. Com `livres` e `capacity` o
     * botao de compra pode avisar antes, e cada anuncio sabe dizer
     * quantos slots exige
     */
    mochila: {
      livres: mochila?.livres ?? 0,
      capacity: mochila?.capacity ?? 0,
    },

    limites: {
      maxAnuncios: ANUNCIOS_MAXIMOS,
      precoMinimo: PRECO_MINIMO,
      precoMaximo: PRECO_MAXIMO,
    },
  };
}

/** o filtro bate com o anuncio? */
export function matchesFiltro(listing, filtro = {}) {
  if (!filtro) return true;

  if (filtro.tipo) {
    if (getItem(listing.itemId)?.type !== filtro.tipo) {
      return false;
    }
  }

  if (filtro.rarity) {
    if (listing.rarity !== filtro.rarity) return false;
  }

  /**
   * O MODO NAO FILTRA NADA, E ISTO E DE PROPOSITO.
   *
   * Existiu um segundo modo, o "leilao", que foi removido por nao ter
   * mecanica propria. Sobrou so o `FIXO`, entao comparar o modo do
   * anuncio com o modo pedido seria verdadeiro ou falso para a mesma
   * coisa. O `if` fica aqui vazio de proposito, para o lugar existir caso
   * um dia voltar a ter mais de um modo
   */

  return true;
}

/* ---- sanitizadores, os mesmos do `CharacterSave` ---- */

const NUMERO_MAX = 1_000_000_000;

function numero(valor, padrao = 0) {
  const n = Number(valor);

  if (!Number.isFinite(n)) return padrao;

  return Math.min(NUMERO_MAX, Math.max(0, Math.trunc(n)));
}

function texto(valor, tamanho = 64) {
  if (typeof valor !== "string") return null;

  const limpa = valor.slice(0, tamanho);

  return limpa.length > 0 ? limpa : null;
}

export { ITEM_TYPE, MARKET_RESULT };