export const CLIENT_COMMANDS = Object.freeze({
  PLAYER_INPUT: "PLAYER_INPUT",
  USE_SKILL: "USE_SKILL",
  SELECT_TARGET: "SELECT_TARGET",
});

export const SERVER_EVENTS = Object.freeze({
  WELCOME: "WELCOME",
  SNAPSHOT: "SNAPSHOT",
  COMMAND_REJECTED: "COMMAND_REJECTED",
  PLAYER_JOINED: "PLAYER_JOINED",
  PLAYER_LEFT: "PLAYER_LEFT",
});

export function createCommand(type, payload = {}) {
  return {
    protocolVersion: 1,
    type,
    payload,
    timestamp: Date.now(),
  };
}
