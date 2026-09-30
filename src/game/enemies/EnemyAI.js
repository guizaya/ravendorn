import { distance, normalize, randomBetween } from "../math.js";
import { BEHAVIOR } from "../../data/enemies/index.js";

const STUCK_THRESHOLD = 0.45;
const STUCK_SIDESTEP = 0.55;
const STUCK_COOLDOWN = 0.8;
const ARRIVE_EPSILON = 14;
const RETURN_ARRIVE = 20;
const RETURN_MARGIN = 20;
const RETARGET_INTERVAL = 0.35;

export class EnemyAI {
  constructor(world, { onDamagePlayer } = {}) {
    this.world = world;
    this.onDamagePlayer = onDamagePlayer ?? (() => {});
  }

  get player() {
    return this.world.player;
  }

  update(enemy, deltaTime) {
    if (!enemy.isCreature) return;

    enemy.attackAnimation = Math.max(
      0,
      enemy.attackAnimation - deltaTime,
    );

    enemy.attackCooldownRemaining = Math.max(
      0,
      enemy.attackCooldownRemaining - deltaTime,
    );

    if (!enemy.alive) {
      enemy.aiState = "dead";
      return;
    }

    this.updateAlert(enemy, deltaTime);
    this.updateBehavior(enemy, deltaTime);
  }

  provoke(enemy) {
    if (!enemy.isCreature) return;

    if (enemy.behavior === BEHAVIOR.PASSIVE) return;

    if (!enemy.provoked) {
      enemy.provoked = true;
      enemy.alerted = true;
    }
  }

  updateAlert(enemy, deltaTime) {
    if (enemy.behavior === BEHAVIOR.PASSIVE) {
      enemy.alerted = false;
      return;
    }

    if (enemy.behavior === BEHAVIOR.SEMI_PASSIVE) {
      return;
    }

    if (enemy.alerted) {
      enemy.aiTimer += deltaTime;

      const leash = enemy.leash;

      if (
        distance(enemy, this.player) >
        Math.max(leash, enemy.aggroRange) * 1.6
      ) {
        enemy.alerted = false;
        enemy.provoked = false;
      }
    }
  }

  isAggressive(enemy) {
    if (enemy.behavior === BEHAVIOR.PASSIVE) {
      return false;
    }

    if (enemy.behavior === BEHAVIOR.SEMI_PASSIVE) {
      return enemy.provoked;
    }

    if (enemy.alerted || enemy.provoked) {
      return true;
    }

    if (
      distance(enemy, this.player) <= enemy.aggroRange
    ) {
      enemy.alerted = true;
      enemy.aiTimer = 0;
      return true;
    }

    return false;
  }

  updateBehavior(enemy, deltaTime) {
    if (!this.isAggressive(enemy)) {
      const home = {
        x: enemy.spawnX,
        y: enemy.spawnY,
      };

      const restRadius =
        (enemy.wanderRadius ?? 60) + RETURN_MARGIN;

      if (distance(enemy, home) > restRadius) {
        this.updateReturn(enemy, deltaTime);
        return;
      }

      this.updateIdle(enemy, deltaTime);
      return;
    }

    this.updateCombat(enemy, deltaTime);
  }

  updateCombat(enemy, deltaTime) {
    const player = this.player;
    const toPlayer = distance(enemy, player);

    if (toPlayer <= enemy.attackRange) {
      enemy.aiState = "attack";
      enemy.facing = normalize(
        player.x - enemy.x,
        player.y - enemy.y,
      );

      this.tryAttack(enemy, toPlayer);

      return;
    }

    const homeDistance = distance(
      { x: enemy.spawnX, y: enemy.spawnY },
      player,
    );

    if (
      enemy.behavior === BEHAVIOR.ACTIVE &&
      !enemy.provoked &&
      homeDistance > enemy.leash
    ) {
      enemy.alerted = false;
      this.updateReturn(enemy, deltaTime);

      return;
    }

    enemy.aiState = "chase";
    enemy.facing = normalize(
      player.x - enemy.x,
      player.y - enemy.y,
    );

    this.moveToward(enemy, player, deltaTime, enemy.speed);
  }

