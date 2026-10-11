/**
 * CONFERE A ABERTURA: o primeiro golpe quando o jogador entra na range.
 *
 * O caso pedido e "primeiro ataque quando o player chega na range". A
 * palavra CHAVE aqui e "chega": a abertura tem de disparar na BORDA, e nao
 * em "esta dentro". Se disparasse em "esta dentro", ela sairia no primeiro
 * quadro em que a IA roda — com o jogador longe — e o golpe seria gasto no ar
 */
import { EnemyAI } from "../src/game/enemies/EnemyAI.js";
import { MAP_TESTE, MAP_1_CENTRO } from "../src/data/maps/index.js";
import { createCreature } from "../src/data/enemies/index.js";

const HOME = MAP_1_CENTRO;

function aiDeTeste(jogadores) {
  const execucoes = [];
  const ai = new EnemyAI({
    player: null,
    players: new Map(),
    enemies: [],
    map: MAP_TESTE,
    time: 0,
    telegraphs: execucoes,
    collision: {
      isPositionFree: () => true,
      moveEntity: (e, dx, dy) => { e.x += dx; e.y += dy; return true; },
    },
  });
  ai.nearestPlayer = () => jogadores[0] ?? null;
  ai.world.onIniciarTelegraph = (inimigo, habilidade, agora, alvo) => {
    execucoes.push({
      exec: {
        inimigoId: inimigo.id,
        habilidadeId: habilidade.id,
        tipo: habilidade.tipo,
        x: inimigo.x,
        y: inimigo.y,
        raio: habilidade.raio,
        duracao: habilidade.preparo,
        impactoEm: agora + habilidade.preparo,
        inicioEm: agora,
      },
    });
    return execucoes[execucoes.length - 1].exec;
  };
  return { ai, execucoes };
}

function chefe() {
  return createCreature("hulk_val", { x: HOME.x, y: HOME.y }, 9000, null);
}

let passou = 0, falhou = 0;
const chk = (r, d = "") => {
  if (r) passou += 1; else falhou += 1;
  console.log(`  [${r ? "ok" : "FALHOU"}] ${r}${d ? "  — " + d : ""}`);
};

console.log("\n=== 1. jogador longe: NENHUM golpe ===");
{
  const c = chefe();
  // o `updateBehavior` so chama a IA quando o jogador esta no ACTIVE_RANGE do
  // motor; aqui forcamos o caminho direto com um jogador longe, que e o caso
  // que importa: nenhum golpe sai
  const j = { id: "j", x: HOME.x + 2000, y: HOME.y, hp: 100 };
  const { ai, execucoes } = aiDeTeste([j]);

  for (let i = 0; i < 60; i += 1) ai.updateBehavior(c, 1 / 60);

  chk(execucoes.length === 0, `${execucoes.length} golpes`);
}

console.log("\n=== 2. o jogador CRUZA a range: a abertura sai ===");
{
  const c = chefe();
  const j = { id: "j", x: HOME.x + 2000, y: HOME.y, hp: 100 };
  const { ai, execucoes } = aiDeTeste([j]);

  // o jogador chega na range (aggro do chefe = 620)
  j.x = HOME.x + 600;
  ai.updateBehavior(c, 1 / 60);

  // o `onIniciarTelegraph` do teste devolve o `exec` — o `habilidadeId`
  // esta dentro dele
  const golpe = execucoes[0];

  chk(execucoes.length === 1, `${execucoes.length} golpes`);
  chk(golpe?.exec?.habilidadeId === "abertura",
    `foi "${golpe?.exec?.habilidadeId}"`);
  chk(golpe?.exec?.tipo === "circle", `tipo "${golpe?.exec?.tipo}"`);
  chk(golpe?.exec?.raio === 300, `raio ${golpe?.exec?.raio}`);
}

