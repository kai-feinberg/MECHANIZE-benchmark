import { describe, expect, it } from "vitest";
import { groundLeftWallLevel, hitLeftWallLevel } from "../sim/level";
import { buildLevelPrompt } from "./prompt";

describe("AI benchmark prompt", () => {
  it("describes the ground-left-wall level without cup geometry", () => {
    const prompt = buildLevelPrompt(groundLeftWallLevel);

    expect(prompt).toContain("world: 1000 x 700");
    expect(prompt).toContain("ball: center (720, 596), radius 26");
    expect(prompt).toContain("floor: center y 670, height 60");
    expect(prompt).toContain("Static cup obstacle: none");
    expect(prompt).toContain("Make the ball contact the left wall for 1 frame");
    expect(prompt).toContain("Maximum strokes: 1");
    expect(prompt).toContain("Do not generate SVG paths");
  });

  it("describes cup geometry when the level has a cup", () => {
    const prompt = buildLevelPrompt(hitLeftWallLevel);

    expect(prompt).toContain("Static cup obstacle:");
    expect(prompt).toContain("center: (610, 537)");
    expect(prompt).toContain("radius: 94");
    expect(prompt).toContain("segments: 8");
  });
});