  updateReturn(enemy, deltaTime) {
    const home = {
      x: enemy.spawnX,
      y: enemy.spawnY,
    };

    if (distance(enemy, home) < RETURN_ARRIVE) {
      enemy.aiState = "idle";
      enemy.wanderTarget = null;
      return;
    }

    enemy.aiState = "return";
    enemy.facing = normalize(
      home.x - enemy.x,
      home.y - enemy.y,
    );

    this.moveToward(enemy, home, deltaTime, enemy.speed);
  }

  updateIdle(enemy, deltaTime) {
    if (!enemy.wanderTarget) {
      enemy.wanderWait -= deltaTime;

      if (enemy.wanderWait > 0) return;

      enemy.wanderWait = randomBetween(1.2, 3.4);

      enemy.wanderTarget = {
        x: enemy.spawnX + randomBetween(-1, 1) *
          (enemy.wanderRadius ?? 0),
        y: enemy.spawnY + randomBetween(-1, 1) *
          (enemy.wanderRadius ?? 0),
      };

      return;
    }

    if (distance(enemy, enemy.wanderTarget) < ARRIVE_EPSILON) {
      enemy.wanderTarget = null;
      enemy.aiState = "idle";
      return;
    }

    enemy.aiState = "wander";
    enemy.facing = normalize(
      enemy.wanderTarget.x - enemy.x,
      enemy.wanderTarget.y - enemy.y,
    );

    this.moveToward(
      enemy,
      enemy.wanderTarget,
      deltaTime,
      enemy.wanderSpeed ?? enemy.speed * 0.35,
    );
  }

  tryAttack(enemy, targetDistance) {
    if (enemy.attackCooldownRemaining > 0) return;

    if (targetDistance > enemy.attackRange) return;

    enemy.attackCooldownRemaining =
      enemy.attackCooldown;

    enemy.attackAnimation = 0.28;

    this.onDamagePlayer(enemy, enemy.damage);
  }

  moveToward(enemy, target, deltaTime, speed) {
    const direction = normalize(
      target.x - enemy.x,
      target.y - enemy.y,
    );

    if (direction.x === 0 && direction.y === 0) {
      return;
    }

    const stepX = direction.x * speed * deltaTime;
    const stepY = direction.y * speed * deltaTime;

    const before = { x: enemy.x, y: enemy.y };

    this.world.collision.moveEntity(
      enemy,
      stepX,
      stepY,
      this.world.enemies,
    );

    const moved = Math.hypot(
      enemy.x - before.x,
      enemy.y - before.y,
    );

    if (moved < STUCK_THRESHOLD) {
      enemy.stuckTimer += deltaTime;
    } else {
      enemy.stuckTimer = 0;
      enemy.sidestepTimer = 0;
    }

    if (enemy.stuckTimer > STUCK_THRESHOLD * 4) {
      if (enemy.sidestepTimer <= 0) {
        enemy.sidestepSign = Math.random() < 0.5 ? -1 : 1;
        enemy.sidestepTimer = STUCK_SIDESTEP;
      }
    }

    if (enemy.sidestepTimer > 0) {
      const perpendicular = {
        x: -direction.y * enemy.sidestepSign,
        y: direction.x * enemy.sidestepSign,
      };

      const sidestepSpeed = speed * 0.85;

      this.world.collision.moveEntity(
        enemy,
        perpendicular.x * sidestepSpeed * deltaTime,
        perpendicular.y * sidestepSpeed * deltaTime,
        this.world.enemies,
      );
    }
  }
}

export const AI_CONSTANTS = {
  STUCK_THRESHOLD,
  STUCK_SIDESTEP,
  STUCK_COOLDOWN,
  ARRIVE_EPSILON,
  RETURN_ARRIVE,
  RETURN_MARGIN,
  RETARGET_INTERVAL,
};
