/**
 * O protocolo mora em `src/shared/protocol.js` e e o MESMO arquivo
 * para o cliente e para o servidor.
 *
 * Antes havia uma copia aqui com nomes diferentes
 * (`PLAYER_INPUT`, `USE_SKILL`, `SELECT_TARGET`) e o cliente
 * mandava `INPUT`/`ACTION`/`JOIN`. Dois contratos que nunca
 * conversaram so apareceram quando alguem tentou conectar. Este
 * arquivo agora e so a ponte: se alguem importar daqui, cai no
 * unico lugar onde o protocolo e definido.
 */
export * from "../../../src/shared/protocol.js";
