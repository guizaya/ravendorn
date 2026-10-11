import { beforeEach, describe, expect, it } from "vitest";
import { EnemyAI } from "./EnemyAI.js";
import {
  BEHAVIOR,
  CREATURE_TYPES,
  createCreature,
  createCreatureRoster,
  TRAINING_DUMMY_BLUEPRINTS,
  ZONE_ROSTER,
} from "../../data/enemies/index.js";
import { MAP_1, MAP_1_ZONES } from "../../data/maps/index.js";
import { CollisionSystem } from "../collision/CollisionSystem.js";
import { StatusSystem } from "../effects/StatusSystem.js";

const FLAT_MAP = {
  width: 4000,
  height: 2800,
  bounds: { x: 40, y: 40, width: 3920, height: 2720 },
  walls: [],
  obstacles: [],
};

function createHarness(playerX = 2000, playerY = 1400) {
  const world = {
    time: 0,
    player: {
      id: "player",
      x: playerX,
      y: playerY,
      radius: 22,
      hp: 10000,
      maxHp: 10000,
      alive: true,
      resource: 0,
      maxResource: 100,
      shield: 0,
      statusEffects: [],
      cast: null,
      cooldowns: {},
      facing: { x: 0, y: 1 },
    },
    enemies: [],
    collision: new CollisionSystem(FLAT_MAP),
  };

  const hits = [];
  const tiros = [];

  const ai = new EnemyAI(world, {
    onDamagePlayer: (enemy, amount) => {
      hits.push({ id: enemy.id, amount });
    },

    /**
     * O TIRO, em lista propria.
     *
     * Sem este registro, um inimigo que atira pareceria um inimigo que
     * nao ataca: o `onDamagePlayer` nao e chamado, e um teste que
     * espera `hits` crescendo falha com "0 golpes" sem nenhuma pista
     * de que o bicho fez a coisa certa do outro jeito
     */
    onShootPlayer: (enemy, target) => {
      tiros.push({ id: enemy.id, target: target?.id });
    },
  });

  return { world, ai, hits, tiros };
}

function spawn(typeId, offset = 0) {
  return createCreature(
    typeId,
    { x: 2000 + offset, y: 1400 },
    0,
  );
}

function run(ai, enemy, seconds, playerX) {
  const steps = Math.round(seconds * 60);

  for (let step = 0; step < steps; step += 1) {
    if (playerX !== undefined) {
      ai.world.player.x = playerX;
    }

    ai.update(enemy, 1 / 60);
  }
}

