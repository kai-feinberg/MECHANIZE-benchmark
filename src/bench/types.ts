import type { BodyMovementSummary, LevelDefinition, MovementThresholds, StrokeAction, TerminalState, Vec2 } from "../sim/types";

export type CandidateAction = {
  levelId: string;
  strokes: StrokeAction[];
};

export type CandidateFile = CandidateAction | { candidates: CandidateAction[] };

export type BenchmarkBodyTrace = {
  label: string;
  position: Vec2;
  angle: number;
  velocity: Vec2;
  angularVelocity: number;
};

export type BenchmarkTraceFrame = {
  frame: number;
  bodies: BenchmarkBodyTrace[];
  goalAchieved: boolean;
  terminalState: TerminalState | null;
  quietFrames: number;
  movement: BodyMovementSummary[];
};

export type BenchmarkTrace = {
  levelId: string;
  action: CandidateAction;
  frames: BenchmarkTraceFrame[];
};

export type BenchmarkResult = {
  levelId: string;
  success: boolean;
  terminalState: TerminalState;
  firstSuccessFrame: number | null;
  terminalFrame: number;
  finalBall: {
    position: Vec2;
    velocity: Vec2;
  };
  consecutiveOffGroundFrames: number;
  consecutiveLeftWallContactFrames: number;
  quietFrames: number;
  movementThresholds: MovementThresholds;
  strokeCount: number;
  strokeLength: number;
  frameBudget: number;
  trace?: BenchmarkTrace;
};

export type BenchmarkRunBundle = {
  schemaVersion: 1;
  level: LevelDefinition;
  action: CandidateAction;
  result: Omit<BenchmarkResult, "trace">;
  trace: BenchmarkTrace;
  metadata: {
    createdAt: string;
    runner: string;
    source?: "manual" | "openrouter";
    model?: string;
    promptVersion?: string;
    temperature?: number;
    seed?: number;
    responseId?: string;
    reasoning?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    provider?: string;
  };
};
