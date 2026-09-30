import { hexToRgb } from "./raster.mjs";

const rgb = hexToRgb;

export const TILE = 32;

export const TERRAIN = {
  grass: {
    id: "grass",
    name: "Grama",
    variants: 4,
    palette: [
      "#1d3327",
      "#254230",
      "#2e5138",
      "#37603f",
      "#426c48",
    ],
    grain: 0.05,
    grainColor: "#4d7a54",
    features: "tufts",
  },
  dirt: {
    id: "dirt",
    name: "Terra",
    variants: 4,
    palette: [
      "#2a231c",
      "#362c22",
      "#42362a",
      "#4e4032",
      "#5b4b3a",
    ],
    grain: 0.06,
    grainColor: "#6d5b47",
    features: "pebbles",
  },
  sand: {
    id: "sand",
    name: "Areia",
    variants: 4,
    palette: [
      "#4a3d28",
      "#574831",
      "#65543a",
      "#746144",
      "#846e4e",
    ],
    grain: 0.07,
    grainColor: "#9c8560",
    features: "ripples",
  },
  stone: {
    id: "stone",
    name: "Pedra",
    variants: 4,
    palette: [
      "#23272a",
      "#2c3134",
      "#363c40",
      "#414749",
      "#4d5457",
    ],
    grain: 0.04,
    grainColor: "#5e666a",
    features: "cracks",
  },
  swamp: {
    id: "swamp",
    name: "Brejo",
    variants: 4,
    palette: [
      "#1c2b24",
      "#233730",
      "#2b453b",
      "#335346",
      "#3c6152",
    ],
    grain: 0.05,
    grainColor: "#4c7666",
    features: "puddles",
  },

  forest: {
    id: "forest",
    name: "Floresta",
    variants: 4,
    palette: [
      "#0f1d14",
      "#15271a",
      "#1c3222",
      "#233d29",
      "#2b4a31",
    ],
    grain: 0.07,
    grainColor: "#3a5f3f",
    features: "needles",
  },

  ice: {
    id: "ice",
    name: "Gelo",
    variants: 4,
    palette: [
      "#243036",
      "#2d3d46",
      "#374a54",
      "#425963",
      "#4f6972",
    ],
    grain: 0.05,
    grainColor: "#7e97a2",
    features: "frost",
  },

  ash: {
    id: "ash",
    name: "Cinzas",
    variants: 4,
    palette: [
      "#221d22",
      "#2c262b",
      "#372f35",
      "#433940",
      "#4f444c",
    ],
    grain: 0.06,
    grainColor: "#6a5c66",
    features: "embers",
  },
};

export const TERRAIN_ORDER = [
  "grass",
  "dirt",
  "sand",
  "stone",
  "swamp",
  "forest",
  "ice",
  "ash",
];

const GRASS = TERRAIN.grass.palette.map(rgb);
const DIRT = TERRAIN.dirt.palette.map(rgb);
const SAND = TERRAIN.sand.palette.map(rgb);
const STONE = TERRAIN.stone.palette.map(rgb);
const SWAMP = TERRAIN.swamp.palette.map(rgb);
const FOREST = TERRAIN.forest.palette.map(rgb);
const ICE = TERRAIN.ice.palette.map(rgb);
const ASH = TERRAIN.ash.palette.map(rgb);

const PAIRS = {
  grass_dirt: [GRASS, DIRT],
  grass_sand: [GRASS, SAND],
  dirt_stone: [DIRT, STONE],
  sand_stone: [SAND, STONE],
  swamp_dirt: [SWAMP, DIRT],
  grass_swamp: [GRASS, SWAMP],
  grass_stone: [GRASS, STONE],
  grass_forest: [GRASS, FOREST],
  grass_ice: [GRASS, ICE],
  grass_ash: [GRASS, ASH],
  forest_dirt: [FOREST, DIRT],
  forest_swamp: [FOREST, SWAMP],
  ice_stone: [ICE, STONE],
  ash_stone: [ASH, STONE],
  sand_ash: [SAND, ASH],
};

export const TRANSITIONS = Object.keys(PAIRS).map(
  (id) => ({ id, from: id.split("_")[0], to: id.split("_")[1] }),
);

export const TRANSITION_PALETTES = PAIRS;

export const FEATURES = {
  tufts: ["#4d7a54", "#3d6846"],
  pebbles: ["#6d5b47", "#241d16"],
  ripples: ["#9c8560", "#7a6444"],
  cracks: ["#1a1d1f", "#565e62"],
  puddles: ["#3f7d68", "#2a5a4b"],
  needles: ["#3a5f3f", "#16281b"],
  frost: ["#b9d4de", "#7e97a2"],
  embers: ["#e0703c", "#7a3f28"],
};

export const FEATURE_IDS = Object.keys(FEATURES);
