import { useEffect, useState } from "react";

import ItemIcon from "../UI/ItemIcon.jsx";
import IconeMoeda from "../UI/IconeMoeda.jsx";

import {
  ANUNCIO_DIAS,
  MOEDA,
  MOEDA_LABEL,
  MODO_VENDA,
  MODO_VENDA_DICA,
  MODO_VENDA_LABEL,
  PRECO_MINIMO,
  tetoDaMoeda,
  precoValido,
} from "../../data/market/index.js";
import { RARITY_STYLE, getItem, isStackable } from "../../data/items/index.js";
import { formatarMoedas } from "../../data/guild/index.js";

/**
 * O PAINEL 2: A MOEDA, O MODO E O PREÇO.
 *
 * ## POR QUE A MOEDA É UM SELECT, E NÃO UM BOTÃO TRAVADO
 *
 * Porque antes o formulário tinha um botão de ouro desabilitado, e ele
 * mentia: o texto dizia "só ouro" mas o mercado não tinha moeda nenhuma. Agora
 * as três são oferecidas porque o `MarketStore` grava `currency` e o servidor
 * cobra a que for — um seletor que o servidor ignora seria o problema antigo
 * de novo
 *
 * ## POR QUE O LEILÃO PRECISA DO LANCE MÍNIMO
 *
 * Porque o `price` de um leilão é só o preço de ABERTURA. Sem um piso
 * separado, o primeiro a chegar levaria o item pelo valor de abertura e o
 * "leilão" seria um rótulo. O `minBid` é o que segura o item, e é o mesmo
 * `minBid` que o servidor valida no `list`
 *
 * ## POR QUE A VALIDAÇÃO USA `precoValido` E `tetoDaMoeda`
 *
 * Porque são as MESMAS funções que o servidor chama. A UI recusando por um
 * lado e o servidor por outro é a forma mais cara de dar "preço inválido" sem
 * dizer qual dos dois dislikes
 */
