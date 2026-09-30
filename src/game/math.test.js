import { describe, expect, it } from "vitest";
import {
  normalize,
  segmentDistanceSquared,
} from "./math.js";

describe("math helpers", () => {
  it("normaliza um vetor", () => {
    const result = normalize(3, 4);

    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.8);
  });

  it("calcula distância até um segmento", () => {
    const result = segmentDistanceSquared(
      { x: 5, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    );

    expect(result).toBe(25);
  });
});
