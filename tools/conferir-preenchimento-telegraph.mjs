/**
 * CONFERE O PREENCHIMENTO DO TELEGRAPH NO CLIENTE.
 *
 * Existe por causa do defeito que o jogador VIU: a area aparecia, mas a
 * frente nunca crescia e o pulso nunca rodava. O telegraph ficava igual,
 * sem nenhuma sensacao de quando o golpe comecava ou terminava
 *
 * A causa era o RELOGIO. `impactoEm` e um numero do `world.time` do
 * SERVIDOR, e o cliente conta em `spriteTime`. Sao escalas sem relacao: o
 * servidor em 340 e o cliente em 12 davam `restante: 330` num telegraph de
 * preparo 2s, e o `progresso` — `1 - 330/2` — era muito negativo, cortado
 * em zero pelo `Math.max`
 *
 * A camada base e desenhada com o progresso zero, entao o aviso aparecia
 * normalmente. So o crescimento e o pulso morriam
 */
import { TelegraphSystem } from "../src/game/enemies/TelegraphSystem.js";
import { TelegraphRenderer } from "../src/game/enemies/TelegraphRenderer.js";

let passou = 0, falhou = 0;
const chk = (r, d = "") => {
  if (r) passou += 1; else falhou += 1;
  console.log(`  [${r ? "ok" : "FALHOU"}] ${r}${d ? "  — " + d : ""}`);
};

/** O RELOGIO DO SERVIDOR, muito adiantado em relacao ao cliente */
const RELOGIO_SERVIDOR = 340.5;
const RELOGIO_CLIENTE = 12.5;

/**
 * A EXECUCAO COMO O CLIENTE RECEBE.
 *
 * Com o `deslocamento` calculado no `aplicarTelegraph`
 */
function execucaoRecebida({
  tipo = "circle",
  cor = "#ff3b30",
  duracao = 1.8,
  medidas = {},
} = {}) {
  const inicio = RELOGIO_SERVIDOR;

  return {
    id: "tg_1",
    inimigoId: "hulk_val_9000",
    tipo,
    cor,
    inicioEm: inicio,
    impactoEm: inicio + duracao,
    duracao,
    deslocamento: RELOGIO_SERVIDOR - RELOGIO_CLIENTE,
    x: 3000, y: 2100,
    dirX: 1, dirY: 0,
    isRemote: true,
    danoAplicado: false,
    ...medidas,
  };
}

/** A CONTA DO DESENHO, a mesma do GameEngine.drawTelegraphs */
function progressoEm(execucao, relogioLocal) {
  const agoraNoServidor = relogioLocal + (execucao.deslocamento ?? 0);
  const restante = execucao.impactoEm - agoraNoServidor;

  return {
    restante,
    progresso: Math.min(1, Math.max(0, 1 - restante / execucao.duracao)),
  };
}

console.log("\n=== 1. o progresso VARIA ao longo do preparo ===");
{
  const e = execucaoRecebida();

  const comecou = progressoEm(e, RELOGIO_CLIENTE);
  const meio = progressoEm(e, RELOGIO_CLIENTE + 0.9);
  const quase = progressoEm(e, RELOGIO_CLIENTE + 1.7);
  const passou = progressoEm(e, RELOGIO_CLIENTE + 2.5);

  chk(comecou.progresso < 0.05, `no inicio: ${comecou.progresso.toFixed(3)}`);
  chk(meio.progresso > 0.45 && meio.progresso < 0.55,
    `na metade: ${meio.progresso.toFixed(3)}`);
  chk(quase.progresso > 0.9, `quase no fim: ${quase.progresso.toFixed(3)}`);
  chk(passou.progresso >= 1, `passou do impacto: ${passou.progresso.toFixed(3)}`);

  chk(comecou.restante < 2.0 && quase.restante < 0.2,
    `o restante cai de ${comecou.restante.toFixed(2)}s para ${quase.restante.toFixed(2)}s`);
}

console.log("\n=== 2. a CONTA ANTIGA daria 0 (o defeito) ===");
{
  const e = execucaoRecebida();

  // a conta errada: impactoEm do servidor menos o relogio cru do cliente
  const restanteErrado = e.impactoEm - RELOGIO_CLIENTE;
  const progressoErrado = Math.min(1, Math.max(0, 1 - restanteErrado / e.duracao));

  chk(progressoErrado === 0,
    `a conta sem deslocamento daria ${progressoErrado} — por isso a area ficava parada`);

  // e a conta certa, no primeiro quadro
  const certo = progressoEm(e, RELOGIO_CLIENTE);
  chk(certo.progresso >= 0 && certo.progresso < 0.05,
    `com deslocamento, o primeiro quadro e ${certo.progresso.toFixed(3)}`);
}

