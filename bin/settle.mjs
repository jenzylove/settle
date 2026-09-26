#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Resolve tsx from Settle's own install, not from the folder the user runs in.
const tsx = import.meta.resolve("tsx");
const result = spawnSync(process.execPath, ["--import", tsx, join(root, "src", "cli.ts"), ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
});
process.exit(result.status ?? 1);
