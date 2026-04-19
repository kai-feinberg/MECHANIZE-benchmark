import { describe, expect, it, vi } from "vitest";
import { groundLeftWallLevel } from "../sim/level";
import { generateCandidateWithOpenRouter } from "./openrouter";

describe("OpenRouter candidate generation", () => {
  it("sends a structured-output request and parses the candidate", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, _init) => {
      return new Response(
        JSON.stringify({
          id: "resp-1",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reasoning: "A diagonal falling stroke should push the ball left.",
                  levelId: groundLeftWallLevel.id,
                  strokes: [
                    {
                      id: "ai-stroke-1",
                      width: 18,
                      points: [
                        { x: 720, y: 360 },
                        { x: 900, y: 560 },
                      ],
                    },
                  ],
                }),
              },
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
          provider: "mock-provider",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const generated = await generateCandidateWithOpenRouter({
      apiKey: "test-key",
      model: "moonshotai/kimi-k2.5",
      level: groundLeftWallLevel,
      levels: [groundLeftWallLevel],
      temperature: 0.2,
      seed: 7,
      fetchImpl,
    });

    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      model: string;
      temperature: number;
      seed: number;
      response_format: { type: string; json_schema: { strict: boolean; schema: { properties: { strokes: { maxItems: number } } } } };
    };

    expect(request.model).toBe("moonshotai/kimi-k2.5");
    expect(request.temperature).toBe(0.2);
    expect(request.seed).toBe(7);
    expect(request.response_format.type).toBe("json_schema");
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(request.response_format.json_schema.schema.properties.strokes.maxItems).toBe(1);
    expect(generated.action.strokes[0]?.id).toBe("ai-stroke-1");
    expect(generated.reasoning).toBe("A diagonal falling stroke should push the ball left.");
    expect(generated.metadata).toMatchObject({
      responseId: "resp-1",
      provider: "mock-provider",
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    });
  });
});
