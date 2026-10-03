import { useMemo, useState } from "react";
import ItemIcon from "../UI/ItemIcon.jsx";
import InvSlotView from "../UI/InvSlotView.jsx";
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
 * Tres abas porque sao tres perguntas diferentes, e cada uma precisa
 * de uma tela diferente:
 *
 * - COMPRAR: a vitrine alheia, filtrada, do mais barato para o mais
 *   caro. E onde o jogador olha o que os outros tem
 * - VENDER: a propria mochila, com o preco. E onde ele monta o
 *   anuncio
 * - HISTORICO: o que ja foi vendido, de quem e para quem. A terceira aba
 *   e a unica que o jogador usa para saber o PRECO: ver o que os outros
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
  { id: "historico", icone: "≡", label: "Historico" },
];

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
    <section className="inv-panel mkt-panel">
      <nav className="inv-tabs mkt-tabs">
        {ABAS.map((entrada) => (
          <button
            key={entrada.id}
            type="button"
            role="tab"
            aria-selected={aba === entrada.id}
            className={[
              "inv-tab",
              aba === entrada.id ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setAba(entrada.id)}
            title={entrada.label}
          >
            <span className="mkt-tab__icon">
              {entrada.icone}
            </span>

            <small>{entrada.label}</small>

            {entrada.id === "vender" && (
              <i className="mkt-tab__count">
                {data.meus.length}/
                {data.limites.maxAnuncios}
              </i>
            )}
          </button>
        ))}

        <button
          type="button"
          className="inv-close"
          onClick={onClose}
          title="Fechar (M)"
        >
          ✕
        </button>
      </nav>

      <div className="mkt-panel__body">
        {aba === "comprar" && (
          <ComprarAba
            data={data}
            inventory={inventory}
            onBuy={onBuy}
          />
        )}

        {aba === "vender" && (
          <VenderAba
            data={data}
            inventory={inventory}
            onCancel={onCancel}
            onList={onList}
          />
        )}

        {aba === "historico" && <HistoricoAba data={data} />}
      </div>
    </section>
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
function ComprarAba({ data, inventory, onBuy }) {
  const [tipo, setTipo] = useState("");
  const [raridade, setRaridade] = useState("");

  const filtrados = useMemo(() => {
    return data.listings.filter((listing) => {
      if (tipo && tipoDoAnuncio(listing) !== tipo) return false;
      if (raridade && listing.rarity !== raridade) {
        return false;
      }

      return true;
    });
  }, [data.listings, tipo, raridade]);

  /**
   * O item cabe na mochila do comprador?
   *
   * A checagem e do LADO DO CLIENTE e e uma economia, nao uma
   * seguranca: o servidor confere de novo antes de entregar. Mostrar o
   * botao ativo num item que nao cabe seria o jogador descobrir o
   * problema so depois de clicar
   */
  const cabe = () => {
    if (inventory?.isFull) return false;

    return inventory ? inventory.freeSlots > 0 : true;
  };

  return (
    <>
      <Filtros
        tipo={tipo}
        raridade={raridade}
          onTipo={setTipo}
        onRaridade={setRaridade}
        />

      {filtrados.length === 0 ? (
        <p className="inv-panel__empty">
          {data.listings.length === 0
            ? "Nenhum anuncio no mercado."
            : "Nenhum anuncio com esse filtro."}
        </p>
      ) : (
        <ul className="mkt-list">
          {filtrados.map((listing) => (
            <li
              key={listing.id}
              className="mkt-item"
              style={
                listing.color
                  ? { "--mkt": listing.color }
                  : undefined
              }
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

                  <small>
                    {listing.sellerName}
                  </small>
                </span>

                <span className="mkt-item__price">
                  <strong>{listing.price}</strong>
                  <small>
                    {listing.count > 1 &&
                      `${precoUnitario(
                        listing.price,
                        listing.count,
                      )}/un`}
                  </small>
                </span>
              </header>

              <footer className="mkt-item__foot">
                <BarraTempo restanteMs={listing.restanteMs} />

                <button
                  type="button"
                  className="mkt-item__buy"
                  onClick={() => onBuy?.(listing.id)}
                  disabled={!cabe()}
                  title={cabe() ? "Comprar" : "A mochila esta cheia"}
                >
                  Comprar
                </button>
              </footer>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}


/* ------------------------------------------------------------------ */

/**
 * A propria mochila, virada em anuncios.
 *
 * O preco e um campo livre, e nao um `<select>` com opcoes. O jogador
 * precisa poder escrever 137, que e o preco que ele，愿意 pagar
 */
function VenderAba({ data, inventory, onCancel, onList }) {
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

          <ul className="mkt-list">
            {data.meus.map((listing) => (
              <li
                key={listing.id}
                className="mkt-item is-own"
                style={
                  listing.color
                    ? { "--mkt": listing.color }
                    : undefined
                }
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

function HistoricoAba({ data }) {
  if (data.historico.length === 0) {
    return (
      <p className="inv-panel__empty">
        Nada foi vendido ainda.
      </p>
    );
  }

  return (
    <>
      <p className="mkt-hint">
        As vendas mais recentes primeiro. O total e o preco por
        unidade.
      </p>

      <ul className="mkt-list">
        {data.historico.map((venda) => (
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
function BarraTempo({ restanteMs }) {
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
    <span className="mkt-time" title="Tempo que resta ate expirar">
      <span
        className="mkt-time__bar"
        style={{ width: `${fracao * 100}%` }}
      />

      <span className="mkt-time__text">{texto}</span>
    </span>
  );
}

export { totalDoAnuncio };