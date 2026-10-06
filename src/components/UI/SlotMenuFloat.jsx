import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A CAIXA DE OPCOES FORA DA LISTA.
 *
 * ## POR QUE ISTO EXISTE E O `SlotMenu` NAO RESOLVE
 *
 * A `.inv-menu` e `position: absolute` dentro do slot. O slot esta dentro
 * do `.inv-content`, que tem `overflow-y: auto` porque a grade rola. E um
 * `absolute` dentro de um container que rola e CORTADO nas duas bordas
 * dele — e o corte acontece justamente no lugar em que a caixa precisa
 * aparecer
 *
 * Abrir para baixo, o item do topo da lista e cortado. Abrir para cima, a
 * caixa passa da borda de cima e some ATRAS da barra de abas, que e irmao
 * anterior e pinta por cima. Nao ha lado que sirva: o que resolve e nao
 * estar mais dentro do container
 *
 * Por isso a caixa vai para o `body` com `position: fixed`, que e
 * viewport e nao sabe de container nenhum. E o mesmo caminho do
 * `ItemTooltip`, que ja pendura a dica no `body` pelo mesmo motivo
 *
 * ## POR QUE NAO REAPROVEITAR O `SlotMenu` DE PROP0
 *
 * Porque o `SlotMenu` do boneco funciona onde esta: a grade do corpo e
 * pequena e nao rola, entao a caixa cabe dentro dela. Este e para a
 * mochila, que rola. Sao dois problemas de container diferentes e uma
 * solucao so para o que precisa dela
 *
 * ## A ALTURA ESTIMADA
 *
 * A direcao e escolhida ANTES de a caixa existir, entao a altura vem de um
 * palpite: 24px por acao. E o mesmo metodo do `ItemSlot`, e o erro so
 * importa na borda — e ali o palpite generoso manda abrir para cima, que
 * e o lado seguro
 */
const ALTURA_POR_ACAO = 24;

const BORDA = 8;

export default function SlotMenuFloat({ entry, actions }) {
  const caixa = useRef(null);

  const [posicao, setPosicao] = useState(null);

  /**
   * A MEDIDA, NO PRIMEIRO QUADRO EM QUE O MENU JA EXISTE
   *
   * `useLayoutEffect` e nao `useEffect` porque a caixa precisa estar no
   * DOM para ser medida. Com `useEffect` a caixa apareceria num lugar
   * estimado por um quadro antes de ir para o lugar certo, e o jogador
   * veria um pulo
   */
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    const slot = document.querySelector(
      `.inv-slot[data-uid="${entry.uid}"]`,
    );

    if (!slot) return;

    const rect = slot.getBoundingClientRect();

    const alturaEstimada = actions.length * ALTURA_POR_ACAO + 4;

    /**
     * CIMA OU BAIXO.
     *
     * A tela inteira e o limite agora, e nao o container: a caixa esta
     * no `body`, entao o que a corta e a borda da janela
     */
    const espacoAbaixo = window.innerHeight - rect.bottom - BORDA;

    const paraCima = espacoAbaixo < alturaEstimada;

    const alturaReal = caixa.current?.offsetHeight ?? alturaEstimada;

    setPosicao(
      paraCima
        ? {
            left: rect.left + rect.width / 2,
            top: Math.max(
              BORDA,
              rect.top - alturaReal - 4,
            ),
          }
        : {
            left: rect.left + rect.width / 2,
            top: Math.min(
              window.innerHeight - alturaReal - BORDA,
              rect.bottom + 4,
            ),
          },
    );
  }, [entry.uid, actions.length]);

  if (typeof document === "undefined") return null;

  if (!actions || actions.length === 0) return null;

  const conteudo = (
    <span
      ref={caixa}
      className="inv-menu inv-menu--center inv-menu--float"
      role="menu"
      style={{
        left: posicao?.left ?? 0,
        top: posicao?.top ?? 0,

        // invisivel ate medir: o mesmo cuidado do `ItemTooltip`. Sem isto
        // a caixa apareceria no canto da tela por um quadro
        opacity: posicao ? 1 : 0,
      }}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={[
            "inv-menu__action",
            action.danger ? "is-danger" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={(event) => {
            event.stopPropagation();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </span>
  );

  return createPortal(conteudo, document.body);
}