# Contributing

Thanks for helping improve Agent Symphony Kit.

## Setup

```bash
npm install
npm run check
npm run pack:dry
```

## Pull Request Rules

- Keep runtime dependencies at zero unless the tradeoff is explicit.
- Keep examples free of private paths, secrets, tokens, cookies, and credentials.
- Add tests for CLI behavior, state transitions, JSONL events, and gate failures.
- Update `README.md` when command behavior changes.

## Release Checklist

```bash
npm run check
npm run pack:dry
npm pack --dry-run --json
```

Publishing is a manual maintainer action.

