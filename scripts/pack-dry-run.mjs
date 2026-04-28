import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32"
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

const data = JSON.parse(result.stdout);
const files = data[0]?.files?.map((item) => item.path) || [];
const forbidden = files.filter((path) =>
  path.startsWith(".agent-symphony/") ||
  path.startsWith(".tmp/") ||
  path.includes("node_modules") ||
  /(^|\/)(\.env|npm-debug|debug\.log|\.DS_Store)$/i.test(path) ||
  /(?:^|\/)(private|secret|cookie|token)(?:\/|\.|$)/i.test(path)
);

if (forbidden.length > 0) {
  console.error("Forbidden files would be packed:");
  for (const path of forbidden) {
    console.error(`- ${path}`);
  }
  process.exit(1);
}

console.log(`npm pack dry-run ok (${files.length} files)`);

