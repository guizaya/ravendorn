import { useRef, useState } from "react";

const DRAG_THRESHOLD = 22;
const DRAG_DEADZONE = 6;
const DRAG_LIMIT = 34;

export default function SkillSlot({
  skill,
  cooldown = 0,
  disabled = false,
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

  const ready = cooldown <= 0 && !disabled;
  const showAuto = auto && !ultimate;
  const canDrag = draggable && !disabled && !ultimate;

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

    onClick?.();
  }

  return (
    <button
      type="button"
      className={[
        "skill-slot",
        ultimate ? "skill-slot--ultimate" : "",
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
        ultimate
          ? `${skill.name} — ${skill.cooldown}s de cooldown`
          : `${skill.name} — ${skill.cooldown}s de cooldown\nArraste para baixo: auto\nArraste para cima: manual`
      }
      aria-label={`Usar ${skill.name}`}
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

      {drag && drag.direction !== 0 && (
        <span className="skill-slot__drag-hint">
          {drag.direction > 0 ? "AUTO" : "MAN"}
        </span>
      )}
    </button>
  );
}