console.log("\n=== 3. a frente cresce, e some no impacto ===");
{
  const r = new TelegraphRenderer();

  const medir = (exec, prog) => {
    const c = { fills: 0 };
    let alpha = 1;

    const ctx = {};
    Object.defineProperties(ctx, {
      globalAlpha: { get: () => alpha, set: () => {} },
      fillStyle: { get: () => "", set: () => {} },
      strokeStyle: { get: () => "", set: () => {} },
      lineWidth: { get: () => 1, set: () => {} },
      lineCap: { get: () => "butt", set: () => {} },
    });

    for (const m of ["beginPath", "closePath", "moveTo", "lineTo", "arc"]) {
      ctx[m] = () => {};
    }

    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.fill = () => { c.fills += 1; };
    ctx.stroke = () => {};

    r.desenharTelegraph(ctx, exec, prog, 1);

    return c.fills;
  };

  const linha = execucaoRecebida({
    tipo: "line", cor: "#ff2d95", alcance: 720, largura: 110, duracao: 2,
  });
  const circulo = execucaoRecebida({ tipo: "circle", cor: "#ff3b30", raio: 300 });
  const cone = execucaoRecebida({
    tipo: "cone", cor: "#ff6b35", alcance: 300, anguloGraus: 90,
  });

  chk(medir(linha, 0) < medir(linha, 0.5),
    `a linha ganha uma frente: ${medir(linha, 0)} -> ${medir(linha, 0.5)}`);
  chk(medir(linha, 0.5) > medir(linha, 1),
    `e a frente some no impacto: ${medir(linha, 0.5)} -> ${medir(linha, 1)}`);

  chk(medir(circulo, 0.5) === 2,
    `o circulo mantem as duas camadas: ${medir(circulo, 0.5)}`);

  chk(medir(cone, 0.5) === 2,
    `o cone mantem as duas camadas: ${medir(cone, 0.5)}`);
}

console.log("\n=== 4. o pulso so roda no meio do preparo ===");
{
  const r = new TelegraphRenderer();

  const pulsos = (exec, prog) => {
    let n = 0;

    const ctx = {};
    Object.defineProperties(ctx, {
      globalAlpha: { get: () => 1, set: () => {} },
      fillStyle: { get: () => "", set: () => {} },
      strokeStyle: { get: () => "", set: () => {} },
      lineWidth: { get: () => 1, set: () => {} },
      lineCap: { get: () => "butt", set: () => {} },
    });

    for (const m of ["beginPath", "closePath", "moveTo", "lineTo", "arc"]) {
      ctx[m] = () => {};
    }

    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.fill = () => {};
    ctx.stroke = () => { n += 1; };

    r.desenharTelegraph(ctx, exec, prog, 1);

    return n;
  };

  const circulo = execucaoRecebida({ tipo: "circle", raio: 300 });

  // o contorno sozinho sao 2 traços; o pulso acrescenta os aneis
  const noComeco = pulsos(circulo, 0);
  const noMeio = pulsos(circulo, 0.5);
  const noFim = pulsos(circulo, 0.9);

  chk(noMeio > noComeco, `o pulso entra durante o preparo: ${noComeco} -> ${noMeio}`);
  chk(noFim > noMeio, `e intensifica no fim: ${noMeio} -> ${noFim}`);
}

console.log("\n=== 5. a execucao remota SAI da lista no impacto ===");
{
  const world = {
    telegraphs: [],
    indiceInimigos: new Map(),
    players: new Map(),
    player: null,
    onDanoDoChefe: () => { world.dano = (world.dano ?? 0) + 1; },
  };

  const s = new TelegraphSystem(world);

  const e = execucaoRecebida({ raio: 300, duracao: 2 });
  world.telegraphs.push(e);

  // o update usa o mesmo relogio do desenho
  const noMeio = RELOGIO_CLIENTE + 1;
  s.update(1 / 60, noMeio);
  chk(world.telegraphs.length === 1, `no meio, a execucao continua viva (${world.telegraphs.length})`);

  // passa do impacto, no relogio local
  const depois = RELOGIO_CLIENTE + 2.5;
  s.update(1 / 60, depois);
  chk(world.telegraphs.length === 0, `passado o impacto, ela sai (${world.telegraphs.length})`);
  chk((world.dano ?? 0) === 0, "e o cliente nao aplicou dano");
}

console.log(`\n=== RESULTADO: ${passou} ok, ${falhou} falharam ===`);
if (falhou > 0) process.exitCode = 1;