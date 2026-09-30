const autoSkillFlags = new Map();

export function isSkillAuto(skillId) {
  return autoSkillFlags.get(skillId) === true;
}

export function setSkillAuto(skillId, enabled) {
  autoSkillFlags.set(skillId, Boolean(enabled));

  return Boolean(enabled);
}