describe("roster", () => {
  it("creates a large roster across every zone", () => {
    const roster = createCreatureRoster();

    // 93 = a soma dos `count` de cada `ZONE_ROSTER`, sem os bonecos
    // de treino, que sao acrescentados a parte (e hoje nao ha nenhum:
    // o campo de provas trocou os dois bonecos por um par de criaturas).
    // A floresta subiu de 7 para 14 quando o ogre da predeira entrou no
    // mix: com 7 spawns e o peso dele baixo, o arredondamento dava UM
    // ogre no mapa inteiro, a 2500px do nascimento, e a arte nova
    // nunca aparecia em teste. E o campo de provas subiu de 2 para 10
    // criaturas, o que levou o total de 83 para 93
    expect(roster.length).toBe(93);
  });

  it("covers all three behaviors", () => {
    const counts = { passive: 0, semi: 0, active: 0 };

    for (const enemy of createCreatureRoster()) {
      if (enemy.behavior === BEHAVIOR.PASSIVE) {
        counts.passive += 1;
      } else if (
        enemy.behavior === BEHAVIOR.SEMI_PASSIVE
      ) {
        counts.semi += 1;
      } else {
        counts.active += 1;
      }
    }

    for (const key of ["passive", "semi", "active"]) {
      expect(counts[key], key).toBeGreaterThan(0);
    }
  });

  it("includes every creature type", () => {
    const seen = new Set(
      createCreatureRoster().map(
        (enemy) =>
          enemy.id.replace(/_\d+$/, ""),
      ),
    );

    for (const typeId of Object.keys(CREATURE_TYPES)) {
      expect(seen.has(typeId), typeId).toBe(true);
    }
  });

  it("gives every creature a unique id and a valid spawn", () => {
    const roster = createCreatureRoster();
    const ids = new Set();

    for (const enemy of roster) {
      expect(ids.has(enemy.id)).toBe(false);
      ids.add(enemy.id);

      expect(enemy.isCreature).toBe(true);
      expect(enemy.hp).toBe(enemy.maxHp);
      expect(enemy.spawnX).toBe(enemy.x);
      expect(enemy.spawnY).toBe(enemy.y);
      expect(enemy.behavior).toBeDefined();
    }
  });

  it("keeps every creature inside the map bounds", () => {
    const bounds = MAP_1.bounds;

    for (const enemy of createCreatureRoster()) {
      expect(enemy.x).toBeGreaterThan(bounds.x);
      expect(enemy.y).toBeGreaterThan(bounds.y);
      expect(enemy.x).toBeLessThan(
        bounds.x + bounds.width,
      );
      expect(enemy.y).toBeLessThan(
        bounds.y + bounds.height,
      );
    }
  });

  it("places every creature inside a zone", () => {
    const roster = createCreatureRoster();

    for (const enemy of roster) {
      const zone = MAP_1_ZONES.find(
        (candidate) =>
          enemy.x >= candidate.x &&
          enemy.x <= candidate.x + candidate.width &&
          enemy.y >= candidate.y &&
          enemy.y <= candidate.y + candidate.height,
      );

      expect(zone, enemy.id).toBeDefined();
    }
  });

  it("matches the dominant behavior of each zone", () => {
    const roster = createCreatureRoster();

    for (const zone of MAP_1_ZONES) {
      if (zone.kind === "training") continue;

      const members = roster.filter(
        (enemy) =>
          enemy.x >= zone.x &&
          enemy.x <= zone.x + zone.width &&
          enemy.y >= zone.y &&
          enemy.y <= zone.y + zone.height,
      );

      expect(members.length, zone.id).toBeGreaterThan(0);

      const tally = {
        passive: 0,
        semi: 0,
        active: 0,
      };

      for (const member of members) {
        if (member.behavior === BEHAVIOR.PASSIVE) {
          tally.passive += 1;
        } else if (
          member.behavior === BEHAVIOR.SEMI_PASSIVE
        ) {
          tally.semi += 1;
        } else {
          tally.active += 1;
        }
      }

      const dominant = Object.entries(tally).sort(
        (a, b) => b[1] - a[1],
      )[0][0];

      expect(dominant, zone.id).toBe(zone.kind);
    }
  });

it("mixes more than one creature type per zone", () => {
    const roster = createCreatureRoster();

    for (const zone of MAP_1_ZONES) {
      if (zone.kind === "training") continue;

      /**
       * O QUE A ZONA DECLARA que vai aparecer nela.
       *
       * A regra original era "toda zona tem mais de um tipo", e o Pantano
       * a quebrou de proposito: ele virou a zona de entrada e passou a
       * ter so limo. Exigir a mistura ali seria exigir de volta o ogre
       * de nivel 15 que o jogador de nivel 1 encontrava no primeiro
       * passo depois de atravessar o portal
       *
       * O que o teste passa a exigir e a COERENCIA entre o `mix`
       * declarado e o que o sorteio produz. Uma zona que declara dois
       * tipos e produz um so ainda falha — e esse e o defeito que a
       * regra original pegava de verdade
       */
      const declarados = Object.keys(
        ZONE_ROSTER.find((r) => r.zone === zone.id)
          ?.mix ?? {},
      );

      const tipos = new Set(
        roster
          .filter(
            (enemy) =>
              enemy.x >= zone.x &&
              enemy.x <= zone.x + zone.width &&
              enemy.y >= zone.y &&
              enemy.y <= zone.y + zone.height,
          )
          .map(
            (enemy) =>
              enemy.id.replace(/_\d+$/, ""),
          ),
      );

      expect(
        tipos.size,
        `a zona ${zone.id} declara ${declarados.length} ` +
          `tipo(s) e gerou ${tipos.size}`,
      ).toBe(declarados.length);

      // uma zona com um tipo so continua sendo uma zona valida
      expect(declarados.length, zone.id).toBeGreaterThan(0);
    }
  });

  it("keeps the training dummies out of the creature roster", () => {
    const roster = createCreatureRoster();

    for (const enemy of roster) {
      for (const dummy of TRAINING_DUMMY_BLUEPRINTS) {
        expect(enemy.id).not.toBe(dummy.id);
      }
    }
  });
});

