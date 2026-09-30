import terrainUrl from "../../assets/terrain/terrain.png";
import transitionsUrl from "../../assets/terrain/transitions.png";
import featuresUrl from "../../assets/terrain/features.png";

export const TILE_SIZE = 32;
export const TILE_VARIANTS = 4;

export const TERRAIN_TYPES = [
  "grass",
  "dirt",
  "sand",
  "stone",
  "swamp",
  "forest",
  "ice",
  "ash",
];

export const TERRAIN_ROW = {
  grass: 0,
  dirt: 1,
  sand: 2,
  stone: 3,
  swamp: 4,
  forest: 5,
  ice: 6,
  ash: 7,
};

export const BASE_TERRAIN = "grass";

export const TRANSITION_LIST = [
  "grass_dirt",
  "grass_sand",
  "dirt_stone",
  "sand_stone",
  "swamp_dirt",
  "grass_swamp",
  "grass_stone",
  "grass_forest",
  "grass_ice",
  "grass_ash",
  "forest_dirt",
  "forest_swamp",
  "ice_stone",
  "ash_stone",
  "sand_ash",
];

export const TRANSITION_ROW = {
  grass_dirt: 0,
  grass_sand: 1,
  dirt_stone: 2,
  sand_stone: 3,
  swamp_dirt: 4,
  grass_swamp: 5,
  grass_stone: 6,
  grass_forest: 7,
  grass_ice: 8,
  grass_ash: 9,
  forest_dirt: 10,
  forest_swamp: 11,
  ice_stone: 12,
  ash_stone: 13,
  sand_ash: 14,
};

export const FEATURE_LIST = [
  "tufts",
  "pebbles",
  "ripples",
  "cracks",
  "puddles",
  "needles",
  "frost",
  "embers",
];

export const TERRAIN_SHEETS = {
  terrain: terrainUrl,
  transitions: transitionsUrl,
  features: featuresUrl,
};

const MINIMAP_TINTS = {
  grass: "rgba(91, 143, 113, 0.55)",
  dirt: "rgba(140, 122, 92, 0.55)",
  sand: "rgba(180, 152, 104, 0.55)",
  stone: "rgba(150, 155, 160, 0.55)",
  swamp: "rgba(94, 150, 120, 0.55)",
  forest: "rgba(52, 96, 62, 0.55)",
  ice: "rgba(120, 158, 176, 0.55)",
  ash: "rgba(122, 96, 112, 0.55)",
};

const LABEL_TINTS = {
  grass: "rgba(91, 143, 113, 0.1)",
  dirt: "rgba(140, 122, 92, 0.1)",
  sand: "rgba(180, 152, 104, 0.1)",
  stone: "rgba(150, 155, 160, 0.1)",
  swamp: "rgba(94, 150, 120, 0.1)",
  forest: "rgba(52, 96, 62, 0.1)",
  ice: "rgba(120, 158, 176, 0.1)",
  ash: "rgba(122, 96, 112, 0.1)",
};

export function minimapColorFor(terrain) {
  return (
    MINIMAP_TINTS[terrain] ??
    MINIMAP_TINTS[BASE_TERRAIN]
  );
}

export function terrainLabelColor(terrain) {
  return (
    LABEL_TINTS[terrain] ?? LABEL_TINTS[BASE_TERRAIN]
  );
}

export function transitionIdFor(from, to) {
  return `${from}_${to}`;
}

export function getTransition(from, to) {
  if (from === to) return null;

  return (
    TRANSITION_ROW[transitionIdFor(from, to)] ??
    TRANSITION_ROW[transitionIdFor(to, from)] ??
    null
  );
}
