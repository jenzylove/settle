// settle prove: before a team estimates a feature, Bob names the assumptions
// most likely to make the estimate wrong, builds the smallest experiment for
// each in its own worktree, and Settle reruns every experiment itself to
// record what is proven, what is blocked, and what is still unknown.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { parse } from "yaml";
import { runBobPrompt } from "./bob.ts";
import { describeTool } from "./events.ts";
import { addWorktree, commitAll, dirtyFiles, git, headCommit, repoRoot } from "./git.ts";
import { run } from "./measure.ts";
import { renderProof } from "./proof-page.ts";

export interface ProveConfig {
  request: string;
  context?: string;
  app: { install: string; test: string };
  experiment: { command: string; timeout_seconds: number };
  assumptions: number;
  bob: { max_turns: number; timeout_minutes: number };
}

export interface Assumption {
  id: string;
  assumption: string;
  why_risky: string;
  experiment: string;
  plain: string;
}

export type Status = "proven" | "blocked" | "unknown";

export interface Experiment extends Assumption {
  status: Status;
  // Bob's own claim, kept next to Settle's rerun so disagreements show.
  bob_claim?: string;
  bob_evidence?: string;
  // What Settle saw when it reran the experiment itself.
  evidence: string;
  test_file?: string;
  test_code?: string;
  files: string[];
  branch: string;
  bob_seconds: number;
  bob_cost?: number;
  // Existing files the experiment modified, deleted or renamed. Must be empty.
  touched_existing_tests: string[];
}

export interface ProofFile {
  id: string;
  request: string;
  context?: string;
  created_at: string;
  base_commit: string;
  app_path: string;
  experiments: Experiment[];
  plan: string;
  plan_seconds: number;
  summary: { proven: number; blocked: number; unknown: number };
}

export type ProveEvent =
  | { kind: "start"; id: string; request: string; base: string }
  | { kind: "phase"; phase: "plan" | "experiments" | "verify" | "write-plan" | "done" }
  | { kind: "assumptions"; assumptions: Assumption[] }
  | { kind: "bob"; step: string; label: string }
  | { kind: "built"; step: string; seconds: number; ok: boolean }
  | { kind: "verified"; id: string; status: Status; evidence: string }
  | { kind: "plan"; plan: string }
  | { kind: "error"; message: string };

export type StampedProve = ProveEvent & { t: number };

