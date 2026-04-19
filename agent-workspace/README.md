# Agent Workspace

This folder contains the tracked workflow for coding agents solving benchmark levels.

- `agent-runs/`: numbered attempt folders created by agents.
- `agent-runs/_template/`: copy this before starting a new model or level.
- `docs/trace-guide.md`: how to inspect trace bundles without reading the whole file.
- `examples/example-trace-excerpt.json`: a small trace-shaped example for structure only.

Each attempt should write its stable trace bundle to `attempt-NNN/run.json` with `pnpm bench ... --bundle .../run.json`. The benchmark also writes timestamped generated bundles under root `runs/`, which is gitignored.

Recommended real attempt layout:

```text
agent-workspace/agent-runs/gpt-5-4-mini/ground-left-wall-v1/attempt-001/
agent-workspace/agent-runs/gpt-5-4-mini/ground-left-wall-v1/attempt-002/
agent-workspace/agent-runs/claude-sonnet-4-5/hit-left-wall-v1/attempt-001/
```
