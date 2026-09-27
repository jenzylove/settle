import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { landingPage } from "./app/landing.ts";
import { appPage } from "./app/page.ts";
import { writeRun, type RunFile } from "./engine.ts";
import { repoRoot } from "./git.ts";
import { bundleApp, listRuns, readDebate } from "./ui.ts";

const inside = (child: string, parent: string) => {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.includes(`:`) && !rel.startsWith(sep));
};

// The output folder is deleted and rebuilt, so refuse anything that could take
// real work with it: the repository itself, anything above it, the folder the
// user is standing in, or a folder that holds sources or run data. An existing
// folder must look like a previous site build.
export function assertSafeOut(out: string, root: string, cwd: string): void {
  const o = resolve(out);
  const why =
    inside(root, o) ? "it contains the repository"
    : inside(cwd, o) ? "it contains the current folder"
    : ["src", "runs", "test", "demo", "docs", ".git", "bin", "node_modules", ".settle"].some((d) => inside(o, join(root, d))) ? "it is inside the repository's sources or run data"
    : "";
  if (why) throw new Error(`refusing to use ${o} as the site folder: ${why}`);
  if (existsSync(o) && readdirSync(o).length > 0 && !existsSync(join(o, "index.html"))) {
    throw new Error(`refusing to replace ${o}: it is not empty and does not look like a site build`);
  }
}

// Builds the static site: landing page, the app in replay mode, and every
// recorded run's results page. The featured run is the newest one that has an
// event log (so it can be replayed) and a pick.
export async function build(args: string[]) {
  const flag = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
  const root = repoRoot(process.cwd());
  const out = resolve(flag("out") ?? join(root, "site"));
  assertSafeOut(out, root, process.cwd());
  const runsDir = join(root, "runs");
  const config = resolve(flag("config") ?? join(root, "demo", "orders-api", "settle.yml"));

  const runs = listRuns(runsDir).filter((r) => r.status === "done");
  if (runs.length === 0) throw new Error("no finished runs in runs/");
  const replayable = (id: string) => existsSync(join(runsDir, id, "events.jsonl"));
  const featured = flag("featured") ?? (runs.find((r) => replayable(r.id) && r.winner) ?? runs.find((r) => replayable(r.id)) ?? runs[0]).id;

  // Build next to the target, then swap, so a failed build never leaves the
  // old site half deleted.
  const tmp = join(dirname(out), `.${out.split(sep).pop()}-build-${process.pid}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(join(tmp, "app", "data"), { recursive: true });

  for (const r of runs) {
    const dir = join(tmp, "runs", r.id);
    mkdirSync(dir, { recursive: true });
    const data: RunFile = JSON.parse(readFileSync(join(runsDir, r.id, "results.json"), "utf8"));
    writeRun(dir, data);
    if (replayable(r.id)) copyFileSync(join(runsDir, r.id, "events.jsonl"), join(dir, "events.jsonl"));
  }

  const featuredRun: RunFile = JSON.parse(readFileSync(join(runsDir, featured, "results.json"), "utf8"));
  // The newest run where an option was refused for touching existing tests.
  let caught: { id: string; option: string; file: string } | undefined;
  for (const r of runs) {
    const d: RunFile = JSON.parse(readFileSync(join(runsDir, r.id, "results.json"), "utf8"));
    const o = d.options.find((x) => x.integrity?.touched.length);
    if (o) { caught = { id: r.id, option: o.name, file: o.integrity!.touched[0].split("/").slice(-2).join("/") }; break; }
  }
  writeFileSync(join(tmp, "index.html"), landingPage(featuredRun, featured, caught));
  writeFileSync(join(tmp, "app", "index.html"), appPage({ mode: "static", script: bundleApp(), home: "../" }));
  writeFileSync(join(tmp, "app", "data", "debate.json"), JSON.stringify(readDebate(config)));
  // Only replayable runs are listed in the app; the rest stay reachable by URL.
  writeFileSync(join(tmp, "app", "data", "runs.json"), JSON.stringify(runs.filter((r) => replayable(r.id))));

  rmSync(out, { recursive: true, force: true });
  renameSync(tmp, out);
  console.log(`site: ${runs.length} runs, featured ${featured} -> ${out}`);
}
