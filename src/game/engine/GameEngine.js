import { createPlayer } from "../entities/Player.js";
import { createTrainingDummies } from "../entities/TrainingDummy.js";
import { EnemyAI } from "../enemies/EnemyAI.js";
import { Inventory } from "../inventory/Inventory.js";
import { Equipment } from "../equipment/Equipment.js";
import {
  grantXp,
  statsForLevel,
  xpForKill,
  xpToNext,
} from "../progression/Levels.js";
import { QuestLog } from "../quests/QuestLog.js";
import { Bestiary } from "../bestiary/Bestiary.js";
import { isAutoCompletable } from "../../data/quests/index.js";
import { RARITY_ORDER } from "../../data/items/index.js";
import { LootSystem } from "../loot/LootSystem.js";
import {
  describeFilter,
  isCollectedId,
  loadLootFilter,
  LOOT_CATEGORY,
  normalizeLootFilter,
  saveLootFilter,
} from "../loot/lootFilter.js";
import { TerrainRenderer } from "../terrain/TerrainRenderer.js";
import { PropRenderer } from "../props/PropRenderer.js";
import {
  getItem,
  ITEM_TYPE,
  rarityOf,
} from "../../data/items/index.js";
import {
  describeBonus,
  getBestiaryEntry,
} from "../../data/bestiary/index.js";

function itemTypeOf(itemId) {
  return getItem(itemId)?.type ?? null;
}

/**
 * soma dicionarios de bonus stat por chave.
 * spread nao serve aqui: equipamento e bestiario usam as mesmas
 * chaves (maxHp, attack...) e uma sobrescreveria a outra.
 */
export function mergeBonuses(...sources) {
  const total = {};

  for (const source of sources) {
    for (const [stat, value] of Object.entries(
      source ?? {},
    )) {
      total[stat] = (total[stat] ?? 0) + value;
    }
  }

  return total;
}
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
  MINIMAP_SLIDE,
  MINIMAP_TOP_IDLE,
  MINIMAP_TOP_TARGETED,
  MINIMAP_WIDTH,
} from "../ui/minimap.js";
import { getZoneById, MAP_META } from "../../data/maps/index.js";
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

