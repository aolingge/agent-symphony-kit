import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULT_GITIGNORE, DEFAULT_TASK_PRIORITIES, DEFAULT_TASK_STATES, DEFAULT_WORKFLOW } from "./templates.js";

export const STATE_DIR = ".agent-symphony";

export function nowIso() {
  return new Date().toISOString();
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function appendJsonl(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "a" });
}

export function slugify(value) {
  const slug = String(value || "task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug || "task";
}

export function taskRoot(projectPath) {
  return join(resolve(projectPath), STATE_DIR, "tasks");
}

export function runsRoot(projectPath) {
  return join(resolve(projectPath), STATE_DIR, "runs");
}

export function workflowPath(projectPath) {
  return join(resolve(projectPath), "WORKFLOW.md");
}

export function relativeTaskDir(id) {
  return `${STATE_DIR}/tasks/${id}`;
}

export function validateState(state, field = "state") {
  if (!DEFAULT_TASK_STATES.includes(state)) {
    throw new Error(`Invalid ${field}: ${state}. Allowed values: ${DEFAULT_TASK_STATES.join(", ")}`);
  }
  return state;
}

export function validatePriority(priority) {
  if (!DEFAULT_TASK_PRIORITIES.includes(priority)) {
    throw new Error(`Invalid priority: ${priority}. Allowed values: ${DEFAULT_TASK_PRIORITIES.join(", ")}`);
  }
  return priority;
}

export function assertInitialized(projectPath) {
  const root = resolve(projectPath);
  if (!existsSync(workflowPath(root)) || !existsSync(taskRoot(root)) || !existsSync(runsRoot(root))) {
    throw new Error(`Project is not initialized: ${root}. Run "askit init --path ${root}" first.`);
  }
}

export function initProject(projectPath, { force = false } = {}) {
  const root = resolve(projectPath);
  ensureDir(root);
  ensureDir(taskRoot(root));
  ensureDir(runsRoot(root));
  const workflow = workflowPath(root);
  const created = [];

  if (force || !existsSync(workflow)) {
    writeFileSync(workflow, DEFAULT_WORKFLOW, "utf8");
    created.push("WORKFLOW.md");
  }

  const gitignore = join(root, ".gitignore");
  if (!existsSync(gitignore)) {
    writeFileSync(gitignore, DEFAULT_GITIGNORE, "utf8");
    created.push(".gitignore");
  }

  return { root, created, taskRoot: taskRoot(root), runsRoot: runsRoot(root) };
}

export function createTask(projectPath, input) {
  const root = resolve(projectPath);
  assertInitialized(root);
  if (!String(input.title || "").trim()) {
    throw new Error("Task title is required");
  }
  validateState(input.state || "Ready");
  validatePriority(input.priority || "P2");
  const timestamp = new Date();
  const id = createUniqueId(root, slugify(input.title));
  const dir = join(taskRoot(root), id);
  ensureDir(dir);

  const task = {
    schemaVersion: 1,
    id,
    title: input.title,
    description: input.description || "",
    repo: input.repo || "",
    state: input.state || "Ready",
    priority: input.priority || "P2",
    blockedBy: normalizeArray(input.blockedBy),
    createdAt: timestamp.toISOString(),
    updatedAt: timestamp.toISOString(),
    taskDir: relativeTaskDir(id),
    artifacts: [],
    verification: [],
    followups: []
  };

  writeJson(join(dir, "task.json"), task);
  writeFileSync(join(dir, "task.md"), renderTaskMarkdown(task), "utf8");
  appendJsonl(join(dir, "events.jsonl"), {
    timestamp: task.createdAt,
    event: "created",
    state: task.state,
    title: task.title,
    repo: task.repo
  });
  return task;
}

export function renderTaskMarkdown(task) {
  return `# ${task.title}

- ID: \`${task.id}\`
- State: \`${task.state}\`
- Priority: \`${task.priority}\`
- Repo: \`${task.repo || ""}\`
- Created: ${task.createdAt}

## Description

${task.description || ""}

## Verification

- [ ] Record exact commands and results.
- [ ] Record skipped checks and reason.

## Handoff

- Changed files:
- Remaining risks:
`;
}

export function findTaskDir(projectPath, idPrefix) {
  const root = taskRoot(projectPath);
  if (!existsSync(root)) {
    throw new Error(`Task root does not exist: ${root}`);
  }
  const matches = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name === idPrefix || entry.name.startsWith(idPrefix)))
    .map((entry) => join(root, entry.name));
  if (matches.length === 0) {
    throw new Error(`Task not found: ${idPrefix}`);
  }
  if (matches.length > 1) {
    throw new Error(`Task id is ambiguous: ${idPrefix}`);
  }
  return matches[0];
}

