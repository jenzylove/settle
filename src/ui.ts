import { exec } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { parseDocument } from "yaml";
import { parseConfig } from "./config.ts";
import { executeRun, prepareRun, type RunFile } from "./engine.ts";
import type { Stamped } from "./events.ts";
import { appPage } from "./app/page.ts";
import { repoRoot } from "./git.ts";

const here = dirname(fileURLToPath(import.meta.url));

export function bundleApp(): string {
  return buildSync({
    entryPoints: [join(here, "app", "main.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    write: false,
  }).outputFiles[0].text;
}

export interface DebateJson {
  question: string;
  context?: string;
  options: { id: string; name: string; description: string }[];
  constraints: Record<string, unknown>;
  path?: string;
}

export function readDebate(configPath: string): DebateJson {
  const c = parseConfig(readFileSync(configPath, "utf8"));
  return { question: c.question, context: c.context, options: c.options, constraints: c.constraints as Record<string, unknown> };
}

// Edits question, context, options and constraints in place, keeping the rest
// of settle.yml (and its comments) exactly as the user wrote it.
export function writeDebate(configPath: string, d: DebateJson): void {
  const doc = parseDocument(readFileSync(configPath, "utf8"));
  doc.set("question", d.question);
  if (d.context) doc.set("context", d.context);
  else doc.delete("context");
  doc.set("options", d.options.map(({ id, name, description }) => ({ id, name, description })));
  const constraints: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d.constraints)) if (v !== undefined && v !== null && v !== "") constraints[k] = v;
  doc.set("constraints", constraints);
  const text = doc.toString();
  parseConfig(text); // refuse to write a file `settle run` would reject
  writeFileSync(configPath, text);
}

export function listRuns(runsDir: string): { id: string; question: string; created_at?: string; status: "done" | "running"; headline?: string; winner?: string | null }[] {
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .filter((id) => existsSync(join(runsDir, id, "results.json")) || existsSync(join(runsDir, id, "events.jsonl")))
    .sort()
    .reverse()
    .map((id) => {
      const res = join(runsDir, id, "results.json");
      if (existsSync(res)) {
        const r: RunFile = JSON.parse(readFileSync(res, "utf8"));
        return { id, question: r.question, created_at: r.created_at, status: "done" as const, headline: r.verdict.headline, winner: r.verdict.winner };
      }
      const first = readFileSync(join(runsDir, id, "events.jsonl"), "utf8").split("\n")[0];
      const start = first ? JSON.parse(first) : {};
      return { id, question: start.question ?? "", status: "running" as const };
    });
}

function send(res: ServerResponse, status: number, body: string, type = "application/json") {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
  res.end(body);
}

async function body(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export async function serve(args: string[]) {
  const flag = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
  const configPath = resolve(flag("config") ?? "settle.yml");
  if (!existsSync(configPath)) throw new Error(`no settle.yml at ${configPath}`);
  const port = Number(flag("port") ?? 4300);
  const runsDir = join(repoRoot(dirname(configPath)), "runs");

  const js = bundleApp();
  const listeners = new Map<string, Set<(e: Stamped) => void>>();
  let running: string | null = null;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const p = url.pathname;
    try {
      if (p === "/" || p === "/index.html") return send(res, 200, appPage({ mode: "local", script: js }), "text/html");

      if (p === "/api/debate" && req.method === "GET") return send(res, 200, JSON.stringify({ ...readDebate(configPath), path: configPath }));
      if (p === "/api/debate" && req.method === "PUT") {
        writeDebate(configPath, await body(req));
        return send(res, 200, "{}");
      }
      if (p === "/api/runs") return send(res, 200, JSON.stringify(listRuns(runsDir)));

      if (p === "/api/run" && req.method === "POST") {
        if (running) return send(res, 409, `A run is already in progress (${running}).`, "text/plain");
        const prepared = prepareRun(configPath);
        running = prepared.id;
        listeners.set(prepared.id, new Set());
        executeRun(prepared, {}, (e) => listeners.get(prepared.id)?.forEach((fn) => fn(e)))
          .catch((err) => listeners.get(prepared.id)?.forEach((fn) => fn({ t: Date.now(), kind: "error", message: err.message })))
          .finally(() => {
            running = null;
            listeners.get(prepared.id)?.forEach((fn) => fn({ t: Date.now(), kind: "phase", phase: "done" }));
          });
        return send(res, 200, JSON.stringify({ id: prepared.id }));
      }

      // Server sent events: everything recorded so far, then live events.
      const ev = p.match(/^\/api\/events\/([\w-]+)$/);
      if (ev) {
        const id = ev[1];
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
        const file = join(runsDir, id, "events.jsonl");
        if (existsSync(file)) {
          for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
            res.write(`data: ${line}\n\n`);
          }
        }
        const live = listeners.get(id);
        if (!live || running !== id) {
          res.write("event: end\ndata: {}\n\n");
          return res.end();
        }
        // The file read above and this subscription happen in the same tick, and
        // the engine appends then notifies synchronously, so nothing is lost or doubled.
        const fn = (e: Stamped) => {
          res.write(`data: ${JSON.stringify(e)}\n\n`);
          if (e.kind === "phase" && e.phase === "done") {
            res.write("event: end\ndata: {}\n\n");
            res.end();
          }
        };
        live.add(fn);
        req.on("close", () => live.delete(fn));
        return;
      }

      const file = p.match(/^\/runs\/([\w-]+)\/?(.*)$/);
      if (file) {
        const name = file[2] || "index.html";
        if (!/^[\w.-]+$/.test(name)) return send(res, 404, "not found", "text/plain");
        const full = join(runsDir, file[1], name);
        if (!existsSync(full)) return send(res, 404, "not found", "text/plain");
        const type = name.endsWith(".html") ? "text/html" : name.endsWith(".json") ? "application/json" : "text/plain";
        return send(res, 200, readFileSync(full, "utf8"), type);
      }
      send(res, 404, "not found", "text/plain");
    } catch (err) {
      send(res, 400, (err as Error).message, "text/plain");
    }
  });

  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const url = `http://127.0.0.1:${port}/`;
  console.log(`Settle is running at ${url}\nDebate: ${configPath}`);
  if (!args.includes("--no-open")) {
    const open = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
    exec(open);
  }
}
