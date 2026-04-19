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
    type: "off-ground",
    offGroundFrames: 150,
    groundClearance: 3,
  },
  limits: {
    maxStrokes: 1,
  },
};

export const hitLeftWallLevel: LevelDefinition = {
  id: "hit-left-wall-v1",
  name: "Hit the left wall",
  instruction: "Get the ball to hit the left wall",
  world: {
    width: 1000,
    height: 700,
  },
  ball: {
    position: { x: 610, y: 596 },
    radius: 26,
    density: 0.00045,
    friction: 0.005,
    frictionStatic: 0,
    frictionAir: 0.0008,
    restitution: 0.18,
  },
  floor: {
    y: 670,
    height: 60,
  },
  cup: {
    center: { x: 610, y: 537 },
    radius: 94,
    thickness: 18,
    segments: 8,
  },
  goal: {
    type: "hit-left-wall",
    contactFrames: 1,
  },
  limits: {
    maxStrokes: 1,
  },
};

export const levels = [liftBallLevel, hitLeftWallLevel] as const;
