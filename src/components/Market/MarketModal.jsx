import { useEffect, useRef, useState } from "react";

import BalanceBar from "./BalanceBar.jsx";
import CreateListingModal from "./CreateListingModal.jsx";
import VitrineAba from "./VitrineAba.jsx";
import {
  HistoricoAba,
  MeusAnunciosAba,
} from "./MarketPanel.jsx";

import { hudIconUrl } from "../../data/hudIcons.js";

/**
 * AS ABAS QUE TEM DADO.
 *
 * ## POR QUE TRES E NAO CINCO
 *
 * O desenho pede cinco: Vitrine, Câmbio, Minhas Vendas, Minhas Propostas e
 * Histórico. Câmbio e Propostas não têm NADA no projeto — não existe regra de
 * troca entre moedas, e não existe `offer`/`proposta` em lugar nenhum, nem no
 * `MarketStore`, nem no protocolo, nem no servidor.
 *
 * E "Vender" saiu depois: anunciar continua funcionando pelo botão `+ ANUNCIAR`
 * da barra de saldo, que abre o formulário direto. Uma aba inteira só para
 * repetir esse botão fazia o jogador passar por duas telas para anunciar a
 * mesma peça.
 *
 * "Meus anúncios" é a exceção: ela não anuncia, ela **mostra o que já está
 * anunciado**. O botão `+ ANUNCIAR` não dá essa informação — ele abre o
 * formulário. Quem precisa saber se o bau de ontem vendeu, ou quanto falta
 * para o prazo estourar, não tem onde ver
 *
 * Uma aba que abre vazia com "em breve" seria uma promessa que o projeto não
 * tem nenhum plano de cumprir. Estas três são as que o `MarketStore` realmente
 * responde
 */
const ABAS = [
  {
    id: "comprar",
    rotulo: "COMPRAR",
    contaDe: (data) => data.limites?.maxAnuncios ?? 0,
  },

  /**
   * A CONTA DESTA ABA E O NUMERO DE ANUNCIOS ABERTOS.
   *
   * E o que faz a aba valer a visita: o jogador vê "2" no botão e sabe que
   * tem dois anúncios para conferir, sem abrir. Na aba COMPRAR a conta é o
   * limite máximo, que é um número de regra — este é um número do jogador
   */
  {
    id: "meus",
    rotulo: "MEUS ANÚNCIOS",
    contaDe: (data) => (data.meus ?? []).length,
  },

  { id: "historico", rotulo: "HISTÓRICO", contaDe: null },
];

/**
 * O MERCADO ENTRE JOGADORES.
 *
 * ## POR QUE E UM MODAL E NAO UM PAINEL
 *
 * Porque o mercado é uma tela para a qual se vai, não um painel que se
 * espia por cima. O antigo `MarketPanel` ocupava o mesmo lugar dos outros
 * painéis e dividia o `z-index` com eles; o overlay tem `z-index` próprio e
 * foca o teclado, então ESC fecha o mercado sem passar por cada painel
 *
 * ## POR QUE O `MarketPanel` ANTIGO AINDA EXISTE
 *
 * Porque as três abas que funcionam estão DENTRO dele, e reescrever o filtro
 * de raridade, a grade e o formulário de venda seria trocar código testado
 * por código equivalente. As `*Aba` foram exportadas e este modal virou o
 * casco; quando a Vitrine nova entrar, o `MarketPanel` sai junto
 */
