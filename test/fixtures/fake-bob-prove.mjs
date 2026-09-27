// Stands in for IBM Bob Shell in the settle prove test: same arguments, same
// stream-json output, and deterministic work chosen from the prompt.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const workspace = args[args.indexOf("--workspace") + 1];
const prompt = args[args.length - 1];
const say = (o) => process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), ...o }) + "\n");
const write = (rel, text) => {
  const file = join(workspace, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  say({ type: "tool_use", tool_name: "write_file", tool_id: rel, parameters: { path: file } });
};

if (prompt.includes("settle-plan.json")) {
  write("settle-plan.json", JSON.stringify([
    { id: "answers-fast", assumption: "The value endpoint answers within one second.", why_risky: "Slow reads would need a cache.", experiment: "Time one request.", plain: "Reading the value is quick." },
    { id: "has-currency", assumption: "The value endpoint already returns a currency field.", why_risky: "Adding it means a schema change.", experiment: "Read the response shape.", plain: "Values already say which currency they are in." },
    { id: "edits-code", assumption: "The server can be changed freely.", why_risky: "Used to prove that edits to existing files are distrusted.", experiment: "Edit server.mjs.", plain: "A deliberately untrustworthy experiment." },
  ]));
} else if (prompt.includes("Assumption to test")) {
  const file = prompt.match(/Write exactly one test file at (\S+)\./)[1];
  const header = `import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { server } from "../server.mjs";\nconst start = () => new Promise((r) => server.listen(0, () => r(server.address().port)));\n`;
  if (file.includes("answers-fast")) {
    write(file, header + `test("answers within a second", async () => { const port = await start(); const t = Date.now(); await (await fetch(\`http://127.0.0.1:\${port}/value\`)).json(); server.close(); assert.ok(Date.now() - t < 1000); });\n`);
    write(file.replace(".test.ts", ".json"), JSON.stringify({ verdict: "holds", evidence: "answered in about 25 ms" }));
  } else if (file.includes("has-currency")) {
    write(file, header + `test("response has a currency", async () => { const port = await start(); const body = await (await fetch(\`http://127.0.0.1:\${port}/value\`)).json(); server.close(); assert.ok("currency" in body, \`no currency field, got keys: \${Object.keys(body).join(", ")}\`); });\n`);
    write(file.replace(".test.ts", ".json"), JSON.stringify({ verdict: "broken", evidence: "response is {value}" }));
  } else {
    write(file, header + `test("passes", () => assert.ok(true));\n`);
    write("server.mjs", "// tampered\n");
    write(file.replace(".test.ts", ".json"), JSON.stringify({ verdict: "holds", evidence: "trust me" }));
  }
} else if (prompt.includes("settle-plan.md")) {
  write("settle-plan.md", "## What we now know\n\n- Fast reads: proven.\n- Currency field: blocked.\n\n## Plan\n\n1. Add the currency field first.\n");
}
say({ type: "result", status: "success", stats: { duration_ms: 20, session_costs: 0, tool_calls: 2 } });
