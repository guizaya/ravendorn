import warriorUrl from "../../assets/sprites/warrior.png";
import lancerUrl from "../../assets/sprites/lancer.png";
import taoistUrl from "../../assets/sprites/taoist.png";
import sorcererUrl from "../../assets/sprites/sorcerer.png";
import darkistUrl from "../../assets/sprites/darkist.png";
import lionheartUrl from "../../assets/sprites/lionheart.png";
import summonerUrl from "../../assets/sprites/summoner.png";
import arbalistSheetUrl from "../../assets/sprites/arbalist-sheet.png";

const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;
const ANCHOR_X = 16;
const ANCHOR_Y = 27;
const SCALE = 2;
const FOOT_OFFSET = 12;

const DIRECTIONAL_FRAME_WIDTH = 64;
const DIRECTIONAL_FRAME_HEIGHT = 64;
const DIRECTIONAL_ANCHOR_X = 32;
const DIRECTIONAL_ANCHOR_Y = 54;
const DIRECTIONAL_SCALE = 1;
const DIRECTIONAL_FALLBACK = "south";

const DIRECTIONAL_WALK_BOB = {
  amplitude: 4,
  frequency: 1.5,
};

const ARBALIST_FRAMES = 8;
const ARBALIST_IDLE_FRAMES = 7;
const ARBALIST_IDLE_ROW = 8;
const ARBALIST_WALK_FPS = 12;
const ARBALIST_IDLE_FPS = 5;

export const SPRITE_FORMAT = {
  SHEET: "sheet",
  DIRECTIONAL: "directional",
};

export const ARBALIST_DIRECTIONS = {
  east: 0,
  "south-east": 1,
  south: 2,
  "south-west": 3,
  west: 4,
  "north-west": 5,
  north: 6,
  "north-east": 7,
};

export function createSpriteDefinition(id, src) {
  return {
    id,
    format: SPRITE_FORMAT.SHEET,
    src,
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    anchorX: ANCHOR_X,
    anchorY: ANCHOR_Y,
    scale: SCALE,
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
    },
  };
}

export function createDirectionalSpriteDefinition(
  id,
  src,
  {
    directions,
    animations,
    fallbackDirection = DIRECTIONAL_FALLBACK,
    walkBob = null,
  },
) {
  return {
    id,
    format: SPRITE_FORMAT.DIRECTIONAL,
    src,
    fallbackDirection,
    frameWidth: DIRECTIONAL_FRAME_WIDTH,
    frameHeight: DIRECTIONAL_FRAME_HEIGHT,
    anchorX: DIRECTIONAL_ANCHOR_X,
    anchorY: DIRECTIONAL_ANCHOR_Y,
    scale: DIRECTIONAL_SCALE,
    footOffset: FOOT_OFFSET,
    directions: { ...directions },
    walkBob: walkBob ? { ...walkBob } : null,
    animations: Object.fromEntries(
      Object.entries(animations).map(([name, animation]) => [
        name,
        { ...animation },
      ]),
    ),
  };
}

export const ARBALIST_SPRITE = createDirectionalSpriteDefinition(
  "arbalist",
  arbalistSheetUrl,
  {
    directions: ARBALIST_DIRECTIONS,

    walkBob: DIRECTIONAL_WALK_BOB,

    animations: {
      idle: {
        row: ARBALIST_IDLE_ROW,
        start: 0,
        length: ARBALIST_IDLE_FRAMES,
        fps: ARBALIST_IDLE_FPS,
      },

      walk: {
        start: 0,
        length: ARBALIST_FRAMES,
        fps: ARBALIST_WALK_FPS,
      },
    },
  },
);

export const CLASS_SPRITES = {
  warrior: createSpriteDefinition("warrior", warriorUrl),
  lancer: createSpriteDefinition("lancer", lancerUrl),
  taoist: createSpriteDefinition("taoist", taoistUrl),
  sorcerer: createSpriteDefinition("sorcerer", sorcererUrl),
  arbalist: ARBALIST_SPRITE,
  darkist: createSpriteDefinition("darkist", darkistUrl),
  lionheart: createSpriteDefinition(
    "lionheart",
    lionheartUrl,
  ),
  summoner: createSpriteDefinition("summoner", summonerUrl),
};

export function getClassSprite(classId) {
  return CLASS_SPRITES[classId] ?? null;
}
