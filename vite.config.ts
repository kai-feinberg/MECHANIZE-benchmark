import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";

type AgentRunAttempt = {
  agent: string;
  levelId: string;
  attempt: string;
  runPath: string;
  actionPath: string | null;
  notesPath: string | null;
};

function agentRunsBrowser(): Plugin {
  const root = process.cwd();
  const runsRoot = resolve(root, "agent-workspace", "agent-runs");

  return {
    name: "agent-runs-browser",
    configureServer(server) {
      server.middlewares.use("/api/agent-runs", async (_request, response) => {
        try {
          const attempts = await listAgentRunAttempts(root, runsRoot);
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ attempts }));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Could not list agent runs.",
            }),
          );
        }
      });
    },
  };
}

async function listAgentRunAttempts(root: string, runsRoot: string): Promise<AgentRunAttempt[]> {
  if (!existsSync(runsRoot)) {
    return [];
  }

  const attempts: AgentRunAttempt[] = [];
  const agentEntries = await readdir(runsRoot, { withFileTypes: true });
  for (const agentEntry of agentEntries) {
    if (!agentEntry.isDirectory() || agentEntry.name.startsWith("_")) {
      continue;
    }

    const agentDir = join(runsRoot, agentEntry.name);
    const levelEntries = await readdir(agentDir, { withFileTypes: true });
    for (const levelEntry of levelEntries) {
      if (!levelEntry.isDirectory()) {
        continue;
      }

      const levelDir = join(agentDir, levelEntry.name);
      const attemptEntries = await readdir(levelDir, { withFileTypes: true });
      for (const attemptEntry of attemptEntries) {
        if (!attemptEntry.isDirectory()) {
          continue;
        }

        const attemptDir = join(levelDir, attemptEntry.name);
        const runFile = join(attemptDir, "run.json");
        if (!existsSync(runFile)) {
          continue;
        }

        attempts.push({
          agent: agentEntry.name,
          levelId: levelEntry.name,
          attempt: attemptEntry.name,
          runPath: toServedPath(root, runFile),
          actionPath: optionalServedPath(root, join(attemptDir, "action.json")),
          notesPath: optionalServedPath(root, join(attemptDir, "notes.md")),
        });
      }
    }
  }

  return attempts.sort(
    (left, right) =>
      left.agent.localeCompare(right.agent) ||
      left.levelId.localeCompare(right.levelId) ||
      left.attempt.localeCompare(right.attempt, undefined, { numeric: true }),
  );
}

function optionalServedPath(root: string, path: string): string | null {
  return existsSync(path) ? toServedPath(root, path) : null;
}

function toServedPath(root: string, path: string): string {
  return `/${relative(root, path).split(sep).join("/")}`;
}

export default defineConfig({
  plugins: [agentRunsBrowser()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
