import { useEffect, useRef } from "react";

import IconeMoeda from "../UI/IconeMoeda.jsx";

import {
  MOCHILA_SLOTS_MAX,
  MOCHILA_SLOTS_POR_COMPRA,
  COMPRAS_TOTAIS,
  proximaCompra,
} from "../../data/inventory/capacidade.js";
import { formatarMoedas } from "../../data/guild/index.js";

/**
 * A MOEDA DA COMPRA, e ela e DIAMANTE.
 *
 * O literal e nao o `MOEDA.DIAMANTE` do dado do mercado porque o inventario
 * nao deve depender do mercado por causa de um id de string: o
 * `IconeMoeda` ja normaliza, e um `undefined` aqui renderizaria nada em vez
 * de erro — que e o jeito mais barato de o icone sumir sem aviso
 */
const DIAMANTE = "diamonds";

/**
 * A MODAL DE EXPANSÃO DA MOCHILA.
 *
 * ## POR QUE ELA APARECE SOBRE O INVENTÁRIO E NÃO DENTRO DELE
 *
 * Porque o inventario é uma grade que o jogador usa com as duas mãos: pegar
 * item, largar, comparar. Uma caixa de compra de slots no meio da grade
 * taparia a peça que ele está movendo, e o `+` ficaria a dois cliques de
 * qualquer arrasto
 *
 * ## POR QUE O PREÇO VEM DO MESMO ARQUIVO QUE O SERVIDOR LÊ
 *
 * Porque `proximaCompra` é chamado aqui e em `GameServer.expandirMochila`. Se
 * esta tela calculasse o preco sozinha, ela anunciaria um numero que o
 * servidor cobraria outro — e o jogador veria "60 diamantes" num botao que
 * debita 80
 *
 * ## E POR QUE A MODAL NÃO SABE O PREÇO ANTES DE ABRIR
 *
 * Porque ele sai de `inventory.capacity`, que é o estado do servidor. A tela
 * só descobre o preço quando o painel recebe o snapshot, e adivinhar aqui
 * mostraria um valor para quem não pode pagar
 *
 * @param {object} props
 * @param {object} props.inventory o resumo do inventario, do snapshot
 * @param {() => void} props.onConfirmar o pedido de compra
 * @param {() => void} props.onClose
 */
