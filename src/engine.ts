import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { runBob } from "./bob.ts";
import { loadConfig, type Constraints, type Option, type SettleConfig } from "./config.ts";
import { describeTool, type Listener, type RunEvent, type Stamped } from "./events.ts";
import { addWorktree, commitAll, diffStats, dirtyFiles, headCommit, repoRoot, showFile } from "./git.ts";
import { freshnessTest, loadTest, newDependencies, run, runTests, startApp } from "./measure.ts";
import { renderAppendix, renderReport } from "./report.ts";
import { decide, type OptionResult, type Verdict } from "./verdict.ts";

export interface RunFile {
  id?: string;
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

export interface RunOptions {
  baselineOnly?: boolean;
  // Where runs/ and .settle/ live; defaults to the repository root.
  outRoot?: string;
  // First port for the apps under test; each measured option takes the next.
  port?: number;
}

export function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function writeRun(runDir: string, data: RunFile) {
  writeFileSync(join(runDir, "results.json"), JSON.stringify(data, null, 2));
  writeFileSync(join(runDir, "index.html"), renderReport(data));
  writeFileSync(join(runDir, "appendix.md"), renderAppendix(data));
}

function blankResult(o: Option, branch: string): OptionResult {
  return { id: o.id, name: o.name, description: o.description, branch, built: false };
}

export interface Prepared {
  config: SettleConfig;
  root: string;
  appRel: string;
  base: string;
  id: string;
  runDir: string;
  treeDir: string;
}

// Validates everything that can fail before a single Bobcoin is spent.
export function prepareRun(configPath: string, opts: RunOptions = {}): Prepared {
  if (!existsSync(configPath)) throw new Error(`no settle.yml at ${configPath}`);
  const config = loadConfig(configPath);
  const appDirAbs = dirname(configPath);
  const root = repoRoot(appDirAbs);
  const appRel = relative(root, appDirAbs);
  const dirty = dirtyFiles(root, appDirAbs);
  if (dirty.length) throw new Error(`commit your changes first; these would be missing from every option:\n${dirty.join("\n")}`);
  const id = stamp();
  const out = opts.outRoot ?? root;
  return { config, root, appRel, base: headCommit(root), id, runDir: join(out, "runs", id), treeDir: join(out, ".settle", id) };
}

export async function executeRun(p: Prepared, opts: RunOptions, listen: Listener): Promise<RunFile> {
  const { config, root, appRel, base, id, runDir, treeDir } = p;
  mkdirSync(runDir, { recursive: true });
  const eventsFile = join(runDir, "events.jsonl");
  const emit = (e: RunEvent) => {
    const stamped = { t: Date.now(), ...e } as Stamped;
    appendFileSync(eventsFile, JSON.stringify(stamped) + "\n");
    listen(stamped);
  };

  const baselineOnly = !!opts.baselineOnly;
  const results = baselineOnly ? [] : config.options.map((o) => blankResult(o, `settle/${id}/${o.id}`));
  emit({ kind: "start", id, question: config.question, base, options: results.map(({ id, name, description }) => ({ id, name, description })) });

  const baseline = blankResult({ id: "baseline", name: "Today (no change)", description: "The code as it is now." }, `settle/${id}/baseline`);
  addWorktree(root, join(treeDir, "baseline"), baseline.branch, base);
  baseline.built = true;
  for (const r of results) addWorktree(root, join(treeDir, r.id), r.branch, base);

  emit({ kind: "phase", phase: "build" });
  await Promise.all(
    results.map(async (r, i) => {
      const tree = join(treeDir, r.id);
      const bob = await runBob(config, config.options[i], tree, appRel || ".", join(runDir, `bob-${r.id}.log`), (call) =>
        emit({ kind: "bob", option: r.id, tool: call.tool, label: describeTool(call.tool, call.params, tree) }),
      );
      const stats = (bob.summary as any)?.stats ?? {};
      r.bob = { duration_seconds: Math.round(bob.durationMs / 1000), summary: bob.summary };
      const changed = commitAll(tree, `settle: ${r.name}`);
      r.built = bob.ok && changed;
      if (!bob.ok) r.build_error = bob.timedOut ? "Bob timed out" : bob.error;
      else if (!changed) r.build_error = "Bob finished without changing any files";
      emit({
        kind: "built",
        option: r.id,
        ok: r.built,
        error: r.build_error,
        seconds: r.bob.duration_seconds,
        tool_calls: stats.tool_calls,
        cost: typeof stats.session_costs === "number" ? Math.round(stats.session_costs * 100) / 100 : undefined,
      });
    }),
  );

  // Measure one at a time so options do not compete for CPU.
  emit({ kind: "phase", phase: "measure" });
  let port = opts.port ?? 4310;
  const measure = async (r: OptionResult) => {
    await measureOption(config, r, join(treeDir, r.id), appRel, base, port++, emit);
    emit({
      kind: "measured",
      option: r.id,
      load: r.load,
      freshness: r.freshness,
      tests: r.tests,
      lines: r.diff ? { added: r.diff.added, removed: r.diff.removed } : undefined,
      error: r.measure_error,
    });
  };
  await measure(baseline);
  for (const r of results) if (r.built) await measure(r);

  const data: RunFile = {
    id,
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
  emit({ kind: "verdict", verdict: data.verdict });
  emit({ kind: "phase", phase: "done" });
  return data;
}

async function measureOption(
  config: SettleConfig,
  result: OptionResult,
  worktree: string,
  appRel: string,
  base: string,
  port: number,
  emit: (e: RunEvent) => void,
): Promise<void> {
  const appDir = join(worktree, appRel);
  result.diff = diffStats(worktree, base, appRel);
  const pkg = appRel ? `${appRel.replace(/\\/g, "/")}/package.json` : "package.json";
  result.new_dependencies = newDependencies(showFile(worktree, base, pkg), showFile(worktree, "HEAD", pkg));

  emit({ kind: "measure", option: result.id, step: "install" });
  const install = await run(config.app.install, appDir);
  if (install.code !== 0) {
    result.measure_error = `install failed:\n${install.output.slice(-1500)}`;
    return;
  }

  emit({ kind: "measure", option: result.id, step: "tests" });
  const tests = await runTests(config.app.test, appDir);
  result.tests = { ok: tests.ok, passed: tests.passed, failed: tests.failed };

  emit({ kind: "measure", option: result.id, step: "start" });
  let app;
  try {
    app = await startApp(config, appDir, port);
  } catch (err) {
    result.measure_error = (err as Error).message;
    return;
  }
  try {
    emit({ kind: "measure", option: result.id, step: "load" });
    result.load = await loadTest(app.base, config);
    if (config.freshness) {
      emit({ kind: "measure", option: result.id, step: "freshness" });
      result.freshness = await freshnessTest(app.base, config.freshness);
    }
  } catch (err) {
    result.measure_error = (err as Error).message;
  } finally {
    await app.stop();
  }
}
