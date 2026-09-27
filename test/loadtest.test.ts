import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { loadTest } from "../src/measure.ts";
import type { SettleConfig } from "../src/config.ts";

// ---------------------------------------------------------------------------
// Minimal SettleConfig fixture – only the fields loadTest actually reads.
// ---------------------------------------------------------------------------

function makeConfig(port: number): SettleConfig {
  return {
    question: "test",
    app: {
      start: "echo noop",
      port_env: "PORT",
      health: "/",
      ready_timeout_seconds: 5,
    },
    load: {
      request: { method: "GET", path: "/" },
      duration_seconds: 2,
      concurrency: 4,
      warmup_seconds: 0,
    },
    constraints: {},
    options: [
      { id: "a", name: "A", description: "" },
      { id: "b", name: "B", description: "" },
    ],
  } as unknown as SettleConfig;
}

// ---------------------------------------------------------------------------
// Tiny HTTP server that responds in ~5 ms.
// ---------------------------------------------------------------------------

let server: http.Server;
let base: string;

before(async () => {
  server = http.createServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    }, 5);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

after(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    ),
);

// ---------------------------------------------------------------------------
// loadTest assertions
// ---------------------------------------------------------------------------

describe("loadTest against a local HTTP server", () => {
  it("sends at least one request and has zero errors", async () => {
    const config = makeConfig(0);
    const result = await loadTest(base, config);
    assert.ok(result.requests > 0, `expected requests > 0, got ${result.requests}`);
    assert.equal(result.errors, 0);
  });

  it("p50 <= p95 <= p99", async () => {
    const config = makeConfig(0);
    const result = await loadTest(base, config);
    assert.ok(
      result.p50_ms <= result.p95_ms,
      `p50 (${result.p50_ms}) should be <= p95 (${result.p95_ms})`,
    );
    assert.ok(
      result.p95_ms <= result.p99_ms,
      `p95 (${result.p95_ms}) should be <= p99 (${result.p99_ms})`,
    );
  });
});
