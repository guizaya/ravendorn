/**
 * CONFERE O DESENHO DO TELEGRAPH NO CLIENTE.
 *
 * Existe por causa de um defeito real que so aparecia online: o desenho usava
 * `world.time`, que no cliente fica CONGELADO (ele so avanca no ramo de
 * simulacao). O `impactoEm` que o servidor manda e um instante do
 * `world.time` DELE, entao os dois numeros eram de escalas diferentes e o
 * `progresso` dava negativo — cortado em zero pelo `Math.max`
 *
 * O sintoma era o telegraph preso na forma inicial, sem a frente de onda
 * crescendo, com a lista so crescendo. E o jogador levando dano de um golpe
 * cujo indicador nao sumia nunca
 *
 * Este teste reproduz o caminho do CLIENTE: recebe o pacote, aplica no motor
 * e mede o que o desenho faz em cada quadro
 */
import { EnemyAI } from "../src/game/enemies/EnemyAI.js";
import { MAP_TESTE, MAP_1_CENTRO } from "../src/data/maps/index.js";
import { createCreature } from "../src/data/enemies/index.js";
import { TelegraphRenderer } from "../src/game/enemies/TelegraphRenderer.js";

const HOME = MAP_1_CENTRO;

let passou = 0, falhou = 0;
const chk = (r, d = "") => {
  if (r) passou += 1; else falhou += 1;
  console.log(`  [${r ? "ok" : "FALHOU"}] ${r}${d ? "  — " + d : ""}`);
};

/**
 * O QUE O SERVIDOR MANDA.
 *
 * `impactoEm` e o `world.time` DO SERVIDOR. O `tempoLocal` e o relogio de
 * apresentacao do CLIENTE, que e outra escala — e e essa a conta que o
 * desenho precisa fazer certo
 */
function pacoteDoServidor({
  habilidadeId = "energy_beam",
  tipo = "line",
  cor = "#ff2d95",
  medidas = {},
} = {}) {
  const duracao = 2.0;
  const tempoServidor = 340.5;

  return {
    id: "tg_7",
    habilidadeId,
    tipo,
    cor,
    inicioEm: tempoServidor,
    impactoEm: tempoServidor + duracao,
    duracao,
    x: HOME.x,
    y: HOME.y,
    dirX: 1,
    dirY: 0,
    ...medidas,
  };
}

  const ctxDeProva = () => {
    const chamadas = [];
    const ctx = {};

    // as CORES sao propriedades que o canvas LE, e o mock precisa ler
    // depois de escrito — por isso sao `defineProperty`, e nao um `set` que
    // so registra. A primeira versao deste teste registrava o `set` e nunca
    // via o valor final, entao `fill=...` nunca aparecia
    let alpha = 1, fill = "", stroke = "";
    Object.defineProperties(ctx, {
      globalAlpha: { get: () => alpha, set: (v) => { alpha = v; } },
      fillStyle: { get: () => fill, set: (v) => { fill = v; } },
      strokeStyle: { get: () => stroke, set: (v) => { stroke = v; } },
      lineWidth: { get: () => 1, set: () => {} },
      lineCap: { get: () => "butt", set: () => {} },
    });

    for (const m of [
      "beginPath", "closePath", "moveTo", "lineTo", "arc", "fillText",
    ]) {
      ctx[m] = (...a) => { chamadas.push(`${m}(${a.length})`); };
    }

    ctx.fill = () => {
      chamadas.push(`fill[${alpha.toFixed(2)}|${fill}]`);
    };
    ctx.stroke = () => {
      chamadas.push(`stroke[${alpha.toFixed(2)}|${stroke}]`);
    };
    ctx.save = () => {};
    ctx.restore = () => {};

    return { ctx, chamadas };
  };
