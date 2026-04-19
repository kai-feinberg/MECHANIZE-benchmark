# Brain-It-On Benchmark Roadmap

## Current State

- Playable browser prototype exists with Vite, TypeScript, Matter.js, and Canvas 2D.
- The first level uses a fixed `1000 x 700` world and one user-drawn stroke.
- The success rule is: the ball stays off the ground for 150 consecutive fixed simulation frames.
- The simulation core is separated from the browser renderer enough to support a headless runner next.
- The UI includes reset, pause/run, clear stroke, stroke JSON export, and a visual/physics-body toggle.

## Remaining Tasks

### 1. Terminal State and Stopping Criteria

- Add explicit benchmark terminal states before building the headless runner:
  - `success`: the level goal has been achieved
  - `stalled`: the simulation has settled without any meaningful movement
  - `timeout`: the simulation frame budget has been exhausted
- Track movement across all dynamic bodies, not just the ball:
  - ball
  - user-created stroke bodies
  - level dynamic bodies such as cups or movable objects
- Treat static bodies, walls, floors, and ceilings as irrelevant for stalling.
- Define "meaningful movement" with jitter-tolerant thresholds:
  - linear speed above a small epsilon
  - angular speed above a small epsilon
  - position delta over a short rolling window above a small epsilon
  - angle delta over a short rolling window above a small epsilon
- Require all tracked dynamic bodies to remain below the thresholds for a configurable number of consecutive frames before returning `stalled`.
- Use a rolling window rather than a single-frame velocity check so tiny Matter.js jitter does not keep failed attempts alive forever.
- Reset the stalled-frame counter whenever any tracked dynamic body moves meaningfully.
- Add a small grace period after strokes are added before stalling can trigger, so newly added bodies have time to contact and settle.
- Add unit tests for terminal-state evaluation:
  - success wins immediately when the goal is achieved
  - timeout wins when the frame budget is exhausted
  - stalled triggers only after the required quiet-frame count
  - small jitter below thresholds does not reset the quiet-frame counter
  - a real nudge above thresholds resets the quiet-frame counter

Recommended first version: use conservative defaults such as a 30-frame rolling window and 120 quiet frames, then tune against recorded failed attempts.

### 2. Headless Benchmark Runner

- Add a Node-based runner that imports the shared simulation core.
- Accept a JSON file containing one or more candidate stroke actions.
- Run the simulation at the same fixed 60 Hz step as the browser.
- Emit a compact JSON result:
  - success boolean
  - terminal state: `success`, `stalled`, or `timeout`
  - first success frame, if any
  - terminal frame
  - final ball position and velocity
  - consecutive off-ground frame count
  - quiet frame count and movement thresholds used
  - stroke count and stroke length
  - simulation frame budget used
- Stop the run as soon as a terminal state is reached.
- Add validation for action files:
  - world-coordinate point arrays
  - stroke width
  - max stroke count
  - point count and bounds limits
- Add Vitest coverage for runner-level success/stalled/timeout cases.

### 3. Trace Recording

- Add optional trace output to the headless runner.
- Store per-frame state in a compact replay format:
  - frame index
  - ball position, angle, velocity, and angular velocity
  - stroke body position and angle
  - success state
  - terminal state, if reached on that frame
  - quiet frame count
  - per-body movement summary used by stalled detection
- Keep the default benchmark result small; traces should be opt-in.
- Decide whether traces should include all physics body vertices or only enough state to replay visually.
- Include enough stopping-criteria data to debug why a run stalled, without forcing traces to store every vertex by default.

Recommended first version: record canonical body transforms plus the original stroke action, then reconstruct visuals in the viewer.

### 4. Trace Viewer

- Add a browser trace viewer mode separate from live play.
- Load a trace JSON file or pasted trace JSON.
- Render the replay on the same Canvas 2D board.
- Include controls:
  - play/pause
  - frame scrubber
  - step forward/back
  - speed control
  - show physics bodies toggle
  - show success frame marker
- Support side-by-side comparison later, but keep v1 to one trace at a time.

Recommended first version: add a route-like mode switch in the existing Vite app rather than introducing a router.

### 5. AI Action Interface

- Define the first model-facing action schema as strokes, not raw Matter bodies:

```json
{
  "levelId": "lift-ball-v1",
  "strokes": [
    {
      "id": "stroke-1",
      "width": 18,
      "points": [
        { "x": 260, "y": 280 },
        { "x": 500, "y": 240 },
        { "x": 720, "y": 330 }
      ]
    }
  ]
}
```

- Keep coordinates in fixed world units.
- Include clear constraints in the prompt given to AI systems:
  - world size
  - object positions
  - max strokes
  - valid coordinate bounds
  - scoring rule
  - output JSON schema
- Add a validator that rejects invalid or unsafe action files before simulation.
- Add example solutions and intentionally bad examples for prompt testing.

Recommended first version: have AI generate point strokes directly. Defer SVG path input until benchmark basics are stable.

### 6. SVG and Path Generation Scope

- Explore SVG path input as a second action format:
  - parse an SVG path
  - sample it into points
  - pass sampled points through the same stroke-body pipeline
- Keep SVG support as a compatibility layer over strokes, not as a separate physics primitive.
- Later, add closed shape support:
  - point cleanup
  - winding normalization
  - concave decomposition with `poly-decomp`
  - holes either rejected or handled explicitly

Recommended first version: only support open SVG paths that map to thick strokes.

### 7. Physics Robustness

- Continue tuning stroke body generation to reduce jitter:
  - fewer compound seams
  - smoother segment overlap
  - material constants
  - collision slop
- Investigate continuous polygon stroke bodies if compound bodies remain too unstable.
- Add regression tests for known generated strokes.
- Decide whether benchmark scoring should tolerate small physics jitter by using frame windows or state thresholds.

### 8. Level System

- Convert the typed level object into a serializable fixture once the schema stabilizes.
- Add at least two more primitive benchmark levels:
  - push ball sideways
  - knock object off platform
  - keep object off ground
- Add a level selection UI for development.
- Keep each level small, inspectable, and easy to describe to an AI model.

### 9. Developer Experience

- Add keyboard shortcuts:
  - `r` reset
  - space pause/run
  - `p` toggle physics body view
- Add a debug overlay:
  - frame number
  - ball position
  - off-ground frame counter
  - active stroke point count
- Add sample action JSON files.
- Add README setup instructions.

## Suggested Next Steps

1. Implement terminal state and stopping criteria with jitter-tolerant stalled detection.
2. Build the headless runner and action JSON validator around those terminal states.
3. Add trace recording behind an opt-in CLI flag, including quiet-frame diagnostics.
4. Build the trace viewer using the existing Canvas renderer.
5. Create a small set of sample AI prompts and candidate action JSON files.
6. Evaluate whether point strokes are enough for early model benchmarking before adding SVG path input.

## Open Decisions

- Should traces store every physics body transform or only benchmark-relevant bodies?
- Should benchmark scoring stop immediately on success or continue to collect post-success stability data?
- What linear, angular, position-delta, and angle-delta thresholds best distinguish real movement from Matter.js jitter?
- Should stalled detection consider all dynamic bodies equally, or should some low-impact bodies be ignored per level?
- Should AI get screenshots, structured level JSON, or both?
- Should generated paths be constrained by max points, max length, or total ink area?
- Should the first benchmark allow only one stroke forever, or should later levels support multiple strokes?
