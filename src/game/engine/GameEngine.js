import { createPlayer } from "../entities/Player.js";
import { createTrainingDummies } from "../entities/TrainingDummy.js";
import { EnemyAI } from "../enemies/EnemyAI.js";
import { CollisionSystem } from "../collision/CollisionSystem.js";
import { StatusSystem } from "../effects/StatusSystem.js";
import { EffectSystem } from "../effects/EffectSystem.js";
import { DamageSystem } from "../combat/DamageSystem.js";
import { SkillSystem } from "../skills/SkillSystem.js";
import { distance, normalize } from "../math.js";
import { SpriteSheet } from "../sprites/SpriteSheet.js";
import { getClassSprite } from "../../data/sprites/index.js";
import { getEnemySprite } from "../../data/sprites/enemies.js";
import {
  computeMinimapTransform,
  drawMinimap,
  MINIMAP_HEIGHT,
  MINIMAP_RIGHT,
  MINIMAP_TOP,
  MINIMAP_WIDTH,
} from "../ui/minimap.js";
import { MAP_META } from "../../data/maps/index.js";
import {
  BEHAVIOR,
  createCreatureRoster,
} from "../../data/enemies/index.js";
import {
  isSkillAuto,
  setSkillAuto,
} from "./autoSkills.js";

const AUTO_RETARGET_INTERVAL = 0.25;
const AUTO_LEASH_RANGE = 1500;
const AUTO_LOW_HEALTH = 0.6;

const CONTROLLED_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "Space",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "KeyR",
  "Backspace",
  "KeyT",
]);

const STATUS_COLORS = {
  poison: "#83d65b",
  burning: "#ff744d",
  stun: "#ffe36d",
  freeze: "#77dfff",
  root: "#be8cff",
  curse: "#d65c9d",
  weaken: "#b574d8",
  slow: "#7ba8c9",
};

const AFFINITY_COLORS = [
  "#fff4a8",
  "#66d9ff",
  "#a4d96c",
  "#e5f7ff",
  "#ff805c",
  "#67e890",
  "#b76cff",
];

const SKILL_CODE_PATTERN = /^Digit([1-8])$/;

const ACTIVE_RANGE = 1700;
const EMPTY_LIST = [];

const BEHAVIOR_COLORS = {
  [BEHAVIOR.PASSIVE]: "#6fbf8a",
  [BEHAVIOR.SEMI_PASSIVE]: "#f2c14d",
  [BEHAVIOR.ACTIVE]: "#e05a4a",
};

const ZONE_BEHAVIOR_COLORS = {
  training: "#6fbf8a",
  passive: "#6fbf8a",
  semi: "#f2c14d",
  active: "#e05a4a",
};

export class GameEngine {
  constructor(canvas, classDefinition, onSnapshot) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.classDefinition = classDefinition;
    this.onSnapshot = onSnapshot;

    this.viewport = {
      width: 1,
      height: 1,
      dpr: 1,
    };

    this.input = {
      keys: new Set(),
      pointer: {
        x: classDefinition.stats.range + 100,
        y: 0,
        inside: false,
      },
    };

    this.selectedTargetId = null;
    this.skillPage = 0;
    this.message = null;
    this.destroyed = false;
    this.lastTime = performance.now();
    this.snapshotAccumulator = 0;
    this.canvasRect = null;

    this.autoPlay = false;
    this.engagedTargetId = null;
    this.autoDecisionTimer = 0;
    this.autoMoveDirection = null;
    this.autoFacing = null;
    this.autoLeashRange = AUTO_LEASH_RANGE;

    this.world = {
      time: 0,

      player: createPlayer(classDefinition, {
        x: 1200,
        y: 800,
      }),

      enemies: [
        ...createTrainingDummies(),
        ...createCreatureRoster(),
      ],

      projectiles: [],
      pendingPulses: [],
      delayedEffects: [],

      map: null,
      collision: null,
      statuses: null,
      damage: null,
      effects: null,

      enemiesPush(target, velocityX, velocityY) {
        target.pushVelocity.x += velocityX;
        target.pushVelocity.y += velocityY;
      },
    };

    this.effects = new EffectSystem();
    this.statuses = new StatusSystem();
    this.damage = new DamageSystem({
      statuses: this.statuses,
      effects: this.effects,
      onDamaged: (attacker, target) => {
        if (attacker === this.world.player) {
          this.enemyAI?.provoke(target);
        }
      },
    });

    this.enemyAI = new EnemyAI(this.world, {
      onDamagePlayer: (enemy, amount) =>
        this.damage.applyDamage(enemy, this.world.player, {
          id: `${enemy.id}_attack`,
          damage: amount,
          damageType: "physical",
          color: enemy.color,
        }),
    });

