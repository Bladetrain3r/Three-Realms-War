// A refused game action. `code` is stable for tests and the UI; `message` is for the player.
export class GameError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
