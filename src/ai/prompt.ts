import type { LevelDefinition } from "../sim/types";

export const AI_PROMPT_VERSION = "ai-stroke-v1";

export function buildAiBenchmarkMessages(level: LevelDefinition): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content: [
        "You generate one-shot candidate actions for a 2D physics benchmark.",
        "Return only JSON matching the provided schema. Include concise reasoning in the reasoning field.",
        "Do not include markdown, commentary outside JSON, or extra keys.",
        "The JSON will be parsed, placed into the game, simulated once, and scored automatically.",
      ].join(" "),
    },
    {
      role: "user",
      content: buildLevelPrompt(level),
    },
  ];
}

export function buildLevelPrompt(level: LevelDefinition): string {
  const goalDescription = describeGoal(level);
  const cupDescription = level.cup
    ? [
        "Static cup obstacle:",
        `- center: (${level.cup.center.x}, ${level.cup.center.y})`,
        `- radius: ${level.cup.radius}`,
        `- thickness: ${level.cup.thickness}`,
        `- segments: ${level.cup.segments}`,
      ].join("\n")
    : "Static cup obstacle: none";

  return [
    "Game premise:",
    "- Place the allowed stroke shapes on the canvas before simulation starts.",
    "- Each stroke becomes one heavy dynamic compound body made from a thick open polyline.",
    "- Gravity pulls downward. The ball, strokes, floor, walls, ceiling, and cup obstacles collide.",
    "- After placement, physics runs once. There is no feedback loop for this attempt.",
    "",
    "Coordinate system:",
    "- Origin is the top-left corner.",
    "- x increases to the right.",
    "- y increases downward.",
    `- Valid coordinate bounds are 0 <= x <= ${level.world.width} and 0 <= y <= ${level.world.height}.`,
    "",
    "Level:",
    `- id: ${level.id}`,
    `- name: ${level.name}`,
    `- instruction: ${level.instruction}`,
    `- world: ${level.world.width} x ${level.world.height}`,
    `- ball: center (${level.ball.position.x}, ${level.ball.position.y}), radius ${level.ball.radius}`,
    `- ball material hints: density ${level.ball.density ?? "default"}, friction ${level.ball.friction ?? "default"}, static friction ${level.ball.frictionStatic ?? "default"}, air friction ${level.ball.frictionAir ?? "default"}, restitution ${level.ball.restitution ?? "default"}`,
    `- floor: center y ${level.floor.y}, height ${level.floor.height}`,
    cupDescription,
    "",
    "Goal:",
    `- ${goalDescription}`,
    "",
    "Stroke constraints:",
    "- Include a concise reasoning string explaining the intended physical mechanism.",
    `- Generate exactly this levelId: ${level.id}`,
    `- Maximum strokes: ${level.limits.maxStrokes}`,
    "- Width must be between 1 and 80.",
    "- Each stroke must have 2 to 160 points.",
    "- Every point must stay inside the world bounds.",
    "- Use sparse control points; the engine smooths and resamples the stroke.",
    "- Do not generate SVG paths, polygons, boxes, circles, closed shapes, text, explanations, or extra JSON properties.",
    "",
    "Valid example shape:",
    JSON.stringify(
      {
        reasoning: "Drop a heavy diagonal pusher near the ball so gravity converts the stroke into leftward momentum.",
        levelId: level.id,
        strokes: [
          {
            id: "ai-stroke-1",
            width: 40,
            points: [
              { x: Math.round(level.ball.position.x), y: Math.max(0, Math.round(level.ball.position.y - 220)) },
              { x: Math.min(level.world.width, Math.round(level.ball.position.x + 180)), y: Math.round(level.ball.position.y - 40) },
            ],
          },
        ],
      },
      null,
      2,
    ),
    "",
    "Invalid example:",
    JSON.stringify(
      {
        reasoning: "This is invalid because it uses an unsupported shape, a too-wide stroke, and out-of-bounds points.",
        levelId: level.id,
        strokes: [
          {
            id: "bad-extra-properties",
            width: 120,
            shape: "box",
            points: [
              { x: -10, y: 0 },
              { x: level.world.width + 10, y: level.world.height + 10 },
            ],
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
}

function describeGoal(level: LevelDefinition): string {
  if (level.goal.type === "hit-left-wall") {
    return `Make the ball contact the left wall for ${level.goal.contactFrames} frame(s).`;
  }
  return `Keep the ball at least ${level.goal.groundClearance} units above the floor for ${level.goal.offGroundFrames} consecutive frame(s).`;
}
