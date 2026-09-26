import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDebate, writeDebate } from "../src/ui.ts";
import { renderReport } from "../src/report.ts";
import { appPage } from "../src/app/page.ts";

const YML = `question: Old question?
# how the app starts
app:
  start: npm start
load:
  request: { method: GET, path: /x }
constraints:
  max_p95_ms: 50
options:
  - { id: a, name: A, description: first }
  - { id: b, name: B, description: second }
`;

test("the app edits the debate and keeps the rest of settle.yml", () => {
  const dir = mkdtempSync(join(tmpdir(), "settle-ui-"));
  const file = join(dir, "settle.yml");
  try {
    writeFileSync(file, YML);
    const d = readDebate(file);
    assert.equal(d.question, "Old question?");
    writeDebate(file, {
      question: "New question?",
      options: [...d.options, { id: "c", name: "C", description: "third" }],
      constraints: { max_p95_ms: 20, max_staleness_seconds: 5, tests_must_pass: true },
    });
    const text = readFileSync(file, "utf8");
    assert.match(text, /# how the app starts/, "comments survive");
    assert.match(text, /start: npm start/, "app section untouched");
    const after = readDebate(file);
    assert.equal(after.question, "New question?");
    assert.deepEqual(after.options.map((o) => o.id), ["a", "b", "c"]);
    assert.deepEqual(after.constraints, { max_p95_ms: 20, max_staleness_seconds: 5, tests_must_pass: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the app refuses to save a debate settle run would reject", () => {
  const dir = mkdtempSync(join(tmpdir(), "settle-ui-"));
  const file = join(dir, "settle.yml");
  try {
    writeFileSync(file, YML);
    assert.throws(() => writeDebate(file, { question: "Q?", options: [{ id: "a", name: "A", description: "only one" }], constraints: {} }), /at least two options/);
    assert.equal(readFileSync(file, "utf8"), YML, "file unchanged");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pages embed their data safely", () => {
  const run = {
    question: "</script><script>alert(1)</script>?",
    created_at: "2026-09-27T00:00:00.000Z",
    base_commit: "abcdef0",
    app_path: "app",
    constraints: {},
    load: { request: { method: "GET" as const, path: "/" }, duration_seconds: 1, concurrency: 1, warmup_seconds: 0 },
    baseline: { id: "baseline", name: "Today", description: "", branch: "b", built: true },
    options: [],
    verdict: { winner: null, headline: "No option meets every constraint.", reason: "", checks: {} },
  };
  const html = renderReport(run);
  assert.ok(!html.includes("</script><script>alert(1)"), "question cannot break out of the page");
  assert.match(appPage({ mode: "static", script: "" }), /data-mode="static"/);
});