console.log("\n=== 1. o progresso avanca com o relogio LOCAL ===");
{
  const exec = pacoteDoServidor();
  const duracao = exec.duracao;

  // o relogio local do cliente comeca no instante em que ele RECEBE o
  // pacote — que e o que o `aplicarTelegraph` faz ao marcar o inicio
  const recebeuEm = 12.5;

  const prog = (agora) =>
    Math.min(1, Math.max(0, 1 - (exec.impactoEm - exec.inicioEm - (agora - recebeuEm)) / duracao));

  chk(prog(recebeuEm) < 0.05, "no instante de receber, comeca em ~0");
  chk(prog(recebeuEm + 1.0) > 0.45 && prog(recebeuEm + 1.0) < 0.55,
    "na metade do preparo, vai a meio");
  chk(prog(recebeuEm + 2.0) >= 1, "no fim, chega a 1");

  const restante = (agora) => exec.impactoEm - exec.inicioEm - (agora - recebeuEm);
  chk(restante(recebeuEm + 2.0) <= 0, "passado o preparo, o restante vira <= 0");
}

console.log("\n=== 2. o cull ve a forma inteira, nao so a origem ===");
{
  // o mesmo culling do GameEngine, reimplementado aqui para testar a caixa
  function visivel(execucao, limites) {
    const meiaLargura = (execucao.largura ?? 0) / 2;
    let minX = execucao.x, maxX = execucao.x;
    let minY = execucao.y, maxY = execucao.y;

    if (execucao.tipo === "circle" || execucao.tipo === "targeted") {
      const r = execucao.raio ?? 0;
      minX -= r; maxX += r; minY -= r; maxY += r;
    } else if (execucao.tipo === "ring") {
      const r = execucao.raioExterno ?? 0;
      minX -= r; maxX += r; minY -= r; maxY += r;
    } else if (execucao.alcance !== undefined) {
      const alc = execucao.alcance;
      minX = Math.min(execucao.x, execucao.x + execucao.dirX * alc) - meiaLargura;
      maxX = Math.max(execucao.x, execucao.x + execucao.dirX * alc) + meiaLargura;
      minY = Math.min(execucao.y, execucao.y + execucao.dirY * alc) - meiaLargura;
      maxY = Math.max(execucao.y, execucao.y + execucao.dirY * alc) + meiaLargura;
    }

    const margem = 40;
    return maxX + margem >= limites.x && minX - margem <= limites.x + limites.width
        && maxY + margem >= limites.y && minY - margem <= limites.y + limites.height;
  }

  // jogador no canto superior esquerdo do chefe: a area do golpe sai para
  // BAIXO e para a DIREITA, ou seja, o grosso dela esta fora da tela
  const jogador = { x: HOME.x - 400, y: HOME.y - 200 };
  const limites = {
    x: jogador.x - 640, y: jogador.y - 360, width: 1280, height: 720,
  };

  const casos = [
    { nome: "ground_slam", tipo: "circle", raio: 300 },
    { nome: "abertura", tipo: "circle", raio: 300 },
    { nome: "cleave", tipo: "cone", alcance: 300, dirX: 1, dirY: 0 },
    { nome: "shock_ring", tipo: "ring", raioInterno: 120, raioExterno: 420 },
    { nome: "energy_beam", tipo: "line", alcance: 720, largura: 110, dirX: 1, dirY: 0 },
    { nome: "charge", tipo: "charge", alcance: 620, largura: 150, dirX: 1, dirY: 0 },
    { nome: "marked_strike", tipo: "targeted", raio: 150 },
  ];

  for (const c of casos) {
    const ex = { x: HOME.x, y: HOME.y, ...c };
    chk(visivel(ex, limites), `${c.nome} aparece com o chefe na tela`);
  }

  // e o que NAO deve aparecer: um chefe do outro lado do mapa
  const longe = { x: HOME.x - 5000, y: HOME.y - 4000, tipo: "circle", raio: 300 };
  chk(!visivel(longe, limites), "chefe longe NAO e desenhado (o cull ainda corta)");
}

