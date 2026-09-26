import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { openDb } from "../src/db.ts";
import { buildServer } from "../src/server.ts";

let server: Server;
let base: string;

before(async () => {
  server = buildServer(await openDb());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

test("health responds", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
});

test("top customers are sorted by revenue and respect the limit", async () => {
  const res = await fetch(`${base}/stats/top-customers?limit=5`);
  assert.equal(res.status, 200);
  const rows = await res.json();
  assert.equal(rows.length, 5);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].revenue_cents >= rows[i].revenue_cents);
  }
  for (const row of rows) {
    assert.equal(typeof row.customer_id, "number");
    assert.equal(typeof row.name, "string");
    assert.ok(row.orders > 0);
  }
});

test("creating an order validates input", async () => {
  const bad = await fetch(`${base}/orders`, {
    method: "POST",
    body: JSON.stringify({ customer_id: 1, amount_cents: -5 }),
  });
  assert.equal(bad.status, 400);

  const good = await fetch(`${base}/orders`, {
    method: "POST",
    body: JSON.stringify({ customer_id: 1, amount_cents: 1200 }),
  });
  assert.equal(good.status, 201);
});
