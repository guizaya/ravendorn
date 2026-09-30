import { useCallback, useEffect, useMemo, useState } from "react";
import SkillSlot from "../Skills/SkillSlot.jsx";
import {
  isSkillAuto,
  setSkillAuto,
} from "../../game/engine/autoSkills.js";

function chunk(items, size) {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) =>
      items.slice(index * size, index * size + size),
  );
}

function ResourceBar({
  label,
  value,
  max,
  color,
}) {
  const percent = Math.max(
    0,
    Math.min(100, (value / max) * 100),
  );

  return (
    <div className="resource-bar">
      <div className="resource-bar__heading">
        <span>{label}</span>
        <span>
          {Math.ceil(value)} / {max}
        </span>
      </div>

      <div className="resource-bar__track">
        <div
          className="resource-bar__fill"
          style={{
            width: `${percent}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

export default function HUD({
  classDefinition,
  snapshot,
  engineRef,
  onBack,
}) {
  const skillPages = useMemo(
    () => chunk(classDefinition.skills, 8),
    [classDefinition],
  );

  const [page, setPage] = useState(0);

  const [autoSkills, setAutoSkills] = useState(() => {
    const initial = {};

    for (const skill of classDefinition.skills) {
      initial[skill.id] = isSkillAuto(skill.id);
    }

    return initial;
  });

  useEffect(() => {
    setPage(0);
  }, [classDefinition.id]);

  useEffect(() => {
    setAutoSkills(() => {
      const next = {};

      for (const skill of classDefinition.skills) {
        next[skill.id] = isSkillAuto(skill.id);
      }

      return next;
    });
  }, [classDefinition]);

  const handleToggleAuto = useCallback(
    (skillId, enabled) => {
      const next = setSkillAuto(skillId, enabled);

      engineRef.current?.setSkillAuto?.(
        skillId,
        next,
      );

      setAutoSkills((current) => ({
        ...current,
        [skillId]: next,
      }));
    },
    [engineRef],
  );

  useEffect(() => {
    engineRef.current?.setSkillPage(page);
  }, [page, engineRef]);

  const player = snapshot?.player ?? {
    name: classDefinition.name,
    className: classDefinition.name,
    level: 1,
    hp: classDefinition.stats.hp,
    maxHp: classDefinition.stats.hp,
    resource: classDefinition.stats.resource,
    maxResource: classDefinition.stats.resource,
    resourceName: classDefinition.resource.name,
    shield: 0,
    attack: classDefinition.stats.attack,
    defense: classDefinition.stats.defense,
    speed: classDefinition.stats.speed,
    statusEffects: [],
    casting: false,
  };

  const cooldowns = snapshot?.cooldowns ?? {};
  const visibleSkills = skillPages[page] ?? [];

  return (
    <div className="hud">
      <header className="hud__topbar">
        <button
          type="button"
          className="hud-back-button"
          onClick={onBack}
        >
          ← Classes
        </button>

        <button
          type="button"
          className={[
            "hud-auto-button",
            snapshot?.autoPlay ? "is-active" : "",
            snapshot?.engaged ? "is-engaged" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={Boolean(snapshot?.autoPlay)}
          onClick={() =>
            engineRef.current?.toggleAutoPlay()
          }
        >
          <span className="hud-auto-button__dot" />

          {snapshot?.autoPlay
            ? "AUTO ON"
            : snapshot?.engaged
              ? "AUTO ALVO"
              : "AUTO OFF"}
        </button>

        <div className="hud-class-badge">
          <span
            className="hud-class-badge__icon"
            style={{
              background: classDefinition.accent,
            }}
          >
            {classDefinition.icon}
          </span>

          <div>
            <strong>{player.className}</strong>
            <span>Nível {player.level}</span>
          </div>
        </div>

        <div className="hud-top-stats">
          <span>ATQ {player.attack}</span>
          <span>DEF {player.defense}</span>
          <span>VEL {player.speed}</span>
        </div>
      </header>

      <section className="player-panel">
        <div className="player-panel__name">
          <strong>{player.name}</strong>

          {player.casting && (
            <span className="casting-label">
              {player.castingName}
            </span>
          )}
        </div>

        <ResourceBar
          label="HP"
          value={player.hp}
          max={player.maxHp}
          color="linear-gradient(90deg, #ad3131, #ef6861)"
        />

        <ResourceBar
          label={player.resourceName}
          value={player.resource}
          max={player.maxResource}
          color={classDefinition.resource.color}
        />

        {player.shield > 0 && (
          <div className="shield-label">
            ESCUDO {player.shield}
          </div>
        )}

        {player.statusEffects.length > 0 && (
          <div className="effect-list">
            {player.statusEffects.map((effect, index) => (
              <span
                key={`${effect.type}_${index}`}
                className="effect-chip"
                title={`${effect.type}: ${effect.remaining.toFixed(1)}s`}
              >
                {effect.type}
                <small>{effect.remaining.toFixed(1)}s</small>
              </span>
            ))}
          </div>
        )}
      </section>

      {snapshot?.selectedTarget && (
        <section className="target-panel">
          <span className="eyebrow">ALVO SELECIONADO</span>
          <strong>
            {snapshot.selectedTarget.name}
          </strong>

          <div className="target-panel__bar">
            <div
              style={{
                width: `${(
                  (snapshot.selectedTarget.hp /
                    snapshot.selectedTarget.maxHp) *
                  100
                )}%`,
              }}
            />
          </div>

          <small>
            {snapshot.selectedTarget.hp} /{" "}
            {snapshot.selectedTarget.maxHp} HP
          </small>
        </section>
      )}

      {snapshot?.message && (
        <div
          className={[
            "game-message",
            snapshot.message.bad ? "is-error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {snapshot.message.text}
        </div>
      )}

      <aside className="controls-hint">
        <strong>CONTROLES</strong>
        <span>WASD / setas — mover</span>
        <span>Mouse — mirar</span>
        <span>Clique / Espaço — ataque</span>
        <span>1–8 — habilidades</span>
        <span>R — ultimate</span>
        <span>T — auto play</span>
        <span>Arraste skill ↓ auto · ↑ manual</span>
        <span>Backspace — restaurar alvos</span>
      </aside>

      <footer className="skill-dock">
        <div className="skill-dock__page-controls">
          {skillPages.map((_, index) => (
            <button
              key={index}
              type="button"
              className={
                page === index ? "is-active" : ""
              }
              onClick={() => setPage(index)}
              aria-label={`Página de habilidades ${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <div className="skill-dock__skills">
          {visibleSkills.map((skill) => (
            <SkillSlot
              key={skill.id}
              skill={skill}
              cooldown={cooldowns[skill.id] ?? 0}
              draggable
              auto={Boolean(autoSkills[skill.id])}
              onToggleAuto={(enabled) =>
                handleToggleAuto(skill.id, enabled)
              }
              onClick={() =>
                engineRef.current?.useSkillSlot(skill.slot)
              }
            />
          ))}

          <div className="skill-dock__separator" />

          <SkillSlot
            ultimate
            skill={classDefinition.ultimate}
            cooldown={
              cooldowns[classDefinition.ultimate.id] ?? 0
            }
            onClick={() =>
              engineRef.current?.useUltimate()
            }
          />
        </div>

        <p className="skill-dock__hint">
          {classDefinition.resource.name}: usado por habilidades e
          regenerado automaticamente.
        </p>
      </footer>
    </div>
  );
}
