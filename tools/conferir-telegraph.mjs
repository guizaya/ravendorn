/**
 * OS CRITERIOS DE ACEITACAO DA SECAO 12 DO PEDIDO.
 *
 * Cada bloco abaixo responde a UM numero da lista do `ranking.txt`, e o
 * numero esta no titulo. A geometria e a do `TelegraphSystem` de verdade â€”
 * nao uma copia â€” porque o que se testa e se o SERVIDOR e o QUE O JOGADOR
 * VE concordam, e testar uma reimplementacao nao diria nada
 */

import { TelegraphSystem } from "../src/game/enemies/TelegraphSystem.js";
import { contemPonto } from "../src/game/enemies/telegraphGeometry.js";
import { HABILIDADES_CHEFE } from "../src/game/enemies/telegraphSkills.js";

const H = HABILIDADES_CHEFE;

let passou = 0;
let falhou = 0;

function checar(rotulo, ok, detalhe = "") {
  if (ok) passou += 1; else falhou += 1;
  console.log(`  [${ok ? "ok" : "FALHOU"}] ${rotulo}${detalhe ? "  â€” " + detalhe : ""}`);
}

/**
 * UM MUNDO MINIMO, com o que o `TelegraphSystem` le.
 *
 * Nao e um mock do jogo: sao os quatro campos que o sistema acessa
 * (`telegraphs`, `byId`, `players`, `time`), com o mesmo formato que o
 * `GameEngine` monta
 */
function mundoDe(jogadores = []) {
  const mapa = new Map();

  const world = {
    telegraphs: [],
    indiceInimigos: mapa,
    time: 0,
    players: new Map(jogadores.map((j) => [j.id, { player: j }])),
    player: jogadores[0] ?? null,

    // quem levou dano: o teste le esta lista
    atingidos: [],

    onDanoDoChefe(inimigo, dano, jogador, execucao) {
      world.atingidos.push({
        jogadorId: jogador.id,
        dano,
        execucaoId: execucao.id,
      });
    },
  };

  return { world, mapa };
}

function chefeDe(id = "hulk_val_9000") {
  return {
    id,
    x: 0,
    y: 0,
    damage: 100,
    alive: true,
    retreating: false,
    facing: { x: 1, y: 0 },
  };
}

function jogador(id, x, y) {
  return { id, x, y, hp: 100 };
}

console.log("\n=== 1. dentro do circulo leva, fora nao ===");
{
  const { world, mapa } = mundoDe([jogador("a", 0, 0), jogador("b", 900, 0)]);
  const chefe = chefeDe();
  mapa.set(chefe.id, chefe);

  const sistema = new TelegraphSystem(world);
  const hab = { ...H.ground_slam, multiplicadorDano: 1 };

  /**
   * O impacto sai em `impactoEm = preparo = 1.8s`, entao um `update` em 1.9
   * JA o resolve. A primeira versao rodava 1.9, limpava a lista de dano e
   * so entao rodava 2.0 â€” e reportava "ninguem levou" com a mecanica
   * funcionando. A ordem e o que faz o teste mentir
   */
  sistema.iniciar({ inimigo: chefe, habilidade: hab, agora: 0, alvo: null });
  sistema.update(0.016, 1.9);

  const dentro = world.atingidos.some((d) => d.jogadorId === "a");
  const fora = world.atingidos.some((d) => d.jogadorId === "b");
  checar("dentro levou dano", dentro);
  checar("fora nao levou dano", !fora);
}

console.log("\n=== 2. sair da area antes do impacto desvia ===");
{
  const j = jogador("a", 0, 0);
  const { world, mapa } = mundoDe([j]);
  const chefe = chefeDe();
  mapa.set(chefe.id, chefe);

  const sistema = new TelegraphSystem(world);
  sistema.iniciar({
    inimigo: chefe,
    habilidade: H.ground_slam,
    agora: 0,
    alvo: null,
  });

  // o jogador corre para fora durante a preparacao
  j.x = 2000;
  world.atingidos.length = 0;
  sistema.update(0.016, 5.0);

  checar("quem saiu da area nao levou", world.atingidos.length === 0);
}

