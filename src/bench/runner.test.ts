import { describe, expect, it } from "vitest";
import { groundLeftWallLevel } from "../sim/level";
import { runBenchmark } from "./runner";
import { parseCandidateFile } from "./validation";
import type { CandidateAction } from "./types";
import type { LevelDefinition } from "../sim/types";

describe("benchmark runner", () => {
  it("reports timeout when the frame budget is exhausted", () => {
    const result = runBenchmark(
      {
        levelId: groundLeftWallLevel.id,
        strokes: [],
      },
      {
        stopping: {
          frameBudget: 5,
          quietFrames: 100,
        },
      },
    );

    expect(result.success).toBe(false);
    expect(result.terminalState).toBe("timeout");
    expect(result.terminalFrame).toBe(5);
  });

  it("uses the default 600 frame timeout when no frame budget is provided", () => {
    const result = runBenchmark(
      {
        levelId: groundLeftWallLevel.id,
        strokes: [
          {
            id: "idle-drop",
            width: 18,
            points: [
              { x: 100, y: 100 },
              { x: 130, y: 100 },
            ],
          },
        ],
      },
      {
        stopping: {
          quietFrames: 10_000,
        },
      },
    );

    expect(result.success).toBe(false);
    expect(result.terminalState).toBe("timeout");
    expect(result.terminalFrame).toBe(600);
    expect(result.frameBudget).toBe(600);
  });

  it("caps requested frame budgets at 600 frames", () => {
    const result = runBenchmark(
      {
        levelId: groundLeftWallLevel.id,
        strokes: [],
      },
      {
        stopping: {
          frameBudget: 30_000,
          quietFrames: 10_000,
        },
      },
    );

    expect(result.terminalState).toBe("timeout");
    expect(result.terminalFrame).toBe(600);
    expect(result.frameBudget).toBe(600);
  });

  it("reports stalled when all dynamic bodies settle", () => {
    const result = runBenchmark(
      {
        levelId: groundLeftWallLevel.id,
        strokes: [],
      },
      {
        stopping: {
          frameBudget: 200,
          rollingWindowFrames: 2,
          quietFrames: 3,
          graceFrames: 0,
          thresholds: {
            linearSpeed: 100,
            angularSpeed: 100,
            positionDelta: 100,
            angleDelta: 100,
          },
        },
      },
    );

    expect(result.success).toBe(false);
    expect(result.terminalState).toBe("stalled");
    expect(result.quietFrames).toBe(3);
  });

  it("reports success and records trace terminal state", () => {
    const level: LevelDefinition = {
      id: "already-at-wall",
      name: "Already at wall",
      instruction: "Touch the wall",
      world: { width: 1000, height: 700 },
      ball: {
        position: { x: 26, y: 596 },
        radius: 26,
        frictionAir: 0,
      },
      floor: { y: 670, height: 60 },
      goal: { type: "hit-left-wall", contactFrames: 1 },
      limits: { maxStrokes: 1 },
    };
    const action: CandidateAction = {
      levelId: level.id,
      strokes: [],
    };

    const result = runBenchmark(action, {
      levels: [level],
      includeTrace: true,
      stopping: {
        frameBudget: 300,
        quietFrames: 100,
      },
    });

    expect(result.success).toBe(true);
    expect(result.terminalState).toBe("success");
    expect(result.firstSuccessFrame).toBe(result.terminalFrame);
    expect(result.trace?.frames[result.trace.frames.length - 1]?.terminalState).toBe("success");
  });

  it("validates action files against level bounds and stroke limits", () => {
    expect(() =>
      parseCandidateFile(
        {
          levelId: groundLeftWallLevel.id,
          strokes: [
            {
              id: "bad",
              width: 19,
              points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
              ],
            },
          ],
        },
        [groundLeftWallLevel],
      ),
    ).toThrow(/width must be between 1 and 18/);

    expect(() =>
      parseCandidateFile(
        {
          levelId: groundLeftWallLevel.id,
          strokes: [
            {
              id: "bad",
              width: 18,
              points: [
                { x: 0, y: 0 },
                { x: 1200, y: 0 },
              ],
            },
          ],
        },
        [groundLeftWallLevel],
      ),
    ).toThrow(/world bounds/);
  });

  it("rejects candidate strokes that cannot be placed safely", () => {
    expect(() =>
      runBenchmark({
        levelId: groundLeftWallLevel.id,
        strokes: [
          {
            id: "buried-in-floor",
            width: 18,
            points: [
              { x: 100, y: 670 },
              { x: 250, y: 670 },
            ],
          },
        ],
      }),
    ).toThrow(/could not be placed/);
  });
});
