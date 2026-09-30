export const SERVER_CONFIG = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",

  protocolVersion: 1,

  capabilities: {
    characterSelection: true,
    localMovement: true,
    localCombat: true,
    multiplayer: false,
    accounts: false,
    persistence: false,
  },
};