    this.world.effects = this.effects;
    this.world.statuses = this.statuses;
    this.world.damage = this.damage;
    this.world.collision = null;

    this.skillSystem = new SkillSystem(
      this.world,
      (message) => this.showMessage(message, true),
    );

    this.autoBasicAction = classDefinition.basicAttack;

    this.autoActions = [
      this.autoBasicAction,
      ...classDefinition.skills.filter(Boolean),
    ];

    this.spriteSheet = null;
    this.spriteTime = 0;
    this.minimapCache = null;

    const spriteDefinition = getClassSprite(
      classDefinition.id,
    );

    if (spriteDefinition) {
      this.spriteSheet = new SpriteSheet(
        spriteDefinition,
      );
    }

    this.enemySprites = new Map();

    for (const enemy of this.world.enemies) {
      if (!enemy.isCreature) continue;

      const definition = getEnemySprite(enemy.id);

      if (!definition) continue;

      this.enemySprites.set(
        enemy.id,
        new SpriteSheet(definition),
      );
    }

    this.boundLoop = this.boundLoop.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.refreshCanvasRect =
      this.refreshCanvasRect.bind(this);

    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleContextMenu = (event) => event.preventDefault();

    this.canvas.addEventListener(
      "pointermove",
      this.handlePointerMove,
    );

    this.canvas.addEventListener(
      "pointerleave",
      this.handlePointerLeave,
    );

    this.canvas.addEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("resize", this.handleResize);
    window.addEventListener(
      "scroll",
      this.refreshCanvasRect,
      true,
    );

    this.canvas.addEventListener(
      "contextmenu",
      this.handleContextMenu,
    );

    this.handleResize();
    this.sendSnapshot();

