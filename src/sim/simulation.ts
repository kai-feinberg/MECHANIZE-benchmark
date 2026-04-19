import { Bodies, Body, Composite, Engine } from "matter-js";
import { FIXED_TIMESTEP_MS, liftBallLevel } from "./level";
import { createStrokeBody } from "./strokeBody";
import type { GameSimulation, GoalState, LevelDefinition, StrokeAction, SimulationBodies } from "./types";

export function createSimulation(level: LevelDefinition = liftBallLevel): GameSimulation {
  let engine = createEngine();
  let bodies = createLevelBodies(level);
  let goal = createInitialGoal(level);

  Composite.add(engine.world, [bodies.floor, bodies.leftWall, bodies.rightWall, bodies.ceiling, bodies.ball]);

  const step = (): GoalState => {
    Engine.update(engine, FIXED_TIMESTEP_MS);
    goal = evaluateGoal(level, bodies.ball, goal.consecutiveOffGroundFrames);
    return goal;
  };

  const addStroke = (stroke: StrokeAction): Body | null => {
    if (bodies.strokes.length >= level.limits.maxStrokes) {
      return null;
    }

    const body = createStrokeBody(stroke);
    if (!body) {
      return null;
    }

    bodies.strokes.push(body);
    Composite.add(engine.world, body);
    return body;
  };

  const reset = (): void => {
    Engine.clear(engine);
    engine = createEngine();
    bodies = createLevelBodies(level);
    goal = createInitialGoal(level);
    Composite.add(engine.world, [bodies.floor, bodies.leftWall, bodies.rightWall, bodies.ceiling, bodies.ball]);
  };

  return {
    get engine() {
      return engine;
    },
    level,
    get bodies() {
      return bodies;
    },
    get goal() {
      return goal;
    },
    step,
    addStroke,
    reset,
  };
}

export function evaluateGoal(level: LevelDefinition, ball: Body, priorOffGroundFrames: number): GoalState {
  const floorTop = level.floor.y - level.floor.height / 2;
  const ballBottom = ball.position.y + level.ball.radius;
  const groundClearance = floorTop - ballBottom;
  const isOffGround = groundClearance >= level.goal.groundClearance;
  const consecutiveOffGroundFrames = isOffGround ? priorOffGroundFrames + 1 : 0;

  return {
    achieved: consecutiveOffGroundFrames >= level.goal.offGroundFrames,
    consecutiveOffGroundFrames,
    requiredOffGroundFrames: level.goal.offGroundFrames,
    groundClearance,
  };
}

function createEngine(): Engine {
  const engine = Engine.create({
    enableSleeping: false,
  });
  engine.gravity.y = 1;
  engine.positionIterations = 8;
  engine.velocityIterations = 6;
  engine.constraintIterations = 2;
  return engine;
}

function createLevelBodies(level: LevelDefinition): SimulationBodies {
  const wallThickness = 80;
  const floor = Bodies.rectangle(level.world.width / 2, level.floor.y, level.world.width + wallThickness * 2, level.floor.height, {
    label: "floor",
    isStatic: true,
    friction: 0.95,
    render: {
      fillStyle: "#8b948f",
    },
  });
  const leftWall = Bodies.rectangle(-wallThickness / 2, level.world.height / 2, wallThickness, level.world.height, {
    label: "left-wall",
    isStatic: true,
  });
  const rightWall = Bodies.rectangle(level.world.width + wallThickness / 2, level.world.height / 2, wallThickness, level.world.height, {
    label: "right-wall",
    isStatic: true,
  });
  const ceiling = Bodies.rectangle(level.world.width / 2, -wallThickness / 2, level.world.width, wallThickness, {
    label: "ceiling",
    isStatic: true,
  });
  const ball = Bodies.circle(level.ball.position.x, level.ball.position.y, level.ball.radius, {
    label: "ball",
    density: 0.003,
    friction: 0.7,
    frictionAir: 0.005,
    restitution: 0.12,
    render: {
      fillStyle: "#f4bd37",
      strokeStyle: "#171b24",
      lineWidth: 3,
    },
  });

  return {
    ball,
    floor,
    leftWall,
    rightWall,
    ceiling,
    strokes: [],
  };
}

function createInitialGoal(level: LevelDefinition): GoalState {
  return {
    achieved: false,
    consecutiveOffGroundFrames: 0,
    requiredOffGroundFrames: level.goal.offGroundFrames,
    groundClearance: 0,
  };
}
