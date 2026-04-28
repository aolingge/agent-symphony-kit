export const DEFAULT_WORKFLOW = `---
tracker:
  kind: local
  root: .agent-symphony/tasks
  active_states:
    - Ready
    - Running
    - Review
    - Verify
  terminal_states:
    - Done
    - Abandoned
workspace:
  root: .agent-symphony/workspaces
agent:
  max_concurrent_agents: 4
  max_turns: 20
validation:
  required_checks:
    - preflight
    - project-specific-build-test-lint-typecheck
skill_graph:
  max_depth: 3
---

# Agent Symphony Workflow

This file is the local workflow contract for coding-agent tasks.

## States

\`Backlog -> Ready -> Running -> Blocked -> Review -> Verify -> Done/Abandoned\`

## Roles

- Orchestrator: decomposes tasks and integrates outputs.
- Researcher: verifies current facts and links sources.
- Worker: edits a bounded write set.
- Reviewer: checks correctness and missing tests.
- Verifier: runs concrete checks and records evidence.

## Verification

Record exact commands, outcomes, skipped checks, and remaining risk before marking work done.
`;

export const DEFAULT_GITIGNORE = `.agent-symphony/runs/
.agent-symphony/tmp/
.tmp/
node_modules/
npm-debug.log*
`;

export const DEFAULT_TASK_STATES = [
  "Backlog",
  "Ready",
  "Running",
  "Blocked",
  "Review",
  "Verify",
  "Done",
  "Abandoned"
];

