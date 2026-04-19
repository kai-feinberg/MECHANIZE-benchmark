import Matter from "matter-js";
import { describe, expect, it } from "vitest";
import { createSimulation } from "./simulation";
import { StoppingCriteriaEvaluator } from "./stopping";
import type { LevelDefinition } from "./types";

describe("stopping criteria", () => {
  it("returns success immediately when the goal is achieved", () => {
    const level: LevelDefinition = {
      id: "quick-success",
      name: "Quick success",
      instruction: "Lift",
      world: { width: 1000, height: 700 },
      ball: { position: { x: 340, y: 535 }, radius: 105 },
      floor: { y: 670, height: 60 },
      goal: { type: "off-ground", offGroundFrames: 1, groundClearance: 3 },
      limits: { maxStrokes: 1 },
    };
    const sim = createSimulation(level);
    const stopping = new StoppingCriteriaEvaluator({ frameBudget: 20, quietFrames: 4, graceFrames: 0 });
    const floorTop = sim.level.floor.y - sim.level.floor.height / 2;

    expect(sim.level.goal.type).toBe("off-ground");
    if (sim.level.goal.type !== "off-ground") {
      throw new Error("Expected off-ground goal.");
    }

    Matter.Body.setPosition(sim.bodies.ball, {
      x: sim.bodies.ball.position.x,
      y: floorTop - sim.level.ball.radius - sim.level.goal.groundClearance - 50,
    });

    sim.step();
    const state = stopping.evaluate(sim, 1);

    expect(state.terminalState).toBe("success");
  });

  it("returns timeout when the frame budget is exhausted", () => {
    const sim = createSimulation();
    const stopping = new StoppingCriteriaEvaluator({ frameBudget: 3, quietFrames: 100, graceFrames: 0 });

    sim.step();
    expect(stopping.evaluate(sim, 1).terminalState).toBeNull();
    sim.step();
    expect(stopping.evaluate(sim, 2).terminalState).toBeNull();
    sim.step();
    expect(stopping.evaluate(sim, 3).terminalState).toBe("timeout");
  });

  it("requires the configured quiet frame count before returning stalled", () => {
    const sim = createSimulation();
    const stopping = new StoppingCriteriaEvaluator({
      frameBudget: 50,
      rollingWindowFrames: 2,
      quietFrames: 3,
      graceFrames: 0,
      thresholds: {
        linearSpeed: 0.5,
        angularSpeed: 0.5,
        positionDelta: 0.5,
        angleDelta: 0.5,
      },
    });

    Matter.Body.setVelocity(sim.bodies.ball, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(sim.bodies.ball, 0);

    expect(stopping.evaluate(sim, 1).terminalState).toBeNull();
    expect(stopping.evaluate(sim, 2).terminalState).toBeNull();
    expect(stopping.evaluate(sim, 3).terminalState).toBeNull();
    expect(stopping.evaluate(sim, 4).terminalState).toBe("stalled");
  });

  it("ignores small jitter below thresholds", () => {
    const sim = createSimulation();
    const stopping = new StoppingCriteriaEvaluator({
      frameBudget: 50,
      rollingWindowFrames: 2,
      quietFrames: 2,
      graceFrames: 0,
      thresholds: {
        linearSpeed: 0.1,
        angularSpeed: 0.1,
        positionDelta: 0.5,
        angleDelta: 0.1,
      },
    });

    stopping.evaluate(sim, 1);
    Matter.Body.setPosition(sim.bodies.ball, {
      x: sim.bodies.ball.position.x + 0.01,
      y: sim.bodies.ball.position.y,
    });
    Matter.Body.setVelocity(sim.bodies.ball, { x: 0.01, y: 0 });
    const second = stopping.evaluate(sim, 2);
    Matter.Body.setPosition(sim.bodies.ball, {
      x: sim.bodies.ball.position.x + 0.01,
      y: sim.bodies.ball.position.y,
    });
    const third = stopping.evaluate(sim, 3);

    expect(second.quietFrames).toBe(1);
    expect(third.terminalState).toBe("stalled");
  });

  it("resets quiet frames after a real nudge", () => {
    const sim = createSimulation();
    const stopping = new StoppingCriteriaEvaluator({
      frameBudget: 50,
      rollingWindowFrames: 2,
      quietFrames: 3,
      graceFrames: 0,
      thresholds: {
        linearSpeed: 0.1,
        angularSpeed: 0.1,
        positionDelta: 0.5,
        angleDelta: 0.1,
      },
    });

    stopping.evaluate(sim, 1);
    expect(stopping.evaluate(sim, 2).quietFrames).toBe(1);

    Matter.Body.setPosition(sim.bodies.ball, {
      x: sim.bodies.ball.position.x + 4,
      y: sim.bodies.ball.position.y,
    });
    const nudged = stopping.evaluate(sim, 3);
    stopping.evaluate(sim, 4);
    const quietAgain = stopping.evaluate(sim, 5);

    expect(nudged.quietFrames).toBe(0);
    expect(quietAgain.quietFrames).toBe(1);
  });
});
