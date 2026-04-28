---
tracker:
  kind: local
  root: .agent-symphony/tasks
validation:
  required_checks:
    - npm test
    - npm run lint
---

# Example Workflow

Use this repo-local workflow contract to tell coding agents how to work:

- Create or update a task before starting multi-step work.
- Run preflight before implementation.
- Run gate checks before marking work done.
- Record skipped checks and remaining risks.

