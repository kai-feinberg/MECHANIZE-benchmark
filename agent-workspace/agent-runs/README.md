# Agent Runs

Create one folder per agent or model, then one folder per level, then numbered attempts.

```text
agent-runs/<agent-or-model-slug>/<level-id>/attempt-001/
```

Rules:

- Copy `_template/attempt-001` to start.
- Use three-digit attempt numbers.
- Never rewrite an older `action.json` after running it.
- Run with `--bundle attempt-NNN/run.json` so the trace is stored next to the attempt.
- Record the CLI result, generated `runPath`, and attempt-local `run.json` path in `notes.md`.
- Do not paste full `run.json` contents into notes or prompts; sample it with the trace guide.