export default function MarketModal({
  market,
  inventory,
  onBuy,
  onCancel,
  onList,
  onClose,
}) {
  const [aba, setAba] = useState("comprar");

  /**
   * O FORMULARIO DE ANUNCIAR, empilhado sobre este modal.
   *
   * E estado AQUI e nao dentro do CreateListingModal porque o botao 
   * + ANUNCIAR vive na barra de saldo, que e deste modal. E o modal
   * precisa saber se ele continua aberto depois de confirmar
   */
  const [anunciando, setAnunciando] = useState(false);

  /**
   * O SNAPSHOT VAZIO, e nao `null`.
   *
   * Porque as três abas leem `data.limites`, `data.meus` e `data.vendas` sem
   * guarda nenhuma. Passar `null` faria a aba atual cair no primeiro acesso a
   * campo e derrubar o modal inteiro no primeiro quadro em que o servidor
   * ainda nao respondeu
   */
  const data = market ?? {
    listings: [],
    meus: [],
    vendas: [],
    limites: { maxAnuncios: 0, precoMin: 0, precoMax: 0 },
  };

  /**
   * O ESC FECHA O MERCADO.
   *
   * E `preventDefault` porque o mercado é um overlay: sem ele, o ESC tambem
   * chega no `pause`, que fica logo abaixo na pilha, e o jogador apertaria
   * uma vez esperando fechar o mercado e fecharia o jogo
   */
  useEffect(() => {
    function aoTeclar(event) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      onClose?.();
    }

    window.addEventListener("keydown", aoTeclar);

    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  /**
   * O FOCO ENTRA NO MERCADO AO ABRIR.
   *
   * E o botão de fechar que recebe, e não a caixa inteira: o leitor de tela
   * anuncia o diálogo pelo `aria-labelledby`, e o primeiro foco no container
   * faria o anuncio vir repetido — uma vez pelo rótulo e outra vez pelo
   * conteúdo do container
   */
  const fecharRef = useRef(null);

  useEffect(() => {
    fecharRef.current?.focus();
  }, []);

  const abaAtiva = ABAS.find((item) => item.id === aba) ?? ABAS[0];

  return (
    <div
      className="mkt-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mkt-titulo"
    >
      {/*
        O VEÚ é o elemento que recebe o clique de fora. E separado da caixa
        porque o clique em qualquer canto da caixa tem de NAO fechar: o
        jogador clica dentro do card de um anuncio e o mercado fecharia por
        baixo do dedo
      */}
      <div className="mkt-modal__veu" onClick={onClose} />

      <div className="mkt-modal__painel">
        <header className="mkt-modal__head">
          <h2 id="mkt-titulo" className="mkt-modal__titulo">
            <img
              className="mkt-modal__icone"
              src={hudIconUrl("market")}
              alt=""
              width={18}
              height={18}
            />
            MERCADO
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

        <BalanceBar
          inventory={inventory}
          maxAnuncios={data.limites?.maxAnuncios ?? null}
          anunciosAtivos={data.meus?.length ?? 0}
          onAnunciar={() => setAnunciando(true)}
        />

        <nav className="mkt-modal__abas" role="tablist" aria-label="Mercado">
          {ABAS.map((item) => {
            const ativa = item.id === abaAtiva.id;
            const conta = item.contaDe?.(data) ?? null;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`mkt-tab-${item.id}`}
                aria-selected={ativa}
                aria-controls="mkt-aba"
                tabIndex={ativa ? 0 : -1}
                className={[
                  "mkt-modal__aba",
                  ativa ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setAba(item.id)}
              >
                {item.rotulo}

                {conta !== null && (
                  <span className="mkt-modal__aba-conta">{conta}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div
          className="mkt-modal__corpo"
          id="mkt-aba"
          role="tabpanel"
          aria-labelledby={`mkt-tab-${abaAtiva.id}`}
        >
          {abaAtiva.id === "comprar" && (
            <VitrineAba
              data={data}
              inventory={inventory}
              onBuy={onBuy}
            />
          )}

          {abaAtiva.id === "historico" && <HistoricoAba data={data} />}

          {/*
            MEUS ANUNCIOS, e ela usa o MESMO componente da aba antiga.

            A lista ja existia embaixo do formulario da aba "Vender", e ela
            tinha o card inteiro: item, preco, tempo que resta e cancelar.
            Reescrever isso aqui daria duas listas que divergem no primeiro
            ajuste — o tempo que resta aparecendo num lado e nao no outro
          */}
          {abaAtiva.id === "meus" && (
            <MeusAnunciosAba data={data} onCancel={onCancel} />
          )}
        </div>

        {/*
          O FORMULARIO DE ANUNCIAR, empilhado SOBRE este modal.

          E um irmão do painel, não filho dele: o `MarketModal` continua
          montado e visível atrás, que é o que o desenho pede, e o `z-index`
          do `lst-modal` é maior que o do `mkt-modal` para que ele receba o
          clique primeiro
        */}
        {anunciando && (
          <CreateListingModal
            inventory={inventory}
            onConfirmar={(pedido) => {
              onList?.(pedido);
              setAnunciando(false);
            }}
            onClose={() => setAnunciando(false)}
          />
        )}
      </div>
    </div>
  );
}