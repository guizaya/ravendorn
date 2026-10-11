/**
 * O CICLO INTEIRO DO FARM OFFLINE, do ligar ate a segunda entrada.
 *
 * ## POR QUE ISTO EXISTE
 *
 * Porque o relatorio de accrue sobrevive a TRES lugares — sessao, painel e
 * arquivo — e cada um pode devolver o que ja foi pago. O bug real foi o
 * inverso: o `FARM_OFFLINE_VISTO` nao chegava ao servidor, o relatorio
 * continuava na sessao, e a tela aparecia uma vez por login para sempre
 *
 * Nenhum teste de unidade pega isso. So a sequencia completa pega: o accrue
 * acontece no `entrar`, o "ja vi" acontece num pedido separado, e o save
 * gravado entre os dois e o que decide o que a proxima tela mostra
 *
 * Uso: node tools/conferir-ciclo-farm.mjs
 */
import { GameServer } from "../server/src/domain/GameServer.js";
import { SERVER_CONFIG } from "../server/src/config.js";
import { createPlayerSession } from "../src/game/engine/PlayerSession.js";
import { getCharacterDefinition } from "../src/data/characters/index.js";
import {
  applyCharacterSave,
  snapshotSession,
} from "../src/game/save/CharacterSave.js";

let agora = 1_700_000_000_000;
const HORA = 3_600_000;

const jogo = new GameServer({
  config: { ...SERVER_CONFIG, agora: () => agora },
  mapId: "map_1",
  persistencia: { pasta: "C:/Users/User/AppData/Local/Temp/opencode/farm-ciclo" },
});

const CLASSE = getCharacterDefinition("warrior");
const NOME = "Ciclo";

/** Uma sessao nova a partir do save que o servidor gravou por ultimo. */
function novaEntrada(salvo, id) {
  const sessao = createPlayerSession(CLASSE, {
    id,
    name: NOME,
    donoKey: "ciclo",
  });

  jogo.engine.addPlayer(sessao, { mapId: "map_1" });
  applyCharacterSave(sessao, salvo, { spawn: { x: 1200, y: 800 } });
  jogo.engine.focusPlayer(id);
  jogo.engine.applyEquipment();

  return sessao;
}

let falhas = 0;

function confere(condicao, descricao) {
  if (!condicao) falhas += 1;

  console.log(`  ${condicao ? "ok  " : "FALHA"}  ${descricao}`);
}

// --- 1. LIGA O FARM, como o botao da pausa faz ---------------------------
const primeira = createPlayerSession(CLASSE, {
  id: "p1",
  name: NOME,
  donoKey: "ciclo",
});

jogo.engine.addPlayer(primeira, { mapId: "map_1" });
jogo.engine.focusPlayer("p1");
jogo.engine.applyEquipment();

jogo.iniciarFarmOffline(primeira);

console.log("\n1. apos ligar o farm");

confere(primeira.farmOffline.ativo === true, "o farm esta ligado");
confere(
  primeira.farmOffline.ultimoEm === agora,
  "o relogio e o instante da decisao",
);
confere(
  primeira.farmOffline.relatorio === null,
  "ninguem foi farmado ainda",
);

// --- 2. SAI DEPOIS DE 3 HORAS ------------------------------------------
agora += 3 * HORA;

const salvoDepoisDoFarm = snapshotSession(primeira);

jogo.engine.removePlayer("p1");

console.log("\n2. apos 3 horas longe");

confere(
  salvoDepoisDoFarm.farmOffline.ativo === true,
  "o save saiu com o farm ligado",
);

// --- 3. VOLTA: o accrue roda antes do primeiro pacote --------------------
const segunda = novaEntrada(salvoDepoisDoFarm, "p2");

jogo.engine.withPlayer("p2", () => jogo.resolverFarmOffline(segunda));

console.log("\n3. na volta, com o accrue");

confere(
  segunda.farmOffline.ativo === false,
  "o farm se desligou ao ser pago",
);
confere(
  (segunda.farmOffline.relatorio?.abates ?? 0) > 0,
  "o relatorio tem abates",
);
confere(
  (segunda.farmOffline.relatorio?.xp ?? 0) > 0,
  "o relatorio tem xp",
);

// --- 4. O JOGADOR FECHA O MODAL ----------------------------------------
const visto = jogo.farmOfflineVisto(segunda);

console.log("\n4. depois de fechar o modal");

confere(visto === true, "o servidor aceitou o 'ja vi'");
confere(
  segunda.farmOffline.relatorio === null,
  "a sessao nao tem mais relatorio",
);

jogo.engine.removePlayer("p2");

// --- 5. A SEGUNDA ENTRADA NAO DEVE ABRIR O MODAL DE NOVO --------------
const salvoDepoisDoVisto = jogo.saves.carregar(NOME);

const terceira = novaEntrada(salvoDepoisDoVisto, "p3");

jogo.engine.withPlayer("p3", () => jogo.resolverFarmOffline(terceira));

console.log("\n5. na entrada seguinte");

confere(
  terceira.farmOffline.relatorio === null,
  "NENHUM relatorio: o modal nao abre de novo",
);
confere(
  terceira.farmOffline.ativo === false,
  "e o farm continua desligado",
);

// --- 6. LIGAR DE NOVO CONTINUA FUNCIONANDO ------------------------------
// O relogio anda DEPOIS de ligar: e o tempo entre a decisao e a volta que
// o farm mede. Ligar e resolver no mesmo instante daria zero abates, e
// isso seria o comportamento certo — nao um defeito
jogo.iniciarFarmOffline(terceira);

agora += 2 * HORA;

const quarta = novaEntrada(snapshotSession(terceira), "p4");

jogo.engine.withPlayer("p4", () => jogo.resolverFarmOffline(quarta));

console.log("\n6. ligando de novo");

confere(
  (quarta.farmOffline.relatorio?.abates ?? 0) > 0,
  "um farm novo paga de novo",
);

jogo.engine.removePlayer("p4");

console.log(
  falhas === 0
    ? "\n  o ciclo inteiro passou\n"
    : `\n  ${falhas} verificacao(oes) falharam\n`,
);

process.exit(falhas === 0 ? 0 : 1);