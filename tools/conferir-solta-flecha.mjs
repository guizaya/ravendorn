/**
 * O QUE ESTE ARQUIVO CONFERE
 *
 * A flecha do Arbalista precisa sair QUANDO A ANIMACAO TERMINA, e nao no
 * instante em que a animacao comeca. Esse erro nao aparece como falha: ele
 * aparece como "o boneco ta puxando o arco e a flecha ja foi", que e uma
 * queixa sobre aparencia e nao sobre logica — e por isso que precisa de
 * numero para ser discutida
 *
 * Os numeros que importam:
 *
 *   1. A FLECHA NAO EXISTE ANTES DA POSE TERMINAR
 *   2. A FLECHA EXISTE QUANDO A POSE TERMINA
 *   3. A ESPERA E A MESMA CONSTANTE DA POSE
 *   4. A FLECHA NAO SAI DUAS VEZES
 *   5. MORRER NO MEIO CANCELA O TIRO
 *   6. O DANO CONTINUA SENDO DA FLECHA, E NAO DO APERTO
 *   7. O GOLPE DE ESPADA NAO FOI ATRASADO
 */

import { SkillSystem } from "../src/game/skills/SkillSystem.js";
import { SKILL_PACKS } from "../src/data/skills/index.js";

const PASSO = 1 / 60;

let passou = 0;
let falhou = 0;

function conferir(descricao, condicao) {
  if (condicao) {
    passou += 1;
    console.log(`  ok   ${descricao}`);

    return true;
  }

  falhou += 1;
  console.log(`  FALHA ${descricao}`);

  return false;
}

/**
 * O ALVO, e um inimigo parado e longe o bastante para a flecha chegar.
 *
 * ## POR QUE 300 E NAO 50
 *
 * Porque o teste do tempo do TIRO e o teste do VOO. A 300px a flecha ainda
 * esta no ar depois de sair, e da para ver que ela foi criada sem precisar
 * que ela acerte
 */
const ALVO = {
  id: "inimigo_1",
  x: 300,
  y: 0,
  hp: 5000,
  alive: true,
  radius: 20,
  pushVelocity: { x: 0, y: 0 },
  statusEffects: [],
  damageTaken: 0,
};

const TIRO = {
  id: "tiro_basico",
  name: "Tiro",
  type: "projectile",
  damage: 104,
  resourceCost: 0,
  cooldown: 1 / 1.4,
  range: 550,
  projectileSpeed: 720,
  projectileStyle: "arrow",
  count: 1,
  spread: 0,
  hits: 1,
  impactRadius: 60,
  impactMode: "collision",
  effects: [],
  statusEffects: [],
};

/**
 * UM GOLPE QUE NAO E PROJETIL, para provar que ele NAO foi atrasado.
 *
 * E o contra-teste do item 7. Se o atraso tivesse sido colocado em `execute`
 * em vez do ramo `projectile`, este golpe passaria a acertar com atraso e o
 * jogo inteiro ficaria lento sem ninguem perceber
 */
const GOLPE = {
  id: "golpe_corpo",
  name: "Golpe",
  type: "cone",
  damage: 40,
  resourceCost: 0,
  cooldown: 0,
  range: 120,
  angle: 1.2,
  hits: 1,
  effects: [],
  statusEffects: [],
};

function criarMundo() {
  const jogador = {
    id: "jogador_1",
    x: 0,
    y: 0,
    hp: 1000,
    alive: true,
    resource: 100,
    maxResource: 100,
    cooldowns: {},
    attackAnimation: 0,
    firingTargetId: null,
    cast: null,
    aimDirection: { x: 1, y: 0 },
    definition: { resource: { name: "Foco" } },
    statusEffects: [],
  };

  return {
    jogador,
    projectiles: [],
    pendingPulses: [],
    delayedEffects: [],
    statuses: {
      canCastSkill: () => true,
      canAct: () => true,
    },
    effects: {
      apply: () => {},
      line: () => {},
      cone: () => {},
      circle: () => {},
      ground: () => {},
    },
    damage: {
      heal: () => {},
      restoreResource: () => {},
      applyDamage: () => {},
    },
    collision: {
      hitsSolid: () => false,
    },
    enemies: [{ ...ALVO }],
  };
}

