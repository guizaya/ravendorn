/**
 * O QUE O MOTOR CUSTA POR JOGADOR, E NAO SO NO TOTAL.
 *
 * ## POR QUE ISTO E A PERGUNTA CERTA PARA O ITEM 1
 *
 * Porque o motor roda a simulacao INTEIRA uma vez por jogador: o
 * `updateEnemies`, o `skillSystem.update` e o `updateFlechasHostis` rodam
 * dentro de um `withPlayer` para cada pessoa online. Com um jogador isso e
 * invisivel; com cem, e o mesmo mapa simulado cem vezes
 *
 * ## E POR QUE ISTO NAO E O `conferir-custo-tick`
 *
 * Porque aquele mede UM jogador. Este mede a curva: 1, 2, 4, 8... A
 * pergunta nao e "quanto custa um tick", e "o custo cresce linearmente ou
 * pior que isso"
 */

import { GameEngine } from "../src/game/engine/GameEngine.js";
import { registrarTilesDoDisco } from "../server/src/maps/tilesDoDisco.js";
import { createPlayerSession } from "../src/game/engine/PlayerSession.js";
import { CHARACTER_CLASSES } from "../src/data/characters/index.js";
import { getMap } from "../src/data/maps/index.js";

registrarTilesDoDisco();

const DELTA = 1 / 20;

/**
 * UM MOTOR COM N JOGADORES DE VERDADE.
 *
 * ## POR QUE ISTO USA `addPlayer` E NAO `createPlayerSession` no motor
 *
 * Porque `createPlayerSession` nao existe no motor: ele cria a sessao, e o
 * `addPlayer` e que a INSERE em `world.players`, que e a lista que o
 * `update` percorre
 *
 * A primeira versao deste arquivo chamava um metodo que nao existe. O
 * `createPlayerSession?.(...)` com optional chaining nao lanceu erro — apenas
 * nao fez nada, e o medidor reportou 64 jogadores custando MENOS que 1. O
 * sintoma de um medidor que mede o errado e um numero que faz sentido demais
 */
/**
 * A ASSINATURA DE `createPlayerSession` E `(classDefinition, options)`.
 *
 * A primeira versao passava o objeto como primeiro argumento, e o erro
 * apareceu como `Cannot read properties of undefined (reading 'hp')` — o
 * motor leu `classDefinition` de dentro do objeto de opcoes e nao achou
 *
 * ## E POR QUE O SPAWN E PASSADO EXPLICITAMENTE
 *
 * Porque o padrao do `createPlayerSession` e `(1200, 800)`, que fica FORA
 * do mapa 1 — o vale vai de 0 a 6016 por 4224, mas o ponto esta num canto
 * vazio. O `addPlayer` nao teleporta ninguem para o spawn do mapa: ele so
 * registra a sessao
 *
 * Sem isto, a sessao nasce fora, o `withPlayer` aponta o mundo para o
 * mapa dela, e o jogador fica preso num lugar onde nao ha nem colisor nem
 * inimigo — e o medidor acusa "ninguem andou" com o motor funcionando
 */
function criarCom(nJogadores) {
  const motor = new GameEngine(null, CHARACTER_CLASSES[0], null, {
    playerId: "p0",
  });

  const mapa = getMap("map_1");

  motor.setMap(mapa);

  /**
   * CADA JOGADOR NASCE LONGE DO OUTRO.
   *
   * Todos no mesmo ponto iam se empurrar no primeiro tick, e o medidor
   * mediria um mundo de um jogador so, com os outros presos uns nos outros
   */
  for (let i = 1; i < nJogadores; i++) {
    const sessao = createPlayerSession(CHARACTER_CLASSES[0], {
      id: "p" + i,
      name: "Jogador " + i,
      spawn: {
        x: mapa.spawn.x + (i % 8) * 48,
        y: mapa.spawn.y + Math.floor(i / 8) * 48,
      },
    });

    motor.addPlayer(sessao, { mapId: mapa.id });
  }

  return motor;
}

/**
 * FAZ TODO JOGADOR ANDAR PARA A DIREITA E PARA BAIXO.
 *
 * E separado do `medir` porque a checagem de movimento precisa das teclas
 * ANTES de rodar o primeiro tick. Com as teclas dentro do `medir`, a
 * checagem rodava com o mundo ainda parado e acusava "ninguem andou" com o
 * motor funcionando
 */
function mandarAndar(motor) {
  for (const id of motor.world.players.keys()) {
    motor.withPlayer(id, () => {
      motor.world.session.input.keys = new Set(["KeyD", "KeyS"]);
    });
  }
}

function medir(motor, voltas) {
  /**
   * COM OS JOGADORES ANDANDO, E NAO PARADOS.
   *
   * Parado, o `updatePlayer` sai antes da colisao, do `moveEntity` e de
   * quase todo o resto — e o motor mede 0.84ms com um jogador, sendo que o
   * caso real de um servidor e gente jogando. Medindo parado, a curva
   * parece tao plana que o medidor quase accentua o trabalho quadratico
   */
  mandarAndar(motor);

  motor.update(DELTA);

  const t0 = process.hrtime.bigint();

  for (let i = 0; i < voltas; i++) motor.update(DELTA);

  return Number(process.hrtime.bigint() - t0) / 1e6 / voltas;
}

