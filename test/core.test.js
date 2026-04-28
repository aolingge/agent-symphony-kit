import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createTask,
  initProject,
  listTasks,
  preflight,
  readTask,
  readTaskEvents,
  resetForTests,
  runGate,
  setTaskState,
  slugify
} from "../src/core.js";

test("slugify creates stable lowercase ids", () => {
  assert.equal(slugify("Fix Codex/Symphony workflow!"), "fix-codex-symphony-workflow");
  assert.equal(slugify("!!!"), "task");
});

test("init creates workflow and state directories", () => {
  const dir = tempDir();
  const result = initProject(dir);
  assert.ok(existsSync(join(dir, "WORKFLOW.md")));
  assert.ok(existsSync(result.taskRoot));
  assert.ok(existsSync(result.runsRoot));
});

test("task lifecycle writes json and events", () => {
  const dir = tempDir();
  initProject(dir);
  const task = createTask(dir, { title: "Ship release", repo: "demo", priority: "P1" });
  assert.equal(task.schemaVersion, 1);
  assert.equal(task.title, "Ship release");
  assert.equal(task.state, "Ready");
  assert.equal(task.priority, "P1");
  assert.equal(Number.isNaN(Date.parse(task.createdAt)), false);
  assert.equal(Number.isNaN(Date.parse(task.updatedAt)), false);
  assert.equal(task.taskDir.startsWith(".agent-symphony/tasks/"), true);
  assert.deepEqual(task.blockedBy, []);
  assert.deepEqual(task.verification, []);
  assert.deepEqual(task.artifacts, []);
  assert.deepEqual(task.followups, []);

  const updated = setTaskState(dir, task.id.slice(0, 14), {
    state: "Done",
    note: "verified",
    verification: ["npm test passed"],
    artifacts: ["report.md"]
  });
  assert.equal(updated.state, "Done");
  assert.deepEqual(updated.verification, ["npm test passed"]);

  const tasks = listTasks(dir);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].state, "Done");
  assert.equal(tasks[0].taskDir, task.taskDir);

  const taskJson = readFileSync(join(dir, task.taskDir, "task.json"), "utf8");
  assert.equal(taskJson.includes(dir), false);

  const events = readFileSync(join(dir, task.taskDir, "events.jsonl"), "utf8").trim().split(/\r?\n/);
  assert.equal(events.length, 2);
});

test("task ids do not overwrite rapid repeated work", () => {
  const dir = tempDir();
  initProject(dir);
  const first = createTask(dir, { title: "Same title", description: "first" });
  const second = createTask(dir, { title: "Same title", description: "second" });
  assert.notEqual(first.id, second.id);
  assert.equal(existsSync(join(dir, first.taskDir, "task.json")), true);
  assert.equal(existsSync(join(dir, second.taskDir, "task.json")), true);
});

test("task state and priority are validated", () => {
  const dir = tempDir();
  initProject(dir);
  assert.throws(() => createTask(dir, { title: "Bad state", state: "TypoState" }), /Invalid state/);
  assert.throws(() => createTask(dir, { title: "Bad priority", priority: "PX" }), /Invalid priority/);
  const task = createTask(dir, { title: "Valid" });
  assert.throws(() => setTaskState(dir, task.id, { state: "TypoState" }), /Invalid state/);
  assert.throws(() => listTasks(dir, { state: "TypoState" }), /Invalid state filter/);
});

test("task readers report ambiguous ids and unreadable task contracts", () => {
  const dir = tempDir();
  initProject(dir);
  const first = createTask(dir, { title: "First task" });
  createTask(dir, { title: "Second task" });

  assert.throws(() => readTask(dir, first.id.slice(0, 8)), /ambiguous/);

  const taskPath = join(dir, first.taskDir, "task.json");
  const broken = JSON.parse(readFileSync(taskPath, "utf8"));
  delete broken.updatedAt;
  writeFileSync(taskPath, `${JSON.stringify(broken, null, 2)}\n`, "utf8");

  assert.throws(() => readTask(dir, first.id), /invalid updatedAt/);
  const unreadable = listTasks(dir).find((task) => task.id === first.id);
  assert.equal(unreadable.state, "Unreadable");
  assert.match(unreadable.title, /invalid updatedAt/);
  assert.equal(unreadable.taskDir, first.taskDir);
});

test("task event readers preserve unknown events and diagnose malformed lines", () => {
  const dir = tempDir();
  initProject(dir);
  const task = createTask(dir, { title: "Event parsing" });
  const eventsPath = join(dir, task.taskDir, "events.jsonl");
  writeFileSync(
    eventsPath,
    [
      JSON.stringify({ timestamp: task.createdAt, event: "created", state: "Ready" }),
      JSON.stringify({ timestamp: task.createdAt, event: "custom_future_event", payload: { retained: true } }),
      "{bad json"
    ].join("\n"),
    "utf8"
  );

  const events = readTaskEvents(dir, task.id);
  assert.equal(events[1].event, "custom_future_event");
  assert.deepEqual(events[1].payload, { retained: true });
  assert.equal(events[2].event, "unreadable");
  assert.equal(events[2].line, 3);
  assert.match(events[2].error, /JSON/);
  assert.equal(events[2].raw, "{bad json");
});

test("task create requires init", () => {
  const dir = tempDir();
  assert.throws(() => createTask(dir, { title: "Orphan" }), /not initialized/);
});

test("preflight reports initialized project as healthy enough", () => {
  const dir = tempDir();
  initProject(dir);
  const result = preflight(dir);
  assert.equal(result.fail, 0);
  assert.ok(result.ok >= 4);
});

test("gate records passing and failing commands", () => {
  const dir = tempDir();
  initProject(dir);
  const pass = runGate(dir, [`${JSON.stringify(process.execPath)} -e "console.log('ok')"`]);
  assert.equal(pass.fail, 0);
  assert.equal(pass.ok, 1);

  const fail = runGate(dir, [`${JSON.stringify(process.execPath)} -e "process.exit(7)"`]);
  assert.equal(fail.fail, 1);
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "agent-symphony-kit-test-"));
  resetForTests(dir);
  return dir;
}