export default function ListingPriceForm({ entrada, aoEstado }) {
  const [precoTexto, setPrecoTexto] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [moeda, setMoeda] = useState(MOEDA.OURO);
  const [modo, setModo] = useState(MODO_VENDA.FIXO);
  const [lanceTexto, setLanceTexto] = useState("");

  const item = entrada ? getItem(entrada.itemId) : null;

  /**
   * O MAXIMO DE QUANTIDADE.
   *
   * E o menor entre o que a pilha tem e o que o mercado aceita. Um item nao
   * empilhavel tem 1 na mochila e `maxStack: 1` no catalogo, entao os dois
   * concordam; o piso e nao deixar o campo passar do que existe, que o
   * servidor rejeitaria depois de o jogador ter preenchido o formulario todo
   */
  const maximo = Math.max(
    1,
    Math.min(entrada?.count ?? 1, item?.maxStack ?? 1),
  );

  const empilhavel = isStackable(item);

  /**
   * TROCAR DE ITEM RESETA O FORMULARIO.
   *
   * Porque a quantidade fica presa a `maximo`, que e do item anterior: deixar
   * o 5 de uma pocao ao escolher uma espada que aceita 1 mostraria
   * "5 de 1" e confirmaria um anuncio que o servidor recusa
   */
  useEffect(() => {
    setQuantidade(1);
    setPrecoTexto("");
    setLanceTexto("");
  }, [entrada?.uid]);

  /**
   * O LEILÃO GUARDA O MINIMO, E ELE COMECA PREENCHIDO.
   *
   * Deixar o campo vazio exigiria o jogador inventar o numero antes de ver
   * qualquer exemplo, e um campo vazio parece erro. O preco de abertura ja e
   * uma metade do piso, entao o lance nasce em cima dele — mudar o preco
   * depois NAO arrasta o lance junto, porque um piso que muda sozinho depois
   * de pronto e um piso que ninguem aceitou
   */
  useEffect(() => {
    if (modo !== MODO_VENDA.LEILAO) return;

    const base = Number(precoTexto.replace(/\D/g, "")) || 0;

    setLanceTexto(base > 0 ? String(base) : "");
  }, [modo]);

  // e o piso de novo, agora que `maximo` mudou com o item
  useEffect(() => {
    if (quantidade > maximo) setQuantidade(maximo);
  }, [maximo, quantidade]);

  const preco = Number(precoTexto.replace(/\D/g, "")) || 0;
  const lance = Number(lanceTexto.replace(/\D/g, "")) || 0;
  const teto = tetoDaMoeda(moeda);
  const precoOk = precoValido(preco) && preco <= teto;
  const lanceOk = precoValido(lance) && lance <= teto;

  const total = preco * quantidade;

  const podeConfirmar =
    Boolean(entrada) &&
    precoOk &&
    quantidade >= 1 &&
    quantidade <= maximo &&
    (modo === MODO_VENDA.FIXO || lanceOk);

  //
  // O PAI decide se o botao abre, e ele precisa da MESMA conta.
  //
  // Sem este aviso o modal teria que refazer o preco valido e o teto de
  // quantidade, e as duas copias divergiriam na primeira regra que mudasse
  //
  useEffect(() => {
    aoEstado?.({
      preco,
      quantidade,
      currency: moeda,
      modo,
      minBid: modo === MODO_VENDA.LEILAO ? lance : null,
      valido: podeConfirmar,
    });
  }, [preco, lance, quantidade, moeda, modo, podeConfirmar, aoEstado]);

  return (
    <section className="lst-painel">
      <header className="lst-painel__head">
        <span className="lst-painel__passo">2</span>
        <h2 className="lst-painel__titulo">DEFINA O PREÇO</h2>
      </header>

      {/*
        A PRÉVIA. A borda tracejada e o que o briefing pede para este bloco, e
        ela fica sólida quando tem item: o tracejado é o estado de "ainda
        não escolheu"
      */}
      <div
        className={[
          "lst-previa",
          entrada ? "is-preenchida" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {entrada ? (
          <>
            <span
              className="lst-previa__slot"
              style={{
                "--rarity":
                  RARITY_STYLE[entrada.rarity]?.color ?? "var(--t-line-3)",
              }}
            >
              <ItemIcon
                item={item}
                itemId={entrada.itemId}
                rarity={entrada.rarity}
                alt=""
              />
            </span>

            <span className="lst-previa__texto">
              <span className="lst-previa__nome">
                {item?.name ?? "—"}

                {/*
                  O `+N` vem do `enhance` da PILHA, e nao do catalogo: o
                  mesmo id de item pode estar +0 na mochila e +10 depois de
                  aprimorar, e quem announce e a peca que o jogador tem
                */}
                {entrada.enhance > 0 && (
                  <span className="lst-previa__enhance">
                    {`+${entrada.enhance}`}
                  </span>
                )}
              </span>

              <span className="lst-previa__meta">
                {[
                  RARITY_STYLE[entrada.rarity]?.label,
                  item?.type,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="lst-previa__slot lst-previa__slot--vazio" />
            <span className="lst-previa__texto lst-previa__texto--vazio">
              Selecione um item na lista.
            </span>
          </>
        )}
      </div>

      {/*
        A MOEDA NA LINHA INTEIRA, e não na meia coluna.

        ## POR QUE

        Porque três botões com ícone e nome pediriam uns 257px, e a meia coluna
        do `lst-linha` tem 181px. Com `flex: 1` cada botão caía em ~56px e o
        "Diamante" — que pede 98px — invadia o campo de preço ao lado. O
        sintoma era exatamente "a seleção da moeda está bugando com o preço"

        ## E POR QUE NÃO DIMINUIR O TEXTO

        Porque em 56px caberia só o ícone, e três ícones sem nome deixam o
        jogador adivinhar qual é ouro e qual é diamante — com o ícone de
        diamante parecendo um losango qualquer. A linha inteira dá 363px, e
        os três ficam com 117px cada, folgado
      */}
      <div className="lst-linha">
        <div className="lst-coluna lst-coluna--inteira">
          <span className="lst-rotulo">MOEDA</span>

          {/*
            AS TRÊS MOEDAS, e o ícone vem do `IconeMoeda` — o mesmo
            componente da HUD e do inventário. Escrever o glifo aqui de novo
            seria a moeda do mercado com um tamanho diferente da moeda da
            mochila, que e o problema que o componente existe para evitar
          */}
          <div className="lst-moedas" role="group" aria-label="Moeda">
            {Object.values(MOEDA).map((id) => (
              <button
                key={id}
                type="button"
                className={`lst-moeda ${moeda === id ? "is-active" : ""}`}
                aria-pressed={moeda === id}
                disabled={!entrada}
                onClick={() => setMoeda(id)}
              >
                <span className="lst-moeda__icone" aria-hidden="true">
                  <IconeMoeda moeda={id} lado={16} />
                </span>
                {MOEDA_LABEL[id]}
              </button>
            ))}
          </div>

          {/*
            o diamante e da conta, e isso muda o que o jogador esta
            comprando. Sem a frase, um anuncio em diamante pareceria cobrar do
            personagem — e o numero do inventario cairia sem ele perceber
          */}
          <span className="lst-dica">
            {moeda === MOEDA.DIAMANTE
              ? "sai da conta, não da mochila"
              : "sai da mochila"}
          </span>
        </div>
      </div>

      <div className="lst-linha">
        <div className="lst-coluna">
          <label className="lst-rotulo" htmlFor="lst-preco">
            {modo === MODO_VENDA.LEILAO
              ? "PREÇO DE ABERTURA"
              : "PREÇO DO LOTE"}
          </label>

          <input
            id="lst-preco"
            type="text"
            inputMode="numeric"
            className="lst-campo"
            placeholder={formatarMoedas(PRECO_MINIMO)}
            value={precoTexto}
            disabled={!entrada}
            onChange={(event) =>
              setPrecoTexto(event.target.value.replace(/\D/g, ""))
            }
            onBlur={() => {
              // so na saida do campo o texto vira numero, porque formatar a
              // cada tecla brigaria com o cursor no meio do milhar
              if (preco === 0 && precoTexto) setPrecoTexto("");
            }}
          />

          {entrada && !precoOk && precoTexto && (
            <span className="lst-erro" role="alert">
              {preco < PRECO_MINIMO
                ? `Mínimo de ${formatarMoedas(PRECO_MINIMO)}`
                : `Máximo de ${formatarMoedas(teto)}`}
            </span>
          )}
        </div>

        {/*
          O LANCE MÍNIMO FICA AO LADO DO PREÇO, e nao ao lado do modo.

          Porque é a meia parceira natural: o preço e o lance são os dois
          números de dinheiro do anúncio, e o leitor compara os dois. Na linha
          do modo ele ficaria do lado de dois botões, que é o que estourou
        */}
        {modo === MODO_VENDA.LEILAO ? (
          <div className="lst-coluna">
            <label className="lst-rotulo" htmlFor="lst-lance">
              LANCE MÍNIMO
            </label>

            <input
              id="lst-lance"
              type="text"
              inputMode="numeric"
              className="lst-campo"
              placeholder={formatarMoedas(PRECO_MINIMO)}
              value={lanceTexto}
              disabled={!entrada}
              onChange={(event) =>
                setLanceTexto(event.target.value.replace(/\D/g, ""))
              }
            />

            {entrada && !lanceOk && lanceTexto ? (
              <span className="lst-erro" role="alert">
                {lance < PRECO_MINIMO
                  ? `Mínimo de ${formatarMoedas(PRECO_MINIMO)}`
                  : `Máximo de ${formatarMoedas(teto)}`}
              </span>
            ) : (
              /**
               * O PISO E O MENOR LANCE QUE O SERVIDOR ACEITA, e a frase esta
               * ligada ao piso: sem ela, quem escreve 100 num item com minimo
               * 100 receberia recusa no lance seguinte, por 1 moeda de
               * diferenca
               */
              <span className="lst-dica">
                o primeiro lance começa por aqui
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/*
        O MODO NA LINHA INTEIRA, pelo mesmo motivo da moeda: dois botao com
        nome ("Preço fixo" e "Leilão") pedem uns 200px e a meia coluna tem
        181px. Com o campo do lance mínimo fora daqui, sobra a linha inteira
        e nenhum dos dois invade o campo vizinho
      */}
      <div className="lst-linha">
        <div className="lst-coluna lst-coluna--inteira">
          <span className="lst-rotulo">COMO VENDER</span>

          {/*
            VENDA DIRETA E LEILÃO, lado a lado.

            O valor do `<input>` abaixo e o que diferencia os dois: na venda
            direta ele e o preco final, e no leilão e só por onde o
            misunderstand começa
          */}
          <div
            className="lst-modos"
            role="group"
            aria-label="Tipo de venda"
          >
            {Object.values(MODO_VENDA).map((id) => (
              <button
                key={id}
                type="button"
                className={`lst-modo ${modo === id ? "is-active" : ""}`}
                aria-pressed={modo === id}
                disabled={!entrada}
                onClick={() => setModo(id)}
              >
                {MODO_VENDA_LABEL[id]}
              </button>
            ))}
          </div>

          {/*
            A EXPLICACAO DO MODO, e nao um texto generico de painel.

            Porque a diferenca entre os dois e inteiramente de dinheiro: na
            venda direta o preco e o pagamento, e no leilão o lance fica
            retido ate o fim. Quem nao sabe disso acha que esta pagando o
            valor de abertura
          */}
          <span className="lst-dica">{MODO_VENDA_DICA[modo]}</span>
        </div>
      </div>

      <div className="lst-linha">
        <div className="lst-coluna">
          <span className="lst-rotulo">QUANTIDADE</span>

          <input
            type="number"
            className="lst-campo lst-campo--narrow"
            min={1}
            max={maximo}
            value={quantidade}
            disabled={!entrada || !empilhavel}
            onChange={(event) => {
              const n = Number.parseInt(event.target.value, 10);

              setQuantidade(Number.isFinite(n) ? n : 1);
            }}
            onBlur={() => {
              if (quantidade < 1) setQuantidade(1);
            }}
          />

          {/*
            O "de {N}" e a informacao que impede o erro: sem ele o jogador
            escreve 99 numa peca unica e so descobre do erro do servidor
          */}
          <span className="lst-dica">
            {empilhavel ? `de ${maximo}` : "item único"}
          </span>
        </div>

        <div className="lst-coluna">
          <span className="lst-rotulo">DURAÇÃO</span>

          {/*
            A DURACAO E FIXA, e e o `ANUNCIO_DIAS` que o servidor usa. Mostrar
            os chips de 1 DIA / 6 HORAS seria um controle que nao mudaria o
            prazo de expiracao em nada
          */}
          <div className="lst-duracao">
            <span className="lst-duracao__valor">
              {ANUNCIO_DIAS} DIAS
            </span>
          </div>

          <span className="lst-dica">
            o servidor define o vencimento
          </span>
        </div>
      </div>

      <div className="lst-resumo">
        <span className="lst-rotulo">RESUMO</span>

        {entrada && precoOk ? (
          <>
            <div className="lst-resumo__linha">
              <span>Item</span>
              <span>
                {`${item?.name ?? "—"} × ${quantidade}`}
              </span>
            </div>

            <div className="lst-resumo__linha">
              <span>Tipo</span>
              <span>{MODO_VENDA_LABEL[modo]}</span>
            </div>

            <div className="lst-resumo__linha">
              <span>Preço unitário</span>
              <span>
                {formatarMoedas(quantidade ? Math.round(preco / quantidade) : preco)}
              </span>
            </div>

            {/*
              EM LEILÃO O TOTAL DA LINHA DEBAIXO NÃO É O QUE VAI SOBIR.
              Mostrar "total: 100" num item com lance mínimo 300 seria uma
              promessa que o mercado não faz — por isso o rótulo muda com o
              modo, e não fica sempre "Total"
            */}
            {modo === MODO_VENDA.LEILAO ? (
              <div className="lst-resumo__linha lst-resumo__linha--total">
                <span>Lance mínimo</span>
                <span className="lst-resumo__total">
                  <span className="lst-moeda__icone" aria-hidden="true">
                    <IconeMoeda moeda={moeda} lado={16} />
                  </span>
                  {formatarMoedas(lance)}
                </span>
              </div>
            ) : (
              <div className="lst-resumo__linha lst-resumo__linha--total">
                <span>Total</span>
                <span className="lst-resumo__total">
                  <span className="lst-moeda__icone" aria-hidden="true">
                    <IconeMoeda moeda={moeda} lado={16} />
                  </span>
                  {formatarMoedas(total)}
                </span>
              </div>
            )}

            <div className="lst-resumo__linha">
              <span>Expira em</span>
              <span>{`${ANUNCIO_DIAS} dias`}</span>
            </div>
          </>
        ) : (
          <p className="lst-resumo__vazio">
            {entrada
              ? "Informe um preço válido para ver o total."
              : "Selecione um item na lista."}
          </p>
        )}
      </div>

      <p className="lst-aviso">
        Enquanto anunciado, o item sai da mochila e não pode ser usado nem
        equipado. Cancelado ou expirado, ele volta.
      </p>

    </section>
  );
}
