import { useMemo, useState } from "react";
import ItemIcon from "../UI/ItemIcon.jsx";
import InvSlotView from "../UI/InvSlotView.jsx";
import ItemCard from "../UI/ItemCard.jsx";
import { slotsNecessarios } from "../../game/inventory/Inventory.js";
import {
  ANUNCIOS_MAXIMOS,
  ANUNCIO_DIAS,
  MODO_VENDA,
  MODO_VENDA_DICA,
  PRECO_MAXIMO,
  PRECO_MINIMO,
  describeAnuncioItem,
  labelTipo,
  tipoDoAnuncio,
  precoValido,
  precoUnitario,
  RARIDADES_FILTRO,
  TIPOS_VENDA,
  totalDoAnuncio,
} from "../../data/market/index.js";
import {
  RARITY_STYLE,
  getItem,
  isStackable,
} from "../../data/items/index.js";

/**
 * O painel do MARKET.
 *
 * Quatro abas porque sao quatro perguntas diferentes, e cada uma precisa
 * de uma tela diferente:
 *
 * - COMPRAR: a vitrine alheia, filtrada, do mais barato para o mais
 *   caro. E onde o jogador olha o que os outros tem
 * - VENDER: a propria mochila, com o preco. E onde ele monta o
 *   anuncio
 * - MEUS ANUNCIOS: o que ele ja deixou a venda, com o tempo que resta e o
 *   botao de cancelar. A aba que ele abre todo dia
 * - HISTORICO: o que ja foi vendido, de quem e para quem. E a unica aba
 *   que o jogador usa para saber o PRECO: ver o que os outros
 *   cobraram e a forma de o jogador saber se 200 e caro ou barato
 *
 * O filtro fica NESTE componente e nao no servidor, ao contrario do
 * `rank` e do craft. A diferenca e o custo: a vitrine e pequena e o
 * filtro muda a cada tecla, e um pedido por tecla seria uma enxurrada
 * de trafego. O que o servidor garante e o que importa: os anuncios
 * que chegam JA vem filtrados de todos os outros jogadores, e quem
 * compra nao consegue dizer "me de todos os anuncios" ignorando o
 * filtro
 */

const ABAS = [
  { id: "comprar", icone: "⇄", label: "Comprar" },
  { id: "vender", icone: "⚑", label: "Vender" },
  { id: "meus", icone: "▤", label: "Meus anuncios" },
  { id: "historico", icone: "≡", label: "Historico" },
];

/**
 * O `inventory` do painel ja vem no formato do `summary` do servidor, e
 * o `summary` nao tem `stacks`: tem `items`. A `slotsNecessarios` quer
 * pilhas, entao a lista vira uma de lista
 */
const inventarioEmPilhas = (inventory) => inventory?.items ?? [];

/**
 * O painel aguenta `market` nulo.
 *
 * O primeiro evento de rede chega um instante depois do primeiro
 * quadro, e ha um intervalo em que o jogador ja ve o botao e o painel
 * ainda nao tem dado. Um painel que dereferencia `listings` nesse
 * instante derruba a tela
 */
const VAZIO = {
  listings: [],
  meus: [],
  historico: [],
  total: 0,
  coins: 0,
  limites: {
    maxAnuncios: ANUNCIOS_MAXIMOS,
    precoMinimo: PRECO_MINIMO,
    precoMaximo: PRECO_MAXIMO,
  },
};

/**
 * A LISTA DE ANUNCIOS, e ela e USADA EM DOIS LUGARES.
 *
 * ## POR QUE UM COMPONENTE E NAO A MARCACAO DIRETA
 *
 * Porque a aba "Meus anuncios" e o bloco "Seus anuncios" da aba VENDER
 * mostram a MESMA coisa: os anuncios deste jogador, com o tempo que resta
 * e o botao de cancelar. A diferenca e so o que esta em volta — a aba tem
 * cabecalho e a lista de filtro, a outra tem a mochila
 *
 * Duplicar as 40 linhas faria as duas divergirem no primeiro ajuste: o
 * tempo que resta apareceria num e nao no outro, e o jogador veria dois
 * numeros para o mesmo anuncio
 *
 * ## POR QUE O CARD NAO TEM O NOME DO COMPRADOR
 *
 * Porque todos estes anuncios sao DO jogador que esta olhando. Nome de
 * vendedor so faz sentido na vitrine alheia, e aqui ele repetiria o nome
 * do proprio jogador em cada linha
 */
