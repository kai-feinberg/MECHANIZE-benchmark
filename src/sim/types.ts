import type { Body as MatterBody, Engine as MatterEngine } from "matter-js";

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
  ball: MatterBody;
  floor: MatterBody;
  leftWall: MatterBody;
  rightWall: MatterBody;
  ceiling: MatterBody;
  statics: MatterBody[];
  strokes: MatterBody[];
};

export type GameSimulation = {
  engine: MatterEngine;
  level: LevelDefinition;
  bodies: SimulationBodies;
  goal: GoalState;
  step: () => GoalState;
  addStroke: (stroke: StrokeAction) => MatterBody | null;
  reset: () => void;
};

export type TerminalState = "success" | "stalled" | "timeout";

export type MovementThresholds = {
  linearSpeed: number;
  angularSpeed: number;
  positionDelta: number;
  angleDelta: number;
};

export type StoppingCriteriaConfig = {
  frameBudget: number;
  rollingWindowFrames: number;
  quietFrames: number;
  graceFrames: number;
  thresholds: MovementThresholds;
};

export type BodyMovementSummary = {
  label: string;
  linearSpeed: number;
  angularSpeed: number;
  positionDelta: number;
  angleDelta: number;
  moving: boolean;
};

export type StoppingState = {
  frame: number;
  quietFrames: number;
  terminalState: TerminalState | null;
  movement: BodyMovementSummary[];
};
