# Launch Kit

## Positioning

Agent Symphony Kit is a local-first workflow kit for coding agents. It gives users task files, JSONL events, preflight checks, and verification gates without requiring a cloud dashboard or issue tracker.

## Launch Headline

Local-first orchestration contracts for coding agents.

## Short Post

I built Agent Symphony Kit: a tiny NPM CLI that gives coding agents a local workflow layer.

- `WORKFLOW.md` as the repo contract
- task JSON + `events.jsonl`
- `preflight` checks
- `gate` command reports
- zero runtime dependencies
- no telemetry, no auto-publish, no auto-merge

Try it:

```bash
npx agent-symphony-kit init
npx agent-symphony-kit task create --title "Add smoke test"
npx agent-symphony-kit gate --check "npm test"
```

After install, the shorter binary is:

```bash
agent-symphony init
```

## Longer Post

Coding agents are useful, but once you run several sessions at once, the hard part becomes coordination: what is running, what is blocked, what was verified, and how do you resume after context is gone?

Agent Symphony Kit is a local-first answer. It does not try to be a full platform. It adds a small workflow layer to any repo: `WORKFLOW.md`, task files, append-only JSONL events, preflight checks, and gate reports.

It is inspired by Symphony-style issue orchestration, but starts with the portable layer every repo can use.

## Channels

- GitHub repository README.
- npm package README.
- X / LinkedIn short launch post.
- Hacker News Show HN after npm publish.
- Relevant communities only after tests and docs are stable.

## Confirmation Gates

Do not post publicly until:

- npm package is published or installable from GitHub.
- README quick start is verified in a clean temp directory.
- CI is green.
- No private paths or secrets appear in package contents.
