import { useEffect, useState } from "react";

import ItemIcon from "../UI/ItemIcon.jsx";

import {
  ANUNCIO_DIAS,
  PRECO_MAXIMO,
  PRECO_MINIMO,
  precoValido,
} from "../../data/market/index.js";
import { RARITY_STYLE, getItem, isStackable } from "../../data/items/index.js";
import { formatarMoedas } from "../../data/guild/index.js";

/**
 * O PAINEL 2: DEFINA O PREÇO.
 *
 * ## POR QUE NÃO HÁ SELECTOR DE MOEDA
 *
 * Porque o protocolo de `MARKET_LIST` leva `uid`, `price` e `count`, e nada
 * mais: o `MarketStore` grava `price` e o servidor paga `price` em `coins`.
 * Um seletor de Ouro/Diamante aqui seria um controle que o servidor ignora —
 * o jogador anunciaria em diamante e receberia ouro
 *
 * ## POR QUE NÃO HÁ CHIPS DE DURAÇÃO
 *
 * Porque a duração é fixa em `ANUNCIO_DIAS = 7` e o servidor calcula
 * `expiresAt` sozinho. Escolher 2 dias exigiria o campo no protocolo, no
 * `MarketStore` e no `MarketSave`
 *
 * ## POR QUE A VALIDAÇÃO USA `precoValido`
 *
 * Porque é a MESMA função que o servidor chama. A UI rejecting por um lado e
 * o servidor por outro é a forma mais cara de dar "preço inválido" sem dizer
 * qual dos dois dislikes
 */
export default function ListingPriceForm({ entrada, aoEstado }) {
  const [precoTexto, setPrecoTexto] = useState("");
  const [quantidade, setQuantidade] = useState(1);

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
   * o 5 de uma poçao ao escolher uma espada que aceita 1 mostraria
   * "5 de 1" e confirmaria um anuncio que o servidor recusa
   */
  useEffect(() => {
    setQuantidade(1);
    setPrecoTexto("");
  }, [entrada?.uid]);

  // e o piso de novo, agora que `maximo` mudou com o item
  useEffect(() => {
    if (quantidade > maximo) setQuantidade(maximo);
  }, [maximo, quantidade]);

  const preco = Number(precoTexto.replace(/\D/g, "")) || 0;
  const precoOk = precoValido(preco);
  const total = preco * quantidade;

  const podeConfirmar =
    Boolean(entrada) && precoOk && quantidade >= 1 && quantidade <= maximo;

  //
  // O PAI decide se o botao abre, e ele precisa da MESMA conta.
  //
  // Sem este aviso o modal teria que refazer o preco valido e o teto de
  // quantidade, e as duas copias divergiriam na primeira regra que mudasse
  //
  useEffect(() => {
    aoEstado?.({ preco, quantidade, valido: podeConfirmar });
  }, [preco, quantidade, podeConfirmar, aoEstado]);

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

      <div className="lst-linha">
        <div className="lst-coluna">
          <span className="lst-rotulo">MOEDA</span>

          {/*
            SO OURO, E DESABILITADO DE PROPOSITO.

            Nao e um select que ficou pela metade: e a unica moeda que o
            `MarketStore` sabe pagar. Desabilitado e com a dica no `title`,
            porque um controle travado sem explicacao parece defeito
          */}
          <button
            type="button"
            className="lst-moeda is-active"
            disabled
            data-tip="O mercado paga em ouro"
          >
            <span className="lst-moeda__icone" aria-hidden="true">
              ◉
            </span>
            Ouro
          </button>
        </div>

        <div className="lst-coluna">
          <label className="lst-rotulo" htmlFor="lst-preco">
            PREÇO DO LOTE
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
                : `Máximo de ${formatarMoedas(PRECO_MAXIMO)}`}
            </span>
          )}
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
              <span>Preço unitário</span>
              <span>
                {formatarMoedas(quantidade ? Math.round(preco / quantidade) : preco)}
              </span>
            </div>

            <div className="lst-resumo__linha lst-resumo__linha--total">
              <span>Total</span>
              <span className="lst-resumo__total">
                <span className="lst-moeda__icone" aria-hidden="true">
                  ◉
                </span>
                {formatarMoedas(total)}
              </span>
            </div>

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

