import { execSync, spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Option, SettleConfig } from "./config.ts";

export interface BobResult {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  // The JSON object Bob Shell prints at the end of a `--format json` run:
  // token counts, cost, tool calls and the final message.
  summary: Record<string, unknown> | null;
  error?: string;
}

// Runs Bob Shell's entry point with node directly, so the prompt travels as
// one argv element and never passes through a shell's quoting rules.
function bobEntry(): string {
  if (process.env.SETTLE_BOB_JS) return process.env.SETTLE_BOB_JS;
  const root = execSync("npm root -g", { encoding: "utf8" }).trim();
  const entry = join(root, "bobshell", "dist", "bob.js");
  if (!existsSync(entry)) {
    throw new Error("IBM Bob Shell not found. Install it: https://bob.ibm.com/docs/shell/getting-started/install-and-setup");
  }
  return entry;
}

export function buildPrompt(config: SettleConfig, option: Option, appPath: string): string {
  const others = config.options
    .filter((o) => o.id !== option.id)
    .map((o) => `- ${o.name}: ${o.description}`)
    .join("\n");
  return [
    `You are building ONE option in a design comparison. Other engineers are building the other options in parallel; your version will be measured against theirs with the same load test.`,
    ``,
    `Question: ${config.question}`,
    config.context ? `Context: ${config.context}` : ``,
    ``,
    `Your option: ${option.name}`,
    option.description,
    ``,
    `The other options (do NOT build these):`,
    others,
    ``,
    `The application is in: ${appPath}`,
    ``,
    `Rules:`,
    `1. Implement your option the way a careful senior engineer would for production. Smallest change that fully does the job.`,
    `2. Keep every HTTP route, request and response shape exactly the same.`,
    `3. Do not edit or delete existing tests. You may add tests for your change.`,
    `4. Install any dependency you need with the package manager so package.json is updated.`,
    `5. When done, run \`${config.app.test}\` and make sure it passes.`,
    `6. Do not start long running servers and do not run load tests; measurement happens after you finish.`,
    `7. Do not commit. Finish with a short summary of what you changed and any tradeoff you chose.`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

export async function runBob(
  config: SettleConfig,
  option: Option,
  workspace: string,
  appPath: string,
  logFile: string,
): Promise<BobResult> {
  const prompt = buildPrompt(config, option, appPath);
  const args = [
    bobEntry(),
    "run",
    "--accept-license",
    "--trust",
    "--format",
    "json",
    "--max-turns",
    String(config.bob.max_turns),
    "--workspace",
    workspace,
    prompt,
  ];

  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: workspace, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, config.bob.timeout_minutes * 60_000);

    child.on("close", (code) => {
      clearTimeout(timer);
      writeFileSync(logFile, `# prompt\n${prompt}\n\n# stdout\n${stdout}\n\n# stderr\n${stderr}\n`);
      const summary = lastJsonObject(stdout);
      resolve({
        ok: code === 0 && !timedOut,
        exitCode: code,
        durationMs: Date.now() - started,
        timedOut,
        summary,
        error: code === 0 ? undefined : (stderr.trim().split("\n").pop() ?? `exit ${code}`),
      });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, exitCode: null, durationMs: Date.now() - started, timedOut, summary: null, error: err.message });
    });
  });
}

// `--format json` prints one JSON object once the session completes; logs
// may precede it, so take the last line that parses as an object.
export function lastJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    const whole = JSON.parse(trimmed);
    if (whole && typeof whole === "object") return whole;
  } catch {}
  const lines = trimmed.split("\n").reverse();
  for (const line of lines) {
    const s = line.trim();
    if (!s.startsWith("{")) continue;
    try {
      return JSON.parse(s);
    } catch {}
  }
  return null;
}
