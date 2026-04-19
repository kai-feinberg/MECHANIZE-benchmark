import Matter from "matter-js";
import type { Body as MatterBody, Engine as MatterEngine } from "matter-js";
import { FIXED_TIMESTEP_MS, liftBallLevel } from "./level";
import { createStrokeBody } from "./strokeBody";
import type { GameSimulation, GoalState, LevelDefinition, StrokeAction, SimulationBodies } from "./types";

const { Bodies, Composite, Engine } = Matter;

export function createSimulation(level: LevelDefinition = liftBallLevel): GameSimulation {
  let engine = createEngine();
  let bodies = createLevelBodies(level);
  let goal = createInitialGoal(level);

  addLevelBodies(engine, bodies);

  const step = (): GoalState => {
    Engine.update(engine, FIXED_TIMESTEP_MS);
    goal = evaluateGoal(level, bodies.ball, goal);
    return goal;
  };

  const addStroke = (stroke: StrokeAction): MatterBody | null => {
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
    addLevelBodies(engine, bodies);
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

export function evaluateGoal(level: LevelDefinition, ball: MatterBody, priorGoal: GoalState): GoalState {
  const floorTop = level.floor.y - level.floor.height / 2;
  const ballBottom = ball.position.y + level.ball.radius;
  const groundClearance = floorTop - ballBottom;
  const isOffGround = level.goal.type === "off-ground" && groundClearance >= level.goal.groundClearance;
  const consecutiveOffGroundFrames = isOffGround ? priorGoal.consecutiveOffGroundFrames + 1 : 0;
  const leftWallContact = level.goal.type === "hit-left-wall" && ball.bounds.min.x <= 1;
  const consecutiveLeftWallContactFrames = leftWallContact ? priorGoal.consecutiveLeftWallContactFrames + 1 : 0;
  const offGroundAchieved = level.goal.type === "off-ground" && consecutiveOffGroundFrames >= level.goal.offGroundFrames;
  const leftWallAchieved = level.goal.type === "hit-left-wall" && consecutiveLeftWallContactFrames >= level.goal.contactFrames;

  return {
    achieved: offGroundAchieved || leftWallAchieved,
    consecutiveOffGroundFrames,
    requiredOffGroundFrames: level.goal.type === "off-ground" ? level.goal.offGroundFrames : 0,
    groundClearance,
    consecutiveLeftWallContactFrames,
    requiredLeftWallContactFrames: level.goal.type === "hit-left-wall" ? level.goal.contactFrames : 0,
    leftWallContact,
  };
}

function createEngine(): MatterEngine {
  const engine = Engine.create({
    enableSleeping: false,
  });
  engine.gravity.y = 1;
  engine.positionIterations = 12;
  engine.velocityIterations = 8;
  engine.constraintIterations = 2;
  return engine;
}

function createLevelBodies(level: LevelDefinition): SimulationBodies {
  const wallThickness = 80;
  const floor = Bodies.rectangle(level.world.width / 2, level.floor.y, level.world.width + wallThickness * 2, level.floor.height, {
    label: "floor",
    isStatic: true,
    friction: 0.05,
    frictionStatic: 0.02,
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
    density: level.ball.density ?? 0.003,
    friction: level.ball.friction ?? 0.35,
    frictionStatic: level.ball.frictionStatic ?? 0.15,
    frictionAir: level.ball.frictionAir ?? 0.018,
    restitution: level.ball.restitution ?? 0,
    slop: 0.5,
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
    statics: level.cup ? createCupBodies(level) : [],
    strokes: [],
  };
}

function createInitialGoal(level: LevelDefinition): GoalState {
  return {
    achieved: false,
    consecutiveOffGroundFrames: 0,
    requiredOffGroundFrames: level.goal.type === "off-ground" ? level.goal.offGroundFrames : 0,
    groundClearance: 0,
    consecutiveLeftWallContactFrames: 0,
    requiredLeftWallContactFrames: level.goal.type === "hit-left-wall" ? level.goal.contactFrames : 0,
    leftWallContact: false,
  };
}

function addLevelBodies(engine: MatterEngine, bodies: SimulationBodies): void {
  Composite.add(engine.world, [
    bodies.floor,
    bodies.leftWall,
    bodies.rightWall,
    bodies.ceiling,
    ...bodies.statics,
    bodies.ball,
  ]);
}

function createCupBodies(level: LevelDefinition): MatterBody[] {
  if (!level.cup) {
    return [];
  }

  const parts: MatterBody[] = [];
  const startAngle = Math.PI * 0.16;
  const endAngle = Math.PI * 0.84;
  const step = (endAngle - startAngle) / (level.cup.segments - 1);

  for (let index = 0; index < level.cup.segments; index += 1) {
    const angle = startAngle + step * index;
    const x = level.cup.center.x + Math.cos(angle) * level.cup.radius;
    const y = level.cup.center.y + Math.sin(angle) * level.cup.radius;
    const tangent = angle + Math.PI / 2;

    parts.push(
      Bodies.rectangle(x, y, level.cup.radius * 0.34, level.cup.thickness, {
        label: "cup-part",
        angle: tangent,
        friction: 0.02,
        frictionStatic: 0,
        restitution: 0.08,
        chamfer: {
          radius: level.cup.thickness / 2,
        },
      }),
    );
  }

  return [
    Matter.Body.create({
      label: "cup",
      parts,
      density: 0.0011,
      friction: 0.24,
      frictionStatic: 0.08,
      frictionAir: 0.004,
      restitution: 0.03,
      slop: 0.8,
    }),
  ];
}