const COIN_COLOR = "#ffc857";

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

    this.bestiaryTargetType = null;
    this.bestiaryOwnsAutoPlay = false;

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
      drops: [],
      inventory: new Inventory(),
      equipment: new Equipment(),
      quests: new QuestLog(),
      bestiary: new Bestiary(),

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
    this.loot = new LootSystem(this.world);
    this.lootFilter = loadLootFilter();
    this.loot.setFilter(this.lootFilter);

    this.damage = new DamageSystem({
      statuses: this.statuses,
      effects: this.effects,
      onDamaged: (attacker, target) => {
        if (attacker === this.world.player) {
          this.enemyAI?.provoke(target);
        }
      },
      onDeath: (attacker, target) => {
        this.handleKill(target);
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
    this.terrain = new TerrainRenderer();
    this.props = new PropRenderer();
    this.world.sort = [];
    this.frameErrors = 0;
    this.minimapY = MINIMAP_TOP_IDLE;
    this.frameDelta = 1 / 60;

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
    this.applyEquipment();
    this.sendSnapshot();

    this.animationFrame = requestAnimationFrame(
      this.boundLoop,
    );
  }

  setMap(map) {
    this.world.map = map;
    this.world.collision = new CollisionSystem(map);
    this.world.props = map.props ?? [];
    this.world.player.x = map.spawn.x;
    this.world.player.y = map.spawn.y;
    this.autoWaypoint = null;
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
      this.autoWaypoint = null;

      // o botao de auto e parada-mestre: se a cacada do bestiario
      // sobreviver a ele, a box continuaria mostrando AUTO sem
      // ninguem cacando. clearBestiaryAuto nao volta aqui porque
      // o alvo ja foi limpo antes.
      this.bestiaryTargetType = null;
      this.bestiaryOwnsAutoPlay = false;
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
      this.autoPlay ||
      this.engagedTargetId !== null ||
      this.bestiaryTargetType !== null ||
      this.getQuestObjective() !== null
    );
  }

  /**
   * o auto do bestiario e um auto dedicado a uma criatura: ele
   * vira o objetivo do piloto, entao todo o resto (escolher alvo,
   * ir ate a zona, chegar na distancia) ja funciona sem duplicar
   * nada. clicar no mesmo bicho de novo desliga.
   */
  toggleBestiaryAuto(creatureId) {
    if (this.bestiaryTargetType === creatureId) {
      return this.clearBestiaryAuto();
    }

    return this.setBestiaryAuto(creatureId);
  }

  setBestiaryAuto(creatureId) {
    const entry = getBestiaryEntry(creatureId);

    if (!entry) {
      this.showMessage(
        "Criatura desconhecida no bestiario.",
        true,
      );

      this.sendSnapshot();

      return false;
    }

    this.bestiaryTargetType = entry.creatureId;
    this.autoDecisionTimer = 0;
    this.engagedTargetId = null;
    this.selectedTargetId = null;
    this.autoWaypoint = null;

    if (!this.autoPlay) {
      this.bestiaryOwnsAutoPlay = true;
      this.setAutoPlay(true);
    }

    this.showMessage(
      `Auto: caçando ${entry.name}` +
        `${entry.zoneName ? ` em ${entry.zoneName}` : ""}.`,
    );

    this.sendSnapshot();

    return true;
  }

  clearBestiaryAuto() {
    if (this.bestiaryTargetType === null) return false;

    const entry = getBestiaryEntry(this.bestiaryTargetType);

    this.bestiaryTargetType = null;
    this.selectedTargetId = null;
    this.autoDecisionTimer = 0;
    this.autoWaypoint = null;

    if (this.bestiaryOwnsAutoPlay) {
      this.bestiaryOwnsAutoPlay = false;
      this.setAutoPlay(false);
    }

    this.showMessage(
      `Auto do bestiario desligado` +
        `${entry ? `: ${entry.name}` : ""}.`,
    );

    this.sendSnapshot();

    return true;
  }

  get isBestiaryAutoOn() {
    return this.bestiaryTargetType !== null;
  }

  bestiaryAutoSnapshot() {
    if (this.bestiaryTargetType === null) return null;

    const entry = getBestiaryEntry(this.bestiaryTargetType);

    if (!entry) return null;

    return {
      creatureId: entry.creatureId,
      name: entry.name,
      icon: entry.icon,
      color: entry.color,
      zoneId: entry.zoneId,
      zoneName: entry.zoneName,
      kills: this.world.bestiary.kills.get(entry.creatureId) ?? 0,
    };
  }

  /**
   * o objetivo que o auto segue agora. quando o bestiario esta
   * ativo ele tem prioridade sobre a missao, e usa o mesmo formato
   * { target, location } para o piloto nao saber a diferenca.
   */
  getAutoObjective() {
    if (this.bestiaryTargetType !== null) {
      const entry = getBestiaryEntry(this.bestiaryTargetType);

      if (entry) {
        return {
          target: entry.creatureId,
          location: entry.zoneId,
          summary: `Cacar ${entry.name}`,
          fromBestiary: true,
        };
      }
    }

    return this.getQuestObjective();
  }

  focusQuest(questId) {
    const quests = this.world.quests;

    const wasAuto =
      quests.autoEnabled && quests.objectiveId === questId;

    if (!quests.focusQuest(questId)) return false;

    const quest = quests.currentObjective;

    if (!isAutoCompletable(quest)) {
      this.showMessage(
        "Esta missÃ£o precisa ser feita manualmente.",
        true,
      );

      this.sendSnapshot();

      return false;
    }

    if (wasAuto) {
      quests.setAuto(false);
      quests.clearObjective();
      this.setAutoPlay(false);

      this.showMessage(`Auto desligado: ${quest.name}`);

      this.sendSnapshot();

      return true;
    }

    quests.setAuto(true);
    this.setAutoPlay(true);

    this.showMessage(`Auto: ${quest.summary}`);

    this.sendSnapshot();

    return true;
  }

  toggleQuestAuto() {
    const quests = this.world.quests;
    const enabled = quests.toggleAuto();

    if (enabled) {
      const objective = quests.objective();

      if (!objective) {
        quests.setAuto(false);
        this.showMessage(
          "Nenhuma missÃ£o automÃ¡tica disponÃ­vel.",
          true,
        );

        this.sendSnapshot();

        return false;
      }

      this.setAutoPlay(true);
      this.showMessage(
        `Auto: ${objective.summary}`,
      );
    } else {
      this.showMessage("Auto de missÃ£o desligado.");
    }

    this.sendSnapshot();

    return enabled;
  }

  setSkillAuto(skillId, enabled) {
    return setSkillAuto(skillId, enabled);
  }

  checkEquipQuest() {
    const equipment = this.world.equipment;

    for (const item of equipment.getEquippedItems()) {
      const rarity = item?.rarity;

      if (!rarity) continue;

      this.resolveQuestProgress(
        this.world.quests.onEquipRarity(rarity),
      );
    }
  }

  acceptSideQuest(questId) {
    const accepted = this.world.quests.acceptSide(questId);

    if (!accepted) {
      this.showMessage(
        "Termine a missÃ£o secundÃ¡ria atual primeiro.",
        true,
      );

      return false;
    }

    this.showMessage(
      "MissÃ£o secundÃ¡ria aceita.",
    );

    this.sendSnapshot();

    return true;
  }

  abandonSideQuest() {
    const dropped = this.world.quests.abandonSide();

    if (dropped) {
      this.showMessage(
        "MissÃ£o secundÃ¡ria abandonada.",
      );
    }

    this.sendSnapshot();

    return dropped;
  }

  getSkillAuto(skillId) {
    return isSkillAuto(skillId);
  }

  equipItem(uid, slotId) {
    const inventory = this.world.inventory;
    const equipment = this.world.equipment;

    const stack = inventory.findByUid(uid);

    if (!stack) return false;

    if (!equipment.canEquip(stack.itemId, slotId)) {
      return false;
    }

    const previous = equipment.equip(stack.itemId, slotId);

    inventory.takeUid(uid, 1);

    if (previous) {
      inventory.add(previous, 1);
    }

    this.applyEquipment();
    this.checkEquipQuest();
    this.sendSnapshot();

    return true;
  }

  unequipItem(slotId) {
    const equipment = this.world.equipment;

    const previous = equipment.unequip(slotId);

    if (!previous) return false;

    const result = this.world.inventory.add(previous, 1);

    this.applyEquipment();
    this.sendSnapshot();

    return result.added > 0;
  }

  /** remove a peÃ§a do inventÃ¡rio sem qualquer contrapartida */
  discardItem(uid, count = Number.POSITIVE_INFINITY) {
    const taken = this.world.inventory.takeUid(uid, count);

    if (!taken) return false;

    const name = getItem(taken.itemId)?.name ?? taken.itemId;

    this.showMessage(
      `${taken.count}x ${name} descartado.`,
    );

    this.sendSnapshot();

    return true;
  }

  /** tira a peÃ§a do corpo e some com ela */
  discardEquipped(slotId) {
    const equipped = this.world.equipment.getEquipped(slotId);

    if (!equipped) return false;

    const previous = this.world.equipment.unequip(slotId);

    if (!previous) return false;

    this.world.inventory.take(previous, 1);

    this.applyEquipment();
    this.checkEquipQuest();
    this.showMessage(`${equipped.name} descartado.`);
    this.sendSnapshot();

    return true;
  }

  setLootFilter(filter) {
    this.lootFilter = normalizeLootFilter(filter);
    saveLootFilter(this.lootFilter);

    const removed = this.loot.setFilter(this.lootFilter);

    if (removed > 0) {
      this.showMessage(
        `${removed} no chao descartado(s) pelo filtro.`,
      );
    }

    this.sendSnapshot();

    return this.lootFilter;
  }

  /** limpa da mochila o que o filtro reprova */
  pruneInventory() {
    const inventory = this.world.inventory;
    let removed = 0;

    for (let index = inventory.stacks.length - 1; index >= 0; index -= 1) {
      const stack = inventory.stacks[index];

      if (isCollectedId(stack.itemId, this.lootFilter)) {
        continue;
      }

      const taken = inventory.takeUid(stack.uid);

      removed += taken?.count ?? 0;
    }

    if (removed > 0) {
      this.showMessage(
        `${removed} item(ns) da mochila descartado(s).`,
      );
      this.sendSnapshot();
    }

    return removed;
  }

  lootFilterSummary() {
    return {
      ...this.lootFilter,
      label: describeFilter(this.lootFilter),
    };
  }

  autoEquipBest() {
    const inventory = this.world.inventory;
    const equipment = this.world.equipment;

    let changed = false;

    for (const slot of equipment.getSlots()) {
      let best = null;
      let bestScore = -Infinity;

      for (const stack of inventory.stacks) {
        if (!slot.accepts.includes(itemTypeOf(stack.itemId))) {
          continue;
        }

        const item = getItem(stack.itemId);

        if (!item) continue;

        const score = item.value;

        if (score > bestScore) {
          bestScore = score;
          best = stack;
        }
      }

      if (!best) continue;

      if (equipment.slotAccepts(slot.id, best.itemId)) {
        changed = this.equipItem(best.uid, slot.id) || changed;
      }
    }

    if (changed) {
      this.showMessage("Equipamento ajustado.");
    }

    return changed;
  }

  applyEquipment() {
    const player = this.world.player;
    const stats = player.definition.stats;
    const growth = statsForLevel(player.level ?? 1);

    // equipamento + bestiario no mesmo pipeline. as cacadas fechadas
    // somam como se fosse item vestida, entao as duas fontes precisam
    // ser SOMADAS por stat: um spread sobrescreveria o maxHp do
    // equipamento com o do bestiario.
    const bonus = mergeBonuses(
      this.world.equipment.bonuses(),
      this.world.bestiary.bonuses(),
    );

    const maxHp =
      stats.hp + growth.maxHp + (bonus.maxHp ?? 0);

    const previousMax = player.maxHp;

    player.maxHp = maxHp;
    player.maxResource =
      stats.resource + (bonus.resource ?? 0);

    player.attack =
      stats.attack + growth.attack + (bonus.attack ?? 0);
    player.defense =
      stats.defense +
      growth.defense +
      (bonus.defense ?? 0);
    player.speed = stats.speed + (bonus.speed ?? 0);
    player.range = stats.range;

    player.attackSpeedBonus = bonus.attackSpeed ?? 0;
    player.resourceRegenBonus =
      bonus.resourceRegen ?? 0;

    if (maxHp > previousMax) {
      player.hp += maxHp - previousMax;
    }

    player.hp = Math.max(
      0,
      Math.min(player.hp, player.maxHp),
    );

    player.resource = Math.max(
      0,
      Math.min(player.resource, player.maxResource),
    );
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

  getQuestObjective() {
    return this.world.quests.objective();
  }

  getQuestZone(quest) {
    if (!quest?.location) return null;

    return getZoneById(quest.location);
  }

  pickAutoTarget() {
    const objective = this.getAutoObjective();
    const player = this.world.player;
    const leash = this.autoLeashRange;

    const zone = this.getQuestZone(objective);

    let best = null;
    let bestDistance = Infinity;

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      if (!enemy.isCreature) continue;

      if (
        objective?.target &&
        enemy.id.replace(/_\d+$/, "") !==
          objective.target
      ) {
        continue;
      }

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const squared = dx * dx + dy * dy;

      if (zone) {
        const inside =
          enemy.x >= zone.x &&
          enemy.x <= zone.x + zone.width &&
          enemy.y >= zone.y &&
          enemy.y <= zone.y + zone.height;

        if (!inside) continue;
      } else if (squared > leash * leash) {
        continue;
      }

      if (squared < bestDistance) {
        bestDistance = squared;
        best = enemy;
      }
    }

    if (best) return best;

    if (zone) return null;

    return this.pickNearestCreature();
  }

  pickNearestCreature() {
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

  autoPlayTarget() {
    const objective = this.getAutoObjective();
    const target = this.pickAutoTarget();

    if (target) return target;

    const zone = this.getQuestZone(objective);

    if (!zone) return null;

    if (this.reachedQuestZone(zone)) return null;

    return {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2,
      isWaypoint: true,
    };
  }

  reachedQuestZone(zone) {
    const player = this.world.player;

    return (
      player.x >= zone.x &&
      player.x <= zone.x + zone.width &&
      player.y >= zone.y &&
      player.y <= zone.y + zone.height
    );
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

    if (!this.isAutoActive()) {
      this.autoWaypoint = null;
      return;
    }

    const player = this.world.player;

    if (player.hp <= 0) return;

    if (this.engagedTargetId !== null) {
      this.autoWaypoint = null;
      this.runEngagedTarget(player);
      return;
    }

    if (this.autoPlay || this.bestiaryTargetType !== null) {
      this.runAutoHunt(deltaTime, player);
    }
  }

  runEngagedTarget(player) {
    let target = this.findEnemyById(this.engagedTargetId);

    if (!target) {
      this.engagedTargetId = null;
      this.selectedTargetId = null;
      this.showMessage("Alvo eliminado.");
      return;
    }

    this.selectedTargetId = target.id;
    this.approachTarget(player, target);
  }

  runAutoHunt(deltaTime, player) {
    this.autoDecisionTimer -= deltaTime;

    if (this.autoDecisionTimer <= 0) {
      this.autoDecisionTimer = AUTO_RETARGET_INTERVAL;

      const picked = this.autoPlayTarget();

      this.autoWaypoint = picked?.isWaypoint
        ? picked
        : null;

      this.selectedTargetId = picked?.isWaypoint
        ? null
        : (picked?.id ?? null);
    }

    if (this.autoWaypoint) {
      if (!this.walkToward(player, this.autoWaypoint)) {
        this.autoWaypoint = null;
      }

      return;
    }

    const target = this.findEnemyById(
      this.selectedTargetId,
    );

    if (!target) return;

    this.approachTarget(player, target);
  }

  /** true enquanto ainda ha caminho, false quando chegou */
  walkToward(player, point) {
    const dx = point.x - player.x;
    const dy = point.y - player.y;

    if (Math.hypot(dx, dy) < 24) return false;

    this.autoFacing = { x: dx, y: dy };

    if (!this.statuses.canMove(player)) return true;

    this.autoMoveDirection = normalize(dx, dy);

    return true;
  }

  approachTarget(player, target) {
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
    this.frameDelta = deltaTime;
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

    this.updateDrops(deltaTime);

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
      player.facing = direction;
      player.animationTime += deltaTime * 9;
    } else {
      player.animationTime += deltaTime * 2;
    }

    player.walkPhase += deltaTime;

    const walkTarget = player.isMoving ? 1 : 0;

    player.walkBlend +=
      (walkTarget - player.walkBlend) *
      Math.min(1, deltaTime * 12);

    const autoFacing = this.autoFacing
      ? normalize(this.autoFacing.x, this.autoFacing.y)
      : null;

    const pointerFacing = this.input.pointer.inside
      ? normalize(
        this.input.pointer.x - player.x,
        this.input.pointer.y - player.y,
      )
      : null;

    const aimDirection = autoFacing ?? pointerFacing;

    if (
      aimDirection &&
      (aimDirection.x !== 0 || aimDirection.y !== 0)
    ) {
      player.aimDirection = aimDirection;
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

  handleKill(enemy) {
    this.announceLoot(
      this.loot.collectFrom(enemy),
    );

    const typeId = enemy.isCreature
      ? enemy.id.replace(/_\d+$/, "")
      : null;

    if (typeId) {
      this.resolveQuestProgress(
        this.world.quests.onKill(typeId, 1),
      );

      this.resolveBestiaryProgress(
        this.world.bestiary.onKill(typeId, 1),
      );
    }

    const levels = grantXp(
      this.world.player,
      xpForKill(enemy),
    );

    for (const level of levels) {
      this.announceLevelUp(level);

      this.resolveQuestProgress(
        this.world.quests.onLevelUp(level),
      );
    }

    if (levels.length > 0) {
      this.applyEquipment();
      this.sendSnapshot();
    }
  }

  resolveBestiaryProgress(hunts) {
    if ((hunts ?? []).length === 0) return;

    for (const hunt of hunts) {
      this.showMessage(
        `Cacada do bestiario: ${hunt.title} (${describeBonus(hunt.reward)})`,
      );
    }

    // o bonus e permanente: recalcula os stats na hora
    this.applyEquipment();
    this.sendSnapshot();
  }

  resolveQuestProgress(quests) {
    if ((quests ?? []).length === 0) return;

    for (const quest of quests) {
      this.showMessage(
        `MissÃ£o concluÃ­da: ${quest.name}`,
      );
    }

    for (const { reward } of this.world.quests.drainRewards()) {
      if (!reward) continue;

      if (reward.coins > 0) {
        this.world.inventory.addCoins(reward.coins);
      }

      for (const entry of reward.items ?? []) {
        this.world.inventory.add(
          entry.itemId,
          entry.count,
        );
      }

      if (reward.xp > 0) {
        const levels = grantXp(
          this.world.player,
          reward.xp,
        );

        for (const level of levels) {
          this.announceLevelUp(level);
        }
      }
    }

    this.sendSnapshot();
  }

  announceLevelUp(level) {
    this.showMessage(`NÃ­vel ${level} alcanÃ§ado!`);
  }

  announceLoot(collected) {
    const parts = [];

    if (collected.coins > 0) {
      parts.push(`+${collected.coins} moedas`);
    }

    for (const entry of collected.items) {
      const item = getItem(entry.itemId);

      if (!item) continue;

      parts.push(
        entry.count > 1
          ? `${item.name} x${entry.count}`
          : item.name,
      );
    }

    if (parts.length > 0) {
      this.showMessage(parts.join(" Â· "));
    }

    if (collected.dropped > 0) {
      this.showMessage(
        "InventÃ¡rio cheio: o excedente ficou no chÃ£o.",
        true,
      );
    }
  }

  updateDrops(deltaTime) {
    this.loot.update(deltaTime);

    const collected = this.loot.collectNear(
      this.world.player,
    );

    if (collected.coins <= 0 && collected.items.length === 0) {
      return;
    }

    const parts = [];

    if (collected.coins > 0) {
      parts.push(`+${collected.coins} moedas`);
    }

    for (const entry of collected.items) {
      const item = getItem(entry.itemId);

      if (!item) continue;

      parts.push(
        entry.count > 1
          ? `${item.name} x${entry.count}`
          : item.name,
      );
    }

    if (parts.length > 0) {
      this.showMessage(parts.join(" Â· "));
    }

    if (collected.rejected > 0) {
      this.sendSnapshot();
    }
  }

  sendSnapshot() {
    if (!this.onSnapshot) return;

    const player = this.world.player;
    const selectedTarget = this.getLiveTarget();

    this.onSnapshot({
      time: this.world.time,

      autoPlay: this.autoPlay,
      engaged: this.engagedTargetId !== null,
      bestiaryAuto: this.bestiaryAutoSnapshot(),

      inventory: this.world.inventory.summary(
        this.world.equipment,
      ),
      equipment: this.world.equipment.summary(),
      lootFilter: this.lootFilterSummary(),
      bestiary: this.world.bestiary.snapshot(),
      quests: this.world.quests.snapshot(),

      player: {
        id: player.id,
        name: player.name,
        className: player.definition.name,
        level: player.level,
        xp: Math.floor(player.xp ?? 0),
        xpToNext: xpToNext(player.level ?? 1),

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
          level: Math.max(
            1,
            Math.round(selectedTarget.level ?? 1),
          ),
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

    this.animationFrame = requestAnimationFrame(
      this.boundLoop,
    );

    const deltaTime = Math.min(
      (timestamp - this.lastTime) / 1000,
      0.05,
    );

    this.lastTime = timestamp;

    try {
      this.update(deltaTime);
      this.render();
    } catch (error) {
      this.reportFrameError(error);
    }
  }

  reportFrameError(error) {
    this.frameErrors += 1;

    if (this.frameErrors > 3) return;

    console.error(
      `[GameEngine] erro no frame: ${error?.message ?? error}`,
      error,
    );

    if (this.frameErrors === 3) {
      console.error(
        "[GameEngine] suprimindo logs de erro apos 3 falhas",
      );
    }
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
    this.drawWorldSorted(context);
    this.effects.draw(context);
    this.drawEnemyHpBar(context);

    context.restore();

    if (this.input.pointer.inside) {
      this.drawCrosshair(context);
    }

    this.drawMinimap(context, width, height);
  }

  drawWorldSorted(context) {
    const list = this.world.sort;
    list.length = 0;

    if (this.props.isReady()) {
      for (const prop of this.props.collectVisible(
        this.world.props,
        this.getViewBounds(),
      )) {
        list.push({ y: prop.y, kind: 1, ref: prop });
      }
    }

    for (const drop of this.world.drops) {
      list.push({ y: drop.y, kind: 2, ref: drop });
    }

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      list.push({ y: enemy.y, kind: 3, ref: enemy });
    }

    const player = this.world.player;

    if (player.hp > 0) {
      list.push({
        y: player.y,
        kind: 4,
        ref: player,
      });
    }

    list.sort((a, b) => a.y - b.y);

    for (const entry of list) {
      if (entry.kind === 1) {
        this.props.drawShadow(context, entry.ref);
        this.props.drawProp(context, entry.ref);
        continue;
      }

      if (entry.kind === 2) {
        this.drawDrop(context, entry.ref);
        continue;
      }

      if (entry.kind === 3) {
        this.drawEnemy(context, entry.ref);
        continue;
      }

      this.drawPlayer(context);
    }

    this.drawProjectiles(context);
  }

  getViewBounds() {
    return {
      x: this.world.player.x - this.viewport.width / 2,
      y: this.world.player.y - this.viewport.height / 2,
      width: this.viewport.width,
      height: this.viewport.height,
    };
  }

  getLiveTarget() {
    if (this.selectedTargetId === null) {
      return null;
    }

    return (
      this.world.enemies.find(
        (enemy) =>
          enemy.id === this.selectedTargetId &&
          enemy.alive,
      ) ?? null
    );
  }

  hasLiveTarget() {
    return this.getLiveTarget() !== null;
  }

  /** inimigo debaixo do cursor, usando a mesma tolerancia do clique */
  getHoveredEnemy() {
    const pointer = this.input.pointer;

    if (!pointer?.inside) return null;

    let best = null;
    let bestDistance = Infinity;

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;

      const reach = enemy.radius + 18;
      const distance =
        (enemy.x - pointer.x) ** 2 +
        (enemy.y - pointer.y) ** 2;

      if (distance > reach * reach) continue;

      // sobrepostos: o alvo atual tem prioridade para a barra nao pular
      if (enemy.id === this.selectedTargetId) {
        return enemy;
      }

      if (distance < bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }

    return best;
  }

  /** o que a barra de vida deve descrever: cursor primeiro, alvo depois */
  getInspectedEnemy() {
    return this.getHoveredEnemy() ?? this.getLiveTarget();
  }

  /** topo visual do mob, seja sprite seja corpo de fallback */
  enemyHeadTop(enemy) {
    const definition =
      this.enemySprites.get(enemy.id)?.definition;

    if (!definition) return enemy.y - enemy.radius;

    return (
      enemy.y +
      (definition.footOffset ?? 0) -
      definition.anchorY * definition.scale
    );
  }

  drawMinimap(context, width, height) {
    if (!this.world.map) return;

    const panelWidth = Math.min(
      MINIMAP_WIDTH,
      width - MINIMAP_RIGHT * 2,
    );

    const panelHeight = Math.min(
      MINIMAP_HEIGHT,
      height - MINIMAP_TOP_IDLE - MINIMAP_RIGHT,
    );

    if (panelWidth < 80 || panelHeight < 60) {
      return;
    }

    const resting = this.hasLiveTarget()
      ? MINIMAP_TOP_TARGETED
      : MINIMAP_TOP_IDLE;

    const blend = 1 - Math.pow(
      1 - MINIMAP_SLIDE,
      this.frameDelta * 60,
    );

    this.minimapY += (resting - this.minimapY) * blend;

    if (Math.abs(resting - this.minimapY) < 0.5) {
      this.minimapY = resting;
    }

    const originX = width - MINIMAP_RIGHT - panelWidth;
    const originY = Math.round(this.minimapY);

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

    if (this.terrain.isReady()) {
      this.terrain.draw(
        context,
        map,
        MAP_META.zones,
        {
          x: this.world.player.x - this.viewport.width / 2,
          y: this.world.player.y - this.viewport.height / 2,
          width: this.viewport.width,
          height: this.viewport.height,
        },
      );
    } else {
      context.fillStyle = map.background;
      context.fillRect(0, 0, map.width, map.height);
    }

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
    const target = this.getLiveTarget();

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

  drawDrop(context, drop) {
    const color =
      drop.kind === "coins"
        ? COIN_COLOR
        : (rarityOf(getItem(drop.itemId))?.color ??
          "#ffffff");

    const bob = Math.sin(drop.age * 3 + drop.x) * 2;
    const size = drop.kind === "coins" ? 7 : 9;

    context.save();

    context.globalAlpha = 0.22;
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(
      drop.x,
      drop.y + 6,
      size * 1.5,
      size * 0.6,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.globalAlpha = 0.95;
    context.fillStyle = color;
    context.strokeStyle = "rgba(6, 10, 14, 0.9)";
    context.lineWidth = 2;

    context.beginPath();
    context.arc(drop.x, drop.y + bob, size, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = "rgba(10, 14, 19, 0.9)";
    context.font = `700 ${drop.kind === "coins" ? 8 : 10}px Inter, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      drop.kind === "coins"
        ? String(drop.coins)
        : (getItem(drop.itemId)?.icon ?? "â€¢"),
      drop.x,
      drop.y + bob,
    );

    context.restore();
  }

  drawEnemy(context, enemy) {
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
  }

  /**
   * barra de vida no estilo OSRS: nome, barra e numeros.
   * so aparece no mob sob o cursor ou no alvo, entao some com o clique.
   */
  drawEnemyHpBar(context) {
    const enemy = this.getInspectedEnemy();

    if (!enemy) return;

    const definition =
      this.enemySprites.get(enemy.id)?.definition;

    const barWidth = Math.max(
      78,
      (definition?.frameWidth ?? 32) *
        (definition?.scale ?? 1),
    );
    const barHeight = 9;

    const left = enemy.x - barWidth / 2;
    const top = this.enemyHeadTop(enemy) - 9;

    const maxHp = Math.max(1, Math.ceil(enemy.maxHp));
    const hp = Math.max(0, Math.ceil(enemy.hp));
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const filled = barWidth * ratio;

    context.save();
    context.textAlign = "center";
    context.lineJoin = "round";

    // moldura preta da barra
    context.fillStyle = "rgba(4, 6, 9, 0.92)";
    context.fillRect(
      left - 2,
      top - 2,
      barWidth + 4,
      barHeight + 4,
    );

    context.strokeStyle = "rgba(0, 0, 0, 0.9)";
    context.lineWidth = 1;
    context.strokeRect(
      left - 2.5,
      top - 2.5,
      barWidth + 5,
      barHeight + 5,
    );

    // preenchimento
    if (filled > 0) {
      context.fillStyle =
        ratio > 0.35 ? "#c1160f" : "#8f0f0a";
      context.fillRect(left, top, filled, barHeight);

      context.fillStyle = "rgba(255, 255, 255, 0.24)";
      context.fillRect(left, top, filled, 2);
    }

    // faixa de comportamento das criaturas
    if (enemy.isCreature) {
      context.fillStyle =
        BEHAVIOR_COLORS[enemy.behavior] ?? "#8d97a3";
      context.fillRect(
        left,
        top + barHeight + 3,
        filled,
        2,
      );
    }

    // nome
    context.font = "700 11px Inter, sans-serif";
    context.textBaseline = "bottom";
    context.lineWidth = 3;
    context.strokeStyle = "rgba(0, 0, 0, 0.85)";
    context.strokeText(enemy.name, enemy.x, top - 6);
    context.fillStyle = "#f0e6d2";
    context.fillText(enemy.name, enemy.x, top - 6);

    // numeros: nivel a esquerda e vida a direita, ancorados na barra
    // (sem measureText: os proxies de teste nao devolvem metricas)
    const level = Math.max(1, Math.round(enemy.level ?? 1));
    const textY = top + barHeight + 8;

    context.font = "700 9px Inter, sans-serif";
    context.textBaseline = "top";
    context.lineWidth = 3;
    context.strokeStyle = "rgba(0, 0, 0, 0.85)";

    const levelLabel = `Nv.${level}`;

    context.textAlign = "left";
    context.strokeText(levelLabel, left, textY);
    context.fillStyle = "#e5bb68";
    context.fillText(levelLabel, left, textY);

    const hpLabel = `${hp} / ${maxHp}`;

    context.textAlign = "right";
    context.strokeText(hpLabel, left + barWidth, textY);
    context.fillStyle = "#cfc3ae";
    context.fillText(hpLabel, left + barWidth, textY);

    context.textAlign = "center";

    // efeitos de status
    const dots = Math.min(4, enemy.statusEffects.length);

    for (let index = 0; index < dots; index += 1) {
      const effect = enemy.statusEffects[index];

      context.fillStyle = this.getStatusColor(effect.type);

      context.beginPath();
      context.arc(
        enemy.x - (dots - 1) * 5 + index * 10,
        top + barHeight + 22,
        3,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    context.restore();
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
