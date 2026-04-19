# Trace Guide For Agents

Trace bundles are useful, but they are too large to read wholesale. Treat `run.json` as a replay artifact and inspect only summaries or sampled frames.

## Bundle Shape

A generated `run.json` has this top-level structure:

```json
{
  "schemaVersion": 1,
  "level": {},
  "action": {},
  "result": {},
  "trace": {
    "levelId": "ground-left-wall-v1",
    "action": {},
    "frames": []
  },
  "metadata": {}
}
```

Use these sections this way:

- `level`: geometry, ball start, floor, walls, cup, goal, and stroke limits.
- `action`: the stroke JSON that was actually simulated.
- `result`: compact pass/fail summary. Read this first.
- `trace.frames`: per-frame body positions and velocities. Sample this sparingly.
- `metadata`: source, model, prompt version, timestamps, and optional reasoning.

Each trace frame looks like:

```json
{
  "frame": 76,
  "bodies": [
    {
      "label": "ball",
      "position": { "x": 19.4, "y": 614.5 },
      "angle": 0.12,
      "velocity": { "x": -8.2, "y": 0.1 },
      "angularVelocity": 0.04
    }
  ],
  "goalAchieved": true,
  "terminalState": "success",
  "quietFrames": 0,
  "movement": []
}
```

## Context-Safe Commands

Print only the result and action:

```bash
node -e 'const r=require(process.argv[1]); console.log(JSON.stringify({level:r.level.id,result:r.result,action:r.action,metadata:r.metadata}, null, 2))' /path/to/run.json
```

Print frame count and terminal frame:

```bash
node -e 'const r=require(process.argv[1]); console.log({frames:r.trace.frames.length, terminalFrame:r.result.terminalFrame, success:r.result.success, terminalState:r.result.terminalState})' /path/to/run.json
```

Sample the first, middle, and final frames:

```bash
node -e 'const r=require(process.argv[1]); const f=r.trace.frames; const picks=[0, Math.floor(f.length/2), f.length-1]; console.log(JSON.stringify(picks.map(i=>f[i]), null, 2))' /path/to/run.json
```

Extract only the ball trajectory every 30 frames:

```bash
node -e 'const r=require(process.argv[1]); console.log(JSON.stringify(r.trace.frames.filter((_,i)=>i%30===0).map(f=>({frame:f.frame, ball:f.bodies.find(b=>b.label==="ball")?.position, goalAchieved:f.goalAchieved, terminalState:f.terminalState})), null, 2))' /path/to/run.json
```

## Visual Inspection

For real iteration, prefer the trace viewer:

1. Run `pnpm dev`.
2. Switch to Trace mode.
3. Upload the `run.json` from the benchmark output's `runPath`.
4. Scrub near contact, collision, stall, and the terminal frame.

The trace viewer is the best way to inspect geometry and timing without spending model context on hundreds of frame objects.

