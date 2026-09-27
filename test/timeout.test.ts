import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "../src/measure.ts";

test("a command that never exits is stopped and counted as failed", { timeout: 20_000 }, async () => {
  const started = Date.now();
  const r = await run(`node -e "setInterval(() => {}, 1000)"`, process.cwd(), 1500);
  assert.equal(r.timedOut, true);
  assert.equal(r.code, 124);
  assert.match(r.output, /stopped after 2 s without exiting/);
  assert.ok(Date.now() - started < 10_000, "returned promptly after the timeout");
});

test("a command that exits normally is untouched", async () => {
  const r = await run(`node -e "console.log('hi')"`, process.cwd(), 10_000);
  assert.deepEqual([r.code, r.timedOut, r.output.trim()], [0, false, "hi"]);
});
