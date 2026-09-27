import { execSync, spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Option, SettleConfig } from "./config.ts";

export interface BobResult {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  // The final `result` event Bob Shell emits: duration, tool calls, cost.
  summary: Record<string, unknown> | null;
  error?: string;
}

export interface BobToolCall {
  tool: string;
  params: Record<string, any>;
}

// Runs Bob Shell's entry point with node directly, so the prompt travels as
// one argv element and never passes through a shell's quoting rules.
// SETTLE_BOB_JS points at a different script (the test suite's stand in).
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
    `3. Do not modify, rename or delete any existing test file in any way, including its setup and teardown. Put any new tests in new test files. If your option needs something started or stopped, do it in your own code or your own test files.`,
    `4. Install any dependency you need with the package manager so package.json is updated.`,
    `5. When done, run \`${config.app.test}\` and make sure it passes and exits on its own (stop any timers, intervals or servers your code starts once the tests finish).`,
    `6. Do not start long running servers and do not run load tests; measurement happens after you finish.`,
    `7. Do not commit. Finish with a short summary of what you changed and any tradeoff you chose.`,
  ].join("\n");
}

export async function runBob(
  config: SettleConfig,
  option: Option,
  workspace: string,
  appPath: string,
  logFile: string,
  onTool: (call: BobToolCall) => void = () => {},
): Promise<BobResult> {
  return runBobPrompt(buildPrompt(config, option, appPath), workspace, logFile, config.bob, onTool);
}

// Runs one headless Bob Shell session with any prompt.
export async function runBobPrompt(
  prompt: string,
  workspace: string,
  logFile: string,
  limits: { max_turns: number; timeout_minutes: number },
  onTool: (call: BobToolCall) => void = () => {},
): Promise<BobResult> {
  const config = { bob: limits };
  const args = [
    bobEntry(),
    "run",
    "--accept-license",
    "--trust",
    "--format",
    "stream-json",
    "--max-turns",
    String(config.bob.max_turns),
    "--workspace",
    workspace,
    prompt,
  ];

  const started = Date.now();
  return new Promise((resolve) => {
    // stdin must be closed: with a pipe attached Bob Shell waits to read piped
    // input and never starts the task.
    const child = spawn(process.execPath, args, { cwd: workspace, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let pending = "";
    let summary: Record<string, unknown> | null = null;

    // stream-json is one JSON object per line: tool calls as they happen,
    // then a final `result` with the session stats.
    child.stdout.on("data", (d) => {
      stdout += d;
      pending += d;
      let nl: number;
      while ((nl = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, nl).trim();
        pending = pending.slice(nl + 1);
        if (!line.startsWith("{")) continue;
        try {
          const ev = JSON.parse(line);
          if (ev.type === "tool_use") onTool({ tool: ev.tool_name, params: ev.parameters ?? {} });
          else if (ev.type === "result") summary = ev;
        } catch {}
      }
    });
    child.stderr.on("data", (d) => (stderr += d));

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, config.bob.timeout_minutes * 60_000);

    child.on("close", (code) => {
      clearTimeout(timer);
      writeFileSync(logFile, `# prompt\n${prompt}\n\n# stdout\n${stdout}\n\n# stderr\n${stderr}\n`);
      const failed = summary && (summary as any).status && (summary as any).status !== "success";
      resolve({
        ok: code === 0 && !timedOut && !failed,
        exitCode: code,
        durationMs: Date.now() - started,
        timedOut,
        summary,
        error: code === 0 && !failed ? undefined : (stderr.trim().split("\n").pop() || `exit ${code}`),
      });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, exitCode: null, durationMs: Date.now() - started, timedOut, summary: null, error: err.message });
    });
  });
}