function ListaDeAnuncios({ anuncios, onCancel }) {
  return (
    <ul className="mkt-list">
      {(anuncios ?? []).map((listing) => (
        <li
          key={listing.id}
          className="mkt-item is-own"
          style={listing.color ? { "--mkt": listing.color } : undefined}
        >
          <header className="mkt-item__head">
            <ItemIcon
              itemId={listing.itemId}
              rarity={listing.rarity}
              className="mkt-item__icon"
              alt=""
            />

            <span className="mkt-item__names">
              <strong>
                {describeAnuncioItem({
                  itemId: listing.itemId,
                  rarity: listing.rarity,
                  count: listing.count,
                })}
              </strong>
            </span>

            <span className="mkt-item__price">
              <strong>{listing.price}</strong>
            </span>
          </header>

          <footer className="mkt-item__foot">
            <BarraTempo restanteMs={listing.restanteMs} />

            <button
              type="button"
              className="mkt-item__cancel"
              onClick={() => onCancel?.(listing.id)}
            >
              Cancelar
            </button>
          </footer>
        </li>
      ))}
    </ul>
  );
}

/**
 * A ABA "MEUS ANUNCIOS".
 *
 * E a quarta pergunta do mercado, e ela e a mais especifica: nao "o que
 * os outros vendem" (Comprar), nem "o que eu tenho para vender" (Vender) —
 * e "o que EU ja coloquei a venda, e ate quando"
 *
 * ## POR QUE ELA PRECISA EXISTIR SENDO QUE A LISTA JA APARECE NA VENDER
 *
 * Porque a lista na aba VENDER esta embaixo da mochila e dos filtros, e o
 * jogador precisa montar um anuncio para chegar nela. Quem veio conferir um
 * anuncio so, para ver quanto tempo falta ou cancelar, tem que rolar a aba
 * inteira — e a aba VENDER e a mais longa do painel, porque tem dois
 * filtros e o formulario inteiro
 *
 * E o caso comum: quem anuncia, volta para ver se vendeu. Todo dia, ate
 * o anuncio sair ou o prazo acabar
 *
 * ## E POR QUE A LISTA CONTINUA NA VENDER
 *
 * Porque quem esta no formulario e precisa ver o que ja tem aberto sem
 * trocar de aba: o limite de anuncios so faz sentido com os dois visiveis
 * ao mesmo tempo. Tirar de la obrigaria o jogador a alternar entre duas
 * abas para montar um anuncio
 */