    this.animationFrame = requestAnimationFrame(
      this.boundLoop,
    );
  }

  setMap(map) {
    this.world.map = map;
    this.world.collision = new CollisionSystem(map);
    this.world.player.x = map.spawn.x;
    this.world.player.y = map.spawn.y;
  }

  destroy() {
    this.destroyed = true;

    cancelAnimationFrame(this.animationFrame);

    this.spriteSheet?.destroy();
    this.spriteSheet = null;

    for (const sheet of this.enemySprites.values()) {
      sheet.destroy();
    }

    this.enemySprites.clear();

    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener(
      "scroll",
      this.refreshCanvasRect,
      true,
    );

    this.canvas.removeEventListener(
      "pointermove",
      this.handlePointerMove,
    );

    this.canvas.removeEventListener(
      "pointerleave",
      this.handlePointerLeave,
    );

    this.canvas.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    this.canvas.removeEventListener(
      "contextmenu",
      this.handleContextMenu,
    );
  }

  refreshCanvasRect() {
    this.canvasRect =
      this.canvas.getBoundingClientRect();
  }

  handleResize() {
    this.refreshCanvasRect();

    this.viewport.width = Math.max(1, this.canvasRect.width);
    this.viewport.height = Math.max(1, this.canvasRect.height);
    this.viewport.dpr = Math.min(
      window.devicePixelRatio || 1,
      2,
    );

    this.canvas.width = Math.round(
      this.viewport.width * this.viewport.dpr,
    );

    this.canvas.height = Math.round(
      this.viewport.height * this.viewport.dpr,
    );

    this.context.imageSmoothingEnabled = false;
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvasRect;

    return {
      x:
        clientX -
        rect.left -
        this.viewport.width / 2 +
        this.world.player.x,
      y:
        clientY -
        rect.top -
        this.viewport.height / 2 +
        this.world.player.y,
    };
  }

  handlePointerMove(event) {
    this.input.pointer = {
      ...this.screenToWorld(
        event.clientX,
        event.clientY,
      ),
      inside: true,
    };
  }

  handlePointerLeave() {
    this.input.pointer.inside = false;
  }

  handlePointerDown(event) {
    if (event.button !== 0) return;

    const point = this.screenToWorld(
      event.clientX,
      event.clientY,
    );

    this.input.pointer = {
      ...point,
      inside: true,
    };

    const target = this.world.enemies.find(
      (enemy) =>
        enemy.alive &&
        (enemy.x - point.x) ** 2 + (enemy.y - point.y) ** 2 <=
          (enemy.radius + 18) ** 2,
    );

    this.selectedTargetId = target?.id ?? null;
    this.engagedTargetId = target?.id ?? null;

    this.useBasicAttack();
  }

  handleKeyDown(event) {
    if (CONTROLLED_CODES.has(event.code)) {
      event.preventDefault();
    }

    this.input.keys.add(event.code);

    if (event.repeat) return;

    if (event.code === "Space") {
      this.useBasicAttack();
      return;
    }

    const match = SKILL_CODE_PATTERN.exec(event.code);

    if (match) {
      this.useSkillSlot(this.skillPage * 8 + Number(match[1]));
      return;
    }

    if (event.code === "KeyR") {
      this.useUltimate();
      return;
    }

    if (event.code === "Backspace") {
      this.resetTargets();
      return;
    }

    if (event.code === "KeyT") {
      this.toggleAutoPlay();
    }
  }

  handleKeyUp(event) {
    this.input.keys.delete(event.code);
  }

  handleBlur() {
    this.input.keys.clear();
  }

  setSkillPage(page) {
    this.skillPage = Math.max(0, page);
  }

  setAutoPlay(enabled) {
    const next = Boolean(enabled);

    if (next === this.autoPlay) return;

    this.autoPlay = next;
    this.autoDecisionTimer = 0;

    if (!next) {
      this.engagedTargetId = null;
      this.selectedTargetId = null;
      this.autoMoveDirection = null;
      this.autoFacing = null;
    }

    this.showMessage(
      next
        ? "Auto play ativado."
        : "Auto play desativado.",
    );

    this.sendSnapshot();
  }

  toggleAutoPlay() {
    this.setAutoPlay(!this.autoPlay);
  }

  isAutoActive() {
    return (
      this.autoPlay || this.engagedTargetId !== null
    );
  }

  setSkillAuto(skillId, enabled) {
    return setSkillAuto(skillId, enabled);
  }

  getSkillAuto(skillId) {
    return isSkillAuto(skillId);
  }

  useSkillSlot(slot) {
    const action = this.classDefinition.skills[slot - 1];

    if (!action) return false;

    return this.skillSystem.request(
      action,
      this.input.pointer,
      this.selectedTargetId,
    );
  }

  useSkill(index) {
    return this.useSkillSlot(index + 1);
  }

  useUltimate() {
    return this.skillSystem.request(
      this.classDefinition.ultimate,
      this.input.pointer,
      this.selectedTargetId,
    );
  }

  useBasicAttack() {
    return this.skillSystem.request(
      this.classDefinition.basicAttack,
      this.input.pointer,
      this.selectedTargetId,
    );
  }

  showMessage(text, bad = false) {
    this.message = {
      text,
      bad,
      remaining: 2.5,
    };
  }

  resetTargets() {
    for (const enemy of this.world.enemies) {
      enemy.hp = enemy.maxHp;
      enemy.alive = true;
      enemy.respawnTimer = 0;
      enemy.statusEffects = [];
      enemy.pushVelocity = { x: 0, y: 0 };
      enemy.hitFlash = 0;
    }

    this.selectedTargetId = null;
    this.engagedTargetId = null;

    this.showMessage("Bonecos de treinamento restaurados.");
  }

  findEnemyById(id) {
    if (id === null || id === undefined) {
      return null;
    }

    return (
      this.world.enemies.find(
        (enemy) => enemy.id === id && enemy.alive,
      ) ?? null
    );
  }

  pickAutoTarget() {
    const player = this.world.player;
    const leash = this.autoLeashRange;

    let best = null;
    let bestDistance = Infinity;

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const squared = dx * dx + dy * dy;

      if (squared > leash * leash) continue;

      if (squared < bestDistance) {
        bestDistance = squared;
        best = enemy;
      }
    }

    return best;
  }

  canAutoUse(action) {
    if (!action) return false;

    const player = this.world.player;

    if (player.hp <= 0) return false;
    if (player.cast) return false;

    if (!this.statuses.canCastSkill(player)) {
      return false;
    }

    if ((player.cooldowns[action.id] ?? 0) > 0) {
      return false;
    }

    const reserve =
      this.classDefinition.basicAttack.resourceCost ?? 0;

    return (
      player.resource >= action.resourceCost + reserve
    );
  }

  isAutoInRange(action, targetDistance) {
    switch (action.type) {
      case "self":
        return true;

      case "circle":
        return targetDistance <= (action.radius ?? 0) + 40;

      case "dash":
        return targetDistance <= (action.distance ?? 0);

      default:
        return targetDistance <= (action.range ?? 0);
    }
  }

  findAutoAction(targetDistance, filter, score) {
    let best = null;
    let bestScore = -Infinity;

    const candidates = this.autoActions;

    for (const action of candidates) {
      if (!action) continue;

      if (
        action !== this.autoBasicAction &&
        !isSkillAuto(action.id)
      ) {
        continue;
      }

      if (!filter(action)) continue;
      if (!this.canAutoUse(action)) continue;
      if (!this.isAutoInRange(action, targetDistance)) {
        continue;
      }

      const value = score(action);

      if (value > bestScore) {
        bestScore = value;
        best = action;
      }
    }

    return best;
  }

  chooseAutoAction(targetDistance) {
    const player = this.world.player;

    const lowHealth =
      player.hp <= player.maxHp * AUTO_LOW_HEALTH;

    if (lowHealth) {
      const defensive = this.findAutoAction(
        targetDistance,
        (action) =>
          (action.healing ?? 0) > 0 ||
          (action.shield ?? 0) > 0,
        (action) =>
          (action.healing ?? 0) +
          (action.shield ?? 0) * 2 +
          (action.restoreResource ?? 0) * 0.5,
      );

      if (defensive) return defensive;
    }

    return this.findAutoAction(
      targetDistance,
      (action) =>
        (action.damage ?? 0) > 0 ||
        (action.healing ?? 0) > 0 ||
        (action.shield ?? 0) > 0 ||
        (action.restoreResource ?? 0) > 0 ||
        (action.selfEffects ?? []).length > 0,
      (action) =>
        (action.damage ?? 0) +
        (action.hits ?? 1) * 0.5 +
        (action.lifesteal ?? 0) * 40,
    );
  }

  getAutoDesiredRange() {
    const basic = this.classDefinition.basicAttack;

    return Math.max(
      55,
      (basic.range ?? 100) * 0.7,
    );
  }

  updateAutoPlay(deltaTime) {
    this.autoMoveDirection = null;
    this.autoFacing = null;

    if (!this.isAutoActive()) return;

    const player = this.world.player;

    if (player.hp <= 0) return;

    let target = this.findEnemyById(
      this.engagedTargetId,
    );

    if (target) {
      this.selectedTargetId = target.id;
    } else {
      if (this.engagedTargetId !== null) {
        this.engagedTargetId = null;

        if (!this.autoPlay) {
          this.selectedTargetId = null;
          this.showMessage("Alvo eliminado.");
          return;
        }
      }

      this.autoDecisionTimer -= deltaTime;

      if (this.autoDecisionTimer <= 0) {
        this.autoDecisionTimer = AUTO_RETARGET_INTERVAL;

        this.selectedTargetId =
          this.pickAutoTarget()?.id ?? null;
      }

      target = this.findEnemyById(
        this.selectedTargetId,
      );

      if (!target) return;
    }

    const targetDistance = distance(player, target);

    this.autoFacing = {
      x: target.x - player.x,
      y: target.y - player.y,
    };

    if (
      targetDistance > this.getAutoDesiredRange() &&
      this.statuses.canMove(player)
    ) {
      this.autoMoveDirection = normalize(
        this.autoFacing.x,
        this.autoFacing.y,
      );
    }

    const action = this.chooseAutoAction(targetDistance);

    if (!action) return;

    this.skillSystem.request(
      action,
      {
        x: target.x,
        y: target.y,
        inside: true,
      },
      target.id,
    );
  }

  update(deltaTime) {
    this.world.time += deltaTime;

    if (this.message) {
      this.message.remaining -= deltaTime;

      if (this.message.remaining <= 0) {
        this.message = null;
      }
    }

    this.updateCooldowns(deltaTime);
    this.updateAutoPlay(deltaTime);
    this.updatePlayer(deltaTime);

    this.spriteTime += deltaTime;

    this.skillSystem.update(deltaTime);

    this.statuses.update(
      this.world.player,
      deltaTime,
    );

    this.updateEnemies(deltaTime);

    this.effects.update(deltaTime);

    this.snapshotAccumulator += deltaTime;

    if (this.snapshotAccumulator >= 0.1) {
      this.snapshotAccumulator = 0;
      this.sendSnapshot();
    }
  }

  updateCooldowns(deltaTime) {
    const cooldowns = this.world.player.cooldowns;

    for (const id in cooldowns) {
      const next = Math.max(
        0,
        cooldowns[id] - deltaTime,
      );

      if (next === 0) {
        delete cooldowns[id];
      } else {
        cooldowns[id] = next;
      }
    }
  }

  updatePlayer(deltaTime) {
    const player = this.world.player;

    if (player.hp <= 0) {
      player.isMoving = false;
      return;
    }

    const keys = this.input.keys;

    let movementX = 0;
    let movementY = 0;

    if (keys.has("KeyA") || keys.has("ArrowLeft")) {
      movementX -= 1;
    }

    if (keys.has("KeyD") || keys.has("ArrowRight")) {
      movementX += 1;
    }

    if (keys.has("KeyW") || keys.has("ArrowUp")) {
      movementY -= 1;
    }

    if (keys.has("KeyS") || keys.has("ArrowDown")) {
      movementY += 1;
    }

    const direction = this.autoMoveDirection
      ? this.autoMoveDirection
      : normalize(movementX, movementY);

    const statusMultiplier = this.statuses.getMultiplier(
      player,
      "movementSpeed",
    );

    player.isMoving = direction.x !== 0 || direction.y !== 0;

    if (
      player.isMoving &&
      this.statuses.canMove(player)
    ) {
      const castMultiplier = player.cast ? 0.55 : 1;

      const speed =
        player.speed *
        statusMultiplier *
        castMultiplier;

      this.world.collision.moveEntity(
        player,
        direction.x * speed * deltaTime,
        direction.y * speed * deltaTime,
        this.world.enemies,
      );

      player.moveDirection = direction;
      player.animationTime += deltaTime * 9;
    } else {
      player.animationTime += deltaTime * 2;
    }

    if (this.autoFacing) {
      player.facing = normalize(
        this.autoFacing.x,
        this.autoFacing.y,
      );
    } else if (this.input.pointer.inside) {
      const facing = normalize(
        this.input.pointer.x - player.x,
        this.input.pointer.y - player.y,
      );

      player.facing = facing;
    }

    const resourceRegen =
      player.definition.stats.resourceRegen *
      this.statuses.getMultiplier(
        player,
        "resourceRegen",
      );

    player.resource = Math.min(
      player.maxResource,
      player.resource + resourceRegen * deltaTime,
    );

    for (const effect of player.statusEffects) {
      if (
        effect.type === "regeneration" &&
        effect.value > 0
      ) {
        this.damage.heal(
          player,
          Math.round(effect.value * deltaTime),
        );
      }
    }

    player.attackAnimation = Math.max(
      0,
      player.attackAnimation - deltaTime,
    );

    player.hitFlash = Math.max(
      0,
      player.hitFlash - deltaTime,
    );
  }

  updateEnemies(deltaTime) {
    const player = this.world.player;
    const allEnemies = this.world.enemies;
    const emptyList = EMPTY_LIST;

    for (const enemy of allEnemies) {
      if (!enemy.alive) {
        enemy.respawnTimer -= deltaTime;

        if (enemy.respawnTimer <= 0) {
          enemy.hp = enemy.maxHp;
          enemy.alive = true;
          enemy.statusEffects = [];
          enemy.pushVelocity = { x: 0, y: 0 };
          enemy.aiState = "idle";
          enemy.alerted = false;
          enemy.provoked = false;
          enemy.wanderTarget = null;
        }

        continue;
      }

      enemy.hitFlash = Math.max(
        0,
        enemy.hitFlash - deltaTime,
      );

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const nearPlayer =
        dx * dx + dy * dy <= ACTIVE_RANGE * ACTIVE_RANGE;

      this.statuses.update(enemy, deltaTime);

      const damping = Math.exp(-8 * deltaTime);

      this.world.collision.moveEntity(
        enemy,
        enemy.pushVelocity.x * deltaTime,
        enemy.pushVelocity.y * deltaTime,
        nearPlayer ? allEnemies : emptyList,
      );

      enemy.pushVelocity.x *= damping;
      enemy.pushVelocity.y *= damping;

      if (
        Math.abs(enemy.pushVelocity.x) < 0.5 &&
        Math.abs(enemy.pushVelocity.y) < 0.5
      ) {
        enemy.pushVelocity = { x: 0, y: 0 };
      }

      if (enemy.hp <= 0) {
        enemy.alive = false;
        enemy.respawnTimer = 5;
        enemy.aiState = "dead";
        enemy.wanderTarget = null;
        enemy.alerted = false;
        enemy.provoked = false;
        enemy.stuckTimer = 0;
        enemy.sidestepTimer = 0;
        continue;
      }

      if (enemy.isCreature && nearPlayer) {
        this.enemyAI.update(enemy, deltaTime);
      }
    }
  }

  sendSnapshot() {
    if (!this.onSnapshot) return;

    const player = this.world.player;
    const selectedTarget = this.world.enemies.find(
      (enemy) =>
        enemy.id === this.selectedTargetId && enemy.alive,
    );

    this.onSnapshot({
      time: this.world.time,

      autoPlay: this.autoPlay,
      engaged: this.engagedTargetId !== null,

      player: {
        id: player.id,
        name: player.name,
        className: player.definition.name,
        level: player.level,

        hp: Math.ceil(player.hp),
        maxHp: player.maxHp,

        resource: Math.floor(player.resource),
        maxResource: player.maxResource,
        resourceName: player.definition.resource.name,

        shield: Math.ceil(player.shield),
        attack: player.attack,
        defense: player.defense,
        speed: player.speed,

        casting: Boolean(player.cast),
        castingName: player.cast?.action.name ?? null,

        statusEffects: this.statuses.snapshot(player),
      },

      cooldowns: {
        ...player.cooldowns,
      },

      selectedTarget: selectedTarget
        ? {
            id: selectedTarget.id,
            name: selectedTarget.name,
            hp: Math.ceil(selectedTarget.hp),
            maxHp: selectedTarget.maxHp,
            statusEffects: this.statuses.snapshot(
              selectedTarget,
            ),
          }
        : null,

      message: this.message
        ? {
            text: this.message.text,
            bad: this.message.bad,
          }
        : null,
    });
  }

  boundLoop(timestamp) {
    if (this.destroyed) return;

    const deltaTime = Math.min(
      (timestamp - this.lastTime) / 1000,
      0.05,
    );

    this.lastTime = timestamp;

    this.update(deltaTime);
    this.render();

    this.animationFrame = requestAnimationFrame(
      this.boundLoop,
    );
  }

  render() {
    const context = this.context;
    const { width, height, dpr } = this.viewport;
    const player = this.world.player;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    context.clearRect(0, 0, width, height);

    context.fillStyle = "#080c10";
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(
      width / 2 - player.x,
      height / 2 - player.y,
    );

    this.drawMap(context);
    this.drawAim(context);
    this.drawSelectedTarget(context);
    this.drawEnemies(context);
    this.drawProjectiles(context);
    this.drawPlayer(context);
    this.effects.draw(context);

    context.restore();

    if (this.input.pointer.inside) {
      this.drawCrosshair(context);
    }

    this.drawMinimap(context, width, height);
  }

  drawMinimap(context, width, height) {
    if (!this.world.map) return;

    const panelWidth = Math.min(
      MINIMAP_WIDTH,
      width - MINIMAP_RIGHT * 2,
    );

    const panelHeight = Math.min(
      MINIMAP_HEIGHT,
      height - MINIMAP_TOP - MINIMAP_RIGHT,
    );

    if (panelWidth < 80 || panelHeight < 60) {
      return;
    }

    const originX = width - MINIMAP_RIGHT - panelWidth;
    const originY = MINIMAP_TOP;

    drawMinimap(context, {
      map: this.world.map,
      zones: MAP_META.zones,
      player: this.world.player,
      enemies: this.world.enemies,
      viewport: {
        width: this.viewport.width,
        height: this.viewport.height,
      },
      width: panelWidth,
      height: panelHeight,
      originX,
      originY,
      transform: this.getMinimapTransform(
        panelWidth,
        panelHeight,
      ),
    });
  }

  getMinimapTransform(panelWidth, panelHeight) {
    const cache = this.minimapCache;

    if (
      cache &&
      cache.panelWidth === panelWidth &&
      cache.panelHeight === panelHeight
    ) {
      return cache.transform;
    }

    const transform = computeMinimapTransform(
      this.world.map,
      panelWidth,
      panelHeight,
    );

    this.minimapCache = {
      panelWidth,
      panelHeight,
      transform,
    };

    return transform;
  }

  drawMap(context) {
    const map = this.world.map;

    context.fillStyle = map.background;
    context.fillRect(0, 0, map.width, map.height);

    context.strokeStyle = "rgba(180, 220, 190, 0.045)";
    context.lineWidth = 1;
    context.beginPath();

    for (let x = 0; x <= map.width; x += 80) {
      context.moveTo(x, 0);
      context.lineTo(x, map.height);
    }

    for (let y = 0; y <= map.height; y += 80) {
      context.moveTo(0, y);
      context.lineTo(map.width, y);
    }

    context.stroke();

    for (const zone of map.zones) {
      context.fillStyle = zone.color;
      context.fillRect(
        zone.x,
        zone.y,
        zone.width,
        zone.height,
      );

      context.fillStyle = "rgba(255,255,255,0.17)";
      context.font = "600 16px Inter, sans-serif";
      context.textAlign = "center";
      context.fillText(
        zone.label,
        zone.x + zone.width / 2,
        zone.y + 35,
      );
    }

    context.lineWidth = 8;
    context.strokeStyle = "#647064";
    context.strokeRect(
      map.bounds.x,
      map.bounds.y,
      map.bounds.width,
      map.bounds.height,
    );

    for (const wall of map.walls) {
      context.fillStyle = "rgba(0,0,0,0.28)";
      context.fillRect(
        wall.x + 8,
        wall.y + 10,
        wall.width,
        wall.height,
      );

      context.fillStyle = "#46534e";
      context.fillRect(
        wall.x,
        wall.y,
        wall.width,
        wall.height,
      );

      context.strokeStyle = "#697970";
      context.lineWidth = 2;
      context.strokeRect(
        wall.x,
        wall.y,
        wall.width,
        wall.height,
      );

      context.fillStyle = "rgba(255,255,255,0.08)";
      context.fillRect(
        wall.x + 5,
        wall.y + 5,
        Math.max(0, wall.width - 10),
        5,
      );
    }

    for (const obstacle of map.obstacles) {
      context.fillStyle = "#735336";
      context.fillRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
      );

      context.strokeStyle = "#aa7a4f";
      context.lineWidth = 4;
      context.strokeRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
      );

      context.beginPath();
      context.moveTo(
        obstacle.x,
        obstacle.y,
      );
      context.lineTo(
        obstacle.x + obstacle.width,
        obstacle.y + obstacle.height,
      );

      context.moveTo(
        obstacle.x + obstacle.width,
        obstacle.y,
      );
      context.lineTo(
        obstacle.x,
        obstacle.y + obstacle.height,
      );

      context.stroke();
    }
  }

  drawAim(context) {
    if (!this.input.pointer.inside) return;

    const player = this.world.player;

    context.save();
    context.setLineDash([5, 8]);
    context.strokeStyle = "rgba(255,255,255,0.11)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(
      player.x,
      player.y,
      player.range,
      0,
      Math.PI * 2,
    );
    context.stroke();

    context.setLineDash([3, 10]);
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(
      this.input.pointer.x,
      this.input.pointer.y,
    );
    context.stroke();

    context.restore();
  }

  drawSelectedTarget(context) {
    const target = this.world.enemies.find(
      (enemy) =>
        enemy.id === this.selectedTargetId && enemy.alive,
    );

    if (!target) return;

    context.save();
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.setLineDash([7, 5]);
    context.beginPath();
    context.arc(
      target.x,
      target.y,
      target.radius + 10,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.restore();
  }

  drawEnemies(context) {
    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      const sheet = this.enemySprites.get(enemy.id);

      const drawn = sheet
        ? sheet.drawCreature(
            context,
            enemy,
            this.spriteTime + enemy.spriteOffset,
          )
        : false;

      if (!drawn) {
        this.drawEnemyBody(context, enemy);
      }

      this.drawEnemyStatus(context, enemy);
    }
  }

  drawEnemyShadow(context, enemy) {
    context.save();

    context.fillStyle = "rgba(0,0,0,0.28)";
    context.beginPath();
    context.ellipse(
      enemy.x,
      enemy.y + enemy.radius * 0.75,
      enemy.radius * 1.1,
      enemy.radius * 0.55,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.restore();
  }

  drawEnemyBody(context, enemy) {
    this.drawEnemyShadow(context, enemy);

    context.save();

    context.fillStyle =
      enemy.hitFlash > 0 ? "#ffffff" : enemy.color;

    context.strokeStyle = "#2c2018";
    context.lineWidth = 4;

      context.beginPath();
      context.arc(
        enemy.x,
        enemy.y,
        enemy.radius,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.stroke();

      context.fillStyle = "#493424";
      context.fillRect(
        enemy.x - 5,
        enemy.y - 8,
        4,
        4,
      );
      context.fillRect(
        enemy.x + 3,
        enemy.y - 8,
        4,
        4,
      );

      context.strokeStyle = "#493424";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(enemy.x - 7, enemy.y + 10);
      context.lineTo(enemy.x + 8, enemy.y + 10);
      context.stroke();

    context.restore();
  }

  drawEnemyStatus(context, enemy) {
    const sheet = this.enemySprites.get(enemy.id);

    const barWidth = Math.max(
      46,
      (sheet?.definition.frameWidth ?? 32) *
        (sheet?.definition.scale ?? 1),
    );

    const barY =
      enemy.y - enemy.radius - (sheet ? 34 : 18);

    context.save();

    context.fillStyle = "rgba(0,0,0,0.7)";
    context.fillRect(
      enemy.x - barWidth / 2,
      barY,
      barWidth,
      7,
    );

    context.fillStyle = "#d75c5c";
    context.fillRect(
      enemy.x - barWidth / 2 + 1,
      barY + 1,
      (barWidth - 2) * (enemy.hp / enemy.maxHp),
      5,
    );

    if (enemy.isCreature) {
      const color = BEHAVIOR_COLORS[enemy.behavior];

      context.fillStyle = color;
      context.fillRect(
        enemy.x - barWidth / 2,
        barY - 4,
        barWidth,
        2,
      );
    }

    for (
      let statusIndex = 0;
      statusIndex < Math.min(4, enemy.statusEffects.length);
      statusIndex += 1
    ) {
      const effect = enemy.statusEffects[statusIndex];

      context.fillStyle = this.getStatusColor(
        effect.type,
      );

      context.beginPath();
      context.arc(
        enemy.x - 12 + statusIndex * 8,
        barY - 9,
        3,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    context.restore();
  }

  drawProjectiles(context) {
    for (const projectile of this.world.projectiles) {
      const action = projectile.action;
      const color =
        action.color ??
        this.classDefinition.accent;

      context.save();

      context.translate(projectile.x, projectile.y);
      context.rotate(
        Math.atan2(
          projectile.velocityY,
          projectile.velocityX,
        ),
      );

      context.shadowColor = color;
      context.shadowBlur = 18;
      context.fillStyle = color;

      const style = action.projectileStyle;

      if (style === "arrow" || action.rain) {
        context.fillRect(
          -13,
          -2,
          22,
          4,
        );

        context.beginPath();
        context.moveTo(10, 0);
        context.lineTo(1, -6);
        context.lineTo(1, 6);
        context.closePath();
        context.fill();
      } else if (style === "blade") {
        context.rotate(Math.PI / 2);

        context.beginPath();
        context.moveTo(16, 0);
        context.lineTo(-12, -6);
        context.lineTo(-6, 0);
        context.lineTo(-12, 6);
        context.closePath();
        context.fill();
      } else {
        context.beginPath();
        context.arc(0, 0, projectile.radius, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "rgba(255,255,255,0.75)";
        context.beginPath();
        context.arc(
          -3,
          -3,
          projectile.radius * 0.32,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      context.restore();
    }
  }

  drawPlayer(context) {
    const player = this.world.player;

    if (player.hp <= 0) return;

    const cloaked = this.statuses.has(player, "cloak");

    context.save();
    context.globalAlpha = cloaked ? 0.45 : 1;

    context.fillStyle = "rgba(0,0,0,0.38)";
    context.beginPath();
    context.ellipse(
      player.x,
      player.y + 17,
      25,
      12,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    const drawnSprite =
      this.spriteSheet?.draw(
        context,
        player,
        this.spriteTime,
      ) ?? false;

    if (!drawnSprite) {
      this.drawPlayerBody(context, player);
    }

    context.restore();

    if (player.shield > 0) {
      context.save();
      context.strokeStyle = "rgba(109,197,255,0.75)";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(
        player.x,
        player.y,
        31,
        0,
        Math.PI * 2,
      );
      context.stroke();
      context.restore();
    }

    if (
      player.definition.id === "summoner" &&
      this.statuses.has(player, "elementalAffinity")
    ) {
      const colors = AFFINITY_COLORS;

      for (let index = 0; index < colors.length; index += 1) {
        const angle =
          (index / colors.length) * Math.PI * 2 +
          player.animationTime * 0.015;

        context.fillStyle = colors[index];
        context.beginPath();
        context.arc(
          player.x + Math.cos(angle) * 38,
          player.y + Math.sin(angle) * 38,
          5,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
  }

  drawPlayerBody(context, player) {
    const bob = player.isMoving
      ? Math.sin(player.animationTime) * 2
      : Math.sin(player.animationTime * 0.55) * 0.8;

    context.save();

    context.translate(player.x, player.y);
    context.rotate(
      Math.atan2(
        player.facing.y,
        player.facing.x,
      ),
    );

    context.fillStyle = "#222b38";
    context.beginPath();
    context.ellipse(
      0,
      5 + bob,
      21,
      17,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.strokeStyle = this.classDefinition.accent;
    context.lineWidth = 4;

    context.beginPath();
    context.arc(
      0,
      5 + bob,
      18,
      0,
      Math.PI * 2,
    );
    context.stroke();

    context.fillStyle =
      player.hitFlash > 0
        ? "#ffffff"
        : this.classDefinition.accent;

    context.beginPath();
    context.arc(
      7,
      0 + bob,
      9,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.fillStyle = "#e7c7a2";
    context.beginPath();
    context.arc(
      10,
      0 + bob,
      5,
      0,
      Math.PI * 2,
    );
    context.fill();

    if (player.attackAnimation > 0) {
      const weaponLength =
        player.definition.id === "arbalist"
          ? 35
          : 29;

      context.strokeStyle = "#e4e8ef";
      context.lineWidth =
        player.definition.id === "warrior"
          ? 7
          : 4;

      context.beginPath();
      context.moveTo(16, 12);
      context.lineTo(weaponLength, 12);
      context.stroke();
    }

    context.restore();
  }

  drawCrosshair(context) {
    const screenX =
      this.input.pointer.x -
      this.world.player.x +
      this.viewport.width / 2;

    const screenY =
      this.input.pointer.y -
      this.world.player.y +
      this.viewport.height / 2;

    context.save();
    context.strokeStyle = "rgba(255,255,255,0.85)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(screenX, screenY, 8, 0, Math.PI * 2);
    context.moveTo(screenX - 13, screenY);
    context.lineTo(screenX - 5, screenY);
    context.moveTo(screenX + 5, screenY);
    context.lineTo(screenX + 13, screenY);
    context.moveTo(screenX, screenY - 13);
    context.lineTo(screenX, screenY - 5);
    context.moveTo(screenX, screenY + 5);
    context.lineTo(screenX, screenY + 13);
    context.stroke();
    context.restore();
  }

  getStatusColor(type) {
    return STATUS_COLORS[type] ?? "#ffffff";
  }
}
