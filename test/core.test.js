import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createTask,
  initProject,
  listTasks,
  preflight,
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
  assert.equal(task.state, "Ready");

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

  const events = readFileSync(join(task.taskDir, "events.jsonl"), "utf8").trim().split(/\r?\n/);
  assert.equal(events.length, 2);
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

