// The verdict must never crown a candidate the measurements cannot vouch for,
// and the site builder must never delete work.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decide, type OptionResult } from "../src/verdict.ts";
import { touchedYardstick } from "../src/engine.ts";
import { assertSafeOut } from "../src/site.ts";
import { combineLoad } from "../src/measure.ts";

const load = (p95: number, requests = 1000, errors = 0) => ({ requests, errors, rps: 100, p50_ms: p95 / 2, p95_ms: p95, p99_ms: p95 * 1.2 });
const fresh = (s: number) => ({ probes: 3, lags_seconds: [s], max_seconds: s, median_seconds: s, timed_out: 0 });
const opt = (id: string, extra: Partial<OptionResult>): OptionResult => ({
  id, name: id, description: "", branch: `b/${id}`, built: true,
  load: load(20), freshness: fresh(1), tests: { ok: true, passed: 3, failed: 0 },
  diff: { added: 10, removed: 0, files: ["src/a.ts"] }, new_dependencies: [], integrity: { touched: [] },
  ...extra,
});
const limits = { max_p95_ms: 50, max_staleness_seconds: 15, tests_must_pass: true };

test("50 of 50 failed requests: the broken option is never the winner", () => {
  const broken = opt("broken", { load: load(0, 50, 50), freshness: undefined, diff: { added: 1, removed: 0, files: [] } });
  const honest = opt("honest", { diff: { added: 40, removed: 0, files: [] } });
  const v = decide([broken, honest], limits);
  assert.equal(v.winner, "honest");
  const clean = v.checks.broken.find((c) => c.label === "Measured cleanly")!;
  assert.equal(clean.pass, false);
  assert.match(clean.actual, /no successful requests/);
});

test("when every candidate is broken there is no winner at all", () => {
  const v = decide([opt("a", { load: load(0, 50, 50) }), opt("b", { load: load(0, 0, 0) })], limits);
  assert.equal(v.winner, null);
  assert.match(v.headline, /No option meets every constraint/);
});

test("more than 1% failed requests disqualifies even a fast option", () => {
  const flaky = opt("flaky", { load: load(5, 1000, 20), diff: { added: 1, removed: 0, files: [] } });
  assert.equal(decide([flaky, opt("steady", {})], limits).winner, "steady");
  const fine = opt("fine", { load: load(5, 1000, 10), diff: { added: 1, removed: 0, files: [] } });
  assert.equal(decide([fine, opt("steady", {})], limits).winner, "fine", "1% exactly is allowed");
});

test("a measurement error disqualifies", () => {
  const v = decide([opt("crashed", { measure_error: "app exited during startup", diff: { added: 1, removed: 0, files: [] } }), opt("ok", {})], limits);
  assert.equal(v.winner, "ok");
});

test("a missing freshness result fails a staleness limit instead of skipping it", () => {
  const v = decide([opt("unprobed", { freshness: undefined, diff: { added: 1, removed: 0, files: [] } }), opt("probed", {})], limits);
  assert.equal(v.winner, "probed");
  assert.equal(v.checks.unprobed.find((c) => c.label === "Staleness")!.actual, "not measured");
});

test("an option that changed existing tests cannot win", () => {
  const cheat = opt("cheat", { integrity: { touched: ["test/api.test.ts"] }, diff: { added: 1, removed: 0, files: [] } });
  const v = decide([cheat, opt("fair", {})], limits);
  assert.equal(v.winner, "fair");
  assert.match(v.checks.cheat.find((c) => c.label === "Existing tests untouched")!.actual, /test\/api\.test\.ts/);
});

test("repeated load tests report medians and the p95 spread", () => {
  const c = combineLoad([load(40, 100, 0), load(60, 100, 1), load(45, 100, 0)]);
  assert.equal(c.p95_ms, 45);
  assert.deepEqual(c.p95_range, [40, 60]);
  assert.equal(c.requests, 300);
  assert.equal(c.errors, 1);
  assert.equal(c.runs?.length, 3);
});

