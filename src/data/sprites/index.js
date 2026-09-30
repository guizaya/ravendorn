import warriorUrl from "../../assets/sprites/warrior.png";
import lancerUrl from "../../assets/sprites/lancer.png";
import taoistUrl from "../../assets/sprites/taoist.png";
import sorcererUrl from "../../assets/sprites/sorcerer.png";
import arbalistUrl from "../../assets/sprites/arbalist.png";
import darkistUrl from "../../assets/sprites/darkist.png";
import lionheartUrl from "../../assets/sprites/lionheart.png";
import summonerUrl from "../../assets/sprites/summoner.png";

const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;
const ANCHOR_X = 16;
const ANCHOR_Y = 27;
const SCALE = 2;
const FOOT_OFFSET = 12;

export function createSpriteDefinition(id, src) {
  return {
    id,
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

export const ARBALIST_SPRITE = createSpriteDefinition(
  "arbalist",
  arbalistUrl,
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
