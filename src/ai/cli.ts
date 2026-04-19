import { levels } from "../sim/level";
import { createRunBundle } from "../bench/runner";
import { writeRunBundle } from "../bench/runFiles";
import { AI_PROMPT_VERSION, generateCandidateWithOpenRouter } from "./openrouter";
import { loadEnvLocal } from "./env";

const DEFAULT_MODEL = "openai/gpt-5.4-mini";
const DEFAULT_TEMPERATURE = 0.2;

type CliOptions = {
  levelId: string;
  model: string;
  runsDir: string;
  temperature: number;
  timeoutMs: number;
  seed?: number;
  frameBudget?: number;
};

async function main(): Promise<void> {
  await loadEnvLocal();
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required. Put it in .env.local or export it in the shell.");
  }

  const level = levels.find((candidate) => candidate.id === options.levelId);
  if (!level) {
    throw new Error(`Unknown levelId: ${options.levelId}. Available levels: ${levels.map((candidate) => candidate.id).join(", ")}`);
  }

  const generated = await generateCandidateWithOpenRouter({
    apiKey,
    model: options.model,
    level,
    levels,
    temperature: options.temperature,
    seed: options.seed,
    timeoutMs: options.timeoutMs,
  });

  const bundle = createRunBundle(generated.action, {
    stopping: {
      frameBudget: options.frameBudget,
    },
    metadata: {
      source: "openrouter",
      model: options.model,
      promptVersion: AI_PROMPT_VERSION,
      temperature: options.temperature,
      seed: options.seed,
      responseId: generated.metadata.responseId,
      reasoning: generated.reasoning,
      usage: generated.metadata.usage,
      provider: generated.metadata.provider,
    },
  });
  const runPath = await writeRunBundle(bundle, options.runsDir, `ai-${options.model}-${level.id}`);

  process.stdout.write(
    `${JSON.stringify(
      {
        levelId: bundle.level.id,
        model: options.model,
        success: bundle.result.success,
        terminalState: bundle.result.terminalState,
        terminalFrame: bundle.result.terminalFrame,
        firstSuccessFrame: bundle.result.firstSuccessFrame,
        strokeCount: bundle.result.strokeCount,
        strokeLength: bundle.result.strokeLength,
        reasoning: generated.reasoning,
        runPath,
      },
      null,
      2,
    )}\n`,
  );
}

function parseArgs(args: string[]): CliOptions {
  let levelId = "";
  let model = DEFAULT_MODEL;
  let runsDir = "runs";
  let temperature = DEFAULT_TEMPERATURE;
  let timeoutMs = 60_000;
  let seed: number | undefined;
  let frameBudget: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--model") {
      model = requireArgValue(args, index, "--model");
      index += 1;
    } else if (arg === "--runs-dir") {
      runsDir = requireArgValue(args, index, "--runs-dir");
      index += 1;
    } else if (arg === "--temperature") {
      temperature = parseNumber(requireArgValue(args, index, "--temperature"), "--temperature");
      index += 1;
    } else if (arg === "--timeout-ms") {
      timeoutMs = parseInteger(requireArgValue(args, index, "--timeout-ms"), "--timeout-ms");
      if (timeoutMs <= 0) {
        throw new Error("--timeout-ms must be a positive integer.");
      }
      index += 1;
    } else if (arg === "--seed") {
      seed = parseInteger(requireArgValue(args, index, "--seed"), "--seed");
      index += 1;
    } else if (arg === "--max-frames") {
      frameBudget = parseInteger(requireArgValue(args, index, "--max-frames"), "--max-frames");
      if (frameBudget <= 0) {
        throw new Error("--max-frames must be a positive integer.");
      }
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: pnpm ai-bench <level-id> [--model openai/gpt-5.4-mini] [--runs-dir runs] [--temperature 0.2] [--timeout-ms 60000] [--seed 1] [--max-frames 600]\n",
      );
      process.exit(0);
    } else if (!levelId) {
      levelId = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!levelId) {
    throw new Error("Missing level id. Usage: pnpm ai-bench <level-id> [--model openai/gpt-5.4-mini]");
  }
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new Error("--temperature must be a number between 0 and 2.");
  }

  return { levelId, model, runsDir, temperature, timeoutMs, seed, frameBudget };
}

function requireArgValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function parseNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number.`);
  }
  return parsed;
}

function parseInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