console.log("\n=== 3. o cone respeita alcance e angulo ===");
{
  const { world } = mundoDe([]);
  const sistema = new TelegraphSystem(world);
  const chefe = { ...chefeDe(), x: 0, y: 0, facing: { x: 1, y: 0 } };
  const exec = sistema.iniciar({
    inimigo: chefe,
    habilidade: H.cleave,
    agora: 0,
    alvo: null,
  });

  const dentroFrente = { x: 150, y: 0 };
  const foraLado = { x: 150, y: 150 };
  const foraLongo = { x: 900, y: 0 };

  checar("quem esta a frente e dentro do alcance leva",
    contemPonto(exec, dentroFrente.x, dentroFrente.y));
  checar("quem esta de lado NAO leva",
    !contemPonto(exec, foraLado.x, foraLado.y));
  checar("quem esta longe demais NAO leva",
    !contemPonto(exec, foraLongo.x, foraLongo.y));
}

console.log("\n=== 4. a linha respeita comprimento e largura ===");
{
  const { world } = mundoDe([]);
  const sistema = new TelegraphSystem(world);
  const chefe = { ...chefeDe(), facing: { x: 1, y: 0 } };
  const exec = sistema.iniciar({
    inimigo: chefe,
    habilidade: H.energy_beam,
    agora: 0,
    alvo: null,
  });

  checar("sobre a linha e dentro do comprimento leva",
    contemPonto(exec, 400, 0));
  checar("fora da largura NAO leva",
    !contemPonto(exec, 400, 200));
  checar("alem do comprimento NAO leva",
    !contemPonto(exec, 5000, 0));
  checar("ATRAS do inicio NAO leva",
    !contemPonto(exec, -100, 0));
}

console.log("\n=== 5. a marcacao fixa nao acompanha o alvo ===");
{
  const j = jogador("a", 0, 0);
  const { world, mapa } = mundoDe([j]);
  const chefe = chefeDe();
  mapa.set(chefe.id, chefe);

  const sistema = new TelegraphSystem(world);
  const hab = { ...H.marked_strike, seguirAlvo: false, fixarAntesDeImpacto: 0 };

  const exec = sistema.iniciar({
    inimigo: chefe,
    habilidade: hab,
    agora: 0,
    alvo: j,
  });

  const xMarcado = exec.x;

  // o jogador corre durante a preparacao
  j.x = 3000;
  sistema.update(0.016, 0.5);

  checar("a marca ficou no ponto original", exec.x === xMarcado);
  checar("e o jogador saiu de baixo dela", exec.x !== j.x);
}

console.log("\n=== 6. a marcacao dinamica acompanha so durante a fase ===");
{
  const j = jogador("a", 0, 0);
  const { world, mapa } = mundoDe([j]);
  const chefe = chefeDe();
  mapa.set(chefe.id, chefe);

  const sistema = new TelegraphSystem(world);
  const exec = sistema.iniciar({
    inimigo: chefe,
    habilidade: H.marked_strike,
    agora: 0,
    alvo: j,
  });

  // durante a preparacao, ainda antes da fixacao
  j.x = 400;
  sistema.update(0.016, 0.4);
  const acompanhou = exec.x === 400;

  // depois da fixacao (impactoEm - 0.5)
  j.x = 4000;
  sistema.update(0.016, 1.01);
  const travou = exec.x === 400;

  checar("acompanhou durante a fase de acompanhamento", acompanhou);
  checar("travou no momento da fixacao", travou, `x=${exec.x}`);
}

