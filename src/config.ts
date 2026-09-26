import { readFileSync } from "node:fs";
import { parse } from "yaml";

export interface Option {
  id: string;
  name: string;
  description: string;
}

export interface Request {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
}

export interface Freshness {
  // A write that should become visible to readers.
  write: Request;
  // The read that should reflect it.
  read: Request;
  // Dotted path into the read's JSON (e.g. "0.customer_id") that must equal
  // the value named by `equals` in the write body once the write is visible.
  read_field: string;
  equals: string;
  probes: number;
  timeout_seconds: number;
}

export interface Constraints {
  max_p95_ms?: number;
  max_staleness_seconds?: number;
  max_new_dependencies?: number;
  tests_must_pass?: boolean;
}

export interface SettleConfig {
  question: string;
  context?: string;
  app: {
    install: string;
    start: string;
    test: string;
    health: string;
    port_env: string;
    ready_timeout_seconds: number;
  };
  load: {
    request: Request;
    duration_seconds: number;
    concurrency: number;
    warmup_seconds: number;
  };
  freshness?: Freshness;
  constraints: Constraints;
  options: Option[];
  bob: {
    max_turns: number;
    timeout_minutes: number;
  };
}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(`settle.yml is missing ${what}`);
  }
  return value;
}

export function parseConfig(text: string): SettleConfig {
  const raw = parse(text) ?? {};
  const options: Option[] = need(raw.options, "options").map((o: any, i: number) => ({
    id: need(o.id, `options[${i}].id`),
    name: need(o.name, `options[${i}].name`),
    description: need(o.description, `options[${i}].description`),
  }));
  if (options.length < 2) throw new Error("settle.yml needs at least two options to compare");
  const ids = new Set(options.map((o) => o.id));
  if (ids.size !== options.length) throw new Error("option ids must be unique");
  for (const id of ids) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`option id "${id}" must be lowercase letters, digits and dashes`);
  }

  const app = need(raw.app, "app");
  const load = need(raw.load, "load");
  return {
    question: need(raw.question, "question"),
    context: raw.context,
    app: {
      install: app.install ?? "npm install --no-audit --no-fund",
      start: need(app.start, "app.start"),
      test: app.test ?? "npm test",
      health: app.health ?? "/health",
      port_env: app.port_env ?? "PORT",
      ready_timeout_seconds: app.ready_timeout_seconds ?? 60,
    },
    load: {
      request: need(load.request, "load.request"),
      duration_seconds: load.duration_seconds ?? 15,
      concurrency: load.concurrency ?? 8,
      warmup_seconds: load.warmup_seconds ?? 3,
    },
    freshness: raw.freshness
      ? {
          write: need(raw.freshness.write, "freshness.write"),
          read: need(raw.freshness.read, "freshness.read"),
          read_field: need(raw.freshness.read_field, "freshness.read_field"),
          equals: need(raw.freshness.equals, "freshness.equals"),
          probes: raw.freshness.probes ?? 3,
          timeout_seconds: raw.freshness.timeout_seconds ?? 90,
        }
      : undefined,
    constraints: raw.constraints ?? {},
    options,
    bob: {
      max_turns: raw.bob?.max_turns ?? 30,
      timeout_minutes: raw.bob?.timeout_minutes ?? 20,
    },
  };
}

export function loadConfig(path: string): SettleConfig {
  return parseConfig(readFileSync(path, "utf8"));
}
