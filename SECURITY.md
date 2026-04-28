# Security Policy

## Supported Versions

Security fixes target the latest published version.

## Reporting A Vulnerability

Open a private security advisory on GitHub or contact the maintainer through the repository security channel.

Do not include real secrets, tokens, cookies, private logs, private repository URLs, or customer data in public issues.

## Security Model

Agent Symphony Kit is local-first:

- It stores task state in the current project.
- It does not upload code or telemetry.
- It does not publish, push, merge, delete, spend money, change DNS, or persist credentials.
- It does run user-provided gate commands, so users should review commands before running them.

Use `askit gate --check "..."` only with commands you trust.