describe("passive behavior", () => {
  it("never attacks, even standing on the player", () => {
    for (const typeId of ["slime", "rat"]) {
      const { ai, hits } = createHarness();
      const enemy = spawn(typeId, 10);

      ai.world.enemies.push(enemy);

      run(ai, enemy, 8);

      expect(hits, typeId).toHaveLength(0);
      expect(enemy.provoked).toBe(false);
      expect(enemy.alerted).toBe(false);
    }
  });

  it("ignores provocation", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("slime", 10);

    ai.provoke(enemy);
    run(ai, enemy, 5);

    expect(hits).toHaveLength(0);
    expect(enemy.provoked).toBe(false);
  });

  it("only wanders inside its wander radius", () => {
    const { ai } = createHarness();
    const enemy = spawn("slime");

    const home = { x: enemy.x, y: enemy.y };

    run(ai, enemy, 25);

    expect(
      Math.hypot(
        enemy.x - home.x,
        enemy.y - home.y,
      ),
    ).toBeLessThanOrEqual(
      CREATURE_TYPES.slime.wanderRadius + 80,
    );
  });
});

describe("semi-passive behavior", () => {
  it("stays idle until provoked", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("goblin", 200);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 4);

    expect(hits).toHaveLength(0);
    expect(enemy.aiState).not.toBe("chase");
  });

  it("does not aggro on proximity alone", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("goblin", 30);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 6);

    expect(hits).toHaveLength(0);
    expect(enemy.alerted).toBe(false);
  });

  it("chases and attacks after being hit", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("goblin", 420);

    ai.world.enemies.push(enemy);

    ai.provoke(enemy);

    expect(enemy.provoked).toBe(true);

    run(ai, enemy, 12);

    expect(hits.length).toBeGreaterThan(0);
  });

  it("deals the configured damage per hit", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("ghoul", 60);

    ai.world.enemies.push(enemy);
    ai.provoke(enemy);

    run(ai, enemy, 10);

    expect(hits.length).toBeGreaterThan(0);

    for (const hit of hits) {
      expect(hit.amount).toBe(
        CREATURE_TYPES.ghoul.damage,
      );
    }
  });
});

