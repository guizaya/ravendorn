export const SERVER_CONFIG = {
  port: Number(process.env.PORT ?? 8787),

  /**
   * O ENDERECO, E POR QUE O PADRAO E `::` E NAO `0.0.0.0`.
   *
   * ## O PROBLEMA QUE ESTO RESOLVE
   *
   * `localhost` resolve para DOIS enderecos nesta maquina: `::1` (IPv6) e
   * `127.0.0.1` (IPv4). O navegador tenta o IPv6 primeiro e, se ele recusar, nao
   * tenta o IPv4 — o `WebSocket` morre com "connection failed" sem deixar
   * rastro de onde foi o problema
   *
   * Ouvindo so em `0.0.0.0`, o servidor nao respondia em `::1`, e era
   * exatamente ai que o navegador ia primeiro
   *
   * ## POR QUE `::` E NAO `::1`
   *
   * `::` e o "todos os IPv6". Com o `ipv6Only` do Node em `false` — que e o
   * padrao — esse socket e de DUAS pilhas: atende IPv6 E o IPv4 mapeado
   * dentro dele. Entao `::1` e `127.0.0.1` chegam no mesmo processo, e o
   * `localhost` funciona dos dois jeitos
   *
   * E por que nao `::1`: ele seria so o loopback IPv6, e o servidor voltaria a
   * nao responder no IPv4 — o mesmo bug do outro lado
   *
   * ## E A RESERVA
   *
   * Uma maquina com IPv6 desativado no sistema inteiro nao consegue abrir
   * esse socket. O `index.js` cai para `0.0.0.0` nesse caso, e o aviso sai no
   * console — o servidor sempre sobe
   */
  host: process.env.HOST ?? "::",

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