export default function MochilaExpansaoModal({
  inventory,
  onConfirmar,
  onClose,
}) {
  const capacity = inventory?.capacity ?? 20;
  const diamantes = inventory?.diamonds ?? 0;
  const usada = inventory?.used ?? 0;

  /**
   * O QUE VAI ACONTECER, e nao o que aconteceu antes.
   *
   * E o mesmo `proximaCompra` do servidor: `pode: false` no teto desliga o
   * botao, e o preco e o da próxima, não o da última
   */
  const compra = proximaCompra(capacity);

  const jaCompradas = Math.round(
    (Math.min(capacity, MOCHILA_SLOTS_MAX) - 20) / MOCHILA_SLOTS_POR_COMPRA,
  );

  /**
   * O BOTAO SÓ ABRE COM DIAMANTE.
   *
   * E `compra.preco` e nao o saldo: sem diamante o servidor recusa com a
   * mesma mensagem, e o botão desligado evita o pedido inútil. Com diamante
   * mas com o pedido duplicado, o servidor cobra a segunda vez — e o jogador
   * veria dois avisos de compra em sequência
   */
  const podeComprar = compra.pode && diamantes >= compra.preco;

  const fecharRef = useRef(null);

  /**
   * O ESC FECHA ESTA MODAL, E SO ESTA.
   *
   * E `capture: true` porque o `HUD` tambem escuta `Escape` na `window`, e
   * o que ele faz nao e so fechar um painel: `alternarPause` fecha a mochila
   * E abre a pausa. Sem a captura, um aperto trocaria o inventario por um menu
   * de pause, e o jogador perderia de vista a tela que abriu a modal
   */
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

  /**
   * O FOCO ENTRA NO BOTÃO DE FECHAR, e não num campo.
   *
   * O mesmo motivo do `MarketModal`: o diálogo é anunciado pelo rótulo, e um
   * foco inicial no container faria o leitor repetir o título
   */
  useEffect(() => {
    fecharRef.current?.focus();
  }, []);

  return (
    <div
      className="lst-modal mch-exp-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mch-exp-titulo"
    >
      {/* o clique fora fecha, e só o veu: clicar dentro não fecha */}
      <div className="lst-modal__veu" onClick={onClose} />

      <div className="lst-modal__painel">
        <header className="lst-modal__head">
          <h2 id="mch-exp-titulo" className="lst-modal__titulo">
            EXPANDIR MOCHILA
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

        <div className="mch-exp__corpo">
          {/*
            O NÚMERO DE HOJE E DEPOIS.

            A ordem é nesta porque é a leitura que o jogador faz: "tenho 30,
            vou ficar com 40". O preço vem logo abaixo, e o botão repete o
            preço em número grande para a decisão final não precisar voltar
            até aqui
          */}
          <div className="mch-exp__cabeca">
            <div className="mch-exp__slot">
              <span className="mch-exp__slot__agora">{capacity}</span>
              <IconeMoeda moeda={DIAMANTE} lado={0} />
              <span className="mch-exp__slot__seta">→</span>
              <span
                className={`mch-exp__slot__depois ${
                  compra.pode ? "" : "is-bloqueado"
                }`}
              >
                {compra.pode ? compra.capacity : MOCHILA_SLOTS_MAX}
              </span>
            </div>

            <span className="mch-exp__uso">
              {usada} slots em uso
            </span>
          </div>

          {compra.pode ? (
            <>
              <p className="mch-exp__texto">
                {compra.slots} slots a mais por
                <span className="mch-exp__preco">
                  <IconeMoeda moeda={DIAMANTE} lado={16} />
                  {formatarMoedas(compra.preco)}
                </span>
              </p>

              {diamantes < compra.preco && (
                /*
                  FALTA DIAMANTE, E A FALTA CONTA.

                  Mostrar só "insuficiente" deixa o jogador sem saber quanto
                  falta para tentar de novo em outro lugar. O número é o que
                  transforma a recusa em meta
                */
                <p className="mch-exp__aviso" role="status">
                  {`Faltam ${formatarMoedas(compra.preco - diamantes)} diamantes.`}
                </p>
              )}
            </>
          ) : (
            /*
              NO TETO, E A MODAL DIZ QUE ACABOU.

              Um botão desligado sem texto é a forma mais rápida de o jogador
              achar que a mochila quebrou. Aqui ele lê que chegou ao limite e
              que não há mais nada a comprar
            */
            <p className="mch-exp__aviso" role="status">
              {`Sua mochila já está no limite de ${MOCHILA_SLOTS_MAX} slots.`}
            </p>
          )}

          {/*
            A BARRA DE PROGRESSO das compras.

            E a mesma conta que o `jaCompradas` e ela serve para mostrar que
            o preço sobe: o jogador vê que está no meio da escada e não no
            começo dela
          */}
          <div className="mch-exp__barra">
            <div className="mch-exp__barra__trilho">
              <div
                className="mch-exp__barra__preenchida"
                style={{
                  width: `${Math.round(
                    (jaCompradas / COMPRAS_TOTAIS) * 100,
                  )}%`,
                }}
              />
            </div>

            <span className="mch-exp__barra__legenda">
              {`${jaCompradas} de ${COMPRAS_TOTAIS} expansões`}
            </span>
          </div>
        </div>

        <footer className="lst-modal__rodape">
          <button
            type="button"
            className="mkt-submit lst-btn lst-btn--primario"
            disabled={!podeComprar}
            aria-disabled={!podeComprar}
            onClick={() => {
              if (!podeComprar) return;

              onConfirmar?.();
            }}
            data-tip={
              compra.pode
                ? podeComprar
                  ? "Comprar os slots"
                  : "Diamantes insuficientes"
                : "A mochila está no limite"
            }
          >
            {/*
              O BOTAO DIZ "comprar 10 SLOTS", E O 10 VEM COM O DIAMANTE AO LADO.

              ## POR QUE O DIAMANTE FICA NO "10", E NAO NO PRECO

              Porque e o que foi pedido, e funciona: o diamante aqui marca o
              TIPO de compra, e o preço em diamantes esta logo acima, no
              `mch-exp__preco`. O botao repete a quantidade porque e a decisao,
              e a moeda ao lado dela porque e o que o jogador vai gastar

              ## E POR QUE O `IconeMoeda` NAO QUEBRA O NOME DO BOTAO

              Ele sai com `alt=""` e `aria-hidden`, entao o leitor de tela le
              so o texto: "comprar 10 slots". O icone e ornamento
            */}
            {compra.pode ? (
              <>
                COMPRAR
                <span className="mch-exp__btn-qtd">
                  <span className="mch-exp__btn-num">{compra.slots}</span>
                  <IconeMoeda moeda={DIAMANTE} lado={13} />
                </span>
                SLOTS
              </>
            ) : (
              "NO LIMITE"
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}