describe("active behavior", () => {
  it("aggrons when the player enters its range", () => {
    /**
     * O `ogre`, e nao a sentinela.
     *
     * A sentinela virou ATIRADORA, e um `ranged` nao passa por
     * `onDamagePlayer` — ele chama `onShootPlayer`. Usar a sentinela
     * aqui daria "0 golpes" num bicho que esta fazendo a coisa certa
     * pelo outro caminho
     */
    const { ai, hits } = createHarness();
    const enemy = spawn("ogre", 100);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 10);

    expect(enemy.alerted).toBe(true);
    expect(hits.length).toBeGreaterThan(0);
  });

  /**
   * O KAELEN, QUE VOLTOU A SER CORPO A CORPO.
   *
   * A criatura `skeleton` foi atiradora enquanto se chamava Sentinela
   * Esqueletica. Virou o Kaelen e deixou de ser: sem `ranged`, sem
   * `keepDistance` e com o `attackRange` no do golpe de perto
   *
   * Este e o teste que trava a virada: sem ele, voltar o Kaelen para
   * atirador seria uma troca de numero em `index.js` que nenhum teste
   * notaria
   */
  it("o Kaelen encosta em vez de atirar", () => {
    const { ai, hits, tiros } = createHarness();
    const enemy = spawn("skeleton", 100);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 10);

    expect(enemy.alerted, "o Kaelen nao aggro").toBe(true);

    expect(
      hits.length,
      "o Kaelen atirou em vez de encostar",
    ).toBeGreaterThan(0);

    expect(
      tiros.length,
      "o Kaelen deu dano de longe, e ele e corpo a corpo",
    ).toBe(0);
  });

  it("o Kaelen AVANCA quando o jogador chega perto", () => {
    const { ai, world } = createHarness();
    const enemy = spawn("skeleton", 100);

    ai.world.enemies.push(enemy);

    const jogador = world.player;
    const antes = Math.hypot(
      enemy.x - jogador.x,
      enemy.y - jogador.y,
    );

    run(ai, enemy, 3);

    /**
     * A DISTANCIA CAIU, e nao o `aiState`.
     *
     * E o oposto do que a Sentinela fazia: ela tinha `keepDistance: 220`
     * e dava um passo para tras. Sem o `keepDistance` o bicho simplesmente
     * persegue, entao a distancia para o jogador diminui
     */
    const depois = Math.hypot(
      enemy.x - jogador.x,
      enemy.y - jogador.y,
    );

    expect(
      depois,
      "o Kaelen nao avancou: sobrou `keepDistance` de atirador?",
    ).toBeLessThan(antes);
  });

  it("ignores a player outside its range", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("skeleton", 900);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 4);

    expect(hits).toHaveLength(0);
    expect(enemy.alerted).toBe(false);
  });

  it("respects the per-type aggro range", () => {
    for (const typeId of ["skeleton", "ogre"]) {
      const type = CREATURE_TYPES[typeId];

      const { ai, hits } = createHarness();
      const enemy = spawn(typeId, type.aggroRange + 160);

      ai.world.enemies.push(enemy);

      run(ai, enemy, 3);

      expect(hits, typeId).toHaveLength(0);
    }
  });

  it("walks toward the player once aggroed", () => {
    const { ai } = createHarness();
    const enemy = spawn("ogre", 350);

    ai.world.enemies.push(enemy);

    const before = Math.hypot(
      enemy.x - ai.world.player.x,
      enemy.y - ai.world.player.y,
    );

    run(ai, enemy, 1.5);

    const after = Math.hypot(
      enemy.x - ai.world.player.x,
      enemy.y - ai.world.player.y,
    );

    expect(after).toBeLessThan(before);
    expect(enemy.aiState).toBe("chase");
  });

  it("gives up and walks home when the player escapes the leash", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("skeleton", 600);

    ai.world.enemies.push(enemy);

    const home = { x: enemy.spawnX, y: enemy.spawnY };

    // o jogador fica longe para o inimigo sair do leash do spawn
    ai.world.player.x = 1200;
    ai.world.player.y = 1400;

    ai.provoke(enemy);
    run(ai, enemy, 14);

    const strayed = Math.hypot(
      enemy.x - home.x,
      enemy.y - home.y,
    );

    expect(strayed).toBeGreaterThan(
      CREATURE_TYPES.skeleton.leash,
    );

    const hitsBeforeEscape = hits.length;

    ai.world.player.x = 3800;
    ai.world.player.y = 2600;

    run(ai, enemy, 0.4);

    expect(enemy.provoked).toBe(false);
    expect(enemy.aiState).toBe("return");

    run(ai, enemy, 20);

    // ao chegar em casa ele volta a vagar ate o wanderRadius
    const wander = CREATURE_TYPES.skeleton.wanderRadius;

    const returned = Math.hypot(
      enemy.x - home.x,
      enemy.y - home.y,
    );

    expect(returned).toBeLessThan(wander + 40);
    expect(returned).toBeLessThan(strayed);
    expect(hits.length).toBe(hitsBeforeEscape);
  });
});

describe("combat", () => {
  it("respects the attack cooldown", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("skeleton", 30);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 3);

    const minimumGap =
      CREATURE_TYPES.skeleton.attackCooldown * 0.85;

    for (let i = 1; i < hits.length; i += 1) {
      expect(hits[i].id).toBe(hits[i - 1].id);
    }

    expect(
      hits.length,
      `cooldown ${minimumGap}`,
    ).toBeLessThanOrEqual(
      Math.ceil(3 / minimumGap) + 1,
    );
  });

  it("stops attacking a dead creature", () => {
    const { ai, hits } = createHarness();
    const enemy = spawn("skeleton", 30);

    ai.world.enemies.push(enemy);

    run(ai, enemy, 2);

    const before = hits.length;

    enemy.alive = false;
    enemy.hp = 0;

    run(ai, enemy, 4);

    expect(hits.length).toBe(before);
    expect(enemy.aiState).toBe("dead");
  });

  it("does nothing for entities without the creature flag", () => {
    const { ai, hits } = createHarness();
    const dummy = {
      id: "dummy_x",
      x: 2000,
      y: 1400,
      radius: 20,
      hp: 100,
      maxHp: 100,
      alive: true,
      isCreature: false,
      hitFlash: 0,
      attackAnimation: 0,
      aiState: "idle",
    };

    run(ai, dummy, 5);

    expect(hits).toHaveLength(0);
  });
});