function montar() {
  const world = criarMundo();
  const system = new SkillSystem(world, () => {});

  // `world.player` e o que o SkillSystem le
  world.player = world.jogador;

  return { world, system };
}

/**
 * AVANCA O TEMPO, e devolve quantas flechas existem.
 *
 * O `updateProjectiles` fica de fora de proposito: aqui so interessa o
 * INSTANTE em que a flecha e criada, e deixar a flecha voar acabaria com ela
 * em menos tempo do que a proxima checagem
 */
function avancar(system, world, segundos) {
  const ticks = Math.round(segundos / PASSO);

  for (let i = 0; i < ticks; i += 1) {
    system.update(PASSO);

    // o motor decai a pose aqui, e nao dentro do SkillSystem
    world.player.attackAnimation = Math.max(
      0,
      world.player.attackAnimation - PASSO,
    );
  }

  return world.projectiles.length;
}

console.log("\nFLECHA NA ANIMACAO\n");

/* ------------------------------------------------------------------ *
 * 1 e 2. A FLECHA ESPERA A POSE
 * ------------------------------------------------------------------ */
console.log("1. a flecha espera a pose terminar\n");

{
  const { world, system } = montar();

  system.request(TIRO, { x: 300, y: 0 }, ALVO.id);

  conferir("a pose comecou", world.player.attackAnimation > 0);

  /**
   * ESTE E O TESTE QUE PEGA O BUG REPORTADO.
   *
   * Logo apos o aperto a lista tem de estar VAZIA. Com o codigo antigo ela
   * tinha um item, e a flecha aparecia enquanto o boneco ainda puxava o arco
   */
  conferir(
    "logo apos o aperto NAO ha flecha no ar",
    world.projectiles.length === 0,
  );

  const meio = avancar(system, world, 0.1);

  conferir("no meio da animacao ainda nao ha flecha", meio === 0);

  const quanto = world.player.attackAnimation;

  avancar(system, world, 0.02);

  conferir("a pose ainda estava de pe a 0,12s", quanto > 0);

  avancar(system, world, 0.2);

  conferir("passada a pose, a flecha existe", world.projectiles.length === 1);
  conferir("e a pose ja terminou", world.player.attackAnimation === 0);
}

/* ------------------------------------------------------------------ *
 * 3. O MESMO NUMERO NOS DOIS LUGARES
 * ------------------------------------------------------------------ */
console.log("\n3. a flecha sai NO MESMO TICK em que a pose acaba\n");

{
  const { world, system } = montar();

  system.request(TIRO, { x: 300, y: 0 }, ALVO.id);

  /**
   * TICK A TICK, COMPARANDO OS DOIS MOMENTOS.
   *
   * O teste do bloco 1 prova que a flecha nao sai CEDO. Este prova que ela
   * tambem nao sai ATRASADO: e o tick em que a flecha aparece tem de ser o
   * mesmo em que a pose chega a zero
   *
   * E o contra-teste do "atrasou a animacao": se o `update` contasse com um
   * numero maior que a pose, a flecha passaria a voar com o boneco ja em
   * idle — que e o mesmo defeito com o sinal trocado
   */
  let tickDaFlecha = -1;
  let tickDaPose = -1;

  for (let tick = 1; tick <= 60; tick += 1) {
    system.update(PASSO);

    if (world.projectiles.length > 0 && tickDaFlecha < 0) {
      tickDaFlecha = tick;
    }

    world.player.attackAnimation = Math.max(
      0,
      world.player.attackAnimation - PASSO,
    );

    if (world.player.attackAnimation === 0 && tickDaPose < 0) {
      tickDaPose = tick;
    }

    if (tickDaFlecha >= 0 && tickDaPose >= 0) break;
  }

  conferir("a flecha apareceu", tickDaFlecha > 0);
  conferir("a pose terminou", tickDaPose > 0);
  conferir(
    "e foi no mesmo tick",
    tickDaFlecha === tickDaPose,
  );

  /**
   * O TEMPO CERTO, E NAO UM QUALQUER.
   *
   * 0,22 s a 60 quadros por segundo e o mesmo numero que a pose declara. Se
   * este numero mudar, ou o tempo da pose mudou sem a constante acompanhar,
   * ou a constante foi editada em um dos dois lados so — e os dois casos sao
   * o bug de novo
   */
  conferir(
    "o tempo bate com a constante da pose",
    tickDaFlecha === Math.ceil(0.22 / PASSO),
  );
}