export function parseProveConfig(text: string): ProveConfig {
  const raw = parse(text) ?? {};
  if (!raw.request) throw new Error("settle.yml needs a request: the feature you want to prove is buildable");
  return {
    request: String(raw.request).trim(),
    context: raw.context ? String(raw.context).trim() : undefined,
    app: { install: raw.app?.install ?? "npm install --no-audit --no-fund", test: raw.app?.test ?? "npm test" },
    experiment: {
      command: raw.experiment?.command ?? "node --import tsx --test {file}",
      timeout_seconds: raw.experiment?.timeout_seconds ?? 120,
    },
    assumptions: Math.max(1, Math.min(5, raw.assumptions ?? 3)),
    bob: { max_turns: raw.bob?.max_turns ?? 30, timeout_minutes: raw.bob?.timeout_minutes ?? 15 },
  };
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "a";

function planPrompt(c: ProveConfig, app: string): string {
  return [
    `A team is about to estimate a feature. Before they do, find the assumptions most likely to make their estimate wrong.`,
    ``,
    `Feature request: ${c.request}`,
    c.context ? `Context: ${c.context}` : ``,
    `The application is in: ${app}`,
    ``,
    `Read the code that the feature would touch (schema, queries, API handlers, tests). Then write exactly ${c.assumptions} assumptions the feature silently depends on, the ones where being wrong would add days of work. Prefer assumptions you can prove or disprove by running code against this repository in a few minutes.`,
    ``,
    `Phrase every assumption as something the feature NEEDS to be true for it to be as easy as it looks, never as the risk itself. Good: "Revenue totals can hold IDR sized amounts without overflowing." Bad: "The total will overflow." If the needed thing turns out false in today's code, that is the landmine the team must know about.`,
    ``,
    `Write them as JSON to the file settle-plan.json at the root of the workspace, in this shape:`,
    `[{"id": "short-kebab-id", "assumption": "one sentence the feature needs to be true, that is either true or false for this codebase today", "why_risky": "what breaks or costs days if it is false", "experiment": "the smallest runnable test that proves or disproves it", "plain": "the same assumption in plain words a product manager understands"}]`,
    ``,
    `Rules: do not change any other file. Do not write code yet. Finish with a one line summary.`,
  ].join("\n");
}

function experimentPrompt(c: ProveConfig, a: Assumption, app: string, file: string): string {
  return [
    `You are testing ONE assumption behind a feature request, by experiment, in this repository.`,
    ``,
    `Feature request: ${c.request}`,
    `Assumption to test: ${a.assumption}`,
    `Why it matters: ${a.why_risky}`,
    `Suggested experiment: ${a.experiment}`,
    `The application is in: ${app}`,
    ``,
    `Build the smallest experiment that shows whether the assumption holds in THIS codebase today:`,
    `1. Write exactly one test file at ${file}. It must PASS if the assumption holds and FAIL if it does not. When it fails, the assertion message must show the evidence (the wrong value, the error, the row that leaked).`,
    `2. Exercise the real code (the real database setup, queries and HTTP handlers). Do not mock the thing being tested, and do not change application code to make the assumption true: you are measuring today's code.`,
    `3. You may add small helper files next to the test if needed. Do not modify, rename or delete any existing file.`,
    `4. Run it with: ${c.experiment.command.replace("{file}", file)} (from ${app}). Make sure it exits on its own.`,
    `5. Write ${file.replace(/\.test\.[jt]s$/, ".json")} with {"verdict": "holds" | "broken" | "unknown", "evidence": "one or two sentences with the concrete numbers or error you saw"}.`,
    `Finish with a one line summary.`,
  ].join("\n");
}

function writePlanPrompt(c: ProveConfig, results: Experiment[], app: string): string {
  const lines = results.map((r) => `- [${r.status.toUpperCase()}] ${r.assumption}\n  Evidence: ${r.evidence.split("\n").slice(0, 4).join(" ")}`).join("\n");
  return [
    `A team wants to build this feature: ${c.request}`,
    `The application is in: ${app}`,
    ``,
    `Before estimating, these assumptions were tested by running experiments against the real code:`,
    lines,
    ``,
    `Write an implementation plan to settle-plan.md at the root of the workspace, for engineers and a product manager:`,
    `1. "What we now know": one line per assumption, proven / blocked / unknown, in plain words.`,
    `2. "Landmines to fix first": for each blocked assumption, the concrete change needed and why, citing the files involved.`,
    `3. "Plan": numbered steps to build the feature, ordered so the risky parts are done first.`,
    `4. "Estimate impact": how the blocked findings change the size of the work, honestly, without inventing precise numbers.`,
    `Keep it under 400 words. Do not change any other file.`,
  ].join("\n");
}

// Last lines of a test run that explain a failure: assertion messages and errors.
function evidenceFrom(output: string): string {
  const lines = output.split("\n").map((l) => l.replace(/\r$/, ""));
  const keep = lines.filter((l) => /AssertionError|Error:|expected|actual|✖|not ok|message|out of range|fail/i.test(l)).slice(0, 14);
  return (keep.length ? keep : lines.filter(Boolean).slice(-12)).join("\n").slice(0, 2500);
}

export async function prove(configPath: string, listen: (e: StampedProve) => void): Promise<ProofFile> {
  const config = parseProveConfig(readFileSync(configPath, "utf8"));
  const appDirAbs = dirname(configPath);
  const root = repoRoot(appDirAbs);
  const appRel = relative(root, appDirAbs).split(String.fromCharCode(92)).join("/");
  const dirty = dirtyFiles(root, root).filter((l) => {
    const p = l.slice(3).trim().split(String.fromCharCode(92)).join("/");
    return p !== `${appRel}/settle.yml` && p !== `${appRel}/prove.yml` && !p.endsWith("/prove.yml") && !["runs/", ".settle/", "site/"].some((d) => p.startsWith(d));
  });
  if (dirty.length) throw new Error(`commit your changes first; these would be missing from every experiment:\n${dirty.join("\n")}`);

  const base = headCommit(root);
  const id = `prove-${stamp()}`;
  const runDir = join(root, "runs", id);
  const treeDir = join(root, ".settle", id);
  mkdirSync(runDir, { recursive: true });
  const emit = (e: ProveEvent) => {
    const s = { t: Date.now(), ...e } as StampedProve;
    appendFileSync(join(runDir, "events.jsonl"), JSON.stringify(s) + "\n");
    listen(s);
  };
  emit({ kind: "start", id, request: config.request, base });

  // 1. Bob names the risky assumptions.
  emit({ kind: "phase", phase: "plan" });
  const planTree = join(treeDir, "plan");
  addWorktree(root, planTree, `settle/${id}/plan`, base);
  const planRun = await runBobPrompt(planPrompt(config, appRel || "."), planTree, join(runDir, "bob-plan.log"), config.bob, (call) =>
    emit({ kind: "bob", step: "plan", label: describeTool(call.tool, call.params, planTree) }),
  );
  emit({ kind: "built", step: "plan", seconds: Math.round(planRun.durationMs / 1000), ok: planRun.ok });
  const planFile = join(planTree, "settle-plan.json");
  if (!existsSync(planFile)) throw new Error("Bob did not write settle-plan.json");
  const rawPlan = JSON.parse(readFileSync(planFile, "utf8").replace(/^﻿/, ""));
  const seen = new Set<string>();
  const assumptions: Assumption[] = (Array.isArray(rawPlan) ? rawPlan : rawPlan.assumptions ?? [])
    .slice(0, config.assumptions)
    .map((a: any, i: number) => {
      let aid = slug(a.id ?? `a${i + 1}`);
      while (seen.has(aid)) aid += "-x";
      seen.add(aid);
      return { id: aid, assumption: String(a.assumption ?? ""), why_risky: String(a.why_risky ?? ""), experiment: String(a.experiment ?? ""), plain: String(a.plain ?? a.assumption ?? "") };
    })
    .filter((a: Assumption) => a.assumption);
  if (assumptions.length === 0) throw new Error("Bob's plan had no assumptions");
  emit({ kind: "assumptions", assumptions });

  // 2. One Bob per assumption, in parallel, each in its own worktree.
  emit({ kind: "phase", phase: "experiments" });
  const experiments: Experiment[] = await Promise.all(
    assumptions.map(async (a) => {
      const tree = join(treeDir, a.id);
      const branch = `settle/${id}/${a.id}`;
      addWorktree(root, tree, branch, base);
      const fileRel = `settle-experiments/${a.id}.test.ts`;
      const r = await runBobPrompt(experimentPrompt(config, a, ".", fileRel), join(tree, appRel), join(runDir, `bob-${a.id}.log`), config.bob, (call) =>
        emit({ kind: "bob", step: a.id, label: describeTool(call.tool, call.params, join(tree, appRel)) }),
      );
      commitAll(tree, `settle prove: ${a.id}`);
      const stats = (r.summary as any)?.stats ?? {};
      emit({ kind: "built", step: a.id, seconds: Math.round(r.durationMs / 1000), ok: r.ok });
      const claimFile = join(tree, appRel, fileRel.replace(/\.test\.ts$/, ".json"));
      let claim: any = {};
      try { claim = JSON.parse(readFileSync(claimFile, "utf8").replace(/^﻿/, "")); } catch {}
      const status = git(tree, ["diff", "--name-status", base, "HEAD", "--", appRel || "."]);
      const files: string[] = [];
      const touched: string[] = [];
      for (const line of status.split(String.fromCharCode(10)).filter(Boolean)) {
        const parts = line.split(String.fromCharCode(9));
        files.push(parts[parts.length - 1]);
        // Experiments may only add files. Any change to an existing file, code or
        // test, could manufacture the result, so the experiment is not trusted.
        if (!parts[0].startsWith("A")) touched.push(parts[1]);
      }
      const testAbs = join(tree, appRel, fileRel);
      return {
        ...a,
        status: "unknown" as Status,
        bob_claim: claim.verdict,
        bob_evidence: claim.evidence,
        evidence: "",
        test_file: existsSync(testAbs) ? fileRel : undefined,
        test_code: existsSync(testAbs) ? readFileSync(testAbs, "utf8").slice(0, 6000) : undefined,
        files,
        branch,
        bob_seconds: Math.round(r.durationMs / 1000),
        bob_cost: typeof stats.session_costs === "number" ? Math.round(stats.session_costs * 100) / 100 : undefined,
        touched_existing_tests: touched,
      };
    }),
  );

  // 3. Settle reruns every experiment itself; Bob's own verdict is not trusted.
  emit({ kind: "phase", phase: "verify" });
  for (const x of experiments) {
    const appDir = join(treeDir, x.id, appRel);
    if (!x.test_file) {
      x.status = "unknown";
      x.evidence = "Bob did not produce an experiment file.";
    } else if (x.touched_existing_tests.length) {
      x.status = "unknown";
      x.evidence = `The experiment changed existing files (${x.touched_existing_tests.join(", ")}), so its result cannot be trusted.`;
    } else {
      const install = await run(config.app.install, appDir, 600_000);
      const res = install.code !== 0 ? install : await run(config.experiment.command.replace("{file}", x.test_file), appDir, config.experiment.timeout_seconds * 1000);
      const passed = /[ℹ#] pass (\d+)/.exec(res.output);
      const failed = /[ℹ#] fail (\d+)/.exec(res.output);
      if (res.timedOut) {
        x.status = "unknown";
        x.evidence = `The experiment did not finish within ${config.experiment.timeout_seconds} s.`;
      } else if (res.code === 0 && passed && Number(passed[1]) > 0) {
        x.status = "proven";
        x.evidence = `${passed[1]} check${passed[1] === "1" ? "" : "s"} passed against today's code.`;
      } else if (failed && Number(failed[1]) > 0) {
        x.status = "blocked";
        x.evidence = evidenceFrom(res.output);
      } else {
        x.status = "unknown";
        x.evidence = `The experiment could not run:\n${res.output.split("\n").slice(-8).join("\n")}`;
      }
    }
    emit({ kind: "verified", id: x.id, status: x.status, evidence: x.evidence });
  }

  // 4. Bob writes the plan from what was actually found.
  emit({ kind: "phase", phase: "write-plan" });
  const pr = await runBobPrompt(writePlanPrompt(config, experiments, appRel || "."), planTree, join(runDir, "bob-write-plan.log"), config.bob, (call) =>
    emit({ kind: "bob", step: "write-plan", label: describeTool(call.tool, call.params, planTree) }),
  );
  const planMd = existsSync(join(planTree, "settle-plan.md")) ? readFileSync(join(planTree, "settle-plan.md"), "utf8") : "";
  emit({ kind: "plan", plan: planMd });

  const data: ProofFile = {
    id,
    request: config.request,
    context: config.context,
    created_at: new Date().toISOString(),
    base_commit: base,
    app_path: appRel,
    experiments,
    plan: planMd,
    plan_seconds: Math.round(pr.durationMs / 1000),
    summary: {
      proven: experiments.filter((x) => x.status === "proven").length,
      blocked: experiments.filter((x) => x.status === "blocked").length,
      unknown: experiments.filter((x) => x.status === "unknown").length,
    },
  };
  writeFileSync(join(runDir, "proof.json"), JSON.stringify(data, null, 2));
  writeFileSync(join(runDir, "index.html"), renderProof(data));
  emit({ kind: "phase", phase: "done" });
  return data;
}
