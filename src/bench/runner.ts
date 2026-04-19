import Matter from "matter-js";
import { levels } from "../sim/level";
import { createSimulation } from "../sim/simulation";
import { measureStrokeLength } from "../sim/strokeBody";
import { DEFAULT_STOPPING_CRITERIA, StoppingCriteriaEvaluator, type PartialStoppingCriteriaConfig } from "../sim/stopping";
import type { GameSimulation, LevelDefinition, TerminalState } from "../sim/types";
import type { BenchmarkBodyTrace, BenchmarkResult, BenchmarkRunBundle, BenchmarkTrace, BenchmarkTraceFrame, CandidateAction } from "./types";

const { Composite } = Matter;

export type RunBenchmarkOptions = {
  levels?: readonly LevelDefinition[];
  stopping?: PartialStoppingCriteriaConfig;
  includeTrace?: boolean;
};

type RunBundleMetadata = Partial<BenchmarkRunBundle["metadata"]>;

export function runBenchmark(action: CandidateAction, options: RunBenchmarkOptions = {}): BenchmarkResult {
  const availableLevels = options.levels ?? levels;
  const level = availableLevels.find((candidate) => candidate.id === action.levelId);
  if (!level) {
    throw new Error(`Unknown levelId: ${action.levelId}`);
  }

  const sim = createSimulation(level);
  const stopping = new StoppingCriteriaEvaluator(options.stopping);
  let frame = 0;
  let firstSuccessFrame: number | null = null;
  let lastTerminalState: TerminalState | null = null;
  let lastQuietFrames = 0;
  const traceFrames: BenchmarkTraceFrame[] = [];

  for (const stroke of action.strokes) {
    if (sim.addStroke(stroke)) {
      stopping.markStrokeAdded(frame);
    } else {
      throw new Error(
        `Stroke ${stroke.id} could not be placed. It may be too short, exceed the stroke limit, overlap the floor or walls too deeply, or remain overlapped with an existing object after nudging.`,
      );
    }
  }

  while (!lastTerminalState) {
    frame += 1;
    sim.step();

    const stoppingState = stopping.evaluate(sim, frame);
    if (sim.goal.achieved && firstSuccessFrame === null) {
      firstSuccessFrame = frame;
    }
    lastQuietFrames = stoppingState.quietFrames;
    lastTerminalState = stoppingState.terminalState;

    if (options.includeTrace) {
      traceFrames.push(createTraceFrame(sim, frame, stoppingState.terminalState, stoppingState.quietFrames, stoppingState.movement));
    }
  }

  const resolvedStopping = stopping.resolvedConfig;
  const trace: BenchmarkTrace | undefined = options.includeTrace
    ? {
        levelId: level.id,
        action,
        frames: traceFrames,
      }
    : undefined;

  return {
    levelId: level.id,
    success: lastTerminalState === "success",
    terminalState: lastTerminalState,
    firstSuccessFrame,
    terminalFrame: frame,
    finalBall: {
      position: {
        x: sim.bodies.ball.position.x,
        y: sim.bodies.ball.position.y,
      },
      velocity: {
        x: sim.bodies.ball.velocity.x,
        y: sim.bodies.ball.velocity.y,
      },
    },
    consecutiveOffGroundFrames: sim.goal.consecutiveOffGroundFrames,
    consecutiveLeftWallContactFrames: sim.goal.consecutiveLeftWallContactFrames,
    quietFrames: lastQuietFrames,
    movementThresholds: resolvedStopping.thresholds,
    strokeCount: action.strokes.length,
    strokeLength: action.strokes.reduce((total, stroke) => total + measureStrokeLength(stroke.points), 0),
    frameBudget: resolvedStopping.frameBudget,
    trace,
  };
}

export { DEFAULT_STOPPING_CRITERIA };

export function createRunBundle(
  action: CandidateAction,
  options: Omit<RunBenchmarkOptions, "includeTrace"> & { metadata?: RunBundleMetadata } = {},
): BenchmarkRunBundle {
  const availableLevels = options.levels ?? levels;
  const level = availableLevels.find((candidate) => candidate.id === action.levelId);
  if (!level) {
    throw new Error(`Unknown levelId: ${action.levelId}`);
  }

  const result = runBenchmark(action, {
    ...options,
    includeTrace: true,
  });
  if (!result.trace) {
    throw new Error("Expected benchmark trace to be recorded.");
  }

  return {
    schemaVersion: 1,
    level,
    action,
    result: stripTrace(result),
    trace: result.trace,
    metadata: {
      createdAt: new Date().toISOString(),
      runner: "brain-it-on-benchmark",
      source: "manual",
      ...options.metadata,
    },
  };
}

function createTraceFrame(
  sim: GameSimulation,
  frame: number,
  terminalState: TerminalState | null,
  quietFrames: number,
  movement: BenchmarkTraceFrame["movement"],
): BenchmarkTraceFrame {
  return {
    frame,
    bodies: Composite.allBodies(sim.engine.world)
      .filter((body) => !body.isStatic)
      .map(
        (body): BenchmarkBodyTrace => ({
          label: body.label,
          position: {
            x: body.position.x,
            y: body.position.y,
          },
          angle: body.angle,
          velocity: {
            x: body.velocity.x,
            y: body.velocity.y,
          },
          angularVelocity: body.angularVelocity,
        }),
      ),
    goalAchieved: sim.goal.achieved,
    terminalState,
    quietFrames,
    movement,
  };
}

function stripTrace(result: BenchmarkResult): Omit<BenchmarkResult, "trace"> {
  const withoutTrace = { ...result };
  delete withoutTrace.trace;
  return withoutTrace;
}