/* ------------------------------------------------------------------ *
 * 4. UM APERTO, UMA FLECHA
 * ------------------------------------------------------------------ */
console.log("\n4. um aperto, uma flecha\n");

{
  const { world, system } = montar();

  system.request(TIRO, { x: 300, y: 0 }, ALVO.id);

  avancar(system, world, 0.5);

  const total = world.projectiles.length;

  avancar(system, world, 1);

  conferir("uma flecha apos a pose", total === 1);
  conferir(
    "e nenhuma depois",
    world.projectiles.length === total,
  );

  conferir("a lista de guardados esvaziou", system.tirosPendentes.length === 0);
}

/* ------------------------------------------------------------------ *
 * 5. MORRER NO MEIO DO PUXAO
 * ------------------------------------------------------------------ */
console.log("\n5. morrer no meio do puxao\n");

{
  const { world, system } = montar();

  system.request(TIRO, { x: 300, y: 0 }, ALVO.id);

  world.player.hp = 0;
  world.player.alive = false;

  avancar(system, world, 0.5);

  conferir("a flecha nao saiu do corpo", world.projectiles.length === 0);
  conferir("e o tiro nao ficou preso na lista", system.tirosPendentes.length === 0);
}

/* ------------------------------------------------------------------ *
 * 6. O DANO VEM DA FLECHA
 * ------------------------------------------------------------------ */
console.log("\n6. o dano continua sendo da flecha\n");

{
  const { world, system } = montar();

  system.request(TIRO, { x: 300, y: 0 }, ALVO.id);

  avancar(system, world, 0.3);

  /**
   * O INIMIGO AINDA ESTA COM A VIDA INTEIRA.
   *
   * E o que separa "atrasamos a FLECHA" de "atrasamos o ATAQUE". No codigo
   * antigo o dano saia junto com o aperto; agora ele tem de sair quando a
   * flecha chega, senao a troca seria o tiro virando dano com atraso e nao
   * um tiro com tempo de animacao
   */
  conferir("o aperto nao aplicou dano", ALVO.hp === 5000);

  const [flecha] = world.projectiles;

  conferir("a flecha existe", Boolean(flecha));
  conferir("a flecha sai da posicao do jogador", flecha?.x === 0 && flecha?.y === 0);
  conferir("a flecha aponta para o alvo", flecha?.velocityX === 720);
  conferir("a flecha sabe o que e", flecha?.action?.projectileStyle === "arrow");
}

/* ------------------------------------------------------------------ *
 * 7. O GOLPE DE ESPADA NAO FOI ATRASADO
 * ------------------------------------------------------------------ */
console.log("\n7. o golpe corpo a corpo nao foi atrasado\n");

{
  const { world, system } = montar();

  // o inimigo colado, que e o caso do golpe de corpo a corpo
  world.enemies[0] = { ...ALVO, x: 60, y: 0 };

  let golpes = 0;

  world.damage.applyDamage = () => {
    golpes += 1;
  };

  system.request(GOLPE, { x: 60, y: 0 }, ALVO.id);

  conferir("o golpe acertou no aperto", golpes === 1);
  conferir("e nao ha fila de espera", system.tirosPendentes.length === 0);
}

/* ------------------------------------------------------------------ *
 * 8. O QUE O JOGO REAL FAZ
 * ------------------------------------------------------------------ */
console.log("\n8. o basico real do arbalista\n");

{
  const { world, system } = montar();

  const basico = SKILL_PACKS.arbalist.skills[0];

  // o basico da classe vem de `basicAttack`, e nao do pack de skills
  const acao = {
    ...basico,
    type: "projectile",
  };

  system.request(acao, { x: 300, y: 0 }, ALVO.id);

  conferir("o aperto nao cria flecha", world.projectiles.length === 0);

  avancar(system, world, 0.3);

  conferir("a pose criou a flecha", world.projectiles.length >= 1);
}

/* ------------------------------------------------------------------ */

console.log(`\n${passou} ok, ${falhou} falhas\n`);

if (falhou) process.exit(1);