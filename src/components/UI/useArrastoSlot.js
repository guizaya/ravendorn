import { useCallback, useRef, useState } from "react";

/**
 * O ARRASTE QUE LIGA E DESLIGA O AUTOMATICO.
 *
 * ## POR QUE ISTO E UM HOOK E NAO UM COMPONENTE
 *
 * Porque o gesto e IDENTICO em dois lugares da tela: no slot de skill e no
 * slot da pocao. "Puxa para baixo liga, puxa para cima desliga" e uma regra
 * que o jogador aprende uma vez — nos dois lugares ele espera a mesma
 * coisa. Copiar os numeros para o segundo slot criaria dois lugares onde a
 * mesma regra poderia ficar diferente, e o jogador learndo com a skill
 * estaria errado na pocao
 *
 * ## POR QUE OS NUMEROS SAO ESTES
 *
 * - `DRAG_DEADZONE` (6px): o que separa um clique de um arrasto. Abaixo
 *   disso o dedo ainda esta "apertando", e um slot que liga o automatico
 *   por um toque acidental seria pior do que um slot sem recurso
 * - `DRAG_THRESHOLD` (22px): o arrasto que conta. Um arrasto de 10px e uma
 *   troca de pagina, nao uma decisao
 * - `DRAG_LIMIT` (34px): ate onde o slot viaja. Acima disso o dedo ja saiu
 *   do slot e o desenho acompanha o dedo para fora, o que faz o arrasto
 *   parecer um arrasto de tela em vez de um clique no slot
 *
 * ## POR QUE O RESULTADO E UM SET, E NAO UM "INVERTER"
 *
 * `onAlternar(ligado)` recebe o estado que o jogador QUER, e nao
 * "mexeu". Dois arrastes rapidos chegam em qualquer ordem, e um inverter
 * de dois toques voltaria ao comeco — o automatico ligando e desligando
 * sem o jogador ter decidido nada
 */
export const DRAG_DEADZONE = 6;
export const DRAG_THRESHOLD = 22;
export const DRAG_LIMIT = 34;

/**
 * @param {object} opcoes
 * @param {(ligado: boolean) => void} opcoes.onAlternar
 *   Chamado no fim de um arrasto que passou do `DRAG_THRESHOLD`, com o
 *   estado pedido: `true` para baixo, `false` para cima
 * @param {boolean} opcoes.habilitado
 *   Quando `false`, o arrasto nao comeca. E o que desliga o gesto no slot
 *   trancado e no que nao tem o que alternar
 *
 * @returns {object} os manipuladores para espalhar no elemento
 */
export function useArrastoSlot({ onAlternar, habilitado = true }) {
  const [drag, setDrag] = useState(null);

  const startY = useRef(0);
  const latestOffset = useRef(0);
  const dragging = useRef(false);
  const suppressClick = useRef(false);

  function handlePointerDown(event) {
    if (!habilitado) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);

    startY.current = event.clientY;
    latestOffset.current = 0;
    dragging.current = true;
    suppressClick.current = false;
  }

  function handlePointerMove(event) {
    if (!dragging.current) return;

    const raw = event.clientY - startY.current;

    latestOffset.current = raw;

    /**
     * O `suppressClick` e armado assim que o arrasto passa da DEADZONE, e
     * nao no `up`. Porque o navegador dispara o `click` depois do
     * `pointerup`, e o `click` ja contaria o arrasto como clique — sem
     * armar aqui, soltar a skill depois de arrastar para baixo usaria a
     * skill E ligaria o automatico, e o arraste deveria escolher entre os
     * dois
     */
    if (Math.abs(raw) > DRAG_DEADZONE) {
      suppressClick.current = true;
    }

    setDrag({
      offset: Math.max(-DRAG_LIMIT, Math.min(DRAG_LIMIT, raw)),
      direction: raw > DRAG_DEADZONE ? 1 : raw < -DRAG_DEADZONE ? -1 : 0,
    });
  }

  function handlePointerUp(event) {
    if (!dragging.current) return;

    dragging.current = false;

    const offset = latestOffset.current;

    setDrag(null);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (Math.abs(offset) < DRAG_THRESHOLD) {
      return;
    }

    onAlternar?.(offset > 0);
  }

  function handlePointerCancel() {
    dragging.current = false;
    latestOffset.current = 0;
    setDrag(null);
  }

  /**
   * O CONSUMIDOR CHAMA ISTO NO COMECO DO SEU `onClick`.
   *
   * Devolve `false` quando o clique era o final de um arrasto — e ja
   * limpa a marca, porque o proximo clique de verdade precisa passar
   *
   * E um `useCallback` porque os consumidores o põem na lista de
   * dependencias do proprio `onClick`: sem ele, o `onClick` do slot seria
   * uma funcao nova a cada render e o memo do consumidor nao seguraria
   */
  const deixaClicar = useCallback(() => {
    if (!suppressClick.current) return true;

    suppressClick.current = false;

    return false;
  }, []);

  return {
    drag,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    deixaClicar,
  };
}