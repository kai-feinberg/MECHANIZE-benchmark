# Agent Entry Point

This repo is a small Brain-It-On style physics benchmark. Your job is to solve levels by editing candidate action JSON, running the benchmark locally, reading the compact result, and iterating with numbered attempts.

Use PNPM for every package command.

## Where To Work

Keep agent attempts under:

```text
agent-workspace/agent-runs/<agent-or-model-slug>/<level-id>/attempt-001/
```

Use the template in:

```text
agent-workspace/agent-runs/_template/
```

Each attempt folder should contain:

- `action.json`: the candidate action passed to `pnpm bench`.
- `run.json`: the generated replayable trace bundle for this exact attempt.
- `notes.md`: the result, generated paths, observations, and next idea.

Do not overwrite older attempts. Copy the previous attempt to `attempt-002`, `attempt-003`, and so on, then edit the new `action.json`.

The benchmark also writes a timestamped copy under root `runs/`, which is gitignored. Use the attempt-local `run.json` as the stable, easy-to-browse trace for a specific model and attempt.

## Benchmark Commands

Install dependencies:

```bash
pnpm install
```

Run one attempt and write its trace bundle next to the action:

```bash
pnpm bench agent-workspace/agent-runs/<agent-or-model-slug>/<level-id>/attempt-001/action.json --bundle agent-workspace/agent-runs/<agent-or-model-slug>/<level-id>/attempt-001/run.json
```

The CLI prints compact JSON with `success`, `terminalState`, `terminalFrame`, `finalBall`, and `runPath`. Save that output or its key fields in the attempt `notes.md`. The stable trace for the attempt is the `run.json` written by `--bundle`.

Open the browser trace viewer:

```bash
pnpm dev
```

In the app, switch to Trace mode and upload the attempt-local `run.json`.

Run checks:

```bash
pnpm test
pnpm build
```

## Candidate Action Format

Submit a JSON object with a known `levelId` and a `strokes` array:

```json
{
  "levelId": "ground-left-wall-v1",
  "strokes": [
    {
      "id": "attempt-001-pusher",
      "width": 18,
      "points": [
        { "x": 720, "y": 360 },
        { "x": 900, "y": 560 }
      ]
    }
  ]
}
```

Current levels allow one stroke. Valid stroke widths are `1` through `18`, matching the playable browser stroke. Each stroke needs `2` through `160` points. Points are world coordinates inside the `1000 x 700` canvas.

If a stroke overlaps the floor, walls, or ceiling by a significant amount, the benchmark rejects the candidate before writing a run bundle. If a stroke overlaps the ball or cup-like level objects, the simulation tries a small bounded nudge first; if it still overlaps, the candidate is rejected.

Do not use unsupported shapes such as boxes, circles, polygons, SVG paths, text, or extra JSON properties. The benchmark accepts only stroke point paths.

## Current Levels

- `ground-left-wall-v1`: the ball starts on the floor. Make it contact the left wall.
- `hit-left-wall-v1`: the ball starts in a cup-like obstacle. Make it escape or use the cup geometry so it contacts the left wall.

Level definitions live in `src/sim/level.ts`.

## Reading Traces Without Burning Context

Do not paste or read an entire `run.json` into your context. Trace bundles include one frame per simulation step and can be large.

Use these instead:

```bash
node -e 'const r=require(process.argv[1]); console.log(JSON.stringify({level:r.level.id,result:r.result,metadata:r.metadata,stroke:r.action.strokes}, null, 2))' /path/to/run.json
```

Sample the first, middle, and final frames:

```bash
node -e 'const r=require(process.argv[1]); const f=r.trace.frames; const picks=[0, Math.floor(f.length/2), f.length-1]; console.log(JSON.stringify(picks.map(i=>f[i]), null, 2))' /path/to/run.json
```

For visual feedback, prefer the browser Trace mode over reading frame JSON. See `agent-workspace/docs/trace-guide.md` and `agent-workspace/examples/example-trace-excerpt.json` for the trace structure.
