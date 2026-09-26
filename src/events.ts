import type { FreshnessResult, LoadResult, TestResult } from "./measure.ts";
import type { Verdict } from "./verdict.ts";

// Everything a run does, as a stream. The CLI prints these, the local UI
// streams them to the browser, and each run saves them to events.jsonl so the
// hosted site can replay a real run.
export type RunEvent =
  | { kind: "start"; id: string; question: string; base: string; options: { id: string; name: string; description: string }[] }
  | { kind: "phase"; phase: "build" | "measure" | "done" }
  | { kind: "bob"; option: string; tool: string; label: string }
  | { kind: "built"; option: string; ok: boolean; error?: string; seconds: number; tool_calls?: number; cost?: number }
  | { kind: "measure"; option: string; step: "install" | "tests" | "start" | "load" | "freshness" }
  | {
      kind: "measured";
      option: string;
      load?: LoadResult;
      freshness?: FreshnessResult;
      tests?: TestResult;
      lines?: { added: number; removed: number };
      error?: string;
    }
  | { kind: "verdict"; verdict: Verdict }
  | { kind: "error"; message: string };

export type Stamped = RunEvent & { t: number };

export type Listener = (event: Stamped) => void;

// Turns a Bob Shell tool call into a short line a reviewer can follow.
export function describeTool(tool: string, params: Record<string, any>, workspace: string): string {
  const rel = (p?: string) => {
    if (!p) return "";
    const norm = String(p).replace(/\\/g, "/");
    const ws = workspace.replace(/\\/g, "/").replace(/\/$/, "");
    return norm.toLowerCase().startsWith(ws.toLowerCase() + "/") ? norm.slice(ws.length + 1) : norm;
  };
  const short = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  switch (tool) {
    case "read_file":
      return `Read ${rel(params.path) || short(JSON.stringify(params.args ?? params))}`;
    case "write_file":
    case "write_to_file":
      return `Wrote ${rel(params.path)}`;
    case "apply_diff":
    case "edit_file":
    case "replace_in_file":
    case "search_and_replace":
    case "insert_content":
      return `Edited ${rel(params.path)}`;
    case "execute_command":
      return `Ran ${short(String(params.command ?? ""))}`;
    case "list_files":
      return `Listed ${rel(params.path) || "files"}`;
    case "search_files":
    case "codebase_search":
      return `Searched for ${short(String(params.regex ?? params.query ?? ""), 40)}`;
    case "list_code_definition_names":
      return `Mapped ${rel(params.path)}`;
    default:
      return tool.replace(/_/g, " ");
  }
}
