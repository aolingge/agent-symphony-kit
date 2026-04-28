# Architecture

Agent Symphony Kit is intentionally small.

## Layers

- Workflow contract: `WORKFLOW.md`
- Task store: `.agent-symphony/tasks/<id>/task.json`
- Event log: `.agent-symphony/tasks/<id>/events.jsonl`
- Run reports: `.agent-symphony/runs/<run-id>.json` and `.md`
- CLI: `askit`

## Non-Goals

- No daemon in v0.1.
- No automatic publishing, pushing, merging, deleting, or credential persistence.
- No hard dependency on Codex, Claude Code, Linear, GitHub Issues, or any cloud dashboard.
- No telemetry.

## State Contract

Task states:

```text
Backlog -> Ready -> Running -> Blocked -> Review -> Verify -> Done/Abandoned
```

Event types:

- `created`
- `state_changed`
- future-compatible unknown events should be preserved by readers

All timestamps use ISO 8601.
