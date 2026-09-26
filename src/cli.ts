import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { runBob } from "./bob.ts";
import { loadConfig, type Constraints, type Option, type SettleConfig } from "./config.ts";
import { addWorktree, commitAll, diffStats, dirtyFiles, headCommit, repoRoot, showFile } from "./git.ts";
import { freshnessTest, loadTest, newDependencies, run, runTests, startApp } from "./measure.ts";
import { renderAppendix, renderReport } from "./report.ts";
import { decide, type OptionResult, type Verdict } from "./verdict.ts";

export interface RunFile {
  question: string;
  context?: string;
  created_at: string;
  base_commit: string;
  app_path: string;
  constraints: Constraints;
  load: SettleConfig["load"];
  baseline: OptionResult;
  options: OptionResult[];
  verdict: Verdict;
}

const t0 = Date.now();
function say(msg: string) {
  const s = Math.round((Date.now() - t0) / 1000);
  console.log(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}  ${msg}`);
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function measureOption(
  config: SettleConfig,
  result: OptionResult,
  worktree: string,
  appRel: string,
  base: string,
  port: number,
): Promise<void> {
  const appDir = join(worktree, appRel);
  result.diff = diffStats(worktree, base, appRel);
  const pkg = appRel ? `${appRel.replace(/\\/g, "/")}/package.json` : "package.json";
  result.new_dependencies = newDependencies(showFile(worktree, base, pkg), showFile(worktree, "HEAD", pkg));

  say(`${result.name}: installing`);
  const install = await run(config.app.install, appDir);
  if (install.code !== 0) {
    result.measure_error = `install failed:\n${install.output.slice(-1500)}`;
    return;
  }

  say(`${result.name}: running tests`);
  const tests = await runTests(config.app.test, appDir);
  result.tests = { ok: tests.ok, passed: tests.passed, failed: tests.failed };

  say(`${result.name}: starting app`);
  let app;
  try {
    app = await startApp(config, appDir, port);
  } catch (err) {
    result.measure_error = (err as Error).message;
    return;
  }
  try {
    say(`${result.name}: load test, ${config.load.duration_seconds}s at concurrency ${config.load.concurrency}`);
    result.load = await loadTest(app.base, config);
    say(`${result.name}: p50 ${result.load.p50_ms} ms · p95 ${result.load.p95_ms} ms · ${result.load.rps} req/s`);
    if (config.freshness) {
      say(`${result.name}: staleness probes (${config.freshness.probes})`);
      result.freshness = await freshnessTest(app.base, config.freshness);
      say(`${result.name}: writes visible after ${result.freshness.lags_seconds.join(", ")} s`);
    }
  } catch (err) {
    result.measure_error = (err as Error).message;
  } finally {
    await app.stop();
  }
}

function blankResult(o: Option, branch: string): OptionResult {
  return { id: o.id, name: o.name, description: o.description, branch, built: false };
}

function writeRun(runDir: string, data: RunFile) {
  writeFileSync(join(runDir, "results.json"), JSON.stringify(data, null, 2));
  writeFileSync(join(runDir, "index.html"), renderReport(data));
  writeFileSync(join(runDir, "appendix.md"), renderAppendix(data));
}

async function cmdRun(args: string[]) {
  const configPath = resolve(flag(args, "config") ?? "settle.yml");
  if (!existsSync(configPath)) throw new Error(`no settle.yml at ${configPath}`);
  const config = loadConfig(configPath);
  const appDirAbs = dirname(configPath);
  const root = repoRoot(appDirAbs);
  const appRel = relative(root, appDirAbs);
  const dirty = dirtyFiles(root, appDirAbs);
  if (dirty.length) throw new Error(`commit your changes first; these would be missing from every option:\n${dirty.join("\n")}`);

  const base = headCommit(root);
  const id = stamp();
  const runDir = join(root, "runs", id);
  const treeDir = join(root, ".settle", id);
  mkdirSync(runDir, { recursive: true });

  say(`Question  ${config.question}`);
  say(`Options   ${config.options.map((o) => o.name).join(" · ")}`);
  say(`Base      ${base.slice(0, 7)}`);

  const baseline = blankResult({ id: "baseline", name: "Today (no change)", description: "The code as it is now." }, `settle/${id}/baseline`);
  addWorktree(root, join(treeDir, "baseline"), baseline.branch, base);
  baseline.built = true;

  // --baseline-only measures today's code without calling Bob, to check the
  // harness and pick sensible constraints before spending Bobcoins.
  const baselineOnly = args.includes("--baseline-only");
  const results = baselineOnly ? [] : config.options.map((o) => blankResult(o, `settle/${id}/${o.id}`));
  for (const r of results) addWorktree(root, join(treeDir, r.id), r.branch, base);

  say(`Bob is building ${results.length} options in parallel`);
  await Promise.all(
    results.map(async (r, i) => {
      const tree = join(treeDir, r.id);
      const bob = await runBob(config, config.options[i], tree, appRel || ".", join(runDir, `bob-${r.id}.log`));
      r.bob = { duration_seconds: Math.round(bob.durationMs / 1000), summary: bob.summary };
      const changed = commitAll(tree, `settle: ${r.name}`);
      r.built = bob.ok && changed;
      if (!bob.ok) r.build_error = bob.timedOut ? "Bob timed out" : bob.error;
      else if (!changed) r.build_error = "Bob finished without changing any files";
      say(`${r.name}: ${r.built ? "built" : `not built (${r.build_error})`} in ${r.bob.duration_seconds}s`);
    }),
  );

  // Measure one at a time so options do not compete for CPU.
  let port = 4310;
  await measureOption(config, baseline, join(treeDir, "baseline"), appRel, base, port++);
  for (const r of results) {
    if (r.built) await measureOption(config, r, join(treeDir, r.id), appRel, base, port++);
  }

  const data: RunFile = {
    question: config.question,
    context: config.context,
    created_at: new Date().toISOString(),
    base_commit: base,
    app_path: appRel.replace(/\\/g, "/"),
    constraints: config.constraints,
    load: config.load,
    baseline,
    options: results,
    verdict: decide(results, config.constraints),
  };
  writeRun(runDir, data);
  say(`Verdict   ${data.verdict.headline}`);
  say(`Report    ${relative(process.cwd(), join(runDir, "index.html"))}`);
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

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "run") await cmdRun(rest);
  else if (cmd === "report") cmdReport(rest);
  else {
    console.log(`settle run [--config settle.yml]          build every option with IBM Bob, measure, decide
settle report <run dir> [--set k=v,...]   re-decide a finished run under different constraints`);
    process.exit(cmd ? 1 : 0);
  }
} catch (err) {
  console.error(`settle: ${(err as Error).message}`);
  process.exit(1);
}
