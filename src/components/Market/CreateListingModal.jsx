import { useEffect, useRef, useState } from "react";

import ListingItemPicker from "./ListingItemPicker.jsx";
import ListingPriceForm from "./ListingPriceForm.jsx";

import {
  MOEDA,
  MODO_VENDA,
} from "../../data/market/index.js";

/**
 * O MODAL DE ANUNCIAR.
 *
 * ## POR QUE A MOEDA E O MODO SÃO ESTADO DO MODAL
 *
 * Porque eles entram no MESMO pedido do `uid`, e um pedido com quatro campos
 * de announcement e um quinto esquecido é um anuncio que o servidor recusa sem
 * dizer por quê. Ficam aqui, no pai, junto do preço e da quantidade, e o
 * formulário só CALCULA e AVISA
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
 *
 * ## POR QUE O `uidInicial` EXISTE
 *
 * Porque o jogador pode chegar aqui por dois caminhos, e eles tem de terminar
 * igual: o `+ ANUNCIAR` do mercado, que abre sem nada escolhido, e o `Vender`
 * do menu da mochila, que ja sabe qual item e. Sem o `uidInicial` o segundo
 * caminho abriria o formulario vazio e obrigaria o jogador a caçar o item de
 * novo numa lista que pode ter trinta entrada
 */
export default function CreateListingModal({
  inventory,
  uidInicial = null,
  onConfirmar,
  onClose,
}) {
  /**
   * O ITEM QUE CHEGA PRONTO, E POR QUE ELE E A ENTRADA INTEIRA
   *
   * E o `uid` que vem do menu da mochila, mas o estado guarda a ENTRADA, e
   * nao o id: o `ListingPriceForm` ja recebe `entrada` e le dela o teto de
   * preco e a quantidade maxima. Guardar so o uid obrigaria o formulario a
   * procurar a entrada de novo, e os dois arquivos poderiam acabar olhando
   * listas diferentes
   *
   * ## POR QUE ISSO E UM INICIALIZADOR E NAO UM EFEITO
   *
   * Porque o `HUD` so renderiza esta modal quando `anunciando` e verdadeiro,
   * entao ela nasce e morre a cada abertura: o inicializador roda uma vez, no
   * instante certo. Um `useEffect` que ajustasse `selecionada` rodaria DEPOIS
   * do primeiro desenho, e o jogador veria um quadro com o formulario vazio
   * antes da selecao aparecer
   *
   * ## E POR QUE O ACHO E DEFENSIVO
   *
   * Porque o `uid` pode ter virado obsoleto entre o clique e a abertura: o
   * item pode ter sido vendido, excluido ou empilhado com outro no caminho. Um
   * `uid` que nao acha nada devolve `null`, que e exatamente o estado padrao
   * do modal — o jogador abre o anuncio sem selecao, como se tivesse clicado
   * no `+ ANUNCIAR` do mercado. Um `throw` aqui tiraria o mercado da tela
   * inteira por causa de uma pilha que mudou
   */
  const [selecionada, setSelecionada] = useState(() => {
    if (!uidInicial) return null;

    const itens = inventory?.items ?? [];

    return itens.find((entrada) => entrada.uid === uidInicial) ?? null;
  });
  const [preco, setPreco] = useState(0);
  const [quantidade, setQuantidade] = useState(1);

  /**
   * A MOEDA E O MODO NASECEM NO PADRÃO, e o lance mínimo nasce vazio.
   *
   * Ouro e venda direta porque são o que o jogador já espera de um anúncio:
   * os dois valores que não precisam ser decididos. O `minBid` é o único que
   * fica vazio, porque não tem padrão que faça sentido — e o formulário em
   * leilão o impede de confirmar até o jogador escrever
   */
  const [currency, setCurrency] = useState(MOEDA.OURO);
  const [modo, setModo] = useState(MODO_VENDA.FIXO);
  const [minBid, setMinBid] = useState(null);

  /**
   * O QUE O FORMULÁRIO DISSE QUE DÁ PARA CONFIRMAR.
   *
   * E o botão que usa, e nao uma conta feita aqui. Refazer a validação neste
   * arquivo duplicaria a regra do `lanceMinimo` e do teto por moeda — e a
   * cópia divergiria no dia em que uma delas mudasse. O formulário calcula,
   * avisa, e este modal só guarda
   */
  const [valido, setValido] = useState(false);

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

  const podeConfirmar = valido;

  /**
   * O QUE VAI NO PEDIDO.
   *
   * Os cinco campos sao as tres metades do anuncio mais o item: `uid`, a
   * quantidade, o preco, a moeda, o modo e o lance. O `minBid` vai `null` em
   * venda direta — e o `market.list` e quem ignora o campo no modo fixo, e
   * nao este modal, para que os dois lados leiam a mesma regra
   */
  function confirmar() {
    if (!podeConfirmar) return;

    onConfirmar?.({
      uid: selecionada.uid,
      price: preco,
      count: quantidade,
      currency,
      modo,
      minBid,
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
            aoEstado={(estado) => {
              setPreco(estado.preco);
              setQuantidade(estado.quantidade);
              setCurrency(estado.currency);
              setModo(estado.modo);
              setMinBid(estado.minBid);
              setValido(estado.valido);
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