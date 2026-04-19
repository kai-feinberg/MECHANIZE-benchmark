import type { Body as MatterBody } from "matter-js";
import type {
  BodyMovementSummary,
  GameSimulation,
  MovementThresholds,
  StoppingCriteriaConfig,
  StoppingState,
} from "./types";

type BodySnapshot = {
  x: number;
  y: number;
  angle: number;
};

type FrameSnapshot = {
  frame: number;
  bodies: Map<number, BodySnapshot>;
};

export const DEFAULT_STOPPING_CRITERIA: StoppingCriteriaConfig = {
  frameBudget: 900,
  rollingWindowFrames: 30,
  quietFrames: 120,
  graceFrames: 30,
  thresholds: {
    linearSpeed: 0.02,
    angularSpeed: 0.002,
    positionDelta: 0.5,
    angleDelta: 0.01,
  },
};

export class StoppingCriteriaEvaluator {
  private readonly config: StoppingCriteriaConfig;
  private readonly history: FrameSnapshot[] = [];
  private quietFrameCount = 0;
  private lastStrokeFrame = 0;

  constructor(config: PartialStoppingCriteriaConfig = {}) {
    this.config = mergeStoppingCriteriaConfig(config);
  }

  get resolvedConfig(): StoppingCriteriaConfig {
    return this.config;
  }

  markStrokeAdded(frame: number): void {
    this.lastStrokeFrame = frame;
    this.quietFrameCount = 0;
  }

  evaluate(sim: GameSimulation, frame: number): StoppingState {
    const bodies = getTrackedDynamicBodies(sim);
    this.recordSnapshot(frame, bodies);

    const movement = summarizeMovement(bodies, this.getWindowSnapshot(), this.config.thresholds);
    const graceActive = frame - this.lastStrokeFrame < this.config.graceFrames;
    const anyMoving = movement.some((body) => body.moving);

    if (sim.goal.achieved) {
      return this.createState(frame, movement, "success");
    }

    if (frame >= this.config.frameBudget) {
      return this.createState(frame, movement, "timeout");
    }

    if (graceActive || anyMoving || this.history.length <= 1) {
      this.quietFrameCount = 0;
    } else {
      this.quietFrameCount += 1;
    }

    const terminalState = this.quietFrameCount >= this.config.quietFrames ? "stalled" : null;
    return this.createState(frame, movement, terminalState);
  }

  private createState(frame: number, movement: BodyMovementSummary[], terminalState: StoppingState["terminalState"]): StoppingState {
    return {
      frame,
      quietFrames: this.quietFrameCount,
      terminalState,
      movement,
    };
  }

  private recordSnapshot(frame: number, bodies: MatterBody[]): void {
    this.history.push({
      frame,
      bodies: new Map(
        bodies.map((body) => [
          body.id,
          {
            x: body.position.x,
            y: body.position.y,
            angle: body.angle,
          },
        ]),
      ),
    });

    while (this.history.length > this.config.rollingWindowFrames + 1) {
      this.history.shift();
    }
  }

  private getWindowSnapshot(): FrameSnapshot | undefined {
    return this.history[0];
  }
}

export type PartialStoppingCriteriaConfig = Partial<
  Omit<StoppingCriteriaConfig, "thresholds"> & {
    thresholds: Partial<MovementThresholds>;
  }
>;

export function mergeStoppingCriteriaConfig(config: PartialStoppingCriteriaConfig = {}): StoppingCriteriaConfig {
  return {
    ...DEFAULT_STOPPING_CRITERIA,
    ...config,
    thresholds: {
      ...DEFAULT_STOPPING_CRITERIA.thresholds,
      ...config.thresholds,
    },
  };
}

export function getTrackedDynamicBodies(sim: GameSimulation): MatterBody[] {
  return [sim.bodies.ball, ...sim.bodies.statics, ...sim.bodies.strokes].filter((body) => !body.isStatic);
}

function summarizeMovement(
  bodies: MatterBody[],
  windowSnapshot: FrameSnapshot | undefined,
  thresholds: MovementThresholds,
): BodyMovementSummary[] {
  return bodies.map((body) => {
    const previous = windowSnapshot?.bodies.get(body.id);
    const positionDelta = previous ? Math.hypot(body.position.x - previous.x, body.position.y - previous.y) : Infinity;
    const angleDelta = previous ? Math.abs(body.angle - previous.angle) : Infinity;
    const linearSpeed = Math.hypot(body.velocity.x, body.velocity.y);
    const angularSpeed = Math.abs(body.angularVelocity);
    const moving =
      linearSpeed > thresholds.linearSpeed ||
      angularSpeed > thresholds.angularSpeed ||
      positionDelta > thresholds.positionDelta ||
      angleDelta > thresholds.angleDelta;

    return {
      label: body.label,
      linearSpeed,
      angularSpeed,
      positionDelta,
      angleDelta,
      moving,
    };
  });
}
