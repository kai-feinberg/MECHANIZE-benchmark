# Agent Benchmark Task

Solve one benchmark level by editing `attempt-001/action.json`, running the local benchmark, and iterating with numbered attempts.

## Setup

1. Copy this template to `agent-workspace/agent-runs/<agent-or-model-slug>/<level-id>/`.
2. Replace `<agent-or-model-slug>` with a stable lowercase name such as `gpt-5-4-mini` or `codex-local`.
3. Replace `<level-id>` with `ground-left-wall-v1` or `hit-left-wall-v1`.
4. Edit the copied `attempt-001/action.json`.

## Run

```bash
pnpm bench agent-workspace/agent-runs/<agent-or-model-slug>/<level-id>/attempt-001/action.json --bundle agent-workspace/agent-runs/<agent-or-model-slug>/<level-id>/attempt-001/run.json
```

Copy the important result fields into `attempt-001/notes.md`, especially:

- `success`
- `terminalState`
- `terminalFrame`
- `firstSuccessFrame`
- `finalBall`
- `runPath`
- attempt-local trace path: `agent-workspace/agent-runs/<agent-or-model-slug>/<level-id>/attempt-001/run.json`

If the attempt fails, copy the attempt folder to the next number, edit only the new `action.json`, and run again.

## Feedback Loop

Use the CLI result first. If you need visual feedback, start `pnpm dev`, open Trace mode, and upload the attempt-local `run.json`.

Do not read full trace bundles into context. Use `agent-workspace/docs/trace-guide.md` to sample the result and a few frames.
