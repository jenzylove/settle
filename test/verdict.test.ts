import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decide, checksFor, type OptionResult } from "../src/verdict.ts";
import { parseConfig } from "../src/config.ts";
import type { Constraints } from "../src/config.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOption(
  id: string,
  p95_ms: number,
  diffLines: number,
  staleness_seconds?: number,
): OptionResult {
  return {
    id,
    name: id,
    description: "",
    branch: `branch-${id}`,
    built: true,
    load: { requests: 100, errors: 0, rps: 100, p50_ms: p95_ms, p95_ms, p99_ms: p95_ms },
    diff: { added: diffLines, removed: 0, files: [] },
    freshness:
      staleness_seconds !== undefined
        ? {
            probes: 3,
            lags_seconds: [staleness_seconds],
            max_seconds: staleness_seconds,
            median_seconds: staleness_seconds,
            timed_out: 0,
          }
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// 1. The smallest change wins when several options meet every constraint.
// ---------------------------------------------------------------------------

describe("smallest change wins", () => {
  it("picks the option with fewer diff lines", () => {
    const constraints: Constraints = { max_p95_ms: 200 };
    const small = makeOption("small", 100, 10);
    const large = makeOption("large", 80, 50);
    const verdict = decide([small, large], constraints);
    assert.equal(verdict.winner, "small");
  });

  it("falls back to lower p95 when diff sizes are equal", () => {
    const constraints: Constraints = { max_p95_ms: 200 };
    const fast = makeOption("fast", 80, 20);
    const slow = makeOption("slow", 150, 20);
    const verdict = decide([fast, slow], constraints);
    assert.equal(verdict.winner, "fast");
  });
});

// ---------------------------------------------------------------------------
// 2. A stale option is never picked, even if it is fastest.
// ---------------------------------------------------------------------------

describe("staleness disqualifies", () => {
  it("rejects the fastest option when it exceeds max_staleness_seconds", () => {
    const constraints: Constraints = { max_p95_ms: 500, max_staleness_seconds: 10 };
    // fastest but stale
    const stale = makeOption("stale", 50, 5, 30);
    // slower but fresh
    const fresh = makeOption("fresh", 200, 20, 5);
    const verdict = decide([stale, fresh], constraints);
    assert.equal(verdict.winner, "fresh");
    assert.notEqual(verdict.winner, "stale");
  });

  it("marks the staleness check as failing for the stale option", () => {
    const constraints: Constraints = { max_staleness_seconds: 10 };
    const stale = makeOption("stale", 100, 5, 30);
    const checks = checksFor(stale, constraints);
    const staleCheck = checks.find((c) => c.label === "Staleness");
    assert.ok(staleCheck, "Staleness check should exist");
    assert.equal(staleCheck!.pass, false);
  });
});

// ---------------------------------------------------------------------------
// 3. When no option qualifies, winner is null and the closest is named.
// ---------------------------------------------------------------------------

describe("no qualifying option", () => {
  it("returns winner=null and names the closest option", () => {
    const constraints: Constraints = { max_p95_ms: 50 };
    // both too slow; option-b is closer (fewer failures & smaller diff)
    const a = makeOption("option-a", 200, 100);
    const b = makeOption("option-b", 80, 10);
    const verdict = decide([a, b], constraints);
    assert.equal(verdict.winner, null);
    assert.ok(
      verdict.reason.includes("option-b"),
      `reason should mention option-b; got: "${verdict.reason}"`,
    );
  });

  it("headline says no option meets every constraint", () => {
    const constraints: Constraints = { max_p95_ms: 1 };
    const a = makeOption("a", 999, 10);
    const b = makeOption("b", 888, 20);
    const verdict = decide([a, b], constraints);
    assert.equal(verdict.headline, "No option meets every constraint.");
  });
});

// ---------------------------------------------------------------------------
// 4. Raising max_staleness_seconds from 10 → 60 changes the winner.
// ---------------------------------------------------------------------------

describe("changing max_staleness_seconds changes the winner", () => {
  it("cache wins at 60 s but loses at 10 s", () => {
    // "cache" has the smallest diff and is fast, but its staleness is 30 s.
    // Under the strict 10 s limit it fails; under 60 s it passes and wins.
    const cache = makeOption("cache", 60, 5, 30);
    const nocache = makeOption("nocache", 120, 40, 2);

    const strict = decide([cache, nocache], { max_staleness_seconds: 10 });
    assert.equal(strict.winner, "nocache", "strict: cache should be disqualified");

    const relaxed = decide([cache, nocache], { max_staleness_seconds: 60 });
    assert.equal(relaxed.winner, "cache", "relaxed: cache should win (smallest diff)");
  });
});

// ---------------------------------------------------------------------------
// 5. parseConfig validation.
// ---------------------------------------------------------------------------

function minimalYaml(options: string): string {
  return `
question: "Which is better?"
app:
  start: node index.js
load:
  request:
    method: GET
    path: /
constraints: {}
${options}
`.trim();
}

describe("parseConfig validation", () => {
  it("rejects fewer than two options", () => {
    const yaml = minimalYaml(`options:\n  - id: only\n    name: Only\n    description: d`);
    assert.throws(() => parseConfig(yaml), /at least two options/);
  });

  it("rejects duplicate option ids", () => {
    const yaml = minimalYaml(`options:
  - id: dup
    name: A
    description: d
  - id: dup
    name: B
    description: d`);
    assert.throws(() => parseConfig(yaml), /unique/);
  });

  it("rejects ids with spaces", () => {
    const yaml = minimalYaml(`options:
  - id: has space
    name: A
    description: d
  - id: other
    name: B
    description: d`);
    assert.throws(() => parseConfig(yaml), /must be lowercase/);
  });

  it("accepts valid configs without throwing", () => {
    const yaml = minimalYaml(`options:
  - id: opt-a
    name: Option A
    description: first
  - id: opt-b
    name: Option B
    description: second`);
    assert.doesNotThrow(() => parseConfig(yaml));
  });
});
