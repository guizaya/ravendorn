import { hexToRgb } from "./raster.mjs";

const rgb = hexToRgb;

const BASE = {
  outline: rgb("#0a0f14"),
  eye: rgb("#1a0f14"),
  skin: rgb("#c9a27c"),
};

export const CREATURE_LOOKS = {
  slime: {
    id: "slime",
    body: "blob",
    bulk: 3,
    palette: {
      ...BASE,
      body: rgb("#4f9c6d"),
      bodyLit: rgb("#6fc48d"),
      bodyDk: rgb("#2f6b49"),
      head: rgb("#4f9c6d"),
      headLit: rgb("#6fc48d"),
      headDk: rgb("#2f6b49"),
      belly: rgb("#3d7f57"),
      accent: rgb("#b8f5c9"),
    },
  },

  rat: {
    id: "rat",
    body: "quadruped",
    bulk: 0,
    palette: {
      ...BASE,
      body: rgb("#8d7a5c"),
      bodyLit: rgb("#ab9673"),
      bodyDk: rgb("#5c4d3a"),
      head: rgb("#8d7a5c"),
      headLit: rgb("#ab9673"),
      headDk: rgb("#5c4d3a"),
      belly: rgb("#6f5f47"),
      snout: rgb("#d8b9a0"),
      accent: rgb("#e0c9a8"),
    },
  },

  goblin: {
    id: "goblin",
    body: "biped",
    bulk: 0,
    headSize: 3,
    ears: "pointed",
    eyes: "glow",
    teeth: true,
    palette: {
      ...BASE,
      body: rgb("#6f9440"),
      bodyLit: rgb("#8ab355"),
      bodyDk: rgb("#435a26"),
      belly: rgb("#8a7a44"),
      head: rgb("#7ba24a"),
      headLit: rgb("#9cc266"),
      headDk: rgb("#4d6b2c"),
      accent: rgb("#e8ff6a"),
    },
  },

  ghoul: {
    id: "ghoul",
    body: "biped",
    bulk: 1,
    headSize: 3,
    eyes: "glow",
    teeth: true,
    palette: {
      ...BASE,
      body: rgb("#6d5a7e"),
      bodyLit: rgb("#8a749b"),
      bodyDk: rgb("#463a52"),
      belly: rgb("#584a66"),
      head: rgb("#7d6a8e"),
      headLit: rgb("#9c86ae"),
      headDk: rgb("#4b3f57"),
      accent: rgb("#d47ae0"),
    },
  },

  skeleton: {
    id: "skeleton",
    body: "biped",
    bulk: -1,
    headSize: 3,
    eyes: "hollow",
    teeth: true,
    palette: {
      ...BASE,
      body: rgb("#b8bcc0"),
      bodyLit: rgb("#d6dade"),
      bodyDk: rgb("#7d838a"),
      belly: rgb("#c8ccd0"),
      head: rgb("#c4c8cc"),
      headLit: rgb("#e2e6ea"),
      headDk: rgb("#8a9096"),
      accent: rgb("#9fd8ff"),
    },
  },

  ogre: {
    id: "ogre",
    body: "biped",
    bulk: 3,
    headSize: 3,
    eyes: "glow",
    palette: {
      ...BASE,
      body: rgb("#8f5f3c"),
      bodyLit: rgb("#b07a52"),
      bodyDk: rgb("#5b3a24"),
      belly: rgb("#a5784f"),
      head: rgb("#9c6a44"),
      headLit: rgb("#bd855a"),
      headDk: rgb("#623e26"),
      accent: rgb("#ff9a4a"),
    },
  },
};

export const CREATURE_ORDER = [
  "slime",
  "rat",
  "goblin",
  "ghoul",
  "skeleton",
  "ogre",
];
