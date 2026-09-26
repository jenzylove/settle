import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { landingPage } from "./app/landing.ts";
import { appPage } from "./app/page.ts";
import { writeRun, type RunFile } from "./engine.ts";
import { repoRoot } from "./git.ts";
import { bundleApp, listRuns, readDebate } from "./ui.ts";

// Builds the static site: landing page, the app in replay mode, and every
// recorded run's results page. The featured run is the newest one that has an
// event log (so it can be replayed) and a pick.
export async function build(args: string[]) {
  const flag = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
  const root = repoRoot(process.cwd());
  const out = resolve(flag("out") ?? join(root, "site"));
  const runsDir = join(root, "runs");
  const config = resolve(flag("config") ?? join(root, "demo", "orders-api", "settle.yml"));

  const runs = listRuns(runsDir).filter((r) => r.status === "done");
  if (runs.length === 0) throw new Error("no finished runs in runs/");
  const replayable = (id: string) => existsSync(join(runsDir, id, "events.jsonl"));
  const featured = flag("featured") ?? (runs.find((r) => replayable(r.id) && r.winner) ?? runs.find((r) => replayable(r.id)) ?? runs[0]).id;

  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "app", "data"), { recursive: true });

  for (const r of runs) {
    const dir = join(out, "runs", r.id);
    mkdirSync(dir, { recursive: true });
    const data: RunFile = JSON.parse(readFileSync(join(runsDir, r.id, "results.json"), "utf8"));
    writeRun(dir, data);
    if (replayable(r.id)) copyFileSync(join(runsDir, r.id, "events.jsonl"), join(dir, "events.jsonl"));
  }

  const featuredRun: RunFile = JSON.parse(readFileSync(join(runsDir, featured, "results.json"), "utf8"));
  writeFileSync(join(out, "index.html"), landingPage(featuredRun, featured));
  writeFileSync(join(out, "app", "index.html"), appPage({ mode: "static", script: bundleApp(), home: "../" }));
  writeFileSync(join(out, "app", "data", "debate.json"), JSON.stringify(readDebate(config)));
  // Only replayable runs are listed in the app; the rest stay reachable by URL.
  writeFileSync(join(out, "app", "data", "runs.json"), JSON.stringify(runs.filter((r) => replayable(r.id))));
  console.log(`site: ${runs.length} runs, featured ${featured} -> ${out}`);
}