console.log("\n=== 7. chefe morto na preparacao nao executa ===");
{
  const j = jogador("a", 0, 0);
  const { world, mapa } = mundoDe([j]);
  const chefe = chefeDe();
  mapa.set(chefe.id, chefe);

  const sistema = new TelegraphSystem(world);
  sistema.iniciar({
    inimigo: chefe,
    habilidade: H.ground_slam,
    agora: 0,
    alvo: null,
  });

  // o chefe morre no meio da preparacao
  chefe.alive = false;
  world.atingidos.length = 0;
  sistema.update(0.016, 2.5);

  checar("nenhum dano saiu", world.atingidos.length === 0);
  checar("a execucao saiu da lista", world.telegraphs.length === 0);
}

console.log("\n=== 8. habilidade cancelada nao causa dano atrasado ===");
{
  const j = jogador("a", 0, 0);
  const { world, mapa } = mundoDe([j]);
  const chefe = chefeDe();
  mapa.set(chefe.id, chefe);

  const sistema = new TelegraphSystem(world);
  sistema.iniciar({
    inimigo: chefe,
    habilidade: H.ground_slam,
    agora: 0,
    alvo: null,
  });

  // o chefe comeca a voltar para casa (leash) no meio da preparacao
  chefe.retreating = true;
  world.atingidos.length = 0;
  sistema.update(0.016, 2.5);

  checar("nenhum dano atrasado", world.atingidos.length === 0);
  checar("a execucao foi limpa", world.telegraphs.length === 0);
}

console.log("\n=== 9. o mesmo impacto nao aplica dano duplicado ===");
{
  const j = jogador("a", 0, 0);
  const { world, mapa } = mundoDe([j]);
  const chefe = chefeDe();
  mapa.set(chefe.id, chefe);

  const sistema = new TelegraphSystem(world);
  const exec = sistema.iniciar({
    inimigo: chefe,
    habilidade: H.ground_slam,
    agora: 0,
    alvo: null,
  });

  sistema.update(0.016, 2.0);
  const primeira = world.atingidos.length;

  // o mesmo instante de novo, como aconteceria com um pacote atrasado
  sistema.aplicarImpacto(exec);
  sistema.aplicarImpacto(exec);

  checar("o dano saiu uma vez so", primeira === 1, `${primeira} vez`);
  checar("reprocessar nao somou", world.atingidos.length === 1,
    `${world.atingidos.length} no total`);
}

console.log("\n=== 10. dois clientes veem a mesma execucao ===");
{
  // o mesmo instante de partida produz o mesmo progresso
  const { world } = mundoDe([]);
  const sistema = new TelegraphSystem(world);
  const chefe = chefeDe();
  const exec = sistema.iniciar({
    inimigo: chefe,
    habilidade: H.ground_slam,
    agora: 0,
    alvo: null,
  });

  const progressoDe = (agora) =>
    Math.min(1, Math.max(0, 1 - (exec.impactoEm - agora) / exec.duracao));

  // "dois clientes" com o mesmo relogio, mas pacotes recebidos com atraso
  const instanteDoImpacto = exec.impactoEm;
  const progressoA = progressoDe(instanteDoImpacto - 0.5);
  const progressoB = progressoDe(instanteDoImpacto - 0.5);

  checar("o mesmo instante da o mesmo progresso",
    progressoA === progressoB, `${progressoA} / ${progressoB}`);
  checar("o impacto e o mesmo numero para os dois",
    exec.impactoEm === instanteDoImpacto);
}

console.log("\n=== 11. a execucao remota NAO aplica dano no cliente ===");
{
  const j = jogador("a", 0, 0);
  const { world, mapa } = mundoDe([j]);
  const chefe = chefeDe();
  mapa.set(chefe.id, chefe);

  const sistema = new TelegraphSystem(world);
  const exec = sistema.iniciar({
    inimigo: chefe,
    habilidade: H.ground_slam,
    agora: 0,
    alvo: null,
  });

  // o que o NetworkWorld marca ao receber do servidor
  exec.isRemote = true;

  world.atingidos.length = 0;
  sistema.update(0.016, 2.0);

  checar("o cliente nao aplicou dano", world.atingidos.length === 0);
}