console.log("\n=== 3. ela sai NO QUADRO da entrada, sem atraso ===");
{
  const c = chefe();
  const j = { id: "j", x: HOME.x + 2000, y: HOME.y, hp: 100 };
  const { ai, execucoes } = aiDeTeste([j]);

  j.x = HOME.x + 600;
  ai.updateBehavior(c, 1 / 60);

  const golpe = execucoes[0]?.exec;
  chk(golpe && golpe.inicioEm === ai.world.time,
    "nasce no mesmo quadro da entrada");
}

console.log("\n=== 4. nao repete enquanto o jogador fica dentro ===");
{
  const c = chefe();
  const j = { id: "j", x: HOME.x + 2000, y: HOME.y, hp: 100 };
  const { ai, execucoes } = aiDeTeste([j]);

  j.x = HOME.x + 600;
  for (let i = 0; i < 300; i += 1) {
    // a execucao termina a cada 1.2s: libera a trava como o motor faz
    if (execucoes.length) execucoes.length = 0;
    c.telegraphAtivo = false;
    ai.world.time += 1 / 60;
    ai.updateBehavior(c, 1 / 60);
  }

  const aberturas = execucoes.filter((e) => e.exec.habilidadeId === "abertura");
  chk(aberturas.length === 0,
    `${aberturas.length} repetidas — a trava de uma vez so funcionou`);
  chk(c.aberturaFeita === true, "aberturaFeita marcada");
}

console.log("\n=== 5. sair e voltar NAO abre uma segunda abertura ===");
{
  const c = chefe();
  const j = { id: "j", x: HOME.x + 2000, y: HOME.y, hp: 100 };
  const { ai, execucoes } = aiDeTeste([j]);

  // primeira entrada
  j.x = HOME.x + 600;
  ai.updateBehavior(c, 1 / 60);
  const primeira = execucoes.length;

  // o jogador sai de perto
  c.telegraphAtivo = false;
  execucoes.length = 0;
  j.x = HOME.x + 3000;
  for (let i = 0; i < 30; i += 1) ai.updateBehavior(c, 1 / 60);

  // e volta
  j.x = HOME.x + 600;
  ai.updateBehavior(c, 1 / 60);

  chk(primeira === 1, `primeira entrada deu ${primeira}`);
  chk(
    execucoes.every((e) => e.exec.habilidadeId !== "abertura"),
    "a volta nao repetiu a abertura",
  );
}

console.log("\n=== 6. o golpe seguinte usa a escolha normal ===");
{
  const c = chefe();
  const j = { id: "j", x: HOME.x + 2000, y: HOME.y, hp: 100 };
  const { ai, execucoes } = aiDeTeste([j]);

  // primeira: abertura
  j.x = HOME.x + 600;
  ai.updateBehavior(c, 1 / 60);
  const primeira = execucoes[0]?.exec?.habilidadeId;

  // libera e segue: agora deve sair a de maior area
  execucoes.length = 0;
  c.telegraphAtivo = false;
  ai.world.time += 20;
  ai.updateBehavior(c, 1 / 60);
  const segunda = execucoes[0]?.exec?.habilidadeId;

  chk(primeira === "abertura", `1a: ${primeira}`);
  chk(segunda && segunda !== "abertura", `2a: ${segunda}`);
}

console.log("\n=== 7. mob comum NAO tem abertura ===");
{
  const { CREATURE_TYPES } = await import("../src/data/enemies/index.js");
  const comum = createCreature("ogre", { x: 0, y: 0 }, 1, null);

  chk(comum.habilidadesTelegraph === undefined,
    "ogre nao declara habilidadesTelegraph");
  chk(
    !Object.values(CREATURE_TYPES).some((c) =>
      c.registroHabilidades && !c.habilidadesTelegraph),
    "ninguem tem registro sem ligar a flag",
  );
}

console.log(`\n=== RESULTADO: ${passou} ok, ${falhou} falharam ===`);
if (falhou > 0) process.exitCode = 1;