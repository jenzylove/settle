import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { executeRun, prepareRun, writeRun, type RunFile } from "./engine.ts";
import type { Stamped } from "./events.ts";
import { decide } from "./verdict.ts";

export type { RunFile };

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

// Prints a run's events as the terminal log.
export function printer(): (e: Stamped) => void {
  const t0 = Date.now();
  const names = new Map<string, string>([["baseline", "Today (no change)"]]);
  const say = (msg: string) => {
    const s = Math.round((Date.now() - t0) / 1000);
    console.log(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}  ${msg}`);
  };
  return (e) => {
    const n = (id: string) => names.get(id) ?? id;
    switch (e.kind) {
      case "start":
        for (const o of e.options) names.set(o.id, o.name);
        say(`Question  ${e.question}`);
        say(`Options   ${e.options.map((o) => o.name).join(" · ")}`);
        say(`Base      ${e.base.slice(0, 7)}`);
        break;
      case "phase":
        if (e.phase === "build") say(`Bob is building ${names.size - 1} options in parallel`);
        break;
      case "bob":
        if (process.env.SETTLE_VERBOSE) say(`${n(e.option)}: ${e.label}`);
        break;
      case "built":
        say(`${n(e.option)}: ${e.ok ? "built" : `not built (${e.error})`} in ${e.seconds}s${e.tool_calls ? `, ${e.tool_calls} Bob tool calls` : ""}`);
        break;
      case "measure": {
        const steps = { install: "installing", tests: "running tests", start: "starting app", load: "load test", freshness: "staleness probes" };
        say(`${n(e.option)}: ${steps[e.step]}`);
        break;
      }
      case "measured":
        if (e.error) say(`${n(e.option)}: measurement failed: ${e.error.split("\n")[0]}`);
        else {
          if (e.load) say(`${n(e.option)}: p50 ${e.load.p50_ms} ms · p95 ${e.load.p95_ms} ms · ${e.load.rps} req/s`);
          if (e.freshness) say(`${n(e.option)}: writes visible after ${e.freshness.lags_seconds.join(", ")} s`);
        }
        break;
      case "verdict":
        say(`Verdict   ${e.verdict.headline}`);
        break;
      case "error":
        say(`Error     ${e.message}`);
        break;
    }
  };
}

async function cmdRun(args: string[]) {
  const opts = { baselineOnly: args.includes("--baseline-only") };
  const prepared = prepareRun(resolve(flag(args, "config") ?? "settle.yml"), opts);
  await executeRun(prepared, opts, printer());
  console.log(`      Report    ${relative(process.cwd(), join(prepared.runDir, "index.html"))}`);
}

// Re-decide an existing run under different constraints, e.g.
//   settle report runs/<id> --set max_staleness_seconds=60
function cmdReport(args: string[]) {
  const runDir = resolve(args[0] ?? "");
  const file = join(runDir, "results.json");
  if (!existsSync(file)) throw new Error(`no results.json in ${runDir}`);
  const data: RunFile = JSON.parse(readFileSync(file, "utf8"));
  const set = flag(args, "set");
  if (set) {
    for (const pair of set.split(",")) {
      const [k, v] = pair.split("=");
      (data.constraints as any)[k] = v === "true" ? true : v === "false" ? false : Number(v);
    }
  }
  data.verdict = decide(data.options, data.constraints);
  const out = flag(args, "out") ? resolve(flag(args, "out")!) : runDir;
  mkdirSync(out, { recursive: true });
  writeRun(out, data);
  console.log(`Verdict  ${data.verdict.headline}\n         ${data.verdict.reason}`);
}

const usage = `settle run [--config settle.yml] [--baseline-only]   build every option with IBM Bob, measure, decide
settle report <run dir> [--set k=v,...] [--out dir]  re-decide a finished run under different constraints
settle ui [--config settle.yml] [--port 4300]        open the Settle app in your browser
settle site [--out site]                             build the static site from runs/`;

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "run") await cmdRun(rest);
  else if (cmd === "report") cmdReport(rest);
  else if (cmd === "ui") await (await import("./ui.ts")).serve(rest);
  else if (cmd === "site") await (await import("./site.ts")).build(rest);
  else {
    console.log(usage);
    process.exit(cmd ? 1 : 0);
  }
} catch (err) {
  console.error(`settle: ${(err as Error).message}`);
  process.exit(1);
}
