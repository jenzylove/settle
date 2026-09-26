// Runs the whole pipeline (worktrees, parallel builds, install, tests, load
// test, freshness probe, verdict, report, event log) on a tiny fixture app,
// with a stand in for Bob Shell so it is free and repeatable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { executeRun, prepareRun } from "../src/engine.ts";
import type { Stamped } from "../src/events.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("settle run builds, measures and decides end to end", { timeout: 240_000 }, async () => {
  const repo = mkdtempSync(join(tmpdir(), "settle-e2e-"));
  try {
    cpSync(join(fixtures, "app"), join(repo, "app"), { recursive: true });
    const git = (...a: string[]) => execFileSync("git", a, { cwd: repo, stdio: "ignore" });
    git("init", "-q", "-b", "main");
    git("-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "fixture");

    process.env.SETTLE_BOB_JS = join(fixtures, "fake-bob.mjs");
    const events: Stamped[] = [];
    const prepared = prepareRun(join(repo, "app", "settle.yml"));
    const run = await executeRun(prepared, { port: 4710 }, (e) => events.push(e));

    // Both options were built by the stand in and committed on their branches.
    assert.deepEqual(run.options.map((o) => [o.id, o.built]), [["fast", true], ["note", true]]);
    for (const o of run.options) {
      assert.ok(o.diff && o.diff.added > 0, `${o.id} changed code`);
      assert.equal(o.tests?.ok, true, `${o.id} tests pass`);
      assert.ok(o.load && o.load.requests > 0 && o.load.errors === 0, `${o.id} was load tested`);
      assert.equal(o.freshness?.timed_out, 0, `${o.id} writes become visible`);
    }

    // Removing the delay is measurably faster, so it is the only option under the limit.
    const [fast, note] = run.options;
    assert.ok(fast.load!.p95_ms < note.load!.p95_ms, `fast p95 ${fast.load!.p95_ms} < note p95 ${note.load!.p95_ms}`);
    assert.equal(run.verdict.winner, "fast");

    // The run left its evidence behind.
    for (const f of ["results.json", "index.html", "appendix.md", "events.jsonl", "bob-fast.log", "bob-note.log"]) {
      assert.ok(existsSync(join(prepared.runDir, f)), `${f} written`);
    }
    const kinds = new Set(events.map((e) => e.kind));
    for (const k of ["start", "bob", "built", "measure", "measured", "verdict"]) assert.ok(kinds.has(k as Stamped["kind"]), `emitted ${k}`);
    const logged = readFileSync(join(prepared.runDir, "events.jsonl"), "utf8").trim().split("\n");
    assert.equal(logged.length, events.length, "every event is in events.jsonl");
    assert.match(readFileSync(join(prepared.runDir, "index.html"), "utf8"), /Remove the delay meets every constraint/);
  } finally {
    delete process.env.SETTLE_BOB_JS;
    try {
      execFileSync("git", ["worktree", "prune"], { cwd: repo, stdio: "ignore" });
    } catch {}
    rmSync(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
});

test("a dirty working tree is refused before anything is spent", () => {
  const repo = mkdtempSync(join(tmpdir(), "settle-dirty-"));
  try {
    cpSync(join(fixtures, "app"), join(repo, "app"), { recursive: true });
    const git = (...a: string[]) => execFileSync("git", a, { cwd: repo, stdio: "ignore" });
    git("init", "-q", "-b", "main");
    git("-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "fixture");
    cpSync(join(repo, "app", "server.mjs"), join(repo, "app", "extra.mjs"));
    assert.throws(() => prepareRun(join(repo, "app", "settle.yml")), /commit your changes first/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
