import { AI_PROMPT_VERSION, buildAiBenchmarkMessages } from "./prompt";
import { createCandidateActionJsonSchema, parseAiCandidateResponse } from "./schema";
import type { CandidateAction } from "../bench/types";
import type { LevelDefinition } from "../sim/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type OpenRouterResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: OpenRouterUsage;
  provider?: string;
  error?: {
    message?: string;
  };
};

export type GenerateCandidateOptions = {
  apiKey: string;
  model: string;
  level: LevelDefinition;
  levels: readonly LevelDefinition[];
  temperature: number;
  seed?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type GeneratedCandidate = {
  action: CandidateAction;
  reasoning: string;
  metadata: {
    responseId?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    provider?: string;
  };
};

export async function generateCandidateWithOpenRouter(options: GenerateCandidateOptions): Promise<GeneratedCandidate> {
  const fetcher = options.fetchImpl ?? fetch;
  const timeout = options.timeoutMs ?? 60_000;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let response: Response;
  let data: OpenRouterResponse;
  try {
    const resolved = await withTimeout(
      async () => {
        const nextResponse = await fetcher(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: options.model,
            messages: buildAiBenchmarkMessages(options.level),
            temperature: options.temperature,
            ...(options.seed === undefined ? {} : { seed: options.seed }),
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "candidate_action",
                strict: true,
                schema: createCandidateActionJsonSchema(options.level),
              },
            },
            stream: false,
          }),
        });
        const nextData = (await nextResponse.json()) as OpenRouterResponse;
        return { response: nextResponse, data: nextData };
      },
      timeout,
      () => {
        controller.abort();
      },
      (id) => {
        timeoutId = id;
      },
    );
    response = resolved.response;
    data = resolved.data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${timeout}ms.`);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    throw new Error(`OpenRouter request failed (${response.status}): ${data.error?.message ?? response.statusText}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter response did not include message content.");
  }

  const parsed = parseAiCandidateResponse(content, options.levels);
  return {
    action: parsed.action,
    reasoning: parsed.reasoning,
    metadata: {
      responseId: data.id,
      provider: data.provider,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    },
  };
}

export { AI_PROMPT_VERSION };

function withTimeout<T>(
  createPromise: () => Promise<T>,
  timeout: number,
  onTimeout: () => void,
  setTimeoutId: (id: ReturnType<typeof setTimeout>) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      onTimeout();
      reject(new Error(`OpenRouter request timed out after ${timeout}ms.`));
    }, timeout);
    setTimeoutId(timeoutId);

    createPromise()
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timeoutId);
      });
  });
}
