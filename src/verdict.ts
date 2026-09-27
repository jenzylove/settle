import type { Constraints } from "./config.ts";
import type { FreshnessResult, LoadResult, TestResult } from "./measure.ts";

export interface OptionResult {
  id: string;
  name: string;
  description: string;
  branch: string;
  built: boolean;
  build_error?: string;
  bob?: {
    duration_seconds: number;
    summary: Record<string, unknown> | null;
  };
  load?: LoadResult;
  freshness?: FreshnessResult;
  tests?: TestResult;
  diff?: { added: number; removed: number; files: string[]; test_added?: number; test_files?: string[]; patch?: string };
  new_dependencies?: string[];
  measure_error?: string;
  // Existing test files the option modified or deleted, and test/start
  // scripts it changed. Anything here means the yardstick moved.
  integrity?: { touched: string[] };
}

export interface Check {
  label: string;
  limit: string;
  actual: string;
  pass: boolean;
}

export interface Verdict {
  winner: string | null;
  headline: string;
  reason: string;
  checks: Record<string, Check[]>;
}

export function checksFor(r: OptionResult, c: Constraints): Check[] {
  const checks: Check[] = [];
  if (!r.built || !r.load) {
    checks.push({ label: "Built and measured", limit: "yes", actual: "no", pass: false });
    return checks;
  }
  // A candidate that errors is never "fast": latency only counts successful
  // requests, so failures must disqualify on their own.
  const ok = r.load.requests - r.load.errors;
  const errorRate = r.load.requests > 0 ? r.load.errors / r.load.requests : 1;
  checks.push({
    label: "Measured cleanly",
    limit: "no errors, ≤ 1% failed requests",
    actual: r.measure_error ? "measurement failed" : ok <= 0 ? "no successful requests" : `${r.load.errors} of ${r.load.requests} failed`,
    pass: !r.measure_error && ok > 0 && errorRate <= 0.01,
  });
  checks.push({
    label: "Existing tests untouched",
    limit: "unchanged",
    actual: r.integrity?.touched.length ? `changed ${r.integrity.touched.join(", ")}` : "unchanged",
    pass: !r.integrity?.touched.length,
  });
  if (c.max_p95_ms !== undefined) {
    checks.push({
      label: "p95 latency",
      limit: `≤ ${c.max_p95_ms} ms`,
      actual: `${r.load.p95_ms} ms`,
      pass: r.load.p95_ms <= c.max_p95_ms,
    });
  }
  if (c.max_staleness_seconds !== undefined) {
    const f = r.freshness;
    checks.push({
      label: "Staleness",
      limit: `≤ ${c.max_staleness_seconds} s`,
      actual: !f ? "not measured" : f.timed_out > 0 ? `over ${f.max_seconds} s` : `${f.max_seconds} s`,
      pass: !!f && f.timed_out === 0 && f.max_seconds <= c.max_staleness_seconds,
    });
  }
  if (c.max_new_dependencies !== undefined) {
    const n = r.new_dependencies?.length ?? 0;
    checks.push({ label: "New dependencies", limit: `≤ ${c.max_new_dependencies}`, actual: String(n), pass: n <= c.max_new_dependencies });
  }
  if (c.tests_must_pass) {
    checks.push({ label: "Tests", limit: "pass", actual: r.tests?.ok ? "pass" : "fail", pass: !!r.tests?.ok });
  }
  return checks;
}

const size = (r: OptionResult) => (r.diff ? r.diff.added + r.diff.removed : Infinity);

// Among options that meet every constraint, the smallest change wins: the
// constraints already say what "good enough" means, so anything beyond them
// is paid for in code the team has to own. Ties go to lower p95.
export function decide(results: OptionResult[], c: Constraints): Verdict {
  const checks: Record<string, Check[]> = {};
  for (const r of results) checks[r.id] = checksFor(r, c);
  const failures = (r: OptionResult) => checks[r.id].filter((x) => !x.pass).length;
  const byCost = (a: OptionResult, b: OptionResult) =>
    size(a) - size(b) || (a.new_dependencies?.length ?? 0) - (b.new_dependencies?.length ?? 0) || (a.load?.p95_ms ?? Infinity) - (b.load?.p95_ms ?? Infinity);

  const eligible = results.filter((r) => failures(r) === 0).sort(byCost);
  if (eligible.length > 0) {
    const w = eligible[0];
    const others = results.filter((r) => r.id !== w.id);
    const why = others
      .map((r) => {
        const failed = checks[r.id].filter((x) => !x.pass);
        if (failed.length) return `${r.name} fails ${failed.map((f) => `${f.label.toLowerCase()} (${f.actual}, needs ${f.limit})`).join(" and ")}`;
        return `${r.name} also qualifies but changes ${size(r)} lines against ${size(w)}`;
      })
      .join("; ");
    return {
      winner: w.id,
      headline: `${w.name} meets every constraint with the smallest change.`,
      reason: `${w.name}: p95 ${w.load!.p95_ms} ms, ${size(w)} lines of code changed, ${w.new_dependencies?.length ?? 0} new dependencies. ${why}.`,
      checks,
    };
  }

  const closest = [...results].sort((a, b) => failures(a) - failures(b) || byCost(a, b))[0];
  return {
    winner: null,
    headline: "No option meets every constraint.",
    reason: closest
      ? `Closest is ${closest.name}, which misses ${checks[closest.id].filter((x) => !x.pass).map((x) => x.label.toLowerCase()).join(" and ")}. Relax a constraint or add an option.`
      : "Nothing was built.",
    checks,
  };
}
