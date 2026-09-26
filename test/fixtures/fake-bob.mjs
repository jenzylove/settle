// Stands in for IBM Bob Shell in tests: same arguments, same stream-json
// output, and a small deterministic code change chosen from the prompt.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const workspace = args[args.indexOf("--workspace") + 1];
const prompt = args[args.length - 1];
const app = join(workspace, prompt.match(/The application is in: (.+)/)[1].trim());
const file = join(app, "server.mjs");
const say = (o) => process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), ...o }) + "\n");

say({ type: "tool_use", tool_name: "read_file", tool_id: "1", parameters: { path: file } });
let src = readFileSync(file, "utf8");
if (/Your option: Remove the delay/.test(prompt)) src = src.replace("DELAY_MS = 25", "DELAY_MS = 0");
else src = src.replace("// Answers slowly", "// Note: the delay is intentional.\n// Answers slowly");
say({ type: "tool_use", tool_name: "apply_diff", tool_id: "2", parameters: { path: file } });
writeFileSync(file, src);
say({ type: "tool_use", tool_name: "execute_command", tool_id: "3", parameters: { command: "npm test" } });
say({ type: "result", status: "success", stats: { duration_ms: 50, session_costs: 0, tool_calls: 3 } });
