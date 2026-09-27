// Runs the whole settle prove pipeline (plan, parallel experiments, Settle's
// own rerun, plan writing, evidence page) on the fixture app, with a stand in
// for Bob Shell so it is free and repeatable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prove, type StampedProve } from "../src/prove.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("settle prove sorts assumptions into proven, blocked and untrusted", { timeout: 180_000 }, async () => {
  const repo = mkdtempSync(join(tmpdir(), "settle-prove-"));
  try {
    cpSync(join(fixtures, "app"), join(repo, "app"), { recursive: true });
    const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: repo, stdio: "ignore" });
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-qm", "fixture");

    process.env.SETTLE_BOB_JS = join(fixtures, "fake-bob-prove.mjs");
    const events: StampedProve[] = [];
    const proof = await prove(join(repo, "app", "prove.yml"), (e) => events.push(e));
    const by = Object.fromEntries(proof.experiments.map((x) => [x.id, x]));

    assert.equal(by["answers-fast"].status, "proven", by["answers-fast"].evidence);
    assert.equal(by["has-currency"].status, "blocked");
    assert.match(by["has-currency"].evidence, /no currency field/, "the failing assertion is the evidence");
    assert.equal(by["edits-code"].status, "unknown", "an experiment that changes an existing file is not trusted");
    assert.match(by["edits-code"].evidence, /changed existing files/);
    assert.equal(by["edits-code"].bob_claim, "holds", "even though Bob claimed it holds");
    assert.deepEqual(proof.summary, { proven: 1, blocked: 1, unknown: 1 });
    assert.match(proof.plan, /Add the currency field first/);

    const dir = join(repo, "runs", proof.id);
    for (const f of ["proof.json", "index.html", "events.jsonl", "bob-plan.log", "bob-write-plan.log"]) assert.ok(existsSync(join(dir, f)), `${f} written`);
    assert.match(readFileSync(join(dir, "index.html"), "utf8"), /blocked, landmines found/);
    const kinds = new Set(events.map((e) => e.kind));
    for (const k of ["start", "assumptions", "built", "verified", "plan"]) assert.ok(kinds.has(k as StampedProve["kind"]), `emitted ${k}`);
  } finally {
    delete process.env.SETTLE_BOB_JS;
    try { execFileSync("git", ["worktree", "prune"], { cwd: repo, stdio: "ignore" }); } catch {}
    rmSync(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
});
