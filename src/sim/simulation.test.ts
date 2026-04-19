import { Body } from "matter-js";
import { describe, expect, it } from "vitest";
import { hitLeftWallLevel } from "./level";
import { createSimulation, evaluateGoal } from "./simulation";
import type { StrokeAction } from "./types";

describe("game simulation", () => {
  it("initializes the lift-ball level", () => {
    const sim = createSimulation();

    expect(sim.level.world).toEqual({ width: 1000, height: 700 });
    expect(sim.level.goal).toEqual({ type: "off-ground", offGroundFrames: 150, groundClearance: 3 });
    expect(sim.bodies.ball.label).toBe("ball");
    expect(sim.bodies.floor.isStatic).toBe(true);
    expect(sim.goal.achieved).toBe(false);
  });

  it("advances the world with fixed-step updates", () => {
    const sim = createSimulation();
    const startY = sim.bodies.ball.position.y;

    for (let index = 0; index < 10; index += 1) {
      sim.step();
    }

    expect(sim.engine.timing.timestamp).toBeCloseTo(1000 / 6);
    expect(sim.bodies.ball.position.y).not.toBe(startY);
  });

  it("requires the ball to stay off the ground for consecutive frames", () => {
    const sim = createSimulation();
    let goal = sim.goal;
    const floorTop = sim.level.floor.y - sim.level.floor.height / 2;

    expect(sim.level.goal.type).toBe("off-ground");
    if (sim.level.goal.type !== "off-ground") {
      throw new Error("Expected off-ground goal.");
    }

    Body.setPosition(sim.bodies.ball, {
      x: sim.level.ball.position.x,
      y: floorTop - sim.level.ball.radius - sim.level.goal.groundClearance,
    });

    for (let index = 0; index < sim.level.goal.offGroundFrames - 1; index += 1) {
      goal = evaluateGoal(sim.level, sim.bodies.ball, goal);
      expect(goal.achieved).toBe(false);
    }

    goal = evaluateGoal(sim.level, sim.bodies.ball, goal);
    expect(goal.achieved).toBe(true);
  });

  it("supports the hit-left-wall level", () => {
    const sim = createSimulation(hitLeftWallLevel);

    expect(sim.level.goal).toEqual({ type: "hit-left-wall", contactFrames: 1 });
    expect(sim.bodies.ball.circleRadius).toBe(26);
    expect(sim.bodies.statics.length).toBeGreaterThan(0);

    Body.setPosition(sim.bodies.ball, {
      x: sim.level.ball.radius,
      y: sim.bodies.ball.position.y,
    });

    const goal = evaluateGoal(sim.level, sim.bodies.ball, sim.goal);
    expect(goal.leftWallContact).toBe(true);
    expect(goal.achieved).toBe(true);
  });

  it("resets to the initial level state", () => {
    const sim = createSimulation();
    const stroke: StrokeAction = {
      id: "test",
      width: 18,
      points: [
        { x: 360, y: 300 },
        { x: 640, y: 300 },
      ],
    };

    sim.addStroke(stroke);
    for (let index = 0; index < 20; index += 1) {
      sim.step();
    }
    sim.reset();

    expect(sim.bodies.strokes).toHaveLength(0);
    expect(sim.goal.achieved).toBe(false);
    expect(sim.bodies.ball.position.x).toBeCloseTo(sim.level.ball.position.x);
    expect(sim.bodies.ball.position.y).toBeCloseTo(sim.level.ball.position.y);
  });

  it("replays a known stroke consistently in the same runtime", () => {
    const stroke: StrokeAction = {
      id: "replay",
      width: 18,
      points: [
        { x: 210, y: 240 },
        { x: 460, y: 260 },
        { x: 720, y: 244 },
      ],
    };

    const first = runReplay(stroke);
    const second = runReplay(stroke);

    expect(second).toEqual(first);
  });
});

function runReplay(stroke: StrokeAction): { x: number; y: number; achieved: boolean; consecutiveOffGroundFrames: number } {
  const sim = createSimulation();
  sim.addStroke(stroke);

  for (let index = 0; index < 180; index += 1) {
    sim.step();
  }

  return {
    x: Math.round(sim.bodies.ball.position.x * 1000) / 1000,
    y: Math.round(sim.bodies.ball.position.y * 1000) / 1000,
    achieved: sim.goal.achieved,
    consecutiveOffGroundFrames: sim.goal.consecutiveOffGroundFrames,
  };
}
