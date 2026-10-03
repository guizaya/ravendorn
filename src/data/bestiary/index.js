import {
  BEHAVIOR,
  CREATURE_TYPES,
  ZONE_ROSTER,
} from "../enemies/index.js";
import { getZoneById } from "../maps/index.js";

export const BESTIARY_ICON = {
  slime: "◍",
  rat: "⌇",
  goblin: "☗",
  ghoul: "☠",
  skeleton: "⚔",
  ogre: "⛊",
  zumbi_arbalist: "✜",
  // o ogre da predeira e um ogre, entao divide o glifo do ogre da
  // pedreira. Um glifo novo aqui seria um caractere a mais de uma
  // fonte de icone, e a lista do bestiario ficaria com dois ogres
  // quase iguais: o nome e o que diferencia
  ogre_da_predeira: "⛊",
};

/**
 * Cada criatura do bestiario tem tres cacadas encadeadas.
 * A recompensa e um bonus PERMANENTE de stat e soma direto no
 * pipeline do equipamento, entao voltar a caçar um bicho antigo
 * continua valendo.
 */
const HUNT_TIERS = [
  { tier: 1, count: 5 },
  { tier: 2, count: 15 },
  { tier: 3, count: 40 },
];

/** rotulo curto dos stats que o bestiario pode conceder */
export const BESTIARY_STAT = {
  maxHp: { label: "Vida", short: "VID" },
  speed: { label: "Velocidade", short: "VEL" },
  attackSpeed: { label: "Vel. Atq", short: "VEL. ATQ", percent: true },
  attack: { label: "Ataque", short: "ATQ" },
  defense: { label: "Defesa", short: "DEF" },
  resourceRegen: { label: "Regen", short: "REG" },
};

function formatStat(stat, value) {
  // regen e um valor absoluto (o equipamento usa a mesma unidade)
  const percent = BESTIARY_STAT[stat]?.percent === true;

  if (percent) {
    return `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
  }

  return `+${Math.round(value)}`;
}

/** descricao legivel do bonus, ex: "+12 Vida  ·  +6% Vel. Atq" */
export function describeBonus(bonus) {
  return Object.entries(bonus ?? {})
    .map(([stat, value]) => {
      const info = BESTIARY_STAT[stat];

      return info
        ? `${formatStat(stat, value)} ${info.label}`
        : `${formatStat(stat, value)} ${stat}`;
    })
    .join("  ·  ");
}

/**
 * a vitrine de uma criatura e a zona onde ela e mais comum.
 * sem isso todas cairiam na primeira zona do roster.
 */
function zoneOf(typeId) {
  let best = null;

  for (const row of ZONE_ROSTER) {
    const weight = row.mix?.[typeId] ?? 0;

    if (weight <= 0) continue;
    if (best && weight <= best.weight) continue;

    best = { zone: row.zone, weight };
  }

  return best ? getZoneById(best.zone) : null;
}

function buildHunts(typeId, rewards) {
  return HUNT_TIERS.map((tier, index) => ({
    id: `${typeId}_cacada_${tier.tier}`,
    creatureId: typeId,
    tier: tier.tier,
    count: tier.count,
    title: `${tier.count}x ${CREATURE_TYPES[typeId].name}`,
    summary: `Mate ${tier.count} ${CREATURE_TYPES[typeId].name} para wonhar ${describeBonus(rewards[index])}`,
    reward: rewards[index],
  }));
}

const REWARDS = {
  slime: [
    { maxHp: 12 },
    { speed: 4 },
    { maxHp: 20, attackSpeed: 0.04 },
  ],
  rat: [
    { speed: 6 },
    { attackSpeed: 0.05 },
    { speed: 10, maxHp: 15 },
  ],
  goblin: [
    { attack: 6 },
    { maxHp: 30, speed: 4 },
    { attack: 10, attackSpeed: 0.06 },
  ],
  ghoul: [
    { maxHp: 45 },
    { defense: 10 },
    { maxHp: 60, resourceRegen: 2 },
  ],
  skeleton: [
    { attack: 12 },
    { defense: 14, attackSpeed: 0.06 },
    { maxHp: 80, attack: 12 },
  ],
  ogre: [
    { maxHp: 90 },
    { attack: 18, defense: 18 },
    { maxHp: 120, attackSpeed: 0.08, speed: 6 },
  ],

  // o arqueiro zumbi e mais fraco que o esqueleto de perto (360 de
  // vida contra 520), mas dispara de longe. a recompensa acompanha
  // a leitura da criatura: quem caça de longe ganha ataque e
  // cadencia, nao defense como o esqueleto
  zumbi_arbalist: [
    { attack: 10 },
    { maxHp: 40, attackSpeed: 0.05 },
    { attack: 14, speed: 6 },
  ],

  // o ogre da predeira e o mais duro dos caçados: 1420 de vida
  // contra 1250 do ogre da pedreira. A recompensa segue a leitura
  // de um bicho grande e lento que chega perto: vida e defesa, e
  // nao velocidade como o arqueiro zumbi
  ogre_da_predeira: [
    { maxHp: 70 },
    { defense: 16, maxHp: 50 },
    { attack: 16, maxHp: 90 },
  ],
};

export const BESTIARY = Object.keys(CREATURE_TYPES).map(
  (typeId) => {
    const type = CREATURE_TYPES[typeId];
    const zone = zoneOf(typeId);

    return {
      id: typeId,
      creatureId: typeId,
      name: type.name,
      icon: BESTIARY_ICON[typeId] ?? "◆",
      level: type.level,
      behavior: type.behavior,
      color: type.color,
      zoneId: zone?.id ?? null,
      zoneName: zone?.name ?? null,
      hunts: buildHunts(typeId, REWARDS[typeId]),
    };
  },
);

export const TOTAL_HUNTS = BESTIARY.reduce(
  (sum, entry) => sum + entry.hunts.length,
  0,
);

export function getBestiaryEntry(id) {
  return BESTIARY.find((entry) => entry.id === id) ?? null;
}
