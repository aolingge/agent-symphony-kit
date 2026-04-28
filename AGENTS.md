# Agent Symphony Kit Agent Guide

## Project Scope

This package is a local-first workflow kit for coding agents. It provides task files, JSONL events, preflight checks, and gate command traces. It is not a full daemon, issue-tracker sync service, or OpenAI Symphony implementation.

## Development

- Use Node.js 20 or newer.
- Keep runtime dependencies at zero unless a feature clearly needs one.
- Keep commands cross-platform; avoid hard-coded absolute paths.
- Do not store secrets, cookies, tokens, private logs, browser profiles, or local machine paths in examples or tests.

## Verification

Run:

```bash
npm run check
npm run pack:dry
```

For CLI changes, add or update `node:test` coverage and a smoke path.

## High-Risk Actions

Publishing, deletion, DNS changes, payments, real-account messaging, credential persistence, repository transfer, and public launch actions require explicit maintainer intent. Do not automate those from tests, examples, or default commands.
