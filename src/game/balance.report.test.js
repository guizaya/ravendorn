import { describe, it } from "vitest";
import { xpForKill, xpToNext } from "./progression/Levels.js";
import {
  CREATURE_TYPES,
  DUMMY_LOOT,
} from "../data/enemies/index.js";

describe("balance report", () => {
  it("prints the difficulty curve", () => {
    const kills = (type) =>
      xpForKill({
        maxHp: type.maxHp,
        isCreature: true,
      });

    const ogre = kills(CREATURE_TYPES.ogre);
    const skeleton = kills(CREATURE_TYPES.skeleton);

    console.log(
      `\nXP por abate: ogro ${ogre} | esqueleto ${skeleton} | goblin ${kills(CREATURE_TYPES.goblin)}`,
    );

    console.log(
      "\nnivel |  XP total |   ogros | esqueletos",
    );

    for (const target of [2, 5, 10, 15, 20, 25, 30]) {
      let total = 0;

      for (let level = 1; level < target; level += 1) {
        total += xpToNext(level);
      }

      console.log(
        `${String(target).padStart(5)} | ${String(total).padStart(9)} | ${String(
          Math.ceil(total / ogre),
        ).padStart(7)} | ${String(
          Math.ceil(total / skeleton),
        ).padStart(10)}`,
      );
    }

    console.log("\nitens a cada 100 abates:");
    console.log(
      `  ogro      ${(CREATURE_TYPES.ogre.loot.itemChance * 100).toFixed(1)}`,
    );
    console.log(
      `  esqueleto ${(CREATURE_TYPES.skeleton.loot.itemChance * 100).toFixed(1)}`,
    );
    console.log(
      `  ghoul     ${(CREATURE_TYPES.ghoul.loot.itemChance * 100).toFixed(1)}`,
    );
    console.log(
      `  slime     ${(CREATURE_TYPES.slime.loot.itemChance * 100).toFixed(1)}`,
    );
    console.log(
      `  boneco    ${(DUMMY_LOOT.itemChance * 100).toFixed(1)}`,
    );
  });
});