/**
 * OS JOGADORES ANDARAM MESMO?
 *
 * ## POR QUE ISTO PRECISA EXISTIR
 *
 * Porque um medidor que "cria N jogadores" pode estar medindo N jogadores
 * que nao se mexem, e o numero sai plano e bonito. A primeira versao deste
 * arquivo reportou 64 jogadores por MENOS que 1: o `createPlayerSession`
 * que ela chamava nao existe no motor, o optional chaining nao lancou
 * erro, e nenhum jogador foi inserido
 *
 * ## E POR QUE DOZE TICKS, E NAO UM
 *
 * Porque o jogador tem aceleracao: ele sai do zero e chega na velocidade
 * cheia em alguns ticks. Medindo um tick so, o deslocamento e de menos de
 * 1px e o medidor acusa "ninguem andou" com o motor funcionando
 * perfeitamente. Doze ticks dao 58px, que nao tem como ser jitter
 */
function andaramTodos(motor) {
  mandarAndar(motor);

  const antes = new Map(
    [...motor.world.players.values()].map((s) => [s.id, { x: s.player.x, y: s.player.y }]),
  );

  for (let i = 0; i < 12; i++) motor.update(DELTA);

  for (const s of motor.world.players.values()) {
    const a = antes.get(s.id);

    if (Math.abs(s.player.x - a.x) < 4 && Math.abs(s.player.y - a.y) < 4) return false;
  }

  return true;
}

console.log("\n  O CUSTO DE UM TICK CONFORME O NUMERO DE JOGADORES\n");
console.log("  jogadores   ms por tick   por jogador   crescimento");

const ORCAMENTO = 50;

let anterior = null;

const pontos = [];

for (const n of [1, 2, 4, 8, 16, 32, 64]) {
  const motor = criarCom(n);

  /**
   * A CONFERENCIA QUE O MEDIDOR FAZ DELE MESMO.
   *
   * Sem isto o arquivo aceita um numero e um metodo que nao existe, e reporta
   * uma curva de custo que nao aconteceu
   */
  const real = motor.world.players.size;

  if (real !== n) {
    console.log(`  ERRO: pedi ${n} jogadores, o mundo tem ${real}. a medicao abaixo e FALSA`);

    process.exit(1);
  }

  /**
   * O MOVIMENTO E CHECADO ANTES DO TEMPO, E NAO DEPOIS.
   *
   * Porque quem mede o tempo roda 200 updates, e o jogador sai andando para
   * a direita ate bater numa parede — no tick 29 ele trava no X e so o Y
   * anda. Checando depois, o jogador esta encostado na parede e o medidor
   * acusa "parado" com o motor funcionando
   *
   * A ordem correta e: confirma que o mundo esta andando, DEPOIS mede
   */
  if (!andaramTodos(motor)) {
    console.log(`  ERRO: com ${n} jogadores, alguem nao andou. a medicao abaixo e FALSA`);

    process.exit(1);
  }

  const ms = medir(motor, n > 16 ? 60 : 200);

  const porJogador = ms / n;
  const crescimento = anterior ? (porJogador / anterior - 1) * 100 : 0;

  console.log(
    "  " + String(n).padStart(8) + "   " +
    ms.toFixed(3).padStart(9) + "   " +
    porJogador.toFixed(3).padStart(11) + "   " +
    (anterior ? (crescimento >= 0 ? "+" : "") + crescimento.toFixed(0) + "%" : "base").padStart(10),
  );

  pontos.push({ n, ms });
  anterior = porJogador;
}

console.log("\n  ONDE ESTOURA O ORCAMENTO DE " + ORCAMENTO + "ms\n");

const ultimo = pontos[pontos.length - 1];
const porJogador = ultimo.ms / ultimo.n;

const limite = Math.floor(ORCAMENTO / porJogador);

console.log("  o custo por jogador se mantem em " + porJogador.toFixed(3) + "ms");
console.log("  o orcamento de " + ORCAMENTO + "ms aguenta " + limite + " jogadores\n");

/**
 * A LEITURA QUE IMPORTA
 *
 * Se o custo por jogador for constante, o motor e O(N) e da para aguentar
 * muita gente. Se ele CRESCE, ha um quadrado escondido — um `find` dentro
 * de outro `find`, ou um `Map` reordenado a cada jogador
 */
const primeiro = pontos[0];
const ultimoN = pontos[pontos.length - 1];

const porJogadorInicio = primeiro.ms / primeiro.n;
const porJogadorFim = ultimoN.ms / ultimoN.n;

const quicao = porJogadorFim / porJogadorInicio;

console.log("  QUADRADO ESCONDIDO?\n");
console.log("  custo por jogador no inicio: " + porJogadorInicio.toFixed(4) + "ms");
console.log("  custo por jogador no fim:    " + porJogadorFim.toFixed(4) + "ms");
console.log("  razao: " + quicao.toFixed(2) + "x");
console.log("  " + (quicao > 1.5
  ? "CRESCE — ha trabalho quadratico por jogador"
  : "constante — o motor e linear") + "\n");