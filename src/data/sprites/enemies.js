import slimeUrl from "../../assets/sprites/enemies/slime.png";
import ratUrl from "../../assets/sprites/enemies/rat.png";
import goblinUrl from "../../assets/sprites/enemies/goblin.png";
import ghoulUrl from "../../assets/sprites/enemies/ghoul.png";
import skeletonUrl from "../../assets/sprites/enemies/skeleton.png";
import ogreUrl from "../../assets/sprites/enemies/ogre.png";

const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;
const ANCHOR_X = 16;
const ANCHOR_Y = 26;
const FOOT_OFFSET = 10;

export function createEnemySpriteDefinition(
  id,
  src,
  scale,
) {
  return {
    id,
    src,

    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,

    anchorX: ANCHOR_X,
    anchorY: ANCHOR_Y,

    scale,
    footOffset: FOOT_OFFSET,

    directions: {
      down: 0,
      up: 1,
      side: 2,
    },

    animations: {
      idle: { start: 0, length: 2, fps: 2.5 },
      walk: { start: 2, length: 4, fps: 9 },
      attack: { start: 6, length: 3, fps: 14 },
      hurt: { start: 9, length: 2, fps: 10 },
    },
  };
}

export const ENEMY_SPRITES = {
  slime: createEnemySpriteDefinition(
    "slime",
    slimeUrl,
    1.5,
  ),
  rat: createEnemySpriteDefinition("rat", ratUrl, 1.2),
  goblin: createEnemySpriteDefinition(
    "goblin",
    goblinUrl,
    1.3,
  ),
  ghoul: createEnemySpriteDefinition("ghoul", ghoulUrl, 1.4),
  skeleton: createEnemySpriteDefinition(
    "skeleton",
    skeletonUrl,
    1.35,
  ),
  ogre: createEnemySpriteDefinition("ogre", ogreUrl, 1.9),
};

export function getEnemySprite(creatureId) {
  return ENEMY_SPRITES[creatureId] ?? null;
}
