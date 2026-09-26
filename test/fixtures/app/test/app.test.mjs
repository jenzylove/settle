import { test } from "node:test";
import assert from "node:assert/strict";
import { server } from "../server.mjs";

test("value endpoint answers", async () => {
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/value`);
  assert.equal(res.status, 200);
  assert.equal(typeof (await res.json()).value, "number");
  server.close();
});
