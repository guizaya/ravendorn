import { useRef, useState } from "react";

const DRAG_THRESHOLD = 22;
const DRAG_DEADZONE = 6;
const DRAG_LIMIT = 34;

export default function SkillSlot({
  skill,
  cooldown = 0,
  disabled = false,
  trancada = false,
  onClick,
  onToggleAuto,
  auto = false,
  draggable = false,
  ultimate = false,
}) {
  const [drag, setDrag] = useState(null);

  const startY = useRef(0);
  const latestOffset = useRef(0);
  const dragging = useRef(false);
  const suppressClick = useRef(false);

  const ratio =
    skill.cooldown > 0
      ? Math.min(1, cooldown / skill.cooldown)
      : 0;

  /**
 * O QUE A TRANCA FAZ, E O QUE ELA NAO FAZ
 *
 * Ela impede o clique e o arraste. Ela nao impede o RENDER: o slot
 * continua desenhado, com o nome e o icone, porque o jogador precisa ver
 * o que ainda nao tem para saber o que comprar com o Mestre
 *
 * `disabled` e o oposto de proposito: ele some o botao da navegacao de
 * verdade, e aqui o slot e um botao com o icome apagado. Sao coisas
 * diferentes: um slot trancado e informacao, um slot desabilitado nao e
 * slot nenhum
 */
  const trancadaAgora = trancada || disabled;

  const ready = cooldown <= 0 && !trancadaAgora;
  const showAuto = auto && !ultimate;
  const canDrag = draggable && !trancadaAgora && !ultimate;

  function handlePointerDown(event) {
    if (!canDrag) return;

    event.currentTarget.setPointerCapture?.(
      event.pointerId,
    );

    startY.current = event.clientY;
    latestOffset.current = 0;
    dragging.current = true;
    suppressClick.current = false;
  }

  function handlePointerMove(event) {
    if (!dragging.current) return;

    const raw = event.clientY - startY.current;

    latestOffset.current = raw;

    if (Math.abs(raw) > DRAG_DEADZONE) {
      suppressClick.current = true;
    }

    setDrag({
      offset: Math.max(
        -DRAG_LIMIT,
        Math.min(DRAG_LIMIT, raw),
      ),
      direction:
        raw > DRAG_DEADZONE
          ? 1
          : raw < -DRAG_DEADZONE
            ? -1
            : 0,
    });
  }

  function handlePointerUp(event) {
    if (!dragging.current) return;

    dragging.current = false;

    const offset = latestOffset.current;

    setDrag(null);

    if (
      event.currentTarget.hasPointerCapture?.(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    if (Math.abs(offset) < DRAG_THRESHOLD) {
      return;
    }

    onToggleAuto?.(offset > 0);
  }

  function handlePointerCancel() {
    dragging.current = false;
    latestOffset.current = 0;
    setDrag(null);
  }

  function handleClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }

    /**
     * O clique numa skill trancada nao faz NADA.
     *
     * Nao e um aviso: o aviso esta no `title`, e um popup a cada clique
     * numa skill de quem esta aprendendo seria barulho. Alem disso o
     * servidor ja recusa com mensagem, entao o aviso aqui seria o mesmo
     * aviso duas vezes
     */
    if (trancadaAgora) return;

    onClick?.();
  }

  return (
    <button
      type="button"
      className={[
        "skill-slot",
        ultimate ? "skill-slot--ultimate" : "",
        trancada ? "is-trancada" : "",
        ready ? "is-ready" : "",
        showAuto ? "is-auto" : "",
        canDrag ? "is-draggable" : "",
        drag ? "is-dragging" : "",
        drag?.direction === 1 ? "is-drag-on" : "",
        drag?.direction === -1 ? "is-drag-off" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--skill-color": skill.color ?? "#9ba7b7",
        transform: drag
          ? `translateY(${drag.offset}px) scale(1.06)`
          : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      disabled={disabled}
      title={
        trancada
          ? `${skill.name} — não aprendida\nCompre o livro com o Mestre de Habilidades`
          : ultimate
            ? `${skill.name} — ${skill.cooldown}s de cooldown`
            : `${skill.name} — ${skill.cooldown}s de cooldown\nArraste para baixo: auto\nArraste para cima: manual`
      }
      aria-label={
        trancada
          ? `${skill.name} — não aprendida`
          : `Usar ${skill.name}`
      }
      aria-pressed={showAuto}
    >
      <span className="skill-slot__frame" />

      <span
        className="skill-slot__cooldown"
        style={{
          transform: `scaleY(${ratio})`,
        }}
      />

      <span className="skill-slot__key">
        {ultimate ? "R" : skill.slot}
      </span>

      <span className="skill-slot__icon">
        {skill.icon}
      </span>

      {cooldown > 0 && (
        <span className="skill-slot__timer">
          {cooldown.toFixed(1)}
        </span>
      )}

      {canDrag && showAuto && !drag && (
        <span className="skill-slot__auto-badge">
          A
        </span>
      )}

      {/**
        O CADEADO, so na skill trancada.
        *
        E um caractere e nao um icone desenhado: o `§` do livro e o
        `✓` do aprendido ja usam texto nesta tela, e uma arte nova aqui
        seria a primeira coisa do componente que depende de arquivo
      */}
      {trancada && (
        <span className="skill-slot__lock">
          ✕
        </span>
      )}

      {drag && drag.direction !== 0 && (
        <span className="skill-slot__drag-hint">
          {drag.direction > 0 ? "AUTO" : "MAN"}
        </span>
      )}
    </button>
  );
}
