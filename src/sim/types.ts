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
    density?: number;
    friction?: number;
    frictionStatic?: number;
    frictionAir?: number;
    restitution?: number;
  };
  floor: {
    y: number;
    height: number;
  };
  cup?: {
    center: Vec2;
    radius: number;
    thickness: number;
    segments: number;
  };
  goal:
    | {
        type: "off-ground";
        offGroundFrames: number;
        groundClearance: number;
      }
    | {
        type: "hit-left-wall";
        contactFrames: number;
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
  consecutiveLeftWallContactFrames: number;
  requiredLeftWallContactFrames: number;
  leftWallContact: boolean;
};

export type SimulationBodies = {
  ball: Body;
  floor: Body;
  leftWall: Body;
  rightWall: Body;
  ceiling: Body;
  statics: Body[];
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
