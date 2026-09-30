import { hexToRgb } from "./raster.mjs";

const rgb = hexToRgb;

export const PROP_FRAME = 32;

const FOLIAGE = {
  dark: rgb("#1b3324"),
  mid: rgb("#2a4a33"),
  light: rgb("#3a5f42"),
  rim: rgb("#4a7550"),
};

const WOOD = {
  dark: rgb("#2a1d13"),
  mid: rgb("#40301f"),
  light: rgb("#54402a"),
};

const STONE = {
  dark: rgb("#262b2e"),
  mid: rgb("#3a4145"),
  light: rgb("#4e575c"),
  rim: rgb("#5f6a70"),
};

export const PROP_TYPES = {
  treeSmall: {
    id: "treeSmall",
    name: "Árvore pequena",
    blocking: true,
    canopy: { ...FOLIAGE, radius: 8, blobs: 3 },
    trunk: { ...WOOD, width: 3, height: 6 },
  },
  treeMedium: {
    id: "treeMedium",
    name: "Árvore média",
    blocking: true,
    canopy: { ...FOLIAGE, radius: 11, blobs: 4 },
    trunk: { ...WOOD, width: 4, height: 7 },
  },
  treeLarge: {
    id: "treeLarge",
    name: "Árvore grande",
    blocking: true,
    canopy: { ...FOLIAGE, radius: 14, blobs: 5 },
    trunk: { ...WOOD, width: 5, height: 8 },
  },
  rock: {
    id: "rock",
    name: "Pedra",
    blocking: true,
    canopy: { ...STONE, radius: 9, blobs: 3 },
    trunk: null,
  },
  bush: {
    id: "bush",
    name: "Arbusto",
    blocking: false,
    canopy: {
      ...FOLIAGE,
      dark: rgb("#1f3327"),
      mid: rgb("#2c4734"),
      light: rgb("#3c5c42"),
      rim: rgb("#4e6f52"),
      radius: 6,
      blobs: 3,
    },
    trunk: null,
  },
};

export const PROP_ORDER = [
  "treeSmall",
  "treeMedium",
  "treeLarge",
  "rock",
  "bush",
];

export const PROP_VARIANTS = 4;

export const PROP_RADIUS = {
  treeSmall: 20,
  treeMedium: 26,
  treeLarge: 34,
  rock: 18,
  bush: 12,
};

export const PROP_SCALE = 2;

export const BLOCKING_PROPS = PROP_ORDER.filter(
  (id) => PROP_TYPES[id].blocking,
);
