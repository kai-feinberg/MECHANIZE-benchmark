import type { LevelDefinition } from "./types";

export const FIXED_TIMESTEP_MS = 1000 / 60;

export const liftBallLevel: LevelDefinition = {
  id: "lift-ball-v1",
  name: "Lift the ball",
  instruction: "Lift the ball off the ground",
  world: {
    width: 1000,
    height: 700,
  },
  ball: {
    position: { x: 340, y: 535 },
    radius: 105,
  },
  floor: {
    y: 670,
    height: 60,
  },
  goal: {
    liftBy: 150,
    holdSteps: 30,
  },
  limits: {
    maxStrokes: 1,
  },
};