export function MeusAnunciosAba({ data, onCancel }) {
  const meus = data?.meus ?? [];

  const limites = data?.limites ?? VAZIO.limites;

  if (meus.length === 0) {
    return (
      <div className="mkt-historico__escopo">
        {/*
          A CLASSE DO ESTADO VAZIO E A DO HISTORICO.
          *
          * `mkt-empty` nao tem regra nenhuma no CSS — quem escreve a classe
          * nao recebe estilo. O estado vazio que ja funciona no historico e o
          * `inv-panel__empty`, e e ele que centra o texto e da o respiro
          *
          * Nao criei uma regra nova para o nome certo, porque o nome certo
          * aqui e o do estado vazio de um painel do jogo, e nao uma coisa
          * so de lista vazia
        */}
        <p className="inv-panel__empty">
          Voce nao tem anuncios abertos.
        </p>

        <p className="mkt-hint">
          Use o botao + ANUNCIAR para colocar algo a venda. O anuncio aparece
          aqui, com o tempo que resta e o botao de cancelar.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mkt-hint">
        {meus.length < limites.maxAnuncios
          ? `Anuncios abertos: ${meus.length}/${limites.maxAnuncios}. Validade: ${ANUNCIO_DIAS} dias.`
          : `Voce atingiu o limite de ${limites.maxAnuncios} anuncios. Cancele um para abrir outro.`}
      </p>

      <ListaDeAnuncios anuncios={meus} onCancel={onCancel} />
    </>
  );
}

export default function MarketPanel({
  market,
  inventory,
  onBuy,
  onCancel,
  onList,
  onClose,
}) {
  const [aba, setAba] = useState("comprar");

  const data = {
    ...VAZIO,
    ...(market ?? {}),
    limites: { ...VAZIO.limites, ...(market?.limites ?? {}) },
  };

  return (
    <></>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A vitrine alheia.
 *
 * O filtro e reativo e local: o jogador digita e a lista muda na hora.
 * O `useMemo` existe porque o filtro reordena e re-corta a lista, e
 * sem isso a vitrine inteira seria recalculada a cada tecla digitada
 */
export function ComprarAba({ data, inventory, onBuy }) {
  const [tipo, setTipo] = useState("");
  const [raridade, setRaridade] = useState("");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    /**
     * O TERMO, em minusculas, uma vez.
     *
     * `.toLowerCase()` dentro do `filter` repetiria a conversao para cada
     * anuncio a cada tecla digitada. Com a vitrine em dezenas de itens e
     * a busca ja rodando a cada tecla, isso e a diferenca entre digitar e
     * digitar com atraso
     */
    const termo = busca.trim().toLowerCase();

    return data.listings.filter((listing) => {
      if (tipo && tipoDoAnuncio(listing) !== tipo) return false;
      if (raridade && listing.rarity !== raridade) {
        return false;
      }

      if (termo) {
        /**
         * A BUSCA E PELO NOME DO ITEM, e nao pelo texto do anuncio.
         *
         * O anuncio tem nome de quem vende e preco, e nenhum dos dois
         * ajuda o jogador a achar uma coisa: quem procura "arco" esta
         * procurando um arco. O nome vem do CATALOGO, e nao do
         * `describeAnuncioItem`, que acrescenta a quantidade e a raridade
         * por extenso — e "Arco de caça" nao casaria com quem digitou
         * "arco"
         */
        const nome = getItem(listing.itemId)?.name ?? "";

        if (!nome.toLowerCase().includes(termo)) {
          return false;
        }
      }

      return true;
    });
  }, [data.listings, tipo, raridade, busca]);

  /**
   * O ITEM CABE NA MOCHILA DO COMPRADOR?
   *
   * A checagem e do LADO DO CLIENTE e e uma economia, nao uma
   * seguranca: o servidor confere de novo antes de entregar
   *
   * Duas coisas foram corrigidas aqui. A primeira e que esta funcao lia
   * `inventory.freeSlots`, um campo que o servidor NUNCA envia — o
   * `summary` manda `used`, `capacity` e `isFull`. Um `undefined > 0`
   * da `false`, entao o botao ficava "A mochila esta cheia" para todo
   * anuncio, com a mochila livre
   *
   * A segunda e que "tem 1 slot livre" nao basta: um anuncio de 200
   * materiais precisa de 3 slots mesmo com 1 livre, porque cada pilha
   * guarda 99. A conta e a do servidor (`slotsNecessarios`), para o
   * botao e a recusa dizerem a mesma coisa
   */
  const livres = data.mochila?.livres ?? null;

  const cabe = (listing) => {
    // sem os slots no painel (Single player) deixa o botao agir: quem
    // decide, no fim das contas, e o servidor
    if (livres === null) return true;

    const precisa = slotsNecessarios(
      inventarioEmPilhas(inventory),
      listing.itemId,
      listing.count,
      listing.rarity,
    );

    return precisa <= livres;
  };

  return (
    /**
     * A VITRINE DE DUAS COLUNAS: o filtro na lateral, os cards na
     * direita.
     *
     * ## POR QUE OS FILTROS FORAM PARA A ESQUERDA
     *
     * Eles ficavam numa faixa ACIMA da lista, empurrando os anuncios
     * para baixo e fazendo o jogador rolar ate comecar a ver. E o filtro
     * e uma ferramenta de leitura: ele fica ao lado do que filtra, para
     * mudar o filtro e ver o resultado sem que a pagina se mexa
     *
     * ## POR QUE UM CARD E NAO A LINHA ANTIGA
     *
     * O anuncio usava uma linha propria (`mkt-item`), com arte, nome,
     * vendedor, preco e botao em tres colunas. A vitrine e uma lista de
     * coisas para comparar, e comparar precisa de um formato que se repete
     * e se alinha. E o `ItemCard` — o mesmo da mochila e do encantar —
     * ja faz isso, com a raridade na barrinha de cima do card
     *
     * O preco, o vendedor, o prazo e o botao entram no espaco de baixo do
     * card, que e o que o `ItemCard` deixa para quem o usa
     */
    <div className="mkt-comprar">
      <aside className="mkt-lateral">
        <Filtros
          tipo={tipo}
          raridade={raridade}
          onTipo={setTipo}
          onRaridade={setRaridade}
        />

        <label className="mkt-busca">
          <span>Pesquisar</span>

          <input
            type="text"
            className="mkt-busca__input"
            placeholder="Nome do item..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </label>

        {/*
          O QUE A BUSCA CAIU FORA, e so quando ela e a causa.
          *
          * Sem isso a lista vazia dizia "nenhum anuncio com esse filtro"
          * mesmo com a vitrine cheia: o jogador digitava "arco", nao
          * achava, e nao sabia se o filtro ou a busca era o culpado
        */}
        {busca.trim() !== "" && (
          <p className="mkt-lateral__conta">
            {filtrados.length} de {data.listings.length}
          </p>
        )}
      </aside>

      {filtrados.length === 0 ? (
        <p className="inv-panel__empty mkt-vazia">
          {data.listings.length === 0
            ? "Nenhum anuncio no mercado."
            : busca.trim() !== ""
              ? "Nenhum item com esse nome."
              : "Nenhum anuncio com esse filtro."}
        </p>
      ) : (
        <div className="mkt-vitrine">
          {filtrados.map((listing) => (
            <ItemCard key={listing.id} entry={listing}>
              {/*
                O QUE O CARDO NAO SABE: quem vende, por quanto, ate
                quando, e o botao.

                Sao tres dados de um anuncio e nao de um item — e o
                `ItemCard` cuida so do item. Passar o anuncio inteiro
                como `entry` e o que faz o card mostrar a raridade e a
                quantidade certas sem o `ItemCard` saber de mercado
              */}
              <span className="mkt-card__seller">
                {listing.sellerName}
              </span>

              <span className="mkt-card__preco">
                <strong>{listing.price}</strong>

                {listing.count > 1 && (
                  <small>
                    {precoUnitario(listing.price, listing.count)}
                    /un
                  </small>
                )}
              </span>

              <BarraTempo restanteMs={listing.restanteMs} />

              <button
                type="button"
                className="mkt-item__buy mkt-card__buy"
                onClick={() => onBuy?.(listing.id)}
                disabled={!cabe(listing)}
                data-tip={
                  cabe(listing)
                    ? "Comprar"
                    : `Nao cabe: precisa de ${slotsNecessarios(
                        inventarioEmPilhas(inventory),
                        listing.itemId,
                        listing.count,
                        listing.rarity,
                      )} slot(s) e voce tem ${livres ?? 0}`
                }
              >
                Comprar
              </button>
            </ItemCard>
          ))}
        </div>
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ */

/**
 * A propria mochila, virada em anuncios.
 *
 * O preco e um campo livre, e nao um `<select>` com opcoes. O jogador
 * precisa poder escrever 137, que e o preco que ele，愿意 pagar
 */
export function VenderAba({ data, inventory, onCancel, onList }) {
  const [selecionado, setSelecionado] = useState(null);
  const [preco, setPreco] = useState("");
  const [quantidade, setQuantidade] = useState("");

  const [erro, setErro] = useState("");

  const limites = data.limites;
  const cabe = data.meus.length < limites.maxAnuncios;

  const itens = inventory?.items ?? [];

  const selecionada = itens.find(
    (item) => item.uid === selecionado,
  );

  /**
   * So o que EMPILHA tem quantidade.
   *
   * Um arco raro e uma peca so: mostrar "quantidade" para ele seria
   * convidar o jogador a escrever 3 num item que so existe em uma
   * unidade, e ele veria o anuncio derreter para 1 na hora. O campo
   * some, e com ele a duvida
   */
  const empilha = selecionada
    ? isStackable(getItem(selecionada.itemId))
    : false;

  /**
   * O VALOR do catalogo, como referencia de preco.
   *
   * O `value` do item e o que o jogo paga quando ele vai para o loot, e
   * nao o que o mercado cobra: ninguem tem obrigação de vender pelo
   * valor. Mas um jogador que nunca vendeu nao tem nenhuma noção do
   * numero, e digitar qualquer coisa no preco e chutar
   *
   * Aparece SO depois de escolher o item, porque antes disso nao ha
   * valor nenhum para mostrar — e o campo fica limpo enquanto o jogador
   * ainda esta escolhendo
   */
  const valorItem = selecionada
    ? getItem(selecionada.itemId)?.value ?? null
    : null;

  const disponivel = selecionada?.count ?? 0;

  const numeroQuantidade = Number(quantidade);

  /**
   * A quantidade so vale se for um numero INTEIRO dentro da pilha.
   *
   * Campo vazio significa "tudo", que e o que o jogador quer na maior
   * parte das vezes: por isso o `padrao` cai para o total da pilha em
   * vez de virar 1 e o jogador anunciar uma unidade sem perceber
   */
  const quantidadeNumero = !empilha
    ? 1
    : quantidade === ""
      ? disponivel
      : Math.floor(numeroQuantidade);

  const quantidadeOk =
    !empilha ||
    (Number.isFinite(quantidadeNumero) &&
      quantidadeNumero >= 1 &&
      quantidadeNumero <= disponivel);

  /**
   * O preco precisa ser valido para o botao ligar.
   *
   * A validacao e a MESMA funcao que o servidor usa (`precoValido`),
   * importada do mesmo modulo. Se o painel usasse um `<input
   * type="number" min="5">` e o servidor o proprio `normalizarPreco`,
   * um deles aceitaria 4 e o outro nao — e o jogador veria um botao
   * ativo que o servidor recusa
   */
  const numeroPreco = Number(preco);
  const precoOk = precoValido(numeroPreco);

  const anunciar = () => {
    if (!selecionada) return;
    if (!precoOk) return;
    if (!cabe) return;
    if (!quantidadeOk) return;

    onList?.({
      uid: selecionada.uid,
      price: Math.round(numeroPreco),
      count: quantidadeNumero,
    });

    setErro("");
    setSelecionado(null);
    setPreco("");
    setQuantidade("");
  };

  return (
    <>
      <p className="mkt-hint">
        {cabe
          ? `Anuncios abertos: ${data.meus.length}/${limites.maxAnuncios}. Validade: ${ANUNCIO_DIAS} dias.`
          : `Voce atingiu o limite de ${limites.maxAnuncios} anuncios. Cancele um para abrir outro.`}
      </p>

      {data.meus.length > 0 && (
        <>
          <p className="mkt-section">Seus anuncios</p>

          <ListaDeAnuncios
            anuncios={data.meus}
            onCancel={onCancel}
          />
        </>
      )}

      <p className="mkt-section">Anunciar da mochila</p>

      {/*
        A mochila do vendedor, com o MESMO slot da mochila principal.

        Antes era uma lista de botoes proprios do mercado, e a mesma
        peca aparecia com duas aparencias no mesmo jogo. Aqui e o
        `InvSlotView` — o componente que o inventario usa — dentro da
        mesma grade `inv-grid`, entao cor de raridade, icone, badge de
        tier, marca de peca unica e contador saem iguais
      */}
      {itens.length === 0 ? (
        <p className="inv-panel__empty">
          A mochila esta vazia.
        </p>
      ) : (
        <div className="inv-grid">
          {itens.map((item) => (
            <div key={item.uid} className="inv-cell">
              <InvSlotView
                entry={item}
                selected={selecionado === item.uid}
                onSelect={(escolhido) => {
                  setSelecionado(escolhido.uid);
                  setQuantidade("");
                  setErro("");
                }}
              />

              <span className="inv-cell__name">
                {getItem(item.itemId)?.name ?? item.itemId}
              </span>
            </div>
          ))}
        </div>
      )}

      {/*
        O FORMULARIO inteiro so existe depois de escolher o item.

        Antes ele aparecia vazio, com o preco ja showing a faixa no
        placeholder: o jogador via dois campos e um numero que nao era
        dele e tinha de adivinhar o que era. Sem item escolhido nao ha
        preco a escrever nem quantidade a lotar, entao a tela fica limpa
      */}
      {selecionada ? (
        <>
          <div className="mkt-form">
            {/*
              A QUANTIDADE vem ANTES do preco na leitura: e o preco que
              depende dela. O campo so existe para o que empilha, e
              vazio significa "a pilha inteira" — que e o que o jogador
              quase sempre quer anunciar
            */}
            {empilha && (
              <label className="mkt-field">
                <span>Quantidade</span>

                {/*
                  Campo LIVRE para digitar: sem placeholder, sem valor
                  travado. O `placeholder` com a faixa aparecia como se
                  fosse o preco, e o jogador acabava entendendo que
                  precisava respeitar um minimo escrito ali. A regra fica
                  na validacao e no aviso de erro, que sao explicitos
                */}
                <input
                  type="number"
                  className="mkt-input mkt-input--quantidade"
                  value={quantidade}
                  step={1}
                  inputMode="numeric"
                  onChange={(event) => {
                    setQuantidade(event.target.value);
                    setErro("");
                  }}
                />
              </label>
            )}

            <label className="mkt-field">
              <span>
                {empilha ? "Preco do lote" : "Preco"}
              </span>

              <input
                type="number"
                className="mkt-input mkt-input--preco"
                value={preco}
                step={1}
                inputMode="numeric"
                onChange={(event) => {
                  setPreco(event.target.value);
                  setErro("");
                }}
              />
            </label>

            <button
              type="button"
              className="mkt-submit"
              onClick={anunciar}
              disabled={!precoOk || !cabe || !quantidadeOk}
            >
              Anunciar
            </button>
          </div>

          {valorItem !== null && (
            <p className="mkt-hint">
              Valor do item:{" "}
              {valorItem} moeda{valorItem === 1 ? "" : "s"}
            </p>
          )}

          {/*
            O preco e do LOTE, e o jogador precisa ver isso antes de
            confirmar. Sem esta linha, quem escreve 300 para 10 gel
            imagina 300 por unidade e vende 10 vezes abaixo do que pensou
          */}
          {empilha && precoOk && quantidadeNumero > 1 && (
            <p className="mkt-hint">
              {quantidadeNumero} x{" "}
              {describeAnuncioItem({
                itemId: selecionada.itemId,
                rarity: selecionada.rarity,
                count: quantidadeNumero,
              })}{" "}
              = {totalDoAnuncio(numeroPreco, quantidadeNumero)}{" "}
              moedas ({precoUnitario(numeroPreco, quantidadeNumero)}{" "}
              por unidade)
            </p>
          )}

          {/* o que o jogador digitou e o que NAO pode */}
          {preco !== "" && !precoOk && (
            <p className="mkt-erro">
              O preco precisa estar entre {limites.precoMinimo} e{" "}
              {limites.precoMaximo}.
            </p>
          )}

          {empilha && !quantidadeOk && (
            <p className="mkt-erro">
              A quantidade precisa estar entre 1 e {disponivel}.
            </p>
          )}
        </>
      ) : (
        <p className="mkt-hint">
          Escolha um item da mochila acima.
        </p>
      )}

      <p className="mkt-hint">
        {MODO_VENDA_DICA[MODO_VENDA.FIXO]}
      </p>

      {erro && <p className="mkt-erro">{erro}</p>}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function HistoricoAba({ data }) {
  /**
   * O HISTORICO E MEU DE PRIMEIRO.
   *
   * O servidor manda as vendas todas com uma marca `minha` — as que eu
   * vendi e as que eu comprei. Abrir em "todas" punha o vendedor no
   * meio do movimento do mundo, e o que ele quer ver depois de vender
   * e a linha DELE: o que saiu, para quem e por quanto
   *
   * O "todas" continua la para quem quer ver o preco que os outros
   * players estao pagando — que e a outra coisa que se olha o mercado
   */
  const [escopo, setEsco] = useState("minhas");

  const vendas =
    escopo === "minhas"
      ? data.historico.filter((venda) => venda.minha)
      : data.historico;

  return (
    <>
      <div className="mkt-historico__escopo">
        <button
          type="button"
          className={[
            "mkt-chip",
            escopo === "minhas" ? "is-on" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setEsco("minhas")}
        >
          Minhas
        </button>

        <button
          type="button"
          className={[
            "mkt-chip",
            escopo === "todas" ? "is-on" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setEsco("todas")}
        >
          Todas
        </button>
      </div>

      {vendas.length === 0 ? (
        <p className="inv-panel__empty">
          {escopo === "minhas"
            ? "Nada foi vendido ainda."
            : "O mercado nao tem movimento ainda."}
        </p>
      ) : (
        <>
          <p className="mkt-hint">
            {escopo === "minhas"
              ? "Suas vendas e compras, mais recentes primeiro."
              : "As vendas do mercado, mais recentes primeiro."}
          </p>

          <ul className="mkt-list">
            {vendas.map((venda) => (
          <li
            key={venda.id}
            className={[
              "mkt-item",
              "is-sold",
              venda.minha ? "is-mine" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              venda.color ? { "--mkt": venda.color } : undefined
            }
          >
            <header className="mkt-item__head">
              <ItemIcon
                itemId={venda.itemId}
                rarity={venda.rarity}
                className="mkt-item__icon"
                alt=""
              />

              <span className="mkt-item__names">
                <strong>
                  {describeAnuncioItem(venda)}
                </strong>

                <small>
                  {venda.sellerName} vendeu para{" "}
                  {venda.buyerName || "alguem"}
                </small>
              </span>

              <span className="mkt-item__price">
                <strong>{venda.price}</strong>
                <small>
                  {venda.count > 1 &&
                    `${precoUnitario(
                      venda.price,
                      venda.count,
                    )}/un`}
                </small>
              </span>
            </header>
          </li>
        ))}
          </ul>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Filtros({ tipo, raridade, onTipo, onRaridade }) {
  return (
    <div className="mkt-filters">
      <label className="mkt-field">
        <span>Tipo</span>

        <select
          className="mkt-input"
          value={tipo}
          onChange={(event) => onTipo(event.target.value)}
        >
          <option value="">Todos</option>

          {TIPOS_VENDA.map((valor) => (
            <option key={valor} value={valor}>
              {labelTipo(valor)}
            </option>
          ))}
        </select>
      </label>

      <label className="mkt-field">
        <span>Raridade</span>

        <select
          className="mkt-input"
          value={raridade}
          onChange={(event) => onRaridade(event.target.value)}
        >
          <option value="">Todas</option>

          {RARIDADES_FILTRO.map((valor) => (
            <option key={valor} value={valor}>
              {RARITY_STYLE[valor]?.label ?? valor}
            </option>
          ))}
        </select>
      </label>


    </div>
  );
}

/**
 * A barra de quanto tempo o anuncio ainda tem.
 *
 * A largura e uma FRACAO do prazo, e nao do que resta: uma barra que
 * encolhe de 100% a 0% seria igual para um anuncio com um dia e outro
 * com uma hora. A fracao do prazo mostra "quanto da oportunidade de
 * venda ainda existe", que e o que o vendedor precisa saber
 */
export function BarraTempo({ restanteMs }) {
  const total = ANUNCIO_DIAS * 24 * 60 * 60 * 1000;

  const fracao = Math.max(0, Math.min(1, restanteMs / total));

  const horas = Math.floor(restanteMs / 3_600_000);
  const dias = Math.floor(horas / 24);

  const texto =
    dias >= 1
      ? `${dias}d`
      : horas >= 1
        ? `${horas}h`
        : `${Math.max(0, Math.floor(restanteMs / 60_000))}m`;

  return (
    <span className="mkt-time" data-tip="Tempo que resta ate expirar">
      <span
        className="mkt-time__bar"
        style={{ width: `${fracao * 100}%` }}
      />

      <span className="mkt-time__text">{texto}</span>
    </span>
  );
}

export { totalDoAnuncio };