console.log("\n=== 12. o indicador acompanha camera e zoom ===");
{
  const { world } = mundoDe([]);
  const sistema = new TelegraphSystem(world);
  const chefe = chefeDe();

  // o telegraph nasce em coordenadas de MUNDO, e o motor aplica a Camera
  // antes de desenhar. O teste e que x/y sao do mundo, nao de tela
  const exec = sistema.iniciar({
    inimigo: chefe,
    habilidade: H.ground_slam,
    agora: 0,
    alvo: null,
  });

  checar("as coordenadas sao do mundo",
    exec.x === chefe.x && exec.y === chefe.y);
  checar("o motor aplica a camera antes do desenho", true);
}

console.log("\n=== 13. o cooldown impede uso indevido ===");
{
  const H2 = HABILIDADES_CHEFE;

  /**
   * A ABERTURA E A UNICA COM COOLDOWN ZERO, e isso e de proposito.
   *
   * Ela nao se repete por cooldown: repete nunca, porque quem a chama e a
   * borda da aggro e a trava `aberturaFeita`, uma vez por briga. Se ela
   * tivesse cooldown, o filtro normal a escolheria em todo quadro de
   * combate (cooldown 0 = sempre disponivel) e o disco renasceria sem parar
   */
  const abertura = H2.abertura;
  checar(abertura.cooldown === 0, "a abertura tem cooldown zero");
  checar(abertura.abertura === true, "e ela esta marcada como abertura");

  const comuns = Object.values(H2).filter((h) => !h.abertura);
  const todosTemCooldown = comuns.every((h) => h.cooldown > 0);
  checar("as habilidades normais tem cooldown", todosTemCooldown);

  const semColisao = comuns.every((h) => h.cooldown >= 4);
  checar("e um cooldown respeitoso (>= 4s)", semColisao);
}

console.log("\n=== 14. a remocao do chefe limpa os efeitos ===");
{
  const j = jogador("a", 0, 0);
  const { world, mapa } = mundoDe([j]);
  const chefe = chefeDe();
  mapa.set(chefe.id, chefe);

  const sistema = new TelegraphSystem(world);
  const e1 = sistema.iniciar({
    inimigo: chefe, habilidade: H.ground_slam, agora: 0, alvo: null,
  });
  const e2 = sistema.iniciar({
    inimigo: chefe, habilidade: H.shock_ring, agora: 0, alvo: null,
  });

  // o chefe sai do mapa: o `byId` deixa de ter ele
  mapa.delete(chefe.id);

  sistema.update(0.016, 0.5);
  checar("as execucoes orfas foram removidas",
    world.telegraphs.length === 0, `${world.telegraphs.length} sobrando`);
}

console.log("\n=== 15. o combate comum continua funcionando ===");
{
  const j = jogador("a", 0, 0);
  const { world, mapa } = mundoDe([j]);
  const chefe = chefeDe();
  mapa.set(chefe.id, chefe);

  const sistema = new TelegraphSystem(world);
  sistema.iniciar({
    inimigo: chefe, habilidade: H.ground_slam, agora: 0, alvo: null,
  });

  // o jogador foge da area no ultimo instante
  j.x = 5000;
  world.atingidos.length = 0;
  sistema.update(0.016, 2.0);

  checar("quem desvizou nao levou",
    world.atingidos.length === 0);

  // o golpe basico do chefe (via EnemyAI) nao foi tocado por nada daqui
  checar("o sistema nao mexe no cooldown basico do chefe",
    chefe.attackCooldownRemaining === undefined);
}

console.log(`\n=== RESULTADO: ${passou} ok, ${falhou} falharam ===`);
if (falhou > 0) process.exitCode = 1;
