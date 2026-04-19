import type { Body, Engine } from "matter-js";

export type Vec2 = {
  x: number;
  y: number;
};

export type StrokeAction = {
  id: string;
  width: number;
  points: Vec2[];
};

export type LevelDefinition = {
  id: string;
  name: string;
  instruction: string;
  world: {
    width: number;
    height: number;
  };
  ball: {
    position: Vec2;
    radius: number;
  };
  floor: {
    y: number;
    height: number;
  };
  goal: {
    offGroundFrames: number;
    groundClearance: number;
  };
  limits: {
    maxStrokes: number;
  };
};

export type GoalState = {
  achieved: boolean;
  consecutiveOffGroundFrames: number;
  requiredOffGroundFrames: number;
  groundClearance: number;
};

export type SimulationBodies = {
  ball: Body;
  floor: Body;
  leftWall: Body;
  rightWall: Body;
  ceiling: Body;
  strokes: Body[];
};

export type GameSimulation = {
  engine: Engine;
  level: LevelDefinition;
  bodies: SimulationBodies;
  goal: GoalState;
  step: () => GoalState;
  addStroke: (stroke: StrokeAction) => Body | null;
  reset: () => void;
};
