import { useCallback, useEffect, useMemo, useState } from "react";
import SkillSlot from "../Skills/SkillSlot.jsx";
import InventoryPanel from "../Inventory/InventoryPanel.jsx";
import QuestPanel from "../Quests/QuestPanel.jsx";
import { getItem } from "../../data/items/index.js";
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

const STATUS_GLYPHS = {
  regeneration: "✚",
  burning: "🔥",
  poison: "☠",
  stun: "⚡",
  freeze: "❄",
  root: "⛓",
  silence: "🔇",
  cloak: "◐",
  slow: "🐌",
  power: "⚔",
  attackSpeed: "⚡",
  resistance: "🛡",
  damageReduction: "🛡",
  invulnerability: "✦",
  speedBoost: "➤",
  reflect: "↺",
  damageTaken: "",
  curse: "☠",
  weaken: "↓",
  controlResistance: "⛊",
  shieldMaintenance: "◈",
  lifesteal: "❤",
  defenseBoost: "⬟",
  resourceDrain: "▼",
  projectileBlock: "⛨",
  asura: "☸",
  elementalAffinity: "✵",
};

function Vitals({ player, resourceColor }) {
  const hpPercent = Math.max(
    0,
    Math.min(100, (player.hp / player.maxHp) * 100),
  );

  const resourcePercent = Math.max(
    0,
    Math.min(
      100,
      (player.resource / player.maxResource) * 100,
    ),
  );

  return (
    <div className="hud-vitals__bars">
      <div className="hud-gauge">
        <span className="hud-gauge__label">HP</span>
        <div className="hud-gauge__track">
          <i
            className="hud-gauge__fill hud-gauge__fill--hp"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
        <span className="hud-gauge__value">
          {Math.ceil(player.hp)}
          <small>/{player.maxHp}</small>
        </span>
      </div>

      <div className="hud-gauge">
        <span className="hud-gauge__label">
          {player.resourceName}
        </span>
        <div className="hud-gauge__track">
          <i
            className="hud-gauge__fill"
            style={{
              width: `${resourcePercent}%`,
              background: resourceColor,
            }}
          />
        </div>
        <span className="hud-gauge__value">
          {player.resource}
          <small>/{player.maxResource}</small>
        </span>
      </div>
    </div>
  );
}

function BuffStrip({ effects }) {
  if (effects.length === 0) return null;

  return (
    <div className="hud-buffs">
      {effects.slice(0, 10).map((effect) => (
        <span
          key={effect.type}
          className={`hud-buff hud-buff--${effect.type}`}
          title={`${effect.type}: ${effect.remaining.toFixed(1)}s`}
        >
          <span className="hud-buff__glyph">
            {STATUS_GLYPHS[effect.type] ?? "•"}
          </span>
          <span className="hud-buff__time">
            {Math.ceil(effect.remaining)}
          </span>
        </span>
      ))}
    </div>
  );
}

