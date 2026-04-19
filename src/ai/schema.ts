import type { LevelDefinition } from "../sim/types";
import type { CandidateAction } from "../bench/types";
import { parseCandidateFile } from "../bench/validation";

export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 80;
export const MIN_POINTS_PER_STROKE = 2;
export const MAX_POINTS_PER_STROKE = 160;

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

export type ParsedAiCandidateResponse = {
  action: CandidateAction;
  reasoning: string;
};

export function createCandidateActionJsonSchema(level: LevelDefinition): JsonSchema {
  return {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        minLength: 1,
        maxLength: 1200,
        description: "A concise explanation of why these strokes should solve the level.",
      },
      levelId: {
        type: "string",
        const: level.id,
        description: "The exact level id being attempted.",
      },
      strokes: {
        type: "array",
        minItems: 0,
        maxItems: level.limits.maxStrokes,
        description: "The generated dynamic strokes to place before physics starts.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              minLength: 1,
              description: "Stable id for this generated stroke.",
            },
            width: {
              type: "number",
              minimum: MIN_STROKE_WIDTH,
              maximum: MAX_STROKE_WIDTH,
              description: "Stroke thickness in world units.",
            },
            points: {
              type: "array",
              minItems: MIN_POINTS_PER_STROKE,
              maxItems: MAX_POINTS_PER_STROKE,
              description: "Open polyline control points in world coordinates.",
              items: {
                type: "object",
                properties: {
                  x: {
                    type: "number",
                    minimum: 0,
                    maximum: level.world.width,
                  },
                  y: {
                    type: "number",
                    minimum: 0,
                    maximum: level.world.height,
                  },
                },
                required: ["x", "y"],
                additionalProperties: false,
              },
            },
          },
          required: ["id", "width", "points"],
          additionalProperties: false,
        },
      },
    },
    required: ["reasoning", "levelId", "strokes"],
    additionalProperties: false,
  };
}

export function parseAiCandidateResponse(content: string, levels: readonly LevelDefinition[]): ParsedAiCandidateResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(`OpenRouter response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const reasoning = isRecord(parsed) && typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
  if (!reasoning) {
    throw new Error("OpenRouter response must include a non-empty reasoning string.");
  }

  const candidates = parseCandidateFile(parsed, levels);
  if (candidates.length !== 1) {
    throw new Error("OpenRouter response must contain exactly one candidate action.");
  }
  return {
    action: candidates[0],
    reasoning,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
