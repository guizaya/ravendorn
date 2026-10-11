import { useEffect, useRef, useState } from "react";

import ListingItemPicker from "./ListingItemPicker.jsx";
import ListingPriceForm from "./ListingPriceForm.jsx";

import { precoValido } from "../../data/market/index.js";

/**
 * O MODAL DE ANUNCIAR.
 *
 * ## POR QUE ELE NAO TEM ESCOLHA DE MOEDA
 *
 * Porque `MARKET_LIST` leva `uid`, `price` e `count`, e o `MarketStore` paga
 * `price` em `coins`. Um seletor aqui seria um controle que o servidor ignora
 *
 * ## POR QUE O PREÇO E A QUANTIDADE SÃO ESTADO DO MODAL
 *
 * Porque quem decide se o botão abre é o botão, e ele precisa da MESMA conta
 * que o formulário fez. Se o formulario guardasse o próprio preço, o modal
 * teria que duplicar a validação para saber se podia confirmar — e as duas
 * cópias divergiriam no dia em que uma regra mudasse. Aqui o formulário
 * CALCULA e AVISA, e o modal só guarda
 *
 * ## POR QUE O ESC FECHA ESTE PRIMEIRO
 *
 * Porque ele fica empilhado sobre o `MarketModal`. O `capture: true` e o que
 * segura: o `MarketModal` tambem escuta o `keydown` na `window`, e sem o
 * captura ele receberia o mesmo ESC e fecharia os dois de uma vez
 */
export default function CreateListingModal({
  inventory,
  onConfirmar,
  onClose,
}) {
  const [selecionada, setSelecionada] = useState(null);
  const [preco, setPreco] = useState(0);
  const [quantidade, setQuantidade] = useState(1);

  const fecharRef = useRef(null);

  /**
   * O ITEM VOLTOU AO PADRAO E O FORMULARIO ZERA JUNTO.
   *
   * Porque a quantidade maxima é do item, e um preço de 500 que era válido
   * para uma poção de 99 pode estar acima do teto para uma peça única. Deixar
   * os dois para trás faria o modal abrir com um formulário que o servidor
   * rejeitaria
   */
  function escolher(entrada) {
    setSelecionada(entrada);
    setPreco(0);
    setQuantidade(1);
  }

  useEffect(() => {
    function aoTeclar(event) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      event.stopPropagation();
      onClose?.();
    }

    window.addEventListener("keydown", aoTeclar, true);

    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [onClose]);

  useEffect(() => {
    fecharRef.current?.focus();
  }, []);

  const podeConfirmar = Boolean(selecionada) && precoValido(preco);

  function confirmar() {
    if (!podeConfirmar) return;

    onConfirmar?.({
      uid: selecionada.uid,
      price: preco,
      count: quantidade,
    });
  }

  return (
    <div
      className="lst-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lst-titulo"
    >
      <div className="lst-modal__veu" onClick={onClose} />

      <div className="lst-modal__painel">
        <header className="lst-modal__head">
          <h2 id="lst-titulo" className="lst-modal__titulo">
            ANUNCIAR NO MERCADO
          </h2>

          <button
            type="button"
            ref={fecharRef}
            className="inv-close"
            onClick={onClose}
            data-tip="Fechar (Esc)"
          >
            ✕
          </button>
        </header>

        <div className="lst-modal__corpo">
          <ListingItemPicker
            itens={inventory?.items ?? []}
            selecionadoUid={selecionada?.uid ?? null}
            aoSelecionar={escolher}
          />

          <ListingPriceForm
            entrada={selecionada}
            aoEstado={({ preco: novoPreco, quantidade: novaQtd }) => {
              setPreco(novoPreco);
              setQuantidade(novaQtd);
            }}
          />
        </div>

        <footer className="lst-modal__rodape">
          <button
            type="button"
            className="lst-btn"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="mkt-submit lst-btn lst-btn--primario"
            disabled={!podeConfirmar}
            onClick={confirmar}
            aria-disabled={!podeConfirmar}
            data-tip={
              podeConfirmar
                ? "Publicar o anúncio"
                : "Escolha um item e informe um preço válido"
            }
          >
            Confirmar anúncio
          </button>
        </footer>
      </div>
    </div>
  );
}