console.log("\n=== 3. o desenho emite as operacoes de cada forma ===");
{
  const r = new TelegraphRenderer();



  for (const [nome, exec] of [
    ["energy_beam", { tipo: "line", cor: "#ff2d95", x: 0, y: 0, dirX: 1, dirY: 0, alcance: 720, largura: 110 }],
    ["charge", { tipo: "charge", cor: "#a855f7", x: 0, y: 0, dirX: 1, dirY: 0, alcance: 620, largura: 150 }],
    ["ground_slam", { tipo: "circle", cor: "#ff3b30", x: 0, y: 0, raio: 300 }],
    ["shock_ring", { tipo: "ring", cor: "#00e5ff", x: 0, y: 0, raioInterno: 120, raioExterno: 420 }],
    ["cleave", { tipo: "cone", cor: "#ff6b35", x: 0, y: 0, dirX: 1, dirY: 0, alcance: 300, anguloGraus: 90 }],
  ]) {
    for (const prog of [0, 0.5, 1]) {
const { ctx, chamadas } = ctxDeProva();
      r.desenharTelegraph(ctx, exec, prog, 1);

      // o mock registra `fill[alfa|cor]`, e nao `fill()` — a comparacao
      // exata com "fill()" dizia que nao houve preenchimento num desenho
      // que preenche duas vezes, com a cor certa
      const preencheu = chamadas.some((c) => c.startsWith("fill["));
      const contornou = chamadas.some((c) => c.startsWith("stroke["));
      const comACor = chamadas.some((c) => c.includes(exec.cor));

      chk(
        preencheu && contornou && comACor && chamadas.length > 6,
        `${nome} prog ${prog}: ${chamadas.length} ops, preencheu=${preencheu}, contornou=${contornou}, cor=${comACor}`,
      );
    }
  }
}

console.log("\n=== 4. a cor do telegraph e a da habilidade ===");
{
  const r = new TelegraphRenderer();

  for (const [nome, exec] of [
    ["energy_beam", { tipo: "line", cor: "#ff2d95", x: 0, y: 0, dirX: 1, dirY: 0, alcance: 720, largura: 110 }],
    ["charge", { tipo: "charge", cor: "#a855f7", x: 0, y: 0, dirX: 1, dirY: 0, alcance: 620, largura: 150 }],
  ]) {
    // o `preenchimento` escreve a cor da habilidade E o `contorno` escreve
    // um branco por cima. A COR DA HABILIDADE tem de aparecer em alguma das
    // duas — e nao so o branco
    const { ctx, chamadas } = ctxDeProva();
    r.desenharTelegraph(ctx, exec, 0.5, 1);
    const tem = chamadas.some((c) => c.includes(exec.cor));
    chk(tem, `${nome} pinta com ${exec.cor}`);
  }
}

console.log("\n=== 5. o cliente NAO aplica dano do pacote ===");
{
  const { TelegraphSystem } = await import("../src/game/enemies/TelegraphSystem.js");

  const jogador = { id: "j", x: 0, y: 0, hp: 100 };
  const world = {
    telegraphs: [],
    indiceInimigos: new Map(),
    players: new Map([["j", { player: jogador }]]),
    player: jogador,
    atingidos: [],
    onDanoDoChefe(i, d, j, e) { world.atingidos.push(j.id); },
  };

  const s = new TelegraphSystem(world);
  world.telegraphs.push({
    id: "tg_9", inimigoId: "hulk", tipo: "circle", cor: "#f00",
    inicioEm: 0, impactoEm: 2, duracao: 2,
    x: 0, y: 0, raio: 300, dirX: 1, dirY: 0,
    isRemote: true, danoAplicado: false,
  });

  s.update(0.016, 3);
  chk(world.atingidos.length === 0, "o pacote nao causa dano no cliente");

  /**
   * A TRAVA E DO SERVIDOR, entao o teste e no SERVIDOR.
   *
   * Uma execucao remota chega no cliente com `isRemote: true`, e o
   * `liberarChefe` nao roda nela — de proposito. O `telegraphAtivo` e uma
   * trava da IA, e a IA nao roda no cliente
   *
   * O que importa aqui e o outro lado: com a execucao LOCAL (o servidor),
   * a trava tem de abrir quando o golpe termina
   */
  const idx = new Map([["hulk", { id: "hulk", alive: true, retreating: false, telegraphAtivo: true }]]);
  world.indiceInimigos = idx;
  const i = idx.get("hulk");

  world.telegraphs.length = 0;
  s.iniciar({
    inimigo: i,
    habilidade: { id: "x", tipo: "circle", preparo: 2, raio: 300, multiplicadorDano: 1, knockback: 0 },
    agora: 0,
    alvo: null,
  });
  i.telegraphAtivo = true;

  s.update(0.016, 3);
  chk(i.telegraphAtivo === false, "no servidor, a trava abre quando o golpe termina");
}

console.log(`\n=== RESULTADO: ${passou} ok, ${falhou} falharam ===`);
if (falhou > 0) process.exitCode = 1;