import { execSync, spawn, type ChildProcess } from "node:child_process";
import type { Freshness, Request, SettleConfig } from "./config.ts";

export interface LoadResult {
  requests: number;
  errors: number;
  rps: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface FreshnessResult {
  probes: number;
  // Seconds from a successful write until a read reflected it. A probe that
  // never became visible is recorded as the timeout.
  lags_seconds: number[];
  max_seconds: number;
  median_seconds: number;
  timed_out: number;
}

export interface TestResult {
  ok: boolean;
  // The suite passed its own checks but never exited, e.g. a timer left running.
  timed_out?: boolean;
  passed: number | null;
  failed: number | null;
}

function sh(command: string, cwd: string, env: NodeJS.ProcessEnv = process.env): ChildProcess {
  return spawn(command, { cwd, env, shell: true, detached: process.platform !== "win32" });
}

// npm start → tsx → node: killing only the shell leaves the server alive and
// holding the port, so kill the whole tree.
// Returns a Promise that resolves once the process has actually exited, so the
// caller can be sure the port and file handles are free before starting the
// next option.
function killTree(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.pid === undefined || child.exitCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    try {
      if (process.platform === "win32") execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
      else process.kill(-child.pid, "SIGKILL");
    } catch {
      // Process may have already exited; the "exit" event will fire regardless.
    }
  });
}

// A command that never exits (a test suite with a timer left running, say)
// must not stall the whole run: after timeoutMs the tree is killed and the
// command counts as failed.
export function run(command: string, cwd: string, timeoutMs = 0): Promise<{ code: number; output: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = sh(command, cwd);
    let output = "";
    let timedOut = false;
    child.stdout?.on("data", (d) => (output += d));
    child.stderr?.on("data", (d) => (output += d));
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          output += `
[settle] stopped after ${Math.round(timeoutMs / 1000)} s without exiting
`;
          void killTree(child);
        }, timeoutMs)
      : undefined;
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: timedOut ? 124 : (code ?? 1), output, timedOut });
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface App {
  base: string;
  stop(): Promise<void>;
  log(): string;
}

export async function startApp(config: SettleConfig, appDir: string, port: number): Promise<App> {
  const child = sh(config.app.start, appDir, { ...process.env, [config.app.port_env]: String(port) });
  let log = "";
  child.stdout?.on("data", (d) => (log += d));
  child.stderr?.on("data", (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + config.app.ready_timeout_seconds * 1000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`app exited during startup:\n${log.slice(-2000)}`);
    try {
      const res = await fetch(base + config.app.health);
      if (res.ok) return { base, stop: () => killTree(child), log: () => log };
    } catch {}
    await sleep(250);
  }
  await killTree(child);
  throw new Error(`app did not become healthy within ${config.app.ready_timeout_seconds}s:\n${log.slice(-2000)}`);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function send(base: string, req: Request, body?: unknown): Promise<Response> {
  return fetch(base + req.path, {
    method: req.method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function loadTest(base: string, config: SettleConfig): Promise<LoadResult> {
  const { request, duration_seconds, concurrency, warmup_seconds } = config.load;
  const latencies: number[] = [];
  let errors = 0;
  const warmEnd = Date.now() + warmup_seconds * 1000;
  const end = warmEnd + duration_seconds * 1000;

  async function worker() {
    while (Date.now() < end) {
      const t0 = performance.now();
      let ok = false;
      try {
        const res = await send(base, request, request.body);
        await res.arrayBuffer();
        ok = res.ok;
      } catch {}
      const ms = performance.now() - t0;
      if (Date.now() <= warmEnd) continue;
      if (ok) latencies.push(ms);
      else errors++;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  latencies.sort((a, b) => a - b);
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    requests: latencies.length + errors,
    errors,
    rps: round(latencies.length / duration_seconds),
    p50_ms: round(percentile(latencies, 50)),
    p95_ms: round(percentile(latencies, 95)),
    p99_ms: round(percentile(latencies, 99)),
  };
}

// Template values in the write body:
//   "{{random A B}}"  a random integer in [A, B]
//   "{{increasing}}"  100,000,000 × (probe number), so each probe outranks the last
export function renderBody(template: Record<string, unknown> | undefined, probe: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(template ?? {})) {
    if (typeof value !== "string") {
      out[key] = value;
      continue;
    }
    const random = value.match(/^\{\{random (\d+) (\d+)\}\}$/);
    if (random) {
      const [lo, hi] = [Number(random[1]), Number(random[2])];
      out[key] = lo + Math.floor(Math.random() * (hi - lo + 1));
    } else if (value === "{{increasing}}") {
      out[key] = 100_000_000 * (probe + 1);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function readPath(json: unknown, dotted: string): unknown {
  let cur: any = json;
  for (const part of dotted.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[/^\d+$/.test(part) ? Number(part) : part];
  }
  return cur;
}

export async function freshnessTest(base: string, f: Freshness): Promise<FreshnessResult> {
  const lags: number[] = [];
  let timedOut = 0;
  for (let probe = 0; probe < f.probes; probe++) {
    const body = renderBody(f.write.body, probe);
    const expected = body[f.equals];
    const res = await send(base, f.write, body);
    if (!res.ok) throw new Error(`freshness write failed: ${res.status} ${await res.text()}`);
    const written = Date.now();
    const deadline = written + f.timeout_seconds * 1000;
    let seen = false;
    while (Date.now() < deadline) {
      const r = await send(base, f.read, f.read.body);
      if (r.ok && readPath(await r.json(), f.read_field) === expected) {
        seen = true;
        break;
      }
      await sleep(100);
    }
    const lag = seen ? (Date.now() - written) / 1000 : f.timeout_seconds;
    if (!seen) {
      timedOut++;
      // Wait one full timeout before the next probe so the previous write's
      // side-effects (queue processing, cache invalidation, background refresh)
      // have fully resolved and cannot make the next probe appear faster than
      // it really is.
      await sleep(f.timeout_seconds * 1000);
    }
    lags.push(Math.round(lag * 10) / 10);
  }
  const sorted = [...lags].sort((a, b) => a - b);
  return {
    probes: f.probes,
    lags_seconds: lags,
    max_seconds: sorted[sorted.length - 1] ?? 0,
    median_seconds: sorted[Math.floor(sorted.length / 2)] ?? 0,
    timed_out: timedOut,
  };
}

export async function runTests(command: string, appDir: string, timeoutMs = 0): Promise<TestResult & { output: string }> {
  const { code, output, timedOut } = await run(command, appDir, timeoutMs);
  const num = (label: string) => {
    const m = output.match(new RegExp(`(?:ℹ|#) ${label} (\\d+)`));
    return m ? Number(m[1]) : null;
  };
  return { ok: code === 0, passed: num("pass"), failed: num("fail"), timed_out: timedOut || undefined, output };
}

export function newDependencies(basePkg: string | null, headPkg: string | null): string[] {
  const names = (text: string | null) => {
    if (!text) return new Set<string>();
    const pkg = JSON.parse(text);
    return new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
  };
  const before = names(basePkg);
  return [...names(headPkg)].filter((n) => !before.has(n)).sort();
}
