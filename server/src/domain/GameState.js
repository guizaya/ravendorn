export class GameState {
  constructor({ matchId }) {
    this.matchId = matchId;
    this.status = "local";
    this.tick = 0;
    this.players = new Map();
    this.version = 1;
  }

  addPlayer(player) {
    if (this.players.has(player.id)) {
      throw new Error("Jogador já existe no estado.");
    }

    this.players.set(player.id, player);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  advanceTick() {
    this.tick += 1;
    this.version += 1;
  }

  createSnapshot() {
    return {
      matchId: this.matchId,
      tick: this.tick,
      version: this.version,
      players: [...this.players.values()],
    };
  }
}
