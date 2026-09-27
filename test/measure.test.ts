import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderBody, readPath, newDependencies } from "../src/measure.ts";
import { isTestFile } from "../src/git.ts";

// ---------------------------------------------------------------------------
// renderBody
// ---------------------------------------------------------------------------

describe("renderBody", () => {
  it("{{random A B}} produces a value within [A, B]", () => {
    for (let i = 0; i < 50; i++) {
      const result = renderBody({ n: "{{random 5 10}}" }, 0);
      const n = result.n as number;
      assert.ok(n >= 5 && n <= 10, `expected 5–10, got ${n}`);
    }
  });

  it("{{random A B}} is always an integer", () => {
    for (let i = 0; i < 20; i++) {
      const result = renderBody({ x: "{{random 0 1000}}" }, 0);
      assert.equal(result.x, Math.floor(result.x as number));
    }
  });

  it("{{increasing}} grows strictly with each probe number", () => {
    const values = [0, 1, 2, 3].map((probe) => renderBody({ v: "{{increasing}}" }, probe).v as number);
    for (let i = 1; i < values.length; i++) {
      assert.ok(values[i] > values[i - 1], `probe ${i} (${values[i]}) should exceed probe ${i - 1} (${values[i - 1]})`);
    }
  });

  it("{{increasing}} at probe 0 equals 100_000_000", () => {
    const result = renderBody({ v: "{{increasing}}" }, 0);
    assert.equal(result.v, 100_000_000);
  });

  it("plain string values pass through unchanged", () => {
    const result = renderBody({ greeting: "hello", flag: "{{unknown}}" }, 0);
    assert.equal(result.greeting, "hello");
    assert.equal(result.flag, "{{unknown}}");
  });

  it("non-string values (number, boolean, object) are untouched", () => {
    const template = { count: 42, active: true, meta: { a: 1 } };
    const result = renderBody(template as Record<string, unknown>, 0);
    assert.equal(result.count, 42);
    assert.equal(result.active, true);
    assert.deepEqual(result.meta, { a: 1 });
  });

  it("returns empty object for undefined template", () => {
    assert.deepEqual(renderBody(undefined, 0), {});
  });
});

// ---------------------------------------------------------------------------
// readPath
// ---------------------------------------------------------------------------

describe("readPath", () => {
  it("reads a top-level key", () => {
    assert.equal(readPath({ a: 1 }, "a"), 1);
  });

  it("reads a nested key with dot notation", () => {
    assert.equal(readPath({ a: { b: { c: 42 } } }, "a.b.c"), 42);
  });

  it("reads array elements by numeric index", () => {
    assert.equal(readPath({ items: ["x", "y", "z"] }, "items.1"), "y");
  });

  it("reads nested objects inside arrays", () => {
    assert.equal(readPath({ list: [{ val: 7 }] }, "list.0.val"), 7);
  });

  it("returns undefined for a missing top-level key", () => {
    assert.equal(readPath({ a: 1 }, "b"), undefined);
  });

  it("returns undefined for a missing nested key", () => {
    assert.equal(readPath({ a: { b: 2 } }, "a.c.d"), undefined);
  });

  it("returns undefined when traversing through null", () => {
    assert.equal(readPath({ a: null }, "a.b"), undefined);
  });
});

// ---------------------------------------------------------------------------
// newDependencies
// ---------------------------------------------------------------------------

describe("newDependencies", () => {
  const pkg = (deps: Record<string, string>, devDeps: Record<string, string> = {}) =>
    JSON.stringify({ dependencies: deps, devDependencies: devDeps });

  it("detects added dependencies", () => {
    const base = pkg({ lodash: "4.0.0" });
    const head = pkg({ lodash: "4.0.0", axios: "1.0.0" });
    assert.deepEqual(newDependencies(base, head), ["axios"]);
  });

  it("detects added devDependencies", () => {
    const base = pkg({}, { jest: "29.0.0" });
    const head = pkg({}, { jest: "29.0.0", vitest: "1.0.0" });
    assert.deepEqual(newDependencies(base, head), ["vitest"]);
  });

  it("ignores removed dependencies (only additions matter)", () => {
    const base = pkg({ removed: "1.0.0", kept: "2.0.0" });
    const head = pkg({ kept: "2.0.0" });
    assert.deepEqual(newDependencies(base, head), []);
  });

  it("handles a null base (first commit scenario)", () => {
    const head = pkg({ express: "4.0.0" }, { typescript: "5.0.0" });
    const result = newDependencies(null, head);
    assert.ok(result.includes("express"));
    assert.ok(result.includes("typescript"));
  });

  it("returns empty array when nothing changed", () => {
    const p = pkg({ a: "1" }, { b: "2" });
    assert.deepEqual(newDependencies(p, p), []);
  });
});

// ---------------------------------------------------------------------------
// isTestFile
// ---------------------------------------------------------------------------

describe("isTestFile", () => {
  it("matches files under test/", () => {
    assert.ok(isTestFile("test/foo.ts"));
  });

  it("matches files under tests/", () => {
    assert.ok(isTestFile("tests/bar.ts"));
  });

  it("matches files under __tests__/", () => {
    assert.ok(isTestFile("__tests__/baz.ts"));
  });

  it("matches *.test.ts", () => {
    assert.ok(isTestFile("src/utils.test.ts"));
  });

  it("matches *.spec.js", () => {
    assert.ok(isTestFile("src/utils.spec.js"));
  });

  it("does not match a regular source file", () => {
    assert.ok(!isTestFile("src/server.ts"));
  });

  it("matches test/ anywhere in a deeper path", () => {
    assert.ok(isTestFile("packages/core/test/helper.ts"));
  });
});
