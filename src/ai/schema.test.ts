import { describe, expect, it } from "vitest";
import { groundLeftWallLevel } from "../sim/level";
import { createCandidateActionJsonSchema, parseAiCandidateResponse } from "./schema";

describe("AI candidate schema", () => {
  it("exports level-specific stroke action constraints", () => {
    const schema = createCandidateActionJsonSchema(groundLeftWallLevel);
    const reasoning = schema.properties.reasoning as { type: string; maxLength: number };
    const strokes = schema.properties.strokes as {
      maxItems: number;
      items: {
        additionalProperties: boolean;
        properties: {
          width: { minimum: number; maximum: number };
          points: { maxItems: number; items: { properties: { x: { maximum: number }; y: { maximum: number } } } };
        };
      };
    };

    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain("reasoning");
    expect(reasoning).toMatchObject({ type: "string", maxLength: 1200 });
    expect(strokes.maxItems).toBe(1);
    expect(strokes.items.additionalProperties).toBe(false);
    expect(strokes.items.properties.width).toMatchObject({ minimum: 1, maximum: 80 });
    expect(strokes.items.properties.points.maxItems).toBe(160);
    expect(strokes.items.properties.points.items.properties.x.maximum).toBe(1000);
    expect(strokes.items.properties.points.items.properties.y.maximum).toBe(700);
  });

  it("parses valid structured output into a candidate action", () => {
    const action = parseAiCandidateResponse(
      JSON.stringify({
        reasoning: "A diagonal falling stroke should push the ball left.",
        levelId: groundLeftWallLevel.id,
        strokes: [
          {
            id: "ai-stroke-1",
            width: 40,
            points: [
              { x: 720, y: 360 },
              { x: 900, y: 560 },
            ],
          },
        ],
      }),
      [groundLeftWallLevel],
    );

    expect(action.reasoning).toBe("A diagonal falling stroke should push the ball left.");
    expect(action.action.levelId).toBe(groundLeftWallLevel.id);
    expect(action.action.strokes).toHaveLength(1);
  });

  it("rejects invalid JSON responses", () => {
    expect(() => parseAiCandidateResponse("{ nope", [groundLeftWallLevel])).toThrow(/not valid JSON/);
  });

  it("rejects schema-looking output that fails benchmark validation", () => {
    expect(() =>
      parseAiCandidateResponse(
        JSON.stringify({
          reasoning: "Too wide.",
          levelId: groundLeftWallLevel.id,
          strokes: [
            {
              id: "too-wide",
              width: 120,
              points: [
                { x: 720, y: 360 },
                { x: 900, y: 560 },
              ],
            },
          ],
        }),
        [groundLeftWallLevel],
      ),
    ).toThrow(/width/);
  });
});
