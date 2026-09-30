import {
  CLIENT_COMMANDS,
} from "../../contracts/protocol.js";

export class CommandValidator {
  validate(command) {
    if (!command || typeof command !== "object") {
      throw new Error("Comando inválido.");
    }

    if (!Object.values(CLIENT_COMMANDS).includes(command.type)) {
      throw new Error("Tipo de comando desconhecido.");
    }

    if (
      command.protocolVersion !== 1 ||
      !command.payload ||
      typeof command.payload !== "object"
    ) {
      throw new Error("Payload ou versão de protocolo inválido.");
    }

    switch (command.type) {
      case CLIENT_COMMANDS.USE_SKILL:
        this.validateSkillCommand(command.payload);
        break;

      case CLIENT_COMMANDS.SELECT_TARGET:
        if (
          typeof command.payload.targetId !== "string"
        ) {
          throw new Error("targetId deve ser string.");
        }
        break;

      case CLIENT_COMMANDS.PLAYER_INPUT:
        if (
          command.payload.movement &&
          typeof command.payload.movement !== "object"
        ) {
          throw new Error("movement deve ser um objeto.");
        }
        break;

      default:
        break;
    }

    return command;
  }

  validateSkillCommand(payload) {
    if (
      typeof payload.skillId !== "string" ||
      !Number.isFinite(payload.sequence)
    ) {
      throw new Error("Habilidade sem skillId ou sequence válida.");
    }
  }
}