export function setTaskState(projectPath, idPrefix, update) {
  const dir = findTaskDir(projectPath, idPrefix);
  const jsonPath = join(dir, "task.json");
  const task = readJson(jsonPath);
  validateTask(task);
  validateState(update.state);
  const previousState = task.state;
  task.state = update.state;
  task.updatedAt = nowIso();
  task.verification = [...(task.verification || []), ...normalizeArray(update.verification)];
  task.artifacts = [...(task.artifacts || []), ...normalizeArray(update.artifacts)];
  writeJson(jsonPath, task);
  appendJsonl(join(dir, "events.jsonl"), {
    timestamp: task.updatedAt,
    event: "state_changed",
    previousState,
    state: task.state,
    note: update.note || "",
    verification: normalizeArray(update.verification),
    artifacts: normalizeArray(update.artifacts)
  });
  return task;
}

export function readTask(projectPath, idPrefix) {
  const dir = findTaskDir(projectPath, idPrefix);
  const task = readJson(join(dir, "task.json"));
  validateTask(task);
  return task;
}

export function readTaskEvents(projectPath, idPrefix) {
  const dir = findTaskDir(projectPath, idPrefix);
  const eventsPath = join(dir, "events.jsonl");
  if (!existsSync(eventsPath)) {
    return [];
  }
  return readFileSync(eventsPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return { event: "unreadable", line: index + 1, error: error.message, raw: line };
      }
    });
}

export function listTasks(projectPath, { state = "All", staleMinutes = 20 } = {}) {
  if (state !== "All") {
    validateState(state, "state filter");
  }
  const root = taskRoot(projectPath);
  if (!existsSync(root)) {
    return [];
  }
  const now = Date.now();
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(root, entry.name);
        const file = join(dir, "task.json");
        try {
          const task = readJson(file);
          validateTask(task);
          const updatedMs = Date.parse(task.updatedAt);
          const minutesSinceUpdate = Number.isFinite(updatedMs) ? Math.round(((now - updatedMs) / 60000) * 10) / 10 : null;
          const active = ["Running", "Review", "Verify"].includes(task.state);
        return {
          id: task.id,
          state: task.state,
          priority: task.priority,
          repo: task.repo,
          title: task.title,
            updatedAt: task.updatedAt,
            minutesSinceUpdate,
            stale: Boolean(active && minutesSinceUpdate !== null && minutesSinceUpdate >= staleMinutes),
            taskDir: relativeTaskDir(task.id)
          };
        } catch (error) {
          return {
          id: entry.name,
          state: "Unreadable",
          priority: "",
          repo: "",
            title: error.message,
            updatedAt: "",
            minutesSinceUpdate: null,
            stale: true,
            taskDir: relativeTaskDir(entry.name)
          };
        }
    })
    .filter((task) => state === "All" || task.state === state)
    .sort((a, b) => Number(b.stale) - Number(a.stale) || String(a.priority).localeCompare(String(b.priority)) || String(a.updatedAt).localeCompare(String(b.updatedAt)));
}

export function preflight(projectPath) {
  const root = resolve(projectPath);
  const checks = [];
  const add = (name, status, detail = "") => checks.push({ name, status, detail });

  add("project path", existsSync(root) ? "OK" : "FAIL", root);
  add("WORKFLOW.md", existsSync(workflowPath(root)) ? "OK" : "FAIL", workflowPath(root));
  add("task root", existsSync(taskRoot(root)) ? "OK" : "WARN", taskRoot(root));
  add("runs root", existsSync(runsRoot(root)) ? "OK" : "WARN", runsRoot(root));

  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  add("node >=20", nodeMajor >= 20 ? "OK" : "FAIL", process.versions.node);
  add("git", commandExists("git") ? "OK" : "WARN", "optional but recommended");
  add("codex", commandExists("codex") ? "OK" : "WARN", "optional; needed for Codex runner workflows");

  const packagePath = join(root, "package.json");
  if (existsSync(packagePath)) {
    const pkg = readJson(packagePath);
    const scripts = Object.keys(pkg.scripts || {});
    add("package scripts", scripts.length > 0 ? "OK" : "WARN", scripts.join(", "));
    for (const script of ["test", "lint", "typecheck", "build"]) {
      if (pkg.scripts?.[script]) {
        add(`script:${script}`, "OK", pkg.scripts[script]);
      }
    }
  } else {
    add("package.json", "WARN", "not a Node project or package.json missing");
  }

  const fail = checks.filter((check) => check.status === "FAIL").length;
  const warn = checks.filter((check) => check.status === "WARN").length;
  const ok = checks.filter((check) => check.status === "OK").length;
  return { generatedAt: nowIso(), root, ok, warn, fail, checks };
}

export function commandExists(command) {
  const probe = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(probe, args, { encoding: "utf8", shell: process.platform !== "win32" });
  return result.status === 0;
}

export function detectPackageChecks(projectPath) {
  const packagePath = join(resolve(projectPath), "package.json");
  if (!existsSync(packagePath)) {
    return [];
  }
  const pkg = readJson(packagePath);
  const scripts = pkg.scripts || {};
  return ["lint", "typecheck", "test", "build"].filter((name) => scripts[name]).map((name) => `npm run ${name}`);
}

