/**
 * CONFERE O TRAVAMENTO NO LIMITE.
 *
 * O sintoma reportado era: o chefe segue o jogador ate a borda do mapa e
 * ali fica batendo nele, travado, sem nunca voltar para casa.
 *
 * A causa eram DUAS coisas, e nenhuma delas aparece num teste de um quadro:
 *
 * 1. a checagem da `leash` vivia DEPOIS do `if` de golpe, que tem `return`
 *    dentro â€” entao com o jogador no alcance o chefe saia antes dela
 * 2. a `leash` fazia `alerted = false`, mas o `isAggressive` comeca por
 *    `if (alerted || provoked)` e o jogador continuava na `aggroRange`, entao
 *    o chefe reacendia o alerta no quadro seguinte
 *
 * O segundo so aparece rodando VARIOS quadros seguidos com o mesmo jogador.
 * Por isso este teste simula 120 quadros e conta quantas vezes o chefe
 * voltou a perseguir depois de ja ter decidido voltar
 */
import { EnemyAI } from "../src/game/enemies/EnemyAI.js";
import { MAP_TESTE, MAP_1_CENTRO } from "../src/data/maps/index.js";
import { createCreature } from "../src/data/enemies/index.js";

const HOME = MAP_1_CENTRO;

function aiDeTeste(jogadores) {
  const ai = new EnemyAI({
    player: null,
    players: new Map(),
    enemies: [],
    map: MAP_TESTE,
    collision: {
      isPositionFree: () => true,
      moveEntity: (e, dx, dy) => { e.x += dx; e.y += dy; return true; },
    },
  });
  ai.nearestPlayer = () => jogadores[0] ?? null;
  return ai;
}

/** o jogador andando para fora do mapa, sempre colado no chefe */
function chefeNoLimite(distInicial) {
  /**
   * O CHEFE NASCE EM CASA e so depois e ARRASTADO.
   *
   * A primeira versao deste script fazia o contrario â€” criava o chefe em
   * `HOME + dist` e depois sobrescrevia so o `x`. Como o `createCreature`
   * grava `spawnX/spawnY` na posicao que recebe, o `spawnX` acabava IGUAL ao
   * `x`: a distancia de casa era zero, a `leash` nunca comparava e o teste
   * rodava inteiro sem exercitar a regra
   *
   * O jeito de simular um chefe arrastado e nascer em casa e mover so o `x/y`
   */
  const c = createCreature("hulk_val", { x: HOME.x, y: HOME.y }, 9000, null);
  c.x = HOME.x + distInicial;
  c.y = HOME.y;
  c.alerted = true;
  return c;
}

function simularQuadros({ quadros = 120, jogadorSegue = true, distInicial = 2600 }) {
  const c = chefeNoLimite(distInicial);

  // o jogador comeca colado no chefe e, se `jogadorSegue` for false, fica
  // la parado enquanto o chefe volta sozinho
  const jogador = { x: c.x + 200, y: c.y, hp: 500 };
  const ai = aiDeTeste([jogador]);

  const estados = [];
  let quadrosPerseguindoDepoisDeVoltar = 0;
  let jaDecidiuVoltar = false;

  for (let i = 0; i < quadros; i += 1) {
    // o jogador vai embora junto com o chefe, colado
    if (jogadorSegue) {
      jogador.x = c.x + 200;
      jogador.y = c.y;
    }

    ai.updateBehavior(c, 1 / 60);
    estados.push(c.aiState);

    if (c.retreating) jaDecidiuVoltar = true;
    if (jaDecidiuVoltar && c.aiState === "chase") {
      quadrosPerseguindoDepoisDeVoltar += 1;
    }
  }

  const distanciaFinal = Math.hypot(c.x - HOME.x, c.y - HOME.y);
  return {
    distanciaFinal,
    estadoFinal: c.aiState,
    retreating: c.retreating,
    quadrosPerseguindoDepoisDeVoltar,
    estadosUnicos: [...new Set(estados)],
    passosParaCasa: estados.filter((e) => e === "return").length,
  };
}

console.log("=== cenario 1: chefe no limite, jogador COLADO nele ===");
{
  // o jogador FICA PARADO longe depois de encostar, para o teste medir a
  // volta em vez de medir o chefe arrastado junto com o alvo
  const r = simularQuadros({ quadros: 60 * 20, jogadorSegue: false });
  console.log(`  distancia final do spawn: ${r.distanciaFinal.toFixed(0)}px (era 2600)`);
  console.log(`  estado final: "${r.estadoFinal}"`);
  console.log(`  retreating no fim: ${r.retreating}`);
  console.log(`  voltou para casa? ${r.distanciaFinal < 30 ? "SIM" : "NAO"}`);
  console.log(`  >>> voltou a perseguir DEPOIS de decidir voltar? ${r.quadrosPerseguindoDepoisDeVoltar} quadros`);
}

console.log("\n=== cenario 2: jogador FICA PARADO perto do limite ===");
{
  const c = chefeNoLimite(2600);
  const jogador = { x: c.x + 200, y: c.y, hp: 500 };
  const ai = aiDeTeste([jogador]);

  let voltouACorrender = 0;
  let jaDecidiuVoltar = false;
  for (let i = 0; i < 120; i += 1) {
    ai.updateBehavior(c, 1 / 60);
    if (c.retreating) jaDecidiuVoltar = true;
    if (jaDecidiuVoltar && (c.aiState === "chase" || c.aiState === "attack")) voltouACorrender += 1;
  }
  console.log(`  distancia final: ${Math.hypot(c.x - HOME.x, c.y - HOME.y).toFixed(0)}px`);
  console.log(`  >>> quadros voltou a perseguir/atacar depois de decidir voltar: ${voltouACorrender}`);
}

console.log("\n=== cenario 3: o golpe ainda funciona perto de casa? ===");
{
  // dentro do leash, longe do jogador: tem que perseguir normal
  const c = chefeNoLimite(300);
  const jogador = { x: c.x + 300, y: c.y, hp: 500 };
  const ai = aiDeTeste([jogador]);
  ai.updateBehavior(c, 1 / 60);
  console.log(`  dentro do leash, jogador a 300px -> estado "${c.aiState}"`);
  console.log(`  persegue normalmente? ${["chase", "attack", "retreat"].includes(c.aiState) ? "SIM" : "NAO (bug)"}`);
  console.log(`  retreating? ${c.retreating} (tem de ser false)`);
}

console.log("\n=== cenario 4: perto de casa, o chefe volta a reagir? ===");
{
  const c = chefeNoLimite(2600);
  const jogador = { x: c.x + 200, y: c.y, hp: 500 };
  const ai = aiDeTeste([jogador]);

// roda ate o chefe sair do `retreating` (chegar ao posto)
    for (let i = 0; i < 4000 && c.retreating; i += 1) {
      jogador.x = c.x + 200;
      jogador.y = c.y;
      ai.updateBehavior(c, 1 / 60);
    }
    console.log(`  chegou a ${Math.hypot(c.x - HOME.x, c.y - HOME.y).toFixed(0)}px do spawn`);
  console.log(`  retreating aberto? ${c.retreating === false ? "SIM, a trava abriu" : "NAO, continua travado"}`);
  // agora o jogador chega perto: tem de reagir
  jogador.x = c.x + 100;
  jogador.y = c.y;
  c.alerted = false;
  ai.updateBehavior(c, 1 / 60);
  console.log(`  com o jogador chegando perto -> estado "${c.aiState}"`);
  console.log(`  volta a reagir depois de chegar em casa? ${c.aiState !== "idle" ? "SIM" : "NAO (travou no idle)"}`);
}