function QuestTracker({
  quests,
  player,
  onOpen,
  onFocus,
}) {
  const xp = player.xp ?? 0;
  const needed = player.xpToNext ?? 0;

  const percent =
    Number.isFinite(needed) && needed > 0
      ? Math.min(100, (xp / needed) * 100)
      : 100;

  const main = quests?.main?.current ?? null;
  const side = quests?.side?.current ?? null;
  const auto = quests?.auto ?? null;

  const autoObjectiveId = auto?.objectiveId ?? null;
  const autoOn = Boolean(auto?.enabled);

  if (!main && !side) return null;

  return (
    <section className="qst-tracker">
      <button
        type="button"
        className="qst-tracker__head"
        onClick={onOpen}
        title="Abrir missões (Q)"
      >
        <span className="qst-tracker__lvl">
          Nv.{player.level}
        </span>

        <span className="qst-tracker__xp">
          <i style={{ width: `${percent}%` }} />
        </span>

        <small>
          {Number.isFinite(needed)
            ? `${xp}/${needed} XP`
            : "MAX"}
        </small>
      </button>

      {main && (
        <button
          type="button"
          className={[
            "qst-tracker__row",
            main.autoCompletable
              ? "is-clickable"
              : "is-manual",
            autoObjectiveId === main.id
              ? "is-auto"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() =>
            main.autoCompletable &&
            onFocus?.(main.id)
          }
          disabled={!main.autoCompletable}
          title={
            main.autoCompletable
              ? "Completar automaticamente"
              : "Conclua manualmente"
          }
        >
          <span className="qst-tracker__tag">P</span>

          <div>
            <strong>{main.name}</strong>
            <small>
              {main.progress}/{main.count}
              {main.autoCompletable
                ? ""
                : " · aguardando"}
            </small>
          </div>

          {autoObjectiveId === main.id && autoOn && (
            <span className="qst-tracker__auto">AUTO</span>
          )}
        </button>
      )}

      {side && (
        <button
          type="button"
          className={[
            "qst-tracker__row",
            "is-side",
            "is-clickable",
            autoObjectiveId === side.id ? "is-auto" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onFocus?.(side.id)}
          title="Completar automaticamente"
        >
          <span className="qst-tracker__tag">S</span>

          <div>
            <strong>{side.name}</strong>
            <small>
              {side.progress}/{side.count}
            </small>
          </div>

          {autoObjectiveId === side.id && autoOn && (
            <span className="qst-tracker__auto">AUTO</span>
          )}
        </button>
      )}
    </section>
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
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [questsOpen, setQuestsOpen] = useState(false);

  useEffect(() => {
    const onKey = (event) => {
      if (event.code === "KeyI") {
        setInventoryOpen((current) => !current);
      }

      if (event.code === "KeyQ") {
        setQuestsOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKey);

    return () =>
      window.removeEventListener("keydown", onKey);
  }, []);

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

      engineRef.current?.setSkillAuto?.(skillId, next);

      setAutoSkills((current) => ({
        ...current,
        [skillId]: next,
      }));
    },
    [engineRef],
  );

  const handleToggleAutoPlay = useCallback(() => {
    engineRef.current?.toggleAutoPlay();
  }, [engineRef]);

  const handleReset = useCallback(() => {
    engineRef.current?.resetTargets();
  }, [engineRef]);

  const handleEquip = useCallback(
    (entry, slotId) => {
      engineRef.current?.equipItem(entry.uid, slotId);
    },
    [engineRef],
  );

  const handleUnequip = useCallback(
    (slotId) => {
      engineRef.current?.unequipItem(slotId);
    },
    [engineRef],
  );

  const handleAutoEquip = useCallback(() => {
    engineRef.current?.autoEquipBest();
  }, [engineRef]);

  const handleAcceptQuest = useCallback(
    (questId) => {
      engineRef.current?.acceptSideQuest(questId);
    },
    [engineRef],
  );

  const handleAbandonQuest = useCallback(() => {
    engineRef.current?.abandonSideQuest();
  }, [engineRef]);

  const handleFocusQuest = useCallback(
    (questId) => {
      engineRef.current?.focusQuest(questId);
    },
    [engineRef],
  );

  const handleToggleQuestAuto = useCallback(() => {
    engineRef.current?.toggleQuestAuto();
  }, [engineRef]);

  const openFirstFreeSlot = useCallback(
    (entry) => {
      const equipment = snapshot?.equipment;

      if (!equipment) return;

      const slot = equipment.slots.find((candidate) =>
        candidate.accepts.includes(
          getItem(entry.itemId)?.type,
        ),
      );

      if (!slot) return;

      engineRef.current?.equipItem(entry.uid, slot.id);
    },
    [engineRef, snapshot],
  );

  const player = snapshot?.player ?? {
    name: classDefinition.name,
    className: classDefinition.name,
    level: 1,
    hp: classDefinition.stats.hp,
    maxHp: classDefinition.stats.hp,
    resource: classDefinition.stats.resource,
    maxResource: classDefinition.stats.resource,
    resourceName: classDefinition.resource.name,
    resourceColor: classDefinition.resource.color,
    shield: 0,
    attack: classDefinition.stats.attack,
    defense: classDefinition.stats.defense,
    speed: classDefinition.stats.speed,
    statusEffects: [],
    casting: false,
  };

  const cooldowns = snapshot?.cooldowns ?? {};
  const visibleSkills = skillPages[page] ?? [];

  const summary = snapshot?.inventory ?? {
    coins: 0,
    used: 0,
    capacity: 20,
    isFull: false,
    items: [],
  };

  const autoOn = Boolean(snapshot?.autoPlay);
  const engaged = Boolean(snapshot?.engaged);

  return (
    <div className="hud">
      <section className="hud-vitals">
        <header className="hud-vitals__head">
          <span className="hud-lv">
            Lv.{player.level}
          </span>

          <span className="hud-vitals__name">
            {player.className}
          </span>
        </header>

        <Vitals
          player={player}
          resourceColor={classDefinition.resource.color}
        />

        <div className="hud-vitals__stats">
          <span>ATQ {player.attack}</span>
          <span>DEF {player.defense}</span>
          <span>VEL {player.speed}</span>
        </div>

        <button
          type="button"
          className={[
            "hud-pouch",
            summary.isFull ? "is-full" : "",
            inventoryOpen ? "is-open" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() =>
            setInventoryOpen((current) => !current)
          }
          title="Inventário (I)"
        >
          <span className="hud-pouch__coins">
            <i>◉</i>
            {summary.coins}
          </span>

          <span className="hud-pouch__slots">
            {summary.used}/{summary.capacity}
          </span>
        </button>

        {player.shield > 0 && (
          <span className="hud-vitals__shield">
            ESCUDO {player.shield}
          </span>
        )}
      </section>

      <BuffStrip effects={player.statusEffects} />

      <nav className="hud-menu">
        <button
          type="button"
          className="hud-btn"
          onClick={onBack}
          title="Voltar para as classes"
        >
          ←
        </button>

        <button
          type="button"
          className="hud-btn hud-btn--reset"
          onClick={handleReset}
          title="Restaurar alvos"
        >
          ↺
        </button>
      </nav>

      <aside className="hud-rail">
        {skillPages.map((_, index) => (
          <button
            key={index}
            type="button"
            className={[
              "hud-btn",
              "hud-btn--sm",
              page === index ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setPage(index)}
            title={`Página ${index + 1} de habilidades`}
          >
            {index + 1}
          </button>
        ))}
      </aside>

      {snapshot?.selectedTarget && (
        <section className="target-panel">
          <span className="eyebrow">ALVO</span>
          <strong>
            {snapshot.selectedTarget.name}
          </strong>

          <div className="target-panel__bar">
            <div
              style={{
                width: `${
                  (snapshot.selectedTarget.hp /
                    snapshot.selectedTarget.maxHp) *
                  100
                }%`,
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

      <footer className="hud-actionbar">
        <div className="hud-actionbar__slots">
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

          <span className="hud-actionbar__divider" />

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

        <p className="hud-actionbar__hint">
          Arraste a skill ↓ para auto · ↑ para manual
        </p>
      </footer>

      <QuestTracker
        quests={snapshot?.quests}
        player={player}
        onOpen={() => setQuestsOpen(true)}
        onFocus={handleFocusQuest}
      />

      {questsOpen && (
        <QuestPanel
          quests={snapshot?.quests}
          onClose={() => setQuestsOpen(false)}
          onAccept={handleAcceptQuest}
          onAbandon={handleAbandonQuest}
          onFocus={handleFocusQuest}
          onToggleAuto={handleToggleQuestAuto}
        />
      )}

      {inventoryOpen && (
        <InventoryPanel
          inventory={summary}
          equipment={snapshot?.equipment}
          onClose={() => setInventoryOpen(false)}
          onEquip={(entry) => openFirstFreeSlot(entry)}
          onUnequip={handleUnequip}
          onAutoEquip={handleAutoEquip}
        />
      )}

      <button
        type="button"
        className={[
          "hud-ability",
          autoOn ? "is-on" : "",
          engaged ? "is-engaged" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={handleToggleAutoPlay}
        title="Auto play (T)"
      >
        <span className="hud-ability__ring" />
        <span className="hud-ability__text">
          {autoOn ? "AUTO" : engaged ? "ALVO" : "OFF"}
        </span>
        <span className="hud-ability__key">T</span>
      </button>
    </div>
  );
}
