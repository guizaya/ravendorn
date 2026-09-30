/**
 * Interface prepared for a future realtime gateway.
 *
 * No WebSocket or multiplayer connection is intentionally started
 * during the character-selection/test-map stage.
 */
export class GameGateway {
  async connect() {
    throw new Error("Realtime gateway is not enabled in this stage.");
  }

  async authenticate() {
    throw new Error("Authentication will be implemented later.");
  }

  async broadcastSnapshot() {
    throw new Error("Multiplayer broadcasting will be implemented later.");
  }

  async close() {}
}
