import Matter from "matter-js";
import { describe, expect, it } from "vitest";
import { groundLeftWallLevel, hitLeftWallLevel } from "./level";
import { createSimulation, evaluateGoal } from "./simulation";
import type { StrokeAction } from "./types";

describe("game simulation", () => {
  it("initializes the default ground-left-wall level", () => {
    const sim = createSimulation();

    expect(sim.level.world).toEqual({ width: 1000, height: 700 });
    expect(sim.level.goal).toEqual({ type: "hit-left-wall", contactFrames: 1 });
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

  it("requires the ball to touch the left wall", () => {
    const sim = createSimulation(groundLeftWallLevel);
    let goal = sim.goal;

    Matter.Body.setPosition(sim.bodies.ball, {
      x: sim.level.ball.radius + 20,
      y: sim.level.ball.position.y,
    });
    goal = evaluateGoal(sim.level, sim.bodies.ball, goal);
    expect(goal.achieved).toBe(false);

    Matter.Body.setPosition(sim.bodies.ball, {
      x: sim.level.ball.radius,
      y: sim.level.ball.position.y,
    });
    goal = evaluateGoal(sim.level, sim.bodies.ball, goal);
    expect(goal.achieved).toBe(true);
  });

  it("supports the hit-left-wall level", () => {
    const sim = createSimulation(hitLeftWallLevel);

    expect(sim.level.goal).toEqual({ type: "hit-left-wall", contactFrames: 1 });
    expect(sim.bodies.ball.circleRadius).toBe(26);
    expect(sim.bodies.statics.length).toBeGreaterThan(0);

    Matter.Body.setPosition(sim.bodies.ball, {
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

  it("nudges new strokes away from existing level bodies", () => {
    const sim = createSimulation(hitLeftWallLevel);
    const stroke: StrokeAction = {
      id: "overlapping-ball",
      width: 18,
      points: [
        { x: 590, y: 596 },
        { x: 630, y: 596 },
      ],
    };

    const body = sim.addStroke(stroke);

    expect(body).not.toBeNull();
    if (!body) {
      throw new Error("Expected stroke body.");
    }
    expect(Matter.Query.collides(body, [sim.bodies.ball, ...sim.bodies.statics])).toHaveLength(0);
  });

  it("rejects strokes that overlap cup geometry", () => {
    const sim = createSimulation(hitLeftWallLevel);
    const stroke: StrokeAction = {
      id: "overlapping-cup",
      width: 18,
      points: [
        { x: 546, y: 608 },
        { x: 676, y: 608 },
      ],
    };

    expect(sim.addStroke(stroke)).toBeNull();
    expect(sim.bodies.strokes).toHaveLength(0);
  });

  it("rejects strokes that overlap terrain too deeply", () => {
    const sim = createSimulation();
    const stroke: StrokeAction = {
      id: "buried-in-floor",
      width: 18,
      points: [
        { x: 100, y: 670 },
        { x: 250, y: 670 },
      ],
    };

    expect(sim.addStroke(stroke)).toBeNull();
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

function runReplay(stroke: StrokeAction): { x: number; y: number; achieved: boolean; consecutiveLeftWallContactFrames: number } {
  const sim = createSimulation();
  sim.addStroke(stroke);

  for (let index = 0; index < 180; index += 1) {
    sim.step();
  }

  return {
    x: Math.round(sim.bodies.ball.position.x * 1000) / 1000,
    y: Math.round(sim.bodies.ball.position.y * 1000) / 1000,
    achieved: sim.goal.achieved,
    consecutiveLeftWallContactFrames: sim.goal.consecutiveLeftWallContactFrames,
  };
}
