import { readFile, writeFile } from "node:fs/promises";
import { levels } from "../sim/level";
import { createRunBundle, runBenchmark } from "./runner";
import { parseCandidateFile } from "./validation";
import { writeRunBundle } from "./runFiles";
import type { BenchmarkResult } from "./types";

type CliOptions = {
  actionFile: string;
  bundleFile: string | null;
  runsDir: string;
  traceFile: string | null;
  frameBudget: number | null;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(await readFile(options.actionFile, "utf8")) as unknown;
  const candidates = parseCandidateFile(raw, levels);

  if (options.bundleFile && candidates.length !== 1) {
    throw new Error("--bundle supports one candidate action at a time.");
  }

  const bundledRuns = await Promise.all(
    candidates.map(async (candidate) => {
      const bundle = createRunBundle(candidate, {
        stopping: {
          frameBudget: options.frameBudget ?? undefined,
        },
      });
      const runPath = await writeRunBundle(bundle, options.runsDir, options.actionFile);
      return { bundle, runPath };
    }),
  );

  if (options.bundleFile) {
    await writeFile(options.bundleFile, JSON.stringify(bundledRuns[0].bundle, null, 2));
  }

  const results = candidates.map((candidate) =>
    runBenchmark(candidate, {
      includeTrace: Boolean(options.traceFile) && !options.bundleFile,
      stopping: {
        frameBudget: options.frameBudget ?? undefined,
      },
    }),
  );

  if (options.traceFile) {
    await writeFile(
      options.traceFile,
      JSON.stringify(
        bundledRuns.length === 1 ? bundledRuns[0].bundle.trace : bundledRuns.map((run) => run.bundle.trace),
        null,
        2,
      ),
    );
  }

  const output = results.map((result, index) => ({
    ...stripTrace(result),
    runPath: bundledRuns[index].runPath,
  }));
  process.stdout.write(`${JSON.stringify(output.length === 1 ? output[0] : output, null, 2)}\n`);
}

function parseArgs(args: string[]): CliOptions {
  let actionFile = "";
  let bundleFile: string | null = null;
  let runsDir = "runs";
  let traceFile: string | null = null;
  let frameBudget: number | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--bundle") {
      bundleFile = requireArgValue(args, index, "--bundle");
      index += 1;
    } else if (arg === "--runs-dir") {
      runsDir = requireArgValue(args, index, "--runs-dir");
      index += 1;
    } else if (arg === "--trace") {
      traceFile = requireArgValue(args, index, "--trace");
      index += 1;
    } else if (arg === "--max-frames") {
      frameBudget = Number(requireArgValue(args, index, "--max-frames"));
      if (!Number.isInteger(frameBudget) || frameBudget <= 0) {
        throw new Error("--max-frames must be a positive integer.");
      }
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: pnpm bench <action-file.json> [--runs-dir runs] [--bundle run.json] [--trace trace.json] [--max-frames 600]\n",
      );
      process.exit(0);
    } else if (!actionFile) {
      actionFile = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!actionFile) {
    throw new Error(
      "Missing action file. Usage: pnpm bench <action-file.json> [--runs-dir runs] [--bundle run.json] [--trace trace.json] [--max-frames 600]",
    );
  }

  return { actionFile, bundleFile, runsDir, traceFile, frameBudget };
}

function requireArgValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function stripTrace(result: BenchmarkResult): Omit<BenchmarkResult, "trace"> {
  const withoutTrace = { ...result };
  delete withoutTrace.trace;
  return withoutTrace;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