export function runCommand(command, { cwd = process.cwd(), timeoutMs = 600000 } = {}) {
  const startedAt = nowIso();
  const start = Date.now();
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 10
  });
  const finishedAt = nowIso();
  return {
    command,
    cwd,
    status: result.status,
    signal: result.signal,
    durationMs: Date.now() - start,
    startedAt,
    finishedAt,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : ""
  };
}

export function runGate(projectPath, checks) {
  const root = resolve(projectPath);
  ensureDir(runsRoot(root));
  const commands = checks.length > 0 ? checks : detectPackageChecks(root);
  const runId = `${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-gate`;
  const results = commands.map((command) => runCommand(command, { cwd: root }));
  const summary = {
    runId,
    generatedAt: nowIso(),
    root,
    commands,
    ok: results.filter((item) => item.status === 0).length,
    fail: results.filter((item) => item.status !== 0).length,
    results
  };
  writeJson(join(runsRoot(root), `${runId}.json`), summary);
  writeFileSync(join(runsRoot(root), `${runId}.md`), renderGateMarkdown(summary), "utf8");
  return summary;
}

export function planGate(projectPath, checks) {
  const root = resolve(projectPath);
  const commands = checks.length > 0 ? checks : detectPackageChecks(root);
  return {
    generatedAt: nowIso(),
    root,
    commands,
    dryRun: true
  };
}

export function renderGateMarkdown(summary) {
  const lines = [`# Agent Symphony Gate ${summary.runId}`, "", `Root: \`${summary.root}\``, "", `Result: ${summary.ok} passed, ${summary.fail} failed`, ""];
  for (const result of summary.results) {
    lines.push(`## ${result.status === 0 ? "PASS" : "FAIL"} \`${result.command}\``);
    lines.push("");
    lines.push(`- Duration: ${result.durationMs}ms`);
    if (result.error) lines.push(`- Error: ${result.error}`);
    if (result.stdout.trim()) lines.push("", "### stdout", "", "```text", trimOutput(result.stdout), "```");
    if (result.stderr.trim()) lines.push("", "### stderr", "", "```text", trimOutput(result.stderr), "```");
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function renderStatusTable(tasks) {
  if (tasks.length === 0) {
    return "No tasks found.";
  }
  const rows = tasks.map((task) => [
    task.id,
    task.state,
    task.priority || "",
    task.repo || "",
    task.minutesSinceUpdate ?? "",
    task.stale ? "yes" : "no",
    task.title
  ]);
  return formatTable(["id", "state", "priority", "repo", "age_min", "stale", "title"], rows);
}

export function renderPreflight(summary) {
  const rows = summary.checks.map((check) => [check.name, check.status, check.detail]);
  return `${formatTable(["check", "status", "detail"], rows)}\n\nSummary: OK=${summary.ok} WARN=${summary.warn} FAIL=${summary.fail}`;
}

export function formatTable(headers, rows) {
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => String(row[index] ?? "").length)));
  const render = (row) => row.map((cell, index) => String(cell ?? "").padEnd(widths[index])).join("  ");
  return [render(headers), render(headers.map((header, index) => "-".repeat(widths[index]))), ...rows.map(render)].join("\n");
}

export function trimOutput(value, limit = 12000) {
  const text = String(value);
  if (text.length <= limit) return text.trimEnd();
  return `${text.slice(0, limit)}\n... output truncated ...`;
}

export function resetForTests(path) {
  if (existsSync(path)) {
    const resolved = resolve(path);
    if (!resolved.includes(".tmp") && !resolved.includes("agent-symphony-kit-test")) {
      throw new Error(`Refusing to remove non-temp path: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  }
}

export function createUniqueId(projectPath, slug) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
  const base = `${stamp}-${slug}`;
  let candidate = base;
  let suffix = 2;
  while (existsSync(join(taskRoot(projectPath), candidate))) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function validateTask(task) {
  if (task?.schemaVersion !== 1) {
    throw new Error(`Unsupported task schemaVersion: ${task?.schemaVersion ?? "missing"}`);
  }
  if (!isNonEmptyString(task.id)) {
    throw new Error("Task is missing id");
  }
  if (!isNonEmptyString(task.title)) {
    throw new Error(`Task ${task.id} is missing title`);
  }
  requireIsoTimestamp(task, "createdAt");
  requireIsoTimestamp(task, "updatedAt");
  requireArrayField(task, "verification");
  requireArrayField(task, "artifacts");
  requireArrayField(task, "followups");
  requireArrayField(task, "blockedBy");
  validateState(task.state);
  task.priority = validatePriority(task.priority || "P2");
  return task;
}

export function normalizeArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireIsoTimestamp(task, field) {
  if (typeof task[field] !== "string" || Number.isNaN(Date.parse(task[field]))) {
    throw new Error(`Task ${task.id} has invalid ${field}: expected ISO timestamp`);
  }
}

function requireArrayField(task, field) {
  if (!Array.isArray(task[field])) {
    throw new Error(`Task ${task.id} has invalid ${field}: expected array`);
  }
}
