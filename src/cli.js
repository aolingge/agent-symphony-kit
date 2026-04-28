#!/usr/bin/env node
import {
  createTask,
  initProject,
  listTasks,
  preflight,
  planGate,
  readTask,
  readTaskEvents,
  renderPreflight,
  renderStatusTable,
  runCommand,
  runGate,
  setTaskState
} from "./core.js";

function main(argv) {
  const [command, subcommand, ...rest] = argv;
  try {
    if (!command || command === "help" || command === "--help" || command === "-h") {
      printHelp();
      return 0;
    }

    if (command === "init") {
      const options = parseArgs([subcommand, ...rest].filter(Boolean));
      const result = initProject(options.path || ".", { force: Boolean(options.force) });
      print(result, options);
      return 0;
    }

    if (command === "task") {
      return handleTask(subcommand, rest);
    }

    if (command === "preflight" || command === "doctor") {
      const options = parseArgs([subcommand, ...rest].filter(Boolean));
      const result = preflight(options.path || ".");
      print(result, options, renderPreflight(result));
      return result.fail > 0 ? 1 : 0;
    }

    if (command === "gate") {
      const options = parseArgs([subcommand, ...rest].filter(Boolean), { collect: ["check"] });
      if (options["dry-run"]) {
        const plan = planGate(options.path || ".", options.check || []);
        print(plan, options, `Gate dry-run commands:\n${plan.commands.map((item) => `- ${item}`).join("\n") || "- none detected"}`);
        return 0;
      }
      const result = runGate(options.path || ".", options.check || []);
      print(result, options, `Gate: ${result.ok} passed, ${result.fail} failed. Reports written under .agent-symphony/runs.`);
      return result.fail > 0 ? 1 : 0;
    }

    if (command === "run") {
      const splitIndex = argv.indexOf("--");
      if (splitIndex === -1 || splitIndex === argv.length - 1) {
        throw new Error("Usage: askit run -- <command>");
      }
      const options = parseArgs(argv.slice(1, splitIndex));
      const commandText = argv.slice(splitIndex + 1).join(" ");
      const result = runCommand(commandText, { cwd: options.path || "." });
      print(result, options);
      return result.status || 0;
    }

    if (command === "report" || command === "status") {
      const options = parseArgs([subcommand, ...rest].filter(Boolean));
      const tasks = listTasks(options.path || ".", { state: options.state || "All", staleMinutes: Number(options["stale-minutes"] || 20) });
      print(tasks, options, renderStatusTable(tasks));
      return 0;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(`agent-symphony-kit: ${error.message}`);
    return 1;
  }
}

function handleTask(subcommand, rest) {
  const options = parseArgs(rest, { collect: ["verification", "artifact", "blocked-by"] });
  if (subcommand === "create") {
    if (!options.title) {
      throw new Error("task create requires --title");
    }
    const task = createTask(options.path || ".", {
      title: options.title,
      description: options.description || "",
      repo: options.repo || "",
      state: options.state || "Ready",
      priority: options.priority || "P2",
      blockedBy: options["blocked-by"] || []
    });
    print(task, options);
    return 0;
  }

  if (subcommand === "set") {
    if (!options.id || !options.state) {
      throw new Error("task set requires --id and --state");
    }
    const task = setTaskState(options.path || ".", options.id, {
      state: options.state,
      note: options.note || "",
      verification: options.verification || [],
      artifacts: options.artifact || []
    });
    print(task, options);
    return 0;
  }

  if (subcommand === "show") {
    if (!options.id) {
      throw new Error("task show requires --id");
    }
    const task = readTask(options.path || ".", options.id);
    print(task, options, renderTaskText(task));
    return 0;
  }

  if (subcommand === "log") {
    if (!options.id) {
      throw new Error("task log requires --id");
    }
    const events = readTaskEvents(options.path || ".", options.id);
    print(events, options, events.map((event) => `${event.timestamp || ""} ${event.event} ${event.state || ""} ${event.note || ""}`.trim()).join("\n"));
    return 0;
  }

  if (subcommand === "list" || !subcommand) {
    const tasks = listTasks(options.path || ".", { state: options.state || "All", staleMinutes: Number(options["stale-minutes"] || 20) });
    print(tasks, options, renderStatusTable(tasks));
    return 0;
  }

  throw new Error(`Unknown task command: ${subcommand}`);
}

function parseArgs(args, config = {}) {
  const options = {};
  const collect = new Set(config.collect || []);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
    if (key === "json" || key === "force" || key === "dry-run") {
        options[key] = true;
        continue;
      }
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for --${key}`);
      }
      i += 1;
      if (collect.has(key)) {
        options[key] = [...(options[key] || []), value];
      } else {
        options[key] = value;
      }
    }
  }
  return options;
}

function print(value, options, text) {
  if (options.json) {
    console.log(JSON.stringify(value, null, 2));
  } else if (text) {
    console.log(text);
  } else if (Array.isArray(value)) {
    console.log(renderStatusTable(value));
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item !== "object") {
        console.log(`${key}: ${item}`);
      }
    }
  }
}

function printHelp() {
  console.log(`agent-symphony-kit

Local-first task orchestration and verification contracts for coding agents.

Usage:
  askit init [--path .] [--force]
  askit task create --title "Fix bug" [--description "..."] [--repo name] [--priority P1] [--json]
  askit task list [--state Ready] [--stale-minutes 20] [--json]
  askit task show --id <prefix> [--json]
  askit task log --id <prefix> [--json]
  askit task set --id <prefix> --state Verify [--note "..."] [--verification "..."] [--artifact "..."]
  askit preflight [--path .] [--json]
  askit gate [--path .] [--check "npm test"] [--check "npm run lint"] [--dry-run] [--json]
  askit run [--path .] -- <command>
  askit report [--path .] [--json]
`);
}

function renderTaskText(task) {
  return `Task: ${task.id}
Title: ${task.title}
State: ${task.state}
Priority: ${task.priority}
Repo: ${task.repo || ""}
Updated: ${task.updatedAt}

${task.description || ""}`;
}

process.exitCode = main(process.argv.slice(2));