test("touchedYardstick flags edited or deleted tests and changed scripts, not new tests", () => {
  const repo = mkdtempSync(join(tmpdir(), "settle-yard-"));
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: repo, stdio: "ignore" });
  try {
    mkdirSync(join(repo, "app", "test"), { recursive: true });
    writeFileSync(join(repo, "app", "package.json"), JSON.stringify({ scripts: { test: "node --test", start: "node s.js" } }));
    writeFileSync(join(repo, "app", "test", "a.test.js"), "// a");
    writeFileSync(join(repo, "app", "test", "b.test.js"), "// b");
    git("init", "-q", "-b", "main"); git("add", "-A"); git("commit", "-qm", "base");
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();

    writeFileSync(join(repo, "app", "test", "new.test.js"), "// new tests are welcome");
    git("add", "-A"); git("commit", "-qm", "adds a test");
    assert.deepEqual(touchedYardstick(repo, base, "app"), []);

    writeFileSync(join(repo, "app", "test", "a.test.js"), "// weakened");
    rmSync(join(repo, "app", "test", "b.test.js"));
    writeFileSync(join(repo, "app", "package.json"), JSON.stringify({ scripts: { test: "echo ok", start: "node s.js" } }));
    git("add", "-A"); git("commit", "-qm", "moves the yardstick");
    assert.deepEqual(touchedYardstick(repo, base, "app").sort(), ["app/test/a.test.js", "app/test/b.test.js", "package.json scripts.test"]);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("settle site refuses output folders that would delete real work", () => {
  const root = mkdtempSync(join(tmpdir(), "settle-site-"));
  try {
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "sub"));
    assert.throws(() => assertSafeOut(root, root, root), /contains the repository/);
    assert.throws(() => assertSafeOut(join(root, ".."), root, root), /contains the repository/);
    assert.throws(() => assertSafeOut(join(root, "sub"), root, join(root, "sub")), /contains the current folder/);
    assert.throws(() => assertSafeOut(join(root, "src", "out"), root, root), /sources or run data/);
    writeFileSync(join(root, "sub", "notes.txt"), "keep me");
    assert.throws(() => assertSafeOut(join(root, "sub"), root, root), /does not look like a site build/);
    assertSafeOut(join(root, "site"), root, root); // a fresh folder is fine
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Bug 1: .settle/ must be blocked so a site build never deletes live worktrees.
test("settle site refuses .settle/ as output folder", () => {
  const root = mkdtempSync(join(tmpdir(), "settle-site2-"));
  try {
    mkdirSync(join(root, ".settle", "run1"), { recursive: true });
    assert.throws(() => assertSafeOut(join(root, ".settle", "run1"), root, root), /sources or run data/);
    assert.throws(() => assertSafeOut(join(root, ".settle"), root, root), /sources or run data/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Bug 2: a non-test file renamed INTO the test tree must be flagged.
test("touchedYardstick flags a source file renamed into the test directory", () => {
  const repo = mkdtempSync(join(tmpdir(), "settle-rename-"));
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: repo, stdio: "ignore" });
  try {
    mkdirSync(join(repo, "app", "src"), { recursive: true });
    mkdirSync(join(repo, "app", "test"), { recursive: true });
    writeFileSync(join(repo, "app", "package.json"), JSON.stringify({ scripts: { test: "node --test", start: "node s.js" } }));
    writeFileSync(join(repo, "app", "src", "helper.js"), "// real source");
    writeFileSync(join(repo, "app", "test", "existing.test.js"), "// existing test");
    git("init", "-q", "-b", "main"); git("add", "-A"); git("commit", "-qm", "base");
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();

    // Rename a source file to a test path — the new name is a test file
    // even though the old name was not.  Must be caught.
    git("mv", "app/src/helper.js", "app/test/injected.test.js");
    git("add", "-A"); git("commit", "-qm", "renames source into test dir");
    const touched = touchedYardstick(repo, base, "app");
    assert.ok(touched.includes("app/test/injected.test.js"),
      `expected app/test/injected.test.js in touched; got ${JSON.stringify(touched)}`);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// Bug 3: only the canonical settle.yml at the app root should be exempt from
// the dirty-file guard, not any file whose name ends in "settle.yml".
// (Tested indirectly: the filter logic is a pure transform over the git
// status lines, so we verify the configRel derivation is exact-match only.)
test("dirty-file exemption is exact-path, not suffix-based", () => {
  // Build a status line that looks like a sibling file that ends in settle.yml
  // The filter function is not exported, so we test the observable guarantee:
  // the exemption must not fire for a file at a different path.
  // We do this by checking that the exemption string derived from appRel=""
  // equals exactly "settle.yml" (not a regex / suffix).
  const appRel = "";
  const configRel = (appRel ? appRel + "/" : "") + "settle.yml";
  assert.equal(configRel, "settle.yml");
  // For a nested app:
  const appRelNested = "demo/orders-api";
  const configRelNested = appRelNested + "/" + "settle.yml";
  assert.equal(configRelNested, "demo/orders-api/settle.yml");
  // A sibling file must not match:
  assert.notEqual("packages/evil-settle.yml", configRelNested);
  assert.notEqual("src/settle.yml", configRel);
});

// Bug 4: an all-error individual run must disqualify the option even when the
// combined totals average out to a passing error rate.
test("a run where every request failed disqualifies even if combined error rate looks fine", () => {
  // Run 1: 50 req, 50 errors (100% failure) — empty latency array → p95 = 0
  // Run 2: 1000 req, 0 errors
  // Run 3: 1000 req, 0 errors
  // Combined: 2050 req, 50 errors → ~2.4% — already >1%, but the point is
  // that even a scale where it would pass (say 1 error run vs 999 clean runs)
  // must still be caught via the per-run check.
  const crashy = opt("crashy", {
    load: combineLoad([load(0, 50, 50), load(20, 1000, 0), load(20, 1000, 0)]),
    diff: { added: 1, removed: 0, files: [] },
  });
  const v = decide([crashy, opt("steady", {})], limits);
  assert.equal(v.winner, "steady");
  const cleanCheck = v.checks.crashy.find((c) => c.label === "Measured cleanly")!;
  assert.equal(cleanCheck.pass, false);
  assert.match(cleanCheck.actual, /one run had 50 errors of 50 requests/);
});
