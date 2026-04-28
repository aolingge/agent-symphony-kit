# Agent Symphony Kit

面向 Coding Agent 的本地优先任务编排和验证门禁 CLI。

它把 `WORKFLOW.md`、任务 JSON、`events.jsonl`、preflight 和 gate 报告做成一个可安装的 NPM 工具，让 Codex、Claude Code、Cursor、Gemini CLI 等 agent 有一个可追踪的本地工作台。

这是用于本地 Symphony-style agent workflow 的非官方工具包，不隶属于 OpenAI，也不是完整 OpenAI Symphony 实现。

## 快速开始

```bash
npx agent-symphony-kit init
npx agent-symphony-kit task create --title "补登录 smoke test" --repo web --priority P1
npx agent-symphony-kit task list
npx agent-symphony-kit preflight
npx agent-symphony-kit gate --check "npm test" --check "npm run lint"
```

安装后的短命令：

```bash
npm exec --package agent-symphony-kit agent-symphony -- init
npm exec --package agent-symphony-kit askit -- init
```

## 定位

它不是完整的 OpenAI Symphony 实现，也不是后台 daemon。首版只做一件事：给本地 agent 工作流提供清晰、可版本化、可验证的状态层。

## 安全边界

工具不会自动发布、删除、付费、改 DNS、发送真实账号消息、保存凭据，也不会修改全局 Codex/MCP/shell 配置。涉及公开动作时仍然应该人工确认。

## 常用命令

```bash
askit init
askit task create --title "任务标题" --json
askit task list
askit task show --id <prefix>
askit task log --id <prefix>
askit task set --id <prefix> --state Verify --verification "npm test passed"
askit preflight
askit gate --check "npm test" --dry-run
```

## 开发验证

```bash
npm install
npm run check
npm run pack:dry
```

许可证：MIT
