import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { BenchmarkRunBundle } from "./types";

export async function writeRunBundle(bundle: BenchmarkRunBundle, runsDir: string, actionName: string): Promise<string> {
  const runId = createRunId(actionName);
  const runDir = join(process.cwd(), runsDir, bundle.level.id, runId);
  await mkdir(runDir, { recursive: true });
  const runPath = join(runDir, "run.json");
  await writeFile(runPath, JSON.stringify(bundle, null, 2));
  return runPath;
}

function createRunId(actionName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = extname(actionName);
  const baseName = basename(actionName, extension);
  return `${timestamp}-${slugify(baseName)}`;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "action"
  );
}
