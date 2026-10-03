export const SERVER_CONFIG = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",

  // o mesmo numero do `src/shared/protocol.js`. se os dois
  // divergirem, o handshake recusa em vez de deixar o cliente
  // falar sozinho com um servidor que nao entende
  protocolVersion: 1,

  // 20 ticks por segundo. o jogo roda a 60 no navegador, mas
  // online o servidor manda 20 snapshots por segundo e o cliente
  // interpola: e imperceptivel e corta o custo de banda pela
  // metade
  tickRate: Number(process.env.TICK_RATE ?? 20),
  tickSeconds: 1 / Number(process.env.TICK_RATE ?? 20),

  // quanto o mundo simula por vez. o loop usa o tempo real
  // decorrido, entao uma CPU lenta roda menos ticks em vez de
  // tentar catching up e piscar
  maxCatchUpTicks: 5,

  // teto de mensagens por cliente. sem isso, um so jogador
  // disparando pacote sem parar derrubaria o servidor inteiro
  maxMessagesPerSecond: 90,
  maxActionsPerSecond: 20,

  // conexoes simultaneas
  maxPlayers: Number(process.env.MAX_PLAYERS ?? 50),

  capabilities: {
    characterSelection: true,

    // a autoridade e do servidor. o cliente manda intencao e
    // recebe o resultado: nao ha movimento nem combate local
    localMovement: false,
    localCombat: false,

    multiplayer: true,
    accounts: false,

    // O progresso do personagem e guardado em arquivo pelo nome.
    // Ver `server/src/persistence/CharacterStore.js`
    persistence: true,
  },
};
